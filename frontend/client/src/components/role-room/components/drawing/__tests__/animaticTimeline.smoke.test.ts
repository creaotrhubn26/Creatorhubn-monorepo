// @ts-nocheck
import { describe, expect, it } from 'vitest';
import {
  buildAnimaticTimeline,
  findActiveSegment,
  clampTime,
  getFrameStartTime,
  DEFAULT_FRAME_DURATION,
} from '../animaticTimeline';

describe('Sprint A.7 — animaticTimeline.buildAnimaticTimeline', () => {
  it('tom sekvens gir tom timeline med totalDuration=0', () => {
    const t = buildAnimaticTimeline([]);
    expect(t.segments).toEqual([]);
    expect(t.totalDuration).toBe(0);
  });

  it('én frame med duration=3 gir én segment [0..3)', () => {
    const t = buildAnimaticTimeline([{ id: 'f1', duration: 3 }]);
    expect(t.segments).toHaveLength(1);
    expect(t.segments[0]).toEqual({
      frameId: 'f1',
      frameIndex: 0,
      start: 0,
      end: 3,
      duration: 3,
    });
    expect(t.totalDuration).toBe(3);
  });

  it('to frames (3s + 2s) gir sekvens og total 5s', () => {
    const t = buildAnimaticTimeline([
      { id: 'a', duration: 3 },
      { id: 'b', duration: 2 },
    ]);
    expect(t.segments.map((s) => [s.start, s.end])).toEqual([
      [0, 3],
      [3, 5],
    ]);
    expect(t.totalDuration).toBe(5);
  });

  it('frame uten duration får DEFAULT_FRAME_DURATION', () => {
    const t = buildAnimaticTimeline([{ id: 'nodur' }]);
    expect(t.segments[0].duration).toBe(DEFAULT_FRAME_DURATION);
  });

  it('frame med negativ/0/NaN duration får DEFAULT_FRAME_DURATION', () => {
    const t = buildAnimaticTimeline([
      { id: 'neg', duration: -5 },
      { id: 'zero', duration: 0 },
      { id: 'nan', duration: NaN },
    ]);
    t.segments.forEach((s) => {
      expect(s.duration).toBe(DEFAULT_FRAME_DURATION);
    });
  });

  it('frame med veldig kort duration klampes til minimum (0.25)', () => {
    const t = buildAnimaticTimeline([{ id: 'tiny', duration: 0.05 }]);
    expect(t.segments[0].duration).toBe(0.25);
  });

  it('lange sekvenser akkumulerer start-tid korrekt', () => {
    const t = buildAnimaticTimeline([
      { id: '1', duration: 1 },
      { id: '2', duration: 1.5 },
      { id: '3', duration: 0.5 },
      { id: '4', duration: 2 },
    ]);
    expect(t.segments[3].start).toBe(3);
    expect(t.segments[3].end).toBe(5);
    expect(t.totalDuration).toBe(5);
  });
});

describe('Sprint A.7 — findActiveSegment', () => {
  const timeline = buildAnimaticTimeline([
    { id: 'a', duration: 3 },
    { id: 'b', duration: 2 },
    { id: 'c', duration: 4 },
  ]);

  it('tom timeline returnerer null', () => {
    const t = buildAnimaticTimeline([]);
    expect(findActiveSegment(t, 0)).toBeNull();
    expect(findActiveSegment(t, 10)).toBeNull();
  });

  it('t=0 returnerer første segment', () => {
    expect(findActiveSegment(timeline, 0)?.frameId).toBe('a');
  });

  it('t=2.99 er fortsatt i første segment', () => {
    expect(findActiveSegment(timeline, 2.99)?.frameId).toBe('a');
  });

  it('t=3 (eksakt grense) tilhører neste segment', () => {
    expect(findActiveSegment(timeline, 3)?.frameId).toBe('b');
  });

  it('t=4 er i andre segment [3..5)', () => {
    expect(findActiveSegment(timeline, 4)?.frameId).toBe('b');
  });

  it('t=5 (grense mellom b og c) er i tredje', () => {
    expect(findActiveSegment(timeline, 5)?.frameId).toBe('c');
  });

  it('negativ tid klampes til første', () => {
    expect(findActiveSegment(timeline, -10)?.frameId).toBe('a');
  });

  it('tid utover totalDuration klampes til siste', () => {
    expect(findActiveSegment(timeline, 999)?.frameId).toBe('c');
  });
});

describe('Sprint A.7 — clampTime', () => {
  const timeline = buildAnimaticTimeline([
    { id: 'a', duration: 3 },
    { id: 'b', duration: 2 },
  ]);

  it('innenfor området returnerer uendret', () => {
    expect(clampTime(timeline, 2.5)).toBe(2.5);
  });

  it('negativ klampes til 0', () => {
    expect(clampTime(timeline, -5)).toBe(0);
  });

  it('over totalDuration klampes ned', () => {
    expect(clampTime(timeline, 100)).toBe(5);
  });

  it('NaN gir 0', () => {
    expect(clampTime(timeline, NaN)).toBe(0);
  });
});

describe('Sprint A.7 — getFrameStartTime', () => {
  const timeline = buildAnimaticTimeline([
    { id: 'a', duration: 3 },
    { id: 'b', duration: 2 },
    { id: 'c', duration: 4 },
  ]);

  it('frame 0 starter på 0', () => {
    expect(getFrameStartTime(timeline, 0)).toBe(0);
  });

  it('frame 1 starter på 3', () => {
    expect(getFrameStartTime(timeline, 1)).toBe(3);
  });

  it('frame 2 starter på 5', () => {
    expect(getFrameStartTime(timeline, 2)).toBe(5);
  });

  it('indeks utenfor området klampes', () => {
    expect(getFrameStartTime(timeline, -1)).toBe(0);
    expect(getFrameStartTime(timeline, 99)).toBe(9);
  });
});
