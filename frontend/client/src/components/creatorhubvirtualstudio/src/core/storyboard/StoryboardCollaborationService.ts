/**
 * StoryboardCollaborationService - Collaboration features for storyboards
 * 
 * Features:
 * - Comments on frames and storyboards
 * - Version history with restore
 * - Team sharing with permissions
 * - Real-time collaboration indicators
 * 
 * Uses database persistence via API with localStorage fallback
 */

import type { Storyboard} from '../../state/storyboardStore';
import { StoryboardFrame } from '../../state/storyboardStore';
import { logger } from '../services/logger';

const log = logger.module('Storyboard, ');
import {
  commentsApi,
  versionsApi,
  teamApi,
  shareLinksApi,
} from '../api/storyboardCollaborationApi';

// =============================================================================
// Types
// =============================================================================

export type CommentStatus = 'open' | 'resolved' | 'archived';
export type PermissionLevel = 'view' | 'comment' | 'edit' | 'admin';

export interface Comment {
  id: string;
  storyboardId: string;
  frameId?: string; // null = storyboard-level comment
  
  // Content
  text: string;
  attachments?: CommentAttachment[];
  
  // Position (for frame comments)
  position?: { x: number; y: number };
  
  // Author
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  
  // Threading
  parentId?: string;
  replies?: Comment[];
  
  // Status
  status: CommentStatus;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface CommentAttachment {
  id: string;
  type: 'image' | 'file' | 'link';
  url: string;
  name: string;
  size?: number;
}

export interface VersionSnapshot {
  id: string;
  storyboardId: string;
  version: number;
  
  // Snapshot data
  name: string;
  description?: string;
  frameCount: number;
  thumbnail?: string;
  data: string; // JSON serialized storyboard
  
  // Author
  authorId: string;
  authorName: string;
  
  // Type
  type: 'manual' | 'auto' | 'milestone';
  
  // Timestamps
  createdAt: string;
}

export interface ShareLink {
  id: string;
  storyboardId: string;
  token: string;
  
  // Settings
  permission: PermissionLevel;
  expiresAt?: string;
  maxViews?: number;
  viewCount: number;
  requiresPassword: boolean;
  passwordHash?: string;
  
  // Metadata
  createdBy: string;
  createdAt: string;
  lastAccessedAt?: string;
}

export interface TeamMember {
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
}

export interface ActiveCollaborator {
  userId: string;
  userName: string;
  userAvatar?: string;
  currentFrameId?: string;
  cursor?: { x: number; y: number };
  color: string;
  lastActiveAt: string;
}

export interface CollaborationState {
  comments: Comment[];
  versions: VersionSnapshot[];
  shareLinks: ShareLink[];
  teamMembers: TeamMember[];
  activeCollaborators: ActiveCollaborator[];
}

// =============================================================================
// Event Types
// =============================================================================

export type CollaborationEventType = 
  | 'comment:added'
  | 'comment:updated'
  | 'comment:deleted'
  | 'comment:resolved'
  | 'version:created'
  | 'version:restored'
  | 'member:joined'
  | 'member:left'
  | 'cursor:moved'
  | 'frame:selected';

export interface CollaborationEvent {
  type: CollaborationEventType;
  storyboardId: string;
  userId: string;
  data: any;
  timestamp: string;
}

export type CollaborationEventHandler = (event: CollaborationEvent) => void;

// =============================================================================
// StoryboardCollaborationService Class
// =============================================================================

export class StoryboardCollaborationService {
  private currentStoryboardId: string | null = null;
  private state: CollaborationState = {
    comments: [],
    versions: [],
    shareLinks: [],
    teamMembers: [],
    activeCollaborators: [],
  };
  private eventHandlers: CollaborationEventHandler[] = [];
  private autoSaveInterval: NodeJS.Timer | null = null;
  private lastAutoSaveVersion: number = 0;

  // =========================================================================
  // Initialization
  // =========================================================================

  async initialize(storyboardId: string): Promise<void> {
    this.currentStoryboardId = storyboardId;
    
    // Load collaboration data
    await this.loadComments();
    await this.loadVersions();
    await this.loadTeamMembers();
    await this.loadShareLinks();
    
    // Start auto-save
    this.startAutoSave();
    
    log.debug('Service initialized for storyboard: ', storyboardId);
  }

