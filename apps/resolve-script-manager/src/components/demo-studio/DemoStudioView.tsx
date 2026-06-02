/**
 * DemoStudioView — Product Demo Studio som egen flate i Post Agent.
 *
 * To moduser (knapper øverst, samme idiom som CreativeEditor sine ce-tabs):
 *   - "Scener": URL → scene-flow, script-per-scene-editor, scene-timeline,
 *     guided recorder (manuell Next/Done/Retake + teleprompter).
 *   - "Story":  GJENBRUKER den eksisterende StoryView (narrativ arc, emosjonell
 *     flyt, beats, scene graph, Story Director) ved å projisere demo-scenene
 *     til NarrativePick[] via demoStudioStoryAdapter. Maks gjenbruk.
 *
 * Inline-stiler (React.CSSProperties) — matcher Story-modulens husstil og
 * unngår MUI-layout-overloads. State i Zustand (demoStudioStore),
 * autolagret til localStorage. Manuell progresjon er kjernekravet.
 */

import { useEffect, useMemo, useState } from 'react';
import { StoryView } from '../story/StoryView';
import { useDemoStudio } from './demoStudioStore';
import {
  DEMO_TYPE_LABELS, SCENE_STATUS_LABELS, SCENE_STATUS_COLORS,
  totalDuration, type DemoDevice, type DemoType,
} from './demoStudioModel';
import { demoScenesToPicks, demoChapters } from './demoStudioStoryAdapter';

