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
  kind: 'invoice_in' | 'vat_out' | 'supplier_out';
}

export interface TimelineWeek {
  weekStart: string;
  inflowMinor: bigint;
  outflowMinor: bigint;
  projectedBalanceMinor: bigint;
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

  // 3) Skatt — løpende estimat + anbefalt reserve (hittil i år).
  const tax = await buildTaxEstimate(db, rules, { organizationId: org, orgForm, fromDate: yearStart, toDate: asOf });

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

  // 7) Likviditets-tidslinje — 90 dager i ukesbøtter fra bankbeholdning nå.
  const events: CashflowItem[] = [];
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
  warnings.push('Prognosen bygger kun på kjente, bokførte forfall — ikke gjentakende eller estimerte poster.');

  return {
    asOf,
    horizonDays: HORIZON_DAYS,
    cashNowMinor,
    forventetMva,
    skatt: { estimatedTaxMinor: tax.estimatedTaxMinor, recommendedReserveMinor: tax.recommendedReserveMinor },
    ubetalteFakturaer,
    kommendeKostnader,
    mangler,
    likviditet: { timeline, endBalanceMinor: running, lowestBalanceMinor: lowest, lowestWeekStart, goesNegative },
    warnings,
  };
}
