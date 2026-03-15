import { useMemo } from 'react';
import type { UserRole } from '../models/casting';

interface PermissionSnapshot {
  canViewAll?: boolean;
  canEditCasting?: boolean;
  canEditProduction?: boolean;
  canEditShotLists?: boolean;
  canManageCrew?: boolean;
  canManageLocations?: boolean;
  canApprove?: boolean;
  canComment?: boolean;
  canRequestChanges?: boolean;
  canViewEconomy?: boolean;
}

export interface ProducerAccessState {
  isProductionTeamMode: boolean;
  isContentProducerMode: boolean;
  isClientReviewerMode: boolean;
  canEditProductionData: boolean;
  canComment: boolean;
  canRequestChanges: boolean;
  canViewEconomy: boolean;
  canMakeReviewDecision: boolean;
}

export function useProducerAccess(
  userRole: UserRole | null,
  permissions?: PermissionSnapshot | null
): ProducerAccessState {
  return useMemo(() => {
    const role = userRole?.role ?? '';
    const rolePermissions = userRole?.permissions ?? {};
    const mergedPermissions: PermissionSnapshot = {
      ...permissions,
      ...rolePermissions,
    };

    const isContentProducerMode = role === 'content_producer';
    const isClientReviewerMode = role === 'client_reviewer';
    const isProductionTeamMode = !isContentProducerMode && !isClientReviewerMode;

    const canEditProductionData = Boolean(
      mergedPermissions.canEditProduction ||
      ['director', 'producer', 'production_manager', 'content_producer'].includes(role)
    );
    const canComment = Boolean(
      mergedPermissions.canComment ||
      ['director', 'producer', 'content_producer', 'client_reviewer'].includes(role)
    );
    const canRequestChanges = Boolean(
      mergedPermissions.canRequestChanges ||
      ['director', 'producer', 'content_producer', 'client_reviewer'].includes(role)
    );
    const canViewEconomy = Boolean(
      mergedPermissions.canViewEconomy ||
      ['director', 'producer', 'content_producer'].includes(role)
    );
    const canMakeReviewDecision = Boolean(
      mergedPermissions.canApprove ||
      mergedPermissions.canRequestChanges ||
      ['director', 'producer', 'client_reviewer'].includes(role)
    );

    return {
      isProductionTeamMode,
      isContentProducerMode,
      isClientReviewerMode,
      canEditProductionData,
      canComment,
      canRequestChanges,
      canViewEconomy,
      canMakeReviewDecision,
    };
  }, [permissions, userRole]);
}
