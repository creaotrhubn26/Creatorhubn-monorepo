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
  role: string;
}

export interface StudentRubricBreakdown {
  pct: number;
  criteria: { title: string; goalTitle: string | null; level: number }[];
}
export interface StudentViewAssignment {
  id: string;
  title: string;
  brief: string | null;
  learningGoals: string | null;
  dueAt: string | null;
  productionTitle: string | null;
  productionProjectId: string | null;
  artifactKind?: string | null;
  artifactView?: string | null;
  submissionStatus: 'not_started' | 'submitted' | 'reviewed';
  grade: string | null;
  feedback: string | null;
  link: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  rubric: StudentRubricBreakdown | null;
}

export interface StudentView {
  student: { id: string; name: string; cohortId: string | null; cohortName: string | null } | null;
  productions: StudentViewProduction[];
  assignments: StudentViewAssignment[];
  canOpenProduction?: boolean;
}

export interface StudentProductionHub {
  production: {
    id: string;
    title: string;
    projectId: string;
    projectName: string | null;
    projectStatus: string | null;
    projectDescription: string | null;
    myRole: string;
  };
  teammates: { name: string; role: string; isMe: boolean }[];
  assignments: { id: string; title: string; dueAt: string | null; submissionStatus: string; grade: string | null; feedback: string | null }[];
}

const BASE = '/api/role-room/education';

/** Isolert studentsesjon-token (SEPARAT fra role_room_auth_token). */
const STUDENT_TOKEN_KEY = 'role_room_student_session_token';

const authHeaders = (): Record<string, string> =>
  authSessionService.getAuthHeadersSync() as Record<string, string>;

export function getStudentToken(): string | null {
  try { return globalThis.localStorage?.getItem(STUDENT_TOKEN_KEY) ?? null; } catch { return null; }
}
export function hasStudentSession(): boolean {
  return !!getStudentToken();
}
function setStudentToken(token: string): void {
  try { globalThis.localStorage?.setItem(STUDENT_TOKEN_KEY, token); } catch { /* no-op */ }
}
export function clearStudentSession(): void {
  try { globalThis.localStorage?.removeItem(STUDENT_TOKEN_KEY); } catch { /* no-op */ }
}

export const educationStudentViewService = {
  /** Admin/eier-preview: eksplisitt studentId via Bearer. */
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

  /** Innlogget student: egen visning — isolert studentsesjon-token, ellers ekte-konto Bearer. */
  async getMyView(): Promise<StudentView> {
    const token = getStudentToken();
    const headers: Record<string, string> = token
      ? { 'x-student-token': token }
      : { ...authHeaders() };
    const res = await fetch(`${BASE}/student/view`, { headers });
    if (res.status === 401 && token) { clearStudentSession(); throw new Error('Sesjonen er utløpt'); }
    if (!res.ok) throw new Error(res.status === 404 ? 'no_student_profile' : `HTTP ${res.status}`);
    return (await res.json()) as StudentView;
  },

  /** Innlogget student: read-only produksjons-hub for en TILDELT produksjon. */
  async getMyProduction(productionId: string): Promise<StudentProductionHub> {
    const token = getStudentToken();
    if (!token) throw new Error('Ingen studentsesjon');
    const res = await fetch(`${BASE}/student/production/${encodeURIComponent(productionId)}`, {
      headers: { 'Content-Type': 'application/json', 'x-student-token': token },
    });
    if (res.status === 401) { clearStudentSession(); throw new Error('Sesjonen er utløpt'); }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as StudentProductionHub;
  },

  /** Innlogget student leverer en lenke til arbeidet sitt. */
  async submitAssignment(assignmentId: string, input: { link?: string; note?: string }): Promise<{ status: string; link: string | null }> {
    const token = getStudentToken();
    if (!token) throw new Error('Ingen studentsesjon');
    const res = await fetch(`${BASE}/student/assignment/${encodeURIComponent(assignmentId)}/submit`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-student-token': token },
      body: JSON.stringify(input),
    });
    if (res.status === 401) { clearStudentSession(); throw new Error('Sesjonen er utløpt'); }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as { status: string; link: string | null };
  },

  /** Løs inn en invitasjon → lagrer studentsesjon-token. */
  async claim(inviteToken: string, email?: string): Promise<{ id: string; name: string; cohortName: string | null } | null> {
    const res = await fetch(`${BASE}/student/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: inviteToken, email: email?.trim() || undefined }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      const msg: Record<string, string> = {
        invalid_invite: 'Ugyldig eller utløpt invitasjon',
        email_required: 'Skriv inn e-posten invitasjonen ble sendt til.',
        email_mismatch: 'E-posten stemmer ikke med invitasjonen.',
      };
      throw new Error(msg[body.error ?? ''] || body.error || `HTTP ${res.status}`);
    }
    const data = (await res.json()) as { sessionToken: string; student: { id: string; name: string; cohortName: string | null } | null };
    if (data.sessionToken) setStudentToken(data.sessionToken);
    return data.student;
  },
};
