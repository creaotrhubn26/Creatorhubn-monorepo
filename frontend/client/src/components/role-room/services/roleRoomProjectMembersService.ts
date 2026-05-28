/**
 * Project-medlemmer: leder fjerner / reaktiverer brukere på prosjektet.
 *
 * Soft-delete: setter deactivated_at og frigir seat-billing.
 * Reaktivere: tilbake til aktiv-listen (forbruker seat igjen).
 * Permanent sletting er IKKE støttet ennå — backend returnerer 501.
 */

export interface ProjectMember {
  userId: string;
  role: string | null;
  email: string | null;
  addedBy: string | null;
  isActive: boolean;
  deactivatedAt: string | null;
  deactivatedByUserId: string | null;
  deactivationReason: string | null;
  createdAt: string;
  displayName: string | null;
  profileImageUrl: string | null;
  bio: string | null;
  professions: string[];
}

export interface ProjectMembersResponse {
  projectId: string;
  members: ProjectMember[];
}

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    const err = new Error(`${url}: ${res.status} ${detail || res.statusText}`.trim()) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return (await res.json()) as T;
}

export const roleRoomProjectMembersService = {
  async list(projectId: string, status: 'active' | 'removed' | 'all' = 'all'): Promise<ProjectMembersResponse> {
    return jsonRequest(
      `/api/role-room/projects/${encodeURIComponent(projectId)}/members?status=${status}`,
      { method: 'GET' },
    );
  },

  async deactivate(projectId: string, userId: string, reason?: string): Promise<{ ok: boolean; stripeWarning?: string | null }> {
    return jsonRequest(
      `/api/role-room/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}`,
      { method: 'DELETE', body: JSON.stringify({ reason: reason ?? '' }) },
    );
  },

  async reactivate(projectId: string, userId: string): Promise<{ ok: boolean; stripeWarning?: string | null }> {
    return jsonRequest(
      `/api/role-room/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}/reactivate`,
      { method: 'POST' },
    );
  },
};
