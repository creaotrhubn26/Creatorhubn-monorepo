export interface RateObservation {
  value: string;
  period: string;
  source: string;
}

export interface PolicyRateSource {
  latest(): Promise<RateObservation | null>;
}

type FetchLike = (
  url: string,
  init?: { signal?: AbortSignal; headers?: Record<string, string> }
) => Promise<{
  status: number;
  ok: boolean;
  json(): Promise<unknown>;
}>;

const URL =
  'https://data.norges-bank.no/api/data/IR/B.KPRA.SD.?format=sdmx-json&lastNObservations=2';

export class NorgesBankPolicyRate implements PolicyRateSource {
  constructor(
    private readonly fetchImpl: FetchLike = fetch as unknown as FetchLike,
    private readonly timeoutMs = 8000
  ) {}

  async latest(): Promise<RateObservation | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(URL, {
        signal: controller.signal,
        headers: { accept: 'application/json' },
      });
      if (!res.ok) return null;
      const body = (await res.json()) as any;
      const obsDates: { id: string }[] =
        body?.data?.structure?.dimensions?.observation?.[0]?.values ?? [];
      const series = Object.values(body?.data?.dataSets?.[0]?.series ?? {})[0] as any;
      if (!series?.observations) return null;
      let bestIdx = -1,
        bestDate = '';
      for (const idx of Object.keys(series.observations)) {
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
        value: raw,
        period: bestDate,
        source: `Norges Bank (${bestDate})`,
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}

export class StaticPolicyRateStub implements PolicyRateSource {
  constructor(
    private readonly value: string,
    private readonly period: string
  ) {}

  async latest(): Promise<RateObservation | null> {
    return { value: this.value, period: this.period, source: 'stub' };
  }
}
