/**
 * Plassering av skatteavsetning: likviditetstrapp (ren) + markedsverdi/gevinst i oversikten.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import { postJournalEntry } from '../src/ledger/engine.js';
import { createOrganization, ensureUser } from '../src/orgs/service.js';
import { buildNorwegianRuleRegister } from '../src/rules/no/rules.js';
import { createPlacement, liquidityLadder, recordValuation } from '../src/tax/placement.js';
import { setAdvanceInstallments } from '../src/tax/placement.js';
import { recordTaxReserve, taxReserveOverview } from '../src/tax/reserve.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
let userId: string;
const rules = buildNorwegianRuleRegister();

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  userId = await ensureUser(db, 'plassering@example.com', 'Plasseringstester');
});
afterAll(async () => { await db.end(); });

describe('liquidityLadder (ren)', () => {
  it('skiller det som forfaller ≤90 dager (likvid) fra resten', () => {
    // 100 000 behov, 1. jan → kun 15. mars (73 d) er innen 90 d. Per termin 25 000.
    const l = liquidityLadder(100_000n, '2026-01-01');
    expect(l.nextDueDate).toBe('2026-03-15');
    expect(l.terminer).toHaveLength(4);
    expect(l.liquidityFloorMinor).toBe(25_000n);   // bare 1. termin ≤90 d
    expect(l.freeToPlaceMinor).toBe(75_000n);
  });

  it('sent i året: bare gjenværende terminer teller', () => {
    // 22. aug → 15. sept (24 d, likvid) + 15. des (>90 d). Per termin 45 000.
    const l = liquidityLadder(90_000n, '2026-08-22');
    expect(l.terminer).toHaveLength(2);
    expect(l.liquidityFloorMinor).toBe(45_000n);
    expect(l.freeToPlaceMinor).toBe(45_000n);
  });

  it('markerer terminer dekket av likvid beholdning', () => {
    const l = liquidityLadder(100_000n, '2026-01-01', 30_000n); // dekker 1 termin (25k), rest 5k < 25k
    expect(l.terminer[0]!.coveredLiquid).toBe(true);
    expect(l.terminer[1]!.coveredLiquid).toBe(false);
  });

  it('bruker fastsatt forskuddsskatt når den finnes (ikke jevn R/4)', () => {
    const l = liquidityLadder(60_000n, '2026-08-22', 0n, [
      { termNo: 3, dueDate: '2026-09-15', amountMinor: 30_000n },
      { termNo: 4, dueDate: '2026-12-15', amountMinor: 25_000n },
    ]);
    expect(l.nextDueDate).toBe('2026-09-15');
    expect(l.terminer.map((t) => t.amountMinor)).toEqual([30_000n, 25_000n]); // fastsatt, ikke 30k jevnt
    expect(l.liquidityFloorMinor).toBe(30_000n);           // bare 15. sept (≤90 d)
    expect(l.freeToPlaceMinor).toBe(5_000n);               // 60k − (30k+25k) planlagt
  });
});

describe('aksjonærmodell for gevinstskatt', () => {
  it('aksjefond oppjusteres (37,84 %), pengemarkedsfond er flat 22 %', async () => {
    const org = await createOrganization(db, { name: 'Aksje ENK', orgForm: 'ENK', vatStatus: 'not_registered', createdByUserId: userId });
    const actor = { userId, role: 'owner' as const };
    const aksje = await createPlacement(db, {
      organizationId: org.id, actor, name: 'DNB Global', placementType: 'equity_fund', liquidity: 'long_term', openedAt: '2026-02-01',
    });
    await recordTaxReserve(db, { organizationId: org.id, actor, amountMinor: 5_000_000n, reservedAt: '2026-02-01', placementId: aksje.id });
    await recordValuation(db, { placementId: aksje.id, valuedAt: '2026-08-01', marketValueMinor: 6_000_000n }); // +1 000 000 gevinst

    const ov = await taxReserveOverview(db, rules, { organizationId: org.id, orgForm: 'ENK', asOf: '2026-08-22' });
    const p = ov.placements[0]!;
    // Aksjegevinst 1 000 000 × 22 % × 1,72 = 378 400.
    expect(p.gainTaxMinor).toBe((1_000_000n * 22n * 172n) / (100n * 100n));
    expect(p.gainTaxMinor).toBe(378_400n);
    expect(ov.gainTaxEstimateMinor).toBe(378_400n);
  });

  it('skjermingsfradrag reduserer aksjegevinst-skatten (2025, 3,6 %)', async () => {
    const org = await createOrganization(db, { name: 'Skjerming ENK', orgForm: 'ENK', vatStatus: 'not_registered', createdByUserId: userId });
    const actor = { userId, role: 'owner' as const };
    const p = await createPlacement(db, {
      organizationId: org.id, actor, name: 'KLP Aksje', placementType: 'equity_fund', liquidity: 'long_term', openedAt: '2025-02-01',
    });
    await recordTaxReserve(db, { organizationId: org.id, actor, amountMinor: 100_000n, reservedAt: '2025-02-01', placementId: p.id });
    await recordValuation(db, { placementId: p.id, valuedAt: '2025-06-01', marketValueMinor: 110_000n }); // gevinst 10 000

    const ov = await taxReserveOverview(db, rules, { organizationId: org.id, orgForm: 'ENK', asOf: '2025-12-31' });
    // Skjerming = 100 000 × 3,6 % = 3 600 → skattbart 6 400 × 22 % × 1,72 = 2 421.
    expect(ov.placements[0]!.gainTaxMinor).toBe((6_400n * 22n * 172n) / (100n * 100n));
    expect(ov.placements[0]!.gainTaxMinor).toBe(2_421n);
  });

  it('fastsatt forskuddsskatt slår gjennom i oversiktens likviditetstrapp', async () => {
    const org = await createOrganization(db, { name: 'Forskudd ENK', orgForm: 'ENK', vatStatus: 'not_registered', createdByUserId: userId });
    const actor = { userId, role: 'owner' as const };
    await postJournalEntry(db, {
      organizationId: org.id, actor, entryDate: '2026-03-10', description: 'salg', idempotencyKey: 'salgf',
      lines: [{ accountNumber: '1920', debitMinor: 40000000n }, { accountNumber: '3000', creditMinor: 40000000n }],
    });
    await setAdvanceInstallments(db, {
      organizationId: org.id, actor, year: 2026,
      installments: [
        { termNo: 3, dueDate: '2026-09-15', amountMinor: 2_500_000n },
        { termNo: 4, dueDate: '2026-12-15', amountMinor: 2_500_000n },
      ],
    });
    const ov = await taxReserveOverview(db, rules, { organizationId: org.id, orgForm: 'ENK', asOf: '2026-08-22' });
    expect(ov.ladder.terminer.map((t) => t.amountMinor)).toEqual([2_500_000n, 2_500_000n]);
    expect(ov.ladder.nextDueDate).toBe('2026-09-15');
  });
});

describe('plassering i oversikten', () => {
  it('bruker markedsverdi (ikke kostpris) i dekning + viser urealisert gevinst', async () => {
    const org = await createOrganization(db, { name: 'Plassering ENK', orgForm: 'ENK', vatStatus: 'not_registered', createdByUserId: userId });
    const actor = { userId, role: 'owner' as const };
    await postJournalEntry(db, {
      organizationId: org.id, actor, entryDate: '2026-03-10', description: 'salg', idempotencyKey: 'salgp',
      lines: [{ accountNumber: '1920', debitMinor: 30000000n }, { accountNumber: '3000', creditMinor: 30000000n }],
    });
    // Opprett pengemarkedsfond og sett av 50 000 der (kostpris).
    const p = await createPlacement(db, {
      organizationId: org.id, actor, name: 'KLP Pengemarked', placementType: 'money_market_fund',
      liquidity: 'days', openedAt: '2026-04-01',
    });
    await recordTaxReserve(db, { organizationId: org.id, actor, amountMinor: 5_000_000n, reservedAt: '2026-04-01', placementId: p.id });
    // Verdien har steget til 51 200.
    await recordValuation(db, { placementId: p.id, valuedAt: '2026-08-01', marketValueMinor: 5_120_000n });

    const ov = await taxReserveOverview(db, rules, { organizationId: org.id, orgForm: 'ENK', asOf: '2026-08-22' });
    expect(ov.placements).toHaveLength(1);
    expect(ov.placedCostMinor).toBe(5_000_000n);
    expect(ov.placedMarketValueMinor).toBe(5_120_000n);
    expect(ov.unrealisedGainMinor).toBe(120_000n);
    expect(ov.gainTaxEstimateMinor).toBe((120_000n * 22n) / 100n); // 26 400
    // Dekning bruker markedsverdi: reservedMinor(kostpris 50k) − 50k + 51,2k = 51,2k.
    expect(ov.coverageMinor).toBe(5_120_000n);
    expect(ov.ladder.nextDueDate).toBe('2026-09-15');
  });
});
