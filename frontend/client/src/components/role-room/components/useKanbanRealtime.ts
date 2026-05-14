import { useEffect, useRef, useState, useCallback } from 'react';

interface RealtimeEvent {
  type: 'candidate_updated' | 'candidate_deleted' | 'reload' | 'pong';
  projectId?: string;
  candidateId?: string;
  data?: Record<string, unknown>;
}

export interface UseKanbanRealtimeReturn {
  connected: boolean;
}

const HEARTBEAT_MS = 25_000;
const INITIAL_DELAY_MS = 1_000;
const MAX_DELAY_MS = 30_000;
// Etter 5 raske feil gir vi opp og stopper reconnect-loopen. Hindrer
// "WebSocket is closed before the connection is established"-spam i
// console + UI-hang når backend ikke har WS-endepunkt (f.eks. om Render-
// instansen sover på free-tier). Bruker kan refresh siden for å prøve igjen.
const MAX_RAPID_FAILURES = 5;
const RAPID_FAILURE_WINDOW_MS = 60_000;

/**
 * Opens a WebSocket to `/ws?projectId=<id>` and calls
 * `onRemoteChange()` whenever a candidate update / reload event arrives.
 *
 * The hook handles:
 *  - Exponential-backoff reconnect on disconnect
 *  - Heartbeat ping every 25 s to keep the connection alive through load balancers
 *  - Graceful cleanup on unmount or projectId change
 *  - Silent fallback when the server has no WS endpoint (connect attempt just
 *    silently fails and the component continues to work normally)
 */
export function useKanbanRealtime(
  projectId: string | undefined,
  onRemoteChange: () => void,
): UseKanbanRealtimeReturn {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelayRef = useRef(INITIAL_DELAY_MS);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  // Sirkulærbuffer av timestamps for siste N feil. Brukes til å oppdage
  // "WS er knust"-state og slutte å prøve reconnect i den browser-sesjonen.
  const failureTimestampsRef = useRef<number[]>([]);
  const givenUpRef = useRef(false);
  // Keep callback stable so the connect closure always calls the latest version
  const onChangeRef = useRef(onRemoteChange);
  useEffect(() => { onChangeRef.current = onRemoteChange; }, [onRemoteChange]);

  const clearTimers = useCallback(() => {
    if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    heartbeatTimerRef.current = null;
    reconnectTimerRef.current = null;
  }, []);

  const connect = useCallback(() => {
    if (!projectId || !mountedRef.current) return;
    if (givenUpRef.current) return;

    // WebSockets can't go through Vercel's rewrite layer (HTTP-only),
    // so in production we dial the Render backend directly. In dev
    // the Vite dev server proxies /ws to the local backend, so the
    // same-origin path keeps working.
    const host = window.location.host;
    const isLocalDev = /^(localhost|127\.|\[?::1\]?|.+\.local)(?::\d+)?$/i.test(host);
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = isLocalDev
      ? host
      : 'creatorhub-backend-rtbl.onrender.com';
    const wsProtocol = isLocalDev ? protocol : 'wss:';
    const room = encodeURIComponent(`casting:${projectId}`);
    const userId = encodeURIComponent(`casting-ui-${projectId}`);
    const url = `${wsProtocol}//${wsHost}/ws?projectId=${encodeURIComponent(projectId)}&room=${room}&role=casting&userId=${userId}`;

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      // WS not supported / blocked — degrade gracefully
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) { ws.close(); return; }
      setConnected(true);
      reconnectDelayRef.current = INITIAL_DELAY_MS;
      heartbeatTimerRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping', projectId }));
        }
      }, HEARTBEAT_MS);
    };

    ws.onmessage = (event) => {
      try {
        const msg: RealtimeEvent = JSON.parse(event.data as string);
        if (
          msg.type === 'candidate_updated' ||
          msg.type === 'candidate_deleted' ||
          msg.type === 'reload'
        ) {
          onChangeRef.current();
        }
      } catch {
        // Ignore malformed frames
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setConnected(false);
      clearTimers();

      // Spor feilen og sjekk om vi er i en knust-state.
      const now = Date.now();
      const recent = failureTimestampsRef.current.filter(
        (t) => now - t < RAPID_FAILURE_WINDOW_MS,
      );
      recent.push(now);
      failureTimestampsRef.current = recent;
      if (recent.length >= MAX_RAPID_FAILURES) {
        givenUpRef.current = true;
        console.warn(
          '[useKanbanRealtime] gir opp WebSocket-reconnect etter ' +
            `${MAX_RAPID_FAILURES} feil på under ${RAPID_FAILURE_WINDOW_MS / 1000}s. ` +
            'Polling / manuell refresh anbefales.',
        );
        return;
      }

      // Exponential-backoff reconnect
      reconnectTimerRef.current = setTimeout(() => {
        if (!mountedRef.current || givenUpRef.current) return;
        reconnectDelayRef.current = Math.min(
          reconnectDelayRef.current * 2,
          MAX_DELAY_MS,
        );
        connect();
      }, reconnectDelayRef.current);
    };

    ws.onerror = () => {
      // onclose fires right after onerror — reconnect happens there
      ws.close();
    };
  }, [projectId, clearTimers]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      clearTimers();
      wsRef.current?.close();
    };
  }, [connect, clearTimers]);

  return { connected };
}
