/**
 * Virtual Studio Logger
 *
 * Centralized logging with runtime-configurable levels.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';

interface LoggerConfig {
  level: LogLevel;
  prefix: string;
  enableTimestamp: boolean;
  enableColors: boolean;
  persistLogs: boolean;
  maxStoredLogs: number;
}

interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  module: string;
  message: string;
  data?: unknown;
}

declare global {
  interface Window {
    __VS_LOGGER__?: {
      logger: VirtualStudioLogger;
      setLevel: (level: LogLevel) => void;
      getLogs: () => LogEntry[];
      exportLogs: () => string;
    };
  }
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  none: 4,
};

const LOG_COLORS: Record<Exclude<LogLevel, 'none'>, string> = {
  debug: '#888888',
  info: '#4CAF50',
  warn: '#FF9800',
  error: '#F44336',
};

const CONSOLE_METHODS: Record<Exclude<LogLevel, 'none'>, 'log' | 'info' | 'warn' | 'error'> = {
  debug: 'log',
  info: 'info',
  warn: 'warn',
  error: 'error',
};

export class VirtualStudioLogger {
  private config: LoggerConfig;
  private storedLogs: LogEntry[] = [];
  private modules = new Map<string, VirtualStudioLogger>();

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: this.getDefaultLevel(),
      prefix: 'VS',
      enableTimestamp: true,
      enableColors: true,
      persistLogs: false,
      maxStoredLogs: 1000,
      ...config,
    };
  }

  private getDefaultLevel(): LogLevel {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'debug';
      }
    }

    return 'warn';
  }

  setLevel(level: LogLevel): void {
    this.config.level = level;
    for (const moduleLogger of this.modules.values()) {
      moduleLogger.setLevel(level);
    }
  }

  module(name: string): VirtualStudioLogger {
    const existingLogger = this.modules.get(name);
    if (existingLogger) {
      return existingLogger;
    }

    const moduleLogger = new VirtualStudioLogger({
      ...this.config,
      prefix: `${this.config.prefix}:${name}`,
    });

    this.modules.set(name, moduleLogger);
    return moduleLogger;
  }

  debug(message: string, data?: unknown): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: unknown): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: unknown): void {
    this.log('error', message, data);
  }

  group(label: string): void {
    if (this.shouldLog('debug')) {
      console.group(`[${this.config.prefix}] ${label}`);
    }
  }

  groupEnd(): void {
    if (this.shouldLog('debug')) {
      console.groupEnd();
    }
  }

  time(label: string): void {
    if (this.shouldLog('debug')) {
      console.time(`[${this.config.prefix}] ${label}`);
    }
  }

  timeEnd(label: string): void {
    if (this.shouldLog('debug')) {
      console.timeEnd(`[${this.config.prefix}] ${label}`);
    }
  }

  table(data: unknown): void {
    if (this.shouldLog('debug')) {
      console.table(data);
    }
  }

  getLogs(): LogEntry[] {
    return [...this.storedLogs];
  }

  clearLogs(): void {
    this.storedLogs = [];
  }

  exportLogs(): string {
    return JSON.stringify(this.storedLogs, null, 2);
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level];
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    if (level === 'none' || !this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      module: this.config.prefix,
      message,
      data,
    };

    if (this.config.persistLogs) {
      this.storedLogs.push(entry);
      if (this.storedLogs.length > this.config.maxStoredLogs) {
        this.storedLogs.shift();
      }
    }

    const timestamp = this.config.enableTimestamp
      ? `[${entry.timestamp.toISOString().split('T')[1]?.slice(0, 8) ?? '00:00:00'}]`
      : '';
    const prefix = `[${this.config.prefix}]`;
    const formattedMessage = [timestamp, prefix, message].filter(Boolean).join(' ');
    const consoleMethod = CONSOLE_METHODS[level];

    if (this.config.enableColors && typeof window !== 'undefined') {
      const color = LOG_COLORS[level];
      if (data !== undefined) {
        console[consoleMethod](`%c${formattedMessage}`, `color: ${color}`, data);
      } else {
        console[consoleMethod](`%c${formattedMessage}`, `color: ${color}`);
      }
      return;
    }

    if (data !== undefined) {
      console[consoleMethod](formattedMessage, data);
    } else {
      console[consoleMethod](formattedMessage);
    }
  }
}

export const logger = new VirtualStudioLogger();

export const loggers = {
  scene: logger.module('Scene'),
  animation: logger.module('Animation'),
  render: logger.module('Render'),
  asset: logger.module('Asset'),
  hdri: logger.module('HDRI'),
  classPhoto: logger.module('ClassPhoto'),
  storyboard: logger.module('Storyboard'),
  export: logger.module('Export'),
  api: logger.module('API'),
  event: logger.module('Event'),
  error: logger.module('Error'),
};

if (typeof window !== 'undefined') {
  window.__VS_LOGGER__ = {
    logger,
    setLevel: (level: LogLevel) => logger.setLevel(level),
    getLogs: () => logger.getLogs(),
    exportLogs: () => logger.exportLogs(),
  };
}

export default logger;
