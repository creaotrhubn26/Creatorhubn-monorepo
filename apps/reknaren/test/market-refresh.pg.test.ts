// test/market-refresh.pg.test.ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import { StaticCompanyRegistryStub } from '../src/integrations/company-registry.js';
import { StaticPolicyRateStub } from '../src/market/sources/policy-rate.js';
import { StaticKpiStub } from '../src/market/sources/kpi.js';
import { StaticFxWindowStub } from '../src/market/sources/fx-window.js';
import { refreshMarketSignals, regenerateInsights } from '../src/market/refresh.js';
import { upsertSignal } from '../src/market/signal-store.js';
import { createOrganization, ensureUser } from '../src/orgs/service.js';
import { postJournalEntry } from '../src/ledger/engine.js';
import { newId } from '../src/shared/ids.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
});
afterAll(async () => {
  await db.end();
});

const sources = {
  policyRate: new StaticPolicyRateStub('4.50', '2026-08-14'),
  kpi: new StaticKpiStub('3.4', '2026-07'),
  fxWindow: new StaticFxWindowStub({}), // ingen FX-eksponering i denne testen
  registry: new StaticCompanyRegistryStub({ '910000004': { found: true, orgNumber: '910000004', naceCode: '62.010' } }),
};

describe('refresh + regenerate', () => {
  it('lagrer signaler og genererer kort mot org-gjeld', async () => {
    // forrige rente for Δ
    await upsertSignal(db, { source: 'norges_bank', kind: 'policy_rate', signalKey: 'KPRA', value: '4.25', unit: 'percent', period: '2026-06-19' });
    await refreshMarketSignals(db, sources);

    const userId = await ensureUser(db, 'r@x.no', 'R');
    const org = await createOrganization(db, { name: 'R AS', orgForm: 'AS', vatStatus: 'registered', orgNumber: '910000004', createdByUserId: userId });
    // 2240 (gjeld til kredittinstitusjoner) er ikke i standard kontoplan — legg til for testen
    // (speiler test/market-exposure.pg.test.ts).
    await db.query(
      `INSERT INTO ledger_accounts (id, organization_id, account_number, name, account_type)
       VALUES ($1,$2,'2240','Gjeld til kredittinstitusjoner','liability')`,
      [newId(), org.id],
    );
    await postJournalEntry(db, {
      organizationId: org.id,
      actor: { userId, role: 'owner' },
      entryDate: '2026-08-01',
      description: 'Lån',
      idempotencyKey: 'refresh-test:laan-1',
      lines: [
        { accountNumber: '1920', debitMinor: 48000000n, creditMinor: 0n },
        { accountNumber: '2240', debitMinor: 0n, creditMinor: 48000000n },
      ],
    });

    const n = await regenerateInsights(db, sources, org.id);
    expect(n).toBeGreaterThanOrEqual(2); // rate_debt + kpi_cost
    const rows = await db.query(`SELECT kind, impact_minor FROM insight_cards WHERE organization_id=$1 ORDER BY kind`, [org.id]);
    const rate = rows.rows.find((r) => r.kind === 'rate_debt');
    expect(BigInt(rate.impact_minor)).toBe(120000n);
  });

  it('bygger fx-input fra ekte kjøp og genererer fx_timing/fx_retro-kort', async () => {
    const userId = await ensureUser(db, 'fx@x.no', 'Fx');
    const org = await createOrganization(db, { name: 'Fx AS', orgForm: 'AS', vatStatus: 'registered', orgNumber: '923609016', createdByUserId: userId });
    // Ekte USD-kjøp: 1000 USD (100000 minor) bokført til 12 500 NOK (1250000 minor) — effektiv kurs 12.50 — på en fersk dato (innen 90 dager).
    const today = new Date().toISOString().slice(0, 10);
    await postJournalEntry(db, {
      organizationId: org.id,
      actor: { userId, role: 'owner' },
      entryDate: today,
      description: 'Utenlandsk innkjøp (USD)',
      idempotencyKey: 'refresh-test:fx-1',
      lines: [
        { accountNumber: '6810', debitMinor: 1250000n, creditMinor: 0n, originalCurrency: 'USD', originalAmountMinor: 100000n, exchangeRate: '12.50', exchangeRateSource: 'test' },
        { accountNumber: '1920', debitMinor: 0n, creditMinor: 1250000n },
      ],
    });

    const fxSources = { ...sources, fxWindow: new StaticFxWindowStub({ USD: { latest: '12.00', median: '11.50', period: '2026-08-14' } }) };
    await regenerateInsights(db, fxSources, org.id);

    const rows = await db.query(`SELECT kind, impact_minor FROM insight_cards WHERE organization_id=$1 ORDER BY kind`, [org.id]);
    const timing = rows.rows.find((r) => r.kind === 'fx_timing:USD');
    expect(timing).toBeDefined(); // kronen ~4,35 % svak vs median (>=3 % terskel) -> vises

    const retro = rows.rows.find((r) => r.kind === 'fx_retro:USD');
    expect(retro).toBeDefined();
    // retro medianNokMinor = 100000 x 11.50 = 1 150 000 øre; delta = 1 250 000 - 1 150 000 = 100 000 øre (akkurat på terskelen).
    expect(BigInt(retro.impact_minor)).toBe(100000n);

    const signal = await db.query(`SELECT value_num FROM market_signals WHERE kind='fx_rate' AND signal_key='USD'`);
    expect(signal.rows.length).toBeGreaterThan(0);
  });

  it('avvist kort forblir avvist etter en ny regenerering (dismiss overlever refresh)', async () => {
    const userId = await ensureUser(db, 'dismiss@x.no', 'D');
    const org = await createOrganization(db, { name: 'D AS', orgForm: 'AS', vatStatus: 'registered', createdByUserId: userId });
    await db.query(
      `INSERT INTO ledger_accounts (id, organization_id, account_number, name, account_type)
       VALUES ($1,$2,'2240','Gjeld til kredittinstitusjoner','liability')`,
      [newId(), org.id],
    );
    await postJournalEntry(db, {
      organizationId: org.id,
      actor: { userId, role: 'owner' },
      entryDate: '2026-08-01',
      description: 'Lån',
      idempotencyKey: 'refresh-test:dismiss-laan-1',
      lines: [
        { accountNumber: '1920', debitMinor: 48000000n, creditMinor: 0n },
        { accountNumber: '2240', debitMinor: 0n, creditMinor: 48000000n },
      ],
    });

    await regenerateInsights(db, sources, org.id);
    await db.query(`UPDATE insight_cards SET dismissed_at=now() WHERE organization_id=$1 AND kind='rate_debt'`, [org.id]);

    // Kjør regenerering på nytt — samme regel (rate_debt) fyrer igjen med samme tall.
    await regenerateInsights(db, sources, org.id);

    const row = await db.query(`SELECT dismissed_at FROM insight_cards WHERE organization_id=$1 AND kind='rate_debt'`, [org.id]);
    expect(row.rows[0].dismissed_at).not.toBeNull();
  });
});
