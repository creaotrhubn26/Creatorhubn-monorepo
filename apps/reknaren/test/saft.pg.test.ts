/**
 * SAF-T-eksport mot ekte Postgres: velformet XML, totaler som stemmer med
 * hovedboken, escaping av spesialtegn, reskontro og mva-koder inkludert.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import { createInvoiceDraft, issueInvoice } from '../src/invoicing/service.js';
import { postJournalEntry } from '../src/ledger/engine.js';
import { createOrganization, ensureUser } from '../src/orgs/service.js';
import { buildNorwegianRuleRegister } from '../src/rules/no/rules.js';
import { buildSafTXml } from '../src/saft/export.js';
import { newId } from '../src/shared/ids.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
let orgId: string;
let userId: string;
const rules = buildNorwegianRuleRegister();
const actor = () => ({ userId, role: 'owner' });

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  userId = await ensureUser(db, 'saft@example.com', 'SAF-T-tester');
  const org = await createOrganization(db, {
    name: 'Söta & Bråten <AS>', // spesialtegn med vilje
    orgForm: 'AS',
    vatStatus: 'registered',
    orgNumber: '910015842',
    streetAddress: 'Bråtenveien 3 & 5', // spesialtegn med vilje
    postalCode: '7030',
    city: 'Trondheim',
    createdByUserId: userId,
  });
  orgId = org.id;

  // Kostnadsbilag i oktober (inngående saldo-grunnlag)...
  await postJournalEntry(db, {
    organizationId: orgId,
    actor: actor(),
    entryDate: '2025-10-15',
    description: 'Kjøp av "utstyr" & rekvisita',
    idempotencyKey: 'saft-oct',
    lines: [
      { accountNumber: '6551', debitMinor: 800000n, vatCode: '1' },
      { accountNumber: '2710', debitMinor: 200000n, vatCode: '1' },
      { accountNumber: '2400', creditMinor: 1000000n },
    ],
  });
  // ...og en utstedt faktura i november (perioden som eksporteres).
  const customerId = newId();
  await db.query(
    `INSERT INTO customers (id, organization_id, name, org_number, created_by)
     VALUES ($1,$2,'Kunde & Co',$3,$4)`,
    [customerId, orgId, '923609016', userId],
  );
  const draft = await createInvoiceDraft(db, rules, {
    organizationId: orgId,
    actor: actor(),
    customerId,
    invoiceDate: '2025-11-05',
    lines: [
      { description: 'Rådgivning', quantityThousandths: 1000n, unitPriceMinor: 1000000n, vatCode: '3' },
    ],
  });
  await issueInvoice(db, rules, { organizationId: orgId, actor: actor(), invoiceId: draft.id });
});

afterAll(async () => {
  await db.end();
});

describe('SAF-T Financial-eksport', () => {
  it('genererer velformet XML (xmllint) med escapede spesialtegn', async () => {
    const xml = await buildSafTXml(db, {
      organizationId: orgId,
      fromDate: '2025-11-01',
      toDate: '2025-11-30',
    });
    const dir = mkdtempSync(join(tmpdir(), 'saft-'));
    const file = join(dir, 'export.xml');
    writeFileSync(file, xml, 'utf8');
    // Kaster ved ikke-velformet XML — og valideres mot Skatteetatens offisielle XSD.
    execFileSync('xmllint', ['--noout', file]);
    execFileSync('xmllint', [
      '--noout',
      '--schema',
      join(process.cwd(), 'vendor/saft/Norwegian_SAF-T_Financial_Schema_v_1.40.xsd'),
      file,
    ]);
    expect(xml).toContain('S\u00f6ta &amp; Br\u00e5ten &lt;AS&gt;');
    expect(xml).toContain('<n1:AuditFileVersion>1.40</n1:AuditFileVersion>');
    // 1.40 skiller debet/kredit-avgift (ikke lenger <TaxAmount>).
    expect(xml).toMatch(/<n1:(Debit|Credit)TaxAmount>/);
    expect(xml).not.toContain('<n1:TaxAmount>');
    // Sporbarhet: intern posterings-ID (SystemID = bilagsnummer) p\u00e5 transaksjonen.
    expect(xml).toMatch(/<n1:SystemID>\d+<\/n1:SystemID>/);
    // 1.40: reskontrosaldo i BalanceAccount med kontrollkonto.
    expect(xml).toContain('<n1:BalanceAccount>');
    // 1.40: GroupingCategory/GroupingCode erstatter StandardAccountID.
    expect(xml).toContain('<n1:GroupingCategory>');
    expect(xml).not.toContain('<n1:StandardAccountID>');
  });

  it('totaler stemmer med hovedboken for perioden, og debet == kredit', async () => {
    const xml = await buildSafTXml(db, {
      organizationId: orgId,
      fromDate: '2025-11-01',
      toDate: '2025-11-30',
    });
    const totalDebit = /<n1:TotalDebit>([\d.]+)<\/n1:TotalDebit>/.exec(xml)?.[1];
    const totalCredit = /<n1:TotalCredit>([\d.]+)<\/n1:TotalCredit>/.exec(xml)?.[1];
    // Fakturaen: brutto 12 500,00 → debet == kredit == 12500.00
    expect(totalDebit).toBe('12500.00');
    expect(totalCredit).toBe('12500.00');
    expect(xml).toContain('<n1:NumberOfEntries>1</n1:NumberOfEntries>');
  });

  it('inngående og utgående saldo skiller perioder (oktoberbilag før november)', async () => {
    const xml = await buildSafTXml(db, {
      organizationId: orgId,
      fromDate: '2025-11-01',
      toDate: '2025-11-30',
    });
    // 2710 hadde 2 000,00 debet fra oktober → OpeningDebitBalance 2000.00
    const account2710 = /<n1:AccountID>2710<\/n1:AccountID>[\s\S]*?<\/n1:Account>/.exec(xml)?.[0];
    expect(account2710).toContain('<n1:OpeningDebitBalance>2000.00</n1:OpeningDebitBalance>');
    // 1500 åpner på 0 og lukker på 12 500,00 (fakturaen)
    const account1500 = /<n1:AccountID>1500<\/n1:AccountID>[\s\S]*?<\/n1:Account>/.exec(xml)?.[0];
    expect(account1500).toContain('<n1:OpeningDebitBalance>0.00</n1:OpeningDebitBalance>');
    expect(account1500).toContain('<n1:ClosingDebitBalance>12500.00</n1:ClosingDebitBalance>');
  });

  it('kunder, leverandører og brukte mva-koder er med', async () => {
    const xml = await buildSafTXml(db, {
      organizationId: orgId,
      fromDate: '2025-10-01',
      toDate: '2025-11-30',
    });
    expect(xml).toContain('Kunde &amp; Co');
    expect(xml).toContain('Kj\u00f8p av &quot;utstyr&quot; &amp; rekvisita');
    expect(xml).toContain('<n1:RegistrationNumber>923609016</n1:RegistrationNumber>');
    // Begge brukte mva-koder er i TaxTable med sats fra regelregisteret.
    expect(xml).toMatch(/<n1:TaxCode>1<\/n1:TaxCode>\s*<n1:Description>[^<]*<\/n1:Description>\s*<n1:TaxPercentage>25<\/n1:TaxPercentage>/);
    expect(xml).toMatch(/<n1:TaxCode>3<\/n1:TaxCode>/);
    // Fakturalinjen b\u00e6rer kunde-ID-en (reskontrospor).
    expect(xml).toMatch(/<n1:CustomerID>[0-9a-f]{32}<\/n1:CustomerID>/); // maks 35 tegn i SAF-T
  });

  it('1.40 full sporbarhet: fremmed valuta + dimensjon + kildebilag, XSD-validert', async () => {
    // Prosjekt (dimensjon) + kildebilag + en fremmed-valuta-postering (USD).
    await db.query(`INSERT INTO projects (id, organization_id, code, name, created_by) VALUES ($1,$2,'PROSJEKT-X','Filmprosjekt X',$3)`, [newId(), orgId, userId]);
    const docId = newId();
    await db.query(
      `INSERT INTO source_documents (id, organization_id, source, filename, mime_type, byte_size, sha256, storage_key, status, created_by)
       VALUES ($1,$2,'upload','faktura.pdf','application/pdf',100,$3,$4,'posted',$5)`,
      [docId, orgId, newId(), `k/${docId}`, userId],
    );
    await postJournalEntry(db, {
      organizationId: orgId,
      actor: actor(),
      entryDate: '2025-11-20',
      description: 'Programvare i USD',
      idempotencyKey: 'saft-usd',
      sourceDocumentId: docId,
      lines: [
        { accountNumber: '6810', debitMinor: 95702n, vatCode: '86', project: 'PROSJEKT-X', originalCurrency: 'USD', originalAmountMinor: 10000n, exchangeRate: '9.5702', exchangeRateSource: 'Norges Bank' },
        { accountNumber: '2400', creditMinor: 95702n },
      ],
    });
    const xml = await buildSafTXml(db, { organizationId: orgId, fromDate: '2025-11-01', toDate: '2025-11-30' });
    const dir = mkdtempSync(join(tmpdir(), 'saft14-'));
    const file = join(dir, 'export.xml');
    writeFileSync(file, xml, 'utf8');
    execFileSync('xmllint', ['--noout', '--schema', join(process.cwd(), 'vendor/saft/Norwegian_SAF-T_Financial_Schema_v_1.40.xsd'), file]);

    // Dimensjon deklarert i AnalysisTypeTable + brukt p\u00e5 linjen (Analysis).
    expect(xml).toContain('<n1:AnalysisType>PROSJEKT</n1:AnalysisType>');
    expect(xml).toContain('<n1:AnalysisID>PROSJEKT-X</n1:AnalysisID>');
    // Fremmed valuta: NOK-bel\u00f8p + originalvaluta/-bel\u00f8p/kurs.
    expect(xml).toContain('<n1:CurrencyCode>USD</n1:CurrencyCode>');
    expect(xml).toContain('<n1:CurrencyAmount>100.00</n1:CurrencyAmount>');
    expect(xml).toContain('<n1:ExchangeRate>9.5702</n1:ExchangeRate>');
    // Kildebilag-lenke (krone \u2192 bilag).
    expect(xml).toMatch(/<n1:SourceDocumentID>[0-9a-f]{32}<\/n1:SourceDocumentID>/);
  });
});
