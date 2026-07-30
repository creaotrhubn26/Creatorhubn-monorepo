import { describe, it, expect } from "vitest";
import { parseSceneHeading, charactersInScene } from "./casting-screenplay-persistence.js";
import { parseFountain } from "./casting-screenplay-formats.js";

describe("parseSceneHeading", () => {
  it("deler en vanlig norsk heading", () => {
    expect(parseSceneHeading("INT. KJØKKEN - KVELD")).toMatchObject({
      intExt: "INT", setting: "KJØKKEN", timeOfDay: "KVELD",
    });
  });

  it("takler engelske tidsangivelser", () => {
    expect(parseSceneHeading("EXT. PARKING LOT - NIGHT").timeOfDay).toBe("NIGHT");
  });

  it("kjenner igjen alle INT/EXT-formene", () => {
    expect(parseSceneHeading("EXT. SKOGEN - DAG").intExt).toBe("EXT");
    expect(parseSceneHeading("EST. OSLO - DAG").intExt).toBe("EST");
    expect(parseSceneHeading("INT./EXT. BIL - DAG").intExt).toBe("INT/EXT");
    expect(parseSceneHeading("I/E BIL - DAG").intExt).toBe("INT/EXT");
  });

  it("beholder bindestreker inne i stedsnavnet", () => {
    // Deler på SISTE skilletegn — ellers ville perrongen blitt borte.
    const out = parseSceneHeading("EXT. OSLO S - PERRONG 3 - KVELD");
    expect(out.setting).toBe("OSLO S - PERRONG 3");
    expect(out.timeOfDay).toBe("KVELD");
  });

  it("takler tankestrek og komma som skilletegn", () => {
    expect(parseSceneHeading("INT. STUE – NATT").timeOfDay).toBe("NATT");
    expect(parseSceneHeading("INT. STUE, DAG").timeOfDay).toBe("DAG");
  });

  it("lar stedet stå helt når tidsangivelsen mangler", () => {
    const out = parseSceneHeading("INT. VENTEROMMET");
    expect(out.setting).toBe("VENTEROMMET");
    expect(out.timeOfDay).toBeNull();
  });

  it("tolker ikke et ukjent siste ledd som tid", () => {
    // 'BAKROMMET' er et sted, ikke et klokkeslett — det skal ikke bli time_of_day.
    const out = parseSceneHeading("INT. KAFÉ - BAKROMMET");
    expect(out.timeOfDay).toBeNull();
    expect(out.setting).toBe("KAFÉ - BAKROMMET");
  });

  it("stripper scenenummer foran headingen", () => {
    expect(parseSceneHeading("12 INT. KJØKKEN - DAG").setting).toBe("KJØKKEN");
  });

  it("beholder hele headingen som tittel", () => {
    expect(parseSceneHeading("INT.  KJØKKEN   -  KVELD").title).toBe("INT. KJØKKEN - KVELD");
  });

  it("takler tom heading uten å kaste", () => {
    expect(parseSceneHeading("").title).toBe("(uten heading)");
    expect(parseSceneHeading("" as unknown as string).intExt).toBeNull();
  });

  it("takler heading uten INT/EXT", () => {
    const out = parseSceneHeading("TILBAKEBLIKK - 1994");
    expect(out.intExt).toBeNull();
    expect(out.title).toContain("TILBAKEBLIKK");
  });
});

describe("charactersInScene", () => {
  it("henter ut replikk-karakterene i rekkefølge", () => {
    const scene = {
      heading: "INT. KJØKKEN - DAG",
      action: [],
      dialogue: [
        { character: "KARI", text: "Hei." },
        { character: "OLA", text: "Hei." },
        { character: "KARI", text: "Går det bra?" },
      ],
    };
    expect(charactersInScene(scene)).toEqual(["KARI", "OLA"]);
  });

  it("normaliserer til store bokstaver og fjerner duplikater", () => {
    const scene = {
      heading: "x", action: [],
      dialogue: [{ character: "kari", text: "a" }, { character: "KARI", text: "b" }],
    };
    expect(charactersInScene(scene)).toEqual(["KARI"]);
  });

  it("hopper over tomme navn", () => {
    const scene = {
      heading: "x", action: [],
      dialogue: [{ character: "   ", text: "a" }, { character: "OLA", text: "b" }],
    };
    expect(charactersInScene(scene)).toEqual(["OLA"]);
  });

  it("takler scene uten dialog", () => {
    expect(charactersInScene({ heading: "x", action: ["Stille."], dialogue: [] })).toEqual([]);
  });
});

describe("parser → persistering, ende til ende", () => {
  it("gjør et Fountain-manus om til scener med strukturerte felter", () => {
    const fountain = [
      "INT. KJØKKEN - MORGEN",
      "",
      "Kari står ved vinduet.",
      "",
      "KARI",
      "Er du våken?",
      "",
      "OLA",
      "Nesten.",
      "",
      "EXT. GATA - KVELD",
      "",
      "Regnet høljer ned.",
    ].join("\n");

    const parsed = parseFountain(fountain);
    expect(parsed.scenes).toHaveLength(2);

    const first = parseSceneHeading(parsed.scenes[0].heading);
    expect(first).toMatchObject({ intExt: "INT", setting: "KJØKKEN", timeOfDay: "MORGEN" });
    expect(charactersInScene(parsed.scenes[0])).toEqual(["KARI", "OLA"]);

    const second = parseSceneHeading(parsed.scenes[1].heading);
    expect(second).toMatchObject({ intExt: "EXT", setting: "GATA", timeOfDay: "KVELD" });
    expect(charactersInScene(parsed.scenes[1])).toEqual([]);
  });
});
