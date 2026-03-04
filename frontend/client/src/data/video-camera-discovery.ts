/**
 * Video Camera Discovery Service
 * Backend-driven discovery/sync with retry/backoff and typed status.
 */

import { getAuthHeader } from '../lib/queryClient';
import type { Camera} from './video-camera-database';
import { VIDEO_CAMERA_DATABASE } from './video-camera-database';

export interface VideoCameraDataSource {
  name: string;
  url: string;
  enabled: boolean;
  lastChecked: string;
  checkInterval: number;
  priority: number;
}

export interface VideoCameraDiscoveryResult {
  cameras: Camera[];
  source: string;
  timestamp: string;
  success: boolean;
  error?: string;
  inserted?: number;
  updated?: number;
  rejected?: number;
  conflicts?: number;
}

export interface VideoCameraDiscoveryStatus {
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
  logFormats: string[];
  brands: string[];
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

const uniq = (values: string[]): string[] =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

const normalizeCamera = (camera: Camera): Camera => {
  const nowIso = new Date().toISOString();
  return {
    ...camera,
    id: normalizeId(camera.id || `${camera.brand}-${camera.model}`),
    externalId: normalizeId(camera.externalId || `${camera.brand}:${camera.model}`),
    type: 'video',
    source: camera.source ?? 'seed',
    lastSeenAt: toIso(camera.lastSeenAt),
    logFormats: uniq(camera.logFormats),
    resolution: uniq(camera.resolution),
    frameRates: uniq(camera.frameRates),
    colorSpace: uniq(camera.colorSpace),
    videoResolution: camera.videoResolution ? uniq(camera.videoResolution) : undefined,
    videoFrameRates: camera.videoFrameRates ? uniq(camera.videoFrameRates) : undefined,
    videoCodecs: camera.videoCodecs ? uniq(camera.videoCodecs) : undefined,
    addedDate: camera.addedDate ? toIso(camera.addedDate) : nowIso,
    lastUpdated: camera.lastUpdated ? toIso(camera.lastUpdated) : nowIso,
    version: camera.version ?? 1,
    isDeprecated: Boolean(camera.isDeprecated),
  };
};

const resolveCameraArray = (payload: unknown): Camera[] => {
  if (Array.isArray(payload)) return payload as Camera[];
  if (!payload || typeof payload !== 'object') return [];

  const record = payload as Record<string, unknown>;
  if (Array.isArray(record.cameras)) return record.cameras as Camera[];
  if (Array.isArray(record.results)) return record.results as Camera[];
  if (Array.isArray(record.data)) return record.data as Camera[];
  return [];
};

const computeAvailableLogFormats = (cameras: Camera[]): string[] => {
  return Array.from(new Set(cameras.flatMap((camera) => camera.logFormats))).sort((a, b) =>
    a.localeCompare(b, 'nb'),
  );
};

const computeAvailableBrands = (cameras: Camera[]): string[] => {
  return Array.from(new Set(cameras.map((camera) => camera.brand))).sort((a, b) =>
    a.localeCompare(b, 'nb'),
  );
};

export class VideoCameraDiscoveryService {
  private cache = new Map<string, Camera[]>();
  private updateCallbacks: Array<(cameras: Camera[]) => void> = [];
  private status: VideoCameraDiscoveryStatus;

  constructor() {
    const seed = VIDEO_CAMERA_DATABASE.map(normalizeCamera);
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
      logFormats: computeAvailableLogFormats(seed),
      brands: computeAvailableBrands(seed),
    };

    void this.refreshFromBackend();
  }

  private countNew(cameras: Camera[]): number {
    const threshold = Date.now() - NEW_CAMERA_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    return cameras.filter((camera) => {
      const date = new Date(camera.addedDate ?? camera.lastSeenAt).getTime();
      return Number.isFinite(date) && date >= threshold;
    }).length;
  }

  private countRecentlyUpdated(cameras: Camera[]): number {
    const threshold = Date.now() - RECENT_UPDATE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    return cameras.filter((camera) => {
      const date = new Date(camera.lastUpdated ?? camera.lastSeenAt).getTime();
      return Number.isFinite(date) && date >= threshold;
    }).length;
  }

