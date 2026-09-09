import { createHash } from "node:crypto";
import { z } from "zod";

export const DISCOVERY_MAX_RESULTS = 60;
export const DISCOVERY_MAX_RADIUS_KM = 50;

const nonEmpty = (maximum: number) => z.string().trim().min(1).max(maximum);

const municipalityNumberSchema = z
  .string()
  .trim()
  .regex(/^\d{4}$/, "Kommunenummer må bestå av fire siffer.");

const organizationFormCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^[A-Z0-9]{2,8}$/,
    "Organisasjonsform må være en gyldig kode fra Brønnøysundregistrene.",
  );

const minimumEmployeeCountSchema = z
  .number()
  .int()
  .min(0)
  .max(1_000_000)
  .refine(
    (value) => value === 0 || value === 1 || value >= 5,
    "Minste antall ansatte må være 0, 1 eller minst 5 i Brønnøysundregistrenes API.",
  );

const maximumEmployeeCountSchema = z
  .number()
  .int()
  .min(0)
  .max(1_000_000)
  .refine(
    (value) => value === 0 || value === 4 || value >= 5,
    "Største antall ansatte må være 0, 4 eller minst 5 i Brønnøysundregistrenes API.",
  );

export const discoveryEmployeeCountSchema = z
  .object({
    minimum: minimumEmployeeCountSchema.nullable().default(null),
    maximum: maximumEmployeeCountSchema.nullable().default(null),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.minimum !== null &&
      value.maximum !== null &&
      value.minimum > value.maximum
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maximum"],
        message: "Største antall ansatte må være lik eller høyere enn minste.",
      });
    }
  });

export const discoveryCommercialSignalsSchema = z
  .object({
    registered_in_vat_register: z.boolean().nullable().default(null),
    registered_in_business_register: z.boolean().nullable().default(null),
  })
  .strict();

export const discoveryWebsiteQualitySchema = z
  .object({
    minimum_score: z.number().int().min(0).max(100).nullable().default(null),
  })
  .strict();

export const discoveryGeoSchema = z
  .object({
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
    radius_km: z.number().finite().min(1).max(DISCOVERY_MAX_RADIUS_KM),
  })
  .strict();

