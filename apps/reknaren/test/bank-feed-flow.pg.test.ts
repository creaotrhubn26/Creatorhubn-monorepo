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
  ConsentCompletion,
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
  lastCompletion?: ConsentCompletion;
  async completeConsent(p: ConsentCompletion): Promise<RequisitionAccounts> {
    this.lastCompletion = p;
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

describe('Bank-callback (redirect etter samtykke)', () => {
  let acctId: string;

  it('connect + callback mellomlagrer code → link plukker den opp uten manuell koding', async () => {
    const acct = await request(app)
      .post(`/api/organizations/${orgId}/bank-accounts`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Callback-konto', ibanOrAccount: 'NO9386011117456' })
      .expect(201);
    acctId = acct.body.id;
    // connect setter feed_requisition_id (kreves for at callback lagrer code-en)
    await request(app)
      .post(`/api/organizations/${orgId}/bank-accounts/${acctId}/feed/connect`)
      .set('Authorization', `Bearer ${token}`)
      .send({ institutionId: 'DNB_DNBANOKK' })
      .expect(201);

    // UAUTENTISERT redirect fra banken → HTML + mellomlagret code
    const cb = await request(app)
      .get('/bank/callback')
      .query({ code: 'consent-code-xyz', state: `${orgId}:${acctId}` })
      .expect(200);
    expect(cb.headers['content-type']).toContain('text/html');
    expect(cb.text).toContain('Banken er koblet');
    expect(cb.text).not.toContain('consent-code-xyz'); // code vises ikke når den er lagret
    const stored = await db.query(`SELECT feed_pending_code FROM bank_accounts WHERE id = $1`, [acctId]);
    expect(stored.rows[0].feed_pending_code).toBe('consent-code-xyz');

    // link uten body → bruker lagret code, og nullstiller den etterpå
    const link = await request(app)
      .post(`/api/organizations/${orgId}/bank-accounts/${acctId}/feed/link`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);
    expect(link.body).toMatchObject({ linked: true, connectionId: 'acc-1' });
    expect(feed.lastCompletion?.code).toBe('consent-code-xyz');
    const after = await db.query(
      `SELECT feed_connection_id, feed_pending_code FROM bank_accounts WHERE id = $1`,
      [acctId],
    );
    expect(after.rows[0].feed_connection_id).toBe('acc-1');
    expect(after.rows[0].feed_pending_code).toBeNull();
  });

  it('callback med error viser avbrutt-side og lagrer ingenting', async () => {
    const cb = await request(app)
      .get('/bank/callback')
      .query({ error: 'access_denied', state: `${orgId}:${acctId}` })
      .expect(200);
    expect(cb.text).toContain('Samtykket ble ikke fullført');
    expect(cb.text).toContain('access_denied');
  });

  it('callback med ukjent state lagrer ingenting, men viser code for manuell fullføring', async () => {
    const cb = await request(app)
      .get('/bank/callback')
      .query({ code: 'orphan-code', state: '00000000-0000-0000-0000-000000000000:11111111-1111-1111-1111-111111111111' })
      .expect(200);
    expect(cb.text).toContain('orphan-code'); // fallback: vis code til manuell liming
  });
});
