/**
 * useLiveSet – State machine reducer for Live Set Mode
 *
 * State machine:
 *   idle ──ROLL──► rolling ──CUT──► cut ──CONFIRM──► idle
 *                                       └─SETUP_COMPLETE──► setup-complete ──ADVANCE──► idle
 *
 * Offline-first: all mutations saved to localStorage under `liveset_session`.
 */

import { useReducer, useEffect, useCallback } from 'react';
import {
  LiveSetState,
  LiveSetTake,
  LiveSetNote,
  LiveSetCameraMetadata,
  LiveSetScene,
  QuickActionType,
  TakeStatus,
  NoteTag,
} from '../models/casting';

// ── Helpers ──────────────────────────────────────────────────────────────────

const uid = () => `ls_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const now = () => new Date().toISOString();

const STORAGE_KEY = 'liveset_session_v1';

// ── State ────────────────────────────────────────────────────────────────────

export interface LiveSetUIState {
  liveState: LiveSetState;
  /** ms since epoch when recording started, null when idle */
  timerStartedAt: number | null;
  /** seconds captured when cut – null during rolling */
  lastDuration: number | null;
  currentScene: LiveSetScene | null;
  activeSetup: string; // "A", "B", "MOS"…
  activeCam: string; // "Cam A", "Cam B"…
  takes: LiveSetTake[];
  notes: LiveSetNote[];
  cameraMetadata: LiveSetCameraMetadata;
  /** Which tab is active in the Activity panel */
  activityTab: 'takes' | 'notes';
  /** Currently keyboard-focused take index (for ↑↓ nav) */
  focusedTakeIndex: number;
  /** Note input text buffer */
  noteInput: string;
  noteTag: NoteTag;
  /** Offline connectivity flag */
  isOffline: boolean;
  /** How many records are unsynced */
  pendingSyncCount: number;
  /** Session id */
  sessionId: string;
}

export function makeInitialState(scene?: LiveSetScene): LiveSetUIState {
  return {
    liveState: 'idle',
    timerStartedAt: null,
    lastDuration: null,
    currentScene: scene ?? null,
    activeSetup: 'A',
    activeCam: 'Cam A',
    takes: [],
    notes: [],
    cameraMetadata: { camera: 'Cam A', fps: 24, iso: 800 },
    activityTab: 'takes',
    focusedTakeIndex: -1,
    noteInput: '',
    noteTag: 'general',
    isOffline: !navigator.onLine,
    pendingSyncCount: 0,
    sessionId: uid(),
  };
}

// ── Actions ───────────────────────────────────────────────────────────────────

export type LiveSetAction =
  | { type: 'ROLL' }
  | { type: 'CUT' }
  | { type: 'SETUP_COMPLETE' }
  | { type: 'ADVANCE_SCENE' }
  | { type: 'SET_TAKE_STATUS'; id: string; status: TakeStatus }
  | { type: 'ADD_FLAG'; flag: QuickActionType }
  | { type: 'ADD_NOTE' }
  | { type: 'DELETE_NOTE'; id: string }
  | { type: 'UPDATE_NOTE'; id: string; content: string }
  | { type: 'SET_NOTE_INPUT'; value: string }
  | { type: 'SET_NOTE_TAG'; tag: NoteTag }
  | { type: 'SET_ACTIVITY_TAB'; tab: 'takes' | 'notes' }
  | { type: 'FOCUS_TAKE'; index: number }
  | { type: 'SET_CAMERA'; metadata: Partial<LiveSetCameraMetadata> }
  | { type: 'SET_SCENE'; scene: LiveSetScene }
  | { type: 'SET_SETUP'; label: string }
  | { type: 'SET_CAM'; cam: string }
  | { type: 'SET_OFFLINE'; offline: boolean }
  | { type: 'MARK_SYNCED' }
  | { type: 'LOAD_PERSISTED'; state: LiveSetUIState };

// ── Reducer ───────────────────────────────────────────────────────────────────

export function liveSetReducer(state: LiveSetUIState, action: LiveSetAction): LiveSetUIState {
  switch (action.type) {

    case 'ROLL': {
      if (state.liveState === 'rolling') return state; // guard double-press
      return {
        ...state,
        liveState: 'rolling',
        timerStartedAt: Date.now(),
        lastDuration: null,
      };
    }

    case 'CUT': {
      if (state.liveState !== 'rolling') return state;
      const elapsed = state.timerStartedAt
        ? Math.round((Date.now() - state.timerStartedAt) / 1000)
        : null;
      const num = state.takes.filter(t => t.setupLabel === state.activeSetup).length + 1;
      const newTake: LiveSetTake = {
        id: uid(),
        sceneId: state.currentScene?.id ?? 'unknown',
        setupLabel: state.activeSetup,
        takeNumber: num,
        duration: elapsed,
        status: 'normal',
        camera: state.activeCam,
        lens: state.cameraMetadata.lens,
        flags: [],
        loggedBy: 'Script Supervisor',
        loggedAt: now(),
        synced: false,
      };
      const updatedTakes = [newTake, ...state.takes];
      return {
        ...state,
        liveState: 'cut',
        timerStartedAt: null,
        lastDuration: elapsed,
        takes: updatedTakes,
        focusedTakeIndex: 0,
        pendingSyncCount: state.pendingSyncCount + 1,
      };
    }

    case 'SETUP_COMPLETE': {
      if (state.liveState === 'rolling') return state;
      return { ...state, liveState: 'setup-complete' };
    }

    case 'ADVANCE_SCENE': {
      // Returns to idle for a fresh scene
      return { ...state, liveState: 'idle', timerStartedAt: null, lastDuration: null };
    }

    case 'SET_TAKE_STATUS': {
      return {
        ...state,
        takes: state.takes.map(t =>
          t.id === action.id ? { ...t, status: action.status, synced: false } : t
        ),
        pendingSyncCount: state.pendingSyncCount + 1,
      };
    }

    case 'ADD_FLAG': {
      if (!state.takes.length) return state;
      // Add flag to the most recent take
      const [latest, ...rest] = state.takes;
      const flags = latest.flags.includes(action.flag)
        ? latest.flags
        : [...latest.flags, action.flag];
      return {
        ...state,
        takes: [{ ...latest, flags, synced: false }, ...rest],
        pendingSyncCount: state.pendingSyncCount + 1,
      };
    }

    case 'ADD_NOTE': {
      if (!state.noteInput.trim()) return state;
      const newNote: LiveSetNote = {
        id: uid(),
        sceneId: state.currentScene?.id ?? 'unknown',
        content: state.noteInput.trim(),
        tag: state.noteTag,
        author: 'Script Supervisor',
        timestamp: now(),
        synced: false,
      };
      return {
        ...state,
        notes: [newNote, ...state.notes],
        noteInput: '',
        pendingSyncCount: state.pendingSyncCount + 1,
      };
    }

    case 'DELETE_NOTE': {
      return {
        ...state,
        notes: state.notes.filter(n => n.id !== action.id),
      };
    }

    case 'UPDATE_NOTE': {
      return {
        ...state,
        notes: state.notes.map(n =>
          n.id === action.id ? { ...n, content: action.content, synced: false } : n
        ),
        pendingSyncCount: state.pendingSyncCount + 1,
      };
    }

    case 'SET_NOTE_INPUT': return { ...state, noteInput: action.value };
    case 'SET_NOTE_TAG': return { ...state, noteTag: action.tag };
    case 'SET_ACTIVITY_TAB': return { ...state, activityTab: action.tab };

    case 'FOCUS_TAKE': {
      const clamped = Math.max(-1, Math.min(state.takes.length - 1, action.index));
      return { ...state, focusedTakeIndex: clamped };
    }

    case 'SET_CAMERA': {
      return {
        ...state,
        cameraMetadata: { ...state.cameraMetadata, ...action.metadata },
        activeCam: action.metadata.camera ?? state.activeCam,
      };
    }

    case 'SET_SCENE': return { ...state, currentScene: action.scene };
    case 'SET_SETUP': return { ...state, activeSetup: action.label };
    case 'SET_CAM': return { ...state, activeCam: action.cam, cameraMetadata: { ...state.cameraMetadata, camera: action.cam } };
    case 'SET_OFFLINE': return { ...state, isOffline: action.offline };

    case 'MARK_SYNCED': {
      return {
        ...state,
        takes: state.takes.map(t => ({ ...t, synced: true })),
        notes: state.notes.map(n => ({ ...n, synced: true })),
        pendingSyncCount: 0,
      };
    }

    case 'LOAD_PERSISTED': return action.state;

    default: return state;
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useLiveSet(initialScene?: LiveSetScene) {
  const [state, dispatch] = useReducer(
    liveSetReducer,
    undefined,
    () => {
      // Try to rehydrate from localStorage (offline-first)
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as LiveSetUIState;
          return { ...parsed, isOffline: !navigator.onLine };
        }
      } catch { /* ignore */ }
      return makeInitialState(initialScene);
    }
  );

  // Persist state to localStorage on every change
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* quota */ }
  }, [state]);

  // Online/Offline detection
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

  // Simulate sync when going online
  useEffect(() => {
    if (!state.isOffline && state.pendingSyncCount > 0) {
      const t = window.setTimeout(() => dispatch({ type: 'MARK_SYNCED' }), 1800);
      return () => clearTimeout(t);
    }
  }, [state.isOffline, state.pendingSyncCount]);

  // Stable dispatchers
  const roll = useCallback(() => dispatch({ type: 'ROLL' }), []);
  const cut = useCallback(() => dispatch({ type: 'CUT' }), []);
  const setupComplete = useCallback(() => dispatch({ type: 'SETUP_COMPLETE' }), []);
  const advanceScene = useCallback(() => dispatch({ type: 'ADVANCE_SCENE' }), []);
  const addNote = useCallback(() => dispatch({ type: 'ADD_NOTE' }), []);
  const setNoteInput = useCallback((v: string) => dispatch({ type: 'SET_NOTE_INPUT', value: v }), []);
  const setNoteTag = useCallback((t: NoteTag) => dispatch({ type: 'SET_NOTE_TAG', tag: t }), []);
  const setTakeStatus = useCallback((id: string, s: TakeStatus) => dispatch({ type: 'SET_TAKE_STATUS', id, status: s }), []);
  const addFlag = useCallback((f: QuickActionType) => dispatch({ type: 'ADD_FLAG', flag: f }), []);
  const deleteNote = useCallback((id: string) => dispatch({ type: 'DELETE_NOTE', id }), []);
  const focusTake = useCallback((i: number) => dispatch({ type: 'FOCUS_TAKE', index: i }), []);
  const setActivityTab = useCallback((t: 'takes' | 'notes') => dispatch({ type: 'SET_ACTIVITY_TAB', tab: t }), []);
  const setCamera = useCallback((m: Partial<LiveSetCameraMetadata>) => dispatch({ type: 'SET_CAMERA', metadata: m }), []);
  const setScene = useCallback((s: LiveSetScene) => dispatch({ type: 'SET_SCENE', scene: s }), []);
  const setSetup = useCallback((l: string) => dispatch({ type: 'SET_SETUP', label: l }), []);
  const setCam = useCallback((c: string) => dispatch({ type: 'SET_CAM', cam: c }), []);

  return {
    state,
    dispatch,
    roll,
    cut,
    setupComplete,
    advanceScene,
    addNote,
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
  };
}
