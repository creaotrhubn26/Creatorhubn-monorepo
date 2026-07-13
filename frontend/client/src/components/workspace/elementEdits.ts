/**
 * elementEdits — CreatorHub Design (per-element-lag): lagrede stil-overstyringer pr. element,
 * anvendt på nytt ved sidelast for ALLE som ser workspacet. Bygger på Edit-modus i
 * WorkspaceDesignOverlay (som tidligere kun pakket edits til en utvikler-handoff).
 *
 * Lagres i design-tokens under `elementEdits`-namespace: { [selektor]: { [css-prop]: verdi } }.
 * Selektoren er en unik strukturell sti (nth-of-type). BEST-EFFORT: en lagret endring kan drive
 * hvis sidelayouten senere endres mye. Kun hvitlistede, trygge visuelle props (ikke vilkårlig CSS).
 */
import { useEffect } from 'react';

export type ElementEdits = Record<string, Record<string, string>>;

/** Utled design-workspace fra host (leadgrid.no → leadgrid, theroleroom.com → theroleroom, ellers
 *  creatorhub). Brukes av de globale mount-punktene så editoren lagrer til riktig produkt. */
export function detectDesignWorkspace(hostname?: string): string {
  const h = (hostname ?? (typeof window !== 'undefined' ? window.location.hostname : '')).toLowerCase();
  if (h.includes('leadgrid')) return 'leadgrid';
  if (h.includes('theroleroom')) return 'theroleroom';
  return 'creatorhub';
}

// Hvitlistede CSS-props (må matche ALLOWED i backend design-tokens-store). Trygge visuelle
// egenskaper — ikke position/display/etc. som lett bryter layout katastrofalt.
export const EDITABLE_CSS_PROPS = new Set<string>([
  'color', 'background-color', 'background', 'border-color', 'border-radius',
  'border-width', 'border-style', 'font-size', 'font-weight', 'letter-spacing',
  'text-align', 'padding', 'margin', 'opacity', 'box-shadow', 'text-decoration',
]);

// Verdi-sanitering: samme trygge tegnsett som backend (hex/rgba/px/nøkkelord). Ikke url()/expression.
const SAFE_VALUE = /^[A-Za-z0-9#,.()%\-\s/]{0,120}$/;
// Selektor-sanitering: strukturelle css-selektorer (tag, #id, .class, :nth-of-type, > mellomrom).
const SAFE_SELECTOR = /^[A-Za-z0-9#.\-_ >:()]{1,400}$/;

export function isSafeEdit(prop: string, value: string): boolean {
  // Charsettet blokkerer CSS-breakout (;{}:@ ikke tillatt); nekt i tillegg url() (ekstern last).
  return EDITABLE_CSS_PROPS.has(prop) && typeof value === 'string' && SAFE_VALUE.test(value) && !/url\(/i.test(value);
}
export function isSafeSelector(sel: string): boolean {
  return typeof sel === 'string' && SAFE_SELECTOR.test(sel) && !sel.includes('..');
}

/**
 * uniqueSelector — bygg en unik strukturell selektor for et element. Bruker #id når det finnes
 * (stabilt), ellers en :nth-of-type-sti opp til <body>. Unik ved fangst-tidspunkt.
 */
export function uniqueSelector(el: Element): string {
  if (el.id && /^[A-Za-z][\w-]*$/.test(el.id)) return `#${el.id}`;
  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node.nodeType === 1 && node.tagName.toLowerCase() !== 'body' && node.tagName.toLowerCase() !== 'html') {
    let part = node.tagName.toLowerCase();
    const parent: Element | null = node.parentElement;
    if (parent) {
      const sameTag = Array.from(parent.children).filter((c) => c.tagName === node!.tagName);
      if (sameTag.length > 1) part += `:nth-of-type(${sameTag.indexOf(node) + 1})`;
    }
    parts.unshift(part);
    node = node.parentElement;
  }
  return parts.join(' > ');
}

/** Bygg CSS-tekst fra edits (kun trygge props/verdier/selektorer). !important så den vinner. */
export function buildEditsCss(edits: ElementEdits): string {
  const rules: string[] = [];
  for (const [sel, props] of Object.entries(edits || {})) {
    if (!isSafeSelector(sel)) continue;
    const decls = Object.entries(props || {})
      .filter(([p, v]) => isSafeEdit(p, v))
      .map(([p, v]) => `${p}: ${v} !important;`);
    if (decls.length) rules.push(`${sel} { ${decls.join(' ')} }`);
  }
  return rules.join('\n');
}

export type ElementText = Record<string, string>;

/** Anvend tekst-overstyringer via textContent (XSS-trygt). React kan re-rendre og overskrive, så
 *  vi re-applikerer ved DOM-endringer (rAF-debounced, kun når teksten faktisk avviker). Best-effort. */
function applyTextEdits(textEdits: ElementText): (() => void) | undefined {
  const entries = Object.entries(textEdits || {}).filter(([sel]) => isSafeSelector(sel));
  if (!entries.length) return undefined;
  const apply = () => {
    for (const [sel, text] of entries) {
      try {
        document.querySelectorAll(sel).forEach((el) => { if (el.textContent !== text) el.textContent = text; });
      } catch { /* ugyldig selektor — hopp over */ }
    }
  };
  apply();
  let scheduled = false;
  const obs = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; apply(); });
  });
  try { obs.observe(document.body, { childList: true, subtree: true, characterData: true }); } catch { /* no body */ }
  return () => obs.disconnect();
}

const STYLE_ID = 'chd-element-edits';

/**
 * useElementEdits — hent lagrede per-element-edits for workspacet (RÅ, raw:true) og injiser dem
 * som ett <style>-tag. Kjøres i shellene så edits gjelder alle brukere. Ingen edits → tomt → identisk.
 */
export function useElementEdits(workspace: string): void {
  useEffect(() => {
    let live = true;
    let cleanupText: (() => void) | undefined;
    fetch(`/api/design/tokens?ws=${encodeURIComponent(workspace)}&raw=1`, { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!live || !d || d.raw !== true || !d.tokens) return;
        const t = d.tokens as Record<string, unknown>;
        // Stil-edits → <style>-tag.
        const css = t.elementEdits ? buildEditsCss(t.elementEdits as ElementEdits) : '';
        if (css) {
          let tag = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
          if (!tag) { tag = document.createElement('style'); tag.id = STYLE_ID; document.head.appendChild(tag); }
          tag.textContent = css;
        }
        // Tekst-edits → textContent (m/ observer-reapply).
        if (t.elementText && typeof t.elementText === 'object') {
          cleanupText = applyTextEdits(t.elementText as ElementText);
        }
      })
      .catch(() => {});
    return () => { live = false; if (cleanupText) cleanupText(); };
  }, [workspace]);
}
