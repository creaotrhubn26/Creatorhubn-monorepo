/**
 * integration-registry-schema.ts
 *
 * Integration Registry-kontrakten fra integrasjonsanalysen
 * (docs/integration-audit/, oppdragets §1): ett skjema for alle
 * integrasjonsoppføringer, med de påkrevde feltene og status-vokabularet.
 *
 * v1 er kodedrevet: registry-oppføringer skrives som objekter og valideres
 * mot dette skjemaet (se docs/integration-audit/06 — Implementation Plan
 * steg 2). DB-tabellen genereres fra samme skjema når Admin Integration
 * Center trenger skriveoperasjoner, så kode og tabell ikke divergerer.
 *
 * Regel «No Fake Integrations»: `availabilityStatus`/`implementationStatus`
 * er lukkede enums — en integrasjon kan ikke presenteres som aktiv uten at
 * registeret sier `active`/`degraded`.
 */

import { z } from "zod";

export const INTEGRATION_STATUSES = [
  "discovered",
  "configured",
  "connected",
  "partiallyImplemented",
  "active",
  "degraded",
  "unavailable",
  "awaitingApproval",
  "missingCredentials",
  "disabled",
  "deprecated",
  "rejected",
] as const;
export type IntegrationStatus = (typeof INTEGRATION_STATUSES)[number];

export const INTEGRATION_CATEGORIES = [
  "search_demand",
  "public_data",
  "business_intelligence",
  "reviews",
  "owned_marketing",
  "crm",
  "ai",
  "communication",
  "infrastructure",
  "geo",
] as const;
export type IntegrationCategory = (typeof INTEGRATION_CATEGORIES)[number];

export const AUTHENTICATION_TYPES = [
  "none",
  "api_key",
  "oauth2_app",
  "oauth2_user",
  "oauth2_user_plus_developer_token",
  "basic",
  "service_account",
] as const;

export const SYNC_MODES = ["on_demand", "scheduled", "webhook", "manual_import"] as const;

export const TERMS_STATUSES = [
  "ok",
  "requiresAttribution",
  "requiresLicensedProvider",
  "requiresReview",
  "prohibited",
] as const;

export const IntegrationRegistryEntrySchema = z.object({
  integrationId: z
    .string()
    .min(1)
    .regex(/^[a-z0-9][a-z0-9-]*$/, "kebab-case id"),
  provider: z.string().min(1),
  displayName: z.string().min(1),
  category: z.enum(INTEGRATION_CATEGORIES),
  purpose: z.string().min(1),
  supportedDataTypes: z.array(z.string().min(1)).min(1),

  authenticationType: z.enum(AUTHENTICATION_TYPES),
  /**
   * Navn på env-var eller token-lagringsmekanisme — ALDRI selve verdien.
   * null = ingen credential nødvendig (åpne APIer som SSB/Brreg).
   */
  credentialReference: z.string().min(1).nullable(),

  apiBaseUrl: z.string().url().nullable(),
  apiVersion: z.string().nullable(),

  enabled: z.boolean(),
  availabilityStatus: z.enum(INTEGRATION_STATUSES),
  implementationStatus: z.enum(INTEGRATION_STATUSES),
  accessLevel: z.enum(["public", "user_granted", "app_granted", "licensed"]),

  /** 'shared' = markedsdata (cachebar på tvers), 'per_org' = brukerens egne data. */
  tenantScope: z.enum(["shared", "per_org"]),
  workspaceScope: z.enum(["all", "per_workspace"]).default("all"),

  syncMode: z.enum(SYNC_MODES),
  /** Menneskelesbar frekvens ('hourly', 'daily 06:00 UTC', 'on_demand'). */
  syncFrequency: z.string().nullable(),

  rateLimits: z.string().nullable(),
  quotas: z.string().nullable(),
  /** Fylles av kost-tellere når de finnes — aldri statiske gjetninger. */
  estimatedCost: z.string().nullable(),

  termsStatus: z.enum(TERMS_STATUSES),
  dataLicense: z.string().nullable(),
  geographicCoverage: z.string().nullable(),
  historicalCoverage: z.string().nullable(),
  freshness: z.string().nullable(),

  healthStatus: z.enum(["healthy", "degraded", "down", "unknown"]).default("unknown"),
  lastSuccessfulSync: z.string().datetime().nullable(),
  lastFailedSync: z.string().datetime().nullable(),
  failureReason: z.string().nullable(),

  fallbackIntegrationId: z.string().nullable(),
  documentationReference: z.string().min(1),
  owner: z.string().min(1),

  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type IntegrationRegistryEntry = z.infer<typeof IntegrationRegistryEntrySchema>;

export interface RegistryValidationResult {
  valid: boolean;
  entry?: IntegrationRegistryEntry;
  errors?: string[];
}

export function validateIntegrationRegistryEntry(input: unknown): RegistryValidationResult {
  const parsed = IntegrationRegistryEntrySchema.safeParse(input);
  if (parsed.success) return { valid: true, entry: parsed.data };
  return {
    valid: false,
    errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
  };
}

/**
 * Kan integrasjonen presenteres som datakilde i UI uten
 * degradert/utilgjengelig-merke? (Jf. «No Fake Integrations».)
 */
export function isServable(entry: IntegrationRegistryEntry): boolean {
  return entry.enabled && (entry.availabilityStatus === "active" || entry.availabilityStatus === "degraded");
}

/**
 * Følg fallback-kjeden til første servable integrasjon. Returnerer null
 * hvis ingen i kjeden kan serveres (widget skal da vise 'Unavailable').
 * Beskyttet mot sykliske kjeder.
 */
export function resolveServableIntegration(
  registry: Map<string, IntegrationRegistryEntry>,
  integrationId: string,
): IntegrationRegistryEntry | null {
  const seen = new Set<string>();
  let currentId: string | null = integrationId;
  while (currentId && !seen.has(currentId)) {
    seen.add(currentId);
    const entry = registry.get(currentId);
    if (!entry) return null;
    if (isServable(entry)) return entry;
    currentId = entry.fallbackIntegrationId;
  }
  return null;
}
