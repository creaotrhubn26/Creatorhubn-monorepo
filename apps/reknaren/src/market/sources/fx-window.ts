/**
 * Norges Bank FX 90-dagers vindu → siste kurs + median. Speiler SDMX-parsingen i
 * ../../integrations/fx-rates.ts, men henter hele serien i vinduet i stedet for
 * bare nyeste observasjon. Gjenbruker shiftDecimalLeft + addDaysIso derfra.
 */
import { addDaysIso, shiftDecimalLeft } from '../../integrations/fx-rates.js';

export interface FxWindow { currency: string; latest: string; median: string; period: string }
export interface FxWindowSource { window(currency: string, endIsoDate: string, days: number): Promise<FxWindow | null> }

type FetchLike = (url: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<{
  status: number; ok: boolean; json(): Promise<unknown>;
}>;
const BASE = 'https://data.norges-bank.no/api/data/EXR';

export class NorgesBankFxWindow implements FxWindowSource {
  constructor(private readonly fetchImpl: FetchLike = fetch as unknown as FetchLike, private readonly timeoutMs = 8000) {}
  async window(currency: string, endIsoDate: string, days: number): Promise<FxWindow | null> {
    const cur = currency.toUpperCase();
    if (cur === 'NOK' || !/^[A-Z]{3}$/.test(cur)) return null;
    const from = addDaysIso(endIsoDate, -days);
    const url = `${BASE}/B.${cur}.NOK.SP?format=sdmx-json&startPeriod=${from}&endPeriod=${endIsoDate}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(url, { signal: controller.signal, headers: { accept: 'application/json' } });
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

      const obs: { date: string; value: string }[] = [];
      for (const idx of Object.keys(series.observations ?? {})) {
        const date = obsDates[Number(idx)]?.id ?? '';
        const raw = String(series.observations[idx]?.[0] ?? '');
        if (date && /^\d+(\.\d+)?$/.test(raw)) obs.push({ date, value: shiftDecimalLeft(raw, unitMult) });
      }
      if (!obs.length) return null;
      obs.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      const latestObs = obs[obs.length - 1]!;
      // Median: sorter numerisk, ta midterste (partall → nedre midtre; ingen flyttall-artefakt).
      const byValue = [...obs].sort((a, b) => Number(a.value) - Number(b.value));
      const median = byValue[Math.floor((byValue.length - 1) / 2)]!.value;
      return { currency: cur, latest: latestObs.value, median, period: latestObs.date };
    } catch { return null; } finally { clearTimeout(timer); }
  }
}

export class StaticFxWindowStub implements FxWindowSource {
  constructor(private readonly data: Record<string, { latest: string; median: string; period: string }>) {}
  async window(currency: string): Promise<FxWindow | null> {
    const d = this.data[currency.toUpperCase()];
    return d ? { currency: currency.toUpperCase(), ...d } : null;
  }
}
