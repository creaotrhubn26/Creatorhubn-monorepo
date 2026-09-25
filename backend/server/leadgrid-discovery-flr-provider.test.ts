import { generateKeyPairSync } from "node:crypto";

import jwt from "jsonwebtoken";
import { describe, expect, it, vi } from "vitest";

import { DiscoveryRegistryError } from "./leadgrid-discovery-brreg-provider.js";
import {
  createDiscoveryFlrProvider,
  FLR_ENDPOINTS,
} from "./leadgrid-discovery-flr-provider.js";

const activeFrom = "2025-01-01T00:00:00Z";

function contract(input: {
  contractId: number;
  organizationNumber?: number;
  displayName?: string;
  municipalityNumber?: string;
  municipalityName?: string;
  doctorId?: number;
  hprNumber?: number;
  doctorFirstName?: string;
  doctorLastName?: string;
  doctorTo?: string | null;
}) {
  return {
    id: input.contractId,
    office: {
      organizationNumber: input.organizationNumber ?? 987654321,
      legalName: "EKSEMPEL LEGESENTER AS",
      displayName: input.displayName ?? "Eksempel legesenter",
      phoneNumber: "22 11 33 44",
      isGroupOffice: true,
      addresses: [
        {
          streetAddress: "Storgata 1",
          postalCode: 159,
          city: "Oslo",
          municipality: {
            value: input.municipalityNumber ?? "0301",
            name: input.municipalityName ?? "Oslo",
          },
        },
      ],
      municipality: {
        value: input.municipalityNumber ?? "0301",
        name: input.municipalityName ?? "Oslo",
      },
    },
    period: { from: activeFrom, to: null },
    doctorCycles: [
      {
        id: input.doctorId ?? input.contractId * 10,
        doctor: {
          hprNumber: input.hprNumber ?? input.contractId * 100,
          firstName: input.doctorFirstName ?? "Ada",
          middleName: null,
          lastName: input.doctorLastName ?? "Lovelace",
          gender: { value: "K", name: "Kvinne" },
        },
        period: { from: activeFrom, to: input.doctorTo ?? null },
      },
    ],
    maxNumberOfPatients: 1_500,
    numberOfVacantSpots: 23,
    numberOfPatientsOnWaitingList: 41,
  };
}

function jsonResponse(value: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    query: "86.210",
    queryMode: "industry" as const,
    countryCode: "NO" as const,
    maxResults: 60,
    sourceOffset: 0,
    city: null,
    municipalityNumbers: [],
    municipalityNames: [],
    ...overrides,
  };
}

