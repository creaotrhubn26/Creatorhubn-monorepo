/**
 * role-room-website-analyzer.ts
 *
 * Stage 1 of the Website-to-Carousel pipeline.
 *
 * Pulls a website URL through three parsers and merges the results into
 * a BrandProfile that downstream stages (content-strategist, carousel-
 * generator) consume:
 *
 *   axios + cheerio  → text content, USPs, social-links, JSON-LD
 *   favicon fetch    → logo bytes (R2-cached in Slice 1.5)
 *   node-vibrant     → primary/secondary/accent colour palette
 *   <meta theme-color> + CSS variable parsing → brand colours
 *   Claude (Sonnet)  → tone-of-voice, USP refinement, industry tag
 *
 * Visual passes (Playwright screenshot + Claude Vision designStyle) are
 * deferred to Slice 1.5.
 *
 * See memory/website_to_carousel_architecture.md for the full design.
 */

import axios from "axios";
import * as cheerio from "cheerio";
import { createHash } from "node:crypto";
import { Vibrant } from "node-vibrant/node";
import Anthropic from "@anthropic-ai/sdk";

// ─────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────

export type ToneOfVoice = "playful" | "professional" | "warm" | "edgy" | "minimal";

export interface BrandProfile {
  url: string;
  fetchedAt: string;

  businessName: string;
  tagline: string;
  description: string;
  toneOfVoice: ToneOfVoice;
  usps: string[];
  primaryCTA: string;

  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  fonts: {
    heading: string;
    body: string;
  };
  logoUrl: string | null;
  faviconUrl: string | null;

  productCategories: string[];
  hasShop: boolean;
  hasBlog: boolean;
  socialLinks: Array<{ platform: string; url: string }>;

  industry: string;
  targetAudience: string;
}

// ─────────────────────────────────────────────────────────
// Anthropic client (test-injectable)
// ─────────────────────────────────────────────────────────

let anthropicClient: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (anthropicClient) return anthropicClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  anthropicClient = new Anthropic({ apiKey });
  return anthropicClient;
}
export function __setWebsiteAnalyzerAnthropic(client: Anthropic | null): void {
  anthropicClient = client;
}

// HTTP layer is also test-injectable so unit tests don't hit the wire
type HttpFetcher = (url: string, options?: { timeoutMs?: number; binary?: boolean }) => Promise<{
  status: number;
  data: string | Buffer;
  headers: Record<string, string>;
  finalUrl: string;
}>;

const defaultHttp: HttpFetcher = async (url, options = {}) => {
  const res = await axios.get(url, {
    timeout: options.timeoutMs ?? 15_000,
    responseType: options.binary ? "arraybuffer" : "text",
    headers: { "User-Agent": "RoleRoomWebsiteAnalyzer/1.0" },
    maxRedirects: 5,
    validateStatus: () => true,
  });
  return {
    status: res.status,
    data: options.binary ? Buffer.from(res.data) : (res.data as string),
    headers: res.headers as Record<string, string>,
    finalUrl: res.request?.res?.responseUrl ?? url,
  };
};

let httpFetcher: HttpFetcher = defaultHttp;
export function __setWebsiteAnalyzerHttp(fetcher: HttpFetcher | null): void {
  httpFetcher = fetcher ?? defaultHttp;
}

// ─────────────────────────────────────────────────────────
// Public entry point
// ─────────────────────────────────────────────────────────

export interface AnalyzeOptions {
  /** Skip the Claude pass (used in fast-path tests). */
  skipClaude?: boolean;
}

