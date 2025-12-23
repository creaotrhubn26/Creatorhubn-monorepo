/**
 * Storyboard Sync Service
 * 
 * Connects the Zustand storyboard store to the database API.
 * Handles:
 * - Auto-sync on changes
 * - Conflict resolution
 * - Offline support with queue
 * - Background sync
 */

import { logger } from './logger';
import { useStoryboardStore } from '../../state/storyboardStore';

const log = logger.module('StoryboardSync, ');
import { storyboardsApi, framesApi } from '../api/storyboardApi';

// User ID placeholder - in production, get from auth context
const getCurrentUserId = () => {
  // Try to get from localStorage or return a default
  return localStorage.getItem('userId,') || 'local-user';
};

// Sync status
export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

interface SyncState {
  status: SyncStatus;
  lastSynced: string | null;
  pendingChanges: number;
  error: string | null;
}

let syncState: SyncState = {
  status: 'idle',
  lastSynced: null,
  pendingChanges: 0,
  error: null,
};

const listeners: Set<(state: SyncState) => void> = new Set();

const notifyListeners = () => {
  listeners.forEach((listener) => listener(syncState));
};

export const storyboardSyncService = {
  // Subscribe to sync state changes
  subscribe: (listener: (state: SyncState) => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  // Get current sync state
  getState: () => syncState,

  // Sync all storyboards from server
  fetchAll: async (): Promise<void> => {
    const userId = getCurrentUserId();
    
    try {
      syncState = { ...syncState, status: 'syncing', error: null };
      notifyListeners();

      const serverStoryboards = await storyboardsApi.list(userId);
      
      // Merge with local store
      const store = useStoryboardStore.getState();
      const localStoryboards = store.storyboards;

      // For each server storyboard, update or add to local
      for (const serverSb of serverStoryboards) {
        const localSb = localStoryboards.find((s) => s.id === serverSb.id);
        
        if (!localSb) {
          // New from server - add locally
          // Convert DB format to store format
          const fullSb = await storyboardsApi.get(serverSb.id);
          store.storyboards.push({
            id: fullSb.id,
            name: fullSb.name,
            aspectRatio: fullSb.aspectRatio,
            frames: fullSb.frames.map((f) => ({
              id: f.id,
              storyboardId: f.storyboardId,
              index: f.index,
              image: f.imageUrl || ', ',
              thumbnail: f.thumbnailUrl,
              shotType: f.shotType as any,
              cameraAngle: f.cameraAngle as any,
              cameraMovement: f.cameraMovement as any,
              duration: f.duration,
              title: f.title,
              description: f.description,
              technicalNotes: f.technicalNotes,
              dialogue: f.dialogue,
              status: f.status,
              createdAt: f.createdAt,
              updatedAt: f.updatedAt,
            })),
            createdAt: fullSb.createdAt,
            updatedAt: fullSb.updatedAt,
          });
        } else {
          // Exists locally - check timestamps for conflict resolution
          const serverTime = new Date(serverSb.updatedAt).getTime();
          const localTime = new Date(localSb.updatedAt).getTime();

          if (serverTime > localTime) {
            // Server is newer - update local
            const fullSb = await storyboardsApi.get(serverSb.id);
            store.updateStoryboard(serverSb.id, {
              name: fullSb.name,
              aspectRatio: fullSb.aspectRatio,
              frames: fullSb.frames.map((f) => ({
                id: f.id,
                storyboardId: f.storyboardId,
                index: f.index,
                image: f.imageUrl || ', ',
                thumbnail: f.thumbnailUrl,
                shotType: f.shotType as any,
                cameraAngle: f.cameraAngle as any,
                cameraMovement: f.cameraMovement as any,
                duration: f.duration,
                title: f.title,
                description: f.description,
                technicalNotes: f.technicalNotes,
                dialogue: f.dialogue,
                status: f.status,
                createdAt: f.createdAt,
                updatedAt: f.updatedAt,
              })),
            });
          }
        }
      }

      syncState = {
        status: 'idle',
        lastSynced: new Date().toISOString(),
        pendingChanges: 0,
        error: null,
      };
      notifyListeners();
    } catch (error) {
      log.error('Storyboard sync failed: ', error);
      syncState = {
        ...syncState,
        status: 'error',
        error: error instanceof Error ? error.message : 'Sync failed',
      };
      notifyListeners();
    }
  },

  // Push local changes to server
  pushChanges: async (): Promise<void> => {
    const userId = getCurrentUserId();
    const store = useStoryboardStore.getState();

    try {
      syncState = { ...syncState, status: 'syncing', error: null };
      notifyListeners();

      for (const storyboard of store.storyboards) {
        // Check if exists on server
        try {
          await storyboardsApi.get(storyboard.id);
          // Exists - update
          await storyboardsApi.update(storyboard.id, {
            name: storyboard.name,
            aspectRatio: storyboard.aspectRatio,
            frameCount: storyboard.frames.length,
            totalDuration: storyboard.frames.reduce((sum, f) => sum + f.duration, 0),
          });
        } catch {
          // Doesn't exist - create
          await storyboardsApi.create({
            id: storyboard.id,
            userId,
            name: storyboard.name,
            aspectRatio: storyboard.aspectRatio,
            frameCount: storyboard.frames.length,
            totalDuration: storyboard.frames.reduce((sum, f) => sum + f.duration, 0),
          });
        }

        // Sync frames
        for (const frame of storyboard.frames) {
          try {
            await framesApi.update(frame.id, {
              index: frame.index,
              imageUrl: frame.image,
              thumbnailUrl: frame.thumbnail,
              title: frame.title || ', ',
              shotType: frame.shotType,
              cameraAngle: frame.cameraAngle,
              cameraMovement: frame.cameraMovement,
              duration: frame.duration,
              description: frame.description,
              technicalNotes: frame.technicalNotes,
              dialogue: frame.dialogue,
              status: frame.status,
            });
          } catch {
            // Frame doesn't exist - create
            await framesApi.create(storyboard.id, {
              id: frame.id,
              storyboardId: storyboard.id,
              userId,
              index: frame.index,
              imageUrl: frame.image,
              thumbnailUrl: frame.thumbnail,
              title: frame.title || '',
              shotType: frame.shotType,
              cameraAngle: frame.cameraAngle,
              cameraMovement: frame.cameraMovement,
              duration: frame.duration,
              description: frame.description,
              technicalNotes: frame.technicalNotes,
              dialogue: frame.dialogue,
              status: frame.status || 'draft',
            });
          }
        }
      }

      syncState = {
        status: 'idle',
        lastSynced: new Date().toISOString(),
        pendingChanges: 0,
        error: null,
      };
      notifyListeners();
    } catch (error) {
      log.error('Storyboard push failed:', error);
      syncState = {
        ...syncState,
        status: 'error',
        error: error instanceof Error ? error.message : 'Push failed',
      };
      notifyListeners();
    }
  },

  // Create storyboard on server
  createStoryboard: async (name: string, aspectRatio: string = '16:9') => {
    const userId = getCurrentUserId();
    const store = useStoryboardStore.getState();

    // Create locally first
    const localStoryboard = store.createStoryboard(name, aspectRatio as any);

    // Then sync to server (async, don't block)
    storyboardsApi
      .create({
        id: localStoryboard.id,
        userId,
        name,
        aspectRatio: aspectRatio as any,
        frameCount: 0,
        totalDuration: 0,
      })
      .catch((error) => {
        log.warn('Failed to sync new storyboard to server:', error);
        syncState = { ...syncState, pendingChanges: syncState.pendingChanges + 1 };
        notifyListeners();
      });

    return localStoryboard;
  },

  // Delete storyboard from server
  deleteStoryboard: async (id: string) => {
    const store = useStoryboardStore.getState();

    // Delete locally first
    store.deleteStoryboard(id);

    // Then sync to server
    storyboardsApi.delete(id).catch((error) => {
      log.warn('Failed to delete storyboard from server:', error);
    });
  },

  // Add frame and sync
  addFrame: async (frameData: any) => {
    const store = useStoryboardStore.getState();
    const currentStoryboard = store.currentStoryboard;

    if (!currentStoryboard) {
      throw new Error('No storyboard selected');
    }

    // Add locally
    store.addFrame(frameData);

    // Get the newly added frame
    const updatedStoryboard = useStoryboardStore.getState().currentStoryboard;
    const newFrame = updatedStoryboard?.frames[updatedStoryboard.frames.length - 1];

    if (newFrame) {
      // Sync to server
      framesApi
        .create(currentStoryboard.id, {
          id: newFrame.id,
          storyboardId: currentStoryboard.id,
          userId: getCurrentUserId(),
          index: newFrame.index,
          imageUrl: newFrame.image,
          thumbnailUrl: newFrame.thumbnail,
          title: newFrame.title || ', ',
          shotType: newFrame.shotType,
          cameraAngle: newFrame.cameraAngle,
          cameraMovement: newFrame.cameraMovement,
          duration: newFrame.duration,
          description: newFrame.description,
          technicalNotes: newFrame.technicalNotes,
          dialogue: newFrame.dialogue,
          status: newFrame.status ||'draft',
        })
        .catch((error) => {
          log.warn('Failed to sync new frame to server:', error);
          syncState = { ...syncState, pendingChanges: syncState.pendingChanges + 1 };
          notifyListeners();
        });
    }
  },

  // Update frame and sync
  updateFrame: async (frameId: string, updates: any) => {
    const store = useStoryboardStore.getState();

    // Update locally
    store.updateFrame(frameId, updates);

    // Sync to server
    framesApi
      .update(frameId, {
        ...updates,
        imageUrl: updates.image,
        thumbnailUrl: updates.thumbnail,
      })
      .catch((error) => {
        log.warn('Failed to sync frame update to server:', error);
        syncState = { ...syncState, pendingChanges: syncState.pendingChanges + 1 };
        notifyListeners();
      });
  },

  // Delete frame and sync
  deleteFrame: async (frameId: string) => {
    const store = useStoryboardStore.getState();

    // Delete locally
    store.deleteFrame(frameId);

    // Sync to server
    framesApi.delete(frameId).catch((error) => {
      log.warn('Failed to delete frame from server:', error);
    });
  },
};

// Auto-sync on store changes (debounced)
let syncTimeout: NodeJS.Timeout | null = null;

useStoryboardStore.subscribe((state, prevState) => {
  // Check if storyboards changed
  if (state.storyboards !== prevState.storyboards) {
    syncState = { ...syncState, pendingChanges: syncState.pendingChanges + 1 };
    notifyListeners();

    // Debounce sync
    if (syncTimeout) {
      clearTimeout(syncTimeout);
    }
    syncTimeout = setTimeout(() => {
      storyboardSyncService.pushChanges();
    }, 5000); // Sync after 5 seconds of inactivity
  }
});

export default storyboardSyncService;

