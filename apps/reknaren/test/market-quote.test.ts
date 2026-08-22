/**
 * Kurshenting: verdiregning (ren) + ticker-validering (uten nettverk).
 */
import { describe, expect, it } from 'vitest';
import { fetchYahooQuote, marketValueFromQuote } from '../src/tax/market-quote.js';

describe('marketValueFromQuote', () => {
  it('markedsverdi = kurs × antall andeler', () => {
    // 285,50 kr/andel (28 550 øre) × 10 andeler (10e6 mikro) = 2 855,00 kr.
    expect(marketValueFromQuote(28_550n, 10_000_000n)).toBe(285_500n);
    // Brøkandel: 100,00 kr × 12,5 andeler = 1 250,00 kr.
    expect(marketValueFromQuote(10_000n, 12_500_000n)).toBe(125_000n);
  });
});

describe('fetchYahooQuote validering', () => {
  it('avviser ugyldig ticker før nettverkskall', async () => {
    await expect(fetchYahooQuote('bad ticker!')).rejects.toThrow(/Ugyldig ticker/);
    await expect(fetchYahooQuote('')).rejects.toThrow(/Ugyldig ticker/);
  });
});
