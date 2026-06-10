/**
 * client-linkedin-suite.ts
 *
 * LinkedIn-parity til Google-suiten:
 *   - List producerens LinkedIn Ad Accounts
 *   - Opprett (eller hente) Insight Tag per klient
 *   - Opprett Conversion Rules per action (mappet til Insight Tag)
 *   - Hent Ads Reporting (impressions/clicks/spend/conversions)
 *
 * Bruker producerens LinkedIn OAuth-tilkobling (lagret i
 * role_room_ads_oauth_connections via platform='linkedin' og scopes
 * r_ads + r_ads_reporting + rw_ads).
 *
 * LinkedIn-API: https://api.linkedin.com/rest/...
 * Versjons-header: LinkedIn-Version: 202410 (oppdateres månedlig)
 */

import type { Pool } from "pg";
import {
  ensureFreshAdsToken,
  getAdsOauthConnection,
} from "./role-room-ads-oauth.js";

const LINKEDIN_REST_BASE = "https://api.linkedin.com/rest";
const LINKEDIN_VERSION = "202410";

async function token(pool: Pool, producerUserId: string): Promise<string | null> {
  const conn = await getAdsOauthConnection(pool, producerUserId, "linkedin");
  if (!conn) return null;
  const t = await ensureFreshAdsToken(pool, conn);
  return t.connectionState === "connected" ? t.accessToken : null;
}

function liHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "X-Restli-Protocol-Version": "2.0.0",
    "LinkedIn-Version": LINKEDIN_VERSION,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Ad Accounts
// ─────────────────────────────────────────────────────────────────────

