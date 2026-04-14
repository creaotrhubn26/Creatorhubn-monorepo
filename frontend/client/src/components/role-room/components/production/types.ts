import { z } from 'zod';

import {
  buildProductionScopedPreferenceKey,
  buildProductionWorkflowPreferenceKey,
  PRODUCTION_STORAGE_KEYS,
} from './storageKeys';

// ============================================
// Production Manuscript — shared types
// ============================================

export type SceneId = string;
export type ShotId = string;
export type ShootingDayId = string;

/** Harmonized note type: camera + director + sound + vfx */
export type NoteType = 'camera' | 'director' | 'sound' | 'vfx';

/** Per-scene production notes — supports all 4 types */
export type ProductionNotes = Record<SceneId, Partial<Record<NoteType, string>>>;

/** Draft vs saved layer for per-scene autosave */
export interface NotesDraftState {
  /** Notes persisted to backend / parent */
  saved: ProductionNotes;
  /** Local working copy — diverges until debounced save fires */
  draft: ProductionNotes;
  /** Which scene+type combos have unsaved edits */
  dirtyKeys: Set<string>;  // "sceneId:noteType"
}

/** Note type metadata for UI rendering */
export const NOTE_TYPE_META: Record<NoteType, {
  label: string;
  labelNo: string;
  icon: string;     // MUI icon component name (resolved at render)
  color: string;
  bgAlpha: string;
}> = {
  camera:   { label: 'Camera',    labelNo: 'Kamera',   icon: 'CameraIcon',  color: '#3b82f6', bgAlpha: 'rgba(59,130,246,0.08)' },
  director: { label: 'Director',  labelNo: 'Regissør', icon: 'MovieIcon',   color: '#f97316', bgAlpha: 'rgba(249,115,22,0.08)' },
  sound:    { label: 'Sound',     labelNo: 'Lyd',      icon: 'MicIcon',     color: '#10b981', bgAlpha: 'rgba(16,185,129,0.08)' },
  vfx:      { label: 'VFX',       labelNo: 'VFX',      icon: 'SceneIcon',   color: '#f59e0b', bgAlpha: 'rgba(245,158,11,0.08)' },
};

// ============================================
// Add Shot Dialog — FSM types
// ============================================

export interface ShotSearchResult {
  id: string;
  url: string;
  thumbnailUrl: string;
  source: string;
  attribution?: string;
  film?: string;
  shotType?: string;
}

/** Discriminated union for reference search results */
export type ReferenceResult =
  | { kind: 'film'; id: string; title: string; year?: string; thumbnailUrl: string; source: 'shotcafe' }
  | { kind: 'frame'; id: string; filmTitle?: string; url: string; thumbnailUrl: string; source: 'shotcafe' | 'unsplash' }
  | { kind: 'placeholder'; id: string; url: string; thumbnailUrl: string; source: 'demo' };

/** Finite state machine for the Add Shot dialog */
export type AddShotState =
  | { open: false }
  | { open: true; step: 'chooseMode' }
  | { open: true; step: 'upload'; selectedImage: string | null }
  | { open: true; step: 'storyboard'; selectedStoryboardId: string | null }
  | { open: true; step: 'search'; query: string; loading: boolean; results: ShotSearchResult[]; selectedImage: string | null };

export type AddShotAction =
  | { type: 'OPEN' }
  | { type: 'CLOSE' }
  | { type: 'CHOOSE_UPLOAD' }
  | { type: 'CHOOSE_STORYBOARD' }
  | { type: 'CHOOSE_SEARCH' }
  | { type: 'SET_IMAGE'; url: string | null }
  | { type: 'SET_STORYBOARD_SELECTION'; id: string | null }
  | { type: 'SET_QUERY'; query: string }
  | { type: 'SEARCH_START' }
  | { type: 'SEARCH_DONE'; results: ShotSearchResult[] }
  | { type: 'BACK' };

