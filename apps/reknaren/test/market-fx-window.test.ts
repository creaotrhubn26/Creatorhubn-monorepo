import { describe, expect, it } from 'vitest';
import { NorgesBankFxWindow, StaticFxWindowStub, type FxWindowSource } from '../src/market/sources/fx-window.js';

/** Bygger et Norges Bank SDMX-JSON-svar med gitt multiplikator og observasjoner (speiler test/fx-rates.test.ts). */
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

describe('NorgesBankFxWindow', () => {
  it('latest = nyeste dato, median = midterste verdi (numerisk sortert)', async () => {
    const fx = new NorgesBankFxWindow(
      fetchReturning(
        makeBody(0, {
          '2026-05-20': '11.00',
          '2026-06-15': '12.00',
          '2026-08-14': '11.50',
        }),
      ),
    );
    const w = await fx.window('EUR', '2026-08-14', 90);
    expect(w?.latest).toBe('11.50'); // verdien på nyeste dato (2026-08-14)
    expect(w?.median).toBe('11.50'); // sortert [11.00, 11.50, 12.00] -> midterste
    expect(w?.period).toBe('2026-08-14');
  });

  it('NOK gir ingen kurs (ingen konvertering)', async () => {
    const fx = new NorgesBankFxWindow(fetchReturning(makeBody(0, {})));
    expect(await fx.window('NOK', '2026-08-14', 90)).toBeNull();
  });
});

describe('StaticFxWindowStub', () => {
  it('returnerer konfigurert vindu', async () => {
    const fx: FxWindowSource = new StaticFxWindowStub({ EUR: { latest: '11.60', median: '11.50', period: '2026-08-14' } });
    const w = await fx.window('eur', '2026-08-14', 90);
    expect(w).toEqual({ currency: 'EUR', latest: '11.60', median: '11.50', period: '2026-08-14' });
    expect(await fx.window('USD', '2026-08-14', 90)).toBeNull();
  });
});
