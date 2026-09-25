/**
 * Fingeravtrykket som avgjør om to rolleinnehavere er samme menneske.
 *
 * To egenskaper må holde samtidig, og de trekker i hver sin retning:
 * det må være presist nok til å skille to personer med samme navn, og det
 * må ikke lagre fødselsdatoen.
 */
import { describe, expect, it } from "vitest";
import { personFingeravtrykk } from "./lead-brreg-service.js";

describe("personFingeravtrykk", () => {
  it("gir samme avtrykk for samme person i to selskaper", () => {
    // Michael Svensen sitter i både Creative Heads AS og UNIKUM REGNSKAP AS.
    // BRREG oppgir 1988-10-25 begge steder.
    const a = personFingeravtrykk("Michael Svensen", "1988-10-25");
    const b = personFingeravtrykk("Michael Svensen", "1988-10-25");
    expect(a).not.toBeNull();
    expect(a).toBe(b);
  });

  it("skiller to personer som deler navn", () => {
    const eldst = personFingeravtrykk("Michael Svensen", "1971-05-18");
    const yngst = personFingeravtrykk("Michael Svensen", "1988-10-25");
    expect(eldst).not.toBe(yngst);
  });

  it("er ufølsom for skrivemåte i navnet", () => {
    // BRREG er konsistent, men berikelser fra ulike tidspunkt er det ikke
    // alltid. Store og små bokstaver skal ikke lage to personer av én.
    expect(personFingeravtrykk("LENA RØSTAD", "1980-01-01"))
      .toBe(personFingeravtrykk("lena røstad", "1980-01-01"));
  });

  it("lekker ikke fødselsdatoen", () => {
    const dato = "1988-10-25";
    const avtrykk = personFingeravtrykk("Michael Svensen", dato) ?? "";
    expect(avtrykk).not.toContain(dato);
    expect(avtrykk).not.toContain("1988");
    expect(avtrykk).toMatch(/^[0-9a-f]{16}$/);
  });

  it("gir null når datoen mangler", () => {
    // Eldre berikelser og roller uten oppgitt dato. Da skal koblingen falle
    // tilbake til navnematching, ikke late som den er bekreftet.
    expect(personFingeravtrykk("Michael Svensen", undefined)).toBeNull();
    expect(personFingeravtrykk("Michael Svensen", "  ")).toBeNull();
    expect(personFingeravtrykk("", "1988-10-25")).toBeNull();
  });
});
