/**
 * client-insights-service.ts
 *
 * Samler innsikt fra hele Google-stacken per klient i ÉN aggregat:
 *   - Google Ads (spend, impressions, clicks, conversions, CPA, ROAS)
 *   - GA4 Data API (sessions, conversions, engagement, traffic-sources)
 *   - Search Console (impressions, clicks, position, top queries, top pages)
 *   - Vår diagnose (% sjekker grønne, indekserings-helse)
 *   - Vår conversion-flow (events lagret i client_ads_events)
 *
 * Brukes av:
 *   GET /api/admin-room/agent/ads/configs/:id/insights?range=28d
 *
 * Returnerer KPI-er + trend + top-lister så Agent-UI kan tegne ett enkelt
 * dashboard. Hver kilde feiler stille (returnerer null) hvis ikke koblet —
 * UI viser delvis dashboard i stedet for å krasje.
 */

import type { Pool } from "pg";
import {
  ensureFreshAdsToken,
  getAdsOauthConnection,
} from "./role-room-ads-oauth.js";
import {
  fetchLinkedinAdsMetrics,
  type LinkedinAdsMetrics,
} from "./client-linkedin-suite.js";
import {
  fetchMetaAdsMetrics,
  type MetaAdsMetrics,
} from "./client-meta-suite.js";
import {
  fetchTiktokAdsMetrics,
  type TiktokAdsMetrics,
} from "./client-tiktok-suite.js";

const GA4_DATA_BASE = "https://analyticsdata.googleapis.com/v1beta";
const ADS_API_BASE = "https://googleads.googleapis.com/v18";
const GSC_BASE = "https://www.googleapis.com/webmasters/v3";

async function token(pool: Pool, producerUserId: string): Promise<string | null> {
  const conn = await getAdsOauthConnection(pool, producerUserId, "google");
  if (!conn) return null;
  const t = await ensureFreshAdsToken(pool, conn);
  return t.connectionState === "connected" ? t.accessToken : null;
}

function dateRange(days: number): { start: string; end: string; previousStart: string; previousEnd: string } {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - days + 1);
  const previousEnd = new Date(start);
  previousEnd.setDate(previousEnd.getDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - days + 1);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end), previousStart: fmt(previousStart), previousEnd: fmt(previousEnd) };
}

// ─────────────────────────────────────────────────────────────────────
// GA4 — Data API
// ─────────────────────────────────────────────────────────────────────

export interface Ga4Metrics {
  sessions: number;
  totalUsers: number;
  newUsers: number;
  engagedSessions: number;
  averageSessionDuration: number;
  conversions: number;
  trafficByChannel: Array<{ channel: string; sessions: number; conversions: number }>;
  dailyTrend: Array<{ date: string; sessions: number; conversions: number }>;
}

