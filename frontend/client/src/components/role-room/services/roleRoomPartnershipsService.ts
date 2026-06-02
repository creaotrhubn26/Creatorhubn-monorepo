/**
 * roleRoomPartnershipsService.ts
 *
 * Agency ↔ Production team partnership-system. Frontend-laget.
 *
 * Backend-endepunkter:
 *   GET    /api/role-room/partnerships/availability
 *   POST   /api/role-room/partnerships/availability/accept-terms
 *   POST   /api/role-room/partnerships/availability/enable
 *   POST   /api/role-room/partnerships/availability/pause
 *   POST   /api/role-room/partnerships/availability/unpause
 *   POST   /api/role-room/partnerships/availability/close
 *   GET    /api/role-room/partnerships/mine
 *   POST   /api/role-room/partnerships/propose
 *   POST   /api/role-room/partnerships/:id/respond
 *   POST   /api/role-room/partnerships/:id/pause
 *   POST   /api/role-room/partnerships/:id/unpause
 *   POST   /api/role-room/partnerships/:id/revoke
 *   POST   /api/role-room/partnerships/:id/invite-project
 *   GET    /api/role-room/partnerships/:id/invitations
 *   POST   /api/role-room/partnerships/invitations/:invId/respond
 *   GET    /api/role-room/partnerships/invitations/incoming
 *   GET    /api/role-room/partnerships/discoverable-agencies
 */

export const CURRENT_PARTNERSHIP_TERMS_VERSION = '1.0';

export type AvailabilityState =
  | 'not_started'
  | 'needs_profile'
  | 'needs_terms'
  | 'needs_terms_update'
  | 'disabled'
  | 'paused'
  | 'active'
  | 'closed';

export interface AvailabilityStatus {
  agency: { id: string; name: string };
  state: AvailabilityState;
  profile_complete: boolean;
  terms_accepted: boolean;
  terms_version_current: boolean;
  terms_version_required: string;
  terms_version_accepted: string | null;
  terms_accepted_at: string | null;
  enabled: boolean;
  enabled_at: string | null;
  paused: boolean;
  paused_at: string | null;
  paused_reason: string | null;
  closed: boolean;
  closed_at: string | null;
}

export interface Partnership {
  id: string;
  agency_org_id: string;
  agency_name: string;
  agency_logo_url: string | null;
  agency_type: string;
  production_user_id: string;
  production_name: string;
  production_email: string;
  proposed_by: 'agency' | 'production';
  proposed_by_user_id: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'revoked';
  message: string | null;
  proposed_at: string;
  responded_at: string | null;
  response_user_id: string | null;
  revoked_at: string | null;
  revoked_by_user_id: string | null;
  paused_at: string | null;
  paused_by_role: 'agency' | 'production' | null;
  paused_reason: string | null;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectInvitation {
  id: string;
  partnership_id: string;
  casting_project_id: string;
  project_name: string;
  project_status: string;
  project_type: string | null;
  start_date: string | null;
  end_date: string | null;
  invited_by_user_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'completed' | 'revoked' | 'expired';
  role_ids: string[] | null;
  notes: string | null;
  invited_at: string;
  responded_at: string | null;
  expires_at: string | null;
}

export interface DiscoverableAgency {
  id: string;
  name: string;
  type: string;
  slug: string;
  logo_url: string | null;
  about: string | null;
  website_url: string | null;
  verified: boolean;
  partnerships_enabled_at: string | null;
  talent_pool_size: number;
}

/** Konsekvens-respons fra /revoke eller /availability/close uten bekreftelse. */
export interface ConsequenceWarning {
  error: string;
  recommendation: 'pause';
  recommendation_reason: string;
  consequences: Record<string, unknown>;
  to_confirm: { confirm: true; acknowledge_consequences: true; reason?: string };
  alternative_pause_endpoint: string;
}

const BASE = '/api/role-room/partnerships';

function buildUrl(path: string, params?: Record<string, string | undefined>): string {
  let url = `${BASE}${path}`;
  if (params) {
    const qp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v != null && v !== '') qp.set(k, String(v));
    });
    // Bevar ?demo=1 fra nåværende URL hvis ikke eksplisitt overstyrt
    if (typeof window !== 'undefined' && !qp.has('demo')) {
      const cur = new URLSearchParams(window.location.search);
      if (cur.get('demo') === '1' || cur.get('demo') === 'true') qp.set('demo', '1');
    }
    const qs = qp.toString();
    if (qs) url += `?${qs}`;
  }
  return url;
}

