/**
 * WorkspaceDesignOverlay — CreatorHub Design (Nivå 3): live-overlay på den EKTE Team
 * Workspace-ruten. Tre moduser:
 *  - Annotate: hover-highlight + klikk ekte shell-elementer → pins med fri-tekst intent.
 *  - Tweaks:   juster aksent live (--ws-accent* på :root) + lagre til workspace (PUT).
 *  - Handoff:  pakk pins + token-kontekst til en Claude Code-bundle (fil-peker + computed
 *              styles) for STRUKTURELLE endringer (det token/nav/copy-data ikke dekker).
 * Aktiveres med ?design=1. Bruker INGEN window.alert/confirm/prompt (blokkerer extension).
 * Selvstendig: inline styles, ingen MUI (unngår å arve dark-temaet).
 */
import React from 'react';

type ElDesc = {
  tag: string; id?: string; cls?: string; text?: string;
  style: Record<string, string>; rect: { x: number; y: number; w: number; h: number };
};
type Note = { id: number; d: ElDesc; intent: string };

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
  const [mode, setMode] = React.useState<'annotate' | 'tweaks'>('annotate');
  const [notes, setNotes] = React.useState<Note[]>([]);
  const [hover, setHover] = React.useState<ElDesc | null>(null);
  const [accent, setAccent] = React.useState('#ff8c00');
  const [bundle, setBundle] = React.useState<string | null>(null);
  const [saveMsg, setSaveMsg] = React.useState('');
  const nextId = React.useRef(1);
  const route = typeof window !== 'undefined' ? window.location.pathname : '/workspace';

  const inOverlay = (t: EventTarget | null) => t instanceof Element && !!t.closest('[data-chd]');

  React.useEffect(() => {
    if (mode !== 'annotate') { setHover(null); return; }
    const onMove = (e: MouseEvent) => {
      const t = e.target as Element;
      if (inOverlay(t)) { setHover(null); return; }
      setHover(describe(t));
    };
    const onClick = (e: MouseEvent) => {
      const t = e.target as Element;
      if (inOverlay(t)) return;            // klikk i panelet → la knappene virke
      e.preventDefault(); e.stopPropagation(); // ellers: fang klikket som annotering
      setNotes((n) => [...n, { id: nextId.current++, d: describe(t), intent: '' }]);
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

  const buildBundle = () => setBundle(JSON.stringify({
    tool: 'creatorhub-design-handoff', targetFile, route, workspace,
    tokenContext: hexVars(accent),
    instruction: 'Bygg inn disse (strukturelle) endringene i WorkspaceShell. Merkevare/nav/copy administreres allerede som data — ikke hardkod dem.',
    notes: notes.map((n) => ({ element: selOf(n.d), text: n.d.text, computed: n.d.style, intent: n.intent || '(ingen intent skrevet)' })),
  }, null, 2));

  const setIntent = (id: number, v: string) => setNotes((n) => n.map((x) => (x.id === id ? { ...x, intent: v } : x)));
  const removeNote = (id: number) => setNotes((n) => n.filter((x) => x.id !== id));

  const btn = (active: boolean): React.CSSProperties => ({
    padding: '6px 12px', borderRadius: 8, border: `1px solid ${active ? ACC : LINE}`,
    background: active ? 'rgba(238,122,8,0.10)' : '#fff', color: active ? '#8a4708' : INK2,
    fontWeight: 700, fontSize: 13, cursor: 'pointer',
  });
  const cta: React.CSSProperties = { padding: '7px 13px', borderRadius: 8, border: 0, background: ACC, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' };

  return (
    <div data-chd style={{ position: 'fixed', inset: 0, zIndex: 2147483000, pointerEvents: 'none', fontFamily: 'system-ui, sans-serif' }}>
      {/* Hover-highlight (annotate) */}
      {mode === 'annotate' && hover && (
        <div style={{ position: 'fixed', left: hover.rect.x, top: hover.rect.y, width: hover.rect.w, height: hover.rect.h,
          border: `2px solid ${ACC}`, borderRadius: 6, background: 'rgba(238,122,8,0.06)', pointerEvents: 'none' }} />
      )}
      {/* Pins */}
      {notes.map((n, i) => (
        <div key={n.id} style={{ position: 'fixed', left: n.d.rect.x - 6, top: n.d.rect.y - 6, width: 22, height: 22, borderRadius: 11,
          background: ACC, color: '#fff', fontWeight: 800, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 1px 4px rgba(0,0,0,.3)', pointerEvents: 'none' }}>{i + 1}</div>
      ))}

      {/* Toppbar */}
      <div data-chd style={{ position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'auto',
        display: 'flex', alignItems: 'center', gap: 8, background: PANEL, border: `1px solid ${LINE}`, borderRadius: 12,
        padding: '7px 10px', boxShadow: '0 8px 30px rgba(0,0,0,.18)' }}>
        <span style={{ fontWeight: 800, color: INK, fontSize: 13, marginRight: 4 }}>CreatorHub Design</span>
        <button data-chd style={btn(mode === 'annotate')} onClick={() => setMode('annotate')}>Annotate</button>
        <button data-chd style={btn(mode === 'tweaks')} onClick={() => setMode('tweaks')}>Tweaks</button>
        <button data-chd style={cta} onClick={buildBundle}>Send til Claude Code</button>
        <button data-chd style={{ ...btn(false), border: 0 }} onClick={onClose} title="Lukk">✕</button>
      </div>

      {/* Høyrepanel */}
      <div data-chd style={{ position: 'fixed', top: 62, right: 12, bottom: 12, width: 320, pointerEvents: 'auto',
        background: PANEL, border: `1px solid ${LINE}`, borderRadius: 14, boxShadow: '0 8px 30px rgba(0,0,0,.18)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '12px 14px', borderBottom: `1px solid ${LINE}`, color: INK, fontWeight: 800, fontSize: 14 }}>
          {mode === 'annotate' ? `Annoteringer (${notes.length})` : 'Tweaks — merkevare'}
        </div>

        {mode === 'annotate' ? (
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
                  placeholder="Hva skal endres?" rows={2}
                  style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${LINE}`, borderRadius: 7, padding: 7, fontSize: 12.5, resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ fontSize: 13, color: INK, fontWeight: 700 }}>Aksent (live)</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input data-chd type="color" value={accent} onChange={(e) => applyAccent(e.target.value)} style={{ width: 44, height: 34, border: 'none', background: 'none', cursor: 'pointer' }} />
              <input data-chd type="text" value={accent} onChange={(e) => applyAccent(e.target.value)}
                style={{ flex: 1, border: `1px solid ${LINE}`, borderRadius: 7, padding: '7px 9px', fontSize: 13, fontFamily: 'monospace' }} />
            </div>
            <p style={{ fontSize: 12, color: INK2, margin: 0 }}>Endrer <code>--ws-accent*</code> på :root umiddelbart — hele skallet re-farges. «Lagre» skriver til workspace-tokens (samme som N1).</p>
            <button data-chd style={cta} onClick={saveAccent}>Lagre til workspace</button>
            {saveMsg && <div style={{ fontSize: 12.5, color: INK2 }}>{saveMsg}</div>}
          </div>
        )}
      </div>

      {/* Handoff-bundle */}
      {bundle && (
        <div data-chd style={{ position: 'fixed', inset: 0, pointerEvents: 'auto', background: 'rgba(10,12,20,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 620, maxWidth: '92vw', maxHeight: '84vh', background: PANEL, border: `1px solid ${LINE}`, borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
