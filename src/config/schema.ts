import { z } from 'zod';

const notionIdSchema = z.string().regex(
  /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i,
  'Must be a valid Notion UUID (with or without hyphens)',
);

const promptConfigSchema = z.object({
  systemPrompt: z.string().min(50, 'System prompt must be at least 50 characters'),
});

const pulseConfigSchema = z.object({
  enabled: z.boolean().default(true),
  databaseId: notionIdSchema,
  filters: z.object({
    statusNotEquals: z.string(),
  }),
  fetchContent: z.boolean().default(true),
  confidenceThreshold: z.number().min(0).max(1).default(0.75),
});

const ideasConfigSchema = z.object({
  enabled: z.boolean().default(true),
  databaseId: notionIdSchema,
  filters: z.object({
    statusNotEquals: z.array(z.string()).min(1),
  }),
  twoPhaseMatching: z.boolean().default(true),
  shortlistMax: z.number().int().min(1).max(50).default(20),
  confidenceThreshold: z.number().min(0).max(1).default(0.75),
});

const slackConfigSchema = z.object({
  enabled: z.boolean().default(true),
  noFrsChannelId: z.string().optional(),
  summaryTarget: z.object({
    type: z.enum(['user', 'channel']),
    id: z.string().min(1),
  }),
});

export const productConfigSchema = z.object({
  product: z.object({
    name: z.string().min(1),
    selectValue: z.string().min(1),
    productPageId: notionIdSchema,
  }),
  productInfo: z.object({
    pageId: notionIdSchema,
  }),
  matching: z.object({
    pulse: pulseConfigSchema,
    ideas: ideasConfigSchema,
  }),
  audit: z.object({
    databaseId: notionIdSchema,
  }),
  llm: z.object({
    model: z.string().optional(),
    prompts: z.object({
      productAlignment: promptConfigSchema,
      pulseMatching: promptConfigSchema,
      ideaShortlist: promptConfigSchema,
      ideaMatching: promptConfigSchema,
      summary: promptConfigSchema.optional(),
    }),
  }),
  notifications: z.object({
    slack: slackConfigSchema,
  }),
  schedule: z.object({
    cron: z.string(),
  }).optional(),
});

export type ProductConfigInput = z.input<typeof productConfigSchema>;
