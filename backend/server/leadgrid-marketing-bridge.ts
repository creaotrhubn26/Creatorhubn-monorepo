/**
 * leadgrid-marketing-bridge.ts
 *
 * Bro som lar Leadgrid («Markedssjef-modus», modul `leadgrid:marketing`)
 * bruke The Role Room-agentens markedsplan-motor uten å kopiere den.
 *
 * Prinsipp: Leadgrid er en VERTIKAL oppå agenten. Ingen eksisterende
 * Leadgrid-flyt endres, og Role Room-oppførsel for vanlige prosjekt-nøkler
 * er uendret — broen aktiveres KUN når prosjekt-nøkkelen har prefikset
 * `lg-<leadgrid_projects.id>` (samme mønster som `lead-<id>` i
 * leadgrid-url-research-routes.ts).
 *
 * For en `lg-`-nøkkel gjelder Leadgrids egne regler i stedet for Role Rooms:
 *   1. Sesjon:      Leadgrid-sesjon (Bearer/cookie via getLeadgridSession)
 *   2. Prosjekt:    loadAccessibleLeadgridProject (org + prosjekt-medlemskap)
 *   3. RBAC:        `marketing.content.brief` (mig 302 — markedssjef m.fl.)
 *   4. Modul:       module_feature_entitlements `leadgrid` / `marketing`,
 *                   default 'locked' (opt-in per org)
 *
 * Alt annet (admin-sesjon, casting_projects-medlemskap, agent-entitlement)
 * hoppes over for `lg-`-nøkler — modul-gaten og AI-kvoten i Leadgrid
 * erstatter dem. Rutene som bruker broen leser resultatet via
 * getLeadgridMarketingAccess(req).
 */

import type { NextFunction, Request, Response } from "express";
import type { Pool } from "pg";
import { isModuleFeatureEnabled } from "./feature-flags/module-entitlement-resolver.js";
import { resolveEffectivePermissions } from "./lead-map-permission-routes.js";
import {
  getLeadgridSession,
  loadAccessibleLeadgridProject,
  type LeadgridSession,
} from "./leadgrid-project-access.js";

export const LEADGRID_MARKETING_PROJECT_PREFIX = "lg-";
export const LEADGRID_MARKETING_MODULE_KEY = "leadgrid";
export const LEADGRID_MARKETING_FEATURE_KEY = "marketing";
/** Permission fra mig 302 — markedssjef, markedskoordinator, content_ansvarlig. */
export const LEADGRID_MARKETING_PERMISSION = "marketing.content.brief";

const REQUEST_KEY = "__leadgridMarketingAccess";

export interface LeadgridMarketingAccess {
  /** Nøkkelen slik agent-tabellene ser den: `lg-<leadgridProjectId>` */
  projectKey: string;
  leadgridProjectId: string;
  organizationId: string;
  projectName: string;
  role: string;
  permissions: Set<string>;
  session: LeadgridSession;
}

export type LeadgridMarketingAccessResult =
  | { ok: true; access: LeadgridMarketingAccess }
  | {
      ok: false;
      status: 401 | 403 | 404;
      error:
        | "innlogging_kreves"
        | "project_not_found"
        | "ikke_medlem_av_org"
        | "mangler_tillatelse"
        | "module_locked";
      required?: string;
      module?: string;
    };

export function isLeadgridMarketingProjectKey(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.startsWith(LEADGRID_MARKETING_PROJECT_PREFIX) &&
    value.length > LEADGRID_MARKETING_PROJECT_PREFIX.length
  );
}

export function leadgridMarketingProjectKey(leadgridProjectId: string): string {
  return `${LEADGRID_MARKETING_PROJECT_PREFIX}${leadgridProjectId.trim()}`;
}

export function leadgridProjectIdFromMarketingKey(key: string): string | null {
  if (!isLeadgridMarketingProjectKey(key)) return null;
  const id = key.slice(LEADGRID_MARKETING_PROJECT_PREFIX.length).trim();
  return id.length > 0 && id.length <= 255 ? id : null;
}

/**
 * Løser Leadgrid-tilgang for én `lg-`-nøkkel. Kaster aldri.
 */
