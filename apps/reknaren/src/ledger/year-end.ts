/**
 * Årsavslutning — steget mot skattemeldingen. Beregner årsresultat, skattemessig
 * resultat (med plass til manuelle justeringer), betalbar skatt, og for AS
 * bokfører skattekostnaden. Låser deretter hele året så tallene står fast.
 *
 * Deterministisk: satser fra regelregisteret per 31.12, bigint-øre, aldri
 * flyttall. For enkeltpersonforetak bokføres ingen skatt (skatten fastsettes
 * privat) — årsavslutningen låser året og danner grunnlag for næringsspesifikasjonen.
 * Idempotent: samme år kan «avsluttes» flere ganger uten å dobbeltbokføre.
 */
import type { Actor } from '../audit/audit.js';
import { recordAuditEvent } from '../audit/audit.js';
import { getAccountDef } from '../coa/accounts.js';
import type { Db, DbClient } from '../db/pool.js';
import { withTransaction } from '../db/pool.js';
import { formatMinorAsKr } from '../invoicing/view.js';
import { money, multiplyRational } from '../shared/money.js';
import { newId } from '../shared/ids.js';
import type { RuleRegister } from '../rules/register.js';
import type { OrganizationForm } from '../rules/types.js';
import { incomeStatement } from './reports.js';
import { lockPeriod, postJournalEntry } from './engine.js';

const COMPANY_FORMS: OrganizationForm[] = ['AS', 'NUF', 'SA'];
const TAX_ACCOUNT = '8300'; // Skattekostnad
const PAYABLE_TAX_ACCOUNT = '2500'; // Betalbar skatt
const EQUITY_ACCOUNT = '2050'; // Annen egenkapital

export interface YearEndLine {
  accountNumber: string;
  accountName: string;
  debitMinor: bigint;
  creditMinor: bigint;
}

export interface YearEndPeriod {
  month: number;
  status: 'open' | 'locked' | 'missing';
}

export interface YearEndPlan {
  year: number;
  orgForm: OrganizationForm;
  fromDate: string;
  toDate: string;
  /** Regnskapsmessig resultat før skatt. */
  accountingResultMinor: bigint;
  /** Manuelle skattemessige justeringer (permanente/midlertidige forskjeller). */
  adjustmentsMinor: bigint;
  taxableResultMinor: bigint;
  taxRatePct: string | null;
  payableTaxMinor: bigint;
  resultAfterTaxMinor: bigint;
  /** Forslag til skatteposteringen (null for ENK eller null-skatt). */
  taxEntry: YearEndLine[] | null;
  periods: YearEndPeriod[];
  /** true når skatteposteringen for året allerede er bokført. */
  taxAlreadyPosted: boolean;
  /** true når årsresultatet allerede er disponert til egenkapital. */
  dispositionAlreadyPosted: boolean;
  /** Egenkapitalkontoen årsresultatet overføres til. */
  dispositionAccount: string;
  /** true når alle tolv perioder er låst. */
  fullyLocked: boolean;
  warnings: string[];
}

function ratePctLabel(numerator: bigint, denominator: bigint): string {
  if (denominator === 100n) return numerator.toString();
  return `${(numerator * 100n) / denominator}`;
}

function taxIdempotencyKey(year: number): string {
  return `year-end-tax:${year}`;
}

function dispositionIdempotencyKey(year: number): string {
  return `year-end-disposal:${year}`;
}

/**
 * Bygger disponeringsbilaget: nuller resultatkontoene (Dr inntekt / Cr kostnad,
 * inkl. skattekostnad) og fører netto årsresultat til egenkapital (2050) —
 * overskudd som kredit, underskudd som debet. Leser driften (uten avslutningsbilag)
 * slik at samme år kan disponeres nøyaktig én gang.
 */
async function buildDispositionLines(
  db: Db,
  org: string,
  from: string,
  to: string,
): Promise<{ accountNumber: string; debitMinor?: bigint; creditMinor?: bigint }[]> {
  const inc = await incomeStatement(db, { organizationId: org, fromDate: from, toDate: to });
  const lines: { accountNumber: string; debitMinor?: bigint; creditMinor?: bigint }[] = [];
  for (const r of inc.byAccount) {
    if (r.balanceMinor === 0n) continue;
    if (r.accountType === 'revenue') {
      lines.push({ accountNumber: r.accountNumber, debitMinor: -r.balanceMinor }); // kreditsaldo → debiteres bort
    } else {
      lines.push({ accountNumber: r.accountNumber, creditMinor: r.balanceMinor }); // debetsaldo → krediteres bort
    }
  }
  if (lines.length === 0) return [];
  const result = inc.resultMinor;
  if (result > 0n) lines.push({ accountNumber: EQUITY_ACCOUNT, creditMinor: result });
  else if (result < 0n) lines.push({ accountNumber: EQUITY_ACCOUNT, debitMinor: -result });
  return lines;
}

