import { describe, expect, it } from 'vitest';
import { sanitiseTags } from './reference-archive-service.js';

describe('sanitiseTags', () => {
  it('clamps unknown shotType to "unknown"', () => {
    const out = sanitiseTags({ shotType: 'dutch-whip' });
    expect(out.shotType).toBe('unknown');
  });

  it('accepts known shotType values', () => {
    const out = sanitiseTags({ shotType: 'over-the-shoulder' });
    expect(out.shotType).toBe('over-the-shoulder');
  });

  it('filters colorPalette to valid #rrggbb hex only', () => {
    const out = sanitiseTags({
      colorPalette: ['#123456', 'red', '#12345', '#abcdef', 123, '#ABCDEF'],
    });
    expect(out.colorPalette).toEqual(['#123456', '#abcdef', '#ABCDEF']);
  });

  it('caps colorPalette at 8 entries', () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      `#${i.toString(16).padStart(2, '0').repeat(3)}`,
    );
    const out = sanitiseTags({ colorPalette: many });
    expect(out.colorPalette).toHaveLength(8);
  });

  it('lowercases keywords and caps at 12', () => {
    const out = sanitiseTags({
      keywords: ['INTERIOR', 'Warm', 'solitude', ...Array.from({ length: 15 }, (_, i) => `kw${i}`)],
    });
    expect(out.keywords.length).toBeLessThanOrEqual(12);
    expect(out.keywords[0]).toBe('interior');
    expect(out.keywords[1]).toBe('warm');
  });

  it('returns empty-shape tags for empty input', () => {
    const out = sanitiseTags({});
    expect(out.shotType).toBe('unknown');
    expect(out.colorPalette).toEqual([]);
    expect(out.keywords).toEqual([]);
    expect(out.cameraAngle).toBe('');
  });

  it('drops non-array keywords gracefully', () => {
    const out = sanitiseTags({ keywords: 'warm, tungsten, interior' });
    expect(out.keywords).toEqual([]);
  });
});