describe("NHN public Fastlegeregister Discovery provider", () => {
  it("aggregates active contracts by office and keeps only privacy-minimized practitioner references", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse([
        contract({ contractId: 1, hprNumber: 1001 }),
        contract({
          contractId: 2,
          hprNumber: 1002,
          doctorFirstName: "Grace",
          doctorLastName: "Hopper",
        }),
        contract({
          contractId: 3,
          hprNumber: 1003,
          doctorFirstName: "Avsluttet",
          doctorLastName: "Lege",
          doctorTo: "2025-06-01T00:00:00Z",
        }),
      ]),
    ) as unknown as typeof fetch;
    const provider = createDiscoveryFlrProvider({
      fetchImpl,
      accessTokenProvider: async () => "test-access-token-value-long-enough",
      beforeContractsRequest: async () => undefined,
      now: () => new Date("2026-09-12T10:00:00Z"),
    });

    const result = await provider.search(input());

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      source: "nhn_flr_public",
      organizationNumber: "987654321",
      name: "Eksempel legesenter",
      address: "Storgata 1",
      postalCode: "0159",
      city: "Oslo",
      phone: "22 11 33 44",
      naceCode: "86.210",
      entityClassification: {
        kind: "clinic",
        confidence: "high",
      },
    });
    expect(
      result.candidates[0]?.providerContacts?.map((item) => item.name),
    ).toEqual(["Ada Lovelace", "Grace Hopper"]);
    expect(
      result.candidates[0]?.providerContacts?.every((item) =>
        /^[a-f0-9]{64}$/.test(item.sourceReference),
      ),
    ).toBe(true);
    const serialized = JSON.stringify(result.candidates[0]);
    expect(serialized).not.toContain("hprNumber");
    expect(serialized).not.toContain("maxNumberOfPatients");
    expect(serialized).not.toContain("numberOfVacantSpots");
    expect(serialized).not.toContain("numberOfPatientsOnWaitingList");
    expect(serialized).not.toContain("gender");
    expect(fetchImpl).toHaveBeenCalledWith(
      `${FLR_ENDPOINTS.test.apiBaseUrl}/v1/contracts`,
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          authorization: "Bearer test-access-token-value-long-enough",
        }),
      }),
    );
  });

  it("applies municipality filters and a durable office cursor", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse([
        contract({ contractId: 1, organizationNumber: 900000001 }),
        contract({ contractId: 2, organizationNumber: 900000002 }),
        contract({
          contractId: 3,
          organizationNumber: 900000003,
          municipalityNumber: "3201",
          municipalityName: "Bærum",
        }),
      ]),
    ) as unknown as typeof fetch;
    const provider = createDiscoveryFlrProvider({
      fetchImpl,
      accessTokenProvider: async () => "test-access-token-value-long-enough",
      beforeContractsRequest: async () => undefined,
    });

    const result = await provider.search(
      input({ municipalityNumbers: ["0301"], maxResults: 1, sourceOffset: 1 }),
    );

    expect(
      result.candidates.map((candidate) => candidate.organizationNumber),
    ).toEqual(["900000002"]);
    expect(result.sourceOffsetStart).toBe(1);
    expect(result.sourceOffsetNext).toBe(2);
    expect(result.hasMoreSourceResults).toBe(false);
  });

  it("retries bounded 429 and 503 responses without leaking the token", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 429, { "retry-after": "0" }))
      .mockResolvedValueOnce(jsonResponse({}, 503))
      .mockResolvedValueOnce(jsonResponse([contract({ contractId: 1 })]));
    const wait = vi.fn(async () => undefined);
    const provider = createDiscoveryFlrProvider({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      accessTokenProvider: async () => "sensitive-access-token-value",
      beforeContractsRequest: async () => undefined,
      sleep: wait,
    });

    const result = await provider.search(input());

    expect(result.candidates).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(result)).not.toContain(
      "sensitive-access-token-value",
    );
  });

  it("maps unauthorized and malformed responses to safe registry errors", async () => {
    const unauthorized = createDiscoveryFlrProvider({
      fetchImpl: vi.fn(async () =>
        jsonResponse({ detail: "secret" }, 401),
      ) as unknown as typeof fetch,
      accessTokenProvider: async () => "sensitive-access-token-value",
      beforeContractsRequest: async () => undefined,
    });
    await expect(unauthorized.search(input())).rejects.toMatchObject<
      Partial<DiscoveryRegistryError>
    >({ code: "upstream_unavailable", httpStatus: 401, retryable: false });

    const malformed = createDiscoveryFlrProvider({
      fetchImpl: vi.fn(async () =>
        jsonResponse({ contracts: [] }),
      ) as unknown as typeof fetch,
      accessTokenProvider: async () => "test-access-token-value-long-enough",
      beforeContractsRequest: async () => undefined,
    });
    await expect(malformed.search(input())).rejects.toMatchObject<
      Partial<DiscoveryRegistryError>
    >({ code: "invalid_response" });
  });

  it("creates a standards-compliant Maskinporten JWT bearer grant", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
    let assertion = "";
    const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
      if (String(url) === FLR_ENDPOINTS.test.tokenUrl) {
        const form = new URLSearchParams(String(init?.body));
        assertion = form.get("assertion") ?? "";
        expect(form.get("grant_type")).toBe(
          "urn:ietf:params:oauth:grant-type:jwt-bearer",
        );
        return jsonResponse({
          access_token: "maskinporten-access-token-long-enough",
          token_type: "Bearer",
          expires_in: 120,
        });
      }
      return jsonResponse([]);
    }) as unknown as typeof fetch;
    const provider = createDiscoveryFlrProvider({
      fetchImpl,
      env: {
        LEADGRID_DISCOVERY_FLR_ENABLED: "true",
        LEADGRID_FLR_ENVIRONMENT: "test",
        LEADGRID_FLR_MASKINPORTEN_CLIENT_ID: "client-id",
        LEADGRID_FLR_MASKINPORTEN_KEY_ID: "key-id",
        LEADGRID_FLR_MASKINPORTEN_PRIVATE_KEY: privateKey
          .export({ type: "pkcs8", format: "pem" })
          .toString(),
      },
      beforeContractsRequest: async () => undefined,
      now: () => new Date("2026-09-12T10:00:00Z"),
    });

    await provider.search(input());

    const decoded = jwt.verify(assertion, publicKey, {
      algorithms: ["RS256"],
      // Utstederen, ikke token-endepunktet. Denne testen påsto tidligere
      // tokenUrl — altså akkurat den verdien koden sendte — og var derfor
      // grønn mens Maskinporten ville svart invalid_grant.
      audience: FLR_ENDPOINTS.test.issuer,
      issuer: "client-id",
      clockTimestamp: Date.parse("2026-09-12T10:00:00Z") / 1_000,
    }) as Record<string, unknown>;
    expect(decoded.scope).toBe("nhn:flr/export");
    expect(decoded.exp).toBe(Number(decoded.iat) + 120);
    expect(decoded.jti).toEqual(expect.any(String));
    expect(jwt.decode(assertion, { complete: true })?.header.kid).toBe(
      "key-id",
    );
  });

  it("refreshes a rejected cached Maskinporten token once", async () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    let tokenCalls = 0;
    let contractCalls = 0;
    const authorizations: string[] = [];
    const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
      if (String(url) === FLR_ENDPOINTS.test.tokenUrl) {
        tokenCalls += 1;
        return jsonResponse({
          access_token: `maskinporten-access-token-${tokenCalls}-long-enough`,
          expires_in: 120,
        });
      }
      contractCalls += 1;
      authorizations.push(
        new Headers(init?.headers).get("authorization") ?? "",
      );
      return contractCalls === 1 ? jsonResponse({}, 401) : jsonResponse([]);
    }) as unknown as typeof fetch;
    const provider = createDiscoveryFlrProvider({
      fetchImpl,
      env: {
        LEADGRID_DISCOVERY_FLR_ENABLED: "true",
        LEADGRID_FLR_ENVIRONMENT: "test",
        LEADGRID_FLR_MASKINPORTEN_CLIENT_ID: "client-id",
        LEADGRID_FLR_MASKINPORTEN_KEY_ID: "key-id",
        LEADGRID_FLR_MASKINPORTEN_PRIVATE_KEY: privateKey
          .export({ type: "pkcs8", format: "pem" })
          .toString(),
      },
      beforeContractsRequest: async () => undefined,
    });

    const result = await provider.search(input());

    expect(result.candidates).toEqual([]);
    expect(tokenCalls).toBe(2);
    expect(contractCalls).toBe(2);
    expect(authorizations).toEqual([
      "Bearer maskinporten-access-token-1-long-enough",
      "Bearer maskinporten-access-token-2-long-enough",
    ]);
  });

  it("fails closed when production credentials have not been enabled", async () => {
    const provider = createDiscoveryFlrProvider({ env: {} });
    await expect(provider.search(input())).rejects.toMatchObject<
      Partial<DiscoveryRegistryError>
    >({ code: "upstream_unavailable", retryable: false });
  });
});

