/**
 * Pengehåndtering med presis desimalaritmetikk.
 *
 * Beløp lagres som bigint i valutaens minste enhet (øre for NOK, cent for EUR/USD).
 * Flyttall brukes ALDRI for penger — verken i beregning, lagring eller transport.
 * I databasen lagres beløp som BIGINT (minor units) + valutakode.
 */

export type CurrencyCode = string; // ISO 4217, f.eks. 'NOK', 'EUR', 'USD'

/** Antall desimaler per valuta (ISO 4217). Default 2. */
const CURRENCY_EXPONENT: Record<string, number> = {
  NOK: 2,
  EUR: 2,
  USD: 2,
  SEK: 2,
  DKK: 2,
  GBP: 2,
  JPY: 0,
  ISK: 0,
};

export function currencyExponent(currency: CurrencyCode): number {
  return CURRENCY_EXPONENT[currency] ?? 2;
}

export interface Money {
  /** Beløp i valutaens minste enhet (øre/cent). Kan være negativt. */
  readonly minorUnits: bigint;
  readonly currency: CurrencyCode;
}

export class MoneyError extends Error {
  override name = 'MoneyError';
}

export function money(minorUnits: bigint | number, currency: CurrencyCode): Money {
  if (typeof minorUnits === 'number') {
    if (!Number.isSafeInteger(minorUnits)) {
      throw new MoneyError(
        `Beløp må angis som heltall i minste enhet (øre/cent), fikk: ${minorUnits}`,
      );
    }
    minorUnits = BigInt(minorUnits);
  }
  return { minorUnits, currency };
}

/**
 * Parser en desimalstreng ("1234.56", "-99,90") til Money uten flyttall.
 * Godtar både punktum og komma som desimalskilletegn.
 */
export function moneyFromDecimalString(value: string, currency: CurrencyCode): Money {
  const exp = currencyExponent(currency);
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.');
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(normalized);
  if (!m) {
    throw new MoneyError(`Ugyldig beløp: "${value}"`);
  }
  const sign = m[1] === '-' ? -1n : 1n;
  const whole = m[2] ?? '0';
  let frac = m[3] ?? '';
  if (frac.length > exp) {
    // Flere desimaler enn valutaen støtter er en datafeil, ikke noe vi avrunder stille.
    throw new MoneyError(
      `Beløp "${value}" har flere desimaler enn ${currency} støtter (${exp})`,
    );
  }
  frac = frac.padEnd(exp, '0');
  const minor = sign * (BigInt(whole) * 10n ** BigInt(exp) + BigInt(frac || '0'));
  return { minorUnits: minor, currency };
}

export function moneyToDecimalString(m: Money): string {
  const exp = currencyExponent(m.currency);
  const neg = m.minorUnits < 0n;
  const abs = neg ? -m.minorUnits : m.minorUnits;
  const base = 10n ** BigInt(exp);
  const whole = abs / base;
  const frac = (abs % base).toString().padStart(exp, '0');
  const s = exp === 0 ? whole.toString() : `${whole}.${frac}`;
  return neg ? `-${s}` : s;
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new MoneyError(`Kan ikke kombinere ${a.currency} og ${b.currency} direkte`);
  }
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { minorUnits: a.minorUnits + b.minorUnits, currency: a.currency };
}

export function subtractMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { minorUnits: a.minorUnits - b.minorUnits, currency: a.currency };
}

export function negateMoney(a: Money): Money {
  return { minorUnits: -a.minorUnits, currency: a.currency };
}

export function isZero(a: Money): boolean {
  return a.minorUnits === 0n;
}

export function moneyEquals(a: Money, b: Money): boolean {
  return a.currency === b.currency && a.minorUnits === b.minorUnits;
}

export type RoundingMode = 'half-up' | 'half-even';

/**
 * Multipliserer et beløp med en rasjonal faktor (num/den) og avrunder deterministisk.
 * Brukes til MVA-beregning (f.eks. 25/125 av bruttobeløp) og valutaomregning.
 */
export function multiplyRational(
  a: Money,
  numerator: bigint,
  denominator: bigint,
  mode: RoundingMode = 'half-up',
): Money {
  if (denominator === 0n) throw new MoneyError('Divisjon på null');
  // Normaliser slik at nevneren er positiv
  if (denominator < 0n) {
    numerator = -numerator;
    denominator = -denominator;
  }
  const product = a.minorUnits * numerator;
  const quotient = product / denominator;
  const remainder = product % denominator; // samme fortegn som product
  if (remainder === 0n) return { minorUnits: quotient, currency: a.currency };

  const absRem = remainder < 0n ? -remainder : remainder;
  const twice = absRem * 2n;
  const negative = product < 0n;

  let roundAway: boolean;
  if (twice > denominator) {
    roundAway = true;
  } else if (twice < denominator) {
    roundAway = false;
  } else {
    // Nøyaktig halvveis
    roundAway =
      mode === 'half-up' ? true : (quotient % 2n === 0n ? false : true); // half-even: rund til partall
  }
  const adjusted = roundAway ? quotient + (negative ? -1n : 1n) : quotient;
  return { minorUnits: adjusted, currency: a.currency };
}

/**
 * Regner om et beløp til NOK med en valutakurs oppgitt som desimalstreng
 * (f.eks. "11.4850" for EUR→NOK). Kursen parses eksakt — aldri via flyttall.
 */
export function convertToNok(
  amount: Money,
  exchangeRateDecimal: string,
  mode: RoundingMode = 'half-up',
): Money {
  if (amount.currency === 'NOK') return amount;
  const m = /^(\d+)(?:\.(\d+))?$/.exec(exchangeRateDecimal.trim().replace(',', '.'));
  if (!m) throw new MoneyError(`Ugyldig valutakurs: "${exchangeRateDecimal}"`);
  const frac = m[2] ?? '';
  const rateNum = BigInt((m[1] ?? '0') + frac);
  const rateDen = 10n ** BigInt(frac.length);
  // Juster for ulik exponent mellom valutaene (f.eks. JPY 0 desimaler → NOK 2)
  const fromExp = BigInt(currencyExponent(amount.currency));
  const toExp = BigInt(currencyExponent('NOK'));
  const scaleNum = 10n ** toExp;
  const scaleDen = 10n ** fromExp;
  const converted = multiplyRational(
    { minorUnits: amount.minorUnits, currency: 'NOK' },
    rateNum * scaleNum,
    rateDen * scaleDen,
    mode,
  );
  return converted;
}
