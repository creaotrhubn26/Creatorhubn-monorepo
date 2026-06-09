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

// ─────────────────────────────────────────────────────────────────────
// Lead Management — TikTok Lead Ads
// Henter leads fra /page/list/ + /page/lead/list/ og lagrer i
// tiktok_lead_records-tabellen (migrate 261).
// ─────────────────────────────────────────────────────────────────────

export interface TiktokLeadForm {
  formId: string;
  formName: string;
  createdAt?: string;
  leadCount?: number;
}

export async function listTiktokLeadForms(
  pool: Pool,
  opts: { producerUserId: string; advertiserId: string },
): Promise<{ ok: true; forms: TiktokLeadForm[] } | { ok: false; error: string }> {
  const access = await tiktokToken(pool, opts.producerUserId);
  if (!access) return { ok: false, error: "not_connected" };

  const r = await fetch(
    `${TIKTOK_BUSINESS_BASE}/page/list/?advertiser_id=${encodeURIComponent(opts.advertiserId)}`,
    { headers: ttHeaders(access) },
  );
  if (!r.ok) return { ok: false, error: `listPages HTTP ${r.status}` };
  const body = await r.json() as {
    data?: { list?: Array<{ page_id: string; page_name: string; create_time?: string; lead_count?: number }> };
    code?: number;
    message?: string;
  };
  if (body.code !== 0) return { ok: false, error: body.message ?? "listPages failed" };
  return {
    ok: true,
    forms: (body.data?.list ?? []).map((p) => ({
      formId: p.page_id,
      formName: p.page_name,
      createdAt: p.create_time,
      leadCount: p.lead_count,
    })),
  };
}

/** Hent leads fra TikTok + lagre i tiktok_lead_records. Returnerer
 *  antall nye + oppdaterte. Bruker last_synced_at fra sync-jobben
 *  som baseline for inkrementell sync. */
export async function syncTiktokLeads(
  pool: Pool,
  opts: {
    producerUserId: string;
    advertiserId: string;
    formId: string;
    configId?: string | null;          // NULL = Marketing Cockpit (egen)
    sinceMs?: number;                  // For paginering
  },
): Promise<
  | { ok: true; fetched: number; inserted: number; updated: number }
  | { ok: false; error: string }
> {
  const access = await tiktokToken(pool, opts.producerUserId);
  if (!access) return { ok: false, error: "not_connected" };

  const sinceMs = opts.sinceMs ?? (Date.now() - 7 * 24 * 60 * 60 * 1000); // siste 7 dager default
  const url = `${TIKTOK_BUSINESS_BASE}/page/lead/list/?advertiser_id=${encodeURIComponent(opts.advertiserId)}&page_id=${encodeURIComponent(opts.formId)}&filtering=${encodeURIComponent(JSON.stringify({ start_time: Math.floor(sinceMs / 1000) }))}`;

  const r = await fetch(url, { headers: ttHeaders(access) });
  if (!r.ok) return { ok: false, error: `lead/list HTTP ${r.status}` };
  const body = await r.json() as {
    data?: {
      list?: Array<{
        lead_id: string;
        create_time: string;
        fields?: Array<{ field_name: string; field_value: string }>;
      }>;
    };
    code?: number;
    message?: string;
  };
  if (body.code !== 0) return { ok: false, error: body.message ?? "lead/list failed" };

  const leads = body.data?.list ?? [];
  let inserted = 0;
  let updated = 0;

  for (const lead of leads) {
    const fields = new Map<string, string>();
    for (const f of (lead.fields ?? [])) {
      fields.set(f.field_name.toLowerCase(), f.field_value);
    }
    const email = fields.get("email") ?? null;
    const phone = fields.get("phone") ?? fields.get("phone_number") ?? null;
    const fullName = fields.get("full_name") ?? fields.get("name") ?? null;
    // De resterende feltene → custom_fields-JSONB
    const custom: Record<string, string> = {};
    for (const [k, v] of fields) {
      if (!["email", "phone", "phone_number", "full_name", "name"].includes(k)) {
        custom[k] = v;
      }
    }

    const res = await pool.query(
      `INSERT INTO tiktok_lead_records (
         config_id, producer_user_id, advertiser_id, form_id, tiktok_lead_id,
         email, phone, full_name, custom_fields, lead_created_at, synced_at
       )
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, now())
       ON CONFLICT (tiktok_lead_id) DO UPDATE
         SET email = COALESCE(EXCLUDED.email, tiktok_lead_records.email),
             phone = COALESCE(EXCLUDED.phone, tiktok_lead_records.phone),
             full_name = COALESCE(EXCLUDED.full_name, tiktok_lead_records.full_name),
             custom_fields = EXCLUDED.custom_fields,
             synced_at = now(),
             updated_at = now()
       RETURNING (xmax = 0) AS inserted`,
      [
        opts.configId ?? null,
        opts.producerUserId,
        opts.advertiserId,
        opts.formId,
        lead.lead_id,
        email,
        phone,
        fullName,
        JSON.stringify(custom),
        new Date(parseInt(lead.create_time, 10) * 1000),
      ],
    );
    if (res.rows[0]?.inserted) inserted++;
    else updated++;
  }

  // Oppdater sync-jobb
  await pool.query(
    `INSERT INTO tiktok_lead_sync_jobs (config_id, producer_user_id, advertiser_id, form_id, last_synced_at, last_lead_created_at)
     VALUES ($1::uuid, $2::uuid, $3, $4, now(), now())
     ON CONFLICT (advertiser_id, form_id) DO UPDATE
       SET last_synced_at = now(), last_error = NULL, updated_at = now()`,
    [opts.configId ?? null, opts.producerUserId, opts.advertiserId, opts.formId],
  ).catch(() => {});

  return { ok: true, fetched: leads.length, inserted, updated };
}

