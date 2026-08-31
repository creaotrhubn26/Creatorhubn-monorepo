import type { Pool } from "pg";

import type { LeadgridAccessibleProject } from "./leadgrid-project-access.js";

const GOOGLE_PLACES_TEXT_SEARCH_URL =
  "https://places.googleapis.com/v1/places:searchText";
const GOOGLE_PLACES_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.primaryType",
  "places.primaryTypeDisplayName",
  "places.businessStatus",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.googleMapsUri",
  "places.attributions",
].join(",");

export type DiscoveryPlaceMatchQuality = "strong" | "possible" | "weak";

export interface DiscoveryPlaceAttributionDto {
  provider: string;
  provider_uri: string | null;
}

export interface DiscoveryPlaceMatchDto {
  place_id: string;
  display_name: string;
  formatted_address: string | null;
  latitude: number | null;
  longitude: number | null;
  primary_type: string | null;
  primary_type_label: string | null;
  business_status:
    | "OPERATIONAL"
    | "CLOSED_TEMPORARILY"
    | "CLOSED_PERMANENTLY"
    | "FUTURE_OPENING"
    | "BUSINESS_STATUS_UNSPECIFIED"
    | null;
  website_uri: string | null;
  national_phone_number: string | null;
  international_phone_number: string | null;
  google_maps_uri: string | null;
  attributions: DiscoveryPlaceAttributionDto[];
  match_quality: DiscoveryPlaceMatchQuality;
  match_reasons: string[];
}

export interface DiscoveryPlaceDetailsDto {
  candidate_id: string;
  mode: "transient_details_only";
  fetched_at: string;
  provider: {
    id: "google_places";
    name: "Google Maps";
    policy_uri: string;
  };
  notice: string;
  ranking_notice: string;
  matches: DiscoveryPlaceMatchDto[];
}

export class DiscoveryPlacesDetailsError extends Error {
  constructor(
    readonly code:
      | "places_not_configured"
      | "places_details_disabled"
      | "candidate_not_found"
      | "places_timeout"
      | "places_rate_limited"
      | "places_unavailable"
      | "places_invalid_response",
    readonly status: number,
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "DiscoveryPlacesDetailsError";
  }
}

interface CandidateIdentityRow {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  profile_id: string | null;
  source_config: unknown;
}

interface GoogleLocalizedText {
  text?: unknown;
}

interface GoogleAttribution {
  provider?: unknown;
  providerUri?: unknown;
}

interface GooglePlace {
  id?: unknown;
  displayName?: GoogleLocalizedText;
  formattedAddress?: unknown;
  location?: { latitude?: unknown; longitude?: unknown };
  primaryType?: unknown;
  primaryTypeDisplayName?: GoogleLocalizedText;
  businessStatus?: unknown;
  websiteUri?: unknown;
  nationalPhoneNumber?: unknown;
  internationalPhoneNumber?: unknown;
  googleMapsUri?: unknown;
  attributions?: GoogleAttribution[];
}

interface GooglePlacesPayload {
  places?: GooglePlace[];
}

export interface DiscoveryPlacesDetailsDependencies {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

function text(value: unknown, maximum = 500): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maximum) : null;
}

function finiteNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function safeUrl(value: unknown, httpsOnly = false): string | null {
  const candidate = text(value, 2_000);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    if (url.username || url.password) return null;
    if (
      httpsOnly
        ? url.protocol !== "https:"
        : !["http:", "https:"].includes(url.protocol)
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function normalized(value: string | null): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9æøå]+/g, " ")
    .trim();
}

const COMPANY_SUFFIXES = new Set([
  "as",
  "asa",
  "ba",
  "enk",
  "nuf",
  "sa",
  "ans",
  "da",
  "stiftelse",
]);

function nameTokens(value: string | null): Set<string> {
  return new Set(
    normalized(value)
      .split(" ")
      .filter((token) => token.length > 1 && !COMPANY_SUFFIXES.has(token)),
  );
}

