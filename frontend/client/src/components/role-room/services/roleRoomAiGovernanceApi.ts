/**
 * HTTP client for the admin-only AI governance endpoints (DPO view).
 */

import authSessionService from './authSessionService';

const API_BASE = '/api/role-room/admin/ai-governance';

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

export interface AiGovernanceOverview {
  activeConsents: number;
  consentsByScope: Array<{ scope: string; count: number }>;
  calls24h: {
    total: number;
    ok: number;
    blocked_by_consent: number;
    blocked_by_rate_limit: number;
    errored: number;
    cacheHits: number;
    promptTokens: number;
    completionTokens: number;
  };
  callsByProject24h: Array<{
    projectId: string;
    calls: number;
    promptTokens: number;
    completionTokens: number;
    cacheHits: number;
  }>;
  callsByModel24h: Array<{ model: string; calls: number }>;
  topErrors24h: Array<{ errorCode: string | null; count: number }>;
}

export interface AiGovernanceConsent {
  id: string;
  projectId: string;
  userId: string;
  scope: string;
  processor: string;
  grantedAt: string;
  revokedAt: string | null;
  note: string | null;
}

export interface AiGovernanceAuditRow {
  id: string;
  project_id: string;
  user_id: string;
  processor: string;
  model: string;
  action: string;
  status: string;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  latency_ms: number | null;
  field_categories: string[];
  entity_count: number;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
}

export async function fetchAiGovernanceOverview(): Promise<AiGovernanceOverview | null> {
  const response = await fetch(`${API_BASE}/overview`, { headers: buildHeaders() });
  if (!response.ok) return null;
  return (await response.json()) as AiGovernanceOverview;
}

export async function fetchAiGovernanceConsents(
  options?: { includeRevoked?: boolean; limit?: number },
): Promise<AiGovernanceConsent[]> {
  const qs = new URLSearchParams();
  if (options?.includeRevoked) qs.set('includeRevoked', 'true');
  if (options?.limit) qs.set('limit', String(options.limit));
  const response = await fetch(`${API_BASE}/consents${qs.size ? `?${qs}` : ''}`, {
    headers: buildHeaders(),
  });
  if (!response.ok) return [];
  const body = await response.json();
  return Array.isArray(body.consents) ? body.consents : [];
}

export async function fetchAiGovernanceAudit(
  options?: { limit?: number; projectId?: string; status?: string },
): Promise<AiGovernanceAuditRow[]> {
  const qs = new URLSearchParams();
  if (options?.limit) qs.set('limit', String(options.limit));
  if (options?.projectId) qs.set('projectId', options.projectId);
  if (options?.status) qs.set('status', options.status);
  const response = await fetch(`${API_BASE}/audit${qs.size ? `?${qs}` : ''}`, {
    headers: buildHeaders(),
  });
  if (!response.ok) return [];
  const body = await response.json();
  return Array.isArray(body.rows) ? body.rows : [];
}

// ── Entitlements (admin) ──────────────────────────────────────

const ADMIN_AGENT_BASE = '/api/role-room/admin/agent';

export interface AiEntitlementRow {
  id: string;
  user_id: string;
  status: 'trial' | 'active' | 'expired' | 'revoked';
  source: 'plan_pro' | 'plan_enterprise' | 'addon_monthly' | 'admin_grant' | 'trial';
  trial_ends_at: string | null;
  stripe_subscription_id: string | null;
  granted_at: string;
  revoked_at: string | null;
  notes: string | null;
}

export async function fetchEntitlements(limit = 200): Promise<AiEntitlementRow[]> {
  const response = await fetch(
    `${ADMIN_AGENT_BASE}/entitlements?limit=${limit}`,
    { headers: buildHeaders() },
  );
  if (!response.ok) return [];
  const body = await response.json();
  return Array.isArray(body.entitlements) ? body.entitlements : [];
}

export async function grantEntitlement(input: {
  userId: string;
  notes?: string;
  trialDays?: number;
}): Promise<boolean> {
  const response = await fetch(`${ADMIN_AGENT_BASE}/entitlements/grant`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(input),
  });
  return response.ok;
}

export async function revokeEntitlement(input: {
  userId: string;
  reason?: string;
}): Promise<boolean> {
  const response = await fetch(`${ADMIN_AGENT_BASE}/entitlements/revoke`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(input),
  });
  return response.ok;
}
