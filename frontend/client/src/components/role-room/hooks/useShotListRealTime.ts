/**
 * hooks/useShotListRealTime.ts
 *
 * WebSocket-backed real-time collaboration for ShotList panels.
 *
 * Features
 * ────────
 *  • WebSocket connection per project  (room = projectId)
 *  • Typed events: ShotAssigned, ShotStatusChanged, ShotListCreated, ShotReordered
 *  • Soft-lock: per-shot edit indicator (locks Map<shotId, LockEntry>)
 *  • Audit log: ring buffer of the last 100 state-changing events
 *  • Presence: who else is currently viewing the panel
 *  • Exponential-backoff reconnect  (max 30 s)
 *  • Idempotent: own events are NOT re-applied to local state
 *  • Offline / dev fallback: if WS can't connect, the hook stays silent
 *
 * Usage
 * ─────
 *  const rt = useShotListRealTime({ projectId, userId, userName });
 *
 *  // Emit after local mutation:
 *  rt.emitShotAssigned({ shotListId, shotId, assigneeId, assigneeName });
 *
 *  // React to remote mutations in a useEffect:
 *  useEffect(() => {
 *    return rt.onRemoteEvent(event => {
 *      if (event.type === 'ShotReordered') applyShotOrder(event.payload);
 *    });
 *  }, [rt.onRemoteEvent]);
 *
 *  // Show soft-lock indicator on the shot editor:
 *  const lock = rt.locks.get(shotId);  // undefined = free
 *
 *  // Show audit trail:
 *  rt.auditLog   // AuditLogEntry[]  (newest first)
 *
 *  // Show who else is here:
 *  rt.presence   // Map<userId, PresenceEntry>
 *
 *  rt.connectionStatus  // 'connecting' | 'connected' | 'reconnecting' | 'offline'
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  SHOT_LIST_EVENT,
  ShotListEvent,
  ShotListEventType,
  ShotAssignedPayload,
  ShotStatusChangedPayload,
  ShotListCreatedPayload,
  ShotReorderedPayload,
  EditLockAcquiredPayload,
  AuditLogEntry,
  EventMeta,
  buildAuditEntry,
  makeEvent,
} from '../services/shotListEvents';

// ─── Configuration ────────────────────────────────────────────────────────────

/** Extend ImportMeta with Vite's env shape so we avoid @ts-ignore. */
interface ViteImportMeta extends ImportMeta {
  env?: { VITE_WS_URL?: string };
}

/** Read from Vite env; falls back to same host with ws(s): scheme. */
function resolveWsBase(): string {
  if (typeof import.meta !== 'undefined') {
    const env = (import.meta as ViteImportMeta).env;
    if (env?.VITE_WS_URL) return env.VITE_WS_URL;
  }
  if (typeof window !== 'undefined') {
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${scheme}://${window.location.host}`;
  }
  return 'ws://localhost:3001';
}

const AUDIT_LOG_MAX = 100;
const BACKOFF_BASE_MS = 1_000;
const BACKOFF_MAX_MS  = 30_000;
const PRESENCE_HEARTBEAT_MS = 15_000;

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline';

export interface LockEntry {
  userId:   string;
  userName: string;
  since:    string; // ISO timestamp
}

export interface PresenceEntry {
  userId:   string;
  userName: string;
  lastSeen: string; // ISO timestamp
}

type RemoteEventListener = (event: ShotListEvent) => void;

export interface UseShotListRealTimeOptions {
  projectId:  string;
  userId:     string;
  userName:   string;
  /** Disable WS entirely (e.g. read-only contexts). Default: false. */
  disabled?:  boolean;
}

export interface ShotListRealTimeAPI {
  connectionStatus: ConnectionStatus;
  /** per-shot soft locks — key is shotId */
  locks:     Map<string, LockEntry>;
  /** per-user presence — key is userId */
  presence:  Map<string, PresenceEntry>;
  /** audit trail, newest first, max 100 entries */
  auditLog:  AuditLogEntry[];

