/**
 * DOM-frie tekst-hjelpere for eksport (Markdown, standalone-tittel).
 * Bruker entitets-dekoderen fra skriptlaget — ingen DOMParser.
 */

import { decodeEntities, segmentContentHtml } from '../narrative-script/html';

/** Riktekst-HTML → ren tekst (avsnitt → linjeskift, resten strippes). */
export function htmlToPlainText(html: string | null | undefined): string {
  if (!html) return '';
  const text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|blockquote|pre)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '');
  return decodeEntities(text)
    .replace(/ /g, ' ')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Én-linjes tittel fra tittel-HTML. */
export function htmlToTitle(html: string | null | undefined): string {
  return htmlToPlainText(html).replace(/\s*\n\s*/g, ' ').trim();
}

/**
 * Element-innhold → Markdown: HTML-segmenter som tekst, kodesegmenter som
 * ```arcscript-blokker (mentions vises som @[id]).
 */
export function contentHtmlToMarkdown(html: string | null | undefined): string {
  if (!html) return '';
  const parts: string[] = [];
  for (const seg of segmentContentHtml(html)) {
    if (seg.kind === 'html') {
      const t = htmlToPlainText(seg.html);
      if (t) parts.push(t);
    } else {
      const code = seg.code.trim();
      if (code) parts.push('```arcscript\n' + code + '\n```');
    }
  }
  return parts.join('\n\n');
}

/** Ren tekst → enkel riktekst-HTML (avsnitt per tom linje, entiteter escapet). */
export function plainTextToHtml(text: string | null | undefined): string {
  if (!text) return '';
  const esc = (s: string) => s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}
