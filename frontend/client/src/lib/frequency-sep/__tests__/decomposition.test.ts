import { describe, expect, it } from 'vitest';
import {
  bilateralFilter,
  cloneFloat32Image,
  decompose,
  float32ToRgba,
  gaussianBlur,
  gaussianKernel1D,
  recompose,
  rgbaToFloat32,
  visualiseSignedBand,
  type Float32Image,
} from '../decomposition';

function makeFloatImage(
  width: number,
  height: number,
  fill: (x: number, y: number, c: number) => number,
  channels: 3 | 4 = 4,
): Float32Image {
  const data = new Float32Array(width * height * channels);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const base = (y * width + x) * channels;
      for (let c = 0; c < channels; c++) {
        data[base + c] = fill(x, y, c);
      }
    }
  }
  return { data, width, height, channels };
}

function maxAbsDiff(a: Float32Array, b: Float32Array): number {
  let m = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - b[i]);
    if (d > m) m = d;
  }
  return m;
}

describe('gaussianKernel1D', () => {
  it('sums to 1 for arbitrary sigma', () => {
    for (const sigma of [0.5, 1, 2.5, 7, 15]) {
      const k = gaussianKernel1D(sigma);
      let sum = 0;
      for (const v of k) sum += v;
      expect(sum).toBeCloseTo(1, 6);
    }
  });

  it('is symmetric', () => {
    const k = gaussianKernel1D(3);
    for (let i = 0; i < k.length >> 1; i++) {
      expect(k[i]).toBeCloseTo(k[k.length - 1 - i], 10);
    }
  });

  it('returns an identity kernel for sigma=0', () => {
    const k = gaussianKernel1D(0);
    expect(k.length).toBe(1);
    expect(k[0]).toBe(1);
  });
});

describe('rgbaToFloat32 / float32ToRgba', () => {
  it('round-trips 8-bit RGBA exactly', () => {
    const w = 4;
    const h = 3;
    const bytes = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 37) & 0xff;
    const float = rgbaToFloat32({ data: bytes, width: w, height: h });
    expect(float.width).toBe(w);
    expect(float.height).toBe(h);
    expect(float.channels).toBe(4);
    const back = float32ToRgba(float);
    expect(back.width).toBe(w);
    expect(back.height).toBe(h);
    expect(Array.from(back.data)).toEqual(Array.from(bytes));
  });

  it('clamps out-of-range floats when converting back', () => {
    const img: Float32Image = {
      data: new Float32Array([-0.5, 2, 0.5, 1, 0, 0, 0, 0.5]),
      width: 2,
      height: 1,
      channels: 4,
    };
    const out = float32ToRgba(img);
    expect(out.data[0]).toBe(0);
    expect(out.data[1]).toBe(255);
    expect(out.data[2]).toBe(128);
    expect(out.data[3]).toBe(255);
  });
});

describe('gaussianBlur', () => {
  it('returns a clone for sigma=0', () => {
    const img = makeFloatImage(8, 6, (x, y, c) => (c === 3 ? 1 : (x + y + c) / 20));
    const out = gaussianBlur(img, 0);
    expect(out).not.toBe(img);
    expect(out.data).not.toBe(img.data);
    expect(Array.from(out.data)).toEqual(Array.from(img.data));
  });

  it('preserves DC (uniform input → uniform output, incl. at borders)', () => {
    const img = makeFloatImage(16, 12, (_, __, c) => (c === 3 ? 1 : 0.37));
    const out = gaussianBlur(img, 3);
    for (let y = 0; y < out.height; y++) {
      for (let x = 0; x < out.width; x++) {
        const base = (y * out.width + x) * 4;
        expect(out.data[base]).toBeCloseTo(0.37, 5);
        expect(out.data[base + 1]).toBeCloseTo(0.37, 5);
        expect(out.data[base + 2]).toBeCloseTo(0.37, 5);
        expect(out.data[base + 3]).toBe(1);
      }
    }
  });

  it('passes alpha through without filtering', () => {
    const img = makeFloatImage(8, 8, (x, y, c) => {
      if (c === 3) return (x + y) % 2 === 0 ? 0.2 : 0.9;
      return 0.5;
    });
    const out = gaussianBlur(img, 2);
    for (let y = 0; y < out.height; y++) {
      for (let x = 0; x < out.width; x++) {
        const alphaIdx = (y * out.width + x) * 4 + 3;
        // Round-tripped through Float32Array, so compare exactly against
        // what got stored in the input (precision-matched), not the literal.
        expect(out.data[alphaIdx]).toBe(img.data[alphaIdx]);
      }
    }
  });

  it('reduces high-frequency energy more than low-frequency', () => {
    // Sinusoid in x: high-frequency pattern should be attenuated.
    const high = makeFloatImage(32, 8, (x, _, c) =>
      c === 3 ? 1 : 0.5 + 0.4 * Math.sin((x * Math.PI) / 2),
    );
    const low = makeFloatImage(32, 8, (x, _, c) =>
      c === 3 ? 1 : 0.5 + 0.4 * Math.sin((x * Math.PI) / 16),
    );
    const blurredHigh = gaussianBlur(high, 2);
    const blurredLow = gaussianBlur(low, 2);

    const energy = (img: Float32Image): number => {
      let e = 0;
      for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
          const v = img.data[(y * img.width + x) * 4] - 0.5;
          e += v * v;
        }
      }
      return e;
    };

    const highRatio = energy(blurredHigh) / energy(high);
    const lowRatio = energy(blurredLow) / energy(low);
    expect(highRatio).toBeLessThan(lowRatio);
  });
});

