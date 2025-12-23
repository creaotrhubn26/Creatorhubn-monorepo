/**
 * useComponentCommunication Hook
 * Reusable hook for inter-component communication in Visual Editor
 *
 * Features:
 * - Broadcast events to other components
 * - Listen for events from other components
 * - Automatic cleanup on unmount
 * - Type-safe event handling
 */

import { useCallback, useEffect, useRef } from 'react';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';

export interface ComponentCommunicationOptions {
  componentId: string;
  debug?: boolean;
}

export interface BroadcastEvent {
  type: string;
  data: unknown;
  timestamp: number;
  sourceComponent: string;
}

/**
 * Hook for component communication
 * @param options - Configuration options
 * @returns Communication methods
 */
export function useComponentCommunication(options: ComponentCommunicationOptions) {
  const { componentId, debug = false } = options;
  const { communication, dataFlow, analytics, debugging } = useEnhancedMasterIntegration();
  const listenerIds = useRef<string[]>([]);

  /**
   * Broadcast an event to all listening components
   * @param event - Event type (without componentId prefix)
   * @param data - Event data payload
   */
  const broadcast = useCallback(
    (event: string, data: unknown) => {
      const fullEventType = `${componentId}:${event}`;
      const broadcastData: BroadcastEvent = {
        type: fullEventType,
        data,
        timestamp: Date.now(),
        sourceComponent: componentId,
      };

      if (debug) {
        console.log(`[ComponentComm] Broadcasting: ${fullEventType}`, data);
      }

      // Send via communication system
      communication.sendBroadcast(fullEventType, data);

      // Track analytics
      analytics.trackEvent('component_communication_broadcast', {
        componentId,
        event,
        timestamp: Date.now(),
      });

      // Log for debugging
      debugging.logIntegration('info', `Component broadcast: ${fullEventType}`, {
        componentId,
        event,
        dataKeys: Object.keys(data),
      });
    },
    [componentId, debug, communication, analytics, debugging],
  );

  /**
   * Listen for events from other components
   * @param event - Event type to listen for (can include wildcards)
   * @param handler - Callback to handle the event
   * @returns Cleanup function
   */
  const listen = useCallback(
    (event: string, handler: (data: unknown) => void) => {
      const listenerId = `listener-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      listenerIds.current.push(listenerId);

      if (debug) {
        console.log(`[ComponentComm] ${componentId} listening for: ${event}`);
      }

      const unsubscribe = communication.onMessage((message: unknown) => {
        if (message.type === event) {
          if (debug) {
            console.log(`[ComponentComm] ${componentId} received: ${event}`, message.data);
          }

          // Call handler with data
          handler(message.data);

          // Track analytics
          analytics.trackEvent('component_communication_received', {
            componentId,
            event,
            timestamp: Date.now(),
          });
        }
      });

      // Store cleanup function
      return () => {
        unsubscribe();
        listenerIds.current = listenerIds.current.filter((id) => id !== listenerId);
      };
    },
    [componentId, debug, communication, analytics],
  );

  /**
   * Sync data to shared state
   * @param key - Data key
   * @param value - Data value
   */
  const syncData = useCallback(
    (key: string, value: unknown) => {
      const fullKey = `${componentId}:${key}`;

      if (debug) {
        console.log(`[ComponentComm] Syncing data: ${fullKey}`, value);
      }

      dataFlow.syncData(fullKey, value);

      // Track analytics
      analytics.trackEvent('component_data_synced', {
        componentId,
        key,
        timestamp: Date.now(),
      });
    },
    [componentId, debug, dataFlow, analytics],
  );

  /**
   * Get data from shared state
   * @param key - Data key
   * @returns Data value or undefined
   */
  const getData = useCallback(
    (key: string) => {
      const fullKey = `${componentId}:${key}`;

      if (debug) {
        console.log(`[ComponentComm] Getting data: ${fullKey}`);
      }

      return dataFlow.getData(fullKey);
    },
    [componentId, debug, dataFlow],
  );

  /**
   * Broadcast multiple events in batch
   * @param events - Array of event objects
   */
  const broadcastBatch = useCallback(
    (events: Array<{ event: string; data: any }>) => {
      events.forEach(({ event, data }) => {
        broadcast(event, data);
      });
    },
    [broadcast],
  );

  // Cleanup all listeners on unmount
  useEffect(() => {
    return () => {
      if (debug) {
        console.log(
          `[ComponentComm] Cleaning up ${listenerIds.current.length} listeners for ${componentId}`,
        );
      }
      listenerIds.current = [];
    };
  }, [componentId, debug]);

  return {
    broadcast,
    listen,
    syncData,
    getData,
    broadcastBatch,
  };
}

/**
 * Common event types for inter-component communication
 */
export const ComponentEvents = {
  // Branding events
  BRANDING_UPDATED: 'branding:updated',
  BRANDING_RESET: 'branding:reset',

  // Logo events
  LOGO_UPDATED: 'logo:updated',
  LOGO_REMOVED: 'logo:removed',

  // Theme events
  THEME_UPDATED: 'theme:updated',
  THEME_RESET: 'theme:reset',

  // Asset events
  ASSET_UPLOADED: 'asset:uploaded',
  FONT_SELECTED: 'font:selected',
  ICON_SELECTED: 'icon:selected',

  // SEO events
  SEO_RECOMMENDATIONS: 'seo:recommendations',
  SEO_CRAWL_COMPLETE: 'seo:crawl:complete',

  // Quality events
  QUALITY_ANALYZED: 'quality:analyzed',
  AI_INSIGHTS_GENERATED: 'ai:insights:generated',

  // Toast events
  TOAST_TEMPLATE_REGISTERED: 'toast:template:registered',
  TOAST_TEMPLATE_PUBLISHED: 'toast:template:published',

  // Project events
  PROJECT_LOADED: 'project:loaded',
  PROJECT_SAVED: 'project:saved',
} as const;

export type ComponentEventType = (typeof ComponentEvents)[keyof typeof ComponentEvents];
