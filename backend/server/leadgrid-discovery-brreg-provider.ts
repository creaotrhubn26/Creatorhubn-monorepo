import { XMLParser } from "fast-xml-parser";

import {
  ssrfSafeFetchWithMetadata,
  type SsrfSafeFetchMetadata,
} from "./ssrf-guard.js";

/**
 * Discovery source backed by Brønnøysundregistrene Open Data (NLOD).
 *
 * The adapter deliberately returns official registry fields only. Geographic
 * coordinates are derived from the registry's business address through
 * Kartverket/Geonorge and are never derived from Google Maps content.
 */

const BRREG_UNITS_ENDPOINT =
  "https://data.brreg.no/enhetsregisteret/api/enheter";
const BRREG_MUNICIPALITIES_ENDPOINT =
  "https://data.brreg.no/enhetsregisteret/api/kommuner";
const BRREG_GROUP_STRUCTURE_ENDPOINT =
  "https://data.brreg.no/enhetsregisteret/api/konsernstruktur";
const SSB_NACE_ENDPOINT =
  "https://data.ssb.no/api/klass/v1/classifications/6/codesAt";
const GEONORGE_ADDRESS_ENDPOINT = "https://ws.geonorge.no/adresser/v1";
const GEONORGE_MUNICIPALITY_WFS_ENDPOINT =
  "https://wfs.geonorge.no/skwms1/wfs.administrative_enheter";

const MAX_RESULTS = 60;
const MAX_BRREG_PAGES = 3;
/**
 * Cursor offsets are only stable when BRREG is queried with one fixed page
 * size. Changing this value requires a cursor-version migration.
 */
export const DISCOVERY_BRREG_PAGE_SIZE = 100;
const MAX_SOURCE_OFFSET = 2_147_483_647;
const EARTH_RADIUS_METERS = 6_371_008.8;
export const DISCOVERY_MAX_EXTERNAL_REQUESTS = 200;
export const DISCOVERY_MAX_GEOCODES = 120;
const GEOCODE_CACHE_TTL_MS = 24 * 60 * 60 * 1_000;
const GEOCODE_CACHE_MAX_ENTRIES = 5_000;
const GEOCODE_CACHE_VERSION = "geonorge-address-v1";
const STRUCTURE_CACHE_TTL_MS = 24 * 60 * 60 * 1_000;
const STRUCTURE_CACHE_MAX_ENTRIES = 5_000;
const WEBSITE_CACHE_TTL_MS = 6 * 60 * 60 * 1_000;
const WEBSITE_CACHE_MAX_ENTRIES = 2_000;
const WEBSITE_MAX_REDIRECTS = 3;
const WEBSITE_MAX_RESPONSE_BYTES = 512 * 1_024;
const WEBSITE_ASSESSMENT_CONCURRENCY = 4;

export const BRREG_NLOD_ATTRIBUTION = {
  id: "brreg",
  provider: "Brønnøysundregistrene",
  providerUri:
    "https://data.brreg.no/enhetsregisteret/api/dokumentasjon/no/index.html",
  license: "NLOD 2.0",
  licenseUri: "https://data.norge.no/nlod/no/2.0/",
  notice:
    "Inneholder data under NLOD tilgjengeliggjort av Brønnøysundregistrene.",
} as const;

export const DISCOVERY_PUBLIC_DATA_SOURCES = [
  BRREG_NLOD_ATTRIBUTION,
  {
    id: "ssb_klass",
    provider: "Statistisk sentralbyrå – Klass",
    providerUri: "https://data.ssb.no/api/klass/v1/api-guide.html",
    license: "CC BY 4.0",
    licenseUri: "https://creativecommons.org/licenses/by/4.0/",
    notice:
      "Næringskoder og kodebeskrivelser er tilgjengeliggjort av Statistisk sentralbyrå.",
  },
  {
    id: "kartverket_geonorge",
    provider: "Kartverket / Geonorge",
    providerUri: "https://www.kartverket.no/api-og-data",
    license: "CC BY 4.0",
    licenseUri: "https://creativecommons.org/licenses/by/4.0/",
    notice:
      "Kommuner og koordinater er avledet fra åpne data tilgjengeliggjort av Kartverket.",
  },
] as const;

export interface DiscoveryRegistryGeoPoint {
  latitude: number;
  longitude: number;
}

export interface DiscoveryRegistryGeoArea {
  center: DiscoveryRegistryGeoPoint;
  radiusMeters: number;
}

export interface DiscoveryRegistrySearchInput {
  query: string;
  queryMode?: "industry" | "organization_name";
  countryCode?: "NO" | null;
  maxResults?: number;
  /**
   * Compatibility input for callers that still address a whole BRREG page.
   * New durable callers must use sourceOffset so a run can resume mid-page.
   */
  startPage?: number;
  /** Durable zero-based offset in BRREG fixed, sorted result universe. */
  sourceOffset?: number;
  city?: string | null;
  geo?: DiscoveryRegistryGeoArea | null;
  municipalityNumbers?: string[];
  municipalityNames?: string[];
  organizationForms?: string[];
  minimumEmployees?: number | null;
  maximumEmployees?: number | null;
  organizationStructure?: "any" | "independent" | "chain";
  websiteRequirement?: "any" | "present" | "missing";
  minimumWebsiteQualityScore?: number | null;
  websiteAssessmentLimit?: number;
  qualificationTerms?: string[];
  registeredInVatRegister?: boolean | null;
  registeredInBusinessRegister?: boolean | null;
  signal?: AbortSignal;
}

export type DiscoveryOrganizationStructure =
  "independent" | "chain" | "unknown";

export interface DiscoveryOrganizationStructureEvidence {
  source: "brreg_group_structure";
  sourceUri: string;
  basis:
    | "multiple_registered_entities"
    | "single_registered_entity"
    | "not_found"
    | "unavailable";
  relatedOrganizationCount: number | null;
}

export interface DiscoveryWebsiteQualityAssessment {
  status: "assessed" | "unknown";
  score: number | null;
  fetchedAt: string;
  sourceUri: string;
  finalUrl: string | null;
  httpStatus: number | null;
  redirectCount: number;
  reason:
    | "assessed"
    | "no_registered_url"
    | "invalid_url"
    | "unsafe_host"
    | "request_failed"
    | "response_too_large"
    | "unsupported_content_type"
    | "external_request_limit"
    | "not_selected_for_assessment";
  signals: {
    https: boolean | null;
    reachable: boolean | null;
    title: boolean | null;
    meta_description: boolean | null;
    viewport: boolean | null;
    contact_path: boolean | null;
    call_to_action: boolean | null;
  };
  qualification?: {
    requestedTerms: string[];
    matchedTerms: string[];
  };
}

export interface DiscoveryRegistryCandidate {
  source?: "brreg_open_data" | "nhn_flr_public";
  sourceLicense?: string;
  phone?: string | null;
  providerContacts?: Array<{
    name: string;
    role: "Fastlege";
    sourceReference: string;
  }>;
  entityClassification?: {
    kind: "clinic" | "practitioner" | "unknown";
    confidence: "high" | "medium" | "low";
    evidence: string[];
    normalizedLocationKey: string | null;
  };
  organizationNumber: string;
  name: string;
  organizationForm: string | null;
  organizationFormCode?: string | null;
  organizationFormDescription?: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  municipality: string | null;
  municipalityNumber: string | null;
  location: DiscoveryRegistryGeoPoint | null;
  distanceFromSearchCenterMeters: number | null;
  website: string | null;
  employeeCount: number | null;
  hasRegisteredEmployeeCount?: boolean | null;
  naceCode: string | null;
  naceDescription: string | null;
  registeredAt: string | null;
  registeredInVatRegister: boolean | null;
  registeredInBusinessRegister: boolean | null;
  registeredInVatRegisterKnown?: boolean;
  registeredInBusinessRegisterKnown?: boolean;
  organizationStructure?: DiscoveryOrganizationStructure;
  organizationStructureEvidence?: DiscoveryOrganizationStructureEvidence | null;
  websiteQuality?: DiscoveryWebsiteQualityAssessment;
  status: "active" | "in_liquidation" | "bankrupt";
  sourceUri: string;
}

export interface DiscoveryResolvedMunicipality {
  number: string;
  name: string | null;
  sourceUri: string;
}

export interface DiscoveryRegistrySearchResult {
  candidates: DiscoveryRegistryCandidate[];
  sourceOffsetStart: number;
  sourceOffsetNext: number;
  /** Compatibility diagnostics derived from fixed-size source offsets. */
  sourcePageStart: number;
  sourcePageNext: number;
  sourcePageCount: number;
  pagesFetched: number;
  sourceResultsSeen: number;
  duplicateResultsSkipped: number;
  invalidResultsSkipped: number;
  geoFilteredResults: number;
  companyFilteredResults: number;
  websiteAssessmentCandidates: number;
  websiteAssessmentRequests: number;
  sourceLimitReached: boolean;
  hasMoreSourceResults: boolean;
  limitReason: "page_limit" | "external_request_limit" | "geocode_limit" | null;
  externalRequests: number;
  geocodeRequests: number;
  geocodeMisses: number;
  resolution: "nace" | "organization_name";
  resolvedNaceCodes: string[];
  resolvedMunicipalities: DiscoveryResolvedMunicipality[];
}

export type DiscoveryRegistryErrorCode =
  | "invalid_input"
  | "invalid_request"
  | "upstream_unavailable"
  | "timeout"
  | "network_error"
  | "invalid_response"
  | "area_resolution_failed"
  | "municipality_resolution_failed"
  | "classification_resolution_failed"
  | "external_request_limit"
  | "geocode_limit"
  | "cancelled";

