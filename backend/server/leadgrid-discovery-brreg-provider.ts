import { XMLParser } from "fast-xml-parser";

/**
 * Discovery source backed by Brønnøysundregistrene Open Data (NLOD).
 *
 * The adapter deliberately returns official registry fields only. Geographic
 * coordinates are derived from the registry's business address through
 * Kartverket/Geonorge and are never derived from Google Maps content.
 */

const BRREG_UNITS_ENDPOINT =
  "https://data.brreg.no/enhetsregisteret/api/enheter";
const SSB_NACE_ENDPOINT =
  "https://data.ssb.no/api/klass/v1/classifications/6/codesAt";
const GEONORGE_ADDRESS_ENDPOINT = "https://ws.geonorge.no/adresser/v1";
const GEONORGE_MUNICIPALITY_WFS_ENDPOINT =
  "https://wfs.geonorge.no/skwms1/wfs.administrative_enheter";

const MAX_RESULTS = 60;
const MAX_BRREG_PAGES = 3;
const MAX_PAGE_SIZE = 100;
const EARTH_RADIUS_METERS = 6_371_008.8;
export const DISCOVERY_MAX_EXTERNAL_REQUESTS = 200;
export const DISCOVERY_MAX_GEOCODES = 120;
const GEOCODE_CACHE_TTL_MS = 24 * 60 * 60 * 1_000;
const GEOCODE_CACHE_MAX_ENTRIES = 5_000;
const GEOCODE_CACHE_VERSION = "geonorge-address-v1";

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
  maxResults?: number;
  city?: string | null;
  geo?: DiscoveryRegistryGeoArea | null;
  signal?: AbortSignal;
}

export interface DiscoveryRegistryCandidate {
  organizationNumber: string;
  name: string;
  organizationForm: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  municipality: string | null;
  municipalityNumber: string | null;
  location: DiscoveryRegistryGeoPoint | null;
  distanceFromSearchCenterMeters: number | null;
  website: string | null;
  employeeCount: number | null;
  naceCode: string | null;
  naceDescription: string | null;
  registeredAt: string | null;
  registeredInVatRegister: boolean;
  registeredInBusinessRegister: boolean;
  status: "active" | "in_liquidation" | "bankrupt";
  sourceUri: string;
}

export interface DiscoveryRegistrySearchResult {
  candidates: DiscoveryRegistryCandidate[];
  pagesFetched: number;
  sourceResultsSeen: number;
  duplicateResultsSkipped: number;
  invalidResultsSkipped: number;
  geoFilteredResults: number;
  sourceLimitReached: boolean;
  hasMoreSourceResults: boolean;
  limitReason: "page_limit" | "external_request_limit" | "geocode_limit" | null;
  externalRequests: number;
  geocodeRequests: number;
  geocodeMisses: number;
  resolution: "nace" | "organization_name";
  resolvedNaceCodes: string[];
}

export type DiscoveryRegistryErrorCode =
  | "invalid_input"
  | "invalid_request"
  | "upstream_unavailable"
  | "timeout"
  | "network_error"
  | "invalid_response"
  | "area_resolution_failed"
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

export interface DiscoveryRegistryProviderDependencies {
  fetchImpl?: typeof fetch;
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
  maxResults: number;
  city: string | null;
  geo: DiscoveryRegistryGeoArea | null;
  signal?: AbortSignal;
}

interface NaceCode {
  code: string;
  name: string;
  level: number | null;
}

interface GeocodeCacheEntry {
  expiresAt: number;
  location: DiscoveryRegistryGeoPoint | null;
}

