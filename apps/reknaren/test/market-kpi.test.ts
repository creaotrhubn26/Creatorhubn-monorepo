import { describe, expect, it } from 'vitest';
import { SsbKpi, StaticKpiStub } from '../src/market/sources/kpi.js';

const JSONSTAT = {
  dimension: { Tid: { category: { index: { '2026M07': 0 }, label: { '2026M07': '2026M07' } } } },
  value: [3.4],
};

describe('SsbKpi', () => {
  it('leser siste 12-mnd-endring fra JSON-stat2', async () => {
    const fake = async () => ({ status: 200, ok: true, json: async () => JSONSTAT });
    const r = await new SsbKpi(fake as never).latest();
    expect(r?.value).toBe('3.4');
    expect(r?.period).toBe('2026-07');
  });
  it('stub', async () => {
    expect((await new StaticKpiStub('3.4', '2026-07').latest())?.value).toBe('3.4');
  });
});
