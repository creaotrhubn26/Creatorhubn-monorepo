import type { Request } from "express";
import type { Pool } from "pg";

export interface LeadgridSession {
  userId: string;
  role?: string;
  email?: string;
  name?: string;
  loginAt?: string;
}

/**
 * Reads the session already hydrated by the shared Lead Map session middleware.
 * Cookie sessions are retained for the existing web admin surface.
 */
export function getLeadgridSession(
  req: Request,
  activeSessions: Map<string, LeadgridSession>,
): LeadgridSession | null {
  const authorization = req.headers.authorization;
  if (authorization?.startsWith("Bearer ")) {
    const token = authorization.slice(7).trim();
    if (token) {
      const session = activeSessions.get(token);
      if (session?.userId) return session;
    }
  }

  const cookieSession = (
    req as Request & { session?: Partial<LeadgridSession> }
  ).session;
  if (!cookieSession?.userId) return null;
  return {
    userId: cookieSession.userId,
    ...(cookieSession.role ? { role: cookieSession.role } : {}),
    ...(cookieSession.email ? { email: cookieSession.email } : {}),
    ...(cookieSession.name ? { name: cookieSession.name } : {}),
    ...(cookieSession.loginAt ? { loginAt: cookieSession.loginAt } : {}),
  };
}

export interface LeadgridAccessibleProject {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  projectType?: string | null;
  industry: string | null;
  status: string | null;
  createdBy: string | null;
  memberRole: string;
}

export type LeadgridProjectAccessErrorCode =
  | "invalid_project_id"
  | "invalid_user_id"
  | "project_not_found";

const SAFE_MESSAGES: Record<LeadgridProjectAccessErrorCode, string> = {
  invalid_project_id: "Project id is required.",
  invalid_user_id: "User id is required.",
  project_not_found: "Leadgrid project was not found.",
};

export class LeadgridProjectAccessError extends Error {
  readonly code: LeadgridProjectAccessErrorCode;
  readonly status: number;

  constructor(code: LeadgridProjectAccessErrorCode) {
    super(SAFE_MESSAGES[code]);
    this.name = "LeadgridProjectAccessError";
    this.code = code;
    this.status = code === "project_not_found" ? 404 : 400;
  }
}

interface LeadgridProjectAccessRow {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  project_type: string | null;
  industry: string | null;
  status: string | null;
  created_by: string | null;
  member_role: string;
}

function requiredIdentifier(
  value: string,
  code: "invalid_project_id" | "invalid_user_id",
): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) throw new LeadgridProjectAccessError(code);
  return normalized;
}

/**
 * Resolves authorization from the selected Leadgrid project's organization.
 *
 * The project is loaded and joined to the caller's membership in one query.
 * There is deliberately no "first organization" lookup and no legacy
 * organization-null fallback: Discovery persistence requires an authoritative
 * organization/project pair.
 */
async function getLeadgridProjectAccessInternal(
  pool: Pick<Pool, "query">,
  input: { projectId: string; userId: string },
  includeInactive: boolean,
): Promise<LeadgridAccessibleProject | null> {
  const projectId = requiredIdentifier(input.projectId, "invalid_project_id");
  const userId = requiredIdentifier(input.userId, "invalid_user_id");
  const activeProjectPredicate = includeInactive
    ? ""
    : "AND (p.status IS NULL OR p.status NOT IN ('archived', 'deleted'))";

  const result = await pool.query<LeadgridProjectAccessRow>(
    `SELECT p.id::text,
            p.organization_id::text,
            p.name,
            p.description,
            p.project_type,
            p.industry,
            p.status,
            p.created_by,
            COALESCE(
              pm.role,
              CASE WHEN p.created_by = $2 THEN 'owner' END,
              om.role
            ) AS member_role
       FROM leadgrid_projects p
       LEFT JOIN organization_members om
         ON om.organization_id = p.organization_id
        AND om.user_id = $2
       LEFT JOIN leadgrid_project_members pm
         ON pm.organization_id = p.organization_id
        AND pm.project_id = p.id
        AND pm.user_id = $2
      WHERE p.id = $1
        AND p.organization_id IS NOT NULL
        ${activeProjectPredicate}
        AND (p.project_type IS NULL OR p.project_type NOT IN (
          'feature_film', 'documentary', 'film', 'short_film',
          'tv_series', 'commercial', 'music_video', 'casting'
        ))
        AND (
          p.created_by = $2
          OR pm.user_id IS NOT NULL
          OR (
            om.user_id IS NOT NULL
            AND NOT EXISTS (
              SELECT 1
                FROM leadgrid_user_permission_overrides denied
               WHERE denied.organization_id = p.organization_id
                 AND denied.user_id = $2
                 AND denied.permission_key = 'projects.view_all'
                 AND denied.effect = 'revoke'
            )
            AND (
              om.role = 'admin'
              OR EXISTS (
                SELECT 1
                  FROM role_permissions defaults
                 WHERE defaults.role = om.role
                   AND defaults.permission_key = 'projects.view_all'
              )
              OR EXISTS (
                SELECT 1
                  FROM leadgrid_user_permission_overrides granted
                 WHERE granted.organization_id = p.organization_id
                   AND granted.user_id = $2
                   AND granted.permission_key = 'projects.view_all'
                   AND granted.effect = 'grant'
              )
            )
          )
        )
      LIMIT 1`,
    [projectId, userId],
  );
  const row = result.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    description: row.description,
    projectType: row.project_type,
    industry: row.industry,
    status: row.status,
    createdBy: row.created_by,
    memberRole: row.member_role,
  };
}

