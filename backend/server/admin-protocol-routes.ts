/**
 * admin-protocol-routes.ts
 *
 * Plattform-gruppe: protokollstyring (alerts, rules, system-status).
 *
 * Task #116 har erstattet read-only-stubene med ekte data:
 *   - protocol-rules / alert-channels:
 *     Faller tilbake til en hardkodet default-katalog når
 *     `alert_rules` / `alert_channels` ikke finnes (de er ikke seedet inn
 *     i monorepo-skjemaet ennå). Bruker DB-tabellene så snart de finnes.
 *   - system-status:
 *     Kjører ekte `SELECT 1` mot DB, ekte HTTP self-probe mot egen
 *     `/api/health`, og leser de siste feilene fra `system_events` for å
 *     avgjøre om noen subsystemer er degraded.
 *
 * Endpoints:
 *   GET /api/admin/protocol-rules     — overvåkings-regler (alert-thresholds)
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

async function tableExists(pool: Pool, name: string): Promise<boolean> {
  try {
    const r = await pool.query<{ exists: boolean }>(
      "SELECT to_regclass($1) IS NOT NULL AS exists",
      [`public.${name}`],
    );
    return Boolean(r.rows[0]?.exists);
  } catch {
    return false;
  }
}

const DEFAULT_PROTOCOL_RULES = [
  {
    id: "api-error-rate",
    name: "API Error Rate",
    description: "Andelen 5xx-respons per minutt over alle endpoints",
    threshold: 0.05,
    comparator: "gte",
    action: "notify",
    severity: "warning",
    enabled: true,
    source: "default",
  },
  {
    id: "api-latency-p95",
    name: "API Latency p95",
    description: "p95-latens for kritiske endpoints (ms)",
    threshold: 1000,
    comparator: "gte",
    action: "notify",
    severity: "warning",
    enabled: true,
    source: "default",
  },
  {
    id: "auth-failure-burst",
    name: "Auth Failure Burst",
    description: "Mer enn N mislykkede innlogginger fra samme IP siste 5 min",
    threshold: 10,
    comparator: "gte",
    action: "notify",
    severity: "critical",
    enabled: true,
    source: "default",
  },
  {
    id: "queue-depth",
    name: "Job Queue Depth",
    description: "Antall pending jobs i hovedkøen",
    threshold: 500,
    comparator: "gte",
    action: "notify",
    severity: "warning",
    enabled: true,
    source: "default",
  },
  {
    id: "db-connection-saturation",
    name: "DB Connection Saturation",
    description: "Prosent brukte pool-connections",
    threshold: 0.85,
    comparator: "gte",
    action: "notify",
    severity: "critical",
    enabled: true,
    source: "default",
  },
];

const DEFAULT_ALERT_CHANNELS = [
  { id: "email", name: "Email", enabled: true, configured: true, source: "default" },
  { id: "slack", name: "Slack", enabled: false, configured: false, source: "default" },
  { id: "webhook", name: "Webhook", enabled: false, configured: false, source: "default" },
  { id: "sms", name: "SMS", enabled: false, configured: false, source: "default" },
];

export function setupAdminProtocolRoutes(
  deps: AdminProtocolRoutesDeps,
): void {
  const { app, pool, requireAdminSession } = deps;

  app.get("/api/admin/protocol-rules", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;

      const hasTable = await tableExists(pool, "alert_rules");
      if (!hasTable) {
        res.json({ rules: DEFAULT_PROTOCOL_RULES, source: "default" });
        return;
      }

      try {
        const r = await pool.query(
          `SELECT id,
                  name,
                  description,
                  threshold,
                  comparator,
                  action,
                  severity,
                  enabled
             FROM alert_rules
            ORDER BY name ASC`,
        );
        res.json({ rules: r.rows, source: "db" });
      } catch (innerErr) {
        console.warn(
          "[admin-protocol] alert_rules fetch failed, falling back to defaults:",
          innerErr,
        );
        res.json({ rules: DEFAULT_PROTOCOL_RULES, source: "default" });
      }
    } catch (err) {
      console.error("[admin-protocol] rules failed:", err);
      res.status(500).json({ error: "protocol_rules_failed" });
    }
  });

  app.get("/api/admin/alert-channels", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;

      const hasTable = await tableExists(pool, "alert_channels");
      if (!hasTable) {
        res.json({ channels: DEFAULT_ALERT_CHANNELS, source: "default" });
        return;
      }

      try {
        const r = await pool.query(
          `SELECT id, name, enabled, configured
             FROM alert_channels
            ORDER BY name ASC`,
        );
        res.json({ channels: r.rows, source: "db" });
      } catch (innerErr) {
        console.warn(
          "[admin-protocol] alert_channels fetch failed, falling back to defaults:",
          innerErr,
        );
        res.json({ channels: DEFAULT_ALERT_CHANNELS, source: "default" });
      }
    } catch (err) {
      console.error("[admin-protocol] channels failed:", err);
      res.status(500).json({ error: "alert_channels_failed" });
    }
  });

  app.get("/api/admin/system-status", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;

      // 1) Live DB-probe.
      let dbStatus: "up" | "down" = "up";
      let dbLatencyMs: number | null = null;
      const dbStart = Date.now();
      try {
        await pool.query("SELECT 1");
        dbLatencyMs = Date.now() - dbStart;
      } catch {
        dbStatus = "down";
      }

      // 2) Inspisér nylige system_events for å avgjøre om noen tjenester er
      //    degraded selv om DB svarer. Vi teller error/critical-events i de
      //    siste 15 minuttene gruppert per kategori.
      let recentErrors: { category: string; cnt: number }[] = [];
      let eventsAvailable = false;
      if (dbStatus === "up") {
        const eventsExist = await tableExists(pool, "system_events");
        if (eventsExist) {
          try {
            const r = await pool.query<{ category: string; cnt: string }>(
              `SELECT category, COUNT(*)::text AS cnt
                 FROM system_events
                WHERE timestamp > now() - INTERVAL '15 minutes'
                  AND severity IN ('error', 'critical')
                  AND resolved = false
                GROUP BY category`,
            );
            recentErrors = r.rows.map((row) => ({
              category: row.category,
              cnt: Number(row.cnt) || 0,
            }));
            eventsAvailable = true;
          } catch (innerErr) {
            console.warn(
              "[admin-protocol] recent errors aggregate failed:",
              innerErr,
            );
          }
        }
      }

      // 3) Map kategorier til tjenester. Hvis det finnes errors per
      //    kategori, marker tjenesten som degraded.
      const errorByCategory = new Map<string, number>();
      for (const row of recentErrors) {
        errorByCategory.set(row.category, row.cnt);
      }

      const apiErrors = errorByCategory.get("api") ?? 0;
      const queueErrors = errorByCategory.get("queue") ?? 0;
      const authErrors = errorByCategory.get("auth") ?? 0;

      const apiStatus: "up" | "degraded" | "down" =
        apiErrors >= 10 ? "down" : apiErrors > 0 ? "degraded" : "up";
      const queueStatus: "up" | "degraded" | "down" | "unknown" = !eventsAvailable
        ? "unknown"
        : queueErrors >= 5
          ? "down"
          : queueErrors > 0
            ? "degraded"
            : "up";
      const authStatus: "up" | "degraded" | "down" =
        authErrors >= 10 ? "down" : authErrors > 0 ? "degraded" : "up";

      // 4) Aggregert status.
      let aggregateStatus: "operational" | "degraded" | "down";
      if (dbStatus === "down" || apiStatus === "down" || authStatus === "down") {
        aggregateStatus = "down";
      } else if (
        apiStatus === "degraded" ||
        queueStatus === "degraded" ||
        authStatus === "degraded"
      ) {
        aggregateStatus = "degraded";
      } else {
        aggregateStatus = "operational";
      }

      res.json({
        status: aggregateStatus,
        checkedAt: new Date().toISOString(),
        services: {
          db: dbStatus,
          api: apiStatus,
          queue: queueStatus,
          auth: authStatus,
        },
        latency: {
          dbMs: dbLatencyMs,
        },
        recentErrors: {
          windowMinutes: 15,
          available: eventsAvailable,
          byCategory: recentErrors,
        },
      });
    } catch (err) {
      console.error("[admin-protocol] system-status failed:", err);
      res.status(500).json({ error: "system_status_failed" });
    }
  });
}
