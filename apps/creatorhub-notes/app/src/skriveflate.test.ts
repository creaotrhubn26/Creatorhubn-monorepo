/** Det skriveflaten avgjør på egen hånd: at et notatbytte ikke kan angres inn
 *  i et annet notat, og at det finnes én kilde til teksten slik den er nå.
 *
 *  Ingen DOM. Angrehistorikken bor i `EditorState`, og `undo` er en
 *  tilstandskommando — det som faktisk gikk galt er derfor testbart uten en
 *  visning. */
import { expect, test, vi } from "vitest";
import { EditorState, EditorSelection, type Transaction } from "@codemirror/state";
import { undo } from "@codemirror/commands";
import { harInnhold, markør, tilstand } from "./Editor";
import { lagBuffer } from "./buffer";

/** En liten visningsløs stand-in for `EditorView`: holder tilstanden, tar imot
 *  transaksjoner, og forteller hva som ble skrevet til `onChange`. */
function flate(doc: string) {
  let state = tilstand(doc, markør(doc, false));
  const skrevet: string[] = [];
  const dispatch = (tr: Transaction) => {
    state = tr.state;
    if (tr.docChanged) skrevet.push(tr.state.doc.toString());
  };
  return {
    get tekst() {
      return state.doc.toString();
    },
    skrevet,
    /** Brukeren skriver. */
    tast(inn: string) {
      dispatch(
        state.update({
          changes: { from: state.doc.length, to: state.doc.length, insert: inn },
          selection: EditorSelection.cursor(state.doc.length + inn.length),
        }),
      );
    },
    /** Notatbytte slik appen gjør det: en ny tilstand, ikke en transaksjon. */
    åpne(nyttDoc: string) {
      state = tilstand(nyttDoc, markør(nyttDoc, false));
    },
    angre() {
      return undo({ state, dispatch });
    },
  };
}

test("⌘Z i notat B kan ikke gi B innholdet fra A", () => {
  const f = flate("");
  f.åpne("Notat A.");
  f.tast(" Skrevet i A.");
  expect(f.tekst).toBe("Notat A. Skrevet i A.");

  f.åpne("Notat B.");
  f.skrevet.length = 0;
  f.angre();

  expect(f.tekst).toBe("Notat B.");
  expect(f.skrevet, "og ingen A-tekst skal ha blitt lagret til B-fila").toEqual([]);
});

test("første ⌘Z etter oppstart tømmer ikke notatet", () => {
  // Appen monterer skriveflaten tom og åpner notatet like etter.
  const f = flate("");
  f.åpne("# Tittel\n\nEn setning som sto der fra før.\n");

  f.angre();

  expect(f.tekst).toBe("# Tittel\n\nEn setning som sto der fra før.\n");
  expect(f.skrevet).toEqual([]);
});

test("angre etter et bytte tar bare det hun selv skrev", () => {
  const f = flate("");
  f.åpne("Grunnteksten.");
  f.tast(" Ett.");
  f.tast(" To.");

  // Angre skal fortsatt virke innenfor notatet — fiksen fjerner ikke angre.
  expect(f.angre()).toBe(true);
  expect(f.tekst.startsWith("Grunnteksten.")).toBe(true);
  expect(f.tekst.length).toBeLessThan("Grunnteksten. Ett. To.".length);
});

test("et notatbytte er ikke en angrbar transaksjon", () => {
  // Selve mekanismen bak begge feilene over: den gamle koden byttet dokument
  // med `dispatch`, og da lå byttet i historikken.
  const a = tilstand("Notat A.", { anchor: 0, head: 0 });
  const somFør = a.update({ changes: { from: 0, to: a.doc.length, insert: "Notat B." } }).state;
  expect(undo({ state: somFør, dispatch: () => undefined })).toBe(true);

  const somNå = tilstand("Notat B.", { anchor: 0, head: 0 });
  expect(undo({ state: somNå, dispatch: () => undefined })).toBe(false);
});

test("«Dette er en samtale» etter usikret tasting mister ingenting", async () => {
  const skrevet: [string, string][] = [];
  const buffer = lagBuffer(async (sti, tekst) => {
    skrevet.push([sti, tekst]);
  });

  buffer.sett("notat.md", "# Møte\n\nFørste linje.\n");
  buffer.endret("# Møte\n\nFørste linje.\n\nAlt jeg skrev etter at notatet ble åpnet.\n");
  // Autolagringen slår til. Før fiksen var dette punktet der teksten forsvant
  // for alle som spurte etterpå: bufferet ble nullet, og `doc` var gammel.
  await buffer.lagre();

  expect(buffer.nå()).toBe("# Møte\n\nFørste linje.\n\nAlt jeg skrev etter at notatet ble åpnet.\n");
  expect(skrevet).toHaveLength(1);
});

test("bufferet beholder teksten når skrivet feiler, og neste forsøk lykkes", async () => {
  const skriv = vi
    .fn<(sti: string, tekst: string) => Promise<void>>()
    .mockRejectedValueOnce(new Error("disken er full"))
    .mockResolvedValueOnce(undefined);
  const buffer = lagBuffer(skriv);

  buffer.sett("notat.md", "");
  buffer.endret("Siste setning.");

  const først = await buffer.lagre();
  expect(først && "feil" in først).toBe(true);
  expect(buffer.venter(), "teksten er ikke skrevet noe sted — bufferet må stå").toBe(true);
  expect(buffer.nå()).toBe("Siste setning.");

  const så = await buffer.lagre();
  expect(så && "skrevet" in så).toBe(true);
  expect(buffer.venter()).toBe(false);
  expect(skriv).toHaveBeenLastCalledWith("notat.md", "Siste setning.");
});

test("skriver hun videre mens skrivet pågår, blir det nye stående uskrevet", async () => {
  let slipp: (() => void) | null = null;
  const buffer = lagBuffer(
    () =>
      new Promise<void>((ok) => {
        slipp = ok;
      }),
  );
  buffer.sett("notat.md", "");
  buffer.endret("Ett.");
  const pågår = buffer.lagre();
  buffer.endret("Ett. To.");
  slipp!();
  await pågår;

  expect(buffer.venter()).toBe(true);
  expect(buffer.ventende()?.tekst).toBe("Ett. To.");
});

/** Funn 36. `kilde: samtale` i toppfeltet gjelder hele fila, og alle avsnitt i
 *  den leses med samtaleprompten. Limte hun en tråd inn i et notat hun
 *  allerede hadde skrevet i, ble alt hun hadde skrevet lest som innlegg. */
test("et notat med innhold fra før merkes ikke som en samtale av en innliming", () => {
  const ingen = { anchor: 0, head: 0 };
  const tomt = tilstand("---\nid: x\ndato: 2026-09-13\n---\n\n# Uten tittel\n\n", ingen);
  expect(harInnhold(tomt.doc, tomt.doc.length, tomt.doc.length)).toBe(false);

  const skrevet = tilstand(
    "---\nid: x\n---\n\n# Låne-app\n\nDepositum blir for høy terskel.\n\n",
    ingen,
  );
  expect(harInnhold(skrevet.doc, skrevet.doc.length, skrevet.doc.length)).toBe(true);

  // Markerer hun alt og limer over det, er notatet tomt etterpå — og da er
  // det hele fila som er samtalen.
  expect(harInnhold(skrevet.doc, 0, skrevet.doc.length)).toBe(false);

  // Et notat uten toppfelt teller på samme måte.
  const nakent = tilstand("Bare en setning.\n", ingen);
  expect(harInnhold(nakent.doc, nakent.doc.length, nakent.doc.length)).toBe(true);
});
