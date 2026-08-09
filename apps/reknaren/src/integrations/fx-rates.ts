/**
 * Valutakurs fra Norges Bank (åpne data, ingen nøkkel). Henter dagskursen (spot)
 * for en valuta på en gitt dato; faller tilbake til nærmeste tidligere kurs
 * (helg/helligdag har ingen notering). Noen valutaer noteres per 100 enheter
 * (UNIT_MULT), som normaliseres til NOK per 1 enhet. Port + injiserbar fetch/stub.
 *
 * API: GET https://data.norges-bank.no/api/data/EXR/B.{CUR}.NOK.SP
 */
export interface FxRate {
  currency: string;
  rateDecimal: string; // NOK per 1 enhet av valutaen
  forDate: string; // datoen kursen faktisk gjelder (kan være før forespurt dato)
  source: string;
}

export interface FxRateSource {
  rate(currency: string, isoDate: string): Promise<FxRate | null>;
}

type FetchLike = (url: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<{
  status: number;
  ok: boolean;
  json(): Promise<unknown>;
}>;

const BASE = 'https://data.norges-bank.no/api/data/EXR';

/** Flytter desimalpunktet n plasser til venstre (deler på 10^n) — eksakt, uten flyttall. */
export function shiftDecimalLeft(dec: string, n: number): string {
  if (n <= 0) return dec;
  const neg = dec.startsWith('-');
  let s = neg ? dec.slice(1) : dec;
  const dot = s.indexOf('.');
  let intPart = dot === -1 ? s : s.slice(0, dot);
  let frac = dot === -1 ? '' : s.slice(dot + 1);
  for (let i = 0; i < n; i++) {
    if (intPart.length === 0) intPart = '0';
    frac = intPart.slice(-1) + frac;
    intPart = intPart.slice(0, -1);
  }
  if (intPart === '') intPart = '0';
  const out = frac ? `${intPart}.${frac}` : intPart;
  return neg ? `-${out}` : out;
}

export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export class NorgesBankFxRates implements FxRateSource {
  readonly hasApiKey = false;
  constructor(
    private readonly fetchImpl: FetchLike = fetch as unknown as FetchLike,
    private readonly timeoutMs = 8000,
  ) {}

  async rate(currency: string, isoDate: string): Promise<FxRate | null> {
    const cur = currency.toUpperCase();
    if (cur === 'NOK' || !/^[A-Z]{3}$/.test(cur)) return null;
    const from = addDaysIso(isoDate, -10); // dekk helg/helligdager
    const url = `${BASE}/B.${cur}.NOK.SP?format=sdmx-json&startPeriod=${from}&endPeriod=${isoDate}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(url, { signal: controller.signal, headers: { accept: 'application/json' } });
      if (res.status === 404) return null;
      if (!res.ok) return null;
      const body = (await res.json()) as any;
      const struct = body?.data?.structure;
      const dataset = body?.data?.dataSets?.[0];
      if (!struct || !dataset?.series) return null;

      const seriesAttrs: { id: string; values: { id: string }[] }[] = struct.attributes?.series ?? [];
      const umPos = seriesAttrs.findIndex((a) => a.id === 'UNIT_MULT');
      const obsDates: { id: string }[] = struct.dimensions?.observation?.[0]?.values ?? [];

      const seriesKey = Object.keys(dataset.series)[0];
      if (!seriesKey) return null;
      const series = dataset.series[seriesKey];
      const unitMult = umPos >= 0 ? Number(seriesAttrs[umPos]!.values[series.attributes[umPos]]?.id ?? '0') : 0;

      // Velg observasjonen med nyeste dato (≤ forespurt dato pga. endPeriod).
      let bestIdx = -1;
      let bestDate = '';
      for (const idx of Object.keys(series.observations ?? {})) {
        const date = obsDates[Number(idx)]?.id ?? '';
        if (date >= bestDate) {
          bestDate = date;
          bestIdx = Number(idx);
        }
      }
      if (bestIdx < 0) return null;
      const raw = String(series.observations[String(bestIdx)]?.[0] ?? '');
      if (!/^\d+(\.\d+)?$/.test(raw)) return null;

      return {
        currency: cur,
        rateDecimal: shiftDecimalLeft(raw, unitMult),
        forDate: bestDate || isoDate,
        source: `Norges Bank (${bestDate || isoDate})`,
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Test-/sandboxstub. */
export class StaticFxRateStub implements FxRateSource {
  readonly hasApiKey = false;
  constructor(private readonly rates: Record<string, string>) {}
  async rate(currency: string, isoDate: string): Promise<FxRate | null> {
    const r = this.rates[currency.toUpperCase()];
    return r ? { currency: currency.toUpperCase(), rateDecimal: r, forDate: isoDate, source: 'stub' } : null;
  }
}
