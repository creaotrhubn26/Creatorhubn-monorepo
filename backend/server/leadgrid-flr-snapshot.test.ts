/**
 * Øyeblikksbildet skal gjøre at NHNs treghet ikke blir vår.
 *
 * Målt mot api.offentlig.flr.nhn.no 2026-09-24: 23,5 MB, 13–15 s
 * generering, 15 s gateway-timeout hos dem. Uten dette laget stiller hver
 * Discovery-kjøring seg i det kappløpet.
 */
import { describe, expect, it, vi } from "vitest";

import {
  ageHours,
  freshness,
  SNAPSHOT_MAX_STALE_MS,
  SNAPSHOT_TTL_MS,
  type FlrSnapshot,
  type FlrSnapshotStore,
} from "./leadgrid-flr-snapshot.js";
import { createDiscoveryFlrProvider } from "./leadgrid-discovery-flr-provider.js";

const NÅ = new Date("2026-09-24T12:00:00.000Z");

function snapshot(over: Partial<FlrSnapshot> = {}): FlrSnapshot {
  return {
    payload: [kontrakt()],
    contractCount: 1,
    sourceUri: "https://api.offentlig.test.flr.nhn.no/v1/contracts",
    fetchedAt: new Date(NÅ.valueOf() - 60_000),
    expiresAt: new Date(NÅ.valueOf() + SNAPSHOT_TTL_MS),
    ...over,
  };
}

function kontrakt(orgNr = 987654321) {
  return {
    id: 1,
    office: {
      organizationNumber: orgNr,
      legalName: "EKSEMPEL LEGESENTER AS",
      displayName: "Eksempel legesenter",
      addresses: [
        {
          streetAddress: "Storgata 1",
          postalCode: 159,
          city: "OSLO",
          addressType: { value: "RES", name: "Besøksadresse" },
        },
      ],
      municipality: { value: "301", name: "Oslo" },
    },
    period: { from: "2020-01-01", to: null },
    doctorCycles: [
      {
        id: 10,
        doctor: { hprNumber: 100, firstName: "Ada", lastName: "Lovelace" },
        period: { from: "2020-01-01", to: null },
      },
    ],
  };
}

function lagStore(start: FlrSnapshot | null): FlrSnapshotStore & {
  skrevet: FlrSnapshot[];
  lesninger: number;
  låser: number;
} {
  let lagret = start;
  const skrevet: FlrSnapshot[] = [];
  let lesninger = 0;
  let låser = 0;
  return {
    skrevet,
    get lesninger() { return lesninger; },
    get låser() { return låser; },
    async read() { lesninger += 1; return lagret; },
    async write(_miljø, s) { lagret = s as FlrSnapshot; skrevet.push(s as FlrSnapshot); },
    async withFetchLock(_miljø, arbeid) { låser += 1; return arbeid(); },
  } as never;
}

