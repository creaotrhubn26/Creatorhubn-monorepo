/**
 * useRealtimeNotifications Hook
 * Connects to WebSocket server for real-time notifications
 */

import { useEffect, useState, useCallback, useRef } from 'react';

export interface RealtimeNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  timestamp: string;
  metadata?: any;
  userId?: string;
}

export function useRealtimeNotifications(userId?: string) {
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState<RealtimeNotification[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Connect to WebSocket server
   */
  const connect = useCallback(() => {
    if (!userId || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      // Use secure WebSocket in production, regular in development
      const protocol = window.location.protocol === 'https: ' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/events`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('📡 WebSocket connected for real-time notifications');
        setConnected(true);

        // Authenticate
        ws.send(JSON.stringify({
          type: 'auth',
          userId,
          userType: 'photographer'
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'CONNECTED':
            case 'auth_success':
              console.log('✅ WebSocket authenticated');
              break;

            case 'timeline_changes:accepted':
            case 'worklog:created':
            case 'worklog:updated':
            case 'notification':
              // Add to notifications list
              setNotifications(prev => [data, ...prev.slice(0, 49)]); // Keep last 50
              
              // Show browser notification if permitted
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(data.title || 'CreatorHub Notification', {
                  body: data.message || ', ',
                  icon: '/creatorhub-icon.png',
                  tag: data.id || `notification-${Date.now()}`
                });
              }
              break;

            default:
              console.log('📡 WebSocket message:', data.type);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        console.log('📡 WebSocket disconnected');
        setConnected(false);
        wsRef.current = null;

        // Reconnect after 5 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('📡 Reconnecting WebSocket...');
          connect();
        }, 5000);
      };

      ws.onerror = (error) => {
        console.error('📡 WebSocket error:', error);
        setConnected(false);
      };

    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      setConnected(false);
    }
  }, [userId]);

  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setConnected(false);
  }, []);

  /**
   * Clear all notifications
   */
  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  /**
   * Request browser notification permission
   */
  const requestPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return Notification.permission ==='granted';
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (userId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [userId, connect, disconnect]);

  // Request notification permission on mount
  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  return {
    connected,
    notifications,
    clearNotifications,
    requestPermission,
    reconnect: connect,
    disconnect
  };
}

