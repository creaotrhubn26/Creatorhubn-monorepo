/**
 * roleRoomTalentsService.ts
 *
 * Frontend-service for B2B2Talent — talent egen-profil + samtykke-registry.
 * Backend-routes: /api/role-room/talents/me + /me/consents (migrasjon 209+210).
 */

export interface RoleRoomTalent {
  id: string;
  owner_user_id: string | null;
  display_name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  bio: string | null;
  agency_name: string | null;
  agency_contact: string | null;
  represented: boolean;
  headshot_url: string | null;
  headshot_alt_urls: string[];
  showreel_url: string | null;
  showreel_updated_at: string | null;
  resume_url: string | null;
  resume_updated_at: string | null;
  age_range: string | null;
  playing_age_min: number | null;
  playing_age_max: number | null;
  gender: string | null;
  ethnicity: string | null;
  height_cm: number | null;
  hair_color: string | null;
  eye_color: string | null;
  skills: Array<{ id: string; label: string }>;
  languages: Array<{ code: string; label: string; level?: string }>;
  dialects: string[];
  availability_status: 'open' | 'limited' | 'unavailable';
  availability_notes: string | null;
  willing_to_travel: boolean;
  external_links: Array<{ label: string; url: string }>;
  profile_status: 'draft' | 'active' | 'pending_review' | 'archived';
  badges: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type RoleRoomTalentPartnerType =
  | 'stella_casting'
  | 'skuespillersenter'
  | 'production_company'
  | 'caster_individual'
  | 'workshop_provider';

export type RoleRoomTalentConsentScope =
  | 'basic_profile'
  | 'media_portfolio'
  | 'contact_info'
  | 'demographics'
  | 'availability'
  | 'audition_invitations'
  | 'self_tape_review'
  | 'full_profile';

export interface RoleRoomTalentConsent {
  id: string;
  talent_id: string;
  partner_type: RoleRoomTalentPartnerType;
  partner_ref: string;
  partner_display_name: string | null;
  scope: RoleRoomTalentConsentScope;
  status: 'granted' | 'revoked' | 'expired';
  granted_at: string;
  granted_by: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  expires_at: string | null;
  notes: string | null;
  request_context: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface RoleRoomAgencyOrg {
  id: string;
  type: RoleRoomTalentPartnerType;
  name: string;
  slug: string;
  contact_email: string | null;
  website_url: string | null;
  about: string | null;
  logo_url: string | null;
  verified: boolean;
  verified_at?: string | null;
  status?: 'active' | 'archived';
}

export interface RoleRoomTalentAccessAuditRow {
  partner_type: RoleRoomTalentPartnerType;
  partner_ref: string;
  partner_name: string | null;
  day: string;
  access_count: number;
  last_accessed: string;
  scopes_seen: string[];
}

export interface RoleRoomMaskedTalent extends Partial<RoleRoomTalent> {
  id: string;
  display_name: string;
  granted_scopes: RoleRoomTalentConsentScope[];
}

const BASE = '/api/role-room/talents';
const AGENCY_BASE = '/api/role-room';

async function authFetch(path: string, init?: RequestInit) {
  return fetch(path, { ...init, credentials: 'include' });
}

const roleRoomTalentsService = {
  async fetchMyTalent(): Promise<RoleRoomTalent | null> {
    const r = await authFetch(`${BASE}/me`);
    if (!r.ok) return null;
    const payload = await r.json().catch(() => null);
    return (payload?.talent as RoleRoomTalent | null) ?? null;
  },

  async createMyTalent(initial: Partial<RoleRoomTalent>): Promise<RoleRoomTalent | { error: string }> {
    const r = await authFetch(`${BASE}/me`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(initial),
    });
    const payload = await r.json().catch(() => null);
    if (!r.ok) return { error: payload?.error || 'Kunne ikke opprette profil' };
    return payload.talent as RoleRoomTalent;
  },

