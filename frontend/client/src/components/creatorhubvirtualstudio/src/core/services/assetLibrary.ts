// Asset Library Service - Connects to backend API for AI-generated assets

import { logger } from './logger';

const log = logger.module('AssetLibrary');

export interface AssetLibraryItem {
  id: string;
  user_id: string | null;
  name: string;
  description: string | null;
  category: 'light' | 'light_shaper' | 'accessory' | 'prop' | 'furniture';
  subcategory: string | null;
  model_url: string;
  thumbnail_url: string | null;
  tags: string[];
  metadata: any;
  is_system: boolean;
  is_public: boolean;
  download_count: number;
  created_at: string;
  updated_at: string;
}

export interface AssetLibraryFilters {
  category?: string;
  subcategory?: string;
  search?: string;
  is_system?: boolean;
  user_only?: boolean;
  limit?: number;
  offset?: number;
}

class AssetLibraryService {
  private baseURL = '/api/assets';

  async getAssets(filters: AssetLibraryFilters = {}): Promise<AssetLibraryItem[]> {
    try {
      const params = new URLSearchParams();
      
      if (filters.category) params.append('category', filters.category);
      if (filters.subcategory) params.append('subcategory', filters.subcategory);
      if (filters.search) params.append('search', filters.search);
      if (filters.is_system !== undefined) params.append('is_system', String(filters.is_system));
      if (filters.user_only !== undefined) params.append('user_only', String(filters.user_only));
      if (filters.limit) params.append('limit', String(filters.limit));
      if (filters.offset) params.append('offset', String(filters.offset));

      const response = await fetch(`${this.baseURL}/library?${params}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch assets: ${response.statusText}`);
      }

      const data = await response.json();
      return data.assets || [];
    } catch (error) {
      log.error('Error fetching assets: ', error);
      return [];
    }
  }

  async getAssetById(id: string): Promise<AssetLibraryItem | null> {
    try {
      const response = await fetch(`${this.baseURL}/library/${id}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch asset: ${response.statusText}`);
      }

      const data = await response.json();
      return data.asset || null;
    } catch (error) {
      log.error('Error fetching asset:', error);
      return null;
    }
  }

  async toggleFavorite(assetId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/favorites/${assetId}`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to toggle favorite: ${response.statusText}`);
      }

      const data = await response.json();
      return data.isFavorite || false;
    } catch (error) {
      log.error('Error toggling favorite:', error);
      return false;
    }
  }

  async getFavorites(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseURL}/favorites, `, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch favorites: ${response.statusText}`);
      }

      const data = await response.json();
      return (data.favorites || []).map((f: any) => f.asset_id);
    } catch (error) {
      log.error('Error fetching favorites:', error);
      return [];
    }
  }

  async trackUsage(assetId: string): Promise<void> {
    try {
      await fetch(`${this.baseURL}/track/${assetId}`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      log.error('Error tracking asset usage:', error);
    }
  }

  async getCategories(): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseURL}/categories`, {
        credentials:'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch categories: ${response.statusText}`);
      }

      const data = await response.json();
      return data.categories || [];
    } catch (error) {
      log.error('Error fetching categories:', error);
      return [];
    }
  }
}

export const assetLibraryService = new AssetLibraryService();

