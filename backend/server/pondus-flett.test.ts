/**
 * Malene skal fylle seg selv fra leadet, og skjule det som ikke gjelder.
 *
 * Tallene under er ekte: Neras Direkte taper 3,7 MNOK på 51,7, og daglig
 * leder er også styreleder. Coloplast tjener 41,6 på 489. Det er nettopp
 * den forskjellen betingelsene skal fange.
 */
import { describe, expect, it } from "vitest";

import {
  feltverdier,
  flettMal,
  fletteInn,
  oppfyller,
  TOM_KONTEKST,
  type PondusLeadKontekst,
} from "./pondus-flett.js";

const NERAS: PondusLeadKontekst = {
  navn: "NERAS DIREKTE AS", selskap: "NERAS DIREKTE AS",
  kontaktperson: "Jon Christian Hillestad", poststed: "DRAMMEN",
  ansatte: 65, omsetning: 51_700_000, driftsresultat: -3_700_000,
  orgnr: "986330682", dagligLeder: "Jon Christian Hillestad",
  styreleder: "Jon Christian Hillestad",
};

const COLOPLAST: PondusLeadKontekst = {
  navn: "COLOPLAST NORGE AS", selskap: "COLOPLAST NORGE AS",
  kontaktperson: "Lena Nymo Helli", poststed: "OSLO",
  ansatte: 52, omsetning: 488_700_000, driftsresultat: 41_600_000,
  orgnr: "931925822", dagligLeder: "Lena Nymo Helli",
  styreleder: "Henning Reichardt",
};

describe("feltverdier", () => {
  it("skriver beløp i millioner med norsk komma", () => {
    // «51 700 000 kroner» lest høyt er en annen setning enn «51,7 MNOK».
    expect(feltverdier(NERAS)["lead.omsetningMNOK"]).toBe("51,7");
  });

  it("tar med fortegnet på driftsresultatet", () => {
    // Setningen er «med −3,7 i driftsresultat». Uten fortegn snur den mening.
    expect(feltverdier(NERAS)["lead.driftsresultatMNOK"]).toBe("−3,7");
    expect(feltverdier(COLOPLAST)["lead.driftsresultatMNOK"]).toBe("+41,6");
  });

  it("dropper desimalen over hundre millioner", () => {
    expect(feltverdier(COLOPLAST)["lead.omsetningMNOK"]).toBe("489");
  });

  it("setter hardt mellomrom som tusenskille", () => {
    // «1135 MNOK» lest høyt blir noe annet enn «1 135 MNOK».
    const az = { ...COLOPLAST, omsetning: 1_135_300_000 };
    expect(feltverdier(az)["lead.omsetningMNOK"]).toBe("1\u00A0135");
  });

  it("gir fornavn, ikke fullt navn, til tiltale", () => {
    expect(feltverdier(NERAS)["lead.fornavn"]).toBe("Jon");
  });
});

describe("fletteInn", () => {
  it("bytter feltene mot leadets egne tall", () => {
    const r = fletteInn(
      "Hei {{lead.fornavn}}, dere leverte {{lead.omsetningMNOK}} MNOK med {{lead.driftsresultatMNOK}}.",
      NERAS);
    expect(r.tekst).toBe("Hei Jon, dere leverte 51,7 MNOK med −3,7.");
    expect(r.mangler).toEqual([]);
  });

  it("lar hullet stå synlig når verdien mangler", () => {
    // Et tall som stille forsvinner blir lest høyt som om det ikke fantes.
    // Et synlig hull blir oppdaget før selgeren åpner munnen.
    const r = fletteInn("Dere leverte {{lead.omsetningMNOK}} MNOK.", TOM_KONTEKST);
    expect(r.tekst).toBe("Dere leverte ⟨omsetningMNOK⟩ MNOK.");
    expect(r.mangler).toContain("lead.omsetningMNOK");
  });

  it("melder fra om et felt malen ba om som ikke finnes", () => {
    const r = fletteInn("Omsetning: {{lead.finnesIkke}}", NERAS);
    expect(r.tekst).toContain("⟨ukjent felt: lead.finnesIkke⟩");
    expect(r.mangler).toEqual(["lead.finnesIkke"]);
  });

  it("rører ikke tekst uten felt", () => {
    expect(fletteInn("Ingen felt her.", NERAS).tekst).toBe("Ingen felt her.");
  });

  it("gir ikke tilgang til noe utenfor den låste listen", () => {
    // Malen skal ikke kunne lese hva som helst fra raden.
    const r = fletteInn("{{lead.hemmelig}} {{process.env}}", NERAS);
    expect(r.tekst).not.toContain("NERAS");
    expect(r.mangler).toHaveLength(2);
  });
});

