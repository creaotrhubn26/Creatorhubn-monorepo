/**
 * Small adapter around Google's Custom Search JSON API.
 *
 * Keep the provider behind one module: Google has announced that existing
 * customers must migrate away from this API by 2027-01-01. Callers therefore
 * depend on this local contract rather than spreading the retiring REST
 * endpoint and credentials through product code.
 */

export type GoogleCustomSearchItem = {
  title?: string;
  link?: string;
  displayLink?: string;
  snippet?: string;
  pagemap?: { cse_image?: Array<{ src?: string }> };
};

export type GoogleCustomSearchOptions = {
  num?: number;
  timeoutMs?: number;
  languageRestriction?: string;
  countryRestriction?: string;
  excludedSite?: string | null;
};

const apiKey = (): string => process.env.GOOGLE_SEARCH_API_KEY || "";
const engineId = (): string => process.env.GOOGLE_SEARCH_ENGINE_ID || "";

export function googleCustomSearchConfigured(): boolean {
  return Boolean(apiKey() && engineId());
}

export async function searchGoogleCustom(
  query: string,
  options: GoogleCustomSearchOptions = {},
): Promise<GoogleCustomSearchItem[]> {
  if (!googleCustomSearchConfigured()) {
    throw new Error("google_custom_search_not_configured");
  }

  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];

  const num = Math.min(10, Math.max(1, Math.trunc(options.num ?? 3)));
  const params = new URLSearchParams({
    key: apiKey(),
    cx: engineId(),
    q: normalizedQuery,
    num: String(num),
    safe: "active",
    fields: "items(title,link,displayLink,snippet,pagemap)",
  });
  if (options.languageRestriction) params.set("lr", options.languageRestriction);
  if (options.countryRestriction) params.set("cr", options.countryRestriction);
  if (options.excludedSite) {
    params.set("siteSearch", options.excludedSite);
    params.set("siteSearchFilter", "e");
  }

  const response = await fetch(
    `https://customsearch.googleapis.com/customsearch/v1?${params.toString()}`,
    { signal: AbortSignal.timeout(Math.max(250, options.timeoutMs ?? 4_000)) },
  );
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Google Custom Search ${response.status}: ${body.slice(0, 200)}`);
  }
  const json = (await response.json()) as { items?: GoogleCustomSearchItem[] };
  return Array.isArray(json.items) ? json.items : [];
}
