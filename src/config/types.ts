export interface ProductConfig {
  product: {
    name: string;
    selectValue: string;
    productPageId: string;
  };
  productInfo: {
    pageId: string;
  };
  matching: {
    pulse: PulseMatchingConfig;
    ideas: IdeasMatchingConfig;
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
}
