import { createHash, randomUUID } from "node:crypto";

import jwt from "jsonwebtoken";
import { z } from "zod";

import {
  DiscoveryRegistryError,
  type DiscoveryRegistryCandidate,
  type DiscoveryRegistrySearchInput,
  type DiscoveryRegistrySearchResult,
} from "./leadgrid-discovery-brreg-provider.js";

const FLR_SCOPE = "nhn:flr/export";
const FLR_CONTRACTS_PATH = "/v1/contracts";
const MAX_RESPONSE_BYTES = 50 * 1_024 * 1_024;
const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_RETRIES = 2;

export const FLR_ENDPOINTS = {
  test: {
    apiBaseUrl: "https://api.offentlig.test.flr.nhn.no",
    tokenUrl: "https://test.maskinporten.no/token",
  },
  production: {
    apiBaseUrl: "https://api.offentlig.flr.nhn.no",
    tokenUrl: "https://maskinporten.no/token",
  },
} as const;

export const NHN_FLR_DATA_SOURCE = {
  id: "nhn_flr_public",
  provider: "Norsk helsenett – Fastlegeregisteret offentlig",
  providerUri:
    "https://utviklerportal.nhn.no/informasjonstjenester/fastlegeregisteret/fastlegeregisteret-offentlig/fastlegeregisteret-offentlig-api/docs/flr-offentlig-apimd",
  license: "Avtalebasert tilgang",
  licenseUri:
    "https://utviklerportal.nhn.no/informasjonstjenester/fastlegeregisteret/fastlegeregisteret-offentlig/fastlegeregisteret-offentlig-api/docs/flr-offentlig-apimd",
  notice:
    "Kontor- og avtaledata er hentet fra Fastlegeregisterets offentlige API med godkjent Maskinporten-tilgang. Gjenbruksvilkår må være avklart før produksjonsaktivering.",
} as const;

const codeSchema = z
  .object({
    value: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
  })
  .passthrough();

const periodSchema = z
  .object({
    from: z.string().optional(),
    to: z.string().nullable().optional(),
  })
  .passthrough();

const addressSchema = z
  .object({
    streetAddress: z.string().nullable().optional(),
    postalCode: z.number().int().nullable().optional(),
    city: z.string().nullable().optional(),
    municipality: codeSchema.nullable().optional(),
    postalBox: z.string().nullable().optional(),
    addressType: codeSchema.nullable().optional(),
  })
  .passthrough();

const personnelSchema = z
  .object({
    hprNumber: z.number().int().positive().optional(),
    firstName: z.string().nullable().optional(),
    middleName: z.string().nullable().optional(),
    lastName: z.string().nullable().optional(),
  })
  .passthrough();

const doctorCycleSchema = z
  .object({
    id: z.number().int().positive().optional(),
    doctor: personnelSchema.nullable().optional(),
    period: periodSchema.nullable().optional(),
  })
  .passthrough();

const officeSchema = z
  .object({
    organizationNumber: z.number().int().positive(),
    legalName: z.string().nullable().optional(),
    displayName: z.string().nullable().optional(),
    phoneNumber: z.string().nullable().optional(),
    isGroupOffice: z.boolean().optional(),
    addresses: z.array(addressSchema).nullable().optional(),
    municipality: codeSchema.nullable().optional(),
  })
  .passthrough();

const contractSchema = z
  .object({
    id: z.number().int().positive().optional(),
    office: officeSchema,
    period: periodSchema.nullable().optional(),
    doctorCycles: z.array(doctorCycleSchema).nullable().optional(),
    municipality: codeSchema.nullable().optional(),
  })
  .passthrough();

const contractsSchema = z.array(contractSchema);
const tokenResponseSchema = z
  .object({
    access_token: z.string().min(20),
    token_type: z.string().optional(),
    expires_in: z.number().int().positive().max(86_400).default(120),
  })
  .passthrough();

