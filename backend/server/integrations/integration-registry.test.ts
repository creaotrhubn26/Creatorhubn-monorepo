import { describe, expect, it } from "vitest";

import {
  INTEGRATION_REGISTRY_ENTRIES,
  getIntegrationRegistry,
} from "./integration-registry.js";
import {
  isServable,
  resolveServableIntegration,
  validateIntegrationRegistryEntry,
} from "./integration-registry-schema.js";

describe("integration-registry (kodedrevet konfig)", () => {
  it("every entry validates against the schema", () => {
    for (const e of INTEGRATION_REGISTRY_ENTRIES) {
      const result = validateIntegrationRegistryEntry(e);
      expect(result.errors, `oppføring ${e.integrationId}`).toBeUndefined();
      expect(result.valid).toBe(true);
    }
  });

  it("builds a map with unique ids and resolvable fallbacks (throws otherwise)", () => {
    const registry = getIntegrationRegistry();
    expect(registry.size).toBe(INTEGRATION_REGISTRY_ENTRIES.length);
  });

  it("never exposes credential VALUES — references are names/descriptions only", () => {
    for (const e of INTEGRATION_REGISTRY_ENTRIES) {
      if (e.credentialReference) {
        // Grov heuristikk: ingen ting som ser ut som nøkkelmateriale
        expect(e.credentialReference).not.toMatch(/sk-|rnd_|AIza|Bearer\s+\S{20}/);
      }
    }
  });

  it("reflects the verified reality: reddit/cohere missingCredentials, trends rejected", () => {
    const registry = getIntegrationRegistry();
    expect(registry.get("reddit")?.availabilityStatus).toBe("missingCredentials");
    expect(registry.get("cohere")?.availabilityStatus).toBe("missingCredentials");
    expect(registry.get("google-trends-alpha")?.availabilityStatus).toBe("rejected");
    expect(registry.get("ssb")?.availabilityStatus).toBe("active");
  });

  it("no unbuilt/unavailable integration is servable (No Fake Integrations)", () => {
    const registry = getIntegrationRegistry();
    // keyword-planner: implementert men 'configured' til første prod-oppslag;
    // trends-alpha: rejected; reddit/cohere: missingCredentials
    for (const id of ["google-trends-alpha", "google-ads-keyword-planner", "reddit", "cohere"]) {
      const e = registry.get(id);
      expect(e, id).toBeDefined();
      expect(isServable(e!), `${id} skal ikke være servable`).toBe(false);
    }
  });

  it("trends fallback chain resolves to manual-trend-import (bygget 2026-07-11)", () => {
    const registry = getIntegrationRegistry();
    // alpha (rejected) → keyword-planner (configured) → manual-import (active)
    const resolved = resolveServableIntegration(registry, "google-trends-alpha");
    expect(resolved?.integrationId).toBe("manual-trend-import");
  });

  it("active integrations are servable", () => {
    const registry = getIntegrationRegistry();
    for (const id of ["ssb", "brreg", "google-search-console", "ga4-data-api", "anthropic"]) {
      expect(isServable(registry.get(id)!), id).toBe(true);
    }
  });
});