describe('bilateralFilter', () => {
  it('preserves a sharp luminance step', () => {
    // Left half 0.2, right half 0.8 — edge at x=8.
    const img = makeFloatImage(16, 8, (x, _, c) => {
      if (c === 3) return 1;
      return x < 8 ? 0.2 : 0.8;
    });
    const out = bilateralFilter(img, 3, 0.05);

    // Pixels far from the edge should be essentially untouched.
    const sampleLeft = out.data[(4 * out.width + 2) * 4];
    const sampleRight = out.data[(4 * out.width + 13) * 4];
    expect(sampleLeft).toBeCloseTo(0.2, 2);
    expect(sampleRight).toBeCloseTo(0.8, 2);

    // The edge itself should still be steep (much steeper than a gaussian).
    const leftOfEdge = out.data[(4 * out.width + 7) * 4];
    const rightOfEdge = out.data[(4 * out.width + 8) * 4];
    expect(rightOfEdge - leftOfEdge).toBeGreaterThan(0.4);
  });

  it('smooths within a uniform region', () => {
    const img = makeFloatImage(16, 16, (x, y, c) => {
      if (c === 3) return 1;
      const noise = (((x * 13 + y * 7) % 11) - 5) / 200;
      return 0.5 + noise;
    });
    const out = bilateralFilter(img, 3, 0.2);

    let srcVar = 0;
    let outVar = 0;
    const n = img.width * img.height;
    for (let i = 0; i < n; i++) {
      srcVar += (img.data[i * 4] - 0.5) ** 2;
      outVar += (out.data[i * 4] - 0.5) ** 2;
    }
    expect(outVar).toBeLessThan(srcVar);
  });

  it('returns a clone for spatialSigma <= 0', () => {
    const img = makeFloatImage(4, 4, (x, y, c) => (c === 3 ? 1 : (x + y) / 10));
    const out = bilateralFilter(img, 0, 0.1);
    expect(Array.from(out.data)).toEqual(Array.from(img.data));
  });
});

