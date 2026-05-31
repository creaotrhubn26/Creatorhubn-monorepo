/**
 * useResolveSync — bidireksjonell synkronisering med DaVinci Resolve.
 *
 * Polling-loop hvert 5. sekund som henter Resolve's state (timeline,
 * markers, clip-count). Detekterer endringer og eksponerer deltas til
 * Creative Editor, som kan merge dem inn i sin egen state.
 *
 * Foreløpig MVP: én-vei (Resolve → CE). To-veis push (CE → Resolve)
 * implementeres som separat pushChanges()-funksjon når vi har validert
 * at polling-flowen er stabil.
 *
 * Hvorfor 5 sek: Resolve scripting API har ~100-300ms latency per call.
 * Hyppigere polling lager merkbar load på Bjarnes maskin uten ekstra
 * verdi siden manuelle markører-edits er sjeldne.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { executeScript } from "../api";

export interface ResolveMarker {
  frame: number;
  sec: number;
  name: string;
  color: string;
  note: string;
}

export interface ResolveState {
  connected: boolean;
  projectName: string | null;
  timelineName: string | null;
  fps: number;
  timelineDurationFrames: number;
  markers: ResolveMarker[];
  clipCount: number;
  /** Resolve Studio (true) vs free (false). Påvirker hvilke auto-pilot-
   *  features som er tilgjengelige (VST/AU-plugins, LUT-applikasjon,
   *  Fairlight-automation, etc.). */
  isStudio?: boolean;
  productName?: string | null;
  reason?: string;
  sampledAt: number;
}

export type SyncStatus =
  | "idle"          // ikke i sync-modus
  | "connecting"    // initial connect
  | "in_sync"       // siste poll var suksess
  | "polling"       // henter data nå
  | "disconnected"  // Resolve ikke åpen
  | "error";        // poll feilet

export interface ResolveSyncState {
  status: SyncStatus;
  resolveState: ResolveState | null;
  lastPolledAt: number | null;
  /** Sekunder siden siste vellykkede poll (oppdateres pr sek). */
  staleSec: number;
  /** Nye markører som dukket opp etter siste sync (frontend kan merge). */
  newMarkers: ResolveMarker[];
  error: string | null;
}

interface UseResolveSyncOptions {
  /** Polling-interval i ms. Default 5000. */
  intervalMs?: number;
  /** Om sync skal være aktiv. False = pause polling. */
  enabled?: boolean;
}

/** Sammenligner to markør-arrayer og returnerer nye (basert på frame). */
function diffMarkers(prev: ResolveMarker[], next: ResolveMarker[]): ResolveMarker[] {
  const prevFrames = new Set(prev.map((m) => m.frame));
  return next.filter((m) => !prevFrames.has(m.frame));
}

export interface PushMarkersInput {
  markers: Array<{
    id: string;
    timeSec: number;
    label: string;
    color: string;
    comment: string;
  }>;
}

export interface PushMarkersResult {
  added: number;
  updated: number;
  skipped: number;
  failed: number;
}

