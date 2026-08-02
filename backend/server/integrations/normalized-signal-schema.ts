/**
 * normalized-signal-schema.ts
 *
 * NormalizedSignal — det felles skjemaet alle eksterne integrasjoner
 * konverteres til (docs/integration-audit/05 §2). Dashboard og AI leser fra
 * dette laget, aldri direkte fra leverandør-responser.
 *
 * Håndhevede regler fra oppdraget:
 *  - Tenancy obligatorisk (organizationId + workspaceId på hver rad).
 *  - Kildeopprinnelse (`sourceType`) er en lukket enum — «ikke-godkjent
 *    scraping» finnes ikke som verdi, så slike rader kan ikke konstrueres.
 *  - `unit` er påkrevd: relative Trends-indekser (relative_index) kan aldri
 *    forveksles med absolutte volum (searches_per_month).
 *  - `isEstimated`/freshness gjør Live/Cached/Estimated/Stale-merkene i UI
 *    beregnbare i stedet for hardkodede.
 */

import { z } from "zod";

export const SIGNAL_SOURCE_TYPES = [
  "official_api",
  "licensed_provider",
  "user_imported",
  "manual_upload",
  "public_data",
  // Egne systemdata (Leadgrid CRM won/lost, salgsdata) — førsteparts,
  // ikke eksternt API og ikke import. Bevisst utvidelse 2026-07-13.
  "first_party",
] as const;
export type SignalSourceType = (typeof SIGNAL_SOURCE_TYPES)[number];

export const SIGNAL_SUBJECT_TYPES = [
  "market",
  "competitor",
  "own_property",
  "keyword",
  "industry",
  "region",
] as const;

/** Lukket sett med enheter — utvid bevisst, aldri fritekst. */
export const SIGNAL_UNITS = [
  "relative_index",
  "searches_per_month",
  "count",
  "percent",
  "nok",
  "eur",
  "usd",
  "sessions",
  "clicks",
  "impressions",
  "seconds",
  "score",
] as const;

const GeographySchema = z.object({
  country: z.string().length(2).optional(),
  region: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
});

export const NormalizedSignalSchema = z
  .object({
    id: z.string().min(1),
    organizationId: z.string().min(1),
    workspaceId: z.string().min(1),
    projectId: z.string().min(1).optional(),

    provider: z.string().min(1),
    sourceType: z.enum(SIGNAL_SOURCE_TYPES),
    sourceRecordId: z.string().optional(),

    subjectType: z.enum(SIGNAL_SUBJECT_TYPES),
    subjectId: z.string().optional(),
    topic: z.string().min(1),

    metricType: z.string().min(1),
    metricValue: z.number().finite(),
    unit: z.enum(SIGNAL_UNITS),

    geography: GeographySchema.optional(),

    periodStart: z.string().datetime(),
    periodEnd: z.string().datetime(),

    confidence: z.number().min(0).max(1),
    sourceQuality: z.number().min(0).max(1),
    freshnessScore: z.number().min(0).max(1),

    isEstimated: z.boolean(),
    isNormalized: z.boolean(),

    collectedAt: z.string().datetime(),
    sourceUpdatedAt: z.string().datetime().optional(),

    metadata: z.record(z.string(), z.unknown()),
  })
  .refine(
    (s) => new Date(s.periodStart).getTime() <= new Date(s.periodEnd).getTime(),
    { message: "periodStart må være <= periodEnd", path: ["periodEnd"] },
  );

export type NormalizedSignal = z.infer<typeof NormalizedSignalSchema>;

export interface SignalValidationResult {
  valid: boolean;
  signal?: NormalizedSignal;
  errors?: string[];
}

export function validateNormalizedSignal(input: unknown): SignalValidationResult {
  const parsed = NormalizedSignalSchema.safeParse(input);
  if (parsed.success) return { valid: true, signal: parsed.data };
  return {
    valid: false,
    errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
  };
}

export type SignalDisplayStatus =
  | "live"
  | "cached"
  | "imported"
  | "estimated"
  | "stale"
  | "unavailable";

/**
 * Beregn UI-status-merket for et signal (Live/Cached/Imported/Estimated/
 * Stale) — «No Fake Integrations»: merket utledes av data, aldri hardkodes.
 *
 * @param staleThreshold  freshnessScore under denne → 'stale'
 * @param liveMaxAgeMs    alder (nå - collectedAt) under denne → 'live'
 */
export function signalDisplayStatus(
  signal: NormalizedSignal,
  opts: { now?: number; staleThreshold?: number; liveMaxAgeMs?: number } = {},
): SignalDisplayStatus {
  const { now = Date.now(), staleThreshold = 0.3, liveMaxAgeMs = 15 * 60 * 1000 } = opts;

  if (signal.isEstimated) return "estimated";
  if (signal.sourceType === "manual_upload" || signal.sourceType === "user_imported") {
    return "imported";
  }
  if (signal.freshnessScore < staleThreshold) return "stale";
  const age = now - new Date(signal.collectedAt).getTime();
  return age <= liveMaxAgeMs ? "live" : "cached";
}
