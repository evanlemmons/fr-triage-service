import type { NotionClientWrapper } from './client.js';
import { richTextToPlainText, getPageContent } from './blocks.js';
import type { FeatureRequest, PulseItem, IdeaTitle } from './types.js';

/**
 * Query unprocessed feature requests for a specific product.
 * Filters: Product == selectValue AND Status == "Unprocessed"
 */
export async function queryUnprocessedFRs(
  client: NotionClientWrapper,
  frDatabaseId: string,
  productSelectValue: string,
): Promise<FeatureRequest[]> {
  const results = await client.queryDatabase({
    database_id: frDatabaseId,
    filter: {
      and: [
        {
          property: 'Product',
          select: { equals: productSelectValue },
        },
        {
          property: 'Status',
          status: { equals: 'Unprocessed' },
        },
      ],
    },
  });

  return results.map(mapPageToFeatureRequest);
}

/**
 * Query recent feature requests for a product regardless of status.
 * Used in backtest mode to re-process already-triaged FRs for comparison.
 * Filters: Product == selectValue AND Date >= daysAgo days ago
 */
export async function queryRecentFRs(
  client: NotionClientWrapper,
  frDatabaseId: string,
  productSelectValue: string,
  daysAgo: number = 7,
): Promise<FeatureRequest[]> {
  const since = new Date();
  since.setDate(since.getDate() - daysAgo);
  const sinceISO = since.toISOString().split('T')[0]; // YYYY-MM-DD

  const results = await client.queryDatabase({
    database_id: frDatabaseId,
    filter: {
      and: [
        {
          property: 'Product',
          select: { equals: productSelectValue },
        },
        {
          property: 'Date',
          date: { on_or_after: sinceISO },
        },
      ],
    },
  });

  return results.map(mapPageToFeatureRequest);
}

function mapPageToFeatureRequest(page: any): FeatureRequest {
  return {
    id: page.id,
    url: page.url ?? '',
    title: extractTitle(page, 'Feature Request'),
    content: extractRichText(page, 'Description'),
    existingPulseRelationIds: extractRelationIds(page, 'Product Pulse'),
    existingIdeaRelationIds: extractRelationIds(page, 'Ideas Database'),
  };
}

/**
 * Query active Pulse items for a product.
 * Filters: Status != statusNotEquals AND Products relation contains productPageId
 * Fetches full page content for each pulse item.
 */
export async function queryPulseItems(
  client: NotionClientWrapper,
  pulseDatabaseId: string,
  productPageId: string,
  statusNotEquals: string,
): Promise<PulseItem[]> {
  const results = await client.queryDatabase({
    database_id: pulseDatabaseId,
    filter: {
      and: [
        {
          property: 'Status',
          status: { does_not_equal: statusNotEquals },
        },
        {
          property: 'Products',
          relation: { contains: productPageId },
        },
      ],
    },
  });

  const items: PulseItem[] = [];

  // Cap content at 2000 chars per Pulse item. Most are short problem/
  // opportunity statements, but a few outliers could be large.
  const MAX_CONTENT_LENGTH = 2000;

  for (const page of results) {
    const title = extractTitle(page, 'Problem or Opportunity').replace(/"/g, "'");
    const rawContent = await getPageContent(client, page.id);
    const content = rawContent.length > MAX_CONTENT_LENGTH
      ? rawContent.slice(0, MAX_CONTENT_LENGTH) + '...'
      : rawContent;
    items.push({
      id: page.id,
      title,
      content,
    });
  }

  return items;
}

/**
 * Query active Idea items for a product (titles and IDs only).
 * Filters: Products relation contains productPageId AND status not in statusNotEquals
 */
export async function queryIdeaTitles(
  client: NotionClientWrapper,
  ideasDatabaseId: string,
  productPageId: string,
  statusNotEquals: string[],
): Promise<IdeaTitle[]> {
  const statusFilters = statusNotEquals.map((status) => ({
    property: 'Idea Status',
    status: { does_not_equal: status },
  }));

  const results = await client.queryDatabase({
    database_id: ideasDatabaseId,
    filter: {
      and: [
        {
          property: 'Products',
          relation: { contains: productPageId },
        },
        ...statusFilters,
      ],
    },
  });

  return results.map((page: any) => ({
    id: page.id,
    // Replace double quotes with single quotes in titles to prevent
    // JSON escaping issues when the LLM echoes titles in its response.
    title: extractTitle(page, 'Name').replace(/"/g, "'"),
  }));
}

// --- Helper functions ---

function extractTitle(page: any, propertyName: string): string {
  const prop = page.properties?.[propertyName];
  if (!prop) return '';

  if (prop.type === 'title' && Array.isArray(prop.title)) {
    return richTextToPlainText(prop.title);
  }
  return '';
}

function extractRichText(page: any, propertyName: string): string {
  const prop = page.properties?.[propertyName];
  if (!prop) return '';

  if (prop.type === 'rich_text' && Array.isArray(prop.rich_text)) {
    return richTextToPlainText(prop.rich_text);
  }
  return '';
}

function extractRelationIds(page: any, propertyName: string): string[] {
  const prop = page.properties?.[propertyName];
  if (!prop || prop.type !== 'relation' || !Array.isArray(prop.relation)) {
    return [];
  }
  return prop.relation.map((r: any) => r.id).filter(Boolean);
}
