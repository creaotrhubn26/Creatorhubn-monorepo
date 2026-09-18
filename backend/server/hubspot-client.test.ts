import { describe, expect, it, vi } from "vitest";
import { CONTACTS_PAGE_1, CONTACTS_PAGE_2, OWNERS, PIPELINE_SALG_NORGE } from "./hubspot-migration-fixtures";
import {
  BURST_LIMIT_FREE,
  BURST_WINDOW_MS,
  HUBSPOT_API_VERSION,
  HubSpotRequestError,
  createHubSpotClient,
  type HubSpotClientOptions,
} from "./hubspot-client";

/** Svar-bygger som slipper å dra inn en ekte Response. */
function reply(status: number, body: unknown, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => headers[k] ?? null },
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  } as unknown as Response;
}

/** Klokke som bare beveger seg når testen eller sleep() sier fra. */
function fakeClock(start = 1_000_000) {
  let t = start;
  return {
    now: () => t,
    sleep: vi.fn(async (ms: number) => {
      t += ms;
    }),
    advance: (ms: number) => {
      t += ms;
    },
  };
}

function build(fetchImpl: unknown, extra: Partial<HubSpotClientOptions> = {}) {
  const clock = fakeClock();
  const client = createHubSpotClient({
    accessToken: "pat-na1-test",
    fetchImpl: fetchImpl as typeof fetch,
    now: clock.now,
    sleep: clock.sleep,
    ...extra,
  });
  return { client, clock };
}

describe("autentisering og forespørselsform", () => {
  it("sender Private App-tokenet som Bearer mot det datostemplede API-et", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(reply(200, { results: [] }));
    const { client } = build(fetchImpl);
    await client.listAll("contacts", ["email", "firstname"]);

    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toContain(`https://api.hubapi.com/crm/objects/${HUBSPOT_API_VERSION}/contacts`);
    expect(init.headers.Authorization).toBe("Bearer pat-na1-test");
    const query = new URL(String(url)).searchParams;
    expect(query.get("limit")).toBe("100");
    expect(query.get("properties")).toBe("email,firstname");
  });
});

describe("paginering", () => {
  it("følger after-cursoren til siste side og samler alt", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(reply(200, CONTACTS_PAGE_1))
      .mockResolvedValueOnce(reply(200, CONTACTS_PAGE_2));
    const { client } = build(fetchImpl);

    const all = await client.listAll("contacts", []);

    expect(all).toHaveLength(5);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(new URL(String(fetchImpl.mock.calls[0][0])).searchParams.get("after")).toBeNull();
    expect(new URL(String(fetchImpl.mock.calls[1][0])).searchParams.get("after")).toBe("3003");
  });

  it("stopper i stedet for å gå i evig runde hvis cursoren gjentar seg", async () => {
    const looping = { results: [], paging: { next: { after: "samme" } } };
    const fetchImpl = vi.fn().mockResolvedValue(reply(200, looping));
    const { client } = build(fetchImpl);

    await expect(client.listAll("contacts", [])).rejects.toMatchObject({
      reason: "unexpected",
      userMessage: expect.stringContaining("evig runde"),
    });
  });
});

describe("rate-limit", () => {
  it("bremser selv før burst-grensen sprenges", async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => reply(200, { results: [] }));
    const { client, clock } = build(fetchImpl);

    // Ett kall per listAll; kjør akkurat over grensen.
    for (let i = 0; i < BURST_LIMIT_FREE; i += 1) {
      await client.listAll("contacts", []);
    }
    expect(clock.sleep).not.toHaveBeenCalled();

    await client.listAll("contacts", []);
    expect(clock.sleep).toHaveBeenCalledTimes(1);
    expect(client.stats().throttleWaitMs).toBeGreaterThan(0);
    expect(client.stats().throttleWaitMs).toBeLessThanOrEqual(BURST_WINDOW_MS);
  });

  it("slipper å vente når kallene er spredt utover vinduet", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(reply(200, { results: [] }));
    const { client, clock } = build(fetchImpl);

    for (let i = 0; i < BURST_LIMIT_FREE + 5; i += 1) {
      await client.listAll("contacts", []);
      clock.advance(200); // 5 kall/sekund er godt under grensen
    }
    expect(clock.sleep).not.toHaveBeenCalled();
  });

  it("respekterer Retry-After på 429 og prøver igjen", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(reply(429, "slow down", { "Retry-After": "7" }))
      .mockResolvedValueOnce(reply(200, { results: [] }));
    const { client, clock } = build(fetchImpl);

    await client.listAll("contacts", []);

    expect(clock.sleep).toHaveBeenCalledWith(7000);
    expect(client.stats().retries).toBe(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("gir opp med en forklaring når 429 ikke slipper taket", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(reply(429, "nope"));
    const { client } = build(fetchImpl, { maxRetries: 2 });

    await expect(client.listAll("contacts", [])).rejects.toMatchObject({ reason: "rate_limited" });
    expect(fetchImpl).toHaveBeenCalledTimes(3); // første + to forsøk
  });
});

