import { createHash } from "node:crypto";
import { z } from "zod";

export const DISCOVERY_MAX_RESULTS = 60;
export const DISCOVERY_MAX_RADIUS_KM = 50;

const nonEmpty = (maximum: number) => z.string().trim().min(1).max(maximum);

export const discoveryGeoSchema = z
  .object({
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
    radius_km: z.number().finite().min(1).max(DISCOVERY_MAX_RADIUS_KM),
  })
  .strict();

export const discoveryBriefSchema = z
  .object({
    industry_queries: z.array(nonEmpty(120)).min(1).max(8),
    exclusion_terms: z.array(nonEmpty(80)).max(30).default([]),
    city: nonEmpty(120).nullable().optional(),
    geo: discoveryGeoSchema.nullable().optional(),
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
  })
  .strict()
  .superRefine((brief, ctx) => {
    if (!brief.geo && !brief.city) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["geo"],
        message: "Velg et kartområde eller en by.",
      });
    }
    if (brief.enrichment_count > brief.target_count) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["enrichment_count"],
        message: "Antall som berikes kan ikke være høyere enn måltallet.",
      });
    }
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
  .strict();

export const discoveryDecisionSchema = z
  .object({
    decision: z.enum(["approve", "reject"]),
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
  queries: Array<{ text_query: string; hard_geo_filter: boolean }>;
  source: "brreg_open_data";
  requested_candidates: number;
  enrichment_candidates: number;
  estimated_search_pages: number;
  maximum_external_requests: 200;
  maximum_geocodes: 120;
  area: NonNullable<DiscoveryBrief["geo"]> | { city: string };
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
  const queries = brief.industry_queries.map((industry) => ({
    text_query: industry,
    hard_geo_filter: Boolean(brief.geo),
  }));
  const warnings: DiscoverySearchPlan["warnings"] = [];
  if (brief.industry_queries.length > 1) {
    warnings.push({
      code: "multi_query_budget",
      message:
        "Søkemålet fordeles mellom flere kundetyper og kan bruke flere registerkall.",
    });
  }
  return {
    version: 2,
    queries,
    source: "brreg_open_data",
    requested_candidates: brief.target_count,
    enrichment_candidates: brief.enrichment_count,
    // The preview reports the hard page ceiling, never a best-case estimate.
    estimated_search_pages: 3 * brief.industry_queries.length,
    maximum_external_requests: 200,
    maximum_geocodes: 120,
    area: brief.geo ?? { city: brief.city as string },
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
