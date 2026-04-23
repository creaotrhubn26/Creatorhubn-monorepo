import { describe, expect, it } from 'vitest';
import {
  beginStroke,
  computeFalloffMask,
  DEFAULT_BRUSH_SETTINGS,
  extendStroke,
  forEachStampPixel,
  sampleToStamp,
  type BrushSample,
  type BrushSettings,
  type BrushStamp,
  type StrokeState,
} from '../brush';

const BASE: BrushSettings = {
  ...DEFAULT_BRUSH_SETTINGS,
  radius: 10,
  hardness: 0.5,
  flow: 1,
  spacing: 0.25,
  pressureRadius: 0,
  pressureFlow: 0,
};

describe('sampleToStamp', () => {
  it('passes position and tilt through unchanged', () => {
    const s = sampleToStamp(
      { x: 3.5, y: -1.2, pressure: 0.8, tiltX: 0.3, tiltY: -0.1 },
      BASE,
    );
    expect(s.cx).toBe(3.5);
    expect(s.cy).toBe(-1.2);
    expect(s.tiltX).toBe(0.3);
    expect(s.tiltY).toBe(-0.1);
  });

  it('ignores pressure when pressureRadius/pressureFlow are 0', () => {
    const a = sampleToStamp({ x: 0, y: 0, pressure: 0.2 }, BASE);
    const b = sampleToStamp({ x: 0, y: 0, pressure: 1 }, BASE);
    expect(a.radius).toBe(b.radius);
    expect(a.strength).toBe(b.strength);
  });

  it('scales radius down with pressure when pressureRadius is enabled', () => {
    const settings = { ...BASE, pressureRadius: 1 };
    const soft = sampleToStamp({ x: 0, y: 0, pressure: 0 }, settings);
    const hard = sampleToStamp({ x: 0, y: 0, pressure: 1 }, settings);
    expect(soft.radius).toBeLessThan(hard.radius);
    expect(hard.radius).toBeCloseTo(settings.radius, 5);
  });

  it('scales flow down with pressure when pressureFlow is enabled', () => {
    const settings = { ...BASE, pressureFlow: 1 };
    const light = sampleToStamp({ x: 0, y: 0, pressure: 0 }, settings);
    const heavy = sampleToStamp({ x: 0, y: 0, pressure: 1 }, settings);
    expect(light.strength).toBeLessThan(heavy.strength);
    expect(heavy.strength).toBeCloseTo(settings.flow, 5);
  });

  it('clamps pressure outside [0,1]', () => {
    const settings = { ...BASE, pressureRadius: 1, pressureFlow: 1 };
    const over = sampleToStamp({ x: 0, y: 0, pressure: 5 }, settings);
    const under = sampleToStamp({ x: 0, y: 0, pressure: -2 }, settings);
    const one = sampleToStamp({ x: 0, y: 0, pressure: 1 }, settings);
    const zero = sampleToStamp({ x: 0, y: 0, pressure: 0 }, settings);
    expect(over.radius).toBeCloseTo(one.radius, 6);
    expect(under.radius).toBeCloseTo(zero.radius, 6);
  });

  it('never produces a radius below 0.5', () => {
    const settings = { ...BASE, radius: 0.1, pressureRadius: 1 };
    const s = sampleToStamp({ x: 0, y: 0, pressure: 0 }, settings);
    expect(s.radius).toBeGreaterThanOrEqual(0.5);
  });
});

