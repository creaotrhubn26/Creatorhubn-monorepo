import { describe, expect, it, vi } from 'vitest';
import { USER_EVENTS_PROTOCOL_VERSION } from '@shared/realtime-user-events-contract';
import { UserEventStreamMultiplexer, decodeUserEventFrame } from '@/lib/userEventStreamMultiplexer';
import { buildTicketedUserEventsWsUrl } from './useUserEventStream';

describe('buildTicketedUserEventsWsUrl', () => {
  it('uses a ticket query parameter and never adds a long-lived token', () => {
    vi.stubGlobal('window', {
      location: {
        host: '127.0.0.1:5001',
        hostname: '127.0.0.1',
        protocol: 'http:',
      },
    });

    const value = buildTicketedUserEventsWsUrl('single-use-ticket');
    expect(value).not.toBeNull();
    const url = new URL(value!);
    expect(url.pathname).toBe('/api/ipad/ws/events');
    expect(url.searchParams.get('ticket')).toBe('single-use-ticket');
    expect(url.searchParams.has('token')).toBe(false);

    vi.unstubAllGlobals();
  });
});

describe('decodeUserEventFrame', () => {
  it('unwraps the versioned backend user_event envelope', () => {
    expect(
      decodeUserEventFrame(
        JSON.stringify({
          version: USER_EVENTS_PROTOCOL_VERSION,
          type: 'user_event',
          event: { kind: 'board.updated', projectId: 'project-1' },
        }),
      ),
    ).toEqual({ kind: 'board.updated', projectId: 'project-1' });
  });

  it('accepts unversioned legacy frames during rolling deploys', () => {
    expect(
      decodeUserEventFrame(
        JSON.stringify({
          kind: 'gallery.selection-submitted',
          galleryId: 'gallery-1',
        }),
      ),
    ).toMatchObject({
      kind: 'gallery.selection-submitted',
      galleryId: 'gallery-1',
    });
  });

  it('drops unsupported protocol versions and malformed control frames', () => {
    expect(
      decodeUserEventFrame(
        JSON.stringify({
          version: 2,
          type: 'user_event',
          event: { kind: 'board.updated', projectId: 'project-1' },
        }),
      ),
    ).toBeNull();
    expect(decodeUserEventFrame('{')).toBeNull();
    expect(
      decodeUserEventFrame(
        JSON.stringify({
          version: 1,
          type: 'connection_established',
        }),
      ),
    ).toBeNull();
  });
});

class FakeSocket {
  private listeners = new Map<string, Array<(event: any) => void>>();
  close = vi.fn(() => this.emit('close'));

  addEventListener(type: string, listener: (event: any) => void): void {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  emit(type: string, event: any = {}): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

describe('UserEventStreamMultiplexer', () => {
  it('shares one socket across subscribers and fans events out', async () => {
    const socket = new FakeSocket();
    const createSocket = vi.fn(() => socket);
    const requestTicket = vi.fn(async () => ({
      ticket: 'short-lived',
      expiresAt: new Date(Date.now() + 30_000).toISOString(),
      websocketPath: '/api/ipad/ws/events',
      protocolVersion: USER_EVENTS_PROTOCOL_VERSION,
    }));
    const stream = new UserEventStreamMultiplexer({
      requestTicket,
      buildUrl: (ticket) => `wss://example.test/events?ticket=${ticket}`,
      createSocket,
    });
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribeFirst = stream.subscribe({ onEvent: first });
    const unsubscribeSecond = stream.subscribe({ onEvent: second });

    await vi.waitFor(() => expect(createSocket).toHaveBeenCalledTimes(1));
    expect(requestTicket).toHaveBeenCalledTimes(1);
    socket.emit('open');
    socket.emit('message', {
      data: JSON.stringify({
        version: 1,
        type: 'user_event',
        event: { kind: 'board.updated', projectId: 'p-1', timestamp: 'now' },
      }),
    });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);

    unsubscribeFirst();
    expect(socket.close).not.toHaveBeenCalled();
    unsubscribeSecond();
    expect(socket.close).toHaveBeenCalledTimes(1);
  });

  it('signals a full refresh only after a real reconnect', async () => {
    vi.useFakeTimers();
    const sockets: FakeSocket[] = [];
    const stream = new UserEventStreamMultiplexer({
      requestTicket: async () => ({
        ticket: `ticket-${sockets.length}`,
        expiresAt: new Date(Date.now() + 30_000).toISOString(),
        websocketPath: '/api/ipad/ws/events',
        protocolVersion: USER_EVENTS_PROTOCOL_VERSION,
      }),
      buildUrl: (ticket) => `wss://example.test/events?ticket=${ticket}`,
      createSocket: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket;
      },
    });
    const onReconnect = vi.fn();
    const unsubscribe = stream.subscribe({ onEvent: vi.fn(), onReconnect });
    await vi.advanceTimersByTimeAsync(0);
    sockets[0].emit('open');
    expect(onReconnect).not.toHaveBeenCalled();

    sockets[0].emit('close');
    await vi.advanceTimersByTimeAsync(1_000);
    sockets[1].emit('open');
    expect(onReconnect).toHaveBeenCalledTimes(1);

    unsubscribe();
    vi.useRealTimers();
  });

  it('ignores a stale ticket failure after the subscriber generation changes', async () => {
    let rejectFirst!: (reason?: unknown) => void;
    const socket = new FakeSocket();
    const createSocket = vi.fn(() => socket);
    const requestTicket = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            rejectFirst = reject;
          }),
      )
      .mockResolvedValue({
        ticket: 'fresh-ticket',
        expiresAt: new Date(Date.now() + 30_000).toISOString(),
        websocketPath: '/api/ipad/ws/events',
        protocolVersion: USER_EVENTS_PROTOCOL_VERSION,
      });
    const stream = new UserEventStreamMultiplexer({
      requestTicket,
      buildUrl: (ticket) => `wss://example.test/events?ticket=${ticket}`,
      createSocket,
    });

    const unsubscribeFirst = stream.subscribe({ onEvent: vi.fn() });
    await vi.waitFor(() => expect(requestTicket).toHaveBeenCalledTimes(1));
    unsubscribeFirst();

    const statuses = vi.fn();
    const unsubscribeSecond = stream.subscribe({
      onEvent: vi.fn(),
      onStatusChange: statuses,
    });
    await vi.waitFor(() => expect(createSocket).toHaveBeenCalledTimes(1));
    socket.emit('open');

    rejectFirst(new Error('stale request failed'));
    await Promise.resolve();
    expect(statuses).not.toHaveBeenCalledWith('disconnected');

    unsubscribeSecond();
  });
});