export async function resolveLeadgridMarketingAccess(
  pool: Pool,
  input: {
    projectKey: string;
    session: LeadgridSession | null;
    requiredPermission?: string;
  },
): Promise<LeadgridMarketingAccessResult> {
  const { projectKey, session } = input;
  const requiredPermission = input.requiredPermission ?? LEADGRID_MARKETING_PERMISSION;
  if (!session?.userId) {
    return { ok: false, status: 401, error: "innlogging_kreves" };
  }
  const leadgridProjectId = leadgridProjectIdFromMarketingKey(projectKey);
  if (!leadgridProjectId) {
    return { ok: false, status: 404, error: "project_not_found" };
  }

  let project: Awaited<ReturnType<typeof loadAccessibleLeadgridProject>> = null;
  try {
    project = await loadAccessibleLeadgridProject(pool, leadgridProjectId, session.userId);
  } catch {
    project = null;
  }
  if (!project) {
    return { ok: false, status: 404, error: "project_not_found" };
  }

  let role: string | null = null;
  let permissions = new Set<string>();
  try {
    const resolved = await resolveEffectivePermissions(pool, project.organizationId, session.userId);
    role = resolved.role;
    permissions = resolved.permissions;
  } catch {
    role = null;
  }
  if (!role) {
    return { ok: false, status: 403, error: "ikke_medlem_av_org" };
  }
  if (!permissions.has(requiredPermission)) {
    return { ok: false, status: 403, error: "mangler_tillatelse", required: requiredPermission };
  }

  const moduleEnabled = await isModuleFeatureEnabled(pool, {
    organizationId: project.organizationId,
    moduleKey: LEADGRID_MARKETING_MODULE_KEY,
    featureKey: LEADGRID_MARKETING_FEATURE_KEY,
    defaultState: "locked",
  });
  if (!moduleEnabled) {
    return {
      ok: false,
      status: 403,
      error: "module_locked",
      module: `${LEADGRID_MARKETING_MODULE_KEY}:${LEADGRID_MARKETING_FEATURE_KEY}`,
    };
  }

  return {
    ok: true,
    access: {
      projectKey: leadgridMarketingProjectKey(leadgridProjectId),
      leadgridProjectId,
      organizationId: project.organizationId,
      projectName: project.name,
      role,
      permissions,
      session,
    },
  };
}

export function getLeadgridMarketingAccess(req: Request | undefined): LeadgridMarketingAccess | null {
  if (!req) return null;
  const value = (req as Request & { [REQUEST_KEY]?: LeadgridMarketingAccess })[REQUEST_KEY];
  return value ?? null;
}

function setLeadgridMarketingAccess(req: Request, access: LeadgridMarketingAccess): void {
  (req as Request & { [REQUEST_KEY]?: LeadgridMarketingAccess })[REQUEST_KEY] = access;
}

/**
 * Sant når `projectId` er en `lg-`-nøkkel som ALLEREDE er autorisert for
 * denne requesten (av broens middleware). Brukes av rutene som eier-/
 * medlemskaps-erstatning: for Leadgrid er «eier» = enhver i orgen med
 * markedsførings-permission, ikke den enkeltbrukeren som genererte planen.
 */
export function leadgridMarketingAuthorizedFor(
  req: Request | undefined,
  projectId: string,
): boolean {
  if (!isLeadgridMarketingProjectKey(projectId)) return false;
  const access = getLeadgridMarketingAccess(req);
  return access !== null && access.projectKey === projectId;
}

const UUID_LIKE = /^[0-9a-f-]{20,64}$/i;

/**
 * Finner hvilken `lg-`-nøkkel (om noen) en marketing-plan-request refererer
 * til. Ser i body/query (projectId) og i stien; for plan-/post-/pillar-id-
 * nøklede stier slås prosjektet opp i DB. Returnerer null når requesten
 * ikke gjelder et Leadgrid-prosjekt — da rører ikke broen noe som helst.
 */
