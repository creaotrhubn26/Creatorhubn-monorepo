/**
 * Bank-feed samtykke- og synk-flyt mot ekte Postgres, med en stub-aggregator:
 * list banker → connect (requisition lagres) → link (konto-kobling lagres) →
 * sync (bruker lagret kobling → importerer transaksjoner). Ærlig 503 uten feed,
 * 400 når kontoen ikke er koblet.
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApiServer } from '../src/api/server.js';
import type { Db } from '../src/db/pool.js';
import { StaticVatRegisterStub } from '../src/integrations/brreg.js';
import type {
  BankFeedProvider,
  BankFeedResult,
  BankInstitution,
  RequisitionAccounts,
  RequisitionLink,
} from '../src/bank/feed.js';
import { buildNorwegianRuleRegister } from '../src/rules/no/rules.js';
import { setupTestDb, truncateAll } from './helpers.js';

/** Deterministisk stub-aggregator — beviser endepunkt-wiring + DB-lagring uten nettverk. */
class StubBankFeed implements BankFeedProvider {
  readonly name = 'stub';
  readonly configured = true;
  lastReference?: string;
  async listInstitutions(): Promise<BankInstitution[]> {
    return [{ id: 'DNB_DNBANOKK', name: 'DNB' }];
  }
  async createRequisition(p: { reference: string }): Promise<RequisitionLink> {
    this.lastReference = p.reference;
    return { requisitionId: 'req-1', link: 'https://ob.example/start/req-1' };
  }
  async completeConsent(): Promise<RequisitionAccounts> {
    return { status: 'LN', accountIds: ['acc-1', 'acc-2'] };
  }
  async fetchTransactions(): Promise<BankFeedResult> {
    return {
      transactions: [
        { externalId: 'gc-1', bookedDate: '2026-02-10', amountMinor: -12345n, currency: 'NOK', description: 'Strøm' },
        { externalId: 'gc-2', bookedDate: '2026-02-11', amountMinor: 500000n, currency: 'NOK', description: 'Innbetaling' },
      ],
    };
  }
}

let db: Db;
const rules = buildNorwegianRuleRegister();
const feed = new StubBankFeed();
let app: ReturnType<typeof createApiServer>;
let appNoFeed: ReturnType<typeof createApiServer>;
let token: string;
let orgId: string;
let bankAccountId: string;

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  const vatRegister = new StaticVatRegisterStub({});
  app = createApiServer({ db, rules, vatRegister, bankFeed: feed });
  appNoFeed = createApiServer({ db, rules, vatRegister }); // ingen bankFeed → 503

  const login = await request(app)
    .post('/api/auth/dev-login')
    .send({ email: 'bank@example.com', displayName: 'Bank' })
    .expect(200);
  token = login.body.token;
  const org = await request(app)
    .post('/api/organizations')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Bank AS', orgForm: 'AS', vatStatus: 'not_registered' })
    .expect(201);
  orgId = org.body.id;
  const acct = await request(app)
    .post(`/api/organizations/${orgId}/bank-accounts`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Driftskonto', ibanOrAccount: 'NO9386011117947' })
    .expect(201);
  bankAccountId = acct.body.id;
});

afterAll(async () => {
  await db.end();
});

describe('Bank-feed samtykkeflyt', () => {
  it('lister banker', async () => {
    const res = await request(app)
      .get(`/api/organizations/${orgId}/bank-feed/institutions?country=NO`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body[0]).toMatchObject({ id: 'DNB_DNBANOKK', name: 'DNB' });
  });

  it('connect lagrer requisition-ID og gir en samtykkelenke', async () => {
    const res = await request(app)
      .post(`/api/organizations/${orgId}/bank-accounts/${bankAccountId}/feed/connect`)
      .set('Authorization', `Bearer ${token}`)
      .send({ institutionId: 'DNB_DNBANOKK' })
      .expect(201);
    expect(res.body).toMatchObject({ requisitionId: 'req-1' });
    expect(res.body.link).toContain('req-1');
    expect(feed.lastReference).toBe(`${orgId}:${bankAccountId}`);
    const row = await db.query(`SELECT feed_requisition_id FROM bank_accounts WHERE id = $1`, [bankAccountId]);
    expect(row.rows[0].feed_requisition_id).toBe('req-1');
  });

  it('link lagrer konto-koblingen fra requisitionen', async () => {
    const res = await request(app)
      .post(`/api/organizations/${orgId}/bank-accounts/${bankAccountId}/feed/link`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);
    expect(res.body).toMatchObject({ linked: true, status: 'LN', connectionId: 'acc-1' });
    const row = await db.query(`SELECT feed_connection_id FROM bank_accounts WHERE id = $1`, [bankAccountId]);
    expect(row.rows[0].feed_connection_id).toBe('acc-1');
  });

  it('sync bruker lagret kobling og importerer transaksjoner', async () => {
    const res = await request(app)
      .post(`/api/organizations/${orgId}/bank-accounts/${bankAccountId}/feed/sync`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);
    expect(res.body).toMatchObject({ imported: 2, fetched: 2 });
    // idempotent: ny synk importerer 0
    const again = await request(app)
      .post(`/api/organizations/${orgId}/bank-accounts/${bankAccountId}/feed/sync`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);
    expect(again.body).toMatchObject({ imported: 0, skippedDuplicates: 2 });
  });

  it('sync på en ikke-koblet konto svarer 400 FEED_NOT_LINKED', async () => {
    const fresh = await request(app)
      .post(`/api/organizations/${orgId}/bank-accounts`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Ny konto', ibanOrAccount: 'NO9386011117123' })
      .expect(201);
    const res = await request(app)
      .post(`/api/organizations/${orgId}/bank-accounts/${fresh.body.id}/feed/sync`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400);
    expect(res.body.error.code).toBe('FEED_NOT_LINKED');
  });

  it('alle feed-endepunkt svarer 503 uten konfigurert feed', async () => {
    await request(appNoFeed)
      .get(`/api/organizations/${orgId}/bank-feed/institutions`)
      .set('Authorization', `Bearer ${token}`)
      .expect(503);
    await request(appNoFeed)
      .post(`/api/organizations/${orgId}/bank-accounts/${bankAccountId}/feed/sync`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(503);
  });
});
