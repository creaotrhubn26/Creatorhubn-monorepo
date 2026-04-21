/**
 * 3D LUT → 2D atlas encoder for WebGL1-compatible preview.
 *
 * WebGL1 lacks sampler3D, so we flatten an N×N×N LUT into a
 * (N*N) × N RGBA texture laid out b-sliced: blue slice k occupies
 * columns [k*N .. (k+1)*N) in the atlas. Inside a slice, x = red, y = green.
 *
 * The fragment shader then does trilinear interpolation by:
 *   1. Computing (r, g, b) grid coordinates
 *   2. Sampling two blue slices (floor and ceil of b)
 *   3. Bilinear interpolating within each slice
 *   4. Mixing the two results by b's fractional part
 *
 * Matches the Python runner's `_apply_3d_trilinear` exactly on identity
 * LUTs — the test suite asserts this against a known LUT table.
 */

export interface LutAtlas {
  size: number;
  pixels: Uint8Array;
  width: number;
  height: number;
}

/**
 * Encode a flat `size**3 * 3` float32 table into a uint8 atlas suitable
 * for ``gl.texImage2D`` with RGBA format.
 *
 * Table layout on input (matches Adobe order): index = r + size*(g + size*b).
 * Output atlas: width = size*size, height = size. Alpha is always 255.
 */
export function encodeLutAtlas(
  size: number,
  table: Float32Array,
): LutAtlas {
  if (!(size >= 2 && size <= 65)) {
    throw new Error(`LUT size ${size} out of range [2, 65].`);
  }
  const expected = size * size * size * 3;
  if (table.length !== expected) {
    throw new Error(`LUT table length ${table.length} does not match size³*3 = ${expected}.`);
  }
  const width = size * size;
  const height = size;
  const pixels = new Uint8Array(width * height * 4);

  for (let b = 0; b < size; b += 1) {
    for (let g = 0; g < size; g += 1) {
      for (let r = 0; r < size; r += 1) {
        const srcIdx = (r + size * (g + size * b)) * 3;
        const atlasX = b * size + r;
        const atlasY = g;
        const dstIdx = (atlasY * width + atlasX) * 4;
        pixels[dstIdx] = clampByte(table[srcIdx] * 255);
        pixels[dstIdx + 1] = clampByte(table[srcIdx + 1] * 255);
        pixels[dstIdx + 2] = clampByte(table[srcIdx + 2] * 255);
        pixels[dstIdx + 3] = 255;
      }
    }
  }
  return { size, pixels, width, height };
}

function clampByte(value: number): number {
  if (value <= 0) return 0;
  if (value >= 255) return 255;
  return Math.round(value);
}

/**
 * Bilinear-in-slice + linear-across-slice sampler, implemented in JS for
 * tests. The WebGL shader performs the same math. Returned triplet is
 * RGB in [0, 255] to match the atlas. Pure function — no WebGL.
 */
export function sampleLutAtlasJs(
  atlas: LutAtlas,
  r: number,
  g: number,
  b: number,
): [number, number, number] {
  const size = atlas.size;
  const max = size - 1;
  const rf = clamp01(r) * max;
  const gf = clamp01(g) * max;
  const bf = clamp01(b) * max;
  const r0 = Math.floor(rf), r1 = Math.min(max, r0 + 1), tr = rf - r0;
  const g0 = Math.floor(gf), g1 = Math.min(max, g0 + 1), tg = gf - g0;
  const b0 = Math.floor(bf), b1 = Math.min(max, b0 + 1), tb = bf - b0;

  const low = bilinearSlice(atlas, b0, r0, r1, tr, g0, g1, tg);
  const high = bilinearSlice(atlas, b1, r0, r1, tr, g0, g1, tg);
  return [
    low[0] * (1 - tb) + high[0] * tb,
    low[1] * (1 - tb) + high[1] * tb,
    low[2] * (1 - tb) + high[2] * tb,
  ];
}

function bilinearSlice(
  atlas: LutAtlas,
  b: number,
  r0: number,
  r1: number,
  tr: number,
  g0: number,
  g1: number,
  tg: number,
): [number, number, number] {
  const c00 = pixel(atlas, b, r0, g0);
  const c10 = pixel(atlas, b, r1, g0);
  const c01 = pixel(atlas, b, r0, g1);
  const c11 = pixel(atlas, b, r1, g1);
  const c0: [number, number, number] = [
    c00[0] * (1 - tr) + c10[0] * tr,
    c00[1] * (1 - tr) + c10[1] * tr,
    c00[2] * (1 - tr) + c10[2] * tr,
  ];
  const c1: [number, number, number] = [
    c01[0] * (1 - tr) + c11[0] * tr,
    c01[1] * (1 - tr) + c11[1] * tr,
    c01[2] * (1 - tr) + c11[2] * tr,
  ];
  return [
    c0[0] * (1 - tg) + c1[0] * tg,
    c0[1] * (1 - tg) + c1[1] * tg,
    c0[2] * (1 - tg) + c1[2] * tg,
  ];
}

function pixel(atlas: LutAtlas, b: number, r: number, g: number): [number, number, number] {
  const atlasX = b * atlas.size + r;
  const atlasY = g;
  const idx = (atlasY * atlas.width + atlasX) * 4;
  return [atlas.pixels[idx], atlas.pixels[idx + 1], atlas.pixels[idx + 2]];
}

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}
