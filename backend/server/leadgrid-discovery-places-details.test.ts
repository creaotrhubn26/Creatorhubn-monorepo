import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";

import {
  __test,
  classifyDiscoveryPlaceMatch,
  DiscoveryPlacesDetailsError,
  fetchTransientDiscoveryPlaceDetails,
} from "./leadgrid-discovery-places-details.js";

const project = {
  id: "project-a",
  organizationId: "11111111-1111-4111-8111-111111111111",
  name: "Project A",
  description: null,
  industry: null,
  status: "active",
  createdBy: "user-a",
  memberRole: "owner",
};
const runId = "22222222-2222-4222-8222-222222222222";
const candidateId = "33333333-3333-4333-8333-333333333333";

function candidate(overrides: Record<string, unknown> = {}) {
  return {
    id: candidateId,
    name: "Leadgrid AS",
    address: "Storgata 1",
    city: "Oslo",
    postal_code: "0155",
    latitude: "59.9127",
    longitude: "10.7461",
    profile_id: "44444444-4444-4444-8444-444444444444",
    source_config: {
      brreg_open_data: { enabled: true },
      google_places: { enabled: true, mode: "transient_details_only" },
    },
    ...overrides,
  };
}

function poolFor(row: Record<string, unknown> | undefined) {
  const query = vi.fn(async () => ({ rows: row ? [row] : [] }));
  return { pool: { query } as unknown as Pool, query };
}

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("transient Discovery Google Maps details", () => {
  it("is tenant scoped and does not contact Google for a missing candidate", async () => {
    const { pool, query } = poolFor(undefined);
    const fetchImpl = vi.fn();

    await expect(
      fetchTransientDiscoveryPlaceDetails(
        pool,
        { project, runId, candidateId },
        { apiKey: "server-key", fetchImpl: fetchImpl as typeof fetch },
      ),
    ).rejects.toMatchObject({ code: "candidate_not_found", status: 404 });

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("r.organization_id = $1::uuid");
    expect(sql).toContain("r.project_id = $2");
    expect(sql).toContain("r.id = $3::uuid");
    expect(sql).toContain("c.id = $4::uuid");
    expect(params).toEqual([
      project.organizationId,
      project.id,
      runId,
      candidateId,
    ]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fails closed unless the run profile explicitly opts into transient details", async () => {
    for (const row of [
      candidate({ profile_id: null }),
      candidate({ source_config: {} }),
      candidate({
        source_config: {
          google_places: { enabled: true, mode: "discovery_source" },
        },
      }),
    ]) {
      const { pool } = poolFor(row);
      const fetchImpl = vi.fn();
      await expect(
        fetchTransientDiscoveryPlaceDetails(
          pool,
          { project, runId, candidateId },
          { apiKey: "server-key", fetchImpl: fetchImpl as typeof fetch },
        ),
      ).rejects.toMatchObject({
        code: "places_details_disabled",
        status: 409,
      });
      expect(fetchImpl).not.toHaveBeenCalled();
    }
  });

  it("keeps the API key server-side, requests a minimal field mask and performs no writes", async () => {
    const { pool, query } = poolFor(candidate());
    const fetchImpl = vi.fn(async () =>
      response({
        places: [
          {
            id: "places/leadgrid",
            displayName: { text: "Leadgrid AS" },
            formattedAddress: "Storgata 1, 0155 Oslo, Norge",
            location: { latitude: 59.91271, longitude: 10.74612 },
            primaryType: "corporate_office",
            primaryTypeDisplayName: { text: "Bedriftskontor" },
            businessStatus: "OPERATIONAL",
            websiteUri: "https://leadgrid.no/",
            internationalPhoneNumber: "+47 979 59 294",
            googleMapsUri: "https://maps.google.com/?cid=123",
            attributions: [
              {
                provider: "Example data",
                providerUri: "https://example.com/source",
              },
            ],
          },
        ],
      }),
    );

    const result = await fetchTransientDiscoveryPlaceDetails(
      pool,
      { project, runId, candidateId },
      {
        apiKey: "server-secret-key",
        fetchImpl: fetchImpl as typeof fetch,
        now: () => new Date("2026-08-31T12:00:00.000Z"),
      },
    );

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(__test.GOOGLE_PLACES_TEXT_SEARCH_URL);
    expect(String(url)).not.toContain("server-secret-key");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      "X-Goog-Api-Key": "server-secret-key",
      "X-Goog-FieldMask": __test.GOOGLE_PLACES_FIELD_MASK,
    });
    expect(__test.GOOGLE_PLACES_FIELD_MASK).not.toMatch(/rating|review|photo/i);
    expect(JSON.parse(String(init?.body))).toMatchObject({
      textQuery: "Leadgrid AS, Storgata 1, 0155, Oslo, Norge",
      languageCode: "no",
      regionCode: "NO",
      pageSize: 3,
      locationBias: {
        circle: {
          center: { latitude: 59.9127, longitude: 10.7461 },
          radius: 5000,
        },
      },
    });
    expect(String(init?.body)).not.toContain("server-secret-key");
    expect(query).toHaveBeenCalledOnce();
    expect(query.mock.calls.every(([sql]) => /^\s*SELECT\b/i.test(sql))).toBe(
      true,
    );
    expect(result).toMatchObject({
      candidate_id: candidateId,
      mode: "transient_details_only",
      fetched_at: "2026-08-31T12:00:00.000Z",
      provider: { id: "google_places", name: "Google Maps" },
      matches: [
        {
          place_id: "places/leadgrid",
          match_quality: "strong",
          website_uri: "https://leadgrid.no/",
          google_maps_uri: "https://maps.google.com/?cid=123",
          attributions: [
            {
              provider: "Example data",
              provider_uri: "https://example.com/source",
            },
          ],
        },
      ],
    });
  });

  it("limits the transient response to three results and rejects unsafe URLs", async () => {
    const { pool } = poolFor(candidate());
    const places = Array.from({ length: 5 }, (_, index) => ({
      id: `place-${index}`,
      displayName: { text: `Leadgrid ${index}` },
      websiteUri:
        index === 0 ? "javascript:alert(1)" : `https://example.com/${index}`,
      googleMapsUri:
        index === 0
          ? "http://maps.google.com/unsafe"
          : `https://maps.google.com/${index}`,
    }));

    const result = await fetchTransientDiscoveryPlaceDetails(
      pool,
      { project, runId, candidateId },
      {
        apiKey: "server-key",
        fetchImpl: vi.fn(async () => response({ places })) as typeof fetch,
      },
    );

    expect(result.matches).toHaveLength(3);
    expect(result.matches[0].website_uri).toBeNull();
    expect(result.matches[0].google_maps_uri).toBeNull();
  });

  it("maps provider throttling to a typed retryable error without leaking the upstream body", async () => {
    const { pool } = poolFor(candidate());
    const error = await fetchTransientDiscoveryPlaceDetails(
      pool,
      { project, runId, candidateId },
      {
        apiKey: "server-key",
        fetchImpl: vi.fn(async () =>
          response({ error: { message: "secret upstream detail" } }, 429),
        ) as typeof fetch,
      },
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(DiscoveryPlacesDetailsError);
    expect(error).toMatchObject({
      code: "places_rate_limited",
      status: 503,
      retryable: true,
    });
    expect((error as Error).message).not.toContain("secret upstream detail");
  });

  it("classifies identity evidence separately from Discovery scoring", () => {
    expect(
      classifyDiscoveryPlaceMatch(candidate(), {
        displayName: { text: "Helt Annen Bedrift" },
        formattedAddress: "Et annet sted",
      }),
    ).toEqual({
      quality: "weak",
      reasons: ["Treffet må kontrolleres manuelt"],
    });
  });
});
