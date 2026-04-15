// @ts-nocheck
/**
 * React hook for managing profession configurations
 * Provides easy access to profession-specific settings, terminology, and workflows
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { 
  ProfessionConfig} from '../types/ProfessionConfig';
import { 
  ProfessionConfigManager, 
  DEFAULT_PROFESSION_CONFIGS 
} from '../types/ProfessionConfig';

interface UseProfessionConfigOptions {
  profession: string;
  autoLoad?: boolean;
  enableCaching?: boolean
}

interface UseProfessionConfigReturn {
  // Configuration data
  config: ProfessionConfig | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  
  // Configuration methods
  updateConfig: (updates: Partial<ProfessionConfig>) => Promise<void>;
  resetToDefault: () => Promise<void>;
  reloadConfig: () => Promise<void>;
  
  // Convenience getters
  terminology: Record<string, string>;
  settings: any;
  workflows: any;
  ui: any;
  integrations: any;
  enhancementPresets: any;
  batchOperations: any;
  analytics: any;
  
  // Utility methods
  getTerm: (key: string) => string;
  getSetting: (key: string) => any;
  getWorkflow: (key: string) => any;
  getUISetting: (key: string) => any;
  getIntegration: (key: string) => any
}

export const useProfessionConfig = ({
  profession,
  autoLoad = true,
  enableCaching = true
}: UseProfessionConfigOptions): UseProfessionConfigReturn => {
  const queryClient = useQueryClient();
  const [localConfig, setLocalConfig] = useState<ProfessionConfig | null>(null);
  
  // Query for profession configuration
  const {
    data: config,
    isLoading,
    isError,
    error,
    refetch
} = useQuery({
    queryKey: ['profession-config', profession],
    queryFn: async () => {
      try {
        const config = await ProfessionConfigManager.loadProfessionConfig(profession);
        setLocalConfig(config);
        return config;
  } catch (error) {
        console.error(`Failed to load profession config for ${profession}:`, error);
        throw error;
    }
  },
    enabled: autoLoad && !!profession,
    staleTime: enableCaching ? 5 * 60 * 1000 : 0, // 5 minutes
    gcTime: enableCaching ? 10 * 60 * 1000 : 0, // 10 minutes (renamed from cacheTime in react-query v5)
    retry: 2
});
  
  // Mutation for updating configuration
  const updateConfigMutation = useMutation({
    mutationFn: async (updates: Partial<ProfessionConfig>) => {
      if (!config) throw new Error('No configuration loaded');
      
      const updatedConfig = {
        ...config,
        ...updates,
        updatedAt: new Date()
  };
      
      await ProfessionConfigManager.saveProfessionConfig(updatedConfig);
      return updatedConfig;
  },
    onSuccess: (updatedConfig) => {
      setLocalConfig(updatedConfig);
      queryClient.setQueryData(['profession-config', profession], updatedConfig);
      queryClient.invalidateQueries({ queryKey: ['profession-config', ],});
  },
    onError: (error) => {
      console.error('Failed to update profession config, : ', error);
  }
});
  
  // Mutation for resetting to default
  const resetToDefaultMutation = useMutation({
    mutationFn: async () => {
      const defaultConfig = DEFAULT_PROFESSION_CONFIGS[profession];
      if (!defaultConfig) {
        throw new Error(`No default configuration found for profession: ${profession}`);
    }
      
      const resetConfig: ProfessionConfig = {
        ...defaultConfig,
        version:  1,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'system',
        isActive: true,
        isDefault: true
  } as ProfessionConfig;
      
      await ProfessionConfigManager.saveProfessionConfig(resetConfig);
      return resetConfig;
  },
    onSuccess: (resetConfig) => {
      setLocalConfig(resetConfig);
      queryClient.setQueryData(['profession-config', profession], resetConfig);
      queryClient.invalidateQueries({ queryKey: ['profession-config', ],});
  },
    onError: (error) => {
      console.error('Failed to reset profession config, :', error);
  }
});
  
  // Configuration update method
  const updateConfig = useCallback(async (updates: Partial<ProfessionConfig>) => {
    await updateConfigMutation.mutateAsync(updates);
}, [updateConfigMutation]);
  
  // Reset to default method
  const resetToDefault = useCallback(async () => {
    await resetToDefaultMutation.mutateAsync();
}, [resetToDefaultMutation]);
  
  // Reload configuration method
  const reloadConfig = useCallback(async () => {
    await refetch();
}, [refetch]);
  
  // Convenience getters
  const terminology = config?.terminology || DEFAULT_PROFESSION_CONFIGS[profession]?.terminology || {};
  const settings = config?.settings || DEFAULT_PROFESSION_CONFIGS[profession]?.settings || {};
  const workflows = config?.workflows || DEFAULT_PROFESSION_CONFIGS[profession]?.workflows || {};
  const ui = config?.ui || DEFAULT_PROFESSION_CONFIGS[profession]?.ui || {};
  const integrations = config?.integrations || DEFAULT_PROFESSION_CONFIGS[profession]?.integrations || {};
  const enhancementPresets = config?.enhancementPresets || DEFAULT_PROFESSION_CONFIGS[profession]?.enhancementPresets || {};
  const batchOperations = config?.batchOperations || DEFAULT_PROFESSION_CONFIGS[profession]?.batchOperations || {};
  const analytics = config?.analytics || DEFAULT_PROFESSION_CONFIGS[profession]?.analytics || {};
  
  // Utility methods
  const getTerm = useCallback((key: string): string => {
    return terminology[key] || key;
}, [terminology]);
  
  const getSetting = useCallback((key: string): any => {
    return settings[key];
}, [settings]);
  
  const getWorkflow = useCallback((key: string): any => {
    return workflows[key];
}, [workflows]);
  
  const getUISetting = useCallback((key: string): any => {
    return ui[key];
}, [ui]);
  
  const getIntegration = useCallback((key: string): any => {
    return integrations[key];
}, [integrations]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (!enableCaching) {
        ProfessionConfigManager.clearCache();
    }
  };
}, [enableCaching]);
  
  return {
    // Configuration data
    config: localConfig || config,
    isLoading,
    isError,
    error: error as Error | null,
    
    // Configuration methods
    updateConfig,
    resetToDefault,
    reloadConfig,
    
    // Convenience getters
    terminology,
    settings,
    workflows,
    ui,
    integrations,
    enhancementPresets,
    batchOperations,
    analytics,
    
    // Utility methods
    getTerm,
    getSetting,
    getWorkflow,
    getUISetting,
    getIntegration
};
};

export default useProfessionConfig;