  private async fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const headers = await getAuthHeader();
    const response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      throw new Error(`${response.status}: ${await response.text()}`);
    }

    return (await response.json()) as T;
  }

  private async fetchJsonWithRetry<T>(
    url: string,
    init: RequestInit | undefined,
    retries = 3,
    initialDelayMs = 250
  ): Promise<T> {
    let attempt = 0;
    let delay = initialDelayMs;
    let lastError: unknown;

    while (attempt < retries) {
      try {
        return await this.fetchJson<T>(url, init);
      } catch (error) {
        lastError = error;
        attempt += 1;
        if (attempt >= retries) break;

        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Request failed');
  }

  private mergeCameras(cameras: Camera[]): { inserted: Camera[]; updated: Camera[] } {
    const current = this.cache.get('all') ?? [];
    const byId = new Map(current.map((camera) => [camera.id, camera]));
    const byExternal = new Map(current.map((camera) => [camera.externalId, camera.id]));

    const inserted: Camera[] = [];
    const updated: Camera[] = [];

    cameras.map(normalizeCamera).forEach((incoming) => {
      const existingId = byId.has(incoming.id) ? incoming.id : byExternal.get(incoming.externalId);

      if (!existingId) {
        byId.set(incoming.id, incoming);
        byExternal.set(incoming.externalId, incoming.id);
        inserted.push(incoming);
        return;
      }

      const previous = byId.get(existingId);
      if (!previous) return;

      const merged: Camera = {
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
    this.status.logFormats = computeAvailableLogFormats(mergedList);
    this.status.brands = computeAvailableBrands(mergedList);

    return { inserted, updated };
  }

  private emitUpdate(cameras: Camera[]) {
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
      const payload = await this.fetchJsonWithRetry<unknown>('/api/equipment/cameras?type=video', undefined, 2);
      const cameras = resolveCameraArray(payload);
      const mergeResult = this.mergeCameras(cameras);
      this.emitUpdate([...mergeResult.inserted, ...mergeResult.updated]);
    } catch {
      // Keep seed fallback silently.
    }
  }

  async checkForUpdates(): Promise<VideoCameraDiscoveryResult[]> {
    return this.triggerDiscovery();
  }

  async triggerDiscovery(): Promise<VideoCameraDiscoveryResult[]> {
    try {
      const sync = await this.fetchJsonWithRetry<DiscoverySyncResponse>(
        '/api/equipment/discovery/sync?type=video',
        { method: 'POST' },
        3,
        300
      );

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
          source: sync.source ?? 'backend-video-sync',
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
          source: 'backend-video-sync',
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

  getCamerasWithIndicators(): Camera[] {
    const all = (this.cache.get('all') ?? []).map((camera) => normalizeCamera(camera));
    const now = Date.now();
    const newThreshold = now - NEW_CAMERA_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const recentThreshold = now - RECENT_UPDATE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

    return all.map((camera) => {
      const added = new Date(camera.addedDate ?? camera.lastSeenAt).getTime();
      const updated = new Date(camera.lastUpdated ?? camera.lastSeenAt).getTime();

      return {
        ...camera,
        isNew: Number.isFinite(added) ? added >= newThreshold : false,
        isRecentlyUpdated: Number.isFinite(updated) ? updated >= recentThreshold : false,
      };
    });
  }

  getCamerasByStatus(status: 'new' | 'recently-updated' | 'all'): Camera[] {
    const cameras = this.getCamerasWithIndicators();
    if (status === 'new') return cameras.filter((camera) => camera.isNew);
    if (status === 'recently-updated') return cameras.filter((camera) => camera.isRecentlyUpdated);
    return cameras;
  }

  getCamerasByLogFormat(logFormat: string): Camera[] {
    const search = logFormat.trim().toLowerCase();
    return this.getCamerasWithIndicators().filter((camera) =>
      camera.logFormats.some((format) => format.toLowerCase() === search)
    );
  }

  getAvailableLogFormats(): string[] {
    return [...this.status.logFormats];
  }

  getAvailableBrands(): string[] {
    return [...this.status.brands];
  }

  onCameraUpdate(callback: (cameras: Camera[]) => void) {
    this.updateCallbacks.push(callback);
  }

  offCameraUpdate(callback: (cameras: Camera[]) => void) {
    this.updateCallbacks = this.updateCallbacks.filter((entry) => entry !== callback);
  }

  getDiscoveryStatus(): VideoCameraDiscoveryStatus {
    return { ...this.status };
  }
}

export const videoCameraDiscovery = new VideoCameraDiscoveryService();
