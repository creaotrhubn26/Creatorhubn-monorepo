// =============================================================================
// Pure entity-matching/scoring for the producer bootstrap.
//
// Extracted from role-room-agent.ts so the scoring can be unit-tested without
// pulling in that module's heavy runtime deps (cheerio, cohere, node-vibrant).
// Mirrors the grounding module's convention: local, dependency-free copies of
// the small string utils so there is no import cycle and no coupling.
//
// Covers two accuracy fixes:
//  - F5: Brreg name-search disambiguation (website-host tiebreaker).
//  - F3: Google Places business match pinned to the verified Brreg locality so
//        a same-name business in another town isn't chosen.
// =============================================================================

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Faithful copy of role-room-agent.ts normalizeWebsiteUrl: prefixes https://
 *  when no scheme, returns a canonical URL string, or null when unparseable. */
function normalizeWebsiteUrl(rawUrl: string | null | undefined): string | null {
  if (!hasText(rawUrl)) return null;
  const candidate = rawUrl.trim().startsWith("http") ? rawUrl.trim() : `https://${rawUrl.trim()}`;
  try {
    return new URL(candidate).toString();
  } catch {
    return null;
  }
}

/** Faithful copy of role-room-agent.ts normalizeHost: hostname sans www.,
 *  lowercased. Requires a parseable URL (with scheme) — else null. */
