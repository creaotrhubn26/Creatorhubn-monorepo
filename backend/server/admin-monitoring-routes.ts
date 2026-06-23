/**
 * admin-monitoring-routes.ts
 *
 * Plattform-gruppe: centralized monitoring + protocols.
 *
 * Task #116 har erstattet de tidligere read-only-stubene med ekte spørringer
 * mot `system_events`-tabellen (eksisterte fra 0001_loose_kulan_gath.sql, og
 * får hjelpe-indekser + seed via 232_admin_system_events.sql). Når det ikke
 * finnes konfigurasjons-tabeller for selve protokoll-katalogen og endpoint-
 * listen, returnerer rutene en default-katalog så MonitoringTab kan rendre.
 *
 * Endpoints:
 *   GET /api/admin/monitoring-protocols     — overvåkings-protokoll-katalog
 *   GET /api/admin/api-endpoints/health     — endpoint health-score
 *   GET /api/admin/system-events            — siste system_events (filtrerbar)
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

/**
 * Defensiv sjekk: returnerer true hvis tabellen finnes i det aktive skjemaet.
 * Brukes for å falle tilbake til default-kataloger uten å kaste en stygg
 * "relation does not exist"-feil i loggen.
 */
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

const DEFAULT_MONITORING_PROTOCOLS = [
  {
    id: "system-health",
    name: "System Health",
    description: "Aggregert health-probe + DB-ping",
    enabled: true,
    interval: "5m",
    source: "default",
  },
  {
    id: "api-latency",
    name: "API Latency",
    description: "p50 / p95 / p99 pr. endpoint",
    enabled: true,
    interval: "1m",
    source: "default",
  },
  {
    id: "queue-depth",
    name: "Job Queue Depth",
    description: "Antall ventende jobs pr. kø",
    enabled: true,
    interval: "1m",
    source: "default",
  },
  {
    id: "auth-failures",
    name: "Auth Failures",
    description: "Mislykkede innlogginger siste timen",
    enabled: true,
    interval: "5m",
    source: "default",
  },
];

const KNOWN_API_ENDPOINTS = [
  { id: "api-health", path: "/api/health", method: "GET", critical: true },
  { id: "api-admin", path: "/api/admin", method: "GET", critical: true },
  { id: "api-role-room", path: "/api/role-room/projects", method: "GET", critical: true },
  { id: "api-post-agent", path: "/api/post-agent", method: "GET", critical: false },
  { id: "api-talents", path: "/api/talents", method: "GET", critical: false },
  { id: "api-casting", path: "/api/casting", method: "GET", critical: false },
];

