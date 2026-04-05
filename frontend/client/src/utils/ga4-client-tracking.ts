/**
 * GA4 Client-Side Tracking - Frontend Event Tracking
 * Comprehensive tracking for all user interactions
 * 
 * Usage:
 *   import { trackEvent, trackPageView, trackConversion } from '@/utils/ga4-client-tracking';
 *   trackEvent('button_click', { button_name: 'create_project' });
 */

import {
  getAnalyticsPlatformName,
  getGoogleAnalyticsMeasurementId,
} from '../lib/googleAnalyticsRuntime';

/**
 * Check if GA4 is available
 */
function isGA4Available(): boolean {
  return typeof window !== 'undefined' && !!window.gtag;
}

function getGA4MeasurementId(): string {
  return getGoogleAnalyticsMeasurementId();
}

// ============================================================================
// CORE TRACKING FUNCTIONS
// ============================================================================

/**
 * Track custom event
 */
export function trackEvent(eventName: string, params?: Record<string, unknown>) {
  if (!isGA4Available()) return;

  const gtag = window.gtag;
  if (!gtag) return;

  gtag('event', eventName, {
    ...params,
    platform: getAnalyticsPlatformName(),
  });
  
  console.log(`📊 GA4 Client: ${eventName}`, params);
}

/**
 * Track page view
 */
export function trackPageView(path: string, title?: string) {
  if (!isGA4Available()) return;

  const gtag = window.gtag;
  if (!gtag) return;

  gtag('event', 'page_view', {
    page_path: path,
    page_title: title || document.title,
    page_location: window.location.href
  });
}

/**
 * Get GA4 Client ID (for cross-tracking)
 */
export async function getGA4ClientId(): Promise<string | null> {
  if (!isGA4Available()) return null;
  
  return new Promise((resolve) => {
    const gtag = window.gtag;
    if (!gtag) {
      resolve(null);
      return;
    }
    gtag('get', getGA4MeasurementId(), 'client_id', (clientId: string) => {
      resolve(clientId);
    });
  });
}

/**
 * Get GA4 Session ID (for cross-tracking)
 */
export async function getGA4SessionId(): Promise<string | null> {
  if (!isGA4Available()) return null;
  
  return new Promise((resolve) => {
    const gtag = window.gtag;
    if (!gtag) {
      resolve(null);
      return;
    }
    gtag('get', getGA4MeasurementId(), 'session_id', (sessionId: string) => {
      resolve(sessionId);
    });
  });
}

// ============================================================================
// USER LIFECYCLE TRACKING
// ============================================================================

/**
 * Track user registration
 */
export function trackRegistration(data: {
  profession: string;
  source?: string;
  campaignId?: string;
}) {
  trackEvent('sign_up', {
    method: data.source || 'organic',
    profession: data.profession,
    campaign_id: data.campaignId
  });
}

/**
 * Track user login
 */
export function trackLogin(method: 'google' | 'email' | 'password') {
  trackEvent('login', { method });
}

/**
 * Track onboarding step completion
 */
export function trackOnboardingStep(data: {
  step: number;
  stepName: string;
  profession: string;
}) {
  trackEvent('onboarding_step', {
    step_number: data.step,
    step_name: data.stepName,
    profession: data.profession
  });
}

/**
 * Track onboarding completion
 */
export function trackOnboardingComplete(data: {
  profession: string;
  timeSpentSeconds: number;
}) {
  trackEvent('onboarding_complete', {
    profession: data.profession,
    time_spent: data.timeSpentSeconds,
    engagement_time_msec: data.timeSpentSeconds * 1000
  });
}

// ============================================================================
// SUBSCRIPTION & E-COMMERCE TRACKING
// ============================================================================

/**
 * Track subscription initiated
 */
export function trackSubscriptionInitiated(data: {
  profession: string;
  tier: 'basic' | 'pro' | 'enterprise';
  billingCycle: 'monthly' | 'annual';
  price: number;
}) {
  trackEvent('begin_checkout', {
    currency: 'NOK',
    value: data.price,
    items: [
      {
        item_id: `${data.profession}_${data.tier}`,
        item_name: `${data.profession} - ${data.tier}`,
        item_category: 'subscription',
        item_category2: data.billingCycle,
        price: data.price,
        quantity: 1
      }
    ]
  });
}

