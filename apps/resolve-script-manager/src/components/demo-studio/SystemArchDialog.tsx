/**
 * SystemArchDialog.tsx — «System-arkitektur»: Mermaid → merkevaret arkitektur-
 * infographic med ekte system-logoer (simple-icons). Lim inn eller importer en
 * .mmd, parse + bygg on-brand HTML, forhåndsvis + last ned.
 */
import { useMemo, useRef, useState } from 'react';

import { parseMermaidArch } from './mermaidArch.js';
import { buildArchInfographicHtml } from './archInfographic.js';

const C = { bg: '#0b1120', panel: '#0f1524', panel2: '#141b2b', line: '#202a40', ink: '#e8eefc', soft: '#8a98b5' };

export default function SystemArchDialog(
  { accent = '#14b8a6', brandName = 'System', onClose }:
  { accent?: string; brandName?: string; onClose?: () => void },
) {
  const [text, setText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const diagram = useMemo(() => (text.trim() ? parseMermaidArch(text, `${brandName} — Systemarkitektur`) : null), [text, brandName]);
  const html = useMemo(() => (diagram && diagram.groups.length ? buildArchInfographicHtml(diagram, { accent, brandName, logoMark: brandName.slice(0, 2).toUpperCase() }) : ''), [diagram, accent, brandName]);

  const importMmd = (f: File) => { const r = new FileReader(); r.onload = () => setText(typeof r.result === 'string' ? r.result : ''); r.readAsText(f); };
  const download = () => {
    if (!html) return;
    const blob = new Blob([html], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `${brandName.toLowerCase().replace(/\s+/g, '-')}-arkitektur.html`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const btn: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, padding: '8px 14px', borderRadius: 9, border: `1px solid ${C.line}`, color: '#c4d0e4', background: C.panel2, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
  const nodeCount = diagram ? diagram.groups.reduce((a, g) => a + g.nodes.length, 0) : 0;
  const withLogo = diagram ? diagram.groups.flatMap((g) => g.nodes).filter((n) => n.logo).length : 0;

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: C.bg, color: C.ink, display: 'flex', flexDirection: 'column', padding: 20, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>🏛 System-arkitektur</h1>
        {diagram && diagram.groups.length > 0 && <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 7, background: `${accent}22`, color: accent }}>{diagram.groups.length} lag · {nodeCount} komponenter · {withLogo} logoer</span>}
        {onClose && <span onClick={onClose} style={{ marginLeft: 'auto', cursor: 'pointer', color: C.soft, fontSize: 20 }}>×</span>}
      </div>
      <div style={{ color: C.soft, fontSize: 12.5, marginBottom: 14 }}>Lim inn Mermaid (graph/flowchart) → merkevaret arkitektur-infographic med ekte system-logoer.</div>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 16, flex: 1, minHeight: 0 }}>
        {/* venstre: input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <span onClick={() => fileRef.current?.click()} style={btn}>📄 Importer .mmd</span>
            <input ref={fileRef} type="file" accept=".mmd,.txt,.mermaid" style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) importMmd(f); }} />
            <span onClick={() => setText('')} style={{ ...btn, opacity: text ? 1 : 0.5 }}>Tøm</span>
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={'graph TB\n    subgraph Klient["🖥️ Klientlag"]\n        Web["Web App<br/>(React + Vite)"]\n    end'}
            style={{ flex: 1, minHeight: 0, resize: 'none', fontFamily: 'ui-monospace, monospace', fontSize: 12, lineHeight: 1.5, padding: 12, borderRadius: 10, border: `1px solid ${C.line}`, background: C.bg, color: C.ink, colorScheme: 'dark' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <span onClick={download} style={{ ...btn, background: accent, borderColor: accent, color: '#04121a', opacity: html ? 1 : 0.5 }}>⬇ Last ned HTML</span>
            <span style={{ fontSize: 10.5, color: C.soft, alignSelf: 'center' }}>Åpne HTML-en → print til PDF, eller kopier til dokumenter.</span>
          </div>
        </div>

        {/* høyre: live preview */}
        <div style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.line}`, background: '#0a0f1a', display: 'grid', placeItems: html ? 'stretch' : 'center' }}>
          {html
            ? <iframe title="arch-preview" srcDoc={html} style={{ width: '100%', height: '100%', border: 0, background: 'transparent' }} />
            : <div style={{ color: C.soft, fontSize: 13, textAlign: 'center', padding: 30 }}>{text.trim() ? 'Fant ingen subgraph-grupper — sjekk at Mermaid-en har `subgraph …` blokker.' : 'Lim inn eller importer en Mermaid-oversikt for å se forhåndsvisningen.'}</div>}
        </div>
      </div>
    </div>
  );
}