type FlrContract = z.infer<typeof contractSchema>;

interface FlrEnvironment {
  LEADGRID_DISCOVERY_FLR_ENABLED?: string;
  LEADGRID_FLR_ENVIRONMENT?: string;
  LEADGRID_FLR_MASKINPORTEN_CLIENT_ID?: string;
  LEADGRID_FLR_MASKINPORTEN_KEY_ID?: string;
  LEADGRID_FLR_MASKINPORTEN_PRIVATE_KEY?: string;
}

export interface DiscoveryFlrProviderDependencies {
  fetchImpl?: typeof fetch;
  env?: FlrEnvironment;
  now?: () => Date;
  sleep?: (milliseconds: number) => Promise<void>;
  accessTokenProvider?: () => Promise<string>;
  beforeContractsRequest?: () => Promise<void>;
  timeoutMs?: number;
}

let nextFlrRequestAt = 0;
let flrRequestGate = Promise.resolve();

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForSharedFlrRequestSlot(): Promise<void> {
  const previous = flrRequestGate;
  let release: () => void = () => {};
  flrRequestGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    const delay = Math.max(0, nextFlrRequestAt - Date.now());
    if (delay > 0) await sleep(delay);
    // NHN documents ten requests per ten seconds. One request per second keeps
    // concurrent workers safely inside that shared process budget.
    nextFlrRequestAt = Date.now() + 1_000;
  } finally {
    release();
  }
}

function normalizedPrivateKey(value: string): string {
  return value.includes("\\n") ? value.replaceAll("\\n", "\n") : value;
}

function environmentConfig(env: FlrEnvironment): {
  endpoint: (typeof FLR_ENDPOINTS)[keyof typeof FLR_ENDPOINTS];
  clientId: string;
  keyId: string;
  privateKey: string;
} {
  if (env.LEADGRID_DISCOVERY_FLR_ENABLED !== "true") {
    throw new DiscoveryRegistryError("upstream_unavailable", {
      retryable: false,
    });
  }
  const environment =
    env.LEADGRID_FLR_ENVIRONMENT === "production" ? "production" : "test";
  const clientId = env.LEADGRID_FLR_MASKINPORTEN_CLIENT_ID?.trim() ?? "";
  const keyId = env.LEADGRID_FLR_MASKINPORTEN_KEY_ID?.trim() ?? "";
  const privateKey = normalizedPrivateKey(
    env.LEADGRID_FLR_MASKINPORTEN_PRIVATE_KEY ?? "",
  ).trim();
  if (!clientId || !keyId || !privateKey) {
    throw new DiscoveryRegistryError("upstream_unavailable", {
      retryable: false,
    });
  }
  return { endpoint: FLR_ENDPOINTS[environment], clientId, keyId, privateKey };
}

function activePeriod(
  period: z.infer<typeof periodSchema> | null | undefined,
  now: Date,
): boolean {
  if (!period) return true;
  const from = period.from ? Date.parse(period.from) : Number.NaN;
  const to = period.to ? Date.parse(period.to) : Number.NaN;
  if (Number.isFinite(from) && from > now.valueOf()) return false;
  return !Number.isFinite(to) || to >= now.valueOf();
}

function cleanText(value: unknown, maximum = 240): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized ? normalized.slice(0, maximum) : null;
}

function organizationNumber(value: number): string | null {
  const normalized = String(value);
  return /^\d{9}$/.test(normalized) ? normalized : null;
}

function postalCode(value: number | null | undefined): string | null {
  if (!Number.isInteger(value) || value == null || value < 0 || value > 9_999) {
    return null;
  }
  return String(value).padStart(4, "0");
}

function doctorName(doctor: z.infer<typeof personnelSchema>): string | null {
  return (
    [doctor.firstName, doctor.middleName, doctor.lastName]
      .map((part) => cleanText(part, 100))
      .filter((part): part is string => Boolean(part))
      .join(" ") || null
  );
}

