/**
 * SAF-T Financial-eksport (Norge).
 *
 * Strukturen følger Skatteetatens SAF-T Financial (hovedelementene Header,
 * MasterFiles med kontoer/kunder/leverandører/mva-koder, og
 * GeneralLedgerEntries) og bygges deterministisk fra hovedboken:
 * hver krone i filen kan spores tilbake til posteringslinjer.
 *
 * Kontoplanen er NS 4102-basert firesifret og mva-kodene ER SAF-T
 * standardkoder, så mappingen er direkte. Se docs/integration-status.md for
 * valideringsstatus mot Skatteetatens offisielle XSD.
 */
import type { Db } from '../db/pool.js';
import { getVatCode, VAT_CODES } from '../coa/vat-codes.js';
import { groupingFor } from './grouping.js';
import { buildNorwegianRuleRegister } from '../rules/no/rules.js';
import { NotFoundError, ValidationError } from '../shared/errors.js';
import { moneyToDecimalString, money } from '../shared/money.js';
import { vatOfNet } from '../vat/engine.js';

/** SAF-T-ID-felter er begrenset til 35 tegn; UUID-er komprimeres (uten bindestrek). */
function saftId(uuid: string): string {
  return uuid.replace(/-/g, '');
}

const rules = buildNorwegianRuleRegister();

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Beløp i øre → SAF-T desimalstreng (alltid positivt; fortegn styres av Debit/Credit). */
function amt(minor: bigint): string {
  const abs = minor < 0n ? -minor : minor;
  return moneyToDecimalString(money(abs, 'NOK'));
}

function ratePctAt(vatCode: string, isoDate: string): string {
  const def = getVatCode(vatCode);
  if (!def?.rateRuleId) return '0';
  const rate = rules.getRationalParamAt(def.rateRuleId, 'rate', isoDate);
  if (rate.denominator === 100n) return rate.numerator.toString();
  if (rate.denominator === 1000n) {
    const frac = rate.numerator % 10n;
    return frac === 0n ? (rate.numerator / 10n).toString() : `${rate.numerator / 10n}.${frac}`;
  }
  return '0';
}

export interface SafTParams {
  organizationId: string;
  fromDate: string; // ISO, inklusiv
  toDate: string; // ISO, inklusiv
  softwareName?: string;
  softwareVersion?: string;
  /** SAF-T Financial-versjon. Standard 1.40 (obligatorisk fra 1.1.2027). */
  auditFileVersion?: string;
}

/** Nyeste SAF-T Financial-versjon. Obligatorisk fra første regnskapsperiode
 *  som starter 1. januar 2027 eller senere; frivillig før det. */
export const SAFT_VERSION = '1.40';

