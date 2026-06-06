/**
 * Frontend client for /api/dance/annotation-categories + labels.
 *
 * Backend: dance-annotation-catalog-service.ts. Auto-seeder 5 defaults
 * (steps/arms/body/jumps/turns) ved første access så listAnnotationCategories
 * alltid returnerer minst 5 records etter første call.
 */
import { danceAuthHeaders } from './danceAuthHeaders';

export interface AnnotationCategoryRecord {
  id: string;
  ownerUserId: string;
  projectId: string | null;
  name: string;
  color: string;
  shortcut: string | null;
  sortOrder: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AnnotationCategoryInput {
  name: string;
  color: string;
  shortcut?: string | null;
  sortOrder?: number;
  projectId?: string | null;
}

export type AnnotationCategoryPatch = Partial<AnnotationCategoryInput>;

export interface AnnotationLabelRecord {
  id: string;
  ownerUserId: string;
  projectId: string | null;
  categoryId: string | null;
  name: string;
  sortOrder: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AnnotationLabelInput {
  name: string;
  categoryId?: string | null;
  sortOrder?: number;
  projectId?: string | null;
}

export type AnnotationLabelPatch = Partial<AnnotationLabelInput>;

const CAT_BASE = '/api/dance/annotation-categories';
const LBL_BASE = '/api/dance/annotation-labels';

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new Error(body.message || body.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Categories ─────────────────────────────────────────────────────────

export async function listAnnotationCategories(
  projectId?: string,
): Promise<AnnotationCategoryRecord[]> {
  const url = typeof projectId === 'string' && projectId.length > 0
    ? `${CAT_BASE}?projectId=${encodeURIComponent(projectId)}`
    : CAT_BASE;
  const res = await fetch(url, { headers: danceAuthHeaders(), credentials: 'include' });
  const body = await readJson<{ success: boolean; data: AnnotationCategoryRecord[] }>(res);
  return body.data;
}

export async function createAnnotationCategory(
  input: AnnotationCategoryInput,
): Promise<AnnotationCategoryRecord> {
  const res = await fetch(CAT_BASE, {
    method: 'POST',
    headers: danceAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify(input),
  });
  const body = await readJson<{ success: boolean; data: AnnotationCategoryRecord }>(res);
  return body.data;
}

export async function patchAnnotationCategory(
  id: string,
  patch: AnnotationCategoryPatch,
): Promise<AnnotationCategoryRecord> {
  const res = await fetch(`${CAT_BASE}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: danceAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify(patch),
  });
  const body = await readJson<{ success: boolean; data: AnnotationCategoryRecord }>(res);
  return body.data;
}

/** Returnerer false hvis backend svarte 409 (default protected). */
export async function deleteAnnotationCategory(id: string): Promise<boolean> {
  const res = await fetch(`${CAT_BASE}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: danceAuthHeaders(),
    credentials: 'include',
  });
  if (res.status === 409) return false;
  if (!res.ok && res.status !== 404) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new Error(body.message || body.error || `HTTP ${res.status}`);
  }
  return res.ok;
}

// ─── Labels ─────────────────────────────────────────────────────────────

export interface ListLabelsQuery {
  projectId?: string;
  categoryId?: string;
}

export async function listAnnotationLabels(
  query: ListLabelsQuery = {},
): Promise<AnnotationLabelRecord[]> {
  const params = new URLSearchParams();
  if (query.projectId) params.set('projectId', query.projectId);
  if (query.categoryId) params.set('categoryId', query.categoryId);
  const qs = params.toString();
  const res = await fetch(qs ? `${LBL_BASE}?${qs}` : LBL_BASE, {
    headers: danceAuthHeaders(),
    credentials: 'include',
  });
  const body = await readJson<{ success: boolean; data: AnnotationLabelRecord[] }>(res);
  return body.data;
}

export async function createAnnotationLabel(
  input: AnnotationLabelInput,
): Promise<AnnotationLabelRecord> {
  const res = await fetch(LBL_BASE, {
    method: 'POST',
    headers: danceAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify(input),
  });
  const body = await readJson<{ success: boolean; data: AnnotationLabelRecord }>(res);
  return body.data;
}

export async function patchAnnotationLabel(
  id: string,
  patch: AnnotationLabelPatch,
): Promise<AnnotationLabelRecord> {
  const res = await fetch(`${LBL_BASE}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: danceAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify(patch),
  });
  const body = await readJson<{ success: boolean; data: AnnotationLabelRecord }>(res);
  return body.data;
}

export async function deleteAnnotationLabel(id: string): Promise<void> {
  const res = await fetch(`${LBL_BASE}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: danceAuthHeaders(),
    credentials: 'include',
  });
  if (!res.ok && res.status !== 404) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new Error(body.message || body.error || `HTTP ${res.status}`);
  }
}
