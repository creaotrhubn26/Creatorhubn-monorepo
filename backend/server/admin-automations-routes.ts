// Admin automations routes.
//
// Backes med ekte data fra automations- + automation_runs-tabellene
// (migrasjon 245_automations.sql). Driver AdminDashboard "Lab" →
// automations-fanen.
//
// Defensiv: hvis migrasjonen ikke er kjørt enda returneres tomme
// kollektoner + console.warn — ikke 500 — slik at UI ikke krasjer.

import express from "express";
import type { Pool } from "pg";

export interface AdminAutomationsRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => { userId: string; email: string; name: string; role: string } | null;
}

// Cache table-existence-check pr. boot. `to_regclass` returnerer null hvis
// tabellen mangler — gir oss en rask ja/nei uten å rotere
// information_schema flere ganger pr. request.
async function automationsTableExists(pool: Pool): Promise<boolean> {
  try {
    const r = await pool.query<{ reg: string | null }>(
      `SELECT to_regclass('public.automations') AS reg`,
    );
    return r.rows[0]?.reg !== null && r.rows[0]?.reg !== undefined;
  } catch {
    return false;
  }
}

async function automationRunsTableExists(pool: Pool): Promise<boolean> {
  try {
    const r = await pool.query<{ reg: string | null }>(
      `SELECT to_regclass('public.automation_runs') AS reg`,
    );
    return r.rows[0]?.reg !== null && r.rows[0]?.reg !== undefined;
  } catch {
    return false;
  }
}

function safeLimit(input: unknown, def: number, max: number): number {
  const n = Number(input);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(Math.floor(n), max);
}

function parseBoolFlag(input: unknown): boolean | null {
  if (typeof input !== "string") return null;
  const v = input.trim().toLowerCase();
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return null;
}

interface AutomationRow {
  id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  trigger_config: unknown;
  action_type: string;
  action_config: unknown;
  is_enabled: boolean;
  last_run_at: Date | null;
  last_run_status: string | null;
  total_runs: number;
  successful_runs: number;
  created_at: Date;
  updated_at: Date;
}

