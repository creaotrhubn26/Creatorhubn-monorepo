/**
 * Wedding Timeline WebSocket Hook
 * Provides real-time updates for wedding timeline changes
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export interface TimelineUpdate {
  type: 'timeline_updated' | 'event_updated' | 'event_added' | 'event_deleted' | 'change_requested' | 'change_approved' | 'change_rejected';
  timelineId: string;
  eventId?: string;
  data?: any;
  timestamp: number;
}

export function useWeddingTimelineWebSocket(timelineId?: string, enabled: boolean = true) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<TimelineUpdate | null>(null);
  const [hasNewUpdates, setHasNewUpdates] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (!enabled || !timelineId) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

               // Use wss for https, ws for http
               const protocol = window.location.protocol === 'https: ' ? 'wss:' : 'ws:';
               // WebSocket path supports both /ws/wedding-timeline/:timelineId and /ws/wedding-timeline?timelineId=...
               const wsUrl = `${protocol}//${window.location.host}/ws/wedding-timeline/${timelineId}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ Wedding Timeline WebSocket connected');
        setIsConnected(true);
        setHasNewUpdates(false);
        reconnectAttempts.current = 0;

        // Subscribe to timeline updates
        ws.send(
          JSON.stringify({
            type: 'subscribe',
            timelineId,
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const data: TimelineUpdate = JSON.parse(event.data);

          switch (data.type) {
            case 'timeline_updated':
            case 'event_updated':
            case 'event_added':
            case 'event_deleted':
              setLastUpdate(data);
              setHasNewUpdates(true);
              // Invalidate queries to refresh timeline data
              queryClient.invalidateQueries({ queryKey: ['/api/wedding/timeline/client', timelineId] });
              queryClient.invalidateQueries({ queryKey: ['/api/wedding-timeline/client-view', timelineId] });
              break;

            case 'change_requested':
            case 'change_approved':
            case'change_rejected':
              setLastUpdate(data);
              setHasNewUpdates(true);
              // Invalidate change requests
              queryClient.invalidateQueries({ queryKey: ['/api/wedding-timeline/changes-overview'] });
              break;

            default:
              console.log('Unknown WebSocket message type:', data.type);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('Wedding Timeline WebSocket error:', error);
        setIsConnected(false);
      };

      ws.onclose = () => {
        console.log('Wedding Timeline WebSocket disconnected');
        setIsConnected(false);
        wsRef.current = null;

        // Attempt to reconnect
        if (reconnectAttempts.current < maxReconnectAttempts && enabled) {
          reconnectAttempts.current += 1;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000); // Exponential backoff, max 30s
          
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(`Reconnecting... (attempt ${reconnectAttempts.current})`);
            connect();
          }, delay);
        } else if (reconnectAttempts.current >= maxReconnectAttempts) {
          console.warn('Max reconnection attempts reached. WebSocket will not reconnect.');
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setIsConnected(false);
    }
  }, [timelineId, enabled, queryClient]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    reconnectAttempts.current = 0;
  }, []);

  const acknowledgeUpdate = useCallback(() => {
    setHasNewUpdates(false);
  }, []);

  useEffect(() => {
    if (enabled && timelineId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, timelineId, connect, disconnect]);

  return {
    isConnected,
    lastUpdate,
    hasNewUpdates,
    acknowledgeUpdate,
    reconnect: connect,
  };
}
