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
import { pushCloudProject } from '../../services/cloudProjectsService';
import {
  type DemoProject,
  type DemoScene,
  type DemoType,
  type DemoDevice,
  type SceneStatus,
  type DemoRenderOptions,
  type ResponsiveFix,
  type SaveResult,
  makeProject,
  makeScene,
  saveProject,
  loadLastProject,
  loadProject,
  setLastProjectPointer,
  viewportForDevice,
  flowForDemoType,
  defaultRenderOptions,
  DEMO_TYPE_TEMPLATES,
} from './demoStudioModel';
import { gatherSiteContext, synthesizeProductBrain } from './demoStudioAI';

/** Samle FAKTISKE produkt-skjermer (data-URL-er) fra prosjektet — prioriter
 *  demoede scene-skjermer (kan være innlogget) framfor den offentlige scan-en. */
function collectProductScreens(project: DemoProject): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (d?: string | null) => {
    if (!d || !d.startsWith('data:')) return;
    const key = d.slice(0, 96);
    if (seen.has(key)) return;
    seen.add(key); out.push(d);
  };
  for (const s of project.scenes) add(s.thumbnailDataUrl);   // ekte demoede skjermer først
  for (const s of project.scanShots ?? []) add(s.dataUrl);   // så offentlig scan
  return out.slice(0, 6);
}

interface DemoStudioState {
  project: DemoProject | null;
  /** Aktiv scene i editor/recorder (id). */
  selectedSceneId: string | null;
  /** Indeks i guided recorder (hvilket steg vi er på). */
  recorderStepIndex: number;
  /** Utfall av siste autolagring — UI skal vise dette ærlig, ikke anta suksess. */
  saveStatus: SaveResult;
  /** Når siste (helt eller delvis) vellykkede lagring skjedde (epoch ms). */
  lastSavedAt: number | null;

  // ── Prosjekt ──
  createProject: (url: string, demoType?: DemoType) => void;
  loadExisting: () => boolean;
  /** Åpne et tidligere lagret prosjekt (fra «Tidligere demoer»-lista). */
  openProject: (id: string) => boolean;
  /** Adopter et prosjekt hentet utenfra (sky-pull): persister lokalt + åpne. */
  importProject: (p: DemoProject) => void;
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
  /**
   * Bygg/hent «Product Brain» — dyp produkt-forståelse (markedsføring + vision av
   * FAKTISKE app-skjermer, ofte innlogget), cachet på prosjektet og gjenbrukt av
   * alle AI-generatorene. Bygger på nytt når ekte skjermer blir tilgjengelige,
   * eller ved force.
   */
  ensureProductBrain: (opts?: { force?: boolean }) => Promise<string>;
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

  /** Persistér + returner oppdatert prosjekt. Oppdaterer saveStatus så UI-et
   *  viser det EKTE lagrings-utfallet (full localStorage skal ikke vise «Lagret»). */
  let cloudPushTimer: ReturnType<typeof setTimeout> | null = null;
  let localSaveTimer: ReturnType<typeof setTimeout> | null = null;
  const persist = (project: DemoProject): DemoProject => {
    // Debounce den TUNGE localStorage-skrivingen: saveProject JSON.stringify-er HELE
    // prosjektet inkl. base64-scanShots/thumbnails (kan være flere MB) — før kjørte
    // det synkront ved HVERT tastetrykk → merkbar hakking. In-memory state er allerede
    // oppdatert av kalleren; kun disk-skrivet utsettes (~500ms coalescing).
    if (localSaveTimer) clearTimeout(localSaveTimer);
    localSaveTimer = setTimeout(() => {
      const p = get().project ?? project;
      const result = saveProject(p);
      set({ saveStatus: result, lastSavedAt: result === 'error' ? get().lastSavedAt : Date.now() });
    }, 500);
    // Sky-synk (G16): debounced fire-and-forget så prosjektet overlever
    // maskinen. Leser FERSK state ved fyring (flere edits → én push), og er
    // stille no-op når bruker ikke er innlogget.
    if (cloudPushTimer) clearTimeout(cloudPushTimer);
    cloudPushTimer = setTimeout(() => {
      const p = get().project;
      if (p) void pushCloudProject(p).catch(() => { /* offline/utlogget — lokal kopi er fasit */ });
    }, 3000);
    return project;
  };

  return {
  project: null,
  selectedSceneId: null,
  recorderStepIndex: 0,
  saveStatus: 'saved' as SaveResult,
  lastSavedAt: null,
  _undo: [],
  _redo: [],
  selectedSceneIds: [],

  createProject: (url, demoType = 'product_demo') => {
    const project = makeProject(url, demoType);
    set({ project: persist(project), selectedSceneId: project.scenes[0]?.id ?? null, recorderStepIndex: 0 });
  },

  loadExisting: () => {
    const project = loadLastProject();
    if (project) {
      set({ project, selectedSceneId: project.scenes[0]?.id ?? null, recorderStepIndex: 0 });
      return true;
    }
    return false;
  },

  importProject: (p) => {
    set({
      project: persist(p),
      selectedSceneId: p.scenes[0]?.id ?? null,
      recorderStepIndex: 0,
      selectedSceneIds: [],
      _undo: [],
      _redo: [],
    });
  },

  openProject: (id) => {
    const project = loadProject(id);
    if (!project) return false;
    // Åpning skal ikke bumpe updatedAt (åpning ≠ redigering) — pek bare `last`.
    setLastProjectPointer(project.id);
    set({
      project,
      selectedSceneId: project.scenes[0]?.id ?? null,
      recorderStepIndex: 0,
      selectedSceneIds: [],
      _undo: [],
      _redo: [],
      saveStatus: 'saved',
    });
    return true;
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

  ensureProductBrain: async (opts) => {
    const project = get().project;
    if (!project?.url) return '';
    const screens = collectProductScreens(project);
    const hasScreensNow = screens.length > 0;
    const cached = !!project.productBrain && project.productBrainUrl === project.url;
    // Gjenbruk cache HVIS: samme URL, ikke force, og enten allerede bygget MED
    // skjermer, ELLER ingen ekte skjermer er tilgjengelige ennå (så vi ikke låser
    // en marketing-only-hjerne når appen senere blir fanget).
    if (cached && !opts?.force && (project.productBrainHasScreens || !hasScreensNow)) {
      return project.productBrain as string;
    }
    // Lag 1: markedsføring (flersides — hva produktet PÅSTÅR å være).
    const { context } = await gatherSiteContext(project.url, { maxPages: 5 }).catch(() => ({ context: '', pages: [] as string[] }));
    // Lag 2: vision av FAKTISKE app-skjermer (ofte innlogget — hva det GJØR).
    let brain = context;
    if (hasScreensNow) {
      brain = await synthesizeProductBrain({ url: project.url, marketingContext: context, screenshots: screens }).catch(() => context);
    }
    const cur = get().project;
    if (brain && cur && cur.url === project.url) {
      set({ project: persist({ ...cur, productBrain: brain, productBrainUrl: cur.url, productBrainHasScreens: hasScreensNow }) });
    }
    return brain;
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