async function api<T>(path: string, init?: RequestInit & { params?: Record<string, string | undefined> }): Promise<T> {
  const { params, ...rest } = init || {};
  const r = await fetch(buildUrl(path, params), {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(rest.headers ?? {}) },
    ...rest,
  });
  const payload: unknown = await r.json().catch(() => null);
  if (!r.ok) {
    // Spesialhåndtering: pause-anbefaling-respons fra /revoke + /close
    if (
      r.status === 409 &&
      payload &&
      typeof payload === 'object' &&
      (payload as { recommendation?: string }).recommendation === 'pause'
    ) {
      const err = new Error((payload as { error?: string }).error || 'Konsekvens-bekreftelse kreves') as Error & {
        warning?: ConsequenceWarning;
      };
      err.warning = payload as ConsequenceWarning;
      throw err;
    }
    const msg = (payload && typeof payload === 'object' && (payload as { error?: string }).error) || `HTTP ${r.status}`;
    throw new Error(msg);
  }
  return payload as T;
}

// ── Availability (byrå-bredt) ──────────────────────────────────────
export function getAvailability(): Promise<AvailabilityStatus> {
  return api<AvailabilityStatus>('/availability');
}

export function acceptTerms(termsVersion: string): Promise<{ agency: { id: string } }> {
  return api('/availability/accept-terms', {
    method: 'POST',
    body: JSON.stringify({ terms_version: termsVersion }),
  });
}

export function enableAvailability(): Promise<{ agency: { id: string } }> {
  return api('/availability/enable', { method: 'POST' });
}

export function pauseAvailability(reason?: string): Promise<{ agency: { id: string } }> {
  return api('/availability/pause', {
    method: 'POST',
    body: JSON.stringify({ reason: reason ?? null }),
  });
}

export function unpauseAvailability(): Promise<{ agency: { id: string } }> {
  return api('/availability/unpause', { method: 'POST' });
}

/** Første kall (uten confirm) kaster Error med .warning satt — UI viser dialog. */
export function closeAvailability(opts?: {
  confirm?: boolean;
  acknowledge_consequences?: boolean;
  reason?: string;
}): Promise<{ agency: { id: string }; revoked_partnerships_count: number }> {
  return api('/availability/close', {
    method: 'POST',
    body: JSON.stringify({
      confirm: opts?.confirm ?? false,
      acknowledge_consequences: opts?.acknowledge_consequences ?? false,
      reason: opts?.reason ?? null,
    }),
  });
}

// ── Partnerships ───────────────────────────────────────────────────
export function listMine(role: 'auto' | 'agency' | 'production' = 'auto'): Promise<{ partnerships: Partnership[] }> {
  return api('/mine', { method: 'GET', params: { role } });
}

export function propose(args: {
  agency_org_id: string;
  production_user_id: string;
  message?: string;
}): Promise<{ partnership: Partnership }> {
  return api('/propose', { method: 'POST', body: JSON.stringify(args) });
}

export function respondToPartnership(id: string, accept: boolean, reason?: string): Promise<{ partnership: Partnership }> {
  return api(`/${id}/respond`, {
    method: 'POST',
    body: JSON.stringify({ accept, reason: reason ?? null }),
  });
}

export function pausePartnership(id: string, reason?: string): Promise<{ partnership: Partnership }> {
  return api(`/${id}/pause`, { method: 'POST', body: JSON.stringify({ reason: reason ?? null }) });
}

export function unpausePartnership(id: string): Promise<{ partnership: Partnership }> {
  return api(`/${id}/unpause`, { method: 'POST' });
}

/** Første kall (uten confirm) kaster Error med .warning satt — UI viser dialog. */
export function revokePartnership(
  id: string,
  opts?: { confirm?: boolean; acknowledge_consequences?: boolean; reason?: string },
): Promise<{ partnership: Partnership }> {
  return api(`/${id}/revoke`, {
    method: 'POST',
    body: JSON.stringify({
      confirm: opts?.confirm ?? false,
      acknowledge_consequences: opts?.acknowledge_consequences ?? false,
      reason: opts?.reason ?? null,
    }),
  });
}

