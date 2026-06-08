/**
 * client-tiktok-suite.ts
 *
 * TikTok-parity til Google/LinkedIn/Meta:
 *   - List producerens TikTok advertisers (Business Center)
 *   - List eksisterende Pixels per advertiser
 *   - Provision Pixel (TikTok Pixel/Events SDK)
 *   - Opprett pixel-events per action (standard events: CompletePayment,
 *     SubmitForm, CompleteRegistration, …)
 *   - Hent reporting-metrics (impressions/clicks/spend/conversions)
 *   - Events API (CAPI) — server-side conversion-events
 *
 * Bruker TikTok Business API:
 *   https://business-api.tiktok.com/open_api/v1.3/
 *
 * OAuth lagres i role_room_ads_oauth_connections med platform='tiktok'.
 * TikTok gir LANG-LIVED access-tokens (typisk 1 år) og IKKE refresh-token —
 * det er fine.
 */

import type { Pool } from "pg";

const TIKTOK_BUSINESS_BASE = "https://business-api.tiktok.com/open_api/v1.3";
const TIKTOK_AUTH_URL = "https://business-api.tiktok.com/portal/auth";

// ─────────────────────────────────────────────────────────────────────
// OAuth helpers (litt avvik fra Google/LinkedIn — TikTok bruker app_id
// / secret heller enn client_id / client_secret, og auth_code → token
// kjøres mot /oauth2/access_token/ med POST-body).
// ─────────────────────────────────────────────────────────────────────

interface TiktokOauthCreds {
  appId: string;
  appSecret: string;
}

export function tiktokOauthCreds(): TiktokOauthCreds | null {
  const appId = process.env.TIKTOK_BUSINESS_APP_ID?.trim();
  const appSecret = process.env.TIKTOK_BUSINESS_APP_SECRET?.trim();
  if (!appId || !appSecret) return null;
  return { appId, appSecret };
}

export function buildTiktokAuthUrl(opts: { state: string; redirectUri: string }): string | null {
  const creds = tiktokOauthCreds();
  if (!creds) return null;
  const params = new URLSearchParams({
    app_id: creds.appId,
    state: opts.state,
    redirect_uri: opts.redirectUri,
  });
  return `${TIKTOK_AUTH_URL}?${params.toString()}`;
}

/** Bytte auth-code for access-token. TikTok returnerer data.access_token +
 *  data.advertiser_ids[]. Ingen refresh-token. */
