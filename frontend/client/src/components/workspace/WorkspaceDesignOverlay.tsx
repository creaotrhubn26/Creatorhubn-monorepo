/**
 * WorkspaceDesignOverlay — CreatorHub Design (Nivå 3 + Fase B): live-overlay på den EKTE
 * Team Workspace-ruten. Moduser:
 *  - Annotate: hover-highlight + klikk ekte shell-elementer → pins med fri-tekst intent.
 *  - Tweaks:   juster aksent live (--ws-accent* på :root) + lagre til workspace (PUT).
 *  - Edit:     klikk element → property-inspector (typografi/utseende/spacing) som skriver
 *              live til elementets stil (forhåndsvisning) og fanges i Handoff-bundelen.
 *  - Handoff:  pakk pins + edits + token-kontekst til en Claude Code-bundle (fil-peker +
 *              computed styles) for STRUKTURELLE endringer (det token/nav/copy-data ikke dekker).
 * Aktiveres med ?design=1. Bruker INGEN window.alert/confirm/prompt (blokkerer extension).
 * Selvstendig: inline styles, ingen MUI (unngår å arve dark-temaet).
 */
import React from 'react';
import { uniqueSelector, ANIM_PRESETS, ANIM_KEYFRAMES, buildInsertNode, type ElementEdits, type InsertSpec } from './elementEdits';

type ElDesc = {
  tag: string; id?: string; cls?: string; text?: string;
  style: Record<string, string>; rect: { x: number; y: number; w: number; h: number };
};
type Note = { id: number; d: ElDesc; intent: string };
type Edits = Record<string, Record<string, string>>; // selector → { cssProp: value }

const PANEL = '#FBFAF6', INK = '#171C28', INK2 = '#5C6270', LINE = '#E7E3D8', ACC = '#EE7A08';

function hexVars(hex: string): Record<string, string> {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return {};
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  const dark = '#' + [r, g, b].map((x) => Math.round(x * 0.9).toString(16).padStart(2, '0')).join('');
  return { '--ws-accent': hex, '--ws-accent-hover': dark, '--ws-accent-soft': `rgba(${r},${g},${b},0.14)`, '--ws-accent-border': `rgba(${r},${g},${b},0.42)` };
}

function describe(el: Element): ElDesc {
  const cs = getComputedStyle(el as HTMLElement);
  const r = el.getBoundingClientRect();
  const cn = typeof (el as HTMLElement).className === 'string' ? (el as HTMLElement).className : '';
  return {
    tag: el.tagName.toLowerCase(),
    id: (el as HTMLElement).id || undefined,
    cls: cn.trim().split(/\s+/).filter(Boolean).slice(0, 3).join('.') || undefined,
    text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 48) || undefined,
    style: { color: cs.color, background: cs.backgroundColor, fontSize: cs.fontSize, fontWeight: cs.fontWeight, borderRadius: cs.borderRadius, padding: cs.padding },
    rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
  };
}

const selOf = (d: ElDesc) => `${d.tag}${d.id ? '#' + d.id : ''}${d.cls ? '.' + d.cls : ''}`;

// Singleton-vakt: hvis både et globalt mount (App.tsx/casting-main) og et per-side mount er aktivt
// samtidig, skal KUN ett overlay rendres (ellers dobbelt UI). Modulnivå-flagg, claim ved mount.
let overlayActive = false;

// ── Design-rådgiver (heuristisk, WCAG-forankret) ─────────────────────────────────────────────
type Suggestion = { id: string; severity: 'high' | 'med' | 'low'; text: string; fixLabel?: string; fixField?: string; fixProp?: string; fixValue?: string; fixUnit?: string };
function parseRgb(s: string): [number, number, number, number] | null {
  const m = s.match(/rgba?\(([^)]+)\)/i);
  if (!m) return null;
  const p = m[1].split(',').map((x) => parseFloat(x.trim()));
  return [p[0] || 0, p[1] || 0, p[2] || 0, p[3] == null ? 1 : p[3]];
}
function relLum(r: number, g: number, b: number): number {
  const a = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}
function contrast(a: [number, number, number], b: [number, number, number]): number {
  const l1 = relLum(a[0], a[1], a[2]), l2 = relLum(b[0], b[1], b[2]);
  const hi = Math.max(l1, l2), lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}
function effectiveBg(el: Element): [number, number, number] {
  let n: Element | null = el;
  while (n) { const bg = parseRgb(getComputedStyle(n).backgroundColor); if (bg && bg[3] > 0.1) return [bg[0], bg[1], bg[2]]; n = n.parentElement; }
  return [255, 255, 255];
}
/** Analyser et element → konkrete, forklarbare design-forslag (kontrast/lesbarhet/klikkmål). */
function analyzeElement(el: HTMLElement): Suggestion[] {
  const cs = getComputedStyle(el);
  const out: Suggestion[] = [];
  const fg = parseRgb(cs.color), bg = effectiveBg(el);
  const fontPx = parseFloat(cs.fontSize) || 0;
  const hasText = !!(el.textContent && el.textContent.trim().length > 1) && el.children.length === 0;
  if (fg && hasText) {
    const ratio = contrast([fg[0], fg[1], fg[2]], bg);
    const bold = parseInt(cs.fontWeight, 10) >= 700;
    const large = fontPx >= 24 || (fontPx >= 18.66 && bold);
    const min = large ? 3 : 4.5;
    if (ratio < min) {
      const white = contrast([255, 255, 255], bg), black = contrast([17, 17, 17], bg);
      const better = white > black ? '#ffffff' : '#111111';
      out.push({ id: 'contrast', severity: 'high', text: `Lav kontrast (${ratio.toFixed(1)}:1, WCAG krever ${min}:1) — teksten kan bli vanskelig å lese.`, fixLabel: `Sett tekst → ${better}`, fixField: 'color', fixProp: 'color', fixValue: better });
    }
  }
  if (fontPx && fontPx < 14 && hasText && (el.textContent || '').trim().length > 25) {
    out.push({ id: 'fontsize', severity: 'med', text: `Liten skrift (${Math.round(fontPx)}px) for brødtekst — vurder ≥15px for lesbarhet.`, fixLabel: 'Sett 15px', fixField: 'fontSize', fixProp: 'font-size', fixValue: '15', fixUnit: 'px' });
  }
  const interactive = /^(a|button)$/i.test(el.tagName) || el.getAttribute('role') === 'button';
  if (interactive) {
    const r = el.getBoundingClientRect();
    if (r.height && r.height < 40) out.push({ id: 'tap', severity: 'med', text: `Lite klikkmål (${Math.round(r.height)}px høyt) — a11y anbefaler ≥44px for touch.`, fixLabel: 'Øk padding', fixField: 'padding', fixProp: 'padding', fixValue: '12px 18px' });
  }
  return out;
}

