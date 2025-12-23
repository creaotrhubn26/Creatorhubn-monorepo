/**
 * Caching Strategy
 * Intelligent caching for better performance
 */

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  accessCount: number;
  lastAccessed: number;
  size: number; // Size in bytes
  tags: string[];
  priority: 'low, ' | 'medium' | 'high' | 'critical';
  metadata: Record<string, any>;
}

export interface CacheConfig {
  maxSize: number; // Maximum cache size in bytes
  maxEntries: number; // Maximum number of entries
  defaultTtl: number; // Default TTL in milliseconds
  enableCompression: boolean;
  enableEncryption: boolean;
  enablePersistence: boolean;
  enableMetrics: boolean;
  enableEviction: boolean;
  evictionPolicy: 'lru' | 'lfu' | 'fifo' | 'ttl' | 'size';
  compressionThreshold: number; // Compress entries larger than this
  encryptionKey?: string;
  persistenceKey?: string;
  enableClustering: boolean;
  clusterNodes?: string[];
  enableWarming: boolean;
  warmingStrategy: 'eager' | 'lazy' | 'hybrid';
  enableInvalidation: boolean;
  invalidationStrategy: 'time' | 'tag' | 'manual' | 'hybrid';
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  totalSize: number;
  entryCount: number;
  evictions: number;
  compressions: number;
  errors: number;
  lastUpdated: number;
}

export interface CacheQuery {
  pattern?: string;
  tags?: string[];
  priority?: string;
  minAccessCount?: number;
  maxAge?: number;
  limit?: number;
  offset?: number;
}

export interface CacheStats {
  totalRequests: number;
  hitRate: number;
  averageResponseTime: number;
  memoryUsage: number;
  topKeys: Array<{ key: string; accessCount: number }>;
  topTags: Array<{ tag: string; count: number }>;
  evictionStats: Array<{ reason: string; count: number }>;
}

