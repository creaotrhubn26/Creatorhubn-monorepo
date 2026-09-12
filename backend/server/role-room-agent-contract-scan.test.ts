import { describe, expect, it } from "vitest";

import {
  enforceVerbatim,
  findMissingPoints,
  valueAppearsInText,
  type ContractEconomics,
} from "./role-room-agent-contract-scan.js";

const KONTRAKT = `Avtale mellom Creatorhub AS (leverandør) og MEDINNOVA AS (kunde).
Totalpris for oppdraget: kr 120.000,- eks. mva.
Betaling: 50 % (kr 60.000) ved signering, resterende ved levering 15.09.2026.
Faktura sendes som EHF med 14 dagers forfall.`;

function baseEconomics(overrides: Partial<ContractEconomics> = {}): ContractEconomics {
  return {
    supplier: "Creatorhub AS",
    client: "MEDINNOVA AS",
    totalAmount: "120 000",
    currency: "NOK",
    vatHandling: "eks. mva",
    paymentTerms: [
      { label: "Ved signering", amount: "60 000", trigger: "signering" },
      { label: "Ved levering", amount: null, trigger: "levering 15.09.2026" },
    ],
    invoicing: "EHF, 14 dagers forfall",
    deliverables: ["Film"],
    usageRights: "Full bruksrett",
    deadlines: ["15.09.2026"],
    terminationTerms: "30 dagers varsel",
    ...overrides,
  };
}

describe("valueAppearsInText (verbatim-vakt)", () => {
  it("matcher siffer-normalisert på tvers av formatering (120 000 vs kr 120.000,-)", () => {
    expect(valueAppearsInText("120 000", KONTRAKT)).toBe(true);
    expect(valueAppearsInText("15.09.2026", KONTRAKT)).toBe(true);
    expect(valueAppearsInText("999 999", KONTRAKT)).toBe(false);
  });

  it("korte tall (< 3 siffer) godtas uten sjekk — ikke identifiserende", () => {
    expect(valueAppearsInText("14 dager", KONTRAKT)).toBe(true);
    expect(valueAppearsInText("50 %", KONTRAKT)).toBe(true);
  });
});

describe("enforceVerbatim", () => {
  it("beholder verifiserte beløp, dropper hallusinerte — og rapporterer dem", () => {
    const { economics, rejected } = enforceVerbatim(
      baseEconomics({
        totalAmount: "150 000", // finnes IKKE i kontrakten
        paymentTerms: [
          { label: "Ved signering", amount: "60 000", trigger: "signering" },
          { label: "Sluttfaktura", amount: "90 000", trigger: null }, // hallusinert
        ],
        deadlines: ["15.09.2026", "01.12.2027"], // siste finnes ikke
      }),
      KONTRAKT,
    );
    expect(economics.totalAmount).toBeNull();
    expect(economics.paymentTerms[0].amount).toBe("60 000");
    expect(economics.paymentTerms[1].amount).toBeNull();
    expect(economics.deadlines).toEqual(["15.09.2026"]);
    expect(rejected).toHaveLength(3);
    expect(rejected[0]).toContain("totalsum");
  });
});

describe("findMissingPoints (sjekkliste for komplett økonomisk oppsett)", () => {
  it("komplett kontrakt gir tom mangler-liste", () => {
    expect(findMissingPoints(baseEconomics())).toEqual([]);
  });

  it("hull listes eksplisitt — aldri fylles med gjetting", () => {
    const missing = findMissingPoints(baseEconomics({
      totalAmount: null,
      invoicing: null,
      usageRights: null,
      paymentTerms: [],
    }));
    expect(missing.some((m) => m.includes("Totalsum"))).toBe(true);
    expect(missing.some((m) => m.includes("Betalingsplan"))).toBe(true);
    expect(missing.some((m) => m.includes("Fakturamåte"))).toBe(true);
    expect(missing.some((m) => m.includes("Bruksrettigheter"))).toBe(true);
  });

  it("betalingsplan uten utløsere flagges", () => {
    const missing = findMissingPoints(baseEconomics({
      paymentTerms: [{ label: "Alt", amount: "120 000", trigger: null }],
    }));
    expect(missing.some((m) => m.includes("Forfall/utløsere"))).toBe(true);
  });
});

describe("frist uten sifre (medside-funnet)", () => {
  it("digit-løse «frister» (f.eks. blokkerings-markører) forkastes", () => {
    const { economics, rejected } = enforceVerbatim(
      baseEconomics({ deadlines: ["15.09.2026", "[BLOCKED: JWT token]"] }),
      KONTRAKT,
    );
    expect(economics.deadlines).toEqual(["15.09.2026"]);
    expect(rejected.some((r) => r.includes("frist uten dato"))).toBe(true);
  });
});
