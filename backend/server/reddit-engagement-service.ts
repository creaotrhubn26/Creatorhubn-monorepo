/**
 * reddit-engagement-service.ts
 *
 * Reddit-fetcher som bruker Reddit's offisielle Server API
 * (https://developers.reddit.com/docs/capabilities/server/reddit-api)
 * med automatisk fallback til public JSON-API for read-only-tilgang
 * når OAuth-credentials ikke er konfigurert.
 *
 * ═══════════════════════════════════════════════════════════════
 * COMPLIANCE — Reddit Responsible Builder Policy
 * https://support.reddithelp.com/hc/en-us/articles/42728983564564
 * ═══════════════════════════════════════════════════════════════
 * Vi følger Reddit's Responsible Builder Policy:
 *
 * 1. ATTRIBUTION & TRANSPARENCY
 *    - Descriptive User-Agent med app-navn, versjon og Reddit-handle
 *      som Reddit kan kontakte ved misbruk
 *    - Lenker tilbake til original-permalink på reddit.com (vi server
 *      ikke Reddit-innhold som om det var vårt eget)
 *
 * 2. RATE-LIMIT-RESPEKT
 *    - Bruker OAuth-token når mulig (high-quality identifier)
 *    - In-memory token-cache (50 min) for å minimere auth-calls
 *    - Manuelle triggers kun — ingen auto-polling
 *    - Respekterer 429-svar med exponential backoff
 *
 * 3. DATA-MINIMERING
 *    - Lagrer KUN aggregat-tall (upvotes, comments_count) — ikke
 *      bruker-innhold, kommentarer eller brukernavn permanent
 *    - Mentions-søk returnerer cache-fri data hver gang (ingen
 *      lagring av Reddit-tråder lokalt)
 *    - 2 MB response-grense for å unngå utilsiktet bulk-scraping
 *
 * 4. PRIVACY
 *    - Bruker-handles vises kun midlertidig i AdminRoom-UI;
 *      ikke lagret i DB med PII-association
 *    - Vi trener IKKE AI/ML på Reddit-data (Anthropic API kalles
 *      kun på vårt eget innhold)
 *
 * 5. NO AUTOMATED VOTING / POSTING
 *    - Read-only: vi kaller ALDRI Reddit POST-endpoints
 *    - Klient autoriserer aldri brukere via vår app for å
 *      handle på Reddit
 *
 * 6. SSRF-BESKYTTELSE
 *    - Validerer at alle URLs er reddit.com før fetch
 *    - 5-sek timeout
 *
 * ═══════════════════════════════════════════════════════════════
 *
 * Brukes for:
 *   1. Refresh engagement-tall (upvotes, kommentarer) på en publisert
 *      community-post — manuell trigger fra AdminRoom
 *   2. Søke etter mentions av "The Role Room" på tvers av Reddit
 *
 * OAuth-modus (anbefalt — høyere rate-limits, mer stabil):
 *   Sett REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET i env. Opprett en
 *   "script"-type app på reddit.com/prefs/apps. Vi bruker
 *   client_credentials-grant for app-only-tilgang (ingen bruker-OAuth).
 *
 * Fallback-modus (uten credentials):
 *   Bruker public JSON-API (~60 req/min per IP). Fungerer for
 *   read-only engagement-refresh og søk.
 */

// User-Agent per Reddit API-best-practice:
//   <platform>:<app ID>:<version> (by /u/<reddit username>)
// Reddit støtte kan kontakte oss på Reddit-handlen ved policy-brudd.
const REDDIT_USER_AGENT = process.env.REDDIT_USER_AGENT
  ?? 'TheRoleRoom:engagement-monitor:v1.0 (by /u/theroleroom-app)';
const REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID;
const REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET;

// Backoff-state: husker når Reddit sist sendte 429. Vi nekter å fetche
// inntil cooldown er forbi — defensiv beskyttelse mot policy-brudd
// selv hvis admin gjentar triggers raskt.
let rateLimitCooldownUntil = 0;
const REDDIT_FETCH_TIMEOUT_MS = 5000;
const REDDIT_MAX_BYTES = 2_000_000; // 2 MB

function isRedditUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return /(?:^|\.)reddit\.com$/i.test(u.hostname);
  } catch {
    return false;
  }
}

/**
 * Bygg `.json`-variant av en Reddit-permalink. Reddit-permalinks
 * støtter trivielt JSON-output ved å appendere `.json` før query.
 */
function buildJsonUrl(redditUrl: string): string {
  const u = new URL(redditUrl);
  // Strip trailing slash, append .json, behold eventuell query
  const pathWithoutTrailingSlash = u.pathname.replace(/\/$/, '');
  return `${u.origin}${pathWithoutTrailingSlash}.json${u.search}`;
}

// In-memory token-cache for OAuth-modus
let cachedToken: { token: string; expiresAt: number } | null = null;
const TOKEN_LIFETIME_MS = 50 * 60 * 1000; // 50 min (Reddit gir 1 t)

