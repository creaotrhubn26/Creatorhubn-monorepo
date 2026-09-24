import { describe, expect, it, vi } from "vitest";

import {
  hentHubSpotData,
  sjekkHubSpotTilgang,
  skrivMigrering,
} from "./leadgrid-hubspot-import.js";

/**
 * Svarer som HubSpot. Assosiasjons-stien må sjekkes FØRST: den inneholder
 * begge objekttypene i URL-en (/associations/contacts/companies/...), og
 * svaret har en annen konvolutt — {from, to} i stedet for objekter.
 */
function hubspotSvar(perSti: Record<string, unknown>) {
  return vi.fn(async (url: string | URL) => {
    const sti = String(url);
    if (sti.includes("/associations/")) {
      return new Response(JSON.stringify({ results: [] }), { status: 200 });
    }
    for (const [nøkkel, verdi] of Object.entries(perSti)) {
      if (sti.includes(nøkkel)) {
        return new Response(JSON.stringify(verdi), { status: 200 });
      }
    }
    return new Response(JSON.stringify({ results: [] }), { status: 200 });
  });
}

const objekt = (id: string, properties: Record<string, string>) => ({
  id,
  properties,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
});

describe("hentHubSpotData", () => {
  it("henter selskaper, kontakter og avtaler i ett uttak", async () => {
    const hent = hubspotSvar({
      "/companies": { results: [objekt("c1", { name: "Neras Direkte AS" })] },
      "/contacts": { results: [objekt("k1", { firstname: "Jon", lastname: "Hillestad" })] },
      "/deals": { results: [objekt("a1", { dealname: "Rammeavtale" })] },
    });
    const { input } = await hentHubSpotData("na-key", { fetchImpl: hent as never });
    expect(input.companies).toHaveLength(1);
    expect(input.contacts).toHaveLength(1);
    expect(input.deals).toHaveLength(1);
  });

  it("importerer resten når produktkatalogen mangler scope", async () => {
    // Evidensfilen: products/line_items gir 403 til scopene har propagert.
    // En kunde uten produktkatalog skal ikke blokkeres av den.
    const hent = vi.fn(async (url: string | URL) => {
      const sti = String(url);
      if (sti.includes("/associations/")) {
        return new Response(JSON.stringify({ results: [] }), { status: 200 });
      }
      if (sti.includes("/products") || sti.includes("/line_items")) {
        return new Response(JSON.stringify({ message: "forbidden" }), { status: 403 });
      }
      if (sti.includes("/companies")) {
        return new Response(JSON.stringify({ results: [objekt("c1", { name: "A" })] }), { status: 200 });
      }
      return new Response(JSON.stringify({ results: [] }), { status: 200 });
    });
    const { input } = await hentHubSpotData("na-key", { fetchImpl: hent as never });
    expect(input.companies).toHaveLength(1);
    expect(input.products).toEqual([]);
    expect(input.lineItems).toEqual([]);
  });

  it("rapporterer hva uttaket kostet", async () => {
    const { stats } = await hentHubSpotData("na-key", {
      fetchImpl: hubspotSvar({}) as never,
    });
    expect(stats.requests).toBeGreaterThan(0);
  });
});

