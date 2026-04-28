/**
 * storyboardApiService.ts — frontend client for /api/role-room/projects/:projectId/storyboards.
 * Persisterer PencilCanvas-strokes til DB. Brukes av StoryboardIntegrationView /
 * FrameDrawingEditor.
 */

const BASE = '/api/role-room';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('role_room_auth_token')
    || sessionStorage.getItem('role_room_auth_token')
    || localStorage.getItem('authToken')
    || '';
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
    throw new Error(body.detail || body.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface Storyboard {
  id: string;
  projectId: string;
  sceneId: string | null;
  frameId: string | null;
  title: string | null;
  strokes: unknown[];
  imageData: string | null;
  width: number | null;
  height: number | null;
  workflowLevel: string | null;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoryboardUpsertInput {
  sceneId?: string | null;
  frameId?: string | null;
  title?: string | null;
  strokes?: unknown[];
  imageData?: string | null;
  width?: number | null;
  height?: number | null;
  workflowLevel?: string | null;
  metadata?: Record<string, unknown>;
}

export async function listStoryboards(
  projectId: string,
  sceneId?: string,
): Promise<Storyboard[]> {
  const url = sceneId
    ? `${BASE}/projects/${encodeURIComponent(projectId)}/storyboards?sceneId=${encodeURIComponent(sceneId)}`
    : `${BASE}/projects/${encodeURIComponent(projectId)}/storyboards`;
  const res = await fetch(url, { headers: authHeaders() });
  const w = await readJson<{ success: boolean; data: Storyboard[] }>(res);
  return w.data;
}

export async function getStoryboard(
  projectId: string,
  id: string,
): Promise<Storyboard> {
  const res = await fetch(
    `${BASE}/projects/${encodeURIComponent(projectId)}/storyboards/${encodeURIComponent(id)}`,
    { headers: authHeaders() },
  );
  const w = await readJson<{ success: boolean; data: Storyboard }>(res);
  return w.data;
}

/**
 * Upsert: hvis frameId allerede finnes for prosjektet, oppdater. Ellers opprett.
 * Brukes av PencilCanvas-onSave-callback.
 */
export async function upsertStoryboard(
  projectId: string,
  input: StoryboardUpsertInput,
): Promise<Storyboard> {
  const res = await fetch(
    `${BASE}/projects/${encodeURIComponent(projectId)}/storyboards`,
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(input),
    },
  );
  const w = await readJson<{ success: boolean; data: Storyboard }>(res);
  return w.data;
}

export async function updateStoryboard(
  projectId: string,
  id: string,
  patch: StoryboardUpsertInput,
): Promise<Storyboard> {
  const res = await fetch(
    `${BASE}/projects/${encodeURIComponent(projectId)}/storyboards/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(patch),
    },
  );
  const w = await readJson<{ success: boolean; data: Storyboard }>(res);
  return w.data;
}

export async function deleteStoryboard(
  projectId: string,
  id: string,
): Promise<void> {
  const res = await fetch(
    `${BASE}/projects/${encodeURIComponent(projectId)}/storyboards/${encodeURIComponent(id)}`,
    { method: 'DELETE', headers: authHeaders() },
  );
  await readJson<{ success: boolean }>(res);
}