export function useResolveSync(options: UseResolveSyncOptions = {}): ResolveSyncState & {
  pollNow: () => Promise<void>;
  pushMarkers: (input: PushMarkersInput) => Promise<PushMarkersResult>;
  /** Push hele edit-staten til Resolve som timeline (build_highlight_from_picks). */
  pushFullEdit: (input: {
    picks: unknown[];
    sourceVideo: string;
    pickOverrides?: Record<number, { startSec?: number; endSec?: number }>;
    pickOrder?: number[] | null;
    excludedChapters?: string[];
    timelineName?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
} {
  const intervalMs = options.intervalMs ?? 5000;
  const enabled = options.enabled ?? true;

  const [state, setState] = useState<ResolveSyncState>({
    status: "idle",
    resolveState: null,
    lastPolledAt: null,
    staleSec: 0,
    newMarkers: [],
    error: null,
  });

  const intervalRef = useRef<number | null>(null);
  const pollingRef = useRef(false);
  const lastMarkersRef = useRef<ResolveMarker[]>([]);

  const doPoll = useCallback(async () => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    setState((prev) => ({
      ...prev,
      status: prev.status === "idle" || prev.status === "connecting" ? "connecting" : "polling",
    }));

    try {
      const summary = await executeScript("poll_resolve_state", {}, false);
      const result = summary.events.find((e) => e.type === "result");
      const errEvent = summary.events.find((e) => e.type === "error");

      if (errEvent) {
        setState((prev) => ({
          ...prev,
          status: "error",
          error: (errEvent.value as { message?: string })?.message ?? "Poll feilet",
        }));
        return;
      }

      const resolveState = result?.value as ResolveState | undefined;
      if (!resolveState) {
        setState((prev) => ({ ...prev, status: "error", error: "Tom respons" }));
        return;
      }

      if (!resolveState.connected) {
        setState((prev) => ({
          ...prev,
          status: "disconnected",
          resolveState,
          lastPolledAt: Date.now(),
          newMarkers: [],
          error: null,
        }));
        return;
      }

      // Diff markører — gir frontend signal om hva som er nytt
      const newMarkers = diffMarkers(lastMarkersRef.current, resolveState.markers);
      lastMarkersRef.current = resolveState.markers;

      setState((prev) => ({
        ...prev,
        status: "in_sync",
        resolveState,
        lastPolledAt: Date.now(),
        staleSec: 0,
        newMarkers: newMarkers.length > 0 ? newMarkers : prev.newMarkers,
        error: null,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        status: "error",
        error: (err as Error).message,
      }));
    } finally {
      pollingRef.current = false;
    }
  }, []);

  // Polling-loop
  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setState((prev) => ({ ...prev, status: "idle" }));
      return;
    }

    void doPoll();
    intervalRef.current = window.setInterval(() => {
      void doPoll();
    }, intervalMs);

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, intervalMs, doPoll]);

  // Stale-ticker (sekunder siden siste suksess)
  useEffect(() => {
    if (!state.lastPolledAt) return;
    const id = setInterval(() => {
      setState((prev) => ({
        ...prev,
        staleSec: prev.lastPolledAt
          ? Math.floor((Date.now() - prev.lastPolledAt) / 1000)
          : 0,
      }));
    }, 1000);
    return () => clearInterval(id);
  }, [state.lastPolledAt]);

  // Push markører til Resolve. Bruker customData='ce:{id}' så samme markør
  // re-pushes uten å dupliseres. Idempotent — trygt å kalle ved hver edit.
  const pushMarkers = useCallback(async (input: PushMarkersInput): Promise<PushMarkersResult> => {
    const summary = await executeScript("push_markers_to_resolve", {
      markers: input.markers.map((m) => ({
        id: m.id,
        sec: m.timeSec,
        label: m.label,
        color: m.color,
        comment: m.comment,
      })),
    }, false);
    const result = summary.events.find((e) => e.type === "result");
    const r = (result?.value as PushMarkersResult | undefined) ?? {
      added: 0, updated: 0, skipped: 0, failed: 0,
    };
    // Trigger immediate re-poll så CE ser den nye state
    void doPoll();
    return r;
  }, [doPoll]);

  const pushFullEdit = useCallback(async (input: {
    picks: unknown[];
    sourceVideo: string;
    pickOverrides?: Record<number, { startSec?: number; endSec?: number }>;
    pickOrder?: number[] | null;
    excludedChapters?: string[];
    timelineName?: string;
  }): Promise<{ ok: boolean; error?: string }> => {
    try {
      const summary = await executeScript("build_highlight_from_picks", {
        sourceVideo: input.sourceVideo,
        picks: input.picks,
        pickOverrides: input.pickOverrides ?? {},
        pickOrder: input.pickOrder ?? undefined,
        excludedChapters: input.excludedChapters ?? [],
        timelineName: input.timelineName ?? `CE Sync — ${new Date().toLocaleTimeString("nb-NO")}`,
      }, false);
      const errEvent = summary.events.find((e) => e.type === "error");
      if (errEvent) {
        return { ok: false, error: (errEvent.value as { message?: string })?.message ?? "Push feilet" };
      }
      void doPoll();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }, [doPoll]);

  return { ...state, pollNow: doPoll, pushMarkers, pushFullEdit };
}
