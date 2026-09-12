/**
 * educationCensorService.ts — ekstern sensor.
 *
 * Faglærer-siden bruker Bearer; sensor-siden bruker en ISOLERT sensor-sesjon
 * (egen token, ≠ role_room_auth_token) — samme mønster som student-sesjoner.
 */

import authSessionService from '../services/authSessionService';

export interface CensorInvite {
  id: string;
  name: string | null;
  email: string | null;
  token: string;
  status: 'pending' | 'accepted' | 'revoked';
  acceptedAt?: string | null;
  expiresAt: string | null;
}

export interface CensorAssignmentRow {
  assignmentId: string;
  title: string;
  submissionStatus: string;
  teacherGrade: string | null;
  teacherFeedback: string | null;
  censorGrade: string | null;
  censorFeedback: string | null;
}
export interface CensorView {
  cohortName: string | null;
  students: { studentId: string; name: string; assignments: CensorAssignmentRow[] }[];
}

const BASE = '/api/role-room/education';
const CENSOR_TOKEN_KEY = 'role_room_censor_session_token';

const authHeaders = (): Record<string, string> =>
  authSessionService.getAuthHeadersSync() as Record<string, string>;

async function reqAuth<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(init?.headers ?? {}) } });
  if (!res.ok) { const b = (await res.json().catch(() => ({}))) as { error?: string }; throw new Error(b.error || `HTTP ${res.status}`); }
  return (await res.json()) as T;
}

export function getCensorToken(): string | null {
  try { return globalThis.localStorage?.getItem(CENSOR_TOKEN_KEY) ?? null; } catch { return null; }
}
export function clearCensorSession(): void {
  try { globalThis.localStorage?.removeItem(CENSOR_TOKEN_KEY); } catch { /* no-op */ }
}
function setCensorToken(t: string): void {
  try { globalThis.localStorage?.setItem(CENSOR_TOKEN_KEY, t); } catch { /* no-op */ }
}

export const educationCensorService = {
  // ── Faglærer ──
  async createInvite(input: { cohortId: string; name?: string; email?: string }): Promise<CensorInvite> {
    const data = await reqAuth<{ invite: CensorInvite }>(`${BASE}/censor/invites`, { method: 'POST', body: JSON.stringify(input) });
    return data.invite;
  },
  async listCohortInvites(cohortId: string): Promise<CensorInvite[]> {
    const data = await reqAuth<{ invites: CensorInvite[] }>(`${BASE}/cohorts/${encodeURIComponent(cohortId)}/censor-invites`);
    return data.invites ?? [];
  },
  async revokeInvite(id: string): Promise<void> {
    await reqAuth(`${BASE}/censor/invites/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  // ── Sensor (isolert sesjon) ──
  async claim(inviteToken: string): Promise<{ cohortName: string | null; expiresAt: string | null }> {
    const res = await fetch(`${BASE}/censor/claim`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: inviteToken }) });
    if (!res.ok) { const b = (await res.json().catch(() => ({}))) as { error?: string }; throw new Error(b.error === 'invalid_invite' ? 'Ugyldig eller utløpt sensor-lenke' : (b.error || `HTTP ${res.status}`)); }
    const data = (await res.json()) as { sessionToken: string; cohortName: string | null; expiresAt: string | null };
    if (data.sessionToken) setCensorToken(data.sessionToken);
    return { cohortName: data.cohortName, expiresAt: data.expiresAt };
  },
  async getView(): Promise<CensorView> {
    const token = getCensorToken();
    if (!token) throw new Error('Ingen sensor-sesjon');
    const res = await fetch(`${BASE}/censor/view`, { headers: { 'Content-Type': 'application/json', 'x-censor-token': token } });
    if (res.status === 401) { clearCensorSession(); throw new Error('Sensor-sesjonen er utløpt'); }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as CensorView;
  },
  async setGrade(input: { studentId: string; assignmentId: string; grade?: string; feedback?: string }): Promise<void> {
    const token = getCensorToken();
    if (!token) throw new Error('Ingen sensor-sesjon');
    const res = await fetch(`${BASE}/censor/grade`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-censor-token': token }, body: JSON.stringify(input) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  },
};
