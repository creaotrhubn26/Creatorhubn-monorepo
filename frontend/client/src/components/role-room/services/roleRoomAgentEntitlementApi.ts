/**
 * HTTP client for The Role Room Agent entitlement + monetization flows.
 */

import authSessionService from './authSessionService';

const API_BASE = '/api/role-room';

function buildHeaders(): HeadersInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const sessionHeaders = authSessionService.getAuthHeadersSync?.() ?? {};
  Object.assign(headers, sessionHeaders);
  const session = authSessionService.getSessionSync?.();
  const userId = session?.currentUserId;
  if (typeof userId === 'string' && userId.trim().length > 0) {
    headers['x-role-room-user-id'] = userId.trim();
  }
  return headers;
}

export type EntitlementSource =
  | 'admin'
  | 'plan_pro'
  | 'plan_enterprise'
  | 'addon_monthly'
  | 'trial'
  | 'none';

export interface EntitlementResult {
  allowed: boolean;
  source: EntitlementSource;
  status: 'trial' | 'active' | 'expired' | 'revoked' | 'none';
  trialEndsAt?: string | null;
  daysRemaining?: number | null;
  upsell?: {
    canStartTrial: boolean;
    canBuyAddOn: boolean;
    canUpgradeToPro: boolean;
    currentPlanType: string | null;
  };
  reason: string;
}

export interface EntitlementConfig {
  trialDays: number;
  trialCallsPerDay: number;
  basicTierIncluded: boolean;
  addonMonthlyPriceNok: number;
}

export interface EntitlementBundle {
  entitlement: EntitlementResult;
  config: EntitlementConfig;
}

export async function fetchAgentEntitlement(): Promise<EntitlementBundle | null> {
  const response = await fetch(`${API_BASE}/agent/entitlement`, { headers: buildHeaders() });
  if (!response.ok) return null;
  return (await response.json()) as EntitlementBundle;
}

export async function startAgentTrialRequest(): Promise<
  | { ok: true; trialEndsAt: string; entitlement: EntitlementResult }
  | { ok: false; error: string }
> {
  const response = await fetch(`${API_BASE}/agent/entitlement/trial/start`, {
    method: 'POST',
    headers: buildHeaders(),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    return { ok: false, error: body?.error ?? `HTTP ${response.status}` };
  }
  const body = await response.json();
  return { ok: true, trialEndsAt: body.trialEndsAt, entitlement: body.entitlement };
}

export async function createAddonCheckout(): Promise<
  | { status: 'ok'; url: string }
  | { status: 'not_configured'; detail: string }
  | { status: 'error'; detail: string }
> {
  const response = await fetch(`${API_BASE}/agent/entitlement/addon/checkout`, {
    method: 'POST',
    headers: buildHeaders(),
  });
  const body = await response.json().catch(() => null);
  if (response.status === 503) {
    return { status: 'not_configured', detail: body?.detail ?? 'not configured' };
  }
  if (!response.ok) {
    return { status: 'error', detail: body?.detail ?? body?.error ?? `HTTP ${response.status}` };
  }
  return { status: 'ok', url: body?.url ?? '' };
}
