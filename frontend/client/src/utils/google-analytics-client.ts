/**
 * Google Analytics 4 client helpers for email and campaign flows.
 */

import {
  getGA4ClientId as getSharedGA4ClientId,
  getGA4SessionId as getSharedGA4SessionId,
  trackEvent,
  trackPageView as trackSharedPageView,
} from './ga4-client-tracking';

const isAnalyticsAvailable = (): boolean => {
  return typeof window !== 'undefined' && typeof window.gtag === 'function';
};

export function trackEmailOpen(campaignId: string, recipientEmail: string): void {
  if (!isAnalyticsAvailable()) {
    return;
  }

  trackEvent('email_open', {
    campaign_id: campaignId,
    recipient_email: recipientEmail,
    event_category: 'email',
    event_label: 'invitation',
    non_interaction: true,
  });

  console.log(`GA4: Email open tracked - Campaign: ${campaignId}`);
}

export function trackEmailClick(campaignId: string, linkUrl: string, linkText: string): void {
  if (!isAnalyticsAvailable()) {
    return;
  }

  trackEvent('email_click', {
    campaign_id: campaignId,
    link_url: linkUrl,
    link_text: linkText,
    event_category: 'email',
    event_label: 'cta_click',
    outbound: true,
  });

  console.log(`GA4: Link click tracked - URL: ${linkUrl}`);
}

export function trackConversion(data: {
  campaignId?: string;
  conversionType: 'registration' | 'subscription' | 'purchase';
  value?: number;
  profession?: string;
  paymentMethod?: string;
}): void {
  if (!isAnalyticsAvailable()) {
    return;
  }

  trackEvent('conversion', {
    campaign_id: data.campaignId,
    conversion_type: data.conversionType,
    value: data.value ?? 0,
    currency: 'NOK',
    profession: data.profession,
    payment_method: data.paymentMethod,
  });

  if (data.conversionType === 'subscription' && data.value) {
    trackEvent('purchase', {
      transaction_id: `conv_${Date.now()}`,
      value: data.value,
      currency: 'NOK',
      payment_type: data.paymentMethod,
      items: [
        {
          item_id: data.profession ?? 'subscription',
          item_name: `${data.profession ?? 'CreatorHub'} subscription`,
          item_category: 'subscription',
          price: data.value,
          quantity: 1,
        },
      ],
    });
  }

  console.log(
    `GA4: Conversion tracked - Type: ${data.conversionType}, Value: ${data.value ?? 0} NOK`,
  );
}

export function trackPageView(path: string, title: string): void {
  if (!isAnalyticsAvailable()) {
    return;
  }

  trackSharedPageView(path, title);
}

export function trackCustomEvent(eventName: string, params: Record<string, unknown>): void {
  if (!isAnalyticsAvailable()) {
    return;
  }

  trackEvent(eventName, params);
}

export async function getGA4ClientId(): Promise<string | null> {
  return getSharedGA4ClientId();
}

export async function getGA4SessionId(): Promise<string | null> {
  return getSharedGA4SessionId();
}

export function initializeEmailTracking(): void {
  const urlParams = new URLSearchParams(window.location.search);
  const invitationToken = urlParams.get('invitation');
  const campaignId = urlParams.get('campaign');

  if (campaignId) {
    trackCustomEvent('email_landing', {
      campaign_id: campaignId,
      has_invitation: Boolean(invitationToken),
    });
  }
}

export function trackGTMEvent(event: string, data: Record<string, unknown>): void {
  if (typeof window === 'undefined' || !Array.isArray(window.dataLayer)) {
    return;
  }

  window.dataLayer.push({
    event,
    ...data,
  });

  console.log(`GTM: Event pushed - ${event}`, data);
}
