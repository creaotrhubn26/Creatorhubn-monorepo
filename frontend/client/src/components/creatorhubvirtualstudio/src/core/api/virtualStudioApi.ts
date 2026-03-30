/**
 * Virtual Studio API Client
 * Database persistence for all Virtual Studio features
 */

import { logger } from '../services/logger';

const log = logger.module('VirtualStudioAPI');
const API_BASE = '/api/virtual-studio';

// ============================================================================
// Types
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  error?: string;
  data?: T;
}

export interface ExportTemplateDB {
  id: string;
  userId: string;
  name: string;
  description?: string;
  icon: string;
  category: string;
  presets: string[];
  scheduleType: string;
  delayMinutes?: number;
  specificTime?: string;
  recurringPattern?: string;
  timezone?: string;
  priority: string;
  uploadToDrive: boolean;
  createSubfolder: boolean;
  subfolderName?: string;
  notifyOnComplete: boolean;
  tags?: string[];
  estimatedDuration?: string;
  recommendedFor?: string[];
  usageCount: number;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExportJobDB {
  id: string;
  userId: string;
  projectId?: string;
  sceneId?: string;
  templateId?: string;
  name: string;
  presetId: string;
  config: {
    format: string;
    width: number;
    height: number;
    fps: number;
    bitrate: number;
    duration: number;
    quality: string;
  };
  status: string;
  priority: string;
  scheduledTime?: string;
  delaySeconds?: number;
  progress: number;
  currentFrame?: number;
  totalFrames?: number;
  outputUrl?: string;
  outputFormat?: string;
  fileSize?: number;
  renderTime?: number;
  uploadToDrive: boolean;
  driveFileId?: string;
  driveWebViewLink?: string;
  driveFolderId?: string;
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnimationClipDB {
  id: string;
  userId: string;
  projectId?: string;
  sceneId?: string;
  name: string;
  description?: string;
  duration: number;
  tracks: any[];
  loop: boolean;
  speed: number;
  isTemplate: boolean;
  templateCategory?: string;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferencesDB {
  id: string;
  userId: string;
  theme: string;
  gridSize: number;
  showGrid: boolean;
  showHelpers: boolean;
  showGizmos: boolean;
  customShortcuts?: Record<string, string>;
  favoriteTemplates?: string[];
  favoriteExportPresets?: string[];
  favoriteAssets?: string[];
  recentProjects?: Array<{ id: string; name: string; lastOpened: string }>;
  recentScenes?: Array<{ id: string; name: string; lastOpened: string }>;
  recentExports?: Array<{ id: string; name: string; timestamp: string }>;
  defaultResolution: string;
  defaultQuality: string;
  defaultFps: number;
  defaultFormat: string;
  defaultUploadToDrive: boolean;
  defaultDriveFolderId?: string;
  showMotionPaths: boolean;
  motionPathColor: string;
  keyframeColor: string;
  onboardingCompleted: boolean;
  tutorialsCompleted?: string[];
  gearPresets?: GearPresetState[];
  createdAt: string;
  updatedAt: string;
}

export interface EquipmentGroupDB {
  id: string;
  userId: string;
  sceneId?: string;
  name: string;
  description?: string;
  nodeIds: string[];
  isLocked: boolean;
  linkedNodes?: Array<{ primaryId: string; linkedIds: string[] }>;
  position?: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  createdAt: string;
  updatedAt: string;
}

export interface SceneSnapshotDB {
  id: string;
  userId: string;
  sceneId: string;
  name: string;
  description?: string;
  thumbnailUrl?: string;
  sceneState: any;
  cameraState?: any;
  nodeCount?: number;
  lightCount?: number;
  createdAt: string;
}

// ============================================================================
// API Helper
// ============================================================================

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type' : 'application/json',
        ...options.headers,
      },
      credentials: 'include',
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Request failed' };
    }

    return { success: true, data };
  } catch (error) {
    log.error(`API Error (${endpoint}):`, error);
    return { success: false, error: 'Network error' };
  }
}

// ============================================================================
// Export Templates API
// ============================================================================

