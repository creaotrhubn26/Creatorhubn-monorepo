/**
 * Authenticated tombstones for the retired Lead Map Research API.
 *
 * The former flow selected the first broad Google Places result and wrote its
 * payload directly to CRM. Discovery V2 now owns project context, evidence,
 * transient Place details, attestation, deduplication and manual approval.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";

import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";
import {
  getLeadgridSession,
  type LeadgridSession,
} from "./leadgrid-project-access.js";

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, LeadgridSession>;
}

export function registerLeadMapResearchRoutes({
  app,
  pool,
  activeSessions,
}: Deps): void {
  const permission = requireLeadMapPermission("lead_research.run", {
    pool,
    activeSessions,
  });
  const handler = (req: Request, res: Response): Response => {
    const session = getLeadgridSession(req, activeSessions);
    if (!session?.userId) {
      return res.status(401).json({ error: "Innlogging kreves" });
    }
    return res.status(410).json({
      error: "legacy_lead_research_retired",
      message:
        "Lead Research er erstattet av prosjektbundne Discovery V2-profiler og manuell kandidatgodkjenning.",
      replacement:
        "/api/leadgrid/projects/:projectId/discovery/profiles",
      requested_path: req.path,
    });
  };
  const root = "/api/admin-room/lead-map/research";

  app.post(root + "/start", permission, handler);
  app.post(root + "/:id/run", permission, handler);
  app.get(root + "/:id", permission, handler);
  app.get(root, permission, handler);
}
