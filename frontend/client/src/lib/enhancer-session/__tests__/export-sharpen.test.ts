import { describe, expect, it } from 'vitest';
import {
  applySharpen,
  describeSharpenLevel,
  SHARPEN_LEVELS,
  sharpenParamsFor,
  type SharpenLevel,
} from '../export-sharpen';
import type { Rgba8Buffer } from '../../frequency-sep/decomposition';

function checkerboard(w: number, h: number): Rgba8Buffer {
  // Alternating black/white pixels — max-frequency pattern. Unsharp mask
  // ought to do almost nothing useful here (no mid-frequency content to
  // enhance), but it's a solid torture test for the pipeline wiring.
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const v = (x + y) % 2 === 0 ? 255 : 0;
      data[idx] = v;
      data[idx + 1] = v;
      data[idx + 2] = v;
      data[idx + 3] = 255;
    }
  }
  return { data, width: w, height: h };
}

function gradientWithEdge(w: number, h: number): Rgba8Buffer {
  // Left half dark grey, right half light grey with a sharp step at w/2.
  // Unsharp mask should enhance contrast at the edge and leave flat
  // regions mostly alone.
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const v = x < w / 2 ? 100 : 180;
      data[idx] = v;
      data[idx + 1] = v;
      data[idx + 2] = v;
      data[idx + 3] = 255;
    }
  }
  return { data, width: w, height: h };
}

function at(buffer: Rgba8Buffer, x: number, y: number): [number, number, number, number] {
  const i = (y * buffer.width + x) * 4;
  return [buffer.data[i], buffer.data[i + 1], buffer.data[i + 2], buffer.data[i + 3]];
}

describe('sharpenParamsFor', () => {
  it('returns null for "none"', () => {
    expect(sharpenParamsFor('none')).toBeNull();
  });

  it('returns increasing amount for light → standard → strong', () => {
    const light = sharpenParamsFor('light');
    const standard = sharpenParamsFor('standard');
    const strong = sharpenParamsFor('strong');
    expect(light).not.toBeNull();
    expect(standard).not.toBeNull();
    expect(strong).not.toBeNull();
    expect(light!.amount).toBeLessThan(standard!.amount);
    expect(standard!.amount).toBeLessThan(strong!.amount);
  });

  it('sigma stays small (sub-pixel) even at strong — this is output sharpening, not localized', () => {
    expect(sharpenParamsFor('strong')!.sigma).toBeLessThanOrEqual(1.5);
  });
});

