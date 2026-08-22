/**
 * Andel/lot-sporing for realisert gevinst. Kjøp (lot) = andeler + kostpris.
 * Salg (disposal) realiserer gevinst = vederlag − kostbasis.
 *   - Enkeltaksjer: FIFO (først inn, først ut), sktl. § 10-36.
 *   - Verdipapirfond: gjennomsnittsmetoden (gjennomsnittlig inngangsverdi).
 * Andeler i mikroandeler (× 1 000 000) for eksakt heltallsregning.
 */
import type { Db } from '../db/pool.js';
import { newId } from '../shared/ids.js';
import type { PlacementType } from './placement.js';

interface Actor { userId: string }
export type LotMethod = 'fifo' | 'average';

/** Fond bruker gjennomsnittsmetoden; enkeltaksjer bruker FIFO. */
export function methodForType(t: PlacementType): LotMethod {
  return t === 'stock' ? 'fifo' : 'average';
}

/** «12.5» → 12 500 000 mikroandeler. Ren strengparsing, ingen float. */
export function unitsToMicro(s: string): bigint {
  const [whole, frac = ''] = s.trim().split('.');
  const fracPadded = (frac + '000000').slice(0, 6);
  return BigInt(whole || '0') * 1_000_000n + BigInt(fracPadded || '0');
}

export interface Buy { acquiredAt: string; unitsMicro: bigint; costMinor: bigint }
export interface Sell { disposedAt: string; unitsMicro: bigint; proceedsMinor: bigint }
export interface DisposalResult { costBasisMinor: bigint; realisedGainMinor: bigint }

type Event =
  | { date: string; kind: 'buy'; unitsMicro: bigint; costMinor: bigint }
  | { date: string; kind: 'sell'; unitsMicro: bigint; proceedsMinor: bigint; idx: number };

/**
 * Spiller av alle kjøp + salg i datorekkefølge og returnerer kostbasis/gevinst
 * per salg (i samme rekkefølge som `sells`) + gjenværende beholdning.
 * Kaster hvis et salg overstiger beholdningen.
 */
export function computeDisposals(
  buys: Buy[], sells: Sell[], method: LotMethod,
): { results: DisposalResult[]; remainingUnitsMicro: bigint; remainingCostMinor: bigint } {
  const events: Event[] = [
    ...buys.map((b) => ({ date: b.acquiredAt, kind: 'buy' as const, unitsMicro: b.unitsMicro, costMinor: b.costMinor })),
    ...sells.map((s, idx) => ({ date: s.disposedAt, kind: 'sell' as const, unitsMicro: s.unitsMicro, proceedsMinor: s.proceedsMinor, idx })),
  ].sort((a, b) => a.date === b.date ? (a.kind === b.kind ? 0 : a.kind === 'buy' ? -1 : 1) : a.date.localeCompare(b.date));

  const results: DisposalResult[] = new Array(sells.length);
  // FIFO-kø av gjenværende lots; fungerer også som pool for gjennomsnitt (sum av køen).
  const queue: { unitsMicro: bigint; costMinor: bigint }[] = [];

  for (const e of events) {
    if (e.kind === 'buy') { queue.push({ unitsMicro: e.unitsMicro, costMinor: e.costMinor }); continue; }
    const totalUnits = queue.reduce((a, l) => a + l.unitsMicro, 0n);
    if (e.unitsMicro > totalUnits) throw new Error('Salg overstiger beholdningen av andeler.');
    let costBasis = 0n;
    if (method === 'fifo') {
      let toSell = e.unitsMicro;
      while (toSell > 0n) {
        const lot = queue[0]!;
        const take = toSell < lot.unitsMicro ? toSell : lot.unitsMicro;
        const costPart = (lot.costMinor * take) / lot.unitsMicro;
        costBasis += costPart;
        lot.unitsMicro -= take;
        lot.costMinor -= costPart;
        toSell -= take;
        if (lot.unitsMicro === 0n) queue.shift();
      }
    } else {
      const totalCost = queue.reduce((a, l) => a + l.costMinor, 0n);
      costBasis = (totalCost * e.unitsMicro) / totalUnits;
      // Reduser pool proporsjonalt (kollaps til én pooled lot for enkelhet).
      const remainingUnits = totalUnits - e.unitsMicro;
      const remainingCost = totalCost - costBasis;
      queue.length = 0;
      if (remainingUnits > 0n) queue.push({ unitsMicro: remainingUnits, costMinor: remainingCost });
    }
    results[e.idx] = { costBasisMinor: costBasis, realisedGainMinor: e.proceedsMinor - costBasis };
  }
  return {
    results,
    remainingUnitsMicro: queue.reduce((a, l) => a + l.unitsMicro, 0n),
    remainingCostMinor: queue.reduce((a, l) => a + l.costMinor, 0n),
  };
}

