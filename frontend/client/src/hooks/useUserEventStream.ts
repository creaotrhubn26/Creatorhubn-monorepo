import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { buildEventsWsUrl } from '@/lib/realtimeWsUrl';

export interface RealtimeUserEvent {
  kind: string;
  projectId?: string;
  channelId?: string;
  [key: string]: unknown;
}

export type UserEventStreamStatus = 'disabled' | 'connecting' | 'connected' | 'disconnected';

interface UserEventsTicketResponse {
  ticket: string;
  expiresAt: string;
  websocketPath: string;
}

interface UseUserEventStreamOptions {
  enabled?: boolean;
  onEvent: (event: RealtimeUserEvent) => void;
  onStatusChange?: (status: UserEventStreamStatus) => void;
}

export function decodeUserEventFrame(raw: string): RealtimeUserEvent | null {
  try {
    const payload = JSON.parse(raw) as Record<string, unknown>;
    const event = payload?.type === 'user_event' && payload.event && typeof payload.event === 'object'
      ? payload.event as RealtimeUserEvent
      : payload;
    return typeof event?.kind === 'string' ? event as RealtimeUserEvent : null;
  } catch {
    return null;
  }
}

export function buildTicketedUserEventsWsUrl(
  ticket: string,
  websocketPath = '/api/ipad/ws/events',
): string | null {
  const base = buildEventsWsUrl(websocketPath);
  if (!base || !ticket.trim()) return null;
  try {
    const url = new URL(base);
    url.searchParams.set('ticket', ticket.trim());
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Opens the authenticated per-user event channel without placing the durable
 * session token in the WebSocket URL. Every connect/reconnect first exchanges
 * the normal Authorization header for a 30-second, single-use ticket.
 */
export function useUserEventStream({
  enabled = true,
  onEvent,
  onStatusChange,
}: UseUserEventStreamOptions): UserEventStreamStatus {
  const [status, setStatus] = useState<UserEventStreamStatus>(enabled ? 'connecting' : 'disabled');
  const onEventRef = useRef(onEvent);
  const onStatusChangeRef = useRef(onStatusChange);
  onEventRef.current = onEvent;
  onStatusChangeRef.current = onStatusChange;

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    let attempts = 0;

    const updateStatus = (next: UserEventStreamStatus) => {
      if (cancelled) return;
      setStatus(next);
      onStatusChangeRef.current?.(next);
    };

    const scheduleReconnect = () => {
      if (cancelled || reconnectTimer) return;
      updateStatus('disconnected');
      const delay = Math.min(30_000, 1_000 * (2 ** Math.min(attempts, 5)));
      attempts += 1;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        void connect();
      }, delay);
    };

    const connect = async () => {
      if (cancelled) return;
      updateStatus('connecting');
      let ticketResponse: UserEventsTicketResponse;
      try {
        ticketResponse = await apiRequest('/api/realtime/user-events-ticket', { method: 'POST' }) as UserEventsTicketResponse;
      } catch (cause: any) {
        updateStatus('disconnected');
        // Repeated auth failures cannot recover through a socket reconnect.
        if (cause?.status !== 401 && cause?.status !== 403) scheduleReconnect();
        return;
      }
      if (cancelled) return;

      const websocketUrl = buildTicketedUserEventsWsUrl(
        ticketResponse.ticket,
        ticketResponse.websocketPath,
      );
      if (!websocketUrl) {
        updateStatus('disconnected');
        return;
      }

      try {
        socket = new WebSocket(websocketUrl);
      } catch {
        scheduleReconnect();
        return;
      }
      socket.addEventListener('open', () => {
        attempts = 0;
        updateStatus('connected');
      });
      socket.addEventListener('message', (message) => {
        const event = decodeUserEventFrame(String(message.data ?? ''));
        if (event) onEventRef.current(event);
      });
      socket.addEventListener('close', () => {
        socket = null;
        scheduleReconnect();
      });
      socket.addEventListener('error', () => {
        try { socket?.close(); } catch { /* close event schedules retry */ }
      });
    };

    if (!enabled || typeof window === 'undefined') {
      setStatus('disabled');
      onStatusChangeRef.current?.('disabled');
      return () => { cancelled = true; };
    }

    void connect();
    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try { socket?.close(); } catch { /* already closed */ }
    };
  }, [enabled]);

  return status;
}

export default useUserEventStream;
