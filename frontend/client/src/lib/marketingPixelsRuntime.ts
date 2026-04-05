import { resolveAnalyticsSite } from './googleAnalyticsRuntime';

export interface MarketingConsentSettings {
  analytics?: boolean;
  marketing?: boolean;
  preferences?: boolean;
  necessary?: boolean;
}

type PixelFunction = ((...args: unknown[]) => void) & {
  queue?: unknown[][];
  callMethod?: (...args: unknown[]) => void;
  push?: (...args: unknown[]) => void;
  loaded?: boolean;
  version?: string;
};

type TikTokPixelFunction = ((...args: unknown[]) => void) & {
  queue?: unknown[][];
  methods?: string[];
  instance?: TikTokPixelFunction;
  load?: (...args: unknown[]) => void;
  page?: (...args: unknown[]) => void;
  track?: (...args: unknown[]) => void;
  identify?: (...args: unknown[]) => void;
  instances?: (...args: unknown[]) => void;
  debug?: (...args: unknown[]) => void;
  on?: (...args: unknown[]) => void;
  off?: (...args: unknown[]) => void;
  once?: (...args: unknown[]) => void;
  ready?: (...args: unknown[]) => void;
  alias?: (...args: unknown[]) => void;
  group?: (...args: unknown[]) => void;
  enableCookie?: (...args: unknown[]) => void;
  disableCookie?: (...args: unknown[]) => void;
  holdConsent?: (...args: unknown[]) => void;
  revokeConsent?: (...args: unknown[]) => void;
  grantConsent?: (...args: unknown[]) => void;
  setAndDefer?: (target: TikTokPixelFunction, method: string) => void;
};

declare global {
  interface Window {
    fbq?: PixelFunction;
    _fbq?: PixelFunction;
    ttq?: TikTokPixelFunction;
  }
}

function resolveConfiguredId(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

const CREATORHUB_META_PIXEL_ID = resolveConfiguredId(
  import.meta.env.VITE_CREATORHUB_META_PIXEL_ID,
);
const ROLE_ROOM_META_PIXEL_ID = resolveConfiguredId(
  import.meta.env.VITE_ROLE_ROOM_META_PIXEL_ID,
);
const CREATORHUB_TIKTOK_PIXEL_ID = resolveConfiguredId(
  import.meta.env.VITE_CREATORHUB_TIKTOK_PIXEL_ID,
);
const ROLE_ROOM_TIKTOK_PIXEL_ID = resolveConfiguredId(
  import.meta.env.VITE_ROLE_ROOM_TIKTOK_PIXEL_ID,
);

let metaPixelRequested = false;
let metaPixelInitialized = false;
let tikTokPixelRequested = false;
let tikTokPixelInitialized = false;

function hasMarketingConsent(
  consentSettings?: MarketingConsentSettings | null,
): boolean {
  if (typeof consentSettings?.marketing === 'boolean') {
    return consentSettings.marketing;
  }

  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const rawConsent = window.localStorage.getItem('gdpr-consent');
    if (!rawConsent) {
      return false;
    }

    const parsedConsent = JSON.parse(rawConsent) as MarketingConsentSettings | null;
    return parsedConsent?.marketing === true;
  } catch {
    return false;
  }
}

function resolveMetaPixelId(hostname?: string | null): string {
  return resolveAnalyticsSite(hostname) === 'role-room'
    ? ROLE_ROOM_META_PIXEL_ID
    : CREATORHUB_META_PIXEL_ID;
}

function resolveTikTokPixelId(hostname?: string | null): string {
  return resolveAnalyticsSite(hostname) === 'role-room'
    ? ROLE_ROOM_TIKTOK_PIXEL_ID
    : CREATORHUB_TIKTOK_PIXEL_ID;
}

function isTrackableBrowser(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const hostname = window.location.hostname;
  return (
    hostname !== 'localhost' &&
    hostname !== '127.0.0.1' &&
    navigator.onLine !== false
  );
}

function ensureMetaPixelStub(): PixelFunction {
  if (typeof window === 'undefined') {
    return (() => undefined) as PixelFunction;
  }

  if (typeof window.fbq === 'function') {
    return window.fbq;
  }

  const fbq = ((...args: unknown[]) => {
    if (typeof fbq.callMethod === 'function') {
      fbq.callMethod(...args);
      return;
    }

    fbq.queue = fbq.queue || [];
    fbq.queue.push(args);
  }) as PixelFunction;

  fbq.queue = [];
  fbq.loaded = true;
  fbq.version = '2.0';
  fbq.push = (...args: unknown[]) => {
    fbq.queue = fbq.queue || [];
    fbq.queue.push(args);
  };

  window.fbq = fbq;
  window._fbq = fbq;
  return fbq;
}

