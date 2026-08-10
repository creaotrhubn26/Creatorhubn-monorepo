import { describe, expect, it } from 'vitest';
import { NorgesBankFxRates, StaticFxRateStub } from '../src/integrations/fx-rates.js';

/** Bygger et Norges Bank SDMX-JSON-svar med gitt multiplikator og observasjoner. */
function makeBody(unitMult: number, obs: Record<string, string>) {
  const dates = Object.keys(obs);
  return {
    data: {
      structure: {
        attributes: {
          series: [
            { id: 'DECIMALS', values: [{ id: '4' }] },
            { id: 'CALCULATED', values: [{ id: 'false' }] },
            { id: 'UNIT_MULT', values: [{ id: String(unitMult) }] },
            { id: 'COLLECTION', values: [{ id: 'C' }] },
          ],
        },
        dimensions: { observation: [{ values: dates.map((d) => ({ id: d })) }] },
      },
      dataSets: [
        {
          series: {
            '0:0:0:0': {
              attributes: [0, 0, 0, 0],
              observations: Object.fromEntries(dates.map((d, i) => [String(i), [obs[d]!]])),
            },
          },
        },
      ],
    },
  };
}

function fetchReturning(body: unknown, status = 200) {
  return async () => ({ status, ok: status >= 200 && status < 300, json: async () => body });
}

describe('NorgesBankFxRates', () => {
  it('per-1-valuta (USD): kursen brukes direkte', async () => {
    const fx = new NorgesBankFxRates(fetchReturning(makeBody(0, { '2026-02-16': '9.5702' })));
    const r = await fx.rate('USD', '2026-02-16');
    expect(r?.rateDecimal).toBe('9.5702');
    expect(r?.forDate).toBe('2026-02-16');
    expect(r?.source).toContain('Norges Bank');
  });

  it('per-100-valuta (SEK): normaliseres til NOK per 1 enhet', async () => {
    const fx = new NorgesBankFxRates(fetchReturning(makeBody(2, { '2026-02-16': '98.49' })));
    const r = await fx.rate('SEK', '2026-02-16');
    expect(r?.rateDecimal).toBe('0.9849'); // 98.49 / 100
  });

  it('helg/helligdag: faller tilbake til nærmeste tidligere kurs', async () => {
    const fx = new NorgesBankFxRates(fetchReturning(makeBody(0, { '2026-02-12': '11.20', '2026-02-13': '11.25' })));
    const r = await fx.rate('EUR', '2026-02-15'); // søndag
    expect(r?.rateDecimal).toBe('11.25');
    expect(r?.forDate).toBe('2026-02-13'); // fredagens kurs
  });

  it('NOK gir ingen kurs (ingen konvertering)', async () => {
    const fx = new NorgesBankFxRates(fetchReturning(makeBody(0, {})));
    expect(await fx.rate('NOK', '2026-02-16')).toBeNull();
  });

  it('ukjent/tom valuta → null', async () => {
    const fx = new NorgesBankFxRates(fetchReturning({ data: { structure: {}, dataSets: [{}] } }));
    expect(await fx.rate('XYZ', '2026-02-16')).toBeNull();
  });

  it('404 → null', async () => {
    const fx = new NorgesBankFxRates(fetchReturning({}, 404));
    expect(await fx.rate('USD', '2026-02-16')).toBeNull();
  });
});

describe('StaticFxRateStub', () => {
  it('returnerer konfigurert kurs', async () => {
    const fx = new StaticFxRateStub({ EUR: '11.50' });
    expect((await fx.rate('eur', '2026-01-01'))?.rateDecimal).toBe('11.50');
    expect(await fx.rate('USD', '2026-01-01')).toBeNull();
  });
});
