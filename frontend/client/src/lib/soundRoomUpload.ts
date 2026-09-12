import { apiRequest } from './queryClient';
import { IncrementalSha256 } from './incrementalSha256';

type UploadPart = { partNumber: number; etag: string; checksumSha256: string };
type UploadTicket = {
  objectId: string;
  strategy: 'single' | 'multipart' | 'complete';
  uploadUrl?: string;
  requiredHeaders?: Record<string, string>;
  partSize?: number;
  partCount?: number;
  alreadyUploaded?: boolean;
};

async function fileSha256(file: Blob, onProgress: (fraction: number) => void): Promise<string> {
  const hasher = new IncrementalSha256(); const chunkSize = 4 * 1024 * 1024;
  for (let offset = 0; offset < file.size; offset += chunkSize) {
    hasher.update(new Uint8Array(await file.slice(offset, Math.min(file.size, offset + chunkSize)).arrayBuffer()));
    onProgress(Math.min(1, (offset + chunkSize) / file.size));
  }
  return hasher.digestHex();
}

async function blobSha256(blob: Blob): Promise<string> {
  return fileSha256(blob, () => undefined);
}

function putBlob(url: string, body: Blob, headers: Record<string, string>, onProgress: (loaded: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest(); request.open('PUT', url);
    Object.entries(headers).forEach(([name, value]) => request.setRequestHeader(name, value));
    request.upload.onprogress = (event) => onProgress(event.loaded);
    request.onerror = () => reject(new Error('network_upload_failed'));
    request.onload = () => request.status >= 200 && request.status < 300
      ? resolve(request.getResponseHeader('ETag') || '')
      : reject(new Error(`upload_failed_${request.status}`));
    request.send(body);
  });
}

function uploadStateKey(projectId: string, file: File): string {
  return `creatorhub:sound-upload:${projectId}:${file.name}:${file.size}:${file.lastModified}`;
}

export async function uploadSoundRoomFile(input: {
  projectId: string;
  file: File;
  onProgress?: (percent: number) => void;
}): Promise<any> {
  const { projectId, file } = input; const report = input.onProgress || (() => undefined);
  const stateKey = uploadStateKey(projectId, file);
  let saved: { objectId: string; checksumSha256: string } | null = null;
  try { saved = JSON.parse(localStorage.getItem(stateKey) || 'null'); } catch { saved = null; }
  const checksumSha256 = saved?.checksumSha256 || await fileSha256(file, (part) => report(Math.round(part * 10)));
  let ticket: UploadTicket;
  if (saved?.objectId) {
    try {
      const status = await apiRequest(`/api/audio-storage/${saved.objectId}/status`);
      ticket = status.status === 'active'
        ? { objectId: saved.objectId, strategy: 'complete', alreadyUploaded: true }
        : await apiRequest(`/api/audio-storage/${saved.objectId}/resume`, { method: 'POST', body: {} });
    } catch {
      localStorage.removeItem(stateKey); saved = null;
      ticket = await apiRequest(`/api/audio-showcases/${projectId}/storage/initiate`, { method: 'POST', body: { fileName: file.name, sizeBytes: file.size, contentType: file.type || 'application/octet-stream', checksumSha256 } });
    }
  } else {
    ticket = await apiRequest(`/api/audio-showcases/${projectId}/storage/initiate`, { method: 'POST', body: { fileName: file.name, sizeBytes: file.size, contentType: file.type || 'application/octet-stream', checksumSha256 } });
  }
  localStorage.setItem(stateKey, JSON.stringify({ objectId: ticket.objectId, checksumSha256 }));
  const completed = new Map<number, UploadPart>();
  if (ticket.strategy === 'multipart') {
    const status = await apiRequest(`/api/audio-storage/${ticket.objectId}/status`);
    for (const part of status.uploadedParts || []) {
      if (part.checksumSha256 && part.etag) completed.set(Number(part.partNumber), part);
    }
    const partSize = Number(ticket.partSize); const partCount = Number(ticket.partCount);
    for (let partNumber = 1; partNumber <= partCount; partNumber += 1) {
      if (completed.has(partNumber)) continue;
      const start = (partNumber - 1) * partSize; const blob = file.slice(start, Math.min(file.size, start + partSize));
      const partChecksum = await blobSha256(blob);
      const signed = await apiRequest(`/api/audio-storage/${ticket.objectId}/parts`, { method: 'POST', body: { parts: [{ partNumber, checksumSha256: partChecksum }] } });
      const partTicket = signed.parts?.[0]; if (!partTicket?.uploadUrl) throw new Error('part_ticket_missing');
      const etag = await putBlob(partTicket.uploadUrl, blob, partTicket.requiredHeaders || {}, (loaded) => {
        report(Math.round(10 + (((start + loaded) / file.size) * 85)));
      });
      if (!etag) throw new Error('part_etag_missing');
      completed.set(partNumber, { partNumber, etag, checksumSha256: partChecksum });
    }
  } else if (ticket.strategy === 'single') {
    if (!ticket.uploadUrl) throw new Error('upload_url_missing');
    await putBlob(ticket.uploadUrl, file, ticket.requiredHeaders || {}, (loaded) => report(Math.round(10 + ((loaded / file.size) * 85))));
  }
  const result = await apiRequest(`/api/audio-storage/${ticket.objectId}/complete`, {
    method: 'POST', body: { parts: Array.from(completed.values()) },
  });
  localStorage.removeItem(stateKey); report(100);
  return result.version;
}
