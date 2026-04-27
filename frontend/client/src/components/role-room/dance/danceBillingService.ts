/**
 * Frontend client for /api/dance/billing.
 */

const BASE = '/api/dance/billing';

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new Error(body.message || body.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Types ──────────────────────────────────────────────────────────────

export type PlanPersona = 'dance_freelance' | 'dance_studio' | 'both';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete' | 'comp';
export type BillingPeriod = 'monthly' | 'yearly' | 'tester' | 'comp';

export interface DancePlan {
  slug: string;
  name: string;
  persona: PlanPersona;
  description: string | null;
  monthlyPriceKr: number | null;
  yearlyPriceKr: number | null;
  stripeMonthlyPriceId: string | null;
  stripeYearlyPriceId: string | null;
  features: string[];
  limits: Record<string, unknown>;
  trialDays: number;
  isActive: boolean;
  isFeatured: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface DanceSubscription {
  userId: string;
  planSlug: string;
  billingPeriod: BillingPeriod;
  status: SubscriptionStatus;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: string | null;
  trialEndAt: string | null;
  cancelAtPeriodEnd: boolean;
  testerInviteToken: string | null;
  compGrantedByUserId: string | null;
  compExpiresAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TesterInvite {
  token: string;
  invitedByUserId: string;
  invitedEmail: string | null;
  invitedName: string | null;
  planSlug: string;
  trialDays: number;
  maxUses: number;
  usedCount: number;
  validUntil: string | null;
  acceptedAt: string | null;
  acceptedUserId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicTesterInvite {
  token: string;
  planSlug: string;
  planName: string;
  trialDays: number;
  validUntil: string | null;
  usesRemaining: number;
}

export interface AdminSetting {
  key: string;
  value: Record<string, unknown>;
  description: string | null;
  updatedByUserId: string | null;
  updatedAt: string;
}

// ─── Plans ──────────────────────────────────────────────────────────────

export async function listPlans(): Promise<DancePlan[]> {
  const res = await fetch(`${BASE}/plans`, { credentials: 'include' });
  const body = await readJson<{ success: boolean; data: DancePlan[] }>(res);
  return body.data;
}

export async function listPlansAdmin(): Promise<DancePlan[]> {
  const res = await fetch(`${BASE}/admin/plans`, { credentials: 'include' });
  const body = await readJson<{ success: boolean; data: DancePlan[] }>(res);
  return body.data;
}

export async function createPlan(input: Partial<DancePlan> & { slug: string; name: string }): Promise<DancePlan> {
  const res = await fetch(`${BASE}/admin/plans`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    credentials: 'include', body: JSON.stringify(input),
  });
  const body = await readJson<{ success: boolean; data: DancePlan }>(res);
  return body.data;
}

export async function patchPlan(slug: string, patch: Partial<DancePlan>): Promise<DancePlan> {
  const res = await fetch(`${BASE}/admin/plans/${encodeURIComponent(slug)}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    credentials: 'include', body: JSON.stringify(patch),
  });
  const body = await readJson<{ success: boolean; data: DancePlan }>(res);
  return body.data;
}

export async function deletePlan(slug: string): Promise<void> {
  const res = await fetch(`${BASE}/admin/plans/${encodeURIComponent(slug)}`, {
    method: 'DELETE', credentials: 'include',
  });
  if (!res.ok && res.status !== 404) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `HTTP ${res.status}`);
  }
}

// ─── Subscription ───────────────────────────────────────────────────────

export async function getSubscription(): Promise<DanceSubscription | null> {
  const res = await fetch(`${BASE}/subscription`, { credentials: 'include' });
  const body = await readJson<{ success: boolean; data: DanceSubscription | null }>(res);
  return body.data;
}

export async function listAllSubscriptions(): Promise<DanceSubscription[]> {
  const res = await fetch(`${BASE}/admin/subscriptions`, { credentials: 'include' });
  const body = await readJson<{ success: boolean; data: DanceSubscription[] }>(res);
  return body.data;
}

export async function grantCompSubscription(input: {
  userId: string;
  planSlug: string;
  expiresAt?: string | null;
  notes?: string | null;
}): Promise<DanceSubscription> {
  const res = await fetch(`${BASE}/admin/subscriptions/comp`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    credentials: 'include', body: JSON.stringify(input),
  });
  const body = await readJson<{ success: boolean; data: DanceSubscription }>(res);
  return body.data;
}

// ─── Stripe checkout ────────────────────────────────────────────────────

export async function startCheckout(input: {
  planSlug: string;
  billingPeriod: 'monthly' | 'yearly';
  successUrl: string;
  cancelUrl: string;
}): Promise<{ sessionUrl: string }> {
  const res = await fetch(`${BASE}/checkout-session`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    credentials: 'include', body: JSON.stringify(input),
  });
  const body = await readJson<{ success: boolean; data: { sessionUrl: string } }>(res);
  return body.data;
}

export async function openCustomerPortal(returnUrl: string): Promise<{ portalUrl: string }> {
  const res = await fetch(`${BASE}/customer-portal`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    credentials: 'include', body: JSON.stringify({ returnUrl }),
  });
  const body = await readJson<{ success: boolean; data: { portalUrl: string } }>(res);
  return body.data;
}

// ─── Tester invites ─────────────────────────────────────────────────────

export async function listTesterInvites(): Promise<TesterInvite[]> {
  const res = await fetch(`${BASE}/admin/tester-invites`, { credentials: 'include' });
  const body = await readJson<{ success: boolean; data: TesterInvite[] }>(res);
  return body.data;
}

export async function createTesterInvite(input: {
  invitedEmail?: string | null;
  invitedName?: string | null;
  planSlug: string;
  trialDays?: number;
  maxUses?: number;
  validUntil?: string | null;
  notes?: string | null;
}): Promise<TesterInvite> {
  const res = await fetch(`${BASE}/admin/tester-invites`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    credentials: 'include', body: JSON.stringify(input),
  });
  const body = await readJson<{ success: boolean; data: TesterInvite }>(res);
  return body.data;
}

export async function patchTesterInvite(token: string, patch: Partial<TesterInvite>): Promise<TesterInvite> {
  const res = await fetch(`${BASE}/admin/tester-invites/${encodeURIComponent(token)}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    credentials: 'include', body: JSON.stringify(patch),
  });
  const body = await readJson<{ success: boolean; data: TesterInvite }>(res);
  return body.data;
}

export async function deleteTesterInvite(token: string): Promise<void> {
  const res = await fetch(`${BASE}/admin/tester-invites/${encodeURIComponent(token)}`, {
    method: 'DELETE', credentials: 'include',
  });
  if (!res.ok && res.status !== 404) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `HTTP ${res.status}`);
  }
}

