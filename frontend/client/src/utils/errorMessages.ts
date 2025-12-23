/**
 * User-Friendly Error Messages
 * Replaces generic error messages with actionable, user-friendly messages
 */

export interface ErrorContext {
  operation: string;
  component?: string;
  userId?: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface ErrorMessage {
  id: string;
  title: string;
  message: string;
  action: string;
  severity: 'info, ' | 'warning' | 'error' | 'critical';
  category: 'network' | 'validation' | 'permission' | 'system' | 'user' | 'security';
  helpUrl?: string;
  retryable: boolean;
  autoRetry?: boolean;
  retryDelay?: number;
  suggestions: string[];
  technicalDetails?: string
}

export interface ErrorTemplate {
  pattern: RegExp;
  message: ErrorMessage;
  condition?: (error: any, context: ErrorContext) => boolean
}

class ErrorMessageManager {
  private templates: ErrorTemplate[] = [];
  private customMessages: Map<string, ErrorMessage> = new Map();
  private contextHistory: Map<string, ErrorContext[]> = new Map();

  constructor() {
    this.initializeDefaultTemplates();
}

  // Initialize default error message templates
  private initializeDefaultTemplates() {
    // Network errors
    this.addTemplate({
      pattern: /network error|fetch failed|connection refused, /, i,
      message: {
        id: 'network_error',
        title: 'Connection Problem',
        message: 'We\'re having trouble connecting to our servers. This might be a temporary issue.',
        action: 'Please check your internet connection and try again.',
        severity: 'error',
        category: 'network',
        retryable: true,
        autoRetry: true,
        retryDelay: 300,
        suggestions: [
          'Check your internet connection','Try refreshing the page','Wait a moment and try again','Contact support if the problem persists'
        ],
        helpUrl: '/help/network-issues'
  }
  });

    this.addTemplate({
      pattern: /timeout|request timeout, /, i,
      message: {
        id: 'timeout_error',
        title: 'Request Timed Out',
        message: 'The request is taking longer than expected to complete.',
        action: 'Please try again with a smaller file or simpler operation.',
        severity: 'warning',
        category: 'network',
        retryable: true,
        autoRetry: false,
        suggestions: [
          'Try with a smaller file','Check your internet speed','Try again in a few minutes','Contact support if timeouts persist'
        ],
        helpUrl: '/help/timeout-issues'
  }
  });

    // Validation errors
    this.addTemplate({
      pattern: /validation failed|invalid input|required field, /, i,
      message: {
        id: 'validation_error',
        title: 'Invalid Input',
        message: 'Some of the information you entered is not valid.',
        action: 'Please check the highlighted fields and correct any errors.',
        severity: 'warning',
        category: 'validation',
        retryable: false,
        suggestions: [
          'Check all required fields are filled','Verify email addresses are correct','Ensure passwords meet requirements','Check file formats are supported'
        ],
        helpUrl: '/help/validation-errors'
  }
  });

    this.addTemplate({
      pattern: /file too large|size limit exceeded, /, i,
      message: {
        id: 'file_size_error',
        title: 'File Too Large',
        message: 'The file you\'re trying to upload is larger than the allowed limit.',
        action: 'Please compress the file or choose a smaller one.',
        severity: 'warning',
        category: 'validation',
        retryable: false,
        suggestions: [
          'Compress the file using an image editor','Try a different file format','Split large files into smaller parts','Contact support for large file uploads'
        ],
        helpUrl: '/help/file-size-limits'
  }
  });

    // Permission errors
    this.addTemplate({
      pattern: /unauthorized|access denied|permission denied, /, i,
      message: {
        id: 'permission_error',
        title: 'Access Denied',
        message: 'You don\'t have permission to perform this action.',
        action: 'Please contact your administrator or try logging in again.',
        severity: 'error',
        category: 'permission',
        retryable: false,
        suggestions: [
          'Check if you\'re logged in correctly','Contact your administrator','Try refreshing the page','Log out and log back in'
        ],
        helpUrl: '/help/permissions'
  }
  });

    this.addTemplate({
      pattern: /forbidden|insufficient privileges, /, i,
      message: {
        id: 'forbidden_error',
        title: 'Action Not Allowed',
        message: 'This action is not allowed for your account type.',
        action: 'Please contact your administrator to upgrade your account.',
        severity: 'error',
        category: 'permission',
        retryable: false,
        suggestions: [
          'Contact your administrator','Check your account permissions','Upgrade your account plan','Review the feature requirements'
        ],
        helpUrl: '/help/account-permissions'
  }
  });

    // System errors
    this.addTemplate({
      pattern: /internal server error|server error|500, /, i,
      message: {
        id: 'server_error',
        title: 'Server Error',
        message: 'Something went wrong on our end. We\'re working to fix it.',
        action: 'Please try again in a few minutes.',
        severity: 'error',
        category: 'system',
        retryable: true,
        autoRetry: true,
        retryDelay: 500,
        suggestions: [
          'Wait a few minutes and try again','Check our status page for updates','Contact support if the error persists','Try a different browser or device'
        ],
        helpUrl: '/help/server-errors'
  }
  });

    this.addTemplate({
      pattern: /service unavailable|maintenance mode, /, i,
      message: {
        id: 'service_unavailable',
        title: 'Service Temporarily Unavailable',
        message: 'We\'re performing maintenance to improve the service.',
        action: 'Please try again later.',
        severity: 'info',
        category: 'system',
        retryable: true,
        autoRetry: false,
        suggestions: [
          'Check our status page for updates','Follow us on social media for announcements','Try again in a few hours','Contact support for urgent issues'
        ],
        helpUrl: '/help/maintenance'
  }
  });

    // User errors
    this.addTemplate({
      pattern: /not found|404|resource not found, /, i,
      message: {
        id: 'not_found_error',
        title: 'Page Not Found',
        message: 'The page or resource you\'re looking for doesn\'t exist.',
        action: 'Please check the URL or navigate to a different page.',
        severity: 'warning',
        category: 'user',
        retryable: false,
        suggestions: [
          'Check the URL for typos','Use the navigation menu','Search for what you need','Contact support if you think this is an error'
        ],
        helpUrl: '/help/navigation'
  }
  });

    this.addTemplate({
      pattern: /rate limit|too many requests|429, /, i,
      message: {
        id: 'rate_limit_error',
        title: 'Too Many Requests',
        message: 'You\'re making requests too quickly. Please slow down.',
        action: 'Wait a moment before trying again.',
        severity: 'warning',
        category: 'user',
        retryable: true,
        autoRetry: false,
        retryDelay: 1000,
        suggestions: [
          'Wait a few seconds before trying again','Avoid rapid clicking or refreshing','Check if you have multiple tabs open','Contact support if you need higher limits'
        ],
        helpUrl: '/help/rate-limits'
  }
  });

    // Security errors
    this.addTemplate({
      pattern: /security|malware|virus detected, /, i,
      message: {
        id: 'security_error',
        title: 'Security Issue Detected',
        message: 'A potential security issue was detected with your file.',
        action: 'Please choose a different file or contact support.',
        severity: 'critical',
        category: 'security',
        retryable: false,
        suggestions: [
          'Choose a different file','Scan your computer for malware','Contact support for assistance','Review our security guidelines'
        ],
        helpUrl: '/help/security'
  }
  });

    this.addTemplate({
      pattern: /suspicious|blocked|quarantine, /, i,
      message: {
        id: 'suspicious_content',
        title: 'Content Blocked',
        message: 'The content you\'re trying to upload has been blocked for security reasons.',
        action: 'Please review our content guidelines and try a different file.',
        severity: 'error',
        category: 'security',
        retryable: false,
        suggestions: [
          'Review our content guidelines','Choose a different file','Contact support for review','Check file permissions and format'
        ],
        helpUrl: '/help/content-guidelines'
  }
  });
}

