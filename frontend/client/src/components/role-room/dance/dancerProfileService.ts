/**
 * Frontend client for /api/dance/profiles.
 *
 * Backend-modellen er identisk med disse typene (samme felt-navn, samme
 * enum-verdier). Vi bruker fetch direkte mot relative API-URLer slik at
 * proxyen i dev og samme-origin i prod gjør jobben.
 */

import { danceAuthHeaders } from './danceAuthHeaders';

// ─── Re-eksporterbare enum-typer (samme verdier som dancerProfile.ts) ───

export type DanceStyle =
  | 'contemporary'
  | 'ballet'
  | 'jazz'
  | 'commercial'
  | 'hip-hop'
  | 'folk'
  | 'other';

export type InjuryStatus =
  | 'healthy'
  | 'rehab'
  | 'cleared-with-restriction';

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'pro';

export type SkillCategory =
  | 'turns'
  | 'leaps'
  | 'lifts'
  | 'partnering'
  | 'improv'
  | 'musicality'
  | 'floorwork';

export interface DancerAvailabilityWindow {
  from: string;
  to: string;
  note?: string;
}

export interface DancerBodyMeasurements {
  inseamCm?: number;
  reachCm?: number;
  weightKg?: number;
  shoeSize?: number;
}

/** Skrivbare felter (matcher backend zod-skjema). */
export interface DancerProfileExtras {
  displayName: string | null;
  heightCm: number | null;
  primaryStyle: DanceStyle | null;
  strengths: string[];
  availabilityWindows: DancerAvailabilityWindow[];
  injuryStatus: InjuryStatus;
  injuryNote: string | null;
  reelUrls: string[];
  bodyMeasurements: DancerBodyMeasurements;
  skillLevels: Partial<Record<string, SkillLevel>>;
  notes: string | null;
  projectId: string | null;
}

/** Full record returnert fra serveren. */
export interface DancerProfile extends DancerProfileExtras {
  ownerUserId: string;
  dancerId: string;
  createdAt: string;
  updatedAt: string;
}

// ─── HTTP-helpers ───────────────────────────────────────────────────────

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new Error(body.message || body.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

const BASE = '/api/dance/profiles';

export async function listDancerProfiles(projectId?: string): Promise<DancerProfile[]> {
  const url = typeof projectId === 'string' && projectId.length > 0
    ? `${BASE}?projectId=${encodeURIComponent(projectId)}`
    : BASE;
  const res = await fetch(url, { headers: danceAuthHeaders(), credentials: 'include' });
  const body = await readJson<{ success: boolean; data: DancerProfile[] }>(res);
  return body.data;
}

export async function getDancerProfile(dancerId: string): Promise<DancerProfile | null> {
  const res = await fetch(`${BASE}/${encodeURIComponent(dancerId)}`, {
    headers: danceAuthHeaders(),
    credentials: 'include',
  });
  if (res.status === 404) return null;
  const body = await readJson<{ success: boolean; data: DancerProfile }>(res);
  return body.data;
}

export async function upsertDancerProfile(
  dancerId: string,
  extras: Partial<DancerProfileExtras>,
): Promise<DancerProfile> {
  const res = await fetch(`${BASE}/${encodeURIComponent(dancerId)}`, {
    method: 'PUT',
    headers: danceAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify(extras),
  });
  const body = await readJson<{ success: boolean; data: DancerProfile }>(res);
  return body.data;
}

export async function deleteDancerProfile(dancerId: string): Promise<void> {
  const res = await fetch(`${BASE}/${encodeURIComponent(dancerId)}`, {
    method: 'DELETE',
    headers: danceAuthHeaders(),
    credentials: 'include',
  });
  if (!res.ok && res.status !== 404) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new Error(body.message || body.error || `HTTP ${res.status}`);
  }
}