function contactReference(
  organization: string,
  stableDoctorKey: string,
): string {
  return createHash("sha256")
    .update(`nhn_flr_public:${organization}:${stableDoctorKey}`)
    .digest("hex");
}

function selectAddress(office: z.infer<typeof officeSchema>) {
  return (
    (office.addresses ?? []).find(
      (address) => cleanText(address.streetAddress) !== null,
    ) ??
    (office.addresses ?? [])[0] ??
    null
  );
}

function contractMunicipality(contract: FlrContract): {
  number: string | null;
  name: string | null;
} {
  const value = cleanText(
    contract.office.municipality?.value ?? contract.municipality?.value,
    8,
  );
  return {
    number: value && /^\d{4}$/.test(value) ? value : null,
    name: cleanText(
      contract.office.municipality?.name ?? contract.municipality?.name,
      120,
    ),
  };
}

function matchesArea(
  contract: FlrContract,
  input: DiscoveryRegistrySearchInput,
): boolean {
  const municipality = contractMunicipality(contract);
  if (
    input.municipalityNumbers?.length &&
    (!municipality.number ||
      !input.municipalityNumbers.includes(municipality.number))
  ) {
    return false;
  }
  if (input.municipalityNames?.length) {
    const expected = new Set(
      input.municipalityNames.map((name) => name.toLocaleLowerCase("nb-NO")),
    );
    if (
      !municipality.name ||
      !expected.has(municipality.name.toLocaleLowerCase("nb-NO"))
    ) {
      return false;
    }
  }
  if (input.city) {
    const address = selectAddress(contract.office);
    if (
      cleanText(address?.city)?.toLocaleLowerCase("nb-NO") !==
      input.city.trim().toLocaleLowerCase("nb-NO")
    ) {
      return false;
    }
  }
  return true;
}

function normalizeContracts(
  contracts: FlrContract[],
  input: DiscoveryRegistrySearchInput,
  now: Date,
  sourceUri: string,
): DiscoveryRegistryCandidate[] {
  const byOrganization = new Map<string, FlrContract[]>();
  for (const contract of contracts) {
    if (!activePeriod(contract.period, now) || !matchesArea(contract, input))
      continue;
    const orgNumber = organizationNumber(contract.office.organizationNumber);
    if (!orgNumber) continue;
    const existing = byOrganization.get(orgNumber) ?? [];
    existing.push(contract);
    byOrganization.set(orgNumber, existing);
  }

  return [...byOrganization.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([orgNumber, officeContracts]) => {
      const representative = officeContracts[0] as FlrContract;
      const office = representative.office;
      const address = selectAddress(office);
      const municipality = contractMunicipality(representative);
      const practitioners = new Map<
        string,
        { name: string; role: "Fastlege"; sourceReference: string }
      >();
      for (const contract of officeContracts) {
        for (const cycle of contract.doctorCycles ?? []) {
          if (!cycle.doctor || !activePeriod(cycle.period, now)) continue;
          const name = doctorName(cycle.doctor);
          if (!name) continue;
          const stableKey = cycle.doctor.hprNumber
            ? `hpr:${cycle.doctor.hprNumber}`
            : cycle.id
              ? `cycle:${cycle.id}`
              : `name:${name.toLocaleLowerCase("nb-NO")}`;
          const sourceReference = contactReference(orgNumber, stableKey);
          practitioners.set(sourceReference, {
            name,
            role: "Fastlege",
            sourceReference,
          });
        }
      }
      const streetAddress = cleanText(address?.streetAddress);
      return {
        source: "nhn_flr_public",
        sourceLicense: NHN_FLR_DATA_SOURCE.license,
        organizationNumber: orgNumber,
        name:
          cleanText(office.displayName) ??
          cleanText(office.legalName) ??
          `Fastlegekontor ${orgNumber}`,
        organizationForm: null,
        organizationFormCode: null,
        organizationFormDescription: null,
        address: streetAddress,
        postalCode: postalCode(address?.postalCode),
        city: cleanText(address?.city, 120),
        municipality: municipality.name,
        municipalityNumber: municipality.number,
        location: null,
        distanceFromSearchCenterMeters: null,
        website: null,
        phone: cleanText(office.phoneNumber, 64),
        employeeCount: null,
        hasRegisteredEmployeeCount: false,
        naceCode: "86.210",
        naceDescription: "Allmenn legetjeneste",
        registeredAt: null,
        registeredInVatRegister: null,
        registeredInBusinessRegister: null,
        registeredInVatRegisterKnown: false,
        registeredInBusinessRegisterKnown: false,
        organizationStructure: "unknown",
        organizationStructureEvidence: null,
        websiteQuality: undefined,
        status: "active",
        sourceUri,
        providerContacts: [...practitioners.values()].sort((left, right) =>
          left.name.localeCompare(right.name, "nb-NO"),
        ),
        entityClassification: {
          kind: "clinic",
          confidence: "high",
          evidence: [
            "nhn_flr_active_office",
            office.isGroupOffice ? "nhn_flr_group_office" : "nhn_flr_office",
          ],
          normalizedLocationKey: null,
        },
      } satisfies DiscoveryRegistryCandidate;
    });
}