export function addShotReducer(state: AddShotState, action: AddShotAction): AddShotState {
  switch (action.type) {
    case 'OPEN':
      return { open: true, step: 'chooseMode' };
    case 'CLOSE':
      return { open: false };
    case 'CHOOSE_UPLOAD':
      return { open: true, step: 'upload', selectedImage: null };
    case 'CHOOSE_STORYBOARD':
      return { open: true, step: 'storyboard', selectedStoryboardId: null };
    case 'CHOOSE_SEARCH':
      return { open: true, step: 'search', query: '', loading: false, results: [], selectedImage: null };
    case 'SET_IMAGE':
      if (!state.open || (state.step !== 'upload' && state.step !== 'search')) return state;
      return { ...state, selectedImage: action.url };
    case 'SET_STORYBOARD_SELECTION':
      if (!state.open || state.step !== 'storyboard') return state;
      return { ...state, selectedStoryboardId: action.id };
    case 'SET_QUERY':
      if (!state.open || state.step !== 'search') return state;
      return { ...state, query: action.query };
    case 'SEARCH_START':
      if (!state.open || state.step !== 'search') return state;
      return { ...state, loading: true };
    case 'SEARCH_DONE':
      if (!state.open || state.step !== 'search') return state;
      return { ...state, loading: false, results: action.results };
    case 'BACK':
      return { open: true, step: 'chooseMode' };
    default:
      return state;
  }
}

// ============================================
// Selected scenes — Record map (replaces Set)
// ============================================

export type SelectedMap = Record<SceneId, true>;

export const selectedMapToggle = (prev: SelectedMap, id: SceneId): SelectedMap => {
  if (prev[id]) {
    const next = { ...prev };
    delete next[id];
    return next;
  }
  return { ...prev, [id]: true };
};

export const selectedMapFromIds = (ids: SceneId[]): SelectedMap =>
  Object.fromEntries(ids.map(id => [id, true as const]));

export const selectedMapSize = (m: SelectedMap): number => Object.keys(m).length;

export const selectedMapHas = (m: SelectedMap, id: SceneId): boolean => !!m[id];

export const selectedMapIds = (m: SelectedMap): SceneId[] => Object.keys(m);

export const EMPTY_SELECTION: SelectedMap = {};

// ============================================
// Scene needs — type for derived/stored needs
// ============================================

export interface SceneNeed {
  cam: boolean;
  light: boolean;
  sound: boolean;
}

const stringArraySchema = z.array(z.string());

export const sceneMetadataSchema = z.object({
  audio: z.string().optional(),
  camera: z.string().optional(),
  equipment: stringArraySchema.optional(),
  lens: z.union([z.string(), z.number()]).optional(),
  lighting: z.string().optional(),
  makeup: stringArraySchema.optional(),
  notes: z.string().optional(),
  props: stringArraySchema.optional(),
  shotType: z.string().optional(),
  wardrobe: stringArraySchema.optional(),
}).passthrough();

export type SceneMetadata = z.infer<typeof sceneMetadataSchema>;

// ============================================
// Filters — compressed into single object
// ============================================

export interface SceneFilters {
  missing: { cam: boolean; light: boolean; sound: boolean };
  showTags: boolean;
  showStoryContext: boolean;
  viewMode: 'scenes' | 'shots';
}

export const DEFAULT_FILTERS: SceneFilters = {
  missing: { cam: false, light: false, sound: false },
  showTags: true,
  showStoryContext: false,
  viewMode: 'scenes',
};

// ============================================
// Scene status — derived helper
// ============================================

export type DerivedSceneStatus = 'not-started' | 'in-progress' | 'complete';

/** Derive scene status from shot completion data */
export function deriveSceneStatus(
  shotsCount: number,
  completedShotsCount: number,
): DerivedSceneStatus {
  if (shotsCount === 0) return 'not-started';
  if (completedShotsCount >= shotsCount) return 'complete';
  return 'in-progress';
}

// ============================================
// Zoom/fullscreen — localStorage persistence
// ============================================

const ZOOM_KEY = PRODUCTION_STORAGE_KEYS.manuscriptZoom;
const FULLSCREEN_KEY = PRODUCTION_STORAGE_KEYS.manuscriptFullscreen;

export function loadZoomPreference(projectId?: string): number {
  try {
    const v = localStorage.getItem(buildProductionScopedPreferenceKey(ZOOM_KEY, projectId))
      ?? localStorage.getItem(ZOOM_KEY);
    if (v) {
      const n = parseFloat(v);
      if (n >= 0.5 && n <= 2) return n;
    }
  } catch { /* SSR / incognito */ }
  return 1;
}

