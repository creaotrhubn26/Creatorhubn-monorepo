/**
 * Virtual Studio User Data Service
 * 
 * Centralized service for all user-specific data that needs database persistence.
 * Provides API sync with localStorage fallback.
 */

import { logger } from './logger';

const log = logger.module('UserData, ');
const API_BASE = '/api/virtual-studio/user-data';

// =============================================================================
// API Helper
// =============================================================================

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type' : 'application/json',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  
  return response.json();
}

// =============================================================================
// Guide Settings
// =============================================================================

export interface GuideSettings {
  showDistanceGuides: boolean;
  distanceUnit: 'meters' | 'feet';
  showAngleGuides: boolean;
  showLightAngle: boolean;
  showCameraAngle: boolean;
  showCompositionGuides: boolean;
  compositionType: string;
  showHeightGuides: boolean;
  showSafetyGuides: boolean;
  showDofPreview: boolean;
  settings: Record<string, any>;
}

const GUIDE_SETTINGS_KEY = 'virtualStudio_guideSettings';

export const guideSettingsService = {
  async get(): Promise<GuideSettings | null> {
    try {
      const response = await apiRequest<{ success: boolean; settings: GuideSettings }>('/guide-settings');
      if (response.success) {
        // Also update localStorage as cache
        localStorage.setItem(GUIDE_SETTINGS_KEY, JSON.stringify(response.settings));
        return response.settings;
      }
    } catch (error) {
      log.warn('Failed to fetch guide settings from API, using localStorage');
    }
    
    // Fallback to localStorage
    const saved = localStorage.getItem(GUIDE_SETTINGS_KEY);
    return saved ? JSON.parse(saved) : null;
  },

  async save(settings: Partial<GuideSettings>): Promise<void> {
    // Save to localStorage immediately
    const current = await this.get() || {};
    const updated = { ...current, ...settings };
    localStorage.setItem(GUIDE_SETTINGS_KEY, JSON.stringify(updated));
    
    // Sync to API
    try {
      await apiRequest('/guide-settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
    } catch (error) {
      log.warn('Failed to sync guide settings to API');
    }
  },
};

// =============================================================================
// Light Presets
// =============================================================================

export interface LightPreset {
  id: string;
  name: string;
  description?: string;
  category: string;
  lights: Array<{
    id: string;
    type: string;
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    power: number;
    color: string;
    temperature: number;
    modifier?: string;
    modifierSize?: number;
  }>;
  thumbnail?: string;
  isPublic: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

const LIGHT_PRESETS_KEY = 'virtualStudio_lightPresets';

export const lightPresetsService = {
  async getAll(category?: string): Promise<LightPreset[]> {
    try {
      const url = category ? `/light-presets?category=${category}` : '/light-presets';
      const response = await apiRequest<{ success: boolean; presets: LightPreset[] }>(url);
      if (response.success) {
        localStorage.setItem(LIGHT_PRESETS_KEY, JSON.stringify(response.presets));
        return response.presets;
      }
    } catch (error) {
      log.warn('Failed to fetch light presets from API');
    }
    
    const saved = localStorage.getItem(LIGHT_PRESETS_KEY);
    return saved ? JSON.parse(saved) : [];
  },

  async create(preset: Omit<LightPreset, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>): Promise<LightPreset | null> {
    try {
      const response = await apiRequest<{ success: boolean; preset: LightPreset }>('/light-presets', {
        method: 'POST',
        body: JSON.stringify(preset),
      });
      if (response.success) {
        // Update localStorage cache
        const presets = await this.getAll();
        presets.push(response.preset);
        localStorage.setItem(LIGHT_PRESETS_KEY, JSON.stringify(presets));
        return response.preset;
      }
    } catch (error) {
      log.warn('Failed to create light preset via API');
      // Create locally
      const localPreset = {
        ...preset,
        id: crypto.randomUUID(),
        usageCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as LightPreset;
      const presets = JSON.parse(localStorage.getItem(LIGHT_PRESETS_KEY) || '[]');
      presets.push(localPreset);
      localStorage.setItem(LIGHT_PRESETS_KEY, JSON.stringify(presets));
      return localPreset;
    }
    return null;
  },

  async delete(id: string): Promise<void> {
    try {
      await apiRequest(`/light-presets/${id}`, { method: 'DELETE' });
    } catch (error) {
      log.warn('Failed to delete light preset via API');
    }
    
    // Update localStorage
    const presets = JSON.parse(localStorage.getItem(LIGHT_PRESETS_KEY) || '[]');
    const filtered = presets.filter((p: LightPreset) => p.id !== id);
    localStorage.setItem(LIGHT_PRESETS_KEY, JSON.stringify(filtered));
  },
};

// =============================================================================
// Client Sharing
// =============================================================================

export interface ShareLink {
  id: string;
  projectId?: string;
  token: string;
  clientName?: string;
  clientEmail?: string;
  canComment: boolean;
  canApprove: boolean;
  canDownload: boolean;
  password?: string;
  expiresAt?: string;
  maxViews?: number;
  isActive: boolean;
  accessCount: number;
  lastAccessedAt?: string;
  sceneData?: Record<string, any>;
  createdAt: string;
}

export interface ClientComment {
  id: string;
  shareLinkId: string;
  authorName: string;
  authorEmail?: string;
  content: string;
  position?: { x: number; y: number; z: number };
  cameraView?: Record<string, any>;
  isResolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  parentId?: string;
  createdAt: string;
}

export interface ClientApproval {
  id: string;
  shareLinkId: string;
  clientName: string;
  clientEmail?: string;
  status: 'pending' | 'approved' | 'revision_requested';
  notes?: string;
  approvedItems: string[];
  revisionItems: Array<{ item: string; feedback: string }>;
  createdAt: string;
}

const SHARE_LINKS_KEY = 'vs_share_links';
const CLIENT_COMMENTS_KEY = 'vs_client_comments';
const CLIENT_APPROVALS_KEY = 'vs_approvals';

export const clientSharingService = {
  // Share Links
  async getShareLinks(projectId?: string): Promise<ShareLink[]> {
    try {
      const url = projectId ? `/share-links?projectId=${projectId}` : '/share-links';
      const response = await apiRequest<{ success: boolean; links: ShareLink[] }>(url);
      if (response.success) {
        localStorage.setItem(SHARE_LINKS_KEY, JSON.stringify(response.links));
        return response.links;
      }
    } catch (error) {
      log.warn('Failed to fetch share links from API');
    }
    return JSON.parse(localStorage.getItem(SHARE_LINKS_KEY) || '[]');
  },

  async createShareLink(data: Partial<ShareLink>): Promise<ShareLink | null> {
    try {
      const response = await apiRequest<{ success: boolean; link: ShareLink }>('/share-links', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (response.success) {
        const links = await this.getShareLinks();
        links.push(response.link);
        localStorage.setItem(SHARE_LINKS_KEY, JSON.stringify(links));
        return response.link;
      }
    } catch (error) {
      log.warn('Failed to create share link via API');
    }
    return null;
  },

  async accessShareLink(token: string): Promise<ShareLink | null> {
    try {
      const response = await apiRequest<{ success: boolean; link: ShareLink }>(`/share-links/token/${token}`);
      return response.success ? response.link : null;
    } catch (error) {
      return null;
    }
  },

  async deactivateShareLink(id: string): Promise<void> {
    try {
      await apiRequest(`/share-links/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: false }),
      });
    } catch (error) {
      log.warn('Failed to deactivate share link via API');
    }
    
    const links = JSON.parse(localStorage.getItem(SHARE_LINKS_KEY) || '[]');
    const updated = links.map((l: ShareLink) => l.id === id ? { ...l, isActive: false } : l);
    localStorage.setItem(SHARE_LINKS_KEY, JSON.stringify(updated));
  },

  // Comments
  async getComments(shareLinkId: string): Promise<ClientComment[]> {
    try {
      const response = await apiRequest<{ success: boolean; comments: ClientComment[] }>(
        `/share-links/${shareLinkId}/comments`
      );
      return response.success ? response.comments : [];
    } catch (error) {
      return JSON.parse(localStorage.getItem(CLIENT_COMMENTS_KEY) || '[]')
        .filter((c: ClientComment) => c.shareLinkId === shareLinkId);
    }
  },

  async addComment(shareLinkId: string, data: Partial<ClientComment>): Promise<ClientComment | null> {
    try {
      const response = await apiRequest<{ success: boolean; comment: ClientComment }>(
        `/share-links/${shareLinkId}/comments`,
        { method: 'POST', body: JSON.stringify(data) }
      );
      return response.success ? response.comment : null;
    } catch (error) {
      return null;
    }
  },

  async resolveComment(id: string, resolvedBy: string): Promise<void> {
    try {
      await apiRequest(`/comments/${id}/resolve`, {
        method: 'PUT',
        body: JSON.stringify({ resolvedBy }),
      });
    } catch (error) {
      log.warn('Failed to resolve comment via API');
    }
  },

  // Approvals
  async getApprovals(shareLinkId: string): Promise<ClientApproval[]> {
    try {
      const response = await apiRequest<{ success: boolean; approvals: ClientApproval[] }>(
        `/share-links/${shareLinkId}/approvals`
      );
      return response.success ? response.approvals : [];
    } catch (error) {
      return JSON.parse(localStorage.getItem(CLIENT_APPROVALS_KEY) || '[]')
        .filter((a: ClientApproval) => a.shareLinkId === shareLinkId);
    }
  },

  async createApproval(shareLinkId: string, data: Partial<ClientApproval>): Promise<ClientApproval | null> {
    try {
      const response = await apiRequest<{ success: boolean; approval: ClientApproval }>(
        `/share-links/${shareLinkId}/approvals`,
        { method: 'POST', body: JSON.stringify(data) }
      );
      return response.success ? response.approval : null;
    } catch (error) {
      return null;
    }
  },
};

// =============================================================================
// Scene Snapshots
// =============================================================================

export interface SceneSnapshot {
  id: string;
  projectId?: string;
  name: string;
  description?: string;
  sceneData: Record<string, any>;
  thumbnail?: string;
  nodeCount: number;
  lightCount: number;
  createdAt: string;
}

const SNAPSHOTS_KEY = 'vs-scene-snapshots';

export const sceneSnapshotsService = {
  async getAll(projectId?: string): Promise<SceneSnapshot[]> {
    try {
      const url = projectId ? `/scene-snapshots?projectId=${projectId}` : '/scene-snapshots';
      const response = await apiRequest<{ success: boolean; snapshots: SceneSnapshot[] }>(url);
      if (response.success) {
        localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(response.snapshots));
        return response.snapshots;
      }
    } catch (error) {
      log.warn('Failed to fetch snapshots from API');
    }
    return JSON.parse(localStorage.getItem(SNAPSHOTS_KEY) || '[]');
  },

  async create(snapshot: Omit<SceneSnapshot, 'id' | 'createdAt'>): Promise<SceneSnapshot | null> {
    try {
      const response = await apiRequest<{ success: boolean; snapshot: SceneSnapshot }>('/scene-snapshots', {
        method: 'POST',
        body: JSON.stringify(snapshot),
      });
      if (response.success) {
        const snapshots = await this.getAll();
        snapshots.unshift(response.snapshot);
        localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(snapshots));
        return response.snapshot;
      }
    } catch (error) {
      log.warn('Failed to create snapshot via API');
    }
    return null;
  },

  async delete(id: string): Promise<void> {
    try {
      await apiRequest(`/scene-snapshots/${id}`, { method: 'DELETE' });
    } catch (error) {
      log.warn('Failed to delete snapshot via API');
    }
    
    const snapshots = JSON.parse(localStorage.getItem(SNAPSHOTS_KEY) || '[]');
    const filtered = snapshots.filter((s: SceneSnapshot) => s.id !== id);
    localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(filtered));
  },
};

// =============================================================================
// Custom Templates
// =============================================================================

export interface CustomTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  tags: string[];
  sceneData: Record<string, any>;
  thumbnail?: string;
  isPublic: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

const TEMPLATES_KEY = 'virtualStudio_customTemplates';

export const customTemplatesService = {
  async getAll(category?: string): Promise<CustomTemplate[]> {
    try {
      const url = category ? `/custom-templates?category=${category}` : '/custom-templates';
      const response = await apiRequest<{ success: boolean; templates: CustomTemplate[] }>(url);
      if (response.success) {
        localStorage.setItem(TEMPLATES_KEY, JSON.stringify(response.templates));
        return response.templates;
      }
    } catch (error) {
      log.warn('Failed to fetch templates from API');
    }
    return JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '[]');
  },

  async create(template: Omit<CustomTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>): Promise<CustomTemplate | null> {
    try {
      const response = await apiRequest<{ success: boolean; template: CustomTemplate }>('/custom-templates', {
        method: 'POST',
        body: JSON.stringify(template),
      });
      return response.success ? response.template : null;
    } catch (error) {
      log.warn('Failed to create template via API');
    }
    return null;
  },

  async delete(id: string): Promise<void> {
    try {
      await apiRequest(`/custom-templates/${id}`, { method: 'DELETE' });
    } catch (error) {
      log.warn('Failed to delete template via API');
    }
    
    const templates = JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '[]');
    const filtered = templates.filter((t: CustomTemplate) => t.id !== id);
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(filtered));
  },
};

// =============================================================================
// Auto-Save
// =============================================================================

const AUTOSAVE_KEY = 'virtualStudio_autoSave';

export const autoSaveService = {
  async get(projectId?: string): Promise<Record<string, any> | null> {
    try {
      const url = projectId ? `/auto-save?projectId=${projectId}` : '/auto-save';
      const response = await apiRequest<{ success: boolean; autoSave: { sceneData: Record<string, any> } | null }>(url);
      return response.autoSave?.sceneData || null;
    } catch (error) {
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      return saved ? JSON.parse(saved) : null;
    }
  },

  async save(sceneData: Record<string, any>, projectId?: string, nodeCount?: number): Promise<void> {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(sceneData));
    
    try {
      await apiRequest('/auto-save', {
        method: 'POST',
        body: JSON.stringify({ sceneData, projectId, nodeCount }),
      });
    } catch (error) {
      log.warn('Failed to sync auto-save to API');
    }
  },

  async clear(projectId?: string): Promise<void> {
    localStorage.removeItem(AUTOSAVE_KEY);
    
    try {
      const url = projectId ? `/auto-save?projectId=${projectId}` : '/auto-save';
      await apiRequest(url, { method: 'DELETE' });
    } catch (error) {
      log.warn('Failed to clear auto-save via API');
    }
  },
};

// =============================================================================
// Device Config
// =============================================================================

export interface DeviceConfig {
  deviceType: 'desktop' | 'tablet' | 'mobile';
  isTouch: boolean;
  hasApplePencil: boolean;
  qualityLevel: 'low' | 'medium' | 'high' | 'ultra';
  shadowQuality: string;
  antialias: boolean;
  panelLayout: string;
  toolbarPosition: string;
  config: Record<string, any>;
}

const DEVICE_CONFIG_KEY = 'vs_deviceConfig';

export const deviceConfigService = {
  async get(): Promise<DeviceConfig | null> {
    try {
      const response = await apiRequest<{ success: boolean; config: DeviceConfig }>('/device-config');
      if (response.success) {
        localStorage.setItem(DEVICE_CONFIG_KEY, JSON.stringify(response.config));
        return response.config;
      }
    } catch (error) {
      log.warn('Failed to fetch device config from API');
    }
    const saved = localStorage.getItem(DEVICE_CONFIG_KEY);
    return saved ? JSON.parse(saved) : null;
  },

  async save(config: Partial<DeviceConfig>): Promise<void> {
    const current = await this.get() || {};
    const updated = { ...current, ...config };
    localStorage.setItem(DEVICE_CONFIG_KEY, JSON.stringify(updated));
    
    try {
      await apiRequest('/device-config', {
        method: 'PUT',
        body: JSON.stringify(config),
      });
    } catch (error) {
      log.warn('Failed to sync device config to API');
    }
  },
};

// =============================================================================
// Persona Journey
// =============================================================================

export interface PersonaJourney {
  profession?: string;
  specialization?: string;
  experienceLevel: string;
  completedSteps: string[];
  currentStep?: string;
  discoveredFeatures: string[];
  featureUsageCount: Record<string, number>;
  goals: string[];
  completedGoals: string[];
}

const PERSONA_KEY = 'virtualStudio_personaJourney';

export const personaJourneyService = {
  async get(): Promise<PersonaJourney | null> {
    try {
      const response = await apiRequest<{ success: boolean; journey: PersonaJourney }>('/persona-journey');
      if (response.success) {
        localStorage.setItem(PERSONA_KEY, JSON.stringify(response.journey));
        return response.journey;
      }
    } catch (error) {
      log.warn('Failed to fetch persona journey from API');
    }
    const saved = localStorage.getItem(PERSONA_KEY);
    return saved ? JSON.parse(saved) : null;
  },

  async save(journey: Partial<PersonaJourney>): Promise<void> {
    const current = await this.get() || {};
    const updated = { ...current, ...journey };
    localStorage.setItem(PERSONA_KEY, JSON.stringify(updated));
    
    try {
      await apiRequest('/persona-journey', {
        method: 'PUT',
        body: JSON.stringify(journey),
      });
    } catch (error) {
      log.warn('Failed to sync persona journey to API');
    }
  },
};

// =============================================================================
// Comparison Settings
// =============================================================================

export interface ComparisonSettings {
  defaultMode: 'side_by_side' | 'overlay' | 'slider';
  syncCameras: boolean;
  showDifferences: boolean;
  labelPosition: string;
  showTimestamps: boolean;
  settings: Record<string, any>;
}

const COMPARISON_KEY = 'vs-comparison-settings';

export const comparisonSettingsService = {
  async get(): Promise<ComparisonSettings | null> {
    try {
      const response = await apiRequest<{ success: boolean; settings: ComparisonSettings }>('/comparison-settings');
      if (response.success) {
        localStorage.setItem(COMPARISON_KEY, JSON.stringify(response.settings));
        return response.settings;
      }
    } catch (error) {
      log.warn('Failed to fetch comparison settings from API');
    }
    const saved = localStorage.getItem(COMPARISON_KEY);
    return saved ? JSON.parse(saved) : null;
  },

  async save(settings: Partial<ComparisonSettings>): Promise<void> {
    const current = await this.get() || {};
    const updated = { ...current, ...settings };
    localStorage.setItem(COMPARISON_KEY, JSON.stringify(updated));
    
    try {
      await apiRequest('/comparison-settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
    } catch (error) {
      log.warn('Failed to sync comparison settings to API');
    }
  },
};

// =============================================================================
// Export all services
// =============================================================================

export const userDataService = {
  guideSettings: guideSettingsService,
  lightPresets: lightPresetsService,
  clientSharing: clientSharingService,
  sceneSnapshots: sceneSnapshotsService,
  customTemplates: customTemplatesService,
  autoSave: autoSaveService,
  deviceConfig: deviceConfigService,
  personaJourney: personaJourneyService,
  comparisonSettings: comparisonSettingsService,
};

export default userDataService;
