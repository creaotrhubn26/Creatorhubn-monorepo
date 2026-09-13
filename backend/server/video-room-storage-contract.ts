import { storageSegment } from "./creatorhub-storage-key.js";

function safeExtension(fileName: string): string {
  return fileName.toLowerCase().match(/\.([a-z0-9]{1,8})$/)?.[1] || "mp4";
}

/** Canonical private object key for a browser- or NLE-produced review proxy. */
export function buildVideoRoomObjectKey(
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
    "video-room",
    "versions",
    storageSegment(objectId, "object"),
    `original.${safeExtension(fileName)}`,
  ].join("/");
}
