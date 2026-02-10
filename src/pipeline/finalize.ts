import type { NotionClientWrapper } from '../notion/client.js';
import type { LLMClient } from '../llm/client.js';
import { getPageContent } from '../notion/blocks.js';
import { finalizeAuditPage } from '../notion/mutations.js';
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
): Promise<void> {
  // 1. Write completed block
  logger.info('Writing completed block to audit page');
  await notionClient.appendBlockChildren(
    prepResult.auditPageId,
    buildCompletedBlock(),
  );

  // 2. Update audit page status
  logger.info('Updating audit page status to Complete');
  await finalizeAuditPage(notionClient, prepResult.auditPageId);

  // 3. Generate Slack summary
  logger.info('Generating Slack summary...');
  try {
    // Read the completed audit page content
    const auditContent = await getPageContent(notionClient, prepResult.auditPageId);

    const summaryPrompt = buildSummaryPrompt({
      systemPrompt: config.llm.prompts.summary?.systemPrompt,
      auditPageUrl: prepResult.auditPageUrl,
      auditContent,
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
    await sendSlackMessage(
      config.notifications.slack,
      summaryText,
      logger,
      dryRun,
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
