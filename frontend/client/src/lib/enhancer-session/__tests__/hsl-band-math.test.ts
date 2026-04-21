import { describe, expect, it } from 'vitest';
import {
  HSL_BAND_CENTRES_DEG,
  bandWeight,
  bandWeightsForHue,
  circularDistance,
  dominantBandForHue,
  rgbToHsv,
} from '../hsl-band-math';

describe('circularDistance', () => {
  it.each<[number, number, number]>([
    [0, 0, 0],
    [10, 350, 20],
    [180, 0, 180],
    [359, 1, 2],
  ])('circularDistance(%s, %s) === %s', (a, b, expected) => {
    expect(circularDistance(a, b)).toBe(expected);
  });
});

describe('bandWeight', () => {
  it('peaks at 1.0 at the band centre', () => {
    expect(bandWeight(0, HSL_BAND_CENTRES_DEG.red)).toBeCloseTo(1);
    expect(bandWeight(240, HSL_BAND_CENTRES_DEG.blue)).toBeCloseTo(1);
  });

  it('decays to 0 at the half-width boundary', () => {
    expect(bandWeight(40, HSL_BAND_CENTRES_DEG.red)).toBeCloseTo(0, 4);
    expect(bandWeight(320, HSL_BAND_CENTRES_DEG.red)).toBeCloseTo(0, 4);
  });

  it('is zero beyond the window', () => {
    expect(bandWeight(180, HSL_BAND_CENTRES_DEG.red)).toBe(0);
  });
});

describe('bandWeightsForHue', () => {
  it('assigns (close to) all weight to the centre band', () => {
    const weights = bandWeightsForHue(0);
    expect(weights[0].band).toBe('red');
    expect(weights[0].weight).toBeGreaterThan(0.85);
  });

  it('distributes between two bands at midpoint', () => {
    const weights = bandWeightsForHue(15);
    const top = new Set([weights[0].band, weights[1].band]);
    expect(top.has('red')).toBe(true);
    expect(top.has('orange')).toBe(true);
    expect(Math.abs(weights[0].weight - weights[1].weight)).toBeLessThan(0.01);
  });

  it('wraps correctly around 0°/360°', () => {
    const weights = bandWeightsForHue(350);
    expect(weights[0].band).toBe('red');
  });

  it('falls back to nearest band in a hypothetical cold zone', () => {
    // Not a real cold zone at half-width 40° + 8 bands, but the fallback
    // invariant still holds: every hue must resolve to exactly one band
    // with total weight 1.
    const weights = bandWeightsForHue(200);
    const sum = weights.reduce((s, w) => s + w.weight, 0);
    expect(sum).toBeCloseTo(1);
  });
});

describe('dominantBandForHue', () => {
  it.each<[number, string]>([
    [0, 'red'],
    [30, 'orange'],
    [60, 'yellow'],
    [120, 'green'],
    [180, 'aqua'],
    [240, 'blue'],
    [270, 'purple'],
    [300, 'magenta'],
  ])('%s° → %s', (hue, expected) => {
    expect(dominantBandForHue(hue)).toBe(expected);
  });
});

describe('rgbToHsv', () => {
  it.each<[number, number, number, number]>([
    [255, 0, 0, 0],   // pure red
    [0, 255, 0, 120], // pure green
    [0, 0, 255, 240], // pure blue
  ])('rgb(%s, %s, %s) → hue %s°', (r, g, b, expectedHue) => {
    expect(rgbToHsv(r, g, b).h).toBeCloseTo(expectedHue, 0);
  });

  it('returns 0 saturation on greys', () => {
    expect(rgbToHsv(128, 128, 128).s).toBe(0);
  });
});
