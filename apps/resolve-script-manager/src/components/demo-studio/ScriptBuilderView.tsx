/**
 * ScriptBuilderView — piksel-matchet Script Builder (fasit: Daniels mockup +
 * Script Builder-spec). Mørk sidebar-design.
 *
 * 6 områder: venstre nav · topbar (Generate/AI Improve/Save) · scene header ·
 * strukturert script-editor (5 blokker: Narration/Visual/Action/Overlay/Notes)
 * · høyre Live Preview + AI Assistant · bunn scene-timeline.
 *
 * Alt scene-basert og koblet til demoStudioStore — endringer oppdaterer scene-
 * objektet og er umiddelbart tilgjengelig for Guided Recorder. Manus + handling
 * + device + opptak henger sammen (spec §11.3).
 */

import { useMemo } from 'react';
import { useDemoStudio } from './demoStudioStore';
import {
  SCENE_STATUS_LABELS, SCENE_STATUS_COLORS, SCRIPT_TONE_LABELS, SCRIPT_LENGTH_LABELS,
  type DemoDevice, type DemoActionType, type ScriptTone, type ScriptLength,
} from './demoStudioModel';

const C = {
  // Mørk app-chrome + lyst editor-workspace (fra mockup).
  navBg: '#1c1a18', navText: '#cbc6bf', navActive: '#2a2724', navActiveText: '#fff',
  bg: '#f6f3ee', panel: '#ffffff', cream: '#faf7f2', line: '#eae5dd', lineStrong: '#ddd6cc',
  ink: '#1d1b19', inkSoft: '#6b6358', inkFaint: '#9a9186', accent: '#ef8a5d',
  dark: '#2f2a26', green: '#4a9d6b', preview: '#23201d',
  font: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Inter, sans-serif',
};

const NAV = [
  { id: 'create', label: 'Create Demo', ic: '▢' },
  { id: 'flow', label: 'Flow Builder', ic: '⤳' },
  { id: 'script', label: 'Script Builder', ic: '✎' },
  { id: 'recorder', label: 'Guided Recorder', ic: '●' },
  { id: 'preview', label: 'Device Preview', ic: '▭' },
  { id: 'export', label: 'Export', ic: '⤓' },
];

const DEVICE_LABEL: Record<DemoDevice, string> = { macbook: 'MacBook', ipad: 'iPad', iphone: 'iPhone' };
const ACTION_TYPES: DemoActionType[] = ['open_url', 'click', 'scroll', 'hover', 'type', 'wait', 'switch_device', 'highlight', 'zoom'];
const PAUSE_OPTS = [1, 2, 3, 5];

const AI_SUGGESTIONS = [
  { ic: '✂', title: 'Shorten intro', desc: 'Make the opening more concise.' },
  { ic: '➤', title: 'Add CTA', desc: 'Encourage users to take action.' },
  { ic: '◉', title: 'Make more tutorial-focused', desc: 'Add step-by-step guidance.' },
  { ic: '▭', title: 'Mention mobile experience', desc: 'Highlight the mobile app benefits.' },
];

