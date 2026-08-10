/**
 * Avtaler / inntektsplaner. Løpende kundeavtaler (abonnement, retainer) som skal
 * faktureres etter en plan. Motoren gir det systemet «deretter kan gjøre»:
 * fakturaplan, kontroll av at avtalen faktisk er fakturert, sammenligning av
 * avtalt vs. fakturert, varsel før oppsigelsesfrist, periodiseringsflagg og
 * deteksjon av tapte inntekter. REN LESING i review — fakturering krever handling.
 */
import type { Actor } from '../audit/audit.js';
import { recordAuditEvent } from '../audit/audit.js';
import type { Db } from '../db/pool.js';
import { withTransaction } from '../db/pool.js';
import { ValidationError } from '../shared/errors.js';
import { newId } from '../shared/ids.js';

export type Cadence = 'monthly' | 'quarterly' | 'yearly' | 'one_time';

export interface Agreement {
  id: string;
  customerId: string;
  customerName: string;
  name: string;
  amountMinor: bigint;
  cadence: Cadence;
  startDate: string;
  endDate: string | null;
  noticeMonths: number;
  status: 'active' | 'ended' | 'paused';
}

const STEP_MONTHS: Record<Cadence, number> = { monthly: 1, quarterly: 3, yearly: 12, one_time: 0 };

function addMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1 + n, d));
  return dt.toISOString().slice(0, 10);
}

/** Alle avtalte fakturadatoer fra start til (og med) en horisont. */
function scheduleDates(cadence: Cadence, startDate: string, endDate: string | null, horizon: string): string[] {
  if (cadence === 'one_time') return startDate <= horizon ? [startDate] : [];
  const step = STEP_MONTHS[cadence];
  const dates: string[] = [];
  for (let k = 0; k < 600; k++) {
    const dt = addMonths(startDate, k * step);
    if (dt > horizon) break;
    if (endDate && dt > endDate) break;
    dates.push(dt);
  }
  return dates;
}

export async function createAgreement(
  db: Db,
  params: {
    organizationId: string;
    actor: Actor;
    customerId: string;
    name: string;
    amountMinor: bigint;
    cadence: Cadence;
    startDate: string;
    endDate?: string | null;
    noticeMonths?: number;
  },
): Promise<string> {
  if (params.amountMinor <= 0n) throw new ValidationError('Avtalt beløp må være positivt.');
  if (params.endDate && params.endDate < params.startDate) throw new ValidationError('Sluttdato kan ikke være før startdato.');
  const id = newId();
  await withTransaction(db, async (client) => {
    await client.query(
      `INSERT INTO agreements (id, organization_id, customer_id, name, amount_minor, cadence, start_date, end_date, notice_months, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, params.organizationId, params.customerId, params.name, params.amountMinor.toString(), params.cadence, params.startDate, params.endDate ?? null, params.noticeMonths ?? 0, params.actor.userId],
    );
    await recordAuditEvent(client, {
      organizationId: params.organizationId,
      actor: params.actor,
      action: 'agreement.created',
      entityType: 'agreement',
      entityId: id,
      newValue: { name: params.name, amountMinor: params.amountMinor.toString(), cadence: params.cadence },
    });
  });
  return id;
}

export async function listAgreements(db: Db, organizationId: string): Promise<Agreement[]> {
  const res = await db.query(
    `SELECT a.id, a.customer_id, c.name AS customer_name, a.name, a.amount_minor::TEXT AS amount_minor,
            a.cadence, a.start_date::TEXT AS start_date, a.end_date::TEXT AS end_date, a.notice_months, a.status
     FROM agreements a JOIN customers c ON c.id = a.customer_id
     WHERE a.organization_id = $1 ORDER BY a.created_at DESC`,
    [organizationId],
  );
  return res.rows.map((r) => ({
    id: r.id,
    customerId: r.customer_id,
    customerName: r.customer_name,
    name: r.name,
    amountMinor: BigInt(r.amount_minor),
    cadence: r.cadence,
    startDate: r.start_date,
    endDate: r.end_date,
    noticeMonths: r.notice_months,
    status: r.status,
  }));
}

export type AgreementFlag = 'ikke_fakturert' | 'underfakturert' | 'overfakturert' | 'oppsigelse_naer' | 'bor_periodiseres';

export interface AgreementReview {
  agreement: Agreement;
  periodsDue: number;
  expectedInvoicedMinor: bigint;
  actualInvoicedMinor: bigint;
  gapMinor: bigint; // positivt = tapt/manglende inntekt
  nextInvoiceDates: string[];
  noticeDeadline: string | null;
  flags: AgreementFlag[];
}

export async function reviewAgreements(
  db: Db,
  params: { organizationId: string; asOf: string },
): Promise<{ asOf: string; reviews: AgreementReview[]; totalGapMinor: bigint }> {
  const { organizationId: org, asOf } = params;
  const agreements = (await listAgreements(db, org)).filter((a) => a.status === 'active');
  const reviews: AgreementReview[] = [];
  let totalGap = 0n;

  for (const a of agreements) {
    const windowEnd = a.endDate && a.endDate < asOf ? a.endDate : asOf;
    const dueDates = scheduleDates(a.cadence, a.startDate, a.endDate, windowEnd);
    const periodsDue = dueDates.length;
    const expected = BigInt(periodsDue) * a.amountMinor;

    // Faktisk fakturert til kunden i avtaleperioden (kunde-basert kobling i v1).
    const inv = await db.query(
      `SELECT COALESCE(SUM(gross_minor),0)::TEXT AS sum, COUNT(*)::int AS n
       FROM invoices
       WHERE organization_id=$1 AND customer_id=$2 AND status IN ('issued','paid')
         AND invoice_date >= $3 AND invoice_date <= $4`,
      [org, a.customerId, a.startDate, windowEnd],
    );
    const actual = BigInt(inv.rows[0].sum);
    const invoiceCount = inv.rows[0].n as number;
    const gap = expected - actual;

    // Kommende fakturadatoer (fakturaplan): neste avtalte datoer fram i tid.
    const upcoming = scheduleDates(a.cadence, a.startDate, a.endDate, addMonths(asOf, 12)).filter((dt) => dt > asOf).slice(0, 4);

    const noticeDeadline = a.endDate && a.noticeMonths > 0 ? addMonths(a.endDate, -a.noticeMonths) : null;

    const flags: AgreementFlag[] = [];
    if (periodsDue > 0 && invoiceCount === 0) flags.push('ikke_fakturert');
    else if (gap * 20n > expected) flags.push('underfakturert'); // > 5 % manglende
    else if (-gap * 20n > expected) flags.push('overfakturert');
    if (noticeDeadline && noticeDeadline >= asOf && noticeDeadline <= addMonths(asOf, 2)) flags.push('oppsigelse_naer');
    if ((a.cadence === 'yearly' || a.cadence === 'one_time') && a.amountMinor >= 1200000n) flags.push('bor_periodiseres');

    if (gap > 0n) totalGap += gap;
    reviews.push({ agreement: a, periodsDue, expectedInvoicedMinor: expected, actualInvoicedMinor: actual, gapMinor: gap, nextInvoiceDates: upcoming, noticeDeadline, flags });
  }

  // Sorter: størst manglende inntekt / flest flagg først.
  reviews.sort((x, y) => (y.gapMinor > x.gapMinor ? 1 : y.gapMinor < x.gapMinor ? -1 : y.flags.length - x.flags.length));
  return { asOf, reviews, totalGapMinor: totalGap };
}
