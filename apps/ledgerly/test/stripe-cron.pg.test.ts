/**
 * Hodeløs Stripe-cron mot ekte Postgres: token-autentisert endepunkt som
 * bootstrapper org + system-bruker og synker Stripe → kunde + utkast-faktura,
 * uten interaktiv innlogging.
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApiServer } from '../src/api/server.js';
import type { Db } from '../src/db/pool.js';
import { StaticStripeStub, type StripePaidInvoice } from '../src/integrations/stripe.js';
import { ensureBootstrapOrg, type BootstrapOrgConfig } from '../src/ops/bootstrap.js';
import { buildNorwegianRuleRegister } from '../src/rules/no/rules.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
let app: ReturnType<typeof createApiServer>;

const CRON_SECRET = 'test-cron-secret-abcdef1234567890';
const bootstrapOrg: BootstrapOrgConfig = {
  name: 'Creatorhub AS',
  orgNumber: '937518684',
  orgForm: 'AS',
  vatStatus: 'not_registered',
  systemUserEmail: 'system@ledgerly.local',
  systemUserName: 'Ledgerly System (cron)',
};

const invoice = (id: string, over: Partial<StripePaidInvoice> = {}): StripePaidInvoice => ({
  id,
  number: 'INV-' + id,
  hostedInvoiceUrl: 'https://invoice.stripe.com/' + id,
  stripeCustomerId: 'cus_' + id,
  customerName: 'Betaler ' + id,
  customerEmail: id + '@example.com',
  amountMinor: 29900n,
  currency: 'NOK',
  description: 'CreatorHub Pro',
  date: '2026-01-20',
  periodStart: null,
  periodEnd: null,
  lineItems: [],
  sourceProduct: 'creatorhub',
  ...over,
});

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  app = createApiServer({
    db,
    rules: buildNorwegianRuleRegister(),
    stripe: new StaticStripeStub([invoice('in_x'), invoice('in_y')]),
    cronSecret: CRON_SECRET,
    bootstrapOrg,
  });
});

afterAll(async () => {
  await db.end();
});

describe('POST /api/cron/stripe-sync (hodeløs)', () => {
  it('avviser uten/med feil cron-token (403)', async () => {
    await request(app).post('/api/cron/stripe-sync').expect(403);
    await request(app).post('/api/cron/stripe-sync').set('x-cron-secret', 'feil').expect(403);
  });

  it('bootstrapper org + synker Stripe med gyldig token', async () => {
    const res = await request(app)
      .post('/api/cron/stripe-sync')
      .set('x-cron-secret', CRON_SECRET)
      .expect(200);
    expect(res.body.createdOrg).toBe(true);
    expect(res.body.imported).toBe(2);
    expect(res.body.organizationId).toBeTruthy();

    // Org + system-bruker + kunder + utkast finnes nå.
    const orgs = await db.query(`SELECT id FROM organizations WHERE org_number = '937518684'`);
    expect(orgs.rowCount).toBe(1);
    const drafts = await db.query(`SELECT status FROM invoices`);
    expect(drafts.rowCount).toBe(2);
    expect(drafts.rows.every((r: { status: string }) => r.status === 'draft')).toBe(true);
  });

  it('payments-endepunktet viser HVEM som betalte + HVA de betalte for + Stripe-referanse', async () => {
    const orgId = (await db.query<{ id: string }>(`SELECT id FROM organizations WHERE org_number = '937518684'`)).rows[0]!.id;
    const login = await request(app)
      .post('/api/auth/dev-login')
      .send({ email: 'system@ledgerly.local', displayName: 'System' })
      .expect(200);
    const res = await request(app)
      .get(`/api/organizations/${orgId}/integrations/stripe/payments`)
      .set('Authorization', `Bearer ${login.body.token}`)
      .expect(200);
    expect(res.body.length).toBeGreaterThan(0);
    const p = res.body[0];
    expect(p.customer_name).toBeTruthy(); // HVEM
    expect(p.customer_email).toContain('@'); // HVEM
    expect(p.stripe_number).toBeTruthy(); // Stripe-referanse
    expect(Array.isArray(p.lines)).toBe(true); // HVA
    expect(p.lines[0].description).toBeTruthy();
    expect(p.lines[0].netMinor).toBeTruthy();
  });

  it('er idempotent: ny kjøring gjenoppretter ikke org og importerer ikke på nytt', async () => {
    const res = await request(app)
      .post('/api/cron/stripe-sync')
      .set('x-cron-secret', CRON_SECRET)
      .expect(200);
    expect(res.body.createdOrg).toBe(false);
    expect(res.body.imported).toBe(0);
    expect(res.body.alreadyImported).toBe(2);
  });
});

describe('ensureBootstrapOrg', () => {
  it('er idempotent på org.nr og e-post', async () => {
    const a = await ensureBootstrapOrg(db, bootstrapOrg);
    const b = await ensureBootstrapOrg(db, bootstrapOrg);
    expect(b.createdOrg).toBe(false);
    expect(b.orgId).toBe(a.orgId);
    expect(b.userId).toBe(a.userId);
  });

  it('seeder produktdimensjonene (tilgjengelig for kostnads-tagging uten Stripe-synk)', async () => {
    const { orgId } = await ensureBootstrapOrg(db, bootstrapOrg);
    const dims = await db.query<{ code: string }>(
      `SELECT code FROM projects WHERE organization_id = $1`,
      [orgId],
    );
    expect(dims.rows.map((r) => r.code)).toEqual(
      expect.arrayContaining(['CREATORHUB', 'ROLEROOM', 'LEADGRID']),
    );
  });
});
