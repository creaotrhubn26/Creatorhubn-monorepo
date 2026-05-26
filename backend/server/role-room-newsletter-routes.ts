/**
 * role-room-newsletter-routes.ts
 *
 * Public newsletter-endpoint for "Norwegian Casting Brief" på theroleroom.com.
 *
 * - POST /api/newsletter/role-room — påmelding fra landingssider + content-sider
 * - GET  /api/admin-room/newsletter/role-room/stats — aggregat for Admin Room
 * - GET  /api/admin-room/newsletter/role-room/signups — recent signups for admin
 *
 * Public-endpoint krever ikke auth. Admin-endpoints gates via
 * requireAdminRoomAccess (samme mønster som øvrige admin-room-routes).
 */

import crypto from "node:crypto";
import type express from "express";
import type { Pool } from "pg";
import type { AdminRoomRoutesDeps } from "./_shared";
import { asString } from "./_shared";

interface NewsletterRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminRoomAccess: AdminRoomRoutesDeps["requireAdminRoomAccess"];
}

const ALLOWED_SOURCES = new Set([
  "casting-scam-signs",
  "child-consent-film",
  "casting-report-2026",
  "landing",
  "footer",
  "unknown",
]);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u;

const SIGNUP_RATE_LIMIT_PER_HOUR = 8;

/** Stable sha256-hash av IP slik at vi kan rate-limite uten å lagre rå IP. */
function hashIp(ip: string | undefined): string | null {
  if (!ip) return null;
  const salt = process.env.NEWSLETTER_IP_SALT ?? "role-room-newsletter-default-salt";
  return crypto.createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

function extractClientIp(req: express.Request): string | undefined {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]?.trim();
  }
  return req.socket?.remoteAddress ?? undefined;
}

export function setupRoleRoomNewsletterRoutes(deps: NewsletterRoutesDeps): void {
  const { app, pool, requireAdminRoomAccess } = deps;

  app.post("/api/newsletter/role-room", async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const email = asString(body.email);
    if (!email || !EMAIL_PATTERN.test(email)) {
      res.status(400).json({ ok: false, message: "Ugyldig e-postadresse." });
      return;
    }
    const requestedSource = asString(body.source, "unknown") ?? "unknown";
    const source = ALLOWED_SOURCES.has(requestedSource) ? requestedSource : "unknown";
    const locale = asString(body.locale, "no");

    const ip = extractClientIp(req);
    const ipHash = hashIp(ip);
    const userAgent = (req.headers["user-agent"] ?? "").toString().slice(0, 480);

    try {
      if (ipHash) {
        const recent = await pool.query(
          `SELECT COUNT(*)::int AS count
             FROM role_room_newsletter_signups
            WHERE ip_hash = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
          [ipHash],
        );
        if ((recent.rows[0]?.count ?? 0) >= SIGNUP_RATE_LIMIT_PER_HOUR) {
          res.status(429).json({
            ok: false,
            message: "Du har sendt mange påmeldinger nylig. Prøv igjen om en time.",
          });
          return;
        }
      }

      const result = await pool.query(
        `INSERT INTO role_room_newsletter_signups
           (email, source, ip_hash, user_agent, locale, status, metadata)
         VALUES ($1, $2, $3, $4, $5, 'pending_double_optin', $6::jsonb)
         ON CONFLICT ((LOWER(email)))
         DO UPDATE SET
             source = EXCLUDED.source,
             status = CASE
               WHEN role_room_newsletter_signups.unsubscribed_at IS NOT NULL
                 THEN 'pending_double_optin'
               ELSE role_room_newsletter_signups.status
             END,
             unsubscribed_at = NULL,
             updated_at = NOW()
         RETURNING id, status, created_at`,
        [
          email.toLowerCase(),
          source,
          ipHash,
          userAgent,
          locale ?? "no",
          JSON.stringify({}),
        ],
      );

      res.status(201).json({
        ok: true,
        id: result.rows[0]?.id,
        status: result.rows[0]?.status,
        message: "Takk! Sjekk innboksen for bekreftelse.",
      });
    } catch (err) {
      console.error("[role-room-newsletter] signup error", err);
      res.status(500).json({ ok: false, message: "Påmeldingen feilet. Prøv igjen om litt." });
    }
  });

  app.get("/api/admin-room/newsletter/role-room/stats", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const totals = await pool.query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status = 'confirmed')::int AS confirmed,
           COUNT(*) FILTER (WHERE status = 'pending_double_optin')::int AS pending,
           COUNT(*) FILTER (WHERE unsubscribed_at IS NOT NULL)::int AS unsubscribed,
           COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::int AS new_last_7d,
           COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days')::int AS new_last_30d
         FROM role_room_newsletter_signups`,
      );
      const bySource = await pool.query(
        `SELECT source, COUNT(*)::int AS count
           FROM role_room_newsletter_signups
          WHERE created_at > NOW() - INTERVAL '90 days'
          GROUP BY source
          ORDER BY count DESC`,
      );
      res.json({
        totals: totals.rows[0] ?? { total: 0, confirmed: 0, pending: 0, unsubscribed: 0, new_last_7d: 0, new_last_30d: 0 },
        bySource: bySource.rows,
      });
    } catch (err) {
      console.error("[role-room-newsletter] stats error", err);
      res.status(500).json({ error: "Kunne ikke hente newsletter-statistikk" });
    }
  });

  app.get("/api/admin-room/newsletter/role-room/signups", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const limitRaw = Number.parseInt((req.query.limit as string) ?? "50", 10);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 200 ? limitRaw : 50;
    try {
      const result = await pool.query(
        `SELECT id, email, source, status, locale, consented_at, confirmed_at,
                unsubscribed_at, created_at
           FROM role_room_newsletter_signups
          ORDER BY created_at DESC
          LIMIT $1`,
        [limit],
      );
      res.json({ items: result.rows });
    } catch (err) {
      console.error("[role-room-newsletter] signups error", err);
      res.status(500).json({ error: "Kunne ikke hente påmeldinger" });
    }
  });
}
