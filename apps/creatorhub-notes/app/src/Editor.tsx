import { useEffect, useRef } from "react";
import { EditorView, minimalSetup } from "codemirror";
import { Decoration, ViewPlugin, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { EditorState, RangeSetBuilder } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
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
    padding: "56px 0 45vh",
  },
  ".cm-content": {
    maxWidth: "34rem",
    margin: "0 auto",
    padding: "0 32px",
    caretColor: "var(--accent)",
  },
  ".cm-line": { padding: "0" },
  ".cm-toppfelt, .cm-toppfelt span": {
    fontFamily: "var(--mono)",
    fontSize: "12.5px",
    fontWeight: "400",
    lineHeight: "1.7",
    color: "var(--ink-faint)",
  },
  ".cm-cursor": { borderLeftWidth: "2px", borderLeftColor: "var(--accent)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    backgroundColor: "var(--sel)",
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

/// Toppfeltene (`---` … `---`) er notatets bokføring, ikke teksten din. De
/// blir stående — ingenting skjules — men settes i liten grå monospace så de
/// ikke ser ut som en overskrift. Uten dette leser markdown `---` som en
/// setext-overskrift og setter «id: …» i stor halvfet, som er direkte
/// villedende.
const toppfelt = Decoration.line({ class: "cm-toppfelt" });

const dempToppfelt = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = bygg(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged) this.decorations = bygg(u.view);
    }
  },
  { decorations: (v) => v.decorations },
);

function bygg(view: EditorView): DecorationSet {
  const b = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc;
  if (doc.lines >= 2 && doc.line(1).text.trim() === "---") {
    for (let n = 1; n <= doc.lines; n++) {
      const linje = doc.line(n);
      b.add(linje.from, linje.from, toppfelt);
      if (n > 1 && linje.text.trim() === "---") break;
    }
  }
  return b.finish();
}

type Props = {
  /** Byttes stien, byttes hele dokumentet. */
  path: string;
  doc: string;
  onChange: (text: string) => void;
  /** Nytt notat: marker overskriften så første tastetrykk erstatter den. */
  selectTitle: boolean;
};

export function Editor({ path, doc, onChange, selectTitle }: Props) {
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
          dempToppfelt,
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

  return <div className="editor" ref={host} />;
}
