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
  displayName: string;
  contentType: string;
  sizeBytes: number;
  checksumSha256: string;
  createdAt: string;
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
    if (!response.ok) throw new Error(payload.message || payload.error || 'Kunne ikke hente scout-bilder.');
    return Array.isArray(payload.media) ? payload.media : [];
  },

  async uploadPhoto(projectId: string, locationId: string, file: File): Promise<LocationScoutMedia> {
    const form = new FormData();
    form.append('file', file, file.name);
    const response = await request(
      `/api/role-room/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(locationId)}/media`,
      { method: 'POST', credentials: 'include', headers: roleRoomAgentDefaultHeaders(), body: form },
    );
    const payload = await response.json().catch(() => ({})) as { error?: string; message?: string; media?: LocationScoutMedia };
    if (!response.ok || !payload.media) throw new Error(payload.message || payload.error || 'Kunne ikke laste opp scout-bildet.');
    return payload.media;
  },

  async getMediaUrl(projectId: string, locationId: string, fileId: string): Promise<string> {
    const response = await request(
      `/api/role-room/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(locationId)}/media/${encodeURIComponent(fileId)}/url`,
      { credentials: 'include', headers: roleRoomAgentDefaultHeaders() },
    );
    const payload = await response.json().catch(() => ({})) as { error?: string; message?: string; url?: string };
    if (!response.ok || !payload.url) throw new Error(payload.message || payload.error || 'Kunne ikke åpne scout-bildet.');
    return payload.url;
  },
};
