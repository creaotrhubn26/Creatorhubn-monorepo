/**
 * leadgrid-ai-usage-routes.ts
 *
 * Eksponerer per-org AI-bruksstats:
 *   GET /api/leadgrid/ai-usage/summary   — aggregat per provider
 *   GET /api/leadgrid/ai-usage/history   — daglig tidsserie
 *
 * Krever eksplisitt workspace-id og workspace-admin/superadmin.
 */

import type { Express, NextFunction, Request, Response } from "express";
import type { Pool } from "pg";
import {
  canManageLeadgridBilling,
  resolveBillingOrganizationId,
} from "./leadgrid-billing-routes.js";

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


export function registerLeadgridAIUsageRoutes(deps: Deps): void {
  const { app, pool, activeSessions } = deps;
  const adminOnly = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const session = getSession(req, activeSessions);
    if (!session) {
      res.status(401).json({ error: "Innlogging kreves" });
      return;
    }
    const resolution = resolveBillingOrganizationId(req);
    if (!resolution.organizationId) {
      res.status(400).json({ error: resolution.error ?? "orgId_påkrevd" });
      return;
    }
    try {
      const allowed = await canManageLeadgridBilling(
        pool,
        session.userId,
        resolution.organizationId,
      );
      if (!allowed) {
        res.status(403).json({ error: "Krever workspace-administrator" });
        return;
      }
      res.locals.leadgridOrganizationId = resolution.organizationId;
      next();
    } catch {
      res.status(500).json({ error: "Kunne ikke kontrollere workspace-tilgang" });
    }
  };

  // GET /api/leadgrid/ai-usage/summary?sinceDays=30
  app.get("/api/leadgrid/ai-usage/summary", adminOnly, async (req: Request, res: Response) => {
    const orgId = String(res.locals.leadgridOrganizationId);
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
      res.status(500).json({ error: "summary_failed", detail: "internal_error" });
    }
  });

  // GET /api/leadgrid/ai-usage/history?days=30 — daglig tidsserie
  app.get("/api/leadgrid/ai-usage/history", adminOnly, async (req: Request, res: Response) => {
    const orgId = String(res.locals.leadgridOrganizationId);
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
      res.status(500).json({ error: "history_failed", detail: "internal_error" });
    }
  });
}
