/**
 * Story Graph — HTML-lag for skriptspråket.
 *
 * Arcweave legger skript i `<pre><code>…</code></pre>` inne i element-HTML,
 * mellom `<p>`-avsnitt. Denne modulen deler innholdet i segmenter (html | code),
 * dekoder entiteter i kodesegmenter og gjør mention-spans om til tokens som
 * lexeren forstår (`@[<id>]`). Ren TS — ingen DOM.
 */
export interface MentionRef {
    /** Arcweave: data-id på <span class="mention …"> */
    id: string;
    /** element | variable | component | board (fra class-navn), ukjent → 'element' */
    kind: 'element' | 'variable' | 'component' | 'board';
    label: string;
}
export interface HtmlSegment {
    kind: 'html';
    index: number;
    html: string;
}
export interface CodeSegment {
    kind: 'code';
    index: number;
    /** Kode klar for lexeren: entiteter dekodet, mentions erstattet med @[id]. */
    code: string;
    /** Original kodeblokk-HTML (for feilmeldinger/rundtur). */
    rawHtml: string;
    mentions: MentionRef[];
}
export type ContentSegment = HtmlSegment | CodeSegment;
export declare function decodeEntities(input: string): string;
export declare function escapeHtml(text: string): string;
/**
 * Gjør et kodeblokk-innhold om til ren skripttekst: mention-spans → `@[id]`,
 * andre tagger (f.eks. <br>) → linjeskift/fjernes, entiteter dekodes.
 */
export declare function prepareCode(rawInner: string): {
    code: string;
    mentions: MentionRef[];
};
/** Del element-HTML i html-/kodesegmenter i dokumentrekkefølge. */
export declare function segmentContentHtml(html: string): ContentSegment[];
/** Fjern alle kodeblokker (til visning uten kjøring). */
export declare function stripCodeBlocks(html: string): string;
/** Har innholdet minst én kodeblokk? */
export declare function hasScript(html: string | null | undefined): boolean;
