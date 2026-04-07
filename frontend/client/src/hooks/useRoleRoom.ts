/**
 * useRoleRoom — React-Query hooks for Role Room integration
 *
 * Follows the same patterns as useProfessionConfig:
 *  - queryKey = ['/api/role-room/...']
 *  - staleTime 5 min, gcTime 10 min, retry 2
 *  - mutations invalidate relevant queries
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import * as rr from '../services/roleRoomService';
import { apiRequest } from '../lib/queryClient';
import type { RoleRoomCommercialBillingAccount } from '../components/role-room/services/castingApiService';
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

export type RoleRoomWorkspaceAccessStatus =
  | 'not_installed'
  | 'subscription_required'
  | 'pending_payment'
  | 'payment_failed'
  | 'pending_activation'
  | 'active';

export type RoleRoomWorkspaceAccessSummary = {
  installedApps: MarketplaceInstallation[];
  roleRoomInstallation: MarketplaceInstallation | null;
  billingAccount: RoleRoomCommercialBillingAccount | null;
  status: RoleRoomWorkspaceAccessStatus;
  hasInstallation: boolean;
  hasPaidSubscription: boolean;
  hasWorkspaceAccess: boolean;
  needsActivationApproval: boolean;
  canManageBilling: boolean;
  ctaLabel: string;
  statusLabel: string;
  helperText: string;
};

// ── Health ───────────────────────────────────────────────────

export function useRoleRoomHealth() {
  return useQuery({
    queryKey: ['/api/role-room/health'],
    queryFn: () => rr.getHealth(),
    staleTime: 30_000,
    retry: 1,
  });
}

export function useRoleRoomBillingAccount(enabled = true) {
  return useQuery<RoleRoomCommercialBillingAccount | null>({
    queryKey: ['/api/role-room/billing/account'],
    queryFn: async () => {
      try {
        const result = await apiRequest('/api/role-room/billing/account') as {
          success?: boolean;
          account?: RoleRoomCommercialBillingAccount | null;
        };
        return result.account ?? null;
      } catch (error) {
        if ((error as { status?: number } | null)?.status === 404) {
          return null;
        }
        throw error;
      }
    },
    staleTime: STALE,
    gcTime: GC,
    retry: 1,
    enabled,
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

export function useInstalledApps(enabled = true) {
  return useQuery<MarketplaceInstallation[]>({
    queryKey: ['/api/role-room/marketplace/installed'],
    queryFn: () => rr.getInstalledApps(),
    staleTime: STALE,
    gcTime: GC,
    retry: 2,
    enabled,
  });
}

export function useRoleRoomWorkspaceAccess(enabled = true) {
  const installedAppsQuery = useInstalledApps(enabled);
  const billingAccountQuery = useRoleRoomBillingAccount(enabled);

  const summary = useMemo<RoleRoomWorkspaceAccessSummary>(() => {
    const installedApps = installedAppsQuery.data ?? [];
    const roleRoomInstallation =
      installedApps.find((entry) => entry.app_id === 'role-room' && entry.is_active) ?? null;
    const billingAccount = billingAccountQuery.data ?? null;
    const hasInstallation = Boolean(roleRoomInstallation);
    const hasPaidSubscription = Boolean(billingAccount?.paymentCompleted);
    const canManageBilling = Boolean(billingAccount?.canManageBilling);
    const needsActivationApproval = Boolean(
      billingAccount
      && !billingAccount.currentUser?.isLeader
      && !billingAccount.currentUser?.activationApproved
    );

    let status: RoleRoomWorkspaceAccessStatus = 'not_installed';
    let statusLabel = 'Ikke installert';
    let helperText = 'Installer The Role Room fra Marketplace for å starte oppsettet.';
    let ctaLabel = 'Installer og velg abonnement';

    if (hasInstallation) {
      status = 'subscription_required';
      statusLabel = 'Installert';
      helperText = 'Appen er lagt til i CreatorHub, men abonnementet må være aktivt før fanen blir tilgjengelig.';
      ctaLabel = 'Fullfør abonnement';
    }

    if (billingAccount) {
      if (billingAccount.paymentStatus === 'payment_failed') {
        status = 'payment_failed';
        statusLabel = billingAccount.paymentStatusLabel || 'Betaling må oppdateres';
        helperText = billingAccount.paymentFailureMessage || billingAccount.paymentMessage;
        ctaLabel = canManageBilling ? 'Oppdater betaling' : 'Se status';
      } else if (!billingAccount.paymentCompleted) {
        status = 'pending_payment';
        statusLabel = billingAccount.paymentStatusLabel || 'Venter på betaling';
        helperText = billingAccount.paymentMessage;
        ctaLabel = 'Fullfør abonnement';
      } else if (needsActivationApproval) {
        status = 'pending_activation';
        statusLabel = 'Venter aktivering';
        helperText =
          'Abonnementet er aktivt, men denne brukeren må godkjennes i teamet før The Role Room åpnes.';
        ctaLabel = 'Åpne aktivering';
      } else {
        status = 'active';
        statusLabel = billingAccount.paymentStatusLabel || 'Aktiv tilgang';
        helperText =
          billingAccount.companyName
            ? `${billingAccount.companyName} har aktiv The Role Room-tilgang i denne workspace-kontoen.`
            : 'The Role Room er aktiv i denne workspace-kontoen.';
        ctaLabel = 'Åpne The Role Room';
      }
    }

    return {
      installedApps,
      roleRoomInstallation,
      billingAccount,
      status,
      hasInstallation,
      hasPaidSubscription,
      hasWorkspaceAccess: status === 'active',
      needsActivationApproval,
      canManageBilling,
      ctaLabel,
      statusLabel,
      helperText,
    };
  }, [billingAccountQuery.data, installedAppsQuery.data]);

  return {
    ...summary,
    isLoading: installedAppsQuery.isLoading || billingAccountQuery.isLoading,
    isFetching: installedAppsQuery.isFetching || billingAccountQuery.isFetching,
    error: installedAppsQuery.error || billingAccountQuery.error || null,
    refetch: async () => {
      await Promise.allSettled([
        installedAppsQuery.refetch(),
        billingAccountQuery.refetch(),
      ]);
    },
  };
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

// ── Auto-Bootstrap API Key ───────────────────────────────────

/**
 * Automatically provisions an API key on first mount if none exists.
 * Stores the key in localStorage via roleRoomService.setApiKey().
 * Call this once in the top-level Role Room panel.
 */
export function useRoleRoomBootstrap(userId: string) {
  const bootstrapped = useRef(false);
  const qc = useQueryClient();

  useEffect(() => {
    if (bootstrapped.current) return;
    const existing = localStorage.getItem('roleRoomApiKey');
    if (existing) {
      bootstrapped.current = true;
      return;
    }

    bootstrapped.current = true;
    rr.createApiKey(`auto-${userId}`, userId, ['read', 'write', 'admin'])
      .then((result) => {
        rr.setApiKey(result.apiKey);
        // Invalidate all role-room queries so they refetch with the new key
        qc.invalidateQueries({ queryKey: ['/api/role-room'] });
        console.log('[Role Room] API key auto-provisioned');
      })
      .catch((err) => {
        console.warn('[Role Room] Could not auto-provision API key:', err.message);
      });
  }, [userId, qc]);
}
