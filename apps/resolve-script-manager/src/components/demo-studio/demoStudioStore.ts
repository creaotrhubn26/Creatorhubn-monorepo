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

export const useDemoStudio = create<DemoStudioState>((set, get) => ({
  project: null,
  selectedSceneId: null,
  recorderStepIndex: 0,

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
    set({ project: persist({ ...project, [key]: value }) });
  },

  setDemoType: (demoType, reseed) => {
    const { project } = get();
    if (!project) return;
    if (!reseed) {
      set({ project: persist({ ...project, demoType }) });
      return;
    }
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
    const render = { ...defaultRenderOptions(), ...project.render, [key]: value };
    set({ project: persist({ ...project, render }) });
  },

  applyResponsiveFix: (fix) => {
    const { project } = get();
    if (!project) return;
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
    const scenes = project.scenes.map((s) => (s.id === id ? { ...s, ...patch } : s));
    set({ project: persist({ ...project, scenes }) });
  },

  removeScene: (id) => {
    const { project, selectedSceneId } = get();
    if (!project) return;
    const scenes = reindex(project.scenes.filter((s) => s.id !== id));
    const nextSelected = selectedSceneId === id ? scenes[0]?.id ?? null : selectedSceneId;
    set({ project: persist({ ...project, scenes }), selectedSceneId: nextSelected });
  },

  replaceScenes: (scenes) => {
    const { project } = get();
    if (!project) return;
    const reindexed = reindex(scenes);
    set({ project: persist({ ...project, scenes: reindexed }), selectedSceneId: reindexed[0]?.id ?? null });
  },

  reorderScenes: (fromIndex, toIndex) => {
    const { project } = get();
    if (!project) return;
    const scenes = [...project.scenes];
    const [moved] = scenes.splice(fromIndex, 1);
    if (!moved) return;
    scenes.splice(toIndex, 0, moved);
    set({ project: persist({ ...project, scenes: reindex(scenes) }) });
  },

  setSceneStatus: (id, status) => get().updateScene(id, { status }),

  setSceneDevice: (id, device) =>
    get().updateScene(id, { device, viewport: viewportForDevice(device) }),

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
}));
