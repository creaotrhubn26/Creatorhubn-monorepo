import { describe, expect, it, vi } from "vitest";

import {
  MAX_PLACEMENT_ATTEMPTS,
  classifyPlacement,
  parseNorwegianAddress,
  sammeSted,
  utvidGateforkortelser,
  placeLeadAfterApproval,
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

describe("placeLeadAfterApproval", () => {
  const project = {
    id: "p1",
    organizationId: "11111111-1111-4111-8111-111111111111",
  } as never;

  const treff = {
    representasjonspunkt: { lat: 59.91, lon: 10.75 },
    postnummer: "0155",
    poststed: "OSLO",
    adressetekst: "Storgata 1",
    kommunenavn: "OSLO",
  };

  function pool(leadRader: unknown[], husket: unknown[] = []) {
    const query = vi.fn(async (sql: string) => {
      const tekst = String(sql);
      if (tekst.includes("leadgrid_lead_placement_decisions")) {
        if (tekst.trimStart().startsWith("INSERT")) return { rows: [], rowCount: 1 };
        return { rows: husket, rowCount: husket.length };
      }
      if (tekst.includes("UPDATE crm_customers")) return { rows: [], rowCount: 1 };
      return { rows: leadRader, rowCount: leadRader.length };
    });
    return { pool: { query } as never, query };
  }

  it("plasserer leaden med én gang når adressen er entydig", async () => {
    const { pool: p, query } = pool([lead]);
    const hent = vi.fn(async () => new Response(JSON.stringify({ adresser: [treff] })));
    const utfall = await placeLeadAfterApproval(p, {
      project,
      leadId: "l1",
      fetchImpl: hent as never,
    });
    expect(utfall).toBe("placed");
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE crm_customers"),
      expect.arrayContaining([59.91, 10.75]),
    );
  });

  it("gjør ingenting når leaden allerede har koordinater", async () => {
    // Spørringen filtrerer på manglende plassering, så ingen rad = ferdig.
    const { pool: p } = pool([]);
    const hent = vi.fn();
    expect(
      await placeLeadAfterApproval(p, {
        project,
        leadId: "l1",
        fetchImpl: hent as never,
      }),
    ).toBe("skipped");
    expect(hent).not.toHaveBeenCalled();
  });

  it("plasserer ingenting når adressen er tvetydig", async () => {
    const { pool: p, query } = pool([{ ...lead, postal_code: null }]);
    const hent = vi.fn(async () =>
      new Response(
        JSON.stringify({
          adresser: [
            treff,
            { ...treff, representasjonspunkt: { lat: 63.43, lon: 10.39 } },
          ],
        }),
      ),
    );
    expect(
      await placeLeadAfterApproval(p, {
        project,
        leadId: "l1",
        fetchImpl: hent as never,
      }),
    ).toBe("ambiguous");
    expect(
      query.mock.calls.some(([sql]) => String(sql).includes("UPDATE crm_customers")),
    ).toBe(false);
  });

  it("bruker et bekreftet svar uten å spørre Kartverket", async () => {
    const { pool: p } = pool([lead], [{ latitude: 59.91, longitude: 10.75 }]);
    const hent = vi.fn();
    expect(
      await placeLeadAfterApproval(p, {
        project,
        leadId: "l1",
        fetchImpl: hent as never,
      }),
    ).toBe("placed");
    expect(hent).not.toHaveBeenCalled();
  });
});

