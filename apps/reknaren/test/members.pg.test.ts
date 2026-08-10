/**
 * Teammedlemmer mot ekte Postgres:
 *  - eier inviterer medlem med rolle → medlemmet får RBAC og kan logge inn (magisk lenke)
 *  - rolle håndheves (regnskapsfører kan ikke administrere medlemmer)
 *  - vaktregel: siste eier kan ikke fjernes eller degraderes
 *  - alt auditlogges
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApiServer } from '../src/api/server.js';
import type { Db } from '../src/db/pool.js';
import { InMemoryEmailStub } from '../src/integrations/email.js';
import { createMagicToken } from '../src/api/magic-link.js';
import { buildNorwegianRuleRegister } from '../src/rules/no/rules.js';
import { setupTestDb, truncateAll } from './helpers.js';

const SECRET = 'test-secret-members';
// Serveren leser REKNAREN_AUTH_SECRET via resolveAuthSecret — sett den før createApiServer
// slik at magiske lenker vi signerer i testen verifiseres med samme hemmelighet.
process.env.REKNAREN_AUTH_SECRET = SECRET;

let db: Db;
const rules = buildNorwegianRuleRegister();
const email = new InMemoryEmailStub({ configured: true });
let app: ReturnType<typeof createApiServer>;
let ownerToken: string;
let orgId: string;

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  // Ingen global tillat-liste → beviser at inviterte medlemmer selv slipper inn.
  app = createApiServer({ db, rules, email, allowedEmails: [], appBaseUrl: 'https://reknaren.test' });

  const login = await request(app)
    .post('/api/auth/dev-login')
    .send({ email: 'eier@example.com', displayName: 'Eier' })
    .expect(200);
  ownerToken = login.body.token;

  const org = await request(app)
    .post('/api/organizations')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ name: 'Team AS', orgForm: 'AS', vatStatus: 'not_registered' })
    .expect(201);
  orgId = org.body.id;
});

afterAll(async () => {
  await db.end();
});

describe('Medlemsadministrasjon', () => {
  let memberUserId: string;

  it('GET /organizations lister virksomhetene eieren er medlem av (returnerende bruker slipper å opprette på nytt)', async () => {
    const res = await request(app)
      .get('/api/organizations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const mine = res.body.find((o: { id: string }) => o.id === orgId);
    expect(mine).toMatchObject({ name: 'Team AS', orgForm: 'AS', role: 'owner' });
  });

  it('eier ser seg selv i medlemslista', async () => {
    const res = await request(app)
      .get(`/api/organizations/${orgId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ email: 'eier@example.com', role: 'owner', status: 'active' });
  });

  it('eier inviterer en regnskapsfører', async () => {
    const res = await request(app)
      .post(`/api/organizations/${orgId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'Regnskap@Example.com', role: 'accountant' })
      .expect(201);
    expect(res.body).toMatchObject({ role: 'accountant', created: true });
    memberUserId = res.body.userId;

    const audit = await db.query(
      `SELECT COUNT(*)::int AS n FROM audit_events WHERE action = 'member.added' AND entity_id = $1`,
      [memberUserId],
    );
    expect(audit.rows[0].n).toBe(1);
  });

  it('det inviterte medlemmet kan logge inn via magisk lenke uten global tillat-liste', async () => {
    const magic = createMagicToken('regnskap@example.com', SECRET);
    const res = await request(app).post('/api/auth/verify-magic-link').send({ token: magic }).expect(200);
    expect(res.body.email).toBe('regnskap@example.com');
    expect(res.body.token).toBeTruthy();

    // …og har regnskapsfører-rettigheter (kan se rapporter), men IKKE administrere medlemmer
    const memberToken = res.body.token;
    await request(app)
      .get(`/api/organizations/${orgId}/members`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(403);
  });

  it('en ikke-invitert, ikke-tillatt adresse slipper IKKE inn', async () => {
    const magic = createMagicToken('fremmed@example.com', SECRET);
    await request(app).post('/api/auth/verify-magic-link').send({ token: magic }).expect(401);
  });

  it('eier endrer medlemmets rolle til employee', async () => {
    await request(app)
      .patch(`/api/organizations/${orgId}/members/${memberUserId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ role: 'employee' })
      .expect(200);
    const list = await request(app)
      .get(`/api/organizations/${orgId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(list.body.find((m: { userId: string }) => m.userId === memberUserId).role).toBe('employee');
  });

  it('kan ikke fjerne eller degradere den siste eieren', async () => {
    const ownerId = (
      await db.query(`SELECT user_id FROM memberships WHERE organization_id = $1 AND role = 'owner'`, [orgId])
    ).rows[0].user_id;
    const del = await request(app)
      .delete(`/api/organizations/${orgId}/members/${ownerId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(400);
    expect(del.body.error.message).toMatch(/siste eier/i);
    await request(app)
      .patch(`/api/organizations/${orgId}/members/${ownerId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ role: 'employee' })
      .expect(400);
  });

  it('eier fjerner medlemmet (soft revoke) → mister tilgang', async () => {
    await request(app)
      .delete(`/api/organizations/${orgId}/members/${memberUserId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const list = await request(app)
      .get(`/api/organizations/${orgId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(list.body.find((m: { userId: string }) => m.userId === memberUserId).status).toBe('revoked');

    // revokert medlem slipper ikke lenger inn via magisk lenke (intet aktivt medlemskap)
    const magic = createMagicToken('regnskap@example.com', SECRET);
    await request(app).post('/api/auth/verify-magic-link').send({ token: magic }).expect(401);
  });
});
