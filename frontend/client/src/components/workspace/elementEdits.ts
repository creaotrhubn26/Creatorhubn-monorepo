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
// Selektor-sanitering: strukturelle css-selektorer (tag, #id, .class, :nth-of-type, >, mellomrom)
// + attributt-selektorer for stabile data-edit-id-er ([data-edit-id="..."]). Ingen ;{}@ → ingen breakout.
const SAFE_SELECTOR = /^[A-Za-z0-9#.\-_ >:()\[\]="']{1,400}$/;

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
  // Foretrekk en eksplisitt, stabil data-edit-id (komponenter kan opt-inne) → drifter aldri.
  const editId = el.getAttribute('data-edit-id');
  if (editId && /^[A-Za-z0-9_-]{1,64}$/.test(editId)) return `[data-edit-id="${editId}"]`;
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
export type ElementAnim = Record<string, string>; // selektor → preset-nøkkel

// Animasjons-presets (fast katalog). `anim` = CSS animation-shorthand som peker på keyframes under.
export const ANIM_PRESETS: Record<string, { label: string; anim: string }> = {
  'fade-in': { label: 'Fade inn', anim: 'chd-fade-in .6s ease both' },
  'slide-up': { label: 'Skyv opp', anim: 'chd-slide-up .6s cubic-bezier(.2,.7,.2,1) both' },
  'slide-down': { label: 'Skyv ned', anim: 'chd-slide-down .6s cubic-bezier(.2,.7,.2,1) both' },
  'zoom-in': { label: 'Zoom inn', anim: 'chd-zoom-in .5s ease both' },
  'pulse': { label: 'Puls (loop)', anim: 'chd-pulse 2s ease-in-out infinite' },
  'bounce': { label: 'Sprett (loop)', anim: 'chd-bounce 1.6s ease-in-out infinite' },
  'float': { label: 'Sveve (loop)', anim: 'chd-float 3s ease-in-out infinite' },
};

// Keyframes-katalog — injiseres én gang når minst én animasjon er i bruk.
export const ANIM_KEYFRAMES = [
  '@keyframes chd-fade-in { from { opacity: 0 } to { opacity: 1 } }',
  '@keyframes chd-slide-up { from { opacity: 0; transform: translateY(18px) } to { opacity: 1; transform: none } }',
  '@keyframes chd-slide-down { from { opacity: 0; transform: translateY(-18px) } to { opacity: 1; transform: none } }',
  '@keyframes chd-zoom-in { from { opacity: 0; transform: scale(.92) } to { opacity: 1; transform: none } }',
  '@keyframes chd-pulse { 0%,100% { transform: scale(1) } 50% { transform: scale(1.05) } }',
  '@keyframes chd-bounce { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-9px) } }',
  '@keyframes chd-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-7px) } }',
].join('\n');

/** Bygg animasjons-CSS: keyframes (én gang) + `selektor { animation: ... }` for hver gyldige preset. */
export function buildAnimCss(anim: ElementAnim): string {
  const rules: string[] = [];
  for (const [sel, key] of Object.entries(anim || {})) {
    if (!isSafeSelector(sel) || !ANIM_PRESETS[key]) continue;
    rules.push(`${sel} { animation: ${ANIM_PRESETS[key].anim}; }`);
  }
  return rules.length ? `${ANIM_KEYFRAMES}\n${rules.join('\n')}` : '';
}

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

// Notifikasjons-utseende (toasts/snackbars/alerts): flate string-tokens → global .MuiAlert-regel.
// Nesten alle transiente meldinger i appen rendrer MUI Alert, så dette restyler save/change-meldinger
// app-vidt. Kun EKSPLISITT satte verdier gir deklarasjoner → ingen override → MUI-standard (identisk).
const NOTIF_MAP: Array<[string, string]> = [
  ['notifBg', 'background-color'], ['notifText', 'color'], ['notifRadius', 'border-radius'],
  ['notifShadow', 'box-shadow'], ['notifBorder', 'border'], ['notifFont', 'font-family'],
];
export function buildNotifCss(tokens: Record<string, unknown>): string {
  const decls: string[] = [];
  for (const [key, prop] of NOTIF_MAP) {
    const v = tokens[key];
    // Verdi-charsettet (backend string-token) blokkerer ;{}:@ → ingen breakout; nekt url() (ekstern last).
    if (typeof v === 'string' && v && !/url\(/i.test(v)) decls.push(`${prop}: ${v} !important;`);
  }
  return decls.length ? `.MuiAlert-root { ${decls.join(' ')} }` : '';
}

// ── Innsatte elementer (Insert-modus): nye noder fra strukturert data, forankret til et element ──
export type InsertSpec = { id: string; type: string; pos: 'before' | 'after'; text?: string; href?: string; src?: string };
export type ElementInserts = Record<string, InsertSpec[]>; // anker-selektor → spesifikasjoner

const INSERT_TYPES = new Set(['heading', 'text', 'button', 'divider', 'image', 'infographic']);
// URL trygg: relativ (/…) eller https:// — aldri javascript:/data:; ingen anførsel/vinkelparentes.
export function isSafeUrl(u: unknown): u is string {
  return typeof u === 'string' && u.length <= 600 && (/^\//.test(u) || /^https:\/\//i.test(u)) && !/[<>"'\\]/.test(u) && !/javascript:/i.test(u);
}

/** Bygg en TRYGG DOM-node fra en insert-spec (createElement + textContent + saniterte attributter —
 *  ALDRI innerHTML → ingen XSS). Ukjent type → null. */
export function buildInsertNode(spec: InsertSpec): HTMLElement | null {
  let node: HTMLElement;
  switch (spec.type) {
    case 'heading': node = document.createElement('h2'); node.textContent = spec.text || ''; break;
    case 'text': node = document.createElement('p'); node.textContent = spec.text || ''; break;
    case 'button': {
      const a = document.createElement('a'); a.textContent = spec.text || 'Knapp';
      if (isSafeUrl(spec.href)) a.setAttribute('href', spec.href);
      a.setAttribute('role', 'button');
      a.style.cssText = 'display:inline-block;padding:10px 18px;border-radius:8px;background:#ff8c00;color:#fff;text-decoration:none;font-weight:700';
      node = a; break;
    }
    case 'divider': node = document.createElement('hr'); node.style.cssText = 'border:none;border-top:1px solid rgba(128,128,128,.3);margin:16px 0'; break;
    case 'image':
    case 'infographic': {
      const img = document.createElement('img');
      if (isSafeUrl(spec.src)) img.setAttribute('src', spec.src);
      img.setAttribute('alt', spec.text || '');
      img.style.cssText = 'max-width:100%;height:auto;display:block';
      node = img; break;
    }
    default: return null;
  }
  node.setAttribute('data-chd-insert', spec.id);
  return node;
}

/** Sett inn nye elementer forankret til selektorer; re-injiser når React fjerner dem (observer). */
function applyInserts(inserts: ElementInserts): (() => void) | undefined {
  const entries = Object.entries(inserts || {}).filter(([sel]) => isSafeSelector(sel));
  if (!entries.length) return undefined;
  const apply = () => {
    for (const [sel, specs] of entries) {
      let anchor: Element | null = null;
      try { anchor = document.querySelector(sel); } catch { continue; }
      if (!anchor || !anchor.parentNode) continue;
      for (const spec of specs) {
        if (!spec || !INSERT_TYPES.has(spec.type) || !/^[A-Za-z0-9_-]{1,40}$/.test(spec.id || '')) continue;
        if (document.querySelector(`[data-chd-insert="${spec.id}"]`)) continue; // allerede satt inn
        const node = buildInsertNode(spec);
        if (!node) continue;
        if (spec.pos === 'before') anchor.parentNode.insertBefore(node, anchor);
        else anchor.parentNode.insertBefore(node, anchor.nextSibling);
      }
    }
  };
  apply();
  let scheduled = false;
  const obs = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; apply(); });
  });
  try { obs.observe(document.body, { childList: true, subtree: true }); } catch { /* no body */ }
  return () => obs.disconnect();
}

