/**
 * leadgrid-url-research-routes.ts
 *
 * URL Research-flyt for Leadgrid — bruker hele Role Room Agents
 * research-stack (Brreg → website → Google Places → Claude synthesis)
 * for å forvandle EN URL til EN draft-lead på Lead Map.
 *
 * Strategien er en "draft-first" pattern:
 *   1. /start          → opprett DB-rad m/ draft_status='draft'.
 *                        Returner draft_lead_id + research_job_id.
 *   2. /run            → kjør orchestrator-pipeline (tar 10-30s).
 *                        Oppdater draft m/ companyProfile + lokasjon.
 *                        Sett draft_status='researched',
 *                        location_confidence='exact'|'geocoded'|
 *                        'approximate'|'unknown'.
 *   3. /preview/:id    → hent draft + research_result for UI.
 *   4. /commit         → bruker aksepterer: draft_status='lead',
 *                        ENS lead_status='unvisited'.
 *                        Eller forkast: DELETE FROM crm_customers.
 *   5. /refresh-section→ rekjør én del av research (companyProfile|
 *                        competitors|opportunities).
 *
 * Lokasjons-fallback-kjede (vesentlig for pin-garantien):
 *   a) Google Places businessSignals.location → 'exact'.
 *   b) Hvis ingen lat/lng: Google Geocoding på Brreg-adresse → 'geocoded'.
 *   c) Hvis fortsatt ingen: by-sentroid (NO-hardkoding eller Geocoding
 *      på "By, NO") → 'approximate'.
 *   d) Hvis vi ikke har by: lat/lng = null, 'unknown' (UI gir manuell
 *      kart-velger).
 *
 * Auth: requireLeadMapPermission('leads.import_url'). Permission-key
 * deles med CSV-importen via mig 328.
 *
 * Rate-limiting: vi stoler på Role Room Agents egen ratelimit
 * (role-room-agent-ratelimit.ts) + Claude-cachen (role-room-agent-
 * cache.ts) — ingen ny tabell nødvendig.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import crypto from "crypto";

import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";
import { classifyIndustryForLead } from "./leadgrid-industry-classify.js";
import { runOrchestratedBootstrap } from "./role-room-agent-bootstrap-orchestrator.js";
import {
  fetchGooglePlaceDetails,
  fetchGooglePlacesBusinessSignals,
  extractEmailFromWebsite,
  calculateLeadQuality,
  type RoleRoomAgentBrregCompany,
  type RoleRoomAgentBusinessSignals,
  type RoleRoomAgentPlaceContactDetails,
  type RoleRoomAgentProducerBootstrapInput,
  type RoleRoomAgentWebsiteInsights,
} from "./role-room-agent.js";
import {
  processUrlResearchBatch,
  readBatchProgress,
  normalizeAndValidateUrls,
  retrySingleItem,
  markItemSkipped,
} from "./leadgrid-url-batch-processor.js";

// =====================================================================
// Types
// =====================================================================

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

export type LocationConfidence =
  | "exact"
  | "geocoded"
  | "approximate"
  | "unknown";

export interface ResolvedLocation {
  latitude: number | null;
  longitude: number | null;
  confidence: LocationConfidence;
  source: string;
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
}

interface SocialUrls {
  instagram?: string | null;
  linkedin?: string | null;
  facebook?: string | null;
}

interface DerivedCompanyProfile {
  name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  industry: string | null;
  organizationNumber: string | null;
  summary: string | null;
  logoUrl: string | null;
  socials: SocialUrls;
  estimatedValueOere: number | null;
  aiOpportunityScore: number | null;
}

interface ResearchRunResult {
  companyProfile: DerivedCompanyProfile;
  location: ResolvedLocation;
  bootstrapPayload: Record<string, unknown>;
  /** 0-100 — beregnet via calculateLeadQuality(). Persisteres på
   *  crm_customers.ai_opportunity_score som hover-over til selger. */
  qualityScore: number | null;
}

// =====================================================================
// Session-helpers (mirrors leadgrid-import-routes.ts)
// =====================================================================

function getSession(
  req: Request,
  activeSessions: Map<string, SessionData>,
): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const s = activeSessions.get(auth.slice(7));
    if (s) return s;
  }
  const cookieSid = (
    req as Request & {
      session?: { userId?: string; email?: string; role?: string };
    }
  ).session;
  if (cookieSid?.userId) {
    return {
      userId: cookieSid.userId,
      email: cookieSid.email,
      role: cookieSid.role,
    };
  }
  return null;
}

async function resolveOrgId(
  req: Request,
  pool: Pool,
  userId: string,
): Promise<string | null> {
  const explicit =
    (req.query?.organization_id ??
      (req.body as { organization_id?: string } | undefined)
        ?.organization_id) as string | undefined;
  if (typeof explicit === "string" && explicit.length > 0) return explicit;
  const r = await pool.query<{ organization_id: string }>(
    `SELECT organization_id::text FROM organization_members
      WHERE user_id = $1 ORDER BY joined_at ASC LIMIT 1`,
    [userId],
  );
  return r.rows[0]?.organization_id ?? null;
}

// =====================================================================
// City centroids — sist-resort fallback når Geocoding feiler
// =====================================================================

const NO_CITY_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  oslo: { lat: 59.913868, lng: 10.752245 },
  bergen: { lat: 60.39299, lng: 5.32415 },
  trondheim: { lat: 63.4305, lng: 10.3951 },
  stavanger: { lat: 58.96998, lng: 5.7331 },
  tromsø: { lat: 69.6492, lng: 18.9553 },
  tromso: { lat: 69.6492, lng: 18.9553 },
  kristiansand: { lat: 58.1467, lng: 7.9956 },
  drammen: { lat: 59.7439, lng: 10.2045 },
  fredrikstad: { lat: 59.2179, lng: 10.9298 },
  sandnes: { lat: 58.85248, lng: 5.7333 },
  sarpsborg: { lat: 59.2839, lng: 11.1095 },
  bodø: { lat: 67.2804, lng: 14.4049 },
  bodo: { lat: 67.2804, lng: 14.4049 },
  ålesund: { lat: 62.4722, lng: 6.1495 },
  alesund: { lat: 62.4722, lng: 6.1495 },
  haugesund: { lat: 59.4138, lng: 5.2683 },
  arendal: { lat: 58.4615, lng: 8.7724 },
  tønsberg: { lat: 59.2674, lng: 10.4076 },
  tonsberg: { lat: 59.2674, lng: 10.4076 },
  moss: { lat: 59.4348, lng: 10.6608 },
  bærum: { lat: 59.8939, lng: 10.5469 },
  baerum: { lat: 59.8939, lng: 10.5469 },
};

function lookupCityCentroid(
  city: string | null | undefined,
): { lat: number; lng: number } | null {
  if (!city) return null;
  const key = city.trim().toLowerCase();
  return NO_CITY_CENTROIDS[key] ?? null;
}

// =====================================================================
// Google Geocoding fallback
// =====================================================================

interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress?: string;
}

/**
 * Spør Google Geocoding API på en streng. Returnerer best-match
 * koordinater. Bruker samme API-nøkkel som Places. Returnerer null ved
 * timeout / nettverksfeil / ZERO_RESULTS.
 *
 * Eksportert for unit-tester (mockes med vi.spyOn).
 */
