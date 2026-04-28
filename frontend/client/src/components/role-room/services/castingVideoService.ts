/**
 * castingVideoService.ts — frontend client for /api/role-room/casting-videos.
 * Upload-flyt: POST /upload-url → klient PUT'er filen direkte til R2 →
 * POST /videos/:id/confirm bekrefter med duration + thumbnail.
 */

const BASE = '/api/role-room/casting-videos';

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

export interface CastingVideo {
  id: string;
  candidateId: string;
  projectId: string;
  title: string | null;
  videoUrl: string;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  fileSizeBytes: number | null;
  mimeType: string | null;
  rating: number | null;
  status: 'pending' | 'ready' | 'failed';
  uploadedBy: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface VideoAnnotation {
  id: string;
  videoId: string;
  timestampSeconds: number;
  comment: string;
  authorUserId: string | null;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UploadUrlResult {
  videoId: string;
  uploadUrl: string;
  videoUrl: string;
  expiresInSeconds: number;
  configured: boolean;
}

export async function listVideosForCandidate(candidateId: string): Promise<CastingVideo[]> {
  const res = await fetch(`${BASE}/candidates/${encodeURIComponent(candidateId)}/videos`, { headers: authHeaders() });
  const w = await readJson<{ success: boolean; data: CastingVideo[] }>(res);
  return w.data;
}

export async function listVideosForProject(projectId: string): Promise<CastingVideo[]> {
  const res = await fetch(`${BASE}/projects/${encodeURIComponent(projectId)}/videos`, { headers: authHeaders() });
  const w = await readJson<{ success: boolean; data: CastingVideo[] }>(res);
  return w.data;
}

export async function requestUploadUrl(input: {
  candidateId: string;
  projectId: string;
  filename: string;
  mimeType: string;
  fileSizeBytes: number;
}): Promise<UploadUrlResult> {
  const res = await fetch(`${BASE}/upload-url`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  const w = await readJson<{ success: boolean; data: UploadUrlResult }>(res);
  return w.data;
}

export async function confirmUpload(
  videoId: string,
  patch: { durationSeconds?: number | null; thumbnailUrl?: string | null } = {},
): Promise<CastingVideo> {
  const res = await fetch(`${BASE}/videos/${encodeURIComponent(videoId)}/confirm`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(patch),
  });
  const w = await readJson<{ success: boolean; data: CastingVideo }>(res);
  return w.data;
}

export async function updateVideo(
  videoId: string,
  patch: { rating?: number | null; notes?: string | null; title?: string | null },
): Promise<CastingVideo> {
  const res = await fetch(`${BASE}/videos/${encodeURIComponent(videoId)}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(patch),
  });
  const w = await readJson<{ success: boolean; data: CastingVideo }>(res);
  return w.data;
}

export async function deleteVideo(videoId: string): Promise<void> {
  const res = await fetch(`${BASE}/videos/${encodeURIComponent(videoId)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  await readJson<{ success: boolean }>(res);
}

// ─── Annotations ──────────────────────────────────────────────────────

export async function listAnnotations(videoId: string): Promise<VideoAnnotation[]> {
  const res = await fetch(`${BASE}/videos/${encodeURIComponent(videoId)}/annotations`, { headers: authHeaders() });
  const w = await readJson<{ success: boolean; data: VideoAnnotation[] }>(res);
  return w.data;
}

export async function createAnnotation(
  videoId: string,
  input: { timestampSeconds: number; comment: string },
): Promise<VideoAnnotation> {
  const res = await fetch(`${BASE}/videos/${encodeURIComponent(videoId)}/annotations`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  const w = await readJson<{ success: boolean; data: VideoAnnotation }>(res);
  return w.data;
}

export async function deleteAnnotation(annotationId: string): Promise<void> {
  const res = await fetch(`${BASE}/annotations/${encodeURIComponent(annotationId)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  await readJson<{ success: boolean }>(res);
}

// ─── Helper: upload file via presigned URL + confirm ──────────────────

/**
 * Komplett upload-flyt: ber backend om PUT-URL, laster opp filen direkte
 * til R2, og bekrefter raden. Returnerer ferdig CastingVideo-record.
 */
export async function uploadVideoFile(input: {
  candidateId: string;
  projectId: string;
  file: File;
  onProgress?: (percent: number) => void;
}): Promise<CastingVideo> {
  const upload = await requestUploadUrl({
    candidateId: input.candidateId,
    projectId: input.projectId,
    filename: input.file.name,
    mimeType: input.file.type || 'video/mp4',
    fileSizeBytes: input.file.size,
  });

  if (!upload.configured) {
    throw new Error('Video-upload er ikke konfigurert i prod (R2 env-vars mangler). Sett CLOUDFLARE_R2_* i Render.');
  }

  // Direct PUT til R2 — bruker XHR for progress-event-støtte
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', upload.uploadUrl);
    xhr.setRequestHeader('Content-Type', input.file.type || 'video/mp4');
    if (input.onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          input.onProgress!(Math.round((e.loaded / e.total) * 100));
        }
      };
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload feilet: HTTP ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('Upload-nettverksfeil'));
    xhr.send(input.file);
  });

  // Probe duration + thumbnail (kan utvides — skip for MVP)
  const duration = await probeVideoDuration(input.file).catch(() => null);

  return confirmUpload(upload.videoId, { durationSeconds: duration });
}

async function probeVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(v.duration) ? v.duration : null);
    };
    v.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    v.src = url;
  });
}
