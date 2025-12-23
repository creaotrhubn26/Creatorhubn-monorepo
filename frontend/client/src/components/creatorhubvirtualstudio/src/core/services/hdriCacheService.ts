/**
 * HDRI Cache Service
 * 
 * Hybrid caching system:
 * - Primary: Database persistence via API
 * - Secondary: IndexedDB for local/offline access
 * - Auto-sync between local and server
 * - Auto-start pre-caching on first visit
 */

import { logger } from './logger';

const log = logger.module('HDRICache, ');

// =============================================================================
// API Helper
// =============================================================================

async function apiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  const response = await fetch(endpoint, {
    ...options,
    credentials: 'include, ',
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

interface CachedHDRI {
  id: string;
  url: string;
  data: ArrayBuffer;
  size: number;
  cachedAt: number;
  lastAccessedAt: number;
  accessCount: number;
  source: 'polyhaven' | 'blenderkit' | 'custom';
}

interface CacheStats {
  totalSize: number;
  itemCount: number;
  oldestItem: number;
  newestItem: number;
  hitRate: number;
}

interface CacheConfig {
  maxSizeBytes: number;
  maxItems: number;
  expirationDays: number;
  dbName: string;
  storeName: string;
}

interface UserPreferences {
  autoPreCache: boolean;
  preCachePriority: 'essential' | 'recommended' | 'all';
  maxCacheSize: number;
  maxCacheItems: number;
  cacheExpirationDays: number;
  defaultHdriId: string | null;
  favoriteHdris: string[];
  recentHdris: string[];
  hasCompletedInitialPreCache: boolean;
  firstVisitAt: string | null;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_CONFIG: CacheConfig = {
  maxSizeBytes: 500 * 1024 * 1024, // 500 MB
  maxItems: 100,
  expirationDays: 30,
  dbName: 'VirtualStudio_HDRICache',
  storeName: 'hdris',
};

const API_BASE = '/api/hdri-cache';

// =============================================================================
// HDRI Cache Service
// =============================================================================

class HDRICacheService {
  private db: IDBDatabase | null = null;
  private config: CacheConfig;
  private hits: number = 0;
  private misses: number = 0;
  private initPromise: Promise<void> | null = null;
  private serverCachedIds: Set<string> = new Set();
  private preferences: UserPreferences | null = null;
  private isFirstVisit: boolean = false;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize both IndexedDB and server sync
   */
  async init(): Promise<void> {
    if (this.db && this.initPromise) return this.initPromise;
    
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      // Initialize IndexedDB for local caching
      await this.initIndexedDB();
      
      // Sync with server
      await this.syncWithServer();
      
      // Check if first visit and auto-start pre-caching
      await this.checkFirstVisit();
    })();

    return this.initPromise;
  }

  /**
   * Initialize IndexedDB
   */
  private async initIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        log.warn('IndexedDB not available');
        resolve();
        return;
      }

      const request = indexedDB.open(this.config.dbName, 1);

      request.onerror = () => {
        log.error('Failed to open database: ', request.error);
        resolve(); // Don't reject, continue with server-only mode
      };

      request.onsuccess = () => {
        this.db = request.result;
        log.debug('IndexedDB initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(this.config.storeName)) {
          const store = db.createObjectStore(this.config.storeName, { keyPath: 'id' });
          store.createIndex('url','url', { unique: false });
          store.createIndex('cachedAt', 'cachedAt', { unique: false });
          store.createIndex('lastAccessedAt', 'lastAccessedAt', { unique: false });
        }
      };
    });
  }

  /**
   * Sync with server to get cached HDRI IDs
   */
  private async syncWithServer(): Promise<void> {
    try {
      const response = await apiRequest(`${API_BASE}/ids`, { method: 'GET' });
      if (response.success && response.ids) {
        this.serverCachedIds = new Set(response.ids);
        log.debug(`Synced ${response.ids.length} cached IDs from server`);
      }
    } catch (error) {
      log.warn('Failed to sync with server, using local cache only');
    }
  }

  /**
   * Check if first visit and trigger auto pre-cache
   */
  private async checkFirstVisit(): Promise<void> {
    try {
      const response = await apiRequest(`${API_BASE}/preferences`, { method: 'GET' });
      if (response.success && response.preferences) {
        this.preferences = response.preferences;
        
        // Check if first visit (never completed initial pre-cache)
        if (!response.preferences.hasCompletedInitialPreCache && 
            response.preferences.autoPreCache) {
          this.isFirstVisit = true;
          log.info('First visit detected, will auto-start pre-caching');
          
          // Trigger auto pre-cache after a short delay
          setTimeout(() => {
            preCacheManager.autoStartOnIdle();
          }, 3000);
        }
      }
    } catch (error) {
      log.warn('Failed to fetch preferences');
    }
  }

  /**
   * Get cached HDRI by ID - checks local first, then server
   */
  async get(id: string): Promise<ArrayBuffer | null> {
    await this.init();
    
    // Try local IndexedDB first
    const localData = await this.getFromLocal(id);
    if (localData) {
      this.hits++;
      await this.recordHit();
      return localData;
    }

    // Not in local cache
    this.misses++;
    await this.recordMiss();
    return null;
  }

  /**
   * Get from local IndexedDB
   */
  private async getFromLocal(id: string): Promise<ArrayBuffer | null> {
    if (!this.db) return null;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(this.config.storeName'readwrite');
      const store = transaction.objectStore(this.config.storeName);
      const request = store.get(id);

      request.onsuccess = () => {
        const cached = request.result as CachedHDRI | undefined;
        
        if (!cached) {
          resolve(null);
          return;
        }

        // Check expiration
        const now = Date.now();
        const expirationMs = this.config.expirationDays * 24 * 60 * 60 * 1000;
        
        if (now - cached.cachedAt > expirationMs) {
          store.delete(id);
          resolve(null);
          return;
        }

        // Update access time
        cached.lastAccessedAt = now;
        cached.accessCount++;
        store.put(cached);

        log.debug(`Local cache hit: ${id}`);
        resolve(cached.data);
      };

      request.onerror = () => resolve(null);
    });
  }

  /**
   * Check if HDRI is cached (either local or server)
   */
  async has(id: string): Promise<boolean> {
    await this.init();
    
    // Check server cache first (source of truth)
    if (this.serverCachedIds.has(id)) {
      return true;
    }
    
    // Check local cache
    if (this.db) {
      return new Promise((resolve) => {
        const transaction = this.db!.transaction(this.config.storeName'readonly');
        const store = transaction.objectStore(this.config.storeName);
        const request = store.count(id);
        request.onsuccess = () => resolve(request.result > 0);
        request.onerror = () => resolve(false);
      });
    }
    
    return false;
  }

  /**
   * Store HDRI in cache (both local and server)
   */
  async set(
    id: string,
    url: string,
    data: ArrayBuffer,
    source: 'polyhaven' | 'blenderkit' | 'custom' = 'polyhaven'
  ): Promise<void> {
    await this.init();

    const size = data.byteLength;
    const now = Date.now();

    // Ensure space in local cache
    await this.ensureSpace(size);

    // Store locally
    if (this.db) {
      const cached: CachedHDRI = {
        id,
        url,
        data,
        size,
        cachedAt: now,
        lastAccessedAt: now,
        accessCount: 1,
        source,
      };

      await new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction(this.config.storeName'readwrite');
        const store = transaction.objectStore(this.config.storeName);
        const request = store.put(cached);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }

    // Store on server (metadata only, not the actual file data)
    try {
      await apiRequest(API_BASE, {
        method: 'POST',
        body: JSON.stringify({
          hdriId: id,
          url,
          source,
          size,
          metadata: { cachedAt: new Date().toISOString() },
        }),
      });
      this.serverCachedIds.add(id);
    } catch (error) {
      log.warn('Failed to sync cache to server: ', error);
    }

    log.debug(`Cached: ${id} (${this.formatSize(size)})`);
  }

  /**
   * Record cache hit on server
   */
  private async recordHit(): Promise<void> {
    try {
      await apiRequest(`${API_BASE}/stats/hit`, { method: 'POST' });
    } catch (error) {
      // Silently fail
    }
  }

  /**
   * Record cache miss on server
   */
  private async recordMiss(): Promise<void> {
    try {
      await apiRequest(`${API_BASE}/stats/miss`, { method: 'POST' });
    } catch (error) {
      // Silently fail
    }
  }

  /**
   * Ensure there's enough space for new item
   */
  private async ensureSpace(requiredSize: number): Promise<void> {
    const stats = await this.getStats();
    
    if (
      stats.totalSize + requiredSize > this.config.maxSizeBytes ||
      stats.itemCount >= this.config.maxItems
    ) {
      await this.evictLRU(requiredSize);
    }
  }

  /**
   * Evict least recently used items
   */
  private async evictLRU(requiredSize: number): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(this.config.storeName'readwrite');
      const store = transaction.objectStore(this.config.storeName);
      const index = store.index('lastAccessedAt');
      const request = index.openCursor();

      let freedSize = 0;
      let evictedCount = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result as IDBCursorWithValue;
        
        if (!cursor || freedSize >= requiredSize || evictedCount >= 5) {
          log.debug(`Evicted ${evictedCount} items, freed ${this.formatSize(freedSize)}`);
          resolve();
          return;
        }

        const item = cursor.value as CachedHDRI;
        freedSize += item.size;
        evictedCount++;
        cursor.delete();
        cursor.continue();
      };

      request.onerror = () => resolve();
    });
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    await this.init();
    
    const defaultStats: CacheStats = {
      totalSize: 0,
      itemCount: 0,
      oldestItem: Date.now(),
      newestItem: 0,
      hitRate: this.hits + this.misses > 0 
        ? this.hits / (this.hits + this.misses) 
        : 0,
    };

    if (!this.db) return defaultStats;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(this.config.storeName'readonly');
      const store = transaction.objectStore(this.config.storeName);
      const request = store.openCursor();

      const stats = { ...defaultStats };

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result as IDBCursorWithValue;
        
        if (!cursor) {
          resolve(stats);
          return;
        }

        const item = cursor.value as CachedHDRI;
        stats.totalSize += item.size;
        stats.itemCount++;
        stats.oldestItem = Math.min(stats.oldestItem, item.cachedAt);
        stats.newestItem = Math.max(stats.newestItem, item.cachedAt);

        cursor.continue();
      };

      request.onerror = () => resolve(stats);
    });
  }

  /**
   * Clear all cached HDRIs
   */
  async clear(): Promise<void> {
    await this.init();
    
    // Clear local
    if (this.db) {
      await new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction(this.config.storeName'readwrite');
        const store = transaction.objectStore(this.config.storeName);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }

    // Clear server
    try {
      await apiRequest(API_BASE, { method: 'DELETE' });
      this.serverCachedIds.clear();
    } catch (error) {
      log.warn('Failed to clear server cache');
    }

    this.hits = 0;
    this.misses = 0;
    log.info('Cache cleared');
  }

  /**
   * Get all cached HDRI IDs
   */
  async getCachedIds(): Promise<string[]> {
    await this.init();
    
    // Combine server and local IDs
    const localIds = new Set<string>();
    
    if (this.db) {
      await new Promise<void>((resolve) => {
        const transaction = this.db!.transaction(this.config.storeName'readonly');
        const store = transaction.objectStore(this.config.storeName);
        const request = store.getAllKeys();
        request.onsuccess = () => {
          (request.result as string[]).forEach(id => localIds.add(id));
          resolve();
        };
        request.onerror = () => resolve();
      });
    }

    // Merge with server IDs
    this.serverCachedIds.forEach(id => localIds.add(id));
    
    return Array.from(localIds);
  }

  /**
   * Get user preferences
   */
  async getPreferences(): Promise<UserPreferences | null> {
    if (this.preferences) return this.preferences;
    
    try {
      const response = await apiRequest(`${API_BASE}/preferences`, { method: 'GET' });
      if (response.success && response.preferences) {
        this.preferences = response.preferences;
        return this.preferences;
      }
    } catch (error) {
      log.warn('Failed to fetch preferences');
    }
    
    return null;
  }

  /**
   * Update user preferences
   */
  async updatePreferences(updates: Partial<UserPreferences>): Promise<void> {
    try {
      const response = await apiRequest(`${API_BASE}/preferences`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      if (response.success && response.preferences) {
        this.preferences = response.preferences;
      }
    } catch (error) {
      log.error('Failed to update preferences:', error);
    }
  }

  /**
   * Mark initial pre-cache as complete
   */
  async markInitialPreCacheComplete(): Promise<void> {
    await this.updatePreferences({ hasCompletedInitialPreCache: true });
  }

  /**
   * Format bytes to human readable
   */
  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  /**
   * Get hit rate percentage
   */
  getHitRate(): number {
    const total = this.hits + this.misses;
    return total > 0 ? (this.hits / total) * 100 : 0;
  }

  /**
   * Check if this is user's first visit
   */
  isUserFirstVisit(): boolean {
    return this.isFirstVisit;
  }
}

