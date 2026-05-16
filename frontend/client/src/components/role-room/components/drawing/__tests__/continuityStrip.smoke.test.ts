// @ts-nocheck
import { describe, expect, it } from 'vitest';
import { getNeighborWindow, getNavigationFlags } from '../continuityStrip';

describe('Sprint A.7 — continuityStrip.getNeighborWindow', () => {
  const frames = [
    { id: 'f0' }, { id: 'f1' }, { id: 'f2' }, { id: 'f3' }, { id: 'f4' },
  ];

  it('returnerer ±2 naboer rundt midt-frame', () => {
    const window = getNeighborWindow(frames, 2, 2);
    expect(window.ordered.map((f) => f.frame.id)).toEqual(['f0', 'f1', 'f2', 'f3', 'f4']);
    expect(window.active?.frame.id).toBe('f2');
    expect(window.before.map((f) => f.relativeOffset)).toEqual([-2, -1]);
    expect(window.after.map((f) => f.relativeOffset)).toEqual([1, 2]);
  });

  it('starts klipper "before"-siden ved index 0', () => {
    const window = getNeighborWindow(frames, 0, 2);
    expect(window.before).toEqual([]);
    expect(window.active?.frame.id).toBe('f0');
    expect(window.after.map((f) => f.frame.id)).toEqual(['f1', 'f2']);
  });

  it('end klipper "after"-siden ved siste index', () => {
    const window = getNeighborWindow(frames, 4, 2);
    expect(window.before.map((f) => f.frame.id)).toEqual(['f2', 'f3']);
    expect(window.active?.frame.id).toBe('f4');
    expect(window.after).toEqual([]);
  });

  it('radius=1 gir ±1 vindu (3 thumbs)', () => {
    const window = getNeighborWindow(frames, 2, 1);
    expect(window.ordered.map((f) => f.frame.id)).toEqual(['f1', 'f2', 'f3']);
  });

  it('tom frames-liste returnerer tomt vindu', () => {
    const window = getNeighborWindow([], 0, 2);
    expect(window.active).toBeNull();
    expect(window.ordered).toEqual([]);
  });

  it('ut-av-grenser-index returnerer tomt vindu', () => {
    const window = getNeighborWindow(frames, 99, 2);
    expect(window.active).toBeNull();
  });

  it('relativeOffset er korrekt for hvert nabofelt', () => {
    const window = getNeighborWindow(frames, 2, 2);
    const offsets = window.ordered.map((f) => f.relativeOffset);
    expect(offsets).toEqual([-2, -1, 0, 1, 2]);
  });

  it('isActive=true bare på aktiv frame', () => {
    const window = getNeighborWindow(frames, 2, 2);
    const active = window.ordered.filter((f) => f.isActive);
    expect(active).toHaveLength(1);
    expect(active[0].frame.id).toBe('f2');
  });
});

describe('Sprint A.7 — continuityStrip.getNavigationFlags', () => {
  it('tom liste = ingen prev/next, at-start og at-end', () => {
    const flags = getNavigationFlags(0, -1);
    expect(flags).toEqual({ hasPrevious: false, hasNext: false, isAtStart: true, isAtEnd: true });
  });

  it('første index har ingen previous, men next', () => {
    const flags = getNavigationFlags(5, 0);
    expect(flags.hasPrevious).toBe(false);
    expect(flags.hasNext).toBe(true);
    expect(flags.isAtStart).toBe(true);
    expect(flags.isAtEnd).toBe(false);
  });

  it('siste index har previous men ingen next', () => {
    const flags = getNavigationFlags(5, 4);
    expect(flags.hasPrevious).toBe(true);
    expect(flags.hasNext).toBe(false);
    expect(flags.isAtStart).toBe(false);
    expect(flags.isAtEnd).toBe(true);
  });

  it('midten har begge', () => {
    const flags = getNavigationFlags(5, 2);
    expect(flags.hasPrevious).toBe(true);
    expect(flags.hasNext).toBe(true);
    expect(flags.isAtStart).toBe(false);
    expect(flags.isAtEnd).toBe(false);
  });
});
