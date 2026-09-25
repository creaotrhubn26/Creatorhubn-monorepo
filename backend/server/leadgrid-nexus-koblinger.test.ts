/**
 * Rekkefølgen på «hvem snakker du med».
 *
 * Rollestrengene under er hentet fra produksjon, ikke funnet på: en
 * opptelling av enrichment_data->'contacts' i crm_customers ga nøyaktig
 * disse sju verdiene. Testen feiler hvis noen rangerer en vara over en
 * daglig leder, eller hvis BRREG-strengene endrer seg under føttene på oss.
 */
import { describe, expect, it } from "vitest";
import { personVekt } from "./leadgrid-nexus-koblinger.js";

const EKTE_ROLLER = [
  "Styremedlem",
  "Styrets leder",
  "Daglig leder",
  "Varamedlem",
  "Innehaver",
  "Kontaktperson",
  "Deltaker med delt ansvar",
];

describe("personVekt", () => {
  it("setter daglig leder øverst og vara nederst", () => {
    const sortert = [...EKTE_ROLLER].sort((a, b) => personVekt(b) - personVekt(a));
    expect(sortert[0]).toBe("Daglig leder");
    expect(sortert[sortert.length - 1]).toBe("Varamedlem");
  });

  it("rangerer vara under et ordinært styremedlem", () => {
    expect(personVekt("Varamedlem")).toBeLessThan(personVekt("Styremedlem"));
  });

  it("gir eiere i ANS/DA og ENK samme vekt", () => {
    expect(personVekt("Deltaker med delt ansvar")).toBe(personVekt("Innehaver"));
  });

  it("gir ingen ekte rolle fallback-vekten", () => {
    // Faller en rolle til 20, betyr det at BRREG har endret strengen.
    for (const rolle of EKTE_ROLLER) expect(personVekt(rolle)).not.toBe(20);
  });
});
