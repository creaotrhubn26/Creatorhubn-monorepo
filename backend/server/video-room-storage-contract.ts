import crypto from "node:crypto";

function safeExtension(fileName: string): string {
  return fileName.toLowerCase().match(/\.([a-z0-9]{1,8})$/)?.[1] || "mp4";
}

function userKeySegment(userId: string): string {
  return crypto.createHash("sha256").update(userId).digest("hex").slice(0, 32);
}

/** Canonical private object key for a browser- or NLE-produced review proxy. */
export function buildVideoRoomObjectKey(
  storageOwnerUserId: string,
  projectId: string,
  objectId: string,
  fileName: string,
): string {
  return `users/${userKeySegment(storageOwnerUserId)}/video-room/${projectId}/${objectId}/original.${safeExtension(fileName)}`;
}