// ── Prosjekt-invitasjoner ──────────────────────────────────────────
export function inviteProject(
  partnershipId: string,
  args: { casting_project_id: string; role_ids?: string[]; notes?: string; expires_at?: string },
): Promise<{ invitation: ProjectInvitation }> {
  return api(`/${partnershipId}/invite-project`, { method: 'POST', body: JSON.stringify(args) });
}

export function listInvitations(partnershipId: string): Promise<{ invitations: ProjectInvitation[] }> {
  return api(`/${partnershipId}/invitations`);
}

export function respondToProjectInvitation(invId: string, accept: boolean): Promise<{ invitation: ProjectInvitation }> {
  return api(`/invitations/${invId}/respond`, { method: 'POST', body: JSON.stringify({ accept }) });
}

export function incomingInvitations(status?: string): Promise<{ invitations: ProjectInvitation[] }> {
  return api('/invitations/incoming', { method: 'GET', params: { status } });
}

// ── Discoverable agencies (for produksjon-perspektivet) ────────────
export function discoverableAgencies(filters?: { q?: string; type?: string }): Promise<{ agencies: DiscoverableAgency[] }> {
  return api('/discoverable-agencies', { method: 'GET', params: { q: filters?.q, type: filters?.type } });
}

// ── Talent-proposals (byrå → produksjon per invitasjon) ──────────────
export interface ProposableTalent {
  id: string;
  display_name: string;
  city: string | null;
  country: string | null;
  headshot_url: string | null;
  playing_age_min: number | null;
  playing_age_max: number | null;
  gender: string | null;
  availability_status: string | null;
  already_proposed: boolean;
}

export interface TalentProposal {
  id: string;
  invitation_id: string;
  talent_id: string;
  casting_role_id: string | null;
  proposed_by_user_id: string;
  agency_notes: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'withdrawn';
  production_notes: string | null;
  responded_at: string | null;
  response_user_id: string | null;
  withdrawn_at: string | null;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
  display_name?: string;
  headshot_url?: string | null;
  city?: string | null;
  country?: string | null;
  playing_age_min?: number | null;
  playing_age_max?: number | null;
  gender?: string | null;
  availability_status?: string | null;
  role_name?: string | null;
  role_description?: string | null;
  agency_name?: string;
  agency_logo_url?: string | null;
  proposer_name?: string | null;
}

export function proposableTalents(invitationId: string, q?: string): Promise<{ talents: ProposableTalent[] }> {
  return api(`/invitations/${invitationId}/proposable-talents`, { method: 'GET', params: { q } });
}

export function proposeTalent(
  invitationId: string,
  args: { talent_id: string; casting_role_id?: string; agency_notes?: string },
): Promise<{ proposal: TalentProposal }> {
  return api(`/invitations/${invitationId}/talent-proposals`, { method: 'POST', body: JSON.stringify(args) });
}

export function listTalentProposals(invitationId: string): Promise<{ proposals: TalentProposal[] }> {
  return api(`/invitations/${invitationId}/talent-proposals`);
}

export function withdrawTalentProposal(proposalId: string): Promise<{ proposal: TalentProposal }> {
  return api(`/talent-proposals/${proposalId}/withdraw`, { method: 'POST' });
}

export function respondToTalentProposal(
  proposalId: string,
  accept: boolean,
  production_notes?: string,
): Promise<{ proposal: TalentProposal; candidate_id: string | null }> {
  return api(`/talent-proposals/${proposalId}/respond`, {
    method: 'POST',
    body: JSON.stringify({ accept, production_notes: production_notes ?? null }),
  });
}

export function incomingTalentProposalsForProject(projectId: string): Promise<{ proposals: TalentProposal[] }> {
  return api(`/casting-projects/${projectId}/incoming-talent-proposals`);
}

// ── Agency dashboard ───────────────────────────────────────────────
export interface AgencyDashboard {
  partnerships: { pending: number; active: number; paused: number; revoked: number };
  project_invitations: { pending: number; accepted: number; closed: number };
  talent_proposals: {
    pending: number; accepted: number; declined: number; withdrawn: number;
    total: number; accept_rate_percent: number | null;
  };
  talent_pool_size: number;
  recent_activity: Array<{
    action: string;
    created_at: string;
    details: Record<string, unknown> | null;
    actor_name: string | null;
  }>;
}

export function agencyDashboard(): Promise<AgencyDashboard> {
  return api('/dashboard/agency');
}
