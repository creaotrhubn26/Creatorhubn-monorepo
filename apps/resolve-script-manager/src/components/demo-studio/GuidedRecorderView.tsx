/**
 * GuidedRecorderView — piksel-matchet Guided Recorder (fasit: Daniels mockup
 * + spec §2.4/§3.4). Kjernen i Product Demo Studio.
 *
 * Layout: mørk sidebar · topbar (URL + device-toggle + Generate Demo Flow +
 * Record) · device-trio-preview i senter (Mac+iPad+iPhone) m/ "Recording
 * Paused"-badge · høyre Guide/Script/Notes-panel med Step X of N, Narration,
 * REQUIRED ACTION (m/ knapp-preview) + Retake/Mark as Done/Next Step · bunn
 * scene-timeline.
 *
 * Required Action er sentral: den viser HVA opptakeren skal gjøre (action-type
 * + instruksjon + visuelt mål-element), og opptaket VENTER alltid på manuell
 * bekreftelse (continueMode: manual). Bruker useSceneRecorder for ekte opptak.
 */

import { useEffect, useRef, useState } from 'react';
import { useDemoStudio } from './demoStudioStore';
import { useSceneRecorder } from './useSceneRecorder';
import { listCaptureSources, recordAvfoundation, recordSimulator, recordIphoneMirroring, checkUrlEmbeddable, type CaptureSource } from '../../api';
import { DeviceConnectGuide } from './DeviceConnectGuide';
import { type FrameVariant } from './deviceFrames';
import { FramedDevice } from './FramedDevice';
import { ACTION_META, SCENE_STATUS_LABELS, SCENE_STATUS_COLORS, type DemoDevice } from './demoStudioModel';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const C = {
  navBg: '#1c1a18', navText: '#cbc6bf', navActive: '#2a2724',
  bg: '#f6f3ee', panel: '#ffffff', cream: '#faf7f2', line: '#eae5dd', lineStrong: '#ddd6cc',
  ink: '#1d1b19', inkSoft: '#6b6358', inkFaint: '#9a9186', accent: '#ef8a5d', dark: '#2f2a26',
  green: '#4a9d6b', red: '#d9534f', amber: '#e0922f', deviceFrame: '#2a2a2e',
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

function fmt(sec: number) {
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function GuidedRecorderView({ onNav }: { onNav?: (id: string) => void } = {}) {
  const {
    project, recorderStepIndex, selectScene, goToStep,
    startRecorder, nextStep, markCurrentDone, retakeCurrent, updateScene, setProjectField, addScene,
  } = useDemoStudio();
  const rec = useSceneRecorder();
  const macFrameRef = useRef<HTMLIFrameElement | null>(null);
  const autoAbort = useRef(false);
  const [autoRunning, setAutoRunning] = useState(false);
  const [sources, setSources] = useState<CaptureSource[]>([]);
  const [sourceMenu, setSourceMenu] = useState(false);
  const [showConnectGuide, setShowConnectGuide] = useState(false);
  const [embedBlocked, setEmbedBlocked] = useState<string | null>(null);
  const [nativeError, setNativeError] = useState<string | null>(null);

  // Oppdater capture-kilder ved mount (Mac-skjerm / kablede iOS-enheter / sim).
  useEffect(() => { listCaptureSources().then(setSources).catch(() => setSources([])); }, []);

  // Frigjør skjermdelings-streamen når man forlater Guided Recorder.
  useEffect(() => () => rec.release(), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Advar hvis nettsiden ikke kan bygges inn i <iframe> (X-Frame-Options/CSP):
  // ellers tas svart skjerm opp stille ved web-opptak.
  const checkUrl = project?.url;
  const checkKind = project?.captureKind ?? 'web';
  useEffect(() => {
    if (checkKind !== 'web' || !checkUrl) { setEmbedBlocked(null); return; }
    let cancelled = false;
    checkUrlEmbeddable(checkUrl).then((r) => { if (!cancelled) setEmbedBlocked(r.embeddable ? null : r.reason); }).catch(() => {});
    return () => { cancelled = true; };
  }, [checkUrl, checkKind]);

  if (!project) return <div style={{ padding: 40, fontFamily: C.font, color: C.inkSoft }}>Opprett en demo først.</div>;

  const scenes = project.scenes;
  const cur = scenes[recorderStepIndex] ?? scenes[0];
  const recording = rec.state === 'recording';
  const actionMeta = ACTION_META[cur?.actionType ?? 'click'];
  const autoMode = (project.continueMode ?? 'manual') === 'auto';
  const captureKind = project.captureKind ?? 'web';
  const isNativeCapture = captureKind === 'ios_device' || captureKind === 'mac_screen' || captureKind === 'ios_simulator' || captureKind === 'iphone_mirroring';

  // Valgt forhåndsvisnings-enhet (én om gangen). Dropdown setter den direkte
  // på alle scener — ingen modal. iPad kan vises stående eller liggende.
  // Orienteringen LAGRES på scenene (scene.orientation) så eksport/opptak
  // også bruker liggende iPad.
  const previewDevice: DemoDevice = cur?.device ?? 'macbook';
  const ipadLandscape = previewDevice === 'ipad' && cur?.orientation === 'landscape';
  const previewVariant: FrameVariant = ipadLandscape ? 'ipad_landscape' : previewDevice;
  const dropdownValue = ipadLandscape ? 'ipad_landscape' : previewDevice;
  const setDeviceForAll = (v: DemoDevice, orientation: 'portrait' | 'landscape' = 'portrait') =>
    scenes.forEach((s) => updateScene(s.id, {
      device: v, viewport: v === 'macbook' ? 'desktop' : v === 'ipad' ? 'tablet' : 'mobile', orientation,
    }));
  const onPickDevice = (val: string) => {
    if (val === 'ipad_landscape') setDeviceForAll('ipad', 'landscape');
    else setDeviceForAll(val as DemoDevice, 'portrait');
  };

  /** Ta opp gjeldende scene fra valgt native capture-kilde (Rust → ffmpeg/simctl). */
  const recordNativeScene = async (sceneId: string): Promise<string | null> => {
    const dur = Math.min(Math.max(cur?.duration ?? 8, 2), 120);
    try {
      if (captureKind === 'ios_simulator') {
        return await recordSimulator(project.id, sceneId, project.captureSourceId ?? '', dur);
      }
      if (captureKind === 'iphone_mirroring') {
        // Fanges som skjerm-capture, men cropes til iPhone Mirroring-vinduet.
        const screenIdx = sources.find((s) => s.kind === 'mac_screen')?.id ?? '0';
        return await recordIphoneMirroring(project.id, sceneId, screenIdx, dur);
      }
      // ios_device + mac_screen bruker sin egen AVFoundation-indeks direkte.
      return await recordAvfoundation(project.id, sceneId, project.captureSourceId ?? '0', dur);
    } catch (e) {
      // Rust gir meningsfulle feil («ffmpeg ikke funnet», «er enheten kablet + trusted?»).
      setNativeError(String((e as Error)?.message ?? e));
      return null;
    }
  };

  const pickSource = (s: CaptureSource | null) => {
    setSourceMenu(false);
    if (!s) { setProjectField('captureKind', 'web'); setProjectField('captureSourceId', undefined); setProjectField('captureSourceLabel', undefined); return; }
    setProjectField('captureKind', s.kind);
    setProjectField('captureSourceId', s.id);
    setProjectField('captureSourceLabel', s.label);
  };

  /**
   * Utfør én scenes required action i Mac-preview-iframen (best-effort).
   * Same-origin kreves for DOM-tilgang; cross-origin → vi simulerer kun
   * scroll/wait på toppnivå. Aldri fatal.
   */
  const performAction = async (scene: typeof cur) => {
    const type = scene.actionType ?? 'click';
    const win = macFrameRef.current?.contentWindow;
    const doc = (() => { try { return macFrameRef.current?.contentDocument ?? null; } catch { return null; } })();
    try {
      if (type === 'scroll') {
        win?.scrollBy({ top: 500, behavior: 'smooth' });
      } else if ((type === 'click' || type === 'hover' || type === 'highlight') && doc) {
        const label = targetLabel(scene.requiredAction).toLowerCase();
        const el = Array.from(doc.querySelectorAll('a,button,[role=button]'))
          .find((e) => (e.textContent ?? '').toLowerCase().includes(label)) as HTMLElement | undefined;
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.style.outline = '3px solid #ef8a5d'; el.style.outlineOffset = '2px';
          await sleep(500);
          if (type === 'click') el.click();
        }
      }
    } catch { /* cross-origin/blokkert — hopp over */ }
  };

  /** Les gjeldende scene FERSKT fra storen (unngår stale closure-indeks). */
  const freshCurrent = () => {
    const st = useDemoStudio.getState();
    return st.project ? st.project.scenes[st.recorderStepIndex] ?? null : null;
  };
  /** Start web-opptak for scenen brukeren faktisk står på nå. */
  const startForCurrent = async () => {
    const st = useDemoStudio.getState();
    const sc = st.project?.scenes[st.recorderStepIndex];
    if (sc && st.project) await rec.start(st.project.id, sc.id);
  };

  const beginRecording = async () => {
    setNativeError(null);
    startRecorder();
    const sc = freshCurrent() ?? cur;
    if (isNativeCapture) {
      // Native: ta opp gjeldende scene fra valgt enhet/simulator (blokkerer
      // til varigheten er nådd), sett recordingPath.
      const path = await recordNativeScene(sc.id);
      if (path) updateScene(sc.id, { recordingPath: path });
    } else {
      await startForCurrent();
      if (autoMode) void runAuto();
    }
  };

  /** Auto-løp: kjør hver scene sin handling, vent varighet, gå videre. */
  const runAuto = async () => {
    autoAbort.current = false;
    setAutoRunning(true);
    for (let i = recorderStepIndex; i < scenes.length; i++) {
      if (autoAbort.current) break;
      goToStep(i);
      const scene = scenes[i];
      await sleep(400);
      await performAction(scene);
      // Vent scenens varighet (cap for å unngå evig venting).
      await sleep(Math.min(Math.max((scene.duration || 6) * 1000, 1500), 20000));
      if (autoAbort.current) break;
      if (rec.state === 'recording') {
        const path = await rec.stopAndSave(project.id, scene.id);
        if (path) updateScene(scene.id, { recordingPath: path });
      }
      markCurrentDone();
      if (i < scenes.length - 1) { nextStep(); await startForCurrent(); }
    }
    setAutoRunning(false);
  };

  const doneAndNext = async () => {
    const sc = freshCurrent() ?? cur;
    if (isNativeCapture) {
      // Native: opptak skjer per scene via recordNativeScene (allerede lagret).
      markCurrentDone();
      nextStep();
      const next = freshCurrent();
      if (next && next.id !== sc.id) {
        const path = await recordNativeScene(next.id);
        if (path) updateScene(next.id, { recordingPath: path });
      }
      return;
    }
    if (rec.state === 'recording') {
      const path = await rec.stopAndSave(project.id, sc.id);
      if (path) updateScene(sc.id, { recordingPath: path });
    }
    markCurrentDone();
    if (recorderStepIndex < scenes.length - 1) { nextStep(); await startForCurrent(); }
  };

  const toggleMode = () => {
    const next = autoMode ? 'manual' : 'auto';
    setProjectField('continueMode', next);
    if (next === 'manual') autoAbort.current = true;
  };

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0, fontFamily: C.font, fontSize: 13, color: C.ink, background: C.bg }}>
      {/* ── Left nav (mørk) ── */}
      <div style={{ width: 210, background: C.navBg, color: C.navText, display: 'flex', flexDirection: 'column', flexShrink: 0, padding: '14px 12px' }}>
        <div style={{ padding: '4px 8px 16px' }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: C.accent, display: 'grid', placeItems: 'center', color: '#fff' }}>▶</div>
        </div>
        {NAV.map((it) => (
          <div key={it.id} onClick={() => onNav?.(it.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 11px', borderRadius: 9, fontSize: 13, cursor: 'pointer', marginBottom: 2,
              background: it.id === 'recorder' ? C.navActive : 'transparent', color: it.id === 'recorder' ? '#fff' : C.navText, fontWeight: it.id === 'recorder' ? 600 : 500 }}>
            <span style={{ width: 18, opacity: 0.85 }}>{it.ic}</span> {it.label}
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ borderTop: '1px solid #34302b', paddingTop: 10, marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: C.inkFaint }}>Demo Project</div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: '#e8e3db' }}>{project.name} ⌄</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, paddingTop: 8, borderTop: '1px solid #34302b' }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#3b5bdb', display: 'grid', placeItems: 'center', color: '#fff', fontSize: 11, fontWeight: 700 }}>JD</div>
          <div><div style={{ fontSize: 12.5, fontWeight: 600, color: '#e8e3db' }}>Jamie Davis</div><div style={{ fontSize: 11, color: C.inkFaint }}>Pro Plan</div></div>
        </div>
      </div>

      {/* ── Main column ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Topbar: URL + device-toggle + Generate + Record */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', background: C.panel, borderBottom: `1px solid ${C.line}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${C.lineStrong}`, borderRadius: 10, padding: '8px 12px', flex: 1, maxWidth: 360 }}>
            <span style={{ color: C.inkFaint }}>🌐</span>
            <input style={{ flex: 1, border: 0, outline: 'none', fontSize: 13, color: C.ink }} value={project.url}
              onChange={(e) => setProjectField('url', e.target.value)} />
            <span style={{ color: C.inkFaint, cursor: 'pointer' }}>✕</span>
          </div>

          {/* Capture-kilde-velger: web / Mac-skjerm / kablet iOS / simulator */}
          <div style={{ position: 'relative' }}>
            <button style={btn} onClick={() => setSourceMenu((v) => !v)} title="Hva tas opp">
              {captureKind === 'web' ? '🌐 Web' : captureKind === 'mac_screen' ? '🖥 Mac' : captureKind === 'ios_simulator' ? '⊞ Simulator' : captureKind === 'iphone_mirroring' ? '📡 Mirroring' : '📱 ' + (project.captureSourceLabel ?? 'iOS')} ⌄
            </button>
            {sourceMenu && (
              <div style={{ position: 'absolute', top: 40, left: 0, zIndex: 20, background: '#fff', border: `1px solid ${C.lineStrong}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 260, padding: 6 }}>
                <SourceItem label="🌐 Web-app (URL)" sub="iframe-preview av nettsiden" onClick={() => pickSource(null)} active={captureKind === 'web'} />
                {sources.map((s) => (
                  <SourceItem key={s.kind + s.id}
                    label={`${s.kind === 'mac_screen' ? '🖥' : s.kind === 'ios_simulator' ? '⊞' : s.kind === 'iphone_mirroring' ? '📡' : '📱'} ${s.label}`}
                    sub={s.kind === 'ios_device' ? 'Kablet enhet — funker med App Store-apper'
                      : s.kind === 'ios_simulator' ? 'Simulator — kun egne Xcode-bygg'
                      : s.kind === 'iphone_mirroring' ? (s.available ? 'Trådløst — speiler iPhone (åpen)' : 'Trådløst — åpne appen først')
                      : 'Mac-skjerm'}
                    onClick={() => pickSource(s)} active={project.captureSourceId === s.id && captureKind === s.kind} />
                ))}
                <div onClick={() => { setSourceMenu(false); setShowConnectGuide(true); }}
                  style={{ fontSize: 11.5, color: C.accent, fontWeight: 600, padding: '8px 10px 4px', cursor: 'pointer' }}>
                  ▶ Hvordan koble til iPhone/iPad?
                </div>
                <div style={{ fontSize: 10.5, color: C.inkFaint, padding: '0 10px 4px', lineHeight: 1.4 }}>
                  App Store-apper tas opp via kablet enhet.
                </div>
              </div>
            )}
          </div>
          {/* Velg opptaks-enhet direkte (ingen modal) — bytter forhåndsvisningen */}
          <select style={{ ...btn, paddingRight: 28 }} value={dropdownValue}
            onChange={(e) => onPickDevice(e.target.value)} title="Velg opptaks-enhet">
            <option value="macbook">MacBook</option>
            <option value="ipad">iPad (stående)</option>
            <option value="ipad_landscape">iPad (liggende)</option>
            <option value="iphone">iPhone</option>
          </select>
          <div style={{ flex: 1 }} />
          {/* Auto/Manual-toggle — Auto er kun meningsfull for web (native styres av varighet) */}
          {!isNativeCapture && (
          <div style={{ display: 'flex', border: `1px solid ${C.lineStrong}`, borderRadius: 10, overflow: 'hidden' }} title="Manuell: du styrer hvert steg. Auto: best-effort auto-fremdrift (fungerer kun på same-origin web).">
            <div onClick={() => autoMode && toggleMode()} style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: !autoMode ? C.dark : '#fff', color: !autoMode ? '#fff' : C.inkSoft }}>Manual</div>
            <div onClick={() => !autoMode && toggleMode()} style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: autoMode ? C.accent : '#fff', color: autoMode ? '#fff' : C.inkSoft }}>✦ Auto</div>
          </div>
          )}
          {(() => { const webBlocked = captureKind === 'web' && !!embedBlocked; return (
          <button style={{ ...btn, background: C.dark, color: '#fff', borderColor: C.dark, opacity: webBlocked ? 0.5 : 1, cursor: webBlocked ? 'not-allowed' : 'pointer' }}
            disabled={webBlocked}
            title={webBlocked ? 'Denne siden kan ikke bygges inn — velg Mac-skjerm/native capture' : undefined}
            onClick={() => { if (!recording && !webBlocked) void beginRecording(); }}>
            ● {recording ? 'Recording' : rec.state === 'saving' ? 'Lagrer…' : 'Record'} <span>⌄</span>
          </button>); })()}
        </div>

        {/* Body: device-trio + Guide-panel */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {/* Device-trio preview */}
          <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg,#f6f3ee,#efe9e0)', minWidth: 0, overflow: 'hidden' }}>
            {/* Advarsel: siden tillater ikke innbygging → web-opptak gir svart skjerm */}
            {captureKind === 'web' && embedBlocked && (
              <div style={{ position: 'absolute', top: 16, left: 16, right: 16, zIndex: 5, background: '#fdeee0', border: `1px solid #f0c9a8`, borderRadius: 10, padding: '10px 14px', fontSize: 12.5, color: '#8a4b15', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <strong>Denne siden tillater ikke innbygging</strong> ({embedBlocked}). Web-opptak ville blitt svart skjerm — velg <strong>Mac-skjerm</strong> eller en native capture-kilde i kilde-menyen i stedet.
              </div>
            )}
            {/* Native opptaksfeil (ffmpeg mangler / enhet ikke kablet/trusted) */}
            {nativeError && (
              <div style={{ position: 'absolute', top: 16, left: 16, right: 16, zIndex: 6, background: '#fdecea', border: `1px solid #f0bcb6`, borderRadius: 10, padding: '10px 14px', fontSize: 12.5, color: C.red, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <strong>Opptak feilet:</strong> {nativeError.includes('ffmpeg') ? 'ffmpeg ikke funnet — installer ffmpeg.' : (nativeError.toLowerCase().includes('device') || nativeError.toLowerCase().includes('enhet')) ? 'Fant ikke enheten — er den kablet til og «Trust» bekreftet?' : nativeError}
              </div>
            )}
            {/* Recording status-badge */}
            {(recording || cur?.recordingPath) && (
              <div style={{ position: 'absolute', top: 16, left: 16, display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 10, padding: '8px 12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: recording ? C.red : C.amber }} />
                <span style={{ fontSize: 12, fontWeight: 600 }}>{recording ? 'Recording' : 'Recording Paused'}</span>
                <span style={{ fontSize: 12, color: C.inkFaint }}>{fmt(cur?.duration ?? 0)}</span>
              </div>
            )}
            {/* Én enhet om gangen — den valgte. Live <iframe> over rammen,
                klippet til skjerm-hullet. Bredde tilpasset enhets-formatet
                (landskap-iPad er bredere enn stående). */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: previewVariant === 'macbook' ? '66%' : previewVariant === 'ipad_landscape' ? '56%' : previewVariant === 'ipad' ? '34%' : '20%',
              maxWidth: previewVariant === 'macbook' ? 820 : previewVariant === 'ipad_landscape' ? 700 : previewVariant === 'ipad' ? 430 : 270,
              maxHeight: '88%',
            }}>
              <FramedDevice variant={previewVariant} url={project.url} width="100%" iframeRef={macFrameRef} />
            </div>
          </div>

          {/* Guide-panel (høyre) */}
          <div style={{ width: 360, flexShrink: 0, background: C.panel, borderLeft: `1px solid ${C.line}`, display: 'flex', flexDirection: 'column' }}>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 18, padding: '14px 18px 0', borderBottom: `1px solid ${C.line}` }}>
              {['Guide', 'Script', 'Notes'].map((t, i) => (
                <div key={t} style={{ fontSize: 13, paddingBottom: 11, color: i === 0 ? C.ink : C.inkFaint, fontWeight: i === 0 ? 600 : 400, borderBottom: i === 0 ? `2px solid ${C.ink}` : '2px solid transparent', cursor: 'pointer' }}>{t}</div>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
              {/* Step header */}
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 17, fontWeight: 700 }}>Step {recorderStepIndex + 1} of {scenes.length}</span>
                <div style={{ flex: 1 }} />
                <span style={{ ...statusChip, background: recording ? '#fdeee0' : '#fdf3e7', color: recording ? C.red : C.amber }}>
                  {recording ? '● Recording' : '❚❚ Recording Paused'}
                </span>
              </div>
              {/* Progress-segmenter */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
                {scenes.map((s, i) => <div key={s.id} style={{ flex: 1, height: 4, borderRadius: 2, background: i < recorderStepIndex ? C.green : i === recorderStepIndex ? C.accent : '#e8e1d6' }} />)}
              </div>

              {/* Narration */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Narration</span>
                <div style={{ flex: 1 }} /><span style={{ color: C.inkFaint, cursor: 'pointer' }}>✎</span>
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.5, color: C.ink, marginBottom: 22 }}>
                {cur?.narration || <em style={{ color: C.inkFaint }}>(ingen narration — generér i Script Builder)</em>}
              </div>

              {/* REQUIRED ACTION */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Required Action</span>
                <div style={{ flex: 1 }} /><span style={{ color: C.inkFaint, cursor: 'pointer' }}>⚙</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', border: `1.5px solid ${C.lineStrong}`, display: 'grid', placeItems: 'center', fontSize: 11, color: C.inkSoft }}>{actionMeta.icon}</span>
                <span style={{ fontSize: 13.5 }}>{cur?.requiredAction || `${actionMeta.verb} elementet`}</span>
              </div>
              {/* Action-preview: mål-element vist som knapp (slik mockupen viser knappen) */}
              <div style={{ display: 'flex', gap: 10, border: `1px solid ${C.line}`, borderRadius: 10, padding: 14, marginBottom: 16, background: C.cream }}>
                <button style={{ background: C.dark, color: '#fff', border: 0, borderRadius: 8, padding: '8px 14px', fontSize: 12.5, fontWeight: 600, outline: `2px solid ${C.accent}`, outlineOffset: 2 }}>
                  {targetLabel(cur?.requiredAction)} →
                </button>
                <button style={{ background: '#fff', color: C.ink, border: `1px solid ${C.lineStrong}`, borderRadius: 8, padding: '8px 14px', fontSize: 12.5 }}>Request a demo</button>
              </div>

              {/* Status-boks: auto-løp vs manuell pause */}
              {autoRunning ? (
                <div style={{ display: 'flex', gap: 10, background: '#fdeee0', border: `1px solid ${C.accent}`, borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                  <span style={{ color: C.accent }}>✦</span>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: '#a85a2a' }}>Auto-modus kjører</div>
                    <div style={{ fontSize: 11.5, color: '#b06a3a' }}>Auto-fremdrift: best-effort handlinger på same-origin web; ellers venter den varigheten og går videre.</div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 10, background: '#fdf3e7', border: '1px solid #f0d9b8', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                  <span style={{ color: C.amber }}>❚❚</span>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: '#8a6515' }}>{recording ? 'Tar opp denne scenen' : autoMode ? 'Auto-modus klar' : 'Recording is paused'}</div>
                    <div style={{ fontSize: 11.5, color: '#a07a2a' }}>{autoMode ? 'Trykk Record — systemet kjører gjennom scenene automatisk.' : 'Demoen venter her til du markerer steget som ferdig.'}</div>
                  </div>
                </div>
              )}
              {rec.error && <div style={{ fontSize: 11.5, color: C.red, marginBottom: 10 }}>{rec.error}</div>}
              {cur?.recordingPath && <div style={{ fontSize: 11.5, color: C.green, marginBottom: 10 }}>✓ Opptak lagret</div>}
            </div>

            {/* Bunn-knapper */}
            <div style={{ padding: 16, borderTop: `1px solid ${C.line}` }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <button style={{ ...outlineBtn, flex: 1 }} onClick={async () => { retakeCurrent(); await startForCurrent(); }}>↺ Retake</button>
                <button style={{ ...darkBtn, flex: 1, opacity: rec.state === 'saving' ? 0.6 : 1 }} disabled={rec.state === 'saving'} onClick={() => void doneAndNext()}>✓ Mark as Done</button>
              </div>
              <button style={{ ...darkBtn, width: '100%', opacity: recorderStepIndex >= scenes.length - 1 ? 0.5 : 1 }} disabled={recorderStepIndex >= scenes.length - 1}
                onClick={() => void doneAndNext()}>
                Next Step →
              </button>
            </div>
          </div>
        </div>

        {/* Bunn scene-timeline */}
        <div style={{ display: 'flex', gap: 10, padding: 12, borderTop: `1px solid ${C.line}`, background: C.panel, overflowX: 'auto', alignItems: 'center' }}>
          {scenes.map((s, i) => (
            <div key={s.id} onClick={() => { selectScene(s.id); goToStep(i); }}
              style={{ minWidth: 140, padding: 10, borderRadius: 10, cursor: 'pointer', border: `2px solid ${i === recorderStepIndex ? C.accent : C.line}`, background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 11 }}>{i + 1}</span>
                <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</span>
              </div>
              <div style={{ height: 48, borderRadius: 7, background: C.cream, marginBottom: 8 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: SCENE_STATUS_COLORS[s.status] }} />
                <span style={{ color: C.inkSoft }}>{SCENE_STATUS_LABELS[s.status]}</span>
                <div style={{ flex: 1 }} /><span style={{ color: C.inkFaint }}>{fmt(s.duration)}</span>
              </div>
            </div>
          ))}
          <div onClick={() => addScene(scenes.length - 1)} style={{ minWidth: 100, height: 96, borderRadius: 10, border: `1px dashed ${C.lineStrong}`, display: 'grid', placeItems: 'center', cursor: 'pointer', color: C.inkSoft }}>
            <div style={{ textAlign: 'center' }}><div style={{ fontSize: 18 }}>⊕</div><div style={{ fontSize: 11 }}>Add Scene</div></div>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 11.5, color: C.inkFaint, paddingRight: 8 }}>Total: {fmt(scenes.reduce((a, s) => a + s.duration, 0))}</div>
        </div>
      </div>

      {showConnectGuide && (
        <DeviceConnectGuide
          onClose={() => setShowConnectGuide(false)}
          onDetected={(s) => { pickSource(s); listCaptureSources().then(setSources).catch(() => {}); }}
        />
      )}

    </div>
  );

}


function SourceItem({ label, sub, onClick, active }: { label: string; sub: string; onClick: () => void; active: boolean }) {
  return (
    <div onClick={onClick} style={{ padding: '8px 10px', borderRadius: 8, cursor: 'pointer', background: active ? '#f3ece2' : 'transparent' }}>
      <div style={{ fontSize: 12.5, fontWeight: active ? 600 : 500, color: '#1d1b19' }}>{label}</div>
      <div style={{ fontSize: 10.5, color: '#9a9186' }}>{sub}</div>
    </div>
  );
}

/** Trekk ut et kort knapp-navn fra required action ("Click the X button" → "X"). */
function targetLabel(action?: string): string {
  if (!action) return 'Start free trial';
  const m = action.match(/[«"']([^«»"']+)[»"']/);
  if (m) return m[1];
  const words = action.replace(/^(klikk|click|trykk|press|på|on|the)\s+/i, '').split(/\s+/).slice(0, 3).join(' ');
  return words || 'Start free trial';
}

const btn: React.CSSProperties = { border: `1px solid ${C.lineStrong}`, background: '#fff', borderRadius: 10, padding: '9px 14px', fontSize: 12.5, fontWeight: 600, color: C.ink, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' };
const darkBtn: React.CSSProperties = { background: C.dark, color: '#fff', border: 0, borderRadius: 9, padding: '11px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const outlineBtn: React.CSSProperties = { background: '#fff', border: `1px solid ${C.lineStrong}`, color: C.ink, borderRadius: 9, padding: '11px 14px', fontSize: 13, cursor: 'pointer' };
const statusChip: React.CSSProperties = { fontSize: 11, fontWeight: 600, padding: '4px 9px', borderRadius: 8 };

export default GuidedRecorderView;
