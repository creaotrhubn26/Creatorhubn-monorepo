/**
 * Opt-in ergonomics telemetry hook.
 *
 * Tracks the cognitive cost of the photographer's work so CreatorHub
 * can remove the parts that drain them — decision fatigue on long
 * culls, indecision loops on near-duplicates, session-level reflect
 * answers. The raw event stream is:
 *
 *   view     — an asset came into focus (gallery card hovered,
 *              fullscreen opened, or listed as the current selection).
 *   decide   — photographer marked the asset (hero / keep / weak /
 *              reject / rating / flag).
 *   reverse  — photographer flipped a prior decision on the same
 *              asset mid-session. Strong indecision signal.
 *   pause    — explicit break (tab hidden for >2 min, or user pressed
 *              "I need a moment"). Optional; helps the fatigue curve
 *              reset its drift baseline.
 *   session_start / session_end — bookends.
 *
 * Design points:
 *   * Opt-in. Nothing is recorded until the photographer flips the
 *     single switch in their preferences. localStorage flag. The
 *     hook short-circuits to a noop when the flag is off.
 *   * Locally buffered. Events queue in memory; we flush every 30s
 *     in a batch POST to ``/api/telemetry/culling-session``. If the
 *     flush fails we keep the buffer and retry on next interval.
 *   * No asset contents leave the client — only opaque asset IDs
 *     and timing data.
 *   * Session IDs are client-side UUIDs so even if a user toggles
 *     the opt-in on mid-session, we never mix their anonymous-era
 *     events with their opted-in-era events.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { apiRequest } from '@/lib/queryClient';

const STORAGE_KEY_ENABLED = 'creatorhub.ergonomics.enabled';
const STORAGE_KEY_SESSION = 'creatorhub.ergonomics.sessionId';
const FLUSH_INTERVAL_MS = 30_000;

export type ErgonomicsEventKind =
  | 'session_start'
  | 'view'
  | 'decide'
  | 'reverse'
  | 'pause'
  | 'session_end';

export interface ErgonomicsEvent {
  sessionId: string;
  kind: ErgonomicsEventKind;
  ms: number;
  sequence: number;
  assetId?: string | null;
  action?: string | null;
  previousAction?: string | null;
  newAction?: string | null;
  firstView?: boolean;
}

export function isErgonomicsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(STORAGE_KEY_ENABLED) === '1';
  } catch {
    return false;
  }
}

export function setErgonomicsEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (enabled) {
      localStorage.setItem(STORAGE_KEY_ENABLED, '1');
    } else {
      localStorage.removeItem(STORAGE_KEY_ENABLED);
      localStorage.removeItem(STORAGE_KEY_SESSION);
    }
  } catch {
    /* storage can be disabled — opt-in simply stays off */
  }
}

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return 'ssr-nop';
  try {
    const existing = localStorage.getItem(STORAGE_KEY_SESSION);
    if (existing) return existing;
    const fresh =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(STORAGE_KEY_SESSION, fresh);
    return fresh;
  } catch {
    return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export interface UseErgonomicsTelemetry {
  enabled: boolean;
  sessionId: string;
  trackView: (assetId: string, firstView?: boolean) => void;
  trackDecision: (assetId: string, action: string) => void;
  trackReversal: (
    assetId: string,
    previousAction: string,
    newAction: string,
  ) => void;
  trackPause: () => void;
  endSession: () => void;
}

/**
 * React hook that surfaces the track-* callbacks. When the user has
 * not opted in the hook returns noop callbacks so calling them is
 * always safe — callers don't need a feature-flag check around every
 * interaction.
 */
export function useErgonomicsTelemetry(): UseErgonomicsTelemetry {
  const enabled = isErgonomicsEnabled();
  const sessionId = useMemo(
    () => (enabled ? getOrCreateSessionId() : ''),
    [enabled],
  );

  // Buffer lives in a ref so updates don't cause re-renders. Flush
  // runs on an interval + on pagehide/beforeunload so an unexpected
  // close doesn't lose the last 30 seconds of events.
  const bufferRef = useRef<ErgonomicsEvent[]>([]);
  const sequenceRef = useRef(0);
  const flushingRef = useRef(false);

  const flush = useCallback(async () => {
    if (!enabled) return;
    if (flushingRef.current) return;
    const batch = bufferRef.current.splice(0, bufferRef.current.length);
    if (batch.length === 0) return;
    flushingRef.current = true;
    try {
      await apiRequest('/api/telemetry/culling-session', {
        method: 'POST',
        body: { events: batch },
      });
    } catch {
      // Requeue the batch so the next flush retries. Cap total buffer
      // at 5 000 events to keep memory bounded on long offline
      // stretches (~100kB at our event shape).
      const requeued = [...batch, ...bufferRef.current];
      bufferRef.current = requeued.slice(-5_000);
    } finally {
      flushingRef.current = false;
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    // Emit session_start on mount so the server knows when the
    // photographer opened the review surface even if they close it
    // without making a decision.
    bufferRef.current.push({
      sessionId,
      kind: 'session_start',
      ms: Date.now(),
      sequence: sequenceRef.current++,
    });
    const interval = window.setInterval(() => {
      void flush();
    }, FLUSH_INTERVAL_MS);
    const flushOnHide = () => {
      void flush();
    };
    window.addEventListener('pagehide', flushOnHide);
    window.addEventListener('beforeunload', flushOnHide);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('pagehide', flushOnHide);
      window.removeEventListener('beforeunload', flushOnHide);
      // One final flush on unmount so transient-mount components
      // (e.g. closed modal) don't drop their events.
      void flush();
    };
  }, [enabled, sessionId, flush]);

  const trackView = useCallback(
    (assetId: string, firstView?: boolean) => {
      if (!enabled) return;
      bufferRef.current.push({
        sessionId,
        kind: 'view',
        ms: Date.now(),
        sequence: sequenceRef.current++,
        assetId,
        firstView,
      });
    },
    [enabled, sessionId],
  );

  const trackDecision = useCallback(
    (assetId: string, action: string) => {
      if (!enabled) return;
      bufferRef.current.push({
        sessionId,
        kind: 'decide',
        ms: Date.now(),
        sequence: sequenceRef.current++,
        assetId,
        action,
      });
    },
    [enabled, sessionId],
  );

  const trackReversal = useCallback(
    (assetId: string, previousAction: string, newAction: string) => {
      if (!enabled) return;
      bufferRef.current.push({
        sessionId,
        kind: 'reverse',
        ms: Date.now(),
        sequence: sequenceRef.current++,
        assetId,
        previousAction,
        newAction,
      });
    },
    [enabled, sessionId],
  );

  const trackPause = useCallback(() => {
    if (!enabled) return;
    bufferRef.current.push({
      sessionId,
      kind: 'pause',
      ms: Date.now(),
      sequence: sequenceRef.current++,
    });
  }, [enabled, sessionId]);

  const endSession = useCallback(() => {
    if (!enabled) return;
    bufferRef.current.push({
      sessionId,
      kind: 'session_end',
      ms: Date.now(),
      sequence: sequenceRef.current++,
    });
    void flush();
    // Rotate session id so the next review surface opens under a
    // fresh bucket. We don't clear the opt-in.
    try {
      localStorage.removeItem(STORAGE_KEY_SESSION);
    } catch {
      /* storage disabled; next getOrCreateSessionId handles it */
    }
  }, [enabled, flush]);

  return {
    enabled,
    sessionId,
    trackView,
    trackDecision,
    trackReversal,
    trackPause,
    endSession,
  };
}
