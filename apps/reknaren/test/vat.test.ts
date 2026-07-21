import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { buildNorwegianRuleRegister } from '../src/rules/no/rules.js';
import { splitGrossByVatCode, vatAmountMatches, vatOfNet } from '../src/vat/engine.js';

const rules = buildNorwegianRuleRegister();
const DATE = '2025-06-15';

describe('MVA-motor — deterministisk og reproduserbar', () => {
  it('splitter brutto med 25 % (kode 1): 12 500,00 → 10 000,00 + 2 500,00', () => {
    const parts = splitGrossByVatCode(rules, '1', 1250000n, DATE);
    expect(parts.netMinor).toBe(1000000n);
    expect(parts.vatMinor).toBe(250000n);
    expect(parts.ratePct).toBe('25');
  });

  it('middels sats 15 % (kode 11): 115,00 → 100,00 + 15,00', () => {
    const parts = splitGrossByVatCode(rules, '11', 11500n, DATE);
    expect(parts.netMinor).toBe(10000n);
    expect(parts.vatMinor).toBe(1500n);
  });

  it('lav sats 12 % (kode 13): 112,00 → 100,00 + 12,00', () => {
    const parts = splitGrossByVatCode(rules, '13', 11200n, DATE);
    expect(parts.netMinor).toBe(10000n);
    expect(parts.vatMinor).toBe(1200n);
  });

  it('koder uten sats (0, 5, 52, 6) gir null mva', () => {
    for (const code of ['0', '5', '52', '6']) {
      const parts = splitGrossByVatCode(rules, code, 99999n, DATE);
      expect(parts.vatMinor).toBe(0n);
      expect(parts.netMinor).toBe(99999n);
    }
  });

  it('vatOfNet beregner 25 % av netto (omvendt avgiftsplikt kode 86)', () => {
    const parts = vatOfNet(rules, '86', 77039n, DATE);
    expect(parts.vatMinor).toBe(19260n); // 770,39 × 0,25 = 192,5975 → 192,60
  });

  it('property: netto + mva == brutto, og mva er aldri negativ for positivt brutto', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 1n, max: 10n ** 13n }),
        fc.constantFrom('1', '11', '13', '0'),
        (gross, code) => {
          const parts = splitGrossByVatCode(rules, code, gross, DATE);
          expect(parts.netMinor + parts.vatMinor).toBe(gross);
          expect(parts.vatMinor >= 0n).toBe(true);
        },
      ),
    );
  });

  it('property: split ∘ vatOfNet er konsistent innenfor ±1 øre avrunding', () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 100n, max: 10n ** 10n }), (gross) => {
        const parts = splitGrossByVatCode(rules, '1', gross, DATE);
        const recomputed = vatOfNet(rules, '1', parts.netMinor, DATE);
        const diff = recomputed.vatMinor - parts.vatMinor;
        expect(diff >= -1n && diff <= 1n).toBe(true);
      }),
    );
  });

  it('vatAmountMatches godtar korrekt mva og avviser feil', () => {
    expect(vatAmountMatches(rules, '1', 1000000n, 250000n, DATE)).toBe(true);
    expect(vatAmountMatches(rules, '1', 1000000n, 250001n, DATE)).toBe(true); // 1 øre toleranse
    expect(vatAmountMatches(rules, '1', 1000000n, 240000n, DATE)).toBe(false);
  });
});
