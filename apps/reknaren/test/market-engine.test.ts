// test/market-engine.test.ts
import { describe, expect, it } from 'vitest';
import { buildInsights } from '../src/market/engine.js';
import type { OrgExposure } from '../src/market/exposure.js';

const exposure: OrgExposure = { interestBearingDebtMinor: 48000000n, fxCurrencies: [], fxSpend: [], fxPurchases: [], naceCode: '62.010' };

describe('buildInsights', () => {
  it('rate_debt: renta opp 0,25 på 480 000 kr gjeld → +1 200 kr/år kost', () => {
    const cards = buildInsights({
      policyRate: { source: 'norges_bank', kind: 'policy_rate', signalKey: 'KPRA', value: '4.50', unit: 'percent', period: '2026-08-14' },
      policyRatePrev: { source: 'norges_bank', kind: 'policy_rate', signalKey: 'KPRA', value: '4.25', unit: 'percent', period: '2026-06-19' },
      exposure,
    });
    const rate = cards.find((c) => c.kind === 'rate_debt');
    expect(rate?.severity).toBe('watch');
    expect(rate?.direction).toBe('cost');
    expect(rate?.impactMinor).toBe(120000n); // 0.0025 * 48 000 000 øre = 120 000 øre = 1 200 kr
    expect(rate?.sources[0]?.label).toContain('Norges Bank');
  });

  it('ingen rate_debt når renta er uendret', () => {
    const cards = buildInsights({
      policyRate: { source: 'norges_bank', kind: 'policy_rate', signalKey: 'KPRA', value: '4.50', unit: 'percent', period: '2026-08-14' },
      policyRatePrev: { source: 'norges_bank', kind: 'policy_rate', signalKey: 'KPRA', value: '4.50', unit: 'percent', period: '2026-06-19' },
      exposure,
    });
    expect(cards.find((c) => c.kind === 'rate_debt')).toBeUndefined();
  });

  it('kpi_cost er et rent signal uten kroner-effekt', () => {
    const cards = buildInsights({
      kpi: { source: 'ssb', kind: 'kpi_yoy', signalKey: 'KPI', value: '3.4', unit: 'percent', period: '2026-07' },
      exposure,
    });
    const kpi = cards.find((c) => c.kind === 'kpi_cost');
    expect(kpi?.severity).toBe('signal');
    expect(kpi?.impactMinor).toBeNull();
    expect(kpi?.body).toContain('3,4');
  });

  it('fx_timing: kronen svak mot EUR (>3%) → watch + kroner-estimat', () => {
    const cards = buildInsights({
      fx: [{ currency: 'EUR', latestRate: '12.00', medianRate: '11.50', period: '2026-08-14', medianMonthlySpendMinor: 5000000n, retro: null }],
      exposure,
    });
    const fx = cards.find((c) => c.kind === 'fx_timing:EUR');
    expect(fx?.severity).toBe('watch');
    expect(fx?.direction).toBe('cost');
    // avvik = (120000-115000)/115000 = 4,35 %; impact = 5 000 000 * 5000 / 115000 = 217 391 (trunkert)
    expect(fx?.impactMinor).toBe(217391n);
    expect(fx?.body).toContain('EUR');
  });

  it('fx_timing: lite avvik (<3%) → intet kort', () => {
    const cards = buildInsights({
      fx: [{ currency: 'USD', latestRate: '10.20', medianRate: '10.10', period: '2026-08-14', medianMonthlySpendMinor: null, retro: null }],
      exposure,
    });
    expect(cards.find((c) => c.kind?.startsWith('fx_timing'))).toBeUndefined();
  });

  it('fx_retro: betalte mer enn snittkursen på faktiske kjøp → signal-kort med positivt delta', () => {
    const cards = buildInsights({
      fx: [{ currency: 'EUR', latestRate: '11.50', medianRate: '11.50', period: '2026-08-14', medianMonthlySpendMinor: null,
             retro: { purchaseCount: 3, actualNokMinor: 5200000n, medianNokMinor: 5000000n } }],
      exposure,
    });
    const retro = cards.find((c) => c.kind === 'fx_retro:EUR');
    expect(retro?.severity).toBe('signal');
    expect(retro?.impactMinor).toBe(200000n); // 52 000 − 50 000 = 2 000 kr mer enn snittet
    expect(retro?.body).toContain('EUR');
  });

  it('fx_retro: under støy-terskel (<1 000 kr) → intet kort', () => {
    const cards = buildInsights({
      fx: [{ currency: 'EUR', latestRate: '11.50', medianRate: '11.50', period: '2026-08-14', medianMonthlySpendMinor: null,
             retro: { purchaseCount: 2, actualNokMinor: 5005000n, medianNokMinor: 5000000n } }],
      exposure,
    });
    expect(cards.find((c) => c.kind?.startsWith('fx_retro'))).toBeUndefined();
  });
});
