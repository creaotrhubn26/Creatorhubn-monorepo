/**
 * leadgrid-momentum-routes.ts
 *
 * Momentum Engine — 3 endepunkter (mig 327):
 *   GET  /api/leadgrid/momentum/today  — composite score 0-100 +
 *        breakdown + next-best-actions + trend vs i går.
 *   GET  /api/leadgrid/momentum/goal   — månedsmål for org.
 *   POST /api/leadgrid/momentum/goal   — sett/oppdater månedsmål.
 *
 * Alle gated på `momentum.view` (set_goal på POST).
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";
import {
  getOrCreateGoal,
  setGoal,
  computeTodayMomentum,
  type SalesGoal,
} from "./leadgrid-momentum-service.js";

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
  const explicit =
    (req.query?.organization_id
      ?? (req.body as { organization_id?: string } | undefined)?.organization_id) as
      | string
      | undefined;
  if (typeof explicit === "string" && explicit.length > 0) return explicit;
  const r = await pool.query<{ organization_id: string }>(
    `SELECT organization_id::text FROM organization_members
      WHERE user_id = $1 ORDER BY joined_at ASC LIMIT 1`,
    [userId],
  );
  return r.rows[0]?.organization_id ?? null;
}

export function registerLeadgridMomentumRoutes(deps: Deps): void {
  const { app, pool, activeSessions } = deps;
  const permView = requireLeadMapPermission("momentum.view", {
    pool,
    activeSessions,
    resolveOrgId: resolveOrgIdSmart,
  });
  const permSet = requireLeadMapPermission("momentum.set_goal", {
    pool,
    activeSessions,
    resolveOrgId: resolveOrgIdSmart,
  });

  // GET /api/leadgrid/momentum/today
  app.get("/api/leadgrid/momentum/today", permView, async (req: Request, res: Response) => {
    const session = getSession(req, activeSessions);
    if (!session) {
      res.status(401).json({ error: "Innlogging kreves" });
      return;
    }
    const orgId = await resolveOrgIdSmart(req, pool, session.userId);
    if (!orgId) {
      res.status(400).json({ error: "mangler_organization_id" });
      return;
    }
    try {
      const momentum = await computeTodayMomentum(pool, orgId);
      res.json({ momentum });
    } catch (err) {
      console.error("[momentum/today] feilet", err);
      res.status(500).json({ error: "compute_failed", detail: String(err) });
    }
  });

  // GET /api/leadgrid/momentum/goal
  app.get("/api/leadgrid/momentum/goal", permView, async (req: Request, res: Response) => {
    const session = getSession(req, activeSessions);
    if (!session) {
      res.status(401).json({ error: "Innlogging kreves" });
      return;
    }
    const orgId = await resolveOrgIdSmart(req, pool, session.userId);
    if (!orgId) {
      res.status(400).json({ error: "mangler_organization_id" });
      return;
    }
    try {
      const goal = await getOrCreateGoal(pool, orgId);
      res.json({ goal });
    } catch (err) {
      console.error("[momentum/goal:get] feilet", err);
      res.status(500).json({ error: "fetch_failed", detail: String(err) });
    }
  });

  // POST /api/leadgrid/momentum/goal
  app.post("/api/leadgrid/momentum/goal", permSet, async (req: Request, res: Response) => {
    const session = getSession(req, activeSessions);
    if (!session) {
      res.status(401).json({ error: "Innlogging kreves" });
      return;
    }
    const orgId = await resolveOrgIdSmart(req, pool, session.userId);
    if (!orgId) {
      res.status(400).json({ error: "mangler_organization_id" });
      return;
    }
    try {
      const patch = (req.body ?? {}) as Record<string, unknown> & {
        notes?: string;
      };
      const goalPatch: Partial<SalesGoal> & { notes?: string } = {
        revenueTarget: (patch.revenue_target ?? patch.revenueTarget) as number | null | undefined,
        dealsTarget: (patch.deals_target ?? patch.dealsTarget) as number | null | undefined,
        meetingsTarget: (patch.meetings_target ?? patch.meetingsTarget) as number | null | undefined,
        proposalsTarget: (patch.proposals_target ?? patch.proposalsTarget) as number | null | undefined,
        dailyContactsTarget: (patch.daily_contacts_target ?? patch.dailyContactsTarget) as number | undefined,
        dailyFollowupsTarget: (patch.daily_followups_target ?? patch.dailyFollowupsTarget) as number | undefined,
        dailyMeetingsTarget: (patch.daily_meetings_target ?? patch.dailyMeetingsTarget) as number | undefined,
        dailyPipelineMovesTarget: (patch.daily_pipeline_moves_target ?? patch.dailyPipelineMovesTarget) as number | undefined,
        monthlyLeadsNeeded: (patch.monthly_leads_needed ?? patch.monthlyLeadsNeeded) as number | null | undefined,
        notes: patch.notes,
      };
      const goal = await setGoal(pool, orgId, session.userId, goalPatch);
      res.json({ goal });
    } catch (err) {
      console.error("[momentum/goal:post] feilet", err);
      res.status(500).json({ error: "save_failed", detail: String(err) });
    }
  });
}
