/**
 * useNarrativeScenes — liste + valgt scenekort med alle mutasjoner.
 *
 * Liste og detalj hentes separat (lista er lett; kortet har rammer, lenker,
 * oppgaver og runder). Mutasjoner oppdaterer lokalt umiddelbart der det er
 * trygt (status, oppgave-toggle) og henter kortet på nytt etterpå så hash
 * og runde-status alltid er serverens sannhet. `refreshKey` bumpes av
 * workspacet ved sanntids-push (kind = 'scene').
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '../narrativeService';
import type {
  NarrativeScene, NarrativeSceneDetail, NarrativeSceneLinkKind, NarrativeSceneReview, NarrativeSceneSummary, NarrativeSceneTask,
  NarrativeSceneTaskStatus,
} from '../narrativeTypes';
import { nextSceneCode } from './sceneOps';

export type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: string }
  | { kind: 'error'; message: string; retry: () => Promise<void> };

export interface UseNarrativeScenesResult {
  scenes: NarrativeSceneSummary[];
  nextCode: string;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;

  selectedId: string | null;
  select: (id: string | null) => void;
  detail: NarrativeSceneDetail | null;
  detailLoading: boolean;
  detailError: string | null;
  reloadDetail: () => Promise<void>;

  saveState: SaveState;
  createScene: (input: api.SceneInput) => Promise<NarrativeScene>;
  patchScene: (id: string, patch: api.SceneInput) => Promise<NarrativeScene | null>;
  deleteScene: (id: string) => Promise<void>;
  setLinks: (links: Array<{ ownerKind: NarrativeSceneLinkKind; ownerId: string }>) => Promise<void>;
  addFrame: (input: { assetId?: string | null; externalUrl?: string | null; caption?: string }) => Promise<void>;
  patchFrame: (frameId: string, patch: { caption?: string }) => Promise<void>;
  deleteFrame: (frameId: string) => Promise<void>;
  moveFrame: (frameId: string, direction: -1 | 1) => Promise<void>;
  addTask: (input: { title: string; assigneeUserId?: string | null; dueAt?: string | null }) => Promise<void>;
  patchTask: (taskId: string, patch: { title?: string; status?: NarrativeSceneTaskStatus; assigneeUserId?: string | null; dueAt?: string | null }) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  requestReview: (note: string | null) => Promise<NarrativeSceneReview>;
  decideReview: (reviewId: string, decision: 'approved' | 'changes_requested', note: string | null) => Promise<NarrativeSceneReview>;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Ukjent feil';
}

export function useNarrativeScenes(projectId: string | null, opts: { refreshKey?: number; initialSelectedId?: string | null } = {}): UseNarrativeScenesResult {
  const [scenes, setScenes] = useState<NarrativeSceneSummary[]>([]);
  const [nextCode, setNextCode] = useState('S1');
  const [loading, setLoading] = useState(!!projectId);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(opts.initialSelectedId ?? null);
  const [detail, setDetail] = useState<NarrativeSceneDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' });
  const detailReq = useRef(0);

  const reload = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.listScenes(projectId);
      setScenes(res.scenes);
      setNextCode(res.nextCode || nextSceneCode(res.scenes.map((s) => s.code)));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const reloadDetail = useCallback(async () => {
    if (!projectId || !selectedId) { setDetail(null); return; }
    const req = ++detailReq.current;
    setDetailLoading(true);
    setDetailError(null);
    try {
      const d = await api.getSceneDetail(projectId, selectedId);
      if (req !== detailReq.current) return;
      setDetail(d);
      // Lista speiler kortets status/oppgavetelling uten ny listehenting.
      setScenes((prev) => prev.map((s) => (s.id === d.scene.id
        ? { ...s, ...d.scene, taskCounts: { total: d.tasks.length, done: d.tasks.filter((t) => t.status === 'done').length }, latestReview: d.reviews[0] ? { id: d.reviews[0].id, round: d.reviews[0].round, status: d.reviews[0].status, requestedAt: d.reviews[0].requestedAt, decidedAt: d.reviews[0].decidedAt } : null }
        : s)));
    } catch (err) {
      if (req !== detailReq.current) return;
      if (err instanceof api.NarrativeApiError && err.status === 404) { setDetail(null); setDetailError('Scenen finnes ikke lenger.'); }
      else setDetailError(errorMessage(err));
    } finally {
      if (req === detailReq.current) setDetailLoading(false);
    }
  }, [projectId, selectedId]);

  useEffect(() => { void reload(); }, [reload, opts.refreshKey]);
  useEffect(() => { setSaveState({ kind: 'idle' }); void reloadDetail(); }, [reloadDetail, opts.refreshKey]);

  const select = useCallback((id: string | null) => { setSelectedId(id); if (!id) setDetail(null); }, []);

  const createScene = useCallback(async (input: api.SceneInput) => {
    if (!projectId) throw new Error('Ingen prosjekt valgt');
    const scene = await api.createScene(projectId, input);
    setScenes((prev) => [...prev, { ...scene, latestReview: null, taskCounts: { total: 0, done: 0 } }]);
    setNextCode((prev) => nextSceneCode([...scenes.map((s) => s.code), scene.code, prev]));
    return scene;
  }, [projectId, scenes]);

  const patchScene = useCallback(async (id: string, patch: api.SceneInput) => {
    if (!projectId) return null;
    const run = async (): Promise<NarrativeScene | null> => {
      setSaveState({ kind: 'saving' });
      try {
        const scene = await api.patchScene(projectId, id, patch);
        setScenes((prev) => prev.map((s) => (s.id === id ? { ...s, ...scene } : s)));
        setDetail((prev) => (prev && prev.scene.id === id ? { ...prev, scene } : prev));
        setSaveState({ kind: 'saved', at: new Date().toISOString() });
        // Felter inngår i snapshot-hashen → hent på nytt (stille) så stale-vernet er riktig.
        void reloadDetail();
        return scene;
      } catch (err) {
        setSaveState({ kind: 'error', message: errorMessage(err), retry: async () => { await run(); } });
        throw err;
      }
    };
    return run();
  }, [projectId, reloadDetail]);

  const deleteScene = useCallback(async (id: string) => {
    if (!projectId) return;
    await api.deleteScene(projectId, id);
    setScenes((prev) => prev.filter((s) => s.id !== id));
    if (selectedId === id) { setSelectedId(null); setDetail(null); }
  }, [projectId, selectedId]);

  const withDetail = useCallback(async (fn: (pid: string, sid: string) => Promise<unknown>) => {
    if (!projectId || !selectedId) return;
    await fn(projectId, selectedId);
    await reloadDetail();
  }, [projectId, selectedId, reloadDetail]);

  const setLinks = useCallback((links: Array<{ ownerKind: NarrativeSceneLinkKind; ownerId: string }>) =>
    withDetail((pid, sid) => api.setSceneLinks(pid, sid, links)), [withDetail]);
  const addFrame = useCallback((input: { assetId?: string | null; externalUrl?: string | null; caption?: string }) =>
    withDetail((pid, sid) => api.createSceneFrame(pid, sid, input)), [withDetail]);
  const patchFrame = useCallback((frameId: string, patch: { caption?: string }) =>
    withDetail((pid, sid) => api.patchSceneFrame(pid, sid, frameId, patch)), [withDetail]);
  const deleteFrame = useCallback((frameId: string) =>
    withDetail((pid, sid) => api.deleteSceneFrame(pid, sid, frameId)), [withDetail]);
  const moveFrame = useCallback(async (frameId: string, direction: -1 | 1) => {
    if (!detail) return;
    const ids = detail.frames.map((f) => f.id);
    const i = ids.indexOf(frameId);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    // Optimistisk rekkefølge; serveren bekrefter ved reload.
    setDetail((prev) => (prev ? { ...prev, frames: ids.map((id, sortOrder) => ({ ...prev.frames.find((f) => f.id === id)!, sortOrder })) } : prev));
    await withDetail((pid, sid) => api.reorderSceneFrames(pid, sid, ids));
  }, [detail, withDetail]);

  const addTask = useCallback((input: { title: string; assigneeUserId?: string | null; dueAt?: string | null }) =>
    withDetail((pid, sid) => api.createSceneTask(pid, sid, input)), [withDetail]);
  const patchTask = useCallback(async (taskId: string, patch: { title?: string; status?: NarrativeSceneTaskStatus; assigneeUserId?: string | null; dueAt?: string | null }) => {
    // Optimistisk: avkrysning skal føles umiddelbar.
    setDetail((prev) => (prev ? { ...prev, tasks: prev.tasks.map((t): NarrativeSceneTask => (t.id === taskId ? { ...t, ...patch, completedAt: patch.status === 'done' ? (t.completedAt ?? new Date().toISOString()) : patch.status ? null : t.completedAt } : t)) } : prev));
    await withDetail((pid, sid) => api.patchSceneTask(pid, sid, taskId, patch));
  }, [withDetail]);
  const deleteTask = useCallback(async (taskId: string) => {
    setDetail((prev) => (prev ? { ...prev, tasks: prev.tasks.filter((t) => t.id !== taskId) } : prev));
    await withDetail((pid, sid) => api.deleteSceneTask(pid, sid, taskId));
  }, [withDetail]);

  const requestReview = useCallback(async (note: string | null) => {
    if (!projectId || !selectedId) throw new Error('Ingen scene valgt');
    const review = await api.requestSceneReview(projectId, selectedId, note);
    await reloadDetail();
    return review;
  }, [projectId, selectedId, reloadDetail]);
  const decideReview = useCallback(async (reviewId: string, decision: 'approved' | 'changes_requested', note: string | null) => {
    if (!projectId || !selectedId) throw new Error('Ingen scene valgt');
    const expected = detail?.reviews.find((r) => r.id === reviewId)?.snapshotHash ?? null;
    try {
      return await api.decideSceneReview(projectId, selectedId, reviewId, { decision, note, expectedSnapshotHash: expected });
    } finally {
      await reloadDetail();
    }
  }, [projectId, selectedId, detail, reloadDetail]);

  return {
    scenes, nextCode, loading, error, reload,
    selectedId, select, detail, detailLoading, detailError, reloadDetail,
    saveState, createScene, patchScene, deleteScene, setLinks,
    addFrame, patchFrame, deleteFrame, moveFrame, addTask, patchTask, deleteTask, requestReview, decideReview,
  };
}
