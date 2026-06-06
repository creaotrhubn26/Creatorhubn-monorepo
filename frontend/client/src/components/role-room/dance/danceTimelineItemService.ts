/**
 * Frontend client for /api/dance/formation-timeline-items.
 *
 * Workflow-audit G18: time-anchored notes + movements på koreografi-
 * timeline. Backend-modellen er identisk med disse typene (samme felt-navn,
 * snake_case mappet til camelCase i service-laget).
 */
import { danceAuthHeaders } from './danceAuthHeaders';

export type TimelineItemKind = 'note' | 'movement';

export interface TimelineItemRecord {
  id: string;
  ownerUserId: string;
  projectId: string | null;
  kind: TimelineItemKind;
  label: string;
  startSec: number;
  endSec: number;
  formationId: string | null;
  targetDancerIds: string[];
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface TimelineItemInput {
  kind: TimelineItemKind;
  label: string;
  startSec: number;
  endSec: number;
  projectId?: string | null;
  formationId?: string | null;
  targetDancerIds?: string[];
  displayOrder?: number;
}

export type TimelineItemPatch = Partial<TimelineItemInput>;

const BASE = '/api/dance/formation-timeline-items';

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new Error(body.message || body.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface ListTimelineItemsQuery {
  projectId?: string;
  kind?: TimelineItemKind;
  limit?: number;
}

export async function listTimelineItems(
  query: ListTimelineItemsQuery = {},
): Promise<TimelineItemRecord[]> {
  const params = new URLSearchParams();
  if (query.projectId) params.set('projectId', query.projectId);
  if (query.kind) params.set('kind', query.kind);
  if (typeof query.limit === 'number') params.set('limit', String(query.limit));
  const qs = params.toString();
  const res = await fetch(qs ? `${BASE}?${qs}` : BASE, {
    headers: danceAuthHeaders(),
    credentials: 'include',
  });
  const body = await readJson<{ success: boolean; data: TimelineItemRecord[] }>(res);
  return body.data;
}

export async function createTimelineItem(
  input: TimelineItemInput,
): Promise<TimelineItemRecord> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: danceAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify(input),
  });
  const body = await readJson<{ success: boolean; data: TimelineItemRecord }>(res);
  return body.data;
}

export async function patchTimelineItem(
  id: string,
  patch: TimelineItemPatch,
): Promise<TimelineItemRecord> {
  const res = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: danceAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify(patch),
  });
  const body = await readJson<{ success: boolean; data: TimelineItemRecord }>(res);
  return body.data;
}

export async function deleteTimelineItem(id: string): Promise<void> {
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
