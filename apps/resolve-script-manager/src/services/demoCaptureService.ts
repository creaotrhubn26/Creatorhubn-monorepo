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
import type { DomScanResult, TargetLocator } from '../components/demo-studio/demoStudioModel';

/** Ett innsamlet klikk-steg fra capture-vinduet (speiler Rust-payloaden). */
export interface CapturedStep {
  url: string;
  selector: string;
  targetLabel: string;
  actionType: string;
  hotspot: { x: number; y: number; w: number; h: number };
  /** Scroll-posisjon (0–1) da klikket skjedde. */
  scrollPct: number;
  /** Multi-strategi-locators (resilient replay). */
  locators?: TargetLocator[];
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

/**
 * Skann den ekte siden for interaktive elementer (åpner analyse-vindu som
 * lukker seg selv). Returnerer katalogen, eller null ved timeout/feil/web-dev.
 */
export async function scanDom(url: string, timeoutMs = 20000): Promise<DomScanResult | null> {
  if (!isCaptureAvailable()) return null;
  let resolve!: (v: DomScanResult | null) => void;
  const done = new Promise<DomScanResult | null>((r) => { resolve = r; });
  const unlisten = await listen<DomScanResult>('demo-capture://dom', (e) => resolve(e.payload));
  const timer = setTimeout(() => resolve(null), timeoutMs);
  try { await invoke('demo_scan_dom', { url }); } catch { resolve(null); }
  const result = await done;
  clearTimeout(timer);
  unlisten();
  return result;
}

/**
 * Ta et skjermbilde av siden (html2canvas i eget vindu). Returnerer JPEG
 * data-URL eller null (timeout/feil/web-dev). Brukes til thumbnails + vision.
 */
export async function captureScreenshot(url: string, timeoutMs = 30000): Promise<string | null> {
  if (!isCaptureAvailable()) return null;
  let resolve!: (v: string | null) => void;
  const done = new Promise<string | null>((r) => { resolve = r; });
  const unlisten = await listen<{ ok: boolean; dataUrl?: string }>('demo-capture://shot', (e) => resolve(e.payload?.ok ? (e.payload.dataUrl ?? null) : null));
  const timer = setTimeout(() => resolve(null), timeoutMs);
  try { await invoke('demo_screenshot', { url }); } catch { resolve(null); }
  const result = await done;
  clearTimeout(timer);
  unlisten();
  return result;
}

/** Resultat av auto-utførelse av en handling. */
export interface AutoResult {
  ok: boolean;
  found: boolean;
  selector?: string;
  /** Hvilken locator-strategi som traff (session-exec). */
  strategy?: string;
  /** Feilmelding når handlingen kastet (session-exec rapporterer ekte utfall). */
  error?: string;
  /** Sidens URL da handlingen ble utført (session-exec). */
  url?: string;
}

/**
 * Auto-utfør en handling på siden (continueMode:'auto'): systemet finner
 * `selector` og utfører `actionType`. Returnerer resultatet (ok/found) eller
 * null ved timeout/web-dev.
 */
export async function autoExecute(url: string, selector: string, actionType: string, text?: string, timeoutMs = 30000): Promise<AutoResult | null> {
  if (!isCaptureAvailable()) return null;
  let resolve!: (v: AutoResult | null) => void;
  const done = new Promise<AutoResult | null>((r) => { resolve = r; });
  const unlisten = await listen<AutoResult>('demo-capture://auto', (e) => resolve(e.payload));
  const timer = setTimeout(() => resolve(null), timeoutMs);
  try { await invoke('demo_auto_execute', { url, selector, actionType, text: text ?? null }); } catch { resolve(null); }
  const result = await done;
  clearTimeout(timer);
  unlisten();
  return result;
}

/** Resultat av ett-skudds handlings-verifisering. */
export interface VerifyResult {
  cancelled: boolean;
  selector?: string;
  label?: string;
}

/**
 * Verifiser en scenes handling: åpner siden, brukeren klikker elementet, vi får
 * selectoren tilbake (eller null ved timeout/avbrutt/web-dev). expectedLabel
 * vises som hint i verify-vinduet.
 */
export async function verifyAction(url: string, expectedLabel?: string, timeoutMs = 90000): Promise<VerifyResult | null> {
  if (!isCaptureAvailable()) return null;
  let resolve!: (v: VerifyResult | null) => void;
  const done = new Promise<VerifyResult | null>((r) => { resolve = r; });
  const unlisten = await listen<VerifyResult>('demo-capture://verify', (e) => resolve(e.payload));
  const timer = setTimeout(() => resolve(null), timeoutMs);
  try { await invoke('demo_verify_action', { url, expectedLabel: expectedLabel ?? null }); } catch { resolve(null); }
  const result = await done;
  clearTimeout(timer);
  unlisten();
  return result;
}

// ── Vedvarende demo-økt (G4): ETT vindu gjennom hele kjøringen ──
// Engangs-vinduene over åpner base-URL på nytt per kall → side-tilstand tapes
// og innloggede produkter er umulige. Økten under beholder vinduet mellom
// stegene: navigasjon består, brukeren kan logge inn, og skjermbilder viser
// tilstanden ETTER handlingene (ikke en fersk sidelast).

/**
 * Åpne (eller gjenbruk) økt-vinduet. Ved nyopprettelse ventes det på at første
 * side har lastet (session-nav-eventet), så påfølgende exec ikke treffer en
 * halvlastet side. Returnerer false ved feil/web-dev.
 */
export async function sessionOpen(url: string, opts: { navigate?: boolean; timeoutMs?: number } = {}): Promise<boolean> {
  if (!isCaptureAvailable()) return false;
  let resolve!: (v: boolean) => void;
  const loaded = new Promise<boolean>((r) => { resolve = r; });
  const unlisten = await listen('demo-capture://session-nav', () => resolve(true));
  const timer = setTimeout(() => resolve(true), opts.timeoutMs ?? 20000); // fail-open: fortsett selv om nav-eventet uteble
  try {
    const state = await invoke<string>('demo_session_open', { url, navigate: opts.navigate ?? false });
    if (state === 'reused') resolve(true); // ingen ny last å vente på
  } catch {
    resolve(false);
  }
  const ok = await loaded;
  clearTimeout(timer);
  unlisten();
  return ok;
}

/**
 * Utfør en handling i økt-vinduet — på siden slik den ER nå. Prøver scenens
 * multi-strategi-locators i prioritert rekkefølge før css-fallback, og
 * rapporterer EKTE utfall (exception → ok:false + error).
 */
export async function sessionExec(
  selector: string,
  actionType: string,
  text?: string,
  locators?: TargetLocator[],
  timeoutMs = 30000,
): Promise<AutoResult | null> {
  if (!isCaptureAvailable()) return null;
  let resolve!: (v: AutoResult | null) => void;
  const done = new Promise<AutoResult | null>((r) => { resolve = r; });
  const unlisten = await listen<AutoResult>('demo-capture://auto', (e) => resolve(e.payload));
  const timer = setTimeout(() => resolve(null), timeoutMs);
  try {
    await invoke('demo_session_exec', { selector, actionType, text: text ?? null, locators: locators ?? null, settleMs: null });
  } catch { resolve(null); }
  const result = await done;
  clearTimeout(timer);
  unlisten();
  return result;
}

/** Verifiser i økt-vinduet: brukeren klikker elementet på NÅVÆRENDE side. */
export async function sessionVerify(expectedLabel?: string, timeoutMs = 90000): Promise<VerifyResult | null> {
  if (!isCaptureAvailable()) return null;
  let resolve!: (v: VerifyResult | null) => void;
  const done = new Promise<VerifyResult | null>((r) => { resolve = r; });
  const unlisten = await listen<VerifyResult>('demo-capture://verify', (e) => resolve(e.payload));
  const timer = setTimeout(() => resolve(null), timeoutMs);
  try { await invoke('demo_session_verify', { expectedLabel: expectedLabel ?? null }); } catch { resolve(null); }
  const result = await done;
  clearTimeout(timer);
  unlisten();
  return result;
}

/** Skjermbilde av øktens nåværende tilstand (etter handlinger — G6). */
export async function sessionShot(timeoutMs = 30000): Promise<string | null> {
  if (!isCaptureAvailable()) return null;
  let resolve!: (v: string | null) => void;
  const done = new Promise<string | null>((r) => { resolve = r; });
  const unlisten = await listen<{ ok: boolean; dataUrl?: string }>('demo-capture://shot', (e) => resolve(e.payload?.ok ? (e.payload.dataUrl ?? null) : null));
  const timer = setTimeout(() => resolve(null), timeoutMs);
  try { await invoke('demo_session_shot'); } catch { resolve(null); }
  const result = await done;
  clearTimeout(timer);
  unlisten();
  return result;
}

/** Lukk økt-vinduet (best-effort). */
export async function sessionClose(): Promise<void> {
  if (!isCaptureAvailable()) return;
  try { await invoke('demo_session_close'); } catch { /* allerede lukket */ }
}
