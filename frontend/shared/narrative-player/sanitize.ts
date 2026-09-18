/**
 * Avhengighetsfri HTML-sanitering for standalone-spilleren (kjører kun i
 * nettleser). Hvitliste-basert DOM-vandring: ukjente tagger pakkes ut,
 * farlige tagger fjernes helt, kun trygge attributter beholdes.
 */

const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 's', 'u', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'a', 'hr',
  'blockquote', 'span', 'img', 'code', 'pre',
]);
const DROP_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'form', 'input', 'button', 'textarea', 'select', 'svg', 'math', 'template']);
const ALLOWED_ATTRS = new Set(['href', 'class', 'data-id', 'data-kind', 'src', 'alt', 'title']);

function safeUrl(value: string, allowMailto: boolean): boolean {
  const v = value.trim().toLowerCase();
  if (v.startsWith('#') || v.startsWith('/')) return true;
  if (v.startsWith('https://') || v.startsWith('http://')) return true;
  return allowMailto && v.startsWith('mailto:');
}

function clean(node: Element): void {
  for (const child of Array.from(node.children)) {
    const tag = child.tagName.toLowerCase();
    if (DROP_TAGS.has(tag)) { child.remove(); continue; }
    if (!ALLOWED_TAGS.has(tag)) {
      // Pakk ut: behold barna, fjern selve taggen.
      clean(child);
      child.replaceWith(...Array.from(child.childNodes));
      continue;
    }
    for (const attr of Array.from(child.attributes)) {
      const name = attr.name.toLowerCase();
      if (!ALLOWED_ATTRS.has(name) || name.startsWith('on')) { child.removeAttribute(attr.name); continue; }
      if (name === 'href' && !safeUrl(attr.value, true)) child.removeAttribute(attr.name);
      if (name === 'src' && !/^https?:\/\//i.test(attr.value.trim())) child.removeAttribute(attr.name);
    }
    if (tag === 'a') { child.setAttribute('target', '_blank'); child.setAttribute('rel', 'noopener noreferrer'); }
    clean(child);
  }
}

export function sanitizeHtml(html: string): string {
  if (typeof DOMParser === 'undefined') return '';
  const doc = new DOMParser().parseFromString(`<!doctype html><body>${html}`, 'text/html');
  clean(doc.body);
  return doc.body.innerHTML;
}

/** HTML → ren tekst (til knappe-etiketter). */
export function textOf(html: string): string {
  if (typeof DOMParser === 'undefined') return html.replace(/<[^>]+>/g, '');
  const doc = new DOMParser().parseFromString(`<!doctype html><body>${html}`, 'text/html');
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}
