/**
 * Frontend client for /api/dance/video-clips and /api/dance/video-annotations.
 */

export type VideoClipKind = 'rehearsal' | 'reference' | 'performance';
export type AnnotationStatus = 'open' | 'resolved';

export interface VideoClip {
  id: string;
  ownerUserId: string;
  projectId: string | null;
  choreographyId: string | null;
  segmentId: string | null;
  kind: VideoClipKind;
  title: string;
  storageKey: string;
  signedUrl: string | null;
  durationSec: number | null;
  mime: string;
  sourceUserId: string;
  capturedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VideoAnnotation {
  id: string;
  ownerUserId: string;
  clipId: string;
  parentId: string | null;
  authorUserId: string;
  body: string;
  timestampSec: number;
  endSec: number | null;
  countNumber: number | null;
  segmentId: string | null;
  targetDancerIds: string[];
  isDirectorPin: boolean;
  status: AnnotationStatus;
  drawing: unknown | null;
  voiceNoteSignedUrl: string | null;
  drawingKeyframes: unknown | null;
  createdAt: string;
  updatedAt: string;
}

const BASE = '/api/dance';

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new Error(body.message || body.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Clips ──────────────────────────────────────────────────────────────

export interface UploadClipInput {
  file: File;
  title?: string;
  kind?: VideoClipKind;
  choreographyId?: string | null;
  segmentId?: string | null;
  projectId?: string | null;
  durationSec?: number | null;
  onProgress?: (loaded: number, total: number) => void;
}

export async function uploadClip(input: UploadClipInput): Promise<VideoClip> {
  const form = new FormData();
  form.append('file', input.file, input.file.name);
  if (input.title) form.append('title', input.title);
  if (input.kind) form.append('kind', input.kind);
  if (input.choreographyId) form.append('choreographyId', input.choreographyId);
  if (input.segmentId) form.append('segmentId', input.segmentId);
  if (input.projectId) form.append('projectId', input.projectId);
  if (typeof input.durationSec === 'number') {
    form.append('durationSec', String(input.durationSec));
  }

  // Use XHR for progress events. fetch's request bodies don't yet expose them.
  return new Promise<VideoClip>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE}/video-clips`, true);
    xhr.withCredentials = true;
    if (input.onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) input.onProgress!(e.loaded, e.total);
      };
    }
    xhr.onload = () => {
      try {
        const body = JSON.parse(xhr.responseText || '{}');
        if (xhr.status >= 200 && xhr.status < 300 && body.success) {
          resolve(body.data as VideoClip);
        } else {
          reject(new Error(body.error || body.message || `HTTP ${xhr.status}`));
        }
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    };
    xhr.onerror = () => reject(new Error('Nettverksfeil ved opplasting'));
    xhr.send(form);
  });
}

export interface ListClipsQuery {
  choreographyId?: string;
  projectId?: string;
  kind?: VideoClipKind;
  limit?: number;
}

export async function listClips(query: ListClipsQuery = {}): Promise<VideoClip[]> {
  const params = new URLSearchParams();
  if (query.choreographyId) params.set('choreographyId', query.choreographyId);
  if (query.projectId) params.set('projectId', query.projectId);
  if (query.kind) params.set('kind', query.kind);
  if (typeof query.limit === 'number') params.set('limit', String(query.limit));
  const qs = params.toString();
  const res = await fetch(qs ? `${BASE}/video-clips?${qs}` : `${BASE}/video-clips`, {
    credentials: 'include',
  });
  const body = await readJson<{ success: boolean; data: VideoClip[] }>(res);
  return body.data;
}

export async function getClip(id: string): Promise<VideoClip | null> {
  const res = await fetch(`${BASE}/video-clips/${encodeURIComponent(id)}`, {
    credentials: 'include',
  });
  if (res.status === 404) return null;
  const body = await readJson<{ success: boolean; data: VideoClip }>(res);
  return body.data;
}

export async function patchClip(
  id: string,
  patch: { title?: string; kind?: VideoClipKind; segmentId?: string | null; capturedAt?: string | null; durationSec?: number | null },
): Promise<VideoClip> {
  const res = await fetch(`${BASE}/video-clips/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(patch),
  });
  const body = await readJson<{ success: boolean; data: VideoClip }>(res);
  return body.data;
}

