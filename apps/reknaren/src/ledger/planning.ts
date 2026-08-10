/**
 * Planlegger — Reknaren fremover. Én framoverskuende prognose som binder sammen
 * det systemet allerede vet: forventet MVA, skatt, likviditet, ubetalte fakturaer,
 * kommende kostnader og hva som mangler av bilag/avstemminger.
 *
 * Deterministisk og ærlig: bygger på faktiske forfallsdatoer og bokførte tall.
 * Ingen gjettede/gjentakende poster i v1 — kun det som er kjent. Likviditets-
 * prognosen går 90 dager fram i ukesbøtter.
 */
import type { Db } from '../db/pool.js';
import type { RuleRegister } from '../rules/register.js';
import type { OrganizationForm } from '../rules/types.js';
import { buildTaxEstimate } from '../tax/estimate.js';
import { buildVatReport } from '../vat/engine.js';

const HORIZON_DAYS = 90;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface CashflowItem {
  date: string;
  label: string;
  amountMinor: bigint; // positivt = inn, negativt = ut
  kind: 'invoice_in' | 'vat_out' | 'supplier_out' | 'recurring_out' | 'tax_out';
}

export interface TaxInstallment {
  dueDate: string;
  amountMinor: bigint;
}

export interface TimelineWeek {
  weekStart: string;
  inflowMinor: bigint;
  outflowMinor: bigint;
  projectedBalanceMinor: bigint;
}

export interface RecurringCost {
  vendor: string;
  amountMinor: bigint; // median per forekomst
  cadence: 'monthly' | 'quarterly';
  occurrences: number;
  lastDate: string;
  nextDates: string[]; // projiserte forfall innen horisonten
  confidence: 'high' | 'assumed';
}

export interface Forecast {
  asOf: string;
  horizonDays: number;
  cashNowMinor: bigint;
  forventetMva: {
    fromDate: string;
    toDate: string;
    dueDate: string;
    netPayableMinor: bigint; // positivt = å betale, negativt = til gode
  };
  skatt: {
    estimatedTaxMinor: bigint;
    recommendedReserveMinor: bigint;
    /** Anslåtte forskuddsskatt-terminer innen horisonten. */
    terminer: TaxInstallment[];
  };
  ubetalteFakturaer: {
    totalMinor: bigint;
    overdueMinor: bigint;
    count: number;
    items: { invoiceNumber: string | null; customer: string; dueDate: string | null; outstandingMinor: bigint; overdue: boolean }[];
  };
  kommendeKostnader: {
    leverandorgjeldMinor: bigint;
    items: { vendor: string; dueDate: string; amountMinor: bigint }[];
  };
  gjentakendeKostnader: RecurringCost[];
  mangler: {
    bilagTilBehandling: number;
    uavstemteBanktransaksjoner: number;
  };
  likviditet: {
    timeline: TimelineWeek[];
    endBalanceMinor: bigint;
    lowestBalanceMinor: bigint;
    lowestWeekStart: string;
    goesNegative: boolean;
  };
  warnings: string[];
}

/** Norsk 2-måneders MVA-termin som inneholder datoen, med forfallsfrist. */
function vatTerm(iso: string): { from: string; to: string; due: string } {
  const [y, m] = iso.split('-').map(Number) as [number, number];
  const termIndex = Math.floor((m - 1) / 2); // 0..5
  const startMonth = termIndex * 2 + 1;
  const endMonth = termIndex * 2 + 2;
  const pad = (n: number) => String(n).padStart(2, '0');
  const lastDay = new Date(Date.UTC(y, endMonth, 0)).getUTCDate(); // dag 0 i neste måned = siste dag
  // Frist: 1 måned og 10 dager etter terminens utløp → den 10. i (endMonth + 2).
  let dueMonth = endMonth + 2;
  let dueYear = y;
  if (dueMonth > 12) {
    dueMonth -= 12;
    dueYear += 1;
  }
  return {
    from: `${y}-${pad(startMonth)}-01`,
    to: `${y}-${pad(endMonth)}-${pad(lastDay)}`,
    due: `${dueYear}-${pad(dueMonth)}-10`,
  };
}

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

const dayMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

/**
 * Forskuddsskatt-terminer som faller innen horisonten. AS betaler i to terminer
 * (15. februar og 15. april året etter), ENK i fire (15. mars/juni/september/
 * desember i året). Beløp = annualisert skatteestimat delt på antall terminer —
 * et anslag, ikke Skatteetatens fastsatte forskuddsskatt.
 */
