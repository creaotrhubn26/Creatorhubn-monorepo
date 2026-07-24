/**
 * educationCohortsService.ts — API-klient for utdannings-kull + studenter.
 *
 * Sender eksplisitt Bearer-header via authSessionService (Role Room-endepunkter
 * autentiserer på header, ikke cookie — jf. talents-auth-fiksen).
 */

import authSessionService from '../services/authSessionService';

export interface Cohort {
  id: string;
  name: string;
  program: string | null;
  term: string | null;
  archived: boolean;
  studentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Student {
  id: string;
  cohortId: string;
  name: string;
  email: string | null;
  studentNumber: string | null;
  status: string;
  createdAt: string;
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

export const educationCohortsService = {
  async listCohorts(): Promise<Cohort[]> {
    const data = await req<{ cohorts: Cohort[] }>(`${BASE}/cohorts`);
    return data.cohorts ?? [];
  },
  async createCohort(input: { name: string; program?: string; term?: string }): Promise<Cohort> {
    const data = await req<{ cohort: Cohort }>(`${BASE}/cohorts`, { method: 'POST', body: JSON.stringify(input) });
    return data.cohort;
  },
  async updateCohort(id: string, patch: Partial<{ name: string; program: string; term: string; archived: boolean }>): Promise<Cohort> {
    const data = await req<{ cohort: Cohort }>(`${BASE}/cohorts/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) });
    return data.cohort;
  },
  async deleteCohort(id: string): Promise<void> {
    await req(`${BASE}/cohorts/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  async listStudents(cohortId: string): Promise<Student[]> {
    const data = await req<{ students: Student[] }>(`${BASE}/cohorts/${encodeURIComponent(cohortId)}/students`);
    return data.students ?? [];
  },
  async addStudent(cohortId: string, input: { name: string; email?: string; studentNumber?: string }): Promise<Student> {
    const data = await req<{ student: Student }>(`${BASE}/cohorts/${encodeURIComponent(cohortId)}/students`, { method: 'POST', body: JSON.stringify(input) });
    return data.student;
  },
  async deleteStudent(id: string): Promise<void> {
    await req(`${BASE}/students/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
};
