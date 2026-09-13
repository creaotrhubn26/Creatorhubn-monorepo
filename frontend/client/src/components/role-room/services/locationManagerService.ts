import type { LocationManagerOperations } from '../models/casting';
import { roleRoomAgentDefaultHeaders } from './roleRoomAgentService';

export interface LocationOperationsRecord {
  locationId: string;
  operations: LocationManagerOperations;
  version: number;
  updatedBy?: string;
  updatedAt?: string;
}

export interface LocationScoutMedia {
  id: string;
  projectId: string;
  locationId: string;
  uploadedBy: string;
  clientUploadId: string;
  kind: LocationScoutMediaKind;
  captureMetadata: LocationScoutMediaMetadata;
  displayName: string;
  contentType: string;
  sizeBytes: number;
  checksumSha256: string;
  createdAt: string;
  pendingUpload?: boolean;
}

export type LocationScoutMediaKind = 'photo' | 'video' | 'audio' | 'panorama';

export interface LocationScoutMediaMetadata {
  capturedAt?: string;
  coordinates?: { latitude: number; longitude: number; accuracyMeters?: number };
  bearingDegrees?: number;
  source: 'camera' | 'library' | 'recorder' | 'import';
  deviceLabel?: string;
  sceneIds: string[];
  checkId?: string;
  note?: string;
}

export interface LocationScoutMediaUpload {
  clientUploadId: string;
  kind: LocationScoutMediaKind;
  metadata: LocationScoutMediaMetadata;
}

export class LocationOperationsConflictError extends Error {
  readonly locationOperation?: LocationOperationsRecord;

  constructor(message: string, locationOperation?: LocationOperationsRecord) {
    super(message);
    this.name = 'LocationOperationsConflictError';
    this.locationOperation = locationOperation;
  }
}

export class LocationOperationsNetworkError extends Error {
  constructor(message = 'Ingen forbindelse til lokasjonstjenesten.') {
    super(message);
    this.name = 'LocationOperationsNetworkError';
  }
}

async function request(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    throw new LocationOperationsNetworkError();
  }
}

export const locationManagerService = {
  async list(projectId: string): Promise<LocationOperationsRecord[]> {
    const response = await request(
      `/api/role-room/projects/${encodeURIComponent(projectId)}/location-operations`,
      { credentials: 'include', headers: roleRoomAgentDefaultHeaders() },
    );
    const payload = await response.json().catch(() => ({})) as {
      error?: string;
      message?: string;
      locationOperations?: LocationOperationsRecord[];
    };
    if (!response.ok) {
      throw new Error(payload.message || payload.error || 'Kunne ikke hente lokasjonsberedskap.');
    }
    return Array.isArray(payload.locationOperations) ? payload.locationOperations : [];
  },

  async save(
    projectId: string,
    locationId: string,
    expectedVersion: number,
    operations: LocationManagerOperations,
  ): Promise<LocationOperationsRecord> {
    const response = await request(
      `/api/role-room/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(locationId)}/operations`,
      {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...roleRoomAgentDefaultHeaders() },
        body: JSON.stringify({ expectedVersion, operations }),
      },
    );
    const payload = await response.json().catch(() => ({})) as {
      error?: string;
      message?: string;
      locationOperation?: LocationOperationsRecord;
    };
    if (response.status === 409) {
      throw new LocationOperationsConflictError(
        payload.message || 'Lokasjonen er endret av en annen bruker.',
        payload.locationOperation,
      );
    }
    if (!response.ok || !payload.locationOperation) {
      throw new Error(payload.message || payload.error || 'Kunne ikke lagre lokasjonsberedskap.');
    }
    return payload.locationOperation;
  },

  async listMedia(projectId: string, locationId: string): Promise<LocationScoutMedia[]> {
    const response = await request(
      `/api/role-room/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(locationId)}/media`,
      { credentials: 'include', headers: roleRoomAgentDefaultHeaders() },
    );
    const payload = await response.json().catch(() => ({})) as { error?: string; message?: string; media?: LocationScoutMedia[] };
    if (!response.ok) throw new Error(payload.message || payload.error || 'Kunne ikke hente scout-filer.');
    return Array.isArray(payload.media) ? payload.media : [];
  },

  async uploadMedia(
    projectId: string,
    locationId: string,
    file: File | Blob,
    upload: LocationScoutMediaUpload,
    displayName = file instanceof File ? file.name : `scout-${upload.kind}`,
  ): Promise<LocationScoutMedia> {
    const form = new FormData();
    form.append('file', file, displayName);
    form.append('clientUploadId', upload.clientUploadId);
    form.append('kind', upload.kind);
    form.append('metadata', JSON.stringify(upload.metadata));
    const response = await request(
      `/api/role-room/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(locationId)}/media`,
      { method: 'POST', credentials: 'include', headers: roleRoomAgentDefaultHeaders(), body: form },
    );
    const payload = await response.json().catch(() => ({})) as { error?: string; message?: string; media?: LocationScoutMedia };
    if (!response.ok || !payload.media) throw new Error(payload.message || payload.error || 'Kunne ikke laste opp scout-filen.');
    return payload.media;
  },

  async uploadPhoto(projectId: string, locationId: string, file: File): Promise<LocationScoutMedia> {
    return this.uploadMedia(projectId, locationId, file, {
      clientUploadId: crypto.randomUUID(),
      kind: 'photo',
      metadata: { source: 'import', sceneIds: [] },
    });
  },

  async getMediaUrl(projectId: string, locationId: string, fileId: string): Promise<string> {
    const response = await request(
      `/api/role-room/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(locationId)}/media/${encodeURIComponent(fileId)}/url`,
      { credentials: 'include', headers: roleRoomAgentDefaultHeaders() },
    );
    const payload = await response.json().catch(() => ({})) as { error?: string; message?: string; url?: string };
    if (!response.ok || !payload.url) throw new Error(payload.message || payload.error || 'Kunne ikke åpne scout-filen.');
    return payload.url;
  },
};