export function saveZoomPreference(zoom: number, projectId?: string): void {
  try { localStorage.setItem(buildProductionScopedPreferenceKey(ZOOM_KEY, projectId), String(zoom)); } catch { /* noop */ }
}

export function loadFullscreenPreference(projectId?: string): boolean {
  try {
    const value = localStorage.getItem(buildProductionScopedPreferenceKey(FULLSCREEN_KEY, projectId))
      ?? localStorage.getItem(FULLSCREEN_KEY);
    return value === 'true';
  } catch {
    return false;
  }
}

export function saveFullscreenPreference(fs: boolean, projectId?: string): void {
  try { localStorage.setItem(buildProductionScopedPreferenceKey(FULLSCREEN_KEY, projectId), String(fs)); } catch { /* noop */ }
}

// ============================================
// Workflow UI — FSM types (replaces ~15 booleans)
// ============================================

/**
 * Which main panel is visible. Only one at a time.
 * `none` — default editor view, no workflow panel open.
 */
export type WorkflowView =
  | { tab: 'none' }
  | { tab: 'stripboard' }
  | { tab: 'schedule' }
  | { tab: 'live'; showDaySelector: boolean };

/**
 * Which modal/dialog is open. Only one at a time.
 * `none` — no modal open.
 */
export type WorkflowModal =
  | { type: 'none' }
  | { type: 'callSheetPreview'; callSheet: CallSheetRef }
  | { type: 'sceneNeeds'; sceneId: string }
  | { type: 'scheduleScene'; sceneId: string }
  | { type: 'checklist' }
  | { type: 'lineCoverage' }
  | { type: 'bulkShot'; template: BulkShotTemplate };

/** Minimal reference stored in modal state (avoids stale full objects) */
export interface CallSheetRef {
  id: string;
  shootingDayId: ShootingDayId;
  html: string;
  generatedAt: string;
}

export type BulkShotTemplate = 'standard' | 'dialogue' | 'action' | 'custom';

/** Full workflow UI state — single source of truth */
export interface WorkflowUIState {
  view: WorkflowView;
  modal: WorkflowModal;
  /** Currently selected shooting day across all workflow panels */
  selectedDayId: ShootingDayId;
  /** When true, live set polling auto-selects the current scene */
  followLiveScene: boolean;
}

// ---- Actions ----

export type WorkflowAction =
  | { type: 'OPEN_STRIPBOARD' }
  | { type: 'OPEN_SCHEDULE' }
  | { type: 'OPEN_LIVE'; showDaySelector?: boolean }
  | { type: 'CLOSE_VIEW' }
  | { type: 'TOGGLE_DAY_SELECTOR' }
  | { type: 'SELECT_DAY'; dayId: ShootingDayId }
  | { type: 'SELECT_DAY_AND_GO_LIVE'; dayId: ShootingDayId }
  | { type: 'OPEN_CALL_SHEET'; callSheet: CallSheetRef }
  | { type: 'OPEN_SCENE_NEEDS'; sceneId: SceneId }
  | { type: 'OPEN_SCHEDULE_SCENE'; sceneId: SceneId }
  | { type: 'OPEN_CHECKLIST' }
  | { type: 'OPEN_LINE_COVERAGE' }
  | { type: 'OPEN_BULK_SHOT' }
  | { type: 'SET_BULK_TEMPLATE'; template: BulkShotTemplate }
  | { type: 'CLOSE_MODAL' }
  | { type: 'TOGGLE_FOLLOW_LIVE' };

export const INITIAL_WORKFLOW_STATE: WorkflowUIState = {
  view: { tab: 'none' },
  modal: { type: 'none' },
  selectedDayId: 'day-3',
  followLiveScene: false,
};

