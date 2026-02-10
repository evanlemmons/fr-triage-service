import { z } from 'zod';

/**
 * Schema for the product alignment LLM response.
 * Determines if a feature request belongs to this product.
 */
export const productAlignmentSchema = z.object({
  verdict: z.string(),
  confidence: z.number().min(0).max(1),
  suggested_product: z.string(),
  reason: z.string(),
});

/**
 * Schema for the pulse matching LLM response.
 * Matches a feature request to existing Pulse items.
 */
export const pulseMatchingSchema = z.object({
  matches: z.array(
    z.object({
      pulse_id: z.string(),
      confidence: z.number().min(0).max(1),
      reason: z.string(),
    }),
  ),
  notes: z.string(),
});

/**
 * Schema for the idea shortlisting LLM response.
 * Title-only pass that narrows ideas to candidates.
 */
export const ideaShortlistSchema = z.object({
  candidate_ideas: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      why: z.string(),
    }),
  ),
  notes: z.string(),
});

/**
 * Schema for the idea matching LLM response.
 * Full-content pass that confirms idea matches.
 */
export const ideaMatchingSchema = z.object({
  matched_ideas: z.array(
    z.object({
      idea_page_id: z.string(),
      confidence: z.number().min(0).max(1),
      reasoning: z.string(),
    }),
  ),
  notes: z.string(),
});
