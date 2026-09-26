/**
 * Slettefristen for rå lyd (§5 i docs/leadgrid-gdpr-lydopptak.md).
 *
 * «Rå lyd slettes automatisk etter 90 dager (konfigurerbart per org, aldri
 *  lenger enn 12 mnd).»
 *
 * Det «aldri lenger» er det som betyr noe. En org skal kunne slette
 * RASKERE enn standarden, men ikke velge seg bort fra sletting — og et
 * feilskrevet tall i en konfigurasjon skal ikke kunne bli til evig lagring.
 */
import { describe, expect, it } from "vitest";
import {
  gyldigFrist, STANDARD_FRIST_DAGER, MAKS_FRIST_DAGER,
} from "./leadgrid-nexus-lyd-retensjon.js";

describe("gyldigFrist", () => {
  it("bruker 90 dager når org-en ikke har valgt", () => {
    expect(gyldigFrist(null)).toBe(STANDARD_FRIST_DAGER);
    expect(gyldigFrist(undefined)).toBe(90);
  });

  it("lar org-en slette raskere", () => {
    expect(gyldigFrist(30)).toBe(30);
    expect(gyldigFrist(7)).toBe(7);
  });

  it("nekter å lagre lenger enn taket", () => {
    expect(gyldigFrist(3650)).toBe(MAKS_FRIST_DAGER);
    expect(gyldigFrist(366)).toBe(365);
  });

  it("nekter null og negative — det ville vært evig lagring i forkledning", () => {
    // 0 dager ville i praksis blitt «slett aldri» hvis noen regnet feil,
    // eller «slett umiddelbart» hvis de regnet motsatt. Begge er feil.
    expect(gyldigFrist(0)).toBe(1);
    expect(gyldigFrist(-40)).toBe(1);
  });

  it("tåler søppelverdier fra en konfigurasjon", () => {
    expect(gyldigFrist(Number.NaN)).toBe(STANDARD_FRIST_DAGER);
    expect(gyldigFrist(Number.POSITIVE_INFINITY)).toBe(STANDARD_FRIST_DAGER);
    expect(gyldigFrist(45.9)).toBe(45);
  });
});
