/**
 * useRoleRoom — React-Query hooks for Role Room integration
 *
 * Follows the same patterns as useProfessionConfig:
 *  - queryKey = ['/api/role-room/...']
 *  - staleTime 5 min, gcTime 10 min, retry 2
 *  - mutations invalidate relevant queries
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as rr from '../services/roleRoomService';
import type {
  CastingProject,
  CastingRole,
  Candidate,
  CrewMember,
  Schedule,
  UserRole,
  ProjectSyncResult,
  MarketplaceInstallation,
} from '../../../shared/role-room-types';

const STALE = 5 * 60_000;   // 5 minutes
const GC    = 10 * 60_000;  // 10 minutes

// ── Health ───────────────────────────────────────────────────

export function useRoleRoomHealth() {
  return useQuery({
    queryKey: ['/api/role-room/health'],
    queryFn: () => rr.getHealth(),
    staleTime: 30_000,
    retry: 1,
  });
}

// ── Projects ─────────────────────────────────────────────────

export function useRoleRoomProjects() {
  return useQuery<CastingProject[]>({
    queryKey: ['/api/role-room/projects'],
    queryFn: () => rr.getProjects(),
    staleTime: STALE,
    gcTime: GC,
    retry: 2,
  });
}

export function useRoleRoomProject(id: string | undefined) {
  return useQuery<CastingProject>({
    queryKey: ['/api/role-room/projects', id],
    queryFn: () => rr.getProject(id!),
    enabled: !!id,
    staleTime: STALE,
    gcTime: GC,
    retry: 2,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof rr.createProject>[0]) =>
      rr.createProject(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/role-room/projects'] });
    },
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof rr.updateProject>[1] }) =>
      rr.updateProject(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/role-room/projects'] });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => rr.deleteProject(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/role-room/projects'] });
    },
  });
}

// ── User Roles ───────────────────────────────────────────────

export function useProjectUserRoles(projectId: string | undefined) {
  return useQuery<UserRole[]>({
    queryKey: ['/api/role-room/projects', projectId, 'roles'],
    queryFn: () => rr.getProjectRoles(projectId!),
    enabled: !!projectId,
    staleTime: STALE,
    gcTime: GC,
    retry: 2,
  });
}

export function useAssignRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      data,
    }: {
      projectId: string;
      data: Parameters<typeof rr.assignRole>[1];
    }) => rr.assignRole(projectId, data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({
        queryKey: ['/api/role-room/projects', vars.projectId, 'roles'],
      });
    },
  });
}

// ── Casting Roles ────────────────────────────────────────────

export function useCastingRoles(projectId: string | undefined) {
  return useQuery<CastingRole[]>({
    queryKey: ['/api/role-room/projects', projectId, 'casting-roles'],
    queryFn: () => rr.getCastingRoles(projectId!),
    enabled: !!projectId,
    staleTime: STALE,
    gcTime: GC,
    retry: 2,
  });
}

export function useCreateCastingRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      data,
    }: {
      projectId: string;
      data: Parameters<typeof rr.createCastingRole>[1];
    }) => rr.createCastingRole(projectId, data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({
        queryKey: ['/api/role-room/projects', vars.projectId, 'casting-roles'],
      });
    },
  });
}

// ── Candidates ───────────────────────────────────────────────

export function useCandidates(projectId: string | undefined) {
  return useQuery<Candidate[]>({
    queryKey: ['/api/role-room/projects', projectId, 'candidates'],
    queryFn: () => rr.getCandidates(projectId!),
    enabled: !!projectId,
    staleTime: STALE,
    gcTime: GC,
    retry: 2,
  });
}

export function useAddCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      data,
    }: {
      projectId: string;
      data: Parameters<typeof rr.addCandidate>[1];
    }) => rr.addCandidate(projectId, data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({
        queryKey: ['/api/role-room/projects', vars.projectId, 'candidates'],
      });
    },
  });
}

// ── Crew ─────────────────────────────────────────────────────

export function useCrew(projectId: string | undefined) {
  return useQuery<CrewMember[]>({
    queryKey: ['/api/role-room/projects', projectId, 'crew'],
    queryFn: () => rr.getCrew(projectId!),
    enabled: !!projectId,
    staleTime: STALE,
    gcTime: GC,
    retry: 2,
  });
}

export function useAddCrewMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      data,
    }: {
      projectId: string;
      data: Parameters<typeof rr.addCrewMember>[1];
    }) => rr.addCrewMember(projectId, data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({
        queryKey: ['/api/role-room/projects', vars.projectId, 'crew'],
      });
    },
  });
}

// ── Schedules ────────────────────────────────────────────────

export function useSchedules(projectId: string | undefined) {
  return useQuery<Schedule[]>({
    queryKey: ['/api/role-room/projects', projectId, 'schedules'],
    queryFn: () => rr.getSchedules(projectId!),
    enabled: !!projectId,
    staleTime: STALE,
    gcTime: GC,
    retry: 2,
  });
}

// ── Project Sync ─────────────────────────────────────────────

export function useSyncProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof rr.syncProject>[0]) =>
      rr.syncProject(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/role-room/projects'] });
    },
  });
}

export function useSyncStatus(creatorhubProjectId: string | undefined) {
  return useQuery({
    queryKey: ['/api/role-room/sync/status', creatorhubProjectId],
    queryFn: () => rr.getSyncStatus(creatorhubProjectId!),
    enabled: !!creatorhubProjectId,
    staleTime: STALE,
    gcTime: GC,
    retry: 2,
  });
}

// ── Onboarding ───────────────────────────────────────────────

export function useRegisterOnboardingRole() {
  return useMutation({
    mutationFn: (data: Parameters<typeof rr.registerOnboardingRole>[0]) =>
      rr.registerOnboardingRole(data),
  });
}

// ── Marketplace ──────────────────────────────────────────────

export function useInstalledApps() {
  return useQuery<MarketplaceInstallation[]>({
    queryKey: ['/api/role-room/marketplace/installed'],
    queryFn: () => rr.getInstalledApps(),
    staleTime: STALE,
    gcTime: GC,
    retry: 2,
  });
}

export function useInstallApp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (appId: string) => rr.installApp(appId),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ['/api/role-room/marketplace/installed'],
      });
    },
  });
}

export function useUninstallApp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (appId: string) => rr.uninstallApp(appId),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ['/api/role-room/marketplace/installed'],
      });
    },
  });
}
