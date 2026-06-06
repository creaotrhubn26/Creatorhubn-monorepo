/**
 * admin-monitoring-routes.ts
 *
 * Plattform-gruppe: centralized monitoring + protocols (read-only stubs).
 * Returnerer tomme lister nå slik at MonitoringTab kan rendre. Senere
 * kobles dette mot system_events-tabellen (finnes alt) + health-prober.
 *
 * Endpoints:
 *   GET /api/admin/monitoring-protocols     — overvåkings-protokoll-katalog
 *   GET /api/admin/api-endpoints/health     — endpoint health-score
 *   GET /api/admin/system-events            — siste system_events
 *
 * Alle krever requireAdminSession.
 */

import type express from "express";
import type { Pool } from "pg";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface AdminMonitoringRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (req: express.Request, res: express.Response) => any;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function setupAdminMonitoringRoutes(
  deps: AdminMonitoringRoutesDeps,
): void {
  const { app, pool, requireAdminSession } = deps;

  app.get("/api/admin/monitoring-protocols", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;
      // TODO: les fra monitoring_protocols-tabell.
      res.json({ protocols: [] });
    } catch (err) {
      console.error("[admin-monitoring] protocols failed:", err);
      res.status(500).json({ error: "monitoring_protocols_failed" });
    }
  });

  app.get("/api/admin/api-endpoints/health", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;
      // TODO: kjør faktisk health-probe + aggreger fra system_events.
      res.json({ endpoints: [], healthScore: 100 });
    } catch (err) {
      console.error("[admin-monitoring] api health failed:", err);
      res.status(500).json({ error: "api_health_failed" });
    }
  });

  app.get("/api/admin/system-events", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;
      try {
        // Defensiv: system_events kan mangle i nyere miljøer.
        const r = await pool.query<{
          id: string;
          timestamp: string;
          severity: string;
          category: string;
          message?: string | null;
        }>(
          `SELECT id, timestamp, severity, category
             FROM system_events
            ORDER BY timestamp DESC
            LIMIT 200`,
        );
        res.json({ events: r.rows, total: r.rows.length });
      } catch (innerErr) {
        console.warn(
          "[admin-monitoring] system_events fetch failed:",
          innerErr,
        );
        res.json({ events: [], total: 0 });
      }
    } catch (err) {
      console.error("[admin-monitoring] system-events failed:", err);
      res.status(500).json({ error: "system_events_failed" });
    }
  });
}
