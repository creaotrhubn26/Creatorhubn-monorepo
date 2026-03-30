/**
 * Storyboard API Client
 * Database-backed API for storyboard collaboration features
 */

const API_BASE = '/api';

// =============================================================================
// Types
// =============================================================================

export interface StoryboardDB {
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
}

export interface StoryboardFrameDB {
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
  status: 'draft' | 'review' | 'approved' | 'revision_needed';
  createdAt: string;
  updatedAt: string;
}

export interface StoryboardCommentDB {
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
  replies?: StoryboardCommentDB[];
  createdAt: string;
  updatedAt: string;
}

export interface StoryboardVersionDB {
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

export interface StoryboardTeamMemberDB {
  id: string;
  storyboardId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userAvatar?: string;
  permission: 'view' | 'comment' | 'edit' | 'admin';
  invitedBy: string;
  invitedAt: string;
  acceptedAt?: string;
  lastActiveAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoryboardShareLinkDB {
  id: string;
  storyboardId: string;
  token: string;
  permission: 'view' | 'comment' | 'edit';
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
// Helper Functions
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
// Storyboards API
// =============================================================================

export const storyboardsApi = {
  // List storyboards
  list: async (userId: string): Promise<StoryboardDB[]> => {
    return apiRequest(`/storyboards?userId=${encodeURIComponent(userId)}`);
  },

  // Get storyboard with frames
  get: async (id: string): Promise<StoryboardDB & { frames: StoryboardFrameDB[] }> => {
    return apiRequest(`/storyboards/${id}`);
  },

  // Create storyboard
  create: async (data: Partial<StoryboardDB>): Promise<StoryboardDB> => {
    return apiRequest('/storyboards', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Update storyboard
  update: async (id: string, data: Partial<StoryboardDB>): Promise<StoryboardDB> => {
    return apiRequest(`/storyboards/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Delete storyboard
  delete: async (id: string): Promise<void> => {
    return apiRequest(`/storyboards/${id}`, { method: 'DELETE' });
  },
};

// =============================================================================
// Frames API
// =============================================================================

export const framesApi = {
  // List frames for storyboard
  list: async (storyboardId: string): Promise<StoryboardFrameDB[]> => {
    return apiRequest(`/storyboards/${storyboardId}/frames`);
  },

  // Add frame
  create: async (storyboardId: string, data: Partial<StoryboardFrameDB>): Promise<StoryboardFrameDB> => {
    return apiRequest(`/storyboards/${storyboardId}/frames`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Update frame
  update: async (id: string, data: Partial<StoryboardFrameDB>): Promise<StoryboardFrameDB> => {
    return apiRequest(`/frames/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Delete frame
  delete: async (id: string): Promise<void> => {
    return apiRequest(`/frames/${id}`, { method: 'DELETE' });
  },

  // Reorder frames
  reorder: async (storyboardId: string, fromIndex: number, toIndex: number): Promise<void> => {
    return apiRequest(`/storyboards/${storyboardId}/reorder`, {
      method: 'POST',
      body: JSON.stringify({ fromIndex, toIndex }),
    });
  },
};

// =============================================================================
// Comments API
// =============================================================================

export const commentsApi = {
  // List comments for storyboard
  list: async (storyboardId: string, frameId?: string): Promise<StoryboardCommentDB[]> => {
    let url = `/storyboards/${storyboardId}/comments`;
    if (frameId) {
      url += `?frameId=${encodeURIComponent(frameId)}`;
    }
    return apiRequest(url);
  },

  // Add comment
  create: async (
    storyboardId: string,
    data: {
      frameId?: string;
      text: string;
      positionX?: number;
      positionY?: number;
      parentId?: string;
      authorId: string;
      authorName: string;
      authorAvatar?: string;
    }
  ): Promise<StoryboardCommentDB> => {
    return apiRequest(`/storyboards/${storyboardId}/comments`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Update comment
  update: async (
    id: string,
    data: { text?: string; status?: string; resolvedBy?: string }
  ): Promise<StoryboardCommentDB> => {
    return apiRequest(`/comments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Delete comment
  delete: async (id: string): Promise<void> => {
    return apiRequest(`/comments/${id}`, { method: 'DELETE' });
  },

  // Resolve comment
  resolve: async (id: string, resolvedBy: string): Promise<StoryboardCommentDB> => {
    return apiRequest(`/comments/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'resolved', resolvedBy }),
    });
  },

  // Reopen comment
  reopen: async (id: string): Promise<StoryboardCommentDB> => {
    return apiRequest(`/comments/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'open' }),
    });
  },
};

// =============================================================================
// Versions API
// =============================================================================

export const versionsApi = {
  // List versions for storyboard
  list: async (storyboardId: string): Promise<StoryboardVersionDB[]> => {
    return apiRequest(`/storyboards/${storyboardId}/versions`);
  },

  // Create version
  create: async (
    storyboardId: string,
    data: {
      name?: string;
      description?: string;
      data: any;
      frameCount: number;
      thumbnailUrl?: string;
      authorId: string;
      authorName: string;
      versionType?: 'manual' | 'auto' | 'milestone';
    }
  ): Promise<StoryboardVersionDB> => {
    return apiRequest(`/storyboards/${storyboardId}/versions`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Delete version
  delete: async (id: string): Promise<void> => {
    return apiRequest(`/versions/${id}`, { method: 'DELETE' });
  },
};

// =============================================================================
// Team Members API
// =============================================================================

export const teamApi = {
  // List team members
  list: async (storyboardId: string): Promise<StoryboardTeamMemberDB[]> => {
    return apiRequest(`/storyboards/${storyboardId}/team`);
  },

  // Invite team member
  invite: async (
    storyboardId: string,
    data: {
      userId?: string;
      userName: string;
      userEmail: string;
      userAvatar?: string;
      permission?: 'view' | 'comment' | 'edit' | 'admin';
      invitedBy: string;
    }
  ): Promise<StoryboardTeamMemberDB> => {
    return apiRequest(`/storyboards/${storyboardId}/team`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Update permission
  updatePermission: async (
    id: string,
    permission: 'view' | 'comment' | 'edit' | 'admin'
  ): Promise<StoryboardTeamMemberDB> => {
    return apiRequest(`/team/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ permission }),
    });
  },

  // Remove member
  remove: async (id: string): Promise<void> => {
    return apiRequest(`/team/${id}`, { method: 'DELETE' });
  },
};

// =============================================================================
// Share Links API
// =============================================================================

export const shareLinksApi = {
  // List share links
  list: async (storyboardId: string): Promise<StoryboardShareLinkDB[]> => {
    return apiRequest(`/storyboards/${storyboardId}/links`);
  },

  // Create share link
  create: async (
    storyboardId: string,
    data: {
      permission?: 'view' | 'comment' | 'edit';
      expiresIn?: number; // hours
      maxViews?: number;
      password?: string;
      createdBy: string;
    }
  ): Promise<StoryboardShareLinkDB> => {
    return apiRequest(`/storyboards/${storyboardId}/links`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Delete share link
  delete: async (id: string): Promise<void> => {
    return apiRequest(`/links/${id}`, { method: 'DELETE' });
  },

  // Access shared storyboard
  access: async (
    token: string,
    password?: string
  ): Promise<{
    storyboard: StoryboardDB & { frames: StoryboardFrameDB[] };
    permission: string;
  }> => {
    let url = `/shared/${token}`;
    if (password) {
      url += `?password=${encodeURIComponent(password)}`;
    }
    return apiRequest(url);
  },

  // Get share URL
  getUrl: (token: string): string => {
    return `${window.location.origin}/storyboard/shared/${token}`;
  },
};

// =============================================================================
// Export All
// =============================================================================

export const storyboardApi = {
  storyboards: storyboardsApi,
  frames: framesApi,
  comments: commentsApi,
  versions: versionsApi,
  team: teamApi,
  shareLinks: shareLinksApi,
};

export default storyboardApi;
