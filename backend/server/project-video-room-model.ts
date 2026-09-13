import crypto from "node:crypto";

export const VIDEO_COMMENT_CATEGORIES = new Set([
  "color",
  "audio",
  "edit",
  "vfx",
  "structure",
  "text",
  "other",
]);
export const VIDEO_COMMENT_PRIORITIES = new Set([
  "must-fix",
  "nice-to-have",
  "suggestion",
]);
export const VIDEO_COMMENT_STATUSES = new Set(["open", "resolved", "archived"]);
export const VIDEO_SHARE_ACCESS = new Set(["view", "comment", "approve"]);

export function selectActiveVideoVersion<
  T extends { status?: string | null },
>(versions: T[]): T | null {
  return (
    [...versions]
      .reverse()
      .find(
        (version) =>
          version.status === "under_review" ||
          version.status === "changes_requested",
      ) ??
    versions.at(-1) ??
    null
  );
}

const text = (value: unknown, max: number): string | null => {
  const valueText = String(value ?? "").trim();
  return valueText ? valueText.slice(0, max) : null;
};

export function sanitizeVideoChapters(
  value: unknown,
): Array<{ startSec: number; title: string; intro: string | null }> {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 100)
    .map((item: any) => ({
      startSec: Math.max(
        0,
        Number(item?.startSec ?? item?.start_sec ?? 0) || 0,
      ),
      title: text(item?.title, 120) || "Kapittel",
      intro: text(item?.intro, 500),
    }))
    .sort((a, b) => a.startSec - b.startSec);
}

export function sanitizeVideoAnnotation(
  value: unknown,
): {
  paths: Array<{
    color: string;
    width: number;
    points: Array<{ x: number; y: number }>;
  }>;
} | null {
  const paths = Array.isArray((value as any)?.paths)
    ? (value as any).paths
    : [];
  const safePaths = paths
    .slice(0, 30)
    .map((path: any) => ({
      color: /^#[0-9a-f]{6}$/i.test(String(path?.color || ""))
        ? String(path.color)
        : "#ff7a00",
      width: Math.min(12, Math.max(1, Number(path?.width) || 3)),
      points: (Array.isArray(path?.points) ? path.points : [])
        .slice(0, 1000)
        .map((point: any) => ({
          x: Math.min(1, Math.max(0, Number(point?.x) || 0)),
          y: Math.min(1, Math.max(0, Number(point?.y) || 0)),
        })),
    }))
    .filter((path: any) => path.points.length > 1);
  return safePaths.length ? { paths: safePaths } : null;
}

export function normalizeVideoCommentInput(body: any) {
  const timecodeSec = Math.max(0, Number(body?.timecodeSec) || 0);
  const endRaw =
    body?.endTimecodeSec == null ? null : Number(body.endTimecodeSec);
  const mediaUrl = text(body?.suggestedMediaUrl, 2000);
  return {
    comment: text(body?.comment, 4000),
    timecodeSec,
    endTimecodeSec:
      Number.isFinite(endRaw) && endRaw! > timecodeSec ? endRaw : null,
    category: VIDEO_COMMENT_CATEGORIES.has(String(body?.category))
      ? String(body.category)
      : "other",
    priority: VIDEO_COMMENT_PRIORITIES.has(String(body?.priority))
      ? String(body.priority)
      : "suggestion",
    isDecision: Boolean(body?.isDecision),
    parentId: text(body?.parentId, 80),
    authorName: text(body?.authorName, 200),
    authorEmail: text(body?.authorEmail, 320),
    annotation: sanitizeVideoAnnotation(body?.annotation),
    suggestedMediaUrl:
      mediaUrl && /^https?:\/\//i.test(mediaUrl) ? mediaUrl : null,
    suggestedMediaLabel: text(body?.suggestedMediaLabel, 200),
    suggestedMediaFromSec:
      body?.suggestedMediaFromSec == null
        ? null
        : Math.max(0, Number(body.suggestedMediaFromSec) || 0),
    suggestedMediaToSec:
      body?.suggestedMediaToSec == null
        ? null
        : Math.max(0, Number(body.suggestedMediaToSec) || 0),
  };
}

export function newVideoShareToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(32).toString("base64url");
  return { token, tokenHash: hashVideoShareToken(token) };
}

export function hashVideoShareToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function hashVideoSharePassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 32).toString("hex");
}

export function safeVideoReturnPath(projectId: string, value: unknown): string {
  const fallback = `/workspace/${projectId}/video-room`;
  const candidate = String(value || "");
  if (!candidate.startsWith(`/workspace/${projectId}/`)) return fallback;
  if (
    candidate.includes("?") ||
    candidate.includes("#") ||
    candidate.includes("//")
  )
    return fallback;
  return candidate.slice(0, 300);
}
