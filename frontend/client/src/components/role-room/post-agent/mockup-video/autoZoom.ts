/**
 * autoZoom.ts — "auto-zoom på handling".
 *
 * Gir et polert produkt-demo-preg ved å zoome mykt inn der det skjer noe
 * (klikk/scroll/animasjon) og ut igjen når det er rolig. Bygd i to lag:
 *
 *   1. REN matematikk (denne fila, testbar uten nettleser):
 *        - detectMotion(): fra pre-beregnede frame-diff-prøver → bevegelses-
 *          sentroider + intensitet per tidspunkt.
 *        - buildZoomTrack(): bevegelses-prøver → glattede zoom-keyframes.
 *        - zoomAt(): interpoler keyframes til {scale, cx, cy} for en gitt tid.
 *
 *   2. Frame-sampling (gjøres i Chromium av pipelinen): tegn nedskalerte
 *      frames, regn ut absolutt-differanse mot forrige frame, og produser
 *      MotionSample[]. Den biten lever i mockup-polish-pro.mts.
 *
 * Designvalg:
 *   - Zoom er bevisst subtil (default maks 1.35×) og treg (EMA-glatting) så
 *     det ikke blir kvalmende. Et "dødt bånd" hindrer mikro-jitter.
 *   - cx/cy er normaliserte [0..1] i kildens koordinater, så de er
 *     oppløsnings-uavhengige.
 */

export interface MotionSample {
  /** Tidspunkt i sekunder. */
  t: number;
  /** Bevegelses-tyngdepunkt, normalisert [0..1] i kildebildet. */
  cx: number;
  cy: number;
  /** Hvor mye bevegelse (0 = stille, 1 = mye). Normaliseres internt. */
  energy: number;
}

export interface ZoomKeyframe {
  t: number;
  /** Zoom-faktor (1 = ingen zoom). */
  scale: number;
  /** Senterpunkt for zoom, normalisert [0..1]. */
  cx: number;
  cy: number;
}

export interface AutoZoomOptions {
  /** Maks zoom-faktor ved full bevegelse. Default 1.35. */
  maxScale?: number;
  /**
   * Glatting (EMA-alfa, 0..1). Lavere = tregere/roligere kamera. Default 0.12.
   */
  smoothing?: number;
  /**
   * Dødt bånd: energi under dette regnes som "stille" → zoomer ut. Default 0.15.
   */
  deadzone?: number;
}

/**
 * Normaliser energi til [0..1] basert på maksimal observert energi, slik at
 * absolutte diff-verdier (avhengig av oppløsning) ikke påvirker zoom-styrken.
 */
export function normalizeEnergy(samples: MotionSample[]): MotionSample[] {
  const maxE = samples.reduce((m, s) => Math.max(m, s.energy), 0);
  if (maxE <= 0) return samples.map((s) => ({ ...s, energy: 0 }));
  return samples.map((s) => ({ ...s, energy: Math.min(1, s.energy / maxE) }));
}

/**
 * Bygg et glattet zoom-spor fra bevegelses-prøver.
 *
 * - scale styres av (glattet) energi, klemt mellom 1 og maxScale.
 * - cx/cy følger (glattet) bevegelses-tyngdepunkt; når det er stille holder
 *   vi forrige senter (ingen brå hopp mot midten).
 */
export function buildZoomTrack(
  rawSamples: MotionSample[],
  opts: AutoZoomOptions = {},
): ZoomKeyframe[] {
  const { maxScale = 1.35, smoothing = 0.12, deadzone = 0.15 } = opts;
  const samples = normalizeEnergy(rawSamples);
  if (samples.length === 0) return [];

  const track: ZoomKeyframe[] = [];
  // Start nøytralt, sentrert.
  let sScale = 1;
  let sCx = 0.5;
  let sCy = 0.5;

  for (const s of samples) {
    // Energi under dødt bånd → mål mot ingen zoom; ellers skaler opp.
    const active = s.energy > deadzone;
    const targetScale = active ? 1 + (maxScale - 1) * s.energy : 1;
    // Hold senter når stille (følg kun handling når det er bevegelse).
    const targetCx = active ? s.cx : sCx;
    const targetCy = active ? s.cy : sCy;

    // EMA-glatting for rolig kamera.
    sScale += (targetScale - sScale) * smoothing;
    sCx += (targetCx - sCx) * smoothing;
    sCy += (targetCy - sCy) * smoothing;

    track.push({
      t: s.t,
      scale: clamp(sScale, 1, maxScale),
      cx: clamp(sCx, 0, 1),
      cy: clamp(sCy, 0, 1),
    });
  }
  return track;
}

/**
 * Interpoler zoom-sporet til en eksakt tid (lineært mellom keyframes).
 * Returnerer nøytral zoom hvis sporet er tomt.
 */
export function zoomAt(track: ZoomKeyframe[], t: number): { scale: number; cx: number; cy: number } {
  if (track.length === 0) return { scale: 1, cx: 0.5, cy: 0.5 };
  if (t <= track[0].t) return pick(track[0]);
  const last = track[track.length - 1];
  if (t >= last.t) return pick(last);

  // Binærsøk etter omkringliggende keyframes.
  let lo = 0;
  let hi = track.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (track[mid].t <= t) lo = mid;
    else hi = mid;
  }
  const a = track[lo];
  const b = track[hi];
  const span = b.t - a.t || 1;
  const k = (t - a.t) / span;
  return {
    scale: a.scale + (b.scale - a.scale) * k,
    cx: a.cx + (b.cx - a.cx) * k,
    cy: a.cy + (b.cy - a.cy) * k,
  };
}

/**
 * Oversett en zoom ({scale, cx, cy}) til et kilde-crop-rektangel (i piksler),
 * som drawImage kan bruke for å zoome inn mot senterpunktet uten å forlate
 * bildekanten.
 */
export function zoomToCrop(
  zoom: { scale: number; cx: number; cy: number },
  sourceWidth: number,
  sourceHeight: number,
): { sx: number; sy: number; sw: number; sh: number } {
  const scale = Math.max(1, zoom.scale);
  const sw = sourceWidth / scale;
  const sh = sourceHeight / scale;
  // Senter på cx/cy, men klem så croppet holder seg innenfor bildet.
  const sx = clamp(zoom.cx * sourceWidth - sw / 2, 0, sourceWidth - sw);
  const sy = clamp(zoom.cy * sourceHeight - sh / 2, 0, sourceHeight - sh);
  return { sx, sy, sw, sh };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function pick(k: ZoomKeyframe): { scale: number; cx: number; cy: number } {
  return { scale: k.scale, cx: k.cx, cy: k.cy };
}
