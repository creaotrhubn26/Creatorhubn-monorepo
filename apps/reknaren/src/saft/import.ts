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
import { postJournalEntry } from '../ledger/engine.js';
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