async function fetchGa4Metrics(
  pool: Pool,
  producerUserId: string,
  propertyId: string,
  startDate: string,
  endDate: string,
): Promise<Ga4Metrics | null> {
  const access = await token(pool, producerUserId);
  if (!access) return null;

  // Hovedmetrikker
  const mainR = await fetch(`${GA4_DATA_BASE}/properties/${propertyId}:runReport`, {
    method: "POST",
    headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      dateRanges: [{ startDate, endDate }],
      metrics: [
        { name: "sessions" },
        { name: "totalUsers" },
        { name: "newUsers" },
        { name: "engagedSessions" },
        { name: "averageSessionDuration" },
        { name: "conversions" },
      ],
    }),
  });
  if (!mainR.ok) return null;
  const mainBody = await mainR.json() as { rows?: Array<{ metricValues?: Array<{ value: string }> }> };
  const vals = mainBody.rows?.[0]?.metricValues ?? [];
  const num = (i: number) => Number(vals[i]?.value ?? 0);

  // Trafikk per kanal
  const channelR = await fetch(`${GA4_DATA_BASE}/properties/${propertyId}:runReport`, {
    method: "POST",
    headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "sessions" }, { name: "conversions" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: "10",
    }),
  });
  const channelBody = channelR.ok ? await channelR.json() as any : { rows: [] };
  const trafficByChannel = (channelBody.rows ?? []).map((r: any) => ({
    channel: r.dimensionValues?.[0]?.value ?? "(unknown)",
    sessions: Number(r.metricValues?.[0]?.value ?? 0),
    conversions: Number(r.metricValues?.[1]?.value ?? 0),
  }));

  // Daglig trend
  const trendR = await fetch(`${GA4_DATA_BASE}/properties/${propertyId}:runReport`, {
    method: "POST",
    headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "date" }],
      metrics: [{ name: "sessions" }, { name: "conversions" }],
      orderBys: [{ dimension: { dimensionName: "date" } }],
    }),
  });
  const trendBody = trendR.ok ? await trendR.json() as any : { rows: [] };
  const dailyTrend = (trendBody.rows ?? []).map((r: any) => ({
    date: r.dimensionValues?.[0]?.value ?? "",
    sessions: Number(r.metricValues?.[0]?.value ?? 0),
    conversions: Number(r.metricValues?.[1]?.value ?? 0),
  }));

  return {
    sessions: num(0),
    totalUsers: num(1),
    newUsers: num(2),
    engagedSessions: num(3),
    averageSessionDuration: num(4),
    conversions: num(5),
    trafficByChannel,
    dailyTrend,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Google Ads — Reporting via GAQL
// ─────────────────────────────────────────────────────────────────────

export interface AdsMetrics {
  spendMicros: number;
  spendNok: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionValue: number;
  ctr: number;
  avgCpcNok: number;
  costPerConversion: number;
  roas: number | null;
  topCampaigns: Array<{ campaignName: string; cost: number; clicks: number; conversions: number }>;
  dailyTrend: Array<{ date: string; cost: number; clicks: number; conversions: number }>;
}

async function fetchAdsMetrics(
  pool: Pool,
  producerUserId: string,
  customerId: string,
  startDate: string,
  endDate: string,
): Promise<AdsMetrics | null> {
  const access = await token(pool, producerUserId);
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim();
  const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.trim().replace(/-/g, "");
  if (!access || !developerToken) return null;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${access}`,
    "developer-token": developerToken,
    "Content-Type": "application/json",
  };
  if (loginCustomerId) headers["login-customer-id"] = loginCustomerId;

  const cleanCust = customerId.replace(/-/g, "");

  // Hovedmetrikker
  const mainQuery = `
    SELECT metrics.cost_micros, metrics.impressions, metrics.clicks,
           metrics.conversions, metrics.conversions_value, metrics.ctr,
           metrics.average_cpc
      FROM customer
     WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
  `;
  const mainR = await fetch(`${ADS_API_BASE}/customers/${cleanCust}/googleAds:search`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query: mainQuery }),
  });
  if (!mainR.ok) return null;
  const mainBody = await mainR.json() as { results?: Array<{ metrics?: any }> };
  const m = mainBody.results?.[0]?.metrics ?? {};
  const spendMicros = Number(m.costMicros ?? m.cost_micros ?? 0);
  const spendNok = spendMicros / 1_000_000;
  const conversions = Number(m.conversions ?? 0);
  const conversionValue = Number(m.conversionsValue ?? m.conversions_value ?? 0);
  const clicks = Number(m.clicks ?? 0);
  const impressions = Number(m.impressions ?? 0);

  // Per-kampanje (topp 5)
  const campaignQuery = `
    SELECT campaign.name, metrics.cost_micros, metrics.clicks, metrics.conversions
      FROM campaign
     WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
       AND metrics.impressions > 0
     ORDER BY metrics.cost_micros DESC
     LIMIT 5
  `;
  const campaignR = await fetch(`${ADS_API_BASE}/customers/${cleanCust}/googleAds:search`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query: campaignQuery }),
  });
  const campaignBody = campaignR.ok ? await campaignR.json() as any : { results: [] };
  const topCampaigns = (campaignBody.results ?? []).map((r: any) => ({
    campaignName: r.campaign?.name ?? "(unnamed)",
    cost: Number(r.metrics?.costMicros ?? 0) / 1_000_000,
    clicks: Number(r.metrics?.clicks ?? 0),
    conversions: Number(r.metrics?.conversions ?? 0),
  }));

  // Daglig trend
  const trendQuery = `
    SELECT segments.date, metrics.cost_micros, metrics.clicks, metrics.conversions
      FROM customer
     WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
     ORDER BY segments.date
  `;
  const trendR = await fetch(`${ADS_API_BASE}/customers/${cleanCust}/googleAds:search`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query: trendQuery }),
  });
  const trendBody = trendR.ok ? await trendR.json() as any : { results: [] };
  const dailyTrend = (trendBody.results ?? []).map((r: any) => ({
    date: r.segments?.date ?? "",
    cost: Number(r.metrics?.costMicros ?? 0) / 1_000_000,
    clicks: Number(r.metrics?.clicks ?? 0),
    conversions: Number(r.metrics?.conversions ?? 0),
  }));

  return {
    spendMicros,
    spendNok,
    impressions,
    clicks,
    conversions,
    conversionValue,
    ctr: impressions > 0 ? clicks / impressions : 0,
    avgCpcNok: clicks > 0 ? spendNok / clicks : 0,
    costPerConversion: conversions > 0 ? spendNok / conversions : 0,
    roas: spendNok > 0 ? conversionValue / spendNok : null,
    topCampaigns,
    dailyTrend,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Search Console — Search Analytics
// ─────────────────────────────────────────────────────────────────────

export interface GscMetrics {
  totalClicks: number;
  totalImpressions: number;
  averageCtr: number;
  averagePosition: number;
  topQueries: Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number }>;
  topPages: Array<{ page: string; clicks: number; impressions: number; ctr: number; position: number }>;
  dailyTrend: Array<{ date: string; clicks: number; impressions: number }>;
}

async function fetchGscMetrics(
  pool: Pool,
  producerUserId: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
): Promise<GscMetrics | null> {
  const access = await token(pool, producerUserId);
  if (!access) return null;

  // Totaler + daglig trend (én request med date-dimension, så aggregerer vi)
  const dailyR = await fetch(`${GSC_BASE}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      startDate, endDate,
      dimensions: ["date"],
      rowLimit: 1000,
    }),
  });
  if (!dailyR.ok) return null;
  const dailyBody = await dailyR.json() as { rows?: Array<{ keys: string[]; clicks: number; impressions: number; ctr: number; position: number }> };
  const dailyRows = dailyBody.rows ?? [];
  const totalClicks = dailyRows.reduce((s, r) => s + r.clicks, 0);
  const totalImpressions = dailyRows.reduce((s, r) => s + r.impressions, 0);
  const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
  const avgPos = dailyRows.length > 0 ? dailyRows.reduce((s, r) => s + r.position, 0) / dailyRows.length : 0;
  const dailyTrend = dailyRows.map((r) => ({ date: r.keys[0], clicks: r.clicks, impressions: r.impressions }));

  // Top queries
  const queryR = await fetch(`${GSC_BASE}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      startDate, endDate,
      dimensions: ["query"],
      rowLimit: 15,
    }),
  });
  const queryBody = queryR.ok ? await queryR.json() as any : { rows: [] };
  const topQueries = (queryBody.rows ?? []).map((r: any) => ({
    query: r.keys?.[0] ?? "",
    clicks: r.clicks ?? 0,
    impressions: r.impressions ?? 0,
    ctr: r.ctr ?? 0,
    position: r.position ?? 0,
  }));

  // Top pages
  const pageR = await fetch(`${GSC_BASE}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      startDate, endDate,
      dimensions: ["page"],
      rowLimit: 15,
    }),
  });
  const pageBody = pageR.ok ? await pageR.json() as any : { rows: [] };
  const topPages = (pageBody.rows ?? []).map((r: any) => ({
    page: r.keys?.[0] ?? "",
    clicks: r.clicks ?? 0,
    impressions: r.impressions ?? 0,
    ctr: r.ctr ?? 0,
    position: r.position ?? 0,
  }));

  return {
    totalClicks,
    totalImpressions,
    averageCtr: avgCtr,
    averagePosition: avgPos,
    topQueries,
    topPages,
    dailyTrend,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Aggregat-funksjonen som blender alle kildene
// ─────────────────────────────────────────────────────────────────────

export interface ClientInsights {
  range: { start: string; end: string; days: number };
  ga4: Ga4Metrics | null;
  ads: AdsMetrics | null;            // Google Ads
  gsc: GscMetrics | null;
  linkedin: LinkedinAdsMetrics | null;
  meta: MetaAdsMetrics | null;
  tiktok: TiktokAdsMetrics | null;
  setupHealth: { totalChecks: number; ok: number; warning: number; error: number; info: number; score: number };
  /** Egne tracked events fra client_ads_events. */
  trackedEvents: { total: number; uniqueActions: number; topActions: Array<{ actionName: string; count: number }> };
  /** Topplinje-KPI på tvers av plattformer. */
  summary: {
    totalSessions: number;
    totalAdsClicks: number;        // SUM(Google Ads, LinkedIn, Meta, TikTok)
    totalOrganicClicks: number;
    totalConversions: number;      // SUM på tvers av plattformer
    totalSpendNok: number;         // SUM på tvers av plattformer
    avgCostPerConversion: number;
    organicShare: number;
    paidShare: number;
    /** Per-plattform spend-fordeling. */
    spendByPlatform: Array<{ platform: string; spend: number; share: number }>;
  };
  /** Insight-bullets (auto-genererte observasjoner). */
  observations: string[];
}

export async function fetchClientInsights(
  pool: Pool,
  opts: {
    producerUserId: string;
    configId: string;
    rangeDays?: number;
  },
): Promise<ClientInsights | null> {
  const cfgR = await pool.query(
    `SELECT id::text, client_website_url, ga4_property_id, gsc_property_url,
            google_ads_customer_id, linkedin_account_urn,
            meta_ad_account_id, tiktok_advertiser_id
       FROM client_ads_configs
      WHERE id = $1::uuid AND content_producer_user_id = $2`,
    [opts.configId, opts.producerUserId],
  );
  if (!cfgR.rowCount) return null;
  const cfg = cfgR.rows[0];
  const days = opts.rangeDays ?? 28;
  const { start, end } = dateRange(days);

  // Kjør alle kall parallelt (de feiler stille hvis tilkobling mangler)
  const [ga4, ads, gsc, linkedin, meta, tiktok] = await Promise.all([
    cfg.ga4_property_id
      ? fetchGa4Metrics(pool, opts.producerUserId, cfg.ga4_property_id, start, end).catch(() => null)
      : Promise.resolve(null),
    cfg.google_ads_customer_id
      ? fetchAdsMetrics(pool, opts.producerUserId, cfg.google_ads_customer_id, start, end).catch(() => null)
      : Promise.resolve(null),
    cfg.gsc_property_url || cfg.client_website_url
      ? fetchGscMetrics(pool, opts.producerUserId, cfg.gsc_property_url || cfg.client_website_url, start, end).catch(() => null)
      : Promise.resolve(null),
    cfg.linkedin_account_urn
      ? fetchLinkedinAdsMetrics(pool, {
          producerUserId: opts.producerUserId,
          adAccountUrn: cfg.linkedin_account_urn,
          startDate: start,
          endDate: end,
        }).catch(() => null)
      : Promise.resolve(null),
    cfg.meta_ad_account_id
      ? fetchMetaAdsMetrics(pool, {
          producerUserId: opts.producerUserId,
          adAccountId: cfg.meta_ad_account_id,
          startDate: start,
          endDate: end,
        }).catch(() => null)
      : Promise.resolve(null),
    cfg.tiktok_advertiser_id
      ? fetchTiktokAdsMetrics(pool, {
          producerUserId: opts.producerUserId,
          advertiserId: cfg.tiktok_advertiser_id,
          startDate: start,
          endDate: end,
        }).catch(() => null)
      : Promise.resolve(null),
  ]);

  // Setup-helse fra siste diagnose (cached i config?  for nå: kjør på nytt
  // ville koste mye — vi gjør det enklere ved å bare telle satte felter)
  const setupHealth = {
    totalChecks: 4,
    ok: [cfg.ga4_property_id, cfg.gsc_property_url, cfg.google_ads_customer_id, cfg.client_website_url].filter(Boolean).length,
    warning: 0,
    error: 0,
    info: 0,
    score: 0,
  };
  setupHealth.score = setupHealth.totalChecks > 0 ? setupHealth.ok / setupHealth.totalChecks : 0;

  // Tracked events fra vår egen DB
  const eventsR = await pool.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(DISTINCT action_name)::int AS unique_actions
       FROM client_ads_events
      WHERE config_id = $1::uuid
        AND created_at >= NOW() - ($2 || ' days')::INTERVAL`,
    [opts.configId, String(days)],
  ).catch(() => ({ rows: [{ total: 0, unique_actions: 0 }] }));
  const topActionsR = await pool.query(
    `SELECT action_name, COUNT(*)::int AS count
       FROM client_ads_events
      WHERE config_id = $1::uuid
        AND created_at >= NOW() - ($2 || ' days')::INTERVAL
   GROUP BY action_name
   ORDER BY count DESC
      LIMIT 5`,
    [opts.configId, String(days)],
  ).catch(() => ({ rows: [] }));

  const trackedEvents = {
    total: eventsR.rows[0]?.total ?? 0,
    uniqueActions: eventsR.rows[0]?.unique_actions ?? 0,
    topActions: topActionsR.rows.map((r: any) => ({ actionName: r.action_name, count: r.count })),
  };

  // Topplinje-KPI på tvers av plattformer
  const totalSessions = ga4?.sessions ?? 0;
  const totalAdsClicks = (ads?.clicks ?? 0) + (linkedin?.clicks ?? 0) + (meta?.clicks ?? 0) + (tiktok?.clicks ?? 0);
  const totalOrganicClicks = gsc?.totalClicks ?? 0;
  const totalConversions = (ads?.conversions ?? 0) + (linkedin?.conversions ?? 0) + (meta?.conversions ?? 0) + (tiktok?.conversions ?? 0) + (ga4?.conversions ?? 0);
  const totalSpendNok = (ads?.spendNok ?? 0) + (linkedin?.spend ?? 0) + (meta?.spend ?? 0) + (tiktok?.spend ?? 0);
  const allClicks = totalAdsClicks + totalOrganicClicks;

  const spendByPlatform: Array<{ platform: string; spend: number; share: number }> = [];
  if (ads?.spendNok) spendByPlatform.push({ platform: "Google Ads", spend: ads.spendNok, share: 0 });
  if (linkedin?.spend) spendByPlatform.push({ platform: "LinkedIn", spend: linkedin.spend, share: 0 });
  if (meta?.spend) spendByPlatform.push({ platform: "Meta", spend: meta.spend, share: 0 });
  if (tiktok?.spend) spendByPlatform.push({ platform: "TikTok", spend: tiktok.spend, share: 0 });
  for (const p of spendByPlatform) p.share = totalSpendNok > 0 ? p.spend / totalSpendNok : 0;
  spendByPlatform.sort((a, b) => b.spend - a.spend);

  const summary = {
    totalSessions,
    totalAdsClicks,
    totalOrganicClicks,
    totalConversions,
    totalSpendNok,
    avgCostPerConversion: totalConversions > 0 ? totalSpendNok / totalConversions : 0,
    organicShare: allClicks > 0 ? totalOrganicClicks / allClicks : 0,
    paidShare: allClicks > 0 ? totalAdsClicks / allClicks : 0,
    spendByPlatform,
  };

  // Auto-observasjoner — det innholdsprodusent sender til klient
  const observations: string[] = [];
  if (ga4 === null && ads === null && gsc === null) {
    observations.push("Ingen kilder svarer — sjekk at Google OAuth er aktiv og at minst én av GA4/Ads/GSC er koblet til config.");
  }
  if (ads && ads.roas !== null) {
    if (ads.roas >= 3) observations.push(`Sterk ROAS på ${ads.roas.toFixed(1)}x — Google Ads tjener ${ads.roas.toFixed(1)} kr per krone investert. Vurder å øke budsjettet.`);
    else if (ads.roas >= 1.5) observations.push(`OK ROAS på ${ads.roas.toFixed(1)}x — over breakeven. Sjekk topp-kampanjer for å skalere.`);
    else if (ads.roas < 1) observations.push(`⚠️ ROAS under 1 (${ads.roas.toFixed(2)}x) — du taper penger på ads. Pause svake kampanjer eller juster bud.`);
  }
  if (ads && ads.conversions > 0 && ads.costPerConversion > 0) {
    observations.push(`CPA: ${Math.round(ads.costPerConversion)} kr per konvertering på Google Ads.`);
  }
  if (gsc && gsc.averagePosition > 0) {
    if (gsc.averagePosition < 10) observations.push(`Snittposisjon i Google-søk: ${gsc.averagePosition.toFixed(1)} — siten ranker på side 1.`);
    else if (gsc.averagePosition < 20) observations.push(`Snittposisjon ${gsc.averagePosition.toFixed(1)} — side 2. Push de beste sidene mot side 1.`);
    else observations.push(`Snittposisjon ${gsc.averagePosition.toFixed(1)} — siten har dårlig synlighet. Følg opp SEO-prompter (sitemap, structured data, content depth).`);
  }
  if (gsc && gsc.topQueries.length > 0) {
    const top3 = gsc.topQueries.slice(0, 3).map((q) => `"${q.query}" (${q.clicks} klikk)`).join(", ");
    observations.push(`Topp-søk denne perioden: ${top3}.`);
  }
  if (ga4 && ga4.trafficByChannel.length > 0) {
    const topChannel = ga4.trafficByChannel[0];
    observations.push(`Hovedkilde: ${topChannel.channel} med ${topChannel.sessions} økter (${topChannel.conversions} konverteringer).`);
  }
  if (summary.organicShare > 0.7) observations.push("Hovedsakelig organisk trafikk — vurder Ads-eksperimenter for raskere vekst.");
  if (summary.paidShare > 0.7 && totalSessions > 0) observations.push("Hovedsakelig betalt trafikk — bygg organisk for å redusere avhengighet av ads.");
  if (linkedin) {
    if (linkedin.conversions > 0 && linkedin.costPerConversion > 0) {
      observations.push(`LinkedIn CPA: ${Math.round(linkedin.costPerConversion)} kr — ${linkedin.conversions} konv. på ${Math.round(linkedin.spend)} kr.`);
    }
    if (ads && ads.spendNok > 0 && linkedin.spend > 0) {
      const cmp = (ads.costPerConversion > 0 && linkedin.costPerConversion > 0)
        ? linkedin.costPerConversion / ads.costPerConversion
        : null;
      if (cmp !== null) {
        if (cmp < 0.8) observations.push("LinkedIn CPA er lavere enn Google Ads — vurder å flytte mer budsjett dit (B2B-fit).");
        else if (cmp > 1.5) observations.push("LinkedIn CPA er betydelig høyere enn Google — refiner targeting eller pause LinkedIn.");
      }
    }
  }
  if (meta) {
    if (meta.conversions > 0 && meta.costPerConversion > 0) {
      observations.push(`Meta CPA: ${Math.round(meta.costPerConversion)} kr — ${meta.conversions} konv. på ${Math.round(meta.spend)} kr (reach ${meta.reach.toLocaleString("nb-NO")}).`);
    }
    if (meta.cpm > 0) {
      observations.push(`Meta CPM: ${Math.round(meta.cpm)} kr/1000 visninger. CTR ${(meta.ctr * 100).toFixed(2)}%.`);
    }
  }
  if (tiktok) {
    if (tiktok.conversions > 0 && tiktok.costPerConversion > 0) {
      observations.push(`TikTok CPA: ${Math.round(tiktok.costPerConversion)} kr — ${tiktok.conversions} konv. på ${Math.round(tiktok.spend)} kr.`);
    }
    if (tiktok.ctr > 0 && tiktok.cpc > 0) {
      observations.push(`TikTok CTR ${(tiktok.ctr * 100).toFixed(2)}% · CPC ${tiktok.cpc.toFixed(1)} kr.`);
    }
  }
  if (summary.spendByPlatform.length > 1) {
    const top = summary.spendByPlatform[0];
    observations.push(`Spend-fordeling: ${summary.spendByPlatform.map((p) => `${p.platform} ${Math.round(p.share * 100)}%`).join(" · ")} (totalt ${Math.round(summary.totalSpendNok)} kr).`);
  }

  return {
    range: { start, end, days },
    ga4,
    ads,
    gsc,
    linkedin,
    meta,
    tiktok,
    setupHealth,
    trackedEvents,
    summary,
    observations,
  };
}