export const discoveryBriefSchema = z
  .object({
    industry_queries: z.array(nonEmpty(120)).max(8).default([]),
    organization_name_queries: z.array(nonEmpty(120)).max(8).default([]),
    exclusion_terms: z.array(nonEmpty(80)).max(30).default([]),
    country_code: z.literal("NO").nullable().optional(),
    city: nonEmpty(120).nullable().optional(),
    geo: discoveryGeoSchema.nullable().optional(),
    territory_code: z
      .string()
      .trim()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(48)
      .nullable()
      .optional(),
    municipality_numbers: z
      .array(municipalityNumberSchema)
      .max(30)
      .default([])
      .transform((values) => [...new Set(values)]),
    municipality_names: z
      .array(nonEmpty(120))
      .max(30)
      .default([])
      .transform((values) => [...new Set(values)]),
    target_count: z
      .number()
      .int()
      .min(1)
      .max(DISCOVERY_MAX_RESULTS)
      .default(20),
    enrichment_count: z
      .number()
      .int()
      .min(1)
      .max(DISCOVERY_MAX_RESULTS)
      .default(10),
    minimum_fit_score: z.number().int().min(0).max(100).default(50),
    ideal_customer: nonEmpty(1_500).nullable().optional(),
    goal: nonEmpty(500).nullable().optional(),
    organization_forms: z
      .array(organizationFormCodeSchema)
      .max(20)
      .default([])
      .transform((values) => [...new Set(values)].sort()),
    employee_count: discoveryEmployeeCountSchema.nullable().default(null),
    organization_structure: z
      .enum(["any", "independent", "chain"])
      .default("any"),
    website_requirement: z.enum(["any", "present", "missing"]).default("any"),
    website_quality: discoveryWebsiteQualitySchema.default({
      minimum_score: null,
    }),
    commercial_signals: discoveryCommercialSignalsSchema.default({
      registered_in_vat_register: null,
      registered_in_business_register: null,
    }),
  })
  .strict()
  .superRefine((brief, ctx) => {
    const queryCount =
      brief.industry_queries.length + brief.organization_name_queries.length;
    if (queryCount === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["industry_queries"],
        message: "Legg til minst ett bransje- eller organisasjonsnavn-søk.",
      });
    }
    if (queryCount > 8) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["organization_name_queries"],
        message: "En profil kan ha maksimalt åtte søk totalt.",
      });
    }
    const hasMunicipalities =
      brief.municipality_numbers.length > 0 ||
      brief.municipality_names.length > 0;
    if (
      brief.municipality_numbers.length + brief.municipality_names.length >
      30
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["municipality_numbers"],
        message: "En profil kan avgrenses til maksimalt 30 kommuner.",
      });
    }
    if (!brief.geo && !brief.city && !hasMunicipalities && !brief.country_code) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["geo"],
        message: "Velg hele Norge, et kartområde, en by eller minst én kommune.",
      });
    }
    const areaSelectors = [
      Boolean(brief.country_code),
      Boolean(brief.geo),
      Boolean(brief.city),
      hasMunicipalities,
    ].filter(Boolean).length;
    if (areaSelectors > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [hasMunicipalities ? "municipality_numbers" : "geo"],
        message:
          "Hele Norge, kommunevalg, by og kartområde er alternative geografiske avgrensninger.",
      });
    }
    if (brief.enrichment_count > brief.target_count) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["enrichment_count"],
        message:
          "Taket for registrerte nettsider som kan vurderes, kan ikke være høyere enn antall kandidater.",
      });
    }
    if (
      brief.website_requirement === "missing" &&
      brief.website_quality.minimum_score !== null
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["website_quality", "minimum_score"],
        message:
          "Nettsidekvalitet kan ikke kreves når profilen bare skal finne virksomheter uten registrert nettside.",
      });
    }
  })
  .transform((brief) => {
    const numbers = brief.municipality_numbers;
    const names = brief.municipality_names;
    // When the wire payload carries complete indexed pairs, canonicalize the
    // pair as one unit. Sorting the two arrays independently can silently turn
    // `Bærum | 3201` into the false pair `Asker | 3201` in editors.
    if (
      numbers.length > 0 &&
      numbers.length === names.length &&
      new Set(numbers).size === numbers.length &&
      new Set(names).size === names.length
    ) {
      const pairs = numbers
        .map((number, index) => ({ number, name: names[index] ?? "" }))
        .sort((left, right) => left.number.localeCompare(right.number));
      return {
        ...brief,
        municipality_numbers: pairs.map((pair) => pair.number),
        municipality_names: pairs.map((pair) => pair.name),
      };
    }
    return {
      ...brief,
      municipality_numbers: [...new Set(numbers)].sort(),
      municipality_names: [...new Set(names)].sort((left, right) =>
        left.localeCompare(right, "nb-NO"),
      ),
    };
  });

export type DiscoveryBrief = z.infer<typeof discoveryBriefSchema>;

export const discoveryPreviewSchema = z
  .object({ brief: discoveryBriefSchema })
  .strict();

export const discoveryRunCreateSchema = z
  .object({
    profile_id: z.string().uuid().nullable().optional(),
    expected_profile_version: z.number().int().positive().nullable().optional(),
    brief: discoveryBriefSchema,
    start_immediately: z.boolean().default(true),
    plan_hash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable()
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.profile_id && value.expected_profile_version == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expected_profile_version"],
        message:
          "Profilversjon er påkrevd når en Discovery-kjøring knyttes til en profil.",
      });
    }
    if (!value.profile_id && value.expected_profile_version != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["profile_id"],
        message: "Profil-ID er påkrevd når profilversjon oppgis.",
      });
    }
  });

