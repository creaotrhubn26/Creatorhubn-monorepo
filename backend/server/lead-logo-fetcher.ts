/**
 * lead-logo-fetcher.ts
 *
 * Henter bedrifts-logo fra nettsiden deres. Prøver i rekkefølge:
 *   1. apple-touch-icon (vanligvis 180x180+ — høyest kvalitet)
 *   2. og:image (Open Graph — bra kvalitet)
 *   3. <link rel="icon"> / shortcut icon
 *   4. /favicon.ico
 *   5. Google s2 favicon service (https://www.google.com/s2/favicons?sz=128)
 *
 * Returnerer absolutt URL eller null. Bruker fetch (Node 18+).
 */

interface FetchedLogo {
  url: string;
  source: "apple-touch-icon" | "og:image" | "link-icon" | "favicon-ico" | "google-s2";
  size?: number;
}

const TIMEOUT_MS = 6000;
const MAX_HTML_BYTES = 256 * 1024;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) =>
      setTimeout(() => rej(new Error(`${label} timed out etter ${ms}ms`)), ms),
    ),
  ]);
}

function absUrl(base: string, href: string): string {
  try { return new URL(href, base).toString(); } catch { return href; }
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await withTimeout(
      fetch(url, {
        redirect: "follow",
        headers: {
          // Standard user-agent — noen sites blokkerer ukjente
          "User-Agent": "Mozilla/5.0 (compatible; LeadMapBot/1.0)",
          "Accept": "text/html,application/xhtml+xml",
        },
      }),
      TIMEOUT_MS, "HTML-fetch",
    );
    if (!res.ok) return null;
    const reader = res.body?.getReader();
    if (!reader) return await res.text();
    let received = 0;
    const chunks: Uint8Array[] = [];
    while (received < MAX_HTML_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
    }
    reader.cancel().catch(() => { /* noop */ });
    const decoder = new TextDecoder("utf-8", { fatal: false });
    return decoder.decode(new Uint8Array(
      chunks.reduce<number[]>((a, c) => a.concat(Array.from(c)), [])
    ));
  } catch {
    return null;
  }
}

function extractLogos(html: string, baseUrl: string): FetchedLogo[] {
  const out: FetchedLogo[] = [];
  // <link rel="apple-touch-icon" href="..." sizes="180x180">
  const appleRx = /<link[^>]+rel=["']apple-touch-icon[^"']*["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = appleRx.exec(html)) !== null) {
    const hrefMatch = m[0].match(/href=["']([^"']+)["']/);
    const sizesMatch = m[0].match(/sizes=["'](\d+)x\d+["']/);
    if (hrefMatch) {
      out.push({
        url: absUrl(baseUrl, hrefMatch[1]),
        source: "apple-touch-icon",
        size: sizesMatch ? parseInt(sizesMatch[1], 10) : undefined,
      });
    }
  }
  // <meta property="og:image" content="...">
  const ogRx = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i;
  const og = html.match(ogRx);
  if (og) out.push({ url: absUrl(baseUrl, og[1]), source: "og:image" });
  // <link rel="icon" href="...">
  const iconRx = /<link[^>]+rel=["'](?:shortcut )?icon[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/gi;
  while ((m = iconRx.exec(html)) !== null) {
    out.push({ url: absUrl(baseUrl, m[1]), source: "link-icon" });
  }
  return out;
}

async function checkExists(url: string): Promise<boolean> {
  try {
    const res = await withTimeout(
      fetch(url, { method: "HEAD" }),
      TIMEOUT_MS, "HEAD-check",
    );
    return res.ok;
  } catch { return false; }
}

/**
 * Forsøk å finne bedriftens beste logo. Returnerer alltid noe (Google
 * s2 som ytterste fallback gir tilbake en minst-noe-favicon).
 */
export async function fetchBestLogo(websiteUrl: string): Promise<FetchedLogo | null> {
  if (!websiteUrl) return null;
  let url: URL;
  try {
    url = new URL(
      websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`,
    );
  } catch {
    return null;
  }
  const baseUrl = url.origin;
  // 1. Skrap HTML for ikon-tags
  const html = await fetchHtml(baseUrl);
  if (html) {
    const candidates = extractLogos(html, baseUrl);
    // Sortér: apple-touch (størst først) > og:image > link-icon
    candidates.sort((a, b) => {
      const rank = (s: FetchedLogo["source"]): number =>
        s === "apple-touch-icon" ? 0 : s === "og:image" ? 1 : 2;
      const r = rank(a.source) - rank(b.source);
      if (r !== 0) return r;
      return (b.size ?? 0) - (a.size ?? 0);
    });
    for (const c of candidates) {
      if (await checkExists(c.url)) return c;
    }
  }
  // 2. Test /favicon.ico
  const faviconUrl = `${baseUrl}/favicon.ico`;
  if (await checkExists(faviconUrl)) {
    return { url: faviconUrl, source: "favicon-ico" };
  }
  // 3. Google s2 fallback (alltid tilgjengelig)
  return {
    url: `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=128`,
    source: "google-s2",
  };
}
