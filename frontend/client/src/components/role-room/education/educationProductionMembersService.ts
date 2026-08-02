/**
 * educationProductionMembersService.ts — skole-styrt RBAC.
 *
 * Faglærer tildeler studenter til en produksjon med rolle. Eksplisitt Bearer.
 */

import authSessionService from '../services/authSessionService';

export type MemberRole = 'viewer' | 'contributor' | 'lead';

export interface ProductionMember {
  studentId: string;
  studentName: string;
  role: MemberRole;
  assigned: boolean;
  email: string | null;
  hasAccount: boolean;
}

export const MEMBER_ROLE_LABELS: Record<MemberRole, string> = {
  viewer: 'Ser på',
  contributor: 'Bidragsyter',
  lead: 'Ansvarlig',
};

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

export const educationProductionMembersService = {
  async listMembers(productionId: string): Promise<ProductionMember[]> {
    const data = await req<{ members: ProductionMember[] }>(`${BASE}/productions/${encodeURIComponent(productionId)}/members`);
    return data.members ?? [];
  },
  async setMember(productionId: string, input: { studentId: string; role: MemberRole }): Promise<void> {
    await req(`${BASE}/productions/${encodeURIComponent(productionId)}/members`, { method: 'PUT', body: JSON.stringify(input) });
  },
  async removeMember(productionId: string, studentId: string): Promise<void> {
    await req(`${BASE}/productions/${encodeURIComponent(productionId)}/members/${encodeURIComponent(studentId)}`, { method: 'DELETE' });
  },
  /** Inviter en tildelt student til å opprette ekte konto (broen matcher på e-post). */
  async inviteAccount(productionId: string, studentId: string): Promise<{ invited: boolean; email: string }> {
    return req(`${BASE}/productions/${encodeURIComponent(productionId)}/members/${encodeURIComponent(studentId)}/invite-account`, { method: 'POST', body: '{}' });
  },
};
