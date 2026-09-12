import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { buildEventsWsUrl } from '@/lib/realtimeWsUrl';
import type { UserEvent, UserEventsTicketResponse } from '@shared/realtime-user-events-contract';
import { UserEventStreamMultiplexer, type UserEventStreamStatus } from '@/lib/userEventStreamMultiplexer';

export type RealtimeUserEvent = UserEvent;
export type { UserEventStreamStatus } from '@/lib/userEventStreamMultiplexer';
export { decodeUserEventFrame } from '@/lib/userEventStreamMultiplexer';

interface UseUserEventStreamOptions {
  enabled?: boolean;
  onEvent: (event: RealtimeUserEvent) => void;
  onStatusChange?: (status: UserEventStreamStatus) => void;
  onReconnect?: () => void;
}

export function buildTicketedUserEventsWsUrl(ticket: string, websocketPath = '/api/ipad/ws/events'): string | null {
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

const tabUserEventStream = new UserEventStreamMultiplexer({
  requestTicket: async () =>
    apiRequest('/api/realtime/user-events-ticket', {
      method: 'POST',
      headers: {
        'X-CreatorHub-Client': 'web',
        'X-CreatorHub-Client-Version':
          typeof __CREATORHUB_BUILD_VERSION__ === 'string' ? __CREATORHUB_BUILD_VERSION__ : 'unknown',
      },
    }) as Promise<UserEventsTicketResponse>,
  buildUrl: buildTicketedUserEventsWsUrl,
  createSocket: (url) => new WebSocket(url),
});

/**
 * Subscribe to the tab-local user-event stream. All hook consumers in the
 * current browser tab share one ticket request, one socket and one reconnect
 * loop; callbacks remain independent.
 */
export function useUserEventStream({
  enabled = true,
  onEvent,
  onStatusChange,
  onReconnect,
}: UseUserEventStreamOptions): UserEventStreamStatus {
  const [status, setStatus] = useState<UserEventStreamStatus>(enabled ? 'connecting' : 'disabled');
  const onEventRef = useRef(onEvent);
  const onStatusChangeRef = useRef(onStatusChange);
  const onReconnectRef = useRef(onReconnect);
  onEventRef.current = onEvent;
  onStatusChangeRef.current = onStatusChange;
  onReconnectRef.current = onReconnect;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      setStatus('disabled');
      onStatusChangeRef.current?.('disabled');
      return;
    }
    return tabUserEventStream.subscribe({
      onEvent: (event) => onEventRef.current(event),
      onStatusChange: (next) => {
        setStatus(next);
        onStatusChangeRef.current?.(next);
      },
      onReconnect: () => onReconnectRef.current?.(),
    });
  }, [enabled]);

  return status;
}

export default useUserEventStream;
