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
  /** max(0, anbefalt − avsatt). */
  remainingMinor: bigint;
  /** Effektiv skattesats (skatt / skattbart resultat) i promille — grunnlag for per-faktura. */
  effectiveRatePer1000: number;
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
  const remaining = est.recommendedReserveMinor - reservedMinor;
  const rate = est.estimatedTaxableResultMinor > 0n
    ? Number((est.estimatedTaxMinor * 1000n) / est.estimatedTaxableResultMinor)
    : 0;
  return {
    asOf: params.asOf,
    estimatedTaxMinor: est.estimatedTaxMinor,
    recommendedReserveMinor: est.recommendedReserveMinor,
    reservedMinor,
    remainingMinor: remaining > 0n ? remaining : 0n,
    effectiveRatePer1000: rate,
    reserves: rows.map((r) => ({ id: r.id, amountMinor: BigInt(r.amount), reservedAt: r.date, note: r.note })),
  };
}

/**
 * Per faktura: hvor mye bør settes av til skatt for DENNE fakturaen.
 * = fakturaens netto × effektiv skattesats fra årets resultat. Faller tilbake
 * til 35 % når det ikke finnes skattbart resultat ennå (ny virksomhet).
 */
export async function taxSetAsideForInvoice(
  db: Db,
  rules: RuleRegister,
  params: { organizationId: string; orgForm: OrganizationForm; asOf: string; invoiceNetMinor: bigint },
): Promise<{ setAsideMinor: bigint; ratePer1000: number; basis: 'effective' | 'default' }> {
  const ov = await taxReserveOverview(db, rules, params);
  let rate = ov.effectiveRatePer1000;
  let basis: 'effective' | 'default' = 'effective';
  if (rate <= 0) { rate = 350; basis = 'default'; }
  const setAside = (params.invoiceNetMinor * BigInt(Math.round(rate))) / 1000n;
  return { setAsideMinor: setAside > 0n ? setAside : 0n, ratePer1000: rate, basis };
}
