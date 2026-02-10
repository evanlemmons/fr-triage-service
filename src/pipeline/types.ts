import type { ProductConfig } from '../config/types.js';
import type { FeatureRequest, PulseItem, IdeaTitle } from '../notion/types.js';
import type { AlignmentResult } from '../llm/types.js';
import type { Logger } from '../utils/logger.js';

export interface PipelineConfig {
  product: ProductConfig;
  frDatabaseId: string;
  dryRun: boolean;
  verbose: boolean;
  /** Backtest mode: query recent FRs regardless of status instead of only unprocessed. Implies dryRun. */
  backtest: boolean;
  /** Number of days to look back in backtest mode. Default: 7 */
  backtestDays: number;
}

export interface PrepResult {
  featureRequests: FeatureRequest[];
  productInfo: string;
  pulseData: PulseItem[];
  ideaTitles: IdeaTitle[];
  auditPageId: string;
  auditPageUrl: string;
}

export interface ValidatedMatch {
  id: string;
  confidence: number;
  reason: string;
}

export interface FRProcessingResult {
  frId: string;
  frTitle: string;
  alignment: AlignmentResult;
  belongsToProduct: boolean;
  pulseMatches: ValidatedMatch[];
  ideaMatches: ValidatedMatch[];
  errors: string[];
}

export interface TriageResult {
  frCount: number;
  status: 'complete' | 'no_frs' | 'error';
  results?: FRProcessingResult[];
  error?: string;
}

export interface PipelineContext {
  config: PipelineConfig;
  logger: Logger;
}
