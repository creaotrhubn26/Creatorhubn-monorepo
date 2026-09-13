import { useEffect, useRef } from "react";
import { EditorView, minimalSetup } from "codemirror";
import { Decoration, ViewPlugin, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import {
  EditorState,
  RangeSetBuilder,
  StateEffect,
  StateField,
  Transaction,
  type Extension,
} from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting, syntaxTree } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { importerSamtale } from "./api";

/// Skriveflaten. Alt som angår hvordan teksten ser ut bor her, ikke i
/// styles.css: CodeMirror injiserer sine egne regler med høyere spesifisitet,
/// så et tema-objekt er det ene stedet som faktisk vinner.
const skriveflate = EditorView.theme({
  "&": {
    height: "100%",
    color: "var(--ink)",
    backgroundColor: "transparent",
    fontFamily: "var(--serif)",
    // `rem`, ikke px: skriveflaten skal følge brukerens egen tekststørrelse.
    fontSize: "1.09375rem",
  },
  // Skriveflaten skal si fra når den har fokus. Eneste tegn var før
  // tekstmarkøren — en 2px strek, og i et tomt notat ingenting i det hele
  // tatt. Ringen ligger innenfor kanten (`-2px`) så den ikke klippes av
  // spalten rundt.
  "&.cm-focused": {
    outline: "2px solid var(--accent)",
    outlineOffset: "-2px",
  },
  ".cm-scroller": {
    fontFamily: "var(--serif)",
    lineHeight: "1.78",
    overflowY: "auto",
    padding: "28px 0 45vh",
  },
  ".cm-content": {
    maxWidth: "44rem",
    margin: "0 auto",
    // Smalner vinduet — eller zoomer hun inn — skal luften gi etter før
    // teksten gjør det.
    padding: "0 clamp(16px, 5vw, 32px)",
    caretColor: "var(--accent)",
  },
  ".cm-line": { padding: "0" },
  ".cm-cursor": { borderLeftWidth: "2px", borderLeftColor: "var(--accent)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    backgroundColor: "var(--sel)",
  },
  // Avsnittet en panellinje kom fra, mens brukeren finner det igjen.
  ".cm-vist": {
    backgroundColor: "var(--mark)",
    borderRadius: "3px",
    boxShadow: "0 0 0 4px var(--mark)",
  },
});

const markdownFarger = HighlightStyle.define([
  { tag: tags.heading1, fontSize: "1.5em", fontWeight: "600", lineHeight: "1.3" },
  { tag: tags.heading2, fontSize: "1.18em", fontWeight: "600" },
  { tag: [tags.heading3, tags.heading4, tags.heading5, tags.heading6], fontWeight: "600" },
  { tag: tags.strong, fontWeight: "600" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.link, color: "var(--accent)" },
  { tag: tags.url, color: "var(--ink-faint)" },
  { tag: [tags.monospace, tags.contentSeparator], fontFamily: "var(--mono)", fontSize: "0.86em" },
  { tag: tags.quote, color: "var(--ink-soft)", fontStyle: "italic" },
  { tag: tags.list, color: "var(--accent)" },
  { tag: tags.processingInstruction, color: "var(--ink-faint)" },
]);

/// Peker panelet på et avsnitt, markeres det en liten stund. `null` fjerner
/// markeringen igjen. Dokumentet røres ikke — dette er ren visning.
const vis = StateEffect.define<{ from: number; to: number } | null>();

const vistAvsnitt = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(verdi, tr) {
    verdi = verdi.map(tr.changes);
    // Markeringen sto i 1,8 sekund og forsvant. Hele poenget med å klikke en
    // panellinje eller et søketreff er å finne igjen stedet, og 1,8 s er kort
    // for den som leser sakte. Nå står den til hun begynner å skrive, eller
    // til hun klikker seg videre.
    if (tr.docChanged) verdi = Decoration.none;
    for (const e of tr.effects) {
      if (e.is(vis)) {
        verdi = e.value
          ? Decoration.set([Decoration.mark({ class: "cm-vist" }).range(e.value.from, e.value.to)])
          : Decoration.none;
      }
    }
    return verdi;
  },
  provide: (f) => EditorView.decorations.from(f),
});

