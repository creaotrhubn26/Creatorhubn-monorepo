/**
 * client-ads-google-oauth.ts
 *
 * B2 + B3 — Google Ads OAuth + ConversionActionService API-wrapper for
 * The Role Room Agent (multi-tenant ads per klient-prosjekt).
 *
 * Gjenbruker role-room-ads-oauth.ts som har:
 *   - buildAdsAuthUrl / exchangeAdsCodeForToken / refreshGoogleAdsAccessToken
 *   - upsertAdsOauthConnection / ensureFreshAdsToken (AES-256-GCM)
 *
 * Endpoints i client-ads-routes.ts:
 *   GET  /api/admin-room/agent/ads/oauth/google/start   — return Google OAuth-URL
 *   GET  /api/admin-room/agent/ads/oauth/google/callback — code → tokens → store
 *   POST /api/admin-room/agent/ads/configs/:id/sync-to-google
 *        → caller createConversionActions() for hver action i config
 *        → fyller inn google_ads_label + google_ads_action_id på actions
 *
 * Modell:
 *   - Producer eier én MCC-OAuth-connection (lagret per user_id).
 *   - Per-klient kjøres API-call mot client_ads_configs.google_ads_customer_id
 *     med login-customer-id satt til MCC-ID (GOOGLE_ADS_LOGIN_CUSTOMER_ID).
 *   - Conversion-actions opprettes i KLIENTENS Google Ads-konto, ikke MCC-ets.
 */

import type { Pool } from "pg";
import {
  buildAdsAuthUrl,
  exchangeAdsCodeForToken,
  upsertAdsOauthConnection,
  ensureFreshAdsToken,
  adsOauthClientCreds,
  getAdsOauthConnection,
} from "./role-room-ads-oauth.js";
import { getClientAdsAccess } from "./client-portal-google-ads-oauth.js";

const GOOGLE_ADS_API_VERSION = "v18";
const GOOGLE_ADS_API_BASE = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;

export interface OauthStartResult {
  authUrl: string;
  state: string;
}

/**
 * Bygg Google OAuth-start-URL. State innholder producer-user-id +
 * (optional) config_id slik at callback kan knytte connection til riktig kontext.
 */
export function buildGoogleAdsOauthStart(opts: {
  userId: string;
  configId?: string;
  redirectUri: string;
}): OauthStartResult | { error: string } {
  const creds = adsOauthClientCreds("google");
  if (!creds) {
    return { error: "GOOGLE_ADS_OAUTH_CLIENT_ID / SECRET mangler i miljøet" };
  }
  // State: enkel JSON-encoded payload. Production-vis: signer med HMAC.
  const state = Buffer.from(
    JSON.stringify({ uid: opts.userId, cfg: opts.configId ?? null, ts: Date.now() }),
  ).toString("base64url");

  const authUrl = buildAdsAuthUrl("google", {
    clientId: creds.clientId,
    redirectUri: opts.redirectUri,
    state,
  });
  if (!authUrl) return { error: "Kunne ikke bygge OAuth-URL" };
  return { authUrl, state };
}

/**
 * Verify state + exchange code for tokens + store connection.
 */
export async function handleGoogleAdsOauthCallback(
  pool: Pool,
  opts: { code: string; state: string; redirectUri: string },
): Promise<{ success: boolean; userId?: string; configId?: string | null; error?: string }> {
  let payload: { uid: string; cfg: string | null; ts: number };
  try {
    payload = JSON.parse(Buffer.from(opts.state, "base64url").toString("utf8"));
  } catch {
    return { success: false, error: "invalid_state" };
  }
  // Reject state eldre enn 10 min
  if (!payload.uid || Date.now() - payload.ts > 10 * 60 * 1000) {
    return { success: false, error: "expired_state" };
  }

  const creds = adsOauthClientCreds("google");
  if (!creds) return { success: false, error: "missing_oauth_creds" };

  try {
    const tokens = await exchangeAdsCodeForToken("google", {
      code: opts.code,
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
      redirectUri: opts.redirectUri,
    });

    if (!tokens.refreshToken) {
      // Google returnerer ikke refresh-token hvis bruker allerede har koblet.
      // Da må de revoke + re-grant. Vi flagger dette tilbake.
      return {
        success: false,
        error: "no_refresh_token_returned",
      };
    }

    const expiresAt = tokens.expiresInSec
      ? new Date(Date.now() + tokens.expiresInSec * 1000)
      : null;

    await upsertAdsOauthConnection(pool, {
      userId: payload.uid,
      platform: "google",
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: expiresAt,
      scopes: ["https://www.googleapis.com/auth/adwords"],
      accountRef: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? null,
    });

    return { success: true, userId: payload.uid, configId: payload.cfg };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "unknown_error",
    };
  }
}