export function workflowReducer(
  state: WorkflowUIState,
  action: WorkflowAction,
): WorkflowUIState {
  switch (action.type) {
    // ---- View transitions (mutually exclusive) ----
    case 'OPEN_STRIPBOARD':
      return { ...state, view: { tab: 'stripboard' }, modal: { type: 'none' } };
    case 'OPEN_SCHEDULE':
      return { ...state, view: { tab: 'schedule' }, modal: { type: 'none' } };
    case 'OPEN_LIVE':
      return {
        ...state,
        view: { tab: 'live', showDaySelector: action.showDaySelector ?? false },
        modal: { type: 'none' },
      };
    case 'CLOSE_VIEW':
      return { ...state, view: { tab: 'none' }, modal: { type: 'none' } };
    case 'TOGGLE_DAY_SELECTOR':
      if (state.view.tab !== 'live') return state;
      return {
        ...state,
        view: { tab: 'live', showDaySelector: !state.view.showDaySelector },
      };

    // ---- Day selection ----
    case 'SELECT_DAY':
      return { ...state, selectedDayId: action.dayId };
    case 'SELECT_DAY_AND_GO_LIVE':
      return {
        ...state,
        selectedDayId: action.dayId,
        view: { tab: 'live', showDaySelector: false },
      };

    // ---- Modal transitions (mutually exclusive) ----
    case 'OPEN_CALL_SHEET':
      return { ...state, modal: { type: 'callSheetPreview', callSheet: action.callSheet } };
    case 'OPEN_SCENE_NEEDS':
      return { ...state, modal: { type: 'sceneNeeds', sceneId: action.sceneId } };
    case 'OPEN_SCHEDULE_SCENE':
      return { ...state, modal: { type: 'scheduleScene', sceneId: action.sceneId } };
    case 'OPEN_CHECKLIST':
      return { ...state, modal: { type: 'checklist' } };
    case 'OPEN_LINE_COVERAGE':
      return { ...state, modal: { type: 'lineCoverage' } };
    case 'OPEN_BULK_SHOT':
      return { ...state, modal: { type: 'bulkShot', template: 'standard' } };
    case 'SET_BULK_TEMPLATE':
      if (state.modal.type !== 'bulkShot') return state;
      return { ...state, modal: { ...state.modal, template: action.template } };
    case 'CLOSE_MODAL':
      return { ...state, modal: { type: 'none' } };
    case 'TOGGLE_FOLLOW_LIVE':
      return { ...state, followLiveScene: !state.followLiveScene };
    default:
      return state;
  }
}

// ---- View/modal query helpers ----

export const isViewOpen = (state: WorkflowUIState, tab: WorkflowView['tab']): boolean =>
  state.view.tab === tab;

export const isModalOpen = (state: WorkflowUIState, type: WorkflowModal['type']): boolean =>
  state.modal.type === type;

// ============================================
// Checklist — normalized type + readiness score
// ============================================

export type ChecklistKey =
  | 'locationConfirmed'
  | 'castConfirmed'
  | 'propsReady'
  | 'equipmentAllocated'
  | 'permitsObtained'
  | 'scriptLocked';

export const CHECKLIST_KEYS: ChecklistKey[] = [
  'locationConfirmed',
  'castConfirmed',
  'propsReady',
  'equipmentAllocated',
  'permitsObtained',
  'scriptLocked',
];

export type SceneChecklist = Record<ChecklistKey, boolean>;

export const EMPTY_CHECKLIST: SceneChecklist = {
  locationConfirmed: false,
  castConfirmed: false,
  propsReady: false,
  equipmentAllocated: false,
  permitsObtained: false,
  scriptLocked: false,
};

/** Checklist metadata for UI rendering */
export const CHECKLIST_META: Record<ChecklistKey, { label: string; labelNo: string; icon: string }> = {
  locationConfirmed:  { label: 'Location Confirmed',   labelNo: 'Lokasjon bekreftet',   icon: 'LocationOn' },
  castConfirmed:      { label: 'Cast Confirmed',       labelNo: 'Cast bekreftet',       icon: 'People' },
  propsReady:         { label: 'Props Ready',          labelNo: 'Rekvisitter klare',    icon: 'Inventory' },
  equipmentAllocated: { label: 'Equipment Allocated',  labelNo: 'Utstyr tildelt',       icon: 'CameraAlt' },
  permitsObtained:    { label: 'Permits Obtained',     labelNo: 'Tillatelser innhentet', icon: 'Assignment' },
  scriptLocked:       { label: 'Script Locked',        labelNo: 'Manus låst',           icon: 'Lock' },
};

/**
 * Derive readiness score as 0–100 percentage.
 * Returns `{ score, completed, total }`.
 */
export function deriveReadinessScore(checklist: SceneChecklist): {
  score: number;
  completed: number;
  total: number;
} {
  const total = CHECKLIST_KEYS.length;
  const completed = CHECKLIST_KEYS.filter(k => checklist[k]).length;
  return {
    score: Math.round((completed / total) * 100),
    completed,
    total,
  };
}

