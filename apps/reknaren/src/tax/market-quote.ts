/**
 * Gratis kurshenting fra Yahoo Finance (uoffisiell chart-API) for børsnoterte tickere,
 * f.eks. «EQNR.OL». Kun aksjer/aksjefond med ticker; fond uten ticker oppdateres manuelt.
 * Serveren henter — aldri klienten. Returnerer pris i minor (øre) + valuta.
 */
export interface Quote { priceMinor: bigint; currency: string; ticker: string }

const YAHOO = 'https://query1.finance.yahoo.com/v8/finance/chart/';

export async function fetchYahooQuote(ticker: string): Promise<Quote> {
  const t = ticker.trim().toUpperCase();
  if (!/^[A-Z0-9.\-]{1,20}$/.test(t)) throw new Error('Ugyldig ticker.');
  const url = `${YAHOO}${encodeURIComponent(t)}?interval=1d&range=1d`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Reknaren/1.0' } });
    if (!res.ok) throw new Error(`Kurshenting feilet (HTTP ${res.status}).`);
    const data = await res.json() as {
      chart?: { result?: { meta?: { regularMarketPrice?: number; currency?: string } }[]; error?: unknown };
    };
    const meta = data.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    if (typeof price !== 'number' || !isFinite(price) || price <= 0) {
      throw new Error(`Fant ingen kurs for ${t}.`);
    }
    // Pris → øre. Rund til nærmeste øre.
    const priceMinor = BigInt(Math.round(price * 100));
    return { priceMinor, currency: meta?.currency ?? 'NOK', ticker: t };
  } finally {
    clearTimeout(timer);
  }
}

/** Markedsverdi (øre) = pris per andel × antall andeler (mikroandeler). */
export function marketValueFromQuote(priceMinor: bigint, unitsMicro: bigint): bigint {
  return (priceMinor * unitsMicro) / 1_000_000n;
}
