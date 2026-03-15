/**
 * useLiveSet – Deterministic Live Set state engine
 *
 * State flow:
 *   idle -> rolling -> cut -> setup-complete -> idle
 *
 * Guarantees:
 *   • Guarded transitions (scene required before roll, no duplicate cut, no take without shot)
 *   • Deterministic sequence number per mutation
 *   • Offline-first sync queue (IndexedDB + localStorage fallback)
 *   • Idempotent event delivery to backend via eventId
 */

import { useReducer, useEffect, useCallback, useMemo, useRef, type Reducer } from 'react';
import type {
  LiveSetScene,
  QuickActionType,
  TakeStatus,
  NoteTag,
} from '../models/casting';
import { castingService } from '../services/castingService';
import {
  enqueueLiveSetEvent,
  getLiveSetQueueDepth,
  getPendingLiveSetQueue,
  markLiveSetQueueSyncing,
  markLiveSetQueueAcked,
  markLiveSetQueueFailed,
  setLiveSetSyncMeta,
} from '../services/liveSetSyncStore';
import type {
  LiveSetBatchIngestRequest,
  LiveSetConflictRecord,
  LiveSetEvent,
  LiveSetEventType,
  LiveSetSyncQueueItem,
} from '../types/liveSetContracts';

// ── Helpers ──────────────────────────────────────────────────────────────────

const uid = (prefix = 'ls') => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const nowIso = () => new Date().toISOString();

const STORAGE_KEY_BASE = 'liveset_session_v2';
const DEVICE_ID_STORAGE_KEY = 'liveset_device_id_v1';

const CIRCUIT_BREAKER_FAILURES = 4;
const CIRCUIT_BREAKER_COOLDOWN_MS = 30_000;
const SYNC_POLL_MS = 2_500;
const SYNC_BATCH_LIMIT = 120;

function parseProjectScopedStorageKey(projectId?: string): string {
  return `${STORAGE_KEY_BASE}:${projectId || 'global'}`;
}

function getOrCreateDeviceId(explicitDeviceId?: string): string {
  if (explicitDeviceId && explicitDeviceId.trim()) return explicitDeviceId.trim();
  if (typeof window === 'undefined') return uid('device');
  try {
    const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing && existing.trim()) return existing.trim();
    const created = `device-${uid('rr')}`;
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, created);
    return created;
  } catch {
    return `device-${uid('rr')}`;
  }
}

function toBackoffDelayMs(attempt: number): number {
  const base = Math.min(60_000, 1_000 * 2 ** Math.min(8, Math.max(0, attempt)));
  const jitter = Math.floor(Math.random() * 400);
  return base + jitter;
}

function sanitizeTakeStatus(status: TakeStatus): TakeStatus {
  if (status === 'pending') return 'normal';
  return status;
}

function resolveEventTypeForAction(actionType: LiveSetAction['type']): LiveSetEventType | null {
  switch (actionType) {
    case 'ROLL':
      return 'roll';
    case 'CUT':
      return 'cut';
    case 'SETUP_COMPLETE':
      return 'setup_complete';
    case 'ADVANCE_SCENE':
      return 'advance_scene';
    case 'SET_TAKE_STATUS':
      return 'set_take_status';
    case 'ADD_FLAG':
      return 'add_flag';
    case 'ADD_NOTE':
      return 'add_note';
    case 'UPDATE_NOTE':
      return 'update_note';
    case 'DELETE_NOTE':
      return 'delete_note';
    case 'SET_CAMERA':
      return 'set_camera';
    case 'SET_SCENE':
      return 'set_scene';
    case 'SET_SETUP':
      return 'set_setup';
    case 'SET_CAM':
      return 'set_cam';
    case 'CAPTURE_TAKE':
      return 'capture_take';
    default:
      return null;
  }
}

interface EventMeta {
  eventId: string;
  seq: number;
  capturedAt: string;
}

function toEventPayload(action: LiveSetAction): Record<string, unknown> {
  switch (action.type) {
    case 'ROLL':
      return {};
    case 'CUT':
      return {};
    case 'SETUP_COMPLETE':
      return {};
    case 'ADVANCE_SCENE':
      return {};
    case 'SET_TAKE_STATUS':
      return { id: action.id, status: action.status };
    case 'ADD_FLAG':
      return { flag: action.flag };
    case 'ADD_NOTE':
      return {};
    case 'UPDATE_NOTE':
      return { id: action.id, content: action.content };
    case 'DELETE_NOTE':
      return { id: action.id };
    case 'SET_CAMERA':
      return { ...action.metadata };
    case 'SET_SCENE':
      return { sceneId: action.scene.id, scene: action.scene };
    case 'SET_SETUP':
      return { label: action.label };
    case 'SET_CAM':
      return { cam: action.cam };
    case 'CAPTURE_TAKE':
      return { ...action.payload };
    default:
      return {};
  }
}