// ============================================
// Workflow persistence — localStorage per project
// ============================================

/** Serializable subset of WorkflowUIState for localStorage */
interface WorkflowPersistence {
  viewTab: WorkflowView['tab'];
  selectedDayId: ShootingDayId;
}

export const workflowPersistenceSchema = z.object({
  viewTab: z.enum(['none', 'stripboard', 'schedule', 'live']),
  selectedDayId: z.string().min(1),
});

export const persistedUiPreferencesSchema = z.object({
  expandedSections: z.object({
    audio: z.boolean().optional(),
    camera: z.boolean().optional(),
    lighting: z.boolean().optional(),
    references: z.boolean().optional(),
  }).optional(),
  isFullscreen: z.boolean().optional(),
  manuscriptZoom: z.number().min(0.5).max(2).optional(),
  workflow: workflowPersistenceSchema.partial().optional(),
});

export type PersistedUiPreferences = z.infer<typeof persistedUiPreferencesSchema>;

export function loadWorkflowPreference(projectId: string): Partial<WorkflowUIState> | null {
  try {
    const raw = localStorage.getItem(buildProductionWorkflowPreferenceKey(projectId));
    if (!raw) return null;
    const parsedResult = workflowPersistenceSchema.safeParse(JSON.parse(raw));
    if (!parsedResult.success) return null;
    const parsed: WorkflowPersistence = parsedResult.data;
    const view: WorkflowView =
      parsed.viewTab === 'stripboard' ? { tab: 'stripboard' } :
      parsed.viewTab === 'schedule' ? { tab: 'schedule' } :
      parsed.viewTab === 'live' ? { tab: 'live', showDaySelector: false } :
      { tab: 'none' };
    return {
      view,
      selectedDayId: parsed.selectedDayId || 'day-3',
    };
  } catch {
    return null;
  }
}

export function saveWorkflowPreference(projectId: string, state: WorkflowUIState): void {
  try {
    const data: WorkflowPersistence = {
      viewTab: state.view.tab,
      selectedDayId: state.selectedDayId,
    };
    localStorage.setItem(buildProductionWorkflowPreferenceKey(projectId), JSON.stringify(data));
  } catch { /* noop */ }
}

// ============================================
// Reference Search UI — state machine (replaces ~9 useState)
// ============================================

/** A single result from shot.cafe film search */
export interface ShotCafeFilm {
  id: string;
  title: string;
  year: string;
  slug: string;
  imageCount: number;
  thumbnail: string;
  url: string;
  cinematographer?: string;
}

/** A selected film with its loaded frames */
export interface SelectedFilmDetail {
  title: string;
  slug: string;
  frames: Array<{ id: string; url: string; thumbnailUrl: string }>;
}

/** A single image search result (unsplash/generic) */
export interface ReferenceImageResult {
  id: string;
  url: string;
  thumbnailUrl: string;
  source: string;
  attribution?: string;
}

/** Center panel reference image display */
export interface CenterReference {
  url: string;
  source: string;
  title?: string;
}

export type SearchSource = 'all' | 'shotcafe' | 'unsplash';

export interface SearchUIState {
  open: boolean;
  source: SearchSource;
  query: string;
  loading: boolean;
  /** Generic image results (unsplash etc.) */
  imageResults: ReferenceImageResult[];
  /** Film results from shot.cafe */
  filmResults: ShotCafeFilm[];
  /** Currently selected film for frame browsing */
  selectedFilm: SelectedFilmDetail | null;
  /** Reference image displayed in center panel */
  centerReference: CenterReference | null;
  /** URLs added by user as shot references */
  uploadedRefs: string[];
}

