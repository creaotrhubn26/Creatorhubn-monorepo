/**
 * educationOverviewService.ts — faglærer-forsidens aggregerte data.
 */

import authSessionService from '../services/authSessionService';

export interface OverviewData {
  stats: { dueThisWeek: number; toReview: number; missingSubmissions: number; productions: number };
  dueSoon: { assignmentId: string; title: string; cohortName: string | null; dueAt: string | null }[];
  reviewQueue: { submissionId: string; studentName: string; assignmentTitle: string; cohortName: string | null; submittedAt: string | null }[];
}

const BASE = '/api/role-room/education';

const authHeaders = (): Record<string, string> =>
  authSessionService.getAuthHeadersSync() as Record<string, string>;

export const educationOverviewService = {
  async getOverview(): Promise<OverviewData> {
    const res = await fetch(`${BASE}/overview`, {
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as OverviewData;
  },
};
