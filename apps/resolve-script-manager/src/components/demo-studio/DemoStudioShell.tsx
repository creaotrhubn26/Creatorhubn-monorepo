/**
 * DemoStudioShell — piksel-matchet React-port av den verifiserte shell.html
 * (cream/lyst editor-design, 5-sone-layout). Fasit: Daniels design-mockup +
 * docs/demo-studio/SPEC.md.
 *
 * Soner: venstre nav (6 moduler) · blokk-panel (demo-typer) · senter device-
 * preview · høyre scene-settings (Guide/Script/Notes) · topbar · bunn-statskort.
 *
 * Verifiseres mot mockupen med Playwright (scripts/_pixshot). Denne komponenten
 * er presentasjons-shellen; den kobles til demoStudioStore for ekte data.
 * Inline-stiler holder den selvstendig og diff-bar (ingen CSS-bundling-avhengighet).
 */

import { useState } from 'react';
import { useDemoStudio } from './demoStudioStore';
import { DEMO_TYPE_LABELS, totalDuration, type DemoType } from './demoStudioModel';

const C = {
  bg: '#f3efe9', panel: '#ffffff', cream: '#faf7f2', creamActive: '#f3ece2',
  line: '#ece7df', lineStrong: '#ddd6cc', ink: '#1d1b19', inkSoft: '#6b6358',
  inkFaint: '#9a9186', accent: '#ef8a5d', dark: '#3a2f2a', green: '#4a9d6b',
  font: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Inter, sans-serif',
};

const NAV_ITEMS = [
  { id: 'create', label: 'Create Demo', ic: '▢' },
  { id: 'flow', label: 'Flow Builder', ic: '⤳' },
  { id: 'script', label: 'Script Builder', ic: '✎' },
  { id: 'recorder', label: 'Guided Recorder', ic: '●' },
  { id: 'preview', label: 'Device Preview', ic: '▭' },
  { id: 'export', label: 'Export', ic: '⤓' },
] as const;
type NavId = (typeof NAV_ITEMS)[number]['id'];

const DEMO_TYPE_ICON: Record<DemoType, string> = {
  product_demo: '▶', tutorial: '◉', onboarding: '✿', sales_video: '$',
  investor_demo: '▲', social_clip: '◆', support_guide: '?', feature_walkthrough: '⊞',
};