describe('computeFalloffMask', () => {
  it('is 1 at centre', () => {
    const { mask, size } = computeFalloffMask(5, 0.5);
    const mid = (size >> 1) * size + (size >> 1);
    expect(mask[mid]).toBe(1);
  });

  it('is 0 at the rim and beyond', () => {
    const { mask, size, radius } = computeFalloffMask(5, 0.5);
    const c = size >> 1;
    // A corner at (5,5) has distance ~7.07 > radius 5, must be 0.
    expect(mask[0]).toBe(0);
    expect(mask[size * size - 1]).toBe(0);
    // Exactly at the rim (x=radius, y=0): smoothstep says t=1 → 0.
    const rimIdx = c * size + (c + radius);
    expect(mask[rimIdx]).toBe(0);
  });

  it('hardness=1 makes a hard-edged disc (all inside = 1)', () => {
    const { mask, size } = computeFalloffMask(5, 1);
    const c = size >> 1;
    for (let y = -5; y <= 5; y++) {
      for (let x = -5; x <= 5; x++) {
        const d = Math.sqrt(x * x + y * y);
        const v = mask[(y + c) * size + (x + c)];
        if (d < 5) expect(v).toBe(1);
        else if (d > 5) expect(v).toBe(0);
      }
    }
  });

  it('hardness=0 produces a monotonically decreasing falloff', () => {
    const { mask, size } = computeFalloffMask(8, 0);
    const c = size >> 1;
    let prev = Infinity;
    for (let x = 0; x <= 8; x++) {
      const v = mask[c * size + (c + x)];
      expect(v).toBeLessThanOrEqual(prev);
      prev = v;
    }
  });
});

describe('forEachStampPixel', () => {
  it('calls back for every in-bounds pixel with weight > 0', () => {
    const stamp: BrushStamp = { cx: 10, cy: 10, radius: 5, hardness: 0.5, strength: 1 };
    let count = 0;
    let maxWeight = 0;
    forEachStampPixel(stamp, { width: 20, height: 20 }, (_x, _y, w) => {
      expect(w).toBeGreaterThan(0);
      maxWeight = Math.max(maxWeight, w);
      count++;
    });
    expect(count).toBeGreaterThan(0);
    expect(maxWeight).toBeCloseTo(1, 5);
  });

  it('clips against image bounds', () => {
    const stamp: BrushStamp = { cx: 0, cy: 0, radius: 5, hardness: 1, strength: 1 };
    const seen: Array<[number, number]> = [];
    forEachStampPixel(stamp, { width: 20, height: 20 }, (x, y) => {
      seen.push([x, y]);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(20);
      expect(y).toBeLessThan(20);
    });
    // None should be negative — a quarter-disc was visited.
    expect(seen.length).toBeGreaterThan(0);
  });

  it('emits nothing for zero strength', () => {
    const stamp: BrushStamp = { cx: 10, cy: 10, radius: 5, hardness: 0.5, strength: 0 };
    let count = 0;
    forEachStampPixel(stamp, { width: 20, height: 20 }, () => {
      count++;
    });
    expect(count).toBe(0);
  });

  it('scales all weights by strength', () => {
    const baseStamp: BrushStamp = { cx: 10, cy: 10, radius: 5, hardness: 0.5, strength: 1 };
    const halfStamp: BrushStamp = { ...baseStamp, strength: 0.5 };
    const full: number[] = [];
    const half: number[] = [];
    forEachStampPixel(baseStamp, { width: 20, height: 20 }, (_x, _y, w) => full.push(w));
    forEachStampPixel(halfStamp, { width: 20, height: 20 }, (_x, _y, w) => half.push(w));
    expect(half.length).toBe(full.length);
    for (let i = 0; i < full.length; i++) {
      expect(half[i]).toBeCloseTo(full[i] * 0.5, 5);
    }
  });

  it('is subpixel-sensitive (shifts footprint by < 1 px)', () => {
    const a: BrushStamp = { cx: 10, cy: 10, radius: 3, hardness: 0, strength: 1 };
    const b: BrushStamp = { cx: 10.5, cy: 10, radius: 3, hardness: 0, strength: 1 };
    const aw = new Map<string, number>();
    const bw = new Map<string, number>();
    forEachStampPixel(a, { width: 20, height: 20 }, (x, y, w) => aw.set(`${x},${y}`, w));
    forEachStampPixel(b, { width: 20, height: 20 }, (x, y, w) => bw.set(`${x},${y}`, w));
    // Same pixel at (11, 10) should receive more weight from `b` (centre 10.5)
    // than from `a` (centre 10), because b is half a pixel closer to it.
    expect(bw.get('11,10')!).toBeGreaterThan(aw.get('11,10')!);
  });
});

