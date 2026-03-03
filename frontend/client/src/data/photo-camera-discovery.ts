/**
 * Photo Camera Discovery Service
 * Backend-driven discovery/sync with frontend cache as read model.
 */

import { getAuthHeader } from '../lib/queryClient';
import { PHOTO_CAMERA_DATABASE, PhotoCamera } from './photo-camera-database';

export interface CameraDataSource {
  name: string;
  url: string;
  enabled: boolean;
  lastChecked: string;
  checkInterval: number;
  priority: number;
}

export interface CameraDiscoveryResult {
  cameras: PhotoCamera[];
  source: string;
  timestamp: string;
  success: boolean;
  error?: string;
  inserted?: number;
  updated?: number;
  rejected?: number;
  conflicts?: number;
}

export interface CameraDiscoveryStatus {
  totalSources: number;
  enabledSources: number;
  lastUpdate: string;
  totalCameras: number;
  newCameras: number;
  recentlyUpdated: number;
  inserted: number;
  updated: number;
  rejected: number;
  conflicts: number;
  lastSyncId?: string;
}

interface DiscoverySyncResponse {
  success?: boolean;
  source?: string;
  timestamp?: string;
  syncId?: string;
  inserted?: number;
  updated?: number;
  rejected?: number;
  conflicts?: number;
}

const NEW_CAMERA_WINDOW_DAYS = 30;
const RECENT_UPDATE_WINDOW_DAYS = 7;

const toIso = (value: unknown): string => {
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
};

const normalizeId = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const normalizeCamera = (camera: PhotoCamera): PhotoCamera => {
  const nowIso = new Date().toISOString();
  const id = normalizeId(camera.id || `${camera.brand}-${camera.model}`);
  const externalId = normalizeId(camera.externalId || `${camera.brand}:${camera.model}`);

  return {
    ...camera,
    id,
    externalId,
    source: camera.source ?? 'seed',
    lastSeenAt: toIso(camera.lastSeenAt),
    addedDate: camera.addedDate ? toIso(camera.addedDate) : nowIso,
    lastUpdated: camera.lastUpdated ? toIso(camera.lastUpdated) : nowIso,
    version: camera.version ?? 1,
    isDeprecated: Boolean(camera.isDeprecated),
  };
};

const resolveCameraArray = (payload: unknown): PhotoCamera[] => {
  if (Array.isArray(payload)) return payload as PhotoCamera[];
  if (!payload || typeof payload !== 'object') return [];

  const record = payload as Record<string, unknown>;
  if (Array.isArray(record.cameras)) return record.cameras as PhotoCamera[];
  if (Array.isArray(record.results)) return record.results as PhotoCamera[];
  if (Array.isArray(record.data)) return record.data as PhotoCamera[];

  return [];
};

export class PhotoCameraDiscoveryService {
  private cache = new Map<string, PhotoCamera[]>();
  private updateCallbacks: Array<(cameras: PhotoCamera[]) => void> = [];
  private status: CameraDiscoveryStatus;

  constructor() {
    const seed = PHOTO_CAMERA_DATABASE.map(normalizeCamera);
    this.cache.set('all', seed);
    this.status = {
      totalSources: 0,
      enabledSources: 0,
      lastUpdate: '',
      totalCameras: seed.length,
      newCameras: this.countNew(seed),
      recentlyUpdated: this.countRecentlyUpdated(seed),
      inserted: 0,
      updated: 0,
      rejected: 0,
      conflicts: 0,
    };

    void this.refreshFromBackend();
  }

  private countNew(cameras: PhotoCamera[]): number {
    const threshold = Date.now() - NEW_CAMERA_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    return cameras.filter((camera) => {
      const date = new Date(camera.addedDate ?? camera.lastSeenAt).getTime();
      return Number.isFinite(date) && date >= threshold;
    }).length;
  }

  private countRecentlyUpdated(cameras: PhotoCamera[]): number {
    const threshold = Date.now() - RECENT_UPDATE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    return cameras.filter((camera) => {
      const date = new Date(camera.lastUpdated ?? camera.lastSeenAt).getTime();
      return Number.isFinite(date) && date >= threshold;
    }).length;
  }

