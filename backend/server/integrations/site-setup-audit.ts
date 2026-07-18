/**
 * site-setup-audit.ts — F1 «audit_site_setup» (doc 14, del 2)
 *
 * Sjekker UAUTENTISERT hva et klient-domene allerede har av analytics- og
 * GEO-oppsett: GA4/GTM/Meta Pixel/Clarity-tagger, consent-plattform,
 * sitemap, robots (slipper den inn AI-boter?), GSC-verifiseringsspor og
 * bot-serving (får GPTBot fullt innhold eller SPA-skall?). Samme funksjon
 * er verifiseringen etter oppsett.
 *
 * Redelighet (doc 14, del 4): `unknown` er et gyldig svar. Consent-gatet
 * oppsett er usynlig i initial HTML — fravær rapporteres som «ikke
 * observerbart», aldri som «mangler» når vi ikke kan vite.
 *
 * SSRF-vern: kun http(s) mot offentlige hostnavn på standardporter.
 * Hostnavn-basert sjekk (private IP-litteraler, localhost, .local/.internal)
 * — DNS-rebinding er utenfor scope for en lese-audit, men fetcheren følger
 * maks 3 redirects og re-validerer hver hopp-URL.
 */

import { externalFetch } from "../external-api.js";

// ─────────────────────────────────────────────────────────────────────
// URL-validering (SSRF-vern)
// ─────────────────────────────────────────────────────────────────────

const PRIVATE_V4 =
  /^(0\.|10\.|127\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/;

export function validateAuditUrl(raw: string): { ok: true; url: URL } | { ok: false; error: string } {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return { ok: false, error: "ugyldig_url" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, error: "kun_http_https" };
  }
  if (url.username || url.password) return { ok: false, error: "credentials_i_url_avvist" };
  if (url.port && url.port !== "80" && url.port !== "443") {
    return { ok: false, error: "kun_standardporter" };
  }
  const host = url.hostname.toLowerCase();
  const isIpV4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "::1" ||
    host.startsWith("[") || // IPv6-litteraler avvises i sin helhet
    (isIpV4 && PRIVATE_V4.test(host))
  ) {
    return { ok: false, error: "privat_adresse_avvist" };
  }
  if (!host.includes(".") && !isIpV4) return { ok: false, error: "ugyldig_hostnavn" };
  return { ok: true, url };
}

// ─────────────────────────────────────────────────────────────────────
// Rene parsere (enhetstestet)
// ─────────────────────────────────────────────────────────────────────

export interface AnalyticsTags {
  ga4: string[];
  gtm: string[];
  metaPixel: string[];
  clarity: string[];
  /** Kjent consent-plattform funnet i HTML (null = ingen gjenkjent). */
  cmp: string | null;
  gscMetaTag: boolean;
}

const CMP_SIGNATURES: Array<[string, RegExp]> = [
  ["Cookiebot", /cookiebot\.com|Cookiebot/i],
  ["CookieYes", /cookieyes\.com|cookie-law-info/i],
  ["OneTrust", /onetrust\.com|otSDKStub/i],
  ["Usercentrics", /usercentrics\.eu|usercentrics/i],
  ["Termly", /termly\.io/i],
  ["Complianz", /complianz/i],
];

