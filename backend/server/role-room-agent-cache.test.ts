import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildCacheKey,
  hashContext,
  modelIdForTier,
  pickModelForMessage,
} from './role-room-agent-cache.js';

describe('buildCacheKey', () => {
  it('produces the same key for identical inputs', () => {
    const a = buildCacheKey('p1', 'ctx', 'hva mangler');
    const b = buildCacheKey('p1', 'ctx', 'hva mangler');
    expect(a).toBe(b);
  });

  it('changes when project id changes', () => {
    const a = buildCacheKey('p1', 'ctx', 'hva mangler');
    const b = buildCacheKey('p2', 'ctx', 'hva mangler');
    expect(a).not.toBe(b);
  });

  it('changes when context hash changes', () => {
    const a = buildCacheKey('p1', 'ctx-v1', 'hva mangler');
    const b = buildCacheKey('p1', 'ctx-v2', 'hva mangler');
    expect(a).not.toBe(b);
  });

  it('changes when user message changes', () => {
    const a = buildCacheKey('p1', 'ctx', 'hva mangler');
    const b = buildCacheKey('p1', 'ctx', 'hva mangler?');
    expect(a).not.toBe(b);
  });

  it('uses the unit separator to avoid concatenation collisions', () => {
    // Without a separator, ("ab", "c", "de") and ("a", "bc", "de") would collide.
    const a = buildCacheKey('ab', 'c', 'de');
    const b = buildCacheKey('a', 'bc', 'de');
    expect(a).not.toBe(b);
  });

  it('returns a 64-character hex digest (sha-256)', () => {
    const key = buildCacheKey('p1', 'ctx', 'hello');
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('hashContext', () => {
  it('is stable across calls with the same shape', () => {
    const payload = { a: 1, b: [2, 3], c: null };
    expect(hashContext(payload)).toBe(hashContext(payload));
  });

  it('changes when any field changes', () => {
    expect(hashContext({ a: 1 })).not.toBe(hashContext({ a: 2 }));
  });

  it('returns "unhashable" on circular input rather than throwing', () => {
    const cycle: any = { self: null };
    cycle.self = cycle;
    // JSON.stringify throws on circular structures; the helper catches it.
    expect(hashContext(cycle)).toBe('unhashable');
  });

  it('is sensitive to JSON field order (keys not re-sorted)', () => {
    // Documenting current behaviour so callers know to pre-sort.
    const a = hashContext({ a: 1, b: 2 });
    const b = hashContext({ b: 2, a: 1 });
    // V8 preserves insertion order; these produce different hashes.
    expect(a).not.toBe(b);
  });
});

describe('pickModelForMessage', () => {
  const originalRouter = process.env.ROLE_ROOM_AGENT_MODEL_ROUTER;
  beforeEach(() => {
    delete process.env.ROLE_ROOM_AGENT_MODEL_ROUTER;
  });
  afterEach(() => {
    if (originalRouter === undefined) delete process.env.ROLE_ROOM_AGENT_MODEL_ROUTER;
    else process.env.ROLE_ROOM_AGENT_MODEL_ROUTER = originalRouter;
  });

  it('routes short info-lookup queries to haiku', () => {
    expect(pickModelForMessage('hva er status på reviewet?')).toBe('haiku');
    expect(pickModelForMessage('når er neste skytedag')).toBe('haiku');
    expect(pickModelForMessage('hvor mange kandidater er igjen')).toBe('haiku');
    expect(pickModelForMessage('oppsummer briefen')).toBe('haiku');
  });

  it('routes analysis-heavy queries to sonnet even when short', () => {
    expect(pickModelForMessage('analyser scope-impact')).toBe('sonnet');
    expect(pickModelForMessage('foreslå en budsjettjustering')).toBe('sonnet');
  });

  it('defaults to sonnet for ambiguous or complex queries', () => {
    expect(pickModelForMessage('Jeg lurer på noe rundt prosjektet')).toBe('sonnet');
    expect(pickModelForMessage('')).toBe('sonnet');
  });

  it('falls back to sonnet when the router is disabled via env', () => {
    process.env.ROLE_ROOM_AGENT_MODEL_ROUTER = 'off';
    expect(pickModelForMessage('hva er dagens dato')).toBe('sonnet');
  });
});

describe('modelIdForTier', () => {
  const original = process.env.ROLE_ROOM_AGENT_HAIKU_MODEL;
  afterEach(() => {
    if (original === undefined) delete process.env.ROLE_ROOM_AGENT_HAIKU_MODEL;
    else process.env.ROLE_ROOM_AGENT_HAIKU_MODEL = original;
  });

  it('returns the sonnet default id for sonnet tier', () => {
    expect(modelIdForTier('sonnet')).toMatch(/claude-(sonnet|opus)/);
  });

  it('honours env override for haiku', () => {
    process.env.ROLE_ROOM_AGENT_HAIKU_MODEL = 'claude-haiku-custom';
    expect(modelIdForTier('haiku')).toBe('claude-haiku-custom');
  });
});