  private async fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const authHeaders = await getAuthHeader();
    const response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      throw new Error(`${response.status}: ${await response.text()}`);
    }

    return (await response.json()) as T;
  }

  private mergeCameras(cameras: PhotoCamera[]): { inserted: PhotoCamera[]; updated: PhotoCamera[] } {
    const current = this.cache.get('all') ?? [];
    const byId = new Map(current.map((camera) => [camera.id, camera]));
    const byExternalId = new Map(current.map((camera) => [camera.externalId, camera.id]));

    const inserted: PhotoCamera[] = [];
    const updated: PhotoCamera[] = [];

    cameras.map(normalizeCamera).forEach((incoming) => {
      const existingId = byId.has(incoming.id)
        ? incoming.id
        : byExternalId.get(incoming.externalId);

      if (!existingId) {
        byId.set(incoming.id, incoming);
        byExternalId.set(incoming.externalId, incoming.id);
        inserted.push(incoming);
        return;
      }

      const previous = byId.get(existingId);
      if (!previous) return;

      const merged: PhotoCamera = {
        ...previous,
        ...incoming,
        id: previous.id,
        externalId: previous.externalId || incoming.externalId,
        version: Math.max(previous.version ?? 1, incoming.version ?? 1),
      };

      byId.set(existingId, merged);
      if (JSON.stringify(previous) !== JSON.stringify(merged)) {
        updated.push(merged);
      }
    });

    const mergedList = Array.from(byId.values()).sort((a, b) =>
      `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`, 'nb')
    );

    this.cache.set('all', mergedList);
    this.status.totalCameras = mergedList.length;
    this.status.newCameras = this.countNew(mergedList);
    this.status.recentlyUpdated = this.countRecentlyUpdated(mergedList);

    return { inserted, updated };
  }

  private emitUpdate(cameras: PhotoCamera[]) {
    if (!cameras.length) return;
    this.updateCallbacks.forEach((callback) => {
      try {
        callback(cameras);
      } catch {
        // No-op; callbacks are isolated.
      }
    });
  }

  async refreshFromBackend(): Promise<void> {
    try {
      const payload = await this.fetchJson<unknown>('/api/equipment/cameras?type=photo');
      const cameras = resolveCameraArray(payload);
      const mergeResult = this.mergeCameras(cameras);
      this.emitUpdate([...mergeResult.inserted, ...mergeResult.updated]);
    } catch {
      // Keep seed fallback silently when endpoint is unavailable.
    }
  }

  async checkForUpdates(): Promise<CameraDiscoveryResult[]> {
    return this.triggerDiscovery();
  }

  async triggerDiscovery(): Promise<CameraDiscoveryResult[]> {
    try {
      const sync = await this.fetchJson<DiscoverySyncResponse>('/api/equipment/discovery/sync?type=photo', {
        method: 'POST',
      });

      await this.refreshFromBackend();

      this.status.lastUpdate = toIso(sync.timestamp);
      this.status.inserted = Number(sync.inserted ?? 0);
      this.status.updated = Number(sync.updated ?? 0);
      this.status.rejected = Number(sync.rejected ?? 0);
      this.status.conflicts = Number(sync.conflicts ?? 0);
      this.status.lastSyncId = sync.syncId;

      const all = this.getCamerasByStatus('all');
      return [
        {
          cameras: all,
          source: sync.source ?? 'backend-photo-sync',
          timestamp: this.status.lastUpdate,
          success: true,
          inserted: this.status.inserted,
          updated: this.status.updated,
          rejected: this.status.rejected,
          conflicts: this.status.conflicts,
        },
      ];
    } catch (error) {
      return [
        {
          cameras: [],
          source: 'backend-photo-sync',
          timestamp: new Date().toISOString(),
          success: false,
          error: error instanceof Error ? error.message : 'Unknown discovery error',
          inserted: 0,
          updated: 0,
          rejected: 0,
          conflicts: 0,
        },
      ];
    }
  }

  getCamerasWithIndicators(): PhotoCamera[] {
    const all = (this.cache.get('all') ?? []).map((camera) => normalizeCamera(camera));
    const now = Date.now();
    const newThreshold = now - NEW_CAMERA_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const recentThreshold = now - RECENT_UPDATE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

    return all.map((camera) => {
      const addedDate = new Date(camera.addedDate ?? camera.lastSeenAt).getTime();
      const updatedDate = new Date(camera.lastUpdated ?? camera.lastSeenAt).getTime();

      return {
        ...camera,
        isNew: Number.isFinite(addedDate) ? addedDate >= newThreshold : false,
        isRecentlyUpdated: Number.isFinite(updatedDate) ? updatedDate >= recentThreshold : false,
      };
    });
  }

  getCamerasByStatus(status: 'new' | 'recently-updated' | 'all'): PhotoCamera[] {
    const cameras = this.getCamerasWithIndicators();
    if (status === 'new') return cameras.filter((camera) => camera.isNew);
    if (status === 'recently-updated') return cameras.filter((camera) => camera.isRecentlyUpdated);
    return cameras;
  }

  onCameraUpdate(callback: (cameras: PhotoCamera[]) => void) {
    this.updateCallbacks.push(callback);
  }

  offCameraUpdate(callback: (cameras: PhotoCamera[]) => void) {
    this.updateCallbacks = this.updateCallbacks.filter((entry) => entry !== callback);
  }

  getDiscoveryStatus(): CameraDiscoveryStatus {
    return { ...this.status };
  }
}

export const photoCameraDiscovery = new PhotoCameraDiscoveryService();
