import { describe, expect, it } from 'vitest';
import { NorgesBankPolicyRate, StaticPolicyRateStub } from '../src/market/sources/policy-rate.js';

const SDMX = {
  data: {
    structure: { dimensions: { observation: [{ values: [{ id: '2026-06-19' }, { id: '2026-08-14' }] }] } },
    dataSets: [{ series: { '0:0:0:0': { observations: { '0': ['4.25'], '1': ['4.50'] } } } }],
  },
};

describe('NorgesBankPolicyRate', () => {
  it('parser nyeste observasjon fra SDMX-JSON', async () => {
    const fake = async () => ({ status: 200, ok: true, json: async () => SDMX });
    const src = new NorgesBankPolicyRate(fake as never);
    const r = await src.latest();
    expect(r?.value).toBe('4.50');
    expect(r?.period).toBe('2026-08-14');
  });
  it('stub returnerer oppgitt verdi', async () => {
    const r = await new StaticPolicyRateStub('4.50', '2026-08-14').latest();
    expect(r?.value).toBe('4.50');
  });
});
