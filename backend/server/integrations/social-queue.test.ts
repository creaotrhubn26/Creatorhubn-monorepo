import { describe, expect, it } from "vitest";

import { isLegalTransition } from "./social-queue.js";
import { extractNumbers, validatePostNumbers } from "./content-composer.js";
import type { GrantFact } from "./grant-application.js";

describe("isLegalTransition (J3: mennesket godkjenner)", () => {
  it("håndhever draft→approved→published og avviser snarveier", () => {
    expect(isLegalTransition("draft", "approved")).toBe(true);
    expect(isLegalTransition("draft", "published")).toBe(false); // ALDRI publisér uten godkjenning
    expect(isLegalTransition("approved", "published")).toBe(true);
    expect(isLegalTransition("published", "approved")).toBe(false);
    expect(isLegalTransition("failed", "approved")).toBe(true); // retry
    expect(isLegalTransition("rejected", "approved")).toBe(false);
  });
});

describe("tall-validatoren (pyntede tall forkastes i kode)", () => {
  const facts: GrantFact[] = [
    { n: 1, source: "regnskapsregisteret", label: "Margin", value: "median driftsmargin 4,3 %" },
    { n: 2, source: "enhetsregisteret", label: "Marked", value: "8 961 registrerte virksomheter" },
  ];

  it("normaliserer norske tallformater (mellomrom, komma)", () => {
    expect(extractNumbers("8 961 bedrifter og 4,3 % margin")).toEqual(["8961", "4.3"]);
  });

  it("godtar post der alle tall finnes i faktaene", () => {
    const v = validatePostNumbers("Visste du at norske fotografer har 4,3 % median driftsmargin? 8 961 virksomheter konkurrerer.", facts);
    expect(v.ok).toBe(true);
  });

  it("forkaster avrundede/oppdiktede tall — og navngir dem", () => {
    const v = validatePostNumbers("Norske fotografer har rundt 5 % margin og markedet teller 9 000 aktører.", facts);
    expect(v.ok).toBe(false);
    // BÅDE det avrundede prosenttallet og den avrundede tellingen fanges
    expect(v.unknownNumbers).toEqual(expect.arrayContaining(["5", "9000"]));
  });

  it("slipper gjennom årstall og små retoriske tellinger", () => {
    const v = validatePostNumbers("3 grunner fra SSB-data 2015–2026: margin 4,3 %.", facts);
    expect(v.ok).toBe(true);
  });
});
