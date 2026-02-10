import { NotionClientWrapper } from '../notion/client.js';
import { LLMClient } from '../llm/client.js';
import { sendNoFrsMessage } from '../notifications/slack.js';
import { runPrep } from './prep.js';
import { processFR } from './process-fr.js';
import { runFinalize } from './finalize.js';
import type { PipelineConfig, TriageResult } from './types.js';
import type { Logger } from '../utils/logger.js';

/**
 * Main triage orchestrator: Prep → Process each FR → Finalize
 */
export async function runTriage(
  config: PipelineConfig,
  logger: Logger,
): Promise<TriageResult> {
  const { product, dryRun } = config;

  // Initialize clients
  const notionApiKey = process.env.NOTION_API_KEY;
  if (!notionApiKey) {
    throw new Error('NOTION_API_KEY environment variable is required');
  }

  const llmApiKey = process.env.LLM_API_KEY;
  if (!llmApiKey) {
    throw new Error('LLM_API_KEY environment variable is required');
  }

  const llmProvider = (process.env.LLM_PROVIDER ?? 'anthropic') as 'anthropic' | 'openai';
  const llmModel = process.env.LLM_MODEL ?? product.llm.model ?? 'claude-sonnet-4-5-20250514';

  const notionClient = new NotionClientWrapper({
    apiKey: notionApiKey,
    dryRun,
    logger,
  });

  const llmClient = new LLMClient({
    provider: llmProvider,
    apiKey: llmApiKey,
    model: llmModel,
    logger,
  });

  logger.info('Triage starting', {
    product: product.product.name,
    dryRun,
    llmProvider,
    llmModel,
  });

  // Phase 1: Prep
  const prepResult = await runPrep(notionClient, config, logger);

  if (!prepResult) {
    // No FRs to process
    await sendNoFrsMessage(product.notifications.slack, logger, dryRun);
    return { frCount: 0, status: 'no_frs' };
  }

  // Phase 2: Process each FR sequentially
  const results = [];
  for (let i = 0; i < prepResult.featureRequests.length; i++) {
    const fr = prepResult.featureRequests[i];
    logger.info(`Processing FR ${i + 1}/${prepResult.featureRequests.length}: ${fr.title}`);

    try {
      const result = await processFR(
        fr,
        i,
        prepResult,
        product,
        notionClient,
        llmClient,
        logger,
      );
      results.push(result);
    } catch (err) {
      logger.error(`Failed to process FR ${fr.id}: ${err}`);
      results.push({
        frId: fr.id,
        frTitle: fr.title,
        alignment: { verdict: 'error', confidence: 0, suggested_product: '', reason: String(err) },
        belongsToProduct: false,
        pulseMatches: [],
        ideaMatches: [],
        errors: [String(err)],
      });
    }
  }

  // Phase 3: Finalize
  logger.info('Finalizing triage run...');
  await runFinalize(
    prepResult,
    results,
    product,
    notionClient,
    llmClient,
    logger,
    dryRun,
  );

  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
  logger.info('Triage complete', {
    frCount: results.length,
    belongsCount: results.filter((r) => r.belongsToProduct).length,
    totalPulseMatches: results.reduce((sum, r) => sum + r.pulseMatches.length, 0),
    totalIdeaMatches: results.reduce((sum, r) => sum + r.ideaMatches.length, 0),
    totalErrors,
  });

  return {
    frCount: results.length,
    status: totalErrors > 0 ? 'error' : 'complete',
    results,
  };
}
