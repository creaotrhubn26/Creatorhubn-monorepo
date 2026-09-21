import { IncrementalSha256 } from "../../../lib/incrementalSha256";
import type {
  ProductionDay,
  ProductionSoundMedia,
  ProductionSoundOperations,
} from "../models/casting";
import { roleRoomAgentDefaultHeaders } from "./roleRoomAgentService";

type SoundSavePayload = {
  error?: string;
  message?: string;
  productionDay?: ProductionDay;
};

type SoundUploadPart = {
  partNumber: number;
  etag: string;
  checksumSha256: string;
};
type SoundUploadTicket = {
  objectId: string;
  strategy: "single" | "multipart";
  uploadUrl?: string;
  requiredHeaders?: Record<string, string>;
  partSize?: number;
  partCount?: number;
};

export class ProductionSoundConflictError extends Error {
  readonly productionDay: ProductionDay;

  constructor(message: string, productionDay: ProductionDay) {
    super(message);
    this.name = "ProductionSoundConflictError";
    this.productionDay = productionDay;
  }
}

async function readPayload(response: Response): Promise<SoundSavePayload> {
  return response.json().catch(() => ({}));
}

async function jsonRequest<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...roleRoomAgentDefaultHeaders(),
      ...(init.headers ?? {}),
    },
  });
  const payload = (await response.json().catch(() => ({}))) as T & {
    error?: string;
    message?: string;
  };
  if (!response.ok)
    throw new Error(
      payload.message || payload.error || "Lydfilhandlingen mislyktes.",
    );
  return payload;
}

async function blobSha256(
  blob: Blob,
  onProgress?: (fraction: number) => void,
): Promise<string> {
  const hasher = new IncrementalSha256();
  const chunkSize = 4 * 1024 * 1024;
  for (let offset = 0; offset < blob.size; offset += chunkSize) {
    const end = Math.min(blob.size, offset + chunkSize);
    const chunk = blob.slice(offset, end);
    const bytes =
      typeof chunk.arrayBuffer === "function"
        ? await chunk.arrayBuffer()
        : await new Promise<ArrayBuffer>((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () =>
              reject(reader.error ?? new Error("Kunne ikke lese lydfilen."));
            reader.onload = () => resolve(reader.result as ArrayBuffer);
            reader.readAsArrayBuffer(chunk);
          });
    hasher.update(new Uint8Array(bytes));
    onProgress?.(end / blob.size);
  }
  return hasher.digestHex();
}

function putBlob(
  url: string,
  body: Blob,
  headers: Record<string, string>,
  onProgress?: (loaded: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    Object.entries(headers).forEach(([name, value]) =>
      request.setRequestHeader(name, value),
    );
    request.upload.onprogress = (event) => onProgress?.(event.loaded);
    request.onerror = () =>
      reject(new Error("Nettverksfeil under direkte S3-opplasting."));
    request.onload = () =>
      request.status >= 200 && request.status < 300
        ? resolve(request.getResponseHeader("ETag") || "")
        : reject(
            new Error(`S3-opplastingen feilet med HTTP ${request.status}.`),
          );
    request.send(body);
  });
}

function mediaBase(projectId: string, dayId: string): string {
  return `/api/role-room/projects/${encodeURIComponent(projectId)}/production-days/${encodeURIComponent(dayId)}/production-sound/media`;
}

function uploadStateKey(projectId: string, dayId: string, file: File): string {
  return `role-room:production-sound-upload:${projectId}:${dayId}:${file.name}:${file.size}:${file.lastModified}`;
}

