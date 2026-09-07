/**
 * leadgrid-momentum-routes.ts
 *
 * Momentum Engine — 3 endepunkter (mig 327):
 *   GET  /api/leadgrid/momentum/today  — composite score 0-100 +
 *        breakdown + next-best-actions + trend vs i går.
 *   GET  /api/leadgrid/momentum/goal   — månedsmål for prosjekt.
 *   POST /api/leadgrid/momentum/goal   — sett/oppdater månedsmål.
 *
 * Alle krever et tilgjengelig projectId og er RBAC-gated.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";
import {
  getOrCreateGoal,
  setGoal,
  computeTodayMomentum,
  type SalesGoalPatch,
} from "./leadgrid-momentum-service.js";
import {
  getLeadgridSession,
  loadAccessibleLeadgridProject,
  type LeadgridSession,
} from "./leadgrid-project-access.js";
import {
  requestedLeadMapProjectId,
  LeadMapProjectScopeError,
} from "./lead-map-project-scope.js";

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, LeadgridSession>;
}

type MomentumRequestScope =
  | { organizationId: string; projectId: string }
  | {
      error: "invalid_project_id" | "project_id_required" | "project_not_found";
      status: 400 | 404;
    };

const requestScopeCache = new WeakMap<Request, Promise<MomentumRequestScope>>();

function resolveMomentumRequestScope(
  req: Request,
  pool: Pool,
  userId: string,
): Promise<MomentumRequestScope> {
  const cached = requestScopeCache.get(req);
  if (cached) return cached;

  const resolution = (async (): Promise<MomentumRequestScope> => {
    let projectId: string | null;
    try {
      projectId = requestedLeadMapProjectId(req);
    } catch (error) {
      if (error instanceof LeadMapProjectScopeError) {
        return { error: "invalid_project_id", status: 400 };
      }
      throw error;
    }
    if (!projectId) {
      return { error: "project_id_required", status: 400 };
    }
    const project = await loadAccessibleLeadgridProject(pool, projectId, userId);
    if (!project) {
      return { error: "project_not_found", status: 404 };
    }
    return {
      organizationId: project.organizationId,
      projectId: project.id,
    };
  })();
  requestScopeCache.set(req, resolution);
  return resolution;
}

async function resolveProjectOrgId(
  req: Request,
  pool: Pool,
  userId: string,
): Promise<string | null> {
  try {
    const scope = await resolveMomentumRequestScope(req, pool, userId);
    return "error" in scope ? null : scope.organizationId;
  } catch {
    return null;
  }
}

function sendScopeError(
  scope: MomentumRequestScope,
  res: Response,
): scope is Extract<MomentumRequestScope, { error: string }> {
  if (!("error" in scope)) return false;
  res.status(scope.status).json({ error: scope.error });
  return true;
}

export function registerLeadgridMomentumRoutes(deps: Deps): void {
  const { app, pool, activeSessions } = deps;
  const permView = requireLeadMapPermission("momentum.view", {
    pool,
    activeSessions,
    resolveOrgId: resolveProjectOrgId,
  });
  const permSet = requireLeadMapPermission("momentum.set_goal", {
    pool,
    activeSessions,
    resolveOrgId: resolveProjectOrgId,
  });

  // GET /api/leadgrid/momentum/today
  app.get("/api/leadgrid/momentum/today", permView, async (req: Request, res: Response) => {
    const session = getLeadgridSession(req, activeSessions);
    if (!session) {
      res.status(401).json({ error: "Innlogging kreves" });
      return;
    }
    try {
      const scope = await resolveMomentumRequestScope(req, pool, session.userId);
      if (sendScopeError(scope, res)) return;
      const momentum = await computeTodayMomentum(
        pool,
        scope.organizationId,
        scope.projectId,
      );
      res.json({ project_id: scope.projectId, momentum });
    } catch (err) {
      console.error("[momentum/today] feilet", err);
      res.status(500).json({ error: "compute_failed", detail: "internal_error" });
    }
  });

  // GET /api/leadgrid/momentum/goal
  app.get("/api/leadgrid/momentum/goal", permView, async (req: Request, res: Response) => {
    const session = getLeadgridSession(req, activeSessions);
    if (!session) {
      res.status(401).json({ error: "Innlogging kreves" });
      return;
    }
    try {
      const scope = await resolveMomentumRequestScope(req, pool, session.userId);
      if (sendScopeError(scope, res)) return;
      const goal = await getOrCreateGoal(
        pool,
        scope.organizationId,
        scope.projectId,
      );
      res.json({ project_id: scope.projectId, goal });
    } catch (err) {
      console.error("[momentum/goal:get] feilet", err);
      res.status(500).json({ error: "fetch_failed", detail: "internal_error" });
    }
  });

  // POST /api/leadgrid/momentum/goal
  app.post("/api/leadgrid/momentum/goal", permSet, async (req: Request, res: Response) => {
    const session = getLeadgridSession(req, activeSessions);
    if (!session) {
      res.status(401).json({ error: "Innlogging kreves" });
      return;
    }
    try {
      const scope = await resolveMomentumRequestScope(req, pool, session.userId);
      if (sendScopeError(scope, res)) return;
      const patch = (req.body ?? {}) as Record<string, unknown> & {
        notes?: string | null;
      };
      const goalPatch: SalesGoalPatch = {
        yearMonth: (patch.year_month ?? patch.yearMonth) as string | undefined,
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
      const goal = await setGoal(
        pool,
        scope.organizationId,
        scope.projectId,
        session.userId,
        goalPatch,
      );
      res.json({ project_id: scope.projectId, goal });
    } catch (err) {
      console.error("[momentum/goal:post] feilet", err);
      res.status(500).json({ error: "save_failed", detail: "internal_error" });
    }
  });

  // GET /api/leadgrid/momentum/trend?days=30 — siste N dager fra
  // leadgrid_project_momentum_snapshots. Returnerer points + avg/best/worst +
  // directionChange (siste minus første) når vi har minst 7 dager.
  app.get("/api/leadgrid/momentum/trend", permView, async (req: Request, res: Response) => {
    const session = getLeadgridSession(req, activeSessions);
    if (!session) { res.status(401).json({ error: "Innlogging kreves" }); return; }
    const parsed = parseInt(String(req.query.days ?? "30"), 10);
    const days = Math.min(180, Math.max(7, Number.isFinite(parsed) ? parsed : 30));
    try {
      const scope = await resolveMomentumRequestScope(req, pool, session.userId);
      if (sendScopeError(scope, res)) return;
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
           FROM leadgrid_project_momentum_snapshots
          WHERE organization_id = $1::uuid
            AND project_id = $2
            AND snapshot_date >= CURRENT_DATE - ($3 || ' days')::interval
          ORDER BY snapshot_date ASC`,
        [scope.organizationId, scope.projectId, String(days)],
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
          organizationId: scope.organizationId,
          projectId: scope.projectId,
          days,
          points,
          avg, best, worst,
          directionChange,
        },
      });
    } catch (err) {
      console.error("[momentum/trend] feilet", err);
      res.status(500).json({ error: "trend_failed", detail: "internal_error" });
    }
  });
}