describe("parseNorwegianAddress", () => {
  const tom = { id: "x", name: "x", address: null, postal_code: null, city: null };

  it("deler opp adressen slik den faktisk er lagret i produksjon", () => {
    // Alle uplasserte leads i basen 2026-09-22 så slik ut: hele adressen i
    // ett felt, tomme kolonner. Kartverket gir null treff på hele strengen.
    expect(
      parseNorwegianAddress({
        ...tom,
        address: "Vaskerelven 14, 5014 Bergen, Norge",
      }),
    ).toEqual({ street: "Vaskerelven 14", postalCode: "5014", city: "Bergen" });
  });

  it("kaster stedsnavnet foran gata", () => {
    // «Spikersuppa» er et sted, ikke en adresse. Kartverket kjenner det ikke.
    expect(
      parseNorwegianAddress({
        ...tom,
        address: "Spikersuppa, Karl Johans gt. 41, 0162 Oslo, Norge",
      }),
    ).toEqual({
      // Forkortelsen skrives samtidig ut — Kartverket kjenner bare «gate».
      street: "Karl Johans gate 41",
      postalCode: "0162",
      city: "Oslo",
    });
  });

  it("lar kolonnene vinne når de er fylt ut", () => {
    expect(
      parseNorwegianAddress({
        ...tom,
        address: "Ole Steens gate 10",
        postal_code: "3015",
        city: "Drammen",
      }),
    ).toEqual({ street: "Ole Steens gate 10", postalCode: "3015", city: "Drammen" });
  });

  it("takler en ren gateadresse uten mer", () => {
    expect(parseNorwegianAddress({ ...tom, address: "Storgata 1" })).toEqual({
      street: "Storgata 1",
      postalCode: null,
      city: null,
    });
  });

  it("takler poststed uten postnummer", () => {
    expect(
      parseNorwegianAddress({ ...tom, address: "Storgata 1, Oslo, Norge" }),
    ).toEqual({ street: "Storgata 1", postalCode: null, city: "Oslo" });
  });

  it("gir null gate når adressen er tom", () => {
    expect(parseNorwegianAddress(tom).street).toBeNull();
  });

  it("gjør de fire ekte adressene søkbare", () => {
    const ekte = [
      "Vaskerelven 14, 5014 Bergen, Norge",
      "Kvernveien 27, 3043 Drammen, Norge",
      "Spikersuppa, Karl Johans gt. 41, 0162 Oslo, Norge",
      "Ekebergveien 101, 1178 Oslo, Norge",
    ];
    for (const address of ekte) {
      const params = placementQueryFor({ ...tom, address });
      expect(params, address).not.toBeNull();
      expect(params?.get("adressetekst"), address).not.toContain(",");
      expect(params?.get("postnummer"), address).toMatch(/^\d{4}$/);
    }
  });
});

describe("utvidGateforkortelser", () => {
  it("skriver ut gt. som gate — uten punktum", () => {
    // «Karl Johans gt. 41» gir null treff hos Kartverket, også i
    // fritekstsøket. «Karl Johans gate 41» gir to.
    expect(utvidGateforkortelser("Karl Johans gt. 41")).toBe("Karl Johans gate 41");
    expect(utvidGateforkortelser("Karl Johans gt 41")).toBe("Karl Johans gate 41");
  });

  it("rører ikke gatenavn som allerede er skrevet ut", () => {
    expect(utvidGateforkortelser("Ole Steens gate 10")).toBe("Ole Steens gate 10");
    expect(utvidGateforkortelser("Ekebergveien 101")).toBe("Ekebergveien 101");
  });

  it("tar ikke gt inne i et ord", () => {
    expect(utvidGateforkortelser("Bregtveien 4")).toBe("Bregtveien 4");
  });
});

describe("sammeSted", () => {
  it("regner 41A og 41B som samme sted", () => {
    // Elleve meter fra hverandre. Å be brukeren velge mellom dem er å be om
    // en avgjørelse uten innhold.
    expect(
      sammeSted(
        { latitude: 59.91439, longitude: 10.73727 },
        { latitude: 59.91449, longitude: 10.73727 },
      ),
    ).toBe(true);
  });

  it("skiller Oslo fra Trondheim", () => {
    expect(
      sammeSted(
        { latitude: 59.91, longitude: 10.75 },
        { latitude: 63.43, longitude: 10.39 },
      ),
    ).toBe(false);
  });

  it("skiller to adresser i samme by", () => {
    // Drøyt to kilometer — ulike bygg, ulikt oppmøtested.
    expect(
      sammeSted(
        { latitude: 59.91439, longitude: 10.73727 },
        { latitude: 59.89164, longitude: 10.77832 },
      ),
    ).toBe(false);
  });
});
