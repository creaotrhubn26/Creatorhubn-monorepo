/**
 * scheduleReducer – single source of truth for all AuditionSchedulePanel UI state.
 *
 * Replaces 11 independent useState calls with a typed reducer so state
 * transitions are explicit, predictable, and easy to test.
 *
 * Usage:
 *   const [state, dispatch] = useReducer(scheduleReducer, initialScheduleState);
 */

export type SortField = 'date' | 'candidate' | 'role' | 'status';
export type SortDirection = 'asc' | 'desc';
export type ViewMode = 'grid' | 'table' | 'compact';
export type StatusFilter = 'all' | 'scheduled' | 'confirmed' | 'awaiting_callback' | 'completed' | 'cancelled' | 'pool';

// ── State ────────────────────────────────────────────────────

export interface ScheduleState {
  searchQuery: string;
  statusFilter: StatusFilter;
  dateFilter: string;
  candidateFilter: string;
  roleFilter: string;
  locationFilter: string;
  /** Filter to only favorites */
  favoritesOnly: boolean;
  /** Filter to only today's schedules */
  todayOnly: boolean;
  sortField: SortField;
  sortDirection: SortDirection;
  viewMode: ViewMode;
  showStats: boolean;
  /** IDs of rows currently checked for bulk actions */
  selectedIds: ReadonlySet<string>;
  /** IDs of expanded card rows (grid view) */
  expandedCards: ReadonlySet<string>;
  /** 'project' = normal schedule, 'pool' = unscheduled pool */
  poolMode: 'project' | 'pool';
  /** Pagination offset (server-side paging) */
  offset: number;
  /** The schedule ID open in the Details Drawer (null = closed) */
  drawerScheduleId: string | null;
  /** Last clicked row index – used for shift+click range select */
  lastSelectedIndex: number | null;
}

export const initialScheduleState: ScheduleState = {
  searchQuery: '',
  statusFilter: 'all',
  dateFilter: '',
  candidateFilter: 'all',
  roleFilter: 'all',
  locationFilter: 'all',
  favoritesOnly: false,
  todayOnly: false,
  sortField: 'date',
  sortDirection: 'asc',
  viewMode: 'table',
  showStats: false,
  selectedIds: new Set(),
  expandedCards: new Set(),
  poolMode: 'project',
  offset: 0,
  drawerScheduleId: null,
  lastSelectedIndex: null,
};

// ── Actions ──────────────────────────────────────────────────

export type ScheduleAction =
  | { type: 'SET_SEARCH'; query: string }
  | { type: 'SET_STATUS_FILTER'; status: StatusFilter }
  | { type: 'SET_DATE_FILTER'; date: string }
  | { type: 'SET_CANDIDATE_FILTER'; candidateId: string }
  | { type: 'SET_ROLE_FILTER'; roleId: string }
  | { type: 'SET_LOCATION_FILTER'; location: string }
  | { type: 'SET_FAVORITES_ONLY'; value: boolean }
  | { type: 'SET_TODAY_ONLY'; value: boolean }
  | { type: 'SET_SORT'; field: SortField }          // toggles dir if same field
  | { type: 'SET_SORT_DIRECTION'; dir: SortDirection }
  | { type: 'SET_VIEW_MODE'; mode: ViewMode }
  | { type: 'TOGGLE_STATS' }
  | { type: 'TOGGLE_SELECTED'; id: string; index?: number }
  | { type: 'SELECT_ALL'; ids: string[] }
  | { type: 'DESELECT_ALL' }
  | { type: 'RANGE_SELECT'; ids: string[] }
  | { type: 'TOGGLE_EXPANDED'; id: string }
  | { type: 'SET_POOL_MODE'; mode: 'project' | 'pool' }
  | { type: 'SET_OFFSET'; offset: number }
  | { type: 'OPEN_DRAWER'; scheduleId: string }
  | { type: 'CLOSE_DRAWER' }
  | { type: 'CLEAR_FILTERS' };

// ── Reducer ──────────────────────────────────────────────────

