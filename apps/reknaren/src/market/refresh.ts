/**
 * Orkestrering: hent markedskilder → persister signaler; les signaler + org-
 * eksponering → bygg innsikts-kort via motoren → skriv insight_cards (behold
 * avviste kort).
 */
import type { Db } from '../db/pool.js';
import type { CompanyRegistry } from '../integrations/company-registry.js';
import { buildInsights, rateTenThousandths, type FxInput } from './engine.js';
import { getOrgExposure } from './exposure.js';
import type { KpiSource } from './sources/kpi.js';
import type { PolicyRateSource } from './sources/policy-rate.js';
import type { FxWindowSource } from './sources/fx-window.js';
import { latestSignal, previousSignal, upsertSignal } from './signal-store.js';

export interface MarketSources {
  policyRate: PolicyRateSource;
  kpi: KpiSource;
  fxWindow: FxWindowSource;
  registry: CompanyRegistry;
}

export async function refreshMarketSignals(db: Db, sources: MarketSources): Promise<{ updated: string[] }> {
  const updated: string[] = [];
  const rate = await sources.policyRate.latest();
  if (rate) {
    await upsertSignal(db, { source: 'norges_bank', kind: 'policy_rate', signalKey: 'KPRA', value: rate.value, unit: 'percent', period: rate.period });
    updated.push('policy_rate');
  }
  const kpi = await sources.kpi.latest();
  if (kpi) {
    await upsertSignal(db, { source: 'ssb', kind: 'kpi_yoy', signalKey: 'KPI', value: kpi.value, unit: 'percent', period: kpi.period });
    updated.push('kpi_yoy');
  }
  return { updated };
}

export async function regenerateInsights(db: Db, sources: MarketSources, organizationId: string): Promise<number> {
  const [policyRate, policyRatePrev, kpi, exposure] = await Promise.all([
    latestSignal(db, 'policy_rate', 'KPRA'),
    previousSignal(db, 'policy_rate', 'KPRA'),
    latestSignal(db, 'kpi_yoy', 'KPI'),
    getOrgExposure(db, sources.registry, organizationId),
  ]);

  // Bygg FX-inputs per importvaluta (union av handlede valutaer + kjøpsvaluter).
  const currencies = Array.from(new Set([...exposure.fxCurrencies, ...exposure.fxPurchases.map((p) => p.currency)]));
  const today = new Date().toISOString().slice(0, 10);
  const fx: FxInput[] = [];
  for (const currency of currencies) {
    const w = await sources.fxWindow.window(currency, today, 90);
    if (!w) continue;
    // Persister dagens kurs som signal (periode = observasjonens dato).
    await upsertSignal(db, { source: 'norges_bank', kind: 'fx_rate', signalKey: currency, value: w.latest, unit: 'nok_per_unit', period: w.period });
    const spend = exposure.fxSpend.find((s) => s.currency === currency);
    const purch = exposure.fxPurchases.find((p) => p.currency === currency);
    // retro.medianNokMinor = hva kjøpene ville kostet på snittkursen. original_amount_minor antas i
    // valutaens minor-enheter (2 desimaler); NOK-øre = totalForeign × rate = totalForeign × (rateTT/10000).
    const retro = purch
      ? { purchaseCount: purch.purchaseCount, actualNokMinor: purch.actualNokMinor,
          medianNokMinor: (purch.totalForeignMinor * rateTenThousandths(w.median)) / 10000n }
      : null;
    fx.push({
      currency, latestRate: w.latest, medianRate: w.median, period: w.period,
      medianMonthlySpendMinor: spend?.medianMonthlyMinor ?? null, retro,
    });
  }

  const cards = buildInsights({ policyRate, policyRatePrev, kpi, fx, exposure });

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    // Behold avviste kort; erstatt de aktive.
    await client.query(`DELETE FROM insight_cards WHERE organization_id=$1 AND dismissed_at IS NULL`, [organizationId]);
    for (const c of cards) {
      await client.query(
        `INSERT INTO insight_cards (organization_id, kind, severity, title, body, impact_minor, direction, signal_refs, sources, valid_until)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now() + interval '14 days')
         ON CONFLICT (organization_id, kind) DO UPDATE SET
           severity=EXCLUDED.severity, title=EXCLUDED.title, body=EXCLUDED.body,
           impact_minor=EXCLUDED.impact_minor, direction=EXCLUDED.direction,
           signal_refs=EXCLUDED.signal_refs, sources=EXCLUDED.sources,
           valid_until=EXCLUDED.valid_until, dismissed_at=NULL, created_at=now()`,
        [organizationId, c.kind, c.severity, c.title, c.body,
         c.impactMinor === null ? null : c.impactMinor.toString(), c.direction,
         JSON.stringify(c.signalRefs), JSON.stringify(c.sources)],
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  return cards.length;
}

export async function regenerateAllOrgs(db: Db, sources: MarketSources): Promise<{ orgs: number; cards: number }> {
  const orgs = await db.query(`SELECT id FROM organizations`);
  let cards = 0;
  for (const row of orgs.rows) cards += await regenerateInsights(db, sources, row.id as string);
  return { orgs: orgs.rowCount ?? 0, cards };
}