// =============================================================================
// Pre-Cache Configuration
// =============================================================================

export interface PreCacheItem {
  id: string;
  url: string;
  name: string;
  priority: 'essential' | 'recommended' | 'optional';
  category: string;
  source: 'polyhaven' | 'blenderkit' | 'custom';
}

// Essential HDRIs that should be pre-cached for best experience
export const PRE_CACHE_HDRIS: PreCacheItem[] = [
  // Essential - Studio basics (always pre-cache)
  {
    id: 'studio_small_03',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_03_1k.hdr',
    name: 'Studio Small 03',
    priority: 'essential',
    category: 'studio',
    source: 'polyhaven',
  },
  {
    id: 'studio_small_01',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_01_1k.hdr',
    name: 'Studio Small 01',
    priority: 'essential',
    category: 'studio',
    source: 'polyhaven',
  },
  {
    id: 'studio_small_08',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_08_1k.hdr',
    name: 'Studio Small 08 (High-key)',
    priority: 'essential',
    category: 'studio',
    source: 'polyhaven',
  },
  
  // Recommended - Common use cases
  {
    id: 'kiara_1_dawn',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/kiara_1_dawn_1k.hdr',
    name: 'Kiara Dawn',
    priority: 'recommended',
    category: 'outdoor',
    source: 'polyhaven',
  },
  {
    id: 'sunset_fairway',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/sunset_fairway_1k.hdr',
    name: 'Sunset Fairway',
    priority: 'recommended',
    category: 'sunset',
    source: 'polyhaven',
  },
  {
    id: 'moonlit_golf',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/moonlit_golf_1k.hdr',
    name: 'Moonlit Golf',
    priority: 'recommended',
    category: 'night',
    source: 'polyhaven',
  },
  {
    id: 'empty_warehouse_01',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/empty_warehouse_01_1k.hdr',
    name: 'Empty Warehouse',
    priority: 'recommended',
    category: 'indoor',
    source: 'polyhaven',
  },
  
  // School photography essentials
  {
    id: 'school_studio_soft',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_03_1k.hdr',
    name: 'School Studio (Soft)',
    priority: 'recommended',
    category: 'school',
    source: 'polyhaven',
  },
  {
    id: 'school_quad',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/school_quad_1k.hdr',
    name: 'School Courtyard',
    priority: 'recommended',
    category: 'school',
    source: 'polyhaven',
  },
  
  // Optional - Nice to have
  {
    id: 'cloudy_field',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/cloudy_field_1k.hdr',
    name: 'Cloudy Field',
    priority: 'optional',
    category: 'overcast',
    source: 'polyhaven',
  },
  {
    id: 'entrance_hall',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/entrance_hall_1k.hdr',
    name: 'Entrance Hall',
    priority: 'optional',
    category: 'indoor',
    source: 'polyhaven',
  },
  {
    id: 'music_hall_01',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/music_hall_01_1k.hdr',
    name: 'Music Hall',
    priority: 'optional',
    category: 'indoor',
    source: 'polyhaven',
  },
];

