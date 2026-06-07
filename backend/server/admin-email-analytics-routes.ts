// Admin email-analytics routes.
//
// Aggregerer Resend webhook-events fra `email_events`-tabellen (migrasjon
// 233_email_events.sql) for AdminDashboard "Lab" → email-analytics-tab.
//
// Defensiv: hvis tabellen ikke finnes (migrasjon ikke kjørt enda) returneres
// zeros + en console.warn — ikke 500 — slik at UI ikke krasjer.

import express from "express";
import type { Pool } from "pg";

export interface AdminEmailAnalyticsRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => { userId: string; email: string; name: string; role: string } | null;
}

// Cache table-existence-check pr. boot. `to_regclass` returnerer null hvis
// tabellen mangler — gir oss en rask ja/nei uten å rotere
// information_schema flere ganger pr. request.
async function emailEventsTableExists(pool: Pool): Promise<boolean> {
  try {
    const r = await pool.query<{ reg: string | null }>(
      `SELECT to_regclass('public.email_events') AS reg`,
    );
    return r.rows[0]?.reg !== null && r.rows[0]?.reg !== undefined;
  } catch {
    return false;
  }
}

// Parse '7d' | '30d' | '90d' | '1d' → antall dager. Default 30.
function parseRangeDays(input: unknown): number {
  if (typeof input !== "string") return 30;
  const m = input.trim().match(/^(\d+)\s*d$/i);
  if (!m) return 30;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0 || n > 365) return 30;
  return n;
}

function safeLimit(input: unknown, def: number, max: number): number {
  const n = Number(input);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(Math.floor(n), max);
}

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 10000) / 100; // 2 desimaler
}

