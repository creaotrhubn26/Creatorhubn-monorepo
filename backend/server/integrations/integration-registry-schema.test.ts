import { describe, expect, it } from "vitest";

import {
  type IntegrationRegistryEntry,
  isServable,
  resolveServableIntegration,
  validateIntegrationRegistryEntry,
} from "./integration-registry-schema.js";

function entry(overrides: Partial<IntegrationRegistryEntry> = {}): IntegrationRegistryEntry {
  return {
    integrationId: "ssb",
    provider: "Statistisk sentralbyrå",
    displayName: "SSB åpne API",
    category: "public_data",
    purpose: "Befolkning/inntekt per kommune for lead-beriking",
    supportedDataTypes: ["population", "median_income"],
    authenticationType: "none",
    credentialReference: null,
    apiBaseUrl: "https://data.ssb.no/api/v0",
    apiVersion: "v0",
    enabled: true,
    availabilityStatus: "active",
    implementationStatus: "active",
    accessLevel: "public",
    tenantScope: "shared",
    workspaceScope: "all",
    syncMode: "on_demand",
    syncFrequency: null,
    rateLimits: null,
    quotas: null,
    estimatedCost: null,
    termsStatus: "requiresAttribution",
    dataLicense: "NLOD",
    geographicCoverage: "NO",
    historicalCoverage: null,
    freshness: "monthly",
    healthStatus: "unknown",
    lastSuccessfulSync: null,
    lastFailedSync: null,
    failureReason: null,
    fallbackIntegrationId: null,
    documentationReference: "backend/server/lead-ssb-service.ts",
    owner: "daniel@creatorhubn.com",
    createdAt: "2026-07-10T00:00:00.000Z",
    updatedAt: "2026-07-10T00:00:00.000Z",
    ...overrides,
  };
}

describe("validateIntegrationRegistryEntry", () => {
  it("accepts a complete, valid entry", () => {
    const result = validateIntegrationRegistryEntry(entry());
    expect(result.valid).toBe(true);
    expect(result.entry?.integrationId).toBe("ssb");
  });

  it("rejects unknown status values (closed vocabulary)", () => {
    const result = validateIntegrationRegistryEntry(
      entry({ availabilityStatus: "kind_of_working" as never }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors?.join(" ")).toContain("availabilityStatus");
  });

  it("rejects non-kebab-case integration ids", () => {
    const result = validateIntegrationRegistryEntry(entry({ integrationId: "SSB API!" }));
    expect(result.valid).toBe(false);
  });

  it("requires at least one supported data type", () => {
    const result = validateIntegrationRegistryEntry(entry({ supportedDataTypes: [] }));
    expect(result.valid).toBe(false);
  });
});

describe("isServable", () => {
  it("is true for enabled+active and enabled+degraded", () => {
    expect(isServable(entry())).toBe(true);
    expect(isServable(entry({ availabilityStatus: "degraded" }))).toBe(true);
  });

  it("is false when disabled or in any non-servable status", () => {
    expect(isServable(entry({ enabled: false }))).toBe(false);
    for (const status of ["missingCredentials", "awaitingApproval", "unavailable", "rejected"] as const) {
      expect(isServable(entry({ availabilityStatus: status }))).toBe(false);
    }
  });
});

describe("resolveServableIntegration", () => {
  it("follows the fallback chain to the first servable entry", () => {
    const registry = new Map([
      [
        "google-trends-alpha",
        entry({
          integrationId: "google-trends-alpha",
          availabilityStatus: "awaitingApproval",
          fallbackIntegrationId: "manual-trend-import",
        }),
      ],
      ["manual-trend-import", entry({ integrationId: "manual-trend-import" })],
    ]);
    const resolved = resolveServableIntegration(registry, "google-trends-alpha");
    expect(resolved?.integrationId).toBe("manual-trend-import");
  });

  it("returns null when nothing in the chain is servable", () => {
    const registry = new Map([
      [
        "a",
        entry({ integrationId: "a", availabilityStatus: "unavailable", fallbackIntegrationId: "b" }),
      ],
      ["b", entry({ integrationId: "b", enabled: false, fallbackIntegrationId: null })],
    ]);
    expect(resolveServableIntegration(registry, "a")).toBeNull();
  });

  it("terminates on cyclic fallback chains", () => {
    const registry = new Map([
      [
        "a",
        entry({ integrationId: "a", availabilityStatus: "unavailable", fallbackIntegrationId: "b" }),
      ],
      [
        "b",
        entry({ integrationId: "b", availabilityStatus: "unavailable", fallbackIntegrationId: "a" }),
      ],
    ]);
    expect(resolveServableIntegration(registry, "a")).toBeNull();
  });
});
