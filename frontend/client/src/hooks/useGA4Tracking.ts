/**
 * useGA4Tracking Hook
 * Easy-to-use React hook for GA4 event tracking
 * 
 * Usage:
 *   const { trackEvent, trackConversion, trackFeature } = useGA4Tracking();
 *   trackEvent('button_click', { button_name: 'create_project' });
 */

import { useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  trackEvent,
  trackPageView,
  trackRegistration,
  trackLogin,
  trackOnboardingStep,
  trackOnboardingComplete,
  trackSubscriptionInitiated,
  trackSubscriptionPurchase,
  trackProjectCreated,
  trackProjectCompleted,
  trackDashboardTab,
  trackFeatureUsed,
  trackGoogleWorkspaceConnect,
  trackGoogleDriveUpload,
  trackEmailCTAClick,
  trackGalleryCreated,
  trackVideoEditingSession,
  trackButtonClick,
  trackModalOpen,
  trackFormSubmission,
  initializeGA4Tracking
} from '../utils/ga4-client-tracking';

export function useGA4Tracking() {
  const auth = useAuth();
  const userId = auth.user?.id;
  const userEmail = auth.user?.email;
  const profession = auth.user?.profession || 'unknown';

  // ============================================================================
  // USER LIFECYCLE
  // ============================================================================

  const trackUserRegistration = useCallback((source?: string, campaignId?: string) => {
    trackRegistration({
      profession,
      source,
      campaignId
    });
  }, [profession]);

  const trackUserLogin = useCallback((method: 'google' | 'email' | 'password') => {
    trackLogin(method);
  }, []);

  const trackOnboarding = useCallback((step: number, stepName: string) => {
    trackOnboardingStep({
      step,
      stepName,
      profession
    });
  }, [profession]);

  const trackOnboardingFinished = useCallback((timeSpentSeconds: number) => {
    trackOnboardingComplete({
      profession,
      timeSpentSeconds
    });
  }, [profession]);

  // ============================================================================
  // SUBSCRIPTION & E-COMMERCE
  // ============================================================================

  const trackSubscriptionStart = useCallback((data: {
    tier: 'basic' | 'pro' | 'enterprise';
    billingCycle: 'monthly' | 'annual';
    price: number;
  }) => {
    trackSubscriptionInitiated({
      profession,
      tier: data.tier,
      billingCycle: data.billingCycle,
      price: data.price
    });
  }, [profession]);

  const trackSubscriptionComplete = useCallback((data: {
    tier: string;
    price: number;
    paymentMethod: string;
    transactionId?: string;
  }) => {
    trackSubscriptionPurchase({
      profession,
      tier: data.tier,
      price: data.price,
      paymentMethod: data.paymentMethod,
      transactionId: data.transactionId
    });
  }, [profession]);

  // ============================================================================
  // PROJECT MANAGEMENT
  // ============================================================================

  const trackProject = useCallback((action: 'created' | 'completed', data: {
    projectType: string;
    source?: 'wizard' | 'manual' | 'template';
    durationDays?: number;
    revenue?: number;
  }) => {
    if (action === 'created') {
      trackProjectCreated({
        profession,
        projectType: data.projectType,
        source: data.source || 'manual'
      });
    } else {
      trackProjectCompleted({
        profession,
        projectType: data.projectType,
        durationDays: data.durationDays || 0,
        revenue: data.revenue
      });
    }
  }, [profession]);

  // ============================================================================
  // FEATURE USAGE
  // ============================================================================

  const trackDashboard = useCallback((tabId: string, tabLabel: string) => {
    trackDashboardTab({
      profession,
      tabId,
      tabLabel
    });
  }, [profession]);

  const trackFeature = useCallback((featureId: string, featureName: string, tier: string) => {
    trackFeatureUsed({
      profession,
      featureId,
      featureName,
      tier
    });
  }, [profession]);

  // ============================================================================
  // GOOGLE WORKSPACE
  // ============================================================================

  const trackWorkspaceConnect = useCallback((service: 'drive' | 'calendar' | 'gmail' |'meet') => {
    trackGoogleWorkspaceConnect({
      profession,
      service
    });
  }, [profession]);

  const trackDriveUpload = useCallback((fileCount: number, totalSizeMB: number) => {
    trackGoogleDriveUpload({
      profession,
      fileCount,
      totalSizeMB
    });
  }, [profession]);

  // ============================================================================
  // ENGAGEMENT
  // ============================================================================

  const trackButton = useCallback((buttonName: string, location: string) => {
    trackButtonClick({
      buttonName,
      location,
      profession
    });
  }, [profession]);

  const trackModal = useCallback((modalName: string, trigger: string) => {
    trackModalOpen({
      modalName,
      trigger,
      profession
    });
  }, [profession]);

  const trackForm = useCallback((formName: string, formType: string, success: boolean) => {
    trackFormSubmission({
      formName,
      formType,
      profession,
      success
    });
  }, [profession]);

  // ============================================================================
  // PROFESSION-SPECIFIC
  // ============================================================================

  const trackPhotographerGallery = useCallback((imageCount: number, hasClientAccess: boolean, projectType: string) => {
    trackGalleryCreated({
      imageCount,
      hasClientAccess,
      projectType
    });
  }, []);

  const trackVideoEditing = useCallback((durationMinutes: number, clipsUsed: number, effectsApplied: number) => {
    trackVideoEditingSession({
      durationMinutes,
      clipsUsed,
      effectsApplied
    });
  }, []);

  // ============================================================================
  // GENERIC EVENT TRACKING
  // ============================================================================

  const trackCustomEvent = useCallback((eventName: string, params?: Record<string, any>) => {
    trackEvent(eventName, {
      ...params,
      profession,
      user_id: userId,
      user_email: userEmail
    });
  }, [profession, userId, userEmail]);

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  const initializeTracking = useCallback(() => {
    if (userId && profession) {
      initializeGA4Tracking(userId, profession);
    }
  }, [userId, profession]);

  return useMemo(() => ({
    // User lifecycle
    trackUserRegistration,
    trackUserLogin,
    trackOnboarding,
    trackOnboardingFinished,
    
    // Subscription
    trackSubscriptionStart,
    trackSubscriptionComplete,
    
    // Projects
    trackProject,
    
    // Features
    trackDashboard,
    trackFeature,
    
    // Google Workspace
    trackWorkspaceConnect,
    trackDriveUpload,
    
    // Engagement
    trackButton,
    trackModal,
    trackForm,
    
    // Profession-specific
    trackPhotographerGallery,
    trackVideoEditing,
    
    // Generic
    trackCustomEvent,
    trackPageView,
    
    // Initialization
    initializeTracking,
    
    // Context data
    userId,
    userEmail,
    profession
  }), [
    trackUserRegistration,
    trackUserLogin,
    trackOnboarding,
    trackOnboardingFinished,
    trackSubscriptionStart,
    trackSubscriptionComplete,
    trackProject,
    trackDashboard,
    trackFeature,
    trackWorkspaceConnect,
    trackDriveUpload,
    trackButton,
    trackModal,
    trackForm,
    trackPhotographerGallery,
    trackVideoEditing,
    trackCustomEvent,
    initializeTracking,
    userId,
    userEmail,
    profession
  ]);
}