describe("feil kunden må forstå", () => {
  it("sier at tokenet må lages på nytt ved 401", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(reply(401, "expired"));
    const { client } = build(fetchImpl);
    const error = await client.listAll("contacts", []).catch((e) => e as HubSpotRequestError);

    expect(error).toBeInstanceOf(HubSpotRequestError);
    expect(error.reason).toBe("invalid_token");
    expect(error.userMessage).toContain("Private App-token");
  });

  it("peker på manglende lesescope ved 403, og prøver ikke igjen", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(reply(403, "missing scope"));
    const { client } = build(fetchImpl);
    const error = await client.listAll("contacts", []).catch((e) => e as HubSpotRequestError);

    expect(error.reason).toBe("missing_scope");
    expect(error.userMessage).toContain("lesescopet");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("prøver igjen ved 5xx og lykkes når HubSpot kommer tilbake", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(reply(503, "down"))
      .mockResolvedValueOnce(reply(200, { results: [] }));
    const { client } = build(fetchImpl);

    await expect(client.listAll("contacts", [])).resolves.toEqual([]);
    expect(client.stats().retries).toBe(1);
  });

  it("prøver igjen når nettverket svikter, og forklarer hvis det ikke går", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNRESET"));
    const { client } = build(fetchImpl, { maxRetries: 1 });

    const error = await client.listAll("contacts", []).catch((e) => e as HubSpotRequestError);
    expect(error.reason).toBe("hubspot_unavailable");
    expect(error.userMessage).toContain("prøver igjen");
  });
});

describe("assosiasjoner", () => {
  it("deler opp i batcher på 100 og gir tom liste for id-er uten treff", async () => {
    const ids = Array.from({ length: 150 }, (_, i) => String(i + 1));
    const fetchImpl = vi.fn().mockResolvedValue(reply(200, {
      results: [{ from: { id: "1" }, to: [{ toObjectId: "7001", associationTypes: [{ category: "HUBSPOT_DEFINED", typeId: 1, label: "Primary" }] }] }],
    }));
    const { client } = build(fetchImpl);

    const result = await client.listAssociations("contacts", "companies", ids);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.inputs).toHaveLength(100);
    expect(result["1"][0].toObjectId).toBe("7001");
    expect(result["150"]).toEqual([]);
    expect(Object.keys(result)).toHaveLength(150);
  });
});

describe("eiere og pipelines", () => {
  it("henter eiere over flere sider", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(reply(200, { results: [OWNERS[0]], paging: { next: { after: "550001" } } }))
      .mockResolvedValueOnce(reply(200, { results: [OWNERS[1]] }));
    const { client } = build(fetchImpl);

    const owners = await client.listOwners();
    expect(owners).toHaveLength(2);
    expect(owners[1].archived).toBe(true);
  });

  it("henter kundens egne pipelines med stagene sine", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(reply(200, { results: [PIPELINE_SALG_NORGE] }));
    const { client } = build(fetchImpl);

    const pipelines = await client.listPipelines("deals");
    // Stien er /crm/pipelines/<versjon>/<objekt>, ikke /crm/<versjon>/pipelines/...
    // Den feilen ga 404 mot ekte API og ble fanget først der.
    expect(String(fetchImpl.mock.calls[0][0])).toContain(`/crm/pipelines/${HUBSPOT_API_VERSION}/deals`);
    expect(pipelines[0].stages.map((s) => s.id)).toContain("kontrakt_til_signering");
  });
});