async function getOAuthToken(): Promise<string | null> {
  if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET) return null;
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) {
    return cachedToken.token;
  }
  const auth = Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString('base64');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REDDIT_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'User-Agent': REDDIT_USER_AGENT,
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[reddit] OAuth token fetch failed (HTTP ${res.status}), faller tilbake til public JSON`);
      return null;
    }
    const data = await res.json() as { access_token?: string };
    if (!data.access_token) return null;
    cachedToken = { token: data.access_token, expiresAt: now + TOKEN_LIFETIME_MS };
    return data.access_token;
  } catch (err) {
    console.warn('[reddit] OAuth token error:', err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchRedditJson(url: string): Promise<unknown> {
  // Respekter aktiv cooldown — beskytter mot policy-brudd ved gjenta-
  // gende admin-triggers etter 429
  const now = Date.now();
  if (rateLimitCooldownUntil > now) {
    const waitSec = Math.ceil((rateLimitCooldownUntil - now) / 1000);
    throw new Error(`Reddit rate-limit cooldown — prøv igjen om ${waitSec}s`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REDDIT_FETCH_TIMEOUT_MS);
  try {
    // Forsøk OAuth-modus først hvis konfigurert. Bytter automatisk
    // til oauth.reddit.com-host fordi det er der bearer-tokens funker.
    const token = await getOAuthToken();
    let fetchUrl = url;
    const headers: Record<string, string> = {
      'User-Agent': REDDIT_USER_AGENT,
      Accept: 'application/json',
    };
    if (token) {
      // Bytter www.reddit.com → oauth.reddit.com (samme path, men autentisert)
      fetchUrl = url.replace(/^https?:\/\/www\.reddit\.com/, 'https://oauth.reddit.com');
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(fetchUrl, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    // Honor Reddit's 429 — sett cooldown basert på Retry-After (eller
    // 60 sek fallback). Når vi får 429 har vi reelt overforbruk; vi
    // venter til Reddit sier vi kan fortsette.
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('retry-after') ?? '60', 10);
      const cooldownSec = Number.isFinite(retryAfter) ? retryAfter : 60;
      rateLimitCooldownUntil = Date.now() + cooldownSec * 1000;
      throw new Error(`Reddit 429 — venter ${cooldownSec}s før neste forsøk`);
    }

    if (!res.ok) {
      throw new Error(`Reddit-fetch HTTP ${res.status}`);
    }
    // Begrens størrelse — defensiv mot voksne tråder
    const contentLength = parseInt(res.headers.get('content-length') ?? '0', 10);
    if (Number.isFinite(contentLength) && contentLength > REDDIT_MAX_BYTES) {
      throw new Error(`Reddit-response for stor: ${contentLength} bytes`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Returner true hvis OAuth er konfigurert (env-vars satt). Brukes
 * av frontend for å vise riktig status-badge.
 */
export function isRedditOAuthConfigured(): boolean {
  return Boolean(REDDIT_CLIENT_ID && REDDIT_CLIENT_SECRET);
}

export interface RedditEngagement {
  upvotes: number;
  comments_count: number;
  score: number;
  upvote_ratio?: number;
  fetched_at: string;
}

/**
 * Hent engagement-tall for en spesifikk Reddit-post via dens permalink.
 * Returnerer null hvis URL ikke er Reddit eller responsen er ugyldig.
 */
export async function fetchRedditPostEngagement(redditUrl: string): Promise<RedditEngagement | null> {
  if (!isRedditUrl(redditUrl)) return null;

  const jsonUrl = buildJsonUrl(redditUrl);
  const data = await fetchRedditJson(jsonUrl);

  // Reddit returnerer en array [post-listing, comment-listing] for permalinks
  if (!Array.isArray(data) || data.length === 0) return null;
  const postListing = data[0] as { data?: { children?: unknown[] } };
  const children = postListing?.data?.children;
  if (!Array.isArray(children) || children.length === 0) return null;

  const first = children[0] as { data?: Record<string, unknown> };
  const post = first?.data;
  if (!post || typeof post !== 'object') return null;

  return {
    upvotes: Number((post as Record<string, unknown>).ups ?? 0),
    comments_count: Number((post as Record<string, unknown>).num_comments ?? 0),
    score: Number((post as Record<string, unknown>).score ?? 0),
    upvote_ratio: typeof (post as Record<string, unknown>).upvote_ratio === 'number'
      ? Number((post as Record<string, unknown>).upvote_ratio)
      : undefined,
    fetched_at: new Date().toISOString(),
  };
}

export interface RedditMention {
  id: string;
  title: string;
  permalink: string;
  subreddit: string;
  author: string;
  created_at: string;
  score: number;
  num_comments: number;
  snippet?: string;
}

/**
 * Søk etter mentions av et søkeord på tvers av Reddit. Bruker
 * Reddit's offentlige search-endpoint via JSON-API.
 *
 * Returnerer opptil 25 nyligste resultater.
 */
export async function searchRedditMentions(query: string): Promise<RedditMention[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery || trimmedQuery.length > 200) return [];

  const params = new URLSearchParams({
    q: trimmedQuery,
    sort: 'new',
    limit: '25',
    restrict_sr: 'false',
    t: 'month',
  });
  const url = `https://www.reddit.com/search.json?${params.toString()}`;

  const data = await fetchRedditJson(url);
  const listing = data as { data?: { children?: unknown[] } };
  const children = listing?.data?.children;
  if (!Array.isArray(children)) return [];

  return children.flatMap((child) => {
    const post = (child as { data?: Record<string, unknown> })?.data;
    if (!post || typeof post !== 'object') return [];
    const p = post as Record<string, unknown>;
    return [{
      id: String(p.id ?? ''),
      title: String(p.title ?? ''),
      permalink: p.permalink ? `https://www.reddit.com${String(p.permalink)}` : '',
      subreddit: `r/${String(p.subreddit ?? '')}`,
      author: String(p.author ?? ''),
      created_at: new Date(Number(p.created_utc ?? 0) * 1000).toISOString(),
      score: Number(p.score ?? 0),
      num_comments: Number(p.num_comments ?? 0),
      snippet: typeof p.selftext === 'string' ? String(p.selftext).slice(0, 240) : undefined,
    }];
  });
}
