/**
 * educationLearningGoalsService.ts — læringsmål-katalog + måloppnåelse.
 */

import authSessionService from '../services/authSessionService';

export interface LearningGoal {
  id: string;
  code: string | null;
  title: string;
  description: string | null;
  sortOrder: number;
}

export interface GoalAttainment {
  goalId: string;
  code: string | null;
  title: string;
  criteriaCount: number;
  scoreCount: number;
  avgLevel: number;
  pct: number;
}

const BASE = '/api/role-room/education';

const authHeaders = (): Record<string, string> =>
  authSessionService.getAuthHeadersSync() as Record<string, string>;

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(init?.headers ?? {}) } });
  if (!res.ok) { const b = (await res.json().catch(() => ({}))) as { error?: string }; throw new Error(b.error || `HTTP ${res.status}`); }
  return (await res.json()) as T;
}

export const educationLearningGoalsService = {
  async listGoals(cohortId: string): Promise<LearningGoal[]> {
    const data = await req<{ goals: LearningGoal[] }>(`${BASE}/cohorts/${encodeURIComponent(cohortId)}/learning-goals`);
    return data.goals ?? [];
  },
  async addGoal(cohortId: string, input: { code?: string; title: string; description?: string }): Promise<LearningGoal> {
    const data = await req<{ goal: LearningGoal }>(`${BASE}/cohorts/${encodeURIComponent(cohortId)}/learning-goals`, { method: 'POST', body: JSON.stringify(input) });
    return data.goal;
  },
  async deleteGoal(id: string): Promise<void> {
    await req(`${BASE}/learning-goals/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  async getAttainment(cohortId: string): Promise<GoalAttainment[]> {
    const data = await req<{ attainment: GoalAttainment[] }>(`${BASE}/cohorts/${encodeURIComponent(cohortId)}/attainment`);
    return data.attainment ?? [];
  },
};
