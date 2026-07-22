/**
 * Teammedlemmer: eiere/administratorer inviterer kolleger og eksterne
 * regnskapsførere inn i organisasjonen med en rolle. Rollen styrer rettighetene
 * (se access/permissions.ts). Rene tabelloperasjoner på `memberships` — RBAC-en
 * håndheves som før via requireOrgPermission på hvert endepunkt.
 *
 * Vaktregel: en organisasjon må ALLTID ha minst én aktiv eier. Å fjerne eller
 * degradere den siste eieren avvises, så ingen kan låse seg selv ute.
 */
import type { Db, DbClient } from '../db/pool.js';
import { withTransaction } from '../db/pool.js';
import type { Actor } from '../audit/audit.js';
import { recordAuditEvent } from '../audit/audit.js';
import { ROLES, type Role } from '../access/permissions.js';
import { ValidationError } from '../shared/errors.js';
import { newId } from '../shared/ids.js';
import { ensureUser } from './service.js';

export interface MemberDto {
  userId: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
  createdAt: string;
}

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export async function listMembers(db: Db, organizationId: string): Promise<MemberDto[]> {
  const res = await db.query(
    `SELECT m.user_id, u.email, u.display_name, m.role, m.status, m.created_at::TEXT AS created_at
     FROM memberships m JOIN users u ON u.id = m.user_id
     WHERE m.organization_id = $1
     ORDER BY (m.role = 'owner') DESC, u.email`,
    [organizationId],
  );
  return res.rows.map((r) => ({
    userId: r.user_id,
    email: r.email,
    displayName: r.display_name,
    role: r.role,
    status: r.status,
    createdAt: r.created_at,
  }));
}

async function countActiveOwners(
  db: Db | DbClient,
  organizationId: string,
  excludingUserId?: string,
): Promise<number> {
  const res = await db.query(
    `SELECT COUNT(*)::int AS n FROM memberships
     WHERE organization_id = $1 AND role = 'owner' AND status = 'active'
       AND ($2::uuid IS NULL OR user_id <> $2)`,
    [organizationId, excludingUserId ?? null],
  );
  return res.rows[0].n as number;
}

/** Inviterer/legger til et medlem via e-post + rolle (idempotent på bruker). */
export async function addOrUpdateMember(
  db: Db,
  params: { organizationId: string; actor: Actor; email: string; displayName?: string; role: string },
): Promise<{ userId: string; role: string; created: boolean }> {
  if (!isRole(params.role)) throw new ValidationError(`Ukjent rolle: ${params.role}`);
  const email = params.email.trim().toLowerCase();
  return withTransaction(db, async (client) => {
    const userId = await ensureUser(client, email, params.displayName?.trim() || (email.split('@')[0] ?? email));
    const existing = await client.query(
      `SELECT role, status FROM memberships WHERE organization_id = $1 AND user_id = $2`,
      [params.organizationId, userId],
    );
    const created = existing.rowCount === 0;
    await client.query(
      `INSERT INTO memberships (id, organization_id, user_id, role, created_by, status)
       VALUES ($1,$2,$3,$4,$5,'active')
       ON CONFLICT (organization_id, user_id)
       DO UPDATE SET role = EXCLUDED.role, status = 'active'`,
      [newId(), params.organizationId, userId, params.role, params.actor.userId],
    );
    await recordAuditEvent(client, {
      organizationId: params.organizationId,
      actor: params.actor,
      action: created ? 'member.added' : 'member.updated',
      entityType: 'membership',
      entityId: userId,
      newValue: { email, role: params.role },
    });
    return { userId, role: params.role, created };
  });
}

export async function changeMemberRole(
  db: Db,
  params: { organizationId: string; actor: Actor; userId: string; role: string },
): Promise<void> {
  if (!isRole(params.role)) throw new ValidationError(`Ukjent rolle: ${params.role}`);
  await withTransaction(db, async (client) => {
    const cur = await client.query(
      `SELECT role FROM memberships WHERE organization_id = $1 AND user_id = $2 AND status = 'active'`,
      [params.organizationId, params.userId],
    );
    if (!cur.rowCount) throw new ValidationError('Medlemmet finnes ikke i organisasjonen.');
    if (cur.rows[0].role === 'owner' && params.role !== 'owner') {
      if ((await countActiveOwners(client, params.organizationId, params.userId)) === 0) {
        throw new ValidationError('Organisasjonen må ha minst én eier. Gjør noen andre til eier først.');
      }
    }
    await client.query(
      `UPDATE memberships SET role = $3 WHERE organization_id = $1 AND user_id = $2`,
      [params.organizationId, params.userId, params.role],
    );
    await recordAuditEvent(client, {
      organizationId: params.organizationId,
      actor: params.actor,
      action: 'member.role_changed',
      entityType: 'membership',
      entityId: params.userId,
      newValue: { role: params.role },
    });
  });
}

/** Trekker tilbake et medlemskap (soft: status='revoked' — bevarer sporet). */
export async function removeMember(
  db: Db,
  params: { organizationId: string; actor: Actor; userId: string },
): Promise<void> {
  await withTransaction(db, async (client) => {
    const cur = await client.query(
      `SELECT role FROM memberships WHERE organization_id = $1 AND user_id = $2 AND status = 'active'`,
      [params.organizationId, params.userId],
    );
    if (!cur.rowCount) throw new ValidationError('Medlemmet finnes ikke i organisasjonen.');
    if (cur.rows[0].role === 'owner' && (await countActiveOwners(client, params.organizationId, params.userId)) === 0) {
      throw new ValidationError('Kan ikke fjerne den siste eieren. Gjør noen andre til eier først.');
    }
    await client.query(
      `UPDATE memberships SET status = 'revoked' WHERE organization_id = $1 AND user_id = $2`,
      [params.organizationId, params.userId],
    );
    await recordAuditEvent(client, {
      organizationId: params.organizationId,
      actor: params.actor,
      action: 'member.removed',
      entityType: 'membership',
      entityId: params.userId,
      newValue: { status: 'revoked' },
    });
  });
}

/** Har e-posten et aktivt medlemskap i EN organisasjon? Åpner magisk-lenke-login for inviterte. */
export async function hasActiveMembershipByEmail(db: Db, email: string): Promise<boolean> {
  const res = await db.query(
    `SELECT 1 FROM memberships m JOIN users u ON u.id = m.user_id
     WHERE lower(u.email) = lower($1) AND m.status = 'active' LIMIT 1`,
    [email],
  );
  return res.rowCount ? true : false;
}
