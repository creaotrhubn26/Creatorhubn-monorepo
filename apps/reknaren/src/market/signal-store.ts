import type { Db } from '../db/pool.js';

export interface MarketSignal {
  source: string;
  kind: string;
  signalKey: string;
  value: string;      // NUMERIC leses/skrives som string for eksakthet
  unit: string;
  period: string;
  publishedAt?: string | undefined;
  url?: string | undefined;
  raw?: unknown;
}

export async function upsertSignal(db: Db, s: MarketSignal): Promise<void> {
  await db.query(
    `INSERT INTO market_signals (source, kind, signal_key, value_num, unit, period, published_at, url, raw)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (source, kind, signal_key, period)
     DO UPDATE SET value_num = EXCLUDED.value_num, unit = EXCLUDED.unit,
                   published_at = EXCLUDED.published_at, url = EXCLUDED.url,
                   raw = EXCLUDED.raw, observed_at = now()`,
    [s.source, s.kind, s.signalKey, s.value, s.unit, s.period,
     s.publishedAt ?? null, s.url ?? null, s.raw != null ? JSON.stringify(s.raw) : null],
  );
}

function rowToSignal(r: Record<string, unknown>): MarketSignal {
  return {
    source: r.source as string, kind: r.kind as string, signalKey: r.signal_key as string,
    value: String(r.value_num), unit: r.unit as string, period: r.period as string,
    publishedAt: (r.published_at as string) ?? undefined, url: (r.url as string) ?? undefined,
    raw: r.raw ?? undefined,
  };
}

async function nthSignal(db: Db, kind: string, signalKey: string, offset: number): Promise<MarketSignal | null> {
  // (kind, signal_key) mapper til nøyaktig én kilde i vår data, så ingen source-filter trengs.
  const r = await db.query(
    `SELECT * FROM market_signals WHERE kind=$1 AND signal_key=$2
     ORDER BY period DESC LIMIT 1 OFFSET $3`,
    [kind, signalKey, offset],
  );
  return r.rows[0] ? rowToSignal(r.rows[0]) : null;
}

export const latestSignal = (db: Db, kind: string, signalKey: string) => nthSignal(db, kind, signalKey, 0);
export const previousSignal = (db: Db, kind: string, signalKey: string) => nthSignal(db, kind, signalKey, 1);