export async function listLinkedinAdAccounts(
  pool: Pool,
  producerUserId: string,
): Promise<{ ok: true; accounts: Array<{ id: string; urn: string; name: string; currency: string }> } | { ok: false; error: string }> {
  const access = await token(pool, producerUserId);
  if (!access) return { ok: false, error: "not_connected" };

  const url = `${LINKEDIN_REST_BASE}/adAccounts?q=search&search.status.values[0]=ACTIVE`;
  const r = await fetch(url, { headers: liHeaders(access) });
  if (!r.ok) return { ok: false, error: `listAccounts HTTP ${r.status}` };
  const body = await r.json() as {
    elements?: Array<{ id: number | string; name: string; currency: string }>;
  };
  return {
    ok: true,
    accounts: (body.elements ?? []).map((a) => ({
      id: String(a.id),
      urn: `urn:li:sponsoredAccount:${a.id}`,
      name: a.name ?? "(unnamed)",
      currency: a.currency ?? "NOK",
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────
// Insight Tag — én per klient
// ─────────────────────────────────────────────────────────────────────

/** Opprett LinkedIn Insight Tag (det globale snippet-pixelet).
 *  En adAccount kan ha flere Insight Tags. Vi bygger én per klient og
 *  navngir den så vi gjenkjenner den senere.
 */
export async function provisionLinkedinInsightTag(
  pool: Pool,
  opts: {
    producerUserId: string;
    adAccountUrn: string;       // urn:li:sponsoredAccount:1234567890
    clientName: string;
    websiteUrl: string;
  },
): Promise<
  | { ok: true; insightTagId: number; partnerId: number; tagSnippet: string }
  | { ok: false; error: string }
> {
  const access = await token(pool, opts.producerUserId);
  if (!access) return { ok: false, error: "not_connected" };

  // 1) Sjekk om det finnes en eksisterende Insight Tag på account-en (vi
  //    vil gjenbruke i stedet for å lage duplikat).
  const accountId = opts.adAccountUrn.split(":").pop()!;
  const existingR = await fetch(
    `${LINKEDIN_REST_BASE}/adAccounts/${accountId}/insightTags?q=adAccount`,
    { headers: liHeaders(access) },
  );
  if (existingR.ok) {
    const existing = await existingR.json() as { elements?: Array<{ id: number; partnerId: number; name: string }> };
    const match = existing.elements?.find((t) => t.name?.startsWith(`RR-Agent: ${opts.clientName}`));
    if (match) {
      return {
        ok: true,
        insightTagId: match.id,
        partnerId: match.partnerId,
        tagSnippet: buildInsightTagSnippet(match.partnerId),
      };
    }
  }

  // 2) Opprett ny Insight Tag
  const body = {
    name: `RR-Agent: ${opts.clientName}`,
    type: "WEBSITE",
    domains: [(() => { try { return new URL(opts.websiteUrl).hostname; } catch { return opts.websiteUrl; } })()],
    account: opts.adAccountUrn,
  };
  const r = await fetch(`${LINKEDIN_REST_BASE}/insightTags`, {
    method: "POST",
    headers: liHeaders(access),
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text();
    return { ok: false, error: `createInsightTag HTTP ${r.status} — ${t.slice(0, 200)}` };
  }
  const created = await r.json() as { id: number; partnerId: number };
  return {
    ok: true,
    insightTagId: created.id,
    partnerId: created.partnerId,
    tagSnippet: buildInsightTagSnippet(created.partnerId),
  };
}

/** Bygg JS-snippet klient skal lime inn i <head>. */
function buildInsightTagSnippet(partnerId: number): string {
  return `<!-- LinkedIn Insight Tag — RR Agent -->
<script type="text/javascript">
  _linkedin_partner_id = "${partnerId}";
  window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
  window._linkedin_data_partner_ids.push(_linkedin_partner_id);
</script>
<script type="text/javascript">
  (function(l) {
    if (!l) {
      window.lintrk = function(a, b) { window.lintrk.q.push([a, b]); };
      window.lintrk.q = [];
    }
    var s = document.getElementsByTagName("script")[0];
    var b = document.createElement("script");
    b.type = "text/javascript"; b.async = true;
    b.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js";
    s.parentNode.insertBefore(b, s);
  })(window.lintrk);
</script>
<noscript>
  <img height="1" width="1" style="display:none;" alt=""
       src="https://px.ads.linkedin.com/collect/?pid=${partnerId}&fmt=gif" />
</noscript>`;
}

// ─────────────────────────────────────────────────────────────────────
// Conversion Rules — én per action
// ─────────────────────────────────────────────────────────────────────

/** LinkedIn `conversionMethod` enum-mapping. */
const LINKEDIN_CONVERSION_METHOD_MAP: Record<string, string> = {
  page_load: "PIXEL",
  form_submit: "PIXEL",
  click: "PIXEL",
  event: "PIXEL",
  outbound: "PIXEL",
  manual: "CONVERSIONS_API",
};

/** LinkedIn `type` enum (matchet til goal_category). */
const LINKEDIN_TYPE_MAP: Record<string, string> = {
  purchase: "PURCHASE",
  add_to_cart: "ADD_TO_CART",
  begin_checkout: "ADD_TO_CART",
  submit_lead_form: "LEAD",
  book_appointment: "BOOK_APPOINTMENT",
  sign_up: "SIGN_UP",
  subscribe: "SIGN_UP",
  request_quote: "LEAD",
  contact: "CONTACT_REQUEST",
  page_view: "KEY_PAGE_VIEW",
  outbound_click: "DOWNLOAD",
  other: "OTHER",
};

export async function createLinkedinConversion(
  pool: Pool,
  opts: {
    producerUserId: string;
    insightTagId: number;
    adAccountUrn: string;
    action: {
      actionName: string;
      displayName: string;
      goalCategory: string;
      defaultValue: number;
      currency: string;
      triggerType: string;
      urlPattern?: string | null;
    };
  },
): Promise<
  | { ok: true; conversionId: number; conversionUrn: string }
  | { ok: false; error: string }
> {
  const access = await token(pool, opts.producerUserId);
  if (!access) return { ok: false, error: "not_connected" };

  const method = LINKEDIN_CONVERSION_METHOD_MAP[opts.action.triggerType] ?? "PIXEL";
  const conversionType = LINKEDIN_TYPE_MAP[opts.action.goalCategory] ?? "OTHER";

  const body: Record<string, unknown> = {
    name: opts.action.displayName,
    type: conversionType,
    enabled: true,
    conversionMethod: method,
    postClickAttributionWindowSize: 30,
    viewThroughAttributionWindowSize: 7,
    attributionType: "LAST_TOUCH_BY_CAMPAIGN",
    associatedCampaigns: [],
    insightTags: [`urn:li:insightTag:${opts.insightTagId}`],
    account: opts.adAccountUrn,
  };
  if (opts.action.defaultValue > 0) {
    body.value = {
      currencyCode: opts.action.currency || "NOK",
      amount: String(opts.action.defaultValue),
    };
  }
  if (method === "PIXEL" && opts.action.urlPattern) {
    body.urlRules = [{
      matchType: opts.action.urlPattern.includes("*") ? "CONTAINS" : "EQUALS",
      urlMatchValue: opts.action.urlPattern,
    }];
  }

  const r = await fetch(`${LINKEDIN_REST_BASE}/conversions`, {
    method: "POST",
    headers: liHeaders(access),
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text();
    return { ok: false, error: `createConversion HTTP ${r.status} — ${t.slice(0, 200)}` };
  }
  const createdId = r.headers.get("x-linkedin-id") || (await r.json().catch(() => ({})) as { id?: number }).id;
  if (!createdId) return { ok: false, error: "missing conversion id in response" };
  const idNum = typeof createdId === "string" ? parseInt(createdId, 10) : createdId;
  return {
    ok: true,
    conversionId: idNum,
    conversionUrn: `urn:li:conversion:${idNum}`,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Ads Reporting (for insights-dashboard)
// ─────────────────────────────────────────────────────────────────────

export interface LinkedinAdsMetrics {
  spend: number;
  currency: string;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  avgCpc: number;
  costPerConversion: number;
  topCampaigns: Array<{ campaignName: string; spend: number; clicks: number; conversions: number }>;
  dailyTrend: Array<{ date: string; spend: number; clicks: number; conversions: number }>;
}

export async function fetchLinkedinAdsMetrics(
  pool: Pool,
  opts: {
    producerUserId: string;
    adAccountUrn: string;
    startDate: string; // YYYY-MM-DD
    endDate: string;   // YYYY-MM-DD
  },
): Promise<LinkedinAdsMetrics | null> {
  const access = await token(pool, opts.producerUserId);
  if (!access) return null;

  // LinkedIn Reporting krever start/end-formattering som start.year=2026&start.month=6&start.day=1
  const splitDate = (d: string) => {
    const [y, m, day] = d.split("-").map((n) => parseInt(n, 10));
    return { year: y, month: m, day };
  };
  const s = splitDate(opts.startDate);
  const e = splitDate(opts.endDate);

  const queryBase = new URLSearchParams({
    q: "analytics",
    pivot: "ACCOUNT",
    timeGranularity: "ALL",
    "dateRange.start.day": String(s.day),
    "dateRange.start.month": String(s.month),
    "dateRange.start.year": String(s.year),
    "dateRange.end.day": String(e.day),
    "dateRange.end.month": String(e.month),
    "dateRange.end.year": String(e.year),
    "accounts[0]": opts.adAccountUrn,
    fields: "impressions,clicks,costInLocalCurrency,externalWebsiteConversions",
  });

  const mainR = await fetch(
    `${LINKEDIN_REST_BASE}/adAnalytics?${queryBase.toString()}`,
    { headers: liHeaders(access) },
  );
  if (!mainR.ok) return null;
  const mainBody = await mainR.json() as { elements?: Array<{ impressions?: number; clicks?: number; costInLocalCurrency?: string; externalWebsiteConversions?: number }> };
  const main = mainBody.elements?.[0] ?? {};
  const spend = parseFloat(String(main.costInLocalCurrency ?? "0"));
  const impressions = Number(main.impressions ?? 0);
  const clicks = Number(main.clicks ?? 0);
  const conversions = Number(main.externalWebsiteConversions ?? 0);

  // Per kampanje
  const campaignQuery = new URLSearchParams(queryBase);
  campaignQuery.set("pivot", "CAMPAIGN");
  const campaignR = await fetch(
    `${LINKEDIN_REST_BASE}/adAnalytics?${campaignQuery.toString()}`,
    { headers: liHeaders(access) },
  );
  const campaignBody = campaignR.ok ? await campaignR.json() as any : { elements: [] };
  const campaigns = (campaignBody.elements ?? [])
    .map((c: any) => ({
      campaignName: c.pivotValues?.[0] ?? "(unnamed)",
      spend: parseFloat(String(c.costInLocalCurrency ?? "0")),
      clicks: Number(c.clicks ?? 0),
      conversions: Number(c.externalWebsiteConversions ?? 0),
    }))
    .sort((a: any, b: any) => b.spend - a.spend)
    .slice(0, 5);

  // Daglig trend
  const trendQuery = new URLSearchParams(queryBase);
  trendQuery.set("timeGranularity", "DAILY");
  const trendR = await fetch(
    `${LINKEDIN_REST_BASE}/adAnalytics?${trendQuery.toString()}`,
    { headers: liHeaders(access) },
  );
  const trendBody = trendR.ok ? await trendR.json() as any : { elements: [] };
  const dailyTrend = (trendBody.elements ?? []).map((d: any) => ({
    date: `${d.dateRange?.start?.year}-${String(d.dateRange?.start?.month).padStart(2, "0")}-${String(d.dateRange?.start?.day).padStart(2, "0")}`,
    spend: parseFloat(String(d.costInLocalCurrency ?? "0")),
    clicks: Number(d.clicks ?? 0),
    conversions: Number(d.externalWebsiteConversions ?? 0),
  }));

  return {
    spend,
    currency: "NOK",
    impressions,
    clicks,
    conversions,
    ctr: impressions > 0 ? clicks / impressions : 0,
    avgCpc: clicks > 0 ? spend / clicks : 0,
    costPerConversion: conversions > 0 ? spend / conversions : 0,
    topCampaigns: campaigns,
    dailyTrend,
  };
}

// ─────────────────────────────────────────────────────────────────────
// LinkedIn Matched Audiences — DMP-segmenter med email/phone-match
// ─────────────────────────────────────────────────────────────────────

import crypto from "node:crypto";

function liHash(value: string): string {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

export async function createLinkedinMatchedAudience(
  pool: Pool,
  opts: {
    producerUserId: string;
    adAccountUrn: string;             // urn:li:sponsoredAccount:1234567890
    name: string;
    sourceDescription?: string;
    identifiers: Array<{ email?: string; phone?: string }>;
    configId?: string | null;
  },
): Promise<{ ok: true; segmentUrn: string; uploadCount: number } | { ok: false; error: string }> {
  const access = await token(pool, opts.producerUserId);
  if (!access) return { ok: false, error: "not_connected" };

  // 1) Opprett DMP segment
  const segR = await fetch(`${LINKEDIN_REST_BASE}/dmpSegments`, {
    method: "POST",
    headers: liHeaders(access),
    body: JSON.stringify({
      name: opts.name,
      sourcePlatform: "API",
      sourceSegmentId: `rr_agent_${Date.now()}`,
      type: "USER",
      destinations: [{ destination: "LINKEDIN" }],
      account: opts.adAccountUrn,
    }),
  });
  if (!segR.ok) {
    const t = await segR.text();
    return { ok: false, error: `dmpSegments HTTP ${segR.status} — ${t.slice(0, 200)}` };
  }
  const segId = segR.headers.get("x-linkedin-id") || (await segR.json().catch(() => ({})) as { id?: string }).id;
  if (!segId) return { ok: false, error: "Manglende segment-id i respons" };
  const segmentUrn = `urn:li:dmpSegment:${segId}`;

  // 2) Last opp brukere (hashed)
  const users: Array<{ email?: string; phone?: string; action: string }> = [];
  for (const id of opts.identifiers) {
    const entry: { email?: string; phone?: string; action: string } = { action: "ADD" };
    if (id.email) entry.email = liHash(id.email);
    if (id.phone) entry.phone = liHash(id.phone);
    if (entry.email || entry.phone) users.push(entry);
  }
  if (users.length === 0) return { ok: false, error: "Ingen gyldige identifiers" };

  // LinkedIn batch-upload (max 5000 per call)
  for (let i = 0; i < users.length; i += 5000) {
    const batch = users.slice(i, i + 5000);
    await fetch(`${LINKEDIN_REST_BASE}/dmpSegments/${encodeURIComponent(segmentUrn)}/users`, {
      method: "POST",
      headers: liHeaders(access),
      body: JSON.stringify({ elements: batch }),
    }).catch(() => null);
  }

  // 3) Cache
  await pool.query(
    `INSERT INTO linkedin_matched_audiences (
       config_id, producer_user_id, ad_account_urn, linkedin_segment_urn,
       audience_name, source_description, upload_count, status
     ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, 'processing')
     ON CONFLICT (linkedin_segment_urn) DO NOTHING`,
    [
      opts.configId ?? null,
      opts.producerUserId,
      opts.adAccountUrn,
      segmentUrn,
      opts.name,
      opts.sourceDescription ?? null,
      users.length,
    ],
  ).catch(() => {});

  return { ok: true, segmentUrn, uploadCount: users.length };
}
