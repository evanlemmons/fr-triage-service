export interface ProductConfig {
  product: {
    name: string;
    selectValue: string;
    productPageId: string;
    enabled?: boolean; // Whether this product is enabled for triage (defaults to true)
  };
  productInfo: {
    pageId: string;
    description?: string; // Embedded product description (preferred over fetching page content)
  };
  matching: {
    pulse: PulseMatchingConfig;
    ideas: IdeasMatchingConfig;
    batchSize?: number;
  };
  audit: {
    databaseId: string;
  };
  llm: {
    model?: string;
    prompts: {
      productAlignment: PromptConfig;
      pulseMatching: PromptConfig;
      ideaShortlist: PromptConfig;
      ideaMatching: PromptConfig;
      summary?: PromptConfig;
    };
  };
  notifications: {
    slack: SlackNotificationConfig;
  };
  schedule?: {
    cron: string;
  };
}

export interface PulseMatchingConfig {
  enabled: boolean;
  databaseId: string;
  filters: {
    statusNotEquals: string;
  };
  fetchContent: boolean;
  confidenceThreshold: number;
}

export interface IdeasMatchingConfig {
  enabled: boolean;
  databaseId: string;
  filters: {
    statusNotEquals: string[];
  };
  twoPhaseMatching: boolean;
  shortlistMax: number;
  confidenceThreshold: number;
}

export interface PromptConfig {
  systemPrompt: string;
}

export interface SlackNotificationConfig {
  enabled: boolean;
  noFrsChannelId?: string;
  summaryTarget: {
    type: 'user' | 'channel';
    id: string;
  };
  errorTarget?: {
    type: 'user' | 'channel';
    id: string;
  };
}
