import { describe, expect, it } from "vitest";

import { computeProgress, extractFillIns } from "./grant-workspace.js";

describe("extractFillIns (sjekklisten ER ferdig-definisjonen)", () => {
  it("finner hull, dedupliserer, tåler kolon-varianter", () => {
    const text = "Budsjett: [FYLL INN: timepriser]. Team: [FYLL INN teamets CV]. Igjen: [FYLL INN: timepriser].";
    expect(extractFillIns(text)).toEqual(["timepriser", "teamets CV"]);
  });

  it("tom/ren tekst gir tom liste", () => {
    expect(extractFillIns(null)).toEqual([]);
    expect(extractFillIns("Ferdig tekst uten hull.")).toEqual([]);
  });
});

describe("computeProgress", () => {
  it("teller ferdige, påbegynte og ÅPNE hull (done-seksjoner teller ikke)", () => {
    const p = computeProgress([
      { status: "done", fillIns: ["gammel"] },
      { status: "drafted", fillIns: ["budsjett", "cv"] },
      { status: "empty", fillIns: [] },
    ]);
    expect(p).toEqual({ total: 3, done: 1, drafted: 2, openFillIns: 2 });
  });
});
