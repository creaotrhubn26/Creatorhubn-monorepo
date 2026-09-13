/** Det grensesnittet avgjør om et søk: hva utdraget markerer, hvor et klikk
 *  lander, hva tallet over lista betyr, og hva panelet melder fra om.
 *
 *  Alt som krever maskinen — indeksen, bøyningen, rangeringen — testes i Rust.
 *  Her står regnestykkene som bare finnes i appen. */
import { expect, test } from "vitest";
import { linjeområde, treffmelding, utdragsdeler } from "./App";
import { panelmelding } from "./Panel";
import { MERKE_SLUTT, MERKE_START } from "./api";

const merk = (s: string) => `${MERKE_START}${s}${MERKE_SLUTT}`;

test("utdraget markerer treffordet, ikke brukerens egen fete skrift", () => {
  // Slik den gamle delingen på `**` gikk galt: notatet har sin egen fete
  // skrift, og pariteten forskjøv seg slik at feil ord ble markert.
  const utdrag = `Vi ble **helt** enige om ${merk("depositum")} for **hele** oppdraget`;
  const deler = utdragsdeler(utdrag);

  const markert = deler.filter((d) => d.traff).map((d) => d.tekst);
  expect(markert).toEqual(["depositum"]);
  // Stjernene er tekst, og de står som de står.
  expect(deler.map((d) => d.tekst).join("")).toBe(
    utdrag.split(MERKE_START).join("").split(MERKE_SLUTT).join(""),
  );
});

test("et utdrag uten merker er ett umarkert stykke", () => {
  expect(utdragsdeler("bare tekst")).toEqual([{ tekst: "bare tekst", traff: false }]);
  expect(utdragsdeler("")).toEqual([]);
});

test("flere trefford i samme utdrag markeres hver for seg", () => {
  const deler = utdragsdeler(`${merk("kart")} og ${merk("kø")} i samme setning`);
  expect(deler.filter((d) => d.traff).map((d) => d.tekst)).toEqual(["kart", "kø"]);
});

test("et klikk på et søketreff lander på linja treffet står på", () => {
  const notat = "---\nid: 2026-09-13\n---\n\n# Møtet\n\nVi bestemte depositum.\nOg noe annet.\n";
  // Linje 7 er «Vi bestemte depositum.» — talt fra 1, i fila slik den ligger
  // på disk, inkludert toppfeltet. Det er nøyaktig det indeksen lagrer.
  const sted = linjeområde(notat, 7, 7);
  expect(sted).not.toBeNull();
  expect(notat.slice(sted!.from, sted!.to)).toBe("Vi bestemte depositum.");
});

test("et linjeområde over flere linjer dekker alle sammen", () => {
  const notat = "en\nto\ntre\nfire\n";
  const sted = linjeområde(notat, 2, 3)!;
  expect(notat.slice(sted.from, sted.to)).toBe("to\ntre");
});

test("en linje som ikke finnes gir ingen peker, ikke en gal en", () => {
  // Notatet kan være skrevet om siden indeksen så det. Da er det bedre å
  // hoppe ingen steder enn til feil sted.
  expect(linjeområde("en\nto\n", 9, 9)).toBeNull();
  expect(linjeområde("en\nto\n", 0, 1)).toBeNull();
});

test("treffantallet sier fra når lista er kappet", () => {
  expect(treffmelding(12, false)).toBe("12 treff");
  expect(treffmelding(1, false)).toBe("1 treff");
  expect(treffmelding(0, false)).toBe("Ingen treff");
  // 40 var taket, og tallet ble vist som om det var totalen.
  expect(treffmelding(40, true)).toBe("De 40 første treffene");
  expect(treffmelding(7, true)).toBe("De 7 første treffene");
});

test("panelet melder fra om hva det fant", () => {
  const ingenting = { forstått: 0, uavklart: 0, oppgave: 0, idé: 0 };

  // Under lesning er det framdriften som er nyheten.
  expect(panelmelding(ingenting, { lest: 3, totalt: 12, fase: null }, true)).toBe(
    "Leser avsnitt 3 av 12.",
  );
  expect(panelmelding(ingenting, { lest: 12, totalt: 12, fase: "sammenligner" }, true)).toBe(
    "Ser etter hva du har skrevet om dette før.",
  );

  // Ferdig lest: hvor mange, per plass, i entall og flertall.
  expect(panelmelding({ forstått: 3, uavklart: 1, oppgave: 2, idé: 0 }, null, true)).toBe(
    "3 forstått, 1 uavklart linje, 2 oppgaver.",
  );
  expect(panelmelding({ forstått: 1, uavklart: 0, oppgave: 0, idé: 1 }, null, true)).toBe(
    "1 forstått linje, 1 idé.",
  );
  expect(panelmelding(ingenting, null, true)).toBe("Ingenting er bestemt ennå.");

  // Ingen lesning i det hele tatt: ingenting å melde, og da skal det ikke
  // stå noe i live-området heller.
  expect(panelmelding(ingenting, null, false)).toBe("");
});
