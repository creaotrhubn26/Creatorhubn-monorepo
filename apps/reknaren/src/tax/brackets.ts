/**
 * Trinnskatt på personinntekt (progressiv). Per-år-tabeller fra Skatteetaten:
 * https://www.skatteetaten.no/satser/trinnskatt/
 *
 * 2025:  217 401 (1,7 %) · 306 051 (4,0 %) · 697 151 (13,7 %) · 942 401 (16,7 %) · 1 410 751 (17,7 %)
 * 2026:  226 101 (1,7 %) · 318 301 (4,0 %) · 725 051 (13,7 %) · 980 101 (16,8 %) · 1 467 201 (17,8 %)
 *
 * ponytail: legg til ny årsnøkkel når Skatteetaten publiserer neste års satser;
 * ukjent år faller tilbake til nærmeste tidligere tabell (nyeste ≤ år).
 */
interface Bracket { fromMinor: bigint; ratePer1000: number }

const TRINNSKATT_BY_YEAR: Record<number, Bracket[]> = {
  2025: [
    { fromMinor: 21_740_100n, ratePer1000: 17 },
    { fromMinor: 30_605_100n, ratePer1000: 40 },
    { fromMinor: 69_715_100n, ratePer1000: 137 },
    { fromMinor: 94_240_100n, ratePer1000: 167 },
    { fromMinor: 141_075_100n, ratePer1000: 177 },
  ],
  2026: [
    { fromMinor: 22_610_100n, ratePer1000: 17 },
    { fromMinor: 31_830_100n, ratePer1000: 40 },
    { fromMinor: 72_505_100n, ratePer1000: 137 },
    { fromMinor: 98_010_100n, ratePer1000: 168 },
    { fromMinor: 146_720_100n, ratePer1000: 178 },
  ],
};

/** Velger tabell for året; ukjent år → nyeste tabell som ikke er senere enn året (ellers eldste). */
function bracketsFor(year: number): Bracket[] {
  if (TRINNSKATT_BY_YEAR[year]) return TRINNSKATT_BY_YEAR[year]!;
  const years = Object.keys(TRINNSKATT_BY_YEAR).map(Number).sort((a, b) => a - b);
  const atOrBefore = years.filter((y) => y <= year);
  const pick = atOrBefore.length ? atOrBefore[atOrBefore.length - 1]! : years[0]!;
  return TRINNSKATT_BY_YEAR[pick]!;
}

/** Progressiv trinnskatt av personinntekt (øre) for gitt inntektsår. */
export function computeTrinnskattMinor(personinntektMinor: bigint, year: number): bigint {
  const brackets = bracketsFor(year);
  if (personinntektMinor <= brackets[0]!.fromMinor) return 0n;
  let tax = 0n;
  for (let i = 0; i < brackets.length; i++) {
    const lower = brackets[i]!.fromMinor;
    if (personinntektMinor <= lower) break;
    const upper = i + 1 < brackets.length ? brackets[i + 1]!.fromMinor : personinntektMinor;
    const portion = (personinntektMinor < upper ? personinntektMinor : upper) - lower;
    tax += (portion * BigInt(brackets[i]!.ratePer1000)) / 1000n;
  }
  return tax;
}

/** Marginal trinnskatt-sats (promille) på neste krone ved gitt personinntekt og inntektsår. */
export function marginalTrinnskattPer1000(personinntektMinor: bigint, year: number): number {
  let rate = 0;
  for (const b of bracketsFor(year)) {
    if (personinntektMinor > b.fromMinor) rate = b.ratePer1000;
  }
  return rate;
}
