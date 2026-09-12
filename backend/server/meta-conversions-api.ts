/**
 * meta-conversions-api.ts
 *
 * Facebook (Meta) Conversions API — PURE SERVER-SIDE event-sending.
 *
 * Klient laster IKKE fbevents.js lenger (eliminerer deprecated
 * AttributionReporting-warning + ad-blocker-tap). Klient genererer
 * selv _fbp og _fbc cookies, sender events til vår backend, som
 * signerer og videresender til Meta Graph API med hashed PII.
 *
 * MULTI-SITE: vi serverer både creatorhubn.com og theroleroom.com
 * fra samme backend. Pixel-ID + CAPI-token er forskjellig per site.
 *
 * Env-vars per site:
 *   creatorhubn.com:
 *     META_PIXEL_ID
 *     META_CAPI_ACCESS_TOKEN
 *     META_CAPI_TEST_EVENT_CODE       (valgfritt)
 *   theroleroom.com:
 *     ROLE_ROOM_META_PIXEL_ID
 *     ROLE_ROOM_META_CAPI_ACCESS_TOKEN
 *     ROLE_ROOM_META_CAPI_TEST_EVENT_CODE (valgfritt)
 *
 * Site avgjøres av Origin-header (eller eventSourceUrl-feltet i body
 * som fallback). Hvis ingen match → bruker CreatorHub-credentials.
 *
 * Endepunkt:
 *   POST /api/marketing/meta-capi-event
 *     Body: { eventName, eventId, userData, customData, eventSourceUrl }
 *
 * GDPR / PII-hashing:
 *   Email, telefon, navn osv. hashes med SHA-256 (krav fra Meta).
 *   Aldri ren PII over wire til Meta.
 */

import { createHash } from "crypto";
import type express from "express";

export interface MetaCapiDeps {
  app: express.Application;
  getActiveSessionFromRequest: (
    req: express.Request,
  ) => { userId: string; email?: string; firstName?: string } | null;
}

