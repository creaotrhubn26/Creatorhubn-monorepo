/**
 * Google Analytics 4 Service
 * Runtime integration with the active GA4 web stream
 */

import {
  getAnalyticsPlatformName,
  getGoogleAnalyticsMeasurementId,
} from '../lib/googleAnalyticsRuntime';
import { apiRequest, getAuthHeader } from '../lib/queryClient';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export class GoogleAnalyticsService {
  private static instance: GoogleAnalyticsService;
  private isInitialized = false;

  private constructor() {
    this.initializeGA4();
  }

  public static getInstance(): GoogleAnalyticsService {
    if (!GoogleAnalyticsService.instance) {
      GoogleAnalyticsService.instance = new GoogleAnalyticsService();
    }
    return GoogleAnalyticsService.instance;
  }

  /**
   * Initialize Google Analytics 4
   */
  private initializeGA4(): void {
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      this.isInitialized = true;
      console.log(
        '✅ Google Analytics 4 initialized with property: ',
        this.getPropertyId(),
      );
    } else {
      // In local dev, GA script is often intentionally absent.
      if (import.meta.env.PROD) {
        console.warn('⚠️ Google Analytics 4 not available');
      }
    }
  }

  /**
   * Track page views
   */
  public trackPageView(pagePath: string, pageTitle?: string): void {
    if (!this.isInitialized || typeof window === 'undefined' || !window.gtag) return;

    window.gtag('config', this.getPropertyId(), {
      page_path: pagePath,
      page_title: pageTitle || document.title,
    });

    console.log('📊 GA4 Page View:', { pagePath, pageTitle });
  }

  /**
   * Track custom events
   */
  public trackEvent(eventName: string, parameters?: Record<string, unknown>): void {
    if (!this.isInitialized || typeof window === 'undefined' || !window.gtag) return;

    window.gtag('event', eventName, {
      event_category: 'SEO Specialist Management',
      event_label:
        typeof parameters?.label === 'string' ? parameters.label : eventName,
      platform: getAnalyticsPlatformName(),
      ...parameters,
    });

    console.log('📊 GA4 Event:', { eventName, parameters });
  }

  /**
   * Track SEO specialist actions
   */
  public trackSEOSpecialistAction(
    action: string,
    specialistId?: string,
    details?: Record<string, unknown>,
  ): void {
    this.trackEvent('seo_specialist_action', {
      action,
      specialist_id: specialistId,
      ...details,
    });
  }

  /**
   * Track analytics data requests
   */
  public trackAnalyticsRequest(requestType: string, projectId?: string, success?: boolean): void {
    this.trackEvent('analytics_request', {
      request_type: requestType,
      project_id: projectId,
      success: success || false,
    });
  }

  /**
   * Track Google Analytics integration events
   */
  public trackGAIntegration(action: string, projectId?: string, status?: string): void {
    this.trackEvent('ga_integration', {
      action,
      project_id: projectId,
      status: status || 'unknown',
    });
  }

  /**
   * Track real-time analytics views
   */
  public trackRealTimeAnalytics(projectId: string, metricsCount: number): void {
    this.trackEvent('realtime_analytics_view', {
      project_id: projectId,
      metrics_count: metricsCount,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Track campaign management actions
   */
  public trackCampaignAction(action: string, campaignId?: string, campaignType?: string): void {
    this.trackEvent('campaign_action', {
      action,
      campaign_id: campaignId,
      campaign_type: campaignType,
    });
  }

  /**
   * Track Norwegian market specific events
   */
  public trackNorwegianMarketEvent(eventType: string, details?: Record<string, unknown>): void {
    this.trackEvent('norwegian_market_event', {
      event_type: eventType,
      market: 'norway',
      ...details,
    });
  }

  /**
   * Get real-time data from GA4
   */
  public async getRealTimeData(): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Google Analytics not initialized');
    }

    try {
      const headers = await getAuthHeader();
      const overview = await apiRequest('/api/analytics/overview?startDate=30daysAgo', {
        headers,
      }) as {
        generatedAt?: string;
        summary?: {
          activeCreators?: { current?: number };
          totalEvents?: { current?: number };
          pageViews?: { current?: number };
          bookings?: { current?: number };
        };
      };

      const activeUsers = Number(overview.summary?.activeCreators?.current ?? 0);
      const eventCount = Number(overview.summary?.totalEvents?.current ?? 0);
      const pageViews = Number(overview.summary?.pageViews?.current ?? 0);
      const conversions = Number(overview.summary?.bookings?.current ?? 0);

      return {
        activeUsers,
        sessions: eventCount,
        pageViews,
        eventCount,
        screenPageViews: pageViews,
        conversions,
        topCountries: [],
        deviceBreakdown: [],
        timestamp: overview.generatedAt ?? new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error fetching real-time data:', error);
      throw error;
    }
  }

  /**
   * Check if GA4 is available
   */
  public isGA4Available(): boolean {
    return this.isInitialized && typeof window !=='undefined' && !!window.gtag;
}

  /**
   * Get GA4 property ID
   */
  public getPropertyId(): string {
    return getGoogleAnalyticsMeasurementId();
  }
}

// Export singleton instance
export const googleAnalyticsService = GoogleAnalyticsService.getInstance();
