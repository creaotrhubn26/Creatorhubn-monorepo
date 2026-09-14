export const PHOTO_REVIEW_STATUSES = [
  "approved",
  "needs_edit",
  "rejected",
  "flagged",
] as const;
export type PhotoReviewStatus = (typeof PHOTO_REVIEW_STATUSES)[number];

export const PHOTO_COMMENT_SCOPES = ["internal", "client"] as const;
export type PhotoCommentScope = (typeof PHOTO_COMMENT_SCOPES)[number];

export const PHOTO_COMMENT_STATUSES = ["open", "resolved"] as const;
export type PhotoCommentStatus = (typeof PHOTO_COMMENT_STATUSES)[number];

export function parsePhotoReviewStatus(value: unknown): PhotoReviewStatus | null | undefined {
  if (value === null) return null;
  return PHOTO_REVIEW_STATUSES.includes(value as PhotoReviewStatus)
    ? value as PhotoReviewStatus
    : undefined;
}

export function parsePhotoCommentScope(value: unknown): PhotoCommentScope | undefined {
  return PHOTO_COMMENT_SCOPES.includes(value as PhotoCommentScope)
    ? value as PhotoCommentScope
    : undefined;
}

export function parsePhotoCommentStatus(value: unknown): PhotoCommentStatus | undefined {
  return PHOTO_COMMENT_STATUSES.includes(value as PhotoCommentStatus)
    ? value as PhotoCommentStatus
    : undefined;
}

export function normalizePhotoComment(value: unknown): string | null {
  const comment = String(value || "").trim();
  return comment.length > 0 ? comment.slice(0, 4000) : null;
}

export function safePhotoReturnPath(projectId: string, value: unknown): string {
  const fallback = `/workspace/${projectId}/photo-room`;
  const candidate = String(value || "");
  if (!candidate.startsWith(`/workspace/${projectId}/`)) return fallback;
  if (candidate.includes("?") || candidate.includes("#") || candidate.includes("//")) return fallback;
  return candidate.slice(0, 300);
}
