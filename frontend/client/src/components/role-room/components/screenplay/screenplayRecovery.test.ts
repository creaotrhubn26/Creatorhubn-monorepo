import { describe, expect, it } from 'vitest';

import {
  addScreenplayRecoveryPoint,
  clearScreenplayRecovery,
  initializeScreenplayRecovery,
  loadScreenplayRecovery,
  persistScreenplayRecovery,
} from './screenplayRecovery';

const memoryStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
};

describe('screenplay recovery', () => {
  it('keeps recovery data isolated by manuscript and user', () => {
    const storage = memoryStorage();
    initializeScreenplayRecovery('manus-a', 'user-a', 'Original', {
      storage,
      now: new Date('2026-09-09T10:00:00.000Z'),
    });

    expect(loadScreenplayRecovery('manus-a', 'user-a', storage)?.draft.content).toBe('Original');
    expect(loadScreenplayRecovery('manus-a', 'user-b', storage)).toBeNull();
    expect(loadScreenplayRecovery('manus-b', 'user-a', storage)).toBeNull();
  });

  it('persists the latest draft and snapshots the previous draft before replacement', () => {
    const storage = memoryStorage();
    initializeScreenplayRecovery('manus-a', 'user-a', 'Original', {
      storage,
      now: new Date('2026-09-09T10:00:00.000Z'),
    });
    const updated = persistScreenplayRecovery('manus-a', 'user-a', 'New text', {
      storage,
      now: new Date('2026-09-09T10:06:00.000Z'),
    });

    expect(updated.draft.content).toBe('New text');
    expect(updated.points.some((point) => point.content === 'Original')).toBe(true);
  });

  it('can preserve a divergent local draft immediately before new typing replaces it', () => {
    const storage = memoryStorage();
    initializeScreenplayRecovery('manus-a', 'user-a', 'Older local draft', {
      storage,
      now: new Date('2026-09-09T10:00:00.000Z'),
    });

    const updated = persistScreenplayRecovery('manus-a', 'user-a', 'Cloud draft plus one key', {
      storage,
      now: new Date('2026-09-09T10:00:01.000Z'),
      forceSnapshot: true,
    });

    expect(updated.draft.content).toBe('Cloud draft plus one key');
    expect(updated.points.some((point) => point.content === 'Older local draft')).toBe(true);
  });

  it('creates a manual point and can clear the local recovery store', () => {
    const storage = memoryStorage();
    const stored = addScreenplayRecoveryPoint('manus-a', 'user-a', 'Checkpoint', 'manual', {
      storage,
      now: new Date('2026-09-09T10:00:00.000Z'),
    });
    expect(stored.points[0]).toMatchObject({ content: 'Checkpoint', reason: 'manual' });

    clearScreenplayRecovery('manus-a', 'user-a', storage);
    expect(loadScreenplayRecovery('manus-a', 'user-a', storage)).toBeNull();
  });
});
