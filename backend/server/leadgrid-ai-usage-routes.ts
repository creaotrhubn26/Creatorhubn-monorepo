/**
 * leadgrid-ai-usage-routes.ts
 *
 * Eksponerer per-org AI-bruksstats:
 *   GET /api/leadgrid/ai-usage/summary   — aggregat per provider
 *   GET /api/leadgrid/ai-usage/history   — daglig tidsserie
 *
 * Gated på billing.view_ai_usage (mig 321) — admin + salgssjef default.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

function getSession(req: Request, activeSessions: Map<string, SessionData>) {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const s = activeSessions.get(auth.slice(7));
    if (s) return s;
  }
  return null;
}

async function resolveOrgIdSmart(
  req: Request,
  pool: Pool,
  userId: string,
): Promise<string | null> {
  const explicit = req.query?.organization_id;
  if (typeof explicit === "string" && explicit.length > 0) return explicit;
  const r = await pool.query<{ organization_id: string }>(
    `SELECT organization_id::text FROM organization_members
      WHERE user_id = $1 ORDER BY joined_at ASC LIMIT 1`,
    [userId],
  );
  return r.rows[0]?.organization_id ?? null;
}

export function registerLeadgridAIUsageRoutes(deps: Deps): void {
  const { app, pool, activeSessions } = deps;
  const perm = requireLeadMapPermission("billing.view_ai_usage", {
    pool, activeSessions, resolveOrgId: resolveOrgIdSmart,
  });

  // GET /api/leadgrid/ai-usage/summary?sinceDays=30
  app.get("/api/leadgrid/ai-usage/summary", perm, async (req: Request, res: Response) => {
    const session = getSession(req, activeSessions);
    if (!session) { res.status(401).json({ error: "Innlogging kreves" }); return; }
    const orgId = await resolveOrgIdSmart(req, pool, session.userId);
    if (!orgId) { res.status(400).json({ error: "mangler_organization_id" }); return; }
    const sinceDays = Math.min(365, Math.max(1, parseInt(String(req.query.sinceDays ?? "30"), 10)));
    try {
      const summary = await pool.query(
        `SELECT provider,
                SUM(total_calls)::int AS total_calls,
                SUM(total_input_tokens)::bigint AS total_input_tokens,
                SUM(total_output_tokens)::bigint AS total_output_tokens,
                SUM(total_audio_seconds)::float8 AS total_audio_seconds,
                SUM(total_cost_usd)::float8 AS total_cost_usd
           FROM leadgrid_ai_usage_daily
          WHERE organization_id = $1::uuid
            AND usage_date >= CURRENT_DATE - ($2 || ' days')::interval
          GROUP BY provider
          ORDER BY total_cost_usd DESC`,
        [orgId, String(sinceDays)],
      );
      const grand = summary.rows.reduce(
        (acc, r) => ({
          calls: acc.calls + Number(r.total_calls),
          cost: acc.cost + Number(r.total_cost_usd),
        }),
        { calls: 0, cost: 0 },
      );
      res.json({
        organization_id: orgId,
        since_days: sinceDays,
        providers: summary.rows,
        total_calls: grand.calls,
        total_cost_usd: grand.cost,
      });
    } catch (err) {
      res.status(500).json({ error: "summary_failed", detail: String(err) });
    }
  });

  // GET /api/leadgrid/ai-usage/history?days=30 — daglig tidsserie
  app.get("/api/leadgrid/ai-usage/history", perm, async (req: Request, res: Response) => {
    const session = getSession(req, activeSessions);
    if (!session) { res.status(401).json({ error: "Innlogging kreves" }); return; }
    const orgId = await resolveOrgIdSmart(req, pool, session.userId);
    if (!orgId) { res.status(400).json({ error: "mangler_organization_id" }); return; }
    const days = Math.min(180, Math.max(1, parseInt(String(req.query.days ?? "30"), 10)));
    try {
      const r = await pool.query(
        `SELECT usage_date::text AS date, provider,
                total_calls, total_cost_usd::float8 AS cost_usd
           FROM leadgrid_ai_usage_daily
          WHERE organization_id = $1::uuid
            AND usage_date >= CURRENT_DATE - ($2 || ' days')::interval
          ORDER BY usage_date ASC`,
        [orgId, String(days)],
      );
      res.json({ organization_id: orgId, history: r.rows });
    } catch (err) {
      res.status(500).json({ error: "history_failed", detail: String(err) });
    }
  });
}
