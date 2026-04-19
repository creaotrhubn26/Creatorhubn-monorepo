/**
 * Meta Pages Search + Public Metadata enrichment.
 *
 * Used by the producer-bootstrap competitor-analysis flow to enrich
 * Google-Places-identified competitors with their public Facebook
 * Page data (follower count, category, About text, website link).
 *
 * Auth: uses the app access token `{META_APP_ID}|{META_APP_SECRET}` —
 * the "Page Public Metadata Access" feature grants read access to
 * these specific public fields without user OAuth.
 *
 * Graceful degradation: every network call is best-effort. If Meta
 * returns an error, the enrichment is skipped for that competitor
 * and the rest of the bootstrap pipeline continues — Google Places
 * data is the baseline, Meta Pages is strictly additive.
 */

const META_GRAPH_VERSION = 'v21.0';
const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
const SEARCH_TIMEOUT_MS = 5_000;
const METADATA_TIMEOUT_MS = 5_000;
const MAX_SEARCH_RESULTS = 5;

export interface MetaPageSearchResult {
  id: string;
  name: string;
}

export interface MetaPagePublicMetadata {
  id: string;
  name: string;
  fanCount: number | null;
  followersCount: number | null;
  category: string | null;
  categoryList: string[];
  about: string | null;
  website: string | null;
  link: string | null;
  verificationStatus: string | null;
}

export interface MetaAppAccessTokenConfig {
  appId: string;
  appSecret: string;
}

function appAccessToken(cfg: MetaAppAccessTokenConfig): string {
  // Graph API accepts `{app_id}|{app_secret}` as an app-scoped token
  // for endpoints that support app access (Page public fields included
  // under the Page Public Metadata Access feature).
  return `${cfg.appId}|${cfg.appSecret}`;
}

async function metaFetch<T>(url: string, timeoutMs: number): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { method: 'GET', signal: controller.signal });
    if (!response.ok) {
      // Meta returns 400/404 for banned/deleted pages, 429 on rate limit.
      // We don't distinguish here — treat all as "no data, move on".
      return null;
    }
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Search Meta's public Page index. Requires Page Public Metadata
 * Access to be granted on the app. Returns at most MAX_SEARCH_RESULTS
 * candidates.
 */
export async function searchPublicPages(
  query: string,
  cfg: MetaAppAccessTokenConfig,
): Promise<MetaPageSearchResult[]> {
  if (!query || query.trim().length < 2) return [];
  const url = `${META_GRAPH_BASE}/pages/search?${new URLSearchParams({
    q: query.trim(),
    fields: 'id,name',
    limit: String(MAX_SEARCH_RESULTS),
    access_token: appAccessToken(cfg),
  })}`;
  const result = await metaFetch<{ data?: MetaPageSearchResult[] }>(url, SEARCH_TIMEOUT_MS);
  if (!result?.data) return [];
  return result.data
    .filter((p): p is MetaPageSearchResult => typeof p?.id === 'string' && typeof p?.name === 'string')
    .slice(0, MAX_SEARCH_RESULTS);
}

/**
 * Fetch the public-metadata fields for a specific Page id. Returns
 * null when Meta refuses, the id doesn't exist, or the timeout
 * fires — the caller should treat the competitor as "no FB presence
 * found".
 */
export async function fetchPagePublicMetadata(
  pageId: string,
  cfg: MetaAppAccessTokenConfig,
): Promise<MetaPagePublicMetadata | null> {
  if (!pageId) return null;
  const fields = [
    'id',
    'name',
    'fan_count',
    'followers_count',
    'category',
    'category_list',
    'about',
    'website',
    'link',
    'verification_status',
  ].join(',');
  const url = `${META_GRAPH_BASE}/${encodeURIComponent(pageId)}?${new URLSearchParams({
    fields,
    access_token: appAccessToken(cfg),
  })}`;
  const result = await metaFetch<Record<string, unknown>>(url, METADATA_TIMEOUT_MS);
  if (!result) return null;
  return {
    id: String(result.id ?? pageId),
    name: String(result.name ?? ''),
    fanCount: typeof result.fan_count === 'number' ? result.fan_count : null,
    followersCount: typeof result.followers_count === 'number' ? result.followers_count : null,
    category: typeof result.category === 'string' ? result.category : null,
    categoryList: Array.isArray(result.category_list)
      ? (result.category_list as Array<{ name?: unknown }>)
          .map((c) => (typeof c?.name === 'string' ? c.name : null))
          .filter((n): n is string => Boolean(n))
      : [],
    about: typeof result.about === 'string' ? result.about : null,
    website: typeof result.website === 'string' ? result.website : null,
    link: typeof result.link === 'string' ? result.link : null,
    verificationStatus:
      typeof result.verification_status === 'string' ? result.verification_status : null,
  };
}

export function getMetaAppAccessTokenConfig(): MetaAppAccessTokenConfig | null {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) return null;
  return { appId, appSecret };
}

/**
 * One-shot enrichment: takes a competitor name (as assembled by the
 * Google Places flow), searches Meta's public Page index, picks the
 * best name-match, and returns its public metadata. Returns null if
 * Meta is not configured, nothing matched, or every attempted fetch
 * failed — caller should show the competitor without Meta data.
 *
 * Matching heuristic: first result whose normalised name contains
 * the query tokens, with an exact-match bias. Conservative on
 * purpose — we'd rather skip enrichment than attach a wrong Page.
 */
export async function enrichCompetitorWithMetaPage(
  competitorName: string,
): Promise<MetaPagePublicMetadata | null> {
  const cfg = getMetaAppAccessTokenConfig();
  if (!cfg) return null;
  if (!competitorName || competitorName.trim().length < 2) return null;

  const candidates = await searchPublicPages(competitorName, cfg);
  if (candidates.length === 0) return null;

  const normalised = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const qNormal = normalised(competitorName);
  const exact = candidates.find((c) => normalised(c.name) === qNormal);
  const partial = candidates.find((c) => normalised(c.name).includes(qNormal));
  const pick = exact ?? partial ?? candidates[0];

  return fetchPagePublicMetadata(pick.id, cfg);
}