export type SearchAction =
  | { type: 'OPEN'; initialQuery?: string }
  | { type: 'CLOSE' }
  | { type: 'SET_SOURCE'; source: SearchSource }
  | { type: 'SET_QUERY'; query: string }
  | { type: 'SEARCH_START' }
  | { type: 'SEARCH_DONE'; imageResults: ReferenceImageResult[]; filmResults: ShotCafeFilm[] }
  | { type: 'SELECT_FILM'; film: SelectedFilmDetail }
  | { type: 'DESELECT_FILM' }
  | { type: 'SET_CENTER_REF'; ref: CenterReference }
  | { type: 'CLEAR_CENTER_REF' }
  | { type: 'SET_FILM_RESULTS'; films: ShotCafeFilm[] }
  | { type: 'ADD_UPLOADED_REF'; url: string }
  | { type: 'REMOVE_UPLOADED_REF'; index: number }
  | { type: 'ADD_REF_AND_CLOSE'; url: string }
  | { type: 'SET_CENTER_AND_CLOSE'; ref: CenterReference };

export const INITIAL_SEARCH_STATE: SearchUIState = {
  open: false,
  source: 'all',
  query: '',
  loading: false,
  imageResults: [],
  filmResults: [],
  selectedFilm: null,
  centerReference: null,
  uploadedRefs: [],
};

export function searchReducer(
  state: SearchUIState,
  action: SearchAction,
): SearchUIState {
  switch (action.type) {
    case 'OPEN':
      return {
        ...state,
        open: true,
        query: action.initialQuery ?? state.query,
        selectedFilm: null,
      };
    case 'CLOSE':
      return { ...state, open: false, selectedFilm: null };
    case 'SET_SOURCE':
      return { ...state, source: action.source };
    case 'SET_QUERY':
      return { ...state, query: action.query };
    case 'SEARCH_START':
      return {
        ...state,
        loading: true,
        imageResults: [],
        filmResults: [],
        selectedFilm: null,
      };
    case 'SEARCH_DONE':
      return {
        ...state,
        loading: false,
        imageResults: action.imageResults,
        filmResults: action.filmResults,
      };
    case 'SELECT_FILM':
      return { ...state, selectedFilm: action.film, loading: false };
    case 'DESELECT_FILM':
      return { ...state, selectedFilm: null };
    case 'SET_CENTER_REF':
      return { ...state, centerReference: action.ref };
    case 'CLEAR_CENTER_REF':
      return { ...state, centerReference: null };
    case 'SET_FILM_RESULTS':
      return { ...state, filmResults: action.films };
    case 'ADD_UPLOADED_REF':
      return { ...state, uploadedRefs: [...state.uploadedRefs, action.url] };
    case 'REMOVE_UPLOADED_REF':
      return { ...state, uploadedRefs: state.uploadedRefs.filter((_, i) => i !== action.index) };
    case 'ADD_REF_AND_CLOSE':
      return {
        ...state,
        uploadedRefs: [...state.uploadedRefs, action.url],
        open: false,
        selectedFilm: null,
      };
    case 'SET_CENTER_AND_CLOSE':
      return {
        ...state,
        centerReference: action.ref,
        open: false,
        selectedFilm: null,
      };
    default:
      return state;
  }
}

// ============================================
// Inspector/Editing UI — replaces scattered editing state
// ============================================

// ---- Shot metadata: canonical per-shot data (source of truth) ----

export type ShotStatus = 'done' | 'inProgress' | 'missing';

export interface ShotCameraMeta {
  lens: string;
  movement: string;
  framing: string; // framing = "Wide" | "Medium" | "Close-up" etc (NOT shotType)
}

export interface ShotLightingMeta {
  key: string;
  temp: string;
  ratio: string;
}

export interface ShotSoundMeta {
  mic: string;
  ambience: string;
  notes: string;
}

export interface ShotMeta {
  camera: ShotCameraMeta;
  lighting: ShotLightingMeta;
  sound: ShotSoundMeta;
  references: string[];
  durationSec: number;
  status: ShotStatus;
  thumbnailUrl?: string;
}

export const shotCameraMetaSchema = z.object({
  lens: z.string(),
  movement: z.string(),
  framing: z.string(),
});

export const shotLightingMetaSchema = z.object({
  key: z.string(),
  temp: z.string(),
  ratio: z.string(),
});

export const shotSoundMetaSchema = z.object({
  mic: z.string(),
  ambience: z.string(),
  notes: z.string(),
});

export const shotMetadataSchema = z.object({
  camera: shotCameraMetaSchema,
  lighting: shotLightingMetaSchema,
  sound: shotSoundMetaSchema,
  references: z.array(z.string()),
  durationSec: z.number().nonnegative(),
  status: z.enum(['done', 'inProgress', 'missing']),
  thumbnailUrl: z.string().optional(),
});

