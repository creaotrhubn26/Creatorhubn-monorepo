/**
 * Dance team service — custom-rolle-system for dans-vertikalens team-stack.
 *
 * Modell:
 *   • Studio-eier oppretter et team. Team-id = Studio-eierens user_id.
 *   • Custom roller (dance_team_role) defineres per studio med capability-sett.
 *   • Default 4 roller seedes når team først opprettes (Eier/Lærer/Koreograf/Danser).
 *   • Team-medlemmer er rader i enterprise_team_members med org_kind='dance_studio'
 *     og dance_role_id pekende på en custom rolle.
 *   • Invites går via dance_team_invite (separat fra dance_tester_invite).
 *
 * Capability-katalog er definert nederst i denne filen — mirror i
 * frontend/client/src/components/role-room/dance/danceTeamService.ts.
 */

import { randomBytes } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';

// ═══════════════════════════════════════════════════════════════════════
//  Capability-katalog
// ═══════════════════════════════════════════════════════════════════════
//
// Atomiske rettigheter Studio-eier kan toggle per rolle. Frontend speiler
// disse for UI; ukjente keys ignoreres av app-laget så vi kan utvide uten
// migration. Gruppert i "områder" for UX-skjerm.

export const CAPABILITIES = {
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

export const ALL_CAPABILITY_KEYS: ReadonlySet<string> = new Set(
  Object.values(CAPABILITIES).flat(),
);

export function isKnownCapability(key: string): boolean {
  return ALL_CAPABILITY_KEYS.has(key);
}

// ═══════════════════════════════════════════════════════════════════════
//  Default-rolle-templates (seedes ved team-opprettelse)
// ═══════════════════════════════════════════════════════════════════════

interface DefaultRoleTemplate {
  label: string;
  isOwnerRole: boolean;
  isDefaultForInvite: boolean;
  displayOrder: number;
  capabilities: Record<string, boolean>;
}

function capsOn(...keys: string[]): Record<string, boolean> {
  return Object.fromEntries(keys.map((k) => [k, true]));
}

const ALL_CAPS_TRUE: Record<string, boolean> = Object.fromEntries(
  Array.from(ALL_CAPABILITY_KEYS).map((k) => [k, true]),
);

export const DEFAULT_ROLE_TEMPLATES: readonly DefaultRoleTemplate[] = [
  {
    label: 'Eier',
    isOwnerRole: true,
    isDefaultForInvite: false,
    displayOrder: 0,
    capabilities: ALL_CAPS_TRUE,
  },
  {
    label: 'Lærer',
    isOwnerRole: false,
    isDefaultForInvite: true,
    displayOrder: 1,
    capabilities: capsOn(
      'class.view_schedule',
      'class.manage_schedule',
      'class.manage_roster',
      'choreography.view',
      'video_review.view',
      'video_review.annotate',
      'rehearsal.view_all',
      'rehearsal.manage',
      'dancer_profile.view_team',
    ),
  },
  {
    label: 'Koreograf',
    isOwnerRole: false,
    isDefaultForInvite: false,
    displayOrder: 2,
    capabilities: capsOn(
      'choreography.view',
      'choreography.create',
      'choreography.edit_own',
      'choreography.edit_all',
      'formation.use',
      'count_grid.use',
      'video_review.view',
      'video_review.annotate',
      'rehearsal.view_all',
      'rehearsal.manage',
      'dancer_profile.view_team',
    ),
  },
  {
    label: 'Danser',
    isOwnerRole: false,
    isDefaultForInvite: false,
    displayOrder: 3,
    capabilities: capsOn(
      'class.view_schedule',
      'choreography.view',
      'video_review.view',
    ),
  },
];

// ═══════════════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════════════

function isoTs(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}

function isoTsOrNull(value: unknown): string | null {
  if (value == null) return null;
  return isoTs(value);
}

function asJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === 'object') return value as T;
  if (typeof value === 'string') {
    try { return JSON.parse(value) as T; } catch { return fallback; }
  }
  return fallback;
}

