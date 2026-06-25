/**
 * leadgrid-agent-bridge-routes.ts
 *
 * Endepunkter:
 *   POST /api/leadgrid/leads/:id/full-intelligence
 *        — Generer en fersk full Role Room Agent-rapport
 *          (body: { modules?: ModuleKey[] } — default: alle)
 *   GET  /api/leadgrid/leads/:id/full-intelligence
 *        — Hent siste cachede rapport (enrichment_data.full_intelligence)
 *   POST /api/leadgrid/leads/:id/full-intelligence/refresh
 *        — Eksplisitt re-generer (samme som POST uten modules-filter)
 *
 * Auth: Bearer-token + RBAC leadgrid.research.run.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";
import {
  generateFullIntelligenceReport,
  type ModuleKey,
} from "./leadgrid-agent-bridge-service.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

function getSession(
  req: Request,
  activeSessions: Map<string, SessionData>,
): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const s = activeSessions.get(auth.slice(7));
    if (s) return s;
  }
  return null;
}

async function resolveOrgIdSmart(
  req: Request,
  pool: Pool,
  userId: string,
): Promise<string | null> {
  const explicit = req.body?.organization_id ?? req.query?.organization_id;
  if (typeof explicit === "string" && explicit.length > 0) return explicit;
  const leadId = req.params?.id;
  if (typeof leadId === "string" && leadId.length > 0) {
    try {
      const r = await pool.query<{ organization_id: string | null }>(
        `SELECT cp.organization_id::text
           FROM crm_customers c
           LEFT JOIN casting_projects cp ON cp.id = c.project_id
          WHERE c.id = $1::uuid LIMIT 1`,
        [leadId],
      );
      if (r.rows[0]?.organization_id) return r.rows[0].organization_id;
    } catch {
      /* ignore */
    }
  }
  try {
    const r = await pool.query<{ organization_id: string }>(
      `SELECT organization_id::text
         FROM organization_members
        WHERE user_id = $1
        ORDER BY CASE role
          WHEN 'admin' THEN 1
          WHEN 'salgssjef' THEN 2
          ELSE 3
        END, joined_at ASC
        LIMIT 1`,
      [userId],
    );
    return r.rows[0]?.organization_id ?? null;
  } catch {
    return null;
  }
}

export function registerLeadgridAgentBridgeRoutes(deps: Deps): void {
  const { app, pool, activeSessions } = deps;
  const common = { pool, activeSessions, resolveOrgId: resolveOrgIdSmart };
  const perm = requireLeadMapPermission("leadgrid.research.run", common);

  // ─── Generer ny rapport ──────────────────────────────────────────
  app.post(
    "/api/leadgrid/leads/:id/full-intelligence",
    perm,
    async (req: Request, res: Response) => {
      const session = getSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      const b = req.body as { modules?: ModuleKey[] };
      try {
        const report = await generateFullIntelligenceReport(
          pool,
          req.params.id,
          { modules: b.modules, callerUserId: session.userId },
        );
        res.json({ report });
      } catch (err) {
        res.status(500).json({ error: "generate_failed", detail: String(err) });
      }
    },
  );

  // ─── Hent cached rapport ─────────────────────────────────────────
  app.get(
    "/api/leadgrid/leads/:id/full-intelligence",
    perm,
    async (req: Request, res: Response) => {
      try {
        const r = await pool.query<{
          data: unknown;
          ts: string | null;
        }>(
          `SELECT enrichment_data->'full_intelligence' AS data,
                  enrichment_data->>'full_intelligence_at' AS ts
             FROM crm_customers WHERE id=$1::uuid`,
          [req.params.id],
        );
        if (!r.rows[0]?.data) {
          res.json({ report: null, cached: false });
          return;
        }
        res.json({
          report: r.rows[0].data,
          cached: true,
          cached_at: r.rows[0].ts,
        });
      } catch (err) {
        res.status(500).json({ error: "read_failed", detail: String(err) });
      }
    },
  );

  // ─── Eksplisitt refresh (samme som POST uten modules-filter) ─────
  app.post(
    "/api/leadgrid/leads/:id/full-intelligence/refresh",
    perm,
    async (req: Request, res: Response) => {
      const session = getSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      try {
        const report = await generateFullIntelligenceReport(
          pool,
          req.params.id,
          { callerUserId: session.userId },
        );
        res.json({ report });
      } catch (err) {
        res.status(500).json({ error: "refresh_failed", detail: String(err) });
      }
    },
  );
}
