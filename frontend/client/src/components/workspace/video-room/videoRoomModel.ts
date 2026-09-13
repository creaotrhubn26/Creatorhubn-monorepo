export function buildVideoRoomStateUrl(
  projectId: string,
  versionId?: string | null,
): string {
  const base = `/api/projects/${encodeURIComponent(projectId)}/video-room`;
  return versionId
    ? `${base}?versionId=${encodeURIComponent(versionId)}`
    : base;
}

export function groupVideoCommentReplies<
  T extends { parentId?: string | null },
>(comments: T[]): Record<string, T[]> {
  return comments.reduce<Record<string, T[]>>((result, comment) => {
    if (comment.parentId) (result[comment.parentId] ||= []).push(comment);
    return result;
  }, {});
}

export function filterVideoComments<
  T extends {
    parentId?: string | null;
    status?: string;
    isDecision?: boolean;
  },
>(comments: T[], filter: string): T[] {
  return comments
    .filter((comment) => !comment.parentId)
    .filter((comment) => {
      if (filter === "uloste")
        return !["resolved", "done"].includes(comment.status || "open");
      if (filter === "loste")
        return ["resolved", "done"].includes(comment.status || "open");
      if (filter === "beslutninger") return Boolean(comment.isDecision);
      return true;
    });
}
