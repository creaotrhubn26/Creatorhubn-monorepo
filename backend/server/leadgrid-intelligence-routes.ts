/**
 * leadgrid-intelligence-routes.ts
 *
 * REST-endepunkter for Leadgrid Intelligence Engine.
 *
 * Mount-path: /api/leadgrid/intelligence/*
 *
 * Auth-mønster: session via activeSessions + RBAC via requireLeadMapPermission
 * (intelligence.view_score | view_recommendations | run_engine |
 *  execute_recommendation | override_score) — se mig 313 for full liste.
 */

import type { Express, Request, Response } from "express";
import type { Pool, PoolClient } from "pg";
import {
  computeIntelligenceForLead,
  fetchWeights,
  DEFAULT_WEIGHTS,
} from "./leadgrid-intelligence-engine.js";
import type { IntelligenceWeights } from "./leadgrid-intelligence-engine.js";
import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";
import { getLeadgridProjectAccess } from "./leadgrid-project-access.js";
import { emitWebhook } from "./webhook-emitter.js";
import {
  parseOr400,
  executeRecommendationBody,
  patchWeightsBody,
} from "./leadgrid-validators.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

function getSession(
  req: Request,
  activeSessions: Map<string, SessionData>,
): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const s = activeSessions.get(auth.slice(7));
    if (s) return s;
  }
  return null;
}