const SAFE_ERROR_MESSAGES: Record<DiscoveryRegistryErrorCode, string> = {
  invalid_input: "Søkegrunnlaget for Discovery er ugyldig.",
  invalid_request: "Datakilden avviste Discovery-søket.",
  upstream_unavailable:
    "Offentlige registerdata er midlertidig utilgjengelige.",
  timeout: "Oppslaget mot offentlige registerdata tok for lang tid.",
  network_error: "Offentlige registerdata kunne ikke nås.",
  invalid_response: "Datakilden returnerte et ugyldig svar.",
  area_resolution_failed: "Kartområdet kunne ikke kobles til norske kommuner.",
  municipality_resolution_failed:
    "Ett eller flere kommunenavn kunne ikke kobles sikkert til et kommunenummer.",
  classification_resolution_failed:
    "Kundesegmentet kunne ikke kobles sikkert til offisielle næringskoder.",
  external_request_limit:
    "Discovery nådde den sikre grensen for eksterne oppslag.",
  geocode_limit: "Discovery nådde den sikre grensen for adresseoppslag.",
  cancelled: "Discovery-søket ble avbrutt.",
};

export class DiscoveryRegistryError extends Error {
  readonly code: DiscoveryRegistryErrorCode;
  readonly retryable: boolean;
  readonly httpStatus: number | null;

  constructor(
    code: DiscoveryRegistryErrorCode,
    options: { retryable?: boolean; httpStatus?: number | null } = {},
  ) {
    super(SAFE_ERROR_MESSAGES[code]);
    this.name = "DiscoveryRegistryError";
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.httpStatus = options.httpStatus ?? null;
  }
}

type DiscoveryWebsiteFetch = (
  rawUrl: string,
  init?: RequestInit,
  maxRedirects?: number,
  beforeRequest?: (url: string, hop: number) => void | Promise<void>,
) => Promise<SsrfSafeFetchMetadata>;

export interface DiscoveryRegistryProviderDependencies {
  fetchImpl?: typeof fetch;
  websiteFetch?: DiscoveryWebsiteFetch;
  requestTimeoutMs?: number;
  maxAttempts?: number;
  now?: () => Date;
  maxExternalRequests?: number;
  maxGeocodes?: number;
}

export interface DiscoveryRegistryProvider {
  search(
    input: DiscoveryRegistrySearchInput,
  ): Promise<DiscoveryRegistrySearchResult>;
}

type JsonRecord = Record<string, unknown>;

interface NormalizedInput {
  query: string;
  queryMode: "industry" | "organization_name";
  countryCode: "NO" | null;
  maxResults: number;
  sourceOffset: number;
  city: string | null;
  geo: DiscoveryRegistryGeoArea | null;
  municipalityNumbers: string[];
  municipalityNames: string[];
  organizationForms: string[];
  minimumEmployees: number | null;
  maximumEmployees: number | null;
  organizationStructure: "any" | "independent" | "chain";
  websiteRequirement: "any" | "present" | "missing";
  minimumWebsiteQualityScore: number | null;
  websiteAssessmentLimit: number;
  qualificationTerms: string[];
  registeredInVatRegister: boolean | null;
  registeredInBusinessRegister: boolean | null;
  signal?: AbortSignal;
}

interface NaceCode {
  code: string;
  name: string;
  level: number | null;
}

interface BrregMunicipality {
  number: string;
  name: string;
}

interface GeocodeCacheEntry {
  expiresAt: number;
  location: DiscoveryRegistryGeoPoint | null;
}

interface StructureCacheEntry {
  expiresAt: number;
  classification: DiscoveryOrganizationStructure;
  evidence: DiscoveryOrganizationStructureEvidence;
}

interface WebsiteCacheEntry {
  expiresAt: number;
  assessment: DiscoveryWebsiteQualityAssessment;
}

const geocodeCache = new Map<string, GeocodeCacheEntry>();
const structureCache = new Map<string, StructureCacheEntry>();
const websiteCache = new Map<string, WebsiteCacheEntry>();

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeMunicipalityNumbers(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 30) {
    throw new DiscoveryRegistryError("invalid_input");
  }
  const normalized = value.map((entry) => text(entry));
  if (normalized.some((entry) => !entry || !/^\d{4}$/.test(entry))) {
    throw new DiscoveryRegistryError("invalid_input");
  }
  return [...new Set(normalized as string[])].sort();
}

function normalizeMunicipalityNames(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 30) {
    throw new DiscoveryRegistryError("invalid_input");
  }
  const unique = new Map<string, string>();
  for (const entry of value) {
    const normalized = text(entry);
    if (!normalized || normalized.length > 120) {
      throw new DiscoveryRegistryError("invalid_input");
    }
    unique.set(normalizeForSearch(normalized), normalized);
  }
  return [...unique.values()].sort((a, b) => a.localeCompare(b, "nb-NO"));
}

function normalizeOrganizationForms(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 20) {
    throw new DiscoveryRegistryError("invalid_input");
  }
  const normalized = value.map((entry) => text(entry)?.toUpperCase() ?? null);
  if (normalized.some((entry) => !entry || !/^[A-Z0-9]{2,8}$/.test(entry))) {
    throw new DiscoveryRegistryError("invalid_input");
  }
  return [...new Set(normalized as string[])].sort();
}

function normalizedEmployeeBoundary(
  value: unknown,
  kind: "minimum" | "maximum",
): number | null {
  if (value === undefined || value === null) return null;
  if (
    !Number.isInteger(value) ||
    (value as number) < 0 ||
    (value as number) > 1_000_000
  ) {
    throw new DiscoveryRegistryError("invalid_input");
  }
  const supported =
    kind === "minimum"
      ? value === 0 || value === 1 || (value as number) >= 5
      : value === 0 || value === 4 || (value as number) >= 5;
  if (!supported) throw new DiscoveryRegistryError("invalid_input");
  return value as number;
}

function validatePoint(
  point: DiscoveryRegistryGeoPoint,
): DiscoveryRegistryGeoPoint {
  const latitude = number(point?.latitude);
  const longitude = number(point?.longitude);
  if (
    latitude === null ||
    longitude === null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new DiscoveryRegistryError("invalid_input");
  }
  return { latitude, longitude };
}

function normalizeInput(input: DiscoveryRegistrySearchInput): NormalizedInput {
  const query = text(input.query);
  if (!query) throw new DiscoveryRegistryError("invalid_input");
  if (
    input.queryMode !== undefined &&
    input.queryMode !== "industry" &&
    input.queryMode !== "organization_name"
  ) {
    throw new DiscoveryRegistryError("invalid_input");
  }
  const municipalityNumbers = normalizeMunicipalityNumbers(
    input.municipalityNumbers,
  );
  const municipalityNames = normalizeMunicipalityNames(input.municipalityNames);
  if (municipalityNumbers.length + municipalityNames.length > 30) {
    throw new DiscoveryRegistryError("invalid_input");
  }
  const organizationForms = normalizeOrganizationForms(input.organizationForms);
  const minimumEmployees = normalizedEmployeeBoundary(
    input.minimumEmployees,
    "minimum",
  );
  const maximumEmployees = normalizedEmployeeBoundary(
    input.maximumEmployees,
    "maximum",
  );
  if (
    minimumEmployees !== null &&
    maximumEmployees !== null &&
    minimumEmployees > maximumEmployees
  ) {
    throw new DiscoveryRegistryError("invalid_input");
  }
  const requestedMax = input.maxResults ?? 20;
  if (!Number.isInteger(requestedMax) || requestedMax < 1) {
    throw new DiscoveryRegistryError("invalid_input");
  }
  if (input.sourceOffset !== undefined && input.startPage !== undefined) {
    throw new DiscoveryRegistryError("invalid_input");
  }
  const legacyStartPage = input.startPage ?? 0;
  if (
    !Number.isSafeInteger(legacyStartPage) ||
    legacyStartPage < 0 ||
    legacyStartPage > Math.floor(MAX_SOURCE_OFFSET / DISCOVERY_BRREG_PAGE_SIZE)
  ) {
    throw new DiscoveryRegistryError("invalid_input");
  }
  const sourceOffset =
    input.sourceOffset ?? legacyStartPage * DISCOVERY_BRREG_PAGE_SIZE;
  if (
    !Number.isSafeInteger(sourceOffset) ||
    sourceOffset < 0 ||
    sourceOffset > MAX_SOURCE_OFFSET
  ) {
    throw new DiscoveryRegistryError("invalid_input");
  }
  const requestedWebsiteAssessmentLimit =
    input.websiteAssessmentLimit ?? requestedMax;
  if (
    !Number.isInteger(requestedWebsiteAssessmentLimit) ||
    requestedWebsiteAssessmentLimit < 0 ||
    requestedWebsiteAssessmentLimit > MAX_RESULTS
  ) {
    throw new DiscoveryRegistryError("invalid_input");
  }
  if (
    input.qualificationTerms !== undefined &&
    (!Array.isArray(input.qualificationTerms) ||
      input.qualificationTerms.length > 30)
  ) {
    throw new DiscoveryRegistryError("invalid_input");
  }
  const qualificationTerms = [
    ...new Map(
      (input.qualificationTerms ?? []).map((entry) => {
        const normalized = text(entry);
        if (!normalized || normalized.length > 80) {
          throw new DiscoveryRegistryError("invalid_input");
        }
        return [normalizeForSearch(normalized), normalized] as const;
      }),
    ).values(),
  ];
  const city = input.city == null ? null : text(input.city);
  if (input.city != null && !city) {
    throw new DiscoveryRegistryError("invalid_input");
  }
  let geo: DiscoveryRegistryGeoArea | null = null;
  if (input.geo) {
    const center = validatePoint(input.geo.center);
    const radiusMeters = number(input.geo.radiusMeters);
    if (
      radiusMeters === null ||
      radiusMeters < 1_000 ||
      radiusMeters > 50_000
    ) {
      throw new DiscoveryRegistryError("invalid_input");
    }
    geo = { center, radiusMeters };
  }
  const hasMunicipalities =
    municipalityNumbers.length > 0 || municipalityNames.length > 0;
  const countryCode = input.countryCode ?? null;
  if (countryCode !== null && countryCode !== "NO") {
    throw new DiscoveryRegistryError("invalid_input");
  }
  const areaSelectorCount = [
    Boolean(countryCode),
    Boolean(city),
    Boolean(geo),
    hasMunicipalities,
  ].filter(Boolean).length;
  if (areaSelectorCount !== 1) {
    throw new DiscoveryRegistryError("invalid_input");
  }
  const organizationStructure = input.organizationStructure ?? "any";
  if (
    !(["any", "independent", "chain"] as const).includes(organizationStructure)
  ) {
    throw new DiscoveryRegistryError("invalid_input");
  }
  const websiteRequirement = input.websiteRequirement ?? "any";
  if (!(["any", "present", "missing"] as const).includes(websiteRequirement)) {
    throw new DiscoveryRegistryError("invalid_input");
  }
  const minimumWebsiteQualityScore = input.minimumWebsiteQualityScore ?? null;
  if (
    minimumWebsiteQualityScore !== null &&
    (!Number.isInteger(minimumWebsiteQualityScore) ||
      minimumWebsiteQualityScore < 0 ||
      minimumWebsiteQualityScore > 100)
  ) {
    throw new DiscoveryRegistryError("invalid_input");
  }
  const registeredInVatRegister = input.registeredInVatRegister ?? null;
  const registeredInBusinessRegister =
    input.registeredInBusinessRegister ?? null;
  if (
    (registeredInVatRegister !== null &&
      typeof registeredInVatRegister !== "boolean") ||
    (registeredInBusinessRegister !== null &&
      typeof registeredInBusinessRegister !== "boolean")
  ) {
    throw new DiscoveryRegistryError("invalid_input");
  }
  return {
    query,
    queryMode: input.queryMode ?? "industry",
    countryCode,
    maxResults: Math.min(requestedMax, MAX_RESULTS),
    sourceOffset,
    city,
    geo,
    municipalityNumbers,
    municipalityNames,
    organizationForms,
    minimumEmployees,
    maximumEmployees,
    organizationStructure,
    websiteRequirement,
    minimumWebsiteQualityScore,
    websiteAssessmentLimit: Math.min(
      requestedWebsiteAssessmentLimit,
      Math.min(requestedMax, MAX_RESULTS),
    ),
    qualificationTerms,
    registeredInVatRegister,
    registeredInBusinessRegister,
    signal: input.signal,
  };
}