export default function WorkspaceDesignOverlay({
  onClose,
  targetFile = 'frontend/client/src/components/workspace/WorkspaceShell.tsx',
  workspace = 'creatorhub',
}: { onClose?: () => void; targetFile?: string; workspace?: string }) {
  const [owns, setOwns] = React.useState(false);
  React.useEffect(() => {
    if (overlayActive) return; // et annet overlay eier allerede skjermen
    overlayActive = true; setOwns(true);
    return () => { overlayActive = false; };
  }, []);
  const [mode, setMode] = React.useState<'annotate' | 'tweaks' | 'edit'>('annotate');
  const [notes, setNotes] = React.useState<Note[]>([]);
  const [hover, setHover] = React.useState<ElDesc | null>(null);
  const [accent, setAccent] = React.useState('#ff8c00');
  const [bundle, setBundle] = React.useState<string | null>(null);
  const [saveMsg, setSaveMsg] = React.useState('');
  // Edit-modus
  const [sel, setSel] = React.useState<HTMLElement | null>(null);
  const [selDesc, setSelDesc] = React.useState<ElDesc | null>(null);
  const [insp, setInsp] = React.useState<Record<string, string>>({});
  const [edits, setEdits] = React.useState<Edits>({});
  const [textEdits, setTextEdits] = React.useState<Record<string, string>>({});
  const [animEdits, setAnimEdits] = React.useState<Record<string, string>>({});
  const [bindEdits, setBindEdits] = React.useState<Record<string, string>>({}); // selektor → datakilde-nøkkel
  const [insertEdits, setInsertEdits] = React.useState<Record<string, InsertSpec[]>>({});
  // Insert-skjema
  const [insType, setInsType] = React.useState('heading');
  const [insText, setInsText] = React.useState('');
  const [insUrl, setInsUrl] = React.useState('');
  const [insSource, setInsSource] = React.useState(''); // dynamisk infographic-kilde (metric-nøkkel)
  const [sources, setSources] = React.useState<Array<{ key: string; value: unknown; label: unknown }>>([]);
  const [insPos, setInsPos] = React.useState<'before' | 'after'>('after');
  const [components, setComponents] = React.useState<Record<string, InsertSpec[]>>({}); // gjenbrukbare komponenter
  const [compName, setCompName] = React.useState('');
  const [pickComp, setPickComp] = React.useState('');
  const nextId = React.useRef(1);
  const route = typeof window !== 'undefined' ? window.location.pathname : '/workspace';

  const inOverlay = (t: EventTarget | null) => t instanceof Element && !!t.closest('[data-chd]');

  React.useEffect(() => {
    if (mode !== 'annotate' && mode !== 'edit') { setHover(null); return; }
    const onMove = (e: MouseEvent) => {
      const t = e.target as Element;
      if (inOverlay(t)) { setHover(null); return; }
      setHover(describe(t));
    };
    const onClick = (e: MouseEvent) => {
      const t = e.target as Element;
      if (inOverlay(t)) return;             // klikk i panelet → la knappene virke
      e.preventDefault(); e.stopPropagation(); // ellers: fang klikket (blokker shell-nav)
      if (mode === 'annotate') {
        setNotes((n) => [...n, { id: nextId.current++, d: describe(t), intent: '' }]);
      } else {
        const el = t as HTMLElement, cs = getComputedStyle(el);
        setSel(el); setSelDesc(describe(el));
        setInsp({
          fontSize: String(Math.round(parseFloat(cs.fontSize)) || ''),
          fontWeight: cs.fontWeight,
          color: cs.color,
          background: cs.backgroundColor,
          borderRadius: String(Math.round(parseFloat(cs.borderRadius)) || 0),
          padding: cs.padding,
          // Tekst kun for løvnoder (ingen element-barn) → unngå å nuke barn-innhold.
          text: el.children.length === 0 ? (el.textContent || '') : ' ',
        });
      }
    };
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('click', onClick, true);
    return () => { document.removeEventListener('mousemove', onMove, true); document.removeEventListener('click', onClick, true); };
  }, [mode]);

  const applyAccent = (hex: string) => {
    setAccent(hex);
    const vars = hexVars(hex), root = document.documentElement;
    Object.keys(vars).forEach((k) => root.style.setProperty(k, vars[k]));
  };
  const saveAccent = async () => {
    setSaveMsg('Lagrer…');
    try {
      const r = await fetch(`/api/admin/design/tokens/${encodeURIComponent(workspace)}`, {
        method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accent }),
      });
      setSaveMsg(r.ok ? 'Lagret til workspace ✓' : 'Avvist (krever admin)');
    } catch { setSaveMsg('Nettverksfeil'); }
  };

  // Edit: skriv en css-prop live til valgt element + registrer i edits (for Handoff).
  const applyStyle = (field: string, cssProp: string, rawValue: string, unit = '') => {
    setInsp((s) => ({ ...s, [field]: rawValue }));
    if (!sel || !selDesc) return;
    const value = rawValue === '' ? '' : rawValue + unit;
    sel.style.setProperty(cssProp, value);
    const key = uniqueSelector(sel); // unik strukturell sti → kan re-applikeres ved last
    setEdits((e) => ({ ...e, [key]: { ...(e[key] || {}), [cssProp]: value } }));
  };

  // Edit: bind elementets tekst til en datakilde (metric) — live via textContent + registrer.
  const applyBinding = (sourceKey: string) => {
    if (!sel) return;
    const key = uniqueSelector(sel);
    if (sourceKey) {
      const src = sources.find((s) => s.key === sourceKey);
      if (src && src.value != null) sel.textContent = String(src.value);
      setBindEdits((b) => ({ ...b, [key]: sourceKey }));
    } else {
      setBindEdits((b) => { const n = { ...b }; delete n[key]; return n; });
    }
  };

  // Edit: overstyr elementets TEKST (kun løvnoder). Live via textContent + registrer for lagring.
  const applyText = (value: string) => {
    setInsp((s) => ({ ...s, text: value }));
    if (!sel) return;
    sel.textContent = value;
    setTextEdits((t) => ({ ...t, [uniqueSelector(sel)]: value }));
  };

  // Edit: sett en animasjons-preset på elementet (live via inline animation) + registrer for lagring.
  const applyAnim = (key: string) => {
    setInsp((s) => ({ ...s, anim: key }));
    if (!sel) return;
    if (key && ANIM_PRESETS[key]) sel.style.animation = ANIM_PRESETS[key].anim;
    else sel.style.animation = '';
    setAnimEdits((a) => {
      const next = { ...a };
      if (key && ANIM_PRESETS[key]) next[uniqueSelector(sel)] = key; else delete next[uniqueSelector(sel)];
      return next;
    });
  };

  // Live-preview av animasjoner krever keyframes i dokumentet — injiser dem én gang i Edit-modus.
  React.useEffect(() => {
    const ID = 'chd-anim-keyframes-live';
    if (document.getElementById(ID)) return;
    const s = document.createElement('style'); s.id = ID; s.textContent = ANIM_KEYFRAMES; document.head.appendChild(s);
  }, []);

  // «Koble til»-picker: hent registeret av datakilder (marketing-metrics) i Edit-modus. Hver kilde
  // kommer MED sin gjeldende verdi → editoren viser at dataen faktisk kommer gjennom (infographic + binding).
  React.useEffect(() => {
    if (mode !== 'edit') return;
    let live = true;
    fetch(`/api/admin/design/sources?ws=${encodeURIComponent(workspace)}`, { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (live && d && Array.isArray(d.sources)) setSources(d.sources); })
      .catch(() => {});
    return () => { live = false; };
  }, [mode, workspace]);

  // Insert: legg et nytt element (overskrift/tekst/knapp/bilde/infographic/skille) ved ankeret.
  const b64url = (obj: unknown) => btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const infographicSrc = () => {
    // Dynamisk kilde: server slår opp `metrics[<kilde>]` for workspacet → alltid gjeldende verdi.
    if (insSource.trim()) {
      return `/api/infographics/render.png?tpl=auto&source=${encodeURIComponent(insSource.trim())}&ws=${encodeURIComponent(workspace)}&accent=${encodeURIComponent(accent)}`;
    }
    const d = b64url({ value: insText || '75%', label: insUrl || 'Merkevare' });
    return `/api/infographics/render.png?tpl=auto&d=${d}&accent=${encodeURIComponent(accent)}`;
  };
  // Lagre anker-innsettingene som en navngitt, gjenbrukbar komponent.
  const saveComponent = () => {
    if (!sel) return;
    const name = compName.trim();
    const specs = insertEdits[uniqueSelector(sel)] || [];
    if (!name || !specs.length) return;
    setComponents((c) => ({ ...c, [name]: specs }));
    setCompName('');
  };
  const addInsert = () => {
    if (!sel || !sel.parentNode) return;
    // Komponent: ekspander bibliotekets spec-liste til KOPIER (ferske id-er) ved ankeret.
    if (insType === 'component') {
      const specs = components[pickComp];
      if (!specs || !specs.length) return;
      const key = uniqueSelector(sel);
      const copies = specs.map((s) => ({ ...s, id: `ins-${nextId.current++}` }));
      copies.forEach((spec) => {
        const node = buildInsertNode(spec);
        if (node && sel!.parentNode) { if (insPos === 'before') sel!.parentNode.insertBefore(node, sel); else sel!.parentNode.insertBefore(node, sel!.nextSibling); }
      });
      setInsertEdits((m) => ({ ...m, [key]: [...(m[key] || []), ...copies] }));
      return;
    }
    const id = `ins-${nextId.current++}`;
    const spec: InsertSpec = {
      id, type: insType, pos: insPos,
      text: insText || undefined,
      href: insType === 'button' ? (insUrl || undefined) : undefined,
      src: insType === 'image' ? (insUrl || undefined) : insType === 'infographic' ? infographicSrc() : undefined,
    };
    const node = buildInsertNode(spec);
    if (node) {
      if (insPos === 'before') sel.parentNode.insertBefore(node, sel);
      else sel.parentNode.insertBefore(node, sel.nextSibling);
    }
    const key = uniqueSelector(sel);
    setInsertEdits((m) => ({ ...m, [key]: [...(m[key] || []), spec] }));
    setInsText(''); setInsUrl(''); setInsSource('');
  };

  // Last eksisterende lagrede per-element-edits ved mount → nye edits akkumuleres oppå (så
  // «Lagre» sender hele kartet; JSONB-merge er grunn og erstatter hele elementEdits-nøkkelen).
  React.useEffect(() => {
    let live = true;
    fetch(`/api/design/tokens?ws=${encodeURIComponent(workspace)}&raw=1`, { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (live && d && d.raw === true && d.tokens) {
          if (d.tokens.elementEdits) setEdits(d.tokens.elementEdits as ElementEdits);
          if (d.tokens.elementText && typeof d.tokens.elementText === 'object') setTextEdits(d.tokens.elementText as Record<string, string>);
          if (d.tokens.elementAnim && typeof d.tokens.elementAnim === 'object') setAnimEdits(d.tokens.elementAnim as Record<string, string>);
          if (d.tokens.elementInserts && typeof d.tokens.elementInserts === 'object') setInsertEdits(d.tokens.elementInserts as Record<string, InsertSpec[]>);
          if (d.tokens.elementBindings && typeof d.tokens.elementBindings === 'object') setBindEdits(d.tokens.elementBindings as Record<string, string>);
          if (d.tokens.designComponents && typeof d.tokens.designComponents === 'object') setComponents(d.tokens.designComponents as Record<string, InsertSpec[]>);
        }
      })
      .catch(() => {});
    return () => { live = false; };
  }, [workspace]);

  // Persister per-element-edits til workspacet (gjelder alle brukere ved neste last).
  const saveEdits = async () => {
    setSaveMsg('Lagrer endringer…');
    try {
      const r = await fetch(`/api/admin/design/tokens/${encodeURIComponent(workspace)}`, {
        method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ elementEdits: edits, elementText: textEdits, elementAnim: animEdits, elementInserts: insertEdits, elementBindings: bindEdits, designComponents: components }),
      });
      const n = new Set([...Object.keys(edits), ...Object.keys(textEdits), ...Object.keys(animEdits)]).size;
      setSaveMsg(r.ok ? `Lagret ${n} element ✓` : 'Avvist (krever admin)');
    } catch { setSaveMsg('Nettverksfeil'); }
  };

  // Redigerings-styring: fjern alle edits (stil/tekst/anim) for ett element, eller nullstill alt.
  // Endrer state → «Lagre endringer» persisterer (full effekt ved neste last).
  const deleteEdit = (key: string) => {
    setEdits((e) => { const n = { ...e }; delete n[key]; return n; });
    setTextEdits((t) => { const n = { ...t }; delete n[key]; return n; });
    setAnimEdits((a) => { const n = { ...a }; delete n[key]; return n; });
    setInsertEdits((i) => { const n = { ...i }; delete n[key]; return n; });
    setBindEdits((b) => { const n = { ...b }; delete n[key]; return n; });
    // Fjern også de innsatte nodene fra DOM umiddelbart.
    (insertEdits[key] || []).forEach((s) => document.querySelector(`[data-chd-insert="${s.id}"]`)?.remove());
  };
  const resetAllEdits = () => { setEdits({}); setTextEdits({}); setAnimEdits({}); setInsertEdits({}); setBindEdits({}); };
  const editKeys = Array.from(new Set([...Object.keys(edits), ...Object.keys(textEdits), ...Object.keys(animEdits), ...Object.keys(insertEdits), ...Object.keys(bindEdits)]));
  // Design-forslag for valgt element (recomputes ved nytt valg + etter en fiks endrer insp).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const suggestions = React.useMemo(() => (sel ? analyzeElement(sel) : []), [sel, insp]);

  // AI-forslag + forhåndsvisning: én forhåndsvisning om gangen (apply live UTEN å registrere;
  // «Bruk» commiter via applyStyle, «Angre» gjenoppretter den forrige inline-verdien).
  const [aiSug, setAiSug] = React.useState<Array<{ text: string; apply?: { prop: string; value: string } }>>([]);
  const [aiLoading, setAiLoading] = React.useState(false);
  const [aiMsg, setAiMsg] = React.useState('');
  const [preview, setPreview] = React.useState<{ key: string; prop: string; value: string; prevInline: string } | null>(null);
  const revertActive = () => { if (preview && sel) { if (preview.prevInline) sel.style.setProperty(preview.prop, preview.prevInline); else sel.style.removeProperty(preview.prop); } };
  const doPreview = (key: string, prop: string, value: string) => {
    if (!sel) return;
    revertActive();
    const prevInline = sel.style.getPropertyValue(prop);
    sel.style.setProperty(prop, value);
    setPreview({ key, prop, value, prevInline });
  };
  const commitPreview = () => { if (preview) { applyStyle(preview.prop, preview.prop, preview.value, ''); setPreview(null); } };
  const revertPreview = () => { revertActive(); setPreview(null); };

  const fetchAiSuggestions = async () => {
    if (!sel) return;
    setAiLoading(true); setAiMsg(''); setAiSug([]);
    const cs = getComputedStyle(sel); const r = sel.getBoundingClientRect();
    try {
      const resp = await fetch('/api/admin/design/suggest', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace, accent, element: {
          tag: sel.tagName.toLowerCase(), role: sel.getAttribute('role') || '', text: (sel.textContent || '').slice(0, 200),
          color: cs.color, background: cs.backgroundColor, fontSize: cs.fontSize, fontWeight: cs.fontWeight,
          borderRadius: cs.borderRadius, padding: cs.padding, width: Math.round(r.width), height: Math.round(r.height),
        } }),
      });
      const d = await resp.json().catch(() => ({}));
      if (!resp.ok) { setAiMsg(d.error || 'Avvist (krever admin)'); return; }
      if (d.error) setAiMsg(d.error);
      setAiSug(Array.isArray(d.suggestions) ? d.suggestions : []);
    } catch { setAiMsg('Nettverksfeil'); }
    finally { setAiLoading(false); }
  };
  // Før/etter-sammenligning: «Vis original» skrur MIDLERTIDIG av alle ulagrede/lagrede visuelle
  // endringer (runtime-<style> + in-session inline-stil + animasjon + innsatte noder) via et snapshot,
  // så du ser siden slik den var — klikk igjen for å få endringene tilbake. Ingenting lagres/mistes.
  const [origMode, setOrigMode] = React.useState(false);
  const restoreRef = React.useRef<null | (() => void)>(null);
  const toggleOriginal = () => {
    if (restoreRef.current) { restoreRef.current(); restoreRef.current = null; setOrigMode(false); return; }
    const restores: Array<() => void> = [];
    const tag = document.getElementById('chd-element-edits');
    if (tag) { const prev = tag.textContent; tag.textContent = ''; restores.push(() => { tag.textContent = prev; }); }
    const stripInline = (keys: string[], propsFor: (sel: string) => string[]) => {
      for (const sel of keys) {
        let els: NodeListOf<Element>; try { els = document.querySelectorAll(sel); } catch { continue; }
        els.forEach((n) => { const h = n as HTMLElement; for (const p of propsFor(sel)) { const cur = h.style.getPropertyValue(p); if (cur) { h.style.removeProperty(p); restores.push(() => h.style.setProperty(p, cur)); } } });
      }
    };
    stripInline(Object.keys(edits), (sel) => Object.keys(edits[sel] || {}));
    stripInline(Object.keys(animEdits), () => ['animation']);
    document.querySelectorAll('[data-chd-insert]').forEach((n) => { const h = n as HTMLElement; const prev = h.style.display; h.style.display = 'none'; restores.push(() => { h.style.display = prev; }); });
    restoreRef.current = () => { restores.reverse().forEach((r) => r()); };
    setOrigMode(true);
  };
  // Rydd opp: gjenopprett hvis man forlater edit-modus eller lukker mens original vises.
  React.useEffect(() => { if (mode !== 'edit' && restoreRef.current) { restoreRef.current(); restoreRef.current = null; setOrigMode(false); } }, [mode]);
  React.useEffect(() => () => { if (restoreRef.current) restoreRef.current(); }, []);

  // Forhåndsvis/Bruk/Angre-knapper for et forslag med en konkret (prop, value)-endring.
  const renderSugActions = (key: string, prop?: string, value?: string) => {
    if (!prop || !value) return null;
    if (preview?.key === key) return (
      <div style={{ display: 'flex', gap: 6, marginTop: 5 }}>
        <button data-chd onClick={commitPreview} style={{ ...cta, padding: '3px 9px', fontSize: 11 }}>Bruk</button>
        <button data-chd onClick={revertPreview} style={{ ...btn(false), padding: '3px 9px', fontSize: 11 }}>Angre</button>
      </div>
    );
    return <button data-chd onClick={() => doPreview(key, prop, value)} style={{ ...btn(false), marginTop: 5, padding: '3px 9px', fontSize: 11 }}>Forhåndsvis</button>;
  };

  const buildBundle = () => setBundle(JSON.stringify({
    tool: 'creatorhub-design-handoff', targetFile, route, workspace,
    tokenContext: hexVars(accent),
    instruction: 'Bygg inn disse endringene i WorkspaceShell. Merkevare/nav/copy administreres allerede som data — ikke hardkod dem. `edits` er direkte stil-endringer fra Edit-modus; `notes` er annoteringer.',
    edits: Object.entries(edits).map(([element, changes]) => ({ element, changes })),
    notes: notes.map((n) => ({ element: selOf(n.d), text: n.d.text, computed: n.d.style, intent: n.intent || '(ingen intent skrevet)' })),
  }, null, 2));

  const setIntent = (id: number, v: string) => setNotes((n) => n.map((x) => (x.id === id ? { ...x, intent: v } : x)));
  const removeNote = (id: number) => setNotes((n) => n.filter((x) => x.id !== id));

  // Tastatur-snarveier (WCAG 2.1.1 Keyboard): A/T/E = modus, Esc = av-velg/lukk,
  // ⌘/Ctrl+↵ = Send til Claude Code. Ignorerer taster mens man skriver i felt.
  const buildBundleRef = React.useRef(buildBundle);
  buildBundleRef.current = buildBundle;
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (bundle) { if (e.key === 'Escape') { e.preventDefault(); setBundle(null); } return; }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); buildBundleRef.current(); return; }
      if (typing) return;
      if (e.key === 'Escape') { e.preventDefault(); if (mode === 'edit' && sel) { setSel(null); setSelDesc(null); } else onClose?.(); }
      else if (e.key.toLowerCase() === 'a') setMode('annotate');
      else if (e.key.toLowerCase() === 't') setMode('tweaks');
      else if (e.key.toLowerCase() === 'e') setMode('edit');
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mode, sel, bundle, onClose]);

  // Dialog-fokus (WCAG 2.4.3): flytt fokus inn i Handoff-modalen når den åpnes.
  const dialogRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => { if (bundle && dialogRef.current) dialogRef.current.focus(); }, [bundle]);

  const btn = (active: boolean): React.CSSProperties => ({
    padding: '6px 12px', borderRadius: 8, border: `1px solid ${active ? ACC : LINE}`,
    background: active ? 'rgba(238,122,8,0.10)' : '#fff', color: active ? '#8a4708' : INK2,
    fontWeight: 700, fontSize: 13, cursor: 'pointer',
  });
  const cta: React.CSSProperties = { padding: '7px 13px', borderRadius: 8, border: 0, background: ACC, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' };
  const field: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: `1px solid ${LINE}`, borderRadius: 7, padding: '6px 8px', fontSize: 12.5, fontFamily: 'monospace' };
  const flabel: React.CSSProperties = { fontSize: 11.5, color: INK2, fontWeight: 600, marginBottom: 3, display: 'block' };
  const section: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: '#9AA1AE', margin: '4px 0 2px' };
  const highlight = mode === 'edit' ? (selDesc?.rect || null) : (hover?.rect || null);

  if (!owns) return null; // et annet overlay-instans eier skjermen (singleton)

  return (
    <div data-chd style={{ position: 'fixed', inset: 0, zIndex: 2147483000, pointerEvents: 'none', fontFamily: 'system-ui, sans-serif' }}>
      {/* Fokus-synlighet (WCAG 2.4.7) — inline styles kan ikke :focus-visible, så vi injiserer. */}
      <style>{`[data-chd] button:focus-visible,[data-chd] input:focus-visible,[data-chd] textarea:focus-visible,[data-chd][tabindex]:focus-visible{outline:2px solid ${ACC};outline-offset:2px;border-radius:8px}`}</style>
      {/* Hover/selection-highlight */}
      {(mode === 'annotate' || mode === 'edit') && hover && (
        <div style={{ position: 'fixed', left: hover.rect.x, top: hover.rect.y, width: hover.rect.w, height: hover.rect.h,
          border: `2px dashed ${ACC}`, borderRadius: 6, background: 'rgba(238,122,8,0.05)', pointerEvents: 'none' }} />
      )}
      {mode === 'edit' && selDesc && (
        <div style={{ position: 'fixed', left: selDesc.rect.x - 1, top: selDesc.rect.y - 1, width: selDesc.rect.w + 2, height: selDesc.rect.h + 2,
          border: `2px solid ${ACC}`, borderRadius: 6, pointerEvents: 'none', boxShadow: '0 0 0 3px rgba(238,122,8,0.18)' }} />
      )}
      {/* Pins */}
      {notes.map((n, i) => (
        <div key={n.id} style={{ position: 'fixed', left: n.d.rect.x - 6, top: n.d.rect.y - 6, width: 22, height: 22, borderRadius: 11,
          background: ACC, color: '#fff', fontWeight: 800, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 1px 4px rgba(0,0,0,.3)', pointerEvents: 'none' }}>{i + 1}</div>
      ))}

      {/* Toppbar */}
      <div data-chd role="toolbar" aria-label="CreatorHub Design — verktøy" style={{ position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'auto',
        display: 'flex', alignItems: 'center', gap: 8, background: PANEL, border: `1px solid ${LINE}`, borderRadius: 12,
        padding: '7px 10px', boxShadow: '0 8px 30px rgba(0,0,0,.18)' }}>
        <span style={{ fontWeight: 800, color: INK, fontSize: 13, marginRight: 4 }}>CreatorHub Design</span>
        <button data-chd style={btn(mode === 'annotate')} aria-pressed={mode === 'annotate'} title="Annotate (A)" onClick={() => setMode('annotate')}>Annotate</button>
        <button data-chd style={btn(mode === 'tweaks')} aria-pressed={mode === 'tweaks'} title="Tweaks (T)" onClick={() => setMode('tweaks')}>Tweaks</button>
        <button data-chd style={btn(mode === 'edit')} aria-pressed={mode === 'edit'} title="Edit (E)" onClick={() => setMode('edit')}>Edit</button>
        <button data-chd style={cta} title="Send til Claude Code (⌘/Ctrl+↵)" onClick={buildBundle}>Send til Claude Code</button>
        <button data-chd style={{ ...btn(false), border: 0 }} onClick={onClose} aria-label="Lukk CreatorHub Design (Esc)" title="Lukk (Esc)">✕</button>
      </div>

      {/* Høyrepanel */}
      <div data-chd role="region" aria-label={mode === 'annotate' ? 'Annoteringer' : mode === 'tweaks' ? 'Tweaks — merkevare' : 'Edit — egenskaper'}
        style={{ position: 'fixed', top: 62, right: 12, bottom: 12, width: 320, pointerEvents: 'auto',
        background: PANEL, border: `1px solid ${LINE}`, borderRadius: 14, boxShadow: '0 8px 30px rgba(0,0,0,.18)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '12px 14px', borderBottom: `1px solid ${LINE}`, color: INK, fontWeight: 800, fontSize: 14 }}>
          {mode === 'annotate' ? `Annoteringer (${notes.length})` : mode === 'tweaks' ? 'Tweaks — merkevare' : 'Edit — egenskaper'}
        </div>

        {mode === 'annotate' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {notes.length === 0 && <p style={{ color: INK2, fontSize: 13, margin: 0 }}>Klikk et element i shell-en for å annotere. Beskriv endringen — den pakkes til Claude Code.</p>}
            {notes.map((n, i) => (
              <div key={n.id} style={{ border: `1px solid ${LINE}`, borderRadius: 10, padding: 10, background: '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span style={{ width: 18, height: 18, borderRadius: 9, background: ACC, color: '#fff', fontWeight: 800, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                  <code style={{ fontSize: 11.5, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selOf(n.d)}</code>
                  <button data-chd onClick={() => removeNote(n.id)} style={{ marginLeft: 'auto', border: 0, background: 'transparent', color: INK2, cursor: 'pointer', fontSize: 14 }}>✕</button>
                </div>
                {n.d.text && <div style={{ fontSize: 11.5, color: INK2, marginBottom: 6 }}>«{n.d.text}»</div>}
                <textarea data-chd value={n.intent} onChange={(e) => setIntent(n.id, e.target.value)}
                  placeholder="Hva skal endres?" rows={2} aria-label="Beskriv endringen for Claude Code"
                  style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${LINE}`, borderRadius: 7, padding: 7, fontSize: 12.5, resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
            ))}
          </div>
        )}

        {mode === 'tweaks' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ fontSize: 13, color: INK, fontWeight: 700 }}>Aksent (live)</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input data-chd type="color" aria-label="Aksent — fargevelger" value={accent} onChange={(e) => applyAccent(e.target.value)} style={{ width: 44, height: 34, border: 'none', background: 'none', cursor: 'pointer' }} />
              <input data-chd type="text" aria-label="Aksent — hex-verdi" value={accent} onChange={(e) => applyAccent(e.target.value)}
                style={{ flex: 1, border: `1px solid ${LINE}`, borderRadius: 7, padding: '7px 9px', fontSize: 13, fontFamily: 'monospace' }} />
            </div>
            <p style={{ fontSize: 12, color: INK2, margin: 0 }}>Endrer <code>--ws-accent*</code> på :root umiddelbart — hele skallet re-farges. «Lagre» skriver til workspace-tokens (samme som N1).</p>
            <button data-chd style={cta} onClick={saveAccent}>Lagre til workspace</button>
            {saveMsg && <div style={{ fontSize: 12.5, color: INK2 }}>{saveMsg}</div>}
          </div>
        )}

        {mode === 'edit' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(editKeys.length > 0 || origMode) && (
              <button data-chd onClick={toggleOriginal}
                style={{ ...(origMode ? cta : btn(false)), padding: '6px 10px', fontSize: 12 }}
                title="Sammenlign siden med og uten dine ulagrede endringer">
                {origMode ? '↩ Vis mine endringer' : '👁 Vis original (før/etter)'}
              </button>
            )}
            {editKeys.length > 0 && (
              <div style={{ border: `1px solid ${LINE}`, borderRadius: 8, padding: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontWeight: 800, fontSize: 12.5, color: INK }}>Lagrede endringer ({editKeys.length})</span>
                  <button data-chd onClick={resetAllEdits} title="Nullstill alle" style={{ marginLeft: 'auto', ...btn(false), padding: '3px 8px', fontSize: 11 }}>Nullstill alle</button>
                </div>
                {editKeys.map((k) => {
                  const parts: string[] = [];
                  if (edits[k]) parts.push(`${Object.keys(edits[k]).length} stil`);
                  if (textEdits[k] != null) parts.push('tekst');
                  if (animEdits[k]) parts.push(String(animEdits[k]));
                  if (insertEdits[k]?.length) parts.push(`+${insertEdits[k].length} innsatt`);
                  if (bindEdits[k]) parts.push(`⇄ ${bindEdits[k]}`);
                  return (
                    <div key={k} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <code style={{ flex: 1, fontSize: 10, color: INK2, wordBreak: 'break-all', lineHeight: 1.3 }}>{k}</code>
                      <span style={{ fontSize: 10.5, color: INK2, flexShrink: 0 }}>{parts.join(' · ')}</span>
                      <button data-chd onClick={() => deleteEdit(k)} aria-label={`Slett endringer for ${k}`}
                        style={{ flexShrink: 0, border: `1px solid ${LINE}`, background: '#fff', borderRadius: 6, cursor: 'pointer', width: 22, height: 22, lineHeight: 1, color: INK2 }}>✕</button>
                    </div>
                  );
                })}
                <button data-chd style={{ ...cta, marginTop: 2 }} onClick={saveEdits}>Lagre endringer</button>
                {saveMsg && <span style={{ fontSize: 11.5, color: INK2 }}>{saveMsg}</span>}
              </div>
            )}
            {!selDesc && <p style={{ color: INK2, fontSize: 13, margin: 0 }}>Klikk et element i shell-en for å redigere egenskapene. Endringene forhåndsvises live og pakkes til Claude Code.</p>}
            {selDesc && (
              <>
                <code style={{ fontSize: 11.5, color: INK, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 6, padding: '5px 7px', wordBreak: 'break-all' }}>{selOf(selDesc)}</code>

                {suggestions.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={section}>Forslag ({suggestions.length})</div>
                    {suggestions.map((s) => (
                      <div key={s.id} style={{ border: `1px solid ${LINE}`, borderLeft: `3px solid ${s.severity === 'high' ? '#dc2626' : s.severity === 'med' ? '#d97706' : '#2563eb'}`, borderRadius: 6, padding: '6px 8px' }}>
                        <div style={{ fontSize: 11.5, color: INK, lineHeight: 1.35 }}>{s.text}</div>
                        {renderSugActions('h:' + s.id, s.fixProp, s.fixValue ? s.fixValue + (s.fixUnit || '') : undefined)}
                      </div>
                    ))}
                  </div>
                )}

                {/* AI-forslag: rikere, kontekstuelle råd fra Claude — hver forhåndsvisbar før bruk. */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ ...section, margin: 0 }}>AI-forslag</span>
                    <button data-chd onClick={fetchAiSuggestions} disabled={aiLoading}
                      style={{ marginLeft: 'auto', ...btn(false), padding: '3px 9px', fontSize: 11 }}>{aiLoading ? 'Tenker…' : 'Hent forslag'}</button>
                  </div>
                  {aiMsg && <div style={{ fontSize: 11, color: INK2 }}>{aiMsg}</div>}
                  {aiSug.map((s, i) => (
                    <div key={i} style={{ border: `1px solid ${LINE}`, borderLeft: '3px solid #7c3aed', borderRadius: 6, padding: '6px 8px' }}>
                      <div style={{ fontSize: 11.5, color: INK, lineHeight: 1.35 }}>{s.text}</div>
                      {s.apply && <div style={{ fontSize: 10, color: INK2, marginTop: 2 }}>{s.apply.prop}: {s.apply.value}</div>}
                      {renderSugActions('ai:' + i, s.apply?.prop, s.apply?.value)}
                    </div>
                  ))}
                </div>

                {sel && sel.children.length === 0 && (
                  <>
                    <div style={section}>Tekst</div>
                    <textarea data-chd aria-label="Element-tekst" value={insp.text ?? ''} onChange={(e) => applyText(e.target.value)}
                      style={{ ...field, minHeight: 52, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.4 }} />

                    <div style={section}>Bind til datakilde</div>
                    <select data-chd aria-label="Bind tekst til datakilde" style={field}
                      value={sel ? (bindEdits[uniqueSelector(sel)] || '') : ''} onChange={(e) => applyBinding(e.target.value)}>
                      <option value="">— Ingen (fritekst) —</option>
                      {sources.map((s) => <option key={s.key} value={s.key}>{s.key}{s.label ? ` · ${String(s.label)}` : ''}</option>)}
                    </select>
                    {sel && bindEdits[uniqueSelector(sel)] && (() => {
                      const bound = sources.find((s) => s.key === bindEdits[uniqueSelector(sel)]);
                      return bound
                        ? <div style={{ fontSize: 11, color: '#15803d' }}>✓ Bundet — data kommer gjennom: <b>{String(bound.value ?? '—')}</b></div>
                        : <div style={{ fontSize: 11, color: '#b45309' }}>⚠ Kilden er ikke definert lenger.</div>;
                    })()}
                    {sources.length === 0 && <div style={{ fontSize: 10.5, color: INK2 }}>Ingen datakilder ennå — definer metrics i Design-tokens.</div>}
                  </>
                )}

                <div style={section}>Typografi</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1 }}><label style={flabel}>Størrelse (px)</label>
                    <input data-chd aria-label="Font-størrelse i piksler" type="number" style={field} value={insp.fontSize ?? ''} onChange={(e) => applyStyle('fontSize', 'font-size', e.target.value, 'px')} /></div>
                  <div style={{ flex: 1 }}><label style={flabel}>Vekt</label>
                    <input data-chd aria-label="Font-vekt" style={field} value={insp.fontWeight ?? ''} onChange={(e) => applyStyle('fontWeight', 'font-weight', e.target.value)} /></div>
                </div>
                <label style={flabel}>Tekstfarge</label>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ width: 24, height: 24, borderRadius: 5, border: `1px solid ${LINE}`, background: insp.color, flexShrink: 0 }} />
                  <input data-chd aria-label="Tekstfarge" style={field} value={insp.color ?? ''} onChange={(e) => applyStyle('color', 'color', e.target.value)} />
                </div>

                <div style={section}>Utseende</div>
                <label style={flabel}>Bakgrunn</label>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ width: 24, height: 24, borderRadius: 5, border: `1px solid ${LINE}`, background: insp.background, flexShrink: 0 }} />
                  <input data-chd aria-label="Bakgrunnsfarge" style={field} value={insp.background ?? ''} onChange={(e) => applyStyle('background', 'background-color', e.target.value)} />
                </div>
                <label style={flabel}>Radius (px)</label>
                <input data-chd aria-label="Radius i piksler" type="number" style={field} value={insp.borderRadius ?? ''} onChange={(e) => applyStyle('borderRadius', 'border-radius', e.target.value, 'px')} />

                <div style={section}>Spacing</div>
                <label style={flabel}>Padding</label>
                <input data-chd aria-label="Padding" style={field} value={insp.padding ?? ''} onChange={(e) => applyStyle('padding', 'padding', e.target.value)} />

                <div style={section}>Animasjon</div>
                <select data-chd aria-label="Animasjon" style={field}
                  value={sel ? (animEdits[uniqueSelector(sel)] || '') : ''}
                  onChange={(e) => applyAnim(e.target.value)}>
                  <option value="">Ingen</option>
                  {Object.entries(ANIM_PRESETS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
                </select>

                <div style={section}>Sett inn nytt element (ved dette ankeret)</div>
                <select data-chd aria-label="Element-type" style={field} value={insType} onChange={(e) => setInsType(e.target.value)}>
                  <option value="heading">Overskrift</option>
                  <option value="text">Tekst</option>
                  <option value="button">Knapp</option>
                  <option value="image">Bilde</option>
                  <option value="infographic">Infographic</option>
                  <option value="divider">Skille</option>
                  <option value="component">Komponent (fra bibliotek)</option>
                </select>
                {insType === 'component' && (
                  <select data-chd aria-label="Velg komponent" style={field} value={pickComp} onChange={(e) => setPickComp(e.target.value)}>
                    <option value="">— Velg komponent —</option>
                    {Object.keys(components).map((n) => <option key={n} value={n}>{n} ({components[n].length} elementer)</option>)}
                  </select>
                )}
                {insType !== 'divider' && insType !== 'component' && (
                  <input data-chd style={field}
                    placeholder={insType === 'infographic' ? 'Verdi (f.eks. 75%)' : insType === 'image' ? 'Alt-tekst' : 'Tekst'}
                    value={insText} onChange={(e) => setInsText(e.target.value)} />
                )}
                {(insType === 'button' || insType === 'image') && (
                  <input data-chd style={field} placeholder={insType === 'button' ? 'Lenke (/… eller https://…)' : 'Bilde-URL (/… eller https://…)'}
                    value={insUrl} onChange={(e) => setInsUrl(e.target.value)} />
                )}
                {insType === 'infographic' && (
                  <input data-chd style={field} placeholder="Etikett" value={insUrl} onChange={(e) => setInsUrl(e.target.value)} />
                )}
                {insType === 'infographic' && (
                  <>
                    <label style={flabel}>Koble til datakilde</label>
                    <select data-chd aria-label="Koble til datakilde" style={field} value={insSource} onChange={(e) => setInsSource(e.target.value)}>
                      <option value="">— Statisk verdi (ingen kobling) —</option>
                      {sources.map((s) => <option key={s.key} value={s.key}>{s.key}{s.label ? ` · ${String(s.label)}` : ''}</option>)}
                    </select>
                    {insSource && (() => {
                      const bound = sources.find((s) => s.key === insSource);
                      return bound
                        ? <div style={{ fontSize: 11, color: '#15803d' }}>✓ Data kommer gjennom: <b>{String(bound.value ?? '—')}</b>{bound.label ? ` — ${String(bound.label)}` : ''}</div>
                        : <div style={{ fontSize: 11, color: '#b45309' }}>⚠ «{insSource}» er ikke definert. Legg den til i Design-tokens → metrics.</div>;
                    })()}
                    {sources.length === 0 && <div style={{ fontSize: 10.5, color: INK2 }}>Ingen kilder ennå — definer marketing-metrics i CreatorHub Design → Design-tokens, så dukker de opp her.</div>}
                  </>
                )}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <select data-chd aria-label="Posisjon" style={{ ...field, flex: 1 }} value={insPos} onChange={(e) => setInsPos(e.target.value as 'before' | 'after')}>
                    <option value="after">Etter ankeret</option>
                    <option value="before">Før ankeret</option>
                  </select>
                  <button data-chd style={cta} onClick={addInsert}>Legg til</button>
                </div>
                {sel && (insertEdits[uniqueSelector(sel)]?.length ?? 0) > 0 && insType !== 'component' && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input data-chd style={{ ...field, flex: 1 }} placeholder="Komponent-navn" value={compName} onChange={(e) => setCompName(e.target.value)} />
                    <button data-chd style={btn(false)} onClick={saveComponent} title="Lagre dette ankerets innsettinger som gjenbrukbar komponent">Lagre som komponent</button>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                  <button data-chd style={cta} onClick={saveEdits}>Lagre endringer ({new Set([...Object.keys(edits), ...Object.keys(textEdits), ...Object.keys(animEdits)]).size})</button>
                  {saveMsg && <span style={{ fontSize: 12, color: INK2 }}>{saveMsg}</span>}
                </div>
                <p style={{ fontSize: 11.5, color: INK2, margin: '8px 0 0' }}>
                  «Lagre endringer» persisterer per-element-stilene til workspacet — de gjelder alle
                  brukere ved neste last. Best-effort: en endring kan drive hvis sidelayouten endres
                  mye senere. «Send til Claude Code» pakker dem i stedet til en bundle for permanent kode.
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Handoff-bundle */}
      {bundle && (
        <div data-chd style={{ position: 'fixed', inset: 0, pointerEvents: 'auto', background: 'rgba(10,12,20,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Handoff-bundle til Claude Code" tabIndex={-1}
            style={{ width: 620, maxWidth: '92vw', maxHeight: '84vh', background: PANEL, border: `1px solid ${LINE}`, borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '13px 16px', borderBottom: `1px solid ${LINE}`, fontWeight: 800, color: INK, display: 'flex', alignItems: 'center' }}>
              Handoff-bundle → Claude Code
              <span style={{ marginLeft: 'auto', fontSize: 12, color: INK2, fontWeight: 500 }}>{targetFile}</span>
            </div>
            <pre style={{ margin: 0, flex: 1, overflow: 'auto', padding: 14, fontSize: 12, color: INK, background: '#fff' }}>{bundle}</pre>
            <div style={{ padding: 12, borderTop: `1px solid ${LINE}`, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button data-chd style={btn(false)} onClick={() => setBundle(null)}>Lukk</button>
              <button data-chd style={cta} onClick={() => navigator.clipboard?.writeText(bundle).catch(() => {})}>Kopier bundle</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
