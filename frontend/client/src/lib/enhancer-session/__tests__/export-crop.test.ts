import { describe, expect, it } from 'vitest';
import {
  computeCropRect,
  describeCropAspect,
  EXPORT_CROP_ASPECTS,
  parseCrop,
} from '../export-crop';

describe('parseCrop', () => {
  it('returns null for "none", undefined, and malformed input', () => {
    expect(parseCrop('none')).toBeNull();
    expect(parseCrop(undefined)).toBeNull();
    expect(parseCrop('bogus' as never)).toBeNull();
    expect(parseCrop('4:' as never)).toBeNull();
    expect(parseCrop(':5' as never)).toBeNull();
    expect(parseCrop('4:0' as never)).toBeNull();
    expect(parseCrop('0:5' as never)).toBeNull();
    expect(parseCrop('-1:5' as never)).toBeNull();
  });

  it('parses every named preset', () => {
    expect(parseCrop('1:1')).toEqual({ w: 1, h: 1 });
    expect(parseCrop('4:5')).toEqual({ w: 4, h: 5 });
    expect(parseCrop('9:16')).toEqual({ w: 9, h: 16 });
    expect(parseCrop('16:9')).toEqual({ w: 16, h: 9 });
    expect(parseCrop('3:2')).toEqual({ w: 3, h: 2 });
  });

  it('accepts a custom w/h object', () => {
    expect(parseCrop({ w: 7, h: 4 })).toEqual({ w: 7, h: 4 });
    expect(parseCrop({ w: 2.35, h: 1 })).toEqual({ w: 2.35, h: 1 });
  });

  it('rejects invalid custom objects', () => {
    expect(parseCrop({ w: 0, h: 5 })).toBeNull();
    expect(parseCrop({ w: 4, h: -3 })).toBeNull();
    expect(parseCrop({ w: NaN, h: 5 })).toBeNull();
    expect(parseCrop({ w: 4, h: Infinity })).toBeNull();
  });
});

describe('computeCropRect', () => {
  it('returns the full source rect when crop is "none"', () => {
    expect(computeCropRect(3000, 2000, 'none')).toEqual({
      x: 0,
      y: 0,
      w: 3000,
      h: 2000,
    });
  });

  it('returns full rect when aspect already matches', () => {
    expect(computeCropRect(1500, 1000, '3:2')).toEqual({
      x: 0,
      y: 0,
      w: 1500,
      h: 1000,
    });
  });

  it('trims width when source is wider than target (landscape → square)', () => {
    const rect = computeCropRect(3000, 2000, '1:1');
    expect(rect.h).toBe(2000);
    expect(rect.w).toBe(2000);
    expect(rect.x).toBe(500); // centred: (3000 - 2000) / 2
    expect(rect.y).toBe(0);
  });

  it('trims height when source is taller than target (portrait → square)', () => {
    const rect = computeCropRect(2000, 3000, '1:1');
    expect(rect.w).toBe(2000);
    expect(rect.h).toBe(2000);
    expect(rect.y).toBe(500);
    expect(rect.x).toBe(0);
  });

  it('produces IG 4:5 from a 3:2 landscape', () => {
    // 3000×2000 source, target 4:5 (0.8)
    // srcAspect 1.5 > 0.8 → trim width
    // newW = 2000 * 0.8 = 1600, x = (3000 - 1600) / 2 = 700
    const rect = computeCropRect(3000, 2000, '4:5');
    expect(rect).toEqual({ x: 700, y: 0, w: 1600, h: 2000 });
  });

  it('produces 9:16 Reels from a wide landscape (heavy side trim)', () => {
    const rect = computeCropRect(3840, 2160, '9:16'); // 16:9 source
    // srcAspect 16:9 ≈ 1.778 > 9:16 ≈ 0.5625 → trim width heavily
    // newW = 2160 * 9/16 = 1215
    expect(rect.h).toBe(2160);
    expect(rect.w).toBe(1215);
    expect(rect.x).toBe(Math.floor((3840 - 1215) / 2));
  });

  it('accepts a custom ratio (e.g. cinema 2.35:1)', () => {
    const rect = computeCropRect(3000, 2000, { w: 2.35, h: 1 });
    // 2.35:1 ≈ 2.35; source 1.5 < 2.35 → trim height
    // newH = 3000 / 2.35 ≈ 1277
    expect(rect.w).toBe(3000);
    expect(rect.h).toBe(Math.floor(3000 / 2.35));
    expect(rect.y).toBe(Math.floor((2000 - rect.h) / 2));
  });

  it('never returns a rect extending past the source', () => {
    const rect = computeCropRect(1001, 999, '1:1');
    expect(rect.x + rect.w).toBeLessThanOrEqual(1001);
    expect(rect.y + rect.h).toBeLessThanOrEqual(999);
  });

  it('returns the source rect unchanged when dimensions are invalid', () => {
    expect(computeCropRect(0, 2000, '1:1')).toEqual({ x: 0, y: 0, w: 0, h: 2000 });
  });
});

describe('describeCropAspect', () => {
  it('has a Norwegian label for every preset', () => {
    for (const aspect of EXPORT_CROP_ASPECTS) {
      const label = describeCropAspect(aspect);
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it("'none' is labelled as ingen beskjæring", () => {
    expect(describeCropAspect('none')).toMatch(/[Ii]ngen/);
  });

  it('1:1 mentions IG', () => {
    expect(describeCropAspect('1:1')).toMatch(/IG/);
  });
});

describe('EXPORT_CROP_ASPECTS', () => {
  it('begins with "none" so the picker defaults to no-crop', () => {
    expect(EXPORT_CROP_ASPECTS[0]).toBe('none');
  });

  it('covers the essential social/print ratios', () => {
    const set = new Set<string>(EXPORT_CROP_ASPECTS);
    for (const must of ['1:1', '4:5', '9:16', '16:9', '3:2']) {
      expect(set.has(must)).toBe(true);
    }
  });
});
