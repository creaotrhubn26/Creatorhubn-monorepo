/**
 * MVA-motoren. All beregning er deterministisk og reproduserbar:
 * satser hentes fra det versjonerte regelregisteret per transaksjonsdato,
 * aritmetikken er eksakt (bigint), og rapporten bygges utelukkende fra
 * bokførte posteringslinjer.
 */
import { getVatCode, VAT_CODES } from '../coa/vat-codes.js';
import type { Db } from '../db/pool.js';
import type { RuleRegister } from '../rules/register.js';
import { NotFoundError, ValidationError } from '../shared/errors.js';
import { money, multiplyRational, type Money } from '../shared/money.js';

export interface VatParts {
  netMinor: bigint;
  vatMinor: bigint;
  grossMinor: bigint;
  ratePct: string; // f.eks. '25' — til visning/forklaring
}

/**
 * Splitter et bruttobeløp (inkl. mva) i netto og mva for en gitt kode og dato.
 * mva = brutto × sats / (100 + sats), avrundet half-up på øret.
 */
export function splitGrossByVatCode(
  rules: RuleRegister,
  vatCode: string,
  grossMinor: bigint,
  isoDate: string,
): VatParts {
  const code = getVatCode(vatCode);
  if (!code) throw new NotFoundError(`Ukjent mva-kode: ${vatCode}`);
  if (!code.rateRuleId) {
    return { netMinor: grossMinor, vatMinor: 0n, grossMinor, ratePct: '0' };
  }
  const rate = rules.getRationalParamAt(code.rateRuleId, 'rate', isoDate);
  // sats er f.eks. 25/100. mva-andel av brutto = brutto × (n/d) / (1 + n/d) = brutto × n / (d + n)
  const vat = multiplyRational(
    money(grossMinor, 'NOK'),
    rate.numerator,
    rate.denominator + rate.numerator,
  );
  return {
    netMinor: grossMinor - vat.minorUnits,
    vatMinor: vat.minorUnits,
    grossMinor,
    ratePct: formatRatePct(rate.numerator, rate.denominator),
  };
}

/** Beregner mva av et nettobeløp (ekskl. mva). */
export function vatOfNet(
  rules: RuleRegister,
  vatCode: string,
  netMinor: bigint,
  isoDate: string,
): VatParts {
  const code = getVatCode(vatCode);
  if (!code) throw new NotFoundError(`Ukjent mva-kode: ${vatCode}`);
  if (!code.rateRuleId) {
    return { netMinor, vatMinor: 0n, grossMinor: netMinor, ratePct: '0' };
  }
  const rate = rules.getRationalParamAt(code.rateRuleId, 'rate', isoDate);
  const vat: Money = multiplyRational(money(netMinor, 'NOK'), rate.numerator, rate.denominator);
  return {
    netMinor,
    vatMinor: vat.minorUnits,
    grossMinor: netMinor + vat.minorUnits,
    ratePct: formatRatePct(rate.numerator, rate.denominator),
  };
}

function formatRatePct(numerator: bigint, denominator: bigint): string {
  // Satser er alltid n/100 i registeret; håndter promille (n/1000) også.
  if (denominator === 100n) return numerator.toString();
  if (denominator === 1000n) {
    const whole = numerator / 10n;
    const frac = numerator % 10n;
    return frac === 0n ? whole.toString() : `${whole}.${frac}`;
  }
  return `${numerator}/${denominator}`;
}

/** Kontroll: stemmer oppgitt mva-beløp med satsen for koden (± toleranse i øre)? */
export function vatAmountMatches(
  rules: RuleRegister,
  vatCode: string,
  netMinor: bigint,
  claimedVatMinor: bigint,
  isoDate: string,
  toleranceMinor = 2n,
): boolean {
  const expected = vatOfNet(rules, vatCode, netMinor, isoDate).vatMinor;
  const diff = expected - claimedVatMinor;
  return (diff < 0n ? -diff : diff) <= toleranceMinor;
}

export interface VatReportLine {
  vatCode: string;
  name: string;
  mvaMeldingCode: string;
  baseMinor: bigint;
  vatMinor: bigint;
}

