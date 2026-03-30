/**
 * Session Tracking Service
 * 
 * Tracks user activity in Virtual Studio for:
 * - Continue where you left off feature
 * - Session summary and recap
 * - Activity logging
 * - Auto-save state management
 */

import { logger } from './logger';
import type { SessionSummary, SessionActivity } from '../../ui/components/ContinueSessionDialog';

const log = logger.module('SessionTracking');
const STORAGE_KEY = 'virtualStudio_session';
const API_BASE = '/api/virtual-studio/session';

// =============================================================================
// Types
// =============================================================================

interface SessionState {
  id: string;
  name: string;
  projectId?: string;
  startedAt: Date;
  lastActivityAt: Date;
  totalDuration: number; // minutes
  
  // Scene state
  sceneSnapshot: {
    nodes: any[];
    cameraState: any;
    hdriId?: string;
    hdriName?: string;
    lightingPresetId?: string;
    lightingPresetName?: string;
    backdropId?: string;
    backdropName?: string;
  };
  
  // Stats
  lightCount: number;
  cameraCount: number;
  actorCount: number;
  propCount: number;
  
  // User context
  profession?: string;
  specialization?: string;
  
  // Activity log
  activities: SessionActivity[];
  
  // Feature usage
  storyboardFrameCount: number;
  animationClipCount: number;
  
  // Class photo
  classPhotoSession?: {
    studentCount: number;
    rowCount: number;
    ageGroup: string;
  };
  
  // Unsaved changes
  hasUnsavedChanges: boolean;
  lastSavedAt?: Date;
  
  // Thumbnail
  thumbnail?: string;
}

// =============================================================================
// Service
// =============================================================================

class SessionTrackingService {
  private session: SessionState | null = null;
  private saveInterval: NodeJS.Timeout | null = null;
  private activityThrottleTimer: NodeJS.Timeout | null = null;
  private lastActivityType: string | null = null;

  /**
   * Initialize session tracking
   */
  initialize(): void {
    // Start periodic save
    this.saveInterval = setInterval(() => {
      this.saveToStorage();
    }, 30000); // Save every 30 seconds

    // Track page visibility
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    
    // Track before unload
    window.addEventListener('beforeunload', this.handleBeforeUnload);

    log.info('Session tracking initialized');
  }

  /**
   * Cleanup on unmount
   */
  cleanup(): void {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
    }
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    
    // Final save
    this.saveToStorage();
    
