/**
 * Tests for the client-gallery read-receipt merge logic.
 *
 * `mergeViewState` overlays per-token view-state (fetched via defensive raw SQL
 * that may be empty when the migration hasn't run) onto the token summaries.
 * Invariants:
 *   - A token WITH view-state keeps its firstViewedAt + viewCount.
 *   - A token WITHOUT view-state degrades to the "not seen" default (null, 0),
 *     so the photographer surface never breaks before the migration lands.
 *   - Order + all base fields are preserved.
 */
import { describe, expect, it } from 'vitest';
import { mergeViewState, type ClientTokenSummary } from './capture-client-tokens-service.js';

type BaseSummary = Omit<ClientTokenSummary, 'firstViewedAt' | 'viewCount'>;

function base(id: string): BaseSummary {
  return {
    id,
    clientLabel: `client-${id}`,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    expiresAt: new Date('2026-02-01T00:00:00Z'),
    revokedAt: null,
    lastUsedAt: null,
    hasPin: false,
  };
}

describe('mergeViewState', () => {
  it('overlays view-state when present', () => {
    const viewedAt = new Date('2026-01-05T12:00:00Z');
    const out = mergeViewState(
      [base('a')],
      new Map([['a', { firstViewedAt: viewedAt, viewCount: 3 }]]),
    );
    expect(out[0].firstViewedAt).toEqual(viewedAt);
    expect(out[0].viewCount).toBe(3);
    expect(out[0].clientLabel).toBe('client-a');
  });

  it('defaults to not-seen when view-state is missing (pre-migration)', () => {
    const out = mergeViewState([base('a')], new Map());
    expect(out[0].firstViewedAt).toBeNull();
    expect(out[0].viewCount).toBe(0);
  });

  it('preserves order and applies state per-token', () => {
    const out = mergeViewState(
      [base('a'), base('b'), base('c')],
      new Map([['b', { firstViewedAt: new Date('2026-01-09T00:00:00Z'), viewCount: 1 }]]),
    );
    expect(out.map((t) => t.id)).toEqual(['a', 'b', 'c']);
    expect(out[0].viewCount).toBe(0);
    expect(out[1].viewCount).toBe(1);
    expect(out[2].firstViewedAt).toBeNull();
  });
});
