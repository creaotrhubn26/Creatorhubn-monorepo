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
export async function getLeadgridProjectAccess(
  pool: Pick<Pool, "query">,
  input: { projectId: string; userId: string },
): Promise<LeadgridAccessibleProject | null> {
  const projectId = requiredIdentifier(input.projectId, "invalid_project_id");
  const userId = requiredIdentifier(input.userId, "invalid_user_id");

  const result = await pool.query<LeadgridProjectAccessRow>(
    `SELECT p.id::text,
            p.organization_id::text,
            p.name,
            p.description,
            p.industry,
            p.status,
            p.created_by,
            om.role AS member_role
       FROM leadgrid_projects p
       JOIN organization_members om
         ON om.organization_id = p.organization_id
        AND om.user_id = $2
      WHERE p.id = $1
        AND p.organization_id IS NOT NULL
        AND (p.status IS NULL OR p.status NOT IN ('archived', 'deleted'))
        AND (p.project_type IS NULL OR p.project_type NOT IN (
          'feature_film', 'documentary', 'film', 'short_film',
          'tv_series', 'commercial', 'music_video', 'casting'
        ))
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
    industry: row.industry,
    status: row.status,
    createdBy: row.created_by,
    memberRole: row.member_role,
  };
}

/** Stable route-facing alias matching the existing Leadgrid route convention. */
export async function loadAccessibleLeadgridProject(
  pool: Pick<Pool, "query">,
  projectId: string,
  userId: string,
): Promise<LeadgridAccessibleProject | null> {
  return getLeadgridProjectAccess(pool, { projectId, userId });
}

export async function requireLeadgridProjectAccess(
  pool: Pick<Pool, "query">,
  input: { projectId: string; userId: string },
): Promise<LeadgridAccessibleProject> {
  const project = await getLeadgridProjectAccess(pool, input);
  if (!project) throw new LeadgridProjectAccessError("project_not_found");
  return project;
}
