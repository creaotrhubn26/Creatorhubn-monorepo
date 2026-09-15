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

const CODE_BLOCK_RE = /<pre(?:\s[^>]*)?>\s*<code(?:\s[^>]*)?>([\s\S]*?)<\/code>\s*<\/pre>/gi;
const MENTION_RE = /<span([^>]*)>([\s\S]*?)<\/span>/gi;
const TAG_RE = /<[^>]+>/g;

const ENTITY_MAP: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", '#x27': "'", '#x2F': '/', '#47': '/',
};

export function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (whole, entity: string) => {
    if (entity in ENTITY_MAP) return ENTITY_MAP[entity];
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    if (entity.startsWith('#')) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return whole;
  });
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function readAttr(attrs: string, name: string): string | null {
  const m = attrs.match(new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'));
  if (!m) return null;
  return decodeEntities(m[1] ?? m[2] ?? '');
}

function mentionKind(attrs: string): MentionRef['kind'] {
  const explicit = readAttr(attrs, 'data-kind');
  const cls = (readAttr(attrs, 'class') ?? '') + ' ' + (explicit ?? '');
  if (/variable/i.test(cls)) return 'variable';
  if (/component/i.test(cls)) return 'component';
  if (/board/i.test(cls)) return 'board';
  return 'element';
}

/**
 * Gjør et kodeblokk-innhold om til ren skripttekst: mention-spans → `@[id]`,
 * andre tagger (f.eks. <br>) → linjeskift/fjernes, entiteter dekodes.
 */
export function prepareCode(rawInner: string): { code: string; mentions: MentionRef[] } {
  const mentions: MentionRef[] = [];
  let code = rawInner.replace(MENTION_RE, (_whole, attrs: string, label: string) => {
    const id = readAttr(attrs, 'data-id');
    if (!id) return decodeEntities(label.replace(TAG_RE, ''));
    const ref: MentionRef = { id, kind: mentionKind(attrs), label: decodeEntities(label.replace(TAG_RE, '')).trim() };
    mentions.push(ref);
    return `@[${id}]`;
  });
  code = code.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>\s*<p[^>]*>/gi, '\n').replace(TAG_RE, '');
  return { code: decodeEntities(code), mentions };
}

/** Del element-HTML i html-/kodesegmenter i dokumentrekkefølge. */
export function segmentContentHtml(html: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  if (!html) return segments;
  let last = 0;
  let index = 0;
  CODE_BLOCK_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CODE_BLOCK_RE.exec(html)) !== null) {
    if (m.index > last) {
      const chunk = html.slice(last, m.index);
      if (chunk.trim()) segments.push({ kind: 'html', index: index++, html: chunk });
    }
    const { code, mentions } = prepareCode(m[1]);
    segments.push({ kind: 'code', index: index++, code, rawHtml: m[0], mentions });
    last = m.index + m[0].length;
  }
  if (last < html.length) {
    const chunk = html.slice(last);
    if (chunk.trim()) segments.push({ kind: 'html', index: index++, html: chunk });
  }
  return segments;
}

/** Fjern alle kodeblokker (til visning uten kjøring). */
export function stripCodeBlocks(html: string): string {
  return html.replace(CODE_BLOCK_RE, '');
}

/** Har innholdet minst én kodeblokk? */
export function hasScript(html: string | null | undefined): boolean {
  if (!html) return false;
  CODE_BLOCK_RE.lastIndex = 0;
  return CODE_BLOCK_RE.test(html);
}