interface ConversionActionInput {
  /** snake_case action-name fra client_ads_actions */
  actionName: string;
  /** Display-name fra config */
  displayName: string;
  /** Google Ads goal category */
  goalCategory: string;
  /** Default value i klientens currency */
  defaultValue: number;
  currency: string;
}

interface ConversionActionResult {
  resourceName: string;          // f.eks. "customers/123/conversionActions/456"
  conversionActionId: string;    // den siste delen (456)
  tagSnippet?: string | null;    // gtag-snippet med send_to + label
  awConversionId?: string | null; // AW-XXXXXXXXXX
  awConversionLabel?: string | null; // 20-tegns hash
}

/**
 * Map vår goal-kategori til Google Ads' enum.
 */
const GOAL_CATEGORY_MAP: Record<string, string> = {
  purchase: "PURCHASE",
  add_to_cart: "ADD_TO_CART",
  begin_checkout: "BEGIN_CHECKOUT",
  submit_lead_form: "SUBMIT_LEAD_FORM",
  book_appointment: "BOOK_APPOINTMENT",
  sign_up: "SIGNUP",
  subscribe: "SUBSCRIBE_PAID",
  request_quote: "REQUEST_QUOTE",
  contact: "CONTACT",
  page_view: "PAGE_VIEW",
  outbound_click: "OUTBOUND_CLICK",
  other: "DEFAULT",
};

/**
 * Opprett ÉN conversion action i klientens Google Ads-konto.
 * Krever at producer har koblet OAuth + at klientens customer_id er kjent.
 */