function taxInstallments(
  orgForm: OrganizationForm,
  asOf: string,
  horizonEnd: string,
  annualTaxMinor: bigint,
): TaxInstallment[] {
  const isCompany = ['AS', 'NUF', 'SA'].includes(orgForm);
  const schedule: [number, number][] = isCompany
    ? [[2, 15], [4, 15]]
    : [[3, 15], [6, 15], [9, 15], [12, 15]];
  const per = annualTaxMinor > 0n ? annualTaxMinor / BigInt(schedule.length) : 0n;
  if (per <= 0n) return [];
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = Number(asOf.slice(0, 4));
  const out: TaxInstallment[] = [];
  for (const y of [year, year + 1]) {
    for (const [m, d] of schedule) {
      const dueDate = `${y}-${pad(m)}-${pad(d)}`;
      if (dueDate >= asOf && dueDate <= horizonEnd) out.push({ dueDate, amountMinor: per });
    }
  }
  return out.sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
}
function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}
function medianBig(vals: bigint[]): bigint {
  const s = [...vals].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2n;
}

/**
 * Finner faste/gjentakende kostnader ved å se etter periodiske mønstre per
 * leverandør (≥3 forekomster, jevnt intervall, likt beløp), og projiserer neste
 * forfall innen horisonten. Heuristisk → merkes «anslått», aldri bokført.
 */
async function detectRecurringCosts(
  db: Db,
  org: string,
  asOf: string,
  horizonEnd: string,
): Promise<RecurringCost[]> {
  const rows = await db.query(
    `SELECT je.entry_date::TEXT AS d, MAX(l.vendor_id::text) AS vendor_id, SUM(l.debit_minor)::TEXT AS amount
     FROM journal_entries je JOIN journal_lines l ON l.entry_id = je.id
     WHERE je.organization_id = $1 AND je.status = 'posted' AND je.is_closing = FALSE
       AND je.entry_date <= $2
     GROUP BY je.id, je.entry_date
     HAVING MAX(l.vendor_id::text) IS NOT NULL AND SUM(l.debit_minor) > 0
     ORDER BY 2, 1`,
    [org, asOf],
  );
  const byVendor = new Map<string, { d: string; amt: bigint }[]>();
  for (const r of rows.rows) {
    const arr = byVendor.get(r.vendor_id) ?? [];
    arr.push({ d: r.d, amt: BigInt(r.amount) });
    byVendor.set(r.vendor_id, arr);
  }
  const vids = [...byVendor.keys()];
  const names = new Map<string, string>();
  if (vids.length) {
    const nrow = await db.query(`SELECT id::text AS id, name FROM vendors WHERE id = ANY($1::uuid[])`, [vids]);
    for (const n of nrow.rows) names.set(n.id, n.name);
  }
  const horizonMs = dayMs(horizonEnd);
  const asOfMs = dayMs(asOf);
  const result: RecurringCost[] = [];
  for (const [vid, occ] of byVendor) {
    if (occ.length < 3) continue;
    const days = occ.map((o) => dayMs(o.d));
    const intervals: number[] = [];
    for (let i = 1; i < days.length; i++) intervals.push(Math.round((days[i]! - days[i - 1]!) / 86400000));
    const medInt = median(intervals);
    const cadence: 'monthly' | 'quarterly' | null =
      medInt >= 25 && medInt <= 35 ? 'monthly' : medInt >= 80 && medInt <= 100 ? 'quarterly' : null;
    if (!cadence) continue;
    const medAmt = medianBig(occ.map((o) => o.amt));
    if (medAmt <= 0n) continue;
    const lo = (medAmt * 70n) / 100n;
    const hi = (medAmt * 130n) / 100n;
    const within = occ.filter((o) => o.amt >= lo && o.amt <= hi).length;
    if (within < Math.ceil(occ.length * 0.6)) continue;
    const stepMs = medInt * 86400000;
    const nextDates: string[] = [];
    let t = days[days.length - 1]! + stepMs;
    while (t <= horizonMs && nextDates.length < 6) {
      if (t >= asOfMs) nextDates.push(new Date(t).toISOString().slice(0, 10));
      t += stepMs;
    }
    if (nextDates.length === 0) continue;
    result.push({
      vendor: names.get(vid) ?? 'Leverandør',
      amountMinor: medAmt,
      cadence,
      occurrences: occ.length,
      lastDate: occ[occ.length - 1]!.d,
      nextDates,
      confidence: occ.length >= 4 && within === occ.length ? 'high' : 'assumed',
    });
  }
  return result.sort((a, b) => (b.amountMinor > a.amountMinor ? 1 : b.amountMinor < a.amountMinor ? -1 : 0));
}

