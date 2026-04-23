import { describe, expect, it } from 'vitest';
import { forEachStampPixel } from '../brush';
import {
  makeBlurLowOp,
  makeCloneOp,
  makeDodgeBurnOp,
  makeHealOp,
  makeSmoothMidOp,
} from '../brush-modes';
import {
  decompose,
  gaussianBlur,
  type DecompositionBands,
  type Float32Image,
} from '../decomposition';

function makeImage(
  width: number,
  height: number,
  fill: (x: number, y: number, c: number) => number,
): Float32Image {
  const data = new Float32Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      for (let c = 0; c < 4; c++) data[idx + c] = fill(x, y, c);
    }
  }
  return { data, width, height, channels: 4 };
}

function bandIdx(b: Float32Image, x: number, y: number): number {
  return (y * b.width + x) * b.channels;
}

describe('makeBlurLowOp', () => {
  it('at weight=1 replaces the low-band pixel with the blurred version', () => {
    const img = makeImage(16, 16, (x, y, c) =>
      c === 3 ? 1 : 0.5 + 0.3 * Math.sin((x + y) / 2),
    );
    const bands = decompose(img, { lowSigma: 2 });
    const blurredLow = gaussianBlur(bands.low, 3);
    const op = makeBlurLowOp(bands, blurredLow);
    const idx = bandIdx(bands.low, 8, 8);
    const expected = [
      blurredLow.data[idx],
      blurredLow.data[idx + 1],
      blurredLow.data[idx + 2],
    ];
    op(8, 8, 1);
    expect(bands.low.data[idx]).toBeCloseTo(expected[0], 6);
    expect(bands.low.data[idx + 1]).toBeCloseTo(expected[1], 6);
    expect(bands.low.data[idx + 2]).toBeCloseTo(expected[2], 6);
  });

  it('at weight=0 leaves the low band unchanged', () => {
    const img = makeImage(8, 8, (x, _, c) => (c === 3 ? 1 : x / 8));
    const bands = decompose(img, { lowSigma: 2 });
    const blurredLow = gaussianBlur(bands.low, 3);
    const before = new Float32Array(bands.low.data);
    const op = makeBlurLowOp(bands, blurredLow);
    op(4, 4, 0);
    expect(Array.from(bands.low.data)).toEqual(Array.from(before));
  });

  it('at weight=0.5 lands halfway between before and blurred', () => {
    const img = makeImage(8, 8, (x, _, c) => (c === 3 ? 1 : x / 8));
    const bands = decompose(img, { lowSigma: 2 });
    const blurredLow = gaussianBlur(bands.low, 3);
    const idx = bandIdx(bands.low, 4, 4);
    const orig = bands.low.data[idx];
    const blurred = blurredLow.data[idx];
    const op = makeBlurLowOp(bands, blurredLow);
    op(4, 4, 0.5);
    expect(bands.low.data[idx]).toBeCloseTo((orig + blurred) / 2, 6);
  });

  it('never touches the high band', () => {
    const img = makeImage(8, 8, (x, y, c) => (c === 3 ? 1 : (x + y) / 16));
    const bands = decompose(img, { lowSigma: 2 });
    const blurredLow = gaussianBlur(bands.low, 3);
    const highBefore = new Float32Array(bands.high.data);
    const op = makeBlurLowOp(bands, blurredLow);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) op(x, y, 1);
    expect(Array.from(bands.high.data)).toEqual(Array.from(highBefore));
  });
});

describe('makeSmoothMidOp', () => {
  it('throws on a two-band decomposition', () => {
    const img = makeImage(4, 4, (_, __, c) => (c === 3 ? 1 : 0.5));
    const bands = decompose(img, { lowSigma: 2 });
    const blurred = gaussianBlur(bands.low, 1);
    expect(() => makeSmoothMidOp(bands, blurred)).toThrow();
  });

  it('lerps the mid band toward the blurred version', () => {
    const img = makeImage(12, 12, (x, y, c) =>
      c === 3 ? 1 : 0.5 + 0.1 * Math.sin(x) + 0.05 * Math.cos(y),
    );
    const bands = decompose(img, { lowSigma: 6, midSigma: 1.5 });
    if (bands.kind !== 'three-band') throw new Error('expected three-band');
    const blurredMid = gaussianBlur(bands.mid, 2);
    const idx = bandIdx(bands.mid, 6, 6);
    const orig = bands.mid.data[idx];
    const blurred = blurredMid.data[idx];
    const op = makeSmoothMidOp(bands, blurredMid);
    op(6, 6, 0.5);
    expect(bands.mid.data[idx]).toBeCloseTo((orig + blurred) / 2, 6);
  });
});