function svar(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function provider(store: FlrSnapshotStore, fetchImpl: typeof fetch) {
  return createDiscoveryFlrProvider({
    snapshotStore: store,
    fetchImpl,
    accessTokenProvider: async () => "test-access-token-value-long-enough",
    beforeContractsRequest: async () => undefined,
    sleep: async () => undefined,
    now: () => NÅ,
  });
}

const input = {
  query: "86.210",
  queryMode: "industry" as const,
  countryCode: "NO" as const,
  maxResults: 60,
  sourceOffset: 0,
  city: null,
  municipalityNumbers: [],
  municipalityNames: [],
};

describe("freshness", () => {
  it("ferskt så lenge det ikke har utløpt", () => {
    expect(freshness(snapshot(), NÅ)).toBe("fersk");
  });

  it("utløpt, men fortsatt brukbart, i sju døgn", () => {
    const seksDøgn = snapshot({
      expiresAt: new Date(NÅ.valueOf() - 1_000),
      fetchedAt: new Date(NÅ.valueOf() - 6 * 24 * 3_600_000),
    });
    expect(freshness(seksDøgn, NÅ)).toBe("utløpt");
    expect(ageHours(seksDøgn, NÅ)).toBe(144);
  });

  it("for gammelt når det har gått mer enn sju døgn", () => {
    expect(
      freshness(
        snapshot({
          expiresAt: new Date(NÅ.valueOf() - 1_000),
          fetchedAt: new Date(NÅ.valueOf() - SNAPSHOT_MAX_STALE_MS - 1_000),
        }),
        NÅ,
      ),
    ).toBe("for_gammel");
  });
});

describe("provideren med øyeblikksbilde", () => {
  it("rører ikke nettverket når bildet er ferskt", async () => {
    // Dette er hele poenget: ingen HTTP, ingen kappløp, ingen 504.
    const fetchImpl = vi.fn(async () => svar([kontrakt()]));
    const store = lagStore(snapshot());

    const { candidates } = await provider(store, fetchImpl as never).search(input as never);

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(candidates).toHaveLength(1);
  });

  it("henter og lagrer når det ikke finnes noe bilde", async () => {
    const fetchImpl = vi.fn(async () => svar([kontrakt()]));
    const store = lagStore(null);

    await provider(store, fetchImpl as never).search(input as never);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(store.skrevet).toHaveLength(1);
    expect(store.skrevet[0].contractCount).toBe(1);
    expect(store.skrevet[0].expiresAt.valueOf()).toBe(NÅ.valueOf() + SNAPSHOT_TTL_MS);
  });

  it("serverer et utløpt bilde når NHN ikke svarer", async () => {
    // Forsikringen. Seks timer gammel legekontoradresse er fortsatt riktig
    // adresse; en feilet kjøring er ingenting.
    const fetchImpl = vi.fn(async () => svar({ error: "timeout" }, 504));
    const gammelt = snapshot({
      payload: [kontrakt(811873012)],
      expiresAt: new Date(NÅ.valueOf() - 1_000),
      fetchedAt: new Date(NÅ.valueOf() - 7 * 3_600_000),
    });
    const store = lagStore(gammelt);

    const { candidates } = await provider(store, fetchImpl as never).search(input as never);

    expect(candidates[0].organizationNumber).toBe("811873012");
    // Den prøvde faktisk å hente friskt først.
    expect(fetchImpl).toHaveBeenCalled();
  });

  it("feiler heller enn å servere et bilde som er eldre enn sju døgn", async () => {
    const fetchImpl = vi.fn(async () => svar({ error: "timeout" }, 504));
    const store = lagStore(
      snapshot({
        expiresAt: new Date(NÅ.valueOf() - 1_000),
        fetchedAt: new Date(NÅ.valueOf() - SNAPSHOT_MAX_STALE_MS - 3_600_000),
      }),
    );

    await expect(
      provider(store, fetchImpl as never).search(input as never),
    ).rejects.toMatchObject({ code: "upstream_unavailable" });
  });

  it("tar låsen før den henter, og leser på nytt inne i den", async () => {
    // Starter to kjøringer samtidig, skal bare én hente 23,5 MB.
    const fetchImpl = vi.fn(async () => svar([kontrakt()]));
    const store = lagStore(null);

    await provider(store, fetchImpl as never).search(input as never);

    expect(store.låser).toBe(1);
    // Én lesning før låsen, én etter — den andre fanger opp et bilde en
    // parallell kjøring rakk å skrive mens vi ventet.
    expect(store.lesninger).toBe(2);
  });

  it("lar kjøringen lykkes selv om lagringen feiler", async () => {
    const fetchImpl = vi.fn(async () => svar([kontrakt()]));
    const store = lagStore(null);
    store.write = async () => {
      throw new Error("basen sa nei");
    };

    const { candidates } = await provider(store, fetchImpl as never).search(input as never);

    expect(candidates).toHaveLength(1);
  });
});
