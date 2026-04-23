import {
  DEFAULT_SETTINGS,
  type EditModuleKey,
  type EnhancementSettings,
  type PerFaceEnhancementPatch,
} from './module-contract';
import { applyClipboardToSettings, diffModules } from './edit-clipboard';
import {
  EMPTY_HISTORY,
  pushHistoryEntry,
  stepRedo,
  stepUndo,
  type EditHistoryEntry,
} from './edit-history';
import type {
  AiSuggestionSummary,
  CullFilter,
  DetectedFace,
  EditClipboard,
  ExportPreset,
  FaceDetectionStatus,
  SessionImage,
  SessionImageFlag,
  SessionState,
  StarRating,
} from './types';
import { SESSION_INITIAL } from './types';

/**
 * Pure reducer for enhancer session state. No DOM, no fetch, no blob URL
 * allocation — side-effectful work belongs in the hook layer. Keeping the
 * reducer pure is what lets the unit tests drive a realistic flow in a
 * few dozen lines without jsdom.
 */

export type SessionAction =
  | { type: 'ADD_IMAGES'; images: SessionImage[] }
  | { type: 'REMOVE_IMAGE'; imageId: string }
  | { type: 'CLEAR_ALL' }
  | { type: 'SELECT_IMAGE'; imageId: string }
  | { type: 'TOGGLE_MULTI_SELECT'; imageId: string; additive: boolean }
  | { type: 'SELECT_RANGE'; anchorId: string; targetId: string }
  | { type: 'SET_SETTINGS'; imageId: string; settings: EnhancementSettings }
  | { type: 'PATCH_SETTINGS'; imageId: string; patch: Partial<EnhancementSettings> }
  | { type: 'SET_ENHANCED_URL'; imageId: string; url: string | undefined }
  | { type: 'SET_AI_SUGGESTION'; imageId: string; suggestion: AiSuggestionSummary; recipe: Partial<EnhancementSettings> }
  | { type: 'CLEAR_AI_SUGGESTED_RECIPE'; imageId: string }
  | { type: 'SET_ANALYSIS'; imageId: string; analysis: Record<string, unknown> }
  | { type: 'SET_RATING'; imageId: string; rating: StarRating }
  | { type: 'SET_FLAG'; imageId: string; flag: SessionImageFlag }
  | { type: 'COPY_EDITS'; imageId: string }
  | { type: 'CLEAR_CLIPBOARD' }
  | { type: 'PASTE_EDITS'; targetIds: string[]; modules: EditModuleKey[] }
  | { type: 'RESET_MODULES'; imageId: string; modules: EditModuleKey[] }
  | { type: 'APPLY_SETTINGS_TO_SELECTION'; sourceId: string; modules: EditModuleKey[] }
  | { type: 'ADD_EXPORT_PRESET'; preset: ExportPreset }
  | { type: 'UPDATE_EXPORT_PRESET'; preset: ExportPreset }
  | { type: 'REMOVE_EXPORT_PRESET'; presetId: string }
  | { type: 'SELECT_EXPORT_PRESET'; presetId: string | null }
  | { type: 'SET_CULL_FILTER'; filter: CullFilter }
  | { type: 'ASSIGN_BURSTS'; assignments: ReadonlyArray<{ imageId: string; burstId: string | null }> }
  | { type: 'APPLY_RATING_TO_BURST'; burstId: string; rating: StarRating }
  | { type: 'APPLY_FLAG_TO_BURST'; burstId: string; flag: SessionImageFlag }
  | { type: 'COMMIT_HISTORY'; imageId: string; label?: string; now?: number }
  | { type: 'UNDO_HISTORY'; imageId: string }
  | { type: 'REDO_HISTORY'; imageId: string }
  | { type: 'SET_FACE_STATUS'; imageId: string; status: FaceDetectionStatus }
  | { type: 'SET_FACES'; imageId: string; faces: DetectedFace[] }
  | { type: 'SET_ACTIVE_FACE_INDEX'; faceIndex: number | null }
  | { type: 'PATCH_FACE_SETTINGS'; imageId: string; faceIndex: number; patch: PerFaceEnhancementPatch }
  | { type: 'CLEAR_FACE_OVERRIDES'; imageId: string; faceIndex?: number }
  | { type: 'COPY_FACE_OVERRIDE'; imageId: string; sourceFaceIndex: number; targetFaceIndices: number[] };

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'ADD_IMAGES': {
      if (action.images.length === 0) return state;
      const withSequences = action.images.map((image, offset) => ({
        ...image,
        sequence: image.sequence || state.nextSequence + offset,
      }));
      const images = [...state.images, ...withSequences];
      return {
        ...state,
        images,
        nextSequence: state.nextSequence + action.images.length,
        selectedId: state.selectedId ?? withSequences[0].id,
      };
    }

    case 'REMOVE_IMAGE': {
      const idx = state.images.findIndex((i) => i.id === action.imageId);
      if (idx < 0) return state;
      const images = state.images.filter((i) => i.id !== action.imageId);
      const selectedId =
        state.selectedId === action.imageId
          ? images[Math.min(idx, images.length - 1)]?.id ?? null
          : state.selectedId;
      return {
        ...state,
        images,
        selectedId,
        multiSelectIds: state.multiSelectIds.filter((id) => id !== action.imageId),
      };
    }

    case 'CLEAR_ALL':
      return SESSION_INITIAL;

    case 'SELECT_IMAGE': {
      if (!state.images.some((i) => i.id === action.imageId)) return state;
      if (state.selectedId === action.imageId && state.multiSelectIds.length === 0) return state;
      return { ...state, selectedId: action.imageId, multiSelectIds: [] };
    }

    case 'TOGGLE_MULTI_SELECT': {
      if (!state.images.some((i) => i.id === action.imageId)) return state;
      if (!action.additive) {
        return { ...state, selectedId: action.imageId, multiSelectIds: [] };
      }
      const present = state.multiSelectIds.includes(action.imageId);
      const multi = present
        ? state.multiSelectIds.filter((id) => id !== action.imageId)
        : [...state.multiSelectIds, action.imageId];
      return { ...state, multiSelectIds: multi };
    }

    case 'SELECT_RANGE': {
      const a = state.images.findIndex((i) => i.id === action.anchorId);
      const b = state.images.findIndex((i) => i.id === action.targetId);
      if (a < 0 || b < 0) return state;
      const [lo, hi] = a <= b ? [a, b] : [b, a];
      const range = state.images.slice(lo, hi + 1).map((i) => i.id);
      return { ...state, selectedId: action.targetId, multiSelectIds: range };
    }

    case 'SET_SETTINGS':
      return patchImage(state, action.imageId, (img) => ({ ...img, settings: action.settings }));

    case 'PATCH_SETTINGS':
      return patchImage(state, action.imageId, (img) => ({
        ...img,
        settings: { ...img.settings, ...action.patch },
      }));

    case 'SET_ENHANCED_URL':
      return patchImage(state, action.imageId, (img) => ({ ...img, enhancedUrl: action.url }));

    case 'SET_AI_SUGGESTION':
      return patchImage(state, action.imageId, (img) => ({
        ...img,
        aiSuggestion: action.suggestion,
        aiSuggestedRecipe: action.recipe,
        settings: { ...img.settings, ...action.recipe },
      }));

    case 'CLEAR_AI_SUGGESTED_RECIPE':
      return patchImage(state, action.imageId, (img) => ({
        ...img,
        aiSuggestedRecipe: undefined,
      }));

    case 'SET_ANALYSIS':
      return patchImage(state, action.imageId, (img) => ({ ...img, analysisResult: action.analysis }));

    case 'SET_RATING':
      return patchImage(state, action.imageId, (img) => ({ ...img, rating: action.rating }));

    case 'SET_FLAG':
      return patchImage(state, action.imageId, (img) => ({ ...img, flag: action.flag }));

    case 'COPY_EDITS': {
      const src = state.images.find((i) => i.id === action.imageId);
      if (!src) return state;
      const clipboard: EditClipboard = {
        sourceId: src.id,
        sourceName: src.fileName,
        settings: { ...src.settings },
        snapshotAt: Date.now(),
      };
      return { ...state, clipboard };
    }

    case 'CLEAR_CLIPBOARD':
      return { ...state, clipboard: null };

    case 'PASTE_EDITS': {
      if (!state.clipboard || action.targetIds.length === 0 || action.modules.length === 0) {
        return state;
      }
      const modules = new Set(action.modules);
      const source = state.clipboard.settings;
      const ids = new Set(action.targetIds);
      const images = state.images.map((img) =>
        ids.has(img.id)
          ? { ...img, settings: applyClipboardToSettings(img.settings, source, modules) }
          : img,
      );
      return { ...state, images };
    }

    case 'RESET_MODULES': {
      if (action.modules.length === 0) return state;
      const modules = new Set(action.modules);
      return patchImage(state, action.imageId, (img) => ({
        ...img,
        settings: applyClipboardToSettings(img.settings, DEFAULT_SETTINGS, modules),
      }));
    }

    case 'APPLY_SETTINGS_TO_SELECTION': {
      const src = state.images.find((i) => i.id === action.sourceId);
      if (!src || action.modules.length === 0) return state;
      const targetIds = new Set(
        state.multiSelectIds.length > 0 ? state.multiSelectIds : state.images.map((i) => i.id),
      );
      targetIds.delete(src.id);
      if (targetIds.size === 0) return state;
      const modules = new Set(action.modules);
      const images = state.images.map((img) =>
        targetIds.has(img.id)
          ? { ...img, settings: applyClipboardToSettings(img.settings, src.settings, modules) }
          : img,
      );
      return { ...state, images };
    }

    case 'ADD_EXPORT_PRESET': {
      const exportPresets = [...state.exportPresets, action.preset];
      return {
        ...state,
        exportPresets,
        activeExportPresetId: state.activeExportPresetId ?? action.preset.id,
      };
    }

    case 'UPDATE_EXPORT_PRESET': {
      const exportPresets = state.exportPresets.map((p) =>
        p.id === action.preset.id ? action.preset : p,
      );
      return { ...state, exportPresets };
    }

    case 'REMOVE_EXPORT_PRESET': {
      const exportPresets = state.exportPresets.filter((p) => p.id !== action.presetId);
      const activeExportPresetId =
        state.activeExportPresetId === action.presetId
          ? exportPresets[0]?.id ?? null
          : state.activeExportPresetId;
      return { ...state, exportPresets, activeExportPresetId };
    }

    case 'SELECT_EXPORT_PRESET':
      return { ...state, activeExportPresetId: action.presetId };

    case 'SET_CULL_FILTER':
      return { ...state, cullFilter: action.filter };

    case 'ASSIGN_BURSTS': {
      if (action.assignments.length === 0) return state;
      const map = new Map(action.assignments.map((a) => [a.imageId, a.burstId]));
      let mutated = false;
      const images = state.images.map((image) => {
        if (!map.has(image.id)) return image;
        const nextBurst = map.get(image.id) ?? null;
        if (image.burstId === nextBurst) return image;
        mutated = true;
        return { ...image, burstId: nextBurst };
      });
      return mutated ? { ...state, images } : state;
    }

    case 'APPLY_RATING_TO_BURST': {
      if (!action.burstId) return state;
      let mutated = false;
      const images = state.images.map((image) => {
        if (image.burstId !== action.burstId) return image;
        if (image.rating === action.rating) return image;
        mutated = true;
        return { ...image, rating: action.rating };
      });
      return mutated ? { ...state, images } : state;
    }

    case 'APPLY_FLAG_TO_BURST': {
      if (!action.burstId) return state;
      let mutated = false;
      const images = state.images.map((image) => {
        if (image.burstId !== action.burstId) return image;
        if (image.flag === action.flag) return image;
        mutated = true;
        return { ...image, flag: action.flag };
      });
      return mutated ? { ...state, images } : state;
    }

    case 'COMMIT_HISTORY':
      return patchImage(state, action.imageId, (image) => {
        const current = image.history.entries[image.history.index];
        const changedModules = current ? diffModules(current.settings, image.settings) : [];
        const entry: EditHistoryEntry = {
          at: action.now ?? Date.now(),
          settings: image.settings,
          perFaceOverrides: clonePerFaceOverrides(image.perFaceOverrides),
          changedModules,
          label: action.label,
        };
        const history = pushHistoryEntry(image.history, entry);
        if (history === image.history) return image;
        return { ...image, history };
      });

    case 'UNDO_HISTORY':
      return patchImage(state, action.imageId, (image) => {
        const { history, snapshot } = stepUndo(image.history);
        if (history === image.history || !snapshot) return image;
        return {
          ...image,
          history,
          settings: snapshot.settings,
          perFaceOverrides: snapshot.perFaceOverrides
            ? clonePerFaceOverrides(snapshot.perFaceOverrides)
            : {},
        };
      });

    case 'REDO_HISTORY':
      return patchImage(state, action.imageId, (image) => {
        const { history, snapshot } = stepRedo(image.history);
        if (history === image.history || !snapshot) return image;
        return {
          ...image,
          history,
          settings: snapshot.settings,
          perFaceOverrides: snapshot.perFaceOverrides
            ? clonePerFaceOverrides(snapshot.perFaceOverrides)
            : {},
        };
      });

    case 'SET_FACE_STATUS':
      return patchImage(state, action.imageId, (image) => {
        if (image.faceStatus === action.status) return image;
        return { ...image, faceStatus: action.status };
      });

    case 'SET_FACES':
      return patchImage(state, action.imageId, (image) => ({
        ...image,
        faces: action.faces,
        faceStatus: action.faces.length > 0 ? 'ready' : 'none',
      }));

    case 'SET_ACTIVE_FACE_INDEX':
      if (state.activeFaceIndex === action.faceIndex) return state;
      return { ...state, activeFaceIndex: action.faceIndex };

    case 'PATCH_FACE_SETTINGS':
      return patchImage(state, action.imageId, (image) => {
        const prev = image.perFaceOverrides[action.faceIndex] ?? {};
        const next = { ...prev, ...action.patch };
        return {
          ...image,
          perFaceOverrides: {
            ...image.perFaceOverrides,
            [action.faceIndex]: next,
          },
        };
      });

    case 'COPY_FACE_OVERRIDE':
      return patchImage(state, action.imageId, (image) => {
        const source = image.perFaceOverrides[action.sourceFaceIndex];
        if (!source || action.targetFaceIndices.length === 0) return image;
        const nextOverrides = { ...image.perFaceOverrides };
        for (const target of action.targetFaceIndices) {
          if (target === action.sourceFaceIndex) continue;
          nextOverrides[target] = { ...source };
        }
        return { ...image, perFaceOverrides: nextOverrides };
      });

    case 'CLEAR_FACE_OVERRIDES':
      return patchImage(state, action.imageId, (image) => {
        if (action.faceIndex === undefined) {
          if (Object.keys(image.perFaceOverrides).length === 0) return image;
          return { ...image, perFaceOverrides: {} };
        }
        if (image.perFaceOverrides[action.faceIndex] === undefined) return image;
        const nextOverrides = { ...image.perFaceOverrides };
        delete nextOverrides[action.faceIndex];
        return { ...image, perFaceOverrides: nextOverrides };
      });

    default:
      return state;
  }
}