const skjult = Decoration.replace({});
const skjultBlokk = Decoration.replace({ block: true });

/// Slutten på toppfeltblokka (`---` … `---`), tomlinjene etter den medregnet,
/// eller `null` når notatet ikke har noen. Posisjonen er i den *ekte* fila —
/// ingenting fjernes fra dokumentet, det er bare visningen som hopper over
/// den, så markør, angre og lagring peker fortsatt på riktig sted.
function toppfeltSlutt(doc: EditorState["doc"]): number | null {
  if (doc.lines < 2 || doc.line(1).text.trim() !== "---") return null;
  let n = 2;
  while (n <= doc.lines && doc.line(n).text.trim() !== "---") n++;
  if (n > doc.lines) return null; // uavsluttet blokk: skjul heller ingenting
  while (n < doc.lines && doc.line(n + 1).text.trim() === "") n++;
  return doc.line(n).to;
}

/// Merkene som bare er instruks til markdown, ikke tekst: `#`, `**`, `_`.
const merker = new Set(["HeaderMark", "EmphasisMark"]);

/// Skjuler toppfeltblokka. Dette må være et StateField, ikke et ViewPlugin:
/// CodeMirror krever at dekorasjoner som endrer den vertikale oppbygningen —
/// altså slike som spiser linjeskift — kommer fra tilstanden, ikke fra
/// visningen. Et plugin her gir en tom skjerm og en feil i konsollen.
///
/// Er det ingenting *etter* toppfeltene, skjules de ikke: et tomt vindu er
/// verre enn tre linjer bokføring.
const skjulToppfelt = StateField.define<DecorationSet>({
  create: (state) => byggToppfelt(state),
  update: (verdi, tr) => (tr.docChanged ? byggToppfelt(tr.state) : verdi),
  provide: (f) => [
    EditorView.decorations.from(f),
    // Piltaster skal hoppe over det skjulte i stedet for å forsvinne inn i det.
    EditorView.atomicRanges.of((view) => view.state.field(f)),
  ],
});

function byggToppfelt(state: EditorState): DecorationSet {
  const slutt = toppfeltSlutt(state.doc);
  return slutt !== null && slutt < state.doc.length
    ? Decoration.set([skjultBlokk.range(0, slutt)])
    : Decoration.none;
}

/// Skjuler markdown-merkene på alle linjer markøren ikke står i. Står du på
/// linja, kommer de tilbake, så teksten er fortsatt til å redigere — det er
/// visningen som er ren, ikke dokumentet.
function byggMerker(view: EditorView): DecorationSet {
  const b = new RangeSetBuilder<Decoration>();
  const { doc, selection } = view.state;

  const redigeres = new Set<number>();
  for (const r of selection.ranges) {
    for (let n = doc.lineAt(r.from).number; n <= doc.lineAt(r.to).number; n++) redigeres.add(n);
  }

  syntaxTree(view.state).iterate({
    from: toppfeltSlutt(doc) ?? 0,
    to: doc.length,
    enter(node) {
      if (!merker.has(node.name)) return;
      if (redigeres.has(doc.lineAt(node.from).number)) return;
      // `# ` — mellomrommet etter tegnet skal vekk sammen med tegnet, ellers
      // står overskriften rykket inn.
      const til = doc.sliceString(node.to, node.to + 1) === " " ? node.to + 1 : node.to;
      b.add(node.from, til, skjult);
    },
  });
  return b.finish();
}

const skjulMerker = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = byggMerker(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.selectionSet || u.viewportChanged) this.decorations = byggMerker(u.view);
    }
  },
  {
    decorations: (v) => v.decorations,
    provide: (p) =>
      EditorView.atomicRanges.of((view) => view.plugin(p)?.decorations ?? Decoration.none),
  },
);