// ─────────────────────────────────────────────────────────────────────
// Audience Management — Custom Audiences
// ─────────────────────────────────────────────────────────────────────

export interface TiktokAudience {
  audienceId: string;
  name: string;
  type: string;
  size?: number;
  matchRate?: number;
  status: string;
}

export async function listTiktokAudiences(
  pool: Pool,
  opts: { producerUserId: string; advertiserId: string },
): Promise<{ ok: true; audiences: TiktokAudience[] } | { ok: false; error: string }> {
  const access = await tiktokToken(pool, opts.producerUserId);
  if (!access) return { ok: false, error: "not_connected" };

  const r = await fetch(
    `${TIKTOK_BUSINESS_BASE}/dmp/custom_audience/list/?advertiser_id=${encodeURIComponent(opts.advertiserId)}`,
    { headers: ttHeaders(access) },
  );
  if (!r.ok) return { ok: false, error: `audience/list HTTP ${r.status}` };
  const body = await r.json() as {
    data?: { list?: Array<{ audience_id: string; name: string; calculate_type: string; cover_num?: number; calculate_rate?: number; audience_status: string }> };
    code?: number;
    message?: string;
  };
  if (body.code !== 0) return { ok: false, error: body.message ?? "audience/list failed" };
  return {
    ok: true,
    audiences: (body.data?.list ?? []).map((a) => ({
      audienceId: a.audience_id,
      name: a.name,
      type: a.calculate_type,
      size: a.cover_num,
      matchRate: a.calculate_rate ? Number(a.calculate_rate) : undefined,
      status: a.audience_status,
    })),
  };
}

import crypto from "node:crypto";

/** Hashe e-post-/telefon-liste SHA256 (lowercase, trimmed) — TikTok kraver det. */
function hashIdentifier(value: string): string {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

/** Opprett custom audience. Tar liste med rå e-post/telefon — hashes klient-side
 *  før send til TikTok. */
export async function createTiktokAudience(
  pool: Pool,
  opts: {
    producerUserId: string;
    advertiserId: string;
    name: string;
    sourceDescription?: string;
    identifiers: Array<{ email?: string; phone?: string }>;
    configId?: string | null;
  },
): Promise<
  | { ok: true; audienceId: string; uploadCount: number }
  | { ok: false; error: string }
> {
  const access = await tiktokToken(pool, opts.producerUserId);
  if (!access) return { ok: false, error: "not_connected" };

  // 1) Bygg fil-payload — TikTok forventer hashed identifiers
  const rows: string[] = ["email,phone"];
  for (const id of opts.identifiers) {
    const hashedEmail = id.email ? hashIdentifier(id.email) : "";
    const hashedPhone = id.phone ? hashIdentifier(id.phone) : "";
    if (hashedEmail || hashedPhone) {
      rows.push(`${hashedEmail},${hashedPhone}`);
    }
  }
  const csvContent = rows.join("\n");
  const fileName = `${opts.name.replace(/[^a-zA-Z0-9_-]/g, "_")}_${Date.now()}.csv`;

  // 2) Upload file
  const fileUploadUrl = `${TIKTOK_BUSINESS_BASE}/dmp/custom_audience/file/upload/`;
  const formData = new FormData();
  formData.append("advertiser_id", opts.advertiserId);
  formData.append("file_signature", crypto.createHash("md5").update(csvContent).digest("hex"));
  formData.append("file", new Blob([csvContent], { type: "text/csv" }), fileName);

  const uploadR = await fetch(fileUploadUrl, {
    method: "POST",
    headers: { "Access-Token": access },
    body: formData,
  });
  if (!uploadR.ok) return { ok: false, error: `file/upload HTTP ${uploadR.status}` };
  const uploadBody = await uploadR.json() as { data?: { file_id?: string }; code?: number; message?: string };
  if (uploadBody.code !== 0 || !uploadBody.data?.file_id) {
    return { ok: false, error: uploadBody.message ?? "file/upload failed" };
  }

  // 3) Create audience
  const createR = await fetch(`${TIKTOK_BUSINESS_BASE}/dmp/custom_audience/create/`, {
    method: "POST",
    headers: ttHeaders(access),
    body: JSON.stringify({
      advertiser_id: opts.advertiserId,
      custom_audience_name: opts.name,
      file_paths: [uploadBody.data.file_id],
      calculate_type: "CUSTOMER_FILE",
    }),
  });
  if (!createR.ok) return { ok: false, error: `audience/create HTTP ${createR.status}` };
  const createBody = await createR.json() as { data?: { audience_id?: string }; code?: number; message?: string };
  if (createBody.code !== 0 || !createBody.data?.audience_id) {
    return { ok: false, error: createBody.message ?? "audience/create failed" };
  }

  // 4) Lagre i vår tabell
  await pool.query(
    `INSERT INTO tiktok_custom_audiences (
       config_id, producer_user_id, advertiser_id, tiktok_audience_id,
       audience_name, audience_type, source_description, upload_count, status
     ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, 'CUSTOMER_FILE', $6, $7, 'processing')
     ON CONFLICT (tiktok_audience_id) DO NOTHING`,
    [
      opts.configId ?? null,
      opts.producerUserId,
      opts.advertiserId,
      createBody.data.audience_id,
      opts.name,
      opts.sourceDescription ?? null,
      opts.identifiers.length,
    ],
  ).catch(() => {});

  return {
    ok: true,
    audienceId: createBody.data.audience_id,
    uploadCount: opts.identifiers.length,
  };
}
