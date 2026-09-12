/**
 * educationFacultyService.ts — fakultet & roller. Eksplisitt Bearer.
 */

import authSessionService from '../services/authSessionService';

export type FacultyRole = 'lead' | 'teacher' | 'supervisor' | 'guest';

export interface Faculty {
  id: string;
  name: string;
  email: string | null;
  role: FacultyRole;
  cohortIds: string[];
}

export const FACULTY_ROLE_LABELS: Record<FacultyRole, string> = {
  lead: 'Hovedlærer',
  teacher: 'Faglærer',
  supervisor: 'Veileder',
  guest: 'Gjestelærer',
};

export const FACULTY_ROLE_ORDER: FacultyRole[] = ['lead', 'teacher', 'supervisor', 'guest'];

const BASE = '/api/role-room/education';

const authHeaders = (): Record<string, string> =>
  authSessionService.getAuthHeadersSync() as Record<string, string>;

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(init?.headers ?? {}) } });
  if (!res.ok) { const b = (await res.json().catch(() => ({}))) as { error?: string }; throw new Error(b.error || `HTTP ${res.status}`); }
  return (await res.json()) as T;
}

export const educationFacultyService = {
  async listFaculty(): Promise<Faculty[]> {
    const data = await req<{ faculty: Faculty[] }>(`${BASE}/faculty`);
    return data.faculty ?? [];
  },
  async createFaculty(input: { name: string; email?: string; role?: FacultyRole }): Promise<Faculty> {
    const data = await req<{ faculty: Faculty }>(`${BASE}/faculty`, { method: 'POST', body: JSON.stringify(input) });
    return data.faculty;
  },
  async updateFaculty(id: string, patch: Partial<{ name: string; email: string; role: FacultyRole }>): Promise<void> {
    await req(`${BASE}/faculty/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) });
  },
  async deleteFaculty(id: string): Promise<void> {
    await req(`${BASE}/faculty/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  async setCohorts(id: string, cohortIds: string[]): Promise<void> {
    await req(`${BASE}/faculty/${encodeURIComponent(id)}/cohorts`, { method: 'PUT', body: JSON.stringify({ cohortIds }) });
  },
};