// =============================================================================
// Pre-Cache Manager
// =============================================================================

export interface PreCacheProgress {
  total: number;
  completed: number;
  failed: number;
  currentItem: string | null;
  isRunning: boolean;
  isPaused: boolean;
}

export type PreCacheProgressCallback = (progress: PreCacheProgress) => void;

class PreCacheManager {
  private cacheService: HDRICacheService;
  private progress: PreCacheProgress = {
    total: 0,
    completed: 0,
    failed: 0,
    currentItem: null,
    isRunning: false,
    isPaused: false,
  };
  private abortController: AbortController | null = null;
  private progressCallbacks: Set<PreCacheProgressCallback> = new Set();
  private idleCallbackId: number | null = null;

  constructor(cacheService: HDRICacheService) {
    this.cacheService = cacheService;
  }

  /**
   * Subscribe to progress updates
   */
  onProgress(callback: PreCacheProgressCallback): () => void {
    this.progressCallbacks.add(callback);
    callback(this.progress);
    return () => this.progressCallbacks.delete(callback);
  }

  /**
   * Notify all progress listeners
   */
  private notifyProgress(): void {
    this.progressCallbacks.forEach(cb => cb({ ...this.progress }));
  }

  /**
   * Get items that need to be pre-cached
   */
  async getItemsToCache(priority?: 'essential' | 'recommended' | 'optional'): Promise<PreCacheItem[]> {
    const items = priority 
      ? PRE_CACHE_HDRIS.filter(item => item.priority === priority)
      : PRE_CACHE_HDRIS;
    
    const cachedIds = await this.cacheService.getCachedIds();
    return items.filter(item => !cachedIds.includes(item.id));
  }

