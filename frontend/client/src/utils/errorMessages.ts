/**
 * User-friendly error messages with contextual guidance and statistics.
 */

import React from 'react';

export interface ErrorContext {
  operation: string;
  component?: string;
  userId?: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';
export type ErrorCategory = 'network' | 'validation' | 'permission' | 'system' | 'user' | 'security';

export interface ErrorMessage {
  id: string;
  title: string;
  message: string;
  action: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  helpUrl?: string;
  retryable: boolean;
  autoRetry?: boolean;
  retryDelay?: number;
  retryAfter?: number;
  suggestions: string[];
  technicalDetails?: string;
}

export interface ErrorTemplate {
  pattern: RegExp;
  message: ErrorMessage;
  condition?: (error: unknown, context: ErrorContext) => boolean;
}

interface ErrorStatistics {
  totalErrors: number;
  errorsByCategory: Record<string, number>;
  errorsBySeverity: Record<string, number>;
  mostCommonErrors: Array<{ error: string; count: number }>;
  retryableErrors: number;
  autoRetryableErrors: number;
}

const isDevelopmentEnvironment = () => {
  if (typeof import.meta !== 'undefined' && import.meta.env?.MODE) {
    return import.meta.env.MODE === 'development';
  }

  return typeof process !== 'undefined' && process.env.NODE_ENV === 'development';
};

const createTemplate = (pattern: RegExp, message: ErrorMessage): ErrorTemplate => ({
  pattern,
  message,
});

class ErrorMessageManager {
  private templates: ErrorTemplate[] = [];
  private customMessages = new Map<string, ErrorMessage>();
  private contextHistory = new Map<string, ErrorContext[]>();

  constructor() {
    this.initializeDefaultTemplates();
  }

  private initializeDefaultTemplates(): void {
    this.templates = [
      createTemplate(/network error|fetch failed|connection refused/i, {
        id: 'network_error',
        title: 'Connection Problem',
        message: "We're having trouble connecting to our servers. This might be a temporary issue.",
        action: 'Please check your internet connection and try again.',
        severity: 'error',
        category: 'network',
        retryable: true,
        autoRetry: true,
        retryDelay: 3000,
        suggestions: [
          'Check your internet connection',
          'Try refreshing the page',
          'Wait a moment and try again',
          'Contact support if the problem persists',
        ],
        helpUrl: '/help/network-issues',
      }),
      createTemplate(/timeout|request timed out?/i, {
        id: 'timeout_error',
        title: 'Request Timed Out',
        message: 'The request is taking longer than expected to complete.',
        action: 'Please try again with a smaller file or simpler operation.',
        severity: 'warning',
        category: 'network',
        retryable: true,
        suggestions: [
          'Try with a smaller file',
          'Check your internet speed',
          'Try again in a few minutes',
          'Contact support if timeouts persist',
        ],
        helpUrl: '/help/timeout-issues',
      }),
      createTemplate(/validation failed|invalid input|required field/i, {
        id: 'validation_error',
        title: 'Invalid Input',
        message: 'Some of the information you entered is not valid.',
        action: 'Please check the highlighted fields and correct any errors.',
        severity: 'warning',
        category: 'validation',
        retryable: false,
        suggestions: [
          'Check all required fields are filled',
          'Verify email addresses are correct',
          'Ensure passwords meet requirements',
          'Check file formats are supported',
        ],
        helpUrl: '/help/validation-errors',
      }),
      createTemplate(/file too large|size limit exceeded/i, {
        id: 'file_size_error',
        title: 'File Too Large',
        message: "The file you're trying to upload is larger than the allowed limit.",
        action: 'Please compress the file or choose a smaller one.',
        severity: 'warning',
        category: 'validation',
        retryable: false,
        suggestions: [
          'Compress the file using an image editor',
          'Try a different file format',
          'Split large files into smaller parts',
          'Contact support for large file uploads',
        ],
        helpUrl: '/help/file-size-limits',
      }),
      createTemplate(/unauthorized|access denied|permission denied/i, {
        id: 'permission_error',
        title: 'Access Denied',
        message: "You don't have permission to perform this action.",
        action: 'Please contact your administrator or try logging in again.',
        severity: 'error',
        category: 'permission',
        retryable: false,
        suggestions: [
          "Check if you're logged in correctly",
          'Contact your administrator',
          'Try refreshing the page',
          'Log out and log back in',
        ],
        helpUrl: '/help/permissions',
      }),
      createTemplate(/forbidden|insufficient privileges/i, {
        id: 'forbidden_error',
        title: 'Action Not Allowed',
        message: 'This action is not allowed for your account type.',
        action: 'Please contact your administrator to upgrade your account.',
        severity: 'error',
        category: 'permission',
        retryable: false,
        suggestions: [
          'Contact your administrator',
          'Check your account permissions',
          'Upgrade your account plan',
          'Review the feature requirements',
        ],
        helpUrl: '/help/account-permissions',
      }),
      createTemplate(/internal server error|server error|\b500\b/i, {
        id: 'server_error',
        title: 'Server Error',
        message: "Something went wrong on our end. We're working to fix it.",
        action: 'Please try again in a few minutes.',
        severity: 'error',
        category: 'system',
        retryable: true,
        autoRetry: true,
        retryDelay: 5000,
        suggestions: [
          'Wait a few minutes and try again',
          'Check our status page for updates',
          'Contact support if the error persists',
          'Try a different browser or device',
        ],
        helpUrl: '/help/server-errors',
      }),
      createTemplate(/service unavailable|maintenance mode/i, {
        id: 'service_unavailable',
        title: 'Service Temporarily Unavailable',
        message: "We're performing maintenance to improve the service.",
        action: 'Please try again later.',
        severity: 'info',
        category: 'system',
        retryable: true,
        suggestions: [
          'Check our status page for updates',
          'Follow us on social media for announcements',
          'Try again in a few hours',
          'Contact support for urgent issues',
        ],
        helpUrl: '/help/maintenance',
      }),
      createTemplate(/not found|\b404\b|resource not found/i, {
        id: 'not_found_error',
        title: 'Page Not Found',
        message: "The page or resource you're looking for doesn't exist.",
        action: 'Please check the URL or navigate to a different page.',
        severity: 'warning',
        category: 'user',
        retryable: false,
        suggestions: [
          'Check the URL for typos',
          'Use the navigation menu',
          'Search for what you need',
          'Contact support if you think this is an error',
        ],
        helpUrl: '/help/navigation',
      }),
      createTemplate(/rate limit|too many requests|\b429\b/i, {
        id: 'rate_limit_error',
        title: 'Too Many Requests',
        message: "You're making requests too quickly. Please slow down.",
        action: 'Wait a moment before trying again.',
        severity: 'warning',
        category: 'user',
        retryable: true,
        retryDelay: 1000,
        retryAfter: 1000,
        suggestions: [
          'Wait a few seconds before trying again',
          'Avoid rapid clicking or refreshing',
          'Check if you have multiple tabs open',
          'Contact support if you need higher limits',
        ],
        helpUrl: '/help/rate-limits',
      }),
      createTemplate(/security|malware|virus detected/i, {
        id: 'security_error',
        title: 'Security Issue Detected',
        message: 'A potential security issue was detected with your file.',
        action: 'Please choose a different file or contact support.',
        severity: 'critical',
        category: 'security',
        retryable: false,
        suggestions: [
          'Choose a different file',
          'Scan your computer for malware',
          'Contact support for assistance',
          'Review our security guidelines',
        ],
        helpUrl: '/help/security',
      }),
      createTemplate(/suspicious|blocked|quarantine/i, {
        id: 'suspicious_content',
        title: 'Content Blocked',
        message: "The content you're trying to upload has been blocked for security reasons.",
        action: 'Please review our content guidelines and try a different file.',
        severity: 'error',
        category: 'security',
        retryable: false,
        suggestions: [
          'Review our content guidelines',
          'Choose a different file',
          'Contact support for review',
          'Check file permissions and format',
        ],
        helpUrl: '/help/content-guidelines',
      }),
    ];
  }