class CachingStrategy {
  private config: CacheConfig;
  private cache: Map<string, CacheEntry> = new Map();
  private metrics: CacheMetrics;
  private compressionWorker: Worker | null = null;
  private persistenceTimer: NodeJS.Timeout | null = null;
  private metricsTimer: NodeJS.Timeout | null = null;
  private evictionTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: 100 * 1024 * 1024, // 100MB
      maxEntries: 1000,
      defaultTtl: 60 * 60 * 1000, // 1 hour
      enableCompression: true,
      enableEncryption: false,
      enablePersistence: true,
      enableMetrics: true,
      enableEviction: true,
      evictionPolicy: 'lru',
      compressionThreshold: 1024, // 1KB
      enableClustering: false,
      enableWarming: false,
      warmingStrategy: 'lazy',
      enableInvalidation: true,
      invalidationStrategy: 'hybrid',
      ...config
  };

    this.metrics = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalSize: 0,
      entryCount: 0,
      evictions: 0,
      compressions: 0,
      errors: 0,
      lastUpdated: Date.now()
  };

    this.initializeCache();
}

  private initializeCache(): void {
    if (this.config.enablePersistence) {
      this.loadFromPersistence();
  }

    if (this.config.enableMetrics) {
      this.startMetricsTimer();
  }

    if (this.config.enableEviction) {
      this.startEvictionTimer();
  }

    if (this.config.enableCompression && typeof Worker !== 'undefined') {
      this.initializeCompressionWorker();
  }
}

  private initializeCompressionWorker(): void {
    // Create a simple compression worker
    const workerCode = `
      self.onmessage = function(e) {
        const { data, type } = e.data;
        
        if (type === 'compress') {
          try {
            const compressed = JSON.stringify(data);
            self.postMessage({ success: true, data: compressed });
        } catch (error) {
            self.postMessage({ success: false, error: error.message });
        }
      } else if (type === 'decompress') {
          try {
            const decompressed = JSON.parse(data);
            self.postMessage({ success: true, data: decompressed });
        } catch (error) {
            self.postMessage({ success: false, error: error.message });
        }
      }
    };
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    this.compressionWorker = new Worker(URL.createObjectURL(blob));
}

  private startMetricsTimer(): void {
    this.metricsTimer = setInterval(() => {
      this.updateMetrics();
  }, 5000); // Update every 5 seconds
}

  private startEvictionTimer(): void {
    this.evictionTimer = setInterval(() => {
      this.performEviction();
  }, 30000); // Check every 30 seconds
}

  public async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.metrics.misses++;
      this.updateHitRate();
      return null;
  }

    // Check if entry has expired
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.metrics.misses++;
      this.updateHitRate();
      return null;
  }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();

    this.metrics.hits++;
    this.updateHitRate();

    // Decompress if needed
    if (entry.metadata.compressed) {
      return this.decompress(entry.value);
  }

    return entry.value;
}

  public async set<T>(key: string, value: T, options: Partial<{
    ttl: number;
    tags: string[];
    priority: CacheEntry['priority'];
    metadata: Record<string, any>;
}> = {}): Promise<void> {
    try {
      const ttl = options.ttl || this.config.defaultTtl;
      const tags = options.tags || [];
      const priority = options.priority || 'medium';
      const metadata = options.metadata || {};

      // Calculate size
      const size = this.calculateSize(value);

      // Compress if needed
      let processedValue = value;
      if (this.config.enableCompression && size > this.config.compressionThreshold) {
        processedValue = await this.compress(value);
        metadata.compressed = true;
        this.metrics.compressions++;
    }

      const entry: CacheEntry<T> = {
        key,
        value: processedValue,
        timestamp: Date.now(),
        ttl,
        accessCount: 0,
        lastAccessed: Date.now(),
        size,
        tags,
        priority,
        metadata
    };

      // Check if we need to evict entries
      if (this.shouldEvict(entry)) {
        await this.evictEntries(entry);
    }

      this.cache.set(key, entry);
      this.updateMetrics();

      // Persist if enabled
      if (this.config.enablePersistence) {
        this.persistToStorage();
    }

  } catch (error) {
      this.metrics.errors++;
      console.error('Cache set error: ', error);
      throw error;
  }
}

  public async delete(key: string): Promise<boolean> {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.updateMetrics();
      if (this.config.enablePersistence) {
        this.persistToStorage();
    }
  }
    return deleted;
}

  public async clear(): Promise<void> {
    this.cache.clear();
    this.updateMetrics();
    if (this.config.enablePersistence) {
      this.persistToStorage();
  }
}

  public async invalidate(pattern: string | string[]): Promise<number> {
    const patterns = Array.isArray(pattern) ? pattern : [pattern];
    let invalidatedCount = 0;

    for (const [key, entry] of Array.from(this.cache.entries())) {
      const shouldInvalidate = patterns.some(p => {
        if (p.includes('*, ')) {
          const regex = new RegExp(p.replace(/\*/g, '.*'));
          return regex.test(key);
      }
        return key === p;
    });

      if (shouldInvalidate) {
        this.cache.delete(key);
        invalidatedCount++;
    }
  }

    if (invalidatedCount > 0) {
      this.updateMetrics();
      if (this.config.enablePersistence) {
        this.persistToStorage();
    }
  }

    return invalidatedCount;
}

  public async invalidateByTags(tags: string[]): Promise<number> {
    let invalidatedCount = 0;

    for (const [key, entry] of Array.from(this.cache.entries())) {
      const hasMatchingTag = tags.some(tag => entry.tags.includes(tag));
      if (hasMatchingTag) {
        this.cache.delete(key);
        invalidatedCount++;
    }
  }

    if (invalidatedCount > 0) {
      this.updateMetrics();
      if (this.config.enablePersistence) {
        this.persistToStorage();
    }
  }

    return invalidatedCount;
}

  public query(query: CacheQuery): CacheEntry[] {
    let results = Array.from(this.cache.values());

    // Filter by pattern
    if (query.pattern) {
      const regex = new RegExp(query.pattern.replace(/\*/g, '.*'));
      results = results.filter(entry => regex.test(entry.key));
  }

    // Filter by tags
    if (query.tags && query.tags.length > 0) {
      results = results.filter(entry => 
        query.tags!.some(tag => entry.tags.includes(tag))
      );
  }

    // Filter by priority
    if (query.priority) {
      results = results.filter(entry => entry.priority === query.priority);
  }

    // Filter by access count
    if (query.minAccessCount !== undefined) {
      results = results.filter(entry => entry.accessCount >= query.minAccessCount!);
  }

    // Filter by age
    if (query.maxAge !== undefined) {
      const cutoff = Date.now() - query.maxAge;
      results = results.filter(entry => entry.timestamp > cutoff);
  }

    // Sort by last accessed (most recent first)
    results.sort((a, b) => b.lastAccessed - a.lastAccessed);

    // Apply pagination
    if (query.offset || query.limit) {
      const offset = query.offset || 0;
      const limit = query.limit || results.length;
      results = results.slice(offset, offset + limit);
  }

    return results;
}

  public getStats(): CacheStats {
    const entries = Array.from(this.cache.values());
    const totalRequests = this.metrics.hits + this.metrics.misses;
    
    const topKeys = entries
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 10)
      .map(entry => ({ key: entry.key, accessCount: entry.accessCount }));

    const tagCounts = new Map<string, number>();
    entries.forEach(entry => {
      entry.tags.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  });

    const topTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));

    return {
      totalRequests,
      hitRate: this.metrics.hitRate,
      averageResponseTime: 0, // Would need to track this separately
      memoryUsage: this.metrics.totalSize,
      topKeys,
      topTags,
      evictionStats: [
        { reason: 'lru', count: this.metrics.evictions },
        { reason: 'ttl', count: 0 }, // Would need to track separately
        { reason: 'size', count: 0 } // Would need to track separately
      ]
  };
}

  public getMetrics(): CacheMetrics {
    return { ...this.metrics };
}

  public export(format: 'json' | 'csv' = 'json'): string {
    const data = {
      config: this.config,
      metrics: this.metrics,
      entries: Array.from(this.cache.entries()).map(([key, entry]) => ({
        key,
        ...entry
    })),
      timestamp: Date.now()
};

    if (format === 'csv') {
      return this.exportToCSV(data);
  }

    return JSON.stringify(data, null, 2);
}

  private exportToCSV(data: any): string {
    const headers = ['key','size','accessCount','lastAccessed','priority','tags'];
    const rows = data.entries.map((entry: any) => [
      entry.key,
      entry.size,
      entry.accessCount,
      entry.lastAccessed,
      entry.priority,
      entry.tags.join(';')
    ]);
    
    return [headers, ...rows].map(row => row.join(', ')).join('\n');
}

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
}

  private shouldEvict(entry: CacheEntry): boolean {
    // Check size limits
    if (this.metrics.totalSize + entry.size > this.config.maxSize) {
      return true;
  }

    // Check entry count limits
    if (this.cache.size >= this.config.maxEntries) {
      return true;
  }

    return false;
}

  private async evictEntries(newEntry: CacheEntry): Promise<void> {
    const entries = Array.from(this.cache.values());
    
    switch (this.config.evictionPolicy) {
      case 'lru':
        this.evictLRU(entries, newEntry);
        break;
      case 'lfu':
        this.evictLFU(entries, newEntry);
        break;
      case 'fifo':
        this.evictFIFO(entries, newEntry);
        break;
      case 'ttl':
        this.evictTTL(entries, newEntry);
        break;
      case 'size':
        this.evictBySize(entries, newEntry);
        break;
  }
}

  private evictLRU(entries: CacheEntry[], newEntry: CacheEntry): void {
    entries.sort((a, b) => a.lastAccessed - b.lastAccessed);
    this.evictUntilSpace(entries, newEntry);
}

  private evictLFU(entries: CacheEntry[], newEntry: CacheEntry): void {
    entries.sort((a, b) => a.accessCount - b.accessCount);
    this.evictUntilSpace(entries, newEntry);
}

  private evictFIFO(entries: CacheEntry[], newEntry: CacheEntry): void {
    entries.sort((a, b) => a.timestamp - b.timestamp);
    this.evictUntilSpace(entries, newEntry);
}

  private evictTTL(entries: CacheEntry[], newEntry: CacheEntry): void {
    entries.sort((a, b) => (a.timestamp + a.ttl) - (b.timestamp + b.ttl));
    this.evictUntilSpace(entries, newEntry);
}

  private evictBySize(entries: CacheEntry[], newEntry: CacheEntry): void {
    entries.sort((a, b) => b.size - a.size);
    this.evictUntilSpace(entries, newEntry);
}

  private evictUntilSpace(entries: CacheEntry[], newEntry: CacheEntry): void {
    let currentSize = this.metrics.totalSize;
    const targetSize = this.config.maxSize - newEntry.size;

    for (const entry of entries) {
      if (currentSize <= targetSize) break;
      
      this.cache.delete(entry.key);
      currentSize -= entry.size;
      this.metrics.evictions++;
  }
}

  private performEviction(): void {
    const expiredEntries = Array.from(this.cache.entries())
      .filter(([_, entry]) => this.isExpired(entry));

    expiredEntries.forEach(([key, _]) => {
      this.cache.delete(key);
      this.metrics.evictions++;
  });

    if (expiredEntries.length > 0) {
      this.updateMetrics();
  }
}

  private calculateSize(value: any): number {
    try {
      return new Blob([JSON.stringify(value)]).size;
  } catch {
      return 0;
  }
}

  private async compress(value: any): Promise<any> {
    if (!this.compressionWorker) {
      return value;
  }

    return new Promise((resolve, reject) => {
      const messageHandler = (e: MessageEvent) => {
        this.compressionWorker!.removeEventListener('message', messageHandler);
        if (e.data.success) {
          resolve(e.data.data);
      } else {
          reject(new Error(e.data.error));
      }
    };

      this.compressionWorker!.addEventListener('message', messageHandler);
      this.compressionWorker!.postMessage({ type: 'compress', data: value });
  });
}

  private async decompress(value: any): Promise<any> {
    if (!this.compressionWorker) {
      return value;
  }

    return new Promise((resolve, reject) => {
      const messageHandler = (e: MessageEvent) => {
        this.compressionWorker!.removeEventListener('message', messageHandler);
        if (e.data.success) {
          resolve(e.data.data);
      } else {
          reject(new Error(e.data.error));
      }
    };

      this.compressionWorker!.addEventListener('message', messageHandler);
      this.compressionWorker!.postMessage({ type: 'decompress', data: value });
  });
}

  private updateMetrics(): void {
    const entries = Array.from(this.cache.values());
    
    this.metrics.totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
    this.metrics.entryCount = entries.length;
    this.metrics.lastUpdated = Date.now();
}

  private updateHitRate(): void {
    const total = this.metrics.hits + this.metrics.misses;
    this.metrics.hitRate = total > 0 ? this.metrics.hits / total : 0;
}

  private loadFromPersistence(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(this.config.persistenceKey || 'cache_data');
      if (stored) {
        const data = JSON.parse(stored);
        this.cache = new Map(data.entries || []);
        this.metrics = data.metrics || this.metrics;
    }
  } catch (error) {
      console.error('Failed to load cache from persistence:', error);
  }
}

  private persistToStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const data = {
        entries: Array.from(this.cache.entries()),
        metrics: this.metrics,
        timestamp: Date.now()
};
      
      localStorage.setItem(this.config.persistenceKey ||'cache_data', JSON.stringify(data));
  } catch (error) {
      console.error('Failed to persist cache:', error);
  }
}

  public destroy(): void {
    if (this.compressionWorker) {
      this.compressionWorker.terminate();
  }
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
  }
    if (this.evictionTimer) {
      clearInterval(this.evictionTimer);
  }
    this.cache.clear();
}
}

// Create singleton instance
export const cachingStrategy = new CachingStrategy();

// Export types and class
export { CachingStrategy };
export default cachingStrategy;