export function setupAdminMonitoringRoutes(
  deps: AdminMonitoringRoutesDeps,
): void {
  const { app, pool, requireAdminSession } = deps;

  app.get("/api/admin/monitoring-protocols", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;

      const hasTable = await tableExists(pool, "monitoring_protocols");
      if (!hasTable) {
        res.json({
          protocols: DEFAULT_MONITORING_PROTOCOLS,
          source: "default",
        });
        return;
      }

      try {
        const r = await pool.query(
          `SELECT id, name, description, enabled, interval
             FROM monitoring_protocols
            ORDER BY name ASC`,
        );
        res.json({ protocols: r.rows, source: "db" });
      } catch (innerErr) {
        console.warn(
          "[admin-monitoring] monitoring_protocols fetch failed, falling back to defaults:",
          innerErr,
        );
        res.json({
          protocols: DEFAULT_MONITORING_PROTOCOLS,
          source: "default",
        });
      }
    } catch (err) {
      console.error("[admin-monitoring] protocols failed:", err);
      res.status(500).json({ error: "monitoring_protocols_failed" });
    }
  });

  app.get("/api/admin/api-endpoints/health", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;

      // Aggreger fra system_events: tell error/warning/info pr. source siste 24t.
      let perSource: Record<
        string,
        { error: number; warning: number; info: number; lastEventAt: string | null }
      > = {};
      let aggregateAvailable = false;

      const eventsExist = await tableExists(pool, "system_events");
      if (eventsExist) {
        try {
          const r = await pool.query<{
            source: string | null;
            severity: string;
            cnt: string;
            last_event_at: string | null;
          }>(
            `SELECT source,
                    severity,
                    COUNT(*)::text AS cnt,
                    MAX(timestamp)::text AS last_event_at
               FROM system_events
              WHERE timestamp > now() - INTERVAL '24 hours'
              GROUP BY source, severity`,
          );
          for (const row of r.rows) {
            const src = row.source ?? "unknown";
            if (!perSource[src]) {
              perSource[src] = { error: 0, warning: 0, info: 0, lastEventAt: null };
            }
            const n = Number(row.cnt) || 0;
            if (row.severity === "error" || row.severity === "critical") {
              perSource[src].error += n;
            } else if (row.severity === "warning") {
              perSource[src].warning += n;
            } else {
              perSource[src].info += n;
            }
            if (
              row.last_event_at &&
              (!perSource[src].lastEventAt ||
                row.last_event_at > (perSource[src].lastEventAt as string))
            ) {
              perSource[src].lastEventAt = row.last_event_at;
            }
          }
          aggregateAvailable = true;
        } catch (innerErr) {
          console.warn(
            "[admin-monitoring] api health aggregate failed:",
            innerErr,
          );
        }
      }

      const endpoints = KNOWN_API_ENDPOINTS.map((ep) => {
        // Match enten på id eller på path-prefix mot source-feltet i system_events.
        const stats =
          perSource[ep.id] ??
          perSource[ep.path] ??
          perSource[`api${ep.path}`] ??
          null;
        const errorCount = stats?.error ?? 0;
        const warningCount = stats?.warning ?? 0;
        let status: "up" | "degraded" | "down";
        if (errorCount >= 5) status = "down";
        else if (errorCount > 0 || warningCount >= 3) status = "degraded";
        else status = "up";
        return {
          ...ep,
          status,
          errorCount,
          warningCount,
          lastEventAt: stats?.lastEventAt ?? null,
        };
      });

      const upCount = endpoints.filter((e) => e.status === "up").length;
      const healthScore = endpoints.length
        ? Math.round((upCount / endpoints.length) * 100)
        : 100;

      res.json({
        endpoints,
        healthScore,
        windowHours: 24,
        source: aggregateAvailable ? "system_events" : "static",
      });
    } catch (err) {
      // Graceful: returnér tom endpoints-liste (iPad: "Sources (0)").
      console.warn("[admin-monitoring] api health failed:", (err as Error).message);
      res.json({
        endpoints: [],
        healthScore: 100,
        windowHours: 24,
        source: "static",
      });
    }
  });

  app.get("/api/admin/system-events", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;

      // Query-parametre: limit (default 50, max 500), since (ISO-tid),
      // severity (info|warning|error|critical), category.
      const limitRaw = Number.parseInt(String(req.query.limit ?? "50"), 10);
      const limit = Math.min(
        Math.max(Number.isFinite(limitRaw) ? limitRaw : 50, 1),
        500,
      );
      const since =
        typeof req.query.since === "string" && req.query.since.length > 0
          ? req.query.since
          : null;
      const severity =
        typeof req.query.severity === "string" && req.query.severity.length > 0
          ? req.query.severity
          : null;
      const category =
        typeof req.query.category === "string" && req.query.category.length > 0
          ? req.query.category
          : null;

      const eventsExist = await tableExists(pool, "system_events");
      if (!eventsExist) {
        console.warn(
          "[admin-monitoring] system_events-tabellen finnes ikke — returnerer tom liste",
        );
        res.json({ events: [], total: 0, source: "none" });
        return;
      }

      try {
        const conditions: string[] = [];
        const params: unknown[] = [];
        if (since) {
          params.push(since);
          conditions.push(`timestamp >= $${params.length}`);
        }
        if (severity) {
          params.push(severity);
          conditions.push(`severity = $${params.length}`);
        }
        if (category) {
          params.push(category);
          conditions.push(`category = $${params.length}`);
        }
        const whereClause = conditions.length
          ? `WHERE ${conditions.join(" AND ")}`
          : "";
        params.push(limit);
        const limitIndex = params.length;

        const r = await pool.query(
          `SELECT id,
                  timestamp,
                  severity,
                  category,
                  source,
                  message,
                  details,
                  resolved,
                  metadata
             FROM system_events
             ${whereClause}
             ORDER BY timestamp DESC
             LIMIT $${limitIndex}`,
          params,
        );
        res.json({
          events: r.rows,
          total: r.rows.length,
          source: "system_events",
          filters: { since, severity, category, limit },
        });
      } catch (innerErr) {
        console.warn(
          "[admin-monitoring] system_events fetch failed:",
          innerErr,
        );
        res.json({ events: [], total: 0, source: "error" });
      }
    } catch (err) {
      console.error("[admin-monitoring] system-events failed:", err);
      res.status(500).json({ error: "system_events_failed" });
    }
  });
}
