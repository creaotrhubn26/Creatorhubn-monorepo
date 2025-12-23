/**
 * Sentry Error Tracking Integration
 * 
 * This module provides a wrapper around Sentry for error tracking.
 * It gracefully handles cases where Sentry is not installed or configured.
 * 
 * To enable Sentry:
 * 1. Install: npm install @sentry/react
 * 2. Set environment variable: VITE_SENTRY_DSN=your-dsn-here
 * 3. Uncomment the Sentry import and initialization code below
 */

// Sentry is now installed and configured
import * as Sentry from '@sentry/react';

interface SentryBreadcrumb {
  category: string;
  message: string;
  level?: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug';
  data?: Record<string, any>;
}

interface SentryUser {
  id?: string;
  email?: string;
  username?: string;
  [key: string]: any;
}

/**
 * Check if Sentry is available and configured
 */
const isSentryAvailable = (): boolean => {
  return typeof Sentry !== 'undefined' && !!import.meta.env.VITE_SENTRY_DSN;
};

/**
 * Initialize Sentry
 * Call this in your main.tsx or App.tsx
 */
export const initSentry = (): void => {
  if (!isSentryAvailable()) {
    console.log('Sentry is not configured. Error tracking disabled.');
    return;
  }

  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE || 'development',

    // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
    // We recommend adjusting this value in production
    tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,

    // Set `tracePropagationTargets` to control for which URLs distributed tracing should be enabled
    tracePropagationTargets: ['localhost', /^https:\/\/creatorhub\.io\/api/],

    // Capture Replay for 10% of all sessions,
    // plus for 100% of sessions with an error
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    // Send default PII (as per your Sentry config)
    sendDefaultPii: true,

    // Integrations
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],

    // Filter out certain errors
    beforeSend(event, hint) {
      // Log errors in development but still send them
      if (import.meta.env.MODE === 'development') {
        console.log('Sentry event (dev mode):', event);
      }

      // Filter out known non-critical errors
      const error = hint.originalException;
      if (error && typeof error === 'object' && 'message' in error) {
        const message = String(error.message);

        // Ignore network errors
        if (message.includes('Network Error') || message.includes('Failed to fetch')) {
          return null;
        }

        // Ignore ResizeObserver errors (common browser quirk)
        if (message.includes('ResizeObserver')) {
          return null;
        }
      }

      return event;
    },
  });

  console.log('Sentry initialized successfully');
};

/**
 * Capture an error to Sentry
 * @param error - The error to capture
 * @param context - Additional context to attach to the error
 * @returns Event ID from Sentry (or null if Sentry is not available)
 */
export const captureErrorToSentry = (
  error: Error,
  context?: Record<string, any>
): string | null => {
  if (!isSentryAvailable()) {
    console.error('Error (Sentry disabled):', error, context);
    return null;
  }

  if (context) {
    Sentry.setContext('additional_context', context);
  }

  const eventId = Sentry.captureException(error);
  console.log('Error captured to Sentry: ', eventId);
  return eventId;
};

/**
 * Capture a message to Sentry
 * @param message - The message to capture
 * @param level - Severity level
 * @param context - Additional context
 */
export const captureMessageToSentry = (
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug' = 'info',
  context?: Record<string, any>
): string | null => {
  if (!isSentryAvailable()) {
    console.log(`Message (Sentry disabled) [${level}]:`, message, context);
    return null;
  }

  if (context) {
    Sentry.setContext('additional_context', context);
  }

  const eventId = Sentry.captureMessage(message, level);
  return eventId;
};

/**
 * Add a breadcrumb to Sentry
 * Breadcrumbs are a trail of events that happened prior to an error
 * @param breadcrumb - Breadcrumb data
 */
