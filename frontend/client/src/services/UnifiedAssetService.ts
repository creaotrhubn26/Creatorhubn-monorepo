// @ts-nocheck
/**
 * UnifiedAssetService
 *
 * Centralized service for asset CRUD operations across:
 * - PhotographerPhotoSuite
 * - UniversalShowcase
 * - StoryArcStudio
 *
 * Handles:
 * - Asset creation, reading, updating, deletion
 * - Google Drive synchronization
 * - Cache management
 * - Real-time updates via CrossComponentEventBus
 */

import { apiRequest } from '@/lib/queryClient';
import type {
  MediaAsset,
  PhotoAsset,
  VideoAsset,
  MediaAssetType,
  AssetFilters,
  AssetSortOptions} from '../types/MediaAssetTypes';
import {
  AssetSortField,
  AssetSortOrder,
  AssetProcessingStatus,
  isPhotoAsset,
  isVideoAsset,
} from '../types/MediaAssetTypes';

export interface AssetUploadOptions {
  projectId?: string;
  clientId?: string;
  tags?: string[];
  isPublic?: boolean;
  clientVisible?: boolean;
  googleDriveFolder?: string;
}

export interface AssetQueryResult {
  assets: MediaAsset[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

class UnifiedAssetServiceClass {
  private cache: Map<string, MediaAsset> = new Map();
  private cacheTimestamps: Map<string, number> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private eventListeners: Map<string, Set<(asset: MediaAsset) => void>> = new Map();

  // ========================================
  // CRUD Operations
  // ========================================

  /**
   * Create a new asset
   */
  async createAsset(
    file: File,
    userId: string,
    options: AssetUploadOptions = {},
  ): Promise<MediaAsset> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', userId);

    if (options.projectId) formData.append('projectId', options.projectId);
    if (options.clientId) formData.append('clientId', options.clientId);
    if (options.tags) formData.append('tags', JSON.stringify(options.tags));
    if (options.isPublic !== undefined) formData.append('isPublic', String(options.isPublic));
    if (options.clientVisible !== undefined)
      formData.append('clientVisible', String(options.clientVisible));
    if (options.googleDriveFolder) formData.append('googleDriveFolder', options.googleDriveFolder);

    const response = await fetch('/api/assets/create', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to create asset');
    }

    const asset = (await response.json()) as MediaAsset;
    this.updateCache(asset);
    this.emit('created', asset);

    return asset;
  }

  /**
   * Get asset by ID
   */
  async getAsset(assetId: string, forceRefresh = false): Promise<MediaAsset | null> {
    // Check cache first
    if (!forceRefresh) {
      const cached = this.getCachedAsset(assetId);
      if (cached) return cached;
    }

    try {
      const asset = await apiRequest<MediaAsset>(`/api/assets/${assetId}`, {
        method: 'GET',
      });

      this.updateCache(asset);
      return asset;
    } catch (error) {
      console.error('Failed to get asset: ', error);
      return null;
    }
  }

  /**
   * Query assets with filters and pagination
   */
  async queryAssets(
    filters: AssetFilters = {},
    sort: AssetSortOptions = { field: AssetSortField.CREATED_AT, order: AssetSortOrder.DESC },
    page = 1,
    pageSize = 50,
  ): Promise<AssetQueryResult> {
    const queryParams = new URLSearchParams();

    if (filters.types) queryParams.append('types', filters.types.join(','));
    if (filters.projectId) queryParams.append('projectId', filters.projectId);
    if (filters.clientId) queryParams.append('clientId', filters.clientId);
    if (filters.uploadedBy) queryParams.append('uploadedBy', filters.uploadedBy);
    if (filters.tags) queryParams.append('tags', filters.tags.join(', '));
    if (filters.search) queryParams.append('search', filters.search);
    if (filters.processingStatus)
      queryParams.append('processingStatus', filters.processingStatus.join(', '));
    if (filters.source) queryParams.append('source', filters.source.join(', '));

    if (filters.dateRange) {
      queryParams.append('startDate', filters.dateRange.start.toISOString());
      queryParams.append('endDate', filters.dateRange.end.toISOString());
    }

    queryParams.append('sortField', sort.field);
    queryParams.append('sortOrder', sort.order);
    queryParams.append('page', String(page));
    queryParams.append('pageSize', String(pageSize));

    const result = await apiRequest<AssetQueryResult>(`/api/assets?${queryParams.toString()}`, {
      method: 'GET',
    });

    // Update cache with results
    result.assets.forEach((asset) => this.updateCache(asset));

    return result;
  }

  /**
   * Update asset
   */
  async updateAsset(assetId: string, updates: Partial<MediaAsset>): Promise<MediaAsset> {
    const asset = await apiRequest<MediaAsset>(`/api/assets/${assetId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
      headers: {
        'Content-Type' : 'application/json',
      },
    });

    this.updateCache(asset);
    this.emit('updated', asset);

    return asset;
  }

  /**
   * Delete asset
   */
  async deleteAsset(assetId: string): Promise<void> {
    await apiRequest(`/api/assets/${assetId}`, {
      method: 'DELETE',
    });

    const asset = this.cache.get(assetId);
    this.cache.delete(assetId);
    this.cacheTimestamps.delete(assetId);

    if (asset) {
      this.emit('deleted', asset);
    }
  }

  /**
   * Batch delete assets
   */
  async batchDeleteAssets(assetIds: string[]): Promise<void> {
    await apiRequest('/api/assets/batch-delete', {
      method: 'POST',
      body: JSON.stringify({ assetIds }),
      headers: {
        'Content-Type' : 'application/json',
      },
    });

    assetIds.forEach((id) => {
      const asset = this.cache.get(id);
      this.cache.delete(id);
      this.cacheTimestamps.delete(id);
      if (asset) {
        this.emit('deleted', asset);
      }
    });
  }

  // ========================================
  // Project-specific operations
  // ========================================

  /**
   * Get all assets for a project
   */
  async getProjectAssets(projectId: string, types?: MediaAssetType[]): Promise<MediaAsset[]> {
    const result = await this.queryAssets(
      { projectId, types },
      { field: AssetSortField.CREATED_AT, order: AssetSortOrder.DESC },
      1,
      1000, // Get all for now
    );

    return result.assets;
  }

  /**
   * Link asset to project
   */
  async linkToProject(assetId: string, projectId: string): Promise<MediaAsset> {
    return this.updateAsset(assetId, { projectId });
  }

  /**
   * Unlink asset from project
   */
  async unlinkFromProject(assetId: string): Promise<MediaAsset> {
    return this.updateAsset(assetId, { projectId: undefined });
  }

  // ========================================
  // Google Drive operations
  // ========================================

  /**
   * Sync asset with Google Drive
   */
  async syncWithGoogleDrive(assetId: string): Promise<MediaAsset> {
    const asset = await apiRequest<MediaAsset>(`/api/assets/${assetId}/sync-google-drive`, {
      method: 'POST',
    });

    this.updateCache(asset);
    return asset;
  }

  /**
   * Move asset to different Google Drive folder
   */
  async moveToGoogleDriveFolder(assetId: string, folderId: string): Promise<MediaAsset> {
    const asset = await apiRequest<MediaAsset>(`/api/assets/${assetId}/move-google-drive`, {
      method: 'POST',
      body: JSON.stringify({ folderId }),
      headers: {
        'Content-Type' : 'application/json',
      },
    });

    this.updateCache(asset);
    this.emit('updated', asset);

    return asset;
  }

  // ========================================
  // Processing operations
  // ========================================

  /**
   * Mark asset as processing
   */
  async markAsProcessing(assetId: string): Promise<MediaAsset> {
    return this.updateAsset(assetId, {
      processingStatus: AssetProcessingStatus.PROCESSING,
    });
  }

  /**
   * Mark asset processing as complete
   */
  async markAsCompleted(assetId: string, processedUrl?: string): Promise<MediaAsset> {
    const updates: Partial<MediaAsset> = {
      processingStatus: AssetProcessingStatus.COMPLETED,
    };

    if (processedUrl && isPhotoAsset((await this.getAsset(assetId)) as PhotoAsset)) {
      (updates as Partial<PhotoAsset>).processedUrl = processedUrl;
    } else if (processedUrl && isVideoAsset((await this.getAsset(assetId)) as VideoAsset)) {
      (updates as Partial<VideoAsset>).processedUrl = processedUrl;
    }

    return this.updateAsset(assetId, updates);
  }

  /**
   * Mark asset processing as failed
   */
  async markAsFailed(assetId: string, error: string): Promise<MediaAsset> {
    return this.updateAsset(assetId, {
      processingStatus: AssetProcessingStatus.FAILED,
      processingError: error,
    });
  }

  // ========================================
  // Metadata operations
  // ========================================

  /**
   * Update asset tags
   */
  async updateTags(assetId: string, tags: string[]): Promise<MediaAsset> {
    return this.updateAsset(assetId, { tags });
  }

  /**
   * Add tag to asset
   */
  async addTag(assetId: string, tag: string): Promise<MediaAsset> {
    const asset = await this.getAsset(assetId);
    if (!asset) throw new Error('Asset not found');

    const currentTags = asset.tags || [];
    if (currentTags.includes(tag)) return asset;

    return this.updateTags(assetId, [...currentTags, tag]);
  }

  /**
   * Remove tag from asset
   */
  async removeTag(assetId: string, tag: string): Promise<MediaAsset> {
    const asset = await this.getAsset(assetId);
    if (!asset) throw new Error('Asset not found');

    const currentTags = asset.tags || [];
    return this.updateTags(
      assetId,
      currentTags.filter((t) => t !== tag),
    );
  }

  // ========================================
  // Visibility operations
  // ========================================

  /**
   * Make asset public
   */
  async makePublic(assetId: string): Promise<MediaAsset> {
    return this.updateAsset(assetId, { isPublic: true });
  }

  /**
   * Make asset private
   */
  async makePrivate(assetId: string): Promise<MediaAsset> {
    return this.updateAsset(assetId, { isPublic: false });
  }

  /**
   * Make asset visible to client
   */
  async makeClientVisible(assetId: string): Promise<MediaAsset> {
    return this.updateAsset(assetId, { clientVisible: true });
  }

  /**
   * Hide asset from client
   */
  async hideFromClient(assetId: string): Promise<MediaAsset> {
    return this.updateAsset(assetId, { clientVisible: false });
  }

  // ========================================
  // Cache management
  // ========================================

  private updateCache(asset: MediaAsset): void {
    this.cache.set(asset.id, asset);
    this.cacheTimestamps.set(asset.id, Date.now());
  }

  private getCachedAsset(assetId: string): MediaAsset | null {
    const asset = this.cache.get(assetId);
    if (!asset) return null;

    const timestamp = this.cacheTimestamps.get(assetId);
    if (!timestamp || Date.now() - timestamp > this.CACHE_TTL) {
      this.cache.delete(assetId);
      this.cacheTimestamps.delete(assetId);
      return null;
    }

    return asset;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheTimestamps.clear();
  }

  /**
   * Clear cache for specific asset
   */
  clearAssetCache(assetId: string): void {
    this.cache.delete(assetId);
    this.cacheTimestamps.delete(assetId);
  }

  // ========================================
  // Event handling
  // ========================================

  /**
   * Subscribe to asset events
   */
  on(event: 'created' | 'updated' | 'deleted', callback: (asset: MediaAsset) => void): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }

    this.eventListeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.eventListeners.get(event)?.delete(callback);
    };
  }

  private emit(event: 'created' | 'updated' | 'deleted', asset: MediaAsset): void {
    const listeners = this.eventListeners.get(event);
    if (!listeners) return;

    listeners.forEach((callback) => {
      try {
        callback(asset);
      } catch (error) {
        console.error(`Error in ${event} listener:`, error);
      }
    });
  }

  // ========================================
  // Statistics
  // ========================================

  /**
   * Get asset statistics
   */
  async getStatistics(filters: AssetFilters = {}): Promise<{
    total: number;
    byType: Record<MediaAssetType, number>;
    byStatus: Record<AssetProcessingStatus, number>;
    totalSize: number;
  }> {
    const queryParams = new URLSearchParams();

    if (filters.projectId) queryParams.append('projectId', filters.projectId);
    if (filters.clientId) queryParams.append('clientId', filters.clientId);
    if (filters.uploadedBy) queryParams.append('uploadedBy', filters.uploadedBy);

    const stats = await apiRequest<{
      total: number;
      byType: Record<MediaAssetType, number>;
      byStatus: Record<AssetProcessingStatus, number>;
      totalSize: number;
    }>(`/api/assets/statistics?${queryParams.toString()}`, {
      method:'GET',
    });

    return stats;
  }
}

// Export singleton instance
export const unifiedAssetService = new UnifiedAssetServiceClass();
