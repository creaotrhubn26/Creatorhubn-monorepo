import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  addMoney,
  convertToNok,
  money,
  moneyFromDecimalString,
  moneyToDecimalString,
  MoneyError,
  multiplyRational,
  negateMoney,
} from '../src/shared/money.js';

describe('Money — presis desimalhåndtering uten flyttall', () => {
  it('parser norske og engelske desimalformater eksakt', () => {
    expect(moneyFromDecimalString('1234.56', 'NOK').minorUnits).toBe(123456n);
    expect(moneyFromDecimalString('1234,56', 'NOK').minorUnits).toBe(123456n);
    expect(moneyFromDecimalString('-99,90', 'NOK').minorUnits).toBe(-9990n);
    expect(moneyFromDecimalString('0.1', 'NOK').minorUnits).toBe(10n);
    expect(moneyFromDecimalString('25 000,00', 'NOK').minorUnits).toBe(2500000n);
  });

  it('avviser flere desimaler enn valutaen støtter i stedet for å avrunde stille', () => {
    expect(() => moneyFromDecimalString('1.234', 'NOK')).toThrow(MoneyError);
    expect(() => moneyFromDecimalString('100.5', 'JPY')).toThrow(MoneyError);
  });

  it('property: parse ∘ format er identitet', () => {
    fc.assert(
      fc.property(fc.bigInt({ min: -(10n ** 15n), max: 10n ** 15n }), (minor) => {
        const m = money(minor, 'NOK');
        expect(moneyFromDecimalString(moneyToDecimalString(m), 'NOK').minorUnits).toBe(minor);
      }),
    );
  });

  it('property: addisjon er assosiativ og har invers', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: -(10n ** 12n), max: 10n ** 12n }),
        fc.bigInt({ min: -(10n ** 12n), max: 10n ** 12n }),
        (a, b) => {
          const ma = money(a, 'NOK');
          const mb = money(b, 'NOK');
          expect(addMoney(ma, mb).minorUnits).toBe(a + b);
          expect(addMoney(ma, negateMoney(ma)).minorUnits).toBe(0n);
        },
      ),
    );
  });

  it('nekter å blande valutaer', () => {
    expect(() => addMoney(money(100n, 'NOK'), money(100n, 'EUR'))).toThrow(MoneyError);
  });

  it('multiplyRational avrunder half-up deterministisk', () => {
    // 100 øre × 1/3 = 33,33… → 33
    expect(multiplyRational(money(100n, 'NOK'), 1n, 3n).minorUnits).toBe(33n);
    // 100 × 1/8 = 12,5 → 13 (half-up)
    expect(multiplyRational(money(100n, 'NOK'), 1n, 8n).minorUnits).toBe(13n);
    // half-even: 12,5 → 12
    expect(multiplyRational(money(100n, 'NOK'), 1n, 8n, 'half-even').minorUnits).toBe(12n);
    // negative beløp avrundes symmetrisk
    expect(multiplyRational(money(-100n, 'NOK'), 1n, 8n).minorUnits).toBe(-13n);
  });

  it('konverterer EUR→NOK med eksakt kurs', () => {
    // 66,99 EUR × 11,50 = 770,385 → 770,39 kr (half-up)
    const nok = convertToNok(money(6699n, 'EUR'), '11.50');
    expect(nok.currency).toBe('NOK');
    expect(nok.minorUnits).toBe(77039n);
  });

  it('håndterer valuta uten desimaler (JPY)', () => {
    // 1000 JPY × 0,07 = 70,00 kr
    expect(convertToNok(money(1000n, 'JPY'), '0.07').minorUnits).toBe(7000n);
  });

  it('avviser ugyldig kurs', () => {
    expect(() => convertToNok(money(100n, 'EUR'), 'abc')).toThrow(MoneyError);
  });
});
