// client/src/hooks/useTrialFeature.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  TrialFeatureManager, 
  type TrialFeature, 
  type TrialStatus, 
  type TrialEligibility 
} from '../services/TrialFeatureManager';
import { trialToPaymentBridge } from '../services/TrialToPaymentBridge';
import { useEnhancedMasterIntegration } from '../integration/EnhancedMasterIntegrationProvider';

const trialFeatureManager = TrialFeatureManager.getInstance();

interface UseTrialFeatureOptions {
  featureId: string;
  componentId: string;
  userId?: string;
  autoCheck?: boolean;
  showPrompt?: boolean;
  onTrialStart?: () => void;
  onUpgradeRequired?: () => void;
  onFeatureUsed?: (action: string) => void;
}

interface UseTrialFeatureReturn {
  // Trial state
  trialStatus: TrialStatus | null;
  eligibility: TrialEligibility | null;
  feature: TrialFeature | null;
  loading: boolean;
  
  // Trial actions
  startTrial: () => Promise<void>;
  endTrial: () => Promise<void>;
  trackUsage: (action: string) => void;
  
  // Status checks
  hasAccess: boolean;
  isTrialActive: boolean;
  isTrialExpired: boolean;
  canUpgrade: boolean;
  isEligible: boolean;
  
  // UI helpers
  showTrialPrompt: boolean;
  showUpgradePrompt: boolean;
  showFeature: boolean;
  
  // Trial dialog control
  showTrialDialog: boolean;
  setShowTrialDialog: (show: boolean) => void;
  
  // Upgrade dialog control
  showUpgradeDialog: boolean;
  setShowUpgradeDialog: (show: boolean) => void;
  handleUpgradeSuccess: () => void;
}

