/**
 * takesClient.ts
 *
 * Frontend-klient for casting_takes — upload-flow + CRUD. Bruker
 * eksisterende apiRequest-helper.
 *
 * Arkitekturreferanse:
 *   backend/server/coverage-take-routes.ts
 *
 * Upload-flow (3 steg):
 *   1. POST /takes/upload-url  → få signed PUT-URL + takeId
 *   2. PUT direkte til R2 med blob/file
 *   3. POST /takes/:id/confirm → marker som ferdig, queue analyse
 */

import { apiRequest } from './castingApiService';

export type ProcessingStatus =
  | 'pending'
  | 'queued'
  | 'processing'
  | 'analyzed'
  | 'failed';

export interface CastingTake {
  id: string;
  projectId: string;
  sceneId: string | null;
  shotListId: string | null;
  shotIndex: number | null;
  takeNumber: number;
  mediaKey: string;
  mediaUrl: string | null;
  mediaType: 'video' | 'audio';
  mimeType: string | null;
  sizeBytes: number | null;
  durationSec: number | null;
  capturedAt: string | null;
  uploadedBy: string | null;
  notes: string | null;
  markedCircled: boolean;
  processingStatus: ProcessingStatus;
  createdAt: string;
  updatedAt: string;
  /** Signed read URL inkludert i GET-/takes/:id-respons */
  playbackUrl?: string;
}

export interface CreateUploadUrlRequest {
  projectId: string;
  sceneId?: string;
  shotListId?: string;
  shotIndex?: number;
  takeNumber?: number;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  mediaType?: 'video' | 'audio';
  notes?: string;
  markedCircled?: boolean;
}

export interface CreateUploadUrlResponse {
  takeId: string;
  uploadUrl: string;
  finalUrl: string;
  expiresInSeconds: number;
  configured: boolean;
}

// ─────────────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────────────

export function createTakeUploadUrl(
  req: CreateUploadUrlRequest,
): Promise<CreateUploadUrlResponse> {
  return apiRequest<CreateUploadUrlResponse>('/takes/upload-url', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export function confirmTakeUpload(
  takeId: string,
  opts: { durationSec?: number; capturedAt?: string } = {},
): Promise<CastingTake> {
  return apiRequest<CastingTake>(`/takes/${encodeURIComponent(takeId)}/confirm`, {
    method: 'POST',
    body: JSON.stringify(opts),
  });
}

export function getTake(takeId: string): Promise<CastingTake> {
  return apiRequest<CastingTake>(`/takes/${encodeURIComponent(takeId)}`);
}

export function listTakesForProject(projectId: string): Promise<CastingTake[]> {
  return apiRequest<CastingTake[]>(
    `/projects/${encodeURIComponent(projectId)}/takes`,
  );
}

export function listTakesForScene(sceneId: string): Promise<CastingTake[]> {
  return apiRequest<CastingTake[]>(
    `/scenes/${encodeURIComponent(sceneId)}/takes`,
  );
}

export function listTakesForShot(
  shotListId: string,
  shotIndex: number,
): Promise<CastingTake[]> {
  return apiRequest<CastingTake[]>(
    `/shots/${encodeURIComponent(shotListId)}/${shotIndex}/takes`,
  );
}

export function updateTake(
  takeId: string,
  patch: Partial<{
    shotListId: string | null;
    shotIndex: number | null;
    takeNumber: number;
    notes: string | null;
    markedCircled: boolean;
  }>,
): Promise<CastingTake> {
  return apiRequest<CastingTake>(`/takes/${encodeURIComponent(takeId)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export function deleteTake(takeId: string): Promise<void> {
  return apiRequest<void>(`/takes/${encodeURIComponent(takeId)}`, {
    method: 'DELETE',
  });
}

// ─────────────────────────────────────────────────────────────────────
// High-level upload-helper
// ─────────────────────────────────────────────────────────────────────

export interface UploadTakeOptions {
  projectId: string;
  sceneId?: string;
  shotListId?: string;
  shotIndex?: number;
  takeNumber?: number;
  file: File;
  notes?: string;
  markedCircled?: boolean;
  onProgress?: (loaded: number, total: number) => void;
  signal?: AbortSignal;
}

/**
 * Komplett upload-flyt i én funksjon:
 *   1. Hent signed URL fra backend
 *   2. PUT fil til R2 med XHR (for progress-events)
 *   3. Bekreft upload + køé analyse
 *
 * Returnerer ferdig CastingTake-objekt.
 */
export async function uploadTake(opts: UploadTakeOptions): Promise<CastingTake> {
  const urlResponse = await createTakeUploadUrl({
    projectId: opts.projectId,
    sceneId: opts.sceneId,
    shotListId: opts.shotListId,
    shotIndex: opts.shotIndex,
    takeNumber: opts.takeNumber,
    filename: opts.file.name,
    mimeType: opts.file.type || 'application/octet-stream',
    sizeBytes: opts.file.size,
    mediaType: opts.file.type.startsWith('audio/') ? 'audio' : 'video',
    notes: opts.notes,
    markedCircled: opts.markedCircled,
  });

  if (!urlResponse.configured) {
    // R2 ikke konfigurert i miljøet — ingen vits å forsøke PUT
    throw new Error('R2-storage er ikke konfigurert på backend');
  }

  // PUT med XHR for progress-events
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', urlResponse.uploadUrl);
    xhr.setRequestHeader('Content-Type', opts.file.type || 'application/octet-stream');

    if (opts.onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) opts.onProgress!(e.loaded, e.total);
      });
    }

    if (opts.signal) {
      opts.signal.addEventListener('abort', () => xhr.abort());
    }

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`R2 PUT failed (${xhr.status}): ${xhr.responseText.slice(0, 200)}`));
      }
    });
    xhr.addEventListener('error', () => reject(new Error('R2 PUT network error')));
    xhr.addEventListener('abort', () => reject(new Error('R2 PUT aborted')));

    xhr.send(opts.file);
  });

  return confirmTakeUpload(urlResponse.takeId);
}
