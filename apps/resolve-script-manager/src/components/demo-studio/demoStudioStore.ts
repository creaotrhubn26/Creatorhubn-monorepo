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
  makeProject,
  makeScene,
  saveProject,
  loadLastProject,
  viewportForDevice,
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

  // ── Scener ──
  selectScene: (id: string | null) => void;
  addScene: (afterIndex?: number) => void;
  updateScene: (id: string, patch: Partial<DemoScene>) => void;
  removeScene: (id: string) => void;
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
    const { project } = get();
    if (!project) return;
    set({ recorderStepIndex: 0, selectedSceneId: project.scenes[0]?.id ?? null });
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
