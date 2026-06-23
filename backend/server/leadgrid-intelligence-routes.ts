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
import type { Pool } from "pg";
import { computeIntelligenceForLead, fetchWeights, DEFAULT_WEIGHTS } from "./leadgrid-intelligence-engine.js";
import type { IntelligenceWeights } from "./leadgrid-intelligence-engine.js";
import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";
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

/**
 * Resolve org-id via lead-id. crm_customers har INGEN organization_id-kolonne —
 * vi henter primary org via owner_user_id → organization_members.
 * Mønster fra PR #837/#848.
 */
async function orgIdFromLead(
  pool: Pool,
  leadId: string,
): Promise<string | null> {
  try {
    const r = await pool.query<{ organization_id: string | null }>(
      `SELECT (SELECT om.organization_id::text FROM organization_members om
                WHERE om.user_id = c.owner_user_id
                ORDER BY om.joined_at ASC LIMIT 1) AS organization_id
         FROM crm_customers c
        WHERE c.id = $1::uuid LIMIT 1`,
      [leadId],
    );
    return r.rows[0]?.organization_id ?? null;
  } catch {
    return null;
  }
}

/** Resolver: foretrekk body/query > lead → org */
async function resolveOrgIdSmart(
  req: Request,
  pool: Pool,
  userId: string,
): Promise<string | null> {
  const explicit =
    req.body?.organization_id ?? req.body?.organizationId ??
    req.query?.organization_id ?? req.query?.organizationId;
  if (typeof explicit === "string" && explicit.length > 0) return explicit;

  const leadId = req.params?.id ?? req.params?.leadId;
  if (typeof leadId === "string" && leadId.length > 0) {
    const o = await orgIdFromLead(pool, leadId);
    if (o) return o;
  }
  // Default-org via medlemskap
  try {
    const r = await pool.query<{ organization_id: string }>(
      `SELECT organization_id::text
         FROM organization_members
        WHERE user_id = $1
        ORDER BY
          CASE role
            WHEN 'admin' THEN 1
            WHEN 'salgssjef' THEN 2
            ELSE 3
          END,
          joined_at ASC
        LIMIT 1`,
      [userId],
    );
    return r.rows[0]?.organization_id ?? null;
  } catch {
    return null;
  }
}

