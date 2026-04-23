import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import {
  DEFAULT_SETTINGS,
  type EditModuleKey,
  type EnhancementSettings,
  type PerFaceEnhancementPatch,
} from './module-contract';
import {
  activeImage,
  resolvedTargetIds,
  sessionReducer,
  type SessionAction,
} from './session-reducer';
import {
  SESSION_INITIAL,
  type AiSuggestionSummary,
  type CullFilter,
  type SessionImage,
  type SessionImageFlag,
  type StarRating,
} from './types';
import { detectBursts } from './burst-detection';
import { EMPTY_HISTORY, pushHistoryEntry, canUndo, canRedo } from './edit-history';
import { loadCaptureSessionAssets } from './capture-session-loader';

/**
 * React hook binding `sessionReducer` to component state. The hook owns
 * blob-URL lifecycle (creating on ADD_IMAGES, revoking on REMOVE /
 * unmount / file replace) so consumers never need to think about it.
 */

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `img_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export interface UseEnhancerSession {
  state: ReturnType<typeof sessionReducer>;
  active: SessionImage | null;
  targetIds: string[];
  addFiles: (files: File[]) => SessionImage[];
  /**
   * Load every asset from a tethered-capture session and hydrate the
   * enhancer with each — preserving the iPad's rating / pick / reject
   * state so cull work doesn't evaporate on device switch. Returns the
   * created `SessionImage`s on success; rejects on list-fetch failure,
   * individual broken assets are logged and skipped.
   */
  loadCaptureSession: (sessionId: string) => Promise<SessionImage[]>;
  removeImage: (id: string) => void;
  clearAll: () => void;
  selectImage: (id: string) => void;
  toggleMultiSelect: (id: string, additive: boolean) => void;
  selectRange: (anchorId: string, targetId: string) => void;
  patchSettings: (id: string, patch: Partial<EnhancementSettings>) => void;
  setSettings: (id: string, next: EnhancementSettings) => void;
  setEnhancedUrl: (id: string, url: string | undefined) => void;
  setAiSuggestion: (id: string, summary: AiSuggestionSummary, recipe: Partial<EnhancementSettings>) => void;
  clearAiSuggestedRecipe: (id: string) => void;
  setAnalysis: (id: string, analysis: Record<string, unknown>) => void;
  setRating: (id: string, rating: StarRating) => void;
  setFlag: (id: string, flag: SessionImageFlag) => void;
  copyEdits: (id: string) => void;
  clearClipboard: () => void;
  pasteEdits: (targetIds: string[], modules: EditModuleKey[]) => void;
  resetModules: (id: string, modules: EditModuleKey[]) => void;
  applyToSelection: (sourceId: string, modules: EditModuleKey[]) => void;
  setCullFilter: (filter: CullFilter) => void;
  applyRatingToBurst: (burstId: string, rating: StarRating) => void;
  applyFlagToBurst: (burstId: string, flag: SessionImageFlag) => void;
  commitHistory: (id: string, label?: string) => void;
  undoHistory: (id: string) => void;
  redoHistory: (id: string) => void;
  activeCanUndo: boolean;
  activeCanRedo: boolean;
  setActiveFaceIndex: (faceIndex: number | null) => void;
  patchFaceSettings: (imageId: string, faceIndex: number, patch: PerFaceEnhancementPatch) => void;
  clearFaceOverrides: (imageId: string, faceIndex?: number) => void;
  copyFaceOverride: (imageId: string, sourceFaceIndex: number, targetFaceIndices: number[]) => void;
  dispatch: React.Dispatch<SessionAction>;
}

export function useEnhancerSession(): UseEnhancerSession {
  const [state, dispatch] = useReducer(sessionReducer, SESSION_INITIAL);
  const ownedUrlsRef = useRef<Set<string>>(new Set());
  const priorImagesRef = useRef(state.images);

  // Revoke blob URLs for images that disappear from state. React's effect
  // fires after render so we diff against the last snapshot — no leaks
  // even when an image is removed via CLEAR_ALL or REMOVE_IMAGE.
  useEffect(() => {
    const current = new Set(state.images.map((i) => i.previewUrl));
    for (const prior of priorImagesRef.current) {
      if (!current.has(prior.previewUrl) && ownedUrlsRef.current.has(prior.previewUrl)) {
        try {
          URL.revokeObjectURL(prior.previewUrl);
        } catch {
          // ignore — revoke can throw on some hardened CSPs; not worth surfacing.
        }
        ownedUrlsRef.current.delete(prior.previewUrl);
      }
    }
    priorImagesRef.current = state.images;
  }, [state.images]);

  useEffect(() => {
    return () => {
      for (const url of ownedUrlsRef.current) {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      }
      ownedUrlsRef.current.clear();
    };
  }, []);

  const addFiles = useCallback((files: File[]): SessionImage[] => {
    if (files.length === 0) return [];
    const created = files.map<SessionImage>((file) => {
      const previewUrl = URL.createObjectURL(file);
      ownedUrlsRef.current.add(previewUrl);
      const initialSettings = { ...DEFAULT_SETTINGS };
      // Seed history with the initial defaults so the first undo returns
      // the user to "pre-edit" rather than to a surprising zero state.
      const history = pushHistoryEntry(EMPTY_HISTORY, {
        at: Date.now(),
        settings: initialSettings,
        changedModules: [],
        label: 'Opprinnelig',
      });
      return {
        id: makeId(),
        file,
        previewUrl,
        fileName: file.name,
        sizeBytes: file.size,
        mimeType: file.type || 'application/octet-stream',
        lastModified: file.lastModified,
        settings: initialSettings,
        rating: 0,
        flag: 'none',
        sequence: 0,
        burstId: null,
        history,
        faceStatus: 'idle',
        perFaceOverrides: {},
      };
    });
    dispatch({ type: 'ADD_IMAGES', images: created });
    return created;
  }, []);

  /**
   * Hydrate the session from a tethered-capture session id. Reuses the
   * normal `ADD_IMAGES` dispatch path so every downstream surface
   * (filmstrip, cull view, burst detection, enhance pipeline) sees the
   * images as normal session images — just with rating / flag / sequence
   * pre-populated from iPad state.
   */
  const loadCaptureSession = useCallback(
    async (sessionId: string): Promise<SessionImage[]> => {
      const hydrated = await loadCaptureSessionAssets(sessionId);
      if (hydrated.length === 0) return [];
      const created = hydrated.map<SessionImage>((h) => {
        const previewUrl = URL.createObjectURL(h.file);
        ownedUrlsRef.current.add(previewUrl);
        const initialSettings = { ...DEFAULT_SETTINGS };
        const history = pushHistoryEntry(EMPTY_HISTORY, {
          at: Date.now(),
          settings: initialSettings,
          changedModules: [],
          label: 'Opprinnelig',
        });
        return {
          id: makeId(),
          file: h.file,
          previewUrl,
          fileName: h.fileName,
          sizeBytes: h.sizeBytes,
          mimeType: h.mimeType,
          lastModified: h.lastModified,
          settings: initialSettings,
          rating: h.rating,
          flag: h.flag,
          sequence: h.sequence,
          burstId: null,
          history,
          faceStatus: 'idle',
          perFaceOverrides: {},
        };
      });
      dispatch({ type: 'ADD_IMAGES', images: created });
      return created;
    },
    [],
  );

  const removeImage = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_IMAGE', imageId: id });
  }, []);

  const clearAll = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' });
  }, []);

  const selectImage = useCallback((id: string) => {
    dispatch({ type: 'SELECT_IMAGE', imageId: id });
  }, []);

  const toggleMultiSelect = useCallback((id: string, additive: boolean) => {
    dispatch({ type: 'TOGGLE_MULTI_SELECT', imageId: id, additive });
  }, []);

  const selectRange = useCallback((anchorId: string, targetId: string) => {
    dispatch({ type: 'SELECT_RANGE', anchorId, targetId });
  }, []);

  const patchSettings = useCallback((id: string, patch: Partial<EnhancementSettings>) => {
    dispatch({ type: 'PATCH_SETTINGS', imageId: id, patch });
  }, []);

  const setSettings = useCallback((id: string, next: EnhancementSettings) => {
    dispatch({ type: 'SET_SETTINGS', imageId: id, settings: next });
  }, []);

  const setEnhancedUrl = useCallback((id: string, url: string | undefined) => {
    dispatch({ type: 'SET_ENHANCED_URL', imageId: id, url });
  }, []);

  const setAiSuggestion = useCallback(
    (id: string, summary: AiSuggestionSummary, recipe: Partial<EnhancementSettings>) => {
      dispatch({ type: 'SET_AI_SUGGESTION', imageId: id, suggestion: summary, recipe });
    },
    [],
  );

  const clearAiSuggestedRecipe = useCallback((id: string) => {
    dispatch({ type: 'CLEAR_AI_SUGGESTED_RECIPE', imageId: id });
  }, []);

  const setAnalysis = useCallback((id: string, analysis: Record<string, unknown>) => {
    dispatch({ type: 'SET_ANALYSIS', imageId: id, analysis });
  }, []);

  const setRating = useCallback((id: string, rating: StarRating) => {
    dispatch({ type: 'SET_RATING', imageId: id, rating });
  }, []);

  const setFlag = useCallback((id: string, flag: SessionImageFlag) => {
    dispatch({ type: 'SET_FLAG', imageId: id, flag });
  }, []);

  const copyEdits = useCallback((id: string) => {
    dispatch({ type: 'COPY_EDITS', imageId: id });
  }, []);

  const clearClipboard = useCallback(() => {
    dispatch({ type: 'CLEAR_CLIPBOARD' });
  }, []);

  const pasteEdits = useCallback((targetIds: string[], modules: EditModuleKey[]) => {
    dispatch({ type: 'PASTE_EDITS', targetIds, modules });
  }, []);

  const resetModules = useCallback((id: string, modules: EditModuleKey[]) => {
    dispatch({ type: 'RESET_MODULES', imageId: id, modules });
  }, []);

  const applyToSelection = useCallback((sourceId: string, modules: EditModuleKey[]) => {
    dispatch({ type: 'APPLY_SETTINGS_TO_SELECTION', sourceId, modules });
  }, []);

  const setCullFilter = useCallback((filter: CullFilter) => {
    dispatch({ type: 'SET_CULL_FILTER', filter });
  }, []);

  const applyRatingToBurst = useCallback((burstId: string, rating: StarRating) => {
    dispatch({ type: 'APPLY_RATING_TO_BURST', burstId, rating });
  }, []);

  const applyFlagToBurst = useCallback((burstId: string, flag: SessionImageFlag) => {
    dispatch({ type: 'APPLY_FLAG_TO_BURST', burstId, flag });
  }, []);

  const commitHistory = useCallback((id: string, label?: string) => {
    dispatch({ type: 'COMMIT_HISTORY', imageId: id, label });
  }, []);

  const undoHistory = useCallback((id: string) => {
    dispatch({ type: 'UNDO_HISTORY', imageId: id });
  }, []);

  const redoHistory = useCallback((id: string) => {
    dispatch({ type: 'REDO_HISTORY', imageId: id });
  }, []);

  const setActiveFaceIndex = useCallback((faceIndex: number | null) => {
    dispatch({ type: 'SET_ACTIVE_FACE_INDEX', faceIndex });
  }, []);

  const patchFaceSettings = useCallback(
    (imageId: string, faceIndex: number, patch: PerFaceEnhancementPatch) => {
      dispatch({ type: 'PATCH_FACE_SETTINGS', imageId, faceIndex, patch });
    },
    [],
  );

  const clearFaceOverrides = useCallback((imageId: string, faceIndex?: number) => {
    dispatch({ type: 'CLEAR_FACE_OVERRIDES', imageId, faceIndex });
  }, []);

  const copyFaceOverride = useCallback(
    (imageId: string, sourceFaceIndex: number, targetFaceIndices: number[]) => {
      dispatch({ type: 'COPY_FACE_OVERRIDE', imageId, sourceFaceIndex, targetFaceIndices });
    },
    [],
  );

  // Re-run burst detection whenever the image set changes. Pure function
  // drives straight from (id, fileName, lastModified) → the ASSIGN_BURSTS
  // action. Guarded so we only dispatch when assignments actually differ.
  useEffect(() => {
    if (state.images.length === 0) return;
    const inputs = state.images.map((image) => ({
      id: image.id,
      fileName: image.fileName,
      lastModified: image.lastModified,
    }));
    const assignments = detectBursts(inputs);
    const diff = assignments.some((a) => {
      const image = state.images.find((i) => i.id === a.imageId);
      return image ? image.burstId !== a.burstId : false;
    });
    if (diff) {
      dispatch({ type: 'ASSIGN_BURSTS', assignments });
    }
  }, [state.images]);

  const active = useMemo(() => activeImage(state), [state]);
  const targetIds = useMemo(() => resolvedTargetIds(state), [state]);
  const activeCanUndo = active ? canUndo(active.history) : false;
  const activeCanRedo = active ? canRedo(active.history) : false;

  return {
    state,
    active,
    targetIds,
    addFiles,
    loadCaptureSession,
    removeImage,
    clearAll,
    selectImage,
    toggleMultiSelect,
    selectRange,
    patchSettings,
    setSettings,
    setEnhancedUrl,
    setAiSuggestion,
    clearAiSuggestedRecipe,
    setAnalysis,
    setRating,
    setFlag,
    copyEdits,
    clearClipboard,
    pasteEdits,
    resetModules,
    applyToSelection,
    setCullFilter,
    applyRatingToBurst,
    applyFlagToBurst,
    commitHistory,
    undoHistory,
    redoHistory,
    activeCanUndo,
    activeCanRedo,
    setActiveFaceIndex,
    patchFaceSettings,
    clearFaceOverrides,
    copyFaceOverride,
    dispatch,
  };
}