function tokenCoverage(expected: Set<string>, actual: Set<string>): number {
  if (expected.size === 0 || actual.size === 0) return 0;
  let matches = 0;
  for (const token of expected) if (actual.has(token)) matches += 1;
  return matches / expected.size;
}

function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const radians = Math.PI / 180;
  const deltaLat = (b.latitude - a.latitude) * radians;
  const deltaLon = (b.longitude - a.longitude) * radians;
  const lat1 = a.latitude * radians;
  const lat2 = b.latitude * radians;
  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function classifyDiscoveryPlaceMatch(
  candidate: Pick<
    CandidateIdentityRow,
    "name" | "address" | "city" | "postal_code" | "latitude" | "longitude"
  >,
  place: GooglePlace,
): { quality: DiscoveryPlaceMatchQuality; reasons: string[] } {
  const expectedName = normalized(candidate.name);
  const actualName = normalized(text(place.displayName?.text, 300));
  const coverage = tokenCoverage(
    nameTokens(candidate.name),
    nameTokens(actualName),
  );
  const formattedAddress = normalized(text(place.formattedAddress, 500));
  const postalMatches = Boolean(
    candidate.postal_code &&
    formattedAddress.includes(normalized(candidate.postal_code)),
  );
  const cityMatches = Boolean(
    candidate.city && formattedAddress.includes(normalized(candidate.city)),
  );
  const street = normalized(candidate.address)
    .split(" ")
    .filter((part) => part.length > 1)
    .slice(0, 2)
    .join(" ");
  const streetMatches = Boolean(street && formattedAddress.includes(street));

  const candidateLatitude = finiteNumber(candidate.latitude);
  const candidateLongitude = finiteNumber(candidate.longitude);
  const placeLatitude = finiteNumber(place.location?.latitude);
  const placeLongitude = finiteNumber(place.location?.longitude);
  const distance =
    candidateLatitude !== null &&
    candidateLongitude !== null &&
    placeLatitude !== null &&
    placeLongitude !== null
      ? distanceMeters(
          { latitude: candidateLatitude, longitude: candidateLongitude },
          { latitude: placeLatitude, longitude: placeLongitude },
        )
      : null;

  const exactName = Boolean(
    expectedName && actualName && expectedName === actualName,
  );
  const reasons: string[] = [];
  if (exactName) reasons.push("Navnet samsvarer nøyaktig");
  else if (coverage >= 0.8) reasons.push("Navnet samsvarer godt");
  else if (coverage >= 0.5) reasons.push("Navnet samsvarer delvis");
  if (streetMatches) reasons.push("Gateadressen samsvarer");
  if (postalMatches) reasons.push("Postnummeret samsvarer");
  if (cityMatches) reasons.push("Byen samsvarer");
  if (distance !== null && distance <= 250)
    reasons.push("Kartpunktene er svært nær hverandre");
  else if (distance !== null && distance <= 2_000)
    reasons.push("Kartpunktene er i samme nærområde");

  const identityConfirmed = exactName || coverage >= 0.8;
  const locationConfirmed =
    streetMatches || postalMatches || (distance !== null && distance <= 2_000);
  if (identityConfirmed && locationConfirmed)
    return { quality: "strong", reasons };
  if (
    identityConfirmed ||
    coverage >= 0.5 ||
    locationConfirmed ||
    cityMatches
  ) {
    return { quality: "possible", reasons };
  }
  return {
    quality: "weak",
    reasons: reasons.length > 0 ? reasons : ["Treffet må kontrolleres manuelt"],
  };
}

function placesEnabled(row: CandidateIdentityRow): boolean {
  if (!row.profile_id) return false;
  const config = objectValue(row.source_config);
  const places = objectValue(config.google_places);
  return places.enabled === true && places.mode === "transient_details_only";
}

