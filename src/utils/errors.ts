export class TriageError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'TriageError';
  }
}

export class ConfigError extends TriageError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CONFIG_ERROR', context);
    this.name = 'ConfigError';
  }
}

export class NotionError extends TriageError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'NOTION_ERROR', context);
    this.name = 'NotionError';
  }
}

export class LLMError extends TriageError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'LLM_ERROR', context);
    this.name = 'LLMError';
  }
}