export type ElementBindings = Record<string, string>; // selektor → metric-kilde-nøkkel

/** Data-bind: sett elementets tekst = metrics[<kilde>].value (live, koblet). Observer-reapply. */
function applyBindings(bindings: ElementBindings, metrics: Record<string, { value?: unknown }>): (() => void) | undefined {
  const entries = Object.entries(bindings || {}).filter(([sel]) => isSafeSelector(sel));
  if (!entries.length) return undefined;
  const apply = () => {
    for (const [sel, key] of entries) {
      const m = metrics && metrics[key];
      if (!m || m.value == null) continue;
      const val = String(m.value);
      try { document.querySelectorAll(sel).forEach((el) => { if (el.textContent !== val) el.textContent = val; }); } catch { /* ugyldig selektor */ }
    }
  };
  apply();
  let scheduled = false;
  const obs = new MutationObserver(() => { if (scheduled) return; scheduled = true; requestAnimationFrame(() => { scheduled = false; apply(); }); });
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
    let cleanupInserts: (() => void) | undefined;
    let cleanupBind: (() => void) | undefined;
    fetch(`/api/design/tokens?ws=${encodeURIComponent(workspace)}&raw=1`, { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!live || !d || d.raw !== true || !d.tokens) return;
        const t = d.tokens as Record<string, unknown>;
        // Stil-edits + animasjoner → ett <style>-tag.
        const editCss = t.elementEdits ? buildEditsCss(t.elementEdits as ElementEdits) : '';
        const animCss = t.elementAnim ? buildAnimCss(t.elementAnim as ElementAnim) : '';
        const notifCss = buildNotifCss(t);
        const css = [editCss, animCss, notifCss].filter(Boolean).join('\n');
        if (css) {
          let tag = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
          if (!tag) { tag = document.createElement('style'); tag.id = STYLE_ID; document.head.appendChild(tag); }
          tag.textContent = css;
        }
        // Tekst-edits → textContent (m/ observer-reapply).
        if (t.elementText && typeof t.elementText === 'object') {
          cleanupText = applyTextEdits(t.elementText as ElementText);
        }
        // Innsatte elementer → nye noder (m/ observer-reinjeksjon).
        if (t.elementInserts && typeof t.elementInserts === 'object') {
          cleanupInserts = applyInserts(t.elementInserts as ElementInserts);
        }
        // Data-bindinger → elementtekst = metric-verdi (live, koblet).
        if (t.elementBindings && typeof t.elementBindings === 'object') {
          cleanupBind = applyBindings(t.elementBindings as ElementBindings, (t.metrics as Record<string, { value?: unknown }>) || {});
        }
      })
      .catch(() => {});
    return () => { live = false; if (cleanupText) cleanupText(); if (cleanupInserts) cleanupInserts(); if (cleanupBind) cleanupBind(); };
  }, [workspace]);
}
