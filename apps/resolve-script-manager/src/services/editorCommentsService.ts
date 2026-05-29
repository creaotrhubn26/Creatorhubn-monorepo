/**
 * editorCommentsService — CRUD mot Role Room editor-comments + mentions.
 * Polling-basert real-time (V2 vil legge til WebSocket).
 */

import { loadSettings } from "../components/SettingsModal";
import type {
  EditorComment, EditorMention, AnchorType,
  CommentStatus, CommentPriority,
} from "../lib/editorCommentTypes";

function getBaseUrl(): string {
  const s = loadSettings();
  const base = s.RR_POST_AGENT_BASE_URL || "https://creatorhubn.com/api/post-agent";
  return base.replace(/\/api\/post-agent\/?$/, "");
}

function getBearer(): string | null {
  const s = loadSettings();
  return s.RR_BEARER_TOKEN?.trim() || null;
}

export const editorCommentsService = {
  async list(projectId: string, since?: string): Promise<{
    comments: EditorComment[];
    serverTime: string;
  }> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget");
    const u = new URLSearchParams({ projectId });
    if (since) u.set("since", since);
    const res = await fetch(`${getBaseUrl()}/api/role-room/editor-comments?${u}`, {
      headers: { Authorization: `Bearer ${bearer}` },
    });
    if (!res.ok) throw new Error(`comments list: HTTP ${res.status}`);
    return await res.json();
  },

  async create(args: {
    projectId: string;
    anchorType?: AnchorType;
    anchorRef?: string;
    timestampSec?: number;
    agentKind?: string;
    commentText: string;
    parentId?: string;
    priority?: CommentPriority;
    assignedTo?: string;
    authorDisplayName?: string;
  }): Promise<{ id: string; mentions: string[] }> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget");
    const res = await fetch(`${getBaseUrl()}/api/role-room/editor-comments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });
    if (!res.ok) {
      const d = await res.text().catch(() => "");
      throw new Error(`comment create: HTTP ${res.status} ${d}`.trim());
    }
    return await res.json() as { id: string; mentions: string[]; ok: true };
  },

  async update(id: string, patch: {
    commentText?: string;
    status?: CommentStatus;
    priority?: CommentPriority;
    assignedTo?: string;
  }): Promise<void> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget");
    const res = await fetch(`${getBaseUrl()}/api/role-room/editor-comments/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const d = await res.text().catch(() => "");
      throw new Error(`comment update: HTTP ${res.status} ${d}`.trim());
    }
  },

  async delete(id: string): Promise<void> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget");
    const res = await fetch(`${getBaseUrl()}/api/role-room/editor-comments/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${bearer}` },
    });
    if (!res.ok) throw new Error(`comment delete: HTTP ${res.status}`);
  },

  async listMentions(unreadOnly = false): Promise<{
    mentions: EditorMention[];
    unreadCount: number;
  }> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget");
    const u = new URLSearchParams();
    if (unreadOnly) u.set("unreadOnly", "true");
    const res = await fetch(`${getBaseUrl()}/api/role-room/editor-mentions?${u}`, {
      headers: { Authorization: `Bearer ${bearer}` },
    });
    if (!res.ok) throw new Error(`mentions list: HTTP ${res.status}`);
    return await res.json();
  },

  async markMentionSeen(mentionId: string): Promise<void> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget");
    await fetch(`${getBaseUrl()}/api/role-room/editor-mentions/${encodeURIComponent(mentionId)}/seen`, {
      method: "POST",
      headers: { Authorization: `Bearer ${bearer}` },
    });
  },
};
