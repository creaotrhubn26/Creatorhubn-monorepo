/**
 * chat-widget-analytics-routes.ts
 *
 * Valgfrie analyse-endepunkter for chat-widgeten / admin-dashbordet. Disse ble
 * kalt fra frontend (FullscreenChatWidget + AdminDashboard) men fantes ikke →
 * 404-støy i konsollen. Returnerer nå EKTE aggregater fra crm_customers
 * (scopet til den innloggede brukerens egne kunder) + academy-refunds.
 *
 * Beløp lagres i øre (won_amount_oere); vises som NOK.
 */

import type express from "express";
import type { Pool } from "pg";

interface Deps {
  app: express.Application;
  pool: Pool;
  requireUserSession: (
    req: express.Request,
    res: express.Response,
  ) => { userId: string; email: string; name: string; role: string } | null;
  adminRoles: Set<string>;
}

export function setupChatWidgetAnalyticsRoutes({ app, pool, requireUserSession, adminRoles }: Deps): void {
  const fmtNok = (oere: unknown) =>
    `${Math.round((Number(oere) || 0) / 100).toLocaleString("nb-NO")} NOK`;
  const fmtPlain = (n: unknown) => `${Math.round(Number(n) || 0).toLocaleString("nb-NO")} NOK`;

  // Kundens EGNE kunder (eier eller tildelt) — aldri andres pipeline.
  const SCOPE = "deleted_at IS NULL AND (owner_user_id = $1 OR assigned_user_id = $1)";

  // ─── GET /api/crm/analytics/leads ───────────────────────────────
  app.get("/api/crm/analytics/leads", async (req, res) => {
    const s = requireUserSession(req, res);
    if (!s) return;
    try {
      const agg = (
        await pool.query(
          `SELECT
             count(*) FILTER (WHERE created_at > date_trunc('month', now())) AS new_leads,
             count(*) FILTER (WHERE meeting_booked_at IS NOT NULL) AS qualified,
             count(*) FILTER (WHERE won_at IS NOT NULL) AS converted,
             count(*) AS total
           FROM crm_customers WHERE ${SCOPE}`,
          [s.userId],
        )
      ).rows[0];
      const total = Number(agg?.total || 0);
      const converted = Number(agg?.converted || 0);
      const hot = (
        await pool.query(
          `SELECT name, COALESCE(expected_value, estimated_value, 0) AS value, COALESCE(lead_score, 0) AS score
             FROM crm_customers
            WHERE ${SCOPE} AND won_at IS NULL
            ORDER BY lead_score DESC NULLS LAST, created_at DESC
            LIMIT 5`,
          [s.userId],
        )
      ).rows;
      res.json({
        newLeads: Number(agg?.new_leads || 0),
        qualifiedLeads: Number(agg?.qualified || 0),
        convertedLeads: converted,
        conversionRate: total > 0 ? `${Math.round((converted / total) * 100)}%` : "0%",
        hotLeads: hot.map((r: any) => ({
          name: r.name || "—",
          messages: 0,
          value: fmtPlain(r.value),
          score: Number(r.score || 0),
        })),
      });
    } catch (err) {
      console.error("[crm/analytics/leads]", err);
      res.status(500).json({ error: "failed" });
    }
  });

  // ─── GET /api/crm/analytics/sales ───────────────────────────────
  app.get("/api/crm/analytics/sales", async (req, res) => {
    const s = requireUserSession(req, res);
    if (!s) return;
    try {
      const agg = (
        await pool.query(
          `SELECT
             COALESCE(sum(won_amount_oere) FILTER (WHERE won_at >= date_trunc('month', now())), 0) AS cur,
             COALESCE(sum(won_amount_oere) FILTER (WHERE won_at >= date_trunc('month', now()) - interval '1 month'
                                                      AND won_at < date_trunc('month', now())), 0) AS prev,
             count(*) FILTER (WHERE won_at >= date_trunc('month', now())) AS won_cur
           FROM crm_customers WHERE ${SCOPE}`,
          [s.userId],
        )
      ).rows[0];
      const cur = Number(agg?.cur || 0);
      const prev = Number(agg?.prev || 0);
      const wonCur = Number(agg?.won_cur || 0);
      const top = (
        await pool.query(
          `SELECT name, company, COALESCE(won_amount_oere, 0) AS amt
             FROM crm_customers
            WHERE ${SCOPE} AND won_at IS NOT NULL
            ORDER BY won_amount_oere DESC NULLS LAST LIMIT 5`,
          [s.userId],
        )
      ).rows;
      const growth = prev > 0 ? Math.round(((cur - prev) / prev) * 100) : cur > 0 ? 100 : 0;
      res.json({
        currentMonth: fmtNok(cur),
        previousMonth: fmtNok(prev),
        growth: `${growth >= 0 ? "+" : ""}${growth}%`,
        averagePerLead: fmtNok(wonCur > 0 ? cur / wonCur : 0),
        topSales: top.map((r: any) => ({
          project: r.name || "—",
          client: r.company || r.name || "—",
          value: fmtNok(r.amt),
        })),
      });
    } catch (err) {
      console.error("[crm/analytics/sales]", err);
      res.status(500).json({ error: "failed" });
    }
  });

  // ─── GET /api/admin/analytics/business ──────────────────────────
  app.get("/api/admin/analytics/business", async (req, res) => {
    const s = requireUserSession(req, res);
    if (!s) return;
    try {
      const agg = (
        await pool.query(
          `SELECT
             COALESCE(sum(won_amount_oere) FILTER (WHERE won_at >= date_trunc('month', now())), 0) AS monthly,
             COALESCE(sum(won_amount_oere) FILTER (WHERE won_at IS NOT NULL), 0) AS total
           FROM crm_customers WHERE ${SCOPE}`,
          [s.userId],
        )
      ).rows[0];
      res.json({ monthlyRevenue: fmtNok(agg?.monthly), revenue: fmtNok(agg?.total) });
    } catch (err) {
      console.error("[admin/analytics/business]", err);
      res.status(500).json({ error: "failed" });
    }
  });

  // ─── GET /api/admin/academy/refunds (admin-only) ────────────────
  app.get("/api/admin/academy/refunds", async (req, res) => {
    const s = requireUserSession(req, res);
    if (!s) return;
    // Ikke-admin → tom liste (lekker ikke andres refusjoner).
    if (!adminRoles.has(String(s.role || "").trim().toLowerCase())) {
      return res.json({ refunds: [] });
    }
    try {
      const parsed = Number.parseInt(String(req.query.limit ?? "50"), 10);
      const limit = Number.isFinite(parsed) ? Math.max(1, Math.min(parsed, 200)) : 50;
      const rows = (
        await pool.query(
          `SELECT r.id, r.amount, r.reason, r.status, r.created_at, r.user_id,
                  COALESCE(u.company_name, u.username, u.email) AS instructor_name
             FROM refund_requests r
             LEFT JOIN users u ON u.id = r.user_id
            ORDER BY r.created_at DESC
            LIMIT $1`,
          [limit],
        )
      ).rows;
      res.json({
        refunds: rows.map((r: any) => ({
          id: String(r.id),
          amount: r.amount,
          createdAt: r.created_at,
          instructorId: r.user_id ? String(r.user_id) : null,
          instructorName: r.instructor_name || null,
          reason: r.reason || null,
          status: r.status || null,
        })),
      });
    } catch (err) {
      console.error("[admin/academy/refunds]", err);
      res.json({ refunds: [] });
    }
  });
}
