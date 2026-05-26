/**
 * presence-heartbeat-routes.ts
 *
 * Klient pinger POST /api/presence/heartbeat hvert 30 sek mens tab er
 * aktiv. Vi upserter user_presence-rad med last_seen_at = NOW().
 *
 * Aktiv-nå i Admin Room = last_seen_at > NOW() - INTERVAL '90 sec'.
 */

import type express from "express";
import type { Pool } from "pg";
import type { AdminSession } from "./_shared";
import { asString } from "./_shared";

interface PresenceDeps {
  app: express.Application;
  pool: Pool;
  getActiveSessionFromRequest: (req: express.Request) => AdminSession | null;
}

export function setupPresenceHeartbeatRoutes(deps: PresenceDeps): void {
  const { app, pool, getActiveSessionFromRequest } = deps;

  app.post("/api/presence/heartbeat", async (req, res) => {
    const session = getActiveSessionFromRequest(req);
    if (!session) {
      res.status(401).json({ error: "Ikke innlogget" });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const currentRoute = asString(body.route)?.slice(0, 200) ?? null;
    const isIdle = body.idle === true;
    const userAgent = (req.headers["user-agent"] ?? "").toString();
    // Komprimert user-agent: bare browser + OS, ingen versjon-noise
    const uaShort = userAgent.includes("Chrome") ? "Chrome"
      : userAgent.includes("Firefox") ? "Firefox"
      : userAgent.includes("Safari") ? "Safari"
      : userAgent.includes("Edge") ? "Edge"
      : "Other";
    const osShort = userAgent.includes("Mac") ? "macOS"
      : userAgent.includes("Windows") ? "Windows"
      : userAgent.includes("iPhone") ? "iOS"
      : userAgent.includes("Android") ? "Android"
      : userAgent.includes("Linux") ? "Linux"
      : "Other";

    try {
      await pool.query(
        `INSERT INTO user_presence (user_id, last_seen_at, current_route, is_idle, user_agent_short, session_started_at, total_session_count)
         VALUES ($1, NOW(), $2, $3, $4, NOW(), 1)
         ON CONFLICT (user_id) DO UPDATE SET
           last_seen_at = NOW(),
           current_route = EXCLUDED.current_route,
           is_idle = EXCLUDED.is_idle,
           user_agent_short = EXCLUDED.user_agent_short,
           session_started_at = CASE
             WHEN user_presence.last_seen_at < NOW() - INTERVAL '30 minutes' THEN NOW()
             ELSE user_presence.session_started_at
           END,
           total_session_count = CASE
             WHEN user_presence.last_seen_at < NOW() - INTERVAL '30 minutes' THEN user_presence.total_session_count + 1
             ELSE user_presence.total_session_count
           END,
           updated_at = NOW()`,
        [session.userId, currentRoute, isIdle, `${uaShort}/${osShort}`],
      );
      res.json({ ok: true, ts: new Date().toISOString() });
    } catch (err) {
      console.error("[presence] heartbeat error", err);
      res.status(500).json({ error: "Kunne ikke registrere presence" });
    }
  });
}
