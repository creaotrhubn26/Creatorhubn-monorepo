/**
 * Server-side researchVersion + history persistence (item #15 proper-fix).
 *
 * Replaces the per-browser localStorage counter with a Postgres-backed
 * monotonically-increasing version per project, shared across browsers
 * and team members. Also gives us the substrate for proper cross-version
 * diff (item #9 proper-fix) — UI can ask "diff v3 vs v5" instead of
 * "diff against whatever this browser saw last".
 *
 * Insert is best-effort: if the role_room_research_versions table doesn't
 * exist (migration not yet run) or DB hiccups, we log and return
 * { versionNumber: null } so the bootstrap response still ships. The
 * frontend gracefully degrades to the localStorage-based v-counter that
 * was in place before this migration.
 */

import type { Pool } from "pg";

export interface PersistedResearchVersion {
  versionNumber: number;
  generatedAt: string;
}

/** Persists the bootstrap result + assigns a project-scoped version
 *  number. Retries up to 3 times if a UNIQUE(project_id, version_number)
 *  collision happens — that means two requests landed at the same MAX
 *  and one needs to bump. */
export async function persistResearchVersion(
  pool: Pool,
  params: {
    projectId: string;
    researchId: string;
    generatedBy: string | null;
    serializedResult: unknown;
    serviceLatencies: unknown;
    fallbacksUsed: string[];
    totalMs: number | null;
    provider: string | null;
    model: string | null;
  },
): Promise<PersistedResearchVersion | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const nextVersionResult = await pool.query<{ next_version: number }>(
        `SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
           FROM role_room_research_versions
          WHERE project_id = $1`,
        [params.projectId],
      );
      const nextVersion = Number(nextVersionResult.rows[0]?.next_version ?? 1);
      const inserted = await pool.query<{ generated_at: Date }>(
        `INSERT INTO role_room_research_versions (
           project_id, research_id, version_number, generated_by,
           serialized_result, service_latencies, fallbacks_used, total_ms,
           provider, model
         ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10)
         RETURNING generated_at`,
        [
          params.projectId,
          params.researchId,
          nextVersion,
          params.generatedBy,
          JSON.stringify(params.serializedResult),
          params.serviceLatencies ? JSON.stringify(params.serviceLatencies) : null,
          params.fallbacksUsed,
          params.totalMs,
          params.provider,
          params.model,
        ],
      );
      return {
        versionNumber: nextVersion,
        generatedAt: inserted.rows[0]?.generated_at?.toISOString() ?? new Date().toISOString(),
      };
    } catch (error) {
      const code = (error as { code?: string }).code;
      // 23505 = unique_violation — likely race on (project_id, version_number).
      // Retry; the next MAX+1 calculation will give us a fresh number.
      if (code === "23505" && attempt < 2) {
        continue;
      }
      console.error("[role-room-research-versions] persist failed", {
        projectId: params.projectId,
        researchId: params.researchId,
        attempt,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
  return null;
}

/** Fetches the version metadata for a specific researchId. Used by
 *  /research/version-info?researchId=... so the frontend can show
 *  "v3 of 5" without re-generating. */
export async function lookupResearchVersion(
  pool: Pool,
  researchId: string,
): Promise<{
  projectId: string;
  versionNumber: number;
  totalVersions: number;
  generatedAt: string;
  generatedBy: string | null;
} | null> {
  try {
    const row = await pool.query<{
      project_id: string;
      version_number: number;
      generated_at: Date;
      generated_by: string | null;
    }>(
      `SELECT project_id, version_number, generated_at, generated_by
         FROM role_room_research_versions
        WHERE research_id = $1
        LIMIT 1`,
      [researchId],
    );
    if (!row.rows[0]) return null;
    const totals = await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM role_room_research_versions WHERE project_id = $1`,
      [row.rows[0].project_id],
    );
    return {
      projectId: row.rows[0].project_id,
      versionNumber: row.rows[0].version_number,
      totalVersions: Number(totals.rows[0]?.count ?? 1),
      generatedAt: row.rows[0].generated_at.toISOString(),
      generatedBy: row.rows[0].generated_by,
    };
  } catch {
    return null;
  }
}

/** Fetches the previous version's serialized result for material-change
 *  detection (item #61). Returns null if no prior version exists.
 *  Excludes the current researchId so we compare against the genuinely
 *  preceding run, not the one we just inserted. */
export async function loadPreviousResearchResult(
  pool: Pool,
  projectId: string,
  excludeResearchId: string,
): Promise<unknown | null> {
  try {
    const row = await pool.query<{ serialized_result: unknown; generated_at: Date }>(
      `SELECT serialized_result, generated_at
         FROM role_room_research_versions
        WHERE project_id = $1
          AND research_id != $2
        ORDER BY generated_at DESC
        LIMIT 1`,
      [projectId, excludeResearchId],
    );
    return row.rows[0]?.serialized_result ?? null;
  } catch {
    return null;
  }
}

/** Lists all versions for a project — used by the version picker /
 *  cross-version diff UI. Newest first. */
export async function listResearchVersions(
  pool: Pool,
  projectId: string,
  limit = 50,
): Promise<Array<{
  researchId: string;
  versionNumber: number;
  generatedAt: string;
  generatedBy: string | null;
  totalMs: number | null;
  provider: string | null;
  model: string | null;
}>> {
  try {
    const rows = await pool.query<{
      research_id: string;
      version_number: number;
      generated_at: Date;
      generated_by: string | null;
      total_ms: number | null;
      provider: string | null;
      model: string | null;
    }>(
      `SELECT research_id, version_number, generated_at, generated_by, total_ms, provider, model
         FROM role_room_research_versions
        WHERE project_id = $1
        ORDER BY version_number DESC
        LIMIT $2`,
      [projectId, limit],
    );
    return rows.rows.map((r) => ({
      researchId: r.research_id,
      versionNumber: r.version_number,
      generatedAt: r.generated_at.toISOString(),
      generatedBy: r.generated_by,
      totalMs: r.total_ms,
      provider: r.provider,
      model: r.model,
    }));
  } catch {
    return [];
  }
}