function businessStatus(
  value: unknown,
): DiscoveryPlaceMatchDto["business_status"] {
  return [
    "OPERATIONAL",
    "CLOSED_TEMPORARILY",
    "CLOSED_PERMANENTLY",
    "FUTURE_OPENING",
    "BUSINESS_STATUS_UNSPECIFIED",
  ].includes(typeof value === "string" ? value : "")
    ? (value as DiscoveryPlaceMatchDto["business_status"])
    : null;
}

function normalizePlace(
  candidate: CandidateIdentityRow,
  place: GooglePlace,
): DiscoveryPlaceMatchDto | null {
  const placeId = text(place.id, 300);
  const displayName = text(place.displayName?.text, 300);
  if (!placeId || !displayName) return null;
  const match = classifyDiscoveryPlaceMatch(candidate, place);
  return {
    place_id: placeId,
    display_name: displayName,
    formatted_address: text(place.formattedAddress, 500),
    latitude: finiteNumber(place.location?.latitude),
    longitude: finiteNumber(place.location?.longitude),
    primary_type: text(place.primaryType, 120),
    primary_type_label: text(place.primaryTypeDisplayName?.text, 160),
    business_status: businessStatus(place.businessStatus),
    website_uri: safeUrl(place.websiteUri),
    national_phone_number: text(place.nationalPhoneNumber, 80),
    international_phone_number: text(place.internationalPhoneNumber, 80),
    google_maps_uri: safeUrl(place.googleMapsUri, true),
    attributions: Array.isArray(place.attributions)
      ? place.attributions
          .map((attribution) => ({
            provider: text(attribution.provider, 160),
            provider_uri: safeUrl(attribution.providerUri, true),
          }))
          .filter(
            (attribution): attribution is DiscoveryPlaceAttributionDto =>
              attribution.provider !== null,
          )
      : [],
    match_quality: match.quality,
    match_reasons: match.reasons,
  };
}

function queryFor(candidate: CandidateIdentityRow): string {
  return [
    candidate.name,
    candidate.address,
    candidate.postal_code,
    candidate.city,
    "Norge",
  ]
    .map((value) => text(value, 300))
    .filter((value): value is string => value !== null)
    .join(", ")
    .slice(0, 1_000);
}

function locationBias(
  candidate: CandidateIdentityRow,
): Record<string, unknown> | null {
  const latitude = finiteNumber(candidate.latitude);
  const longitude = finiteNumber(candidate.longitude);
  if (latitude === null || longitude === null) return null;
  return {
    circle: {
      center: { latitude, longitude },
      radius: 5_000,
    },
  };
}

