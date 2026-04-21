import { describe, expect, it } from 'vitest';
import { extensionForFormat, resolveDimensions } from '../export-engine';

describe('resolveDimensions', () => {
  const src = { width: 6000, height: 4000 };
  const portrait = { width: 4000, height: 6000 };

  it('passes through on "none"', () => {
    expect(resolveDimensions(src, { mode: 'none' })).toEqual(src);
  });

  it('long_edge caps the longer side and preserves aspect', () => {
    expect(resolveDimensions(src, { mode: 'long_edge', pixels: 3000 })).toEqual({ width: 3000, height: 2000 });
    expect(resolveDimensions(portrait, { mode: 'long_edge', pixels: 3000 })).toEqual({ width: 2000, height: 3000 });
  });

  it('long_edge is a no-op if source is smaller than the cap', () => {
    expect(resolveDimensions(src, { mode: 'long_edge', pixels: 8000 })).toEqual(src);
  });

  it('short_edge caps the shorter side', () => {
    expect(resolveDimensions(src, { mode: 'short_edge', pixels: 2000 })).toEqual({ width: 3000, height: 2000 });
  });

  it('width and height modes lock one axis and derive the other', () => {
    expect(resolveDimensions(src, { mode: 'width', pixels: 1200 })).toEqual({ width: 1200, height: 800 });
    expect(resolveDimensions(src, { mode: 'height', pixels: 1200 })).toEqual({ width: 1800, height: 1200 });
  });

  it('percent scales both axes and clamps to the 1–100 range', () => {
    expect(resolveDimensions(src, { mode: 'percent', percent: 50 })).toEqual({ width: 3000, height: 2000 });
    expect(resolveDimensions(src, { mode: 'percent', percent: 150 })).toEqual({ width: 6000, height: 4000 });
    expect(resolveDimensions(src, { mode: 'percent', percent: 0 })).toEqual({ width: 60, height: 40 });
  });

  it('handles zero-sized sources without divide-by-zero', () => {
    expect(resolveDimensions({ width: 0, height: 0 }, { mode: 'long_edge', pixels: 100 })).toEqual({ width: 1, height: 1 });
  });
});

describe('extensionForFormat', () => {
  it.each<[string, string]>([
    ['jpeg', 'jpg'],
    ['png', 'png'],
    ['webp', 'webp'],
  ])('%s → %s', (format, ext) => {
    expect(extensionForFormat(format as 'jpeg' | 'png' | 'webp')).toBe(ext);
  });
});