export async function geocodeAddress(
  address: string,
  apiKey: string = process.env.GOOGLE_PLACES_API_KEY ?? "",
): Promise<GeocodeResult | null> {
  if (!address || !apiKey) return null;
  const url =
    "https://maps.googleapis.com/maps/api/geocode/json" +
    `?address=${encodeURIComponent(address)}&key=${apiKey}`;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8_000);
    const resp = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!resp.ok) return null;
    const data = (await resp.json()) as {
      status?: string;
      results?: Array<{
        geometry?: { location?: { lat?: number; lng?: number } };
        formatted_address?: string;
      }>;
    };
    if (data.status !== "OK" || !Array.isArray(data.results)) return null;
    const first = data.results[0];
    const loc = first?.geometry?.location;
    if (
      typeof loc?.lat !== "number" ||
      typeof loc?.lng !== "number" ||
      Number.isNaN(loc.lat) ||
      Number.isNaN(loc.lng)
    ) {
      return null;
    }
    return {
      lat: loc.lat,
      lng: loc.lng,
      formattedAddress: first?.formatted_address,
    };
  } catch {
    return null;
  }
}

// =====================================================================
// Lokasjons-resolver — kjernen av pin-garantien
// =====================================================================

/**
 * Avgjør beste lat/lng for en lead. Sjekkes i rekkefølge:
 *   1. businessSignals.location (Google Places direkte) → 'exact'
 *   2. Geocode-anrop på "{adresse}, {by}, {country}" → 'geocoded'
 *   3. Geocode på "{by}, {country}" → 'geocoded'
 *   4. By-sentroid via hardkodet kart → 'approximate'
 *   5. Geocode kun "{country}" → 'approximate' (sist mulig)
 *   6. Ingenting → 'unknown'.
 */
export async function resolveLocation(opts: {
  businessSignals: RoleRoomAgentBusinessSignals | null;
  brregCompany: RoleRoomAgentBrregCompany | null;
  companyProfile: { city: string | null; country: string | null; address: string | null };
  geocoder?: (q: string) => Promise<GeocodeResult | null>;
}): Promise<ResolvedLocation> {
  const { businessSignals, brregCompany, companyProfile } = opts;
  const geocoder = opts.geocoder ?? geocodeAddress;
  const country =
    companyProfile.country ?? brregCompany?.businessAddress ? "NO" : null;
  const effectiveCountry = companyProfile.country ?? "NO";

  // 1. Google Places direkte
  const placesLoc = businessSignals?.location;
  if (
    placesLoc &&
    typeof placesLoc.latitude === "number" &&
    typeof placesLoc.longitude === "number"
  ) {
    return {
      latitude: placesLoc.latitude,
      longitude: placesLoc.longitude,
      confidence: "exact",
      source: "google_places",
      address:
        businessSignals?.formattedAddress ??
        companyProfile.address ??
        brregCompany?.businessAddress ??
        null,
      postalCode: null,
      city: companyProfile.city ?? brregCompany?.municipality ?? null,
      country: effectiveCountry,
    };
  }

  // 2. Geocode full adresse (Brreg eller orchestrator)
  const fullAddress =
    companyProfile.address ?? brregCompany?.businessAddress ?? null;
  if (fullAddress) {
    const query = [fullAddress, companyProfile.city, effectiveCountry]
      .filter(Boolean)
      .join(", ");
    const r = await geocoder(query);
    if (r) {
      return {
        latitude: r.lat,
        longitude: r.lng,
        confidence: "geocoded",
        source: "google_geocoding_address",
        address: fullAddress,
        postalCode: null,
        city: companyProfile.city ?? brregCompany?.municipality ?? null,
        country: effectiveCountry,
      };
    }
  }

  // 3. Geocode bare by
  const city = companyProfile.city ?? brregCompany?.municipality ?? null;
  if (city) {
    const r = await geocoder(`${city}, ${effectiveCountry}`);
    if (r) {
      return {
        latitude: r.lat,
        longitude: r.lng,
        confidence: "geocoded",
        source: "google_geocoding_city",
        address: fullAddress,
        postalCode: null,
        city,
        country: effectiveCountry,
      };
    }
    // 4. By-sentroid
    const centroid = lookupCityCentroid(city);
    if (centroid) {
      return {
        latitude: centroid.lat,
        longitude: centroid.lng,
        confidence: "approximate",
        source: "city_centroid_lookup",
        address: fullAddress,
        postalCode: null,
        city,
        country: effectiveCountry,
      };
    }
  }

  // 5. Land-sentroid fallback (sist resort før unknown)
  if (effectiveCountry) {
    const r = await geocoder(effectiveCountry);
    if (r) {
      return {
        latitude: r.lat,
        longitude: r.lng,
        confidence: "approximate",
        source: "country_centroid",
        address: fullAddress,
        postalCode: null,
        city,
        country: effectiveCountry,
      };
    }
  }

  // 6. Ingen lokasjon
  return {
    latitude: null,
    longitude: null,
    confidence: "unknown",
    source: "no_match",
    address: fullAddress,
    postalCode: null,
    city,
    country: country ?? effectiveCountry,
  };
}

// =====================================================================
// Orchestrator → DerivedCompanyProfile
// =====================================================================

function extractStringField(obj: unknown, key: string): string | null {
  if (!obj || typeof obj !== "object") return null;
  const rec = obj as Record<string, unknown>;
  const v = rec[key];
  if (typeof v === "string" && v.trim().length > 0) return v.trim();
  return null;
}

function pickSocialUrls(
  socialCandidates: ReadonlyArray<{
    platform: string;
    canonicalUrl?: string;
    url?: string;
    status?: string;
  }> = [],
): SocialUrls {
  const out: SocialUrls = {};
  for (const c of socialCandidates) {
    // Vi stoler kun på 'verified' eller 'likely' for å unngå støy
    if (c.status === "rejected") continue;
    const url = c.canonicalUrl ?? c.url ?? null;
    if (!url) continue;
    if (c.platform === "instagram" && !out.instagram) out.instagram = url;
    else if (c.platform === "linkedin" && !out.linkedin) out.linkedin = url;
    else if (c.platform === "facebook" && !out.facebook) out.facebook = url;
  }
  return out;
}

export function deriveCompanyProfile(
  bootstrap: Record<string, unknown> | null,
  businessSignals: RoleRoomAgentBusinessSignals | null,
  brregCompany: RoleRoomAgentBrregCompany | null,
  fallbackUrl: string,
): DerivedCompanyProfile {
  const cp =
    bootstrap && typeof bootstrap === "object" && "companyProfile" in bootstrap
      ? ((bootstrap as Record<string, unknown>).companyProfile as Record<
          string,
          unknown
        >)
      : null;

  const name =
    extractStringField(cp, "companyName") ??
    brregCompany?.name ??
    businessSignals?.displayName ??
    null;

  const website = extractStringField(cp, "websiteUrl") ?? fallbackUrl;
  const industry = extractStringField(cp, "industry");
  const summary = extractStringField(cp, "summary");
  const logoUrl = extractStringField(cp, "logoUrl");
  const orgNumber =
    extractStringField(cp, "organizationNumber") ??
    brregCompany?.organizationNumber ??
    null;

  // Email/phone er ikke direkte i companyProfile-skjemaet, men finnes
  // i websiteInsights via socialProfileCandidates eller textSnippet.
  // For nå: håndteres som null hvis ikke supplert av orchestrator.
  const ws =
    bootstrap && typeof bootstrap === "object" && "websiteInsights" in bootstrap
      ? (bootstrap as Record<string, unknown>).websiteInsights
      : null;
  const socials = pickSocialUrls(
    Array.isArray(
      (ws as Record<string, unknown> | null)?.socialProfileCandidates,
    )
      ? ((ws as Record<string, unknown>).socialProfileCandidates as Array<{
          platform: string;
          canonicalUrl?: string;
          url?: string;
          status?: string;
        }>)
      : [],
  );

  return {
    name,
    company: name,
    email: null,
    phone: null,
    website,
    industry,
    organizationNumber: orgNumber,
    summary,
    logoUrl,
    socials,
    estimatedValueOere: null,
    aiOpportunityScore: null,
  };
}