function asBoolFlag(value: unknown): boolean {
  return value === true || value === 't' || value === 'true' || value === 1;
}

function generateInviteToken(): string {
  return randomBytes(24).toString('base64url');
}

function sanitizeCapabilities(input: unknown): Record<string, boolean> {
  const obj = (input && typeof input === 'object') ? (input as Record<string, unknown>) : {};
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!ALL_CAPABILITY_KEYS.has(k)) continue;       // drop unknown keys
    if (v === true) out[k] = true;
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════
//  Types (DTO-shape returnert til frontend)
// ═══════════════════════════════════════════════════════════════════════

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
  enterpriseRole: string;          // legacy 'admin'|'member'|'viewer'
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
  teamOrganizationId: string;       // = Studio-eierens user_id
  ownerUserId: string;
  memberCount: number;              // active + pending
  activeMemberCount: number;
  seatLimit: number | null;         // NULL = ubegrenset
  seatRemaining: number | null;     // NULL = ubegrenset
  defaultInviteRoleId: string | null;
}

// ═══════════════════════════════════════════════════════════════════════
//  Mappers
// ═══════════════════════════════════════════════════════════════════════

function mapRoleRow(row: Record<string, unknown>): DanceTeamRole {
  return {
    id: String(row.id),
    teamOrganizationId: String(row.team_organization_id),
    label: String(row.label),
    capabilities: asJson<Record<string, boolean>>(row.capabilities, {}),
    isOwnerRole: asBoolFlag(row.is_owner_role),
    isDefaultForInvite: asBoolFlag(row.is_default_for_invite),
    displayOrder: Number(row.display_order ?? 0),
    createdAt: isoTs(row.created_at),
    updatedAt: isoTs(row.updated_at),
  };
}

function mapMemberRow(row: Record<string, unknown>): DanceTeamMember {
  const status = String(row.status ?? 'pending') as DanceTeamMember['status'];
  return {
    memberRowId: String(row.id),
    teamOrganizationId: String(row.organization_id),
    userId: row.user_id ? String(row.user_id) : null,
    email: String(row.email ?? ''),
    status,
    enterpriseRole: String(row.role ?? 'member'),
    danceRoleId: row.dance_role_id ? String(row.dance_role_id) : null,
    danceRoleLabel: row.dance_role_label ? String(row.dance_role_label) : null,
    invitedAt: isoTs(row.invited_at),
    joinedAt: isoTsOrNull(row.joined_at),
  };
}

function mapInviteRow(row: Record<string, unknown>): DanceTeamInvite {
  return {
    token: String(row.token),
    teamOrganizationId: String(row.team_organization_id),
    invitedEmail: String(row.invited_email),
    invitedRoleId: String(row.invited_role_id),
    invitedRoleLabel: row.invited_role_label ? String(row.invited_role_label) : null,
    invitedByUserId: String(row.invited_by_user_id),
    expiresAt: isoTs(row.expires_at),
    acceptedAt: isoTsOrNull(row.accepted_at),
    acceptedUserId: row.accepted_user_id ? String(row.accepted_user_id) : null,
    revokedAt: isoTsOrNull(row.revoked_at),
    createdAt: isoTs(row.created_at),
  };
}

// ═══════════════════════════════════════════════════════════════════════
//  TEAM
// ═══════════════════════════════════════════════════════════════════════

/**
 * Idempotent: oppretter team + 4 default-roller første gang Studio-eier
 * lander i dans-flyten. Eier blir også registrert som medlem av eget team
 * (status='active', dance_role_id = Eier-rolle).
 */
