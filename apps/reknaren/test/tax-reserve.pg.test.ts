/**
 * Skatteavsetning: per-faktura-anslag + reserve-oversikt for ENK (uten MVA).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import { postJournalEntry } from '../src/ledger/engine.js';
import { createOrganization, ensureUser } from '../src/orgs/service.js';
import { buildNorwegianRuleRegister } from '../src/rules/no/rules.js';
import { recordTaxReserve, taxReserveOverview, taxSetAsideForInvoice } from '../src/tax/reserve.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
let userId: string;
const rules = buildNorwegianRuleRegister();
const ASOF = '2026-12-31';

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  userId = await ensureUser(db, 'reserve@example.com', 'Reservetester');
});
afterAll(async () => { await db.end(); });

describe('skatteavsetning for ENK uten MVA', () => {
  it('regner effektiv sats fra resultat, sporer avsatt og gjenstår, og gir per-faktura-anslag', async () => {
    const org = await createOrganization(db, { name: 'Qazi-lignende ENK', orgForm: 'ENK', vatStatus: 'not_registered', createdByUserId: userId });
    const actor = { userId, role: 'owner' as const };
    // Mva-fritt salg 100 000, ubetydelig kostnad → skattbart ~100 000.
    await postJournalEntry(db, {
      organizationId: org.id, actor, entryDate: '2026-03-10', description: 'salg', idempotencyKey: 'salg1',
      lines: [{ accountNumber: '1920', debitMinor: 10000000n }, { accountNumber: '3000', creditMinor: 10000000n }],
    });

    const ov = await taxReserveOverview(db, rules, { organizationId: org.id, orgForm: 'ENK', asOf: ASOF });
    // ENK: alminnelig inntektsskatt (22%) + trygdeavgift (11%) ≈ 33% → skatt > 30 000.
    expect(ov.estimatedTaxMinor).toBeGreaterThan(3_000_000n);
    expect(ov.recommendedReserveMinor).toBe(ov.estimatedTaxMinor); // ingen MVA
    expect(ov.effectiveRatePer1000).toBeGreaterThan(300);
    expect(ov.effectiveRatePer1000).toBeLessThan(400);
    expect(ov.reservedMinor).toBe(0n);
    expect(ov.remainingMinor).toBe(ov.recommendedReserveMinor);

    // Registrer at 20 000 er satt av → gjenstår faller tilsvarende.
    await recordTaxReserve(db, { organizationId: org.id, actor, amountMinor: 2_000_000n, reservedAt: '2026-04-15', note: 'Til skattekonto' });
    const ov2 = await taxReserveOverview(db, rules, { organizationId: org.id, orgForm: 'ENK', asOf: ASOF });
    expect(ov2.reservedMinor).toBe(2_000_000n);
    expect(ov2.remainingMinor).toBe(ov2.recommendedReserveMinor - 2_000_000n);
    expect(ov2.reserves).toHaveLength(1);

    // Per faktura: netto 44 400 × effektiv sats.
    const setAside = await taxSetAsideForInvoice(db, rules, { organizationId: org.id, orgForm: 'ENK', asOf: ASOF, invoiceNetMinor: 4_440_000n });
    expect(setAside.basis).toBe('effective');
    const expected = (4_440_000n * BigInt(Math.round(ov2.effectiveRatePer1000))) / 1000n;
    expect(setAside.setAsideMinor).toBe(expected);
  });

  it('faller tilbake til 35% når det ikke finnes skattbart resultat ennå', async () => {
    const org = await createOrganization(db, { name: 'Ny ENK', orgForm: 'ENK', vatStatus: 'not_registered', createdByUserId: userId });
    const s = await taxSetAsideForInvoice(db, rules, { organizationId: org.id, orgForm: 'ENK', asOf: ASOF, invoiceNetMinor: 1_000_000n });
    expect(s.basis).toBe('default');
    expect(s.ratePer1000).toBe(350);
    expect(s.setAsideMinor).toBe(350_000n); // 35% av 10 000
  });
});
