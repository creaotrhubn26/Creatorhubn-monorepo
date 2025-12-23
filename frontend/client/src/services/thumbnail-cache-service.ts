/**
 * THUMBNAIL CACHE SERVICE
 * Using idb-keyval for fast IndexedDB caching
 * Instant thumbnail loading like Premiere Pro
 */

import { set, get, del, clear, keys } from 'idb-keyval';

export interface ThumbnailMetadata {
  clipId: string;
  timestamp: number;
  width: number;
  height: number;
  frameNumber: number;
  dataUrl: string;
  size: number; // bytes
}

export class ThumbnailCacheService {
  private static readonly CACHE_PREFIX = 'thumbnail: ';
  private static readonly MAX_CACHE_SIZE = 500 * 1024 * 1024; // 500MB
  private static currentCacheSize = 0;
  
  /**
   * Cache thumbnail
   */
  static async cacheThumbnail(
    clipId: string,
    frameNumber: number,
    dataUrl: string,
    width: number,
    height: number
  ): Promise<void> {
    const key = `${this.CACHE_PREFIX}${clipId}:${frameNumber}`;
    
    const metadata: ThumbnailMetadata = {
      clipId,
      timestamp: Date.now(),
      width,
      height,
      frameNumber,
      dataUrl,
      size: dataUrl.length
    };
    
    // Check cache size
    this.currentCacheSize += metadata.size;
    
    if (this.currentCacheSize > this.MAX_CACHE_SIZE) {
      await this.evictOldest();
    }
    
    await set(key, metadata);
    console.log(`💾 Cached thumbnail: ${clipId} frame ${frameNumber}`);
  }
  
  /**
   * Get cached thumbnail
   */
  static async getThumbnail(clipId: string, frameNumber: number): Promise<ThumbnailMetadata | null> {
    const key = `${this.CACHE_PREFIX}${clipId}:${frameNumber}`;
    const cached = await get<ThumbnailMetadata>(key);
    
    if (cached) {
      console.log(`✅ Cache hit: ${clipId} frame ${frameNumber}`);
      return cached;
    }
    
    console.log(`⚠️ Cache miss: ${clipId} frame ${frameNumber}`);
    return null;
  }
  
  /**
   * Delete thumbnail
   */
  static async deleteThumbnail(clipId: string, frameNumber: number): Promise<void> {
    const key = `${this.CACHE_PREFIX}${clipId}:${frameNumber}`;
    await del(key);
  }
  
  /**
   * Delete all thumbnails for a clip
   */
  static async deleteClipThumbnails(clipId: string): Promise<void> {
    const allKeys = await keys();
    const clipKeys = allKeys.filter(k => 
      typeof k === 'string' && k.startsWith(`${this.CACHE_PREFIX}${clipId}:`)
    );
    
    await Promise.all(clipKeys.map(k => del(k)));
    console.log(`🗑️ Deleted ${clipKeys.length} thumbnails for clip ${clipId}`);
  }
  
  /**
   * Evict oldest thumbnails
   */
  private static async evictOldest(): Promise<void> {
    const allKeys = await keys();
    const thumbnailKeys = allKeys.filter(k => 
      typeof k === 'string' && k.startsWith(this.CACHE_PREFIX)
    );
    
    // Get all metadata
    const thumbnails = await Promise.all(
      thumbnailKeys.map(async key => ({
        key,
        metadata: await get<ThumbnailMetadata>(key)
      }))
    );
    
    // Sort by timestamp (oldest first)
    thumbnails.sort((a, b) => 
      (a.metadata?.timestamp || 0) - (b.metadata?.timestamp || 0)
    );
    
    // Delete oldest 25%
    const toDelete = Math.floor(thumbnails.length * 0.25);
    for (let i = 0; i < toDelete; i++) {
      if (thumbnails[i].key) {
        await del(thumbnails[i].key);
        this.currentCacheSize -= thumbnails[i].metadata?.size || 0;
      }
    }
    
    console.log(`🧹 Evicted ${toDelete} oldest thumbnails`);
  }
  
  /**
   * Clear all thumbnails
   */
  static async clearAll(): Promise<void> {
    const allKeys = await keys();
    const thumbnailKeys = allKeys.filter(k => 
      typeof k === 'string' && k.startsWith(this.CACHE_PREFIX)
    );
    
    await Promise.all(thumbnailKeys.map(k => del(k)));
    this.currentCacheSize = 0;
    
    console.log(`🗑️ Cleared all ${thumbnailKeys.length} thumbnails`);
  }
  
  /**
   * Get cache statistics
   */
  static async getCacheStats(): Promise<{
    thumbnailCount: number;
    totalSize: number;
    oldestTimestamp: number;
    newestTimestamp: number;
  }> {
    const allKeys = await keys();
    const thumbnailKeys = allKeys.filter(k => 
      typeof k ==='string' && k.startsWith(this.CACHE_PREFIX)
    );
    
    const thumbnails = await Promise.all(
      thumbnailKeys.map(k => get<ThumbnailMetadata>(k))
    );
    
    const validThumbnails = thumbnails.filter(t => t !== null && t !== undefined) as ThumbnailMetadata[];
    
    return {
      thumbnailCount: validThumbnails.length,
      totalSize: validThumbnails.reduce((sum, t) => sum + (t.size || 0), 0),
      oldestTimestamp: Math.min(...validThumbnails.map(t => t.timestamp)),
      newestTimestamp: Math.max(...validThumbnails.map(t => t.timestamp))
    };
  }
  
  /**
   * Batch cache thumbnails
   */
  static async batchCache(thumbnails: Array<{
    clipId: string;
    frameNumber: number;
    dataUrl: string;
    width: number;
    height: number;
  }>): Promise<void> {
    const promises = thumbnails.map(t => 
      this.cacheThumbnail(t.clipId, t.frameNumber, t.dataUrl, t.width, t.height)
    );
    
    await Promise.all(promises);
    console.log(`💾 Batch cached ${thumbnails.length} thumbnails`);
  }
}


