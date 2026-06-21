/**
 * market-scans-superadmin-routes.ts
 *
 * GET-endepunkter for iPad SuperAdminMarketScansView:
 *   GET /api/market-scans                            — liste alle scans
 *   GET /api/market-scans/:scanId/competitors        — competitors per scan
 *   GET /api/market-scans/:scanId/opportunities      — opportunities per scan
 *
 * Tabellene fra migrate 275 (market_intelligence).
 *
 * Response-shape matcher iPad-Codable MarketScansResponse /
 * MarketScanCompetitorsResponse / MarketScanOpportunitiesResponse.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

function getSession(req: Request, sessions: Map<string, SessionData>): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return sessions.get(auth.slice(7).trim()) ?? null;
  const t = (req as Request & { cookies?: Record<string, string> }).cookies?.sessionToken;
  return t ? sessions.get(t) ?? null : null;
}

async function requireSuperAdmin(
  req: Request, res: Response,
  pool: Pool, activeSessions: Map<string, SessionData>,
): Promise<SessionData | null> {
  const s = getSession(req, activeSessions);
  if (!s) { res.status(401).json({ error: "Innlogging kreves" }); return null; }
  const u = await pool.query<{ role: string }>(
    `SELECT role FROM users WHERE id = $1`, [s.userId],
  );
  if (u.rows[0]?.role !== "super_admin") {
    res.status(403).json({ error: "Krever super-admin" });
    return null;
  }
  return s;
}

export function setupMarketScansSuperAdminRoutes(deps: Deps): void {
  const { app, pool, activeSessions } = deps;

  // ── GET /api/market-scans ──────────────────────────────────────────
  app.get("/api/market-scans", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    try {
      const r = await pool.query(
        `SELECT
            id::text,
            name,
            industry,
            region,
            status,
            created_at::text  AS "createdAt",
            completed_at::text AS "completedAt",
            total_competitors  AS "competitorCount",
            total_opportunities AS "opportunityCount"
           FROM market_scans
          ORDER BY created_at DESC
          LIMIT 200`,
      );
      return res.json({ scans: r.rows });
    } catch (err) {
      // Tabell finnes ikke i alle miljøer → degrader til tom liste.
      if ((err as { code?: string }).code === "42P01") {
        return res.json({ scans: [] });
      }
      console.error("[market-scans GET]", err);
      return res.status(500).json({ error: "scans_failed" });
    }
  });

  // ── GET /api/market-scans/:scanId/competitors ──────────────────────
  app.get("/api/market-scans/:scanId/competitors", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    try {
      const r = await pool.query(
        `SELECT
            id::text,
            name,
            domain AS url,
            confidence AS "threatLevel",
            positioning AS "positioningSummary"
           FROM market_scan_competitors
          WHERE market_scan_id = $1::uuid
          ORDER BY name
          LIMIT 500`,
        [req.params.scanId],
      );
      return res.json({ competitors: r.rows });
    } catch (err) {
      if ((err as { code?: string }).code === "42P01") {
        return res.json({ competitors: [] });
      }
      console.error("[market-scans competitors GET]", err);
      return res.status(500).json({ error: "competitors_failed" });
    }
  });

  // ── GET /api/lead-map/campaigns ────────────────────────────────────
  // iPad SuperAdminCampaignsView. Fra lead_map_campaigns (mig 278).
  app.get("/api/lead-map/campaigns", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    try {
      const r = await pool.query(
        `SELECT
            id::text,
            name,
            status,
            'lead_map'::text AS platform,
            0::float8 AS "totalSpendNok",
            0 AS "totalImpressions",
            0 AS "totalClicks",
            target_total_leads AS "totalLeads",
            NULL::float8 AS cpa,
            NULL::float8 AS "conversionRate",
            started_at::text AS "startedAt",
            completed_at::text AS "endedAt"
           FROM lead_map_campaigns
          ORDER BY updated_at DESC
          LIMIT 200`,
      );
      return res.json({ campaigns: r.rows });
    } catch (err) {
      if ((err as { code?: string }).code === "42P01") {
        return res.json({ campaigns: [] });
      }
      console.error("[lead-map/campaigns]", err);
      return res.status(500).json({ error: "campaigns_failed" });
    }
  });

  // ── GET /api/lead-map/analytics/category-conversion ────────────────
  // Aggregert konvertering per kategori (crm_customers.category).
  app.get("/api/lead-map/analytics/category-conversion", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    try {
      const r = await pool.query<{
        category: string;
        leads: string;
        won: string;
      }>(
        `SELECT
            COALESCE(lead_category, 'ukategorisert') AS category,
            COUNT(*)::text AS leads,
            COUNT(*) FILTER (WHERE lead_status = 'won')::text AS won
           FROM crm_customers
          GROUP BY lead_category
          ORDER BY COUNT(*) DESC
          LIMIT 50`,
      );
      const categories = r.rows.map((row) => {
        const leads = Number(row.leads) || 0;
        const won = Number(row.won) || 0;
        return {
          category: row.category,
          leads,
          won,
          conversionPct: leads > 0 ? (won / leads) * 100 : 0,
        };
      });
      return res.json({ categories });
    } catch (err) {
      if ((err as { code?: string }).code === "42P01") {
        return res.json({ categories: [] });
      }
      console.error("[lead-map/category-conversion]", err);
      return res.status(500).json({ error: "category_conversion_failed" });
    }
  });

  // ── GET /api/admin/b2-archive/usage + /role-room-variant ──────────
  // iPad SuperAdminB2ArchiveView. Returnerer aggregert bucket-bruk hentet
  // fra file-tellinger i Postgres (vi har ikke B2-stat-API i prosjektet).
  const buildB2UsageHandler = (bucketKind: "creatorhub" | "role_room") =>
    async (req: Request, res: Response) => {
      const s = await requireSuperAdmin(req, res, pool, activeSessions);
      if (!s) return;
      // Best-effort: tell rader i b2_archive_log hvis tabellen finnes.
      try {
        const tableR = await pool.query<{ count: string }>(
          `SELECT to_regclass('public.b2_archive_log') IS NOT NULL AS exists`,
        );
        const exists = (tableR.rows[0] as unknown as { exists: boolean }).exists;
        if (!exists) {
          return res.json({
            bucketName: bucketKind === "role_room"
              ? "the-role-room-prod" : "creatorhub-prod",
            totalBytes: 0,
            fileCount: 0,
            lastChangeAt: null,
          });
        }
        const r = await pool.query<{
          count: string; total_bytes: string; last_at: string | null;
        }>(
          `SELECT COUNT(*)::text AS count,
                  COALESCE(SUM(size_bytes), 0)::text AS total_bytes,
                  MAX(created_at)::text AS last_at
             FROM b2_archive_log
            WHERE bucket_kind = $1`,
          [bucketKind],
        );
        return res.json({
          bucketName: bucketKind === "role_room"
            ? "the-role-room-prod" : "creatorhub-prod",
          totalBytes: Number(r.rows[0]?.total_bytes ?? 0),
          fileCount: Number(r.rows[0]?.count ?? 0),
          lastChangeAt: r.rows[0]?.last_at,
        });
      } catch (err) {
        console.error("[b2-archive usage]", err);
        return res.json({
          bucketName: bucketKind === "role_room"
            ? "the-role-room-prod" : "creatorhub-prod",
          totalBytes: 0,
          fileCount: 0,
          lastChangeAt: null,
        });
      }
    };
  app.get("/api/admin/b2-archive/usage", buildB2UsageHandler("creatorhub"));
  app.get("/api/role-room/admin/b2-archive/usage", buildB2UsageHandler("role_room"));

  // ── GET /api/market-scans/:scanId/opportunities ────────────────────
  app.get("/api/market-scans/:scanId/opportunities", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    try {
      const r = await pool.query(
        `SELECT
            id::text,
            title,
            simple_summary AS description,
            impact AS priority,
            'open'::text AS status
           FROM market_scan_opportunities
          WHERE market_scan_id = $1::uuid
          ORDER BY
            CASE impact WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
            title
          LIMIT 500`,
        [req.params.scanId],
      );
      return res.json({ opportunities: r.rows });
    } catch (err) {
      if ((err as { code?: string }).code === "42P01") {
        return res.json({ opportunities: [] });
      }
      console.error("[market-scans opportunities GET]", err);
      return res.status(500).json({ error: "opportunities_failed" });
    }
  });
}
