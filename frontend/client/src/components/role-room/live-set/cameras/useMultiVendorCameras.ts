/**
 * useMultiVendorCameras.ts
 *
 * State-management for paired kameraer på tvers av vendors. Holder
 * en liste over CameraAdapter-instanser, poller hver for state-snapshot,
 * og eksponerer add/remove-handlere.
 *
 * Persistens: paired-list lagres i localStorage under
 * 'live-set:paired-cameras' så LIVE SET PRO husker kameraene mellom
 * page-reloads (men ikke faktiske BLE-connections — de må re-pares).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { CameraAdapter, CameraStateSnapshot } from "./types";

export interface ConnectedCamera {
  adapter: CameraAdapter;
  state: CameraStateSnapshot | null;
}

export interface UseMultiVendorCamerasResult {
  cameras: ConnectedCamera[];
  addCamera: (adapter: CameraAdapter) => void;
  removeCamera: (cameraId: string) => Promise<void>;
  refreshAll: () => Promise<void>;
}

const STORAGE_KEY = "live-set:paired-cameras";

interface StoredPairing {
  vendor: string;
  id: string;
  label: string;
}

function readStoredPairings(): StoredPairing[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is StoredPairing =>
        typeof p === "object" && p !== null && typeof p.vendor === "string" && typeof p.id === "string",
    );
  } catch {
    return [];
  }
}

function writeStoredPairings(pairings: StoredPairing[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pairings));
  } catch {
    // Quota / private-mode — ignore
  }
}

export function useMultiVendorCameras(): UseMultiVendorCamerasResult {
  const [cameras, setCameras] = useState<ConnectedCamera[]>([]);
  const pollTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Persistence — lagre paired-list på endring (uten faktiske adapter-refs)
  useEffect(() => {
    const pairings: StoredPairing[] = cameras.map((c) => ({
      vendor: c.adapter.vendor,
      id: c.adapter.id,
      label: c.state?.label ?? c.adapter.id,
    }));
    writeStoredPairings(pairings);
  }, [cameras]);

  // Logg eksisterende pairings ved mount så bruker vet hvilke kameraer
  // som "var" tilkoblet i forrige session (men ikke aktive før re-pare)
  useEffect(() => {
    const stored = readStoredPairings();
    if (stored.length > 0) {
      console.info(
        `[useMultiVendorCameras] Fant ${stored.length} lagrede paringer fra forrige session. Re-par for å koble til igjen.`,
      );
    }
  }, []);

  const pollCamera = useCallback((cameraId: string) => {
    const timers = pollTimersRef.current;
    const existing = timers.get(cameraId);
    if (existing) clearTimeout(existing);

    const tick = async () => {
      const current = cameras.find((c) => c.adapter.id === cameraId);
      if (!current) return;

      try {
        const state = await current.adapter.fetchState();
        setCameras((cams) =>
          cams.map((c) => (c.adapter.id === cameraId ? { ...c, state } : c)),
        );
      } catch (err) {
        console.warn(`[useMultiVendorCameras] poll failed for ${cameraId}:`, err);
      }

      // Re-schedule
      timers.set(cameraId, setTimeout(tick, current.adapter.recommendedPollIntervalMs));
    };

    timers.set(cameraId, setTimeout(tick, 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addCamera = useCallback((adapter: CameraAdapter) => {
    setCameras((current) => {
      // Dedup på vendor + id
      const exists = current.some(
        (c) => c.adapter.vendor === adapter.vendor && c.adapter.id === adapter.id,
      );
      if (exists) return current;

      // Subscribe state-changes hvis støttet
      if (adapter.subscribeStateChanges) {
        adapter.subscribeStateChanges((snapshot) => {
          setCameras((cams) =>
            cams.map((c) => (c.adapter.id === adapter.id ? { ...c, state: snapshot } : c)),
          );
        });
      }

      return [...current, { adapter, state: null }];
    });

    // Start polling som fallback (subscribers vil overskrive med fresher data)
    pollCamera(adapter.id);
  }, [pollCamera]);

  const removeCamera = useCallback(async (cameraId: string) => {
    const target = cameras.find((c) => c.adapter.id === cameraId);
    if (!target) return;

    // Stop polling
    const timer = pollTimersRef.current.get(cameraId);
    if (timer) {
      clearTimeout(timer);
      pollTimersRef.current.delete(cameraId);
    }

    try {
      await target.adapter.disconnect();
    } catch (err) {
      console.warn(`[useMultiVendorCameras] disconnect failed for ${cameraId}:`, err);
    }

    setCameras((current) => current.filter((c) => c.adapter.id !== cameraId));
  }, [cameras]);

  const refreshAll = useCallback(async () => {
    const results = await Promise.allSettled(
      cameras.map(async (c) => ({ id: c.adapter.id, state: await c.adapter.fetchState() })),
    );
    setCameras((current) =>
      current.map((cam) => {
        const result = results.find(
          (r) => r.status === "fulfilled" && r.value.id === cam.adapter.id,
        );
        if (result && result.status === "fulfilled") {
          return { ...cam, state: result.value.state };
        }
        return cam;
      }),
    );
  }, [cameras]);

  // Cleanup ved unmount
  useEffect(() => {
    const timers = pollTimersRef.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  return { cameras, addCamera, removeCamera, refreshAll };
}
