import { describe, it, expect } from 'vitest';
import {
  productAlignmentSchema,
  pulseMatchingSchema,
  ideaShortlistSchema,
  ideaMatchingSchema,
} from '../../../src/llm/schemas.js';

describe('productAlignmentSchema', () => {
  it('accepts valid alignment response', () => {
    const result = productAlignmentSchema.safeParse({
      verdict: 'home',
      confidence: 0.92,
      suggested_product: '',
      reason: 'The request is about dashboards',
    });
    expect(result.success).toBe(true);
  });

  it('accepts not_home verdict', () => {
    const result = productAlignmentSchema.safeParse({
      verdict: 'not_home',
      confidence: 0.85,
      suggested_product: 'Check-Ins',
      reason: 'This is about check-in kiosks',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing fields', () => {
    const result = productAlignmentSchema.safeParse({
      verdict: 'home',
    });
    expect(result.success).toBe(false);
  });

  it('rejects confidence out of range', () => {
    const result = productAlignmentSchema.safeParse({
      verdict: 'home',
      confidence: 1.5,
      suggested_product: '',
      reason: 'test',
    });
    expect(result.success).toBe(false);
  });
});

describe('pulseMatchingSchema', () => {
  it('accepts valid pulse matching response', () => {
    const result = pulseMatchingSchema.safeParse({
      matches: [
        { pulse_id: 'abc-123', confidence: 0.9, reason: 'Strong match' },
      ],
      notes: '',
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty matches array', () => {
    const result = pulseMatchingSchema.safeParse({
      matches: [],
      notes: 'No matches found',
    });
    expect(result.success).toBe(true);
  });
});

describe('ideaShortlistSchema', () => {
  it('accepts valid shortlist response', () => {
    const result = ideaShortlistSchema.safeParse({
      candidate_ideas: [
        { id: 'idea-1', title: 'Task Templates', why: 'FR mentions templates' },
      ],
      notes: '',
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty candidates', () => {
    const result = ideaShortlistSchema.safeParse({
      candidate_ideas: [],
      notes: 'Nothing related',
    });
    expect(result.success).toBe(true);
  });
});

describe('ideaMatchingSchema', () => {
  it('accepts valid idea matching response', () => {
    const result = ideaMatchingSchema.safeParse({
      matched_ideas: [
        { idea_page_id: 'idea-1', confidence: 0.88, reasoning: 'Direct match' },
      ],
      notes: '',
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty matched_ideas', () => {
    const result = ideaMatchingSchema.safeParse({
      matched_ideas: [],
      notes: 'No matches met threshold',
    });
    expect(result.success).toBe(true);
  });
});
