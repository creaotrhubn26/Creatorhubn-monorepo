/**
 * SAF-T-import: les en Standard Audit File (SAF-T Financial) fra et annet
 * regnskapssystem (f.eks. Fiken) og hent ut kontoplan, kunder, leverandører og
 * saldoer. Den GRATIS, vendor-nøytrale måten å flytte regnskapet på — SAF-T-eksport
 * er lovpålagt i alle norske systemer, og eksporten sletter ingenting i kildesystemet.
 *
 * Dette laget PARSER og FORHÅNDSVISER kun (ren lesing). Selve bokføringen av
 * åpningsbalanse skjer i et eget, bekreftet steg — «brukervennlig først, men alt
 * skal stemme»: du ser at tallene stemmer FØR noe føres.
 */
import { XMLParser } from 'fast-xml-parser';
import { moneyFromDecimalString } from '../shared/money.js';
import type { Db } from '../db/pool.js';
import type { Actor } from '../audit/audit.js';
import { postJournalEntry, type JournalLineInput } from '../ledger/engine.js';
import { getAccountDef, type AccountType } from '../coa/accounts.js';
import { newId } from '../shared/ids.js';
import { ValidationError } from '../shared/errors.js';

export class SaftParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SaftParseError';
  }
}

export interface SaftAccount {
  number: string;
  name: string;
  /** Sluttsaldo i øre (positiv = debet, negativ = kredit). */
  closingMinor: bigint;
}

export interface SaftParty {
  name: string;
  orgNumber: string | null;
  closingMinor: bigint;
}

