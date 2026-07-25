/**
 * educationStudentViewService.ts — studentens «Min side» (les-only).
 *
 * Foreløpig super-admin/eier-preview (studentId sendes eksplisitt). Ekte
 * studentsesjon vil senere resolve studentId server-side. Eksplisitt Bearer.
 */

import authSessionService from '../services/authSessionService';

export interface StudentViewProduction {
  id: string;
  title: string;
  projectId: string;
  projectStatus: string | null;
}

export interface StudentViewAssignment {
  id: string;
  title: string;
  brief: string | null;
  learningGoals: string | null;
  dueAt: string | null;
  productionTitle: string | null;
  productionProjectId: string | null;
  submissionStatus: 'not_started' | 'submitted' | 'reviewed';
  grade: string | null;
  feedback: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
}

export interface StudentView {
  student: { id: string; name: string; cohortId: string | null; cohortName: string | null } | null;
  productions: StudentViewProduction[];
  assignments: StudentViewAssignment[];
}

const BASE = '/api/role-room/education';

const authHeaders = (): Record<string, string> =>
  authSessionService.getAuthHeadersSync() as Record<string, string>;

export const educationStudentViewService = {
  async getStudentView(studentId: string): Promise<StudentView> {
    const res = await fetch(`${BASE}/student/view?studentId=${encodeURIComponent(studentId)}`, {
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    return (await res.json()) as StudentView;
  },
};
