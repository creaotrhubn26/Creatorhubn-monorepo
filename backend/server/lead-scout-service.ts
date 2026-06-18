/**
 * lead-scout-service.ts
 *
 * Crawl + Claude-needs-deteksjon for én lead. Bygd som live-case fra
 * medside.no-audit 2026-06-18: SPA-fingerprint, manglende GA4/GTM/
 * Meta pixel/Google Ads/structured data avdekket med ren HTML-fetch.
 *
 * Pipeline:
 *   1. Hent HTML + headers + robots.txt + sitemap.xml fra lead's
 *      website_url
 *   2. Klassifisér tech-stack (Next/Vite/Lovable/WordPress/etc.)
 *   3. Pixel-deteksjon (GTM, GA4, Meta, LinkedIn, TikTok, Google Ads)
 *   4. SEO-sjekk (canonical, hreflang, OG, JSON-LD, sitemap, robots)
 *   5. Send observasjons-rapport til Claude → strukturerte needs +
 *      signals + per-dimensjon scores
 *   6. Skriv til crm_customer_needs / crm_customer_signals /
 *      crm_customer_scores + scout-run-rad
 *
 * Gated på `marketing.scout.run` i registreringen.
 */

import type { Pool } from "pg";
import { callClaudeForJson, ClaudeJsonParseError } from "./claude-json-helper.js";

// ─────────────────────────────────────────────────────────────────
// Typer
// ─────────────────────────────────────────────────────────────────

export interface ScoutObservations {
  // Tilgjengelighet
  url: string;
  fetched: boolean;
  http_status?: number;
  bytes?: number;
  redirected_to?: string;

  // Tech-stack
  tech: {
    framework: string | null;          // 'lovable' | 'next' | 'vite' | 'wordpress' | ...
    builder: string | null;            // 'lovable' (gpt-engineer) | 'webflow' | 'squarespace' | ...
    is_spa: boolean;
    has_hreflang: boolean;
    language: string | null;           // 'nb' | 'no' | 'en' | ...
  };

  // Analytics + ads-pixels
  pixels: {
    gtm: string | null;                // GTM-XXXXXXX
    ga4: string | null;                // G-XXXXXXX
    ua: string | null;                 // UA-XXXXXX-X
    meta_pixel_id: string | null;
    tiktok_pixel: boolean;
    linkedin_insight: string | null;
    google_ads_conversion: boolean;
    hotjar: boolean;
    plausible: boolean;
    posthog: boolean;
    mixpanel: boolean;
    matomo: boolean;
  };

  // SEO-basics
  seo: {
    has_title: boolean;
    has_meta_description: boolean;
    has_canonical: boolean;
    has_open_graph: boolean;
    has_twitter_card: boolean;
    json_ld_blocks: number;
    has_google_site_verification: boolean;
    sitemap_status: number | null;     // HTTP-status fra /sitemap.xml
    sitemap_urls: number;              // antall <loc>
    robots_status: number | null;
    robots_allows_googlebot: boolean;
  };

  // Performance/visuals
  performance: {
    image_count: number;
    webp_count: number;
    avif_count: number;
    lazy_loaded_count: number;
    html_size_bytes: number;
  };

  // SoMe-tilstedeværelse (lenker funnet i HTML)
  social: {
    instagram: string | null;
    facebook: string | null;
    linkedin: string | null;
    tiktok: string | null;
    twitter: string | null;
    youtube: string | null;
  };
}

interface ClaudeScoutPayload {
  needs: Array<{
    need_type: string;
    priority: number;        // 1-5
    confidence: number;      // 0-100
    evidence: string;
  }>;
  signals: Array<{
    signal_type: string;
    polarity: "positive" | "negative" | "neutral";
    raw_value: string;
  }>;
  scores: Array<{
    dimension: string;
    normalized_0_100: number;
    raw_value: string;
  }>;
}

// ─────────────────────────────────────────────────────────────────
// Crawling
// ─────────────────────────────────────────────────────────────────

function normalizeUrl(input: string): string | null {
  let u = input.trim();
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  try {
    return new URL(u).toString();
  } catch {
    return null;
  }
}