describe("oppfyller", () => {
  it("skiller den som taper penger fra den som tjener", () => {
    expect(oppfyller("taper_penger", NERAS)).toBe(true);
    expect(oppfyller("taper_penger", COLOPLAST)).toBe(false);
    expect(oppfyller("tjener_penger", COLOPLAST)).toBe(true);
  });

  it("kjenner igjen at daglig leder også er styreleder", () => {
    // Hillestad bestemmer alene. Det endrer hele samtalen.
    expect(oppfyller("leder_er_styreleder", NERAS)).toBe(true);
    expect(oppfyller("leder_er_styreleder", COLOPLAST)).toBe(false);
  });

  it("er false når tallet mangler, ikke true", () => {
    // Uten tall vet vi ikke om de taper penger. Da skal ikke tapsåpningen
    // vises — det ville vært en påstand vi ikke har dekning for.
    expect(oppfyller("taper_penger", TOM_KONTEKST)).toBe(false);
    expect(oppfyller("tjener_penger", TOM_KONTEKST)).toBe(false);
  });

  it("viser steget når ingen betingelse er satt", () => {
    expect(oppfyller(null, TOM_KONTEKST)).toBe(true);
    expect(oppfyller("", NERAS)).toBe(true);
  });

  it("viser steget ved ukjent betingelse i stedet for å skjule det", () => {
    // Et steg som forsvinner på grunn av en skrivefeil gir et manus med
    // hull ingen forklarer. Heller ett steg for mye.
    expect(oppfyller("taper_pengene", NERAS)).toBe(true);
  });
});

describe("flettMal", () => {
  const STEG = [
    { id: "apning", title: "Åpning", prompt: "Hei {{lead.fornavn}}.", order: 0 },
    { id: "tap", title: "Tapsåpning", prompt: "{{lead.driftsresultatMNOK}} MNOK i fjor.", order: 1, visIf: "taper_penger" },
    { id: "vekst", title: "Vekståpning", prompt: "Dere tjener {{lead.driftsresultatMNOK}}.", order: 2, visIf: "tjener_penger" },
    { id: "alene", title: "Beslutter alene", prompt: "Du kan bestemme dette selv.", order: 3, visIf: "leder_er_styreleder" },
  ];

  it("velger tapsåpningen for Neras", () => {
    const r = flettMal(STEG, NERAS);
    expect(r.steg.map((s) => s.id)).toEqual(["apning", "tap", "alene"]);
    expect(r.steg[1].prompt).toBe("−3,7 MNOK i fjor.");
  });

  it("velger vekståpningen for Coloplast", () => {
    const r = flettMal(STEG, COLOPLAST);
    expect(r.steg.map((s) => s.id)).toEqual(["apning", "vekst"]);
    expect(r.steg[1].prompt).toBe("Dere tjener +41,6.");
  });

  it("dropper begge åpningene når tallene mangler", () => {
    const r = flettMal(STEG, TOM_KONTEKST);
    expect(r.steg.map((s) => s.id)).toEqual(["apning"]);
    expect(r.mangler).toContain("lead.fornavn");
  });

  it("holder rekkefølgen fra order, ikke fra listen", () => {
    const r = flettMal(
      [{ id: "b", title: "B", order: 5 }, { id: "a", title: "A", order: 1 }],
      NERAS);
    expect(r.steg.map((s) => s.id)).toEqual(["a", "b"]);
  });
});