export async function getPublicInvite(token: string): Promise<PublicTesterInvite | null> {
  const res = await fetch(`${BASE}/tester-invites/${encodeURIComponent(token)}`);
  if (res.status === 404) return null;
  const body = await readJson<{ success: boolean; data: PublicTesterInvite }>(res);
  return body.data;
}

export async function acceptInvite(token: string): Promise<DanceSubscription> {
  const res = await fetch(`${BASE}/tester-invites/${encodeURIComponent(token)}/accept`, {
    method: 'POST', credentials: 'include',
  });
  const body = await readJson<{ success: boolean; data: DanceSubscription }>(res);
  return body.data;
}

// ─── Admin settings ─────────────────────────────────────────────────────

export async function listAdminSettings(): Promise<AdminSetting[]> {
  const res = await fetch(`${BASE}/admin/settings`, { credentials: 'include' });
  const body = await readJson<{ success: boolean; data: AdminSetting[] }>(res);
  return body.data;
}

export async function setAdminSetting(
  key: string,
  value: Record<string, unknown>,
  description?: string | null,
): Promise<AdminSetting> {
  const res = await fetch(`${BASE}/admin/settings/${encodeURIComponent(key)}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    credentials: 'include', body: JSON.stringify({ value, description }),
  });
  const body = await readJson<{ success: boolean; data: AdminSetting }>(res);
  return body.data;
}

// ─── Helpers ────────────────────────────────────────────────────────────

export function isPlanActive(sub: DanceSubscription | null): boolean {
  if (!sub) return false;
  if (sub.status === 'active' || sub.status === 'trialing' || sub.status === 'comp') return true;
  return false;
}

export function hasFeature(plan: DancePlan | null, feature: string): boolean {
  return plan?.features.includes(feature) === true;
}

export function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}
