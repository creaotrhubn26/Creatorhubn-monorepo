import { describe, expect, it } from "vitest";

import { IN_SECTIONS, validateGrantDraft, type GrantFact } from "./grant-application.js";

const facts: GrantFact[] = [
  { n: 1, source: "enhetsregisteret", label: "Marked", value: "8961 virksomheter" },
  { n: 2, source: "regnskapsregisteret", label: "Margin", value: "median 4,3 %" },
  { n: 3, source: "ssb", label: "Vekst", value: "63,5 → 129,2" },
];

describe("IN_SECTIONS (research-basert struktur)", () => {
  it("dekker IN-kravene: nyhetsverdi, internasjonalt potensial, gjennomføringsevne, milepæler", () => {
    const keys = IN_SECTIONS.map((s) => s.key);
    for (const k of ["losning", "vekst", "gjennomforing", "milepaler"]) expect(keys).toContain(k);
  });
});

describe("validateGrantDraft (søknad uten fabrikkerte tall)", () => {
  it("godtar utkast som siterer beviset og markerer hull", () => {
    expect(validateGrantDraft(
      "Markedet teller 8 961 virksomheter [1] med median driftsmargin 4,3 % [2]. Budsjett: [FYLL INN: timepriser].",
      facts,
    )).toBe(true);
  });

  it("forkaster fabrikkert referanse og siterings-frie utkast", () => {
    expect(validateGrantDraft("Markedet er stort [7] og voksende [1].", facts)).toBe(false);
    expect(validateGrantDraft("Vi er innovative og markedet er enormt.", facts)).toBe(false);
  });
});
