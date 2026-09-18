/**
 * Frontend client for /api/game/teams og /api/game/invites.
 *
 * Capability-katalogen er duplisert fra backend/server/game-team-service.ts.
 * Hold dem i sync når nye keys legges til. Ukjente keys ignoreres av begge sider.
 */

import { narrativeAuthHeaders } from '../narrative/narrativeAuthHeaders';

const TEAMS_BASE = '/api/game/teams';
const INVITES_BASE = '/api/game/invites';

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
    throw new Error(body.detail || body.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function authHeaders(): Record<string, string> {
  return narrativeAuthHeaders({ 'Content-Type': 'application/json' });
}

// ─── Capability-katalog (mirror av backend) ─────────────────────────────

export const CAPABILITY_GROUPS = {
  team: ['team.invite_members', 'team.manage_roles', 'team.remove_members'],
  billing: ['billing.view', 'billing.manage'],
  story: ['story.edit', 'scenes.edit', 'scenes.delete'],
  review: ['review.request', 'review.decide'],
  production: ['plan.edit', 'platform.edit', 'exports.use'],
} as const;

export const CAPABILITY_GROUP_LABELS: Record<keyof typeof CAPABILITY_GROUPS, string> = {
  team: 'Team',
  billing: 'Abonnement',
  story: 'Historie og scener',
  review: 'Review og godkjenning',
  production: 'Produksjon',
};

export const CAPABILITY_LABELS: Record<string, string> = {
  'team.invite_members': 'Invitere nye medlemmer',
  'team.manage_roles': 'Opprette og endre roller',
  'team.remove_members': 'Fjerne medlemmer',
  'billing.view': 'Se abonnement',
  'billing.manage': 'Endre plan og betaling',
  'story.edit': 'Redigere historie, karakterer, lokasjoner og brett',
  'scenes.edit': 'Redigere scenekort, replikker, gater og oppgaver',
  'scenes.delete': 'Slette scener',
  'review.request': 'Be om review',
  'review.decide': 'Godkjenne / be om endringer',
  'plan.edit': 'Redigere produksjonsplanen',
  'platform.edit': 'Redigere plattformmål',
  'exports.use': 'Eksportere og dele',
};

export const ALL_CAPABILITY_KEYS: readonly string[] = Object.values(CAPABILITY_GROUPS).flat();

// ─── Types ──────────────────────────────────────────────────────────────

export interface GameTeamRole {
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

export interface GameTeamMember {
  memberRowId: string;
  teamOrganizationId: string;
  userId: string | null;
  email: string;
  status: 'active' | 'pending' | 'deactivated';
  enterpriseRole: string;
  gameRoleId: string | null;
  gameRoleLabel: string | null;
  invitedAt: string;
  joinedAt: string | null;
}

export interface GameTeamInvite {
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

export interface GameTeamSummary {
  teamOrganizationId: string;
  ownerUserId: string;
  memberCount: number;
  activeMemberCount: number;
  seatLimit: number | null;
  seatRemaining: number | null;
  defaultInviteRoleId: string | null;
}

export interface MyMembership {
  team: GameTeamSummary;
  member: GameTeamMember | null;
  role: GameTeamRole | null;
}

export interface GameTeamMembershipDetail {
  team: GameTeamSummary;
  member: GameTeamMember;
  role: GameTeamRole | null;
  upgradeOfferSeenAt: string | null;
}

// ─── API ────────────────────────────────────────────────────────────────

export async function getMyMembership(): Promise<MyMembership | null> {
  const res = await fetch(`${TEAMS_BASE}/me`, { headers: authHeaders() });
  const wrapped = await readJson<{ success: boolean; data: MyMembership | null }>(res);
  return wrapped.data;
}

export async function listMyMemberships(): Promise<GameTeamMembershipDetail[]> {
  const res = await fetch(`${TEAMS_BASE}/me/all`, { headers: authHeaders() });
  const wrapped = await readJson<{ success: boolean; data: GameTeamMembershipDetail[] }>(res);
  return wrapped.data;
}

export async function dismissUpgradeOffer(memberRowId: string): Promise<void> {
  const res = await fetch(`${TEAMS_BASE}/me/memberships/${encodeURIComponent(memberRowId)}/dismiss-upgrade`, {
    method: 'POST',
    headers: authHeaders(),
  });
  await readJson<{ success: boolean }>(res);
}

export async function getMyCapabilities(): Promise<string[]> {
  const res = await fetch(`${TEAMS_BASE}/me/capabilities`, { headers: authHeaders() });
  const w = await readJson<{ success: boolean; data: { capabilities: string[] } }>(res);
  return w.data.capabilities;
}

export async function ensureMyTeam(): Promise<GameTeamSummary> {
  const res = await fetch(`${TEAMS_BASE}/`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({}),
  });
  const w = await readJson<{ success: boolean; data: GameTeamSummary }>(res);
  return w.data;
}

// ── roles ──
export async function listRoles(teamOrgId: string): Promise<GameTeamRole[]> {
  const res = await fetch(`${TEAMS_BASE}/${encodeURIComponent(teamOrgId)}/roles`, { headers: authHeaders() });
  const w = await readJson<{ success: boolean; data: GameTeamRole[] }>(res);
  return w.data;
}

export async function createRole(
  teamOrgId: string,
  input: { label: string; capabilities: Record<string, boolean>; isDefaultForInvite?: boolean; displayOrder?: number },
): Promise<GameTeamRole> {
  const res = await fetch(`${TEAMS_BASE}/${encodeURIComponent(teamOrgId)}/roles`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  const w = await readJson<{ success: boolean; data: GameTeamRole }>(res);
  return w.data;
}

export async function updateRole(
  teamOrgId: string,
  roleId: string,
  patch: { label?: string; capabilities?: Record<string, boolean>; isDefaultForInvite?: boolean; displayOrder?: number },
): Promise<GameTeamRole> {
  const res = await fetch(`${TEAMS_BASE}/${encodeURIComponent(teamOrgId)}/roles/${encodeURIComponent(roleId)}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(patch),
  });
  const w = await readJson<{ success: boolean; data: GameTeamRole }>(res);
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
export async function listMembers(teamOrgId: string): Promise<GameTeamMember[]> {
  const res = await fetch(`${TEAMS_BASE}/${encodeURIComponent(teamOrgId)}/members`, { headers: authHeaders() });
  const w = await readJson<{ success: boolean; data: GameTeamMember[] }>(res);
  return w.data;
}

export async function updateMemberRole(
  teamOrgId: string,
  memberRowId: string,
  gameRoleId: string,
): Promise<GameTeamMember> {
  const res = await fetch(`${TEAMS_BASE}/${encodeURIComponent(teamOrgId)}/members/${encodeURIComponent(memberRowId)}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ gameRoleId }),
  });
  const w = await readJson<{ success: boolean; data: GameTeamMember }>(res);
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
export async function listInvites(teamOrgId: string): Promise<GameTeamInvite[]> {
  const res = await fetch(`${TEAMS_BASE}/${encodeURIComponent(teamOrgId)}/invites`, { headers: authHeaders() });
  const w = await readJson<{ success: boolean; data: GameTeamInvite[] }>(res);
  return w.data;
}

export async function createInvite(
  teamOrgId: string,
  input: { invitedEmail: string; invitedRoleId: string; expiresAt?: string },
): Promise<{ invite: GameTeamInvite; seatRemaining: number | null }> {
  const res = await fetch(`${TEAMS_BASE}/${encodeURIComponent(teamOrgId)}/invites`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  const w = await readJson<{ success: boolean; data: { invite: GameTeamInvite; seatRemaining: number | null } }>(res);
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
export async function getInviteByToken(token: string): Promise<GameTeamInvite> {
  const res = await fetch(`${INVITES_BASE}/${encodeURIComponent(token)}`, { headers: authHeaders() });
  const w = await readJson<{ success: boolean; data: GameTeamInvite }>(res);
  return w.data;
}

export async function acceptInvite(token: string): Promise<{ teamOrganizationId: string; gameRoleId: string }> {
  const res = await fetch(`${INVITES_BASE}/${encodeURIComponent(token)}/accept`, {
    method: 'POST',
    headers: authHeaders(),
  });
  const w = await readJson<{ success: boolean; data: { teamOrganizationId: string; gameRoleId: string } }>(res);
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
  gameRoleId: string;
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
