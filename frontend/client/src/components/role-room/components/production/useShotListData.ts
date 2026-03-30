import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { castingService } from "../../services/castingService";
import type { ShotList, CastingShot, Person, CrewMember, SceneBreakdown } from "../../models/casting";
import { computeShotListSummary, computeSummaries, patchSummaryOnStatusChange, patchSummaryOnAssign, isShotAssigned, type ShotListSummary, type ProjectShotStats } from "../../models/derivedState";

// ─── Re-export convenient types ───────────────────────────────────────────────
export type { ShotListSummary, ProjectShotStats };

// ─── Module-level caches (survive component re-mounts) ───────────────────────
const summariesCache = new Map<string, ShotListSummary[]>();       // keyed by projectId
const fullListCache  = new Map<string, ShotList>();                // keyed by shotListId
const crewCache      = new Map<string, Person[]>();                // keyed by projectId
const scenesCache    = new Map<string, Map<string, SceneBreakdown>>(); // keyed by projectId

// ─── Helpers to convert existing domain types to Person ──────────────────────
function crewMemberToPerson(cm: CrewMember): Person {
  return {
    id: cm.id,
    projectId: '',           // not stored on CrewMember — filled at call site
    name: cm.name,
    personType: 'crew',
    crewRole: cm.role,
    contactInfo: cm.contactInfo
      ? { email: cm.contactInfo.email, phone: cm.contactInfo.phone }
      : undefined,
    rate: cm.rate,
    notes: cm.notes,
    createdAt: cm.createdAt,
    updatedAt: cm.updatedAt,
  };
}

// ─── Low-level data fetchers (replace with real HTTP calls when ready) ────────

async function _fetchShotLists(projectId: string): Promise<ShotList[]> {
  try {
    // When a REST endpoint exists:
    //   const res = await fetch(`/api/shot-lists?projectId=${projectId}`);
    //   return res.json();
    const project = await castingService.getProject(projectId);
    return (project as any)?.shotLists ?? [];
  } catch {
    return [];
  }
}

async function _fetchShotListById(
  projectId: string,
  shotListId: string,
): Promise<ShotList | null> {
  // When a REST endpoint exists:
  //   const res = await fetch(`/api/shot-lists/${shotListId}`);
  //   return res.json();

  // Fast-path: already in full cache
  if (fullListCache.has(shotListId)) return fullListCache.get(shotListId)!;

  try {
    const project = await castingService.getProject(projectId);
    const list = (project as any)?.shotLists?.find(
      (l: ShotList) => l.id === shotListId,
    ) ?? null;
    return list;
  } catch {
    return null;
  }
}

async function _fetchCrew(projectId: string): Promise<Person[]> {
  // When a REST endpoint exists:
  //   const res = await fetch(`/api/crew?projectId=${projectId}`);
  //   return res.json();
  try {
    const project = await castingService.getProject(projectId);
    const crew: CrewMember[] = (project as any)?.crew ?? [];
    return crew.map((cm) => ({ ...crewMemberToPerson(cm), projectId }));
  } catch {
    return [];
  }
}

async function _fetchScenes(
  projectId: string,
): Promise<Map<string, SceneBreakdown>> {
  // When a REST endpoint exists:
  //   const res = await fetch(`/api/scenes?projectId=${projectId}`);
  //   const arr: SceneBreakdown[] = await res.json();
  //   return new Map(arr.map(s => [s.id, s]));
  try {
    const project = await castingService.getProject(projectId);
    const scenes: SceneBreakdown[] = (project as any)?.sceneBreakdowns ?? [];
    return new Map(scenes.map((s) => [s.id, s]));
  } catch {
    return new Map();
  }
}

// ─── Hook return type ─────────────────────────────────────────────────────────

export interface UseShotListDataReturn {
  // ── Query 1: grid ─────────────────────────────────────────────────────────
  /** Derived summaries for all shot lists in the project.  Renders the grid. */
  summaries: ShotListSummary[];
  summariesLoading: boolean;
  summariesError: string | null;