function patchImage(
  state: SessionState,
  imageId: string,
  update: (image: SessionImage) => SessionImage,
): SessionState {
  const idx = state.images.findIndex((i) => i.id === imageId);
  if (idx < 0) return state;
  const nextImage = update(state.images[idx]);
  if (nextImage === state.images[idx]) return state;
  const images = state.images.slice();
  images[idx] = nextImage;
  return { ...state, images };
}

/** Derive the active image's settings, or return a fresh default if the
 *  session is empty. Convenience helper so consumers don't reach into
 *  state.images. */
export function activeImage(state: SessionState): SessionImage | null {
  if (!state.selectedId) return null;
  return state.images.find((i) => i.id === state.selectedId) ?? null;
}

export function resolvedTargetIds(state: SessionState): string[] {
  return state.multiSelectIds.length > 0 ? state.multiSelectIds : state.images.map((i) => i.id);
}

export function filterVisibleImages(state: SessionState): SessionImage[] {
  switch (state.cullFilter) {
    case 'all':
      return state.images;
    case 'picks':
      return state.images.filter((i) => i.flag === 'pick');
    case 'rejects':
      return state.images.filter((i) => i.flag === 'reject');
    case 'unrated':
      return state.images.filter((i) => i.rating === 0 && i.flag === 'none');
    case 'five_star':
      return state.images.filter((i) => i.rating >= 5);
    case 'in_burst':
      return state.images.filter((i) => i.burstId !== null);
  }
}

export function burstSiblings(state: SessionState, burstId: string | null): SessionImage[] {
  if (!burstId) return [];
  return state.images.filter((i) => i.burstId === burstId);
}

/** Serialize an image's per-face override map for the enhance request.
 *  Runner contract is an array of ``{ faceIndex, controls }`` so we
 *  walk the record deterministically by index for stable JSON output. */
function clonePerFaceOverrides(
  overrides: Record<number, PerFaceEnhancementPatch>,
): Record<number, PerFaceEnhancementPatch> {
  const out: Record<number, PerFaceEnhancementPatch> = {};
  for (const key of Object.keys(overrides)) {
    const n = Number(key);
    out[n] = { ...overrides[n] };
  }
  return out;
}

export function serializePerFaceOverrides(
  overrides: SessionImage['perFaceOverrides'],
): Array<{ faceIndex: number; controls: PerFaceEnhancementPatch }> {
  const indices = Object.keys(overrides)
    .map((k) => Number(k))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  return indices.map((faceIndex) => ({
    faceIndex,
    controls: overrides[faceIndex],
  }));
}