export async function buildForecast(
  db: Db,
  rules: RuleRegister,
  params: { organizationId: string; orgForm: OrganizationForm; asOf: string },
): Promise<Forecast> {
  const { organizationId: org, orgForm, asOf } = params;
  const yearStart = `${asOf.slice(0, 4)}-01-01`;
  const horizonEnd = addDaysIso(asOf, HORIZON_DAYS);
  const warnings: string[] = [];

  // 1) Bankbeholdning nå (kontanter + bankinnskudd, 19xx).
  const cashRow = await db.query(
    `SELECT COALESCE(SUM(l.debit_minor - l.credit_minor), 0)::TEXT AS bal
     FROM journal_lines l JOIN journal_entries e ON e.id = l.entry_id
     WHERE l.organization_id = $1 AND e.entry_date <= $2
       AND l.account_number >= '1900' AND l.account_number <= '1999'`,
    [org, asOf],
  );
  const cashNowMinor = BigInt(cashRow.rows[0].bal);

  // 2) Forventet MVA — inneværende termin så langt, med forfallsdato.
  const term = vatTerm(asOf);
  const vat = await buildVatReport(db, org, term.from, asOf);
  const forventetMva = {
    fromDate: term.from,
    toDate: term.to,
    dueDate: term.due,
    netPayableMinor: vat.netPayableMinor,
  };

  // 3) Skatt — løpende estimat + anbefalt reserve + anslåtte forskuddsskatt-terminer.
  const tax = await buildTaxEstimate(db, rules, { organizationId: org, orgForm, fromDate: yearStart, toDate: asOf });
  // Annualiser skatten hittil i år som grunnlag for terminbeløpene.
  const daysElapsed = Math.max(1, Math.round((dayMs(asOf) - dayMs(yearStart)) / 86400000) + 1);
  const annualTaxMinor = (tax.estimatedTaxMinor * 365n) / BigInt(daysElapsed);
  const skatteterminer = taxInstallments(orgForm, asOf, horizonEnd, annualTaxMinor);

  // 4) Ubetalte kundefakturaer (forventede innbetalinger).
  const recv = await db.query(
    `SELECT i.invoice_number::TEXT AS invoice_number, c.name AS customer,
            i.due_date::TEXT AS due_date, (i.gross_minor - i.paid_minor)::TEXT AS outstanding
     FROM invoices i JOIN customers c ON c.id = i.customer_id
     WHERE i.organization_id = $1 AND i.status = 'issued' AND i.paid_minor < i.gross_minor
     ORDER BY i.due_date NULLS LAST`,
    [org],
  );
  const receivableItems = recv.rows.map((r) => {
    const outstandingMinor = BigInt(r.outstanding);
    const overdue = r.due_date !== null && r.due_date < asOf;
    return { invoiceNumber: r.invoice_number, customer: r.customer, dueDate: r.due_date as string | null, outstandingMinor, overdue };
  });
  const ubetalteFakturaer = {
    totalMinor: receivableItems.reduce((a, i) => a + i.outstandingMinor, 0n),
    overdueMinor: receivableItems.filter((i) => i.overdue).reduce((a, i) => a + i.outstandingMinor, 0n),
    count: receivableItems.length,
    items: receivableItems,
  };

  // 5) Kommende kostnader — leverandørgjeld (2400) + kjente forfall fra bilag.
  const apRow = await db.query(
    `SELECT COALESCE(-SUM(l.debit_minor - l.credit_minor), 0)::TEXT AS owed
     FROM journal_lines l JOIN journal_entries e ON e.id = l.entry_id
     WHERE l.organization_id = $1 AND e.entry_date <= $2 AND l.account_number = '2400'`,
    [org, asOf],
  );
  const leverandorgjeldMinor = BigInt(apRow.rows[0].owed);
  const supplierDue = await db.query(
    `SELECT ed.vendor_name AS vendor, ed.due_date::TEXT AS due_date, ed.gross_minor::TEXT AS gross
     FROM source_documents d
     JOIN LATERAL (
       SELECT vendor_name, due_date, gross_minor FROM extracted_document_data
       WHERE document_id = d.id ORDER BY extraction_version DESC LIMIT 1
     ) ed ON true
     WHERE d.organization_id = $1 AND d.status = 'posted'
       AND ed.due_date IS NOT NULL AND ed.due_date >= $2 AND ed.due_date <= $3 AND ed.gross_minor IS NOT NULL
     ORDER BY ed.due_date`,
    [org, asOf, horizonEnd],
  );
  const supplierItems = supplierDue.rows.map((r) => ({
    vendor: (r.vendor as string) ?? 'Leverandør',
    dueDate: r.due_date as string,
    amountMinor: BigInt(r.gross),
  }));
  const kommendeKostnader = { leverandorgjeldMinor, items: supplierItems };

  // 6) Hva mangler — bilag til behandling + uavstemte banktransaksjoner.
  const waiting = await db.query(
    `SELECT COUNT(*)::int AS n FROM source_documents
     WHERE organization_id = $1 AND status IN ('needs_review','extracted')`,
    [org],
  );
  const unmatched = await db.query(
    `SELECT COUNT(*)::int AS n FROM bank_transactions WHERE organization_id = $1 AND status = 'unmatched'`,
    [org],
  );
  const mangler = {
    bilagTilBehandling: waiting.rows[0].n as number,
    uavstemteBanktransaksjoner: unmatched.rows[0].n as number,
  };

  // 6b) Faste/gjentakende kostnader — projisert framover (anslått).
  const gjentakendeKostnader = await detectRecurringCosts(db, org, asOf, horizonEnd);

  // 7) Likviditets-tidslinje — 90 dager i ukesbøtter fra bankbeholdning nå.
  const events: CashflowItem[] = [];
  for (const rc of gjentakendeKostnader) {
    for (const d of rc.nextDates) {
      events.push({ date: d, label: `${rc.vendor} (fast)`, amountMinor: -rc.amountMinor, kind: 'recurring_out' });
    }
  }
  for (const t of skatteterminer) {
    events.push({ date: t.dueDate, label: 'Forskuddsskatt (anslått)', amountMinor: -t.amountMinor, kind: 'tax_out' });
  }
  for (const inv of receivableItems) {
    // Forfalte fordringer forventes inn «nå» (uke 0); ellers på forfallsdato innen horisonten.
    const when = !inv.dueDate || inv.dueDate < asOf ? asOf : inv.dueDate;
    if (when <= horizonEnd) {
      events.push({ date: when, label: `Innbetaling faktura ${inv.invoiceNumber ?? ''}`.trim(), amountMinor: inv.outstandingMinor, kind: 'invoice_in' });
    }
  }
  for (const s of supplierItems) {
    events.push({ date: s.dueDate, label: `Betaling ${s.vendor}`, amountMinor: -s.amountMinor, kind: 'supplier_out' });
  }
  if (forventetMva.netPayableMinor > 0n && forventetMva.dueDate >= asOf && forventetMva.dueDate <= horizonEnd) {
    events.push({ date: forventetMva.dueDate, label: 'MVA-oppgjør', amountMinor: -forventetMva.netPayableMinor, kind: 'vat_out' });
  }

  const timeline: TimelineWeek[] = [];
  let running = cashNowMinor;
  let lowest = cashNowMinor;
  let lowestWeekStart = asOf;
  const startMs = Date.parse(`${asOf}T00:00:00Z`);
  for (let w = 0; w < Math.ceil(HORIZON_DAYS / 7); w++) {
    const weekStartMs = startMs + w * WEEK_MS;
    const weekEndMs = weekStartMs + WEEK_MS;
    const weekStart = new Date(weekStartMs).toISOString().slice(0, 10);
    let inflow = 0n;
    let outflow = 0n;
    for (const ev of events) {
      const evMs = Date.parse(`${ev.date}T00:00:00Z`);
      if (evMs >= weekStartMs && evMs < weekEndMs) {
        if (ev.amountMinor > 0n) inflow += ev.amountMinor;
        else outflow += -ev.amountMinor;
      }
    }
    running = running + inflow - outflow;
    if (running < lowest) {
      lowest = running;
      lowestWeekStart = weekStart;
    }
    timeline.push({ weekStart, inflowMinor: inflow, outflowMinor: outflow, projectedBalanceMinor: running });
  }

  const goesNegative = lowest < 0n;
  if (goesNegative) {
    warnings.push(`Prognosen viser at kontoen kan gå i minus (laveste ${(lowest / 100n).toString()} kr rundt ${lowestWeekStart}). Følg opp innbetalinger eller utsett kostnader.`);
  }
  if (gjentakendeKostnader.length > 0) {
    warnings.push(
      `Tidslinjen inkluderer ${gjentakendeKostnader.length} anslått${gjentakendeKostnader.length > 1 ? 'e' : ''} fast${gjentakendeKostnader.length > 1 ? 'e' : ''} kostnad${gjentakendeKostnader.length > 1 ? 'er' : ''} (gjenkjent fra historikken), i tillegg til kjente bokførte forfall.`,
    );
  } else {
    warnings.push('Prognosen bygger på kjente bokførte forfall. Ingen faste kostnader gjenkjent ennå.');
  }
  if (skatteterminer.length > 0) {
    warnings.push('Skatteterminene er anslag basert på resultatet hittil i år, ikke Skatteetatens fastsatte forskuddsskatt.');
  }

  return {
    asOf,
    horizonDays: HORIZON_DAYS,
    cashNowMinor,
    forventetMva,
    skatt: {
      estimatedTaxMinor: tax.estimatedTaxMinor,
      recommendedReserveMinor: tax.recommendedReserveMinor,
      terminer: skatteterminer,
    },
    ubetalteFakturaer,
    kommendeKostnader,
    gjentakendeKostnader,
    mangler,
    likviditet: { timeline, endBalanceMinor: running, lowestBalanceMinor: lowest, lowestWeekStart, goesNegative },
    warnings,
  };
}
