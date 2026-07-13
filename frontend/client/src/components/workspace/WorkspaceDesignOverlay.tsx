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
import { uniqueSelector, type ElementEdits } from './elementEdits';

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

export default function WorkspaceDesignOverlay({
  onClose,
  targetFile = 'frontend/client/src/components/workspace/WorkspaceShell.tsx',
  workspace = 'creatorhub',
}: { onClose?: () => void; targetFile?: string; workspace?: string }) {
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

  // Last eksisterende lagrede per-element-edits ved mount → nye edits akkumuleres oppå (så
  // «Lagre» sender hele kartet; JSONB-merge er grunn og erstatter hele elementEdits-nøkkelen).
  React.useEffect(() => {
    let live = true;
    fetch(`/api/design/tokens?ws=${encodeURIComponent(workspace)}&raw=1`, { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (live && d && d.raw === true && d.tokens && d.tokens.elementEdits) setEdits(d.tokens.elementEdits as ElementEdits);
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
        body: JSON.stringify({ elementEdits: edits }),
      });
      setSaveMsg(r.ok ? `Lagret ${Object.keys(edits).length} element ✓` : 'Avvist (krever admin)');
    } catch { setSaveMsg('Nettverksfeil'); }
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
            {!selDesc && <p style={{ color: INK2, fontSize: 13, margin: 0 }}>Klikk et element i shell-en for å redigere egenskapene. Endringene forhåndsvises live og pakkes til Claude Code.</p>}
            {selDesc && (
              <>
                <code style={{ fontSize: 11.5, color: INK, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 6, padding: '5px 7px', wordBreak: 'break-all' }}>{selOf(selDesc)}</code>

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

                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                  <button data-chd style={cta} onClick={saveEdits}>Lagre endringer ({Object.keys(edits).length})</button>
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