export async function getLeadgridProjectAccess(
  pool: Pick<Pool, "query">,
  input: { projectId: string; userId: string },
): Promise<LeadgridAccessibleProject | null> {
  return getLeadgridProjectAccessInternal(pool, input, false);
}

/**
 * Resolves organization-wide project visibility. An explicit user revoke
 * wins over role defaults, direct grants and the admin role. Creator and
 * direct-project access are evaluated separately by the project ACL.
 */
export async function hasLeadgridProjectsViewAllAccess(
  pool: Pick<Pool, "query">,
  input: { organizationId: string; userId: string },
): Promise<boolean> {
  const organizationId = input.organizationId?.trim();
  if (!organizationId) return false;
  const userId = requiredIdentifier(input.userId, "invalid_user_id");
  const result = await pool.query<{ allowed: boolean }>(
    `SELECT EXISTS (
       SELECT 1
         FROM organization_members om
        WHERE om.organization_id = $1::uuid
          AND om.user_id = $2
          AND NOT EXISTS (
            SELECT 1
              FROM leadgrid_user_permission_overrides denied
             WHERE denied.organization_id = om.organization_id
               AND denied.user_id = om.user_id
               AND denied.permission_key = 'projects.view_all'
               AND denied.effect = 'revoke'
          )
          AND (
            om.role = 'admin'
            OR EXISTS (
              SELECT 1
                FROM role_permissions defaults
               WHERE defaults.role = om.role
                 AND defaults.permission_key = 'projects.view_all'
            )
            OR EXISTS (
              SELECT 1
                FROM leadgrid_user_permission_overrides granted
               WHERE granted.organization_id = om.organization_id
                 AND granted.user_id = om.user_id
                 AND granted.permission_key = 'projects.view_all'
                 AND granted.effect = 'grant'
            )
          )
     ) AS allowed`,
    [organizationId, userId],
  );
  return result.rows[0]?.allowed === true;
}

/** Stable route-facing alias matching the existing Leadgrid route convention. */
export async function loadAccessibleLeadgridProject(
  pool: Pick<Pool, "query">,
  projectId: string,
  userId: string,
): Promise<LeadgridAccessibleProject | null> {
  return getLeadgridProjectAccess(pool, { projectId, userId });
}

/**
 * GDPR/compliance-only lookup. It preserves the normal membership, direct
 * project and projects.view_all ACL, and still rejects media projects. Only
 * the active-status predicate is relaxed so archived customer data remains
 * deletable.
 */
export async function loadAccessibleLeadgridProjectForCompliance(
  pool: Pick<Pool, "query">,
  projectId: string,
  userId: string,
): Promise<LeadgridAccessibleProject | null> {
  return getLeadgridProjectAccessInternal(pool, { projectId, userId }, true);
}

export async function requireLeadgridProjectAccess(
  pool: Pick<Pool, "query">,
  input: { projectId: string; userId: string },
): Promise<LeadgridAccessibleProject> {
  const project = await getLeadgridProjectAccess(pool, input);
  if (!project) throw new LeadgridProjectAccessError("project_not_found");
  return project;
}