  addTemplate(template: ErrorTemplate): void {
    this.templates.push(template);
  }

  addCustomMessage(key: string, message: ErrorMessage): void {
    this.customMessages.set(key, message);
  }

  getErrorMessage(error: unknown, context: ErrorContext): ErrorMessage {
    if (typeof error === 'string') {
      const customMessage = this.customMessages.get(error);
      if (customMessage) {
        return customMessage;
      }
    }

    const errorString = this.errorToString(error);
    for (const template of this.templates) {
      if (template.pattern.test(errorString)) {
        if (!template.condition || template.condition(error, context)) {
          return this.enhanceMessage(template.message, error, context);
        }
      }
    }

    return this.createGenericErrorMessage(error, context);
  }

  private errorToString(error: unknown): string {
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message;
    if (typeof error === 'object' && error !== null) {
      const objectError = error as {
        message?: unknown;
        error?: unknown;
        statusText?: unknown;
      };

      if (typeof objectError.message === 'string') return objectError.message;
      if (typeof objectError.error === 'string') return objectError.error;
      if (typeof objectError.statusText === 'string') return objectError.statusText;
    }

    if (error === null || error === undefined) {
      return 'Unknown error';
    }

    return String(error);
  }

  private enhanceMessage(message: ErrorMessage, error: unknown, context: ErrorContext): ErrorMessage {
    const suggestions = [...message.suggestions];

    if (context.operation === 'file_upload' && !suggestions.includes('Try compressing the file first')) {
      suggestions.unshift('Try compressing the file first');
    }

    if (context.operation === 'api_request' && !suggestions.includes('Check your internet connection')) {
      suggestions.unshift('Check your internet connection');
    }

    if (context.component === 'VisualEditor' && !suggestions.includes('Try saving your work and refreshing')) {
      suggestions.unshift('Try saving your work and refreshing');
    }

    return {
      ...message,
      suggestions,
      technicalDetails: isDevelopmentEnvironment()
        ? this.getTechnicalDetails(error, context)
        : message.technicalDetails,
    };
  }