/// Der `kilde: samtale` skal skrives inn i toppfeltet, eller `null` når
/// notatet ikke har en toppfeltblokk eller allerede sier hva kilden er.
/// Posisjonen er starten på den avsluttende `---`-linja.
function kildeplass(doc: EditorState["doc"]): number | null {
  if (doc.lines < 2 || doc.line(1).text.trim() !== "---") return null;
  for (let n = 2; n <= doc.lines; n++) {
    const linje = doc.line(n);
    if (linje.text.trim() === "---") return linje.from;
    if (linje.text.split(":")[0]?.trim() === "kilde") return null;
  }
  return null; // uavsluttet blokk: rør den ikke
}

/// Har notatet noe i seg fra før, utenom toppfeltet og overskriften?
///
/// Toppfeltet `kilde: samtale` gjelder **hele fila**, og alle avsnitt i den
/// leses da med samtaleprompten. Limer hun en tråd inn i et notat hun allerede
/// har skrevet i, ble alt hun hadde skrevet plutselig lest som innlegg i en
/// samtale. Da settes ikke feltet: innleggene limes inn med avsenderen først,
/// som de skal, men notatet er fortsatt et notat. Vil hun ha hele fila lest
/// som en samtale, sier hun det selv med bryteren over skriveflaten.
export function harInnhold(doc: EditorState["doc"], fra: number, til: number): boolean {
  let n = 1;
  if (doc.lines >= 2 && doc.line(1).text.trim() === "---") {
    for (n = 2; n <= doc.lines && doc.line(n).text.trim() !== "---"; n++);
    n += 1;
  }
  for (; n <= doc.lines; n++) {
    const linje = doc.line(n);
    // Det markøren står i skal erstattes, og teller ikke som innhold.
    if (linje.from >= fra && linje.to <= til) continue;
    const tekst = linje.text.trim();
    if (tekst && !tekst.startsWith("#")) return true;
  }
  return false;
}

/// Innliming. Er det en samtale som limes inn, settes den inn som innlegg med
/// avsender, og toppfeltet sier at kilden er en samtale — da står valget i
/// fila, og appen trenger ikke gjette på nytt neste gang.
///
/// Gjenkjenningen er regelbasert og tar under et millisekund, men kallet er
/// asynkront. Derfor settes teksten inn i en egen transaksjon rett etterpå;
/// feiler kallet, limes teksten inn som den er. Ingenting går tapt.
function innliming(påSamtale: () => void) {
  return EditorView.domEventHandlers({
    paste(hendelse, view) {
      const tekst = hendelse.clipboardData?.getData("text/plain");
      // Én linje er aldri en samtale, og det vanligste limet er én linje.
      if (!tekst || !tekst.includes("\n")) return false;
      hendelse.preventDefault();
      const { from, to } = view.state.selection.main;
      const sett = (inn: string, samtale: boolean) => {
        const merk = samtale && !harInnhold(view.state.doc, from, to);
        const plass = merk ? kildeplass(view.state.doc) : null;
        const felt = "kilde: samtale\n";
        const endringer = [{ from, to, insert: inn }];
        if (plass !== null) endringer.unshift({ from: plass, to: plass, insert: felt });
        view.dispatch({
          changes: endringer,
          selection: { anchor: from + inn.length + (plass !== null ? felt.length : 0) },
        });
        if (merk) påSamtale();
      };
      importerSamtale(tekst)
        .then((samtale) => sett(samtale ?? tekst, samtale !== null))
        .catch(() => sett(tekst, false));
      return true;
    },
  });
}

type Props = {
  /** Byttes stien, byttes hele dokumentet. */
  path: string;
  doc: string;
  /** Notatets tittel. Den blir skriveflatens navn: CodeMirror gir
   *  `.cm-content` `role="textbox"` uten navn, og VoiceOver sa bare
   *  «tekstområde» — i et felt fokus kastes inn i ved hvert notatbytte. */
  navn: string;
  onChange: (text: string) => void;
  /** Nytt notat: marker overskriften så første tastetrykk erstatter den. */
  selectTitle: boolean;
  /** Avsnittet panelet peker på. `n` teller opp for hvert klikk, slik at det
   *  å klikke samme linje to ganger fører deg dit begge gangene. */
  peker: { from: number; to: number; n: number } | null;
  /** En limt samtale ble kjent igjen og satt inn. Notatet er en samtale fra
   *  nå av, og grensesnittet skal si det. */
  onSamtale?: () => void;
  /** Området som er på skjermen. Brukes bare til å avgjøre hva som leses
   *  først i en lang kilde, så CodeMirrors viewport — som er litt større enn
   *  det øyet ser — er presist nok. */
  onSynlig?: (fra: number, til: number) => void;
};

