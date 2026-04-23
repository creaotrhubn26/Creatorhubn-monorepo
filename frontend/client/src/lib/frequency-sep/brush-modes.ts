/**
 * Brush modes — the actual per-pixel operations for frequency-sep
 * retouch. Each mode factory returns a `BrushOp`, which plugs straight
 * into `forEachStampPixel` from brush.ts. This keeps stroke geometry
 * (where pixels are touched, with what weight) separate from
 * pixel operations (what to do at each touched pixel).
 *
 * Modes operate **in place** on the band buffers. A stamp that covers
 * the same pixel multiple times in one stroke (overlap is expected,
 * since stamp spacing < radius) compounds — that is the retouch
 * "flow" behaviour you want: converges exponentially toward the
 * source the longer you hold the brush.
 *
 * Modes deliberately choose **which bands** to touch:
 *   - blur-low:   only `low`   (evens tone, pores untouched)
 *   - smooth-mid: only `mid`   (three-band only; flattens blemishes without
 *                               destroying pore detail in high)
 *   - heal:       `low` + `mid` (replaces tone from a clean source, keeps
 *                               the target's own high-frequency texture)
 *   - clone:      all bands    (classic stamp; entire image region copied)
 *   - dodge/burn: only `low`   (lightens or darkens tone, preserving chroma)
 */

import type { DecompositionBands, Float32Image } from './decomposition';

export type BrushOp = (x: number, y: number, weight: number) => void;

/** In-place lerp of all colour channels: `target += (source - target) * w`. */
function lerpPixel(
  target: Float32Image,
  source: Float32Image,
  dstIdx: number,
  srcIdx: number,
  w: number,
): void {
  const channels = target.channels;
  const colour = channels === 4 ? 3 : channels;
  for (let c = 0; c < colour; c++) {
    const t = target.data[dstIdx + c];
    const s = source.data[srcIdx + c];
    target.data[dstIdx + c] = t + (s - t) * w;
  }
}

function bandIdx(band: Float32Image, x: number, y: number): number {
  return (y * band.width + x) * band.channels;
}

/**
 * Blur-low: lerp the low band toward a precomputed blurred version of
 * itself. `blurredLow` is the caller's responsibility — typically
 * `gaussianBlur(bands.low, sigma)` computed once per stroke and passed
 * in so repeated stamps don't rerun the whole-image blur.
 *
 * The target and blurredLow must have the same dimensions; caller enforces.
 */
export function makeBlurLowOp(
  bands: DecompositionBands,
  blurredLow: Float32Image,
): BrushOp {
  const target = bands.low;
  return (x, y, w) => {
    const idx = bandIdx(target, x, y);
    lerpPixel(target, blurredLow, idx, idx, w);
  };
}

/**
 * Smooth-mid: lerp the mid band toward a precomputed blurred version
 * of itself. Only usable on three-band decompositions; a two-band
 * result would throw. Prefer this over blur-low for blemish flattening:
 * mid carries blemish structure without the global tone information
 * you want to preserve.
 */
export function makeSmoothMidOp(
  bands: DecompositionBands,
  blurredMid: Float32Image,
): BrushOp {
  if (bands.kind !== 'three-band') {
    throw new Error('smooth-mid requires a three-band decomposition');
  }
  const target = bands.mid;
  return (x, y, w) => {
    const idx = bandIdx(target, x, y);
    lerpPixel(target, blurredMid, idx, idx, w);
  };
}

/**
 * Heal: replace the target's low-frequency tone with the source's,
 * and (in three-band) also the mid band — but **keep the target's
 * own high band** so local pore / hair texture stays intact. This is
 * what separates a freq-sep heal from a dumb spot-clone: removes the
 * blemish colour without flattening skin texture.
 *
 * `sourceOffset` is in pixels, from target pixel to source pixel. UI
 * computes this (e.g., "pick cleanest patch within radius" or
 * user-dragged alt-click). Out-of-bounds source pixels are no-ops —
 * stamps near the image border simply don't heal the clipped side.
 */