  // ── Emit helpers ──────────────────────────────────────────────────────────
  emitShotAssigned:      (payload: ShotAssignedPayload)      => void;
  emitShotStatusChanged: (payload: ShotStatusChangedPayload) => void;
  emitShotListCreated:   (payload: ShotListCreatedPayload)   => void;
  emitShotReordered:     (payload: ShotReorderedPayload)     => void;

  // ── Soft-lock helpers ─────────────────────────────────────────────────────
  acquireLock: (shotListId: string, shotId: string) => void;
  releaseLock: (shotListId: string, shotId: string) => void;
  /** true if the current user holds the lock on this shot */
  isLockedByMe: (shotId: string) => boolean;
  /** true if another user holds the lock on this shot */
  isLockedByOther: (shotId: string) => boolean;

  // ── Listen for remote events ──────────────────────────────────────────────
  /**
   * Register a listener for ALL incoming remote events (excluding own emissions).
   * Returns an unsubscribe function.
   */
  onRemoteEvent: (listener: RemoteEventListener) => () => void;

  /**
   * Register a listener for a SPECIFIC event type.
   * The listener receives a narrowed event payload — no manual type guards needed.
   * Returns an unsubscribe function.
   *
   * @example
   *   rt.subscribeToEvent('ShotReordered', ({ payload }) => applyOrder(payload.orderedShotIds));
   */
  subscribeToEvent: <T extends ShotListEventType>(
    type: T,
    listener: (event: Extract<ShotListEvent, { type: T }>) => void,
  ) => () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useShotListRealTime({
  projectId,
  userId,
  userName,
  disabled = false,
}: UseShotListRealTimeOptions): ShotListRealTimeAPI {

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [locks,    setLocks]    = useState<Map<string, LockEntry>>(new Map());
  const [presence, setPresence] = useState<Map<string, PresenceEntry>>(new Map());
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);

  // Internal refs — stable across renders
  const wsRef        = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Set<RemoteEventListener>>(new Set());
  const seenIdsRef   = useRef<Set<string>>(new Set());
  const retryRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const presenceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Append to audit log ──────────────────────────────────────────────────

  const appendAudit = useCallback((entry: AuditLogEntry) => {
    setAuditLog(prev => {
      const next = [entry, ...prev];
      return next.length > AUDIT_LOG_MAX ? next.slice(0, AUDIT_LOG_MAX) : next;
    });
  }, []);

  // ── Dispatch incoming event to all listeners ─────────────────────────────

  const dispatchRemote = useCallback((event: ShotListEvent) => {
    // Skip own events
    if (event.meta.originUserId === userId) return;
    // Idempotency
    if (seenIdsRef.current.has(event.meta.eventId)) return;
    seenIdsRef.current.add(event.meta.eventId);
    // Keep set bounded
    if (seenIdsRef.current.size > 2000) {
      const arr = [...seenIdsRef.current];
      seenIdsRef.current = new Set(arr.slice(arr.length - 1000));
    }

    // Handle internal side-effects first
    if (event.type === SHOT_LIST_EVENT.EditLockAcquired) {
      setLocks(prev => {
        const next = new Map(prev);
        next.set(event.payload.shotId, {
          userId:   event.meta.originUserId,
          userName: event.meta.originUserName,
          since:    event.meta.timestamp,
        });
        return next;
      });
    } else if (event.type === SHOT_LIST_EVENT.EditLockReleased) {
      setLocks(prev => {
        const next = new Map(prev);
        next.delete(event.payload.shotId);
        return next;
      });
    } else if (event.type === SHOT_LIST_EVENT.UserPresence) {
      if (event.payload.status === 'left') {
        setPresence(prev => {
          const next = new Map(prev);
          next.delete(event.meta.originUserId);
          return next;
        });
      } else {
        setPresence(prev => {
          const next = new Map(prev);
          next.set(event.meta.originUserId, {
            userId:   event.meta.originUserId,
            userName: event.meta.originUserName,
            lastSeen: event.meta.timestamp,
          });
          return next;
        });
      }
    }

    // Audit log
    const entry = buildAuditEntry(event);
    if (entry) appendAudit(entry);

    // Notify subscribers
    listenersRef.current.forEach(fn => fn(event));
  }, [userId, appendAudit]);

