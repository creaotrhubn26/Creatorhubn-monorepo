/**
 * Actor Model Cache Service
 * 
 * Caches pre-generated 3D human models in database for instant access.
 * Supports batch generation and persistent storage.
 * 
 * Backend: PostgreSQL via /api/virtual-studio/actors
 * Fallback: IndexedDB for offline support
 */

import { logger } from './logger';
import { virtualActorService, type ActorParameters, type ActorMeshData, type ActorPreset } from './virtualActorService';
import type { SKIN_TONES } from '../data/actorPresets';

const log = logger.module('ActorModelCache');

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5050';

// IndexedDB fallback
const DB_NAME = 'virtualstudio-actor-cache';
const DB_VERSION = 1;
const STORE_NAME = 'actors';

export interface CachedActor {
  id: string;
  presetId?: string;
  name: string;
  description: string;
  category: string;
  parameters: ActorParameters;
  meshData: ActorMeshData;
  skinTone: keyof typeof SKIN_TONES;
  thumbnail?: string;
  createdAt: number;
  modelVersion: string;
  
  // Extended properties for film characters
  appearance?: {
    skinTone?: string;
    hairStyle?: string;
    hairColor?: string;
    facialHair?: string;
    eyeColor?: string;
    facialExpression?: string;
  };
  costume?: {
    clothingStyle?: string;
    accessories?: string[];
  };
  metadata?: {
    genre?: string;
    era?: string;
    mood?: string;
  };
}

export interface GenerationProgress {
  total: number;
  completed: number;
  current: string;
  errors: string[];
}

/**
 * Default models to pre-generate (diverse selection - 20 models)
 */
export const DEFAULT_MODELS_TO_GENERATE = [
  // Essential diverse set - 20 models covering main demographics
  'portrait-female-young','portrait-male-young','portrait-mature-female','portrait-mature-male','portrait-female-30s','portrait-male-30s','commercial-average-female','commercial-average-male','fitness-female-athletic','fitness-male-bodybuilder','fashion-runway-female','fashion-runway-male','child-toddler','child-school-age','child-teen-female','child-teen-male','elder-female-60s','elder-male-60s','diverse-petite-female','diverse-curvy-female',
];

/**
 * Extended models for comprehensive library (all 84 presets)
 */
export const EXTENDED_MODELS_TO_GENERATE = [
  // Portrait (19)
  'portrait-female-young','portrait-male-young','portrait-mature-female','portrait-mature-male','portrait-female-30s','portrait-male-30s','portrait-female-50s','portrait-male-50s','diverse-petite-female','diverse-tall-female','diverse-curvy-female','diverse-stocky-male','diverse-lean-male','diverse-athletic-androgynous','portrait-artistic-musician','maternity-early','maternity-mid','maternity-late','special-plus-size-male',
  // Fashion (12)
  'fashion-runway-female','fashion-runway-male','fashion-plus-size','fashion-catalog-female','fashion-catalog-male','fashion-streetwear-female','fashion-streetwear-male','fashion-editorial-female','fashion-editorial-male','fashion-lingerie-female','fashion-fitness-male','fashion-mature-female',
  // Commercial (12)
  'commercial-average-female','commercial-average-male','business-executive-female','business-executive-male','business-young-professional-female','business-young-professional-male','medical-doctor-female','medical-nurse-male','commercial-teacher-female','commercial-teacher-male','commercial-service-worker','commercial-tech-worker',
  // Fitness (16)
  'fitness-female-athletic','fitness-male-bodybuilder','sports-swimmer-female','sports-swimmer-male','sports-basketball-male','sports-basketball-female','sports-gymnast-female','sports-gymnast-male','sports-runner-male','sports-runner-female','sports-weightlifter-female','sports-weightlifter-male','artistic-dancer-female','artistic-dancer-male','sports-yoga-female','special-bodybuilder-female',
  // Children (12)
  'child-infant','child-toddler','child-preschool-female','child-preschool-male','child-school-age','child-school-female','child-school-male','child-preteen-female','child-preteen-male','child-teen-female','child-teen-male','child-teen-athletic',
  // Elder (13)
  'elder-female-60s','elder-male-60s','elder-female-70s','elder-male-70s','elder-female-80s','elder-male-80s','elder-active-female','elder-active-male','elder-grandparent-female','elder-grandparent-male','special-petite-elder','special-tall-elder','special-athletic-senior',
];