describe('makeHealOp', () => {
  it('replaces the low band toward the source but leaves high untouched', () => {
    // Blemish at centre (high low-value), clean region offset (5,0) away.
    const img = makeImage(16, 8, (x, y, c) => {
      if (c === 3) return 1;
      if (x === 8 && y === 4) return 0.2; // blemish
      return 0.7;
    });
    const bands = decompose(img, { lowSigma: 3 });
    const highBefore = new Float32Array(bands.high.data);
    const lowBefore = bands.low.data[bandIdx(bands.low, 8, 4)];
    const lowSource = bands.low.data[bandIdx(bands.low, 13, 4)];
    const op = makeHealOp(bands, { dx: 5, dy: 0 });
    op(8, 4, 1);
    // Low at target is now exactly the source low.
    expect(bands.low.data[bandIdx(bands.low, 8, 4)]).toBeCloseTo(lowSource, 6);
    // High is untouched — this is the whole point of heal vs. clone.
    expect(Array.from(bands.high.data)).toEqual(Array.from(highBefore));
    // And crucially, the low actually moved (sanity check).
    expect(lowBefore).not.toBeCloseTo(lowSource, 3);
  });

  it('also moves the mid band on a three-band decomposition', () => {
    const img = makeImage(16, 8, (x, _, c) => (c === 3 ? 1 : (x % 5) * 0.15));
    const bands = decompose(img, { lowSigma: 4, midSigma: 1 });
    if (bands.kind !== 'three-band') throw new Error('expected three-band');
    const midBefore = bands.mid.data[bandIdx(bands.mid, 8, 4)];
    const midSource = bands.mid.data[bandIdx(bands.mid, 13, 4)];
    const op = makeHealOp(bands, { dx: 5, dy: 0 });
    op(8, 4, 1);
    expect(bands.mid.data[bandIdx(bands.mid, 8, 4)]).toBeCloseTo(midSource, 6);
    expect(midBefore).not.toBeCloseTo(midSource, 3);
  });

  it('is a no-op when the source is out of bounds', () => {
    const img = makeImage(8, 8, (x, _, c) => (c === 3 ? 1 : x / 8));
    const bands = decompose(img, { lowSigma: 2 });
    const lowBefore = new Float32Array(bands.low.data);
    const op = makeHealOp(bands, { dx: 100, dy: 100 });
    op(4, 4, 1);
    expect(Array.from(bands.low.data)).toEqual(Array.from(lowBefore));
  });
});

describe('makeCloneOp', () => {
  it('copies every band at weight=1', () => {
    const img = makeImage(16, 8, (x, y, c) => {
      if (c === 3) return 1;
      return (x + y * 13) / 50;
    });
    const bands = decompose(img, { lowSigma: 3, midSigma: 1 });
    if (bands.kind !== 'three-band') throw new Error('expected three-band');
    const srcLow = bands.low.data[bandIdx(bands.low, 12, 4)];
    const srcMid = bands.mid.data[bandIdx(bands.mid, 12, 4)];
    const srcHigh = bands.high.data[bandIdx(bands.high, 12, 4)];
    const op = makeCloneOp(bands, { dx: 8, dy: 0 });
    op(4, 4, 1);
    expect(bands.low.data[bandIdx(bands.low, 4, 4)]).toBeCloseTo(srcLow, 6);
    expect(bands.mid.data[bandIdx(bands.mid, 4, 4)]).toBeCloseTo(srcMid, 6);
    expect(bands.high.data[bandIdx(bands.high, 4, 4)]).toBeCloseTo(srcHigh, 6);
  });

  it('is a no-op when the source is out of bounds', () => {
    const img = makeImage(8, 8, (x, _, c) => (c === 3 ? 1 : x / 8));
    const bands = decompose(img, { lowSigma: 2 });
    const lowBefore = new Float32Array(bands.low.data);
    const highBefore = new Float32Array(bands.high.data);
    const op = makeCloneOp(bands, { dx: -100, dy: 0 });
    op(4, 4, 1);
    expect(Array.from(bands.low.data)).toEqual(Array.from(lowBefore));
    expect(Array.from(bands.high.data)).toEqual(Array.from(highBefore));
  });
});

