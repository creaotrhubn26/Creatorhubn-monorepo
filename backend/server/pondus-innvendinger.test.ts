/**
 * Innvendingene skal bli bedre av å brukes — og brukbare før de er det.
 */
import { describe, expect, it, vi } from "vitest";

import { berikInnvendinger, nøkkelord, svarPåInnvending } from "./pondus-innvendinger.js";

const ORG = "777ed5d0-1ae9-4353-b5c2-e1c4b91987ab";

function pool(rader: Array<Record<string, unknown>>, feil?: Error) {
  const query = vi.fn(async () => {
    if (feil) throw feil;
    return { rows: rader, rowCount: rader.length };
  });
  return { pool: { query } as never, query };
}

const VEEVA = {
  organizationId: ORG,
  innvending: "Vi bruker Veeva globalt",
  malsvar: "Behold Veeva. Vi er det norske laget under.",
};

describe("nøkkelord", () => {
  it("plukker ordene som skiller innvendinger fra hverandre", () => {
    expect(nøkkelord("Vi bruker Veeva globalt")).toEqual(["bruker", "veeva", "globalt"]);
  });

  it("dropper fyllord og for korte ord", () => {
    expect(nøkkelord("Vi har ikke tid nå")).toEqual(["tid"]);
  });

  it("tåler æøå", () => {
    expect(nøkkelord("Går ikke på våre kjøretøy")).toContain("kjøretøy");
  });
});

describe("svarPåInnvending", () => {
  it("bruker malsvaret når ingen har vunnet med noe bedre", async () => {
    // Dette er dagens situasjon: null vunne samtaler. Systemet skal virke
    // likevel, ikke gi selgeren et tomt felt.
    const { pool: p } = pool([]);
    const r = await svarPåInnvending(p, VEEVA);
    expect(r).toMatchObject({ svar: VEEVA.malsvar, kilde: "mal", grunnlag: 0 });
  });

  it("bruker formuleringen fra en vunnet samtale når den finnes", async () => {
    const { pool: p } = pool([{
      id: "11111111-1111-4111-8111-111111111111",
      title: "AstraZeneca — Veeva-innvendingen",
      alternative_phrasings: [
        "Veeva vet hvem dere har besøkt. Den vet ikke hvilke legekontor som finnes i Norge.",
      ],
      key_learnings: [],
      treff: 2,
    }]);
    const r = await svarPåInnvending(p, VEEVA);
    expect(r.kilde).toBe("erfaring");
    expect(r.svar).toContain("legekontor");
    expect(r.eksempelTittel).toBe("AstraZeneca — Veeva-innvendingen");
  });

  it("faller tilbake når treffet ikke har en formulering som nevner innvendingen", async () => {
    // Et eksempel kan være vunnet uten å si noe om akkurat denne
    // innvendingen. Da er malsvaret bedre enn en tilfeldig setning.
    const { pool: p } = pool([{
      id: "x", title: "Annet", treff: 1,
      alternative_phrasings: ["Hva koster en angret ordre dere?"],
      key_learnings: [],
    }]);
    expect((await svarPåInnvending(p, VEEVA)).kilde).toBe("mal");
  });

  it("spør bare etter vunne, publiserte eksempler i samme kanal", async () => {
    const { pool: p, query } = pool([]);
    await svarPåInnvending(p, { ...VEEVA, kanal: "field" });
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("outcome = 'won'");
    expect(sql).toContain("status = 'published'");
    expect(query.mock.calls[0][1]).toContain("field");
  });

  it("gir malsvaret når basen svikter — ikke en feil midt i en samtale", async () => {
    const { pool: p } = pool([], new Error("databasen sa nei"));
    const r = await svarPåInnvending(p, VEEVA);
    expect(r).toMatchObject({ svar: VEEVA.malsvar, kilde: "mal" });
  });

  it("slår ikke opp på en innvending uten søkbare ord", async () => {
    const { pool: p, query } = pool([]);
    const r = await svarPåInnvending(p, { ...VEEVA, innvending: "Vi har ikke" });
    expect(query).not.toHaveBeenCalled();
    expect(r.kilde).toBe("mal");
  });
});

describe("berikInnvendinger", () => {
  it("beholder id og innvending, bytter bare svaret", async () => {
    const { pool: p } = pool([]);
    const ut = await berikInnvendinger(p, {
      organizationId: ORG,
      innvendinger: [
        { id: "veeva", prompt: "Vi bruker Veeva", response: "Behold den." },
        { id: "pris", prompt: "For dyrt for oss", response: "Hva koster et angret salg?" },
      ],
    });
    expect(ut.map((i) => i.id)).toEqual(["veeva", "pris"]);
    expect(ut[1].svar).toBe("Hva koster et angret salg?");
    expect(ut.every((i) => i.kilde === "mal")).toBe(true);
  });
});
