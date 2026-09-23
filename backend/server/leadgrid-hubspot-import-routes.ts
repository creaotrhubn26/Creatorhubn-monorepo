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
import { randomUUID } from "node:crypto";

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";

import {
  hentHubSpotData,
  planHubSpotMigration,
  skrivMigrering,
  type MigrationPlan,
} from "./leadgrid-hubspot-import.js";
import { loadAccessibleLeadgridProject } from "./leadgrid-project-access.js";
import { resolveEffectivePermissions } from "./lead-map-permission-routes.js";

/** Planen lever mellom forhåndsvisning og skriving, som CSV-importen. */
const PLAN_TTL_MS = 15 * 60_000;
const planer = new Map<string, { plan: MigrationPlan; orgId: string; utloper: number }>();

function ryddPlaner(nå = Date.now()): void {
  for (const [token, rad] of planer) if (rad.utloper <= nå) planer.delete(token);
}

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

  // Henter alt fra HubSpot, lager planen, skriver ingenting.
  app.post("/api/leadgrid/import/hubspot/preview", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const ctx = await tilgang(req, res, session.userId);
    if (!ctx?.project) return;

    const body = (req.body ?? {}) as Record<string, unknown>;
    const nøkkel = String(body.service_key ?? "").trim();
    if (!nøkkel) {
      res.status(400).json({ error: "service_key_required" });
      return;
    }
    try {
      const { input, stats } = await hentHubSpotData(nøkkel, {
        burstLimit: typeof body.burst_limit === "number" ? body.burst_limit : undefined,
      });
      const plan = planHubSpotMigration(input, {
        fallbackOwnerUserId: session.userId,
      });
      ryddPlaner();
      const token = randomUUID();
      planer.set(token, {
        plan,
        orgId: ctx.project.organizationId,
        utloper: Date.now() + PLAN_TTL_MS,
      });
      res.json({
        plan_token: token,
        expires_in_seconds: PLAN_TTL_MS / 1000,
        counts: plan.counts,
        // Funnene er poenget med forhåndsvisningen: her ser kunden hva som
        // IKKE blir med, før de bestemmer seg.
        issues: plan.issues.slice(0, 100),
        merged_into_existing: plan.mergedIntoExisting.slice(0, 50),
        hubspot_requests: stats.requests,
      });
    } catch (error) {
      // Nøkkelen skal aldri kunne havne i en logg via feilmeldingen.
      const melding = (error as Error).message.replace(nøkkel, "***");
      console.warn("[hubspot-import] forhåndsvisning feilet:", melding);
      res.status(502).json({ error: "hubspot_unreachable", detail: melding });
    }
  });

  // Skriver planen kunden faktisk så.
  app.post("/api/leadgrid/import/hubspot/commit", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const ctx = await tilgang(req, res, session.userId);
    if (!ctx?.project) return;

    const body = (req.body ?? {}) as Record<string, unknown>;
    const token = String(body.plan_token ?? "").trim();
    ryddPlaner();
    const rad = planer.get(token);
    if (!rad) {
      res.status(410).json({ error: "plan_expired" });
      return;
    }
    // Planen tilhører organisasjonen som hentet den. Et token på avveie skal
    // ikke kunne skrive en annen kundes CRM inn i et annet prosjekt.
    if (rad.orgId !== ctx.project.organizationId) {
      res.status(404).json({ error: "plan_not_found" });
      return;
    }
    try {
      const resultat = await skrivMigrering(pool, {
        project: ctx.project,
        plan: rad.plan,
        userId: session.userId,
      });
      planer.delete(token);
      res.json(resultat);
    } catch (error) {
      console.warn("[hubspot-import] skriving feilet:", (error as Error).message);
      res.status(500).json({ error: "import_failed" });
    }
  });
}
