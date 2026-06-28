// =============================================================================
// Research grounding pass for the producer bootstrap.
//
// The bootstrap synthesis (Claude / OpenAI orchestrator or the deterministic
// LLM call) is *instructed* never to invent org-numbers, competitors or
// contact details — but LLMs occasionally do anyway. This module is a
// conservative, deterministic, pure safety net that runs right before the
// normalized payload is handed to the producer: it only touches HARD,
// checkable facts (org-number, competitor verification, contact info) and
// leaves all creative / strategy text untouched.
//
// No I/O, no network, no DB. Idempotent. Returns a shallow-cloned payload so
// the caller's object is never mutated, plus a list of strippedReasons that
// the caller appends to its existing fallbacksUsed telemetry bag.
// =============================================================================

/** Reason codes appended to fallbacksUsed so the existing telemetry logs
 *  exactly which hard facts the grounding pass removed or downgraded. */
export type RoleRoomAgentGroundingReason =
  | "grounding_stripped_ungrounded_orgnr"
  | "grounding_downgraded_unverified_competitor"
  | "grounding_stripped_ungrounded_contact";

interface GroundableCompetitor {
  name?: string | null;
  websiteUrl?: string | null;
  status?: string;
  [key: string]: unknown;
}

interface GroundableCompetitorAnalysis {
  competitors?: GroundableCompetitor[];
  [key: string]: unknown;
}

interface GroundableSocialCandidate {
  url?: string | null;
  canonicalUrl?: string | null;
  handle?: string | null;
  displayName?: string | null;
  [key: string]: unknown;
}

interface GroundableCompanyProfile {
  organizationNumber?: string | null;
  [key: string]: unknown;
}

/** Structural subset of the normalized bootstrap payload that the grounding
 *  pass reads/clones. Kept local (not imported from role-room-agent.ts) so
 *  there is no runtime import cycle and the function stays trivially pure. */
export interface RoleRoomAgentGroundablePayload {
  companyProfile?: GroundableCompanyProfile;
  competitorAnalysis?: GroundableCompetitorAnalysis;
  socialProfileCandidates?: GroundableSocialCandidate[];
}

interface GroundingBrregCompany {
  organizationNumber?: string | null;
}

interface GroundingWebsitePageSnippet {
  url?: string | null;
  title?: string | null;
  snippet?: string | null;
  sourceLabel?: string | null;
}

interface GroundingWebsiteInsights {
  finalUrl?: string | null;
  pageTitle?: string | null;
  siteName?: string | null;
  metaDescription?: string | null;
  textSnippet?: string | null;
  selectedPageSnippets?: GroundingWebsitePageSnippet[];
  socialProfileCandidates?: GroundableSocialCandidate[];
}

export interface RoleRoomAgentGroundingSources {
  brregCompany?: GroundingBrregCompany | null;
  websiteInsights?: GroundingWebsiteInsights | null;
  businessSignals?: {
    displayName?: string | null;
    formattedAddress?: string | null;
    websiteUri?: string | null;
    googleMapsUri?: string | null;
    reviewSummary?: string | null;
  } | null;
  competitorAnalysis?: GroundableCompetitorAnalysis | null;
}

// ----------------------------------------------------------------------------
// Small, dependency-free helpers (mirrors the style of role-room-agent.ts but
// kept local so this module has no coupling and no import cycle).
// ----------------------------------------------------------------------------

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function digitsOnly(value: unknown): string {
  return typeof value === "string" ? value.replace(/\D/g, "") : "";
}

function normalizeName(value: unknown): string {
  return typeof value === "string"
    ? value.toLowerCase().replace(/\s+/g, " ").trim()
    : "";
}

/** Reduce a URL (or bare host) to a comparable lowercase host without the
 *  leading "www." and without protocol/path. Returns "" when unparseable. */