function fmt(sec: number) {
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function DemoStudioShell({ onClose }: { onClose?: () => void } = {}) {
  const { project, selectedSceneId } = useDemoStudio();
  const [nav, setNav] = useState<NavId>('flow');
  const [tab, setTab] = useState<'Guide' | 'Script' | 'Notes'>('Guide');

  const scenes = project?.scenes ?? [];
  const selected = scenes.find((s) => s.id === selectedSceneId) ?? scenes[0];
  const doneCount = scenes.filter((s) => s.status === 'done' || s.status === 'approved').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, fontFamily: C.font, background: C.bg, color: C.ink, fontSize: 13 }}>
      {/* ── Topbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, height: 60, padding: '0 18px', background: C.panel, borderBottom: `1px solid ${C.line}`, flexShrink: 0 }}>
        <div style={iconBtn} onClick={onClose} title="Tilbake til hjem">☰</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
            {project?.name ?? 'Untitled Demo'} <span style={{ color: C.inkFaint }}>⌄</span>
          </div>
          <div style={{ fontSize: 11, color: C.inkFaint, display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.green }} /> Draft · Autosaved just now
          </div>
        </div>
        <div style={{ flex: 1, maxWidth: 360, display: 'flex', alignItems: 'center', gap: 8, background: C.cream, border: `1px solid ${C.line}`, borderRadius: 9, padding: '7px 12px', color: C.inkFaint }}>
          <span>⌕</span> Search… <span style={{ marginLeft: 'auto', fontSize: 11, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 5, padding: '1px 5px' }}>⌘K</span>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {[0, 1].map((i) => <div key={i} style={{ width: 26, height: 26, borderRadius: '50%', border: '2px solid #fff', background: '#cdbfae', marginLeft: i ? -7 : 0 }} />)}
          <span style={{ fontSize: 11, color: C.inkSoft, marginLeft: 6 }}>+2</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.inkSoft }}><span style={{ color: C.green }}>✓</span> All changes saved</div>
        <button style={btn}>▷ Preview <span style={{ color: C.inkFaint }}>⌄</span></button>
        <button style={btn}>Save</button>
        <button style={{ ...btn, background: C.dark, color: '#fff', borderColor: C.dark }}>Export <span>⌄</span></button>
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* ── Left nav ── */}
        <div style={{ width: 208, background: C.panel, borderRight: `1px solid ${C.line}`, display: 'flex', flexDirection: 'column', padding: '12px 10px', flexShrink: 0 }}>
          {NAV_ITEMS.map((it) => (
            <div key={it.id} onClick={() => setNav(it.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px', borderRadius: 9, fontSize: 13, cursor: 'pointer', marginBottom: 2,
                background: nav === it.id ? C.creamActive : 'transparent', color: nav === it.id ? C.ink : C.inkSoft, fontWeight: nav === it.id ? 600 : 500 }}>
              <span style={{ width: 18, opacity: 0.85 }}>{it.ic}</span> {it.label}
            </div>
          ))}
          <div style={{ flex: 1 }} />
          <div style={{ background: C.cream, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <h4 style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>✦ AI Director</h4>
            <p style={{ fontSize: 11.5, color: C.inkSoft, lineHeight: 1.45, marginBottom: 10 }}>La AI foreslå scener, manus og handlinger for demoen din.</p>
            <button style={{ ...btn, width: '100%', justifyContent: 'center', background: '#fff' }}>Open AI Director</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, paddingTop: 10, borderTop: `1px solid ${C.line}` }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#cdbfae' }} />
            <div><div style={{ fontSize: 12.5, fontWeight: 600 }}>Olivia Moore</div><div style={{ fontSize: 11, color: C.inkFaint }}>Creator Workspace ⌄</div></div>
          </div>
        </div>

        {/* ── Blocks panel (demo-typer) ── */}
        <div style={{ width: 230, background: C.panel, borderRight: `1px solid ${C.line}`, padding: 16, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Demo-typer <span style={{ color: C.inkFaint }}>‹</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {(Object.keys(DEMO_TYPE_LABELS) as DemoType[]).map((t) => (
              <div key={t} style={{ aspectRatio: '1.15', border: `1px solid ${C.line}`, borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', color: C.inkSoft }}>
                <div style={{ fontSize: 20 }}>{DEMO_TYPE_ICON[t]}</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: C.ink }}>{DEMO_TYPE_LABELS[t].split(' ')[0]}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, marginTop: 18 }}>Lagrede maler <span style={{ color: C.inkFaint }}>›</span></div>
        </div>

        {/* ── Center: device preview ── */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: C.bg, overflowY: 'auto', padding: '16px 22px' }}>
          <div style={{ display: 'flex', gap: 4, alignSelf: 'center', background: '#fff', border: `1px solid ${C.line}`, borderRadius: 9, padding: 3, marginBottom: 14 }}>
            <div style={{ width: 36, height: 28, display: 'grid', placeItems: 'center', borderRadius: 6, background: C.creamActive, color: C.ink }}>▭</div>
            <div style={{ width: 36, height: 28, display: 'grid', placeItems: 'center', borderRadius: 6, color: C.inkFaint }}>▯</div>
          </div>
          <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ height: 280, background: 'linear-gradient(105deg,#cfc4b4,#e7ded2)', display: 'flex', alignItems: 'center', padding: '0 44px' }}>
              <div>
                <div style={{ fontSize: 11, letterSpacing: 2, color: '#fff', opacity: 0.85 }}>PRODUKTDEMO</div>
                <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 30, lineHeight: 1.15, margin: '8px 0 12px', maxWidth: 360, color: '#2a2622' }}>Vis frem produktet ditt på sekunder.</h1>
                <p style={{ fontSize: 13, maxWidth: 320, marginBottom: 16, color: '#3a352f', lineHeight: 1.5 }}>Lim inn en URL, bygg scener, og ta opp en styrt demo i Mac, iPad og iPhone.</p>
                <button style={{ background: C.accent, color: '#fff', border: 0, borderRadius: 7, padding: '9px 16px', fontSize: 12.5, fontWeight: 600 }}>Start opptak</button>
              </div>
            </div>
            <div style={{ padding: '22px 28px' }}>
              <h3 style={{ fontSize: 16, marginBottom: 6 }}>Demo-flow</h3>
              <div style={{ fontSize: 12.5, color: C.inkSoft, marginBottom: 18, maxWidth: 480 }}>Scenene under settes sammen til én produktvideo. Du styrer opptaket steg for steg.</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                {(scenes.length ? scenes.slice(0, 3) : [{ title: 'Intro' }, { title: 'Main Feature' }, { title: 'CTA' }]).map((s, i) => (
                  <div key={i}>
                    <div style={{ height: 64, borderRadius: 8, background: '#e7ded2', marginBottom: 8 }} />
                    <h5 style={{ fontSize: 12.5, marginBottom: 4 }}>{s.title}</h5>
                    <a style={{ fontSize: 11, color: C.accent, fontWeight: 600 }}>Rediger →</a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: scene settings ── */}
        <div style={{ width: 320, background: C.panel, borderLeft: `1px solid ${C.line}`, padding: 16, flexShrink: 0, overflowY: 'auto' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Scene-innstillinger</h3>
          <div style={{ display: 'flex', gap: 18, borderBottom: `1px solid ${C.line}`, marginBottom: 16 }}>
            {(['Guide', 'Script', 'Notes'] as const).map((t) => (
              <div key={t} onClick={() => setTab(t)} style={{ fontSize: 13, paddingBottom: 9, cursor: 'pointer', color: tab === t ? C.ink : C.inkFaint, fontWeight: tab === t ? 600 : 400, borderBottom: tab === t ? `2px solid ${C.ink}` : '2px solid transparent' }}>{t}</div>
            ))}
          </div>
          <div style={fldLabel}>Scene-type</div>
          <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ width: 38, height: 30, borderRadius: 6, background: C.creamActive }} />
            <div><div style={{ fontSize: 12.5, fontWeight: 600 }}>{selected?.title ?? 'Homepage'}</div><div style={{ fontSize: 11, color: C.inkFaint }}>Scene {(selected?.index ?? 1) + 1} · {selected?.requiredAction || 'oversikt over produktet'}</div></div>
          </div>
          <div style={fldLabel}>Manus</div>
          <div style={{ ...sel, height: 58, alignItems: 'flex-start', color: C.inkSoft, fontSize: 11.5, lineHeight: 1.4 }}>{selected?.narration || 'Nå er vi på forsiden. Her får brukeren en rask oversikt…'}</div>
          <div style={row2}>
            <div><div style={fldLabel}>Enhet</div><div style={sel}>{selected?.device ?? 'MacBook'} <span>⌄</span></div></div>
            <div><div style={fldLabel}>Viewport</div><div style={sel}>{selected?.viewport ?? 'Desktop'} <span>⌄</span></div></div>
          </div>
          <div style={fldLabel}>Required action</div>
          <div style={sel}>{selected?.requiredAction || 'Click the Start button'}</div>
          <div style={row2}>
            <div><div style={fldLabel}>Varighet</div><div style={sel}>{selected?.duration ?? 12} s</div></div>
            <div><div style={fldLabel}>Status</div><div style={sel}><span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#3b82f6' }} />In Progress</span> <span>⌄</span></div></div>
          </div>
          <div style={fldLabel}>Overlay & effekter</div>
          <div style={row2}>
            {[['Tekst', '#1A1A1A'], ['Bakgrunn', '#FAF7F4'], ['Highlight', C.accent], ['Cursor', '#FFFFFF']].map(([l, c]) => (
              <div key={l} style={swatch}><span style={{ width: 14, height: 14, borderRadius: 4, border: `1px solid ${C.line}`, background: c }} /> {l}</div>
            ))}
          </div>
          <div style={fldLabel}>Progresjon</div>
          <div style={{ ...sel, background: C.cream }}>continueMode: manual — venter på deg</div>
          <div style={fldLabel}>Synlighet</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: C.inkSoft, marginBottom: 10 }}>Inkluder i video <span style={toggle} /></div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: C.inkSoft }}>Vis device-mockup <span style={toggle} /></div>
        </div>
      </div>

      {/* ── Bottom: stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 1, background: C.line, borderTop: `1px solid ${C.line}`, flexShrink: 0 }}>
        <Stat h="⚇ Devices" v="Mac · iPad · iPhone" link="Endre →" />
        <Stat h="▦ Scener" v={`${scenes.length || 6} scener`} s={`${doneCount} ferdig`} />
        <Stat h="⏱ Varighet" v={`${fmt(totalDuration(scenes))} total`} s="Anbefalt 60–90 s" />
        <Stat h="◷ Opptak" v="Steg 2 av 6" s="Venter på deg" />
        <Stat h="⤓ Format" v="16:9 · 1080p" link="Eksport →" />
        <div style={{ background: C.panel, padding: '13px 15px' }}>
          <div style={{ width: 42, height: 42, borderRadius: '50%', border: `3px solid ${C.green}`, display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700, float: 'right' }}>78</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.inkSoft, marginBottom: 7 }}>✓ Demo-score</div>
          <div style={{ fontSize: 11, color: C.inkFaint, marginTop: 3 }}>Legg til manus</div>
        </div>
      </div>
    </div>
  );
}

function Stat({ h, v, s, link }: { h: string; v: string; s?: string; link?: string }) {
  return (
    <div style={{ background: C.panel, padding: '13px 15px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.inkSoft, marginBottom: 7 }}>{h}</div>
      <div style={{ fontSize: 13.5, fontWeight: 700 }}>{v}</div>
      {s && <div style={{ fontSize: 11, color: C.inkFaint, marginTop: 3 }}>{s}</div>}
      {link && <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 8 }}>{link}</div>}
    </div>
  );
}

const iconBtn: React.CSSProperties = { width: 30, height: 30, display: 'grid', placeItems: 'center', borderRadius: 8, color: C.inkSoft, cursor: 'pointer' };
const btn: React.CSSProperties = { border: `1px solid ${C.lineStrong}`, background: '#fff', borderRadius: 9, padding: '8px 13px', fontSize: 12.5, fontWeight: 600, color: C.ink, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 };
const fldLabel: React.CSSProperties = { fontSize: 11, color: C.inkSoft, margin: '14px 0 6px', fontWeight: 600 };
const sel: React.CSSProperties = { border: `1px solid ${C.lineStrong}`, borderRadius: 8, padding: '8px 10px', fontSize: 12.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' };
const row2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 };
const swatch: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${C.lineStrong}`, borderRadius: 7, padding: '6px 8px', fontSize: 11 };
const toggle: React.CSSProperties = { width: 34, height: 19, borderRadius: 10, background: C.accent, position: 'relative', display: 'inline-block' };

export default DemoStudioShell;
