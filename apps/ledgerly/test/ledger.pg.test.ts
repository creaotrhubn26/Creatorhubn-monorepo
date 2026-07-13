import fc from 'fast-check';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import { lockPeriod, postJournalEntry, reverseJournalEntry } from '../src/ledger/engine.js';
import { balanceSheet, incomeStatement, trialBalance } from '../src/ledger/reports.js';
import { createOrganization, ensureUser, isValidOrgNumber } from '../src/orgs/service.js';
import {
  PeriodLockedError,
  UnbalancedEntryError,
  ValidationError,
} from '../src/shared/errors.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
let orgId: string;
let userId: string;
const actor = () => ({ userId, role: 'owner' });

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  userId = await ensureUser(db, 'eier@example.com', 'Test Eier');
  const org = await createOrganization(db, {
    name: 'Testfoto ENK',
    orgForm: 'ENK',
    vatStatus: 'registered',
    createdByUserId: userId,
  });
  orgId = org.id;
});

afterAll(async () => {
  await db.end();
});

describe('Bokføringsmotor (ekte Postgres)', () => {
  it('organisasjonsnummer valideres med MOD11', () => {
    expect(isValidOrgNumber('923609016')).toBe(true); // Equinor ASA
    expect(isValidOrgNumber('923609017')).toBe(false);
    expect(isValidOrgNumber('12345678')).toBe(false);
  });

  it('bokfører balansert postering og gir løpende bilagsnummer', async () => {
    const entry = await postJournalEntry(db, {
      organizationId: orgId,
      actor: actor(),
      entryDate: '2025-11-05',
      description: 'Kjøp av kamerautstyr',
      idempotencyKey: 'test-entry-1',
      lines: [
        { accountNumber: '6551', debitMinor: 2000000n, vatCode: '1' },
        { accountNumber: '2710', debitMinor: 500000n, vatCode: '1' },
        { accountNumber: '2400', creditMinor: 2500000n },
      ],
    });
    expect(entry.entryNumber).toBe(1);
    expect(entry.alreadyExisted).toBe(false);
  });

  it('avviser ubalansert postering', async () => {
    await expect(
      postJournalEntry(db, {
        organizationId: orgId,
        actor: actor(),
        entryDate: '2025-11-06',
        description: 'Ubalansert',
        idempotencyKey: 'test-unbalanced',
        lines: [
          { accountNumber: '6551', debitMinor: 1000n },
          { accountNumber: '2400', creditMinor: 999n },
        ],
      }),
    ).rejects.toThrow(UnbalancedEntryError);
  });

  it('avviser postering mot ukjent konto og ukjent mva-kode', async () => {
    await expect(
      postJournalEntry(db, {
        organizationId: orgId,
        actor: actor(),
        entryDate: '2025-11-06',
        description: 'Ukjent konto',
        idempotencyKey: 'test-unknown-account',
        lines: [
          { accountNumber: '9999', debitMinor: 1000n },
          { accountNumber: '2400', creditMinor: 1000n },
        ],
      }),
    ).rejects.toThrow(/finnes ikke/);
    await expect(
      postJournalEntry(db, {
        organizationId: orgId,
        actor: actor(),
        entryDate: '2025-11-06',
        description: 'Ukjent mva-kode',
        idempotencyKey: 'test-unknown-vat',
        lines: [
          { accountNumber: '6551', debitMinor: 1000n, vatCode: '99' },
          { accountNumber: '2400', creditMinor: 1000n },
        ],
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('idempotens: samme nøkkel bokføres nøyaktig én gang', async () => {
    const first = await postJournalEntry(db, {
      organizationId: orgId,
      actor: actor(),
      entryDate: '2025-11-07',
      description: 'Idempotent',
      idempotencyKey: 'external-event-42',
      lines: [
        { accountNumber: '6800', debitMinor: 10000n },
        { accountNumber: '1920', creditMinor: 10000n },
      ],
    });
    const second = await postJournalEntry(db, {
      organizationId: orgId,
      actor: actor(),
      entryDate: '2025-11-07',
      description: 'Idempotent (gjentak)',
      idempotencyKey: 'external-event-42',
      lines: [
        { accountNumber: '6800', debitMinor: 10000n },
        { accountNumber: '1920', creditMinor: 10000n },
      ],
    });
    expect(second.alreadyExisted).toBe(true);
    expect(second.id).toBe(first.id);
    const count = await db.query(
      `SELECT count(*)::int AS n FROM journal_entries WHERE organization_id = $1 AND idempotency_key = 'external-event-42'`,
      [orgId],
    );
    expect(count.rows[0].n).toBe(1);
  });

  it('databasen nekter UPDATE og DELETE på bokførte posteringer (forsvar i dybden)', async () => {
    await expect(
      db.query(`UPDATE journal_lines SET debit_minor = 1 WHERE organization_id = $1`, [orgId]),
    ).rejects.toThrow(/append-only/);
    await expect(
      db.query(`DELETE FROM journal_entries WHERE organization_id = $1`, [orgId]),
    ).rejects.toThrow(/append-only|kan ikke endres/);
    await expect(
      db.query(`UPDATE journal_entries SET description = 'hacket' WHERE organization_id = $1`, [orgId]),
    ).rejects.toThrow(/kan ikke endres/);
    await expect(db.query(`DELETE FROM audit_events WHERE organization_id = $1`, [orgId])).rejects.toThrow(
      /append-only/,
    );
  });

  it('låst periode avviser nye posteringer', async () => {
    await lockPeriod(db, {
      organizationId: orgId,
      actor: actor(),
      year: 2025,
      month: 10,
      reason: 'Terminavslutning',
    });
    await expect(
      postJournalEntry(db, {
        organizationId: orgId,
        actor: actor(),
        entryDate: '2025-10-15',
        description: 'I låst periode',
        idempotencyKey: 'locked-period-attempt',
        lines: [
          { accountNumber: '6800', debitMinor: 1000n },
          { accountNumber: '1920', creditMinor: 1000n },
        ],
      }),
    ).rejects.toThrow(PeriodLockedError);
  });

  it('reversering nuller ut originalen og bevarer historikken', async () => {
    const original = await postJournalEntry(db, {
      organizationId: orgId,
      actor: actor(),
      entryDate: '2025-11-10',
      description: 'Feilført kostnad',
      idempotencyKey: 'to-be-reversed',
      lines: [
        { accountNumber: '7790', debitMinor: 50000n },
        { accountNumber: '1920', creditMinor: 50000n },
      ],
    });
    const before = await trialBalance(db, { organizationId: orgId });
    const acc7790Before = before.find((r) => r.accountNumber === '7790')!.balanceMinor;

    const reversal = await reverseJournalEntry(db, {
      organizationId: orgId,
      actor: actor(),
      entryId: original.id,
      reversalDate: '2025-11-11',
      reason: 'Bilaget gjaldt privat kjøp',
    });
    expect(reversal.id).not.toBe(original.id);

    const after = await trialBalance(db, { organizationId: orgId });
    const acc7790After = after.find((r) => r.accountNumber === '7790')!.balanceMinor;
    expect(acc7790After).toBe(acc7790Before - 50000n);

    // Originalen finnes fortsatt, merket reversert.
    const orig = await db.query(`SELECT status FROM journal_entries WHERE id = $1`, [original.id]);
    expect(orig.rows[0].status).toBe('reversed');
    // Dobbel reversering avvises.
    await expect(
      reverseJournalEntry(db, {
        organizationId: orgId,
        actor: actor(),
        entryId: original.id,
        reversalDate: '2025-11-12',
        reason: 'igjen',
      }),
    ).rejects.toThrow(/allerede reversert/);
  });

  it('reversering krever begrunnelse', async () => {
    await expect(
      reverseJournalEntry(db, {
        organizationId: orgId,
        actor: actor(),
        entryId: '00000000-0000-0000-0000-000000000000',
        reversalDate: '2025-11-11',
        reason: '  ',
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('property: vilkårlige balanserte posteringer holder saldobalansen i balanse', async () => {
    const expenseAccounts = ['4000', '6300', '6551', '6800', '7140', '7790'];
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            account: fc.constantFrom(...expenseAccounts),
            amount: fc.bigInt({ min: 1n, max: 10_000_000n }),
          }),
          { minLength: 1, maxLength: 6 },
        ),
        fc.integer({ min: 1, max: 28 }),
        async (parts, day) => {
          const total = parts.reduce((acc, p) => acc + p.amount, 0n);
          await postJournalEntry(db, {
            organizationId: orgId,
            actor: actor(),
            entryDate: `2025-12-${String(day).padStart(2, '0')}`,
            description: 'Property-test',
            idempotencyKey: `prop-${Math.random().toString(36).slice(2)}`,
            lines: [
              ...parts.map((p) => ({ accountNumber: p.account, debitMinor: p.amount })),
              { accountNumber: '2400', creditMinor: total },
            ],
          });
          const rows = await trialBalance(db, { organizationId: orgId });
          const debit = rows.reduce((acc, r) => acc + r.debitMinor, 0n);
          const credit = rows.reduce((acc, r) => acc + r.creditMinor, 0n);
          expect(debit).toBe(credit);
        },
      ),
      { numRuns: 15 },
    );
  });

  it('resultat og balanse henger sammen: eiendeler = gjeld + EK + resultat', async () => {
    const pnl = await incomeStatement(db, { organizationId: orgId });
    const bs = await balanceSheet(db, { organizationId: orgId });
    expect(bs.assetsMinor).toBe(bs.liabilitiesMinor + bs.equityMinor + bs.retainedResultMinor);
    expect(bs.retainedResultMinor).toBe(pnl.resultMinor);
  });
});
