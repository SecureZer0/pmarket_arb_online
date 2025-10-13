const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
} as const;

export class Logger {
  private prefix: string;

  constructor(prefix = '') {
    this.prefix = prefix;
  }

  private formatMessage(level: string, message: string, color: string): string {
    const timestamp = new Date().toISOString();
    const prefix = this.prefix ? `[${this.prefix}]` : '';
    return `${color}[${timestamp}] ${level}${prefix} ${message}${colors.reset}`;
  }

  info(message: string, data?: unknown): void {
    const formattedMessage = this.formatMessage('INFO', message, colors.blue);
    console.log(formattedMessage);
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
  }

  success(message: string, data?: unknown): void {
    const formattedMessage = this.formatMessage('SUCCESS', message, colors.green);
    console.log(formattedMessage);
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
  }

  warn(message: string, data?: unknown): void {
    const formattedMessage = this.formatMessage('WARN', message, colors.yellow);
    console.warn(formattedMessage);
    if (data) {
      console.warn(JSON.stringify(data, null, 2));
    }
  }

  error(message: string, error?: Error | unknown): void {
    const formattedMessage = this.formatMessage('ERROR', message, colors.red);
    console.error(formattedMessage);
    if (error) {
      if (error instanceof Error) {
        console.error(error.stack || error);
      } else {
        console.error(error);
      }
    }
  }

  debug(message: string, data?: unknown): void {
    if (process.env.NODE_ENV === 'development') {
      const formattedMessage = this.formatMessage('DEBUG', message, colors.cyan);
      console.log(formattedMessage);
      if (data) {
        console.log(JSON.stringify(data, null, 2));
      }
    }
  }

  websocket(message: string, data?: unknown): void {
    const formattedMessage = this.formatMessage('WS', message, colors.magenta);
    console.log(formattedMessage);
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
  }
}

// Create default logger instance
export const logger = new Logger();

// Create specialized loggers
export const wsLogger = new Logger('WebSocket');
export const marketLogger = new Logger('Market');
