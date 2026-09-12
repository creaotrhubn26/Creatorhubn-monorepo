import { describe, expect, it } from 'vitest';
import { buildZoomTrack, zoomAt, zoomToCrop, normalizeEnergy, type MotionSample } from '../autoZoom';

const sample = (t: number, energy: number, cx = 0.5, cy = 0.5): MotionSample => ({ t, energy, cx, cy });

describe('normalizeEnergy', () => {
  it('skalerer energi til [0..1] mot maks', () => {
    const out = normalizeEnergy([sample(0, 10), sample(1, 5), sample(2, 0)]);
    expect(out[0].energy).toBeCloseTo(1);
    expect(out[1].energy).toBeCloseTo(0.5);
    expect(out[2].energy).toBeCloseTo(0);
  });
  it('håndterer all-null uten NaN', () => {
    const out = normalizeEnergy([sample(0, 0), sample(1, 0)]);
    expect(out.every((s) => s.energy === 0)).toBe(true);
  });
});

describe('buildZoomTrack', () => {
  it('holder seg nøytral (scale≈1) når alt er stille', () => {
    const track = buildZoomTrack([sample(0, 0), sample(1, 0), sample(2, 0)]);
    expect(track.every((k) => Math.abs(k.scale - 1) < 1e-6)).toBe(true);
  });

  it('zoomer inn over tid ved vedvarende bevegelse', () => {
    const samples = Array.from({ length: 30 }, (_, i) => sample(i * 0.1, 1, 0.7, 0.3));
    const track = buildZoomTrack(samples, { maxScale: 1.4, smoothing: 0.2 });
    const first = track[0].scale;
    const last = track[track.length - 1].scale;
    expect(last).toBeGreaterThan(first);
    expect(last).toBeGreaterThan(1.1);
    expect(last).toBeLessThanOrEqual(1.4 + 1e-6);
  });

  it('respekterer maxScale som tak', () => {
    const samples = Array.from({ length: 100 }, (_, i) => sample(i * 0.1, 1));
    const track = buildZoomTrack(samples, { maxScale: 1.25, smoothing: 0.5 });
    expect(track.every((k) => k.scale <= 1.25 + 1e-6)).toBe(true);
  });

  it('følger bevegelses-senteret mykt (ingen brå hopp)', () => {
    const samples = Array.from({ length: 20 }, (_, i) => sample(i * 0.1, 1, 0.9, 0.1));
    const track = buildZoomTrack(samples, { smoothing: 0.15 });
    // Senter beveger seg MOT (0.9,0.1) men når det ikke umiddelbart.
    expect(track[track.length - 1].cx).toBeGreaterThan(track[0].cx);
    expect(track[track.length - 1].cx).toBeLessThan(0.9 + 1e-6);
    // Steg-for-steg-endring skal være liten (mykhet).
    for (let i = 1; i < track.length; i++) {
      expect(Math.abs(track[i].cx - track[i - 1].cx)).toBeLessThan(0.1);
    }
  });
});

describe('zoomAt', () => {
  const track = buildZoomTrack(
    Array.from({ length: 10 }, (_, i) => sample(i, i < 5 ? 0 : 1, 0.6, 0.4)),
    { smoothing: 0.3 },
  );
  it('interpolerer mellom keyframes', () => {
    const a = zoomAt(track, 7);
    const b = zoomAt(track, 7.5);
    const c = zoomAt(track, 8);
    // Monoton mellom to keyframes (scale stiger i bevegelses-fasen).
    expect(b.scale).toBeGreaterThanOrEqual(Math.min(a.scale, c.scale) - 1e-6);
    expect(b.scale).toBeLessThanOrEqual(Math.max(a.scale, c.scale) + 1e-6);
  });
  it('klemmer utenfor området', () => {
    expect(zoomAt(track, -5).scale).toBeCloseTo(track[0].scale);
    expect(zoomAt(track, 999).scale).toBeCloseTo(track[track.length - 1].scale);
  });
  it('tomt spor → nøytral', () => {
    expect(zoomAt([], 3)).toEqual({ scale: 1, cx: 0.5, cy: 0.5 });
  });
});

describe('zoomToCrop', () => {
  it('scale=1 gir hele bildet', () => {
    const c = zoomToCrop({ scale: 1, cx: 0.5, cy: 0.5 }, 1000, 2000);
    expect(c).toEqual({ sx: 0, sy: 0, sw: 1000, sh: 2000 });
  });
  it('zoomet crop holder seg innenfor bildet', () => {
    const c = zoomToCrop({ scale: 2, cx: 0.95, cy: 0.05 }, 1000, 2000);
    expect(c.sx).toBeGreaterThanOrEqual(0);
    expect(c.sy).toBeGreaterThanOrEqual(0);
    expect(c.sx + c.sw).toBeLessThanOrEqual(1000 + 1e-6);
    expect(c.sy + c.sh).toBeLessThanOrEqual(2000 + 1e-6);
  });
  it('zoom=2 halverer crop-dimensjonene', () => {
    const c = zoomToCrop({ scale: 2, cx: 0.5, cy: 0.5 }, 1000, 2000);
    expect(c.sw).toBeCloseTo(500);
    expect(c.sh).toBeCloseTo(1000);
  });
});