export function setupAdminEmailAnalyticsRoutes(
  deps: AdminEmailAnalyticsRoutesDeps,
): void {
  const { app, pool, requireAdminSession } = deps;

  // ─── Aggregert oversikt ─────────────────────────────────────
  // GET /api/admin/email-analytics?range=30d
  //   → { totalSent, totalDelivered, totalOpened, totalClicked,
  //       deliveryRate, openRate, clickRate, bounceRate,
  //       byPeriod: [{ date, sent, opened }] }
  app.get("/api/admin/email-analytics", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const days = parseRangeDays(req.query.range);

      if (!(await emailEventsTableExists(pool))) {
        console.warn(
          "[email-analytics] email_events table missing — returning zeros. " +
            "Run migration 233_email_events.sql.",
        );
        return res.json({
          totalSent: 0,
          totalDelivered: 0,
          totalOpened: 0,
          totalClicked: 0,
          totalBounced: 0,
          totalComplained: 0,
          deliveryRate: 0,
          openRate: 0,
          clickRate: 0,
          bounceRate: 0,
          byPeriod: [],
          rangeDays: days,
          tableMissing: true,
        });
      }

      // Vi bruker DISTINCT email_id pr. event-type for å unngå at samme
      // mottaker som åpner mailen 5 ganger teller som 5 åpninger. (Resend
      // sender ofte både "delivered" og "opened" flere ganger.)
      const totalsSql = `
        SELECT
          COUNT(*) FILTER (WHERE event_type = 'sent')                                    AS sent_events,
          COUNT(DISTINCT email_id) FILTER (WHERE event_type = 'sent')                    AS unique_sent,
          COUNT(DISTINCT email_id) FILTER (WHERE event_type = 'delivered')               AS unique_delivered,
          COUNT(DISTINCT email_id) FILTER (WHERE event_type = 'opened')                  AS unique_opened,
          COUNT(DISTINCT email_id) FILTER (WHERE event_type = 'clicked')                 AS unique_clicked,
          COUNT(DISTINCT email_id) FILTER (WHERE event_type = 'bounced')                 AS unique_bounced,
          COUNT(DISTINCT email_id) FILTER (WHERE event_type IN ('complained','spam'))    AS unique_complained
        FROM email_events
        WHERE occurred_at >= now() - ($1::int || ' days')::interval
      `;
      const totalsRes = await pool.query<{
        sent_events: string;
        unique_sent: string;
        unique_delivered: string;
        unique_opened: string;
        unique_clicked: string;
        unique_bounced: string;
        unique_complained: string;
      }>(totalsSql, [days]);
      const row = totalsRes.rows[0] ?? {
        sent_events: "0",
        unique_sent: "0",
        unique_delivered: "0",
        unique_opened: "0",
        unique_clicked: "0",
        unique_bounced: "0",
        unique_complained: "0",
      };

      // Hvis vi har 0 'sent'-events bruker vi 'delivered' som denominator
      // for rates — webhooks setter ofte ikke 'sent' for transactional.
      const totalSent = Number(row.unique_sent) || 0;
      const totalDelivered = Number(row.unique_delivered) || 0;
      const totalOpened = Number(row.unique_opened) || 0;
      const totalClicked = Number(row.unique_clicked) || 0;
      const totalBounced = Number(row.unique_bounced) || 0;
      const totalComplained = Number(row.unique_complained) || 0;
      const baseForRates = totalSent > 0 ? totalSent : totalDelivered;

      // byPeriod: dag-bøtter med sent + opened i tidsrommet.
      const periodSql = `
        WITH days AS (
          SELECT generate_series(
            date_trunc('day', now() - ($1::int - 1 || ' days')::interval),
            date_trunc('day', now()),
            interval '1 day'
          )::date AS d
        ),
        ev AS (
          SELECT
            date_trunc('day', occurred_at)::date AS d,
            COUNT(DISTINCT email_id) FILTER (WHERE event_type IN ('sent','delivered')) AS sent,
            COUNT(DISTINCT email_id) FILTER (WHERE event_type = 'opened')              AS opened
          FROM email_events
          WHERE occurred_at >= now() - ($1::int || ' days')::interval
          GROUP BY 1
        )
        SELECT
          to_char(days.d, 'YYYY-MM-DD') AS date,
          COALESCE(ev.sent, 0)::int     AS sent,
          COALESCE(ev.opened, 0)::int   AS opened
        FROM days
        LEFT JOIN ev ON ev.d = days.d
        ORDER BY days.d ASC
      `;
      const periodRes = await pool.query<{
        date: string;
        sent: number;
        opened: number;
      }>(periodSql, [days]);

      return res.json({
        totalSent,
        totalDelivered,
        totalOpened,
        totalClicked,
        totalBounced,
        totalComplained,
        deliveryRate: pct(totalDelivered, baseForRates),
        openRate: pct(totalOpened, baseForRates),
        clickRate: pct(totalClicked, baseForRates),
        bounceRate: pct(totalBounced, baseForRates),
        byPeriod: periodRes.rows.map((r) => ({
          date: r.date,
          sent: Number(r.sent) || 0,
          opened: Number(r.opened) || 0,
        })),
        rangeDays: days,
      });
    } catch (e) {
      console.error("[email-analytics] /email-analytics failed:", e);
      res.status(500).json({ error: String(e) });
    }
  });

  // ─── Kampanjer ──────────────────────────────────────────────
  // GET /api/admin/email-campaigns?limit=50
  //   → { campaigns: [{ id, sentCount, deliveredCount, openRate, clickRate, lastSentAt }], total }
  app.get("/api/admin/email-campaigns", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const limit = safeLimit(req.query.limit, 50, 500);

      if (!(await emailEventsTableExists(pool))) {
        console.warn(
          "[email-analytics] email_events table missing — returning empty campaigns list.",
        );
        return res.json({ campaigns: [], total: 0, tableMissing: true });
      }

      const sql = `
        WITH per_campaign AS (
          SELECT
            campaign_id,
            COUNT(DISTINCT email_id) FILTER (WHERE event_type IN ('sent','delivered')) AS sent_count,
            COUNT(DISTINCT email_id) FILTER (WHERE event_type = 'delivered')           AS delivered_count,
            COUNT(DISTINCT email_id) FILTER (WHERE event_type = 'opened')              AS opened_count,
            COUNT(DISTINCT email_id) FILTER (WHERE event_type = 'clicked')             AS clicked_count,
            MAX(occurred_at) AS last_event_at
          FROM email_events
          WHERE campaign_id IS NOT NULL
          GROUP BY campaign_id
        )
        SELECT
          campaign_id,
          sent_count,
          delivered_count,
          opened_count,
          clicked_count,
          last_event_at
        FROM per_campaign
        ORDER BY last_event_at DESC NULLS LAST
        LIMIT $1
      `;
      const r = await pool.query<{
        campaign_id: string;
        sent_count: string;
        delivered_count: string;
        opened_count: string;
        clicked_count: string;
        last_event_at: Date | null;
      }>(sql, [limit]);

      const totalRes = await pool.query<{ total: string }>(
        `SELECT COUNT(DISTINCT campaign_id)::text AS total
           FROM email_events
          WHERE campaign_id IS NOT NULL`,
      );

      const campaigns = r.rows.map((row) => {
        const sent = Number(row.sent_count) || 0;
        const delivered = Number(row.delivered_count) || 0;
        const opened = Number(row.opened_count) || 0;
        const clicked = Number(row.clicked_count) || 0;
        const base = sent > 0 ? sent : delivered;
        return {
          id: row.campaign_id,
          sentCount: sent,
          deliveredCount: delivered,
          openedCount: opened,
          clickedCount: clicked,
          openRate: pct(opened, base),
          clickRate: pct(clicked, base),
          lastSentAt: row.last_event_at
            ? new Date(row.last_event_at).toISOString()
            : null,
        };
      });

      return res.json({
        campaigns,
        total: Number(totalRes.rows[0]?.total) || 0,
      });
    } catch (e) {
      console.error("[email-analytics] /email-campaigns failed:", e);
      res.status(500).json({ error: String(e) });
    }
  });

  // ─── Lenke-klikk ────────────────────────────────────────────
  // GET /api/admin/email-link-analytics?campaignId=X&limit=100
  //   → { links: [{ url, clickCount, uniqueClickers }], total }
  app.get("/api/admin/email-link-analytics", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const limit = safeLimit(req.query.limit, 100, 1000);
      const campaignIdRaw = req.query.campaignId;
      const campaignId =
        typeof campaignIdRaw === "string" && campaignIdRaw.length > 0
          ? campaignIdRaw
          : null;

      if (!(await emailEventsTableExists(pool))) {
        console.warn(
          "[email-analytics] email_events table missing — returning empty links list.",
        );
        return res.json({ links: [], total: 0, tableMissing: true });
      }

      const params: unknown[] = [limit];
      let where = `event_type = 'clicked' AND link_url IS NOT NULL`;
      if (campaignId) {
        params.push(campaignId);
        where += ` AND campaign_id = $${params.length}`;
      }

      const sql = `
        SELECT
          link_url                         AS url,
          COUNT(*)::int                    AS click_count,
          COUNT(DISTINCT email_id)::int    AS unique_clickers
        FROM email_events
        WHERE ${where}
        GROUP BY link_url
        ORDER BY click_count DESC
        LIMIT $1
      `;
      const r = await pool.query<{
        url: string;
        click_count: number;
        unique_clickers: number;
      }>(sql, params);

      const totalRes = await pool.query<{ total: string }>(
        `SELECT COUNT(DISTINCT link_url)::text AS total
           FROM email_events
          WHERE ${where}`,
        params.slice(1),
      );

      return res.json({
        links: r.rows.map((row) => ({
          url: row.url,
          clickCount: Number(row.click_count) || 0,
          uniqueClickers: Number(row.unique_clickers) || 0,
        })),
        total: Number(totalRes.rows[0]?.total) || 0,
        campaignId,
      });
    } catch (e) {
      console.error("[email-analytics] /email-link-analytics failed:", e);
      res.status(500).json({ error: String(e) });
    }
  });
}