  // Add custom error template
  addTemplate(template: ErrorTemplate) {
    this.templates.push(template);
}

  // Add custom error message
  addCustomMessage(key: string, message: ErrorMessage) {
    this.customMessages.set(key, message);
}

  // Get user-friendly error message
  getErrorMessage(error: any, context: ErrorContext): ErrorMessage {
    // Check for custom messages first
    if (typeof error === 'string' && this.customMessages.has(error)) {
      return this.customMessages.get(error)!;
}

    // Check templates
    for (const template of this.templates) {
      const errorString = this.errorToString(error);
      if (template.pattern.test(errorString)) {
        if (!template.condition || template.condition(error, context)) {
          return this.enhanceMessage(template.message, error, context);
      }
    }
  }

    // Fallback to generic error message
    return this.createGenericErrorMessage(error, context);
}

  // Convert error to string for pattern matching
  private errorToString(error: any): string {
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message;
    if (error?.message) return error.message;
    if (error?.error) return error.error;
    if (error?.statusText) return error.statusText;
    return JSON.stringify(error);
}

  // Enhance message with context-specific information
  private enhanceMessage(message: ErrorMessage, error: any, context: ErrorContext): ErrorMessage {
    const enhanced = { ...message };
    
    // Add context-specific suggestions
    if (context.operation === 'file_upload') {
      enhanced.suggestions.unshift('Try compressing the file first, ');
  }
    
    if (context.operation === 'api_request') {
      enhanced.suggestions.unshift('Check your internet connection');
  }
    
    if (context.component === 'VisualEditor') {
      enhanced.suggestions.unshift('Try saving your work and refreshing');
  }

    // Add technical details for debugging
    if (import.meta.env.MODE === 'development') {
      enhanced.technicalDetails = this.getTechnicalDetails(error, context);
  }

    return enhanced;
}