  private createGenericErrorMessage(error: unknown, context: ErrorContext): ErrorMessage {
    const summary = this.errorToString(error);
    const suggestions = [
      'Try refreshing the page',
      'Check your internet connection',
      'Clear your browser cache',
      'Contact support with error details',
    ];

    if (summary !== 'Unknown error') {
      suggestions.push(`If you contact support, mention: ${summary.slice(0, 80)}`);
    }

    return {
      id: 'generic_error',
      title: 'Something Went Wrong',
      message: "An unexpected error occurred. We're sorry for the inconvenience.",
      action: 'Please try again or contact support if the problem persists.',
      severity: 'error',
      category: 'system',
      retryable: true,
      autoRetry: false,
      suggestions,
      helpUrl: '/help/contact-support',
      technicalDetails: isDevelopmentEnvironment()
        ? this.getTechnicalDetails(error, context)
        : undefined,
    };
  }

  private getTechnicalDetails(error: unknown, context: ErrorContext): string {
    const stack =
      error instanceof Error ? error.stack : undefined;

    return [
      `Error: ${this.errorToString(error)}`,
      `Operation: ${context.operation}`,
      `Component: ${context.component ?? 'Unknown'}`,
      `Timestamp: ${new Date(context.timestamp).toISOString()}`,
      `User ID: ${context.userId ?? 'Anonymous'}`,
      `Metadata: ${JSON.stringify(context.metadata ?? {}, null, 2)}`,
      `Stack: ${stack ?? 'No stack trace available'}`,
    ].join('\n');
  }

  trackErrorContext(error: unknown, context: ErrorContext): void {
    const errorString = this.errorToString(error);
    const contexts = this.contextHistory.get(errorString) ?? [];
    contexts.push(context);
    this.contextHistory.set(errorString, contexts);
  }

  getErrorStatistics(): ErrorStatistics {
    const stats: ErrorStatistics = {
      totalErrors: 0,
      errorsByCategory: {},
      errorsBySeverity: {},
      mostCommonErrors: [],
      retryableErrors: 0,
      autoRetryableErrors: 0,
    };

    for (const [errorString, contexts] of this.contextHistory.entries()) {
      if (contexts.length === 0) {
        continue;
      }

      stats.totalErrors += contexts.length;
      const message = this.getErrorMessage(errorString, contexts[0]);
      stats.errorsByCategory[message.category] = (stats.errorsByCategory[message.category] ?? 0) + contexts.length;
      stats.errorsBySeverity[message.severity] = (stats.errorsBySeverity[message.severity] ?? 0) + contexts.length;

      if (message.retryable) {
        stats.retryableErrors += contexts.length;
      }

      if (message.autoRetry) {
        stats.autoRetryableErrors += contexts.length;
      }
    }

    stats.mostCommonErrors = Array.from(this.contextHistory.entries())
      .map(([error, contexts]) => ({ error, count: contexts.length }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 10);

    return stats;
  }

  clearErrorHistory(): void {
    this.contextHistory.clear();
  }

  getHelpUrl(category: string): string {
    const helpUrls: Record<string, string> = {
      network: '/help/network-issues',
      validation: '/help/validation-errors',
      permission: '/help/permissions',
      system: '/help/server-errors',
      user: '/help/user-guide',
      security: '/help/security',
    };

    return helpUrls[category] ?? '/help/contact-support';
  }
}

export const errorMessageManager = new ErrorMessageManager();

export const getErrorMessage = (error: unknown, context: ErrorContext): ErrorMessage => {
  errorMessageManager.trackErrorContext(error, context);
  return errorMessageManager.getErrorMessage(error, context);
};

export const addCustomErrorMessage = (key: string, message: ErrorMessage): void => {
  errorMessageManager.addCustomMessage(key, message);
};

export const getErrorStatistics = (): ErrorStatistics => {
  return errorMessageManager.getErrorStatistics();
};

export const clearErrorHistory = (): void => {
  errorMessageManager.clearErrorHistory();
};

export const useErrorMessage = () => {
  const [errorHistory, setErrorHistory] = React.useState<ErrorMessage[]>([]);

  const handleError = React.useCallback((error: unknown, context: ErrorContext) => {
    const resolvedMessage = getErrorMessage(error, context);
    setErrorHistory((previousHistory) => [resolvedMessage, ...previousHistory.slice(0, 9)]);
    return resolvedMessage;
  }, []);

  const clearHistory = React.useCallback(() => {
    setErrorHistory([]);
    clearErrorHistory();
  }, []);

  return {
    handleError,
    errorHistory,
    clearHistory,
    getStatistics: getErrorStatistics,
  };
};

export const formatErrorMessage = (message: ErrorMessage): {
  title: string;
  description: string;
  action: string;
  suggestions: string[];
  severity: string;
  retryable: boolean;
  helpUrl?: string;
} => {
  return {
    title: message.title,
    description: message.message,
    action: message.action,
    suggestions: message.suggestions,
    severity: message.severity,
    retryable: message.retryable,
    helpUrl: message.helpUrl,
  };
};

export default errorMessageManager;