describe('applySharpen', () => {
  it('returns the same reference for level=none (no work, no alloc)', () => {
    const src = checkerboard(8, 8);
    const out = applySharpen(src, 'none');
    expect(out).toBe(src);
  });

  it('produces a new buffer for any non-none level', () => {
    const src = gradientWithEdge(16, 4);
    const out = applySharpen(src, 'light');
    expect(out).not.toBe(src);
    expect(out.data).not.toBe(src.data);
    expect(out.width).toBe(16);
    expect(out.height).toBe(4);
  });

  it('preserves dimensions', () => {
    const src = gradientWithEdge(32, 24);
    for (const level of SHARPEN_LEVELS) {
      const out = applySharpen(src, level);
      expect(out.width).toBe(32);
      expect(out.height).toBe(24);
    }
  });

  it('passes alpha through untouched', () => {
    const w = 8;
    const h = 4;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      data[i * 4] = 128;
      data[i * 4 + 1] = 64;
      data[i * 4 + 2] = 200;
      data[i * 4 + 3] = (i * 17) & 0xff;
    }
    const src: Rgba8Buffer = { data, width: w, height: h };
    const out = applySharpen(src, 'strong');
    for (let i = 0; i < w * h; i++) {
      expect(out.data[i * 4 + 3]).toBe(data[i * 4 + 3]);
    }
  });

  it('enhances contrast around a sharp edge', () => {
    // Pixels just left of the edge should get slightly darker,
    // just right should get slightly lighter. That's the unsharp
    // overshoot that makes edges "pop".
    const src = gradientWithEdge(32, 4); // edge at x=16
    const out = applySharpen(src, 'standard');
    // Values far from the edge: barely changed.
    const leftFar = at(src, 2, 2);
    const leftFarOut = at(out, 2, 2);
    const rightFar = at(src, 28, 2);
    const rightFarOut = at(out, 28, 2);
    expect(Math.abs(leftFarOut[0] - leftFar[0])).toBeLessThanOrEqual(2);
    expect(Math.abs(rightFarOut[0] - rightFar[0])).toBeLessThanOrEqual(2);

    // Pixel just left of the edge should be *darker* than input
    // (overshoot into the darker side).
    const leftEdgeIn = at(src, 15, 2)[0];
    const leftEdgeOut = at(out, 15, 2)[0];
    expect(leftEdgeOut).toBeLessThanOrEqual(leftEdgeIn);

    // Pixel just right should be *lighter*.
    const rightEdgeIn = at(src, 16, 2)[0];
    const rightEdgeOut = at(out, 16, 2)[0];
    expect(rightEdgeOut).toBeGreaterThanOrEqual(rightEdgeIn);
  });

  it('stronger level produces larger absolute delta on edge pixels', () => {
    const src = gradientWithEdge(32, 4);
    const levels: SharpenLevel[] = ['light', 'standard', 'strong'];
    const deltas = levels.map((l) => {
      const out = applySharpen(src, l);
      return Math.abs(at(out, 16, 2)[0] - at(src, 16, 2)[0]);
    });
    expect(deltas[0]).toBeLessThanOrEqual(deltas[1]);
    expect(deltas[1]).toBeLessThanOrEqual(deltas[2]);
  });

  it('never produces negative or >255 pixels even at strong level', () => {
    // Build a pathological test image with contrast right at the clamp
    // edges so any clamp bug would overflow.
    const w = 16;
    const data = new Uint8ClampedArray(w * 4);
    for (let x = 0; x < w; x++) {
      const v = x < w / 2 ? 0 : 255;
      data[x * 4] = v;
      data[x * 4 + 1] = v;
      data[x * 4 + 2] = v;
      data[x * 4 + 3] = 255;
    }
    const src: Rgba8Buffer = { data, width: w, height: 1 };
    const out = applySharpen(src, 'strong');
    for (let i = 0; i < out.data.length; i++) {
      expect(out.data[i]).toBeGreaterThanOrEqual(0);
      expect(out.data[i]).toBeLessThanOrEqual(255);
    }
  });

  it('does not meaningfully alter a solid-colour region (no work on flat areas)', () => {
    const w = 32;
    const h = 32;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      data[i * 4] = 140;
      data[i * 4 + 1] = 90;
      data[i * 4 + 2] = 200;
      data[i * 4 + 3] = 255;
    }
    const src: Rgba8Buffer = { data, width: w, height: h };
    const out = applySharpen(src, 'standard');
    // Sample a pixel far from any edge (there are no edges here).
    const center = at(out, 16, 16);
    expect(Math.abs(center[0] - 140)).toBeLessThanOrEqual(1);
    expect(Math.abs(center[1] - 90)).toBeLessThanOrEqual(1);
    expect(Math.abs(center[2] - 200)).toBeLessThanOrEqual(1);
  });
});

describe('describeSharpenLevel', () => {
  it('produces a label for every level', () => {
    for (const level of SHARPEN_LEVELS) {
      expect(describeSharpenLevel(level).length).toBeGreaterThan(0);
    }
  });

  it('light level mentions IG / FB in the recommendation', () => {
    expect(describeSharpenLevel('light')).toMatch(/IG|FB/);
  });

  it('"none" is Norwegian "Av"', () => {
    expect(describeSharpenLevel('none')).toBe('Av');
  });
});

describe('SHARPEN_LEVELS', () => {
  it('lists the four levels in ascending strength order', () => {
    expect(SHARPEN_LEVELS).toEqual(['none', 'light', 'standard', 'strong']);
  });
});
