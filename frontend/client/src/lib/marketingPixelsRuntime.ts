/**
 * marketingPixelsRuntime.ts
 *
 * PURE SERVER-SIDE Meta Conversions API (CAPI) — ingen fbevents.js.
 *
 * Tidligere lastet vi `https://connect.facebook.net/en_US/fbevents.js`
 * for å sende events client-side. Den hadde to problemer:
 *   1. Deprecated AttributionReporting API trigget Lighthouse-advarsler
 *   2. Mistet events til ad-blockere, iOS 14+ ATT, og strenge nettlesere
 *
 * Ny arkitektur:
 *   • Klient genererer event_id (UUID), `_fbp` (browser-ID) og `_fbc`
 *     (click-ID fra ?fbclid=) selv
 *   • Klient POSTer alle events til backend /api/marketing/meta-capi-event
 *   • Backend signerer og videresender til Meta Graph API med hashed PII
 *
 * GDPR: kun aktivt etter eksplisitt marketing-consent.
 * Backwards-compat: `trackMarketingPageView` og `trackMarketingEvent`
 * beholder samme signatur som før — alle eksisterende call-sites
 * fungerer uten endring.
 *
 * TikTok-pixel beholdes som før (egen variant).
 */

// ─────────────────────────────────────────────────────────────────
// Eksterne typer (TikTok pixel beholdes som var)
// ─────────────────────────────────────────────────────────────────

export interface MarketingConsentSettings {
  analytics?: boolean;
  marketing?: boolean;
  preferences?: boolean;
  necessary?: boolean;
}

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
    ttq?: TikTokPixelFunction;
  }
}

function resolveConfiguredId(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

const CREATORHUB_TIKTOK_PIXEL_ID = resolveConfiguredId(
  import.meta.env.VITE_CREATORHUB_TIKTOK_PIXEL_ID,
);
const ROLE_ROOM_TIKTOK_PIXEL_ID = resolveConfiguredId(
  import.meta.env.VITE_ROLE_ROOM_TIKTOK_PIXEL_ID,
);

let tikTokPixelRequested = false;
let tikTokPixelInitialized = false;

// ─────────────────────────────────────────────────────────────────
// Consent
// ─────────────────────────────────────────────────────────────────

function hasMarketingConsent(
  consentSettings?: MarketingConsentSettings | null,
): boolean {
  if (typeof consentSettings?.marketing === 'boolean') {
    return consentSettings.marketing;
  }
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem('gdpr-consent');
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Boolean(parsed?.marketing);
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────
// Cookies — _fbp (browser-ID) og _fbc (click-ID) genereres selv
// uten fbevents.js. Formatet matcher Metas spec så CAPI godtar dem.
// ─────────────────────────────────────────────────────────────────

const FBP_COOKIE = '_fbp';
const FBC_COOKIE = '_fbc';
const COOKIE_TTL_DAYS = 90;

function setCookie(name: string, value: string, days: number): void {
  if (typeof document === 'undefined') return;
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 86400 * 1000);
  // SameSite=Lax så vi får cookien både på top-level og same-site requests.
  // Domain settes ikke eksplisitt — browser bruker host-only (sikrere).
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires.toUTCString()}; path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
}

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const parts = document.cookie.split(';').map((p) => p.trim());
  for (const p of parts) {
    if (p.startsWith(`${name}=`)) return decodeURIComponent(p.slice(name.length + 1));
  }
  return undefined;
}

/**
 * Genererer eller henter _fbp (browser-ID).
 * Format: fb.1.<ms-timestamp>.<random-10-digit>
 */
function ensureFbpCookie(): string {
  const existing = getCookie(FBP_COOKIE);
  if (existing && /^fb\.1\.\d+\.\d+$/.test(existing)) return existing;
  const ts = Date.now();
  // 10-sifret tilfeldig tall (Metas spec)
  const rand = Math.floor(Math.random() * 9_000_000_000) + 1_000_000_000;
  const fbp = `fb.1.${ts}.${rand}`;
  setCookie(FBP_COOKIE, fbp, COOKIE_TTL_DAYS);
  return fbp;
}

/**
 * Henter _fbc fra URL (?fbclid=...) hvis tilstede, og persisterer som
 * cookie. Hvis ingen fbclid og cookie allerede finnes, returnerer den.
 * Format: fb.1.<ms-timestamp>.<fbclid>
 */
function ensureFbcCookie(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const params = new URLSearchParams(window.location.search);
  const fbclid = params.get('fbclid');
  if (fbclid) {
    const fbc = `fb.1.${Date.now()}.${fbclid}`;
    setCookie(FBC_COOKIE, fbc, COOKIE_TTL_DAYS);
    return fbc;
  }
  return getCookie(FBC_COOKIE);
}

// ─────────────────────────────────────────────────────────────────
// Event-ID — sendes til backend så Meta kan dedupliserer hvis vi
// senere skulle re-aktivere klient-Pixel. Også brukt for å unngå
// dobbeltsending hvis retry skjer.
// ─────────────────────────────────────────────────────────────────

function generateEventId(): string {
  // RFC4122 v4-aktig: 32 hex-tegn med tidsstempel-prefiks så vi kan
  // korrelere events tidsmessig hvis vi ettergår i Events Manager.
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  return `${ts}-${rand}`.slice(0, 48);
}

// ─────────────────────────────────────────────────────────────────
// Send event til backend (som videresender til Meta CAPI)
// ─────────────────────────────────────────────────────────────────

interface CapiClientPayload {
  eventName: string;
  eventId: string;
  eventSourceUrl: string;
  customData?: Record<string, unknown>;
  userData?: {
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    externalId?: string;
  };
}

