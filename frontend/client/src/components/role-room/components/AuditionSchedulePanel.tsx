import { useState, useReducer, useId, useMemo, useEffect, useCallback, useRef, memo } from 'react';
import React from 'react';
import { ContextualNudgeBanner } from './ContextualNudgeBanner';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  TextField,
  IconButton,
  Chip,
  Grid,
  Tooltip,
  Collapse,
  Snackbar,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Paper,
  Checkbox,
  Stack,
  useTheme,
  useMediaQuery,
  LinearProgress,
  Slide,
  Menu,
  Divider,
  Avatar,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Search as SearchIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  FileDownload as ExportIcon,
  ContentCopy as DuplicateIcon,
  GridView as GridViewIcon,
  TableRows as TableViewIcon,
  ViewList as CompactViewIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  Movie as MovieIcon,
  Clear as ClearIcon,
  InterpreterMode as InterpreterModeIcon,
  Note as NoteIcon,
  Inventory as InventoryIcon,
  Sort as SortIcon,
  Today as TodayIcon,
  SwapVert as BulkStatusIcon,
  AccessTime as TimeIcon,
  MoreVert as MoreVertIcon,
  BookmarkBorder as PoolIcon,
  HelpOutline as HelpIcon,
} from '@mui/icons-material';
import { RolesIcon as TheaterComedyIcon, AuditionsIcon, CandidatesIcon, CalendarCustomIcon as CalendarIcon, LocationsIcon as LocationIcon, StatsIcon } from './icons/CastingIcons';
import { Schedule, Role, Candidate } from '../models/casting';
import { castingService } from '../services/castingService';
import { auditionPoolService, PoolAudition } from '../services/auditionPoolService';
import { useToast } from './ToastStack';
import { RoleRoomEmptyState } from './icons/RoleRoomEmptyState';
import cameraPng from './icons/Keep/roleroom_camera.png';
import { formatNotesToReactNodes } from '../utils/auditionNoteFormatter';
import { AuditionGuide } from './production/AuditionGuide';
import {
  scheduleReducer,
  initialScheduleState,
  stateToApiFilters,
  hasActiveFilters as computeHasActiveFilters,
  type SortField as ReducerSortField,
  type StatusFilter as ReducerStatusFilter,
} from '../hooks/scheduleReducer';
import { useAuditionSchedules } from '../hooks/useAuditionSchedules';
import { ScheduleDetailsDrawer } from './ScheduleDetailsDrawer';

// WCAG 2.2 - 2.5.5 Target Size: minimum 44x44px touch targets
const TOUCH_TARGET_SIZE = 44;

/** Escape a string for safe embedding in an HTML template literal. */
const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// WCAG 2.2 - 2.4.7 Focus Visible: clear focus indicator
const focusVisibleStyles = {
  '&:focus-visible': {
    outline: '3px solid #ffb800',
    outlineOffset: 2,
  },
};

type SortField = ReducerSortField;
type SortDirection = 'asc' | 'desc';
type ViewMode = 'grid' | 'table' | 'compact';
type StatusFilter = ReducerStatusFilter;

interface AuditionSchedulePanelProps {
  projectId: string;
  /** Legacy: schedules pre-fetched by parent. Panel now owns its own fetch via useAuditionSchedules. */
  schedules?: Schedule[];
  candidates: Candidate[];
  roles: Role[];
  availableScenes: { id: string; name: string }[];
  onSchedulesChange: () => void;
  onEditSchedule: (schedule: Schedule) => void;
  onCreateSchedule: () => void;
  onNavigateToTab: (tabIndex: number) => void;
  profession?: 'photographer' | 'videographer' | null;
  /** Optional – enables per-user favorite persistence via DB */
  userId?: string;
}

