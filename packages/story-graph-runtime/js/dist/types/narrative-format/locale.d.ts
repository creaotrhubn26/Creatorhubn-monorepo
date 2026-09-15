/**
 * Lokalisering av Story Graph-innhold (Translation Mode).
 *
 * Kilden (`nb`) ligger i `titleHtml`/`contentHtml`/`labelHtml`/`settings.title`.
 * Oversettelser ligger som overrides i `i18n[locale]`. Kodeblokker (arcscript)
 * oversettes aldri: ved oppslag flettes kildens `<pre><code>`-blokker inn i
 * den oversatte prosaen på samme plass (`mergeCodeBlocks`), så en oversetter
 * aldri kan ødelegge skript — og skriptendringer i kilden slår automatisk
 * gjennom i alle språk. Ren TS, ingen DOM.
 */
import type { ExportGraph } from './types';
export declare const SOURCE_LOCALE = "nb";
export declare const LOCALE_CODE_RE: RegExp;
export declare const SUGGESTED_LOCALES: ReadonlyArray<{
    code: string;
    label: string;
}>;
export interface ElementI18n {
    titleHtml?: string;
    contentHtml?: string;
}
export interface ConnectionI18n {
    labelHtml?: string;
}
export interface SettingsI18n {
    title?: string;
}
export declare function isLocaleCode(value: unknown): value is string;
/** Prose-biter (mellom kodeblokker) i dokumentrekkefølge. */
export declare function proseChunks(html: string | null | undefined): string[];
/**
 * Bygg lokalisert HTML: kildens kodeblokker + oversatte prose-biter på samme
 * indekser. Oversettelsen lagres med samme struktur som kilden (prose skilt
 * av kodeblokker), men koden i den ignoreres — kilden vinner alltid. Mangler
 * en oversatt bit brukes kilden; flere biter enn kilden legges til på slutten.
 */
export declare function mergeCodeBlocks(sourceHtml: string, translatedHtml: string | null | undefined): string;
/** Sett prose-bit `index` i en (kilde- eller oversatt) HTML til ny tekst; kodeblokker urørt. */
export declare function replaceProseChunk(html: string, index: number, text: string): string;
export interface TranslatableSegment {
    /** Stabil nøkkel: `${ownerKind}:${id}:${field}:${index}`. */
    key: string;
    ownerKind: 'element' | 'connection' | 'settings';
    id: string;
    field: 'titleHtml' | 'contentHtml' | 'labelHtml' | 'title';
    /** Prose-bit-indeks (0 for tittel/etikett uten kodeblokker). */
    index: number;
    sourceText: string;
    /** Kontekst til oversetter/KI (elementtittel, kobling fra→til). */
    context: string;
}
/** Alle oversettbare prose-biter i grafen (kildespråk). */
export declare function listTranslatableSegments(graph: ExportGraph): TranslatableSegment[];
/** Oversatt tekst for et segment (eller null når det mangler). */
export declare function translatedTextFor(graph: ExportGraph, seg: TranslatableSegment, locale: string): string | null;
export declare function translationProgress(graph: ExportGraph, locale: string): {
    total: number;
    done: number;
};
/**
 * Grafen slik den skal spilles/eksporteres på `locale`: overrides der de
 * finnes, ellers kilde; kodeblokker alltid fra kilden.
 */
export declare function applyLocaleToGraph<G extends ExportGraph>(graph: G, locale: string | null | undefined): G;
