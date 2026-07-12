/**
 * score-model-routes.ts — fase 3 (docs/integration-audit/11)
 *
 *   GET   /api/integrations/score-models/geo-opportunity
 *         Rangerte muligheter + config + faktordefinisjoner (admin, org).
 *   PATCH /api/integrations/score-models/geo-opportunity/config
 *         Lagrer Daniels vekter/verdier (Zod-validert) → approved=true,
 *         FORSLAG-merket forsvinner.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import {
  GEO_OPPORTUNITY_MODEL_KEY,
  geoOpportunityConfigSchema,
} from "./score-model.js";
import { computeGeoOpportunityScores } from "../market-intelligence/geo-opportunity-score.js";
import { resolveOrgIdForUser } from "../leadgrid-org-resolver.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
  isAdminEmail: (email: string | undefined) => boolean;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getSession(req: Request, activeSessions: Map<string, SessionData>): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return activeSessions.get(auth.slice(7).trim()) ?? null;
  return null;
}

export function registerScoreModelRoutes({ app, pool, activeSessions, isAdminEmail }: Deps): void {
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
    return orgId;
  }

  app.get("/api/integrations/score-models/geo-opportunity", async (req, res) => {
    const orgId = await requireAdminWithOrg(req, res);
    if (!orgId) return;
    try {
      return res.json(await computeGeoOpportunityScores(pool, orgId));
    } catch (err) {
      console.error("[score-model] compute failed", err);
      return res.status(500).json({ error: "compute_failed" });
    }
  });

  app.patch("/api/integrations/score-models/geo-opportunity/config", async (req, res) => {
    const orgId = await requireAdminWithOrg(req, res);
    if (!orgId) return;
    const parsed = geoOpportunityConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "ugyldig_config",
        details: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      });
    }
    try {
      await pool.query(
        `INSERT INTO score_model_config (organization_id, model_key, config, approved, updated_at)
         VALUES ($1::uuid, $2, $3::jsonb, TRUE, now())
         ON CONFLICT (organization_id, model_key) DO UPDATE SET
           config = EXCLUDED.config, approved = TRUE, updated_at = now()`,
        [orgId, GEO_OPPORTUNITY_MODEL_KEY, JSON.stringify(parsed.data)],
      );
      return res.json({ saved: true });
    } catch (err) {
      console.error("[score-model] save failed", err);
      return res.status(500).json({ error: "save_failed" });
    }
  });
}