export const addSentryBreadcrumb = (breadcrumb: SentryBreadcrumb): void => {
  if (!isSentryAvailable()) {
    console.log('Breadcrumb (Sentry disabled):', breadcrumb);
    return;
  }

  Sentry.addBreadcrumb({
    category: breadcrumb.category,
    message: breadcrumb.message,
    level: breadcrumb.level || 'info',
    data: breadcrumb.data,
    timestamp: Date.now() / 1000,
  });
};

/**
 * Set user context in Sentry
 * @param user - User information
 */
export const setSentryUser = (user: SentryUser | null): void => {
  if (!isSentryAvailable()) {
    console.log('Set user (Sentry disabled):', user);
    return;
  }

  Sentry.setUser(user);
};

/**
 * Set custom tags in Sentry
 * @param tags - Key-value pairs of tags
 */
export const setSentryTags = (tags: Record<string, string>): void => {
  if (!isSentryAvailable()) {
    console.log('Set tags (Sentry disabled):', tags);
    return;
  }

  Object.entries(tags).forEach(([key, value]) => {
    Sentry.setTag(key, value);
  });
};

/**
 * Set custom context in Sentry
 * @param name - Context name
 * @param context - Context data
 */
export const setSentryContext = (name: string, context: Record<string, any> | null): void => {
  if (!isSentryAvailable()) {
    console.log(`Set context "${name}" (Sentry disabled):`, context);
    return;
  }

  Sentry.setContext(name, context);
};

/**
 * Show Sentry feedback dialog
 * Allows users to submit feedback when an error occurs
 * @param eventId - The event ID from Sentry
 */
export const showSentryFeedbackDialog = (eventId: string): void => {
  if (!isSentryAvailable()) {
    console.log('Show feedback dialog (Sentry disabled):', eventId);
    return;
  }

  Sentry.showReportDialog({
    eventId,
    title: 'It looks like we\'re having issues.',
    subtitle: 'Our team has been notified.',
    subtitle2: 'If you\'d like to help, tell us what happened below.',
    labelName: 'Name',
    labelEmail: 'Email',
    labelComments: 'What happened?',
    labelClose: 'Close',
    labelSubmit: 'Submit',
    errorGeneric: 'An unknown error occurred while submitting your report. Please try again.',
    errorFormEntry: 'Some fields were invalid. Please correct the errors and try again.',
    successMessage: 'Your feedback has been sent. Thank you!',
  });
};

/**
 * Wrap a function with Sentry error tracking
 * @param fn - Function to wrap
 * @param functionName - Name of the function for tracking
 */
export const withSentryTracking = <T extends (...args: any[]) => any>(
  fn: T,
  functionName: string
): T => {
  return ((...args: any[]) => {
    try {
      addSentryBreadcrumb({
        category: 'function-call',
        message: `Calling ${functionName}`,
        level: 'info',
      });

      const result = fn(...args);

      // Handle promises
      if (result instanceof Promise) {
        return result.catch((error) => {
          captureErrorToSentry(error, {
            functionName,
            arguments: args,
          });
          throw error;
        });
      }

      return result;
    } catch (error) {
      captureErrorToSentry(error as Error, {
        functionName,
        arguments: args,
      });
      throw error;
    }
  }) as T;
};

/**
 * Example usage in your app:
 *
 * // In main.tsx or App.tsx:
 * import { initSentry, setSentryUser } from './utils/sentry';
 *
 * initSentry();
 *
 * // When user logs in:
 * setSentryUser({
 *   id: user.id,
 *   email: user.email,
 *   username: user.username,
 * });
 *
 * // When user logs out:
 * setSentryUser(null);
 *
 * // In components:
 * import { addSentryBreadcrumb, captureErrorToSentry } from './utils/sentry';
 *
 * const handleAction = () => {
 *   addSentryBreadcrumb({
 *     category: 'user-action',
 *     message: 'User clicked submit button',
 *     level: 'info',
 *   });
 *
 *   try {
 *     // ... your code
 *   } catch (error) {
 *     captureErrorToSentry(error, { action:'submit' });
 *   }
 * };
 */
