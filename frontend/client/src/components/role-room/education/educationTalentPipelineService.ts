/**
 * educationTalentPipelineService.ts — API-klient for avgangs-pipeline
 * (utdanning → Role Room Talents). Eksplisitt Bearer via authSessionService.
 */

import authSessionService from '../services/authSessionService';

export interface TalentAttributes {
  playingAgeMin: number | null;
  playingAgeMax: number | null;
  gender: string | null;
  city: string | null;
  heightCm: number | null;
  skills: string[];
  languages: string[];
  dialects: string[];
  nsfMember: boolean;
}

export interface PipelineRow {
  studentId: string;
  name: string;
  email: string | null;
  cohortId: string | null;
  talentId: string | null;
  status: 'none' | 'claimable' | 'claimed';
  hasShowreel: boolean;
  searchable: boolean;
  nsfMember: boolean;
  attributes: TalentAttributes;
}

export interface TalentsInfo {
  title: string;
  summary: string;
  dataShared: string[];
  visibility: string;
  yourRights: string[];
  controller: string;
}

export interface PendingInvite {
  talentId: string;
  name: string;
  showreelUrl: string | null;
  credential: { institution?: string | null; program?: string | null; year?: number | null } | null;
}

export interface ShowcaseEntry {
  talentId: string;
  name: string;
  showreelUrl: string | null;
  headshotUrl: string | null;
  profileStatus: string;
  claimed: boolean;
  credential: { institution?: string | null; program?: string | null; year?: number | null } | null;
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

export const educationTalentPipelineService = {
  async getPipeline(cohortId?: string): Promise<PipelineRow[]> {
    const qs = cohortId ? `?cohortId=${encodeURIComponent(cohortId)}` : '';
    const data = await req<{ pipeline: PipelineRow[] }>(`${BASE}/talent-pipeline${qs}`);
    return data.pipeline ?? [];
  },
  async promote(studentId: string, input: { institution?: string; program?: string; year?: number; showreelPortfolioId?: string; attributes?: Partial<TalentAttributes>; consentAttested: boolean }): Promise<{ talentId: string; alreadyPromoted?: boolean; claimable?: boolean; hasShowreel?: boolean; searchable?: boolean }> {
    return req(`${BASE}/students/${encodeURIComponent(studentId)}/promote-to-talent`, { method: 'POST', body: JSON.stringify(input) });
  },
  /** Faglærer trekker tilbake en uclaimet invitasjon (sletter utkastet). */
  async withdraw(studentId: string): Promise<{ withdrawn: boolean; wasClaimed?: boolean }> {
    return req(`${BASE}/students/${encodeURIComponent(studentId)}/talent`, { method: 'DELETE' });
  },
  /** Student: hva venter på meg + hva ER Role Room Talents (transparens). */
  async getPending(): Promise<{ pending: PendingInvite[]; info: TalentsInfo }> {
    return req(`${BASE}/talent/pending`);
  },
  /** Student avslår → utkastet slettes. */
  async decline(): Promise<{ declined: number }> {
    return req(`${BASE}/talent/decline`, { method: 'POST', body: '{}' });
  },
  async setAttributes(studentId: string, attrs: Partial<TalentAttributes>): Promise<{ success: boolean; searchable: boolean; attributes: TalentAttributes }> {
    return req(`${BASE}/students/${encodeURIComponent(studentId)}/talent-attributes`, { method: 'PUT', body: JSON.stringify(attrs) });
  },
  async getShowcase(cohortId: string): Promise<ShowcaseEntry[]> {
    const data = await req<{ showcase: ShowcaseEntry[] }>(`${BASE}/cohorts/${encodeURIComponent(cohortId)}/showcase`);
    return data.showcase ?? [];
  },
  /** Student overtar sin skole-opprettede talent-profil (matcher e-post). */
  async claim(): Promise<{ claimed: number; talentIds: string[] }> {
    return req(`${BASE}/talent/claim`, { method: 'POST', body: '{}' });
  },
};
