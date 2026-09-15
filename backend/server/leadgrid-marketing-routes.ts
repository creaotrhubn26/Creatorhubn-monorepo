/**
 * leadgrid-marketing-routes.ts
 *
 * Leadgrid «Markedssjef-modus» — en VERTIKAL oppå Leadgrid som gjenbruker
 * The Role Room-agentens markedsplan-motor (bootstrap → strategi → pilarer →
 * 30 poster) for markedssjefens EGEN organisasjon. Ingen eksisterende
 * Leadgrid-flyt endres; modulen er opt-in per org (`leadgrid:marketing`).
 *
 * Endepunkter (alle gated på RBAC `marketing.content.brief` + modulen):
 *   GET  /api/leadgrid/marketing/status?projectId=…
 *        → { projectKey, organization, bootstrap, plan }
 *   POST /api/leadgrid/marketing/bootstrap { projectId }
 *        → kjører producer-bootstrap (Brreg + nettsted + Places) for ORGEN
 *          (organizations.website / org_number / name) under nøkkelen
 *          `lg-<leadgrid_projects.id>` og persisterer research-versjonen
 *          slik Role Room gjør. Selve planen genereres deretter via Role
 *          Rooms /api/role-room/marketing-plan/* — broen i
 *          leadgrid-marketing-bridge.ts slipper `lg-`-nøkler gjennom der.
 *
 * Nøkkelen `lg-<id>` følger samme mønster som `lead-<id>` i
 * leadgrid-url-research-routes.ts (500-roadmap: «bruk runOrchestratedBootstrap,
 * ikke dupliser Claude-orkestrering»).
 */

import crypto from "node:crypto";
import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { aiRateLimit } from "./ai-rate-limiter.js";
import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";
import { withAIQuota } from "./leadgrid-ai-queue.js";
import {
  LEADGRID_MARKETING_FEATURE_KEY,
  LEADGRID_MARKETING_MODULE_KEY,
  LEADGRID_MARKETING_PERMISSION,
  leadgridMarketingProjectKey,
  resolveLeadgridMarketingAccess,
  type LeadgridMarketingAccess,
} from "./leadgrid-marketing-bridge.js";
import {
  getLeadgridSession,
  loadAccessibleLeadgridProject,
  type LeadgridSession,
} from "./leadgrid-project-access.js";
import { generateRoleRoomAgentProducerBootstrap } from "./role-room-agent.js";
import {
  loadApprovedNaceBusinessModelOverrides,
  loadApprovedNaceChannelPriorityOverrides,
} from "./role-room-agent-learning.js";
import {
  checkMarketingPlanReadiness,
  fetchActiveMarketingPlan,
} from "./role-room-marketing-plan.js";
import {
  loadLatestResearchVersion,
  persistResearchVersion,
} from "./role-room-research-versions.js";

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, LeadgridSession>;
}

interface OrganizationProfileRow {
  id: string;
  name: string | null;
  website: string | null;
  org_number: string | null;
  industry: string | null;
  nace_code: string | null;
  nace_description: string | null;
  city: string | null;
}

function requestedProjectId(req: Request): string | null {
  const raw =
    (req.query as Record<string, unknown> | undefined)?.projectId
    ?? (req.query as Record<string, unknown> | undefined)?.project_id
    ?? (req.body as Record<string, unknown> | undefined)?.projectId
    ?? (req.body as Record<string, unknown> | undefined)?.project_id;
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "string") throw new Error("invalid_project_id");
  const projectId = raw.trim();
  if (!projectId || projectId.length > 255) throw new Error("invalid_project_id");
  return projectId;
}

async function resolveProjectOrgId(
  req: Request,
  pool: Pool,
  userId: string,
): Promise<string | null> {
  try {
    const projectId = requestedProjectId(req);
    if (!projectId) return null;
    const project = await loadAccessibleLeadgridProject(pool, projectId, userId);
    return project?.organizationId ?? null;
  } catch {
    return null;
  }
}

