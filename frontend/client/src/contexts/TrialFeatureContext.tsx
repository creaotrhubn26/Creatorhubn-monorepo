// client/src/contexts/TrialFeatureContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  trialFeatureManager,
  type TrialFeature,
  type TrialStatus,
} from '@/services/TrialFeatureManager';

interface TrialFeatureContextType {
  activeTrials: Map<string, TrialStatus>;
  availableFeatures: TrialFeature[];
  startTrial: (featureId: string, userId?: string) => Promise<TrialStatus>;
  endTrial: (featureId: string, userId?: string) => Promise<void>;
  trackUsage: (featureId: string, action: string, userId?: string) => Promise<void>;
  hasTrialAccess: (featureId: string) => boolean;
  isTrialActive: (featureId: string) => boolean;
  getTrialStatus: (featureId: string) => TrialStatus | null;
  getFeature: (featureId: string) => TrialFeature | null;
  getFeaturesForComponent: (componentId: string) => TrialFeature[];
  showGlobalTrialDialog: boolean;
  setShowGlobalTrialDialog: (show: boolean) => void;
  currentTrialFeature: TrialFeature | null;
  setCurrentTrialFeature: (feature: TrialFeature | null) => void;
}

const TrialFeatureContext = createContext<TrialFeatureContextType | null>(null);

interface TrialFeatureProviderProps {
  children: ReactNode;
  userId?: string;
}

const getTrialKey = (featureId: string) => featureId;

export function TrialFeatureProvider({
  children,
  userId = 'current-user',
}: TrialFeatureProviderProps) {
  const [activeTrials, setActiveTrials] = useState<Map<string, TrialStatus>>(new Map());
  const [availableFeatures, setAvailableFeatures] = useState<TrialFeature[]>([]);
  const [showGlobalTrialDialog, setShowGlobalTrialDialog] = useState(false);
  const [currentTrialFeature, setCurrentTrialFeature] = useState<TrialFeature | null>(null);

  useEffect(() => {
    setAvailableFeatures(trialFeatureManager.getAllFeatures());
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadActiveTrials = async () => {
      const nextTrials = new Map<string, TrialStatus>();

      for (const feature of availableFeatures) {
        const status = await trialFeatureManager.getTrialStatus(feature.id, userId);
        if (status?.isActive) {
          nextTrials.set(getTrialKey(feature.id), status);
        }
      }

      if (isMounted) {
        setActiveTrials(nextTrials);
      }
    };

    if (availableFeatures.length > 0) {
      void loadActiveTrials();
    }

    return () => {
      isMounted = false;
    };
  }, [availableFeatures, userId]);

  const startTrial = async (featureId: string, trialUserId = userId) => {
    const status = await trialFeatureManager.startTrial(featureId, trialUserId);
    setActiveTrials((previous) => {
      const next = new Map(previous);
      next.set(getTrialKey(featureId), status);
      return next;
    });

    if (typeof window !== 'undefined' && 'gtag' in window) {
      const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
      gtag?.('event', 'trial_started', {
        feature_id: featureId,
        user_id: trialUserId,
        timestamp: new Date().toISOString(),
      });
    }

    setShowGlobalTrialDialog(false);
    return status;
  };

  const endTrial = async (featureId: string) => {
    setActiveTrials((previous) => {
      const next = new Map(previous);
      next.delete(getTrialKey(featureId));
      return next;
    });
  };

  const trackUsage = async (featureId: string, action: string, trialUserId = userId) => {
    await trialFeatureManager.trackTrialUsage(featureId, trialUserId, action);

    setActiveTrials((previous) => {
      const next = new Map(previous);
      const trial = next.get(getTrialKey(featureId));
      if (trial) {
        next.set(getTrialKey(featureId), {
          ...trial,
          usageCount: trial.usageCount + 1,
          lastUsed: new Date(),
        });
      }
      return next;
    });
  };

  const hasTrialAccess = (featureId: string) => activeTrials.get(getTrialKey(featureId))?.isActive ?? false;
  const isTrialActive = hasTrialAccess;
  const getTrialStatus = (featureId: string) => activeTrials.get(getTrialKey(featureId)) ?? null;
  const getFeature = (featureId: string) => trialFeatureManager.getFeature(featureId) ?? null;
  const getFeaturesForComponent = (componentId: string) =>
    trialFeatureManager.getFeaturesForComponent(componentId);

  const contextValue = useMemo<TrialFeatureContextType>(
    () => ({
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
      setShowGlobalTrialDialog: (show) => {
        setShowGlobalTrialDialog(show);
        if (!show) {
          setCurrentTrialFeature(null);
        }
      },
      currentTrialFeature,
      setCurrentTrialFeature: (feature) => {
        setCurrentTrialFeature(feature);
        setShowGlobalTrialDialog(Boolean(feature));
      },
    }),
    [activeTrials, availableFeatures, currentTrialFeature, showGlobalTrialDialog],
  );

  return <TrialFeatureContext.Provider value={contextValue}>{children}</TrialFeatureContext.Provider>;
}

export function useTrialFeatureContext() {
  const context = useContext(TrialFeatureContext);
  if (!context) {
    throw new Error('useTrialFeatureContext must be used within a TrialFeatureProvider');
  }
  return context;
}

export function useTrialFeatureIntegration(featureId: string, componentId: string) {
  const context = useTrialFeatureContext();
  const [showLocalDialog, setShowLocalDialog] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [eligibilityLoaded, setEligibilityLoaded] = useState(false);

  const feature = context.getFeature(featureId);
  const trialStatus = context.getTrialStatus(featureId);
  const isActive = context.isTrialActive(featureId);

  useEffect(() => {
    let cancelled = false;

    const checkAccess = async () => {
      const result = await trialFeatureManager.checkTrialEligibility(featureId, 'current-user');
      if (!cancelled) {
        setHasAccess(result.reason === 'User already has access');
        setEligibilityLoaded(true);
      }
    };

    void checkAccess();

    return () => {
      cancelled = true;
    };
  }, [featureId]);

  const startTrial = async () => {
    setShowLocalDialog(false);
    return context.startTrial(featureId);
  };

  const trackUsage = (action: string) => {
    void context.trackUsage(featureId, action);
  };

  const openTrialDialog = () => {
    if (feature) {
      context.setCurrentTrialFeature(feature);
    }
    setShowLocalDialog(true);
  };

  const setShowTrialDialog = (show: boolean) => {
    setShowLocalDialog(show);
    if (!show) {
      context.setShowGlobalTrialDialog(false);
    } else if (feature) {
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
    showTrialDialog: showLocalDialog || (context.showGlobalTrialDialog && context.currentTrialFeature?.id === featureId),
    setShowTrialDialog,
    openTrialDialog,
    showLocalDialog,
    setShowLocalDialog,
    eligibilityLoaded,
    componentId,
  };
}