export async function buildSafTXml(db: Db, params: SafTParams): Promise<string> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(params.toDate)) {
    throw new ValidationError('Ugyldig datoperiode for SAF-T-eksport.');
  }
  if (params.fromDate > params.toDate) throw new ValidationError('fromDate må være før toDate.');

  const org = await db.query(
    `SELECT name, org_number, street_address, postal_code, city FROM organizations WHERE id = $1`,
    [params.organizationId],
  );
  if (!org.rowCount) throw new NotFoundError('Organisasjonen finnes ikke.');
  const orgName: string = org.rows[0].name;
  const orgNumber: string = org.rows[0].org_number ?? '000000000';
  // AddressStructure: alle barn er valgfrie, men rekkefølgen er låst i XSD-en
  // (StreetName før City før PostalCode før Country).
  const addressXml = (street: string | null, postal: string | null, city: string | null): string => {
    const parts = [
      street ? `<n1:StreetName>${esc(street)}</n1:StreetName>` : '',
      city ? `<n1:City>${esc(city)}</n1:City>` : '',
      postal ? `<n1:PostalCode>${esc(postal)}</n1:PostalCode>` : '',
      street || postal || city ? '<n1:Country>NO</n1:Country>' : '',
    ].filter(Boolean);
    return parts.length ? `<n1:Address>${parts.join('')}</n1:Address>` : '<n1:Address/>';
  };
  const companyAddressXml = addressXml(
    org.rows[0].street_address,
    org.rows[0].postal_code,
    org.rows[0].city,
  );
  // XSD krever kontaktperson i Header/Company; vi bruker organisasjonens eier.
  const ownerRes = await db.query(
    `SELECT u.display_name FROM memberships m
     JOIN users u ON u.id = m.user_id
     WHERE m.organization_id = $1 AND m.role = 'owner' AND m.status = 'active'
     ORDER BY m.created_at LIMIT 1`,
    [params.organizationId],
  );
  const contactName: string = ownerRes.rowCount ? ownerRes.rows[0].display_name : orgName;

  // ── Kontosaldoer: inngående (før perioden) og utgående (t.o.m. perioden) ──
  const balances = await db.query(
    `SELECT l.account_number,
            COALESCE(SUM(CASE WHEN e.entry_date < $2 THEN l.debit_minor - l.credit_minor END), 0)::TEXT AS opening,
            COALESCE(SUM(CASE WHEN e.entry_date <= $3 THEN l.debit_minor - l.credit_minor END), 0)::TEXT AS closing
     FROM journal_lines l
     JOIN journal_entries e ON e.id = l.entry_id
     WHERE l.organization_id = $1
     GROUP BY l.account_number`,
    [params.organizationId, params.fromDate, params.toDate],
  );
  const balanceByAccount = new Map<string, { opening: bigint; closing: bigint }>(
    balances.rows.map((r) => [
      r.account_number,
      { opening: BigInt(r.opening), closing: BigInt(r.closing) },
    ]),
  );

  const accounts = await db.query(
    `SELECT account_number, name FROM ledger_accounts
     WHERE organization_id = $1 AND active ORDER BY account_number`,
    [params.organizationId],
  );

  const accountsXml = accounts.rows
    .map((account) => {
      const bal = balanceByAccount.get(account.account_number) ?? { opening: 0n, closing: 0n };
      const opening =
        bal.opening >= 0n
          ? `<n1:OpeningDebitBalance>${amt(bal.opening)}</n1:OpeningDebitBalance>`
          : `<n1:OpeningCreditBalance>${amt(bal.opening)}</n1:OpeningCreditBalance>`;
      const closing =
        bal.closing >= 0n
          ? `<n1:ClosingDebitBalance>${amt(bal.closing)}</n1:ClosingDebitBalance>`
          : `<n1:ClosingCreditBalance>${amt(bal.closing)}</n1:ClosingCreditBalance>`;
      // 1.40: GroupingCategory + GroupingCode (kobling til næringsspesifikasjonen)
      // erstatter StandardAccountID fra tidligere versjoner.
      const grouping = groupingFor(account.account_number);
      return `      <n1:Account>
        <n1:AccountID>${esc(account.account_number)}</n1:AccountID>
        <n1:AccountDescription>${esc(account.name)}</n1:AccountDescription>
        <n1:GroupingCategory>${esc(grouping.category)}</n1:GroupingCategory>
        <n1:GroupingCode>${esc(grouping.code)}</n1:GroupingCode>
        <n1:AccountType>GL</n1:AccountType>
        ${opening}
        ${closing}
      </n1:Account>`;
    })
    .join('\n');

  // ── Kunder og leverandører med reskontrosaldo ────────────────────────────
  const customers = await db.query(
    `SELECT c.id, c.name, c.org_number, c.street_address, c.postal_code, c.city,
            COALESCE(SUM(CASE WHEN e.entry_date < $2 THEN l.debit_minor - l.credit_minor END), 0)::TEXT AS opening,
            COALESCE(SUM(CASE WHEN e.entry_date <= $3 THEN l.debit_minor - l.credit_minor END), 0)::TEXT AS closing
     FROM customers c
     LEFT JOIN journal_lines l ON l.customer_id = c.id
     LEFT JOIN journal_entries e ON e.id = l.entry_id
     WHERE c.organization_id = $1
     GROUP BY c.id, c.name, c.org_number, c.street_address, c.postal_code, c.city ORDER BY c.name`,
    [params.organizationId, params.fromDate, params.toDate],
  );
  const customersXml = customers.rows
    .map((c) => {
      const opening = BigInt(c.opening);
      const closing = BigInt(c.closing);
      // 1.40: reskontrosaldo ligger i BalanceAccount med kontrollkontoen (1500).
      return `      <n1:Customer>
        ${c.org_number ? `<n1:RegistrationNumber>${esc(c.org_number)}</n1:RegistrationNumber>` : ''}
        <n1:Name>${esc(c.name)}</n1:Name>
        ${addressXml(c.street_address, c.postal_code, c.city)}
        <n1:CustomerID>${saftId(c.id)}</n1:CustomerID>
        <n1:BalanceAccount>
          <n1:AccountID>1500</n1:AccountID>
          ${opening >= 0n ? `<n1:OpeningDebitBalance>${amt(opening)}</n1:OpeningDebitBalance>` : `<n1:OpeningCreditBalance>${amt(opening)}</n1:OpeningCreditBalance>`}
          ${closing >= 0n ? `<n1:ClosingDebitBalance>${amt(closing)}</n1:ClosingDebitBalance>` : `<n1:ClosingCreditBalance>${amt(closing)}</n1:ClosingCreditBalance>`}
        </n1:BalanceAccount>
      </n1:Customer>`;
    })
    .join('\n');

  const vendors = await db.query(
    `SELECT v.id, v.name, v.org_number,
            COALESCE(SUM(CASE WHEN e.entry_date < $2 THEN l.debit_minor - l.credit_minor END), 0)::TEXT AS opening,
            COALESCE(SUM(CASE WHEN e.entry_date <= $3 THEN l.debit_minor - l.credit_minor END), 0)::TEXT AS closing
     FROM vendors v
     LEFT JOIN journal_lines l ON l.vendor_id = v.id
     LEFT JOIN journal_entries e ON e.id = l.entry_id
     WHERE v.organization_id = $1
     GROUP BY v.id, v.name, v.org_number ORDER BY v.name`,
    [params.organizationId, params.fromDate, params.toDate],
  );
  const vendorsXml = vendors.rows
    .map((v) => {
      const opening = BigInt(v.opening);
      const closing = BigInt(v.closing);
      // 1.40: reskontrosaldo ligger i BalanceAccount med kontrollkontoen (2400).
      return `      <n1:Supplier>
        ${v.org_number ? `<n1:RegistrationNumber>${esc(v.org_number)}</n1:RegistrationNumber>` : ''}
        <n1:Name>${esc(v.name)}</n1:Name>
        <n1:Address/>
        <n1:SupplierID>${saftId(v.id)}</n1:SupplierID>
        <n1:BalanceAccount>
          <n1:AccountID>2400</n1:AccountID>
          ${opening >= 0n ? `<n1:OpeningDebitBalance>${amt(opening)}</n1:OpeningDebitBalance>` : `<n1:OpeningCreditBalance>${amt(opening)}</n1:OpeningCreditBalance>`}
          ${closing >= 0n ? `<n1:ClosingDebitBalance>${amt(closing)}</n1:ClosingDebitBalance>` : `<n1:ClosingCreditBalance>${amt(closing)}</n1:ClosingCreditBalance>`}
        </n1:BalanceAccount>
      </n1:Supplier>`;
    })
    .join('\n');

  // ── Mva-koder som faktisk er brukt i perioden ────────────────────────────
  const usedCodes = await db.query(
    `SELECT DISTINCT l.vat_code FROM journal_lines l
     JOIN journal_entries e ON e.id = l.entry_id
     WHERE l.organization_id = $1 AND l.vat_code IS NOT NULL
       AND e.entry_date >= $2 AND e.entry_date <= $3`,
    [params.organizationId, params.fromDate, params.toDate],
  );
  const codeSet = new Set<string>(usedCodes.rows.map((r) => r.vat_code));
  const taxTableXml = VAT_CODES.filter((c) => codeSet.has(c.code))
    .map(
      (c) => `      <n1:TaxCodeDetails>
        <n1:TaxCode>${esc(c.code)}</n1:TaxCode>
        <n1:Description>${esc(c.name)}</n1:Description>
        <n1:TaxPercentage>${ratePctAt(c.code, params.toDate)}</n1:TaxPercentage>
        <n1:Country>NO</n1:Country>
        <n1:StandardTaxCode>${esc(c.code)}</n1:StandardTaxCode>
        <n1:BaseRate>100</n1:BaseRate>
      </n1:TaxCodeDetails>`,
    )
    .join('\n');

  // ── Dimensjoner (kostnadsbærere) → AnalysisTypeTable ─────────────────────
  // Prosjekt og avdeling deklareres som analyse-typer slik at linjenes
  // Analysis-koder er sporbare tilbake til registeret.
  const projects = await db.query(
    `SELECT code, name FROM projects WHERE organization_id = $1 ORDER BY code`,
    [params.organizationId],
  );
  const departments = await db.query(
    `SELECT code, name FROM departments WHERE organization_id = $1 ORDER BY code`,
    [params.organizationId],
  );
  const analysisEntries = [
    ...projects.rows.map((p) => ({ type: 'PROSJEKT', typeDesc: 'Prosjekt', id: p.code as string, idDesc: p.name as string })),
    ...departments.rows.map((d) => ({ type: 'AVDELING', typeDesc: 'Avdeling', id: d.code as string, idDesc: d.name as string })),
  ];
  const analysisTypeTableXml = analysisEntries.length
    ? `    <n1:AnalysisTypeTable>
${analysisEntries
        .map(
          (a) => `      <n1:AnalysisTypeTableEntry>
        <n1:AnalysisType>${esc(a.type)}</n1:AnalysisType>
        <n1:AnalysisTypeDescription>${esc(a.typeDesc)}</n1:AnalysisTypeDescription>
        <n1:AnalysisID>${esc(a.id)}</n1:AnalysisID>
        <n1:AnalysisIDDescription>${esc(a.idDesc)}</n1:AnalysisIDDescription>
      </n1:AnalysisTypeTableEntry>`,
        )
        .join('\n')}
    </n1:AnalysisTypeTable>`
    : '';

  // ── Posteringer i perioden ───────────────────────────────────────────────
  const entries = await db.query(
    `SELECT e.id, e.entry_number, e.entry_date::TEXT AS entry_date, e.description,
            e.posted_at, e.source_document_id
     FROM journal_entries e
     WHERE e.organization_id = $1 AND e.entry_date >= $2 AND e.entry_date <= $3
     ORDER BY e.entry_number`,
    [params.organizationId, params.fromDate, params.toDate],
  );
  const entryIds = entries.rows.map((e) => e.id);
  const lines = entryIds.length
    ? await db.query(
        `SELECT entry_id, line_number, account_number, vat_code, debit_minor, credit_minor,
                description, customer_id, vendor_id, project, department,
                original_currency, original_amount_minor, exchange_rate
         FROM journal_lines WHERE entry_id = ANY($1) ORDER BY entry_id, line_number`,
        [entryIds],
      )
    : { rows: [] as Record<string, string | null>[] };
  const linesByEntry = new Map<string, typeof lines.rows>();
  for (const line of lines.rows) {
    const list = linesByEntry.get(line.entry_id as string) ?? [];
    list.push(line);
    linesByEntry.set(line.entry_id as string, list);
  }

  let totalDebit = 0n;
  let totalCredit = 0n;
  const transactionsXml = entries.rows
    .map((entry) => {
      const entryLines = linesByEntry.get(entry.id) ?? [];
      const [year, month] = entry.entry_date.split('-');
      const linesXml = entryLines
        .map((line) => {
          const debit = BigInt(line.debit_minor ?? '0');
          const credit = BigInt(line.credit_minor ?? '0');
          totalDebit += debit;
          totalCredit += credit;
          const isDebit = debit > 0n;

          // Fremmed valuta (SAF-T 1.40): linjebeløpet er i NOK (Amount), men
          // originalvaluta/-beløp/kurs tas med for full sporbarhet (bokf.loven §4-2).
          const curr = line.original_currency as string | null;
          const origMinor = line.original_amount_minor as string | null;
          const currencyInner =
            curr && curr !== 'NOK' && origMinor != null
              ? `<n1:CurrencyCode>${esc(curr)}</n1:CurrencyCode><n1:CurrencyAmount>${amt(BigInt(origMinor))}</n1:CurrencyAmount>${line.exchange_rate ? `<n1:ExchangeRate>${esc(line.exchange_rate as string)}</n1:ExchangeRate>` : ''}`
              : '';
          const amount = isDebit
            ? `<n1:DebitAmount><n1:Amount>${amt(debit)}</n1:Amount>${currencyInner}</n1:DebitAmount>`
            : `<n1:CreditAmount><n1:Amount>${amt(credit)}</n1:Amount>${currencyInner}</n1:CreditAmount>`;

          // TaxAmount i NOK (header-valuta): på mva-kontoene ER linjebeløpet avgiften;
          // på grunnlagslinjer beregnes den deterministisk med satsen per bilagsdato.
          // 1.40 skiller debet/kredit-avgift (DebitTaxAmount/CreditTaxAmount).
          const lineAmount = isDebit ? debit : credit;
          const isVatAccount = ['2700', '2710', '2740'].includes(line.account_number as string);
          const taxAmount = line.vat_code
            ? isVatAccount
              ? lineAmount
              : vatOfNet(rules, line.vat_code, lineAmount, entry.entry_date).vatMinor
            : 0n;
          const taxAmountTag = isDebit ? 'DebitTaxAmount' : 'CreditTaxAmount';
          const tax = line.vat_code
            ? `
            <n1:TaxInformation>
              <n1:TaxType>MVA</n1:TaxType>
              <n1:TaxCode>${esc(line.vat_code)}</n1:TaxCode>
              <n1:TaxPercentage>${ratePctAt(line.vat_code, entry.entry_date)}</n1:TaxPercentage>
              <n1:${taxAmountTag}><n1:Amount>${amt(taxAmount)}</n1:Amount></n1:${taxAmountTag}>
            </n1:TaxInformation>`
            : '';

          // Analysis: prosjekt/avdeling → sporbar til AnalysisTypeTable.
          const analysis = [
            line.project ? `<n1:Analysis><n1:AnalysisType>PROSJEKT</n1:AnalysisType><n1:AnalysisID>${esc(line.project as string)}</n1:AnalysisID></n1:Analysis>` : '',
            line.department ? `<n1:Analysis><n1:AnalysisType>AVDELING</n1:AnalysisType><n1:AnalysisID>${esc(line.department as string)}</n1:AnalysisID></n1:Analysis>` : '',
          ].filter(Boolean).join('');
          // SourceDocumentID: lenke til kildebilaget (full sporbarhet krone→bilag).
          const sourceDoc = entry.source_document_id
            ? `<n1:SourceDocumentID>${saftId(entry.source_document_id)}</n1:SourceDocumentID>`
            : '';
          return `          <n1:Line>
            <n1:RecordID>${line.line_number}</n1:RecordID>
            <n1:AccountID>${esc(line.account_number as string)}</n1:AccountID>
            ${analysis}${sourceDoc}${line.customer_id ? `<n1:CustomerID>${saftId(line.customer_id)}</n1:CustomerID>` : ''}
            ${line.vendor_id ? `<n1:SupplierID>${saftId(line.vendor_id)}</n1:SupplierID>` : ''}
            <n1:Description>${esc((line.description as string | null) ?? entry.description)}</n1:Description>
            ${amount}${tax}
          </n1:Line>`;
        })
        .join('\n');
      return `        <n1:Transaction>
          <n1:TransactionID>${entry.entry_number}</n1:TransactionID>
          <n1:Period>${Number(month)}</n1:Period>
          <n1:PeriodYear>${year}</n1:PeriodYear>
          <n1:TransactionDate>${entry.entry_date}</n1:TransactionDate>
          <n1:Description>${esc(entry.description)}</n1:Description>
          <n1:SystemEntryDate>${new Date(entry.posted_at).toISOString().slice(0, 10)}</n1:SystemEntryDate>
          <n1:GLPostingDate>${entry.entry_date}</n1:GLPostingDate>
          <n1:SystemID>${entry.entry_number}</n1:SystemID>
${linesXml}
        </n1:Transaction>`;
    })
    .join('\n');

  const created = new Date().toISOString().slice(0, 10);
  return `<?xml version="1.0" encoding="UTF-8"?>
<n1:AuditFile xmlns:n1="urn:StandardAuditFile-Taxation-Financial:NO">
  <n1:Header>
    <n1:AuditFileVersion>${esc(params.auditFileVersion ?? SAFT_VERSION)}</n1:AuditFileVersion>
    <n1:AuditFileCountry>NO</n1:AuditFileCountry>
    <n1:AuditFileDateCreated>${created}</n1:AuditFileDateCreated>
    <n1:SoftwareCompanyName>${esc(params.softwareName ?? 'Reknaren')}</n1:SoftwareCompanyName>
    <n1:SoftwareID>${esc(params.softwareName ?? 'Reknaren')}</n1:SoftwareID>
    <n1:SoftwareVersion>${esc(params.softwareVersion ?? '0.1.0')}</n1:SoftwareVersion>
    <n1:Company>
      <n1:RegistrationNumber>${esc(orgNumber)}</n1:RegistrationNumber>
      <n1:Name>${esc(orgName)}</n1:Name>
      ${companyAddressXml}
      <n1:Contact>
        <n1:ContactPerson>
          <n1:FirstName>NotUsed</n1:FirstName>
          <n1:LastName>${esc(contactName)}</n1:LastName>
        </n1:ContactPerson>
      </n1:Contact>
    </n1:Company>
    <n1:DefaultCurrencyCode>NOK</n1:DefaultCurrencyCode>
    <n1:SelectionCriteria>
      <n1:SelectionStartDate>${params.fromDate}</n1:SelectionStartDate>
      <n1:SelectionEndDate>${params.toDate}</n1:SelectionEndDate>
    </n1:SelectionCriteria>
    <n1:TaxAccountingBasis>A</n1:TaxAccountingBasis>
  </n1:Header>
  <n1:MasterFiles>
    <n1:GeneralLedgerAccounts>
${accountsXml}
    </n1:GeneralLedgerAccounts>
    ${customersXml ? `<n1:Customers>\n${customersXml}\n    </n1:Customers>` : ''}
    ${vendorsXml ? `<n1:Suppliers>\n${vendorsXml}\n    </n1:Suppliers>` : ''}
    ${
      taxTableXml
        ? `<n1:TaxTable>
      <n1:TaxTableEntry>
        <n1:TaxType>MVA</n1:TaxType>
        <n1:Description>Merverdiavgift</n1:Description>
${taxTableXml}
      </n1:TaxTableEntry>
    </n1:TaxTable>`
        : ''
    }
${analysisTypeTableXml}
  </n1:MasterFiles>
  <n1:GeneralLedgerEntries>
    <n1:NumberOfEntries>${entries.rowCount}</n1:NumberOfEntries>
    <n1:TotalDebit>${amt(totalDebit)}</n1:TotalDebit>
    <n1:TotalCredit>${amt(totalCredit)}</n1:TotalCredit>
    <n1:Journal>
      <n1:JournalID>GL</n1:JournalID>
      <n1:Description>Bilagsjournal</n1:Description>
      <n1:Type>GL</n1:Type>
${transactionsXml}
    </n1:Journal>
  </n1:GeneralLedgerEntries>
</n1:AuditFile>
`;
}
