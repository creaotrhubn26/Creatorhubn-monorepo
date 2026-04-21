/**
 * Pure hue ↔ band-weight helpers shared by the eyedropper and the HSL
 * panel. Kept out of the React layer so the math is unit-testable and
 * matches the Python runner / WebGL shader exactly.
 *
 * All hue inputs are in degrees on the full 0-360° HSV circle. Returns
 * band weights via the same raised-cosine window as
 * ``backend/gfpgan-runner/hsl_retouch.py`` — half-width 40°, normalised
 * per-pixel so the 8 weights always sum to 1.
 */

import { HSL_BAND_NAMES, type HslBandName } from './module-contract';

export const HSL_BAND_CENTRES_DEG: Record<HslBandName, number> = {
  red: 0,
  orange: 30,
  yellow: 60,
  green: 120,
  aqua: 180,
  blue: 240,
  purple: 270,
  magenta: 300,
};

export const HSL_BAND_HALF_WIDTH_DEG = 40;

export function circularDistance(a: number, b: number): number {
  const diff = Math.abs(a - b);
  return Math.min(diff, 360 - diff);
}

export function bandWeight(hueDeg: number, centreDeg: number, halfWidth = HSL_BAND_HALF_WIDTH_DEG): number {
  const distance = circularDistance(((hueDeg % 360) + 360) % 360, centreDeg);
  if (distance >= halfWidth) return 0;
  return 0.5 * (1 + Math.cos((Math.PI * distance) / halfWidth));
}

export interface BandWeightSummary {
  band: HslBandName;
  weight: number;
}

/** Ranked list of bands for a given hue, highest weight first. Zero-weight
 *  bands are included so callers can inspect the full distribution. */
export function bandWeightsForHue(hueDeg: number): BandWeightSummary[] {
  const hueNorm = ((hueDeg % 360) + 360) % 360;
  const raw = HSL_BAND_NAMES.map<BandWeightSummary>((band) => ({
    band,
    weight: bandWeight(hueNorm, HSL_BAND_CENTRES_DEG[band]),
  }));
  const sum = raw.reduce((s, r) => s + r.weight, 0);
  if (sum <= 0) {
    // Cold pixel — fall back to nearest-band indicator so the eyedropper
    // can still pick something meaningful (matches the Python fallback).
    let nearest: HslBandName = 'red';
    let best = Infinity;
    for (const band of HSL_BAND_NAMES) {
      const d = circularDistance(hueNorm, HSL_BAND_CENTRES_DEG[band]);
      if (d < best) {
        best = d;
        nearest = band;
      }
    }
    return HSL_BAND_NAMES.map((b) => ({ band: b, weight: b === nearest ? 1 : 0 }));
  }
  return raw
    .map<BandWeightSummary>((r) => ({ band: r.band, weight: r.weight / sum }))
    .sort((a, b) => b.weight - a.weight);
}

/** Dominant band for a hue — convenience wrapper. */
export function dominantBandForHue(hueDeg: number): HslBandName {
  return bandWeightsForHue(hueDeg)[0].band;
}

/** Convert sRGB [0,255] ints to HSV (H in degrees, S/V in [0,1]). */
export function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const d = max - min;
  let h = 0;
  if (d === 0) h = 0;
  else if (max === rr) h = 60 * (((gg - bb) / d) % 6);
  else if (max === gg) h = 60 * ((bb - rr) / d + 2);
  else h = 60 * ((rr - gg) / d + 4);
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

export interface SampledPixel {
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
  a: number;
  hueDeg: number;
  saturation: number;
  value: number;
  dominantBand: HslBandName;
  bandWeights: BandWeightSummary[];
}

/** Sample a single pixel from a canvas or image and classify its hue.
 *  The canvas must already be painted with the source image at a 1:1
 *  ratio (the preview canvas does this for us). */
export function samplePixelFromContext(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
): SampledPixel | null {
  try {
    const data = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
    const r = data[0];
    const g = data[1];
    const b = data[2];
    const a = data[3] ?? 255;
    const hsv = rgbToHsv(r, g, b);
    const weights = bandWeightsForHue(hsv.h);
    return {
      x,
      y,
      r,
      g,
      b,
      a,
      hueDeg: hsv.h,
      saturation: hsv.s,
      value: hsv.v,
      dominantBand: weights[0].band,
      bandWeights: weights,
    };
  } catch {
    // getImageData can throw on tainted canvases (cross-origin image
    // without CORS headers). The UI handles null by disabling the tool.
    return null;
  }
}
