/**
 * Hook to check if a specific feature is enabled for the current user
 */

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../lib/queryClient';
import { useEnhancedMasterIntegration } from '../integration/EnhancedMasterIntegrationProvider';
import { useEffect } from 'react';

interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  category: string;
  isEnabled: boolean;
  usageCount: number;
  lastModified: string; 
}

export const useFeatureFlag = (featureId: string) => {
  // ⭐ Enhanced Master Integration
  const { analytics, performance, debugging, dataFlow } = useEnhancedMasterIntegration();
  
  const { data: features = [], isLoading } = useQuery({
    queryKey: ['/api/admin/features'],
    queryFn: async () => {
      const endTiming = performance.startTiming('fetch_feature_flags');
      try {
        const data = await apiRequest('/api/admin/features');
        analytics.trackEvent('feature_flags_fetched', { count: data.length });
        return data;
      } finally {
        endTiming();
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
});

  const feature = features.find((f: FeatureFlag) => f.id === featureId);
  
  // Track feature flag check
  useEffect(() => {
    if (!isLoading && feature) {
      analytics.trackEvent('feature_flag_checked', {
        featureId,
        isEnabled: feature.isEnabled,
        category: feature.category
      });
      
      // Sync with data flow
      dataFlow.syncData(`useFeatureFlag:${featureId}`, {
        isEnabled: feature.isEnabled,
        feature
      });
      
      debugging.logIntegration('info', 'Feature flag checked', {
        featureId,
        isEnabled: feature.isEnabled
      });
    }
  }, [featureId, feature, isLoading, analytics, dataFlow, debugging]);
  
  return {
    isEnabled: feature?.isEnabled ?? false,
    isLoading,
    feature,
};
};

export const useFeatureFlags = (featureIds: string[]) => {
  // ⭐ Enhanced Master Integration
  const { analytics, performance, debugging, dataFlow } = useEnhancedMasterIntegration();
  
  const { data: features = [], isLoading } = useQuery({
    queryKey: ['/api/admin/features'],
    queryFn: async () => {
      const endTiming = performance.startTiming('fetch_multiple_feature_flags');
      try {
        const data = await apiRequest('/api/admin/features');
        analytics.trackEvent('multiple_feature_flags_fetched', {
          count: data.length,
          requestedIds: featureIds
        });
        return data;
      } finally {
        endTiming();
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
});

  const featureMap = featureIds.reduce((acc, featureId) => {
    const feature = features.find((f: FeatureFlag) => f.id === featureId);
    acc[featureId] = {
      isEnabled: feature?.isEnabled ?? false,
      feature,
  };
    return acc;
}, {} as Record<string, { isEnabled: boolean; feature?: FeatureFlag }>);

  // Track multiple feature flags check
  useEffect(() => {
    if (!isLoading && features.length > 0) {
      const enabledCount = Object.values(featureMap).filter(f => f.isEnabled).length;
      
      analytics.trackEvent('multiple_feature_flags_checked', {
        featureIds,
        enabledCount,
        totalCount: featureIds.length
      });
      
      // Sync with data flow
      dataFlow.syncData('useFeatureFlags:multiple', {
        featureMap,
        enabledCount
      });
      
      debugging.logIntegration('info', 'Multiple feature flags checked', {
        featureIds,
        enabledCount
      });
    }
  }, [featureIds, featureMap, isLoading, features.length, analytics, dataFlow, debugging]);

  return {
    features: featureMap,
    isLoading,
};
};