async function loadPeriods(db: Db | DbClient, org: string, year: number): Promise<YearEndPeriod[]> {
  const rows = await db.query(
    `SELECT month, status FROM accounting_periods WHERE organization_id = $1 AND year = $2`,
    [org, year],
  );
  const byMonth = new Map<number, string>(rows.rows.map((r) => [Number(r.month), r.status as string]));
  const periods: YearEndPeriod[] = [];
  for (let m = 1; m <= 12; m++) {
    const status = byMonth.get(m);
    periods.push({ month: m, status: status === 'locked' ? 'locked' : status === 'open' ? 'open' : 'missing' });
  }
  return periods;
}

export interface YearEndParams {
  organizationId: string;
  year: number;
  orgForm: OrganizationForm;
  /** Manuelle skattemessige justeringer i øre (positivt øker skattegrunnlaget). */
  adjustmentsMinor?: bigint;
}

export async function computeYearEndPlan(
  db: Db,
  rules: RuleRegister,
  params: YearEndParams,
): Promise<YearEndPlan> {
  const { organizationId: org, year, orgForm } = params;
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const adjustments = params.adjustmentsMinor ?? 0n;
  const warnings: string[] = [];

  // Er skatten allerede bokført? Da viser vi de faste tallene, ikke en ny beregning.
  const posted = await db.query(
    `SELECT je.id, l.credit_minor
     FROM journal_entries je
     JOIN journal_lines l ON l.entry_id = je.id AND l.account_number = $3
     WHERE je.organization_id = $1 AND je.idempotency_key = $2 AND l.credit_minor > 0
     LIMIT 1`,
    [org, taxIdempotencyKey(year), PAYABLE_TAX_ACCOUNT],
  );
  const taxAlreadyPosted = (posted.rowCount ?? 0) > 0;

  const disposed = await db.query(
    `SELECT 1 FROM journal_entries WHERE organization_id = $1 AND idempotency_key = $2 LIMIT 1`,
    [org, dispositionIdempotencyKey(year)],
  );
  const dispositionAlreadyPosted = (disposed.rowCount ?? 0) > 0;

  const inc = await incomeStatement(db, { organizationId: org, fromDate: from, toDate: to });
  const periods = await loadPeriods(db, org, year);
  const fullyLocked = periods.every((p) => p.status === 'locked');

  const isCompany = COMPANY_FORMS.includes(orgForm);
  let payableTax = 0n;
  let taxRatePct: string | null = null;
  let taxEntry: YearEndLine[] | null = null;
  // Når skatten alt er bokført er `inc.resultMinor` etter skatt → legg den tilbake for å vise resultat før skatt.
  const alreadyPostedTax = taxAlreadyPosted ? BigInt(posted.rows[0].credit_minor) : 0n;
  const accountingResult = inc.resultMinor + alreadyPostedTax;

  if (isCompany) {
    const rate = rules.getRationalParamAt('no.tax.corporate-rate', 'rate', to);
    taxRatePct = ratePctLabel(rate.numerator, rate.denominator);
    if (taxAlreadyPosted) {
      payableTax = alreadyPostedTax;
    } else {
      const taxable = accountingResult + adjustments;
      if (taxable > 0n) {
        payableTax = multiplyRational(money(taxable, 'NOK'), rate.numerator, rate.denominator).minorUnits;
        const def = getAccountDef(TAX_ACCOUNT)!;
        const payDef = getAccountDef(PAYABLE_TAX_ACCOUNT)!;
        taxEntry = [
          { accountNumber: TAX_ACCOUNT, accountName: def.name, debitMinor: payableTax, creditMinor: 0n },
          { accountNumber: PAYABLE_TAX_ACCOUNT, accountName: payDef.name, debitMinor: 0n, creditMinor: payableTax },
        ];
      } else {
        warnings.push('Året går i null eller med underskudd — ingen betalbar skatt beregnes. Underskudd kan fremføres mot senere overskudd.');
      }
    }
  } else {
    warnings.push('Enkeltpersonforetak skatter ikke i selskapet — skatten fastsettes på din personlige skattemelding. Årsavslutningen låser året og danner grunnlaget for næringsspesifikasjonen.');
  }

  const taxableResult = accountingResult + adjustments > 0n ? accountingResult + adjustments : 0n;
  if (taxAlreadyPosted) warnings.push(`Skatten for ${year} er allerede bokført (${formatMinorAsKr(payableTax)} kr).`);
  if (!fullyLocked && periods.some((p) => p.status === 'locked')) {
    warnings.push('Noen måneder er allerede låst; resten låses når du gjennomfører årsavslutningen.');
  }

  return {
    year,
    orgForm,
    fromDate: from,
    toDate: to,
    accountingResultMinor: accountingResult,
    adjustmentsMinor: adjustments,
    taxableResultMinor: taxableResult,
    taxRatePct,
    payableTaxMinor: payableTax,
    resultAfterTaxMinor: accountingResult - payableTax,
    taxEntry,
    periods,
    taxAlreadyPosted,
    dispositionAlreadyPosted,
    dispositionAccount: EQUITY_ACCOUNT,
    fullyLocked,
    warnings,
  };
}

