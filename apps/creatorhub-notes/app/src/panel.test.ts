/** Det panelet og temavelgeren avgjør på egen hånd, uten Tauri og uten DOM.
 *  Alt som krever maskinen — klassifisering, lagring, rettelsestabellen —
 *  testes i Rust; her står produktlogikken som bare finnes i grensesnittet. */
import { expect, test } from "vitest";
import { _test } from "./Panel";
import { lesTema, settTema, type Tema } from "./tema";
import type { Paragraph, Rettelse, Tidligere } from "./api";

const { lest, plassen, kortformen, tidligereLinjer, SETNINGER } = _test;

function avsnitt(kind: string, action: string, ekstra: Partial<Paragraph> = {}): Paragraph {
  return {
    start: 0,
    end: 10,
    hash: "abc",
    text: "En tanke.",
    summary: "Systemets kortform",
    kind,
    action,
    dependency: null,
    correction: null,
    ...ekstra,
  };
}

test("hver type havner der brukeren ville lett etter den", () => {
  expect(lest(avsnitt("beslutning", "bygg"))).toBe("forstått");
  expect(lest(avsnitt("spørsmål", "marker_åpent"))).toBe("uavklart");
  expect(lest(avsnitt("tvil", "hold"))).toBe("idé");
  expect(lest(avsnitt("tvil", "marker_åpent"))).toBe("uavklart");
  expect(lest(avsnitt("gjengivelse", "hold"))).toBe("idé");
  expect(lest(avsnitt("uenighet", "hold"))).toBe("idé");
  expect(lest(avsnitt("observasjon", "ingenting"))).toBe(null);
  expect(lest(avsnitt("meta", "ingenting"))).toBe(null);
});

test("en oppgave er en oppgave, uansett hvor bestemt den er", () => {
  expect(lest(avsnitt("oppgave", "ingenting"))).toBe("oppgave");
  // Uten denne havner «vi må få prototypen godkjent» blant beslutningene.
  expect(lest(avsnitt("oppgave", "bygg"))).toBe("oppgave");
});

test("rettelsen vinner over lesningen, og fjernet er fjernet", () => {
  const rettet = (correction: Rettelse) => avsnitt("beslutning", "bygg", { correction });
  expect(plassen(rettet({ plass: "uavklart", summary: "Depositum" }))).toBe("uavklart");
  expect(kortformen(rettet({ plass: "uavklart", summary: "Depositum" }))).toBe("Depositum");
  expect(plassen(rettet({ plass: "fjernet", summary: "" }))).toBe("fjernet");

  // Uten rettelse er det systemets egen lesning som står.
  expect(plassen(avsnitt("beslutning", "bygg"))).toBe("forstått");
  expect(kortformen(avsnitt("beslutning", "bygg"))).toBe("Systemets kortform");
});

/** localStorage etter en omstart: verdien ligger der, appen leser den, og
 *  merket settes på nytt på rot-elementet. */
test("temavalget huskes over omstart", () => {
  const disk = new Map<string, string>();
  const lager = {
    getItem: (k: string) => disk.get(k) ?? null,
    setItem: (k: string, v: string) => void disk.set(k, v),
    removeItem: (k: string) => void disk.delete(k),
  };
  const rot = () => ({ dataset: {} as { tema?: string } });

  expect(lesTema(lager)).toBe("system");

  const første = rot();
  settTema("lyst", første, lager);
  expect(første.dataset.tema).toBe("lyst");

  // Omstart: nytt vindu, ny rot, samme disk.
  const etterOmstart = rot();
  const valgt: Tema = lesTema(lager);
  expect(valgt).toBe("lyst");
  settTema(valgt, etterOmstart, lager);
  expect(etterOmstart.dataset.tema).toBe("lyst");

  // «Følg systemet» tar merket bort igjen, slik at CSS-en faller tilbake.
  settTema("system", etterOmstart, lager);
  expect(etterOmstart.dataset.tema).toBe(undefined);
  expect(lesTema(lager)).toBe("system");
});

function tidligere(forhold: string, hash: string): Tidligere {
  return {
    forhold,
    gjelder: "abc",
    kortform: "Depositum",
    sti: "2026-09-10-laane-app.md",
    tittel: "Låne-app",
    hash,
    tidspunkt: 1_757_500_000,
  };
}

test("det som bare deler et ord vises aldri", () => {
  const linjer = tidligereLinjer([
    tidligere("urelatert", "a"),
    tidligere("motsier", "b"),
    tidligere("bekrefter", "c"),
    tidligere("besvarer", "d"),
    // Peker to avsnitt på det samme tidligere avsnittet, står det én gang.
    tidligere("bekrefter", "c"),
    tidligere("finnesikke", "e"),
  ]);
  expect(linjer.map((l) => l.hash)).toEqual(["b", "c", "d"]);
});

test("forholdet sies med ord brukeren kjenner", () => {
  expect(SETNINGER.motsier("10. september")).toBe("Du forkastet dette 10. september");
  expect(SETNINGER.bekrefter("3. september")).toBe("Du bestemte det samme 3. september");
  expect(SETNINGER.besvarer("28. august")).toBe(
    "Dette svarer på spørsmålet du stilte 28. august",
  );
  // Vokabularet vårt skal ikke ha en setning, og kan derfor ikke vises.
  expect(SETNINGER.urelatert).toBe(undefined);
});
