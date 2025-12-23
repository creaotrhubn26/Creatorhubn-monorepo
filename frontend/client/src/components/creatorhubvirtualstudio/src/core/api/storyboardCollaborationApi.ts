/**
 * Storyboard Collaboration API Client
 * 
 * Frontend service for interacting with the storyboard collaboration backend.
 */

import { apiRequest } from '@/lib/queryClient';
import {
  Comment,
  VersionSnapshot,
  TeamMember,
  ShareLink,
  PermissionLevel,
} from '../storyboard/StoryboardCollaborationService';
import { Storyboard, StoryboardFrame } from '../../state/storyboardStore';

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

// =============================================================================
// Storyboard API
// =============================================================================

export const storyboardApi = {
  // Get all storyboards for current user
  async getAll(): Promise<StoryboardDB[]> {
    const response = await apiRequest('GET', `${API_BASE}/storyboards, `);
    return response.json();
  },

  // Get single storyboard with frames
  async get(id: string): Promise<StoryboardDB> {
    const response = await apiRequest('GET', `${API_BASE}/storyboards/${id}`);
    return response.json();
  },

  // Create new storyboard
  async create(data: {
    name: string;
    description?: string;
    aspectRatio?: string;
    projectId?: string;
    settings?: any;
  }): Promise<StoryboardDB> {
    const response = await apiRequest('POST', `${API_BASE}/storyboards`, data);
    return response.json();
  },

  // Update storyboard
  async update(id: string, data: Partial<StoryboardDB>): Promise<StoryboardDB> {
    const response = await apiRequest('PUT', `${API_BASE}/storyboards/${id}`, data);
    return response.json();
  },

  // Delete storyboard
  async delete(id: string): Promise<void> {
    await apiRequest('DELETE', `${API_BASE}/storyboards/${id}`);
  },
};

// =============================================================================
// Frames API
// =============================================================================

export const framesApi = {
  // Get frames for storyboard
  async getAll(storyboardId: string): Promise<StoryboardFrameDB[]> {
    const response = await apiRequest('GET', `${API_BASE}/storyboards/${storyboardId}/frames`);
    return response.json();
  },

  // Create frame
  async create(storyboardId: string, data: Omit<StoryboardFrameDB, 'id' | 'storyboardId' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<StoryboardFrameDB> {
    const response = await apiRequest('POST', `${API_BASE}/storyboards/${storyboardId}/frames`, data);
    return response.json();
  },

  // Update frame
  async update(id: string, data: Partial<StoryboardFrameDB>): Promise<StoryboardFrameDB> {
    const response = await apiRequest('PUT', `${API_BASE}/frames/${id}`, data);
    return response.json();
  },

  // Delete frame
  async delete(id: string): Promise<void> {
    await apiRequest('DELETE', `${API_BASE}/frames/${id}`);
  },

  // Reorder frames
  async reorder(storyboardId: string, frameIds: string[]): Promise<void> {
    await apiRequest('POST', `${API_BASE}/storyboards/${storyboardId}/frames/reorder`, { frameIds });
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
    const response = await apiRequest('GET', url);
    return response.json();
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
    const response = await apiRequest('POST', `${API_BASE}/storyboards/${storyboardId}/comments`, data);
    return response.json();
  },

  // Update comment
  async update(id: string, text: string): Promise<CommentDB> {
    const response = await apiRequest('PUT', `${API_BASE}/comments/${id}`, { text });
    return response.json();
  },

  // Resolve comment
  async resolve(id: string): Promise<CommentDB> {
    const response = await apiRequest('POST', `${API_BASE}/comments/${id}/resolve`, {});
    return response.json();
  },

  // Reopen comment
  async reopen(id: string): Promise<CommentDB> {
    const response = await apiRequest('POST', `${API_BASE}/comments/${id}/reopen`, {});
    return response.json();
  },

  // Delete comment
  async delete(id: string): Promise<void> {
    await apiRequest('DELETE', `${API_BASE}/comments/${id}`);
  },
};

// =============================================================================
// Versions API
// =============================================================================

export const versionsApi = {
  // Get versions for storyboard
  async getAll(storyboardId: string): Promise<VersionDB[]> {
    const response = await apiRequest('GET', `${API_BASE}/storyboards/${storyboardId}/versions`);
    return response.json();
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
    const response = await apiRequest('POST', `${API_BASE}/storyboards/${storyboardId}/versions`, data);
    return response.json();
  },

  // Get single version
  async get(id: string): Promise<VersionDB> {
    const response = await apiRequest('GET', `${API_BASE}/versions/${id}`);
    return response.json();
  },

  // Delete version
  async delete(id: string): Promise<void> {
    await apiRequest('DELETE', `${API_BASE}/versions/${id}`);
  },
};

// =============================================================================
// Team API
// =============================================================================

export const teamApi = {
  // Get team members
  async getAll(storyboardId: string): Promise<TeamMemberDB[]> {
    const response = await apiRequest('GET', `${API_BASE}/storyboards/${storyboardId}/team`);
    return response.json();
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
    const response = await apiRequest('POST', `${API_BASE}/storyboards/${storyboardId}/team`, data);
    return response.json();
  },

  // Update permission
  async updatePermission(id: string, permission: PermissionLevel): Promise<TeamMemberDB> {
    const response = await apiRequest('PUT', `${API_BASE}/team/${id}`, { permission });
    return response.json();
  },

  // Remove member
  async remove(id: string): Promise<void> {
    await apiRequest('DELETE', `${API_BASE}/team/${id}`);
  },
};

// =============================================================================
// Share Links API
// =============================================================================

export const shareLinksApi = {
  // Get share links
  async getAll(storyboardId: string): Promise<ShareLinkDB[]> {
    const response = await apiRequest('GET', `${API_BASE}/storyboards/${storyboardId}/share-links`);
    return response.json();
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
    const response = await apiRequest('POST', `${API_BASE}/storyboards/${storyboardId}/share-links`, data);
    return response.json();
  },

  // Access shared storyboard (public)
  async access(token: string, password?: string): Promise<{ permission: PermissionLevel; storyboard: StoryboardDB }> {
    const url = password
      ? `${API_BASE}/shared/${token}?password=${encodeURIComponent(password)}`
      : `${API_BASE}/shared/${token}`;
    const response = await apiRequest('GET', url);
    return response.json();
  },

  // Delete share link
  async delete(id: string): Promise<void> {
    await apiRequest('DELETE', `${API_BASE}/share-links/${id}`);
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

