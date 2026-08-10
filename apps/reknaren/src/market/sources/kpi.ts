export interface KpiObservation {
  value: string;
  period: string;
  source: string;
}

export interface KpiSource {
  latest(): Promise<KpiObservation | null>;
}

type FetchLike = (
  url: string,
  init?: {
    method?: string;
    body?: string;
    signal?: AbortSignal;
    headers?: Record<string, string>;
  }
) => Promise<{
  status: number;
  ok: boolean;
  json(): Promise<unknown>;
}>;

// Tabell 03013: KPI etter måned. Bruker Tolvmanedersendring (12-mnd endring i prosent).
// Gir månedsdata (YYYYM01 etc), ikke årlig som 03014.
const ENDPOINT = 'https://data.ssb.no/api/v0/no/table/03013/';
const QUERY = {
  query: [
    { code: 'ContentsCode', selection: { filter: 'item', values: ['Tolvmanedersendring'] } },
    { code: 'Konsumgrp', selection: { filter: 'item', values: ['TOTAL'] } },
  ],
  response: { format: 'json-stat2' },
};

/** '2026M07' → '2026-07' */
function normPeriod(p: string): string {
  const m = /^(\d{4})M(\d{2})$/.exec(p);
  return m ? `${m[1]}-${m[2]}` : p;
}

export class SsbKpi implements KpiSource {
  constructor(
    private readonly fetchImpl: FetchLike = fetch as unknown as FetchLike,
    private readonly timeoutMs = 8000
  ) {}

  async latest(): Promise<KpiObservation | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(ENDPOINT, {
        method: 'POST',
        body: JSON.stringify(QUERY),
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
        },
      });
      if (!res.ok) return null;
      const body = (await res.json()) as any;
      const values: number[] = body?.value ?? [];
      const index: Record<string, number> = body?.dimension?.Tid?.category?.index ?? {};
      const periods = Object.keys(index);
      if (!periods.length || !values.length) return null;
      // siste periode = høyeste index
      const lastPeriod = periods.reduce((a, b) => (index[b]! >= index[a]! ? b : a));
      const raw = values[index[lastPeriod]!];
      if (raw == null || Number.isNaN(raw)) return null;
      return {
        value: String(raw),
        period: normPeriod(lastPeriod),
        source: `SSB tabell 03013 (${normPeriod(lastPeriod)})`,
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}

export class StaticKpiStub implements KpiSource {
  constructor(
    private readonly value: string,
    private readonly period: string
  ) {}

  async latest(): Promise<KpiObservation | null> {
    return { value: this.value, period: this.period, source: 'stub' };
  }
}
