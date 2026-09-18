/**
 * Sanntidsklient for Story Graph — rir på /ws-serverens rom-maskineri
 * (`websocket-chat.ts`, rom `narrative:<projectId>`), samme mønster som
 * services/liveSetRealtimeService.ts: bearer-token i handshake, reconnect
 * med backoff, presence-heartbeat, throttlet markør.
 *
 * Ingen CRDT: serveren pusher `narrative:graph_changed` ved mutasjoner, og
 * klienten laster grafen på nytt (debounced) når endringen kommer fra andre.
 */

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { authSessionService } from '../../services/authSessionService';
import { INITIAL_PRESENCE, presenceReducer, type PresenceState } from './presenceReducer';
import { pickPresenceColor } from './presenceColors';

export interface GraphChangedEvent {
  kind: string;
  ids: string[];
  actorUserId: string;
  at: string;
}

interface WsMessage {
  type: string;
  payload?: unknown;
  userId?: string;
  clientId?: string;
  timestamp?: string;
}

export interface NarrativeRealtimeOptions {
  projectId: string;
  userId: string;
  name: string;
  boardId: string | null;
  onGraphChanged?: (evt: GraphChangedEvent) => void;
  onConnectionChange?: (connected: boolean) => void;
  onMessage?: (msg: WsMessage) => void;
  /** Overstyrbar for tester. */
  wsBase?: string;
}

export const PRESENCE_TTL_MS = 60_000;
const HEARTBEAT_MS = 10_000;
const CURSOR_THROTTLE_MS = 50;

export class NarrativeRealtimeClient {
  private ws: WebSocket | null = null;
  private reconnectDelay = 1_000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  private lastCursorAt = 0;
  private pendingCursor: { boardId: string; x: number; y: number } | null = null;
  private cursorTimer: ReturnType<typeof setTimeout> | null = null;
  boardId: string | null;
  readonly color: string;

  constructor(private readonly opts: NarrativeRealtimeOptions, private readonly dispatch: (action: Parameters<typeof presenceReducer>[1]) => void) {
    this.boardId = opts.boardId;
    this.color = pickPresenceColor(opts.userId);
  }

  connect(): void {
    if (this.destroyed) return;
    const wsBase = this.opts.wsBase
      ?? (import.meta.env.VITE_WS_URL as string | undefined)
      ?? window.location.origin.replace(/^http/, 'ws');
    const token = authSessionService.getSessionTokenSync()
      || localStorage.getItem('creatorhub_auth_token') || localStorage.getItem('token') || localStorage.getItem('role_room_auth_token') || '';
    const url = `${wsBase}/ws?userId=${encodeURIComponent(this.opts.userId)}&room=${encodeURIComponent(`narrative:${this.opts.projectId}`)}&role=narrative${token ? `&token=${encodeURIComponent(token)}` : ''}`;
    try {
      this.ws = new WebSocket(url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws.addEventListener('open', () => {
      this.reconnectDelay = 1_000;
      this.opts.onConnectionChange?.(true);
      this.sendPresence();
    });
    this.ws.addEventListener('message', (evt) => {
      try {
        this.handle(JSON.parse(String(evt.data)) as WsMessage);
      } catch { /* ignorer ugyldig JSON */ }
    });
    this.ws.addEventListener('close', () => {
      this.opts.onConnectionChange?.(false);
      this.dispatch({ type: 'reset' });
      this.scheduleReconnect();
    });
    this.ws.addEventListener('error', () => { try { this.ws?.close(); } catch { /* ignore */ } });
  }

  disconnect(): void {
    this.destroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.cursorTimer) clearTimeout(this.cursorTimer);
    try { this.ws?.close(); } catch { /* ignore */ }
    this.ws = null;
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  setBoard(boardId: string | null): void {
    if (this.boardId === boardId) return;
    this.boardId = boardId;
    this.sendPresence();
  }

  sendPresence(): void {
    this.send('narrative:presence', { name: this.opts.name, color: this.color, boardId: this.boardId });
  }

  sendSelection(elementIds: string[]): void {
    this.send('narrative:selection', { elementIds: elementIds.slice(0, 50) });
  }

  /** Throttlet (50 ms) markørposisjon i flow-koordinater. */
  sendCursor(pos: { x: number; y: number }): void {
    if (!this.boardId) return;
    this.pendingCursor = { boardId: this.boardId, x: Math.round(pos.x), y: Math.round(pos.y) };
    const elapsed = Date.now() - this.lastCursorAt;
    if (elapsed >= CURSOR_THROTTLE_MS) { this.flushCursor(); return; }
    if (!this.cursorTimer) this.cursorTimer = setTimeout(() => this.flushCursor(), CURSOR_THROTTLE_MS - elapsed);
  }

  private flushCursor(): void {
    this.cursorTimer = null;
    if (!this.pendingCursor) return;
    this.lastCursorAt = Date.now();
    this.send('narrative:cursor', this.pendingCursor);
    this.pendingCursor = null;
  }

  private send(type: string, payload: unknown): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type, payload, timestamp: new Date().toISOString() }));
  }

  private handle(msg: WsMessage): void {
    const now = Date.now();
    const p = (msg.payload ?? {}) as Record<string, unknown>;
    switch (msg.type) {
      case 'connection_established':
        if (typeof p.clientId === 'string') this.dispatch({ type: 'connected', clientId: p.clientId });
        break;
      case 'narrative:presence_snapshot':
        this.dispatch({ type: 'snapshot', now, peers: Array.isArray(p.peers) ? (p.peers as Array<{ clientId: string; userId: string; presence: Record<string, unknown> | null }>) : [] });
        break;
      case 'narrative:presence':
        if (msg.clientId && msg.userId) this.dispatch({ type: 'presence', clientId: msg.clientId, userId: msg.userId, payload: p, now });
        break;
      case 'narrative:cursor':
        if (msg.clientId && msg.userId) this.dispatch({ type: 'cursor', clientId: msg.clientId, userId: msg.userId, payload: p as { boardId: string; x: number; y: number }, now });
        break;
      case 'narrative:selection':
        if (msg.clientId && msg.userId) this.dispatch({ type: 'selection', clientId: msg.clientId, userId: msg.userId, payload: p as { elementIds: string[] }, now });
        break;
      case 'narrative:graph_changed':
        this.opts.onGraphChanged?.({
          kind: String(p.kind ?? 'graph'), ids: Array.isArray(p.ids) ? (p.ids as string[]) : [],
          actorUserId: String(p.actorUserId ?? ''), at: String(p.at ?? msg.timestamp ?? ''),
        });
        break;
      default:
        break;
    }
    this.opts.onMessage?.(msg);
  }

  private scheduleReconnect(): void {
    if (this.destroyed) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30_000);
      this.connect();
    }, this.reconnectDelay);
  }
}

