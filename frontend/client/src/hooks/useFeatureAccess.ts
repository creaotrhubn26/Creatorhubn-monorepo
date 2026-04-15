// @ts-nocheck
/**
 * useFeatureAccess Hook
 * Determines if current user can access a feature/tab
 * Implements 5-level priority hierarchy
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { apiRequest } from '@/lib/queryClient';
import { 
  isProfessionFeatureEnabled,
  isTabEnabled,
  isTabFeatureEnabled 
} from '../../shared/profession-feature-matrix';
import { isTabEnabled as isDashboardTabEnabled } from '../../shared/profession-dashboard-config';

export interface FeatureAccessResult {
  canAccess: boolean;
  source: 'user_override' | 'plan' | 'beta' | 'profession' | 'dashboard' | 'global' | 'denied';
  reason: string;
  loading: boolean;
}

/**
 * Check if user can access a specific feature
 */
export function useFeatureAccess(featureId: string): FeatureAccessResult {
  const { user } = useAuth() as { user: any };
  
  // Fetch user metadata (plan, beta, VIP)
  const { data: metadata, isLoading: metadataLoading } = useQuery({
    queryKey: [`/api/admin/users/${user?.id}/metadata`],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  // Fetch user overrides
  const { data: overrides, isLoading: overridesLoading } = useQuery({
    queryKey: [`/api/admin/users/${user?.id}/overrides`],
    enabled: !!user?.id,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
  
  // Fetch profession features
  const { data: professionFeatures, isLoading: professionLoading } = useQuery({
    queryKey: [`/api/admin/profession-features/${user?.profession}`],
    enabled: !!user?.profession,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  const loading = metadataLoading || overridesLoading || professionLoading;
  
  if (loading || !user) {
    return {
      canAccess: false,
      source: 'denied',
      reason: 'Loading...',
      loading: true,
    };
  }
  
  // 1. Check user-specific override (HIGHEST PRIORITY)
  const overridesData = overrides as any;
  if (overridesData?.features?.[featureId]) {
    const override = overridesData.features[featureId];
    
    // Check expiration
    if (!override.expiresAt || new Date(override.expiresAt) > new Date()) {
      return {
        canAccess: override.enabled,
        source: 'user_override',
        reason: override.reason || 'Admin override',
        loading: false,
      };
    }
  }
  
  // 2. Check VIP status
  if (metadata?.isVip) {
    return {
      canAccess: true,
      source: 'plan',
      reason: 'VIP user has all-access',
      loading: false,
    };
  }
  
  // 3. Check plan-based access
  if (metadata?.plan === 'enterprise') {
    return {
      canAccess: true,
      source: 'plan',
      reason: 'Enterprise plan includes all features',
      loading: false,
    };
  }
  
  if (metadata?.plan === 'pro') {
    const premiumFeatures = [
      'business_intelligence','unlimited_storage','priority_support','advanced_analytics','custom_branding','api_access'
    ];
    
    if (premiumFeatures.includes(featureId)) {
      return {
        canAccess: true,
        source: 'plan',
        reason: 'Pro plan includes this premium feature',
        loading: false,
      };
    }
  }
  
  // 4. Check beta tester access
  if (metadata?.isBetaTester) {
    const betaFeatures = [
      'ai_assistant','voice_commands','smart_suggestions','advanced_search','collaboration_tools'
    ];
    
    if (betaFeatures.includes(featureId)) {
      return {
        canAccess: true,
        source: 'beta',
        reason: 'Beta tester early access',
        loading: false,
      };
    }
  }
  
  // 5. Check profession-based access
  const professionFeaturesData = professionFeatures as any;
  if (user.profession && professionFeaturesData?.overrides?.[featureId] !== undefined) {
    return {
      canAccess: professionFeaturesData.overrides[featureId],
      source: 'profession',
      reason: `Default for ${user.profession} profession`,
      loading: false,
    };
  }
  
  // 6. Fall back to global default (from shared config)
  const professionDefault = isProfessionFeatureEnabled(user.profession || '', featureId);
  if (professionDefault !== undefined) {
    return {
      canAccess: professionDefault,
      source: 'profession',
      reason: `Default for ${user.profession} profession`,
      loading: false,
    };
  }
  
  // Default: deny access
  return {
    canAccess: false,
    source: 'denied',
    reason: 'Feature not available',
    loading: false,
  };
}

/**
 * Check if user can access a specific tab
 */
export function useTabAccess(tabId: string): FeatureAccessResult {
  const { user } = useAuth() as { user: any };
  
  // Fetch user metadata
  const { data: metadata, isLoading: metadataLoading } = useQuery({
    queryKey: [`/api/admin/users/${user?.id}/metadata`],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });
  
  // Fetch user overrides
  const { data: overrides, isLoading: overridesLoading } = useQuery({
    queryKey: [`/api/admin/users/${user?.id}/overrides`],
    enabled: !!user?.id,
    staleTime: 1 * 60 * 1000,
  });
  
  // Fetch dashboard config
  const { data: dashboardConfig, isLoading: dashboardLoading } = useQuery({
    queryKey: [`/api/admin/dashboard-config/${user?.profession}`],
    enabled: !!user?.profession,
    staleTime: 5 * 60 * 1000,
  });
  
  const loading = metadataLoading || overridesLoading || dashboardLoading;
  
  if (loading || !user) {
    return {
      canAccess: false,
      source: 'denied',
      reason: 'Loading...',
      loading: true,
    };
  }
  
  // 1. Check user-specific override
  const overridesData2 = overrides as any;
  if (overridesData2?.tabs?.[tabId]) {
    const override = overridesData2.tabs[tabId];
    
    if (!override.expiresAt || new Date(override.expiresAt) > new Date()) {
      return {
        canAccess: override.enabled,
        source: 'user_override',
        reason: override.reason || 'Admin override',
        loading: false,
      };
    }
  }
  
  // 2. Check VIP status
  if (metadata?.isVip) {
    return {
      canAccess: true,
      source: 'plan',
      reason: 'VIP user has all-access',
      loading: false,
    };
  }
  
  // 3. Check plan-based access
  if (metadata?.plan === 'enterprise') {
    return {
      canAccess: true,
      source: 'plan',
      reason: 'Enterprise plan includes all tabs',
      loading: false,
    };
  }
  
  if (metadata?.plan === 'pro') {
    const premiumTabs = ['business_intelligence','live_cameras','online_classes','advanced_analytics'];
    
    if (premiumTabs.includes(tabId)) {
      return {
        canAccess: true,
        source: 'plan',
        reason: 'Pro plan includes premium tabs',
        loading: false,
      };
    }
  }
  
  // 4. Check beta tester access
  if (metadata?.isBetaTester) {
    const betaTabs = ['ai_assistant','advanced_search','collaboration_tools'];
    
    if (betaTabs.includes(tabId)) {
      return {
        canAccess: true,
        source: 'beta',
        reason: 'Beta tester early access',
        loading: false,
      };
    }
  }
  
  // 5. Check dashboard config
  const dashboardConfigData = dashboardConfig as any;
  if (dashboardConfigData?.tabs?.[tabId] !== undefined) {
    return {
      canAccess: dashboardConfigData.tabs[tabId],
      source: 'dashboard',
      reason: `Dashboard config for ${user.profession}`,
      loading: false,
    };
  }
  
  // 6. Fall back to profession default
  const tabEnabled = isDashboardTabEnabled(user.profession || '', tabId);
  if (tabEnabled !== undefined) {
    return {
      canAccess: tabEnabled,
      source: 'profession',
      reason: `Default for ${user.profession} profession`,
      loading: false,
    };
  }
  
  // Default: deny access
  return {
    canAccess: false,
    source: 'denied',
    reason: 'Tab not available',
    loading: false,
  };
}

/**
 * Get all accessible tabs for current user
 */
export function useAccessibleTabs(allTabs: string[]): {
  accessibleTabs: string[];
  loading: boolean;
} {
  const { user } = useAuth() as { user: any };
  
  const { data: metadata, isLoading: metadataLoading } = useQuery({
    queryKey: [`/api/admin/users/${user?.id}/metadata`],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });
  
  const { data: overrides, isLoading: overridesLoading } = useQuery({
    queryKey: [`/api/admin/users/${user?.id}/overrides`],
    enabled: !!user?.id,
    staleTime: 1 * 60 * 1000,
  });
  
  const { data: dashboardConfig, isLoading: dashboardLoading } = useQuery({
    queryKey: [`/api/admin/dashboard-config/${user?.profession}`],
    enabled: !!user?.profession,
    staleTime: 5 * 60 * 1000,
  });
  
  const loading = metadataLoading || overridesLoading || dashboardLoading;
  
  if (loading || !user) {
    return { accessibleTabs: [], loading: true };
  }
  
  // VIP and Enterprise get all tabs
  const metadataData3 = metadata as any;
  if (metadataData3?.isVip || metadataData3?.plan === 'enterprise') {
    return { accessibleTabs: allTabs, loading: false };
  }
  
  // Filter tabs based on access
  const overridesData3 = overrides as any;
  const dashboardConfigData3 = dashboardConfig as any;
  const accessibleTabs = allTabs.filter(tabId => {
    // Check user override
    if (overridesData3?.tabs?.[tabId]) {
      const override = overridesData3.tabs[tabId];
      if (!override.expiresAt || new Date(override.expiresAt) > new Date()) {
        return override.enabled;
      }
    }
    
    // Check plan
    if (metadataData3?.plan === 'pro') {
      const premiumTabs = ['business_intelligence','live_cameras','online_classes'];
      if (premiumTabs.includes(tabId)) return true;
    }
    
    // Check beta
    if (metadataData3?.isBetaTester) {
      const betaTabs = ['ai_assistant','advanced_search'];
      if (betaTabs.includes(tabId)) return true;
    }
    
    // Check dashboard config
    if (dashboardConfigData3?.tabs?.[tabId] !== undefined) {
      return dashboardConfigData3.tabs[tabId];
    }
    
    // Check profession default
    return isDashboardTabEnabled(user.profession ||'', tabId);
  });
  
  return { accessibleTabs, loading: false };
}
