import { describe, expect, it } from "vitest";

import { mapRegnskapEntry } from "./lead-brreg-service.js";

// Struktur verifisert mot faktisk API-respons (Equinor 923609016, 2026-07-13)
const equinorLike = {
  regnskapsperiode: { fraDato: "2024-01-01", tilDato: "2024-12-31" },
  valuta: "USD",
  resultatregnskapResultat: {
    aarsresultat: 8_141_000_000,
    ordinaertResultatFoerSkattekostnad: 8_168_000_000,
    driftsresultat: {
      driftsresultat: 10_347_000_000,
      driftsinntekter: { sumDriftsinntekter: 72_543_000_000 },
    },
  },
  egenkapitalGjeld: {
    sumEgenkapitalGjeld: 109_150_000_000,
    egenkapital: { sumEgenkapital: 41_090_000_000 },
  },
};

describe("mapRegnskapEntry", () => {
  it("mapper alle nøkkeltall fra reell API-struktur", () => {
    const f = mapRegnskapEntry(equinorLike)!;
    expect(f.year).toBe(2024);
    expect(f.currency).toBe("USD");
    expect(f.revenue).toBe(72_543_000_000);
    expect(f.operatingResult).toBe(10_347_000_000);
    expect(f.netResult).toBe(8_141_000_000);
    expect(f.equity).toBe(41_090_000_000);
    expect(f.totalAssets).toBe(109_150_000_000);
  });

  it("beregner soliditet og driftsmargin — kun når begge ledd finnes", () => {
    const f = mapRegnskapEntry(equinorLike)!;
    expect(f.equityRatio).toBeCloseTo(0.376, 2); // 41.09/109.15
    expect(f.operatingMargin).toBeCloseTo(0.143, 2); // 10.35/72.54
    const thin = mapRegnskapEntry({
      regnskapsperiode: { tilDato: "2024-12-31" },
      egenkapitalGjeld: { egenkapital: { sumEgenkapital: 500_000 } },
    })!;
    expect(thin.equityRatio).toBeNull(); // mangler totalkapital → aldri 0-default
    expect(thin.operatingMargin).toBeNull();
  });

  it("returnerer null uten regnskapsperiode (kan ikke dateres)", () => {
    expect(mapRegnskapEntry({ valuta: "NOK" })).toBeNull();
  });

  it("negativt driftsresultat gir negativ margin — tap skjules ikke", () => {
    const f = mapRegnskapEntry({
      regnskapsperiode: { tilDato: "2024-12-31" },
      resultatregnskapResultat: {
        driftsresultat: { driftsresultat: -200_000, driftsinntekter: { sumDriftsinntekter: 1_000_000 } },
      },
    })!;
    expect(f.operatingMargin).toBe(-0.2);
  });
});
