/**
 * insights-routes.ts — Innsiktsmotoren fase 1 (docs/integration-audit/10)
 *
 *   POST  /api/integrations/insights/run   (CRON_TRIGGER_TOKEN)
 *         Kjører alle detektorer for alle org-er med signaler.
 *   GET   /api/integrations/insights?status=new|seen|dismissed|actioned|all
 *         Admin, org-scopet.
 *   PATCH /api/integrations/insights/:id   body: { status }
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import {
  listOrganizationsWithSignals,
  runInsightDetectors,
} from "./insight-engine.js";
import { runInsightDiagnostics } from "./insight-diagnostics.js";
import { resolveOrgIdForUser } from "../leadgrid-org-resolver.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
  isAdminEmail: (email: string | undefined) => boolean;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_STATUSES = new Set(["new", "seen", "dismissed", "actioned"]);

function getSession(req: Request, activeSessions: Map<string, SessionData>): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return activeSessions.get(auth.slice(7).trim()) ?? null;
  return null;
}

export function registerInsightsRoutes({ app, pool, activeSessions, isAdminEmail }: Deps): void {
  async function requireAdminWithOrg(req: Request, res: Response) {
    const session = getSession(req, activeSessions);
    if (!session) { res.status(401).json({ error: "ikke_innlogget" }); return null; }
    if (session.role !== "admin" && !isAdminEmail(session.email)) {
      res.status(403).json({ error: "krever_admin" });
      return null;
    }
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    if (!UUID_PATTERN.test(orgId)) {
      res.status(409).json({ error: "ingen_organisasjon" });
      return null;
    }
    return { session, orgId };
  }

  app.post("/api/integrations/insights/run", async (req, res) => {
    const token = req.headers["x-cron-token"];
    const expected = process.env.CRON_TRIGGER_TOKEN;
    if (!expected || token !== expected) {
      return res.status(403).json({ error: "invalid_cron_token" });
    }
    try {
      const orgs = await listOrganizationsWithSignals(pool);
      const results = [];
      let diagnosed = 0;
      for (const orgId of orgs) {
        results.push(await runInsightDetectors(pool, orgId));
        // Fase 2: diagnostiser nye innsikter (best effort — velter aldri kjøringen)
        try {
          const d = await runInsightDiagnostics(pool, orgId);
          diagnosed += d.generated;
          if (d.errors.length > 0) console.warn("[insights] diagnose-feil:", d.errors.join(" | "));
        } catch (err) {
          console.warn("[insights] diagnostikk feilet for org", orgId, String(err).slice(0, 120));
        }
      }
      const inserted = results.reduce((s, r) => s + r.inserted, 0);
      const errors = results.flatMap((r) => r.errors);
      if (errors.length > 0) console.warn("[insights] detektor-feil:", errors.join(" | "));
      return res.json({ organizations: orgs.length, inserted, diagnosed, errors });
    } catch (err) {
      console.error("[insights] run failed", err);
      return res.status(500).json({ error: "run_failed" });
    }
  });

  app.get("/api/integrations/insights", async (req, res) => {
    const auth = await requireAdminWithOrg(req, res);
    if (!auth) return;
    const status = typeof req.query.status === "string" ? req.query.status : "new";
    try {
      const conditions = ["organization_id = $1::uuid"];
      const params: unknown[] = [auth.orgId];
      if (status !== "all" && VALID_STATUSES.has(status)) {
        params.push(status);
        conditions.push(`status = $${params.length}`);
      }
      const r = await pool.query(
        `SELECT id::text, detector, severity, confidence, title, explanation,
                evidence, topic, status, detected_at::text, diagnosis, dedupe_key
           FROM insights
          WHERE ${conditions.join(" AND ")}
          ORDER BY detected_at DESC LIMIT 50`,
        params,
      );
      return res.json({ insights: r.rows });
    } catch (err) {
      console.error("[insights] list failed", err);
      return res.status(500).json({ error: "list_failed" });
    }
  });

  app.patch("/api/integrations/insights/:id", async (req, res) => {
    const auth = await requireAdminWithOrg(req, res);
    if (!auth) return;
    const status = (req.body as Record<string, unknown> | undefined)?.status;
    if (typeof status !== "string" || !VALID_STATUSES.has(status)) {
      return res.status(400).json({ error: "ugyldig_status" });
    }
    try {
      const r = await pool.query(
        `UPDATE insights SET status = $3
          WHERE id = $1::uuid AND organization_id = $2::uuid`,
        [req.params.id, auth.orgId, status],
      );
      if ((r.rowCount ?? 0) === 0) return res.status(404).json({ error: "not_found" });
      return res.json({ updated: true });
    } catch (err) {
      return res.status(500).json({ error: "update_failed" });
    }
  });
}