export function useTrialFeature({
  featureId,
  componentId,
  userId = 'current-user',
  autoCheck = true,
  showPrompt = true,
  onTrialStart,
  onUpgradeRequired,
  onFeatureUsed
}: UseTrialFeatureOptions): UseTrialFeatureReturn {
  // ⭐ Enhanced Master Integration
  const { analytics, performance, debugging, dataFlow } = useEnhancedMasterIntegration();
  
  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null);
  const [eligibility, setEligibility] = useState<TrialEligibility | null>(null);
  const [feature, setFeature] = useState<TrialFeature | null>(null);
  const [loading, setLoading] = useState(false);
  const [showTrialDialog, setShowTrialDialog] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);

  // Get feature definition
  useEffect(() => {
    const featureDef = trialFeatureManager.getFeature(featureId);
    setFeature(featureDef || null);
  }, [featureId]);

  // Check trial eligibility
  const checkEligibility = useCallback(async () => {
    if (!feature) return;
    
    const endTiming = performance.startTiming('check_trial_eligibility');
    
    try {
      setLoading(true);
      const result = await trialFeatureManager.checkTrialEligibility(featureId, userId);
      setEligibility(result);
      
      if (result.trialStatus) {
        setTrialStatus(result.trialStatus);
      }

      // Track eligibility check
      analytics.trackEvent('trial_eligibility_checked', {
        featureId,
        userId,
        componentId,
        eligible: result.eligible,
        canUpgrade: result.canUpgrade
      });

      // Sync with data flow
      dataFlow.syncData(`useTrialFeature:${featureId}:eligibility`, result);

      // Auto-show trial dialog if eligible and prompt is enabled
      if (result.eligible && showPrompt) {
        setShowTrialDialog(true);
        analytics.trackEvent('trial_dialog_shown', { featureId, userId });
      } else if (result.canUpgrade && showPrompt) {
        setShowTrialDialog(true);
        analytics.trackEvent('upgrade_dialog_shown', { featureId, userId });
      }
    } catch (error) {
      debugging.logIntegration('error', 'Trial eligibility check failed', { error, featureId, userId });
      analytics.trackEvent('trial_eligibility_check_failed', { error: (error as Error).message, featureId });
    } finally {
      setLoading(false);
      endTiming();
    }
  }, [featureId, userId, feature, showPrompt, componentId, analytics, performance, debugging, dataFlow]);

  // Auto-check eligibility on mount
  useEffect(() => {
    if (autoCheck && feature) {
      checkEligibility();
    }
  }, [autoCheck, feature, checkEligibility]);

  // Check trial expiration and show upgrade prompt
  useEffect(() => {
    const checkExpiration = async () => {
      if (featureId && userId) {
        const result = await trialToPaymentBridge.checkTrialExpirationAndPrompt(featureId, userId);
        
        if (result.isExpired && result.shouldShowUpgrade && showPrompt) {
          setShowUpgradeDialog(true);
        }
      }
    };

    if (trialStatus?.isActive) {
      // Check every minute if trial is still active
      const interval = setInterval(checkExpiration, 60000);
      checkExpiration(); // Check immediately
      
      return () => clearInterval(interval);
    }
  }, [featureId, userId, trialStatus, showPrompt]);

  // Start trial
  const startTrial = useCallback(async () => {
    const endTiming = performance.startTiming('start_trial');
    
    try {
      setLoading(true);
      const status = await trialFeatureManager.startTrial(featureId, userId);
      setTrialStatus(status);
      setShowTrialDialog(false);
      
      // Track trial start
      analytics.trackEvent('trial_started', {
        featureId,
        userId,
        componentId,
        startDate: status.startDate,
        endDate: status.endDate
      });
      
      debugging.logIntegration('info','Trial started successfully', {
        featureId,
        userId,
        daysRemaining: status.daysRemaining,
        status: status.isActive ? 'active' : 'inactive'
      });
      
      onTrialStart?.();
    } catch (error) {
      debugging.logIntegration('error', 'Failed to start trial', { error, featureId, userId });
      analytics.trackEvent('trial_start_failed', { error: (error as Error).message, featureId });
      throw error;
    } finally {
      setLoading(false);
      endTiming();
    }
  }, [featureId, userId, componentId, onTrialStart, analytics, performance, debugging]);

  // End trial
  const endTrial = useCallback(async () => {
    try {
      setLoading(true);
      // This would call the API to end the trial
      setTrialStatus(null);
      setEligibility(null);
    } catch (error) {
      console.error('Failed to end trial: ', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  // Computed properties (moved before trackUsage to avoid hoisting issues)
  const hasAccess = eligibility?.eligible === false && eligibility.reason === 'User already has access';
  const isTrialActive = trialStatus?.isActive || false;
  const isTrialExpired = trialStatus?.hasExpired || false;
  const canUpgrade = eligibility?.canUpgrade || trialStatus?.canUpgrade || false;
  const isEligible = eligibility?.eligible || false;
  
  const showTrialPrompt = isEligible && showPrompt && !showTrialDialog;
  const showUpgradePrompt = (isTrialExpired || canUpgrade) && showPrompt;
  const showFeature = hasAccess || isTrialActive;

  // Track feature usage
  const trackUsage = useCallback((action: string) => {
    // Track usage analytics
    analytics.trackEvent('trial_feature_used', {
      featureId,
      userId,
      componentId,
      action,
      isTrialActive: trialStatus?.isActive || false
    });
    
    debugging.logIntegration('info', 'Trial feature used', { featureId, action });
    
    onFeatureUsed?.(action);
  }, [featureId, userId, componentId, trialStatus, onFeatureUsed, analytics, debugging]);

  // Handle upgrade success
  const handleUpgradeSuccess = useCallback(async () => {
    // Refresh trial status
    await checkEligibility();
    setShowUpgradeDialog(false);
    onUpgradeRequired?.();
  }, [checkEligibility, onUpgradeRequired]);

  return {
    // Trial state
    trialStatus,
    eligibility,
    feature,
    loading,
    
    // Trial actions
    startTrial,
    endTrial,
    trackUsage,
    
    // Status checks
    hasAccess,
    isTrialActive,
    isTrialExpired,
    canUpgrade,
    isEligible,
    
    // UI helpers
    showTrialPrompt,
    showUpgradePrompt,
    showFeature,
    
    // Trial dialog control
    showTrialDialog,
    setShowTrialDialog,
    
    // Upgrade dialog control
    showUpgradeDialog,
    setShowUpgradeDialog,
    handleUpgradeSuccess,
  };
}

// Hook for multiple trial features
export function useMultipleTrialFeatures(featureIds: string[], componentId: string, userId?: string) {
  const [features, setFeatures] = useState<Record<string, UseTrialFeatureReturn>>({});

  useEffect(() => {
    let cancelled = false;

    const loadFeatures = async () => {
      const next: Record<string, UseTrialFeatureReturn> = {};

      for (const featureId of featureIds) {
        const feature = trialFeatureManager.getFeature(featureId) ?? null;
        const eligibility = feature
          ? await trialFeatureManager.checkTrialEligibility(featureId, userId ?? 'current-user')
          : null;
        const trialStatus = eligibility?.trialStatus ?? null;

        next[featureId] = {
          trialStatus,
          eligibility,
          feature,
          loading: false,
          startTrial: async () => {
            await trialFeatureManager.startTrial(featureId, userId ?? 'current-user');
          },
          endTrial: async () => {},
          trackUsage: (action: string) => {
            void trialFeatureManager.trackTrialUsage(featureId, userId ?? 'current-user', action);
          },
          hasAccess: eligibility?.reason === 'User already has access',
          isTrialActive: trialStatus?.isActive ?? false,
          isTrialExpired: trialStatus?.hasExpired ?? false,
          canUpgrade: eligibility?.canUpgrade ?? trialStatus?.canUpgrade ?? false,
          isEligible: eligibility?.eligible ?? false,
          showTrialPrompt: Boolean(eligibility?.eligible),
          showUpgradePrompt: Boolean(eligibility?.canUpgrade ?? trialStatus?.canUpgrade),
          showFeature: Boolean(
            eligibility?.reason === 'User already has access' || trialStatus?.isActive,
          ),
          showTrialDialog: false,
          setShowTrialDialog: () => {},
          showUpgradeDialog: false,
          setShowUpgradeDialog: () => {},
          handleUpgradeSuccess: () => {},
        };
      }

      if (!cancelled) {
        setFeatures(next);
      }
    };

    void loadFeatures();

    return () => {
      cancelled = true;
    };
  }, [componentId, featureIds, userId]);

  return useMemo(() => features, [features]);
}

// Hook for trial analytics
export function useTrialAnalytics(featureId?: string) {
  const [analytics, setAnalytics] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const summary = {
        featureId: featureId ?? 'all-features',
        refreshedAt: new Date().toISOString(),
        activeTrials: trialFeatureManager.getAllFeatures().length,
      };
      setAnalytics(summary);
    } catch (error) {
      console.error('Error fetching trial analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [featureId]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return { analytics, loading, refetch: fetchAnalytics };
}
