import { describe, expect, it, beforeEach } from 'vitest';
import { createAIRecommendationDedupAdapter } from '../aiRecommendationDedup';

class MemoryStorage {
  store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  get length(): number {
    return this.store.size;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
}

describe('Sprint 4.2 — createAIRecommendationDedupAdapter', () => {
  let storage: MemoryStorage;
  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it('returns hasSeen=false for fresh recommendation', () => {
    const adapter = createAIRecommendationDedupAdapter({ storage });
    expect(adapter.hasSeen('rec-1')).toBe(false);
  });

  it('markSeen + hasSeen round-trip', () => {
    const adapter = createAIRecommendationDedupAdapter({ storage });
    adapter.markSeen('rec-1');
    expect(adapter.hasSeen('rec-1')).toBe(true);
  });

  it('forget removes a single recommendation', () => {
    const adapter = createAIRecommendationDedupAdapter({ storage });
    adapter.markSeen('rec-1');
    adapter.markSeen('rec-2');
    adapter.forget('rec-1');
    expect(adapter.hasSeen('rec-1')).toBe(false);
    expect(adapter.hasSeen('rec-2')).toBe(true);
  });

  it('forgetAll removes all recommendations for this user', () => {
    const adapter = createAIRecommendationDedupAdapter({ storage });
    adapter.markSeen('rec-1');
    adapter.markSeen('rec-2');
    adapter.markSeen('rec-3');
    adapter.forgetAll();
    expect(adapter.hasSeen('rec-1')).toBe(false);
    expect(adapter.hasSeen('rec-2')).toBe(false);
    expect(adapter.hasSeen('rec-3')).toBe(false);
  });

  it('isolates dedup per userKey', () => {
    const adapterA = createAIRecommendationDedupAdapter({ storage, userKey: 'user-a' });
    const adapterB = createAIRecommendationDedupAdapter({ storage, userKey: 'user-b' });
    adapterA.markSeen('rec-1');
    expect(adapterA.hasSeen('rec-1')).toBe(true);
    expect(adapterB.hasSeen('rec-1')).toBe(false);
  });

  it('forgetAll only clears the current user, not others', () => {
    const adapterA = createAIRecommendationDedupAdapter({ storage, userKey: 'user-a' });
    const adapterB = createAIRecommendationDedupAdapter({ storage, userKey: 'user-b' });
    adapterA.markSeen('rec-1');
    adapterB.markSeen('rec-1');
    adapterA.forgetAll();
    expect(adapterA.hasSeen('rec-1')).toBe(false);
    expect(adapterB.hasSeen('rec-1')).toBe(true);
  });

  it('treats empty recommendationId as not-seen and silently ignores markSeen', () => {
    const adapter = createAIRecommendationDedupAdapter({ storage });
    // hasSeen swallows the buildKey-error and returns false (defensive).
    expect(adapter.hasSeen('')).toBe(false);
    // markSeen with empty id should not affect storage.
    adapter.markSeen('   ');
    expect(storage.length).toBe(0);
  });
});
