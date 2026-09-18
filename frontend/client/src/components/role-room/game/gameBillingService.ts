/**
 * Frontend-klient for /api/game/billing (spillstudio / Story Graph).
 * Speiler dance/danceBillingService.ts uten persona.
 */

import { authSessionService } from '../services/authSessionService';

const BASE = '/api/game/billing';

function headers(extra?: Record<string, string>): Record<string, string> {
  return { ...(extra ?? {}), ...authSessionService.getAuthHeadersSync() };
}

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new Error(body.message || body.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Typer ───────────────────────────────────────────────────────────────

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete' | 'comp';
export type BillingPeriod = 'monthly' | 'yearly' | 'tester' | 'comp';

/** Feature-nøkler Story Graph gater på (speiler backend game-billing-service). */
export type GameFeature =
  | 'play' | 'export_json' | 'export_md' | 'share_links' | 'export_html'
  | 'ai_assist' | 'translations' | 'import_twine_ink' | 'runtime_packages' | 'export_pdf' | 'scene_review'
  | 'production_plan' | 'team_seats' | 'guest_reviewers'
  // Fase 8g: Studio
  | 'ci_evidence' | 'playtest_telemetry';

export const GAME_FEATURE_LABEL: Record<GameFeature, string> = {
  play: 'Play Mode med debugger',
  export_json: 'JSON-eksport (Arcweave-kompatibel)',
  export_md: 'Markdown-eksport',
  share_links: 'Delbare spill-lenker',
  export_html: 'Spillbar HTML (standalone)',
  ai_assist: 'KI-forslag til elementer',
  translations: 'Oversettelser med KI',
  import_twine_ink: 'Import fra Twine og Ink',
  runtime_packages: 'Runtime-pakker for Unity og Godot',
  export_pdf: 'PDF-eksport (lesbart manus)',
  scene_review: 'Review-runder med godkjenning per scene',
  production_plan: 'Produksjonsplan med milepæler og Gantt',
  team_seats: 'Team, roller og seter',
  guest_reviewers: 'Gjeste-reviewere uten konto',
  ci_evidence: 'CI-bevis: spillbygget setter leveransegater',
  playtest_telemetry: 'Spilltest-telemetri fra spillet',
};

export interface GamePlan {
  slug: string;
  name: string;
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

export interface GameSubscription {
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

export interface EffectivePlan {
  subscription: GameSubscription | null;
  plan: GamePlan;
  active: boolean;
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

export interface AdminSetting {
  key: string;
  value: Record<string, unknown>;
  description: string | null;
  updatedByUserId: string | null;
  updatedAt: string;
}

type Envelope<T> = { success: boolean; data: T };

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: headers(), credentials: 'include' });
  return (await readJson<Envelope<T>>(res)).data;
}
async function send<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method, headers: headers(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    credentials: 'include', body: body === undefined ? undefined : JSON.stringify(body),
  });
  return (await readJson<Envelope<T>>(res)).data;
}
async function del(path: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE', headers: headers(), credentials: 'include' });
  if (!res.ok && res.status !== 404) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `HTTP ${res.status}`);
  }
}

// ─── Planer ──────────────────────────────────────────────────────────────
export const listPlans = () => get<GamePlan[]>('/plans');
export const listPlansAdmin = () => get<GamePlan[]>('/admin/plans');
export const createPlan = (input: Partial<GamePlan> & { slug: string; name: string }) => send<GamePlan>('POST', '/admin/plans', input);
export const patchPlan = (slug: string, patch: Partial<GamePlan>) => send<GamePlan>('PATCH', `/admin/plans/${encodeURIComponent(slug)}`, patch);
export const deletePlan = (slug: string) => del(`/admin/plans/${encodeURIComponent(slug)}`);

// ─── Abonnement ──────────────────────────────────────────────────────────
export const getSubscription = () => get<GameSubscription | null>('/subscription');
/** Effektiv plan for innlogget bruker: abonnementets plan, ellers `solo`. */
export const getMyPlan = () => get<EffectivePlan>('/me');
export const listAllSubscriptions = () => get<GameSubscription[]>('/admin/subscriptions');
export const grantCompSubscription = (input: { userId: string; planSlug: string; expiresAt?: string | null; notes?: string | null }) =>
  send<GameSubscription>('POST', '/admin/subscriptions/comp', input);

// ─── Stripe ──────────────────────────────────────────────────────────────
export const startCheckout = (input: { planSlug: string; billingPeriod: 'monthly' | 'yearly'; successUrl: string; cancelUrl: string }) =>
  send<{ sessionUrl: string }>('POST', '/checkout-session', input);
export const openCustomerPortal = (returnUrl: string) => send<{ portalUrl: string }>('POST', '/customer-portal', { returnUrl });

// ─── Tester-invites ──────────────────────────────────────────────────────
export const listTesterInvites = () => get<TesterInvite[]>('/admin/tester-invites');
export const createTesterInvite = (input: { invitedEmail?: string | null; invitedName?: string | null; planSlug: string; trialDays?: number; maxUses?: number; validUntil?: string | null; notes?: string | null }) =>
  send<TesterInvite>('POST', '/admin/tester-invites', input);
export const deleteTesterInvite = (token: string) => del(`/admin/tester-invites/${encodeURIComponent(token)}`);
export const acceptInvite = (token: string) => send<GameSubscription>('POST', `/tester-invites/${encodeURIComponent(token)}/accept`);

// ─── Admin-innstillinger ─────────────────────────────────────────────────
export const listAdminSettings = () => get<AdminSetting[]>('/admin/settings');
export const setAdminSetting = (key: string, value: Record<string, unknown>, description?: string | null) =>
  send<AdminSetting>('PUT', `/admin/settings/${encodeURIComponent(key)}`, { value, description });

// ─── Hjelpere ────────────────────────────────────────────────────────────
export function isPlanActive(sub: GameSubscription | null): boolean {
  return !!sub && (sub.status === 'active' || sub.status === 'trialing' || sub.status === 'comp');
}
export function hasFeature(plan: GamePlan | null, feature: GameFeature | string): boolean {
  return plan?.features.includes(feature) === true;
}
export function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}
export function isFreePlan(plan: GamePlan): boolean {
  return (plan.monthlyPriceKr ?? 0) === 0 && (plan.yearlyPriceKr ?? 0) === 0;
}
