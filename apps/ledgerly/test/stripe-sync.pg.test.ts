/**
 * Stripe → regnskap-synk mot ekte Postgres: betalte fakturaer → kunde-upsert +
 * UTKAST-salgsfaktura (ikke bokført) + idempotens.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import { StaticStripeStub, type StripePaidInvoice } from '../src/integrations/stripe.js';
import { syncStripeRevenue } from '../src/integrations/stripe-sync.js';
import { createOrganization, ensureUser } from '../src/orgs/service.js';
import { buildNorwegianRuleRegister } from '../src/rules/no/rules.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
let orgId: string;
let userId: string;
const rules = buildNorwegianRuleRegister();

function inv(over: Partial<StripePaidInvoice> & { id: string }): StripePaidInvoice {
  return {
    stripeCustomerId: 'cus_' + over.id,
    customerName: 'Kunde ' + over.id,
    customerEmail: over.id + '@example.com',
    amountMinor: 49900n,
    currency: 'NOK',
    description: 'Leadgrid Solo Pro',
    date: '2026-01-15',
    sourceProduct: 'leadgrid',
    ...over,
  };
}

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  userId = await ensureUser(db, 'stripe-synk@example.com', 'Synktester');
  const org = await createOrganization(db, {
    name: 'Creatorhub AS',
    orgForm: 'AS',
    vatStatus: 'not_registered',
    orgNumber: '937518684',
    createdByUserId: userId,
  });
  orgId = org.id;
});

afterAll(async () => {
  await db.end();
});

const opts = () => ({ organizationId: orgId, actor: { userId, role: 'owner' } });

describe('Stripe-inntektssynk', () => {
  it('registrerer betalende kunder + utkast-salgsfaktura, hopper ærlig over ikke-NOK', async () => {
    const stub = new StaticStripeStub([
      inv({ id: 'in_a' }),
      inv({ id: 'in_b', customerEmail: 'delt@example.com' }),
      inv({ id: 'in_usd', currency: 'USD', amountMinor: 1000n }),
    ]);
    const r = await syncStripeRevenue(db, rules, stub, opts());
    expect(r.imported).toBe(2);
    expect(r.skippedCurrency).toBe(1);
    expect(r.customersCreated).toBe(2);
    expect(r.draftInvoiceIds).toHaveLength(2);
    expect(r.reviewNote).toMatch(/fagkontrolleres/);

    // Utkast-fakturaene finnes og er IKKE bokført (ingen journal_entry_id).
    const drafts = await db.query<{ status: string; journal_entry_id: string | null; net_minor: string }>(
      `SELECT status, journal_entry_id, net_minor FROM invoices WHERE organization_id = $1 ORDER BY created_at`,
      [orgId],
    );
    expect(drafts.rows).toHaveLength(2);
    for (const row of drafts.rows) {
      expect(row.status).toBe('draft');
      expect(row.journal_entry_id).toBeNull();
      expect(row.net_minor).toBe('49900'); // ordrett fra Stripe, ingen mva (kode 7)
    }

    // Importene er registrert (idempotens-anker), inkl. den valuta-hoppede.
    const imports = await db.query<{ status: string }>(
      `SELECT status FROM stripe_imports WHERE organization_id = $1`,
      [orgId],
    );
    expect(imports.rows).toHaveLength(3);
    expect(imports.rows.filter((r) => r.status === 'skipped_currency')).toHaveLength(1);
  });

  it('er idempotent: ny kjøring importerer ingenting på nytt', async () => {
    const stub = new StaticStripeStub([inv({ id: 'in_a' }), inv({ id: 'in_b', customerEmail: 'delt@example.com' })]);
    const r = await syncStripeRevenue(db, rules, stub, opts());
    expect(r.imported).toBe(0);
    expect(r.alreadyImported).toBe(2);
    // Fortsatt bare 2 utkast totalt.
    const count = await db.query<{ n: string }>(`SELECT count(*)::text n FROM invoices WHERE organization_id = $1`, [orgId]);
    expect(count.rows[0]!.n).toBe('2');
  });

  it('gjenbruker eksisterende kunde ved samme e-post', async () => {
    const before = await db.query<{ n: string }>(`SELECT count(*)::text n FROM customers WHERE organization_id = $1`, [orgId]);
    // Ny faktura til en e-post som allerede har en kunde (delt@example.com).
    const stub = new StaticStripeStub([inv({ id: 'in_c', customerEmail: 'delt@example.com' })]);
    const r = await syncStripeRevenue(db, rules, stub, opts());
    expect(r.imported).toBe(1);
    expect(r.customersCreated).toBe(0); // ingen ny kunde
    const after = await db.query<{ n: string }>(`SELECT count(*)::text n FROM customers WHERE organization_id = $1`, [orgId]);
    expect(after.rows[0]!.n).toBe(before.rows[0]!.n);
  });

  it('uten Stripe-nøkkel kaster synken (ærlig inaktiv)', async () => {
    const stub = new StaticStripeStub([], { hasApiKey: false });
    await expect(syncStripeRevenue(db, rules, stub, opts())).rejects.toThrow();
  });
});
