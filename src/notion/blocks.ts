import type { NotionClientWrapper } from './client.js';

/**
 * Extract plain text from a Notion rich_text array.
 */
export function richTextToPlainText(richText: any[]): string {
  if (!Array.isArray(richText)) return '';
  return richText.map((rt: any) => rt.plain_text ?? '').join('');
}

/**
 * Convert a single Notion block to plain text.
 */
function blockToText(block: any): string {
  const type = block.type;
  if (!type || !block[type]) return '';

  const data = block[type];

  switch (type) {
    case 'paragraph':
      return richTextToPlainText(data.rich_text);
    case 'heading_1':
      return `# ${richTextToPlainText(data.rich_text)}`;
    case 'heading_2':
      return `## ${richTextToPlainText(data.rich_text)}`;
    case 'heading_3':
      return `### ${richTextToPlainText(data.rich_text)}`;
    case 'bulleted_list_item':
      return `- ${richTextToPlainText(data.rich_text)}`;
    case 'numbered_list_item':
      return `1. ${richTextToPlainText(data.rich_text)}`;
    case 'to_do': {
      const check = data.checked ? '[x]' : '[ ]';
      return `${check} ${richTextToPlainText(data.rich_text)}`;
    }
    case 'toggle':
      return richTextToPlainText(data.rich_text);
    case 'callout':
      return richTextToPlainText(data.rich_text);
    case 'quote':
      return `> ${richTextToPlainText(data.rich_text)}`;
    case 'code':
      return richTextToPlainText(data.rich_text);
    case 'divider':
      return '---';
    default:
      // Unsupported block types are skipped
      return '';
  }
}

/**
 * Recursively fetch all blocks (including children) for a page/block
 * and convert them to a single plain-text string.
 */
export async function getPageContent(
  client: NotionClientWrapper,
  pageId: string,
): Promise<string> {
  const blocks = await getAllBlocksRecursive(client, pageId);
  return blocks
    .map(blockToText)
    .filter((text) => text.length > 0)
    .join('\n\n');
}

/**
 * Recursively fetch all block children, following nested blocks.
 */
async function getAllBlocksRecursive(
  client: NotionClientWrapper,
  blockId: string,
): Promise<any[]> {
  const blocks = await client.getBlockChildren(blockId);
  const result: any[] = [];

  for (const block of blocks) {
    result.push(block);
    if (block.has_children) {
      const children = await getAllBlocksRecursive(client, block.id);
      result.push(...children);
    }
  }

  return result;
}
