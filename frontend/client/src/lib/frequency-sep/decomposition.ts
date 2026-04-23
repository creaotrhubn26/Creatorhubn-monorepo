/**
 * Float32 frequency-separation math core.
 *
 * Everything in the retouch pipeline operates on Float32 buffers so that
 * repeated low/high/mid edits don't accumulate 8-bit quantisation noise
 * the way they would if we round-tripped through Uint8 after each brush
 * stroke. Display-referred, non-premultiplied RGBA in [0,1]; alpha is
 * carried through untouched because frequency separation is a luminance
 * and colour operation, not a compositing one.
 *
 * The high and mid bands are **signed residuals**, not images — their
 * values are centred around 0 and typically fall in [-0.5, 0.5]. Do not
 * render them directly; use `visualiseSignedBand()` for the band-preview
 * UI, and keep the unsigned representation in memory for math.
 *
 * No DOM dependencies: the `Rgba8Buffer` shape is structurally compatible
 * with browser `ImageData` so a canvas context can hand one in directly,
 * but the module also runs in Node / workers for the backend save path.
 */

/**
 * Structural type matching browser `ImageData` — pass an actual
 * `ImageData` from a canvas, or construct one yourself (e.g. on the
 * server) without pulling in a DOM polyfill.
 */
export type Rgba8Buffer = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

export type Float32Image = {
  data: Float32Array;
  width: number;
  height: number;
  /** 3 = RGB packed, 4 = RGBA packed. Alpha, when present, is pass-through. */
  channels: 3 | 4;
};

export type TwoBandDecomposition = {
  kind: 'two-band';
  /** Low-frequency image in [0,1]. Tonal base — skin colour, light, shadow. */
  low: Float32Image;
  /** Signed high-frequency residual centred on 0. Pores, hair, edges. */
  high: Float32Image;
};

export type ThreeBandDecomposition = {
  kind: 'three-band';
  /** Low band: blur with the large sigma. Global tone. */
  low: Float32Image;
  /** Signed mid-band residual. Blemishes, structure, redness. */
  mid: Float32Image;
  /** Signed high-band residual. Fine texture. */
  high: Float32Image;
};

export type DecompositionBands = TwoBandDecomposition | ThreeBandDecomposition;

export type DecomposeOptions = {
  /**
   * Gaussian sigma (in pixels) for the low band. Typical values for
   * portrait skin retouch at 24MP: 8–24. Too small and the low band
   * keeps texture you wanted to push to high; too large and local
   * tone shifts leak into high.
   */
  lowSigma: number;
  /**
   * Optional mid-band sigma. Must be strictly less than `lowSigma` to
   * produce a non-degenerate mid band. Omit (or pass 0) for classic
   * two-band separation.
   */
  midSigma?: number;
  /**
   * Use a bilateral filter for the low band instead of a plain Gaussian.
   * Preserves hard edges (jawline, eyelash) so they don't bleed into
   * the residual — the cost is O(radius²) instead of O(radius), so
   * only use on retouch-sized images.
   */
  useBilateralLow?: boolean;
  /**
   * Range sigma for the bilateral filter, in luminance units [0,1].
   * Smaller = more edge preservation, less smoothing across edges.
   * Defaults to 0.08, roughly 20 steps on an 8-bit ramp.
   */
  bilateralRangeSigma?: number;
};

/** 8-bit RGBA buffer → float32 RGBA in [0,1]. */
export function rgbaToFloat32(source: Rgba8Buffer): Float32Image {
  const { data, width, height } = source;
  const out = new Float32Array(width * height * 4);
  const inv = 1 / 255;
  for (let i = 0; i < data.length; i++) {
    out[i] = data[i] * inv;
  }
  return { data: out, width, height, channels: 4 };
}

/** Float32 RGB/RGBA in [0,1] → 8-bit RGBA buffer, clamped and rounded. */
export function float32ToRgba(img: Float32Image): Rgba8Buffer {
  const { data, width, height, channels } = img;
  const out = new Uint8ClampedArray(width * height * 4);
  if (channels === 4) {
    for (let i = 0; i < data.length; i++) {
      const v = data[i] * 255;
      out[i] = v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
    }
  } else {
    const n = width * height;
    for (let p = 0; p < n; p++) {
      for (let c = 0; c < 3; c++) {
        const v = data[p * 3 + c] * 255;
        out[p * 4 + c] = v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
      }
      out[p * 4 + 3] = 255;
    }
  }
  return { data: out, width, height };
}

export function cloneFloat32Image(img: Float32Image): Float32Image {
  return {
    data: new Float32Array(img.data),
    width: img.width,
    height: img.height,
    channels: img.channels,
  };
}

export function emptyLike(img: Float32Image): Float32Image {
  return {
    data: new Float32Array(img.data.length),
    width: img.width,
    height: img.height,
    channels: img.channels,
  };
}

/**
 * 1D Gaussian kernel, radius = ceil(3σ), unit-sum so blur preserves DC.
 * Exported for reuse by the brush engine (stamp falloff).
 */
