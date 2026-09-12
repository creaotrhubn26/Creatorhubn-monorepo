/**
 * educationRubricService.ts — rubrikker (vurderingskriterier + scoring).
 * Fast 3-nivåskala: 0=Ikke nådd, 1=Delvis, 2=Nådd. Eksplisitt Bearer.
 */

import authSessionService from '../services/authSessionService';

export interface RubricCriterion {
  id: string;
  title: string;
  learningGoal: string | null;
  learningGoalId: string | null;
  learningGoalTitle: string | null;
  sortOrder: number;
}

export const RUBRIC_LEVELS: { value: 0 | 1 | 2; label: string }[] = [
  { value: 0, label: 'Ikke nådd' },
  { value: 1, label: 'Delvis' },
  { value: 2, label: 'Nådd' },
];
export const RUBRIC_MAX = 2;

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

export const educationRubricService = {
  async getRubric(assignmentId: string): Promise<RubricCriterion[]> {
    const data = await req<{ criteria: RubricCriterion[] }>(`${BASE}/assignments/${encodeURIComponent(assignmentId)}/rubric`);
    return data.criteria ?? [];
  },
  async addCriterion(assignmentId: string, input: { title: string; learningGoal?: string; learningGoalId?: string }): Promise<RubricCriterion> {
    const data = await req<{ criterion: RubricCriterion }>(`${BASE}/assignments/${encodeURIComponent(assignmentId)}/rubric/criteria`, { method: 'POST', body: JSON.stringify(input) });
    return data.criterion;
  },
  async deleteCriterion(criterionId: string): Promise<void> {
    await req(`${BASE}/rubric/criteria/${encodeURIComponent(criterionId)}`, { method: 'DELETE' });
  },
  async getScores(assignmentId: string, studentId: string): Promise<{ criteria: RubricCriterion[]; scores: Record<string, number> }> {
    return req<{ criteria: RubricCriterion[]; scores: Record<string, number> }>(`${BASE}/assignments/${encodeURIComponent(assignmentId)}/rubric/scores?studentId=${encodeURIComponent(studentId)}`);
  },
  async setScore(input: { criterionId: string; studentId: string; level: 0 | 1 | 2 }): Promise<void> {
    await req(`${BASE}/rubric/scores`, { method: 'PUT', body: JSON.stringify(input) });
  },
};
