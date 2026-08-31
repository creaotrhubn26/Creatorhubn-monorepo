import { describe, expect, it, vi } from "vitest";

import {
  BRREG_NLOD_ATTRIBUTION,
  createDiscoveryRegistryProvider,
  DiscoveryRegistryError,
  municipalityNumbersFromGml,
} from "./leadgrid-discovery-brreg-provider.js";

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function textResponse(value: string, status = 200): Response {
  return new Response(value, {
    status,
    headers: { "Content-Type": "application/gml+xml; version=3.2" },
  });
}

const municipalityGml = `<?xml version="1.0" encoding="UTF-8"?>
<wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs/2.0"
  xmlns:app="http://skjema.geonorge.no/SOSI/produktspesifikasjon/AdministrativeEnheter/20190101">
  <wfs:member><app:Kommune><app:kommunenummer>0301</app:kommunenummer></app:Kommune></wfs:member>
</wfs:FeatureCollection>`;

function brregUnit(
  organizationNumber: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    organisasjonsnummer: organizationNumber,
    navn: `Firma ${organizationNumber}`,
    organisasjonsform: { kode: "AS", beskrivelse: "Aksjeselskap" },
    forretningsadresse: {
      adresse: ["Testgata 1"],
      postnummer: "0150",
      poststed: "OSLO",
      kommune: "OSLO",
      kommunenummer: "0301",
    },
    hjemmeside: "https://example.no",
    antallAnsatte: 12,
    naeringskode1: {
      kode: "74.200",
      beskrivelse: "Fotografvirksomhet",
    },
    registreringsdatoEnhetsregisteret: "2020-01-01",
    registrertIMvaregisteret: true,
    registrertIForetaksregisteret: true,
    konkurs: false,
    underAvvikling: false,
    _links: {
      self: {
        href: `https://data.brreg.no/enhetsregisteret/api/enheter/${organizationNumber}`,
      },
    },
    ...overrides,
  };
}

