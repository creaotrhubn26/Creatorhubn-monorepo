/**
 * AI-margin mot ekte Postgres: AI-inntekt (3210) vs AI-kostnad (6555) per produkt,
 * fra posterte journallinjer. Pluss gjenkjenning av AI-linjer.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import {
  AI_COST_ACCOUNT,
  AI_REVENUE_ACCOUNT,
  aiMarginReport,
  ensureAiAccounts,
  isAiUsageLine,
} from '../src/ops/ai-accounts.js';
import { createOrganization, ensureUser } from '../src/orgs/service.js';
import { newId } from '../src/shared/ids.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
let orgId: string;
let userId: string;

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  userId = await ensureUser(db, 'ai@example.com', 'AI-tester');
  const org = await createOrganization(db, {
    name: 'Creatorhub AS',
    orgForm: 'AS',
    vatStatus: 'not_registered',
    orgNumber: '937518684',
    createdByUserId: userId,
  });
  orgId = org.id;
  await ensureAiAccounts(db, orgId);
});

afterAll(async () => {
  await db.end();
});

describe('isAiUsageLine', () => {
  it('kjenner igjen AI-/bruksbaserte linjer', () => {
    expect(isAiUsageLine('AI overage')).toBe(true);
    expect(isAiUsageLine('Kredittpakke')).toBe(true);
    expect(isAiUsageLine('Token usage')).toBe(true);
    expect(isAiUsageLine('Leadgrid Solo Pro')).toBe(false);
    expect(isAiUsageLine(null)).toBe(false);
  });
});

describe('AI-kontoer + margin', () => {
  it('ensureAiAccounts oppretter 6555 (kostnad) + 3210 (inntekt), idempotent', async () => {
    await ensureAiAccounts(db, orgId); // kjøres igjen — skal ikke feile
    const accts = await db.query<{ account_number: string; account_type: string }>(
      `SELECT account_number, account_type FROM ledger_accounts
       WHERE organization_id = $1 AND account_number IN ($2, $3)`,
      [orgId, AI_COST_ACCOUNT, AI_REVENUE_ACCOUNT],
    );
    expect(accts.rows).toHaveLength(2);
    expect(accts.rows.find((r) => r.account_number === '6555')?.account_type).toBe('expense');
    expect(accts.rows.find((r) => r.account_number === '3210')?.account_type).toBe('revenue');
  });

  it('aiMarginReport: inntekt − kostnad per produkt', async () => {
    // Én balansert bokføring: AI-inntekt 500 (3210) + AI-kostnad 200 (6555), tagget LEADGRID.
    const periodId = newId();
    await db.query(
      `INSERT INTO accounting_periods (id, organization_id, year, month) VALUES ($1,$2,2026,1)`,
      [periodId, orgId],
    );
    const entryId = newId();
    await db.query(
      `INSERT INTO journal_entries
         (id, organization_id, entry_number, entry_date, period_id, description, idempotency_key, posted_by, posted_by_role)
       VALUES ($1,$2,1,'2026-01-15',$3,'AI-test','ai-test-1',$4,'owner')`,
      [entryId, orgId, periodId, userId],
    );
    const line = (n: number, acct: string, debit: number, credit: number, project: string | null) =>
      db.query(
        `INSERT INTO journal_lines
           (id, entry_id, organization_id, line_number, account_number, debit_minor, credit_minor, project)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [newId(), entryId, orgId, n, acct, debit, credit, project],
      );
    await line(1, AI_REVENUE_ACCOUNT, 0, 50000, 'LEADGRID'); // AI-inntekt
    await line(2, '1920', 50000, 0, null); // bank (balanse)
    await line(3, AI_COST_ACCOUNT, 20000, 0, 'LEADGRID'); // AI-kostnad
    await line(4, '1920', 0, 20000, null); // bank (balanse)

    const rows = await aiMarginReport(db, { organizationId: orgId });
    const lg = rows.find((r) => r.code === 'LEADGRID');
    expect(lg).toBeDefined();
    expect(lg!.aiRevenueMinor).toBe(50000n);
    expect(lg!.aiCostMinor).toBe(20000n);
    expect(lg!.marginMinor).toBe(30000n); // 500 − 200
  });
});