export async function addLot(
  db: Db,
  params: { placementId: string; actor: Actor; acquiredAt: string; unitsMicro: bigint; costMinor: bigint },
): Promise<{ id: string }> {
  const id = newId();
  await db.query(
    `INSERT INTO placement_lots (id, placement_id, acquired_at, units_micro, cost_minor, created_by)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [id, params.placementId, params.acquiredAt, params.unitsMicro.toString(), params.costMinor.toString(), params.actor.userId],
  );
  return { id };
}

async function loadBuys(db: Db, placementId: string): Promise<Buy[]> {
  const rows = (await db.query(
    `SELECT acquired_at::text AS d, units_micro::text AS u, cost_minor::text AS c
     FROM placement_lots WHERE placement_id = $1 ORDER BY acquired_at`, [placementId],
  )).rows;
  return rows.map((r) => ({ acquiredAt: r.d, unitsMicro: BigInt(r.u), costMinor: BigInt(r.c) }));
}

async function loadSells(db: Db, placementId: string): Promise<Sell[]> {
  const rows = (await db.query(
    `SELECT disposed_at::text AS d, units_micro::text AS u, proceeds_minor::text AS p
     FROM placement_disposals WHERE placement_id = $1 ORDER BY disposed_at, created_at`, [placementId],
  )).rows;
  return rows.map((r) => ({ disposedAt: r.d, unitsMicro: BigInt(r.u), proceedsMinor: BigInt(r.p) }));
}

/** Gjenværende beholdning (andeler + kostbasis) etter alle kjøp og salg. */
export async function lotHoldings(
  db: Db, placementId: string, method: LotMethod,
): Promise<{ unitsMicro: bigint; costMinor: bigint; hasLots: boolean }> {
  const buys = await loadBuys(db, placementId);
  if (buys.length === 0) return { unitsMicro: 0n, costMinor: 0n, hasLots: false };
  const sells = await loadSells(db, placementId);
  const { remainingUnitsMicro, remainingCostMinor } = computeDisposals(buys, sells, method);
  return { unitsMicro: remainingUnitsMicro, costMinor: remainingCostMinor, hasLots: true };
}

/** Registrer et salg: beregner kostbasis + realisert gevinst (FIFO/gjennomsnitt) og lagrer. */
export async function recordDisposal(
  db: Db,
  params: { placementId: string; actor: Actor; method: LotMethod; disposedAt: string; unitsMicro: bigint; proceedsMinor: bigint },
): Promise<DisposalResult> {
  const buys = await loadBuys(db, params.placementId);
  const priorSells = await loadSells(db, params.placementId);
  const sells: Sell[] = [...priorSells, { disposedAt: params.disposedAt, unitsMicro: params.unitsMicro, proceedsMinor: params.proceedsMinor }];
  const { results } = computeDisposals(buys, sells, params.method);
  const r = results[results.length - 1]!;
  await db.query(
    `INSERT INTO placement_disposals
       (id, placement_id, disposed_at, units_micro, proceeds_minor, cost_basis_minor, realised_gain_minor, method, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [newId(), params.placementId, params.disposedAt, params.unitsMicro.toString(), params.proceedsMinor.toString(),
     r.costBasisMinor.toString(), r.realisedGainMinor.toString(), params.method, params.actor.userId],
  );
  return r;
}

/** Sum realisert gevinst for et år (per organisasjon), til gevinstskatt-anslag. */
export async function realisedGainForYear(
  db: Db, organizationId: string, year: number,
): Promise<{ placementType: PlacementType; realisedGainMinor: bigint }[]> {
  const rows = (await db.query(
    `SELECT p.placement_type, COALESCE(SUM(d.realised_gain_minor),0)::text AS gain
     FROM placement_disposals d JOIN tax_reserve_placements p ON p.id = d.placement_id
     WHERE p.organization_id = $1 AND EXTRACT(YEAR FROM d.disposed_at) = $2
     GROUP BY p.placement_type`,
    [organizationId, year],
  )).rows;
  return rows.map((r) => ({ placementType: r.placement_type as PlacementType, realisedGainMinor: BigInt(r.gain) }));
}