class ActorModelCacheService {
  private db: IDBDatabase | null = null;
  private dbReady: Promise<void>;
  private presetsCache: ActorPreset[] | null = null;

  constructor() {
    this.dbReady = this.initIndexedDB();
  }

  // ============================================================================
  // DATABASE API METHODS (Primary)
  // ============================================================================

  /**
   * Fetch all presets from database
   */
  async getAllPresets(category?: string): Promise<ActorPreset[]> {
    try {
      const url = category && category !== 'all'
        ? `${API_BASE}/api/virtual-studio/actors/presets?category=${category}`
        : `${API_BASE}/api/virtual-studio/actors/presets`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch presets, ');
      
      const data = await response.json();
      this.presetsCache = data.presets;
      return data.presets;
    } catch (error) {
      log.warn('Database API unavailable, using local presets: ', error);
      // Fallback to local presets
      const { ACTOR_PRESETS } = await import('../data/actorPresets');
      return category && category !== 'all'
        ? ACTOR_PRESETS.filter(p => p.category === category)
        : ACTOR_PRESETS;
    }
  }

  /**
   * Get preset categories summary from database
   */
  async getPresetCategories(): Promise<{ total: number; categories: Record<string, number> }> {
    try {
      const response = await fetch(`${API_BASE}/api/virtual-studio/actors/presets/categories`);
      if (!response.ok) throw new Error('Failed to fetch categories');
      return await response.json();
    } catch (error) {
      log.warn('Database API unavailable:', error);
      const presets = await this.getAllPresets();
      const categories = presets.reduce((acc, p) => {
        acc[p.category] = (acc[p.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      return { total: presets.length, categories };
    }
  }

  /**
   * Get single preset from database
   */
  async getPreset(id: string): Promise<ActorPreset | null> {
    try {
      const response = await fetch(`${API_BASE}/api/virtual-studio/actors/presets/${id}`);
      if (!response.ok) return null;
      const data = await response.json();
      return data.preset;
    } catch (error) {
      log.warn('Database API unavailable:', error);
      const { getPresetById } = await import('../data/actorPresets');
      return getPresetById(id) || null;
    }
  }

  /**
   * Get all cached actors from database
   */
  async getAllCached(category?: string): Promise<CachedActor[]> {
    try {
      const url = category && category !== 'all'
        ? `${API_BASE}/api/virtual-studio/actors/cache?category=${category}`
        : `${API_BASE}/api/virtual-studio/actors/cache`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch cache');
      
      const data = await response.json();
      return data.actors;
    } catch (error) {
      log.warn('Database API unavailable, using IndexedDB fallback:', error);
      return this.getAllCachedFromIndexedDB();
    }
  }

  /**
   * Save actor to database cache
   */
  async saveActor(actor: CachedActor): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/api/virtual-studio/actors/cache`, {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify(actor),
      });
      
      if (!response.ok) throw new Error('Failed to save actor');
      log.debug('Actor saved to database:', actor.id);
    } catch (error) {
      log.warn('Database save failed, using IndexedDB fallback:', error);
      await this.saveActorToIndexedDB(actor);
    }
  }

  /**
   * Delete actor from database cache
   */
  async deleteActor(id: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/api/virtual-studio/actors/cache/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete actor');
    } catch (error) {
      log.warn('Database delete failed, using IndexedDB fallback:', error);
      await this.deleteActorFromIndexedDB(id);
    }
  }

  /**
   * Clear all cached actors from database
   */
  async clearAll(): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/api/virtual-studio/actors/cache`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to clear cache');
      log.info('Actor cache cleared from database');
    } catch (error) {
      log.warn('Database clear failed, using IndexedDB fallback:', error);
      await this.clearIndexedDB();
    }
  }

  /**
   * Get cache statistics from database
   */
  async getStats(): Promise<{ count: number; categories: Record<string, number> }> {
    try {
      const response = await fetch(`${API_BASE}/api/virtual-studio/actors/cache/stats`);
      if (!response.ok) throw new Error('Failed to fetch stats');
      return await response.json();
    } catch (error) {
      log.warn('Database API unavailable:', error);
      const actors = await this.getAllCachedFromIndexedDB();
      const categories: Record<string, number> = {};
      for (const actor of actors) {
        categories[actor.category] = (categories[actor.category] || 0) + 1;
      }
      return { count: actors.length, categories };
    }
  }

  // ============================================================================
  // INDEXEDDB FALLBACK METHODS
  // ============================================================================

  /**
   * Initialize IndexedDB for offline fallback
   */
  private async initIndexedDB(): Promise<void> {
    return new Promise((resolve) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        log.error('Failed to open IndexedDB:', request.error);
        resolve(); // Don't reject - we can still use database API
      };

      request.onsuccess = () => {
        this.db = request.result;
        log.debug('IndexedDB fallback initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('presetId','presetId', { unique: false });
          store.createIndex('category','category', { unique: false });
        }
      };
    });
  }