describe("felter slik FLR faktisk leverer dem", () => {
  // Formene under er målt mot api.offentlig.test.flr.nhn.no 2026-09-24,
  // ikke funnet på. Begge testene var røde før fiksene.

  it("padder Oslos kommunenummer til fire siffer", async () => {
    // FLR skriver «301», ikke «0301». BRREG, territoriene og Kartverket
    // bruker firesifret. 985 av 6 564 avtaler var Oslo, og alle mistet
    // kommunenummeret sitt — landets største marked falt ut av enhver
    // filtrering på kommune.
    const fetchImpl = vi.fn(async () =>
      jsonResponse([contract({ contractId: 1, municipalityNumber: "301" })]),
    );
    const provider = createDiscoveryFlrProvider({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      accessTokenProvider: async () => "test-access-token-value-long-enough",
      beforeContractsRequest: async () => undefined,
    });

    const { candidates } = await provider.search(input());

    expect(candidates[0].municipalityNumber).toBe("0301");
    expect(candidates[0].municipality).toBe("Oslo");
  });

  it("velger besøksadressen, ikke postadressen", async () => {
    // 5 911 kontorer har begge. For 1 901 peker de ulike steder, og
    // postadressen lå først for 2 738 av dem. Provideren tok første rad i
    // arrayet, så en selger kunne bli sendt til en postboks.
    const base = contract({ contractId: 1 });
    const fetchImpl = vi.fn(async () =>
      jsonResponse([
        {
          ...base,
          office: {
            ...base.office,
            addresses: [
              {
                streetAddress: "Postboks 44 Sentrum",
                postalCode: 101,
                city: "OSLO",
                addressType: { value: "PST", name: "Postadresse" },
              },
              {
                streetAddress: "Storgata 1",
                postalCode: 159,
                city: "OSLO",
                addressType: { value: "RES", name: "Besøksadresse" },
              },
            ],
          },
        },
      ]),
    );
    const provider = createDiscoveryFlrProvider({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      accessTokenProvider: async () => "test-access-token-value-long-enough",
      beforeContractsRequest: async () => undefined,
    });

    const { candidates } = await provider.search(input());

    expect(candidates[0].address).toBe("Storgata 1");
    expect(candidates[0].postalCode).toBe("0159");
  });

  it("hopper over Coordinates-rader, som er tomme skall", async () => {
    // 717 slike i registeret. Ingen lat/lon, tom gate, postnummer 0 —
    // ikke gratis geokoding, bare en rad som ville tømt adressefeltet.
    const base = contract({ contractId: 1 });
    const fetchImpl = vi.fn(async () =>
      jsonResponse([
        {
          ...base,
          office: {
            ...base.office,
            addresses: [
              {
                streetAddress: "",
                postalCode: 0,
                city: "",
                addressType: { value: "Coordinates", name: "Geografiske koordinater" },
              },
              {
                streetAddress: "Storgata 1",
                postalCode: 159,
                city: "OSLO",
                addressType: { value: "RES", name: "Besøksadresse" },
              },
            ],
          },
        },
      ]),
    );
    const provider = createDiscoveryFlrProvider({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      accessTokenProvider: async () => "test-access-token-value-long-enough",
      beforeContractsRequest: async () => undefined,
    });

    const { candidates } = await provider.search(input());

    expect(candidates[0].address).toBe("Storgata 1");
  });
});