  // ── Send raw JSON over the socket ─────────────────────────────────────────

  const sendRaw = useCallback((event: ShotListEvent) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(event));
    }
    // If not connected, the event is local-only (still updates own UI via callers)
  }, []);

  // ── Build shared meta for outgoing events ────────────────────────────────

  const baseMeta = useCallback((): Omit<EventMeta, 'eventId' | 'timestamp'> => ({
    originUserId: userId,
    originUserName: userName,
    projectId,
  }), [userId, userName, projectId]);

  // ── Emit helpers ─────────────────────────────────────────────────────────

  const emitShotAssigned = useCallback((payload: ShotAssignedPayload) => {
    const ev = makeEvent('ShotAssigned', payload, baseMeta());
    const entry = buildAuditEntry(ev);
    if (entry) appendAudit(entry);
    sendRaw(ev);
  }, [baseMeta, sendRaw, appendAudit]);

  const emitShotStatusChanged = useCallback((payload: ShotStatusChangedPayload) => {
    const ev = makeEvent('ShotStatusChanged', payload, baseMeta());
    const entry = buildAuditEntry(ev);
    if (entry) appendAudit(entry);
    sendRaw(ev);
  }, [baseMeta, sendRaw, appendAudit]);

  const emitShotListCreated = useCallback((payload: ShotListCreatedPayload) => {
    const ev = makeEvent('ShotListCreated', payload, baseMeta());
    const entry = buildAuditEntry(ev);
    if (entry) appendAudit(entry);
    sendRaw(ev);
  }, [baseMeta, sendRaw, appendAudit]);

  const emitShotReordered = useCallback((payload: ShotReorderedPayload) => {
    const ev = makeEvent('ShotReordered', payload, baseMeta());
    const entry = buildAuditEntry(ev);
    if (entry) appendAudit(entry);
    sendRaw(ev);
  }, [baseMeta, sendRaw, appendAudit]);

  // ── Soft-lock helpers ─────────────────────────────────────────────────────

  const acquireLock = useCallback((shotListId: string, shotId: string) => {
    const lockPayload: EditLockAcquiredPayload = { shotListId, shotId };
    const ev = makeEvent(SHOT_LIST_EVENT.EditLockAcquired, lockPayload, baseMeta());
    // Apply locally (own lock)
    setLocks(prev => {
      const next = new Map(prev);
      next.set(shotId, { userId, userName, since: ev.meta.timestamp });
      return next;
    });
    sendRaw(ev);
  }, [baseMeta, sendRaw, userId, userName]);

  const releaseLock = useCallback((shotListId: string, shotId: string) => {
    const ev = makeEvent(SHOT_LIST_EVENT.EditLockReleased, { shotListId, shotId }, baseMeta());
    setLocks(prev => {
      const next = new Map(prev);
      next.delete(shotId);
      return next;
    });
    sendRaw(ev);
  }, [baseMeta, sendRaw]);

  const isLockedByMe = useCallback(
    (shotId: string) => locks.get(shotId)?.userId === userId,
    [locks, userId],
  );

  const isLockedByOther = useCallback(
    (shotId: string) => {
      const lock = locks.get(shotId);
      return !!lock && lock.userId !== userId;
    },
    [locks, userId],
  );

  // ── Subscribe to remote events ────────────────────────────────────────────

  const onRemoteEvent = useCallback((listener: RemoteEventListener): (() => void) => {
    listenersRef.current.add(listener);
    return () => listenersRef.current.delete(listener);
  }, []);

  /**
   * Typed per-event-type subscription. The listener receives a narrowed
   * event so no manual `event.type ===` guard is needed at the call site.
   */
  const subscribeToEvent = useCallback(<T extends ShotListEventType>(
    type: T,
    listener: (event: Extract<ShotListEvent, { type: T }>) => void,
  ): (() => void) => {
    const wrapped: RemoteEventListener = (event) => {
      if (event.type === type) {
        listener(event as Extract<ShotListEvent, { type: T }>);
      }
    };
    listenersRef.current.add(wrapped);
    return () => listenersRef.current.delete(wrapped);
  }, []);

  // ── WebSocket lifecycle ───────────────────────────────────────────────────

  // Stable callback refs — updated each render so the WS effect can call
  // the latest version of these callbacks without listing them as deps
  // (which would trigger unnecessary reconnections).
  const sendRawRef = useRef(sendRaw);
  sendRawRef.current = sendRaw;
  const baseMetaRef = useRef(baseMeta);
  baseMetaRef.current = baseMeta;
  const dispatchRemoteRef = useRef(dispatchRemote);
  dispatchRemoteRef.current = dispatchRemote;

  useEffect(() => {
    if (disabled || !projectId || !userId) return;

    let cancelled = false;

    function connect() {
      if (cancelled) return;

      const url = `${resolveWsBase()}/ws/shotlist/${encodeURIComponent(projectId)}`;
      let ws: WebSocket;

      try {
        ws = new WebSocket(url);
      } catch {
        scheduleReconnect();
        return;
      }

      wsRef.current = ws;
      setConnectionStatus(retryCountRef.current > 0 ? 'reconnecting' : 'connecting');

      ws.onopen = () => {
        if (cancelled) { ws.close(); return; }
        retryCountRef.current = 0;
        setConnectionStatus('connected');
        // Announce presence
        sendRawRef.current(makeEvent(SHOT_LIST_EVENT.UserPresence, { status: 'active' }, baseMetaRef.current()));
        // Start heartbeat
        presenceTimerRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            sendRawRef.current(makeEvent(SHOT_LIST_EVENT.UserPresence, { status: 'active' }, baseMetaRef.current()));
          }
        }, PRESENCE_HEARTBEAT_MS);
      };

      ws.onmessage = (evt) => {
        try {
          const event = JSON.parse(evt.data) as ShotListEvent;
          if (event?.type && event?.meta && event?.payload) {
            dispatchRemoteRef.current(event);
          }
        } catch {
          // malformed frame — ignore
        }
      };

      ws.onerror = () => { /* onclose handles reconnect */ };

      ws.onclose = () => {
        if (presenceTimerRef.current) clearInterval(presenceTimerRef.current);
        if (cancelled) return;
        setConnectionStatus('offline');
        scheduleReconnect();
      };
    }

    function scheduleReconnect() {
      if (cancelled) return;
      const delay = Math.min(
        BACKOFF_BASE_MS * 2 ** retryCountRef.current,
        BACKOFF_MAX_MS,
      );
      retryCountRef.current += 1;
      retryRef.current = setTimeout(connect, delay);
    }

    connect();

    return () => {
      cancelled = true;
      if (retryRef.current) clearTimeout(retryRef.current);
      if (presenceTimerRef.current) clearInterval(presenceTimerRef.current);
      // Announce departure before closing
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(
            JSON.stringify(makeEvent(SHOT_LIST_EVENT.UserPresence, { status: 'left' }, baseMetaRef.current())),
          );
        } catch { /* ignore */ }
        wsRef.current.close();
      }
      wsRef.current = null;
    };
  }, [projectId, userId, disabled]);

  return {
    connectionStatus,
    locks,
    presence,
    auditLog,
    emitShotAssigned,
    emitShotStatusChanged,
    emitShotListCreated,
    emitShotReordered,
    acquireLock,
    releaseLock,
    isLockedByMe,
    isLockedByOther,
    onRemoteEvent,
    subscribeToEvent,
  };
}