async function loadOrganizationProfile(
  pool: Pool,
  organizationId: string,
): Promise<OrganizationProfileRow | null> {
  const r = await pool.query<OrganizationProfileRow>(
    `SELECT id::text, name, website, org_number, industry, nace_code, nace_description, city
       FROM organizations
      WHERE id = $1::uuid
      LIMIT 1`,
    [organizationId],
  );
  return r.rows[0] ?? null;
}

function normalizeWebsite(value: string | null): string | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function buildOrgExtraContext(org: OrganizationProfileRow, projectName: string): string {
  const parts = [
    "Konteksten er Leadgrid Markedssjef-modus: selskapet er en norsk salgsorganisasjon",
    "som bruker Leadgrid (kart-først feltsalg og leadgenerering). Markedsplanen skal",
    "støtte salgsteamets egen kundeanskaffelse — LinkedIn-først for B2B, lokale kanaler",
    "for B2C — og aldri anta at selskapet er et kreativt produksjonsbyrå.",
    `Leadgrid-prosjekt: «${projectName}».`,
  ];
  if (org.nace_code) parts.push(`Bransje (NACE, verifisert via Brreg): ${org.nace_code}${org.nace_description ? ` — ${org.nace_description}` : ""}.`);
  else if (org.industry) parts.push(`Bransje (egenoppgitt): ${org.industry}.`);
  if (org.city) parts.push(`Hovedsete: ${org.city}.`);
  return parts.join(" ");
}