  destroy(): void {
    this.stopAutoSave();
    this.currentStoryboardId = null;
    this.state = {
      comments: [],
      versions: [],
      shareLinks: [],
      teamMembers: [],
      activeCollaborators: [],
    };
    this.eventHandlers = [];
  }

  // =========================================================================
  // Comments (Database-backed)
  // =========================================================================

  async loadComments(): Promise<Comment[]> {
    if (!this.currentStoryboardId) return [];
    
    try {
      const dbComments = await commentsApi.getAll(this.currentStoryboardId);
      this.state.comments = this.convertDBCommentsToComments(dbComments);
      return this.state.comments;
    } catch (error) {
      log.error('Failed to load comments from DB: ', error);
      // Fallback to localStorage
      const stored = localStorage.getItem(`storyboard_comments_${this.currentStoryboardId}`);
      this.state.comments = stored ? JSON.parse(stored) : [];
      return this.state.comments;
    }
  }

  private convertDBCommentsToComments(dbComments: any[]): Comment[] {
    return dbComments.map(db => ({
      id: db.id,
      storyboardId: db.storyboardId,
      frameId: db.frameId,
      text: db.text,
      attachments: db.attachments as CommentAttachment[] | undefined,
      position: db.positionX !== undefined && db.positionY !== undefined
        ? { x: Number(db.positionX), y: Number(db.positionY) }
        : undefined,
      parentId: db.parentId,
      authorId: db.authorId,
      authorName: db.authorName,
      authorAvatar: db.authorAvatar,
      status: db.status as CommentStatus,
      resolvedAt: db.resolvedAt,
      resolvedBy: db.resolvedBy,
      replies: db.replies ? this.convertDBCommentsToComments(db.replies) : undefined,
      createdAt: db.createdAt,
      updatedAt: db.updatedAt,
    }));
  }

