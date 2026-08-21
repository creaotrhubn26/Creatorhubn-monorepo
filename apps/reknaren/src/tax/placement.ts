/**
 * Plassering av skatteavsetning: hvor pengene ligger (bank/fond/aksjer) + verdi over tid.
 * Reknaren flytter ALDRI penger, handler ALDRI, og gir ALDRI investeringsråd. Vi anbefaler
 * kun HORISONT/LIKVIDITET mot forfallskalenderen — instrumentvalg er brukerens/rådgiverens.
 */
import type { Db } from '../db/pool.js';
import { newId } from '../shared/ids.js';

interface Actor { userId: string }

export type PlacementType = 'bank' | 'money_market_fund' | 'bond_fund' | 'equity_fund' | 'stock';
export type Liquidity = 'instant' | 'days' | 'short_term' | 'long_term';

export interface Placement {
  id: string;
  name: string;
  placementType: PlacementType;
  liquidity: Liquidity;
  ringFenced: boolean;
  costMinor: bigint;          // sum innskudd (inngangsverdi)
  marketValueMinor: bigint;   // siste verdivurdering, ellers kostpris (bank)
  unrealisedGainMinor: bigint;
  valuedAt: string | null;
}

export async function createPlacement(
  db: Db,
  params: {
    organizationId: string; actor: Actor; name: string; placementType: PlacementType;
    liquidity: Liquidity; isin?: string; accountRef?: string; ringFenced?: boolean; openedAt: string;
  },
): Promise<{ id: string }> {
  const id = newId();
  await db.query(
    `INSERT INTO tax_reserve_placements
       (id, organization_id, name, placement_type, isin, account_ref, liquidity, ring_fenced, opened_at, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [id, params.organizationId, params.name, params.placementType, params.isin ?? null,
     params.accountRef ?? null, params.liquidity, params.ringFenced ?? false, params.openedAt, params.actor.userId],
  );
  return { id };
}

/** Registrer dagens markedsverdi for en plassering (append-only; én per dag). */
export async function recordValuation(
  db: Db,
  params: { placementId: string; valuedAt: string; marketValueMinor: bigint },
): Promise<void> {
  await db.query(
    `INSERT INTO tax_reserve_valuations (id, placement_id, valued_at, market_value_minor, source)
     VALUES ($1,$2,$3,$4,'manual')
     ON CONFLICT (placement_id, valued_at) DO UPDATE SET market_value_minor = EXCLUDED.market_value_minor`,
    [newId(), params.placementId, params.valuedAt, params.marketValueMinor.toString()],
  );
}

/** Plasseringer med kostpris (sum innskudd) og siste markedsverdi. */
export async function listPlacements(
  db: Db,
  params: { organizationId: string; asOf: string },
): Promise<Placement[]> {
  const rows = (await db.query(
    `SELECT p.id::text AS id, p.name, p.placement_type, p.liquidity, p.ring_fenced,
            COALESCE(dep.cost, 0)::text AS cost,
            val.market_value_minor::text AS value, val.valued_at::text AS valued_at
     FROM tax_reserve_placements p
     LEFT JOIN (
       SELECT placement_id, SUM(amount_minor) AS cost FROM tax_reserves
       WHERE placement_id IS NOT NULL GROUP BY placement_id
     ) dep ON dep.placement_id = p.id
     LEFT JOIN LATERAL (
       SELECT market_value_minor, valued_at FROM tax_reserve_valuations v
       WHERE v.placement_id = p.id AND v.valued_at <= $2
       ORDER BY v.valued_at DESC LIMIT 1
     ) val ON true
     WHERE p.organization_id = $1 AND p.closed_at IS NULL
     ORDER BY p.opened_at`,
    [params.organizationId, params.asOf],
  )).rows;
  return rows.map((r) => {
    const cost = BigInt(r.cost);
    const market = r.value != null ? BigInt(r.value) : cost; // bank u/verdi ≈ kostpris
    return {
      id: r.id, name: r.name, placementType: r.placement_type as PlacementType,
      liquidity: r.liquidity as Liquidity, ringFenced: r.ring_fenced === true,
      costMinor: cost, marketValueMinor: market, unrealisedGainMinor: market - cost,
      valuedAt: r.valued_at ?? null,
    };
  });
}

export interface Termin { date: string; amountMinor: bigint; daysUntil: number; coveredLiquid: boolean }
export interface LiquidityLadder {
  /** Må stå likvid før neste forfall (≤90 dager). Hard anbefaling. */
  liquidityFloorMinor: bigint;
  /** Del av behovet som ikke trengs i det umiddelbare vinduet — kan ha lengre horisont. Kun opplysning. */
  freeToPlaceMinor: bigint;
  nextDueDate: string | null;
  terminer: Termin[];
}

/**
 * Likviditetstrapp: fordeler gjenstående skattebehov jevnt over gjenværende
 * forskuddsskatt-terminer (15/3, 15/6, 15/9, 15/12) og skiller det som forfaller
 * innen 90 dager (må være likvid) fra resten. MVP: jevn R/n-fordeling.
 * ponytail: bytt jevn fordeling mot fastsatt forskuddsskatt per termin når vi har de tallene.
 */
export function liquidityLadder(remainingNeedMinor: bigint, asOf: string, liquidCoverMinor = 0n): LiquidityLadder {
  const need = remainingNeedMinor > 0n ? remainingNeedMinor : 0n;
  const year = asOf.slice(0, 4);
  const dueDates = [`${year}-03-15`, `${year}-06-15`, `${year}-09-15`, `${year}-12-15`];
  const future = dueDates.filter((d) => d >= asOf);
  if (future.length === 0) {
    // Alle terminer i året er passert → hele gjenstående behovet er «nå».
    return { liquidityFloorMinor: need, freeToPlaceMinor: 0n, nextDueDate: null, terminer: [] };
  }
  const per = need / BigInt(future.length);
  const asOfMs = Date.parse(asOf);
  let floor = 0n;
  let liquidLeft = liquidCoverMinor;
  const terminer: Termin[] = future.map((date) => {
    const daysUntil = Math.round((Date.parse(date) - asOfMs) / 86_400_000);
    if (daysUntil <= 90) floor += per;
    const covered = liquidLeft >= per;
    if (covered) liquidLeft -= per;
    return { date, amountMinor: per, daysUntil, coveredLiquid: covered };
  });
  const freeToPlace = need - floor;
  return {
    liquidityFloorMinor: floor,
    freeToPlaceMinor: freeToPlace > 0n ? freeToPlace : 0n,
    nextDueDate: future[0]!,
    terminer,
  };
}