export function scheduleReducer(
  state: ScheduleState,
  action: ScheduleAction,
): ScheduleState {
  switch (action.type) {
    case 'SET_SEARCH':
      return { ...state, searchQuery: action.query, offset: 0 };

    case 'SET_STATUS_FILTER':
      return { ...state, statusFilter: action.status, offset: 0 };

    case 'SET_DATE_FILTER':
      return { ...state, dateFilter: action.date, offset: 0 };

    case 'SET_CANDIDATE_FILTER':
      return { ...state, candidateFilter: action.candidateId, offset: 0 };

    case 'SET_ROLE_FILTER':
      return { ...state, roleFilter: action.roleId, offset: 0 };

    case 'SET_LOCATION_FILTER':
      return { ...state, locationFilter: action.location, offset: 0 };

    case 'SET_FAVORITES_ONLY':
      return { ...state, favoritesOnly: action.value, offset: 0 };

    case 'SET_TODAY_ONLY':
      return { ...state, todayOnly: action.value, offset: 0 };

    case 'SET_SORT': {
      const sameField = state.sortField === action.field;
      return {
        ...state,
        sortField: action.field,
        sortDirection: sameField
          ? (state.sortDirection === 'asc' ? 'desc' : 'asc')
          : 'asc',
        offset: 0,
      };
    }

    case 'SET_SORT_DIRECTION':
      return { ...state, sortDirection: action.dir };

    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.mode };

    case 'TOGGLE_STATS':
      return { ...state, showStats: !state.showStats };

    case 'TOGGLE_SELECTED': {
      const next = new Set(state.selectedIds);
      if (next.has(action.id)) {
        next.delete(action.id);
      } else {
        next.add(action.id);
      }
      return { ...state, selectedIds: next, lastSelectedIndex: action.index ?? null };
    }

    case 'SELECT_ALL':
      return { ...state, selectedIds: new Set(action.ids) };

    case 'DESELECT_ALL':
      return { ...state, selectedIds: new Set(), lastSelectedIndex: null };

    case 'RANGE_SELECT': {
      const next = new Set(state.selectedIds);
      for (const id of action.ids) next.add(id);
      return { ...state, selectedIds: next };
    }

    case 'TOGGLE_EXPANDED': {
      const next = new Set(state.expandedCards);
      if (next.has(action.id)) {
        next.delete(action.id);
      } else {
        next.add(action.id);
      }
      return { ...state, expandedCards: next };
    }

    case 'SET_POOL_MODE':
      return { ...state, poolMode: action.mode, offset: 0, selectedIds: new Set() };

    case 'SET_OFFSET':
      return { ...state, offset: action.offset };

    case 'OPEN_DRAWER':
      return { ...state, drawerScheduleId: action.scheduleId };

    case 'CLOSE_DRAWER':
      return { ...state, drawerScheduleId: null };

    case 'CLEAR_FILTERS':
      return {
        ...state,
        searchQuery: '',
        statusFilter: 'all',
        dateFilter: '',
        candidateFilter: 'all',
        roleFilter: 'all',
        locationFilter: 'all',
        favoritesOnly: false,
        todayOnly: false,
        offset: 0,
      };

    default:
      return state;
  }
}

// ── Derived helpers ──────────────────────────────────────────

/** Returns true when any non-default filter is active */
export function hasActiveFilters(state: ScheduleState): boolean {
  return (
    state.searchQuery !== '' ||
    state.statusFilter !== 'all' ||
    state.dateFilter !== '' ||
    state.candidateFilter !== 'all' ||
    state.roleFilter !== 'all' ||
    state.locationFilter !== 'all' ||
    state.favoritesOnly ||
    state.todayOnly
  );
}

/** Converts pool mode + filter state to AuditionListFilters for the API call */
export function stateToApiFilters(state: ScheduleState): {
  status?: string;
  candidateId?: string;
  roleId?: string;
  location?: string;
  dateFrom?: string;
  favoritesOnly?: boolean;
  todayOnly?: boolean;
  search?: string;
  sort: SortField;
  dir: SortDirection;
  limit: number;
  offset: number;
} {
  const { searchQuery, statusFilter, dateFilter, candidateFilter, roleFilter, locationFilter, favoritesOnly, todayOnly, sortField, sortDirection, poolMode, offset } = state;
  return {
    status:       poolMode === 'pool' ? 'pool' : (statusFilter !== 'all' ? statusFilter : undefined),
    candidateId:  candidateFilter !== 'all' ? candidateFilter : undefined,
    roleId:       roleFilter !== 'all' ? roleFilter : undefined,
    location:     locationFilter !== 'all' ? locationFilter : undefined,
    dateFrom:     dateFilter || undefined,
    favoritesOnly: favoritesOnly || undefined,
    todayOnly:    todayOnly || undefined,
    search:       searchQuery || undefined,
    sort:         sortField,
    dir:          sortDirection,
    limit:        200,
    offset,
  };
}
