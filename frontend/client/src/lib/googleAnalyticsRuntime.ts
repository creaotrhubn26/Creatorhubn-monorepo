declare global {
  interface Window {
    __creatorhubAnalyticsConfig?: {
      measurementId?: string;
      tagManagerId?: string;
      site?: "creatorhub" | "role-room" | "leadgrid";
    };
    __creatorhubApplyConsent?: (
      consentSettings?: AnalyticsConsentSettings | null,
    ) => boolean;
    __creatorhubLoadAnalytics?: (
      consentSettings?: AnalyticsConsentSettings | null,
    ) => boolean;
  }
}

export interface AnalyticsConsentSettings {
  analytics?: boolean;
  marketing?: boolean;
  preferences?: boolean;
  necessary?: boolean;
}

const DEFAULT_CREATORHUB_GA_MEASUREMENT_ID = "G-6E5MJT8REW";
const DEFAULT_ROLE_ROOM_GA_MEASUREMENT_ID = "G-9T7K5TJVFX";
const DEFAULT_LEADGRID_GA_MEASUREMENT_ID = "G-3MS91ZHVKS";
const DEFAULT_LEADGRID_GOOGLE_TAG_MANAGER_ID = "GTM-W8QZL75L";
const DEFAULT_GOOGLE_TAG_MANAGER_ID = "GTM-MFWW7X83";

function resolveConfiguredMeasurementId(
  value: string | undefined,
  fallback: string,
): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export const CREATORHUB_GA_MEASUREMENT_ID = resolveConfiguredMeasurementId(
  import.meta.env.VITE_CREATORHUB_GA_MEASUREMENT_ID ??
    import.meta.env.VITE_GA_MEASUREMENT_ID,
  DEFAULT_CREATORHUB_GA_MEASUREMENT_ID,
);

export const ROLE_ROOM_GA_MEASUREMENT_ID = resolveConfiguredMeasurementId(
  import.meta.env.VITE_ROLE_ROOM_GA_MEASUREMENT_ID,
  DEFAULT_ROLE_ROOM_GA_MEASUREMENT_ID,
);

export const LEADGRID_GA_MEASUREMENT_ID = resolveConfiguredMeasurementId(
  import.meta.env.VITE_LEADGRID_GA_MEASUREMENT_ID,
  DEFAULT_LEADGRID_GA_MEASUREMENT_ID,
);

export const LEADGRID_GOOGLE_TAG_MANAGER_ID = resolveConfiguredMeasurementId(
  import.meta.env.VITE_LEADGRID_GOOGLE_TAG_MANAGER_ID,
  DEFAULT_LEADGRID_GOOGLE_TAG_MANAGER_ID,
);

export const GOOGLE_TAG_MANAGER_ID = resolveConfiguredMeasurementId(
  import.meta.env.VITE_GOOGLE_TAG_MANAGER_ID,
  DEFAULT_GOOGLE_TAG_MANAGER_ID,
);

export const CREATORHUB_GOOGLE_TAG_MANAGER_ID = resolveConfiguredMeasurementId(
  import.meta.env.VITE_CREATORHUB_GOOGLE_TAG_MANAGER_ID ??
    import.meta.env.VITE_GOOGLE_TAG_MANAGER_ID,
  DEFAULT_GOOGLE_TAG_MANAGER_ID,
);

export const ROLE_ROOM_GOOGLE_TAG_MANAGER_ID = resolveConfiguredMeasurementId(
  import.meta.env.VITE_ROLE_ROOM_GOOGLE_TAG_MANAGER_ID ??
    import.meta.env.VITE_GOOGLE_TAG_MANAGER_ID,
  DEFAULT_GOOGLE_TAG_MANAGER_ID,
);

const ROLE_ROOM_HOSTS = new Set([
  "theroleroom.com",
  "www.theroleroom.com",
]);

const LEADGRID_HOSTS = new Set([
  "leadgrid.no",
  "www.leadgrid.no",
  "leadgrid.theroleroom.com",
]);

export function resolveAnalyticsSite(
  hostname: string | null | undefined = typeof window !== "undefined"
    ? window.location.hostname
    : "",
): "creatorhub" | "role-room" | "leadgrid" {
  const normalizedHostname = typeof hostname === "string"
    ? hostname.trim().toLowerCase()
    : "";
  if (LEADGRID_HOSTS.has(normalizedHostname)) return "leadgrid";
  return ROLE_ROOM_HOSTS.has(normalizedHostname) ? "role-room" : "creatorhub";
}

export function resolveGoogleAnalyticsMeasurementId(
  hostname?: string | null,
): string {
  const site = resolveAnalyticsSite(hostname);
  if (site === "leadgrid") return LEADGRID_GA_MEASUREMENT_ID;
  return site === "role-room"
    ? ROLE_ROOM_GA_MEASUREMENT_ID
    : CREATORHUB_GA_MEASUREMENT_ID;
}

export function getGoogleAnalyticsMeasurementId(): string {
  if (typeof window !== "undefined") {
    const configuredId = window.__creatorhubAnalyticsConfig?.measurementId;
    if (typeof configuredId === "string" && configuredId.trim()) {
      return configuredId.trim();
    }
  }
  return resolveGoogleAnalyticsMeasurementId();
}

export function getGoogleTagManagerId(): string {
  if (typeof window !== "undefined") {
    const configuredId = window.__creatorhubAnalyticsConfig?.tagManagerId;
    if (typeof configuredId === "string" && configuredId.trim()) {
      return configuredId.trim();
    }
  }

  const site = resolveAnalyticsSite();
  if (site === "leadgrid") return LEADGRID_GOOGLE_TAG_MANAGER_ID;
  return site === "role-room"
    ? ROLE_ROOM_GOOGLE_TAG_MANAGER_ID
    : CREATORHUB_GOOGLE_TAG_MANAGER_ID;
}

export function getAnalyticsPlatformName(): string {
  const site = resolveAnalyticsSite();
  if (site === "leadgrid") return "leadgrid";
  return site === "role-room" ? "the_role_room" : "creatorhub_norge";
}