function fmtDur(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const DEVICE_LABEL: Record<DemoDevice, string> = {
  macbook: 'Mac', ipad: 'iPad', iphone: 'iPhone',
};

export function DemoStudioView() {
  const {
    project, selectedSceneId, recorderStepIndex,
    createProject, loadExisting, selectScene, addScene, updateScene,
    removeScene, setSceneDevice, setProjectField,
    startRecorder, nextStep, markCurrentDone, retakeCurrent, goToStep,
  } = useDemoStudio();

  const [mode, setMode] = useState<'scener' | 'story'>('scener');
  const [urlInput, setUrlInput] = useState('');
  const [demoType, setDemoType] = useState<DemoType>('product_demo');
  const [recording, setRecording] = useState(false);

  useEffect(() => { if (!project) loadExisting(); }, []); // eslint-disable-line

  const storyPicks = useMemo(() => (project ? demoScenesToPicks(project.scenes) : []), [project]);
  const storyChapters = useMemo(() => (project ? demoChapters(project.scenes) : []), [project]);

  // ── Tom tilstand: Create Demo ──
  if (!project) {
    return (
      <div style={emptyRoot} data-testid="demo-studio-empty">
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Product Demo Studio</h2>
        <p style={{ color: '#9a9aa8', fontSize: 13, marginTop: 6, marginBottom: 20 }}>
          Lim inn en URL og bygg en scene-basert produktdemo. Du styrer opptaket steg for steg.
        </p>
        <input
          style={urlField} placeholder="https://example.com"
          value={urlInput} onChange={(e) => setUrlInput(e.target.value)}
        />
        <select style={select} value={demoType} onChange={(e) => setDemoType(e.target.value as DemoType)}>
          {(Object.keys(DEMO_TYPE_LABELS) as DemoType[]).map((t) => (
            <option key={t} value={t}>{DEMO_TYPE_LABELS[t]}</option>
          ))}
        </select>
        <button
          style={{ ...primaryBtn, opacity: /^https?:\/\//.test(urlInput.trim()) ? 1 : 0.5 }}
          disabled={!/^https?:\/\//.test(urlInput.trim())}
          onClick={() => createProject(urlInput.trim(), demoType)}
        >
          Generér demo-flow
        </button>
      </div>
    );
  }

  const scenes = project.scenes;
  const selected = scenes.find((s) => s.id === selectedSceneId) ?? scenes[0];
  const recorderScene = scenes[recorderStepIndex];
  const doneCount = scenes.filter((s) => s.status === 'done' || s.status === 'approved').length;

  return (
    <div style={root} data-testid="demo-studio-view">
      {/* ── Topbar ── */}
      <div style={topbar}>
        <input style={titleField} value={project.name}
          onChange={(e) => setProjectField('name', e.target.value)} />
        <span style={pill}>{project.url}</span>
        <span style={pill}>{DEMO_TYPE_LABELS[project.demoType]}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: '#9a9aa8' }}>
          {doneCount}/{scenes.length} ferdig · {fmtDur(totalDuration(scenes))}
        </span>
        <button style={recording ? recBtnActive : recBtn}
          onClick={() => { setRecording(true); startRecorder(); setMode('scener'); }}>
          ● Start guided recording
        </button>
      </div>

      {/* ── Mode-tabs ── */}
      <div style={tabs}>
        <button style={mode === 'scener' ? tabActive : tab} onClick={() => setMode('scener')}>Scener</button>
        <button style={mode === 'story' ? tabActive : tab} onClick={() => setMode('story')}>Story</button>
      </div>

      {/* ── STORY-modus: gjenbruk StoryView ── */}
      {mode === 'story' ? (
        <div style={{ flex: 1, minHeight: 0 }}>
          <StoryView
            picks={storyPicks}
            chapters={storyChapters}
            focusedPickIndex={selected?.index ?? null}
            onFocusPick={(idx) => {
              if (idx == null) return;
              const sc = scenes.find((s) => s.index === idx);
              if (sc) selectScene(sc.id);
            }}
            projectInfo={{
              project: project.name,
              client: DEMO_TYPE_LABELS[project.demoType],
              duration: fmtDur(totalDuration(scenes)),
              format: project.format,
              created: new Date(project.createdAt).toLocaleDateString('nb-NO'),
              updated: new Date(project.updatedAt).toLocaleDateString('nb-NO'),
            }}
            onBackToProject={() => setMode('scener')}
            onStartEditing={() => setMode('scener')}
          />
        </div>
      ) : (
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* ── Venstre: scene-script editor ── */}
          <div style={editorCol}>
            {selected && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 11, textTransform: 'uppercase', color: '#9a9aa8', letterSpacing: 0.5 }}>
                    Scene {selected.index + 1} / {scenes.length}
                  </span>
                  <span style={{ ...statusChip, background: SCENE_STATUS_COLORS[selected.status] }}>
                    {SCENE_STATUS_LABELS[selected.status]}
                  </span>
                  <div style={{ flex: 1 }} />
                  {(['macbook', 'ipad', 'iphone'] as DemoDevice[]).map((d) => (
                    <button key={d}
                      style={selected.device === d ? deviceBtnActive : deviceBtn}
                      onClick={() => setSceneDevice(selected.id, d)}>
                      {DEVICE_LABEL[d]}
                    </button>
                  ))}
                </div>

                <label style={lbl}>Scene-tittel</label>
                <input style={field} value={selected.title}
                  onChange={(e) => updateScene(selected.id, { title: e.target.value })} />

                <label style={lbl}>Manus / narration (teleprompter)</label>
                <textarea style={{ ...field, minHeight: 80, resize: 'vertical' }} value={selected.narration}
                  placeholder="Hva som skal sies i denne scenen…"
                  onChange={(e) => updateScene(selected.id, { narration: e.target.value })} />

                <label style={lbl}>Required action</label>
                <input style={field} value={selected.requiredAction}
                  placeholder="F.eks. Klikk på «Start free trial»"
                  onChange={(e) => updateScene(selected.id, { requiredAction: e.target.value })} />

                <label style={lbl}>Overlay-tekst (vises i video)</label>
                <input style={field} value={selected.overlayText ?? ''}
                  onChange={(e) => updateScene(selected.id, { overlayText: e.target.value })} />

                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginTop: 4 }}>
                  <div>
                    <label style={lbl}>Varighet (sek)</label>
                    <input style={{ ...field, width: 120 }} type="number" value={selected.duration}
                      onChange={(e) => updateScene(selected.id, { duration: Number(e.target.value) || 0 })} />
                  </div>
                  <div style={{ flex: 1 }} />
                  <button style={dangerBtn} disabled={scenes.length <= 1}
                    onClick={() => removeScene(selected.id)}>Slett scene</button>
                </div>
              </>
            )}
          </div>

          {/* ── Høyre: Guided Recorder (teleprompter + manuell progresjon) ── */}
          {recording && recorderScene && (
            <div style={recorderCol} data-testid="guided-recorder">
              <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#9a9aa8' }}>
                Steg {recorderStepIndex + 1} av {scenes.length}
              </div>
              <div style={progressTrack}>
                <div style={{ ...progressFill, width: `${((recorderStepIndex + 1) / scenes.length) * 100}%` }} />
              </div>
              <h3 style={{ margin: '8px 0', fontSize: 18, fontWeight: 700 }}>{recorderScene.title}</h3>

              <div style={lbl}>Narration</div>
              <div style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 14, whiteSpace: 'pre-wrap' }}>
                {recorderScene.narration || <em style={{ color: '#6b6b78' }}>(ingen manus ennå)</em>}
              </div>

              <div style={lbl}>Required action</div>
              <div style={{ fontSize: 14, marginBottom: 14 }}>
                {recorderScene.requiredAction || <em style={{ color: '#6b6b78' }}>(ingen handling angitt)</em>}
              </div>

              <span style={{ ...statusChip, background: SCENE_STATUS_COLORS[recorderScene.status], marginBottom: 14 }}>
                {SCENE_STATUS_LABELS[recorderScene.status]}
              </span>

              <div style={{ fontSize: 12, color: '#9a9aa8', marginBottom: 14 }}>
                Opptaket venter. Systemet går ikke videre før du bekrefter.
              </div>

              <button style={{ ...primaryBtn, background: '#10b981', width: '100%', marginBottom: 8 }}
                onClick={markCurrentDone}>✓ Mark as Done</button>
              <button style={{ ...outlineBtn, width: '100%', marginBottom: 8 }}
                onClick={retakeCurrent}>↺ Retake</button>
              <button style={{ ...outlineBtn, width: '100%', opacity: recorderStepIndex >= scenes.length - 1 ? 0.5 : 1 }}
                disabled={recorderStepIndex >= scenes.length - 1}
                onClick={nextStep}>→ Next Step</button>
            </div>
          )}
        </div>
      )}

      {/* ── Bunn: scene-timeline ── */}
      <div style={timeline}>
        {scenes.map((s, i) => (
          <div key={s.id}
            onClick={() => { selectScene(s.id); if (recording) goToStep(i); }}
            style={{ ...sceneCard, borderColor: s.id === selectedSceneId ? '#a78bfa' : 'transparent' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontWeight: 700, fontSize: 12 }}>{i + 1}</span>
              <span style={{ fontSize: 11, color: '#9a9aa8' }}>{DEVICE_LABEL[s.device]}</span>
              <div style={{ flex: 1 }} />
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: SCENE_STATUS_COLORS[s.status] }} />
            </div>
            <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</div>
            <div style={{ fontSize: 11, color: '#9a9aa8' }}>{fmtDur(s.duration)}</div>
          </div>
        ))}
        <button style={addSceneBtn} onClick={() => addScene(scenes.length - 1)}>+</button>
      </div>
    </div>
  );
}