  async addComment(
    text: string,
    frameId?: string,
    position?: { x: number; y: number },
    parentId?: string
  ): Promise<Comment> {
    if (!this.currentStoryboardId) {
      throw new Error('No storyboard selected');
    }

    try {
      const dbComment = await commentsApi.create(this.currentStoryboardId, {
        frameId,
        text,
        positionX: position?.x,
        positionY: position?.y,
        parentId,
      });

      const comment: Comment = this.convertDBCommentsToComments([dbComment])[0];

      if (parentId) {
        const parent = this.state.comments.find(c => c.id === parentId);
        if (parent) {
          parent.replies = parent.replies || [];
          parent.replies.push(comment);
        }
      } else {
        this.state.comments.push(comment);
      }

      this.emit({ type: 'comment:added', storyboardId: this.currentStoryboardId, userId: 'current-user', data: comment, timestamp: new Date().toISOString() });
      
      return comment;
    } catch (error) {
      log.error('Failed to add comment to DB: ', error);
      // Fallback to local storage
      const comment: Comment = {
        id: crypto.randomUUID(),
        storyboardId: this.currentStoryboardId,
        frameId,
        text,
        position,
        parentId,
        authorId: 'current-user',
        authorName: 'You',
        status: 'open',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (parentId) {
        const parent = this.state.comments.find(c => c.id === parentId);
        if (parent) {
          parent.replies = parent.replies || [];
          parent.replies.push(comment);
        }
      } else {
        this.state.comments.push(comment);
      }

      this.saveCommentsToLocalStorage();
      this.emit({ type: 'comment:added', storyboardId: this.currentStoryboardId, userId: 'current-user', data: comment, timestamp: new Date().toISOString() });
      
      return comment;
    }
  }

  async updateComment(commentId: string, text: string): Promise<Comment | null> {
    try {
      const dbComment = await commentsApi.update(commentId, text);
      const comment = this.findComment(commentId);
      if (comment) {
        comment.text = text;
        comment.updatedAt = dbComment.updatedAt;
      }
      
      this.emit({ type: 'comment:updated', storyboardId: this.currentStoryboardId!, userId: 'current-user', data: comment, timestamp: new Date().toISOString() });
      
      return comment;
    } catch (error) {
      log.error('Failed to update comment:', error);
      // Fallback to local storage
      const comment = this.findComment(commentId);
      if (comment) {
        comment.text = text;
        comment.updatedAt = new Date().toISOString();
        this.saveCommentsToLocalStorage();
        this.emit({ type: 'comment:updated', storyboardId: this.currentStoryboardId!, userId: 'current-user', data: comment, timestamp: new Date().toISOString() });
      }
      return comment;
    }
  }

  private saveCommentsToLocalStorage(): void {
    if (!this.currentStoryboardId) return;
    localStorage.setItem(
      `storyboard_comments_${this.currentStoryboardId}`,
      JSON.stringify(this.state.comments)
    );
  }

  async deleteComment(commentId: string): Promise<boolean> {
    try {
      await commentsApi.delete(commentId);

      const index = this.state.comments.findIndex(c => c.id === commentId);
      if (index !== -1) {
        this.state.comments.splice(index, 1);
      } else {
        // Check in replies
        for (const comment of this.state.comments) {
          if (comment.replies) {
            const replyIndex = comment.replies.findIndex(r => r.id === commentId);
            if (replyIndex !== -1) {
              comment.replies.splice(replyIndex, 1);
              break;
            }
          }
        }
      }

      this.emit({ type: 'comment:deleted', storyboardId: this.currentStoryboardId!, userId: 'current-user', data: { commentId }, timestamp: new Date().toISOString() });
      
      return true;
    } catch (error) {
      log.error('Failed to delete comment:', error);
      return false;
    }
  }

  async resolveComment(commentId: string): Promise<Comment | null> {
    try {
      const dbComment = await commentsApi.resolve(commentId);
      const comment = this.findComment(commentId);
      if (comment) {
        comment.status = 'resolved';
        comment.resolvedAt = dbComment.resolvedAt;
        comment.resolvedBy = dbComment.resolvedBy;
      }
      
      this.emit({ type: 'comment:resolved', storyboardId: this.currentStoryboardId!, userId: 'current-user', data: comment, timestamp: new Date().toISOString() });
      
      return comment;
    } catch (error) {
      log.error('Failed to resolve comment:', error);
      // Fallback to local
      const comment = this.findComment(commentId);
      if (comment) {
        comment.status = 'resolved';
        comment.resolvedAt = new Date().toISOString();
        comment.resolvedBy = 'current-user';
        this.saveCommentsToLocalStorage();
        this.emit({ type: 'comment:resolved', storyboardId: this.currentStoryboardId!, userId: 'current-user', data: comment, timestamp: new Date().toISOString() });
      }
      return comment;
    }
  }

  async reopenComment(commentId: string): Promise<Comment | null> {
    try {
      const dbComment = await commentsApi.reopen(commentId);
      const comment = this.findComment(commentId);
      if (comment) {
        comment.status = 'open';
        comment.resolvedAt = undefined;
        comment.resolvedBy = undefined;
      }
      return comment;
    } catch (error) {
      log.error('Failed to reopen comment:', error);
      return null;
    }
  }

  getComments(frameId?: string): Comment[] {
    if (frameId) {
      return this.state.comments.filter(c => c.frameId === frameId);
    }
    return this.state.comments;
  }

  getCommentCount(frameId?: string): number {
    return this.getComments(frameId).length;
  }

  getUnresolvedCount(frameId?: string): number {
    return this.getComments(frameId).filter(c => c.status === 'open').length;
  }

  private findComment(commentId: string): Comment | null {
    const comment = this.state.comments.find(c => c.id === commentId);
    if (comment) return comment;

    // Check in replies
    for (const c of this.state.comments) {
      if (c.replies) {
        const reply = c.replies.find(r => r.id === commentId);
        if (reply) return reply;
      }
    }
    return null;
  }

  // =========================================================================
  // Version History (Database-backed)
  // =========================================================================

  async loadVersions(): Promise<VersionSnapshot[]> {
    if (!this.currentStoryboardId) return [];
    
    try {
      const dbVersions = await versionsApi.getAll(this.currentStoryboardId);
      this.state.versions = this.convertDBVersionsToVersions(dbVersions);
      return this.state.versions;
    } catch (error) {
      log.error('Failed to load versions from DB:', error);
      // Fallback to localStorage
      const stored = localStorage.getItem(`storyboard_versions_${this.currentStoryboardId}`);
      this.state.versions = stored ? JSON.parse(stored) : [];
      return this.state.versions;
    }
  }

  private convertDBVersionsToVersions(dbVersions: any[]): VersionSnapshot[] {
    return dbVersions.map(db => ({
      id: db.id,
      storyboardId: db.storyboardId,
      version: db.version,
      name: db.name,
      description: db.description,
      frameCount: db.frameCount,
      thumbnail: db.thumbnailUrl,
      data: typeof db.data === 'string' ? db.data : JSON.stringify(db.data),
      authorId: db.authorId,
      authorName: db.authorName,
      type: db.versionType,
      createdAt: db.createdAt,
    }));
  }

  async createVersion(
    storyboard: Storyboard,
    description?: string,
    type: VersionSnapshot['type'] = 'manual'
  ): Promise<VersionSnapshot> {
    try {
      const dbVersion = await versionsApi.create(storyboard.id, {
        description,
        data: storyboard,
        frameCount: storyboard.frames.length,
        thumbnailUrl: storyboard.frames[0]?.thumbnailUrl,
        versionType: type,
      });

      const version = this.convertDBVersionsToVersions([dbVersion])[0];
      this.state.versions.push(version);
      this.emit({ type: 'version:created', storyboardId: storyboard.id, userId: 'current-user', data: version, timestamp: new Date().toISOString() });

      return version;
    } catch (error) {
      log.error('Failed to create version, using localStorage:', error);
      // Fallback to localStorage
      const version: VersionSnapshot = {
        id: crypto.randomUUID(),
        storyboardId: storyboard.id,
        version: this.state.versions.length + 1,
        name: `Version ${this.state.versions.length + 1}`,
        description,
        frameCount: storyboard.frames.length,
        thumbnail: storyboard.frames[0]?.thumbnailUrl,
        data: JSON.stringify(storyboard),
        authorId: 'current-user',
        authorName: 'You',
        type,
        createdAt: new Date().toISOString(),
      };

      this.state.versions.push(version);
      this.saveVersionsToLocalStorage();
      this.emit({ type: 'version:created', storyboardId: storyboard.id, userId: 'current-user', data: version, timestamp: new Date().toISOString() });

      return version;
    }
  }

  private saveVersionsToLocalStorage(): void {
    if (!this.currentStoryboardId) return;
    localStorage.setItem(
      `storyboard_versions_${this.currentStoryboardId}`,
      JSON.stringify(this.state.versions)
    );
  }

  async restoreVersion(versionId: string): Promise<Storyboard | null> {
    const version = this.state.versions.find(v => v.id === versionId);
    if (!version) return null;

    const storyboard: Storyboard = typeof version.data === 'string' 
      ? JSON.parse(version.data) 
      : version.data;
    
    this.emit({ type: 'version:restored', storyboardId: this.currentStoryboardId!, userId: 'current-user', data: { versionId, version: version.version }, timestamp: new Date().toISOString() });
    
    return storyboard;
  }

  async deleteVersion(versionId: string): Promise<boolean> {
    const version = this.state.versions.find(v => v.id === versionId);
    if (!version) return false;
    
    // Don't allow deleting milestones
    if (version.type === 'milestone') {
      log.warn('Cannot delete milestone versions');
      return false;
    }

    try {
      await versionsApi.delete(versionId);
      const index = this.state.versions.findIndex(v => v.id === versionId);
      if (index !== -1) {
        this.state.versions.splice(index, 1);
      }
      return true;
    } catch (error) {
      log.error('Failed to delete version:', error);
      return false;
    }
  }

  getVersions(): VersionSnapshot[] {
    return [...this.state.versions].sort((a, b) => b.version - a.version);
  }

  getLatestVersion(): VersionSnapshot | null {
    return this.state.versions.length > 0
      ? this.state.versions[this.state.versions.length - 1]
      : null;
  }

  // Auto-save versions
  private startAutoSave(): void {
    this.autoSaveInterval = setInterval(() => {
      // Auto-save would be triggered by the component when changes occur
    }, 5 * 60 * 1000); // Check every 5 minutes
  }

  private stopAutoSave(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }

  // =========================================================================
  // Team Members & Sharing (Database-backed)
  // =========================================================================

  async loadTeamMembers(): Promise<TeamMember[]> {
    if (!this.currentStoryboardId) return [];
    
    try {
      const dbMembers = await teamApi.getAll(this.currentStoryboardId);
      this.state.teamMembers = this.convertDBMembersToTeamMembers(dbMembers);
      return this.state.teamMembers;
    } catch (error) {
      log.error('Failed to load team members from DB:', error);
      // Fallback to localStorage
      const stored = localStorage.getItem(`storyboard_team_${this.currentStoryboardId}`);
      this.state.teamMembers = stored ? JSON.parse(stored) : [];
      return this.state.teamMembers;
    }
  }

  private convertDBMembersToTeamMembers(dbMembers: any[]): TeamMember[] {
    return dbMembers.map(db => ({
      id: db.id,
      storyboardId: db.storyboardId,
      userId: db.userId,
      userName: db.userName,
      userEmail: db.userEmail,
      userAvatar: db.userAvatar,
      permission: db.permission as PermissionLevel,
      invitedBy: db.invitedBy,
      invitedAt: db.invitedAt,
      acceptedAt: db.acceptedAt,
      lastActiveAt: db.lastActiveAt,
    }));
  }

  async inviteTeamMember(
    email: string,
    permission: PermissionLevel = 'comment'
  ): Promise<TeamMember> {
    if (!this.currentStoryboardId) {
      throw new Error('No storyboard selected');
    }

    try {
      const dbMember = await teamApi.invite(this.currentStoryboardId, {
        userName: email.split('@')[0],
        userEmail: email,
        permission,
      });

      const member = this.convertDBMembersToTeamMembers([dbMember])[0];
      this.state.teamMembers.push(member);
      
      log.debug(`Invitation sent to ${email}`);
      
      return member;
    } catch (error) {
      log.error('Failed to invite team member, using localStorage:', error);
      // Fallback to localStorage
      const member: TeamMember = {
        id: crypto.randomUUID(),
        storyboardId: this.currentStoryboardId,
        userId: crypto.randomUUID(),
        userName: email.split('@')[0],
        userEmail: email,
        permission,
        invitedBy: 'current-user',
        invitedAt: new Date().toISOString(),
      };

      this.state.teamMembers.push(member);
      this.saveTeamMembersToLocalStorage();
      
      log.debug(`Invitation saved locally for ${email}`);
      
      return member;
    }
  }

  private saveTeamMembersToLocalStorage(): void {
    if (!this.currentStoryboardId) return;
    localStorage.setItem(
      `storyboard_team_${this.currentStoryboardId}`,
      JSON.stringify(this.state.teamMembers)
    );
  }

  async updateMemberPermission(
    memberId: string,
    permission: PermissionLevel
  ): Promise<TeamMember | null> {
    try {
      const dbMember = await teamApi.updatePermission(memberId, permission);
      const member = this.state.teamMembers.find(m => m.id === memberId);
      if (member) {
        member.permission = permission;
      }
      return member;
    } catch (error) {
      log.error('Failed to update member permission:', error);
      return null;
    }
  }

  async removeMember(memberId: string): Promise<boolean> {
    try {
      await teamApi.remove(memberId);
      const index = this.state.teamMembers.findIndex(m => m.id === memberId);
      if (index !== -1) {
        this.state.teamMembers.splice(index, 1);
      }
      this.emit({ type: 'member:left', storyboardId: this.currentStoryboardId!, userId: memberId, data: { memberId }, timestamp: new Date().toISOString() });
      return true;
    } catch (error) {
      log.error('Failed to remove member:', error);
      return false;
    }
  }

  getTeamMembers(): TeamMember[] {
    return this.state.teamMembers;
  }

  // =========================================================================
  // Share Links (Database-backed)
  // =========================================================================

  async loadShareLinks(): Promise<ShareLink[]> {
    if (!this.currentStoryboardId) return [];
    
    try {
      const dbLinks = await shareLinksApi.getAll(this.currentStoryboardId);
      this.state.shareLinks = this.convertDBLinksToShareLinks(dbLinks);
      return this.state.shareLinks;
    } catch (error) {
      log.error('Failed to load share links from DB:', error);
      // Fallback to localStorage
      const stored = localStorage.getItem(`storyboard_links_${this.currentStoryboardId}`);
      this.state.shareLinks = stored ? JSON.parse(stored) : [];
      return this.state.shareLinks;
    }
  }

  private convertDBLinksToShareLinks(dbLinks: any[]): ShareLink[] {
    return dbLinks.map(db => ({
      id: db.id,
      storyboardId: db.storyboardId,
      token: db.token,
      permission: db.permission as PermissionLevel,
      expiresAt: db.expiresAt,
      maxViews: db.maxViews,
      viewCount: db.viewCount,
      requiresPassword: db.requiresPassword,
      createdBy: db.createdBy,
      createdAt: db.createdAt,
      lastAccessedAt: db.lastAccessedAt,
    }));
  }

  async createShareLink(options: {
    permission?: PermissionLevel;
    expiresIn?: number; // hours
    maxViews?: number;
    password?: string;
  } = {}): Promise<ShareLink> {
    if (!this.currentStoryboardId) {
      throw new Error('No storyboard selected, ');
    }

    try {
      const dbLink = await shareLinksApi.create(this.currentStoryboardId, {
        permission: options.permission,
        expiresIn: options.expiresIn,
        maxViews: options.maxViews,
        password: options.password,
      });

      const link = this.convertDBLinksToShareLinks([dbLink])[0];
      this.state.shareLinks.push(link);
      
      return link;
    } catch (error) {
      log.error('Failed to create share link, using localStorage:', error);
      // Fallback to localStorage
      const token = this.generateToken();
      const link: ShareLink = {
        id: crypto.randomUUID(),
        storyboardId: this.currentStoryboardId,
        token,
        permission: options.permission || 'view',
        expiresAt: options.expiresIn
          ? new Date(Date.now() + options.expiresIn * 60 * 60 * 1000).toISOString()
          : undefined,
        maxViews: options.maxViews,
        viewCount: 0,
        requiresPassword: !!options.password,
        passwordHash: options.password ? this.hashPassword(options.password) : undefined,
        createdBy: 'current-user',
        createdAt: new Date().toISOString(),
      };

      this.state.shareLinks.push(link);
      this.saveShareLinksToLocalStorage();
      
      return link;
    }
  }

  private generateToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = ', ';
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  private hashPassword(password: string): string {
    // Simple hash for demo - in production use proper crypto
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  private saveShareLinksToLocalStorage(): void {
    if (!this.currentStoryboardId) return;
    localStorage.setItem(
      `storyboard_links_${this.currentStoryboardId}`,
      JSON.stringify(this.state.shareLinks)
    );
  }

  async deleteShareLink(linkId: string): Promise<boolean> {
    try {
      await shareLinksApi.delete(linkId);
      const index = this.state.shareLinks.findIndex(l => l.id === linkId);
      if (index !== -1) {
        this.state.shareLinks.splice(index, 1);
      }
      return true;
    } catch (error) {
      log.error('Failed to delete share link:', error);
      // Fallback to localStorage
      const index = this.state.shareLinks.findIndex(l => l.id === linkId);
      if (index !== -1) {
        this.state.shareLinks.splice(index, 1);
        this.saveShareLinksToLocalStorage();
      }
      return true;
    }
  }

  getShareLinks(): ShareLink[] {
    return this.state.shareLinks;
  }

  getShareUrl(link: ShareLink): string {
    return shareLinksApi.getShareUrl(link.token);
  }

  // =========================================================================
  // Active Collaborators (Real-time)
  // =========================================================================

  getActiveCollaborators(): ActiveCollaborator[] {
    return this.state.activeCollaborators;
  }

  updatePresence(frameId?: string, cursor?: { x: number; y: number }): void {
    // In production, this would send to WebSocket server
    const presence: ActiveCollaborator = {
      userId: 'current-user',
      userName: 'You',
      currentFrameId: frameId,
      cursor,
      color: '#4CAF50',
      lastActiveAt: new Date().toISOString(),
    };

    const index = this.state.activeCollaborators.findIndex(c => c.userId === 'current-user');
    if (index !== -1) {
      this.state.activeCollaborators[index] = presence;
    } else {
      this.state.activeCollaborators.push(presence);
    }

    this.emit({
      type: cursor ? 'cursor:moved' : 'frame:selected',
      storyboardId: this.currentStoryboardId!,
      userId: 'current-user',
      data: presence,
      timestamp: new Date().toISOString(),
    });
  }

  // =========================================================================
  // Event System
  // =========================================================================

  on(handler: CollaborationEventHandler): () => void {
    this.eventHandlers.push(handler);
    return () => {
      const index = this.eventHandlers.indexOf(handler);
      if (index !== -1) this.eventHandlers.splice(index, 1);
    };
  }

  private emit(event: CollaborationEvent): void {
    this.eventHandlers.forEach(handler => handler(event));
  }

  // =========================================================================
  // Utility Methods
  // =========================================================================

  getState(): CollaborationState {
    return { ...this.state };
  }

  hasPermission(level: PermissionLevel): boolean {
    // In production, would check actual user permissions
    const levels: PermissionLevel[] = ['view','comment','edit','admin'];
    const userLevel ='admin'; // Would come from auth
    return levels.indexOf(userLevel) >= levels.indexOf(level);
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const storyboardCollaborationService = new StoryboardCollaborationService();

export default storyboardCollaborationService;

