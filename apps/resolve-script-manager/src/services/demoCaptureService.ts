/**
 * demoCaptureService — frontend-side av «klikk-gjennom»-capture (Fase 2).
 *
 * start_demo_capture åpner et eget WebviewWindow på målsiden; brukeren klikker
 * seg gjennom, og hvert klikk kommer tilbake som et event (demo-capture://step).
 * Når brukeren trykker «Fullfør» kommer demo-capture://done.
 *
 * Krever Tauri (invoke). I ren browser-dev finnes ikke IPC → isCaptureAvailable
 * er false, og UI-et faller tilbake til manuell hotspot-plassering.
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

/** Ett innsamlet klikk-steg fra capture-vinduet (speiler Rust-payloaden). */
export interface CapturedStep {
  url: string;
  selector: string;
  targetLabel: string;
  actionType: string;
  hotspot: { x: number; y: number; w: number; h: number };
  /** Scroll-posisjon (0–1) da klikket skjedde. */
  scrollPct: number;
}

/** Er capture tilgjengelig (kjører vi i Tauri)? */
export function isCaptureAvailable(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** Åpne capture-vinduet på `url`. */
export async function startDemoCapture(url: string): Promise<void> {
  await invoke('start_demo_capture', { url });
}

/** Lytt på innkommende klikk-steg. Returnerer unlisten-funksjon. */
export function onCaptureStep(cb: (step: CapturedStep) => void): Promise<UnlistenFn> {
  return listen<CapturedStep>('demo-capture://step', (e) => cb(e.payload));
}

/** Lytt på «ferdig» (cancelled=true → forkast stegene). Returnerer unlisten. */
export function onCaptureDone(cb: (cancelled: boolean) => void): Promise<UnlistenFn> {
  return listen<boolean>('demo-capture://done', (e) => cb(Boolean(e.payload)));
}
