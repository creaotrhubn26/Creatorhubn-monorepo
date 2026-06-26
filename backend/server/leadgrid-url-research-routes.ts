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
import { runOrchestratedBootstrap } from "./role-room-agent-bootstrap-orchestrator.js";
import {
  fetchGooglePlacesBusinessSignals,
  type RoleRoomAgentBrregCompany,
  type RoleRoomAgentBusinessSignals,
  type RoleRoomAgentProducerBootstrapInput,
  type RoleRoomAgentWebsiteInsights,
} from "./role-room-agent.js";

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

  const companyProfile = deriveCompanyProfile(
    orch.synthesis as Record<string, unknown> | null,
    businessSignals,
    orch.brregCompany,
    opts.websiteUrl,
  );

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

  return {
    companyProfile,
    location,
    bootstrapPayload: {
      synthesis: orch.synthesis,
      brregCompany: orch.brregCompany,
      websiteInsights: orch.websiteInsights,
      businessSignals,
      toolCallsLog: orch.toolCallsLog,
      resolvedLocation: location,
    },
  };
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
}

// =====================================================================
// Re-exports for unit-tests
// =====================================================================

export const __test = {
  resolveLocation,
  deriveCompanyProfile,
  lookupCityCentroid,
};