function abortError(): Error {
  const error = new Error("Aborted");
  error.name = "AbortError";
  return error;
}

function isAbort(error: unknown): boolean {
  return isRecord(error) && error.name === "AbortError";
}

function attemptSignal(signal: AbortSignal | undefined, timeoutMs: number) {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

function httpError(response: Response): DiscoveryRegistryError {
  if (response.status === 400) {
    return new DiscoveryRegistryError("invalid_request", {
      httpStatus: response.status,
    });
  }
  if (response.status === 408) {
    return new DiscoveryRegistryError("timeout", {
      retryable: true,
      httpStatus: response.status,
    });
  }
  return new DiscoveryRegistryError("upstream_unavailable", {
    retryable: response.status === 429 || response.status >= 500,
    httpStatus: response.status,
  });
}

async function delay(
  milliseconds: number,
  signal?: AbortSignal,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const timer = setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(abortError());
      },
      { once: true },
    );
  });
}

function normalizeForSearch(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("nb-NO")
    .replace(/[^a-z0-9æøå]+/g, " ")
    .trim();
}

function matchesOrganizationNameQuery(name: string, query: string): boolean {
  const nameTokens = normalizeForSearch(name).split(" ").filter(Boolean);
  const queryTokens = normalizeForSearch(query).split(" ").filter(Boolean);
  if (queryTokens.length === 0 || queryTokens.length > nameTokens.length) {
    return false;
  }
  return nameTokens.some((_, start) =>
    queryTokens.every((queryToken, offset) =>
      nameTokens[start + offset]?.startsWith(queryToken),
    ),
  );
}

const QUERY_SYNONYMS: Record<string, string[]> = {
  advokat: ["juridiske tjenester", "advokatvirksomhet"],
  bilverksted: ["reparasjon av motorvogner", "vedlikehold av motorvogner"],
  bygg: ["bygging", "oppføring", "entreprenør"],
  eiendomsmegler: ["eiendomsmegling"],
  fotograf: ["fotografvirksomhet"],
  frisør: ["frisering", "skjønnhetspleie"],
  hotell: ["drift av hoteller", "overnatting"],
  it: ["dataprogrammering", "it konsulent", "informasjonsteknologi"],
  klinikk: ["helsetjenester", "lege", "tannlege", "fysioterapi"],
  markedsføringsbyrå: ["reklamebyrå", "markedsføring"],
  regnskapsbyrå: ["regnskap", "bokføring", "revisjon"],
  renhold: ["rengjøring"],
  restaurant: ["restaurant", "servering", "kafe"],
  tannklinikk: ["tannlege", "tannlegetjenester"],
  tannlege: ["tannhelsetjenester"],
};

function queryPhrases(query: string): string[] {
  const normalized = normalizeForSearch(query);
  const compact = normalized.replace(/\s+/g, "");
  const matches = Object.entries(QUERY_SYNONYMS).flatMap(([key, values]) => {
    const normalizedKey = normalizeForSearch(key);
    const compactKey = normalizedKey.replace(/\s+/g, "");
    const wordMatch = normalized.split(" ").includes(normalizedKey);
    const compoundMatch =
      compactKey.length >= 4 && compact.includes(compactKey);
    return wordMatch || compoundMatch
      ? [{ compactKeyLength: compactKey.length, values }]
      : [];
  });
  const mostSpecificLength = Math.max(
    0,
    ...matches.map((match) => match.compactKeyLength),
  );
  const aliases = matches
    .filter((match) => match.compactKeyLength === mostSpecificLength)
    .flatMap((match) => match.values);
  return [normalized, ...aliases.map(normalizeForSearch)].filter(Boolean);
}

function parseNaceCodes(payload: unknown): NaceCode[] {
  const record = isRecord(payload) ? payload : {};
  const embedded = isRecord(record._embedded) ? record._embedded : {};
  const values = Array.isArray(payload)
    ? payload
    : Array.isArray(record.codes)
      ? record.codes
      : Array.isArray(embedded.codes)
        ? embedded.codes
        : [];
  return values.flatMap((value) => {
    if (!isRecord(value)) return [];
    const code = text(value.code);
    const name =
      text(value.name) ?? text(value.shortName) ?? text(value.presentationName);
    if (!code || !name) return [];
    const level = number(value.level);
    return [{ code, name, level }];
  });
}

function rankNaceCodes(codes: NaceCode[], query: string): string[] {
  const direct = query.trim().match(/^\d{2}(?:\.\d{1,3})?$/)?.[0];
  if (direct) return [direct];
  const phrases = queryPhrases(query);
  const queryTokens = new Set(phrases.flatMap((phrase) => phrase.split(" ")));
  return codes
    .map((entry) => {
      const normalizedName = normalizeForSearch(entry.name);
      const nameTokens = normalizedName.split(" ");
      const tokenMatches = nameTokens.filter((token) =>
        queryTokens.has(token),
      ).length;
      const phraseMatch = phrases.some(
        (phrase) =>
          phrase.length >= 4 &&
          (normalizedName.includes(phrase) || phrase.includes(normalizedName)),
      );
      const leafBonus = /^\d{2}\.\d{3}$/.test(entry.code) ? 3 : 0;
      return {
        code: entry.code,
        score: (phraseMatch ? 10 : 0) + tokenMatches * 2 + leafBonus,
        leaf: /^\d{2}\.\d{3}$/.test(entry.code),
      };
    })
    .filter((entry) => entry.leaf && entry.score >= 5)
    .sort((a, b) => b.score - a.score || a.code.localeCompare(b.code))
    .slice(0, 8)
    .map((entry) => entry.code);
}

function destinationPoint(
  center: DiscoveryRegistryGeoPoint,
  distanceMeters: number,
  bearingDegrees: number,
): DiscoveryRegistryGeoPoint {
  const angular = distanceMeters / EARTH_RADIUS_METERS;
  const bearing = (bearingDegrees * Math.PI) / 180;
  const latitude = (center.latitude * Math.PI) / 180;
  const longitude = (center.longitude * Math.PI) / 180;
  const destinationLatitude = Math.asin(
    Math.sin(latitude) * Math.cos(angular) +
      Math.cos(latitude) * Math.sin(angular) * Math.cos(bearing),
  );
  const destinationLongitude =
    longitude +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(latitude),
      Math.cos(angular) - Math.sin(latitude) * Math.sin(destinationLatitude),
    );
  return {
    latitude: (destinationLatitude * 180) / Math.PI,
    longitude:
      (((((destinationLongitude * 180) / Math.PI + 180) % 360) + 360) % 360) -
      180,
  };
}

function geoBoundingBox(area: DiscoveryRegistryGeoArea): {
  minLatitude: number;
  minLongitude: number;
  maxLatitude: number;
  maxLongitude: number;
} {
  const north = destinationPoint(area.center, area.radiusMeters, 0);
  const east = destinationPoint(area.center, area.radiusMeters, 90);
  const south = destinationPoint(area.center, area.radiusMeters, 180);
  const west = destinationPoint(area.center, area.radiusMeters, 270);
  return {
    minLatitude: Math.min(south.latitude, area.center.latitude),
    minLongitude: Math.min(west.longitude, area.center.longitude),
    maxLatitude: Math.max(north.latitude, area.center.latitude),
    maxLongitude: Math.max(east.longitude, area.center.longitude),
  };
}

export function distanceBetweenRegistryPoints(
  first: DiscoveryRegistryGeoPoint,
  second: DiscoveryRegistryGeoPoint,
): number {
  const a = validatePoint(first);
  const b = validatePoint(second);
  const latitudeDelta = ((b.latitude - a.latitude) * Math.PI) / 180;
  const longitudeDelta = ((b.longitude - a.longitude) * Math.PI) / 180;
  const firstLatitude = (a.latitude * Math.PI) / 180;
  const secondLatitude = (b.latitude * Math.PI) / 180;
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return (
    2 *
    EARTH_RADIUS_METERS *
    Math.asin(Math.min(1, Math.sqrt(Math.max(0, haversine))))
  );
}

