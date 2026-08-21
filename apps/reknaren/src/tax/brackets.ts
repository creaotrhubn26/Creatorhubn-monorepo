/**
 * Trinnskatt på personinntekt (progressiv). Satser 2025 fra Skatteetaten:
 * https://www.skatteetaten.no/satser/trinnskatt/
 *   Trinn 1: 217 401–306 050  → 1,7 %
 *   Trinn 2: 306 051–697 150  → 4,0 %
 *   Trinn 3: 697 151–942 400  → 13,7 %
 *   Trinn 4: 942 401–1 410 750 → 16,7 %
 *   Trinn 5: 1 410 751 +        → 17,7 %
 * ponytail: 2025-satser brukes for alle år; oppdater innslagspunkt + satser årlig
 * (og legg inn per-år-tabell hvis nøyaktighet på tvers av år trengs).
 */
interface Bracket { fromMinor: bigint; ratePer1000: number }

const TRINNSKATT_2025: Bracket[] = [
  { fromMinor: 21_740_100n, ratePer1000: 17 },
  { fromMinor: 30_605_100n, ratePer1000: 40 },
  { fromMinor: 69_715_100n, ratePer1000: 137 },
  { fromMinor: 94_240_100n, ratePer1000: 167 },
  { fromMinor: 141_075_100n, ratePer1000: 177 },
];

/** Progressiv trinnskatt av personinntekt (øre). */
export function computeTrinnskattMinor(personinntektMinor: bigint): bigint {
  if (personinntektMinor <= TRINNSKATT_2025[0]!.fromMinor) return 0n;
  let tax = 0n;
  for (let i = 0; i < TRINNSKATT_2025.length; i++) {
    const lower = TRINNSKATT_2025[i]!.fromMinor;
    if (personinntektMinor <= lower) break;
    const upper = i + 1 < TRINNSKATT_2025.length ? TRINNSKATT_2025[i + 1]!.fromMinor : personinntektMinor;
    const portion = (personinntektMinor < upper ? personinntektMinor : upper) - lower;
    tax += (portion * BigInt(TRINNSKATT_2025[i]!.ratePer1000)) / 1000n;
  }
  return tax;
}

/** Marginal trinnskatt-sats (promille) på neste krone ved gitt personinntekt. */
export function marginalTrinnskattPer1000(personinntektMinor: bigint): number {
  let rate = 0;
  for (const b of TRINNSKATT_2025) {
    if (personinntektMinor > b.fromMinor) rate = b.ratePer1000;
  }
  return rate;
}
