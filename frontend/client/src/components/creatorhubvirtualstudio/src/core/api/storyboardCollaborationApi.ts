/**
 * Storyboard Collaboration API Client
 * 
 * Frontend service for interacting with the storyboard collaboration backend.
 */

import { apiRequest } from '@/lib/queryClient';
import type { PermissionLevel } from '../storyboard/StoryboardCollaborationService';

// =============================================================================
// Types
// =============================================================================

interface StoryboardDB {
  id: string;
  userId: string;
  projectId?: string;
  name: string;
  description?: string;
  aspectRatio: '16:9' | '4:3' | '2.35:1' | '1:1' | '9:16';
  settings?: any;
  frameCount: number;
  totalDuration: number;
  thumbnailUrl?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  frames?: StoryboardFrameDB[];
}

interface StoryboardFrameDB {
  id: string;
  storyboardId: string;
  userId: string;
  index: number;
  imageUrl?: string;
  thumbnailUrl?: string;
  title: string;
  shotType: string;
  cameraAngle: string;
  cameraMovement: string;
  duration: number;
  description?: string;
  technicalNotes?: string;
  dialogue?: string;
  sceneSnapshot?: any;
  canvasState?: any;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface CommentDB {
  id: string;
  storyboardId: string;
  frameId?: string;
  parentId?: string;
  text: string;
  attachments?: any[];
  positionX?: number;
  positionY?: number;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  status: 'open' | 'resolved' | 'archived';
  resolvedAt?: string;
  resolvedBy?: string;
  createdAt: string;
  updatedAt: string;
  replies?: CommentDB[];
}

interface VersionDB {
  id: string;
  storyboardId: string;
  version: number;
  name: string;
  description?: string;
  data: any;
  frameCount: number;
  thumbnailUrl?: string;
  authorId: string;
  authorName: string;
  versionType: 'manual' | 'auto' | 'milestone';
  createdAt: string;
}

interface TeamMemberDB {
  id: string;
  storyboardId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userAvatar?: string;
  permission: PermissionLevel;
  invitedBy: string;
  invitedAt: string;
  acceptedAt?: string;
  lastActiveAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface ShareLinkDB {
  id: string;
  storyboardId: string;
  token: string;
  permission: PermissionLevel;
  expiresAt?: string;
  maxViews?: number;
  viewCount: number;
  requiresPassword: boolean;
  createdBy: string;
  lastAccessedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// API Base URL
// =============================================================================

const API_BASE = '/api/virtual-studio/storyboard';

async function requestJson<T>(url: string, options?: Parameters<typeof apiRequest>[1]): Promise<T> {
  return apiRequest(url, options) as Promise<T>;
}

// =============================================================================
// Storyboard API
// =============================================================================

export const storyboardApi = {
  // Get all storyboards for current user
  async getAll(): Promise<StoryboardDB[]> {
    return requestJson<StoryboardDB[]>(`${API_BASE}/storyboards`);
  },

  // Get single storyboard with frames
  async get(id: string): Promise<StoryboardDB> {
    return requestJson<StoryboardDB>(`${API_BASE}/storyboards/${id}`);
  },

  // Create new storyboard
  async create(data: {
    name: string;
    description?: string;
    aspectRatio?: string;
    projectId?: string;
    settings?: any;
  }): Promise<StoryboardDB> {
    return requestJson<StoryboardDB>(`${API_BASE}/storyboards`, {
      method: 'POST',
      body: data,
    });
  },

  // Update storyboard
  async update(id: string, data: Partial<StoryboardDB>): Promise<StoryboardDB> {
    return requestJson<StoryboardDB>(`${API_BASE}/storyboards/${id}`, {
      method: 'PUT',
      body: data,
    });
  },

  // Delete storyboard
  async delete(id: string): Promise<void> {
    await apiRequest(`${API_BASE}/storyboards/${id}`, { method: 'DELETE' });
  },
};

// =============================================================================
// Frames API
// =============================================================================

export const framesApi = {
  // Get frames for storyboard
  async getAll(storyboardId: string): Promise<StoryboardFrameDB[]> {
    return requestJson<StoryboardFrameDB[]>(`${API_BASE}/storyboards/${storyboardId}/frames`);
  },

  // Create frame
  async create(storyboardId: string, data: Omit<StoryboardFrameDB, 'id' | 'storyboardId' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<StoryboardFrameDB> {
    return requestJson<StoryboardFrameDB>(`${API_BASE}/storyboards/${storyboardId}/frames`, {
      method: 'POST',
      body: data,
    });
  },

  // Update frame
  async update(id: string, data: Partial<StoryboardFrameDB>): Promise<StoryboardFrameDB> {
    return requestJson<StoryboardFrameDB>(`${API_BASE}/frames/${id}`, {
      method: 'PUT',
      body: data,
    });
  },

  // Delete frame
  async delete(id: string): Promise<void> {
    await apiRequest(`${API_BASE}/frames/${id}`, { method: 'DELETE' });
  },

  // Reorder frames
  async reorder(storyboardId: string, frameIds: string[]): Promise<void> {
    await apiRequest(`${API_BASE}/storyboards/${storyboardId}/frames/reorder`, {
      method: 'POST',
      body: { frameIds },
    });
  },
};

// =============================================================================
// Comments API
// =============================================================================

export const commentsApi = {
  // Get comments for storyboard
  async getAll(storyboardId: string, frameId?: string): Promise<CommentDB[]> {
    const url = frameId
      ? `${API_BASE}/storyboards/${storyboardId}/comments?frameId=${frameId}`
      : `${API_BASE}/storyboards/${storyboardId}/comments`;
    return requestJson<CommentDB[]>(url);
  },

  // Add comment
  async create(
    storyboardId: string,
    data: {
      text: string;
      frameId?: string;
      positionX?: number;
      positionY?: number;
      parentId?: string;
    }
  ): Promise<CommentDB> {
    return requestJson<CommentDB>(`${API_BASE}/storyboards/${storyboardId}/comments`, {
      method: 'POST',
      body: data,
    });
  },

  // Update comment
  async update(id: string, text: string): Promise<CommentDB> {
    return requestJson<CommentDB>(`${API_BASE}/comments/${id}`, {
      method: 'PUT',
      body: { text },
    });
  },

  // Resolve comment
  async resolve(id: string): Promise<CommentDB> {
    return requestJson<CommentDB>(`${API_BASE}/comments/${id}/resolve`, {
      method: 'POST',
      body: {},
    });
  },

  // Reopen comment
  async reopen(id: string): Promise<CommentDB> {
    return requestJson<CommentDB>(`${API_BASE}/comments/${id}/reopen`, {
      method: 'POST',
      body: {},
    });
  },

  // Delete comment
  async delete(id: string): Promise<void> {
    await apiRequest(`${API_BASE}/comments/${id}`, { method: 'DELETE' });
  },
};

// =============================================================================
// Versions API
// =============================================================================

export const versionsApi = {
  // Get versions for storyboard
  async getAll(storyboardId: string): Promise<VersionDB[]> {
    return requestJson<VersionDB[]>(`${API_BASE}/storyboards/${storyboardId}/versions`);
  },

  // Create version
  async create(
    storyboardId: string,
    data: {
      description?: string;
      versionType?: 'manual' | 'auto' |'milestone';
      data: any;
      frameCount: number;
      thumbnailUrl?: string;
    }
  ): Promise<VersionDB> {
    return requestJson<VersionDB>(`${API_BASE}/storyboards/${storyboardId}/versions`, {
      method: 'POST',
      body: data,
    });
  },

  // Get single version
  async get(id: string): Promise<VersionDB> {
    return requestJson<VersionDB>(`${API_BASE}/versions/${id}`);
  },

  // Delete version
  async delete(id: string): Promise<void> {
    await apiRequest(`${API_BASE}/versions/${id}`, { method: 'DELETE' });
  },
};

// =============================================================================
// Team API
// =============================================================================

export const teamApi = {
  // Get team members
  async getAll(storyboardId: string): Promise<TeamMemberDB[]> {
    return requestJson<TeamMemberDB[]>(`${API_BASE}/storyboards/${storyboardId}/team`);
  },

  // Invite member
  async invite(
    storyboardId: string,
    data: {
      userEmail: string;
      userName?: string;
      permission?: PermissionLevel;
    }
  ): Promise<TeamMemberDB> {
    return requestJson<TeamMemberDB>(`${API_BASE}/storyboards/${storyboardId}/team`, {
      method: 'POST',
      body: data,
    });
  },

  // Update permission
  async updatePermission(id: string, permission: PermissionLevel): Promise<TeamMemberDB> {
    return requestJson<TeamMemberDB>(`${API_BASE}/team/${id}`, {
      method: 'PUT',
      body: { permission },
    });
  },

  // Remove member
  async remove(id: string): Promise<void> {
    await apiRequest(`${API_BASE}/team/${id}`, { method: 'DELETE' });
  },
};

// =============================================================================
// Share Links API
// =============================================================================

export const shareLinksApi = {
  // Get share links
  async getAll(storyboardId: string): Promise<ShareLinkDB[]> {
    return requestJson<ShareLinkDB[]>(`${API_BASE}/storyboards/${storyboardId}/share-links`);
  },

  // Create share link
  async create(
    storyboardId: string,
    data: {
      permission?: PermissionLevel;
      expiresIn?: number; // hours
      maxViews?: number;
      password?: string;
    }
  ): Promise<ShareLinkDB> {
    return requestJson<ShareLinkDB>(`${API_BASE}/storyboards/${storyboardId}/share-links`, {
      method: 'POST',
      body: data,
    });
  },

  // Access shared storyboard (public)
  async access(token: string, password?: string): Promise<{ permission: PermissionLevel; storyboard: StoryboardDB }> {
    const url = password
      ? `${API_BASE}/shared/${token}?password=${encodeURIComponent(password)}`
      : `${API_BASE}/shared/${token}`;
    return requestJson<{ permission: PermissionLevel; storyboard: StoryboardDB }>(url);
  },

  // Delete share link
  async delete(id: string): Promise<void> {
    await apiRequest(`${API_BASE}/share-links/${id}`, { method: 'DELETE' });
  },

  // Get share URL
  getShareUrl(token: string): string {
    return `${window.location.origin}/storyboard/shared/${token}`;
  },
};

// =============================================================================
// Combined API Export
// =============================================================================

export const storyboardCollaborationApi = {
  storyboards: storyboardApi,
  frames: framesApi,
  comments: commentsApi,
  versions: versionsApi,
  team: teamApi,
  shareLinks: shareLinksApi,
};

export default storyboardCollaborationApi;
