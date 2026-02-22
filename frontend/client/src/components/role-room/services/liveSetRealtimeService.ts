/**
 * liveSetRealtimeService.ts
 * ────────────────────────────────────────────────────────────────────────────
 * Studio-tier WebSocket client for Live Set Mode.
 *
 * Overlays a "Live Set room" protocol on top of the existing /ws chat server
 * (websocket-chat.ts). Each combination of projectId+shootingDayId forms one
 * "room". The server side is extended in backend/server/websocket-chat.ts.
 *
 * Message types this client sends:
 *   liveset:join       — join a room (sent on connect)
 *   liveset:roll       — ROLL button pressed
 *   liveset:cut        — CUT called (with status + metadata)
 *   liveset:circle     — take circled
 *   liveset:note       — note added
 *   liveset:setup_done — setup marked complete
 *   liveset:cursor     — presence heartbeat (who is looking at what scene)
 *
 * Message types this client receives:
 *   connection_established
 *   presence_update         — another user joined/left
 *   liveset:state_snapshot  — full state sync on first join
 *   liveset:roll            — relayed from another client
 *   liveset:cut             — relayed from another client
 *   liveset:circle          — relayed
 *   liveset:note            — relayed
 *   liveset:setup_done      — relayed
 *   liveset:cursor          — presence position
 *
 * Usage (React component):
 *   const rt = useLiveSetRealtime({ projectId, shootingDayId, userId, role, onMessage });
 *   rt.send('liveset:roll', { sceneId, shotId });
 *   rt.disconnect();
 */

// ─── Message type helpers ─────────────────────────────────────────────────────

export type LiveSetMsgType =
  | 'connection_established'
  | 'presence_update'
  | 'liveset:join'
  | 'liveset:state_snapshot'
  | 'liveset:roll'
  | 'liveset:cut'
  | 'liveset:circle'
  | 'liveset:note'
  | 'liveset:setup_done'
  | 'liveset:cursor';

export interface LiveSetWsMessage<T = unknown> {
  type:          LiveSetMsgType;
  payload:       T;
  userId?:       string;
  projectId?:    string;
  shootingDayId?: string;
  timestamp:     string;
}

// ─── Presence entry ─────────────────────────────────────────────────────────

export interface PresenceEntry {
  userId:    string;
  role:      string;
  name?:     string;
  activeScene?: string;
  lastSeen:  string; // ISO
}

// ─── Service class ────────────────────────────────────────────────────────────

export class LiveSetRealtimeService {
  private ws:              WebSocket | null = null;
  private projectId:       string;
  private shootingDayId:   string;
  private userId:          string;
  private role:            string;
  private reconnectDelay:  number    = 1_000;
  private reconnectTimer:  ReturnType<typeof setTimeout> | null = null;
  private destroyed:       boolean   = false;

  /** Map of userId → PresenceEntry, updated by presence messages */
  readonly presence = new Map<string, PresenceEntry>();

  onMessage: ((msg: LiveSetWsMessage) => void) | null = null;
  onPresenceChange: ((presence: Map<string, PresenceEntry>) => void) | null = null;
  onConnectionChange: ((connected: boolean) => void) | null = null;

  constructor(options: {
    projectId:       string;
    shootingDayId:   string;
    userId:          string;
    role:            string;
    onMessage?:      (msg: LiveSetWsMessage) => void;
    onPresenceChange?: (presence: Map<string, PresenceEntry>) => void;
    onConnectionChange?: (connected: boolean) => void;
  }) {
    this.projectId     = options.projectId;
    this.shootingDayId = options.shootingDayId;
    this.userId        = options.userId;
    this.role          = options.role;
    this.onMessage           = options.onMessage     ?? null;
    this.onPresenceChange    = options.onPresenceChange ?? null;
    this.onConnectionChange  = options.onConnectionChange ?? null;
  }

  // ── Connection ─────────────────────────────────────────────────────────────

  connect(): void {
    if (this.destroyed) return;
    const wsBase = import.meta.env.VITE_WS_URL
      ?? window.location.origin.replace(/^http/, 'ws');
    const url = `${wsBase}/ws?userId=${encodeURIComponent(this.userId)}&room=liveset:${this.projectId}:${this.shootingDayId}&role=${encodeURIComponent(this.role)}`;

    try {
      this.ws = new WebSocket(url);
    } catch {
      this._scheduleReconnect();
      return;
    }

    this.ws.addEventListener('open', () => {
      this.reconnectDelay = 1_000;
      this.onConnectionChange?.(true);
      // Announce join
      this._send('liveset:join', {
        projectId:     this.projectId,
        shootingDayId: this.shootingDayId,
        role:          this.role,
      });
    });

    this.ws.addEventListener('message', (ev) => {
      try {
        const msg = JSON.parse(ev.data as string) as LiveSetWsMessage;
        this._handleMessage(msg);
      } catch { /* malformed — ignore */ }
    });

    this.ws.addEventListener('close', () => {
      this.onConnectionChange?.(false);
      if (!this.destroyed) this._scheduleReconnect();
    });

    this.ws.addEventListener('error', () => {
      this.ws?.close();
    });
  }

