/**
 * leadgrid-deals-routes.ts
 *
 * REST-endepunkter for Deal Management (#154/#155 fra 500-roadmap).
 *
 * Mount-path: /api/leadgrid/deals/* + /api/leadgrid/leads/:id/deal*
 *
 * Endepunkter:
 *   GET   /api/leadgrid/deals/forecast              — weighted pipeline
 *   GET   /api/leadgrid/deals/by-month              — månedlig weighted forecast
 *   GET   /api/leadgrid/deals/at-risk               — overdue deals
 *   GET   /api/leadgrid/leads/:id/deal              — deal-info for lead
 *   PATCH /api/leadgrid/leads/:id/deal              — oppdater deal-felt
 *   GET   /api/leadgrid/leads/:id/deal-history      — stage-historikk
 *
 * RBAC:
 *   deals.view_forecast (forecast/by-month/at-risk)
 *   deals.view_amount   (GET /leads/:id/deal — for å se amount)
 *   deals.edit          (PATCH)
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";
import { emitWebhook } from "./webhook-emitter.js";
import { loadAccessibleLeadgridLead } from "./leadgrid-lead-access.js";
import { loadAccessibleLeadgridProject } from "./leadgrid-project-access.js";
import {
  computeWeightedForecast,
  getDealForLead,
  updateDealFields,
  fetchStageHistory,
  listDealsAtRisk,
} from "./leadgrid-deals-service.js";

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
  const raw = req.query.projectId ?? req.query.project_id;
  if (typeof raw !== "string") return null;
  const projectId = raw.trim();
  return projectId && projectId.length <= 255 ? projectId : null;
}

async function resolveProjectOrgId(
  req: Request,
  pool: Pool,
  userId: string,
): Promise<string | null> {
  const projectId = requestedProjectId(req);
  if (!projectId) return null;
  const project = await loadAccessibleLeadgridProject(pool, projectId, userId);
  return project?.organizationId ?? null;
}

async function resolveLeadOrgId(
  req: Request,
  pool: Pool,
  userId: string,
): Promise<string | null> {
  const leadId = req.params?.id ?? req.params?.leadId;
  if (typeof leadId !== "string") return null;
  const lead = await loadAccessibleLeadgridLead(pool, { leadId, userId });
  return lead?.organizationId ?? null;
}

function parseHorizon(req: Request): number {
  const raw = req.query.horizon;
  const n = typeof raw === "string" ? parseInt(raw, 10) : NaN;
  if (Number.isFinite(n) && n > 0 && n <= 365 * 3) return n;
  return 365;
}

export function registerLeadgridDealsRoutes(deps: Deps): void {
  const { app, pool, activeSessions } = deps;

  const permViewForecast = requireLeadMapPermission("deals.view_forecast", {
    pool,
    activeSessions,
    resolveOrgId: resolveProjectOrgId,
  });
  const permViewAmount = requireLeadMapPermission("deals.view_amount", {
    pool,
    activeSessions,
    resolveOrgId: resolveLeadOrgId,
  });
  const permEdit = requireLeadMapPermission("deals.edit", {
    pool,
    activeSessions,
    resolveOrgId: resolveLeadOrgId,
  });

  // ── GET /api/leadgrid/deals/forecast ───────────────────────────────
  app.get(
    "/api/leadgrid/deals/forecast",
    permViewForecast,
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
        const project = await loadAccessibleLeadgridProject(
          pool,
          projectId,
          session.userId,
        );
        if (!project) {
          res.status(404).json({ error: "project_not_found" });
          return;
        }
        const horizon = parseHorizon(req);
        const forecast = await computeWeightedForecast(pool, project.organizationId, {
          horizonDays: horizon,
          projectId: project.id,
        });
        res.json({ project_id: project.id, forecast });
      } catch (err) {
        console.error("[deals/forecast]", err);
        res.status(500).json({ error: "forecast_failed" });
      }
    },
  );

  // ── GET /api/leadgrid/deals/by-month ───────────────────────────────
  app.get(
    "/api/leadgrid/deals/by-month",
    permViewForecast,
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
        const project = await loadAccessibleLeadgridProject(
          pool,
          projectId,
          session.userId,
        );
        if (!project) {
          res.status(404).json({ error: "project_not_found" });
          return;
        }
        const horizon = parseHorizon(req);
        const forecast = await computeWeightedForecast(pool, project.organizationId, {
          horizonDays: horizon,
          projectId: project.id,
        });
        res.json({ project_id: project.id, byMonth: forecast.byMonth });
      } catch (err) {
        console.error("[deals/by-month]", err);
        res.status(500).json({ error: "by_month_failed" });
      }
    },
  );

  // ── GET /api/leadgrid/deals/at-risk ────────────────────────────────
  app.get(
    "/api/leadgrid/deals/at-risk",
    permViewForecast,
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
        const project = await loadAccessibleLeadgridProject(
          pool,
          projectId,
          session.userId,
        );
        if (!project) {
          res.status(404).json({ error: "project_not_found" });
          return;
        }
        const limitRaw = req.query.limit;
        const limit =
          typeof limitRaw === "string"
            ? Math.min(100, Math.max(1, parseInt(limitRaw, 10) || 20))
            : 20;
        const deals = await listDealsAtRisk(
          pool,
          project.organizationId,
          limit,
          project.id,
        );
        res.json({ project_id: project.id, deals });
      } catch (err) {
        console.error("[deals/at-risk]", err);
        res.status(500).json({ error: "at_risk_failed" });
      }
    },
  );

  // ── GET /api/leadgrid/leads/:id/deal ───────────────────────────────
  app.get(
    "/api/leadgrid/leads/:id/deal",
    permViewAmount,
    async (req: Request, res: Response): Promise<void> => {
      const session = getSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      try {
        const lead = await loadAccessibleLeadgridLead(pool, {
          leadId: req.params.id,
          userId: session.userId,
        });
        if (!lead) {
          res.status(404).json({ error: "lead_ikke_funnet" });
          return;
        }
        const scope = {
          organizationId: lead.organizationId,
          projectId: lead.projectId,
        };
        const deal = await getDealForLead(pool, lead.id, scope);
        if (!deal) {
          res.status(404).json({ error: "lead_ikke_funnet" });
          return;
        }
        res.json({ deal });
      } catch (err) {
        console.error("[leads/:id/deal GET]", err);
        res.status(500).json({ error: "fetch_failed" });
      }
    },
  );

  // ── PATCH /api/leadgrid/leads/:id/deal ─────────────────────────────
  app.patch(
    "/api/leadgrid/leads/:id/deal",
    permEdit,
    async (req: Request, res: Response): Promise<void> => {
      const session = getSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }

      const body = (req.body ?? {}) as Record<string, unknown>;
      const patch: {
        dealProbability?: number | null;
        expectedCloseDate?: string | null;
        dealAmount?: number | null;
        dealCurrency?: string | null;
      } = {};

      if ("deal_probability" in body || "dealProbability" in body) {
        const v =
          (body.deal_probability as unknown) ??
          (body.dealProbability as unknown);
        if (v === null) patch.dealProbability = null;
        else if (typeof v === "number" && Number.isFinite(v))
          patch.dealProbability = Math.round(v);
        else {
          res.status(400).json({ error: "deal_probability_invalid" });
          return;
        }
      }

      if ("expected_close_date" in body || "expectedCloseDate" in body) {
        const v =
          (body.expected_close_date as unknown) ??
          (body.expectedCloseDate as unknown);
        if (v === null) patch.expectedCloseDate = null;
        else if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v))
          patch.expectedCloseDate = v.slice(0, 10);
        else {
          res.status(400).json({ error: "expected_close_date_invalid" });
          return;
        }
      }

      if ("deal_amount" in body || "dealAmount" in body) {
        const v = (body.deal_amount as unknown) ?? (body.dealAmount as unknown);
        if (v === null) patch.dealAmount = null;
        else if (typeof v === "number" && Number.isFinite(v))
          patch.dealAmount = v;
        else if (typeof v === "string" && /^\d+(\.\d+)?$/.test(v))
          patch.dealAmount = Number(v);
        else {
          res.status(400).json({ error: "deal_amount_invalid" });
          return;
        }
      }

      if ("deal_currency" in body || "dealCurrency" in body) {
        const v =
          (body.deal_currency as unknown) ?? (body.dealCurrency as unknown);
        if (v === null) patch.dealCurrency = null;
        else if (typeof v === "string" && /^[A-Z]{3}$/.test(v))
          patch.dealCurrency = v;
        else {
          res.status(400).json({ error: "deal_currency_invalid" });
          return;
        }
      }

      try {
        const lead = await loadAccessibleLeadgridLead(pool, {
          leadId: req.params.id,
          userId: session.userId,
        });
        if (!lead) {
          res.status(404).json({ error: "lead_ikke_funnet" });
          return;
        }
        const scope = {
          organizationId: lead.organizationId,
          projectId: lead.projectId,
        };
        const before = await getDealForLead(pool, lead.id, scope);
        if (!before) {
          res.status(404).json({ error: "lead_ikke_funnet" });
          return;
        }
        const after = await updateDealFields(
          pool,
          lead.id,
          session.userId,
          patch,
          scope,
        );
        if (!after) {
          res.status(404).json({ error: "lead_ikke_funnet" });
          return;
        }

        // Emit fire-and-forget webhooks for hver endret felt
        const orgId = lead.organizationId;
        if (orgId) {
          if (
            patch.dealProbability !== undefined &&
            before.dealProbability !== after.dealProbability
          ) {
            void emitWebhook(
              pool,
              "deal.probability_changed",
              {
                lead_id: lead.id,
                old_probability: before.dealProbability,
                new_probability: after.dealProbability,
                changed_by: session.userId,
                manual: true,
              },
              orgId,
            );
          }
          if (
            patch.dealAmount !== undefined &&
            before.dealAmount !== after.dealAmount
          ) {
            void emitWebhook(
              pool,
              "deal.amount_changed",
              {
                lead_id: lead.id,
                old_amount: before.dealAmount,
                new_amount: after.dealAmount,
                currency: after.dealCurrency,
                changed_by: session.userId,
              },
              orgId,
            );
          }
          if (
            patch.expectedCloseDate !== undefined &&
            before.expectedCloseDate !== after.expectedCloseDate
          ) {
            void emitWebhook(
              pool,
              "deal.expected_close_changed",
              {
                lead_id: lead.id,
                old_date: before.expectedCloseDate,
                new_date: after.expectedCloseDate,
                changed_by: session.userId,
              },
              orgId,
            );
          }
        }

        // Trigger workflow-engine via event-bus
        try {
          const bus = await import("./leadgrid-workflow-engine.js");
          if (
            patch.dealProbability !== undefined &&
            before.dealProbability !== after.dealProbability &&
            orgId
          ) {
            void bus.publishEvent({
              pool,
              organizationId: orgId,
              projectId: lead.projectId,
              type: "deal.probability_changed",
              leadId: lead.id,
              actorUserId: session.userId,
              data: {
                old_probability: before.dealProbability,
                new_probability: after.dealProbability,
              },
            });
          }
          // Workflow-QA 2026-07-05: amount fikk webhook men ALDRI
          // workflow-event — deal.amount_changed-triggeren fyrte aldri.
          if (
            patch.dealAmount !== undefined &&
            before.dealAmount !== after.dealAmount &&
            orgId
          ) {
            void bus.publishEvent({
              pool,
              organizationId: orgId,
              projectId: lead.projectId,
              type: "deal.amount_changed",
              leadId: lead.id,
              actorUserId: session.userId,
              data: {
                old_amount: before.dealAmount,
                new_amount: after.dealAmount,
              },
            });
          }
        } catch (err) {
          console.warn("[deals PATCH] workflow-engine publish skip:", err);
        }

        res.json({ deal: after });
      } catch (err) {
        console.error("[leads/:id/deal PATCH]", err);
        const msg = String((err as Error)?.message ?? "");
        if (msg === "deal_probability_out_of_range") {
          res.status(400).json({ error: msg });
        } else if (msg === "deal_amount_negative") {
          res.status(400).json({ error: msg });
        } else {
          res.status(500).json({ error: "update_failed" });
        }
      }
    },
  );

  // ── GET /api/leadgrid/leads/:id/deal-history ───────────────────────
  app.get(
    "/api/leadgrid/leads/:id/deal-history",
    permViewAmount,
    async (req: Request, res: Response): Promise<void> => {
      const session = getSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      try {
        const lead = await loadAccessibleLeadgridLead(pool, {
          leadId: req.params.id,
          userId: session.userId,
        });
        if (!lead) {
          res.status(404).json({ error: "lead_ikke_funnet" });
          return;
        }
        const limitRaw = req.query.limit;
        const limit =
          typeof limitRaw === "string"
            ? Math.min(200, Math.max(1, parseInt(limitRaw, 10) || 50))
            : 50;
        const history = await fetchStageHistory(pool, lead.id, limit, {
          organizationId: lead.organizationId,
          projectId: lead.projectId,
        });
        res.json({ history });
      } catch (err) {
        console.error("[leads/:id/deal-history]", err);
        res.status(500).json({ error: "history_failed" });
      }
    },
  );
}
