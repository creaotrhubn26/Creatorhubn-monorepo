/**
 * Authenticated tombstones for the retired Leadgrid Market Scan API.
 *
 * Discovery V2 is the only supported lead-discovery path. Keeping explicit
 * 410 routes prevents older clients from silently falling back to broad
 * Google Places persistence.
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

function retiredResponse(req: Request, res: Response): Response {
  return res.status(410).json({
    error: "legacy_market_scan_retired",
    message:
      "Market Scan er erstattet av prosjektbundne Discovery V2-profiler, manuell kandidatgodkjenning og evidensbasert markedsinnsikt.",
    replacement:
      "/api/leadgrid/projects/:projectId/discovery/profiles",
    requested_path: req.path,
  });
}

export function registerLeadgridMarketScanRoutes({
  app,
  pool,
  activeSessions,
}: Deps): void {
  const permission = requireLeadMapPermission("leadgrid.market_scan.run", {
    pool,
    activeSessions,
  });
  const handler = (req: Request, res: Response): Response => {
    const session = getLeadgridSession(req, activeSessions);
    if (!session?.userId) {
      return res.status(401).json({ error: "Innlogging kreves" });
    }
    return retiredResponse(req, res);
  };
  const root = "/api/leadgrid/market-scan";

  app.post(root + "/run", permission, handler);
  app.post(root + "/:id/create-leads", permission, handler);
  app.get(root + "/:id/competitors", permission, handler);
  app.get(root + "/:id/opportunities", permission, handler);
  app.get(root + "/:id/leads", permission, handler);
  app.get(root + "/:id", permission, handler);
  app.get(root, permission, handler);
}
