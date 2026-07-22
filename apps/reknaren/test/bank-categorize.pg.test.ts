/**
 * Guidet kontering av banklinjer uten bilag mot ekte Postgres — riktig dobbeltpostering
 * (ENK vs AS), retnings-/formkontroll, idempotens.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import { createBankAccount, importBankTransactions } from '../src/bank/import.js';
import { categorizeBankTransaction } from '../src/bank/categorize.js';
import { createOrganization, ensureUser } from '../src/orgs/service.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
let userId: string;
const actor = () => ({ userId, role: 'owner' });

async function orgWithAccount(name: string, orgForm: 'ENK' | 'AS') {
  const org = await createOrganization(db, { name, orgForm, vatStatus: 'registered', createdByUserId: userId });
  const acc = await createBankAccount(db, { organizationId: org.id, actor: actor(), name: 'Drift', ibanOrAccount: 'NO9386011117947' });
  return { orgId: org.id, acc };
}
async function importTx(orgId: string, acc: string, externalId: string, amountMinor: bigint) {
  await importBankTransactions(db, {
    organizationId: orgId,
    actor: actor(),
    bankAccountId: acc,
    transactions: [{ externalId, bookedDate: '2026-06-01', amountMinor, description: 'Bevegelse' }],
  });
  return (await db.query(`SELECT id FROM bank_transactions WHERE organization_id=$1 AND external_id=$2`, [orgId, externalId])).rows[0].id as string;
}
async function line(orgId: string, account: string) {
  const r = await db.query(
    `SELECT COALESCE(SUM(debit_minor),0)::TEXT AS d, COALESCE(SUM(credit_minor),0)::TEXT AS c
     FROM journal_lines WHERE organization_id=$1 AND account_number=$2`,
    [orgId, account],
  );
  return { debit: BigInt(r.rows[0].d), credit: BigInt(r.rows[0].c) };
}

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  userId = await ensureUser(db, 'kat@example.com', 'Konterer');
});

afterAll(async () => {
  await db.end();
});

describe('categorizeBankTransaction', () => {
  it('bankgebyr (ut) → DR 7770 / KR bank 1920, transaksjon matchet', async () => {
    const { orgId, acc } = await orgWithAccount('Gebyr AS', 'AS');
    const tx = await importTx(orgId, acc, 'g1', -5000n); // 50 kr ut
    const r = await categorizeBankTransaction(db, { organizationId: orgId, actor: actor(), transactionId: tx, category: 'bankgebyr' });
    expect(r.entryNumber).toBeGreaterThan(0);
    expect(await line(orgId, '7770')).toEqual({ debit: 5000n, credit: 0n });
    expect(await line(orgId, '1920')).toEqual({ debit: 0n, credit: 5000n });
    const st = (await db.query(`SELECT status FROM bank_transactions WHERE id=$1`, [tx])).rows[0].status;
    expect(st).toBe('matched');
  });

  it('renteinntekt (inn) → DR bank 1920 / KR 8050', async () => {
    const { orgId, acc } = await orgWithAccount('Rente AS', 'AS');
    const tx = await importTx(orgId, acc, 'r1', 1234n); // inn
    await categorizeBankTransaction(db, { organizationId: orgId, actor: actor(), transactionId: tx, category: 'renteinntekt' });
    expect(await line(orgId, '1920')).toEqual({ debit: 1234n, credit: 0n });
    expect(await line(orgId, '8050')).toEqual({ debit: 0n, credit: 1234n });
  });

  it('skatt kontoføres ulikt for ENK (2060 privatuttak) og AS (2500 betalbar skatt)', async () => {
    const enk = await orgWithAccount('Skatt ENK', 'ENK');
    const txE = await importTx(enk.orgId, enk.acc, 's1', -100000n);
    await categorizeBankTransaction(db, { organizationId: enk.orgId, actor: actor(), transactionId: txE, category: 'skatt' });
    expect((await line(enk.orgId, '2060')).debit).toBe(100000n);

    const as = await orgWithAccount('Skatt AS', 'AS');
    const txA = await importTx(as.orgId, as.acc, 's2', -100000n);
    await categorizeBankTransaction(db, { organizationId: as.orgId, actor: actor(), transactionId: txA, category: 'skatt' });
    expect((await line(as.orgId, '2500')).debit).toBe(100000n);
  });

  it('avviser feil retning og form + dobbelkontering', async () => {
    const { orgId, acc } = await orgWithAccount('Feil AS', 'AS');
    const inn = await importTx(orgId, acc, 'f1', 5000n);
    // «bankgebyr» er en utbetaling — passer ikke en innbetaling
    await expect(
      categorizeBankTransaction(db, { organizationId: orgId, actor: actor(), transactionId: inn, category: 'bankgebyr' }),
    ).rejects.toThrow(/innbetaling|utbetaling/);
    // privatuttak gjelder kun ENK
    const ut = await importTx(orgId, acc, 'f2', -5000n);
    await expect(
      categorizeBankTransaction(db, { organizationId: orgId, actor: actor(), transactionId: ut, category: 'privatuttak' }),
    ).rejects.toThrow(/ENK|organisasjonsform/);
    // kontér én gang, så feiler den andre
    await categorizeBankTransaction(db, { organizationId: orgId, actor: actor(), transactionId: ut, category: 'bankgebyr' });
    await expect(
      categorizeBankTransaction(db, { organizationId: orgId, actor: actor(), transactionId: ut, category: 'bankgebyr' }),
    ).rejects.toThrow(/allerede avstemt/);
  });
});