export async function findLeadgridMarketingProjectKey(
  pool: Pick<Pool, "query">,
  req: Request,
): Promise<{ key: string | null; conflict: boolean }> {
  const candidates = new Set<string>();
  const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
  const query = (req.query ?? {}) as Record<string, unknown>;
  for (const raw of [body.projectId, body.project_id, query.projectId, query.project_id]) {
    if (isLeadgridMarketingProjectKey(raw)) candidates.add(raw);
  }

  const segments = String(req.path ?? "")
    .split("/")
    .map((s) => decodeURIComponentSafe(s))
    .filter((s) => s.length > 0);
  const first = segments[0] ?? "";
  const second = segments[1] ?? "";

  if (isLeadgridMarketingProjectKey(first)) {
    candidates.add(first);
  } else if (first === "posts" && UUID_LIKE.test(second)) {
    const projectId = await lookupProjectIdForPost(pool, second);
    if (isLeadgridMarketingProjectKey(projectId)) candidates.add(projectId);
  } else if (first === "pillars" && UUID_LIKE.test(second)) {
    const projectId = await lookupProjectIdForPillar(pool, second);
    if (isLeadgridMarketingProjectKey(projectId)) candidates.add(projectId);
  } else if (UUID_LIKE.test(first) && second.length > 0) {
    // /:planId/posts, /:planId/generate-posts, /:planId/activate, ...
    const projectId = await lookupProjectIdForPlan(pool, first);
    if (isLeadgridMarketingProjectKey(projectId)) candidates.add(projectId);
  }

  if (candidates.size === 0) return { key: null, conflict: false };
  if (candidates.size > 1) return { key: null, conflict: true };
  return { key: [...candidates][0]!, conflict: false };
}

function decodeURIComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

async function lookupProjectIdForPlan(pool: Pick<Pool, "query">, planId: string): Promise<string | null> {
  try {
    const r = await pool.query<{ project_id: string }>(
      `SELECT project_id FROM role_room_marketing_plans WHERE id = $1 LIMIT 1`,
      [planId],
    );
    return r.rows[0]?.project_id ?? null;
  } catch {
    return null;
  }
}

async function lookupProjectIdForPost(pool: Pick<Pool, "query">, postId: string): Promise<string | null> {
  try {
    const r = await pool.query<{ project_id: string }>(
      `SELECT p.project_id
         FROM role_room_marketing_plan_posts pp
         JOIN role_room_marketing_plans p ON p.id = pp.plan_id
        WHERE pp.id = $1
        LIMIT 1`,
      [postId],
    );
    return r.rows[0]?.project_id ?? null;
  } catch {
    return null;
  }
}

async function lookupProjectIdForPillar(pool: Pick<Pool, "query">, pillarId: string): Promise<string | null> {
  try {
    const r = await pool.query<{ project_id: string }>(
      `SELECT p.project_id
         FROM role_room_marketing_plan_pillars pl
         JOIN role_room_marketing_plans p ON p.id = pl.plan_id
        WHERE pl.id = $1
        LIMIT 1`,
      [pillarId],
    );
    return r.rows[0]?.project_id ?? null;
  } catch {
    return null;
  }
}

/**
 * Express-middleware for `/api/role-room/marketing-plan`. Monteres FØR
 * setupRoleRoomMarketingPlanRoutes. Gjør ingenting for requests som ikke
 * refererer en `lg-`-nøkkel (Role Room uendret). For `lg-`-nøkler
 * autoriserer den via Leadgrid og legger resultatet på requesten.
 */
export function createLeadgridMarketingBridge(deps: {
  pool: Pool;
  activeSessions: Map<string, LeadgridSession>;
}): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  const { pool, activeSessions } = deps;
  return async (req, res, next) => {
    let found: { key: string | null; conflict: boolean };
    try {
      found = await findLeadgridMarketingProjectKey(pool, req);
    } catch (err) {
      console.error("[leadgrid-marketing-bridge] key resolution failed", err);
      next();
      return;
    }
    if (found.conflict) {
      res.status(400).json({ success: false, error: "flere_leadgrid_prosjekter_i_samme_request" });
      return;
    }
    if (!found.key) {
      next();
      return;
    }
    const session = getLeadgridSession(req, activeSessions);
    const result = await resolveLeadgridMarketingAccess(pool, { projectKey: found.key, session });
    if (!result.ok) {
      res.status(result.status).json({
        success: false,
        error: result.error,
        ...(result.required ? { required: result.required } : {}),
        ...(result.module ? { module: result.module } : {}),
      });
      return;
    }
    setLeadgridMarketingAccess(req, result.access);
    next();
  };
}