function AuditionSchedulePanelInner({
  projectId,
  schedules: schedulesProp = [],
  candidates,
  roles,
  availableScenes,
  onSchedulesChange,
  onEditSchedule,
  onCreateSchedule,
  onNavigateToTab,
  userId,
}: AuditionSchedulePanelProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const titleId = useId();
  const statsId = useId();
  
  // ── UI state — single reducer (replaces 10+ useState) ──────
  const [uiState, dispatch] = useReducer(scheduleReducer, initialScheduleState);
  const {
    searchQuery, statusFilter, dateFilter, candidateFilter, roleFilter,
    locationFilter, favoritesOnly, todayOnly,
    sortField, sortDirection, viewMode, showStats, selectedIds, expandedCards,
    poolMode, drawerScheduleId, lastSelectedIndex,
  } = uiState;

  // Adapter setters – preserve existing internal API without touching every call site
  const setSearchQuery      = useCallback((q: string)           => dispatch({ type: 'SET_SEARCH',            query: q }),        []);
  const setStatusFilter     = useCallback((s: StatusFilter)     => dispatch({ type: 'SET_STATUS_FILTER',     status: s }),       []);
  const setDateFilter       = useCallback((d: string)           => dispatch({ type: 'SET_DATE_FILTER',       date: d }),         []);
  const setCandidateFilter  = useCallback((id: string)          => dispatch({ type: 'SET_CANDIDATE_FILTER',  candidateId: id }), []);
  const setRoleFilter       = useCallback((id: string)          => dispatch({ type: 'SET_ROLE_FILTER',       roleId: id }),      []);
  const setLocationFilter   = useCallback((loc: string)         => dispatch({ type: 'SET_LOCATION_FILTER',   location: loc }),   []);
  const setFavoritesOnly    = useCallback((v: boolean)          => dispatch({ type: 'SET_FAVORITES_ONLY',    value: v }),        []);
  const setTodayOnly        = useCallback((v: boolean)          => dispatch({ type: 'SET_TODAY_ONLY',        value: v }),        []);
  const setSortField        = useCallback((f: ReducerSortField) => dispatch({ type: 'SET_SORT',              field: f }),        []);
  const setSortDirection    = useCallback((d: SortDirection)    => dispatch({ type: 'SET_SORT_DIRECTION',    dir: d }),          []);
  const setViewMode         = useCallback((m: ViewMode)         => dispatch({ type: 'SET_VIEW_MODE',         mode: m }),         []);
  const setShowStats        = useCallback(() => dispatch({ type: 'TOGGLE_STATS' }),                                              []);
  const setPoolMode         = useCallback((m: 'project' | 'pool') => dispatch({ type: 'SET_POOL_MODE',      mode: m }),         []);
  const clearFilters        = useCallback(() => dispatch({ type: 'CLEAR_FILTERS' }),                                             []);
  const openDrawer          = useCallback((id: string)          => dispatch({ type: 'OPEN_DRAWER',           scheduleId: id }),  []);
  const closeDrawer         = useCallback(()                    => dispatch({ type: 'CLOSE_DRAWER' }),                           []);

  // Derived: is any filter active?
  const hasActiveFilters = computeHasActiveFilters(uiState);

  // Per-render state (not part of filter/sort/view)
  const [undoSnackbarOpen, setUndoSnackbarOpen] = useState(false);
  const [lastDeleted, setLastDeleted] = useState<Schedule | null>(null);
  const [poolAuditions, setPoolAuditions] = useState<PoolAudition[]>([]);
  const [poolLoading, setPoolLoading] = useState(false);
  const [rowMenuAnchor, setRowMenuAnchor] = useState<{ el: HTMLElement; schedule: Schedule } | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);

  const { showSuccess, showError } = useToast();
  const containerPadding = isMobile ? 2 : isTablet ? 3 : 4;

  // Stable ref so the keyboard effect never becomes stale without re-subscribing
  const handleExportCSVRef = useRef<() => void>(() => {});
  const searchInputRef = useRef<HTMLInputElement>(null);
  const focusedRowIndexRef = useRef<number>(-1);

  // ── Server-side data – resolves filter/sort/pagination ─────
  const apiFilters = useMemo(() => stateToApiFilters(uiState), [uiState]);
  const {
    items: hookItems,
    counts: serverCounts,
    createMutation,
    updateMutation: _updateMutation,
    patchMutation,
    deleteMutation,
    bulkDeleteMutation,
    favoriteMutation,
    isFetching,
  } = useAuditionSchedules(projectId, apiFilters, userId);

  /**
   * When the hook resolves, use server-filtered items.
   * Fall back to the prop-supplied array on first render or when offline.
   */
  const usingHookData = hookItems.length > 0 || isFetching;

  // Derive favorites as a Set<id> from per-row flag returned by the API
  const favorites = useMemo(
    () => new Set(hookItems.filter(i => (i as Record<string, unknown>).favorite === true).map(i => i.id)),
    [hookItems],
  );

  /** Toggle a favorite via the DB API (or fall back to local state when no userId) */
  const toggleFavoriteViaApi = useCallback((id: string) => {
    if (userId) {
      favoriteMutation.mutate({ scheduleId: id, favorite: !favorites.has(id) });
    }
  }, [favorites, userId, favoriteMutation]);

  // Keyboard shortcuts — uses a stable ref so the effect never grows stale
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable;

      // Global shortcuts (always active)
      if (e.key === 'Escape') {
        if (selectedIds.size > 0) {
          e.preventDefault();
          dispatch({ type: 'DESELECT_ALL' });
        } else {
          dispatch({ type: 'CLOSE_DRAWER' });
        }
        return;
      }

      if (isTyping) return;

      // Non-typing shortcuts
      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        onCreateSchedule();
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'n') { e.preventDefault(); onCreateSchedule(); }
        if (e.key === 'e') { e.preventDefault(); handleExportCSVRef.current(); }
        if (e.key === 'd') {
          e.preventDefault();
          if (focusedRowIndexRef.current >= 0) {
            const s = filteredAndSortedSchedulesRef.current[focusedRowIndexRef.current];
            if (s) handleDuplicateRef.current(s);
          }
        }
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = Math.min(
          focusedRowIndexRef.current + 1,
          filteredAndSortedSchedulesRef.current.length - 1,
        );
        focusedRowIndexRef.current = next;
        const row = document.querySelector(`[data-schedule-index="${next}"]`) as HTMLElement | null;
        row?.focus();
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = Math.max(focusedRowIndexRef.current - 1, 0);
        focusedRowIndexRef.current = prev;
        const row = document.querySelector(`[data-schedule-index="${prev}"]`) as HTMLElement | null;
        row?.focus();
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        const s = filteredAndSortedSchedulesRef.current[focusedRowIndexRef.current];
        if (s) openDrawer(s.id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onCreateSchedule, selectedIds.size]);

  // ── O(1) lookup maps — rebuilt only when the source arrays change ──────────
  const candidateById = useMemo(
    () => new Map(candidates.map(c => [c.id, c.name])),
    [candidates],
  );
  const roleById = useMemo(
    () => new Map(roles.map(r => [r.id, r.name])),
    [roles],
  );
  const sceneById = useMemo(
    () => new Map(availableScenes.map(s => [s.id, s.name])),
    [availableScenes],
  );

  const getCandidateName = useCallback(
    (id: string) => candidateById.get(id) ?? 'Ukjent',
    [candidateById],
  );
  const getRoleName = useCallback(
    (id: string) => roleById.get(id) ?? 'Ukjent',
    [roleById],
  );
  const getSceneName = useCallback(
    (id?: string) => (id ? sceneById.get(id) ?? null : null),
    [sceneById],
  );

  // Helper functions
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':         return '#3b82f6';  // blue
      case 'awaiting_callback': return '#a855f7';  // purple
      case 'completed':         return '#10b981';  // green
      case 'cancelled':         return '#ef4444';  // red
      case 'pool':              return '#94a3b8';  // neutral
      default:                  return '#ffb800';  // amber (scheduled)
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmed':         return 'Bekreftet';
      case 'awaiting_callback': return 'Tilbakemelding';
      case 'completed':         return 'Fullf\u00f8rt';
      case 'cancelled':         return 'Kansellert';
      case 'pool':              return 'Uplanlagt';
      default:                  return 'Planlagt';
    }
  };

  // NOTE: renderFormattedNotes extracted to auditionNoteFormatter.tsx as formatNotesToReactNodes
  // ── placeholder so references in JSX below are resolved via the imported util ──
  const renderFormattedNotes = formatNotesToReactNodes;

  // Map a server AuditionScheduleRow (snake_case, denormalized) to the component's Schedule shape
  const mapHookItem = useCallback((item: Record<string, unknown>): Schedule & { candidateName?: string; roleName?: string; isFavorite?: boolean } => ({
    id:          String(item.id ?? ''),
    candidateId: String(item.candidate_id ?? item.candidateId ?? ''),
    roleId:      String(item.role_id      ?? item.roleId      ?? ''),
    sceneId:     item.scene_id    ? String(item.scene_id)    : undefined,
    locationId:  item.location_id ? String(item.location_id) : undefined,
    date:        String(item.date ?? ''),
    time:        String(item.time ?? ''),
    location:    String(item.location ?? ''),
    notes:       item.notes ? String(item.notes) : undefined,
    status:      (item.status as Schedule['status']) ?? 'scheduled',
    candidateName: item.candidate_name ? String(item.candidate_name) : undefined,
    roleName:      item.role_name      ? String(item.role_name)      : undefined,
    isFavorite:    Boolean(item.favorite),
  }), []);

  /**
   * The active schedule list.
   * When the hook has resolved (usingHookData), the server has already applied
   * all filters + sort, so we just map rows to the Schedule shape.
   * Otherwise fall back to local filter+sort on the prop array.
   */
  const schedules = usingHookData
    ? (hookItems as Record<string, unknown>[]).map(mapHookItem)
    : schedulesProp;

  // Precomputed timestamps for O(1) sort comparisons (only used in fallback path)
  const scheduleTimeMs = useMemo(
    () => new Map(schedulesProp.map(s => [s.id, Date.parse(`${s.date}T${s.time}`)])),
    [schedulesProp],
  );

  // Filter and sort — only runs when NOT using hook data (server handles it otherwise)
  const filteredAndSortedSchedules = useMemo(() => {
    if (usingHookData) {
      // Already filtered + sorted by server; just return the mapped array
      return schedules;
    }
    let result = [...schedulesProp];
    
    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s => 
        getCandidateName(s.candidateId).toLowerCase().includes(q) ||
        getRoleName(s.roleId).toLowerCase().includes(q) ||
        s.location.toLowerCase().includes(q) ||
        s.notes?.toLowerCase().includes(q)
      );
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(s => s.status === statusFilter);
    }
    
    // Date filter
    if (dateFilter) {
      result = result.filter(s => s.date === dateFilter);
    }
    
    // Candidate filter
    if (candidateFilter !== 'all') {
      result = result.filter(s => s.candidateId === candidateFilter);
    }
    
    // Role filter
    if (roleFilter !== 'all') {
      result = result.filter(s => s.roleId === roleFilter);
    }

    // Location filter
    if (locationFilter !== 'all') {
      result = result.filter(s => s.location === locationFilter);
    }
    
    // Sort - favorites first
    result.sort((a, b) => {
      const aFav = favorites.has(a.id) ? 0 : 1;
      const bFav = favorites.has(b.id) ? 0 : 1;
      if (aFav !== bFav) return aFav - bFav;
      
      let comparison = 0;
      switch (sortField) {
        case 'date':
          comparison = (scheduleTimeMs.get(a.id) ?? 0) - (scheduleTimeMs.get(b.id) ?? 0);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'candidate':
          comparison = getCandidateName(a.candidateId).localeCompare(getCandidateName(b.candidateId));
          break;
        case 'role':
          comparison = getRoleName(a.roleId).localeCompare(getRoleName(b.roleId));
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return result;
  }, [usingHookData, schedules, schedulesProp, searchQuery, statusFilter, dateFilter, candidateFilter, roleFilter, locationFilter, sortField, sortDirection, favorites, scheduleTimeMs, getCandidateName, getRoleName]);

  // Unique location strings derived from the full schedule list (used by the toolbar filter)
  const uniqueLocations = useMemo(
    () => [...new Set(schedules.filter(s => s.location).map(s => s.location))].sort(),
    [schedules],
  );

  // Stable refs for keyboard handler (avoids stale closure)
  const filteredAndSortedSchedulesRef = useRef(filteredAndSortedSchedules);
  useEffect(() => { filteredAndSortedSchedulesRef.current = filteredAndSortedSchedules; }, [filteredAndSortedSchedules]);
  const handleDuplicateRef = useRef<(s: Schedule) => void>(() => {});

  // Statistics – use server counts when hook is live (accurate, includes pool)
  const statistics = useMemo(() => {
    if (serverCounts) {
      return {
        total:     serverCounts.total,
        scheduled: serverCounts.scheduled,
        completed: serverCounts.completed,
        cancelled: serverCounts.cancelled,
        upcoming:  serverCounts.today,   // 'today' maps to upcoming scheduled today
        favorites: serverCounts.favorites,
      };
    }
    // Fallback: compute from prop data
    return {
      total:     schedulesProp.length,
      scheduled: schedulesProp.filter(s => s.status === 'scheduled').length,
      completed: schedulesProp.filter(s => s.status === 'completed').length,
      cancelled: schedulesProp.filter(s => s.status === 'cancelled').length,
      upcoming:  schedulesProp.filter(s => {
        if (s.status !== 'scheduled') return false;
        const ms = scheduleTimeMs.get(s.id);
        return ms !== undefined && ms >= Date.now();
      }).length,
      favorites: favorites.size,
    };
  }, [serverCounts, schedulesProp, favorites, scheduleTimeMs]);

  // Handlers
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
    }
  };

  const toggleFavorite = (id: string) => {
    if (userId) {
      toggleFavoriteViaApi(id);
    }
    // When no userId (unauthenticated), silently skip (favorites require login)
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredAndSortedSchedules.length) {
      dispatch({ type: 'DESELECT_ALL' });
    } else {
      dispatch({ type: 'SELECT_ALL', ids: filteredAndSortedSchedules.map(s => s.id) });
    }
  };

  const handleToggleSelect = (id: string, index: number, shiftKey: boolean) => {
    if (shiftKey && lastSelectedIndex !== null && lastSelectedIndex !== index) {
      const from = Math.min(lastSelectedIndex, index);
      const to   = Math.max(lastSelectedIndex, index);
      const rangeIds = filteredAndSortedSchedules.slice(from, to + 1).map(s => s.id);
      dispatch({ type: 'RANGE_SELECT', ids: rangeIds });
    } else {
      dispatch({ type: 'TOGGLE_SELECTED', id, index });
    }
  };

  /** Open the Details Drawer for the clicked row */
  const handleRowClick = (scheduleId: string) => {
    openDrawer(scheduleId);
  };

  /** Called from the Details Drawer when user picks a new status */
  const handleStatusChange = useCallback(async (id: string, status: Schedule['status']) => {
    try {
      await patchMutation.mutateAsync({ scheduleId: id, patch: { status } });
      onSchedulesChange();
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  }, [patchMutation, onSchedulesChange]);

  const handleDeleteWithUndo = async (schedule: Schedule) => {
    setLastDeleted(schedule);
    try {
      await deleteMutation.mutateAsync(schedule.id);
      onSchedulesChange();
      setUndoSnackbarOpen(true);
    } catch (error) {
      console.error('Failed to delete schedule:', error);
      setLastDeleted(null);
    }
  };

  const handleUndoDelete = async () => {
    if (lastDeleted) {
      try {
        await createMutation.mutateAsync({
          id: lastDeleted.id,
          candidateId: lastDeleted.candidateId,
          roleId: lastDeleted.roleId,
          sceneId: lastDeleted.sceneId,
          locationId: lastDeleted.locationId,
          date: lastDeleted.date,
          startTime: lastDeleted.time,
          notes: lastDeleted.notes,
          location: lastDeleted.location,
          status: lastDeleted.status,
        });
        onSchedulesChange();
      } catch (error) {
        console.error('Failed to restore schedule:', error);
      }
      setLastDeleted(null);
    }
    setUndoSnackbarOpen(false);
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Er du sikker på at du vil slette ${selectedIds.size} avtaler?`)) return;
    const ids = Array.from(selectedIds);
    try {
      const { deleted } = await bulkDeleteMutation.mutateAsync(ids);
      dispatch({ type: 'DESELECT_ALL' });
      onSchedulesChange();
      showSuccess(`${deleted} avtale${deleted !== 1 ? 'r' : ''} slettet`, 3000);
    } catch {
      // Bulk endpoint failed – fall back to individual deletes
      const results = await Promise.allSettled(ids.map(id => deleteMutation.mutateAsync(id)));
      const failed = results.filter(r => r.status === 'rejected').length;
      const deleted = results.length - failed;
      dispatch({ type: 'DESELECT_ALL' });
      onSchedulesChange();
      if (failed > 0) showError(`${deleted} slettet, ${failed} feilet`, 5000);
      else showSuccess(`${deleted} slettet`, 3000);
    }
  };

  const handleDuplicate = async (schedule: Schedule) => {
    try {
      await createMutation.mutateAsync({
        id: `schedule-${crypto.randomUUID()}`,
        candidateId: schedule.candidateId,
        roleId: schedule.roleId,
        sceneId: schedule.sceneId,
        locationId: schedule.locationId,
        date: schedule.date,
        startTime: schedule.time,
        notes: schedule.notes,
        location: schedule.location,
        status: 'scheduled',
      });
      onSchedulesChange();
    } catch (error) {
      console.error('Failed to duplicate schedule:', error);
    }
  };

  // Keep stable ref in sync for ⌘D keyboard shortcut
  useEffect(() => { handleDuplicateRef.current = handleDuplicate; });

  const handleBulkStatusChange = async (status: Schedule['status']) => {
    const ids = Array.from(selectedIds);
    try {
      await Promise.all(ids.map(id => patchMutation.mutateAsync({ scheduleId: id, patch: { status } })));
      dispatch({ type: 'DESELECT_ALL' });
      onSchedulesChange();
      showSuccess(`${ids.length} oppdatert til "${getStatusLabel(status)}"`, 3000);
    } catch {
      showError('Noen oppdateringer feilet', 4000);
    }
  };

  const loadPoolAuditions = async () => {
    setPoolLoading(true);
    try {
      const auditions = await auditionPoolService.getPoolAuditions();
      setPoolAuditions(auditions);
    } catch (error) {
      console.error('Error loading pool auditions:', error);
    } finally {
      setPoolLoading(false);
    }
  };

  // Pool auditions are only loaded when the user switches to pool view
  useEffect(() => {
    if (poolMode === 'pool') loadPoolAuditions();
  }, [poolMode]);

  const handleSaveToPool = async (schedule: Schedule) => {
    try {
      const poolId = await auditionPoolService.saveScheduleToPool(schedule.id);
      if (poolId) {
        showSuccess('Audition lagret til pool', 3000);
        loadPoolAuditions();
      } else {
        showError('Kunne ikke lagre til pool', 3000);
      }
    } catch (error) {
      console.error('Error saving to pool:', error);
      showError('En feil oppstod', 3000);
    }
  };

  const handleImportFromPool = async (poolAudition: PoolAudition) => {
    try {
      const newId = await auditionPoolService.importToProject(poolAudition.id, projectId);
      if (newId) {
        showSuccess(`${poolAudition.title} importert til prosjektet`, 3000);
        onSchedulesChange();
        setPoolMode('project');
      } else {
        showError('Kunne ikke importere audition', 3000);
      }
    } catch (error) {
      console.error('Error importing from pool:', error);
      showError('En feil oppstod', 3000);
    }
  };

  const handleDeleteFromPool = async (poolAuditionId: string) => {
    try {
      const success = await auditionPoolService.deleteFromPool(poolAuditionId);
      if (success) {
        showSuccess('Audition fjernet fra pool', 3000);
        loadPoolAuditions();
      } else {
        showError('Kunne ikke slette fra pool', 3000);
      }
    } catch (error) {
      console.error('Error deleting from pool:', error);
      showError('En feil oppstod', 3000);
    }
  };

  const handleExportCSV = useCallback(() => {
    try {
      const project = castingService.getProject(projectId);
      if (!project) {
        alert('Prosjekt ikke funnet');
        return;
      }

      const htmlContent = generateAuditionsHTML(project, filteredAndSortedSchedules);

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Kunne ikke åpne eksport-vindu. Vennligst tillat popups.');
        return;
      }

      printWindow.document.write(htmlContent);
      printWindow.document.close();

      setTimeout(() => { printWindow.print(); }, 250);
    } catch (error) {
      console.error('Error exporting auditions:', error);
      alert('Kunne ikke eksportere auditions');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, filteredAndSortedSchedules]);

  // Keep the stable ref in sync so the keyboard effect always calls the latest version
  useEffect(() => { handleExportCSVRef.current = handleExportCSV; }, [handleExportCSV]);
  // generateAuditionsHTML closes over candidateById/roleById Maps from outer scope
  const generateAuditionsHTML = (project: any, schedules: any[]): string => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('nb-NO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const totalSchedules = schedules.length;
    const completedSchedules = schedules.filter((s: any) => s.status === 'completed').length;
    const scheduledSchedules = schedules.filter((s: any) => s.status === 'scheduled').length;
    const completedPercent = totalSchedules > 0 ? Math.round((completedSchedules / totalSchedules) * 100) : 0;

    // O(1) lookups via outer Maps
    const safeCandidate = (id: string) => escapeHtml(candidateById.get(id) ?? 'Ukjent');
    const safeRole      = (id: string) => escapeHtml(roleById.get(id) ?? 'Ukjent');

    const scheduleIconSVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>`;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(project.name)} - Auditions</title>
  <style>
    @page { margin: 0; counter-increment: page; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1a1a1a; line-height: 1.7; padding: 0; background: #fff; font-size: 14px; }
    .page { padding: 50px 60px 80px 60px; max-width: 210mm; margin: 0 auto; min-height: 297mm; position: relative; }
    .header { background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-bottom: 5px solid #8b5cf6; padding: 30px 35px; margin: -50px -60px 40px -60px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
    .title { font-size: 36px; font-weight: 800; color: #8b5cf6; margin-bottom: 10px; letter-spacing: -1px; line-height: 1.2; display: flex; align-items: center; gap: 12px; }
    .title svg { flex-shrink: 0; }
    .subtitle { color: #64748b; font-size: 15px; font-weight: 500; margin-top: 5px; }
    .summary { background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-left: 6px solid #8b5cf6; padding: 30px; margin-bottom: 45px; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    .summary-title { font-size: 20px; font-weight: 700; color: #8b5cf6; margin-bottom: 25px; letter-spacing: -0.3px; display: flex; align-items: center; gap: 12px; }
    .summary-title svg { flex-shrink: 0; }
    .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 25px; }
    .summary-item { background: white; padding: 25px 20px; border-radius: 10px; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
    .summary-number { font-size: 36px; font-weight: 800; color: #8b5cf6; display: block; margin-bottom: 8px; line-height: 1; }
    .summary-label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600; display: block; }
    .progress-bar { width: 100%; height: 6px; background: #e2e8f0; border-radius: 10px; margin-top: 10px; overflow: hidden; }
    .progress-fill { height: 100%; background: linear-gradient(90deg, #8b5cf6 0%, #7c3aed 100%); border-radius: 10px; }
    .section { margin-bottom: 50px; page-break-inside: avoid; }
    .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 22px; padding-bottom: 15px; border-bottom: 3px solid #e2e8f0; }
    .section-title { font-size: 24px; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 12px; letter-spacing: -0.4px; }
    .section-icon { display: inline-flex; align-items: center; }
    .section-icon svg { flex-shrink: 0; }
    .section-count { font-size: 13px; font-weight: 600; color: #64748b; background: #f1f5f9; padding: 6px 14px; border-radius: 20px; border: 1px solid #e2e8f0; }
    .section-content { background: #fafbfc; padding: 0; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
    table { width: 100%; border-collapse: collapse; }
    th { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; font-weight: 700; padding: 18px 20px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.8px; border: none; }
    th:first-child { border-top-left-radius: 10px; }
    th:last-child { border-top-right-radius: 10px; }
    td { padding: 16px 20px; border-bottom: 1px solid #e2e8f0; color: #334155; font-size: 14px; font-weight: 400; vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    tr:nth-child(even) { background-color: #f8fafc; }
    .badge { display: inline-block; padding: 6px 14px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
    .badge-scheduled { background: #00d4ff; color: white; }
    .badge-completed { background: #10b981; color: white; }
    .badge-cancelled { background: #ef4444; color: white; }
    .footer { position: fixed; bottom: 0; left: 0; right: 0; padding: 15px 60px; border-top: 2px solid #e2e8f0; background: #fafbfc; display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #64748b; font-weight: 500; }
    .footer-left { display: flex; gap: 20px; }
    .footer-right { display: flex; gap: 20px; }
    .page-number { font-weight: 600; }
    .page-number::after { content: counter(page); }
    .empty-state { padding: 50px; text-align: center; color: #94a3b8; font-style: italic; font-size: 15px; }
    @media print {
      .page { padding: 30px 40px 70px 40px; }
      .section { page-break-inside: avoid; margin-bottom: 35px; }
      .summary { page-break-inside: avoid; }
      .footer { padding: 12px 40px; }
      .header { margin: -30px -40px 35px -40px; padding: 25px 30px; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="title">
        ${scheduleIconSVG}
        ${escapeHtml(project.name)} - Auditions
      </div>
      <div class="subtitle">Eksportert: ${dateStr}</div>
    </div>
    <div class="summary">
      <div class="summary-title">
        ${scheduleIconSVG}
        Oversikt
      </div>
      <div class="summary-grid">
        <div class="summary-item">
          <span class="summary-number">${totalSchedules}</span>
          <span class="summary-label">Totale Auditions</span>
        </div>
        <div class="summary-item">
          <span class="summary-number">${scheduledSchedules}</span>
          <span class="summary-label">Planlagte</span>
        </div>
        <div class="summary-item">
          <span class="summary-number">${completedSchedules}</span>
          <span class="summary-label">Fullførte</span>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${completedPercent}%"></div>
          </div>
        </div>
      </div>
    </div>
    <div class="section">
      <div class="section-header">
        <div class="section-title">
          <span class="section-icon">${scheduleIconSVG}</span>
          Auditions
        </div>
        <span class="section-count">${totalSchedules} audition${totalSchedules !== 1 ? 'er' : ''}</span>
      </div>
      <div class="section-content">
        ${schedules.length === 0
          ? '<div class="empty-state">Ingen auditions ennå</div>'
          : `<table>
          <thead>
            <tr>
              <th style="width: 12%;">Dato</th>
              <th style="width: 10%;">Tid</th>
              <th style="width: 20%;">Kandidat</th>
              <th style="width: 18%;">Rolle</th>
              <th style="width: 20%;">Lokasjon</th>
              <th style="width: 10%;">Status</th>
              <th style="width: 10%;">Notater</th>
            </tr>
          </thead>
          <tbody>
            ${schedules.map((s) => {
              const statusBadgeClass = s.status === 'completed' ? 'badge-completed' : s.status === 'cancelled' ? 'badge-cancelled' : 'badge-scheduled';
              const rawNotes = s.notes || '-';
              const notesText = escapeHtml(rawNotes.length > 50 ? rawNotes.substring(0, 50) + '...' : rawNotes);
              return `<tr>
              <td>${new Date(s.date).toLocaleDateString('nb-NO')}</td>
              <td style="text-align: center;">${escapeHtml(s.time)}</td>
              <td><strong>${safeCandidate(s.candidateId)}</strong></td>
              <td>${safeRole(s.roleId)}</td>
              <td style="font-size: 13px;">${escapeHtml(s.location || '-')}</td>
              <td><span class="badge ${statusBadgeClass}">${getStatusLabel(s.status)}</span></td>
              <td style="font-size: 13px;">${notesText}</td>
            </tr>`;
            }).join('')}
          </tbody>
        </table>`
        }
      </div>
    </div>
    <div class="footer">
      <div class="footer-left">
        <span>${escapeHtml(project.name)}</span>
        <span>|</span>
        <span>ID: ${project.id.substring(0, 8)}</span>
      </div>
      <div class="footer-right">
        <span class="page-number">Side </span>
        <span>|</span>
        <span>${dateStr}</span>
      </div>
    </div>
  </div>
</body>
</html>`;
  };

  const toggleCardExpanded = (id: string) => {
    dispatch({ type: 'TOGGLE_EXPANDED', id });
  };

  return (
    <Box
      component="section"
      aria-labelledby={titleId}
      sx={{ p: containerPadding, width: '100%', maxWidth: '100%' }}
    >
      <ContextualNudgeBanner context="auditions" accentColor="#14b8a6" />

      {/* ── Header ─────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: { xs: 48, sm: 56 },
              height: { xs: 48, sm: 56 },
              borderRadius: 2,
              bgcolor: 'rgba(255, 184, 0, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <InterpreterModeIcon sx={{ fontSize: { xs: 24, sm: 28 }, color: '#ffb800' }} />
          </Box>
          <Box>
            <Typography
              variant="h5"
              component="h2"
              id={titleId}
              sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '1.25rem', sm: '1.5rem' }, lineHeight: 1.2, mb: 0.25 }}
            >
              Audition Schedule
            </Typography>
            {/* Meta info row: total · showing · favorites · upcoming */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                {statistics.total} totalt
              </Typography>
              {filteredAndSortedSchedules.length !== statistics.total && (
                <>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.2)' }}>·</Typography>
                  <Typography variant="caption" sx={{ color: '#ffb800' }}>
                    Viser {filteredAndSortedSchedules.length}
                  </Typography>
                </>
              )}
              {statistics.favorites > 0 && (
                <>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.2)' }}>·</Typography>
                  <Typography variant="caption" sx={{ color: '#ffc107' }}>
                    ⭐ {statistics.favorites} favoritter
                  </Typography>
                </>
              )}
              {statistics.upcoming > 0 && (
                <>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.2)' }}>·</Typography>
                  <Typography variant="caption" sx={{ color: '#3b82f6' }}>
                    📅 {statistics.upcoming} i dag
                  </Typography>
                </>
              )}
              {isFetching && (
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>
                  · oppdaterer…
                </Typography>
              )}
            </Box>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Tooltip title="Open guide">
            <IconButton
              onClick={() => setGuideOpen(true)}
              size="small"
              sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#ffb800' } }}
              aria-label="Open Audition Planner guide"
            >
              <HelpIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Eksporter (Ctrl+E)">
            <span>
              <Button
                variant="outlined"
                startIcon={<ExportIcon />}
                onClick={handleExportCSV}
                disabled={filteredAndSortedSchedules.length === 0}
                sx={{
                  borderColor: 'rgba(255,255,255,0.2)',
                  color: '#fff',
                  minHeight: TOUCH_TARGET_SIZE,
                  ...focusVisibleStyles,
                }}
              >
                {!isMobile && 'Eksporter'}
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="Vis statistikk">
            <Button
              variant={showStats ? 'contained' : 'outlined'}
              startIcon={<StatsIcon />}
              onClick={() => setShowStats(!showStats)}
              sx={{
                borderColor: 'rgba(255,255,255,0.2)',
                color: showStats ? '#000' : '#fff',
                bgcolor: showStats ? '#ffb800' : 'transparent',
                minHeight: TOUCH_TARGET_SIZE,
                ...focusVisibleStyles,
              }}
            >
              {!isMobile && 'Statistikk'}
            </Button>
          </Tooltip>
          <Tooltip title="Ny avtale (F)">
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={onCreateSchedule}
              disabled={candidates.length === 0 || roles.length === 0}
              sx={{
                bgcolor: '#ffb800',
                color: '#000',
                fontWeight: 700,
                minHeight: TOUCH_TARGET_SIZE,
                '&:hover': { bgcolor: '#e6a600' },
                '&:disabled': { bgcolor: 'rgba(255,184,0,0.3)' },
                ...focusVisibleStyles,
              }}
            >
              {isMobile ? '' : '+ New Schedule'}
            </Button>
          </Tooltip>
        </Box>
      </Box>

      {/* isFetching indicator */}
      {isFetching && (
        <LinearProgress
          sx={{
            mb: 1,
            borderRadius: 1,
            bgcolor: 'rgba(255,184,0,0.1)',
            '& .MuiLinearProgress-bar': { bgcolor: '#ffb800' },
          }}
        />
      )}

      {/* Project/Templates Toggle */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <Button
          variant={poolMode === 'project' ? 'contained' : 'outlined'}
          onClick={() => setPoolMode('project')}
          startIcon={<CalendarIcon />}
          sx={{
            bgcolor: poolMode === 'project' ? '#ffb800' : 'transparent',
            color: poolMode === 'project' ? '#000' : 'rgba(255,255,255,0.7)',
            borderColor: poolMode === 'project' ? '#ffb800' : 'rgba(255,255,255,0.2)',
            minHeight: TOUCH_TARGET_SIZE,
            '&:hover': { bgcolor: poolMode === 'project' ? '#e6a600' : 'rgba(255,255,255,0.05)' },
            ...focusVisibleStyles,
          }}
        >
          Prosjekt
          <Chip
            label={schedules.length}
            size="small"
            sx={{ ml: 1, bgcolor: 'rgba(255,255,255,0.2)', color: 'inherit', height: 20, fontSize: '0.7rem' }}
          />
        </Button>
        <Button
          variant={poolMode === 'pool' ? 'contained' : 'outlined'}
          onClick={() => { setPoolMode('pool'); loadPoolAuditions(); }}
          startIcon={<InventoryIcon />}
          sx={{
            bgcolor: poolMode === 'pool' ? '#9c27b0' : 'transparent',
            color: poolMode === 'pool' ? '#fff' : 'rgba(255,255,255,0.7)',
            borderColor: poolMode === 'pool' ? '#9c27b0' : 'rgba(255,255,255,0.2)',
            minHeight: TOUCH_TARGET_SIZE,
            '&:hover': { bgcolor: poolMode === 'pool' ? '#7b1fa2' : 'rgba(255,255,255,0.05)' },
            ...focusVisibleStyles,
          }}
        >
          Maler
          <Chip
            label={poolAuditions.length}
            size="small"
            sx={{ ml: 1, bgcolor: 'rgba(255,255,255,0.2)', color: 'inherit', height: 20, fontSize: '0.7rem' }}
          />
        </Button>
      </Box>

      {/* Statistics Panel */}
      <Collapse in={showStats}>
        <Box
          id={statsId}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(6, 1fr)' },
            gap: { xs: 1, sm: 2 },
            mb: 3,
            p: { xs: 1.5, sm: 2 },
            bgcolor: 'rgba(255, 184, 0, 0.05)',
            borderRadius: 2,
            border: '1px solid rgba(255, 184, 0, 0.2)',
          }}
        >
          <Box sx={{ textAlign: 'center', p: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <AuditionsIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: '#ffb800' }} />
            </Box>
            <Typography variant="h4" sx={{ color: '#ffb800', fontWeight: 700 }}>{statistics.total}</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>Totalt</Typography>
          </Box>
          <Box sx={{ textAlign: 'center', p: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <CalendarIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: '#00d4ff' }} />
            </Box>
            <Typography variant="h4" sx={{ color: '#00d4ff', fontWeight: 700 }}>{statistics.upcoming}</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>Kommende</Typography>
          </Box>
          <Box sx={{ textAlign: 'center', p: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <AuditionsIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: '#00d4ff' }} />
            </Box>
            <Typography variant="h4" sx={{ color: '#00d4ff', fontWeight: 700 }}>{statistics.scheduled}</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>Planlagt</Typography>
          </Box>
          <Box sx={{ textAlign: 'center', p: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <AuditionsIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: '#10b981' }} />
            </Box>
            <Typography variant="h4" sx={{ color: '#10b981', fontWeight: 700 }}>{statistics.completed}</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>Fullført</Typography>
          </Box>
          <Box sx={{ textAlign: 'center', p: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <AuditionsIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: '#ef4444' }} />
            </Box>
            <Typography variant="h4" sx={{ color: '#ef4444', fontWeight: 700 }}>{statistics.cancelled}</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>Kansellert</Typography>
          </Box>
          <Box sx={{ textAlign: 'center', p: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <StarIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: '#ffc107' }} />
            </Box>
            <Typography variant="h4" sx={{ color: '#ffc107', fontWeight: 700 }}>{statistics.favorites}</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>Favoritter</Typography>
          </Box>
        </Box>
      </Collapse>

      {/* Project View - only shown when in project mode */}
      {poolMode === 'project' && (
      <>
      {/* ── Row 1: Search + Sort + View Toggles ── */}
      <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search field – press / to focus */}
        <TextField
          inputRef={searchInputRef}
          placeholder={isMobile ? 'Filtrer…  (/)' : 'Filtrer avtaler…  (trykk / for å fokusere)'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          size="small"
          slotProps={{
            input: {
              startAdornment: <SearchIcon sx={{ color: 'rgba(255,255,255,0.5)', mr: 1, fontSize: 18 }} />,
              endAdornment: searchQuery
                ? <IconButton size="small" onClick={() => setSearchQuery('')} sx={{ color: 'rgba(255,255,255,0.4)', p: 0.25 }}><ClearIcon sx={{ fontSize: 16 }} /></IconButton>
                : null,
              sx: { minHeight: TOUCH_TARGET_SIZE },
            },
            htmlInput: { 'aria-label': 'Filtrer avtaler' },
          }}
          sx={{
            flex: 1,
            minWidth: 200,
            '& .MuiOutlinedInput-root': {
              color: '#fff',
              '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
              '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.35)' },
              '&.Mui-focused fieldset': { borderColor: '#ffb800' },
            },
          }}
        />

        {/* Date filter */}
        <TextField
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          size="small"
          slotProps={{
            input: { sx: { minHeight: TOUCH_TARGET_SIZE, color: dateFilter ? '#ffb800' : '#fff' } },
            htmlInput: { 'aria-label': 'Filtrer på dato' },
          }}
          sx={{
            minWidth: { xs: '100%', sm: 155 },
            '& .MuiOutlinedInput-root': {
              color: dateFilter ? '#ffb800' : '#fff',
              '& fieldset': { borderColor: dateFilter ? 'rgba(255,184,0,0.5)' : 'rgba(255,255,255,0.15)' },
              '&.Mui-focused fieldset': { borderColor: '#ffb800' },
            },
          }}
        />

        {/* Candidate filter */}
        {candidates.length > 0 && (
          <FormControl size="small" sx={{ minWidth: 160, display: { xs: 'none', md: 'flex' } }}>
            <Select
              value={candidateFilter}
              onChange={(e) => setCandidateFilter(e.target.value)}
              displayEmpty
              startAdornment={<CandidatesIcon sx={{ fontSize: 18, color: candidateFilter !== 'all' ? '#ffb800' : 'rgba(255,255,255,0.5)', mr: 0.75, ml: -0.5 }} />}
              aria-label="Filtrer på kandidat"
              sx={{
                color: candidateFilter !== 'all' ? '#ffb800' : '#fff',
                minHeight: TOUCH_TARGET_SIZE,
                '& .MuiOutlinedInput-notchedOutline': { borderColor: candidateFilter !== 'all' ? 'rgba(255,184,0,0.5)' : 'rgba(255,255,255,0.15)' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#ffb800' },
                '& .MuiSvgIcon-root:last-child': { color: 'rgba(255,255,255,0.5)' },
              }}
              MenuProps={{ slotProps: { paper: { sx: { bgcolor: '#1c2128', color: '#fff' } } } }}
            >
              <MenuItem value="all">Alle kandidater</MenuItem>
              {candidates.map(c => (
                <MenuItem key={c.id} value={c.id} sx={{ fontSize: 13 }}>{c.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {/* Role filter */}
        {roles.length > 0 && (
          <FormControl size="small" sx={{ minWidth: 160, display: { xs: 'none', lg: 'flex' } }}>
            <Select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              displayEmpty
              startAdornment={<PersonIcon sx={{ fontSize: 18, color: roleFilter !== 'all' ? '#00d4ff' : 'rgba(255,255,255,0.5)', mr: 0.75, ml: -0.5 }} />}
              aria-label="Filtrer på rolle"
              sx={{
                color: roleFilter !== 'all' ? '#00d4ff' : '#fff',
                minHeight: TOUCH_TARGET_SIZE,
                '& .MuiOutlinedInput-notchedOutline': { borderColor: roleFilter !== 'all' ? 'rgba(0,212,255,0.5)' : 'rgba(255,255,255,0.15)' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#00d4ff' },
                '& .MuiSvgIcon-root:last-child': { color: 'rgba(255,255,255,0.5)' },
              }}
              MenuProps={{ slotProps: { paper: { sx: { bgcolor: '#1c2128', color: '#fff' } } } }}
            >
              <MenuItem value="all">Alle roller</MenuItem>
              {roles.map(r => (
                <MenuItem key={r.id} value={r.id} sx={{ fontSize: 13 }}>{r.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {/* Location filter */}
        {uniqueLocations.length > 0 && (
          <FormControl size="small" sx={{ minWidth: 160, display: { xs: 'none', xl: 'flex' } }}>
            <Select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              displayEmpty
              startAdornment={<LocationIcon sx={{ fontSize: 18, color: locationFilter !== 'all' ? '#00e676' : 'rgba(255,255,255,0.5)', mr: 0.75, ml: -0.5 }} />}
              aria-label="Filtrer på sted"
              sx={{
                color: locationFilter !== 'all' ? '#00e676' : '#fff',
                minHeight: TOUCH_TARGET_SIZE,
                '& .MuiOutlinedInput-notchedOutline': { borderColor: locationFilter !== 'all' ? 'rgba(0,230,118,0.5)' : 'rgba(255,255,255,0.15)' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#00e676' },
                '& .MuiSvgIcon-root:last-child': { color: 'rgba(255,255,255,0.5)' },
              }}
              MenuProps={{ slotProps: { paper: { sx: { bgcolor: '#1c2128', color: '#fff' } } } }}
            >
              <MenuItem value="all">Alle steder</MenuItem>
              {uniqueLocations.map(loc => (
                <MenuItem key={loc} value={loc} sx={{ fontSize: 13 }}>{loc}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {/* Sort dropdown */}
        <FormControl size="small" sx={{ minWidth: 175 }}>
          <Select
            value={`${sortField}:${sortDirection}`}
            onChange={(e) => {
              const [field, dir] = e.target.value.split(':');
              setSortField(field as typeof sortField);
              setSortDirection(dir as 'asc' | 'desc');
            }}
            displayEmpty
            startAdornment={<SortIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.5)', mr: 0.75, ml: -0.5 }} />}
            aria-label="Sorter avtaler"
            sx={{
              color: '#fff',
              minHeight: TOUCH_TARGET_SIZE,
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.15)' },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#ffb800' },
              '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.5)' },
            }}
          >
            <MenuItem value="date:asc">Dato (tidligst)</MenuItem>
            <MenuItem value="date:desc">Dato (senest)</MenuItem>
            <MenuItem value="status:asc">Status</MenuItem>
            <MenuItem value="role:asc">Rolle</MenuItem>
            <MenuItem value="candidate:asc">Kandidat</MenuItem>
          </Select>
        </FormControl>

        {/* View toggles */}
        <Box sx={{ display: 'flex', gap: 0.5, ml: { sm: 'auto' } }}>
          {([
            { mode: 'table' as const, icon: <TableViewIcon />, label: 'Tabellvisning' },
            { mode: 'compact' as const, icon: <CompactViewIcon />, label: 'Kompaktvisning' },
            { mode: 'grid' as const, icon: <GridViewIcon />, label: 'Kortvisning' },
          ] as const).map(({ mode, icon, label }) => (
            <Tooltip key={mode} title={label}>
              <IconButton
                onClick={() => setViewMode(mode)}
                size="small"
                aria-label={label}
                sx={{
                  width: TOUCH_TARGET_SIZE,
                  height: TOUCH_TARGET_SIZE,
                  borderRadius: 1,
                  color: viewMode === mode ? '#ffb800' : 'rgba(255,255,255,0.4)',
                  bgcolor: viewMode === mode ? 'rgba(255,184,0,0.12)' : 'transparent',
                  border: '1px solid',
                  borderColor: viewMode === mode ? 'rgba(255,184,0,0.4)' : 'rgba(255,255,255,0.12)',
                  '&:hover': { bgcolor: 'rgba(255,184,0,0.08)', borderColor: 'rgba(255,184,0,0.3)' },
                  ...focusVisibleStyles,
                }}
              >
                {icon}
              </IconButton>
            </Tooltip>
          ))}
        </Box>
      </Box>

      {/* ── Row 2: Filter chips ── */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2, alignItems: 'center' }}>
        {/* Favorites chip */}
        <Chip
          size="small"
          icon={<StarIcon sx={{ fontSize: '14px !important', color: favoritesOnly ? '#ffb800 !important' : 'rgba(255,255,255,0.5) !important' }} />}
          label={`Favoritter${serverCounts?.favorites != null ? ` (${serverCounts.favorites})` : statistics.favorites > 0 ? ` (${statistics.favorites})` : ''}`}
          onClick={() => setFavoritesOnly(!favoritesOnly)}
          variant={favoritesOnly ? 'filled' : 'outlined'}
          sx={{
            cursor: 'pointer',
            bgcolor: favoritesOnly ? 'rgba(255,184,0,0.2)' : 'transparent',
            color: favoritesOnly ? '#ffb800' : 'rgba(255,255,255,0.6)',
            borderColor: favoritesOnly ? 'rgba(255,184,0,0.5)' : 'rgba(255,255,255,0.15)',
            '&:hover': { bgcolor: 'rgba(255,184,0,0.15)', borderColor: 'rgba(255,184,0,0.4)' },
          }}
        />

        {/* Today chip */}
        <Chip
          size="small"
          icon={<TodayIcon sx={{ fontSize: '14px !important', color: todayOnly ? '#3b82f6 !important' : 'rgba(255,255,255,0.5) !important' }} />}
          label={`I dag${serverCounts?.today != null ? ` (${serverCounts.today})` : statistics.upcoming > 0 ? ` (${statistics.upcoming})` : ''}`}
          onClick={() => setTodayOnly(!todayOnly)}
          variant={todayOnly ? 'filled' : 'outlined'}
          sx={{
            cursor: 'pointer',
            bgcolor: todayOnly ? 'rgba(59,130,246,0.2)' : 'transparent',
            color: todayOnly ? '#3b82f6' : 'rgba(255,255,255,0.6)',
            borderColor: todayOnly ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.15)',
            '&:hover': { bgcolor: 'rgba(59,130,246,0.15)', borderColor: 'rgba(59,130,246,0.4)' },
          }}
        />

        {/* Pool chip */}
        <Chip
          size="small"
          icon={<PoolIcon sx={{ fontSize: '14px !important', color: statusFilter === 'pool' ? '#94a3b8 !important' : 'rgba(255,255,255,0.5) !important' }} />}
          label={`Pool${serverCounts?.pool != null ? ` (${serverCounts.pool})` : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'pool' ? 'all' : 'pool')}
          variant={statusFilter === 'pool' ? 'filled' : 'outlined'}
          sx={{
            cursor: 'pointer',
            bgcolor: statusFilter === 'pool' ? 'rgba(148,163,184,0.2)' : 'transparent',
            color: statusFilter === 'pool' ? '#94a3b8' : 'rgba(255,255,255,0.6)',
            borderColor: statusFilter === 'pool' ? 'rgba(148,163,184,0.5)' : 'rgba(255,255,255,0.15)',
            '&:hover': { bgcolor: 'rgba(148,163,184,0.15)' },
          }}
        />

        {/* Status quick-filters (non-pool statuses) */}
        {(['scheduled', 'confirmed', 'awaiting_callback', 'completed', 'cancelled'] as const).map((s) => {
          const isActive = statusFilter === s;
          const color = getStatusColor(s);
          return (
            <Chip
              key={s}
              size="small"
              label={getStatusLabel(s)}
              onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
              variant={isActive ? 'filled' : 'outlined'}
              sx={{
                cursor: 'pointer',
                bgcolor: isActive ? `${color}22` : 'transparent',
                color: isActive ? color : 'rgba(255,255,255,0.5)',
                borderColor: isActive ? `${color}88` : 'rgba(255,255,255,0.1)',
                '&:hover': { bgcolor: `${color}18`, borderColor: `${color}55` },
              }}
            />
          );
        })}

        {/* Active text/date/candidate/role chips */}
        {searchQuery && (
          <Chip size="small" label={`"${searchQuery}"`}
            onDelete={() => setSearchQuery('')}
            icon={<SearchIcon sx={{ fontSize: '13px !important', color: '#ffb800 !important' }} />}
            sx={{ bgcolor: 'rgba(255,184,0,0.15)', color: '#ffb800', borderColor: 'rgba(255,184,0,0.3)', '& .MuiChip-deleteIcon': { color: '#ffb800' } }} />
        )}
        {dateFilter && (
          <Chip size="small" label={`📅 ${dateFilter}`}
            onDelete={() => setDateFilter('')}
            sx={{ bgcolor: 'rgba(255,184,0,0.12)', color: '#ffb800', '& .MuiChip-deleteIcon': { color: '#ffb800' } }} />
        )}
        {candidateFilter !== 'all' && (
          <Chip size="small" label={getCandidateName(candidateFilter)}
            onDelete={() => setCandidateFilter('all')}
            sx={{ bgcolor: 'rgba(255,184,0,0.12)', color: '#ffb800', '& .MuiChip-deleteIcon': { color: '#ffb800' } }} />
        )}
        {roleFilter !== 'all' && (
          <Chip size="small" label={getRoleName(roleFilter)}
            onDelete={() => setRoleFilter('all')}
            sx={{ bgcolor: 'rgba(255,184,0,0.12)', color: '#ffb800', '& .MuiChip-deleteIcon': { color: '#ffb800' } }} />
        )}
        {locationFilter !== 'all' && (
          <Chip size="small" label={`📍 ${locationFilter}`}
            onDelete={() => setLocationFilter('all')}
            sx={{ bgcolor: 'rgba(255,184,0,0.12)', color: '#ffb800', '& .MuiChip-deleteIcon': { color: '#ffb800' } }} />
        )}

        {/* Clear all */}
        {hasActiveFilters && (
          <Chip size="small" label="Fjern alle"
            onClick={clearFilters}
            icon={<ClearIcon sx={{ fontSize: '13px !important' }} />}
            sx={{ bgcolor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.55)', '& .MuiChip-icon': { color: 'rgba(255,255,255,0.4)' }, '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' } }} />
        )}

        {/* Result count */}
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', ml: 0.5, whiteSpace: 'nowrap' }}>
          {filteredAndSortedSchedules.length !== schedules.length
            ? `Viser ${filteredAndSortedSchedules.length} av ${schedules.length}`
            : `${schedules.length} avtale${schedules.length !== 1 ? 'r' : ''}`}
        </Typography>
      </Box>

      {/* Empty State */}
      {schedules.length === 0 ? (
        <RoleRoomEmptyState
          iconSrc={cameraPng}
          title="Planlegg auditions og møter"
          subtitle={candidates.length === 0 || roles.length === 0
            ? 'Du trenger minst én rolle og én kandidat for å opprette avtaler.'
            : `Du har ${candidates.length} kandidat${candidates.length > 1 ? 'er' : ''} klare for planlegging.`}
          color="#ffb800"
          buttonLabel="Opprett avtale"
          onAction={onCreateSchedule}
          disabled={candidates.length === 0 || roles.length === 0}
        >
          {(candidates.length === 0 || roles.length === 0) && (
            <Button
              variant="outlined"
              size="large"
              onClick={() => onNavigateToTab(candidates.length === 0 ? 2 : 1)}
              sx={{
                mt: 2,
                borderColor: 'rgba(255,255,255,0.3)',
                color: '#fff',
                fontWeight: 600,
                px: 4,
                py: 1.5,
                minHeight: TOUCH_TARGET_SIZE,
                '&:hover': { borderColor: '#ffb800', bgcolor: 'rgba(255,184,0,0.1)' },
                ...focusVisibleStyles,
              }}
            >
              {candidates.length === 0 ? 'Legg til kandidater' : 'Opprett roller'}
            </Button>
          )}
        </RoleRoomEmptyState>
      ) : viewMode === 'table' ? (
        /* ── Table View (redesigned per UX spec) ── */
        <>
          <TableContainer component={Paper} sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 1.5, overflow: 'hidden' }}>
                <Table size="small" sx={{ tableLayout: 'fixed' }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'rgba(255,255,255,0.04)' }}>
                      {/* ☐ Select all */}
                      <TableCell padding="checkbox" sx={{ width: 44, borderColor: 'rgba(255,255,255,0.07)' }}>
                        <Checkbox
                          checked={selectedIds.size === filteredAndSortedSchedules.length && filteredAndSortedSchedules.length > 0}
                          indeterminate={selectedIds.size > 0 && selectedIds.size < filteredAndSortedSchedules.length}
                          onChange={handleSelectAll}
                          size="small"
                          sx={{ color: 'rgba(255,255,255,0.4)', '&.Mui-checked': { color: '#ffb800' }, '&.MuiCheckbox-indeterminate': { color: '#ffb800' } }}
                        />
                      </TableCell>
                      {/* ⭐ Favourite */}
                      <TableCell sx={{ width: 40, borderColor: 'rgba(255,255,255,0.07)', p: 0 }} />
                      {/* Date */}
                      <TableCell sx={{ width: 120, borderColor: 'rgba(255,255,255,0.07)' }}>
                        <TableSortLabel active={sortField === 'date'} direction={sortField === 'date' ? sortDirection : 'asc'} onClick={() => handleSort('date')}
                          sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', '&.Mui-active': { color: '#ffb800' }, '& .MuiTableSortLabel-icon': { color: '#ffb800 !important' } }}>
                          Dato
                        </TableSortLabel>
                      </TableCell>
                      {/* Timeslot */}
                      <TableCell sx={{ width: 100, borderColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Tid
                      </TableCell>
                      {/* Candidate */}
                      <TableCell sx={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                        <TableSortLabel active={sortField === 'candidate'} direction={sortField === 'candidate' ? sortDirection : 'asc'} onClick={() => handleSort('candidate')}
                          sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', '&.Mui-active': { color: '#ffb800' }, '& .MuiTableSortLabel-icon': { color: '#ffb800 !important' } }}>
                          Kandidat
                        </TableSortLabel>
                      </TableCell>
                      {/* Role */}
                      <TableCell sx={{ width: 150, borderColor: 'rgba(255,255,255,0.07)' }}>
                        <TableSortLabel active={sortField === 'role'} direction={sortField === 'role' ? sortDirection : 'asc'} onClick={() => handleSort('role')}
                          sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', '&.Mui-active': { color: '#ffb800' }, '& .MuiTableSortLabel-icon': { color: '#ffb800 !important' } }}>
                          Rolle
                        </TableSortLabel>
                      </TableCell>
                      {/* Status */}
                      <TableCell sx={{ width: 130, borderColor: 'rgba(255,255,255,0.07)' }}>
                        <TableSortLabel active={sortField === 'status'} direction={sortField === 'status' ? sortDirection : 'asc'} onClick={() => handleSort('status')}
                          sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', '&.Mui-active': { color: '#ffb800' }, '& .MuiTableSortLabel-icon': { color: '#ffb800 !important' } }}>
                          Status
                        </TableSortLabel>
                      </TableCell>
                      {/* Notes */}
                      <TableCell sx={{ borderColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Notater
                      </TableCell>
                      {/* ⋮ actions */}
                      <TableCell sx={{ width: 44, borderColor: 'rgba(255,255,255,0.07)', p: 0 }} />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredAndSortedSchedules.map((schedule, index) => {
                      const isFav = favorites.has(schedule.id);
                      const isSelected = selectedIds.has(schedule.id);
                      const statusColor = getStatusColor(schedule.status);
                      const dateFmt = (() => {
                        try {
                          return new Date(schedule.date).toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' });
                        } catch { return schedule.date; }
                      })();
                      const timeslot = schedule.time
                        ? (schedule.endTime ? `${schedule.time}–${schedule.endTime}` : schedule.time)
                        : '—';
                      const notesPreview = schedule.notes
                        ? schedule.notes.length > 60 ? schedule.notes.slice(0, 60) + '…' : schedule.notes
                        : null;
                      return (
                        <TableRow
                          key={schedule.id}
                          data-schedule-index={index}
                          hover
                          onClick={() => handleRowClick(schedule.id)}
                          sx={{
                            height: 56,
                            cursor: 'pointer',
                            bgcolor: isSelected ? 'rgba(255,184,0,0.07)' : 'transparent',
                            '&:hover': { bgcolor: isSelected ? 'rgba(255,184,0,0.11)' : 'rgba(255,255,255,0.03)' },
                            '&:focus-within': { outline: '2px solid rgba(255,184,0,0.4)', outlineOffset: -1 },
                            transition: 'background-color 0.15s',
                          }}
                        >
                          {/* Checkbox */}
                          <TableCell padding="checkbox" sx={{ borderColor: 'rgba(255,255,255,0.05)' }} onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              onChange={(e) => handleToggleSelect(schedule.id, index, (e.nativeEvent as MouseEvent).shiftKey)}
                              size="small"
                              sx={{ color: 'rgba(255,255,255,0.3)', '&.Mui-checked': { color: '#ffb800' } }}
                            />
                          </TableCell>
                          {/* ⭐ Favourite */}
                          <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)', p: 0.5 }} onClick={(e) => e.stopPropagation()}>
                            <IconButton
                              size="small"
                              onClick={() => toggleFavorite(schedule.id)}
                              aria-label={isFav ? 'Fjern favoritt' : 'Legg til favoritt'}
                              sx={{ color: isFav ? '#ffb800' : 'rgba(255,255,255,0.2)', p: 0.5, '&:hover': { color: '#ffb800' } }}
                            >
                              {isFav ? <StarIcon sx={{ fontSize: 16 }} /> : <StarBorderIcon sx={{ fontSize: 16 }} />}
                            </IconButton>
                          </TableCell>
                          {/* Date */}
                          <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 13, whiteSpace: 'nowrap' }}>
                            {dateFmt}
                          </TableCell>
                          {/* Timeslot */}
                          <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)', fontSize: 13, whiteSpace: 'nowrap' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <TimeIcon sx={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }} />
                              {timeslot}
                            </Box>
                          </TableCell>
                          {/* Candidate */}
                          <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Avatar sx={{ width: 24, height: 24, fontSize: 11, bgcolor: '#10b981', flexShrink: 0 }}>
                                {getCandidateName(schedule.candidateId).charAt(0).toUpperCase()}
                              </Avatar>
                              <Typography noWrap variant="body2" sx={{ color: '#fff', fontSize: 13 }}>
                                {getCandidateName(schedule.candidateId)}
                              </Typography>
                            </Box>
                          </TableCell>
                          {/* Role */}
                          <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                            <Chip
                              label={getRoleName(schedule.roleId)}
                              size="small"
                              sx={{ bgcolor: 'rgba(0,212,255,0.12)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.25)', fontSize: 11, height: 20, maxWidth: 130 }}
                            />
                          </TableCell>
                          {/* Status */}
                          <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                            <Chip
                              label={getStatusLabel(schedule.status)}
                              size="small"
                              sx={{ bgcolor: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}55`, fontSize: 11, height: 20, fontWeight: 500 }}
                            />
                          </TableCell>
                          {/* Notes preview */}
                          <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)', maxWidth: 0 }}>
                            {notesPreview ? (
                              <Typography variant="caption" noWrap sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, display: 'block' }}>
                                {notesPreview}
                              </Typography>
                            ) : (
                              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.15)', fontSize: 12 }}>—</Typography>
                            )}
                          </TableCell>
                          {/* ⋮ Row actions */}
                          <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)', p: 0.5 }} onClick={(e) => e.stopPropagation()}>
                            <IconButton
                              size="small"
                              onClick={(e) => { e.stopPropagation(); setRowMenuAnchor({ el: e.currentTarget, schedule }); }}
                              aria-label="Handlinger"
                              sx={{ color: 'rgba(255,255,255,0.3)', p: 0.5, '&:hover': { color: '#fff' } }}
                            >
                              <MoreVertIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
              {/* Row actions popover menu */}
              <Menu
                anchorEl={rowMenuAnchor?.el}
                open={Boolean(rowMenuAnchor)}
                onClose={() => setRowMenuAnchor(null)}
                PaperProps={{ sx: { bgcolor: '#1e1e2e', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', minWidth: 180 } }}
              >
                <MenuItem onClick={() => { if (rowMenuAnchor) { closeDrawer(); onEditSchedule(rowMenuAnchor.schedule); } setRowMenuAnchor(null); }} sx={{ gap: 1.5, fontSize: 14 }}>
                  <EditIcon sx={{ fontSize: 16, color: '#ffb800' }} /> Rediger
                </MenuItem>
                <MenuItem onClick={() => { if (rowMenuAnchor) handleDuplicate(rowMenuAnchor.schedule); setRowMenuAnchor(null); }} sx={{ gap: 1.5, fontSize: 14 }}>
                  <DuplicateIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.6)' }} /> Dupliser
                </MenuItem>
                <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
                <MenuItem onClick={() => { if (rowMenuAnchor) handleSaveToPool(rowMenuAnchor.schedule); setRowMenuAnchor(null); }} sx={{ gap: 1.5, fontSize: 14 }}>
                  <InventoryIcon sx={{ fontSize: 16, color: '#9c27b0' }} /> Lagre til pool
                </MenuItem>
                <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
                <MenuItem onClick={() => { if (rowMenuAnchor) handleDeleteWithUndo(rowMenuAnchor.schedule); setRowMenuAnchor(null); }} sx={{ gap: 1.5, fontSize: 14, color: '#ef4444' }}>
                  <DeleteIcon sx={{ fontSize: 16 }} /> Slett
                </MenuItem>
              </Menu>
            </>
      ) : viewMode === 'compact' ? (
        /* ── Compact List View ── */
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {filteredAndSortedSchedules.map((schedule, index) => {
            const isFav = favorites.has(schedule.id);
            const isSelected = selectedIds.has(schedule.id);
            const statusColor = getStatusColor(schedule.status);
            const dateFmt = (() => {
              try { return new Date(schedule.date).toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' }); }
              catch { return schedule.date; }
            })();
            const timeslot = schedule.time
              ? (schedule.endTime ? `${schedule.time}–${schedule.endTime}` : schedule.time)
              : null;
            return (
              <Box
                key={schedule.id}
                data-schedule-index={index}
                onClick={() => handleRowClick(schedule.id)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 1.5,
                  height: 40,
                  cursor: 'pointer',
                  bgcolor: isSelected ? 'rgba(255,184,0,0.07)' : 'transparent',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  '&:hover': { bgcolor: isSelected ? 'rgba(255,184,0,0.1)' : 'rgba(255,255,255,0.03)' },
                  transition: 'background-color 0.12s',
                }}
              >
                {/* Checkbox */}
                <Box onClick={(e) => e.stopPropagation()} sx={{ flexShrink: 0 }}>
                  <Checkbox
                    checked={isSelected}
                    onChange={(e) => handleToggleSelect(schedule.id, index, (e.nativeEvent as MouseEvent).shiftKey)}
                    size="small"
                    sx={{ p: 0.25, color: 'rgba(255,255,255,0.3)', '&.Mui-checked': { color: '#ffb800' } }}
                  />
                </Box>
                {/* ⭐ */}
                <Box onClick={(e) => e.stopPropagation()} sx={{ flexShrink: 0 }}>
                  <IconButton size="small" onClick={() => toggleFavorite(schedule.id)} sx={{ p: 0.25, color: isFav ? '#ffb800' : 'rgba(255,255,255,0.2)', '&:hover': { color: '#ffb800' } }}>
                    {isFav ? <StarIcon sx={{ fontSize: 14 }} /> : <StarBorderIcon sx={{ fontSize: 14 }} />}
                  </IconButton>
                </Box>
                {/* Date */}
                <Typography variant="caption" noWrap sx={{ color: '#fff', fontSize: 12, width: 110, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                  {dateFmt}{timeslot ? ` · ${timeslot}` : ''}
                </Typography>
                {/* Candidate */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1, minWidth: 0 }}>
                  <Avatar sx={{ width: 20, height: 20, fontSize: 10, bgcolor: '#10b981', flexShrink: 0 }}>
                    {getCandidateName(schedule.candidateId).charAt(0).toUpperCase()}
                  </Avatar>
                  <Typography noWrap variant="caption" sx={{ color: '#fff', fontSize: 12, flex: 1, minWidth: 0 }}>
                    {getCandidateName(schedule.candidateId)}
                  </Typography>
                </Box>
                {/* Role */}
                <Chip
                  label={getRoleName(schedule.roleId)}
                  size="small"
                  sx={{ bgcolor: 'rgba(0,212,255,0.1)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.2)', fontSize: 10, height: 18, maxWidth: 110, flexShrink: 0, display: { xs: 'none', md: 'flex' } }}
                />
                {/* Status dot */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                  <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: statusColor }} />
                  <Typography variant="caption" sx={{ color: statusColor, fontSize: 11, display: { xs: 'none', sm: 'block' } }}>
                    {getStatusLabel(schedule.status)}
                  </Typography>
                </Box>
                {/* ⋮ actions */}
                <Box onClick={(e) => e.stopPropagation()} sx={{ flexShrink: 0 }}>
                  <Tooltip title="Rediger">
                    <IconButton size="small" onClick={() => { closeDrawer(); onEditSchedule(schedule); }} sx={{ p: 0.25, color: 'rgba(255,255,255,0.3)', '&:hover': { color: '#ffb800' } }}>
                      <EditIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            );
          })}
        </Box>
      ) : (
        /* Grid View - Responsive for iPad and Desktop */
        <Grid container spacing={{ xs: 2, sm: 2.5, md: 3 }}>
          {filteredAndSortedSchedules.map((schedule, index) => {
            const isExpanded = expandedCards.has(schedule.id);
            const sceneName = getSceneName(schedule.sceneId);
            const statusColor = getStatusColor(schedule.status);
            const statusLabel = getStatusLabel(schedule.status);
            const candidateName = getCandidateName(schedule.candidateId);
            const roleName = getRoleName(schedule.roleId);

            return (
              <Grid key={schedule.id} size={{ xs: 12, sm: 6, md: 4, lg: 3, xl: 3 }}>
                <Card
                  component="article"
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    bgcolor: selectedIds.has(schedule.id) ? 'rgba(255,184,0,0.15)' : 'rgba(255,255,255,0.05)',
                    border: selectedIds.has(schedule.id) ? '2px solid #ffb800' : '1px solid rgba(255,255,255,0.1)',
                    borderLeft: `4px solid ${statusColor}`,
                    borderRadius: 2,
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    cursor: 'pointer',
                    '&:hover': {
                      bgcolor: 'rgba(255,255,255,0.08)',
                      transform: 'translateY(-4px)',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                    },
                  }}
                  onClick={() => handleRowClick(schedule.id)}
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleRowClick(schedule.id); }}
                >
                  {/* Date/Time Header */}
                  <Box
                    sx={{
                      width: '100%',
                      py: { xs: 1.5, sm: 2, md: 2.5 },
                      px: { xs: 1.5, sm: 2, md: 2.5 },
                      bgcolor: `${statusColor}15`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderTopRightRadius: 4,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, md: 2 } }}>
                      <Box
                        sx={{
                          width: { xs: 44, md: 52 },
                          height: { xs: 44, md: 52 },
                          borderRadius: 2,
                          bgcolor: `${statusColor}25`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <CalendarIcon sx={{ fontSize: { xs: 24, md: 28 }, color: statusColor }} />
                      </Box>
                      <Box>
                        <Typography
                          variant="subtitle1"
                          sx={{
                            color: '#fff',
                            fontWeight: 700,
                            lineHeight: 1.2,
                            fontSize: { xs: '0.95rem', sm: '1rem', md: '1.1rem' },
                          }}
                        >
                          {new Date(schedule.date).toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            color: 'rgba(255,255,255,0.87)',
                            fontWeight: 500,
                            fontSize: { xs: '0.8rem', md: '0.9rem' },
                          }}
                        >
                          kl. {schedule.time}
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Chip
                        label={statusLabel}
                        size="small"
                        sx={{
                          bgcolor: `${statusColor}20`,
                          color: statusColor,
                          fontWeight: 600,
                          fontSize: { xs: '10px', md: '11px' },
                          height: { xs: 22, md: 26 },
                          display: { xs: 'none', sm: 'flex' },
                        }}
                      />
                      <IconButton
                        size="small"
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(schedule.id); }}
                        sx={{
                          color: favorites.has(schedule.id) ? '#ffc107' : 'rgba(255,255,255,0.4)',
                          minWidth: { xs: TOUCH_TARGET_SIZE, md: 48 },
                          minHeight: { xs: TOUCH_TARGET_SIZE, md: 48 },
                        }}
                      >
                        {favorites.has(schedule.id) ? <StarIcon /> : <StarBorderIcon />}
                      </IconButton>
                    </Box>
                  </Box>

                  <CardContent sx={{ p: { xs: 1.5, sm: 2, md: 2.5 }, flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {/* Card Header */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: { xs: 1.5, md: 2 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, md: 1.5 } }}>
                        <Checkbox
                          checked={selectedIds.has(schedule.id)}
                          onChange={(e) => handleToggleSelect(schedule.id, index, (e.nativeEvent as MouseEvent).shiftKey)}
                          onClick={(e) => e.stopPropagation()}
                          sx={{
                            p: 0.5,
                            color: 'rgba(255,255,255,0.6)',
                            '&.Mui-checked': { color: '#ffb800' },
                            '& .MuiSvgIcon-root': { fontSize: { xs: 20, md: 24 } },
                          }}
                        />
                        <Box>
                          <Typography
                            variant="subtitle1"
                            component="h3"
                            sx={{
                              color: '#fff',
                              fontWeight: 600,
                              fontSize: { xs: '0.95rem', sm: '1rem', md: '1.1rem' },
                              lineHeight: 1.3,
                            }}
                          >
                            {candidateName}
                          </Typography>
                          {/* Status chip only on mobile (shown in header on tablet+) */}
                          <Chip
                            label={statusLabel}
                            size="small"
                            sx={{
                              bgcolor: `${statusColor}20`,
                              color: statusColor,
                              fontWeight: 600,
                              fontSize: { xs: '10px', md: '11px' },
                              height: { xs: 20, md: 24 },
                              display: { xs: 'flex', sm: 'none' },
                              mt: 0.5,
                            }}
                          />
                        </Box>
                      </Box>
                    </Box>

                    {/* Info Grid - Responsive layout */}
                    <Box sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                      gap: { xs: 1.5, md: 2 },
                      flex: 1,
                    }}>
                      {/* Role */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, md: 2 } }}>
                        <Box
                          sx={{
                            width: { xs: 32, md: 36 },
                            height: { xs: 32, md: 36 },
                            borderRadius: 1.5,
                            bgcolor: 'rgba(244,143,177,0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <TheaterComedyIcon sx={{ fontSize: { xs: 16, md: 20 }, color: '#f48fb1' }} />
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography
                            variant="caption"
                            sx={{
                              color: 'rgba(255,255,255,0.87)',
                              display: 'block',
                              lineHeight: 1,
                              fontSize: { xs: '0.65rem', md: '0.7rem' },
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                            }}
                          >
                            Rolle
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              color: '#fff',
                              fontWeight: 500,
                              fontSize: { xs: '0.85rem', md: '0.9rem' },
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {roleName}
                          </Typography>
                        </Box>
                      </Box>

                      {/* Location */}
                      {schedule.location && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, md: 2 } }}>
                          <Box
                            sx={{
                              width: { xs: 32, md: 36 },
                              height: { xs: 32, md: 36 },
                              borderRadius: 1.5,
                              bgcolor: 'rgba(16,185,129,0.15)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <LocationIcon sx={{ fontSize: { xs: 16, md: 20 }, color: '#10b981' }} />
                          </Box>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography
                              variant="caption"
                              sx={{
                                color: 'rgba(255,255,255,0.87)',
                                display: 'block',
                                lineHeight: 1,
                                fontSize: { xs: '0.65rem', md: '0.7rem' },
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                              }}
                            >
                              Lokasjon
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{
                                color: '#fff',
                                fontWeight: 500,
                                fontSize: { xs: '0.85rem', md: '0.9rem' },
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {schedule.location}
                            </Typography>
                          </Box>
                        </Box>
                      )}
                    </Box>

                    {/* Tags */}
                    {sceneName && (
                      <Box sx={{ mt: { xs: 1.5, md: 2 }, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Chip
                          icon={<MovieIcon sx={{ fontSize: { xs: 14, md: 16 } }} />}
                          label={sceneName}
                          size="small"
                          sx={{
                            bgcolor: 'rgba(139,92,246,0.15)',
                            color: '#8b5cf6',
                            height: { xs: 24, md: 28 },
                            fontSize: { xs: '0.7rem', md: '0.75rem' },
                          }}
                        />
                      </Box>
                    )}

                    {/* Expandable notes - matching ProductionDayView style with animated icon */}
                    {schedule.notes && (
                      <Box sx={{ mt: { xs: 1.5, md: 2 } }}>
                        <Button
                          size="small"
                          onClick={(e) => { e.stopPropagation(); toggleCardExpanded(schedule.id); }}
                          endIcon={isExpanded ? <CollapseIcon /> : <ExpandIcon />}
                          sx={{
                            color: '#ffb800',
                            p: 0,
                            minHeight: { xs: TOUCH_TARGET_SIZE, md: 48 },
                            fontSize: { xs: '0.75rem', md: '0.8rem' },
                            '&:hover': { color: '#ffc933', bgcolor: 'rgba(255,184,0,0.1)' },
                            '@keyframes writing': {
                              '0%, 100%': { transform: 'rotate(-5deg) translateY(0px)' },
                              '25%': { transform: 'rotate(0deg) translateY(-1px)' },
                              '50%': { transform: 'rotate(5deg) translateY(0px)' },
                              '75%': { transform: 'rotate(0deg) translateY(1px)' },
                            },
                            '& .animated-note-icon': {
                              animation: 'writing 2.5s ease-in-out infinite',
                            },
                          }}
                        >
                          <NoteIcon className="animated-note-icon" sx={{ fontSize: { xs: 16, md: 18 }, mr: 0.5 }} />
                          {isExpanded ? 'Skjul notater' : 'Vis notater'}
                        </Button>
                        <Collapse in={isExpanded}>
                          <Box
                            sx={{
                              mt: 1,
                              p: { xs: 2, md: 2.5 },
                              borderRadius: 2,
                              bgcolor: 'rgba(255,184,0,0.08)',
                              border: '2px solid rgba(255,184,0,0.3)',
                              boxShadow: '0 4px 16px rgba(255,184,0,0.1)',
                              position: 'relative',
                              overflow: 'hidden',
                              '&::before': {
                                content: '""',
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '5px',
                                height: '100%',
                                bgcolor: '#ffb800',
                                borderRadius: '2px 0 0 2px',
                              },
                            }}
                          >
                            {/* Animated header with icon */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5, pl: 1 }}>
                              <Box
                                sx={{
                                  width: { xs: 36, md: 40 },
                                  height: { xs: 36, md: 40 },
                                  borderRadius: 2,
                                  bgcolor: 'rgba(255,184,0,0.2)',
                                  border: '2px solid rgba(255,184,0,0.4)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  '@keyframes writing': {
                                    '0%, 100%': { transform: 'rotate(-5deg) translateY(0px)' },
                                    '25%': { transform: 'rotate(0deg) translateY(-2px)' },
                                    '50%': { transform: 'rotate(5deg) translateY(0px)' },
                                    '75%': { transform: 'rotate(0deg) translateY(2px)' },
                                  },
                                }}
                              >
                                <NoteIcon
                                  sx={{
                                    fontSize: { xs: 20, md: 24 },
                                    color: '#ffb800',
                                    animation: 'writing 2.5s ease-in-out infinite',
                                    filter: 'drop-shadow(0 2px 4px rgba(255,184,0,0.3))',
                                  }}
                                />
                              </Box>
                              <Typography
                                sx={{
                                  color: '#ffb800',
                                  fontWeight: 700,
                                  fontSize: { xs: '0.875rem', md: '1rem' },
                                }}
                              >
                                Notater
                              </Typography>
                            </Box>
                            <Box
                              sx={{
                                pl: 1,
                                bgcolor: 'rgba(0,0,0,0.2)',
                                p: 1.5,
                                borderRadius: 1.5,
                                border: '1px solid rgba(255,255,255,0.1)',
                              }}
                            >
                              {renderFormattedNotes(schedule.notes)}
                            </Box>
                          </Box>
                        </Collapse>
                      </Box>
                    )}

                    {/* Card Actions */}
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        pt: { xs: 1.5, md: 2 },
                        mt: 'auto',
                        borderTop: '1px solid rgba(255,255,255,0.1)',
                      }}
                    >
                      <Box sx={{ display: 'flex', gap: { xs: 0.5, md: 1 } }}>
                        <Tooltip title="Rediger">
                          <IconButton
                            size="small"
                            onClick={(e) => { e.stopPropagation(); onEditSchedule(schedule); }}
                            sx={{
                              minWidth: { xs: TOUCH_TARGET_SIZE, md: 48 },
                              minHeight: { xs: TOUCH_TARGET_SIZE, md: 48 },
                              color: '#ffb800',
                              ...focusVisibleStyles,
                            }}
                          >
                            <EditIcon sx={{ fontSize: { xs: 18, md: 22 } }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Dupliser">
                          <IconButton
                            size="small"
                            onClick={(e) => { e.stopPropagation(); handleDuplicate(schedule); }}
                            sx={{
                              minWidth: { xs: TOUCH_TARGET_SIZE, md: 48 },
                              minHeight: { xs: TOUCH_TARGET_SIZE, md: 48 },
                              color: 'rgba(255,255,255,0.87)',
                              '&:hover': { color: '#00d4ff' },
                              ...focusVisibleStyles,
                            }}
                          >
                            <DuplicateIcon sx={{ fontSize: { xs: 18, md: 22 } }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Lagre som mal">
                          <IconButton
                            size="small"
                            onClick={(e) => { e.stopPropagation(); handleSaveToPool(schedule); }}
                            sx={{
                              minWidth: { xs: TOUCH_TARGET_SIZE, md: 48 },
                              minHeight: { xs: TOUCH_TARGET_SIZE, md: 48 },
                              color: 'rgba(255,255,255,0.87)',
                              '&:hover': { color: '#9c27b0' },
                              ...focusVisibleStyles,
                            }}
                          >
                            <InventoryIcon sx={{ fontSize: { xs: 18, md: 22 } }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Slett">
                          <IconButton
                            size="small"
                            onClick={(e) => { e.stopPropagation(); handleDeleteWithUndo(schedule); }}
                            sx={{
                              minWidth: { xs: TOUCH_TARGET_SIZE, md: 48 },
                              minHeight: { xs: TOUCH_TARGET_SIZE, md: 48 },
                              color: 'rgba(255,255,255,0.87)',
                              '&:hover': { color: '#ef4444' },
                              ...focusVisibleStyles,
                            }}
                          >
                            <DeleteIcon sx={{ fontSize: { xs: 18, md: 22 } }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                      <Button
                        size="small"
                        onClick={(e) => { e.stopPropagation(); onEditSchedule(schedule); }}
                        sx={{
                          color: '#ffb800',
                          fontSize: { xs: '0.75rem', md: '0.85rem' },
                          fontWeight: 600,
                          minHeight: { xs: TOUCH_TARGET_SIZE, md: 48 },
                          px: { xs: 1, md: 2 },
                          '&:hover': { bgcolor: 'rgba(255,184,0,0.1)' },
                          ...focusVisibleStyles,
                        }}
                      >
                        Åpne detaljer
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
      </>
      )}

      {/* Templates View - shows saved audition templates when in templates mode */}
      {poolMode === 'pool' && (
        <Box>
          {/* Guide Box */}
          <Box
            sx={{
              mb: 3,
              p: 2,
              bgcolor: 'rgba(156, 39, 176, 0.08)',
              borderRadius: 2,
              border: '1px solid rgba(156, 39, 176, 0.2)',
            }}
          >
            <Typography variant="subtitle1" sx={{ color: '#9c27b0', fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <InventoryIcon sx={{ fontSize: 20 }} />
              Slik bruker du audition-maler
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mb: 1 }}>
              Maler lar deg lagre audition-oppsett for gjenbruk i fremtidige produksjoner.
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.5, color: 'rgba(255,255,255,0.87)', '& li': { mb: 0.5, fontSize: '0.875rem' } }}>
              <li><strong>Lagre som mal:</strong> Klikk på lilla ikon på en prosjekt-audition</li>
              <li><strong>Importer:</strong> Klikk "Importer" for å kopiere malen til prosjektet</li>
              <li><strong>Slett:</strong> Fjern maler du ikke trenger lenger</li>
            </Box>
          </Box>

          {poolLoading ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.87)' }}>Laster maler...</Typography>
            </Box>
          ) : poolAuditions.length === 0 ? (
            <Box
              role="status"
              sx={{
                textAlign: 'center',
                py: { xs: 4, sm: 8 },
                px: 4,
                bgcolor: 'rgba(156, 39, 176, 0.03)',
                borderRadius: 3,
                border: '2px dashed rgba(156, 39, 176, 0.2)',
              }}
            >
              <Box
                sx={{
                  width: { xs: 60, sm: 80 },
                  height: { xs: 60, sm: 80 },
                  borderRadius: '50%',
                  bgcolor: 'rgba(156, 39, 176, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto',
                  mb: { xs: 2, sm: 3 },
                }}
              >
                <InventoryIcon sx={{ fontSize: { xs: 30, sm: 40 }, color: '#9c27b0' }} />
              </Box>
              <Typography variant="h5" sx={{ color: '#fff', fontWeight: 600, mb: 1 }}>
                Ingen audition-maler ennå
              </Typography>
              <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.87)', mb: 3, maxWidth: 400, mx: 'auto' }}>
                Lagre audition-oppsett som maler for gjenbruk i fremtidige produksjoner.
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={{ xs: 1, sm: 2 }}>
              {poolAuditions.map((poolAudition) => (
                <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={poolAudition.id}>
                  <Card
                    sx={{
                      bgcolor: 'rgba(156, 39, 176, 0.08)',
                      border: '1px solid rgba(156, 39, 176, 0.3)',
                      borderRadius: 2,
                      transition: 'all 0.2s',
                      '&:hover': {
                        borderColor: '#9c27b0',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 4px 12px rgba(156, 39, 176, 0.2)',
                      },
                    }}
                  >
                    <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600, fontSize: { xs: '1rem', sm: '1.1rem' } }}>
                          {poolAudition.title}
                        </Typography>
                        <Chip
                          icon={<InventoryIcon sx={{ fontSize: 14 }} />}
                          label="Mal"
                          size="small"
                          sx={{
                            bgcolor: 'rgba(156, 39, 176, 0.2)',
                            color: '#ce93d8',
                            fontSize: '0.7rem',
                            height: 24,
                          }}
                        />
                      </Box>
                      {poolAudition.description && (
                        <Typography
                          variant="body2"
                          sx={{
                            color: 'rgba(255,255,255,0.87)',
                            mb: 1.5,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {poolAudition.description}
                        </Typography>
                      )}
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                        {poolAudition.durationMinutes && (
                          <Chip
                            icon={<ScheduleIcon sx={{ fontSize: 14 }} />}
                            label={`${poolAudition.durationMinutes} min`}
                            size="small"
                            sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.87)', fontSize: '0.7rem' }}
                          />
                        )}
                        {poolAudition.location && (
                          <Chip
                            icon={<LocationIcon sx={{ fontSize: 14 }} />}
                            label={poolAudition.location}
                            size="small"
                            sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.87)', fontSize: '0.7rem' }}
                          />
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<ExportIcon />}
                          onClick={() => handleImportFromPool(poolAudition)}
                          sx={{
                            bgcolor: '#9c27b0',
                            color: '#fff',
                            flex: 1,
                            minHeight: TOUCH_TARGET_SIZE,
                            '&:hover': { bgcolor: '#7b1fa2' },
                          }}
                        >
                          Importer
                        </Button>
                        <Tooltip title="Slett fra pool">
                          <IconButton
                            onClick={() => handleDeleteFromPool(poolAudition.id)}
                            sx={{
                              minWidth: TOUCH_TARGET_SIZE,
                              minHeight: TOUCH_TARGET_SIZE,
                              color: '#ff4444',
                              '&:hover': { bgcolor: 'rgba(255,68,68,0.1)' },
                            }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}

      {/* Undo Snackbar */}
      <Snackbar
        open={undoSnackbarOpen}
        autoHideDuration={6000}
        onClose={() => setUndoSnackbarOpen(false)}
        message="Avtale slettet"
        action={
          <Button color="secondary" size="small" onClick={handleUndoDelete} sx={{ color: '#ffb800' }}>
            Angre
          </Button>
        }
        sx={{ '& .MuiSnackbarContent-root': { bgcolor: '#333' } }}
      />

      {/* ── Bulk Action Bar (sticky bottom, slides up when items selected) ── */}
      <Slide direction="up" in={selectedIds.size > 0} mountOnEnter unmountOnExit>
        <Box
          sx={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1400,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 2,
            py: 1,
            borderRadius: 2,
            bgcolor: '#1e1e2e',
            border: '1px solid rgba(255,255,255,0.15)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            minWidth: 360,
            flexWrap: 'wrap',
          }}
        >
          <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600, mr: 0.5, whiteSpace: 'nowrap' }}>
            {selectedIds.size} valgt
          </Typography>
          <Box sx={{ width: '1px', height: 20, bgcolor: 'rgba(255,255,255,0.15)', mx: 0.5 }} />
          {/* Delete */}
          <Tooltip title="Slett valgte (Del)">
            <Button
              size="small"
              variant="outlined"
              startIcon={<DeleteIcon sx={{ fontSize: 16 }} />}
              onClick={handleBulkDelete}
              sx={{ borderColor: '#ef4444', color: '#ef4444', fontSize: 12, py: 0.5, '&:hover': { bgcolor: 'rgba(239,68,68,0.1)' } }}
            >
              Slett
            </Button>
          </Tooltip>
          {/* Duplicate */}
          <Tooltip title="Dupliser valgte">
            <Button
              size="small"
              variant="outlined"
              startIcon={<DuplicateIcon sx={{ fontSize: 16 }} />}
              onClick={() => {
                const todup = filteredAndSortedSchedules.filter(s => selectedIds.has(s.id));
                todup.forEach(s => handleDuplicate(s));
              }}
              sx={{ borderColor: 'rgba(255,255,255,0.25)', color: 'rgba(255,255,255,0.8)', fontSize: 12, py: 0.5, '&:hover': { bgcolor: 'rgba(255,255,255,0.07)' } }}
            >
              Dupliser
            </Button>
          </Tooltip>
          {/* Export */}
          <Tooltip title="Eksporter valgte">
            <Button
              size="small"
              variant="outlined"
              startIcon={<ExportIcon sx={{ fontSize: 16 }} />}
              onClick={handleExportCSV}
              sx={{ borderColor: 'rgba(255,255,255,0.25)', color: 'rgba(255,255,255,0.8)', fontSize: 12, py: 0.5, '&:hover': { bgcolor: 'rgba(255,255,255,0.07)' } }}
            >
              Eksporter
            </Button>
          </Tooltip>
          {/* Change Status */}
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <Select
              displayEmpty
              value=""
              onChange={(e) => { if (e.target.value) handleBulkStatusChange(e.target.value as Schedule['status']); }}
              startAdornment={<BulkStatusIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', mr: 0.5 }} />}
              renderValue={() => <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>Endre status</Typography>}
              sx={{
                color: '#fff',
                fontSize: 12,
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.25)' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#ffb800' },
                '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.5)' },
              }}
            >
              {(['scheduled', 'confirmed', 'awaiting_callback', 'completed', 'cancelled'] as const).map(s => (
                <MenuItem key={s} value={s}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: getStatusColor(s), flexShrink: 0 }} />
                    {getStatusLabel(s)}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {/* Dismiss (Esc) */}
          <Tooltip title="Avbryt (Esc)">
            <IconButton size="small" onClick={() => dispatch({ type: 'DESELECT_ALL' })} sx={{ ml: 'auto', color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#fff' } }}>
              <ClearIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Slide>

      {/* ── Details Drawer ── */}
      <ScheduleDetailsDrawer
        open={drawerScheduleId !== null}
        schedule={drawerScheduleId ? (filteredAndSortedSchedules.find(s => s.id === drawerScheduleId) ?? null) : null}
        isFavorite={drawerScheduleId ? favorites.has(drawerScheduleId) : false}
        onClose={closeDrawer}
        onEdit={(s) => { closeDrawer(); onEditSchedule(s); }}
        onDuplicate={handleDuplicate}
        onDelete={(s) => { closeDrawer(); handleDeleteWithUndo(s); }}
        onToggleFavorite={toggleFavorite}
        onStatusChange={handleStatusChange}
        getCandidateName={getCandidateName}
        getRoleName={getRoleName}
      />

      {/* Audition Planner guide */}
      <AuditionGuide
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        onAction={(action) => {
          setGuideOpen(false);
          switch (action) {
            default: console.log('[Guide CTA]', action);
          }
        }}
      />

    </Box>
  );
}

export const AuditionSchedulePanel = memo(AuditionSchedulePanelInner);
