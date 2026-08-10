import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import { latestSignal, previousSignal, upsertSignal } from '../src/market/signal-store.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
beforeAll(async () => { db = await setupTestDb(); await truncateAll(); });
afterAll(async () => { await db.end(); });

describe('signal-store', () => {
  it('lagrer, oppdaterer og leser siste + forrige', async () => {
    await upsertSignal(db, { source: 'norges_bank', kind: 'policy_rate', signalKey: 'KPRA', value: '4.25', unit: 'percent', period: '2026-06-19' });
    await upsertSignal(db, { source: 'norges_bank', kind: 'policy_rate', signalKey: 'KPRA', value: '4.50', unit: 'percent', period: '2026-08-14' });
    // idempotent oppdatering av samme periode
    await upsertSignal(db, { source: 'norges_bank', kind: 'policy_rate', signalKey: 'KPRA', value: '4.50', unit: 'percent', period: '2026-08-14' });

    const latest = await latestSignal(db, 'policy_rate', 'KPRA');
    const prev = await previousSignal(db, 'policy_rate', 'KPRA');
    expect(latest?.value).toBe('4.50');
    expect(latest?.period).toBe('2026-08-14');
    expect(prev?.value).toBe('4.25');

    // Verifiser at idempotent upsert oppdaterer i stedet for å sette inn ny rad
    const cnt = await db.query("SELECT count(*)::int AS n FROM market_signals WHERE kind='policy_rate' AND signal_key='KPRA'");
    expect(cnt.rows[0].n).toBe(2);
  });
});