// ── State ────────────────────────────────────────────────────────────────────

type LiveSetOperationalState = 'idle' | 'rolling' | 'cut' | 'setup-complete';

export interface LiveSetCameraMetadata {
  deviceId?: string;
  camera?: string;
  lens?: string;
  fps?: number;
  iso?: number;
  resolution?: string;
  [key: string]: unknown;
}

export interface LiveSetTake {
  id: string;
  sceneId: string;
  shotId: string;
  shotLabel?: string;
  setupLabel: string;
  takeNumber: number;
  duration: number | null;
  status: TakeStatus;
  camera?: string;
  lens?: string;
  fps?: number;
  flags: string[];
  notes?: string;
  loggedBy: string;
  loggedAt: string;
  synced: boolean;
  [key: string]: unknown;
}

export interface LiveSetNote {
  id: string;
  sceneId: string;
  content: string;
  tag: NoteTag;
  author: string;
  timestamp: string;
  synced: boolean;
  [key: string]: unknown;
}

export interface LiveSetUIState {
  liveState: LiveSetOperationalState;
  timerStartedAt: number | null;
  lastDuration: number | null;
  currentScene: LiveSetScene | null;
  activeSetup: string;
  activeCam: string;
  takes: LiveSetTake[];
  notes: LiveSetNote[];
  cameraMetadata: LiveSetCameraMetadata;
  activityTab: 'takes' | 'notes';
  focusedTakeIndex: number;
  noteInput: string;
  noteTag: NoteTag;
  isOffline: boolean;
  pendingSyncCount: number;
  sessionId: string;
  operatorId: string;
  deviceId: string;
  seq: number;
  activeRollToken: string | null;
  lastCutRollToken: string | null;
  lastError: string | null;
  syncConflicts: LiveSetConflictRecord[];
}

export interface CaptureTakePayload {
  shotId: string;
  shotLabel?: string;
  quality?: TakeStatus;
  notes?: string;
  continuityFlags?: string[];
  camera?: string;
  lens?: string;
  fps?: number;
}

export interface UseLiveSetOptions {
  initialScene?: LiveSetScene;
  projectId?: string;
  shootingDayId?: string;
  operatorId?: string;
  deviceId?: string;
  autoSync?: boolean;
}

type UseLiveSetArg = LiveSetScene | UseLiveSetOptions | undefined;

function looksLikeOptions(arg: UseLiveSetArg): arg is UseLiveSetOptions {
  if (!arg || typeof arg !== 'object') return false;
  const asRecord = arg as Record<string, unknown>;
  return (
    'initialScene' in asRecord
    || 'projectId' in asRecord
    || 'shootingDayId' in asRecord
    || 'operatorId' in asRecord
    || 'deviceId' in asRecord
    || 'autoSync' in asRecord
  );
}

export function makeInitialState(options?: UseLiveSetOptions): LiveSetUIState {
  const operatorId = options?.operatorId?.trim() || 'local-user';
  const deviceId = getOrCreateDeviceId(options?.deviceId);
  return {
    liveState: 'idle',
    timerStartedAt: null,
    lastDuration: null,
    currentScene: options?.initialScene ?? null,
    activeSetup: 'A',
    activeCam: 'Cam A',
    takes: [],
    notes: [],
    cameraMetadata: { camera: 'Cam A', fps: 24, iso: 800 },
    activityTab: 'takes',
    focusedTakeIndex: -1,
    noteInput: '',
    noteTag: 'general',
    isOffline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
    pendingSyncCount: 0,
    sessionId: uid('session'),
    operatorId,
    deviceId,
    seq: 0,
    activeRollToken: null,
    lastCutRollToken: null,
    lastError: null,
    syncConflicts: [],
  };
}

