import { describe, expect, it, vi } from "vitest";

import {
  MAX_PLACEMENT_ATTEMPTS,
  pickPlacement,
  placeUnplacedLeads,
  placementQueryFor,
} from "./leadgrid-lead-placement.js";

const lead = {
  id: "l1",
  name: "Aktiv Fritid Avlastning",
  address: "Storgata 1",
  postal_code: "0155",
  city: "Oslo",
};

describe("placementQueryFor", () => {
  it("krever mer enn gateadressen", () => {
    // «Storgata 1» finnes i hundre kommuner. Et oppslag uten postnummer
    // eller poststed plasserer bedriften et tilfeldig sted.
    expect(
      placementQueryFor({ ...lead, postal_code: null, city: null }),
    ).toBeNull();
  });

  it("bruker postnummer når det er gyldig", () => {
    const params = placementQueryFor(lead);
    expect(params?.get("postnummer")).toBe("0155");
    expect(params?.get("poststed")).toBeNull();
  });

  it("faller til poststed når postnummeret er ubrukelig", () => {
    const params = placementQueryFor({ ...lead, postal_code: "01" });
    expect(params?.get("postnummer")).toBeNull();
    expect(params?.get("poststed")).toBe("Oslo");
  });

  it("gir null uten adresse", () => {
    expect(placementQueryFor({ ...lead, address: "  " })).toBeNull();
  });
});

describe("pickPlacement", () => {
  it("tar første gyldige punkt", () => {
    expect(
      pickPlacement(
        [{ representasjonspunkt: { lat: 59.91, lon: 10.75 }, postnummer: "0155" }],
        lead,
      ),
    ).toEqual({ latitude: 59.91, longitude: 10.75 });
  });

  it("forkaster treff i feil postnummer", () => {
    // Kartverkets fritekstsøk kan falle tilbake til nabokommunen.
    expect(
      pickPlacement(
        [
          { representasjonspunkt: { lat: 60.39, lon: 5.32 }, postnummer: "5003" },
          { representasjonspunkt: { lat: 59.91, lon: 10.75 }, postnummer: "0155" },
        ],
        lead,
      ),
    ).toEqual({ latitude: 59.91, longitude: 10.75 });
  });

  it("forkaster 0,0", () => {
    // Nøyaktig det punktet kartet filtrerer bort.
    expect(
      pickPlacement(
        [{ representasjonspunkt: { lat: 0, lon: 0 }, postnummer: "0155" }],
        lead,
      ),
    ).toBeNull();
  });

  it("hopper over treff uten punkt", () => {
    expect(
      pickPlacement(
        [
          { postnummer: "0155" },
          { representasjonspunkt: { lat: 59.91, lon: 10.75 }, postnummer: "0155" },
        ],
        lead,
      ),
    ).toEqual({ latitude: 59.91, longitude: 10.75 });
  });

  it("gir null på tom liste", () => {
    expect(pickPlacement([], lead)).toBeNull();
  });
});

describe("placeUnplacedLeads", () => {
  const project = {
    id: "p1",
    organizationId: "11111111-1111-4111-8111-111111111111",
  } as never;

  function pool(rows: typeof lead[]) {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("UPDATE crm_customers")) return { rows: [], rowCount: 1 };
      return { rows, rowCount: rows.length };
    });
    return { pool: { query } as never, query };
  }

  it("skriver koordinatene når adressen gir treff", async () => {
    const { pool: p, query } = pool([lead]);
    const hent = vi.fn(async () =>
      new Response(
        JSON.stringify({
          adresser: [
            { representasjonspunkt: { lat: 59.91, lon: 10.75 }, postnummer: "0155" },
          ],
        }),
      ),
    );
    const result = await placeUnplacedLeads(p, {
      project,
      fetchImpl: hent as never,
    });
    expect(result.placed).toBe(1);
    expect(result.unresolved).toBe(0);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE crm_customers"),
      expect.arrayContaining([59.91, 10.75, "l1"]),
    );
  });

  it("teller adressen som uløst når Kartverket ikke svarer", async () => {
    const { pool: p, query } = pool([lead]);
    const hent = vi.fn(async () => {
      throw new Error("timeout");
    });
    const result = await placeUnplacedLeads(p, {
      project,
      fetchImpl: hent as never,
    });
    expect(result.placed).toBe(0);
    expect(result.unresolved).toBe(1);
    expect(
      query.mock.calls.some(([sql]) => String(sql).includes("UPDATE")),
    ).toBe(false);
  });

  it("hopper over leads vi ikke kan slå opp", async () => {
    const { pool: p } = pool([{ ...lead, postal_code: null, city: null }]);
    const hent = vi.fn();
    const result = await placeUnplacedLeads(p, {
      project,
      fetchImpl: hent as never,
    });
    expect(result.attempted).toBe(0);
    expect(hent).not.toHaveBeenCalled();
  });

  it("holder seg innenfor taket på eksterne oppslag", async () => {
    const mange = Array.from({ length: 200 }, (_, i) => ({
      ...lead,
      id: `l${i}`,
    }));
    const { pool: p, query } = pool(mange);
    const hent = vi.fn(async () => new Response(JSON.stringify({ adresser: [] })));
    await placeUnplacedLeads(p, { project, limit: 500, fetchImpl: hent as never });
    const grense = query.mock.calls.find(([sql]) =>
      String(sql).includes("coalesce(address"),
    )?.[1] as unknown[];
    expect(grense?.[2]).toBe(MAX_PLACEMENT_ATTEMPTS);
  });
});
