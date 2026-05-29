/**
 * Frontend client for /api/dance/rehearsals.
 *
 * Backend-modellen er identisk med disse typene. Slice 7 nøkkelpoeng:
 * når en `segmentReviews`-entry endres til `outcome: 'approved'` via
 * patchRehearsal, bumpes også segmentets approval automatisk på
 * server-siden — frontend trenger bare en re-fetch av choreography for
 * å se endringen.
 */

import type { Rehearsal, RehearsalSegmentReview } from './rehearsalTypes';
import { danceAuthHeaders } from './danceAuthHeaders';

export type RehearsalStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';

export interface RehearsalRecord {
  id: string;
  ownerUserId: string;
  choreographyId: string;
  projectId: string | null;
  title: string;
  scheduledAt: string;
  estimatedMinutes: number;
  location: string | null;
  invitedDancerIds: string[];
  status: RehearsalStatus;
  focusAreas: Rehearsal['focusAreas'];
  videoReviewPlanned: boolean;
  preNotes: string | null;
  segmentReviews: RehearsalSegmentReview[];
  dancerFollowUps: Rehearsal['dancerFollowUps'];
  postNotes: string | null;
  recordingUrl: string | null;
  choreographyChangelog: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RehearsalInput {
  choreographyId: string;
  title: string;
  scheduledAt: string;
  estimatedMinutes?: number;
  location?: string | null;
  invitedDancerIds?: string[];
  status?: RehearsalStatus;
  focusAreas?: Rehearsal['focusAreas'];
  videoReviewPlanned?: boolean;
  preNotes?: string | null;
  segmentReviews?: RehearsalSegmentReview[];
  dancerFollowUps?: Rehearsal['dancerFollowUps'];
  postNotes?: string | null;
  recordingUrl?: string | null;
  choreographyChangelog?: string | null;
  projectId?: string | null;
}

export type RehearsalPatch = Partial<Omit<RehearsalInput, 'choreographyId'>>;

const BASE = '/api/dance/rehearsals';

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new Error(body.message || body.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface ListRehearsalsQuery {
  choreographyId?: string;
  projectId?: string;
  status?: RehearsalStatus;
  limit?: number;
}

export async function listRehearsals(query: ListRehearsalsQuery = {}): Promise<RehearsalRecord[]> {
  const params = new URLSearchParams();
  if (query.choreographyId) params.set('choreographyId', query.choreographyId);
  if (query.projectId) params.set('projectId', query.projectId);
  if (query.status) params.set('status', query.status);
  if (typeof query.limit === 'number') params.set('limit', String(query.limit));
  const qs = params.toString();
  const res = await fetch(qs ? `${BASE}?${qs}` : BASE, { headers: danceAuthHeaders(), credentials: 'include' });
  const body = await readJson<{ success: boolean; data: RehearsalRecord[] }>(res);
  return body.data;
}

export async function getRehearsal(id: string): Promise<RehearsalRecord | null> {
  const res = await fetch(`${BASE}/${encodeURIComponent(id)}`, { headers: danceAuthHeaders(), credentials: 'include' });
  if (res.status === 404) return null;
  const body = await readJson<{ success: boolean; data: RehearsalRecord }>(res);
  return body.data;
}

export async function createRehearsal(input: RehearsalInput): Promise<RehearsalRecord> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: danceAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify(input),
  });
  const body = await readJson<{ success: boolean; data: RehearsalRecord }>(res);
  return body.data;
}

export async function patchRehearsal(id: string, patch: RehearsalPatch): Promise<RehearsalRecord> {
  const res = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: danceAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify(patch),
  });
  const body = await readJson<{ success: boolean; data: RehearsalRecord }>(res);
  return body.data;
}

export async function deleteRehearsal(id: string): Promise<void> {
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

// ─── Adapters ───────────────────────────────────────────────────────────

export function recordToRehearsal(r: RehearsalRecord): Rehearsal {
  return {
    id: r.id,
    choreographyId: r.choreographyId,
    title: r.title,
    scheduledAt: r.scheduledAt,
    estimatedMinutes: r.estimatedMinutes,
    location: r.location ?? undefined,
    invitedDancerIds: r.invitedDancerIds,
    status: r.status,
    focusAreas: r.focusAreas,
    videoReviewPlanned: r.videoReviewPlanned,
    preNotes: r.preNotes ?? undefined,
    segmentReviews: r.segmentReviews,
    dancerFollowUps: r.dancerFollowUps,
    postNotes: r.postNotes ?? undefined,
    recordingUrl: r.recordingUrl ?? undefined,
    choreographyChangelog: r.choreographyChangelog ?? undefined,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export function rehearsalToPatch(r: Rehearsal): RehearsalPatch {
  return {
    title: r.title,
    scheduledAt: r.scheduledAt,
    estimatedMinutes: r.estimatedMinutes,
    location: r.location ?? null,
    invitedDancerIds: r.invitedDancerIds,
    status: r.status,
    focusAreas: r.focusAreas,
    videoReviewPlanned: r.videoReviewPlanned ?? false,
    preNotes: r.preNotes ?? null,
    segmentReviews: r.segmentReviews,
    dancerFollowUps: r.dancerFollowUps,
    postNotes: r.postNotes ?? null,
    recordingUrl: r.recordingUrl ?? null,
    choreographyChangelog: r.choreographyChangelog ?? null,
  };
}
