/**
 * Canvas compositor — recompose bands into an 8-bit RGBA buffer within
 * a bounded rectangle. The point is to avoid recomposing the whole
 * image on every brush stamp: compute the stamp's bbox, paint just
 * that rect into the display buffer, then `putImageData(..., rect)`
 * onto the visible canvas.
 *
 * Pure and React-free so it can be unit-tested in isolation.
 */

import type { DecompositionBands } from './decomposition';

/** Inclusive rectangle in pixel coordinates. */
export type Rect = { x0: number; y0: number; x1: number; y1: number };

export function emptyRect(): Rect {
  return { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
}

export function isEmptyRect(r: Rect): boolean {
  return r.x1 < r.x0 || r.y1 < r.y0;
}

/** Clip a rect to [0..width-1] × [0..height-1], integer-rounded. */
export function clipRect(r: Rect, width: number, height: number): Rect {
  return {
    x0: Math.max(0, Math.floor(r.x0)),
    y0: Math.max(0, Math.floor(r.y0)),
    x1: Math.min(width - 1, Math.ceil(r.x1)),
    y1: Math.min(height - 1, Math.ceil(r.y1)),
  };
}

/** Rect covering a stamp's circular footprint, clipped to image bounds. */
export function stampRect(
  cx: number,
  cy: number,
  radius: number,
  width: number,
  height: number,
): Rect {
  return clipRect(
    { x0: cx - radius, y0: cy - radius, x1: cx + radius, y1: cy + radius },
    width,
    height,
  );
}

/** Smallest rect containing both inputs. Empty rects are neutral elements. */
export function unionRect(a: Rect, b: Rect): Rect {
  if (isEmptyRect(a)) return b;
  if (isEmptyRect(b)) return a;
  return {
    x0: Math.min(a.x0, b.x0),
    y0: Math.min(a.y0, b.y0),
    x1: Math.max(a.x1, b.x1),
    y1: Math.max(a.y1, b.y1),
  };
}

/**
 * Recompose the bands within `rect` and write the clamped 8-bit RGBA
 * result into `target`. `target` is assumed to be at image resolution
 * with stride `width × 4`; positions outside the rect are left alone.
 * Alpha is forced to 255 — freq-sep edits don't touch coverage.
 */
export function paintBandsToRgba(
  bands: DecompositionBands,
  rect: Rect,
  target: Uint8ClampedArray,
): void {
  if (isEmptyRect(rect)) return;
  const low = bands.low;
  const high = bands.high;
  const mid = bands.kind === 'three-band' ? bands.mid : null;
  const width = low.width;
  for (let y = rect.y0; y <= rect.y1; y++) {
    const row = y * width;
    for (let x = rect.x0; x <= rect.x1; x++) {
      const idx = (row + x) * 4;
      let r = low.data[idx] + high.data[idx];
      let g = low.data[idx + 1] + high.data[idx + 1];
      let b = low.data[idx + 2] + high.data[idx + 2];
      if (mid) {
        r += mid.data[idx];
        g += mid.data[idx + 1];
        b += mid.data[idx + 2];
      }
      const rv = r * 255;
      const gv = g * 255;
      const bv = b * 255;
      target[idx] = rv < 0 ? 0 : rv > 255 ? 255 : Math.round(rv);
      target[idx + 1] = gv < 0 ? 0 : gv > 255 ? 255 : Math.round(gv);
      target[idx + 2] = bv < 0 ? 0 : bv > 255 ? 255 : Math.round(bv);
      target[idx + 3] = 255;
    }
  }
}