export async function fetchTransientDiscoveryPlaceDetails(
  pool: Pool,
  input: {
    project: LeadgridAccessibleProject;
    runId: string;
    candidateId: string;
  },
  dependencies: DiscoveryPlacesDetailsDependencies = {},
): Promise<DiscoveryPlaceDetailsDto> {
  const candidateResult = await pool.query<CandidateIdentityRow>(
    `SELECT c.id::text,
            c.name,
            c.address,
            c.city,
            c.postal_code,
            c.latitude,
            c.longitude,
            r.profile_id::text,
            p.source_config
       FROM leadgrid_discovery_runs r
       JOIN leadgrid_discovery_run_candidates rc
         ON rc.run_id = r.id
        AND rc.organization_id = r.organization_id
        AND rc.project_id = r.project_id
       JOIN leadgrid_discovery_candidates c
         ON c.id = rc.candidate_id
        AND c.organization_id = rc.organization_id
        AND c.project_id = rc.project_id
       LEFT JOIN leadgrid_discovery_profiles p
         ON p.id = r.profile_id
        AND p.organization_id = r.organization_id
        AND p.project_id = r.project_id
      WHERE r.organization_id = $1::uuid
        AND r.project_id = $2
        AND r.id = $3::uuid
        AND c.id = $4::uuid
      LIMIT 1`,
    [
      input.project.organizationId,
      input.project.id,
      input.runId,
      input.candidateId,
    ],
  );
  const candidate = candidateResult.rows[0];
  if (!candidate) {
    throw new DiscoveryPlacesDetailsError(
      "candidate_not_found",
      404,
      "Discovery-kandidaten finnes ikke.",
    );
  }
  if (!placesEnabled(candidate)) {
    throw new DiscoveryPlacesDetailsError(
      "places_details_disabled",
      409,
      "Google Maps-detaljer er ikke aktivert for denne Discovery-profilen.",
    );
  }
  if (process.env.LEADGRID_DISCOVERY_PLACES_DETAILS_ENABLED === "false") {
    throw new DiscoveryPlacesDetailsError(
      "places_details_disabled",
      503,
      "Google Maps-detaljer er midlertidig deaktivert.",
      true,
    );
  }

  const apiKey = dependencies.apiKey ?? process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey?.trim()) {
    throw new DiscoveryPlacesDetailsError(
      "places_not_configured",
      503,
      "Google Maps-detaljer er ikke konfigurert.",
    );
  }
  const requestBody: Record<string, unknown> = {
    textQuery: queryFor(candidate),
    languageCode: "no",
    regionCode: "NO",
    pageSize: 3,
    includePureServiceAreaBusinesses: true,
  };
  const bias = locationBias(candidate);
  if (bias) requestBody.locationBias = bias;

  const fetchImpl = dependencies.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(GOOGLE_PLACES_TEXT_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey.trim(),
        "X-Goog-FieldMask": GOOGLE_PLACES_FIELD_MASK,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(8_000),
    });
  } catch (error) {
    if (
      error instanceof DOMException &&
      ["AbortError", "TimeoutError"].includes(error.name)
    ) {
      throw new DiscoveryPlacesDetailsError(
        "places_timeout",
        504,
        "Google Maps brukte for lang tid. Prøv igjen.",
        true,
      );
    }
    throw new DiscoveryPlacesDetailsError(
      "places_unavailable",
      502,
      "Google Maps-detaljer er ikke tilgjengelige akkurat nå.",
      true,
    );
  }

  if (response.status === 429) {
    throw new DiscoveryPlacesDetailsError(
      "places_rate_limited",
      503,
      "Google Maps har midlertidig begrenset detaljoppslag. Prøv igjen senere.",
      true,
    );
  }
  if (!response.ok) {
    throw new DiscoveryPlacesDetailsError(
      "places_unavailable",
      502,
      "Google Maps-detaljer er ikke tilgjengelige akkurat nå.",
      response.status >= 500,
    );
  }

  let payload: GooglePlacesPayload;
  try {
    payload = (await response.json()) as GooglePlacesPayload;
  } catch {
    throw new DiscoveryPlacesDetailsError(
      "places_invalid_response",
      502,
      "Google Maps returnerte et ugyldig svar.",
      true,
    );
  }
  if (payload.places !== undefined && !Array.isArray(payload.places)) {
    throw new DiscoveryPlacesDetailsError(
      "places_invalid_response",
      502,
      "Google Maps returnerte et ugyldig svar.",
      true,
    );
  }

  return {
    candidate_id: candidate.id,
    mode: "transient_details_only",
    fetched_at: (dependencies.now ?? (() => new Date()))().toISOString(),
    provider: {
      id: "google_places",
      name: "Google Maps",
      policy_uri:
        "https://developers.google.com/maps/documentation/places/web-service/policies",
    },
    notice:
      "Opplysningene er hentet på forespørsel og lagres ikke i kandidaten eller CRM.",
    ranking_notice:
      "Treffene følger Google Maps sin relevansrekkefølge. Leadgrids matchkontroll påvirker ikke Discovery-score.",
    matches: (payload.places ?? [])
      .slice(0, 3)
      .map((place) => normalizePlace(candidate, place))
      .filter((place): place is DiscoveryPlaceMatchDto => place !== null),
  };
}

export const __test = {
  GOOGLE_PLACES_FIELD_MASK,
  GOOGLE_PLACES_TEXT_SEARCH_URL,
  queryFor,
};
