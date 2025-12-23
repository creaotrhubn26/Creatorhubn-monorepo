/**
 * useEnterpriseFeatureAccess Hook
 * Checks if current user has access to a feature based on their enterprise role
 * Works with the enterprise feature permissions system
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { apiRequest } from '@/lib/queryClient';

export type EnterpriseRole = 'admin' | 'member' | 'viewer';
export type PermissionLevel = 'all' | 'admin_member' | 'admin_only' | 'disabled';

export interface EnterpriseFeatureAccessResult {
  /** Whether user can access the feature */
  canAccess: boolean;
  /** User's role in the enterprise organization */
  role: EnterpriseRole | null;
  /** The permission level for this feature */
  permissionLevel: PermissionLevel;
  /** Whether user is part of an enterprise organization */
  isEnterprise: boolean;
  /** Organization ID if user is enterprise */
  organizationId: string | null;
  /** Loading state */
  loading: boolean;
  /** Source of the access decision */
  source: 'enterprise_permission' | 'not_enterprise' | 'loading' | 'error';
  /** Human-readable reason */
  reason: string;
}

interface EnterpriseTeamMember {
  id: string;
  organizationId: string;
  userId: string;
  role: EnterpriseRole;
  status: string;
}

interface OrganizationSettings {
  adminOnlyFeatures: string[];
  disabledFeatures: string[];
}

/**
 * Check if user has access to a feature based on enterprise permissions
 */
export function useEnterpriseFeatureAccess(featureId: string): EnterpriseFeatureAccessResult {
  const { user } = useAuth() as { user: any };
  
  // Fetch user's enterprise membership info
  const { data: membership, isLoading: membershipLoading } = useQuery<EnterpriseTeamMember | null>({
    queryKey: ['/api/enterprise/my-membership'],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', '/api/enterprise/my-membership');
        return response.membership || null;
      } catch {
        return null;
      }
    }
  });
  
  // Fetch organization settings (includes feature permissions)
  const { data: orgSettings, isLoading: settingsLoading } = useQuery<OrganizationSettings | null>({
    queryKey: ['/api/enterprise/organization-settings', membership?.organizationId],
    enabled: !!membership?.organizationId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!membership?.organizationId) return null;
      try {
        const response = await apiRequest('GET', `/api/enterprise/organization-settings?organizationId=${membership.organizationId}`);
        return response.settings || null;
      } catch {
        return null;
      }
    }
  });

  const loading = membershipLoading || settingsLoading;

  // Not logged in or not enterprise
  if (!user) {
    return {
      canAccess: true, // Non-enterprise users bypass this check
      role: null,
      permissionLevel: 'all',
      isEnterprise: false,
      organizationId: null,
      loading: false,
      source: 'not_enterprise',
      reason: 'Ikke logget inn'
    };
  }

  if (loading) {
    return {
      canAccess: false,
      role: null,
      permissionLevel: 'all',
      isEnterprise: false,
      organizationId: null,
      loading: true,
      source: 'loading',
      reason: 'Laster...'
    };
  }

  // Not part of an enterprise organization
  if (!membership) {
    return {
      canAccess: true, // Non-enterprise users bypass this check
      role: null,
      permissionLevel: 'all',
      isEnterprise: false,
      organizationId: null,
      loading: false,
      source: 'not_enterprise',
      reason: 'Ikke en enterprise-bruker'
    };
  }

  const { role, organizationId } = membership;
  
  // Check if feature is disabled for all
  if (orgSettings?.disabledFeatures?.includes(featureId)) {
    return {
      canAccess: false,
      role,
      permissionLevel: 'disabled',
      isEnterprise: true,
      organizationId,
      loading: false,
      source: 'enterprise_permission',
      reason: 'Funksjon er deaktivert for denne organisasjonen'
    };
  }

  // Check if feature is admin-only
  if (orgSettings?.adminOnlyFeatures?.includes(featureId)) {
    const canAccess = role === 'admin';
    return {
      canAccess,
      role,
      permissionLevel: 'admin_only',
      isEnterprise: true,
      organizationId,
      loading: false,
      source: 'enterprise_permission',
      reason: canAccess ? 'Admin-tilgang' : 'Kun tilgjengelig for administratorer'
    };
  }

  // Default: all roles can access
  return {
    canAccess: true,
    role,
    permissionLevel: 'all',
    isEnterprise: true,
    organizationId,
    loading: false,
    source: 'enterprise_permission',
    reason: 'Full tilgang'
  };
}

/**
 * Get user's enterprise membership info
 */
export function useEnterpriseMembership() {
  const { user } = useAuth() as { user: any };

  const { data: membership, isLoading } = useQuery<EnterpriseTeamMember | null>({
    queryKey: ['/api/enterprise/my-membership'],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', '/api/enterprise/my-membership');
        return response.membership || null;
      } catch {
        return null;
      }
    }
  });

  return {
    membership,
    isEnterprise: !!membership,
    role: membership?.role || null,
    organizationId: membership?.organizationId || null,
    loading: isLoading
  };
}

/**
 * Utility to check if a role has access based on permission level
 */
export function canRoleAccess(role: EnterpriseRole | null, permissionLevel: PermissionLevel): boolean {
  if (permissionLevel === 'disabled') return false;
  if (permissionLevel === 'all') return true;
  if (!role) return true; // Non-enterprise users bypass

  if (permissionLevel === 'admin_only') {
    return role === 'admin';
  }

  if (permissionLevel === 'admin_member') {
    return role === 'admin' || role ==='member';
  }

  return true;
}