    log.info('Session tracking cleanup');
  }

  /**
   * Start a new session
   */
  startSession(options: {
    name?: string;
    projectId?: string;
    profession?: string;
    specialization?: string;
  } = {}): void {
    this.session = {
      id: `session_${Date.now()}`,
      name: options.name || 'Untitled Project',
      projectId: options.projectId,
      startedAt: new Date(),
      lastActivityAt: new Date(),
      totalDuration: 0,
      sceneSnapshot: {
        nodes: [],
        cameraState: null,
      },
      lightCount: 0,
      cameraCount: 0,
      actorCount: 0,
      propCount: 0,
      profession: options.profession,
      specialization: options.specialization,
      activities: [],
      storyboardFrameCount: 0,
      animationClipCount: 0,
      hasUnsavedChanges: false,
    };
    
    this.saveToStorage();
    log.info('New session started: ', this.session.id);
  }

  /**
   * Resume existing session
   */
  resumeSession(): SessionState | null {
    return this.session;
  }

  /**
   * Check if there's a previous session to continue
   */
  async hasPreviousSession(): Promise<boolean> {
    await this.loadFromStorage();
    return this.session !== null && this.session.activities.length > 0;
  }

  /**
   * Get session summary for dialog
   */
  async getSessionSummary(): Promise<SessionSummary | null> {
    await this.loadFromStorage();
    
    if (!this.session) return null;
    
    return {
      id: this.session.id,
      name: this.session.name,
      lastModified: new Date(this.session.lastActivityAt),
      duration: this.session.totalDuration,
      thumbnail: this.session.thumbnail,
      lightCount: this.session.lightCount,
      cameraCount: this.session.cameraCount,
      actorCount: this.session.actorCount,
      propCount: this.session.propCount,
      hdriName: this.session.sceneSnapshot.hdriName,
      lightingPreset: this.session.sceneSnapshot.lightingPresetName,
      backdropName: this.session.sceneSnapshot.backdropName,
      projectType: this.session.profession,
      specialization: this.session.specialization,
      activities: this.session.activities,
      hasUnsavedChanges: this.session.hasUnsavedChanges,
      classPhotoSession: this.session.classPhotoSession,
      storyboardFrameCount: this.session.storyboardFrameCount,
      animationClipCount: this.session.animationClipCount,
    };
  }

  /**
   * Update scene snapshot
   */
  updateSceneSnapshot(snapshot: Partial<SessionState['sceneSnapshot']>): void {
    if (!this.session) return;
    
    this.session.sceneSnapshot = {
      ...this.session.sceneSnapshot,
      ...snapshot,
    };
    this.session.hasUnsavedChanges = true;
    this.updateLastActivity();
  }

  /**
   * Update node counts
   */
  updateNodeCounts(nodes: any[]): void {
    if (!this.session) return;
    
    this.session.lightCount = nodes.filter(n => n.type === 'light').length;
    this.session.cameraCount = nodes.filter(n => n.type === 'camera').length;
    this.session.actorCount = nodes.filter(n => n.type === 'actor' || n.type === 'virtualActor').length;
    this.session.propCount = nodes.filter(n => n.type === 'prop' || n.type === 'backdrop').length;
    this.session.sceneSnapshot.nodes = nodes;
    this.session.hasUnsavedChanges = true;
  }

  /**
   * Record an activity
   */
  recordActivity(
    type: SessionActivity['type'], 
    description: string,
    throttle: boolean = true
  ): void {
    if (!this.session) return;

    // Throttle similar activities
    if (throttle && this.lastActivityType === type) {
      if (this.activityThrottleTimer) return;
      this.activityThrottleTimer = setTimeout(() => {
        this.activityThrottleTimer = null;
        this.lastActivityType = null;
      }, 5000);
    }
    
    this.lastActivityType = type;

    const activity: SessionActivity = {
      type,
      description,
      timestamp: new Date(),
    };
    
    // Keep last 50 activities
    this.session.activities = [activity, ...this.session.activities].slice(0, 50);
    this.session.hasUnsavedChanges = true;
    this.updateLastActivity();
    
    log.debug('Activity recorded', { type, description });
  }

  /**
   * Update HDRI info
   */
  setHDRI(id: string, name: string): void {
    if (!this.session) return;
    this.session.sceneSnapshot.hdriId = id;
    this.session.sceneSnapshot.hdriName = name;
    this.recordActivity('hdri_changed', `Changed environment to ${name}`);
  }

  /**
   * Update lighting preset
   */
  setLightingPreset(id: string, name: string): void {
    if (!this.session) return;
    this.session.sceneSnapshot.lightingPresetId = id;
    this.session.sceneSnapshot.lightingPresetName = name;
    this.recordActivity('preset_applied', `Applied lighting preset: ${name}`);
  }

  /**
   * Update backdrop
   */
  setBackdrop(id: string, name: string): void {
    if (!this.session) return;
    this.session.sceneSnapshot.backdropId = id;
    this.session.sceneSnapshot.backdropName = name;
    this.recordActivity('prop_placed', `Set backdrop: ${name}`);
  }

  /**
   * Update class photo session
   */
  setClassPhotoSession(info: { studentCount: number; rowCount: number; ageGroup: string }): void {
    if (!this.session) return;
    this.session.classPhotoSession = info;
    this.session.specialization = 'school_photography';
    this.recordActivity('class_photo_setup', `Class photo: ${info.studentCount} students, ${info.rowCount} rows`);
  }

  /**
   * Update storyboard count
   */
  updateStoryboardCount(count: number): void {
    if (!this.session) return;
    this.session.storyboardFrameCount = count;
  }

  /**
   * Update animation count
   */
  updateAnimationCount(count: number): void {
    if (!this.session) return;
    this.session.animationClipCount = count;
  }

  /**
   * Set session thumbnail
   */
  setThumbnail(dataUrl: string): void {
    if (!this.session) return;
    this.session.thumbnail = dataUrl;
  }

  /**
   * Mark session as saved
   */
  markSaved(): void {
    if (!this.session) return;
    this.session.hasUnsavedChanges = false;
    this.session.lastSavedAt = new Date();
    log.info('Session marked as saved');
  }

  /**
   * Clear session (start fresh)
   */
  clearSession(): void {
    this.session = null;
    localStorage.removeItem(STORAGE_KEY);
    this.syncToAPI('DELETE');
    log.info('Session cleared');
  }

  /**
   * Update project name
   */
  setProjectName(name: string): void {
    if (!this.session) return;
    this.session.name = name;
    this.saveToStorage();
  }

  // =============================================================================
  // Private Methods
  // =============================================================================

  private updateLastActivity(): void {
    if (!this.session) return;
    
    const now = new Date();
    const lastActivity = new Date(this.session.lastActivityAt);
    const diffMinutes = Math.floor((now.getTime() - lastActivity.getTime()) / 60000);
    
    // Only add to duration if less than 5 minutes since last activity (user is active)
    if (diffMinutes < 5) {
      this.session.totalDuration += diffMinutes;
    }
    
    this.session.lastActivityAt = now;
  }

  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      // Page hidden - save state
      this.saveToStorage();
    } else {
      // Page visible - update activity
      this.updateLastActivity();
    }
  };

  private handleBeforeUnload = (): void => {
    this.saveToStorage();
  };

  private async saveToStorage(): Promise<void> {
    if (!this.session) return;
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.session));
      await this.syncToAPI('PUT');
    } catch (error) {
      log.warn('Failed to save session:', error);
    }
  }

  private async loadFromStorage(): Promise<void> {
    try {
      // Try API first
      const apiSession = await this.loadFromAPI();
      if (apiSession) {
        this.session = apiSession;
        return;
      }
    } catch (error) {
      log.warn('Failed to load from API, trying localStorage', error);
    }
    
    // Fallback to localStorage
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        this.session = JSON.parse(saved);
        // Convert date strings back to Date objects
        if (this.session) {
          this.session.startedAt = new Date(this.session.startedAt);
          this.session.lastActivityAt = new Date(this.session.lastActivityAt);
          if (this.session.lastSavedAt) {
            this.session.lastSavedAt = new Date(this.session.lastSavedAt);
          }
          this.session.activities = this.session.activities.map(a => ({
            ...a,
            timestamp: new Date(a.timestamp),
          }));
        }
      }
    } catch (error) {
      log.warn('Failed to load session from localStorage:', error);
    }
  }

  private async syncToAPI(method: 'PUT' | 'DELETE'): Promise<void> {
    try {
      await fetch(API_BASE, {
        method,
        credentials: 'include',
        headers: { 'Content-Type' : 'application/json' },
        body: method === 'PUT' ? JSON.stringify(this.session) : undefined,
      });
    } catch (error) {
      log.warn('Failed to sync session to API, keeping local snapshot only', error);
    }
  }

  private async loadFromAPI(): Promise<SessionState | null> {
    try {
      const response = await fetch(API_BASE, {
        credentials:'include',
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.session) {
          return data.session;
        }
      }
    } catch (error) {
      log.warn('Failed to load session from API response', error);
    }
    return null;
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const sessionTrackingService = new SessionTrackingService();
export default sessionTrackingService;