function hydrateStateFromStorage(
  storageKey: string,
  options: {
    initialScene?: LiveSetScene;
    operatorId: string;
    deviceId: string;
  },
): LiveSetUIState {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw) as LiveSetUIState;
      return {
        ...parsed,
        // Always reopen in a safe idle state.
        // Persisted rolling/cut sessions from an earlier visit should never auto-start on mount.
        liveState: 'idle',
        timerStartedAt: null,
        takes: Array.isArray(parsed.takes) ? parsed.takes : [],
        notes: Array.isArray(parsed.notes) ? parsed.notes : [],
        cameraMetadata:
          parsed.cameraMetadata && typeof parsed.cameraMetadata === 'object'
            ? parsed.cameraMetadata
            : { camera: 'Cam A', fps: 24, iso: 800 },
        pendingSyncCount: typeof parsed.pendingSyncCount === 'number' ? parsed.pendingSyncCount : 0,
        sessionId: parsed.sessionId || uid('session'),
        operatorId: parsed.operatorId || options.operatorId,
        deviceId: parsed.deviceId || options.deviceId,
        seq: typeof parsed.seq === 'number' ? parsed.seq : 0,
        activeRollToken: null,
        lastCutRollToken: typeof parsed.lastCutRollToken === 'string' ? parsed.lastCutRollToken : null,
        lastError: typeof parsed.lastError === 'string' ? parsed.lastError : null,
        isOffline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
        syncConflicts: Array.isArray(parsed.syncConflicts) ? parsed.syncConflicts : [],
      };
    }
  } catch {
    // Ignore malformed persisted state
  }

  return makeInitialState({
    initialScene: options.initialScene,
    operatorId: options.operatorId,
    deviceId: options.deviceId,
  });
}

// ── Actions ───────────────────────────────────────────────────────────────────

export type LiveSetAction =
  | { type: 'ROLL'; meta?: EventMeta }
  | { type: 'CUT'; meta?: EventMeta }
  | { type: 'SETUP_COMPLETE'; meta?: EventMeta }
  | { type: 'ADVANCE_SCENE'; meta?: EventMeta }
  | { type: 'SET_TAKE_STATUS'; id: string; status: TakeStatus; meta?: EventMeta }
  | { type: 'ADD_FLAG'; flag: QuickActionType; meta?: EventMeta }
  | { type: 'ADD_NOTE'; meta?: EventMeta }
  | { type: 'DELETE_NOTE'; id: string; meta?: EventMeta }
  | { type: 'UPDATE_NOTE'; id: string; content: string; meta?: EventMeta }
  | { type: 'SET_NOTE_INPUT'; value: string }
  | { type: 'SET_NOTE_TAG'; tag: NoteTag }
  | { type: 'SET_ACTIVITY_TAB'; tab: 'takes' | 'notes' }
  | { type: 'FOCUS_TAKE'; index: number }
  | { type: 'SET_CAMERA'; metadata: Partial<LiveSetCameraMetadata>; meta?: EventMeta }
  | { type: 'SET_SCENE'; scene: LiveSetScene; meta?: EventMeta }
  | { type: 'SET_SETUP'; label: string; meta?: EventMeta }
  | { type: 'SET_CAM'; cam: string; meta?: EventMeta }
  | { type: 'SET_OFFLINE'; offline: boolean }
  | { type: 'SET_PENDING_SYNC_COUNT'; count: number }
  | { type: 'SET_LAST_ERROR'; error: string | null }
  | { type: 'SET_SYNC_CONFLICTS'; conflicts: LiveSetConflictRecord[] }
  | { type: 'MARK_SYNCED' }
  | { type: 'CAPTURE_TAKE'; payload: CaptureTakePayload; meta?: EventMeta }
  | { type: 'LOAD_PERSISTED'; state: LiveSetUIState };

function applyMutationMeta(state: LiveSetUIState, meta?: EventMeta): LiveSetUIState {
  if (!meta) return { ...state, lastError: null };
  return {
    ...state,
    seq: Math.max(state.seq, meta.seq),
    lastError: null,
  };
}

// ── Reducer ───────────────────────────────────────────────────────────────────