// ── Hash-helpers (SHA-256 hex, normalisert) ──────────────────────

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizePhone(phone: string): string {
  // Bare tall, ledende + tillatt fjernes (Meta-krav)
  return phone.replace(/[^0-9]/g, "");
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

interface RawUserData {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  dateOfBirth?: string;
  externalId?: string;
}

interface HashedUserData {
  em?: string[];
  ph?: string[];
  fn?: string[];
  ln?: string[];
  ct?: string[];
  st?: string[];
  zp?: string[];
  country?: string[];
  db?: string[];
  external_id?: string[];
  // IP og UA fra request (ikke hashed)
  client_ip_address?: string;
  client_user_agent?: string;
  // Facebook click-id (fbc) og browser-id (fbp) hentes fra cookies
  fbc?: string;
  fbp?: string;
}

function hashUserData(
  raw: RawUserData,
  req: { ip?: string; ua?: string; fbc?: string; fbp?: string },
): HashedUserData {
  const out: HashedUserData = {};
  if (raw.email) out.em = [sha256Hex(normalizeEmail(raw.email))];
  if (raw.phone) out.ph = [sha256Hex(normalizePhone(raw.phone))];
  if (raw.firstName) out.fn = [sha256Hex(normalizeName(raw.firstName))];
  if (raw.lastName) out.ln = [sha256Hex(normalizeName(raw.lastName))];
  if (raw.city) out.ct = [sha256Hex(normalizeName(raw.city))];
  if (raw.state) out.st = [sha256Hex(normalizeName(raw.state))];
  if (raw.zip) out.zp = [sha256Hex(raw.zip.replace(/\s/g, "").toLowerCase())];
  if (raw.country) out.country = [sha256Hex(raw.country.toLowerCase())];
  if (raw.dateOfBirth) {
    // ISO eller YYYYMMDD — Meta krever YYYYMMDD
    const d = raw.dateOfBirth.replace(/[^0-9]/g, "").slice(0, 8);
    if (d.length === 8) out.db = [sha256Hex(d)];
  }
  if (raw.externalId) out.external_id = [sha256Hex(raw.externalId)];
  if (req.ip) out.client_ip_address = req.ip;
  if (req.ua) out.client_user_agent = req.ua;
  if (req.fbc) out.fbc = req.fbc;
  if (req.fbp) out.fbp = req.fbp;
  return out;
}

// ── Send til Meta Graph API ──────────────────────────────────────

interface CapiEvent {
  event_name: string;
  event_time: number;
  event_id: string;
  event_source_url?: string;
  action_source: "website" | "email" | "app" | "phone_call" | "chat" | "physical_store" | "system_generated" | "business_messaging" | "other";
  user_data: HashedUserData;
  custom_data?: Record<string, unknown>;
}

interface SendResult {
  sent: boolean;
  fbtrace_id?: string;
  events_received?: number;
  error?: string;
}

// Bestemmer hvilket pixel+token-sett som skal brukes basert på site.
// 'creatorhub' og 'role-room' har hver sine env-vars.
type SiteKey = "creatorhub" | "role-room";

function resolveSiteCredentials(siteKey: SiteKey): {
  pixelId: string | undefined;
  accessToken: string | undefined;
  testCode: string | undefined;
} {
  if (siteKey === "role-room") {
    return {
      pixelId: process.env.ROLE_ROOM_META_PIXEL_ID,
      accessToken: process.env.ROLE_ROOM_META_CAPI_ACCESS_TOKEN,
      testCode: process.env.ROLE_ROOM_META_CAPI_TEST_EVENT_CODE,
    };
  }
  return {
    pixelId: process.env.META_PIXEL_ID,
    accessToken: process.env.META_CAPI_ACCESS_TOKEN,
    testCode: process.env.META_CAPI_TEST_EVENT_CODE,
  };
}

const ROLE_ROOM_HOSTS = new Set([
  "theroleroom.com",
  "www.theroleroom.com",
]);

function resolveSiteFromContext(opts: {
  origin?: string;
  eventSourceUrl?: string;
  host?: string;
}): SiteKey {
  const candidates = [opts.origin, opts.eventSourceUrl, opts.host].filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );
  for (const c of candidates) {
    try {
      const url = c.includes("://") ? new URL(c) : new URL(`https://${c}`);
      const host = url.hostname.toLowerCase();
      if (ROLE_ROOM_HOSTS.has(host)) return "role-room";
    } catch {
      const lower = c.toLowerCase();
      if (ROLE_ROOM_HOSTS.has(lower)) return "role-room";
    }
  }
  return "creatorhub";
}

export async function sendMetaCapiEvent(
  event: CapiEvent,
  siteKey: SiteKey = "creatorhub",
): Promise<SendResult> {
  const { pixelId, accessToken, testCode } = resolveSiteCredentials(siteKey);
  if (!pixelId || !accessToken) {
    return {
      sent: false,
      error: `Meta CAPI ikke konfigurert for site=${siteKey} (mangler ${siteKey === "role-room" ? "ROLE_ROOM_META_PIXEL_ID/ACCESS_TOKEN" : "META_PIXEL_ID/ACCESS_TOKEN"})`,
    };
  }

  const url = `https://graph.facebook.com/v18.0/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`;

  const body = {
    data: [event],
    ...(testCode ? { test_event_code: testCode } : {}),
  };

  try {
    // LM-4: 10s timeout (CAPI er tregere enn vanlige APIer). AbortError
    // mappes til { success:false, error } i kallets eksisterende catch.
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await res.json()) as {
      events_received?: number;
      fbtrace_id?: string;
      error?: { message: string; code: number; type: string };
    };
    if (!res.ok || json.error) {
      console.error("[meta-capi] send failed", {
        status: res.status,
        error: json.error,
      });
      return {
        sent: false,
        error: json.error?.message ?? `HTTP ${res.status}`,
        fbtrace_id: json.fbtrace_id,
      };
    }
    return {
      sent: true,
      events_received: json.events_received,
      fbtrace_id: json.fbtrace_id,
    };
  } catch (err) {
    console.error("[meta-capi] network error", err);
    return {
      sent: false,
      error: String(err instanceof Error ? err.message : err),
    };
  }
}

