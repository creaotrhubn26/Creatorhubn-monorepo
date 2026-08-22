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
import { liquidityLadder, listAdvanceInstallments, listPlacements, placementGainTaxMinor, type LiquidityLadder, type Placement } from './placement.js';

interface Actor { userId: string }

/** Plasseringer regnes som likvide når de kan dekke en termin på kort varsel. */
const LIQUID_KINDS = new Set(['instant', 'days']);

export async function recordTaxReserve(
  db: Db,
  params: { organizationId: string; actor: Actor; amountMinor: bigint; reservedAt: string; note?: string; placementId?: string },
): Promise<{ id: string }> {
  const id = newId();
  await db.query(
    `INSERT INTO tax_reserves (id, organization_id, amount_minor, reserved_at, note, created_by, placement_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [id, params.organizationId, params.amountMinor.toString(), params.reservedAt, params.note ?? null, params.actor.userId, params.placementId ?? null],
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
  // --- Plassering (fond/aksjer) ---
  /** Kostpris (sum innskudd) plassert i fond/aksjer/bank. */
  placedCostMinor: bigint;
  /** Markedsverdi av plasseringene i dag (siste verdivurdering; bank ≈ kostpris). */
  placedMarketValueMinor: bigint;
  /** Urealisert gevinst/tap på plasseringene. */
  unrealisedGainMinor: bigint;
  /** Anslått skatt på urealisert gevinst (22 % kapitalinntekt). ASK/fondskonto = fase 2. */
  gainTaxEstimateMinor: bigint;
  /** Samlet dekning = kontant avsatt + markedsverdi plasseringer (erstatter kostpris med dagsverdi). */
  coverageMinor: bigint;
  placements: Placement[];
  /** Likviditetstrapp mot forfallskalenderen — hva som må stå likvid vs kan plasseres lenger. */
  ladder: LiquidityLadder;
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

  // Plasseringer: bytt kostpris mot dagsverdi i dekningen (markedsverdi kan avvike fra nominelt avsatt).
  const placementsRaw = await listPlacements(db, { organizationId: params.organizationId, asOf: params.asOf });
  // Skatt på gevinst per plassering: aksjonærmodell (oppjustering) for aksjer/aksjefond, ellers flat 22 %.
  const baseRate = rules.getRationalParamAt('no.tax.personal-base-rate', 'rate', params.asOf);
  const upscale = rules.getRationalParamAt('no.tax.share-income-upscaling', 'factor', params.asOf);
  const placements = placementsRaw.map((p) => ({ ...p, gainTaxMinor: placementGainTaxMinor(p, baseRate, upscale) }));
  const placedCostMinor = placements.reduce((a, p) => a + p.costMinor, 0n);
  const placedMarketValueMinor = placements.reduce((a, p) => a + p.marketValueMinor, 0n);
  const unrealisedGainMinor = placedMarketValueMinor - placedCostMinor;
  const gainTaxEstimateMinor = placements.reduce((a, p) => a + p.gainTaxMinor, 0n);
  // reservedMinor teller plassert kostpris; erstatt den med markedsverdi for reell dekning.
  const coverageMinor = reservedMinor - placedCostMinor + placedMarketValueMinor;

  const remaining = est.recommendedReserveMinor - coverageMinor - paidAdvanceTaxMinor;
  const remainingMinor = remaining > 0n ? remaining : 0n;
  // Likvid dekning = kontant avsatt + markedsverdi av likvide plasseringer (bank/pengemarked).
  const cashReservedMinor = reservedMinor - placedCostMinor;
  const liquidPlacedMinor = placements
    .filter((p) => LIQUID_KINDS.has(p.liquidity))
    .reduce((a, p) => a + p.marketValueMinor, 0n);
  const installments = await listAdvanceInstallments(db, { organizationId: params.organizationId, year: Number(params.asOf.slice(0, 4)) });
  const ladder = liquidityLadder(remainingMinor, params.asOf, cashReservedMinor + liquidPlacedMinor, installments);

  const effRate = est.estimatedTaxableResultMinor > 0n
    ? Number((est.estimatedTaxMinor * 1000n) / est.estimatedTaxableResultMinor)
    : 0;
  return {
    asOf: params.asOf,
    estimatedTaxMinor: est.estimatedTaxMinor,
    recommendedReserveMinor: est.recommendedReserveMinor,
    reservedMinor,
    paidAdvanceTaxMinor,
    remainingMinor,
    effectiveRatePer1000: effRate,
    marginalRatePer1000: est.marginalRatePer1000,
    reserves: rows.map((r) => ({ id: r.id, amountMinor: BigInt(r.amount), reservedAt: r.date, note: r.note })),
    placedCostMinor,
    placedMarketValueMinor,
    unrealisedGainMinor,
    gainTaxEstimateMinor,
    coverageMinor,
    placements,
    ladder,
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
