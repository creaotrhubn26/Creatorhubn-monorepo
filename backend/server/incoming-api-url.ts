/**
 * Canonicalize API URLs before any route-specific or global body parser runs.
 *
 * Express matches middleware against the current URL. Keeping this step ahead
 * of body parsing prevents alternate spellings such as `/api//leadgrid/...`
 * from bypassing a route's smaller, stricter parser and being normalized only
 * after the global parser has accepted the request.
 */
export function normalizeIncomingApiUrl(rawUrl: string): string {
  if (!rawUrl) return rawUrl;

  const [rawPath, rawQuery = ""] = rawUrl.split("?", 2);
  let normalizedPath = rawPath.trim();
  if (normalizedPath.startsWith("api/")) {
    normalizedPath = `/${normalizedPath}`;
  }
  if (!normalizedPath.startsWith("/api/")) {
    return rawUrl;
  }

  normalizedPath = normalizedPath
    .replace(/\/{2,}/g, "/")
    .split("/")
    .map((segment, index) =>
      index === 0 ? segment : segment.replace(/,+$/u, ""),
    )
    .join("/");

  if (normalizedPath.length > 1 && normalizedPath.endsWith("/")) {
    normalizedPath = normalizedPath.slice(0, -1);
  }

  const searchParams = new URLSearchParams(rawQuery);
  const sanitizedParams = new URLSearchParams();
  for (const [key, value] of searchParams.entries()) {
    const normalizedKey = key.trim().replace(/,+$/u, "");
    if (!normalizedKey) continue;
    sanitizedParams.append(normalizedKey, value.trim().replace(/,+$/u, ""));
  }

  const query = sanitizedParams.toString();
  return query ? `${normalizedPath}?${query}` : normalizedPath;
}
