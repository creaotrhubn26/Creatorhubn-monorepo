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

  // GET /api/leadgrid/momentum/trend?days=30 — siste N dager fra
  // leadgrid_momentum_snapshots. Returnerer points + avg/best/worst +
  // directionChange (siste minus første) når vi har minst 7 dager.
  app.get("/api/leadgrid/momentum/trend", permView, async (req: Request, res: Response) => {
    const session = getSession(req, activeSessions);
    if (!session) { res.status(401).json({ error: "Innlogging kreves" }); return; }
    const orgId = await resolveOrgIdSmart(req, pool, session.userId);
    if (!orgId) { res.status(400).json({ error: "mangler_organization_id" }); return; }
    const parsed = parseInt(String(req.query.days ?? "30"), 10);
    const days = Math.min(180, Math.max(7, Number.isFinite(parsed) ? parsed : 30));
    try {
      const r = await pool.query<{
        snapshot_date: string;
        momentum_score: string;
        activity_score: string | null;
        velocity_score: string | null;
        decay_score: string | null;
        overdue_penalty: string | null;
        contacts_today: number | null;
        followups_today: number | null;
        meetings_today: number | null;
        pipeline_moves_today: number | null;
      }>(
        `SELECT snapshot_date::text,
                momentum_score::text,
                activity_score::text,
                velocity_score::text,
                decay_score::text,
                overdue_penalty::text,
                contacts_today, followups_today, meetings_today, pipeline_moves_today
           FROM leadgrid_momentum_snapshots
          WHERE organization_id = $1::uuid
            AND snapshot_date >= CURRENT_DATE - ($2 || ' days')::interval
          ORDER BY snapshot_date ASC`,
        [orgId, String(days)],
      );
      const points = r.rows.map((row) => ({
        date: row.snapshot_date,
        score: Number(row.momentum_score),
        activityScore: row.activity_score !== null ? Number(row.activity_score) : null,
        velocityScore: row.velocity_score !== null ? Number(row.velocity_score) : null,
        decayScore: row.decay_score !== null ? Number(row.decay_score) : null,
        overduePenalty: row.overdue_penalty !== null ? Number(row.overdue_penalty) : null,
        contacts: row.contacts_today,
        followups: row.followups_today,
        meetings: row.meetings_today,
        pipelineMoves: row.pipeline_moves_today,
      }));
      const scores = points.map((p) => p.score);
      const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      const best = scores.length > 0 ? Math.max(...scores) : 0;
      const worst = scores.length > 0 ? Math.min(...scores) : 0;
      const directionChange = points.length >= 7
        ? (points[points.length - 1].score - points[0].score)
        : 0;
      res.json({
        trend: {
          organizationId: orgId,
          days,
          points,
          avg, best, worst,
          directionChange,
        },
      });
    } catch (err) {
      console.error("[momentum/trend] feilet", err);
      res.status(500).json({ error: "trend_failed", detail: String(err) });
    }
  });
}
