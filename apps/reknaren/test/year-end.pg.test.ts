/**
 * Årsavslutning mot ekte Postgres: beregner skatt, bokfører skattekostnad for AS,
 * låser året, og er idempotent. ENK bokfører ingen skatt.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import { postJournalEntry } from '../src/ledger/engine.js';
import { computeYearEndPlan, executeYearEndClose } from '../src/ledger/year-end.js';
import { createOrganization, ensureUser } from '../src/orgs/service.js';
import { buildNorwegianRuleRegister } from '../src/rules/no/rules.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
let userId: string;
const rules = buildNorwegianRuleRegister();
const YEAR = 2025;
const actor = () => ({ userId, role: 'owner' });

/** Bokfører inntekt og kostnad så virksomheten får et resultat i året. */
async function seedResult(orgId: string, revenueMinor: bigint, expenseMinor: bigint) {
  await postJournalEntry(db, {
    organizationId: orgId,
    actor: actor(),
    entryDate: `${YEAR}-06-01`,
    description: 'Salg',
    lines: [
      { accountNumber: '1920', debitMinor: revenueMinor },
      { accountNumber: '3000', creditMinor: revenueMinor, vatCode: '3' },
    ],
    idempotencyKey: `rev:${orgId}`,
  });
  if (expenseMinor > 0n) {
    await postJournalEntry(db, {
      organizationId: orgId,
      actor: actor(),
      entryDate: `${YEAR}-06-02`,
      description: 'Kostnad',
      lines: [
        { accountNumber: '6800', debitMinor: expenseMinor, vatCode: '1' },
        { accountNumber: '2400', creditMinor: expenseMinor },
      ],
      idempotencyKey: `exp:${orgId}`,
    });
  }
}

async function accountBalance(orgId: string, account: string): Promise<bigint> {
  const r = await db.query(
    `SELECT COALESCE(SUM(debit_minor - credit_minor),0)::TEXT AS bal
     FROM journal_lines WHERE organization_id = $1 AND account_number = $2`,
    [orgId, account],
  );
  return BigInt(r.rows[0].bal);
}

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  userId = await ensureUser(db, 'arsavslutning@example.com', 'Årstester');
});

afterAll(async () => {
  await db.end();
});

