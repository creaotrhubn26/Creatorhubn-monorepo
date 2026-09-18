/**
 * Grensen som må holde: Leadgrid brukes av ANDRE BEDRIFTER. Deres vunne
 * avtaler skal aldri havne i vår Meta-pixel.
 *
 * Det er den dyreste feilen denne modulen kan gjøre. Den ville ikke feilet
 * synlig — Meta svarer 200 — men vår pixel ville lært av andres kunder, og
 * annonseoptimaliseringen vår ville blitt styrt av data som ikke er våre.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it, vi } from "vitest";
import { erLeadgridLanding } from "./leadgrid-vunnet-konvertering";

describe("erLeadgridLanding", () => {
  it("godtar leadgrid-vertene", () => {
    for (const u of [
      "https://leadgrid.no/tilbud",
      "https://www.leadgrid.no/",
      "https://leadgrid.theroleroom.com/x?y=1",
    ]) {
      expect(erLeadgridLanding(u)).toBe(true);
    }
  });

  it("avviser alt annet, inkludert domener som ligner", () => {
    for (const u of [
      "https://kundensdomene.no/kontakt",
      "https://leadgrid.no.angriper.com/",
      "https://ikke-leadgrid.no/",
      "https://creatorhubn.com/",
    ]) {
      expect(erLeadgridLanding(u)).toBe(false);
    }
  });

  it("avviser tomt og uparsbart i stedet for å gjette", () => {
    for (const u of [null, undefined, "", "ikke en url", "/relativ/sti"]) {
      expect(erLeadgridLanding(u)).toBe(false);
    }
  });
});

describe("meldVunnetAvtaleTilMeta", () => {
  const lag = (rad: Record<string, unknown> | null) => ({
    query: vi.fn(async () => ({ rows: rad ? [rad] : [], rowCount: rad ? 1 : 0 })),
  });
  const grunnlag = {
    leadId: "11111111-1111-4111-8111-111111111111",
    dealId: "22222222-2222-4222-8222-222222222222",
    organizationId: "33333333-3333-4333-8333-333333333333",
    projectId: "leadgrid-no",
    belop: 49000,
  };

  it("sender ingenting for et lead fra en annen kundes nettsted", async () => {
    const { meldVunnetAvtaleTilMeta } = await import("./leadgrid-vunnet-konvertering");
    const pool = lag({
      email: "kari@kundensdomene.no", phone: null, name: "Kari",
      fbclid: "FB123", landing_page_url: "https://kundensdomene.no/kontakt",
      belop: "49000", valuta: "NOK",
    });
    const r = await meldVunnetAvtaleTilMeta(pool as never, grunnlag);
    expect(r).toEqual({ status: "hoppet_over", grunn: "ikke_leadgrid_landingsside" });
  });

  it("sender ingenting uten fbclid — Meta kan uansett ikke matche", async () => {
    const { meldVunnetAvtaleTilMeta } = await import("./leadgrid-vunnet-konvertering");
    const pool = lag({
      email: "kari@x.no", phone: null, name: "Kari",
      fbclid: null, landing_page_url: "https://leadgrid.no/tilbud",
      belop: "49000", valuta: "NOK",
    });
    expect(await meldVunnetAvtaleTilMeta(pool as never, grunnlag)).toEqual({
      status: "hoppet_over", grunn: "ingen_fbclid",
    });
  });

  it("sender ingenting uten e-post eller telefon", async () => {
    const { meldVunnetAvtaleTilMeta } = await import("./leadgrid-vunnet-konvertering");
    const pool = lag({
      email: null, phone: null, name: "Ukjent",
      fbclid: "FB123", landing_page_url: "https://leadgrid.no/",
      belop: "49000", valuta: "NOK",
    });
    expect(await meldVunnetAvtaleTilMeta(pool as never, grunnlag)).toEqual({
      status: "hoppet_over", grunn: "ingen_identifikator",
    });
  });

  it("kaster aldri oppover når databasen svikter", async () => {
    // En annonseplattform eller et DB-blipp skal ikke velte registreringen
    // av at avtalen er vunnet.
    const { meldVunnetAvtaleTilMeta } = await import("./leadgrid-vunnet-konvertering");
    const pool = { query: vi.fn(async () => { throw new Error("nede"); }) };
    expect(await meldVunnetAvtaleTilMeta(pool as never, grunnlag)).toEqual({
      status: "hoppet_over", grunn: "unntak",
    });
  });
});

describe("kobling i workflow-motoren", () => {
  const motor = readFileSync(join(__dirname, "leadgrid-workflow-engine.ts"), "utf8");

  it("utløses bare på overgang til won", () => {
    expect(motor).toContain('event.data.to === "won"');
  });

  it("ligger i publishEvent, som alle skriveveier passerer", () => {
    // Både PATCH-endepunktet og applyStageChange publiserer hit. Lå kallet
    // i én av dem, ville den andre gått stille forbi — samme feil som
    // pipeline.stage_changed hadde før 18.09.
    const i = motor.indexOf("export async function publishEvent");
    const j = motor.indexOf("meldVunnetAvtaleTilMeta");
    expect(i).toBeGreaterThan(-1);
    expect(j).toBeGreaterThan(i);
  });
});
