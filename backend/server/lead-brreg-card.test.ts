import { describe, expect, it } from "vitest";

import { extractOrgNrFromText, namesMatchForAutoLink } from "./lead-brreg-service.js";

describe("extractOrgNrFromText (visittkort-OCR)", () => {
  it("finner mod11-gyldig org.nr i vanlige formater", () => {
    // 937 518 684 (Creatorhub AS fra Addendum-avtalen) er mod11-gyldig
    expect(extractOrgNrFromText("Creatorhub AS · Org.nr: 937 518 684 · Lørenskog")).toBe("937518684");
    expect(extractOrgNrFromText("org nr 937.518.684 MVA")).toBe("937518684");
    expect(extractOrgNrFromText("936 564 046")).toBe("936564046"); // MedInnova
  });

  it("forkaster tall som ikke består mod11 (telefonnumre o.l.)", () => {
    expect(extractOrgNrFromText("Ring oss: 123 456 789")).toBeNull();
    expect(extractOrgNrFromText("Mob: 934 567 891")).toBeNull();
    expect(extractOrgNrFromText("ingen tall her")).toBeNull();
  });

  it("hopper over ugyldige kandidater og finner den gyldige", () => {
    expect(extractOrgNrFromText("tlf 123 456 789, org 937 518 684")).toBe("937518684");
  });
});

describe("namesMatchForAutoLink brukt på firmanavn fra kort", () => {
  it("firmanavn ↔ BRREG-navn med org-form-suffiks matcher; vage navn gjør ikke", () => {
    expect(namesMatchForAutoLink("Creatorhub", "CREATORHUB AS")).toBe(true);
    expect(namesMatchForAutoLink("Hansen", "Hansen Bygg og Anlegg AS")).toBe(false);
  });
});
