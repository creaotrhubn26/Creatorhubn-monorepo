/**
 * nextrole-public-cv-analytics.ts
 *
 * Visning-tracking + analytics for offentlige CV-er.
 *
 * Eksterne endepunkter:
 *   POST /api/public/resumes/:slug/track-view
 *     Kalles fra public-CV-siden ved mount. Logger view med metadata.
 *
 *   GET  /api/resumes/:id/analytics
 *     Eier-only. Returnerer aggregert statistikk: total visninger,
 *     unike viewers, breakdown per land, daglig trend siste 30 dager.
 *
 * IP-håndtering: vi tar SHA-256(ip + NEXTROLE_CRON_SECRET) som hash.
 * Aldri lagrer rå IP — GDPR-vennlig pseudonymisering.
 *
 * Cloudflare-headere brukt:
 *   cf-ipcountry  → ISO-land
 *   cf-ipcity     → by (sjelden satt)
 *   cf-connecting-ip → ekte client IP når bak proxy
 */

import { createHash } from "crypto";
import type express from "express";
import type { Pool } from "pg";

export interface NextRolePublicCvAnalyticsDeps {
  app: express.Application;
  pool: Pool;
  getActiveSessionFromRequest: (
    req: express.Request,
  ) => { userId: string } | null;
}

function hashIp(ip: string): string {
  const salt = process.env.NEXTROLE_CRON_SECRET ?? "nextrole-view-salt";
  return createHash("sha256").update(`${ip}:${salt}`).digest("hex").slice(0, 48);
}

function classifyUserAgent(ua: string): string {
  const low = ua.toLowerCase();
  if (!low) return "unknown";
  if (/bot|crawler|spider|slurp|baidu|bingbot|yandex|googlebot/i.test(low))
    return "bot";
  if (/iphone|android|ipad|mobile/i.test(low)) return "mobile";
  return "desktop";
}

function extractClientIp(req: express.Request): string {
  const cfIp = req.headers["cf-connecting-ip"];
  if (typeof cfIp === "string" && cfIp) return cfIp;
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff) return xff.split(",")[0].trim();
  return req.socket.remoteAddress ?? "unknown";
}

export function setupNextRolePublicCvAnalyticsRoutes(
  deps: NextRolePublicCvAnalyticsDeps,
): void {
  const { app, pool, getActiveSessionFromRequest } = deps;

  // POST track-view — kalles fra frontend public-CV-side ved mount
  app.post("/api/public/resumes/:slug/track-view", async (req, res) => {
    const slug = req.params.slug;
    try {
      // Slå opp resume_id fra slug
      const r = await pool.query<{ id: string; user_id: string }>(
        `SELECT id, user_id FROM resumes
          WHERE public_url = $1 AND is_public = TRUE
          LIMIT 1`,
        [slug],
      );
      if (!r.rowCount) {
        res.json({ tracked: false });
        return;
      }
      const resumeId = r.rows[0].id;
      const ownerId = r.rows[0].user_id;

      // Ikke logg eierens egne visninger
      const session = getActiveSessionFromRequest(req);
      if (session?.userId === ownerId) {
        res.json({ tracked: false, reason: "owner_self_view" });
        return;
      }

      const ip = extractClientIp(req);
      const ipHash = hashIp(ip);
      const country = String(req.headers["cf-ipcountry"] ?? "").slice(0, 8) || null;
      const city = String(req.headers["cf-ipcity"] ?? "").slice(0, 128) || null;
      const referrer = String(req.headers["referer"] ?? "").slice(0, 500) || null;
      const uaKind = classifyUserAgent(String(req.headers["user-agent"] ?? ""));

      await pool.query(
        `INSERT INTO nextrole_public_cv_views (
           resume_id, ip_hash, country_code, city, referrer, user_agent_kind
         ) VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (resume_id, ip_hash, viewed_date) DO NOTHING`,
        [resumeId, ipHash, country, city, referrer, uaKind],
      );
      res.json({ tracked: true });
    } catch (err) {
      console.error("[public-cv-analytics] track failed", err);
      res.json({ tracked: false });
    }
  });

  // GET analytics — eier-only
  app.get("/api/resumes/:id/analytics", async (req, res) => {
    const session = getActiveSessionFromRequest(req);
    if (!session?.userId) {
      res.status(401).json({ error: "auth_required" });
      return;
    }
    const resumeId = req.params.id;
    const own = await pool.query<{ id: string }>(
      `SELECT id FROM resumes WHERE id = $1 AND user_id = $2`,
      [resumeId, session.userId],
    );
    if (!own.rowCount) {
      res.status(404).json({ error: "ikke_funnet" });
      return;
    }
    try {
      const [totals, byCountry, byDay, recent] = await Promise.all([
        pool.query<{ total: string; unique_viewers: string; bots: string }>(
          `SELECT
             COUNT(*)::text AS total,
             COUNT(DISTINCT ip_hash)::text AS unique_viewers,
             COUNT(*) FILTER (WHERE user_agent_kind = 'bot')::text AS bots
           FROM nextrole_public_cv_views
           WHERE resume_id = $1`,
          [resumeId],
        ),
        pool.query<{ country_code: string; count: string }>(
          `SELECT country_code, COUNT(*)::text AS count
             FROM nextrole_public_cv_views
            WHERE resume_id = $1
              AND country_code IS NOT NULL
              AND user_agent_kind != 'bot'
            GROUP BY country_code
            ORDER BY COUNT(*) DESC
            LIMIT 20`,
          [resumeId],
        ),
        pool.query<{ day: Date; count: string }>(
          `SELECT viewed_date AS day, COUNT(*)::text AS count
             FROM nextrole_public_cv_views
            WHERE resume_id = $1
              AND viewed_date > CURRENT_DATE - INTERVAL '30 days'
              AND user_agent_kind != 'bot'
            GROUP BY viewed_date
            ORDER BY viewed_date ASC`,
          [resumeId],
        ),
        pool.query<{
          viewed_at: Date;
          country_code: string | null;
          city: string | null;
          referrer: string | null;
          user_agent_kind: string;
        }>(
          `SELECT viewed_at, country_code, city, referrer, user_agent_kind
             FROM nextrole_public_cv_views
            WHERE resume_id = $1
              AND user_agent_kind != 'bot'
            ORDER BY viewed_at DESC
            LIMIT 25`,
          [resumeId],
        ),
      ]);
      const t = totals.rows[0];
      res.json({
        totalViews: Number(t?.total ?? "0"),
        uniqueViewers: Number(t?.unique_viewers ?? "0"),
        bots: Number(t?.bots ?? "0"),
        byCountry: byCountry.rows.map((row) => ({
          countryCode: row.country_code,
          count: Number(row.count),
        })),
        last30Days: byDay.rows.map((row) => ({
          date: row.day.toISOString().slice(0, 10),
          count: Number(row.count),
        })),
        recent: recent.rows.map((row) => ({
          viewedAt: row.viewed_at.toISOString(),
          countryCode: row.country_code,
          city: row.city,
          referrer: row.referrer,
          userAgent: row.user_agent_kind,
        })),
      });
    } catch (err) {
      console.error("[public-cv-analytics] aggregate failed", err);
      res.status(500).json({ error: "internal_error" });
    }
  });
}
