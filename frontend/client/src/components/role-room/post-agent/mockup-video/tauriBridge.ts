/**
 * tauriBridge.ts — kobler MockupVideoStudio til den native pipelinen når
 * komponenten kjører inne i Post Agent (Tauri). I en vanlig nettleser finnes
 * ikke Tauri, og vi faller tilbake til nettleser-eksporten (MediaRecorder).
 *
 * Den native veien (Rust-kommando `mockup_render_video`) kjører hele
 * scripts/mockup-polish-pro.mts: transparent/ProRes-alfa, noise gate,
 * two-pass loudness, Post Agents apply_audio_polish, musikk-ducking og
 * auto-zoom — ting nettleseren ikke kan gjøre alene.
 *
 * Vi importerer @tauri-apps/api dynamisk slik at hoved-frontenden (som ikke
 * har Tauri som avhengighet) fortsatt bygger; importen skjer kun når vi
 * faktisk er i Tauri.
 */

import type { MockupConfig } from './mockupConfig';

/** Sann når koden kjører inne i en Tauri-app (Post Agent-klienten). */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export interface NativeRenderRequest {
  config: MockupConfig;
  /** Absolutte stier til kilde-klipp, i rekkefølge. */
  clips: string[];
  /** Hvor sluttfila skrives (.mp4 / .mov). */
  outputPath: string;
  /** Valgfri sti til bakgrunnsmusikk. */
  musicPath?: string | null;
}

export interface NativeRenderEvent {
  type: 'started' | 'progress' | 'log' | 'stderr' | 'result' | 'finished' | 'error';
  runId?: string;
  label?: string;
  message?: string;
  percent?: number | null;
  outputPath?: string;
  format?: string;
  [k: string]: unknown;
}

/**
 * Kjør den native render-pipelinen. Kaster hvis vi ikke er i Tauri.
 * `onEvent` mottar fremdrift (progress/log/result) underveis.
 *
 * Returnerer RunSummary-aktig objekt fra Rust (succeeded + events).
 */
export async function renderNative(
  req: NativeRenderRequest,
  onEvent?: (e: NativeRenderEvent) => void,
): Promise<{ succeeded: boolean; outputPath?: string }> {
  if (!isTauri()) {
    throw new Error('Native render krever Post Agent (Tauri). Bruk nettleser-eksport her.');
  }
  // Dynamiske importer — kun lastet i Tauri-miljø. @tauri-apps/api er ikke en
  // avhengighet i hoved-frontenden (kun i Post Agent-klienten), så vi bruker
  // en runtime-import via variabel-spesifier slik at bundleren ikke prøver å
  // resolve den ved build i nettleser-konteksten.
  const coreMod: any = await import(/* @vite-ignore */ ('@tauri-apps/api/core' as string));
  const eventMod: any = await import(/* @vite-ignore */ ('@tauri-apps/api/event' as string));
  const invoke = coreMod.invoke as <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
  const listen = eventMod.listen as <T>(name: string, cb: (e: { payload: T }) => void) => Promise<() => void>;

  let unlisten: (() => void) | null = null;
  let resultPath: string | undefined;
  if (onEvent) {
    unlisten = await listen<NativeRenderEvent>('script-event', (e) => {
      const payload = e.payload;
      if (payload.type === 'result' && payload.outputPath) resultPath = payload.outputPath;
      onEvent(payload);
    });
  }

  try {
    const summary = await invoke<{ succeeded: boolean; events: NativeRenderEvent[] }>(
      'mockup_render_video',
      {
        config: req.config,
        clips: req.clips,
        outputPath: req.outputPath,
        musicPath: req.musicPath ?? null,
      },
    );
    // Hent outputPath fra result-eventet hvis vi ikke fanget det via listener.
    if (!resultPath) {
      resultPath = summary.events?.find((ev) => ev.type === 'result')?.outputPath;
    }
    return { succeeded: summary.succeeded, outputPath: resultPath };
  } finally {
    if (unlisten) unlisten();
  }
}