export async function exchangeTiktokAuthCode(
  authCode: string,
): Promise<{ accessToken: string; advertiserIds: string[] } | null> {
  const creds = tiktokOauthCreds();
  if (!creds) return null;

  const r = await fetch(`${TIKTOK_BUSINESS_BASE}/oauth2/access_token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_id: creds.appId,
      secret: creds.appSecret,
      auth_code: authCode,
    }),
  });
  if (!r.ok) return null;
  const body = await r.json() as { data?: { access_token?: string; advertiser_ids?: string[] }; code?: number; message?: string };
  if (body.code !== 0 || !body.data?.access_token) return null;
  return {
    accessToken: body.data.access_token,
    advertiserIds: body.data.advertiser_ids ?? [],
  };
}

/** Hent producerens TikTok access-token fra DB. */
async function tiktokToken(pool: Pool, producerUserId: string): Promise<string | null> {
  // TikTok-tokens lagres med platform='tiktok' i role_room_ads_oauth_connections.
  // Tabellen krypterer access_token med samme nøkkel som Google/LinkedIn.
  const r = await pool.query(
    `SELECT access_token, connection_state
       FROM role_room_ads_oauth_connections
      WHERE user_id = $1 AND platform = 'tiktok'
      ORDER BY last_refreshed_at DESC NULLS LAST, created_at DESC
      LIMIT 1`,
    [producerUserId],
  ).catch(() => ({ rows: [] }));
  const row = r.rows[0];
  if (!row || row.connection_state !== "connected") return null;
  return row.access_token as string;
}

function ttHeaders(accessToken: string): Record<string, string> {
  return {
    "Access-Token": accessToken,
    "Content-Type": "application/json",
  };
}

// ─────────────────────────────────────────────────────────────────────
// Advertisers
// ─────────────────────────────────────────────────────────────────────

export async function listTiktokAdvertisers(
  pool: Pool,
  producerUserId: string,
): Promise<{ ok: true; advertisers: Array<{ id: string; name: string; currency: string; timezone?: string }> } | { ok: false; error: string }> {
  const access = await tiktokToken(pool, producerUserId);
  if (!access) return { ok: false, error: "not_connected" };
  const creds = tiktokOauthCreds();
  if (!creds) return { ok: false, error: "missing_app_creds" };

  // Steg 1: hent advertiser-IDs producer har tilgang til
  const idsR = await fetch(
    `${TIKTOK_BUSINESS_BASE}/oauth2/advertiser/get/?app_id=${encodeURIComponent(creds.appId)}&secret=${encodeURIComponent(creds.appSecret)}`,
    { headers: ttHeaders(access) },
  );
  if (!idsR.ok) return { ok: false, error: `listAdvertisers HTTP ${idsR.status}` };
  const idsBody = await idsR.json() as { data?: { list?: Array<{ advertiser_id: string; advertiser_name: string }> }; code?: number; message?: string };
  if (idsBody.code !== 0) return { ok: false, error: idsBody.message ?? "TikTok-feil" };

  const advertiserIds = (idsBody.data?.list ?? []).map((x) => x.advertiser_id);
  if (advertiserIds.length === 0) return { ok: true, advertisers: [] };

  // Steg 2: hent detaljer (currency, tz)
  const detailsR = await fetch(
    `${TIKTOK_BUSINESS_BASE}/advertiser/info/?advertiser_ids=${encodeURIComponent(JSON.stringify(advertiserIds))}`,
    { headers: ttHeaders(access) },
  );
  const detailsBody = detailsR.ok ? await detailsR.json() as any : { data: { list: [] } };
  const detailsMap = new Map<string, any>();
  for (const d of (detailsBody.data?.list ?? [])) detailsMap.set(String(d.advertiser_id), d);

  return {
    ok: true,
    advertisers: (idsBody.data?.list ?? []).map((a) => {
      const d = detailsMap.get(a.advertiser_id);
      return {
        id: a.advertiser_id,
        name: a.advertiser_name,
        currency: d?.currency ?? "NOK",
        timezone: d?.timezone,
      };
    }),
  };
}

// ─────────────────────────────────────────────────────────────────────
// Pixels
// ─────────────────────────────────────────────────────────────────────

export async function listTiktokPixels(
  pool: Pool,
  opts: { producerUserId: string; advertiserId: string },
): Promise<{ ok: true; pixels: Array<{ code: string; name: string; createdAt?: string }> } | { ok: false; error: string }> {
  const access = await tiktokToken(pool, opts.producerUserId);
  if (!access) return { ok: false, error: "not_connected" };

  const url = `${TIKTOK_BUSINESS_BASE}/pixel/list/?advertiser_id=${encodeURIComponent(opts.advertiserId)}`;
  const r = await fetch(url, { headers: ttHeaders(access) });
  if (!r.ok) return { ok: false, error: `listPixels HTTP ${r.status}` };
  const body = await r.json() as { data?: { pixels?: Array<{ pixel_code: string; pixel_name: string; create_time?: string }> }; code?: number; message?: string };
  if (body.code !== 0) return { ok: false, error: body.message ?? "TikTok-feil" };
  return {
    ok: true,
    pixels: (body.data?.pixels ?? []).map((p) => ({
      code: p.pixel_code,
      name: p.pixel_name,
      createdAt: p.create_time,
    })),
  };
}

export async function provisionTiktokPixel(
  pool: Pool,
  opts: { producerUserId: string; advertiserId: string; pixelName: string },
): Promise<
  | { ok: true; pixelCode: string; pixelName: string; baseCode: string }
  | { ok: false; error: string }
> {
  const access = await tiktokToken(pool, opts.producerUserId);
  if (!access) return { ok: false, error: "not_connected" };

  const r = await fetch(`${TIKTOK_BUSINESS_BASE}/pixel/create/`, {
    method: "POST",
    headers: ttHeaders(access),
    body: JSON.stringify({
      advertiser_id: opts.advertiserId,
      pixel_name: opts.pixelName,
      pixel_category: "OTHER",
    }),
  });
  if (!r.ok) return { ok: false, error: `createPixel HTTP ${r.status}` };
  const body = await r.json() as { data?: { pixel_code?: string }; code?: number; message?: string };
  if (body.code !== 0 || !body.data?.pixel_code) {
    return { ok: false, error: body.message ?? "createPixel feilet" };
  }
  return {
    ok: true,
    pixelCode: body.data.pixel_code,
    pixelName: opts.pixelName,
    baseCode: buildTiktokPixelBaseCode(body.data.pixel_code),
  };
}

function buildTiktokPixelBaseCode(pixelCode: string): string {
  return `<!-- TikTok Pixel Code Start — RR Agent -->
<script>
!function (w, d, t) {
  w.TiktokAnalyticsObject=t;
  var ttq=w[t]=w[t]||[];
  ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"];
  ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
  for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
  ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};
  ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js";
    var o=n&&n.partner;
    ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=r;
    ttq._t=ttq._t||{};ttq._t[e]=+new Date;
    ttq._o=ttq._o||{};ttq._o[e]=n||{};
    var s=d.createElement("script");
    s.type="text/javascript";s.async=!0;s.src=r+"?sdkid="+e+"&lib=ttq";
    var first=d.getElementsByTagName("script")[0];
    first.parentNode.insertBefore(s,first)
  };
  ttq.load('${pixelCode}');
  ttq.page();
}(window,document,'ttq');
</script>
<!-- TikTok Pixel Code End -->`;
}

// ─────────────────────────────────────────────────────────────────────
// Events per action — sync vår goal_category → TikTok standard events
// ─────────────────────────────────────────────────────────────────────

const TIKTOK_EVENT_MAP: Record<string, string> = {
  purchase: "CompletePayment",
  add_to_cart: "AddToCart",
  begin_checkout: "InitiateCheckout",
  submit_lead_form: "SubmitForm",
  book_appointment: "Subscribe",
  sign_up: "CompleteRegistration",
  subscribe: "Subscribe",
  request_quote: "SubmitForm",
  contact: "Contact",
  page_view: "ViewContent",
  outbound_click: "ClickButton",
  other: "CustomEvent",
};

/** TikTok Events API tillater å rapportere custom-events via API.
 *  For pure pixel-tracking trenger vi ikke å "opprette" eventene i forveien —
 *  bare fyre `ttq.track('CompletePayment', {...})` med riktig navn så
 *  registreres det automatisk. Vi returnerer event-navnet så vi kan lagre
 *  det per action.
 */
export function mapActionToTiktokEvent(action: { goalCategory: string; actionName: string }): string {
  return TIKTOK_EVENT_MAP[action.goalCategory] ?? "CustomEvent";
}

// ─────────────────────────────────────────────────────────────────────
// Reporting
// ─────────────────────────────────────────────────────────────────────

export interface TiktokAdsMetrics {
  spend: number;
  currency: string;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  costPerConversion: number;
  topCampaigns: Array<{ campaignName: string; spend: number; clicks: number; conversions: number }>;
  dailyTrend: Array<{ date: string; spend: number; clicks: number; conversions: number }>;
}

export async function fetchTiktokAdsMetrics(
  pool: Pool,
  opts: { producerUserId: string; advertiserId: string; startDate: string; endDate: string },
): Promise<TiktokAdsMetrics | null> {
  const access = await tiktokToken(pool, opts.producerUserId);
  if (!access) return null;

  const baseBody = {
    advertiser_id: opts.advertiserId,
    report_type: "BASIC",
    data_level: "AUCTION_ADVERTISER",
    dimensions: ["advertiser_id"],
    metrics: ["spend", "impressions", "clicks", "conversion", "ctr", "cpc"],
    start_date: opts.startDate,
    end_date: opts.endDate,
  };

  const mainR = await fetch(`${TIKTOK_BUSINESS_BASE}/report/integrated/get/`, {
    method: "POST",
    headers: ttHeaders(access),
    body: JSON.stringify(baseBody),
  });
  if (!mainR.ok) return null;
  const mainBody = await mainR.json() as { data?: { list?: Array<{ metrics?: any }> }; code?: number };
  if (mainBody.code !== 0) return null;
  const m = mainBody.data?.list?.[0]?.metrics ?? {};
  const spend = parseFloat(String(m.spend ?? "0"));
  const impressions = Number(m.impressions ?? 0);
  const clicks = Number(m.clicks ?? 0);
  const conversions = Number(m.conversion ?? 0);
  const ctr = parseFloat(String(m.ctr ?? "0")) / 100;
  const cpc = parseFloat(String(m.cpc ?? "0"));

  // Per kampanje
  const campaignR = await fetch(`${TIKTOK_BUSINESS_BASE}/report/integrated/get/`, {
    method: "POST",
    headers: ttHeaders(access),
    body: JSON.stringify({
      ...baseBody,
      data_level: "AUCTION_CAMPAIGN",
      dimensions: ["campaign_id"],
      metrics: ["campaign_name", "spend", "clicks", "conversion"],
    }),
  });
  const campaignBody = campaignR.ok ? await campaignR.json() as any : { data: { list: [] } };
  const topCampaigns = ((campaignBody.data?.list ?? []) as any[])
    .map((c: any) => ({
      campaignName: c.metrics?.campaign_name ?? "(unnamed)",
      spend: parseFloat(String(c.metrics?.spend ?? "0")),
      clicks: Number(c.metrics?.clicks ?? 0),
      conversions: Number(c.metrics?.conversion ?? 0),
    }))
    .sort((a: any, b: any) => b.spend - a.spend)
    .slice(0, 5);

  // Daglig trend
  const trendR = await fetch(`${TIKTOK_BUSINESS_BASE}/report/integrated/get/`, {
    method: "POST",
    headers: ttHeaders(access),
    body: JSON.stringify({
      ...baseBody,
      dimensions: ["advertiser_id", "stat_time_day"],
    }),
  });
  const trendBody = trendR.ok ? await trendR.json() as any : { data: { list: [] } };
  const dailyTrend = ((trendBody.data?.list ?? []) as any[]).map((d: any) => ({
    date: String(d.dimensions?.stat_time_day ?? "").slice(0, 10),
    spend: parseFloat(String(d.metrics?.spend ?? "0")),
    clicks: Number(d.metrics?.clicks ?? 0),
    conversions: Number(d.metrics?.conversion ?? 0),
  }));

  return {
    spend,
    currency: "NOK",
    impressions,
    clicks,
    conversions,
    ctr,
    cpc,
    costPerConversion: conversions > 0 ? spend / conversions : 0,
    topCampaigns,
    dailyTrend,
  };
}
