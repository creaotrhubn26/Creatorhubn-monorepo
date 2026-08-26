import type { Pool } from "pg";
import {
  getProjectAccess,
  type ProjectAccess,
} from "./project-team-routes";

export {
  canAccessProject,
  canEditProject,
  ensureProjectTeamSchema,
  getProjectAccess,
} from "./project-team-routes";
export type { ProjectAccess } from "./project-team-routes";

export type ProjectAccessLevel = "read" | "edit" | "owner";

/**
 * Shared HTTP authorization adapter for routes that carry a project id.
 * Authentication is delegated to the application's canonical session helper;
 * authorization always resolves against both public and legacy projects.
 */
export async function requireProjectAccess(
  deps: {
    pool: Pick<Pool, "query">;
    requireUserSession: (req: any, res: any) => any;
  },
  req: any,
  res: any,
  options: {
    projectId?: string;
    level?: ProjectAccessLevel;
    hideExistence?: boolean;
  } = {},
): Promise<{ userId: string; session: any; access: ProjectAccess } | null> {
  const session = await deps.requireUserSession(req, res);
  if (!session) return null;

  const projectId = String(
    options.projectId ?? req.params?.projectId ?? req.params?.id ?? "",
  ).trim();
  if (!projectId) {
    res.status(400).json({ error: "missing_project_id" });
    return null;
  }

  const access = await getProjectAccess(deps.pool, session.userId, projectId);
  const level = options.level ?? "read";
  const allowed = level === "owner"
    ? access.isOwner
    : level === "edit"
      ? access.canEdit
      : access.canRead;

  if (!allowed) {
    if (!access.canRead || options.hideExistence) {
      res.status(404).json({ error: "not_found" });
    } else {
      res.status(403).json({
        error: level === "owner" ? "owner_access_required" : "read_only_access",
      });
    }
    return null;
  }

  return { userId: session.userId, session, access };
}