export async function analyzeWebsite(
  rawUrl: string,
  options: AnalyzeOptions = {},
): Promise<BrandProfile> {
  const url = normalizeUrl(rawUrl);

  // 1. Fetch HTML
  const htmlResult = await httpFetcher(url);
  if (htmlResult.status >= 400 || typeof htmlResult.data !== "string") {
    throw new Error(`Failed to fetch ${url} (HTTP ${htmlResult.status})`);
  }
  const html = htmlResult.data;
  const finalUrl = htmlResult.finalUrl || url;

  // 2. Parse static signals
  const staticSignals = parseStaticSignals(html, finalUrl);

  // 3. Extract colors from favicon if available
  let palette = staticSignals.colors;
  if (staticSignals.faviconUrl) {
    try {
      const faviconRes = await httpFetcher(staticSignals.faviconUrl, { binary: true });
      if (faviconRes.status === 200 && Buffer.isBuffer(faviconRes.data)) {
        palette = await extractColorsFromBuffer(faviconRes.data, palette);
      }
    } catch {
      // Non-fatal: keep palette from CSS / theme-color
    }
  }

  // 4. Claude pass for tone, USPs, industry
  let claudeRefinement: ClaudeRefinement;
  if (options.skipClaude) {
    claudeRefinement = staticToClaudeFallback(staticSignals);
  } else {
    claudeRefinement = await refineWithClaude(staticSignals);
  }

  return {
    url: finalUrl,
    fetchedAt: new Date().toISOString(),
    businessName: claudeRefinement.businessName || staticSignals.businessName,
    tagline: claudeRefinement.tagline || staticSignals.tagline,
    description: claudeRefinement.description || staticSignals.description,
    toneOfVoice: claudeRefinement.toneOfVoice,
    usps: claudeRefinement.usps,
    primaryCTA: claudeRefinement.primaryCTA || staticSignals.primaryCTA,
    colors: palette,
    fonts: staticSignals.fonts,
    logoUrl: staticSignals.logoUrl,
    faviconUrl: staticSignals.faviconUrl,
    productCategories: staticSignals.productCategories,
    hasShop: staticSignals.hasShop,
    hasBlog: staticSignals.hasBlog,
    socialLinks: staticSignals.socialLinks,
    industry: claudeRefinement.industry,
    targetAudience: claudeRefinement.targetAudience,
  };
}

export function hashUrl(url: string): string {
  return createHash("sha256").update(normalizeUrl(url)).digest("hex");
}

export function normalizeUrl(raw: string): string {
  let url = raw.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  // Strip trailing slash + hash + utm-params for a stable hash
  try {
    const u = new URL(url);
    u.hash = "";
    Array.from(u.searchParams.keys())
      .filter((k) => k.toLowerCase().startsWith("utm_"))
      .forEach((k) => u.searchParams.delete(k));
    let normalised = u.toString();
    if (normalised.endsWith("/") && u.pathname === "/") {
      normalised = normalised.slice(0, -1);
    }
    return normalised;
  } catch {
    return url;
  }
}

// ─────────────────────────────────────────────────────────
// Static signal parsing (no network, pure cheerio)
// ─────────────────────────────────────────────────────────

interface StaticSignals {
  businessName: string;
  tagline: string;
  description: string;
  primaryCTA: string;
  colors: BrandProfile["colors"];
  fonts: BrandProfile["fonts"];
  logoUrl: string | null;
  faviconUrl: string | null;
  productCategories: string[];
  hasShop: boolean;
  hasBlog: boolean;
  socialLinks: Array<{ platform: string; url: string }>;
  rawTextSample: string; // first 4000 chars of meaningful text — fed to Claude
}

const SOCIAL_HOSTS: Record<string, string> = {
  "facebook.com": "facebook",
  "instagram.com": "instagram",
  "linkedin.com": "linkedin",
  "tiktok.com": "tiktok",
  "youtube.com": "youtube",
  "youtu.be": "youtube",
  "twitter.com": "twitter",
  "x.com": "twitter",
  "pinterest.com": "pinterest",
};

