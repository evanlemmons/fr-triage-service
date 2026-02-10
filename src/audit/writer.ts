import type { AlignmentResult } from '../llm/types.js';
import type { ValidatedMatch } from '../pipeline/types.js';

/**
 * Build the FR header block: "FR #N [page mention]"
 */
export function buildFRHeaderBlocks(frIndex: number, frPageId: string): any[] {
  return [
    {
      object: 'block',
      type: 'heading_1',
      heading_1: {
        rich_text: [
          { type: 'text', text: { content: `FR #${frIndex + 1} ` } },
          {
            type: 'mention',
            mention: { type: 'page', page: { id: frPageId } },
          },
        ],
      },
    },
  ];
}

/**
 * Build the product alignment audit section.
 */
export function buildAlignmentAuditBlocks(result: AlignmentResult): any[] {
  const verdict = result.verdict.charAt(0).toUpperCase() + result.verdict.slice(1);
  const confidenceStr = `${Math.round(result.confidence * 100)}%`;
  const suggestedProduct = result.suggested_product?.trim() || 'N/A';

  return [
    {
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: [{ type: 'text', text: { content: 'Product alignment' } }],
      },
    },
    {
      object: 'block',
      type: 'bulleted_list_item',
      bulleted_list_item: {
        rich_text: [
          { type: 'text', text: { content: 'Verdict: ' }, annotations: { bold: true } },
          { type: 'text', text: { content: verdict } },
        ],
      },
    },
    {
      object: 'block',
      type: 'bulleted_list_item',
      bulleted_list_item: {
        rich_text: [
          { type: 'text', text: { content: 'Confidence: ' }, annotations: { bold: true } },
          { type: 'text', text: { content: confidenceStr }, annotations: { code: true } },
        ],
      },
    },
    {
      object: 'block',
      type: 'bulleted_list_item',
      bulleted_list_item: {
        rich_text: [
          { type: 'text', text: { content: 'Suggested product: ' }, annotations: { bold: true } },
          { type: 'text', text: { content: suggestedProduct } },
        ],
      },
    },
    {
      object: 'block',
      type: 'bulleted_list_item',
      bulleted_list_item: {
        rich_text: [
          { type: 'text', text: { content: 'Reasoning: ' }, annotations: { bold: true } },
          { type: 'text', text: { content: result.reason } },
        ],
      },
    },
  ];
}

/**
 * Build the pulse header block.
 */
export function buildPulseHeaderBlock(): any[] {
  return [
    {
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: [{ type: 'text', text: { content: '🩺 Pulse matches' } }],
      },
    },
  ];
}

/**
 * Build audit blocks for a single pulse match.
 */
export function buildPulseMatchAuditBlocks(match: ValidatedMatch): any[] {
  const confidenceStr = `${Math.round(match.confidence * 100)}%`;

  return [
    {
      object: 'block',
      type: 'heading_3',
      heading_3: {
        rich_text: [
          {
            type: 'mention',
            mention: { type: 'page', page: { id: match.id } },
          },
        ],
      },
    },
    {
      object: 'block',
      type: 'bulleted_list_item',
      bulleted_list_item: {
        rich_text: [
          { type: 'text', text: { content: 'Confidence: ' }, annotations: { bold: true } },
          { type: 'text', text: { content: confidenceStr }, annotations: { code: true } },
        ],
      },
    },
    {
      object: 'block',
      type: 'bulleted_list_item',
      bulleted_list_item: {
        rich_text: [
          { type: 'text', text: { content: 'Reasoning: ' }, annotations: { bold: true } },
          { type: 'text', text: { content: match.reason } },
        ],
      },
    },
  ];
}

/**
 * Build warning block for no pulse matches.
 */
export function buildNoPulseMatchWarning(): any[] {
  return [
    {
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          {
            type: 'text',
            text: { content: '⚠️ There are no pulse items matched with this FR! You should probably look into this ' },
            annotations: { bold: true, color: 'orange' },
          },
        ],
      },
    },
  ];
}

/**
 * Build the idea header block.
 */
export function buildIdeaHeaderBlock(): any[] {
  return [
    {
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: [{ type: 'text', text: { content: '💡 Idea matches' } }],
      },
    },
  ];
}

/**
 * Build audit blocks for a single idea match.
 */
export function buildIdeaMatchAuditBlocks(match: ValidatedMatch): any[] {
  const confidenceStr = `${Math.round(match.confidence * 100)}%`;

  return [
    {
      object: 'block',
      type: 'heading_3',
      heading_3: {
        rich_text: [
          {
            type: 'mention',
            mention: { type: 'page', page: { id: match.id } },
          },
        ],
      },
    },
    {
      object: 'block',
      type: 'bulleted_list_item',
      bulleted_list_item: {
        rich_text: [
          { type: 'text', text: { content: 'Confidence: ' }, annotations: { bold: true } },
          { type: 'text', text: { content: confidenceStr }, annotations: { code: true } },
        ],
      },
    },
    {
      object: 'block',
      type: 'bulleted_list_item',
      bulleted_list_item: {
        rich_text: [
          { type: 'text', text: { content: 'Reasoning: ' }, annotations: { bold: true } },
          { type: 'text', text: { content: match.reason } },
        ],
      },
    },
  ];
}

/**
 * Build warning block for no idea matches.
 */
export function buildNoIdeaMatchWarning(): any[] {
  return [
    {
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          {
            type: 'text',
            text: { content: '⚠️ There are no ideas supporting this FR! You should look into this!' },
            annotations: { bold: true, color: 'orange' },
          },
        ],
      },
    },
  ];
}

/**
 * Build the completed timestamp block.
 */
export function buildCompletedBlock(): any[] {
  const now = new Date();
  const formatted = now.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return [
    {
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          {
            type: 'text',
            text: { content: `Completed ${formatted}` },
            annotations: { color: 'gray' },
          },
        ],
      },
    },
  ];
}
