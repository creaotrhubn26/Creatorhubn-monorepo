/**
 * leadgrid-analytics-routes.ts
 *
 * 7 endepunkter for Leadgrid Analytics Dashboard. Alle gated via
 * requireLeadMapPermission (migrate 317 seeder permissions).
 *
 *   GET /api/leadgrid/analytics/overview          (analytics.view_overview)
 *   GET /api/leadgrid/analytics/channels          (analytics.view_channels)
 *   GET /api/leadgrid/analytics/sources           (analytics.view_sources)
 *   GET /api/leadgrid/analytics/segments?by=...   (analytics.view_segments)
 *   GET /api/leadgrid/analytics/territories       (analytics.view_segments)
 *   GET /api/leadgrid/analytics/velocity-history  (analytics.view_velocity)
 *   GET /api/leadgrid/analytics/conversion-funnel (analytics.view_overview)
 *
 * Org-resolve: ?organization_id=... > body.organization_id > brukerens
 * default-org (organization_members, admin/salgssjef-prio). Matcher mønster
 * fra leadgrid-research-routes.ts og leadgrid-market-scan-routes.ts.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";
import {
  computeOrgAnalyticsOverview,
  computeChannelPerformance,
  computeSourcePerformance,
  computeSegmentPerformance,
  computeTerritoryPerformance,
  computeVelocityHistory,
  computeConversionFunnel,
  type SegmentDimension,
} from "./leadgrid-analytics-service.js";

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

async function resolveOrgIdSmart(
  req: Request,
  pool: Pool,
  userId: string,
): Promise<string | null> {
  const explicit =
    (req.query && (req.query as Record<string, unknown>).organization_id) ??
    (req.body && (req.body as Record<string, unknown>).organization_id);
  if (typeof explicit === "string" && explicit.length > 0) return explicit;
  try {
    const r = await pool.query<{ organization_id: string }>(
      `SELECT organization_id::text
         FROM organization_members
        WHERE user_id = $1
        ORDER BY CASE role
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

function parseSinceDays(q: unknown, fallback: number): number {
  const n = Number(q);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  // Clamp så vi ikke kjører generate_series på ~10 år
  return Math.min(Math.max(Math.floor(n), 1), 730);
}

export function registerLeadgridAnalyticsRoutes(deps: Deps): void {
  const { app, pool, activeSessions } = deps;
  const common = { pool, activeSessions, resolveOrgId: resolveOrgIdSmart };

  const permOverview = requireLeadMapPermission("analytics.view_overview", common);
  const permChannels = requireLeadMapPermission("analytics.view_channels", common);
  const permSources = requireLeadMapPermission("analytics.view_sources", common);
  const permSegments = requireLeadMapPermission("analytics.view_segments", common);
  const permVelocity = requireLeadMapPermission("analytics.view_velocity", common);

  // ───────────────────────────────────────────────────────────────────
  // GET /api/leadgrid/analytics/overview?sinceDays=90&organization_id=...
  // ───────────────────────────────────────────────────────────────────
  app.get("/api/leadgrid/analytics/overview", permOverview, async (req: Request, res: Response) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "Innlogging kreves" });
    const orgId = await resolveOrgIdSmart(req, pool, session.userId);
    if (!orgId) return res.status(400).json({ error: "mangler_organization_id" });
    const sinceDays = parseSinceDays(req.query.sinceDays, 90);
    try {
      const overview = await computeOrgAnalyticsOverview(pool, orgId, sinceDays);
      return res.json({ organization_id: orgId, sinceDays, overview });
    } catch (err) {
      console.error("[leadgrid/analytics/overview] failed", err);
      return res.status(500).json({ error: "overview_failed", detail: String(err) });
    }
  });

  // ───────────────────────────────────────────────────────────────────
  // GET /api/leadgrid/analytics/channels?sinceDays=90
  // ───────────────────────────────────────────────────────────────────
  app.get("/api/leadgrid/analytics/channels", permChannels, async (req: Request, res: Response) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "Innlogging kreves" });
    const orgId = await resolveOrgIdSmart(req, pool, session.userId);
    if (!orgId) return res.status(400).json({ error: "mangler_organization_id" });
    const sinceDays = parseSinceDays(req.query.sinceDays, 90);
    try {
      const channels = await computeChannelPerformance(pool, orgId, sinceDays);
      return res.json({ organization_id: orgId, sinceDays, channels });
    } catch (err) {
      console.error("[leadgrid/analytics/channels] failed", err);
      return res.status(500).json({ error: "channels_failed", detail: String(err) });
    }
  });

  // ───────────────────────────────────────────────────────────────────
  // GET /api/leadgrid/analytics/sources
  // ───────────────────────────────────────────────────────────────────
  app.get("/api/leadgrid/analytics/sources", permSources, async (req: Request, res: Response) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "Innlogging kreves" });
    const orgId = await resolveOrgIdSmart(req, pool, session.userId);
    if (!orgId) return res.status(400).json({ error: "mangler_organization_id" });
    try {
      const sources = await computeSourcePerformance(pool, orgId);
      return res.json({ organization_id: orgId, sources });
    } catch (err) {
      console.error("[leadgrid/analytics/sources] failed", err);
      return res.status(500).json({ error: "sources_failed", detail: String(err) });
    }
  });

  // ───────────────────────────────────────────────────────────────────
  // GET /api/leadgrid/analytics/segments?by=category|city|lead_status
  // ───────────────────────────────────────────────────────────────────
  const VALID_DIMS: SegmentDimension[] = ["category", "city", "lead_status"];
  app.get("/api/leadgrid/analytics/segments", permSegments, async (req: Request, res: Response) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "Innlogging kreves" });
    const orgId = await resolveOrgIdSmart(req, pool, session.userId);
    if (!orgId) return res.status(400).json({ error: "mangler_organization_id" });
    const by = (typeof req.query.by === "string" ? req.query.by : "category") as SegmentDimension;
    if (!VALID_DIMS.includes(by)) {
      return res.status(400).json({ error: "ugyldig_by", valid: VALID_DIMS });
    }
    try {
      const segments = await computeSegmentPerformance(pool, orgId, by);
      return res.json({ organization_id: orgId, by, segments });
    } catch (err) {
      console.error("[leadgrid/analytics/segments] failed", err);
      return res.status(500).json({ error: "segments_failed", detail: String(err) });
    }
  });

  // ───────────────────────────────────────────────────────────────────
  // GET /api/leadgrid/analytics/territories
  // ───────────────────────────────────────────────────────────────────
  app.get("/api/leadgrid/analytics/territories", permSegments, async (req: Request, res: Response) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "Innlogging kreves" });
    const orgId = await resolveOrgIdSmart(req, pool, session.userId);
    if (!orgId) return res.status(400).json({ error: "mangler_organization_id" });
    try {
      const territories = await computeTerritoryPerformance(pool, orgId);
      return res.json({ organization_id: orgId, territories });
    } catch (err) {
      console.error("[leadgrid/analytics/territories] failed", err);
      return res.status(500).json({ error: "territories_failed", detail: String(err) });
    }
  });

  // ───────────────────────────────────────────────────────────────────
  // GET /api/leadgrid/analytics/velocity-history?days=90
  // ───────────────────────────────────────────────────────────────────
  app.get("/api/leadgrid/analytics/velocity-history", permVelocity, async (req: Request, res: Response) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "Innlogging kreves" });
    const orgId = await resolveOrgIdSmart(req, pool, session.userId);
    if (!orgId) return res.status(400).json({ error: "mangler_organization_id" });
    const days = parseSinceDays(req.query.days, 90);
    try {
      const history = await computeVelocityHistory(pool, orgId, days);
      return res.json({ organization_id: orgId, days, history });
    } catch (err) {
      console.error("[leadgrid/analytics/velocity-history] failed", err);
      return res.status(500).json({ error: "velocity_failed", detail: String(err) });
    }
  });

  // ───────────────────────────────────────────────────────────────────
  // GET /api/leadgrid/analytics/conversion-funnel
  // ───────────────────────────────────────────────────────────────────
  app.get("/api/leadgrid/analytics/conversion-funnel", permOverview, async (req: Request, res: Response) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "Innlogging kreves" });
    const orgId = await resolveOrgIdSmart(req, pool, session.userId);
    if (!orgId) return res.status(400).json({ error: "mangler_organization_id" });
    try {
      const funnel = await computeConversionFunnel(pool, orgId);
      return res.json({ organization_id: orgId, funnel });
    } catch (err) {
      console.error("[leadgrid/analytics/conversion-funnel] failed", err);
      return res.status(500).json({ error: "funnel_failed", detail: String(err) });
    }
  });
}