// =====================================================================
// Core research-run — gjenbruker Role Room Agent
// =====================================================================

export async function runUrlResearch(opts: {
  websiteUrl: string;
  draftId: string;
}): Promise<ResearchRunResult | null> {
  const input: RoleRoomAgentProducerBootstrapInput = {
    projectId: `lead-${opts.draftId}`,
    websiteUrl: opts.websiteUrl,
    companyName: null,
    organizationNumber: null,
  };

  const orch = await runOrchestratedBootstrap(input);
  if (!orch) return null;

  // Hvis orchestrator ikke fant Google Places, prøv en eksplisitt
  // lookup nå basert på selskapsnavn fra orchestrator-synthesis.
  let businessSignals: RoleRoomAgentBusinessSignals | null =
    orch.businessSignals;
  const synthesisCompanyName =
    extractStringField(
      (orch.synthesis as Record<string, unknown>)?.companyProfile,
      "companyName",
    ) ??
    orch.brregCompany?.name ??
    null;
  if (!businessSignals && synthesisCompanyName) {
    const websiteHint: RoleRoomAgentWebsiteInsights = orch.websiteInsights ?? {
      finalUrl: opts.websiteUrl,
      selectedPageSnippets: [],
      socialProfileCandidates: [],
    };
    try {
      businessSignals = await fetchGooglePlacesBusinessSignals(
        { ...input, companyName: synthesisCompanyName },
        websiteHint,
      );
    } catch {
      // Stille fallback — Places er valgfritt
    }
  }

  // Fix 3 (live-test 2026-06-27): hent Google Place Details for å fylle
  // phone/website/openingHours/rating når business-signals returnerte
  // place_id men ikke contact-info. Discovery-flyten har samme problem
  // — vi gjør én ekstra call så leads ikke er ubrukelig for outreach.
  let placeContactDetails: RoleRoomAgentPlaceContactDetails | null = null;
  const placeIdFromSignals = businessSignals?.placeId ?? null;
  if (placeIdFromSignals) {
    try {
      placeContactDetails = await fetchGooglePlaceDetails(placeIdFromSignals);
    } catch {
      // Best-effort — Place Details er valgfritt
    }
  }

  const companyProfile = deriveCompanyProfile(
    orch.synthesis as Record<string, unknown> | null,
    businessSignals,
    orch.brregCompany,
    opts.websiteUrl,
  );

  // Berik companyProfile med Places-Details + email-scrape. Brytes ut
  // i egen funksjon for testbarhet.
  await enrichCompanyProfileWithContact(companyProfile, placeContactDetails);

  const location = await resolveLocation({
    businessSignals,
    brregCompany: orch.brregCompany,
    companyProfile: {
      city:
        extractStringField(
          (orch.synthesis as Record<string, unknown>)?.companyProfile,
          "city",
        ) ??
        orch.brregCompany?.municipality ??
        null,
      country:
        extractStringField(
          (orch.synthesis as Record<string, unknown>)?.companyProfile,
          "country",
        ) ?? "NO",
      address:
        extractStringField(
          (orch.synthesis as Record<string, unknown>)?.companyProfile,
          "probableLocationAddress",
        ) ??
        orch.brregCompany?.businessAddress ??
        null,
    },
  });

  // Beregn quality-score basert på Places-data + Brreg-status.
  // En aktiv Brreg-bedrift med 4.0+ rating + 10+ reviews + website +
  // phone scorer 100. Brukes som hover-info i UI.
  const brregActiveRegistered = Boolean(
    orch.brregCompany &&
      (orch.brregCompany.businessRegisterRegistered === true ||
        orch.brregCompany.vatRegistered === true) &&
      !(orch.brregCompany.statusFlags?.bankrupt === true) &&
      !(orch.brregCompany.statusFlags?.underLiquidation === true) &&
      !(orch.brregCompany.statusFlags?.deleted === true),
  );
  const qualityScore = calculateLeadQuality({
    rating: placeContactDetails?.rating ?? businessSignals?.rating ?? null,
    reviewCount:
      placeContactDetails?.reviewCount ?? businessSignals?.userRatingCount ?? null,
    website: companyProfile.website,
    phone: companyProfile.phone,
    brregActiveRegistered,
  });

  // Sett qualityScore på companyProfile.aiOpportunityScore hvis ikke
  // allerede satt (orchestrator-synthesis kan eventuelt overstyre).
  if (companyProfile.aiOpportunityScore == null) {
    companyProfile.aiOpportunityScore = qualityScore;
  }

  return {
    companyProfile,
    location,
    qualityScore,
    bootstrapPayload: {
      synthesis: orch.synthesis,
      brregCompany: orch.brregCompany,
      websiteInsights: orch.websiteInsights,
      businessSignals,
      placeContactDetails,
      qualityScore,
      toolCallsLog: orch.toolCallsLog,
      resolvedLocation: location,
    },
  };
}

/**
 * Berik en companyProfile med kontakt-info fra Places-Details + (hvis
 * fortsatt mangler email) website-scrape.
 *
 * Mutates companyProfile in-place — kalles fra `runUrlResearch` + tester.
 */
export async function enrichCompanyProfileWithContact(
  companyProfile: DerivedCompanyProfile,
  placeDetails: RoleRoomAgentPlaceContactDetails | null,
): Promise<void> {
  // 1. Bruk Places-data først (mer pålitelig enn website-scrape)
  if (placeDetails) {
    if (!companyProfile.phone && placeDetails.phone) {
      companyProfile.phone = placeDetails.phone;
    }
    if (!companyProfile.website && placeDetails.website) {
      companyProfile.website = placeDetails.website;
    }
  }

  // 2. Hvis email fortsatt mangler + vi har en website: scrape mailto:
  if (!companyProfile.email && companyProfile.website) {
    try {
      const email = await extractEmailFromWebsite(companyProfile.website);
      if (email) {
        companyProfile.email = email;
      }
    } catch {
      // Best-effort
    }
  }
}

// =====================================================================
// DB-operasjoner
// =====================================================================

interface DraftLeadRow {
  id: string;
  organization_id: string | null;
  owner_user_id: string;
  website_url: string | null;
  city: string | null;
  draft_status: string | null;
}

async function selectDraft(
  pool: Pool,
  draftId: string,
  userId: string,
): Promise<DraftLeadRow | null> {
  const r = await pool.query<DraftLeadRow>(
    `SELECT id::text, organization_id::text, owner_user_id,
            website_url, city, draft_status
       FROM crm_customers
      WHERE id = $1::uuid AND owner_user_id = $2
      LIMIT 1`,
    [draftId, userId],
  );
  return r.rows[0] ?? null;
}

