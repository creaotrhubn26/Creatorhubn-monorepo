import { storageSegment } from "./creatorhub-storage-key.js";

function safeExtension(fileName: string): string {
  return fileName.toLowerCase().match(/\.([a-z0-9]{1,8})$/)?.[1] || "bin";
}

export function buildSoundRoomObjectKey(
  input: {
    organizationId?: string | null;
    userId: string;
    workspaceProjectId?: string | null;
    projectId: string;
    sessionId?: string | null;
    channel: "browser" | "protools" | "migration";
    objectId: string;
    fileName: string;
  },
): string {
  const user = storageSegment(input.userId, "unknown-user");
  const organization = storageSegment(input.organizationId, `personal-${user}`);
  const common = [
    "organizations",
    organization,
    "users",
    user,
    "projects",
    storageSegment(input.workspaceProjectId, "unassigned"),
    "sound-room",
    storageSegment(input.projectId, "unlinked"),
  ];
  const source = input.channel === "protools"
    ? ["protools", "sessions", storageSegment(input.sessionId, "unknown-session"), "bounces"]
    : [input.channel, "uploads"];
  return [...common, ...source, storageSegment(input.objectId, "object"), `original.${safeExtension(input.fileName)}`].join("/");
}

export function validatedSoundRoomRange(value: unknown): string | null | false {
  if (value == null || value === "") return null;
  const range = String(value).trim();
  if (range.length > 100 || range.includes(",") || !/^bytes=(?:\d+-\d*|-\d+)$/.test(range)) return false;
  return range;
}

function safeDecode(value: string): string {
  try { return decodeURIComponent(value); } catch { return value; }
}

/** Accept known B2 URL shapes only; arbitrary external URLs are never imported. */
export function extractLegacyB2Key(fileUrl: string, bucket: string): string | null {
  const raw = String(fileUrl || "").trim();
  if (!raw) return null;
  if (raw.startsWith("b2://")) {
    const withoutScheme = raw.slice(5);
    const slash = withoutScheme.indexOf("/");
    if (slash < 1 || withoutScheme.slice(0, slash) !== bucket) return null;
    return safeDecode(withoutScheme.slice(slash + 1)).replace(/^\/+/, "") || null;
  }
  let url: URL;
  try { url = new URL(raw); } catch { return null; }
  if (url.protocol !== "https:" || !/(^|\.)backblazeb2\.com$/i.test(url.hostname)) return null;
  const path = safeDecode(url.pathname).replace(/^\/+/, "");
  const filePrefix = `file/${bucket}/`;
  if (path.startsWith(filePrefix)) return path.slice(filePrefix.length) || null;
  if (path.startsWith(`${bucket}/`)) return path.slice(bucket.length + 1) || null;
  if (url.hostname.toLowerCase().startsWith(`${bucket.toLowerCase()}.`)) return path || null;
  return null;
}
