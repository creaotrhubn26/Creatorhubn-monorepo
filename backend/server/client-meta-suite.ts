/**
 * client-meta-suite.ts
 *
 * Meta (Facebook + Instagram)-parity til Google + LinkedIn:
 *   - List producerens Ad Accounts (via Marketing API)
 *   - List eksisterende Pixels på account-en
 *   - Provision Pixel (eller attach eksisterende)
 *   - Opprett Custom Conversion per action
 *   - Hent Ads Insights (impressions/clicks/spend/conversions)
 *   - CAPI-helper for server-side events
 *
 * Bruker producerens Meta long-lived user token (lagret i
 * role_room_instagram_connections via Instagram OAuth — samme app, samme scopes:
 * ads_management, ads_read, business_management, attribution_read).
 *
 * Meta App Review status (pr 2026-06-08):
 *   - ads_management: pending App Review per scope
 *   - ads_read: pending
 *   - business_management: pending
 *   App admin/testers kan bruke nå; live-bruker venter på godkjenning.
 */

import type { Pool } from "pg";
import {
  listInstagramConnections,
  ensureFreshConnection,
} from "./role-room-instagram-oauth.js";

const META_GRAPH_VERSION = "v21.0";
const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

/** Hent producerens Meta access-token (long-lived user-token). */
async function metaToken(pool: Pool, producerUserId: string): Promise<string | null> {
  const conns = await listInstagramConnections(pool, producerUserId);
  if (conns.length === 0) return null;
  // Bruk siste tilkoblede — antar at producer har én primær Meta-konto.
  const fresh = await ensureFreshConnection(pool, conns[0]).catch(() => null);
  return fresh?.accessToken ?? conns[0].accessToken;
}

// ─────────────────────────────────────────────────────────────────────
// Ad Accounts
// ─────────────────────────────────────────────────────────────────────