/// Markøren når et notat åpnes.
///
/// Rekkefølgen er hvor mye vi vet om hvor hun skal:
///
/// 1. **Et sted hun ba om.** Kom hun hit fra et søketreff, bærer treffet
///    linjene sine, og markøren skal stå der treffet står — ikke i bunnen av
///    et notat på tre tusen ord.
/// 2. **Overskriften, markert**, i et ferskt notat: første tastetrykk
///    erstatter den.
/// 3. **Slutten av teksten** ellers, som er der man skriver videre.
export function markør(
  doc: string,
  selectTitle: boolean,
  sted?: { from: number; to: number } | null,
): { anchor: number; head: number } {
  if (sted && sted.from <= doc.length) {
    const from = Math.min(sted.from, doc.length);
    return { anchor: from, head: from };
  }
  const title = /^#+\s+(.*)$/m.exec(doc);
  if (!(selectTitle && title)) return { anchor: doc.length, head: doc.length };
  return {
    anchor: title.index + title[0].length - title[1].length,
    head: title.index + title[0].length,
  };
}

/// Tilstanden ett notat åpnes i. Et notatbytte lager en *ny* tilstand, ikke en
/// transaksjon i den gamle: angrehistorikken bor i tilstanden, så det er dette
/// som gjør at ⌘Z i notat B aldri kan nå innholdet i notat A — og at den
/// første ⌘Z etter oppstart ikke kan angre bytten fra det tomme dokumentet
/// appen startet med.
///
/// Eksportert for testing: at et bytte ikke er angrbart er produktlogikk, ikke
/// oppsett.
export function tilstand(
  doc: string,
  valg: { anchor: number; head: number },
  ekstra: Extension[] = [],
  navn = "Notatet",
) {
  return EditorState.create({
    doc,
    selection: valg,
    extensions: [
      minimalSetup,
      markdown(),
      syntaxHighlighting(markdownFarger),
      skjulToppfelt,
      skjulMerker,
      vistAvsnitt,
      skriveflate,
      EditorView.lineWrapping,
      // Uten dette er skriveflaten et `role="textbox"` uten navn, og
      // VoiceOver sier «tekstområde» — om produktets midtpunkt.
      EditorView.contentAttributes.of({
        "aria-label": navn,
        "aria-multiline": "true",
      }),
      ...ekstra,
    ],
  });
}

