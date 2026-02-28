// WebSocket hook for real-time photo enhancement updates
import { useEffect, useRef, useCallback, useState } from 'react';
// import { WSMessage, WSMessageSchema } from '@shared/photo-enhancement-contracts';

// Temporary interface until websocket contracts are added
interface WSMessage {
  type: string;
  payload: unknown;
  timestamp: string;
}
import { useQueryClient } from '@tanstack/react-query';
import { WebSocketError, handleError, logError } from '../utils/errorHandling';

interface JobUpdate {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: string;
  error?: string;
}

interface TelemetryData {
  cpu: number;
  memory: number;
  activeJobs: number;
  queueLength: number;
}

interface UsePhotoEnhancementWebSocketOptions {
  userId: string;
  projectId?: string;
  onJobUpdate?: (job: JobUpdate) => void;
  onSystemUpdate?: (telemetry: TelemetryData) => void;
  onError?: (error: { message: string; code: string }) => void;
}

export const usePhotoEnhancementWebSocket = ({
  userId,
  projectId,
  onJobUpdate,
  onSystemUpdate,
  onError,
}: UsePhotoEnhancementWebSocketOptions) => {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<
    'connecting' | 'connected' | 'disconnected'
  >('disconnected');
  const queryClient = useQueryClient();

  const normalizeIdentifier = useCallback((value: string | undefined) => {
    const trimmed = String(value || '').trim();
    const withoutTrailingComma = trimmed.replace(/,+$/, '');
    return withoutTrailingComma.length > 0 ? withoutTrailingComma : '';
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const normalizedUserId = normalizeIdentifier(userId) || 'guest';
    const normalizedProjectId = normalizeIdentifier(projectId);
    const shouldConnect = normalizedUserId.length > 0;

    if (!shouldConnect) {
      setIsConnected(false);
      setConnectionState('disconnected');
      return;
    }

    setConnectionState('connecting');

    // Use secure WebSocket in production, regular in development
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/photo-enhancement?userId=${encodeURIComponent(
      normalizedUserId
    )}${normalizedProjectId ? `&projectId=${encodeURIComponent(normalizedProjectId)}` : ''}`;

    try {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('📡 PhotoEnhancement WebSocket connected');
        setIsConnected(true);
        setConnectionState('connected');
        reconnectAttemptsRef.current = 0;

        // Clear any existing reconnect timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
      }
    };

      wsRef.current.onmessage = (event) => {
        try {
          const rawMessage = JSON.parse(event.data);
          const message = rawMessage as WSMessage;

          switch (message.type) {
            case 'job_update':
              onJobUpdate?.(message.payload as JobUpdate);
              // Invalidate jobs query to trigger refetch
              queryClient.invalidateQueries({
                queryKey: ['/api/photo-enhancement/jobs', userId, projectId],
            });
              break;

            case 'system_update':
              onSystemUpdate?.(message.payload as TelemetryData);
              // Update telemetry cache
              queryClient.setQueryData(['/api/photo-enhancement/telemetry'], message.payload);
              break;

            case 'error': {
              const error = new WebSocketError(message.payload as string);
              onError?.({ message: error.message, code: error.code || 'WEBSOCKET_ERROR' });
              logError(error, 'WebSocket message error', 'websocket', 'high');
              break;
            }

            case 'connection_established':
            case 'presence_update':
              // Handshake and presence events are expected from the shared websocket server.
              break;

            default: console.warn('📡 Unknown WebSocket message type:', rawMessage);
        }
      } catch (error) {
          const parseError = handleError(error);
          logError(parseError, 'WebSocket message parsing','websocket','medium');
      }
    };

      wsRef.current.onclose = (event) => {
        console.log('📡 PhotoEnhancement WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        setConnectionState('disconnected');

        // Attempt to reconnect unless it was a clean close
        if (event.code !== 1000) {
          scheduleReconnect();
      }
    };

      wsRef.current.onerror = () => {
        const wsError = new WebSocketError('WebSocket connection error');
        logError(wsError, 'WebSocket connection','websocket','high');
        setIsConnected(false);
        setConnectionState('disconnected');
    };
  } catch (error) {
      const connectionError = handleError(error);
      logError(connectionError, 'WebSocket connection creation', 'websocket', 'high');
      setConnectionState('disconnected');
      scheduleReconnect();
  }
}, [userId, projectId, onJobUpdate, onSystemUpdate, onError, queryClient, normalizeIdentifier]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
  }

    // Exponential backoff: 1s, 2s, 4s, 8s ... capped at 30s.
    const attempts = reconnectAttemptsRef.current;
    const delay = Math.min(1000 * Math.pow(2, attempts), 30000);
    reconnectAttemptsRef.current += 1;

    reconnectTimeoutRef.current = setTimeout(() => {
      console.log('📡 Attempting WebSocket reconnection...');
      connect();
  }, delay);
}, [connect]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
  }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
  }

    reconnectAttemptsRef.current = 0;
    setIsConnected(false);
    setConnectionState('disconnected');
}, []);

  const sendMessage = useCallback((message: WSMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
  }
    return false;
}, []);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect();
    return disconnect;
}, [connect, disconnect]);

  // Handle visibility change - reconnect when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && connectionState ==='disconnected') {
        connect();
    }
  };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
}, [connect, connectionState]);

  return {
    isConnected,
    connectionState,
    connect,
    disconnect,
    sendMessage,
};
};
