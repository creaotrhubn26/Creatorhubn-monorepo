/**
 * partner-api-management-routes.ts
 *
 * Superadmin + org-admin CRUD for API-keys, webhook-endpoints, og audit-log.
 *
 *   POST   /api/superadmin/api-keys              (opprett key)
 *   GET    /api/superadmin/api-keys              (liste)
 *   POST   /api/superadmin/api-keys/:id/revoke
 *
 *   POST   /api/superadmin/webhook-endpoints
 *   GET    /api/superadmin/webhook-endpoints
 *   PATCH  /api/superadmin/webhook-endpoints/:id
 *   DELETE /api/superadmin/webhook-endpoints/:id
 *   POST   /api/superadmin/webhook-endpoints/:id/test    (send test-event)
 *
 *   GET    /api/superadmin/webhook-deliveries           (siste 100 attempts)
 *   POST   /api/superadmin/webhook-deliveries/process    (cron-trigger)
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import crypto from "crypto";
import { deliverWebhook, processPendingDeliveries } from "./partner-webhook-service.js";

type SessionData = { userId: string; role?: string; email?: string };
interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

function getSession(req: Request, sessions: Map<string, SessionData>): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return sessions.get(auth.substring(7)) ?? null;
  const token = (req as any).cookies?.sessionToken;
  return token ? sessions.get(token) ?? null : null;
}

const CRON_TOKEN = process.env.LEADGRID_CRON_TRIGGER_TOKEN ?? "";

async function requireSuperAdmin(
  req: Request, res: Response, pool: Pool,
  activeSessions: Map<string, SessionData>,
): Promise<SessionData | null> {
  const s = getSession(req, activeSessions);
  if (!s) { res.status(401).json({ error: "Ikke innlogget" }); return null; }
  const r = await pool.query<{ role: string }>(`SELECT role FROM users WHERE id=$1`, [s.userId]);
  if (r.rows[0]?.role !== "super_admin") {
    res.status(403).json({ error: "Krever super-admin" }); return null;
  }
  return s;
}

export function registerPartnerApiManagementRoutes({ app, pool, activeSessions }: Deps): void {

  // ---------- API-keys ----------

  // POST /api/superadmin/api-keys
  // Body: { name, partnerId?, organizationId?, scopes: string[], expiresInDays? }
  // Response: { id, raw_key } — vises kun ÉN gang.
  app.post("/api/superadmin/api-keys", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const { name, partnerId, organizationId, scopes, expiresInDays } = req.body ?? {};
    if (!name) return res.status(400).json({ error: "name påkrevd" });
    if (!partnerId && !organizationId) {
      return res.status(400).json({ error: "partnerId eller organizationId påkrevd" });
    }
    if (!Array.isArray(scopes) || scopes.length === 0) {
      return res.status(400).json({ error: "scopes må være en ikke-tom array" });
    }

    // Generer key: lg_live_<32 tegn random hex>
    const isLive = process.env.NODE_ENV === "production";
    const env = isLive ? "live" : "test";
    const rawKey = `lg_${env}_${crypto.randomBytes(24).toString("hex")}`;
    const keyPrefix = rawKey.substring(0, 12);
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

    const expiresAt = expiresInDays
      ? new Date(Date.now() + Number(expiresInDays) * 24 * 3600 * 1000)
      : null;

    try {
      const r = await pool.query(
        `INSERT INTO partner_api_keys
          (partner_id, organization_id, key_prefix, key_hash, name,
           scopes, expires_at, created_by)
         VALUES ($1, $2, $3, $4, $5, $6::text[], $7, $8)
         RETURNING id::text, name, key_prefix, scopes, created_at::text, expires_at::text`,
        [
          partnerId ?? null, organizationId ?? null,
          keyPrefix, keyHash, name, scopes,
          expiresAt, s.userId,
        ],
      );
      res.status(201).json({
        data: r.rows[0],
        raw_key: rawKey,
        warning: "Kopier nøkkelen NÅ — den vises ikke igjen. Lagre i password-manager.",
      });
    } catch (e: any) {
      console.error("[api-keys create]", e);
      res.status(500).json({ error: e.message ?? "Feil" });
    }
  });

  // GET /api/superadmin/api-keys
  app.get("/api/superadmin/api-keys", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    try {
      const r = await pool.query(
        `SELECT k.id::text, k.name, k.key_prefix, k.scopes,
                k.partner_id::text, k.organization_id::text,
                k.is_active, k.expires_at::text, k.revoked_at::text,
                k.last_used_at::text, k.created_at::text,
                p.name AS partner_name,
                o.name AS organization_name,
                (SELECT COUNT(*)::int FROM partner_api_audit_log
                  WHERE api_key_id = k.id
                    AND created_at > now() - interval '7 days') AS calls_7d
           FROM partner_api_keys k
           LEFT JOIN leadgrid_partners p ON p.id = k.partner_id
           LEFT JOIN organizations o ON o.id = k.organization_id
          ORDER BY k.created_at DESC LIMIT 200`,
      );
      res.json({ data: r.rows });
    } catch (err) {
      console.warn("[api-keys] list failed:", (err as Error).message);
      res.json({ data: [] });
    }
  });

  // POST /api/superadmin/api-keys/:id/revoke
  app.post("/api/superadmin/api-keys/:id/revoke", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const { reason } = req.body ?? {};
    const r = await pool.query(
      `UPDATE partner_api_keys
          SET is_active = FALSE, revoked_at = now(),
              revoked_by = $1, revoked_reason = $2
        WHERE id = $3 AND revoked_at IS NULL
        RETURNING id::text`,
      [s.userId, reason ?? null, req.params.id],
    );
    if (r.rows.length === 0) return res.status(404).json({ error: "Ikke funnet eller allerede tilbakekalt" });
    res.json({ ok: true });
  });

  // ---------- Webhook-endpoints ----------

  // POST /api/superadmin/webhook-endpoints
  // Body: { partnerId?, organizationId?, url, events: string[], description? }
  // Response: { id, signing_secret } — secret vises kun ÉN gang.
  app.post("/api/superadmin/webhook-endpoints", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const { partnerId, organizationId, url, events, description } = req.body ?? {};
    if (!url || !/^https?:\/\//.test(url)) {
      return res.status(400).json({ error: "Ugyldig url" });
    }
    if (!partnerId && !organizationId) {
      return res.status(400).json({ error: "partnerId eller organizationId påkrevd" });
    }
    const signingSecret = "whsec_" + crypto.randomBytes(32).toString("hex");
    try {
      const r = await pool.query(
        `INSERT INTO partner_webhook_endpoints
          (partner_id, organization_id, url, signing_secret,
           description, events, created_by)
         VALUES ($1, $2, $3, $4, $5, $6::text[], $7)
         RETURNING id::text, url, events, description, created_at::text`,
        [
          partnerId ?? null, organizationId ?? null, url, signingSecret,
          description ?? null, events ?? [], s.userId,
        ],
      );
      // Auto-test webhook umiddelbart hvis URL svarer 2xx → aktivér
      // Hvis ikke → sett is_active=false og krev manuell aktivering
      let autoTestPassed = false;
      let autoTestStatus = 0;
      try {
        const eventId = crypto.randomUUID();
        const timestamp = Math.floor(Date.now() / 1000);
        const testPayload = JSON.stringify({
          test: true, event_type: "test.endpoint_created",
          message: "Auto-test ved create",
        });
        const sig = crypto.createHmac("sha256", signingSecret)
          .update(`${timestamp}.${testPayload}`).digest("hex");
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 8000);
        const testRes = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Leadgrid-Signature": `sha256=${sig}`,
            "X-Leadgrid-Event": "test.endpoint_created",
            "X-Leadgrid-Delivery": eventId,
            "X-Leadgrid-Timestamp": String(timestamp),
          },
          body: testPayload,
          signal: controller.signal,
        });
        clearTimeout(t);
        autoTestStatus = testRes.status;
        autoTestPassed = autoTestStatus >= 200 && autoTestStatus < 300;
      } catch (e) {
        console.error("[webhook auto-test on create]", e);
      }

      await pool.query(
        `UPDATE partner_webhook_endpoints
            SET auto_test_passed_at = CASE WHEN $1 THEN now() ELSE NULL END,
                auto_test_last_status = $2,
                is_active = $1
          WHERE id = $3`,
        [autoTestPassed, autoTestStatus, r.rows[0].id],
      );

      res.status(201).json({
        data: r.rows[0],
        signing_secret: signingSecret,
        auto_test: {
          passed: autoTestPassed,
          status: autoTestStatus,
          activated: autoTestPassed,
        },
        warning: autoTestPassed
          ? "Kopier secret NÅ — vises ikke igjen. Bruk i HMAC-signering. Endpoint er auto-aktivert (test OK)."
          : `Kopier secret NÅ. Endpoint er DEAKTIVERT — auto-test feilet (status ${autoTestStatus || 'timeout'}). Manuell aktivering kreves.`,
      });
    } catch (e: any) {
      console.error("[webhook-endpoints create]", e);
      res.status(500).json({ error: e.message ?? "Feil" });
    }
  });

  // GET /api/superadmin/webhook-endpoints
  app.get("/api/superadmin/webhook-endpoints", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    try {
      const r = await pool.query(
        `SELECT e.id::text, e.url, e.description, e.events, e.is_active,
                e.partner_id::text, e.organization_id::text,
                e.last_delivery_at::text, e.last_success_at::text,
                e.last_failure_at::text, e.consecutive_failures,
                e.auto_disabled_at::text, e.created_at::text,
                p.name AS partner_name,
                o.name AS organization_name
           FROM partner_webhook_endpoints e
           LEFT JOIN leadgrid_partners p ON p.id = e.partner_id
           LEFT JOIN organizations o ON o.id = e.organization_id
          ORDER BY e.created_at DESC LIMIT 200`,
      );
      res.json({ data: r.rows });
    } catch (err) {
      console.warn("[webhook-endpoints] list failed:", (err as Error).message);
      res.json({ data: [] });
    }
  });

  // PATCH /api/superadmin/webhook-endpoints/:id
  app.patch("/api/superadmin/webhook-endpoints/:id", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const { url, events, description, is_active } = req.body ?? {};
    const updates: string[] = [];
    const values: any[] = [];
    let i = 1;
    if (url !== undefined) { updates.push(`url = $${i++}`); values.push(url); }
    if (events !== undefined) { updates.push(`events = $${i++}::text[]`); values.push(events); }
    if (description !== undefined) { updates.push(`description = $${i++}`); values.push(description); }
    if (is_active !== undefined) {
      updates.push(`is_active = $${i++}`); values.push(is_active);
      if (is_active === true) updates.push(`auto_disabled_at = NULL, consecutive_failures = 0`);
    }
    if (updates.length === 0) return res.status(400).json({ error: "Ingenting å oppdatere" });
    values.push(req.params.id);
    await pool.query(
      `UPDATE partner_webhook_endpoints SET ${updates.join(", ")} WHERE id = $${i}`,
      values,
    );
    res.json({ ok: true });
  });

  // DELETE
  app.delete("/api/superadmin/webhook-endpoints/:id", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    await pool.query(`DELETE FROM partner_webhook_endpoints WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  });

  // POST .../:id/test — send test-event
  app.post("/api/superadmin/webhook-endpoints/:id/test", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const epR = await pool.query<{ partner_id: string | null; organization_id: string | null }>(
      `SELECT partner_id::text, organization_id::text
         FROM partner_webhook_endpoints WHERE id = $1`,
      [req.params.id],
    );
    if (epR.rows.length === 0) return res.status(404).json({ error: "Endpoint ikke funnet" });
    const ep = epR.rows[0];
    const result = await deliverWebhook(pool, {
      eventId: crypto.randomUUID(),
      eventType: "test.ping",
      data: {
        message: "Dette er et test-event fra Leadgrid",
        sent_at: new Date().toISOString(),
        sent_by: s.email,
      },
      organizationId: ep.organization_id ?? undefined,
      partnerId: ep.partner_id ?? undefined,
    });
    res.json({ ok: true, ...result });
  });

  // GET /api/superadmin/webhook-deliveries
  app.get("/api/superadmin/webhook-deliveries", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const r = await pool.query(
      `SELECT a.id::text, a.endpoint_id::text, a.event_type, a.event_id::text,
              a.attempt_number, a.scheduled_at::text, a.attempted_at::text,
              a.response_status, a.duration_ms, a.success, a.error_message,
              a.next_retry_at::text,
              e.url AS endpoint_url
         FROM webhook_delivery_attempts a
         JOIN partner_webhook_endpoints e ON e.id = a.endpoint_id
        ORDER BY a.scheduled_at DESC LIMIT 100`,
    );
    res.json({ data: r.rows });
  });

  // POST /api/superadmin/webhook-deliveries/process (cron-trigger)
  app.post("/api/superadmin/webhook-deliveries/process", async (req, res) => {
    // Tillat enten cron-token eller super-admin
    const headerToken = req.headers["x-cron-trigger-token"] as string | undefined;
    if (!headerToken || !CRON_TOKEN || headerToken !== CRON_TOKEN) {
      const s = await requireSuperAdmin(req, res, pool, activeSessions);
      if (!s) return;
    }
    const result = await processPendingDeliveries(pool);
    res.json({ ok: true, ...result });
  });
}