/**
 * Generisk CAPI-trigger fra Stripe checkout.session.completed.
 * Brukes som fallback for alle checkout-flyt som IKKE har sin egen
 * spesialiserte CAPI-handler (NextRole har egen, andre faller hit).
 *
 * Idempotent via event_id basert på session.id — gjentatte webhook-
 * leveranser fra Stripe gir bare ett event på Metas side.
 */
export async function sendCheckoutCapiEvent(input: {
  /** Stripe Checkout Session */
  session: {
    id: string;
    amount_total?: number | null;
    currency?: string | null;
    customer_email?: string | null;
    customer_details?: { email?: string | null; name?: string | null; phone?: string | null } | null;
    metadata?: Record<string, string> | null;
    mode?: string | null;
    success_url?: string | null;
  };
  /** Hvilken event-type — 'Subscribe' for sub-mode, 'Purchase' ellers */
  eventName?: "Purchase" | "Subscribe";
  /** Fra hvilket origin/domene transaksjonen kom (avgjør pixel-ID) */
  siteKey?: SiteKey;
}): Promise<SendResult> {
  const s = input.session;
  const email = s.customer_email ?? s.customer_details?.email ?? undefined;
  const phone = s.customer_details?.phone ?? undefined;
  const fullName = (s.customer_details?.name ?? "").trim();
  const [firstName, ...rest] = fullName.split(/\s+/);
  const lastName = rest.join(" ");

  const eventName =
    input.eventName ?? (s.mode === "subscription" ? "Subscribe" : "Purchase");

  // Avgjør site fra success_url hvis ikke gitt
  let siteKey = input.siteKey;
  if (!siteKey) {
    siteKey = resolveSiteFromContext({ eventSourceUrl: s.success_url ?? undefined });
  }

  const userData: RawUserData = {
    email: email ?? undefined,
    phone: phone ?? undefined,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    externalId: s.metadata?.user_id ?? undefined,
  };

  const amountOre = s.amount_total ?? 0;

  return sendMetaCapiEvent({
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: `stripe-session-${s.id}`,
    event_source_url: s.success_url ?? undefined,
    action_source: "system_generated",
    user_data: hashUserData(userData, {}),
    custom_data: {
      value: amountOre / 100,
      currency: (s.currency ?? "nok").toUpperCase(),
      content_type: s.mode === "subscription" ? "subscription" : "product",
      content_name: s.metadata?.app_id ?? s.metadata?.product_id ?? "checkout",
      stripe_session_id: s.id,
    },
  }, siteKey);
}

// Server-trigger-helper: kall denne fra webhook-handlere (Stripe, etc.)
// uten å gå via frontend. F.eks. når Stripe rapporterer suksessfull checkout.
export async function sendServerSideConversion(input: {
  eventName: "Purchase" | "StartTrial" | "Subscribe" | "Lead" | "CompleteRegistration";
  eventId: string;
  userData: RawUserData;
  customData?: {
    value?: number;
    currency?: string;
    content_ids?: string[];
    content_name?: string;
    content_type?: string;
    [k: string]: unknown;
  };
  eventSourceUrl?: string;
  /** Hvilken site eventet hører til. Default: creatorhub. */
  siteKey?: SiteKey;
}): Promise<SendResult> {
  const hashedUser = hashUserData(input.userData, {});
  const siteKey =
    input.siteKey ?? resolveSiteFromContext({ eventSourceUrl: input.eventSourceUrl });
  return sendMetaCapiEvent({
    event_name: input.eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: input.eventId,
    event_source_url: input.eventSourceUrl,
    action_source: "system_generated",
    user_data: hashedUser,
    custom_data: input.customData,
  }, siteKey);
}

