/**
 * API-tester for markedsinnsikt: cron-refresh (token-auth) + les/dismiss
 * (sesjons-auth, samme RBAC som andre org-ruter). Mønster kopiert fra
 * test/api.pg.test.ts (app-bygging + dev-login) og test/market-refresh.pg.test.ts
 * (stub-kilder + gjeldsseeding for et rate_debt-kort).
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApiServer, type ApiDeps } from '../src/api/server.js';
import type { Db } from '../src/db/pool.js';
import { buildNorwegianRuleRegister } from '../src/rules/no/rules.js';
import { StaticCompanyRegistryStub } from '../src/integrations/company-registry.js';
import { StaticPolicyRateStub } from '../src/market/sources/policy-rate.js';
import { StaticKpiStub } from '../src/market/sources/kpi.js';
import { StaticFxWindowStub } from '../src/market/sources/fx-window.js';
import { postJournalEntry } from '../src/ledger/engine.js';
import { upsertSignal } from '../src/market/signal-store.js';
import { newId } from '../src/shared/ids.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
let app: ReturnType<typeof createApiServer>;
let ownerToken: string;
let orgId: string;

const CRON_SECRET = 'x'.repeat(16);
const marketSources: ApiDeps['marketSources'] = {
  policyRate: new StaticPolicyRateStub('4.50', '2026-08-14'),
  kpi: new StaticKpiStub('3.4', '2026-07'),
  fxWindow: new StaticFxWindowStub({}),
  registry: new StaticCompanyRegistryStub({ '910000004': { found: true, orgNumber: '910000004', naceCode: '62.010' } }),
};

async function login(email: string, displayName: string): Promise<string> {
  const res = await request(app).post('/api/auth/dev-login').send({ email, displayName }).expect(200);
  return res.body.token;
}

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  app = createApiServer({ db, rules: buildNorwegianRuleRegister(), cronSecret: CRON_SECRET, marketSources });
  // Forrige styringsrente (før cron henter dagens '4.50' fra stubben) — rate_debt-kortet
  // trenger BÅDE forrige og siste signal for å regne ut rente-delta.
  await upsertSignal(db, { source: 'norges_bank', kind: 'policy_rate', signalKey: 'KPRA', value: '4.25', unit: 'percent', period: '2026-06-19' });
  ownerToken = await login('marked@example.com', 'Eier');

  const org = await request(app)
    .post('/api/organizations')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ name: 'Marked AS', orgForm: 'AS', vatStatus: 'registered', orgNumber: '910000004' })
    .expect(201);
  orgId = org.body.id;

  // 2240 (gjeld til kredittinstitusjoner) er ikke i standard kontoplan — legg til for testen
  // (speiler test/market-refresh.pg.test.ts).
  await db.query(
    `INSERT INTO ledger_accounts (id, organization_id, account_number, name, account_type)
     VALUES ($1,$2,'2240','Gjeld til kredittinstitusjoner','liability')`,
    [newId(), orgId],
  );
  const userId = (await db.query(`SELECT id FROM users WHERE email = 'marked@example.com'`)).rows[0].id as string;
  await postJournalEntry(db, {
    organizationId: orgId,
    actor: { userId, role: 'owner' },
    entryDate: '2026-08-01',
    description: 'Lån',
    idempotencyKey: 'market-api-test:laan-1',
    lines: [
      { accountNumber: '1920', debitMinor: 48000000n, creditMinor: 0n },
      { accountNumber: '2240', debitMinor: 0n, creditMinor: 48000000n },
    ],
  });
});

afterAll(async () => {
  await db.end();
});

describe('cron-token', () => {
  it('avviser uten token', async () => {
    await request(app).post('/api/cron/market-refresh').expect(403);
  });

  it('avviser feil token', async () => {
    await request(app).post('/api/cron/market-refresh').set('x-cron-secret', 'feil-token-feil-token').expect(403);
  });
});

describe('cron-refresh + les/dismiss', () => {
  it('cron oppdaterer signaler og genererer kort på tvers av organisasjoner', async () => {
    const res = await request(app).post('/api/cron/market-refresh').set('x-cron-secret', CRON_SECRET).expect(200);
    expect(res.body.orgs).toBeGreaterThanOrEqual(1);
    expect(res.body.cards).toBeGreaterThanOrEqual(1);
  });

  it('leseruten returnerer org-innsikts-kort, autentisert, med rate_debt', async () => {
    const res = await request(app)
      .get(`/api/organizations/${orgId}/market/insights`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(Array.isArray(res.body.cards)).toBe(true);
    const rateDebt = res.body.cards.find((c: { kind: string }) => c.kind === 'rate_debt');
    expect(rateDebt).toBeDefined();
    expect(typeof rateDebt.impact_minor).toBe('string'); // bigint → string via toJson

    // dismiss fjerner kortet fra fremtidige (ikke-avviste) lesinger.
    await request(app)
      .post(`/api/organizations/${orgId}/market/insights/${rateDebt.id}/dismiss`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const after = await request(app)
      .get(`/api/organizations/${orgId}/market/insights`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(after.body.cards.some((c: { id: string }) => c.id === rateDebt.id)).toBe(false);
  });

  it('leseruten krever autentisering', async () => {
    await request(app).get(`/api/organizations/${orgId}/market/insights`).expect(401);
  });
});