export async function createConversionAction(
  pool: Pool,
  opts: {
    producerUserId: string;
    clientCustomerId?: string;    // Klientens 10-sifrede Google Ads ID (MCC-sti)
    /**
     * Role Room-prosjekt-id. Hvis satt OG klienten har koblet sin egen Google
     * Ads-konto via portalen, brukes KLIENTENS token mot KLIENTENS konto
     * (uten MCC). Ellers faller vi til produsentens MCC-token + clientCustomerId.
     */
    roleRoomProjectId?: string;
    action: ConversionActionInput;
  },
): Promise<{ ok: true; result: ConversionActionResult } | { ok: false; error: string }> {
  const creds = adsOauthClientCreds("google");
  if (!creds) return { ok: false, error: "missing_oauth_creds" };

  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim();
  if (!developerToken) return { ok: false, error: "missing_developer_token" };

  const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.trim().replace(/-/g, "");
  // login-customer-id er obligatorisk når API-call-er går gjennom MCC

  // Token-resolusjon: klient-token-sti (portal-OAuth) vinner — da kjøres kallet
  // som KLIENTEN, mot KLIENTENS egen konto, UTEN MCC/login-customer-id. Ellers
  // produsentens MCC-token + clientCustomerId (eksisterende byrå-modell).
  let accessToken = "";
  let customerId = "";
  let useMcc = true;

  if (opts.roleRoomProjectId) {
    const client = await getClientAdsAccess(pool, opts.roleRoomProjectId);
    if (client?.accessToken && client.customerId) {
      accessToken = client.accessToken;
      customerId = client.customerId.replace(/-/g, "");
      useMcc = false;
    }
  }

  if (useMcc) {
    const conn = await getAdsOauthConnection(pool, opts.producerUserId, "google");
    if (!conn) return { ok: false, error: "not_connected" };
    const tokenResult = await ensureFreshAdsToken(pool, conn);
    if (tokenResult.connectionState !== "connected") {
      return { ok: false, error: "not_connected" };
    }
    accessToken = tokenResult.accessToken;
    customerId = (opts.clientCustomerId ?? "").replace(/-/g, "");
  }

  if (!accessToken || !customerId) return { ok: false, error: "missing_customer_id" };

  const url = `${GOOGLE_ADS_API_BASE}/customers/${customerId}/conversionActions:mutate`;

  const headers: Record<string, string> = {
    "Authorization": `Bearer ${accessToken}`,
    "developer-token": developerToken,
    "Content-Type": "application/json",
  };
  // login-customer-id KUN i MCC-sti (klient-token kjører mot egen konto direkte).
  if (useMcc && loginCustomerId) headers["login-customer-id"] = loginCustomerId;

  const body = {
    operations: [{
      create: {
        name: opts.action.displayName,
        type: "WEBPAGE",
        category: GOAL_CATEGORY_MAP[opts.action.goalCategory] ?? "DEFAULT",
        status: "ENABLED",
        valueSettings: {
          defaultValue: opts.action.defaultValue,
          defaultCurrencyCode: opts.action.currency || "NOK",
          alwaysUseDefaultValue: false,
        },
        countingType: "ONE_PER_CLICK",
        clickThroughLookbackWindowDays: 30,
        viewThroughLookbackWindowDays: 1,
        attributionModelSettings: {
          attributionModel: "GOOGLE_ADS_LAST_CLICK",
        },
      },
    }],
  };

  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    return { ok: false, error: `google_ads_api_error:${resp.status}:${text.slice(0, 300)}` };
  }
  const data = (await resp.json()) as {
    results?: Array<{ resourceName?: string }>;
  };
  const resourceName = data.results?.[0]?.resourceName;
  if (!resourceName) return { ok: false, error: "no_resource_name_in_response" };

  const conversionActionId = resourceName.split("/").pop() ?? "";

  // Hent tag-snippet for å trekke ut AW-ID + label
  // GET customers/{id}/conversionActions/{action_id}:tagSnippet
  // Faktisk: tag-snippet er ikke direkte API-tilgjengelig — må hente via GoogleAdsService
  // queries. Vi prøver det best vi kan.
  const tagInfo = await fetchConversionActionTag(pool, {
    producerUserId: opts.producerUserId,
    clientCustomerId: customerId,
    conversionActionId,
  });

  return {
    ok: true,
    result: {
      resourceName,
      conversionActionId,
      tagSnippet: tagInfo.tagSnippet,
      awConversionId: tagInfo.awConversionId,
      awConversionLabel: tagInfo.awConversionLabel,
    },
  };
}

// Standard konverteringer som opprettes for en klient (content/markedsføring).
// Kjøres via KLIENTENS egen token mot KLIENTENS konto (roleRoomProjectId-stien).
const DEFAULT_CLIENT_CONVERSION_ACTIONS: ConversionActionInput[] = [
  { actionName: "lead", displayName: "Lead", goalCategory: "submit_lead_form", defaultValue: 0, currency: "NOK" },
  { actionName: "contact", displayName: "Kontakt", goalCategory: "contact", defaultValue: 0, currency: "NOK" },
  { actionName: "booking", displayName: "Booking", goalCategory: "book_appointment", defaultValue: 0, currency: "NOK" },
  { actionName: "purchase", displayName: "Kjøp", goalCategory: "purchase", defaultValue: 0, currency: "NOK" },
];

export interface SyncConversionsResult {
  ok: boolean;
  created: Array<{ actionName: string; conversionActionId: string; label: string | null }>;
  skipped: string[];
  failed: Array<{ actionName: string; error: string }>;
  error?: string;
}

/**
 * Produsent-trigger (#3): oppretter standard-konverteringer i KLIENTENS Google
 * Ads-konto via klient-token-stien. Idempotent — hopper over actions som
 * allerede er opprettet (sporet i connection.profile.conversionActions).
 *
 * Dette er biten som FAKTISK kaller createConversionAction; uten den var
 * conversion-koden komplett men aldri trigget.
 */
