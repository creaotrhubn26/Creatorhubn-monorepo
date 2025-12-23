/**
 * useAuditLogger Hook
 * React hook for audit logging functionality
 */

import { useCallback, useEffect, useRef } from 'react';
import { auditLogger, AuditEvent, AuditQuery, AuditStats } from '../utils/auditLogger';

export interface UseAuditLoggerOptions {
  userId?: string;
  sessionId?: string;
  enableAutoLogging?: boolean;
  logUserActions?: boolean;
  logPerformance?: boolean;
  logErrors?: boolean;
  logPageViews?: boolean;
  logClicks?: boolean;
  logFormSubmissions?: boolean;
  logApiCalls?: boolean;
}

export interface UseAuditLoggerReturn {
  log: (eventData: Partial<AuditEvent>) => void;
  logUserAction: (action: string, resource: string, details?: Record<string, any>) => void;
  logError: (error: Error, context?: Record<string, any>) => void;
  logPerformance: (action: string, duration: number, details?: Record<string, any>) => void;
  logPageView: (page: string, details?: Record<string, any>) => void;
  logClick: (element: string, details?: Record<string, any>) => void;
  logFormSubmission: (formName: string, success: boolean, details?: Record<string, any>) => void;
  logApiCall: (endpoint: string, method: string, success: boolean, duration: number, details?: Record<string, any>) => void;
  query: (query: AuditQuery) => AuditEvent[];
  getStats: () => AuditStats;
  export: (format?: 'json' | 'csv' | 'xml') => string;
  clear: () => void;
}

export const useAuditLogger = (options: UseAuditLoggerOptions = {}): UseAuditLoggerReturn => {
  const {
    userId = 'anonymous',
    sessionId,
    enableAutoLogging = true,
    logUserActions = true,
    logPerformance = true,
    logErrors = true,
    logPageViews = true,
    logClicks = true,
    logFormSubmissions = true,
    logApiCalls = true
} = options;

  const currentUserId = useRef(userId);
  const currentSessionId = useRef(sessionId);

  // Update refs when props change
  useEffect(() => {
    currentUserId.current = userId;
}, [userId]);

  useEffect(() => {
    currentSessionId.current = sessionId;
}, [sessionId]);

  // Generic log function
  const log = useCallback((eventData: Partial<AuditEvent>) => {
    auditLogger.log({
      ...eventData,
      userId: currentUserId.current,
      sessionId: currentSessionId.current
});
}, []);

  // Log user actions
  const logUserAction = useCallback((action: string, resource: string, details?: Record<string, any>) => {
    if (!logUserActions) return;

    log({
      action,
      resource,
      resourceId: resource,
      details: {
        ...details,
        timestamp: Date.now()
},
      severity: 'low',
      category: 'user',
      tags: ['user_action','interaction']
  });
}, [log, logUserActions]);

  // Log errors
  const logError = useCallback((error: Error, context?: Record<string, any>) => {
    if (!logErrors) return;

    log({
      action: 'error_occurred',
      resource: 'application',
      resourceId: 'error',
      details: {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
},
        context,
        timestamp: Date.now()
},
      severity: 'high',
      category: 'error',
      tags: ['error','exception','javascript']
  });
}, [log, logErrors]);

  // Log performance metrics
  const logPerformanceMetrics = useCallback((action: string, duration: number, details?: Record<string, any>) => {
    if (!logPerformance) return;

    const severity = duration > 1000 ? 'medium' : 'low';

    log({
      action,
      resource: 'performance',
      resourceId: action,
      details: {
        duration,
        ...details,
        timestamp: Date.now()
},
      severity,
      category: 'performance',
      tags: ['performance','timing','metrics']
  });
}, [log, logPerformance]);

  // Log page views
  const logPageView = useCallback((page: string, details?: Record<string, any>) => {
    if (!logPageViews) return;

    log({
      action: 'page_view',
      resource: 'page',
      resourceId: page,
      details: {
        page,
        url: typeof window !== 'undefined' ? window.location.href : 'unknown',
        referrer: typeof window !== 'undefined' ? document.referrer : 'unknown',
        ...details,
        timestamp: Date.now()
},
      severity: 'low',
      category: 'user',
      tags: ['page_view','navigation','analytics']
  });
}, [log, logPageViews]);

  // Log clicks
  const logClick = useCallback((element: string, details?: Record<string, any>) => {
    if (!logClicks) return;

    log({
      action: 'click',
      resource: 'element',
      resourceId: element,
      details: {
        element,
        ...details,
        timestamp: Date.now()
},
      severity: 'low',
      category: 'user',
      tags: ['click', 'interaction', 'ui']
  });
}, [log, logClicks]);

  // Log form submissions
  const logFormSubmission = useCallback((formName: string, success: boolean, details?: Record<string, any>) => {
    if (!logFormSubmissions) return;

    log({
      action: 'form_submission',
      resource: 'form',
      resourceId: formName,
      details: {
        formName,
        success,
        ...details,
        timestamp: Date.now()
},
      severity: success ? 'low' : 'medium',
      category: 'user',
        tags: ['form', 'submission', success ? 'success' : 'error']
  });
}, [log, logFormSubmissions]);

  // Log API calls
  const logApiCall = useCallback((endpoint: string, method: string, success: boolean, duration: number, details?: Record<string, any>) => {
    if (!logApiCalls) return;

    const severity = success ? 'low' : 'medium';

    log({
      action: 'api_call',
      resource: 'api',
      resourceId: endpoint,
      details: {
        endpoint,
        method,
        success,
        duration,
        ...details,
        timestamp: Date.now()
},
      severity,
      category: 'system',
        tags: ['api', 'http', method.toLowerCase(), success ? 'success' : 'error']
  });
}, [log, logApiCalls]);

  // Query function
  const query = useCallback((query: AuditQuery) => {
    return auditLogger.query(query);
}, []);

  // Get stats
  const getStats = useCallback(() => {
    return auditLogger.getStats();
}, []);

  // Export function
  const exportData = useCallback((format: 'json' | 'csv' | 'xml' = 'json') => {
    return auditLogger.export(format);
}, []);

  // Clear function
  const clear = useCallback(() => {
    auditLogger.clear();
}, []);

  // Auto-logging setup
  useEffect(() => {
    if (!enableAutoLogging) return;

    // Log page view on mount
    if (logPageViews && typeof window !== 'undefined') {
      logPageView(window.location.pathname);
  }

    // Set up global click logging
    if (logClicks && typeof window !== 'undefined') {
      const handleClick = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        if (target) {
          const elementId = target.id || target.className || target.tagName;
          logClick(elementId, {
            x: event.clientX,
            y: event.clientY,
            button: event.button
});
      }
    };

      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
  }
}, [enableAutoLogging, logPageViews, logClicks, logPageView, logClick]);

  // Set up error boundary logging
  useEffect(() => {
    if (!logErrors) return;

    const handleError = (event: ErrorEvent) => {
      logError(new Error(event.message), {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
    });
  };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      logError(new Error(event.reason), {
        type: 'unhandled_promise_rejection'
});
  };

    if (typeof window !=='undefined') {
      window.addEventListener('error', handleError);
      window.addEventListener('unhandledrejection', handleUnhandledRejection);

      return () => {
        window.removeEventListener('error', handleError);
        window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }
}, [logErrors, logError]);

  return {
    log,
    logUserAction,
    logError,
    logPerformance: logPerformanceMetrics,
    logPageView,
    logClick,
    logFormSubmission,
    logApiCall,
    query,
    getStats,
    export: exportData,
    clear
};
};

export default useAuditLogger;