export interface VatReport {
  organizationId: string;
  fromDate: string;
  toDate: string;
  status: 'draft';
  lines: VatReportLine[];
  outputVatMinor: bigint;
  deductibleInputVatMinor: bigint;
  /** positivt = å betale, negativt = til gode */
  netPayableMinor: bigint;
  generatedAt: string;
  /** Poster der grunnlag finnes men mva-linje mangler, o.l. */
  warnings: string[];
}

/**
 * MVA-spesifikasjon for en periode, aggregert per SAF-T-kode fra hovedboken.
 * Grunnlag = linjer på ikke-mva-kontoer med koden; mva-beløp = linjer på
 * mva-kontoene (2700/2710/2740) med koden. Toveis kontrollspor: hver krone i
 * rapporten kan følges tilbake til posteringslinjer.
 */
export async function buildVatReport(
  db: Db,
  organizationId: string,
  fromDate: string,
  toDate: string,
): Promise<VatReport> {
  if (fromDate > toDate) throw new ValidationError('fromDate må være før toDate.');
  const res = await db.query(
    `SELECT l.vat_code, l.account_number,
            SUM(l.debit_minor - l.credit_minor)::TEXT AS net_debit
     FROM journal_lines l
     JOIN journal_entries e ON e.id = l.entry_id
     WHERE l.organization_id = $1
       AND e.entry_date >= $2 AND e.entry_date <= $3
       AND l.vat_code IS NOT NULL
     GROUP BY l.vat_code, l.account_number`,
    [organizationId, fromDate, toDate],
  );

  const VAT_ACCOUNTS = new Set(['2700', '2710', '2740']);
  const byCode = new Map<string, { baseMinor: bigint; vatMinor: bigint }>();
  for (const row of res.rows) {
    const codeStr: string = row.vat_code;
    const agg = byCode.get(codeStr) ?? { baseMinor: 0n, vatMinor: 0n };
    const netDebit = BigInt(row.net_debit);
    if (VAT_ACCOUNTS.has(row.account_number)) {
      agg.vatMinor += netDebit; // debet 2710 (inngående) positiv; kredit 2700 (utgående) negativ
    } else {
      agg.baseMinor += netDebit;
    }
    byCode.set(codeStr, agg);
  }

  const warnings: string[] = [];
  const lines: VatReportLine[] = [];
  let outputVat = 0n;
  let inputVat = 0n;
  for (const [codeStr, agg] of [...byCode.entries()].sort()) {
    const def = getVatCode(codeStr);
    if (!def) {
      warnings.push(`Ukjent mva-kode ${codeStr} funnet i hovedboken.`);
      continue;
    }
    if (def.direction === 'output') {
      // Utgående: grunnlag står som kredit (negativ netDebit), mva som kredit 2700.
      lines.push({
        vatCode: codeStr,
        name: def.name,
        mvaMeldingCode: def.mvaMeldingCode,
        baseMinor: -agg.baseMinor,
        vatMinor: -agg.vatMinor,
      });
      outputVat += -agg.vatMinor;
    } else if (def.direction === 'input') {
      lines.push({
        vatCode: codeStr,
        name: def.name,
        mvaMeldingCode: def.mvaMeldingCode,
        baseMinor: agg.baseMinor,
        vatMinor: agg.vatMinor,
      });
      if (def.deductible) inputVat += agg.vatMinor;
      // Omvendt avgiftsplikt: utgående-siden av 86/81 står som kredit på 2700 med samme kode,
      // og er allerede fanget i vatMinor-aggregatet over (netto).
    } else {
      lines.push({
        vatCode: codeStr,
        name: def.name,
        mvaMeldingCode: def.mvaMeldingCode,
        baseMinor: agg.baseMinor < 0n ? -agg.baseMinor : agg.baseMinor,
        vatMinor: 0n,
      });
    }
    if (def.rateRuleId === null && agg.vatMinor !== 0n && def.direction !== 'input') {
      warnings.push(`Koden ${codeStr} skal ikke ha mva-beløp, men har ${agg.vatMinor} øre.`);
    }
  }

  return {
    organizationId,
    fromDate,
    toDate,
    status: 'draft',
    lines,
    outputVatMinor: outputVat,
    deductibleInputVatMinor: inputVat,
    netPayableMinor: outputVat - inputVat,
    generatedAt: new Date().toISOString(),
    warnings,
  };
}

/** Alle koder til kodebiblioteket. */
export function listVatCodes() {
  return VAT_CODES;
}