export type ShotMetadata = z.infer<typeof shotMetadataSchema>;
export type ShotMetadataMap = Record<ShotId, ShotMeta>;

/** Preset = camera + lighting + sound slice of ShotMeta */
export type ShotPreset = {
  camera: ShotCameraMeta;
  lighting: ShotLightingMeta;
  sound: ShotSoundMeta;
};

/** Build a default ShotMeta — used when seeding new shots */
export function buildDefaultShotMeta(index: number = 0): ShotMeta {
  return {
    camera: {
      lens: ['50mm Prime', '35mm Prime', '85mm Prime', '24-70mm'][index % 4],
      movement: ['Static', 'Rolig push-in', 'Dolly', 'Pan'][index % 4],
      framing: ['Wide', 'Medium', 'Close-up', 'Extreme Close-up'][index % 4],
    },
    lighting: {
      key: ['Mykt sidelys', 'Key light 4ft', 'Backlight only', 'Ring light'][index % 4],
      temp: ['3200K', '5600K', '4300K', '3200K'][index % 4],
      ratio: ['3:1', '2:1', '4:1', '1.5:1'][index % 4],
    },
    sound: {
      mic: ['Boom Mic', 'Lav Mic', 'Wireless', 'Studio'][index % 4],
      ambience: ['Quiet interior', 'Street traffic', 'Forest', 'Empty room'][index % 4],
      notes: ['Monitor levels closely', 'Watch for wind', 'AC hum present', 'Clean take'][index % 4],
    },
    references: [],
    durationSec: 30 + (index * 5),
    status: (['done', 'inProgress', 'missing'] as const)[index % 3],
  };
}

/** Convert ShotMeta → ShotProperties (for inspector draft) */
export function metaToShotProperties(meta: ShotMeta, defaults: ShotProperties = DEFAULT_SHOT_PROPERTIES): ShotProperties {
  return {
    camera: defaults.camera,           // camera body comes from user/equipment, not metadata
    lens: meta.camera.lens || defaults.lens,
    rig: defaults.rig,                 // rig not stored in metadata
    shotType: meta.camera.framing || defaults.shotType,
    keyLight: meta.lighting.key || defaults.keyLight,
    sideLight: defaults.sideLight,     // not in metadata granular
    gel: defaults.gel,                 // not in metadata granular
    mic: meta.sound.mic || defaults.mic,
    atmos: meta.sound.ambience || defaults.atmos,
  };
}

/** Write ShotProperties back to a ShotMeta (partial update) */
export function shotPropertiesToMeta(props: ShotProperties, prev: ShotMeta): ShotMeta {
  return {
    ...prev,
    camera: {
      ...prev.camera,
      lens: props.lens,
      framing: props.shotType,         // shotType UI → framing metadata
    },
    lighting: {
      ...prev.lighting,
      key: props.keyLight,
    },
    sound: {
      ...prev.sound,
      mic: props.mic,
      ambience: props.atmos,
    },
  };
}

// ---- Inspector UI types ----

export type ShotPropertyKey = 'camera' | 'lens' | 'rig' | 'shotType' | 'keyLight' | 'sideLight' | 'gel' | 'mic' | 'atmos';

export interface ShotProperties {
  camera: string;
  lens: string;
  rig: string;
  shotType: string;
  keyLight: string;
  sideLight: string;
  gel: string;
  mic: string;
  atmos: string;
}

export const DEFAULT_SHOT_PROPERTIES: ShotProperties = {
  camera: 'ARRI Alexa Mini LF',
  lens: '50mm Prime',
  rig: 'Stativ',
  shotType: 'Close-up',
  keyLight: 'Mykt sidelys',
  sideLight: 'Varm tone',
  gel: 'Gel: Warm 1/4 CTO',
  mic: 'Boom Mic',
  atmos: 'Dempet romlyd',
};

/** Editing state for inline property editing */
export type InspectorEditing =
  | null
  | { field: ShotPropertyKey; draft: string };

export interface InspectorUIState {
  /** The shot currently being edited (null = scene-level defaults) */
  activeShotId: ShotId | null;
  /** Editable draft of the active shot's properties */
  properties: ShotProperties;
  editing: InspectorEditing;
  expandedSections: ExpandedSections;
  /** True when the draft has unsaved changes vs the underlying metadata */
  dirty: boolean;
}

