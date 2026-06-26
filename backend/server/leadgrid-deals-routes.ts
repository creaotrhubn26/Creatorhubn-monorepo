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

async function resolveOrgIdSmart(
  req: Request,
  pool: Pool,
  userId: string,
): Promise<string | null> {
  const explicit =
    (req.body as { organization_id?: string } | undefined)?.organization_id ??
    (req.query?.organization_id as string | undefined);
  if (typeof explicit === "string" && explicit.length > 0) return explicit;

  const leadId = req.params?.id ?? req.params?.leadId;
  if (typeof leadId === "string" && leadId.length > 0) {
    const o = await orgIdFromLead(pool, leadId);
    if (o) return o;
  }

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
    resolveOrgId: resolveOrgIdSmart,
  });
  const permViewAmount = requireLeadMapPermission("deals.view_amount", {
    pool,
    activeSessions,
    resolveOrgId: resolveOrgIdSmart,
  });
  const permEdit = requireLeadMapPermission("deals.edit", {
    pool,
    activeSessions,
    resolveOrgId: resolveOrgIdSmart,
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
      const orgId = await resolveOrgIdSmart(req, pool, session.userId);
      if (!orgId) {
        res.json({
          forecast: {
            summary: {
              organizationId: null,
              totalWeightedValue: 0,
              totalPipelineValue: 0,
              dealsCount: 0,
              averageProbability: 0,
              currency: "NOK",
            },
            byMonth: [],
            byQuarter: [],
          },
        });
        return;
      }
      try {
        const horizon = parseHorizon(req);
        const forecast = await computeWeightedForecast(pool, orgId, {
          horizonDays: horizon,
        });
        res.json({ forecast });
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
      const orgId = await resolveOrgIdSmart(req, pool, session.userId);
      if (!orgId) {
        res.json({ byMonth: [] });
        return;
      }
      try {
        const horizon = parseHorizon(req);
        const forecast = await computeWeightedForecast(pool, orgId, {
          horizonDays: horizon,
        });
        res.json({ byMonth: forecast.byMonth });
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
      const orgId = await resolveOrgIdSmart(req, pool, session.userId);
      if (!orgId) {
        res.json({ deals: [] });
        return;
      }
      try {
        const limitRaw = req.query.limit;
        const limit =
          typeof limitRaw === "string"
            ? Math.min(100, Math.max(1, parseInt(limitRaw, 10) || 20))
            : 20;
        const deals = await listDealsAtRisk(pool, orgId, limit);
        res.json({ deals });
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
        const deal = await getDealForLead(pool, req.params.id);
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
        const before = await getDealForLead(pool, req.params.id);
        if (!before) {
          res.status(404).json({ error: "lead_ikke_funnet" });
          return;
        }
        const after = await updateDealFields(
          pool,
          req.params.id,
          session.userId,
          patch,
        );
        if (!after) {
          res.status(404).json({ error: "lead_ikke_funnet" });
          return;
        }

        // Emit fire-and-forget webhooks for hver endret felt
        const orgId = await orgIdFromLead(pool, req.params.id);
        if (orgId) {
          if (
            patch.dealProbability !== undefined &&
            before.dealProbability !== after.dealProbability
          ) {
            void emitWebhook(
              pool,
              "deal.probability_changed",
              {
                lead_id: req.params.id,
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
                lead_id: req.params.id,
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
                lead_id: req.params.id,
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
              type: "deal.probability_changed",
              leadId: req.params.id,
              actorUserId: session.userId,
              data: {
                old_probability: before.dealProbability,
                new_probability: after.dealProbability,
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
        const limitRaw = req.query.limit;
        const limit =
          typeof limitRaw === "string"
            ? Math.min(200, Math.max(1, parseInt(limitRaw, 10) || 50))
            : 50;
        const history = await fetchStageHistory(pool, req.params.id, limit);
        res.json({ history });
      } catch (err) {
        console.error("[leads/:id/deal-history]", err);
        res.status(500).json({ error: "history_failed" });
      }
    },
  );
}
