/**
 * demoStudioStore.ts — Zustand-store for Product Demo Studio.
 *
 * Holder hele DemoProject + UI-state (valgt scene, opptaks-state). Alle
 * scene-mutasjoner går gjennom her, og hver endring autolagres til
 * localStorage (via demoStudioModel.saveProject).
 *
 * Guided Recorder-kravet: progresjon er ALLTID manuell — store-actions
 * setter status, men ingenting avanserer scenen automatisk.
 */

import { create } from 'zustand';
import {
  type DemoProject,
  type DemoScene,
  type DemoType,
  type DemoDevice,
  type SceneStatus,
  type DemoRenderOptions,
  type ResponsiveFix,
  makeProject,
  makeScene,
  saveProject,
  loadLastProject,
  viewportForDevice,
  flowForDemoType,
  defaultRenderOptions,
  DEMO_TYPE_TEMPLATES,
} from './demoStudioModel';

interface DemoStudioState {
  project: DemoProject | null;
  /** Aktiv scene i editor/recorder (id). */
  selectedSceneId: string | null;
  /** Indeks i guided recorder (hvilket steg vi er på). */
  recorderStepIndex: number;

  // ── Prosjekt ──
  createProject: (url: string, demoType?: DemoType) => void;
  loadExisting: () => boolean;
  setProjectField: <K extends keyof DemoProject>(key: K, value: DemoProject[K]) => void;
  /**
   * Sett demo-type. reseed=true erstatter scene-flow + tone/lengde/format med
   * typens mal (slik at «Demo-typer»-knappene faktisk reformer demoen).
   * reseed=false bytter bare typen (behold scenene).
   */
  setDemoType: (demoType: DemoType, reseed: boolean) => void;
  /** Skru en visnings-toggle av/på (cursor, touch points, highlight, safe area). */
  setRenderOption: <K extends keyof DemoRenderOptions>(key: K, value: DemoRenderOptions[K]) => void;
  /** Anvend en strukturert Responsive Check-fiks på prosjektet/scenen. */
  applyResponsiveFix: (fix: ResponsiveFix) => void;

  // ── Scener ──
  selectScene: (id: string | null) => void;
  addScene: (afterIndex?: number) => void;
  updateScene: (id: string, patch: Partial<DemoScene>) => void;
  removeScene: (id: string) => void;
  /** Bytt ut hele scene-listen (AI Director). */
  replaceScenes: (scenes: DemoScene[]) => void;
  reorderScenes: (fromIndex: number, toIndex: number) => void;
  setSceneStatus: (id: string, status: SceneStatus) => void;
  setSceneDevice: (id: string, device: DemoDevice) => void;

  // ── Edit Mode: undo/redo (historikk over prosjekt-snapshots) ──
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // ── Edit Mode: multi-select ──
  /** Scener valgt for batch-operasjoner (i tillegg til selectedSceneId). */
  selectedSceneIds: string[];
  toggleSceneSelected: (id: string, additive?: boolean) => void;
  clearSceneSelection: () => void;
  removeSelectedScenes: () => void;

  /** Intern undo/redo-historikk (prosjekt-snapshots). Ikke kall direkte. */
  _undo: DemoProject[];
  _redo: DemoProject[];

  // ── Guided recorder (manuell progresjon) ──
  startRecorder: () => void;
  goToStep: (index: number) => void;
  nextStep: () => void;
  markCurrentDone: () => void;
  retakeCurrent: () => void;
}

/** Reindekser scener etter mutasjon så index = posisjon. */
function reindex(scenes: DemoScene[]): DemoScene[] {
  return scenes.map((s, i) => ({ ...s, index: i }));
}

/** Persistér + returner oppdatert prosjekt (med ny updatedAt). */
function persist(project: DemoProject): DemoProject {
  saveProject(project);
  return project;
}

const HISTORY_CAP = 60;
/** Koalescering: raske påfølgende edits med samme nøkkel blir ÉN undo-handling. */
let _lastSnap: { t: number; key: string } | null = null;