function normalizeSourceUri(
  value: unknown,
  organizationNumber: string,
): string {
  const fallback = `${BRREG_UNITS_ENDPOINT}/${organizationNumber}`;
  const uri = text(value);
  if (!uri) return fallback;
  try {
    const parsed = new URL(uri);
    return parsed.protocol === "https:" && parsed.hostname === "data.brreg.no"
      ? uri
      : fallback;
  } catch {
    return fallback;
  }
}

function normalizedAddress(value: unknown): string | null {
  const normalized = text(value);
  return normalized ? normalizeForSearch(normalized) : null;
}

function addressMatches(
  candidateAddress: string,
  resultAddress: unknown,
): boolean {
  const expected = normalizedAddress(candidateAddress);
  const actual = normalizedAddress(resultAddress);
  if (!expected || !actual) return false;
  if (expected === actual || expected.startsWith(`${actual} `)) return true;
  if (actual.startsWith(`${expected} `)) return true;
  const expectedNumber = expected.match(/\b\d+[a-z]?\b/)?.[0] ?? null;
  const actualNumber = actual.match(/\b\d+[a-z]?\b/)?.[0] ?? null;
  if (!expectedNumber || expectedNumber !== actualNumber) return false;
  const expectedWords = new Set(
    expected.split(" ").filter((part) => part.length >= 3),
  );
  const actualWords = actual.split(" ").filter((part) => part.length >= 3);
  return actualWords.some((part) => expectedWords.has(part));
}

function geocodeCacheKey(candidate: DiscoveryRegistryCandidate): string {
  return [
    GEOCODE_CACHE_VERSION,
    normalizedAddress(candidate.address) ?? "",
    candidate.postalCode ?? "",
    candidate.municipalityNumber ?? "",
  ].join("|");
}

function validGeonorgePoint(
  value: unknown,
  candidate: DiscoveryRegistryCandidate,
): DiscoveryRegistryGeoPoint | null {
  if (!isRecord(value)) return null;
  const municipalityNumber = text(value.kommunenummer);
  const postalCode = text(value.postnummer);
  const expectedMunicipality = candidate.municipalityNumber;
  const expectedPostal = /^\d{4}$/.test(candidate.postalCode ?? "")
    ? candidate.postalCode
    : null;
  if (
    !expectedMunicipality ||
    municipalityNumber !== expectedMunicipality ||
    (expectedPostal && postalCode !== expectedPostal) ||
    !addressMatches(
      candidate.address ?? "",
      value.adressetekstutenadressetilleggsnavn ?? value.adressetekst,
    )
  ) {
    return null;
  }
  const point = isRecord(value.representasjonspunkt)
    ? value.representasjonspunkt
    : null;
  const latitude = point ? number(point.lat) : null;
  const longitude = point ? number(point.lon) : null;
  return latitude === null || longitude === null
    ? null
    : validatePoint({ latitude, longitude });
}

function normalizeCandidate(value: unknown): DiscoveryRegistryCandidate | null {
  if (!isRecord(value)) return null;
  const organizationNumber = text(value.organisasjonsnummer);
  const name = text(value.navn);
  if (!organizationNumber || !/^\d{9}$/.test(organizationNumber) || !name) {
    return null;
  }
  const addressRecord = isRecord(value.forretningsadresse)
    ? value.forretningsadresse
    : isRecord(value.postadresse)
      ? value.postadresse
      : {};
  const addressLines = Array.isArray(addressRecord.adresse)
    ? addressRecord.adresse.flatMap((line) => {
        const normalized = text(line);
        return normalized ? [normalized] : [];
      })
    : [];
  const organizationFormRecord = isRecord(value.organisasjonsform)
    ? value.organisasjonsform
    : {};
  const organizationFormCode = text(organizationFormRecord.kode);
  const organizationFormDescription = text(organizationFormRecord.beskrivelse);
  const organizationForm = organizationFormDescription ?? organizationFormCode;
  const nace = isRecord(value.naeringskode1) ? value.naeringskode1 : {};
  const links = isRecord(value._links) ? value._links : {};
  const self = isRecord(links.self) ? links.self : {};
  const isBankrupt = value.konkurs === true;
  const isLiquidating =
    value.underAvvikling === true ||
    value.underTvangsavviklingEllerTvangsopplosning === true;
  const hasRegisteredEmployeeCount =
    typeof value.harRegistrertAntallAnsatte === "boolean"
      ? value.harRegistrertAntallAnsatte
      : null;
  return {
    organizationNumber,
    name,
    organizationForm,
    organizationFormCode,
    organizationFormDescription,
    address: addressLines.length ? addressLines.join(", ") : null,
    postalCode: text(addressRecord.postnummer),
    city: text(addressRecord.poststed),
    municipality: text(addressRecord.kommune),
    municipalityNumber: text(addressRecord.kommunenummer),
    location: null,
    distanceFromSearchCenterMeters: null,
    website: text(value.hjemmeside),
    employeeCount: number(value.antallAnsatte),
    hasRegisteredEmployeeCount,
    naceCode: text(nace.kode),
    naceDescription: text(nace.beskrivelse),
    registeredAt: text(value.registreringsdatoEnhetsregisteret),
    registeredInVatRegister: value.registrertIMvaregisteret === true,
    registeredInVatRegisterKnown:
      typeof value.registrertIMvaregisteret === "boolean",
    registeredInBusinessRegister: value.registrertIForetaksregisteret === true,
    registeredInBusinessRegisterKnown:
      typeof value.registrertIForetaksregisteret === "boolean",
    status: isBankrupt
      ? "bankrupt"
      : isLiquidating
        ? "in_liquidation"
        : "active",
    sourceUri: normalizeSourceUri(self.href, organizationNumber),
  };
}

function matchesHardCompanyFilters(
  candidate: DiscoveryRegistryCandidate,
  input: NormalizedInput,
): boolean {
  if (
    input.queryMode === "organization_name" &&
    !matchesOrganizationNameQuery(candidate.name, input.query)
  ) {
    // BRREG's `navn` parameter is fuzzy and may, for example, return
    // "camping" for "casting". Verify organization-name intent against the
    // registered name before exposing the row as a lead candidate.
    return false;
  }
  if (
    input.organizationForms.length > 0 &&
    (!candidate.organizationFormCode ||
      !input.organizationForms.includes(
        candidate.organizationFormCode.toUpperCase(),
      ))
  ) {
    return false;
  }
  if (input.minimumEmployees !== null || input.maximumEmployees !== null) {
    if (
      candidate.hasRegisteredEmployeeCount !== true ||
      candidate.employeeCount === null
    ) {
      return false;
    }
    if (
      input.minimumEmployees !== null &&
      candidate.employeeCount < input.minimumEmployees
    ) {
      return false;
    }
    if (
      input.maximumEmployees !== null &&
      candidate.employeeCount > input.maximumEmployees
    ) {
      return false;
    }
  }
  const hasWebsite = candidate.website !== null;
  if (
    (input.websiteRequirement === "present" && !hasWebsite) ||
    (input.websiteRequirement === "missing" && hasWebsite)
  ) {
    return false;
  }
  if (
    input.registeredInVatRegister !== null &&
    (candidate.registeredInVatRegisterKnown !== true ||
      candidate.registeredInVatRegister !== input.registeredInVatRegister)
  ) {
    return false;
  }
  if (
    input.registeredInBusinessRegister !== null &&
    (candidate.registeredInBusinessRegisterKnown !== true ||
      candidate.registeredInBusinessRegister !==
        input.registeredInBusinessRegister)
  ) {
    return false;
  }
  return true;
}

function organizationNumbersFromGroupPayload(payload: unknown): string[] {
  const found = new Set<string>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!isRecord(value)) return;
    for (const [key, child] of Object.entries(value)) {
      if (key.toLocaleLowerCase("nb-NO") === "organisasjonsnummer") {
        const organizationNumber = text(child);
        if (organizationNumber && /^\d{9}$/.test(organizationNumber)) {
          found.add(organizationNumber);
        }
      }
      visit(child);
    }
  };
  visit(payload);
  return [...found].sort();
}

function responseUnits(payload: unknown): {
  units: unknown[];
  totalPages: number;
} {
  if (!isRecord(payload)) throw new DiscoveryRegistryError("invalid_response");
  const embedded = isRecord(payload._embedded) ? payload._embedded : {};
  const units = embedded.enheter;
  if (units !== undefined && !Array.isArray(units)) {
    throw new DiscoveryRegistryError("invalid_response");
  }
  const page = isRecord(payload.page) ? payload.page : {};
  const totalPages = number(page.totalPages);
  return {
    units: Array.isArray(units) ? units : [],
    totalPages: totalPages === null ? 1 : Math.max(0, Math.trunc(totalPages)),
  };
}

function responseMunicipalities(payload: unknown): {
  municipalities: BrregMunicipality[];
  totalPages: number;
} {
  if (!isRecord(payload)) throw new DiscoveryRegistryError("invalid_response");
  const embedded = isRecord(payload._embedded) ? payload._embedded : {};
  const values = embedded.kommuner;
  if (values !== undefined && !Array.isArray(values)) {
    throw new DiscoveryRegistryError("invalid_response");
  }
  const municipalities = (Array.isArray(values) ? values : []).flatMap(
    (value): BrregMunicipality[] => {
      if (!isRecord(value)) return [];
      const municipalityNumber = municipalityCodeValue(value.nummer);
      const name = text(value.navn);
      return municipalityNumber && name
        ? [{ number: municipalityNumber, name }]
        : [];
    },
  );
  const page = isRecord(payload.page) ? payload.page : {};
  const totalPages = number(page.totalPages);
  return {
    municipalities,
    totalPages: totalPages === null ? 1 : Math.max(0, Math.trunc(totalPages)),
  };
}

const municipalityGmlParser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
});

function municipalityCodeValue(value: unknown): string | null {
  const raw = isRecord(value) ? value["#text"] : value;
  const normalized =
    typeof raw === "number"
      ? String(Math.trunc(raw)).padStart(4, "0")
      : text(raw);
  return normalized && /^\d{4}$/.test(normalized) ? normalized : null;
}

