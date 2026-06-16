/**
 * Frontend client for /api/dance/injuries.
 *
 * Backend-modellen er identisk med disse typene (samme felt-navn, samme
 * enum-verdier).
 */

import { danceAuthHeaders } from './danceAuthHeaders';

export type InjuryEntryStatus = 'active' | 'healing' | 'resolved';
export type InjurySide = 'left' | 'right' | 'both';
export type InjuryTrigger =
  | 'rehearsal' | 'performance' | 'audition' | 'training' | 'other';
// Rehab-steg (migrasjon 0152): Akutt → Behandling → Opptrening → Retur.
export type InjuryStage = 'acute' | 'treatment' | 'retraining' | 'return';
export const INJURY_STAGES = ['acute', 'treatment', 'retraining', 'return'] as const;

export const INJURY_BODY_PARTS = [
  'ankle', 'knee', 'hip', 'lower_back', 'shoulder',
  'wrist', 'foot', 'neck', 'other',
] as const;
export type InjuryBodyPart = typeof INJURY_BODY_PARTS[number];

export interface InjuryLogEntry {
  id: string;
  ownerUserId: string;
  dancerId: string;
  entryDate: string;
  bodyPart: InjuryBodyPart;
  side: InjurySide | null;
  severity: number;
  note: string | null;
  status: InjuryEntryStatus;
  expectedReturnDate: string | null;
  resolvedDate: string | null;
  triggeredBy: InjuryTrigger | null;
  projectId: string | null;
  stage: InjuryStage | null;
  progressPercent: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface InjuryLogEntryInput {
  dancerId: string;
  entryDate: string;
  bodyPart: InjuryBodyPart;
  side?: InjurySide | null;
  severity: number;
  note?: string | null;
  status?: InjuryEntryStatus;
  expectedReturnDate?: string | null;
  resolvedDate?: string | null;
  triggeredBy?: InjuryTrigger | null;
  projectId?: string | null;
  stage?: InjuryStage | null;
  progressPercent?: number | null;
}

export type InjuryLogEntryPatch = Partial<Omit<InjuryLogEntryInput, 'dancerId'>>;

const BASE = '/api/dance/injuries';

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new Error(body.message || body.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface ListInjuriesQuery {
  projectId?: string;
  dancerId?: string;
  status?: InjuryEntryStatus;
  limit?: number;
}

export async function listInjuries(query: ListInjuriesQuery = {}): Promise<InjuryLogEntry[]> {
  const params = new URLSearchParams();
  if (query.projectId) params.set('projectId', query.projectId);
  if (query.dancerId) params.set('dancerId', query.dancerId);
  if (query.status) params.set('status', query.status);
  if (typeof query.limit === 'number') params.set('limit', String(query.limit));
  const qs = params.toString();
  const res = await fetch(qs ? `${BASE}?${qs}` : BASE, { headers: danceAuthHeaders(), credentials: 'include' });
  const body = await readJson<{ success: boolean; data: InjuryLogEntry[] }>(res);
  return body.data;
}

export async function createInjury(input: InjuryLogEntryInput): Promise<InjuryLogEntry> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: danceAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify(input),
  });
  const body = await readJson<{ success: boolean; data: InjuryLogEntry }>(res);
  return body.data;
}

export async function patchInjury(id: string, patch: InjuryLogEntryPatch): Promise<InjuryLogEntry> {
  const res = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: danceAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify(patch),
  });
  const body = await readJson<{ success: boolean; data: InjuryLogEntry }>(res);
  return body.data;
}

export async function deleteInjury(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: danceAuthHeaders(),
    credentials: 'include',
  });
  if (!res.ok && res.status !== 404) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new Error(body.message || body.error || `HTTP ${res.status}`);
  }
}
