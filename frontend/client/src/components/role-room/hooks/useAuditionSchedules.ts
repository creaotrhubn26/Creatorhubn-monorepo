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
import { castingService } from '../services/castingService';
import type { Schedule } from '../models/casting';

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
  enabled = true,
) {
  const qc = useQueryClient();
  const useRoleRoomApi = enabled;

  const filtersWithUser: AuditionListFilters = userId ? { ...filters, userId } : filters;

  const toLegacySchedule = (data: AuditionScheduleWrite, id?: string): Schedule => {
    const now = new Date().toISOString();
    return {
      id: id ?? `schedule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      projectId,
      candidateId: data.candidateId,
      roleId: data.roleId,
      sceneId: data.sceneId,
      locationId: data.locationId,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      type: data.type ?? 'audition',
      status: data.status ?? 'scheduled',
      notes: data.notes ?? '',
      location: data.location,
      createdAt: now,
      updatedAt: now,
    };
  };

  // ── List query ───────────────────────────────────────────
  const query = useQuery<AuditionListResponse>({
    queryKey: auditionQK.list(projectId ?? '', filtersWithUser),
    queryFn:  () => listAuditionSchedules(projectId!, filtersWithUser),
    enabled:  !!projectId && enabled,
    staleTime: STALE,
    gcTime:    GC,
    retry:     (failureCount, error) => {
      const message = error instanceof Error ? error.message : '';
      const isAuthError =
        message.includes('401')
        || message.includes('Mangler x-api-key')
        || message.includes('gyldig session')
        || message.includes('Ikke autentisert');
      if (isAuthError) return false;
      return failureCount < 2;
    },
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
      useRoleRoomApi
        ? createAuditionSchedule(projectId!, data)
        : (async () => {
            const schedule = toLegacySchedule(data, data.id);
            await castingService.saveSchedule(projectId!, schedule);
            return { id: schedule.id };
          })(),
    onSuccess: invalidate,
  });

  // ── Full update ──────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: ({ scheduleId, data }: { scheduleId: string; data: Partial<AuditionScheduleWrite> }) =>
      useRoleRoomApi
        ? updateAuditionSchedule(projectId!, scheduleId, data)
        : (async () => {
            const schedules = await castingService.getSchedules(projectId!);
            const existing = schedules.find((s) => s.id === scheduleId);
            if (!existing) throw new Error('Schedule not found');
            const next: Schedule = { ...existing, updatedAt: new Date().toISOString() };
            if (data.candidateId !== undefined) next.candidateId = data.candidateId;
            if (data.roleId !== undefined) next.roleId = data.roleId;
            if (data.sceneId !== undefined) next.sceneId = data.sceneId;
            if (data.locationId !== undefined) next.locationId = data.locationId;
            if (data.date !== undefined) next.date = data.date;
            if (data.startTime !== undefined) next.startTime = data.startTime;
            if (data.endTime !== undefined) next.endTime = data.endTime;
            if (data.type !== undefined) next.type = data.type;
            if (data.notes !== undefined) next.notes = data.notes;
            if (data.location !== undefined) next.location = data.location;
            if (data.status !== undefined) next.status = data.status;
            await castingService.saveSchedule(projectId!, next);
            return { ok: true };
          })(),
    onSuccess: invalidate,
  });

  // ── Partial update (status / notes) ─────────────────────
  const patchMutation = useMutation({
    mutationFn: ({ scheduleId, patch }: {
      scheduleId: string;
      patch: Partial<{ status: string; notes: string; date: string; location: string }>;
    }) => (
      useRoleRoomApi
        ? patchAuditionSchedule(projectId!, scheduleId, patch)
        : (async () => {
            const schedules = await castingService.getSchedules(projectId!);
            const existing = schedules.find((s) => s.id === scheduleId);
            if (!existing) throw new Error('Schedule not found');
            const next: Schedule = { ...existing, updatedAt: new Date().toISOString() };
            if (patch.status !== undefined) next.status = patch.status;
            if (patch.notes !== undefined) next.notes = patch.notes;
            if (patch.date !== undefined) next.date = patch.date;
            if (patch.location !== undefined) next.location = patch.location;
            await castingService.saveSchedule(projectId!, next);
            return { ok: true };
          })()
    ),
    onSuccess:  invalidate,
  });

  // ── Delete one ───────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (scheduleId: string) =>
      useRoleRoomApi
        ? deleteAuditionSchedule(projectId!, scheduleId)
        : (async () => {
            await castingService.deleteSchedule(projectId!, scheduleId);
            return { ok: true };
          })(),
    onSuccess: invalidate,
  });

  // ── Bulk delete ──────────────────────────────────────────
  const bulkDeleteMutation = useMutation<{ deleted: number }, Error, string[]>({
    mutationFn: (ids: string[]) => (
      useRoleRoomApi
        ? bulkDeleteAuditionSchedules(projectId!, ids)
        : (async () => {
            await Promise.all(ids.map((id) => castingService.deleteSchedule(projectId!, id)));
            return { deleted: ids.length };
          })()
    ),
    onSuccess: invalidate,
  });

  // ── Favorite toggle ──────────────────────────────────────
  const favoriteMutation = useMutation({
    mutationFn: ({ scheduleId, favorite }: { scheduleId: string; favorite: boolean }) =>
      useRoleRoomApi
        ? toggleAuditionFavorite(projectId!, scheduleId, userId!, favorite)
        : Promise.resolve({ ok: true }),
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
