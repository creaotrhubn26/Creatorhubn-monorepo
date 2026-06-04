/**
 * DemoStudioShell — Product Demo Studio (funksjonell). Piksel-matchet 5-sone
 * cream-editor-layout (fasit: Daniels mockup + docs/demo-studio/SPEC.md), nå
 * koblet til demoStudioStore med ekte interaksjon:
 *
 *   - Tom tilstand: URL-input → createProject → default scene-flow.
 *   - Senter: LIVE URL-preview i <iframe>, viewport-toggle (desktop/mobil) som
 *     setter bredde + scenens device. Scene-flow-kort under (klikkbare).
 *   - Høyre: Guide/Script/Notes — editerbare scene-felter (manus, action,
 *     enhet, varighet, overlay) bundet til storen.
 *   - Guided recorder: "Start opptak" → teleprompter-overlay med manuell
 *     Next/Done/Retake (continueMode: manual).
 *   - Story-modus: gjenbruker StoryView via demoStudioStoryAdapter.
 *
 * Verifiseres mot mockup med Playwright (scripts/_pixshot*).
 */

import { useEffect, useMemo, useState } from 'react';
import { StoryView } from '../story/StoryView';
import { ScriptBuilderView } from './ScriptBuilderView';
import { GuidedRecorderView } from './GuidedRecorderView';
import { ExportView } from './ExportView';
import { FramedDevice } from './FramedDevice';
import { type FrameVariant } from './deviceFrames';
import { isAiConnected } from '../../services/claudeProxyService';
import { RoleRoomSignInDialog } from '../RoleRoomSignInDialog';
import { useSceneRecorder } from './useSceneRecorder';
import { generateDemoFlow, fetchSiteContext } from './demoStudioAI';
import { useDemoStudio } from './demoStudioStore';
import {
  DEMO_TYPE_LABELS, DEMO_TYPE_TEMPLATES, SCENE_STATUS_LABELS, SCENE_STATUS_COLORS,
  totalDuration, hasRecordedWork, type DemoDevice, type DemoType,
} from './demoStudioModel';
import { demoScenesToPicks, demoChapters } from './demoStudioStoryAdapter';

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

const DEVICE_LABEL: Record<DemoDevice, string> = { macbook: 'MacBook', ipad: 'iPad', iphone: 'iPhone' };
/** Bredde på preview-canvas per enhet (px) — desktop fyller, mobil/tablet smalere. */

