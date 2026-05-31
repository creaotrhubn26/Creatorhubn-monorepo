/**
 * useContinuousPreview — auto-render lo-fi preview når editor-state endrer seg.
 *
 * Mønster:
 *   - Hver gang picks/overrides/order/exclude endrer seg, debounce 3s
 *   - Etter debounce: kjør render_quick_preview (480p H.264 ~10s å render)
 *   - Hvis ny endring skjer mens render kjører: cancel + start ny
 *   - Resultat: et MP4-path som CreativeEditor kan vise i preview-vinduet
 *
 * Brukeren ser at "endringer flyter" uten å trykke Render hver gang.
 * Live preview-status: idle / queued / rendering / ready / error.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { executeScript, cancelScript } from "../api";

export type ContinuousPreviewStatus = "idle" | "queued" | "rendering" | "ready" | "error";

export interface ContinuousPreviewInputs {
  picks: Array<{ index: number; startSec: number; endSec: number; durationSec: number; chapter?: string }>;
  sourceVideo: string;
  pickOverrides: Record<number, { startSec?: number; endSec?: number }>;
  pickOrder: number[] | null;
  excludedChapters: string[];
}

export interface ContinuousPreviewState {
  status: ContinuousPreviewStatus;
  /** Path til siste vellykkede render (kan vises i video-element). */
  previewPath: string | null;
  /** Tidsstempel for siste vellykkede render. */
  renderedAt: number | null;
  /** Pågående render-id for cancel. */
  currentRunId: string | null;
  /** Antall sekunder med "ferskhet" (oppdateres via interval). */
  ageSec: number;
  error: string | null;
  /** Hvis bruker har skrudd av live-preview. */
  enabled: boolean;
}

interface UseContinuousPreviewOptions {
  /** Debounce i ms etter siste edit før render starter. Default 3500. */
  debounceMs?: number;
  /** Render-presets — "fast" er ~5-15s, "balanced" ~20-40s. */
  preset?: "fast" | "balanced";
  /** Output-høyde. Lavere = raskere. Default 480. */
  height?: number;
  /** Min antall picks før vi kjører render — under det er det ikke verdt det. */
  minPicks?: number;
}

const DEBOUNCE_DEFAULT_MS = 3500;

/**
 * State-changes serialisert til en stabil signatur — slik at vi vet om
 * input faktisk endret seg (uten å re-rendre på samme state).
 */
function inputSignature(inp: ContinuousPreviewInputs): string {
  return JSON.stringify({
    s: inp.sourceVideo,
    p: inp.picks.map(p => `${p.index}:${p.startSec.toFixed(2)}-${p.endSec.toFixed(2)}`).join(","),
    o: inp.pickOverrides,
    ord: inp.pickOrder,
    ex: inp.excludedChapters.slice().sort(),
  });
}

