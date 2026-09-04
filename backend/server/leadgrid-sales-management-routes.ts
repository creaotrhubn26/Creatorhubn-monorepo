import crypto from "node:crypto";
import type { Express, Request, Response } from "express";
import type { Pool, PoolClient } from "pg";
import { resolveOrgIdForUser } from "./leadgrid-org-resolver.js";
import { canManageLeadgridSales, canViewLeadgridSales } from "./leadgrid-sales-management-auth.js";
import { calculateCommission, refreshContestParticipants } from "./sales-leadership-engine.js";
import {
  enqueueSalesManagementEvent,
  startSalesManagementOutboxWorker,
} from "./leadgrid-sales-management-outbox.js";

type SessionUser = { userId: string; email: string; name: string; role: string };

type Deps = {
  app: Express;
  pool: Pool;
  requireUserSession: (req: Request, res: Response) => SessionUser | null;
};

const DEFAULT_COMMISSION = {
  preset: "balanced",
  activeModels: ["base_percentage"],
  config: { base_percentage: { rate: 0.10 } },
};

const DEFAULT_TEMPLATES = [
  { templateType: "weekly_revenue", label: "Ukentlig omsetning", description: "Topp selger på lukket omsetning", defaultKpi: "closed_revenue" },
  { templateType: "monthly_deals", label: "Månedlig deal-volum", description: "Flest lukkede avtaler", defaultKpi: "deals_closed" },
  { templateType: "discovery_calls", label: "Discovery-samtaler", description: "Flest discovery-møter", defaultKpi: "discovery_calls" },
  { templateType: "demo_count", label: "Demo-konkurranse", description: "Flest demoer holdt", defaultKpi: "demos_held" },
  { templateType: "pipeline_built", label: "Pipeline bygget", description: "Mest pipeline opprettet", defaultKpi: "pipeline_value_created" },
] as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONTEST_STATUSES = new Set(["active", "ended", "archived"]);
const AWARD_STATUSES = ["pending", "awaiting_address", "ordered", "shipped", "received"] as const;
const APPROVAL_KINDS = new Set(["deal", "discount", "special"]);
const APPROVAL_STATUSES = new Set(["approved", "rejected"]);
const COACHING_STATUSES = new Set(["scheduled", "done", "cancelled"]);
const MILEAGE_STATUSES = new Set(["approved", "rejected", "paid"]);
const TAX_FREE_MILEAGE_RATE_2026 = 3.50;
const PRIZE_CATEGORIES = new Set(["tech", "travel", "food", "voucher", "experience", "cash", "physical", "digital"]);
const FULFILLMENT_TYPES = new Set([
  "physical_shipping", "digital_code", "digital_voucher", "experience_voucher",
  "experience_ticket", "travel_booking", "cash_on_payroll", "internal_grant",
]);

