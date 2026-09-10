import { useEffect, useRef } from "react";
import { EditorView, minimalSetup } from "codemirror";
import { Decoration, ViewPlugin, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { EditorState, RangeSetBuilder, StateEffect, StateField } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting, syntaxTree } from "@codemirror/language";
import { tags } from "@lezer/highlight";

/// Skriveflaten. Alt som angår hvordan teksten ser ut bor her, ikke i
/// styles.css: CodeMirror injiserer sine egne regler med høyere spesifisitet,
/// så et tema-objekt er det ene stedet som faktisk vinner.
const skriveflate = EditorView.theme({
  "&": {
    height: "100%",
    color: "var(--ink)",
    backgroundColor: "transparent",
    fontFamily: "var(--serif)",
    fontSize: "17.5px",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    fontFamily: "var(--serif)",
    lineHeight: "1.78",
    overflowY: "auto",
    padding: "28px 0 45vh",
  },
  ".cm-content": {
    maxWidth: "44rem",
    margin: "0 auto",
    padding: "0 32px",
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

type Props = {
  /** Byttes stien, byttes hele dokumentet. */
  path: string;
  doc: string;
  onChange: (text: string) => void;
  /** Nytt notat: marker overskriften så første tastetrykk erstatter den. */
  selectTitle: boolean;
  /** Avsnittet panelet peker på. `n` teller opp for hvert klikk, slik at det
   *  å klikke samme linje to ganger fører deg dit begge gangene. */
  peker: { from: number; to: number; n: number } | null;
};

export function Editor({ path, doc, onChange, selectTitle, peker }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const change = useRef(onChange);
  change.current = onChange;
  // Dokumentet må også være tilgjengelig når visningen bygges på nytt (React
  // i StrictMode monterer effekter to ganger), ellers står editoren tom.
  const tekst = useRef(doc);
  tekst.current = doc;
  /** Å laste inn et notat er ikke en redigering, og skal ikke utløse lagring. */
  const bytter = useRef(false);

  useEffect(() => {
    if (!host.current) return;
    const v = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: tekst.current,
        extensions: [
          minimalSetup,
          markdown(),
          syntaxHighlighting(markdownFarger),
          skjulToppfelt,
          skjulMerker,
          vistAvsnitt,
          skriveflate,
          EditorView.lineWrapping,
          EditorView.updateListener.of((u) => {
            if (u.docChanged && !bytter.current) change.current(u.state.doc.toString());
          }),
        ],
      }),
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
    const title = /^#+\s+(.*)$/m.exec(doc);
    const anchor =
      selectTitle && title ? title.index + title[0].length - title[1].length : doc.length;
    const head = selectTitle && title ? title.index + title[0].length : anchor;
    bytter.current = true;
    v.dispatch({
      changes: { from: 0, to: v.state.doc.length, insert: doc },
      selection: { anchor, head },
      scrollIntoView: true,
    });
    bytter.current = false;
    v.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  useEffect(() => {
    const v = view.current;
    if (!v || !peker) return;
    // Posisjonene kommer fra teksten slik den ble lest. Skriver man videre mens
    // panelet står, kan de ligge utenfor dokumentet; da hopper vi heller ingen
    // steder enn til feil sted.
    const to = Math.min(peker.to, v.state.doc.length);
    const from = Math.min(peker.from, to);
    if (from === to) return;
    v.dispatch({
      effects: [vis.of({ from, to }), EditorView.scrollIntoView(from, { y: "center" })],
    });
    const t = window.setTimeout(() => {
      view.current?.dispatch({ effects: vis.of(null) });
    }, 1800);
    return () => window.clearTimeout(t);
  }, [peker]);

  return <div className="editor" ref={host} />;
}