export function gaussianKernel1D(sigma: number): Float32Array {
  if (sigma <= 0) {
    const k = new Float32Array(1);
    k[0] = 1;
    return k;
  }
  const radius = Math.max(1, Math.ceil(sigma * 3));
  const size = radius * 2 + 1;
  const k = new Float32Array(size);
  const s2 = 2 * sigma * sigma;
  let sum = 0;
  for (let i = 0; i < size; i++) {
    const x = i - radius;
    k[i] = Math.exp(-(x * x) / s2);
    sum += k[i];
  }
  const inv = 1 / sum;
  for (let i = 0; i < size; i++) k[i] *= inv;
  return k;
}

/**
 * Reflect a coordinate at the image border. Mirror reflection
 * (…abcba|abcde|edcba…) prevents the edge-darkening you get with
 * zero-padding and avoids the DC drift you get with clamp.
 */
function reflect(i: number, size: number): number {
  if (size <= 1) return 0;
  while (i < 0 || i >= size) {
    if (i < 0) i = -i - 1;
    if (i >= size) i = 2 * size - i - 1;
  }
  return i;
}

/**
 * Separable Gaussian blur on a float32 image. Alpha (channel 3) is copied
 * through without filtering so frequency separation on RGBA doesn't
 * change coverage. O(w·h·channels·radius) — the separable form is what
 * makes real-time retouch on 24MP stills feasible.
 */
export function gaussianBlur(img: Float32Image, sigma: number): Float32Image {
  if (sigma <= 0) return cloneFloat32Image(img);
  const kernel = gaussianKernel1D(sigma);
  const radius = (kernel.length - 1) >> 1;
  const { width, height, channels } = img;
  const src = img.data;
  const temp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const hasAlpha = channels === 4;

  // Horizontal pass: src -> temp
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const dstIdx = (row + x) * channels;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let k = -radius; k <= radius; k++) {
        const sx = reflect(x + k, width);
        const sIdx = (row + sx) * channels;
        const w = kernel[k + radius];
        r += w * src[sIdx];
        g += w * src[sIdx + 1];
        b += w * src[sIdx + 2];
      }
      temp[dstIdx] = r;
      temp[dstIdx + 1] = g;
      temp[dstIdx + 2] = b;
      if (hasAlpha) temp[dstIdx + 3] = src[dstIdx + 3];
    }
  }

  // Vertical pass: temp -> out
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dstIdx = (y * width + x) * channels;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let k = -radius; k <= radius; k++) {
        const sy = reflect(y + k, height);
        const sIdx = (sy * width + x) * channels;
        const w = kernel[k + radius];
        r += w * temp[sIdx];
        g += w * temp[sIdx + 1];
        b += w * temp[sIdx + 2];
      }
      out[dstIdx] = r;
      out[dstIdx + 1] = g;
      out[dstIdx + 2] = b;
      if (hasAlpha) out[dstIdx + 3] = temp[dstIdx + 3];
    }
  }

  return { data: out, width, height, channels };
}

/**
 * Edge-preserving bilateral filter. Spatial weight is Gaussian in pixels;
 * range weight is Gaussian on luminance (Rec.709) so all three RGB
 * channels are coupled — prevents colour shift along jawline and lash
 * edges that you'd get from filtering R/G/B independently.
 *
 * Non-separable (proper bilateral isn't separable); kernel radius is
 * capped at 2σ rather than 3σ because the range weight already kills
 * far samples. Still O(r²) per pixel — use only where edge preservation
 * actually matters (low band under skin), not globally.
 */
export function bilateralFilter(
  img: Float32Image,
  spatialSigma: number,
  rangeSigma: number,
): Float32Image {
  if (spatialSigma <= 0) return cloneFloat32Image(img);
  const { width, height, channels } = img;
  const src = img.data;
  const radius = Math.max(1, Math.ceil(spatialSigma * 2));
  const kSize = radius * 2 + 1;
  const s2 = 2 * spatialSigma * spatialSigma;
  const r2 = 2 * rangeSigma * rangeSigma;
  const spatial = new Float32Array(kSize * kSize);
  for (let ky = -radius; ky <= radius; ky++) {
    for (let kx = -radius; kx <= radius; kx++) {
      spatial[(ky + radius) * kSize + (kx + radius)] = Math.exp(-(kx * kx + ky * ky) / s2);
    }
  }

  const out = new Float32Array(src.length);
  const hasAlpha = channels === 4;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pIdx = (y * width + x) * channels;
      const cR = src[pIdx];
      const cG = src[pIdx + 1];
      const cB = src[pIdx + 2];
      const centreLum = 0.2126 * cR + 0.7152 * cG + 0.0722 * cB;

      let accR = 0;
      let accG = 0;
      let accB = 0;
      let wSum = 0;

      for (let ky = -radius; ky <= radius; ky++) {
        const sy = reflect(y + ky, height);
        for (let kx = -radius; kx <= radius; kx++) {
          const sx = reflect(x + kx, width);
          const sIdx = (sy * width + sx) * channels;
          const sR = src[sIdx];
          const sG = src[sIdx + 1];
          const sB = src[sIdx + 2];
          const lum = 0.2126 * sR + 0.7152 * sG + 0.0722 * sB;
          const dl = lum - centreLum;
          const w =
            spatial[(ky + radius) * kSize + (kx + radius)] * Math.exp(-(dl * dl) / r2);
          accR += w * sR;
          accG += w * sG;
          accB += w * sB;
          wSum += w;
        }
      }

      const inv = wSum > 0 ? 1 / wSum : 0;
      out[pIdx] = accR * inv;
      out[pIdx + 1] = accG * inv;
      out[pIdx + 2] = accB * inv;
      if (hasAlpha) out[pIdx + 3] = src[pIdx + 3];
    }
  }

  return { data: out, width, height, channels };
}