const geocodeCache = new Map<string, GeocodeCacheEntry>();

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
  const requestedMax = input.maxResults ?? 20;
  if (!Number.isInteger(requestedMax) || requestedMax < 1) {
    throw new DiscoveryRegistryError("invalid_input");
  }
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
  if (!city && !geo) throw new DiscoveryRegistryError("invalid_input");
  return {
    query,
    queryMode: input.queryMode ?? "industry",
    maxResults: Math.min(requestedMax, MAX_RESULTS),
    city,
    geo,
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

const QUERY_SYNONYMS: Record<string, string[]> = {
  advokat: ["juridiske tjenester", "advokatvirksomhet"],
  bilverksted: ["reparasjon av motorvogner", "vedlikehold av motorvogner"],
  bygg: ["bygging", "oppføring", "entreprenør"],
  castingbyrå: ["rekruttering", "formidling av arbeidskraft"],
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
  tannlege: ["tannhelsetjenester"],
};

function queryPhrases(query: string): string[] {
  const normalized = normalizeForSearch(query);
  const compact = normalized.replace(/\s+/g, "");
  const aliases = Object.entries(QUERY_SYNONYMS).flatMap(([key, values]) => {
    const normalizedKey = normalizeForSearch(key);
    return normalized.includes(normalizedKey) ||
      compact.includes(normalizedKey.replace(/\s+/g, ""))
      ? values
      : [];
  });
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
  const organizationForm = isRecord(value.organisasjonsform)
    ? (text(value.organisasjonsform.beskrivelse) ??
      text(value.organisasjonsform.kode))
    : null;
  const nace = isRecord(value.naeringskode1) ? value.naeringskode1 : {};
  const links = isRecord(value._links) ? value._links : {};
  const self = isRecord(links.self) ? links.self : {};
  const isBankrupt = value.konkurs === true;
  const isLiquidating =
    value.underAvvikling === true ||
    value.underTvangsavviklingEllerTvangsopplosning === true;
  return {
    organizationNumber,
    name,
    organizationForm,
    address: addressLines.length ? addressLines.join(", ") : null,
    postalCode: text(addressRecord.postnummer),
    city: text(addressRecord.poststed),
    municipality: text(addressRecord.kommune),
    municipalityNumber: text(addressRecord.kommunenummer),
    location: null,
    distanceFromSearchCenterMeters: null,
    website: text(value.hjemmeside),
    employeeCount: number(value.antallAnsatte),
    naceCode: text(nace.kode),
    naceDescription: text(nace.beskrivelse),
    registeredAt: text(value.registreringsdatoEnhetsregisteret),
    registeredInVatRegister: value.registrertIMvaregisteret === true,
    registeredInBusinessRegister: value.registrertIForetaksregisteret === true,
    status: isBankrupt
      ? "bankrupt"
      : isLiquidating
        ? "in_liquidation"
        : "active",
    sourceUri: normalizeSourceUri(self.href, organizationNumber),
  };
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
  let cachedNace: { expiresAt: number; codes: NaceCode[] } | null = null;

  function reserveExternalRequest(): void {
    if (externalRequests >= maxExternalRequests) {
      throw new DiscoveryRegistryError("external_request_limit");
    }
    externalRequests += 1;
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
      if (input.signal?.aborted) {
        throw new DiscoveryRegistryError("cancelled");
      }
      const [resolvedNaceCodes, municipalityNumbers] = await Promise.all([
        input.queryMode === "industry"
          ? naceCodes(input.query, input.signal)
          : Promise.resolve([]),
        input.geo
          ? municipalitiesForArea(input.geo, input.signal)
          : Promise.resolve([]),
      ]);
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
      let totalPages = 1;
      let limitReason: DiscoveryRegistrySearchResult["limitReason"] = null;

      pageLoop: for (
        let page = 0;
        page < totalPages &&
        page < MAX_BRREG_PAGES &&
        candidates.length < input.maxResults;
        page += 1
      ) {
        const url = new URL(BRREG_UNITS_ENDPOINT);
        url.searchParams.set(
          "size",
          String(Math.min(MAX_PAGE_SIZE, Math.max(20, input.maxResults * 2))),
        );
        url.searchParams.set("page", String(page));
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

        let response: ReturnType<typeof responseUnits>;
        try {
          response = responseUnits(await getJson(url, input.signal));
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
            break;
          }
          throw error;
        }
        pagesFetched += 1;
        sourceResultsSeen += response.units.length;
        totalPages = response.totalPages;
        const normalized = response.units.flatMap((value) => {
          const candidate = normalizeCandidate(value);
          if (!candidate) {
            invalidResultsSkipped += 1;
            return [];
          }
          if (seen.has(candidate.organizationNumber)) {
            duplicateResultsSkipped += 1;
            return [];
          }
          seen.add(candidate.organizationNumber);
          return [candidate];
        });

        const located: Array<DiscoveryRegistryCandidate | null> = [];
        if (input.geo) {
          for (const candidate of normalized) {
            try {
              const location = await geocode(candidate, input.signal);
              if (!location) {
                geocodeMisses += 1;
                located.push(null);
                continue;
              }
              const distance = distanceBetweenRegistryPoints(
                input.geo.center,
                location,
              );
              located.push(
                distance > input.geo.radiusMeters + 1
                  ? null
                  : {
                      ...candidate,
                      location,
                      distanceFromSearchCenterMeters: distance,
                    },
              );
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
                break;
              }
              throw error;
            }
          }
        } else {
          located.push(...normalized);
        }
        for (const candidate of located) {
          if (!candidate) {
            geoFilteredResults += 1;
            continue;
          }
          if (candidates.length < input.maxResults) candidates.push(candidate);
        }
        if (limitReason) break pageLoop;
      }

      if (
        !limitReason &&
        pagesFetched >= MAX_BRREG_PAGES &&
        pagesFetched < totalPages &&
        candidates.length < input.maxResults
      ) {
        limitReason = "page_limit";
      }

      return {
        candidates,
        pagesFetched,
        sourceResultsSeen,
        duplicateResultsSkipped,
        invalidResultsSkipped,
        geoFilteredResults,
        sourceLimitReached: limitReason !== null,
        hasMoreSourceResults: limitReason !== null || pagesFetched < totalPages,
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
