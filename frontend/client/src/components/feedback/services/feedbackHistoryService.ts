/**
 * FeedbackHistoryService - History, Offline Support, and Draft Management
 * 
 * Features:
 * - View own submitted feedback (database-backed)
 * - Track status changes
 * - Offline queue with sync
 * - Database persistence with localStorage fallback
 * - Draft auto-save
 */

import { apiRequest } from '@/lib/queryClient';

const API_BASE = '/api/prototype-testing';

// ============================================================================
// Types
// ============================================================================

export interface FeedbackItem {
  id: string;
  userId: string;
  profession: string;
  feedbackType: 'bug' | 'feature' | 'usability' | 'general';
  title: string;
  description: string;
  rating: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  component?: string;
  screenshot?: string;
  audioRecording?: string;
  videoRecording?: string;
  tags: string[];
  isAnonymous: boolean;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  adminResponse?: string;
  createdAt: string;
  updatedAt?: string;
  resolvedAt?: string;
}

export interface FeedbackDraft {
  id: string;
  data: Partial<FeedbackItem>;
  savedAt: number;
  autoSaved: boolean;
}

export interface OfflineQueueItem {
  id: string;
  feedback: Partial<FeedbackItem>;
  attempts: number;
  lastAttempt: number;
  createdAt: number;
}

export interface StatusUpdate {
  feedbackId: string;
  oldStatus: string;
  newStatus: string;
  message?: string;
  timestamp: number;
  seen: boolean;
}

// ============================================================================
// Storage Keys
// ============================================================================

const STORAGE_KEYS = {
  DRAFTS: 'prototype_feedback_drafts',
  OFFLINE_QUEUE: 'prototype_feedback_offline_queue',
  HISTORY: 'prototype_feedback_history',
  STATUS_UPDATES: 'prototype_feedback_status_updates',
  LAST_SYNC: 'prototype_feedback_last_sync',
};

// ============================================================================
// FeedbackHistoryService
// ============================================================================

class FeedbackHistoryService {
  private syncInterval: NodeJS.Timeout | null = null;
  private onlineListener: (() => void) | null = null;
  private currentUserId: string | null = null;

  constructor() {
    this.setupOfflineSync();
  }

  setUserId(userId: string): void {
    this.currentUserId = userId;
  }

  // --------------------------------------------------------------------------
  // Draft Management (Database-backed with localStorage fallback)
  // --------------------------------------------------------------------------

  async saveDraft(id: string, data: Partial<FeedbackItem>, autoSaved = false): Promise<void> {
    // Save to localStorage immediately for fast access
    const drafts = this.getLocalDrafts();
    const draft: FeedbackDraft = {
      id,
      data,
      savedAt: Date.now(),
      autoSaved,
    };

    const existingIndex = drafts.findIndex(d => d.id === id);
    if (existingIndex >= 0) {
      drafts[existingIndex] = draft;
    } else {
      drafts.push(draft);
    }

    const sortedDrafts = drafts.sort((a, b) => b.savedAt - a.savedAt).slice(0, 10);
    localStorage.setItem(STORAGE_KEYS.DRAFTS, JSON.stringify(sortedDrafts));

    // Also save to database if user is logged in
    if (this.currentUserId) {
      try {
        await apiRequest(`${API_BASE}/drafts`, {
          method: 'POST',
          body: JSON.stringify({
            userId: this.currentUserId,
            draftId: id,
            data,
            autoSaved
          }),
        });
      } catch (error) {
        console.warn('Failed to save draft to database, using localStorage: ', error);
      }
    }
  }

  private getLocalDrafts(): FeedbackDraft[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.DRAFTS);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  async getDrafts(): Promise<FeedbackDraft[]> {
    // Try database first
    if (this.currentUserId) {
      try {
        const dbDrafts = await apiRequest(`${API_BASE}/drafts/${this.currentUserId}`);
        if (dbDrafts && dbDrafts.length > 0) {
          // Update localStorage with database data
          localStorage.setItem(STORAGE_KEYS.DRAFTS, JSON.stringify(dbDrafts));
          return dbDrafts;
        }
      } catch (error) {
        console.warn('Failed to fetch drafts from database: ', error);
      }
    }
    
    // Fallback to localStorage
    return this.getLocalDrafts();
  }

  getDraft(id: string): FeedbackDraft | null {
    return this.getLocalDrafts().find(d => d.id === id) || null;
  }

  getLatestDraft(): FeedbackDraft | null {
    const drafts = this.getLocalDrafts();
    return drafts.length > 0 ? drafts[0] : null;
  }

