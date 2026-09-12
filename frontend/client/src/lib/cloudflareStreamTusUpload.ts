import { apiRequest } from './queryClient';

type SavedTusUpload = {
  uploadUrl: string;
  versionId: string;
  versionNumber: number;
  uid: string;
  chunkSize: number;
  expiresAt: string;
};

function stateKey(projectId: string, file: File): string {
  return `creatorhub:stream-tus:${projectId}:${file.name}:${file.size}:${file.lastModified}`;
}

function headOffset(uploadUrl: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest(); request.open('HEAD', uploadUrl);
    request.setRequestHeader('Tus-Resumable', '1.0.0');
    request.onload = () => request.status >= 200 && request.status < 300
      ? resolve(Number(request.getResponseHeader('Upload-Offset') || 0))
      : reject(new Error(`tus_head_${request.status}`));
    request.onerror = () => reject(new Error('tus_head_network'));
    request.send();
  });
}

function patchChunk(uploadUrl: string, blob: Blob, offset: number, onProgress: (loaded: number) => void): Promise<number> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest(); request.open('PATCH', uploadUrl);
    request.setRequestHeader('Tus-Resumable', '1.0.0');
    request.setRequestHeader('Upload-Offset', String(offset));
    request.setRequestHeader('Content-Type', 'application/offset+octet-stream');
    request.upload.onprogress = (event) => onProgress(event.loaded);
    request.onload = () => request.status >= 200 && request.status < 300
      ? resolve(Number(request.getResponseHeader('Upload-Offset') || offset + blob.size))
      : reject(new Error(`tus_patch_${request.status}`));
    request.onerror = () => reject(new Error('tus_patch_network'));
    request.send(blob);
  });
}

export async function uploadVideoToCloudflareStream(input: {
  projectId: string;
  file: File;
  versionLabel?: string;
  onProgress?: (percent: number) => void;
}): Promise<{ versionId: string; versionNumber: number }> {
  const { projectId, file } = input; const key = stateKey(projectId, file);
  let saved: SavedTusUpload | null = null;
  try { saved = JSON.parse(localStorage.getItem(key) || 'null'); } catch { saved = null; }
  if (saved && Date.parse(saved.expiresAt) <= Date.now()) {
    const expiredVersionId = saved.versionId;
    localStorage.removeItem(key); saved = null;
    await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/video-versions/${encodeURIComponent(expiredVersionId)}`, { method: 'DELETE' }).catch(() => undefined);
  }
  const provision = async (): Promise<SavedTusUpload> => {
    const ticket = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/video-versions/tus`, {
      method: 'POST',
      body: {
        fileName: file.name,
        sizeBytes: file.size,
        contentType: file.type || 'video/mp4',
        versionLabel: input.versionLabel || undefined,
      },
    });
    localStorage.setItem(key, JSON.stringify(ticket));
    return ticket;
  };
  if (!saved) saved = await provision();
  let offset: number;
  try {
    offset = await headOffset(saved.uploadUrl);
  } catch {
    // A one-time URL may have expired while the browser was closed. Remove
    // only this exact file's checkpoint and provision a new Stream object.
    const expiredVersionId = saved.versionId;
    localStorage.removeItem(key);
    await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/video-versions/${encodeURIComponent(expiredVersionId)}`, { method: 'DELETE' }).catch(() => undefined);
    saved = await provision();
    offset = await headOffset(saved.uploadUrl);
  }
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > file.size) throw new Error('tus_invalid_offset');
  while (offset < file.size) {
    const end = Math.min(file.size, offset + saved.chunkSize);
    const start = offset;
    try {
      offset = await patchChunk(saved.uploadUrl, file.slice(start, end), start, (loaded) => {
        input.onProgress?.(Math.min(99, Math.round(((start + loaded) / file.size) * 100)));
      });
    } catch (error) {
      // Resolve a lost response / 409 offset conflict from Stream without
      // re-uploading bytes that the server has already committed.
      const recoveredOffset = await headOffset(saved.uploadUrl).catch(() => -1);
      if (recoveredOffset < start || recoveredOffset > end) throw error;
      offset = recoveredOffset;
    }
    localStorage.setItem(key, JSON.stringify(saved));
  }
  localStorage.removeItem(key); input.onProgress?.(100);
  await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/video-versions/${saved.versionId}/stream-status`).catch(() => undefined);
  return { versionId: saved.versionId, versionNumber: saved.versionNumber };
}
