import { describe, expect, it } from 'vitest';
import {
  applyQuickBuy,
  applySubscription,
  canQuickBuy,
  EMPTY_ENTITLEMENTS,
  hasActiveSubscription,
  isEntitled,
  QUICK_BUY_RADIUS_M,
} from '../src/lib/entitlements';

describe('quick buy', () => {
  it('only allowed inside the geofence', () => {
    expect(canQuickBuy(QUICK_BUY_RADIUS_M)).toBe(true);
    expect(canQuickBuy(QUICK_BUY_RADIUS_M + 1)).toBe(false);
    expect(canQuickBuy(null)).toBe(false);
    expect(canQuickBuy(Number.NaN)).toBe(false);
  });
  it('grants access to exactly that attraction', () => {
    const e = applyQuickBuy(EMPTY_ENTITLEMENTS, 'a');
    expect(isEntitled(e, 'a')).toBe(true);
    expect(isEntitled(e, 'b')).toBe(false);
  });
  it('is idempotent', () => {
    const e = applyQuickBuy(applyQuickBuy(EMPTY_ENTITLEMENTS, 'a'), 'a');
    expect(e.quickBuys).toEqual(['a']);
  });
});

describe('subscription', () => {
  const now = new Date('2026-09-17T12:00:00Z');
  it('monthly lasts one month and covers all attractions', () => {
    const e = applySubscription(EMPTY_ENTITLEMENTS, 'monthly', now);
    expect(hasActiveSubscription(e, now)).toBe(true);
    expect(isEntitled(e, 'anything', now)).toBe(true);
    expect(hasActiveSubscription(e, new Date('2026-10-18T12:00:00Z'))).toBe(false);
  });
  it('yearly lasts one year', () => {
    const e = applySubscription(EMPTY_ENTITLEMENTS, 'yearly', now);
    expect(hasActiveSubscription(e, new Date('2027-09-16T12:00:00Z'))).toBe(true);
    expect(hasActiveSubscription(e, new Date('2027-09-18T12:00:00Z'))).toBe(false);
  });
  it('no subscription by default', () => {
    expect(hasActiveSubscription(EMPTY_ENTITLEMENTS, now)).toBe(false);
  });
});
