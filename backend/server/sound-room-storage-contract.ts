import crypto from "node:crypto";

function safeExtension(fileName: string): string {
  return fileName.toLowerCase().match(/\.([a-z0-9]{1,8})$/)?.[1] || "bin";
}

function userKeySegment(userId: string): string {
  return crypto.createHash("sha256").update(userId).digest("hex").slice(0, 32);
}

export function buildSoundRoomObjectKey(
  userId: string,
  projectId: string,
  objectId: string,
  fileName: string,
): string {
  return `users/${userKeySegment(userId)}/sound-room/${projectId}/${objectId}/original.${safeExtension(fileName)}`;
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
