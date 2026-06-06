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

import { useEffect, useMemo, useState } from 'react';
import { useDemoStudio } from './demoStudioStore';
import { fetchCurrentUser, roleLabel, userInitials, type CurrentUser } from '../../services/currentUserService';
import { captureScreenshot, isCaptureAvailable } from '../../services/demoCaptureService';
import { generateSceneScript, improveScript, type ImproveAction } from './demoStudioAI';
import { isAiConnected } from '../../services/claudeProxyService';
import { RoleRoomSignInDialog } from '../RoleRoomSignInDialog';
import { FramedDevice } from './FramedDevice';
import { type FrameVariant } from './deviceFrames';
import { SceneInteractionOverlay } from './SceneInteractionOverlay';
import {
  SCENE_STATUS_LABELS, SCENE_STATUS_COLORS, SCRIPT_TONE_LABELS, SCRIPT_LENGTH_LABELS,
  ACTION_MATCH_LABELS, ACTION_MATCH_COLORS,
  sceneActionMatch, expectedActionText, defaultRenderOptions, readabilityScore,
  type DemoDevice, type DemoActionType, type ScriptTone, type ScriptLength, type DemoScene, type DemoRenderOptions,
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

const AI_SUGGESTIONS: { ic: string; title: string; desc: string; action: ImproveAction }[] = [
  { ic: '☺', title: 'Mer menneskelig', desc: 'Varmere, naturlig tone.', action: 'human' },
  { ic: '✂', title: 'Gjør kortere', desc: 'Stram inn manuset.', action: 'shorten' },
  { ic: '➤', title: 'Legg til CTA', desc: 'Oppfordre til handling.', action: 'cta' },
  { ic: '◉', title: 'Mer tutorial-fokusert', desc: 'Legg til steg-for-steg.', action: 'tutorial' },
  { ic: '✦', title: 'Forenkle språket', desc: 'Unngå sjargong.', action: 'simplify' },
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
  const render = project?.render ?? defaultRenderOptions();

  const setMeta = (patch: Partial<typeof meta>) => setProjectField('scriptMeta', { ...meta, ...patch });
  const readingTime = useMemo(() => {
    const words = (selected?.narration ?? '').trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round((words / 150) * 60)); // ~150 wpm
  }, [selected?.narration]);

  const [aiBusy, setAiBusy] = useState<null | string>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showSignIn, setShowSignIn] = useState(false);
  const [aiReady, setAiReady] = useState(isAiConnected());
  const [undoSnapshot, setUndoSnapshot] = useState<{ id: string; text: string } | null>(null);
  const [me, setMe] = useState<CurrentUser | null>(null);

  // Vis den FAKTISK innloggede brukeren (ikke mockup). Oppdater ved innlogging.
  useEffect(() => {
    void fetchCurrentUser().then(setMe);
    const onAuth = () => void fetchCurrentUser().then(setMe);
    window.addEventListener('trrpa:auth-changed', onAuth);
    return () => window.removeEventListener('trrpa:auth-changed', onAuth);
  }, [aiReady]);

  const onGenerate = async () => {
    if (!project || !selected) return;
    if (!aiReady) { setShowSignIn(true); return; }
    setAiError(null); setAiBusy('generate');
    try {
      const g = await generateSceneScript({ url: project.url, demoType: project.demoType, scene: selected, meta, screenshot: selected.thumbnailDataUrl });
      updateScene(selected.id, {
        narration: g.narration, visualInstruction: g.visualInstruction,
        requiredAction: g.requiredAction, overlayText: g.overlayText, status: 'in_progress',
      });
    } catch (e) { setAiError((e as Error).message); } finally { setAiBusy(null); }
  };

  const onShot = async () => {
    if (!project || !selected) return;
    if (!isCaptureAvailable()) { setAiError('Skjermbilde krever Tauri-appen.'); return; }
    setAiError(null); setAiBusy('shot');
    try {
      const d = await captureScreenshot(project.url);
      if (d) updateScene(selected.id, { thumbnailDataUrl: d });
      else setAiError('Klarte ikke ta skjermbilde');
    } finally { setAiBusy(null); }
  };

  const onImprove = async (action: ImproveAction) => {
    if (!aiReady) { setShowSignIn(true); return; }
    if (!selected?.narration?.trim()) { setAiError('Skriv narration først'); return; }
    setAiError(null); setAiBusy(action);
    const prev = selected.narration; const sid = selected.id;
    try {
      const improved = await improveScript({ text: selected.narration, action, meta });
      setUndoSnapshot({ id: sid, text: prev }); // gjør AI-endringen angrbar
      updateScene(sid, { narration: improved });
    } catch (e) { setAiError((e as Error).message); } finally { setAiBusy(null); }
  };

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
        {me ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, paddingTop: 8, borderTop: '1px solid #34302b' }}>
            {me.profileImageUrl
              ? <img src={me.profileImageUrl} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover' }} />
              : <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#3b5bdb', display: 'grid', placeItems: 'center', color: '#fff', fontSize: 11, fontWeight: 700 }}>{userInitials(me.name)}</div>}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: '#e8e3db', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{me.name}</div>
              <div style={{ fontSize: 11, color: C.inkFaint }}>{roleLabel(me)}</div>
            </div>
          </div>
        ) : (
          <div onClick={() => setShowSignIn(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 9, paddingTop: 8, borderTop: '1px solid #34302b', cursor: 'pointer' }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid #34302b', display: 'grid', placeItems: 'center', color: C.inkFaint, fontSize: 14 }}>?</div>
            <div><div style={{ fontSize: 12.5, fontWeight: 600, color: '#e8e3db' }}>Ikke logget inn</div><div style={{ fontSize: 11, color: C.inkFaint }}>Logg inn med Role Room</div></div>
          </div>
        )}
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
          <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: aiReady ? '#e6f3ec' : '#fdeee0', color: aiReady ? C.green : '#b5651d' }}>
            {aiReady ? 'AI klar' : 'AI ikke koblet'}
          </span>
          {!aiReady && (
            <button style={{ ...btn }} onClick={() => setShowSignIn(true)}>Koble til AI</button>
          )}
          <button style={{ ...btn, opacity: aiBusy ? 0.6 : 1 }} disabled={!!aiBusy} onClick={() => void onGenerate()}>
            ✦ {aiBusy === 'generate' ? 'Genererer…' : 'Generate Script'}
          </button>
          <button style={{ ...btn, opacity: aiBusy ? 0.6 : 1 }} disabled={!!aiBusy} onClick={() => void onImprove('clarify')}>
            ✎ {aiBusy && aiBusy !== 'generate' ? 'Forbedrer…' : 'AI Improve'}
          </button>
          <span style={{ fontSize: 12, color: C.green, fontWeight: 600, whiteSpace: 'nowrap' }} title="Endringer lagres automatisk">✓ Lagret</span>
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
              {selected.narration?.trim() && (() => {
                const r = readabilityScore(selected.narration);
                const col = r.lix < 40 ? C.green : r.lix < 50 ? '#b5651d' : '#c4453b';
                return <div style={{ fontSize: 11, color: C.inkFaint, marginTop: 5 }}>Lesbarhet (LIX): <span style={{ color: col, fontWeight: 600 }}>{r.lix} · {r.label}</span> · ≈ {readingTime}s lesetid</div>;
              })()}
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
              <div style={{ display: 'flex', gap: 14 }}>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Critical Step-toggle */}
                  <div onClick={() => updateScene(selected.id, { critical: !selected.critical })}
                    style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      padding: '3px 9px', borderRadius: 7, border: `1px solid ${selected.critical ? C.accent : C.lineStrong}`,
                      background: selected.critical ? '#fdf0e7' : '#fff', color: selected.critical ? '#b5651d' : C.inkFaint }}>
                    ★ Critical Step
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div><Lab>Action Type</Lab>
                      <select style={{ ...miniSel, minWidth: 110, display: 'block', marginTop: 4 }} value={selected.actionType ?? 'click'}
                        onChange={(e) => updateScene(selected.id, { actionType: e.target.value as DemoActionType })}>
                        {ACTION_TYPES.map((a) => <option key={a} value={a}>{a.replace('_', ' ')}</option>)}
                      </select>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}><Lab>Target</Lab>
                      <input style={{ ...inp, width: '100%', marginTop: 4 }} value={selected.targetLabel ?? ''} placeholder='F.eks. "Start Visit"-knappen'
                        onChange={(e) => updateScene(selected.id, { targetLabel: e.target.value })} />
                    </div>
                  </div>
                  <div><Lab>Instruction</Lab>
                    <input style={{ ...inp, width: '100%', marginTop: 4 }} value={selected.requiredAction} placeholder='Click the "Start Visit" button.'
                      onChange={(e) => updateScene(selected.id, { requiredAction: e.target.value })} />
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}><Lab>Validation</Lab>
                      <input style={{ ...inp, width: '100%', marginTop: 4 }} value={selected.validationRule ?? ''} placeholder="Vent til modal åpnes"
                        onChange={(e) => updateScene(selected.id, { validationRule: e.target.value })} />
                    </div>
                    <div><Lab>Fallback</Lab>
                      <select style={{ ...miniSel, minWidth: 150, display: 'block', marginTop: 4 }} value={selected.fallback ?? 'retake'}
                        onChange={(e) => updateScene(selected.id, { fallback: e.target.value as 'retake' | 'manual' | 'skip' })}>
                        <option value="retake">Retake scene</option>
                        <option value="manual">Mark manually done</option>
                        <option value="skip">Hopp over scenen</option>
                      </select>
                    </div>
                  </div>
                </div>
                {/* Element-preview (det bundne elementet fremhevet) */}
                <div style={{ width: 200, flexShrink: 0 }}>
                  <ElementPreview scene={selected} url={project.url} render={render} />
                </div>
              </div>
            </Block>

            {/* 4. Overlay Text */}
            <Block n={4} ic="T" title="Overlay Text" sub="On-screen text or callout">
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input style={{ ...inp, flex: 1 }} value={selected.overlayText ?? ''} placeholder="Get a real-time overview of your practice"
                  onChange={(e) => updateScene(selected.id, { overlayText: e.target.value })} />
                <select style={{ ...miniSel, minWidth: 100 }} value={selected.overlayStyle ?? 'minimal'}
                  onChange={(e) => updateScene(selected.id, { overlayStyle: e.target.value })}>
                  {['minimal', 'callout', 'lower-third', 'tooltip', 'cta-banner', 'step-marker'].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </Block>

            {/* 5. Notes / Pause Cue */}
            <Block n={5} ic="❚❚" title="Notes / Pause Cue" sub="Internal notes or timing">
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <textarea style={{ ...ta, minHeight: 48, flex: 1 }} value={selected.notes ?? ''} placeholder="Pause for ~2 seconds after highlighting the alerts…"
                  onChange={(e) => updateScene(selected.id, { notes: e.target.value })} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div><Lab>Continue mode</Lab>
                    <select style={{ ...miniSel, minWidth: 100, display: 'block', marginTop: 4 }} value={selected.continueMode ?? 'manual'}
                      onChange={(e) => updateScene(selected.id, { continueMode: e.target.value as 'manual' | 'assisted' | 'auto' })}>
                      <option value="manual">Manual</option>
                      <option value="assisted">Assisted</option>
                      <option value="auto">Auto</option>
                    </select>
                  </div>
                  <div><Lab>Pause</Lab>
                    <select style={{ ...miniSel, minWidth: 100, display: 'block', marginTop: 4 }} value={selected.pauseSec ?? 2}
                      onChange={(e) => updateScene(selected.id, { pauseSec: Number(e.target.value) })}>
                      {PAUSE_OPTS.map((p) => <option key={p} value={p}>{p}s</option>)}
                    </select>
                  </div>
                </div>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <button style={{ ...btn, padding: '6px 11px', fontSize: 12, opacity: aiBusy ? 0.6 : 1 }} disabled={!!aiBusy} onClick={() => void onShot()}>
                {aiBusy === 'shot' ? 'Tar skjermbilde…' : 'Ta skjermbilde'}
              </button>
              <span style={{ fontSize: 11, color: selected.thumbnailDataUrl ? C.green : C.inkFaint }}>
                {selected.thumbnailDataUrl ? '✓ Generate Script bruker vision' : 'For AI vision (ser skjermen)'}
              </span>
            </div>
            {/* Teleprompter preview-kort */}
            <div style={{ background: C.preview, borderRadius: 12, padding: 18, color: '#f2ede6', marginBottom: 18 }}>
              <span style={{ fontSize: 11, background: '#3a342e', borderRadius: 6, padding: '3px 8px', color: '#cbc6bf' }}>Scene {selected.index + 1} of {scenes.length}</span>
              <div style={{ height: 1, background: '#3a342e', margin: '14px 0' }} />
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 19, lineHeight: 1.35, whiteSpace: 'pre-wrap', maxHeight: 320, overflowY: 'auto' }}>
                {selected.narration || 'Skriv narration for å se teleprompter-preview…'}
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
              <span style={{ fontSize: 11, color: aiBusy ? C.inkFaint : C.inkSoft, cursor: aiBusy ? 'default' : 'pointer' }}
                onClick={() => { if (!aiBusy) void onGenerate(); }}>↻ Regenerate</span>
            </div>
            <div style={{ fontSize: 11, color: C.inkFaint, marginBottom: 12 }}>Forbedre manuset for denne scenen</div>
            {aiError && <div style={{ fontSize: 11.5, color: '#c4453b', marginBottom: 10 }}>{aiError}</div>}
            {undoSnapshot && undoSnapshot.id === selected.id && (
              <div onClick={() => { updateScene(selected.id, { narration: undoSnapshot.text }); setUndoSnapshot(null); }}
                style={{ fontSize: 11.5, color: C.accent, cursor: 'pointer', marginBottom: 10, fontWeight: 600 }}>↩ Angre AI-endring</div>
            )}
            {AI_SUGGESTIONS.map((s) => (
              <div key={s.title} style={{ display: 'flex', alignItems: 'center', gap: 10, border: `1px solid ${C.line}`, borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
                <div style={{ width: 26, height: 26, borderRadius: 7, background: C.cream, display: 'grid', placeItems: 'center', fontSize: 12 }}>{s.ic}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{s.title}</div>
                  <div style={{ fontSize: 11, color: C.inkFaint }}>{s.desc}</div>
                </div>
                <button style={{ ...btn, padding: '5px 12px', fontSize: 12, opacity: aiBusy ? 0.6 : 1 }} disabled={!!aiBusy}
                  onClick={() => void onImprove(s.action)}>
                  {aiBusy === s.action ? '…' : 'Insert'}
                </button>
              </div>
            ))}

            {/* Action Validation (Expected ↔ Current) */}
            {(() => {
              const match = sceneActionMatch(selected);
              const statusText = match === 'match' ? 'Riktig handling registrert' : match === 'warning' ? 'Avvik oppdaget' : 'Venter på riktig handling';
              return (
                <div style={{ marginTop: 18, borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>✓ Action Validation</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12, marginBottom: 7 }}>
                    <span style={{ color: C.inkFaint }}>Expected Action</span>
                    <span style={{ color: C.accent, fontWeight: 600, textAlign: 'right' }}>{expectedActionText(selected)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12 }}>
                    <span style={{ color: C.inkFaint }}>Current Status</span>
                    <span style={{ color: ACTION_MATCH_COLORS[match], fontWeight: 600, textAlign: 'right' }}>{statusText} ({ACTION_MATCH_LABELS[match]})</span>
                  </div>
                </div>
              );
            })()}
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
      {showSignIn && (
        <RoleRoomSignInDialog onClose={() => setShowSignIn(false)} onSignedIn={() => { setAiReady(true); setShowSignIn(false); }} />
      )}
    </div>
  );
}

/** Liten live-preview av det bundne elementet (hotspot fremhevet) i action-blokka. */
function ElementPreview({ scene, url, render }: { scene: DemoScene; url: string; render: DemoRenderOptions }) {
  const variant: FrameVariant = scene.device === 'ipad' && scene.orientation === 'landscape' ? 'ipad_landscape' : scene.device;
  const w = scene.device === 'macbook' ? '100%' : scene.device === 'ipad' ? 132 : 84;
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: 10, background: C.cream }}>
      <div style={{ fontSize: 10.5, color: C.inkFaint, marginBottom: 8 }}>Element-preview</div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: w }}>
          <FramedDevice variant={variant} url={url} width="100%"
            overlay={<SceneInteractionOverlay hotspot={scene.hotspot} render={render} device={scene.device} />} />
        </div>
      </div>
      <div style={{ fontSize: 10.5, color: scene.hotspot ? C.green : C.inkFaint, marginTop: 8, textAlign: 'center' }}>
        {scene.hotspot ? `◎ ${scene.targetLabel || 'element markert'}` : 'Sett hotspot i Flow Builder'}
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
