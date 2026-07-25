/**
 * SAF-T Financial 1.40 grupperingskategori for en konto. 1.40 erstattet
 * StandardAccountID med GroupingCategory + GroupingCode, som kobler hver konto
 * til Skatteetatens næringsspesifikasjon-kodeliste (standard resultat-/balansepost).
 *
 * Vår kontoplan er NS 4102-basert; de fleste kontonumre finnes direkte i
 * kodelisten. For konti uten eksakt treff velges nærmeste lavere standardkode med
 * samme ledende siffer (samme post-gruppe), med et siste fallback per kontoklasse.
 */
import { GROUPING_BY_CODE } from './grouping-data.js';

const CODES = Object.keys(GROUPING_BY_CODE).sort();

/** Siste utvei per kontoklasse (ledende siffer) når ingen standardkode passer. */
const CLASS_FALLBACK: Record<string, string> = {
  '1': 'balanseverdiForOmloepsmiddel',
  '2': 'kortsiktigGjeld',
  '3': 'salgsinntekt',
  '4': 'varekostnad',
  '5': 'loennskostnad',
  '6': 'annenDriftskostnad',
  '7': 'annenDriftskostnad',
  '8': 'finanskostnad',
};

export function groupingFor(accountNumber: string): { category: string; code: string } {
  const exact = GROUPING_BY_CODE[accountNumber];
  if (exact) return { category: exact, code: accountNumber };
  // Nærmeste lavere standardkode med samme ledende siffer (samme kontogruppe).
  let best: string | null = null;
  for (const c of CODES) {
    if (c[0] === accountNumber[0] && c <= accountNumber && (!best || c > best)) best = c;
  }
  if (best) return { category: GROUPING_BY_CODE[best]!, code: best };
  return { category: CLASS_FALLBACK[accountNumber[0] ?? ''] ?? 'annenDriftskostnad', code: accountNumber };
}
