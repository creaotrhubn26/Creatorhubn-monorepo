// @ts-nocheck
/**
 * useCrewData – production-grade crew state machine
 *
 * Architecture:
 * - useReducer for all UI state (no prop-drilling through many useState calls)
 * - Precomputed Maps for O(1) lookups (crewById, departmentGroups)
 * - Debounced search (300 ms) to avoid re-filtering on every keystroke
 * - filteredCrew derived via useMemo (stable references)
 * - Conflict detection (pure function, runs on assignments change)
 * - Offline queue: localStorage outbox flushed when window comes online
 */

import {
  useReducer,
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type {
  CrewMember,
  CrewRole,
  CrewDepartment,
  CrewStatus,
  CrewAssignment,
  CrewConflict,
  AvailabilityCell,
} from '../models/casting';
import { castingService } from '../services/castingService';

// ─── Constants ───────────────────────────────────────────────────────────────

const SEARCH_DEBOUNCE_MS = 300;
const OFFLINE_QUEUE_KEY_PREFIX = 'crewDataOfflineQueue';

export const getCrewOfflineQueueStorageKey = (projectId: string): string =>
  `${OFFLINE_QUEUE_KEY_PREFIX}:${projectId || 'global'}`;

// ─── Role → Department mapping ────────────────────────────────────────────────

export const ROLE_DEPARTMENT_MAP: Record<CrewRole, CrewDepartment> = {
  director: 'production',
  producer: 'production',
  casting_director: 'production',
  production_manager: 'production',
  production_assistant: 'production',
  script_supervisor: 'production',
  location_manager: 'production',
  camera_operator: 'camera',
  camera_assistant: 'camera',
  cinematographer: 'camera',
  drone_pilot: 'camera',
  gaffer: 'lighting',
  grip: 'lighting',
  sound_engineer: 'sound',
  audio_mixer: 'sound',
  video_editor: 'post',
  colorist: 'post',
  vfx_artist: 'post',
  motion_graphics: 'post',
  production_designer: 'art',
  makeup_artist: 'other',
  wardrobe: 'wardrobe',
  stylist: 'wardrobe',
  collaborator: 'other',
  other: 'other',
};

export const DEPARTMENT_LABELS: Record<CrewDepartment, string> = {
  camera: 'Kamera',
  sound: 'Lyd',
  lighting: 'Lys',
  production: 'Produksjon',
  post: 'Post',
  art: 'Art / Design',
  wardrobe: 'Kostyme',
  other: 'Annet',
};

export const DEPARTMENT_ORDER: CrewDepartment[] = [
  'production',
  'camera',
  'lighting',
  'sound',
  'art',
  'wardrobe',
  'post',
  'other',
];

// ─── Status meta ─────────────────────────────────────────────────────────────

export const STATUS_META: Record<
  CrewStatus,
  { label: string; color: string; bgColor: string }
> = {
  confirmed: { label: 'Bekreftet', color: '#10b981', bgColor: 'rgba(16,185,129,0.2)' },
  pending:   { label: 'Venter',    color: '#ffb800', bgColor: 'rgba(255,184,0,0.2)'   },
  invited:   { label: 'Invitert',  color: '#3b82f6', bgColor: 'rgba(59,130,246,0.2)'  },
  unavailable: { label: 'Utilgjengelig', color: '#ef4444', bgColor: 'rgba(239,68,68,0.2)' },
};

// ─── Sort & filter types ──────────────────────────────────────────────────────

export type SortField = 'name' | 'role' | 'rate' | 'availability' | 'status' | 'department';
export type SortDirection = 'asc' | 'desc';
export type ViewMode = 'grid' | 'table';

export interface CrewFilters {
  search: string;
  debouncedSearch: string;
  role: CrewRole | 'all';
  department: CrewDepartment | 'all';
  status: CrewStatus | 'all';
  onlyAvailable: boolean;
  onlyAssignedToday: boolean;
}

// ─── Reducer state ────────────────────────────────────────────────────────────

export interface CrewUIState {
  selectedIds: Set<string>;
  viewMode: ViewMode;
  sortField: SortField;
  sortDirection: SortDirection;
  filters: CrewFilters;
  bulkMode: boolean;
  drawerCrewId: string | null;      // CrewDetailsDrawer
  inviteDialogOpen: boolean;
  editingCrewId: string | null;     // null = new member
  dialogOpen: boolean;
  showFilters: boolean;
  showStats: boolean;
  showCostCalculator: boolean;
  showDepartmentSidebar: boolean;
  expandedCards: Set<string>;
}

// ─── Reducer actions ──────────────────────────────────────────────────────────

export type CrewUIAction =
  | { type: 'SET_SEARCH'; payload: string }
  | { type: 'SET_DEBOUNCED_SEARCH'; payload: string }
  | { type: 'SET_FILTER_ROLE'; payload: CrewRole | 'all' }
  | { type: 'SET_FILTER_DEPT'; payload: CrewDepartment | 'all' }
  | { type: 'SET_FILTER_STATUS'; payload: CrewStatus | 'all' }
  | { type: 'SET_FILTER_AVAILABLE'; payload: boolean }
  | { type: 'SET_FILTER_TODAY'; payload: boolean }
  | { type: 'CLEAR_FILTERS' }
  | { type: 'SET_SORT'; payload: { field: SortField; direction: SortDirection } }
  | { type: 'SET_VIEW_MODE'; payload: ViewMode }
  | { type: 'SELECT_ONE'; payload: string }
  | { type: 'SELECT_ALL'; payload: string[] }
  | { type: 'DESELECT_ALL' }
  | { type: 'TOGGLE_BULK_MODE' }
  | { type: 'OPEN_DRAWER'; payload: string }
  | { type: 'CLOSE_DRAWER' }
  | { type: 'OPEN_INVITE' }
  | { type: 'CLOSE_INVITE' }
  | { type: 'OPEN_DIALOG'; payload: string | null }
  | { type: 'CLOSE_DIALOG' }
  | { type: 'TOGGLE_FILTERS' }
  | { type: 'TOGGLE_STATS' }
  | { type: 'TOGGLE_COST_CALCULATOR' }
  | { type: 'TOGGLE_DEPT_SIDEBAR' }
  | { type: 'TOGGLE_CARD'; payload: string };

const initialFilters: CrewFilters = {
  search: '',
  debouncedSearch: '',
  role: 'all',
  department: 'all',
  status: 'all',
  onlyAvailable: false,
  onlyAssignedToday: false,
};

export const initialUIState: CrewUIState = {
  selectedIds: new Set(),
  viewMode: 'table',
  sortField: 'name',
  sortDirection: 'asc',
  filters: initialFilters,
  bulkMode: false,
  drawerCrewId: null,
  inviteDialogOpen: false,
  editingCrewId: null,
  dialogOpen: false,
  showFilters: false,
  showStats: true,
  showCostCalculator: false,
  showDepartmentSidebar: true,
  expandedCards: new Set(),
};

export function crewUIReducer(
  state: CrewUIState,
  action: CrewUIAction,
): CrewUIState {
  switch (action.type) {
    case 'SET_SEARCH':
      return { ...state, filters: { ...state.filters, search: action.payload } };
    case 'SET_DEBOUNCED_SEARCH':
      return {
        ...state,
        filters: { ...state.filters, debouncedSearch: action.payload },
      };
    case 'SET_FILTER_ROLE':
      return { ...state, filters: { ...state.filters, role: action.payload } };
    case 'SET_FILTER_DEPT':
      return {
        ...state,
        filters: { ...state.filters, department: action.payload },
      };
    case 'SET_FILTER_STATUS':
      return {
        ...state,
        filters: { ...state.filters, status: action.payload },
      };
    case 'SET_FILTER_AVAILABLE':
      return {
        ...state,
        filters: { ...state.filters, onlyAvailable: action.payload },
      };
    case 'SET_FILTER_TODAY':
      return {
        ...state,
        filters: { ...state.filters, onlyAssignedToday: action.payload },
      };
    case 'CLEAR_FILTERS':
      return { ...state, filters: initialFilters };
    case 'SET_SORT':
      return {
        ...state,
        sortField: action.payload.field,
        sortDirection: action.payload.direction,
      };
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.payload };
    case 'SELECT_ONE': {
      const next = new Set(state.selectedIds);
      if (next.has(action.payload)) next.delete(action.payload);
      else next.add(action.payload);
      return { ...state, selectedIds: next };
    }
    case 'SELECT_ALL':
      return { ...state, selectedIds: new Set(action.payload) };
    case 'DESELECT_ALL':
      return { ...state, selectedIds: new Set() };
    case 'TOGGLE_BULK_MODE':
      return {
        ...state,
        bulkMode: !state.bulkMode,
        selectedIds: new Set(),
      };
    case 'OPEN_DRAWER':
      return { ...state, drawerCrewId: action.payload };
    case 'CLOSE_DRAWER':
      return { ...state, drawerCrewId: null };
    case 'OPEN_INVITE':
      return { ...state, inviteDialogOpen: true };
    case 'CLOSE_INVITE':
      return { ...state, inviteDialogOpen: false };
    case 'OPEN_DIALOG':
      return { ...state, dialogOpen: true, editingCrewId: action.payload };
    case 'CLOSE_DIALOG':
      return { ...state, dialogOpen: false, editingCrewId: null };
    case 'TOGGLE_FILTERS':
      return { ...state, showFilters: !state.showFilters };
    case 'TOGGLE_STATS':
      return { ...state, showStats: !state.showStats };
    case 'TOGGLE_COST_CALCULATOR':
      return { ...state, showCostCalculator: !state.showCostCalculator };
    case 'TOGGLE_DEPT_SIDEBAR':
      return { ...state, showDepartmentSidebar: !state.showDepartmentSidebar };
    case 'TOGGLE_CARD': {
      const next = new Set(state.expandedCards);
      if (next.has(action.payload)) next.delete(action.payload);
      else next.add(action.payload);
      return { ...state, expandedCards: next };
    }
    default:
      return state;
  }
}