export const discoveryDecisionSchema = z
  .object({
    decision: z.enum(["approve", "reject"]),
    confirmed_google_place_id: z
      .string()
      .trim()
      .min(1)
      .max(255)
      .regex(
        /^[^\s\x00-\x1F\x7F]+$/,
        "Google Place ID kan ikke inneholde mellomrom eller kontrolltegn.",
      )
      .nullable()
      .optional(),
    reason_code: z
      .enum([
        "good_fit",
        "wrong_customer_type",
        "outside_area",
        "competitor",
        "duplicate",
        "wrong_size",
        "insufficient_data",
        "not_relevant",
        "other",
      ])
      .nullable()
      .optional(),
    note: z.string().trim().max(1_000).nullable().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.decision === "reject" && !value.reason_code) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason_code"],
        message: "Velg hvorfor kandidaten avvises.",
      });
    }
    if (
      value.decision !== "approve" &&
      value.confirmed_google_place_id != null
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmed_google_place_id"],
        message:
          "Google Place ID kan bare bekreftes når kandidaten godkjennes.",
      });
    }
  });

export type DiscoveryDecision = z.infer<typeof discoveryDecisionSchema>;

export const discoveryFeedbackSchema = z
  .object({
    kind: z.enum(["quality", "correction", "outcome"]),
    reason_code: nonEmpty(80),
    note: z.string().trim().max(2_000).nullable().optional(),
    correction: z.record(z.unknown()).nullable().optional(),
    outcome: z.record(z.unknown()).nullable().optional(),
  })
  .strict();

export type DiscoveryFeedback = z.infer<typeof discoveryFeedbackSchema>;