export interface ExpandedSections {
  camera: boolean;
  lighting: boolean;
  audio: boolean;
  references: boolean;
}

export const DEFAULT_EXPANDED_SECTIONS: ExpandedSections = {
  camera: true,
  lighting: true,
  audio: true,
  references: true,
};

export type InspectorAction =
  | { type: 'SET_PROPERTIES'; properties: ShotProperties }
  | { type: 'UPDATE_PROPERTY'; field: ShotPropertyKey; value: string }
  | { type: 'MERGE_PROPERTIES'; partial: Partial<ShotProperties> }
  | { type: 'SELECT_SHOT'; shotId: ShotId | null; properties: ShotProperties }
  | { type: 'START_EDIT'; field: ShotPropertyKey; currentValue: string }
  | { type: 'SET_EDIT_DRAFT'; draft: string }
  | { type: 'SAVE_EDIT' }
  | { type: 'CANCEL_EDIT' }
  | { type: 'TOGGLE_SECTION'; section: keyof ExpandedSections }
  | { type: 'LOAD_SECTIONS'; sections: ExpandedSections };

export function inspectorReducer(
  state: InspectorUIState,
  action: InspectorAction,
): InspectorUIState {
  switch (action.type) {
    case 'SET_PROPERTIES':
      return { ...state, properties: action.properties, editing: null, dirty: false };
    case 'UPDATE_PROPERTY':
      return {
        ...state,
        properties: { ...state.properties, [action.field]: action.value },
        dirty: true,
      };
    case 'MERGE_PROPERTIES':
      return {
        ...state,
        properties: { ...state.properties, ...action.partial },
        dirty: true,
      };
    case 'SELECT_SHOT':
      return {
        ...state,
        activeShotId: action.shotId,
        properties: action.properties,
        editing: null,
        dirty: false,
      };
    case 'START_EDIT':
      return { ...state, editing: { field: action.field, draft: action.currentValue } };
    case 'SET_EDIT_DRAFT':
      if (!state.editing) return state;
      return { ...state, editing: { ...state.editing, draft: action.draft } };
    case 'SAVE_EDIT':
      if (!state.editing) return state;
      return {
        ...state,
        properties: { ...state.properties, [state.editing.field]: state.editing.draft },
        editing: null,
        dirty: true,
      };
    case 'CANCEL_EDIT':
      return { ...state, editing: null };
    case 'TOGGLE_SECTION': {
      const sections = { ...state.expandedSections };
      sections[action.section] = !sections[action.section];
      return { ...state, expandedSections: sections };
    }
    case 'LOAD_SECTIONS':
      return { ...state, expandedSections: action.sections };
    default:
      return state;
  }
}

export const INITIAL_INSPECTOR_STATE: InspectorUIState = {
  activeShotId: null,
  properties: DEFAULT_SHOT_PROPERTIES,
  editing: null,
  expandedSections: DEFAULT_EXPANDED_SECTIONS,
  dirty: false,
};

// ============================================
// Expanded sections — localStorage persistence
// ============================================

const SECTIONS_KEY = PRODUCTION_STORAGE_KEYS.manuscriptExpandedSections;

export const expandedSectionsSchema = z.object({
  audio: z.boolean().optional(),
  camera: z.boolean().optional(),
  lighting: z.boolean().optional(),
  references: z.boolean().optional(),
});

export function loadExpandedSections(projectId?: string): ExpandedSections {
  try {
    const raw = localStorage.getItem(buildProductionScopedPreferenceKey(SECTIONS_KEY, projectId))
      ?? localStorage.getItem(SECTIONS_KEY);
    if (raw) {
      const parsedResult = expandedSectionsSchema.safeParse(JSON.parse(raw));
      if (parsedResult.success) {
        return { ...DEFAULT_EXPANDED_SECTIONS, ...parsedResult.data };
      }
    }
  } catch { /* SSR / incognito */ }
  return DEFAULT_EXPANDED_SECTIONS;
}

export function saveExpandedSections(sections: ExpandedSections, projectId?: string): void {
  try { localStorage.setItem(buildProductionScopedPreferenceKey(SECTIONS_KEY, projectId), JSON.stringify(sections)); } catch { /* noop */ }
}
