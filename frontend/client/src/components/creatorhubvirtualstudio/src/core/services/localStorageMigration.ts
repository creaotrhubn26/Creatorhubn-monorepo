/**
 * LocalStorage to Database Migration Service
 * 
 * This file documents all localStorage keys used in Virtual Studio
 * and provides migration utilities to move data to database persistence.
 */

import { preferencesApi, snapshotsApi, animationClipsApi } from '../api/virtualStudioApi';
import { logger } from './logger';

const log = logger.module('LocalStorageMigration');

// ============================================================================
// LOCALSTORAGE KEYS INVENTORY
// ============================================================================

export const LOCALSTORAGE_KEYS = {
  // -------------------------------------------------------------------------
  // ALREADY MIGRATED (Server-first with localStorage fallback)
  // -------------------------------------------------------------------------
  
  // Onboarding - Uses /api/user/kv with localStorage fallback ✅
  ONBOARDING_COMPLETED: 'virtualStudio_onboardingCompleted',
  
  // Projects - Uses /api/virtual-studio/projects with localStorage fallback ✅
  PROJECTS: 'virtualStudio_projects',
  
  // Export Templates - Uses exportTemplatesApi with localStorage fallback ✅
  EXPORT_TEMPLATES: 'virtualStudio_exportTemplates',
  
  // Auto-save - Uses backend API with localStorage for speed ✅
  AUTOSAVE: 'virtual-studio-autosave',
  
  // -------------------------------------------------------------------------
  // NEEDS MIGRATION TO DATABASE
  // -------------------------------------------------------------------------
  
  // Favorites - Should use preferencesApi.updateFavorites()
  FAVORITE_TEMPLATES: 'virtualStudio_favoriteTemplates',
  
  // Scene Snapshots - Should use snapshotsApi
  SNAPSHOTS: 'vs_snapshots',
  
  // Gear Presets - Needs new DB table or preferences
  GEAR_PRESETS: 'virtualStudio_gearPresets',
  
  // User Preferences - Should use preferencesApi
  PREFERENCES: 'virtualStudio_preferences',
  
  // Journey Seen Flag - Should be in preferences
  JOURNEY_SEEN: 'virtualStudio_journeySeen',
  
  // Brand Logo - Should be in preferences
  BRAND_LOGO: 'CH_BRAND_LOGO_DATAURL',
  
  // Room Templates - Needs DB table (virtualStudioTemplates already exists)
  ROOM_TEMPLATES: 'roomTemplates',
  
  // Asset Load State - Should be in preferences
  ASSET_LOAD_STATE: 'assetLoadState',
  
  // Color Grading Presets - Needs DB table or preferences
  COLOR_GRADING_PRESETS: 'colorGradingPresets',
  
  // Cinematic Light Patterns - Needs DB table or preferences
  CINEMATIC_PATTERNS: 'cinematicLightPatterns',
  
  // Community Shared Setups - Needs DB table
  COMMUNITY_SETUPS: 'communitySharedSetups',
  
  // Keyboard Shortcuts - Should be in preferences.customShortcuts
  CUSTOM_SHORTCUTS: 'virtualStudio_customShortcuts',
  
  // Recent Items - Should be in preferences.recentProjects/Scenes/Exports
  RECENT_PROJECTS: 'virtualStudio_recentProjects',
  RECENT_SCENES: 'virtualStudio_recentScenes',
  RECENT_EXPORTS: 'virtualStudio_recentExports',
};

// ============================================================================
// MIGRATION UTILITIES
// ============================================================================

/**
 * Migrate favorite templates to database
 */
export async function migrateFavoriteTemplates(): Promise<boolean> {
  try {
    const stored = localStorage.getItem(LOCALSTORAGE_KEYS.FAVORITE_TEMPLATES);
    if (!stored) return true;
    
    const favorites = JSON.parse(stored) as string[];
    await preferencesApi.updateFavorites('templates', favorites);
    
    // Keep localStorage as fallback but mark as migrated
    localStorage.setItem(`${LOCALSTORAGE_KEYS.FAVORITE_TEMPLATES}_migrated`'true');
    return true;
  } catch (e) {
    log.warn('Failed to migrate favorite templates: ', e);
    return false;
  }
}

/**
 * Migrate gear presets to database
 */
export async function migrateGearPresets(): Promise<boolean> {
  try {
    const stored = localStorage.getItem(LOCALSTORAGE_KEYS.GEAR_PRESETS);
    if (!stored) return true;
    
    const presets = JSON.parse(stored);
    
    // Save each preset as an animation clip with isTemplate=true
    for (const preset of presets) {
      await animationClipsApi.create({
        name: preset.name || 'Gear Preset',
        description: preset.description || 'Migrated from localStorage',
        duration: 0,
        tracks: [],
        loop: false,
        speed: 1,
        isTemplate: true,
        templateCategory: 'gear_preset',
      });
    }
    
    localStorage.setItem(`${LOCALSTORAGE_KEYS.GEAR_PRESETS}_migrated`'true');
    return true;
  } catch (e) {
    log.warn('Failed to migrate gear presets:', e);
    return false;
  }
}

/**
 * Migrate user preferences to database
 */