// ── Stiler (matcher Story-modulens mørke palett) ──
const root: React.CSSProperties = { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: '#0b0b12', color: '#e5e5ea' };
const emptyRoot: React.CSSProperties = { maxWidth: 520, margin: '60px auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 12, background: '#0b0b12', color: '#e5e5ea' };
const topbar: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid #2a2a36' };
const tabs: React.CSSProperties = { display: 'flex', gap: 4, padding: '8px 14px 0' };
const tab: React.CSSProperties = { background: 'transparent', border: 0, borderBottom: '2px solid transparent', color: '#9a9aa8', padding: '6px 14px', cursor: 'pointer', fontSize: 13 };
const tabActive: React.CSSProperties = { ...tab, color: '#fff', borderBottom: '2px solid #a78bfa', fontWeight: 600 };
const editorCol: React.CSSProperties = { flex: 1, padding: 18, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 };
const recorderCol: React.CSSProperties = { width: 320, flexShrink: 0, padding: 18, borderLeft: '1px solid #2a2a36', background: '#101018', overflowY: 'auto' };
const timeline: React.CSSProperties = { display: 'flex', gap: 8, padding: 12, borderTop: '1px solid #2a2a36', overflowX: 'auto' };
const sceneCard: React.CSSProperties = { minWidth: 130, padding: 8, borderRadius: 8, cursor: 'pointer', border: '2px solid transparent', background: 'rgba(255,255,255,0.04)' };
const addSceneBtn: React.CSSProperties = { minWidth: 48, borderRadius: 8, border: '1px solid #2e2e3a', background: '#1c1c26', color: '#cbcbd5', fontSize: 20, cursor: 'pointer' };
const lbl: React.CSSProperties = { fontSize: 11, textTransform: 'uppercase', color: '#9a9aa8', letterSpacing: 0.5, marginTop: 8 };
const field: React.CSSProperties = { background: '#101018', border: '1px solid #2e2e3a', borderRadius: 8, color: '#e5e5ea', padding: '8px 10px', fontSize: 14, fontFamily: 'inherit' };
const urlField: React.CSSProperties = { ...field, fontSize: 15, padding: '12px 14px' };
const select: React.CSSProperties = { ...field };
const titleField: React.CSSProperties = { background: 'transparent', border: 0, borderBottom: '1px solid #2e2e3a', color: '#fff', fontSize: 15, fontWeight: 600, padding: '4px 2px', minWidth: 160 };
const pill: React.CSSProperties = { fontSize: 11, padding: '3px 8px', borderRadius: 12, border: '1px solid #2e2e3a', color: '#cbcbd5', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const statusChip: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#fff', padding: '2px 8px', borderRadius: 10, display: 'inline-block' };
const primaryBtn: React.CSSProperties = { background: 'linear-gradient(135deg, #a78bfa, #7c3aed)', border: 0, color: '#fff', fontSize: 13, fontWeight: 600, padding: '10px 18px', borderRadius: 8, cursor: 'pointer' };
const outlineBtn: React.CSSProperties = { background: '#1c1c26', border: '1px solid #2e2e3a', color: '#cbcbd5', fontSize: 13, padding: '9px 14px', borderRadius: 8, cursor: 'pointer' };
const dangerBtn: React.CSSProperties = { background: 'transparent', border: '1px solid #5b2330', color: '#f87171', fontSize: 12, padding: '7px 12px', borderRadius: 8, cursor: 'pointer' };
const deviceBtn: React.CSSProperties = { background: '#1c1c26', border: '1px solid #2e2e3a', color: '#9a9aa8', fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer' };
const deviceBtnActive: React.CSSProperties = { ...deviceBtn, color: '#fff', borderColor: '#a78bfa', background: '#2a2440' };
const recBtn: React.CSSProperties = { ...outlineBtn, color: '#a78bfa', borderColor: '#a78bfa' };
const recBtnActive: React.CSSProperties = { ...primaryBtn, background: '#ef4444' };
const progressTrack: React.CSSProperties = { height: 4, background: '#22222e', borderRadius: 2, margin: '6px 0' };
const progressFill: React.CSSProperties = { height: '100%', background: '#a78bfa', borderRadius: 2 };

export default DemoStudioView;
