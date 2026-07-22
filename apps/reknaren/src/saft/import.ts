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
