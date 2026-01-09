/**
 * useProgressPersistence Hook
 * 
 * Handles saving and restoring onboarding progress to localStorage and backend
 */

import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '@/lib/queryClient';

interface UseProgressPersistenceProps {
  userId: string;
  profession: string;
  enabled?: boolean;
}

interface ProgressData {
  completedSteps: number[];
  activeStep: number;
  timestamp: number;
}

const STORAGE_KEY_PREFIX = 'community_onboarding_progress_';

export const useProgressPersistence = ({
  userId,
  profession,
  enabled = true,
}: UseProgressPersistenceProps) => {
  const storageKey = `${STORAGE_KEY_PREFIX}${userId}_${profession}`;

  const [localProgress, setLocalProgress] = useState<ProgressData | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load progress from localStorage on mount
  useEffect(() => {
    if (!enabled || !userId || !profession) return;

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const progress: ProgressData = JSON.parse(stored);
        // Check if progress is less than 24 hours old
        const age = Date.now() - progress.timestamp;
        if (age < 24 * 60 * 60 * 1000) {
          setLocalProgress(progress);
        } else {
          // Clear old progress
          localStorage.removeItem(storageKey);
        }
      }
    } catch (error) {
      console.error('Error loading progress from localStorage:', error);
    }
  }, [userId, profession, storageKey, enabled]);

  // Save progress to localStorage
  const saveProgress = useCallback(
    (completedSteps: number[], activeStep: number) => {
      if (!enabled || !userId || !profession) return;

      const progress: ProgressData = {
        completedSteps,
        activeStep,
        timestamp: Date.now(),
      };

      try {
        localStorage.setItem(storageKey, JSON.stringify(progress));
        setLocalProgress(progress);
      } catch (error) {
        console.error('Error saving progress to localStorage:', error);
      }
    },
    [userId, profession, storageKey, enabled]
  );

  // Sync progress with backend
  const syncProgress = useCallback(
    async (completedSteps: number[], activeStep: number) => {
      if (!enabled || !userId || !profession) return;

      setIsSyncing(true);
      try {
        await apiRequest('/api/community/onboarding/progress', {
          method: 'POST',
          body: JSON.stringify({
            userId,
            profession,
            completedSteps,
            activeStep,
          }),
        });
      } catch (error) {
        console.error('Error syncing progress to backend:', error);
        // Don't throw - local storage is still saved
      } finally {
        setIsSyncing(false);
      }
    },
    [userId, profession, enabled]
  );

  // Load progress from backend
  const loadBackendProgress = useCallback(async () => {
    if (!enabled || !userId || !profession) return null;

    try {
      const response = await apiRequest(
        `/api/community/onboarding/progress/${userId}/${profession}`,
        {
          method: 'GET',
        }
      ) as { success: boolean; progress?: ProgressData };

      if (response.success && response.progress) {
        return response.progress;
      }
    } catch (error) {
      console.error('Error loading progress from backend:', error);
    }
    return null;
  }, [userId, profession, enabled]);

  // Clear progress
  const clearProgress = useCallback(() => {
    if (!enabled) return;

    try {
      localStorage.removeItem(storageKey);
      setLocalProgress(null);
    } catch (error) {
      console.error('Error clearing progress:', error);
    }
  }, [storageKey, enabled]);

  return {
    localProgress,
    saveProgress,
    syncProgress,
    loadBackendProgress,
    clearProgress,
    isSyncing,
  };
};

export default useProgressPersistence;