/**
 * Track subscription purchase (CONVERSION)
 */
export function trackSubscriptionPurchase(data: {
  profession: string;
  tier: string;
  price: number;
  paymentMethod: string;
  transactionId?: string;
}) {
  trackEvent('purchase', {
    transaction_id: data.transactionId || `sub_${Date.now()}`,
    value: data.price,
    currency: 'NOK',
    payment_type: data.paymentMethod,
    items: [
      {
        item_id: `${data.profession}_${data.tier}`,
        item_name: `${data.profession} - ${data.tier}`,
        item_category: 'subscription',
        item_brand: 'CreatorHub Norge',
        price: data.price,
        quantity: 1
      }
    ]
  });
}

/**
 * Track payment method selected
 */
export function trackPaymentMethodSelected(data: {
  profession: string;
  paymentMethod: 'vipps' | 'google_pay' | 'stripe' | 'paypal' | 'klarna';
  tier: string;
}) {
  trackEvent('add_payment_info', {
    profession: data.profession,
    payment_type: data.paymentMethod,
    subscription_tier: data.tier
  });
}

// ============================================================================
// PROJECT TRACKING
// ============================================================================

/**
 * Track project created
 */
export function trackProjectCreated(data: {
  profession: string;
  projectType: string;
  source: 'wizard' | 'manual' | 'template';
}) {
  trackEvent('project_created', {
    profession: data.profession,
    project_type: data.projectType,
    creation_source: data.source
  });
}

/**
 * Track project completed
 */
export function trackProjectCompleted(data: {
  profession: string;
  projectType: string;
  durationDays: number;
  revenue?: number;
}) {
  trackEvent('project_completed', {
    profession: data.profession,
    project_type: data.projectType,
    duration_days: data.durationDays,
    revenue: data.revenue || 0,
    currency: 'NOK'
  });
}

// ============================================================================
// FEATURE USAGE TRACKING
// ============================================================================

/**
 * Track dashboard tab click
 */
export function trackDashboardTab(data: {
  profession: string;
  tabId: string;
  tabLabel: string;
}) {
  trackEvent('dashboard_tab_click', {
    profession: data.profession,
    tab_id: data.tabId,
    tab_label: data.tabLabel
  });
}

/**
 * Track feature used
 */
export function trackFeatureUsed(data: {
  profession: string;
  featureId: string;
  featureName: string;
  tier: string;
}) {
  trackEvent('feature_used', {
    profession: data.profession,
    feature_id: data.featureId,
    feature_name: data.featureName,
    subscription_tier: data.tier
  });
}

/**
 * Track search query
 */
export function trackSearch(data: {
  searchTerm: string;
  resultCount: number;
  profession: string;
}) {
  trackEvent('search', {
    search_term: data.searchTerm,
    result_count: data.resultCount,
    profession: data.profession
  });
}

// ============================================================================
// GOOGLE WORKSPACE INTEGRATION TRACKING
// ============================================================================

/**
 * Track Google Workspace connection
 */
export function trackGoogleWorkspaceConnect(data: {
  profession: string;
  service: 'drive' | 'calendar' | 'gmail' | 'meet';
}) {
  trackEvent('google_workspace_connected', {
    profession: data.profession,
    service: data.service,
    integration_type: 'google_workspace'
  });
}

/**
 * Track Google Drive upload
 */
export function trackGoogleDriveUpload(data: {
  profession: string;
  fileCount: number;
  totalSizeMB: number;
}) {
  trackEvent('drive_upload', {
    profession: data.profession,
    file_count: data.fileCount,
    total_size_mb: data.totalSizeMB
  });
}

// ============================================================================
// ENGAGEMENT TRACKING
// ============================================================================

/**
 * Track button click
 */
export function trackButtonClick(data: {
  buttonName: string;
  location: string;
  profession?: string;
}) {
  trackEvent('button_click', {
    button_name: data.buttonName,
    button_location: data.location,
    profession: data.profession
  });
}

