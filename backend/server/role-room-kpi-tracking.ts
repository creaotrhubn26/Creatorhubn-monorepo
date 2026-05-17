/**
 * KPI-tracking core (item #176 + #180).
 *
 * Skriver/leser role_room_kpi_snapshots. Tre hovedfunksjoner:
 *   - persistKpiSnapshot: insert (or upsert on same-day) ett datapunkt
 *   - persistKpiSnapshotBatch: bulk-insert flere på én transaksjon
 *   - listKpiSnapshots: hent alle for et plan_id (med valgfri filter)
 *   - summarizeKpis: per-metric latest + delta-vs-previous-day
 *
 * Connectorer (Meta/TikTok/LinkedIn) er separate moduler som bruker
 * persistKpiSnapshotBatch til å skrive resultatet sitt.
 */

import type { Pool } from "pg";

export type KpiSource = "meta_graph" | "tiktok_business" | "linkedin_pages" | "manual";
export type KpiPlatform = "instagram" | "facebook" | "linkedin" | "tiktok" | "youtube" | "manual";

export interface KpiSnapshotInput {
  postId: string;
  planId: string;
  platform: KpiPlatform;
  metric: string;
  value: number;
  capturedAt?: Date;
  source?: KpiSource;
}

export interface PersistedKpiSnapshot {
  id: string;
  postId: string;
  planId: string;
  platform: KpiPlatform;
  metric: string;
  value: number;
  capturedAt: string;
  source: KpiSource;
  createdAt: string;
}

/** Skriver én snapshot. Bruker UPSERT på (post_id, platform, metric,
 *  captured_at) slik at flere connector-runs samme dag overskriver i
 *  stedet for å lage duplikater. */
export async function persistKpiSnapshot(
  pool: Pool,
  input: KpiSnapshotInput,
): Promise<PersistedKpiSnapshot | null> {
  try {
    const captured = input.capturedAt ?? new Date();
    const r = await pool.query<{
      id: string;
      post_id: string;
      plan_id: string;
      platform: string;
      metric: string;
      value: number;
      captured_at: Date;
      source: string;
      created_at: Date;
    }>(
      `INSERT INTO role_room_kpi_snapshots
         (post_id, plan_id, platform, metric, value, captured_at, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (post_id, platform, metric, captured_at)
       DO UPDATE SET value = EXCLUDED.value, source = EXCLUDED.source
       RETURNING id, post_id, plan_id, platform, metric, value, captured_at, source, created_at`,
      [input.postId, input.planId, input.platform, input.metric, input.value, captured, input.source ?? "manual"],
    );
    if (!r.rows[0]) return null;
    return mapRow(r.rows[0]);
  } catch (error) {
    console.error("[role-room-kpi-tracking] persist failed", {
      postId: input.postId,
      metric: input.metric,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/** Bulk-write — én transaksjon. Returnerer antall skrevet. */
export async function persistKpiSnapshotBatch(
  pool: Pool,
  inputs: KpiSnapshotInput[],
): Promise<{ written: number; failed: number }> {
  if (inputs.length === 0) return { written: 0, failed: 0 };
  const client = await pool.connect();
  let written = 0;
  let failed = 0;
  try {
    await client.query("BEGIN");
    for (const input of inputs) {
      try {
        await client.query(
          `INSERT INTO role_room_kpi_snapshots
             (post_id, plan_id, platform, metric, value, captured_at, source)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (post_id, platform, metric, captured_at)
           DO UPDATE SET value = EXCLUDED.value, source = EXCLUDED.source`,
          [input.postId, input.planId, input.platform, input.metric, input.value, input.capturedAt ?? new Date(), input.source ?? "manual"],
        );
        written++;
      } catch {
        failed++;
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[role-room-kpi-tracking] batch failed", error);
    return { written: 0, failed: inputs.length };
  } finally {
    client.release();
  }
  return { written, failed };
}

/** Henter alle snapshots for en plan. Valgfri filter på platform/metric. */
export async function listKpiSnapshots(
  pool: Pool,
  planId: string,
  filter?: { platform?: string; metric?: string; sinceDays?: number },
): Promise<PersistedKpiSnapshot[]> {
  try {
    const params: unknown[] = [planId];
    const conditions: string[] = ["plan_id = $1"];
    if (filter?.platform) {
      conditions.push(`platform = $${params.length + 1}`);
      params.push(filter.platform);
    }
    if (filter?.metric) {
      conditions.push(`metric = $${params.length + 1}`);
      params.push(filter.metric);
    }
    if (filter?.sinceDays && filter.sinceDays > 0) {
      conditions.push(`captured_at >= now() - ($${params.length + 1} || ' days')::interval`);
      params.push(String(filter.sinceDays));
    }
    const r = await pool.query<{
      id: string; post_id: string; plan_id: string; platform: string; metric: string;
      value: number; captured_at: Date; source: string; created_at: Date;
    }>(
      `SELECT id, post_id, plan_id, platform, metric, value, captured_at, source, created_at
         FROM role_room_kpi_snapshots
        WHERE ${conditions.join(" AND ")}
        ORDER BY captured_at DESC`,
      params,
    );
    return r.rows.map(mapRow);
  } catch (error) {
    console.error("[role-room-kpi-tracking] list failed", { planId, error });
    return [];
  }
}

/** Returns "siste verdi + delta vs forrige dag" per metric per platform. */
export interface KpiMetricSummary {
  platform: string;
  metric: string;
  latestValue: number;
  latestCapturedAt: string;
  previousValue: number | null;
  deltaPct: number | null;     // (latest - prev) / prev * 100, null hvis ingen prev
  samplePoints: number;
}

export async function summarizeKpis(
  pool: Pool,
  planId: string,
  sinceDays = 30,
): Promise<KpiMetricSummary[]> {
  const snapshots = await listKpiSnapshots(pool, planId, { sinceDays });
  if (snapshots.length === 0) return [];

  // Grupper på (platform, metric); innen hver gruppe sortert nyest først.
  const groups = new Map<string, PersistedKpiSnapshot[]>();
  for (const snap of snapshots) {
    const key = `${snap.platform}|${snap.metric}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(snap);
  }

  const out: KpiMetricSummary[] = [];
  for (const [, list] of groups) {
    if (list.length === 0) continue;
    const latest = list[0];
    const previous = list[1] ?? null;
    const deltaPct = previous && previous.value !== 0
      ? ((latest.value - previous.value) / Math.abs(previous.value)) * 100
      : null;
    out.push({
      platform: latest.platform,
      metric: latest.metric,
      latestValue: latest.value,
      latestCapturedAt: latest.capturedAt,
      previousValue: previous?.value ?? null,
      deltaPct: deltaPct !== null ? Math.round(deltaPct * 10) / 10 : null,
      samplePoints: list.length,
    });
  }
  return out;
}

function mapRow(row: {
  id: string; post_id: string; plan_id: string; platform: string; metric: string;
  value: number; captured_at: Date; source: string; created_at: Date;
}): PersistedKpiSnapshot {
  return {
    id: String(row.id),
    postId: String(row.post_id),
    planId: String(row.plan_id),
    platform: row.platform as KpiPlatform,
    metric: row.metric,
    value: Number(row.value),
    capturedAt: row.captured_at.toISOString(),
    source: row.source as KpiSource,
    createdAt: row.created_at.toISOString(),
  };
}
