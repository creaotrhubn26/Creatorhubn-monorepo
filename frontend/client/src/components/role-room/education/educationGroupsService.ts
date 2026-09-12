/**
 * educationGroupsService.ts — API-klient for grupper i et kull.
 *
 * Eksplisitt Bearer via authSessionService (samme mønster som cohorts-service).
 */

import authSessionService from '../services/authSessionService';

export interface EducationGroup {
  id: string;
  cohortId: string;
  name: string;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
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

export const educationGroupsService = {
  async listGroups(cohortId: string): Promise<EducationGroup[]> {
    const data = await req<{ groups: EducationGroup[] }>(`${BASE}/cohorts/${encodeURIComponent(cohortId)}/groups`);
    return data.groups ?? [];
  },
  async createGroup(cohortId: string, name: string): Promise<EducationGroup> {
    const data = await req<{ group: EducationGroup }>(`${BASE}/cohorts/${encodeURIComponent(cohortId)}/groups`, { method: 'POST', body: JSON.stringify({ name }) });
    return data.group;
  },
  async renameGroup(id: string, name: string): Promise<EducationGroup> {
    const data = await req<{ group: EducationGroup }>(`${BASE}/groups/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ name }) });
    return data.group;
  },
  async deleteGroup(id: string): Promise<void> {
    await req(`${BASE}/groups/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
};
