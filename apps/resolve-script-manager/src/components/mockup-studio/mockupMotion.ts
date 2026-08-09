/**
 * mockupMotion.ts — animasjons-tidslinje for Mockup Studio.
 *
 * Gjør en statisk mockup om til en «levende» avsløring: enheter glir inn, tekst
 * avsløres, callouts popper inn ÉN ETTER ÉN, lupen zoomer inn til slutt, mind
 * map-sliden skalerer opp. Ren/deterministisk — kompositoren spør `revealFor()`
 * per element ved fremdrift t (0..1) og pakker tegningen i transform + alpha.
 *
 * Selve videoeksporten (MediaRecorder → WebM) spiller av frames i sanntid.
 */

export interface MotionConfig {
  /** Total lengde i sekunder (avsløring + et lite hvile-slag på slutten). */
  seconds: number;
  fps: number;
}

export const MOTION_PRESETS: { id: string; label: string; cfg: MotionConfig }[] = [
  { id: 'story', label: 'Story (6s)', cfg: { seconds: 6, fps: 30 } },
  { id: 'reel', label: 'Reel (4s)', cfg: { seconds: 4, fps: 30 } },
  { id: 'long', label: 'Detaljert (9s)', cfg: { seconds: 9, fps: 30 } },
];
export const DEFAULT_MOTION: MotionConfig = MOTION_PRESETS[0].cfg;

export type RevealKind = 'device' | 'text' | 'marker' | 'callout' | 'loupe' | 'mindmap';

export interface Reveal {
  /** 0 = usynlig, 1 = fullt inne. */
  p: number;
  alpha: number;
  /** Vertikal forskyvning (base-px) — positiv = starter lavere, glir opp. */
  ty: number;
  scale: number;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
// Lett overshoot for «pop» (callouts/lupe).
const easeOutBack = (x: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };

/** Avsløringsvindu [start,slutt] i 0..1 for et element av gitt type + indeks. */
function windowFor(kind: RevealKind, i: number, total: number): [number, number] {
  switch (kind) {
    case 'device': return [Math.min(0.5, 0.02 + i * 0.09), Math.min(0.6, 0.02 + i * 0.09 + 0.34)];
    case 'text': return [Math.min(0.6, 0.24 + i * 0.06), Math.min(0.8, 0.24 + i * 0.06 + 0.28)];
    case 'marker': return [0.36, 0.56];
    case 'callout': {
      // Sekvensiell: hver callout popper inn etter den forrige.
      const span = Math.min(0.13, total > 0 ? 0.5 / Math.max(1, total) : 0.13);
      const s = 0.4 + i * span;
      return [Math.min(0.9, s), Math.min(0.98, s + 0.2)];
    }
    case 'loupe': return [0.82, 1.0];
    case 'mindmap': return [0.05, 0.62];
  }
}

/** Beregn avsløring for et element ved fremdrift t. */
export function revealFor(kind: RevealKind, i: number, total: number, t: number): Reveal {
  const [s, e] = windowFor(kind, i, total);
  return revealFromLocal(kind, (t - s) / Math.max(0.0001, e - s));
}

/** Samme inntoning som revealFor, men fra en direkte lokal progresjon (0..1) —
 *  brukes av multi-spor timelinen (hvert element følger sitt reveal-klipp). */
export function revealFromLocal(kind: RevealKind, local: number): Reveal {
  local = clamp01(local);
  const pop = kind === 'callout' || kind === 'loupe';
  const eased = pop ? easeOutBack(local) : easeOutCubic(local);
  const alpha = clamp01(local * 1.15); // litt raskere opasitet enn bevegelse
  if (kind === 'callout' || kind === 'loupe' || kind === 'marker' || kind === 'mindmap') {
    const from = kind === 'callout' ? 0.4 : kind === 'loupe' ? 0.55 : 0.9;
    return { p: local, alpha, ty: 0, scale: from + (1 - from) * eased };
  }
  // device / text: glir opp + svak skalering
  const rise = kind === 'device' ? 46 : 26;
  return { p: local, alpha, ty: rise * (1 - easeOutCubic(local)), scale: 0.98 + 0.02 * easeOutCubic(local) };
}
