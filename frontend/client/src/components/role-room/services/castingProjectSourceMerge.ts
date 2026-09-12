import type { CastingProject } from "../models/casting";

export const CANONICAL_CASTING_PROJECT_SOURCE = "casting_projects";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

/**
 * A canonical SQL row can be only a project shell, while the browser still
 * holds rich Role Room work created before the two stores were reconciled.
 * Preserve that work and let server-owned identity/access fields win.
 */
export function mergeCanonicalProjectShellWithLocal(
  serverProject: CastingProject,
  localProject?: CastingProject | null,
): CastingProject {
  if (
    !localProject
    || serverProject.projectStorageSource !== CANONICAL_CASTING_PROJECT_SOURCE
  ) {
    return serverProject;
  }

  const merged = {
    ...serverProject,
    ...localProject,
    metadata: {
      ...record(localProject.metadata),
      ...record(serverProject.metadata),
    },
    settings: {
      ...record(localProject.settings),
      ...record(serverProject.settings),
    },
  } as CastingProject;

  for (const key of [
    "id", "name", "description", "status", "ownerId", "owner_id",
    "createdBy", "created_by", "createdByEmail", "created_by_email",
    "projectType", "project_type", "genre", "startDate", "start_date",
    "endDate", "end_date", "budget", "currency", "createdAt",
    "created_at", "updatedAt", "updated_at", "projectStorageSource",
  ]) {
    const serverValue = (serverProject as Record<string, unknown>)[key];
    if (serverValue !== undefined && serverValue !== null) {
      (merged as Record<string, unknown>)[key] = serverValue;
    }
  }

  merged.projectStorageSource = CANONICAL_CASTING_PROJECT_SOURCE;
  return merged;
}