export function registerLeadgridIntelligenceRoutes(deps: Deps): void {
  const { app, pool, activeSessions } = deps;

  const permView = requireLeadMapPermission("intelligence.view_score", {
    pool, activeSessions, resolveOrgId: resolveOrgIdSmart,
  });
  const permRecs = requireLeadMapPermission("intelligence.view_recommendations", {
    pool, activeSessions, resolveOrgId: resolveOrgIdSmart,
  });
  const permRun = requireLeadMapPermission("intelligence.run_engine", {
    pool, activeSessions, resolveOrgId: resolveOrgIdSmart,
  });
  const permExecute = requireLeadMapPermission("intelligence.execute_recommendation", {
    pool, activeSessions, resolveOrgId: resolveOrgIdSmart,
  });
  const permOverride = requireLeadMapPermission("intelligence.override_score", {
    pool, activeSessions, resolveOrgId: resolveOrgIdSmart,
  });

  // ─── GET /api/leadgrid/intelligence/leads/:id ──────────────────────
  // Full intelligence-snapshot. Hvis cache er fersk (< 24h) returneres
  // den fra crm_customers; ellers regnes den på nytt.
  app.get(
    "/api/leadgrid/intelligence/leads/:id",
    permView,
    async (req: Request, res: Response): Promise<void> => {
      const leadId = req.params.id;
      try {
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
             FROM crm_customers
            WHERE id = $1::uuid`,
          [leadId],
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
        });
        if (!result) {
          res.status(404).json({ error: "lead_not_found_or_no_org" });
          return;
        }
        res.json({ lead_id: leadId, cached: false, ...result });
      } catch (err) {
        console.error("[intelligence GET /leads/:id] error", err);
        res.status(500).json({ error: "internal", detail: String(err).slice(0, 200) });
      }
    },
  );

  // ─── POST /api/leadgrid/intelligence/leads/:id/recompute ───────────
  app.post(
    "/api/leadgrid/intelligence/leads/:id/recompute",
    permRun,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const result = await computeIntelligenceForLead(pool, req.params.id, {
          trigger: "manual",
          persist: true,
        });
        if (!result) {
          res.status(404).json({ error: "lead_not_found_or_no_org" });
          return;
        }
        res.json({ lead_id: req.params.id, ok: true, ...result });
      } catch (err) {
        console.error("[intelligence recompute] error", err);
        res.status(500).json({ error: "internal", detail: String(err).slice(0, 200) });
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
      const orgId = await resolveOrgIdSmart(req, pool, session.userId);
      if (!orgId) {
        res.status(400).json({ error: "no_org_context" });
        return;
      }
      const priority = (req.query.priority as string | undefined) ?? undefined;
      const limit = Math.min(
        100,
        Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50),
      );
      const offset = Math.max(0, parseInt(String(req.query.offset ?? "0"), 10) || 0);

      const filterPriority =
        priority && ["low", "normal", "high", "urgent"].includes(priority)
          ? priority
          : null;

      try {
        const r = await pool.query(
          `SELECT lr.id::text,
                  lr.lead_id::text,
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
             JOIN crm_customers c ON c.id = lr.lead_id
            WHERE lr.organization_id = $1::uuid
              AND lr.status = 'pending'
              AND (lr.expires_at IS NULL OR lr.expires_at > NOW())
              AND ($2::text IS NULL OR lr.priority = $2)
            ORDER BY
              CASE lr.priority
                WHEN 'urgent' THEN 1
                WHEN 'high'   THEN 2
                WHEN 'normal' THEN 3
                ELSE 4
              END,
              lr.created_at DESC
            LIMIT $3 OFFSET $4`,
          [orgId, filterPriority, limit, offset],
        );
        res.json({ recommendations: r.rows, count: r.rowCount });
      } catch (err) {
        console.error("[intelligence GET /recommendations] error", err);
        res.status(500).json({ error: "internal", detail: String(err).slice(0, 200) });
      }
    },
  );

  // ─── POST /api/leadgrid/intelligence/recommendations/:id/accept ────
  app.post(
    "/api/leadgrid/intelligence/recommendations/:id/accept",
    permExecute,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const r = await pool.query<{ id: string; organization_id: string }>(
          `UPDATE lead_recommendations
              SET status = 'accepted'
            WHERE id = $1::uuid AND status = 'pending'
            RETURNING id::text, organization_id::text`,
          [req.params.id],
        );
        if (r.rows.length === 0) {
          res.status(404).json({ error: "not_found_or_not_pending" });
          return;
        }
        res.json({ id: r.rows[0].id, status: "accepted" });
      } catch (err) {
        console.error("[intelligence accept] error", err);
        res.status(500).json({ error: "internal", detail: String(err).slice(0, 200) });
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
      const parsed = parseOr400(executeRecommendationBody, req.body, res);
      if (!parsed) return;
      const outcome = parsed.outcome;
      const outcomeNotes = parsed.outcome_notes ?? null;
      try {
        const r = await pool.query<{
          id: string;
          organization_id: string;
          lead_id: string;
          action_type: string;
        }>(
          `UPDATE lead_recommendations
              SET status = 'executed',
                  executed_at = NOW(),
                  outcome = $2,
                  outcome_notes = $3
            WHERE id = $1::uuid AND status IN ('pending','accepted')
            RETURNING id::text, organization_id::text, lead_id::text, action_type`,
          [req.params.id, outcome, outcomeNotes],
        );
        if (r.rows.length === 0) {
          res.status(404).json({ error: "not_found_or_already_executed" });
          return;
        }
        const row = r.rows[0];
        void emitWebhook(pool, "recommendation.executed", {
          recommendation_id: row.id,
          lead_id: row.lead_id,
          action_type: row.action_type,
          outcome,
          executed_by: session.userId,
        }, row.organization_id);

        res.json({ id: row.id, status: "executed", outcome });
      } catch (err) {
        console.error("[intelligence execute] error", err);
        res.status(500).json({ error: "internal", detail: String(err).slice(0, 200) });
      }
    },
  );

  // ─── POST /api/leadgrid/intelligence/recommendations/:id/dismiss ───
  app.post(
    "/api/leadgrid/intelligence/recommendations/:id/dismiss",
    permExecute,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const r = await pool.query<{ id: string }>(
          `UPDATE lead_recommendations
              SET status = 'dismissed'
            WHERE id = $1::uuid AND status = 'pending'
            RETURNING id::text`,
          [req.params.id],
        );
        if (r.rows.length === 0) {
          res.status(404).json({ error: "not_found_or_not_pending" });
          return;
        }
        res.json({ id: r.rows[0].id, status: "dismissed" });
      } catch (err) {
        console.error("[intelligence dismiss] error", err);
        res.status(500).json({ error: "internal", detail: String(err).slice(0, 200) });
      }
    },
  );

  // ─── GET /api/leadgrid/intelligence/follow-up-queue ────────────────
  // Prioritert kø for i dag — leads med høy follow_up_priority eller
  // forfalt next_follow_up_at.
  app.get(
    "/api/leadgrid/intelligence/follow-up-queue",
    permRecs,
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
      const limit = Math.min(
        200,
        Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50),
      );

      try {
        // FIX (2026-06-22): crm_customers har ikke organization_id —
        // filtrer via owner_user_id IN org-members (PR #837/#848-mønster).
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
            WHERE owner_user_id IN (
                SELECT user_id::text FROM organization_members WHERE organization_id = $1::uuid
              )
              AND archived_at IS NULL
              AND (
                follow_up_priority >= 50
                OR (next_follow_up_at IS NOT NULL AND next_follow_up_at <= NOW())
                OR lead_temperature IN ('hot','ready')
              )
            ORDER BY
              CASE WHEN next_follow_up_at IS NOT NULL AND next_follow_up_at <= NOW() THEN 0 ELSE 1 END,
              follow_up_priority DESC NULLS LAST,
              lead_score DESC NULLS LAST
            LIMIT $2`,
          [orgId, limit],
        );
        res.json({ queue: r.rows, count: r.rowCount });
      } catch (err) {
        console.error("[intelligence follow-up-queue] error", err);
        res.status(500).json({ error: "internal", detail: String(err).slice(0, 200) });
      }
    },
  );

  // ─── GET /api/leadgrid/intelligence/leads/:id/history ──────────────
  app.get(
    "/api/leadgrid/intelligence/leads/:id/history",
    permView,
    async (req: Request, res: Response): Promise<void> => {
      const limit = Math.min(
        200,
        Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50),
      );
      try {
        const r = await pool.query(
          `SELECT id::text,
                  lead_score,
                  conversion_probability::float8 AS conversion_probability,
                  expected_value::float8 AS expected_value,
                  follow_up_priority,
                  lead_temperature,
                  pipeline_stage,
                  category_fit::float8 AS category_fit,
                  digital_need::float8 AS digital_need,
                  budget_potential::float8 AS budget_potential,
                  engagement::float8 AS engagement,
                  timing::float8 AS timing,
                  location_fit::float8 AS location_fit,
                  computed_at::text,
                  computed_by,
                  triggered_by,
                  reason
             FROM lead_scores_history
            WHERE lead_id = $1::uuid
            ORDER BY computed_at DESC
            LIMIT $2`,
          [req.params.id, limit],
        );
        res.json({ lead_id: req.params.id, history: r.rows });
      } catch (err) {
        console.error("[intelligence history] error", err);
        res.status(500).json({ error: "internal", detail: String(err).slice(0, 200) });
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
      const reason = typeof req.body?.reason === "string" ? req.body.reason : "manual_override";
      try {
        const u = await pool.query<{ id: string; organization_id: string }>(
          `UPDATE crm_customers
              SET lead_score = $2,
                  lead_temperature = CASE
                    WHEN $2 >= 90 THEN 'ready'
                    WHEN $2 >= 70 THEN 'hot'
                    WHEN $2 >= 40 THEN 'warm'
                    ELSE 'cold'
                  END,
                  scored_at = NOW(),
                  updated_at = NOW()
            WHERE id = $1::uuid
            RETURNING id::text, organization_id::text`,
          [req.params.id, score],
        );
        if (u.rows.length === 0) {
          res.status(404).json({ error: "lead_not_found" });
          return;
        }
        await pool.query(
          `INSERT INTO lead_scores_history
             (lead_id, organization_id, lead_score, computed_by, triggered_by, reason)
           VALUES ($1::uuid, $2::uuid, $3, 'manual', 'manual', $4)`,
          [u.rows[0].id, u.rows[0].organization_id, score, reason],
        );
        res.json({ ok: true, lead_id: u.rows[0].id, lead_score: score });
      } catch (err) {
        console.error("[intelligence score-override] error", err);
        res.status(500).json({ error: "internal", detail: String(err).slice(0, 200) });
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
      res.json({ weights: w, defaults: DEFAULT_WEIGHTS, organization_id: orgId });
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
        categoryFit: parsed.categoryFit ?? (parsed.weights?.categoryFit as number | undefined),
        digitalNeed: parsed.digitalNeed ?? (parsed.weights?.digitalNeed as number | undefined),
        budgetPotential: parsed.budgetPotential ?? (parsed.weights?.budgetPotential as number | undefined),
        engagement: parsed.engagement ?? (parsed.weights?.engagement as number | undefined),
        timing: parsed.timing ?? (parsed.weights?.timing as number | undefined),
        locationFit: parsed.locationFit ?? (parsed.weights?.locationFit as number | undefined),
      };
      const allowedKeys: Array<keyof IntelligenceWeights> = [
        "categoryFit", "digitalNeed", "budgetPotential",
        "engagement", "timing", "locationFit",
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
          if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 5) continue;
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
        res.status(500).json({ error: "internal", detail: String(err).slice(0, 200) });
      }
    },
  );

  // ─── POST /api/leadgrid/intelligence/batch/recompute ───────────────
  // Recompute alle non-archived leads i en org (max 5000 per call,
  // chunked i 50-er).
  app.post(
    "/api/leadgrid/intelligence/batch/recompute",
    permRun,
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
      const cap = Math.min(
        5000,
        Math.max(1, parseInt(String(req.body?.limit ?? "1000"), 10) || 1000),
      );
      try {
        // FIX (2026-06-22): crm_customers har ikke organization_id.
        const rows = await pool.query<{ id: string }>(
          `SELECT id::text FROM crm_customers
            WHERE owner_user_id IN (
                SELECT user_id::text FROM organization_members WHERE organization_id = $1::uuid
              )
              AND archived_at IS NULL
            ORDER BY scored_at ASC NULLS FIRST
            LIMIT $2`,
          [orgId, cap],
        );
        let ok = 0;
        let failed = 0;
        for (let i = 0; i < rows.rows.length; i += 50) {
          const chunk = rows.rows.slice(i, i + 50);
          await Promise.all(
            chunk.map(async (r) => {
              try {
                await computeIntelligenceForLead(pool, r.id, {
                  trigger: "manual", persist: true,
                });
                ok += 1;
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
        });
      } catch (err) {
        console.error("[intelligence batch] error", err);
        res.status(500).json({ error: "internal", detail: String(err).slice(0, 200) });
      }
    },
  );
}