  private async ensureIndexedDB(): Promise<IDBDatabase | null> {
    await this.dbReady;
    return this.db;
  }

  private async getAllCachedFromIndexedDB(): Promise<CachedActor[]> {
    const db = await this.ensureIndexedDB();
    if (!db) return [];
    
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  }

  private async saveActorToIndexedDB(actor: CachedActor): Promise<void> {
    const db = await this.ensureIndexedDB();
    if (!db) return;
    
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.put(actor);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    });
  }

  private async deleteActorFromIndexedDB(id: string): Promise<void> {
    const db = await this.ensureIndexedDB();
    if (!db) return;
    
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    });
  }

  private async clearIndexedDB(): Promise<void> {
    const db = await this.ensureIndexedDB();
    if (!db) return;
    
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    });
  }

  // ============================================================================
  // LEGACY COMPATIBILITY METHODS
  // ============================================================================

  async getCached(id: string): Promise<CachedActor | null> {
    const actors = await this.getAllCached();
    return actors.find(a => a.id === id) || null;
  }

  async getByCategory(category: string): Promise<CachedActor[]> {
    return this.getAllCached(category);
  }

  /**
   * Check if preset is cached
   */
  async isPresetCached(presetId: string): Promise<boolean> {
    const actors = await this.getAllCached();
    return actors.some(a => a.presetId === presetId);
  }

  /**
   * Generate and cache a single actor from preset
   */
  async generateFromPreset(
    presetId: string,
    skinTone: keyof typeof SKIN_TONES = 'medium'
  ): Promise<CachedActor | null> {
    // Fetch preset from database
    const preset = await this.getPreset(presetId);
    if (!preset) {
      log.warn('Preset not found:', presetId);
      return null;
    }

    try {
      // Generate mesh from Anny
      const meshData = await virtualActorService.generateActor(preset.parameters);

      // Use preset skin tone if available (for film characters)
      const effectiveSkinTone = (preset.appearance?.skinTone as keyof typeof SKIN_TONES) || skinTone;

      const cachedActor: CachedActor = {
        id: `cached-${presetId}-${Date.now()}`,
        presetId: preset.id,
        name: preset.name,
        description: preset.description || '',
        category: preset.category,
        parameters: preset.parameters,
        meshData,
        skinTone: effectiveSkinTone,
        createdAt: Date.now(),
        modelVersion: meshData.model || 'anny-0.2.0',
        // Include extended properties for film characters
        appearance: preset.appearance,
        costume: preset.costume,
        metadata: preset.metadata,
      };

      await this.saveActor(cachedActor);
      return cachedActor;
    } catch (error) {
      log.error('Failed to generate actor from preset', { presetId, error });
      return null;
    }
  }

  /**
   * Batch generate multiple actors with progress callback
   */
  async batchGenerate(
    presetIds: string[],
    onProgress?: (progress: GenerationProgress) => void,
    skinTones?: (keyof typeof SKIN_TONES)[]
  ): Promise<GenerationProgress> {
    const progress: GenerationProgress = {
      total: presetIds.length,
      completed: 0,
      current: '',
      errors: [],
    };

    // Determine skin tones - cycle through if not provided
    const defaultSkinTones: (keyof typeof SKIN_TONES)[] = ['fair','medium','olive','brown','dark'];
    const tonesToUse = skinTones || defaultSkinTones;

    // Pre-fetch all presets for progress display
    const allPresets = await this.getAllPresets();
    const presetsMap = new Map(allPresets.map(p => [p.id, p]));

    for (let i = 0; i < presetIds.length; i++) {
      const presetId = presetIds[i];
      const preset = presetsMap.get(presetId);
      
      progress.current = preset?.name || presetId;
      onProgress?.(progress);

      try {
        // Use cycling skin tone for diversity
        const skinTone = tonesToUse[i % tonesToUse.length];
        await this.generateFromPreset(presetId, skinTone);
        progress.completed++;
      } catch (error) {
        progress.errors.push(`${presetId}: ${error}`);
        log.error('Batch generation error', { presetId, error });
      }

      onProgress?.(progress);

      // Small delay to prevent overwhelming the ML service
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    progress.current = '';
    onProgress?.(progress);

    log.info('Batch generation complete:', {
      total: progress.total,
      completed: progress.completed,
      errors: progress.errors.length,
    });

    return progress;
  }

  /**
   * Generate default model library (20 diverse models)
   */
  async generateDefaultLibrary(
    onProgress?: (progress: GenerationProgress) => void
  ): Promise<GenerationProgress> {
    log.info('Generating default actor library (20 models)...');
    return this.batchGenerate(DEFAULT_MODELS_TO_GENERATE, onProgress);
  }

  /**
   * Generate extended model library (all 84 presets from database)
   */
  async generateExtendedLibrary(
    onProgress?: (progress: GenerationProgress) => void
  ): Promise<GenerationProgress> {
    log.info('Generating extended actor library...');
    
    // Get already cached presets
    const cached = await this.getAllCached();
    const cachedPresetIds = new Set(cached.map(a => a.presetId).filter(Boolean));
    
    // Only generate missing ones
    const missing = EXTENDED_MODELS_TO_GENERATE.filter(id => !cachedPresetIds.has(id));
    
    if (missing.length === 0) {
      log.info('Extended library already complete');
      return {
        total: EXTENDED_MODELS_TO_GENERATE.length,
        completed: EXTENDED_MODELS_TO_GENERATE.length,
        current: ', ',
        errors: [],
      };
    }

    return this.batchGenerate(missing, onProgress);
  }

  /**
   * Generate ALL presets from database (84 presets)
   */
  async generateFullLibrary(
    onProgress?: (progress: GenerationProgress) => void
  ): Promise<GenerationProgress> {
    log.info('Generating full actor library from database...');
    
    // Fetch all presets from database
    const allPresets = await this.getAllPresets();
    const allPresetIds = allPresets.map(p => p.id);
    
    // Get already cached presets
    const cached = await this.getAllCached();
    const cachedPresetIds = new Set(cached.map(a => a.presetId).filter(Boolean));
    
    // Only generate missing ones
    const missing = allPresetIds.filter(id => !cachedPresetIds.has(id));
    
    if (missing.length === 0) {
      log.info('Full library already complete');
      return {
        total: allPresets.length,
        completed: allPresets.length,
        current:'',
        errors: [],
      };
    }

    return this.batchGenerate(missing, onProgress);
  }
}

export const actorModelCache = new ActorModelCacheService();