export function liveSetReducer(state: LiveSetUIState, action: LiveSetAction): LiveSetUIState {
  switch (action.type) {
    case 'ROLL': {
      if (!state.currentScene?.id) {
        return { ...state, lastError: 'Kan ikke starte opptak uten aktiv scene' };
      }
      if (state.liveState === 'rolling') return state;
      const next = applyMutationMeta(state, action.meta);
      return {
        ...next,
        liveState: 'rolling',
        timerStartedAt: Date.now(),
        lastDuration: null,
        activeRollToken: action.meta?.eventId ?? state.activeRollToken,
      };
    }

    case 'CUT': {
      if (state.liveState !== 'rolling' || !state.timerStartedAt) {
        return { ...state, lastError: 'CUT krever aktiv ROLL' };
      }
      if (state.activeRollToken && state.lastCutRollToken === state.activeRollToken) {
        return { ...state, lastError: 'Dobbel CUT blokkert for samme take' };
      }
      const elapsed = Math.round((Date.now() - state.timerStartedAt) / 1000);
      const num = state.takes.filter((t) => t.setupLabel === state.activeSetup).length + 1;
      const newTake: LiveSetTake = {
        id: uid('take'),
        sceneId: state.currentScene?.id ?? 'unknown',
        shotId: `shot-${state.currentScene?.id ?? 'unknown'}`,
        setupLabel: state.activeSetup,
        takeNumber: num,
        duration: elapsed,
        status: 'normal',
        camera: state.activeCam,
        lens: state.cameraMetadata.lens,
        fps: typeof state.cameraMetadata.fps === 'number' ? state.cameraMetadata.fps : undefined,
        flags: [],
        loggedBy: state.operatorId,
        loggedAt: nowIso(),
        synced: false,
      };
      const next = applyMutationMeta(state, action.meta);
      return {
        ...next,
        liveState: 'cut',
        timerStartedAt: null,
        lastDuration: elapsed,
        takes: [newTake, ...state.takes],
        focusedTakeIndex: 0,
        pendingSyncCount: state.pendingSyncCount + 1,
        lastCutRollToken: state.activeRollToken,
        activeRollToken: null,
      };
    }

    case 'CAPTURE_TAKE': {
      if (!action.payload.shotId?.trim()) {
        return { ...state, lastError: 'captureTake krever shot-id' };
      }
      const num = state.takes.filter((t) => t.setupLabel === state.activeSetup).length + 1;
      const newTake: LiveSetTake = {
        id: uid('take'),
        sceneId: state.currentScene?.id ?? 'unknown',
        shotId: action.payload.shotId,
        shotLabel: action.payload.shotLabel,
        setupLabel: state.activeSetup,
        takeNumber: num,
        duration: state.lastDuration,
        status: sanitizeTakeStatus(action.payload.quality ?? 'normal'),
        camera: action.payload.camera ?? state.activeCam,
        lens: action.payload.lens ?? state.cameraMetadata.lens,
        fps: action.payload.fps ?? state.cameraMetadata.fps,
        flags: Array.isArray(action.payload.continuityFlags) ? action.payload.continuityFlags : [],
        notes: action.payload.notes?.trim() || undefined,
        loggedBy: state.operatorId,
        loggedAt: nowIso(),
        synced: false,
      };
      const next = applyMutationMeta(state, action.meta);
      return {
        ...next,
        liveState: 'cut',
        timerStartedAt: null,
        takes: [newTake, ...state.takes],
        focusedTakeIndex: 0,
        pendingSyncCount: state.pendingSyncCount + 1,
      };
    }

    case 'SETUP_COMPLETE': {
      if (state.liveState === 'rolling') {
        return { ...state, lastError: 'Setup complete kan ikke trigges under opptak' };
      }
      const next = applyMutationMeta(state, action.meta);
      return { ...next, liveState: 'setup-complete' };
    }

    case 'ADVANCE_SCENE': {
      const next = applyMutationMeta(state, action.meta);
      return {
        ...next,
        liveState: 'idle',
        timerStartedAt: null,
        lastDuration: null,
        activeRollToken: null,
      };
    }

    case 'SET_TAKE_STATUS': {
      const next = applyMutationMeta(state, action.meta);
      return {
        ...next,
        takes: state.takes.map((t) => (
          t.id === action.id
            ? { ...t, status: sanitizeTakeStatus(action.status), synced: false }
            : t
        )),
        pendingSyncCount: state.pendingSyncCount + 1,
      };
    }

    case 'ADD_FLAG': {
      if (!state.takes.length) return state;
      const [latest, ...rest] = state.takes;
      const flags = latest.flags.includes(action.flag) ? latest.flags : [...latest.flags, action.flag];
      const next = applyMutationMeta(state, action.meta);
      return {
        ...next,
        takes: [{ ...latest, flags, synced: false }, ...rest],
        pendingSyncCount: state.pendingSyncCount + 1,
      };
    }

    case 'ADD_NOTE': {
      if (!state.noteInput.trim()) return state;
      const newNote: LiveSetNote = {
        id: uid('note'),
        sceneId: state.currentScene?.id ?? 'unknown',
        content: state.noteInput.trim(),
        tag: state.noteTag,
        author: state.operatorId,
        timestamp: nowIso(),
        synced: false,
      };
      const next = applyMutationMeta(state, action.meta);
      return {
        ...next,
        notes: [newNote, ...state.notes],
        noteInput: '',
        pendingSyncCount: state.pendingSyncCount + 1,
      };
    }

    case 'DELETE_NOTE': {
      const next = applyMutationMeta(state, action.meta);
      return {
        ...next,
        notes: state.notes.filter((n) => n.id !== action.id),
        pendingSyncCount: state.pendingSyncCount + 1,
      };
    }

    case 'UPDATE_NOTE': {
      const next = applyMutationMeta(state, action.meta);
      return {
        ...next,
        notes: state.notes.map((n) => (
          n.id === action.id ? { ...n, content: action.content, synced: false } : n
        )),
        pendingSyncCount: state.pendingSyncCount + 1,
      };
    }

    case 'SET_NOTE_INPUT':
      return { ...state, noteInput: action.value };
    case 'SET_NOTE_TAG':
      return { ...state, noteTag: action.tag };
    case 'SET_ACTIVITY_TAB':
      return { ...state, activityTab: action.tab };
    case 'FOCUS_TAKE': {
      const clamped = Math.max(-1, Math.min(state.takes.length - 1, action.index));
      return { ...state, focusedTakeIndex: clamped };
    }

    case 'SET_CAMERA': {
      const next = applyMutationMeta(state, action.meta);
      return {
        ...next,
        cameraMetadata: { ...state.cameraMetadata, ...action.metadata },
        activeCam: action.metadata.camera ?? state.activeCam,
        pendingSyncCount: action.meta ? state.pendingSyncCount + 1 : state.pendingSyncCount,
      };
    }

    case 'SET_SCENE': {
      const next = applyMutationMeta(state, action.meta);
      return {
        ...next,
        currentScene: action.scene,
        pendingSyncCount: action.meta ? state.pendingSyncCount + 1 : state.pendingSyncCount,
      };
    }

    case 'SET_SETUP': {
      const next = applyMutationMeta(state, action.meta);
      return {
        ...next,
        activeSetup: action.label,
        pendingSyncCount: action.meta ? state.pendingSyncCount + 1 : state.pendingSyncCount,
      };
    }

    case 'SET_CAM': {
      const next = applyMutationMeta(state, action.meta);
      return {
        ...next,
        activeCam: action.cam,
        cameraMetadata: { ...state.cameraMetadata, camera: action.cam },
        pendingSyncCount: action.meta ? state.pendingSyncCount + 1 : state.pendingSyncCount,
      };
    }

    case 'SET_OFFLINE':
      return { ...state, isOffline: action.offline };
    case 'SET_PENDING_SYNC_COUNT':
      return { ...state, pendingSyncCount: Math.max(0, action.count) };
    case 'SET_LAST_ERROR':
      return { ...state, lastError: action.error };
    case 'SET_SYNC_CONFLICTS':
      return { ...state, syncConflicts: action.conflicts.slice(-100) };

    case 'MARK_SYNCED': {
      return {
        ...state,
        takes: state.takes.map((t) => ({ ...t, synced: true })),
        notes: state.notes.map((n) => ({ ...n, synced: true })),
        pendingSyncCount: 0,
      };
    }

    case 'LOAD_PERSISTED':
      return {
        ...action.state,
        isOffline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
        syncConflicts: Array.isArray(action.state.syncConflicts) ? action.state.syncConflicts : [],
      };

    default:
      return state;
  }
}

