declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    __creatorhubLoadAnalytics?: () => boolean;
    __creatorhubAnalyticsConfig?: {
      measurementId?: string;
      site?: "creatorhub" | "role-room";
    };
  }
}

const CREATORHUB_GA_MEASUREMENT_ID = "G-6E5MJT8REW";
const ROLE_ROOM_GA_MEASUREMENT_ID = "G-9T7K5TJVFX";
const ROLE_ROOM_HOSTS = new Set(["theroleroom.com", "www.theroleroom.com"]);

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

function resolveMeasurementId(): string {
  if (
    typeof window !== "undefined" &&
    typeof window.__creatorhubAnalyticsConfig?.measurementId === "string" &&
    window.__creatorhubAnalyticsConfig.measurementId.trim()
  ) {
    return window.__creatorhubAnalyticsConfig.measurementId.trim();
  }

  const hostname = typeof window !== "undefined"
    ? window.location.hostname.trim().toLowerCase()
    : "";
  return ROLE_ROOM_HOSTS.has(hostname)
    ? ROLE_ROOM_GA_MEASUREMENT_ID
    : CREATORHUB_GA_MEASUREMENT_ID;
}

function ensureGoogleTagLoaded(): void {
  if (typeof window === "undefined") return;
  if (!hasAnalyticsConsent()) return;

  if (typeof window.__creatorhubLoadAnalytics === "function") {
    window.__creatorhubLoadAnalytics();
    return;
  }

  if (hasInjectedGoogleTagScript()) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () {
    window.dataLayer?.push(arguments);
  };

  const measurementId = resolveMeasurementId();
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  script.dataset.creatorhubGaRuntime = "true";
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

export const initGA = () => {
  if (typeof window === "undefined") return;
  ensureGoogleTagLoaded();
};

export const trackPageView = (url: string) => {
  if (typeof window === "undefined") return;

  ensureGoogleTagLoaded();
  if (!window.gtag) return;

  window.gtag("config", resolveMeasurementId(), {
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