async function fetchText(
  url: string, timeoutMs = 12000, maxBytes = 200_000,
): Promise<{ status: number; text: string; bytes: number } | null> {
  try {
    const resp = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; CreatorhubLeadScout/1.0)",
        accept: "text/html, application/xml, */*",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const reader = resp.body?.getReader();
    if (!reader) {
      const text = await resp.text();
      return { status: resp.status, text, bytes: text.length };
    }
    let received = "";
    let bytes = 0;
    const dec = new TextDecoder("utf-8");
    while (bytes < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      received += dec.decode(value, { stream: true });
      bytes += value.byteLength;
    }
    try { await reader.cancel(); } catch { /* noop */ }
    return { status: resp.status, text: received, bytes };
  } catch {
    return null;
  }
}

async function probeUrl(url: string): Promise<number | null> {
  try {
    const resp = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(7000),
      redirect: "follow",
    });
    return resp.status;
  } catch {
    return null;
  }
}

/** Hovedanalyse: render observasjoner fra HTML + sitemap + robots. */
export async function crawlAndObserve(rawUrl: string): Promise<ScoutObservations> {
  const url = normalizeUrl(rawUrl) ?? rawUrl;

  const obs: ScoutObservations = {
    url, fetched: false,
    tech: { framework: null, builder: null, is_spa: false, has_hreflang: false, language: null },
    pixels: {
      gtm: null, ga4: null, ua: null, meta_pixel_id: null,
      tiktok_pixel: false, linkedin_insight: null, google_ads_conversion: false,
      hotjar: false, plausible: false, posthog: false, mixpanel: false, matomo: false,
    },
    seo: {
      has_title: false, has_meta_description: false, has_canonical: false,
      has_open_graph: false, has_twitter_card: false, json_ld_blocks: 0,
      has_google_site_verification: false,
      sitemap_status: null, sitemap_urls: 0,
      robots_status: null, robots_allows_googlebot: false,
    },
    performance: {
      image_count: 0, webp_count: 0, avif_count: 0,
      lazy_loaded_count: 0, html_size_bytes: 0,
    },
    social: {
      instagram: null, facebook: null, linkedin: null,
      tiktok: null, twitter: null, youtube: null,
    },
  };

  const main = await fetchText(url);
  if (!main) return obs;
  obs.fetched = true;
  obs.http_status = main.status;
  obs.bytes = main.bytes;
  const html = main.text;
  obs.performance.html_size_bytes = main.bytes;

  // ── Tech-fingerprint ────────────────────────────────────────────
  if (/__l5e\/events|gpt-engineer-file-uploads|~flock\.js/i.test(html)) {
    obs.tech.builder = "lovable";
    obs.tech.framework = "vite";
    obs.tech.is_spa = true;
  } else if (/__NEXT_DATA__|next-route|\/_next\//i.test(html)) {
    obs.tech.framework = "next";
  } else if (/<meta name="generator" content="WordPress/i.test(html) || /wp-content/i.test(html)) {
    obs.tech.framework = "wordpress";
    obs.tech.builder = "wordpress";
  } else if (/squarespace|sqsp\.com/i.test(html)) {
    obs.tech.framework = "squarespace";
    obs.tech.builder = "squarespace";
  } else if (/webflow\.com|wf-form/i.test(html)) {
    obs.tech.framework = "webflow";
    obs.tech.builder = "webflow";
  } else if (/index-[A-Za-z0-9]{8}\.js/.test(html) && main.bytes < 30000) {
    obs.tech.framework = "vite";
    obs.tech.is_spa = true;
  }

  const langMatch = html.match(/<html[^>]+lang="([a-z-]+)"/i);
  if (langMatch) obs.tech.language = langMatch[1];
  obs.tech.has_hreflang = /hreflang=/i.test(html);

  // ── Pixels ──────────────────────────────────────────────────────
  obs.pixels.gtm = html.match(/GTM-[A-Z0-9]{6,}/)?.[0] ?? null;
  obs.pixels.ga4 = html.match(/G-[A-Z0-9]{8,}/)?.[0] ?? null;
  obs.pixels.ua = html.match(/UA-\d+-\d+/)?.[0] ?? null;
  obs.pixels.meta_pixel_id =
    html.match(/fbq\(['"]init['"],\s*['"]?(\d{10,})/)?.[1] ?? null;
  obs.pixels.tiktok_pixel = /ttq\.|TikTokAnalyticsObject/.test(html);
  obs.pixels.linkedin_insight =
    html.match(/_linkedin_partner_id\s*=\s*['"]?(\d+)/)?.[1] ?? null;
  obs.pixels.google_ads_conversion = /AW-\d+/.test(html);
  obs.pixels.hotjar = /static\.hotjar\.com|hjid:/i.test(html);
  obs.pixels.plausible = /plausible\.io\/js/i.test(html);
  obs.pixels.posthog = /posthog\.com|posthog-js/i.test(html);
  obs.pixels.mixpanel = /mixpanel\.com\/track|mixpanel\.init/i.test(html);
  obs.pixels.matomo = /matomo\.js|_paq\.push/i.test(html);

  // ── SEO-basics ──────────────────────────────────────────────────
  obs.seo.has_title = /<title[^>]*>[^<]+<\/title>/i.test(html);
  obs.seo.has_meta_description = /<meta[^>]+name="description"[^>]+content="[^"]{10,}"/i.test(html);
  obs.seo.has_canonical = /<link[^>]+rel="canonical"[^>]+href=/i.test(html);
  obs.seo.has_open_graph = /property="og:(title|type|url|image)"/i.test(html);
  obs.seo.has_twitter_card = /name="twitter:(card|title|description)"/i.test(html);
  obs.seo.json_ld_blocks = (html.match(/type="application\/ld\+json"/g) ?? []).length;
  obs.seo.has_google_site_verification = /name="google-site-verification"/i.test(html);

  // ── Performance ─────────────────────────────────────────────────
  obs.performance.image_count = (html.match(/<img\b/gi) ?? []).length;
  obs.performance.webp_count = (html.match(/\.webp\b/gi) ?? []).length;
  obs.performance.avif_count = (html.match(/\.avif\b/gi) ?? []).length;
  obs.performance.lazy_loaded_count = (html.match(/loading="lazy"/gi) ?? []).length;

  // ── Social ──────────────────────────────────────────────────────
  obs.social.instagram = html.match(/instagram\.com\/[a-zA-Z0-9_.-]+/)?.[0] ?? null;
  obs.social.facebook = html.match(/facebook\.com\/[a-zA-Z0-9_.-]+/)?.[0] ?? null;
  obs.social.linkedin = html.match(/linkedin\.com\/(?:company|in)\/[a-zA-Z0-9_.-]+/)?.[0] ?? null;
  obs.social.tiktok = html.match(/tiktok\.com\/@[a-zA-Z0-9_.-]+/)?.[0] ?? null;
  obs.social.twitter = html.match(/(?:twitter\.com|x\.com)\/[a-zA-Z0-9_.-]+/)?.[0] ?? null;
  obs.social.youtube = html.match(/youtube\.com\/(?:channel|@|c\/)[a-zA-Z0-9_.-]+/)?.[0] ?? null;

  // ── Sitemap + robots ────────────────────────────────────────────
  try {
    const baseUrl = new URL(url);
    const robotsUrl = `${baseUrl.origin}/robots.txt`;
    const sitemapUrl = `${baseUrl.origin}/sitemap.xml`;
    const [robots, sitemap] = await Promise.all([
      fetchText(robotsUrl, 6000, 50_000),
      fetchText(sitemapUrl, 8000, 200_000),
    ]);
    if (robots) {
      obs.seo.robots_status = robots.status;
      obs.seo.robots_allows_googlebot = /User-agent:\s*Googlebot[\s\S]*?Allow:/i.test(robots.text);
    } else {
      obs.seo.robots_status = await probeUrl(robotsUrl);
    }
    if (sitemap) {
      obs.seo.sitemap_status = sitemap.status;
      obs.seo.sitemap_urls = (sitemap.text.match(/<loc>/g) ?? []).length;
    } else {
      obs.seo.sitemap_status = await probeUrl(sitemapUrl);
    }
  } catch { /* noop */ }

  return obs;
}

// ─────────────────────────────────────────────────────────────────
// Claude needs/signals/scoring fra observasjoner
// ─────────────────────────────────────────────────────────────────

function buildClaudeSystemPrompt(): string {
  return [
    "Du er en seniorrådgiver i digital markedsføring som skal vurdere",
    "en bedrifts mangler og styrker fra en website-crawl. Du leverer",
    "strukturert JSON: needs (hva de mangler — pitches selger kan bruke),",
    "signals (objektive observasjoner), og scores (per-dimensjon).",
    "",
    "Tillatte need_type-verdier:",
    "  needs_google_analytics, needs_google_tag_manager, needs_meta_pixel,",
    "  needs_google_ads_pixel, needs_linkedin_insight, needs_tiktok_pixel,",
    "  needs_seo_structured_data, needs_ssr_landing, needs_better_website,",
    "  needs_video, needs_reels, needs_photos, needs_drone_footage,",
    "  needs_product_photography, needs_food_content, needs_case_studies,",
    "  needs_customer_testimonials, needs_review_collection, needs_brand_guidelines,",
    "  needs_recruitment_content, needs_launch_campaign, needs_event_coverage,",
    "  needs_partner_visibility, needs_press_kit, needs_landing_page,",
    "  needs_seo_local, needs_email_campaign, needs_newsletter,",
    "  needs_linkedin_presence, needs_tiktok_presence, needs_podcast_appearance,",
    "  needs_influencer_collab, needs_lead_magnet",
    "",
    "Tillatte signal_type-verdier (eksempler):",
    "  has_google_search_console_verified, has_sitemap_with_lastmod,",
    "  has_open_graph_complete, has_canonical, has_hreflang, has_clear_value_prop,",
    "  missing_all_analytics, missing_all_ads_pixels, missing_structured_data,",
    "  spa_rendering_seo_risk, low_image_optimization, low_instagram_activity,",
    "  outdated_branding, mobile_unfriendly_site, slow_page_speed,",
    "  no_gmb_photos, competitor_outranks",
    "",
    "Tillatte dimension-verdier (scoring):",
    "  industry, location, google_rating, website_quality, instagram_activity,",
    "  missing_video, purchasing_power, past_response, service_match,",
    "  years_in_business, employee_count, revenue_growth, seasonality,",
    "  area_competition, decision_maker_accessible, brreg_health",
    "",
    "Regler:",
    "  - Bare bruk need_type/signal_type/dimension-verdier fra listene over",
    "  - priority er 1-5 (5=kritisk), confidence er 0-100",
    "  - polarity er positive/negative/neutral",
    "  - evidence-strenger er konkrete fra observasjonene (ikke generelle)",
    "  - returnér MAKS 12 needs, 12 signals, 8 scores",
    "  - returnér KUN gyldig JSON",
  ].join(" ");
}

function buildClaudeUserPrompt(
  obs: ScoutObservations, leadContext: { name: string; industry?: string | null },
): string {
  return [
    `BEDRIFT: ${leadContext.name}` +
      (leadContext.industry ? ` (${leadContext.industry})` : ""),
    `URL: ${obs.url}`,
    `Hentet: ${obs.fetched ? "ja" : "nei"} (HTTP ${obs.http_status ?? "?"})`,
    ``,
    `TECH:`,
    `  Framework: ${obs.tech.framework ?? "ukjent"}`,
    `  Builder: ${obs.tech.builder ?? "ukjent"}`,
    `  SPA: ${obs.tech.is_spa ? "ja" : "nei"}`,
    `  HTML-størrelse: ${obs.performance.html_size_bytes} bytes`,
    `  Språk: ${obs.tech.language ?? "?"}, hreflang: ${obs.tech.has_hreflang ? "ja" : "nei"}`,
    ``,
    `PIXELS:`,
    `  GTM: ${obs.pixels.gtm ?? "—"}  GA4: ${obs.pixels.ga4 ?? "—"}  UA: ${obs.pixels.ua ?? "—"}`,
    `  Meta Pixel: ${obs.pixels.meta_pixel_id ?? "—"}`,
    `  LinkedIn Insight: ${obs.pixels.linkedin_insight ?? "—"}`,
    `  Google Ads conversion: ${obs.pixels.google_ads_conversion ? "ja" : "—"}`,
    `  TikTok: ${obs.pixels.tiktok_pixel ? "ja" : "—"}`,
    `  Hotjar/Plausible/PostHog/Mixpanel/Matomo: ${[
      obs.pixels.hotjar ? "hotjar" : null,
      obs.pixels.plausible ? "plausible" : null,
      obs.pixels.posthog ? "posthog" : null,
      obs.pixels.mixpanel ? "mixpanel" : null,
      obs.pixels.matomo ? "matomo" : null,
    ].filter(Boolean).join(", ") || "ingen"}`,
    ``,
    `SEO:`,
    `  Title: ${obs.seo.has_title ? "ja" : "—"}  Meta-desc: ${obs.seo.has_meta_description ? "ja" : "—"}`,
    `  Canonical: ${obs.seo.has_canonical ? "ja" : "—"}  hreflang: ${obs.tech.has_hreflang ? "ja" : "—"}`,
    `  Open Graph: ${obs.seo.has_open_graph ? "ja" : "—"}  Twitter Card: ${obs.seo.has_twitter_card ? "ja" : "—"}`,
    `  JSON-LD blocks: ${obs.seo.json_ld_blocks}`,
    `  google-site-verification: ${obs.seo.has_google_site_verification ? "ja" : "—"}`,
    `  Sitemap: HTTP ${obs.seo.sitemap_status ?? "?"} (${obs.seo.sitemap_urls} URL-er)`,
    `  Robots: HTTP ${obs.seo.robots_status ?? "?"}, Googlebot allowed: ${obs.seo.robots_allows_googlebot ? "ja" : "—"}`,
    ``,
    `BILDER/YTELSE:`,
    `  ${obs.performance.image_count} bilder, ${obs.performance.webp_count} WebP, ${obs.performance.avif_count} AVIF, ${obs.performance.lazy_loaded_count} lazy-loaded`,
    ``,
    `SOSIALE MEDIER (lenker funnet i HTML):`,
    `  IG: ${obs.social.instagram ?? "—"}  FB: ${obs.social.facebook ?? "—"}  LinkedIn: ${obs.social.linkedin ?? "—"}`,
    `  TikTok: ${obs.social.tiktok ?? "—"}  YouTube: ${obs.social.youtube ?? "—"}`,
    ``,
    `Lever JSON: { "needs": [...], "signals": [...], "scores": [...] }`,
  ].join("\n");
}

async function classifyWithClaude(
  obs: ScoutObservations,
  leadContext: { name: string; industry?: string | null },
): Promise<ClaudeScoutPayload> {
  const result = await callClaudeForJson<ClaudeScoutPayload>({
    cachedSystem: buildClaudeSystemPrompt(),
    userMessage: buildClaudeUserPrompt(obs, leadContext),
    maxTokens: 2800,
  });
  return result.data;
}

// ─────────────────────────────────────────────────────────────────
// Persistens
// ─────────────────────────────────────────────────────────────────

export interface ScoutResult {
  scout_run_id: string;
  needs_count: number;
  signals_count: number;
  scores_count: number;
  composite_score: number;
  observations: ScoutObservations;
}

export async function runScoutForLead(
  pool: Pool,
  args: {
    customerId: string;
    leadName: string;
    websiteUrl: string;
    industry?: string | null;
    triggeredBy: string;
  },
): Promise<ScoutResult> {
  const runRes = await pool.query<{ id: string }>(
    `INSERT INTO crm_customer_scout_runs
       (customer_id, triggered_by, url_crawled, status)
     VALUES ($1, $2, $3, 'running')
     RETURNING id::text`,
    [args.customerId, args.triggeredBy, args.websiteUrl],
  );
  const runId = runRes.rows[0].id;

  try {
    const obs = await crawlAndObserve(args.websiteUrl);
    if (!obs.fetched) {
      await pool.query(
        `UPDATE crm_customer_scout_runs
            SET status='failed',
                error_message='Kunne ikke hente HTML',
                http_status=$2,
                finished_at=now()
          WHERE id=$1`,
        [runId, obs.http_status ?? null],
      );
      return {
        scout_run_id: runId,
        needs_count: 0, signals_count: 0, scores_count: 0,
        composite_score: 0,
        observations: obs,
      };
    }

    let payload: ClaudeScoutPayload;
    try {
      payload = await classifyWithClaude(obs, {
        name: args.leadName, industry: args.industry,
      });
    } catch (err) {
      await pool.query(
        `UPDATE crm_customer_scout_runs
            SET status='failed',
                error_message=$2,
                http_status=$3,
                bytes_received=$4,
                tech_fingerprint=$5::jsonb,
                finished_at=now()
          WHERE id=$1`,
        [
          runId,
          err instanceof ClaudeJsonParseError
            ? "claude_invalid_json"
            : String(err).slice(0, 500),
          obs.http_status ?? null,
          obs.bytes ?? 0,
          JSON.stringify(obs.tech),
        ],
      );
      throw err;
    }

    // Insert needs (upsert pr customer + need_type)
    for (const n of payload.needs ?? []) {
      await pool.query(
        `INSERT INTO crm_customer_needs
           (customer_id, need_type, priority, claude_confidence, evidence, evidence_url, detected_by)
         VALUES ($1, $2, $3, $4, $5, $6, 'claude')
         ON CONFLICT (customer_id, need_type) DO UPDATE
           SET priority = EXCLUDED.priority,
               claude_confidence = EXCLUDED.claude_confidence,
               evidence = EXCLUDED.evidence,
               evidence_url = EXCLUDED.evidence_url,
               updated_at = now()
           WHERE crm_customer_needs.status IN ('detected', 'accepted')`,
        [
          args.customerId,
          String(n.need_type ?? "").slice(0, 60),
          Math.max(1, Math.min(5, Number(n.priority ?? 3))),
          Math.max(0, Math.min(100, Number(n.confidence ?? 70))),
          String(n.evidence ?? "").slice(0, 1000),
          obs.url,
        ],
      );
    }

    // Insert signals
    for (const s of payload.signals ?? []) {
      const pol = s.polarity === "positive" || s.polarity === "negative"
        ? s.polarity : "neutral";
      await pool.query(
        `INSERT INTO crm_customer_signals
           (customer_id, signal_type, polarity, raw_value, source)
         VALUES ($1, $2, $3, $4, 'claude')
         ON CONFLICT (customer_id, signal_type) DO UPDATE
           SET polarity = EXCLUDED.polarity,
               raw_value = EXCLUDED.raw_value,
               detected_at = now()`,
        [
          args.customerId,
          String(s.signal_type ?? "").slice(0, 60),
          pol,
          String(s.raw_value ?? "").slice(0, 500),
        ],
      );
    }

    // Insert scores
    for (const sc of payload.scores ?? []) {
      const norm = Math.max(0, Math.min(100, Math.round(Number(sc.normalized_0_100 ?? 50))));
      await pool.query(
        `INSERT INTO crm_customer_scores
           (customer_id, dimension, raw_value, normalized_0_100, source)
         VALUES ($1, $2, $3, $4, 'claude')
         ON CONFLICT (customer_id, dimension) DO UPDATE
           SET raw_value = EXCLUDED.raw_value,
               normalized_0_100 = EXCLUDED.normalized_0_100,
               computed_at = now()`,
        [
          args.customerId,
          String(sc.dimension ?? "").slice(0, 40),
          String(sc.raw_value ?? "").slice(0, 500),
          norm,
        ],
      );
    }

    // Compute composite (SUM contribution / total weight) + cache i crm_customers
    const composite = await pool.query<{ score: string }>(
      `SELECT COALESCE(ROUND(SUM(contribution) / NULLIF(SUM(weight), 0)), 0)::text AS score
         FROM crm_customer_scores WHERE customer_id = $1`,
      [args.customerId],
    );
    const compositeNum = Math.round(Number(composite.rows[0]?.score ?? 0));
    await pool.query(
      `UPDATE crm_customers
          SET ai_opportunity_score = $2,
              claude_ranked_at = now()
        WHERE id::text = $1`,
      [args.customerId, compositeNum],
    );

    await pool.query(
      `UPDATE crm_customer_scout_runs
          SET status='completed',
              http_status=$2,
              bytes_received=$3,
              tech_fingerprint=$4::jsonb,
              needs_found=$5,
              signals_found=$6,
              scores_computed=$7,
              finished_at=now()
        WHERE id=$1`,
      [
        runId,
        obs.http_status ?? null,
        obs.bytes ?? 0,
        JSON.stringify({ ...obs.tech, pixels: obs.pixels, seo: obs.seo }),
        payload.needs?.length ?? 0,
        payload.signals?.length ?? 0,
        payload.scores?.length ?? 0,
      ],
    );

    return {
      scout_run_id: runId,
      needs_count: payload.needs?.length ?? 0,
      signals_count: payload.signals?.length ?? 0,
      scores_count: payload.scores?.length ?? 0,
      composite_score: compositeNum,
      observations: obs,
    };
  } catch (err) {
    await pool.query(
      `UPDATE crm_customer_scout_runs
          SET status='failed',
              error_message=$2,
              finished_at=now()
        WHERE id=$1 AND status='running'`,
      [runId, String(err).slice(0, 500)],
    );
    throw err;
  }
}
