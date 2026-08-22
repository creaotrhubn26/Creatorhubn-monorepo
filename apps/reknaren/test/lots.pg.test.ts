/**
 * Andel/lot-sporing: FIFO (aksje) og gjennomsnitt (fond) for realisert gevinst,
 * pluss realisert gevinst + skatt i skatteoversikten (aksjonærmodell).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import { createOrganization, ensureUser } from '../src/orgs/service.js';
import { buildNorwegianRuleRegister } from '../src/rules/no/rules.js';
import { addLot, computeDisposals, recordDisposal, unitsToMicro } from '../src/tax/lots.js';
import { createPlacement } from '../src/tax/placement.js';
import { taxReserveOverview } from '../src/tax/reserve.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
let userId: string;
const rules = buildNorwegianRuleRegister();

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  userId = await ensureUser(db, 'lots@example.com', 'Lot-tester');
});
afterAll(async () => { await db.end(); });

const buys = [
  { acquiredAt: '2026-01-01', unitsMicro: 10_000_000n, costMinor: 100_000n },
  { acquiredAt: '2026-02-01', unitsMicro: 10_000_000n, costMinor: 120_000n },
];
const sell = { disposedAt: '2026-06-01', unitsMicro: 15_000_000n, proceedsMinor: 195_000n };

describe('computeDisposals (ren)', () => {
  it('FIFO: eldste lot først', () => {
    const r = computeDisposals(buys, [sell], 'fifo');
    // 10 andeler @ 100 000 (helt) + 5 @ (120 000×5/10=60 000) = 160 000 kostbasis.
    expect(r.results[0]!.costBasisMinor).toBe(160_000n);
    expect(r.results[0]!.realisedGainMinor).toBe(35_000n);
    expect(r.remainingUnitsMicro).toBe(5_000_000n);
    expect(r.remainingCostMinor).toBe(60_000n);
  });

  it('gjennomsnitt: snittkost over hele beholdningen', () => {
    const r = computeDisposals(buys, [sell], 'average');
    // Snitt (220 000/20) × 15 = 165 000 kostbasis.
    expect(r.results[0]!.costBasisMinor).toBe(165_000n);
    expect(r.results[0]!.realisedGainMinor).toBe(30_000n);
    expect(r.remainingCostMinor).toBe(55_000n);
  });

  it('kaster ved salg over beholdning', () => {
    expect(() => computeDisposals(buys, [{ disposedAt: '2026-06-01', unitsMicro: 25_000_000n, proceedsMinor: 1n }], 'fifo'))
      .toThrow(/overstiger/);
  });
});

describe('unitsToMicro', () => {
  it('parser desimaler uten float', () => {
    expect(unitsToMicro('12.5')).toBe(12_500_000n);
    expect(unitsToMicro('0.000001')).toBe(1n);
    expect(unitsToMicro('100')).toBe(100_000_000n);
  });
});

describe('realisert gevinst i skatteoversikten', () => {
  it('aksje: FIFO-gevinst med aksjonærmodell (37,84 %)', async () => {
    const org = await createOrganization(db, { name: 'Aksje-lot ENK', orgForm: 'ENK', vatStatus: 'not_registered', createdByUserId: userId });
    const actor = { userId, role: 'owner' as const };
    const p = await createPlacement(db, {
      organizationId: org.id, actor, name: 'EQNR', placementType: 'stock', liquidity: 'days', openedAt: '2026-01-01',
    });
    await addLot(db, { placementId: p.id, actor, acquiredAt: '2026-01-01', unitsMicro: 10_000_000n, costMinor: 100_000n });
    await addLot(db, { placementId: p.id, actor, acquiredAt: '2026-02-01', unitsMicro: 10_000_000n, costMinor: 120_000n });
    const d = await recordDisposal(db, { placementId: p.id, actor, method: 'fifo', disposedAt: '2026-06-01', unitsMicro: 15_000_000n, proceedsMinor: 195_000n });
    expect(d.realisedGainMinor).toBe(35_000n);

    const ov = await taxReserveOverview(db, rules, { organizationId: org.id, orgForm: 'ENK', asOf: '2026-08-22' });
    expect(ov.realisedGainMinor).toBe(35_000n);
    // 35 000 × 22 % × 1,72 = 13 244.
    expect(ov.realisedGainTaxMinor).toBe((35_000n * 22n * 172n) / (100n * 100n));
    expect(ov.realisedGainTaxMinor).toBe(13_244n);
  });
});
