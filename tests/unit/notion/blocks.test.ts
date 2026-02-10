import { describe, it, expect } from 'vitest';
import { richTextToPlainText } from '../../../src/notion/blocks.js';

describe('richTextToPlainText', () => {
  it('extracts plain text from rich text array', () => {
    const richText = [
      { plain_text: 'Hello ' },
      { plain_text: 'world' },
    ];
    expect(richTextToPlainText(richText)).toBe('Hello world');
  });

  it('handles empty array', () => {
    expect(richTextToPlainText([])).toBe('');
  });

  it('handles non-array input', () => {
    expect(richTextToPlainText(null as any)).toBe('');
    expect(richTextToPlainText(undefined as any)).toBe('');
  });

  it('handles items without plain_text', () => {
    const richText = [
      { plain_text: 'Hello' },
      { type: 'text' }, // missing plain_text
    ];
    expect(richTextToPlainText(richText)).toBe('Hello');
  });

  it('handles bold/italic annotations (extracts plain text only)', () => {
    const richText = [
      {
        type: 'text',
        text: { content: 'bold text' },
        annotations: { bold: true },
        plain_text: 'bold text',
      },
    ];
    expect(richTextToPlainText(richText)).toBe('bold text');
  });
});
