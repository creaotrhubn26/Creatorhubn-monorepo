/**
 * Real-time collaboration — workflow-audit G25/J1.
 *
 * Kobler til /ws/dance/realtime og lytter på presence-events. Når
 * andre brukere er i samme projectId-rom, vises de i FormationHeaderBar's
 * avatar-strip.
 *
 * Backend: backend/server/dance-realtime-server.ts (samme WS-server
 * pattern som websocket-chat.ts).
 *
 * Beta-begrensninger:
 *   - Auth er forenklet (userId fra query). Token-verifisering kommer
 *     i en senere PR.
 *   - Skala: in-memory per server-instance. Redis pub/sub for multi-
 *     instance er TODO.
 *   - CRDT-state-sync er IKKE implementert — bare presence + cursor.
 *     Autosave fortsetter å være source-of-truth for formasjons-data.
 */
import React from 'react';

export interface DancePresenceUser {
  userId: string;
  displayName: string;
  color: string;
  lastSeenMs: number;
}

export interface DancePresenceCursor {
  userId: string;
  x?: number;
  y?: number;
}

export interface UseDanceRealtimePresenceOptions {
  projectId: string | null;
  /** Egen userId (for "selv"-filtrering). Default 'anonymous' hvis ikke satt. */
  userId?: string;
  /** Egen visningsnavn. Default 'Anonymous'. */
  displayName?: string;
  /** Hopp over reell tilkobling — for tester. */
  disabled?: boolean;
}

export interface DanceRealtimeHandle {
  users: readonly DancePresenceUser[];
  cursors: readonly DancePresenceCursor[];
  /** Broadcast vår cursor til andre. Throttle anbefalt callsite-side. */
  broadcastCursor: (x: number | null, y: number | null) => void;
  /** True når socket er etablert. */
  connected: boolean;
}

function buildWsUrl(projectId: string, userId: string, displayName: string): string {
  if (typeof window === 'undefined') return '';
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const params = new URLSearchParams({
    projectId,
    userId,
    displayName,
  });
  return `${proto}//${host}/ws/dance/realtime?${params.toString()}`;
}

export function useDanceRealtimePresence(
  options: UseDanceRealtimePresenceOptions,
): DanceRealtimeHandle {
  const [users, setUsers] = React.useState<readonly DancePresenceUser[]>([]);
  const [cursors, setCursors] = React.useState<readonly DancePresenceCursor[]>([]);
  const [connected, setConnected] = React.useState<boolean>(false);
  const wsRef = React.useRef<WebSocket | null>(null);

  const userId = options.userId ?? 'anonymous';
  const displayName = options.displayName ?? 'Anonymous';

  React.useEffect(() => {
    if (options.disabled || !options.projectId) {
      setUsers([]);
      setCursors([]);
      setConnected(false);
      return;
    }
    const url = buildWsUrl(options.projectId, userId, displayName);
    if (!url) return;

    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let backoffMs = 1000;

    const connect = (): void => {
      if (cancelled) return;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.addEventListener('open', () => {
        if (cancelled) { ws.close(); return; }
        setConnected(true);
        backoffMs = 1000;
      });

      ws.addEventListener('message', (e) => {
        try {
          const msg = JSON.parse(typeof e.data === 'string' ? e.data : '');
          if (!msg || typeof msg !== 'object') return;
          switch (msg.type) {
            case 'presence:snapshot': {
              const list = Array.isArray(msg.users) ? msg.users : [];
              const now = Date.now();
              setUsers(list
                .filter((u: { userId?: unknown }) => typeof u.userId === 'string' && u.userId !== userId)
                .map((u: { userId: string; displayName?: string; color?: string }) => ({
                  userId: u.userId,
                  displayName: u.displayName ?? u.userId,
                  color: u.color ?? '#a78bfa',
                  lastSeenMs: now,
                })));
              break;
            }
            case 'presence:join': {
              if (typeof msg.userId !== 'string' || msg.userId === userId) return;
              const now = Date.now();
              setUsers((prev) => {
                if (prev.some((u) => u.userId === msg.userId)) return prev;
                return [...prev, {
                  userId: msg.userId,
                  displayName: msg.displayName ?? msg.userId,
                  color: msg.color ?? '#a78bfa',
                  lastSeenMs: now,
                }];
              });
              break;
            }
            case 'presence:leave': {
              if (typeof msg.userId !== 'string') return;
              setUsers((prev) => prev.filter((u) => u.userId !== msg.userId));
              setCursors((prev) => prev.filter((c) => c.userId !== msg.userId));
              break;
            }
            case 'cursor': {
              if (typeof msg.userId !== 'string' || msg.userId === userId) return;
              const x = typeof msg.x === 'number' ? msg.x : undefined;
              const y = typeof msg.y === 'number' ? msg.y : undefined;
              setCursors((prev) => {
                const filtered = prev.filter((c) => c.userId !== msg.userId);
                if (x == null && y == null) return filtered;
                return [...filtered, { userId: msg.userId, x, y }];
              });
              break;
            }
            default:
              break;
          }
        } catch {
          // ignore
        }
      });

      const onClose = (): void => {
        if (cancelled) return;
        setConnected(false);
        wsRef.current = null;
        // Exponential backoff opp til 30s
        reconnectTimer = setTimeout(() => {
          backoffMs = Math.min(backoffMs * 2, 30000);
          connect();
        }, backoffMs);
      };
      ws.addEventListener('close', onClose);
      ws.addEventListener('error', () => {
        // Lar 'close'-handleren ta reconnect
      });
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try { wsRef.current?.close(); } catch { /* ignore */ }
      wsRef.current = null;
      setConnected(false);
    };
  }, [options.disabled, options.projectId, userId, displayName]);

  const broadcastCursor = React.useCallback((x: number | null, y: number | null): void => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(JSON.stringify({ type: 'cursor', x, y }));
    } catch {
      // ignore
    }
  }, []);

  return { users, cursors, broadcastCursor, connected };
}
