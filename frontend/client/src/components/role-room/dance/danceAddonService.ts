/**
 * Frontend client for /api/dance/addons.
 */

const BASE = '/api/dance/addons';

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
    throw new Error(body.detail || body.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken') || '';
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export type AddonPersona = 'dance_freelance' | 'dance_studio';

export interface DanceAddon {
  slug: string;
  name: string;
  description: string | null;
  monthlyPriceKr: number | null;
  yearlyPriceKr: number | null;
  stripeMonthlyPriceId: string | null;
  stripeYearlyPriceId: string | null;
  featureFlags: string[];
  availableForPersonas: AddonPersona[];
  requiresAddonEligiblePlan: boolean;
  trialDays: number;
  isActive: boolean;
  isFeatured: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface DanceAddonSubscription {
  id: string;
  userId: string;
  addonSlug: string;
  billingPeriod: 'monthly' | 'yearly' | 'comp';
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'comp';
  currentPeriodEnd: string | null;
  trialEndAt: string | null;
  cancelAtPeriodEnd: boolean;
}

export async function listAddons(persona?: AddonPersona): Promise<DanceAddon[]> {
  const url = persona ? `${BASE}/?persona=${persona}` : BASE;
  const res = await fetch(url, { headers: authHeaders() });
  const w = await readJson<{ success: boolean; data: DanceAddon[] }>(res);
  return w.data;
}

export async function listMyActiveAddons(): Promise<DanceAddonSubscription[]> {
  const res = await fetch(`${BASE}/me`, { headers: authHeaders() });
  const w = await readJson<{ success: boolean; data: DanceAddonSubscription[] }>(res);
  return w.data;
}

export async function getMyAddonFeatureFlags(): Promise<string[]> {
  const res = await fetch(`${BASE}/me/feature-flags`, { headers: authHeaders() });
  const w = await readJson<{ success: boolean; data: { featureFlags: string[] } }>(res);
  return w.data.featureFlags;
}

export async function startAddonTrial(slug: string): Promise<DanceAddonSubscription> {
  const res = await fetch(`${BASE}/me/${encodeURIComponent(slug)}/trial`, {
    method: 'POST',
    headers: authHeaders(),
  });
  const w = await readJson<{ success: boolean; data: DanceAddonSubscription }>(res);
  return w.data;
}

export async function cancelAddon(slug: string): Promise<void> {
  const res = await fetch(`${BASE}/me/${encodeURIComponent(slug)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  await readJson<{ success: boolean }>(res);
}
