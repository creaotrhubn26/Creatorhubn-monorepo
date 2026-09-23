/**
 * HubSpot-import: forhåndsvis, så skriv.
 *
 * Samme totrinn som CSV-importen, av samme grunn: kunden skal se hva som
 * kommer inn — og hva som IKKE kommer inn — før noe skrives. En migrering man
 * angrer på er dyr; en forhåndsvisning er gratis.
 *
 * Service Key-en følger forespørselen og lagres aldri. Den står ikke i noen
 * tabell, i ingen miljøvariabel og i ingen logg. En nøkkel vi ikke har kan
 * ikke lekke, og en migrering gjøres uansett én gang.
 */
import type { Express, Request, Response } from "express";
import type { Pool } from "pg";

import {
  bekreftMigrering,
  hentJobb,
  startMigrering,
} from "./leadgrid-hubspot-import-jobs.js";
import { loadAccessibleLeadgridProject } from "./leadgrid-project-access.js";
import { resolveEffectivePermissions } from "./lead-map-permission-routes.js";

export function registerLeadgridHubSpotImportRoutes(deps: {
  app: Express;
  pool: Pool;
  requireUserSession: (req: Request, res: Response) => { userId: string } | null;
}): void {
  const { app, pool, requireUserSession } = deps;

  async function tilgang(
    req: Request,
    res: Response,
    userId: string,
  ): Promise<{ project: Awaited<ReturnType<typeof loadAccessibleLeadgridProject>> } | null> {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const projectId = String(body.project_id ?? body.projectId ?? "").trim();
    if (!projectId) {
      res.status(400).json({ error: "project_id_required" });
      return null;
    }
    const project = await loadAccessibleLeadgridProject(pool, projectId, userId);
    if (!project) {
      res.status(404).json({ error: "project_not_found" });
      return null;
    }
    const { permissions } = await resolveEffectivePermissions(
      pool,
      project.organizationId,
      userId,
    );
    // Samme tillatelse som CSV-import: å hente inn et helt CRM er samme
    // handling, bare med en annen kilde.
    if (!permissions.has("leads.import_csv")) {
      res.status(403).json({ error: "mangler_tillatelse", required: "leads.import_csv" });
      return null;
    }
    return { project };
  }

  // Starter migreringen. Svarer med én gang; uttaket går som jobb fordi et
  // større HubSpot-oppsett ikke kan hentes inne i én request.
  app.post("/api/leadgrid/import/hubspot/jobs", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const ctx = await tilgang(req, res, session.userId);
    if (!ctx?.project) return;
    const nøkkel = String((req.body ?? {}).service_key ?? "").trim();
    if (!nøkkel) {
      res.status(400).json({ error: "service_key_required" });
      return;
    }
    res.status(202).json(
      startMigrering(pool, {
        project: ctx.project,
        userId: session.userId,
        serviceKey: nøkkel,
      }),
    );
  });

  // Følger jobben. Kalles til fasen er «klar», «ferdig» eller «feilet».
  app.get("/api/leadgrid/import/hubspot/jobs/:id", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const projectId = String(req.query.project_id ?? "").trim();
    if (!projectId) {
      res.status(400).json({ error: "project_id_required" });
      return;
    }
    const project = await loadAccessibleLeadgridProject(pool, projectId, session.userId);
    if (!project) {
      res.status(404).json({ error: "project_not_found" });
      return;
    }
    const status = hentJobb(req.params.id, project.organizationId);
    if (!status) {
      res.status(404).json({ error: "job_not_found" });
      return;
    }
    res.json(status);
  });

  // Kunden har sett planen og sier ja.
  app.post("/api/leadgrid/import/hubspot/jobs/:id/commit", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const ctx = await tilgang(req, res, session.userId);
    if (!ctx?.project) return;
    const status = await bekreftMigrering(pool, {
      jobbId: req.params.id,
      project: ctx.project,
      userId: session.userId,
    });
    if (!status) {
      res.status(404).json({ error: "job_not_found" });
      return;
    }
    res.json(status);
  });
}
