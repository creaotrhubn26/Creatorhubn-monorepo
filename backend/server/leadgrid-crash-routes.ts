/**
 * leadgrid-crash-routes.ts
 *
 * Krasjrapportering (2026-07-18) — launch-blocker fra readiness-listen.
 * iPad-appen fanger krasj/heng via MetricKit og poster diagnostikken hit
 * ved neste oppstart. Superadmin leser oversikten (Control Center-
 * kandidat). Ingen ekstern avhengighet (Sentry-iOS kan legges oppå).
 *
 * Auth:
 *   • POST /api/leadgrid/crash-reports — krever innlogget sesjon (krasj
 *     leveres av MetricKit ved NESTE oppstart, da er brukeren normalt
 *     innlogget igjen). Payload cappes til 256KB; maks 20 per kall.
 *   • GET /api/superadmin/crash-reports — super_admin (users.role).
 *
 * Forutsetter mig 0387 (leadgrid_crash_reports).
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { resolveOrgIdForUser } from "./leadgrid-org-resolver.js";

type SessionUser = {
  userId: string;
  email: string;
  name: string;
  role: string;
};

export interface CrashRoutesDeps {
  app: Express;
  pool: Pool;
  requireUserSession: (req: Request, res: Response) => SessionUser | null;
}

const VALID_KINDS = new Set(["crash", "hang", "cpu", "disk"]);
const MAX_PAYLOAD_BYTES = 256 * 1024;

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

export function registerLeadgridCrashRoutes(deps: CrashRoutesDeps): void {
  const { app, pool, requireUserSession } = deps;

  // ── POST /api/leadgrid/crash-reports — batch fra MetricKit ────────
  app.post("/api/leadgrid/crash-reports", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const orgId = await resolveOrgIdForUser(pool, session.userId).catch(() => null);
    const b = (req.body ?? {}) as Record<string, unknown>;
    const reports = Array.isArray(b.reports) ? b.reports.slice(0, 20) : [];
    if (reports.length === 0) {
      return res.status(400).json({ error: "ingen_rapporter" });
    }
    let stored = 0;
    for (const raw of reports) {
      const r = (raw ?? {}) as Record<string, unknown>;
      const kind = VALID_KINDS.has(str(r.kind)) ? str(r.kind) : "crash";
      let payload = "{}";
      try {
        payload = JSON.stringify(r.payload ?? {});
        if (payload.length > MAX_PAYLOAD_BYTES) {
          payload = JSON.stringify({
            truncated: true,
            head: payload.slice(0, MAX_PAYLOAD_BYTES),
          });
        }
      } catch { payload = "{}"; }
      try {
        await pool.query(
          `INSERT INTO leadgrid_crash_reports
             (id, organization_id, user_id, user_email, app_version,
              build_number, os_version, device_model, kind,
              termination_reason, signal, payload)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)`,
          [
            (globalThis.crypto as { randomUUID: () => string }).randomUUID(),
            orgId, session.userId, session.email ?? "",
            str(r.app_version).slice(0, 30),
            str(r.build_number).slice(0, 30),
            str(r.os_version).slice(0, 40),
            str(r.device_model).slice(0, 60),
            kind,
            str(r.termination_reason).slice(0, 500),
            str(r.signal).slice(0, 60),
            payload,
          ],
        );
        stored++;
      } catch (e) {
        console.warn("[crash-reports] insert feilet:", (e as Error).message);
      }
    }
    return res.status(201).json({ stored });
  });

  // ── GET /api/superadmin/crash-reports — oversikt ──────────────────
  app.get("/api/superadmin/crash-reports", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const roleR = await pool.query<{ role: string }>(
        `SELECT role FROM users WHERE id = $1`, [session.userId],
      );
      if (roleR.rows[0]?.role !== "super_admin") {
        return res.status(403).json({ error: "krever_super_admin" });
      }
      const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
      const r = await pool.query(
        `SELECT id::text, organization_id, user_email, app_version,
                build_number, os_version, device_model, kind,
                termination_reason, signal, created_at
           FROM leadgrid_crash_reports
          ORDER BY created_at DESC
          LIMIT $1`,
        [limit],
      );
      const agg = await pool.query(
        `SELECT build_number, kind, COUNT(*)::int AS n
           FROM leadgrid_crash_reports
          WHERE created_at > now() - interval '30 days'
          GROUP BY build_number, kind
          ORDER BY n DESC
          LIMIT 20`,
      );
      return res.json({ reports: r.rows, by_build_30d: agg.rows });
    } catch (err) {
      console.warn("[crash-reports] list feilet:", (err as Error).message);
      return res.status(500).json({ error: "list_failed" });
    }
  });

  // ── GET /api/superadmin/crash-reports/:id — full payload ──────────
  app.get("/api/superadmin/crash-reports/:id", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const roleR = await pool.query<{ role: string }>(
        `SELECT role FROM users WHERE id = $1`, [session.userId],
      );
      if (roleR.rows[0]?.role !== "super_admin") {
        return res.status(403).json({ error: "krever_super_admin" });
      }
      const r = await pool.query(
        `SELECT * FROM leadgrid_crash_reports WHERE id = $1::uuid LIMIT 1`,
        [req.params.id],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "ikke_funnet" });
      return res.json({ report: r.rows[0] });
    } catch (err) {
      return res.status(500).json({ error: "get_failed" });
    }
  });
}
