/**
 * web-push-routes.ts
 *
 * Slice 9X.43 — Web Push for PWA. Krever VAPID-nøkler i env:
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:…)
 *
 * Generer med: `npx web-push generate-vapid-keys`
 *
 * Endpoints:
 *   GET  /api/push/public-key            — VAPID public key
 *   POST /api/push/subscribe             — lagre subscription
 *   POST /api/push/unsubscribe           — slett subscription
 *   POST /api/push/test                  — send test til brukerens enheter
 *
 * Export: sendPushToUser(pool, userId, payload) — kalles fra
 *   notification-helper når plan-B aktiveres (parallelt med WS-broadcast).
 */

import type express from "express";
import webPush from "web-push";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface WebPushRoutesDeps {
  app: express.Application;
  pool: any;
  getPricingUserId: (req: any) => string;
}

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:daniel@creatorhubn.com";

let vapidConfigured = false;
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  try {
    webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    vapidConfigured = true;
  } catch (err) {
    console.warn("[web-push] VAPID-konfigurasjon feilet:", err);
  }
} else {
  console.warn("[web-push] VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY ikke satt — push deaktivert");
}

async function ensureSchema(pool: any): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      user_agent TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      last_used_at TIMESTAMPTZ DEFAULT NOW(),
      failure_count INTEGER DEFAULT 0
    )
  `).catch(() => undefined);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions (user_id)`,
  ).catch(() => undefined);
}

export async function sendPushToUser(
  pool: any,
  userId: string,
  payload: { title: string; body: string; url?: string; tag?: string },
): Promise<{ sent: number; failed: number; removed: number }> {
  if (!vapidConfigured) return { sent: 0, failed: 0, removed: 0 };
  await ensureSchema(pool);

  const r = await pool.query(
    `SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1`,
    [userId],
  );
  if (r.rowCount === 0) return { sent: 0, failed: 0, removed: 0 };

  const json = JSON.stringify(payload);
  let sent = 0, failed = 0, removed = 0;
  for (const sub of r.rows) {
    try {
      await webPush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        json,
      );
      sent++;
      await pool.query(
        `UPDATE push_subscriptions SET last_used_at = NOW(), failure_count = 0 WHERE id = $1`,
        [sub.id],
      ).catch(() => undefined);
    } catch (err: any) {
      const status = err?.statusCode || err?.status;
      if (status === 404 || status === 410) {
        // Gone — fjern subscription
        await pool.query(`DELETE FROM push_subscriptions WHERE id = $1`, [sub.id]).catch(() => undefined);
        removed++;
      } else {
        await pool.query(
          `UPDATE push_subscriptions SET failure_count = failure_count + 1 WHERE id = $1`,
          [sub.id],
        ).catch(() => undefined);
        failed++;
      }
    }
  }
  return { sent, failed, removed };
}

export function setupWebPushRoutes(deps: WebPushRoutesDeps): void {
  const { app, pool, getPricingUserId } = deps;

  // ─── GET /api/push/public-key ──────────────────────────────────
  app.get("/api/push/public-key", (_req, res) => {
    if (!vapidConfigured) return res.status(503).json({ error: "VAPID ikke konfigurert" });
    res.json({ publicKey: VAPID_PUBLIC });
  });

  // ─── POST /api/push/subscribe ──────────────────────────────────
  app.post("/api/push/subscribe", async (req, res) => {
    try {
      await ensureSchema(pool);
      const uid = getPricingUserId(req);
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });
      const { endpoint, keys } = req.body || {};
      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return res.status(400).json({ error: "Mangler endpoint eller keys" });
      }
      const userAgent = (req.headers["user-agent"] || "").slice(0, 500);
      await pool.query(
        `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (endpoint) DO UPDATE SET
           user_id = EXCLUDED.user_id,
           p256dh = EXCLUDED.p256dh,
           auth = EXCLUDED.auth,
           user_agent = EXCLUDED.user_agent,
           last_used_at = NOW(),
           failure_count = 0`,
        [uid, endpoint, keys.p256dh, keys.auth, userAgent],
      );
      res.json({ subscribed: true });
    } catch (err) {
      console.error("POST /push/subscribe:", err);
      res.status(500).json({ error: "Kunne ikke lagre subscription" });
    }
  });

  // ─── POST /api/push/unsubscribe ────────────────────────────────
  app.post("/api/push/unsubscribe", async (req, res) => {
    try {
      const { endpoint } = req.body || {};
      if (!endpoint) return res.status(400).json({ error: "endpoint påkrevd" });
      await pool.query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [endpoint]);
      res.json({ unsubscribed: true });
    } catch (err) {
      console.error("POST /push/unsubscribe:", err);
      res.status(500).json({ error: "Kunne ikke fjerne subscription" });
    }
  });

  // ─── POST /api/push/test ───────────────────────────────────────
  app.post("/api/push/test", async (req, res) => {
    try {
      const uid = getPricingUserId(req);
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });
      const result = await sendPushToUser(pool, uid, {
        title: "Creatorhubn — test-varsel",
        body: "Push fungerer! Du får varsler her når plan B aktiveres osv.",
        url: "/",
      });
      res.json(result);
    } catch (err) {
      console.error("POST /push/test:", err);
      res.status(500).json({ error: "Test-push feilet" });
    }
  });
}
