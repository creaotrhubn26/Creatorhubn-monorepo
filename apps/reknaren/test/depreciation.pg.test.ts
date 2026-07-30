/**
 * Saldoavskrivning: degressiv avskrivning per saldogruppe, full utskriving av
 * restsaldo under 15 000 kr, direkte kostnadsføring av småanskaffelser, og
 * bokføring av årets avskrivningsbilag (idempotent).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import { bookDepreciation, computeDepreciation, createFixedAsset, disposeFixedAsset, listFixedAssets } from '../src/ledger/depreciation.js';
import { createOrganization, ensureUser } from '../src/orgs/service.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
let userId: string;
const actor = () => ({ userId, role: 'owner' });
async function newOrg(name: string) {
  return createOrganization(db, { name, orgForm: 'AS', vatStatus: 'registered', createdByUserId: userId });
}

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  userId = await ensureUser(db, 'avskr@example.com', 'Avskr');
});
afterAll(async () => { await db.end(); });

describe('saldoavskrivning', () => {
  it('avskriver degressivt på gruppens saldo (gruppe a, 30 %)', async () => {
    const org = await newOrg('Avskriv AS');
    await createFixedAsset(db, { organizationId: org.id, actor: actor(), name: 'Kamerapakke', saldoGroup: 'a', acquisitionDate: '2024-06-01', costMinor: 6_000_000n, ledgerAccount: '1280' });
    const y2024 = await computeDepreciation(db, { organizationId: org.id, year: 2024 });
    const ga = y2024.groups.find((g) => g.group === 'a')!;
    expect(ga.ratePct).toBe(30);
    expect(ga.depreciationThisYearMinor).toBe(1_800_000n); // 60 000 × 30 % = 18 000
    expect(ga.closingSaldoMinor).toBe(4_200_000n);
    const y2025 = await computeDepreciation(db, { organizationId: org.id, year: 2025 });
    expect(y2025.groups[0]!.depreciationThisYearMinor).toBe(1_260_000n); // 42 000 × 30 % = 12 600
    expect(y2025.groups[0]!.closingSaldoMinor).toBe(2_940_000n);
  });

  it('skriver ut restsaldo under 15 000 kr fullt (§14-47)', async () => {
    const org = await newOrg('Restsaldo AS');
    await createFixedAsset(db, { organizationId: org.id, actor: actor(), name: 'Verktøy', saldoGroup: 'a', acquisitionDate: '2025-01-01', costMinor: 1_600_000n });
    const y1 = await computeDepreciation(db, { organizationId: org.id, year: 2025 });
    expect(y1.groups[0]!.depreciationThisYearMinor).toBe(480_000n); // 16 000 × 30 %
    const y2 = await computeDepreciation(db, { organizationId: org.id, year: 2026 });
    const g = y2.groups[0]!;
    const row2026 = g.rows.find((r) => r.year === 2026)!;
    expect(row2026.basisMinor).toBe(1_120_000n); // 11 200 kr < 15 000
    expect(row2026.fullWriteOff).toBe(true);
    expect(row2026.depreciationMinor).toBe(1_120_000n);
    expect(row2026.closingSaldoMinor).toBe(0n);
  });

  it('småanskaffelser under 15 000 kr kostnadsføres direkte (ikke aktivert)', async () => {
    const org = await newOrg('Smått AS');
    const small = await createFixedAsset(db, { organizationId: org.id, actor: actor(), name: 'Kontorstol', saldoGroup: 'd', acquisitionDate: '2026-01-01', costMinor: 1_000_000n });
    expect(small.status).toBe('expensed');
    const res = await computeDepreciation(db, { organizationId: org.id, year: 2026 });
    expect(res.groups).toHaveLength(0); // ikke i saldo
    expect(res.smallAssets.map((a) => a.name)).toContain('Kontorstol');
  });

  it('utrangering trekker vederlaget fra saldoen', async () => {
    const org = await newOrg('Utrangering AS');
    const a = await createFixedAsset(db, { organizationId: org.id, actor: actor(), name: 'Maskin', saldoGroup: 'd', acquisitionDate: '2025-01-01', costMinor: 10_000_000n });
    await disposeFixedAsset(db, { organizationId: org.id, assetId: a.id, disposalDate: '2026-03-01', proceedsMinor: 3_000_000n });
    const y2026 = await computeDepreciation(db, { organizationId: org.id, year: 2026 });
    const row = y2026.groups[0]!.rows.find((r) => r.year === 2026)!;
    expect(row.disposalProceedsMinor).toBe(3_000_000n);
    // 2025: 100 000 → 20 % = 20 000, saldo 80 000. 2026: (80 000 − 30 000)=50 000 × 20 % = 10 000
    expect(row.basisMinor).toBe(5_000_000n);
    expect(row.depreciationMinor).toBe(1_000_000n);
  });

  it('bokfører årets avskrivning som ett bilag, idempotent', async () => {
    const org = await newOrg('Bokfør AS');
    await createFixedAsset(db, { organizationId: org.id, actor: actor(), name: 'Server', saldoGroup: 'a', acquisitionDate: '2026-01-01', costMinor: 5_000_000n });
    const booked = await bookDepreciation(db, { organizationId: org.id, actor: actor(), year: 2026 });
    expect('entryNumber' in booked && booked.amountMinor).toBe(1_500_000n); // 50 000 × 30 %
    // Debet 6000, kredit 1290
    const lines = (await db.query(
      `SELECT account_number, debit_minor, credit_minor FROM journal_lines l JOIN journal_entries je ON je.id=l.entry_id
       WHERE je.organization_id=$1 ORDER BY account_number`, [org.id])).rows;
    expect(lines.find((l) => l.account_number === '6000')!.debit_minor).toBe('1500000');
    expect(lines.find((l) => l.account_number === '1290')!.credit_minor).toBe('1500000');
    // Idempotent: kjør igjen → ingen nye posteringer.
    await bookDepreciation(db, { organizationId: org.id, actor: actor(), year: 2026 });
    const cnt = Number((await db.query(`SELECT COUNT(*)::int c FROM journal_entries WHERE organization_id=$1`, [org.id])).rows[0].c);
    expect(cnt).toBe(1);
  });
});