  async updateMyTalent(patch: Partial<RoleRoomTalent>): Promise<RoleRoomTalent | { error: string }> {
    const r = await authFetch(`${BASE}/me`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const payload = await r.json().catch(() => null);
    if (!r.ok) return { error: payload?.error || 'Kunne ikke oppdatere profil' };
    return payload.talent as RoleRoomTalent;
  },

  async fetchMyConsents(): Promise<RoleRoomTalentConsent[]> {
    const r = await authFetch(`${BASE}/me/consents`);
    if (!r.ok) return [];
    const payload = await r.json().catch(() => null);
    return Array.isArray(payload?.consents) ? payload.consents : [];
  },

  async grantConsent(input: {
    partner_type: RoleRoomTalentPartnerType;
    partner_ref: string;
    partner_display_name?: string;
    scope: RoleRoomTalentConsentScope;
    expires_at?: string;
    notes?: string;
  }): Promise<RoleRoomTalentConsent | { error: string }> {
    const r = await authFetch(`${BASE}/me/consents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const payload = await r.json().catch(() => null);
    if (!r.ok) return { error: payload?.error || 'Kunne ikke lagre samtykke' };
    return payload.consent as RoleRoomTalentConsent;
  },

  async revokeConsent(consentId: string): Promise<{ ok: boolean; error?: string }> {
    const r = await authFetch(`${BASE}/me/consents/${encodeURIComponent(consentId)}`, {
      method: 'DELETE',
    });
    if (!r.ok) {
      const payload = await r.json().catch(() => null);
      return { ok: false, error: payload?.error || 'Kunne ikke trekke samtykke' };
    }
    return { ok: true };
  },

  async fetchMyAccessAudit(): Promise<RoleRoomTalentAccessAuditRow[]> {
    const r = await authFetch(`${BASE}/me/access-audit`);
    if (!r.ok) return [];
    const payload = await r.json().catch(() => null);
    return Array.isArray(payload?.audit) ? payload.audit : [];
  },

  async fetchAgencies(filters?: { q?: string; type?: RoleRoomTalentPartnerType }): Promise<RoleRoomAgencyOrg[]> {
    const params = new URLSearchParams();
    if (filters?.q) params.set('q', filters.q);
    if (filters?.type) params.set('type', filters.type);
    const url = params.toString() ? `${AGENCY_BASE}/agencies?${params.toString()}` : `${AGENCY_BASE}/agencies`;
    const r = await authFetch(url);
    if (!r.ok) return [];
    const payload = await r.json().catch(() => null);
    return Array.isArray(payload?.agencies) ? payload.agencies : [];
  },

  async fetchMyAgency(): Promise<{ agency: RoleRoomAgencyOrg | null; agencyRole: 'admin' | 'member' | null }> {
    const r = await authFetch(`${AGENCY_BASE}/agency/me`);
    if (!r.ok) return { agency: null, agencyRole: null };
    const payload = await r.json().catch(() => null);
    return {
      agency: payload?.agency ?? null,
      agencyRole: payload?.agencyRole ?? null,
    };
  },

  async updateMyAgency(patch: Partial<RoleRoomAgencyOrg>): Promise<RoleRoomAgencyOrg | { error: string }> {
    const r = await authFetch(`${AGENCY_BASE}/agency/me`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const payload = await r.json().catch(() => null);
    if (!r.ok) return { error: payload?.error || 'Kunne ikke oppdatere agency' };
    return payload.agency as RoleRoomAgencyOrg;
  },

  async fetchAgencyTalents(): Promise<{ talents: RoleRoomMaskedTalent[]; agency: { id: string; type: string } | null }> {
    const r = await authFetch(`${AGENCY_BASE}/agency/talents`);
    if (!r.ok) return { talents: [], agency: null };
    const payload = await r.json().catch(() => null);
    return {
      talents: Array.isArray(payload?.talents) ? payload.talents : [],
      agency: payload?.agency ?? null,
    };
  },

  async fetchAgencyTalent(talentId: string): Promise<RoleRoomMaskedTalent | { error: string }> {
    const r = await authFetch(`${AGENCY_BASE}/agency/talents/${encodeURIComponent(talentId)}`);
    const payload = await r.json().catch(() => null);
    if (!r.ok) return { error: payload?.error || 'Kunne ikke hente talent' };
    return payload.talent as RoleRoomMaskedTalent;
  },
};

export default roleRoomTalentsService;