describe('decompose / recompose', () => {
  it('two-band round-trip reconstructs the input within float epsilon', () => {
    const img = makeFloatImage(24, 18, (x, y, c) => {
      if (c === 3) return 1;
      return 0.3 + 0.4 * Math.sin((x + y * 0.3) / 3) + ((x * 7 + y * 5) % 13) / 200;
    });
    const bands = decompose(img, { lowSigma: 4 });
    expect(bands.kind).toBe('two-band');
    const recon = recompose(bands);
    expect(maxAbsDiff(recon.data, img.data)).toBeLessThan(1e-5);
  });

  it('three-band round-trip reconstructs the input within float epsilon', () => {
    const img = makeFloatImage(24, 18, (x, y, c) => {
      if (c === 3) return 1;
      return 0.5 + 0.3 * Math.cos(x / 2) + 0.1 * Math.sin(y / 1.5);
    });
    const bands = decompose(img, { lowSigma: 6, midSigma: 2 });
    expect(bands.kind).toBe('three-band');
    const recon = recompose(bands);
    expect(maxAbsDiff(recon.data, img.data)).toBeLessThan(1e-5);
  });

  it('high-band residual on a uniform image is ~0', () => {
    const img = makeFloatImage(16, 16, (_, __, c) => (c === 3 ? 1 : 0.42));
    const bands = decompose(img, { lowSigma: 4 });
    expect(bands.kind).toBe('two-band');
    if (bands.kind !== 'two-band') return;
    // Only check RGB residual, not alpha (which stays 1 by design).
    for (let i = 0; i < bands.high.data.length; i += 4) {
      expect(Math.abs(bands.high.data[i])).toBeLessThan(1e-5);
      expect(Math.abs(bands.high.data[i + 1])).toBeLessThan(1e-5);
      expect(Math.abs(bands.high.data[i + 2])).toBeLessThan(1e-5);
    }
  });

  it('falls back to two-band when midSigma >= lowSigma (degenerate)', () => {
    const img = makeFloatImage(8, 8, (x, _, c) => (c === 3 ? 1 : x / 8));
    const a = decompose(img, { lowSigma: 3, midSigma: 3 });
    const b = decompose(img, { lowSigma: 3, midSigma: 4 });
    expect(a.kind).toBe('two-band');
    expect(b.kind).toBe('two-band');
  });

  it('falls back to two-band when midSigma is 0 or omitted', () => {
    const img = makeFloatImage(8, 8, (x, _, c) => (c === 3 ? 1 : x / 8));
    expect(decompose(img, { lowSigma: 3 }).kind).toBe('two-band');
    expect(decompose(img, { lowSigma: 3, midSigma: 0 }).kind).toBe('two-band');
  });

  it('three-band mid and high round-trip to the same total residual as two-band', () => {
    // mid + high (three-band) should equal high (two-band) with the same lowSigma.
    const img = makeFloatImage(20, 16, (x, y, c) => {
      if (c === 3) return 1;
      return 0.4 + 0.25 * Math.sin(x / 1.7) + 0.15 * Math.cos(y / 2.3);
    });
    const two = decompose(img, { lowSigma: 5 });
    const three = decompose(img, { lowSigma: 5, midSigma: 1.5 });
    if (two.kind !== 'two-band' || three.kind !== 'three-band') throw new Error('kind');
    const sum = new Float32Array(three.mid.data.length);
    for (let i = 0; i < sum.length; i++) sum[i] = three.mid.data[i] + three.high.data[i];
    // Alpha channel won't match (two.high carries 0 residual with a=1; three.mid/high each
    // carry 0 residual with a=1, summing to a=2). Compare RGB only.
    let maxDiff = 0;
    for (let i = 0; i < sum.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        const d = Math.abs(sum[i + c] - two.high.data[i + c]);
        if (d > maxDiff) maxDiff = d;
      }
    }
    expect(maxDiff).toBeLessThan(1e-5);
  });

  it('with useBilateralLow round-trips exactly regardless of filter choice', () => {
    const img = makeFloatImage(20, 16, (x, _, c) => {
      if (c === 3) return 1;
      return x < 10 ? 0.25 : 0.75;
    });
    const bands = decompose(img, {
      lowSigma: 3,
      useBilateralLow: true,
      bilateralRangeSigma: 0.08,
    });
    const recon = recompose(bands);
    expect(maxAbsDiff(recon.data, img.data)).toBeLessThan(1e-5);
  });

  it('preserves shape and channels', () => {
    const img = makeFloatImage(11, 7, (x, y, c) => (c === 3 ? 1 : (x + y) / 20));
    const bands = decompose(img, { lowSigma: 2, midSigma: 1 });
    for (const band of [bands.low, (bands as { mid?: Float32Image }).mid, bands.high]) {
      if (!band) continue;
      expect(band.width).toBe(11);
      expect(band.height).toBe(7);
      expect(band.channels).toBe(4);
      expect(band.data.length).toBe(11 * 7 * 4);
    }
  });
});

describe('visualiseSignedBand', () => {
  it('shifts signed residuals by +0.5 and forces alpha to 1', () => {
    const band: Float32Image = {
      data: new Float32Array([-0.3, 0, 0.2, 0, 0.4, -0.1, 0.05, 0.5]),
      width: 2,
      height: 1,
      channels: 4,
    };
    const vis = visualiseSignedBand(band);
    const expected = [0.2, 0.5, 0.7, 1, 0.9, 0.4, 0.55, 1];
    for (let i = 0; i < expected.length; i++) {
      expect(vis.data[i]).toBeCloseTo(expected[i], 5);
    }
    // Alpha positions forced to exactly 1, no precision slop.
    expect(vis.data[3]).toBe(1);
    expect(vis.data[7]).toBe(1);
  });
});

describe('cloneFloat32Image', () => {
  it('returns an independent buffer', () => {
    const img = makeFloatImage(3, 2, (x, y, c) => (c === 3 ? 1 : (x + y) / 5));
    const clone = cloneFloat32Image(img);
    expect(clone.data).not.toBe(img.data);
    clone.data[0] = 999;
    expect(img.data[0]).not.toBe(999);
  });
});