export async function migratePreferences(): Promise<boolean> {
  try {
    const stored = localStorage.getItem(LOCALSTORAGE_KEYS.PREFERENCES);
    if (!stored) return true;
    
    const prefs = JSON.parse(stored);
    
    await preferencesApi.update({
      theme: prefs.theme || 'dark',
      showGrid: prefs.showGrid ?? true,
      showHelpers: prefs.showHelpers ?? true,
      showMotionPaths: prefs.showMotionPaths ?? true,
      defaultResolution: prefs.defaultResolution || '1920x1080',
      defaultQuality: prefs.defaultQuality || 'high',
      defaultFps: prefs.defaultFps || 30,
      onboardingCompleted: true,
    });
    
    localStorage.setItem(`${LOCALSTORAGE_KEYS.PREFERENCES}_migrated`'true');
    return true;
  } catch (e) {
    log.warn('Failed to migrate preferences:', e);
    return false;
  }
}

/**
 * Migrate scene snapshots to database
 */
export async function migrateSnapshots(sceneId: string): Promise<boolean> {
  try {
    const stored = localStorage.getItem(LOCALSTORAGE_KEYS.SNAPSHOTS);
    if (!stored) return true;
    
    const snapshots = JSON.parse(stored);
    
    for (const snapshot of snapshots) {
      await snapshotsApi.create({
        sceneId,
        name: snapshot.name || `Snapshot ${new Date(snapshot.timestamp).toLocaleString()}`,
        description: snapshot.description,
        thumbnailUrl: snapshot.thumbnail,
        sceneState: snapshot.state,
        cameraState: snapshot.camera,
        nodeCount: snapshot.nodeCount,
        lightCount: snapshot.lightCount,
      });
    }
    
    localStorage.setItem(`${LOCALSTORAGE_KEYS.SNAPSHOTS}_migrated`'true');
    return true;
  } catch (e) {
    log.warn('Failed to migrate snapshots:', e);
    return false;
  }
}

/**
 * Migrate all localStorage data to database
 */
export async function migrateAllToDatabase(sceneId?: string): Promise<{
  success: boolean;
  migrated: string[];
  failed: string[];
}> {
  const migrated: string[] = [];
  const failed: string[] = [];
  
  // Migrate favorites
  if (await migrateFavoriteTemplates()) {
    migrated.push('favoriteTemplates');
  } else {
    failed.push('favoriteTemplates');
  }
  
  // Migrate gear presets
  if (await migrateGearPresets()) {
    migrated.push('gearPresets');
  } else {
    failed.push('gearPresets');
  }
  
  // Migrate preferences
  if (await migratePreferences()) {
    migrated.push('preferences');
  } else {
    failed.push('preferences');
  }
  
  // Migrate snapshots (requires sceneId)
  if (sceneId) {
    if (await migrateSnapshots(sceneId)) {
      migrated.push('snapshots');
    } else {
      failed.push('snapshots');
    }
  }
  
  return {
    success: failed.length === 0,
    migrated,
    failed,
  };
}

// ============================================================================
// HYBRID STORAGE HELPERS
// ============================================================================

/**
 * Get value with database-first, localStorage-fallback
 */
export async function getWithFallback<T>(
  key: string,
  dbFetcher: () => Promise<T | null>,
  defaultValue: T
): Promise<T> {
  try {
    // Try database first
    const dbValue = await dbFetcher();
    if (dbValue !== null) return dbValue;
    
    // Fallback to localStorage
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored) as T;
    
    return defaultValue;
  } catch {
    // Final fallback
    try {
      const stored = localStorage.getItem(key);
      if (stored) return JSON.parse(stored) as T;
    } catch {}
    return defaultValue;
  }
}

/**
 * Set value to both database and localStorage
 */
export async function setWithFallback<T>(
  key: string,
  value: T,
  dbSetter: (value: T) => Promise<void>
): Promise<void> {
  // Save to localStorage first (fast)
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
  
  // Then save to database
  try {
    await dbSetter(value);
  } catch (e) {
    log.warn(`Failed to save ${key} to database:`, e);
  }
}

// ============================================================================
// CLEANUP UTILITIES
// ============================================================================

/**
 * Clear all migrated localStorage data
 */
export function clearMigratedData(): void {
  Object.values(LOCALSTORAGE_KEYS).forEach((key) => {
    if (localStorage.getItem(`${key}_migrated`) === 'true') {
      localStorage.removeItem(key);
      localStorage.removeItem(`${key}_migrated, `);
    }
  });
}

/**
 * Get migration status
 */
export function getMigrationStatus(): Record<string, boolean> {
  const status: Record<string, boolean> = {};
  Object.entries(LOCALSTORAGE_KEYS).forEach(([name, key]) => {
    status[name] = localStorage.getItem(`${key}_migrated`) ==='true';
  });
  return status;
}

export default {
  KEYS: LOCALSTORAGE_KEYS,
  migrateFavoriteTemplates,
  migrateGearPresets,
  migratePreferences,
  migrateSnapshots,
  migrateAllToDatabase,
  getWithFallback,
  setWithFallback,
  clearMigratedData,
  getMigrationStatus,
};