export async function deleteClip(id: string): Promise<void> {
  const res = await fetch(`${BASE}/video-clips/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok && res.status !== 404) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `HTTP ${res.status}`);
  }
}

// ─── Annotations ────────────────────────────────────────────────────────

export async function listAnnotations(clipId: string): Promise<VideoAnnotation[]> {
  const res = await fetch(`${BASE}/video-clips/${encodeURIComponent(clipId)}/annotations`, {
    credentials: 'include',
  });
  const body = await readJson<{ success: boolean; data: VideoAnnotation[] }>(res);
  return body.data;
}

export interface CreateAnnotationInput {
  parentId?: string | null;
  body: string;
  timestampSec: number;
  endSec?: number | null;
  countNumber?: number | null;
  segmentId?: string | null;
  targetDancerIds?: string[];
  isDirectorPin?: boolean;
  drawing?: unknown;
  drawingKeyframes?: unknown;
}

export async function createAnnotation(
  clipId: string,
  input: CreateAnnotationInput,
): Promise<VideoAnnotation> {
  const res = await fetch(`${BASE}/video-clips/${encodeURIComponent(clipId)}/annotations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });
  const body = await readJson<{ success: boolean; data: VideoAnnotation }>(res);
  return body.data;
}

export interface PatchAnnotationInput {
  body?: string;
  status?: AnnotationStatus;
  isDirectorPin?: boolean;
  targetDancerIds?: string[];
  drawing?: unknown;
  drawingKeyframes?: unknown;
}

export async function patchAnnotation(
  id: string,
  patch: PatchAnnotationInput,
): Promise<VideoAnnotation> {
  const res = await fetch(`${BASE}/video-annotations/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(patch),
  });
  const body = await readJson<{ success: boolean; data: VideoAnnotation }>(res);
  return body.data;
}

export async function deleteAnnotation(id: string): Promise<void> {
  const res = await fetch(`${BASE}/video-annotations/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok && res.status !== 404) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `HTTP ${res.status}`);
  }
}

// ─── Voice note (V3) ────────────────────────────────────────────────────

export async function uploadVoiceNote(
  clipId: string,
  blob: Blob,
  filename = 'voice.webm',
): Promise<{ storageKey: string; signedUrl: string }> {
  const form = new FormData();
  form.append('file', blob, filename);
  const res = await fetch(`${BASE}/video-clips/${encodeURIComponent(clipId)}/voice-note`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  });
  const body = await readJson<{ success: boolean; data: { storageKey: string; signedUrl: string } }>(res);
  return body.data;
}

// ─── SSE (V4) — bridges EventSource into a typed callback ───────────────

export type ClipEventKind = 'annotation:created' | 'annotation:updated' | 'annotation:deleted';
export interface ClipEventPayload {
  kind: ClipEventKind;
  annotationId: string;
  clipId: string;
  ownerUserId: string;
}

export function subscribeToClipEvents(
  clipId: string,
  onEvent: (event: ClipEventPayload) => void,
  onError?: (err: Event) => void,
): () => void {
  const url = `${BASE}/video-clips/${encodeURIComponent(clipId)}/events`;
  const source = new EventSource(url, { withCredentials: true });
  const wrap = (kind: ClipEventKind) => (e: MessageEvent) => {
    try {
      const payload = JSON.parse(e.data) as ClipEventPayload;
      onEvent({ ...payload, kind });
    } catch {
      /* ignore malformed */
    }
  };
  source.addEventListener('annotation:created', wrap('annotation:created'));
  source.addEventListener('annotation:updated', wrap('annotation:updated'));
  source.addEventListener('annotation:deleted', wrap('annotation:deleted'));
  if (onError) source.onerror = onError;
  return () => source.close();
}