export const exportTemplatesApi = {
  /**
   * Get all user's export templates
   */
  async getAll(): Promise<ExportTemplateDB[]> {
    const result = await apiRequest<{ templates: ExportTemplateDB[] }>('/export-templates');
    return result.data?.templates || [];
  },

  /**
   * Create a new export template
   */
  async create(
    template: Omit<ExportTemplateDB, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'usageCount'>,
  ): Promise<ExportTemplateDB | null> {
    const result = await apiRequest<{ template: ExportTemplateDB }>('/export-templates', {
      method: 'POST',
      body: JSON.stringify(template),
    });
    return result.data?.template || null;
  },

  /**
   * Update an export template
   */
  async update(id: string, updates: Partial<ExportTemplateDB>): Promise<ExportTemplateDB | null> {
    const result = await apiRequest<{ template: ExportTemplateDB }>(`/export-templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return result.data?.template || null;
  },

  /**
   * Delete an export template
   */
  async delete(id: string): Promise<boolean> {
    const result = await apiRequest(`/export-templates/${id}`, {
      method: 'DELETE',
    });
    return result.success;
  },

  /**
   * Increment usage count
   */
  async incrementUsage(id: string): Promise<void> {
    await apiRequest(`/export-templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ lastUsedAt: new Date().toISOString() }),
    });
  },
};

// ============================================================================
// Export Jobs API
// ============================================================================