// ─── Offline queue (simple localStorage outbox) ───────────────────────────────

interface OfflineAction {
  id: string;
  type: 'save' | 'delete';
  projectId: string;
  data: CrewMember | null;
  crewId?: string;
  timestamp: number;
}

function getOfflineQueue(projectId: string): OfflineAction[] {
  try {
    return JSON.parse(localStorage.getItem(getCrewOfflineQueueStorageKey(projectId)) || '[]');
  } catch {
    return [];
  }
}

function setOfflineQueue(projectId: string, queue: OfflineAction[]): void {
  try {
    localStorage.setItem(getCrewOfflineQueueStorageKey(projectId), JSON.stringify(queue));
  } catch {
    // storage quota exceeded – silently drop overflow
  }
}

function enqueueOffline(action: OfflineAction): void {
  const q = getOfflineQueue(action.projectId);
  q.push(action);
  setOfflineQueue(action.projectId, q);
}

async function flushOfflineQueue(projectId: string): Promise<void> {
  const queue = getOfflineQueue(projectId);
  if (!queue.length) return;
  setOfflineQueue(projectId, []);
  for (const action of queue) {
    try {
      if (action.type === 'save' && action.data) {
        await castingService.saveCrew(action.projectId, action.data);
      } else if (action.type === 'delete' && action.crewId) {
        await castingService.deleteCrew(action.projectId, action.crewId);
      }
    } catch {
      // Put back into queue if still failing
      enqueueOffline(action);
    }
  }
}