export function parseStaticSignals(html: string, baseUrl: string): StaticSignals {
  const $ = cheerio.load(html);

  const businessName =
    metaContent($, "og:site_name") ||
    metaContent($, "application-name") ||
    text($("title").first()) ||
    new URL(baseUrl).hostname.replace(/^www\./, "");

  const tagline =
    metaContent($, "og:title") ||
    metaContent($, "twitter:title") ||
    text($("h1").first()) ||
    "";

  const description =
    metaContent($, "og:description") ||
    metaContent($, "description") ||
    metaContent($, "twitter:description") ||
    text($("p").first()) ||
    "";

  // Primary CTA — first prominent <a>/<button> with verb-like text
  const primaryCTA = findPrimaryCTA($);

  // Colors from <meta theme-color> + inline CSS variables
  const colors = parseColorsFromHtml($, html);

  // Fonts from <body> / <h1> computed-style hints (best-effort static parse)
  const fonts = parseFontsFromHtml($, html);

  // Logo: <link rel="icon"> / og:image / first <header img>
  const logoUrl = absUrl(
    metaContent($, "og:image") || $("header img").first().attr("src") || null,
    baseUrl,
  );
  const faviconUrl = absUrl(
    $('link[rel*="icon"]').first().attr("href") || "/favicon.ico",
    baseUrl,
  );

  // Product / blog detection via JSON-LD + URL structure
  const jsonLdTypes = parseJsonLdTypes($);
  const hasShop =
    jsonLdTypes.has("Product") ||
    jsonLdTypes.has("Offer") ||
    /\/shop|\/butikk|\/store|\/products?/i.test(html.slice(0, 5000));
  const hasBlog =
    jsonLdTypes.has("Blog") ||
    jsonLdTypes.has("BlogPosting") ||
    /\/blog|\/journal|\/news|\/artikkel/i.test(html.slice(0, 5000));

  const productCategories = extractProductCategories($);
  const socialLinks = extractSocialLinks($, baseUrl);

  // Text sample for Claude: paragraphs + h2s, no nav junk
  const rawTextSample = collectTextSample($, 4000);

  return {
    businessName,
    tagline,
    description,
    primaryCTA,
    colors,
    fonts,
    logoUrl,
    faviconUrl,
    productCategories,
    hasShop,
    hasBlog,
    socialLinks,
    rawTextSample,
  };
}

function metaContent($: cheerio.CheerioAPI, key: string): string {
  const sels = [
    `meta[property="${key}"]`,
    `meta[name="${key}"]`,
    `meta[itemprop="${key}"]`,
  ];
  for (const sel of sels) {
    const v = $(sel).attr("content");
    if (v && v.trim()) return v.trim();
  }
  return "";
}

function text(node: ReturnType<cheerio.CheerioAPI> | undefined): string {
  if (!node || node.length === 0) return "";
  return (node.text() || "").trim();
}

function absUrl(maybe: string | null | undefined, base: string): string | null {
  if (!maybe) return null;
  try {
    return new URL(maybe, base).toString();
  } catch {
    return null;
  }
}

function findPrimaryCTA($: cheerio.CheerioAPI): string {
  // Strong CTA verbs come first; "kontakt" is intentionally last because
  // it almost always appears in nav alongside more specific actions.
  const STRONG = /\b(book|bestill|kjøp|shop\s+now|sign\s*up|registrer|kom\s+i\s+gang|prøv|free\s+trial|get\s+started|demo|reserver|abonn[eé]r)\b/i;
  const WEAK = /\b(kontakt|contact|start)\b/i;

  const strong: string[] = [];
  const weak: string[] = [];
  $("a, button").each((_, el) => {
    const txt = ($(el).text() || "").trim();
    if (!txt || txt.length > 60) return;
    const inNav = $(el).parents("nav, header").length > 0;
    const cls = ($(el).attr("class") || "").toLowerCase();
    const isCtaClass = /\bcta\b|btn-primary|primary-button/.test(cls);
    if (STRONG.test(txt)) {
      if (!inNav || isCtaClass) strong.unshift(txt);
      else strong.push(txt);
    } else if (WEAK.test(txt) && !inNav) {
      weak.push(txt);
    }
  });
  return strong[0] ?? weak[0] ?? "";
}