export interface YearEndReceipt {
  year: number;
  taxPosted: boolean;
  taxEntryNumber?: number;
  dispositionPosted: boolean;
  dispositionEntryNumber?: number;
  payableTaxMinor: bigint;
  lockedMonths: number[];
}

/** Sikrer at en standardkonto finnes i organisasjonens kontoplan (for eldre orgs). */
async function ensureAccount(client: DbClient, org: string, number: string): Promise<void> {
  const def = getAccountDef(number)!;
  await client.query(
    `INSERT INTO ledger_accounts (id, organization_id, account_number, name, account_type)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (organization_id, account_number) DO NOTHING`,
    [newId(), org, def.number, def.name, def.type],
  );
}

export async function executeYearEndClose(
  db: Db,
  rules: RuleRegister,
  params: YearEndParams & { actor: Actor },
): Promise<YearEndReceipt> {
  const plan = await computeYearEndPlan(db, rules, params);
  const { organizationId: org, year } = params;
  const to = `${year}-12-31`;
  let taxEntryNumber: number | undefined;
  let taxPosted = false;

  // 1) Bokfør skattekostnaden (AS, skatt > 0, ikke allerede bokført).
  if (plan.taxEntry && !plan.taxAlreadyPosted) {
    await withTransaction(db, async (client) => {
      await ensureAccount(client, org, TAX_ACCOUNT);
      await ensureAccount(client, org, PAYABLE_TAX_ACCOUNT);
    });
    const entry = await postJournalEntry(db, {
      organizationId: org,
      actor: params.actor,
      entryDate: to,
      description: `Årsavslutning ${year} — betalbar skatt`,
      lines: plan.taxEntry.map((l) => ({
        accountNumber: l.accountNumber,
        ...(l.debitMinor > 0n ? { debitMinor: l.debitMinor } : {}),
        ...(l.creditMinor > 0n ? { creditMinor: l.creditMinor } : {}),
      })),
      idempotencyKey: taxIdempotencyKey(year),
    });
    taxEntryNumber = entry.entryNumber;
    taxPosted = !entry.alreadyExisted;
  }

  // 2) Disponer årsresultatet til egenkapital (etter skatt). Merket is_closing,
  //    så resultatregnskapet fortsatt viser driften. Idempotent.
  let dispositionPosted = false;
  let dispositionEntryNumber: number | undefined;
  if (!plan.dispositionAlreadyPosted) {
    const lines = await buildDispositionLines(db, org, `${year}-01-01`, to);
    if (lines.length > 0) {
      await withTransaction(db, async (client) => {
        await ensureAccount(client, org, EQUITY_ACCOUNT);
      });
      const disp = await postJournalEntry(db, {
        organizationId: org,
        actor: params.actor,
        entryDate: to,
        description: `Årsavslutning ${year} — disponering av årsresultat`,
        lines,
        idempotencyKey: dispositionIdempotencyKey(year),
        isClosing: true,
      });
      dispositionEntryNumber = disp.entryNumber;
      dispositionPosted = !disp.alreadyExisted;
    }
  }

  // 3) Lås alle tolv perioder som ennå er åpne/mangler (hopp over allerede låste).
  const lockedMonths: number[] = [];
  for (const p of plan.periods) {
    if (p.status === 'locked') continue;
    await lockPeriod(db, {
      organizationId: org,
      actor: params.actor,
      year,
      month: p.month,
      reason: `Årsavslutning ${year}`,
    });
    lockedMonths.push(p.month);
  }

  // 3) Kontrollspor for selve årsavslutningen.
  await withTransaction(db, async (client) => {
    await recordAuditEvent(client, {
      organizationId: org,
      actor: params.actor,
      action: 'year_end.closed',
      entityType: 'organization',
      entityId: org,
      newValue: {
        year,
        payableTaxMinor: plan.payableTaxMinor.toString(),
        taxEntryNumber: taxEntryNumber ?? null,
        dispositionEntryNumber: dispositionEntryNumber ?? null,
        lockedMonths,
      },
    });
  });

  return {
    year,
    taxPosted,
    ...(taxEntryNumber !== undefined ? { taxEntryNumber } : {}),
    dispositionPosted,
    ...(dispositionEntryNumber !== undefined ? { dispositionEntryNumber } : {}),
    payableTaxMinor: plan.payableTaxMinor,
    lockedMonths,
  };
}
