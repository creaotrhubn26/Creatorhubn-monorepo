/**
 * Google Analytics 4 Client-Side Tracking
 * Frontend tracking helper for email events
 * Integrates with Google Tag Manager and GA4
 */

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

/**
 * Track email open (client-side)
 */
export function trackEmailOpen(campaignId: string, recipientEmail: string) {
  if (typeof window !== 'undefined, ' && window.gtag) {
    window.gtag('event, ', 'email_open', {
      campaign_id: campaignId,
      recipient_email: recipientEmail,
      event_category: 'email',
      event_label: 'invitation',
      non_interaction: true
    });
    
    console.log(`📊 GA4: Email open tracked - Campaign: ${campaignId}`);
  }
}

/**
 * Track email link click (client-side)
 */
export function trackEmailClick(campaignId: string, linkUrl: string, linkText: string) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event','email_click', {
      campaign_id: campaignId,
      link_url: linkUrl,
      link_text: linkText,
      event_category: 'email',
      event_label: 'cta_click',
      outbound: true
    });
    
    console.log(`📊 GA4: Link click tracked - URL: ${linkUrl}`);
  }
}

/**
 * Track conversion (registration/subscription)
 */
export function trackConversion(data: {
  campaignId?: string;
  conversionType: 'registration' | 'subscription' | 'purchase';
  value?: number;
  profession?: string;
  paymentMethod?: string;
}) {
  if (typeof window !== 'undefined' && window.gtag) {
    // Track conversion event
    window.gtag('event','conversion', {
      campaign_id: data.campaignId,
      conversion_type: data.conversionType,
      value: data.value || 0,
      currency: 'NOK',
      profession: data.profession,
      payment_method: data.paymentMethod
    });
    
    // Track as purchase for e-commerce
    if (data.conversionType === 'subscription' && data.value) {
      window.gtag('event','purchase', {
        transaction_id: `conv_${Date.now()}`,
        value: data.value,
        currency: 'NOK',
        payment_type: data.paymentMethod,
        items: [
          {
            item_id: data.profession,
            item_name: `${data.profession} subscription`,
            item_category: 'subscription',
            price: data.value,
            quantity: 1
          }
        ]
      });
    }
    
    console.log(`📊 GA4: Conversion tracked - Type: ${data.conversionType}, Value: ${data.value} NOK`);
  }
}

/**
 * Track page view
 */
export function trackPageView(path: string, title: string) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event, ', 'page_view', {
      page_path: path,
      page_title: title
    });
  }
}

/**
 * Track custom event
 */
export function trackCustomEvent(eventName: string, params: Record<string, any>) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, params);
    console.log(`📊 GA4: Custom event tracked - ${eventName}`, params);
  }
}

/**
 * Get GA4 client ID (for cross-tracking)
 */
export async function getGA4ClientId(): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.gtag) {
      // Use the GA4 Measurement ID from environment (injected via import.meta.env)
      const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID || 'G-XXXXXXXXXX';
      window.gtag('get', measurementId, 'client_id', (clientId: string) => {
        resolve(clientId);
      });
    } else {
      resolve(null);
    }
  });
}

/**
 * Get GA4 session ID (for cross-tracking)
 */
export async function getGA4SessionId(): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.gtag) {
      const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID || 'G-XXXXXXXXXX';
      window.gtag('get', measurementId, 'session_id', (sessionId: string) => {
        resolve(sessionId);
      });
    } else {
      resolve(null);
    }
  });
}

/**
 * Initialize Google Analytics tracking for email campaigns
 */
export function initializeEmailTracking() {
  // Check for invitation token in URL
  const urlParams = new URLSearchParams(window.location.search);
  const invitationToken = urlParams.get('invitation');
  const campaignId = urlParams.get('campaign');
  
  if (campaignId) {
    // Track page view with campaign context
    trackCustomEvent('email_landing', {
      campaign_id: campaignId,
      has_invitation: !!invitationToken
    });
  }
}

/**
 * Enhanced tracking with Google Tag Manager
 */
export function trackGTMEvent(event: string, data: Record<string, any>) {
  if (typeof window !=='undefined' && window.dataLayer) {
    window.dataLayer.push({
      event,
      ...data
    });
    console.log(`📊 GTM: Event pushed - ${event}`, data);
  }
}