export interface SaftPreview {
  company: string | null;
  companyOrgNumber: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  software: string | null;
  accounts: SaftAccount[];
  customers: SaftParty[];
  suppliers: SaftParty[];
  /** Sum debetsaldoer / kreditsaldoer over alle kontoer — skal balansere. */
  totalDebitMinor: bigint;
  totalCreditMinor: bigint;
  balanced: boolean;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toArray<T>(v: T | T[] | undefined | null): T[] {
  return v === undefined || v === null ? [] : Array.isArray(v) ? v : [v];
}

function toMinor(value: unknown): bigint {
  if (value === undefined || value === null || value === '') return 0n;
  try {
    return moneyFromDecimalString(String(value).trim(), 'NOK').minorUnits;
  } catch {
    return 0n;
  }
}

/** Sluttsaldo = debet − kredit (SAF-T oppgir dem som separate elementer). */
function closingOf(node: any): bigint {
  return toMinor(node?.ClosingDebitBalance) - toMinor(node?.ClosingCreditBalance);
}

/** Inngående balanse = debet − kredit. */
function openingOf(node: any): bigint {
  return toMinor(node?.OpeningDebitBalance) - toMinor(node?.OpeningCreditBalance);
}

function saftParser(): XMLParser {
  return new XMLParser({ ignoreAttributes: true, removeNSPrefix: true, parseTagValue: false, trimValues: true });
}

function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function str(v: unknown): string | null {
  const s = v === undefined || v === null ? '' : String(v).trim();
  return s === '' ? null : s;
}

export function parseSaft(xml: string): SaftPreview {
  if (!xml || !xml.includes('AuditFile')) {
    throw new SaftParseError('Fant ikke <AuditFile> — er du sikker på at dette er en SAF-T-fil?');
  }
  const parser = new XMLParser({
    ignoreAttributes: true,
    removeNSPrefix: true, // stripper n1:/xmlns-prefiks så vi treffer standard-elementnavn
    parseTagValue: false, // behold verdier som strenger (beløp/org.nr aldri som tall)
    trimValues: true,
  });
  let doc: any;
  try {
    doc = parser.parse(xml);
  } catch (e) {
    throw new SaftParseError('Klarte ikke å lese XML-fila: ' + (e as Error).message);
  }
  const audit = doc?.AuditFile;
  if (!audit) throw new SaftParseError('Fant ikke <AuditFile> — er dette en SAF-T-fil?');
  const master = audit.MasterFiles ?? {};

  const accountNodes = toArray<any>(master.GeneralLedgerAccounts?.Account);
  if (accountNodes.length === 0) {
    throw new SaftParseError('Fant ingen kontoer (GeneralLedgerAccounts) i fila.');
  }
  const accounts: SaftAccount[] = accountNodes
    .map((a) => ({
      number: String(a.AccountID ?? '').trim(),
      name: String(a.AccountDescription ?? a.AccountID ?? '').trim(),
      closingMinor: closingOf(a),
    }))
    .filter((a) => a.number);

  const parties = (nodes: any[]): SaftParty[] =>
    nodes
      .map((c) => ({
        name: String(c.Name ?? '').trim(),
        orgNumber: str(c.RegistrationNumber),
        closingMinor: closingOf(c),
      }))
      .filter((p) => p.name);
  const customers = parties(toArray<any>(master.Customers?.Customer));
  const suppliers = parties(toArray<any>(master.Suppliers?.Supplier));

  let dr = 0n;
  let cr = 0n;
  for (const a of accounts) {
    if (a.closingMinor >= 0n) dr += a.closingMinor;
    else cr += -a.closingMinor;
  }

  const header = audit.Header ?? {};
  const sel = header.SelectionCriteria ?? {};
  return {
    company: str(header.Company?.Name),
    companyOrgNumber: str(header.Company?.RegistrationNumber),
    periodStart: str(sel.SelectionStartDate ?? sel.PeriodStart),
    periodEnd: str(sel.SelectionEndDate ?? sel.PeriodEnd),
    software: str(header.SoftwareCompanyName ?? header.ProductID),
    accounts,
    customers,
    suppliers,
    totalDebitMinor: dr,
    totalCreditMinor: cr,
    balanced: dr === cr,
  };
}

// ── Bokføring av åpningsbalanse fra SAF-T ────────────────────────────────────

/** Utleder kontotype for kontoer som ikke er i standard-kontoplanen (fra nummer). */
function deriveAccountType(number: string): AccountType {
  const known = getAccountDef(number)?.type;
  if (known) return known;
  const n = Number(number);
  const first = number.charAt(0);
  if (first === '1') return 'asset';
  if (first === '2') return n < 2100 ? 'equity' : 'liability'; // 2000–2099 egenkapital, resten gjeld
  if (first === '3') return 'revenue';
  if (first >= '4' && first <= '7') return 'expense';
  if (first === '8') return n < 8100 ? 'revenue' : 'expense'; // finansinntekt vs -kostnad
  return 'expense';
}

export interface SaftOpeningResult {
  entryNumber: number;
  accountsEnsured: number;
  customersCreated: number;
  suppliersCreated: number;
  openingLines: number;
}

/**
 * Bokfører åpningsbalansen fra en SAF-T-fil: sikrer at alle kontoer finnes, oppretter
 * kunder/leverandører, og fører ÉN balansert åpningspostering (sluttsaldoene fra SAF-T)
 * datert `asOfDate`. Idempotent på dato — kan ikke bokføres to ganger for samme dato.
 * Reskontro splittes ikke per kunde/leverandør i v1 (kontosaldoen er korrekt).
 */
export async function importSaftOpeningBalance(
  db: Db,
  params: { organizationId: string; actor: Actor; xml: string; asOfDate: string },
): Promise<SaftOpeningResult> {
  const parsed = parseSaft(params.xml);
  if (!parsed.balanced) {
    throw new ValidationError('SAF-T-saldoene balanserer ikke — kan ikke bokføre åpningsbalanse. Sjekk kildefila.');
  }

  let accountsEnsured = 0;
  for (const a of parsed.accounts) {
    const r = await db.query(
      `INSERT INTO ledger_accounts (id, organization_id, account_number, name, account_type)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (organization_id, account_number) DO NOTHING`,
      [newId(), params.organizationId, a.number, a.name || a.number, deriveAccountType(a.number)],
    );
    if (r.rowCount) accountsEnsured++;
  }

  let customersCreated = 0;
  for (const c of parsed.customers) {
    const r = await db.query(
      `INSERT INTO customers (id, organization_id, name, org_number, created_by)
       SELECT $1,$2,$3,$4,$5
       WHERE NOT EXISTS (SELECT 1 FROM customers WHERE organization_id=$2 AND lower(name)=lower($3))`,
      [newId(), params.organizationId, c.name, c.orgNumber, params.actor.userId],
    );
    if (r.rowCount) customersCreated++;
  }
  let suppliersCreated = 0;
  for (const s of parsed.suppliers) {
    const r = await db.query(
      `INSERT INTO vendors (id, organization_id, name, org_number, created_by)
       SELECT $1,$2,$3,$4,$5
       WHERE NOT EXISTS (SELECT 1 FROM vendors WHERE organization_id=$2 AND lower(name)=lower($3))`,
      [newId(), params.organizationId, s.name, s.orgNumber, params.actor.userId],
    );
    if (r.rowCount) suppliersCreated++;
  }

  const lines = parsed.accounts
    .filter((a) => a.closingMinor !== 0n)
    .map((a) =>
      a.closingMinor > 0n
        ? { accountNumber: a.number, debitMinor: a.closingMinor }
        : { accountNumber: a.number, creditMinor: -a.closingMinor },
    );
  if (lines.length < 2) throw new ValidationError('Fant ingen saldoer å bokføre i SAF-T-fila.');

  const entry = await postJournalEntry(db, {
    organizationId: params.organizationId,
    actor: params.actor,
    entryDate: params.asOfDate,
    description: 'Åpningsbalanse importert fra SAF-T',
    idempotencyKey: `saft-opening:${params.asOfDate}`,
    lines,
  });

  return {
    entryNumber: entry.entryNumber,
    accountsEnsured,
    customersCreated,
    suppliersCreated,
    openingLines: lines.length,
  };
}

// ── Full transaksjons-replay fra SAF-T ───────────────────────────────────────
//
// Åpningsbalanse-importen over gir bare netto-saldoer. Denne spiller av HVER
// enkelt bokføring (GeneralLedgerEntries) som en egen postering i Reknaren, med
// dato, tekst og reskontro-kobling bevart — så hele historikken faktisk finnes
// i hovedboken (grunnlaget for læring, faste utgifter, avstemming osv.).
// Idempotent på Fikens SystemID → trygt å kjøre flere filer/år etter hverandre.

export interface SaftTxnLine {
  accountNumber: string; // basiskonto (før evt. «:sub»)
  debitMinor: bigint;
  creditMinor: bigint;
  supplierRef: string | null; // Fikens interne SupplierID
  customerRef: string | null; // Fikens interne CustomerID
  description: string | null;
}
export interface SaftTransaction {
  id: string; // SystemID (globalt unikt hos Fiken) → idempotensnøkkel
  date: string;
  description: string | null;
  lines: SaftTxnLine[];
  balanced: boolean;
}
export interface SaftPartyRef {
  internalId: string;
  name: string;
  orgNumber: string | null;
}
export interface SaftTransactionsPreview {
  periodStart: string | null;
  periodEnd: string | null;
  openingByAccount: { number: string; name: string; openingMinor: bigint }[];
  suppliers: SaftPartyRef[];
  customers: SaftPartyRef[];
  transactions: SaftTransaction[];
  transactionCount: number;
  lineCount: number;
  unbalancedCount: number;
}

/** Parser GeneralLedgerEntries til enkelt-transaksjoner (ren lesing). */
export function parseSaftTransactions(xml: string): SaftTransactionsPreview {
  if (!xml || !xml.includes('AuditFile')) throw new SaftParseError('Fant ikke <AuditFile> — er dette en SAF-T-fil?');
  let doc: any;
  try {
    doc = saftParser().parse(xml);
  } catch (e) {
    throw new SaftParseError('Klarte ikke å lese XML-fila: ' + (e as Error).message);
  }
  const audit = doc?.AuditFile;
  if (!audit) throw new SaftParseError('Fant ikke <AuditFile> — er dette en SAF-T-fil?');
  const master = audit.MasterFiles ?? {};

  const openingByAccount = toArray<any>(master.GeneralLedgerAccounts?.Account)
    .map((a) => ({ number: String(a.AccountID ?? '').trim(), name: String(a.AccountDescription ?? a.AccountID ?? '').trim(), openingMinor: openingOf(a) }))
    .filter((a) => a.number);

  const partyRefs = (nodes: any[], idKey: string): SaftPartyRef[] =>
    nodes
      .map((n) => ({ internalId: str(n[idKey]) ?? '', name: String(n.Name ?? '').trim(), orgNumber: str(n.RegistrationNumber) }))
      .filter((p) => p.internalId && p.name);
  const suppliers = partyRefs(toArray<any>(master.Suppliers?.Supplier), 'SupplierID');
  const customers = partyRefs(toArray<any>(master.Customers?.Customer), 'CustomerID');

  const transactions: SaftTransaction[] = [];
  let lineCount = 0;
  let unbalancedCount = 0;
  for (const j of toArray<any>(audit.GeneralLedgerEntries?.Journal)) {
    for (const t of toArray<any>(j.Transaction)) {
      const id = str(t.SystemID) ?? str(t.TransactionID);
      const date = str(t.TransactionDate) ?? str(t.GLPostingDate);
      if (!id || !date) continue;
      const lines: SaftTxnLine[] = [];
      for (const l of toArray<any>(t.Line)) {
        const rawAcc = String(l.AccountID ?? '').trim();
        if (!rawAcc) continue;
        const accountNumber = (rawAcc.split(':')[0] ?? rawAcc).trim();
        const debitMinor = toMinor(l.DebitAmount?.Amount);
        const creditMinor = toMinor(l.CreditAmount?.Amount);
        if (debitMinor === 0n && creditMinor === 0n) continue;
        lines.push({ accountNumber, debitMinor, creditMinor, supplierRef: str(l.SupplierID), customerRef: str(l.CustomerID), description: str(l.Description) });
      }
      if (lines.length < 2) continue;
      const dr = lines.reduce((s, l) => s + l.debitMinor, 0n);
      const cr = lines.reduce((s, l) => s + l.creditMinor, 0n);
      const balanced = dr === cr;
      if (!balanced) unbalancedCount++;
      lineCount += lines.length;
      transactions.push({ id, date, description: str(t.Description), lines, balanced });
    }
  }
  // Deterministisk kronologisk avspilling (dato, så id).
  transactions.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const header = audit.Header ?? {};
  const sel = header.SelectionCriteria ?? {};
  return {
    periodStart: str(sel.SelectionStartDate ?? sel.PeriodStart),
    periodEnd: str(sel.SelectionEndDate ?? sel.PeriodEnd),
    openingByAccount,
    suppliers,
    customers,
    transactions,
    transactionCount: transactions.length,
    lineCount,
    unbalancedCount,
  };
}

export interface SaftReplayResult {
  periodStart: string | null;
  periodEnd: string | null;
  openingEntryNumber: number | null;
  accountsEnsured: number;
  suppliersCreated: number;
  customersCreated: number;
  transactionsPosted: number;
  transactionsSkipped: number;
  linesPosted: number;
  unbalanced: string[]; // SystemID-er som ikke balanserte (hoppet over)
}

async function ensurePartyMap(
  db: Db,
  table: 'vendors' | 'customers',
  org: string,
  userId: string,
  parties: SaftPartyRef[],
): Promise<{ map: Map<string, string>; created: number }> {
  const map = new Map<string, string>();
  let created = 0;
  for (const p of parties) {
    const ins = await db.query(
      `INSERT INTO ${table} (id, organization_id, name, org_number, created_by)
       SELECT $1,$2,$3,$4,$5
       WHERE NOT EXISTS (
         SELECT 1 FROM ${table}
         WHERE organization_id=$2 AND (
           ($4 <> '' AND org_number=$4) OR (($4 = '' OR $4 IS NULL) AND lower(name)=lower($3))
         )
       )`,
      [newId(), org, p.name, p.orgNumber ?? '', userId],
    );
    if (ins.rowCount) created++;
    const row = (
      await db.query(
        `SELECT id::text AS id FROM ${table}
         WHERE organization_id=$1 AND (($2 <> '' AND org_number=$2) OR lower(name)=lower($3))
         ORDER BY (org_number=$2) DESC LIMIT 1`,
        [org, p.orgNumber ?? '', p.name],
      )
    ).rows[0];
    if (row) map.set(p.internalId, row.id);
  }
  return { map, created };
}

/**
 * Spiller av alle enkelt-transaksjoner fra en SAF-T-fil inn i hovedboken.
 * `includeOpening` fører i tillegg inngående balanse (kun for det TIDLIGSTE
 * året — for påfølgende år er inngående = utgående fra forrige avspilling).
 * Idempotent: hver postering nøkles på Fikens SystemID, hver konto/part på
 * eksistens — trygt å kjøre om igjen og å kjøre flere år etter hverandre.
 */
export async function replaySaftTransactions(
  db: Db,
  params: { organizationId: string; actor: Actor; xml: string; includeOpening: boolean },
): Promise<SaftReplayResult> {
  const parsed = parseSaftTransactions(params.xml);
  const org = params.organizationId;

  // 1) Sikre alle kontoer (balanse-listen + evt. kontoer som bare finnes i linjer).
  const accountNames = new Map<string, string>();
  for (const a of parsed.openingByAccount) accountNames.set(a.number, a.name || a.number);
  for (const t of parsed.transactions) for (const l of t.lines) if (!accountNames.has(l.accountNumber)) accountNames.set(l.accountNumber, l.accountNumber);
  let accountsEnsured = 0;
  for (const [number, name] of accountNames) {
    const r = await db.query(
      `INSERT INTO ledger_accounts (id, organization_id, account_number, name, account_type)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (organization_id, account_number) DO NOTHING`,
      [newId(), org, number, name, deriveAccountType(number)],
    );
    if (r.rowCount) accountsEnsured++;
  }

  // 2) Sikre parter + bygg intern-id → rad-id-kart for reskontro-kobling.
  const sup = await ensurePartyMap(db, 'vendors', org, params.actor.userId, parsed.suppliers);
  const cus = await ensurePartyMap(db, 'customers', org, params.actor.userId, parsed.customers);

  // 3) Inngående balanse (valgfritt, kun tidligste år).
  let openingEntryNumber: number | null = null;
  if (params.includeOpening) {
    const openLines: JournalLineInput[] = parsed.openingByAccount
      .filter((a) => a.openingMinor !== 0n)
      .map((a) => (a.openingMinor > 0n ? { accountNumber: a.number, debitMinor: a.openingMinor } : { accountNumber: a.number, creditMinor: -a.openingMinor }));
    const dr = openLines.reduce((s, l) => s + (l.debitMinor ?? 0n), 0n);
    const cr = openLines.reduce((s, l) => s + (l.creditMinor ?? 0n), 0n);
    if (openLines.length >= 2 && dr === cr) {
      const openDate = parsed.periodStart ? addDaysIso(parsed.periodStart, -1) : '1970-01-01';
      const e = await postJournalEntry(db, {
        organizationId: org,
        actor: params.actor,
        entryDate: openDate,
        description: `Inngående balanse importert fra SAF-T (${parsed.periodStart ?? ''})`.trim(),
        idempotencyKey: `saft-replay-open:${parsed.periodStart ?? 'na'}`,
        lines: openLines,
      });
      openingEntryNumber = e.entryNumber;
    }
  }

  // 4) Spill av hver transaksjon (kronologisk). Ubalanserte hoppes over og rapporteres.
  let transactionsPosted = 0;
  let transactionsSkipped = 0;
  let linesPosted = 0;
  const unbalanced: string[] = [];
  for (const t of parsed.transactions) {
    if (!t.balanced) {
      unbalanced.push(t.id);
      transactionsSkipped++;
      continue;
    }
    // Fiken legger SupplierID/CustomerID på RESKONTRO-linjen (2400/1500), ikke på
    // kostnads-/inntektslinjen. For at leverandør-/kunde-analyse (faste utgifter,
    // avstemming) skal virke må parten tagges på HELE bilaget — slik en vanlig
    // postering i Reknaren gjør. Propager derfor en entydig transaksjons-part til
    // alle linjer som ikke har en eksplisitt part.
    const supRefs = new Set(t.lines.map((l) => l.supplierRef).filter((x): x is string => !!x));
    const cusRefs = new Set(t.lines.map((l) => l.customerRef).filter((x): x is string => !!x));
    const txnSup = supRefs.size === 1 && cusRefs.size === 0 ? [...supRefs][0]! : null;
    const txnCus = cusRefs.size === 1 && supRefs.size === 0 ? [...cusRefs][0]! : null;
    const lines: JournalLineInput[] = t.lines.map((l) => {
      const line: JournalLineInput = { accountNumber: l.accountNumber };
      if (l.debitMinor > 0n) line.debitMinor = l.debitMinor;
      if (l.creditMinor > 0n) line.creditMinor = l.creditMinor;
      if (l.description) line.description = l.description;
      const supRef = l.supplierRef ?? txnSup;
      const cusRef = l.customerRef ?? txnCus;
      const vid = supRef ? sup.map.get(supRef) : undefined;
      const cid = cusRef ? cus.map.get(cusRef) : undefined;
      if (vid) line.vendorId = vid;
      if (cid) line.customerId = cid;
      return line;
    });
    await postJournalEntry(db, {
      organizationId: org,
      actor: params.actor,
      entryDate: t.date,
      description: t.description ?? `SAF-T ${t.id}`,
      idempotencyKey: `saft-txn:${t.id}`,
      lines,
    });
    transactionsPosted++;
    linesPosted += lines.length;
  }

  return {
    periodStart: parsed.periodStart,
    periodEnd: parsed.periodEnd,
    openingEntryNumber,
    accountsEnsured,
    suppliersCreated: sup.created,
    customersCreated: cus.created,
    transactionsPosted,
    transactionsSkipped,
    linesPosted,
    unbalanced,
  };
}
