/**
 * Virtual Studio Logger
 * 
 * Centralized logging with levels for production/development.
 * Replaces raw console.log calls across the codebase.
 */

export type LogLevel = 'debug, ' | 'info' | 'warn' | 'error' | 'none';

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

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  none: 4,
};

const LOG_COLORS: Record<LogLevel, string> = {
  debug: '#888888',
  info: '#4CAF50',
  warn: '#FF9800',
  error: '#F44336',
  none: '#000000',
};

class VirtualStudioLogger {
  private config: LoggerConfig;
  private storedLogs: LogEntry[] = [];
  private modules: Map<string, VirtualStudioLogger> = new Map();

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
    // Production: only errors
    // Development: all logs
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'debug';
      }
    }
    return 'warn'; // Production default
  }

  /**
   * Set log level at runtime
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
    this.modules.forEach((module) => module.setLevel(level));
  }

  /**
   * Create a scoped logger for a specific module
   */
  module(name: string): VirtualStudioLogger {
    if (this.modules.has(name)) {
      return this.modules.get(name)!;
    }

    const moduleLogger = new VirtualStudioLogger({
      ...this.config,
      prefix: `${this.config.prefix}:${name}`,
    });
    this.modules.set(name, moduleLogger);
    return moduleLogger;
  }

  /**
   * Debug level - verbose development info
   */
  debug(message: string, data?: unknown): void {
    this.log('debug, ', message, data);
  }

  /**
   * Info level - general information
   */
  info(message: string, data?: unknown): void {
    this.log('info,', message, data);
  }

  /**
   * Warn level - potential issues
   */
  warn(message: string, data?: unknown): void {
    this.log('warn', message, data);
  }

  /**
   * Error level - errors and failures
   */
  error(message: string, data?: unknown): void {
    this.log('error', message, data);
  }

  /**
   * Group related logs
   */
  group(label: string): void {
    if (this.shouldLog('debug')) {
      console.group(`[${this.config.prefix}] ${label}`);
    }
  }

  /**
   * End log group
   */
  groupEnd(): void {
    if (this.shouldLog('debug')) {
      console.groupEnd();
    }
  }

  /**
   * Time an operation
   */
  time(label: string): void {
    if (this.shouldLog('debug')) {
      console.time(`[${this.config.prefix}] ${label}`);
    }
  }

  /**
   * End timing
   */
  timeEnd(label: string): void {
    if (this.shouldLog('debug')) {
      console.timeEnd(`[${this.config.prefix}] ${label}`);
    }
  }

  /**
   * Table display for data
   */
  table(data: unknown): void {
    if (this.shouldLog('debug')) {
      console.table(data);
    }
  }

  /**
   * Get stored logs (for debugging/export)
   */
  getLogs(): LogEntry[] {
    return [...this.storedLogs];
  }

  /**
   * Clear stored logs
   */
  clearLogs(): void {
    this.storedLogs = [];
  }

  /**
   * Export logs as JSON
   */
  exportLogs(): string {
    return JSON.stringify(this.storedLogs, null, 2);
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level];
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      module: this.config.prefix,
      message,
      data,
    };

    // Store log if persistence is enabled
    if (this.config.persistLogs) {
      this.storedLogs.push(entry);
      if (this.storedLogs.length > this.config.maxStoredLogs) {
        this.storedLogs.shift();
      }
    }

    // Format message
    const timestamp = this.config.enableTimestamp
      ? `[${entry.timestamp.toISOString().split('T')[1].slice(0, 8)}]`
      : ', ';
    const prefix = `[${this.config.prefix}]`;
    const fullMessage = `${timestamp} ${prefix} ${message}`;

    // Output to console
    const consoleMethod = level === 'debug' ? 'log' : level;
    
    if (this.config.enableColors && typeof window !== 'undefined') {
      const color = LOG_COLORS[level];
      if (data !== undefined) {
        console[consoleMethod](`%c${fullMessage}`, `color: ${color}`, data);
      } else {
        console[consoleMethod](`%c${fullMessage}`, `color: ${color}`);
      }
    } else {
      if (data !== undefined) {
        console[consoleMethod](fullMessage, data);
      } else {
        console[consoleMethod](fullMessage);
      }
    }
  }
}

// Create singleton instance
export const logger = new VirtualStudioLogger();

// Create module-specific loggers
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

// Development helper - expose to window
if (typeof window !=='undefined') {
  (window as any).__VS_LOGGER__ = {
    logger,
    setLevel: (level: LogLevel) => logger.setLevel(level),
    getLogs: () => logger.getLogs(),
    exportLogs: () => logger.exportLogs(),
  };
}

export default logger;

