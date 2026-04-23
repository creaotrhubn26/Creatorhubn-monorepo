/**
 * Output sharpening for the export pipeline.
 *
 * Applied **after resize** and **before watermark + encode** so the
 * sharpening operates at the final delivery resolution — not the
 * original. That matters because unsharp-mask radius is tuned in
 * pixels: a 0.8 px radius tight at 2048px wide becomes a useless
 * 0.1-px-ish mush if applied before downsampling from 6000px.
 *
 * Why this exists: social platforms (IG, FB, TikTok) aggressively
 * re-encode uploaded JPEGs with strong chroma subsampling. That
 * softens the image noticeably after upload. A light pre-sharpen
 * compensates — the image looks crisp AFTER the platform's
 * re-encode, not just in the editor. Food photography (e.g. the
 * Holy Crust pilot) lives or dies on texture detail: bread crust,
 * caramelised edges, pastry layers. Output sharpening is what
 * makes that survive the IG compression pass.
 *
 * The algorithm is a classic unsharp mask:
 *   out = in + amount × (in − blur(in, σ))
 *
 * Reuses `gaussianBlur` from the frequency-sep math core — that
 * blur is already a separable Gaussian with mirror boundaries and
 * 22 unit tests proving its correctness. No reason to re-implement.
 */

import {
  float32ToRgba,
  gaussianBlur,
  rgbaToFloat32,
  type Rgba8Buffer,
} from '../frequency-sep/decomposition';

export type SharpenLevel = 'none' | 'light' | 'standard' | 'strong';

export const SHARPEN_LEVELS: readonly SharpenLevel[] = [
  'none',
  'light',
  'standard',
  'strong',
] as const;

export interface SharpenParams {
  /** Gaussian sigma in output pixels. 0.5–1.0 is the social-media sweet spot. */
  sigma: number;
  /** Multiplier on the (in − blur) high-pass. 0 is a no-op, >1 tends to halo. */
  amount: number;
}

/**
 * Preset parameters per level. Chosen for screen/social delivery at
 * 1080–2048 px long edge — the size range Daniel's Holy Crust posts
 * land at after IG's own resize.
 */
export function sharpenParamsFor(level: SharpenLevel): SharpenParams | null {
  switch (level) {
    case 'none':
      return null;
    case 'light':
      // Light touch — compensates for IG re-encode without visibly
      // altering the in-editor look.
      return { sigma: 0.6, amount: 0.35 };
    case 'standard':
      // Evoto's "Screen Standard" equivalent. Visible crispness.
      return { sigma: 0.8, amount: 0.6 };
    case 'strong':
      // Use sparingly — starts showing haloing around high-contrast
      // edges on portraits. Fine for food / product / architecture.
      return { sigma: 1.0, amount: 0.9 };
  }
}

/** Human-readable Norwegian labels for the UI picker. Pinned by tests. */
export function describeSharpenLevel(level: SharpenLevel): string {
  switch (level) {
    case 'none':
      return 'Av';
    case 'light':
      return 'Lett (anbefalt for IG / FB)';
    case 'standard':
      return 'Standard';
    case 'strong':
      return 'Sterkere';
  }
}

/**
 * Apply unsharp mask to an 8-bit RGBA buffer. Returns a new buffer;
 * the input is not mutated. A `'none'` level short-circuits and
 * returns the input reference unchanged — no alloc, no work.
 *
 * Alpha is carried through without filtering (matches the frequency-sep
 * convention: sharpening is a luminance/chroma op, not a compositing op).
 */
export function applySharpen(source: Rgba8Buffer, level: SharpenLevel): Rgba8Buffer {
  const params = sharpenParamsFor(level);
  if (!params) return source;

  const float = rgbaToFloat32(source);
  const blurred = gaussianBlur(float, params.sigma);
  const amt = params.amount;
  const out = new Float32Array(float.data.length);
  const hasAlpha = float.channels === 4;

  // Unsharp: out = in + amount × (in − blur)
  // Channel-by-channel with clamp to [0, 1] so strong sharpening
  // can't produce negative or >1 values that would alias weirdly
  // through the uint8 conversion.
  if (hasAlpha) {
    for (let i = 0; i < out.length; i += 4) {
      const r = float.data[i];
      const g = float.data[i + 1];
      const b = float.data[i + 2];
      out[i] = clamp01(r + amt * (r - blurred.data[i]));
      out[i + 1] = clamp01(g + amt * (g - blurred.data[i + 1]));
      out[i + 2] = clamp01(b + amt * (b - blurred.data[i + 2]));
      out[i + 3] = float.data[i + 3];
    }
  } else {
    for (let i = 0; i < out.length; i++) {
      const v = float.data[i];
      out[i] = clamp01(v + amt * (v - blurred.data[i]));
    }
  }

  return float32ToRgba({
    data: out,
    width: float.width,
    height: float.height,
    channels: float.channels,
  });
}

/**
 * Apply sharpening in place on a canvas context. Caller passes the
 * 2D context and its dimensions; we read → sharpen → write back via
 * `putImageData`. No-op when level is `'none'`.
 */
export function applySharpenToCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  level: SharpenLevel,
): void {
  if (level === 'none') return;
  const imageData = ctx.getImageData(0, 0, width, height);
  const buffer: Rgba8Buffer = { data: imageData.data, width, height };
  const sharpened = applySharpen(buffer, level);
  // Reuse the context-allocated ImageData so the TS 5.x
  // `Uint8ClampedArray<ArrayBuffer>` generic is satisfied without a cast.
  imageData.data.set(sharpened.data);
  ctx.putImageData(imageData, 0, 0);
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
