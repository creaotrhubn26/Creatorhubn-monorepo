/**
 * Bankavstemmings-status mot ekte Postgres: «er du ferdig?»-signalet.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import { createBankAccount, importBankTransactions } from '../src/bank/import.js';
import { reconciliationStatus } from '../src/bank/reconciliation.js';
import { createOrganization, ensureUser } from '../src/orgs/service.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
let orgId: string;
let userId: string;
let accId: string;
const actor = () => ({ userId, role: 'owner' });

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  userId = await ensureUser(db, 'recon@example.com', 'Avstemmer');
  const org = await createOrganization(db, { name: 'Avstem AS', orgForm: 'AS', vatStatus: 'registered', createdByUserId: userId });
  orgId = org.id;
  accId = await createBankAccount(db, { organizationId: orgId, actor: actor(), name: 'Drift', ibanOrAccount: 'NO9386011117947' });
  await importBankTransactions(db, {
    organizationId: orgId,
    actor: actor(),
    bankAccountId: accId,
    transactions: [
      { externalId: 'a', bookedDate: '2026-06-01', amountMinor: -10000n, description: 'Strøm' },
      { externalId: 'b', bookedDate: '2026-06-02', amountMinor: 50000n, description: 'Innbetaling' },
    ],
  });
});

afterAll(async () => {
  await db.end();
});

describe('reconciliationStatus', () => {
  it('nye transaksjoner → ikke ferdig, teller uavstemte', async () => {
    const s = await reconciliationStatus(db, { organizationId: orgId });
    const acc = s.accounts.find((a) => a.bankAccountId === accId)!;
    expect(acc.total).toBe(2);
    expect(acc.unmatched).toBe(2);
    expect(acc.done).toBe(false);
    expect(s.allDone).toBe(false);
    expect(s.totalUnmatched).toBe(2);
  });

  it('alle behandlet (matchet + ignorert) → ferdig ✓', async () => {
    await db.query(`UPDATE bank_transactions SET status='matched' WHERE bank_account_id=$1 AND external_id='a'`, [accId]);
    await db.query(`UPDATE bank_transactions SET status='ignored' WHERE bank_account_id=$1 AND external_id='b'`, [accId]);
    const s = await reconciliationStatus(db, { organizationId: orgId });
    const acc = s.accounts.find((a) => a.bankAccountId === accId)!;
    expect(acc.matched).toBe(1);
    expect(acc.unmatched).toBe(0);
    expect(acc.done).toBe(true);
    expect(s.allDone).toBe(true);
  });
});
