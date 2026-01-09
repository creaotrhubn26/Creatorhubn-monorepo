/**
 * useOnboardingAnalytics Hook
 * 
 * Tracks user behavior and analytics events during onboarding
 */

import { useCallback } from 'react';

interface AnalyticsEvent {
  event: string;
  userId: string;
  profession: string;
  stepIndex?: number;
  stepId?: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export const useOnboardingAnalytics = (userId: string, profession: string) => {
  const trackEvent = useCallback(
    (
      eventName: string,
      stepIndex?: number,
      stepId?: string,
      metadata?: Record<string, any>
    ) => {
      if (!userId || !profession) return;

      const event: AnalyticsEvent = {
        event: eventName,
        userId,
        profession,
        stepIndex,
        stepId,
        timestamp: Date.now(),
        metadata,
      };

      // Send to analytics service (you can integrate with your analytics provider)
      try {
        // Example: Send to backend analytics endpoint
        fetch('/api/analytics/onboarding', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        }).catch((error) => {
          console.error('Error tracking analytics event:', error);
        });

        // Also log to console in development
        if (process.env.NODE_ENV === 'development') {
          console.log('Analytics Event:', event);
        }
      } catch (error) {
        console.error('Error tracking analytics event:', error);
      }
    },
    [userId, profession]
  );

  const trackStepStart = useCallback(
    (stepIndex: number, stepId: string) => {
      trackEvent('onboarding_step_start', stepIndex, stepId);
    },
    [trackEvent]
  );

  const trackStepComplete = useCallback(
    (stepIndex: number, stepId: string, timeSpent?: number) => {
      trackEvent('onboarding_step_complete', stepIndex, stepId, {
        timeSpent,
      });
    },
    [trackEvent]
  );

  const trackOnboardingStart = useCallback(() => {
    trackEvent('onboarding_start');
  }, [trackEvent]);

  const trackOnboardingComplete = useCallback(
    (totalTime?: number, stepsCompleted?: number) => {
      trackEvent('onboarding_complete', undefined, undefined, {
        totalTime,
        stepsCompleted,
      });
    },
    [trackEvent]
  );

  const trackOnboardingSkip = useCallback(
    (stepIndex?: number, reason?: string) => {
      trackEvent('onboarding_skip', stepIndex, undefined, {
        reason,
      });
    },
    [trackEvent]
  );

  return {
    trackEvent,
    trackStepStart,
    trackStepComplete,
    trackOnboardingStart,
    trackOnboardingComplete,
    trackOnboardingSkip,
  };
};

export default useOnboardingAnalytics;

