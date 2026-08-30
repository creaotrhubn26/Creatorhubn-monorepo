import { describe, expect, it } from 'vitest';
import { createSeededRng, getStampConfigForBrush, hashStringToSeed } from '../stampEngine';
import { BRUSH_PRESETS, type ProBrushType } from '../drawing/AdvancedBrushEngine';

describe('stampEngine seeded rng', () => {
  it('samme seed gir identisk sekvens (deterministisk commit-rendering)', () => {
    const a = createSeededRng(hashStringToSeed('stroke-abc'));
    const b = createSeededRng(hashStringToSeed('stroke-abc'));
    const seqA = Array.from({ length: 50 }, () => a());
    const seqB = Array.from({ length: 50 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('ulike seeds gir ulike sekvenser', () => {
    const a = createSeededRng(hashStringToSeed('stroke-abc'));
    const b = createSeededRng(hashStringToSeed('stroke-xyz'));
    expect(a()).not.toBe(b());
  });

  it('verdier ligger i [0, 1)', () => {
    const rng = createSeededRng(hashStringToSeed('x'));
    for (let i = 0; i < 200; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('Brush Engine 2 contract', () => {
  const engine2Types: ProBrushType[] = [
    'bluepencil', 'redpencil', 'mechanical', 'dryink', 'tonemarker',
    'tortillon', 'vinyl', 'pastel', 'stipple', 'sumi', 'gouache', 'oil',
  ];

  it.each(engine2Types)('%s har både preset og funksjonell stamp-config', (type) => {
    expect(BRUSH_PRESETS[type]?.engineVersion).toBe(2);
    expect(getStampConfigForBrush(type)).not.toBeNull();
  });

  it('materialmodeller er eksplisitte og utskiftbare', () => {
    expect(BRUSH_PRESETS.dryink.tipModel).toBe('filament');
    expect(BRUSH_PRESETS.pastel.tipModel).toBe('particle');
    expect(BRUSH_PRESETS.gouache.tipModel).toBe('wet');
    expect(BRUSH_PRESETS.vinyl.tipModel).toBe('region');
    expect(getStampConfigForBrush('sumi')?.bristleCount).toBe(7);
    expect(getStampConfigForBrush('watercolor')?.bleed).toBeGreaterThan(0.5);
  });
});
