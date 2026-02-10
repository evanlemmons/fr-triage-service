import type { NotionClientWrapper } from '../notion/client.js';
import type { LLMClient } from '../llm/client.js';
import { getPageContent } from '../notion/blocks.js';
import { updateFRPulseRelation, updateFRIdeaRelation } from '../notion/mutations.js';
import { validateIds, mergeRelationIds } from '../validation/ids.js';
import { productAlignmentSchema, pulseMatchingSchema, ideaShortlistSchema, ideaMatchingSchema } from '../llm/schemas.js';
import { buildProductAlignmentPrompt } from '../llm/prompts/product-alignment.js';
import { buildPulseMatchingPrompt } from '../llm/prompts/pulse-matching.js';
import { buildIdeaShortlistPrompt } from '../llm/prompts/idea-shortlist.js';
import { buildIdeaMatchingPrompt } from '../llm/prompts/idea-matching.js';
import {
  buildFRHeaderBlocks,
  buildAlignmentAuditBlocks,
  buildProductMisalignmentCallout,
  buildPulseHeaderBlock,
  buildPulseMatchAuditBlocks,
  buildNoPulseMatchWarning,
  buildMisalignmentNotice,
  buildIdeaHeaderBlock,
  buildIdeaMatchAuditBlocks,
  buildNoIdeaMatchWarning,
} from '../audit/writer.js';
import type { ProductConfig } from '../config/types.js';
import type { FeatureRequest, PulseItem, IdeaTitle, IdeaWithContent } from '../notion/types.js';
import type { PrepResult, FRProcessingResult, ValidatedMatch } from './types.js';
import type { Logger } from '../utils/logger.js';

/**
 * Phase 2: Process a single feature request through the full pipeline.
 */
export async function processFR(
  fr: FeatureRequest,
  frIndex: number,
  prepResult: PrepResult,
  config: ProductConfig,
  notionClient: NotionClientWrapper,
  llmClient: LLMClient,
  logger: Logger,
  skipFRUpdates: boolean = false,
): Promise<FRProcessingResult> {
  const errors: string[] = [];
  const result: FRProcessingResult = {
    frId: fr.id,
    frTitle: fr.title,
    frUrl: fr.url,
    alignment: { verdict: 'uncertain', confidence: 0, suggested_product: '', reason: '' },
    belongsToProduct: false,
    pulseMatches: [],
    ideaMatches: [],
    errors,
  };

  try {
    // Write FR header to audit page
    await notionClient.appendBlockChildren(
      prepResult.auditPageId,
      buildFRHeaderBlocks(frIndex, fr.id),
    );

    // --- Step 1: Product Alignment ---
    logger.info(`  Step 1: Product alignment check`);
    const alignmentPrompt = buildProductAlignmentPrompt({
      systemPrompt: config.llm.prompts.productAlignment.systemPrompt,
      frTitle: fr.title,
      frContent: fr.content,
      productInfo: prepResult.productInfo,
    });

    const alignment = await llmClient.complete({
      systemPrompt: alignmentPrompt.system,
      userMessage: alignmentPrompt.user,
      responseSchema: productAlignmentSchema,
      schemaName: 'product_alignment',
    });

    result.alignment = alignment;

    // Write alignment audit
    await notionClient.appendBlockChildren(
      prepResult.auditPageId,
      buildAlignmentAuditBlocks(alignment, config.product.name),
    );

    // Determine if FR belongs to this product
    // The n8n workflow checks if verdict matches the product name (case-insensitive)
    const verdictLower = alignment.verdict.toLowerCase();
    const productNameLower = config.product.name.toLowerCase();
    result.belongsToProduct =
      verdictLower === productNameLower ||
      verdictLower === 'home' || // backward compat with Home-specific prompts
      verdictLower === 'belongs';

    // Write misalignment callout if FR doesn't belong to this product
    if (!result.belongsToProduct) {
      await notionClient.appendBlockChildren(
        prepResult.auditPageId,
        buildProductMisalignmentCallout({
          currentProduct: config.product.name,
          suggestedProduct: alignment.suggested_product,
          verdict: alignment.verdict,
        }),
      );
      logger.warn(`  FR does not belong to ${config.product.name} (verdict: ${alignment.verdict})`);
    } else {
      logger.info(`  FR belongs to ${config.product.name} (confidence: ${Math.round(alignment.confidence * 100)}%)`);
    }

    // --- Step 2: Pulse Matching ---
    if (config.matching.pulse.enabled && prepResult.pulseData.length > 0) {
      logger.info(`  Step 2: Pulse matching`);
      result.pulseMatches = await matchPulses(
        fr,
        prepResult,
        config,
        notionClient,
        llmClient,
        logger,
        skipFRUpdates,
        result.belongsToProduct,
      );
    }

    // --- Steps 3 & 4: Idea Shortlisting + Matching ---
    if (config.matching.ideas.enabled && prepResult.ideaTitles.length > 0) {
      logger.info(`  Step 3-4: Idea shortlisting and matching`);
      result.ideaMatches = await matchIdeas(
        fr,
        prepResult,
        config,
        notionClient,
        llmClient,
        logger,
        skipFRUpdates,
        result.belongsToProduct,
      );
    }
  } catch (err) {
    const errorMsg = `Error processing FR ${fr.id}: ${err}`;
    logger.error(errorMsg);
    errors.push(errorMsg);
  }

  return result;
}

