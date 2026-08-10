/**
 * Betalingskalender: én datert tidslinje som viser BÅDE hva som er betalt/ført
 * (bakover) og hva som forventes (framover) — faste utgifter, MVA- og skatte-
 * forfall, og forfalte kundefakturaer. Slår sammen det systemet allerede vet
 * (buildForecast + forventningsvakten + posterte bilag) til daterte hendelser.
 * REN LESING.
 */
import type { Db } from '../db/pool.js';
import type { RuleRegister } from '../rules/register.js';
import type { OrganizationForm } from '../rules/types.js';
import { buildForecast } from './planning.js';
import { assessRecurringDue } from './recurring.js';

export type CalKind = 'paid' | 'recurring' | 'vat' | 'tax' | 'invoice_in';
export type CalStatus = 'paid' | 'expected' | 'overdue';

export interface CalendarEvent {
  date: string; // ISO
  kind: CalKind;
  direction: 'in' | 'out';
  label: string;
  amountMinor: string; // alltid positivt; retning i `direction`
  status: CalStatus;
  vendor?: string;
}

export async function buildPaymentCalendar(
  db: Db,
  rules: RuleRegister,
  params: { organizationId: string; orgForm: OrganizationForm; from: string; to: string; asOf?: string },
): Promise<{ from: string; to: string; asOf: string; events: CalendarEvent[] }> {
  const org = params.organizationId;
  const asOf = params.asOf ?? new Date().toISOString().slice(0, 10);
  const events: CalendarEvent[] = [];

  // ── Bakover: faktisk bokførte kostnader/betalinger i vinduet ─────────────
  const paid = (
    await db.query(
      `SELECT je.entry_date::text AS d, je.description,
              MAX(v.name) AS vendor,
              SUM(l.debit_minor) FILTER (WHERE l.account_number ~ '^[4-7]') AS cost
       FROM journal_entries je
       JOIN journal_lines l ON l.entry_id = je.id
       LEFT JOIN vendors v ON v.id = l.vendor_id
       WHERE je.organization_id = $1 AND je.status = 'posted' AND je.is_closing = FALSE
         AND je.entry_date BETWEEN $2 AND $3
       GROUP BY je.id, je.entry_date, je.description
       HAVING SUM(l.debit_minor) FILTER (WHERE l.account_number ~ '^[4-7]') > 0
       ORDER BY je.entry_date`,
      [org, params.from, asOf < params.to ? asOf : params.to],
    )
  ).rows;
  for (const r of paid) {
    events.push({
      date: r.d,
      kind: 'paid',
      direction: 'out',
      label: r.vendor ?? r.description ?? 'Kostnad',
      amountMinor: String(r.cost),
      status: 'paid',
      ...(r.vendor ? { vendor: r.vendor } : {}),
    });
  }

  // ── Framover: forventet ──────────────────────────────────────────────────
  const forecast = await buildForecast(db, rules, { organizationId: org, orgForm: params.orgForm, asOf });
  const inWindow = (d: string) => d >= params.from && d <= params.to;

  // MVA-forfall
  if (inWindow(forecast.forventetMva.dueDate)) {
    const net = forecast.forventetMva.netPayableMinor;
    events.push({
      date: forecast.forventetMva.dueDate,
      kind: 'vat',
      direction: net >= 0n ? 'out' : 'in',
      label: net >= 0n ? 'MVA å betale' : 'MVA til gode',
      amountMinor: (net < 0n ? -net : net).toString(),
      status: forecast.forventetMva.dueDate < asOf ? 'overdue' : 'expected',
    });
  }
  // Forskuddsskatt-terminer
  for (const t of forecast.skatt.terminer) {
    if (inWindow(t.dueDate)) events.push({ date: t.dueDate, kind: 'tax', direction: 'out', label: 'Forskuddsskatt (anslag)', amountMinor: t.amountMinor.toString(), status: t.dueDate < asOf ? 'overdue' : 'expected' });
  }
  // Forfalte/ubetalte kundefakturaer (inn)
  for (const inv of forecast.ubetalteFakturaer.items) {
    if (inv.dueDate && inWindow(inv.dueDate)) {
      events.push({ date: inv.dueDate, kind: 'invoice_in', direction: 'in', label: `Faktura ${inv.invoiceNumber ?? ''} — ${inv.customer}`.trim(), amountMinor: inv.outstandingMinor.toString(), status: inv.overdue ? 'overdue' : 'expected', vendor: inv.customer });
    }
  }

  // ── Faste utgifter fra forventningsvakten (bekreftede) ───────────────────
  const rec = await assessRecurringDue(db, { organizationId: org, asOf, lookaheadDays: Math.max(0, Math.round((Date.parse(params.to) - Date.parse(asOf)) / 86400000)) });
  for (const it of rec.items) {
    for (const o of it.overdue) {
      if (inWindow(o.dueDate)) events.push({ date: o.dueDate, kind: 'recurring', direction: 'out', label: `${it.vendor} (fast) — mangler`, amountMinor: it.expectedAmountMinor, status: 'overdue', vendor: it.vendor });
    }
    for (const s of it.dueSoon) {
      if (inWindow(s.dueDate)) events.push({ date: s.dueDate, kind: 'recurring', direction: 'out', label: `${it.vendor} (fast)`, amountMinor: it.expectedAmountMinor, status: 'expected', vendor: it.vendor });
    }
  }

  events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { from: params.from, to: params.to, asOf, events };
}
