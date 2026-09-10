const SEGMENT_LIMIT = 160;

/** Keep S3 keys tenant-scoped and free of path traversal/control characters. */
export function storageSegment(value: unknown, fallback: string): string {
  const cleaned = String(value || "")
    .normalize("NFKC")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, SEGMENT_LIMIT);
  return cleaned || fallback;
}

export function creatorHubSoundRoomBounceKey(input: {
  organizationId?: string | null;
  userId: string;
  workspaceProjectId?: string | null;
  audioRoomId?: string | null;
  sessionId: string;
  objectId: string;
  fileName: string;
}): string {
  const user = storageSegment(input.userId, "unknown-user");
  const organization = storageSegment(input.organizationId, `personal-${user}`);
  return [
    "organizations",
    organization,
    "users",
    user,
    "projects",
    storageSegment(input.workspaceProjectId, "unassigned"),
    "sound-room",
    storageSegment(input.audioRoomId, "unlinked"),
    "protools",
    "sessions",
    storageSegment(input.sessionId, "unknown-session"),
    "bounces",
    `${storageSegment(input.objectId, "object")}-${storageSegment(input.fileName, "bounce.wav")}`,
  ].join("/");
}

export function creatorHubSessionPrefix(input: {
  organizationId?: string | null;
  userId: string;
  workspaceProjectId?: string | null;
  audioRoomId?: string | null;
  sessionId: string;
}): string {
  return creatorHubSoundRoomBounceKey({
    ...input,
    objectId: "object",
    fileName: "bounce.wav",
  }).replace(/\/bounces\/object-bounce\.wav$/, "/bounces/");
}
