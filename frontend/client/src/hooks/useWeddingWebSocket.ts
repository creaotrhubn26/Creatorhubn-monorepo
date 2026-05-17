/**
 * useWeddingWebSocket — Slice 9X.39
 *
 * Real-time push for wedding-room. Connecter til /ws?userId=…&room=wedding:…
 * og kaller onEvent for hver melding fra server (plan_b_activated,
 * plan_b_deactivated, etc.).
 *
 * Auto-reconnect med exponential backoff (1s → 30s).
 */

import { useEffect, useRef, useState } from 'react';

export interface WeddingWsEvent {
  type: string;
  payload: any;
  timestamp: string;
}

interface UseWeddingWebSocketOptions {
  weddingId: string;
  userId: string;
  enabled?: boolean;
  onEvent?: (event: WeddingWsEvent) => void;
}

export function useWeddingWebSocket({
  weddingId,
  userId,
  enabled = true,
  onEvent,
}: UseWeddingWebSocketOptions) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<WeddingWsEvent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const onEventRef = useRef(onEvent);

  useEffect(() => { onEventRef.current = onEvent; }, [onEvent]);

  useEffect(() => {
    if (!enabled || !weddingId || !userId) return;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      try {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = `${proto}//${window.location.host}/ws?userId=${encodeURIComponent(userId)}&room=${encodeURIComponent(`wedding:${weddingId}`)}`;
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          if (disposed) return;
          setConnected(true);
          reconnectAttemptsRef.current = 0;
        };

        ws.onmessage = (msg) => {
          try {
            const data = JSON.parse(msg.data);
            // connection_established + presence-events ignoreres på wedding-siden
            if (!data?.type) return;
            if (data.type === 'connection_established' || data.type === 'presence_update') return;
            const evt: WeddingWsEvent = {
              type: data.type,
              payload: data.payload,
              timestamp: data.timestamp || new Date().toISOString(),
            };
            setLastEvent(evt);
            onEventRef.current?.(evt);
          } catch {
            // Ignorerer ugyldig payload
          }
        };

        ws.onclose = () => {
          if (disposed) return;
          setConnected(false);
          wsRef.current = null;
          // Exponential backoff: 1s, 2s, 4s, 8s, ..., max 30s
          const delay = Math.min(30000, 1000 * Math.pow(2, reconnectAttemptsRef.current));
          reconnectAttemptsRef.current += 1;
          reconnectTimerRef.current = setTimeout(connect, delay);
        };

        ws.onerror = () => {
          // Lar onclose håndtere reconnect
          try { ws.close(); } catch { /* ignore */ }
        };
      } catch (err) {
        console.warn('[wedding-ws] connect feilet:', err);
        const delay = Math.min(30000, 1000 * Math.pow(2, reconnectAttemptsRef.current));
        reconnectAttemptsRef.current += 1;
        reconnectTimerRef.current = setTimeout(connect, delay);
      }
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        try { wsRef.current.close(); } catch { /* ignore */ }
        wsRef.current = null;
      }
      setConnected(false);
    };
  }, [enabled, weddingId, userId]);

  return { connected, lastEvent };
}
