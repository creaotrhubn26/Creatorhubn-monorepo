import { describe, expect, it } from 'vitest';
import {
  clipRect,
  emptyRect,
  isEmptyRect,
  paintBandsToRgba,
  stampRect,
  unionRect,
} from '../compositor';
import { decompose, rgbaToFloat32, type Float32Image } from '../decomposition';

function randomRgba(w: number, h: number, seed = 1): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4);
  let s = seed;
  for (let i = 0; i < w * h; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    data[i * 4] = s & 0xff;
    data[i * 4 + 1] = (s >> 8) & 0xff;
    data[i * 4 + 2] = (s >> 16) & 0xff;
    data[i * 4 + 3] = 255;
  }
  return data;
}

describe('rect helpers', () => {
  it('emptyRect is empty', () => {
    expect(isEmptyRect(emptyRect())).toBe(true);
  });

  it('clipRect clamps to image bounds and rounds outward', () => {
    const r = clipRect({ x0: -2.7, y0: 0.3, x1: 10.4, y1: 20.9 }, 8, 16);
    expect(r).toEqual({ x0: 0, y0: 0, x1: 7, y1: 15 });
  });

  it('stampRect grows by radius in each direction and clips', () => {
    const r = stampRect(5, 5, 3, 100, 100);
    expect(r).toEqual({ x0: 2, y0: 2, x1: 8, y1: 8 });
    const edge = stampRect(1, 1, 5, 100, 100);
    expect(edge).toEqual({ x0: 0, y0: 0, x1: 6, y1: 6 });
  });

  it('unionRect covers both, treats empty as neutral', () => {
    const a = { x0: 2, y0: 2, x1: 5, y1: 5 };
    const b = { x0: 4, y0: 1, x1: 8, y1: 3 };
    expect(unionRect(a, b)).toEqual({ x0: 2, y0: 1, x1: 8, y1: 5 });
    expect(unionRect(emptyRect(), a)).toEqual(a);
    expect(unionRect(a, emptyRect())).toEqual(a);
  });
});

describe('paintBandsToRgba', () => {
  it('round-trips original bytes within 1 quantisation unit on untouched bands', () => {
    const w = 16;
    const h = 12;
    const src = randomRgba(w, h);
    const float = rgbaToFloat32({ data: src, width: w, height: h });
    const bands = decompose(float, { lowSigma: 3 });
    const target = new Uint8ClampedArray(w * h * 4);
    paintBandsToRgba(bands, { x0: 0, y0: 0, x1: w - 1, y1: h - 1 }, target);

    // Sum of low + high should reconstruct the original within rounding error.
    for (let i = 0; i < src.length; i += 4) {
      expect(Math.abs(target[i] - src[i])).toBeLessThanOrEqual(1);
      expect(Math.abs(target[i + 1] - src[i + 1])).toBeLessThanOrEqual(1);
      expect(Math.abs(target[i + 2] - src[i + 2])).toBeLessThanOrEqual(1);
      expect(target[i + 3]).toBe(255);
    }
  });

  it('three-band reconstruction matches two-band reconstruction byte-for-byte', () => {
    const w = 16;
    const h = 12;
    const src = randomRgba(w, h, 42);
    const float = rgbaToFloat32({ data: src, width: w, height: h });
    const bands2 = decompose(float, { lowSigma: 4 });
    const bands3 = decompose(float, { lowSigma: 4, midSigma: 1 });
    const full: Rect = { x0: 0, y0: 0, x1: w - 1, y1: h - 1 };
    const t2 = new Uint8ClampedArray(w * h * 4);
    const t3 = new Uint8ClampedArray(w * h * 4);
    paintBandsToRgba(bands2, full, t2);
    paintBandsToRgba(bands3, full, t3);
    for (let i = 0; i < t2.length; i++) {
      expect(t3[i]).toBe(t2[i]);
    }
  });

  it('only writes within rect, leaves pixels outside untouched', () => {
    const w = 8;
    const h = 8;
    const src = randomRgba(w, h);
    const float = rgbaToFloat32({ data: src, width: w, height: h });
    const bands = decompose(float, { lowSigma: 2 });
    const target = new Uint8ClampedArray(w * h * 4).fill(99);
    // Paint only the top-left 3×3 block.
    paintBandsToRgba(bands, { x0: 0, y0: 0, x1: 2, y1: 2 }, target);
    // Pixel inside rect should differ from 99 (recomposed value).
    expect(target[0]).not.toBe(99);
    // Pixel outside rect should still be 99.
    expect(target[(5 * w + 5) * 4]).toBe(99);
  });

  it('clamps out-of-range floats', () => {
    // Construct a band pair whose low is saturated above 1.
    const low: Float32Image = {
      data: new Float32Array([2, 0.5, -0.5, 1]),
      width: 1,
      height: 1,
      channels: 4,
    };
    const high: Float32Image = {
      data: new Float32Array([0, 0, 0, 0]),
      width: 1,
      height: 1,
      channels: 4,
    };
    const bands = { kind: 'two-band' as const, low, high };
    const target = new Uint8ClampedArray(4);
    paintBandsToRgba(bands, { x0: 0, y0: 0, x1: 0, y1: 0 }, target);
    expect(target[0]).toBe(255); // 2.0 clamped to 1.0 → 255
    expect(target[1]).toBe(128); // 0.5 → 128
    expect(target[2]).toBe(0);   // -0.5 clamped to 0
    expect(target[3]).toBe(255); // alpha forced
  });

  it('is a no-op on an empty rect', () => {
    const w = 4;
    const h = 4;
    const src = randomRgba(w, h);
    const float = rgbaToFloat32({ data: src, width: w, height: h });
    const bands = decompose(float, { lowSigma: 1 });
    const target = new Uint8ClampedArray(w * h * 4).fill(7);
    paintBandsToRgba(bands, emptyRect(), target);
    for (let i = 0; i < target.length; i++) expect(target[i]).toBe(7);
  });
});

type Rect = { x0: number; y0: number; x1: number; y1: number };
