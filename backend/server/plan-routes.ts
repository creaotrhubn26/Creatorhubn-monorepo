/**
 * plan-routes.ts
 *
 * Endepunkter som UI bruker for å vise plan-state:
 *
 *   GET  /api/leadgrid/plan/summary?orgId=...
 *        → { plan, limits, usage, pct } for PlanUsageBar
 *
 *   GET  /api/leadgrid/plan/limits
 *        → liste over alle planer (for pricing-page)
 *
 *   POST /api/leadgrid/plan/upgrade
 *        → start Stripe Checkout for å oppgradere
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { getPlanSummary } from "./plan-limits-service.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

function getSession(req: Request, sessions: Map<string, SessionData>): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return sessions.get(auth.substring(7)) ?? null;
  const token = (req as any).cookies?.sessionToken;
  return token ? sessions.get(token) ?? null : null;
}

export function registerPlanRoutes({ app, pool, activeSessions }: Deps): void {

  // ---------- Liste planer (offentlig, brukes av /leadgrid og pricing-side)
  app.get("/api/leadgrid/plan/limits", async (_req, res) => {
    const r = await pool.query(
      `SELECT plan_key, display_name, price_monthly_nok,
              max_active_customers, max_auto_onboards_per_month,
              max_playbooks_visible, max_team_members,
              has_automation_rules, has_custom_fields,
              has_pitch_deck_studio, has_white_label_portal,
              has_salgshierarki, audit_log_retention_days
         FROM plan_limits
        WHERE is_active = TRUE
        ORDER BY display_order ASC`,
    );
    res.json({ plans: r.rows });
  });

  // ---------- Plan-summary for innlogget bruker
  app.get("/api/leadgrid/plan/summary", async (req, res) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "Ikke innlogget" });
    const orgId = (req.query.orgId as string) ?? null;
    if (!orgId) return res.status(400).json({ error: "orgId påkrevd" });
    // Bekreft at brukeren faktisk er medlem av org'en (eller super_admin)
    const memberCheck = await pool.query(
      `SELECT 1 FROM organization_members
       WHERE organization_id = $1 AND user_id = $2
       UNION SELECT 1 FROM users WHERE id = $2 AND role = 'super_admin'`,
      [orgId, session.userId],
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: "Ikke medlem av org'en" });
    }
    try {
      const summary = await getPlanSummary(pool, orgId);
      res.json(summary);
    } catch (e) {
      console.error("[plan-summary]", e);
      res.status(500).json({ error: "Kunne ikke hente plan-summary" });
    }
  });
}