function parseColorsFromHtml(
  $: cheerio.CheerioAPI,
  html: string,
): BrandProfile["colors"] {
  const themeColor = metaContent($, "theme-color");
  const cssVars = parseCssVariables(html);
  const findVar = (...keys: string[]): string => {
    for (const k of keys) {
      const v = cssVars[`--${k}`] || cssVars[`--${k}-color`] || cssVars[`--color-${k}`];
      if (v) return v;
    }
    return "";
  };
  return {
    primary: themeColor || findVar("primary", "brand", "main") || "#1f2937",
    secondary: findVar("secondary", "accent-2") || "#6b7280",
    accent: findVar("accent", "highlight", "cta") || "#a855f7",
    background: findVar("background", "bg") || "#ffffff",
    text: findVar("text", "foreground", "fg") || "#0f172a",
  };
}

function parseCssVariables(html: string): Record<string, string> {
  const vars: Record<string, string> = {};
  const styleBlocks = html.match(/<style[\s\S]*?<\/style>/gi) ?? [];
  const sourceText = styleBlocks.join("\n");
  const re = /(--[a-zA-Z0-9_-]+)\s*:\s*([#0-9a-fA-F]{4,9}|rgb[a]?\([^)]+\)|hsl[a]?\([^)]+\))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sourceText)) !== null) {
    const [, name, value] = m;
    if (!vars[name]) vars[name] = value.trim();
  }
  return vars;
}

function parseFontsFromHtml(
  $: cheerio.CheerioAPI,
  html: string,
): BrandProfile["fonts"] {
  // Look for Google-fonts link or @font-face references first
  const styleBlocks = html.match(/<style[\s\S]*?<\/style>/gi) ?? [];
  const text = styleBlocks.join("\n");
  const fam = (selector: string): string => {
    const re = new RegExp(`${selector}\\s*\\{[^}]*font-family\\s*:\\s*([^;]+);`, "i");
    const m = re.exec(text);
    return m ? m[1].replace(/['"]/g, "").split(",")[0].trim() : "";
  };
  const heading = fam("h1") || fam("h2") || fam(":root") || "Inter";
  const body = fam("body") || fam("p") || heading;
  return { heading, body };
}

function parseJsonLdTypes($: cheerio.CheerioAPI): Set<string> {
  const types = new Set<string>();
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).contents().text());
      collectJsonLdTypes(json, types);
    } catch {
      /* ignore malformed */
    }
  });
  return types;
}

function collectJsonLdTypes(node: unknown, out: Set<string>): void {
  if (Array.isArray(node)) {
    node.forEach((n) => collectJsonLdTypes(n, out));
    return;
  }
  if (node && typeof node === "object") {
    const t = (node as Record<string, unknown>)["@type"];
    if (typeof t === "string") out.add(t);
    else if (Array.isArray(t)) t.forEach((v) => typeof v === "string" && out.add(v));
    Object.values(node).forEach((v) => collectJsonLdTypes(v, out));
  }
}

function extractProductCategories($: cheerio.CheerioAPI): string[] {
  const categories = new Set<string>();
  $("nav a, header a, [role='menu'] a").each((_, el) => {
    const txt = ($(el).text() || "").trim();
    if (txt && txt.length > 2 && txt.length < 30 && !/^home$|^hjem$|^about$|^om oss$|^kontakt$|^contact$/i.test(txt)) {
      categories.add(txt);
    }
  });
  return [...categories].slice(0, 12);
}

function extractSocialLinks(
  $: cheerio.CheerioAPI,
  baseUrl: string,
): Array<{ platform: string; url: string }> {
  const seen = new Map<string, string>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    const abs = absUrl(href, baseUrl);
    if (!abs) return;
    try {
      const host = new URL(abs).hostname.replace(/^www\./, "");
      const platform = SOCIAL_HOSTS[host];
      if (platform && !seen.has(platform)) seen.set(platform, abs);
    } catch {
      /* ignore */
    }
  });
  return [...seen.entries()].map(([platform, url]) => ({ platform, url }));
}

function collectTextSample($: cheerio.CheerioAPI, maxChars: number): string {
  const parts: string[] = [];
  $("h1, h2, h3, p, li").each((_, el) => {
    const t = ($(el).text() || "").replace(/\s+/g, " ").trim();
    if (t.length > 12 && t.length < 600) parts.push(t);
  });
  return parts.join("\n").slice(0, maxChars);
}

