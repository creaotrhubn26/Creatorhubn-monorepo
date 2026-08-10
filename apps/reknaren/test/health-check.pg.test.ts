/**
 * Regnskapshelse-motoren mot ekte Postgres: flagger reelle problemer i plain-språk.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import { createBankAccount, importBankTransactions } from '../src/bank/import.js';
import { runHealthCheck } from '../src/ledger/health-check.js';
import { postJournalEntry } from '../src/ledger/engine.js';
import { createOrganization, ensureUser } from '../src/orgs/service.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
let userId: string;
const ASOF = '2026-06-15';
const actor = () => ({ userId, role: 'owner' });
const ids = (r: { issues: { id: string }[] }) => r.issues.map((i) => i.id);

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  userId = await ensureUser(db, 'helse@example.com', 'Helsetester');
});

afterAll(async () => {
  await db.end();
});

describe('runHealthCheck', () => {
  it('ren, MVA-registrert virksomhet uten data → ingen feil, positiv okCount', async () => {
    const org = await createOrganization(db, {
      name: 'Ren AS',
      orgForm: 'AS',
      vatStatus: 'registered',
      createdByUserId: userId,
    });
    const r = await runHealthCheck(db, { organizationId: org.id, asOf: ASOF });
    expect(r.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
    expect(r.okCount).toBeGreaterThan(0);
  });

  it('uavstemte banktransaksjoner → info-flagg med hurtigknapp til bank', async () => {
    const org = await createOrganization(db, {
      name: 'Bank AS',
      orgForm: 'AS',
      vatStatus: 'registered',
      createdByUserId: userId,
    });
    const acc = await createBankAccount(db, {
      organizationId: org.id,
      actor: actor(),
      name: 'Drift',
      ibanOrAccount: 'NO9386011117947',
    });
    await importBankTransactions(db, {
      organizationId: org.id,
      actor: actor(),
      bankAccountId: acc,
      transactions: [
        { externalId: 'x1', bookedDate: '2026-06-01', amountMinor: -12345n, description: 'Strøm' },
      ],
    });
    const r = await runHealthCheck(db, { organizationId: org.id, asOf: ASOF });
    const bank = r.issues.find((i) => i.id === 'bank_unmatched');
    expect(bank).toBeDefined();
    expect(bank!.actionScreen).toBe('bank');
    expect(bank!.detail).toContain('banken');
  });

  it('uregistrert virksomhet over 50 000 kr → error om MVA-registreringsplikt', async () => {
    const org = await createOrganization(db, {
      name: 'Terskel ENK',
      orgForm: 'ENK',
      vatStatus: 'not_registered',
      createdByUserId: userId,
    });
    await postJournalEntry(db, {
      organizationId: org.id,
      actor: actor(),
      entryDate: '2026-03-01',
      description: 'Salg',
      idempotencyKey: 'h-sale',
      lines: [
        { accountNumber: '1500', debitMinor: 6_000_000n },
        { accountNumber: '3000', creditMinor: 6_000_000n },
      ],
    });
    const r = await runHealthCheck(db, { organizationId: org.id, asOf: ASOF });
    expect(ids(r)).toContain('vat_threshold_crossed');
    const crossed = r.issues.find((i) => i.id === 'vat_threshold_crossed')!;
    expect(crossed.severity).toBe('error');
    expect(crossed.actionScreen).toBe('vat');
  });
});
