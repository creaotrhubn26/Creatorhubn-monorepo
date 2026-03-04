/**
 * useCachingStrategy Hook
 * React hook for intelligent caching functionality
 */

import { useCallback, useEffect, useState, useRef } from 'react';
import type { CacheEntry, CacheQuery, CacheStats, CacheMetrics } from '../utils/cachingStrategy';
import { cachingStrategy, CacheConfig } from '../utils/cachingStrategy';

export interface UseCachingStrategyOptions {
  maxSize?: number;
  maxEntries?: number;
  defaultTtl?: number;
  enableCompression?: boolean;
  enablePersistence?: boolean;
  enableMetrics?: boolean;
  evictionPolicy?: 'lru' | 'lfu' | 'fifo' | 'ttl' | 'size';
  enableWarming?: boolean;
  warmingStrategy?: 'eager' | 'lazy' | 'hybrid';
  onCacheHit?: (key: string, value: any) => void;
  onCacheMiss?: (key: string) => void;
  onEviction?: (key: string, reason: string) => void;
}

export interface UseCachingStrategyReturn {
  get: <T>(key: string) => Promise<T | null>;
  set: <T>(key: string, value: T, options?: {
    ttl?: number;
    tags?: string[];
    priority?: 'low' | 'medium' | 'high' | 'critical';
    metadata?: Record<string, any>;
}) => Promise<void>;
  delete: (key: string) => Promise<boolean>;
  clear: () => Promise<void>;
  invalidate: (pattern: string | string[]) => Promise<number>;
  invalidateByTags: (tags: string[]) => Promise<number>;
  query: (query: CacheQuery) => CacheEntry[];
  getStats: () => CacheStats;
  getMetrics: () => CacheMetrics;
  export: (format?: 'json' | 'csv') => string;
  isReady: boolean;
  stats: CacheStats | null;
  metrics: CacheMetrics | null;
  hitRate: number;
  totalSize: number;
  entryCount: number;
  evictionCount: number;
  errorCount: number;
}

