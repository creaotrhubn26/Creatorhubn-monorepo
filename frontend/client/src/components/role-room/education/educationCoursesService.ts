/**
 * educationCoursesService.ts — API-klient for emner (studiepoenggivende enheter).
 * Eksplisitt Bearer via authSessionService.
 */

import authSessionService from '../services/authSessionService';

export interface LearningOutcomes {
  knowledge: string[];
  skills: string[];
  generalCompetence: string[];
}

export interface Course {
  id: string;
  cohortId: string | null;
  code: string | null;
  title: string;
  credits: number | null;
  term: string | null;
  vurderingsform: string | null;
  learningOutcomes: LearningOutcomes;
  assignmentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CourseInput {
  code?: string;
  title: string;
  credits?: number | null;
  term?: string;
  cohortId?: string | null;
  vurderingsform?: string | null;
  learningOutcomes?: LearningOutcomes;
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

export const educationCoursesService = {
  async listCourses(cohortId?: string): Promise<Course[]> {
    const qs = cohortId ? `?cohortId=${encodeURIComponent(cohortId)}` : '';
    const data = await req<{ courses: Course[] }>(`${BASE}/courses${qs}`);
    return data.courses ?? [];
  },
  async createCourse(input: CourseInput): Promise<Course> {
    const data = await req<{ course: Course }>(`${BASE}/courses`, { method: 'POST', body: JSON.stringify(input) });
    return data.course;
  },
  async updateCourse(id: string, patch: Partial<CourseInput>): Promise<Course> {
    const data = await req<{ course: Course }>(`${BASE}/courses/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) });
    return data.course;
  },
  async deleteCourse(id: string): Promise<void> {
    await req(`${BASE}/courses/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
};
