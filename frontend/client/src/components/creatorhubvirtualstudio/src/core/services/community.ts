/**
 * Community API Service
 * 
 * Enables sharing and discovery of lighting setups, scene templates,
 * and equipment configurations within the CreatorHub community.
 * 
 * Features:
 * - Upload and share lighting setups
 * - Browse community setups with filtering
 * - Rate and review setups
 * - Download and import setups
 * - User profiles and collections
 */

import { logger } from './logger';

const log = logger.module('Community, ');
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

// =============================================================================
// Types
// =============================================================================

export interface CommunityUser {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  website?: string;
  setupCount: number;
  totalLikes: number;
  followers: number;
  following: number;
  joinedAt: string;
}

export interface CommunitySetup {
  id: string;
  userId: string;
  username: string;
  userAvatar?: string;
  title: string;
  description: string;
  category: SetupCategory;
  tags: string[];
  thumbnailUrl?: string;
  previewImages?: string[];
  sceneJson: string;
  equipmentList: EquipmentSummary[];
  lightingPattern?: string;
  likes: number;
  downloads: number;
  comments: number;
  rating: number;
  ratingCount: number;
  isPublic: boolean;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EquipmentSummary {
  type: 'light' | 'modifier' | 'camera' | 'backdrop' | 'prop' | 'stand';
  brand?: string;
  model: string;
  quantity: number;
}

export type SetupCategory = 
  | 'portrait'
  | 'product'
  | 'fashion'
  | 'food'
  | 'architectural'
  | 'video'
  | 'studio'
  | 'outdoor'
  | 'creative'
  | 'educational'
  | 'other';

export interface SetupComment {
  id: string;
  setupId: string;
  userId: string;
  username: string;
  userAvatar?: string;
  text: string;
  likes: number;
  parentId?: string;
  replies?: SetupComment[];
  createdAt: string;
}

export interface SetupCollection {
  id: string;
  userId: string;
  name: string;
  description?: string;
  thumbnailUrl?: string;
  isPublic: boolean;
  setupCount: number;
  createdAt: string;
}

export interface SearchFilters {
  query?: string;
  category?: SetupCategory;
  tags?: string[];
  minRating?: number;
  sortBy?: 'newest' | 'popular' | 'rating' | 'downloads';
  userId?: string;
  limit?: number;
  offset?: number;
}

// =============================================================================
// API Helper
// =============================================================================

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type' : 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// =============================================================================
// Setups API
// =============================================================================

export const setupsApi = {
  /**
   * Search community setups
   */
  search: async (filters: SearchFilters = {}): Promise<{
    setups: CommunitySetup[];
    total: number;
    hasMore: boolean;
  }> => {
    const params = new URLSearchParams();
    if (filters.query) params.set('q,', filters.query);
    if (filters.category) params.set('category', filters.category);
    if (filters.tags?.length) params.set('tags', filters.tags.join(', '));
    if (filters.minRating) params.set('minRating', String(filters.minRating));
    if (filters.sortBy) params.set('sort', filters.sortBy);
    if (filters.userId) params.set('userId', filters.userId);
    if (filters.limit) params.set('limit', String(filters.limit));
    if (filters.offset) params.set('offset', String(filters.offset));

    return apiRequest(`/community/setups?${params.toString()}`);
  },

  /**
   * Get featured setups
   */
  featured: async (limit = 10): Promise<CommunitySetup[]> => {
    return apiRequest(`/community/setups/featured?limit=${limit}`);
  },

  /**
   * Get setup by ID
   */
  get: async (id: string): Promise<CommunitySetup> => {
    return apiRequest(`/community/setups/${id}`);
  },

  /**
   * Upload a new setup
   */
  upload: async (data: {
    title: string;
    description: string;
    category: SetupCategory;
    tags: string[];
    sceneJson: string;
    thumbnailUrl?: string;
    previewImages?: string[];
    equipmentList: EquipmentSummary[];
    lightingPattern?: string;
    isPublic?: boolean;
  }): Promise<CommunitySetup> => {
    return apiRequest('/community/setups', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Update a setup
   */
  update: async (id: string, data: Partial<CommunitySetup>): Promise<CommunitySetup> => {
    return apiRequest(`/community/setups/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete a setup
   */
  delete: async (id: string): Promise<void> => {
    return apiRequest(`/community/setups/${id}`, { method: 'DELETE' });
  },

  /**
   * Like a setup
   */
  like: async (id: string): Promise<{ likes: number }> => {
    return apiRequest(`/community/setups/${id}/like`, { method: 'POST' });
  },

  /**
   * Unlike a setup
   */
  unlike: async (id: string): Promise<{ likes: number }> => {
    return apiRequest(`/community/setups/${id}/unlike`, { method: 'POST' });
  },

  /**
   * Rate a setup
   */
  rate: async (id: string, rating: number): Promise<{ rating: number; ratingCount: number }> => {
    return apiRequest(`/community/setups/${id}/rate`, {
      method: 'POST',
      body: JSON.stringify({ rating }),
    });
  },

  /**
   * Download/import a setup (tracks download count)
   */
  download: async (id: string): Promise<{ sceneJson: string }> => {
    return apiRequest(`/community/setups/${id}/download`, { method: 'POST' });
  },

  /**
   * Report a setup for review
   */
  report: async (id: string, reason: string): Promise<void> => {
    return apiRequest(`/community/setups/${id}/report`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },
};

// =============================================================================
// Comments API
// =============================================================================

export const commentsApi = {
  /**
   * Get comments for a setup
   */
  list: async (setupId: string): Promise<SetupComment[]> => {
    return apiRequest(`/community/setups/${setupId}/comments`);
  },

  /**
   * Add a comment
   */
  add: async (setupId: string, text: string, parentId?: string): Promise<SetupComment> => {
    return apiRequest(`/community/setups/${setupId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ text, parentId }),
    });
  },

  /**
   * Delete a comment
   */
  delete: async (commentId: string): Promise<void> => {
    return apiRequest(`/community/comments/${commentId}`, { method: 'DELETE' });
  },

  /**
   * Like a comment
   */
  like: async (commentId: string): Promise<{ likes: number }> => {
    return apiRequest(`/community/comments/${commentId}/like`, { method: 'POST' });
  },
};

// =============================================================================
// Collections API
// =============================================================================

export const collectionsApi = {
  /**
   * Get user's collections
   */
  list: async (userId: string): Promise<SetupCollection[]> => {
    return apiRequest(`/community/users/${userId}/collections`);
  },

  /**
   * Create a collection
   */
  create: async (data: {
    name: string;
    description?: string;
    isPublic?: boolean;
  }): Promise<SetupCollection> => {
    return apiRequest('/community/collections', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Add setup to collection
   */
  addSetup: async (collectionId: string, setupId: string): Promise<void> => {
    return apiRequest(`/community/collections/${collectionId}/setups`, {
      method: 'POST',
      body: JSON.stringify({ setupId }),
    });
  },

  /**
   * Remove setup from collection
   */
  removeSetup: async (collectionId: string, setupId: string): Promise<void> => {
    return apiRequest(`/community/collections/${collectionId}/setups/${setupId}`, {
      method: 'DELETE',
    });
  },

  /**
   * Delete collection
   */
  delete: async (collectionId: string): Promise<void> => {
    return apiRequest(`/community/collections/${collectionId}`, { method: 'DELETE' });
  },
};

// =============================================================================
// Users API
// =============================================================================

export const usersApi = {
  /**
   * Get user profile
   */
  get: async (userId: string): Promise<CommunityUser> => {
    return apiRequest(`/community/users/${userId}`);
  },

  /**
   * Get user's setups
   */
  setups: async (userId: string, limit = 20, offset = 0): Promise<CommunitySetup[]> => {
    return apiRequest(`/community/users/${userId}/setups?limit=${limit}&offset=${offset}`);
  },

  /**
   * Follow a user
   */
  follow: async (userId: string): Promise<void> => {
    return apiRequest(`/community/users/${userId}/follow`, { method: 'POST' });
  },

  /**
   * Unfollow a user
   */
  unfollow: async (userId: string): Promise<void> => {
    return apiRequest(`/community/users/${userId}/unfollow`, { method: 'POST' });
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Extract equipment list from scene JSON
 */
export function extractEquipmentFromScene(sceneJson: string): EquipmentSummary[] {
  try {
    const scene = JSON.parse(sceneJson);
    const equipment: EquipmentSummary[] = [];
    const seen = new Map<string, EquipmentSummary>();

    const nodes = scene.nodes || [];
    for (const node of nodes) {
      let type: EquipmentSummary['type'] | null = null;
      const model = node.name || 'Unknown';
      const brand = node.userData?.brand;

      if (node.type === 'light' || node.light) {
        type = 'light';
        if (node.light?.modifier) type = 'modifier';
      } else if (node.type === 'camera' || node.camera) {
        type = 'camera';
      } else if (node.type === 'backdrop' || node.name?.toLowerCase().includes('backdrop')) {
        type = 'backdrop';
      } else if (node.type === 'prop') {
        type = 'prop';
      } else if (node.name?.toLowerCase().includes('stand') || node.name?.toLowerCase().includes('tripod')) {
        type = 'stand';
      }

      if (type) {
        const key = `${type}-${brand || ''}-${model}`;
        const existing = seen.get(key);
        if (existing) {
          existing.quantity++;
        } else {
          const item: EquipmentSummary = { type, model, quantity: 1 };
          if (brand) item.brand = brand;
          seen.set(key, item);
          equipment.push(item);
        }
      }
    }

    return equipment;
  } catch {
    return [];
  }
}

/**
 * Generate thumbnail from scene (uses render service)
 */
export async function generateSetupThumbnail(): Promise<string | null> {
  try {
    const { renderHighQuality } = await import('./render');
    const result = await renderHighQuality({
      width: 400,
      height: 300,
      quality: 'preview',
      format: 'jpeg',
      jpegQuality: 0.8,
    });
    return result.dataUrl;
  } catch (error) {
    log.warn('Failed to generate thumbnail: ', error);
    return null;
  }
}

// =============================================================================
// Legacy API (for backwards compatibility)
// =============================================================================

export async function uploadSetup(sceneJson: string): Promise<{ id: string }> {
  const result = await setupsApi.upload({
    title: 'Untitled Setup',
    description: ', ',
    category: 'studio',
    tags: [],
    sceneJson,
    equipmentList: extractEquipmentFromScene(sceneJson),
  });
  return { id: result.id };
}

export async function listSetups(): Promise<{ id: string; title: string }[]> {
  const { setups } = await setupsApi.search({ limit: 50, sortBy:'popular' });
  return setups.map((s) => ({ id: s.id, title: s.title }));
}

// =============================================================================
// Export
// =============================================================================

export const communityApi = {
  setups: setupsApi,
  comments: commentsApi,
  collections: collectionsApi,
  users: usersApi,
  extractEquipmentFromScene,
  generateSetupThumbnail,
};

// Wrapper service for component compatibility
export const communityService = {
  async fetchCommunitySetups(): Promise<CommunitySetup[]> {
    const result = await setupsApi.search({ limit: 50 });
    return result.setups;
  },
  async uploadSetup(data: {
    title: string;
    description: string;
    tags: string[];
  }): Promise<{ id: string }> {
    const sceneJson = JSON.stringify({}); // Get current scene
    const equipmentList: EquipmentSummary[] = [];
    const setup = await setupsApi.upload({
      ...data,
      category: 'lighting' as SetupCategory,
      sceneJson,
      equipmentList,
    });
    return { id: setup.id };
  },
  async loadCommunitySetup(id: string): Promise<CommunitySetup> {
    return setupsApi.get(id);
  },
  async likeSetup(id: string): Promise<void> {
    await setupsApi.like(id);
  },
};

export default communityApi;
