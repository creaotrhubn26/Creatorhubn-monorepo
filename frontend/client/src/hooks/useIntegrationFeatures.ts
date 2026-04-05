/**
 * CreatorHub Norge - React Hook for Integration Features
 * Automatically discovers and activates features based on available API integrations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { isKnownUnavailableApiEndpoint } from '@/lib/queryClient';

export interface FeatureAvailability {
  available: boolean;
  features: string[];
  endpoints: string[];
  lastChecked: string; 
}

export interface IntegrationFeatures {
  [service: string]: FeatureAvailability; 
}

export interface UseIntegrationFeaturesReturn {
  features: IntegrationFeatures;
  isLoading: boolean;
  error: string | null;
  hasFeature: (service: string) => boolean;
  getFeatureList: (service: string) => string[];
    canUseEndpoint: (service: string, endpoint: string) => boolean;
    refreshFeatures: () => void;
    totalActiveIntegrations: number;
}

export const useIntegrationFeatures = (): UseIntegrationFeaturesReturn => {
  const queryClient = useQueryClient();
  const [features, setFeatures] = useState<IntegrationFeatures>({});
  const featuresEndpointAvailable = !isKnownUnavailableApiEndpoint('/api/integrations/features');

  // Fetch feature availability from backend
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/integrations/features'],
    queryFn: async () => {
      const response = await fetch('/api/integrations/features');
      if (!response.ok) {
        throw new Error('Failed to fetch integration features');
    }
      return response.json();
  },
    enabled: featuresEndpointAvailable,
    refetchInterval: featuresEndpointAvailable ? 30000 : false,
    staleTime: 10000, // Consider data stale after 10 seconds
});

  // Update local state when data changes
  useEffect(() => {
    if (data?.success && data.features) {
      setFeatures(data.features);
      console.log('🔄 Integration features updated: ', Object.keys(data.features));
  }
}, [data]);

  // Listen for API key creation to refresh features
  useEffect(() => {
    const handleApiKeyCreated = () => {
      console.log('🔄 API key created, refreshing features...');
      setTimeout(() => refetch(), 1000); // Small delay to allow backend processing
  };

    // Listen for custom events from API key creation
    window.addEventListener('apiKeyCreated', handleApiKeyCreated);

    return () => {
      window.removeEventListener('apiKeyCreated', handleApiKeyCreated);
  };
}, [refetch]);

  const hasFeature = (service: string): boolean => {
    return features[service]?.available || false;
};

  const getFeatureList = (service: string): string[] => {
    return features[service]?.features || [];
};

  const canUseEndpoint = (service: string, endpoint: string): boolean => {
    const serviceFeatures = features[service];
    if (!serviceFeatures?.available) return false;

    return serviceFeatures.endpoints.some(
      (ep) => ep.includes(endpoint) || endpoint.includes(ep.split('/').pop() || ', '),
    );
};

  const refreshFeatures = () => {
    if (featuresEndpointAvailable) {
      refetch();
    }
};

  const totalActiveIntegrations = Object.values(features).filter((f) => f.available).length;

  return {
    features,
    isLoading,
    error: featuresEndpointAvailable ? (error?.message || null) : null,
    hasFeature,
    getFeatureList,
    canUseEndpoint,
    refreshFeatures,
    totalActiveIntegrations,
};
};

/**
 * Specific hooks for individual services
 */
export const useBringIntegration = () => {
  const { hasFeature, getFeatureList, canUseEndpoint } = useIntegrationFeatures();

  return {
    isActive: hasFeature('bring'),
    features: getFeatureList('bring'),
    canCalculateShipping: canUseEndpoint('bring', '/shipping/rates'),
    canTrackPackages: canUseEndpoint('bring','/shipping/track'),
    canValidatePostalCodes: canUseEndpoint('bring','/shipping/validate'),
};
};

export const useStripeIntegration = () => {
  const { hasFeature, getFeatureList, canUseEndpoint } = useIntegrationFeatures();

  return {
    isActive: hasFeature('stripe'),
    features: getFeatureList('stripe'),
    canProcessPayments: canUseEndpoint('stripe','/payments/process'),
    canManageSubscriptions: canUseEndpoint('stripe','/subscriptions/manage'),
    canCreateInvoices: canUseEndpoint('stripe','/invoices/create'),
};
};

export const useOpenAIIntegration = () => {
  const { hasFeature, getFeatureList, canUseEndpoint } = useIntegrationFeatures();

  return {
    isActive: hasFeature('openai'),
    features: getFeatureList('openai'),
    canGenerateText: canUseEndpoint('openai','/ai/generate'),
    canAnalyzeImages: canUseEndpoint('openai','/ai/analyze'),
    canChat: canUseEndpoint('openai','/ai/chat'),
};
};

export const useGoogleWorkspaceIntegration = () => {
  const { hasFeature, getFeatureList, canUseEndpoint } = useIntegrationFeatures();

  return {
    isActive: hasFeature('google_workspace'),
    features: getFeatureList('google_workspace'),
    canCreateDriveFolders: canUseEndpoint('google_workspace','/drive/create-folder'),
    canScheduleMeetings: canUseEndpoint('google_workspace','/calendar/schedule'),
    canSendEmails: canUseEndpoint('google_workspace','/gmail/send'),
};
};

export const useInstagramIntegration = () => {
  const { hasFeature, getFeatureList, canUseEndpoint } = useIntegrationFeatures();

  return {
    isActive: hasFeature('instagram'),
    features: getFeatureList('instagram'),
    canPostMedia: canUseEndpoint('instagram', '/instagram/post'),
    canGetInsights: canUseEndpoint('instagram', '/instagram/insights'),
};
};

/**
 * Hook for conditional rendering based on integrations
 */
export const useConditionalFeatures = () => {
  const { features, totalActiveIntegrations } = useIntegrationFeatures();

  const shouldShowFeature = (requiredIntegrations: string[]): boolean => {
    return requiredIntegrations.every((integration) => features[integration]?.available);
};

  const getIntegrationStatus = () => {
    return Object.entries(features).map(([service, feature]) => ({
      service,
      available: feature.available,
      featureCount: feature.features.length,
  }));
};

  return {
    shouldShowFeature,
    getIntegrationStatus,
    totalActiveIntegrations,
    hasAnyIntegrations: totalActiveIntegrations > 0,
};
};