describe("Discovery BRREG provider", () => {
  it("parses municipality codes from the WFS 2.0 GML contract", () => {
    expect(municipalityNumbersFromGml(municipalityGml)).toEqual(["0301"]);
  });

  it("resolves a natural segment to official NACE and searches deterministically", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.hostname === "data.ssb.no") {
        return jsonResponse({
          _embedded: {
            codes: [
              {
                code: "74.200",
                level: 5,
                name: "Fotografvirksomhet",
              },
              {
                code: "56.110",
                level: 5,
                name: "Drift av restauranter",
              },
            ],
          },
        });
      }
      return jsonResponse({
        _embedded: { enheter: [brregUnit("999999999")] },
        page: { totalPages: 1 },
      });
    });
    const provider = createDiscoveryRegistryProvider({
      fetchImpl: fetchImpl as typeof fetch,
      now: () => new Date("2026-08-31T00:00:00.000Z"),
    });

    const result = await provider.search({
      query: "fotografer",
      city: "Oslo",
      maxResults: 20,
    });

    expect(result.resolution).toBe("nace");
    expect(result.resolvedNaceCodes).toEqual(["74.200"]);
    expect(result.candidates[0]).toMatchObject({
      organizationNumber: "999999999",
      naceCode: "74.200",
      status: "active",
    });
    const brregUrl = new URL(
      String(
        fetchImpl.mock.calls.find(([url]) =>
          String(url).includes("enhetsregisteret/api/enheter?"),
        )?.[0],
      ),
    );
    expect(brregUrl.searchParams.get("naeringskode")).toBe("74.200");
    expect(brregUrl.searchParams.get("forretningsadresse.poststed")).toBe(
      "OSLO",
    );
    expect(brregUrl.searchParams.get("sort")).toBe("organisasjonsnummer,ASC");
    expect(brregUrl.searchParams.get("konkurs")).toBe("false");
    expect(BRREG_NLOD_ATTRIBUTION.license).toBe("NLOD 2.0");
  });

  it("uses Kartverket for municipality selection and exact radius filtering", async () => {
    let geocodeCalls = 0;
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.hostname === "wfs.geonorge.no") {
        return textResponse(municipalityGml);
      }
      if (url.pathname.endsWith("/sok")) {
        geocodeCalls += 1;
        const address = url.searchParams.get("adressetekst");
        return jsonResponse({
          adresser: [
            {
              adressetekst: address,
              adressetekstutenadressetilleggsnavn: address,
              kommunenummer: "0301",
              postnummer: "0150",
              representasjonspunkt:
                geocodeCalls === 1
                  ? { lat: 59.914, lon: 10.752 }
                  : { lat: 60.5, lon: 11.5 },
            },
          ],
        });
      }
      if (url.hostname === "data.brreg.no") {
        return jsonResponse({
          _embedded: {
            enheter: [
              brregUnit("999999991"),
              brregUnit("999999992", {
                forretningsadresse: {
                  adresse: ["Testgata 2"],
                  postnummer: "0150",
                  poststed: "OSLO",
                  kommune: "OSLO",
                  kommunenummer: "0301",
                },
              }),
            ],
          },
          page: { totalPages: 1 },
        });
      }
      throw new Error(`Unexpected URL ${url}`);
    });
    const provider = createDiscoveryRegistryProvider({
      fetchImpl: fetchImpl as typeof fetch,
      maxAttempts: 1,
    });

    const result = await provider.search({
      query: "74.200",
      geo: {
        center: { latitude: 59.9139, longitude: 10.7522 },
        radiusMeters: 5_000,
      },
      maxResults: 20,
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].organizationNumber).toBe("999999991");
    expect(result.candidates[0].distanceFromSearchCenterMeters).toBeLessThan(
      100,
    );
    expect(result.geoFilteredResults).toBe(1);
    const brregUrl = new URL(
      String(
        fetchImpl.mock.calls.find(([url]) =>
          String(url).includes("enhetsregisteret/api/enheter?"),
        )?.[0],
      ),
    );
    expect(brregUrl.searchParams.get("kommunenummer")).toBe("0301");
    expect(
      fetchImpl.mock.calls.filter(([url]) =>
        String(url).includes("wfs.administrative_enheter"),
      ),
    ).toHaveLength(1);
    const wfsCall = fetchImpl.mock.calls.find(([url]) =>
      String(url).includes("wfs.administrative_enheter"),
    );
    const wfsUrl = new URL(String(wfsCall?.[0]));
    expect(wfsUrl.searchParams.has("outputFormat")).toBe(false);
    expect((wfsCall?.[1] as RequestInit)?.headers).toMatchObject({
      Accept: expect.stringContaining("application/gml+xml"),
    });
  });

  it("only uses organization-name search when intent is explicit", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      return jsonResponse({
        _embedded: { enheter: [] },
        page: { totalPages: 1 },
      });
    });
    const provider = createDiscoveryRegistryProvider({
      fetchImpl: fetchImpl as typeof fetch,
      maxAttempts: 1,
    });

    const result = await provider.search({
      query: "Acme Studio",
      queryMode: "organization_name",
      city: "Bergen",
    });

    expect(result.resolution).toBe("organization_name");
    const brregUrl = new URL(String(fetchImpl.mock.calls[0][0]));
    expect(brregUrl.searchParams.get("navn")).toBe("Acme Studio");
    expect(brregUrl.searchParams.has("naeringskode")).toBe(false);
    expect(
      fetchImpl.mock.calls.some(([url]) => String(url).includes("data.ssb.no")),
    ).toBe(false);
  });

  it("fails closed when an industry classification source is unavailable", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.hostname === "data.ssb.no") {
        return jsonResponse({ error: "down" }, 503);
      }
      throw new Error(`BRREG must not be called: ${url}`);
    });
    const provider = createDiscoveryRegistryProvider({
      fetchImpl: fetchImpl as typeof fetch,
      maxAttempts: 1,
    });

    await expect(
      provider.search({ query: "fotografer", city: "Bergen" }),
    ).rejects.toMatchObject({
      code: "upstream_unavailable",
      retryable: true,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("deduplicates organizations across pages and reports source limits honestly", async () => {
    let brregPage = 0;
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.hostname === "data.ssb.no") {
        return jsonResponse({ _embedded: { codes: [] } });
      }
      const page = brregPage;
      brregPage += 1;
      return jsonResponse({
        _embedded: {
          enheter:
            page === 0
              ? [brregUnit("999999991")]
              : [
                  brregUnit("999999991"),
                  brregUnit("999999992"),
                  { organisasjonsnummer: "invalid" },
                ],
        },
        page: { totalPages: 2 },
      });
    });
    const provider = createDiscoveryRegistryProvider({
      fetchImpl: fetchImpl as typeof fetch,
      maxAttempts: 1,
    });

    const result = await provider.search({
      query: "Acme",
      queryMode: "organization_name",
      city: "Trondheim",
      maxResults: 10,
    });

    expect(
      result.candidates.map((candidate) => candidate.organizationNumber),
    ).toEqual(["999999991", "999999992"]);
    expect(result.duplicateResultsSkipped).toBe(1);
    expect(result.invalidResultsSkipped).toBe(1);
    expect(result.pagesFetched).toBe(2);
    expect(result.hasMoreSourceResults).toBe(false);
  });

  it("fails closed when a geo area cannot be resolved to a municipality", async () => {
    const provider = createDiscoveryRegistryProvider({
      fetchImpl: vi.fn(async () =>
        textResponse(
          '<wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs/2.0" />',
        ),
      ) as typeof fetch,
      maxAttempts: 1,
    });

    await expect(
      provider.search({
        query: "74.200",
        geo: {
          center: { latitude: 59.9139, longitude: 10.7522 },
          radiusMeters: 5_000,
        },
      }),
    ).rejects.toMatchObject<Partial<DiscoveryRegistryError>>({
      code: "area_resolution_failed",
      retryable: true,
    });
  });

  it("rejects a fuzzy address hit from a different municipality", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.hostname === "wfs.geonorge.no") {
        return textResponse(municipalityGml);
      }
      if (url.hostname === "data.brreg.no") {
        return jsonResponse({
          _embedded: {
            enheter: [
              brregUnit("999999993", {
                forretningsadresse: {
                  adresse: ["Feilkommuneveien 7"],
                  postnummer: "0150",
                  poststed: "OSLO",
                  kommune: "OSLO",
                  kommunenummer: "0301",
                },
              }),
            ],
          },
          page: { totalPages: 1 },
        });
      }
      return jsonResponse({
        adresser: [
          {
            adressetekst: "Feilkommuneveien 7",
            kommunenummer: "1103",
            postnummer: "0150",
            representasjonspunkt: { lat: 59.914, lon: 10.752 },
          },
        ],
      });
    });
    const provider = createDiscoveryRegistryProvider({
      fetchImpl: fetchImpl as typeof fetch,
      maxAttempts: 1,
    });

    const result = await provider.search({
      query: "74.200",
      geo: {
        center: { latitude: 59.9139, longitude: 10.7522 },
        radiusMeters: 5_000,
      },
    });

    expect(result.candidates).toEqual([]);
    expect(result.geocodeMisses).toBe(1);
    const addressCalls = fetchImpl.mock.calls.filter(([url]) =>
      String(url).includes("/adresser/v1/sok"),
    );
    expect(addressCalls).toHaveLength(2);
    for (const [input] of addressCalls) {
      const url = new URL(String(input));
      expect(url.searchParams.get("kommunenummer")).toBe("0301");
      expect(url.searchParams.get("postnummer")).toBe("0150");
    }
  });

  it("stops radius work at the provider-wide geocode budget", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.hostname === "wfs.geonorge.no") {
        return textResponse(municipalityGml);
      }
      if (url.hostname === "data.brreg.no") {
        return jsonResponse({
          _embedded: {
            enheter: Array.from({ length: 5 }, (_, index) =>
              brregUnit(`9999999${index + 10}`, {
                forretningsadresse: {
                  adresse: [`Budjettgata ${index + 1}`],
                  postnummer: "0150",
                  poststed: "OSLO",
                  kommune: "OSLO",
                  kommunenummer: "0301",
                },
              }),
            ),
          },
          page: { totalPages: 20 },
        });
      }
      const address = url.searchParams.get("adressetekst");
      return jsonResponse({
        adresser: [
          {
            adressetekst: address,
            adressetekstutenadressetilleggsnavn: address,
            kommunenummer: "0301",
            postnummer: "0150",
            representasjonspunkt: { lat: 60.5, lon: 11.5 },
          },
        ],
      });
    });
    const provider = createDiscoveryRegistryProvider({
      fetchImpl: fetchImpl as typeof fetch,
      maxAttempts: 1,
      maxGeocodes: 2,
      maxExternalRequests: 20,
    });

    const result = await provider.search({
      query: "74.200",
      geo: {
        center: { latitude: 59.9139, longitude: 10.7522 },
        radiusMeters: 5_000,
      },
      maxResults: 20,
    });

    expect(result.sourceLimitReached).toBe(true);
    expect(result.limitReason).toBe("geocode_limit");
    expect(result.geocodeRequests).toBe(2);
    expect(result.externalRequests).toBeLessThanOrEqual(4);
    expect(
      fetchImpl.mock.calls.filter(([url]) =>
        String(url).includes("/adresser/v1/sok"),
      ),
    ).toHaveLength(2);
  });
});