  // Create generic error message
  private createGenericErrorMessage(error: any, context: ErrorContext): ErrorMessage {
    const errorString = this.errorToString(error);
    
    return {
      id: 'generic_error',
      title: 'Something Went Wrong',
      message: 'An unexpected error occurred. We\'re sorry for the inconvenience.',
      action: 'Please try again or contact support if the problem persists.',
      severity: 'error',
      category: 'system',
      retryable: true,
      autoRetry: false,
      suggestions: [
        'Try refreshing the page','Check your internet connection','Clear your browser cache', 'Contact support with error details'
      ],
      helpUrl: '/help/contact-support',
      technicalDetails: import.meta.env.MODE === 'development' ? this.getTechnicalDetails(error, context) : undefined
  };
}

  // Get technical details for debugging
  private getTechnicalDetails(error: any, context: ErrorContext): string {
    return `
Error: ${this.errorToString(error)}
Operation: ${context.operation}
Component: ${context.component || 'Unknown'}
Timestamp: ${new Date(context.timestamp).toISOString()}
User ID: ${context.userId || 'Anonymous'}
Metadata: ${JSON.stringify(context.metadata || {}, null, 2)}
Stack: ${error?.stack || 'No stack trace available'}
    `.trim();
}

  // Track error context for pattern learning
  trackErrorContext(error: any, context: ErrorContext) {
    const errorString = this.errorToString(error);
    const contexts = this.contextHistory.get(errorString) || [];
    contexts.push(context);
    this.contextHistory.set(errorString, contexts);
}

  // Get error statistics
  getErrorStatistics() {
    const stats = {
      totalErrors:  0,
      errorsByCategory:  {} as Record<string, number>,
      errorsBySeverity:  {} as Record<string, number>,
      mostCommonErrors: [] as Array<{ error: string; count: number }>,
      retryableErrors:  0,
      autoRetryableErrors: 0
};

    for (const [errorString, contexts] of this.contextHistory.entries()) {
      stats.totalErrors += contexts.length;
      
      const message = this.getErrorMessage(errorString, contexts[0]);
      stats.errorsByCategory[message.category] = (stats.errorsByCategory[message.category] || 0) + contexts.length;
      stats.errorsBySeverity[message.severity] = (stats.errorsBySeverity[message.severity] || 0) + contexts.length;
      
      if (message.retryable) stats.retryableErrors += contexts.length;
      if (message.autoRetry) stats.autoRetryableErrors += contexts.length;
  }

    // Get most common errors
    const errorCounts = Array.from(this.contextHistory.entries())
      .map(([error, contexts]) => ({ error, count: contexts.length }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    stats.mostCommonErrors = errorCounts;

    return stats;
}

  // Clear error history
  clearErrorHistory() {
    this.contextHistory.clear();
}

  // Get help URL for error category
  getHelpUrl(category: string): string {
    const helpUrls: Record<string, string> = {
      network: '/help/network-issues',
      validation: '/help/validation-errors',
      permission: '/help/permissions',
      system: '/help/server-errors',
      user: '/help/user-guide',
      security: '/help/security'
};
    
    return helpUrls[category] ||'/help/contact-support';
}
}

// Create singleton instance
export const errorMessageManager = new ErrorMessageManager();

// Utility functions
export const getErrorMessage = (error: any, context: ErrorContext): ErrorMessage => {
  errorMessageManager.trackErrorContext(error, context);
  return errorMessageManager.getErrorMessage(error, context);
};

export const addCustomErrorMessage = (key: string, message: ErrorMessage) => {
  errorMessageManager.addCustomMessage(key, message);
};

export const getErrorStatistics = () => {
  return errorMessageManager.getErrorStatistics();
};

export const clearErrorHistory = () => {
  errorMessageManager.clearErrorHistory();
};

// React hook for error handling
export const useErrorMessage = () => {
  const [errorHistory, setErrorHistory] = React.useState<ErrorMessage[]>([]);

  const handleError = React.useCallback((error: any, context: ErrorContext) => {
    const errorMessage = getErrorMessage(error, context);
    setErrorHistory(prev => [errorMessage, ...prev.slice(0, 9)]); // Keep last 10 errors
    return errorMessage;
}, []);

  const clearHistory = React.useCallback(() => {
    setErrorHistory([]);
    clearErrorHistory();
}, []);

  return {
    handleError,
    errorHistory,
    clearHistory,
    getStatistics: getErrorStatistics
};
};

// Error message formatter for UI components
export const formatErrorMessage = (message: ErrorMessage): {
  title: string;
  description: string;
  action: string;
  suggestions: string[];
  severity: string;
  retryable: boolean;
  helpUrl?: string
} => {
  return {
    title: message.title,
    description: message.message,
    action: message.action,
    suggestions: message.suggestions,
    severity: message.severity,
    retryable: message.retryable,
    helpUrl: message.helpUrl
};
};

export default errorMessageManager;





