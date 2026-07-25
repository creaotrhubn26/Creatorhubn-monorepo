/**
 * educationAssessmentService.ts — formativ vurdering (opplæringslag 4, del 1).
 *
 * Les-only kø + CSV-eksport. Skriving av karakter/tilbakemelding gjenbruker
 * educationAssignmentsService.setSubmission (samme PUT-endepunkt). Eksplisitt
 * Bearer via authSessionService.
 */

import authSessionService from '../services/authSessionService';

export interface AssessmentItem {
  submissionId: string;
  assignmentId: string;
  assignmentTitle: string;
  learningGoals: string | null;
  cohortId: string | null;
  cohortName: string | null;
  studentId: string;
  studentName: string;
  productionProjectId: string | null;
  status: 'submitted' | 'reviewed';
  grade: string | null;
  feedback: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
}

const BASE = '/api/role-room/education';

const authHeaders = (): Record<string, string> =>
  authSessionService.getAuthHeadersSync() as Record<string, string>;

export const educationAssessmentService = {
  async getQueue(cohortId?: string): Promise<AssessmentItem[]> {
    const qs = cohortId ? `?cohortId=${encodeURIComponent(cohortId)}` : '';
    const res = await fetch(`${BASE}/assessment/queue${qs}`, {
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    const data = (await res.json()) as { items: AssessmentItem[] };
    return data.items ?? [];
  },

  /** Laster ned CSV til skolens LMS/karaktersystem (Bearer → blob → download). */
  async exportCsv(cohortId?: string): Promise<void> {
    const qs = cohortId ? `?cohortId=${encodeURIComponent(cohortId)}` : '';
    const res = await fetch(`${BASE}/assessment/export${qs}`, { headers: { ...authHeaders() } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vurdering.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