async function applyResearchToDraft(
  pool: Pool,
  draftId: string,
  result: ResearchRunResult,
): Promise<void> {
  const { companyProfile, location, bootstrapPayload } = result;
  await pool.query(
    `UPDATE crm_customers SET
       name                    = COALESCE($2, name),
       company                 = COALESCE($3, company),
       email                   = COALESCE($4, email),
       phone                   = COALESCE($5, phone),
       website_url             = COALESCE($6, website_url),
       address                 = COALESCE($7, address),
       postal_code             = COALESCE($8, postal_code),
       city                    = COALESCE($9, city),
       country                 = COALESCE($10, country),
       latitude                = $11,
       longitude               = $12,
       location_confidence     = $13,
       instagram_url           = COALESCE($14, instagram_url),
       linkedin_url            = COALESCE($15, linkedin_url),
       lead_source             = 'url_research',
       lead_status             = 'unvisited',
       ai_opportunity_score    = COALESCE($16, ai_opportunity_score),
       estimated_value         = COALESCE($17, estimated_value),
       draft_status            = 'researched',
       import_raw_data         = $18::jsonb,
       updated_at              = NOW()
     WHERE id = $1::uuid`,
    [
      draftId,
      companyProfile.name,
      companyProfile.company,
      companyProfile.email,
      companyProfile.phone,
      companyProfile.website,
      location.address,
      location.postalCode,
      location.city,
      location.country,
      location.latitude,
      location.longitude,
      location.confidence,
      companyProfile.socials.instagram ?? null,
      companyProfile.socials.linkedin ?? null,
      companyProfile.aiOpportunityScore,
      companyProfile.estimatedValueOere,
      JSON.stringify(bootstrapPayload ?? {}),
    ],
  );
  // Facebook har egen kolonne hvis tilgjengelig — separat query for å
  // unngå dependency-feil hvis kolonnen mangler i en eldre prod-DB.
  if (companyProfile.socials.facebook) {
    try {
      await pool.query(
        `UPDATE crm_customers SET facebook_url = COALESCE($2, facebook_url)
          WHERE id = $1::uuid`,
        [draftId, companyProfile.socials.facebook],
      );
    } catch {
      // Stille fail — kolonnen kan mangle i eldre miljøer.
    }
  }

  // Klassifisér mot industries-katalogen (mig 329) basert på Brreg-
  // NACE-kode primært, deretter trigram-match på companyProfile.industry.
  // Feiler stille hvis industries-tabellen ikke finnes ennå (mig ikke kjørt).
  try {
    const brreg = bootstrapPayload?.brregCompany as
      | { industryCode?: { code?: string | null; description?: string | null } | null }
      | null
      | undefined;
    const classification = await classifyIndustryForLead(pool, {
      naceCode: brreg?.industryCode?.code ?? null,
      naceDescription: brreg?.industryCode?.description ?? null,
      companyIndustryText: companyProfile.industry ?? null,
      companySummary: companyProfile.summary ?? null,
    });
    if (classification.industryId) {
      await pool.query(
        `UPDATE crm_customers SET industry_id = $2::uuid, updated_at = NOW()
          WHERE id = $1::uuid`,
        [draftId, classification.industryId],
      );
    }
  } catch (err) {
    // Industries-systemet er valgfritt for at URL-research skal fungere.
    // Logg, men ikke bryt flyten.
    console.warn("[leadgrid-url-research] industry classification failed:", (err as Error).message);
  }
}

interface CommitOverrides {
  latitude?: number | null;
  longitude?: number | null;
  location_confidence?: LocationConfidence;
  name?: string | null;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website_url?: string | null;
  notes?: string | null;
  lead_status?: string;
}

async function applyOverridesAndPromote(
  pool: Pool,
  draftId: string,
  overrides: CommitOverrides,
): Promise<void> {
  // Bygg dynamisk SET-list slik at vi bare oppdaterer det som ble sendt.
  const sets: string[] = [
    "draft_status = 'lead'",
    "lead_status = COALESCE(NULLIF(lead_status, ''), 'unvisited')",
    "updated_at = NOW()",
  ];
  const params: unknown[] = [draftId];
  function add(col: string, value: unknown) {
    if (value === undefined) return;
    params.push(value);
    sets.push(`${col} = $${params.length}`);
  }
  add("latitude", overrides.latitude);
  add("longitude", overrides.longitude);
  add("location_confidence", overrides.location_confidence);
  add("name", overrides.name);
  add("city", overrides.city);
  add("address", overrides.address);
  add("phone", overrides.phone);
  add("email", overrides.email);
  add("website_url", overrides.website_url);
  add("notes", overrides.notes);
  if (overrides.lead_status) {
    add("lead_status", overrides.lead_status);
  }

  await pool.query(
    `UPDATE crm_customers SET ${sets.join(", ")}
      WHERE id = $1::uuid`,
    params,
  );
}

// =====================================================================
// Hent lead i samme shape som Lead Map APIClient forventer
// =====================================================================

async function fetchLeadForResponse(
  pool: Pool,
  leadId: string,
): Promise<Record<string, unknown> | null> {
  const r = await pool.query(
    `SELECT id::text,
            name,
            company,
            lead_category AS category,
            COALESCE(lead_status, 'unvisited') AS status,
            address,
            postal_code,
            city,
            country,
            CASE WHEN latitude IS NOT NULL THEN latitude::float8 ELSE NULL END AS latitude,
            CASE WHEN longitude IS NOT NULL THEN longitude::float8 ELSE NULL END AS longitude,
            phone,
            email,
            website_url,
            instagram_url,
            linkedin_url,
            google_rating,
            google_place_id,
            NULL::text AS logo_url,
            ai_opportunity_score,
            CASE WHEN estimated_value IS NOT NULL THEN estimated_value::float8 ELSE NULL END AS estimated_value,
            lead_source,
            location_confidence,
            draft_status,
            created_at,
            updated_at
       FROM crm_customers
      WHERE id = $1::uuid
      LIMIT 1`,
    [leadId],
  );
  return (r.rows[0] as Record<string, unknown>) ?? null;
}

// =====================================================================
// Route-registrering
// =====================================================================