export function registerLeadgridMarketingRoutes(deps: Deps): void {
  const { app, pool, activeSessions } = deps;
  const perm = requireLeadMapPermission(LEADGRID_MARKETING_PERMISSION, {
    pool,
    activeSessions,
    resolveOrgId: resolveProjectOrgId,
  });
  const bootstrapLimit = aiRateLimit({
    windowMs: 10 * 60_000,
    max: 3,
    label: "Leadgrid markedsføring bootstrap",
  });

  /**
   * Felles autorisasjon: Leadgrid-sesjon + prosjekt-tilgang + RBAC + modul.
   * Skriver selv feilsvaret og returnerer null når kalleren skal stoppe.
   */
  async function authorize(
    req: Request,
    res: Response,
  ): Promise<LeadgridMarketingAccess | null> {
    const session = getLeadgridSession(req, activeSessions);
    if (!session) {
      res.status(401).json({ error: "Innlogging kreves" });
      return null;
    }
    let projectId: string | null;
    try {
      projectId = requestedProjectId(req);
    } catch {
      res.status(400).json({ error: "invalid_project_id" });
      return null;
    }
    if (!projectId) {
      res.status(400).json({ error: "project_id_required" });
      return null;
    }
    const result = await resolveLeadgridMarketingAccess(pool, {
      projectKey: leadgridMarketingProjectKey(projectId),
      session,
    });
    if (!result.ok) {
      res.status(result.status).json({
        error: result.error,
        ...(result.required ? { required: result.required } : {}),
        ...(result.module ? { module: result.module } : {}),
      });
      return null;
    }
    return result.access;
  }

  // GET /api/leadgrid/marketing/status?projectId=…
  app.get(
    "/api/leadgrid/marketing/status",
    perm,
    async (req: Request, res: Response): Promise<void> => {
      const access = await authorize(req, res);
      if (!access) return;
      try {
        const [org, latest, plan] = await Promise.all([
          loadOrganizationProfile(pool, access.organizationId),
          loadLatestResearchVersion(pool, access.projectKey),
          fetchActiveMarketingPlan(pool, access.projectKey),
        ]);
        const bootstrap = latest?.serializedResult ?? null;
        const readiness = bootstrap
          ? checkMarketingPlanReadiness(
              bootstrap as Parameters<typeof checkMarketingPlanReadiness>[0],
              false,
            )
          : null;
        res.json({
          module: `${LEADGRID_MARKETING_MODULE_KEY}:${LEADGRID_MARKETING_FEATURE_KEY}`,
          project_id: access.leadgridProjectId,
          project_key: access.projectKey,
          project_name: access.projectName,
          role: access.role,
          organization: org
            ? {
                id: org.id,
                name: org.name,
                website: normalizeWebsite(org.website),
                org_number: org.org_number,
                industry: org.industry,
                nace_code: org.nace_code,
                nace_description: org.nace_description,
                city: org.city,
                can_bootstrap: Boolean(normalizeWebsite(org.website) || org.org_number),
              }
            : null,
          bootstrap: latest
            ? {
                available: true,
                research_id: latest.researchId,
                version_number: latest.versionNumber,
                generated_at: latest.generatedAt,
                readiness,
                result: bootstrap,
              }
            : { available: false, readiness: null, result: null },
          plan: plan
            ? {
                exists: true,
                id: plan.id,
                status: plan.status,
                horizon_days: plan.horizonDays,
              }
            : { exists: false },
        });
      } catch (err) {
        console.error("[leadgrid-marketing] status failed", err);
        res.status(500).json({ error: "status_failed" });
      }
    },
  );

  // POST /api/leadgrid/marketing/bootstrap { projectId }
  app.post(
    "/api/leadgrid/marketing/bootstrap",
    perm,
    bootstrapLimit,
    async (req: Request, res: Response): Promise<void> => {
      const access = await authorize(req, res);
      if (!access) return;
      try {
        const org = await loadOrganizationProfile(pool, access.organizationId);
        if (!org) {
          res.status(404).json({ error: "organization_not_found" });
          return;
        }
        const websiteUrl = normalizeWebsite(org.website);
        const organizationNumber = (org.org_number ?? "").trim() || null;
        if (!websiteUrl && !organizationNumber) {
          res.status(409).json({
            error: "org_profile_incomplete",
            missing: ["website", "org_number"],
            detail:
              "Legg inn nettsted eller organisasjonsnummer på organisasjonen før markedsplanen kan bygges.",
          });
          return;
        }

        const researchId = crypto.randomUUID();
        const [learnedNaceBusinessModelOverrides, learnedChannelPriorityOverrides] =
          await Promise.all([
            loadApprovedNaceBusinessModelOverrides(pool),
            loadApprovedNaceChannelPriorityOverrides(pool),
          ]);

        const result = await withAIQuota("claude", access.organizationId, () =>
          generateRoleRoomAgentProducerBootstrap(
            {
              projectId: access.projectKey,
              projectName: access.projectName,
              websiteUrl: websiteUrl ?? undefined,
              organizationNumber: organizationNumber ?? undefined,
              companyName: (org.name ?? "").trim() || undefined,
              extraContext: buildOrgExtraContext(org, access.projectName),
            },
            {
              researchId,
              learnedNaceBusinessModelOverrides,
              learnedChannelPriorityOverrides,
            },
          ),
        );

        const version = result.researchId
          ? await persistResearchVersion(pool, {
              projectId: access.projectKey,
              researchId: result.researchId,
              generatedBy: access.session.email ?? access.session.userId,
              serializedResult: result,
              serviceLatencies: result.serviceLatencies ?? null,
              fallbacksUsed: result.fallbacksUsed ?? [],
              totalMs: result.serviceLatencies?.totalMs ?? null,
              provider: result.provider ?? null,
              model: result.model ?? null,
            })
          : null;

        const readiness = checkMarketingPlanReadiness(
          result as Parameters<typeof checkMarketingPlanReadiness>[0],
          false,
        );
        res.json({
          project_key: access.projectKey,
          research_id: result.researchId ?? researchId,
          version_number: version?.versionNumber ?? null,
          readiness,
          bootstrap: result,
        });
      } catch (err) {
        console.error("[leadgrid-marketing] bootstrap failed", err);
        res.status(500).json({ error: "bootstrap_failed" });
      }
    },
  );
}
