/**
 * Registrer kjøp for ENK uten MVA: delt privat/næringsbruk + fradragsberegning.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import { createOrganization, ensureUser } from '../src/orgs/service.js';
import { buildNorwegianRuleRegister } from '../src/rules/no/rules.js';
import { registerPurchase } from '../src/tax/purchase.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
let userId: string;
const rules = buildNorwegianRuleRegister();

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  userId = await ensureUser(db, 'kjop@example.com', 'Kjøpstester');
});
afterAll(async () => { await db.end(); });

describe('registerPurchase (ENK uten MVA)', () => {
  it('bokfører hele beløpet ved 100 % næringsbruk (betalt privat)', async () => {
    const org = await createOrganization(db, { name: 'Kjøp ENK', orgForm: 'ENK', vatStatus: 'not_registered', createdByUserId: userId });
    const r = await registerPurchase(db, rules, {
      organizationId: org.id, orgForm: 'ENK', actor: { userId, role: 'owner' },
      amountMinor: 100_000n, description: 'Programvare', accountNumber: '6551',
      paidPrivately: true, date: '2026-05-01',
    });
    expect(r.businessAmountMinor).toBe(100_000n);
    expect(r.privateAmountMinor).toBe(0n);
  });

  it('deler kostnaden: 60 % næring bokføres, 40 % privat ekskluderes', async () => {
    const org = await createOrganization(db, { name: 'Delt ENK', orgForm: 'ENK', vatStatus: 'not_registered', createdByUserId: userId });
    const r = await registerPurchase(db, rules, {
      organizationId: org.id, orgForm: 'ENK', actor: { userId, role: 'owner' },
      amountMinor: 100_000n, description: 'Mobil (delvis privat)', accountNumber: '6551',
      paidPrivately: false, date: '2026-05-02', businessSharePct: 60,
    });
    expect(r.businessAmountMinor).toBe(60_000n);
    expect(r.privateAmountMinor).toBe(40_000n);
    // Bank-betaling → hovedboken må balansere: 60k kostnad + 40k privat uttak = 100k ut av bank.
    const bal = (await db.query(
      `SELECT COALESCE(SUM(debit_minor),0)::text AS d, COALESCE(SUM(credit_minor),0)::text AS c
       FROM journal_lines WHERE entry_id = $1`, [r.entryId],
    )).rows[0];
    expect(bal.d).toBe(bal.c);
  });
});
