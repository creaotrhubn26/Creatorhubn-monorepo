import type { Pool } from "pg";
import { resolveEffectivePermissions } from "./lead-map-permission-routes.js";
import {
  loadAccessibleLeadgridProject,
  type LeadgridAccessibleProject,
} from "./leadgrid-project-access.js";

export type LeadgridExportAccessErrorCode =
  | "project_id_required"
  | "invalid_project_id"
  | "project_not_found"
  | "mangler_tillatelse";

export class LeadgridExportAccessError extends Error {
  constructor(
    readonly code: LeadgridExportAccessErrorCode,
    readonly status: 400 | 403 | 404,
  ) {
    super(code);
    this.name = "LeadgridExportAccessError";
  }
}

export function parseRequiredExportProjectId(value: unknown): string {
  if (value === undefined || value === null || value === "") {
    throw new LeadgridExportAccessError("project_id_required", 400);
  }
  if (typeof value !== "string") {
    throw new LeadgridExportAccessError("invalid_project_id", 400);
  }
  const projectId = value.trim();
  if (!projectId || projectId.length > 255) {
    throw new LeadgridExportAccessError("invalid_project_id", 400);
  }
  return projectId;
}

/**
 * Resolves one active non-casting Leadgrid project through current membership,
 * then applies the effective `leads.export` permission including overrides.
 */
export async function requireLeadgridExportProject(
  pool: Pick<Pool, "query">,
  input: { userId: string; projectId: unknown },
): Promise<LeadgridAccessibleProject> {
  const projectId = parseRequiredExportProjectId(input.projectId);
  const project = await loadAccessibleLeadgridProject(
    pool,
    projectId,
    input.userId,
  );
  if (!project) {
    throw new LeadgridExportAccessError("project_not_found", 404);
  }

  const { permissions } = await resolveEffectivePermissions(
    pool as Pool,
    project.organizationId,
    input.userId,
  );
  if (!permissions.has("leads.export")) {
    throw new LeadgridExportAccessError("mangler_tillatelse", 403);
  }
  return project;
}
