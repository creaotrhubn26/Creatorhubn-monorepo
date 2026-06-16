/**
 * lead-map-notification-routes.ts
 *
 *   GET    /me/notifications?unread_only=&limit=
 *   POST   /me/notifications/:id/read
 *   POST   /me/notifications/read-all
 *   GET    /me/notifications/preferences?organization_id=
 *   PATCH  /me/notifications/preferences
 *   POST   /me/notifications/device-token       — iPad APNs
 *   DELETE /me/notifications/device-token/:id
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";

type SessionData = { userId: string; role?: string; email?: string };
interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

function getUser(
  req: Request,
  activeSessions: Map<string, SessionData>,
): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    return activeSessions.get(auth.slice(7)) ?? null;
  }
  return null;
}

const VALID_EVENT_TYPES = new Set([
  "lead_assigned",
  "lead_status_changed",
  "lead_won_on_team",
  "follow_up_due",
  "approaching_lead",
]);

export function registerLeadMapNotificationRoutes({ app, pool, activeSessions }: Deps): void {
  // ─── GET /me/notifications ──────────────────────────────────────
  app.get(
    "/api/admin-room/lead-map/me/notifications",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const unreadOnly = req.query.unread_only === "true";
      const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10) || 50, 200);
      try {
        const r = await pool.query(
          `SELECT id::text, event_type, title, body, lead_id, visit_id,
                  triggered_by_user_id, deep_link, meta,
                  email_sent, apns_sent,
                  read_at::text, created_at::text
             FROM notification_events
            WHERE recipient_user_id = $1
              ${unreadOnly ? "AND read_at IS NULL" : ""}
            ORDER BY created_at DESC
            LIMIT $2`,
          [session.userId, limit],
        );
        const unreadRes = await pool.query<{ n: number }>(
          `SELECT COUNT(*)::int AS n FROM notification_events
            WHERE recipient_user_id = $1 AND read_at IS NULL`,
          [session.userId],
        );
        return res.json({
          notifications: r.rows,
          unreadCount: unreadRes.rows[0]?.n ?? 0,
        });
      } catch (err) {
        return res.status(500).json({ error: "feed_failed", detail: String(err) });
      }
    },
  );

  // ─── POST /me/notifications/:id/read ────────────────────────────
  app.post(
    "/api/admin-room/lead-map/me/notifications/:id/read",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      try {
        await pool.query(
          `UPDATE notification_events
              SET read_at = NOW()
            WHERE id = $1 AND recipient_user_id = $2`,
          [req.params.id, session.userId],
        );
        return res.json({ ok: true });
      } catch (err) {
        return res.status(500).json({ error: "mark_read_failed", detail: String(err) });
      }
    },
  );

  // ─── POST /me/notifications/read-all ────────────────────────────
  app.post(
    "/api/admin-room/lead-map/me/notifications/read-all",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      try {
        const r = await pool.query(
          `UPDATE notification_events
              SET read_at = NOW()
            WHERE recipient_user_id = $1 AND read_at IS NULL`,
          [session.userId],
        );
        return res.json({ ok: true, updated: r.rowCount });
      } catch (err) {
        return res.status(500).json({ error: "mark_all_failed", detail: String(err) });
      }
    },
  );

  // ─── GET /me/notifications/preferences ──────────────────────────
  app.get(
    "/api/admin-room/lead-map/me/notifications/preferences",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const orgId = req.query.organization_id as string | undefined;
      if (!orgId) return res.status(400).json({ error: "mangler_organization_id" });
      try {
        const r = await pool.query(
          `SELECT event_type, email_enabled, apns_enabled,
                  quiet_hours_start, quiet_hours_end
             FROM notification_preferences
            WHERE user_id = $1 AND organization_id = $2`,
          [session.userId, orgId],
        );
        // Bygg full liste m/ defaults for events bruker ikke har sett
        const eventTypes = Array.from(VALID_EVENT_TYPES);
        const byType = new Map(r.rows.map((row) => [row.event_type, row]));
        const preferences = eventTypes.map((et) => {
          const row = byType.get(et);
          return {
            eventType: et,
            emailEnabled: row?.email_enabled ?? true,
            apnsEnabled: row?.apns_enabled ?? true,
            quietHoursStart: row?.quiet_hours_start ?? null,
            quietHoursEnd: row?.quiet_hours_end ?? null,
          };
        });
        return res.json({ preferences });
      } catch (err) {
        return res.status(500).json({ error: "prefs_failed", detail: String(err) });
      }
    },
  );

  // ─── PATCH /me/notifications/preferences ────────────────────────
  app.patch(
    "/api/admin-room/lead-map/me/notifications/preferences",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const body = req.body as {
        organization_id?: string;
        event_type?: string;
        email_enabled?: boolean;
        apns_enabled?: boolean;
        quiet_hours_start?: number | null;
        quiet_hours_end?: number | null;
      };
      if (!body.organization_id || !body.event_type) {
        return res.status(400).json({ error: "mangler_felt" });
      }
      if (!VALID_EVENT_TYPES.has(body.event_type)) {
        return res.status(400).json({ error: "ukjent_event_type" });
      }
      try {
        await pool.query(
          `INSERT INTO notification_preferences (
             user_id, organization_id, event_type,
             email_enabled, apns_enabled,
             quiet_hours_start, quiet_hours_end
           ) VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (user_id, organization_id, event_type) DO UPDATE SET
             email_enabled = EXCLUDED.email_enabled,
             apns_enabled = EXCLUDED.apns_enabled,
             quiet_hours_start = EXCLUDED.quiet_hours_start,
             quiet_hours_end = EXCLUDED.quiet_hours_end,
             updated_at = NOW()`,
          [
            session.userId, body.organization_id, body.event_type,
            body.email_enabled ?? true,
            body.apns_enabled ?? true,
            body.quiet_hours_start ?? null,
            body.quiet_hours_end ?? null,
          ],
        );
        return res.json({ ok: true });
      } catch (err) {
        return res.status(500).json({ error: "save_pref_failed", detail: String(err) });
      }
    },
  );

  // ─── POST /me/notifications/device-token (iPad) ─────────────────
  app.post(
    "/api/admin-room/lead-map/me/notifications/device-token",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const body = req.body as {
        platform?: string;
        token?: string;
        device_name?: string;
        app_version?: string;
        web_push_p256dh?: string;
        web_push_auth?: string;
      };
      if (!body.platform || !body.token) {
        return res.status(400).json({ error: "mangler_token" });
      }
      if (!["apns", "web_push", "fcm"].includes(body.platform)) {
        return res.status(400).json({ error: "ugyldig_platform" });
      }
      try {
        await pool.query(
          `INSERT INTO notification_device_tokens (
             user_id, platform, token,
             web_push_p256dh, web_push_auth,
             device_name, app_version, enabled, last_seen_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, NOW())
           ON CONFLICT (platform, token) DO UPDATE SET
             user_id = EXCLUDED.user_id,
             web_push_p256dh = EXCLUDED.web_push_p256dh,
             web_push_auth = EXCLUDED.web_push_auth,
             device_name = EXCLUDED.device_name,
             app_version = EXCLUDED.app_version,
             enabled = TRUE,
             last_seen_at = NOW()`,
          [
            session.userId, body.platform, body.token,
            body.web_push_p256dh ?? null,
            body.web_push_auth ?? null,
            body.device_name ?? null,
            body.app_version ?? null,
          ],
        );
        return res.json({ ok: true });
      } catch (err) {
        return res.status(500).json({ error: "save_token_failed", detail: String(err) });
      }
    },
  );

  // ─── DELETE /me/notifications/device-token/:id ──────────────────
  app.delete(
    "/api/admin-room/lead-map/me/notifications/device-token/:id",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      try {
        await pool.query(
          `UPDATE notification_device_tokens
              SET enabled = FALSE
            WHERE id = $1 AND user_id = $2`,
          [req.params.id, session.userId],
        );
        return res.json({ ok: true });
      } catch (err) {
        return res.status(500).json({ error: "deregister_failed", detail: String(err) });
      }
    },
  );
}
