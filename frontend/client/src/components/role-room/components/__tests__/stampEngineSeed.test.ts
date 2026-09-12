import { describe, expect, it } from 'vitest';
import { createSeededRng, hashStringToSeed } from '../stampEngine';

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