export function parseAnalyticsTags(html: string): AnalyticsTags {
  const uniq = (arr: string[]) => [...new Set(arr)];
  return {
    ga4: uniq([...html.matchAll(/[?&]id=(G-[A-Z0-9]{4,14})/g), ...html.matchAll(/['"](G-[A-Z0-9]{4,14})['"]/g)].map((m) => m[1])),
    gtm: uniq([...html.matchAll(/\b(GTM-[A-Z0-9]{4,10})\b/g)].map((m) => m[1])),
    metaPixel: uniq([...html.matchAll(/fbq\(\s*['"]init['"]\s*,\s*['"](\d{8,20})['"]/g)].map((m) => m[1])),
    clarity: uniq([
      ...[...html.matchAll(/clarity\.ms\/tag\/([a-z0-9]{6,20})/g)].map((m) => m[1]),
      ...[...html.matchAll(/clarity\s*\(\s*['"]init['"]?[^)]*['"]([a-z0-9]{6,20})['"]/g)].map((m) => m[1]),
    ]),
    cmp: CMP_SIGNATURES.find(([, re]) => re.test(html))?.[0] ?? null,
    gscMetaTag: /<meta[^>]+name=["']google-site-verification["']/i.test(html),
  };
}

/** AI-botene GEO-oppsettet gjelder (+ bingbot: ChatGPT-search-indeksen). */
export const AI_BOTS = ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended", "bingbot"] as const;

export interface RobotsInfo {
  exists: boolean;
  sitemaps: string[];
  /** Per bot: default = ingen egen gruppe (arver *), allowed/disallowed = eksplisitt. */
  bots: Record<string, "allowed" | "disallowed" | "default">;
  /** Blokkerer '*'-gruppen alt (Disallow: /)? */
  blocksAll: boolean;
}

export function parseRobots(txt: string | null): RobotsInfo {
  const bots: RobotsInfo["bots"] = Object.fromEntries(AI_BOTS.map((b) => [b, "default" as const]));
  if (txt === null) return { exists: false, sitemaps: [], bots, blocksAll: false };

  const sitemaps: string[] = [];
  // Grupper: sekvens av User-agent-linjer etterfulgt av direktiver.
  let currentAgents: string[] = [];
  let lastWasAgent = false;
  const groups: Array<{ agents: string[]; disallowAll: boolean; allowRoot: boolean }> = [];
  let current: { agents: string[]; disallowAll: boolean; allowRoot: boolean } | null = null;

  for (const rawLine of txt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === "sitemap" && value) sitemaps.push(value);
    if (key === "user-agent") {
      if (!lastWasAgent) {
        currentAgents = [];
        current = { agents: currentAgents, disallowAll: false, allowRoot: false };
        groups.push(current);
      }
      currentAgents.push(value.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (!current) continue;
      if (key === "disallow" && (value === "/" || value === "/*")) current.disallowAll = true;
      if (key === "allow" && value === "/") current.allowRoot = true;
    }
  }

  const starGroup = groups.find((g) => g.agents.includes("*"));
  for (const bot of AI_BOTS) {
    const own = groups.find((g) => g.agents.includes(bot.toLowerCase()));
    if (own) bots[bot] = own.disallowAll && !own.allowRoot ? "disallowed" : "allowed";
  }
  return { exists: true, sitemaps, bots, blocksAll: Boolean(starGroup?.disallowAll && !starGroup.allowRoot) };
}

/** Synlig tekst: uten script/style/tags — grunnlaget for bot-diffen. */
export function extractVisibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type BotServingVerdict = "full_content" | "same_as_human" | "thin" | "blocked" | "error";

export interface BotServing {
  verdict: BotServingVerdict;
  humanChars: number;
  botChars: number;
  botStatus: number | null;
}

export function compareBotServing(
  humanHtml: string | null,
  botHtml: string | null,
  botStatus: number | null,
): BotServing {
  const humanChars = humanHtml ? extractVisibleText(humanHtml).length : 0;
  const botChars = botHtml ? extractVisibleText(botHtml).length : 0;
  if (botStatus !== null && (botStatus === 403 || botStatus === 451 || botStatus === 429)) {
    return { verdict: "blocked", humanChars, botChars, botStatus };
  }
  if (botHtml === null || humanHtml === null) {
    return { verdict: "error", humanChars, botChars, botStatus };
  }
  const ratio = humanChars > 0 ? botChars / humanChars : botChars > 0 ? 2 : 1;
  const verdict: BotServingVerdict =
    ratio >= 1.2 ? "full_content" : ratio >= 0.8 ? "same_as_human" : "thin";
  return { verdict, humanChars, botChars, botStatus };
}

// ─────────────────────────────────────────────────────────────────────
// Rapportbygging
// ─────────────────────────────────────────────────────────────────────

export type CapabilityStatus = "implemented" | "partial" | "missing" | "unknown";

export interface AuditCapability {
  key: string;
  label: string;
  status: CapabilityStatus;
  details: string;
  recommendation: string | null;
}

export interface SiteSetupAudit {
  url: string;
  fetchedAt: string;
  capabilities: AuditCapability[];
  /** Redelighet: hva auditen IKKE kan se utenfra. */
  limitations: string[];
}

export function buildAuditReport(input: {
  url: string;
  fetchedAt: string;
  tags: AnalyticsTags;
  robots: RobotsInfo;
  sitemap: { status: number | null; locCount: number; hasLastmod: boolean };
  botServing: BotServing;
}): SiteSetupAudit {
  const { tags, robots, sitemap, botServing } = input;
  const caps: AuditCapability[] = [];

  caps.push({
    key: "ga4",
    label: "Google Analytics 4",
    status: tags.ga4.length > 0 ? "implemented" : "unknown",
    details: tags.ga4.length > 0 ? `Måle-ID funnet: ${tags.ga4.join(", ")}` : "Ingen G-…-tag i initial HTML.",
    recommendation: tags.ga4.length > 0 ? null
      : "Ikke funnet i initial HTML — kan være consent-gatet (riktig!) eller mangle. Verifiser i nettleser med samtykke gitt; mangler den, sett opp GA4 (guide F4).",
  });

  caps.push({
    key: "gtm",
    label: "Google Tag Manager",
    status: tags.gtm.length > 0 ? "implemented" : "unknown",
    details: tags.gtm.length > 0 ? `Container: ${tags.gtm.join(", ")}` : "Ingen GTM-container i initial HTML.",
    recommendation: tags.gtm.length > 1
      ? "Flere containere funnet — verifiser at alle er egne (vi har selv funnet fremmed, tom container i egen kodebase)."
      : null,
  });

  const pixelFound = tags.metaPixel.length > 0;
  caps.push({
    key: "meta_pixel",
    label: "Meta Pixel",
    // Pixel i initial HTML fyrer FØR samtykke → GDPR-funn, ikke suksess.
    status: pixelFound ? "partial" : "unknown",
    details: pixelFound
      ? `Pixel ${tags.metaPixel.join(", ")} lastes i initial HTML — fyrer trolig før samtykke.`
      : "Ingen fbq i initial HTML.",
    recommendation: pixelFound
      ? "Gate pixelen på MARKETING-samtykke (strengere enn analytics-samtykke) — se mønsteret i doc 14 §1.4."
      : "Kan være korrekt consent-gatet eller mangle — verifiser med samtykke gitt.",
  });

  caps.push({
    key: "clarity",
    label: "Microsoft Clarity",
    status: tags.clarity.length > 0 ? "implemented" : "unknown",
    details: tags.clarity.length > 0 ? `Prosjekt: ${tags.clarity.join(", ")}` : "Ikke funnet i initial HTML.",
    recommendation: null,
  });

  caps.push({
    key: "consent",
    label: "Consent-plattform",
    status: tags.cmp ? "implemented" : "unknown",
    details: tags.cmp ? `Gjenkjent CMP: ${tags.cmp}` : "Ingen kjent CMP gjenkjent (egen banner er også mulig).",
    recommendation: tags.cmp ? null : "Verifiser at analytics/marketing gates på faktisk samtykke — auditen kan ikke avgjøre dette statisk.",
  });

  caps.push({
    key: "sitemap",
    label: "Sitemap",
    status: sitemap.status === 200 && sitemap.locCount > 0 ? "implemented" : sitemap.status === 200 ? "partial" : "missing",
    details: sitemap.status === 200
      ? `${sitemap.locCount} URL-er${sitemap.hasLastmod ? ", med lastmod" : ", uten lastmod"}.`
      : `Ingen sitemap funnet (HTTP ${sitemap.status ?? "—"}).`,
    recommendation: sitemap.status === 200 && sitemap.locCount > 0
      ? (sitemap.hasLastmod ? null : "Legg på <lastmod> — crawl-prioritering for både Google og AI-indekser.")
      : "Generer sitemap og deklarer den i robots.txt.",
  });

  const disallowed = AI_BOTS.filter((b) => robots.bots[b] === "disallowed" || (robots.bots[b] === "default" && robots.blocksAll));
  caps.push({
    key: "robots_ai",
    label: "Robots — AI-boter",
    status: !robots.exists ? "partial" : disallowed.length === 0 ? "implemented" : "missing",
    details: !robots.exists
      ? "Ingen robots.txt (boter slipper inn, men sitemap-deklarasjon mangler)."
      : disallowed.length === 0
        ? "Ingen AI-boter blokkeres."
        : `Blokkerte boter: ${disallowed.join(", ")} — innholdet er usynlig for disse AI-plattformene.`,
    recommendation: disallowed.length > 0
      ? "Fjern blokkering for AI-botene som skal kunne sitere innholdet (GEO-forutsetning)."
      : !robots.exists ? "Opprett robots.txt med sitemap-deklarasjon." : null,
  });

  caps.push({
    key: "gsc",
    label: "Search Console-verifisering",
    status: tags.gscMetaTag ? "implemented" : "unknown",
    details: tags.gscMetaTag ? "google-site-verification-metatag funnet." : "Ingen metatag — DNS-/fil-verifisering er ikke observerbar utenfra.",
    recommendation: tags.gscMetaTag ? null : "Bekreft i GSC-kontoen; mangler property, følg guide F4.",
  });

  const bs = botServing;
  caps.push({
    key: "bot_serving",
    label: "GEO — innhold servert til AI-boter",
    status: bs.verdict === "full_content" ? "implemented"
      : bs.verdict === "same_as_human" ? (bs.humanChars < 1500 ? "missing" : "partial")
      : bs.verdict === "error" ? "unknown" : "missing",
    details: bs.verdict === "blocked"
      ? `Bot-UA får HTTP ${bs.botStatus} — aktivt blokkert.`
      : bs.verdict === "error"
        ? "Kunne ikke sammenligne (nettverksfeil)."
        : `Menneske: ${bs.humanChars} tegn synlig tekst; GPTBot-UA: ${bs.botChars} tegn (${bs.verdict === "full_content" ? "prerendret/rikere" : bs.verdict === "same_as_human" ? "identisk" : "tynnere"}).`,
    recommendation: bs.verdict === "full_content" ? null
      : bs.verdict === "same_as_human" && bs.humanChars < 1500
        ? "SPA-skall: boter ser nesten ingenting. Sett opp bot-UA-prerendering (doc 14 §1.6 / plan F5)."
        : bs.verdict === "same_as_human" ? null
        : "Server fullt statisk innhold til AI-bot-UA-er (doc 14 §1.6).",
  });

  return {
    url: input.url,
    fetchedAt: input.fetchedAt,
    capabilities: caps,
    limitations: [
      "Consent-gatet oppsett er usynlig i initial HTML — «unknown» betyr ikke observerbart, ikke fraværende.",
      "GSC-verifisering via DNS eller opplastet fil kan ikke ses utenfra.",
      "Bot-diffen bruker GPTBot-UA fra vår server; enkelte CDN-er behandler ekte bot-IP-er annerledes.",
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────
// Orkestrator (fetcher injiseres for testbarhet)
// ─────────────────────────────────────────────────────────────────────

export type AuditFetcher = (url: string, userAgent: string) => Promise<{ status: number; text: string } | null>;

const HUMAN_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const BOT_UA = "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot";
const MAX_BODY_CHARS = 1_500_000;
const MAX_REDIRECTS = 3;

export const defaultAuditFetcher: AuditFetcher = async (url, userAgent) => {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const check = validateAuditUrl(current);
    if (!check.ok) return null; // redirect inn i privat adresse → avbryt
    try {
      const res = await externalFetch(check.url, {
        headers: { "User-Agent": userAgent, Accept: "text/html,application/xhtml+xml,text/plain,application/xml" },
        redirect: "manual",
        timeoutMs: 15_000,
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return { status: res.status, text: "" };
        current = new URL(loc, check.url).toString();
        continue;
      }
      const text = (await res.text()).slice(0, MAX_BODY_CHARS);
      return { status: res.status, text };
    } catch {
      return null;
    }
  }
  return null;
};

export async function runSiteSetupAudit(
  rawUrl: string,
  fetcher: AuditFetcher = defaultAuditFetcher,
): Promise<{ audit: SiteSetupAudit } | { error: string }> {
  const check = validateAuditUrl(rawUrl);
  if (!check.ok) return { error: check.error };
  const origin = check.url.origin;
  const pageUrl = check.url.toString();

  const [human, bot, robotsRes] = await Promise.all([
    fetcher(pageUrl, HUMAN_UA),
    fetcher(pageUrl, BOT_UA),
    fetcher(`${origin}/robots.txt`, HUMAN_UA),
  ]);

  const robots = parseRobots(robotsRes && robotsRes.status === 200 ? robotsRes.text : null);
  // Sitemap: robots-deklarert sti først (samme origin), ellers /sitemap.xml.
  const declared = robots.sitemaps.find((s) => { try { return new URL(s).origin === origin; } catch { return false; } });
  const sitemapRes = await fetcher(declared ?? `${origin}/sitemap.xml`, HUMAN_UA);
  const sitemapText = sitemapRes && sitemapRes.status === 200 ? sitemapRes.text : "";

  const audit = buildAuditReport({
    url: pageUrl,
    fetchedAt: new Date().toISOString(),
    tags: parseAnalyticsTags(human?.text ?? ""),
    robots,
    sitemap: {
      status: sitemapRes?.status ?? null,
      locCount: (sitemapText.match(/<loc>/g) ?? []).length,
      hasLastmod: sitemapText.includes("<lastmod>"),
    },
    botServing: compareBotServing(human?.text ?? null, bot?.text ?? null, bot?.status ?? null),
  });
  return { audit };
}