function requestedProjectId(req: Request): string | null {
  const value =
    req.body?.project_id ??
    req.body?.projectId ??
    req.query?.project_id ??
    req.query?.projectId;
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

/** Resolver: valgt prosjekt > eksplisitt org > autoritativ rad → org. */
async function resolveOrgIdSmart(
  req: Request,
  pool: Pool,
  userId: string,
): Promise<string | null> {
  const projectId = requestedProjectId(req);
  if (projectId) {
    try {
      const access = await getLeadgridProjectAccess(pool, {
        projectId,
        userId,
      });
      if (access) return access.organizationId;
    } catch {
      return null;
    }
  }

  const explicit =
    req.body?.organization_id ??
    req.body?.organizationId ??
    req.query?.organization_id ??
    req.query?.organizationId;
  if (typeof explicit === "string" && explicit.length > 0) return explicit;

  // Never pick a tenant from the user's first membership. Workspace-global
  // settings must carry an explicit organization or accessible project.
  return null;
}

async function withTransaction<T>(
  pool: Pool,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export function registerLeadgridIntelligenceRoutes(deps: Deps): void {
  const { app, pool, activeSessions } = deps;

  const permView = requireLeadMapPermission("intelligence.view_score", {
    pool,
    activeSessions,
    resolveOrgId: resolveOrgIdSmart,
  });
  const permRecs = requireLeadMapPermission(
    "intelligence.view_recommendations",
    {
      pool,
      activeSessions,
      resolveOrgId: resolveOrgIdSmart,
    },
  );
  const permRun = requireLeadMapPermission("intelligence.run_engine", {
    pool,
    activeSessions,
    resolveOrgId: resolveOrgIdSmart,
  });
  const permExecute = requireLeadMapPermission(
    "intelligence.execute_recommendation",
    {
      pool,
      activeSessions,
      resolveOrgId: resolveOrgIdSmart,
    },
  );
  const permOverride = requireLeadMapPermission("intelligence.override_score", {
    pool,
    activeSessions,
    resolveOrgId: resolveOrgIdSmart,
  });

  // ─── GET /api/leadgrid/intelligence/leads/:id ──────────────────────
  // Full intelligence-snapshot. Hvis cache er fersk (< 24h) returneres
  // den fra crm_customers; ellers regnes den på nytt.
  app.get(
    "/api/leadgrid/intelligence/leads/:id",
    permView,
    async (req: Request, res: Response): Promise<void> => {
      const session = getSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      const leadId = req.params.id;
      const projectId = requestedProjectId(req);
      if (!projectId) {
        res.status(400).json({ error: "project_id_required" });
        return;
      }
      try {
        const project = await getLeadgridProjectAccess(pool, {
          projectId,
          userId: session.userId,
        });
        if (!project) {
          res.status(404).json({ error: "project_not_found" });
          return;
        }
        const orgId = project.organizationId;
        const cached = await pool.query<{
          id: string;
          lead_score: number | null;
          conversion_probability: number | null;
          expected_value: number | null;
          follow_up_priority: number | null;
          lead_temperature: string | null;
          pipeline_stage: string | null;
          next_best_action: string | null;
          next_best_action_reason: string | null;
          next_best_action_channel: string | null;
          next_best_action_confidence: number | null;
          priority: string | null;
          scored_at: string | null;
        }>(
          `SELECT id::text,
                  lead_score,
                  conversion_probability::float8 AS conversion_probability,
                  expected_value::float8 AS expected_value,
                  follow_up_priority,
                  lead_temperature,
                  pipeline_stage,
                  next_best_action,
                  next_best_action_reason,
                  next_best_action_channel,
                  next_best_action_confidence::float8 AS next_best_action_confidence,
                  priority,
                  scored_at::text
             FROM crm_customers c
            WHERE c.id = $1::uuid
              AND c.organization_id = $2::uuid
              AND c.project_id = $3
              AND (
                c.assigned_user_id::text = $4
                OR EXISTS (
                  SELECT 1
                    FROM organization_members om
                   WHERE om.organization_id = $2::uuid
                     AND om.user_id = $4
                     AND om.role IN (
                       'owner', 'admin', 'markedssjef', 'salgssjef', 'teamleder'
                     )
                )
              )`,
          [leadId, orgId, projectId, session.userId],
        );
        if (cached.rows.length === 0) {
          res.status(404).json({ error: "lead_not_found" });
          return;
        }
        const c = cached.rows[0];
        const cacheFresh = c.scored_at
          ? Date.now() - Date.parse(c.scored_at) < 24 * 60 * 60 * 1000
          : false;
        if (cacheFresh && c.lead_score != null) {
          res.json({
            lead_id: c.id,
            cached: true,
            scored_at: c.scored_at,
            lead_score: c.lead_score,
            conversion_probability: c.conversion_probability,
            expected_value: c.expected_value,
            follow_up_priority: c.follow_up_priority,
            lead_temperature: c.lead_temperature,
            pipeline_stage: c.pipeline_stage,
            next_best_action: c.next_best_action,
            next_best_action_reason: c.next_best_action_reason,
            next_best_action_channel: c.next_best_action_channel,
            next_best_action_confidence: c.next_best_action_confidence,
            priority: c.priority,
          });
          return;
        }
        const result = await computeIntelligenceForLead(pool, leadId, {
          trigger: "manual",
          persist: true,
          expectedScope: {
            organizationId: orgId,
            projectId,
          },
        });
        if (!result) {
          res.status(404).json({ error: "lead_not_found_or_scope_changed" });
          return;
        }
        res.json({ lead_id: leadId, cached: false, ...result });
      } catch (err) {
        console.error("[intelligence GET /leads/:id] error", err);
        res
          .status(500)
          .json({ error: "internal", detail: "internal_error".slice(0, 200) });
      }
    },
  );

  // ─── POST /api/leadgrid/intelligence/leads/:id/recompute ───────────
  app.post(
    "/api/leadgrid/intelligence/leads/:id/recompute",
    permRun,
    async (req: Request, res: Response): Promise<void> => {
      const session = getSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      const projectId = requestedProjectId(req);
      if (!projectId) {
        res.status(400).json({ error: "project_id_required" });
        return;
      }
      try {
        const project = await getLeadgridProjectAccess(pool, {
          projectId,
          userId: session.userId,
        });
        if (!project) {
          res.status(404).json({ error: "project_not_found" });
          return;
        }
        const orgId = project.organizationId;
        const scopedLead = await pool.query(
          `SELECT 1
             FROM crm_customers c
            WHERE c.id = $1::uuid
              AND c.organization_id = $2::uuid
              AND c.project_id = $3
              AND (
                c.assigned_user_id::text = $4
                OR EXISTS (
                  SELECT 1
                    FROM organization_members om
                   WHERE om.organization_id = $2::uuid
                     AND om.user_id = $4
                     AND om.role IN (
                       'owner', 'admin', 'markedssjef', 'salgssjef', 'teamleder'
                     )
                )
              )
            LIMIT 1`,
          [req.params.id, orgId, projectId, session.userId],
        );
        if (scopedLead.rows.length === 0) {
          res.status(404).json({ error: "lead_not_found" });
          return;
        }
        const result = await computeIntelligenceForLead(pool, req.params.id, {
          trigger: "manual",
          persist: true,
          expectedScope: {
            organizationId: orgId,
            projectId,
          },
        });
        if (!result) {
          res.status(404).json({ error: "lead_not_found_or_scope_changed" });
          return;
        }
        res.json({ lead_id: req.params.id, ok: true, ...result });
      } catch (err) {
        console.error("[intelligence recompute] error", err);
        res
          .status(500)
          .json({ error: "internal", detail: "internal_error".slice(0, 200) });
      }
    },
  );

  // ─── GET /api/leadgrid/intelligence/recommendations ────────────────
  // Returnerer aktive NBA for innlogget bruker (assigned_user_id = me)
  // ELLER for hele org hvis admin/salgssjef.
  app.get(
    "/api/leadgrid/intelligence/recommendations",
    permRecs,
    async (req: Request, res: Response): Promise<void> => {
      const session = getSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      const projectId = requestedProjectId(req);
      if (!projectId) {
        res.status(400).json({ error: "project_id_required" });
        return;
      }
      const orgId = await resolveOrgIdSmart(req, pool, session.userId);
      if (!orgId) {
        res.status(404).json({ error: "project_not_found" });
        return;
      }
      const priority = (req.query.priority as string | undefined) ?? undefined;
      const limit = Math.min(
        100,
        Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50),
      );
      const offset = Math.max(
        0,
        parseInt(String(req.query.offset ?? "0"), 10) || 0,
      );

      const filterPriority =
        priority && ["low", "normal", "high", "urgent"].includes(priority)
          ? priority
          : null;

      try {
        const project = await getLeadgridProjectAccess(pool, {
          projectId,
          userId: session.userId,
        });
        if (!project || project.organizationId !== orgId) {
          res.status(404).json({ error: "project_not_found" });
          return;
        }
        const r = await pool.query(
          `SELECT lr.id::text,
                  lr.lead_id::text,
                  lr.project_id::text,
                  lr.action_type,
                  lr.channel,
                  lr.priority,
                  lr.reason,
                  lr.best_contact_time,
                  lr.confidence::float8 AS confidence,
                  lr.expected_impact,
                  lr.status,
                  lr.created_at::text,
                  lr.expires_at::text,
                  c.name AS lead_name,
                  c.company AS lead_company,
                  c.city AS lead_city,
                  c.lead_score AS lead_score,
                  c.lead_temperature AS lead_temperature
             FROM lead_recommendations lr
             JOIN crm_customers c
               ON c.id = lr.lead_id
              AND c.organization_id = lr.organization_id
              AND c.project_id = lr.project_id
            WHERE lr.organization_id = $1::uuid
              AND lr.project_id = $2
              AND lr.status = 'pending'
              AND (lr.expires_at IS NULL OR lr.expires_at > NOW())
              AND ($3::text IS NULL OR lr.priority = $3)
              AND (
                c.assigned_user_id::text = $4
                OR EXISTS (
                  SELECT 1
                    FROM organization_members om
                   WHERE om.organization_id = $1::uuid
                     AND om.user_id = $4
                     AND om.role IN (
                       'owner', 'admin', 'markedssjef', 'salgssjef', 'teamleder'
                     )
                )
              )
            ORDER BY
              CASE lr.priority
                WHEN 'urgent' THEN 1
                WHEN 'high'   THEN 2
                WHEN 'normal' THEN 3
                ELSE 4
              END,
              lr.created_at DESC
            LIMIT $5 OFFSET $6`,
          [orgId, projectId, filterPriority, session.userId, limit, offset],
        );
        res.json({ recommendations: r.rows, count: r.rowCount });
      } catch (err) {
        console.error("[intelligence GET /recommendations] error", err);
        res
          .status(500)
          .json({ error: "internal", detail: "internal_error".slice(0, 200) });
      }
    },
  );

  // ─── POST /api/leadgrid/intelligence/recommendations/:id/accept ────
  app.post(
    "/api/leadgrid/intelligence/recommendations/:id/accept",
    permExecute,
    async (req: Request, res: Response): Promise<void> => {
      const session = getSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      const projectId = requestedProjectId(req);
      if (!projectId) {
        res.status(400).json({ error: "project_id_required" });
        return;
      }
      const orgId = await resolveOrgIdSmart(req, pool, session.userId);
      if (!orgId) {
        res.status(404).json({ error: "recommendation_not_found" });
        return;
      }
      try {
        const r = await pool.query<{ id: string }>(
          `UPDATE lead_recommendations lr
              SET status = 'accepted'
             FROM crm_customers c
            WHERE lr.id = $1::uuid
              AND lr.organization_id = $2::uuid
              AND lr.project_id = $3
              AND c.id = lr.lead_id
              AND c.organization_id = lr.organization_id
              AND c.project_id = lr.project_id
              AND (
                c.assigned_user_id::text = $4
                OR EXISTS (
                  SELECT 1
                    FROM organization_members om
                   WHERE om.organization_id = $2::uuid
                     AND om.user_id = $4
                     AND om.role IN ('owner', 'admin', 'markedssjef', 'salgssjef', 'teamleder')
                )
              )
              AND lr.status = 'pending'
            RETURNING lr.id::text`,
          [req.params.id, orgId, projectId, session.userId],
        );
        if (r.rows.length === 0) {
          const existing = await pool.query<{ status: string }>(
            `SELECT lr.status
               FROM lead_recommendations lr
               JOIN crm_customers c
                 ON c.id = lr.lead_id
                AND c.organization_id = lr.organization_id
                AND c.project_id = lr.project_id
              WHERE lr.id = $1::uuid
                AND lr.organization_id = $2::uuid
                AND lr.project_id = $3
                AND (
                  c.assigned_user_id::text = $4
                  OR EXISTS (
                    SELECT 1
                      FROM organization_members om
                     WHERE om.organization_id = $2::uuid
                       AND om.user_id = $4
                       AND om.role IN ('owner', 'admin', 'markedssjef', 'salgssjef', 'teamleder')
                  )
                )
              LIMIT 1`,
            [req.params.id, orgId, projectId, session.userId],
          );
          if (existing.rows[0]?.status === "accepted") {
            res.json({ id: req.params.id, status: "accepted", replayed: true });
            return;
          }
          res.status(404).json({ error: "not_found_or_not_pending" });
          return;
        }
        res.json({ id: r.rows[0].id, status: "accepted", replayed: false });
      } catch (err) {
        console.error("[intelligence accept] error", err);
        res
          .status(500)
          .json({ error: "internal", detail: "internal_error".slice(0, 200) });
      }
    },
  );

  // ─── POST /api/leadgrid/intelligence/recommendations/:id/execute ───
  app.post(
    "/api/leadgrid/intelligence/recommendations/:id/execute",
    permExecute,
    async (req: Request, res: Response): Promise<void> => {
      const session = getSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      const projectId = requestedProjectId(req);
      if (!projectId) {
        res.status(400).json({ error: "project_id_required" });
        return;
      }
      const parsed = parseOr400(executeRecommendationBody, req.body, res);
      if (!parsed) return;
      const outcome = parsed.outcome;
      const outcomeNotes = parsed.outcome_notes ?? null;
      const orgId = await resolveOrgIdSmart(req, pool, session.userId);
      if (!orgId) {
        res.status(404).json({ error: "recommendation_not_found" });
        return;
      }
      try {
        const r = await pool.query<{
          id: string;
          organization_id: string;
          lead_id: string;
          action_type: string;
        }>(
          `UPDATE lead_recommendations lr
              SET status = 'executed',
                  executed_at = NOW(),
                  outcome = $2,
                  outcome_notes = $3
             FROM crm_customers c
            WHERE lr.id = $1::uuid
              AND lr.organization_id = $4::uuid
              AND lr.project_id = $5
              AND c.id = lr.lead_id
              AND c.organization_id = lr.organization_id
              AND c.project_id = lr.project_id
              AND (
                c.assigned_user_id::text = $6
                OR EXISTS (
                  SELECT 1
                    FROM organization_members om
                   WHERE om.organization_id = $4::uuid
                     AND om.user_id = $6
                     AND om.role IN ('owner', 'admin', 'markedssjef', 'salgssjef', 'teamleder')
                )
              )
              AND lr.status IN ('pending','accepted')
            RETURNING lr.id::text, lr.organization_id::text,
                      lr.lead_id::text, lr.action_type`,
          [
            req.params.id,
            outcome,
            outcomeNotes,
            orgId,
            projectId,
            session.userId,
          ],
        );
        if (r.rows.length === 0) {
          const existing = await pool.query<{
            id: string;
            status: string;
            outcome: string | null;
            outcome_notes: string | null;
          }>(
            `SELECT lr.id::text, lr.status, lr.outcome, lr.outcome_notes
               FROM lead_recommendations lr
               JOIN crm_customers c
                 ON c.id = lr.lead_id
                AND c.organization_id = lr.organization_id
                AND c.project_id = lr.project_id
              WHERE lr.id = $1::uuid
                AND lr.organization_id = $2::uuid
                AND lr.project_id = $3
                AND (
                  c.assigned_user_id::text = $4
                  OR EXISTS (
                    SELECT 1
                      FROM organization_members om
                     WHERE om.organization_id = $2::uuid
                       AND om.user_id = $4
                       AND om.role IN ('owner', 'admin', 'markedssjef', 'salgssjef', 'teamleder')
                  )
                )
              LIMIT 1`,
            [req.params.id, orgId, projectId, session.userId],
          );
          const prior = existing.rows[0];
          if (
            prior?.status === "executed" &&
            prior.outcome === outcome &&
            prior.outcome_notes === outcomeNotes
          ) {
            res.json({
              id: prior.id,
              status: "executed",
              outcome,
              replayed: true,
            });
            return;
          }
          if (prior?.status === "executed") {
            res
              .status(409)
              .json({ error: "recommendation_execution_conflict" });
            return;
          }
          res.status(404).json({ error: "not_found_or_not_executable" });
          return;
        }
        const row = r.rows[0];
        void emitWebhook(
          pool,
          "recommendation.executed",
          {
            recommendation_id: row.id,
            lead_id: row.lead_id,
            project_id: projectId,
            action_type: row.action_type,
            outcome,
            executed_by: session.userId,
          },
          row.organization_id,
          projectId,
        );

        res.json({ id: row.id, status: "executed", outcome, replayed: false });
      } catch (err) {
        console.error("[intelligence execute] error", err);
        res
          .status(500)
          .json({ error: "internal", detail: "internal_error".slice(0, 200) });
      }
    },
  );

  // ─── POST /api/leadgrid/intelligence/recommendations/:id/dismiss ───
  app.post(
    "/api/leadgrid/intelligence/recommendations/:id/dismiss",
    permExecute,
    async (req: Request, res: Response): Promise<void> => {
      const session = getSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      const projectId = requestedProjectId(req);
      if (!projectId) {
        res.status(400).json({ error: "project_id_required" });
        return;
      }
      const orgId = await resolveOrgIdSmart(req, pool, session.userId);
      if (!orgId) {
        res.status(404).json({ error: "recommendation_not_found" });
        return;
      }
      try {
        const r = await pool.query<{ id: string }>(
          `UPDATE lead_recommendations lr
              SET status = 'dismissed'
             FROM crm_customers c
            WHERE lr.id = $1::uuid
              AND lr.organization_id = $2::uuid
              AND lr.project_id = $3
              AND c.id = lr.lead_id
              AND c.organization_id = lr.organization_id
              AND c.project_id = lr.project_id
              AND (
                c.assigned_user_id::text = $4
                OR EXISTS (
                  SELECT 1
                    FROM organization_members om
                   WHERE om.organization_id = $2::uuid
                     AND om.user_id = $4
                     AND om.role IN ('owner', 'admin', 'markedssjef', 'salgssjef', 'teamleder')
                )
              )
              AND lr.status = 'pending'
            RETURNING lr.id::text`,
          [req.params.id, orgId, projectId, session.userId],
        );
        if (r.rows.length === 0) {
          const existing = await pool.query<{ status: string }>(
            `SELECT lr.status
               FROM lead_recommendations lr
               JOIN crm_customers c
                 ON c.id = lr.lead_id
                AND c.organization_id = lr.organization_id
                AND c.project_id = lr.project_id
              WHERE lr.id = $1::uuid
                AND lr.organization_id = $2::uuid
                AND lr.project_id = $3
                AND (
                  c.assigned_user_id::text = $4
                  OR EXISTS (
                    SELECT 1
                      FROM organization_members om
                     WHERE om.organization_id = $2::uuid
                       AND om.user_id = $4
                       AND om.role IN ('owner', 'admin', 'markedssjef', 'salgssjef', 'teamleder')
                  )
                )
              LIMIT 1`,
            [req.params.id, orgId, projectId, session.userId],
          );
          if (existing.rows[0]?.status === "dismissed") {
            res.json({
              id: req.params.id,
              status: "dismissed",
              replayed: true,
            });
            return;
          }
          res.status(404).json({ error: "not_found_or_not_pending" });
          return;
        }
        res.json({ id: r.rows[0].id, status: "dismissed", replayed: false });
      } catch (err) {
        console.error("[intelligence dismiss] error", err);
        res
          .status(500)
          .json({ error: "internal", detail: "internal_error".slice(0, 200) });
      }
    },
  );

  // ─── POST /api/leadgrid/intelligence/recommendations/:id/snooze ────
  // Mig 326. Body: { hours: number (1-168, default 24), reason?: string }
  // Låser opp: iPad NBA-kort med "Snooze 24h"-knapp.
  app.post(
    "/api/leadgrid/intelligence/recommendations/:id/snooze",
    permExecute,
    async (req: Request, res: Response): Promise<void> => {
      const session = getSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      const projectId = requestedProjectId(req);
      if (!projectId) {
        res.status(400).json({ error: "project_id_required" });
        return;
      }
      const hours = Math.min(
        168,
        Math.max(
          1,
          parseInt(
            String((req.body as Record<string, unknown>)?.hours ?? "24"),
            10,
          ) || 24,
        ),
      );
      const orgId = await resolveOrgIdSmart(req, pool, session.userId);
      if (!orgId) {
        res.status(404).json({ error: "recommendation_not_found" });
        return;
      }
      try {
        const r = await pool.query<{
          id: string;
          snoozed_until: string;
          organization_id: string;
        }>(
          `UPDATE lead_recommendations lr
              SET snoozed_until = NOW() + ($1 || ' hours')::interval,
                  snoozed_at = NOW(),
                  snoozed_by_user_id = $2
             FROM crm_customers c
            WHERE lr.id = $3::uuid
              AND lr.organization_id = $4::uuid
              AND lr.project_id = $5
              AND c.id = lr.lead_id
              AND c.organization_id = lr.organization_id
              AND c.project_id = lr.project_id
              AND (
                c.assigned_user_id::text = $2
                OR EXISTS (
                  SELECT 1
                    FROM organization_members om
                   WHERE om.organization_id = $4::uuid
                     AND om.user_id = $2
                     AND om.role IN ('owner', 'admin', 'markedssjef', 'salgssjef', 'teamleder')
                )
              )
              AND lr.status = 'pending'
            RETURNING lr.id::text, lr.snoozed_until::text,
                      lr.organization_id::text`,
          [String(hours), session.userId, req.params.id, orgId, projectId],
        );
        if (r.rowCount === 0) {
          res.status(404).json({ error: "ikke_funnet_eller_ikke_pending" });
          return;
        }

        void emitWebhook(
          pool,
          "recommendation.snoozed",
          {
            recommendation_id: r.rows[0].id,
            project_id: projectId,
            hours,
            snoozed_until: r.rows[0].snoozed_until,
            snoozed_by: session.userId,
          },
          r.rows[0].organization_id,
          projectId,
        );

        res.json({ ok: true, snoozed_until: r.rows[0].snoozed_until, hours });
      } catch (err) {
        console.error("[intelligence snooze] error", err);
        res.status(500).json({
          error: "snooze_failed",
          detail: "internal_error".slice(0, 200),
        });
      }
    },
  );

  // ─── PATCH /api/leadgrid/intelligence/leads/:id/pipeline-stage ─────
  // Mig 326. Body: { pipeline_stage: 'new'|'first_contact'|... }
  // Låser opp: iPad Kanban drag-and-drop mellom pipeline-kolonner.
  const VALID_STAGES = [
    "new",
    "first_contact",
    "qualified",
    "meeting",
    "proposal",
    "negotiation",
    "won",
    "lost",
  ] as const;

  app.patch(
    "/api/leadgrid/intelligence/leads/:id/pipeline-stage",
    permExecute,
    async (req: Request, res: Response): Promise<void> => {
      const session = getSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      const projectId = requestedProjectId(req);
      if (!projectId) {
        res.status(400).json({ error: "project_id_required" });
        return;
      }
      const newStage = String(
        (req.body as Record<string, unknown>)?.pipeline_stage ?? "",
      );
      if (!(VALID_STAGES as readonly string[]).includes(newStage)) {
        res.status(400).json({ error: "ugyldig_stage", valid: VALID_STAGES });
        return;
      }
      const orgId = await resolveOrgIdSmart(req, pool, session.userId);
      if (!orgId) {
        res.status(404).json({ error: "lead_ikke_funnet" });
        return;
      }
      try {
        const project = await getLeadgridProjectAccess(pool, {
          projectId,
          userId: session.userId,
        });
        if (!project || project.organizationId !== orgId) {
          res.status(404).json({ error: "project_not_found" });
          return;
        }

        const transition = await withTransaction(pool, async (client) => {
          const leadResult = await client.query<{
            pipeline_stage: string | null;
          }>(
            `SELECT c.pipeline_stage
               FROM crm_customers c
              WHERE c.id = $1::uuid
                AND c.organization_id = $2::uuid
                AND c.project_id = $3
                AND (
                  c.assigned_user_id::text = $4
                  OR EXISTS (
                    SELECT 1
                      FROM organization_members om
                     WHERE om.organization_id = $2::uuid
                       AND om.user_id = $4
                       AND om.role IN (
                         'owner', 'admin', 'markedssjef', 'salgssjef', 'teamleder'
                       )
                  )
                )
              FOR UPDATE`,
            [req.params.id, orgId, projectId, session.userId],
          );
          const lead = leadResult.rows[0];
          if (!lead) return null;

          const oldStage = lead.pipeline_stage;
          if (oldStage === newStage) {
            return { oldStage, replayed: true };
          }

          await client.query(
            `UPDATE crm_customers
                SET pipeline_stage = $1,
                    last_pipeline_stage_change_at = NOW(),
                    last_pipeline_stage_change_by = $2,
                    updated_at = NOW()
              WHERE id = $3::uuid
                AND organization_id = $4::uuid
                AND project_id = $5`,
            [newStage, session.userId, req.params.id, orgId, projectId],
          );
          await client.query(
            `INSERT INTO crm_lead_activities
               (customer_id, user_id, activity_type, old_value, new_value,
                description, metadata, created_at)
             VALUES ($1::uuid, $2, 'status_changed', $3, $4, $5, $6::jsonb, NOW())`,
            [
              req.params.id,
              session.userId,
              oldStage,
              newStage,
              "Pipeline-stage endret: " +
                (oldStage ?? "ukjent") +
                " → " +
                newStage,
              JSON.stringify({
                kind: "pipeline_stage_change",
                source: "patch_endpoint",
                project_id: projectId,
              }),
            ],
          );
          return { oldStage, replayed: false };
        });

        if (!transition) {
          res.status(404).json({ error: "lead_ikke_funnet_eller_ingen_tilgang" });
          return;
        }
        if (transition.replayed) {
          res.json({
            ok: true,
            lead_id: req.params.id,
            old_stage: transition.oldStage,
            new_stage: newStage,
            replayed: true,
          });
          return;
        }

        try {
          const engine = await import("./leadgrid-intelligence-engine.js");
          void engine.computeIntelligenceForLead(pool, req.params.id, {
            trigger: "activity",
            expectedScope: {
              organizationId: orgId,
              projectId,
            },
          });
        } catch (err) {
          console.warn("[pipeline-stage] re-score skip:", err);
        }

        void emitWebhook(
          pool,
          "lead.pipeline_stage_changed",
          {
            lead_id: req.params.id,
            project_id: projectId,
            old_stage: transition.oldStage,
            new_stage: newStage,
            changed_by: session.userId,
          },
          orgId,
          projectId,
        );

        try {
          const bus = await import("./leadgrid-workflow-engine.js");
          void bus.publishEvent({
            pool,
            organizationId: orgId,
            projectId,
            type: "pipeline.stage_changed",
            leadId: req.params.id,
            actorUserId: session.userId,
            data: {
              project_id: projectId,
              from: transition.oldStage,
              to: newStage,
            },
          });
        } catch (err) {
          console.warn("[pipeline-stage] workflow-engine publish skip:", err);
        }

        res.json({
          ok: true,
          lead_id: req.params.id,
          old_stage: transition.oldStage,
          new_stage: newStage,
          replayed: false,
        });
      } catch (err) {
        console.error("[intelligence pipeline-stage] error", err);
        res.status(500).json({
          error: "update_failed",
          detail: "internal_error".slice(0, 200),
        });
      }
    },
  );

  // ─── GET /api/leadgrid/intelligence/follow-up-queue ────────────────
  // Prioritert kø innenfor ett eksplisitt kundeprosjekt.
  app.get(
    "/api/leadgrid/intelligence/follow-up-queue",
    permRecs,
    async (req: Request, res: Response): Promise<void> => {
      const session = getSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      const projectId = requestedProjectId(req);
      if (!projectId) {
        res.status(400).json({ error: "project_id_required" });
        return;
      }
      const orgId = await resolveOrgIdSmart(req, pool, session.userId);
      if (!orgId) {
        res.status(404).json({ error: "project_not_found" });
        return;
      }
      const limit = Math.min(
        200,
        Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50),
      );

      try {
        const project = await getLeadgridProjectAccess(pool, {
          projectId,
          userId: session.userId,
        });
        if (!project || project.organizationId !== orgId) {
          res.status(404).json({ error: "project_not_found" });
          return;
        }
        const r = await pool.query(
          `SELECT id::text,
                  name,
                  company,
                  city,
                  lead_score,
                  conversion_probability::float8 AS conversion_probability,
                  expected_value::float8 AS expected_value,
                  follow_up_priority,
                  lead_temperature,
                  pipeline_stage,
                  next_best_action,
                  next_best_action_reason,
                  next_best_action_channel,
                  next_follow_up_at::text,
                  last_contacted_at::text,
                  assigned_user_id::text
             FROM crm_customers
            WHERE organization_id = $1::uuid
              AND project_id = $2
              AND archived_at IS NULL
              AND (
                assigned_user_id::text = $3
                OR EXISTS (
                  SELECT 1
                    FROM organization_members om
                   WHERE om.organization_id = $1::uuid
                     AND om.user_id = $3
                     AND om.role IN (
                       'owner', 'admin', 'markedssjef', 'salgssjef', 'teamleder'
                     )
                )
              )
              AND (
                follow_up_priority >= 50
                OR (next_follow_up_at IS NOT NULL AND next_follow_up_at <= NOW())
                OR lead_temperature IN ('hot','ready')
              )
              AND NOT EXISTS (
                SELECT 1 FROM lead_recommendations lr
                 WHERE lr.lead_id = crm_customers.id
                   AND lr.organization_id = $1::uuid
                   AND lr.project_id = $2
                   AND lr.status = 'pending'
                   AND lr.snoozed_until IS NOT NULL
                   AND lr.snoozed_until > NOW()
              )
            ORDER BY
              CASE WHEN next_follow_up_at IS NOT NULL AND next_follow_up_at <= NOW() THEN 0 ELSE 1 END,
              follow_up_priority DESC NULLS LAST,
              lead_score DESC NULLS LAST
            LIMIT $4`,
          [orgId, projectId, session.userId, limit],
        );
        res.json({
          queue: r.rows,
          count: r.rowCount,
          project_id: projectId,
        });
      } catch (err) {
        console.error("[intelligence follow-up-queue] error", err);
        res
          .status(500)
          .json({ error: "internal", detail: "internal_error".slice(0, 200) });
      }
    },
  );

  // ─── GET /api/leadgrid/intelligence/leads/:id/history ──────────────
  app.get(
    "/api/leadgrid/intelligence/leads/:id/history",
    permView,
    async (req: Request, res: Response): Promise<void> => {
      const session = getSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      const projectId = requestedProjectId(req);
      if (!projectId) {
        res.status(400).json({ error: "project_id_required" });
        return;
      }
      const limit = Math.min(
        200,
        Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50),
      );
      try {
        const project = await getLeadgridProjectAccess(pool, {
          projectId,
          userId: session.userId,
        });
        if (!project) {
          res.status(404).json({ error: "project_not_found" });
          return;
        }
        const orgId = project.organizationId;
        const r = await pool.query(
          `SELECT h.id::text,
                  h.lead_score,
                  h.conversion_probability::float8 AS conversion_probability,
                  h.expected_value::float8 AS expected_value,
                  h.follow_up_priority,
                  h.lead_temperature,
                  h.pipeline_stage,
                  h.category_fit::float8 AS category_fit,
                  h.digital_need::float8 AS digital_need,
                  h.budget_potential::float8 AS budget_potential,
                  h.engagement::float8 AS engagement,
                  h.timing::float8 AS timing,
                  h.location_fit::float8 AS location_fit,
                  h.computed_at::text,
                  h.computed_by,
                  h.triggered_by,
                  h.reason
             FROM lead_scores_history h
             JOIN crm_customers c
               ON c.id = h.lead_id
              AND c.organization_id = h.organization_id
              AND c.project_id = h.project_id
            WHERE h.lead_id = $1::uuid
              AND h.organization_id = $2::uuid
              AND h.project_id = $3
              AND (
                c.assigned_user_id::text = $4
                OR EXISTS (
                  SELECT 1
                    FROM organization_members om
                   WHERE om.organization_id = $2::uuid
                     AND om.user_id = $4
                     AND om.role IN (
                       'owner', 'admin', 'markedssjef', 'salgssjef', 'teamleder'
                     )
                )
              )
            ORDER BY h.computed_at DESC
            LIMIT $5`,
          [req.params.id, orgId, projectId, session.userId, limit],
        );
        res.json({ lead_id: req.params.id, history: r.rows });
      } catch (err) {
        console.error("[intelligence history] error", err);
        res
          .status(500)
          .json({ error: "internal", detail: "internal_error".slice(0, 200) });
      }
    },
  );

  // ─── POST /api/leadgrid/intelligence/leads/:id/score-override ──────
  app.post(
    "/api/leadgrid/intelligence/leads/:id/score-override",
    permOverride,
    async (req: Request, res: Response): Promise<void> => {
      const session = getSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      const score = parseInt(String(req.body?.lead_score), 10);
      if (!Number.isFinite(score) || score < 0 || score > 100) {
        res.status(400).json({ error: "invalid_score", required: "0-100" });
        return;
      }
      const reason =
        typeof req.body?.reason === "string"
          ? req.body.reason
          : "manual_override";
      const projectId = requestedProjectId(req);
      if (!projectId) {
        res.status(400).json({ error: "project_id_required" });
        return;
      }
      try {
        const project = await getLeadgridProjectAccess(pool, {
          projectId,
          userId: session.userId,
        });
        if (!project) {
          res.status(404).json({ error: "project_not_found" });
          return;
        }
        const orgId = project.organizationId;
        const updated = await withTransaction(pool, async (client) => {
          const result = await client.query<{
            id: string;
            organization_id: string;
          }>(
            `UPDATE crm_customers c
                SET lead_score = $2,
                    lead_temperature = CASE
                      WHEN $2 >= 90 THEN 'ready'
                      WHEN $2 >= 70 THEN 'hot'
                      WHEN $2 >= 40 THEN 'warm'
                      ELSE 'cold'
                    END,
                    scored_at = NOW(),
                    updated_at = NOW()
              WHERE c.id = $1::uuid
                AND c.organization_id = $3::uuid
                AND c.project_id = $4
                AND (
                  c.assigned_user_id::text = $5
                  OR EXISTS (
                    SELECT 1
                      FROM organization_members om
                     WHERE om.organization_id = $3::uuid
                       AND om.user_id = $5
                       AND om.role IN (
                         'owner', 'admin', 'markedssjef', 'salgssjef', 'teamleder'
                       )
                  )
                )
              RETURNING c.id::text, c.organization_id::text`,
            [req.params.id, score, orgId, projectId, session.userId],
          );
          const row = result.rows[0];
          if (!row) return null;
          await client.query(
            `INSERT INTO lead_scores_history
               (lead_id, organization_id, project_id, lead_score, computed_by,
                triggered_by, reason)
             VALUES ($1::uuid, $2::uuid, $3, $4, 'manual', 'manual', $5)`,
            [row.id, row.organization_id, projectId, score, reason],
          );
          return row;
        });
        if (!updated) {
          res.status(404).json({
            error: "lead_not_found_or_no_project_access",
          });
          return;
        }
        res.json({ ok: true, lead_id: updated.id, lead_score: score });
      } catch (err) {
        console.error("[intelligence score-override] error", err);
        res
          .status(500)
          .json({ error: "internal", detail: "internal_error".slice(0, 200) });
      }
    },
  );

  // ─── GET /api/leadgrid/intelligence/weights ────────────────────────
  app.get(
    "/api/leadgrid/intelligence/weights",
    permView,
    async (req: Request, res: Response): Promise<void> => {
      const session = getSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      const orgId = await resolveOrgIdSmart(req, pool, session.userId);
      if (!orgId) {
        res.status(400).json({ error: "no_org_context" });
        return;
      }
      const w = await fetchWeights(pool, orgId);
      res.json({
        weights: w,
        defaults: DEFAULT_WEIGHTS,
        organization_id: orgId,
      });
    },
  );

  // ─── PATCH /api/leadgrid/intelligence/weights ──────────────────────
  app.patch(
    "/api/leadgrid/intelligence/weights",
    permRun, // krever run_engine (admin/salgssjef/teamleder)
    async (req: Request, res: Response): Promise<void> => {
      const session = getSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      const orgId = await resolveOrgIdSmart(req, pool, session.userId);
      if (!orgId) {
        res.status(400).json({ error: "no_org_context" });
        return;
      }
      const parsed = parseOr400(patchWeightsBody, req.body, res);
      if (!parsed) return;
      // Aksepterer flat form ELLER `{weights: {...}}`-innpakning. Flat
      // form tar presedens (bakoverkompatibel med eksisterende klienter).
      const body: Partial<Record<keyof IntelligenceWeights, number>> = {
        categoryFit:
          parsed.categoryFit ??
          (parsed.weights?.categoryFit as number | undefined),
        digitalNeed:
          parsed.digitalNeed ??
          (parsed.weights?.digitalNeed as number | undefined),
        budgetPotential:
          parsed.budgetPotential ??
          (parsed.weights?.budgetPotential as number | undefined),
        engagement:
          parsed.engagement ??
          (parsed.weights?.engagement as number | undefined),
        timing: parsed.timing ?? (parsed.weights?.timing as number | undefined),
        locationFit:
          parsed.locationFit ??
          (parsed.weights?.locationFit as number | undefined),
      };
      const allowedKeys: Array<keyof IntelligenceWeights> = [
        "categoryFit",
        "digitalNeed",
        "budgetPotential",
        "engagement",
        "timing",
        "locationFit",
      ];
      const dimMap: Record<keyof IntelligenceWeights, string> = {
        categoryFit: "category_fit",
        digitalNeed: "digital_need",
        budgetPotential: "budget_potential",
        engagement: "engagement",
        timing: "timing",
        locationFit: "location_fit",
      };
      try {
        for (const k of allowedKeys) {
          const v = body[k];
          if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 5)
            continue;
          await pool.query(
            `INSERT INTO crm_scoring_weights
               (organization_id, dimension, weight, updated_by)
             VALUES ($1::uuid, $2, $3, $4)
             ON CONFLICT (organization_id, dimension) DO UPDATE
               SET weight = EXCLUDED.weight, updated_by = EXCLUDED.updated_by,
                   updated_at = NOW()`,
            [orgId, dimMap[k], v, session.userId],
          );
        }
        const w = await fetchWeights(pool, orgId);
        res.json({ ok: true, weights: w });
      } catch (err) {
        console.error("[intelligence PATCH weights] error", err);
        res
          .status(500)
          .json({ error: "internal", detail: "internal_error".slice(0, 200) });
      }
    },
  );

  // ─── POST /api/leadgrid/intelligence/batch/recompute ───────────────
  // Recompute non-archived leads in one explicit customer project
  // (max 5000 per call, chunked in groups of 50).
  app.post(
    "/api/leadgrid/intelligence/batch/recompute",
    permRun,
    async (req: Request, res: Response): Promise<void> => {
      const session = getSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      const projectId = requestedProjectId(req);
      if (!projectId) {
        res.status(400).json({ error: "project_id_required" });
        return;
      }
      const orgId = await resolveOrgIdSmart(req, pool, session.userId);
      if (!orgId) {
        res.status(404).json({ error: "project_not_found" });
        return;
      }
      const cap = Math.min(
        5000,
        Math.max(1, parseInt(String(req.body?.limit ?? "1000"), 10) || 1000),
      );
      try {
        const project = await getLeadgridProjectAccess(pool, {
          projectId,
          userId: session.userId,
        });
        if (!project || project.organizationId !== orgId) {
          res.status(404).json({ error: "project_not_found" });
          return;
        }
        const rows = await pool.query<{ id: string }>(
          `SELECT id::text
             FROM crm_customers
            WHERE organization_id = $1::uuid
              AND project_id = $2
              AND archived_at IS NULL
            ORDER BY scored_at ASC NULLS FIRST
            LIMIT $3`,
          [orgId, projectId, cap],
        );
        let ok = 0;
        let failed = 0;
        for (let i = 0; i < rows.rows.length; i += 50) {
          const chunk = rows.rows.slice(i, i + 50);
          await Promise.all(
            chunk.map(async (r) => {
              try {
                const result = await computeIntelligenceForLead(pool, r.id, {
                  trigger: "manual",
                  persist: true,
                  expectedScope: {
                    organizationId: orgId,
                    projectId,
                  },
                });
                if (result) {
                  ok += 1;
                } else {
                  failed += 1;
                }
              } catch {
                failed += 1;
              }
            }),
          );
        }
        res.json({
          ok: true,
          processed: ok,
          failed,
          total: rows.rowCount,
          organization_id: orgId,
          project_id: projectId,
        });
      } catch (err) {
        console.error("[intelligence batch] error", err);
        res
          .status(500)
          .json({ error: "internal", detail: "internal_error".slice(0, 200) });
      }
    },
  );
}
