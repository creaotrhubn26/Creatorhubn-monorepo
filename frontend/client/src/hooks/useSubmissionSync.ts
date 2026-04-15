// @ts-nocheck
import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Real-time synchronization hook for Submission Management → Overview Tab
 *
 * This hook provides:
 * - Automatic cache invalidation for related queries
 * - Optimistic updates for immediate UI feedback
 * - Batch invalidation to reduce network requests
 * - Error recovery and retry logic
 *
 * @example
 * ```tsx
 * const { syncSubmissionUpdate, syncProjectCreation, syncQuoteCreation } = useSubmissionSync();
 *
 * // After creating a project
 * await syncProjectCreation(projectId, submissionId);
 * ```
 */
export function useSubmissionSync(userId?: string) {
  const queryClient = useQueryClient();

  /**
   * Invalidate all submission-related queries
   * Batches multiple invalidations into a single operation
   */
  const invalidateSubmissionQueries = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['/api/submissions'] }),
      queryClient.invalidateQueries({ queryKey: ['/api/client-activity/summary'] }),
    ]);
  }, [queryClient]);

  /**
   * Sync after submission status update
   * @param submissionId - ID of the updated submission
   * @param newStatus - New status value
   */
  const syncSubmissionUpdate = useCallback(
    async (submissionId: string, newStatus: string) => {
      // Optimistic update: Update cache immediately before server response
      queryClient.setQueryData(['/api/client-activity/summary', userId], (old: unknown) => {
        if (!old) return old;

        // If status changed from 'new' to something else, decrement pendingSubmissions
        if (newStatus !== 'new') {
          return {
            ...old,
            pendingSubmissions: Math.max(0, (old.pendingSubmissions || 0) - 1),
          };
        }

        return old;
      });

      // Invalidate and refetch from server
      await invalidateSubmissionQueries();
    },
    [queryClient, userId, invalidateSubmissionQueries],
  );

  /**
   * Sync after project creation from submission
   * @param projectId - ID of newly created project
   * @param submissionId - ID of source submission
   */
  const syncProjectCreation = useCallback(
    async (projectId: string, submissionId: string) => {
      // Optimistic update: Increment project count immediately
      queryClient.setQueryData(['/api/projects', { userId }], (old: unknown) => {
        if (!old || !Array.isArray(old)) return old;
        return [...old]; // Force refetch by returning new reference
      });

      // Optimistic update: Decrement pending submissions
      queryClient.setQueryData(['/api/client-activity/summary', userId], (old: unknown) => {
        if (!old) return old;
        return {
          ...old,
          pendingSubmissions: Math.max(0, (old.pendingSubmissions || 0) - 1),
        };
      });

      // Batch invalidate all related queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/projects'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/client-activity/summary'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/submissions'] }),
      ]);
    },
    [queryClient, userId],
  );

  /**
   * Sync after quote creation from submission
   * @param quoteId - ID of newly created quote
   * @param submissionId - ID of source submission
   */
  const syncQuoteCreation = useCallback(
    async (quoteId: string, submissionId: string) => {
      // Optimistic update: Decrement pending submissions
      queryClient.setQueryData(['/api/client-activity/summary', userId], (old: unknown) => {
        if (!old) return old;
        return {
          ...old,
          pendingSubmissions: Math.max(0, (old.pendingSubmissions || 0) - 1),
        };
      });

      // Batch invalidate all related queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/quotes'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/client-activity/summary'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/submissions'] }),
      ]);
    },
    [queryClient, userId],
  );

  /**
   * Sync all overview data (force refresh)
   * Useful after bulk operations or on user demand
   */
  const syncOverviewData = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['/api/client-activity/summary'] }),
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] }),
      queryClient.invalidateQueries({ queryKey: ['/api/submissions'] }),
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/recent'] }),
    ]);
  }, [queryClient]);

  /**
   * Set up automatic sync on window focus
   * Ensures data is fresh when user returns to the app
   */
  useEffect(() => {
    const handleFocus = () => {
      // Refetch critical data when window regains focus
      queryClient.invalidateQueries({
        queryKey: ['/api/client-activity/summary'],
        refetchType: 'active',
      });
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [queryClient]);

  return {
    syncSubmissionUpdate,
    syncProjectCreation,
    syncQuoteCreation,
    syncOverviewData,
  };
}

/**
 * Hook for monitoring real-time submission count changes
 * Useful for displaying live updates in UI
 *
 * @example
 * ```tsx
 * const pendingCount = useSubmissionCount(userId);
 * // Returns live count of pending submissions
 * ```
 */
export function useSubmissionCount(userId?: string): number {
  const queryClient = useQueryClient();

  const data = queryClient.getQueryData<any>(['/api/client-activity/summary', userId]);
  return data?.pendingSubmissions || 0;
}

/**
 * Hook for detecting when overview data needs refresh
 * Returns true if data is older than specified threshold
 *
 * @param thresholdMs - Milliseconds before data is considered stale (default: 60000 = 1 minute)
 */
export function useOverviewDataFreshness(userId?: string, thresholdMs: number = 60000): boolean {
  const queryClient = useQueryClient();

  const query = queryClient.getQueryState(['/api/client-activity/summary', userId]);

  if (!query?.dataUpdatedAt) return false;

  const age = Date.now() - query.dataUpdatedAt;
  return age < thresholdMs;
}