  // ── Query 2: detail ───────────────────────────────────────────────────────
  /** The currently-open full ShotList (with all shots).  null when closed. */
  openShotList: ShotList | null;
  shotListLoading: boolean;
  /** Open a shot list by ID.  Fetches if not cached. */
  openShotListById: (id: string) => Promise<void>;
  closeShotList: () => void;
  /** Derived summary of the open shot list (recomputed on every shot change). */
  openShotListSummary: ShotListSummary | null;

  // ── Query 3: lookup ───────────────────────────────────────────────────────
  /** Crew / cast persons for this project.  Used to resolve assignee names. */
  crew: Person[];
  crewLoading: boolean;
  /** Scene breakdowns in the project. Used to bind shot lists to storyboard-aware scenes. */
  sceneBreakdowns: SceneBreakdown[];
  /** Convenience map: personId → Person */
  peopleMap: Map<string, Person>;

  // ── Mutations (optimistic) ────────────────────────────────────────────────
  /**
   * Update a single shot inside the open shot list.
   * Applies an optimistic UI update and patches the cached summary.
   */
  updateShot: (updatedShot: CastingShot) => void;

  // ── Utility ───────────────────────────────────────────────────────────────
  /** Bust all caches and re-fetch everything. */
  refresh: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useShotListData(projectId: string): UseShotListDataReturn {
  const mountedRef = useRef(true);

  // ── State: summaries (grid) ──────────────────────────────────────────────
  const [summaries, setSummaries] = useState<ShotListSummary[]>(
    () => summariesCache.get(projectId) ?? [],
  );
  const [summariesLoading, setSummariesLoading] = useState(
    !summariesCache.has(projectId),
  );
  const [summariesError, setSummariesError] = useState<string | null>(null);

  // ── State: detail ────────────────────────────────────────────────────────
  const [openShotList, setOpenShotList] = useState<ShotList | null>(null);
  const [shotListLoading, setShotListLoading] = useState(false);

  // ── State: crew ──────────────────────────────────────────────────────────
  const [crew, setCrew] = useState<Person[]>(
    () => crewCache.get(projectId) ?? [],
  );
  const [crewLoading, setCrewLoading] = useState(!crewCache.has(projectId));
  const [sceneBreakdowns, setSceneBreakdowns] = useState<SceneBreakdown[]>(
    () => Array.from(scenesCache.get(projectId)?.values() ?? []),
  );

  // ── Derived: peopleMap ───────────────────────────────────────────────────
  const peopleMap = useMemo(
    () => new Map(crew.map((p) => [p.id, p])),
    [crew],
  );

  // ── Derived: open list summary ────────────────────────────────────────────
  const openShotListSummary = useMemo<ShotListSummary | null>(() => {
    if (!openShotList) return null;
    const scenes = scenesCache.get(projectId);
    const scene = scenes?.get(openShotList.sceneId);
    return computeShotListSummary(openShotList, scene, peopleMap);
  }, [openShotList, projectId, peopleMap]);

  // ── Query 1: load summaries ───────────────────────────────────────────────
  const loadSummaries = useCallback(async () => {
    if (!projectId) return;

    const cached = summariesCache.get(projectId);
    if (cached) {
      setSummaries(cached);
      setSummariesLoading(false);
      return;
    }

    setSummariesLoading(true);
    setSummariesError(null);
    try {
      const [lists, scenes] = await Promise.all([
        _fetchShotLists(projectId),
        _fetchScenes(projectId),
      ]);
      if (!mountedRef.current) return;

      scenesCache.set(projectId, scenes);
      setSceneBreakdowns(Array.from(scenes.values()));
      const result = computeSummaries(lists, scenes, peopleMap);
      summariesCache.set(projectId, result);
      setSummaries(result);
    } catch (err) {
      if (mountedRef.current) {
        setSummariesError(
          err instanceof Error ? err.message : 'Failed to load shot lists',
        );
      }
    } finally {
      if (mountedRef.current) setSummariesLoading(false);
    }
  }, [projectId, peopleMap]);

  // ── Query 2: open a shot list ─────────────────────────────────────────────
  const openShotListById = useCallback(
    async (id: string) => {
      // Fast path: already cached
      const cached = fullListCache.get(id);
      if (cached) {
        setOpenShotList(cached);
        return;
      }

      setShotListLoading(true);
      try {
        const list = await _fetchShotListById(projectId, id);
        if (!mountedRef.current) return;
        if (list) {
          fullListCache.set(id, list);
          setOpenShotList(list);
        }
      } catch (err) {
        console.error('Failed to load shot list:', err);
      } finally {
        if (mountedRef.current) setShotListLoading(false);
      }
    },
    [projectId],
  );

  const closeShotList = useCallback(() => setOpenShotList(null), []);

  // ── Query 3: load crew ────────────────────────────────────────────────────
  const loadCrew = useCallback(async () => {
    if (!projectId) return;

    const cached = crewCache.get(projectId);
    if (cached) {
      setCrew(cached);
      setCrewLoading(false);
      return;
    }

    setCrewLoading(true);
    try {
      const persons = await _fetchCrew(projectId);
      if (!mountedRef.current) return;
      crewCache.set(projectId, persons);
      setCrew(persons);
    } catch (err) {
      console.error('Failed to load crew:', err);
      if (mountedRef.current) setCrew([]);
    } finally {
      if (mountedRef.current) setCrewLoading(false);
    }
  }, [projectId]);

  // ── Mutation: update a shot (optimistic) ──────────────────────────────────
  const updateShot = useCallback(
    (updatedShot: CastingShot) => {
      if (!openShotList) return;

      const prevShot = openShotList.shots.find((s) => s.id === updatedShot.id);
      const now = new Date().toISOString();

      // 1. Patch the open shot list in local state
      const updatedList: ShotList = {
        ...openShotList,
        updatedAt: now,
        shots: openShotList.shots.map((s) =>
          s.id === updatedShot.id ? { ...updatedShot, updatedAt: now } : s,
        ),
      };
      fullListCache.set(updatedList.id, updatedList);
      setOpenShotList(updatedList);

      // 2. Patch the cached summary for this list (incremental, no full recompute)
      const projectSummaries = summariesCache.get(projectId);
      if (projectSummaries) {
        const summaryIdx = projectSummaries.findIndex(
          (s) => s.shotListId === openShotList.id,
        );
        if (summaryIdx !== -1) {
          let patched = projectSummaries[summaryIdx];

          // Status change
          if (
            prevShot &&
            prevShot.status !== updatedShot.status &&
            updatedShot.status
          ) {
            patched = patchSummaryOnStatusChange(
              patched,
              prevShot.status ?? 'not_started',
              updatedShot.status,
              now,
            );
          }

          // New assignment on previously unassigned shot
          const wasUnassigned = prevShot ? !isShotAssigned(prevShot) : false;
          const newAssignees = (updatedShot.assignments ?? []).filter(
            (a) => a.status === 'pending' || a.status === 'confirmed',
          );
          if (wasUnassigned && newAssignees.length > 0) {
            for (const a of newAssignees) {
              patched = patchSummaryOnAssign(patched, true, a.personId, now);
            }
          }

          const updated = [...projectSummaries];
          updated[summaryIdx] = patched;
          summariesCache.set(projectId, updated);
          setSummaries(updated);
        }
      }
    },
    [openShotList, projectId],
  );

  // ── Refresh: bust all caches ───────────────────────────────────────────────
  const refresh = useCallback(() => {
    summariesCache.delete(projectId);
    crewCache.delete(projectId);
    scenesCache.delete(projectId);
    // Don't clear fullListCache entries here — they'll be lazily re-fetched
    setSummaries([]);
    setCrew([]);
    setSceneBreakdowns([]);
    setOpenShotList(null);
    loadSummaries();
    loadCrew();
  }, [projectId, loadSummaries, loadCrew]);

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (projectId) {
      loadCrew();
    }
  }, [projectId, loadCrew]);

  // Load summaries after crew (so people map is populated for name resolution)
  useEffect(() => {
    if (projectId) {
      loadSummaries();
    }
  }, [projectId, loadSummaries]);

  return {
    summaries,
    summariesLoading,
    summariesError,
    openShotList,
    shotListLoading,
    openShotListById,
    closeShotList,
    openShotListSummary,
    crew,
    crewLoading,
    sceneBreakdowns,
    peopleMap,
    updateShot,
    refresh,
  };
}
