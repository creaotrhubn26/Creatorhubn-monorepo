import { describe, expect, it } from "vitest";

import { SEGMENT_DEFINITIONS, toProspectRow } from "./prospect-segment-sync.js";
import { VERTICAL_NACE_MAP } from "./brreg-market-signal-sync.js";

describe("toProspectRow", () => {
  const base = {
    organisasjonsnummer: "999888777",
    navn: "Foto AS",
    antallAnsatte: 3,
    forretningsadresse: { kommune: "BERGEN" },
    registreringsdatoEnhetsregisteret: "2019-04-01",
  };

  it("mapper aktiv enhet med kommune og ansatte", () => {
    expect(toProspectRow(base)).toEqual({
      orgNr: "999888777",
      name: "Foto AS",
      municipality: "BERGEN",
      employees: 3,
      registeredAt: "2019-04-01",
      website: null,
    });
  });

  it("konkurs/avviklede enheter tas ALDRI inn i prospektlister", () => {
    expect(toProspectRow({ ...base, konkurs: true })).toBeNull();
    expect(toProspectRow({ ...base, underAvvikling: true })).toBeNull();
    expect(toProspectRow({ ...base, underTvangsavviklingEllerTvangsopplosning: true })).toBeNull();
  });

  it("uten orgnr/navn → null", () => {
    expect(toProspectRow({ navn: "Uten orgnr" })).toBeNull();
  });
});

describe("SEGMENT_DEFINITIONS", () => {
  it("alle segmenter peker på et sett med verifisert NACE-mapping", () => {
    for (const def of SEGMENT_DEFINITIONS) {
      expect(VERTICAL_NACE_MAP[def.setName], def.segmentKey).toBeDefined();
    }
  });
});