export function makeHealOp(
  bands: DecompositionBands,
  sourceOffset: { dx: number; dy: number },
): BrushOp {
  const low = bands.low;
  const mid = bands.kind === 'three-band' ? bands.mid : null;
  const dx = Math.round(sourceOffset.dx);
  const dy = Math.round(sourceOffset.dy);
  return (x, y, w) => {
    const sx = x + dx;
    const sy = y + dy;
    if (sx < 0 || sy < 0 || sx >= low.width || sy >= low.height) return;
    const dstIdx = bandIdx(low, x, y);
    const srcIdx = bandIdx(low, sx, sy);
    lerpPixel(low, low, dstIdx, srcIdx, w);
    if (mid) {
      const mDst = bandIdx(mid, x, y);
      const mSrc = bandIdx(mid, sx, sy);
      lerpPixel(mid, mid, mDst, mSrc, w);
    }
  };
}

/**
 * Clone: classic clone-stamp. Copies every band from the source offset
 * to the target — i.e., the whole composited image. Use this when you
 * want to transplant a region wholesale (e.g., remove an object by
 * overpainting from nearby clean area). Out-of-bounds source is a no-op.
 */
export function makeCloneOp(
  bands: DecompositionBands,
  sourceOffset: { dx: number; dy: number },
): BrushOp {
  const low = bands.low;
  const high = bands.high;
  const mid = bands.kind === 'three-band' ? bands.mid : null;
  const dx = Math.round(sourceOffset.dx);
  const dy = Math.round(sourceOffset.dy);
  return (x, y, w) => {
    const sx = x + dx;
    const sy = y + dy;
    if (sx < 0 || sy < 0 || sx >= low.width || sy >= low.height) return;
    const dstIdx = bandIdx(low, x, y);
    const srcIdx = bandIdx(low, sx, sy);
    lerpPixel(low, low, dstIdx, srcIdx, w);
    lerpPixel(high, high, dstIdx, srcIdx, w);
    if (mid) lerpPixel(mid, mid, dstIdx, srcIdx, w);
  };
}

export type DodgeBurnRange = 'shadows' | 'midtones' | 'highlights' | 'all';

/**
 * Dodge (lighten) or burn (darken) the low band. Positive `amount`
 * lightens, negative darkens. The same delta is added to R/G/B so
 * chroma is preserved and only luminance shifts — this is the classic
 * "preserve hue" version photographers expect, not the ink-simulating
 * Photoshop dodge that pushes toward white and cyan.
 *
 * `range` restricts the effect to shadows/midtones/highlights using
 * a triangular weighting on the pixel's current luminance. `all` is
 * the default. Range weighting is computed from the target pixel's
 * luminance at the moment of application so successive stamps within
 * a stroke follow the tone as it shifts.
 */
export function makeDodgeBurnOp(
  lowBand: Float32Image,
  amount: number,
  range: DodgeBurnRange = 'all',
): BrushOp {
  return (x, y, w) => {
    const idx = bandIdx(lowBand, x, y);
    const r = lowBand.data[idx];
    const g = lowBand.data[idx + 1];
    const b = lowBand.data[idx + 2];
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    let rangeWeight: number;
    switch (range) {
      case 'shadows':
        rangeWeight = lum <= 0.5 ? 1 - lum / 0.5 : 0;
        break;
      case 'highlights':
        rangeWeight = lum >= 0.5 ? (lum - 0.5) / 0.5 : 0;
        break;
      case 'midtones':
        rangeWeight = 1 - Math.min(1, Math.abs(lum - 0.5) / 0.5);
        break;
      case 'all':
      default:
        rangeWeight = 1;
    }
    const delta = amount * w * rangeWeight;
    lowBand.data[idx] = r + delta;
    lowBand.data[idx + 1] = g + delta;
    lowBand.data[idx + 2] = b + delta;
  };
}