function normalizeHost(value: unknown): string {
  if (!hasText(value)) return "";
  let raw = value.trim().toLowerCase();
  raw = raw.replace(/^[a-z][a-z0-9+.\-]*:\/\//, "");
  raw = raw.replace(/^www\./, "");
  // Drop everything from the first path / query / port separator.
  raw = raw.split(/[/?#:]/)[0] ?? "";
  return raw.trim();
}

/** A value whose entire (trimmed) content reads as an email address. */
function looksLikeEmail(value: string): boolean {
  const trimmed = value.trim().replace(/^mailto:/i, "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

/** A value whose entire (trimmed) content reads as a bare phone number
 *  (optionally tel:-prefixed). Deliberately strict so prose that merely
 *  mentions a number is never matched — only dedicated contact fields. */
function looksLikePhone(value: string): boolean {
  const trimmed = value.trim().replace(/^tel:/i, "").trim();
  if (!trimmed) return false;
  if (!/^[+(]?\d[\d\s().+\-]{4,}$/.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 6 && digits.length <= 15;
}

/** Collect every checkable text fragment from the website insights and the
 *  social-profile candidates into one lowercase corpus + a digits-only copy
 *  (for phone matching). Conservative by design: when a contact value DOES
 *  appear here we keep it; we only strip values with no grounding anywhere. */
function buildContactCorpus(
  websiteInsights: GroundingWebsiteInsights | null | undefined,
  payloadSocials: GroundableSocialCandidate[] | undefined,
  businessSignals: RoleRoomAgentGroundingSources["businessSignals"] | undefined,
): { text: string; digits: string } {
  const parts: string[] = [];
  const push = (v: unknown) => {
    if (hasText(v)) parts.push(v);
  };

  // Google Places signals are a legit contact source too (a website/address/
  // review-summary the synthesis may have pulled a contact from), so include
  // them in the corpus — otherwise a grounded contact could be falsely stripped.
  if (businessSignals) {
    push(businessSignals.displayName);
    push(businessSignals.formattedAddress);
    push(businessSignals.websiteUri);
    push(businessSignals.googleMapsUri);
    push(businessSignals.reviewSummary);
  }

  if (websiteInsights) {
    push(websiteInsights.finalUrl);
    push(websiteInsights.pageTitle);
    push(websiteInsights.siteName);
    push(websiteInsights.metaDescription);
    push(websiteInsights.textSnippet);
    for (const snippet of websiteInsights.selectedPageSnippets ?? []) {
      push(snippet?.url);
      push(snippet?.title);
      push(snippet?.snippet);
      push(snippet?.sourceLabel);
    }
  }

  const socials = [
    ...(websiteInsights?.socialProfileCandidates ?? []),
    ...(payloadSocials ?? []),
  ];
  for (const candidate of socials) {
    push(candidate?.url);
    push(candidate?.canonicalUrl);
    push(candidate?.handle);
    push(candidate?.displayName);
  }

  const text = parts.join("  ").toLowerCase();
  return { text, digits: text.replace(/\D/g, "") };
}

/** Build the set of identities (normalized names + hosts) that the
 *  competitor source list actually contains. A synthesized competitor is
 *  only allowed to keep a "verified" status when its name OR host matches
 *  one of these. */
function buildCompetitorIdentity(
  source: GroundableCompetitorAnalysis | null | undefined,
): { names: Set<string>; hosts: Set<string> } {
  const names = new Set<string>();
  const hosts = new Set<string>();
  for (const competitor of source?.competitors ?? []) {
    const name = normalizeName(competitor?.name);
    if (name) names.add(name);
    const host = normalizeHost(competitor?.websiteUrl);
    if (host) hosts.add(host);
  }
  return { names, hosts };
}

/** Standard companyProfile keys that are never contact fields — skipped by
 *  the contact scan. organizationNumber is handled by its own grounding rule
 *  above, so it is excluded here too. Any OTHER key (e.g. an LLM-injected
 *  `email` / `phone` / `contactEmail`) is scanned. */
const NON_CONTACT_PROFILE_KEYS = new Set<string>([
  "organizationNumber",
]);

/**
 * Conservative, deterministic grounding of HARD facts on a bootstrap payload.
 *
 * Only touches:
 *  - companyProfile.organizationNumber that doesn't match Brreg (digits-only).
 *  - competitor entries claimed `verified` whose name/host isn't in the
 *    competitor source list → downgraded to `likely`.
 *  - phone/email-looking companyProfile contact fields not found anywhere in
 *    the website insights text/snippets/social candidates → nulled.
 *
 * Pure: never mutates the input, never throws, no I/O.
 */
export function groundBootstrapPayload<P extends RoleRoomAgentGroundablePayload>(
  payload: P,
  sources: RoleRoomAgentGroundingSources,
): { payload: P; strippedReasons: string[] } {
  const strippedReasons: string[] = [];

  // Defensive: a missing/garbage payload is returned untouched.
  if (!payload || typeof payload !== "object") {
    return { payload, strippedReasons };
  }

  const safeSources: RoleRoomAgentGroundingSources = sources && typeof sources === "object" ? sources : {};

  // --- 1. organizationNumber -------------------------------------------------
  let nextCompanyProfile = payload.companyProfile;
  if (nextCompanyProfile && typeof nextCompanyProfile === "object") {
    const profileClone: GroundableCompanyProfile = { ...nextCompanyProfile };
    let profileChanged = false;

    const claimedOrgnr = digitsOnly(profileClone.organizationNumber);
    if (claimedOrgnr) {
      const groundedOrgnr = digitsOnly(safeSources.brregCompany?.organizationNumber);
      if (!groundedOrgnr || claimedOrgnr !== groundedOrgnr) {
        profileClone.organizationNumber = null;
        profileChanged = true;
        strippedReasons.push("grounding_stripped_ungrounded_orgnr");
      }
    }

    // --- 3. contact fields ---------------------------------------------------
    const corpus = buildContactCorpus(
      safeSources.websiteInsights,
      payload.socialProfileCandidates,
      safeSources.businessSignals,
    );
    for (const key of Object.keys(profileClone)) {
      if (NON_CONTACT_PROFILE_KEYS.has(key)) continue;
      const value = profileClone[key];
      if (typeof value !== "string" || value.trim().length === 0) continue;

      if (looksLikeEmail(value)) {
        const needle = value.trim().replace(/^mailto:/i, "").trim().toLowerCase();
        if (!corpus.text.includes(needle)) {
          profileClone[key] = null;
          profileChanged = true;
          strippedReasons.push("grounding_stripped_ungrounded_contact");
        }
        continue;
      }
      if (looksLikePhone(value)) {
        const needle = value.replace(/\D/g, "");
        if (needle.length === 0 || !corpus.digits.includes(needle)) {
          profileClone[key] = null;
          profileChanged = true;
          strippedReasons.push("grounding_stripped_ungrounded_contact");
        }
      }
    }

    if (profileChanged) {
      nextCompanyProfile = profileClone;
    }
  }

  // --- 2. competitor verification -------------------------------------------
  let nextCompetitorAnalysis = payload.competitorAnalysis;
  const competitors = payload.competitorAnalysis?.competitors;
  if (Array.isArray(competitors) && competitors.length > 0) {
    const identity = buildCompetitorIdentity(safeSources.competitorAnalysis);
    let competitorsChanged = false;

    const nextCompetitors = competitors.map((competitor) => {
      if (!competitor || typeof competitor !== "object") return competitor;
      if (competitor.status !== "verified") return competitor;

      const name = normalizeName(competitor.name);
      const host = normalizeHost(competitor.websiteUrl);
      const grounded = (name && identity.names.has(name)) || (host && identity.hosts.has(host));
      if (grounded) return competitor;

      competitorsChanged = true;
      strippedReasons.push("grounding_downgraded_unverified_competitor");
      return { ...competitor, status: "likely" };
    });

    if (competitorsChanged) {
      nextCompetitorAnalysis = {
        ...payload.competitorAnalysis,
        competitors: nextCompetitors,
      };
    }
  }

  // Only allocate a new payload object if something actually changed.
  if (
    nextCompanyProfile === payload.companyProfile &&
    nextCompetitorAnalysis === payload.competitorAnalysis
  ) {
    return { payload, strippedReasons };
  }

  const groundedPayload = {
    ...payload,
    companyProfile: nextCompanyProfile,
    competitorAnalysis: nextCompetitorAnalysis,
  } as P;

  return { payload: groundedPayload, strippedReasons };
}