describe('årsavslutning', () => {
  it('AS med overskudd: beregner 22 % skatt, bokfører 8300/2500, låser året', async () => {
    const org = await createOrganization(db, {
      name: 'Overskudd AS',
      orgForm: 'AS',
      vatStatus: 'registered',
      createdByUserId: userId,
    });
    await seedResult(org.id, 1000000n, 400000n); // resultat før skatt = 600 000 øre

    const plan = await computeYearEndPlan(db, rules, { organizationId: org.id, year: YEAR, orgForm: 'AS' });
    expect(plan.accountingResultMinor).toBe(600000n);
    expect(plan.taxRatePct).toBe('22');
    expect(plan.payableTaxMinor).toBe(132000n); // 22 % av 600 000
    expect(plan.taxEntry).not.toBeNull();
    expect(plan.resultAfterTaxMinor).toBe(468000n);
    expect(plan.fullyLocked).toBe(false);

    const receipt = await executeYearEndClose(db, rules, {
      organizationId: org.id,
      year: YEAR,
      orgForm: 'AS',
      actor: actor(),
    });
    expect(receipt.taxPosted).toBe(true);
    expect(receipt.payableTaxMinor).toBe(132000n);
    expect(receipt.lockedMonths).toHaveLength(12);

    // Skattekostnad ble debitert 8300 i skattebilaget (før disponeringen nuller det).
    const taxLine = await db.query(
      `SELECT l.debit_minor FROM journal_lines l JOIN journal_entries je ON je.id = l.entry_id
       WHERE je.organization_id = $1 AND je.idempotency_key = $2 AND l.account_number = '8300'`,
      [org.id, `year-end-tax:${YEAR}`],
    );
    expect(BigInt(taxLine.rows[0].debit_minor)).toBe(132000n);
    // Betalbar skatt (2500) er kreditert — dette er gjelden som skal betales.
    expect(await accountBalance(org.id, '2500')).toBe(-132000n);
    // Etter disponering er skattekostnaden (8300) nullet ut mot egenkapitalen.
    expect(await accountBalance(org.id, '8300')).toBe(0n);

    // Året er låst.
    const locked = await db.query(
      `SELECT COUNT(*)::int AS n FROM accounting_periods WHERE organization_id=$1 AND year=$2 AND status='locked'`,
      [org.id, YEAR],
    );
    expect(locked.rows[0].n).toBe(12);
  });

  it('er idempotent: ny avslutning dobbeltbokfører ikke skatt', async () => {
    const org = await createOrganization(db, {
      name: 'Idempotent AS',
      orgForm: 'AS',
      vatStatus: 'registered',
      createdByUserId: userId,
    });
    await seedResult(org.id, 1000000n, 400000n);
    await executeYearEndClose(db, rules, { organizationId: org.id, year: YEAR, orgForm: 'AS', actor: actor() });
    const second = await executeYearEndClose(db, rules, {
      organizationId: org.id,
      year: YEAR,
      orgForm: 'AS',
      actor: actor(),
    });
    expect(second.taxPosted).toBe(false);
    expect(second.dispositionPosted).toBe(false);
    expect(second.lockedMonths).toHaveLength(0);
    // Fortsatt bare én gang disponert: betalbar skatt (2500) er ikke dobbelt.
    expect(await accountBalance(org.id, '2500')).toBe(-132000n);
    // Egenkapitalen fikk årsresultatet etter skatt nøyaktig én gang.
    expect(await accountBalance(org.id, '2050')).toBe(-468000n);

    const plan = await computeYearEndPlan(db, rules, { organizationId: org.id, year: YEAR, orgForm: 'AS' });
    expect(plan.taxAlreadyPosted).toBe(true);
    expect(plan.accountingResultMinor).toBe(600000n); // viser fortsatt resultat FØR skatt
    expect(plan.fullyLocked).toBe(true);
  });

  it('ENK: ingen skattepostering, men året låses', async () => {
    const org = await createOrganization(db, {
      name: 'Enkel ENK',
      orgForm: 'ENK',
      vatStatus: 'registered',
      createdByUserId: userId,
    });
    await seedResult(org.id, 800000n, 200000n);
    const plan = await computeYearEndPlan(db, rules, { organizationId: org.id, year: YEAR, orgForm: 'ENK' });
    expect(plan.taxEntry).toBeNull();
    expect(plan.payableTaxMinor).toBe(0n);
    expect(plan.warnings.join(' ')).toContain('personlige skattemelding');

    const receipt = await executeYearEndClose(db, rules, {
      organizationId: org.id,
      year: YEAR,
      orgForm: 'ENK',
      actor: actor(),
    });
    expect(receipt.taxPosted).toBe(false);
    expect(receipt.lockedMonths).toHaveLength(12);
    expect(await accountBalance(org.id, '8300')).toBe(0n);
  });

  it('AS med underskudd: ingen skatt, advarsel om fremføring, låser likevel', async () => {
    const org = await createOrganization(db, {
      name: 'Underskudd AS',
      orgForm: 'AS',
      vatStatus: 'registered',
      createdByUserId: userId,
    });
    await seedResult(org.id, 200000n, 500000n); // underskudd
    const plan = await computeYearEndPlan(db, rules, { organizationId: org.id, year: YEAR, orgForm: 'AS' });
    expect(plan.accountingResultMinor).toBe(-300000n);
    expect(plan.payableTaxMinor).toBe(0n);
    expect(plan.taxEntry).toBeNull();
    expect(plan.warnings.join(' ')).toContain('fremføres');

    const receipt = await executeYearEndClose(db, rules, {
      organizationId: org.id,
      year: YEAR,
      orgForm: 'AS',
      actor: actor(),
    });
    expect(receipt.lockedMonths).toHaveLength(12);
    expect(await accountBalance(org.id, '8300')).toBe(0n);
  });
});