/**
 * Pulse matching sub-pipeline: LLM match → validate → audit → update relation
 */
async function matchPulses(
  fr: FeatureRequest,
  prepResult: PrepResult,
  config: ProductConfig,
  notionClient: NotionClientWrapper,
  llmClient: LLMClient,
  logger: Logger,
  skipFRUpdates: boolean,
  belongsToProduct: boolean,
): Promise<ValidatedMatch[]> {
  // Write pulse header to audit
  await notionClient.appendBlockChildren(
    prepResult.auditPageId,
    buildPulseHeaderBlock(),
  );

  // If FR doesn't belong to product, write notice and skip matching
  if (!belongsToProduct) {
    await notionClient.appendBlockChildren(
      prepResult.auditPageId,
      buildMisalignmentNotice(config.product.name),
    );
    logger.info(`  Pulse matching skipped (FR misaligned)`);
    return [];
  }

  // LLM: Match FR to pulses
  const prompt = buildPulseMatchingPrompt({
    systemPrompt: config.llm.prompts.pulseMatching.systemPrompt,
    frTitle: fr.title,
    frContent: fr.content,
    productInfo: prepResult.productInfo,
    pulseData: prepResult.pulseData,
  });

  const llmResult = await llmClient.complete({
    systemPrompt: prompt.system,
    userMessage: prompt.user,
    responseSchema: pulseMatchingSchema,
    schemaName: 'pulse_matching',
  });

  // Filter by confidence threshold
  const aboveThreshold = llmResult.matches.filter(
    (m) => m.confidence >= config.matching.pulse.confidenceThreshold,
  );

  // Validate IDs against known pulse set
  const validPulseIds = prepResult.pulseData.map((p) => p.id);
  const proposedIds = aboveThreshold.map((m) => m.pulse_id);
  const { valid, invalid } = validateIds(proposedIds, validPulseIds);

  if (invalid.length > 0) {
    logger.warn(`  Filtered ${invalid.length} invalid pulse IDs from LLM response`);
  }

  // Build validated matches
  const validMatches: ValidatedMatch[] = valid.map((id) => {
    const original = aboveThreshold.find(
      (m) => m.pulse_id.replace(/-/g, '').toLowerCase() === id.replace(/-/g, '').toLowerCase(),
    );
    return {
      id,
      confidence: original?.confidence ?? 0,
      reason: original?.reason ?? '',
    };
  });

  if (validMatches.length > 0) {
    // Write audit entries for each match
    for (const match of validMatches) {
      await notionClient.appendBlockChildren(
        prepResult.auditPageId,
        buildPulseMatchAuditBlocks(match),
      );
    }

    // Merge with existing relation IDs and update FR
    if (!skipFRUpdates) {
      const mergedIds = mergeRelationIds(
        fr.existingPulseRelationIds,
        validMatches.map((m) => m.id),
      );
      await updateFRPulseRelation(notionClient, fr.id, mergedIds);
      logger.info(`  Updated FR pulse relations: ${validMatches.length} matches`);
    } else {
      logger.info(`  Found ${validMatches.length} pulse matches (FR update skipped — dry run)`);
    }
  } else {
    // No matches - write warning
    await notionClient.appendBlockChildren(
      prepResult.auditPageId,
      buildNoPulseMatchWarning(),
    );
    logger.info(`  No pulse matches found`);
  }

  return validMatches;
}

/**
 * Idea matching sub-pipeline: shortlist → fetch content → LLM match → validate → audit → update
 */