export async function ensureTeamForOwner(
  pool: Pool,
  ownerUserId: string,
  ownerEmail: string,
): Promise<DanceTeamSummary> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Sjekk om Eier-rolle allerede finnes for dette teamet — det er sannheten
    // for "team eksisterer".
    const existing = await client.query(
      `SELECT id FROM dance_team_role
        WHERE team_organization_id = $1 AND is_owner_role = TRUE
        LIMIT 1`,
      [ownerUserId],
    );

    let ownerRoleId: string;
    if (existing.rowCount && existing.rowCount > 0) {
      ownerRoleId = String(existing.rows[0].id);
    } else {
      // Seed 4 default-roller.
      for (const tpl of DEFAULT_ROLE_TEMPLATES) {
        const inserted = await client.query(
          `INSERT INTO dance_team_role
             (team_organization_id, label, capabilities, is_owner_role, is_default_for_invite, display_order)
           VALUES ($1, $2, $3::jsonb, $4, $5, $6)
           ON CONFLICT (team_organization_id, label) DO NOTHING
           RETURNING id, is_owner_role`,
          [
            ownerUserId,
            tpl.label,
            JSON.stringify(tpl.capabilities),
            tpl.isOwnerRole,
            tpl.isDefaultForInvite,
            tpl.displayOrder,
          ],
        );
        if (inserted.rowCount && asBoolFlag(inserted.rows[0].is_owner_role)) {
          ownerRoleId = String(inserted.rows[0].id);
        }
      }
      // Edge case: race-tap. Fallback-lookup.
      if (!ownerRoleId!) {
        const r = await client.query(
          `SELECT id FROM dance_team_role
            WHERE team_organization_id = $1 AND is_owner_role = TRUE`,
          [ownerUserId],
        );
        ownerRoleId = String(r.rows[0].id);
      }
    }

    // Opprett eier-medlemskap hvis ikke eksisterer.
    await client.query(
      `INSERT INTO enterprise_team_members
         (organization_id, user_id, email, role, status, joined_at, org_kind, dance_role_id)
       VALUES ($1, $1, $2, 'admin', 'active', now(), 'dance_studio', $3)
       ON CONFLICT (organization_id, email)
       DO UPDATE SET
         org_kind = 'dance_studio',
         dance_role_id = COALESCE(enterprise_team_members.dance_role_id, EXCLUDED.dance_role_id),
         status = 'active',
         user_id = COALESCE(enterprise_team_members.user_id, EXCLUDED.user_id),
         joined_at = COALESCE(enterprise_team_members.joined_at, EXCLUDED.joined_at)`,
      [ownerUserId, ownerEmail, ownerRoleId],
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return getTeamSummary(pool, ownerUserId);
}