export function Editor({ path, doc, navn, onChange, selectTitle, peker, onSamtale, onSynlig }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const change = useRef(onChange);
  change.current = onChange;
  const synlig = useRef(onSynlig);
  synlig.current = onSynlig;
  const samtale = useRef(onSamtale);
  samtale.current = onSamtale;
  // Dokumentet må også være tilgjengelig når visningen bygges på nytt (React
  // i StrictMode monterer effekter to ganger), ellers står editoren tom.
  const tekst = useRef(doc);
  tekst.current = doc;
  const valgt = useRef({ selectTitle });
  valgt.current = { selectTitle };
  /** Å laste inn et notat er ikke en redigering, og skal ikke utløse lagring. */
  const bytter = useRef(false);

  /** Det som bare finnes i den levende visningen: innliming og hva som er på
   *  skjermen. Holdt utenfor [`tilstand`] så den kan testes uten en DOM. */
  const kroker = useRef<Extension[]>([]);
  if (kroker.current.length === 0) {
    kroker.current = [
      innliming(() => samtale.current?.()),
      EditorView.updateListener.of((u) => {
        if (u.docChanged && !bytter.current) change.current(u.state.doc.toString());
        if (u.viewportChanged || u.docChanged) {
          synlig.current?.(u.view.viewport.from, u.view.viewport.to);
        }
      }),
    ];
  }

  const navnet = useRef(navn);
  navnet.current = navn;
  /** Hvor panelet eller søketreffet peker, tilgjengelig for effekten som
   *  bygger tilstanden på nytt. */
  const pekt = useRef(peker);
  pekt.current = peker;

  useEffect(() => {
    if (!host.current) return;
    const v = new EditorView({
      parent: host.current,
      state: tilstand(
        tekst.current,
        markør(tekst.current, valgt.current.selectTitle, pekt.current),
        kroker.current,
        navnet.current,
      ),
    });
    view.current = v;
    return () => {
      v.destroy();
      view.current = null;
    };
  }, []);

  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const valg = markør(doc, selectTitle, pekt.current);
    // Hele tilstanden byttes. `setState` går utenom transaksjonene, så det
    // fyrer verken `onChange` eller en angrbar endring — historikken til
    // notatet man kom fra følger ikke med hit.
    v.setState(tilstand(doc, valg, kroker.current, navnet.current));
    // Fokus flyttes bare til et *ferskt* notat, der hun nettopp ba om å få
    // skrive. Før ble fokus kastet hit ved hvert eneste notatbytte: sto hun i
    // lista og bladde, mistet hun stedet sitt, og den som navigerte med
    // tastatur måtte tilbake gjennom hele registeret. Å åpne et notat er
    // ikke det samme som å be om å skrive i det — «Hopp til skriveflaten»
    // øverst, Tab, og et klikk i teksten er de tre veiene dit.
    if (selectTitle) v.focus();
    v.dispatch({ effects: EditorView.scrollIntoView(valg.head) });
    synlig.current?.(v.viewport.from, v.viewport.to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  /** Dokumentet byttet uten at notatet gjorde det — brukeren sa «dette er en
   *  samtale» og toppfeltet er skrevet om, eller notatet ble lastet inn på
   *  nytt fordi det endret seg utenfra. Det er ikke en redigering hun har
   *  gjort i editoren, så lagringen eies av den som byttet teksten.
   *
   *  Markøren tas vare på så godt den kan: samme tegnposisjon i det nye
   *  dokumentet, klippet til lengden hvis det ble kortere. Det er ikke en
   *  ekte diff — bare et bytte midt i en linje kan flytte den et lite hakk —
   *  men det holder brukeren på stedet hun var, i stedet for å hoppe til
   *  toppen hver gang noe endrer seg under henne. */
  useEffect(() => {
    const v = view.current;
    if (!v || doc === v.state.doc.toString()) return;
    const { anchor, head } = v.state.selection.main;
    const klipp = (n: number) => Math.min(n, doc.length);
    bytter.current = true;
    v.dispatch({
      changes: { from: 0, to: v.state.doc.length, insert: doc },
      selection: { anchor: klipp(anchor), head: klipp(head) },
      // Hun byttet ikke teksten selv, så ⌘Z skal ikke kunne sette den
      // tilbake — og dermed heller ikke lagre den tilbake.
      annotations: Transaction.addToHistory.of(false),
    });
    bytter.current = false;
  }, [doc]);

  useEffect(() => {
    const v = view.current;
    if (!v || !peker) return;
    // Posisjonene kommer fra teksten slik den ble lest. Skriver man videre mens
    // panelet står, kan de ligge utenfor dokumentet; da hopper vi heller ingen
    // steder enn til feil sted.
    const to = Math.min(peker.to, v.state.doc.length);
    const from = Math.min(peker.from, to);
    if (from === to) return;
    // Markeringen står til hun skriver eller klikker seg videre. Ingen
    // nedtelling: den som leser sakte skal ikke miste stedet mens hun leser.
    v.dispatch({
      selection: { anchor: from },
      effects: [vis.of({ from, to }), EditorView.scrollIntoView(from, { y: "center" })],
    });
  }, [peker]);

  return <div className="editor" ref={host} />;
}
