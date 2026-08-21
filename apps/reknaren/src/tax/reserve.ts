/**
 * Skatteavsetning for ENK m.fl.: registrer at penger er satt av til skatt, og
 * få oversikt anbefalt vs faktisk avsatt. Gjenbruker `buildTaxEstimate` (det
 * løpende, deterministiske skatteanslaget) — flytter ALDRI penger selv.
 */
import type { Db } from '../db/pool.js';
import type { RuleRegister } from '../rules/register.js';
import type { OrganizationForm } from '../rules/types.js';
import { newId } from '../shared/ids.js';
import { buildTaxEstimate } from './estimate.js';

interface Actor { userId: string }

export async function recordTaxReserve(
  db: Db,
  params: { organizationId: string; actor: Actor; amountMinor: bigint; reservedAt: string; note?: string },
): Promise<{ id: string }> {
  const id = newId();
  await db.query(
    `INSERT INTO tax_reserves (id, organization_id, amount_minor, reserved_at, note, created_by)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [id, params.organizationId, params.amountMinor.toString(), params.reservedAt, params.note ?? null, params.actor.userId],
  );
  return { id };
}

export interface TaxReserveOverview {
  asOf: string;
  estimatedTaxMinor: bigint;
  recommendedReserveMinor: bigint;
  reservedMinor: bigint;
  /** Allerede betalt forskuddsskatt (oppdaget i hovedboken) — trekkes fra det som gjenstår. */
  paidAdvanceTaxMinor: bigint;
  /** max(0, anbefalt − avsatt − betalt forskuddsskatt). */
  remainingMinor: bigint;
  /** Effektiv skattesats (skatt / skattbart resultat) i promille. */
  effectiveRatePer1000: number;
  /** Marginalsats på neste krone i promille — grunnlag for per-faktura-avsetning. */
  marginalRatePer1000: number;
  reserves: { id: string; amountMinor: bigint; reservedAt: string; note: string | null }[];
}

export async function taxReserveOverview(
  db: Db,
  rules: RuleRegister,
  params: { organizationId: string; orgForm: OrganizationForm; asOf: string },
): Promise<TaxReserveOverview> {
  const yearStart = `${params.asOf.slice(0, 4)}-01-01`;
  const est = await buildTaxEstimate(db, rules, {
    organizationId: params.organizationId, orgForm: params.orgForm, fromDate: yearStart, toDate: params.asOf,
  });
  const rows = (await db.query(
    `SELECT id::text AS id, amount_minor::text AS amount, reserved_at::text AS date, note
     FROM tax_reserves WHERE organization_id=$1 AND reserved_at >= $2 ORDER BY reserved_at DESC`,
    [params.organizationId, yearStart],
  )).rows;
  const reservedMinor = rows.reduce((a, r) => a + BigInt(r.amount), 0n);

  // Betalt forskuddsskatt: posteringer i året der beskrivelsen tyder på skattebetaling
  // (til Skatteetaten) og pengene går ut av bank/privatkonto. Best-effort, konservativt.
  const paidRow = (await db.query(
    `SELECT COALESCE(SUM(l.credit_minor - l.debit_minor), 0)::text AS paid
     FROM journal_lines l JOIN journal_entries e ON e.id = l.entry_id
     WHERE l.organization_id = $1 AND e.entry_date >= $2 AND e.entry_date <= $3
       AND l.account_number IN ('1920','1900','2061')
       AND (e.description ~* 'forskuddsskatt|forskotsskatt' OR e.description ~* 'skatteetaten')`,
    [params.organizationId, yearStart, params.asOf],
  )).rows[0];
  const paidAdvanceMinor0 = BigInt(paidRow.paid);
  const paidAdvanceTaxMinor = paidAdvanceMinor0 > 0n ? paidAdvanceMinor0 : 0n;

  const remaining = est.recommendedReserveMinor - reservedMinor - paidAdvanceTaxMinor;
  const effRate = est.estimatedTaxableResultMinor > 0n
    ? Number((est.estimatedTaxMinor * 1000n) / est.estimatedTaxableResultMinor)
    : 0;
  return {
    asOf: params.asOf,
    estimatedTaxMinor: est.estimatedTaxMinor,
    recommendedReserveMinor: est.recommendedReserveMinor,
    reservedMinor,
    paidAdvanceTaxMinor,
    remainingMinor: remaining > 0n ? remaining : 0n,
    effectiveRatePer1000: effRate,
    marginalRatePer1000: est.marginalRatePer1000,
    reserves: rows.map((r) => ({ id: r.id, amountMinor: BigInt(r.amount), reservedAt: r.date, note: r.note })),
  };
}

/**
 * Per faktura: hvor mye bør settes av til skatt for DENNE fakturaen.
 * Bruker MARGINALsats (skatt på neste krone), ikke snitt — fordi omsetning på
 * toppen av årets resultat skattlegges marginalt. Faller tilbake til 40 % når
 * det ikke finnes skattbart resultat ennå (konservativt for ny virksomhet).
 */
export async function taxSetAsideForInvoice(
  db: Db,
  rules: RuleRegister,
  params: { organizationId: string; orgForm: OrganizationForm; asOf: string; invoiceNetMinor: bigint },
): Promise<{ setAsideMinor: bigint; ratePer1000: number; basis: 'marginal' | 'default' }> {
  const ov = await taxReserveOverview(db, rules, params);
  let rate = ov.marginalRatePer1000;
  let basis: 'marginal' | 'default' = 'marginal';
  if (rate <= 0) { rate = 400; basis = 'default'; }
  const setAside = (params.invoiceNetMinor * BigInt(Math.round(rate))) / 1000n;
  return { setAsideMinor: setAside > 0n ? setAside : 0n, ratePer1000: rate, basis };
}
