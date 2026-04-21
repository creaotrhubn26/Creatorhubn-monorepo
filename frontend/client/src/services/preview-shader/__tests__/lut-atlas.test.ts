import { describe, expect, it } from 'vitest';
import { encodeLutAtlas, sampleLutAtlasJs } from '../lut-atlas';

function buildIdentityTable(size: number): Float32Array {
  const out = new Float32Array(size * size * size * 3);
  for (let b = 0; b < size; b += 1) {
    for (let g = 0; g < size; g += 1) {
      for (let r = 0; r < size; r += 1) {
        const idx = (r + size * (g + size * b)) * 3;
        out[idx] = r / (size - 1);
        out[idx + 1] = g / (size - 1);
        out[idx + 2] = b / (size - 1);
      }
    }
  }
  return out;
}

describe('encodeLutAtlas', () => {
  it('produces a (size² × size) RGBA atlas', () => {
    const atlas = encodeLutAtlas(5, buildIdentityTable(5));
    expect(atlas.width).toBe(25);
    expect(atlas.height).toBe(5);
    expect(atlas.pixels.length).toBe(25 * 5 * 4);
  });

  it('rejects mismatched table length', () => {
    expect(() => encodeLutAtlas(5, new Float32Array(10))).toThrow(/does not match/);
  });

  it('rejects out-of-range sizes', () => {
    expect(() => encodeLutAtlas(1, new Float32Array(3))).toThrow(/out of range/);
    expect(() => encodeLutAtlas(66, new Float32Array(66 ** 3 * 3))).toThrow(/out of range/);
  });
});

describe('sampleLutAtlasJs — identity LUT', () => {
  const atlas = encodeLutAtlas(17, buildIdentityTable(17));

  it('returns the input colour at grid corners', () => {
    expect(sampleLutAtlasJs(atlas, 0, 0, 0)).toEqual([0, 0, 0]);
    expect(sampleLutAtlasJs(atlas, 1, 1, 1)).toEqual([255, 255, 255]);
  });

  it('returns interpolated colour at midpoints — identity is lossless', () => {
    const [r, g, b] = sampleLutAtlasJs(atlas, 0.5, 0.5, 0.5);
    expect(Math.abs(r - 127.5)).toBeLessThan(1);
    expect(Math.abs(g - 127.5)).toBeLessThan(1);
    expect(Math.abs(b - 127.5)).toBeLessThan(1);
  });

  it('clamps inputs beyond [0, 1] instead of wrapping', () => {
    expect(sampleLutAtlasJs(atlas, -1, 0.5, 2)).toEqual(sampleLutAtlasJs(atlas, 0, 0.5, 1));
  });
});

describe('sampleLutAtlasJs — inverted LUT', () => {
  it('applies a per-pixel inversion', () => {
    const size = 5;
    const table = new Float32Array(size * size * size * 3);
    for (let b = 0; b < size; b += 1) {
      for (let g = 0; g < size; g += 1) {
        for (let r = 0; r < size; r += 1) {
          const idx = (r + size * (g + size * b)) * 3;
          table[idx] = 1 - r / (size - 1);
          table[idx + 1] = 1 - g / (size - 1);
          table[idx + 2] = 1 - b / (size - 1);
        }
      }
    }
    const atlas = encodeLutAtlas(size, table);
    const [r, g, b] = sampleLutAtlasJs(atlas, 0, 0, 0);
    expect(r).toBe(255);
    expect(g).toBe(255);
    expect(b).toBe(255);
    const [r2, g2, b2] = sampleLutAtlasJs(atlas, 1, 1, 1);
    expect(r2).toBe(0);
    expect(g2).toBe(0);
    expect(b2).toBe(0);
  });
});
