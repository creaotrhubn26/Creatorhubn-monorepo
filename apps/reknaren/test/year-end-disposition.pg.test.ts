/**
 * Egenkapital-disponering: årsresultatet flyttes til egenkapital ved
 * årsavslutning, UTEN å ødelegge det datofiltrerte resultatregnskapet.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import { postJournalEntry } from '../src/ledger/engine.js';
import { balanceSheet, incomeStatement } from '../src/ledger/reports.js';
import { executeYearEndClose } from '../src/ledger/year-end.js';
import { buildNaeringsspesifikasjon } from '../src/tax/naeringsspesifikasjon.js';
import { createOrganization, ensureUser } from '../src/orgs/service.js';
import { buildNorwegianRuleRegister } from '../src/rules/no/rules.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
let userId: string;
const rules = buildNorwegianRuleRegister();
const YEAR = 2025;
const FROM = `${YEAR}-01-01`;
const TO = `${YEAR}-12-31`;
const actor = () => ({ userId, role: 'owner' });

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

async function bal(orgId: string, account: string): Promise<bigint> {
  const r = await db.query(
    `SELECT COALESCE(SUM(debit_minor - credit_minor),0)::TEXT AS b
     FROM journal_lines WHERE organization_id=$1 AND account_number=$2`,
    [orgId, account],
  );
  return BigInt(r.rows[0].b);
}

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  userId = await ensureUser(db, 'disp@example.com', 'Disponeringstester');
});

afterAll(async () => {
  await db.end();
});

describe('egenkapital-disponering', () => {
  it('flytter årsresultat etter skatt til egenkapital, men resultatregnskapet er intakt', async () => {
    const org = await createOrganization(db, {
      name: 'Disp AS',
      orgForm: 'AS',
      vatStatus: 'registered',
      createdByUserId: userId,
    });
    await seedResult(org.id, 1000000n, 400000n); // res før skatt 600 000, skatt 132 000, etter skatt 468 000

    const receipt = await executeYearEndClose(db, rules, {
      organizationId: org.id,
      year: YEAR,
      orgForm: 'AS',
      actor: actor(),
    });
    expect(receipt.dispositionPosted).toBe(true);

    // Egenkapital (2050) er kreditert årsresultatet etter skatt.
    expect(await bal(org.id, '2050')).toBe(-468000n);

    // Resultatregnskapet for året viser FORTSATT ekte drift (avslutningsbilag ekskludert).
    const inc = await incomeStatement(db, { organizationId: org.id, fromDate: FROM, toDate: TO });
    expect(inc.revenueMinor).toBe(1000000n);
    expect(inc.resultMinor).toBe(468000n); // etter skattekostnad

    // I balansen er resultatkontoene nullet (inkl. avslutningsbilag) og resultatet ligger i egenkapitalen.
    const bs = await balanceSheet(db, { organizationId: org.id, toDate: TO });
    expect(bs.retainedResultMinor).toBe(0n);
    expect(bs.equityMinor).toBe(468000n);
  });

  it('er idempotent: ny avslutning dobbeltdisponerer ikke', async () => {
    const org = await createOrganization(db, {
      name: 'DispIdem AS',
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
    expect(second.dispositionPosted).toBe(false);
    expect(await bal(org.id, '2050')).toBe(-468000n); // fortsatt bare disponert én gang
  });

  it('underskudd: egenkapitalen debiteres (reduseres)', async () => {
    const org = await createOrganization(db, {
      name: 'DispTap AS',
      orgForm: 'AS',
      vatStatus: 'registered',
      createdByUserId: userId,
    });
    await seedResult(org.id, 200000n, 500000n); // underskudd 300 000, ingen skatt
    await executeYearEndClose(db, rules, { organizationId: org.id, year: YEAR, orgForm: 'AS', actor: actor() });
    expect(await bal(org.id, '2050')).toBe(300000n); // debetsaldo = redusert egenkapital
    const inc = await incomeStatement(db, { organizationId: org.id, fromDate: FROM, toDate: TO });
    expect(inc.resultMinor).toBe(-300000n); // resultatregnskapet viser fortsatt tapet
  });

  it('næringsspesifikasjonen balanserer, og årsresultatet er nå i egenkapitalen', async () => {
    const org = await createOrganization(db, {
      name: 'DispSpec AS',
      orgForm: 'AS',
      vatStatus: 'registered',
      createdByUserId: userId,
    });
    // Aksjekapital for en realistisk balanse.
    await postJournalEntry(db, {
      organizationId: org.id,
      actor: actor(),
      entryDate: `${YEAR}-01-02`,
      description: 'Aksjekapital',
      lines: [
        { accountNumber: '1920', debitMinor: 3000000n },
        { accountNumber: '2000', creditMinor: 3000000n },
      ],
      idempotencyKey: `ak:${org.id}`,
    });
    await seedResult(org.id, 1000000n, 400000n);

    const before = await buildNaeringsspesifikasjon(db, { organizationId: org.id, year: YEAR });
    expect(before.balanse.balanserer).toBe(true);

    await executeYearEndClose(db, rules, { organizationId: org.id, year: YEAR, orgForm: 'AS', actor: actor() });

    const after = await buildNaeringsspesifikasjon(db, { organizationId: org.id, year: YEAR });
    expect(after.balanse.balanserer).toBe(true);
    // Etter disponering er årets resultat flyttet inn i egenkapitalen (separat linje = 0).
    expect(after.balanse.aarsresultatTilEgenkapitalMinor).toBe(0n);
    // Egenkapital = aksjekapital 3 000 000 + årsresultat etter skatt 468 000.
    expect(after.balanse.egenkapital.sumMinor).toBe(3468000n);
    // Resultatregnskapet er uendret.
    expect(after.resultat.driftsinntekter.sumMinor).toBe(1000000n);
  });
});
