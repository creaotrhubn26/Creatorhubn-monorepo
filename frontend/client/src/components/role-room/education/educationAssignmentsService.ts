/**
 * educationAssignmentsService.ts — API-klient for utdannings-oppgaver (lag 2).
 *
 * Sender eksplisitt Bearer-header via authSessionService (Role Room-endepunkter
 * autentiserer på header, ikke cookie — jf. educationCohortsService).
 */

import authSessionService from '../services/authSessionService';

export type AssignmentStatus = 'draft' | 'published' | 'archived';
export type SubmissionStatus = 'not_started' | 'submitted' | 'reviewed';

export interface Assignment {
  id: string;
  cohortId: string | null;
  productionId: string | null;
  productionTitle: string | null;
  productionProjectId: string | null;
  title: string;
  brief: string | null;
  learningGoals: string | null;
  dueAt: string | null;
  status: AssignmentStatus;
  artifactKind: string | null;
  submittedCount: number;
  reviewedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Submission {
  studentId: string;
  studentName: string;
  status: SubmissionStatus;
  note: string | null;
  feedback: string | null;
  grade: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
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

export interface AssignmentInput {
  title: string;
  cohortId?: string | null;
  productionId?: string | null;
  brief?: string;
  learningGoals?: string;
  dueAt?: string | null;
  status?: AssignmentStatus;
  artifactKind?: string | null;
}

export const educationAssignmentsService = {
  async listAssignments(cohortId?: string): Promise<Assignment[]> {
    const qs = cohortId ? `?cohortId=${encodeURIComponent(cohortId)}` : '';
    const data = await req<{ assignments: Assignment[] }>(`${BASE}/assignments${qs}`);
    return data.assignments ?? [];
  },
  async createAssignment(input: AssignmentInput): Promise<Assignment> {
    const data = await req<{ assignment: Assignment }>(`${BASE}/assignments`, { method: 'POST', body: JSON.stringify(input) });
    return data.assignment;
  },
  async updateAssignment(id: string, patch: Partial<AssignmentInput>): Promise<Assignment> {
    const data = await req<{ assignment: Assignment }>(`${BASE}/assignments/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) });
    return data.assignment;
  },
  async deleteAssignment(id: string): Promise<void> {
    await req(`${BASE}/assignments/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  async listSubmissions(assignmentId: string): Promise<Submission[]> {
    const data = await req<{ submissions: Submission[] }>(`${BASE}/assignments/${encodeURIComponent(assignmentId)}/submissions`);
    return data.submissions ?? [];
  },
  async setSubmission(assignmentId: string, input: { studentId: string; status: SubmissionStatus; note?: string; feedback?: string; grade?: string }): Promise<void> {
    await req(`${BASE}/assignments/${encodeURIComponent(assignmentId)}/submissions`, { method: 'PUT', body: JSON.stringify(input) });
  },
};
