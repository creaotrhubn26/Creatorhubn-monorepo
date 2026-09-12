/**
 * pitch-deck-cover-fetcher.ts
 *
 * Cover-slide-data for pitch decks: logo + tagline auto-fetchet fra
 * organisasjonens nettside. Logo gjenbruker eksisterende
 * fetchBestLogo-pipeline (apple-touch → og:image → favicon → Google s2).
 * Tagline ekstraheres fra <meta name="description"> > <meta
 * property="og:description"> > første <h1>.
 *
 * Vi unngår å fetche to ganger ved samme onboard ved å begge fra én
 * URL-fetch hvor det er mulig — fetchBestLogo henter sin egen, men
 * vi gjør et eget HTML-fetch for tagline siden sidens tagline
 * typisk er bedre kilde enn logo-kilden.
 */

import { fetchBestLogo } from "./lead-logo-fetcher.js";

export interface CoverData {
  logo_url: string | null;
  tagline: string | null;
}

// Bevisst forsiktig regex-set — vi vil ikke pakke inn en full HTML-parser
// for noe så lett. Mislykkes treffene → null, og UI faller tilbake til
// brukerens manuelle inntasting.
const META_DESCRIPTION_RE =
  /<meta[^>]+name=["']description["'][^>]+content=["']([^"']{10,300})["']/i;
const OG_DESCRIPTION_RE =
  /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{10,300})["']/i;
const H1_RE = /<h1[^>]*>([^<]{8,200})<\/h1>/i;

function normalizeUrl(input: string): string | null {
  let url = input.trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  try { return new URL(url).toString(); }
  catch { return null; }
}

function cleanText(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/^[\s|\-—–·]+|[\s|\-—–·]+$/g, "")
    .trim();
}

async function fetchHtml(url: string, timeoutMs = 6000): Promise<string | null> {
  try {
    const resp = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X) RoleRoomPitchBot/1.0",
        "accept": "text/html",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!resp.ok) return null;
    // Bare ta de første 200 KB — meta-tags ligger alltid i <head>.
    const reader = resp.body?.getReader();
    if (!reader) return await resp.text();
    let received = "";
    let bytes = 0;
    const decoder = new TextDecoder("utf-8");
    while (bytes < 200_000) {
      const { done, value } = await reader.read();
      if (done) break;
      received += decoder.decode(value, { stream: true });
      bytes += value.byteLength;
      if (received.includes("</head>")) break;
    }
    try { await reader.cancel(); } catch { /* noop */ }
    return received;
  } catch {
    return null;
  }
}

function extractTagline(html: string): string | null {
  const m1 = html.match(META_DESCRIPTION_RE);
  if (m1?.[1]) {
    const cleaned = cleanText(m1[1]);
    if (cleaned.length >= 8) return cleaned.slice(0, 200);
  }
  const m2 = html.match(OG_DESCRIPTION_RE);
  if (m2?.[1]) {
    const cleaned = cleanText(m2[1]);
    if (cleaned.length >= 8) return cleaned.slice(0, 200);
  }
  const m3 = html.match(H1_RE);
  if (m3?.[1]) {
    const cleaned = cleanText(m3[1]).replace(/<[^>]+>/g, "");
    if (cleaned.length >= 8) return cleaned.slice(0, 200);
  }
  return null;
}

/** Henter logo + tagline parallelt. Skadefri ved feil — returnerer null
 *  per felt som ikke kunne hentes. */
export async function fetchCoverData(websiteUrl: string): Promise<CoverData> {
  const normalized = normalizeUrl(websiteUrl);
  if (!normalized) return { logo_url: null, tagline: null };

  const [logo, html] = await Promise.all([
    fetchBestLogo(normalized).catch(() => null),
    fetchHtml(normalized).catch(() => null),
  ]);

  return {
    logo_url: logo?.url ?? null,
    tagline: html ? extractTagline(html) : null,
  };
}
