/** Det panelet og temavelgeren avgjør på egen hånd, uten Tauri og uten DOM.
 *  Alt som krever maskinen — klassifisering, lagring, rettelsestabellen —
 *  testes i Rust; her står produktlogikken som bare finnes i grensesnittet. */
import { expect, test } from "vitest";
import { _test } from "./Panel";
import { lesTema, settTema, type Tema } from "./tema";
import type { Paragraph, Rettelse, Tidligere } from "./api";

const {
  dato,
  lestFor,
  lest,
  plassen,
  kortformen,
  venteren,
  linjetekst,
  tidligereLinjer,
  overstyrte,
  SETNINGER,
} = _test;

function avsnitt(kind: string, action: string, ekstra: Partial<Paragraph> = {}): Paragraph {
  return {
    id: 1,
    start: 0,
    end: 10,
    hash: "abc",
    text: "En tanke.",
    summary: "Systemets kortform",
    kind,
    action,
    avsender: null,
    dependency: null,
    correction: null,
    lest: 0,
    modell: "claude-haiku-4-5-20251001",
    ...ekstra,
  };
}

const rettelse = (plass: string, summary: string, venter = ""): Rettelse => ({
  plass,
  summary,
  venter,
});

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

/** Funn 1. `begrensning|hold` traff ingen gren og forsvant helt ut av panelet
 *  — kravet hun formulerte var borte uten spor, og et avsnitt uten linje ser
 *  ut som et avsnitt uten innhold. `RESULTAT.md` avgjorde saken: et krav er en
 *  beslutning om *hvordan*, og fasiten tok feil, ikke modellene. */
test("et krav hun har formulert står i panelet", () => {
  expect(lest(avsnitt("begrensning", "hold"))).toBe("forstått");
  expect(lest(avsnitt("begrensning", "bygg"))).toBe("forstått");
  // Er modellen selv usikker, står kravet som uavklart — synlig, men uten
  // hake. Å påstå at noe er bestemt fordi modellen ikke visste er den ene
  // feilen som koster produktet.
  expect(lest(avsnitt("begrensning", "marker_åpent"))).toBe("uavklart");

  // Ingen av de ni typene kan forsvinne uten at det er et valg.
  for (const kind of ["beslutning", "spørsmål", "tvil", "gjengivelse", "uenighet", "begrensning"]) {
    for (const action of ["bygg", "hold", "marker_åpent"]) {
      expect(lest(avsnitt(kind, action)), `${kind}|${action}`).not.toBe(null);
    }
  }
});

/** Funn 8. Kundens ønske er ikke hennes beslutning, og skal ikke stå med
 *  samme hake som hennes egne — heller ikke når modellen tilfeldigvis sa
 *  `bygg`. */
test("et referert eller avvist standpunkt blir aldri en beslutning", () => {
  expect(lest(avsnitt("gjengivelse", "bygg"))).toBe("idé");
  expect(lest(avsnitt("uenighet", "bygg"))).toBe("idé");
});

test("en oppgave er en oppgave, uansett hvor bestemt den er", () => {
  expect(lest(avsnitt("oppgave", "ingenting"))).toBe("oppgave");
  // Uten denne havner «vi må få prototypen godkjent» blant beslutningene.
  expect(lest(avsnitt("oppgave", "bygg"))).toBe("oppgave");
});

test("rettelsen vinner over lesningen, og fjernet er fjernet", () => {
  const rettet = (correction: Rettelse) => avsnitt("beslutning", "bygg", { correction });
  expect(plassen(rettet(rettelse("uavklart", "Depositum")))).toBe("uavklart");
  expect(kortformen(rettet(rettelse("uavklart", "Depositum")))).toBe("Depositum");
  expect(plassen(rettet(rettelse("fjernet", "")))).toBe("fjernet");

  // Funn 19: skrev hun pila selv, er det hennes avhengighet som gjelder.
  const oppgave = avsnitt("observasjon", "ingenting", {
    dependency: null,
    correction: rettelse("oppgave", "Starte fargekorrigering", "låst klipp"),
  });
  expect(plassen(oppgave)).toBe("oppgave");
  expect(venteren(oppgave)).toBe("låst klipp");

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
    gjelder: 1,
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
    tidligere("nevnt", "f"),
    // Peker to avsnitt på det samme tidligere avsnittet, står det én gang.
    tidligere("bekrefter", "c"),
    tidligere("finnesikke", "e"),
  ]);
  expect(linjer.map((l) => l.hash)).toEqual(["b", "c", "d", "f"]);
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

test("uten enighet om retningen sier linja ingenting om retning", () => {
  const linje = SETNINGER.nevnt("3. september");
  expect(linje).toBe("Du skrev om dette 3. september");
  // Ingen av ordene som ville smuglet inn en retning, en gjentakelse eller en
  // relevans appen ikke har dekning for.
  for (const antydning of ["forkastet", "bestemte", "svarer", "igjen", "før", "også"]) {
    expect(linje).not.toContain(antydning);
  }
});

