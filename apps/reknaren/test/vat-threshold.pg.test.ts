/**
 * MVA-registreringsterskel mot ekte Postgres: løpende 12-mnd avgiftspliktig
 * omsetning (salgsinntekt 3000–3799) mot 50 000 kr, med korrekt vindus-avgrensning.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import { postJournalEntry } from '../src/ledger/engine.js';
import { vatRegistrationThreshold } from '../src/ledger/reports.js';
import { createOrganization, ensureUser } from '../src/orgs/service.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
let orgId: string;
let userId: string;
const ASOF = '2026-06-15'; // vindu: (2025-06-15, 2026-06-15]

async function postSale(entryDate: string, krMinor: bigint, key: string): Promise<void> {
  await postJournalEntry(db, {
    organizationId: orgId,
    actor: { userId, role: 'owner' },
    entryDate,
    description: `Salg ${key}`,
    idempotencyKey: key,
    lines: [
      { accountNumber: '1500', debitMinor: krMinor },
      { accountNumber: '3100', creditMinor: krMinor },
    ],
  });
}

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  userId = await ensureUser(db, 'terskel@example.com', 'Terskeltester');
  const org = await createOrganization(db, {
    name: 'Terskel AS',
    orgForm: 'AS',
    vatStatus: 'not_registered',
    createdByUserId: userId,
  });
  orgId = org.id;
});

afterAll(async () => {
  await db.end();
});

describe('vatRegistrationThreshold', () => {
  it('summerer bare salgsinntekt innenfor 12-mnd-vinduet', async () => {
    await postSale('2026-03-01', 3_000_000n, 'in-a'); // 30 000 kr, i vindu
    await postSale('2025-05-01', 9_999_900n, 'out-old'); // før vindu → ekskludert
    const t = await vatRegistrationThreshold(db, { organizationId: orgId, asOf: ASOF });
    expect(t.taxableTurnoverMinor).toBe(3_000_000n); // KUN den i vindu
    expect(t.thresholdMinor).toBe(5_000_000n);
    expect(t.remainingMinor).toBe(2_000_000n);
    expect(t.pct).toBe(60);
    expect(t.crossed).toBe(false);
    expect(t.windowFrom).toBe('2025-06-15');
  });

  it('krysser terskelen når omsetningen passerer 50 000 kr', async () => {
    await postSale('2026-04-01', 2_500_000n, 'in-b'); // +25 000 → 55 000 kr totalt i vindu
    const t = await vatRegistrationThreshold(db, { organizationId: orgId, asOf: ASOF });
    expect(t.taxableTurnoverMinor).toBe(5_500_000n);
    expect(t.remainingMinor).toBe(0n);
    expect(t.crossed).toBe(true);
    expect(t.pct).toBe(110);
    // månedsfordeling dekker begge salgene i vindu
    const months = t.monthly.map((m) => m.month);
    expect(months).toContain('2026-03');
    expect(months).toContain('2026-04');
    expect(months).not.toContain('2025-05'); // ekskludert måned
  });
});