// ── Endepunkt (kalles fra frontend parallelt med Pixel) ──────────

const VALID_EVENT_NAMES = new Set([
  "PageView", "ViewContent", "Search", "AddToCart", "AddToWishlist",
  "InitiateCheckout", "AddPaymentInfo", "Purchase",
  "Lead", "CompleteRegistration", "Subscribe", "StartTrial",
  "Contact", "FindLocation", "Schedule", "SubmitApplication",
  "Donate", "CustomizeProduct",
]);

// Abuse guards for the public (unauthenticated) /meta-capi-event endpoint.
// In-memory and therefore per-instance — best-effort, not a hard global limit,
// but enough to stop a single client from firing unbounded Purchase/Lead
// events with attacker-chosen ids/values. Meta also dedupes by event_id.
const CAPI_RATE_WINDOW_MS = 60_000;
const CAPI_RATE_MAX_PER_WINDOW = 60;
const CAPI_EVENT_ID_TTL_MS = 10 * 60_000;
const CAPI_MAX_EVENT_VALUE = 1_000_000;
const capiRateByIp = new Map<string, { count: number; resetAt: number }>();
const capiSeenEventIds = new Map<string, number>();

/** Returns true if this IP is over the per-minute cap. Prunes lazily. */
function capiRateLimited(ip: string, now: number): boolean {
  const key = ip || "unknown";
  const entry = capiRateByIp.get(key);
  if (!entry || now >= entry.resetAt) {
    capiRateByIp.set(key, { count: 1, resetAt: now + CAPI_RATE_WINDOW_MS });
    if (capiRateByIp.size > 5000) {
      for (const [k, v] of capiRateByIp) if (now >= v.resetAt) capiRateByIp.delete(k);
    }
    return false;
  }
  entry.count += 1;
  return entry.count > CAPI_RATE_MAX_PER_WINDOW;
}

/** True if this eventId was already accepted recently (replay). Prunes lazily. */
function capiEventIdSeen(eventId: string, now: number): boolean {
  const expiry = capiSeenEventIds.get(eventId);
  if (expiry && now < expiry) return true;
  capiSeenEventIds.set(eventId, now + CAPI_EVENT_ID_TTL_MS);
  if (capiSeenEventIds.size > 10_000) {
    for (const [k, exp] of capiSeenEventIds) if (now >= exp) capiSeenEventIds.delete(k);
  }
  return false;
}

function extractClientIp(req: express.Request): string {
  const cfIp = req.headers["cf-connecting-ip"];
  if (typeof cfIp === "string" && cfIp) return cfIp;
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff) return xff.split(",")[0].trim();
  return req.socket.remoteAddress ?? "";
}

function readCookie(req: express.Request, name: string): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(";").map((p) => p.trim());
  for (const p of parts) {
    if (p.startsWith(`${name}=`)) return decodeURIComponent(p.slice(name.length + 1));
  }
  return undefined;
}

