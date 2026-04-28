/**
 * Frontend client for /api/dance/teams og /api/dance/invites.
 *
 * Capability-katalogen er duplisert fra backend/server/dance-team-service.ts.
 * Hold dem i sync når nye keys legges til. Ukjente keys ignoreres av begge sider.
 */

const TEAMS_BASE = '/api/dance/teams';
const INVITES_BASE = '/api/dance/invites';

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

// ─── Capability-katalog (mirror av backend) ─────────────────────────────

export const CAPABILITY_GROUPS = {
  team: [
    'team.invite_members',
    'team.manage_roles',
    'team.remove_members',
  ],
  billing: [
    'billing.view',
    'billing.manage',
  ],
  classes: [
    'class.view_schedule',
    'class.manage_schedule',
    'class.manage_roster',
  ],
  choreography: [
    'choreography.view',
    'choreography.create',
    'choreography.edit_own',
    'choreography.edit_all',
    'formation.use',
    'count_grid.use',
  ],
  insights: [
    'video_review.view',
    'video_review.annotate',
    'rehearsal.view_all',
    'rehearsal.manage',
    'dancer_profile.view_team',
    'injury_log.view_all',
    'analytics.view',
  ],
} as const;

export const CAPABILITY_GROUP_LABELS: Record<keyof typeof CAPABILITY_GROUPS, string> = {
  team: 'Team',
  billing: 'Fakturering',
  classes: 'Klasser',
  choreography: 'Koreografi',
  insights: 'Innsikt',
};

export const CAPABILITY_LABELS: Record<string, string> = {
  'team.invite_members':       'Invitere nye medlemmer',
  'team.manage_roles':         'Opprette og endre roller',
  'team.remove_members':       'Fjerne medlemmer',
  'billing.view':              'Se fakturaer + abonnement',
  'billing.manage':            'Endre plan + betalingsmetode',
  'class.view_schedule':       'Se klasse-timeplan',
  'class.manage_schedule':     'Opprette og endre klasser',
  'class.manage_roster':       'Legge til / fjerne elever',
  'choreography.view':         'Se koreografier',
  'choreography.create':       'Opprette nye stykker',
  'choreography.edit_own':     'Redigere egne stykker',
  'choreography.edit_all':     'Redigere alle stykker',
  'formation.use':             'Bruke Formation Builder',
  'count_grid.use':            'Bruke Count Grid',
  'video_review.view':         'Se video-review-rom',
  'video_review.annotate':     'Lage video-annoteringer',
  'rehearsal.view_all':        'Se hele øvingsplanen',
  'rehearsal.manage':          'Planlegge øvinger',
  'dancer_profile.view_team':  'Se hele teamets danser-profiler',
  'injury_log.view_all':       'Se HMS / skadelogg',
  'analytics.view':            'Se studio-statistikk',
};

export const ALL_CAPABILITY_KEYS: readonly string[] = Object.values(CAPABILITY_GROUPS).flat();

// ─── Types ──────────────────────────────────────────────────────────────

