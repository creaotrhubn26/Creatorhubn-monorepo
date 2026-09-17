/**
 * Kjøpsmodell for POC-en. Alt er lokalt (localStorage) og uten ekte betaling.
 *
 * - Quick buy: én severdighet, kun tilgjengelig når brukeren er innenfor
 *   `QUICK_BUY_RADIUS_M` av severdigheten («du er her – hør guiden nå»).
 * - Abonnement: alle severdigheter, månedlig eller årlig.
 */

export const QUICK_BUY_RADIUS_M = 300;

export type SubscriptionPlan = 'monthly' | 'yearly';

export interface Entitlements {
  /** ISO-dato for når abonnementet utløper, eller null. */
  subscriptionUntil: string | null;
  plan: SubscriptionPlan | null;
  /** Severdighets-id-er kjøpt enkeltvis. */
  quickBuys: string[];
}

export const EMPTY_ENTITLEMENTS: Entitlements = {
  subscriptionUntil: null,
  plan: null,
  quickBuys: [],
};

export const PRICES_NOK = {
  monthly: 79,
  yearly: 499,
} as const;

export function hasActiveSubscription(e: Entitlements, now: Date = new Date()): boolean {
  if (!e.subscriptionUntil) return false;
  return new Date(e.subscriptionUntil).getTime() > now.getTime();
}

export function isEntitled(e: Entitlements, attractionId: string, now: Date = new Date()): boolean {
  return hasActiveSubscription(e, now) || e.quickBuys.includes(attractionId);
}

/** Quick buy er bare lov når brukeren faktisk står ved severdigheten. */
export function canQuickBuy(distanceM: number | null): boolean {
  return distanceM !== null && Number.isFinite(distanceM) && distanceM <= QUICK_BUY_RADIUS_M;
}

export function applyQuickBuy(e: Entitlements, attractionId: string): Entitlements {
  if (e.quickBuys.includes(attractionId)) return e;
  return { ...e, quickBuys: [...e.quickBuys, attractionId] };
}

export function applySubscription(
  e: Entitlements,
  plan: SubscriptionPlan,
  now: Date = new Date(),
): Entitlements {
  const until = new Date(now);
  if (plan === 'monthly') until.setMonth(until.getMonth() + 1);
  else until.setFullYear(until.getFullYear() + 1);
  return { ...e, plan, subscriptionUntil: until.toISOString() };
}
