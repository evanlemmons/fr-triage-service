export interface Logger {
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
  debug(message: string, data?: Record<string, unknown>): void;
}

export function createLogger(verbose: boolean): Logger {
  const format = (level: string, message: string, data?: Record<string, unknown>): string => {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${level}] ${message}${dataStr}`;
  };

  return {
    info(message, data) {
      console.log(format('INFO', message, data));
    },
    warn(message, data) {
      // GitHub Actions annotation format
      console.log(`::warning::${message}`);
      console.log(format('WARN', message, data));
    },
    error(message, data) {
      console.log(`::error::${message}`);
      console.error(format('ERROR', message, data));
    },
    debug(message, data) {
      if (verbose) {
        console.log(format('DEBUG', message, data));
      }
    },
  };
}
