import { describe, expect, it } from 'vitest';

import { createTokenRateLimiter } from './narrative-rate-limit.js';

describe('createTokenRateLimiter', () => {
  it('slipper gjennom opp til max i vinduet og stopper deretter', () => {
    const rl = createTokenRateLimiter({ windowMs: 60_000, max: 3 });
    const t = 1_000_000;
    expect(rl.hit('tok-a', t)).toBe(false);
    expect(rl.hit('tok-a', t + 1)).toBe(false);
    expect(rl.hit('tok-a', t + 2)).toBe(false);
    expect(rl.hit('tok-a', t + 3)).toBe(true);
    // Andre tokens har egen bøtte.
    expect(rl.hit('tok-b', t + 3)).toBe(false);
  });

  it('nullstiller når vinduet er ute', () => {
    const rl = createTokenRateLimiter({ windowMs: 1000, max: 1 });
    expect(rl.hit('x', 0)).toBe(false);
    expect(rl.hit('x', 10)).toBe(true);
    expect(rl.hit('x', 1000)).toBe(false);
  });

  it('holder minnet avgrenset ved mange ferske nøkler', () => {
    const rl = createTokenRateLimiter({ windowMs: 60_000, max: 10, maxKeys: 100 });
    for (let i = 0; i < 500; i++) rl.hit(`t${i}`, 0);
    expect(rl.size()).toBeLessThanOrEqual(100);
  });
});