export interface DanceTeamRole {
  id: string;
  teamOrganizationId: string;
  label: string;
  capabilities: Record<string, boolean>;
  isOwnerRole: boolean;
  isDefaultForInvite: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface DanceTeamMember {
  memberRowId: string;
  teamOrganizationId: string;
  userId: string | null;
  email: string;
  status: 'active' | 'pending' | 'deactivated';
  enterpriseRole: string;
  danceRoleId: string | null;
  danceRoleLabel: string | null;
  invitedAt: string;
  joinedAt: string | null;
}

export interface DanceTeamInvite {
  token: string;
  teamOrganizationId: string;
  invitedEmail: string;
  invitedRoleId: string;
  invitedRoleLabel: string | null;
  invitedByUserId: string;
  expiresAt: string;
  acceptedAt: string | null;
  acceptedUserId: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface DanceTeamSummary {
  teamOrganizationId: string;
  ownerUserId: string;
  memberCount: number;
  activeMemberCount: number;
  seatLimit: number | null;
  seatRemaining: number | null;
  defaultInviteRoleId: string | null;
}

export interface MyMembership {
  team: DanceTeamSummary;
  member: DanceTeamMember | null;
  role: DanceTeamRole | null;
}

// ─── API ────────────────────────────────────────────────────────────────

export async function getMyMembership(): Promise<MyMembership | null> {
  const res = await fetch(`${TEAMS_BASE}/me`, { headers: authHeaders() });
  const wrapped = await readJson<{ success: boolean; data: MyMembership | null }>(res);
  return wrapped.data;
}

export async function getMyCapabilities(): Promise<string[]> {
  const res = await fetch(`${TEAMS_BASE}/me/capabilities`, { headers: authHeaders() });
  const w = await readJson<{ success: boolean; data: { capabilities: string[] } }>(res);
  return w.data.capabilities;
}

export async function ensureMyTeam(): Promise<DanceTeamSummary> {
  const res = await fetch(`${TEAMS_BASE}/`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({}),
  });
  const w = await readJson<{ success: boolean; data: DanceTeamSummary }>(res);
  return w.data;
}

// ── roles ──
export async function listRoles(teamOrgId: string): Promise<DanceTeamRole[]> {
  const res = await fetch(`${TEAMS_BASE}/${encodeURIComponent(teamOrgId)}/roles`, { headers: authHeaders() });
  const w = await readJson<{ success: boolean; data: DanceTeamRole[] }>(res);
  return w.data;
}

export async function createRole(
  teamOrgId: string,
  input: { label: string; capabilities: Record<string, boolean>; isDefaultForInvite?: boolean; displayOrder?: number },
): Promise<DanceTeamRole> {
  const res = await fetch(`${TEAMS_BASE}/${encodeURIComponent(teamOrgId)}/roles`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  const w = await readJson<{ success: boolean; data: DanceTeamRole }>(res);
  return w.data;
}

export async function updateRole(
  teamOrgId: string,
  roleId: string,
  patch: { label?: string; capabilities?: Record<string, boolean>; isDefaultForInvite?: boolean; displayOrder?: number },
): Promise<DanceTeamRole> {
  const res = await fetch(`${TEAMS_BASE}/${encodeURIComponent(teamOrgId)}/roles/${encodeURIComponent(roleId)}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(patch),
  });
  const w = await readJson<{ success: boolean; data: DanceTeamRole }>(res);
  return w.data;
}

export async function deleteRole(teamOrgId: string, roleId: string): Promise<void> {
  const res = await fetch(`${TEAMS_BASE}/${encodeURIComponent(teamOrgId)}/roles/${encodeURIComponent(roleId)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  await readJson<{ success: boolean }>(res);
}

// ── members ──
export async function listMembers(teamOrgId: string): Promise<DanceTeamMember[]> {
  const res = await fetch(`${TEAMS_BASE}/${encodeURIComponent(teamOrgId)}/members`, { headers: authHeaders() });
  const w = await readJson<{ success: boolean; data: DanceTeamMember[] }>(res);
  return w.data;
}

export async function updateMemberRole(
  teamOrgId: string,
  memberRowId: string,
  danceRoleId: string,
): Promise<DanceTeamMember> {
  const res = await fetch(`${TEAMS_BASE}/${encodeURIComponent(teamOrgId)}/members/${encodeURIComponent(memberRowId)}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ danceRoleId }),
  });
  const w = await readJson<{ success: boolean; data: DanceTeamMember }>(res);
  return w.data;
}

export async function removeMember(teamOrgId: string, memberRowId: string): Promise<void> {
  const res = await fetch(`${TEAMS_BASE}/${encodeURIComponent(teamOrgId)}/members/${encodeURIComponent(memberRowId)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  await readJson<{ success: boolean }>(res);
}

// ── invites ──
export async function listInvites(teamOrgId: string): Promise<DanceTeamInvite[]> {
  const res = await fetch(`${TEAMS_BASE}/${encodeURIComponent(teamOrgId)}/invites`, { headers: authHeaders() });
  const w = await readJson<{ success: boolean; data: DanceTeamInvite[] }>(res);
  return w.data;
}

export async function createInvite(
  teamOrgId: string,
  input: { invitedEmail: string; invitedRoleId: string; expiresAt?: string },
): Promise<{ invite: DanceTeamInvite; seatRemaining: number | null }> {
  const res = await fetch(`${TEAMS_BASE}/${encodeURIComponent(teamOrgId)}/invites`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  const w = await readJson<{ success: boolean; data: { invite: DanceTeamInvite; seatRemaining: number | null } }>(res);
  return w.data;
}

export async function revokeInvite(teamOrgId: string, token: string): Promise<void> {
  const res = await fetch(`${TEAMS_BASE}/${encodeURIComponent(teamOrgId)}/invites/${encodeURIComponent(token)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  await readJson<{ success: boolean }>(res);
}

// ── invite-accept (innlogget bruker) ──
export async function getInviteByToken(token: string): Promise<DanceTeamInvite> {
  const res = await fetch(`${INVITES_BASE}/${encodeURIComponent(token)}`, { headers: authHeaders() });
  const w = await readJson<{ success: boolean; data: DanceTeamInvite }>(res);
  return w.data;
}

export async function acceptInvite(token: string): Promise<{ teamOrganizationId: string; danceRoleId: string }> {
  const res = await fetch(`${INVITES_BASE}/${encodeURIComponent(token)}/accept`, {
    method: 'POST',
    headers: authHeaders(),
  });
  const w = await readJson<{ success: boolean; data: { teamOrganizationId: string; danceRoleId: string } }>(res);
  return w.data;
}

// ═══════════════════════════════════════════════════════════════════════
//  Magic-link + PIN-flyt (PUBLIC — ingen auth, brukes av InviteLandingPage)
// ═══════════════════════════════════════════════════════════════════════

export interface InvitePublicInfo {
  token: string;
  invitedEmailMasked: string;
  invitedRoleLabel: string;
  teamOrganizationId: string;
  expiresAt: string;
  pinSentAt: string | null;
  pinLockedAt: string | null;
  status: 'pending' | 'accepted' | 'revoked' | 'expired' | 'pin_locked';
}

export interface AcceptWithPinResponse {
  sessionToken: string;
  user: {
    userId: string;
    email: string;
    name: string;
    role: string;
    loginAt: string;
  };
  teamOrganizationId: string;
  danceRoleId: string;
}

async function readJsonOrError<T>(res: Response): Promise<T> {
  // Skiller seg fra readJson — returnerer body også på 4xx/5xx så caller
  // kan vise spesifikke error-meldinger ved PIN-feil osv.
  const body = await res.json().catch(() => ({} as Record<string, unknown>));
  if (!res.ok) {
    const err = (body as { error?: string }).error || `HTTP ${res.status}`;
    const e = new Error(err) as Error & { status: number; payload: unknown };
    e.status = res.status;
    e.payload = body;
    throw e;
  }
  return body as T;
}

export async function getInvitePublicInfo(token: string): Promise<InvitePublicInfo> {
  const res = await fetch(`${INVITES_BASE}/${encodeURIComponent(token)}/info`);
  const w = await readJsonOrError<{ success: boolean; data: InvitePublicInfo }>(res);
  return w.data;
}

export async function requestPinForInvite(token: string): Promise<void> {
  const res = await fetch(`${INVITES_BASE}/${encodeURIComponent(token)}/request-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  await readJsonOrError<{ success: boolean }>(res);
}

export async function acceptInviteWithPin(
  token: string,
  pin: string,
  fullName: string,
): Promise<AcceptWithPinResponse> {
  const res = await fetch(`${INVITES_BASE}/${encodeURIComponent(token)}/accept-with-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin, fullName }),
  });
  const w = await readJsonOrError<{ success: boolean; data: AcceptWithPinResponse }>(res);
  return w.data;
}