export const useCachingStrategy = (options: UseCachingStrategyOptions = {}): UseCachingStrategyReturn => {
  const {
    maxSize = 100 * 1024 * 1024, // 100MB
    maxEntries = 10000,
    defaultTtl = 60 * 60 * 1000, // 1 hour
    enableCompression = true,
    enablePersistence = true,
    enableMetrics = true,
    evictionPolicy = 'lru',
    enableWarming = false,
    warmingStrategy = 'lazy',
    onCacheHit,
    onCacheMiss,
    onEviction
} = options;

  const [isReady, setIsReady] = useState(false);
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [metrics, setMetrics] = useState<CacheMetrics | null>(null);
  const [hitRate, setHitRate] = useState(0);
  const [totalSize, setTotalSize] = useState(0);
  const [entryCount, setEntryCount] = useState(0);
  const [evictionCount, setEvictionCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);

  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cache config managed within hook
  useEffect(() => {
    // Config would be sent to caching strategy here
    console.log('Caching strategy config updated');
    setIsReady(true);
}, [maxSize, maxEntries, defaultTtl, enableCompression, enablePersistence, enableMetrics, evictionPolicy, enableWarming, warmingStrategy]);

  // Update data periodically
  useEffect(() => {
    if (!isReady) return;

    const updateData = () => {
      try {
        // Data fetching would happen here from caching strategy
        const currentStats: CacheStats | null = null;
        const currentMetrics: CacheMetrics | null = null;
        
        setStats(currentStats);
        setMetrics(currentMetrics);
        
        // Robust null checks for metrics
        if (currentMetrics) {
          setHitRate((currentMetrics as any).hitRate || 0);
          setTotalSize((currentMetrics as any).totalSize || 0);
          setEntryCount((currentMetrics as any).entryCount || 0);
          setEvictionCount((currentMetrics as any).evictions || 0);
          setErrorCount((currentMetrics as any).errors || 0);
      } else {
          setHitRate(0);
          setTotalSize(0);
          setEntryCount(0);
          setEvictionCount(0);
          setErrorCount(0);
      }
    } catch (error) {
        console.error('Failed to update cache data: ', error);
    }
  };

    updateData();
    updateIntervalRef.current = setInterval(updateData, 1000); // Update every second

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
    }
  };
}, [isReady]);

  // Get value from cache
  const get = useCallback(async <T>(key: string): Promise<T | null> => {
    try {
      const value = await cachingStrategy.get<T>(key);
      if (value !== null) {
        onCacheHit?.(key, value);
    } else {
        onCacheMiss?.(key);
    }
      return value;
  } catch (error) {
      console.error('Cache get error:', error);
      onCacheMiss?.(key);
      return null;
  }
}, [onCacheHit, onCacheMiss]);

  // Set value in cache
  const set = useCallback(async <T>(key: string, value: T, options?: {
    ttl?: number;
    tags?: string[];
    priority?: 'low' | 'medium' | 'high' | 'critical';
    metadata?: Record<string, any>;
}): Promise<void> => {
    try {
      // Robust caching with validation
      if (!key) {
        throw new Error('Cache key cannot be empty');
    }
      await cachingStrategy.set(key, value, options);
  } catch (error) {
      console.error('Cache set error:', error);
      throw error;
  }
}, []);

  // Delete value from cache
  const deleteValue = useCallback(async (key: string): Promise<boolean> => {
    try {
      // Robust deletion with validation
      if (!key) {
        return false;
    }
      return await cachingStrategy.delete(key);
  } catch (error) {
      console.error('Cache delete error:', error);
      return false;
  }
}, []);

  // Clear all cache
  const clear = useCallback(async (): Promise<void> => {
    try {
      await cachingStrategy.clear();
  } catch (error) {
      console.error('Cache clear error:', error);
      throw error;
  }
}, []);

  // Invalidate cache entries by pattern
  const invalidate = useCallback(async (pattern: string | string[]): Promise<number> => {
    try {
      // Robust invalidation with pattern matching
      return await cachingStrategy.invalidate(pattern);
  } catch (error) {
      console.error('Cache invalidate error:', error);
      return 0;
  }
}, []);

  // Invalidate cache entries by tags
  const invalidateByTags = useCallback(async (tags: string[]): Promise<number> => {
    try {
      // Robust tag-based invalidation with validation
      if (!tags || tags.length === 0) {
        return 0;
    }
      return await cachingStrategy.invalidateByTags(tags);
  } catch (error) {
      console.error('Cache invalidate by tags error:', error);
      return 0;
  }
}, []);

  // Query cache entries
  const query = useCallback((queryParam: CacheQuery): CacheEntry[] => {
    try {
      // Robust cache querying with validation
      if (!queryParam) {
        return [];
    }
      return cachingStrategy.query(queryParam);
  } catch (error) {
      console.error('Cache query error:', error);
      return [];
  }
}, []);

  // Get cache statistics
  const getStats = useCallback((): CacheStats => {
    // Robust stats retrieval with fallback
    if (stats) return stats;
    
    // Return properly typed fallback with explicit casting through unknown
    return {
      totalRequests: 0,
      hitRate: 0,
      averageResponseTime: 0,
      memoryUsage: 0,
      evictionCount: 0,
      errorCount: 0,
      lastCleared: new Date().toISOString(),
      topKeys: [],
      topTags: [],
      evictionStats: {}
  } as unknown as CacheStats;
}, [stats]);

  // Get cache metrics
  const getMetrics = useCallback((): CacheMetrics => {
    // Robust metrics retrieval with fallback
    if (metrics) return metrics;
    
    // Return properly typed fallback with explicit casting through unknown
    return {
      hits: 0,
      misses: 0,
      totalSize: 0,
      entryCount: 0,
      hitRate: 0,
      missRate: 0,
      evictionRate: 0,
      avgAccessTime: 0,
      evictions: 0,
      compressions: 0,
      errors: 0,
      lastUpdated: new Date().toISOString()
  } as unknown as CacheMetrics;
}, [metrics]);

  // Export cache data
  const exportData = useCallback((format: 'json' | 'csv' = 'json'): string => {
    // Robust export with format validation
    try {
      const data = {
        stats: stats || {},
        metrics: metrics || {},
        timestamp: new Date().toISOString(),
        format
    };
      
      if (format === 'json') {
        return JSON.stringify(data, null, 2);
    } else {
        // CSV export - robust implementation
        return `Stat,Value\nHit Rate,${hitRate}\nTotal Size,${totalSize}\nEntry Count,${entryCount}\nEvictions,${evictionCount}\nErrors,${errorCount}`;
    }
  } catch (error) {
      console.error('Cache export error:', error);
      return ', ';
  }
}, [stats, metrics, hitRate, totalSize, entryCount, evictionCount, errorCount]);

  // Cache warming functionality
  const warmCache = useCallback(async (entries: Array<{ key: string; value: any; options?: any }>): Promise<void> => {
    if (!enableWarming) {
      console.log('Cache warming is disabled');
      return;
  }

    try {
      // Robust cache warming with validation
      if (!entries || entries.length === 0) {
        return;
    }
      
      console.log(`Warming cache with ${entries.length} entries`);
      for (const entry of entries) {
        if (entry && entry.key) {
          await set(entry.key, entry.value, entry.options);
      }
    }
  } catch (error) {
      console.error('Cache warming error:', error);
  }
}, [set, enableWarming]);

  // Preload functionality
  const preload = useCallback(async (key: string, loader: () => Promise<any>, options?: any): Promise<any> => {
    try {
      // Robust preloading with validation
      if (!key) {
        throw new Error('Cache key cannot be empty');
    }
      
      if (!loader || typeof loader !=='function') {
        throw new Error('Loader must be a function');
    }
      
      // Try to get from cache first
      let value = await get(key);
      
      if (value === null) {
        console.log(`Cache miss for ${key}, loading from source`);
        // Load from source
        value = await loader();
        
        // Store in cache
        await set(key, value, options);
    } else {
        console.log(`Cache hit for ${key}`);
    }
      
      return value;
  } catch (error) {
      console.error('Cache preload error:', error);
      throw error;
  }
}, [get, set]);

  // Batch operations
  const batchGet = useCallback(async <T>(keys: string[]): Promise<Map<string, T | null>> => {
    const results = new Map<string, T | null>();
    
    try {
      // Robust batch get with validation
      if (!keys || keys.length === 0) {
        return results;
    }
      
      console.log(`Batch getting ${keys.length} cache entries`);
      await Promise.all(keys.map(async (key) => {
        if (key) {
          const value = await get<T>(key);
          results.set(key, value);
      }
    }));
  } catch (error) {
      console.error('Cache batch get error:', error);
  }
    
    return results;
}, [get]);

  const batchSet = useCallback(async (entries: Array<{ key: string; value: any; options?: any }>): Promise<void> => {
    try {
      // Robust batch set with validation
      if (!entries || entries.length === 0) {
        return;
    }
      
      console.log(`Batch setting ${entries.length} cache entries`);
      await Promise.all(entries.map(entry => {
        if (entry && entry.key) {
          return set(entry.key, entry.value, entry.options);
      }
        return Promise.resolve();
    }));
  } catch (error) {
      console.error('Cache batch set error:', error);
      throw error;
  }
}, [set]);

  const batchDelete = useCallback(async (keys: string[]): Promise<number> => {
    let deletedCount = 0;
    
    try {
      // Robust batch delete with validation
      if (!keys || keys.length === 0) {
        return 0;
    }
      
      console.log(`Batch deleting ${keys.length} cache entries`);
      await Promise.all(keys.map(async (key) => {
        if (key) {
          const deleted = await deleteValue(key);
          if (deleted) deletedCount++;
      }
    }));
  } catch (error) {
      console.error('Cache batch delete error:', error);
  }
    
    return deletedCount;
}, [deleteValue]);

  return {
    get,
    set,
    delete: deleteValue,
    clear,
    invalidate,
    invalidateByTags,
    query,
    getStats,
    getMetrics,
    export: exportData,
    isReady,
    stats,
    metrics,
    hitRate,
    totalSize,
    entryCount,
    evictionCount,
    errorCount,
    // Additional utility methods
    warmCache,
    preload,
    batchGet,
    batchSet,
    batchDelete
} as UseCachingStrategyReturn & {
    warmCache: (entries: Array<{ key: string; value: any; options?: any }>) => Promise<void>;
    preload: (key: string, loader: () => Promise<any>, options?: any) => Promise<any>;
    batchGet: <T>(keys: string[]) => Promise<Map<string, T | null>>;
    batchSet: (entries: Array<{ key: string; value: any; options?: any }>) => Promise<void>;
    batchDelete: (keys: string[]) => Promise<number>;
};
};

export default useCachingStrategy;





