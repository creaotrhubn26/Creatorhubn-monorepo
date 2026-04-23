import { describe, expect, it } from 'vitest';
import {
  normalisePointerInput,
  shouldStartStroke,
  type PointerInput,
} from '../pointer-input';

function pen(overrides: Partial<PointerInput> = {}): PointerInput {
  return { pointerType: 'pen', pressure: 0.5, tiltX: 10, tiltY: -5, ...overrides };
}
function mouse(overrides: Partial<PointerInput> = {}): PointerInput {
  return { pointerType: 'mouse', pressure: 0.5, ...overrides };
}
function touch(overrides: Partial<PointerInput> = {}): PointerInput {
  return { pointerType: 'touch', pressure: 0, ...overrides };
}

describe('normalisePointerInput — pressure', () => {
  it('overrides mouse pressure to 1 regardless of the reported value', () => {
    expect(normalisePointerInput(mouse({ pressure: 0 })).pressure).toBe(1);
    expect(normalisePointerInput(mouse({ pressure: 0.5 })).pressure).toBe(1);
    expect(normalisePointerInput(mouse({ pressure: 0.7 })).pressure).toBe(1);
  });

  it('uses pen pressure as-is in the middle of its range', () => {
    expect(normalisePointerInput(pen({ pressure: 0.3 })).pressure).toBe(0.3);
    expect(normalisePointerInput(pen({ pressure: 0.85 })).pressure).toBe(0.85);
  });

  it('clamps pen pressure to a tiny floor so resting pen still paints', () => {
    expect(normalisePointerInput(pen({ pressure: 0 })).pressure).toBeGreaterThan(0);
    expect(normalisePointerInput(pen({ pressure: 0 })).pressure).toBeLessThan(0.1);
  });

  it('caps pen pressure at 1', () => {
    expect(normalisePointerInput(pen({ pressure: 1.2 })).pressure).toBe(1);
  });

  it('treats a touch with pressure=0 as full pressure (finger press)', () => {
    expect(normalisePointerInput(touch({ pressure: 0 })).pressure).toBe(1);
  });

  it('honours real touch pressure when reported', () => {
    expect(normalisePointerInput(touch({ pressure: 0.6 })).pressure).toBe(0.6);
  });

  it('unknown pointer types fall back to mouse behaviour (always full)', () => {
    expect(normalisePointerInput({ pointerType: 'wand', pressure: 0.3 }).pressure).toBe(1);
  });
});

describe('normalisePointerInput — tilt', () => {
  it('carries pen tilt through in degrees', () => {
    const n = normalisePointerInput(pen({ tiltX: 30, tiltY: -20 }));
    expect(n.tiltX).toBe(30);
    expect(n.tiltY).toBe(-20);
  });

  it('drops tilt for mouse and touch pointers', () => {
    expect(normalisePointerInput(mouse({ pressure: 1 })).tiltX).toBeUndefined();
    expect(normalisePointerInput(mouse({ pressure: 1 })).tiltY).toBeUndefined();
    expect(normalisePointerInput(touch()).tiltX).toBeUndefined();
    expect(normalisePointerInput(touch()).tiltY).toBeUndefined();
  });
});

describe('shouldStartStroke', () => {
  it('accepts a primary pointer when no stroke is active', () => {
    expect(shouldStartStroke('pen', true, null, false)).toBe(true);
    expect(shouldStartStroke('mouse', true, null, false)).toBe(true);
    expect(shouldStartStroke('touch', true, null, false)).toBe(true);
  });

  it('rejects additional pointer-downs while a stroke is active', () => {
    expect(shouldStartStroke('pen', true, 1, false)).toBe(false);
    expect(shouldStartStroke('touch', true, 5, false)).toBe(false);
  });

  it('rejects non-primary pointers (multi-touch second finger etc.)', () => {
    expect(shouldStartStroke('touch', false, null, false)).toBe(false);
    expect(shouldStartStroke('pen', false, null, false)).toBe(false);
  });

  it('rejects touch when a pen is on the surface (palm rejection)', () => {
    expect(shouldStartStroke('touch', true, null, true)).toBe(false);
  });

  it('still accepts the pen itself when it is on the surface', () => {
    expect(shouldStartStroke('pen', true, null, true)).toBe(true);
  });
});