describe('makeDodgeBurnOp', () => {
  function midGreyBand(): Float32Image {
    return {
      data: new Float32Array([0.5, 0.5, 0.5, 1]),
      width: 1,
      height: 1,
      channels: 4,
    };
  }

  it('lightens with positive amount, darkens with negative', () => {
    const lowPos = midGreyBand();
    const lowNeg = midGreyBand();
    makeDodgeBurnOp(lowPos, 0.2)(0, 0, 1);
    makeDodgeBurnOp(lowNeg, -0.2)(0, 0, 1);
    expect(lowPos.data[0]).toBeCloseTo(0.7, 6);
    expect(lowNeg.data[0]).toBeCloseTo(0.3, 6);
  });

  it('preserves chroma (same delta on R, G, B)', () => {
    const band: Float32Image = {
      data: new Float32Array([0.4, 0.6, 0.5, 1]),
      width: 1,
      height: 1,
      channels: 4,
    };
    makeDodgeBurnOp(band, 0.2)(0, 0, 1);
    // Each channel increased by the same 0.2.
    expect(band.data[0]).toBeCloseTo(0.6, 6);
    expect(band.data[1]).toBeCloseTo(0.8, 6);
    expect(band.data[2]).toBeCloseTo(0.7, 6);
    // Chroma ratios unchanged.
    const orig = [0.4, 0.6, 0.5];
    for (let c = 0; c < 3; c++) {
      expect(band.data[c] - orig[c]).toBeCloseTo(0.2, 6);
    }
  });

  it('alpha is left alone', () => {
    const band: Float32Image = {
      data: new Float32Array([0.5, 0.5, 0.5, 0.7]),
      width: 1,
      height: 1,
      channels: 4,
    };
    const alphaBefore = band.data[3];
    makeDodgeBurnOp(band, 0.3)(0, 0, 1);
    expect(band.data[3]).toBe(alphaBefore);
  });

  it('shadows range: no effect on highlight pixels', () => {
    const band: Float32Image = {
      data: new Float32Array([0.95, 0.95, 0.95, 1]),
      width: 1,
      height: 1,
      channels: 4,
    };
    makeDodgeBurnOp(band, 0.5, 'shadows')(0, 0, 1);
    expect(band.data[0]).toBeCloseTo(0.95, 6);
  });

  it('highlights range: no effect on shadow pixels', () => {
    const band: Float32Image = {
      data: new Float32Array([0.05, 0.05, 0.05, 1]),
      width: 1,
      height: 1,
      channels: 4,
    };
    makeDodgeBurnOp(band, 0.5, 'highlights')(0, 0, 1);
    expect(band.data[0]).toBeCloseTo(0.05, 6);
  });

  it('midtones range: peaks at luminance 0.5', () => {
    const mid = midGreyBand();
    const shadow: Float32Image = {
      data: new Float32Array([0.1, 0.1, 0.1, 1]),
      width: 1,
      height: 1,
      channels: 4,
    };
    const midBefore = mid.data[0];
    const shadowBefore = shadow.data[0];
    makeDodgeBurnOp(mid, 0.3, 'midtones')(0, 0, 1);
    makeDodgeBurnOp(shadow, 0.3, 'midtones')(0, 0, 1);
    expect(mid.data[0] - midBefore).toBeGreaterThan(shadow.data[0] - shadowBefore);
  });

  it('scales with brush weight', () => {
    const full = midGreyBand();
    const half = midGreyBand();
    makeDodgeBurnOp(full, 0.2)(0, 0, 1);
    makeDodgeBurnOp(half, 0.2)(0, 0, 0.5);
    expect(full.data[0] - 0.5).toBeCloseTo(2 * (half.data[0] - 0.5), 6);
  });
});

describe('integration with forEachStampPixel', () => {
  it('running a full stamp of blur-low applies weighted lerp per pixel', () => {
    const img = makeImage(32, 32, (x, y, c) =>
      c === 3 ? 1 : 0.5 + 0.3 * Math.sin(x / 2) * Math.cos(y / 2),
    );
    const bands = decompose(img, { lowSigma: 2 });
    const blurredLow = gaussianBlur(bands.low, 4);
    const lowBefore = new Float32Array(bands.low.data);
    const op = makeBlurLowOp(bands, blurredLow);

    forEachStampPixel(
      { cx: 16, cy: 16, radius: 6, hardness: 0.5, strength: 1 },
      { width: 32, height: 32 },
      op,
    );

    // Centre pixel: falloff = 1, strength = 1 → fully replaced.
    const cIdx = bandIdx(bands.low, 16, 16);
    expect(bands.low.data[cIdx]).toBeCloseTo(blurredLow.data[cIdx], 5);
    // Corner of image: outside brush radius → untouched.
    const farIdx = bandIdx(bands.low, 0, 0);
    expect(bands.low.data[farIdx]).toBeCloseTo(lowBefore[farIdx], 6);
  });

  it('dodge stamp raises low-band luminance within the footprint only', () => {
    const band: Float32Image = {
      data: new Float32Array(32 * 32 * 4).fill(0.5),
      width: 32,
      height: 32,
      channels: 4,
    };
    // fill alpha channel
    for (let i = 3; i < band.data.length; i += 4) band.data[i] = 1;
    const op = makeDodgeBurnOp(band, 0.1);
    forEachStampPixel(
      { cx: 16, cy: 16, radius: 5, hardness: 1, strength: 1 },
      { width: 32, height: 32 },
      op,
    );
    // Centre should be near 0.6, far corner should be exactly 0.5.
    expect(band.data[bandIdx(band, 16, 16)]).toBeCloseTo(0.6, 5);
    expect(band.data[bandIdx(band, 0, 0)]).toBe(0.5);
  });
});

describe('band union passthrough (three-band not required)', () => {
  it('two-band clone does not touch a non-existent mid band', () => {
    const img = makeImage(8, 8, (x, _, c) => (c === 3 ? 1 : x / 8));
    const bands = decompose(img, { lowSigma: 2 }) as DecompositionBands;
    // kind check — we are asserting the type narrows away mid.
    expect(bands.kind).toBe('two-band');
    const op = makeCloneOp(bands, { dx: 2, dy: 0 });
    // Should not throw.
    op(3, 3, 1);
  });
});
