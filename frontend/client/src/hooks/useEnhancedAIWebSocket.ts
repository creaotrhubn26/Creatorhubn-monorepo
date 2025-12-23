/**
 * Enhanced AI WebSocket Hook
 * Provides real-time progress updates for Enhanced AI operations
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export interface EnhancedAIProgress {
  jobId: string;
  progress: number; // 0-100
  stage: string;
  message: string;
  timestamp: number;
}

export interface EnhancedAIResult {
  jobId: string;
  result: {
    outputPath?: string;
    factor?: number;
    [key: string]: any;
  };
  timestamp: number;
}

export interface EnhancedAIError {
  jobId: string;
  error: string;
  timestamp: number;
}

export function useEnhancedAIWebSocket(jobId?: string) {
  const [progress, setProgress] = useState<EnhancedAIProgress | null>(null);
  const [result, setResult] = useState<EnhancedAIResult | null>(null);
  const [error, setError] = useState<EnhancedAIError | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    const protocol = window.location.protocol === 'https: ' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/enhanced-ai`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ Enhanced AI WebSocket connected');
        setIsConnected(true);

        // Subscribe to job if provided
        if (jobId) {
          ws.send(
            JSON.stringify({
              type: 'subscribe',
              jobId,
            })
          );
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case 'connected':
              console.log('Enhanced AI WebSocket:', data.message);
              break;

            case 'progress':
              setProgress({
                jobId: data.jobId,
                progress: data.progress,
                stage: data.stage,
                message: data.message,
                timestamp: data.timestamp,
              });
              break;

            case 'complete':
              setResult({
                jobId: data.jobId,
                result: data.result,
                timestamp: data.timestamp,
              });
              // Invalidate queries to refresh data
              queryClient.invalidateQueries({ queryKey: ['/api/enhanced-ai'] });
              break;

            case 'error':
              setError({
                jobId: data.jobId,
                error: data.error,
                timestamp: data.timestamp,
              });
              break;

            case 'pong':
              // Heartbeat response
              break;

            default:
              console.warn('Unknown Enhanced AI WebSocket message type:', data.type);
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.onerror = (err) => {
        console.error('Enhanced AI WebSocket error:', err);
        setIsConnected(false);
      };

      ws.onclose = () => {
        console.log('Enhanced AI WebSocket disconnected');
        setIsConnected(false);
        // Attempt to reconnect after 3 seconds
        setTimeout(() => {
          if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
            connect();
          }
        }, 3000);
      };
    } catch (err) {
      console.error('Failed to create Enhanced AI WebSocket:', err);
      setIsConnected(false);
    }
  }, [jobId, queryClient]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const subscribe = useCallback(
    (newJobId: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type:'subscribe',
            jobId: newJobId,
          })
        );
      }
    },
    []
  );

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Subscribe to new job when jobId changes
  useEffect(() => {
    if (jobId && isConnected) {
      subscribe(jobId);
    }
  }, [jobId, isConnected, subscribe]);

  return {
    progress,
    result,
    error,
    isConnected,
    subscribe,
    connect,
    disconnect,
  };
}