async function matchIdeas(
  fr: FeatureRequest,
  prepResult: PrepResult,
  config: ProductConfig,
  notionClient: NotionClientWrapper,
  llmClient: LLMClient,
  logger: Logger,
  skipFRUpdates: boolean,
  belongsToProduct: boolean,
): Promise<ValidatedMatch[]> {
  // Write idea header to audit
  await notionClient.appendBlockChildren(
    prepResult.auditPageId,
    buildIdeaHeaderBlock(),
  );

  // If FR doesn't belong to product, write notice and skip matching
  if (!belongsToProduct) {
    await notionClient.appendBlockChildren(
      prepResult.auditPageId,
      buildMisalignmentNotice(config.product.name),
    );
    logger.info(`  Idea matching skipped (FR misaligned)`);
    return [];
  }

  // Step 3: Shortlist ideas by title
  const shortlistPrompt = buildIdeaShortlistPrompt({
    systemPrompt: config.llm.prompts.ideaShortlist.systemPrompt,
    frTitle: fr.title,
    frContent: fr.content,
    productInfo: prepResult.productInfo,
    ideaTitles: prepResult.ideaTitles,
  });

  const shortlistResult = await llmClient.complete({
    systemPrompt: shortlistPrompt.system,
    userMessage: shortlistPrompt.user,
    responseSchema: ideaShortlistSchema,
    schemaName: 'idea_shortlist',
  });

  if (shortlistResult.candidate_ideas.length === 0) {
    await notionClient.appendBlockChildren(
      prepResult.auditPageId,
      buildNoIdeaMatchWarning(),
    );
    logger.info(`  No idea candidates from shortlist`);
    return [];
  }

  logger.info(`  Shortlisted ${shortlistResult.candidate_ideas.length} idea candidates`);

  // Validate shortlisted IDs exist
  const validIdeaIds = prepResult.ideaTitles.map((i) => i.id);
  const shortlistedIds = shortlistResult.candidate_ideas.map((c) => c.id);
  const { valid: validShortlistIds } = validateIds(shortlistedIds, validIdeaIds);

  if (validShortlistIds.length === 0) {
    await notionClient.appendBlockChildren(
      prepResult.auditPageId,
      buildNoIdeaMatchWarning(),
    );
    logger.info(`  All shortlisted idea IDs were invalid`);
    return [];
  }

  // Fetch full content for shortlisted ideas
  const ideaCandidates: IdeaWithContent[] = [];
  for (const ideaId of validShortlistIds) {
    try {
      const content = await getPageContent(notionClient, ideaId);
      const ideaTitle = prepResult.ideaTitles.find(
        (i) => i.id.replace(/-/g, '') === ideaId.replace(/-/g, ''),
      );
      ideaCandidates.push({
        id: ideaId,
        title: ideaTitle?.title ?? '',
        content,
      });
    } catch (err) {
      logger.warn(`  Failed to fetch content for idea ${ideaId}: ${err}`);
    }
  }

  if (ideaCandidates.length === 0) {
    await notionClient.appendBlockChildren(
      prepResult.auditPageId,
      buildNoIdeaMatchWarning(),
    );
    return [];
  }

  // Step 4: Match with full content
  const matchPrompt = buildIdeaMatchingPrompt({
    systemPrompt: config.llm.prompts.ideaMatching.systemPrompt,
    frTitle: fr.title,
    frContent: fr.content,
    productInfo: prepResult.productInfo,
    ideaCandidates,
  });

  const matchResult = await llmClient.complete({
    systemPrompt: matchPrompt.system,
    userMessage: matchPrompt.user,
    responseSchema: ideaMatchingSchema,
    schemaName: 'idea_matching',
  });

  // Filter by confidence and validate IDs
  const aboveThreshold = matchResult.matched_ideas.filter(
    (m) => m.confidence >= config.matching.ideas.confidenceThreshold,
  );

  const proposedIds = aboveThreshold.map((m) => m.idea_page_id);
  const candidateIds = ideaCandidates.map((i) => i.id);
  const { valid, invalid } = validateIds(proposedIds, candidateIds);

  if (invalid.length > 0) {
    logger.warn(`  Filtered ${invalid.length} invalid idea IDs from LLM response`);
  }

  // Build validated matches
  const validMatches: ValidatedMatch[] = valid.map((id) => {
    const original = aboveThreshold.find(
      (m) => m.idea_page_id.replace(/-/g, '').toLowerCase() === id.replace(/-/g, '').toLowerCase(),
    );
    return {
      id,
      confidence: original?.confidence ?? 0,
      reason: original?.reasoning ?? '',
    };
  });

  if (validMatches.length > 0) {
    // Write audit entries for each match
    for (const match of validMatches) {
      await notionClient.appendBlockChildren(
        prepResult.auditPageId,
        buildIdeaMatchAuditBlocks(match),
      );
    }

    // Merge with existing relation IDs and update FR
    if (!skipFRUpdates) {
      const mergedIds = mergeRelationIds(
        fr.existingIdeaRelationIds,
        validMatches.map((m) => m.id),
      );
      await updateFRIdeaRelation(notionClient, fr.id, mergedIds);
      logger.info(`  Updated FR idea relations: ${validMatches.length} matches`);
    } else {
      logger.info(`  Found ${validMatches.length} idea matches (FR update skipped — dry run)`);
    }
  } else {
    await notionClient.appendBlockChildren(
      prepResult.auditPageId,
      buildNoIdeaMatchWarning(),
    );
    logger.info(`  No idea matches found after full content analysis`);
  }

  return validMatches;
}