function ensureTikTokPixelStub(): TikTokPixelFunction {
  if (typeof window === 'undefined') {
    return (() => undefined) as TikTokPixelFunction;
  }

  if (typeof window.ttq === 'function' && typeof window.ttq.load === 'function') {
    return window.ttq;
  }

  const ttq = ((...args: unknown[]) => {
    ttq.queue = ttq.queue || [];
    ttq.queue.push(args);
  }) as TikTokPixelFunction;

  ttq.queue = [];
  ttq.methods = [
    'page',
    'track',
    'identify',
    'instances',
    'debug',
    'on',
    'off',
    'once',
    'ready',
    'alias',
    'group',
    'enableCookie',
    'disableCookie',
    'holdConsent',
    'revokeConsent',
    'grantConsent',
  ];
  ttq.setAndDefer = (target: TikTokPixelFunction, method: string) => {
    target[method as keyof TikTokPixelFunction] = ((...args: unknown[]) => {
      target.queue = target.queue || [];
      target.queue.push([method, ...args]);
    }) as never;
  };

  ttq.methods.forEach((method) => {
    ttq.setAndDefer?.(ttq, method);
  });

  window.ttq = ttq;
  return ttq;
}

function ensureMetaPixelLoaded(
  consentSettings?: MarketingConsentSettings | null,
): boolean {
  if (!isTrackableBrowser() || !hasMarketingConsent(consentSettings)) {
    if (typeof window?.fbq === 'function') {
      window.fbq('consent', 'revoke');
    }
    return false;
  }

  const pixelId = resolveMetaPixelId();
  if (!pixelId) {
    return false;
  }

  const fbq = ensureMetaPixelStub();

  if (metaPixelInitialized) {
    fbq('consent', 'grant');
    return true;
  }

  if (metaPixelRequested) {
    return true;
  }

  metaPixelRequested = true;

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  script.onload = () => {
    metaPixelInitialized = true;
    fbq('init', pixelId);
    fbq('consent', 'grant');
    fbq('track', 'PageView');
  };
  script.onerror = () => {
    metaPixelRequested = false;
  };

  document.head.appendChild(script);
  return true;
}

function ensureTikTokPixelLoaded(
  consentSettings?: MarketingConsentSettings | null,
): boolean {
  if (!isTrackableBrowser() || !hasMarketingConsent(consentSettings)) {
    if (typeof window?.ttq?.revokeConsent === 'function') {
      window.ttq.revokeConsent();
    }
    return false;
  }

  const pixelId = resolveTikTokPixelId();
  if (!pixelId) {
    return false;
  }

  const ttq = ensureTikTokPixelStub();

  if (tikTokPixelInitialized) {
    ttq.grantConsent?.();
    return true;
  }

  if (tikTokPixelRequested) {
    return true;
  }

  tikTokPixelRequested = true;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${encodeURIComponent(pixelId)}&lib=ttq`;
  script.onload = () => {
    tikTokPixelInitialized = true;
    ttq.load?.(pixelId);
    ttq.grantConsent?.();
    ttq.page?.();
  };
  script.onerror = () => {
    tikTokPixelRequested = false;
  };

  document.head.appendChild(script);
  return true;
}

export function applyMarketingConsent(
  consentSettings?: MarketingConsentSettings | null,
): boolean {
  const metaReady = ensureMetaPixelLoaded(consentSettings);
  const tikTokReady = ensureTikTokPixelLoaded(consentSettings);
  return metaReady || tikTokReady;
}

export function trackMarketingPageView(url?: string): void {
  if (!hasMarketingConsent() || typeof window === 'undefined') {
    return;
  }

  ensureMetaPixelLoaded({ marketing: true });
  ensureTikTokPixelLoaded({ marketing: true });

  if (typeof window.fbq === 'function') {
    window.fbq('track', 'PageView');
  }

  if (typeof window.ttq?.page === 'function') {
    window.ttq.page({
      page_path: url || window.location.pathname,
      page_title: document.title,
      page_location: window.location.href,
    });
  }
}

export function trackMarketingEvent(
  eventName: string,
  parameters?: Record<string, unknown>,
): void {
  if (!hasMarketingConsent() || typeof window === 'undefined') {
    return;
  }

  ensureMetaPixelLoaded({ marketing: true });
  ensureTikTokPixelLoaded({ marketing: true });

  if (typeof window.fbq === 'function') {
    window.fbq('trackCustom', eventName, parameters || {});
  }

  if (typeof window.ttq?.track === 'function') {
    window.ttq.track(eventName, parameters || {});
  }
}
