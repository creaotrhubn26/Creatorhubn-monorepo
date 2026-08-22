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
  ticker: string | null;      // Yahoo-ticker for auto-kurs, ellers manuell verdi
  costMinor: bigint;          // sum innskudd (inngangsverdi)
  marketValueMinor: bigint;   // siste verdivurdering, ellers kostpris (bank)
  unrealisedGainMinor: bigint;
  /** Anslått skatt på urealisert gevinst — aksjonærmodell for aksjer/aksjefond, ellers flat 22 %. */
  gainTaxMinor: bigint;
  valuedAt: string | null;
}

/** Aksjer og aksjefond følger aksjonærmodellen (oppjustering); renter/bank er flat sats. */
const EQUITY_KINDS: PlacementType[] = ['equity_fund', 'stock'];

/**
 * Skatt på urealisert gevinst for én plassering. Tap → 0 (fradrag håndteres ved
 * realisering). Aksjeinntekt oppjusteres og skjermes; renteinntekt skattlegges flatt.
 * Skjerming = kostpris × skjermingsrente, trekkes fra aksjegevinsten før skatt.
 */
export function placementGainTaxMinor(
  p: Pick<Placement, 'placementType' | 'unrealisedGainMinor' | 'costMinor'>,
  base: { numerator: bigint; denominator: bigint },       // alminnelig sats, f.eks. 22/100
  upscale: { numerator: bigint; denominator: bigint },    // oppjusteringsfaktor, f.eks. 172/100
  shielding?: { numerator: bigint; denominator: bigint } | null, // skjermingsrente, f.eks. 36/1000
): bigint {
  if (p.unrealisedGainMinor <= 0n) return 0n;
  if (EQUITY_KINDS.includes(p.placementType)) {
    const skjerming = shielding ? (p.costMinor * shielding.numerator) / shielding.denominator : 0n;
    const taxable = p.unrealisedGainMinor - skjerming;
    if (taxable <= 0n) return 0n;
    return (taxable * base.numerator * upscale.numerator) / (base.denominator * upscale.denominator);
  }
  return (p.unrealisedGainMinor * base.numerator) / base.denominator;
}

export async function createPlacement(
  db: Db,
  params: {
    organizationId: string; actor: Actor; name: string; placementType: PlacementType;
    liquidity: Liquidity; isin?: string; ticker?: string; accountRef?: string; ringFenced?: boolean; openedAt: string;
  },
): Promise<{ id: string }> {
  const id = newId();
  await db.query(
    `INSERT INTO tax_reserve_placements
       (id, organization_id, name, placement_type, isin, ticker, account_ref, liquidity, ring_fenced, opened_at, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [id, params.organizationId, params.name, params.placementType, params.isin ?? null, params.ticker ?? null,
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
    `SELECT p.id::text AS id, p.name, p.placement_type, p.liquidity, p.ring_fenced, p.ticker,
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
      liquidity: r.liquidity as Liquidity, ringFenced: r.ring_fenced === true, ticker: r.ticker ?? null,
      costMinor: cost, marketValueMinor: market, unrealisedGainMinor: market - cost,
      gainTaxMinor: 0n, // fylles i taxReserveOverview med satser fra regelregisteret
      valuedAt: r.valued_at ?? null,
    };
  });
}

export interface AdvanceInstallment { termNo: number; dueDate: string; amountMinor: bigint }

/** Sett/oppdater fastsatt forskuddsskatt for et år (upsert per termin). */
export async function setAdvanceInstallments(
  db: Db,
  params: { organizationId: string; actor: Actor; year: number; installments: AdvanceInstallment[] },
): Promise<void> {
  for (const t of params.installments) {
    await db.query(
      `INSERT INTO advance_tax_installments (id, organization_id, year, term_no, due_date, amount_minor, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (organization_id, year, term_no)
       DO UPDATE SET due_date = EXCLUDED.due_date, amount_minor = EXCLUDED.amount_minor`,
      [newId(), params.organizationId, params.year, t.termNo, t.dueDate, t.amountMinor.toString(), params.actor.userId],
    );
  }
}

export async function listAdvanceInstallments(
  db: Db,
  params: { organizationId: string; year: number },
): Promise<AdvanceInstallment[]> {
  const rows = (await db.query(
    `SELECT term_no, due_date::text AS due_date, amount_minor::text AS amount
     FROM advance_tax_installments WHERE organization_id = $1 AND year = $2 ORDER BY term_no`,
    [params.organizationId, params.year],
  )).rows;
  return rows.map((r) => ({ termNo: r.term_no, dueDate: r.due_date, amountMinor: BigInt(r.amount) }));
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
export function liquidityLadder(
  remainingNeedMinor: bigint,
  asOf: string,
  liquidCoverMinor = 0n,
  installments?: AdvanceInstallment[],
): LiquidityLadder {
  const need = remainingNeedMinor > 0n ? remainingNeedMinor : 0n;
  const year = asOf.slice(0, 4);
  // Fastsatt forskuddsskatt hvis vi har den; ellers jevn R/4 på standard-terminene.
  const schedule: { date: string; amountMinor: bigint }[] = installments && installments.length > 0
    ? installments.map((t) => ({ date: t.dueDate, amountMinor: t.amountMinor }))
    : [`${year}-03-15`, `${year}-06-15`, `${year}-09-15`, `${year}-12-15`]
        .map((date) => ({ date, amountMinor: 0n })); // fylles under
  const future = schedule.filter((s) => s.date >= asOf).sort((a, b) => a.date.localeCompare(b.date));
  if (future.length === 0) {
    // Alle terminer i året er passert → hele gjenstående behovet er «nå».
    return { liquidityFloorMinor: need, freeToPlaceMinor: 0n, nextDueDate: null, terminer: [] };
  }
  const usingFastsatt = !!(installments && installments.length > 0);
  const per = need / BigInt(future.length); // kun ved R/4-fallback
  const asOfMs = Date.parse(asOf);
  let floor = 0n;
  let scheduledFuture = 0n;
  let liquidLeft = liquidCoverMinor;
  const terminer: Termin[] = future.map((s) => {
    const amount = usingFastsatt ? s.amountMinor : per;
    scheduledFuture += amount;
    const daysUntil = Math.round((Date.parse(s.date) - asOfMs) / 86_400_000);
    if (daysUntil <= 90) floor += amount;
    const covered = liquidLeft >= amount;
    if (covered) liquidLeft -= amount;
    return { date: s.date, amountMinor: amount, daysUntil, coveredLiquid: covered };
  });
  // Fri horisont = behov utover det som er planlagt betalt i det nære vinduet.
  const freeBasis = usingFastsatt ? need - scheduledFuture : need - floor;
  return {
    liquidityFloorMinor: floor,
    freeToPlaceMinor: freeBasis > 0n ? freeBasis : 0n,
    nextDueDate: future[0]!.date,
    terminer,
  };
}
