/**
 * useCastingStore.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Global Zustand store for the casting workspace.
 *
 * ALL casting panels (CandidateManagement, CandidatePool, KanbanPanel,
 * CandidateWorkflowStatus) read from and write to this store. No panel
 * should maintain its own candidate list or status mappings.
 *
 * Responsibilities:
 *   • Single source of truth for project-candidates and pool-candidates
 *   • Workflow transitions with validation (via workflowEngine)
 *   • Optimistic updates with rollback
 *   • Event log for undo + audit trail
 *   • Selection state (bulk ops, current candidate)
 *   • Computed counts-by-status for the bottom status bar
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type {
  CandidateStatus,
  WorkflowStatus,
  ProjectCandidate,
  PoolCandidate,
  CastingEvent,
} from '../domain/castingTypes';
import {
  CANDIDATE_STATUS_LABELS,
  CANDIDATE_STATUS_COLORS,
} from '../domain/castingTypes';
import {
  transitionCandidateStatus,
  transitionWorkflowStatus,
  bulkTransitionCandidateStatus,
  type WorkflowTransitionContext,
  type BulkTransitionResult,
} from '../domain/workflowEngine';

// ─── Store shape ─────────────────────────────────────────────────────────────

export interface CastingStoreState {
  // ── Identity ──
  projectId: string | null;
  roleId: string | null;

  // ── Data ──
  projectCandidates: ProjectCandidate[];
  poolCandidates: PoolCandidate[];
  events: CastingEvent[];

  // ── Loading ──
  loading: boolean;
  poolLoading: boolean;

  // ── UI state ──
  selectedCandidateId: string | null;
  selectedIds: Set<string>;
  poolSearchQuery: string;
  candidateSearchQuery: string;
  statusFilter: CandidateStatus | 'all';
  viewMode: 'grid' | 'list' | 'kanban';
  favourites: Set<string>;

  // ── Computed (derived eagerly on mutation) ──
  countsByStatus: Record<CandidateStatus, number>;
}

export interface CastingStoreActions {
  // ── Initialisation ──
  setProject: (projectId: string, roleId?: string) => void;
  setProjectCandidates: (candidates: ProjectCandidate[]) => void;
  setPoolCandidates: (candidates: PoolCandidate[]) => void;
  setLoading: (loading: boolean) => void;
  setPoolLoading: (loading: boolean) => void;

  // ── Candidate CRUD ──
  addCandidate: (candidate: ProjectCandidate) => void;
  removeCandidate: (candidateId: string) => void;
  updateCandidate: (candidateId: string, patch: Partial<ProjectCandidate>) => void;

  // ── Status transitions (validated) ──
  setCandidateStatus: (
    candidateId: string,
    targetStatus: CandidateStatus,
  ) => { ok: boolean; reason?: string };

  setWorkflowStatus: (
    candidateId: string,
    targetStatus: WorkflowStatus,
    context?: WorkflowTransitionContext,
  ) => { ok: boolean; reason?: string };

  bulkSetCandidateStatus: (
    candidateIds: string[],
    targetStatus: CandidateStatus,
  ) => BulkTransitionResult;

  // ── Pool → Project ──
  importFromPool: (poolCandidate: PoolCandidate, roleId: string) => ProjectCandidate;

  // ── Selection ──
  selectCandidate: (candidateId: string | null) => void;
  toggleSelected: (candidateId: string) => void;
  selectAll: () => void;
  clearSelection: () => void;

  // ── Filters ──
  setStatusFilter: (status: CandidateStatus | 'all') => void;
  setCandidateSearchQuery: (query: string) => void;
  setPoolSearchQuery: (query: string) => void;
  setViewMode: (mode: 'grid' | 'list' | 'kanban') => void;

  // ── Favourites ──
  toggleFavourite: (candidateId: string) => void;
  setFavourites: (ids: string[]) => void;

  // ── Events ──
  pushEvent: (event: Omit<CastingEvent, 'id' | 'createdAt'>) => void;

  // ── Undo ──
  undoLastEvent: () => CastingEvent | null;

  // ── Reset ──
  reset: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeCountsByStatus(candidates: ProjectCandidate[]): Record<CandidateStatus, number> {
  const counts: Record<CandidateStatus, number> = {
    pending: 0,
    requested: 0,
    shortlist: 0,
    selected: 0,
    confirmed: 0,
    rejected: 0,
  };
  for (const c of candidates) {
    if (c.status in counts) {
      counts[c.status]++;
    }
  }
  return counts;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const INITIAL_STATE: CastingStoreState = {
  projectId: null,
  roleId: null,
  projectCandidates: [],
  poolCandidates: [],
  events: [],
  loading: false,
  poolLoading: false,
  selectedCandidateId: null,
  selectedIds: new Set<string>(),
  poolSearchQuery: '',
  candidateSearchQuery: '',
  statusFilter: 'all',
  viewMode: 'grid',
  favourites: new Set<string>(),
  countsByStatus: {
    pending: 0,
    requested: 0,
    shortlist: 0,
    selected: 0,
    confirmed: 0,
    rejected: 0,
  },
};

// ─── Store ───────────────────────────────────────────────────────────────────

export const useCastingStore = create<CastingStoreState & CastingStoreActions>()(
  subscribeWithSelector((set, get) => ({
    ...INITIAL_STATE,

    // ── Initialisation ──────────────────────────────────────────────────

    setProject: (projectId, roleId) => {
      set({ projectId, roleId: roleId ?? null });
    },

    setProjectCandidates: (candidates) => {
      set({
        projectCandidates: candidates,
        countsByStatus: computeCountsByStatus(candidates),
      });
    },

    setPoolCandidates: (candidates) => {
      set({ poolCandidates: candidates });
    },

    setLoading: (loading) => set({ loading }),
    setPoolLoading: (loading) => set({ poolLoading: loading }),

    // ── Candidate CRUD ──────────────────────────────────────────────────

    addCandidate: (candidate) => {
      const next = [...get().projectCandidates, candidate];
      set({
        projectCandidates: next,
        countsByStatus: computeCountsByStatus(next),
      });
    },

    removeCandidate: (candidateId) => {
      const next = get().projectCandidates.filter(c => c.id !== candidateId);
      const selected = new Set(get().selectedIds);
      selected.delete(candidateId);
      set({
        projectCandidates: next,
        countsByStatus: computeCountsByStatus(next),
        selectedIds: selected,
        selectedCandidateId:
          get().selectedCandidateId === candidateId ? null : get().selectedCandidateId,
      });
    },

    updateCandidate: (candidateId, patch) => {
      const next = get().projectCandidates.map(c =>
        c.id === candidateId ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c,
      );
      set({
        projectCandidates: next,
        countsByStatus: computeCountsByStatus(next),
      });
    },

    // ── Status transitions ──────────────────────────────────────────────

    setCandidateStatus: (candidateId, targetStatus) => {
      const candidate = get().projectCandidates.find(c => c.id === candidateId);
      if (!candidate) return { ok: false, reason: 'Kandidat ikke funnet.' };

      const result = transitionCandidateStatus(candidate.status, targetStatus);
      if (!result.ok) return { ok: false, reason: result.reason };

      const next = get().projectCandidates.map(c =>
        c.id === candidateId
          ? { ...c, status: result.next, updatedAt: new Date().toISOString() }
          : c,
      );
      set({
        projectCandidates: next,
        countsByStatus: computeCountsByStatus(next),
      });

      // Audit event
      get().pushEvent({
        projectId: get().projectId ?? '',
        actorUserId: '', // Populated by caller
        type: 'status_changed',
        payload: {
          candidateId,
          from: candidate.status,
          to: result.next,
        },
      });

      return { ok: true };
    },

    setWorkflowStatus: (candidateId, targetStatus, context = {}) => {
      const candidate = get().projectCandidates.find(c => c.id === candidateId);
      if (!candidate) return { ok: false, reason: 'Kandidat ikke funnet.' };

      const result = transitionWorkflowStatus(
        candidate.workflowStatus,
        targetStatus,
        context,
      );
      if (!result.ok) return { ok: false, reason: result.reason };

      const next = get().projectCandidates.map(c =>
        c.id === candidateId
          ? { ...c, workflowStatus: result.next, updatedAt: new Date().toISOString() }
          : c,
      );
      set({
        projectCandidates: next,
        countsByStatus: computeCountsByStatus(next),
      });

      get().pushEvent({
        projectId: get().projectId ?? '',
        actorUserId: '',
        type: 'workflow_changed',
        payload: {
          candidateId,
          from: candidate.workflowStatus,
          to: result.next,
        },
      });

      return { ok: true };
    },

    bulkSetCandidateStatus: (candidateIds, targetStatus) => {
      const candidates = get().projectCandidates.filter(c =>
        candidateIds.includes(c.id),
      );
      const bulkResult = bulkTransitionCandidateStatus(candidates, targetStatus);

      if (bulkResult.succeeded.length > 0) {
        const successMap = new Map(
          bulkResult.succeeded.map(s => [s.candidateId, s.newStatus]),
        );
        const next = get().projectCandidates.map(c =>
          successMap.has(c.id)
            ? { ...c, status: successMap.get(c.id)!, updatedAt: new Date().toISOString() }
            : c,
        );
        set({
          projectCandidates: next,
          countsByStatus: computeCountsByStatus(next),
        });

        get().pushEvent({
          projectId: get().projectId ?? '',
          actorUserId: '',
          type: 'bulk_status_changed',
          payload: {
            targetStatus,
            succeeded: bulkResult.succeeded.length,
            failed: bulkResult.failed.length,
          },
        });
      }

      return bulkResult;
    },

    // ── Pool → Project ──────────────────────────────────────────────────

    importFromPool: (poolCandidate, roleId) => {
      const newCandidate: ProjectCandidate = {
        id: generateId(),
        poolCandidateId: poolCandidate.id,
        projectId: get().projectId ?? '',
        roleIds: [roleId],
        name: poolCandidate.name,
        contactInfo: poolCandidate.contactInfo,
        photos: poolCandidate.photos,
        videos: poolCandidate.videos,
        modelUrl: poolCandidate.modelUrl,
        status: 'pending',
        workflowStatus: 'pending',
        auditionNotes: '',
        source: 'pool',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const next = [...get().projectCandidates, newCandidate];
      set({
        projectCandidates: next,
        countsByStatus: computeCountsByStatus(next),
      });

      get().pushEvent({
        projectId: get().projectId ?? '',
        actorUserId: '',
        type: 'imported_from_pool',
        payload: {
          poolCandidateId: poolCandidate.id,
          newCandidateId: newCandidate.id,
          roleId,
        },
      });

      return newCandidate;
    },

    // ── Selection ───────────────────────────────────────────────────────

    selectCandidate: (candidateId) => {
      set({ selectedCandidateId: candidateId });
    },

    toggleSelected: (candidateId) => {
      const next = new Set(get().selectedIds);
      if (next.has(candidateId)) {
        next.delete(candidateId);
      } else {
        next.add(candidateId);
      }
      set({ selectedIds: next });
    },

    selectAll: () => {
      const ids = new Set(get().projectCandidates.map(c => c.id));
      set({ selectedIds: ids });
    },

    clearSelection: () => {
      set({ selectedIds: new Set() });
    },

    // ── Filters ─────────────────────────────────────────────────────────

    setStatusFilter: (status) => set({ statusFilter: status }),
    setCandidateSearchQuery: (query) => set({ candidateSearchQuery: query }),
    setPoolSearchQuery: (query) => set({ poolSearchQuery: query }),
    setViewMode: (mode) => set({ viewMode: mode }),

    // ── Favourites ──────────────────────────────────────────────────────

    toggleFavourite: (candidateId) => {
      const next = new Set(get().favourites);
      if (next.has(candidateId)) {
        next.delete(candidateId);
      } else {
        next.add(candidateId);
      }
      set({ favourites: next });
    },

    setFavourites: (ids) => {
      set({ favourites: new Set(ids) });
    },

    // ── Events ──────────────────────────────────────────────────────────

    pushEvent: (event) => {
      const fullEvent: CastingEvent = {
        ...event,
        id: generateId(),
        createdAt: new Date().toISOString(),
      };
      set({ events: [...get().events, fullEvent] });
    },

    undoLastEvent: () => {
      const events = get().events;
      if (events.length === 0) return null;
      const last = events[events.length - 1];
      set({ events: events.slice(0, -1) });

      // Reverse the last operation
      if (last.type === 'status_changed') {
        const { candidateId, from } = last.payload as {
          candidateId: string;
          from: CandidateStatus;
        };
        const next = get().projectCandidates.map(c =>
          c.id === candidateId ? { ...c, status: from } : c,
        );
        set({
          projectCandidates: next,
          countsByStatus: computeCountsByStatus(next),
        });
      } else if (last.type === 'candidate_removed') {
        const { candidate } = last.payload as { candidate: ProjectCandidate };
        if (candidate) {
          const next = [...get().projectCandidates, candidate];
          set({
            projectCandidates: next,
            countsByStatus: computeCountsByStatus(next),
          });
        }
      }

      return last;
    },

    // ── Reset ───────────────────────────────────────────────────────────

    reset: () => {
      set(INITIAL_STATE);
    },
  })),
);

// ─── Selectors (for performant subscriptions) ────────────────────────────────

export const selectProjectCandidates = (state: CastingStoreState) =>
  state.projectCandidates;

export const selectPoolCandidates = (state: CastingStoreState) =>
  state.poolCandidates;

export const selectCountsByStatus = (state: CastingStoreState) =>
  state.countsByStatus;

export const selectSelectedCandidate = (state: CastingStoreState) => {
  if (!state.selectedCandidateId) return null;
  return state.projectCandidates.find(c => c.id === state.selectedCandidateId) ?? null;
};

export const selectFilteredCandidates = (state: CastingStoreState) => {
  let candidates = state.projectCandidates;

  // Status filter
  if (state.statusFilter !== 'all') {
    candidates = candidates.filter(c => c.status === state.statusFilter);
  }

  // Search filter
  if (state.candidateSearchQuery.trim()) {
    const q = state.candidateSearchQuery.toLowerCase();
    candidates = candidates.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.contactInfo.email?.toLowerCase().includes(q) ||
      c.auditionNotes.toLowerCase().includes(q),
    );
  }

  return candidates;
};

export const selectStatusSummary = (state: CastingStoreState) => {
  const counts = state.countsByStatus;
  return (Object.keys(CANDIDATE_STATUS_LABELS) as CandidateStatus[]).map(status => ({
    status,
    label: CANDIDATE_STATUS_LABELS[status],
    color: CANDIDATE_STATUS_COLORS[status],
    count: counts[status],
  }));
};