/** Parse only explicit municipality-code elements from a WFS 2.0/GML body. */
export function municipalityNumbersFromGml(gml: string): string[] {
  let parsed: unknown;
  try {
    parsed = municipalityGmlParser.parse(gml);
  } catch {
    throw new DiscoveryRegistryError("invalid_response");
  }
  const found = new Set<string>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!isRecord(value)) return;
    for (const [key, child] of Object.entries(value)) {
      const normalizedKey = key.toLocaleLowerCase("nb-NO");
      if (
        normalizedKey === "kommunenummer" ||
        normalizedKey === "kommunekode"
      ) {
        const code = municipalityCodeValue(child);
        if (code) found.add(code);
      } else {
        visit(child);
      }
    }
  };
  visit(parsed);
  return [...found].sort();
}

async function mapConcurrent<T, R>(
  values: T[],
  concurrency: number,
  fn: (value: T) => Promise<R>,
): Promise<R[]> {
  const result = new Array<R>(values.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      while (cursor < values.length) {
        const index = cursor;
        cursor += 1;
        result[index] = await fn(values[index]);
      }
    }),
  );
  return result;
}

function emptyWebsiteSignals(): DiscoveryWebsiteQualityAssessment["signals"] {
  return {
    https: null,
    reachable: null,
    title: null,
    meta_description: null,
    viewport: null,
    contact_path: null,
    call_to_action: null,
  };
}

function unknownWebsiteAssessment(
  website: string | null,
  fetchedAt: string,
  reason: Exclude<DiscoveryWebsiteQualityAssessment["reason"], "assessed">,
  qualificationTerms: string[] = [],
): DiscoveryWebsiteQualityAssessment {
  return {
    status: "unknown",
    score: null,
    fetchedAt,
    sourceUri: website ?? "",
    finalUrl: null,
    httpStatus: null,
    redirectCount: 0,
    reason,
    signals: emptyWebsiteSignals(),
    qualification: {
      requestedTerms: qualificationTerms,
      matchedTerms: [],
    },
  };
}