export function useContinuousPreview(
  inputs: ContinuousPreviewInputs | null,
  options: UseContinuousPreviewOptions = {},
): ContinuousPreviewState & {
  setEnabled: (enabled: boolean) => void;
  renderNow: () => void;
} {
  const debounceMs = options.debounceMs ?? DEBOUNCE_DEFAULT_MS;
  const preset = options.preset ?? "fast";
  const height = options.height ?? 480;
  const minPicks = options.minPicks ?? 3;

  const [state, setState] = useState<ContinuousPreviewState>({
    status: "idle",
    previewPath: null,
    renderedAt: null,
    currentRunId: null,
    ageSec: 0,
    error: null,
    enabled: true,
  });

  const debounceTimerRef = useRef<number | null>(null);
  const lastSignatureRef = useRef<string | null>(null);
  const lastQueuedSignatureRef = useRef<string | null>(null);
  const currentRunIdRef = useRef<string | null>(null);

  const setEnabled = useCallback((enabled: boolean) => {
    setState((prev) => ({ ...prev, enabled }));
    if (!enabled && debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  const doRender = useCallback(async (inp: ContinuousPreviewInputs, signature: string) => {
    // Cancel pågående render hvis vi starter en ny.
    if (currentRunIdRef.current) {
      try { await cancelScript(currentRunIdRef.current); } catch { /* ignore */ }
    }
    const runId = `cont-preview-${Date.now()}`;
    currentRunIdRef.current = runId;
    setState((prev) => ({ ...prev, status: "rendering", currentRunId: runId, error: null }));

    try {
      const summary = await executeScript("render_quick_preview", {
        picks: inp.picks,
        sourceVideo: inp.sourceVideo,
        pickOverrides: inp.pickOverrides,
        pickOrder: inp.pickOrder,
        excludedChapters: inp.excludedChapters,
        preset,
        height,
        onlyApproved: false,  // editor-payload styrer allerede hva som er inkludert
      }, false);

      // Hvis et nytt render-job startet imens, ignorer dette
      if (currentRunIdRef.current !== runId) return;

      const errEvent = summary.events.find((e) => e.type === "error");
      if (errEvent) {
        const msg = (errEvent.value as { message?: string })?.message ?? "Preview-render feilet";
        setState((prev) => ({ ...prev, status: "error", error: msg, currentRunId: null }));
        currentRunIdRef.current = null;
        return;
      }

      const result = summary.events.find((e) => e.type === "result");
      const path = (result?.value as { outputPath?: string })?.outputPath;
      if (!path) {
        setState((prev) => ({ ...prev, status: "error", error: "Ingen output-path returnert", currentRunId: null }));
        currentRunIdRef.current = null;
        return;
      }

      // Check signature er fortsatt det vi rendret for — hvis ikke,
      // queue en ny render
      const queued = lastQueuedSignatureRef.current;
      if (queued && queued !== signature) {
        currentRunIdRef.current = null;
        // Re-trigger immediately for the newer state
        setState((prev) => ({ ...prev, status: "queued", currentRunId: null }));
        return;
      }

      setState((prev) => ({
        ...prev,
        status: "ready",
        previewPath: path,
        renderedAt: Date.now(),
        currentRunId: null,
        ageSec: 0,
      }));
      currentRunIdRef.current = null;
    } catch (err) {
      if (currentRunIdRef.current !== runId) return;  // ble cancellet
      setState((prev) => ({
        ...prev,
        status: "error",
        error: (err as Error).message,
        currentRunId: null,
      }));
      currentRunIdRef.current = null;
    }
  }, [preset, height]);

  // Watcher: når input endrer seg, debounce + queue render
  useEffect(() => {
    if (!state.enabled || !inputs) return;
    if (inputs.picks.length < minPicks) return;

    const sig = inputSignature(inputs);
    if (sig === lastSignatureRef.current) return;
    lastSignatureRef.current = sig;
    lastQueuedSignatureRef.current = sig;

    setState((prev) => ({ ...prev, status: "queued" }));

    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      // Bare render hvis signaturen fortsatt er aktuell
      if (lastQueuedSignatureRef.current === sig) {
        void doRender(inputs, sig);
      }
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [
    state.enabled,
    inputs,
    debounceMs,
    minPicks,
    doRender,
  ]);

  // Re-trigger render etter cancel hvis signaturen endret seg under render
  useEffect(() => {
    if (state.status === "queued" && !state.currentRunId && state.enabled && inputs) {
      const sig = inputSignature(inputs);
      if (sig === lastQueuedSignatureRef.current) {
        void doRender(inputs, sig);
      }
    }
  }, [state.status, state.currentRunId, state.enabled, inputs, doRender]);

  // Alder-ticker (oppdateres hvert sekund mens en preview er ferdig)
  useEffect(() => {
    if (state.status !== "ready" || !state.renderedAt) return;
    const id = setInterval(() => {
      setState((prev) => ({ ...prev, ageSec: Math.floor((Date.now() - (prev.renderedAt ?? Date.now())) / 1000) }));
    }, 1000);
    return () => clearInterval(id);
  }, [state.status, state.renderedAt]);

  // Manuell trigger
  const renderNow = useCallback(() => {
    if (!inputs) return;
    if (inputs.picks.length < minPicks) return;
    const sig = inputSignature(inputs);
    lastQueuedSignatureRef.current = sig;
    lastSignatureRef.current = sig;
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    void doRender(inputs, sig);
  }, [inputs, minPicks, doRender]);

  // Cleanup på unmount
  useEffect(() => () => {
    if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    if (currentRunIdRef.current) {
      void cancelScript(currentRunIdRef.current).catch(() => { /* noop */ });
    }
  }, []);

  return { ...state, setEnabled, renderNow };
}
