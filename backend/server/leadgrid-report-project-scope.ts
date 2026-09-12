import type { Pool } from "pg";
import { loadAccessibleLeadgridProject } from "./leadgrid-project-access.js";

export class LeadgridReportProjectScopeError extends Error {
  constructor(
    readonly code: "invalid_project_id" | "project_not_found",
    readonly status: 400 | 404,
  ) {
    super(code);
    this.name = "LeadgridReportProjectScopeError";
  }
}

export function parseOptionalReportProjectId(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new LeadgridReportProjectScopeError("invalid_project_id", 400);
  }
  const projectId = value.trim();
  if (!projectId || projectId.length > 255) {
    throw new LeadgridReportProjectScopeError("invalid_project_id", 400);
  }
  return projectId;
}

/**
 * Resolves an optional active project through current membership and verifies
 * that it belongs to the already-authorized report organization.
 */
export async function resolveAccessibleReportProject(
  pool: Pick<Pool, "query">,
  input: {
    userId: string;
    organizationId: string;
    projectId: unknown;
  },
): Promise<{ id: string; name: string } | null> {
  const projectId = parseOptionalReportProjectId(input.projectId);
  if (!projectId) return null;
  const project = await loadAccessibleLeadgridProject(
    pool,
    projectId,
    input.userId,
  );
  if (!project || project.organizationId !== input.organizationId) {
    // The same response is used for missing and foreign projects so the route
    // does not become a project-ID enumeration oracle.
    throw new LeadgridReportProjectScopeError("project_not_found", 404);
  }
  return { id: project.id, name: project.name };
}
