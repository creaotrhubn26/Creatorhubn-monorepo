import { describe, expect, it, vi } from "vitest";

import {
  MAX_PLACEMENT_ATTEMPTS,
  classifyPlacement,
  placeUnplacedLeads,
  placementKeyFor,
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

describe("classifyPlacement", () => {
  const punkt = (lat: number, lon: number, post = "0155", sted = "OSLO") => ({
    representasjonspunkt: { lat, lon },
    postnummer: post,
    poststed: sted,
    adressetekst: "Storgata 1",
    kommunenavn: "OSLO",
  });

  it("plasserer når ett punkt står igjen", () => {
    expect(classifyPlacement([punkt(59.91, 10.75)], lead)).toMatchObject({
      kind: "placed",
      point: { latitude: 59.91, longitude: 10.75 },
    });
  });

  it("melder tvetydighet når flere adresser passer", () => {
    // «Storgata 1» i to kommuner. Å gjette gir en pin som ser riktig ut.
    const utfall = classifyPlacement(
      [punkt(59.91, 10.75, "0155", "OSLO"), punkt(63.43, 10.39, "0155", "TRONDHEIM")],
      { ...lead, postal_code: null },
    );
    expect(utfall.kind).toBe("ambiguous");
    if (utfall.kind === "ambiguous") {
      expect(utfall.options).toHaveLength(2);
      expect(utfall.options[0].label).toContain("Storgata 1");
    }
  });

  it("regner samme punkt to ganger som ett sted", () => {
    const utfall = classifyPlacement(
      [punkt(59.91, 10.75), punkt(59.91, 10.75)],
      lead,
    );
    expect(utfall.kind).toBe("placed");
  });

  it("forkaster treff i feil postnummer", () => {
    const utfall = classifyPlacement(
      [punkt(60.39, 5.32, "5003", "BERGEN"), punkt(59.91, 10.75, "0155")],
      lead,
    );
    expect(utfall).toMatchObject({
      kind: "placed",
      point: { latitude: 59.91, longitude: 10.75 },
    });
  });

  it("forkaster 0,0", () => {
    // Nøyaktig punktet kartet filtrerer bort.
    expect(classifyPlacement([punkt(0, 0)], lead)).toEqual({ kind: "unresolved" });
  });

  it("gir uløst på tom liste", () => {
    expect(classifyPlacement([], lead)).toEqual({ kind: "unresolved" });
  });

  it("begrenser antall alternativer brukeren må lese", () => {
    const mange = Array.from({ length: 9 }, (_, i) =>
      punkt(59.9 + i / 100, 10.7 + i / 100, "0155"),
    );
    const utfall = classifyPlacement(mange, lead);
    expect(utfall.kind).toBe("ambiguous");
    if (utfall.kind === "ambiguous") expect(utfall.options).toHaveLength(5);
  });
});

describe("placementKeyFor", () => {
  it("gir samme nøkkel for samme adresse uansett skrivemåte", () => {
    expect(placementKeyFor({ ...lead, address: "  STORGATA  1 " })).toBe(
      placementKeyFor(lead),
    );
  });

  it("gir null uten sted", () => {
    expect(
      placementKeyFor({ ...lead, postal_code: null, city: null }),
    ).toBeNull();
  });
});

describe("placeUnplacedLeads", () => {
  const project = {
    id: "p1",
    organizationId: "11111111-1111-4111-8111-111111111111",
  } as never;

  /** Svarer ulikt per spørring, slik den ekte basen gjør. */
  function pool(leads: (typeof lead)[], husket: unknown[] = []) {
    const query = vi.fn(async (sql: string) => {
      const tekst = String(sql);
      if (tekst.includes("leadgrid_lead_placement_decisions")) {
        if (tekst.trimStart().startsWith("INSERT")) return { rows: [], rowCount: 1 };
        return { rows: husket, rowCount: husket.length };
      }
      if (tekst.includes("UPDATE crm_customers")) return { rows: [], rowCount: 1 };
      return { rows: leads, rowCount: leads.length };
    });
    return { pool: { query } as never, query };
  }

  function geonorge(adresser: unknown[]) {
    return vi.fn(async () => new Response(JSON.stringify({ adresser })));
  }

  const oslo = {
    representasjonspunkt: { lat: 59.91, lon: 10.75 },
    postnummer: "0155",
    poststed: "OSLO",
    adressetekst: "Storgata 1",
    kommunenavn: "OSLO",
  };

  it("skriver koordinatene når adressen er entydig", async () => {
    const { pool: p, query } = pool([lead]);
    const result = await placeUnplacedLeads(p, {
      project,
      fetchImpl: geonorge([oslo]) as never,
    });
    expect(result.placed).toBe(1);
    expect(result.ambiguous).toHaveLength(0);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE crm_customers"),
      expect.arrayContaining([59.91, 10.75, "l1"]),
    );
  });

  it("plasserer ingenting når adressen er tvetydig", async () => {
    // Brukeren skal peke. En pin i feil kommune ser like riktig ut.
    const { pool: p, query } = pool([{ ...lead, postal_code: null }]);
    const result = await placeUnplacedLeads(p, {
      project,
      fetchImpl: geonorge([
        oslo,
        { ...oslo, representasjonspunkt: { lat: 63.43, lon: 10.39 }, kommunenavn: "TRONDHEIM" },
      ]) as never,
    });
    expect(result.placed).toBe(0);
    expect(result.ambiguous).toHaveLength(1);
    expect(result.ambiguous[0].options).toHaveLength(2);
    expect(
      query.mock.calls.some(([sql]) => String(sql).includes("UPDATE crm_customers")),
    ).toBe(false);
  });

  it("gjenbruker et svar noen har bekreftet før, uten nytt oppslag", async () => {
    const { pool: p } = pool([lead], [{ latitude: 59.91, longitude: 10.75 }]);
    const hent = geonorge([oslo]);
    const result = await placeUnplacedLeads(p, {
      project,
      fetchImpl: hent as never,
    });
    expect(result.placed).toBe(1);
    expect(result.reused).toBe(1);
    expect(hent).not.toHaveBeenCalled();
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
      query.mock.calls.some(([sql]) => String(sql).includes("UPDATE crm_customers")),
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
    const mange = Array.from({ length: 200 }, (_, i) => ({ ...lead, id: `l${i}` }));
    const { pool: p, query } = pool(mange);
    await placeUnplacedLeads(p, {
      project,
      limit: 500,
      fetchImpl: geonorge([]) as never,
    });
    const grense = query.mock.calls.find(([sql]) =>
      String(sql).includes("coalesce(address"),
    )?.[1] as unknown[];
    expect(grense?.[2]).toBe(MAX_PLACEMENT_ATTEMPTS);
  });
});
