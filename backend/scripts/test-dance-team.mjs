#!/usr/bin/env node
/**
 * test-dance-team.mjs
 *
 * End-to-end-test av dance-team-service mot en midlertidig lokal Postgres-DB.
 * Setter opp users + enterprise_team_members + dance_plan/subscription stubs,
 * applikerer migration 0071_dance_team_extension.sql, og tester alle
 * service-funksjoner inkludert edge-cases.
 *
 * Forutsetninger:
 *   • Lokal Postgres oppe på localhost:5432
 *   • Brukeren har CREATEDB-rettigheter
 *
 * Kjøring:
 *   node backend/scripts/test-dance-team.mjs
 */

import pg from 'pg';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATION = path.join(ROOT, 'migrations', '0071_dance_team_extension.sql');
const DB_NAME = `dance_team_test_${Date.now()}`;
const PG_USER = process.env.PGUSER || os.userInfo().username;
const CONN = `postgresql://${PG_USER}@localhost:5432/${DB_NAME}`;

const c = {
  reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m',
  yellow: '\x1b[33m', cyan: '\x1b[36m', dim: '\x1b[2m',
};

let pass = 0, fail = 0;
const failures = [];

function ok(name) { console.log(`${c.green}✓${c.reset} ${name}`); pass++; }
function ko(name, err) {
  console.log(`${c.red}✗${c.reset} ${name}${c.dim} — ${err?.message ?? err}${c.reset}`);
  fail++;
  failures.push({ name, error: String(err?.message ?? err) });
}