export const discoveryCandidateQuerySchema = z.object({
  cursor: z.string().trim().min(1).max(500).optional(),
  disposition: z
    .enum(["pending", "approved", "rejected", "duplicate", "all"])
    .default("pending"),
  sort: z.enum(["score_desc", "newest"]).default("score_desc"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export interface DiscoverySearchPlan {
  version: 2;
  queries: Array<{
    text_query: string;
    query_mode: "industry" | "organization_name";
    hard_geo_filter: boolean;
  }>;
  source: "brreg_open_data";
  requested_candidates: number;
  enrichment_candidates: number;
  estimated_search_pages: number;
  maximum_external_requests: 200;
  maximum_geocodes: 120;
  area:
    | NonNullable<DiscoveryBrief["geo"]>
    | { country_code: "NO" }
    | { city: string }
    | {
        municipality_numbers: string[];
        municipality_names: string[];
      };
  territory_code: DiscoveryBrief["territory_code"];
  hard_company_filters: {
    organization_forms: string[];
    employee_count: DiscoveryBrief["employee_count"];
    website_requirement: DiscoveryBrief["website_requirement"];
    commercial_signals: DiscoveryBrief["commercial_signals"];
  };
  evidence_scored_filters: {
    organization_structure: DiscoveryBrief["organization_structure"];
    website_quality: {
      minimum_score: number | null;
      assessment: "safe_registered_url_crawl" | "not_requested";
      unknown_values_are_retained: true;
    };
    unknown_values_are_retained: true;
  };
  warnings: Array<{ code: string; message: string }>;
}

/** Stable JSON is used for plan hashes and idempotency conflict detection. */
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return (
      "{" +
      Object.keys(record)
        .sort()
        .map((key) => JSON.stringify(key) + ":" + stableJson(record[key]))
        .join(",") +
      "}"
    );
  }
  const serialized = JSON.stringify(value);
  return serialized ?? "null";
}

export function discoveryHash(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

export function buildDiscoverySearchPlan(
  brief: DiscoveryBrief,
): DiscoverySearchPlan {
  const hardGeoFilter =
    Boolean(brief.geo) ||
    brief.municipality_numbers.length > 0 ||
    brief.municipality_names.length > 0;
  const queries: DiscoverySearchPlan["queries"] = [
    ...brief.industry_queries.map((industry) => ({
      text_query: industry,
      query_mode: "industry" as const,
      hard_geo_filter: hardGeoFilter,
    })),
    ...brief.organization_name_queries.map((organizationName) => ({
      text_query: organizationName,
      query_mode: "organization_name" as const,
      hard_geo_filter: hardGeoFilter,
    })),
  ];
  const warnings: DiscoverySearchPlan["warnings"] = [];
  if (queries.length > 1) {
    warnings.push({
      code: "multi_query_budget",
      message:
        "Søkemålet fordeles mellom flere kundetyper og kan bruke flere registerkall.",
    });
  }
  if (brief.organization_structure !== "any") {
    warnings.push({
      code: "organization_structure_evidence_limited",
      message:
        "Brreg-konserntilknytning vurderes bare fra Brregs eksplisitte konsernstruktur. Dette dokumenterer ikke kommersiell kjede- eller franchisetilknytning, og uavklarte virksomheter beholdes for manuell vurdering.",
    });
  }
  if (brief.website_requirement !== "any") {
    warnings.push({
      code: "website_presence_registry_filter",
      message:
        "Nettsidekravet vurderer bare om Brønnøysundregistrene har en registrert nettadresse.",
    });
  }
  if (brief.website_quality.minimum_score !== null) {
    warnings.push({
      code: "website_quality_bounded_assessment",
      message: `Leadgrid kan vurdere maksimalt ${brief.enrichment_count} Brreg-registrerte nettsider per kjøring. Taket brukes bare når nettsidekvalitet er aktivert. Utilgjengelige eller utrygge nettsteder beholdes som ukjent for manuell vurdering.`,
    });
  }
  const area =
    brief.municipality_numbers.length > 0 || brief.municipality_names.length > 0
      ? {
          municipality_numbers: brief.municipality_numbers,
          municipality_names: brief.municipality_names,
        }
      : brief.geo ??
        (brief.city
          ? { city: brief.city }
          : { country_code: brief.country_code as "NO" });
  return {
    version: 2,
    queries,
    source: "brreg_open_data",
    requested_candidates: brief.target_count,
    enrichment_candidates: brief.enrichment_count,
    // The preview reports the hard page ceiling, never a best-case estimate.
    estimated_search_pages: 3 * queries.length,
    maximum_external_requests: 200,
    maximum_geocodes: 120,
    area,
    territory_code: brief.territory_code ?? null,
    hard_company_filters: {
      organization_forms: brief.organization_forms,
      employee_count: brief.employee_count,
      website_requirement: brief.website_requirement,
      commercial_signals: brief.commercial_signals,
    },
    evidence_scored_filters: {
      organization_structure: brief.organization_structure,
      website_quality: {
        minimum_score: brief.website_quality.minimum_score,
        assessment:
          brief.website_quality.minimum_score === null
            ? "not_requested"
            : "safe_registered_url_crawl",
        unknown_values_are_retained: true,
      },
      unknown_values_are_retained: true,
    },
    warnings,
  };
}

export interface DiscoveryApiErrorBody {
  error: {
    code: string;
    message: string;
    retryable: boolean;
    field?: string;
  };
}

export function discoveryApiError(
  code: string,
  message: string,
  retryable = false,
  field?: string,
): DiscoveryApiErrorBody {
  return {
    error: { code, message, retryable, ...(field ? { field } : {}) },
  };
}

export function parseIdempotencyKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const key = value.trim();
  return key.length >= 8 && key.length <= 200 ? key : null;
}

export function encodeDiscoveryCursor(
  score: number | null,
  id: string,
): string {
  return Buffer.from(JSON.stringify({ score, id }), "utf8").toString(
    "base64url",
  );
}

export function decodeDiscoveryCursor(
  value: string,
): { score: number | null; id: string } | null {
  try {
    const decoded = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as unknown;
    if (!decoded || typeof decoded !== "object") return null;
    const row = decoded as Record<string, unknown>;
    if (
      row.score !== null &&
      (typeof row.score !== "number" || !Number.isFinite(row.score))
    ) {
      return null;
    }
    if (
      typeof row.id !== "string" ||
      !z.string().uuid().safeParse(row.id).success
    ) {
      return null;
    }
    return { score: row.score as number | null, id: row.id };
  } catch {
    return null;
  }
}