function fmt(sec: number) {
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Tilgivende URL: legg til https:// hvis protokollen mangler, så brukeren
 * bare kan skrive «theroleroom.com». Tom streng forblir tom. Brukes både i
 * tom-tilstandens input og i topbarens URL-felt så de oppfører seg likt.
 */
function normalizeUrl(raw: string): string {
  const t = raw.trim();
  return t && !/^https?:\/\//i.test(t) ? `https://${t}` : t;
}

export function DemoStudioShell({ onClose }: { onClose?: () => void } = {}) {
  const {
    project, selectedSceneId, recorderStepIndex,
    createProject, selectScene, updateScene, addScene, removeScene, replaceScenes,
    setSceneDevice, setProjectField, setDemoType: applyDemoTypeTemplate, startRecorder, nextStep, markCurrentDone, retakeCurrent, goToStep,
    loadExisting,
  } = useDemoStudio();

  // Gjenopprett lagret prosjekt ved oppstart (ellers virket alt arbeid borte).
  useEffect(() => { if (!project) loadExisting(); /* eslint-disable-next-line */ }, []);
  // Frigjør skjermdelings-streamen når shell unmountes.
  useEffect(() => () => rec.release(), []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Start web-opptak for scenen brukeren faktisk står på nå (fersk fra storen). */
  const startForCurrent = async () => {
    const st = useDemoStudio.getState();
    const sc = st.project?.scenes[st.recorderStepIndex];
    if (sc && st.project) await rec.start(st.project.id, sc.id);
  };

  const [nav, setNav] = useState<NavId>('flow');
  const [tab, setTab] = useState<'Guide' | 'Script' | 'Notes'>('Guide');
  const [storyMode, setStoryMode] = useState(false);
  const [recording, setRecording] = useState(false);
  const rec = useSceneRecorder();
  const [urlInput, setUrlInput] = useState('');
  const [directorBusy, setDirectorBusy] = useState(false);
  const [directorMsg, setDirectorMsg] = useState<string | null>(null);
  const [showSignIn, setShowSignIn] = useState(false);
  const [aiReady, setAiReady] = useState(isAiConnected());

  // AI Director (§5.1): hent nettside-kontekst → generér hel scene-flow →
  // erstatt scener → hopp til Script Builder så Director + Script Builder
  // jobber på samme scene-objekter.
  const runDirector = async () => {
    if (!project || directorBusy) return;
    if (!aiReady) { setShowSignIn(true); return; }
    setDirectorBusy(true); setDirectorMsg('Leser nettsiden…');
    try {
      const siteContext = await fetchSiteContext(project.url);
      setDirectorMsg(siteContext ? 'AI Director designer flowen…' : 'Kunne ikke lese siden (CORS) — designer fra URL-en…');
      const meta = project.scriptMeta ?? { tone: 'professional' as const, audience: 'General', language: project.language === 'en' ? 'English' : 'Norsk', length: 'medium' as const };
      const scenes = await generateDemoFlow({
        url: project.url, demoType: project.demoType, devices: project.devices, meta, siteContext,
      });
      replaceScenes(scenes);
      setDirectorMsg(`✓ ${scenes.length} scener generert`);
      setNav('script'); // samarbeid: åpne resultatet i Script Builder
    } catch (e) {
      setDirectorMsg('Feil: ' + (e as Error).message);
    } finally {
      setDirectorBusy(false);
    }
  };
  const [demoType, setDemoType] = useState<DemoType>('product_demo');

  const scenes = project?.scenes ?? [];
  const selected = scenes.find((s) => s.id === selectedSceneId) ?? scenes[0];
  const recorderScene = scenes[recorderStepIndex];
  const doneCount = scenes.filter((s) => s.status === 'done' || s.status === 'approved').length;
  const previewDevice = selected?.device ?? 'macbook';
  const previewVariant: FrameVariant = previewDevice === 'ipad' && selected?.orientation === 'landscape' ? 'ipad_landscape' : previewDevice;

  const storyPicks = useMemo(() => (project ? demoScenesToPicks(project.scenes) : []), [project]);
  const storyChapters = useMemo(() => (project ? demoChapters(project.scenes) : []), [project]);

  // ── Tom tilstand: Create Demo (URL + flow) ──
  if (!project) {
    // Tilgivende URL-håndtering: auto-legg til https:// hvis brukeren bare
    // skrev "domene.no". Krever et punktum i verts­navnet for å være gyldig.
    // i-flagg så stor "HTTPS://" (f.eks. fra macOS autocorrect) også godtas.
    const normalizedUrl = normalizeUrl(urlInput);
    const valid = /^https?:\/\/\S+\.\S+/i.test(normalizedUrl);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: C.font, background: C.bg, color: C.ink }}>
        <div style={topbarStyle}>
          <div style={iconBtn} onClick={onClose} title="Tilbake til hjem">☰</div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Product Demo Studio</div>
        </div>
        <div style={{ maxWidth: 560, margin: '64px auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Hva vil du vise frem?</h2>
          <p style={{ color: C.inkSoft, fontSize: 13.5, margin: 0 }}>Lim inn en URL og bygg en scene-basert produktdemo. Velg opptaks-enhet i Guided Recorder. Du styrer opptaket steg for steg.</p>
          <input style={{ ...field, fontSize: 15, padding: '13px 15px' }} placeholder="https://example.com"
            value={urlInput} onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && valid) createProject(normalizedUrl, demoType); }} />
          <select style={{ ...field, padding: '11px 12px' }} value={demoType} onChange={(e) => setDemoType(e.target.value as DemoType)}>
            {(Object.keys(DEMO_TYPE_LABELS) as DemoType[]).map((t) => <option key={t} value={t}>{DEMO_TYPE_LABELS[t]}</option>)}
          </select>
          <button style={{ ...primaryBtn, opacity: valid ? 1 : 0.5, alignSelf: 'flex-start' }}
            disabled={!valid} onClick={() => createProject(normalizedUrl, demoType)}>
            Generér demo-flow →
          </button>
          {!valid && (
            <p style={{ color: C.inkSoft, fontSize: 12.5, margin: '2px 0 0' }}>
              Skriv inn en gyldig URL for å starte (f.eks. <code>theroleroom.com</code>).
            </p>
          )}
        </div>
      </div>
    );
  }

  // Script Builder + Guided Recorder har egne fullskjerm-layouter.
  if (nav === 'script' && !storyMode) {
    return <ScriptBuilderView onNav={(id) => setNav(id as NavId)} />;
  }
  if (nav === 'recorder' && !storyMode) {
    return <GuidedRecorderView onNav={(id) => setNav(id as NavId)} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, fontFamily: C.font, background: C.bg, color: C.ink, fontSize: 13 }}>
      {/* ── Topbar (URL-input erstatter Search) ── */}
      <div style={topbarStyle}>
        <div style={iconBtn} onClick={onClose} title="Tilbake til hjem">☰</div>
        <div>
          <input style={{ ...titleField }} value={project.name} onChange={(e) => setProjectField('name', e.target.value)} />
          <div style={{ fontSize: 11, color: C.inkFaint, display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.green }} /> Draft · Autosaved just now
          </div>
        </div>
        <div style={{ flex: 1, maxWidth: 420, display: 'flex', alignItems: 'center', gap: 8, background: C.cream, border: `1px solid ${C.line}`, borderRadius: 9, padding: '7px 12px' }}>
          <span style={{ color: C.inkFaint }}>🌐</span>
          <input style={{ flex: 1, border: 0, background: 'transparent', outline: 'none', fontSize: 13, color: C.ink }}
            value={project.url} onChange={(e) => setProjectField('url', e.target.value)}
            onBlur={(e) => setProjectField('url', normalizeUrl(e.target.value))} placeholder="https://example.com" />
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.inkSoft }}><span style={{ color: C.green }}>✓</span> Lagret</div>
        <button style={recording ? { ...btn, background: '#ef4444', color: '#fff', borderColor: '#ef4444' } : btn}
          onClick={async () => {
            if (recording) return;
            setStoryMode(false); startRecorder();
            const st = useDemoStudio.getState();
            const sc = st.project?.scenes[st.recorderStepIndex];
            const ok = sc && st.project ? await rec.start(st.project.id, sc.id) : false;
            if (ok) setRecording(true);
          }}>● {rec.state === 'recording' ? 'Recording' : rec.state === 'saving' ? 'Lagrer…' : 'Record'}</button>
        <button style={{ ...btn, background: C.dark, color: '#fff', borderColor: C.dark }}
          onClick={() => { setStoryMode(false); setNav('export'); }}>Export <span>⌄</span></button>
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* ── Left nav ── */}
        <div style={{ width: 208, background: C.panel, borderRight: `1px solid ${C.line}`, display: 'flex', flexDirection: 'column', padding: '12px 10px', flexShrink: 0 }}>
          {NAV_ITEMS.map((it) => (
            <div key={it.id} onClick={() => { setNav(it.id); setStoryMode(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px', borderRadius: 9, fontSize: 13, cursor: 'pointer', marginBottom: 2,
                background: nav === it.id && !storyMode ? C.creamActive : 'transparent', color: nav === it.id && !storyMode ? C.ink : C.inkSoft, fontWeight: nav === it.id && !storyMode ? 600 : 500 }}>
              <span style={{ width: 18, opacity: 0.85 }}>{it.ic}</span> {it.label}
            </div>
          ))}
          {/* Story-modus (gjenbruk av StoryView) */}
          <div onClick={() => setStoryMode(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px', borderRadius: 9, fontSize: 13, cursor: 'pointer', marginBottom: 2,
              background: storyMode ? C.creamActive : 'transparent', color: storyMode ? C.ink : C.inkSoft, fontWeight: storyMode ? 600 : 500 }}>
            <span style={{ width: 18, opacity: 0.85 }}>✦</span> Story
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ background: C.cream, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <h4 style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              ✦ AI Director
              <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 6, background: aiReady ? '#e6f3ec' : '#fdeee0', color: aiReady ? C.green : '#b5651d' }}>
                {aiReady ? 'AI klar' : 'Ikke koblet'}
              </span>
            </h4>
            <p style={{ fontSize: 11.5, color: C.inkSoft, lineHeight: 1.45, marginBottom: 10 }}>La AI lese nettsiden og foreslå en hel scene-flow med manus.</p>
            {!aiReady && (
              <button style={{ ...btn, width: '100%', justifyContent: 'center', background: '#fff', marginBottom: 8 }}
                onClick={() => setShowSignIn(true)}>Koble til AI (Role Room)</button>
            )}
            <button style={{ ...btn, width: '100%', justifyContent: 'center', background: '#fff', opacity: directorBusy ? 0.6 : 1 }}
              disabled={directorBusy} onClick={() => void runDirector()}>
              {directorBusy ? 'Jobber…' : 'Generér hele demoen'}
            </button>
            {directorMsg && <div style={{ fontSize: 11, color: directorMsg.startsWith('Feil') ? '#c4453b' : C.inkSoft, marginTop: 8 }}>{directorMsg}</div>}
          </div>
        </div>

        {/* ── STORY-modus: gjenbruk StoryView ── */}
        {storyMode ? (
          <div style={{ flex: 1, minHeight: 0 }}>
            <StoryView
              picks={storyPicks} chapters={storyChapters}
              focusedPickIndex={selected?.index ?? null}
              onFocusPick={(idx) => { if (idx == null) return; const sc = scenes.find((s) => s.index === idx); if (sc) selectScene(sc.id); }}
              projectInfo={{
                project: project.name, client: DEMO_TYPE_LABELS[project.demoType],
                duration: fmt(totalDuration(scenes)), format: project.format,
                created: new Date(project.createdAt).toLocaleDateString('nb-NO'),
                updated: new Date(project.updatedAt).toLocaleDateString('nb-NO'),
              }}
              onBackToProject={() => setStoryMode(false)} onStartEditing={() => setStoryMode(false)}
            />
          </div>
        ) : nav === 'export' ? (
          <div style={{ flex: 1, minHeight: 0 }}><ExportView /></div>
        ) : (
          <>
            {/* ── Blocks panel (demo-typer) ── */}
            <div style={{ width: 230, background: C.panel, borderRight: `1px solid ${C.line}`, padding: 16, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Demo-typer <span style={{ color: C.inkFaint }}>‹</span></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {(Object.keys(DEMO_TYPE_LABELS) as DemoType[]).map((t) => (
                  <div key={t} onClick={() => {
                    if (t === project.demoType) return;
                    // Bytt mal: re-seed flowen. Bekreft kun hvis brukeren har gjort
                    // reelt opptaks-arbeid som ville gått tapt.
                    const reseed = !hasRecordedWork(scenes) ||
                      window.confirm(`Bytte til «${DEMO_TYPE_LABELS[t]}»-mal? Dette erstatter scene-flowen. Opptak du har gjort følger ikke med over i den nye malen.`);
                    if (!reseed) return;
                    applyDemoTypeTemplate(t, true);
                  }}
                    title={`${DEMO_TYPE_LABELS[t]} — ${DEMO_TYPE_TEMPLATES[t].scenes.length} scener · ~${DEMO_TYPE_TEMPLATES[t].targetSeconds}s`}
                    style={{ aspectRatio: '1.15', border: `1px solid ${project.demoType === t ? C.accent : C.line}`, borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', color: C.inkSoft, background: project.demoType === t ? C.cream : '#fff' }}>
                    <div style={{ fontSize: 20 }}>{DEMO_TYPE_ICON[t]}</div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: C.ink }}>{DEMO_TYPE_LABELS[t].split(' ')[0]}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, marginTop: 18 }}>Lagrede maler <span style={{ color: C.inkFaint }}>›</span></div>
            </div>

            {/* ── Center: LIVE device preview ── */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: C.bg, overflowY: 'auto', padding: '16px 22px' }}>
              <div style={{ display: 'flex', gap: 4, alignSelf: 'center', background: '#fff', border: `1px solid ${C.line}`, borderRadius: 9, padding: 3, marginBottom: 14 }}>
                {(['macbook', 'ipad', 'iphone'] as DemoDevice[]).map((d) => (
                  <div key={d} onClick={() => selected && setSceneDevice(selected.id, d)} title={DEVICE_LABEL[d]}
                    style={{ minWidth: 40, height: 28, display: 'grid', placeItems: 'center', borderRadius: 6, cursor: 'pointer', fontSize: 11, padding: '0 8px',
                      background: previewDevice === d ? C.creamActive : 'transparent', color: previewDevice === d ? C.ink : C.inkFaint }}>
                    {DEVICE_LABEL[d]}
                  </div>
                ))}
              </div>

              {/* Live preview i EKTE device-ramme (samme som Guided Recorder/eksport) */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto',
                width: previewVariant === 'macbook' ? '78%' : previewVariant === 'ipad_landscape' ? '64%' : previewVariant === 'ipad' ? '42%' : '26%',
                maxWidth: previewVariant === 'macbook' ? 640 : previewVariant === 'ipad_landscape' ? 560 : previewVariant === 'ipad' ? 360 : 230,
              }}>
                <FramedDevice variant={previewVariant} url={project.url} width="100%" />
              </div>

              {/* Scene-flow-kort */}
              <div style={{ marginTop: 22 }}>
                <h3 style={{ fontSize: 16, marginBottom: 6 }}>Demo-flow</h3>
                <div style={{ fontSize: 12.5, color: C.inkSoft, marginBottom: 14 }}>Scenene settes sammen til én produktvideo. Klikk for å redigere. Du styrer opptaket steg for steg.</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
                  {scenes.map((s) => (
                    <div key={s.id} onClick={() => { selectScene(s.id); if (recording) goToStep(s.index); }}
                      style={{ border: `2px solid ${s.id === selectedSceneId ? C.accent : C.line}`, borderRadius: 10, padding: 10, cursor: 'pointer', background: '#fff' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: 11 }}>{s.index + 1}</span>
                        <span style={{ fontSize: 10, color: C.inkFaint }}>{DEVICE_LABEL[s.device]}</span>
                        <div style={{ flex: 1 }} />
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: SCENE_STATUS_COLORS[s.status] }} />
                      </div>
                      <div style={{ height: 52, borderRadius: 7, background: '#e7ded2', marginBottom: 8 }} />
                      <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</div>
                      <div style={{ fontSize: 11, color: C.inkFaint }}>{fmt(s.duration)} · {SCENE_STATUS_LABELS[s.status]}</div>
                    </div>
                  ))}
                  <div onClick={() => addScene(scenes.length - 1)}
                    style={{ border: `1px dashed ${C.lineStrong}`, borderRadius: 10, display: 'grid', placeItems: 'center', cursor: 'pointer', color: C.inkSoft, fontSize: 22, minHeight: 110 }}>+</div>
                </div>
              </div>
            </div>

            {/* ── Right: scene settings (editerbar) ── */}
            <div style={{ width: 320, background: C.panel, borderLeft: `1px solid ${C.line}`, padding: 16, flexShrink: 0, overflowY: 'auto' }}>
              {recording && recorderScene ? (
                /* Guided recorder teleprompter */
                <>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', color: C.inkSoft, letterSpacing: 0.5 }}>Steg {recorderStepIndex + 1} av {scenes.length}</div>
                  <div style={{ height: 4, background: '#eee4d8', borderRadius: 2, margin: '6px 0 12px' }}>
                    <div style={{ height: '100%', width: `${((recorderStepIndex + 1) / scenes.length) * 100}%`, background: C.accent, borderRadius: 2 }} />
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 10px' }}>{recorderScene.title}</h3>
                  <div style={fldLabel}>Narration</div>
                  <div style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 14, whiteSpace: 'pre-wrap' }}>{recorderScene.narration || <em style={{ color: C.inkFaint }}>(ingen manus)</em>}</div>
                  <div style={fldLabel}>Required action</div>
                  <div style={{ fontSize: 14, marginBottom: 14 }}>{recorderScene.requiredAction || <em style={{ color: C.inkFaint }}>(ingen)</em>}</div>
                  <span style={{ ...chip, background: SCENE_STATUS_COLORS[recorderScene.status] }}>{SCENE_STATUS_LABELS[recorderScene.status]}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: rec.state === 'recording' ? '#ef4444' : C.inkSoft, margin: '14px 0' }}>
                    {rec.state === 'recording' && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />}
                    {rec.state === 'recording' ? 'Tar opp denne scenen…' : rec.state === 'saving' ? 'Lagrer opptak…' : 'Opptaket venter. Systemet går ikke videre før du bekrefter.'}
                  </div>
                  {rec.error && <div style={{ fontSize: 11.5, color: '#c4453b', marginBottom: 10 }}>{rec.error}</div>}
                  {recorderScene.recordingPath && <div style={{ fontSize: 11, color: C.green, marginBottom: 10 }}>✓ Opptak lagret</div>}
                  <button style={{ ...primaryBtn, background: C.green, width: '100%', marginBottom: 8, opacity: rec.state === 'saving' ? 0.6 : 1 }}
                    disabled={rec.state === 'saving'}
                    onClick={async () => {
                      // Stopp + lagre opptak, sett recordingPath, marker done, gå videre + start neste opptak.
                      if (rec.state === 'recording') {
                        const path = await rec.stopAndSave(project.id, recorderScene.id);
                        if (path) updateScene(recorderScene.id, { recordingPath: path });
                      }
                      markCurrentDone();
                      if (recorderStepIndex < scenes.length - 1) {
                        nextStep();
                        await startForCurrent();
                      } else {
                        setRecording(false);
                      }
                    }}>✓ Mark as Done</button>
                  <button style={{ ...outlineBtn, width: '100%', marginBottom: 8 }}
                    onClick={async () => { retakeCurrent(); await startForCurrent(); }}>↺ Retake</button>
                  <button style={{ ...outlineBtn, width: '100%', marginBottom: 8, opacity: recorderStepIndex >= scenes.length - 1 ? 0.5 : 1 }} disabled={recorderStepIndex >= scenes.length - 1}
                    onClick={async () => { if (rec.state === 'recording') await rec.stopAndSave(project.id, recorderScene.id).then((pth) => pth && updateScene(recorderScene.id, { recordingPath: pth })); nextStep(); await startForCurrent(); }}>→ Next Step</button>
                  <button style={{ ...outlineBtn, width: '100%' }} onClick={() => { rec.cancel(); setRecording(false); }}>Avslutt opptak</button>
                </>
              ) : selected ? (
                <>
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Scene-innstillinger</h3>
                  <div style={{ display: 'flex', gap: 18, borderBottom: `1px solid ${C.line}`, marginBottom: 16 }}>
                    {(['Guide', 'Script', 'Notes'] as const).map((t) => (
                      <div key={t} onClick={() => setTab(t)} style={{ fontSize: 13, paddingBottom: 9, cursor: 'pointer', color: tab === t ? C.ink : C.inkFaint, fontWeight: tab === t ? 600 : 400, borderBottom: tab === t ? `2px solid ${C.ink}` : '2px solid transparent' }}>{t}</div>
                    ))}
                  </div>

                  <div style={fldLabel}>Scene-tittel</div>
                  <input style={field} value={selected.title} onChange={(e) => updateScene(selected.id, { title: e.target.value })} />

                  <div style={fldLabel}>{tab === 'Notes' ? 'Notater' : 'Manus / narration'}</div>
                  <textarea style={{ ...field, height: 70, resize: 'vertical', fontFamily: 'inherit' }} value={selected.narration}
                    placeholder="Hva som skal sies i denne scenen…" onChange={(e) => updateScene(selected.id, { narration: e.target.value })} />

                  <div style={row2}>
                    <div><div style={fldLabel}>Enhet</div>
                      <select style={field} value={selected.device} onChange={(e) => setSceneDevice(selected.id, e.target.value as DemoDevice)}>
                        {(['macbook', 'ipad', 'iphone'] as DemoDevice[]).map((d) => <option key={d} value={d}>{DEVICE_LABEL[d]}</option>)}
                      </select>
                    </div>
                    <div><div style={fldLabel}>Varighet (s)</div>
                      <input style={field} type="number" value={selected.duration} onChange={(e) => updateScene(selected.id, { duration: Number(e.target.value) || 0 })} />
                    </div>
                  </div>

                  <div style={fldLabel}>Required action</div>
                  <input style={field} value={selected.requiredAction} placeholder="F.eks. Click the Start button" onChange={(e) => updateScene(selected.id, { requiredAction: e.target.value })} />

                  <div style={fldLabel}>Overlay-tekst</div>
                  <input style={field} value={selected.overlayText ?? ''} onChange={(e) => updateScene(selected.id, { overlayText: e.target.value })} />

                  <div style={fldLabel}>Progresjon</div>
                  <div style={{ ...sel, background: C.cream }}>continueMode: manual — venter på deg</div>

                  <button style={{ ...outlineBtn, width: '100%', marginTop: 14, color: '#c4453b', borderColor: '#e6c5c2' }}
                    disabled={scenes.length <= 1} onClick={() => removeScene(selected.id)}>Slett scene</button>
                </>
              ) : null}
            </div>
          </>
        )}
      </div>

      {/* ── Bottom: stat cards ── */}
      {!storyMode && nav !== 'export' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 1, background: C.line, borderTop: `1px solid ${C.line}`, flexShrink: 0 }}>
          <Stat h="⚇ Devices" v={[...new Set(scenes.map((s) => DEVICE_LABEL[s.device]))].join(' · ')} link="Endre →" />
          <Stat h="▦ Scener" v={`${scenes.length} scener`} s={`${doneCount} ferdig`} />
          <Stat h="⏱ Varighet" v={`${fmt(totalDuration(scenes))} total`} s="Anbefalt 60–90 s" />
          <Stat h="◷ Opptak" v={recording ? `Steg ${recorderStepIndex + 1} av ${scenes.length}` : 'Ikke startet'} s={recording ? 'Venter på deg' : 'Trykk Record'} />
          <Stat h="⤓ Format" v={`${project.format} · 1080p`} link="Eksport →" />
          <div style={{ background: C.panel, padding: '13px 15px' }}>
            <div style={{ width: 42, height: 42, borderRadius: '50%', border: `3px solid ${C.green}`, display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700, float: 'right' }}>{Math.round((doneCount / Math.max(scenes.length, 1)) * 100)}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.inkSoft, marginBottom: 7 }}>✓ Demo-score</div>
            <div style={{ fontSize: 11, color: C.inkFaint, marginTop: 3 }}>{doneCount === scenes.length ? 'Klar for eksport' : 'Ta opp scener'}</div>
          </div>
        </div>
      )}
      {showSignIn && (
        <RoleRoomSignInDialog onClose={() => setShowSignIn(false)} onSignedIn={() => { setAiReady(true); setShowSignIn(false); }} />
      )}
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

const topbarStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 14, height: 60, padding: '0 18px', background: C.panel, borderBottom: `1px solid ${C.line}`, flexShrink: 0 };
const iconBtn: React.CSSProperties = { width: 30, height: 30, display: 'grid', placeItems: 'center', borderRadius: 8, color: C.inkSoft, cursor: 'pointer' };
const btn: React.CSSProperties = { border: `1px solid ${C.lineStrong}`, background: '#fff', borderRadius: 9, padding: '8px 13px', fontSize: 12.5, fontWeight: 600, color: C.ink, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 };
const primaryBtn: React.CSSProperties = { background: 'linear-gradient(135deg, #ef8a5d, #d96a3a)', border: 0, color: '#fff', fontSize: 13, fontWeight: 600, padding: '10px 18px', borderRadius: 8, cursor: 'pointer' };
const outlineBtn: React.CSSProperties = { background: '#fff', border: `1px solid ${C.lineStrong}`, color: C.ink, fontSize: 13, padding: '9px 14px', borderRadius: 8, cursor: 'pointer' };
const fldLabel: React.CSSProperties = { fontSize: 11, color: C.inkSoft, margin: '14px 0 6px', fontWeight: 600 };
const field: React.CSSProperties = { width: '100%', border: `1px solid ${C.lineStrong}`, borderRadius: 8, padding: '8px 10px', fontSize: 12.5, color: C.ink, background: '#fff', fontFamily: 'inherit', boxSizing: 'border-box' };
const titleField: React.CSSProperties = { background: 'transparent', border: 0, color: C.ink, fontSize: 15, fontWeight: 700, padding: 0, outline: 'none', minWidth: 140 };
const sel: React.CSSProperties = { border: `1px solid ${C.lineStrong}`, borderRadius: 8, padding: '8px 10px', fontSize: 12.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' };
const row2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 };
const chip: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#fff', padding: '2px 8px', borderRadius: 10, display: 'inline-block' };

export default DemoStudioShell;
