/**
 * React hook for managing tutorial preferences
 * Handles database-persistent tutorial dismissal state with localStorage fallback
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../lib/queryClient';

interface TutorialPreference {
  tutorialId: string;
  dismissed: boolean;
  dismissedAt?: string;
  profession?: string;
  completedSteps?: number[];
}

interface UseTutorialPreferencesReturn {
  // State
  isDismissed: boolean;
  isLoading: boolean;
  isError: boolean;
  
  // Actions
  dismissTutorial: (tutorialId: string, profession?: string) => Promise<void>;
  resetTutorial: (tutorialId: string) => Promise<void>;
  
  // Raw data
  preferences: TutorialPreference | null;
}

/**
 * Hook to manage tutorial preferences with database persistence
 * @param tutorialId - Unique identifier for the tutorial
 */
export function useTutorialPreferences(tutorialId: string): UseTutorialPreferencesReturn {
  const queryClient = useQueryClient();

  // Fetch tutorial preferences from database
  const { data: preferences, isLoading, isError } = useQuery({
    queryKey: ['tutorialPreferences', tutorialId],
    queryFn: async () => {
      try {
        const response = await apiRequest(`/api/user/preferences/tutorial/${tutorialId}`);
        return response as TutorialPreference;
      } catch (error) {
        // Fallback to localStorage if API fails
        const localDismissed = localStorage.getItem(`${tutorialId}-tutorial-dismissed`);
        return {
          tutorialId,
          dismissed: localDismissed === 'true',
          dismissedAt: localDismissed ? new Date().toISOString() : undefined
        };
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000 // 30 minutes (formerly cacheTime)
  });

  // Mutation to dismiss tutorial
  const dismissMutation = useMutation({
    mutationFn: async ({ tutorialId, profession }: { tutorialId: string; profession?: string }) => {
      return await apiRequest('/api/user/preferences/tutorial-dismissal', {
        method: 'POST',
        body: JSON.stringify({
          tutorialId,
          dismissed: true,
          dismissedAt: new Date().toISOString(),
          profession
        })
      });
    },
    onSuccess: (_, variables) => {
      // Update localStorage as backup
      localStorage.setItem(`${variables.tutorialId}-tutorial-dismissed`, 'true');
      
      // Update cache
      queryClient.setQueryData(['tutorialPreferences', variables.tutorialId], {
        tutorialId: variables.tutorialId,
        dismissed: true,
        dismissedAt: new Date().toISOString(),
        profession: variables.profession
      });
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['userPreferences'] });
    },
    onError: (error, variables) => {
      console.error('Failed to save tutorial dismissal to database:', error);
      // Still save to localStorage as fallback
      localStorage.setItem(`${variables.tutorialId}-tutorial-dismissed`, 'true');
    }
  });

  // Mutation to reset tutorial (show again)
  const resetMutation = useMutation({
    mutationFn: async (tutorialId: string) => {
      return await apiRequest(`/api/user/preferences/tutorial/${tutorialId}`, {
        method: 'DELETE'
      });
    },
    onSuccess: (_, tutorialId) => {
      // Remove from localStorage
      localStorage.removeItem(`${tutorialId}-tutorial-dismissed`);
      
      // Update cache
      queryClient.setQueryData(['tutorialPreferences', tutorialId], {
        tutorialId,
        dismissed: false
      });
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['userPreferences'] });
    },
    onError: (error, tutorialId) => {
      console.error('Failed to reset tutorial in database:', error);
      // Still remove from localStorage
      localStorage.removeItem(`${tutorialId}-tutorial-dismissed`);
    }
  });

  return {
    isDismissed: preferences?.dismissed ?? false,
    isLoading,
    isError,
    dismissTutorial: async (tutorialId: string, profession?: string) => {
      await dismissMutation.mutateAsync({ tutorialId, profession });
    },
    resetTutorial: async (tutorialId: string) => {
      await resetMutation.mutateAsync(tutorialId);
    },
    preferences: preferences ?? null
  };
}

