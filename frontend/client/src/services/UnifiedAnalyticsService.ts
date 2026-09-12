/**
 * UnifiedAnalyticsService - Shared analytics tracking for Dashboard and Showcase
 */

import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useCallback } from 'react';
import { apiRequest } from '@/lib/queryClient';

export type AnalyticsEventType =
  | 'navigation'
  | 'interaction'
  | 'file_upload'
  | 'file_download'
  | 'project_action'
  | 'client_action'
  | 'showcase_view'
  | 'showcase_interaction'
  | 'settings_change'
  | 'feature_usage';

interface AnalyticsEvent {
  type: AnalyticsEventType;
  action: string;
  component: string;
  metadata?: Record<string, any>;
  timestamp: number;
  userId?: string;
  sessionId?: string;
}

export const useUnifiedAnalytics = () => {
  const { communication, features } = useEnhancedMasterIntegration();

  const trackEvent = useCallback(
    (
      type: AnalyticsEventType,
      action: string,
      component: string,
      metadata?: Record<string, any>,
    ) => {
      const event: AnalyticsEvent = {
        type,
        action,
        component,
        metadata: {
          ...metadata,
          userAgent: navigator.userAgent,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
        },
        timestamp: Date.now(),
        sessionId: sessionStorage.getItem('analytics-session-id') || generateSessionId(),
      };

      // Track with features system
      features.trackFeatureUsage(`analytics-${type}`, action, event.metadata);

      // Broadcast to integration system
      communication.sendMessage({
        from: 'unified-analytics',
        to: 'all',
        type: 'analytics:event',
        data: event,
        priority: 'low',
      });

      // Persist events server-first with local fallback for offline tracking
      const events = JSON.parse(localStorage.getItem('analytics-events') || '[]');
      events.push(event);

      // Keep only last 1000 events
      if (events.length > 1000) {
        events.splice(0, events.length - 1000);
      }

      apiRequest('/api/user/kv', {
        method: 'POST',
        body: JSON.stringify({ key: 'analytics-events', value: events }),
      }).catch(() => {});
      localStorage.setItem('analytics-events', JSON.stringify(events));

      // Send to server (best-effort)
      apiRequest('/api/analytics/track', {
        method: 'POST',
        body: JSON.stringify({ eventType: `${type}:${action}`, eventData: event, userId: undefined }),
      }).catch(() => {});

      // Log in development
      if (import.meta.env.MODE === 'development') {
        console.log('[Analytics]', type, action, metadata);
      }
    },
    [communication, features],
  );

  const trackNavigation = useCallback(
    (from: string, to: string, metadata?: Record<string, any>) => {
      trackEvent('navigation', 'navigate','navigation-context', {
        from,
        to,
        ...metadata,
      });
    },
    [trackEvent],
  );

  const trackInteraction = useCallback(
    (element: string, action: string, metadata?: Record<string, any>) => {
      trackEvent('interaction', action, element, metadata);
    },
    [trackEvent],
  );

  const trackFileAction = useCallback(
    (action: 'upload' | 'download', fileName: string, metadata?: Record<string, any>) => {
      trackEvent(action === 'upload' ? 'file_upload' : 'file_download', action, 'file-manager', {
        fileName,
        ...metadata,
      });
    },
    [trackEvent],
  );

  const trackProjectAction = useCallback(
    (action: string, projectId: string, metadata?: Record<string, any>) => {
      trackEvent('project_action', action, 'universal-dashboard', {
        projectId,
        ...metadata,
      });
    },
    [trackEvent],
  );

  const trackShowcaseView = useCallback(
    (itemId: string, metadata?: Record<string, any>) => {
      trackEvent('showcase_view', 'view_item', 'universal-showcase', {
        itemId,
        ...metadata,
      });
    },
    [trackEvent],
  );

  const trackShowcaseInteraction = useCallback(
    (action: string, itemId: string, metadata?: Record<string, any>) => {
      trackEvent('showcase_interaction', action, 'universal-showcase', {
        itemId,
        ...metadata,
      });
    },
    [trackEvent],
  );

  const getAnalyticsSummary = useCallback(() => {
    // Server-first synchronous fetch not possible here; use local with best-effort async refresh
    const events: AnalyticsEvent[] = JSON.parse(localStorage.getItem('analytics-events') || '[]');
    apiRequest('/api/user/kv/analytics-events')
      .then((j: unknown) => {
        const v = j && typeof j === 'object' && 'value' in (j as Record<string, unknown>)
          ? (j as Record<string, unknown>).value
          : j;
        if (Array.isArray(v)) {
          localStorage.setItem('analytics-events', JSON.stringify(v));
        }
      })
      .catch(() => {});

    const summary = {
      totalEvents: events.length,
      eventsByType: {} as Record<string, number>,
      eventsByComponent: {} as Record<string, number>,
      recentEvents: events.slice(-10).reverse(),
      sessionStart: sessionStorage.getItem('analytics-session-start'),
      sessionId: sessionStorage.getItem('analytics-session-id'),
    };

    events.forEach((event) => {
      summary.eventsByType[event.type] = (summary.eventsByType[event.type] || 0) + 1;
      summary.eventsByComponent[event.component] =
        (summary.eventsByComponent[event.component] || 0) + 1;
    });

    return summary;
  }, []);

  const clearAnalytics = useCallback(() => {
    localStorage.removeItem('analytics-events');
    sessionStorage.removeItem('analytics-session-id');
    sessionStorage.removeItem('analytics-session-start');

    communication.sendMessage({
      from: 'unified-analytics',
      to: 'all',
      type: 'analytics:cleared',
      data: { timestamp: Date.now() },
      priority: 'low',
    });
  }, [communication]);

  return {
    trackEvent,
    trackNavigation,
    trackInteraction,
    trackFileAction,
    trackProjectAction,
    trackShowcaseView,
    trackShowcaseInteraction,
    getAnalyticsSummary,
    clearAnalytics,
  };
};

function generateSessionId(): string {
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  sessionStorage.setItem('analytics-session-id', sessionId);
  sessionStorage.setItem('analytics-session-start', new Date().toISOString());
  return sessionId;
}
