/**
 * educationStudentInvitesService.ts — faglærer-siden av student-innlogging.
 *
 * Klargjør/sporer studenttilgang per student. Eksplisitt Bearer via
 * authSessionService. (Selve claim/innlogging kommer i egen skive.)
 */

import authSessionService from '../services/authSessionService';

export type StudentInviteStatus = 'none' | 'pending' | 'accepted' | 'revoked';

export interface StudentInvite {
  studentId: string;
  status: StudentInviteStatus;
  token: string | null;
  acceptedAt: string | null;
  createdAt: string | null;
}

const BASE = '/api/role-room/education';

const authHeaders = (): Record<string, string> =>
  authSessionService.getAuthHeadersSync() as Record<string, string>;

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export const educationStudentInvitesService = {
  async listCohortInvites(cohortId: string): Promise<StudentInvite[]> {
    const data = await req<{ invites: StudentInvite[] }>(`${BASE}/cohorts/${encodeURIComponent(cohortId)}/invites`);
    return data.invites ?? [];
  },
  async invite(studentId: string): Promise<StudentInvite> {
    const data = await req<{ invite: StudentInvite }>(`${BASE}/students/${encodeURIComponent(studentId)}/invite`, { method: 'POST' });
    return data.invite;
  },
  async revoke(studentId: string): Promise<void> {
    await req(`${BASE}/students/${encodeURIComponent(studentId)}/invite`, { method: 'DELETE' });
  },
};