export function registerLeadgridUrlResearchRoutes(deps: Deps): void {
  const { app, pool, activeSessions } = deps;

  const permUrl = requireLeadMapPermission("leads.import_url", {
    pool,
    activeSessions,
  });

  // -------------------------------------------------------------------
  // POST /api/leadgrid/url-research/start
  // -------------------------------------------------------------------
  app.post(
    "/api/leadgrid/url-research/start",
    permUrl,
    async (req: Request, res: Response) => {
      const session = getSession(req, activeSessions);
      if (!session?.userId) {
        return res.status(401).json({ error: "Innlogging kreves" });
      }
      const body = (req.body ?? {}) as { url?: string };
      const rawUrl = typeof body.url === "string" ? body.url.trim() : "";
      if (!rawUrl) {
        return res.status(400).json({ error: "missing_url" });
      }
      // Tillat brukeren å lime inn "domene.no" — auto-prefix m/ https.
      let url = rawUrl;
      if (!/^https?:\/\//i.test(url)) {
        url = `https://${url}`;
      }
      try {
        // Validér at det er en lovlig URL.
        new URL(url);
      } catch {
        return res.status(400).json({ error: "invalid_url" });
      }

      const orgId = await resolveOrgId(req, pool, session.userId);
      const batchId = crypto.randomUUID();

      try {
        const r = await pool.query<{ id: string }>(
          `INSERT INTO crm_customers (
              id, name, status, source,
              owner_user_id, organization_id,
              website_url,
              lead_status, lead_source,
              draft_status,
              import_source, import_batch_id,
              created_at, updated_at
            ) VALUES (
              gen_random_uuid(), $1, 'lead', 'url_research',
              $2, $3::uuid,
              $4,
              'unvisited', 'url_research',
              'draft',
              'url_research', $5::uuid,
              NOW(), NOW()
            )
            RETURNING id::text`,
          [
            "Research pågår…",
            session.userId,
            orgId,
            url,
            batchId,
          ],
        );
        const draftId = r.rows[0].id;
        return res.json({
          draft_lead_id: draftId,
          research_job_id: batchId,
          url,
        });
      } catch (err) {
        console.error("[leadgrid-url-research] start failed", err);
        return res
          .status(500)
          .json({ error: "start_failed", detail: (err as Error).message });
      }
    },
  );

  // -------------------------------------------------------------------
  // POST /api/leadgrid/url-research/run
  // -------------------------------------------------------------------
  app.post(
    "/api/leadgrid/url-research/run",
    permUrl,
    async (req: Request, res: Response) => {
      const session = getSession(req, activeSessions);
      if (!session?.userId) {
        return res.status(401).json({ error: "Innlogging kreves" });
      }
      const body = (req.body ?? {}) as { draft_lead_id?: string };
      const draftId =
        typeof body.draft_lead_id === "string" ? body.draft_lead_id : "";
      if (!draftId) {
        return res.status(400).json({ error: "missing_draft_lead_id" });
      }

      const draft = await selectDraft(pool, draftId, session.userId);
      if (!draft) {
        return res.status(404).json({ error: "draft_not_found" });
      }
      if (!draft.website_url) {
        return res.status(400).json({ error: "draft_missing_url" });
      }

      try {
        const result = await runUrlResearch({
          websiteUrl: draft.website_url,
          draftId,
        });
        if (!result) {
          return res.status(502).json({ error: "orchestrator_unavailable" });
        }
        await applyResearchToDraft(pool, draftId, result);

        const lead = await fetchLeadForResponse(pool, draftId);
        return res.json({
          draft_lead_id: draftId,
          lead,
          location_confidence: result.location.confidence,
          location_source: result.location.source,
          research_result: {
            companyProfile: result.companyProfile,
            location: result.location,
            synthesis: result.bootstrapPayload.synthesis ?? null,
            brregCompany: result.bootstrapPayload.brregCompany ?? null,
            businessSignals: result.bootstrapPayload.businessSignals ?? null,
            websiteInsights: result.bootstrapPayload.websiteInsights ?? null,
          },
        });
      } catch (err) {
        console.error("[leadgrid-url-research] run failed", err);
        return res
          .status(500)
          .json({ error: "run_failed", detail: (err as Error).message });
      }
    },
  );

  // -------------------------------------------------------------------
  // POST /api/leadgrid/url-research/commit
  // -------------------------------------------------------------------
  app.post(
    "/api/leadgrid/url-research/commit",
    permUrl,
    async (req: Request, res: Response) => {
      const session = getSession(req, activeSessions);
      if (!session?.userId) {
        return res.status(401).json({ error: "Innlogging kreves" });
      }
      const body = (req.body ?? {}) as {
        draft_lead_id?: string;
        accept?: boolean;
        overrides?: CommitOverrides;
      };
      const draftId =
        typeof body.draft_lead_id === "string" ? body.draft_lead_id : "";
      if (!draftId) {
        return res.status(400).json({ error: "missing_draft_lead_id" });
      }
      const draft = await selectDraft(pool, draftId, session.userId);
      if (!draft) {
        return res.status(404).json({ error: "draft_not_found" });
      }

      const accept = body.accept !== false; // default true (CTA "Legg til som lead")
      if (!accept) {
        // Bruker forkastet — slett drafted-rad.
        try {
          await pool.query(`DELETE FROM crm_customers WHERE id = $1::uuid`, [
            draftId,
          ]);
          return res.json({ ok: true, deleted: true });
        } catch (err) {
          return res
            .status(500)
            .json({ error: "delete_failed", detail: (err as Error).message });
        }
      }

      try {
        await applyOverridesAndPromote(pool, draftId, body.overrides ?? {});
        const lead = await fetchLeadForResponse(pool, draftId);
        // Forsiktighet: hvis lat/lng fortsatt er null etter commit, gi
        // klart signal til klient slik at UX kan be om manuell pin.
        const requiresManualPin =
          lead?.latitude == null || lead?.longitude == null;
        return res.json({
          ok: true,
          lead,
          requires_manual_pin: requiresManualPin,
        });
      } catch (err) {
        console.error("[leadgrid-url-research] commit failed", err);
        return res
          .status(500)
          .json({ error: "commit_failed", detail: (err as Error).message });
      }
    },
  );

  // -------------------------------------------------------------------
  // GET /api/leadgrid/url-research/preview/:draft_lead_id
  // -------------------------------------------------------------------
  app.get(
    "/api/leadgrid/url-research/preview/:draft_lead_id",
    permUrl,
    async (req: Request, res: Response) => {
      const session = getSession(req, activeSessions);
      if (!session?.userId) {
        return res.status(401).json({ error: "Innlogging kreves" });
      }
      const draftId = req.params.draft_lead_id;
      const draft = await selectDraft(pool, draftId, session.userId);
      if (!draft) {
        return res.status(404).json({ error: "draft_not_found" });
      }
      const r = await pool.query<{
        import_raw_data: Record<string, unknown> | null;
        location_confidence: string | null;
        draft_status: string | null;
      }>(
        `SELECT import_raw_data, location_confidence, draft_status
           FROM crm_customers WHERE id = $1::uuid`,
        [draftId],
      );
      const row = r.rows[0];
      const lead = await fetchLeadForResponse(pool, draftId);
      return res.json({
        draft_lead_id: draftId,
        lead,
        location_confidence: row?.location_confidence ?? "unknown",
        draft_status: row?.draft_status ?? "draft",
        research_result: row?.import_raw_data ?? null,
      });
    },
  );

  // -------------------------------------------------------------------
  // POST /api/leadgrid/url-research/refresh-section
  //
  // Lar UI rekjøre én del av research-resultatet (companyProfile,
  // competitors, opportunities). For nå: bare en full re-run, men vi
  // beholder section-parameteren slik at klienten ikke trenger nytt
  // endepunkt når vi optimaliserer det senere.
  // -------------------------------------------------------------------
  app.post(
    "/api/leadgrid/url-research/refresh-section",
    permUrl,
    async (req: Request, res: Response) => {
      const session = getSession(req, activeSessions);
      if (!session?.userId) {
        return res.status(401).json({ error: "Innlogging kreves" });
      }
      const body = (req.body ?? {}) as {
        draft_lead_id?: string;
        section?: "companyProfile" | "competitors" | "opportunities";
      };
      const draftId =
        typeof body.draft_lead_id === "string" ? body.draft_lead_id : "";
      if (!draftId) {
        return res.status(400).json({ error: "missing_draft_lead_id" });
      }
      const draft = await selectDraft(pool, draftId, session.userId);
      if (!draft || !draft.website_url) {
        return res.status(404).json({ error: "draft_not_found_or_no_url" });
      }
      try {
        const result = await runUrlResearch({
          websiteUrl: draft.website_url,
          draftId,
        });
        if (!result) {
          return res.status(502).json({ error: "orchestrator_unavailable" });
        }
        await applyResearchToDraft(pool, draftId, result);
        const lead = await fetchLeadForResponse(pool, draftId);
        return res.json({
          ok: true,
          section: body.section ?? "all",
          lead,
          location_confidence: result.location.confidence,
          research_result: {
            companyProfile: result.companyProfile,
            location: result.location,
            synthesis: result.bootstrapPayload.synthesis ?? null,
          },
        });
      } catch (err) {
        return res.status(500).json({
          error: "refresh_failed",
          detail: (err as Error).message,
        });
      }
    },
  );

  // =================================================================
  // BULK URL-RESEARCH (mig 0351) — endpoints
  //
  // Selger limer inn N URLer (1-100), batch-processor kjører dem
  // gjennom samme runUrlResearch som enkelt-URL-flyten med max 3
  // parallelle. iPad/web poller progress og rendrer
  // "X / Y leads lagt til på kartet"-counter.
  // =================================================================

  // -------------------------------------------------------------------
  // POST /api/leadgrid/url-research/batch
  // body: { urls: string[] (1-100) }
  // → { batch_id, total_urls, accepted_urls, rejected_urls }
  // -------------------------------------------------------------------
  app.post(
    "/api/leadgrid/url-research/batch",
    permUrl,
    async (req: Request, res: Response) => {
      const session = getSession(req, activeSessions);
      if (!session?.userId) {
        return res.status(401).json({ error: "Innlogging kreves" });
      }
      const body = (req.body ?? {}) as { urls?: unknown };
      const { valid, invalid } = normalizeAndValidateUrls(body.urls);
      if (valid.length === 0) {
        return res.status(400).json({
          error: "no_valid_urls",
          rejected_urls: invalid,
        });
      }
      if (valid.length > 100) {
        return res.status(400).json({
          error: "too_many_urls",
          max: 100,
          provided: valid.length,
        });
      }

      const orgId = await resolveOrgId(req, pool, session.userId);
      const batchId = crypto.randomUUID();

      try {
        // 1. Lag batch-rad
        await pool.query(
          `INSERT INTO leadgrid_url_research_batches (
              id, organization_id, created_by, total_urls, status
            ) VALUES ($1::uuid, $2::uuid, $3, $4, 'pending')`,
          [batchId, orgId, session.userId, valid.length],
        );

        // 2. Lag draft-leads + item-rader (inline INSERT...RETURNING for å
        //    få draft_lead_id på hver item).
        for (let i = 0; i < valid.length; i++) {
          const url = valid[i];
          const draftRes = await pool.query<{ id: string }>(
            `INSERT INTO crm_customers (
                id, name, status, source,
                owner_user_id, organization_id,
                website_url,
                lead_status, lead_source,
                draft_status,
                import_source, import_batch_id,
                created_at, updated_at
              ) VALUES (
                gen_random_uuid(), $1, 'lead', 'url_research_bulk',
                $2, $3::uuid,
                $4,
                'unvisited', 'url_research',
                'draft',
                'url_research_bulk', $5::uuid,
                NOW(), NOW()
              ) RETURNING id::text`,
            ["Research pågår…", session.userId, orgId, url, batchId],
          );
          const draftId = draftRes.rows[0].id;
          await pool.query(
            `INSERT INTO leadgrid_url_research_items (
                batch_id, url, order_index, draft_lead_id, status
              ) VALUES ($1::uuid, $2, $3, $4::uuid, 'pending')`,
            [batchId, url, i, draftId],
          );
        }

        // 3. Trigger processor i bakgrunnen — ikke await.
        setImmediate(() => {
          processUrlResearchBatch(pool, batchId).catch((err) => {
            console.error(
              "[leadgrid-url-research] batch processor failed",
              batchId,
              err,
            );
          });
        });

        return res.json({
          batch_id: batchId,
          total_urls: valid.length,
          accepted_urls: valid.length,
          rejected_urls: invalid,
        });
      } catch (err) {
        console.error("[leadgrid-url-research] batch start failed", err);
        return res.status(500).json({
          error: "batch_start_failed",
          detail: (err as Error).message,
        });
      }
    },
  );

  // -------------------------------------------------------------------
  // GET /api/leadgrid/url-research/batches/:id
  // Full batch + items + summary. Brukes når UI åpnes/re-mounteres.
  // -------------------------------------------------------------------
  app.get(
    "/api/leadgrid/url-research/batches/:id",
    permUrl,
    async (req: Request, res: Response) => {
      const session = getSession(req, activeSessions);
      if (!session?.userId) {
        return res.status(401).json({ error: "Innlogging kreves" });
      }
      const batchId = req.params.id;
      try {
        const batchRes = await pool.query<{
          id: string;
          organization_id: string | null;
          created_by: string;
          total_urls: number;
          completed_urls: number;
          failed_urls: number;
          pinned_leads: number;
          status: string;
          started_at: Date | null;
          finished_at: Date | null;
          created_at: Date;
        }>(
          `SELECT id::text, organization_id::text, created_by::text,
                  total_urls, completed_urls, failed_urls, pinned_leads,
                  status, started_at, finished_at, created_at
             FROM leadgrid_url_research_batches
            WHERE id = $1::uuid AND created_by = $2`,
          [batchId, session.userId],
        );
        const batch = batchRes.rows[0];
        if (!batch) {
          return res.status(404).json({ error: "batch_not_found" });
        }
        const itemsRes = await pool.query<{
          id: string;
          url: string;
          order_index: number;
          status: string;
          draft_lead_id: string | null;
          has_pin: boolean;
          location_confidence: string | null;
          error_message: string | null;
          research_result: Record<string, unknown> | null;
        }>(
          `SELECT id::text, url, order_index, status,
                  draft_lead_id::text, has_pin, location_confidence,
                  error_message, research_result
             FROM leadgrid_url_research_items
            WHERE batch_id = $1::uuid
            ORDER BY order_index ASC`,
          [batchId],
        );
        return res.json({
          batch: {
            id: batch.id,
            organization_id: batch.organization_id,
            created_by: batch.created_by,
            total_urls: batch.total_urls,
            completed_urls: batch.completed_urls,
            failed_urls: batch.failed_urls,
            pinned_leads: batch.pinned_leads,
            status: batch.status,
            started_at: batch.started_at?.toISOString() ?? null,
            finished_at: batch.finished_at?.toISOString() ?? null,
            created_at: batch.created_at.toISOString(),
          },
          items: itemsRes.rows,
          summary: {
            total: batch.total_urls,
            completed: batch.completed_urls,
            failed: batch.failed_urls,
            pinned: batch.pinned_leads,
            pending:
              batch.total_urls - batch.completed_urls - batch.failed_urls,
          },
        });
      } catch (err) {
        return res.status(500).json({
          error: "fetch_failed",
          detail: (err as Error).message,
        });
      }
    },
  );

  // -------------------------------------------------------------------
  // GET /api/leadgrid/url-research/batches/:id/poll
  // Lett-vekt progress — brukes hver 2. sek av iPad/web mens batchen kjører.
  // -------------------------------------------------------------------
  app.get(
    "/api/leadgrid/url-research/batches/:id/poll",
    permUrl,
    async (req: Request, res: Response) => {
      const session = getSession(req, activeSessions);
      if (!session?.userId) {
        return res.status(401).json({ error: "Innlogging kreves" });
      }
      const batchId = req.params.id;
      try {
        // Verifiser eierskap (created_by == userId)
        const own = await pool.query<{ created_by: string }>(
          `SELECT created_by::text FROM leadgrid_url_research_batches
            WHERE id = $1::uuid`,
          [batchId],
        );
        if (!own.rows[0]) {
          return res.status(404).json({ error: "batch_not_found" });
        }
        if (own.rows[0].created_by !== session.userId) {
          return res.status(403).json({ error: "forbidden" });
        }
        const progress = await readBatchProgress(pool, batchId);
        if (!progress) {
          return res.status(404).json({ error: "batch_not_found" });
        }
        // Crude ETA: gjennomsnitt-tid-per-completed-item * pending
        let etaSeconds: number | null = null;
        if (
          progress.startedAt &&
          progress.completed > 0 &&
          progress.status === "running"
        ) {
          const elapsedMs =
            Date.now() - new Date(progress.startedAt).getTime();
          const avgPerItem = elapsedMs / progress.completed;
          const remaining =
            progress.total - progress.completed - progress.failed;
          etaSeconds = Math.round((remaining * avgPerItem) / 1000);
        }
        return res.json({
          batch_id: progress.batchId,
          status: progress.status,
          progress: {
            completed: progress.completed,
            failed: progress.failed,
            pinned: progress.pinned,
            total: progress.total,
          },
          eta_seconds: etaSeconds,
          started_at: progress.startedAt,
          finished_at: progress.finishedAt,
        });
      } catch (err) {
        return res.status(500).json({
          error: "poll_failed",
          detail: (err as Error).message,
        });
      }
    },
  );

  // -------------------------------------------------------------------
  // POST /api/leadgrid/url-research/batches/:id/commit-all
  // body: {
  //   only_with_confidence?: LocationConfidence[]   // default = alle
  //   skip_unknown_location?: boolean               // shortcut for [exact,geocoded,approximate]
  // }
  // Promoterer alle research-erte drafts i batchen til lead-status='unvisited',
  // draft_status='lead'. Returnerer hvor mange som ble committet + utelatt.
  // -------------------------------------------------------------------
  app.post(
    "/api/leadgrid/url-research/batches/:id/commit-all",
    permUrl,
    async (req: Request, res: Response) => {
      const session = getSession(req, activeSessions);
      if (!session?.userId) {
        return res.status(401).json({ error: "Innlogging kreves" });
      }
      const batchId = req.params.id;
      const body = (req.body ?? {}) as {
        only_with_confidence?: LocationConfidence[];
        skip_unknown_location?: boolean;
      };
      try {
        const own = await pool.query<{ created_by: string; status: string }>(
          `SELECT created_by::text, status FROM leadgrid_url_research_batches
            WHERE id = $1::uuid`,
          [batchId],
        );
        if (!own.rows[0]) {
          return res.status(404).json({ error: "batch_not_found" });
        }
        if (own.rows[0].created_by !== session.userId) {
          return res.status(403).json({ error: "forbidden" });
        }

        // Bygg confidence-filter
        let confidenceFilter: string[] | null = null;
        if (Array.isArray(body.only_with_confidence)) {
          confidenceFilter = body.only_with_confidence.filter(
            (c): c is LocationConfidence =>
              c === "exact" ||
              c === "geocoded" ||
              c === "approximate" ||
              c === "unknown",
          );
        } else if (body.skip_unknown_location) {
          confidenceFilter = ["exact", "geocoded", "approximate"];
        }

        // Finn items som skal committes: status='completed', draft_lead_id != null
        const itemsRes = await pool.query<{
          id: string;
          draft_lead_id: string;
          location_confidence: string | null;
        }>(
          `SELECT id::text, draft_lead_id::text, location_confidence
             FROM leadgrid_url_research_items
            WHERE batch_id = $1::uuid
              AND status = 'completed'
              AND draft_lead_id IS NOT NULL`,
          [batchId],
        );
        let committed = 0;
        let skipped = 0;
        for (const item of itemsRes.rows) {
          if (
            confidenceFilter &&
            (item.location_confidence == null ||
              !confidenceFilter.includes(item.location_confidence))
          ) {
            skipped++;
            continue;
          }
          await pool.query(
            `UPDATE crm_customers
                SET draft_status = 'lead',
                    lead_status  = COALESCE(NULLIF(lead_status, ''), 'unvisited'),
                    updated_at   = NOW()
              WHERE id = $1::uuid`,
            [item.draft_lead_id],
          );
          await pool.query(
            `UPDATE leadgrid_url_research_items
                SET final_lead_id = draft_lead_id
              WHERE id = $1::uuid`,
            [item.id],
          );
          committed++;
        }
        return res.json({
          ok: true,
          batch_id: batchId,
          committed,
          skipped,
          filter: confidenceFilter,
        });
      } catch (err) {
        return res.status(500).json({
          error: "commit_all_failed",
          detail: (err as Error).message,
        });
      }
    },
  );

  // -------------------------------------------------------------------
  // POST /api/leadgrid/url-research/batches/:id/cancel
  // -------------------------------------------------------------------
  app.post(
    "/api/leadgrid/url-research/batches/:id/cancel",
    permUrl,
    async (req: Request, res: Response) => {
      const session = getSession(req, activeSessions);
      if (!session?.userId) {
        return res.status(401).json({ error: "Innlogging kreves" });
      }
      const batchId = req.params.id;
      try {
        const own = await pool.query<{ created_by: string; status: string }>(
          `SELECT created_by::text, status FROM leadgrid_url_research_batches
            WHERE id = $1::uuid`,
          [batchId],
        );
        if (!own.rows[0]) {
          return res.status(404).json({ error: "batch_not_found" });
        }
        if (own.rows[0].created_by !== session.userId) {
          return res.status(403).json({ error: "forbidden" });
        }
        if (
          own.rows[0].status === "completed" ||
          own.rows[0].status === "failed" ||
          own.rows[0].status === "partial"
        ) {
          return res.status(409).json({
            error: "batch_already_finished",
            status: own.rows[0].status,
          });
        }
        await pool.query(
          `UPDATE leadgrid_url_research_batches
              SET status = 'cancelled', finished_at = COALESCE(finished_at, NOW())
            WHERE id = $1::uuid`,
          [batchId],
        );
        await pool.query(
          `UPDATE leadgrid_url_research_items
              SET status = 'skipped', finished_at = NOW()
            WHERE batch_id = $1::uuid AND status IN ('pending', 'running')`,
          [batchId],
        );
        return res.json({ ok: true, cancelled: true });
      } catch (err) {
        return res.status(500).json({
          error: "cancel_failed",
          detail: (err as Error).message,
        });
      }
    },
  );

  // -------------------------------------------------------------------
  // Fix 5: POST /api/leadgrid/url-research/batches/:id/items/:itemId/retry
  //
  // iPad-UI: når en item er 'failed' kan brukeren tappe på den for å se
  // detaljer + "Prøv på nytt"-knapp. Backend resetter item-row til
  // pending og kjører bare DEN ene URL'en på nytt via processItem.
  //
  // Returnerer den nye statusen + error_message (hvis den feilet igjen).
  // -------------------------------------------------------------------
  app.post(
    "/api/leadgrid/url-research/batches/:id/items/:itemId/retry",
    permUrl,
    async (req: Request, res: Response) => {
      const session = getSession(req, activeSessions);
      if (!session?.userId) {
        return res.status(401).json({ error: "Innlogging kreves" });
      }
      const batchId = req.params.id;
      const itemId = req.params.itemId;
      try {
        // Verifiser eierskap
        const own = await pool.query<{ created_by: string }>(
          `SELECT b.created_by::text
             FROM leadgrid_url_research_items i
             JOIN leadgrid_url_research_batches b ON b.id = i.batch_id
            WHERE i.id = $1::uuid AND i.batch_id = $2::uuid`,
          [itemId, batchId],
        );
        if (!own.rows[0]) {
          return res.status(404).json({ error: "item_not_found" });
        }
        if (own.rows[0].created_by !== session.userId) {
          return res.status(403).json({ error: "forbidden" });
        }
        const result = await retrySingleItem(pool, itemId);
        return res.json({
          ok: result.ok,
          status: result.status,
          error_message: result.errorMessage ?? null,
        });
      } catch (err) {
        return res.status(500).json({
          error: "retry_failed",
          detail: (err as Error).message,
        });
      }
    },
  );

  // -------------------------------------------------------------------
  // Fix 5: POST /api/leadgrid/url-research/batches/:id/items/:itemId/skip
  //
  // "Marker som irrelevant" — bruker har bestemt seg for å ikke prøve
  // URL'en på nytt (kanskje den er en konkurrent eller feil bransje).
  // Setter status='skipped' så batchen kan finaliseres.
  // -------------------------------------------------------------------
  app.post(
    "/api/leadgrid/url-research/batches/:id/items/:itemId/skip",
    permUrl,
    async (req: Request, res: Response) => {
      const session = getSession(req, activeSessions);
      if (!session?.userId) {
        return res.status(401).json({ error: "Innlogging kreves" });
      }
      const batchId = req.params.id;
      const itemId = req.params.itemId;
      try {
        const own = await pool.query<{ created_by: string }>(
          `SELECT b.created_by::text
             FROM leadgrid_url_research_items i
             JOIN leadgrid_url_research_batches b ON b.id = i.batch_id
            WHERE i.id = $1::uuid AND i.batch_id = $2::uuid`,
          [itemId, batchId],
        );
        if (!own.rows[0]) {
          return res.status(404).json({ error: "item_not_found" });
        }
        if (own.rows[0].created_by !== session.userId) {
          return res.status(403).json({ error: "forbidden" });
        }
        const result = await markItemSkipped(pool, itemId);
        return res.json({ ok: result.ok });
      } catch (err) {
        return res.status(500).json({
          error: "skip_failed",
          detail: (err as Error).message,
        });
      }
    },
  );

  // -------------------------------------------------------------------
  // Fix 5 (bonus): GET /api/leadgrid/url-research/batches/:id/items/:itemId
  //
  // Hent full detalj for én item (error_message, retry_count,
  // last_attempted_at, research_result). Brukes av "Prøv på nytt"-sheet.
  // -------------------------------------------------------------------
  app.get(
    "/api/leadgrid/url-research/batches/:id/items/:itemId",
    permUrl,
    async (req: Request, res: Response) => {
      const session = getSession(req, activeSessions);
      if (!session?.userId) {
        return res.status(401).json({ error: "Innlogging kreves" });
      }
      const batchId = req.params.id;
      const itemId = req.params.itemId;
      try {
        const own = await pool.query<{ created_by: string }>(
          `SELECT b.created_by::text
             FROM leadgrid_url_research_items i
             JOIN leadgrid_url_research_batches b ON b.id = i.batch_id
            WHERE i.id = $1::uuid AND i.batch_id = $2::uuid`,
          [itemId, batchId],
        );
        if (!own.rows[0]) {
          return res.status(404).json({ error: "item_not_found" });
        }
        if (own.rows[0].created_by !== session.userId) {
          return res.status(403).json({ error: "forbidden" });
        }
        // Hent item — tolerér at retry_count/quality_score-kolonner
        // mangler i pre-mig-0353 miljø.
        const itemRes = await pool
          .query<{
            id: string;
            url: string;
            order_index: number;
            status: string;
            draft_lead_id: string | null;
            has_pin: boolean;
            location_confidence: string | null;
            error_message: string | null;
            research_result: Record<string, unknown> | null;
            retry_count: number | null;
            last_attempted_at: Date | null;
            quality_score: number | null;
            started_at: Date | null;
            finished_at: Date | null;
          }>(
            `SELECT id::text, url, order_index, status, draft_lead_id::text,
                    has_pin, location_confidence, error_message, research_result,
                    retry_count, last_attempted_at, quality_score,
                    started_at, finished_at
               FROM leadgrid_url_research_items
              WHERE id = $1::uuid`,
            [itemId],
          )
          .catch(async () => {
            // Fallback uten retry_count/quality_score
            return await pool.query<{
              id: string;
              url: string;
              order_index: number;
              status: string;
              draft_lead_id: string | null;
              has_pin: boolean;
              location_confidence: string | null;
              error_message: string | null;
              research_result: Record<string, unknown> | null;
              retry_count: number | null;
              last_attempted_at: Date | null;
              quality_score: number | null;
              started_at: Date | null;
              finished_at: Date | null;
            }>(
              `SELECT id::text, url, order_index, status, draft_lead_id::text,
                      has_pin, location_confidence, error_message, research_result,
                      NULL::integer AS retry_count,
                      NULL::timestamptz AS last_attempted_at,
                      NULL::integer AS quality_score,
                      started_at, finished_at
                 FROM leadgrid_url_research_items
                WHERE id = $1::uuid`,
              [itemId],
            );
          });
        const item = itemRes.rows[0];
        if (!item) {
          return res.status(404).json({ error: "item_not_found" });
        }
        return res.json({
          id: item.id,
          url: item.url,
          order_index: item.order_index,
          status: item.status,
          draft_lead_id: item.draft_lead_id,
          has_pin: item.has_pin,
          location_confidence: item.location_confidence,
          error_message: item.error_message,
          research_result: item.research_result,
          retry_count: item.retry_count ?? 0,
          last_attempted_at: item.last_attempted_at?.toISOString() ?? null,
          quality_score: item.quality_score,
          started_at: item.started_at?.toISOString() ?? null,
          finished_at: item.finished_at?.toISOString() ?? null,
        });
      } catch (err) {
        return res.status(500).json({
          error: "fetch_item_failed",
          detail: (err as Error).message,
        });
      }
    },
  );
}

// =====================================================================
// Re-exports for unit-tests
// =====================================================================

export const __test = {
  resolveLocation,
  deriveCompanyProfile,
  lookupCityCentroid,
};
