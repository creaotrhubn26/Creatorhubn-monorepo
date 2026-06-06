import { describe, expect, it } from 'vitest';
import { computeSimpleBudgetEstimate, BUDGET_DEFAULTS } from '../SimpleBudgetEstimator';

describe('computeSimpleBudgetEstimate (drivere × satser)', () => {
  it('regner total fra produsentens egne satser', () => {
    const r = computeSimpleBudgetEstimate({ perShootDay: 20000, perLocation: 4000, otherFixed: 10000 }, 5, 3);
    // 5×20000 + 3×4000 + 10000 = 100000 + 12000 + 10000
    expect(r.total).toBe(122000);
    expect(r.lines.find((l) => l.key === 'day')!.isDefault).toBe(false);
    expect(r.lines.find((l) => l.key === 'location')!.subtotal).toBe(12000);
  });

  it('bruker standard-satser når pris mangler, og markerer dem', () => {
    const r = computeSimpleBudgetEstimate(undefined, 4, 2);
    expect(r.lines.find((l) => l.key === 'day')!.rate).toBe(BUDGET_DEFAULTS.perShootDay);
    expect(r.lines.find((l) => l.key === 'day')!.isDefault).toBe(true);
    expect(r.lines.find((l) => l.key === 'location')!.isDefault).toBe(true);
    // 4×25000 + 2×5000 = 100000 + 10000
    expect(r.total).toBe(110000);
  });

  it('blander egen sats og standard-sats', () => {
    const r = computeSimpleBudgetEstimate({ perShootDay: 30000 }, 2, 1);
    expect(r.lines.find((l) => l.key === 'day')!.isDefault).toBe(false);
    expect(r.lines.find((l) => l.key === 'location')!.isDefault).toBe(true);
    // 2×30000 + 1×5000(standard)
    expect(r.total).toBe(65000);
  });

  it('gir 0 når det ikke er drivere', () => {
    const r = computeSimpleBudgetEstimate({ perShootDay: 25000 }, 0, 0);
    expect(r.total).toBe(0);
  });
});
