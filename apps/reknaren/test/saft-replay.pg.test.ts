/**
 * Full transaksjons-replay fra SAF-T: spiller av HVER bokføring inn i hovedboken
 * (ikke bare åpningsbalanse), med dato/tekst/reskontro bevart, idempotent på
 * Fikens SystemID. Verifiserer også komposittkonto (1920:sub → 1920).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import { parseSaftTransactions, replaySaftTransactions } from '../src/saft/import.js';
import { createOrganization, ensureUser } from '../src/orgs/service.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
let userId: string;
const actor = () => ({ userId, role: 'owner' });

const SAFT = `<?xml version="1.0"?>
<AuditFile>
  <Header>
    <SelectionCriteria><SelectionStartDate>2025-01-01</SelectionStartDate><SelectionEndDate>2025-12-31</SelectionEndDate></SelectionCriteria>
  </Header>
  <MasterFiles>
    <GeneralLedgerAccounts>
      <Account><AccountID>1920</AccountID><AccountDescription>Bank</AccountDescription><OpeningDebitBalance>1000.00</OpeningDebitBalance></Account>
      <Account><AccountID>2050</AccountID><AccountDescription>Egenkapital</AccountDescription><OpeningCreditBalance>1000.00</OpeningCreditBalance></Account>
      <Account><AccountID>1500</AccountID><AccountDescription>Kundefordringer</AccountDescription></Account>
      <Account><AccountID>3000</AccountID><AccountDescription>Salg</AccountDescription></Account>
      <Account><AccountID>2700</AccountID><AccountDescription>Utgaaende mva</AccountDescription></Account>
      <Account><AccountID>6800</AccountID><AccountDescription>Kontorrekvisita</AccountDescription></Account>
      <Account><AccountID>2710</AccountID><AccountDescription>Inngaaende mva</AccountDescription></Account>
      <Account><AccountID>2400</AccountID><AccountDescription>Leverandoergjeld</AccountDescription></Account>
    </GeneralLedgerAccounts>
    <Customers><Customer><RegistrationNumber>111111111</RegistrationNumber><Name>Kunde AS</Name><CustomerID>C1</CustomerID></Customer></Customers>
    <Suppliers><Supplier><RegistrationNumber>222222222</RegistrationNumber><Name>Lev AS</Name><SupplierID>S1</SupplierID></Supplier></Suppliers>
  </MasterFiles>
  <GeneralLedgerEntries>
    <Journal><JournalID>A</JournalID>
      <Transaction><TransactionID>1</TransactionID><TransactionDate>2025-03-01</TransactionDate><Description>Salg til Kunde</Description><SystemID>SYS-1</SystemID>
        <Line><RecordID>1</RecordID><AccountID>1500</AccountID><CustomerID>C1</CustomerID><DebitAmount><Amount>1250.00</Amount></DebitAmount></Line>
        <Line><RecordID>2</RecordID><AccountID>3000</AccountID><CreditAmount><Amount>1000.00</Amount></CreditAmount></Line>
        <Line><RecordID>3</RecordID><AccountID>2700</AccountID><CreditAmount><Amount>250.00</Amount></CreditAmount></Line>
      </Transaction>
      <Transaction><TransactionID>2</TransactionID><TransactionDate>2025-04-01</TransactionDate><Description>Kjoep fra Lev AS</Description><SystemID>SYS-2</SystemID>
        <Line><RecordID>4</RecordID><AccountID>6800</AccountID><SupplierID>S1</SupplierID><DebitAmount><Amount>800.00</Amount></DebitAmount></Line>
        <Line><RecordID>5</RecordID><AccountID>2710</AccountID><DebitAmount><Amount>200.00</Amount></DebitAmount></Line>
        <Line><RecordID>6</RecordID><AccountID>2400:20001</AccountID><SupplierID>S1</SupplierID><CreditAmount><Amount>1000.00</Amount></CreditAmount></Line>
      </Transaction>
    </Journal>
  </GeneralLedgerEntries>
</AuditFile>`;

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  userId = await ensureUser(db, 'replay@example.com', 'Replay');
});
afterAll(async () => {
  await db.end();
});

describe('SAF-T transaksjons-replay', () => {
  it('parser transaksjonene med komposittkonto og reskontro', () => {
    const p = parseSaftTransactions(SAFT);
    expect(p.transactionCount).toBe(2);
    expect(p.lineCount).toBe(6);
    expect(p.unbalancedCount).toBe(0);
    expect(p.suppliers).toHaveLength(1);
    // Komposittkonto «2400:20001» skal reduseres til basiskonto «2400».
    const t2 = p.transactions.find((t) => t.id === 'SYS-2')!;
    expect(t2.lines.some((l) => l.accountNumber === '2400')).toBe(true);
    expect(t2.lines.find((l) => l.accountNumber === '2400')!.supplierRef).toBe('S1');
  });

  it('spiller av hver postering + inngående balanse, kobler reskontro, og er idempotent', async () => {
    const org = await createOrganization(db, { name: 'Replay AS', orgForm: 'AS', vatStatus: 'registered', createdByUserId: userId });
    const r = await replaySaftTransactions(db, { organizationId: org.id, actor: actor(), xml: SAFT, includeOpening: true });
    expect(r.transactionsPosted).toBe(2);
    expect(r.transactionsSkipped).toBe(0);
    expect(r.unbalanced).toEqual([]);
    expect(r.openingEntryNumber).not.toBeNull();
    expect(r.suppliersCreated).toBe(1);
    expect(r.customersCreated).toBe(1);

    // 3 posteringer: inngående balanse + 2 transaksjoner.
    const cnt = Number((await db.query(`SELECT COUNT(*)::int AS c FROM journal_entries WHERE organization_id=$1`, [org.id])).rows[0].c);
    expect(cnt).toBe(3);

    // Salgskonto 3000 skal ha 1000 kreditsaldo (100000 øre).
    const salg = (await db.query(
      `SELECT COALESCE(SUM(credit_minor),0) - COALESCE(SUM(debit_minor),0) AS net
       FROM journal_lines l JOIN journal_entries je ON je.id=l.entry_id
       WHERE je.organization_id=$1 AND l.account_number='3000'`,
      [org.id],
    )).rows[0];
    expect(BigInt(salg.net)).toBe(100000n);

    // Leverandørkobling: linjen på 6800 skal ha vendor_id = «Lev AS».
    const link = (await db.query(
      `SELECT v.name FROM journal_lines l JOIN vendors v ON v.id=l.vendor_id
       WHERE l.account_number='6800' AND v.organization_id=$1`,
      [org.id],
    )).rows[0];
    expect(link?.name).toBe('Lev AS');

    // Inngående balanse datert dagen før periodestart.
    const open = (await db.query(
      `SELECT entry_date::text AS d FROM journal_entries WHERE organization_id=$1 AND description LIKE 'Inngående balanse%'`,
      [org.id],
    )).rows[0];
    expect(open.d).toBe('2024-12-31');

    // Idempotent: kjør igjen uten inngående → ingen nye posteringer.
    const again = await replaySaftTransactions(db, { organizationId: org.id, actor: actor(), xml: SAFT, includeOpening: false });
    expect(again.transactionsPosted).toBe(2);
    const cnt2 = Number((await db.query(`SELECT COUNT(*)::int AS c FROM journal_entries WHERE organization_id=$1`, [org.id])).rows[0].c);
    expect(cnt2).toBe(3);
  });
});
