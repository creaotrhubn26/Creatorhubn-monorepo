/**
 * leadgrid-agent-access.ts
 *
 * Tilgangs-resolver som lar Leadgrid-prosjekter bruke The Role Room-agentens
 * chat-runtime (tråder, SSE-stream, samtykke) — en vertikal oppå agenten,
 * uten å endre hvordan casting-prosjekter autoriseres.
 *
 * To Leadgrid-moduser, avledet av prosjekt-nøkkelen:
 *
 *   `lg-<leadgrid_projects.id>`  → 'leadgrid_marketing'
 *       Markedssjef-modus. Samme regler som markedsplan-broen
 *       (leadgrid-marketing-bridge.ts): prosjekt-tilgang + RBAC
 *       `marketing.content.brief` + modul `leadgrid:marketing` (opt-in).
 *
 *   `<leadgrid_projects.id>` (ren id, slik iPad-appen sender)
 *                                 → 'leadgrid_sales'
 *       Leadgrid-assistent for selger/salgssjef. Prosjekt-tilgang via
 *       loadAccessibleLeadgridProject (eier, prosjekt-medlem eller org-medlem
 *       med projects.view_all) + modul `leadgrid:core` (default included).
 *
 * Deteksjon av rene id-er skjer i DB, ikke på prefiks: legacy Leadgrid-id-er er
 * backfyllt fra casting_projects (mig 0449), og loadAccessibleLeadgridProject
 * ekskluderer media-project_type så et casting-prosjekt aldri blir «Leadgrid».
 * Kalleren sjekker casting-tilgang FØRST og bruker denne kun som fallback.
 *
 * Kaster aldri — null betyr «ikke et Leadgrid-prosjekt kalleren har tilgang til».
 */

import type { Pool } from "pg";
import { isModuleFeatureEnabled } from "./feature-flags/module-entitlement-resolver.js";
import {
  isLeadgridMarketingProjectKey,
  resolveLeadgridMarketingAccess,
} from "./leadgrid-marketing-bridge.js";
import { loadAccessibleLeadgridProject } from "./leadgrid-project-access.js";

export type LeadgridAgentKind = "leadgrid_marketing" | "leadgrid_sales";

export interface LeadgridAgentProject {
  kind: LeadgridAgentKind;
  /** Nøkkelen slik agent-tabellene ser den (lg-… eller ren Leadgrid-id). */
  projectKey: string;
  leadgridProjectId: string;
  organizationId: string;
  projectName: string;
  role: string | null;
}

export const LEADGRID_CORE_MODULE = { moduleKey: "leadgrid", featureKey: "core" } as const;

export async function resolveLeadgridAgentProject(
  pool: Pool,
  input: { projectId: string; userId: string },
): Promise<LeadgridAgentProject | null> {
  const projectId = typeof input.projectId === "string" ? input.projectId.trim() : "";
  const userId = typeof input.userId === "string" ? input.userId.trim() : "";
  if (!projectId || !userId) return null;

  if (isLeadgridMarketingProjectKey(projectId)) {
    try {
      const result = await resolveLeadgridMarketingAccess(pool, {
        projectKey: projectId,
        session: { userId },
      });
      if (!result.ok) return null;
      return {
        kind: "leadgrid_marketing",
        projectKey: result.access.projectKey,
        leadgridProjectId: result.access.leadgridProjectId,
        organizationId: result.access.organizationId,
        projectName: result.access.projectName,
        role: result.access.role,
      };
    } catch {
      return null;
    }
  }

  try {
    const project = await loadAccessibleLeadgridProject(pool, projectId, userId);
    if (!project) return null;
    const enabled = await isModuleFeatureEnabled(pool, {
      organizationId: project.organizationId,
      moduleKey: LEADGRID_CORE_MODULE.moduleKey,
      featureKey: LEADGRID_CORE_MODULE.featureKey,
      defaultState: "included",
    });
    if (!enabled) return null;
    return {
      kind: "leadgrid_sales",
      projectKey: project.id,
      leadgridProjectId: project.id,
      organizationId: project.organizationId,
      projectName: project.name,
      role: project.memberRole ?? null,
    };
  } catch {
    return null;
  }
}
