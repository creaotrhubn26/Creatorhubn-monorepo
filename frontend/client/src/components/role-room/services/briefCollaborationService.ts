/**
 * briefCollaborationService — talker mot Creative Space Sync-endepunktene
 * (kommentarer + activity-feed) lagt til i role-room-routes.ts.
 *
 * Holdt separat fra producerWorkflowService for å unngå å vokse den
 * 2600-linjers monolitten.
 */

import { authSessionService } from './authSessionService';

const API_BASE = '/api/role-room';

export interface BriefComment {
  id: string;
  project_id: string;
  field_key: string;
  author_user_id: string | null;
  author_role: 'client' | 'producer' | 'system';
  author_name: string | null;
  body: string;
  parent_id: string | null;
  resolved_at: string | null;
  resolved_by_role: string | null;
  created_at: string;
  updated_at: string;
}

export type BriefActivityKind =
  | 'brief_saved'
  | 'field_edited'
  | 'comment_added'
  | 'comment_replied'
  | 'comment_resolved'
  | 'comment_deleted'
  | 'brief_viewed'
  | 'reference_added'
  | 'reference_removed'
  | 'voice_memo_added';

export interface BriefActivityEntry {
  id: number;
  project_id: string;
  event_kind: BriefActivityKind | string;
  actor_user_id: string | null;
  actor_role: string | null;
  actor_name: string | null;
  field_key: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...authSessionService.getAuthHeadersSync(),
  };
  const session = authSessionService.getSessionSync();
  if (typeof session.currentUserId === 'string' && session.currentUserId.trim().length > 0) {
    headers['x-role-room-user-id'] = session.currentUserId.trim();
  }
  const adminUser = session.adminUser;
  if (typeof adminUser?.email === 'string' && adminUser.email.trim().length > 0) {
    headers['x-role-room-email'] = adminUser.email.trim();
  }
  if (typeof adminUser?.role === 'string' && adminUser.role.trim().length > 0) {
    headers['x-role-room-role'] = adminUser.role.trim();
  }
  return headers;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...buildHeaders(), ...init.headers },
  });
  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (body && typeof body.error === 'string') detail = body.error;
    } catch {
      /* noop */
    }
    throw new Error(detail);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const briefCollaborationService = {
  async listComments(
    projectId: string,
    options: { fieldKey?: string; includeResolved?: boolean } = {},
  ): Promise<BriefComment[]> {
    const params = new URLSearchParams();
    if (options.fieldKey) params.set('fieldKey', options.fieldKey);
    if (options.includeResolved) params.set('includeResolved', '1');
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const response = await request<{ comments: BriefComment[] }>(
      `/projects/${encodeURIComponent(projectId)}/brief-comments${suffix}`,
    );
    return response.comments;
  },

  async addComment(
    projectId: string,
    input: { fieldKey: string; body: string; parentId?: string; authorName?: string },
  ): Promise<BriefComment> {
    const response = await request<{ comment: BriefComment }>(
      `/projects/${encodeURIComponent(projectId)}/brief-comments`,
      { method: 'POST', body: JSON.stringify(input) },
    );
    return response.comment;
  },

  async resolveComment(projectId: string, commentId: string): Promise<BriefComment> {
    const response = await request<{ comment: BriefComment }>(
      `/projects/${encodeURIComponent(projectId)}/brief-comments/${encodeURIComponent(commentId)}/resolve`,
      { method: 'POST' },
    );
    return response.comment;
  },

  async deleteComment(projectId: string, commentId: string): Promise<void> {
    await request<void>(
      `/projects/${encodeURIComponent(projectId)}/brief-comments/${encodeURIComponent(commentId)}`,
      { method: 'DELETE' },
    );
  },

  async listActivity(projectId: string, limit = 50): Promise<BriefActivityEntry[]> {
    const response = await request<{ activity: BriefActivityEntry[] }>(
      `/projects/${encodeURIComponent(projectId)}/brief-activity?limit=${limit}`,
    );
    return response.activity;
  },
};
