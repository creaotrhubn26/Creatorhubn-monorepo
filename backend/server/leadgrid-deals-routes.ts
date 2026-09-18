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
 *   GET   /api/leadgrid/leads/:id/deals             — alle salg på bedriften
 *   POST  /api/leadgrid/leads/:id/deals             — nytt salg på bedriften
 *   PATCH /api/leadgrid/deals/:dealId               — endre ett salg
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

/**
 * Org-oppslag for endepunkter som identifiseres av salget, ikke av bedriften.
 * Går via crm_customers slik at den vanlige lead-tilgangen fortsatt gjelder —
 * et salg arver tilgangen til bedriften det hører til.
 */
async function resolveDealOrgId(
  req: Request,
  pool: Pool,
  userId: string,
): Promise<string | null> {
  const dealId = req.params?.dealId;
  if (typeof dealId !== "string" || !UUID_RE.test(dealId)) return null;
  const r = await pool.query<{ customer_id: string }>(
    `SELECT customer_id::text FROM leadgrid_deals WHERE id = $1::uuid LIMIT 1`,
    [dealId],
  );
  const customerId = r.rows[0]?.customer_id;
  if (!customerId) return null;
  const lead = await loadAccessibleLeadgridLead(pool, {
    leadId: customerId,
    userId,
  });
  return lead?.organizationId ?? null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DEAL_STAGES = [
  "new",
  "first_contact",
  "qualified",
  "meeting",
  "proposal",
  "negotiation",
  "won",
  "lost",
] as const;

const DEAL_COLUMNS = `d.id::text,
          d.customer_id::text AS customer_id,
          d.title,
          d.description,
          d.primary_contact_id::text AS primary_contact_id,
          d.pipeline_stage,
          d.deal_probability,
          d.deal_amount::text AS deal_amount,
          d.currency,
          d.expected_close_date::text AS expected_close_date,
          d.renewal_date::text AS renewal_date,
          d.owner_user_id,
          d.is_primary,
          d.won_at, d.lost_at, d.lost_reason,
          d.stage_changed_at, d.created_at, d.updated_at`;

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
  // Samme rettighet, men identifisert av salget i stedet for bedriften.
  const permEditDeal = requireLeadMapPermission("deals.edit", {
    pool,
    activeSessions,
    resolveOrgId: resolveDealOrgId,
  });
  const permViewDeal = requireLeadMapPermission("deals.view_amount", {
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

  // ── GET /api/leadgrid/leads/:id/deals ──────────────────────────────
  // Alle salg på bedriften. Bedriften registreres én gang; salgene er flere.
  app.get(
    "/api/leadgrid/leads/:id/deals",
    permViewDeal,
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
        const r = await pool.query(
          `SELECT ${DEAL_COLUMNS}
             FROM leadgrid_deals d
            WHERE d.customer_id = $1::uuid
              AND d.organization_id = $2::uuid
              AND d.project_id = $3
              AND d.archived_at IS NULL
            ORDER BY d.is_primary DESC, d.created_at ASC`,
          [lead.id, lead.organizationId, lead.projectId],
        );
        res.json({ lead_id: lead.id, deals: r.rows });
      } catch (err) {
        console.error("[leads/:id/deals GET]", err);
        res.status(500).json({ error: "deals_failed" });
      }
    },
  );

  // ── POST /api/leadgrid/leads/:id/deals ─────────────────────────────
  // Nytt salg på en bedrift vi allerede har. Rører ikke bedriftsraden:
  // det er nettopp det som gjør at kunden slipper å registreres på nytt.
  app.post(
    "/api/leadgrid/leads/:id/deals",
    permEdit,
    async (req: Request, res: Response): Promise<void> => {
      const session = getSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      const body = (req.body ?? {}) as Record<string, unknown>;
      const title = typeof body.title === "string" ? body.title.trim() : "";
      if (!title || title.length > 300) {
        res.status(400).json({ error: "title_required" });
        return;
      }
      const stage =
        typeof body.pipeline_stage === "string" ? body.pipeline_stage : "new";
      if (!(DEAL_STAGES as readonly string[]).includes(stage)) {
        res.status(400).json({ error: "pipeline_stage_invalid" });
        return;
      }
      const amountRaw = body.deal_amount;
      let amount: number | null = null;
      if (amountRaw !== undefined && amountRaw !== null) {
        const n = typeof amountRaw === "number" ? amountRaw : Number(amountRaw);
        if (!Number.isFinite(n) || n < 0) {
          res.status(400).json({ error: "deal_amount_invalid" });
          return;
        }
        amount = n;
      }
      const closeRaw = body.expected_close_date;
      let closeDate: string | null = null;
      if (typeof closeRaw === "string") {
        if (!/^\d{4}-\d{2}-\d{2}/.test(closeRaw)) {
          res.status(400).json({ error: "expected_close_date_invalid" });
          return;
        }
        closeDate = closeRaw.slice(0, 10);
      }
      const contactRaw = body.primary_contact_id;
      if (contactRaw !== undefined && contactRaw !== null) {
        if (typeof contactRaw !== "string" || !UUID_RE.test(contactRaw)) {
          res.status(400).json({ error: "primary_contact_id_invalid" });
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
        // Kontakten må høre til den samme bedriften. Uten denne sjekken
        // kunne et salg peke på en person hos en annen kunde.
        if (typeof contactRaw === "string") {
          const c = await pool.query(
            `SELECT 1 FROM leadgrid_customer_contacts
              WHERE id = $1::uuid AND customer_id = $2::uuid
                AND organization_id = $3::uuid AND project_id = $4`,
            [contactRaw, lead.id, lead.organizationId, lead.projectId],
          );
          if (!c.rowCount) {
            res.status(400).json({ error: "contact_not_on_customer" });
            return;
          }
        }
        const r = await pool.query(
          `INSERT INTO leadgrid_deals
             (organization_id, project_id, customer_id, title, description,
              primary_contact_id, pipeline_stage, deal_amount,
              expected_close_date, owner_user_id, source, created_by_user_id)
           VALUES ($1::uuid, $2, $3::uuid, $4, $5, $6::uuid, $7, $8, $9::date,
                   $10, 'manual', $10)
           RETURNING ${DEAL_COLUMNS.replace(/\bd\./g, "")}`,
          [
            lead.organizationId,
            lead.projectId,
            lead.id,
            title,
            typeof body.description === "string" ? body.description : null,
            typeof contactRaw === "string" ? contactRaw : null,
            stage,
            amount,
            closeDate,
            session.userId,
          ],
        );
        void emitWebhook(
          pool,
          "deal.created",
          { lead_id: lead.id, deal_id: r.rows[0]?.id, title, pipeline_stage: stage },
          lead.organizationId,
          lead.projectId,
        );
        res.status(201).json({ deal: r.rows[0] });
      } catch (err) {
        console.error("[leads/:id/deals POST]", err);
        res.status(500).json({ error: "deal_create_failed" });
      }
    },
  );

  // ── PATCH /api/leadgrid/deals/:dealId ──────────────────────────────
  // Primærsalget speiler crm_customers og skrives derfor fortsatt gjennom
  // PATCH /leads/:id/deal. Å tillate begge veier ville gitt to skrivere på
  // samme verdi, og da er det et tidsspørsmål før de spriker.
  app.patch(
    "/api/leadgrid/deals/:dealId",
    permEditDeal,
    async (req: Request, res: Response): Promise<void> => {
      const session = getSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      const body = (req.body ?? {}) as Record<string, unknown>;
      const sets: string[] = [];
      const params: unknown[] = [req.params.dealId];

      const push = (sql: string, value: unknown): void => {
        params.push(value);
        sets.push(sql.replace("$n", `$${params.length}`));
      };

      if (typeof body.title === "string") {
        const t = body.title.trim();
        if (!t || t.length > 300) {
          res.status(400).json({ error: "title_invalid" });
          return;
        }
        push("title = $n", t);
      }
      if ("description" in body) {
        push(
          "description = $n",
          typeof body.description === "string" ? body.description : null,
        );
      }
      if ("pipeline_stage" in body) {
        const stage = body.pipeline_stage;
        if (
          typeof stage !== "string" ||
          !(DEAL_STAGES as readonly string[]).includes(stage)
        ) {
          res.status(400).json({ error: "pipeline_stage_invalid" });
          return;
        }
        push("pipeline_stage = $n", stage);
        sets.push("stage_changed_at = NOW()");
        sets.push(
          "won_at = CASE WHEN " +
            `$${params.length} = 'won' THEN COALESCE(won_at, NOW()) ELSE won_at END`,
        );
        sets.push(
          "lost_at = CASE WHEN " +
            `$${params.length} = 'lost' THEN COALESCE(lost_at, NOW()) ELSE lost_at END`,
        );
      }
      if ("deal_amount" in body) {
        const v = body.deal_amount;
        if (v === null) push("deal_amount = $n", null);
        else {
          const n = typeof v === "number" ? v : Number(v);
          if (!Number.isFinite(n) || n < 0) {
            res.status(400).json({ error: "deal_amount_invalid" });
            return;
          }
          push("deal_amount = $n", n);
        }
      }
      if ("deal_probability" in body) {
        const v = body.deal_probability;
        if (v === null) push("deal_probability = $n", null);
        else {
          const n = typeof v === "number" ? v : Number(v);
          if (!Number.isFinite(n) || n < 0 || n > 100) {
            res.status(400).json({ error: "deal_probability_invalid" });
            return;
          }
          push("deal_probability = $n", Math.round(n));
        }
      }
      for (const [key, column] of [
        ["expected_close_date", "expected_close_date"],
        ["renewal_date", "renewal_date"],
      ] as const) {
        if (!(key in body)) continue;
        const v = body[key];
        if (v === null) {
          push(`${column} = $n::date`, null);
          continue;
        }
        if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(v)) {
          res.status(400).json({ error: `${key}_invalid` });
          return;
        }
        push(`${column} = $n::date`, v.slice(0, 10));
      }
      if ("lost_reason" in body) {
        push(
          "lost_reason = $n",
          typeof body.lost_reason === "string" ? body.lost_reason : null,
        );
      }
      if ("primary_contact_id" in body) {
        const v = body.primary_contact_id;
        if (v !== null && (typeof v !== "string" || !UUID_RE.test(v))) {
          res.status(400).json({ error: "primary_contact_id_invalid" });
          return;
        }
        push("primary_contact_id = $n::uuid", v);
      }

      if (sets.length === 0) {
        res.status(400).json({ error: "ingen_felt_a_oppdatere" });
        return;
      }

      try {
        const existing = await pool.query<{ is_primary: boolean; customer_id: string }>(
          `SELECT is_primary, customer_id::text
             FROM leadgrid_deals WHERE id = $1::uuid AND archived_at IS NULL`,
          [req.params.dealId],
        );
        const row = existing.rows[0];
        if (!row) {
          res.status(404).json({ error: "salg_ikke_funnet" });
          return;
        }
        if (row.is_primary) {
          res.status(409).json({
            error: "primaersalg_endres_via_lead",
            detail: `PATCH /api/leadgrid/leads/${row.customer_id}/deal`,
          });
          return;
        }
        const r = await pool.query(
          `UPDATE leadgrid_deals
              SET ${sets.join(", ")}, updated_at = NOW()
            WHERE id = $1::uuid AND archived_at IS NULL
            RETURNING ${DEAL_COLUMNS.replace(/\bd\./g, "")}`,
          params,
        );
        res.json({ deal: r.rows[0] });
      } catch (err) {
        console.error("[deals/:dealId PATCH]", err);
        res.status(500).json({ error: "deal_update_failed" });
      }
    },
  );
}