function rowToAutomation(r: AutomationRow) {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    triggerType: r.trigger_type,
    triggerConfig: r.trigger_config ?? {},
    actionType: r.action_type,
    actionConfig: r.action_config ?? {},
    isEnabled: r.is_enabled,
    lastRunAt: r.last_run_at,
    lastRunStatus: r.last_run_status,
    totalRuns: Number(r.total_runs ?? 0),
    successfulRuns: Number(r.successful_runs ?? 0),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function setupAdminAutomationsRoutes(
  deps: AdminAutomationsRoutesDeps,
): void {
  const { app, pool, requireAdminSession } = deps;

  // ─── List ─────────────────────────────────────────────────
  // GET /api/admin/automations?enabled=true
  app.get("/api/admin/automations", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      if (!(await automationsTableExists(pool))) {
        console.warn(
          "[admin-automations] automations table missing — returning empty list. " +
            "Run migration 245_automations.sql.",
        );
        return res.json({ automations: [], total: 0 });
      }

      const enabledFilter = parseBoolFlag(req.query.enabled);
      const params: unknown[] = [];
      let where = "";
      if (enabledFilter !== null) {
        params.push(enabledFilter);
        where = `WHERE is_enabled = $${params.length}`;
      }

      const result = await pool.query<AutomationRow>(
        `SELECT id, name, description, trigger_type, trigger_config,
                action_type, action_config, is_enabled,
                last_run_at, last_run_status,
                total_runs, successful_runs,
                created_at, updated_at
           FROM automations
           ${where}
           ORDER BY created_at DESC`,
        params,
      );

      res.json({
        automations: result.rows.map(rowToAutomation),
        total: result.rows.length,
      });
    } catch (err) {
      console.error("[admin-automations] list failed:", err);
      res.status(500).json({ error: "automations_list_failed" });
    }
  });

  // ─── Stats ────────────────────────────────────────────────
  // GET /api/admin/automation-stats
  //  → { totalRuns, successRate, last24h: { runs, failed }, byTriggerType }
  app.get("/api/admin/automation-stats", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const automationsExists = await automationsTableExists(pool);
      const runsExists = await automationRunsTableExists(pool);

      if (!automationsExists) {
        console.warn(
          "[admin-automations] automations table missing — returning zero stats.",
        );
        return res.json({
          totalRuns: 0,
          successRate: 100,
          last24h: { runs: 0, failed: 0 },
          byTriggerType: [],
        });
      }

      // Aggreger totals fra automations-counters (rask, idempotent).
      const totalsRes = await pool.query<{
        total_runs: string | null;
        successful_runs: string | null;
      }>(
        `SELECT COALESCE(SUM(total_runs), 0)::text AS total_runs,
                COALESCE(SUM(successful_runs), 0)::text AS successful_runs
           FROM automations`,
      );
      const totalRuns = Number(totalsRes.rows[0]?.total_runs ?? 0);
      const successfulRuns = Number(
        totalsRes.rows[0]?.successful_runs ?? 0,
      );
      const successRate =
        totalRuns > 0
          ? Math.round((successfulRuns / totalRuns) * 10000) / 100
          : 100;

      // last24h fra automation_runs hvis tabellen finnes.
      let last24hRuns = 0;
      let last24hFailed = 0;
      if (runsExists) {
        const last24hRes = await pool.query<{
          total: string | null;
          failed: string | null;
        }>(
          `SELECT COUNT(*)::text AS total,
                  COUNT(*) FILTER (WHERE status = 'failed')::text AS failed
             FROM automation_runs
             WHERE started_at >= now() - interval '24 hours'`,
        );
        last24hRuns = Number(last24hRes.rows[0]?.total ?? 0);
        last24hFailed = Number(last24hRes.rows[0]?.failed ?? 0);
      }

      const byTriggerRes = await pool.query<{
        trigger_type: string;
        count: string;
      }>(
        `SELECT trigger_type, COUNT(*)::text AS count
           FROM automations
           GROUP BY trigger_type
           ORDER BY trigger_type`,
      );

      res.json({
        totalRuns,
        successRate,
        last24h: { runs: last24hRuns, failed: last24hFailed },
        byTriggerType: byTriggerRes.rows.map((r) => ({
          triggerType: r.trigger_type,
          count: Number(r.count),
        })),
      });
    } catch (err) {
      console.error("[admin-automations] stats failed:", err);
      res.status(500).json({ error: "automation_stats_failed" });
    }
  });

  // ─── Toggle ───────────────────────────────────────────────
  // PATCH /api/admin/automations/:id/toggle  body: { enabled }
  app.patch("/api/admin/automations/:id/toggle", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      if (!(await automationsTableExists(pool))) {
        return res.status(503).json({ error: "automations_table_missing" });
      }

      const { id } = req.params;
      const enabled = Boolean(req.body?.enabled);

      const result = await pool.query<{ id: string; is_enabled: boolean }>(
        `UPDATE automations
            SET is_enabled = $1,
                updated_at = now()
          WHERE id = $2
        RETURNING id, is_enabled`,
        [enabled, id],
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "automation_not_found" });
      }

      res.json({
        success: true,
        id: result.rows[0].id,
        enabled: result.rows[0].is_enabled,
      });
    } catch (err) {
      console.error("[admin-automations] toggle failed:", err);
      res.status(500).json({ error: "automation_toggle_failed" });
    }
  });

  // ─── Manual run ───────────────────────────────────────────
  // POST /api/admin/automations/:id/run
  // For nå: insert i automation_runs (status='running') og bump
  // total_runs. Ekte execution kommer i en senere PR.
  app.post("/api/admin/automations/:id/run", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      if (
        !(await automationsTableExists(pool)) ||
        !(await automationRunsTableExists(pool))
      ) {
        return res.status(503).json({ error: "automations_table_missing" });
      }

      const { id } = req.params;

      const exists = await pool.query<{ id: string }>(
        `SELECT id FROM automations WHERE id = $1`,
        [id],
      );
      if (exists.rowCount === 0) {
        return res.status(404).json({ error: "automation_not_found" });
      }

      const run = await pool.query<{ id: string }>(
        `INSERT INTO automation_runs (automation_id, status)
              VALUES ($1, 'running')
           RETURNING id`,
        [id],
      );

      // Bump counters + last_run-felter slik at stats reflekterer at vi
      // har trigget noe. Ekte execution oppdaterer status etterpå.
      await pool.query(
        `UPDATE automations
            SET total_runs = total_runs + 1,
                last_run_at = now(),
                last_run_status = 'running',
                updated_at = now()
          WHERE id = $1`,
        [id],
      );

      res.json({ success: true, runId: run.rows[0].id });
    } catch (err) {
      console.error("[admin-automations] run failed:", err);
      res.status(500).json({ error: "automation_run_failed" });
    }
  });

  // ─── Runs for én automation (bonus) ───────────────────────
  // GET /api/admin/automations/:id/runs?limit=20
  app.get("/api/admin/automations/:id/runs", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      if (!(await automationRunsTableExists(pool))) {
        return res.json({ runs: [], total: 0 });
      }

      const { id } = req.params;
      const limit = safeLimit(req.query.limit, 20, 200);

      const result = await pool.query<{
        id: string;
        automation_id: string;
        started_at: Date;
        finished_at: Date | null;
        status: string;
        output: unknown;
        error_message: string | null;
        duration_ms: number | null;
      }>(
        `SELECT id, automation_id, started_at, finished_at,
                status, output, error_message, duration_ms
           FROM automation_runs
           WHERE automation_id = $1
           ORDER BY started_at DESC
           LIMIT $2`,
        [id, limit],
      );

      res.json({
        runs: result.rows.map((r) => ({
          id: r.id,
          automationId: r.automation_id,
          startedAt: r.started_at,
          finishedAt: r.finished_at,
          status: r.status,
          output: r.output,
          errorMessage: r.error_message,
          durationMs: r.duration_ms,
        })),
        total: result.rows.length,
      });
    } catch (err) {
      console.error("[admin-automations] runs failed:", err);
      res.status(500).json({ error: "automation_runs_failed" });
    }
  });
}
