// test/market-migration.pg.test.ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import { setupTestDb } from './helpers.js';

let db: Db;
beforeAll(async () => { db = await setupTestDb(); });
afterAll(async () => { await db.end(); });

describe('0022 market_insight', () => {
  it('oppretter market_signals og insight_cards', async () => {
    const t = await db.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name IN ('market_signals','insight_cards')`,
    );
    expect(t.rows.map((r) => r.table_name).sort()).toEqual(['insight_cards', 'market_signals']);
  });
});