  async deleteDraft(id: string): Promise<void> {
    // Delete from localStorage
    const drafts = this.getLocalDrafts().filter(d => d.id !== id);
    localStorage.setItem(STORAGE_KEYS.DRAFTS, JSON.stringify(drafts));

    // Delete from database
    if (this.currentUserId) {
      try {
        await apiRequest(`${API_BASE}/drafts/${this.currentUserId}/${id}`, {
          method: 'DELETE',
        });
      } catch (error) {
        console.warn('Failed to delete draft from database:', error);
      }
    }
  }

  clearDrafts(): void {
    localStorage.removeItem(STORAGE_KEYS.DRAFTS);
  }

  // --------------------------------------------------------------------------
  // Offline Queue (Database-backed with localStorage fallback)
  // --------------------------------------------------------------------------

  queueForOffline(feedback: Partial<FeedbackItem>): string {
    const queue = this.getLocalOfflineQueue();
    const id = `offline_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    
    const item: OfflineQueueItem = {
      id,
      feedback,
      attempts: 0,
      lastAttempt: 0,
      createdAt: Date.now(),
    };

    queue.push(item);
    localStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
    
    return id;
  }

  private getLocalOfflineQueue(): OfflineQueueItem[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  getOfflineQueue(): OfflineQueueItem[] {
    return this.getLocalOfflineQueue();
  }

  removeFromQueue(id: string): void {
    const queue = this.getLocalOfflineQueue().filter(item => item.id !== id);
    localStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
  }

  async processOfflineQueue(): Promise<{ success: number; failed: number }> {
    if (!navigator.onLine) {
      return { success: 0, failed: 0 };
    }

    const queue = this.getLocalOfflineQueue();
    let success = 0;
    let failed = 0;

    for (const item of queue) {
      try {
        // Submit to new database-backed API
        await apiRequest(`${API_BASE}/feedback`, {
          method: 'POST',
          body: JSON.stringify({
            ...item.feedback,
            offlineId: item.id,
            offlineCreatedAt: new Date(item.createdAt).toISOString(),
          }),
        });

        // Record sync in database
        if (this.currentUserId) {
          await apiRequest(`${API_BASE}/offline/sync`, {
            method: 'POST',
            body: JSON.stringify({
              userId: this.currentUserId,
              offlineId: item.id,
              feedbackData: item.feedback
            }),
          });
        }

        this.removeFromQueue(item.id);
        success++;
      } catch (error) {
        // Update attempt count
        item.attempts++;
        item.lastAttempt = Date.now();
        
        // Remove after 5 failed attempts
        if (item.attempts >= 5) {
          this.removeFromQueue(item.id);
        }
        
        failed++;
      }
    }

    // Update queue with new attempt counts
    const updatedQueue = this.getLocalOfflineQueue();
    localStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(updatedQueue));

    return { success, failed };
  }

  private setupOfflineSync(): void {
    if (typeof window === 'undefined') return;

    // Sync when coming online
    this.onlineListener = () => {
      this.processOfflineQueue();
    };
    window.addEventListener('online', this.onlineListener);

    // Periodic sync check
    this.syncInterval = setInterval(() => {
      if (navigator.onLine) {
        this.processOfflineQueue();
      }
    }, 60000); // Every minute
  }

  destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    if (this.onlineListener) {
      window.removeEventListener('online', this.onlineListener);
    }
  }

  // --------------------------------------------------------------------------
  // History (Database-backed with localStorage cache)
  // --------------------------------------------------------------------------

  async fetchHistory(userId: string): Promise<FeedbackItem[]> {
    this.currentUserId = userId;
    
    try {
      // Fetch from database API
      const response = await apiRequest(`${API_BASE}/feedback/user/${userId}`);
      
      // Cache locally for offline access
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(response));
      localStorage.setItem(STORAGE_KEYS.LAST_SYNC, Date.now().toString());
      
      return response as FeedbackItem[];
    } catch (error) {
      console.warn('Failed to fetch history from database, using cache:', error);
      // Return cached if offline
      return this.getCachedHistory();
    }
  }

  getCachedHistory(): FeedbackItem[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.HISTORY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  getLastSyncTime(): number | null {
    const stored = localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
    return stored ? parseInt(stored, 10) : null;
  }

  // --------------------------------------------------------------------------
  // Status Updates & Notifications (Database-backed)
  // --------------------------------------------------------------------------

  async fetchStatusUpdates(): Promise<StatusUpdate[]> {
    if (!this.currentUserId) {
      return this.getLocalStatusUpdates();
    }

    try {
      const response = await apiRequest(`${API_BASE}/notifications/${this.currentUserId}`);
      const updates: StatusUpdate[] = (response || []).map((u: any) => ({
        feedbackId: u.feedbackId,
        oldStatus: u.oldStatus,
        newStatus: u.newStatus,
        message: u.message,
        timestamp: new Date(u.timestamp).getTime(),
        seen: u.seen
      }));
      
      // Cache locally
      localStorage.setItem(STORAGE_KEYS.STATUS_UPDATES, JSON.stringify(updates));
      return updates;
    } catch (error) {
      return this.getLocalStatusUpdates();
    }
  }

  private getLocalStatusUpdates(): StatusUpdate[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.STATUS_UPDATES);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

    addStatusUpdate(update: Omit<StatusUpdate, 'seen'>): void {
    const updates = this.getLocalStatusUpdates();
    updates.push({ ...update, seen: false });
    
    // Keep last 50 updates
    const sorted = updates.sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);
    localStorage.setItem(STORAGE_KEYS.STATUS_UPDATES, JSON.stringify(sorted));
  }

  getStatusUpdates(): StatusUpdate[] {
    return this.getLocalStatusUpdates();
  }

  getUnseenUpdates(): StatusUpdate[] {
    return this.getLocalStatusUpdates().filter(u => !u.seen);
  }

  async markUpdateSeen(feedbackId: string): Promise<void> {
    // Update locally
    const updates = this.getLocalStatusUpdates().map(u => 
      u.feedbackId === feedbackId ? { ...u, seen: true } : u
    );
    localStorage.setItem(STORAGE_KEYS.STATUS_UPDATES, JSON.stringify(updates));

    // Update in database
    if (this.currentUserId) {
      try {
        await apiRequest(`${API_BASE}/notifications/${feedbackId}/seen`, {
          method: 'PUT',
        });
      } catch (error) {
        console.warn('Failed to mark notification as seen in database:', error);
      }
    }
  }

  async markAllSeen(): Promise<void> {
    // Update locally
    const updates = this.getLocalStatusUpdates().map(u => ({ ...u, seen: true }));
    localStorage.setItem(STORAGE_KEYS.STATUS_UPDATES, JSON.stringify(updates));

    // Update in database
    if (this.currentUserId) {
      try {
        await apiRequest(`${API_BASE}/notifications/${this.currentUserId}/all-seen`, {
          method: 'PUT',
        });
      } catch (error) {
        console.warn('Failed to mark all notifications as seen in database:', error);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Replies
  // --------------------------------------------------------------------------

  async submitReply(feedbackId: string, message: string): Promise<boolean> {
    try {
      await apiRequest(`${API_BASE}/feedback/${feedbackId}/reply`, {
        method:'POST',
        body: JSON.stringify({ message }),
      });
      return true;
    } catch {
      return false;
    }
  }

  // --------------------------------------------------------------------------
  // Statistics (from cached history)
  // --------------------------------------------------------------------------

  getLocalStats(): {
    totalSubmitted: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    avgRating: number;
  } {
    const history = this.getCachedHistory();
    
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let totalRating = 0;

    for (const item of history) {
      byType[item.feedbackType] = (byType[item.feedbackType] || 0) + 1;
      byStatus[item.status] = (byStatus[item.status] || 0) + 1;
      totalRating += item.rating;
    }

    return {
      totalSubmitted: history.length,
      byType,
      byStatus,
      avgRating: history.length > 0 ? totalRating / history.length : 0,
    };
  }
}

// ============================================================================
// Auto-save Hook
// ============================================================================

export function useAutoSave(
  draftId: string,
  data: Partial<FeedbackItem>,
  delay = 5000
) {
  const timeoutRef = { current: null as NodeJS.Timeout | null };

  const save = () => {
    if (data.title || data.description) {
      feedbackHistoryService.saveDraft(draftId, data, true);
    }
  };

  // Debounced auto-save
  if (timeoutRef.current) {
    clearTimeout(timeoutRef.current);
  }
  timeoutRef.current = setTimeout(save, delay);

  return {
    saveNow: () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      feedbackHistoryService.saveDraft(draftId, data, false);
    },
    cancel: () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
  };
}

// ============================================================================
// Export
// ============================================================================

export const feedbackHistoryService = new FeedbackHistoryService();
export default feedbackHistoryService;

