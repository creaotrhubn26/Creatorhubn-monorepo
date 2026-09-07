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
import {
  generateFullIntelligenceReport,
  type ModuleKey,
} from "./leadgrid-agent-bridge-service.js";
import { resolveEffectivePermissions } from "./lead-map-permission-routes.js";
import {
  getLeadgridSession,
  type LeadgridSession,
} from "./leadgrid-project-access.js";
import {
  loadAccessibleLeadgridLead,
  type LeadgridAccessibleLead,
} from "./leadgrid-lead-access.js";

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, LeadgridSession>;
}

async function authorizeLeadResearch(
  req: Request,
  res: Response,
  pool: Pool,
  activeSessions: Map<string, LeadgridSession>,
): Promise<{ session: LeadgridSession; lead: LeadgridAccessibleLead } | null> {
  const session = getLeadgridSession(req, activeSessions);
  if (!session?.userId) {
    res.status(401).json({ error: "Innlogging kreves" });
    return null;
  }
  const lead = await loadAccessibleLeadgridLead(pool, {
    leadId: req.params.id,
    userId: session.userId,
  });
  if (!lead) {
    res.status(404).json({ error: "lead_not_found" });
    return null;
  }
  const access = await resolveEffectivePermissions(
    pool,
    lead.organizationId,
    session.userId,
  );
  if (!access.permissions.has("leadgrid.research.run")) {
    res.status(403).json({ error: "mangler_tillatelse", required: "leadgrid.research.run" });
    return null;
  }
  return { session, lead };
}

export function registerLeadgridAgentBridgeRoutes(deps: Deps): void {
  const { app, pool, activeSessions } = deps;

  // ─── Generer ny rapport ──────────────────────────────────────────
  app.post(
    "/api/leadgrid/leads/:id/full-intelligence",
    async (req: Request, res: Response) => {
      const b = req.body as { modules?: ModuleKey[] };
      try {
        const access = await authorizeLeadResearch(req, res, pool, activeSessions);
        if (!access) return;
        const report = await generateFullIntelligenceReport(
          pool,
          access.lead.id,
          {
            modules: b.modules,
            callerUserId: access.session.userId,
            scope: {
              organizationId: access.lead.organizationId,
              projectId: access.lead.projectId,
            },
          },
        );
        res.json({ report });
      } catch (err) {
        res.status(500).json({ error: "generate_failed", detail: "internal_error" });
      }
    },
  );

  // ─── Hent cached rapport ─────────────────────────────────────────
  app.get(
    "/api/leadgrid/leads/:id/full-intelligence",
    async (req: Request, res: Response) => {
      try {
        const access = await authorizeLeadResearch(req, res, pool, activeSessions);
        if (!access) return;
        const r = await pool.query<{
          data: unknown;
          ts: string | null;
        }>(
          `SELECT enrichment_data->'full_intelligence' AS data,
                  enrichment_data->>'full_intelligence_at' AS ts
             FROM crm_customers
            WHERE id = $1::uuid
              AND organization_id = $2::uuid
              AND project_id = $3`,
          [
            access.lead.id,
            access.lead.organizationId,
            access.lead.projectId,
          ],
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
        res.status(500).json({ error: "read_failed", detail: "internal_error" });
      }
    },
  );

  // ─── Eksplisitt refresh (samme som POST uten modules-filter) ─────
  app.post(
    "/api/leadgrid/leads/:id/full-intelligence/refresh",
    async (req: Request, res: Response) => {
      try {
        const access = await authorizeLeadResearch(req, res, pool, activeSessions);
        if (!access) return;
        const report = await generateFullIntelligenceReport(
          pool,
          access.lead.id,
          {
            callerUserId: access.session.userId,
            scope: {
              organizationId: access.lead.organizationId,
              projectId: access.lead.projectId,
            },
          },
        );
        res.json({ report });
      } catch (err) {
        res.status(500).json({ error: "refresh_failed", detail: "internal_error" });
      }
    },
  );
}
