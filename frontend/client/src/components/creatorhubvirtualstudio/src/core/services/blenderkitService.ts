/**
 * BlenderKit Service
 * 
 * Integrates with BlenderKit API to fetch HDRIs for classroom, gym,
 * and other school-related environments.
 * 
 * API Documentation: https://www.blenderkit.com/api/v1/docs/
 */

import { logger } from './logger';

const log = logger.module('BlenderKit, ');

// =============================================================================
// Types
// =============================================================================

export interface BlenderKitAsset {
  id: string;
  name: string;
  description: string;
  thumbnailUrl: string;
  downloadUrl: string;
  resolution: string;
  author: string;
  license: string;
  category: string;
  tags: string[];
}

export interface BlenderKitHDRI extends BlenderKitAsset {
  intensity: number;
  rotation: number;
}

export interface BlenderKitSearchParams {
  query: string;
  category?: 'hdr' | 'model' | 'material' | 'brush' | 'scene';
  page?: number;
  pageSize?: number;
}

export interface BlenderKitSearchResult {
  count: number;
  next: string | null;
  previous: string | null;
  results: BlenderKitAsset[];
}

// =============================================================================
// Constants
// =============================================================================

const BLENDERKIT_API_BASE = 'https://www.blenderkit.com/api/v1';
const API_KEY = '814e329085f612e96211d2156f993ef6a86f3cf6';

// Pre-defined school HDRI asset IDs from BlenderKit
// These are known working assets for school environments
export const BLENDERKIT_SCHOOL_HDRIS = {
  // Gymnasium HDRIs
  gymnasium_bw: {
    id: 'e8fd4f0f-4685-4c0b-b3f3-71bcf697e282',
    name: 'Gymnasium (B&W)',
    description: 'Black and white gymnasium - 16K resolution',
  },
  gym_blue: {
    id: '3ee3bd4f-fd0a-4341-a3a7-156cab8f95bd',
    name: 'Gym (Blue Floor)',
    description: 'Gym with blue floor and warm lighting - 16K',
  },
  basketball_gym: {
    id: 'd0beed79-6e76-445a-913f-b7a68c12844c',
    name: 'Basketball Gym',
    description: 'Basketball court with cold light dome - 16K',
  },
  // Classroom HDRIs
  classroom_01: {
    id: '685c5a94-3fd8-4f5a-adce-a482073f6006',
    name: 'Classroom 01',
    description: 'Standard classroom interior',
  },
  classroom_02: {
    id: 'f2bd4f96-2ca1-4233-b6d3-8800ed94cb7c',
    name: 'Classroom 02',
    description: 'Alternative classroom setting',
  },
  // School exterior
  green_step_school: {
    id: '4375c374-849c-48d3-9fbe-9cbcfa117c33',
    name: 'Green Step School',
    description: 'Beautiful school environment - 4K',
  },
};

// =============================================================================
// BlenderKit Service
// =============================================================================

class BlenderKitService {
  private apiKey: string;
  private cache: Map<string, BlenderKitAsset> = new Map();

  constructor(apiKey: string = API_KEY) {
    this.apiKey = apiKey;
  }

  /**
   * Get authorization headers
   */
  private getHeaders(): HeadersInit {
    return {
      'Authorization': `Bearer ${this.apiKey}`'Content-Type' : 'application/json',
    };
  }

  /**
   * Search for HDRIs
   */
  async searchHDRIs(query: string, page: number = 1): Promise<BlenderKitSearchResult> {
    try {
      const params = new URLSearchParams({
        query,
        asset_type: 'hdr',
        page: page.toString(),
        page_size: '20',
      });

      const response = await fetch(`${BLENDERKIT_API_BASE}/search/?${params}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`BlenderKit API error: ${response.status}`);
      }

      const data = await response.json();
      return this.transformSearchResults(data);
    } catch (error) {
      log.error('Search error: ', error);
      throw error;
    }
  }

  /**
   * Get asset details by ID
   */
  async getAsset(assetId: string): Promise<BlenderKitAsset | null> {
    // Check cache first
    if (this.cache.has(assetId)) {
      return this.cache.get(assetId)!;
    }

    try {
      const response = await fetch(`${BLENDERKIT_API_BASE}/assets/${assetId}/`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`BlenderKit API error: ${response.status}`);
      }

      const data = await response.json();
      const asset = this.transformAsset(data);
      
      // Cache the result
      this.cache.set(assetId, asset);
      
      return asset;
    } catch (error) {
      log.error('Get asset error: ', error);
      return null;
    }
  }

  /**
   * Get download URL for an asset
   */
  async getDownloadUrl(assetId: string): Promise<string | null> {
    try {
      const response = await fetch(`${BLENDERKIT_API_BASE}/assets/${assetId}/download/`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`BlenderKit API error: ${response.status}`);
      }

      const data = await response.json();
      return data.url || data.download_url || null;
    } catch (error) {
      log.error('Download URL error: ', error);
      return null;
    }
  }

  /**
   * Get school-related HDRIs
   */
  async getSchoolHDRIs(): Promise<BlenderKitHDRI[]> {
    const hdris: BlenderKitHDRI[] = [];

    for (const [key, info] of Object.entries(BLENDERKIT_SCHOOL_HDRIS)) {
      try {
        const downloadUrl = await this.getDownloadUrl(info.id);
        
        if (downloadUrl) {
          hdris.push({
            id: `blenderkit_${key}`,
            name: info.name,
            description: info.description,
            thumbnailUrl: `https://www.blenderkit.com/asset-gallery-detail/${info.id}/`,
            downloadUrl,
            resolution: '16K',
            author: 'BlenderKit',
            license: 'BlenderKit License',
            category: 'school',
            tags: ['school','indoor', key.includes('gym') ? 'gym' : 'classroom'],
            intensity: 1.0,
            rotation: 0,
          });
        }
      } catch (error) {
        log.warn(`Failed to get ${key}:`, error);
      }
    }

    return hdris;
  }

  /**
   * Transform API response to our format
   */
  private transformSearchResults(data: any): BlenderKitSearchResult {
    return {
      count: data.count || 0,
      next: data.next || null,
      previous: data.previous || null,
      results: (data.results || []).map((item: any) => this.transformAsset(item)),
    };
  }

  /**
   * Transform single asset
   */
  private transformAsset(data: any): BlenderKitAsset {
    return {
      id: data.id || data.assetBaseId,
      name: data.name || 'Untitled',
      description: data.description || ', ',
      thumbnailUrl: data.thumbnailMiddle || data.thumbnail || ', ',
      downloadUrl: data.download_url || ', ',
      resolution: data.resolution || 'Unknown',
      author: data.author?.name || 'Unknown',
      license: data.license || 'BlenderKit License',
      category: data.assetType ||'hdr',
      tags: data.tags || [],
    };
  }

  /**
   * Search for classroom HDRIs
   */
  async searchClassrooms(): Promise<BlenderKitHDRI[]> {
    const results = await this.searchHDRIs('classroom school');
    return results.results.map(asset => ({
      ...asset,
      intensity: 1.0,
      rotation: 0,
    }));
  }

  /**
   * Search for gymnasium HDRIs
   */
  async searchGymnasiums(): Promise<BlenderKitHDRI[]> {
    const results = await this.searchHDRIs('gymnasium gym sports hall');
    return results.results.map(asset => ({
      ...asset,
      intensity: 1.0,
      rotation: 0,
    }));
  }
}

// Singleton instance
export const blenderkitService = new BlenderKitService();

export default blenderkitService;