  /**
   * Start pre-caching in background
   */
  async startPreCache(
    priority: 'essential' | 'recommended' | 'optional' | 'all' = 'essential'
  ): Promise<void> {
    if (this.progress.isRunning) {
      log.debug('PreCache already running');
      return;
    }

    // Get items to cache based on priority
    let itemsToCache: PreCacheItem[];
    if (priority === 'all') {
      itemsToCache = await this.getItemsToCache();
    } else if (priority === 'recommended') {
      const essential = await this.getItemsToCache('essential');
      const recommended = await this.getItemsToCache('recommended');
      itemsToCache = [...essential, ...recommended];
    } else if (priority === 'optional') {
      itemsToCache = await this.getItemsToCache();
    } else {
      itemsToCache = await this.getItemsToCache('essential');
    }

    if (itemsToCache.length === 0) {
      log.debug('PreCache: All items already cached');
      // Mark initial pre-cache as complete
      await this.cacheService.markInitialPreCacheComplete();
      return;
    }

    this.abortController = new AbortController();
    this.progress = {
      total: itemsToCache.length,
      completed: 0,
      failed: 0,
      currentItem: null,
      isRunning: true,
      isPaused: false,
    };
    this.notifyProgress();

    log.info(`PreCache: Starting pre-cache of ${itemsToCache.length} items`);

    for (const item of itemsToCache) {
      if (this.abortController.signal.aborted) break;

      await this.waitForIdle();

      if (this.progress.isPaused) {
        await this.waitForResume();
      }

      if (this.abortController.signal.aborted) break;

      this.progress.currentItem = item.name;
      this.notifyProgress();

      try {
        await this.cacheItem(item);
        this.progress.completed++;
      } catch (error) {
        log.warn(`PreCache: Failed to cache ${item.id}:`, error);
        this.progress.failed++;
      }

      this.notifyProgress();
    }

    this.progress.isRunning = false;
    this.progress.currentItem = null;
    this.abortController = null;
    this.notifyProgress();

    // Mark initial pre-cache as complete
    if (this.progress.completed > 0) {
      await this.cacheService.markInitialPreCacheComplete();
    }

    log.info(`PreCache: Completed: ${this.progress.completed} cached, ${this.progress.failed} failed`);
  }