async function responseJson(response: Response): Promise<unknown> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw new DiscoveryRegistryError("invalid_response");
  }
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_RESPONSE_BYTES) {
    throw new DiscoveryRegistryError("invalid_response");
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new DiscoveryRegistryError("invalid_response");
  }
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const upstreamSignal = init.signal;
  const abort = () => controller.abort();
  upstreamSignal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (upstreamSignal?.aborted) {
      throw new DiscoveryRegistryError("cancelled");
    }
    if (controller.signal.aborted) {
      throw new DiscoveryRegistryError("timeout", { retryable: true });
    }
    throw new DiscoveryRegistryError("network_error", { retryable: true });
  } finally {
    clearTimeout(timer);
    upstreamSignal?.removeEventListener("abort", abort);
  }
}

export function createDiscoveryFlrProvider(
  dependencies: DiscoveryFlrProviderDependencies = {},
): {
  search: (
    input: DiscoveryRegistrySearchInput,
  ) => Promise<DiscoveryRegistrySearchResult>;
} {
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const env: FlrEnvironment =
    dependencies.env ?? (process.env as FlrEnvironment);
  const now = dependencies.now ?? (() => new Date());
  const wait = dependencies.sleep ?? sleep;
  const timeoutMs = dependencies.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let cachedToken: { value: string; expiresAt: number } | null = null;

  const accessToken = async (): Promise<string> => {
    if (dependencies.accessTokenProvider)
      return dependencies.accessTokenProvider();
    const config = environmentConfig(env);
    if (cachedToken && cachedToken.expiresAt - 30_000 > now().valueOf()) {
      return cachedToken.value;
    }
    const issuedAt = Math.floor(now().valueOf() / 1_000);
    let assertion: string;
    try {
      assertion = jwt.sign(
        {
          aud: config.endpoint.tokenUrl,
          iss: config.clientId,
          scope: FLR_SCOPE,
          iat: issuedAt,
          exp: issuedAt + 120,
          jti: randomUUID(),
        },
        config.privateKey,
        { algorithm: "RS256", keyid: config.keyId },
      );
    } catch {
      throw new DiscoveryRegistryError("upstream_unavailable", {
        retryable: false,
      });
    }
    const response = await fetchWithTimeout(
      fetchImpl,
      config.endpoint.tokenUrl,
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion,
        }),
      },
      timeoutMs,
    );
    if (!response.ok) {
      throw new DiscoveryRegistryError("upstream_unavailable", {
        retryable: response.status >= 500 || response.status === 429,
        httpStatus: response.status,
      });
    }
    const parsed = tokenResponseSchema.safeParse(await responseJson(response));
    if (!parsed.success) throw new DiscoveryRegistryError("invalid_response");
    cachedToken = {
      value: parsed.data.access_token,
      expiresAt: now().valueOf() + parsed.data.expires_in * 1_000,
    };
    return cachedToken.value;
  };

  return {
    async search(input): Promise<DiscoveryRegistrySearchResult> {
      if (input.signal?.aborted) throw new DiscoveryRegistryError("cancelled");
      if (input.countryCode && input.countryCode !== "NO") {
        throw new DiscoveryRegistryError("invalid_input");
      }
      if (input.geo) {
        throw new DiscoveryRegistryError("invalid_input");
      }
      const configured = dependencies.accessTokenProvider
        ? {
            endpoint:
              env.LEADGRID_FLR_ENVIRONMENT === "production"
                ? FLR_ENDPOINTS.production
                : FLR_ENDPOINTS.test,
          }
        : environmentConfig(env);
      let token = await accessToken();
      const sourceUri = `${configured.endpoint.apiBaseUrl}${FLR_CONTRACTS_PATH}`;
      let response: Response | null = null;
      let refreshedRejectedToken = false;
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
        await (
          dependencies.beforeContractsRequest ?? waitForSharedFlrRequestSlot
        )();
        response = await fetchWithTimeout(
          fetchImpl,
          sourceUri,
          {
            method: "GET",
            headers: {
              accept: "application/json",
              authorization: `Bearer ${token}`,
            },
            signal: input.signal,
          },
          timeoutMs,
        );
        if (response.ok) break;
        if (
          response.status === 401 &&
          !dependencies.accessTokenProvider &&
          !refreshedRejectedToken
        ) {
          refreshedRejectedToken = true;
          cachedToken = null;
          token = await accessToken();
          continue;
        }
        const retryable = response.status === 429 || response.status === 503;
        if (!retryable || attempt === MAX_RETRIES) {
          throw new DiscoveryRegistryError("upstream_unavailable", {
            retryable,
            httpStatus: response.status,
          });
        }
        const retryAfterSeconds = Number(response.headers.get("retry-after"));
        await wait(
          Number.isFinite(retryAfterSeconds)
            ? Math.min(2_000, Math.max(0, retryAfterSeconds * 1_000))
            : 250 * 2 ** attempt,
        );
      }
      if (!response?.ok) {
        throw new DiscoveryRegistryError("upstream_unavailable", {
          retryable: true,
        });
      }
      const parsed = contractsSchema.safeParse(await responseJson(response));
      if (!parsed.success) throw new DiscoveryRegistryError("invalid_response");
      const normalized = normalizeContracts(
        parsed.data,
        input,
        now(),
        sourceUri,
      );
      const start = Math.max(0, input.sourceOffset ?? 0);
      const limit = Math.min(60, Math.max(1, input.maxResults ?? 60));
      const candidates = normalized.slice(start, start + limit);
      const next = start + candidates.length;
      return {
        candidates,
        sourceOffsetStart: start,
        sourceOffsetNext: next,
        sourcePageStart: 0,
        sourcePageNext: next < normalized.length ? 1 : 0,
        sourcePageCount: 1,
        pagesFetched: 1,
        sourceResultsSeen: parsed.data.length,
        duplicateResultsSkipped: Math.max(
          0,
          parsed.data.length - normalized.length,
        ),
        invalidResultsSkipped: 0,
        geoFilteredResults: 0,
        companyFilteredResults: 0,
        websiteAssessmentCandidates: 0,
        websiteAssessmentRequests: 0,
        sourceLimitReached: false,
        hasMoreSourceResults: next < normalized.length,
        limitReason: null,
        externalRequests: 1,
        geocodeRequests: 0,
        geocodeMisses: 0,
        resolution: "nace",
        resolvedNaceCodes: ["86.210"],
        resolvedMunicipalities: [],
      };
    },
  };
}
