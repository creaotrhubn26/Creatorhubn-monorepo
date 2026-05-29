/**
 * useCreatorProfile — laster brukerens preferanser fra Role Room-backend
 * ved mount + eksponerer update + logLearning. Profilen er knyttet til
 * innlogget bruker (RR_BEARER_TOKEN) så Bjarne får sine learnings selv om
 * han bytter maskin.
 *
 * Loading-states:
 *   - "unauthenticated": ikke innlogget, profil ikke tilgjengelig
 *   - "loading": henter
 *   - "ready": har profil
 *   - "error": feil
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  creatorProfileService,
  type CreatorProfile,
  type CreatorProfileState,
  type CulturalLookPack,
} from "../services/creatorProfileService";

export type CreatorProfileLoadStatus = "loading" | "unauthenticated" | "ready" | "error";

interface UseCreatorProfileResult {
  status: CreatorProfileLoadStatus;
  profile: CreatorProfile;
  editCount: number;
  updatedAt: string | null;
  error: string | null;
  /** Last på nytt (f.eks. etter at user logget inn). */
  refresh: () => Promise<void>;
  /** Patch profilen — merges på server-side. */
  update: (patch: Partial<CreatorProfile>) => Promise<void>;
  /** Logg en læring uten å mutere primær-profil. */
  logLearning: (kind: string, data?: Record<string, unknown>) => Promise<void>;
  /** Add ny cultural look-pack — dedup på navn. */
  addCulturalLookPack: (spec: Omit<CulturalLookPack, "createdAt" | "usageCount">) => Promise<void>;
  /** Inkrementer usage-counter (kalles når Claude bruker en eksisterende look). */
  incrementLookPackUsage: (name: string) => Promise<void>;
}

export function useCreatorProfile(): UseCreatorProfileResult {
  const [state, setState] = useState<CreatorProfileState>({
    profile: {},
    editCount: 0,
    updatedAt: null,
  });
  const [status, setStatus] = useState<CreatorProfileLoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  // Pending-learnings ref så vi kan debounce og batch'e
  const pendingLearningsRef = useRef<Array<{ kind: string; data?: Record<string, unknown> }>>([]);
  const flushTimerRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const data = await creatorProfileService.get();
      setState(data);
      setStatus("ready");
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("Ikke innlogget") || msg.includes("401")) {
        setStatus("unauthenticated");
      } else {
        setStatus("error");
        setError(msg);
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const update = useCallback(async (patch: Partial<CreatorProfile>) => {
    try {
      const res = await creatorProfileService.update(patch);
      if (res.ok) {
        setState((prev) => ({ ...prev, profile: res.profile, updatedAt: new Date().toISOString() }));
      }
    } catch (err) {
      console.warn("creator-profile update failed:", err);
    }
  }, []);

  const flushLearnings = useCallback(async () => {
    const pending = pendingLearningsRef.current;
    if (pending.length === 0) return;
    pendingLearningsRef.current = [];
    for (const l of pending) {
      try {
        const r = await creatorProfileService.logLearning(l.kind, l.data);
        setState((prev) => ({ ...prev, editCount: r.editCount }));
      } catch (err) {
        console.warn("creator-profile learning failed:", err);
      }
    }
  }, []);

  const logLearning = useCallback(async (kind: string, data?: Record<string, unknown>) => {
    pendingLearningsRef.current.push({ kind, data });
    if (flushTimerRef.current) window.clearTimeout(flushTimerRef.current);
    // Batch: vent 5s før vi sender — slik blir 5 raske edits til 1-5 calls
    flushTimerRef.current = window.setTimeout(() => {
      flushTimerRef.current = null;
      void flushLearnings();
    }, 5000);
  }, [flushLearnings]);

  // Flush ved unmount så vi ikke mister learnings
  useEffect(() => () => {
    if (flushTimerRef.current) window.clearTimeout(flushTimerRef.current);
    void flushLearnings();
  }, [flushLearnings]);

  const addCulturalLookPack = useCallback(async (
    spec: Omit<CulturalLookPack, "createdAt" | "usageCount">,
  ) => {
    const existing = state.profile.culturalLookPacks ?? [];
    // Dedup: hvis navn finnes, oppdater i stedet for å duplisere
    const matchIdx = existing.findIndex((p) => p.name.toLowerCase() === spec.name.toLowerCase());
    let next: CulturalLookPack[];
    if (matchIdx >= 0) {
      next = [...existing];
      next[matchIdx] = { ...existing[matchIdx], ...spec, usageCount: existing[matchIdx].usageCount + 1 };
    } else {
      const newPack: CulturalLookPack = {
        ...spec,
        createdAt: Date.now(),
        usageCount: 1,
      };
      next = [...existing, newPack];
    }
    await update({ culturalLookPacks: next });
  }, [state.profile.culturalLookPacks, update]);

  const incrementLookPackUsage = useCallback(async (name: string) => {
    const existing = state.profile.culturalLookPacks ?? [];
    const idx = existing.findIndex((p) => p.name.toLowerCase() === name.toLowerCase());
    if (idx < 0) return;
    const next = [...existing];
    next[idx] = { ...next[idx], usageCount: next[idx].usageCount + 1 };
    await update({ culturalLookPacks: next });
  }, [state.profile.culturalLookPacks, update]);

  return {
    status,
    profile: state.profile,
    editCount: state.editCount,
    updatedAt: state.updatedAt,
    error,
    refresh,
    update,
    logLearning,
    addCulturalLookPack,
    incrementLookPackUsage,
  };
}