/** Element-wise a − b on colour channels; alpha carried from `a`. */
function subtractImages(a: Float32Image, b: Float32Image): Float32Image {
  assertSameShape(a, b);
  const data = new Float32Array(a.data.length);
  const hasAlpha = a.channels === 4;
  if (hasAlpha) {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = a.data[i] - b.data[i];
      data[i + 1] = a.data[i + 1] - b.data[i + 1];
      data[i + 2] = a.data[i + 2] - b.data[i + 2];
      data[i + 3] = a.data[i + 3];
    }
  } else {
    for (let i = 0; i < data.length; i++) data[i] = a.data[i] - b.data[i];
  }
  return { data, width: a.width, height: a.height, channels: a.channels };
}

/** Element-wise a + b on colour channels; alpha carried from `a`. */
function addImages(a: Float32Image, b: Float32Image): Float32Image {
  assertSameShape(a, b);
  const data = new Float32Array(a.data.length);
  const hasAlpha = a.channels === 4;
  if (hasAlpha) {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = a.data[i] + b.data[i];
      data[i + 1] = a.data[i + 1] + b.data[i + 1];
      data[i + 2] = a.data[i + 2] + b.data[i + 2];
      data[i + 3] = a.data[i + 3];
    }
  } else {
    for (let i = 0; i < data.length; i++) data[i] = a.data[i] + b.data[i];
  }
  return { data, width: a.width, height: a.height, channels: a.channels };
}

function assertSameShape(a: Float32Image, b: Float32Image): void {
  if (a.width !== b.width || a.height !== b.height || a.channels !== b.channels) {
    throw new Error(
      `Float32Image shape mismatch: ${a.width}×${a.height}c${a.channels} vs ${b.width}×${b.height}c${b.channels}`,
    );
  }
}

/**
 * Split an image into frequency bands.
 *
 * Two-band:
 *   low  = blur(img, lowSigma)
 *   high = img − low                               (signed, centred on 0)
 *   img  = low + high                              (exact up to float eps)
 *
 * Three-band (midSigma < lowSigma):
 *   low  = blur(img, lowSigma)
 *   midB = blur(img, midSigma)
 *   mid  = midB − low                              (signed)
 *   high = img − midB                              (signed)
 *   img  = low + mid + high                        (exact up to float eps)
 */
export function decompose(img: Float32Image, opts: DecomposeOptions): DecompositionBands {
  const low = opts.useBilateralLow
    ? bilateralFilter(img, opts.lowSigma, opts.bilateralRangeSigma ?? 0.08)
    : gaussianBlur(img, opts.lowSigma);

  if (opts.midSigma && opts.midSigma > 0 && opts.midSigma < opts.lowSigma) {
    const midBlur = gaussianBlur(img, opts.midSigma);
    return {
      kind: 'three-band',
      low,
      mid: subtractImages(midBlur, low),
      high: subtractImages(img, midBlur),
    };
  }

  return {
    kind: 'two-band',
    low,
    high: subtractImages(img, low),
  };
}

/** Sum the bands back into a single image. Float-exact up to rounding. */
export function recompose(bands: DecompositionBands): Float32Image {
  if (bands.kind === 'two-band') return addImages(bands.low, bands.high);
  return addImages(addImages(bands.low, bands.mid), bands.high);
}

/**
 * Shift a signed band by +0.5 so it can be shown on screen as an 8-bit
 * preview (mid-grey = 0 residual). The returned image is display-only;
 * keep the original signed band in memory for any further math.
 */
export function visualiseSignedBand(band: Float32Image): Float32Image {
  const data = new Float32Array(band.data.length);
  const hasAlpha = band.channels === 4;
  if (hasAlpha) {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = band.data[i] + 0.5;
      data[i + 1] = band.data[i + 1] + 0.5;
      data[i + 2] = band.data[i + 2] + 0.5;
      data[i + 3] = 1;
    }
  } else {
    for (let i = 0; i < data.length; i++) data[i] = band.data[i] + 0.5;
  }
  return { data, width: band.width, height: band.height, channels: band.channels };
}
