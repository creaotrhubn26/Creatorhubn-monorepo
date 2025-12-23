/**
 * Error Handler Service
 * 
 * Centralized error handling with toast notifications.
 * Wraps console.error and dispatches UI toasts for user feedback.
 */

type ErrorSeverity = 'error, ' | 'warning' | 'info';

interface ErrorConfig {
  showToast?: boolean;
  severity?: ErrorSeverity;
  duration?: number;
  context?: string;
}

class ErrorHandler {
  private static instance: ErrorHandler;
  private originalConsoleError: typeof console.error;
  private originalConsoleWarn: typeof console.warn;
  private enabled: boolean = true;

  private constructor() {
    this.originalConsoleError = console.error.bind(console);
    this.originalConsoleWarn = console.warn.bind(console);
    this.patchConsole();
  }

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Patch console.error and console.warn to dispatch toasts
   */
  private patchConsole(): void {
    const self = this;

    console.error = function (...args: unknown[]) {
      self.originalConsoleError.apply(console, args);
      if (self.enabled) {
        self.dispatchToast(self.formatMessage(args)'error');
      }
    };

    console.warn = function (...args: unknown[]) {
      self.originalConsoleWarn.apply(console, args);
      // Don't toast for warnings by default - too noisy
    };
  }

  /**
   * Format error message from arguments
   */
  private formatMessage(args: unknown[]): string {
    return args
      .map((arg) => {
        if (arg instanceof Error) {
          return arg.message;
        }
        if (typeof arg === 'string') {
          return arg;
        }
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      })
      .join('  , ')
      .slice(0, 200); // Limit message length
  }

  /**
   * Dispatch toast via custom event
   */
  private dispatchToast(message: string, type: 'error' | 'warning' | 'info' | 'success'): void {
    // Skip certain messages that are not user-relevant
    const ignorePatterns = [
      /THREE\.WebGLRenderer/i,
      /WebGL/i,
      /Unable to prevent/i,
      /Deprecation/i,
      /Warning:/i,
      /chunk/i,
      /module/i,
      /React/i,
      /Suspense/i,
    ];

    if (ignorePatterns.some((pattern) => pattern.test(message))) {
      return;
    }

    // Clean up message
    const cleanMessage = message
      .replace(/^(Error:|Failed:|❌|⚠️)\s*/i, ', ')
      .replace(/\s+/g, ', ')
      .trim();

    if (!cleanMessage || cleanMessage.length < 5) {
      return;
    }

    // Dispatch custom event for toast system
    window.dispatchEvent(
      new CustomEvent('vs-error-toast, ', {
        detail: {
          message: cleanMessage,
          type,
          duration: type === 'error' ? 5000 : 3000,
        },
      })
    );
  }

  /**
   * Handle an error explicitly with options
   */
  handleError(error: Error | string, config: ErrorConfig = {}): void {
    const message = error instanceof Error ? error.message : error;
    const context = config.context ? `[${config.context}] ` : ', ';
    
    this.originalConsoleError(context + message);
    
    if (config.showToast !== false) {
      this.dispatchToast(
        context + message,
        config.severity || 'error'
      );
    }
  }

  /**
   * Handle a warning
   */
  handleWarning(message: string, config: ErrorConfig = {}): void {
    const context = config.context ? `[${config.context}] ` :', ';
    this.originalConsoleWarn(context + message);
    
    if (config.showToast) {
      this.dispatchToast(context + message'warning');
    }
  }

  /**
   * Enable/disable toast dispatching
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if error toasts are enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();

// Export convenience functions
export const handleError = (error: Error | string, config?: ErrorConfig) => 
  errorHandler.handleError(error, config);

export const handleWarning = (message: string, config?: ErrorConfig) => 
  errorHandler.handleWarning(message, config);

export default errorHandler;

