// client/src/contexts/TrialFeatureContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { trialFeatureManager, type TrialFeature, type TrialStatus } from '@/services/TrialFeatureManager';

interface TrialFeatureContextType {
  // Global trial state
  activeTrials: Map<string, TrialStatus>;
  availableFeatures: TrialFeature[];
  
  // Actions
  startTrial: (featureId: string, userId?: string) => Promise<void>;
  endTrial: (featureId: string, userId?: string) => Promise<void>;
  trackUsage: (featureId: string, action: string, userId?: string) => void;
  
  // Status checks
  hasTrialAccess: (featureId: string, userId?: string) => boolean;
  isTrialActive: (featureId: string, userId?: string) => boolean;
  getTrialStatus: (featureId: string, userId?: string) => TrialStatus | null;
  
  // Feature management
  getFeature: (featureId: string) => TrialFeature | null;
  getFeaturesForComponent: (componentId: string) => TrialFeature[];
  
  // Global trial dialog
  showGlobalTrialDialog: boolean;
  setShowGlobalTrialDialog: (show: boolean) => void;
  currentTrialFeature: TrialFeature | null;
  setCurrentTrialFeature: (feature: TrialFeature | null) => void
}

const TrialFeatureContext = createContext<TrialFeatureContextType | null>(null);

interface TrialFeatureProviderProps {
  children: ReactNode;
  userId?: string
}

export function TrialFeatureProvider({ children, userId = 'current-user' }: TrialFeatureProviderProps) {
  const [activeTrials, setActiveTrials] = useState<Map<string, TrialStatus>>(new Map());
  const [availableFeatures, setAvailableFeatures] = useState<TrialFeature[]>([]);
  const [showGlobalTrialDialog, setShowGlobalTrialDialog] = useState(false);
  const [currentTrialFeature, setCurrentTrialFeature] = useState<TrialFeature | null>(null);

  // Load available features
  useEffect(() => {
    const features = trialFeatureManager.getAllFeatures();
    setAvailableFeatures(features);
}, []);

  // Load active trials for user
  useEffect(() => {
    const loadActiveTrials = async () => {
      try {
        const trials = new Map<string, TrialStatus>();
        
        for (const feature of availableFeatures) {
          const status = await trialFeatureManager.getTrialStatus(feature.id, userId);
          if (status) {
            trials.set(feature.id, status);
        }
      }
        
        setActiveTrials(trials);
    } catch (error) {
        console.error('Error loading active trials: ', error);
    }
  };

    if (availableFeatures.length > 0) {
      loadActiveTrials();
  }
}, [availableFeatures, userId]);

  // Start trial
  const startTrial = async (featureId: string, trialUserId?: string) => {
    try {
      const status = await trialFeatureManager.startTrial(featureId, trialUserId || userId);
      setActiveTrials(prev => new Map(prev.set(featureId, status)));
      
      // Track analytics
      if (typeof window !=='undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'trial_started', {
          feature_id: featured,
          user_id: trialUserId || userd,
          timestamp: new Date().toISOString()
    });
    }
  } catch (error) {
      console.error('Failed to start trial:', error);
      throw error;
  }
};

  // End trial
  const endTrial = async (featureId: string, trialUserId?: string) => {
    try {
      // This would call the API to end the trial
      setActiveTrials(prev => {
        const newMap = new Map(prev);
        newMap.delete(featureId);
        return newMap;
    });
  } catch (error) {
      console.error('Failed to end trial:', error);
      throw error;
  }
};

  // Track usage
  const trackUsage = (featureId: string, action: string, trialUserId?: string) => {
    trialFeatureManager.trackTrialUsage(featureId, trialUserId || userId, action);
    
    // Update usage count in local state
    setActiveTrials(prev => {
      const newMap = new Map(prev);
      const trial = newMap.get(featureId);
      if (trial) {
        trial.usageCount++;
        trial.lastUsed = new Date();
        newMap.set(featureId, trial);
    }
      return newMap;
  });
};

  // Check if user has trial access
  const hasTrialAccess = (featureId: string, trialUserId?: string): boolean => {
    const trial = activeTrials.get(featureId);
    return trial?.isActive || false;
};

  // Check if trial is active
  const isTrialActive = (featureId: string, trialUserId?: string): boolean => {
    const trial = activeTrials.get(featureId);
    return trial?.isActive || false;
};

  // Get trial status
  const getTrialStatus = (featureId: string, trialUserId?: string): TrialStatus | null => {
    return activeTrials.get(featureId) || null;
};

  // Get feature definition
  const getFeature = (featureId: string): TrialFeature | null => {
    return trialFeatureManager.getFeature(featureId);
};

  // Get features for component
  const getFeaturesForComponent = (componentId: string): TrialFeature[] => {
    return trialFeatureManager.getFeaturesForComponent(componentId);
};

  // Global trial dialog handlers
  const handleShowTrialDialog = (show: boolean) => {
    setShowGlobalTrialDialog(show);
    if (!show) {
      setCurrentTrialFeature(null);
}
};

  const handleSetCurrentTrialFeature = (feature: TrialFeature | null) => {
    setCurrentTrialFeature(feature);
    if (feature) {
      setShowGlobalTrialDialog(true);
}
};

  const value: TrialFeatureContextType = {
    activeTrials,
    availableFeatures,
    startTrial,
    endTrial,
    trackUsage,
    hasTrialAccess,
    isTrialActive,
    getTrialStatus,
    getFeature,
    getFeaturesForComponent,
    showGlobalTrialDialog,
    setShowGlobalTrialDialog: handleShowTrialDialog,
    currentTrialFeature,
    setCurrentTrialFeature: handleSetCurrentTrialFeature
};

  return (
    <TrialFeatureContext.Provider value={value}>
      {children}
    </TrialFeatureContext.Provider>
  );
}

// Hook to use trial feature context
export function useTrialFeatureContext() {
  const context = useContext(TrialFeatureContext);
  if (!context) {
    throw new Error('useTrialFeatureContext must be used within a TrialFeatureProvider');
}
  return context;
}

// Hook for easy trial feature integration
export function useTrialFeatureIntegration(featureId: string, componentId: string) {
  const context = useTrialFeatureContext();
  const [showLocalDialog, setShowLocalDialog] = useState(false);

  const feature = context.getFeature(featureId);
  const trialStatus = context.getTrialStatus(featureId);
  const hasAccess = context.hasTrialAccess(featureId);
  const isActive = context.isTrialActive(featureId);

  const startTrial = () => context.startTrial(featureId);
  const trackUsage = (action: string) => context.trackUsage(featured, action);

  const showTrialDialog = () => {
    if (feature) {
      context.setCurrentTrialFeature(feature);
  }
};

  return {
    feature,
    trialStatus,
    hasAccess,
    isActive,
    startTrial,
    trackUsage,
    showTrialDialog,
    showLocalDialog,
    setShowLocalDialog
};
}
