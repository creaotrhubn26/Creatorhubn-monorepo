/**
 * School Photography Data Service
 * 
 * Handles database persistence for school photography features:
 * - Class photo sessions
 * - User preferences
 * - Saved arrangements
 * - Custom prop configurations
 */

import { logger } from './logger';
import type { ClassPhotoSession, TeacherConfig, Student, ClassPhotoRow, ClassPhotoProp } from './classPhotoService';
import { ClassPhotoSetup } from './classPhotoService';

const log = logger.module('SchoolPhotoData, ');
const API_BASE = '/api/virtual-studio/school-photo';

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
// Types
// =============================================================================

export interface ClassPhotoSessionDB {
  id: string;
  userId: string;
  projectId?: string;
  name: string;
  description?: string;
  studentCount: number;
  ageGroup: string;
  heightDistribution: string;
  rowCount: number;
  arrangementStyle: string;
  staggerPositions: boolean;
  teachers: TeacherConfig[];
  students: Record<string, Student>;
  rows: ClassPhotoRow[];
  props: ClassPhotoProp[];
  cameraSettings?: Record<string, any>;
  lightingPresetId?: string;
  hdriPresetId?: string;
  backdropId?: string;
  thumbnailUrl?: string;
  status: 'draft' | 'active' | 'completed' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface SchoolPhotoPreferences {
  id: string;
  userId: string;
  lastPhotoType?: string;
  favoritePhotoTypes: string[];
  lastHdriId?: string;
  lastLightingPresetId?: string;
  lastBackdropId?: string;
  defaultProps: string[];
  defaultCamera?: Record<string, any>;
  setupCompleted: boolean;
  setupCompletedAt?: string;
  totalSessions: number;
}

export interface SavedArrangement {
  id: string;
  userId: string;
  name: string;
  description?: string;
  studentCount: number;
  rowCount: number;
  arrangementStyle: string;
  positions: Record<string, any>;
  props: Record<string, any>[];
  avgVisibilityScore?: number;
  usageCount: number;
  thumbnailUrl?: string;
  isPublic: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CustomPropConfig {
  id: string;
  userId: string;
  name: string;
  basePropType: string;
  height?: number;
  width?: number;
  depth?: number;
  seats: number;
  color?: string;
  material?: string;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// Local Storage Keys
// =============================================================================

const STORAGE_KEYS = {
  SESSIONS: 'vs_class_photo_sessions',
  PREFERENCES: 'vs_school_photo_prefs',
  ARRANGEMENTS: 'vs_saved_arrangements',
  PROPS: 'vs_custom_props',
};

// =============================================================================
// Class Photo Sessions Service
// =============================================================================

export const classPhotoSessionsService = {
  /**
   * Get all sessions for the current user
   */
  async getAll(): Promise<ClassPhotoSessionDB[]> {
    try {
      const response = await apiRequest<{ success: boolean; sessions: ClassPhotoSessionDB[] }>('/sessions');
      if (response.success) {
        localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(response.sessions));
        return response.sessions;
      }
    } catch (error) {
      log.warn('Failed to fetch sessions from API, using localStorage');
    }
    
    const saved = localStorage.getItem(STORAGE_KEYS.SESSIONS);
    return saved ? JSON.parse(saved) : [];
  },

  /**
   * Get a single session by ID
   */
  async getById(id: string): Promise<ClassPhotoSessionDB | null> {
    try {
      const response = await apiRequest<{ success: boolean; session: ClassPhotoSessionDB }>(`/sessions/${id}`);
      if (response.success) {
        return response.session;
      }
    } catch (error) {
      log.warn('Failed to fetch session from API, ');
    }
    
    const sessions = await this.getAll();
    return sessions.find(s => s.id === id) || null;
  },

  /**
   * Create a new session
   */
  async create(
    session: Omit<ClassPhotoSessionDB, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
  ): Promise<ClassPhotoSessionDB | null> {
    try {
      const response = await apiRequest<{ success: boolean; session: ClassPhotoSessionDB }>('/sessions', {
        method: 'POST',
        body: JSON.stringify(session),
      });
      if (response.success) {
        // Update local cache
        const sessions = await this.getAll();
        sessions.push(response.session);
        localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
        return response.session;
      }
    } catch (error) {
      log.warn('Failed to create session in API, saving to localStorage');
      
      // Fallback to localStorage
      const localSession: ClassPhotoSessionDB = {
        ...session,
        id: `local_${Date.now()}`,
        userId: 'local',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const sessions = await this.getAll();
      sessions.push(localSession);
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
      return localSession;
    }
    return null;
  },

  /**
   * Update an existing session
   */
  async update(id: string, updates: Partial<ClassPhotoSessionDB>): Promise<ClassPhotoSessionDB | null> {
    try {
      const response = await apiRequest<{ success: boolean; session: ClassPhotoSessionDB }>(`/sessions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      if (response.success) {
        // Update local cache
        const sessions = await this.getAll();
        const index = sessions.findIndex(s => s.id === id);
        if (index >= 0) {
          sessions[index] = response.session;
          localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
        }
        return response.session;
      }
    } catch (error) {
      log.warn('Failed to update session in API, updating localStorage');
      
      // Fallback to localStorage
      const sessions = await this.getAll();
      const index = sessions.findIndex(s => s.id === id);
      if (index >= 0) {
        sessions[index] = { ...sessions[index], ...updates, updatedAt: new Date().toISOString() };
        localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
        return sessions[index];
      }
    }
    return null;
  },

  /**
   * Delete a session
   */
  async delete(id: string): Promise<boolean> {
    try {
      await apiRequest(`/sessions/${id}`, { method: 'DELETE' });
    } catch (error) {
      log.warn('Failed to delete session from API');
    }
    
    // Remove from local cache
    const sessions = await this.getAll();
    const filtered = sessions.filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(filtered));
    return true;
  },

  /**
   * Convert in-memory session to DB format
   */
  fromMemory(session: ClassPhotoSession): Omit<ClassPhotoSessionDB, 'id' | 'userId' | 'createdAt' | 'updatedAt'> {
    return {
      name: session.name,
      studentCount: session.setup.studentCount,
      ageGroup: session.setup.ageGroup,
      heightDistribution: session.setup.heightDistribution,
      rowCount: session.setup.rowCount,
      arrangementStyle: session.setup.arrangementStyle,
      staggerPositions: session.setup.staggerPositions,
      teachers: session.setup.teachers,
      students: Object.fromEntries(session.students),
      rows: session.rows,
      props: session.props,
      cameraSettings: session.camera,
      status: 'draft',
    };
  },
};

// =============================================================================
// School Photo Preferences Service
// =============================================================================

export const schoolPhotoPreferencesService = {
  /**
   * Get user preferences
   */
  async get(): Promise<SchoolPhotoPreferences | null> {
    try {
      const response = await apiRequest<{ success: boolean; preferences: SchoolPhotoPreferences }>('/preferences');
      if (response.success) {
        localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(response.preferences));
        return response.preferences;
      }
    } catch (error) {
      log.warn('Failed to fetch preferences from API, using localStorage');
    }
    
    const saved = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
    return saved ? JSON.parse(saved) : null;
  },

  /**
   * Update preferences
   */
  async update(updates: Partial<SchoolPhotoPreferences>): Promise<SchoolPhotoPreferences | null> {
    const current = await this.get() || {
      id: ', ',
      userId: ', ',
      favoritePhotoTypes: [],
      defaultProps: [],
      setupCompleted: false,
      totalSessions: 0,
    };
    const updated = { ...current, ...updates };
    
    // Save to localStorage immediately
    localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(updated));
    
    try {
      const response = await apiRequest<{ success: boolean; preferences: SchoolPhotoPreferences }>('/preferences', {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      if (response.success) {
        localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(response.preferences));
        return response.preferences;
      }
    } catch (error) {
      log.warn('Failed to update preferences in API');
    }
    
    return updated as SchoolPhotoPreferences;
  },

  /**
   * Record photo type usage
   */
  async recordPhotoTypeUsage(photoType: string): Promise<void> {
    await this.update({ lastPhotoType: photoType });
  },

  /**
   * Record setup usage
   */
  async recordSetupUsage(hdriId?: string, lightingPresetId?: string, backdropId?: string): Promise<void> {
    await this.update({
      lastHdriId: hdriId,
      lastLightingPresetId: lightingPresetId,
      lastBackdropId: backdropId,
    });
  },

  /**
   * Mark setup as completed
   */
  async markSetupCompleted(): Promise<void> {
    await this.update({
      setupCompleted: true,
      setupCompletedAt: new Date().toISOString(),
    });
  },

  /**
   * Increment session count
   */
  async incrementSessionCount(): Promise<void> {
    const prefs = await this.get();
    await this.update({
      totalSessions: (prefs?.totalSessions || 0) + 1,
    });
  },
};

// =============================================================================
// Saved Arrangements Service
// =============================================================================

export const savedArrangementsService = {
  /**
   * Get all saved arrangements
   */
  async getAll(): Promise<SavedArrangement[]> {
    try {
      const response = await apiRequest<{ success: boolean; arrangements: SavedArrangement[] }>('/arrangements');
      if (response.success) {
        localStorage.setItem(STORAGE_KEYS.ARRANGEMENTS, JSON.stringify(response.arrangements));
        return response.arrangements;
      }
    } catch (error) {
      log.warn('Failed to fetch arrangements from API, using localStorage');
    }
    
    const saved = localStorage.getItem(STORAGE_KEYS.ARRANGEMENTS);
    return saved ? JSON.parse(saved) : [];
  },

  /**
   * Create a new arrangement
   */
  async create(arrangement: Omit<SavedArrangement, 'id' | 'userId' | 'usageCount' | 'createdAt' | 'updatedAt'>): Promise<SavedArrangement | null> {
    try {
      const response = await apiRequest<{ success: boolean; arrangement: SavedArrangement }>('/arrangements', {
        method: 'POST',
        body: JSON.stringify(arrangement),
      });
      if (response.success) {
        const arrangements = await this.getAll();
        arrangements.push(response.arrangement);
        localStorage.setItem(STORAGE_KEYS.ARRANGEMENTS, JSON.stringify(arrangements));
        return response.arrangement;
      }
    } catch (error) {
      log.warn('Failed to create arrangement in API');
      
      // Fallback to localStorage
      const localArrangement: SavedArrangement = {
        ...arrangement,
        id: `local_${Date.now()}`,
        userId: 'local',
        usageCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const arrangements = await this.getAll();
      arrangements.push(localArrangement);
      localStorage.setItem(STORAGE_KEYS.ARRANGEMENTS, JSON.stringify(arrangements));
      return localArrangement;
    }
    return null;
  },

  /**
   * Delete an arrangement
   */
  async delete(id: string): Promise<boolean> {
    try {
      await apiRequest(`/arrangements/${id}`, { method: 'DELETE' });
    } catch (error) {
      log.warn('Failed to delete arrangement from API');
    }
    
    const arrangements = await this.getAll();
    const filtered = arrangements.filter(a => a.id !== id);
    localStorage.setItem(STORAGE_KEYS.ARRANGEMENTS, JSON.stringify(filtered));
    return true;
  },

  /**
   * Increment usage count
   */
  async recordUsage(id: string): Promise<void> {
    try {
      await apiRequest(`/arrangements/${id}/use`, { method: 'POST' });
    } catch (error) {
      log.warn('Failed to record arrangement usage');
    }
  },
};

// =============================================================================
// Custom Props Service
// =============================================================================

export const customPropsService = {
  /**
   * Get all custom props
   */
  async getAll(): Promise<CustomPropConfig[]> {
    try {
      const response = await apiRequest<{ success: boolean; props: CustomPropConfig[] }>('/props');
      if (response.success) {
        localStorage.setItem(STORAGE_KEYS.PROPS, JSON.stringify(response.props));
        return response.props;
      }
    } catch (error) {
      log.warn('Failed to fetch custom props from API, using localStorage');
    }
    
    const saved = localStorage.getItem(STORAGE_KEYS.PROPS);
    return saved ? JSON.parse(saved) : [];
  },

  /**
   * Create a new custom prop
   */
  async create(prop: Omit<CustomPropConfig, 'id' | 'userId' | 'usageCount' | 'createdAt' | 'updatedAt'>): Promise<CustomPropConfig | null> {
    try {
      const response = await apiRequest<{ success: boolean; prop: CustomPropConfig }>('/props', {
        method: 'POST',
        body: JSON.stringify(prop),
      });
      if (response.success) {
        const props = await this.getAll();
        props.push(response.prop);
        localStorage.setItem(STORAGE_KEYS.PROPS, JSON.stringify(props));
        return response.prop;
      }
    } catch (error) {
      log.warn('Failed to create custom prop in API');
      
      // Fallback to localStorage
      const localProp: CustomPropConfig = {
        ...prop,
        id: `local_${Date.now()}`,
        userId: 'local',
        usageCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const props = await this.getAll();
      props.push(localProp);
      localStorage.setItem(STORAGE_KEYS.PROPS, JSON.stringify(props));
      return localProp;
    }
    return null;
  },

  /**
   * Delete a custom prop
   */
  async delete(id: string): Promise<boolean> {
    try {
      await apiRequest(`/props/${id}`, { method: 'DELETE' });
    } catch (error) {
      log.warn('Failed to delete custom prop from API');
    }
    
    const props = await this.getAll();
    const filtered = props.filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEYS.PROPS, JSON.stringify(filtered));
    return true;
  },
};

// =============================================================================
// Main Export
// =============================================================================

export const schoolPhotoDataService = {
  sessions: classPhotoSessionsService,
  preferences: schoolPhotoPreferencesService,
  arrangements: savedArrangementsService,
  props: customPropsService,
};

export default schoolPhotoDataService;