export function setupMetaCapiRoutes(deps: MetaCapiDeps): void {
  const { app, getActiveSessionFromRequest } = deps;

  // LM-7: in-memory state for rate-limit + eventId-dedup. Pr-process
  // (per-replikat) — godt nok mot tilfeldig F5-pålegg og automated
  // spam, men ikke distributert. For sterkere garantier ville Redis
  // vært neste steg.
  const RATE_WINDOW_MS = 60_000;
  const RATE_LIMIT_PER_IP = 30;
  const EVENT_ID_TTL_MS = 10 * 60_000;     // 10 min
  const VALUE_CEILING = 1_000_000;          // NOK 1M sanity-cap

  const ipHits = new Map<string, number[]>();
  const seenEventIds = new Map<string, number>();   // eventId → expiry-ts

  function pruneExpired(now: number): void {
    if (ipHits.size > 5000) {
      for (const [ip, hits] of ipHits) {
        const fresh = hits.filter((t) => now - t < RATE_WINDOW_MS);
        if (fresh.length === 0) ipHits.delete(ip);
        else if (fresh.length < hits.length) ipHits.set(ip, fresh);
      }
    }
    if (seenEventIds.size > 5000) {
      for (const [id, expiry] of seenEventIds) {
        if (expiry < now) seenEventIds.delete(id);
      }
    }
  }

  app.post("/api/marketing/meta-capi-event", async (req, res) => {
    const body = (req.body ?? {}) as {
      eventName?: string;
      eventId?: string;
      userData?: RawUserData;
      customData?: Record<string, unknown>;
      eventSourceUrl?: string;
    };

    const eventName = String(body.eventName ?? "");
    const eventId = String(body.eventId ?? "");

    if (!VALID_EVENT_NAMES.has(eventName) && !eventName.startsWith("Custom_")) {
      res.status(400).json({ error: "ugyldig_event_name" });
      return;
    }
    if (!eventId || eventId.length < 8 || eventId.length > 128) {
      res.status(400).json({ error: "ugyldig_event_id" });
      return;
    }

    const now = Date.now();
    if (capiRateLimited(extractClientIp(req), now)) {
      res.status(429).json({ error: "rate_limited" });
      return;
    }
    // Reject absurd conversion values that would pollute reporting.
    const rawValue = (body.customData as { value?: unknown } | undefined)?.value;
    if (rawValue !== undefined) {
      const v = Number(rawValue);
      if (!Number.isFinite(v) || v < 0 || v > CAPI_MAX_EVENT_VALUE) {
        res.status(400).json({ error: "ugyldig_value" });
        return;
      }
    }
    // Drop obvious replays of the same event_id without forwarding to Meta.
    if (capiEventIdSeen(eventId, now)) {
      res.json({ success: true, deduped: true });
      return;
    }

    // Berikre user_data med ekte client-IP + UA + cookies fra request
    const session = getActiveSessionFromRequest(req);
    const rawUser: RawUserData = {
      ...(body.userData ?? {}),
      ...(session?.email && !body.userData?.email ? { email: session.email } : {}),
      ...(session?.userId && !body.userData?.externalId
        ? { externalId: session.userId }
        : {}),
    };

    const ip = extractClientIp(req);
    const ua = String(req.headers["user-agent"] ?? "");
    const fbc = readCookie(req, "_fbc");
    const fbp = readCookie(req, "_fbp");

    const userData = hashUserData(rawUser, { ip, ua, fbc, fbp });

    // Bestem site basert på Origin-header eller eventSourceUrl
    const origin = String(req.headers["origin"] ?? "");
    const host = String(req.headers["host"] ?? "");
    const siteKey = resolveSiteFromContext({
      origin,
      host,
      eventSourceUrl: body.eventSourceUrl,
    });

    const result = await sendMetaCapiEvent({
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      event_source_url: body.eventSourceUrl,
      action_source: "website",
      user_data: userData,
      custom_data: body.customData,
    }, siteKey);

    res.json({ ...result, site: siteKey });
  });

  // Debug-endpoint: sjekk om CAPI er konfigurert for begge sites
  // (uten å lekke tokens)
  app.get("/api/marketing/meta-capi-status", (_req, res) => {
    const ch = resolveSiteCredentials("creatorhub");
    const rr = resolveSiteCredentials("role-room");
    res.json({
      creatorhub: {
        configured: Boolean(ch.pixelId && ch.accessToken),
        pixelIdSet: Boolean(ch.pixelId),
        accessTokenSet: Boolean(ch.accessToken),
        testMode: Boolean(ch.testCode),
      },
      roleRoom: {
        configured: Boolean(rr.pixelId && rr.accessToken),
        pixelIdSet: Boolean(rr.pixelId),
        accessTokenSet: Boolean(rr.accessToken),
        testMode: Boolean(rr.testCode),
      },
    });
  });
}
