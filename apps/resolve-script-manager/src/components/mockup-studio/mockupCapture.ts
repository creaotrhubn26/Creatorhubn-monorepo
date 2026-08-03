/**
 * mockupCapture.ts — hent ekte skjermbilder fra en URL + trekk ut merkevare-
 * accent, uten manuell opplasting.
 *
 * Gjenbruker Post Agents Playwright-capture (`playwright_capture_shots`, ekte
 * Chromium, desktop + responsiv mobil) og motor-status/oppsett. Accent-uttrekk
 * er 100% klient-side (canvas-sampling av et skjermbilde) — ingen backend, ingen
 * AI-nøkkel.
 */

import { playwrightCaptureShots, playwrightStatus, setupPlaywright, listCaptureSources, iosSimScreenshot } from '../../api';

export type CaptureViewport = 'desktop' | 'mobile';

export interface CapturedShot {
  label: string;
  viewport: CaptureViewport;
  scrollPct: number;
  dataUrl: string;
}

/** Legg på https:// hvis skjemaet mangler; trim whitespace. */
export function normalizeUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

/** Verts-navn fra en URL (for auto-navn på dokumentet), tom streng ved feil. */
export function hostnameOf(raw: string): string {
  try {
    return new URL(normalizeUrl(raw)).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function pctLabel(p: number): string {
  return p <= 0.02 ? 'topp' : `${Math.round(p * 100)}%`;
}

/** Er capture-motoren (Playwright/Chromium) installert? */
export async function isCaptureReady(): Promise<boolean> {
  try {
    const s = await playwrightStatus();
    return !!s.playwrightInstalled;
  } catch {
    return false;
  }
}

/** Installer capture-motoren (kan ta et par minutter første gang). */
export async function installCaptureEngine(): Promise<boolean> {
  const res = await setupPlaywright();
  return !!res && (res as { succeeded?: boolean }).succeeded !== false;
}

/**
 * Hent skjermbilder fra en URL. Returnerer desktop- + mobil-varianter (flere
 * scroll-posisjoner) som en flat liste man kan tilordne enkelt-enheter.
 */
export async function captureSiteShots(url: string): Promise<CapturedShot[]> {
  const norm = normalizeUrl(url);
  const res = await playwrightCaptureShots(norm);
  const out: CapturedShot[] = [];
  for (const s of res.shots ?? []) {
    if (s?.dataUrl) out.push({ label: `Desktop · ${pctLabel(s.scrollPct)}`, viewport: 'desktop', scrollPct: s.scrollPct, dataUrl: s.dataUrl });
  }
  for (const s of res.shotsMobile ?? []) {
    if (s?.dataUrl) out.push({ label: `Mobil · ${pctLabel(s.scrollPct)}`, viewport: 'mobile', scrollPct: s.scrollPct, dataUrl: s.dataUrl });
  }
  return out;
}

/** Beste skjermbilde for en gitt enhets-variant (mobil→iPhone, ellers desktop). */
export function bestShotForVariant(shots: CapturedShot[], variant: string): CapturedShot | undefined {
  const wantMobile = variant === 'iphone' || variant === 'watch';
  const pool = shots.filter((s) => (wantMobile ? s.viewport === 'mobile' : s.viewport === 'desktop'));
  const fromPool = pool.slice().sort((a, b) => a.scrollPct - b.scrollPct)[0];
  // Fallback: hvis mobil mangler, bruk desktop (og omvendt).
  return fromPool ?? shots.slice().sort((a, b) => a.scrollPct - b.scrollPct)[0];
}

// ── iOS-simulator-capture (fang den kjørende appen rett inn i mockupen) ──────

export interface SimTarget {
  udid: string;
  label: string;
}

/** List bootede iOS-simulatorer (gjenbruker list_capture_sources). */
export async function listSimulators(): Promise<SimTarget[]> {
  try {
    const sources = await listCaptureSources();
    return sources
      .filter((s) => s.kind === 'ios_simulator' && s.available)
      .map((s) => ({ udid: s.id, label: s.label }));
  } catch {
    return [];
  }
}

/** Ett skjermbilde av en bootet simulator — ferdig data-URL (klar for dev.image). */
export async function captureSimShot(udid: string): Promise<string> {
  return iosSimScreenshot(udid);
}

// ── Accent-uttrekk (klient-side canvas-sampling) ─────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('kunne ikke laste bilde for fargeuttrekk'));
    img.src = src;
  });
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; } else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
  const to = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/**
 * Finn en «punchy» accent-farge i et skjermbilde: nedskalér, gruppér vivide
 * piksler (høy metning, midt-lyshet) i hue-bøtter, velg den mest fremtredende.
 * Faller tilbake til null hvis siden er nesten gråtone (ingen tydelig accent).
 */
export async function extractAccentFromImage(dataUrl: string): Promise<string | null> {
  let img: HTMLImageElement;
  try {
    img = await loadImage(dataUrl);
  } catch {
    return null;
  }
  const S = 64;
  const canvas = document.createElement('canvas');
  canvas.width = S; canvas.height = S;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, S, S);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, S, S).data;
  } catch {
    return null; // tainted canvas (skal ikke skje for data-URL, men vær trygg)
  }
  // 24 hue-bøtter à 15°; vekt = metning² så sterke farger dominerer.
  const buckets = new Array(24).fill(0);
  const sat = new Array(24).fill(0);
  const lit = new Array(24).fill(0);
  const cnt = new Array(24).fill(0);
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 200) continue;
    const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    if (s < 0.35 || l < 0.22 || l > 0.78) continue; // hopp over grått/for mørkt/for lyst
    const b = Math.min(23, Math.floor(h / 15));
    const w = s * s;
    buckets[b] += w;
    sat[b] += s; lit[b] += l; cnt[b] += 1;
  }
  let best = -1, bestW = 0;
  for (let b = 0; b < 24; b++) {
    if (buckets[b] > bestW) { bestW = buckets[b]; best = b; }
  }
  if (best < 0 || cnt[best] < 3) return null; // ingen tydelig accent
  const h = best * 15 + 7.5;
  const s = Math.min(0.85, Math.max(0.5, sat[best] / cnt[best]));
  const l = Math.min(0.62, Math.max(0.45, lit[best] / cnt[best]));
  return hslToHex(h, s, l);
}