async function setup() {
  spawnSync('createdb', [DB_NAME], { stdio: 'inherit', env: { ...process.env, PGUSER: PG_USER } });
  const pool = new pg.Pool({ connectionString: CONN });
  await pool.query(`
    CREATE TABLE users (id VARCHAR(255) PRIMARY KEY, email VARCHAR(255));
    CREATE TABLE enterprise_team_members (
      id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
      organization_id VARCHAR(255) NOT NULL,
      user_id VARCHAR(255) REFERENCES users(id),
      email VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
      status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('active', 'pending', 'deactivated')),
      invited_by VARCHAR(255) REFERENCES users(id),
      invited_at TIMESTAMP DEFAULT NOW(),
      joined_at TIMESTAMP,
      deactivated_at TIMESTAMP,
      deactivated_by VARCHAR(255) REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      CONSTRAINT idx_enterprise_team_unique_member UNIQUE (organization_id, email)
    );
    CREATE TABLE dance_plan (
      slug TEXT PRIMARY KEY,
      limits JSONB NOT NULL DEFAULT '{}'::jsonb
    );
    CREATE TABLE dance_subscription (
      user_id TEXT PRIMARY KEY,
      plan_slug TEXT REFERENCES dance_plan(slug),
      status TEXT NOT NULL DEFAULT 'active'
    );
  `);
  // Apply migration
  const r = spawnSync('psql', ['-d', DB_NAME, '-v', 'ON_ERROR_STOP=1', '-f', MIGRATION], {
    env: { ...process.env, PGUSER: PG_USER },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (r.status !== 0) {
    throw new Error(`psql migration failed: ${r.stderr.toString()}`);
  }
  return pool;
}

async function teardown(pool) {
  await pool.end().catch(() => {});
  spawnSync('dropdb', [DB_NAME], { stdio: 'inherit', env: { ...process.env, PGUSER: PG_USER } });
}

async function main() {
  console.log(`${c.cyan}▸ Setup temp DB ${DB_NAME}${c.reset}`);
  const pool = await setup();

  try {
    const svc = await import('../server/dance-team-service.ts');

    // ─── seed users + plan ────────────────────────────────────────────
    await pool.query(`INSERT INTO users (id, email) VALUES
      ('owner-1','owner@studio.no'),
      ('user-2','two@example.com'),
      ('user-3','three@example.com'),
      ('user-4','four@example.com')`);

    await pool.query(`INSERT INTO dance_plan (slug, limits) VALUES
      ('studio_pro', '{"maxTeamSeats": 3}'::jsonb)`);
    await pool.query(`INSERT INTO dance_subscription (user_id, plan_slug, status)
      VALUES ('owner-1','studio_pro','active')`);

    // ─── ensureTeamForOwner: idempotent ───────────────────────────────
    try {
      const t1 = await svc.ensureTeamForOwner(pool, 'owner-1', 'owner@studio.no');
      const t2 = await svc.ensureTeamForOwner(pool, 'owner-1', 'owner@studio.no');
      if (t1.teamOrganizationId !== t2.teamOrganizationId) throw new Error('not idempotent');
      if (t1.activeMemberCount !== 1) throw new Error(`expected 1 active member, got ${t1.activeMemberCount}`);
      if (t1.seatLimit !== 3) throw new Error(`expected seatLimit=3, got ${t1.seatLimit}`);
      ok('ensureTeamForOwner is idempotent + seat-limit from plan');
    } catch (e) { ko('ensureTeamForOwner', e); }

    // ─── 4 default-roller seedet ──────────────────────────────────────
    let roles;
    try {
      roles = await svc.listRoles(pool, 'owner-1');
      if (roles.length !== 4) throw new Error(`expected 4 roles, got ${roles.length}`);
      const labels = roles.map(r => r.label).sort();
      const expected = ['Co-danser', 'Danser', 'Eier', 'Instruktør', 'Koreograf', 'Lærer'].sort();
      // Vi har 4 roller, ikke 6 — sjekk at de 4 vi forventer er der
      const expected4 = ['Danser', 'Eier', 'Koreograf', 'Lærer'];
      for (const lbl of expected4) {
        if (!labels.includes(lbl)) throw new Error(`missing default role: ${lbl}`);
      }
      const owner = roles.find(r => r.isOwnerRole);
      if (!owner) throw new Error('no owner role seeded');
      if (Object.values(owner.capabilities).filter(Boolean).length < 20) {
        throw new Error('owner role should have ALL capabilities');
      }
      ok(`listRoles returns 4 default roles (incl. locked Eier with ${Object.values(owner.capabilities).filter(Boolean).length} caps)`);
    } catch (e) { ko('listRoles default-seed', e); }

    // ─── default-for-invite: Lærer ────────────────────────────────────
    try {
      const larer = roles.find(r => r.label === 'Lærer');
      if (!larer.isDefaultForInvite) throw new Error('Lærer should be default-for-invite');
      ok('Lærer is is_default_for_invite=true');
    } catch (e) { ko('default-for-invite flag', e); }

    // ─── createInvite + acceptInvite happy path ───────────────────────
    const larerRoleId = roles.find(r => r.label === 'Lærer').id;
    let invite1Token;
    try {
      const r = await svc.createInvite(pool, {
        teamOrgId: 'owner-1',
        invitedEmail: 'two@example.com',
        invitedRoleId: larerRoleId,
        invitedByUserId: 'owner-1',
      });
      invite1Token = r.invite.token;
      if (r.seatRemaining !== 2) throw new Error(`seatRemaining should be 2, got ${r.seatRemaining}`);
      ok('createInvite generates token + decrements seatRemaining (memberCount counts pending+active)');
    } catch (e) { ko('createInvite', e); }

    try {
      const acc = await svc.acceptInvite(pool, invite1Token, 'user-2', 'two@example.com');
      if (!acc.accepted) throw new Error(`accept failed: ${acc.reason}`);
      ok('acceptInvite binds user to team');
    } catch (e) { ko('acceptInvite', e); }

    // ─── resolveUserCapabilities ──────────────────────────────────────
    try {
      const caps = await svc.resolveUserCapabilities(pool, 'user-2');
      if (!caps.has('class.manage_roster')) throw new Error('Lærer should have class.manage_roster');
      if (caps.has('billing.manage')) throw new Error('Lærer should NOT have billing.manage');
      ok('resolveUserCapabilities returns Lærer caps without billing.manage');

      const ownerCaps = await svc.resolveUserCapabilities(pool, 'owner-1');
      if (!ownerCaps.has('billing.manage')) throw new Error('Owner missing billing.manage');
      if (ownerCaps.size < 20) throw new Error(`Owner should have all caps, got ${ownerCaps.size}`);
      ok('resolveUserCapabilities returns ALL caps for owner');

      const noneCaps = await svc.resolveUserCapabilities(pool, 'user-3');
      if (noneCaps.size !== 0) throw new Error('Non-team user should have empty caps');
      ok('resolveUserCapabilities returns empty Set for non-team user');
    } catch (e) { ko('resolveUserCapabilities', e); }

    // ─── seat-limit enforcement ───────────────────────────────────────
    const danserRoleId = roles.find(r => r.label === 'Danser').id;
    try {
      // Vi har plan med maxTeamSeats=3; allerede 2 medlemmer (owner + user-2).
      // Dette bør lykkes — bringer total til 3.
      const r1 = await svc.createInvite(pool, {
        teamOrgId: 'owner-1',
        invitedEmail: 'three@example.com',
        invitedRoleId: danserRoleId,
        invitedByUserId: 'owner-1',
      });
      // Den neste skal feile med seat_limit_reached.
      let blocked = false;
      try {
        await svc.createInvite(pool, {
          teamOrgId: 'owner-1',
          invitedEmail: 'four@example.com',
          invitedRoleId: danserRoleId,
          invitedByUserId: 'owner-1',
        });
      } catch (err) {
        if (String(err.message) === 'seat_limit_reached') blocked = true;
      }
      if (!blocked) throw new Error('expected seat_limit_reached error on 4th invite');
      ok('seat-limit enforced: 4th invite blocked when plan caps at 3');
    } catch (e) { ko('seat-limit enforcement', e); }

    // ─── owner-role kan ikke slettes ──────────────────────────────────
    try {
      const owner = roles.find(r => r.isOwnerRole);
      const r = await svc.deleteRole(pool, owner.id);
      if (r.deleted) throw new Error('owner role should not be deletable');
      if (r.reason !== 'cannot_delete_owner_role') throw new Error(`wrong reason: ${r.reason}`);
      ok('deleteRole blocks owner-role with cannot_delete_owner_role');
    } catch (e) { ko('owner-role delete-block', e); }

    // ─── role-in-use kan ikke slettes ─────────────────────────────────
    try {
      const r = await svc.deleteRole(pool, larerRoleId);
      if (r.deleted) throw new Error('role in use should not be deletable');
      if (r.reason !== 'role_in_use') throw new Error(`wrong reason: ${r.reason}`);
      ok('deleteRole blocks role with active members (role_in_use)');
    } catch (e) { ko('role-in-use delete-block', e); }

    // ─── createRole sanitizes unknown capabilities ────────────────────
    let customRoleId;
    try {
      const r = await svc.createRole(pool, 'owner-1', {
        label: 'Hovedinstruktør',
        capabilities: {
          'class.manage_schedule': true,
          'video_review.annotate': true,
          'fake.unknown_cap': true,
        },
      });
      customRoleId = r.id;
      if ('fake.unknown_cap' in r.capabilities) {
        throw new Error('unknown capability should be sanitized');
      }
      if (!r.capabilities['class.manage_schedule']) {
        throw new Error('valid capability missing');
      }
      ok('createRole sanitizes unknown capability keys');
    } catch (e) { ko('createRole sanitization', e); }

    // ─── updateRole respects owner-lock for caps ──────────────────────
    try {
      const owner = roles.find(r => r.isOwnerRole);
      const r = await svc.updateRole(pool, owner.id, {
        capabilities: { 'billing.view': false, 'class.view_schedule': false }, // attempting downgrade
      });
      if (Object.values(r.capabilities).filter(Boolean).length < 20) {
        throw new Error('owner role caps should remain ALL despite update');
      }
      ok('updateRole forces all-caps on owner-role even if patch tries to downgrade');
    } catch (e) { ko('owner-role caps lock', e); }

    // ─── revokeInvite ─────────────────────────────────────────────────
    try {
      // Need a fresh team to free up a seat. Cleanup first invite by removing user-2.
      const members = await svc.listMembers(pool, 'owner-1');
      const user2Member = members.find(m => m.email === 'two@example.com');
      await svc.removeMember(pool, 'owner-1', user2Member.memberRowId);

      const inv = await svc.createInvite(pool, {
        teamOrgId: 'owner-1',
        invitedEmail: 'four@example.com',
        invitedRoleId: customRoleId,
        invitedByUserId: 'owner-1',
      });
      const revoked = await svc.revokeInvite(pool, inv.invite.token);
      if (!revoked) throw new Error('revoke returned false');
      // Re-revoke should return false (already revoked)
      const second = await svc.revokeInvite(pool, inv.invite.token);
      if (second) throw new Error('double-revoke should return false');
      ok('revokeInvite works once, idempotent on second call');
    } catch (e) { ko('revokeInvite', e); }

    // ─── getMembershipForUser ────────────────────────────────────────
    try {
      const m = await svc.getMembershipForUser(pool, 'owner-1');
      if (!m) throw new Error('owner should have membership');
      if (!m.role?.isOwnerRole) throw new Error('owner membership role should be owner');
      const none = await svc.getMembershipForUser(pool, 'user-4');
      if (none) throw new Error('user-4 has no membership and should return null');
      ok('getMembershipForUser returns role + null for non-member');
    } catch (e) { ko('getMembershipForUser', e); }

    // ─── capability catalog has expected groups ───────────────────────
    try {
      const groups = Object.keys(svc.CAPABILITIES);
      const expectedGroups = ['team', 'billing', 'classes', 'choreography', 'insights'];
      for (const g of expectedGroups) {
        if (!groups.includes(g)) throw new Error(`missing group: ${g}`);
      }
      if (!svc.ALL_CAPABILITY_KEYS.has('billing.manage')) {
        throw new Error('billing.manage should be in catalog');
      }
      ok(`CAPABILITIES catalog has 5 groups, ${svc.ALL_CAPABILITY_KEYS.size} keys total`);
    } catch (e) { ko('capability catalog', e); }

  } finally {
    await teardown(pool);
  }

  console.log();
  console.log(`${c.cyan}▸ Resultat: ${c.green}${pass} passed${c.reset}, ${fail > 0 ? c.red : c.dim}${fail} failed${c.reset}`);
  if (fail > 0) {
    console.log();
    for (const f of failures) console.log(`  ${c.red}✗${c.reset} ${f.name} — ${f.error}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`${c.red}FATAL${c.reset}`, err);
  process.exit(2);
});