describe("skrivMigrering", () => {
  const project = {
    id: "p1",
    organizationId: "11111111-1111-4111-8111-111111111111",
  } as never;

  const tomPlan = {
    customers: [], deals: [], contacts: [], products: [], lineItems: [],
    mergedIntoExisting: [], issues: [],
    counts: {
      customers: 0, deals: 0, contacts: 0, merged: 0,
      products: 0, lineItems: 0, issues: 0, silentLossPrevented: 0,
    },
  };

  function pool(finnesFraFør = false) {
    const spor: string[] = [];
    const query = vi.fn(async (sql: string) => {
      const tekst = String(sql).trim();
      spor.push(tekst.split(/\s+/).slice(0, 2).join(" "));
      if (tekst.startsWith("SELECT id::text FROM crm_customers")) {
        return { rows: finnesFraFør ? [{ id: "eksisterende" }] : [], rowCount: finnesFraFør ? 1 : 0 };
      }
      if (tekst.startsWith("INSERT") || tekst.startsWith("UPDATE")) {
        return { rows: [{ id: "ny-id" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });
    const klient = { query, release: vi.fn() };
    return { pool: { connect: async () => klient } as never, query, spor };
  }

  it("ruller tilbake når noe feiler — en halv migrering er verre enn ingen", async () => {
    const klient = {
      query: vi.fn(async (sql: string) => {
        if (String(sql).includes("INSERT INTO crm_customers")) throw new Error("brudd");
        return { rows: [], rowCount: 0 };
      }),
      release: vi.fn(),
    };
    const p = { connect: async () => klient } as never;
    await expect(
      skrivMigrering(p, {
        project,
        userId: "u1",
        plan: {
          ...tomPlan,
          customers: [{ hubspotId: "c1", name: "A", raw: {} } as never],
        },
      }),
    ).rejects.toThrow("brudd");
    const kall = klient.query.mock.calls.map(([s]) => String(s));
    expect(kall).toContain("ROLLBACK");
    expect(kall).not.toContain("COMMIT");
  });

  it("oppdaterer i stedet for å duplisere når importen kjøres om igjen", async () => {
    const { pool: p, spor } = pool(true);
    const ut = await skrivMigrering(p, {
      project,
      userId: "u1",
      plan: {
        ...tomPlan,
        customers: [{ hubspotId: "c1", name: "Neras", raw: {} } as never],
      },
    });
    expect(ut.updated).toBe(1);
    expect(spor).toContain("UPDATE crm_customers");
    expect(spor.filter((s) => s === "INSERT INTO")).toHaveLength(0);
  });

  it("hopper over avtaler vi ikke fant bedriften til", async () => {
    // Uten bedrift har avtalen ingen kunde å henge på. Å skrive den likevel
    // ville gitt en avtale uten eier i CRM-et.
    const { pool: p } = pool();
    const ut = await skrivMigrering(p, {
      project,
      userId: "u1",
      plan: {
        ...tomPlan,
        deals: [{ hubspotId: "a1", customerHubspotId: "ukjent", title: "X" } as never],
      },
    });
    expect(ut.deals).toBe(0);
  });

  it("committer når alt gikk bra", async () => {
    const { pool: p, query } = pool();
    await skrivMigrering(p, { project, userId: "u1", plan: tomPlan as never });
    const kall = query.mock.calls.map(([s]) => String(s));
    expect(kall).toContain("BEGIN");
    expect(kall).toContain("COMMIT");
  });
});

describe("sjekkHubSpotTilgang", () => {
  const svar = (perType: Record<string, number>) =>
    vi.fn(async (url: string | URL) => {
      const sti = String(url);
      for (const [type, status] of Object.entries(perType)) {
        if (sti.includes(`/${type}?`)) {
          return new Response(JSON.stringify({ results: [] }), { status });
        }
      }
      return new Response(JSON.stringify({ results: [] }), { status: 200 });
    });

  it("sier ja når alle tilganger er på plass", async () => {
    const ut = await sjekkHubSpotTilgang("na", { fetchImpl: svar({}) as never });
    expect(ut.ok).toBe(true);
    expect(ut.manglerKritisk).toEqual([]);
  });

  it("navngir scopet som mangler i stedet for å si 403", async () => {
    // Uten dette oppdager kunden først etter minutter at avtaler ikke kom med.
    const ut = await sjekkHubSpotTilgang("na", {
      fetchImpl: svar({ deals: 403 }) as never,
    });
    expect(ut.ok).toBe(false);
    expect(ut.manglerKritisk).toEqual([
      { navn: "avtaler", scope: "crm.objects.deals.read" },
    ]);
  });

  it("lar katalogen mangle uten å stoppe migreringen", async () => {
    // Evidensfilen: scopene propagerer ikke umiddelbart, og en kunde uten
    // produktkatalog skal ikke blokkeres av en katalog de ikke har.
    const ut = await sjekkHubSpotTilgang("na", {
      fetchImpl: svar({ products: 403, line_items: 403 }) as never,
    });
    expect(ut.ok).toBe(true);
    expect(ut.manglerValgfritt.map((m) => m.navn)).toEqual(["produkter", "ordrelinjer"]);
  });

  it("skiller ugyldig nøkkel fra manglende tilgang", async () => {
    const ut = await sjekkHubSpotTilgang("na", {
      fetchImpl: svar({ companies: 401 }) as never,
    });
    expect(ut.ugyldigNøkkel).toBe(true);
    expect(ut.ok).toBe(false);
  });
});

describe("framdrift under uttaket", () => {
  it("melder hver datatype med antall", async () => {
    const meldinger: Array<[string, number]> = [];
    await hentHubSpotData("na", {
      fetchImpl: vi.fn(async (url: string | URL) => {
        const sti = String(url);
        if (sti.includes("/associations/")) {
          return new Response(JSON.stringify({ results: [] }), { status: 200 });
        }
        if (sti.includes("/companies")) {
          return new Response(
            JSON.stringify({ results: [objekt("c1", { name: "A" })] }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({ results: [] }), { status: 200 });
      }) as never,
      onFramdrift: (navn, antall) => meldinger.push([navn, antall]),
    });
    expect(meldinger.map(([n]) => n)).toContain("bedrifter");
    expect(meldinger.find(([n]) => n === "bedrifter")?.[1]).toBe(1);
  });
});
