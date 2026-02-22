/**
 * useAuditionSchedules – React Query wrapper for the audition schedule API.
 *
 * Provides:
 *   - Filterable, paginated list query (with server-side counts for chips)
 *   - Create / update / patch / delete mutations
 *   - Bulk-delete mutation
 *   - Favorite-toggle mutation
 *
 * All mutations auto-invalidate the list cache so counts stay fresh.
 *
 * Usage:
 *   const { query, createMutation, deleteMutation, bulkDeleteMutation, ... } =
 *     useAuditionSchedules(projectId, filters, userId);
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { AuditionListFilters, AuditionListResponse, AuditionScheduleRow, AuditionScheduleWrite } from '../../../../shared/role-room-types';
import {
  listAuditionSchedules,
  createAuditionSchedule,
  updateAuditionSchedule,
  patchAuditionSchedule,
  deleteAuditionSchedule,
  bulkDeleteAuditionSchedules,
  toggleAuditionFavorite,
} from '../../../services/roleRoomService';

// ── Cache constants ──────────────────────────────────────────

/** List is considered fresh for 30 s – user typing filters always re-fetches */
const STALE = 30_000;
const GC    = 5 * 60_000;

// ── Query key factory ────────────────────────────────────────

export const auditionQK = {
  all:  (projectId: string) => ['/api/role-room/projects', projectId, 'auditions'] as const,
  list: (projectId: string, filters: AuditionListFilters) =>
    [...auditionQK.all(projectId), filters] as const,
};

// ── Hook ─────────────────────────────────────────────────────

export function useAuditionSchedules(
  projectId: string | undefined,
  filters: AuditionListFilters = {},
  userId?: string,
) {
  const qc = useQueryClient();

  const filtersWithUser: AuditionListFilters = userId ? { ...filters, userId } : filters;

  // ── List query ───────────────────────────────────────────
  const query = useQuery<AuditionListResponse>({
    queryKey: auditionQK.list(projectId ?? '', filtersWithUser),
    queryFn:  () => listAuditionSchedules(projectId!, filtersWithUser),
    enabled:  !!projectId,
    staleTime: STALE,
    gcTime:    GC,
    retry:     2,
    // Keep previous data visible while refetching (no skeleton flash on filter change)
    placeholderData: (prev) => prev,
  });

  /** Invalidate the entire list namespace for this project */
  function invalidate() {
    qc.invalidateQueries({ queryKey: auditionQK.all(projectId ?? '') });
  }

  // ── Create ───────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: AuditionScheduleWrite) =>
      createAuditionSchedule(projectId!, data),
    onSuccess: invalidate,
  });

  // ── Full update ──────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: ({ scheduleId, data }: { scheduleId: string; data: Partial<AuditionScheduleWrite> }) =>
      updateAuditionSchedule(projectId!, scheduleId, data),
    onSuccess: invalidate,
  });

  // ── Partial update (status / notes) ─────────────────────
  const patchMutation = useMutation({
    mutationFn: ({ scheduleId, patch }: {
      scheduleId: string;
      patch: Partial<{ status: string; notes: string; date: string; location: string }>;
    }) => patchAuditionSchedule(projectId!, scheduleId, patch),
    onSuccess:  invalidate,
  });

  // ── Delete one ───────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (scheduleId: string) =>
      deleteAuditionSchedule(projectId!, scheduleId),
    onSuccess: invalidate,
  });

  // ── Bulk delete ──────────────────────────────────────────
  const bulkDeleteMutation = useMutation<{ deleted: number }, Error, string[]>({
    mutationFn: (ids: string[]) => bulkDeleteAuditionSchedules(projectId!, ids),
    onSuccess: invalidate,
  });

  // ── Favorite toggle ──────────────────────────────────────
  const favoriteMutation = useMutation({
    mutationFn: ({ scheduleId, favorite }: { scheduleId: string; favorite: boolean }) =>
      toggleAuditionFavorite(projectId!, scheduleId, userId!, favorite),
    // Optimistic update – flip the favorite flag in cache immediately
    onMutate: async ({ scheduleId, favorite }) => {
      if (!userId || !projectId) return;
      await qc.cancelQueries({ queryKey: auditionQK.all(projectId) });
      const prev = qc.getQueriesData<AuditionListResponse>({
        queryKey: auditionQK.all(projectId),
      });
      qc.setQueriesData<AuditionListResponse>(
        { queryKey: auditionQK.all(projectId) },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((item: AuditionScheduleRow) =>
              item.id === scheduleId ? { ...item, favorite } : item
            ),
            counts: {
              ...old.counts,
              favorites: old.counts.favorites + (favorite ? 1 : -1),
            },
          };
        }
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      // Roll back optimistic update on error
      if (context?.prev) {
        for (const [key, data] of context.prev) {
          qc.setQueryData(key, data);
        }
      }
    },
    onSettled: invalidate,
  });

  return {
    query,
    createMutation,
    updateMutation,
    patchMutation,
    deleteMutation,
    bulkDeleteMutation,
    favoriteMutation,
    /** Convenience: items array, never undefined */
    items: query.data?.items ?? [],
    /** Convenience: aggregate counts for chip badges */
    counts: query.data?.counts,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
  };
}
