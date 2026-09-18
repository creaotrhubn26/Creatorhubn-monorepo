/**
 * DOM-frie tekst-hjelpere for eksport (Markdown, standalone-tittel).
 * Bruker entitets-dekoderen fra skriptlaget — ingen DOMParser.
 */
/** Riktekst-HTML → ren tekst (avsnitt → linjeskift, resten strippes). */
export declare function htmlToPlainText(html: string | null | undefined): string;
/** Én-linjes tittel fra tittel-HTML. */
export declare function htmlToTitle(html: string | null | undefined): string;
/**
 * Element-innhold → Markdown: HTML-segmenter som tekst, kodesegmenter som
 * ```arcscript-blokker (mentions vises som @[id]).
 */
export declare function contentHtmlToMarkdown(html: string | null | undefined): string;
/** Ren tekst → enkel riktekst-HTML (avsnitt per tom linje, entiteter escapet). */
export declare function plainTextToHtml(text: string | null | undefined): string;
