import {
  getGoogleAnalyticsMeasurementId,
} from "./googleAnalyticsRuntime";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    __creatorhubLoadAnalytics?: () => boolean;
  }
}

function hasAnalyticsConsent(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const rawConsent = window.localStorage.getItem("gdpr-consent");
    if (!rawConsent) return false;

    const parsedConsent = JSON.parse(rawConsent) as { analytics?: unknown };
    return parsedConsent?.analytics === true;
  } catch {
    return false;
  }
}

function hasInjectedGoogleTagScript(): boolean {
  if (typeof document === "undefined") return false;

  return Boolean(
    document.querySelector('script[src*="googletagmanager.com/gtag/js?id="]'),
  );
}

function ensureGoogleTagLoaded(): void {
  if (typeof window === "undefined") return;
  if (!hasAnalyticsConsent()) return;

  if (typeof window.__creatorhubLoadAnalytics === "function") {
    window.__creatorhubLoadAnalytics();
    return;
  }

  if (hasInjectedGoogleTagScript()) return;

  const measurementId = getGoogleAnalyticsMeasurementId();
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () {
    window.dataLayer?.push(arguments);
  };

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  script.dataset.creatorhubGaSrc = "true";
  script.onload = () => {
    window.gtag?.("js", new Date());
    window.gtag?.("config", measurementId, { send_page_view: false });
    window.gtag?.("event", "page_view", {
      page_path: window.location.pathname,
      page_title: document.title,
      page_location: window.location.href,
    });
  };

  document.head.appendChild(script);
}

export const initAnalytics = () => {
  ensureGoogleTagLoaded();
};

export const trackPageView = (url: string) => {
  if (typeof window === "undefined") return;

  ensureGoogleTagLoaded();
  if (!window.gtag) return;

  window.gtag("config", getGoogleAnalyticsMeasurementId(), {
    page_path: url,
    page_title: document.title,
    page_location: window.location.href,
  });
};

export const trackEvent = (
  action: string,
  category?: string,
  label?: string,
  value?: number,
) => {
  if (typeof window === "undefined") return;

  ensureGoogleTagLoaded();
  if (!window.gtag) return;

  window.gtag("event", action, {
    event_category: category,
    event_label: label,
    value,
  });
};

export const trackCreativeEvent = (
  userType: string,
  action: string,
  projectType?: string,
  value?: number,
) => {
  trackEvent(action, `norwegian_creative_${userType}`, projectType, value);
};

export const trackBusinessEvent = (
  businessType: "bryllup" | "bedrift" | "privat" | "kommersielt",
  action: string,
  value?: number,
) => {
  trackEvent(action, `norwegian_business_${businessType}`, undefined, value);
};

export const trackFeatureUsage = (
  feature: string,
  userType?: string,
  additionalData?: Record<string, unknown>,
) => {
  if (typeof window === "undefined") return;

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: "feature_usage",
    feature_name: feature,
    user_type: userType,
    ...additionalData,
  });
};
