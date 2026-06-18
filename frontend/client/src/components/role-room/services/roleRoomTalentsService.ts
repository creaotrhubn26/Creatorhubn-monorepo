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

  // ── Phase 7: Talent Registry (agency-search) ──────────────────────
  async searchTalents(
    filters: TalentSearchFilters,
    opts?: { agencyType?: string; agencyId?: string; demo?: boolean },
  ): Promise<TalentSearchResult> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v == null || v === '') return;
      if (Array.isArray(v)) {
        if (v.length > 0) params.set(k, v.join(','));
      } else if (typeof v === 'boolean') {
        if (v) params.set(k, '1');
      } else {
        params.set(k, String(v));
      }
    });
    if (opts?.agencyType && opts?.agencyId) {
      params.set('agency_type', opts.agencyType);
      params.set('agency_id', opts.agencyId);
    }
    if (opts?.demo) params.set('demo', '1');
    const r = await authFetch(`${AGENCY_BASE}/agency/talents/search?${params.toString()}`);
    if (!r.ok) return { agency: null, filters, total: 0, talents: [] };
    return await r.json();
  },

  async fetchRegistryOverview(
    opts?: { agencyType?: string; agencyId?: string; demo?: boolean },
  ): Promise<RegistryOverview> {
    const params = new URLSearchParams();
    if (opts?.agencyType && opts?.agencyId) {
      params.set('agency_type', opts.agencyType);
      params.set('agency_id', opts.agencyId);
    }
    if (opts?.demo) params.set('demo', '1');
    const qs = params.toString();
    const r = await authFetch(`${AGENCY_BASE}/agency/registry-overview${qs ? `?${qs}` : ''}`);
    if (!r.ok) return { agency: null, total_visible: 0, new_30d: 0, available_now: 0 };
    return await r.json();
  },

  async fetchSavedSearches(): Promise<SavedSearch[]> {
    const r = await authFetch(`${AGENCY_BASE}/agency/saved-searches`);
    if (!r.ok) return [];
    const payload = await r.json().catch(() => null);
    return Array.isArray(payload?.searches) ? payload.searches : [];
  },

  async createSavedSearch(input: {
    name: string;
    filters: TalentSearchFilters;
    shared?: boolean;
    estimated_count?: number;
  }): Promise<SavedSearch | { error: string }> {
    const r = await authFetch(`${AGENCY_BASE}/agency/saved-searches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const payload = await r.json().catch(() => null);
    if (!r.ok) return { error: payload?.error || 'Kunne ikke lagre' };
    return payload.search as SavedSearch;
  },

  // ── Phase 7.5 reverse-consent proposals ─────────────────────────
  async proposeNewTalent(input: {
    proposed_email: string;
    proposed_display_name?: string;
    proposed_phone?: string;
    requested_scopes?: RoleRoomTalentConsentScope[];
    personal_message?: string;
    context_role?: string;
  }): Promise<TalentProposal | { error: string; existing?: TalentProposal }> {
    const r = await authFetch(`${AGENCY_BASE}/agency/talent-proposals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const payload = await r.json().catch(() => null);
    if (!r.ok) {
      return {
        error: payload?.error || 'Kunne ikke sende forslag',
        existing: payload?.existing,
      };
    }
    return payload.proposal as TalentProposal;
  },

  async fetchAgencyProposals(): Promise<TalentProposal[]> {
    const r = await authFetch(`${AGENCY_BASE}/agency/talent-proposals`);
    if (!r.ok) return [];
    const payload = await r.json().catch(() => null);
    return Array.isArray(payload?.proposals) ? payload.proposals : [];
  },

  async cancelAgencyProposal(id: string): Promise<{ ok: boolean; error?: string }> {
    const r = await authFetch(`${AGENCY_BASE}/agency/talent-proposals/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!r.ok) {
      const payload = await r.json().catch(() => null);
      return { ok: false, error: payload?.error || 'Kunne ikke avbryte' };
    }
    return { ok: true };
  },

  async lookupTalentProposal(token: string): Promise<{ proposal: TalentProposalDetail; expired: boolean } | { error: string }> {
    const r = await fetch(`${AGENCY_BASE}/talent-proposals/${encodeURIComponent(token)}`);
    const payload = await r.json().catch(() => null);
    if (!r.ok) return { error: payload?.error || 'Ikke funnet' };
    return payload;
  },

  async acceptTalentProposal(token: string): Promise<{ ok: boolean; talentId?: string; scopesGranted?: string[]; error?: string }> {
    const r = await authFetch(`${AGENCY_BASE}/talent-proposals/${encodeURIComponent(token)}/accept`, {
      method: 'POST',
    });
    const payload = await r.json().catch(() => null);
    if (!r.ok) return { ok: false, error: payload?.error || 'Kunne ikke akseptere' };
    return { ok: true, talentId: payload.talentId, scopesGranted: payload.scopesGranted };
  },

  async declineTalentProposal(token: string): Promise<{ ok: boolean; error?: string }> {
    const r = await fetch(`${AGENCY_BASE}/talent-proposals/${encodeURIComponent(token)}/decline`, {
      method: 'POST',
    });
    if (!r.ok) {
      const payload = await r.json().catch(() => null);
      return { ok: false, error: payload?.error || 'Kunne ikke avslå' };
    }
    return { ok: true };
  },

  async deleteSavedSearch(id: string): Promise<{ ok: boolean; error?: string }> {
    const r = await authFetch(`${AGENCY_BASE}/agency/saved-searches/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!r.ok) {
      const payload = await r.json().catch(() => null);
      return { ok: false, error: payload?.error || 'Kunne ikke slette' };
    }
    return { ok: true };
  },

  // ── Phase 2 e2e ──────────────────────────────────────────────────
  async fetchPartnersOverview(opts?: { demo?: boolean }): Promise<PartnersOverview> {
    const qs = opts?.demo ? '?demo=1' : '';
    const r = await authFetch(`${BASE}/me/partners-overview${qs}`);
    if (!r.ok) {
      return {
        talent: null,
        stats: { activePartners: 0, sharedTalentPools: 0, pendingRequests: 0, gdprCompliantPercent: 100 },
        partners: [],
        feed: [],
      };
    }
    const payload = await r.json().catch(() => null);
    return payload as PartnersOverview;
  },

  async fetchUploadConfig(): Promise<UploadConfig> {
    const r = await authFetch(`${BASE}/me/uploads/config`);
    if (!r.ok) return { enabled: false, maxBytes: {}, allowedTypes: {} };
    const payload = await r.json().catch(() => null);
    return payload as UploadConfig;
  },

  /**
   * Stream-upload: ber Cloudflare Stream om en one-shot upload-URL,
   * laster opp filen som multipart/form-data direkte til Stream.
   * Returnerer finalUrl (iframe-embed) ved suksess.
   */
  async uploadShowreelToStream(
    file: File,
    onProgress?: (pct: number) => void,
  ): Promise<{ ok: true; result: StreamUploadSignResult } | { ok: false; error: string }> {
    const signRes = await authFetch(`${BASE}/me/uploads/sign-stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const signed = await signRes.json().catch(() => null) as StreamUploadSignResult | { error: string };
    if (!signRes.ok || !signed || 'error' in signed) {
      return { ok: false, error: (signed as { error?: string })?.error || 'Kunne ikke initiere Stream-upload' };
    }

    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', signed.uploadUrl);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({ ok: true, result: signed });
        } else {
          resolve({ ok: false, error: `Stream-upload feilet (HTTP ${xhr.status})` });
        }
      };
      xhr.onerror = () => resolve({ ok: false, error: 'Nettverksfeil ved Stream-upload' });
      const form = new FormData();
      form.append('file', file, file.name);
      xhr.send(form);
    });
  },

  /** Signerer en presigned PUT-URL for direkte R2-opplastning. */
  async signUpload(input: {
    kind: 'headshot' | 'showreel' | 'resume' | 'alt_photo';
    contentType: string;
    size_bytes: number;
    filename: string;
  }): Promise<UploadSignResult | { error: string }> {
    const r = await authFetch(`${BASE}/me/uploads/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const payload = await r.json().catch(() => null);
    if (!r.ok) return { error: payload?.error || 'Kunne ikke generere upload-URL' };
    return payload as UploadSignResult;
  },

  /**
   * Streamer en File direkte til R2 via presigned PUT-URL.
   * Bruker XMLHttpRequest for progress-event (fetch har ingen upload-progress).
   * Returnerer finalUrl ved suksess.
   */
  async uploadFileToR2(
    file: File,
    kind: 'headshot' | 'showreel' | 'resume' | 'alt_photo',
    onProgress?: (pct: number) => void,
  ): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
    const signed = await this.signUpload({
      kind,
      contentType: file.type,
      size_bytes: file.size,
      filename: file.name,
    });
    if ('error' in signed) return { ok: false, error: signed.error };

    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', signed.uploadUrl);
      xhr.setRequestHeader('Content-Type', signed.contentType);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({ ok: true, url: signed.finalUrl });
        } else {
          resolve({ ok: false, error: `Opplasting feilet (HTTP ${xhr.status})` });
        }
      };
      xhr.onerror = () => resolve({ ok: false, error: 'Nettverksfeil ved opplasting' });
      xhr.send(file);
    });
  },

  async pausePartnerAccess(input: {
    partner_type: RoleRoomTalentPartnerType;
    partner_ref: string;
    days?: number;
  }): Promise<{ ok: boolean; paused_scopes?: string[]; days?: number; error?: string }> {
    const r = await authFetch(`${BASE}/me/consents/pause`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const payload = await r.json().catch(() => null);
    if (!r.ok) return { ok: false, error: payload?.error || 'Kunne ikke pause' };
    return { ok: true, paused_scopes: payload.paused_scopes, days: payload.days };
  },

  async bulkSetConsents(input: {
    partner_type: RoleRoomTalentPartnerType;
    partner_ref: string;
    partner_display_name?: string;
    perms: { profiles: boolean; selftapes: boolean; workshops: boolean; auditions: boolean };
  }): Promise<{ ok: true } | { error: string }> {
    const r = await authFetch(`${BASE}/me/consents/bulk-set`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const payload = await r.json().catch(() => null);
    if (!r.ok) return { error: payload?.error || 'Kunne ikke oppdatere tillatelser' };
    return { ok: true };
  },

  async createPartnerInvite(input: {
    partner_type: RoleRoomTalentPartnerType;
    partner_email: string;
    partner_display_name?: string;
    scopes?: RoleRoomTalentConsentScope[];
    message?: string;
  }): Promise<RoleRoomPartnerInvite | { error: string }> {
    const r = await authFetch(`${BASE}/me/partner-invites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const payload = await r.json().catch(() => null);
    if (!r.ok) return { error: payload?.error || 'Kunne ikke opprette invite' };
    return payload.invite as RoleRoomPartnerInvite;
  },

  async fetchPartnerInvites(): Promise<RoleRoomPartnerInvite[]> {
    const r = await authFetch(`${BASE}/me/partner-invites`);
    if (!r.ok) return [];
    const payload = await r.json().catch(() => null);
    return Array.isArray(payload?.invites) ? payload.invites : [];
  },

  async cancelPartnerInvite(id: string): Promise<{ ok: boolean; error?: string }> {
    const r = await authFetch(`${BASE}/me/partner-invites/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!r.ok) {
      const payload = await r.json().catch(() => null);
      return { ok: false, error: payload?.error || 'Kunne ikke avbryte invite' };
    }
    return { ok: true };
  },

  async lookupPartnerInvite(token: string): Promise<{ invite: PartnerInviteDetail; expired?: boolean } | { error: string }> {
    const r = await fetch(`${AGENCY_BASE}/partner-invites/${encodeURIComponent(token)}`);
    const payload = await r.json().catch(() => null);
    if (!r.ok) return { error: payload?.error || 'Invite ikke funnet' };
    return payload;
  },

  async acceptPartnerInvite(token: string): Promise<{ ok: boolean; agencyId?: string; error?: string }> {
    const r = await authFetch(`${AGENCY_BASE}/partner-invites/${encodeURIComponent(token)}/accept`, {
      method: 'POST',
    });
    const payload = await r.json().catch(() => null);
    if (!r.ok) return { ok: false, error: payload?.error || 'Kunne ikke akseptere invite' };
    return { ok: true, agencyId: payload.agencyId };
  },
};

// ── Phase 2 e2e types ────────────────────────────────────────────────

export interface PartnerOverviewRow {
  id: string;
  partner_type: RoleRoomTalentPartnerType;
  role_label: 'Casting Partner' | 'Professional Center';
  initials: string;
  display_name: string;
  location: string | null;
  email: string | null;
  website: string | null;
  logo: string | null;
  verified: boolean;
  scopes: RoleRoomTalentConsentScope[];
  access_level: 'full' | 'limited' | 'custom' | 'view_only';
  last_activity: string;
  perms: { profiles: boolean; selftapes: boolean; workshops: boolean; auditions: boolean };
}

export interface FeedEvent {
  kind: 'access' | 'invite' | 'consent_grant';
  id: string;
  partner_type: RoleRoomTalentPartnerType;
  partner_ref: string | null;
  display_name: string | null;
  details: Record<string, unknown>;
  occurred_at: string;
  badge: 'pending' | null;
}

export interface PartnersOverview {
  talent: { id: string; display_name: string } | null;
  stats: {
    activePartners: number;
    sharedTalentPools: number;
    pendingRequests: number;
    gdprCompliantPercent: number;
  };
  partners: PartnerOverviewRow[];
  feed: FeedEvent[];
}

export interface RoleRoomPartnerInvite {
  id: string;
  partner_type: RoleRoomTalentPartnerType;
  partner_email: string;
  partner_display_name: string | null;
  scopes: RoleRoomTalentConsentScope[];
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';
  message: string | null;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  token: string;
  acceptUrl?: string;
  maskedEmail?: string;
}

export interface TalentSearchFilters {
  q?: string;
  location?: string;
  gender?: string;
  age_min?: number;
  age_max?: number;
  languages?: string[];
  skills?: string[];
  dialects?: string[];
  availability?: string;
  has_selftape?: boolean;
  representation?: 'represented' | 'independent' | 'any';
  sort?: 'recent' | 'name' | 'available_first';
  limit?: number;
  offset?: number;
}

export interface TalentSearchHit {
  id: string;
  display_name: string;
  city: string | null;
  country: string | null;
  bio: string | null;
  represented: boolean;
  granted_scopes: RoleRoomTalentConsentScope[];
  skills: Array<{ id: string; label: string }>;
  languages: Array<{ code: string; label: string; level?: string }>;
  dialects: string[];
  // maskerte felter (kun hvis scope er gitt):
  headshot_url?: string | null;
  showreel_url?: string | null;
  has_showreel?: boolean;
  playing_age_min?: number | null;
  playing_age_max?: number | null;
  gender?: string | null;
  availability_status?: 'open' | 'limited' | 'unavailable';
  agency_name?: string | null;
}

export interface TalentSearchResult {
  agency: { id: string; name: string; type: string } | null;
  filters: TalentSearchFilters;
  total: number;
  talents: TalentSearchHit[];
}

export interface RegistryOverview {
  agency: { id: string; name: string } | null;
  total_visible: number;
  new_30d: number;
  available_now: number;
  /** 30-dagers daglig sparkline-data: nye consent-grants per dag. */
  sparkline?: Array<{ day: string; n: number }>;
}

export interface SavedSearch {
  id: string;
  name: string;
  filters: TalentSearchFilters;
  estimated_count: number | null;
  estimated_at: string | null;
  shared: boolean;
  created_at: string;
  updated_at: string;
  last_run_at: string | null;
  owner_user_id: string;
}

export interface TalentProposal {
  id: string;
  proposed_email: string;
  proposed_display_name: string | null;
  requested_scopes: RoleRoomTalentConsentScope[];
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';
  personal_message: string | null;
  context_role: string | null;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  declined_at: string | null;
  resolved_talent_id: string | null;
  token: string;
  acceptUrl?: string;
}

export interface TalentProposalDetail {
  id: string;
  proposed_email: string;
  proposed_display_name: string | null;
  requested_scopes: RoleRoomTalentConsentScope[];
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';
  personal_message: string | null;
  context_role: string | null;
  expires_at: string;
  agency_name: string;
  agency_type: RoleRoomTalentPartnerType;
  agency_about: string | null;
  agency_verified: boolean;
}

export interface UploadConfig {
  enabled: boolean;
  streamEnabled?: boolean;
  streamSubdomain?: string | null;
  maxBytes: Partial<Record<'headshot' | 'showreel' | 'resume' | 'alt_photo', number>>;
  allowedTypes: Partial<Record<'headshot' | 'showreel' | 'resume' | 'alt_photo', string[]>>;
}

export interface StreamUploadSignResult {
  uploadUrl: string;     // klient POST'er filen hit (multipart/form-data, field: 'file')
  uid: string;
  finalUrl: string;      // /iframe — lagres i talent.showreel_url
  hlsManifestUrl: string;
  dashManifestUrl: string;
  thumbnailUrl: string;
  previewMp4Url: string;
  expiresAt: string;
}

export interface UploadSignResult {
  uploadUrl: string;
  finalUrl: string;
  key: string;
  expiresIn: number;
  contentType: string;
  instructions?: string;
}

export interface PartnerInviteDetail {
  id: string;
  partner_type: RoleRoomTalentPartnerType;
  partner_email: string;
  partner_display_name: string | null;
  scopes: RoleRoomTalentConsentScope[];
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';
  message: string | null;
  expires_at: string;
  talent_name: string;
}

// Named export for samtidig bruk i `import { roleRoomTalentsService }`-syntaks
// (e.g. TalentProposalCard, AvailabilityCalendar). Vercel/Rollup følger ESM-
// regler strengt: named import krever named export.
export { roleRoomTalentsService };
export default roleRoomTalentsService;
