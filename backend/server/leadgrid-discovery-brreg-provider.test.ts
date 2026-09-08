import { describe, expect, it, vi } from "vitest";

import {
  BRREG_NLOD_ATTRIBUTION,
  createDiscoveryRegistryProvider,
  DISCOVERY_BRREG_PAGE_SIZE,
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
    harRegistrertAntallAnsatte: true,
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
              {
                code: "86.210",
                level: 5,
                name: "Allmennlegetjenester",
              },
              {
                code: "86.230",
                level: 5,
                name: "Tannlegetjenester",
              },
              {
                code: "86.950",
                level: 5,
                name: "Fysioterapi- og ergoterapitjenester",
              },
              {
                code: "86.993",
                level: 5,
                name: "Andre helsetjenester ellers",
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

    const dentalResult = await provider.search({
      query: "tannklinikk",
      city: "Oslo",
      maxResults: 20,
    });

    expect(dentalResult.resolvedNaceCodes).toEqual(["86.230"]);
    const dentalBrregUrl = fetchImpl.mock.calls
      .map(([url]) => new URL(String(url)))
      .find(
        (url) =>
          url.pathname.endsWith("/enheter") &&
          url.searchParams.get("naeringskode") === "86.230",
      );
    expect(dentalBrregUrl).toBeDefined();
  });

  it("rotates deterministically from an absolute offset and wraps after the last page", async () => {
    const requestedPages: number[] = [];
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (!url.pathname.endsWith("/enheter")) {
        throw new Error(`Unexpected URL ${url}`);
      }
      const page = Number(url.searchParams.get("page"));
      requestedPages.push(page);
      if (page >= 3) return jsonResponse({ error: "page out of range" }, 400);
      return jsonResponse({
        _embedded: { enheter: [brregUnit(String(900_000_000 + page))] },
        page: { totalPages: 3 },
      });
    });
    const provider = createDiscoveryRegistryProvider({
      fetchImpl: fetchImpl as typeof fetch,
      maxAttempts: 1,
    });

    const first = await provider.search({
      query: "74.200",
      city: "Oslo",
      maxResults: 1,
      sourceOffset: 2 * DISCOVERY_BRREG_PAGE_SIZE,
    });
    const second = await provider.search({
      query: "74.200",
      city: "Oslo",
      maxResults: 1,
      sourceOffset: first.sourceOffsetNext,
    });

    expect(requestedPages).toEqual([2, 0]);
    expect(first).toMatchObject({
      sourceOffsetStart: 200,
      sourceOffsetNext: 0,
      sourcePageStart: 2,
      sourcePageNext: 0,
      sourcePageCount: 3,
    });
    expect(second).toMatchObject({
      sourceOffsetStart: 0,
      sourceOffsetNext: 100,
      sourcePageStart: 0,
      sourcePageNext: 1,
      sourcePageCount: 3,
    });
    expect(first.candidates[0].organizationNumber).toBe("900000002");
    expect(second.candidates[0].organizationNumber).toBe("900000000");
  });

  it("resumes inside the same fixed BRREG page without skipping valid rows", async () => {
    const requestedPages: number[] = [];
    const requestedSizes: number[] = [];
    const units = Array.from(
      { length: DISCOVERY_BRREG_PAGE_SIZE },
      (_, index) => brregUnit(String(900_000_000 + index)),
    );
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      requestedPages.push(Number(url.searchParams.get("page")));
      requestedSizes.push(Number(url.searchParams.get("size")));
      return jsonResponse({
        _embedded: { enheter: units },
        page: { totalPages: 1 },
      });
    });
    const provider = createDiscoveryRegistryProvider({
      fetchImpl: fetchImpl as typeof fetch,
      maxAttempts: 1,
    });

    const first = await provider.search({
      query: "74.200",
      city: "Oslo",
      maxResults: 20,
      sourceOffset: 0,
    });
    const second = await provider.search({
      query: "74.200",
      city: "Oslo",
      maxResults: 20,
      sourceOffset: first.sourceOffsetNext,
    });

    expect(requestedPages).toEqual([0, 0]);
    expect(requestedSizes).toEqual([
      DISCOVERY_BRREG_PAGE_SIZE,
      DISCOVERY_BRREG_PAGE_SIZE,
    ]);
    expect(first.sourceOffsetNext).toBe(20);
    expect(second.sourceOffsetStart).toBe(20);
    expect(second.sourceOffsetNext).toBe(40);
    expect(first.candidates.at(-1)?.organizationNumber).toBe("900000019");
    expect(second.candidates[0]?.organizationNumber).toBe("900000020");
    expect(
      new Set(
        [...first.candidates, ...second.candidates].map(
          (candidate) => candidate.organizationNumber,
        ),
      ).size,
    ).toBe(40);
  });

  it("advances by consumed raw rows across invalid, filtered and duplicate entries", async () => {
    const validA = brregUnit("900000101");
    const units = [
      brregUnit("invalid"),
      brregUnit("900000100", {
        antallAnsatte: 1,
        harRegistrertAntallAnsatte: true,
      }),
      validA,
      validA,
      brregUnit("900000102"),
      brregUnit("900000103"),
    ];
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        _embedded: { enheter: units },
        page: { totalPages: 1 },
      }),
    );
    const provider = createDiscoveryRegistryProvider({
      fetchImpl: fetchImpl as typeof fetch,
      maxAttempts: 1,
    });

    const first = await provider.search({
      query: "74.200",
      city: "Oslo",
      minimumEmployees: 5,
      maxResults: 2,
      sourceOffset: 0,
    });
    const second = await provider.search({
      query: "74.200",
      city: "Oslo",
      minimumEmployees: 5,
      maxResults: 1,
      sourceOffset: first.sourceOffsetNext,
    });

    expect(
      first.candidates.map((candidate) => candidate.organizationNumber),
    ).toEqual(["900000101", "900000102"]);
    expect(first).toMatchObject({
      sourceOffsetNext: 5,
      sourceResultsSeen: 5,
      invalidResultsSkipped: 1,
      companyFilteredResults: 1,
      duplicateResultsSkipped: 1,
    });
    expect(second.sourceOffsetStart).toBe(5);
    expect(second.candidates[0]?.organizationNumber).toBe("900000103");
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

  it("uses explicit municipalities as an exact OR filter and forwards official company filters", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/kommuner")) {
        return jsonResponse({
          _embedded: {
            kommuner: [
              { nummer: "0301", navn: "OSLO" },
              { nummer: "3201", navn: "BÆRUM" },
              { nummer: "1103", navn: "STAVANGER" },
            ],
          },
          page: { totalPages: 1 },
        });
      }
      if (url.pathname.endsWith("/enheter")) {
        return jsonResponse({
          _embedded: {
            enheter: [
              brregUnit("999999981"),
              brregUnit("999999982", {
                forretningsadresse: {
                  adresse: ["Vestveien 1"],
                  postnummer: "1366",
                  poststed: "LYSAKER",
                  kommune: "BÆRUM",
                  kommunenummer: "3201",
                },
              }),
              brregUnit("999999983", {
                forretningsadresse: {
                  adresse: ["Sørgata 1"],
                  postnummer: "4006",
                  poststed: "STAVANGER",
                  kommune: "STAVANGER",
                  kommunenummer: "1103",
                },
              }),
              brregUnit("999999984", {
                organisasjonsform: {
                  kode: "ENK",
                  beskrivelse: "Enkeltpersonforetak",
                },
              }),
              brregUnit("999999985", { antallAnsatte: 2 }),
              brregUnit("999999986", {
                harRegistrertAntallAnsatte: false,
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
      query: "klinikk",
      queryMode: "organization_name",
      municipalityNumbers: ["0301"],
      municipalityNames: ["Bærum"],
      organizationForms: ["as"],
      minimumEmployees: 5,
      maximumEmployees: 50,
      websiteRequirement: "present",
      registeredInVatRegister: true,
      registeredInBusinessRegister: true,
    });

    expect(result.resolvedMunicipalities).toEqual([
      expect.objectContaining({ number: "0301", name: "OSLO" }),
      expect.objectContaining({ number: "3201", name: "BÆRUM" }),
    ]);
    expect(
      result.candidates.map((candidate) => candidate.organizationNumber),
    ).toEqual(["999999981", "999999982"]);
    expect(result.geoFilteredResults).toBe(1);
    expect(result.companyFilteredResults).toBe(3);
    const searchUrl = new URL(
      String(
        fetchImpl.mock.calls.find(([input]) =>
          String(input).includes("/enheter?"),
        )?.[0],
      ),
    );
    expect(searchUrl.searchParams.get("kommunenummer")).toBe("0301,3201");
    expect(searchUrl.searchParams.get("organisasjonsform")).toBe("AS");
    expect(searchUrl.searchParams.get("fraAntallAnsatte")).toBe("5");
    expect(searchUrl.searchParams.get("tilAntallAnsatte")).toBe("50");
    expect(searchUrl.searchParams.get("registrertIMvaregisteret")).toBe("true");
    expect(searchUrl.searchParams.get("registrertIForetaksregisteret")).toBe(
      "true",
    );
  });

  it("retains unknown group evidence and never claims that it proves a commercial chain", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/enheter")) {
        return jsonResponse({
          _embedded: {
            enheter: [brregUnit("999999971"), brregUnit("999999972")],
          },
          page: { totalPages: 1 },
        });
      }
      if (url.pathname.endsWith("/999999971")) return jsonResponse({}, 404);
      if (url.pathname.endsWith("/999999972")) {
        return jsonResponse({
          mor: { organisasjonsnummer: "999999972" },
          datter: { organisasjonsnummer: "999999973" },
        });
      }
      throw new Error(`Unexpected URL ${url}`);
    });
    const provider = createDiscoveryRegistryProvider({
      fetchImpl: fetchImpl as typeof fetch,
      maxAttempts: 1,
    });

    const result = await provider.search({
      query: "klinikk",
      queryMode: "organization_name",
      city: "Oslo",
      organizationStructure: "chain",
    });

    expect(result.candidates).toEqual([
      expect.objectContaining({
        organizationNumber: "999999971",
        organizationStructure: "unknown",
        organizationStructureEvidence: expect.objectContaining({
          basis: "not_found",
          relatedOrganizationCount: null,
        }),
      }),
      expect.objectContaining({
        organizationNumber: "999999972",
        organizationStructure: "chain",
        organizationStructureEvidence: expect.objectContaining({
          basis: "multiple_registered_entities",
          relatedOrganizationCount: 2,
        }),
      }),
    ]);
  });

  it("assesses registered websites only when requested and within the enrichment limit", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        _embedded: {
          enheter: [
            brregUnit("999999961", {
              hjemmeside: "https://quality-999999961.example",
            }),
            brregUnit("999999962", {
              hjemmeside: "https://quality-999999962.example",
            }),
          ],
        },
        page: { totalPages: 1 },
      }),
    );
    const websiteFetch = vi.fn(
      async (
        rawUrl: string,
        _init?: RequestInit,
        _maxRedirects?: number,
        beforeRequest?: (url: string, hop: number) => void | Promise<void>,
      ) => {
        await beforeRequest?.(rawUrl, 0);
        return {
          response: new Response(
            '<html><head><title>Klinikk</title><meta name="description" content="Bestill time"><meta name="viewport" content="width=device-width"></head><body><a href="/kontakt">Kontakt</a><button>Bestill time</button></body></html>',
            { status: 200, headers: { "Content-Type": "text/html" } },
          ),
          finalUrl: rawUrl,
          redirectCount: 0,
          requestCount: 1,
        };
      },
    );
    const provider = createDiscoveryRegistryProvider({
      fetchImpl: fetchImpl as typeof fetch,
      websiteFetch,
      maxAttempts: 1,
    });

    const withoutQuality = await provider.search({
      query: "klinikk",
      queryMode: "organization_name",
      city: "Oslo",
    });
    expect(withoutQuality.websiteAssessmentRequests).toBe(0);
    expect(websiteFetch).not.toHaveBeenCalled();

    const withQuality = await provider.search({
      query: "klinikk",
      queryMode: "organization_name",
      city: "Oslo",
      minimumWebsiteQualityScore: 65,
      websiteAssessmentLimit: 1,
    });
    expect(websiteFetch).toHaveBeenCalledTimes(1);
    expect(withQuality.websiteAssessmentCandidates).toBe(1);
    expect(withQuality.websiteAssessmentRequests).toBe(1);
    expect(withQuality.candidates[0].websiteQuality).toMatchObject({
      status: "assessed",
      score: 100,
      reason: "assessed",
    });
    expect(withQuality.candidates[1].websiteQuality).toMatchObject({
      status: "unknown",
      score: null,
      reason: "not_selected_for_assessment",
    });
  });

  it("keeps missing registered websites as sourced unknown evidence without crawling", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        _embedded: {
          enheter: [brregUnit("999999963", { hjemmeside: null })],
        },
        page: { totalPages: 1 },
      }),
    );
    const websiteFetch = vi.fn();
    const provider = createDiscoveryRegistryProvider({
      fetchImpl: fetchImpl as typeof fetch,
      websiteFetch,
      maxAttempts: 1,
      now: () => new Date("2026-09-05T12:00:00.000Z"),
    });

    const result = await provider.search({
      query: "klinikk",
      queryMode: "organization_name",
      city: "Oslo",
      minimumWebsiteQualityScore: 65,
      websiteAssessmentLimit: 1,
    });

    expect(websiteFetch).not.toHaveBeenCalled();
    expect(result.websiteAssessmentCandidates).toBe(1);
    expect(result.websiteAssessmentRequests).toBe(0);
    expect(result.candidates[0].websiteQuality).toMatchObject({
      status: "unknown",
      score: null,
      reason: "no_registered_url",
      sourceUri: "https://data.brreg.no/enhetsregisteret/api/enheter/999999963",
    });
  });

  it("cancels every unconsumed website body and keeps transient failures unknown", async () => {
    const largeCancelled = vi.fn();
    const nonHtmlCancelled = vi.fn();
    const unavailableCancelled = vi.fn();
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        _embedded: {
          enheter: [
            brregUnit("999999964", {
              hjemmeside: "https://large-999999964.example",
            }),
            brregUnit("999999965", {
              hjemmeside: "https://pdf-999999965.example",
            }),
            brregUnit("999999966", {
              hjemmeside: "https://down-999999966.example",
            }),
          ],
        },
        page: { totalPages: 1 },
      }),
    );
    const websiteFetch = vi.fn(
      async (
        rawUrl: string,
        _init?: RequestInit,
        _maxRedirects?: number,
        beforeRequest?: (url: string, hop: number) => void | Promise<void>,
      ) => {
        await beforeRequest?.(rawUrl, 0);
        if (rawUrl.includes("large-")) {
          return {
            response: new Response(
              new ReadableStream({ cancel: largeCancelled }),
              {
                status: 200,
                headers: {
                  "Content-Type": "text/html",
                  "Content-Length": "600000",
                },
              },
            ),
            finalUrl: rawUrl,
            redirectCount: 0,
            requestCount: 1,
          };
        }
        if (rawUrl.includes("pdf-")) {
          return {
            response: new Response(
              new ReadableStream({ cancel: nonHtmlCancelled }),
              { status: 200, headers: { "Content-Type": "application/pdf" } },
            ),
            finalUrl: rawUrl,
            redirectCount: 0,
            requestCount: 1,
          };
        }
        return {
          response: new Response(
            new ReadableStream({ cancel: unavailableCancelled }),
            { status: 503, headers: { "Content-Type": "text/html" } },
          ),
          finalUrl: rawUrl,
          redirectCount: 0,
          requestCount: 1,
        };
      },
    );
    const provider = createDiscoveryRegistryProvider({
      fetchImpl: fetchImpl as typeof fetch,
      websiteFetch,
      maxAttempts: 1,
    });

    const result = await provider.search({
      query: "klinikk",
      queryMode: "organization_name",
      city: "Oslo",
      minimumWebsiteQualityScore: 65,
      websiteAssessmentLimit: 3,
      maxResults: 3,
    });

    expect(largeCancelled).toHaveBeenCalledOnce();
    expect(nonHtmlCancelled).toHaveBeenCalledOnce();
    expect(unavailableCancelled).toHaveBeenCalledOnce();
    expect(result.websiteAssessmentRequests).toBe(3);
    expect(
      result.candidates.map((candidate) => candidate.websiteQuality?.reason),
    ).toEqual([
      "response_too_large",
      "unsupported_content_type",
      "request_failed",
    ]);
    expect(
      result.candidates.every(
        (candidate) => candidate.websiteQuality?.status === "unknown",
      ),
    ).toBe(true);
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
