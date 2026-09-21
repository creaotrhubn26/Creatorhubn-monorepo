import { storageSegment } from "./creatorhub-storage-key.js";

function safeExtension(fileName: string): string {
  return fileName.toLowerCase().match(/\.([a-z0-9]{1,8})$/)?.[1] || "wav";
}

/** Canonical private object key for raw dual-system production audio. */
export function buildProductionAudioObjectKey(
  organizationId: string | null | undefined,
  storageOwnerUserId: string,
  projectId: string,
  objectId: string,
  fileName: string,
): string {
  const user = storageSegment(storageOwnerUserId, "unknown-user");
  const organization = storageSegment(organizationId, `personal-${user}`);
  return [
    "organizations",
    organization,
    "users",
    user,
    "projects",
    storageSegment(projectId, "unassigned"),
    "production-audio",
    "assets",
    storageSegment(objectId, "object"),
    `original.${safeExtension(fileName)}`,
  ].join("/");
}
