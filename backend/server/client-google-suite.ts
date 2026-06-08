/**
 * client-google-suite.ts
 *
 * GA4 Admin API + Search Console + Site Verification + Tag Manager API-wrappers
 * for The Role Room Agent's multi-tenant Google-suite-setup per klient.
 *
 * Bruker producerens MCC-OAuth-tilkobling (samme refresh-token som B2/B3)
 * — scopes er utvidet i `role-room-ads-oauth.ts` til å dekke alle fire APIer.
 *
 * Endepunkter wired i `client-ads-routes.ts`:
 *   POST /api/admin-room/agent/ads/configs/:id/ga4/provision
 *   POST /api/admin-room/agent/ads/configs/:id/gsc/verify
 *   POST /api/admin-room/agent/ads/configs/:id/gsc/sitemap
 *   POST /api/admin-room/agent/ads/configs/:id/gtm/provision
 *   POST /api/admin-room/agent/ads/configs/:id/gtm/import-tags
 *
 * Backend lagrer resultatene i client_ads_configs (ga4_property_id,
 * gsc_property_url, gtm_container_public_id, …) per migrate 255.
 */

import type { Pool } from "pg";
import {
  ensureFreshAdsToken,
  getAdsOauthConnection,
} from "./role-room-ads-oauth.js";

// ─────────────────────────────────────────────────────────────────────
// Token-helper — reuses MCC-connection lagret av B2-OAuth
// ─────────────────────────────────────────────────────────────────────

async function getGoogleAccessToken(
  pool: Pool,
  producerUserId: string,
): Promise<string | null> {
  const conn = await getAdsOauthConnection(pool, producerUserId, "google");
  if (!conn) return null;
  const token = await ensureFreshAdsToken(pool, conn);
  if (token.connectionState !== "connected") return null;
  return token.accessToken;
}

function jsonHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

// ─────────────────────────────────────────────────────────────────────
// GA4 — Google Analytics Admin API v1beta
// https://developers.google.com/analytics/devguides/config/admin/v1
// ─────────────────────────────────────────────────────────────────────

const GA4_ADMIN_BASE = "https://analyticsadmin.googleapis.com/v1beta";