// ─── Conflict detection (pure) ────────────────────────────────────────────────

export function detectConflicts(
  assignments: CrewAssignment[],
): CrewConflict[] {
  const byKey = new Map<string, CrewAssignment[]>();
  for (const a of assignments) {
    const key = `${a.crewMemberId}__${a.shootDayDate}`;
    const existing = byKey.get(key) ?? [];
    existing.push(a);
    byKey.set(key, existing);
  }
  const conflicts: CrewConflict[] = [];
  for (const [key, list] of byKey) {
    if (list.length > 1) {
      const [memberId] = key.split('__');
      conflicts.push({
        crewMemberId: memberId,
        date: list[0].shootDayDate,
        conflictType:
          list.map((a) => a.unit).some(
            (u, _, arr) => arr.filter((x) => x === u).length > 1,
          )
            ? 'unit_overlap'
            : 'double_booked',
        details: `Assigned to ${list.map((a) => `Unit ${a.unit}`).join(' & ')} on the same day`,
      });
    }
  }
  return conflicts;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getMemberDepartment(member: CrewMember): CrewDepartment {
  return member.department ?? ROLE_DEPARTMENT_MAP[member.role] ?? 'other';
}

function isAvailableToday(member: CrewMember): boolean {
  const today = new Date().toISOString().split('T')[0];
  // Per-day cells take precedence when present
  if (member.availabilityCells?.length) {
    const cell: AvailabilityCell | undefined = member.availabilityCells.find(
      (c) => c.date === today,
    );
    if (cell) return cell.availability === 'available';
  }
  // Fall back to date-range availability
  if (!member.availability?.startDate) return false;
  const start = member.availability.startDate;
  const end = member.availability.endDate ?? '9999-12-31';
  return today >= start && today <= end;
}

/**
 * Generates AvailabilityCell records for every date in [from, to] (inclusive).
 * Uses explicit per-day cells when present; otherwise synthesises from the
 * member's date-range availability.
 */
export function buildAvailabilityCells(
  member: CrewMember,
  from: string,
  to: string,
): AvailabilityCell[] {
  const results: AvailabilityCell[] = [];
  const cursor = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  const rangeStart = member.availability?.startDate ?? null;
  const rangeEnd = member.availability?.endDate ?? '9999-12-31';
  while (cursor <= end) {
    const dateStr = cursor.toISOString().split('T')[0];
    // Check explicit per-day overrides first
    const explicit: AvailabilityCell | undefined = member.availabilityCells?.find(
      (c) => c.date === dateStr,
    );
    if (explicit) {
      results.push(explicit);
    } else {
      const available: boolean =
        rangeStart !== null && dateStr >= rangeStart && dateStr <= rangeEnd;
      results.push({ date: dateStr, availability: available ? 'available' : 'unavailable' });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return results;
}

function sortCrew(
  crew: CrewMember[],
  field: SortField,
  dir: SortDirection,
): CrewMember[] {
  const multiplier = dir === 'asc' ? 1 : -1;
  return [...crew].sort((a, b) => {
    switch (field) {
      case 'name':
        return multiplier * a.name.localeCompare(b.name, 'nb');
      case 'role':
        return multiplier * a.role.localeCompare(b.role, 'nb');
      case 'rate':
        return multiplier * ((a.rate ?? 0) - (b.rate ?? 0));
      case 'availability':
        return (
          multiplier *
          ((isAvailableToday(a) ? 0 : 1) - (isAvailableToday(b) ? 0 : 1))
        );
      case 'status': {
        const order: Record<CrewStatus, number> = {
          confirmed: 0,
          pending: 1,
          invited: 2,
          unavailable: 3,
        };
        return (
          multiplier *
          ((order[a.status ?? 'pending'] ?? 4) -
            (order[b.status ?? 'pending'] ?? 4))
        );
      }
      case 'department':
        return (
          multiplier *
          getMemberDepartment(a).localeCompare(getMemberDepartment(b), 'nb')
        );
      default:
        return 0;
    }
  });
}

// ─── Main hook ────────────────────────────────────────────────────────────────

export interface UseCrewDataReturn {
  // Data
  crewMembers: CrewMember[];
  filteredCrew: CrewMember[];
  crewById: Map<string, CrewMember>;
  departmentGroups: Map<CrewDepartment, CrewMember[]>;
  conflicts: Map<string, CrewConflict[]>; // keyed by crewMemberId
  offlinePending: number;

  // UI state
  uiState: CrewUIState;
  dispatch: Dispatch<CrewUIAction>;

  // CRUD
  loadCrew: () => Promise<void>;
  saveMember: (member: CrewMember) => Promise<void>;
  deleteMember: (id: string) => Promise<void>;
  duplicateMember: (member: CrewMember) => Promise<void>;
  bulkDelete: (ids: string[]) => Promise<void>;
  updateStatus: (id: string, status: CrewStatus) => Promise<void>;
  /** Direct setter for optimistic updates from the consuming component */
  setCrewMembers: Dispatch<SetStateAction<CrewMember[]>>;

  // Assignments
  assignments: CrewAssignment[];
  addAssignment: (a: CrewAssignment) => void;
  removeAssignment: (id: string) => void;

  // Helpers
  isAvailableNow: (member: CrewMember) => boolean;
  getMemberConflicts: (memberId: string) => CrewConflict[];
  /**
   * Returns per-day AvailabilityCell records for a date range [from, to].
   * If the member has explicit `availabilityCells` data those are returned;
   * otherwise cells are synthesised from the member's date-range availability.
   */
  getAvailabilityCells: (member: CrewMember, from: string, to: string) => AvailabilityCell[];
}

export function useCrewData(
  projectId: string,
  onUpdate?: () => void,
): UseCrewDataReturn {
  const [uiState, dispatch] = useReducer(crewUIReducer, initialUIState);
  const [crewMembers, setCrewMembersRaw] = useState<CrewMember[]>([]);
  const [assignments, setAssignments] = useState<CrewAssignment[]>([]);
  const [offlinePending, setOfflinePending] = useState(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── CRUD: loadCrew defined first so effects below can depend on it ──────────

  const loadCrew = useCallback(async () => {
    try {
      const crew = await castingService.getCrew(projectId);
      setCrewMembersRaw(Array.isArray(crew) ? crew : []);
    } catch {
      // Silently fall back to empty — caller shows error toast
    }
  }, [projectId]);

  // ── Debounce search ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      dispatch({
        type: 'SET_DEBOUNCED_SEARCH',
        payload: uiState.filters.search,
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [uiState.filters.search]);

  // ── Offline flush on reconnect ──────────────────────────────────────────────
  useEffect(() => {
    const handleOnline = () => {
      flushOfflineQueue(projectId).then(() => {
        setOfflinePending(getOfflineQueue(projectId).length);
        loadCrew();
      });
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [projectId, loadCrew]);

  // ── Initial offline count ────────────────────────────────────────────────────
  useEffect(() => {
    setOfflinePending(getOfflineQueue(projectId).length);
  }, [projectId]);

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  const saveMember = useCallback(
    async (member: CrewMember) => {
      if (!navigator.onLine) {
        // Optimistic update
        setCrewMembersRaw((prev) => {
          const idx = prev.findIndex((m) => m.id === member.id);
          return idx >= 0
            ? prev.map((m, i) => (i === idx ? member : m))
            : [...prev, member];
        });
        enqueueOffline({
          id: `${Date.now()}`,
          type: 'save',
          projectId,
          data: member,
          timestamp: Date.now(),
        });
        setOfflinePending((n) => n + 1);
        return;
      }
      await castingService.saveCrew(projectId, member);
      await loadCrew();
      onUpdate?.();
    },
    [projectId, loadCrew, onUpdate],
  );

  const deleteMember = useCallback(
    async (id: string) => {
      if (!navigator.onLine) {
        setCrewMembersRaw((prev) => prev.filter((m) => m.id !== id));
        enqueueOffline({
          id: `${Date.now()}`,
          type: 'delete',
          projectId,
          data: null,
          crewId: id,
          timestamp: Date.now(),
        });
        setOfflinePending((n) => n + 1);
        return;
      }
      await castingService.deleteCrew(projectId, id);
      await loadCrew();
      onUpdate?.();
    },
    [projectId, loadCrew, onUpdate],
  );

  const duplicateMember = useCallback(
    async (member: CrewMember) => {
      const duplicate: CrewMember = {
        ...member,
        id: `crew-${Date.now()}`,
        name: `${member.name} (kopi)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await saveMember(duplicate);
    },
    [saveMember],
  );

  const bulkDelete = useCallback(
    async (ids: string[]) => {
      await Promise.all(ids.map((id) => deleteMember(id)));
      dispatch({ type: 'DESELECT_ALL' });
    },
    [deleteMember],
  );

  const updateStatus = useCallback(
    async (id: string, status: CrewStatus) => {
      const member = crewMembers.find((m) => m.id === id);
      if (!member) return;
      await saveMember({
        ...member,
        status,
        updatedAt: new Date().toISOString(),
      });
    },
    [crewMembers, saveMember],
  );

  // ── Assignment ops ────────────────────────────────────────────────────────────

  const addAssignment = useCallback((a: CrewAssignment) => {
    setAssignments((prev) => [...prev, a]);
  }, []);

  const removeAssignment = useCallback((id: string) => {
    setAssignments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // ── Precomputed Maps ──────────────────────────────────────────────────────────

  const crewById = useMemo(
    () => new Map(crewMembers.map((m) => [m.id, m])),
    [crewMembers],
  );

  const departmentGroups = useMemo(() => {
    const map = new Map<CrewDepartment, CrewMember[]>();
    for (const dept of DEPARTMENT_ORDER) map.set(dept, []);
    for (const m of crewMembers) {
      const dept = getMemberDepartment(m);
      const arr = map.get(dept) ?? [];
      arr.push(m);
      map.set(dept, arr);
    }
    return map;
  }, [crewMembers]);

  // ── Conflict map ──────────────────────────────────────────────────────────────

  const conflicts = useMemo<Map<string, CrewConflict[]>>(() => {
    const raw = detectConflicts(assignments);
    const map = new Map<string, CrewConflict[]>();
    for (const c of raw) {
      const arr = map.get(c.crewMemberId) ?? [];
      arr.push(c);
      map.set(c.crewMemberId, arr);
    }
    return map;
  }, [assignments]);

  // ── Filtered & sorted crew ────────────────────────────────────────────────────

  const filteredCrew = useMemo(() => {
    const {
      debouncedSearch,
      role,
      department,
      status,
      onlyAvailable,
      onlyAssignedToday,
    } = uiState.filters;

    const todayStr = new Date().toISOString().split('T')[0];
    const q = debouncedSearch.toLowerCase();

    const filtered = crewMembers.filter((m) => {
      if (q) {
        const haystack =
          `${m.name} ${m.contactInfo?.email ?? ''} ${m.contactInfo?.phone ?? ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (role !== 'all' && m.role !== role) return false;
      if (department !== 'all' && getMemberDepartment(m) !== department)
        return false;
      if (status !== 'all' && m.status !== status) return false;
      if (onlyAvailable && !isAvailableToday(m)) return false;
      if (onlyAssignedToday) {
        const hasDay = m.assignedDays?.includes(todayStr) ?? false;
        if (!hasDay) return false;
      }
      return true;
    });

    return sortCrew(filtered, uiState.sortField, uiState.sortDirection);
  }, [crewMembers, uiState.filters, uiState.sortField, uiState.sortDirection]);

  // ── Helpers re-exposed ────────────────────────────────────────────────────────

  const isAvailableNow = useCallback(
    (member: CrewMember): boolean => isAvailableToday(member),
    [],
  );

  const getMemberConflicts = useCallback(
    (memberId: string): CrewConflict[] => conflicts.get(memberId) ?? [],
    [conflicts],
  );

  const getAvailabilityCells = useCallback(
    (member: CrewMember, from: string, to: string): AvailabilityCell[] =>
      buildAvailabilityCells(member, from, to),
    [],
  );

  return {
    crewMembers,
    filteredCrew,
    crewById,
    departmentGroups,
    conflicts,
    offlinePending,
    uiState,
    dispatch,
    loadCrew,
    saveMember,
    deleteMember,
    duplicateMember,
    bulkDelete,
    updateStatus,
    setCrewMembers: setCrewMembersRaw,
    assignments,
    addAssignment,
    removeAssignment,
    isAvailableNow,
    getMemberConflicts,
    getAvailabilityCells,
  };
}

