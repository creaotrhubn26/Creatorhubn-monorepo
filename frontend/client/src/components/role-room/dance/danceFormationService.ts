/**
 * Frontend client for /api/dance/formations.
 *
 * Backend-modellen er identisk med disse typene (samme felt-navn).
 */

import type { Formation, DancerPosition } from './formationTypes';

export interface FormationRecord {
  id: string;
  ownerUserId: string;
  projectId: string | null;
  label: string;
  notes: string | null;
  stageWidthM: number;
  stageDepthM: number;
  positions: DancerPosition[];
  transitionFromId: string | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface FormationInput {
  label: string;
  notes?: string | null;
  stageWidthM?: number;
  stageDepthM?: number;
  positions: DancerPosition[];
  transitionFromId?: string | null;
  displayOrder?: number;
  projectId?: string | null;
}

export type FormationPatch = Partial<FormationInput>;

const BASE = '/api/dance/formations';

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new Error(body.message || body.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function listFormations(projectId?: string): Promise<FormationRecord[]> {
  const url = typeof projectId === 'string' && projectId.length > 0
    ? `${BASE}?projectId=${encodeURIComponent(projectId)}`
    : BASE;
  const res = await fetch(url, { credentials: 'include' });
  const body = await readJson<{ success: boolean; data: FormationRecord[] }>(res);
  return body.data;
}

export async function createFormation(input: FormationInput): Promise<FormationRecord> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });
  const body = await readJson<{ success: boolean; data: FormationRecord }>(res);
  return body.data;
}

export async function patchFormation(id: string, patch: FormationPatch): Promise<FormationRecord> {
  const res = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(patch),
  });
  const body = await readJson<{ success: boolean; data: FormationRecord }>(res);
  return body.data;
}

export async function deleteFormation(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok && res.status !== 404) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new Error(body.message || body.error || `HTTP ${res.status}`);
  }
}

/**
 * Atomic replace-all for the (owner, project) scope. Backend insert/update
 * by id (or generates new ids), deletes any existing row not in the list.
 */
export async function replaceFormations(input: {
  projectId: string | null;
  formations: Array<{
    id?: string;
    label: string;
    notes?: string | null;
    stageWidthM?: number;
    stageDepthM?: number;
    positions: DancerPosition[];
    transitionFromId?: string | null;
    displayOrder?: number;
  }>;
}): Promise<FormationRecord[]> {
  const res = await fetch(BASE, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });
  const body = await readJson<{ success: boolean; data: FormationRecord[] }>(res);
  return body.data;
}

// ─── Adapters between FormationRecord and Formation (frontend type) ─────

export function recordToFormation(r: FormationRecord): Formation {
  return {
    id: r.id,
    name: r.label,
    notes: r.notes ?? undefined,
    positions: r.positions.map((p) => ({ ...p })),
    createdAt: r.createdAt,
  };
}

export interface FormationToInputOptions {
  stageWidthM?: number;
  stageDepthM?: number;
  transitionFromId?: string | null;
  displayOrder?: number;
}

export function formationToInput(
  f: Formation,
  options: FormationToInputOptions = {},
): FormationInput {
  return {
    label: f.name,
    notes: f.notes ?? null,
    positions: f.positions.map((p) => ({ ...p })),
    stageWidthM: options.stageWidthM,
    stageDepthM: options.stageDepthM,
    transitionFromId: options.transitionFromId ?? null,
    displayOrder: options.displayOrder ?? 0,
  };
}