export async function listMetaAdAccounts(
  pool: Pool,
  producerUserId: string,
): Promise<{ ok: true; accounts: Array<{ id: string; accountId: string; name: string; currency: string; businessName?: string }> } | { ok: false; error: string }> {
  const access = await metaToken(pool, producerUserId);
  if (!access) return { ok: false, error: "not_connected" };

  const url = `${META_GRAPH_BASE}/me/adaccounts?fields=id,account_id,name,currency,business{name}&limit=50&access_token=${encodeURIComponent(access)}`;
  const r = await fetch(url);
  if (!r.ok) {
    const t = await r.text();
    return { ok: false, error: `listAccounts HTTP ${r.status} — ${t.slice(0, 200)}` };
  }
  const body = await r.json() as {
    data?: Array<{ id: string; account_id: string; name: string; currency: string; business?: { name?: string } }>;
  };
  return {
    ok: true,
    accounts: (body.data ?? []).map((a) => ({
      id: a.id,                          // act_1234567890
      accountId: a.account_id,           // 1234567890
      name: a.name,
      currency: a.currency,
      businessName: a.business?.name,
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────
// Pixels — list og opprett
// ─────────────────────────────────────────────────────────────────────

export async function listMetaPixels(
  pool: Pool,
  opts: { producerUserId: string; adAccountId: string }, // act_XXXXXXXXX
): Promise<{ ok: true; pixels: Array<{ id: string; name: string; lastFiredAt?: string }> } | { ok: false; error: string }> {
  const access = await metaToken(pool, opts.producerUserId);
  if (!access) return { ok: false, error: "not_connected" };

  const url = `${META_GRAPH_BASE}/${opts.adAccountId}/adspixels?fields=id,name,last_fired_time&access_token=${encodeURIComponent(access)}`;
  const r = await fetch(url);
  if (!r.ok) return { ok: false, error: `listPixels HTTP ${r.status}` };
  const body = await r.json() as { data?: Array<{ id: string; name: string; last_fired_time?: string }> };
  return {
    ok: true,
    pixels: (body.data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      lastFiredAt: p.last_fired_time,
    })),
  };
}

export async function provisionMetaPixel(
  pool: Pool,
  opts: { producerUserId: string; adAccountId: string; pixelName: string },
): Promise<
  | { ok: true; pixelId: string; pixelName: string; baseCode: string }
  | { ok: false; error: string }
> {
  const access = await metaToken(pool, opts.producerUserId);
  if (!access) return { ok: false, error: "not_connected" };

  const url = `${META_GRAPH_BASE}/${opts.adAccountId}/adspixels?access_token=${encodeURIComponent(access)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: opts.pixelName }),
  });
  if (!r.ok) {
    const t = await r.text();
    return { ok: false, error: `createPixel HTTP ${r.status} — ${t.slice(0, 200)}` };
  }
  const body = await r.json() as { id: string };
  return {
    ok: true,
    pixelId: body.id,
    pixelName: opts.pixelName,
    baseCode: buildMetaPixelBaseCode(body.id),
  };
}

/** Standard Meta Pixel base-code som klient limer inn i <head>. */
function buildMetaPixelBaseCode(pixelId: string): string {
  return `<!-- Meta Pixel — RR Agent -->
<script>
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', '${pixelId}');
  fbq('track', 'PageView');
</script>
<noscript>
  <img height="1" width="1" style="display:none"
       src="https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1" />
</noscript>`;
}

// ─────────────────────────────────────────────────────────────────────
// Custom Conversions — én per action
// ─────────────────────────────────────────────────────────────────────

/** goal_category → Meta standard event-navn. */
const META_EVENT_MAP: Record<string, string> = {
  purchase: "Purchase",
  add_to_cart: "AddToCart",
  begin_checkout: "InitiateCheckout",
  submit_lead_form: "Lead",
  book_appointment: "Schedule",
  sign_up: "CompleteRegistration",
  subscribe: "Subscribe",
  request_quote: "Lead",
  contact: "Contact",
  page_view: "ViewContent",
  outbound_click: "ViewContent",
  other: "CustomEvent",
};

export async function createMetaCustomConversion(
  pool: Pool,
  opts: {
    producerUserId: string;
    adAccountId: string;
    pixelId: string;
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
  | { ok: true; customConversionId: string; eventName: string }
  | { ok: false; error: string }
> {
  const access = await metaToken(pool, opts.producerUserId);
  if (!access) return { ok: false, error: "not_connected" };

  const eventName = META_EVENT_MAP[opts.action.goalCategory] ?? "CustomEvent";

  // Custom conversion regel-mønster basert på URL eller event
  const rule: Record<string, unknown> = opts.action.urlPattern
    ? { "url": { "i_contains": opts.action.urlPattern.replace(/\*/g, "") } }
    : { "event": { "eq": eventName } };

  const body = {
    name: opts.action.displayName,
    description: `RR Agent — ${opts.action.actionName}`,
    custom_event_type: eventName,
    pixel_id: opts.pixelId,
    rule: JSON.stringify(rule),
    default_conversion_value: opts.action.defaultValue || 0,
  };

  const url = `${META_GRAPH_BASE}/${opts.adAccountId}/customconversions?access_token=${encodeURIComponent(access)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text();
    return { ok: false, error: `createCustomConversion HTTP ${r.status} — ${t.slice(0, 200)}` };
  }
  const resp = await r.json() as { id: string };
  return { ok: true, customConversionId: resp.id, eventName };
}

// ─────────────────────────────────────────────────────────────────────
// Insights (rapportering for dashboard)
// ─────────────────────────────────────────────────────────────────────

export interface MetaAdsMetrics {
  spend: number;
  currency: string;
  impressions: number;
  clicks: number;
  conversions: number;
  reach: number;
  cpm: number;
  ctr: number;
  costPerConversion: number;
  topCampaigns: Array<{ campaignName: string; spend: number; clicks: number; conversions: number }>;
  dailyTrend: Array<{ date: string; spend: number; clicks: number; conversions: number }>;
}

export async function fetchMetaAdsMetrics(
  pool: Pool,
  opts: {
    producerUserId: string;
    adAccountId: string; // act_XXXXXXXXX
    startDate: string;   // YYYY-MM-DD
    endDate: string;
  },
): Promise<MetaAdsMetrics | null> {
  const access = await metaToken(pool, opts.producerUserId);
  if (!access) return null;

  const timeRange = JSON.stringify({ since: opts.startDate, until: opts.endDate });
  const baseQuery = new URLSearchParams({
    time_range: timeRange,
    fields: "spend,impressions,clicks,reach,cpm,ctr,actions,action_values",
    access_token: access,
  });

  // 1) Hovedmetrikker (account-level)
  const mainR = await fetch(`${META_GRAPH_BASE}/${opts.adAccountId}/insights?${baseQuery.toString()}`);
  if (!mainR.ok) return null;
  const mainBody = await mainR.json() as {
    data?: Array<{
      spend?: string; impressions?: string; clicks?: string; reach?: string;
      cpm?: string; ctr?: string;
      actions?: Array<{ action_type: string; value: string }>;
    }>;
  };
  const main = mainBody.data?.[0] ?? {};
  const spend = parseFloat(String(main.spend ?? "0"));
  const impressions = Number(main.impressions ?? 0);
  const clicks = Number(main.clicks ?? 0);
  const reach = Number(main.reach ?? 0);
  const cpm = parseFloat(String(main.cpm ?? "0"));
  const ctr = parseFloat(String(main.ctr ?? "0")) / 100;

  // Conversions: summer relevante action-typer
  const conversionActions = new Set(["lead", "purchase", "complete_registration", "schedule", "submit_application"]);
  const conversions = (main.actions ?? [])
    .filter((a) => conversionActions.has(a.action_type))
    .reduce((s, a) => s + Number(a.value || 0), 0);

  // 2) Top kampanjer
  const campaignQuery = new URLSearchParams(baseQuery);
  campaignQuery.set("level", "campaign");
  const campaignR = await fetch(`${META_GRAPH_BASE}/${opts.adAccountId}/insights?${campaignQuery.toString()}`);
  const campaignBody = campaignR.ok ? await campaignR.json() as any : { data: [] };
  const campaignsR = (campaignBody.data ?? []).map((c: any) => ({
    campaignName: c.campaign_name ?? "(unnamed)",
    spend: parseFloat(String(c.spend ?? "0")),
    clicks: Number(c.clicks ?? 0),
    conversions: (c.actions ?? [])
      .filter((a: any) => conversionActions.has(a.action_type))
      .reduce((s: number, a: any) => s + Number(a.value || 0), 0),
  }));
  campaignsR.sort((a: any, b: any) => b.spend - a.spend);

  // 3) Daglig trend
  const trendQuery = new URLSearchParams(baseQuery);
  trendQuery.set("time_increment", "1");
  const trendR = await fetch(`${META_GRAPH_BASE}/${opts.adAccountId}/insights?${trendQuery.toString()}`);
  const trendBody = trendR.ok ? await trendR.json() as any : { data: [] };
  const dailyTrend = (trendBody.data ?? []).map((d: any) => ({
    date: d.date_start ?? "",
    spend: parseFloat(String(d.spend ?? "0")),
    clicks: Number(d.clicks ?? 0),
    conversions: (d.actions ?? [])
      .filter((a: any) => conversionActions.has(a.action_type))
      .reduce((s: number, a: any) => s + Number(a.value || 0), 0),
  }));

  return {
    spend,
    currency: "NOK",
    impressions,
    clicks,
    conversions,
    reach,
    cpm,
    ctr,
    costPerConversion: conversions > 0 ? spend / conversions : 0,
    topCampaigns: campaignsR.slice(0, 5),
    dailyTrend,
  };
}