export const productionSoundService = {
  async save(
    projectId: string,
    dayId: string,
    expectedVersion: number,
    operations: ProductionSoundOperations,
  ): Promise<ProductionDay> {
    const response = await fetch(
      `/api/role-room/projects/${encodeURIComponent(projectId)}/production-days/${encodeURIComponent(dayId)}/production-sound`,
      {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...roleRoomAgentDefaultHeaders(),
        },
        body: JSON.stringify({ expectedVersion, operations }),
      },
    );
    const payload = await readPayload(response);
    if (
      (response.status === 409 || response.status === 412) &&
      payload.productionDay
    ) {
      throw new ProductionSoundConflictError(
        payload.message ||
          "Lydrapporten eller take-grunnlaget er endret av en annen bruker.",
        payload.productionDay,
      );
    }
    if (!response.ok || !payload.productionDay) {
      throw new Error(
        payload.message || payload.error || "Kunne ikke lagre lydrapporten.",
      );
    }
    return payload.productionDay;
  },

  async listMedia(
    projectId: string,
    dayId: string,
  ): Promise<ProductionSoundMedia[]> {
    const payload = await jsonRequest<{ media: ProductionSoundMedia[] }>(
      mediaBase(projectId, dayId),
    );
    return Array.isArray(payload.media) ? payload.media : [];
  },

  async uploadRecorderFile(
    projectId: string,
    dayId: string,
    file: File,
    onProgress?: (percent: number) => void,
  ): Promise<ProductionSoundMedia> {
    const base = mediaBase(projectId, dayId);
    const stateKey = uploadStateKey(projectId, dayId, file);
    let saved: { objectId: string; checksumSha256: string } | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(stateKey) || "null");
    } catch {
      saved = null;
    }
    const checksumSha256 = await blobSha256(file, (fraction) =>
      onProgress?.(Math.round(fraction * 10)),
    );
    if (saved && saved.checksumSha256 !== checksumSha256) {
      localStorage.removeItem(stateKey);
      saved = null;
    }
    let ticket: SoundUploadTicket;
    if (saved?.objectId) {
      try {
        const status = await jsonRequest<{ status: string }>(
          `${base}/${encodeURIComponent(saved.objectId)}/status`,
        );
        if (status.status === "active") {
          const completed = await jsonRequest<{ media: ProductionSoundMedia }>(
            `${base}/${encodeURIComponent(saved.objectId)}/complete`,
            { method: "POST", body: JSON.stringify({ parts: [] }) },
          );
          localStorage.removeItem(stateKey);
          onProgress?.(100);
          return completed.media;
        }
        ticket = (
          await jsonRequest<{ upload: SoundUploadTicket }>(
            `${base}/${encodeURIComponent(saved.objectId)}/resume`,
            { method: "POST", body: JSON.stringify({}) },
          )
        ).upload;
      } catch {
        localStorage.removeItem(stateKey);
        saved = null;
        ticket = (
          await jsonRequest<{ upload: SoundUploadTicket }>(`${base}/initiate`, {
            method: "POST",
            body: JSON.stringify({
              fileName: file.name,
              sizeBytes: file.size,
              contentType: file.type || "application/octet-stream",
              checksumSha256,
            }),
          })
        ).upload;
      }
    } else {
      ticket = (
        await jsonRequest<{ upload: SoundUploadTicket }>(`${base}/initiate`, {
          method: "POST",
          body: JSON.stringify({
            fileName: file.name,
            sizeBytes: file.size,
            contentType: file.type || "application/octet-stream",
            checksumSha256,
          }),
        })
      ).upload;
    }
    localStorage.setItem(
      stateKey,
      JSON.stringify({ objectId: ticket.objectId, checksumSha256 }),
    );
    const completedParts = new Map<number, SoundUploadPart>();
    if (ticket.strategy === "multipart") {
      const status = await jsonRequest<{ uploadedParts?: SoundUploadPart[] }>(
        `${base}/${encodeURIComponent(ticket.objectId)}/status`,
      );
      for (const part of status.uploadedParts ?? []) {
        if (part.etag && part.checksumSha256)
          completedParts.set(Number(part.partNumber), part);
      }
      const partSize = Number(ticket.partSize);
      const partCount = Number(ticket.partCount);
      if (
        !Number.isSafeInteger(partSize) ||
        partSize < 1 ||
        !Number.isSafeInteger(partCount) ||
        partCount < 1
      ) {
        throw new Error("Serveren returnerte en ugyldig multipart-kontrakt.");
      }
      for (let partNumber = 1; partNumber <= partCount; partNumber += 1) {
        if (completedParts.has(partNumber)) continue;
        const start = (partNumber - 1) * partSize;
        const part = file.slice(start, Math.min(file.size, start + partSize));
        const partChecksum = await blobSha256(part);
        const signed = await jsonRequest<{
          parts: Array<{
            partNumber: number;
            uploadUrl: string;
            requiredHeaders: Record<string, string>;
          }>;
        }>(`${base}/${encodeURIComponent(ticket.objectId)}/parts`, {
          method: "POST",
          body: JSON.stringify({
            parts: [{ partNumber, checksumSha256: partChecksum }],
          }),
        });
        const partTicket = signed.parts?.[0];
        if (!partTicket?.uploadUrl)
          throw new Error("Serveren returnerte ingen URL for multipart-delen.");
        const etag = await putBlob(
          partTicket.uploadUrl,
          part,
          partTicket.requiredHeaders ?? {},
          (loaded) => {
            onProgress?.(Math.round(10 + ((start + loaded) / file.size) * 85));
          },
        );
        if (!etag)
          throw new Error("S3 returnerte ingen ETag for multipart-delen.");
        completedParts.set(partNumber, {
          partNumber,
          etag,
          checksumSha256: partChecksum,
        });
      }
    } else {
      if (!ticket.uploadUrl)
        throw new Error("Serveren returnerte ingen S3-opplastingsadresse.");
      await putBlob(
        ticket.uploadUrl,
        file,
        ticket.requiredHeaders ?? {},
        (loaded) => {
          onProgress?.(Math.round(10 + (loaded / file.size) * 85));
        },
      );
    }
    const completed = await jsonRequest<{ media: ProductionSoundMedia }>(
      `${base}/${encodeURIComponent(ticket.objectId)}/complete`,
      {
        method: "POST",
        body: JSON.stringify({ parts: [...completedParts.values()] }),
      },
    );
    localStorage.removeItem(stateKey);
    onProgress?.(100);
    return completed.media;
  },

  async reconcileMedia(
    projectId: string,
    dayId: string,
    mediaId: string,
    expectedVersion: number,
    continuityTakeId: string | null,
  ): Promise<{ productionDay: ProductionDay; media: ProductionSoundMedia }> {
    const response = await fetch(
      `${mediaBase(projectId, dayId)}/${encodeURIComponent(mediaId)}/reconcile`,
      {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...roleRoomAgentDefaultHeaders(),
        },
        body: JSON.stringify({ expectedVersion, continuityTakeId }),
      },
    );
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
      productionDay?: ProductionDay;
      media?: ProductionSoundMedia;
    };
    if (
      (response.status === 409 || response.status === 412) &&
      payload.productionDay
    ) {
      throw new ProductionSoundConflictError(
        payload.message || "Take-grunnlaget eller lydrapporten er endret.",
        payload.productionDay,
      );
    }
    if (!response.ok || !payload.productionDay || !payload.media) {
      throw new Error(
        payload.message ||
          payload.error ||
          "Kunne ikke avstemme recorderfilen.",
      );
    }
    return { productionDay: payload.productionDay, media: payload.media };
  },

  async getMediaUrl(
    projectId: string,
    dayId: string,
    mediaId: string,
  ): Promise<string> {
    const payload = await jsonRequest<{ url: string }>(
      `${mediaBase(projectId, dayId)}/${encodeURIComponent(mediaId)}/url`,
    );
    if (!payload.url)
      throw new Error("Serveren returnerte ingen nedlastingsadresse.");
    return payload.url;
  },
};