export async function listGa4Accounts(
  pool: Pool,
  producerUserId: string,
): Promise<{ ok: true; accounts: Array<{ name: string; displayName: string }> } | { ok: false; error: string }> {
  const token = await getGoogleAccessToken(pool, producerUserId);
  if (!token) return { ok: false, error: "not_connected" };

  const r = await fetch(`${GA4_ADMIN_BASE}/accountSummaries`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return { ok: false, error: `GA4 list-accounts: HTTP ${r.status}` };
  const body = await r.json() as { accountSummaries?: Array<{ account: string; displayName: string }> };
  return {
    ok: true,
    accounts: (body.accountSummaries ?? []).map((a) => ({
      name: a.account, // "accounts/123456789"
      displayName: a.displayName,
    })),
  };
}

/** Opprett GA4-property + web-data-stream → returnerer G-XXXX measurement-id. */
export async function provisionGa4Property(
  pool: Pool,
  opts: {
    producerUserId: string;
    accountName: string; // "accounts/123456789"
    displayName: string; // klient-navn
    websiteUrl: string;  // https://klient.no
    timeZone?: string;   // default "Europe/Oslo"
    currencyCode?: string; // default "NOK"
    industryCategory?: string; // GA4 industry enum
  },
): Promise<
  | { ok: true; propertyId: string; measurementId: string; dataStreamId: string }
  | { ok: false; error: string }
> {
  const token = await getGoogleAccessToken(pool, opts.producerUserId);
  if (!token) return { ok: false, error: "not_connected" };

  // 1) Opprett property
  const propBody = {
    parent: opts.accountName,
    displayName: opts.displayName,
    timeZone: opts.timeZone ?? "Europe/Oslo",
    currencyCode: opts.currencyCode ?? "NOK",
    industryCategory: opts.industryCategory ?? "OTHER",
  };
  const propR = await fetch(`${GA4_ADMIN_BASE}/properties`, {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify(propBody),
  });
  if (!propR.ok) {
    const t = await propR.text();
    return { ok: false, error: `GA4 create-property: HTTP ${propR.status} — ${t.slice(0, 200)}` };
  }
  const prop = await propR.json() as { name: string };
  const propertyId = prop.name.split("/")[1] ?? ""; // "properties/123" → "123"

  // 2) Opprett web-data-stream (gir oss G-XXX)
  const streamBody = {
    type: "WEB_DATA_STREAM",
    displayName: `${opts.displayName} — web`,
    webStreamData: {
      defaultUri: opts.websiteUrl,
    },
  };
  const streamR = await fetch(`${GA4_ADMIN_BASE}/${prop.name}/dataStreams`, {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify(streamBody),
  });
  if (!streamR.ok) {
    const t = await streamR.text();
    return { ok: false, error: `GA4 create-stream: HTTP ${streamR.status} — ${t.slice(0, 200)}` };
  }
  const stream = await streamR.json() as {
    name: string;
    webStreamData?: { measurementId?: string };
  };
  const dataStreamId = stream.name.split("/").pop() ?? "";
  const measurementId = stream.webStreamData?.measurementId ?? "";

  return { ok: true, propertyId, measurementId, dataStreamId };
}

// ─────────────────────────────────────────────────────────────────────
// GSC — Site Verification API v1 + Search Console v3
// https://developers.google.com/site-verification
// https://developers.google.com/webmaster-tools/v1/sites
// ─────────────────────────────────────────────────────────────────────

const SITEVERIFY_BASE = "https://www.googleapis.com/siteVerification/v1";
const SEARCHCONSOLE_BASE = "https://www.googleapis.com/webmasters/v3";

/** Henter meta-tag-token klient må lime inn i <head> for verifisering. */
export async function getGscVerificationToken(
  pool: Pool,
  opts: { producerUserId: string; siteUrl: string; method?: "META" | "FILE" },
): Promise<{ ok: true; token: string; method: string } | { ok: false; error: string }> {
  const access = await getGoogleAccessToken(pool, opts.producerUserId);
  if (!access) return { ok: false, error: "not_connected" };

  const method = opts.method ?? "META";
  const r = await fetch(`${SITEVERIFY_BASE}/token`, {
    method: "POST",
    headers: jsonHeaders(access),
    body: JSON.stringify({
      verificationMethod: method,
      site: { type: "SITE", identifier: opts.siteUrl },
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    return { ok: false, error: `getToken: HTTP ${r.status} — ${t.slice(0, 200)}` };
  }
  const body = await r.json() as { token?: string; method?: string };
  return { ok: true, token: body.token ?? "", method: body.method ?? method };
}

/** Verifiser site (forutsetter at klient har lagt inn meta-tag eller TXT-record). */
export async function verifyGscSite(
  pool: Pool,
  opts: { producerUserId: string; siteUrl: string; method?: "META" | "FILE" | "DNS_TXT" },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await getGoogleAccessToken(pool, opts.producerUserId);
  if (!access) return { ok: false, error: "not_connected" };

  const method = opts.method ?? "META";
  const url = `${SITEVERIFY_BASE}/webResource?verificationMethod=${encodeURIComponent(method)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: jsonHeaders(access),
    body: JSON.stringify({
      site: { type: "SITE", identifier: opts.siteUrl },
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    return { ok: false, error: `verify: HTTP ${r.status} — ${t.slice(0, 200)}` };
  }
  return { ok: true };
}

/** Legg site til Search Console (etter verifisering). */
export async function addGscSite(
  pool: Pool,
  opts: { producerUserId: string; siteUrl: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await getGoogleAccessToken(pool, opts.producerUserId);
  if (!access) return { ok: false, error: "not_connected" };
  const r = await fetch(`${SEARCHCONSOLE_BASE}/sites/${encodeURIComponent(opts.siteUrl)}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${access}` },
  });
  if (!r.ok && r.status !== 204) {
    const t = await r.text();
    return { ok: false, error: `addSite: HTTP ${r.status} — ${t.slice(0, 200)}` };
  }
  return { ok: true };
}

/** Submit en enkelt sitemap til GSC. */
export async function submitGscSitemap(
  pool: Pool,
  opts: { producerUserId: string; siteUrl: string; sitemapUrl: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await getGoogleAccessToken(pool, opts.producerUserId);
  if (!access) return { ok: false, error: "not_connected" };
  const url = `${SEARCHCONSOLE_BASE}/sites/${encodeURIComponent(opts.siteUrl)}/sitemaps/${encodeURIComponent(opts.sitemapUrl)}`;
  const r = await fetch(url, {
    method: "PUT",
    headers: { Authorization: `Bearer ${access}` },
  });
  if (!r.ok && r.status !== 204) {
    const t = await r.text();
    return { ok: false, error: `submitSitemap: HTTP ${r.status} — ${t.slice(0, 200)}` };
  }
  return { ok: true };
}

/** Auto-discovery av sitemaps:
 *    1. Les robots.txt → ekstraher alle `Sitemap: <url>`-linjer
 *    2. Hvis tom: prøv /sitemap.xml, /sitemap_index.xml, /sitemap-index.xml
 *  Returnerer fult URLer (deduped).
 */
export async function discoverSitemaps(
  websiteUrl: string,
): Promise<{ sitemaps: string[]; source: "robots" | "fallback" | "none" }> {
  const baseUrl = websiteUrl.replace(/\/+$/, "");
  const found = new Set<string>();

  // robots.txt
  try {
    const r = await fetch(`${baseUrl}/robots.txt`, { signal: AbortSignal.timeout(7000) });
    if (r.ok) {
      const text = await r.text();
      for (const line of text.split(/\r?\n/)) {
        const m = line.match(/^\s*Sitemap\s*:\s*(.+?)\s*$/i);
        if (m && m[1]) found.add(m[1].trim());
      }
    }
  } catch { /* nettverksfeil — fortsett med fallback */ }

  if (found.size > 0) return { sitemaps: Array.from(found), source: "robots" };

  // Fallback: vanlige sitemap-stier — HEAD-sjekk så vi bare returnerer det som finnes
  for (const path of ["/sitemap.xml", "/sitemap_index.xml", "/sitemap-index.xml"]) {
    try {
      const r = await fetch(`${baseUrl}${path}`, { method: "HEAD", signal: AbortSignal.timeout(5000) });
      if (r.ok) found.add(`${baseUrl}${path}`);
    } catch { /* fortsett */ }
  }

  return {
    sitemaps: Array.from(found),
    source: found.size > 0 ? "fallback" : "none",
  };
}

/** Batch-submit av alle sitemaps (auto-discovery + manuell liste).
 *  Returnerer per-sitemap-resultat så UI kan vise hvilke som lyktes.
 */
export async function submitAllSitemaps(
  pool: Pool,
  opts: {
    producerUserId: string;
    siteUrl: string;            // GSC property-URL (https://klient.no/ eller sc-domain:klient.no)
    websiteUrl: string;         // Brukes for robots.txt-lookup
    extraSitemapUrls?: string[];// Manuelt lagt til
  },
): Promise<{
  ok: boolean;
  discovered: string[];
  source: "robots" | "fallback" | "none";
  submitted: Array<{ sitemap: string; ok: boolean; error?: string }>;
}> {
  const discovery = await discoverSitemaps(opts.websiteUrl);
  const allSitemaps = Array.from(new Set([
    ...discovery.sitemaps,
    ...(opts.extraSitemapUrls ?? []),
  ]));

  const submitted: Array<{ sitemap: string; ok: boolean; error?: string }> = [];
  for (const sm of allSitemaps) {
    const r = await submitGscSitemap(pool, {
      producerUserId: opts.producerUserId,
      siteUrl: opts.siteUrl,
      sitemapUrl: sm,
    });
    submitted.push({ sitemap: sm, ok: r.ok, error: r.ok ? undefined : r.error });
  }

  return {
    ok: submitted.length > 0 && submitted.every((s) => s.ok),
    discovered: discovery.sitemaps,
    source: discovery.source,
    submitted,
  };
}

/** Hent sitemap-status (errors + warnings + lastSubmitted) for ALLE registrerte sitemaps
 *  på siten — slik at producer ser hvor mange URL'er som faktisk er indeksert.
 */
export async function fetchSitemapStatus(
  pool: Pool,
  opts: { producerUserId: string; siteUrl: string },
): Promise<{
  ok: true;
  sitemaps: Array<{
    path: string;
    lastSubmitted?: string;
    lastDownloaded?: string;
    warnings?: number;
    errors?: number;
    isPending?: boolean;
  }>;
} | { ok: false; error: string }> {
  const access = await getGoogleAccessToken(pool, opts.producerUserId);
  if (!access) return { ok: false, error: "not_connected" };
  const r = await fetch(
    `${SEARCHCONSOLE_BASE}/sites/${encodeURIComponent(opts.siteUrl)}/sitemaps`,
    { headers: { Authorization: `Bearer ${access}` } },
  );
  if (!r.ok) return { ok: false, error: `fetchSitemaps: HTTP ${r.status}` };
  const body = await r.json() as {
    sitemap?: Array<{
      path: string;
      lastSubmitted?: string;
      lastDownloaded?: string;
      warnings?: string;
      errors?: string;
      isPending?: boolean;
    }>;
  };
  return {
    ok: true,
    sitemaps: (body.sitemap ?? []).map((s) => ({
      path: s.path,
      lastSubmitted: s.lastSubmitted,
      lastDownloaded: s.lastDownloaded,
      warnings: s.warnings ? Number(s.warnings) : 0,
      errors: s.errors ? Number(s.errors) : 0,
      isPending: s.isPending,
    })),
  };
}

/** Full klient-diagnose: hva er allerede satt opp / hva er feil?
 *  Brukes når producer vil videreføre en klient hvor noen har prøvd å sette opp
 *  Google-stacken før. Resultatet vises som klartekst-sjekkliste i Agent-UI.
 *
 *  Sjekker:
 *
 *  ── HTML-stack (henter klient-HTML én gang) ──
 *    - gtag.js loadet?
 *    - GA4 measurement-ID (G-XXX) tilstede? Matcher config?
 *    - Google Ads AW-ID (AW-XXX) tilstede?
 *    - GTM container-snippet (GTM-XXX) — både <head> og <body>?
 *    - Meta Pixel (fbq) — konkurrent-tracker tilstede?
 *    - LinkedIn Insight Tag (_linkedin_data_partner_ids)?
 *    - TikTok Pixel (ttq)?
 *    - Microsoft Clarity?
 *    - Consent Mode v2 (gtag('consent', …))?
 *    - JSON-LD strukturert data (schema.org)?
 *    - SEO basics: title, meta-description, canonical, Open Graph, viewport
 *    - noindex / nofollow meta-tag (blokkerer indeksering!)
 *    - X-Robots-Tag HTTP-header
 *
 *  ── GSC / Search ──
 *    - robots.txt — eksisterer? Disallow: /? Sitemap-linjer?
 *    - Sitemap discovery — funnet?
 *    - Site Verification — verifisert av denne producerens konto?
 *    - Search Console property registrert?
 *    - Sitemap-status (errors/warnings/lastDownloaded)?
 *    - URL Inspection — hjemmeside indeksert?
 */
export async function diagnoseClientSetup(
  pool: Pool,
  opts: {
    producerUserId: string;
    websiteUrl: string;
    /** Forventede IDer fra client_ads_configs — for matching mot HTML-funn */
    expectedGa4MeasurementId?: string | null;
    expectedAwConversionId?: string | null;
    expectedGtmContainerId?: string | null;
  },
): Promise<{
  ok: boolean;
  checks: Array<{
    id: string;
    label: string;
    status: "ok" | "warning" | "error" | "info";
    message: string;
    detail?: any;
  }>;
}> {
  const checks: Array<{ id: string; label: string; status: "ok" | "warning" | "error" | "info"; message: string; detail?: any }> = [];

  const baseUrl = opts.websiteUrl.replace(/\/+$/, "");
  const hostname = (() => { try { return new URL(opts.websiteUrl).hostname; } catch { return ""; } })();
  const domainProp = hostname ? `sc-domain:${hostname.replace(/^www\./, "")}` : null;
  const httpsProp = `${baseUrl}/`;

  // ── HTML-stack: hent siden én gang, kjør alle script-/meta-sjekker ───
  let htmlText = "";
  let xRobotsHeader = "";
  try {
    const r = await fetch(httpsProp, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TheRoleRoomAgent/1.0)" },
      signal: AbortSignal.timeout(10000),
    });
    if (r.ok) {
      htmlText = await r.text();
      xRobotsHeader = r.headers.get("x-robots-tag") || "";
    } else {
      checks.push({
        id: "html-fetch",
        label: "Hent klient-HTML",
        status: "error",
        message: `Kunne ikke hente ${httpsProp} (HTTP ${r.status}). Sjekk at siden er live + ikke krever auth.`,
      });
    }
  } catch (err) {
    checks.push({
      id: "html-fetch",
      label: "Hent klient-HTML",
      status: "error",
      message: `Kunne ikke laste siden: ${String(err).slice(0, 100)}`,
    });
  }

  if (htmlText) {
    // Gtag.js loadet?
    const gtagScript = /<script[^>]+src=["'][^"']*googletagmanager\.com\/gtag\/js[^"']*["']/i.test(htmlText);

    // GA4: matcher G-XXXXXXXXXX (10 chars etter G-)
    const ga4Matches = Array.from(new Set([...htmlText.matchAll(/G-[A-Z0-9]{10}/g)].map((m) => m[0])));

    // Google Ads: matcher AW-XXXXXXXXXX (vanligvis 10-15 sifre etter AW-)
    const awMatches = Array.from(new Set([...htmlText.matchAll(/AW-\d{6,15}/g)].map((m) => m[0])));

    // GTM container ID
    const gtmHeadMatches = Array.from(new Set([...htmlText.matchAll(/GTM-[A-Z0-9]{4,10}/g)].map((m) => m[0])));
    const gtmNoscript = /<noscript>[^<]*<iframe[^>]+ns\.html\?id=GTM-/i.test(htmlText);

    // Andre pixels (informasjons-flag)
    const hasMetaPixel = /fbq\s*\(\s*['"]init['"]/i.test(htmlText) || /connect\.facebook\.net\/[a-z_]+\/fbevents\.js/i.test(htmlText);
    const hasLinkedIn = /_linkedin_(data_)?partner_ids?/i.test(htmlText) || /snap\.licdn\.com\/li\.lms-analytics\/insight\.min\.js/i.test(htmlText);
    const hasTiktok = /ttq\.load\s*\(/i.test(htmlText) || /analytics\.tiktok\.com/i.test(htmlText);
    const hasClarity = /clarity\.ms\/tag|window\.clarity\b/i.test(htmlText);
    const hasHotjar = /static\.hotjar\.com|hjid:/i.test(htmlText);

    // Consent Mode v2
    const hasConsentMode = /gtag\s*\(\s*['"]consent['"]/i.test(htmlText);

    // JSON-LD structured data
    const jsonLdMatches = htmlText.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? [];
    const jsonLdTypes: string[] = [];
    for (const block of jsonLdMatches) {
      const inner = block.replace(/<script[^>]*>/i, "").replace(/<\/script>/i, "");
      try {
        const parsed = JSON.parse(inner);
        const items = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of items) {
          if (item["@type"]) jsonLdTypes.push(Array.isArray(item["@type"]) ? item["@type"].join(",") : item["@type"]);
        }
      } catch { /* ignorer parse-feil */ }
    }

    // SEO basics
    const title = (htmlText.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || "").trim();
    const metaDesc = (htmlText.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] || "").trim();
    const canonical = (htmlText.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i)?.[1] || "").trim();
    const ogTitle = /<meta[^>]+property=["']og:title["']/i.test(htmlText);
    const ogImage = /<meta[^>]+property=["']og:image["']/i.test(htmlText);
    const viewport = /<meta[^>]+name=["']viewport["']/i.test(htmlText);
    const robotsMeta = (htmlText.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)["']/i)?.[1] || "").toLowerCase();
    const hasNoindex = /\bnoindex\b/.test(robotsMeta) || /noindex/i.test(xRobotsHeader);

    // ── GA4 ──
    if (ga4Matches.length === 0) {
      checks.push({
        id: "ga4-tag",
        label: "GA4 measurement-tag",
        status: "warning",
        message: gtagScript
          ? "gtag.js er loadet, men ingen G-XXX measurement-ID funnet. GA4-property er ikke aktivert."
          : "Ingen GA4-tag på siden. Sett opp GA4 og lim inn G-XXX-ID.",
      });
    } else if (opts.expectedGa4MeasurementId && !ga4Matches.includes(opts.expectedGa4MeasurementId)) {
      checks.push({
        id: "ga4-tag",
        label: "GA4 measurement-tag",
        status: "warning",
        message: `Funnet ${ga4Matches.join(", ")} på siden, men vår config peker på ${opts.expectedGa4MeasurementId}. Klient bruker feil property.`,
        detail: { found: ga4Matches, expected: opts.expectedGa4MeasurementId },
      });
    } else {
      checks.push({
        id: "ga4-tag",
        label: "GA4 measurement-tag",
        status: "ok",
        message: `Funnet ${ga4Matches.length} GA4-ID${ga4Matches.length === 1 ? "" : "er"}: ${ga4Matches.join(", ")}`,
      });
    }

    // ── Google Ads ──
    if (awMatches.length === 0) {
      checks.push({
        id: "ads-tag",
        label: "Google Ads conversion-tag",
        status: "warning",
        message: "Ingen AW-ID på siden. Etter sync må gtag-snippeten limes inn for at conversions skal fyre.",
      });
    } else if (opts.expectedAwConversionId && !awMatches.some((a) => a === opts.expectedAwConversionId)) {
      checks.push({
        id: "ads-tag",
        label: "Google Ads conversion-tag",
        status: "warning",
        message: `Funnet ${awMatches.join(", ")} på siden, men vi tracker mot ${opts.expectedAwConversionId}. Klient kjører trolig en gammel Ads-konto i tillegg.`,
        detail: { found: awMatches, expected: opts.expectedAwConversionId },
      });
    } else {
      checks.push({
        id: "ads-tag",
        label: "Google Ads conversion-tag",
        status: "ok",
        message: `Funnet ${awMatches.join(", ")}.`,
      });
    }

    // ── GTM ──
    if (gtmHeadMatches.length === 0) {
      checks.push({
        id: "gtm-snippet",
        label: "GTM container",
        status: "info",
        message: "Ingen GTM-container på siden. Hvis du bruker GTM må snippet limes inn — vi kan auto-generere det.",
      });
    } else if (!gtmNoscript) {
      checks.push({
        id: "gtm-snippet",
        label: "GTM container",
        status: "warning",
        message: `${gtmHeadMatches.join(", ")} funnet i <head>, men <noscript>-iframe mangler i <body>. Brukere uten JS spores ikke.`,
        detail: { gtmIds: gtmHeadMatches },
      });
    } else if (opts.expectedGtmContainerId && !gtmHeadMatches.includes(opts.expectedGtmContainerId)) {
      checks.push({
        id: "gtm-snippet",
        label: "GTM container",
        status: "warning",
        message: `Klient kjører ${gtmHeadMatches.join(", ")}, men vår config peker på ${opts.expectedGtmContainerId}.`,
        detail: { found: gtmHeadMatches, expected: opts.expectedGtmContainerId },
      });
    } else {
      checks.push({
        id: "gtm-snippet",
        label: "GTM container",
        status: "ok",
        message: `${gtmHeadMatches.join(", ")} satt opp riktig i <head> + <body>.`,
      });
    }

    // ── Consent Mode v2 ──
    if (!hasConsentMode && (ga4Matches.length > 0 || awMatches.length > 0)) {
      checks.push({
        id: "consent-mode",
        label: "Consent Mode v2",
        status: "warning",
        message: "Google-tracking er satt opp, men Consent Mode v2 (gtag('consent', …)) mangler. EU-besøkende uten samtykke vil bli filtrert ut og du mister ~30-50% av data.",
      });
    } else if (hasConsentMode) {
      checks.push({
        id: "consent-mode",
        label: "Consent Mode v2",
        status: "ok",
        message: "gtag('consent', …) er kalt — modellert konvertering kan brukes på avviste samtykke.",
      });
    }

    // ── SEO basics ──
    const seoIssues: string[] = [];
    if (!title) seoIssues.push("title");
    else if (title.length < 25 || title.length > 60) seoIssues.push(`title-lengde (${title.length} tegn — bør være 25-60)`);
    if (!metaDesc) seoIssues.push("meta-description");
    else if (metaDesc.length < 80 || metaDesc.length > 160) seoIssues.push(`description-lengde (${metaDesc.length} tegn — bør være 80-160)`);
    if (!canonical) seoIssues.push("canonical-tag");
    if (!ogTitle || !ogImage) seoIssues.push("Open Graph (og:title/og:image)");
    if (!viewport) seoIssues.push("viewport meta-tag");

    if (seoIssues.length === 0) {
      checks.push({
        id: "seo-basics",
        label: "SEO basics",
        status: "ok",
        message: "title, meta-description, canonical, OG-tags og viewport — alle på plass.",
        detail: { title, metaDescLen: metaDesc.length },
      });
    } else {
      checks.push({
        id: "seo-basics",
        label: "SEO basics",
        status: seoIssues.length >= 3 ? "error" : "warning",
        message: `Mangler/feil: ${seoIssues.join(", ")}.`,
      });
    }

    // ── noindex / X-Robots-Tag — kritisk fordi det blokkerer indeksering ──
    if (hasNoindex) {
      checks.push({
        id: "noindex",
        label: "Indekserings-blokkering",
        status: "error",
        message: `🚫 Siden har noindex-direktiv (${robotsMeta ? `meta-tag: ${robotsMeta}` : ""}${xRobotsHeader ? ` X-Robots-Tag: ${xRobotsHeader}` : ""}). Google vil IKKE indeksere den.`,
      });
    }

    // ── Structured data ──
    if (jsonLdTypes.length === 0) {
      checks.push({
        id: "structured-data",
        label: "Strukturert data (JSON-LD)",
        status: "info",
        message: "Ingen JSON-LD funnet. Anbefal Organization + WebSite + LocalBusiness (om aktuelt) for rich results.",
      });
    } else {
      checks.push({
        id: "structured-data",
        label: "Strukturert data (JSON-LD)",
        status: "ok",
        message: `Funnet schema-typer: ${jsonLdTypes.slice(0, 5).join(", ")}${jsonLdTypes.length > 5 ? ` …+${jsonLdTypes.length - 5}` : ""}.`,
      });
    }

    // ── Andre tracking-pixels (info — ikke feil) ──
    const otherPixels: string[] = [];
    if (hasMetaPixel) otherPixels.push("Meta Pixel");
    if (hasLinkedIn) otherPixels.push("LinkedIn Insight");
    if (hasTiktok) otherPixels.push("TikTok Pixel");
    if (hasClarity) otherPixels.push("Microsoft Clarity");
    if (hasHotjar) otherPixels.push("Hotjar");
    if (otherPixels.length > 0) {
      checks.push({
        id: "other-pixels",
        label: "Andre tracking-systemer",
        status: "info",
        message: `Klient kjører også: ${otherPixels.join(", ")}. Bra å vite for cross-platform-attribusjon.`,
      });
    }
  }

  // ── Google OAuth-avhengige sjekker (resten av flowen krever access-token) ──
  const access = await getGoogleAccessToken(pool, opts.producerUserId);
  if (!access) {
    checks.push({
      id: "auth",
      label: "Google OAuth",
      status: "warning",
      message: "Producer ikke koblet til Google — HTML-sjekker over fungerer, men GSC/Site Verification-sjekker krever 'Koble Google Ads'.",
    });
    return { ok: !checks.some((c) => c.status === "error"), checks };
  }

  // 1) robots.txt
  try {
    const r = await fetch(`${baseUrl}/robots.txt`, { signal: AbortSignal.timeout(7000) });
    if (!r.ok) {
      checks.push({
        id: "robots",
        label: "robots.txt",
        status: "warning",
        message: `Ingen robots.txt funnet (HTTP ${r.status}). Anbefalt — Google klarer seg uten, men en god robots.txt + Sitemap-linje speeder opp indeksering.`,
      });
    } else {
      const text = await r.text();
      const sitemapLines = text.split(/\r?\n/).filter((l) => /^\s*Sitemap\s*:/i.test(l));
      const disallowAll = /Disallow:\s*\/\s*$/im.test(text) && /User-agent:\s*\*/i.test(text);
      if (disallowAll) {
        checks.push({
          id: "robots",
          label: "robots.txt",
          status: "error",
          message: "🚫 robots.txt blokkerer ALT (Disallow: /). Google kan ikke indeksere noe. Klient må fjerne dette først.",
        });
      } else if (sitemapLines.length === 0) {
        checks.push({
          id: "robots",
          label: "robots.txt",
          status: "warning",
          message: "robots.txt finnes, men inneholder ingen Sitemap-linje. Vi auto-detekterer /sitemap.xml som fallback.",
        });
      } else {
        checks.push({
          id: "robots",
          label: "robots.txt",
          status: "ok",
          message: `robots.txt funnet med ${sitemapLines.length} Sitemap-linje${sitemapLines.length === 1 ? "" : "r"}.`,
          detail: { sitemaps: sitemapLines.map((l) => l.replace(/^\s*Sitemap\s*:\s*/i, "").trim()) },
        });
      }
    }
  } catch (err) {
    checks.push({
      id: "robots",
      label: "robots.txt",
      status: "warning",
      message: `Kunne ikke hente robots.txt: ${String(err).slice(0, 100)}`,
    });
  }

  // 2) Sitemap-discovery
  const discovery = await discoverSitemaps(opts.websiteUrl);
  if (discovery.sitemaps.length === 0) {
    checks.push({
      id: "sitemap-found",
      label: "Sitemap (filsystem)",
      status: "error",
      message: "Ingen sitemap.xml funnet på vanlige stier (/sitemap.xml, /sitemap_index.xml). Klient må generere en — uten sitemap er indeksering svært treg.",
    });
  } else {
    checks.push({
      id: "sitemap-found",
      label: "Sitemap (filsystem)",
      status: "ok",
      message: `Fant ${discovery.sitemaps.length} sitemap${discovery.sitemaps.length === 1 ? "" : "s"} (via ${discovery.source}).`,
      detail: { sitemaps: discovery.sitemaps },
    });
  }

  // 3) Site Verification — er siten verifisert?
  // Vi prøver getToken — hvis verifisert returnerer Google et lavt-verbose-svar.
  // Bedre er å sjekke webResources/list for å se hvilke sites producer eier.
  try {
    const wrR = await fetch(`${SITEVERIFY_BASE}/webResource`, {
      headers: { Authorization: `Bearer ${access}` },
    });
    if (wrR.ok) {
      const wrBody = await wrR.json() as { items?: Array<{ site?: { identifier?: string } }> };
      const idents = (wrBody.items ?? []).map((i) => i.site?.identifier ?? "").filter(Boolean);
      const ownsHttps = idents.includes(httpsProp);
      const ownsHttp = idents.includes(`http://${hostname}/`);
      const ownsDomain = domainProp ? idents.includes(domainProp) : false;
      if (ownsHttps || ownsHttp || ownsDomain) {
        checks.push({
          id: "verification",
          label: "Site verifikasjon (Google)",
          status: "ok",
          message: `Producer er verifisert eier av: ${[ownsHttps && httpsProp, ownsHttp && `http://${hostname}/`, ownsDomain && domainProp].filter(Boolean).join(", ")}`,
        });
      } else {
        checks.push({
          id: "verification",
          label: "Site verifikasjon (Google)",
          status: "warning",
          message: "Producer er ikke registrert som eier av denne siten. Kjør 'Verifiser i Search Console' for å gjøre det.",
        });
      }
    } else {
      checks.push({
        id: "verification",
        label: "Site verifikasjon (Google)",
        status: "info",
        message: `Kunne ikke hente verifiserings-liste (HTTP ${wrR.status}).`,
      });
    }
  } catch (err) {
    checks.push({
      id: "verification",
      label: "Site verifikasjon (Google)",
      status: "info",
      message: `Sjekk feilet: ${String(err).slice(0, 100)}`,
    });
  }

  // 4) Search Console — er siten registrert? Hvilken property-type?
  try {
    const sitesR = await fetch(`${SEARCHCONSOLE_BASE}/sites`, {
      headers: { Authorization: `Bearer ${access}` },
    });
    if (sitesR.ok) {
      const sitesBody = await sitesR.json() as {
        siteEntry?: Array<{ siteUrl: string; permissionLevel: string }>;
      };
      const entries = sitesBody.siteEntry ?? [];
      const match = entries.find((e) =>
        e.siteUrl === httpsProp ||
        e.siteUrl === `http://${hostname}/` ||
        (domainProp && e.siteUrl === domainProp),
      );
      if (match) {
        checks.push({
          id: "gsc-property",
          label: "Search Console property",
          status: "ok",
          message: `Siten er registrert som ${match.siteUrl} (tilgang: ${match.permissionLevel}).`,
        });

        // 4b) Sitemap-status fra GSC
        const smR = await fetch(`${SEARCHCONSOLE_BASE}/sites/${encodeURIComponent(match.siteUrl)}/sitemaps`, {
          headers: { Authorization: `Bearer ${access}` },
        });
        if (smR.ok) {
          const smBody = await smR.json() as {
            sitemap?: Array<{ path: string; errors?: string; warnings?: string; lastDownloaded?: string; isPending?: boolean }>;
          };
          const sitemaps = smBody.sitemap ?? [];
          if (sitemaps.length === 0) {
            checks.push({
              id: "gsc-sitemap",
              label: "Sitemap registrert i GSC",
              status: "warning",
              message: "Ingen sitemap submittet til Google ennå. Kjør 'Auto-submit sitemap' for å fikse.",
            });
          } else {
            const totalErrors = sitemaps.reduce((s, x) => s + Number(x.errors ?? 0), 0);
            const totalWarnings = sitemaps.reduce((s, x) => s + Number(x.warnings ?? 0), 0);
            const pending = sitemaps.filter((s) => s.isPending).length;
            if (totalErrors > 0) {
              checks.push({
                id: "gsc-sitemap",
                label: "Sitemap registrert i GSC",
                status: "error",
                message: `${sitemaps.length} sitemap${sitemaps.length === 1 ? "" : "s"} submittet, men ${totalErrors} feil totalt. Sjekk detaljer.`,
                detail: { sitemaps },
              });
            } else if (totalWarnings > 0 || pending > 0) {
              checks.push({
                id: "gsc-sitemap",
                label: "Sitemap registrert i GSC",
                status: "warning",
                message: `${sitemaps.length} sitemap${sitemaps.length === 1 ? "" : "s"} submittet (${totalWarnings} warnings, ${pending} pending).`,
                detail: { sitemaps },
              });
            } else {
              checks.push({
                id: "gsc-sitemap",
                label: "Sitemap registrert i GSC",
                status: "ok",
                message: `${sitemaps.length} sitemap${sitemaps.length === 1 ? "" : "s"} submittet, ingen feil.`,
                detail: { sitemaps },
              });
            }
          }

          // 4c) URL Inspection på hjemmesiden — viktigste signal på indeksering
          try {
            const inspR = await fetch("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
              method: "POST",
              headers: jsonHeaders(access),
              body: JSON.stringify({
                inspectionUrl: httpsProp,
                siteUrl: match.siteUrl,
              }),
            });
            if (inspR.ok) {
              const inspBody = await inspR.json() as {
                inspectionResult?: {
                  indexStatusResult?: { coverageState?: string; verdict?: string; lastCrawlTime?: string };
                };
              };
              const idx = inspBody.inspectionResult?.indexStatusResult;
              if (idx) {
                const verdict = idx.verdict || "UNKNOWN";
                const cov = idx.coverageState || "—";
                const last = idx.lastCrawlTime ? new Date(idx.lastCrawlTime).toLocaleString("nb-NO") : "aldri";
                if (verdict === "PASS") {
                  checks.push({
                    id: "url-inspection",
                    label: "Hjemmeside indeksering",
                    status: "ok",
                    message: `Hjemmesiden er indeksert (${cov}). Sist crawlet: ${last}.`,
                  });
                } else if (verdict === "PARTIAL") {
                  checks.push({
                    id: "url-inspection",
                    label: "Hjemmeside indeksering",
                    status: "warning",
                    message: `Delvis indeksert (${cov}). Sist crawlet: ${last}.`,
                  });
                } else {
                  checks.push({
                    id: "url-inspection",
                    label: "Hjemmeside indeksering",
                    status: "error",
                    message: `Ikke indeksert (${cov}, verdict: ${verdict}). Sist crawlet: ${last}.`,
                  });
                }
              }
            }
          } catch { /* URL Inspection trenger ofte minutter etter verifisering */ }
        }
      } else {
        checks.push({
          id: "gsc-property",
          label: "Search Console property",
          status: "warning",
          message: `Siten er ikke registrert i din Search Console. Verifiser + add — vi gjør det automatisk via 'Verifiser & registrer'.`,
          detail: { availableSites: entries.map((e) => e.siteUrl) },
        });
      }
    } else {
      checks.push({
        id: "gsc-property",
        label: "Search Console property",
        status: "info",
        message: `Kunne ikke liste GSC-properties (HTTP ${sitesR.status}).`,
      });
    }
  } catch (err) {
    checks.push({
      id: "gsc-property",
      label: "Search Console property",
      status: "info",
      message: `Sjekk feilet: ${String(err).slice(0, 100)}`,
    });
  }

  const hasError = checks.some((c) => c.status === "error");
  return { ok: !hasError, checks };
}

/** Be Google om å indeksere/refreshe spesifikke URL'er via Indexing API.
 *  NB: Google's offisielle policy sier denne er for JobPosting + BroadcastEvent
 *  structured-data. I praksis brukes den bredere. Vi sender best-effort — feil
 *  bli rapportert til klient men flow stopper ikke.
 *
 *  Brukes på conversion-side-URL'ene (lead-form, takk-side, etc) så de
 *  indekseres raskere etter setup.
 */
export async function requestIndexingForUrls(
  pool: Pool,
  opts: { producerUserId: string; urls: string[]; type?: "URL_UPDATED" | "URL_DELETED" },
): Promise<{
  ok: true;
  results: Array<{ url: string; ok: boolean; error?: string }>;
}> {
  const access = await getGoogleAccessToken(pool, opts.producerUserId);
  if (!access) return { ok: true, results: opts.urls.map((u) => ({ url: u, ok: false, error: "not_connected" })) };

  const type = opts.type ?? "URL_UPDATED";
  const results: Array<{ url: string; ok: boolean; error?: string }> = [];

  for (const u of opts.urls) {
    try {
      const r = await fetch("https://indexing.googleapis.com/v3/urlNotifications:publish", {
        method: "POST",
        headers: jsonHeaders(access),
        body: JSON.stringify({ url: u, type }),
      });
      if (!r.ok) {
        const text = await r.text();
        results.push({ url: u, ok: false, error: `HTTP ${r.status} — ${text.slice(0, 120)}` });
      } else {
        results.push({ url: u, ok: true });
      }
    } catch (err) {
      results.push({ url: u, ok: false, error: String(err) });
    }
  }
  return { ok: true, results };
}

// ─────────────────────────────────────────────────────────────────────
// GTM — Tag Manager API v2
// https://developers.google.com/tag-platform/tag-manager/api/v2
// ─────────────────────────────────────────────────────────────────────

const GTM_BASE = "https://tagmanager.googleapis.com/tagmanager/v2";

export async function listGtmAccounts(
  pool: Pool,
  producerUserId: string,
): Promise<{ ok: true; accounts: Array<{ accountId: string; name: string }> } | { ok: false; error: string }> {
  const token = await getGoogleAccessToken(pool, producerUserId);
  if (!token) return { ok: false, error: "not_connected" };
  const r = await fetch(`${GTM_BASE}/accounts`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return { ok: false, error: `listAccounts: HTTP ${r.status}` };
  const body = await r.json() as { account?: Array<{ accountId: string; name: string }> };
  return {
    ok: true,
    accounts: (body.account ?? []).map((a) => ({ accountId: a.accountId, name: a.name })),
  };
}

/** Opprett GTM-container (Web) → returnerer GTM-XXXXXXX. */
export async function provisionGtmContainer(
  pool: Pool,
  opts: {
    producerUserId: string;
    accountId: string;
    containerName: string; // klient-navn
    domainName?: string;   // hint til Google
  },
): Promise<
  | { ok: true; accountId: string; containerId: string; publicId: string }
  | { ok: false; error: string }
> {
  const token = await getGoogleAccessToken(pool, opts.producerUserId);
  if (!token) return { ok: false, error: "not_connected" };

  const body = {
    name: opts.containerName,
    usageContext: ["WEB"],
    domainName: opts.domainName ? [opts.domainName] : undefined,
  };
  const r = await fetch(`${GTM_BASE}/accounts/${opts.accountId}/containers`, {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text();
    return { ok: false, error: `createContainer: HTTP ${r.status} — ${t.slice(0, 200)}` };
  }
  const c = await r.json() as { accountId: string; containerId: string; publicId: string };
  return { ok: true, accountId: c.accountId, containerId: c.containerId, publicId: c.publicId };
}

/** Importer alle godkjente actions som GTM-tags (Google Ads Conversion Tracking-template).
 *  Forutsetter at sync-to-google har kjørt (vi trenger AW-ID + label per action). */
export async function importActionsToGtm(
  pool: Pool,
  opts: {
    producerUserId: string;
    accountId: string;
    containerId: string;
    workspaceId?: string;
    awConversionId: string; // f.eks. AW-18197346774
    actions: Array<{
      actionName: string;
      displayName: string;
      label: string;        // AW-konversjonen-label
      defaultValue: number;
      currency: string;
      triggerType: string;  // page_load | form_submit | click | event | …
      urlPattern?: string;
    }>;
  },
): Promise<
  | { ok: true; imported: number; failed: number; details: any[] }
  | { ok: false; error: string }
> {
  const token = await getGoogleAccessToken(pool, opts.producerUserId);
  if (!token) return { ok: false, error: "not_connected" };

  // 1) Hent default workspace hvis ikke spesifisert
  let workspaceId = opts.workspaceId;
  if (!workspaceId) {
    const wsR = await fetch(
      `${GTM_BASE}/accounts/${opts.accountId}/containers/${opts.containerId}/workspaces`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!wsR.ok) return { ok: false, error: `listWorkspaces: HTTP ${wsR.status}` };
    const wsBody = await wsR.json() as { workspace?: Array<{ workspaceId: string; name: string }> };
    const ws = wsBody.workspace?.find((w) => w.name === "Default Workspace") ?? wsBody.workspace?.[0];
    if (!ws) return { ok: false, error: "no_default_workspace" };
    workspaceId = ws.workspaceId;
  }

  const wsPath = `${GTM_BASE}/accounts/${opts.accountId}/containers/${opts.containerId}/workspaces/${workspaceId}`;
  const details: any[] = [];
  let imported = 0;
  let failed = 0;

  for (const a of opts.actions) {
    try {
      // 2a) Opprett trigger basert på triggerType
      const triggerBody = buildGtmTrigger(a);
      const tR = await fetch(`${wsPath}/triggers`, {
        method: "POST",
        headers: jsonHeaders(token),
        body: JSON.stringify(triggerBody),
      });
      if (!tR.ok) {
        const text = await tR.text();
        failed++;
        details.push({ action: a.actionName, error: `trigger: ${tR.status} — ${text.slice(0, 120)}` });
        continue;
      }
      const trigger = await tR.json() as { triggerId: string };

      // 2b) Opprett Google Ads Conversion-tag som fyrer på triggeren
      const tagBody = buildGtmAdsConversionTag(a, opts.awConversionId, trigger.triggerId);
      const tagR = await fetch(`${wsPath}/tags`, {
        method: "POST",
        headers: jsonHeaders(token),
        body: JSON.stringify(tagBody),
      });
      if (!tagR.ok) {
        const text = await tagR.text();
        failed++;
        details.push({ action: a.actionName, error: `tag: ${tagR.status} — ${text.slice(0, 120)}` });
        continue;
      }
      imported++;
      details.push({ action: a.actionName, ok: true, triggerId: trigger.triggerId });
    } catch (err) {
      failed++;
      details.push({ action: a.actionName, error: String(err) });
    }
  }

  return { ok: true, imported, failed, details };
}

function buildGtmTrigger(a: {
  actionName: string;
  triggerType: string;
  urlPattern?: string;
}): Record<string, unknown> {
  const name = `RR Agent — ${a.actionName}`;
  if (a.triggerType === "page_load" && a.urlPattern) {
    return {
      name,
      type: "pageview",
      filter: [{
        type: "matchRegex",
        parameter: [
          { type: "template", key: "arg0", value: "{{Page URL}}" },
          { type: "template", key: "arg1", value: a.urlPattern },
        ],
      }],
    };
  }
  if (a.triggerType === "form_submit") {
    return { name, type: "formSubmission", waitForTags: { type: "boolean", value: "true" } };
  }
  if (a.triggerType === "click") {
    return { name, type: "click" };
  }
  // Default: custom-event matching action_name
  return {
    name,
    type: "customEvent",
    customEventFilter: [{
      type: "equals",
      parameter: [
        { type: "template", key: "arg0", value: "{{_event}}" },
        { type: "template", key: "arg1", value: a.actionName },
      ],
    }],
  };
}

function buildGtmAdsConversionTag(
  a: { actionName: string; displayName: string; label: string; defaultValue: number; currency: string },
  awConversionId: string,
  triggerId: string,
): Record<string, unknown> {
  return {
    name: `Google Ads — ${a.displayName}`,
    type: "awct", // Google Ads Conversion Tracking
    parameter: [
      { type: "template", key: "conversionId", value: awConversionId.replace(/^AW-/, "") },
      { type: "template", key: "conversionLabel", value: a.label },
      { type: "template", key: "conversionValue", value: String(a.defaultValue) },
      { type: "template", key: "currencyCode", value: a.currency || "NOK" },
      { type: "boolean", key: "enableConversionLinker", value: "true" },
    ],
    firingTriggerId: [triggerId],
  };
}