async function syncBatch(
  projectId: string,
  sessionId: string,
  pendingItems: LiveSetSyncQueueItem[],
): Promise<{
  ackedEventIds: string[];
  conflicts: LiveSetConflictRecord[];
  rejected: Array<{ eventId: string; reason: string }>;
}> {
  const events: LiveSetEvent[] = pendingItems.map((item) => ({
    eventId: item.eventId,
    sessionId: item.sessionId,
    seq: item.seq,
    type: item.type,
    payload: item.payload,
    capturedAt: item.capturedAt,
    deviceId: item.deviceId,
    operatorId: item.operatorId,
    projectId: item.projectId,
    shootingDayId: item.shootingDayId,
  }));

  const payload: LiveSetBatchIngestRequest = { sessionId, events };
  const response = await castingService.batchIngestLiveSetEvents(projectId, payload);
  return {
    ackedEventIds: response.ackedEventIds,
    conflicts: response.conflicts,
    rejected: response.rejected.map((entry) => ({ eventId: entry.eventId, reason: entry.reason })),
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useLiveSet(arg?: UseLiveSetArg) {
  const options = looksLikeOptions(arg) ? arg : { initialScene: arg as LiveSetScene | undefined };
  const projectId = options.projectId?.trim() || '';
  const shootingDayId = options.shootingDayId?.trim() || undefined;
  const operatorId = options.operatorId?.trim() || 'local-user';
  const deviceId = useMemo(() => getOrCreateDeviceId(options.deviceId), [options.deviceId]);
  const autoSync = options.autoSync ?? true;
  const storageKey = useMemo(() => parseProjectScopedStorageKey(projectId), [projectId]);

  const [state, dispatch] = useReducer<Reducer<LiveSetUIState, LiveSetAction>, null>(
    liveSetReducer,
    null,
    () => hydrateStateFromStorage(storageKey, {
      initialScene: options.initialScene,
      operatorId,
      deviceId,
    }),
  );

  const previousStorageKeyRef = useRef(storageKey);

  useEffect(() => {
    if (previousStorageKeyRef.current === storageKey) return;
    previousStorageKeyRef.current = storageKey;
    const hydrated = hydrateStateFromStorage(storageKey, {
      initialScene: options.initialScene,
      operatorId,
      deviceId,
    });
    dispatch({ type: 'LOAD_PERSISTED', state: hydrated });
  }, [storageKey, operatorId, deviceId, options.initialScene]);

  const stateRef = useRef(state);
  const seqRef = useRef(state.seq + 1);
  const syncRef = useRef({
    inFlight: false,
    failureStreak: 0,
    circuitOpenUntil: 0,
  });

  useEffect(() => {
    stateRef.current = state;
    if (state.seq >= seqRef.current) {
      seqRef.current = state.seq + 1;
    }
  }, [state]);

  // Persist to localStorage on every state change.
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // quota exceeded, ignore
    }
  }, [storageKey, state]);

  // Online/offline listeners
  useEffect(() => {
    const onOnline = () => dispatch({ type: 'SET_OFFLINE', offline: false });
    const onOffline = () => dispatch({ type: 'SET_OFFLINE', offline: true });
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const refreshPendingSyncCount = useCallback(async () => {
    if (!projectId) return;
    const count = await getLiveSetQueueDepth(projectId);
    dispatch({ type: 'SET_PENDING_SYNC_COUNT', count });
  }, [projectId]);

  const allocateEventMeta = useCallback((): EventMeta => ({
    eventId: uid('event'),
    seq: seqRef.current++,
    capturedAt: nowIso(),
  }), []);

  const appendEventToOutbox = useCallback(async (action: LiveSetAction, meta: EventMeta) => {
    if (!projectId) return;
    const eventType = resolveEventTypeForAction(action.type);
    if (!eventType) return;
    const event: LiveSetEvent = {
      eventId: meta.eventId,
      sessionId: stateRef.current.sessionId,
      seq: meta.seq,
      type: eventType,
      payload: toEventPayload(action),
      capturedAt: meta.capturedAt,
      deviceId: stateRef.current.deviceId,
      operatorId: stateRef.current.operatorId,
      projectId,
      shootingDayId,
    };
    await enqueueLiveSetEvent(event);
    await refreshPendingSyncCount();
  }, [projectId, refreshPendingSyncCount, shootingDayId]);

  const dispatchMutation = useCallback(async (action: LiveSetAction) => {
    const meta = allocateEventMeta();
    const withMeta = { ...action, meta } as LiveSetAction;
    dispatch(withMeta);
    await appendEventToOutbox(withMeta, meta);
  }, [allocateEventMeta, appendEventToOutbox]);

  const setError = useCallback((message: string | null) => {
    dispatch({ type: 'SET_LAST_ERROR', error: message });
  }, []);

  // Register/refresh session with backend
  useEffect(() => {
    if (!projectId) return;
    void castingService.startLiveSetSession(projectId, {
      sessionId: state.sessionId,
      operatorId: state.operatorId,
      deviceId: state.deviceId,
      shootingDayId,
      metadata: {
        source: 'useLiveSet',
      },
    }).catch(() => {
      // Non-blocking: offline queue will sync once API is available.
    });
  }, [projectId, shootingDayId, state.sessionId, state.operatorId, state.deviceId]);

  // Sync scheduler (single worker)
  useEffect(() => {
    if (!autoSync || !projectId) return;
    let disposed = false;
    let timer: number | null = null;

    const tick = async () => {
      if (disposed) return;
      if (syncRef.current.inFlight) {
        timer = window.setTimeout(() => void tick(), SYNC_POLL_MS);
        return;
      }
      if (stateRef.current.isOffline) {
        timer = window.setTimeout(() => void tick(), SYNC_POLL_MS);
        return;
      }
      if (Date.now() < syncRef.current.circuitOpenUntil) {
        timer = window.setTimeout(() => void tick(), SYNC_POLL_MS);
        return;
      }

      const pending = await getPendingLiveSetQueue(projectId, SYNC_BATCH_LIMIT);
      if (pending.length === 0) {
        await refreshPendingSyncCount();
        timer = window.setTimeout(() => void tick(), SYNC_POLL_MS);
        return;
      }

      syncRef.current.inFlight = true;
      const pendingIds = pending.map((item) => item.eventId);
      await markLiveSetQueueSyncing(pendingIds);

      try {
        const result = await syncBatch(projectId, stateRef.current.sessionId, pending);

        const rejectedIds = new Set(result.rejected.map((entry) => entry.eventId));
        const ackedIds = result.ackedEventIds.filter((eventId) => !rejectedIds.has(eventId));
        const unresolved = pending
          .filter((entry) => !ackedIds.includes(entry.eventId) && !rejectedIds.has(entry.eventId))
          .map((entry) => ({ eventId: entry.eventId, reason: 'Not acked by server' }));

        if (ackedIds.length > 0) {
          await markLiveSetQueueAcked(ackedIds);
          void castingService.ackLiveSetEvents(projectId, {
            sessionId: stateRef.current.sessionId,
            eventIds: ackedIds,
          }).catch(() => {
            // Best-effort ack call.
          });
        }

        const failures = [...result.rejected, ...unresolved];
        if (failures.length > 0) {
          await markLiveSetQueueFailed(
            failures.map((entry) => {
              const existing = pending.find((item) => item.eventId === entry.eventId);
              const attempts = existing?.attempts ?? 0;
              const delay = toBackoffDelayMs(attempts + 1);
              return {
                eventId: entry.eventId,
                error: entry.reason,
                nextRetryAt: Date.now() + delay,
              };
            }),
          );
        }

        if (result.conflicts.length > 0) {
          dispatch({ type: 'SET_SYNC_CONFLICTS', conflicts: result.conflicts });
        }

        syncRef.current.failureStreak = 0;
        await setLiveSetSyncMeta(`liveset:last-sync:${projectId}`, {
          sessionId: stateRef.current.sessionId,
          at: nowIso(),
          acked: ackedIds.length,
          rejected: result.rejected.length,
          conflicts: result.conflicts.length,
        });
      } catch (error) {
        syncRef.current.failureStreak += 1;
        const failureDelay = toBackoffDelayMs(syncRef.current.failureStreak);
        await markLiveSetQueueFailed(
          pending.map((item) => ({
            eventId: item.eventId,
            error: error instanceof Error ? error.message : 'Live set sync failed',
            nextRetryAt: Date.now() + failureDelay,
          })),
        );

        if (syncRef.current.failureStreak >= CIRCUIT_BREAKER_FAILURES) {
          syncRef.current.circuitOpenUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
        }
      } finally {
        syncRef.current.inFlight = false;
        await refreshPendingSyncCount();
        timer = window.setTimeout(() => void tick(), SYNC_POLL_MS);
      }
    };

    void tick();
    return () => {
      disposed = true;
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [autoSync, projectId, refreshPendingSyncCount]);

  useEffect(() => {
    if (!projectId) return;
    void refreshPendingSyncCount();
  }, [projectId, refreshPendingSyncCount]);

  // Stable dispatchers with guard rules.
  const roll = useCallback(() => {
    const snapshot = stateRef.current;
    if (!snapshot.currentScene?.id) {
      setError('Velg scene før du trykker ROLL');
      return;
    }
    if (snapshot.liveState === 'rolling') return;
    void dispatchMutation({ type: 'ROLL' });
  }, [dispatchMutation, setError]);

  const cut = useCallback(() => {
    const snapshot = stateRef.current;
    if (snapshot.liveState !== 'rolling') {
      setError('CUT krever aktiv ROLL');
      return;
    }
    if (snapshot.activeRollToken && snapshot.lastCutRollToken === snapshot.activeRollToken) {
      setError('CUT er allerede registrert for denne take');
      return;
    }
    void dispatchMutation({ type: 'CUT' });
  }, [dispatchMutation, setError]);

  const setupComplete = useCallback(() => {
    if (stateRef.current.liveState === 'rolling') {
      setError('Kan ikke markere setup complete under opptak');
      return;
    }
    void dispatchMutation({ type: 'SETUP_COMPLETE' });
  }, [dispatchMutation, setError]);

  const advanceScene = useCallback(() => {
    void dispatchMutation({ type: 'ADVANCE_SCENE' });
  }, [dispatchMutation]);

  const addNote = useCallback(() => {
    if (!stateRef.current.noteInput.trim()) return;
    void dispatchMutation({ type: 'ADD_NOTE' });
  }, [dispatchMutation]);

  const setNoteInput = useCallback((value: string) => dispatch({ type: 'SET_NOTE_INPUT', value }), []);
  const setNoteTag = useCallback((tag: NoteTag) => dispatch({ type: 'SET_NOTE_TAG', tag }), []);

  const setTakeStatus = useCallback((id: string, status: TakeStatus) => {
    void dispatchMutation({ type: 'SET_TAKE_STATUS', id, status });
  }, [dispatchMutation]);

  const addFlag = useCallback((flag: QuickActionType) => {
    if (!stateRef.current.takes.length) return;
    void dispatchMutation({ type: 'ADD_FLAG', flag });
  }, [dispatchMutation]);

  const deleteNote = useCallback((id: string) => {
    void dispatchMutation({ type: 'DELETE_NOTE', id });
  }, [dispatchMutation]);

  const updateNote = useCallback((id: string, content: string) => {
    void dispatchMutation({ type: 'UPDATE_NOTE', id, content });
  }, [dispatchMutation]);

  const focusTake = useCallback((index: number) => dispatch({ type: 'FOCUS_TAKE', index }), []);
  const setActivityTab = useCallback((tab: 'takes' | 'notes') => dispatch({ type: 'SET_ACTIVITY_TAB', tab }), []);

  const setCamera = useCallback((metadata: Partial<LiveSetCameraMetadata>) => {
    void dispatchMutation({ type: 'SET_CAMERA', metadata });
  }, [dispatchMutation]);

  const setScene = useCallback((scene: LiveSetScene) => {
    const nextSceneId = scene?.id?.trim?.() || scene?.sceneId?.trim?.() || '';
    const currentScene = stateRef.current.currentScene;
    const currentSceneId = currentScene?.id?.trim?.() || currentScene?.sceneId?.trim?.() || '';
    if (nextSceneId && nextSceneId === currentSceneId) return;
    void dispatchMutation({ type: 'SET_SCENE', scene });
  }, [dispatchMutation]);

  const setSetup = useCallback((label: string) => {
    void dispatchMutation({ type: 'SET_SETUP', label });
  }, [dispatchMutation]);

  const setCam = useCallback((cam: string) => {
    void dispatchMutation({ type: 'SET_CAM', cam });
  }, [dispatchMutation]);

  const captureTake = useCallback((payload: CaptureTakePayload) => {
    if (!payload.shotId?.trim()) {
      setError('captureTake krever shot-id');
      return;
    }
    void dispatchMutation({ type: 'CAPTURE_TAKE', payload });
  }, [dispatchMutation, setError]);

  return {
    state,
    dispatch,
    roll,
    cut,
    setupComplete,
    advanceScene,
    addNote,
    updateNote,
    setNoteInput,
    setNoteTag,
    setTakeStatus,
    addFlag,
    deleteNote,
    focusTake,
    setActivityTab,
    setCamera,
    setScene,
    setSetup,
    setCam,
    captureTake,
    refreshPendingSyncCount,
  };
}