// ─────────────────────────────────────────────────────────
// Color extraction via node-vibrant
// ─────────────────────────────────────────────────────────

async function extractColorsFromBuffer(
  buf: Buffer,
  fallback: BrandProfile["colors"],
): Promise<BrandProfile["colors"]> {
  try {
    const palette = await Vibrant.from(buf).getPalette();
    return {
      primary: palette.Vibrant?.hex ?? fallback.primary,
      secondary: palette.DarkVibrant?.hex ?? palette.Muted?.hex ?? fallback.secondary,
      accent: palette.LightVibrant?.hex ?? palette.LightMuted?.hex ?? fallback.accent,
      background: palette.LightMuted?.hex ?? fallback.background,
      text: palette.DarkMuted?.hex ?? fallback.text,
    };
  } catch {
    return fallback;
  }
}

// ─────────────────────────────────────────────────────────
// Claude refinement
// ─────────────────────────────────────────────────────────

interface ClaudeRefinement {
  businessName: string;
  tagline: string;
  description: string;
  toneOfVoice: ToneOfVoice;
  usps: string[];
  primaryCTA: string;
  industry: string;
  targetAudience: string;
}

function staticToClaudeFallback(s: StaticSignals): ClaudeRefinement {
  return {
    businessName: s.businessName,
    tagline: s.tagline,
    description: s.description,
    toneOfVoice: "professional",
    usps: [],
    primaryCTA: s.primaryCTA,
    industry: "other",
    targetAudience: "",
  };
}

async function refineWithClaude(s: StaticSignals): Promise<ClaudeRefinement> {
  const client = getAnthropic();
  const userPrompt = [
    `Below is the visible content of a website. Return STRICT JSON only — no preamble.`,
    "",
    `Business name (from <title>/<og:site_name>): ${s.businessName}`,
    `Tagline candidate: ${s.tagline}`,
    `Description candidate: ${s.description}`,
    `Primary CTA spotted: ${s.primaryCTA || "(none)"}`,
    `Has shop: ${s.hasShop} · Has blog: ${s.hasBlog}`,
    `Nav categories: ${s.productCategories.join(", ") || "(none)"}`,
    "",
    `--- TEXT SAMPLE ---`,
    s.rawTextSample,
    `--- END SAMPLE ---`,
    "",
    `Return JSON in exactly this shape (no extra keys, no comments):`,
    `{`,
    `  "businessName": "...",`,
    `  "tagline": "<≤80 chars, marketing-headline tone>",`,
    `  "description": "<≤200 chars, neutral business summary>",`,
    `  "toneOfVoice": "playful" | "professional" | "warm" | "edgy" | "minimal",`,
    `  "usps": ["...", "...", "..."],   // 3-5 unique selling points, ≤80 chars each`,
    `  "primaryCTA": "<the main action, e.g. 'Book a demo'>",`,
    `  "industry": "<one slug: restaurant|ecommerce|local_smb|b2b_saas|fashion|real_estate|automotive|beauty|fitness|professional_services|other>",`,
    `  "targetAudience": "<≤80 chars description of likely customer>"`,
    `}`,
  ].join("\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 800,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  const jsonText = text.replace(/^```(?:json)?|```$/gm, "").trim();
  const parsed = JSON.parse(jsonText) as ClaudeRefinement;

  // Defensive: clip array length + enforce ToneOfVoice union
  return {
    businessName: parsed.businessName || s.businessName,
    tagline: parsed.tagline || s.tagline,
    description: parsed.description || s.description,
    toneOfVoice: (
      ["playful", "professional", "warm", "edgy", "minimal"] as ToneOfVoice[]
    ).includes(parsed.toneOfVoice)
      ? parsed.toneOfVoice
      : "professional",
    usps: Array.isArray(parsed.usps) ? parsed.usps.slice(0, 5) : [],
    primaryCTA: parsed.primaryCTA || s.primaryCTA,
    industry: parsed.industry || "other",
    targetAudience: parsed.targetAudience || "",
  };
}
