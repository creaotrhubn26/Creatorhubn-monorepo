/**
 * Magisk innlogging ende-til-ende mot Postgres: be om lenke → verifiser →
 * sesjon + eierskap i bootstrap-orgen. Kun tillatte e-poster.
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApiServer } from '../src/api/server.js';
import type { Db } from '../src/db/pool.js';
import { InMemoryEmailStub } from '../src/integrations/email.js';
import type { BootstrapOrgConfig } from '../src/ops/bootstrap.js';
import { buildNorwegianRuleRegister } from '../src/rules/no/rules.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
let app: ReturnType<typeof createApiServer>;
let email: InMemoryEmailStub;

const bootstrapOrg: BootstrapOrgConfig = {
  name: 'Creatorhub AS',
  orgNumber: '937518684',
  orgForm: 'AS',
  vatStatus: 'not_registered',
  systemUserEmail: 'system@reknaren.local',
  systemUserName: 'System',
};

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  email = new InMemoryEmailStub();
  app = createApiServer({
    db,
    rules: buildNorwegianRuleRegister(),
    email,
    allowedEmails: ['daniel@creatorhubn.com'],
    appBaseUrl: 'https://reknaren-coss.onrender.com',
    bootstrapOrg,
  });
});

afterAll(async () => {
  await db.end();
});

function tokenFromLink(text: string): string {
  const m = /[?&]magic=([^\s]+)/.exec(text);
  return decodeURIComponent(m![1]!);
}

describe('Magisk innlogging (endepunkter)', () => {
  it('request-magic-link: sender lenke KUN til tillatt e-post (alltid 200)', async () => {
    await request(app).post('/api/auth/request-magic-link').send({ email: 'fremmed@annet.no' }).expect(200);
    expect(email.sent).toHaveLength(0); // ikke tillatt → ingen e-post

    await request(app).post('/api/auth/request-magic-link').send({ email: 'daniel@creatorhubn.com' }).expect(200);
    expect(email.sent).toHaveLength(1);
    expect(email.sent[0]!.to).toBe('daniel@creatorhubn.com');
    expect(email.sent[0]!.text).toContain('?magic=');
  });

  it('verify-magic-link: gir sesjon + gjør brukeren til eier av bootstrap-orgen', async () => {
    // Bootstrap orgen først (som cron ville gjort), slik at medlemskap kan settes.
    const { ensureBootstrapOrg } = await import('../src/ops/bootstrap.js');
    await ensureBootstrapOrg(db, bootstrapOrg);

    const token = tokenFromLink(email.sent[email.sent.length - 1]!.text);
    const res = await request(app).post('/api/auth/verify-magic-link').send({ token }).expect(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.email).toBe('daniel@creatorhubn.com');

    // Sesjonen + medlemskapet virker mot et org-beskyttet endepunkt (invoices.view).
    const org = await db.query<{ id: string }>(`SELECT id FROM organizations WHERE org_number = '937518684'`);
    await request(app)
      .get(`/api/organizations/${org.rows[0]!.id}/customers`)
      .set('Authorization', `Bearer ${res.body.token}`)
      .expect(200);
  });

  it('verify-magic-link: avviser ugyldig token (401)', async () => {
    await request(app).post('/api/auth/verify-magic-link').send({ token: 'tull.tull' }).expect(401);
  });
});
