import {
  USER_EVENTS_PROTOCOL_VERSION,
  isSupportedUserEventsVersion,
  type UserEvent,
  type UserEventsTicketResponse,
} from '@shared/realtime-user-events-contract';

export type UserEventStreamStatus = 'disabled' | 'connecting' | 'connected' | 'disconnected';

export interface UserEventStreamSubscriber {
  onEvent: (event: UserEvent) => void;
  onStatusChange?: (status: UserEventStreamStatus) => void;
  onReconnect?: () => void;
}

interface WebSocketLike {
  addEventListener(type: 'open', listener: () => void): void;
  addEventListener(type: 'message', listener: (event: { data?: unknown }) => void): void;
  addEventListener(type: 'close' | 'error', listener: () => void): void;
  close(): void;
}

interface UserEventStreamDependencies {
  requestTicket: () => Promise<UserEventsTicketResponse>;
  buildUrl: (ticket: string, websocketPath: string) => string | null;
  createSocket: (url: string) => WebSocketLike;
  setTimer?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
}

export function decodeUserEventFrame(raw: string): UserEvent | null {
  try {
    const payload = JSON.parse(raw) as Record<string, unknown>;
    if (!isSupportedUserEventsVersion(payload.version)) return null;
    const event = payload.type === 'user_event' && payload.event && typeof payload.event === 'object'
      ? payload.event as Record<string, unknown>
      : payload;
    return typeof event.kind === 'string' ? event as UserEvent : null;
  } catch {
    return null;
  }
}

/**
 * One instance is shared by every hook in a browser tab. Subscribers are
 * multiplexed over one ticketed WebSocket and independently receive events,
 * status changes, and the reconnect signal used to refetch missed state.
 */
export class UserEventStreamMultiplexer {
  private readonly subscribers = new Map<symbol, UserEventStreamSubscriber>();
  private readonly setTimer: NonNullable<UserEventStreamDependencies['setTimer']>;
  private readonly clearTimer: NonNullable<UserEventStreamDependencies['clearTimer']>;
  private socket: WebSocketLike | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private status: UserEventStreamStatus = 'disabled';
  private attempts = 0;
  private generation = 0;
  private connecting = false;
  private hasConnected = false;

  constructor(private readonly dependencies: UserEventStreamDependencies) {
    this.setTimer = dependencies.setTimer ?? ((callback, delay) => setTimeout(callback, delay));
    this.clearTimer = dependencies.clearTimer ?? ((timer) => clearTimeout(timer));
  }

  subscribe(subscriber: UserEventStreamSubscriber): () => void {
    const id = Symbol('user-event-subscriber');
    this.subscribers.set(id, subscriber);
    subscriber.onStatusChange?.(this.subscribers.size === 1 ? 'connecting' : this.status);
    if (this.subscribers.size === 1) void this.connect();

    return () => {
      this.subscribers.delete(id);
      if (this.subscribers.size === 0) this.stop();
    };
  }

  subscriberCountForTests(): number {
    return this.subscribers.size;
  }

  private updateStatus(next: UserEventStreamStatus): void {
    this.status = next;
    for (const subscriber of this.subscribers.values()) {
      subscriber.onStatusChange?.(next);
    }
  }

  private async connect(): Promise<void> {
    if (this.subscribers.size === 0 || this.connecting || this.socket) return;
    this.connecting = true;
    const generation = this.generation;
    this.updateStatus('connecting');

    let ticketResponse: UserEventsTicketResponse;
    try {
      ticketResponse = await this.dependencies.requestTicket();
    } catch (cause: any) {
      if (generation !== this.generation || this.subscribers.size === 0) return;
      this.connecting = false;
      this.updateStatus('disconnected');
      if (cause?.status !== 401 && cause?.status !== 403) this.scheduleReconnect();
      return;
    }
    if (generation !== this.generation || this.subscribers.size === 0) {
      if (generation === this.generation) this.connecting = false;
      return;
    }
    if (ticketResponse.protocolVersion !== USER_EVENTS_PROTOCOL_VERSION) {
      this.connecting = false;
      this.updateStatus('disconnected');
      return;
    }

    const websocketUrl = this.dependencies.buildUrl(
      ticketResponse.ticket,
      ticketResponse.websocketPath,
    );
    if (!websocketUrl) {
      this.connecting = false;
      this.updateStatus('disconnected');
      return;
    }

    let socket: WebSocketLike;
    try {
      socket = this.dependencies.createSocket(websocketUrl);
    } catch {
      this.connecting = false;
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;
    this.connecting = false;

    socket.addEventListener('open', () => {
      if (generation !== this.generation || socket !== this.socket) return;
      const reconnected = this.hasConnected;
      this.hasConnected = true;
      this.attempts = 0;
      this.updateStatus('connected');
      if (reconnected) {
        for (const subscriber of this.subscribers.values()) subscriber.onReconnect?.();
      }
    });
    socket.addEventListener('message', (message) => {
      if (generation !== this.generation || socket !== this.socket) return;
      const event = decodeUserEventFrame(String(message.data ?? ''));
      if (!event) return;
      for (const subscriber of this.subscribers.values()) subscriber.onEvent(event);
    });
    socket.addEventListener('close', () => {
      if (generation !== this.generation || socket !== this.socket) return;
      this.socket = null;
      this.scheduleReconnect();
    });
    socket.addEventListener('error', () => {
      try { socket.close(); } catch { /* close handler schedules retry */ }
    });
  }

  private scheduleReconnect(): void {
    if (this.subscribers.size === 0 || this.reconnectTimer) return;
    this.updateStatus('disconnected');
    const delay = Math.min(30_000, 1_000 * (2 ** Math.min(this.attempts, 5)));
    this.attempts += 1;
    this.reconnectTimer = this.setTimer(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delay);
  }

  private stop(): void {
    this.generation += 1;
    this.connecting = false;
    this.attempts = 0;
    this.hasConnected = false;
    if (this.reconnectTimer) this.clearTimer(this.reconnectTimer);
    this.reconnectTimer = null;
    const socket = this.socket;
    this.socket = null;
    try { socket?.close(); } catch { /* already closed */ }
    this.status = 'disabled';
  }
}
