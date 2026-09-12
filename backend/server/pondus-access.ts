import type { Request, Response } from "express";
import type { Pool } from "pg";
import { LEADBOOK_FEATURE_KEYS } from "./leadgrid-entitlement-guard.js";
import { resolveEffectivePermissions } from "./lead-map-permission-routes.js";
import { resolveOrgIdForUser } from "./leadgrid-org-resolver.js";
import { loadAccessibleLeadgridProject } from "./leadgrid-project-access.js";

export type PondusSession = {
  userId: string;
  email: string;
  name: string;
  role: string;
};

export type PondusAccessContext = {
  organizationId: string | null;
  projectId: string | null;
  organizationRole: string | null;
  permissions: Set<string>;
  platformAdmin: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PLATFORM_ADMIN_ROLES = new Set(["admin", "super_admin"]);
const MANAGER_ROLES = new Set(["admin", "owner", "salgssjef", "teamleder", "sales_manager"]);

export class PondusAccessError extends Error {
  constructor(public readonly status: number, public readonly code: string) {
    super(code);
  }
}

function explicitOrganizationId(req: Request): string | null {
  const candidates = [
    req.get("X-Organization-Id"),
    req.query.organization_id,
    req.query.organizationId,
    req.body?.organization_id,
    req.body?.organizationId,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function explicitProjectId(req: Request): string | null {
  const candidates = [
    req.get("X-Leadgrid-Project-Id"),
    req.query.project_id,
    req.query.projectId,
    req.body?.project_id,
    req.body?.projectId,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export async function resolvePondusAccess(
  pool: Pool,
  req: Request,
  session: PondusSession,
): Promise<PondusAccessContext> {
  const platformAdmin = PLATFORM_ADMIN_ROLES.has(session.role);
  const explicit = explicitOrganizationId(req);
  if (explicit && !UUID.test(explicit)) throw new PondusAccessError(400, "invalid_organization_id");

  const requestedProjectId = explicitProjectId(req);
  const project = requestedProjectId
    ? await loadAccessibleLeadgridProject(pool, requestedProjectId, session.userId)
    : null;
  if (requestedProjectId && !project) {
    // Samme 404 for ukjent prosjekt og manglende tilgang: ingen BOLA-orakel.
    throw new PondusAccessError(404, "project_not_found");
  }
  if (project && explicit && project.organizationId !== explicit) {
    throw new PondusAccessError(404, "project_not_found");
  }

  const organizationId = project?.organizationId ?? explicit
    ?? await resolveOrgIdForUser(pool, session.userId).catch(() => null);
  if (!organizationId) {
    return {
      organizationId: null,
      projectId: null,
      organizationRole: null,
      permissions: new Set(),
      platformAdmin,
    };
  }

  const effective = await resolveEffectivePermissions(pool, organizationId, session.userId);
  if (!platformAdmin && !effective.role) {
    throw new PondusAccessError(403, "not_member_of_organization");
  }
  return {
    organizationId,
    projectId: project?.id ?? null,
    organizationRole: effective.role,
    permissions: effective.permissions,
    platformAdmin,
  };
}

export async function assertPondusEntitled(
  pool: Pool,
  access: PondusAccessContext,
  res: Response,
): Promise<boolean> {
  if (access.platformAdmin || !access.organizationId) return true;
  try {
    const result = await pool.query<{ state: string }>(
      `SELECT state FROM leadgrid_org_entitlements
        WHERE organization_id = $1 AND feature_key = ANY($2::text[])`,
      [access.organizationId, LEADBOOK_FEATURE_KEYS],
    );
    if (result.rows.length === 0 || result.rows.some((row) => row.state !== "locked")) return true;
    res.status(403).json({
      error: "entitlement_locked",
      features: LEADBOOK_FEATURE_KEYS,
      message: "Organisasjonen har ikke tilgang til denne funksjonen.",
    });
    return false;
  } catch (error) {
    console.error("[pondus-access] entitlement check failed (fail-open):", error);
    return true;
  }
}

export function canManagePondus(access: PondusAccessContext): boolean {
  return access.platformAdmin
    || MANAGER_ROLES.has(access.organizationRole ?? "")
    || access.permissions.has("pondus.manage");
}

export function canViewPondusAnalytics(access: PondusAccessContext): boolean {
  return canManagePondus(access) || access.permissions.has("analytics.view_overview");
}

export function sendPondusAccessError(res: Response, error: unknown): boolean {
  if (!(error instanceof PondusAccessError)) return false;
  res.status(error.status).json({ error: error.code });
  return true;
}

export async function isPondusTemplateVisible(
  pool: Pool,
  templateId: string,
  access: PondusAccessContext,
  options: { includeDraftForManagers?: boolean } = {},
): Promise<boolean> {
  const result = await pool.query<{
    org_id: string | null;
    project_id: string | null;
    is_published: boolean;
    archived_at: unknown;
  }>(
    `SELECT org_id::text, project_id, is_published, archived_at
       FROM pondus_templates WHERE id = $1::uuid LIMIT 1`,
    [templateId],
  );
  const row = result.rows[0];
  if (!row || row.archived_at) return false;
  // Plattformadministrator uten valgt kontekst kan administrere katalogen.
  // Så snart org/prosjekt er sendt, gjelder samme avgrensning som i appen.
  if (access.platformAdmin && !access.organizationId) return true;
  const inScope = row.org_id === null
    ? row.project_id === null
    : row.org_id === access.organizationId
      && (row.project_id === null || row.project_id === access.projectId);
  if (!inScope) return false;
  if (row.is_published || access.platformAdmin) return true;
  // Globale utkast eies av plattformen. En organisasjonsleder kan bare
  // forhåndsvise utkast som faktisk tilhører egen tenant.
  return options.includeDraftForManagers === true
    && canManagePondus(access)
    && row.org_id != null
    && row.org_id === access.organizationId
    && (row.project_id === null || row.project_id === access.projectId);
}