export interface UseNarrativeRealtimeOptions {
  projectId: string | null;
  userId: string | null;
  name: string;
  boardId: string | null;
  enabled?: boolean;
  onGraphChanged?: (evt: GraphChangedEvent) => void;
}

export interface UseNarrativeRealtimeResult {
  connected: boolean;
  presence: PresenceState;
  selfColor: string;
  sendCursor: (pos: { x: number; y: number }) => void;
  sendSelection: (elementIds: string[]) => void;
}

export function useNarrativeRealtime(opts: UseNarrativeRealtimeOptions): UseNarrativeRealtimeResult {
  const [presence, dispatch] = useReducer(presenceReducer, INITIAL_PRESENCE);
  const [connected, setConnected] = useState(false);
  const clientRef = useRef<NarrativeRealtimeClient | null>(null);
  const onGraphChangedRef = useRef(opts.onGraphChanged);
  onGraphChangedRef.current = opts.onGraphChanged;
  const enabled = opts.enabled !== false && !!opts.projectId && !!opts.userId;

  useEffect(() => {
    if (!enabled || !opts.projectId || !opts.userId) return;
    const client = new NarrativeRealtimeClient({
      projectId: opts.projectId, userId: opts.userId, name: opts.name, boardId: opts.boardId,
      onGraphChanged: (evt) => onGraphChangedRef.current?.(evt),
      onConnectionChange: setConnected,
    }, dispatch);
    clientRef.current = client;
    client.connect();
    const heartbeat = setInterval(() => client.sendPresence(), HEARTBEAT_MS);
    const expiry = setInterval(() => dispatch({ type: 'expire', now: Date.now(), ttlMs: PRESENCE_TTL_MS }), 5_000);
    return () => {
      clearInterval(heartbeat);
      clearInterval(expiry);
      client.disconnect();
      clientRef.current = null;
      dispatch({ type: 'reset' });
      setConnected(false);
    };
    // Navn/brett oppdateres uten reconnect (setBoard/sendPresence under).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, opts.projectId, opts.userId]);

  useEffect(() => { clientRef.current?.setBoard(opts.boardId); }, [opts.boardId]);

  const sendCursor = useCallback((pos: { x: number; y: number }) => clientRef.current?.sendCursor(pos), []);
  const sendSelection = useCallback((ids: string[]) => clientRef.current?.sendSelection(ids), []);

  return {
    connected, presence,
    selfColor: opts.userId ? pickPresenceColor(opts.userId) : PRESENCE_PALETTE_FALLBACK,
    sendCursor, sendSelection,
  };
}

const PRESENCE_PALETTE_FALLBACK = '#a78bfa';