/**
 * Track modal open
 */
export function trackModalOpen(data: {
  modalName: string;
  trigger: string;
  profession?: string;
}) {
  trackEvent('modal_open', {
    modal_name: data.modalName,
    trigger: data.trigger,
    profession: data.profession
  });
}

/**
 * Track form submission
 */
export function trackFormSubmission(data: {
  formName: string;
  formType: string;
  profession?: string;
  success: boolean;
}) {
  trackEvent('form_submit', {
    form_name: data.formName,
    form_type: data.formType,
    profession: data.profession,
    success: data.success
  });
}

// ============================================================================
// EMAIL CAMPAIGN TRACKING (Client-Side)
// ============================================================================

/**
 * Track email opened (client-side confirmation)
 */
export function trackEmailOpenClient(campaignId: string) {
  trackEvent('email_open', {
    campaign_id: campaignId,
    event_category: 'email_marketing',
    non_interaction: true
  });
}

/**
 * Track email CTA click
 */
export function trackEmailCTAClick(data: {
  campaignId: string;
  ctaText: string;
  ctaUrl: string;
}) {
  trackEvent('email_click', {
    campaign_id: data.campaignId,
    cta_text: data.ctaText,
    cta_url: data.ctaUrl,
    event_category: 'email_marketing'
  });
}

// ============================================================================
// PROFESSION-SPECIFIC TRACKING
// ============================================================================

/**
 * Track photographer gallery created
 */
export function trackGalleryCreated(data: {
  imageCount: number;
  hasClientAccess: boolean;
  projectType: string;
}) {
  trackEvent('gallery_created', {
    profession: 'photographer',
    image_count: data.imageCount,
    has_client_access: data.hasClientAccess,
    project_type: data.projectType
  });
}

/**
 * Track video editing session
 */
export function trackVideoEditingSession(data: {
  durationMinutes: number;
  clipsUsed: number;
  effectsApplied: number;
}) {
  trackEvent('video_editing_session', {
    profession: 'videographer',
    duration_minutes: data.durationMinutes,
    clips_used: data.clipsUsed,
    effects_applied: data.effectsApplied,
    engagement_time_msec: data.durationMinutes * 60 * 1000
  });
}

// ============================================================================
// CONVERSION GOAL TRACKING
// ============================================================================

/**
 * Track conversion goal achieved
 */
export function trackConversionGoal(data: {
  goalName: string;
  goalValue?: number;
  profession: string;
  campaignId?: string;
}) {
  trackEvent('conversion', {
    goal_name: data.goalName,
    value: data.goalValue || 0,
    currency: 'NOK',
    profession: data.profession,
    campaign_id: data.campaignId
  });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize GA4 tracking on page load
 */
export function initializeGA4Tracking(userId?: string, profession?: string) {
  if (!isGA4Available()) {
    console.warn('⚠️  GA4 not available - tracking disabled');
    return;
  }

  // Set user properties
  if (userId && profession) {
    const gtag = window.gtag;
    if (gtag) {
      gtag('set', 'user_properties', {
      profession,
      user_id: userId
      });
    }
  }

  // Track initial page view
  trackPageView(window.location.pathname, document.title);

  // Check for campaign parameters
  const urlParams = new URLSearchParams(window.location.search);
  const campaignId = urlParams.get('campaign');
  const invitationToken = urlParams.get('invitation');
  
  if (campaignId) {
    trackEvent('email_landing', {
      campaign_id: campaignId,
      has_invitation: !!invitationToken,
      landing_page: window.location.pathname
    });
  }

  console.log('✅ GA4 Client Tracking Initialized', {
    measurementId: getGA4MeasurementId(),
    userId,
    profession,
  });
}

/**
 * Auto-track navigation (for SPA)
 */
export function setupAutoTracking() {
  if (!isGA4Available()) return;

  // Track navigation in SPA
  let lastPath = window.location.pathname;
  
  setInterval(() => {
    const currentPath = window.location.pathname;
    if (currentPath !== lastPath) {
      trackPageView(currentPath);
      lastPath = currentPath;
    }
  }, 1000);
}