describe('stroke interpolation', () => {
  function strokeAll(samples: BrushSample[], settings: BrushSettings) {
    let s: StrokeState = beginStroke();
    const all: BrushStamp[] = [];
    for (const sample of samples) {
      const r = extendStroke(s, sample, settings);
      s = r.state;
      all.push(...r.stamps);
    }
    return all;
  }

  it('first sample always emits exactly one stamp', () => {
    const state = beginStroke();
    const r = extendStroke(state, { x: 5, y: 7, pressure: 1 }, BASE);
    expect(r.stamps).toHaveLength(1);
    expect(r.stamps[0].cx).toBe(5);
    expect(r.stamps[0].cy).toBe(7);
  });

  it('zero-length segment emits nothing and does not accumulate distance', () => {
    let s: StrokeState = beginStroke();
    s = extendStroke(s, { x: 0, y: 0, pressure: 1 }, BASE).state;
    const r = extendStroke(s, { x: 0, y: 0, pressure: 1 }, BASE);
    expect(r.stamps).toHaveLength(0);
    expect(r.state.distanceSinceStamp).toBe(0);
  });

  it('drops stamps at spacing intervals along a straight line', () => {
    // radius=10, spacing=0.25 → spacing*radius = 2.5 px between stamps.
    const stamps = strokeAll(
      [
        { x: 0, y: 0, pressure: 1 },
        { x: 10, y: 0, pressure: 1 },
      ],
      BASE,
    );
    // First stamp at (0,0). Then stamps at 2.5, 5, 7.5, 10 → 5 total.
    expect(stamps).toHaveLength(5);
    for (let i = 0; i < stamps.length; i++) {
      expect(stamps[i].cx).toBeCloseTo(i * 2.5, 5);
      expect(stamps[i].cy).toBeCloseTo(0, 5);
    }
  });

  it('preserves spacing across multiple small pointer events', () => {
    // Same geometry as above but broken into 10 small segments. Stamp count
    // and positions must be identical (event granularity invariance).
    const samples: BrushSample[] = [];
    for (let i = 0; i <= 10; i++) samples.push({ x: i, y: 0, pressure: 1 });
    const stamps = strokeAll(samples, BASE);
    expect(stamps).toHaveLength(5);
    for (let i = 0; i < stamps.length; i++) {
      expect(stamps[i].cx).toBeCloseTo(i * 2.5, 5);
    }
  });

  it('interpolates pressure along the segment', () => {
    const settings = { ...BASE, pressureFlow: 1 };
    const stamps = strokeAll(
      [
        { x: 0, y: 0, pressure: 0 },
        { x: 10, y: 0, pressure: 1 },
      ],
      settings,
    );
    // Pressure should monotonically increase along the stroke.
    for (let i = 1; i < stamps.length; i++) {
      expect(stamps[i].strength).toBeGreaterThanOrEqual(stamps[i - 1].strength);
    }
    expect(stamps[0].strength).toBeCloseTo(0, 5);
    expect(stamps[stamps.length - 1].strength).toBeCloseTo(1, 5);
  });

  it('state.last tracks the actual pointer, not the last stamp', () => {
    // After (0,0) → (3,0) with spacing 2.5, stamps land at (0,0) and (2.5,0).
    // `last` should be (3,0), not (2.5,0). A subsequent segment (3,0)→(3,5)
    // starts a vertical move from (3,0).
    let s: StrokeState = beginStroke();
    s = extendStroke(s, { x: 0, y: 0, pressure: 1 }, BASE).state;
    s = extendStroke(s, { x: 3, y: 0, pressure: 1 }, BASE).state;
    expect(s.last?.x).toBe(3);
    expect(s.last?.y).toBe(0);
    // distanceSinceStamp = 3 - 2.5 = 0.5 px carried over.
    expect(s.distanceSinceStamp).toBeCloseTo(0.5, 5);
  });
});