export const useDemoStudio = create<DemoStudioState>((set, get) => {
  /**
   * Ta vare på nåværende prosjekt-tilstand FØR en mutasjon, så den kan angres.
   * `key` + `coalesceMs` slår sammen raske påfølgende edits (f.eks. tasting i ett
   * felt) til én undo-handling. Rydder redo-stacken (ny gren = ingen redo).
   */
  const snapshot = (key: string, coalesceMs = 0) => {
    const { project, _undo } = get();
    if (!project) return;
    const now = Date.now();
    if (coalesceMs > 0 && _lastSnap && _lastSnap.key === key && now - _lastSnap.t < coalesceMs) {
      _lastSnap = { t: now, key };
      return; // samme logiske handling → ikke ny undo-post
    }
    _lastSnap = { t: now, key };
    set({ _undo: [..._undo, project].slice(-HISTORY_CAP), _redo: [] });
  };

  return {
  project: null,
  selectedSceneId: null,
  recorderStepIndex: 0,
  _undo: [],
  _redo: [],
  selectedSceneIds: [],

  createProject: (url, demoType = 'product_demo') => {
    const project = makeProject(url, demoType);
    saveProject(project);
    set({ project, selectedSceneId: project.scenes[0]?.id ?? null, recorderStepIndex: 0 });
  },

  loadExisting: () => {
    const project = loadLastProject();
    if (project) {
      set({ project, selectedSceneId: project.scenes[0]?.id ?? null, recorderStepIndex: 0 });
      return true;
    }
    return false;
  },

  setProjectField: (key, value) => {
    const { project } = get();
    if (!project) return;
    snapshot(`field:${String(key)}`, 800);
    set({ project: persist({ ...project, [key]: value }) });
  },

  setDemoType: (demoType, reseed) => {
    const { project } = get();
    if (!project) return;
    if (!reseed) {
      set({ project: persist({ ...project, demoType }) });
      return;
    }
    snapshot('demotype');
    const tpl = DEMO_TYPE_TEMPLATES[demoType] ?? DEMO_TYPE_TEMPLATES.product_demo;
    const scenes = reindex(flowForDemoType(demoType, project.devices[0]));
    const scriptMeta = { ...(project.scriptMeta ?? { tone: 'professional' as const, audience: 'General', language: 'Norsk', length: 'medium' as const }), tone: tpl.tone, length: tpl.length };
    set({
      project: persist({ ...project, demoType, scenes, format: tpl.format, scriptMeta }),
      selectedSceneId: scenes[0]?.id ?? null,
      recorderStepIndex: 0,
    });
  },

  setRenderOption: (key, value) => {
    const { project } = get();
    if (!project) return;
    snapshot(`render:${String(key)}`);
    const render = { ...defaultRenderOptions(), ...project.render, [key]: value };
    set({ project: persist({ ...project, render }) });
  },

  applyResponsiveFix: (fix) => {
    const { project } = get();
    if (!project) return;
    snapshot('responsive');
    if (fix.kind === 'set_format' && fix.format) {
      set({ project: persist({ ...project, format: fix.format }) });
      return;
    }
    // Scene-rettede fikser: finn scenen (eksplisitt indeks, ellers første som
    // matcher device — typisk mobil-scenen).
    const idx = fix.sceneIndex != null
      ? fix.sceneIndex
      : project.scenes.findIndex((s) => s.device === (fix.device ?? 'iphone'));
    if (idx < 0 || idx >= project.scenes.length) return;
    const patch: Partial<DemoScene> =
      fix.kind === 'start_scroll' ? { startScrollPct: fix.startScrollPct ?? 20 }
      : fix.kind === 'switch_device' && fix.device ? { device: fix.device, viewport: viewportForDevice(fix.device) }
      : {};
    const scenes = project.scenes.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    set({ project: persist({ ...project, scenes }) });
  },

  selectScene: (id) => set({ selectedSceneId: id }),

  addScene: (afterIndex) => {
    const { project } = get();
    if (!project) return;
    snapshot('add');
    const at = afterIndex == null ? project.scenes.length : afterIndex + 1;
    const scene = makeScene(at);
    const scenes = reindex([
      ...project.scenes.slice(0, at),
      scene,
      ...project.scenes.slice(at),
    ]);
    set({ project: persist({ ...project, scenes }), selectedSceneId: scene.id });
  },

  updateScene: (id, patch) => {
    const { project } = get();
    if (!project) return;
    // Tasting i ett felt koalesceres til én undo-handling (800ms).
    snapshot(`update:${id}`, 800);
    const scenes = project.scenes.map((s) => (s.id === id ? { ...s, ...patch } : s));
    set({ project: persist({ ...project, scenes }) });
  },

  removeScene: (id) => {
    const { project, selectedSceneId } = get();
    if (!project) return;
    snapshot('remove');
    const scenes = reindex(project.scenes.filter((s) => s.id !== id));
    const nextSelected = selectedSceneId === id ? scenes[0]?.id ?? null : selectedSceneId;
    set({ project: persist({ ...project, scenes }), selectedSceneId: nextSelected });
  },

  replaceScenes: (scenes) => {
    const { project } = get();
    if (!project) return;
    snapshot('replace');
    const reindexed = reindex(scenes);
    set({ project: persist({ ...project, scenes: reindexed }), selectedSceneId: reindexed[0]?.id ?? null });
  },

  reorderScenes: (fromIndex, toIndex) => {
    const { project } = get();
    if (!project) return;
    snapshot('reorder');
    const scenes = [...project.scenes];
    const [moved] = scenes.splice(fromIndex, 1);
    if (!moved) return;
    scenes.splice(toIndex, 0, moved);
    set({ project: persist({ ...project, scenes: reindex(scenes) }) });
  },

  setSceneStatus: (id, status) => get().updateScene(id, { status }),

  setSceneDevice: (id, device) =>
    get().updateScene(id, { device, viewport: viewportForDevice(device) }),

  // ── Edit Mode: undo/redo ──
  undo: () => {
    const { _undo, _redo, project } = get();
    if (!_undo.length || !project) return;
    const prev = _undo[_undo.length - 1];
    _lastSnap = null;
    const selOk = prev.scenes.some((s) => s.id === get().selectedSceneId);
    set({
      project: persist(prev),
      _undo: _undo.slice(0, -1),
      _redo: [..._redo, project].slice(-HISTORY_CAP),
      selectedSceneId: selOk ? get().selectedSceneId : prev.scenes[0]?.id ?? null,
      selectedSceneIds: [],
    });
  },
  redo: () => {
    const { _undo, _redo, project } = get();
    if (!_redo.length || !project) return;
    const next = _redo[_redo.length - 1];
    _lastSnap = null;
    const selOk = next.scenes.some((s) => s.id === get().selectedSceneId);
    set({
      project: persist(next),
      _redo: _redo.slice(0, -1),
      _undo: [..._undo, project].slice(-HISTORY_CAP),
      selectedSceneId: selOk ? get().selectedSceneId : next.scenes[0]?.id ?? null,
      selectedSceneIds: [],
    });
  },
  canUndo: () => get()._undo.length > 0,
  canRedo: () => get()._redo.length > 0,

  // ── Edit Mode: multi-select ──
  toggleSceneSelected: (id, additive = false) => {
    const { selectedSceneIds } = get();
    if (!additive) {
      set({ selectedSceneIds: selectedSceneIds.length === 1 && selectedSceneIds[0] === id ? [] : [id] });
      return;
    }
    set({ selectedSceneIds: selectedSceneIds.includes(id) ? selectedSceneIds.filter((x) => x !== id) : [...selectedSceneIds, id] });
  },
  clearSceneSelection: () => set({ selectedSceneIds: [] }),
  removeSelectedScenes: () => {
    const { project, selectedSceneIds, selectedSceneId } = get();
    if (!project || !selectedSceneIds.length) return;
    snapshot('remove-multi');
    const kill = new Set(selectedSceneIds);
    const scenes = reindex(project.scenes.filter((s) => !kill.has(s.id)));
    const nextSelected = selectedSceneId && kill.has(selectedSceneId) ? scenes[0]?.id ?? null : selectedSceneId;
    set({ project: persist({ ...project, scenes }), selectedSceneIds: [], selectedSceneId: nextSelected });
  },

  // ── Guided recorder ──
  startRecorder: () => {
    const { project, selectedSceneId } = get();
    if (!project) return;
    // Start på scenen brukeren faktisk står på (ikke alltid scene 0).
    const idx = Math.max(0, project.scenes.findIndex((s) => s.id === selectedSceneId));
    set({ recorderStepIndex: idx, selectedSceneId: project.scenes[idx]?.id ?? null });
  },

  goToStep: (index) => {
    const { project } = get();
    if (!project) return;
    const clamped = Math.max(0, Math.min(index, project.scenes.length - 1));
    set({ recorderStepIndex: clamped, selectedSceneId: project.scenes[clamped]?.id ?? null });
  },

  // Manuell progresjon: nextStep avanserer KUN når brukeren ber om det.
  nextStep: () => {
    const { project, recorderStepIndex } = get();
    if (!project) return;
    const next = Math.min(recorderStepIndex + 1, project.scenes.length - 1);
    set({ recorderStepIndex: next, selectedSceneId: project.scenes[next]?.id ?? null });
  },

  markCurrentDone: () => {
    const { project, recorderStepIndex } = get();
    if (!project) return;
    const cur = project.scenes[recorderStepIndex];
    if (cur) get().setSceneStatus(cur.id, 'done');
  },

  retakeCurrent: () => {
    const { project, recorderStepIndex } = get();
    if (!project) return;
    const cur = project.scenes[recorderStepIndex];
    if (cur) get().setSceneStatus(cur.id, 'retake');
  },
  };
});