export const exportJobsApi = {
  /**
   * Get export jobs with optional status filter
   */
  async getAll(status?: string, limit = 50): Promise<ExportJobDB[]> {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    params.set('limit', limit.toString());
    
    const result = await apiRequest<{ jobs: ExportJobDB[] }>(`/export-jobs?${params}`);
    return result.data?.jobs || [];
  },

  /**
   * Get queue (pending, scheduled, queued jobs)
   */
  async getQueue(): Promise<ExportJobDB[]> {
    const all = await this.getAll(undefined, 100);
    return all.filter((j) => ['pending','scheduled','queued','exporting','uploading'].includes(j.status));
  },

  /**
   * Get history (completed, failed, cancelled jobs)
   */
  async getHistory(limit = 50): Promise<ExportJobDB[]> {
    const all = await this.getAll(undefined, limit);
    return all.filter((j) => ['complete','failed','cancelled'].includes(j.status));
  },

  /**
   * Create a new export job
   */
  async create(job: Omit<ExportJobDB, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<ExportJobDB | null> {
    const result = await apiRequest<{ job: ExportJobDB }>('/export-jobs', {
      method: 'POST',
      body: JSON.stringify(job),
    });
    return result.data?.job || null;
  },

  /**
   * Update a job (status, progress, etc.)
   */
  async update(id: string, updates: Partial<ExportJobDB>): Promise<ExportJobDB | null> {
    const result = await apiRequest<{ job: ExportJobDB }>(`/export-jobs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return result.data?.job || null;
  },

  /**
   * Cancel a job
   */
  async cancel(id: string): Promise<boolean> {
    const result = await apiRequest(`/export-jobs/${id}`, {
      method: 'DELETE',
    });
    return result.success;
  },
};

// ============================================================================
// Animation Clips API
// ============================================================================

export const animationClipsApi = {
  /**
   * Get animation clips
   */
  async getAll(options?: { sceneId?: string; projectId?: string; isTemplate?: boolean }): Promise<AnimationClipDB[]> {
    const params = new URLSearchParams();
    if (options?.sceneId) params.set('sceneId', options.sceneId);
    if (options?.projectId) params.set('projectId', options.projectId);
    if (options?.isTemplate) params.set('isTemplate', 'true');
    
    const result = await apiRequest<{ clips: AnimationClipDB[] }>(`/animation-clips?${params}`);
    return result.data?.clips || [];
  },

  /**
   * Get animation templates
   */
  async getTemplates(): Promise<AnimationClipDB[]> {
    return this.getAll({ isTemplate: true });
  },

  /**
   * Create an animation clip
   */
  async create(clip: Omit<AnimationClipDB, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'usageCount'>): Promise<AnimationClipDB | null> {
    const result = await apiRequest<{ clip: AnimationClipDB }>('/animation-clips', {
      method: 'POST',
      body: JSON.stringify(clip),
    });
    return result.data?.clip || null;
  },

  /**
   * Update an animation clip
   */
  async update(id: string, updates: Partial<AnimationClipDB>): Promise<AnimationClipDB | null> {
    const result = await apiRequest<{ clip: AnimationClipDB }>(`/animation-clips/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return result.data?.clip || null;
  },

  /**
   * Delete an animation clip
   */
  async delete(id: string): Promise<boolean> {
    const result = await apiRequest(`/animation-clips/${id}`, {
      method: 'DELETE',
    });
    return result.success;
  },
};

// ============================================================================
// User Preferences API
// ============================================================================

export const preferencesApi = {
  /**
   * Get user preferences
   */
  async get(): Promise<UserPreferencesDB | null> {
    const result = await apiRequest<{ preferences: UserPreferencesDB }>('/preferences');
    return result.data?.preferences || null;
  },

  /**
   * Update user preferences
   */
  async update(updates: Partial<UserPreferencesDB>): Promise<UserPreferencesDB | null> {
    const result = await apiRequest<{ preferences: UserPreferencesDB }>('/preferences', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return result.data?.preferences || null;
  },

  /**
   * Update favorites
   */
  async updateFavorites(type: 'templates' | 'exportPresets' | 'assets', ids: string[]): Promise<boolean> {
    const result = await apiRequest('/preferences/favorites', {
      method: 'PUT',
      body: JSON.stringify({ type, ids }),
    });
    return result.success;
  },

  /**
   * Add to recent
   */
  async addRecent(type: 'projects' | 'scenes' | 'exports', item: { id: string; name: string }): Promise<void> {
    const prefs = await this.get();
    if (!prefs) return;

    const field = type === 'projects' ? 'recentProjects' :
                  type === 'scenes' ? 'recentScenes' : 'recentExports';
    
    const current = (prefs as any)[field] || [];
    const filtered = current.filter((i: any) => i.id !== item.id);
    const updated = [{ ...item, lastOpened: new Date().toISOString() }, ...filtered].slice(0, 10);
    
    await this.update({ [field]: updated } as any);
  },
};

// ============================================================================
// Equipment Groups API
// ============================================================================

export const equipmentGroupsApi = {
  /**
   * Get equipment groups for a scene
   */
  async getAll(sceneId?: string): Promise<EquipmentGroupDB[]> {
    const params = sceneId ? `?sceneId=${sceneId}` : ', ';
    const result = await apiRequest<{ groups: EquipmentGroupDB[] }>(`/equipment-groups${params}`);
    return result.data?.groups || [];
  },

  /**
   * Create an equipment group
   */
  async create(group: Omit<EquipmentGroupDB, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<EquipmentGroupDB | null> {
    const result = await apiRequest<{ group: EquipmentGroupDB }>('/equipment-groups', {
      method: 'POST',
      body: JSON.stringify(group),
    });
    return result.data?.group || null;
  },

  /**
   * Update an equipment group
   */
  async update(id: string, updates: Partial<EquipmentGroupDB>): Promise<EquipmentGroupDB | null> {
    const result = await apiRequest<{ group: EquipmentGroupDB }>(`/equipment-groups/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return result.data?.group || null;
  },

  /**
   * Delete an equipment group
   */
  async delete(id: string): Promise<boolean> {
    const result = await apiRequest(`/equipment-groups/${id}`, {
      method: 'DELETE',
    });
    return result.success;
  },
};

// ============================================================================
// Scene Snapshots API
// ============================================================================

export const snapshotsApi = {
  /**
   * Get snapshots for a scene
   */
  async getAll(sceneId: string, limit = 20): Promise<SceneSnapshotDB[]> {
    const result = await apiRequest<{ snapshots: SceneSnapshotDB[] }>(
      `/snapshots?sceneId=${sceneId}&limit=${limit}`
    );
    return result.data?.snapshots || [];
  },

  /**
   * Create a snapshot
   */
  async create(snapshot: Omit<SceneSnapshotDB, 'id' | 'userId' | 'createdAt'>): Promise<SceneSnapshotDB | null> {
    const result = await apiRequest<{ snapshot: SceneSnapshotDB }>('/snapshots', {
      method: 'POST',
      body: JSON.stringify(snapshot),
    });
    return result.data?.snapshot || null;
  },

  /**
   * Delete a snapshot
   */
  async delete(id: string): Promise<boolean> {
    const result = await apiRequest(`/snapshots/${id}`, {
      method: 'DELETE',
    });
    return result.success;
  },
};

// ============================================================================
// Export all
// ============================================================================

export const virtualStudioApi = {
  exportTemplates: exportTemplatesApi,
  exportJobs: exportJobsApi,
  animationClips: animationClipsApi,
  preferences: preferencesApi,
  equipmentGroups: equipmentGroupsApi,
  snapshots: snapshotsApi,
};

export default virtualStudioApi;
import type { GearPresetState } from '../services/masterLightingIntegration';