  /**
   * Wait for browser idle time
   */
  private waitForIdle(): Promise<void> {
    return new Promise(resolve => {
      if ('requestIdleCallback' in window) {
        this.idleCallbackId = requestIdleCallback(() => resolve(), { timeout: 5000 });
      } else {
        setTimeout(resolve, 100);
      }
    });
  }

  /**
   * Wait for resume if paused
   */
  private waitForResume(): Promise<void> {
    return new Promise(resolve => {
      const checkResume = () => {
        if (!this.progress.isPaused || this.abortController?.signal.aborted) {
          resolve();
        } else {
          setTimeout(checkResume, 500);
        }
      };
      checkResume();
    });
  }

  /**
   * Cache a single item
   */
  private async cacheItem(item: PreCacheItem): Promise<void> {
    if (await this.cacheService.has(item.id)) return;

    const response = await fetch(item.url, {
      signal: this.abortController?.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.arrayBuffer();
    await this.cacheService.set(item.id, item.url, data, item.source);
  }

  /**
   * Pause pre-caching
   */
  pause(): void {
    if (this.progress.isRunning) {
      this.progress.isPaused = true;
      this.notifyProgress();
      log.debug('PreCache: Paused');
    }
  }

  /**
   * Resume pre-caching
   */
  resume(): void {
    if (this.progress.isPaused) {
      this.progress.isPaused = false;
      this.notifyProgress();
      log.debug('PreCache: Resumed');
    }
  }

  /**
   * Stop pre-caching
   */
  stop(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
    if (this.idleCallbackId !== null &&'cancelIdleCallback' in window) {
      cancelIdleCallback(this.idleCallbackId);
    }
    this.progress.isRunning = false;
    this.progress.isPaused = false;
    this.notifyProgress();
    log.info('PreCache: Stopped');
  }

  /**
   * Get current progress
   */
  getProgress(): PreCacheProgress {
    return { ...this.progress };
  }

  /**
   * Check if pre-caching is needed
   */
  async needsPreCache(): Promise<{ essential: number; recommended: number; optional: number }> {
    const essential = await this.getItemsToCache('essential');
    const recommended = await this.getItemsToCache('recommended');
    const optional = await this.getItemsToCache('optional');
    
    return {
      essential: essential.length,
      recommended: recommended.length,
      optional: optional.length,
    };
  }

  /**
   * Auto-start pre-caching on idle (for first visit)
   */
  autoStartOnIdle(): void {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(async () => {
        const needs = await this.needsPreCache();
        if (needs.essential > 0) {
          log.info(`PreCache: Auto-starting: ${needs.essential} essential items to cache`);
          this.startPreCache('essential');
        }
      }, { timeout: 10000 });
    }
  }
}

// Singleton instances
export const hdriCacheService = new HDRICacheService();
export const preCacheManager = new PreCacheManager(hdriCacheService);

export default hdriCacheService;
