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

import { segmentContentHtml } from '../narrative-script/html';
import { htmlToPlainText, plainTextToHtml } from './text';
import type { ExportGraph } from './types';

export const SOURCE_LOCALE = 'nb';
export const LOCALE_CODE_RE = /^[a-z]{2,3}(-[A-Z]{2})?$/;
export const SUGGESTED_LOCALES: ReadonlyArray<{ code: string; label: string }> = [
  { code: 'nb', label: 'Norsk (bokmål)' },
  { code: 'nn', label: 'Norsk (nynorsk)' },
  { code: 'en', label: 'English' },
  { code: 'sv', label: 'Svenska' },
  { code: 'da', label: 'Dansk' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'fi', label: 'Suomi' },
  { code: 'pl', label: 'Polski' },
  { code: 'ja', label: '日本語' },
];

export interface ElementI18n { titleHtml?: string; contentHtml?: string }
export interface ConnectionI18n { labelHtml?: string }
export interface SettingsI18n { title?: string }

export function isLocaleCode(value: unknown): value is string {
  return typeof value === 'string' && LOCALE_CODE_RE.test(value);
}

/** Prose-biter (mellom kodeblokker) i dokumentrekkefølge. */
export function proseChunks(html: string | null | undefined): string[] {
  if (!html) return [];
  return segmentContentHtml(html).filter((s) => s.kind === 'html').map((s) => (s as { html: string }).html);
}

/**
 * Bygg lokalisert HTML: kildens kodeblokker + oversatte prose-biter på samme
 * indekser. Oversettelsen lagres med samme struktur som kilden (prose skilt
 * av kodeblokker), men koden i den ignoreres — kilden vinner alltid. Mangler
 * en oversatt bit brukes kilden; flere biter enn kilden legges til på slutten.
 */
export function mergeCodeBlocks(sourceHtml: string, translatedHtml: string | null | undefined): string {
  if (!translatedHtml) return sourceHtml;
  const sourceSegments = segmentContentHtml(sourceHtml);
  if (!sourceSegments.some((s) => s.kind === 'code')) return translatedHtml;
  const translated = proseChunks(translatedHtml);
  let k = 0;
  const out: string[] = [];
  for (const seg of sourceSegments) {
    if (seg.kind === 'code') { out.push(seg.rawHtml); continue; }
    out.push(translated[k] ?? seg.html);
    k += 1;
  }
  for (; k < translated.length; k += 1) out.push(translated[k]);
  return out.join('');
}

/** Sett prose-bit `index` i en (kilde- eller oversatt) HTML til ny tekst; kodeblokker urørt. */
export function replaceProseChunk(html: string, index: number, text: string): string {
  const segments = segmentContentHtml(html);
  let k = 0;
  let replaced = false;
  const out = segments.map((seg) => {
    if (seg.kind === 'code') return seg.rawHtml;
    const current = k;
    k += 1;
    if (current === index) { replaced = true; return plainTextToHtml(text); }
    return seg.html;
  });
  if (!replaced) {
    // Kilden hadde ingen bit på den indeksen (f.eks. tomt innhold) — legg til.
    while (k <= index) { out.push(k === index ? plainTextToHtml(text) : ''); k += 1; }
  }
  return out.join('');
}

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

function chunkText(html: string): string {
  return htmlToPlainText(html);
}

/** Alle oversettbare prose-biter i grafen (kildespråk). */
export function listTranslatableSegments(graph: ExportGraph): TranslatableSegment[] {
  const out: TranslatableSegment[] = [];
  const titleOf = (id: string) => chunkText(graph.elements.find((e) => e.id === id)?.titleHtml ?? '') || '(uten tittel)';
  if (graph.settings.title?.trim()) {
    out.push({ key: 'settings:settings:title:0', ownerKind: 'settings', id: 'settings', field: 'title', index: 0, sourceText: graph.settings.title.trim(), context: 'Historiens tittel' });
  }
  for (const e of graph.elements) {
    if (e.kind === 'note') continue;
    const title = chunkText(e.titleHtml);
    if (title) out.push({ key: `element:${e.id}:titleHtml:0`, ownerKind: 'element', id: e.id, field: 'titleHtml', index: 0, sourceText: title, context: 'Elementtittel' });
    proseChunks(e.contentHtml).forEach((html, index) => {
      const text = chunkText(html);
      if (text) out.push({ key: `element:${e.id}:contentHtml:${index}`, ownerKind: 'element', id: e.id, field: 'contentHtml', index, sourceText: text, context: `Innhold i «${title || '(uten tittel)'}»` });
    });
  }
  for (const c of graph.connections) {
    proseChunks(c.labelHtml).forEach((html, index) => {
      const text = chunkText(html);
      if (text) out.push({ key: `connection:${c.id}:labelHtml:${index}`, ownerKind: 'connection', id: c.id, field: 'labelHtml', index, sourceText: text, context: `Valg fra «${titleOf(c.sourceId)}» til «${titleOf(c.targetId)}»` });
    });
  }
  return out;
}

/** Oversatt tekst for et segment (eller null når det mangler). */
export function translatedTextFor(graph: ExportGraph, seg: TranslatableSegment, locale: string): string | null {
  if (seg.ownerKind === 'settings') {
    const t = graph.settings.i18n?.[locale]?.title;
    return t?.trim() ? t.trim() : null;
  }
  if (seg.ownerKind === 'element') {
    const e = graph.elements.find((x) => x.id === seg.id);
    const o = e?.i18n?.[locale];
    if (!o) return null;
    if (seg.field === 'titleHtml') return o.titleHtml ? chunkText(o.titleHtml) || null : null;
    const chunk = proseChunks(o.contentHtml)[seg.index];
    return chunk ? chunkText(chunk) || null : null;
  }
  const c = graph.connections.find((x) => x.id === seg.id);
  const chunk = proseChunks(c?.i18n?.[locale]?.labelHtml)[seg.index];
  return chunk ? chunkText(chunk) || null : null;
}

export function translationProgress(graph: ExportGraph, locale: string): { total: number; done: number } {
  const segments = listTranslatableSegments(graph);
  const done = segments.filter((s) => translatedTextFor(graph, s, locale) != null).length;
  return { total: segments.length, done };
}

/**
 * Grafen slik den skal spilles/eksporteres på `locale`: overrides der de
 * finnes, ellers kilde; kodeblokker alltid fra kilden.
 */
export function applyLocaleToGraph<G extends ExportGraph>(graph: G, locale: string | null | undefined): G {
  if (!locale || locale === SOURCE_LOCALE) return graph;
  const settingsTitle = graph.settings.i18n?.[locale]?.title;
  return {
    ...graph,
    settings: { ...graph.settings, title: settingsTitle?.trim() ? settingsTitle.trim() : graph.settings.title },
    elements: graph.elements.map((e) => {
      const o = e.i18n?.[locale];
      if (!o) return e;
      return {
        ...e,
        titleHtml: o.titleHtml?.trim() ? o.titleHtml : e.titleHtml,
        contentHtml: o.contentHtml?.trim() ? mergeCodeBlocks(e.contentHtml, o.contentHtml) : e.contentHtml,
      };
    }),
    connections: graph.connections.map((c) => {
      const o = c.i18n?.[locale];
      if (!o?.labelHtml?.trim()) return c;
      return { ...c, labelHtml: mergeCodeBlocks(c.labelHtml, o.labelHtml) };
    }),
  };
}
