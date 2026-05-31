/**
 * reviewService — CRUD mot review-sessions + comments.
 */

import { loadSettings } from "../components/SettingsModal";
import type {
  ReviewSession, ReviewComment, ReviewStatus,
  ReviewVisibilitySettings,
} from "../lib/reviewTypes";

function getBaseUrl(): string {
  const s = loadSettings();
  const base = s.RR_POST_AGENT_BASE_URL || "https://creatorhubn.com/api/post-agent";
  return base.replace(/\/api\/post-agent\/?$/, "");
}

/** Origin uten /api/post-agent — for å bygge offentlig review-URL */
export function getPublicOrigin(): string {
  return getBaseUrl();
}

function getBearer(): string | null {
  const s = loadSettings();
  return s.RR_BEARER_TOKEN?.trim() || null;
}

export const reviewService = {
  async listSessions(projectId: string): Promise<ReviewSession[]> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget");
    const u = new URLSearchParams({ projectId });
    const res = await fetch(`${getBaseUrl()}/api/role-room/review/sessions?${u}`, {
      headers: { Authorization: `Bearer ${bearer}` },
    });
    if (!res.ok) throw new Error(`review sessions list: HTTP ${res.status}`);
    const json = await res.json() as { sessions: ReviewSession[] };
    return json.sessions;
  },

  async createSession(args: {
    projectId: string;
    sessionTitle?: string;
    clientName?: string;
    clientEmail?: string;
    agentKind?: string;
    visibilitySettings?: Partial<ReviewVisibilitySettings>;
    expiresInDays?: number;
  }): Promise<{ id: string; token: string; expiresAt: string }> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget");
    const res = await fetch(`${getBaseUrl()}/api/role-room/review/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });
    if (!res.ok) {
      const d = await res.text().catch(() => "");
      throw new Error(`review create: HTTP ${res.status} ${d}`.trim());
    }
    return await res.json() as { id: string; token: string; expiresAt: string; ok: true };
  },

  async updateSession(id: string, patch: {
    sessionTitle?: string;
    clientName?: string;
    status?: ReviewStatus;
    visibilitySettings?: Partial<ReviewVisibilitySettings>;
  }): Promise<void> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget");
    const res = await fetch(`${getBaseUrl()}/api/role-room/review/sessions/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`review update: HTTP ${res.status}`);
  },

  async deleteSession(id: string): Promise<void> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget");
    const res = await fetch(`${getBaseUrl()}/api/role-room/review/sessions/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${bearer}` },
    });
    if (!res.ok) throw new Error(`review delete: HTTP ${res.status}`);
  },

  async listComments(sessionId: string): Promise<ReviewComment[]> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget");
    const res = await fetch(`${getBaseUrl()}/api/role-room/review/sessions/${encodeURIComponent(sessionId)}/comments`, {
      headers: { Authorization: `Bearer ${bearer}` },
    });
    if (!res.ok) throw new Error(`review comments list: HTTP ${res.status}`);
    const json = await res.json() as { comments: ReviewComment[] };
    return json.comments;
  },

  async markCommentAddressed(commentId: string): Promise<void> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget");
    const res = await fetch(`${getBaseUrl()}/api/role-room/review/comments/${encodeURIComponent(commentId)}/addressed`, {
      method: "POST",
      headers: { Authorization: `Bearer ${bearer}` },
    });
    if (!res.ok) throw new Error(`mark addressed: HTTP ${res.status}`);
  },

  publicUrlFor(token: string): string {
    return `${getPublicOrigin()}/review/${token}`;
  },
};