function normalizedWebsiteUrl(value: string): URL | null {
  const raw = value.trim();
  if (!raw || raw.length > 2_048) return null;
  try {
    const url = new URL(
      /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`,
    );
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username ||
      url.password ||
      (url.port && url.port !== "80" && url.port !== "443") ||
      !url.hostname
    ) {
      return null;
    }
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

function websiteHtmlSignals(
  html: string,
): Omit<DiscoveryWebsiteQualityAssessment["signals"], "https" | "reachable"> {
  const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];
  const description = metaTags.some(
    (tag) =>
      /\bname\s*=\s*["']description["']/i.test(tag) &&
      /\bcontent\s*=\s*["'][^"']{10,}["']/i.test(tag),
  );
  const viewport = metaTags.some((tag) =>
    /\bname\s*=\s*["']viewport["']/i.test(tag),
  );
  return {
    title: /<title\b[^>]*>\s*[^<]{2,}\s*<\/title>/i.test(html),
    meta_description: description,
    viewport,
    contact_path:
      /href\s*=\s*["'](?:mailto:|tel:|[^"']*(?:kontakt|contact)[^"']*)["']/i.test(
        html,
      ),
    call_to_action:
      /\b(?:bestill(?:\s+time)?|book(?:\s+time)?|kontakt\s+oss|ta\s+kontakt|be\s+om\s+tilbud|få\s+tilbud|ring\s+oss)\b/i.test(
        html,
      ),
  };
}

function matchedWebsiteQualificationTerms(
  html: string,
  requestedTerms: string[],
): string[] {
  if (requestedTerms.length === 0) return [];
  const visibleText = normalizeForSearch(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&(?:nbsp|amp|quot|apos|lt|gt);/gi, " "),
  );
  const boundedVisibleText = ` ${visibleText} `;
  return requestedTerms.filter((term) => {
    const normalizedTerm = normalizeForSearch(term);
    return (
      normalizedTerm.length > 0 &&
      boundedVisibleText.includes(` ${normalizedTerm} `)
    );
  });
}

async function boundedResponseText(response: Response): Promise<string | null> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > WEBSITE_MAX_RESPONSE_BYTES
  ) {
    await cancelResponseBody(response);
    return null;
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let body = "";
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    total += part.value.byteLength;
    if (total > WEBSITE_MAX_RESPONSE_BYTES) {
      await reader.cancel();
      return null;
    }
    body += decoder.decode(part.value, { stream: true });
  }
  return body + decoder.decode();
}

async function cancelResponseBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Resource cleanup is best-effort and must not turn known evidence into a
    // retryable provider failure.
  }
}

function cacheWebsiteAssessment(
  key: string,
  assessment: DiscoveryWebsiteQualityAssessment,
  nowMs: number,
): DiscoveryWebsiteQualityAssessment {
  if (websiteCache.size >= WEBSITE_CACHE_MAX_ENTRIES) {
    const oldest = websiteCache.keys().next().value;
    if (typeof oldest === "string") websiteCache.delete(oldest);
  }
  const ttl =
    assessment.status === "assessed" ? WEBSITE_CACHE_TTL_MS : 15 * 60 * 1_000;
  websiteCache.set(key, { assessment, expiresAt: nowMs + ttl });
  return assessment;
}

export function createDiscoveryRegistryProvider(
  dependencies: DiscoveryRegistryProviderDependencies = {},
): DiscoveryRegistryProvider {
  const fetchImpl = dependencies.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const timeoutMs = Math.min(
    60_000,
    Math.max(1_000, Math.trunc(dependencies.requestTimeoutMs ?? 10_000)),
  );
  const maxAttempts = Math.min(
    4,
    Math.max(1, Math.trunc(dependencies.maxAttempts ?? 3)),
  );
  const now = dependencies.now ?? (() => new Date());
  const websiteFetch = dependencies.websiteFetch ?? ssrfSafeFetchWithMetadata;
  const maxExternalRequests = Math.min(
    DISCOVERY_MAX_EXTERNAL_REQUESTS,
    Math.max(
      1,
      Math.trunc(
        dependencies.maxExternalRequests ?? DISCOVERY_MAX_EXTERNAL_REQUESTS,
      ),
    ),
  );
  const maxGeocodes = Math.min(
    DISCOVERY_MAX_GEOCODES,
    Math.max(1, Math.trunc(dependencies.maxGeocodes ?? DISCOVERY_MAX_GEOCODES)),
  );
  let externalRequests = 0;
  let geocodeRequests = 0;
  let websiteAssessmentRequests = 0;
  let cachedNace: { expiresAt: number; codes: NaceCode[] } | null = null;
  let cachedMunicipalities: {
    expiresAt: number;
    values: BrregMunicipality[];
  } | null = null;

  function reserveExternalRequest(): void {
    if (externalRequests >= maxExternalRequests) {
      throw new DiscoveryRegistryError("external_request_limit");
    }
    externalRequests += 1;
  }

  async function assessWebsite(
    website: string | null,
    signal: AbortSignal | undefined,
    evidenceSourceUri: string,
    qualificationTerms: string[],
  ): Promise<DiscoveryWebsiteQualityAssessment> {
    const fetchedAt = now().toISOString();
    if (!website) {
      return unknownWebsiteAssessment(
        evidenceSourceUri,
        fetchedAt,
        "no_registered_url",
        qualificationTerms,
      );
    }
    const initial = normalizedWebsiteUrl(website);
    if (!initial) {
      return unknownWebsiteAssessment(
        website,
        fetchedAt,
        "invalid_url",
        qualificationTerms,
      );
    }
    const cacheKey = `${initial.toString()}|qualification:${qualificationTerms
      .map(normalizeForSearch)
      .sort()
      .join("|")}`;
    const cached = websiteCache.get(cacheKey);
    if (cached && cached.expiresAt > now().getTime()) return cached.assessment;
    if (cached) websiteCache.delete(cacheKey);

    try {
      if (signal?.aborted) throw new DiscoveryRegistryError("cancelled");
      const fetched = await websiteFetch(
        initial.toString(),
        {
          headers: {
            Accept: "text/html,application/xhtml+xml;q=0.9",
            "User-Agent": "Leadgrid-Discovery/1.0",
          },
          signal: attemptSignal(signal, Math.min(timeoutMs, 5_000)),
        },
        WEBSITE_MAX_REDIRECTS,
        () => {
          reserveExternalRequest();
          websiteAssessmentRequests += 1;
        },
      );
      const response = fetched.response;
      const finalUrl = new URL(fetched.finalUrl);
      const contentType = response.headers.get("content-type")?.toLowerCase();
      const htmlResponse =
        !contentType ||
        contentType.includes("text/html") ||
        contentType.includes("application/xhtml+xml");
      const inspectBody = response.ok && htmlResponse;
      if (!inspectBody) await cancelResponseBody(response);
      if (
        !response.ok &&
        (response.status === 408 ||
          response.status === 429 ||
          response.status >= 500)
      ) {
        return cacheWebsiteAssessment(
          cacheKey,
          {
            ...unknownWebsiteAssessment(
              initial.toString(),
              fetchedAt,
              "request_failed",
              qualificationTerms,
            ),
            finalUrl: fetched.finalUrl,
            httpStatus: response.status,
            redirectCount: fetched.redirectCount,
            signals: {
              ...emptyWebsiteSignals(),
              https: finalUrl.protocol === "https:",
              reachable: false,
            },
          },
          now().getTime(),
        );
      }
      if (response.ok && !htmlResponse) {
        return cacheWebsiteAssessment(
          cacheKey,
          {
            ...unknownWebsiteAssessment(
              initial.toString(),
              fetchedAt,
              "unsupported_content_type",
              qualificationTerms,
            ),
            finalUrl: fetched.finalUrl,
            httpStatus: response.status,
            redirectCount: fetched.redirectCount,
            signals: {
              ...emptyWebsiteSignals(),
              https: finalUrl.protocol === "https:",
              reachable: true,
            },
          },
          now().getTime(),
        );
      }
      const body = inspectBody ? await boundedResponseText(response) : "";
      if (body === null) {
        return cacheWebsiteAssessment(
          cacheKey,
          unknownWebsiteAssessment(
            fetched.finalUrl,
            fetchedAt,
            "response_too_large",
            qualificationTerms,
          ),
          now().getTime(),
        );
      }
      const htmlSignals = websiteHtmlSignals(body);
      const signals: DiscoveryWebsiteQualityAssessment["signals"] = {
        https: finalUrl.protocol === "https:",
        reachable: response.ok,
        ...htmlSignals,
      };
      const score =
        (signals.https ? 15 : 0) +
        (signals.reachable ? 25 : 0) +
        (signals.title ? 15 : 0) +
        (signals.meta_description ? 15 : 0) +
        (signals.viewport ? 10 : 0) +
        (signals.contact_path ? 10 : 0) +
        (signals.call_to_action ? 10 : 0);
      return cacheWebsiteAssessment(
        cacheKey,
        {
          status: "assessed",
          score,
          fetchedAt,
          sourceUri: initial.toString(),
          finalUrl: fetched.finalUrl,
          httpStatus: response.status,
          redirectCount: fetched.redirectCount,
          reason: "assessed",
          signals,
          qualification: {
            requestedTerms: qualificationTerms,
            matchedTerms: matchedWebsiteQualificationTerms(
              body,
              qualificationTerms,
            ),
          },
        },
        now().getTime(),
      );
    } catch (error) {
      if (signal?.aborted) throw new DiscoveryRegistryError("cancelled");
      if (
        error instanceof DiscoveryRegistryError &&
        (error.code === "cancelled" || error.code === "external_request_limit")
      ) {
        throw error;
      }
      const reason =
        error instanceof Error && error.message.startsWith("SSRF:")
          ? "unsafe_host"
          : "request_failed";
      return cacheWebsiteAssessment(
        cacheKey,
        unknownWebsiteAssessment(
          initial.toString(),
          fetchedAt,
          reason,
          qualificationTerms,
        ),
        now().getTime(),
      );
    }
  }

  function reserveGeocode(): void {
    if (geocodeRequests >= maxGeocodes) {
      throw new DiscoveryRegistryError("geocode_limit");
    }
    geocodeRequests += 1;
  }

  async function getJson(
    url: URL,
    signal: AbortSignal | undefined,
  ): Promise<unknown> {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (signal?.aborted) throw new DiscoveryRegistryError("cancelled");
      try {
        reserveExternalRequest();
        const response = await fetchImpl(url, {
          headers: { Accept: "application/json" },
          signal: attemptSignal(signal, timeoutMs),
        });
        if (response.ok) {
          try {
            return await response.json();
          } catch {
            throw new DiscoveryRegistryError("invalid_response");
          }
        }
        const error = httpError(response);
        if (error.retryable && attempt + 1 < maxAttempts) {
          await delay(100 * 2 ** attempt, signal);
          continue;
        }
        throw error;
      } catch (error) {
        if (signal?.aborted) throw new DiscoveryRegistryError("cancelled");
        if (error instanceof DiscoveryRegistryError) throw error;
        const mapped = isAbort(error)
          ? new DiscoveryRegistryError("timeout", { retryable: true })
          : new DiscoveryRegistryError("network_error", { retryable: true });
        if (attempt + 1 < maxAttempts) {
          await delay(100 * 2 ** attempt, signal);
          continue;
        }
        throw mapped;
      }
    }
    throw new DiscoveryRegistryError("upstream_unavailable", {
      retryable: true,
    });
  }

  async function getText(
    url: URL,
    signal: AbortSignal | undefined,
    accept: string,
  ): Promise<string> {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (signal?.aborted) throw new DiscoveryRegistryError("cancelled");
      try {
        reserveExternalRequest();
        const response = await fetchImpl(url, {
          headers: { Accept: accept },
          signal: attemptSignal(signal, timeoutMs),
        });
        if (response.ok) {
          const body = await response.text();
          if (!body.trim())
            throw new DiscoveryRegistryError("invalid_response");
          return body;
        }
        const error = httpError(response);
        if (error.retryable && attempt + 1 < maxAttempts) {
          await delay(100 * 2 ** attempt, signal);
          continue;
        }
        throw error;
      } catch (error) {
        if (signal?.aborted) throw new DiscoveryRegistryError("cancelled");
        if (error instanceof DiscoveryRegistryError) throw error;
        const mapped = isAbort(error)
          ? new DiscoveryRegistryError("timeout", { retryable: true })
          : new DiscoveryRegistryError("network_error", { retryable: true });
        if (attempt + 1 < maxAttempts) {
          await delay(100 * 2 ** attempt, signal);
          continue;
        }
        throw mapped;
      }
    }
    throw new DiscoveryRegistryError("upstream_unavailable", {
      retryable: true,
    });
  }

  async function naceCodes(
    query: string,
    signal: AbortSignal | undefined,
  ): Promise<string[]> {
    const direct = rankNaceCodes([], query);
    if (direct.length) return direct;
    if (!cachedNace || cachedNace.expiresAt <= now().getTime()) {
      const url = new URL(SSB_NACE_ENDPOINT);
      url.searchParams.set("date", now().toISOString().slice(0, 10));
      url.searchParams.set("language", "nb");
      const codes = parseNaceCodes(await getJson(url, signal));
      if (codes.length) {
        cachedNace = {
          codes,
          expiresAt: now().getTime() + 24 * 60 * 60 * 1_000,
        };
      }
    }
    return cachedNace ? rankNaceCodes(cachedNace.codes, query) : [];
  }

  async function municipalityCatalog(
    signal: AbortSignal | undefined,
  ): Promise<BrregMunicipality[]> {
    if (
      cachedMunicipalities &&
      cachedMunicipalities.expiresAt > now().getTime()
    ) {
      return cachedMunicipalities.values;
    }
    const values: BrregMunicipality[] = [];
    let totalPages = 1;
    for (let page = 0; page < totalPages && page < 10; page += 1) {
      const url = new URL(BRREG_MUNICIPALITIES_ENDPOINT);
      url.searchParams.set("size", "100");
      url.searchParams.set("page", String(page));
      url.searchParams.set("sort", "nummer,ASC");
      const response = responseMunicipalities(await getJson(url, signal));
      values.push(...response.municipalities);
      totalPages = response.totalPages;
    }
    if (!values.length || totalPages > 10) {
      throw new DiscoveryRegistryError("municipality_resolution_failed", {
        retryable: true,
      });
    }
    const deduplicated = [
      ...new Map(values.map((entry) => [entry.number, entry])).values(),
    ].sort((a, b) => a.number.localeCompare(b.number));
    cachedMunicipalities = {
      expiresAt: now().getTime() + 24 * 60 * 60 * 1_000,
      values: deduplicated,
    };
    return deduplicated;
  }

  async function resolveExplicitMunicipalities(
    input: NormalizedInput,
  ): Promise<DiscoveryResolvedMunicipality[]> {
    if (
      input.municipalityNumbers.length === 0 &&
      input.municipalityNames.length === 0
    ) {
      return [];
    }
    const catalog = await municipalityCatalog(input.signal);
    const byNormalizedName = new Map<string, BrregMunicipality[]>();
    for (const municipality of catalog) {
      const key = normalizeForSearch(municipality.name);
      byNormalizedName.set(key, [
        ...(byNormalizedName.get(key) ?? []),
        municipality,
      ]);
    }
    const resolvedNames = input.municipalityNames.map((name) => {
      const matches = byNormalizedName.get(normalizeForSearch(name)) ?? [];
      if (matches.length !== 1) {
        throw new DiscoveryRegistryError("municipality_resolution_failed");
      }
      return matches[0];
    });
    const catalogByNumber = new Map(
      catalog.map((municipality) => [municipality.number, municipality]),
    );
    if (
      input.municipalityNumbers.some(
        (municipalityNumber) => !catalogByNumber.has(municipalityNumber),
      )
    ) {
      throw new DiscoveryRegistryError("municipality_resolution_failed");
    }
    const resolved = [
      ...input.municipalityNumbers,
      ...resolvedNames.map((item) => item.number),
    ].map((municipalityNumber) => ({
      number: municipalityNumber,
      name: catalogByNumber.get(municipalityNumber)?.name ?? null,
      sourceUri: BRREG_MUNICIPALITIES_ENDPOINT + "/" + municipalityNumber,
    }));
    return [
      ...new Map(resolved.map((entry) => [entry.number, entry])).values(),
    ].sort((a, b) => a.number.localeCompare(b.number));
  }

  async function municipalitiesForArea(
    geo: DiscoveryRegistryGeoArea,
    signal: AbortSignal | undefined,
  ): Promise<string[]> {
    const bbox = geoBoundingBox(geo);
    const url = new URL(GEONORGE_MUNICIPALITY_WFS_ENDPOINT);
    url.searchParams.set("service", "WFS");
    url.searchParams.set("version", "2.0.0");
    url.searchParams.set("request", "GetFeature");
    url.searchParams.set("typeNames", "app:Kommune");
    url.searchParams.set("srsName", "urn:ogc:def:crs:OGC:1.3:CRS84");
    url.searchParams.set(
      "bbox",
      [
        bbox.minLongitude,
        bbox.minLatitude,
        bbox.maxLongitude,
        bbox.maxLatitude,
        "urn:ogc:def:crs:OGC:1.3:CRS84",
      ].join(","),
    );
    // Administrative Units WFS 2.0 advertises GML 3.2, not GeoJSON.
    // Omitting outputFormat selects the server's standards-compliant GML.
    const gml = await getText(
      url,
      signal,
      "application/gml+xml; version=3.2, text/xml; subtype=gml/3.2.1;q=0.9",
    );
    const municipalities = municipalityNumbersFromGml(gml);
    if (!municipalities.length) {
      throw new DiscoveryRegistryError("area_resolution_failed", {
        retryable: true,
      });
    }
    return municipalities;
  }

  function cacheOrganizationStructure(
    organizationNumber: string,
    classification: DiscoveryOrganizationStructure,
    evidence: DiscoveryOrganizationStructureEvidence,
  ): DiscoveryOrganizationStructureEvidence {
    if (structureCache.size >= STRUCTURE_CACHE_MAX_ENTRIES) {
      const oldest = structureCache.keys().next().value;
      if (typeof oldest === "string") structureCache.delete(oldest);
    }
    structureCache.set(organizationNumber, {
      expiresAt: now().getTime() + STRUCTURE_CACHE_TTL_MS,
      classification,
      evidence,
    });
    return evidence;
  }

  async function organizationStructureFor(
    organizationNumber: string,
    signal: AbortSignal | undefined,
  ): Promise<{
    classification: DiscoveryOrganizationStructure;
    evidence: DiscoveryOrganizationStructureEvidence;
  }> {
    const cached = structureCache.get(organizationNumber);
    if (cached && cached.expiresAt > now().getTime()) {
      return {
        classification: cached.classification,
        evidence: cached.evidence,
      };
    }
    if (cached) structureCache.delete(organizationNumber);
    const url = new URL(
      BRREG_GROUP_STRUCTURE_ENDPOINT + "/" + organizationNumber,
    );
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (signal?.aborted) throw new DiscoveryRegistryError("cancelled");
      try {
        reserveExternalRequest();
        const response = await fetchImpl(url, {
          headers: { Accept: "application/json" },
          signal: attemptSignal(signal, timeoutMs),
        });
        if (response.status === 404) {
          const evidence: DiscoveryOrganizationStructureEvidence = {
            source: "brreg_group_structure",
            sourceUri: url.toString(),
            basis: "not_found",
            relatedOrganizationCount: null,
          };
          cacheOrganizationStructure(organizationNumber, "unknown", evidence);
          return { classification: "unknown", evidence };
        }
        if (response.ok) {
          let payload: unknown;
          try {
            payload = await response.json();
          } catch {
            payload = null;
          }
          const organizationNumbers =
            organizationNumbersFromGroupPayload(payload);
          if (organizationNumbers.length > 0) {
            const related = new Set([
              organizationNumber,
              ...organizationNumbers,
            ]);
            const classification: DiscoveryOrganizationStructure =
              related.size > 1 ? "chain" : "independent";
            const evidence: DiscoveryOrganizationStructureEvidence = {
              source: "brreg_group_structure",
              sourceUri: url.toString(),
              basis:
                classification === "chain"
                  ? "multiple_registered_entities"
                  : "single_registered_entity",
              relatedOrganizationCount: related.size,
            };
            cacheOrganizationStructure(
              organizationNumber,
              classification,
              evidence,
            );
            return { classification, evidence };
          }
        } else {
          const error = httpError(response);
          if (error.retryable && attempt + 1 < maxAttempts) {
            await delay(100 * 2 ** attempt, signal);
            continue;
          }
        }
      } catch (error) {
        if (signal?.aborted) throw new DiscoveryRegistryError("cancelled");
        if (
          error instanceof DiscoveryRegistryError &&
          (error.code === "cancelled" ||
            error.code === "external_request_limit")
        ) {
          throw error;
        }
        if (attempt + 1 < maxAttempts) {
          await delay(100 * 2 ** attempt, signal);
          continue;
        }
      }
      break;
    }
    const evidence: DiscoveryOrganizationStructureEvidence = {
      source: "brreg_group_structure",
      sourceUri: url.toString(),
      basis: "unavailable",
      relatedOrganizationCount: null,
    };
    cacheOrganizationStructure(organizationNumber, "unknown", evidence);
    return { classification: "unknown", evidence };
  }

  async function geocode(
    candidate: DiscoveryRegistryCandidate,
    signal: AbortSignal | undefined,
  ): Promise<DiscoveryRegistryGeoPoint | null> {
    const address = candidate.address;
    const municipalityNumber = candidate.municipalityNumber;
    if (
      !address ||
      !municipalityNumber ||
      !/^\d{4}$/.test(municipalityNumber)
    ) {
      return null;
    }
    const cacheKey = geocodeCacheKey(candidate);
    const cached = geocodeCache.get(cacheKey);
    if (cached && cached.expiresAt > now().getTime()) return cached.location;
    if (cached) geocodeCache.delete(cacheKey);
    reserveGeocode();

    let location: DiscoveryRegistryGeoPoint | null = null;
    for (const fuzzy of [false, true]) {
      const url = new URL(`${GEONORGE_ADDRESS_ENDPOINT}/sok`);
      url.searchParams.set("adressetekst", address);
      url.searchParams.set("kommunenummer", municipalityNumber);
      if (/^\d{4}$/.test(candidate.postalCode ?? "")) {
        url.searchParams.set("postnummer", candidate.postalCode as string);
      }
      url.searchParams.set("fuzzy", String(fuzzy));
      url.searchParams.set("sokemodus", "AND");
      url.searchParams.set("treffPerSide", "10");
      try {
        const payload = await getJson(url, signal);
        if (!isRecord(payload)) continue;
        const addresses = Array.isArray(payload.adresser)
          ? payload.adresser
          : [];
        location =
          addresses
            .map((address) => validGeonorgePoint(address, candidate))
            .find(
              (point): point is DiscoveryRegistryGeoPoint => point !== null,
            ) ?? null;
        if (location) break;
      } catch (error) {
        if (
          error instanceof DiscoveryRegistryError &&
          ["cancelled", "external_request_limit", "geocode_limit"].includes(
            error.code,
          )
        ) {
          throw error;
        }
        // An individual address miss must not fail or retry the full run.
        break;
      }
    }
    if (geocodeCache.size >= GEOCODE_CACHE_MAX_ENTRIES) {
      const oldest = geocodeCache.keys().next().value;
      if (typeof oldest === "string") geocodeCache.delete(oldest);
    }
    geocodeCache.set(cacheKey, {
      expiresAt: now().getTime() + GEOCODE_CACHE_TTL_MS,
      location,
    });
    return location;
  }

  return {
    async search(
      rawInput: DiscoveryRegistrySearchInput,
    ): Promise<DiscoveryRegistrySearchResult> {
      const input = normalizeInput(rawInput);
      const externalRequestsBefore = externalRequests;
      const geocodeRequestsBefore = geocodeRequests;
      const websiteAssessmentRequestsBefore = websiteAssessmentRequests;
      if (input.signal?.aborted) {
        throw new DiscoveryRegistryError("cancelled");
      }
      const [
        resolvedNaceCodes,
        explicitMunicipalities,
        geoMunicipalityNumbers,
      ] = await Promise.all([
        input.queryMode === "industry"
          ? naceCodes(input.query, input.signal)
          : Promise.resolve([]),
        resolveExplicitMunicipalities(input),
        input.geo
          ? municipalitiesForArea(input.geo, input.signal)
          : Promise.resolve([]),
      ]);
      const resolvedMunicipalities =
        explicitMunicipalities.length > 0
          ? explicitMunicipalities
          : geoMunicipalityNumbers.map((municipalityNumber) => ({
              number: municipalityNumber,
              name: null,
              sourceUri: GEONORGE_MUNICIPALITY_WFS_ENDPOINT,
            }));
      const municipalityNumbers = resolvedMunicipalities.map(
        (municipality) => municipality.number,
      );
      if (input.queryMode === "industry" && !resolvedNaceCodes.length) {
        throw new DiscoveryRegistryError("classification_resolution_failed");
      }
      const resolution =
        input.queryMode === "industry" ? "nace" : "organization_name";
      const candidates: DiscoveryRegistryCandidate[] = [];
      const seen = new Set<string>();
      let pagesFetched = 0;
      let sourceResultsSeen = 0;
      let duplicateResultsSkipped = 0;
      let invalidResultsSkipped = 0;
      let geoFilteredResults = 0;
      let geocodeMisses = 0;
      let companyFilteredResults = 0;
      let websiteAssessmentCandidates = 0;
      const sourceOffsetStart = input.sourceOffset;
      let sourceOffsetNext = sourceOffsetStart;
      let currentSourceOffset = sourceOffsetStart;
      let totalPages = 1;
      let limitReason: DiscoveryRegistrySearchResult["limitReason"] = null;
      const visitedSourcePages = new Set<number>();
      let sourcePagesFetched = 0;
      let pageRequests = 0;
      let cursorProbeFallbackUsed = false;
      let stoppedMidPage = false;

      pageLoop: while (
        sourcePagesFetched < MAX_BRREG_PAGES &&
        pageRequests < MAX_BRREG_PAGES + 2 &&
        candidates.length < input.maxResults
      ) {
        const sourcePage = Math.floor(
          currentSourceOffset / DISCOVERY_BRREG_PAGE_SIZE,
        );
        const sourceRowOffset = currentSourceOffset % DISCOVERY_BRREG_PAGE_SIZE;
        const url = new URL(BRREG_UNITS_ENDPOINT);
        url.searchParams.set("size", String(DISCOVERY_BRREG_PAGE_SIZE));
        url.searchParams.set("page", String(sourcePage));
        url.searchParams.set("sort", "organisasjonsnummer,ASC");
        url.searchParams.set("konkurs", "false");
        if (resolvedNaceCodes.length) {
          url.searchParams.set("naeringskode", resolvedNaceCodes.join(","));
        } else {
          url.searchParams.set("navn", input.query);
        }
        if (municipalityNumbers.length) {
          url.searchParams.set("kommunenummer", municipalityNumbers.join(","));
        } else if (input.city) {
          url.searchParams.set(
            "forretningsadresse.poststed",
            input.city.toLocaleUpperCase("nb-NO"),
          );
        }
        if (input.organizationForms.length > 0) {
          url.searchParams.set(
            "organisasjonsform",
            input.organizationForms.join(","),
          );
        }
        if (input.minimumEmployees !== null) {
          url.searchParams.set(
            "fraAntallAnsatte",
            String(input.minimumEmployees),
          );
        }
        if (input.maximumEmployees !== null) {
          url.searchParams.set(
            "tilAntallAnsatte",
            String(input.maximumEmployees),
          );
        }
        if (input.registeredInVatRegister !== null) {
          url.searchParams.set(
            "registrertIMvaregisteret",
            String(input.registeredInVatRegister),
          );
        }
        if (input.registeredInBusinessRegister !== null) {
          url.searchParams.set(
            "registrertIForetaksregisteret",
            String(input.registeredInBusinessRegister),
          );
        }

        let response: ReturnType<typeof responseUnits>;
        pageRequests += 1;
        try {
          response = responseUnits(await getJson(url, input.signal));
        } catch (error) {
          if (
            error instanceof DiscoveryRegistryError &&
            error.code === "invalid_request" &&
            !cursorProbeFallbackUsed &&
            sourcePagesFetched === 0 &&
            sourcePage > 0
          ) {
            // A shrunken result universe can make a persisted page invalid.
            // Resetting to zero may repeat data, but can never skip new data.
            cursorProbeFallbackUsed = true;
            currentSourceOffset = 0;
            sourceOffsetNext = 0;
            continue;
          }
          if (
            error instanceof DiscoveryRegistryError &&
            (error.code === "external_request_limit" ||
              error.code === "geocode_limit")
          ) {
            limitReason =
              error.code === "geocode_limit"
                ? "geocode_limit"
                : "external_request_limit";
            break;
          }
          throw error;
        }

        totalPages = response.totalPages;
        if (totalPages === 0) {
          sourceOffsetNext = 0;
          break;
        }
        if (sourcePage >= totalPages) {
          if (cursorProbeFallbackUsed) {
            throw new DiscoveryRegistryError("invalid_response");
          }
          cursorProbeFallbackUsed = true;
          currentSourceOffset = 0;
          sourceOffsetNext = 0;
          continue;
        }
        if (visitedSourcePages.has(sourcePage)) break;
        visitedSourcePages.add(sourcePage);
        pagesFetched += 1;
        sourcePagesFetched += 1;

        const advancePastSourceRow = (rawIndex: number): void => {
          sourceResultsSeen += 1;
          const nextRow = rawIndex + 1;
          sourceOffsetNext =
            nextRow < response.units.length
              ? sourcePage * DISCOVERY_BRREG_PAGE_SIZE + nextRow
              : sourcePage + 1 < totalPages
                ? (sourcePage + 1) * DISCOVERY_BRREG_PAGE_SIZE
                : 0;
          currentSourceOffset = sourceOffsetNext;
        };

        if (sourceRowOffset >= response.units.length) {
          sourceOffsetNext =
            sourcePage + 1 < totalPages
              ? (sourcePage + 1) * DISCOVERY_BRREG_PAGE_SIZE
              : 0;
          currentSourceOffset = sourceOffsetNext;
          if (visitedSourcePages.size >= totalPages) break;
          continue;
        }

        for (
          let rawIndex = sourceRowOffset;
          rawIndex < response.units.length;
          rawIndex += 1
        ) {
          const candidate = normalizeCandidate(response.units[rawIndex]);
          if (!candidate) {
            invalidResultsSkipped += 1;
            advancePastSourceRow(rawIndex);
            continue;
          }
          if (seen.has(candidate.organizationNumber)) {
            duplicateResultsSkipped += 1;
            advancePastSourceRow(rawIndex);
            continue;
          }
          seen.add(candidate.organizationNumber);
          if (
            municipalityNumbers.length > 0 &&
            (!candidate.municipalityNumber ||
              !municipalityNumbers.includes(candidate.municipalityNumber))
          ) {
            geoFilteredResults += 1;
            advancePastSourceRow(rawIndex);
            continue;
          }
          if (!matchesHardCompanyFilters(candidate, input)) {
            companyFilteredResults += 1;
            advancePastSourceRow(rawIndex);
            continue;
          }

          let locatedCandidate: DiscoveryRegistryCandidate | null = candidate;
          if (input.geo) {
            try {
              const location = await geocode(candidate, input.signal);
              if (!location) {
                geocodeMisses += 1;
                locatedCandidate = null;
              } else {
                const distance = distanceBetweenRegistryPoints(
                  input.geo.center,
                  location,
                );
                locatedCandidate =
                  distance > input.geo.radiusMeters + 1
                    ? null
                    : {
                        ...candidate,
                        location,
                        distanceFromSearchCenterMeters: distance,
                      };
              }
            } catch (error) {
              if (
                error instanceof DiscoveryRegistryError &&
                (error.code === "external_request_limit" ||
                  error.code === "geocode_limit")
              ) {
                limitReason =
                  error.code === "geocode_limit"
                    ? "geocode_limit"
                    : "external_request_limit";
                break pageLoop;
              }
              throw error;
            }
          }
          if (!locatedCandidate) {
            geoFilteredResults += 1;
            advancePastSourceRow(rawIndex);
            continue;
          }

          candidates.push(locatedCandidate);
          advancePastSourceRow(rawIndex);
          if (candidates.length >= input.maxResults) {
            stoppedMidPage = rawIndex + 1 < response.units.length;
            break pageLoop;
          }
        }

        if (visitedSourcePages.size >= totalPages) break;
      }

      if (
        !limitReason &&
        sourcePagesFetched >= MAX_BRREG_PAGES &&
        visitedSourcePages.size < totalPages &&
        candidates.length < input.maxResults
      ) {
        limitReason = "page_limit";
      }

      if (input.organizationStructure !== "any" && candidates.length > 0) {
        let structureRequestLimitReached =
          limitReason === "external_request_limit";
        const enriched = await mapConcurrent(
          candidates,
          6,
          async (candidate) => {
            const unavailableEvidence: DiscoveryOrganizationStructureEvidence =
              {
                source: "brreg_group_structure",
                sourceUri:
                  BRREG_GROUP_STRUCTURE_ENDPOINT +
                  "/" +
                  candidate.organizationNumber,
                basis: "unavailable",
                relatedOrganizationCount: null,
              };
            if (structureRequestLimitReached) {
              return {
                ...candidate,
                organizationStructure: "unknown" as const,
                organizationStructureEvidence: unavailableEvidence,
              };
            }
            try {
              const structure = await organizationStructureFor(
                candidate.organizationNumber,
                input.signal,
              );
              return {
                ...candidate,
                organizationStructure: structure.classification,
                organizationStructureEvidence: structure.evidence,
              };
            } catch (error) {
              if (
                error instanceof DiscoveryRegistryError &&
                error.code === "external_request_limit"
              ) {
                structureRequestLimitReached = true;
                return {
                  ...candidate,
                  organizationStructure: "unknown" as const,
                  organizationStructureEvidence: unavailableEvidence,
                };
              }
              throw error;
            }
          },
        );
        candidates.splice(0, candidates.length, ...enriched);
        if (structureRequestLimitReached)
          limitReason = "external_request_limit";
      }

      if (
        (input.minimumWebsiteQualityScore !== null ||
          input.qualificationTerms.length > 0) &&
        candidates.length > 0
      ) {
        let websiteRequestLimitReached =
          limitReason === "external_request_limit";
        const selectedCandidates = candidates.slice(
          0,
          input.websiteAssessmentLimit,
        );
        websiteAssessmentCandidates = selectedCandidates.length;
        const notSelected = candidates
          .slice(input.websiteAssessmentLimit)
          .map((candidate) => ({
            ...candidate,
            websiteQuality: unknownWebsiteAssessment(
              candidate.website ?? candidate.sourceUri,
              now().toISOString(),
              "not_selected_for_assessment",
              input.qualificationTerms,
            ),
          }));
        const assessed = await mapConcurrent(
          selectedCandidates,
          WEBSITE_ASSESSMENT_CONCURRENCY,
          async (candidate) => {
            if (websiteRequestLimitReached) {
              return {
                ...candidate,
                websiteQuality: unknownWebsiteAssessment(
                  candidate.website ?? candidate.sourceUri,
                  now().toISOString(),
                  "external_request_limit",
                  input.qualificationTerms,
                ),
              };
            }
            try {
              return {
                ...candidate,
                websiteQuality: await assessWebsite(
                  candidate.website,
                  input.signal,
                  candidate.sourceUri,
                  input.qualificationTerms,
                ),
              };
            } catch (error) {
              if (
                error instanceof DiscoveryRegistryError &&
                error.code === "external_request_limit"
              ) {
                websiteRequestLimitReached = true;
                return {
                  ...candidate,
                  websiteQuality: unknownWebsiteAssessment(
                    candidate.website ?? candidate.sourceUri,
                    now().toISOString(),
                    "external_request_limit",
                    input.qualificationTerms,
                  ),
                };
              }
              throw error;
            }
          },
        );
        candidates.splice(0, candidates.length, ...assessed, ...notSelected);
        if (websiteRequestLimitReached) limitReason = "external_request_limit";
      }

      return {
        resolvedMunicipalities,
        candidates,
        sourceOffsetStart,
        sourceOffsetNext,
        sourcePageStart: Math.floor(
          sourceOffsetStart / DISCOVERY_BRREG_PAGE_SIZE,
        ),
        sourcePageNext: Math.floor(
          sourceOffsetNext / DISCOVERY_BRREG_PAGE_SIZE,
        ),
        sourcePageCount: totalPages,
        pagesFetched,
        sourceResultsSeen,
        duplicateResultsSkipped,
        invalidResultsSkipped,
        geoFilteredResults,
        sourceLimitReached: limitReason !== null,
        companyFilteredResults,
        websiteAssessmentCandidates,
        websiteAssessmentRequests:
          websiteAssessmentRequests - websiteAssessmentRequestsBefore,
        hasMoreSourceResults:
          limitReason !== null ||
          candidates.length >= input.maxResults ||
          stoppedMidPage ||
          visitedSourcePages.size < totalPages,
        limitReason,
        externalRequests: externalRequests - externalRequestsBefore,
        geocodeRequests: geocodeRequests - geocodeRequestsBefore,
        geocodeMisses,
        resolution,
        resolvedNaceCodes,
      };
    },
  };
}
