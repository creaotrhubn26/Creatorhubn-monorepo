import type { Request } from "express";
import type { Pool } from "pg";

import { loadAccessibleLeadgridProject } from "./leadgrid-project-access.js";

export type LeadMapProjectScopeErrorCode =
  | "invalid_project_id"
  | "project_id_required"
  | "project_not_found";

export class LeadMapProjectScopeError extends Error {
  constructor(
    public readonly status: 400 | 404,
    public readonly code: LeadMapProjectScopeErrorCode,
  ) {
    super(code);
    this.name = "LeadMapProjectScopeError";
  }
}

/** Read one explicit project binding without silently accepting arrays or blanks. */
export function requestedLeadMapProjectId(req: Request): string | null {
  const candidates = [
    req.query.projectId,
    req.query.project_id,
    req.body?.projectId,
    req.body?.project_id,
  ];
  for (const value of candidates) {
    if (value === undefined || value === null) continue;
    if (typeof value !== "string") {
      throw new LeadMapProjectScopeError(400, "invalid_project_id");
    }
    const projectId = value.trim();
    if (!projectId || projectId.length > 255) {
      throw new LeadMapProjectScopeError(400, "invalid_project_id");
    }
    return projectId;
  }
  return null;
}

export interface ResolvedLeadMapProjectScope {
  organizationId: string | null;
  projectId: string | null;
}

/**
 * Proves that an explicitly supplied customer project belongs to both the
 * caller and the lead's selected workspace. Calls without a project retain
 * the legacy organization scope; new app flows always send the project.
 */
export async function resolveLeadMapProjectScope(
  pool: Pick<Pool, "query">,
  input: {
    userId: string;
    organizationId: string | null;
    requestedProjectId: string | null;
  },
): Promise<ResolvedLeadMapProjectScope> {
  if (!input.requestedProjectId) {
    return { organizationId: input.organizationId, projectId: null };
  }
  const project = await loadAccessibleLeadgridProject(
    pool,
    input.requestedProjectId,
    input.userId,
  );
  if (
    !project
    || (input.organizationId && project.organizationId !== input.organizationId)
  ) {
    throw new LeadMapProjectScopeError(404, "project_not_found");
  }
  return {
    organizationId: project.organizationId,
    projectId: project.id,
  };
}

export function sendLeadMapProjectScopeError(
  error: unknown,
  res: import("express").Response,
): boolean {
  if (!(error instanceof LeadMapProjectScopeError)) return false;
  res.status(error.status).json({ error: error.code });
  return true;
}