  disconnect(): void {
    this.destroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }

  // ── Send ───────────────────────────────────────────────────────────────────

  send(type: LiveSetMsgType, payload: unknown): void {
    this._send(type, payload);
  }

  // ── Presence heartbeat ─────────────────────────────────────────────────────

  /** Call periodically (e.g. every 10 s) to broadcast cursor position */
  sendCursor(activeScene?: string): void {
    this._send('liveset:cursor', {
      userId: this.userId,
      role:   this.role,
      activeScene,
    });
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private _send(type: LiveSetMsgType | string, payload: unknown): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    const msg: LiveSetWsMessage = {
      type:          type as LiveSetMsgType,
      payload,
      userId:        this.userId,
      projectId:     this.projectId,
      shootingDayId: this.shootingDayId,
      timestamp:     new Date().toISOString(),
    };
    this.ws.send(JSON.stringify(msg));
  }

  private _handleMessage(msg: LiveSetWsMessage): void {
    // Update presence map
    if (msg.type === 'presence_update' || msg.type === 'liveset:cursor') {
      const p = msg.payload as Partial<PresenceEntry>;
      if (p.userId) {
        this.presence.set(p.userId, {
          userId:      p.userId,
          role:        p.role ?? 'guest',
          name:        p.name,
          activeScene: p.activeScene,
          lastSeen:    msg.timestamp,
        });
        this.onPresenceChange?.(new Map(this.presence));
      }
    }

    this.onMessage?.(msg);
  }

  private _scheduleReconnect(): void {
    if (this.destroyed) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30_000);
      this.connect();
    }, this.reconnectDelay);
  }

  // ── Read-only accessors ───────────────────────────────────────────────────

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get activeUsers(): PresenceEntry[] {
    const cutoff = Date.now() - 60_000; // 60s TTL
    return [...this.presence.values()].filter(
      p => new Date(p.lastSeen).getTime() > cutoff,
    );
  }
}

// ─── React hook ──────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';

export interface UseLiveSetRealtimeOptions {
  projectId:       string;
  shootingDayId:   string;
  userId:          string;
  role:            string;
  onMessage:       (msg: LiveSetWsMessage) => void;
  onPresenceChange?: (presence: Map<string, PresenceEntry>) => void;
  /** If false, skip connecting entirely (e.g. offline-only mode) */
  enabled?:        boolean;
}

export interface UseLiveSetRealtimeReturn {
  connected:    boolean;
  activeUsers:  PresenceEntry[];
  send:         (type: LiveSetMsgType, payload: unknown) => void;
  sendCursor:   (activeScene?: string) => void;
}

export function useLiveSetRealtime(opts: UseLiveSetRealtimeOptions): UseLiveSetRealtimeReturn {
  const [connected, setConnected] = useState(false);
  const [activeUsers, setActiveUsers] = useState<PresenceEntry[]>([]);
  const svcRef = useRef<LiveSetRealtimeService | null>(null);

  useEffect(() => {
    if (opts.enabled === false) return;

    const svc = new LiveSetRealtimeService({
      projectId:     opts.projectId,
      shootingDayId: opts.shootingDayId,
      userId:        opts.userId,
      role:          opts.role,
      onMessage:     opts.onMessage,
      onPresenceChange: (presence) => {
        setActiveUsers(
          [...presence.values()].filter(p => Date.now() - new Date(p.lastSeen).getTime() < 60_000),
        );
        opts.onPresenceChange?.(presence);
      },
      onConnectionChange: setConnected,
    });

    svcRef.current = svc;
    svc.connect();

    // Presence heartbeat every 10 s
    const heartbeat = setInterval(() => svc.sendCursor(), 10_000);

    return () => {
      clearInterval(heartbeat);
      svc.disconnect();
      svcRef.current = null;
    };
  }, [opts.projectId, opts.shootingDayId, opts.userId, opts.role, opts.enabled]);

  return {
    connected,
    activeUsers,
    send:       (type, payload) => svcRef.current?.send(type, payload),
    sendCursor: (scene)          => svcRef.current?.sendCursor(scene),
  };
}
