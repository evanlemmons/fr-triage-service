import type { NotionClientWrapper } from '../notion/client.js';
import type { LLMClient } from '../llm/client.js';
import { getPageContent } from '../notion/blocks.js';
import { queryUnprocessedFRs, queryPulseItems, queryIdeaTitles } from '../notion/queries.js';
import { createAuditPage } from '../notion/mutations.js';
import type { PipelineConfig, PrepResult } from './types.js';
import type { Logger } from '../utils/logger.js';

/**
 * Phase 1: Preparation
 * - Query unprocessed FRs
 * - Cache product info, pulse data, idea titles
 * - Create audit page
 */
export async function runPrep(
  notionClient: NotionClientWrapper,
  config: PipelineConfig,
  logger: Logger,
): Promise<PrepResult | null> {
  const { product, frDatabaseId } = config;

  // 1. Query unprocessed FRs
  logger.info(`Querying unprocessed FRs for product: ${product.product.name}`);
  const featureRequests = await queryUnprocessedFRs(
    notionClient,
    frDatabaseId,
    product.product.selectValue,
  );

  if (featureRequests.length === 0) {
    logger.info('No unprocessed FRs found');
    return null;
  }

  logger.info(`Found ${featureRequests.length} unprocessed FRs`);

  // 2. Fetch all context in parallel
  logger.info('Fetching product info, pulse data, and idea titles...');

  const [productInfo, pulseData, ideaTitles] = await Promise.all([
    // Product information page content
    getPageContent(notionClient, product.productInfo.pageId),

    // Pulse items (with full page content)
    product.matching.pulse.enabled
      ? queryPulseItems(
          notionClient,
          product.matching.pulse.databaseId,
          product.product.productPageId,
          product.matching.pulse.filters.statusNotEquals,
        )
      : Promise.resolve([]),

    // Idea titles (content fetched later for shortlisted items only)
    product.matching.ideas.enabled
      ? queryIdeaTitles(
          notionClient,
          product.matching.ideas.databaseId,
          product.product.productPageId,
          product.matching.ideas.filters.statusNotEquals,
        )
      : Promise.resolve([]),
  ]);

  logger.info('Context cached', {
    productInfoLength: productInfo.length,
    pulseCount: pulseData.length,
    ideaCount: ideaTitles.length,
  });

  // 3. Create audit page
  logger.info('Creating audit page...');
  const { id: auditPageId, url: auditPageUrl } = await createAuditPage(
    notionClient,
    product.audit.databaseId,
    product.product.productPageId,
    featureRequests.length,
  );

  logger.info('Audit page created', { auditPageId, auditPageUrl });

  return {
    featureRequests,
    productInfo,
    pulseData,
    ideaTitles,
    auditPageId,
    auditPageUrl,
  };
}
