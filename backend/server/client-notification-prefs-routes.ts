/**
 * client-notification-prefs-routes.ts
 *
 * API for klient-portal til å endre sine egne varsels-prefs +
 * superadmin-oversikt.
 *
 *   GET  /api/leadgrid/portal/:portalToken/notification-prefs
 *   PUT  /api/leadgrid/portal/:portalToken/notification-prefs
 *   POST /api/leadgrid/portal/:portalToken/notification-prefs/unsubscribe
 *
 *   GET  /api/superadmin/notification-log?customer_id=...
 *   POST /api/superadmin/notification-prefs/:customerId/test  (send test-melding)
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { notifyClient } from "./client-notification-service.js";

type SessionData = { userId: string; role?: string; email?: string };
interface Deps { app: Express; pool: Pool; activeSessions: Map<string, SessionData>; }

async function customerIdFromPortalToken(
  pool: Pool, token: string,
): Promise<string | null> {
  const r = await pool.query<{ customer_id: string }>(
    `SELECT customer_id::text FROM client_portal_tokens
      WHERE token = $1
        AND revoked_at IS NULL
        AND (expires_at IS NULL OR expires_at > now())
      LIMIT 1`,
    [token],
  );
  return r.rows[0]?.customer_id ?? null;
}

export function registerClientNotificationPrefsRoutes({
  app, pool, activeSessions,
}: Deps): void {

  // -------- Klient-portal: hent prefs --------
  app.get("/api/leadgrid/portal/:portalToken/notification-prefs", async (req, res) => {
    const cid = await customerIdFromPortalToken(pool, req.params.portalToken);
    if (!cid) return res.status(404).json({ error: "Ugyldig portal-token" });

    const r = await pool.query(
      `SELECT contact_name, contact_email, contact_phone,
              notify_email, notify_sms, notify_whatsapp,
              notify_deliverable_completed, notify_focus_request_received,
              notify_score_changed, notify_new_finding, notify_monthly_report,
              unsubscribed_at::text
         FROM client_notification_prefs
        WHERE customer_id = $1`,
      [cid],
    );
    if (r.rows.length === 0) {
      const cr = await pool.query(
        `SELECT name AS contact_name, email AS contact_email
           FROM crm_customers WHERE id = $1`, [cid],
      );
      return res.json({
        ...(cr.rows[0] ?? {}),
        contact_phone: null,
        notify_email: true, notify_sms: false, notify_whatsapp: false,
        notify_deliverable_completed: true, notify_focus_request_received: true,
        notify_score_changed: false, notify_new_finding: true,
        notify_monthly_report: true,
        unsubscribed_at: null,
      });
    }
    res.json(r.rows[0]);
  });

  // -------- Klient-portal: oppdater prefs --------
  app.put("/api/leadgrid/portal/:portalToken/notification-prefs", async (req, res) => {
    const cid = await customerIdFromPortalToken(pool, req.params.portalToken);
    if (!cid) return res.status(404).json({ error: "Ugyldig portal-token" });

    const b = req.body ?? {};
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
            ?? req.socket.remoteAddress ?? "";
    const ua = (req.headers["user-agent"] as string) ?? "";

    await pool.query(
      `INSERT INTO client_notification_prefs
        (customer_id, contact_name, contact_email, contact_phone,
         notify_email, notify_sms, notify_whatsapp,
         notify_deliverable_completed, notify_focus_request_received,
         notify_score_changed, notify_new_finding, notify_monthly_report,
         consent_given_at, consent_ip, consent_user_agent, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now(), $13, $14, now())
       ON CONFLICT (customer_id) DO UPDATE SET
         contact_name = EXCLUDED.contact_name,
         contact_email = EXCLUDED.contact_email,
         contact_phone = EXCLUDED.contact_phone,
         notify_email = EXCLUDED.notify_email,
         notify_sms = EXCLUDED.notify_sms,
         notify_whatsapp = EXCLUDED.notify_whatsapp,
         notify_deliverable_completed = EXCLUDED.notify_deliverable_completed,
         notify_focus_request_received = EXCLUDED.notify_focus_request_received,
         notify_score_changed = EXCLUDED.notify_score_changed,
         notify_new_finding = EXCLUDED.notify_new_finding,
         notify_monthly_report = EXCLUDED.notify_monthly_report,
         consent_given_at = COALESCE(client_notification_prefs.consent_given_at, now()),
         consent_ip = COALESCE(client_notification_prefs.consent_ip, EXCLUDED.consent_ip),
         consent_user_agent = COALESCE(client_notification_prefs.consent_user_agent, EXCLUDED.consent_user_agent),
         unsubscribed_at = NULL,
         updated_at = now()`,
      [cid, b.contact_name ?? null, b.contact_email ?? null, b.contact_phone ?? null,
       !!b.notify_email, !!b.notify_sms, !!b.notify_whatsapp,
       b.notify_deliverable_completed !== false,
       b.notify_focus_request_received !== false,
       !!b.notify_score_changed,
       b.notify_new_finding !== false,
       b.notify_monthly_report !== false,
       ip, ua],
    );
    res.json({ ok: true });
  });

  // -------- Klient-portal: unsubscribe-all --------
  app.post("/api/leadgrid/portal/:portalToken/notification-prefs/unsubscribe",
    async (req, res) => {
      const cid = await customerIdFromPortalToken(pool, req.params.portalToken);
      if (!cid) return res.status(404).json({ error: "Ugyldig portal-token" });
      await pool.query(
        `UPDATE client_notification_prefs
            SET unsubscribed_at = now(),
                notify_email = FALSE, notify_sms = FALSE, notify_whatsapp = FALSE
          WHERE customer_id = $1`, [cid],
      );
      res.json({ ok: true });
    });

  // -------- Superadmin: notification-log --------
  app.get("/api/superadmin/notification-log", async (req, res) => {
    const auth = req.headers.authorization;
    const token = auth?.startsWith("Bearer ") ? auth.substring(7)
                : (req as any).cookies?.sessionToken;
    const s = token ? activeSessions.get(token) : null;
    if (s?.role !== "super_admin") return res.status(403).json({ error: "Krever super-admin" });

    const cid = req.query.customer_id as string | undefined;
    const params: any[] = [];
    let where = "";
    if (cid) { params.push(cid); where = `WHERE customer_id = $${params.length}`; }
    try {
      const r = await pool.query(
        `SELECT id::text, customer_id::text, channel, event_type, recipient,
                subject, sent_at::text, delivery_status, external_message_id, error_message
           FROM client_notification_log
           ${where}
           ORDER BY sent_at DESC
           LIMIT 200`,
        params,
      );
      res.json({ items: r.rows });
    } catch (err) {
      console.warn("[notification-log] list failed:", (err as Error).message);
      res.json({ items: [] });
    }
  });

  // -------- Superadmin: send testmelding --------
  app.post("/api/superadmin/notification-prefs/:customerId/test", async (req, res) => {
    const auth = req.headers.authorization;
    const token = auth?.startsWith("Bearer ") ? auth.substring(7)
                : (req as any).cookies?.sessionToken;
    const s = token ? activeSessions.get(token) : null;
    if (s?.role !== "super_admin") return res.status(403).json({ error: "Krever super-admin" });

    const r = await notifyClient(pool, {
      customerId: req.params.customerId,
      event: "new_finding",
      findingTitle: "Test-varsel fra superadmin",
    });
    res.json(r);
  });
}
