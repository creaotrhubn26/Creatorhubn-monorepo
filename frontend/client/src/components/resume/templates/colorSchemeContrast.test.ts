/**
 * Kontrastvakt for CV-fargeskjemaene.
 *
 * En måling med axe over alle 15 malene fant 82 kontrastbrudd i 11 av dem.
 * De ble rettet ved å gjøre hver aksent mørk nok. Denne testen hindrer at
 * det skjer igjen når noen legger til skjema nummer ni.
 *
 * Hvorfor en enhetstest og ikke bare axe: axe trenger en nettleser og en
 * rendret side, og kjøres derfor sjelden. Regelen som gjelder aksentene er
 * ren aritmetikk, og da hører den hjemme et sted som kjører på hver commit.
 *
 * Testen dekker aksentene, ikke hver enkelt mal. En mal kan fortsatt
 * introdusere en dårlig hardkodet farge — det fanges bare av å måle den
 * rendrede siden.
 */

import { describe, it, expect } from "vitest";
import { RESUME_COLOR_SCHEMES } from "./ResumeTemplates";

/** WCAG 2.1 relativ luminans. */
function luminance(hex: string): number {
  const n = parseInt(hex.replace("#", ""), 16);
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  );
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG AA for vanlig tekst. Malene er tett brødtekst, ikke overskrifter. */
const AA = 4.5;

const schemes = Object.entries(RESUME_COLOR_SCHEMES);

describe("kontrastformelen", () => {
  it("gir kjente verdier", () => {
    // Sanity: uten dette kunne alt under bestå fordi regnestykket er feil.
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });

  it("er symmetrisk", () => {
    expect(contrastRatio("#B23A00", "#ffffff")).toBeCloseTo(
      contrastRatio("#ffffff", "#B23A00"),
      5,
    );
  });

  it("fanger fargen som startet dette", () => {
    // #9CA3AF på hvitt var det verste enkeltfunnet.
    expect(contrastRatio("#9CA3AF", "#ffffff")).toBeLessThan(AA);
  });
});

describe("fargeskjemaene", () => {
  it("finnes", () => {
    expect(schemes.length).toBeGreaterThan(0);
  });

  it.each(schemes)("%s: aksenten er lesbar som tekst på hvitt", (_id, s) => {
    // Aksenten brukes som overskrifts- og ikonfarge på hvit side.
    expect(contrastRatio(s.accent, "#FFFFFF")).toBeGreaterThanOrEqual(AA);
  });

  it.each(schemes)("%s: tekst på aksentflate er lesbar", (_id, s) => {
    // Samme farge brukes som sidebar-bakgrunn. Kravet er det samme begge
    // veier, så en aksent som består testen over består også denne — med
    // mindre noen setter textOnAccent til noe annet enn hvitt.
    expect(contrastRatio(s.textOnAccent, s.accent)).toBeGreaterThanOrEqual(AA);
  });

  it.each(schemes)("%s: aksenten er lesbar på sin egen myke bakgrunn", (_id, s) => {
    // Denne fanget crimson: 4,41:1 mot #FEF2F2 mens den besto mot hvitt.
    // bgSoft er lysere enn hvitt i persepsjon, men ikke i tall.
    expect(contrastRatio(s.accent, s.bgSoft)).toBeGreaterThanOrEqual(AA);
  });

  it.each(schemes)("%s: accentDark er ikke lysere enn accent", (_id, s) => {
    // Navnet lover en mørkere variant. Brytes det, brukes den et sted der
    // den gir dårligere kontrast enn utvikleren tror.
    expect(luminance(s.accentDark)).toBeLessThanOrEqual(luminance(s.accent));
  });
});