describe("når NHN taper kappløpet med sin egen timeout", () => {
  // Produksjonsendepunktet bruker 13–15 s på å generere 23,5 MB og har en
  // gateway-timeout på 15. Begge utfallene under er målt 2026-09-24.

  it("prøver på nytt etter 504, og lykkes når cachen er varm", async () => {
    // 504-kroppen er 24 bytes. Før denne fiksen ble 504 kastet umiddelbart:
    // retry-listen hadde bare 429 og 503.
    let kall = 0;
    const fetchImpl = vi.fn(async () => {
      kall += 1;
      if (kall < 3) {
        return new Response('{"error":"timeout"}', {
          status: 504,
          headers: { "content-type": "application/json" },
        });
      }
      return jsonResponse([contract({ contractId: 1 })]);
    });
    const provider = createDiscoveryFlrProvider({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      accessTokenProvider: async () => "test-access-token-value-long-enough",
      beforeContractsRequest: async () => undefined,
      sleep: async () => undefined,
    });

    const { candidates } = await provider.search(input());

    expect(kall).toBe(3);
    expect(candidates).toHaveLength(1);
  });

  it("prøver på nytt når strømmen dør MENS kroppen lastes ned", async () => {
    // Statuslinjen kom med 200, så retry-løkka var alt ute av bildet da
    // nedlastingen røk. Kroppen leses nå inne i løkka.
    let kall = 0;
    const fetchImpl = vi.fn(async () => {
      kall += 1;
      if (kall === 1) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          arrayBuffer: async () => {
            throw new TypeError("terminated");
          },
        } as unknown as Response;
      }
      return jsonResponse([contract({ contractId: 1 })]);
    });
    const provider = createDiscoveryFlrProvider({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      accessTokenProvider: async () => "test-access-token-value-long-enough",
      beforeContractsRequest: async () => undefined,
      sleep: async () => undefined,
    });

    const { candidates } = await provider.search(input());

    expect(kall).toBe(2);
    expect(candidates).toHaveLength(1);
  });

  it("prøver IKKE på nytt når svaret er ugyldig, men komplett", async () => {
    // Et ødelagt svar blir ikke gyldig av å hentes igjen. Dokumentet under
    // ender på «}» — det er helt, bare feil. Da er nytt forsøk bortkastet.
    let kall = 0;
    const fetchImpl = vi.fn(async () => {
      kall += 1;
      return new Response("{ ikke json }", {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const provider = createDiscoveryFlrProvider({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      accessTokenProvider: async () => "test-access-token-value-long-enough",
      beforeContractsRequest: async () => undefined,
      sleep: async () => undefined,
    });

    await expect(provider.search(input())).rejects.toMatchObject({
      code: "invalid_response",
    });
    expect(kall).toBe(1);
  });
});

describe("avkortet kropp", () => {
  it("prøver på nytt når JSON-en stopper midt i", async () => {
    // Det farligste utfallet vi målte: gatewayen svarer 200, begynner å
    // strømme 23,5 MB, og kutter når dens egen 15-sekundersgrense løper ut.
    // arrayBuffer() kaster IKKE — den returnerer de delvise bytene. Uten
    // denne sjekken meldte vi «ugyldig respons» om et transportbrudd, og ga
    // opp på noe som ville lyktes ved neste forsøk.
    let kall = 0;
    const fetchImpl = vi.fn(async () => {
      kall += 1;
      if (kall === 1) {
        return new Response('[{"id":1,"office":{"organizationNu', {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return jsonResponse([contract({ contractId: 1 })]);
    });
    const provider = createDiscoveryFlrProvider({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      accessTokenProvider: async () => "test-access-token-value-long-enough",
      beforeContractsRequest: async () => undefined,
      sleep: async () => undefined,
    });

    const { candidates } = await provider.search(input());

    expect(kall).toBe(2);
    expect(candidates).toHaveLength(1);
  });
});