export async function syncClientConversionActions(
  pool: Pool,
  opts: { producerUserId: string; projectId: string },
): Promise<SyncConversionsResult> {
  const { rows } = await pool.query(
    `SELECT profile FROM role_room_client_google_ads_connections
      WHERE project_id = $1 AND connection_state = 'connected' LIMIT 1`,
    [opts.projectId],
  );
  if (!rows[0]) {
    return { ok: false, created: [], skipped: [], failed: [], error: "client_google_ads_not_connected" };
  }
  const profile = (rows[0].profile && typeof rows[0].profile === "object" && !Array.isArray(rows[0].profile))
    ? rows[0].profile as Record<string, unknown>
    : {};
  const existing = Array.isArray(profile.conversionActions)
    ? profile.conversionActions as Array<{ actionName?: string; conversionActionId?: string; label?: string | null }>
    : [];
  const existingNames = new Set(existing.map((a) => a.actionName).filter(Boolean));

  const created: SyncConversionsResult["created"] = [];
  const skipped: string[] = [];
  const failed: SyncConversionsResult["failed"] = [];

  for (const action of DEFAULT_CLIENT_CONVERSION_ACTIONS) {
    if (existingNames.has(action.actionName)) {
      skipped.push(action.actionName);
      continue;
    }
    const r = await createConversionAction(pool, {
      producerUserId: opts.producerUserId,
      roleRoomProjectId: opts.projectId,
      action,
    });
    if (r.ok) {
      const entry = {
        actionName: action.actionName,
        conversionActionId: r.result.conversionActionId,
        label: r.result.awConversionLabel ?? null,
      };
      created.push(entry);
      existing.push(entry);
    } else {
      failed.push({ actionName: action.actionName, error: r.error });
    }
  }

  if (created.length > 0) {
    await pool.query(
      `UPDATE role_room_client_google_ads_connections
          SET profile = $2::jsonb, updated_at = now()
        WHERE project_id = $1`,
      [opts.projectId, JSON.stringify({ ...profile, conversionActions: existing })],
    );
  }

  return { ok: failed.length === 0, created, skipped, failed };
}

/**
 * Hent tag-snippet for en conversion-action — trekker ut AW-id + label
 * fra send_to-feltet.
 */
async function fetchConversionActionTag(
  pool: Pool,
  opts: { producerUserId: string; clientCustomerId: string; conversionActionId: string },
): Promise<{ tagSnippet: string | null; awConversionId: string | null; awConversionLabel: string | null }> {
  const creds = adsOauthClientCreds("google");
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim();
  const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.trim().replace(/-/g, "");
  if (!creds || !developerToken) return { tagSnippet: null, awConversionId: null, awConversionLabel: null };

  const conn = await getAdsOauthConnection(pool, opts.producerUserId, "google");
  if (!conn) return { tagSnippet: null, awConversionId: null, awConversionLabel: null };
  const tokenResult = await ensureFreshAdsToken(pool, conn);
  if (tokenResult.connectionState !== "connected") {
    return { tagSnippet: null, awConversionId: null, awConversionLabel: null };
  }

  // Query: SELECT conversion_action.tag_snippets FROM conversion_action WHERE id = X
  const query = `SELECT conversion_action.tag_snippets FROM conversion_action WHERE conversion_action.id = ${opts.conversionActionId}`;
  const url = `${GOOGLE_ADS_API_BASE}/customers/${opts.clientCustomerId}/googleAds:search`;
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${tokenResult.accessToken}`,
    "developer-token": developerToken,
    "Content-Type": "application/json",
  };
  if (loginCustomerId) headers["login-customer-id"] = loginCustomerId;

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ query }),
    });
    if (!resp.ok) return { tagSnippet: null, awConversionId: null, awConversionLabel: null };
    const data = (await resp.json()) as {
      results?: Array<{ conversionAction?: { tagSnippets?: Array<{ eventSnippet?: string }> } }>;
    };
    const snippets = data.results?.[0]?.conversionAction?.tagSnippets ?? [];
    const eventSnippet = snippets[0]?.eventSnippet ?? null;
    if (!eventSnippet) return { tagSnippet: null, awConversionId: null, awConversionLabel: null };

    // Trekk ut AW-XXX/LABEL fra send_to
    const m = eventSnippet.match(/'send_to':\s*'(AW-\d+)\/([A-Za-z0-9_-]+)'/);
    return {
      tagSnippet: eventSnippet,
      awConversionId: m?.[1] ?? null,
      awConversionLabel: m?.[2] ?? null,
    };
  } catch {
    return { tagSnippet: null, awConversionId: null, awConversionLabel: null };
  }
}