test("avsenderen står foran linja i en samtale, og bare der", () => {
  // Forskjellen på en beslutningslogg og en haug med løsrevne påstander.
  const marius = avsnitt("beslutning", "bygg", { avsender: "Marius", summary: "bruke Stripe" });
  expect(linjetekst(marius.avsender, kortformen(marius))).toBe("Marius: bruke Stripe");

  // Rettelsen hennes vinner over kortformen, men avsenderen står fortsatt.
  const rettet = { ...marius, correction: rettelse("forstått", "Stripe") };
  expect(linjetekst(rettet.avsender, kortformen(rettet))).toBe("Marius: Stripe");

  // I et vanlig notat er avsenderen brukeren selv, og navnet er støy.
  const eget = avsnitt("beslutning", "bygg", { summary: "bruke Stripe" });
  expect(linjetekst(eget.avsender, kortformen(eget))).toBe("bruke Stripe");
});

test("en dato som ikke kan fastslås vises ikke", () => {
  // 0 er «kilden visste det ikke»: ingen toppfeltdato, ingen fil å lese
  // endringstidspunktet av. Før sto klassifiseringsdatoen her, og en importert
  // tråd fikk dagens dato på hver linje.
  expect(dato(0)).toBe(null);
  expect(dato(-1)).toBe(null);
  expect(dato(1_757_500_000)).not.toBe(null);

  expect(SETNINGER.motsier(null)).toBe("Du forkastet dette før");
  expect(SETNINGER.bekrefter(null)).toBe("Du bestemte det samme før");
  expect(SETNINGER.nevnt(null)).toBe("Du skrev om dette før");
  expect(SETNINGER.besvarer(null)).toBe("Dette svarer på et spørsmål du stilte før");

  // Og med en dato står den fortsatt der.
  expect(SETNINGER.motsier("10. september")).toBe("Du forkastet dette 10. september");
});

/** Funn 34. Et avsnitt to linjer opp i det samme notatet er ikke «tidligere» —
 *  det står på skjermen. «Du forkastet dette 13. september» om noe hun ser er
 *  ikke en opplysning. */
test("en linje om det samme notatet står ikke under «Tidligere om dette»", () => {
  const her = { ...tidligere("motsier", "x"), sti: "aapent.md" };
  const der = tidligere("motsier", "y");
  expect(tidligereLinjer([her, der], "aapent.md").map((l) => l.hash)).toEqual(["y"]);
  // Uten et åpent notat oppgitt filtreres ingenting bort.
  expect(tidligereLinjer([her, der]).length).toBe(2);
});

/** Funn 10. Sier Marius «Vi går for Stripe» 10:32 og «Nei, Vipps likevel»
 *  10:41, sto begge som ✓ under «Hva vi har forstått» — to motstridende
 *  beslutninger, begge presentert som gjeldende. */
test("et avsnitt som blir overstyrt lenger ned mister haken", () => {
  const stripe = avsnitt("beslutning", "bygg", { id: 1, hash: "stripe", start: 0, end: 20 });
  const vipps = avsnitt("beslutning", "bygg", { id: 2, hash: "vipps", start: 40, end: 60 });
  const kobling = {
    ...tidligere("motsier", "stripe"),
    sti: "traad.md",
    gjelder: 2,
  };

  expect([...overstyrte([stripe, vipps], [kobling], "traad.md")]).toEqual(["stripe"]);

  // Bare bakover. Det som står etter kan ikke være overstyrt av det foran.
  const omvendt = { ...kobling, hash: "vipps", gjelder: 1 };
  expect(overstyrte([stripe, vipps], [omvendt], "traad.md").size).toBe(0);
  // Og aldri på tvers av notater: der er linja «Tidligere om dette».
  expect(overstyrte([stripe, vipps], [kobling], "et-annet.md").size).toBe(0);
});

/** Funn 20. En linje klassifisert av en eldre modell under eldre regler så
 *  identisk ut med en fersk. Nå står datoen på den, når den er gammel nok til
 *  at datoen sier noe. */
test("alderen på en linje vises når den er blitt gammel", () => {
  const nå = Date.now() / 1000;
  expect(lestFor(0)).toBe(null);
  expect(lestFor(nå - 60)).toBe(null);
  expect(lestFor(nå - 29 * 24 * 3600)).toBe(null);
  expect(lestFor(nå - 31 * 24 * 3600)).not.toBe(null);
  // Og det er en dato hun kjenner igjen, ikke et antall sekunder.
  expect(lestFor(nå - 400 * 24 * 3600)).toMatch(/\d{4}/);
});
