/**
 * admin-protocol-routes.ts
 *
 * Plattform-gruppe: protokollstyring (alerts, rules, system-status).
 * Stub-endpoints nå; senere kobles disse mot alert_rules + alert_channels +
 * system-health-aggregat.
 *
 * Endpoints:
 *   GET /api/admin/protocol-rules     — overvåkings-regler
 *   GET /api/admin/alert-channels     — alert-kanal-katalog
 *   GET /api/admin/system-status      — operasjonell status pr. service
 *
 * Alle krever requireAdminSession.
 */

import type express from "express";
import type { Pool } from "pg";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface AdminProtocolRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (req: express.Request, res: express.Response) => any;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function setupAdminProtocolRoutes(
  deps: AdminProtocolRoutesDeps,
): void {
  const { app, pool, requireAdminSession } = deps;

  app.get("/api/admin/protocol-rules", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;
      // TODO: les fra alert_rules.
      res.json({ rules: [] });
    } catch (err) {
      console.error("[admin-protocol] rules failed:", err);
      res.status(500).json({ error: "protocol_rules_failed" });
    }
  });

  app.get("/api/admin/alert-channels", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;
      // TODO: les fra alert_channels (Slack, email, SMS, webhooks).
      res.json({ channels: [] });
    } catch (err) {
      console.error("[admin-protocol] channels failed:", err);
      res.status(500).json({ error: "alert_channels_failed" });
    }
  });

  app.get("/api/admin/system-status", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;
      // Live db-probe + statiske api/queue-stubs.
      let dbStatus: "up" | "down" = "up";
      try {
        await pool.query("SELECT 1");
      } catch {
        dbStatus = "down";
      }
      res.json({
        status: dbStatus === "up" ? "operational" : "degraded",
        services: {
          db: dbStatus,
          api: "up",
          queue: "up",
        },
      });
    } catch (err) {
      console.error("[admin-protocol] system-status failed:", err);
      res.status(500).json({ error: "system_status_failed" });
    }
  });
}