export async function getTeamSummary(
  pool: Pool,
  teamOrgId: string,
): Promise<DanceTeamSummary> {
  const counts = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status IN ('active','pending')) AS member_count,
       COUNT(*) FILTER (WHERE status = 'active') AS active_count
     FROM enterprise_team_members
     WHERE org_kind = 'dance_studio' AND organization_id = $1`,
    [teamOrgId],
  );

  const def = await pool.query(
    `SELECT id FROM dance_team_role
      WHERE team_organization_id = $1 AND is_default_for_invite = TRUE
      ORDER BY display_order LIMIT 1`,
    [teamOrgId],
  );

  const seatLimit = await getMaxTeamSeats(pool, teamOrgId);
  const memberCount = Number(counts.rows[0]?.member_count ?? 0);
  const activeCount = Number(counts.rows[0]?.active_count ?? 0);

  return {
    teamOrganizationId: teamOrgId,
    ownerUserId: teamOrgId,
    memberCount,
    activeMemberCount: activeCount,
    seatLimit,
    seatRemaining: seatLimit == null ? null : Math.max(0, seatLimit - memberCount),
    defaultInviteRoleId: def.rows[0]?.id ? String(def.rows[0].id) : null,
  };
}

/** Returnerer team-membership for en user, hvilket som helst team de er i. */
export async function getMembershipForUser(
  pool: Pool,
  userId: string,
): Promise<{ team: DanceTeamSummary; member: DanceTeamMember; role: DanceTeamRole | null } | null> {
  const r = await pool.query(
    `SELECT
       m.id, m.organization_id, m.user_id, m.email, m.status, m.role,
       m.dance_role_id, m.invited_at, m.joined_at,
       r.label AS dance_role_label
     FROM enterprise_team_members m
     LEFT JOIN dance_team_role r ON r.id = m.dance_role_id
     WHERE m.org_kind = 'dance_studio'
       AND m.user_id = $1
       AND m.status IN ('active','pending')
     ORDER BY m.joined_at DESC NULLS LAST, m.invited_at DESC
     LIMIT 1`,
    [userId],
  );
  if (!r.rowCount) return null;
  const member = mapMemberRow(r.rows[0]);
  const team = await getTeamSummary(pool, member.teamOrganizationId);
  let role: DanceTeamRole | null = null;
  if (member.danceRoleId) {
    const rr = await pool.query(
      `SELECT * FROM dance_team_role WHERE id = $1`,
      [member.danceRoleId],
    );
    if (rr.rowCount) role = mapRoleRow(rr.rows[0]);
  }
  return { team, member, role };
}

// ═══════════════════════════════════════════════════════════════════════
//  ROLES
// ═══════════════════════════════════════════════════════════════════════

export async function listRoles(pool: Pool, teamOrgId: string): Promise<DanceTeamRole[]> {
  const r = await pool.query(
    `SELECT * FROM dance_team_role
      WHERE team_organization_id = $1
      ORDER BY display_order, label`,
    [teamOrgId],
  );
  return r.rows.map(mapRoleRow);
}

export async function getRole(pool: Pool, roleId: string): Promise<DanceTeamRole | null> {
  const r = await pool.query(`SELECT * FROM dance_team_role WHERE id = $1`, [roleId]);
  return r.rowCount ? mapRoleRow(r.rows[0]) : null;
}

export async function createRole(
  pool: Pool,
  teamOrgId: string,
  input: { label: string; capabilities: Record<string, boolean>; isDefaultForInvite?: boolean; displayOrder?: number },
): Promise<DanceTeamRole> {
  const caps = sanitizeCapabilities(input.capabilities);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (input.isDefaultForInvite) {
      await client.query(
        `UPDATE dance_team_role SET is_default_for_invite = FALSE
          WHERE team_organization_id = $1 AND is_default_for_invite = TRUE`,
        [teamOrgId],
      );
    }
    const r = await client.query(
      `INSERT INTO dance_team_role
         (team_organization_id, label, capabilities, is_owner_role, is_default_for_invite, display_order)
       VALUES ($1, $2, $3::jsonb, FALSE, $4, $5)
       RETURNING *`,
      [
        teamOrgId,
        input.label,
        JSON.stringify(caps),
        input.isDefaultForInvite === true,
        input.displayOrder ?? 99,
      ],
    );
    await client.query('COMMIT');
    return mapRoleRow(r.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function updateRole(
  pool: Pool,
  roleId: string,
  patch: { label?: string; capabilities?: Record<string, boolean>; isDefaultForInvite?: boolean; displayOrder?: number },
): Promise<DanceTeamRole | null> {
  const existing = await getRole(pool, roleId);
  if (!existing) return null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (patch.isDefaultForInvite === true) {
      await client.query(
        `UPDATE dance_team_role SET is_default_for_invite = FALSE
          WHERE team_organization_id = $1 AND id <> $2 AND is_default_for_invite = TRUE`,
        [existing.teamOrganizationId, roleId],
      );
    }

    const fields: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (patch.label !== undefined) {
      fields.push(`label = $${i++}`); vals.push(patch.label);
    }
    if (patch.capabilities !== undefined) {
      // Eier-rollen har alltid alle capabilities — ignorer endring der.
      const caps = existing.isOwnerRole
        ? ALL_CAPS_TRUE
        : sanitizeCapabilities(patch.capabilities);
      fields.push(`capabilities = $${i++}::jsonb`);
      vals.push(JSON.stringify(caps));
    }
    if (patch.isDefaultForInvite !== undefined) {
      fields.push(`is_default_for_invite = $${i++}`); vals.push(patch.isDefaultForInvite);
    }
    if (patch.displayOrder !== undefined) {
      fields.push(`display_order = $${i++}`); vals.push(patch.displayOrder);
    }
    fields.push(`updated_at = now()`);

    if (fields.length === 1) {
      await client.query('COMMIT');
      return existing;
    }

    vals.push(roleId);
    const r = await client.query(
      `UPDATE dance_team_role SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      vals,
    );
    await client.query('COMMIT');
    return mapRoleRow(r.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteRole(pool: Pool, roleId: string): Promise<{ deleted: boolean; reason?: string }> {
  const role = await getRole(pool, roleId);
  if (!role) return { deleted: false, reason: 'not_found' };
  if (role.isOwnerRole) return { deleted: false, reason: 'cannot_delete_owner_role' };

  // Sjekk at ingen aktive medlemmer har denne rollen.
  const inUse = await pool.query(
    `SELECT COUNT(*)::int AS n FROM enterprise_team_members
      WHERE dance_role_id = $1 AND status IN ('active','pending')`,
    [roleId],
  );
  if ((inUse.rows[0]?.n ?? 0) > 0) {
    return { deleted: false, reason: 'role_in_use' };
  }
  // Sjekk pending invites.
  const pendingInvites = await pool.query(
    `SELECT COUNT(*)::int AS n FROM dance_team_invite
      WHERE invited_role_id = $1 AND accepted_at IS NULL AND revoked_at IS NULL`,
    [roleId],
  );
  if ((pendingInvites.rows[0]?.n ?? 0) > 0) {
    return { deleted: false, reason: 'role_has_pending_invites' };
  }
  await pool.query(`DELETE FROM dance_team_role WHERE id = $1`, [roleId]);
  return { deleted: true };
}

// ═══════════════════════════════════════════════════════════════════════
//  MEMBERS
// ═══════════════════════════════════════════════════════════════════════

export async function listMembers(pool: Pool, teamOrgId: string): Promise<DanceTeamMember[]> {
  const r = await pool.query(
    `SELECT m.*, r.label AS dance_role_label
       FROM enterprise_team_members m
       LEFT JOIN dance_team_role r ON r.id = m.dance_role_id
      WHERE m.org_kind = 'dance_studio' AND m.organization_id = $1
      ORDER BY m.status, m.joined_at NULLS LAST, m.invited_at`,
    [teamOrgId],
  );
  return r.rows.map(mapMemberRow);
}

export async function updateMemberRole(
  pool: Pool,
  teamOrgId: string,
  memberRowId: string,
  newRoleId: string,
): Promise<DanceTeamMember | null> {
  // Bekreft at rolle tilhører riktig team.
  const role = await getRole(pool, newRoleId);
  if (!role || role.teamOrganizationId !== teamOrgId) return null;

  const r = await pool.query(
    `UPDATE enterprise_team_members
        SET dance_role_id = $1, updated_at = now()
      WHERE id = $2 AND organization_id = $3 AND org_kind = 'dance_studio'
      RETURNING *`,
    [newRoleId, memberRowId, teamOrgId],
  );
  if (!r.rowCount) return null;
  // Hent label til retur.
  const withLabel = await pool.query(
    `SELECT m.*, r.label AS dance_role_label
       FROM enterprise_team_members m
       LEFT JOIN dance_team_role r ON r.id = m.dance_role_id
      WHERE m.id = $1`,
    [memberRowId],
  );
  return mapMemberRow(withLabel.rows[0]);
}

export async function removeMember(
  pool: Pool,
  teamOrgId: string,
  memberRowId: string,
): Promise<{ removed: boolean; reason?: string }> {
  const r = await pool.query(
    `SELECT m.*, r.is_owner_role
       FROM enterprise_team_members m
       LEFT JOIN dance_team_role r ON r.id = m.dance_role_id
      WHERE m.id = $1 AND m.organization_id = $2 AND m.org_kind = 'dance_studio'`,
    [memberRowId, teamOrgId],
  );
  if (!r.rowCount) return { removed: false, reason: 'not_found' };
  if (asBoolFlag(r.rows[0].is_owner_role)) {
    return { removed: false, reason: 'cannot_remove_owner' };
  }
  await pool.query(
    `UPDATE enterprise_team_members
        SET status = 'deactivated', deactivated_at = now()
      WHERE id = $1`,
    [memberRowId],
  );
  return { removed: true };
}

// ═══════════════════════════════════════════════════════════════════════
//  INVITES
// ═══════════════════════════════════════════════════════════════════════

export async function listInvites(pool: Pool, teamOrgId: string): Promise<DanceTeamInvite[]> {
  const r = await pool.query(
    `SELECT i.*, r.label AS invited_role_label
       FROM dance_team_invite i
       LEFT JOIN dance_team_role r ON r.id = i.invited_role_id
      WHERE i.team_organization_id = $1
      ORDER BY i.created_at DESC`,
    [teamOrgId],
  );
  return r.rows.map(mapInviteRow);
}

export async function getInviteByToken(pool: Pool, token: string): Promise<DanceTeamInvite | null> {
  const r = await pool.query(
    `SELECT i.*, r.label AS invited_role_label
       FROM dance_team_invite i
       LEFT JOIN dance_team_role r ON r.id = i.invited_role_id
      WHERE i.token = $1`,
    [token],
  );
  return r.rowCount ? mapInviteRow(r.rows[0]) : null;
}

export async function createInvite(
  pool: Pool,
  input: {
    teamOrgId: string;
    invitedEmail: string;
    invitedRoleId: string;
    invitedByUserId: string;
    expiresAt?: Date;
  },
): Promise<{ invite: DanceTeamInvite; seatRemaining: number | null }> {
  // Bekreft at rolle tilhører dette teamet.
  const role = await getRole(pool, input.invitedRoleId);
  if (!role || role.teamOrganizationId !== input.teamOrgId) {
    throw new Error('role_not_found_for_team');
  }

  // Seat-håndhevelse: tell aktive + pending medlemmer + ikke-aksepterte invites.
  const summary = await getTeamSummary(pool, input.teamOrgId);
  if (summary.seatLimit != null) {
    const pendingInvites = await pool.query(
      `SELECT COUNT(*)::int AS n FROM dance_team_invite
        WHERE team_organization_id = $1
          AND accepted_at IS NULL
          AND revoked_at IS NULL
          AND expires_at > now()`,
      [input.teamOrgId],
    );
    const projected = summary.memberCount + Number(pendingInvites.rows[0]?.n ?? 0);
    if (projected >= summary.seatLimit) {
      throw new Error('seat_limit_reached');
    }
  }

  const token = generateInviteToken();
  const expiresAt = input.expiresAt ?? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const r = await pool.query(
    `INSERT INTO dance_team_invite
       (token, team_organization_id, invited_email, invited_role_id, invited_by_user_id, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [token, input.teamOrgId, input.invitedEmail, input.invitedRoleId, input.invitedByUserId, expiresAt.toISOString()],
  );
  const inviteWithLabel = await pool.query(
    `SELECT i.*, r.label AS invited_role_label
       FROM dance_team_invite i
       LEFT JOIN dance_team_role r ON r.id = i.invited_role_id
      WHERE i.token = $1`,
    [token],
  );
  const after = await getTeamSummary(pool, input.teamOrgId);
  return {
    invite: mapInviteRow(inviteWithLabel.rows[0]),
    seatRemaining: after.seatRemaining,
  };
}

export async function revokeInvite(pool: Pool, token: string): Promise<boolean> {
  const r = await pool.query(
    `UPDATE dance_team_invite
        SET revoked_at = now()
      WHERE token = $1 AND accepted_at IS NULL AND revoked_at IS NULL`,
    [token],
  );
  return (r.rowCount ?? 0) > 0;
}

export async function acceptInvite(
  pool: Pool,
  token: string,
  acceptingUserId: string,
  acceptingEmail: string,
): Promise<{ accepted: boolean; reason?: string; teamOrganizationId?: string; danceRoleId?: string }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const inv = await client.query(
      `SELECT * FROM dance_team_invite WHERE token = $1 FOR UPDATE`,
      [token],
    );
    if (!inv.rowCount) {
      await client.query('ROLLBACK');
      return { accepted: false, reason: 'not_found' };
    }
    const row = inv.rows[0];
    if (row.accepted_at) { await client.query('ROLLBACK'); return { accepted: false, reason: 'already_accepted' }; }
    if (row.revoked_at)  { await client.query('ROLLBACK'); return { accepted: false, reason: 'revoked' }; }
    if (new Date(row.expires_at) <= new Date()) {
      await client.query('ROLLBACK');
      return { accepted: false, reason: 'expired' };
    }

    const teamOrgId = String(row.team_organization_id);
    const roleId = String(row.invited_role_id);

    // Insert eller oppgrader medlemskap.
    await client.query(
      `INSERT INTO enterprise_team_members
         (organization_id, user_id, email, role, status, joined_at, org_kind, dance_role_id)
       VALUES ($1, $2, $3, 'member', 'active', now(), 'dance_studio', $4)
       ON CONFLICT (organization_id, email)
       DO UPDATE SET
         user_id = COALESCE(EXCLUDED.user_id, enterprise_team_members.user_id),
         status = 'active',
         joined_at = COALESCE(enterprise_team_members.joined_at, EXCLUDED.joined_at),
         dance_role_id = EXCLUDED.dance_role_id,
         org_kind = 'dance_studio'`,
      [teamOrgId, acceptingUserId, acceptingEmail, roleId],
    );

    await client.query(
      `UPDATE dance_team_invite
          SET accepted_at = now(), accepted_user_id = $1
        WHERE token = $2`,
      [acceptingUserId, token],
    );

    await client.query('COMMIT');
    return { accepted: true, teamOrganizationId: teamOrgId, danceRoleId: roleId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  CAPABILITIES (resolver — brukes av useDancePlanGate)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Resolver capabilities for en user via deres team-membership.
 * Returnerer tom Set hvis user ikke er i et dance-team (Frilansdanser-path).
 */
export async function resolveUserCapabilities(
  pool: Pool,
  userId: string,
): Promise<Set<string>> {
  const r = await pool.query(
    `SELECT r.capabilities, r.is_owner_role
       FROM enterprise_team_members m
       JOIN dance_team_role r ON r.id = m.dance_role_id
      WHERE m.org_kind = 'dance_studio'
        AND m.user_id = $1
        AND m.status = 'active'
      LIMIT 1`,
    [userId],
  );
  if (!r.rowCount) return new Set();
  if (asBoolFlag(r.rows[0].is_owner_role)) {
    // Eier har alltid alle capabilities, uavhengig av JSONB-innhold.
    return new Set(ALL_CAPABILITY_KEYS);
  }
  const caps = asJson<Record<string, boolean>>(r.rows[0].capabilities, {});
  return new Set(Object.keys(caps).filter((k) => caps[k] === true));
}

// ═══════════════════════════════════════════════════════════════════════
//  SEATS — utleder fra dance_subscription.plan.limits.maxTeamSeats
// ═══════════════════════════════════════════════════════════════════════

export async function getMaxTeamSeats(
  pool: Pool,
  teamOrgId: string,
): Promise<number | null> {
  const r = await pool.query(
    `SELECT p.limits
       FROM dance_subscription s
       JOIN dance_plan p ON p.slug = s.plan_slug
      WHERE s.user_id = $1
        AND s.status IN ('trialing','active','comp')
      LIMIT 1`,
    [teamOrgId],
  );
  if (!r.rowCount) {
    // Ingen aktiv subscription — default tak (10) under onboarding.
    return 10;
  }
  const limits = asJson<Record<string, unknown>>(r.rows[0].limits, {});
  const raw = limits.maxTeamSeats;
  if (raw == null) return null;            // null = ubegrenset (Enterprise)
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}