function fmt(sec: number) {
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function ScriptBuilderView({ onNav }: { onNav?: (id: string) => void } = {}) {
  const { project, selectedSceneId, selectScene, updateScene, addScene, setProjectField } = useDemoStudio();
  const scenes = project?.scenes ?? [];
  const selected = scenes.find((s) => s.id === selectedSceneId) ?? scenes[0];
  const meta = project?.scriptMeta ?? { tone: 'professional' as ScriptTone, audience: 'Healthcare Professionals', language: 'English', length: 'medium' as ScriptLength };

  const setMeta = (patch: Partial<typeof meta>) => setProjectField('scriptMeta', { ...meta, ...patch });
  const readingTime = useMemo(() => {
    const words = (selected?.narration ?? '').trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round((words / 150) * 60)); // ~150 wpm
  }, [selected?.narration]);

  if (!project || !selected) {
    return <div style={{ padding: 40, fontFamily: C.font, color: C.inkSoft }}>Opprett en demo i Flow Builder først.</div>;
  }

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0, fontFamily: C.font, fontSize: 13, color: C.ink, background: C.bg }}>
      {/* ── Left nav (mørk) ── */}
      <div style={{ width: 210, background: C.navBg, color: C.navText, display: 'flex', flexDirection: 'column', flexShrink: 0, padding: '14px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px 16px' }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: C.accent, display: 'grid', placeItems: 'center', color: '#fff' }}>▶</div>
        </div>
        {NAV.map((it) => (
          <div key={it.id} onClick={() => onNav?.(it.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 11px', borderRadius: 9, fontSize: 13, cursor: 'pointer', marginBottom: 2,
              background: it.id === 'script' ? C.navActive : 'transparent', color: it.id === 'script' ? C.navActiveText : C.navText, fontWeight: it.id === 'script' ? 600 : 500 }}>
            <span style={{ width: 18, opacity: 0.85 }}>{it.ic}</span> {it.label}
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ borderTop: '1px solid #34302b', paddingTop: 10, marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: C.inkFaint }}>Demo Project</div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: '#e8e3db', display: 'flex', alignItems: 'center', gap: 4 }}>{project.name} <span style={{ color: C.inkFaint }}>⌄</span></div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, paddingTop: 8, borderTop: '1px solid #34302b' }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#3b5bdb', display: 'grid', placeItems: 'center', color: '#fff', fontSize: 11, fontWeight: 700 }}>JD</div>
          <div><div style={{ fontSize: 12.5, fontWeight: 600, color: '#e8e3db' }}>Jamie Davis</div><div style={{ fontSize: 11, color: C.inkFaint }}>Pro Plan</div></div>
        </div>
      </div>

      {/* ── Main column ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Topbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', background: C.panel, borderBottom: `1px solid ${C.line}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${C.lineStrong}`, borderRadius: 9, padding: '8px 12px', minWidth: 220 }}>
            <span style={{ color: C.inkFaint }}>🌐</span> <span style={{ fontWeight: 600 }}>{project.name}</span> <span style={{ marginLeft: 'auto', color: C.inkFaint }}>⌄</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.cream, border: `1px solid ${C.line}`, borderRadius: 9, padding: '8px 12px', color: C.inkFaint, minWidth: 200 }}>
            ⌕ Search scenes… <span style={{ marginLeft: 'auto', fontSize: 11, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 5, padding: '1px 5px' }}>⌘K</span>
          </div>
          <div style={{ flex: 1 }} />
          <button style={btn}>✦ Generate Script</button>
          <button style={btn}>✎ AI Improve</button>
          <button style={{ ...btn, padding: '8px 10px' }}>⋯</button>
          <button style={{ ...btn, background: C.dark, color: '#fff', borderColor: C.dark }}>✓ Save Script <span>⌄</span></button>
        </div>

        {/* Body: editor + right panel */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {/* Editor workspace */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px', minWidth: 0 }}>
            {/* Scene header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              <div style={hdrBack}>←</div>
              <h2 style={{ fontSize: 21, fontWeight: 700, margin: 0 }}>Scene {selected.index + 1} — {selected.title}</h2>
              <div style={{ flex: 1 }} />
              <span style={chip}>▭ {DEVICE_LABEL[selected.device]}</span>
              <span style={chip}>◷ {fmt(selected.duration)} est.</span>
              <span style={{ ...chip, color: SCENE_STATUS_COLORS[selected.status], borderColor: SCENE_STATUS_COLORS[selected.status] }}>● {SCENE_STATUS_LABELS[selected.status]}</span>
            </div>

            {/* 1. Narration */}
            <Block n={1} ic="🎙" title="Narration" sub="What you will say in this scene">
              <textarea style={ta} value={selected.narration} placeholder="Hva du skal si i denne scenen…"
                onChange={(e) => updateScene(selected.id, { narration: e.target.value })} />
              <div style={metaRow}>
                <Lab>Tone</Lab>
                <select style={miniSel} value={meta.tone} onChange={(e) => setMeta({ tone: e.target.value as ScriptTone })}>
                  {(Object.keys(SCRIPT_TONE_LABELS) as ScriptTone[]).map((t) => <option key={t} value={t}>{SCRIPT_TONE_LABELS[t]}</option>)}
                </select>
                <Lab>Audience</Lab>
                <select style={miniSel} value={meta.audience} onChange={(e) => setMeta({ audience: e.target.value })}>
                  {['Healthcare Professionals', 'Patients', 'Investors', 'Internal Team'].map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
                <Lab>Language</Lab>
                <select style={miniSel} value={meta.language} onChange={(e) => setMeta({ language: e.target.value })}>
                  {['English', 'Norwegian'].map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
                <Lab>Length</Lab>
                <select style={miniSel} value={meta.length} onChange={(e) => setMeta({ length: e.target.value as ScriptLength })}>
                  {(Object.keys(SCRIPT_LENGTH_LABELS) as ScriptLength[]).map((l) => <option key={l} value={l}>{SCRIPT_LENGTH_LABELS[l]}</option>)}
                </select>
              </div>
            </Block>

            {/* 2. Visual Instruction */}
            <Block n={2} ic="🖱" title="Visual Instruction" sub="What to show or focus on">
              <textarea style={ta} value={selected.visualInstruction ?? ''} placeholder="Highlight the dashboard overview panel…"
                onChange={(e) => updateScene(selected.id, { visualInstruction: e.target.value })} />
            </Block>

            {/* 3. Required Action */}
            <Block n={3} ic="☞" title="Required Action" sub="What the viewer should do">
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <select style={{ ...miniSel, minWidth: 110 }} value={selected.actionType ?? 'click'}
                  onChange={(e) => updateScene(selected.id, { actionType: e.target.value as DemoActionType })}>
                  {ACTION_TYPES.map((a) => <option key={a} value={a}>{a.replace('_', ' ')}</option>)}
                </select>
                <input style={{ ...inp, flex: 1 }} value={selected.requiredAction} placeholder='Click the "Start Visit" button.'
                  onChange={(e) => updateScene(selected.id, { requiredAction: e.target.value })} />
              </div>
            </Block>

            {/* 4. Overlay Text */}
            <Block n={4} ic="T" title="Overlay Text" sub="On-screen text or callout">
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input style={{ ...inp, flex: 1 }} value={selected.overlayText ?? ''} placeholder="Get a real-time overview of your practice"
                  onChange={(e) => updateScene(selected.id, { overlayText: e.target.value })} />
                <select style={{ ...miniSel, minWidth: 100 }} defaultValue="minimal">
                  {['minimal', 'callout', 'lower-third', 'tooltip', 'cta-banner', 'step-marker'].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </Block>

            {/* 5. Notes / Pause Cue */}
            <Block n={5} ic="❚❚" title="Notes / Pause Cue" sub="Internal notes or timing">
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <textarea style={{ ...ta, minHeight: 48, flex: 1 }} value={selected.notes ?? ''} placeholder="Pause for ~2 seconds after highlighting the alerts…"
                  onChange={(e) => updateScene(selected.id, { notes: e.target.value })} />
                <select style={{ ...miniSel, minWidth: 80 }} value={selected.pauseSec ?? 2}
                  onChange={(e) => updateScene(selected.id, { pauseSec: Number(e.target.value) })}>
                  {PAUSE_OPTS.map((p) => <option key={p} value={p}>{p}s</option>)}
                </select>
              </div>
            </Block>
          </div>

          {/* Right panel: Live Preview + AI Assistant */}
          <div style={{ width: 340, flexShrink: 0, background: C.panel, borderLeft: `1px solid ${C.line}`, overflowY: 'auto', padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>👁 Live Preview</span>
              <div style={{ flex: 1 }} />
              <span style={{ ...chip, fontSize: 10 }}>▭ {DEVICE_LABEL[selected.device]}</span>
            </div>
            {/* Teleprompter preview-kort */}
            <div style={{ background: C.preview, borderRadius: 12, padding: 18, color: '#f2ede6', marginBottom: 18 }}>
              <span style={{ fontSize: 11, background: '#3a342e', borderRadius: 6, padding: '3px 8px', color: '#cbc6bf' }}>Scene {selected.index + 1} of {scenes.length}</span>
              <div style={{ height: 1, background: '#3a342e', margin: '14px 0' }} />
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 19, lineHeight: 1.3 }}>
                {selected.narration ? selected.narration.split('\n')[0] : 'Skriv narration for å se teleprompter-preview…'}
              </div>
              <div style={{ display: 'flex', gap: 5, marginTop: 16 }}>
                {scenes.map((s, i) => <span key={s.id} style={{ width: i === selected.index ? 16 : 6, height: 6, borderRadius: 3, background: i === selected.index ? C.accent : '#4a443d' }} />)}
              </div>
              <div style={{ fontSize: 11, color: '#9a9186', marginTop: 12 }}>≈ {readingTime}s lesetid</div>
            </div>

            {/* AI Assistant */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>✦ AI Assistant</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: C.accent, border: `1px solid ${C.accent}`, borderRadius: 4, padding: '1px 4px' }}>BETA</span>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 11, color: C.inkSoft, cursor: 'pointer' }}>↻ Regenerate</span>
            </div>
            <div style={{ fontSize: 11, color: C.inkFaint, marginBottom: 12 }}>Suggestions to improve your script</div>
            {AI_SUGGESTIONS.map((s) => (
              <div key={s.title} style={{ display: 'flex', alignItems: 'center', gap: 10, border: `1px solid ${C.line}`, borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
                <div style={{ width: 26, height: 26, borderRadius: 7, background: C.cream, display: 'grid', placeItems: 'center', fontSize: 12 }}>{s.ic}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{s.title}</div>
                  <div style={{ fontSize: 11, color: C.inkFaint }}>{s.desc}</div>
                </div>
                <button style={{ ...btn, padding: '5px 12px', fontSize: 12 }}>Insert</button>
              </div>
            ))}
            <div style={{ textAlign: 'center', border: `1px solid ${C.line}`, borderRadius: 10, padding: 10, fontSize: 12, color: C.inkSoft, cursor: 'pointer', marginTop: 4 }}>View all suggestions ›</div>
          </div>
        </div>

        {/* Bottom scene timeline */}
        <div style={{ display: 'flex', gap: 10, padding: 12, borderTop: `1px solid ${C.line}`, background: C.panel, overflowX: 'auto' }}>
          {scenes.map((s) => (
            <div key={s.id} onClick={() => selectScene(s.id)}
              style={{ minWidth: 150, padding: 10, borderRadius: 10, cursor: 'pointer', border: `2px solid ${s.id === selectedSceneId ? C.accent : C.line}`, background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 11 }}>{s.index + 1}</span>
                <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</span>
                <div style={{ flex: 1 }} /><span style={{ color: C.inkFaint }}>⋮</span>
              </div>
              <div style={{ height: 56, borderRadius: 7, background: C.cream, marginBottom: 8 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: SCENE_STATUS_COLORS[s.status] }} />
                <span style={{ color: C.inkSoft }}>{SCENE_STATUS_LABELS[s.status]}</span>
                <div style={{ flex: 1 }} /><span style={{ color: C.inkFaint }}>{fmt(s.duration)}</span>
              </div>
            </div>
          ))}
          <div onClick={() => addScene(scenes.length - 1)}
            style={{ minWidth: 110, borderRadius: 10, border: `1px dashed ${C.lineStrong}`, display: 'grid', placeItems: 'center', cursor: 'pointer', color: C.inkSoft }}>
            <div style={{ textAlign: 'center' }}><div style={{ fontSize: 20 }}>⊕</div><div style={{ fontSize: 11 }}>Add Scene</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Block({ n, ic, title, sub, children }: { n: number; ic: string; title: string; sub: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 14, border: `1px solid ${C.line}`, borderRadius: 12, padding: 16, marginBottom: 12, background: '#fff' }}>
      <div style={{ width: 26, height: 26, borderRadius: '50%', background: C.cream, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{n}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 14 }}>{ic}</span>
          <div><div style={{ fontSize: 13.5, fontWeight: 700 }}>{title}</div><div style={{ fontSize: 11, color: C.inkFaint }}>{sub}</div></div>
        </div>
        {children}
      </div>
    </div>
  );
}

const Lab = ({ children }: { children: React.ReactNode }) => <span style={{ fontSize: 11, color: C.inkSoft, fontWeight: 600 }}>{children}</span>;

const btn: React.CSSProperties = { border: `1px solid ${C.lineStrong}`, background: '#fff', borderRadius: 9, padding: '8px 13px', fontSize: 12.5, fontWeight: 600, color: C.ink, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' };
const hdrBack: React.CSSProperties = { width: 34, height: 34, borderRadius: 9, border: `1px solid ${C.lineStrong}`, display: 'grid', placeItems: 'center', cursor: 'pointer', color: C.inkSoft };
const chip: React.CSSProperties = { fontSize: 11.5, border: `1px solid ${C.lineStrong}`, borderRadius: 8, padding: '4px 9px', color: C.inkSoft, whiteSpace: 'nowrap' };
const ta: React.CSSProperties = { width: '100%', minHeight: 80, border: `1px solid ${C.lineStrong}`, borderRadius: 9, padding: '10px 12px', fontSize: 13, lineHeight: 1.5, color: C.ink, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' };
const inp: React.CSSProperties = { border: `1px solid ${C.lineStrong}`, borderRadius: 9, padding: '9px 12px', fontSize: 13, color: C.ink, fontFamily: 'inherit', boxSizing: 'border-box' };
const miniSel: React.CSSProperties = { border: `1px solid ${C.lineStrong}`, borderRadius: 8, padding: '6px 8px', fontSize: 12, color: C.ink, background: '#fff', fontFamily: 'inherit' };
const metaRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 10 };

export default ScriptBuilderView;
