/**
 * Editor Comments types — matcher backend role_room_editor_comments +
 * role_room_editor_mentions.
 */

export type AnchorType =
  | "timestamp" | "pick" | "cut" | "lower_third"
  | "caption" | "broll" | "music" | "general";

export type CommentStatus = "open" | "in_progress" | "resolved" | "wontfix";

export type CommentPriority = "low" | "normal" | "high" | "urgent";

export interface EditorComment {
  id: string;
  projectId: string;
  anchorType: AnchorType;
  anchorRef: string | null;
  timestampSec: number | null;
  agentKind: string | null;
  commentText: string;
  parentId: string | null;
  status: CommentStatus;
  assignedTo: string | null;
  priority: CommentPriority;
  authorId: string | null;
  authorDisplayName: string;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  replyCount: number;
}

export interface EditorMention {
  id: string;
  commentId: string;
  projectId: string;
  mentionedBy: string | null;
  seenAt: string | null;
  createdAt: string;
  commentText: string;
  authorDisplayName: string;
  commentStatus: CommentStatus;
  anchorType: AnchorType;
  timestampSec: number | null;
}

export function formatTimestamp(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function priorityColor(p: CommentPriority): string {
  switch (p) {
    case "urgent": return "#ef4f6f";
    case "high": return "#f0a500";
    case "normal": return "#a030c0";
    case "low": return "#a89cb8";
  }
}

export function statusColor(s: CommentStatus): string {
  switch (s) {
    case "open": return "#a030c0";
    case "in_progress": return "#f0a500";
    case "resolved": return "#4ad48a";
    case "wontfix": return "#a89cb8";
  }
}
