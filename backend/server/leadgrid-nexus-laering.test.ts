/**
 * Rekkefølgen i koblingspanelet skal kunne læres — men forsiktig.
 *
 * Faren er ikke at læringen ikke virker. Faren er at den virker for fort:
 * én tilfeldig åpning på en stille uke kaster om på hele lista, og selgeren
 * mister den rekkefølgen han har vent seg til.
 */
import { describe, expect, it } from "vitest";
import { justertStyrke, MODNING } from "./leadgrid-nexus-koblinger.js";

describe("justertStyrke", () => {
  it("rører ikke basis uten data", () => {
    expect(justertStyrke(100, 0, 0, 0.3)).toBe(100);
    expect(justertStyrke(60, 0, 0, 0)).toBe(60);
  });

  it("knapt rører basis på få observasjoner", () => {
    // Tre visninger, alle åpnet — ser voldsomt ut, betyr ingenting.
    const ny = justertStyrke(60, 3, 3, 0.2);
    expect(Math.abs(ny - 60)).toBeLessThanOrEqual(6);
  });

  it("løfter en kilde som åpnes oftere enn snittet, når tallene er store", () => {
    // 400 visninger, 40 % åpnet mot et snitt på 20 %.
    const ny = justertStyrke(60, 400, 160, 0.2);
    expect(ny).toBeGreaterThan(70);
  });

  it("senker en kilde som nesten aldri åpnes", () => {
    const ny = justertStyrke(100, 400, 8, 0.2);
    expect(ny).toBeLessThan(100);
  });

  it("klemmer utslaget så rekkefølgen ikke snus på hodet", () => {
    // Ekstremtilfelle: alt åpnes, snittet er lavt, uendelig med data.
    const opp = justertStyrke(50, 100_000, 100_000, 0.01);
    expect(opp).toBeLessThanOrEqual(Math.round(50 * 1.4));
    // Og motsatt: aldri åpnet.
    const ned = justertStyrke(100, 100_000, 0, 0.5);
    expect(ned).toBeGreaterThanOrEqual(Math.round(100 * 0.6));
  });

  it("lar «samme kunde» holde seg over «samme selskap» ved normal bruk", () => {
    // Selv når selskap gjør det litt bedre enn kunde, skal ikke
    // rekkefølgen snus av moderate forskjeller.
    const kunde = justertStyrke(100, 200, 40, 0.25);   // 20 %
    const selskap = justertStyrke(50, 200, 70, 0.25);  // 35 %
    expect(kunde).toBeGreaterThan(selskap);
  });

  it("modningen er halvveis påslått ved MODNING observasjoner", () => {
    // n / (n + MODNING) = 0,5 når n = MODNING. Halv effekt, ikke full.
    const halv = justertStyrke(100, MODNING, MODNING, 0.5);
    const full = justertStyrke(100, 1_000_000, 1_000_000, 0.5);
    expect(halv).toBeLessThan(full);
  });
});