export function isAllowedAwardTransition(current: string, target: string): boolean {
  return (
    (current === "pending" && target === "ordered") ||
    (current === "ordered" && target === "shipped") ||
    (current === "shipped" && target === "received")
  );
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function iso(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function commissionConfigDTO(row?: Record<string, unknown>) {
  return row ? {
    preset: String(row.preset ?? "custom"),
    activeModels: Array.isArray(row.active_models) ? row.active_models : [],
    config: obj(row.config),
    updatedAt: iso(row.updated_at),
    isDefault: false,
  } : { ...DEFAULT_COMMISSION, updatedAt: null, isDefault: true };
}

function prizeDTO(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    title: String(row.title ?? row.product_title ?? ""),
    description: String(row.description ?? ""),
    category: String(row.category ?? row.product_category ?? "physical"),
    estimatedValueNok: num(row.estimated_value_nok),
    fulfillmentType: String(row.fulfillment_type ?? "physical_shipping"),
    imageUrl: row.image_url ? String(row.image_url) : null,
    imageB2Key: row.image_b2_key ? String(row.image_b2_key) : null,
    metadata: obj(row.metadata),
    archived: Boolean(row.archived),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function contestDTO(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    templateType: String(row.template_type ?? "custom"),
    kpi: String(row.kpi ?? "closed_revenue"),
    kpiConfig: obj(row.kpi_config),
    status: String(row.status ?? "active"),
    startsAt: iso(row.starts_at),
    endsAt: iso(row.ends_at),
    closedAt: iso(row.closed_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    prizes: array(row.prizes).map((item) => {
      const p = obj(item);
      return {
        id: String(p.id ?? ""),
        rank: num(p.rank),
        productSnapshot: obj(p.product_snapshot),
        title: String(p.product_title ?? ""),
        estimatedValueNok: num(p.estimated_value_nok),
        fulfillmentType: String(p.fulfillment_type ?? "physical_shipping"),
      };
    }),
    participants: array(row.participants).map((item) => {
      const p = obj(item);
      return {
        userId: String(p.user_id ?? ""),
        userName: p.user_name ? String(p.user_name) : null,
        score: num(p.score),
        rank: p.rank == null ? null : num(p.rank),
        lastUpdatedAt: iso(p.last_updated_at),
      };
    }),
  };
}

function awardDTO(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    contestId: String(row.contest_id),
    prizeId: String(row.prize_id),
    winnerUserId: String(row.winner_user_id),
    winnerName: row.winner_name ? String(row.winner_name) : null,
    rank: num(row.rank),
    productTitle: String(row.product_title ?? ""),
    productCategory: String(row.product_category ?? "physical"),
    fulfillmentType: String(row.fulfillment_type ?? "physical_shipping"),
    status: String(row.status ?? "pending"),
    shippingAddress: row.shipping_address ? obj(row.shipping_address) : null,
    trackingNumber: row.tracking_number ? String(row.tracking_number) : null,
    notes: row.notes ? String(row.notes) : null,
    orderedAt: iso(row.ordered_at),
    shippedAt: iso(row.shipped_at),
    receivedAt: iso(row.received_at),
    createdAt: iso(row.created_at),
  };
}

function approvalDTO(row: Record<string, unknown>) {
  return {
    id: num(row.id),
    kind: String(row.kind ?? "deal"),
    title: String(row.title ?? ""),
    sellerUserId: row.seller_user_id ? String(row.seller_user_id) : null,
    sellerName: row.seller_name ? String(row.seller_name) : null,
    customerName: row.customer_name ? String(row.customer_name) : null,
    amountNok: num(row.amount_nok),
    rationale: row.rationale ? String(row.rationale) : null,
    status: String(row.status ?? "pending"),
    comment: row.comment ? String(row.comment) : null,
    sourceType: row.source_type ? String(row.source_type) : null,
    sourceId: row.source_id ? String(row.source_id) : null,
    createdAt: iso(row.created_at),
    decidedAt: iso(row.decided_at),
  };
}

function coachingDTO(row: Record<string, unknown>) {
  return {
    id: num(row.id),
    memberUserId: row.member_user_id ? String(row.member_user_id) : null,
    memberName: String(row.member_name ?? ""),
    scheduledAt: iso(row.scheduled_at),
    focus: row.focus ? String(row.focus) : null,
    status: String(row.status ?? "scheduled"),
    createdAt: iso(row.created_at),
  };
}

function mileageDTO(row: Record<string, unknown>) {
  return {
    id: num(row.id),
    sellerUserId: String(row.seller_user_id ?? ""),
    sellerName: row.seller_name ? String(row.seller_name) : null,
    tripDate: row.trip_date ? String(row.trip_date).slice(0, 10) : null,
    routeText: row.route_text ? String(row.route_text) : null,
    km: num(row.km),
    rateNokPerKm: num(row.rate_nok_per_km),
    amountNok: num(row.amount_nok),
    status: String(row.status ?? "pending"),
    note: row.note ? String(row.note) : null,
    approvedBy: row.approved_by ? String(row.approved_by) : null,
    approvedAt: iso(row.approved_at),
    createdAt: iso(row.created_at),
  };
}

async function loadContests(pool: Pool, organizationId: string) {
  const rows = await pool.query<Record<string, unknown>>(
    `SELECT c.*,
            COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.rank)
                        FROM sales_contest_prizes p WHERE p.contest_id = c.id), '[]'::jsonb) AS prizes,
            COALESCE((SELECT jsonb_agg(to_jsonb(cp) ORDER BY cp.score DESC)
                        FROM sales_contest_participants cp WHERE cp.contest_id = c.id), '[]'::jsonb) AS participants
       FROM sales_contests c
      WHERE c.organization_id = $1::uuid AND c.status <> 'archived'
      ORDER BY CASE WHEN c.status = 'active' THEN 0 ELSE 1 END, c.created_at DESC
      LIMIT 100`,
    [organizationId],
  );
  return rows.rows.map(contestDTO);
}

async function loadCommissionConfig(pool: Pool, organizationId: string) {
  const config = await pool.query<Record<string, unknown>>(
    `SELECT preset, active_models, config, updated_at
       FROM sales_commission_configs WHERE organization_id = $1::uuid LIMIT 1`,
    [organizationId],
  );
  return commissionConfigDTO(config.rows[0]);
}

async function loadTeam(pool: Pool, organizationId: string, commission: ReturnType<typeof commissionConfigDTO>) {
  const result = await pool.query<Record<string, unknown>>(
    `WITH members AS (
       SELECT om.user_id, om.role,
              COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), u.email, om.user_id) AS name,
              u.email
         FROM organization_members om
         LEFT JOIN users u ON u.id = om.user_id
        WHERE om.organization_id = $1::uuid
     ), sales AS (
       SELECT c.assigned_user_id AS user_id,
              COUNT(*) FILTER (WHERE c.archived_at IS NULL)::int AS leads,
              COUNT(*) FILTER (
                WHERE c.archived_at IS NULL
                  AND (c.pipeline_stage = 'won' OR c.status = 'won' OR c.lead_status = 'won')
                  AND COALESCE(c.won_at, c.deal_stage_changed_at, c.updated_at) >= date_trunc('month', NOW())
              )::int AS won_deals,
              COALESCE(SUM(COALESCE(c.won_amount_oere::numeric / 100.0, c.deal_amount, 0)) FILTER (
                WHERE c.archived_at IS NULL
                  AND (c.pipeline_stage = 'won' OR c.status = 'won' OR c.lead_status = 'won')
                  AND COALESCE(c.won_at, c.deal_stage_changed_at, c.updated_at) >= date_trunc('month', NOW())
              ), 0)::float8 AS won_revenue,
              COALESCE(SUM(COALESCE(c.won_recurring_oere::numeric / 100.0, 0)) FILTER (
                WHERE c.archived_at IS NULL
                  AND (c.pipeline_stage = 'won' OR c.status = 'won' OR c.lead_status = 'won')
                  AND COALESCE(c.won_at, c.deal_stage_changed_at, c.updated_at) >= date_trunc('month', NOW())
              ), 0)::float8 AS recurring_revenue,
              COALESCE(SUM(COALESCE(c.deal_amount, 0)) FILTER (
                WHERE c.archived_at IS NULL
                  AND COALESCE(c.pipeline_stage, 'new') NOT IN ('won','lost')
                  AND COALESCE(c.status, '') NOT IN ('won','lost')
                  AND COALESCE(c.lead_status, '') NOT IN ('won','lost','do_not_contact')
              ), 0)::float8 AS pipeline_value
         FROM crm_customers c
        WHERE c.organization_id = $1::uuid AND c.assigned_user_id IS NOT NULL
        GROUP BY c.assigned_user_id
     ), activities AS (
       SELECT la.user_id,
              COUNT(*) FILTER (WHERE la.created_at >= date_trunc('month', NOW()))::int AS month_count,
              COUNT(*) FILTER (WHERE la.created_at >= NOW() - INTERVAL '7 days')::int AS current_week,
              COUNT(*) FILTER (WHERE la.created_at >= NOW() - INTERVAL '14 days' AND la.created_at < NOW() - INTERVAL '7 days')::int AS previous_week
         FROM crm_lead_activities la
         JOIN crm_customers c ON c.id = la.customer_id AND c.organization_id = $1::uuid
        GROUP BY la.user_id
      ), goals AS (
        SELECT DISTINCT ON (user_id) user_id, year_month, target_nok, target_won_deals, target_meetings_booked
          FROM lead_quota_targets
         WHERE organization_id = $1::uuid
           AND year_month = to_char(NOW(), 'YYYY-MM')
        ORDER BY user_id, year_month DESC
     )
     SELECT m.*, COALESCE(s.leads,0) AS leads, COALESCE(s.won_deals,0) AS won_deals,
            COALESCE(s.won_revenue,0) AS won_revenue, COALESCE(s.recurring_revenue,0) AS recurring_revenue,
            COALESCE(s.pipeline_value,0) AS pipeline_value, COALESCE(a.month_count,0) AS activity_count,
            COALESCE(a.current_week,0) AS current_week, COALESCE(a.previous_week,0) AS previous_week,
            g.year_month, COALESCE(g.target_nok,0) AS target_nok,
            g.target_won_deals, g.target_meetings_booked
       FROM members m
       LEFT JOIN sales s ON s.user_id = m.user_id
       LEFT JOIN activities a ON a.user_id = m.user_id
       LEFT JOIN goals g ON g.user_id = m.user_id
      ORDER BY won_revenue DESC, name`,
    [organizationId],
  );

  return result.rows.map((row) => {
    const previous = num(row.previous_week);
    const current = num(row.current_week);
    const trend = previous === 0 ? (current > 0 ? 100 : 0) : Math.round(((current - previous) / previous) * 100);
    const breakdown = calculateCommission({
      revenueNok: num(row.won_revenue),
      recurringRevenueNok: num(row.recurring_revenue),
      qualifiedActivities: num(row.activity_count),
      activeModels: commission.activeModels.map(String),
      config: commission.config,
    });
    return {
      userId: String(row.user_id),
      name: String(row.name ?? ""),
      email: row.email ? String(row.email) : null,
      role: String(row.role ?? "member"),
      leads: num(row.leads),
      wonDeals: num(row.won_deals),
      wonRevenueNok: num(row.won_revenue),
      pipelineValueNok: num(row.pipeline_value),
      activityTrendPct: Math.max(-999, Math.min(999, trend)),
      commission: breakdown,
      goal: row.year_month ? {
        yearMonth: String(row.year_month),
        targetNok: num(row.target_nok),
        targetWonDeals: row.target_won_deals == null ? null : num(row.target_won_deals),
        targetMeetingsBooked: row.target_meetings_booked == null ? null : num(row.target_meetings_booked),
      } : null,
    };
  });
}

async function requireManager(
  req: Request,
  res: Response,
  deps: Deps,
): Promise<{ session: SessionUser; organizationId: string } | null> {
  const session = deps.requireUserSession(req, res);
  if (!session) return null;
  let organizationId: string;
  try {
    organizationId = await resolveOrgIdForUser(deps.pool, session.userId);
  } catch {
    res.status(403).json({ error: "invalid_or_unavailable_organization" });
    return null;
  }
  if (!UUID_RE.test(organizationId)) {
    res.status(400).json({ error: "organization_required" });
    return null;
  }
  if (!await canManageLeadgridSales(deps.pool, organizationId, session.userId, session.role)) {
    res.status(403).json({ error: "sales_leadership_manage_required" });
    return null;
  }
  return { session, organizationId };
}

async function requireViewer(
  req: Request,
  res: Response,
  deps: Deps,
): Promise<{ session: SessionUser; organizationId: string } | null> {
  const session = deps.requireUserSession(req, res);
  if (!session) return null;
  let organizationId: string;
  try {
    organizationId = await resolveOrgIdForUser(deps.pool, session.userId);
  } catch {
    res.status(403).json({ error: "invalid_or_unavailable_organization" });
    return null;
  }
  if (!UUID_RE.test(organizationId)) {
    res.status(400).json({ error: "organization_required" });
    return null;
  }
  if (!await canViewLeadgridSales(deps.pool, organizationId, session.userId, session.role)) {
    res.status(403).json({ error: "sales_leadership_view_required" });
    return null;
  }
  return { session, organizationId };
}

async function contestById(db: Pool | PoolClient, organizationId: string, id: string) {
  const result = await db.query<Record<string, unknown>>(
    `SELECT c.*,
            COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.rank)
                        FROM sales_contest_prizes p WHERE p.contest_id = c.id), '[]'::jsonb) AS prizes,
            COALESCE((SELECT jsonb_agg(to_jsonb(cp) ORDER BY cp.score DESC)
                        FROM sales_contest_participants cp WHERE cp.contest_id = c.id), '[]'::jsonb) AS participants
       FROM sales_contests c
      WHERE c.organization_id = $1::uuid AND c.id = $2::uuid
      LIMIT 1`,
    [organizationId, id],
  );
  return result.rows[0] ? contestDTO(result.rows[0]) : null;
}

export function registerLeadgridSalesManagementRoutes(deps: Deps): void {
  const { app, pool } = deps;
  startSalesManagementOutboxWorker(pool);

  // The legacy surface remains for older TestFlight builds. Guard it before
  // its route handlers are registered; self-service award actions retain the
  // row-level winner checks in the legacy handler.
  app.use("/api/leadgrid/sales-leadership", async (req, res, next) => {
    const session = deps.requireUserSession(req, res);
    if (!session) return;
    const selfServiceAward =
      (req.method === "GET" && req.path === "/awards" && req.query.org !== "true") ||
      (req.method === "POST" && /^\/awards\/[^/]+\/(advance|shipping-address)$/.test(req.path));
    if (selfServiceAward) return next();
    let organizationId: string;
    try {
      organizationId = await resolveOrgIdForUser(pool, session.userId);
    } catch {
      return res.status(403).json({ error: "invalid_or_unavailable_organization" });
    }
    if (!UUID_RE.test(organizationId)) {
      return res.status(403).json({ error: "organization_required" });
    }
    const allowed = req.method === "GET"
      ? await canViewLeadgridSales(pool, organizationId, session.userId, session.role)
      : await canManageLeadgridSales(pool, organizationId, session.userId, session.role);
    if (!allowed) {
      return res.status(403).json({ error: req.method === "GET" ? "sales_leadership_view_required" : "sales_leadership_manage_required" });
    }
    return next();
  });


  // Preserve seller self-service, but evaluate every manager operation in
  // the active organization rather than trusting the global session role.
  app.use(["/api/leadgrid/approvals", "/api/leadgrid/coaching", "/api/leadgrid/mileage"], async (req, res, next) => {
    const session = deps.requireUserSession(req, res);
    if (!session) return;
    const selfService =
      (req.method === "POST" && req.baseUrl.endsWith("/approvals") && req.path === "/") ||
      (req.method === "POST" && req.baseUrl.endsWith("/mileage") && req.path === "/claims") ||
      (req.method === "GET" && req.baseUrl.endsWith("/mileage") && req.path === "/mine");
    if (selfService) return next();
    let organizationId: string;
    try {
      organizationId = await resolveOrgIdForUser(pool, session.userId);
    } catch {
      return res.status(403).json({ error: "invalid_or_unavailable_organization" });
    }
    if (!UUID_RE.test(organizationId) || !await canManageLeadgridSales(pool, organizationId, session.userId, session.role)) {
      return res.status(403).json({ error: "sales_leadership_manage_required" });
    }
    return next();
  });
  app.get("/api/leadgrid/sales-management/workspace", async (req, res) => {
    const access = await requireViewer(req, res, deps);
    if (!access) return;
    try {
      const canManage = await canManageLeadgridSales(
        pool,
        access.organizationId,
        access.session.userId,
        access.session.role,
      );
      const config = await loadCommissionConfig(pool, access.organizationId);
      const [team, templateRows, prizes, contests, awards, approvals, coaching, mileage, routes] = await Promise.all([
        loadTeam(pool, access.organizationId, config),
        pool.query<Record<string, unknown>>(
          `SELECT template_type, enabled, defaults, updated_at FROM sales_contest_templates WHERE organization_id = $1::uuid`,
          [access.organizationId],
        ),
        pool.query<Record<string, unknown>>(
          `SELECT * FROM sales_prize_catalog WHERE organization_id = $1::uuid AND archived = FALSE ORDER BY created_at DESC`,
          [access.organizationId],
        ),
        loadContests(pool, access.organizationId),
        pool.query<Record<string, unknown>>(
          `SELECT a.*, COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), u.email) AS winner_name
             FROM sales_prize_awards a
             JOIN sales_contests c ON c.id = a.contest_id
             LEFT JOIN users u ON u.id = a.winner_user_id
            WHERE c.organization_id = $1::uuid ORDER BY a.created_at DESC LIMIT 200`,
          [access.organizationId],
        ),
        pool.query<Record<string, unknown>>(
          `SELECT * FROM leadgrid_approvals WHERE organization_id = $1 AND status = 'pending' ORDER BY created_at DESC LIMIT 200`,
          [access.organizationId],
        ),
        pool.query<Record<string, unknown>>(
          `SELECT * FROM leadgrid_coaching_sessions WHERE organization_id = $1 AND status = 'scheduled' ORDER BY scheduled_at LIMIT 200`,
          [access.organizationId],
        ),
        pool.query<Record<string, unknown>>(
          `SELECT * FROM leadgrid_mileage_claims WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 200`,
          [access.organizationId],
        ),
        pool.query<Record<string, unknown>>(
          `SELECT r.id, r.navn, r.stopp, r.status, r.assigned_user_id, r.created_by, r.created_at, r.updated_at,
                  COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), u.email) AS seller_name
             FROM leadgrid_rute_planer r
             LEFT JOIN users u ON u.id = r.assigned_user_id
            WHERE r.organization_id = $1
              AND r.created_at >= date_trunc('day', NOW()) - INTERVAL '1 day'
            ORDER BY r.created_at DESC`,
          [access.organizationId],
        ),
      ]);

      const overrides = new Map(templateRows.rows.map((row) => [String(row.template_type), row]));
      const templates: Array<Record<string, unknown>> = DEFAULT_TEMPLATES.map((template) => {
        const override = overrides.get(template.templateType);
        return {
          ...template,
          enabled: override ? Boolean(override.enabled) : true,
          defaults: obj(override?.defaults),
          updatedAt: iso(override?.updated_at),
        };
      });
      const defaultTypes = new Set<string>(DEFAULT_TEMPLATES.map((template) => template.templateType));
      for (const row of templateRows.rows) {
        const templateType = String(row.template_type);
        if (defaultTypes.has(templateType)) continue;
        const defaults = obj(row.defaults);
        templates.push({
          templateType,
          label: str(defaults.label, templateType.replaceAll("_", " ")),
          description: str(defaults.description, "Egendefinert konkurransemal"),
          defaultKpi: str(defaults.defaultKpi ?? defaults.default_kpi, "closed_revenue"),
          enabled: Boolean(row.enabled),
          defaults,
          updatedAt: iso(row.updated_at),
        });
      }
      const total = (key: string) => team.reduce((sum, member) => sum + num(member[key as keyof typeof member]), 0);
      return res.json({
        organizationId: access.organizationId,
        canManage,
        generatedAt: new Date().toISOString(),
        summary: {
          teamMembers: team.length,
          wonDeals: total("wonDeals"),
          wonRevenueNok: total("wonRevenueNok"),
          pipelineValueNok: total("pipelineValueNok"),
          pendingApprovals: approvals.rows.length,
          scheduledCoaching: coaching.rows.length,
          pendingMileage: mileage.rows.filter((row) => row.status === "pending").length,
          activeContests: contests.filter((contest) => contest.status === "active").length,
          activeRoutes: routes.rows.filter((route) => ["tildelt", "akseptert"].includes(String(route.status))).length,
        },
        commissionConfig: config,
        team,
        templates,
        prizeCatalog: prizes.rows.map(prizeDTO),
        contests,
        awards: awards.rows.map(awardDTO),
        approvals: approvals.rows.map(approvalDTO),
        coaching: coaching.rows.map(coachingDTO),
        mileage: mileage.rows.map(mileageDTO),
        routes: routes.rows.map((row) => ({
          id: String(row.id), name: String(row.navn ?? ""), stops: array(row.stopp),
          status: String(row.status ?? "tildelt"), assignedUserId: row.assigned_user_id ? String(row.assigned_user_id) : null,
          sellerName: row.seller_name ? String(row.seller_name) : null, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at),
        })),
      });
    } catch (error) {
      console.error("[leadgrid-sales-management] workspace failed", error);
      return res.status(500).json({ error: "sales_management_workspace_failed" });
    }
  });

  app.put("/api/leadgrid/sales-management/commission-config", async (req, res) => {
    const access = await requireManager(req, res, deps);
    if (!access) return;
    const body = obj(req.body);
    const preset = str(body.preset, "custom").slice(0, 80);
    const activeModels = array(body.activeModels ?? body.active_models).filter((v): v is string => typeof v === "string").slice(0, 20);
    const config = obj(body.config);
    const saved = await pool.query<Record<string, unknown>>(
      `INSERT INTO sales_commission_configs (organization_id, preset, active_models, config, updated_by, updated_at)
       VALUES ($1::uuid,$2,$3::jsonb,$4::jsonb,$5,NOW())
       ON CONFLICT (organization_id) DO UPDATE SET preset=EXCLUDED.preset, active_models=EXCLUDED.active_models,
         config=EXCLUDED.config, updated_by=EXCLUDED.updated_by, updated_at=NOW()
       RETURNING preset, active_models, config, updated_at`,
      [access.organizationId, preset, JSON.stringify(activeModels), JSON.stringify(config), access.session.userId],
    );
    return res.json({ commissionConfig: commissionConfigDTO(saved.rows[0]) });
  });

  app.put("/api/leadgrid/sales-management/contest-templates/:type", async (req, res) => {
    const access = await requireManager(req, res, deps);
    if (!access) return;
    const type = str(req.params.type).slice(0, 80);
    if (!type) return res.status(400).json({ error: "template_type_required" });
    const body = obj(req.body);
    const saved = await pool.query<Record<string, unknown>>(
      `INSERT INTO sales_contest_templates (organization_id, template_type, enabled, defaults, updated_by, updated_at)
       VALUES ($1::uuid,$2,$3,$4::jsonb,$5,NOW())
       ON CONFLICT (organization_id, template_type) DO UPDATE SET enabled=EXCLUDED.enabled, defaults=EXCLUDED.defaults,
         updated_by=EXCLUDED.updated_by, updated_at=NOW()
       RETURNING template_type, enabled, defaults, updated_at`,
      [access.organizationId, type, body.enabled !== false, JSON.stringify(obj(body.defaults)), access.session.userId],
    );
    const row = saved.rows[0];
    return res.json({ template: { templateType: row.template_type, enabled: row.enabled, defaults: row.defaults, updatedAt: iso(row.updated_at) } });
  });

  app.post("/api/leadgrid/sales-management/prize-catalog", async (req, res) => {
    const access = await requireManager(req, res, deps);
    if (!access) return;
    const body = obj(req.body);
    const title = str(body.title).slice(0, 200);
    if (!title) return res.status(400).json({ error: "title_required" });
    const category = str(body.category, "physical");
    const fulfillmentType = str(body.fulfillmentType ?? body.fulfillment_type, "physical_shipping");
    if (!PRIZE_CATEGORIES.has(category) || !FULFILLMENT_TYPES.has(fulfillmentType)) {
      return res.status(400).json({ error: "invalid_prize_category_or_fulfillment" });
    }
    const key = str(req.header("Idempotency-Key") ?? body.idempotencyKey).slice(0, 200) || crypto.randomUUID();
    const saved = await pool.query<Record<string, unknown>>(
      `INSERT INTO sales_prize_catalog
       (organization_id,title,description,category,estimated_value_nok,fulfillment_type,image_url,image_b2_key,metadata,created_by,idempotency_key)
       VALUES ($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)
       ON CONFLICT (organization_id,idempotency_key) WHERE idempotency_key IS NOT NULL
       DO UPDATE SET updated_at=sales_prize_catalog.updated_at
       RETURNING *, (xmax = 0) AS inserted`,
      [access.organizationId, title, str(body.description).slice(0, 2000), category,
       Math.max(0, Math.round(num(body.estimatedValueNok ?? body.estimated_value_nok))),
       fulfillmentType, str(body.imageUrl ?? body.image_url) || null,
       str(body.imageB2Key ?? body.image_b2_key) || null, JSON.stringify(obj(body.metadata)), access.session.userId, key],
    );
    const inserted = Boolean(saved.rows[0].inserted);
    return res.status(inserted ? 201 : 200).json({ product: prizeDTO(saved.rows[0]), replayed: !inserted });
  });

  app.patch("/api/leadgrid/sales-management/prize-catalog/:id", async (req, res) => {
    const access = await requireManager(req, res, deps);
    if (!access) return;
    if (!UUID_RE.test(str(req.params.id))) return res.status(400).json({ error: "invalid_id" });
    const body = obj(req.body);
    const current = await pool.query<Record<string, unknown>>(
      `SELECT * FROM sales_prize_catalog WHERE id=$1::uuid AND organization_id=$2::uuid`,
      [req.params.id, access.organizationId],
    );
    if (!current.rows[0]) return res.status(404).json({ error: "not_found" });
    const previous = current.rows[0];
    const category = str(body.category, String(previous.category));
    const fulfillmentType = str(body.fulfillmentType, String(previous.fulfillment_type));
    if (!PRIZE_CATEGORIES.has(category) || !FULFILLMENT_TYPES.has(fulfillmentType)) {
      return res.status(400).json({ error: "invalid_prize_category_or_fulfillment" });
    }
    const saved = await pool.query<Record<string, unknown>>(
      `UPDATE sales_prize_catalog SET title=$1, description=$2, category=$3, estimated_value_nok=$4,
         fulfillment_type=$5, image_url=$6, image_b2_key=$7, metadata=$8::jsonb, archived=$9, updated_at=NOW()
       WHERE id=$10::uuid AND organization_id=$11::uuid RETURNING *`,
      [str(body.title, String(previous.title)), str(body.description, String(previous.description)),
       category, Math.max(0, Math.round(num(body.estimatedValueNok ?? previous.estimated_value_nok))),
       fulfillmentType, body.imageUrl === undefined ? previous.image_url : str(body.imageUrl) || null,
       body.imageB2Key === undefined ? previous.image_b2_key : str(body.imageB2Key) || null,
       JSON.stringify(body.metadata === undefined ? obj(previous.metadata) : obj(body.metadata)),
       body.archived === undefined ? Boolean(previous.archived) : Boolean(body.archived), req.params.id, access.organizationId],
    );
    return res.json({ product: prizeDTO(saved.rows[0]) });
  });

  app.delete("/api/leadgrid/sales-management/prize-catalog/:id", async (req, res) => {
    const access = await requireManager(req, res, deps);
    if (!access) return;
    if (!UUID_RE.test(str(req.params.id))) return res.status(400).json({ error: "invalid_id" });
    const result = await pool.query(
      `UPDATE sales_prize_catalog SET archived=TRUE, updated_at=NOW() WHERE id=$1::uuid AND organization_id=$2::uuid`,
      [req.params.id, access.organizationId],
    );
    return result.rowCount ? res.json({ ok: true }) : res.status(404).json({ error: "not_found" });
  });

  app.post("/api/leadgrid/sales-management/contests", async (req, res) => {
    const access = await requireManager(req, res, deps);
    if (!access) return;
    const body = obj(req.body);
    const name = str(body.name).slice(0, 200);
    const kpi = str(body.kpi).slice(0, 80);
    if (!name || !kpi) return res.status(400).json({ error: "name_and_kpi_required" });
    const requestedPrizes = array(body.prizes);
    if (requestedPrizes.length < 1 || requestedPrizes.length > 20) {
      return res.status(400).json({ error: "contest_requires_1_to_20_prizes" });
    }
    const key = str(req.header("Idempotency-Key") ?? body.idempotencyKey).slice(0, 200) || crypto.randomUUID();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const existing = await client.query<Record<string, unknown>>(
        `SELECT id::text FROM sales_contests WHERE organization_id=$1::uuid AND idempotency_key=$2`,
        [access.organizationId, key],
      );
      if (existing.rows[0]) {
        await client.query("COMMIT");
        const contest = await contestById(pool, access.organizationId, String(existing.rows[0].id));
        return res.json({ contest, replayed: true });
      }
      const startsAt = iso(body.startsAt ?? body.starts_at) ?? new Date().toISOString();
      const endsAt = iso(body.endsAt ?? body.ends_at);
      if (endsAt && new Date(endsAt) <= new Date(startsAt)) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "ends_at_must_be_after_starts_at" });
      }
      const created = await client.query<{ id: string }>(
        `INSERT INTO sales_contests
         (organization_id,name,template_type,kpi,kpi_config,status,starts_at,ends_at,created_by,idempotency_key)
         VALUES ($1::uuid,$2,$3,$4,$5::jsonb,'active',$6,$7,$8,$9)
         ON CONFLICT (organization_id,idempotency_key) WHERE idempotency_key IS NOT NULL
         DO NOTHING RETURNING id::text`,
        [access.organizationId, name, str(body.templateType ?? body.template_type, "custom"), kpi,
         JSON.stringify(obj(body.kpiConfig ?? body.kpi_config)), startsAt, endsAt, access.session.userId, key],
      );
      if (!created.rows[0]) {
        await client.query("COMMIT");
        const replay = await pool.query<{ id: string }>(
          `SELECT id::text FROM sales_contests WHERE organization_id=$1::uuid AND idempotency_key=$2`,
          [access.organizationId, key],
        );
        const replayId = replay.rows[0]?.id;
        return replayId
          ? res.json({ contest: await contestById(pool, access.organizationId, replayId), replayed: true })
          : res.status(409).json({ error: "idempotency_conflict" });
      }
      const contestId = created.rows[0].id;
      const seenRanks = new Set<number>();
      for (const [index, item] of requestedPrizes.entries()) {
        const raw = obj(item);
        let snapshot = obj(raw.productSnapshot ?? raw.product_snapshot ?? raw.product);
        const rank = Math.max(1, Math.round(num(raw.rank) || index + 1));
        if (seenRanks.has(rank)) {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: "duplicate_prize_rank" });
        }
        seenRanks.add(rank);
        const requestedProductId = str(snapshot.id);
        let productId: string | null = null;
        if (UUID_RE.test(requestedProductId)) {
          const catalog = await client.query<Record<string, unknown>>(
            `SELECT * FROM sales_prize_catalog
              WHERE id=$1::uuid AND organization_id=$2::uuid AND archived=FALSE`,
            [requestedProductId, access.organizationId],
          );
          if (!catalog.rows[0]) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "prize_not_in_workspace" });
          }
          productId = requestedProductId;
          snapshot = catalog.rows[0];
        }
        const category = str(snapshot.category, "physical");
        const fulfillment = str(snapshot.fulfillmentType ?? snapshot.fulfillment_type, "physical_shipping");
        if (!PRIZE_CATEGORIES.has(category) || !FULFILLMENT_TYPES.has(fulfillment)) {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: "invalid_prize_category_or_fulfillment" });
        }
        await client.query(
          `INSERT INTO sales_contest_prizes
           (contest_id,rank,product_id,product_title,product_category,fulfillment_type,estimated_value_nok,product_snapshot)
           VALUES ($1::uuid,$2,$3::uuid,$4,$5,$6,$7,$8::jsonb)`,
          [contestId, rank, productId, str(snapshot.title ?? snapshot.name, `Premie ${rank}`),
           category, fulfillment,
           Math.max(0, Math.round(num(snapshot.estimatedValueNok ?? snapshot.estimated_value_nok ?? snapshot.priceNok))), JSON.stringify(snapshot)],
        );
      }
      await refreshContestParticipants(client, access.organizationId, contestId);
      await client.query("COMMIT");
      return res.status(201).json({ contest: await contestById(pool, access.organizationId, contestId), replayed: false });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      console.error("[leadgrid-sales-management] contest create failed", error);
      return res.status(500).json({ error: "contest_create_failed" });
    } finally {
      client.release();
    }
  });

  app.post("/api/leadgrid/sales-management/contests/:id/refresh", async (req, res) => {
    const access = await requireManager(req, res, deps);
    if (!access) return;
    if (!UUID_RE.test(str(req.params.id))) return res.status(400).json({ error: "invalid_id" });
    try {
      const participantsUpdated = await refreshContestParticipants(pool, access.organizationId, req.params.id);
      return res.json({ contest: await contestById(pool, access.organizationId, req.params.id), participantsUpdated });
    } catch (error) {
      if (error instanceof Error && error.message === "contest_not_found") return res.status(404).json({ error: "not_found" });
      throw error;
    }
  });

  app.post("/api/leadgrid/sales-management/contests/:id/close", async (req, res) => {
    const access = await requireManager(req, res, deps);
    if (!access) return;
    const id = str(req.params.id);
    if (!UUID_RE.test(id)) return res.status(400).json({ error: "invalid_id" });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const locked = await client.query<Record<string, unknown>>(
        `SELECT id, name, status FROM sales_contests WHERE id=$1::uuid AND organization_id=$2::uuid FOR UPDATE`,
        [id, access.organizationId],
      );
      if (!locked.rows[0]) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "not_found" });
      }
      if (locked.rows[0].status !== "active") {
        await client.query("COMMIT");
        return res.json({ contest: await contestById(pool, access.organizationId, id), replayed: true });
      }
      await refreshContestParticipants(client, access.organizationId, id);
      const prizes = await client.query<Record<string, unknown>>(
        `SELECT * FROM sales_contest_prizes WHERE contest_id=$1::uuid ORDER BY rank`, [id],
      );
      const winners = await client.query<Record<string, unknown>>(
        `SELECT * FROM sales_contest_participants WHERE contest_id=$1::uuid ORDER BY score DESC, user_id LIMIT $2`,
        [id, prizes.rows.length],
      );
      for (let index = 0; index < winners.rows.length; index += 1) {
        const winner = winners.rows[index];
        const prize = prizes.rows[index];
        if (!prize) break;
        const rank = index + 1;
        await client.query(
          `UPDATE sales_contest_participants SET rank=$1, snapshot_at=NOW() WHERE contest_id=$2::uuid AND user_id=$3`,
          [rank, id, winner.user_id],
        );
        const status = prize.fulfillment_type === "physical_shipping" ? "awaiting_address" : "pending";
        const award = await client.query<{ id: string }>(
          `INSERT INTO sales_prize_awards
           (contest_id,prize_id,winner_user_id,rank,product_title,product_category,fulfillment_type,status,idempotency_key)
           VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (contest_id,idempotency_key) WHERE idempotency_key IS NOT NULL
           DO UPDATE SET updated_at=NOW() RETURNING id::text`,
          [id, prize.id, winner.user_id, rank, prize.product_title, prize.product_category, prize.fulfillment_type, status, `rank:${rank}`],
        );
        await enqueueSalesManagementEvent(client, {
          organizationId: access.organizationId,
          eventType: "sales_prize_awarded",
          aggregateType: "award",
          aggregateId: award.rows[0].id,
          recipientUserId: String(winner.user_id),
          actorUserId: access.session.userId,
          title: `Du vant ${String(prize.product_title)}`,
          body: `Konkurransen «${String(locked.rows[0].name)}» er avsluttet. Premien din er registrert.`,
          deepLink: "leadgrid://salgsledelse/premier",
        });
      }
      await client.query(
        `UPDATE sales_contests SET status='ended', closed_at=NOW(), closed_by=$1, updated_at=NOW() WHERE id=$2::uuid`,
        [access.session.userId, id],
      );
      await client.query("COMMIT");
      return res.json({ contest: await contestById(pool, access.organizationId, id), replayed: false });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      console.error("[leadgrid-sales-management] contest close failed", error);
      return res.status(500).json({ error: "contest_close_failed" });
    } finally {
      client.release();
    }
  });

  app.delete("/api/leadgrid/sales-management/contests/:id", async (req, res) => {
    const access = await requireManager(req, res, deps);
    if (!access) return;
    if (!UUID_RE.test(str(req.params.id))) return res.status(400).json({ error: "invalid_id" });
    const result = await pool.query(
      `UPDATE sales_contests SET status='archived',updated_at=NOW() WHERE id=$1::uuid AND organization_id=$2::uuid`,
      [req.params.id, access.organizationId],
    );
    return result.rowCount ? res.json({ ok: true }) : res.status(404).json({ error: "not_found" });
  });

  app.put("/api/leadgrid/sales-management/goals/:userId/:yearMonth", async (req, res) => {
    const access = await requireManager(req, res, deps);
    if (!access) return;
    const yearMonth = str(req.params.yearMonth);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(yearMonth)) return res.status(400).json({ error: "invalid_year_month" });
    const member = await pool.query(
      `SELECT 1 FROM organization_members WHERE organization_id=$1::uuid AND user_id=$2`,
      [access.organizationId, req.params.userId],
    );
    if (!member.rowCount) return res.status(404).json({ error: "member_not_found" });
    const body = obj(req.body);
    const saved = await pool.query<Record<string, unknown>>(
      `INSERT INTO lead_quota_targets
       (organization_id,user_id,year_month,target_nok,target_won_deals,target_meetings_booked,set_by_user_id)
       VALUES ($1::uuid,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (organization_id,user_id,year_month) DO UPDATE SET target_nok=EXCLUDED.target_nok,
         target_won_deals=EXCLUDED.target_won_deals,target_meetings_booked=EXCLUDED.target_meetings_booked,
         set_by_user_id=EXCLUDED.set_by_user_id,updated_at=NOW() RETURNING *`,
      [access.organizationId, req.params.userId, yearMonth, Math.max(0, num(body.targetNok)),
       body.targetWonDeals == null ? null : Math.max(0, Math.round(num(body.targetWonDeals))),
       body.targetMeetingsBooked == null ? null : Math.max(0, Math.round(num(body.targetMeetingsBooked))), access.session.userId],
    );
    return res.json({ goal: saved.rows[0] });
  });

  app.post("/api/leadgrid/sales-management/approvals", async (req, res) => {
    const session = deps.requireUserSession(req, res);
    if (!session) return;
    let organizationId: string;
    try {
      organizationId = await resolveOrgIdForUser(pool, session.userId);
    } catch {
      return res.status(403).json({ error: "invalid_or_unavailable_organization" });
    }
    if (!UUID_RE.test(organizationId)) return res.status(400).json({ error: "organization_required" });
    const body = obj(req.body);
    const title = str(body.title).slice(0, 255);
    if (!title) return res.status(400).json({ error: "title_required" });
    const key = str(req.header("Idempotency-Key") ?? body.idempotencyKey).slice(0, 200) || crypto.randomUUID();
    const kind = APPROVAL_KINDS.has(str(body.kind)) ? str(body.kind) : "deal";
    const saved = await pool.query<Record<string, unknown>>(
      `INSERT INTO leadgrid_approvals
       (organization_id,kind,title,seller_user_id,seller_name,customer_name,amount_nok,rationale,status,idempotency_key,source_type,source_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9,$10,$11)
       ON CONFLICT (organization_id,idempotency_key) WHERE idempotency_key IS NOT NULL
       DO UPDATE SET updated_at=leadgrid_approvals.updated_at
       RETURNING *, (xmax = 0) AS inserted`,
      [organizationId, kind, title, session.userId, session.name || null, str(body.customerName).slice(0, 255) || null,
       Math.max(0, num(body.amountNok)), str(body.rationale).slice(0, 2000) || null, key,
       str(body.sourceType).slice(0, 40) || null, str(body.sourceId).slice(0, 255) || null],
    );
    const inserted = Boolean(saved.rows[0].inserted);
    return res.status(inserted ? 201 : 200).json({ approval: approvalDTO(saved.rows[0]), replayed: !inserted });
  });

  app.post("/api/leadgrid/sales-management/approvals/:id/decision", async (req, res) => {
    const access = await requireManager(req, res, deps);
    if (!access) return;
    const body = obj(req.body);
    const status = body.approve === true ? "approved" : body.approve === false ? "rejected" : str(body.status);
    if (!APPROVAL_STATUSES.has(status)) return res.status(400).json({ error: "invalid_decision" });
    const approvalId = Number(req.params.id);
    if (!Number.isSafeInteger(approvalId) || approvalId <= 0) return res.status(400).json({ error: "invalid_id" });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const updated = await client.query<Record<string, unknown>>(
        `UPDATE leadgrid_approvals SET status=$1,decided_by=$2,decided_at=NOW(),comment=$3,updated_at=NOW()
         WHERE id=$4 AND organization_id=$5 AND status='pending' RETURNING *`,
        [status, access.session.userId, str(body.comment).slice(0, 2000) || null, approvalId, access.organizationId],
      );
      if (!updated.rows[0]) {
        const existing = await client.query<Record<string, unknown>>(
          `SELECT * FROM leadgrid_approvals WHERE id=$1 AND organization_id=$2`,
          [approvalId, access.organizationId],
        );
        await client.query("ROLLBACK");
        if (existing.rows[0] && existing.rows[0].status === status) {
          return res.json({ approval: approvalDTO(existing.rows[0]), replayed: true });
        }
        return res.status(409).json({ error: "not_found_or_already_decided" });
      }
      const approval = updated.rows[0];
      if (approval.seller_user_id) {
        await enqueueSalesManagementEvent(client, {
          organizationId: access.organizationId, eventType: "sales_approval_decided", aggregateType: "approval",
          aggregateId: String(approval.id), recipientUserId: String(approval.seller_user_id), actorUserId: access.session.userId,
          title: status === "approved" ? "Godkjenning innvilget" : "Godkjenning avslått",
          body: `${String(approval.title)} er ${status === "approved" ? "godkjent" : "avslått"}.`,
          deepLink: "leadgrid://salgsledelse/godkjenninger",
        });
      }
      await client.query("COMMIT");
      return res.json({ approval: approvalDTO(approval) });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      return res.status(500).json({ error: "approval_decision_failed" });
    } finally { client.release(); }
  });

  app.post("/api/leadgrid/sales-management/coaching", async (req, res) => {
    const access = await requireManager(req, res, deps);
    if (!access) return;
    const body = obj(req.body);
    const memberName = str(body.memberName).slice(0, 255);
    const scheduledAt = iso(body.scheduledAt);
    if (!memberName || !scheduledAt) return res.status(400).json({ error: "member_and_scheduled_at_required" });
    const key = str(req.header("Idempotency-Key") ?? body.idempotencyKey).slice(0, 200) || crypto.randomUUID();
    const userId = str(body.memberUserId) || null;
    if (userId) {
      const member = await pool.query(`SELECT 1 FROM organization_members WHERE organization_id=$1::uuid AND user_id=$2`, [access.organizationId, userId]);
      if (!member.rowCount) return res.status(404).json({ error: "member_not_found" });
    }
    const saved = await pool.query<Record<string, unknown>>(
      `INSERT INTO leadgrid_coaching_sessions
       (organization_id,member_user_id,member_name,scheduled_at,focus,status,created_by,idempotency_key)
       VALUES ($1,$2,$3,$4,$5,'scheduled',$6,$7)
       ON CONFLICT (organization_id,idempotency_key) WHERE idempotency_key IS NOT NULL
       DO UPDATE SET updated_at=leadgrid_coaching_sessions.updated_at
       RETURNING *, (xmax = 0) AS inserted`,
      [access.organizationId, userId, memberName, scheduledAt, str(body.focus).slice(0, 500) || null, access.session.userId, key],
    );
    const inserted = Boolean(saved.rows[0].inserted);
    return res.status(inserted ? 201 : 200).json({ session: coachingDTO(saved.rows[0]), replayed: !inserted });
  });

  app.patch("/api/leadgrid/sales-management/coaching/:id/status", async (req, res) => {
    const access = await requireManager(req, res, deps);
    if (!access) return;
    const status = str(obj(req.body).status);
    if (!COACHING_STATUSES.has(status)) return res.status(400).json({ error: "invalid_status" });
    const coachingId = Number(req.params.id);
    if (!Number.isSafeInteger(coachingId) || coachingId <= 0) return res.status(400).json({ error: "invalid_id" });
    const saved = await pool.query<Record<string, unknown>>(
      `UPDATE leadgrid_coaching_sessions SET status=$1,updated_at=NOW() WHERE id=$2 AND organization_id=$3 RETURNING *`,
      [status, coachingId, access.organizationId],
    );
    return saved.rows[0] ? res.json({ session: coachingDTO(saved.rows[0]) }) : res.status(404).json({ error: "not_found" });
  });

  app.post("/api/leadgrid/sales-management/mileage", async (req, res) => {
    const session = deps.requireUserSession(req, res);
    if (!session) return;
    let organizationId: string;
    try {
      organizationId = await resolveOrgIdForUser(pool, session.userId);
    } catch {
      return res.status(403).json({ error: "invalid_or_unavailable_organization" });
    }
    if (!UUID_RE.test(organizationId)) return res.status(400).json({ error: "organization_required" });
    const body = obj(req.body);
    const km = num(body.km);
    if (km <= 0 || km > 5_000) return res.status(400).json({ error: "invalid_km" });
    const tripDate = iso(body.tripDate)?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
    const key = str(req.header("Idempotency-Key") ?? body.idempotencyKey).slice(0, 200) || crypto.randomUUID();
    const rate = TAX_FREE_MILEAGE_RATE_2026;
    const amount = Math.round(km * rate * 100) / 100;
    const saved = await pool.query<Record<string, unknown>>(
      `INSERT INTO leadgrid_mileage_claims
       (organization_id,seller_user_id,seller_name,trip_date,route_text,km,rate_nok_per_km,amount_nok,status,note,idempotency_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9,$10)
       ON CONFLICT (organization_id,idempotency_key) WHERE idempotency_key IS NOT NULL
       DO UPDATE SET updated_at=leadgrid_mileage_claims.updated_at
       RETURNING *, (xmax = 0) AS inserted`,
      [organizationId, session.userId, session.name || null, tripDate, str(body.routeText).slice(0, 500) || null,
       km, rate, amount, str(body.note).slice(0, 1000) || null, key],
    );
    const inserted = Boolean(saved.rows[0].inserted);
    return res.status(inserted ? 201 : 200).json({ claim: mileageDTO(saved.rows[0]), replayed: !inserted });
  });

  app.post("/api/leadgrid/sales-management/mileage/:id/status", async (req, res) => {
    const access = await requireManager(req, res, deps);
    if (!access) return;
    const status = str(obj(req.body).status);
    if (!MILEAGE_STATUSES.has(status)) return res.status(400).json({ error: "invalid_status" });
    const claimId = Number(req.params.id);
    if (!Number.isSafeInteger(claimId) || claimId <= 0) return res.status(400).json({ error: "invalid_id" });
    const saved = await pool.query<Record<string, unknown>>(
      `UPDATE leadgrid_mileage_claims SET status=$1, approved_by=CASE WHEN $1='approved' THEN $2 ELSE approved_by END,
         approved_at=CASE WHEN $1='approved' THEN COALESCE(approved_at,NOW()) ELSE approved_at END, updated_at=NOW()
       WHERE id=$3 AND organization_id=$4 AND
         (($1 IN ('approved','rejected') AND status='pending') OR ($1='paid' AND status='approved')) RETURNING *`,
      [status, access.session.userId, claimId, access.organizationId],
    );
    if (saved.rows[0]) return res.json({ claim: mileageDTO(saved.rows[0]), replayed: false });
    const existing = await pool.query<Record<string, unknown>>(
      `SELECT * FROM leadgrid_mileage_claims WHERE id=$1 AND organization_id=$2`,
      [claimId, access.organizationId],
    );
    if (existing.rows[0] && existing.rows[0].status === status) {
      return res.json({ claim: mileageDTO(existing.rows[0]), replayed: true });
    }
    return res.status(409).json({ error: "invalid_transition_or_not_found" });
  });

  app.post("/api/leadgrid/sales-management/awards/:id/status", async (req, res) => {
    const access = await requireManager(req, res, deps);
    if (!access) return;
    const body = obj(req.body);
    const target = str(body.status);
    if (!AWARD_STATUSES.includes(target as typeof AWARD_STATUSES[number])) return res.status(400).json({ error: "invalid_status" });
    if (!UUID_RE.test(str(req.params.id))) return res.status(400).json({ error: "invalid_id" });
    const current = await pool.query<Record<string, unknown>>(
      `SELECT a.*,c.organization_id FROM sales_prize_awards a JOIN sales_contests c ON c.id=a.contest_id
       WHERE a.id=$1::uuid AND c.organization_id=$2::uuid`, [req.params.id, access.organizationId],
    );
    if (!current.rows[0]) return res.status(404).json({ error: "not_found" });
    if (current.rows[0].status === target) {
      return res.json({ award: awardDTO(current.rows[0]), replayed: true });
    }
    const currentStatus = String(current.rows[0].status);
    if (!isAllowedAwardTransition(currentStatus, target)) {
      return res.status(409).json({ error: "invalid_status_transition" });
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const saved = await client.query<Record<string, unknown>>(
        `UPDATE sales_prize_awards SET status=$1,tracking_number=COALESCE($2,tracking_number),notes=COALESCE($3,notes),
           ordered_at=CASE WHEN $1='ordered' THEN COALESCE(ordered_at,NOW()) ELSE ordered_at END,
           shipped_at=CASE WHEN $1='shipped' THEN COALESCE(shipped_at,NOW()) ELSE shipped_at END,
           received_at=CASE WHEN $1='received' THEN COALESCE(received_at,NOW()) ELSE received_at END,updated_at=NOW()
         WHERE id=$4::uuid AND status=$5 RETURNING *`,
        [target, str(body.trackingNumber) || null, str(body.notes) || null, req.params.id, currentStatus],
      );
      if (!saved.rows[0]) {
        const existing = await client.query<Record<string, unknown>>(
          `SELECT a.* FROM sales_prize_awards a
            JOIN sales_contests c ON c.id=a.contest_id
           WHERE a.id=$1::uuid AND c.organization_id=$2::uuid`,
          [req.params.id, access.organizationId],
        );
        await client.query("ROLLBACK");
        if (existing.rows[0] && existing.rows[0].status === target) {
          return res.json({ award: awardDTO(existing.rows[0]), replayed: true });
        }
        return res.status(409).json({ error: "concurrent_status_change" });
      }
      const award = saved.rows[0];
      await enqueueSalesManagementEvent(client, {
        organizationId: access.organizationId, eventType: `sales_prize_${target}`.slice(0, 40), aggregateType: "award_status",
        aggregateId: `${String(award.id)}:${target}`, recipientUserId: String(award.winner_user_id), actorUserId: access.session.userId,
        title: `Premie: ${String(award.product_title)}`, body: `Status er oppdatert til ${target}.`, deepLink: "leadgrid://salgsledelse/premier",
      });
      await client.query("COMMIT");
      return res.json({ award: awardDTO(award) });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      return res.status(500).json({ error: "award_status_failed" });
    } finally { client.release(); }
  });
}