function normalizeHost(value: string | null | undefined): string | null {
  if (!hasText(value)) return null;
  try {
    return new URL(value).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

interface SearchQueryInput {
  companyName?: string | null;
  websiteUrl?: string | null;
}

interface SearchQueryWebsiteInsights {
  finalUrl?: string | null;
  siteName?: string | null;
  pageTitle?: string | null;
}

/**
 * Build up to 3 Google Places text queries. When a verified Brreg locality is
 * supplied, the locality-pinned query goes first — it's the strongest
 * disambiguator between same-name businesses in different towns.
 */
export function buildSearchQueries(
  input: SearchQueryInput,
  websiteInsights: SearchQueryWebsiteInsights,
  localityHint = "",
): string[] {
  const websiteUrl = normalizeWebsiteUrl(input.websiteUrl) || websiteInsights.finalUrl || null;
  const websiteHost = normalizeHost(websiteUrl);
  const hostLabel = websiteHost ? websiteHost.replace(/\.[a-z.]+$/i, "").replace(/[-_]/g, " ") : "";
  const companyName = hasText(input.companyName)
    ? normalizeWhitespace(input.companyName)
    : hasText(websiteInsights.siteName)
      ? normalizeWhitespace(websiteInsights.siteName)
      : hasText(websiteInsights.pageTitle)
        ? normalizeWhitespace(websiteInsights.pageTitle)
        : "";
  const locality = normalizeWhitespace(localityHint);

  return Array.from(
    new Set(
      [
        companyName && locality ? `${companyName} ${locality}` : "",
        companyName,
        companyName && hostLabel ? `${companyName} ${hostLabel}` : "",
        hostLabel,
      ]
        .map((entry) => normalizeWhitespace(entry))
        .filter((entry) => entry.length > 0),
    ),
  ).slice(0, 3);
}

/**
 * Score a Brreg name-search hit against the query name + the customer's
 * website host. Website-host match is the strongest available disambiguator
 * when several enterprises share a name across municipalities.
 */
export function scoreBrregNameCandidate(
  unit: Record<string, unknown>,
  normalizedQuery: string,
  websiteHost: string | null,
): number {
  const name = hasText(unit.navn) ? normalizeWhitespace(unit.navn).toLowerCase() : "";
  let value = 0;
  if (name && name === normalizedQuery) {
    value += 100;
  } else if (name && normalizedQuery && (name.includes(normalizedQuery) || normalizedQuery.includes(name))) {
    value += 45;
  }
  if (websiteHost) {
    const unitHost = hasText(unit.hjemmeside) ? normalizeHost(normalizeWebsiteUrl(unit.hjemmeside)) : "";
    if (unitHost && unitHost === websiteHost) {
      value += 120;
    }
  }
  if (hasText(unit.slettedato)) value -= 30;
  if (unit.konkurs === true || unit.underAvvikling === true || unit.underTvangsavviklingEllerTvangsopplosning === true) {
    value -= 25;
  }
  return value;
}

/**
 * Score a Google Places candidate for "is this the customer's business".
 * Website-host and exact-name matches dominate; the locality hint (from the
 * verified Brreg town) rewards a same-town candidate and actively penalizes a
 * candidate whose address is known but in a different town.
 */
export function scoreGooglePlaceCandidate(
  candidate: Record<string, unknown>,
  companyName: string,
  websiteHost: string | null,
  localityHint: string | null = null,
): number {
  const displayNameRecord =
    candidate.displayName && typeof candidate.displayName === "object" && !Array.isArray(candidate.displayName)
      ? (candidate.displayName as Record<string, unknown>)
      : {};
  const displayName = hasText(displayNameRecord.text) ? normalizeWhitespace(displayNameRecord.text).toLowerCase() : "";
  const normalizedCompany = normalizeWhitespace(companyName).toLowerCase();
  const websiteUri = hasText(candidate.websiteUri) ? candidate.websiteUri : null;
  const candidateHost = normalizeHost(websiteUri);
  let score = 0;

  if (websiteHost && candidateHost === websiteHost) {
    score += 120;
  }
  if (displayName && normalizedCompany && displayName === normalizedCompany) {
    score += 60;
  } else if (displayName && normalizedCompany && (displayName.includes(normalizedCompany) || normalizedCompany.includes(displayName))) {
    score += 35;
  }

  if (hasText(localityHint)) {
    const address = hasText(candidate.formattedAddress) ? normalizeWhitespace(candidate.formattedAddress).toLowerCase() : "";
    const hint = normalizeWhitespace(localityHint).toLowerCase();
    if (address && hint && address.includes(hint)) {
      score += 40;
    } else if (address && hint) {
      score -= 25;
    }
  }

  const rating = asNumber(candidate.rating);
  const userRatingCount = asNumber(candidate.userRatingCount);
  if (rating) {
    score += Math.round(rating * 2);
  }
  if (userRatingCount) {
    score += Math.min(Math.round(userRatingCount / 25), 20);
  }

  return score;
}

function normalizeCompanyIdentity(value: string): string {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/\b(?:as|asa|ans|da|sa|nuf|enk)\b/g, "")
    .replace(/[^a-z0-9æøå]+/gi, "");
}

/**
 * High-precision gate for selecting a customer's own Google Places record.
 * Popularity can rank already-plausible records, but can never turn an
 * unrelated or wrong-locality result into an identity match.
 */
export function isGooglePlaceBusinessIdentityMatch(
  candidate: Record<string, unknown>,
  companyName: string,
  websiteHost: string | null,
  localityHint: string | null = null,
): boolean {
  const candidateHost = normalizeHost(hasText(candidate.websiteUri) ? candidate.websiteUri : null);
  if (websiteHost && candidateHost === websiteHost) return true;

  const displayNameRecord =
    candidate.displayName && typeof candidate.displayName === "object" && !Array.isArray(candidate.displayName)
      ? (candidate.displayName as Record<string, unknown>)
      : {};
  const candidateName = normalizeCompanyIdentity(hasText(displayNameRecord.text) ? displayNameRecord.text : "");
  const expectedName = normalizeCompanyIdentity(companyName);
  const nameMatches = Boolean(
    candidateName
      && expectedName
      && (candidateName === expectedName
        || (candidateName.length > 6 && expectedName.length > 6
          && (candidateName.includes(expectedName) || expectedName.includes(candidateName)))),
  );
  if (!nameMatches) return false;

  if (hasText(localityHint)) {
    const address = hasText(candidate.formattedAddress)
      ? normalizeWhitespace(candidate.formattedAddress).toLowerCase()
      : "";
    return Boolean(address && address.includes(normalizeWhitespace(localityHint).toLowerCase()));
  }
  return true;
}
