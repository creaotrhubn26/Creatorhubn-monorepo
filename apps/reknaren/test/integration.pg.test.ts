/**
 * Integrasjon: kjører ÉN virksomhet gjennom flere funksjoner og sjekker at de
 * deler samme hovedbok og at tallene stemmer på tvers — «funker alt sømløst?».
 *
 * Flyt: bank-betaling uten bilag → dokumentjakt finner sannsynlig faktura →
 * kobling bokfører + avstemmer → samme postering vises i hovedbok/resultat,
 * forsvinner fra månedsavslutningens gap, og skatt/prognose/assistent leser
 * konsistent av samme data.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import { createBankAccount, importBankTransactions } from '../src/bank/import.js';
import { postJournalEntry } from '../src/ledger/engine.js';
import { huntDocuments, linkPaymentToDocument } from '../src/ingestion/document-hunt.js';
import { assessPeriodClose } from '../src/ledger/period-close.js';
import { buildForecast } from '../src/ledger/planning.js';
import { buildTaxAdvisories } from '../src/ledger/tax-advisor.js';
import { detectBookkeepingErrors } from '../src/ledger/anomalies.js';
import { balanceSheet, incomeStatement } from '../src/ledger/reports.js';
import { computeYearEndPlan } from '../src/ledger/year-end.js';
import { buildNaeringsspesifikasjon } from '../src/tax/naeringsspesifikasjon.js';
import { createOrganization, ensureUser } from '../src/orgs/service.js';
import { buildNorwegianRuleRegister } from '../src/rules/no/rules.js';
import { newId } from '../src/shared/ids.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
let userId: string;
const rules = buildNorwegianRuleRegister();
const YEAR = 2025;
const actor = () => ({ userId, role: 'owner' });

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  userId = await ensureUser(db, 'integrasjon@example.com', 'Integrasjonstester');
});

afterAll(async () => {
  await db.end();
});

describe('kryss-funksjonell integrasjon', () => {
  it('dokumentjakt → kobling → hovedbok → månedsavslutning → skatt/prognose/assistent, alt konsistent', async () => {
    const org = await createOrganization(db, { name: 'Sømløs AS', orgForm: 'AS', vatStatus: 'registered', createdByUserId: userId });

    // Litt inntekt (bank inn) så det er et resultat å skatte av.
    await postJournalEntry(db, {
      organizationId: org.id, actor: actor(), entryDate: `${YEAR}-07-02`, description: 'Salg',
      lines: [
        { accountNumber: '1920', debitMinor: 25000000n },
        { accountNumber: '3000', creditMinor: 20000000n, vatCode: '3' },
        { accountNumber: '2700', creditMinor: 5000000n, vatCode: '3' },
      ],
      idempotencyKey: 'salg',
    });

    // Bank-utbetaling uten bilag + en sannsynlig faktura hentet fra e-post.
    const acc = await createBankAccount(db, { organizationId: org.id, actor: actor(), name: 'Drift', ibanOrAccount: 'NO9386011117947' });
    await importBankTransactions(db, {
      organizationId: org.id, actor: actor(), bankAccountId: acc,
      transactions: [{ externalId: 't-adobe', bookedDate: `${YEAR}-07-17`, amountMinor: -124900n, description: 'ADOBE SYSTEMS SOFTWARE' }],
    });
    const docId = newId();
    await db.query(
      `INSERT INTO source_documents (id, organization_id, source, filename, mime_type, byte_size, sha256, storage_key, status, created_by)
       VALUES ($1,$2,'gmail','adobe.pdf','application/pdf',100,$3,$4,'extracted',$5)`,
      [docId, org.id, newId(), `k/${docId}`, userId],
    );
    await db.query(
      `INSERT INTO extracted_document_data (id, document_id, organization_id, document_type, vendor_name, invoice_date, currency, gross_minor)
       VALUES ($1,$2,$3,'supplier_invoice','Adobe Systems Software AS',$4,'NOK',124900)`,
      [newId(), docId, org.id, `${YEAR}-07-14`],
    );

    // 1) Dokumentjakt finner gapet med kandidat.
    const hunt = await huntDocuments(db, { organizationId: org.id, asOf: `${YEAR}-08-01` });
    expect(hunt.gapsWithCandidates).toBe(1);
    const txId = hunt.gaps[0]!.transactionId;

    // 2) Kobling bokfører + avstemmer.
    const link = await linkPaymentToDocument(db, rules, { organizationId: org.id, actor: actor(), transactionId: txId, documentId: docId });
    expect(link.entryNumber).toBeGreaterThan(0);

    // 3) Samme postering vises i hovedbok/resultat (kostnaden er nå med).
    const inc = await incomeStatement(db, { organizationId: org.id, fromDate: `${YEAR}-01-01`, toDate: `${YEAR}-12-31` });
    expect(inc.revenueMinor).toBe(20000000n);
    expect(inc.expenseMinor).toBe(124900n); // Adobe-kostnaden
    const bs = await balanceSheet(db, { organizationId: org.id, toDate: `${YEAR}-12-31` });
    // Balanse-identiteten holder: eiendeler = gjeld + EK + tilbakeholdt resultat.
    expect(bs.assetsMinor).toBe(bs.liabilitiesMinor + bs.equityMinor + bs.retainedResultMinor);

    // 4) Månedsavslutning: transaksjonen er ikke lenger et uavstemt gap.
    const close = await assessPeriodClose(db, rules, { organizationId: org.id, year: YEAR, month: 7 });
    expect(close.items.map((i) => i.code)).not.toContain('bank_uavstemt');

    // 5) Dokumentjakt igjen: gapet er borte.
    const hunt2 = await huntDocuments(db, { organizationId: org.id, asOf: `${YEAR}-08-01` });
    expect(hunt2.gapsWithCandidates).toBe(0);

    // 6) Skatt, prognose, assistent, feil-deteksjon, årsavslutning og
    //    næringsspesifikasjon leser ALLE av samme hovedbok uten å krasje.
    const advisories = await buildTaxAdvisories(db, rules, { organizationId: org.id, orgForm: 'AS', asOf: `${YEAR}-08-01` });
    expect(advisories.advisories.length).toBeGreaterThan(0);
    const forecast = await buildForecast(db, rules, { organizationId: org.id, orgForm: 'AS', asOf: `${YEAR}-08-01` });
    expect(forecast.cashNowMinor).toBeGreaterThan(0n);
    const errors = await detectBookkeepingErrors(db, rules, { organizationId: org.id, fromDate: `${YEAR}-01-01`, toDate: `${YEAR}-12-31` });
    expect(Array.isArray(errors.errors)).toBe(true);

    // 7) Årsavslutning ser samme resultat, og næringsspesifikasjonen balanserer.
    const plan = await computeYearEndPlan(db, rules, { organizationId: org.id, year: YEAR, orgForm: 'AS' });
    expect(plan.accountingResultMinor).toBe(inc.resultMinor); // 20 000 000 − 124 900
    const spec = await buildNaeringsspesifikasjon(db, { organizationId: org.id, year: YEAR });
    expect(spec.balanse.balanserer).toBe(true);
  });
});