async function postToBackend(payload: CapiClientPayload): Promise<void> {
  try {
    await fetch('/api/marketing/meta-capi-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Cookies (_fbp, _fbc) sendes automatisk så backend kan plukke
      // dem opp og legge inn i user_data
      credentials: 'same-origin',
      body: JSON.stringify(payload),
      // Keepalive så event ikke aborteres ved page-unload
      keepalive: true,
    });
  } catch (err) {
    // Best-effort — ikke krasj brukerflyten ved nettverksfeil
    console.warn('[capi] event-send feilet', err);
  }
}

// ─────────────────────────────────────────────────────────────────
// TikTok pixel — uendret fra før
// ─────────────────────────────────────────────────────────────────

function resolveSiteId(): { tikTokId: string } {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isRoleRoom = /(^|\.)theroleroom\.com$/i.test(hostname);
  return {
    tikTokId: isRoleRoom ? ROLE_ROOM_TIKTOK_PIXEL_ID : CREATORHUB_TIKTOK_PIXEL_ID,
  };
}

function ensureTikTokPixelLoaded(
  consentSettings?: MarketingConsentSettings | null,
): boolean {
  if (typeof window === 'undefined') return false;
  if (!hasMarketingConsent(consentSettings)) return false;
  const { tikTokId } = resolveSiteId();
  if (!tikTokId) return false;
  if (tikTokPixelRequested || tikTokPixelInitialized) return true;
  tikTokPixelRequested = true;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${tikTokId}&lib=ttq`;
  script.onload = () => {
    tikTokPixelInitialized = true;
    const ttq = window.ttq;
    if (!ttq) return;
    ttq.load?.(tikTokId);
    ttq.grantConsent?.();
    ttq.page?.();
  };
  script.onerror = () => {
    tikTokPixelRequested = false;
  };
  document.head.appendChild(script);
  return true;
}

// ─────────────────────────────────────────────────────────────────
// Public API — samme signatur som før (backwards-kompatibelt)
// ─────────────────────────────────────────────────────────────────

/**
 * Aktiveres ved consent-grant. Initialiserer cookies + TikTok.
 * Returnerer true hvis noe ble lastet.
 */
export function applyMarketingConsent(
  consentSettings?: MarketingConsentSettings | null,
): boolean {
  if (!hasMarketingConsent(consentSettings)) return false;
  // Fyr opp cookies så Meta CAPI får dem med på første event
  ensureFbpCookie();
  ensureFbcCookie();
  const tikTokReady = ensureTikTokPixelLoaded(consentSettings);
  return true || tikTokReady;
}

/**
 * Send PageView til Meta via vår backend.
 */
export function trackMarketingPageView(url?: string): void {
  if (!hasMarketingConsent() || typeof window === 'undefined') return;
  ensureFbpCookie();
  ensureFbcCookie();
  ensureTikTokPixelLoaded({ marketing: true });

  void postToBackend({
    eventName: 'PageView',
    eventId: generateEventId(),
    eventSourceUrl: window.location.href,
    customData: {
      page_path: url || window.location.pathname,
      page_title: document.title,
    },
  });

  if (typeof window.ttq?.page === 'function') {
    window.ttq.page({
      page_path: url || window.location.pathname,
      page_title: document.title,
      page_location: window.location.href,
    });
  }
}

/**
 * Send custom event til Meta via vår backend.
 */
export function trackMarketingEvent(
  eventName: string,
  parameters?: Record<string, unknown>,
): void {
  if (!hasMarketingConsent() || typeof window === 'undefined') return;
  ensureFbpCookie();
  ensureFbcCookie();
  ensureTikTokPixelLoaded({ marketing: true });

  // Mapping: vanlige GA-events → Meta-event-navn
  const META_STANDARD: Record<string, string> = {
    page_view: 'PageView',
    view_item: 'ViewContent',
    sign_up: 'CompleteRegistration',
    login: 'Lead',
    begin_checkout: 'InitiateCheckout',
    add_payment_info: 'AddPaymentInfo',
    purchase: 'Purchase',
    nextrole_landing_viewed: 'ViewContent',
    nextrole_checkout_clicked: 'InitiateCheckout',
  };
  const metaEventName = META_STANDARD[eventName] ?? `Custom_${eventName}`;

  void postToBackend({
    eventName: metaEventName,
    eventId: generateEventId(),
    eventSourceUrl: window.location.href,
    customData: parameters,
  });

  if (typeof window.ttq?.track === 'function') {
    window.ttq.track(eventName, parameters || {});
  }
}

/**
 * Eksplisitt conversion-tracking for kritiske events der vi har PII
 * (e-post, navn) som forbedrer attribusjons-match. Brukes f.eks. når
 * bruker registrerer seg eller starter trial.
 */
export function trackConversion(
  eventName:
    | 'Lead'
    | 'CompleteRegistration'
    | 'InitiateCheckout'
    | 'AddPaymentInfo'
    | 'StartTrial'
    | 'Subscribe'
    | 'Purchase',
  opts: {
    value?: number;
    currency?: string;
    userData?: {
      email?: string;
      phone?: string;
      firstName?: string;
      lastName?: string;
      externalId?: string;
    };
    customData?: Record<string, unknown>;
  } = {},
): void {
  if (!hasMarketingConsent() || typeof window === 'undefined') return;
  ensureFbpCookie();
  ensureFbcCookie();

  void postToBackend({
    eventName,
    eventId: generateEventId(),
    eventSourceUrl: window.location.href,
    userData: opts.userData,
    customData: {
      ...(opts.value !== undefined ? { value: opts.value } : {}),
      ...(opts.currency ? { currency: opts.currency } : {}),
      ...(opts.customData ?? {}),
    },
  });
}
