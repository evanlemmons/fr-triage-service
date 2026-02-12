import type { NotionClientWrapper } from '../notion/client.js';
import type { LLMClient } from '../llm/client.js';
import { getPageContent } from '../notion/blocks.js';
import { finalizeAuditPage, updateAuditPageStatus } from '../notion/mutations.js';
import { buildCompletedBlock } from '../audit/writer.js';
import { buildSummaryPrompt } from '../llm/prompts/summary.js';
import { sendSlackMessage } from '../notifications/slack.js';
import type { ProductConfig } from '../config/types.js';
import type { PrepResult, FRProcessingResult } from './types.js';
import type { Logger } from '../utils/logger.js';

/**
 * Phase 3: Finalization
 * - Write completed block to audit page
 * - Update audit page status to Complete
 * - Generate and send Slack summary
 */
export async function runFinalize(
  prepResult: PrepResult,
  results: FRProcessingResult[],
  config: ProductConfig,
  notionClient: NotionClientWrapper,
  llmClient: LLMClient,
  logger: Logger,
  dryRun: boolean,
  testSlack: boolean,
): Promise<void> {
  // 1. Write completed block
  logger.info('Writing completed block to audit page');
  await notionClient.appendBlockChildren(
    prepResult.auditPageId,
    buildCompletedBlock(),
  );

  // 2. Update audit page status based on processing results
  logger.info('Determining final audit status...');
  const statusDecision = determineAuditStatus(results, config.product.name);
  logger.info(`Setting audit status to: ${statusDecision.status}`);
  await updateAuditPageStatus(
    notionClient,
    prepResult.auditPageId,
    statusDecision.status,
    statusDecision.notes,
  );

  // 3. Generate Slack summary
  logger.info('Generating Slack summary...');
  try {
    // Read the completed audit page content
    const auditContent = await getPageContent(notionClient, prepResult.auditPageId);

    const summaryPrompt = buildSummaryPrompt({
      systemPrompt: config.llm.prompts.summary?.systemPrompt,
      productName: config.product.name,
      auditPageUrl: prepResult.auditPageUrl,
      auditContent,
      frData: results.map(r => ({ title: r.frTitle, url: r.frUrl })),
    });

    // For the summary, we just need raw text (not structured JSON)
    // Use a simple schema that accepts any string
    const summaryText = await generateSummaryText(
      llmClient,
      summaryPrompt.system,
      summaryPrompt.user,
      logger,
    );

    // 4. Send to Slack
    // If testSlack is true, force Slack to send even in dry-run mode
    await sendSlackMessage(
      config.notifications.slack,
      summaryText,
      logger,
      dryRun && !testSlack,
    );
  } catch (err) {
    logger.error(`Failed to generate/send Slack summary: ${err}`);
    // Don't fail the whole run for a summary failure
  }
}

/**
 * Generate the summary as raw text (not structured JSON).
 */
async function generateSummaryText(
  llmClient: LLMClient,
  systemPrompt: string,
  userMessage: string,
  logger: Logger,
): Promise<string> {
  // The summary prompt returns plain text (Slack mrkdwn), not JSON.
  // We use the LLM client directly rather than structured output.
  // Use a simple z.object wrapper to get the text.
  const { z } = await import('zod');
  const textSchema = z.string();

  // For Anthropic, we can just get the raw text response
  try {
    const result = await llmClient.complete({
      systemPrompt,
      userMessage,
      responseSchema: z.object({ summary: z.string() }),
      schemaName: 'summary',
    });
    return (result as any).summary;
  } catch {
    // Fallback: if structured output fails, return a simple summary
    logger.warn('Structured summary generation failed, using fallback');
    return `Triage complete. Check the audit page for details.`;
  }
}

/**
 * Determine the final status for the audit page based on processing results.
 *
 * Decision logic:
 * - "Error": Any technical/breaking errors occurred (LLM failures, API errors, etc.)
 * - "Needs Attention": All FRs processed successfully BUT at least one has business issues:
 *   - Product misalignment (verdict doesn't match product OR uncertain verdict)
 *   - No Pulse matches found (for FRs that belong to the product)
 *   - No Idea matches found (for FRs that belong to the product)
 * - "Complete": All FRs processed successfully with no business issues
 */
function determineAuditStatus(
  results: FRProcessingResult[],
  productName: string,
): { status: 'Complete' | 'Error' | 'Needs Attention'; notes?: string } {
  // Check for technical errors first (highest priority)
  const technicalErrors = results.filter(r => r.errors.length > 0);
  if (technicalErrors.length > 0) {
    const errorDetails = technicalErrors
      .map(r => `FR "${r.frTitle}": ${r.errors.join(', ')}`)
      .join('\n');

    return {
      status: 'Error',
      notes: `Technical errors occurred during processing:\n\n${errorDetails}\n\nPlease review logs and retry if needed.`,
    };
  }

  // Check for business logic issues (FRs needing attention)
  const frsNeedingAttention = results.filter(r => {
    // Product misalignment checks (uses same normalize as process-fr.ts)
    const normalize = (s: string) => s.toLowerCase().replace(/[-\s]/g, '_');
    const verdictNormalized = normalize(r.alignment.verdict);
    const productNameNormalized = normalize(productName);
    const verdictMismatch = !(
      verdictNormalized === productNameNormalized ||
      verdictNormalized === 'home' || // backward compat
      verdictNormalized === 'belongs'
    );
    const uncertainVerdict = verdictNormalized === 'uncertain';
    const productIssue = verdictMismatch || uncertainVerdict;

    // Missing matches for FRs that belong to this product
    const noPulseMatches = r.belongsToProduct && r.pulseMatches.length === 0;
    const noIdeaMatches = r.belongsToProduct && r.ideaMatches.length === 0;

    // Note: low confidence is NOT flagged — matches below threshold are
    // simply excluded, not flagged as needing attention.
    return productIssue || noPulseMatches || noIdeaMatches;
  });

  if (frsNeedingAttention.length > 0) {
    const attentionCount = frsNeedingAttention.length;

    return {
      status: 'Needs Attention',
      notes: `${attentionCount} FRs need manual review. See audit page for details.\n\nAfter addressing issues, manually change this doc's status to "Complete".`,
    };
  }

  // All FRs processed successfully with no issues
  return {
    status: 'Complete',
    // No notes needed for successful completion
  };
}
