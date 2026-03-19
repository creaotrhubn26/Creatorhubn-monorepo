import React, { useState, useId, useMemo, useEffect, memo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Typography, Button, IconButton, Card, CardContent, Chip, TextField, Select, MenuItem, FormControl, Dialog, DialogTitle, DialogContent, DialogActions, Divider, LinearProgress, Tabs, Tab, Avatar, Tooltip, Checkbox, Collapse, Alert, Snackbar, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TableSortLabel, Paper, Stack, useTheme, useMediaQuery } from "@mui/material";
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Search as SearchIcon, Star as StarIcon, StarBorder as StarBorderIcon, ExpandMore as ExpandIcon, ExpandLess as CollapseIcon, GridView as GridViewIcon, ViewList as TableViewIcon, FileDownload as ExportIcon, ContentCopy as DuplicateIcon, People as PeopleIcon, Movie as MovieIcon, Person as PersonIcon, Assignment as AssignmentIcon, Inventory as InventoryIcon, WarningAmber as WarningIcon, AutoAwesome as AutoAwesomeIcon, KeyboardCommandKey as CommandIcon, RestartAlt as UndoStatusIcon, Redo as RedoStatusIcon, Checklist as ChecklistIcon, CompareArrows as CompareArrowsIcon, Schedule as ScheduleIcon, Tune as TuneIcon } from "@mui/icons-material";
import settingsService from "../services/settingsService";
import { RolesIcon as TheaterComedyIcon, StatsIcon } from "./icons/CastingIcons";
import type { Role } from "../models/casting";
import { castingService } from "../services/castingService";
import { useToast } from "./ToastStack";
import { useBrandingSettings } from "../hooks/useBrandingSettings";
import { rolePoolService, type PoolRole } from "../services/rolePoolService";
import { RoleRoomEmptyState } from "./icons/RoleRoomEmptyState";
import castingDirectorPng from "./icons/Keep/roleroom_casting_director.png";
import { ROLE_WORKFLOW_ORDER, getRoleWorkflowMeta, type RoleWorkflowStatus } from "../config/roleWorkflow";
import { emitRoleSyncEvent, onRoleSyncEvent } from "../services/roleSyncEvents";
import { roleQueryKeys } from "../services/roleQueryKeys";

// WCAG 2.2 - 2.5.5 Target Size: minimum 44x44px
const TOUCH_TARGET_SIZE = 44;

// WCAG 2.2 - 2.4.7 Focus Visible: clear focus indicator
const focusVisibleStyles = {
  '&:focus-visible': {
    outline: '3px solid #b86bff',
    outlineOffset: 2,
  },
};

const PRO_VIEW_SETTINGS_NAMESPACE = 'virtualStudio_roleProView';

type SortField = 'name' | 'status' | 'candidates' | 'scenes';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'grid' | 'table';
type StatusFilter = 'all' | RoleWorkflowStatus;
type WorkspaceView = 'standard' | 'pro';
type ProSortField = 'risk' | 'name' | 'status' | 'candidates' | 'scenes' | 'updatedAt' | 'deadline';
type ProListMode = 'cards' | 'table';
type ProPreset = 'casting_focus' | 'critical_roles' | 'this_week' | 'all_roles';
type ProDetailTab = 'oversikt' | 'pipeline' | 'sammenlign' | 'historikk' | 'handlinger';

type RiskLevel = 'lav' | 'medium' | 'hoy';

interface RoleRiskProfile {
  score: number;
  level: RiskLevel;
  deadlineDays: number | null;
  staleDays: number;
  flags: string[];
}

interface RoleTransitionRecord {
  roleId: string;
  from: RoleWorkflowStatus;
  to: RoleWorkflowStatus;
  timestamp: number;
}

interface RoleManagementPanelProps {
  projectId: string;
  roles: Role[];
  onRolesChange: () => void;
  onEditRole: (role: Role) => void;
  onCreateRole: () => void;
  profession?: 'photographer' | 'videographer' | null;
}

function RoleManagementPanelInner({
  projectId,
  roles,
  onRolesChange,
  onEditRole,
  onCreateRole,
  profession,
}: RoleManagementPanelProps) {
  const queryClient = useQueryClient();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const containerPadding = { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 3 };

  // Toast notifications
  const { showSuccess, showError, showInfo } = useToast();
  const branding = useBrandingSettings();
  const roleTabAccent = '#b86bff';
  const roleTabAccentHover = '#a855f7';
  const roleTabAccentSoft = 'rgba(184,107,255,0.18)';
  const roleSurface = 'rgba(20,14,48,0.84)';
  const roleSurfaceMuted = 'rgba(33,24,70,0.72)';
  const roleBorder = 'rgba(184,107,255,0.32)';
  const roleText = '#f3eaff';
  const roleTextMuted = 'rgba(220,205,255,0.82)';
  const rolePanelBackdrop = "url('/role-room-assets/role_panel_backdrop.webp')";
  const roleContextLabel = profession === 'photographer'
    ? 'Administrer roller og krav for foto-casting'
    : profession === 'videographer'
      ? 'Administrer roller og krav for video-casting'
      : 'Administrer roller og krav for casting';

  // Unique IDs for accessibility
  const panelTitleId = useId();
  const dialogTitleId = useId();
  const dialogDescId = useId();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [viewMode, setViewMode] = useState<ViewMode>(() => (isDesktop ? 'table' : 'grid'));
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('standard');
  const [showStats, setShowStats] = useState(true);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [confirmDeletePoolRole, setConfirmDeletePoolRole] = useState<PoolRole | null>(null);
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [undoSnackbarOpen, setUndoSnackbarOpen] = useState(false);
  const [deletedRole, setDeletedRole] = useState<Role | null>(null);
  const [poolSearchQuery, setPoolSearchQuery] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [proSortField, setProSortField] = useState<ProSortField>('risk');
  const [proSortDirection, setProSortDirection] = useState<SortDirection>('desc');
  const [proListMode, setProListMode] = useState<ProListMode>('cards');
  const [proPreset, setProPreset] = useState<ProPreset>('casting_focus');
  const [proDetailTab, setProDetailTab] = useState<ProDetailTab>('oversikt');
  const [proPipelineFilter, setProPipelineFilter] = useState<RoleWorkflowStatus | 'all'>('all');
  const [proOnlyUrgent, setProOnlyUrgent] = useState(false);
  const [proCompareMode, setProCompareMode] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [transitionUndoStack, setTransitionUndoStack] = useState<RoleTransitionRecord[]>([]);
  const [transitionRedoStack, setTransitionRedoStack] = useState<RoleTransitionRecord[]>([]);
  const [sessionTimeline, setSessionTimeline] = useState<Record<string, Array<{ id: string; label: string; description: string; date: number }>>>({});
  const [proSettingsLoaded, setProSettingsLoaded] = useState(false);
  
  // Pool mode state
  const [poolMode, setPoolMode] = useState<'project' | 'pool'>('project');
  const {
    data: poolRoles = [],
    isLoading: poolLoading,
    isError: isPoolError,
  } = useQuery({
    queryKey: roleQueryKeys.pool,
    queryFn: rolePoolService.getPoolRoles,
    enabled: poolMode === 'pool' || workspaceView === 'pro',
  });

  useEffect(() => {
    if ((poolMode === 'pool' || workspaceView === 'pro') && isPoolError) {
      showError('Kunne ikke laste rollepool');
    }
  }, [isPoolError, poolMode, showError, workspaceView]);

  // Event-driven sync between role pool and project roles
  useEffect(() => {
    return onRoleSyncEvent((event) => {
      if (event.type === 'pool-updated') {
        void queryClient.invalidateQueries({ queryKey: roleQueryKeys.pool });
        return;
      }
      if (
        (event.type === 'project-roles-updated' || event.type === 'pool-imported-to-project') &&
        event.projectId === projectId
      ) {
        onRolesChange();
        void queryClient.invalidateQueries({
          queryKey: roleQueryKeys.projectRoles(projectId),
        });
      }
    });
  }, [onRolesChange, projectId, queryClient]);

  const handleSaveToPool = async (role: Role) => {
    try {
      const poolId = await rolePoolService.saveRoleToPool(role.id);
      if (poolId) {
        showSuccess(`"${role.name}" lagret til rollepool`);
        emitRoleSyncEvent({ type: 'pool-updated', source: 'role-management' });
        await queryClient.invalidateQueries({ queryKey: roleQueryKeys.pool });
      } else {
        showError('Kunne ikke lagre rolle til pool');
      }
    } catch (error) {
      console.error('Error saving role to pool:', error);
      showError('Feil ved lagring til pool');
    }
  };

  const handleImportFromPool = async (poolRole: PoolRole) => {
    if (!projectId) {
      showError('Ingen prosjekt valgt');
      return;
    }
    try {
      const newRoleId = await rolePoolService.importToProject(poolRole.id, projectId);
      if (newRoleId) {
        showSuccess(`"${poolRole.name}" importert til prosjektet`);
        onRolesChange();
        emitRoleSyncEvent({
          type: 'pool-imported-to-project',
          source: 'role-management',
          projectId,
        });
        await queryClient.invalidateQueries({
          queryKey: roleQueryKeys.projectRoles(projectId),
        });
        await queryClient.invalidateQueries({ queryKey: roleQueryKeys.pool });
        setPoolMode('project');
      } else {
        showError('Kunne ikke importere rolle');
      }
    } catch (error) {
      console.error('Error importing role from pool:', error);
      showError('Feil ved import fra pool');
    }
  };

  const handleDeleteFromPool = (poolRole: PoolRole) => {
    setConfirmDeletePoolRole(poolRole);
  };

  const executeDeleteFromPool = async () => {
    if (!confirmDeletePoolRole) return;
    const poolRole = confirmDeletePoolRole;
    setConfirmDeletePoolRole(null);
    try {
      const success = await rolePoolService.deleteFromPool(poolRole.id);
      if (success) {
        await queryClient.invalidateQueries({ queryKey: roleQueryKeys.pool });
        showSuccess('Rolle fjernet fra pool');
        emitRoleSyncEvent({ type: 'pool-updated', source: 'role-management' });
      } else {
        showError('Kunne ikke fjerne rolle fra pool');
      }
    } catch (error) {
      console.error('Error deleting from pool:', error);
      showError('Feil ved sletting fra pool');
    }
  };

  const FAVORITES_NAMESPACE = 'virtualStudio_roleFavorites';
  const proViewSettingsKey = `${PRO_VIEW_SETTINGS_NAMESPACE}:${projectId}`;

  // Load favorites from database (with settings cache fallback)
  useEffect(() => {
    const loadFavorites = async () => {
      if (!projectId) {
        setFavorites(new Set());
        setFavoritesLoaded(true);
        return;
      }
      try {
        const { favoritesApi } = await import('@/services/castingApiService');
        const dbFavorites = await favoritesApi.get(projectId, 'role');
        if (dbFavorites.length > 0) {
          setFavorites(new Set(dbFavorites));
          await settingsService.setSetting(FAVORITES_NAMESPACE, dbFavorites, { projectId });
          setFavoritesLoaded(true);
          return;
        }
      } catch (error) {
        console.warn('Database unavailable, using settings cache:', error);
      }
      const cached = await settingsService.getSetting<string[]>(FAVORITES_NAMESPACE, { projectId });
      if (cached && cached.length > 0) {
        setFavorites(new Set(cached));
        setFavoritesLoaded(true);
        return;
      }
      setFavoritesLoaded(true);
    };
    loadFavorites();
  }, [projectId]);

  // Save favorites to database and settings cache
  useEffect(() => {
    const saveFavorites = async () => {
      if (!projectId) return;
      const values = [...favorites];
      await settingsService.setSetting(FAVORITES_NAMESPACE, values, { projectId });
      try {
        const { favoritesApi } = await import('@/services/castingApiService');
        await favoritesApi.set(projectId, 'role', values);
      } catch (error) {
        console.warn('Database save failed:', error);
      }
    };
    if (!favoritesLoaded) return;
    saveFavorites();
  }, [favorites, projectId, favoritesLoaded]);

  useEffect(() => {
    if (!projectId) {
      setProSettingsLoaded(true);
      return;
    }
    try {
      const raw = localStorage.getItem(proViewSettingsKey);
      if (!raw) {
        setProSettingsLoaded(true);
        return;
      }
      const parsed = JSON.parse(raw) as Partial<{
        sortField: ProSortField;
        sortDirection: SortDirection;
        listMode: ProListMode;
        preset: ProPreset;
        pipelineFilter: RoleWorkflowStatus | 'all';
        onlyUrgent: boolean;
        detailTab: ProDetailTab;
      }>;
      if (parsed.sortField) setProSortField(parsed.sortField);
      if (parsed.sortDirection) setProSortDirection(parsed.sortDirection);
      if (parsed.listMode) setProListMode(parsed.listMode);
      if (parsed.preset) setProPreset(parsed.preset);
      if (parsed.pipelineFilter) setProPipelineFilter(parsed.pipelineFilter);
      if (typeof parsed.onlyUrgent === 'boolean') setProOnlyUrgent(parsed.onlyUrgent);
      if (parsed.detailTab) setProDetailTab(parsed.detailTab);
    } catch (error) {
      console.warn('Kunne ikke laste pro-visningsinnstillinger:', error);
    } finally {
      setProSettingsLoaded(true);
    }
  }, [projectId, proViewSettingsKey]);

  useEffect(() => {
    if (!projectId || !proSettingsLoaded) return;
    try {
      localStorage.setItem(
        proViewSettingsKey,
        JSON.stringify({
          sortField: proSortField,
          sortDirection: proSortDirection,
          listMode: proListMode,
          preset: proPreset,
          pipelineFilter: proPipelineFilter,
          onlyUrgent: proOnlyUrgent,
          detailTab: proDetailTab,
        }),
      );
    } catch (error) {
      console.warn('Kunne ikke lagre pro-visningsinnstillinger:', error);
    }
  }, [
    projectId,
    proDetailTab,
    proListMode,
    proOnlyUrgent,
    proPipelineFilter,
    proPreset,
    proSettingsLoaded,
    proSortDirection,
    proSortField,
    proViewSettingsKey,
  ]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'n') {
          e.preventDefault();
          onCreateRole();
        } else if (e.key === 'e') {
          e.preventDefault();
          handleExportCSV();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCreateRole]);

  // Helper functions
  const getStatusColor = (status: Role['status']): string => {
    return getRoleWorkflowMeta(status).color;
  };

  const getStatusLabel = (status: Role['status']): string => {
    return getRoleWorkflowMeta(status).label;
  };

  // Filtering and sorting
  const filteredAndSortedRoles = useMemo(() => {
    let result = [...roles];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(query) ||
          r.description?.toLowerCase().includes(query) ||
          r.requirements.skills?.some((s) => s.toLowerCase().includes(query))
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((r) => r.status === statusFilter);
    }

    // Sort - favorites first
    result.sort((a, b) => {
      const aFav = favorites.has(a.id) ? 0 : 1;
      const bFav = favorites.has(b.id) ? 0 : 1;
      if (aFav !== bFav) return aFav - bFav;

      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name, 'nb');
          break;
        case 'status':
          comparison = getRoleWorkflowMeta(a.status).order - getRoleWorkflowMeta(b.status).order;
          break;
        case 'candidates':
          comparison = (a.candidateIds?.length || 0) - (b.candidateIds?.length || 0);
          break;
        case 'scenes':
          comparison = (a.sceneIds?.length || 0) - (b.sceneIds?.length || 0);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [roles, searchQuery, statusFilter, sortField, sortDirection, favorites]);

  const filteredPoolRoles = useMemo(() => {
    const query = poolSearchQuery.trim().toLowerCase();
    if (!query) return poolRoles;
    return poolRoles.filter((poolRole) =>
      poolRole.name.toLowerCase().includes(query)
      || poolRole.description?.toLowerCase().includes(query)
      || poolRole.roleType?.toLowerCase().includes(query),
    );
  }, [poolRoles, poolSearchQuery]);

  useEffect(() => {
    if (filteredAndSortedRoles.length === 0) {
      setSelectedRoleId(null);
      return;
    }
    setSelectedRoleId((prev) => {
      if (prev && filteredAndSortedRoles.some((role) => role.id === prev)) {
        return prev;
      }
      return filteredAndSortedRoles[0].id;
    });
  }, [filteredAndSortedRoles]);

  const selectedRole = useMemo(() => {
    if (filteredAndSortedRoles.length === 0) return null;
    if (!selectedRoleId) return filteredAndSortedRoles[0];
    return filteredAndSortedRoles.find((role) => role.id === selectedRoleId) ?? filteredAndSortedRoles[0];
  }, [filteredAndSortedRoles, selectedRoleId]);

  const getRoleRequirements = (role: Role) => (
    ((role as any).requirements || {}) as {
      age?: { min?: number; max?: number };
      gender?: string;
      skills?: string[];
    }
  );

  const getRoleCandidateCount = (role: Role) => {
    const candidateIds = (role as any).candidateIds || (role as any).candidate_ids;
    return Array.isArray(candidateIds) ? candidateIds.length : 0;
  };

  const getRoleSceneCount = (role: Role) => {
    const sceneIds = (role as any).sceneIds || (role as any).scene_ids;
    return Array.isArray(sceneIds) ? sceneIds.length : 0;
  };

  const getRoleDateMs = (role: Role, field: 'updated' | 'created') => {
    const raw = field === 'updated'
      ? (role as any).updatedAt || (role as any).updated_at || (role as any).createdAt || (role as any).created_at
      : (role as any).createdAt || (role as any).created_at;
    if (!raw) return 0;
    const ts = new Date(raw).getTime();
    return Number.isFinite(ts) ? ts : 0;
  };

  const getRoleDeadlineMs = (role: Role): number | null => {
    const raw = (role as any).deadline
      || (role as any).shootDate
      || (role as any).shoot_date
      || (role as any).targetDate
      || (role as any).target_date;
    if (!raw) return null;
    const ts = new Date(raw).getTime();
    return Number.isFinite(ts) ? ts : null;
  };

  const getRoleRiskProfile = (role: Role): RoleRiskProfile => {
    const status = String((role.status || 'draft')).toLowerCase();
    const candidates = getRoleCandidateCount(role);
    const scenes = getRoleSceneCount(role);
    const updatedMs = getRoleDateMs(role, 'updated');
    const staleDays = updatedMs > 0 ? Math.max(0, Math.floor((Date.now() - updatedMs) / 86400000)) : 999;
    const deadlineMs = getRoleDeadlineMs(role);
    const deadlineDays = deadlineMs ? Math.ceil((deadlineMs - Date.now()) / 86400000) : null;
    const flags: string[] = [];

    let score = 0;
    if (status === 'filled') score += 8;
    else if (status === 'cancelled') score += 15;
    else if (status === 'casting') score += 40;
    else if (status === 'open') score += 55;
    else score += 62;

    if (candidates === 0) {
      score += 28;
      flags.push('Ingen kandidater');
    } else if (candidates < 3) {
      score += 12;
      flags.push('Lav kandidatdekning');
    } else {
      score -= 8;
    }

    if (scenes === 0 && status !== 'draft') {
      score += 8;
      flags.push('Ingen scener tilknyttet');
    }

    if (deadlineDays !== null) {
      if (deadlineDays <= 3) {
        score += 24;
        flags.push('Kritisk frist');
      } else if (deadlineDays <= 7) {
        score += 16;
        flags.push('Frist denne uka');
      } else if (deadlineDays <= 14) {
        score += 8;
      }
    }

    if (staleDays >= 14) {
      score += 22;
      flags.push('Ingen oppdateringer >14 dager');
    } else if (staleDays >= 7) {
      score += 12;
      flags.push('Ingen oppdateringer >7 dager');
    }

    score = Math.max(0, Math.min(100, Math.round(score)));
    const level: RiskLevel = score >= 70 ? 'hoy' : score >= 40 ? 'medium' : 'lav';
    return { score, level, deadlineDays, staleDays, flags };
  };

  const roleRiskMap = useMemo(() => {
    const map = new Map<string, RoleRiskProfile>();
    roles.forEach((role) => {
      map.set(role.id, getRoleRiskProfile(role));
    });
    return map;
  }, [roles]);

  const pipelineCounts = useMemo(() => {
    return ROLE_WORKFLOW_ORDER.map((status) => ({
      status,
      label: getRoleWorkflowMeta(status).label,
      count: roles.filter((role) => String(role.status || 'draft') === status).length,
    }));
  }, [roles]);

  const proRoles = useMemo(() => {
    let result = [...filteredAndSortedRoles];

    if (proPipelineFilter !== 'all') {
      result = result.filter((role) => String(role.status || 'draft') === proPipelineFilter);
    }

    if (proOnlyUrgent) {
      result = result.filter((role) => {
        const risk = roleRiskMap.get(role.id);
        return !!risk && (risk.level === 'hoy' || (risk.deadlineDays !== null && risk.deadlineDays <= 7));
      });
    }

    result.sort((a, b) => {
      let comparison = 0;
      switch (proSortField) {
        case 'risk':
          comparison = (roleRiskMap.get(a.id)?.score || 0) - (roleRiskMap.get(b.id)?.score || 0);
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name, 'nb');
          break;
        case 'status':
          comparison = getRoleWorkflowMeta(a.status).order - getRoleWorkflowMeta(b.status).order;
          break;
        case 'candidates':
          comparison = getRoleCandidateCount(a) - getRoleCandidateCount(b);
          break;
        case 'scenes':
          comparison = getRoleSceneCount(a) - getRoleSceneCount(b);
          break;
        case 'updatedAt':
          comparison = getRoleDateMs(a, 'updated') - getRoleDateMs(b, 'updated');
          break;
        case 'deadline': {
          const aDeadline = getRoleDeadlineMs(a) ?? Number.MAX_SAFE_INTEGER;
          const bDeadline = getRoleDeadlineMs(b) ?? Number.MAX_SAFE_INTEGER;
          comparison = aDeadline - bDeadline;
          break;
        }
      }
      return proSortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [filteredAndSortedRoles, proOnlyUrgent, proPipelineFilter, proSortDirection, proSortField, roleRiskMap]);

  const selectedProRole = useMemo(() => {
    if (proRoles.length === 0) return null;
    if (!selectedRoleId) return proRoles[0];
    return proRoles.find((role) => role.id === selectedRoleId) ?? proRoles[0];
  }, [proRoles, selectedRoleId]);

  const compareRoles = useMemo(() => {
    return proRoles.filter((role) => selectedIds.has(role.id)).slice(0, 4);
  }, [proRoles, selectedIds]);

  const proAlerts = useMemo(() => {
    const alerts: Array<{ id: string; severity: 'error' | 'warning' | 'info'; text: string }> = [];
    roles.forEach((role) => {
      const risk = roleRiskMap.get(role.id);
      if (!risk) return;
      if (risk.level === 'hoy') {
        alerts.push({ id: `${role.id}-high-risk`, severity: 'error', text: `${role.name}: høy risiko (${risk.score})` });
      }
      if (getRoleCandidateCount(role) === 0 && ['open', 'casting'].includes(String(role.status || 'draft'))) {
        alerts.push({ id: `${role.id}-no-candidates`, severity: 'warning', text: `${role.name}: ingen kandidater` });
      }
      if (risk.deadlineDays !== null && risk.deadlineDays <= 7) {
        alerts.push({ id: `${role.id}-deadline`, severity: 'warning', text: `${role.name}: frist om ${risk.deadlineDays} dag(er)` });
      }
      if (risk.staleDays >= 10) {
        alerts.push({ id: `${role.id}-stale`, severity: 'info', text: `${role.name}: ikke oppdatert på ${risk.staleDays} dager` });
      }
    });
    return alerts.slice(0, 8);
  }, [roleRiskMap, roles]);

  const getRecommendedAction = (role: Role | null) => {
    if (!role) return { title: 'Ingen rolle valgt', description: 'Velg en rolle for anbefalte handlinger.', nextStatus: null as RoleWorkflowStatus | null };
    const risk = roleRiskMap.get(role.id);
    const candidates = getRoleCandidateCount(role);
    const status = String(role.status || 'draft') as RoleWorkflowStatus;

    if (status === 'draft') {
      return { title: 'Publiser rollen', description: 'Flytt rollen til Åpen for å starte innhenting av kandidater.', nextStatus: 'open' as RoleWorkflowStatus };
    }
    if (status === 'open' && candidates === 0) {
      return { title: 'Inviter kandidater', description: 'Ingen kandidater ennå. Del rollen eller importer fra pool.', nextStatus: 'casting' as RoleWorkflowStatus };
    }
    if (status === 'casting' && candidates >= 3) {
      return { title: 'Lås endelig valg', description: 'Rollen har nok kandidater. Vurder å sette rollen til Besatt.', nextStatus: 'filled' as RoleWorkflowStatus };
    }
    if (risk?.level === 'hoy') {
      return { title: 'Reduser risiko', description: 'Rollen er høy risiko. Oppdater status, kandidater eller frist.', nextStatus: null as RoleWorkflowStatus | null };
    }
    return { title: 'Hold tempoet', description: 'Rollen ser sunn ut. Fortsett pipeline-oppfølgingen.', nextStatus: null as RoleWorkflowStatus | null };
  };

  const selectedRoleTimeline = useMemo(() => {
    if (!selectedProRole) return [] as Array<{ id: string; label: string; description: string; date: number }>;
    const timeline: Array<{ id: string; label: string; description: string; date: number }> = [];
    const created = getRoleDateMs(selectedProRole, 'created');
    const updated = getRoleDateMs(selectedProRole, 'updated');
    if (created) {
      timeline.push({
        id: `${selectedProRole.id}-created`,
        label: 'Rolle opprettet',
        description: `${selectedProRole.name} ble opprettet.`,
        date: created,
      });
    }
    if (updated) {
      timeline.push({
        id: `${selectedProRole.id}-updated`,
        label: 'Sist oppdatert',
        description: 'Rolledata ble sist endret.',
        date: updated,
      });
    }
    timeline.push({
      id: `${selectedProRole.id}-status`,
      label: 'Nåværende status',
      description: `Status er ${getStatusLabel(selectedProRole.status)}.`,
      date: updated || created || Date.now(),
    });
    const sessionEvents = sessionTimeline[selectedProRole.id] || [];
    timeline.push(...sessionEvents);
    return timeline.sort((a, b) => b.date - a.date);
  }, [selectedProRole, sessionTimeline]);

  const applyProPreset = (preset: ProPreset) => {
    setProPreset(preset);
    if (preset === 'casting_focus') {
      setProPipelineFilter('casting');
      setProSortField('risk');
      setProSortDirection('desc');
      setProOnlyUrgent(false);
      setProDetailTab('oversikt');
      return;
    }
    if (preset === 'critical_roles') {
      setProPipelineFilter('all');
      setProSortField('risk');
      setProSortDirection('desc');
      setProOnlyUrgent(true);
      setProDetailTab('pipeline');
      return;
    }
    if (preset === 'this_week') {
      setProPipelineFilter('all');
      setProSortField('deadline');
      setProSortDirection('asc');
      setProOnlyUrgent(false);
      setProDetailTab('pipeline');
      return;
    }
    setProPipelineFilter('all');
    setProSortField('name');
    setProSortDirection('asc');
    setProOnlyUrgent(false);
    setProDetailTab('oversikt');
  };

  useEffect(() => {
    if (selectedIds.size < 2) {
      setProCompareMode(false);
    }
  }, [selectedIds.size]);

  useEffect(() => {
    if (workspaceView !== 'pro') return;
    const handleProKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTextInput = !!target && (
        target.tagName === 'INPUT'
        || target.tagName === 'TEXTAREA'
        || target.getAttribute('contenteditable') === 'true'
      );
      if (isTextInput) return;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }

      if (event.key === '.') {
        event.preventDefault();
        setQuickActionsOpen(true);
        return;
      }

      if (event.shiftKey && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        setSelectedIds(new Set(proRoles.map((role) => role.id)));
        return;
      }

      if (selectedProRole) {
        const statusHotkeys: Record<string, RoleWorkflowStatus> = {
          '1': 'draft',
          '2': 'open',
          '3': 'casting',
          '4': 'filled',
          '5': 'cancelled',
        };
        const nextStatus = statusHotkeys[event.key];
        if (nextStatus) {
          event.preventDefault();
          void handleTransitionStatus(selectedProRole, nextStatus);
          return;
        }
      }

      const currentIndex = proRoles.findIndex((role) => role.id === selectedRoleId);
      if (event.key.toLowerCase() === 'j') {
        event.preventDefault();
        const nextIndex = Math.min(proRoles.length - 1, Math.max(0, currentIndex + 1));
        if (proRoles[nextIndex]) setSelectedRoleId(proRoles[nextIndex].id);
        return;
      }
      if (event.key.toLowerCase() === 'k') {
        event.preventDefault();
        const nextIndex = Math.max(0, currentIndex <= 0 ? 0 : currentIndex - 1);
        if (proRoles[nextIndex]) setSelectedRoleId(proRoles[nextIndex].id);
        return;
      }

      if (event.key === 'Enter' && selectedProRole) {
        event.preventDefault();
        onEditRole(selectedProRole);
      }
    };

    window.addEventListener('keydown', handleProKeyDown);
    return () => window.removeEventListener('keydown', handleProKeyDown);
  }, [onEditRole, proRoles, selectedProRole, selectedRoleId, workspaceView]);

  useEffect(() => {
    if (workspaceView !== 'pro') return;
    if (proRoles.length === 0) {
      if (selectedRoleId !== null) setSelectedRoleId(null);
      return;
    }
    if (!selectedRoleId || !proRoles.some((role) => role.id === selectedRoleId)) {
      setSelectedRoleId(proRoles[0].id);
    }
  }, [workspaceView, proRoles, selectedRoleId]);

  // Statistics
  const stats = useMemo(() => {
    const statusCount: Record<string, number> = {};
    roles.forEach((r) => {
      statusCount[r.status] = (statusCount[r.status] || 0) + 1;
    });
    return {
      total: roles.length,
      open: statusCount['open'] || 0,
      casting: statusCount['casting'] || 0,
      filled: statusCount['filled'] || 0,
      favorites: favorites.size,
    };
  }, [roles, favorites]);

  // Handlers
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const newFavs = new Set(prev);
      if (newFavs.has(id)) {
        newFavs.delete(id);
      } else {
        newFavs.add(id);
      }
      return newFavs;
    });
  };

  const handleSelectAll = () => {
    const source = workspaceView === 'pro' ? proRoles : filteredAndSortedRoles;
    if (selectedIds.size === source.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(source.map((r) => r.id)));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleDeleteWithUndo = async (role: Role) => {
    setDeletedRole(role);
    try {
      await castingService.deleteRole(projectId, role.id);
      onRolesChange();
      emitRoleSyncEvent({
        type: 'project-roles-updated',
        source: 'role-management',
        projectId,
      });
      setUndoSnackbarOpen(true);
      showInfo(`🗑️ ${role.name} slettet - klikk "Angre" for å gjenopprette`, 6000);
    } catch (error) {
      console.error('Failed to delete role:', error);
      setDeletedRole(null);
    }
  };

  const handleUndoDelete = async () => {
    if (deletedRole) {
      try {
        await castingService.saveRole(projectId, deletedRole);
        onRolesChange();
        emitRoleSyncEvent({
          type: 'project-roles-updated',
          source: 'role-management',
          projectId,
        });
        showSuccess(`↩️ ${deletedRole.name} gjenopprettet`, 3000);
      } catch (error) {
        console.error('Failed to restore role:', error);
      }
      setDeletedRole(null);
      setUndoSnackbarOpen(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const idsToDelete = Array.from(selectedIds);
    try {
      const results = await Promise.allSettled(
        idsToDelete.map(id => castingService.deleteRole(projectId, id)),
      );
      const failedIds = new Set<string>();
      let successCount = 0;

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successCount += 1;
          return;
        }
        failedIds.add(idsToDelete[index]);
      });

      if (successCount > 0) {
        onRolesChange();
        emitRoleSyncEvent({
          type: 'project-roles-updated',
          source: 'role-management',
          projectId,
        });
      }

      const failedCount = failedIds.size;
      setSelectedIds(failedIds);

      if (successCount > 0 && failedCount === 0) {
        showSuccess(`Slettet ${successCount} roller.`);
        return;
      }
      if (successCount > 0 && failedCount > 0) {
        showError(`${successCount} slettet, ${failedCount} feilet. Markerede feil ligger igjen for retry.`);
        return;
      }
      showError('Kunne ikke slette valgte roller.');
    } catch (error) {
      console.error('Failed to bulk delete roles:', error);
      showError('Kunne ikke slette valgte roller.');
    }
  };

  const handleDuplicate = async (role: Role) => {
    const newRole: Role = {
      ...role,
      id: `role-${Date.now()}`,
      name: `${role.name} (kopi)`,
      status: 'draft',
      candidateIds: [],
    };
    try {
      await castingService.saveRole(projectId, newRole);
      onRolesChange();
      emitRoleSyncEvent({
        type: 'project-roles-updated',
        source: 'role-management',
        projectId,
      });
    } catch (error) {
      console.error('Failed to duplicate role:', error);
    }
  };

  const pushSessionTimelineEvent = (roleId: string, label: string, description: string) => {
    setSessionTimeline((prev) => {
      const previousEvents = prev[roleId] || [];
      const nextEvents = [
        {
          id: `${roleId}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
          label,
          description,
          date: Date.now(),
        },
        ...previousEvents,
      ].slice(0, 20);
      return { ...prev, [roleId]: nextEvents };
    });
  };

  const applyRoleStatusTransition = async (
    role: Role,
    nextStatus: RoleWorkflowStatus,
    options: { trackHistory?: boolean; toast?: boolean } = {},
  ) => {
    const { trackHistory = true, toast = true } = options;
    if (role.status === nextStatus) return true;
    const allowedTransitions = getRoleWorkflowMeta(role.status).allowedTransitions;
    if (!allowedTransitions.includes(nextStatus)) {
      showError(`Kan ikke endre fra ${getStatusLabel(role.status)} til ${getStatusLabel(nextStatus)}`);
      return false;
    }
    try {
      await castingService.saveRole(projectId, {
        ...role,
        status: nextStatus,
      });
      onRolesChange();
      emitRoleSyncEvent({
        type: 'project-roles-updated',
        source: 'role-management',
        projectId,
      });
      pushSessionTimelineEvent(
        role.id,
        'Status endret',
        `${getStatusLabel(role.status)} → ${getStatusLabel(nextStatus)}`,
      );
      if (trackHistory) {
        setTransitionUndoStack((prev) => [
          {
            roleId: role.id,
            from: role.status,
            to: nextStatus,
            timestamp: Date.now(),
          },
          ...prev,
        ].slice(0, 30));
        setTransitionRedoStack([]);
      }
      if (toast) {
        showSuccess(`Status oppdatert til ${getStatusLabel(nextStatus)}`);
      }
      return true;
    } catch (error) {
      console.error('Failed to update role status:', error);
      showError('Kunne ikke oppdatere rollestatus');
      return false;
    }
  };

  const handleTransitionStatus = async (role: Role, nextStatus: RoleWorkflowStatus) => {
    await applyRoleStatusTransition(role, nextStatus);
  };

  const handleUndoStatusTransition = async () => {
    const [lastTransition, ...remaining] = transitionUndoStack;
    if (!lastTransition) return;
    const role = roles.find((item) => item.id === lastTransition.roleId);
    if (!role) {
      setTransitionUndoStack(remaining);
      return;
    }
    const success = await applyRoleStatusTransition(role, lastTransition.from, { trackHistory: false, toast: false });
    if (!success) return;
    setTransitionUndoStack(remaining);
    setTransitionRedoStack((prev) => [lastTransition, ...prev].slice(0, 30));
    showSuccess(`Angret: ${getStatusLabel(lastTransition.to)} → ${getStatusLabel(lastTransition.from)}`);
  };

  const handleRedoStatusTransition = async () => {
    const [lastTransition, ...remaining] = transitionRedoStack;
    if (!lastTransition) return;
    const role = roles.find((item) => item.id === lastTransition.roleId);
    if (!role) {
      setTransitionRedoStack(remaining);
      return;
    }
    const success = await applyRoleStatusTransition(role, lastTransition.to, { trackHistory: false, toast: false });
    if (!success) return;
    setTransitionRedoStack(remaining);
    setTransitionUndoStack((prev) => [lastTransition, ...prev].slice(0, 30));
    showSuccess(`Gjentok: ${getStatusLabel(lastTransition.from)} → ${getStatusLabel(lastTransition.to)}`);
  };

  const handleExportCSV = async () => {
    try {
      const project = await castingService.getProject(projectId);
      if (!project) {
        alert('Prosjekt ikke funnet');
        return;
      }

      const htmlContent = generateRolesHTML(project, filteredAndSortedRoles);

      // Create a new window for printing/viewing
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Kunne ikke åpne eksport-vindu. Vennligst tillat popups.');
        return;
      }

      printWindow.document.write(htmlContent);
      printWindow.document.close();

      // Trigger print (which allows saving as PDF)
      setTimeout(() => {
        printWindow.print();
      }, 250);
    } catch (error) {
      console.error('Error exporting roles:', error);
      alert('Kunne ikke eksportere roller');
    }
  };

  type ProjectExportInfo = { name: string };
  const generateRolesHTML = (project: ProjectExportInfo, roles: Role[]): string => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('nb-NO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Calculate summary statistics
    const totalRoles = roles.length;
    const openRoles = roles.filter(r => r.status === 'open' || r.status === 'casting').length;
    const filledRoles = roles.filter(r => r.status === 'filled').length;
    const rolesFilledPercent = totalRoles > 0 ? Math.round((filledRoles / totalRoles) * 100) : 0;

    // SVG Icon for roles (Assignment/Clipboard)
    const roleIconSVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#b86bff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>`;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${project.name} - Roller</title>
  <style>
    @page {
      margin: 0;
      counter-increment: page;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #1a1a1a;
      line-height: 1.7;
      padding: 0;
      background: #fff;
      font-size: 14px;
    }
    .page {
      padding: 50px 60px 80px 60px;
      max-width: 210mm;
      margin: 0 auto;
      min-height: 297mm;
      position: relative;
    }
    .header {
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      border-bottom: 5px solid #b86bff;
      padding: 30px 35px;
      margin: -50px -60px 40px -60px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    }
    .title {
      font-size: 36px;
      font-weight: 800;
      color: #b86bff;
      margin-bottom: 10px;
      letter-spacing: -1px;
      line-height: 1.2;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .title svg {
      flex-shrink: 0;
    }
    .subtitle {
      color: #64748b;
      font-size: 15px;
      font-weight: 500;
      margin-top: 5px;
    }
    .summary {
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      border-left: 6px solid #b86bff;
      padding: 30px;
      margin-bottom: 45px;
      border-radius: 12px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    }
    .summary-title {
      font-size: 20px;
      font-weight: 700;
      color: #b86bff;
      margin-bottom: 25px;
      letter-spacing: -0.3px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .summary-title svg {
      flex-shrink: 0;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 25px;
    }
    .summary-item {
      background: white;
      padding: 25px 20px;
      border-radius: 10px;
      text-align: center;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
      border: 1px solid #e2e8f0;
    }
    .summary-number {
      font-size: 36px;
      font-weight: 800;
      color: #b86bff;
      display: block;
      margin-bottom: 8px;
      line-height: 1;
    }
    .summary-label {
      font-size: 12px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      font-weight: 600;
      display: block;
    }
    .progress-bar {
      width: 100%;
      height: 6px;
      background: #e2e8f0;
      border-radius: 10px;
      margin-top: 10px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #b86bff 0%, #b7794d 100%);
      border-radius: 10px;
    }
    .section {
      margin-bottom: 50px;
      page-break-inside: avoid;
    }
    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 22px;
      padding-bottom: 15px;
      border-bottom: 3px solid #e2e8f0;
    }
    .section-title {
      font-size: 24px;
      font-weight: 700;
      color: #0f172a;
      display: flex;
      align-items: center;
      gap: 12px;
      letter-spacing: -0.4px;
    }
    .section-icon {
      display: inline-flex;
      align-items: center;
    }
    .section-icon svg {
      flex-shrink: 0;
    }
    .section-count {
      font-size: 13px;
      font-weight: 600;
      color: #64748b;
      background: #f1f5f9;
      padding: 6px 14px;
      border-radius: 20px;
      border: 1px solid #e2e8f0;
    }
    .section-content {
      background: #fafbfc;
      padding: 0;
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 4px rgba(0,0,0,0.04);
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    td {
      padding: 16px 20px;
      border-bottom: 1px solid #e2e8f0;
      color: #334155;
      font-size: 14px;
      font-weight: 400;
      vertical-align: top;
    }
    th {
      background: linear-gradient(135deg, #b86bff 0%, #b7794d 100%);
      color: white;
      font-weight: 700;
      padding: 18px 20px;
      text-align: left;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      border: none;
    }
    th:first-child { border-top-left-radius: 10px; }
    th:last-child { border-top-right-radius: 10px; }
    tr:last-child td {
      border-bottom: none;
    }
    tr:nth-child(even) {
      background-color: #f8fafc;
    }
    .badge {
      display: inline-block;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .badge-draft { background: #94a3b8; color: white; }
    .badge-open { background: #b86bff; color: white; }
    .badge-casting { background: #3b82f6; color: white; }
    .badge-filled { background: #10b981; color: white; }
    .badge-cancelled { background: #ef4444; color: white; }
    .footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 15px 60px;
      border-top: 2px solid #e2e8f0;
      background: #fafbfc;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      color: #64748b;
      font-weight: 500;
    }
    .footer-left {
      display: flex;
      gap: 20px;
    }
    .footer-right {
      display: flex;
      gap: 20px;
    }
    .page-number {
      font-weight: 600;
    }
    .page-number::after {
      content: counter(page);
    }
    .empty-state {
      padding: 50px;
      text-align: center;
      color: #94a3b8;
      font-style: italic;
      font-size: 15px;
    }
    @media print {
      .page {
        padding: 30px 40px 70px 40px;
      }
      .section {
        page-break-inside: avoid;
        margin-bottom: 35px;
      }
      .summary {
        page-break-inside: avoid;
      }
      .footer {
        padding: 12px 40px;
      }
      .header {
        margin: -30px -40px 35px -40px;
        padding: 25px 30px;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="title">
        ${roleIconSVG}
        ${project.name} - Roller
      </div>
      <div class="subtitle">Eksportert: ${dateStr}</div>
    </div>

    <div class="summary">
      <div class="summary-title">
        ${roleIconSVG}
        Oversikt
      </div>
      <div class="summary-grid">
        <div class="summary-item">
          <span class="summary-number">${totalRoles}</span>
          <span class="summary-label">Totale Roller</span>
        </div>
        <div class="summary-item">
          <span class="summary-number">${openRoles}</span>
          <span class="summary-label">Åpne Roller</span>
        </div>
        <div class="summary-item">
          <span class="summary-number">${filledRoles}</span>
          <span class="summary-label">Fylte Roller</span>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${rolesFilledPercent}%"></div>
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <div class="section-title">
          <span class="section-icon">${roleIconSVG}</span>
          Roller
        </div>
        <span class="section-count">${totalRoles} rolle${totalRoles !== 1 ? 'r' : ''}</span>
      </div>
      <div class="section-content">
        ${
          roles.length === 0
            ? '<div class="empty-state">Ingen roller ennå</div>'
            : `<table>
          <thead>
            <tr>
              <th style="width: 20%;">Navn</th>
              <th style="width: 12%;">Status</th>
              <th style="width: 25%;">Beskrivelse</th>
              <th style="width: 10%;">Alder</th>
              <th style="width: 20%;">Ferdigheter</th>
              <th style="width: 8%;">Kandidater</th>
              <th style="width: 5%;">Scener</th>
            </tr>
          </thead>
          <tbody>
            ${roles
              .map(
                (r) => {
                  const ageRange = r.requirements.age?.min && r.requirements.age?.max ? `${r.requirements.age.min}-${r.requirements.age.max}` : r.requirements.age?.min ? `${r.requirements.age.min}+` : '-';
                  const skills = r.requirements.skills?.join(', ') || '-';
                  const description = r.description || '-';
                  return `<tr>
              <td style="width: 20%;"><strong>${r.name}</strong></td>
              <td style="width: 12%;"><span class="badge badge-${r.status}">${getStatusLabel(r.status)}</span></td>
              <td style="width: 25%; font-size: 13px;">${description.length > 60 ? description.substring(0, 60) + '...' : description}</td>
              <td style="width: 10%; text-align: center;">${ageRange}</td>
              <td style="width: 20%; font-size: 13px;">${skills.length > 50 ? skills.substring(0, 50) + '...' : skills}</td>
              <td style="width: 8%; text-align: center;">${(r.candidateIds?.length || 0)}</td>
              <td style="width: 5%; text-align: center;">${(r.sceneIds?.length || 0)}</td>
            </tr>`;
                }
              )
              .join('')}
          </tbody>
        </table>`
        }
      </div>
    </div>

    <div class="footer">
      <div class="footer-left">
        <span>${project.name}</span>
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
    setExpandedCards((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const statTileSx = {
    textAlign: 'center',
    p: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 },
    borderRadius: 1.5,
    border: `1px solid ${roleBorder}`,
    bgcolor: 'rgba(255,255,255,0.02)',
  } as const;

  const selectedProRoleRisk = selectedProRole ? roleRiskMap.get(selectedProRole.id) : null;
  const recommendedAction = getRecommendedAction(selectedProRole);

  const commandPaletteActions = useMemo(() => {
    const actions: Array<{ id: string; label: string; hint?: string; run: () => void }> = [
      {
        id: 'create-role',
        label: 'Ny rolle',
        hint: 'Ctrl/Cmd + N',
        run: () => {
          onCreateRole();
          setCommandPaletteOpen(false);
        },
      },
      {
        id: 'preset-critical',
        label: 'Vis kritiske roller',
        run: () => {
          applyProPreset('critical_roles');
          setCommandPaletteOpen(false);
        },
      },
      {
        id: 'preset-all',
        label: 'Vis alle roller',
        run: () => {
          applyProPreset('all_roles');
          setCommandPaletteOpen(false);
        },
      },
      {
        id: 'toggle-compare',
        label: proCompareMode ? 'Deaktiver sammenligning' : 'Aktiver sammenligning',
        run: () => {
          setProCompareMode((prev) => !prev);
          setCommandPaletteOpen(false);
        },
      },
    ];
    if (selectedProRole) {
      const statusHotkeyHints: Record<RoleWorkflowStatus, string> = {
        draft: '1',
        open: '2',
        casting: '3',
        filled: '4',
        cancelled: '5',
      };
      const allowedStatusActions = getRoleWorkflowMeta(selectedProRole.status).allowedTransitions;
      actions.splice(1, 0, {
        id: 'edit-selected',
        label: `Rediger: ${selectedProRole.name}`,
        hint: 'Enter',
        run: () => {
          onEditRole(selectedProRole);
          setCommandPaletteOpen(false);
        },
      });
      allowedStatusActions.forEach((status) => {
        actions.push({
          id: `status-${status}`,
          label: `Sett status: ${getStatusLabel(status)}`,
          hint: statusHotkeyHints[status],
          run: () => {
            void handleTransitionStatus(selectedProRole, status);
            setCommandPaletteOpen(false);
          },
        });
      });
      actions.push({
        id: 'save-template',
        label: `Lagre "${selectedProRole.name}" som mal`,
        run: () => {
          void handleSaveToPool(selectedProRole);
          setCommandPaletteOpen(false);
        },
      });
    }
    if (transitionUndoStack.length > 0) {
      actions.push({
        id: 'undo-transition',
        label: 'Angre siste statusendring',
        run: () => {
          void handleUndoStatusTransition();
          setCommandPaletteOpen(false);
        },
      });
    }
    if (transitionRedoStack.length > 0) {
      actions.push({
        id: 'redo-transition',
        label: 'Gjenta siste statusendring',
        run: () => {
          void handleRedoStatusTransition();
          setCommandPaletteOpen(false);
        },
      });
    }
    return actions;
  }, [
    onCreateRole,
    onEditRole,
    proCompareMode,
    selectedProRole,
    transitionRedoStack.length,
    transitionUndoStack.length,
  ]);

  return (
    <Box
      component="section"
      aria-labelledby={panelTitleId}
      sx={{
        p: containerPadding,
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        minHeight: {
          xs: 'auto',
          lg: 'clamp(700px, 78vh, 980px)',
        },
        borderRadius: 2.5,
        backgroundImage: [
          'linear-gradient(180deg, rgba(9,6,26,0.9) 0%, rgba(10,7,30,0.92) 100%)',
          'radial-gradient(circle at 18% -25%, rgba(184,107,255,0.3), transparent 55%)',
          'radial-gradient(circle at 82% -10%, rgba(106,76,207,0.28), transparent 46%)',
          rolePanelBackdrop,
        ].join(', '),
        backgroundSize: 'auto, auto, auto, cover',
        backgroundPosition: 'center, center, center, center',
        backgroundRepeat: 'no-repeat, no-repeat, no-repeat, no-repeat',
      }}
    >
      {/* Header - Responsive */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', sm: 'center' },
          mb: 2,
          gap: { xs: 1.5, sm: 2 },
          px: { xs: 1.5, sm: 2 },
          py: { xs: 1.25, sm: 1.5 },
          border: `1px solid ${roleBorder}`,
          borderRadius: 2,
          bgcolor: roleSurface,
          backdropFilter: 'blur(8px)',
          boxShadow: '0 16px 40px rgba(0,0,0,0.35)',
        }}
      >
        {/* Enhanced Title with gradient - matches ProductionDayView */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 1.5, sm: 2 },
            py: { xs: 1, sm: 1.5 },
          }}
        >
          <Box
            sx={{
              width: { xs: 48, sm: 56, md: 52, lg: 60, xl: 68 },
              height: { xs: 48, sm: 56, md: 52, lg: 60, xl: 68 },
              borderRadius: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
              background: 'linear-gradient(145deg, rgba(184,107,255,0.34) 0%, rgba(110,75,52,0.32) 100%)',
              border: '1px solid rgba(184,107,255,0.48)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(0,0,0,0.28)',
              transition: 'all 0.2s ease',
              '&:hover': {
                transform: 'scale(1.05)',
                boxShadow: '0 8px 18px rgba(0,0,0,0.34)',
              },
            }}
          >
            <TheaterComedyIcon
              sx={{
                color: '#e5c29c',
                fontSize: { xs: 26, sm: 32, md: 30, lg: 36, xl: 42 },
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
              }}
            />
          </Box>
          <Box>
            <Typography
              variant="h5"
              component="h2"
              id={panelTitleId}
              sx={{
                color: roleText,
                fontWeight: 800,
                fontSize: { xs: '1.25rem', sm: '1.5rem', md: '1.4rem', lg: '1.6rem', xl: '2rem' },
                lineHeight: 1.2,
                letterSpacing: '-0.5px',
                textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                background: 'linear-gradient(135deg, #f7e7d5 0%, #b86bff 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Casting-roller
            </Typography>
            <Typography
              sx={{
                color: roleTextMuted,
                fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.9rem', xl: '1rem' },
                fontWeight: 500,
                mt: 0.25,
                display: 'flex',
                alignItems: 'center',
                gap: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
              }}
            >
              <AssignmentIcon sx={{ fontSize: { xs: 14, sm: 16, md: 15, lg: 17, xl: 20 }, opacity: 0.7 }} />
              {roleContextLabel}
            </Typography>
          </Box>
        </Box>

        {/* Action buttons */}
        <Box
          sx={{
            display: 'flex',
            gap: { xs: 0.5, sm: 1 },
            flexWrap: 'wrap',
            justifyContent: { xs: 'space-between', sm: 'flex-end' },
          }}
        >
          <Tooltip title="Eksporter til CSV (Ctrl+E)">
            <Button
              variant="outlined"
              onClick={handleExportCSV}
              aria-label="Eksporter roller til CSV"
              sx={{
                minHeight: TOUCH_TARGET_SIZE,
                minWidth: TOUCH_TARGET_SIZE,
                color: roleTextMuted,
                borderColor: roleBorder,
                fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                px: { xs: 1, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
                bgcolor: 'rgba(255,255,255,0.02)',
                '&:hover': {
                  borderColor: roleTabAccent,
                  bgcolor: 'rgba(184,107,255,0.14)',
                },
                ...focusVisibleStyles,
              }}
            >
              <ExportIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />
              {!isMobile && <Box component="span" sx={{ ml: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 } }}>Eksporter</Box>}
            </Button>
          </Tooltip>

          <Tooltip title="Vis/skjul statistikk">
            <Button
              variant="outlined"
              onClick={() => setShowStats(!showStats)}
              aria-pressed={showStats}
              sx={{
                minHeight: TOUCH_TARGET_SIZE,
                minWidth: TOUCH_TARGET_SIZE,
                color: showStats ? roleTabAccent : 'rgba(255,255,255,0.7)',
                borderColor: showStats ? roleTabAccent : roleBorder,
                bgcolor: showStats ? roleTabAccentSoft : 'transparent',
                fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                borderRadius: 1.5,
                px: { xs: 1, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
                '&:hover': {
                  borderColor: roleTabAccent,
                  bgcolor: 'rgba(184,107,255,0.2)',
                },
                ...focusVisibleStyles,
              }}
            >
              <StatsIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />
              {!isMobile && <Box component="span" sx={{ ml: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 } }}>Statistikk</Box>}
            </Button>
          </Tooltip>

          <Tooltip title="Ny rolle (Ctrl+N)">
            <Button
              variant="contained"
              onClick={onCreateRole}
              aria-label="Ny rolle"
              sx={{
                bgcolor: roleTabAccent,
                color: '#160a24',
                fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                fontWeight: 600,
                minHeight: TOUCH_TARGET_SIZE,
                flex: { xs: 1, sm: 'none' },
                borderRadius: 1.5,
                boxShadow: '0 8px 22px rgba(0,0,0,0.24)',
                px: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
                ...focusVisibleStyles,
                '&:hover': {
                  bgcolor: roleTabAccentHover,
                  boxShadow: '0 10px 26px rgba(0,0,0,0.3)',
                },
              }}
            >
              <AddIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />
              {!isMobile && <Box component="span" sx={{ ml: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 } }}>Ny rolle</Box>}
            </Button>
          </Tooltip>
        </Box>
      </Box>

      {/* Project/Templates Toggle */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 1,
          mb: 2,
          p: 1,
          bgcolor: roleSurfaceMuted,
          borderRadius: 1.5,
          border: `1px solid ${roleBorder}`,
        }}
      >
        <Typography sx={{ color: roleTextMuted, fontSize: '0.875rem', mr: 1 }}>
          Vis:
        </Typography>
        <Button
          variant={poolMode === 'project' ? 'contained' : 'outlined'}
          size="small"
          onClick={() => setPoolMode('project')}
          sx={{
            minHeight: 36,
            bgcolor: poolMode === 'project' ? roleTabAccentSoft : 'transparent',
            color: poolMode === 'project' ? roleTabAccent : 'rgba(255,255,255,0.7)',
            borderColor: poolMode === 'project' ? roleTabAccent : roleBorder,
            '&:hover': {
              bgcolor: poolMode === 'project' ? 'rgba(184,107,255,0.28)' : 'rgba(255,255,255,0.06)',
            },
          }}
        >
          Prosjektroller ({roles.length})
        </Button>
        <Button
          variant={poolMode === 'pool' ? 'contained' : 'outlined'}
          size="small"
          onClick={() => setPoolMode('pool')}
          sx={{
            minHeight: 36,
            bgcolor: poolMode === 'pool' ? roleTabAccentSoft : 'transparent',
            color: poolMode === 'pool' ? roleTabAccent : 'rgba(255,255,255,0.7)',
            borderColor: poolMode === 'pool' ? roleTabAccent : roleBorder,
            '&:hover': {
              bgcolor: poolMode === 'pool' ? 'rgba(184,107,255,0.28)' : 'rgba(255,255,255,0.06)',
            },
          }}
        >
          Maler ({poolRoles.length})
        </Button>
      </Box>

      {/* Workspace View Toggle */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 1,
          mb: 2,
          p: 1,
          bgcolor: roleSurfaceMuted,
          borderRadius: 1.5,
          border: `1px solid ${roleBorder}`,
        }}
      >
        <Typography sx={{ color: roleTextMuted, fontSize: '0.875rem', mr: 1 }}>
          Visning:
        </Typography>
        <Button
          variant={workspaceView === 'standard' ? 'contained' : 'outlined'}
          size="small"
          onClick={() => setWorkspaceView('standard')}
          sx={{
            minHeight: 36,
            bgcolor: workspaceView === 'standard' ? roleTabAccentSoft : 'transparent',
            color: workspaceView === 'standard' ? roleTabAccent : 'rgba(255,255,255,0.7)',
            borderColor: workspaceView === 'standard' ? roleTabAccent : roleBorder,
            '&:hover': {
              bgcolor: workspaceView === 'standard' ? 'rgba(184,107,255,0.28)' : 'rgba(255,255,255,0.06)',
            },
          }}
        >
          Standard
        </Button>
        <Button
          variant={workspaceView === 'pro' ? 'contained' : 'outlined'}
          size="small"
          onClick={() => setWorkspaceView('pro')}
          sx={{
            minHeight: 36,
            bgcolor: workspaceView === 'pro' ? roleTabAccentSoft : 'transparent',
            color: workspaceView === 'pro' ? roleTabAccent : 'rgba(255,255,255,0.7)',
            borderColor: workspaceView === 'pro' ? roleTabAccent : roleBorder,
            '&:hover': {
              bgcolor: workspaceView === 'pro' ? 'rgba(184,107,255,0.28)' : 'rgba(255,255,255,0.06)',
            },
          }}
        >
          Pro-visning
        </Button>
      </Box>

      {workspaceView === 'pro' ? (
        <>
          <Box
            sx={{
              mb: 2,
              p: 1.25,
              border: `1px solid ${roleBorder}`,
              borderRadius: 2,
              bgcolor: roleSurface,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) auto' },
              gap: 1.25,
            }}
          >
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ alignItems: { md: 'center' }, flexWrap: 'wrap' }}>
              <Typography sx={{ color: roleText, fontWeight: 700, minWidth: 110 }}>Pro View</Typography>
              <Chip
                label={`${proRoles.length} roller`}
                sx={{
                  bgcolor: roleTabAccentSoft,
                  border: `1px solid ${roleBorder}`,
                  color: roleTabAccent,
                  fontWeight: 700,
                }}
              />
              <Button
                size="small"
                variant={proPreset === 'casting_focus' ? 'contained' : 'outlined'}
                onClick={() => applyProPreset('casting_focus')}
                sx={{ minHeight: 34, color: proPreset === 'casting_focus' ? '#160a24' : roleTextMuted, borderColor: roleBorder, bgcolor: proPreset === 'casting_focus' ? roleTabAccent : 'transparent' }}
              >
                Casting-fokus
              </Button>
              <Button
                size="small"
                variant={proPreset === 'critical_roles' ? 'contained' : 'outlined'}
                onClick={() => applyProPreset('critical_roles')}
                sx={{ minHeight: 34, color: proPreset === 'critical_roles' ? '#160a24' : roleTextMuted, borderColor: roleBorder, bgcolor: proPreset === 'critical_roles' ? roleTabAccent : 'transparent' }}
              >
                Kritiske roller
              </Button>
              <Button
                size="small"
                variant={proPreset === 'this_week' ? 'contained' : 'outlined'}
                onClick={() => applyProPreset('this_week')}
                sx={{ minHeight: 34, color: proPreset === 'this_week' ? '#160a24' : roleTextMuted, borderColor: roleBorder, bgcolor: proPreset === 'this_week' ? roleTabAccent : 'transparent' }}
              >
                Denne uka
              </Button>
              <Button
                size="small"
                variant={proPreset === 'all_roles' ? 'contained' : 'outlined'}
                onClick={() => applyProPreset('all_roles')}
                sx={{ minHeight: 34, color: proPreset === 'all_roles' ? '#160a24' : roleTextMuted, borderColor: roleBorder, bgcolor: proPreset === 'all_roles' ? roleTabAccent : 'transparent' }}
              >
                Alle
              </Button>
            </Stack>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ alignItems: { md: 'center' }, flexWrap: 'wrap', justifyContent: { lg: 'flex-end' } }}>
              <FormControl size="small" sx={{ minWidth: 132 }}>
                <Select
                  value={proSortField}
                  onChange={(event) => setProSortField(event.target.value as ProSortField)}
                  sx={{
                    color: roleText,
                    bgcolor: roleSurfaceMuted,
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: roleBorder },
                  }}
                >
                  <MenuItem value="risk">Risiko</MenuItem>
                  <MenuItem value="name">Navn</MenuItem>
                  <MenuItem value="status">Status</MenuItem>
                  <MenuItem value="candidates">Kandidater</MenuItem>
                  <MenuItem value="scenes">Scener</MenuItem>
                  <MenuItem value="updatedAt">Oppdatert</MenuItem>
                  <MenuItem value="deadline">Frist</MenuItem>
                </Select>
              </FormControl>
              <Button
                size="small"
                variant="outlined"
                onClick={() => setProSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                sx={{ minHeight: 34, color: roleText, borderColor: roleBorder }}
              >
                {proSortDirection === 'asc' ? 'Stigende' : 'Synkende'}
              </Button>
              <FormControl size="small" sx={{ minWidth: 132 }}>
                <Select
                  value={proPipelineFilter}
                  onChange={(event) => setProPipelineFilter(event.target.value as RoleWorkflowStatus | 'all')}
                  sx={{
                    color: roleText,
                    bgcolor: roleSurfaceMuted,
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: roleBorder },
                  }}
                >
                  <MenuItem value="all">Alle statuser</MenuItem>
                  {ROLE_WORKFLOW_ORDER.map((status) => (
                    <MenuItem key={status} value={status}>
                      {getRoleWorkflowMeta(status).label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                size="small"
                variant={proOnlyUrgent ? 'contained' : 'outlined'}
                onClick={() => setProOnlyUrgent((prev) => !prev)}
                sx={{
                  minHeight: 34,
                  borderColor: roleBorder,
                  bgcolor: proOnlyUrgent ? 'rgba(239,68,68,0.18)' : 'transparent',
                  color: proOnlyUrgent ? '#ffb4b4' : roleTextMuted,
                }}
              >
                <WarningIcon sx={{ fontSize: 16, mr: 0.5 }} />
                Kun hast
              </Button>
              <Button
                size="small"
                variant={proListMode === 'cards' ? 'contained' : 'outlined'}
                onClick={() => setProListMode('cards')}
                sx={{ minHeight: 34, borderColor: roleBorder, color: proListMode === 'cards' ? '#160a24' : roleTextMuted, bgcolor: proListMode === 'cards' ? roleTabAccent : 'transparent' }}
              >
                <GridViewIcon sx={{ fontSize: 16, mr: 0.5 }} />
                Kort
              </Button>
              <Button
                size="small"
                variant={proListMode === 'table' ? 'contained' : 'outlined'}
                onClick={() => setProListMode('table')}
                sx={{ minHeight: 34, borderColor: roleBorder, color: proListMode === 'table' ? '#160a24' : roleTextMuted, bgcolor: proListMode === 'table' ? roleTabAccent : 'transparent' }}
              >
                <TableViewIcon sx={{ fontSize: 16, mr: 0.5 }} />
                Tabell
              </Button>
              <Button
                size="small"
                variant={proCompareMode ? 'contained' : 'outlined'}
                onClick={() => setProCompareMode((prev) => !prev)}
                sx={{ minHeight: 34, borderColor: roleBorder, color: proCompareMode ? '#160a24' : roleTextMuted, bgcolor: proCompareMode ? roleTabAccent : 'transparent' }}
              >
                <CompareArrowsIcon sx={{ fontSize: 16, mr: 0.5 }} />
                Sammenlign
              </Button>
              <Tooltip title="Angre statusendring">
                <span>
                  <IconButton
                    size="small"
                    onClick={() => void handleUndoStatusTransition()}
                    disabled={transitionUndoStack.length === 0}
                    sx={{ color: roleTextMuted, border: `1px solid ${roleBorder}`, minWidth: 34, minHeight: 34 }}
                  >
                    <UndoStatusIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Gjenta statusendring">
                <span>
                  <IconButton
                    size="small"
                    onClick={() => void handleRedoStatusTransition()}
                    disabled={transitionRedoStack.length === 0}
                    sx={{ color: roleTextMuted, border: `1px solid ${roleBorder}`, minWidth: 34, minHeight: 34 }}
                  >
                    <RedoStatusIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Button
                size="small"
                variant="outlined"
                onClick={() => setQuickActionsOpen(true)}
                sx={{ minHeight: 34, borderColor: roleBorder, color: roleTextMuted }}
              >
                <TuneIcon sx={{ fontSize: 16, mr: 0.5 }} />
                Hurtighandlinger
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() => setCommandPaletteOpen(true)}
                sx={{ minHeight: 34, borderColor: roleBorder, color: roleTextMuted }}
              >
                <CommandIcon sx={{ fontSize: 16, mr: 0.5 }} />
                Kommando
              </Button>
            </Stack>
          </Box>

          <Box
            sx={{
              mb: 1.5,
              px: 0.5,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 0.75,
              alignItems: 'center',
            }}
          >
            <Chip size="small" label="J/K: Naviger" sx={{ bgcolor: roleSurfaceMuted, color: roleTextMuted, border: `1px solid ${roleBorder}` }} />
            <Chip size="small" label="1: Utkast" sx={{ bgcolor: roleSurfaceMuted, color: roleTextMuted, border: `1px solid ${roleBorder}` }} />
            <Chip size="small" label="2: Åpen" sx={{ bgcolor: roleSurfaceMuted, color: roleTextMuted, border: `1px solid ${roleBorder}` }} />
            <Chip size="small" label="3: Casting" sx={{ bgcolor: roleSurfaceMuted, color: roleTextMuted, border: `1px solid ${roleBorder}` }} />
            <Chip size="small" label="4: Besatt" sx={{ bgcolor: roleSurfaceMuted, color: roleTextMuted, border: `1px solid ${roleBorder}` }} />
            <Chip size="small" label="5: Kansellert" sx={{ bgcolor: roleSurfaceMuted, color: roleTextMuted, border: `1px solid ${roleBorder}` }} />
            <Chip size="small" label="Enter: Rediger" sx={{ bgcolor: roleSurfaceMuted, color: roleTextMuted, border: `1px solid ${roleBorder}` }} />
            <Chip size="small" label=".: Hurtighandlinger" sx={{ bgcolor: roleSurfaceMuted, color: roleTextMuted, border: `1px solid ${roleBorder}` }} />
            <Chip size="small" label="Cmd/Ctrl+K: Kommando" sx={{ bgcolor: roleSurfaceMuted, color: roleTextMuted, border: `1px solid ${roleBorder}` }} />
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', xl: '320px minmax(0, 1fr) 360px' },
              gap: 2,
              minHeight: {
                xs: 'auto',
                lg: 'clamp(600px, 68vh, 840px)',
              },
            }}
          >
            <Box
              sx={{
                border: `1px solid ${roleBorder}`,
                borderRadius: 2,
                bgcolor: roleSurface,
                p: 1.5,
                display: 'flex',
                flexDirection: 'column',
                gap: 1.25,
                minHeight: { lg: 0 },
              }}
            >
              <Typography sx={{ color: roleText, fontWeight: 700, fontSize: '1.05rem' }}>
                Pipeline
              </Typography>
              <Stack spacing={0.75}>
                {pipelineCounts.map((pipelineItem) => (
                  <Button
                    key={pipelineItem.status}
                    size="small"
                    variant={proPipelineFilter === pipelineItem.status ? 'contained' : 'outlined'}
                    onClick={() => setProPipelineFilter((prev) => (prev === pipelineItem.status ? 'all' : pipelineItem.status))}
                    sx={{
                      justifyContent: 'space-between',
                      minHeight: 34,
                      borderColor: roleBorder,
                      color: proPipelineFilter === pipelineItem.status ? '#160a24' : roleTextMuted,
                      bgcolor: proPipelineFilter === pipelineItem.status ? roleTabAccent : 'transparent',
                    }}
                  >
                    <Box component="span">{pipelineItem.label}</Box>
                    <Chip size="small" label={pipelineItem.count} sx={{ height: 20 }} />
                  </Button>
                ))}
              </Stack>
              <Divider sx={{ borderColor: roleBorder, my: 0.5 }} />
              <Typography sx={{ color: roleText, fontWeight: 700, fontSize: '1.05rem' }}>
                Varsler
              </Typography>
              <Box sx={{ maxHeight: 180, overflowY: 'auto', pr: 0.5 }}>
                {proAlerts.length === 0 ? (
                  <Typography sx={{ color: roleTextMuted, fontSize: '0.85rem' }}>
                    Ingen aktive varsler.
                  </Typography>
                ) : (
                  <Stack spacing={0.75}>
                    {proAlerts.map((alert) => (
                      <Alert
                        key={alert.id}
                        severity={alert.severity}
                        sx={{
                          bgcolor: 'rgba(0,0,0,0.2)',
                          color: '#fff',
                          '& .MuiAlert-icon': { color: 'inherit' },
                        }}
                      >
                        {alert.text}
                      </Alert>
                    ))}
                  </Stack>
                )}
              </Box>
              <Divider sx={{ borderColor: roleBorder, my: 0.5 }} />
              <Typography sx={{ color: roleText, fontWeight: 700, fontSize: '1.05rem' }}>
                Rollepool
              </Typography>
              <TextField
                size="small"
                value={poolSearchQuery}
                onChange={(event) => setPoolSearchQuery(event.target.value)}
                placeholder="Søk i rollemaler..."
                slotProps={{
                  input: {
                    startAdornment: <SearchIcon sx={{ color: roleTextMuted, mr: 1, fontSize: 18 }} />,
                  },
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: roleText,
                    bgcolor: roleSurfaceMuted,
                    '& fieldset': { borderColor: roleBorder },
                    '&:hover fieldset': { borderColor: roleTabAccentSoft },
                    '&.Mui-focused fieldset': { borderColor: roleTabAccent },
                  },
                }}
              />
              <Box sx={{ overflowY: 'auto', flex: 1, minHeight: 0, pr: 0.5 }}>
                {poolLoading ? (
                  <Typography sx={{ color: roleTextMuted, py: 2 }}>Laster maler...</Typography>
                ) : filteredPoolRoles.length === 0 ? (
                  <Typography sx={{ color: roleTextMuted, py: 2 }}>Ingen treff i rollepool.</Typography>
                ) : (
                  <Stack spacing={1}>
                    {filteredPoolRoles.slice(0, 8).map((poolRole) => (
                      <Card
                        key={poolRole.id}
                        sx={{
                          bgcolor: roleSurfaceMuted,
                          border: `1px solid ${roleBorder}`,
                          borderRadius: 1.5,
                        }}
                      >
                        <CardContent sx={{ p: 1.1, '&:last-child': { pb: 1.1 } }}>
                          <Typography sx={{ color: roleText, fontWeight: 600, fontSize: '0.88rem' }} noWrap>
                            {poolRole.name}
                          </Typography>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.75 }}>
                            <Button size="small" onClick={() => handleImportFromPool(poolRole)} sx={{ color: roleTabAccent, minHeight: 32 }}>
                              Importer
                            </Button>
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteFromPool(poolRole)}
                              sx={{ color: roleTextMuted, minWidth: 32, minHeight: 32 }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                )}
              </Box>
            </Box>

            <Box
              sx={{
                border: `1px solid ${roleBorder}`,
                borderRadius: 2,
                bgcolor: roleSurface,
                p: 1.5,
                display: 'flex',
                flexDirection: 'column',
                gap: 1.25,
                minHeight: { lg: 0 },
              }}
            >
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.3fr 0.95fr auto' }, gap: 1 }}>
                <TextField
                  size="small"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Søk roller..."
                  slotProps={{
                    input: {
                      startAdornment: <SearchIcon sx={{ color: roleTextMuted, mr: 1, fontSize: 18 }} />,
                    },
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: roleText,
                      bgcolor: roleSurfaceMuted,
                      '& fieldset': { borderColor: roleBorder },
                      '&:hover fieldset': { borderColor: roleTabAccentSoft },
                      '&.Mui-focused fieldset': { borderColor: roleTabAccent },
                    },
                  }}
                />
                <FormControl size="small">
                  <Select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                    sx={{
                      color: roleText,
                      bgcolor: roleSurfaceMuted,
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: roleBorder },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: roleTabAccentSoft },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: roleTabAccent },
                    }}
                  >
                    <MenuItem value="all">Alle statuser</MenuItem>
                    {ROLE_WORKFLOW_ORDER.map((status) => (
                      <MenuItem key={status} value={status}>
                        {getRoleWorkflowMeta(status).label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Chip
                  label={`${proRoles.length} aktive`}
                  sx={{
                    color: roleTabAccent,
                    bgcolor: roleTabAccentSoft,
                    border: `1px solid ${roleBorder}`,
                    fontWeight: 700,
                  }}
                />
              </Box>
              <Box sx={{ overflowY: 'auto', flex: 1, minHeight: 0, pr: 0.5 }}>
                {proRoles.length === 0 ? (
                  <Typography sx={{ color: roleTextMuted, py: 2 }}>Ingen roller matcher pro-filteret.</Typography>
                ) : proListMode === 'table' ? (
                  <TableContainer component={Paper} sx={{ bgcolor: roleSurfaceMuted, border: `1px solid ${roleBorder}` }}>
                    <Table size="small" sx={{ minWidth: 560 }}>
                      <TableHead>
                        <TableRow>
                          <TableCell padding="checkbox" />
                          <TableCell sx={{ color: roleText }}>Rolle</TableCell>
                          <TableCell sx={{ color: roleText }}>Status</TableCell>
                          <TableCell sx={{ color: roleText }}>Risiko</TableCell>
                          <TableCell sx={{ color: roleText }}>Kandidater</TableCell>
                          <TableCell sx={{ color: roleText }}>Scener</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {proRoles.map((role) => {
                          const risk = roleRiskMap.get(role.id);
                          const riskColor = !risk ? roleTextMuted : risk.level === 'hoy' ? '#ef4444' : risk.level === 'medium' ? '#f59e0b' : '#22c55e';
                          const isSelected = selectedRoleId === role.id;
                          return (
                            <TableRow
                              key={role.id}
                              onClick={() => setSelectedRoleId(role.id)}
                              sx={{
                                cursor: 'pointer',
                                bgcolor: isSelected ? 'rgba(184,107,255,0.14)' : 'transparent',
                                '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
                              }}
                            >
                              <TableCell padding="checkbox">
                                <Checkbox
                                  checked={selectedIds.has(role.id)}
                                  onChange={(event) => {
                                    event.stopPropagation();
                                    handleToggleSelect(role.id);
                                  }}
                                  sx={{ color: roleTextMuted, '&.Mui-checked': { color: roleTabAccent } }}
                                />
                              </TableCell>
                              <TableCell sx={{ color: roleText, fontWeight: 600 }}>{role.name}</TableCell>
                              <TableCell>
                                <Chip label={getStatusLabel(role.status)} size="small" sx={{ bgcolor: `${getStatusColor(role.status)}20`, color: getStatusColor(role.status), fontWeight: 700 }} />
                              </TableCell>
                              <TableCell sx={{ color: riskColor, fontWeight: 700 }}>{risk?.score ?? '-'}</TableCell>
                              <TableCell sx={{ color: roleText }}>{getRoleCandidateCount(role)}</TableCell>
                              <TableCell sx={{ color: roleText }}>{getRoleSceneCount(role)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Stack spacing={1}>
                    {proRoles.map((role) => {
                      const risk = roleRiskMap.get(role.id);
                      const isSelected = selectedRoleId === role.id;
                      const riskColor = !risk ? roleTextMuted : risk.level === 'hoy' ? '#ef4444' : risk.level === 'medium' ? '#f59e0b' : '#22c55e';
                      return (
                        <Card
                          key={role.id}
                          onClick={() => setSelectedRoleId(role.id)}
                          sx={{
                            cursor: 'pointer',
                            bgcolor: isSelected ? 'rgba(184,107,255,0.18)' : roleSurfaceMuted,
                            border: isSelected ? `1px solid ${roleTabAccent}` : `1px solid ${roleBorder}`,
                            borderRadius: 1.5,
                            '&:hover': { borderColor: roleTabAccentSoft },
                          }}
                        >
                          <CardContent sx={{ p: 1.2, '&:last-child': { pb: 1.2 } }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Checkbox
                                checked={selectedIds.has(role.id)}
                                onChange={(event) => {
                                  event.stopPropagation();
                                  handleToggleSelect(role.id);
                                }}
                                sx={{ p: 0.25, color: roleTextMuted, '&.Mui-checked': { color: roleTabAccent } }}
                              />
                              <IconButton
                                size="small"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleFavorite(role.id);
                                }}
                                sx={{ color: favorites.has(role.id) ? '#ffc107' : 'rgba(255,255,255,0.3)', minWidth: 30, minHeight: 30 }}
                              >
                                {favorites.has(role.id) ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
                              </IconButton>
                              <Box sx={{ minWidth: 0, flex: 1 }}>
                                <Typography sx={{ color: roleText, fontWeight: 700 }} noWrap>
                                  {role.name}
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                                  <Chip label={getStatusLabel(role.status)} size="small" sx={{ bgcolor: `${getStatusColor(role.status)}22`, color: getStatusColor(role.status), fontWeight: 700, height: 22 }} />
                                  <Chip label={`${getRoleCandidateCount(role)} kandidater`} size="small" sx={{ height: 22 }} />
                                  <Chip label={`${getRoleSceneCount(role)} scener`} size="small" sx={{ height: 22 }} />
                                </Box>
                                {risk && (
                                  <Box sx={{ mt: 0.75 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                                      <Typography sx={{ color: roleTextMuted, fontSize: '0.72rem' }}>Risiko</Typography>
                                      <Typography sx={{ color: riskColor, fontSize: '0.72rem', fontWeight: 700 }}>{risk.score}</Typography>
                                    </Box>
                                    <LinearProgress
                                      variant="determinate"
                                      value={risk.score}
                                      sx={{
                                        height: 6,
                                        borderRadius: 999,
                                        bgcolor: 'rgba(255,255,255,0.1)',
                                        '& .MuiLinearProgress-bar': { bgcolor: riskColor },
                                      }}
                                    />
                                  </Box>
                                )}
                              </Box>
                            </Box>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </Stack>
                )}
              </Box>
            </Box>

            <Box
              sx={{
                border: `1px solid ${roleBorder}`,
                borderRadius: 2,
                bgcolor: roleSurface,
                p: 1.25,
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                minHeight: { lg: 0 },
              }}
            >
              {selectedProRole ? (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                    <Avatar sx={{ bgcolor: roleTabAccentSoft, color: roleTabAccent }}>
                      <PersonIcon />
                    </Avatar>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography sx={{ color: roleText, fontWeight: 800, fontSize: '1.05rem' }} noWrap>
                        {selectedProRole.name}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.4 }}>
                        <Chip label={getStatusLabel(selectedProRole.status)} size="small" sx={{ bgcolor: `${getStatusColor(selectedProRole.status)}20`, color: getStatusColor(selectedProRole.status), fontWeight: 700 }} />
                        {selectedProRoleRisk && (
                          <Chip
                            label={`Risiko ${selectedProRoleRisk.score}`}
                            size="small"
                            sx={{
                              bgcolor: selectedProRoleRisk.level === 'hoy' ? 'rgba(239,68,68,0.15)' : selectedProRoleRisk.level === 'medium' ? 'rgba(245,158,11,0.18)' : 'rgba(34,197,94,0.16)',
                              color: selectedProRoleRisk.level === 'hoy' ? '#ef4444' : selectedProRoleRisk.level === 'medium' ? '#f59e0b' : '#22c55e',
                              fontWeight: 700,
                            }}
                          />
                        )}
                      </Box>
                    </Box>
                  </Box>
                  <Tabs
                    value={proDetailTab}
                    onChange={(_, value) => setProDetailTab(value as ProDetailTab)}
                    variant="scrollable"
                    allowScrollButtonsMobile
                    sx={{
                      minHeight: 38,
                      '& .MuiTab-root': { minHeight: 38, color: roleTextMuted, textTransform: 'none', fontWeight: 600 },
                      '& .Mui-selected': { color: roleTabAccent },
                      '& .MuiTabs-indicator': { backgroundColor: roleTabAccent },
                    }}
                  >
                    <Tab value="oversikt" label="Oversikt" />
                    <Tab value="pipeline" label="Pipeline" />
                    <Tab value="sammenlign" label={`Sammenlign (${compareRoles.length})`} />
                    <Tab value="historikk" label="Historikk" />
                    <Tab value="handlinger" label="Handlinger" />
                  </Tabs>
                  <Box sx={{ overflowY: 'auto', flex: 1, minHeight: 0, pr: 0.5 }}>
                    {proDetailTab === 'oversikt' && (
                      <Stack spacing={1}>
                        <Typography sx={{ color: roleTextMuted, fontSize: '0.9rem' }}>
                          {selectedProRole.description || 'Ingen beskrivelse lagt inn.'}
                        </Typography>
                        <Box>
                          <Typography sx={{ color: roleText, fontWeight: 600, mb: 0.5 }}>Nøkkeldata</Typography>
                          <Stack spacing={0.6}>
                            <Typography sx={{ color: roleTextMuted, fontSize: '0.84rem' }}>
                              Kandidater: <Box component="span" sx={{ color: roleText, fontWeight: 700 }}>{getRoleCandidateCount(selectedProRole)}</Box>
                            </Typography>
                            <Typography sx={{ color: roleTextMuted, fontSize: '0.84rem' }}>
                              Scener: <Box component="span" sx={{ color: roleText, fontWeight: 700 }}>{getRoleSceneCount(selectedProRole)}</Box>
                            </Typography>
                            <Typography sx={{ color: roleTextMuted, fontSize: '0.84rem' }}>
                              Kjønn: <Box component="span" sx={{ color: roleText, fontWeight: 700 }}>{getRoleRequirements(selectedProRole).gender || 'Ikke satt'}</Box>
                            </Typography>
                            <Typography sx={{ color: roleTextMuted, fontSize: '0.84rem' }}>
                              Alder: <Box component="span" sx={{ color: roleText, fontWeight: 700 }}>
                                {getRoleRequirements(selectedProRole).age
                                  ? `${getRoleRequirements(selectedProRole).age?.min || '?'}-${getRoleRequirements(selectedProRole).age?.max || '?'}`
                                  : 'Ikke satt'}
                              </Box>
                            </Typography>
                          </Stack>
                        </Box>
                        <Box
                          sx={{
                            border: `1px solid ${roleBorder}`,
                            borderRadius: 1.5,
                            p: 1,
                            bgcolor: roleSurfaceMuted,
                          }}
                        >
                          <Typography sx={{ color: roleText, fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <AutoAwesomeIcon sx={{ fontSize: 16, color: roleTabAccent }} />
                            Neste anbefalte steg
                          </Typography>
                          <Typography sx={{ color: roleText, fontWeight: 600, mt: 0.5, fontSize: '0.9rem' }}>{recommendedAction.title}</Typography>
                          <Typography sx={{ color: roleTextMuted, fontSize: '0.82rem' }}>{recommendedAction.description}</Typography>
                          {recommendedAction.nextStatus && (
                            <Button
                              size="small"
                              variant="contained"
                              onClick={() => void handleTransitionStatus(selectedProRole, recommendedAction.nextStatus as RoleWorkflowStatus)}
                              sx={{ mt: 0.75, bgcolor: roleTabAccent, color: '#160a24', fontWeight: 700 }}
                            >
                              Sett til {getStatusLabel(recommendedAction.nextStatus)}
                            </Button>
                          )}
                        </Box>
                      </Stack>
                    )}
                    {proDetailTab === 'pipeline' && (
                      <Stack spacing={1}>
                        <Typography sx={{ color: roleText, fontWeight: 700, fontSize: '0.95rem' }}>
                          Tillatte overganger
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {getRoleWorkflowMeta(selectedProRole.status).allowedTransitions.length > 0 ? (
                            getRoleWorkflowMeta(selectedProRole.status).allowedTransitions.map((nextStatus) => (
                              <Button
                                key={nextStatus}
                                size="small"
                                variant="outlined"
                                onClick={() => void handleTransitionStatus(selectedProRole, nextStatus)}
                                sx={{ color: roleTabAccent, borderColor: roleBorder }}
                              >
                                {getStatusLabel(nextStatus)}
                              </Button>
                            ))
                          ) : (
                            <Typography sx={{ color: roleTextMuted, fontSize: '0.84rem' }}>Ingen videre overganger.</Typography>
                          )}
                        </Box>
                        <Divider sx={{ borderColor: roleBorder }} />
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => void handleUndoStatusTransition()}
                            disabled={transitionUndoStack.length === 0}
                            sx={{ color: roleText, borderColor: roleBorder }}
                          >
                            <UndoStatusIcon sx={{ fontSize: 16, mr: 0.5 }} />
                            Angre
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => void handleRedoStatusTransition()}
                            disabled={transitionRedoStack.length === 0}
                            sx={{ color: roleText, borderColor: roleBorder }}
                          >
                            <RedoStatusIcon sx={{ fontSize: 16, mr: 0.5 }} />
                            Gjenta
                          </Button>
                        </Box>
                      </Stack>
                    )}
                    {proDetailTab === 'sammenlign' && (
                      <Stack spacing={1}>
                        {compareRoles.length < 2 ? (
                          <Alert severity="info" sx={{ bgcolor: 'rgba(0,0,0,0.2)', color: '#fff' }}>
                            Velg minst to roller med avhuking for å sammenligne.
                          </Alert>
                        ) : (
                          compareRoles.map((role) => {
                            const risk = roleRiskMap.get(role.id);
                            const riskColor = !risk ? roleTextMuted : risk.level === 'hoy' ? '#ef4444' : risk.level === 'medium' ? '#f59e0b' : '#22c55e';
                            return (
                              <Card key={role.id} sx={{ bgcolor: roleSurfaceMuted, border: `1px solid ${roleBorder}` }}>
                                <CardContent sx={{ p: 1.1, '&:last-child': { pb: 1.1 } }}>
                                  <Typography sx={{ color: roleText, fontWeight: 700 }}>{role.name}</Typography>
                                  <Stack direction="row" spacing={0.75} sx={{ mt: 0.5, flexWrap: 'wrap' }}>
                                    <Chip label={getStatusLabel(role.status)} size="small" sx={{ bgcolor: `${getStatusColor(role.status)}20`, color: getStatusColor(role.status), fontWeight: 700 }} />
                                    <Chip label={`${getRoleCandidateCount(role)} kandidater`} size="small" />
                                    <Chip label={`${getRoleSceneCount(role)} scener`} size="small" />
                                    <Chip label={`Risiko ${risk?.score ?? '-'}`} size="small" sx={{ color: riskColor }} />
                                  </Stack>
                                </CardContent>
                              </Card>
                            );
                          })
                        )}
                      </Stack>
                    )}
                    {proDetailTab === 'historikk' && (
                      <Stack spacing={0.9}>
                        {selectedRoleTimeline.length === 0 ? (
                          <Typography sx={{ color: roleTextMuted, fontSize: '0.84rem' }}>Ingen historikk tilgjengelig.</Typography>
                        ) : (
                          selectedRoleTimeline.map((entry) => (
                            <Box
                              key={entry.id}
                              sx={{
                                border: `1px solid ${roleBorder}`,
                                borderRadius: 1.25,
                                p: 0.9,
                                bgcolor: roleSurfaceMuted,
                              }}
                            >
                              <Typography sx={{ color: roleText, fontWeight: 700, fontSize: '0.86rem' }}>{entry.label}</Typography>
                              <Typography sx={{ color: roleTextMuted, fontSize: '0.8rem' }}>{entry.description}</Typography>
                              <Typography sx={{ color: roleTextMuted, fontSize: '0.72rem', mt: 0.25 }}>
                                <ScheduleIcon sx={{ fontSize: 13, mr: 0.4, verticalAlign: 'middle' }} />
                                {new Date(entry.date).toLocaleString('nb-NO')}
                              </Typography>
                            </Box>
                          ))
                        )}
                      </Stack>
                    )}
                    {proDetailTab === 'handlinger' && (
                      <Stack spacing={1}>
                        <Button
                          variant="contained"
                          onClick={() => onEditRole(selectedProRole)}
                          sx={{ bgcolor: roleTabAccent, color: '#160a24', fontWeight: 700 }}
                        >
                          Rediger rolle
                        </Button>
                        <Button
                          variant="outlined"
                          onClick={() => void handleSaveToPool(selectedProRole)}
                          sx={{ color: roleTabAccent, borderColor: roleBorder }}
                        >
                          Lagre som mal
                        </Button>
                        <Button
                          variant="outlined"
                          onClick={() => void handleDuplicate(selectedProRole)}
                          sx={{ color: roleText, borderColor: roleBorder }}
                        >
                          Dupliser rolle
                        </Button>
                        <Button
                          variant="outlined"
                          onClick={() => void handleDeleteWithUndo(selectedProRole)}
                          sx={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.4)' }}
                        >
                          Slett rolle
                        </Button>
                        <Button
                          variant="outlined"
                          onClick={() => setQuickActionsOpen(true)}
                          sx={{ color: roleText, borderColor: roleBorder }}
                        >
                          <ChecklistIcon sx={{ fontSize: 16, mr: 0.5 }} />
                          Åpne hurtighandlinger
                        </Button>
                      </Stack>
                    )}
                  </Box>
                </>
              ) : (
                <Typography sx={{ color: roleTextMuted }}>Velg en rolle for detaljer.</Typography>
              )}
            </Box>
          </Box>

          <Dialog
            open={commandPaletteOpen}
            onClose={() => setCommandPaletteOpen(false)}
            fullWidth
            maxWidth="sm"
            PaperProps={{
              sx: {
                bgcolor: roleSurface,
                color: roleText,
                border: `1px solid ${roleBorder}`,
              },
            }}
          >
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CommandIcon sx={{ color: roleTabAccent }} />
              Kommando-palett
            </DialogTitle>
            <DialogContent dividers sx={{ borderColor: roleBorder }}>
              <Stack spacing={0.75}>
                {commandPaletteActions.map((action) => (
                  <Button
                    key={action.id}
                    onClick={action.run}
                    variant="outlined"
                    sx={{
                      justifyContent: 'space-between',
                      color: roleText,
                      borderColor: roleBorder,
                      textTransform: 'none',
                    }}
                  >
                    <Box component="span">{action.label}</Box>
                    {action.hint && (
                      <Chip size="small" label={action.hint} sx={{ height: 20 }} />
                    )}
                  </Button>
                ))}
              </Stack>
            </DialogContent>
            <DialogActions sx={{ borderTop: `1px solid ${roleBorder}` }}>
              <Button onClick={() => setCommandPaletteOpen(false)} sx={{ color: roleTextMuted }}>
                Lukk
              </Button>
            </DialogActions>
          </Dialog>

          <Dialog
            open={quickActionsOpen}
            onClose={() => setQuickActionsOpen(false)}
            fullWidth
            maxWidth="xs"
            PaperProps={{
              sx: {
                bgcolor: roleSurface,
                color: roleText,
                border: `1px solid ${roleBorder}`,
              },
            }}
          >
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TuneIcon sx={{ color: roleTabAccent }} />
              Hurtighandlinger
            </DialogTitle>
            <DialogContent dividers sx={{ borderColor: roleBorder }}>
              {!selectedProRole ? (
                <Typography sx={{ color: roleTextMuted }}>Velg en rolle først.</Typography>
              ) : (
                <Stack spacing={1}>
                  <Typography sx={{ color: roleTextMuted, fontSize: '0.8rem' }}>
                    Status-snarveier: <strong>1</strong> Utkast, <strong>2</strong> Åpen, <strong>3</strong> Casting, <strong>4</strong> Besatt, <strong>5</strong> Kansellert
                  </Typography>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setSelectedIds(new Set(proRoles.map((role) => role.id)));
                      setQuickActionsOpen(false);
                    }}
                    sx={{ justifyContent: 'flex-start', color: roleText, borderColor: roleBorder }}
                  >
                    Velg alle synlige roller
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setProDetailTab('pipeline');
                      setQuickActionsOpen(false);
                    }}
                    sx={{ justifyContent: 'flex-start', color: roleText, borderColor: roleBorder }}
                  >
                    Gå til pipeline-detaljer
                  </Button>
                  {getRoleWorkflowMeta(selectedProRole.status).allowedTransitions.map((nextStatus) => (
                    <Button
                      key={nextStatus}
                      variant="outlined"
                      onClick={() => {
                        void handleTransitionStatus(selectedProRole, nextStatus);
                        setQuickActionsOpen(false);
                      }}
                      sx={{ justifyContent: 'space-between', color: roleText, borderColor: roleBorder }}
                    >
                      <Box component="span">Sett status til {getStatusLabel(nextStatus)}</Box>
                      <Chip
                        size="small"
                        label={
                          nextStatus === 'draft' ? '1'
                            : nextStatus === 'open' ? '2'
                              : nextStatus === 'casting' ? '3'
                                : nextStatus === 'filled' ? '4'
                                  : '5'
                        }
                        sx={{ height: 20 }}
                      />
                    </Button>
                  ))}
                  <Button
                    variant="outlined"
                    onClick={() => {
                      void handleSaveToPool(selectedProRole);
                      setQuickActionsOpen(false);
                    }}
                    sx={{ justifyContent: 'flex-start', color: roleText, borderColor: roleBorder }}
                  >
                    Lagre valgt rolle som mal
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setProCompareMode(true);
                      setProDetailTab('sammenlign');
                      setQuickActionsOpen(false);
                    }}
                    sx={{ justifyContent: 'flex-start', color: roleText, borderColor: roleBorder }}
                  >
                    Start sammenligning
                  </Button>
                </Stack>
              )}
            </DialogContent>
            <DialogActions sx={{ borderTop: `1px solid ${roleBorder}` }}>
              <Button onClick={() => setQuickActionsOpen(false)} sx={{ color: roleTextMuted }}>
                Lukk
              </Button>
            </DialogActions>
          </Dialog>
        </>
      ) : (
        <>

      {/* Templates View */}
      {poolMode === 'pool' && (
        <Box sx={{ mb: 3 }}>
          {/* Guide Box */}
          <Box
            sx={{
              mb: 3,
              p: 2,
              bgcolor: 'rgba(184,107,255,0.11)',
              borderRadius: 2,
              border: '1px solid rgba(184,107,255,0.24)',
            }}
          >
            <Typography variant="subtitle1" sx={{ color: roleTabAccent, fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <InventoryIcon sx={{ fontSize: 20 }} />
              Slik bruker du rollemaler
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mb: 1 }}>
              Maler lar deg lagre rollebeskrivelser for gjenbruk i fremtidige prosjekter.
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.5, color: 'rgba(255,255,255,0.87)', '& li': { mb: 0.5, fontSize: '0.875rem' } }}>
              <li><strong>Lagre som mal:</strong> Klikk på lagre-til-pool-ikonet på en prosjektrolle</li>
              <li><strong>Importer:</strong> Klikk "Importer" for å kopiere malen til prosjektet</li>
              <li><strong>Slett:</strong> Fjern maler du ikke trenger lenger</li>
            </Box>
          </Box>

          <Box
            sx={{
              mb: 2,
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 1.25,
              alignItems: { xs: 'stretch', sm: 'center' },
            }}
          >
            <TextField
              size="small"
              value={poolSearchQuery}
              onChange={(event) => setPoolSearchQuery(event.target.value)}
              placeholder="Søk i rollemaler..."
              slotProps={{
                input: {
                  startAdornment: <SearchIcon sx={{ color: roleTextMuted, mr: 1, fontSize: 18 }} />,
                },
              }}
              sx={{
                flex: 1,
                '& .MuiOutlinedInput-root': {
                  color: roleText,
                  bgcolor: roleSurfaceMuted,
                  '& fieldset': { borderColor: roleBorder },
                  '&:hover fieldset': { borderColor: roleTabAccentSoft },
                  '&.Mui-focused fieldset': { borderColor: roleTabAccent },
                },
              }}
            />
            <Chip
              label={`${filteredPoolRoles.length}/${poolRoles.length} maler`}
              sx={{
                alignSelf: { xs: 'flex-start', sm: 'center' },
                color: roleTabAccent,
                bgcolor: roleTabAccentSoft,
                border: `1px solid ${roleBorder}`,
                fontWeight: 600,
              }}
            />
          </Box>
          
          {poolLoading ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography sx={{ color: roleTextMuted }}>Laster maler...</Typography>
            </Box>
          ) : filteredPoolRoles.length === 0 ? (
            <Box sx={{ 
              textAlign: 'center', 
              py: 6, 
              bgcolor: roleSurfaceMuted,
              borderRadius: 2,
              border: `1px dashed ${roleBorder}`,
            }}>
              <TheaterComedyIcon sx={{ fontSize: 48, color: 'rgba(255,255,255,0.2)', mb: 2 }} />
              <Typography sx={{ color: roleText, mb: 1 }}>
                {poolSearchQuery ? 'Ingen rollemaler matcher søket' : 'Ingen rollemaler ennå'}
              </Typography>
              <Typography variant="body2" sx={{ color: roleTextMuted }}>
                {poolSearchQuery
                  ? 'Prøv et annet søkeord eller fjern søket.'
                  : 'Klikk på lagre-til-pool-ikonet på prosjektroller for å lagre som mal'}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ 
              display: 'grid', 
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' },
              gap: 2,
            }}>
              {filteredPoolRoles.map((poolRole) => (
                <Card 
                  key={poolRole.id} 
                  sx={{ 
                    bgcolor: roleSurface,
                    border: `1px solid ${roleBorder}`,
                    borderRadius: 2,
                    transition: 'all 0.2s',
                    '&:hover': {
                      bgcolor: 'rgba(41,30,86,0.86)',
                      borderColor: roleTabAccentSoft,
                      transform: 'translateY(-1px)',
                      boxShadow: '0 8px 18px rgba(0,0,0,0.24)',
                    },
                  }}
                >
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <TheaterComedyIcon sx={{ color: roleTabAccent, fontSize: 20 }} />
                      <Typography sx={{ color: roleText, fontWeight: 600, fontSize: '0.95rem' }}>
                        {poolRole.name}
                      </Typography>
                    </Box>
                    
                    {poolRole.roleType && (
                      <Chip
                        label={poolRole.roleType}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.7rem',
                          mb: 1,
                          bgcolor: roleTabAccentSoft,
                          color: roleTabAccent,
                        }}
                      />
                    )}
                    
                    {poolRole.description && (
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          color: roleTextMuted,
                          fontSize: '0.8rem',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          mb: 1.5,
                        }}
                      >
                        {poolRole.description}
                      </Typography>
                    )}
                    
                    <Box sx={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      pt: 1,
                      borderTop: `1px solid ${roleBorder}`,
                    }}>
                      <Button
                        size="small"
                        onClick={() => handleImportFromPool(poolRole)}
                        sx={{
                          color: roleTabAccent,
                          fontSize: '0.75rem',
                          minHeight: TOUCH_TARGET_SIZE,
                          '&:hover': { bgcolor: roleTabAccentSoft },
                        }}
                      >
                        Importer
                      </Button>
                      
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteFromPool(poolRole)}
                        sx={{
                          color: roleTextMuted,
                          minWidth: TOUCH_TARGET_SIZE,
                          minHeight: TOUCH_TARGET_SIZE,
                          '&:hover': { 
                            color: '#ef4444',
                            bgcolor: 'rgba(239,68,68,0.1)',
                          },
                        }}
                      >
                        <DeleteIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}
        </Box>
      )}

      {/* Statistics Panel - Collapsible (only in project mode) */}
      <Collapse in={showStats && poolMode === 'project'}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(5, 1fr)' },
            gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
            mb: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
            p: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
            bgcolor: roleSurfaceMuted,
            borderRadius: 2,
            border: `1px solid ${roleBorder}`,
          }}
          role="region"
          aria-label="Statistikk over roller"
        >
          <Box sx={statTileSx}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <TheaterComedyIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: '#b86bff' }} />
            </Box>
            <Typography variant="h4" sx={{ color: '#b86bff', fontWeight: 700, fontSize: { xs: '1.5rem', sm: '2rem', md: '1.6rem', lg: '1.85rem', xl: '2.5rem' } }}>
              {stats.total}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' } }}>Totalt</Typography>
          </Box>
          <Box sx={statTileSx}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <TheaterComedyIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: '#b86bff' }} />
            </Box>
            <Typography variant="h4" sx={{ color: '#b86bff', fontWeight: 700, fontSize: { xs: '1.5rem', sm: '2rem', md: '1.6rem', lg: '1.85rem', xl: '2.5rem' } }}>
              {stats.open}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' } }}>Åpne</Typography>
          </Box>
          <Box sx={statTileSx}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <TheaterComedyIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: '#ffb800' }} />
            </Box>
            <Typography variant="h4" sx={{ color: '#ffb800', fontWeight: 700, fontSize: { xs: '1.5rem', sm: '2rem', md: '1.6rem', lg: '1.85rem', xl: '2.5rem' } }}>
              {stats.casting}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' } }}>Casting</Typography>
          </Box>
          <Box sx={statTileSx}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <TheaterComedyIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: '#10b981' }} />
            </Box>
            <Typography variant="h4" sx={{ color: '#10b981', fontWeight: 700, fontSize: { xs: '1.5rem', sm: '2rem', md: '1.6rem', lg: '1.85rem', xl: '2.5rem' } }}>
              {stats.filled}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' } }}>Besatt</Typography>
          </Box>
          <Box sx={statTileSx}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <StarIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: '#ffc107' }} />
            </Box>
            <Typography variant="h4" sx={{ color: '#ffc107', fontWeight: 700, fontSize: { xs: '1.5rem', sm: '2rem', md: '1.6rem', lg: '1.85rem', xl: '2.5rem' } }}>
              {stats.favorites}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' } }}>Favoritter</Typography>
          </Box>
        </Box>
      </Collapse>

      {/* Search and Filter Controls - Responsive (only in project mode) */}
      {poolMode === 'project' && (
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 1, sm: 2 },
          mb: 2,
          alignItems: { xs: 'stretch', sm: 'center' },
          px: { xs: 1.25, sm: 1.5 },
          py: { xs: 1, sm: 1.25 },
          border: `1px solid ${roleBorder}`,
          borderRadius: 2,
          bgcolor: roleSurface,
        }}
      >
        <TextField
          placeholder={isMobile ? 'Søk...' : 'Søk på rollenavn, beskrivelse, ferdigheter...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          size="small"
          slotProps={{
            input: {
              startAdornment: <SearchIcon sx={{ color: roleTextMuted, mr: 1, fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />,
              sx: { minHeight: TOUCH_TARGET_SIZE },
            },
            htmlInput: { 'aria-label': 'Søk i roller' },
          }}
          sx={{
            flex: 1,
            '& .MuiOutlinedInput-root': {
              color: roleText,
              fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.88rem', xl: '1rem' },
              height: { xs: 36, sm: 40, md: 42, lg: 48, xl: 60 },
              bgcolor: roleSurfaceMuted,
              '& fieldset': { borderColor: roleBorder },
              '&:hover fieldset': { borderColor: roleTabAccentSoft },
              '&.Mui-focused fieldset': { borderColor: roleTabAccent },
            },
          }}
        />

        <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 140, md: 135, lg: 150, xl: 180 } }}>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            aria-label="Filtrer etter status"
            sx={{
              color: roleText,
              minHeight: TOUCH_TARGET_SIZE,
              fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.88rem', xl: '1rem' },
              height: { xs: 36, sm: 40, md: 42, lg: 48, xl: 60 },
              bgcolor: roleSurfaceMuted,
              '& .MuiOutlinedInput-notchedOutline': { borderColor: roleBorder },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: roleTabAccentSoft },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: roleTabAccent },
            }}
          >
            <MenuItem value="all">Alle statuser</MenuItem>
            {ROLE_WORKFLOW_ORDER.map((status) => (
              <MenuItem key={status} value={status}>
                {getRoleWorkflowMeta(status).label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between' }}>
          <Tooltip title="Kortvisning">
            <Button
              variant={viewMode === 'grid' ? 'contained' : 'outlined'}
              onClick={() => setViewMode('grid')}
              aria-pressed={viewMode === 'grid'}
              sx={{
                minHeight: TOUCH_TARGET_SIZE,
                minWidth: TOUCH_TARGET_SIZE,
                bgcolor: viewMode === 'grid' ? 'rgba(184,107,255,0.26)' : 'transparent',
                color: viewMode === 'grid' ? '#b86bff' : 'rgba(255,255,255,0.7)',
                borderColor: viewMode === 'grid' ? '#b86bff' : 'rgba(255,255,255,0.2)',
                ...focusVisibleStyles,
              }}
            >
              <GridViewIcon />
            </Button>
          </Tooltip>

          <Tooltip title="Tabellvisning">
            <Button
              variant={viewMode === 'table' ? 'contained' : 'outlined'}
              onClick={() => setViewMode('table')}
              aria-pressed={viewMode === 'table'}
              sx={{
                minHeight: TOUCH_TARGET_SIZE,
                minWidth: TOUCH_TARGET_SIZE,
                bgcolor: viewMode === 'table' ? 'rgba(184,107,255,0.26)' : 'transparent',
                color: viewMode === 'table' ? '#b86bff' : 'rgba(255,255,255,0.7)',
                borderColor: viewMode === 'table' ? '#b86bff' : 'rgba(255,255,255,0.2)',
                fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                ...focusVisibleStyles,
              }}
            >
              <TableViewIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />
            </Button>
          </Tooltip>

          {selectedIds.size > 0 && (
            <Tooltip title={`Slett ${selectedIds.size} valgte`}>
              <Button
                variant="contained"
                onClick={handleBulkDelete}
                sx={{
                  bgcolor: '#ff4444',
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                  minHeight: TOUCH_TARGET_SIZE,
                  px: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                  py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
                  ...focusVisibleStyles,
                  '&:hover': { bgcolor: '#cc0000' },
                }}
              >
                <DeleteIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />
                <Box component="span" sx={{ ml: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 } }}>{selectedIds.size}</Box>
              </Button>
            </Tooltip>
          )}
        </Box>
      </Box>
      )}

      {/* Results count (only in project mode) */}
      {poolMode === 'project' && (searchQuery || statusFilter !== 'all') && (
        <Alert
          severity="info"
          sx={{
            mb: 2,
            bgcolor: 'rgba(184,107,255,0.14)',
            color: '#fff',
            '& .MuiAlert-icon': { color: '#b86bff' },
          }}
        >
          Viser {filteredAndSortedRoles.length} av {roles.length} roller
        </Alert>
      )}

      {/* Empty state and role list (only in project mode) */}
      {poolMode === 'project' && (
        roles.length === 0 ? (
        <RoleRoomEmptyState
          iconSrc={castingDirectorPng}
          title="Kom i gang med casting"
          subtitle="Definer rollene du trenger for produksjonen din, og start å legge til kandidater."
          color="#b86bff"
          buttonLabel="Opprett din første rolle"
          onAction={onCreateRole}
        />
      ) : filteredAndSortedRoles.length === 0 ? (
        <Box role="status" sx={{ textAlign: 'center', py: { xs: 4, sm: 6, md: 5, lg: 6, xl: 8 }, color: 'rgba(255,255,255,0.87)' }}>
          <SearchIcon sx={{ fontSize: { xs: 40, sm: 48, md: 44, lg: 52, xl: 60 }, mb: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 }, opacity: 0.3 }} />
          <Typography variant="body1" sx={{ fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>Ingen treff på søket</Typography>
        </Box>
      ) : viewMode === 'table' ? (
        /* Table View */
        <TableContainer
          component={Paper}
          sx={{
            bgcolor: roleSurface,
            border: '1px solid rgba(184,107,255,0.24)',
            borderRadius: 2,
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <Table aria-label="Roller tabell" sx={{ minWidth: { xs: 600, sm: 700, md: 750, lg: 850, xl: 1100 } }}>
            <TableHead>
              <TableRow sx={{ bgcolor: 'rgba(255,255,255,0.05)' }}>
                <TableCell padding="checkbox" sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                  <Checkbox
                    checked={selectedIds.size === filteredAndSortedRoles.length && filteredAndSortedRoles.length > 0}
                    indeterminate={selectedIds.size > 0 && selectedIds.size < filteredAndSortedRoles.length}
                    onChange={handleSelectAll}
                    aria-label="Velg alle roller"
                    sx={{ color: 'rgba(255,255,255,0.87)', '&.Mui-checked': { color: '#b86bff' } }}
                  />
                </TableCell>
                <TableCell sx={{ color: '#fff', fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.88rem', xl: '1rem' }, py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>Favoritt</TableCell>
                <TableCell sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.88rem', xl: '1rem' }, py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                  <TableSortLabel
                    active={sortField === 'name'}
                    direction={sortField === 'name' ? sortDirection : 'asc'}
                    onClick={() => handleSort('name')}
                    sx={{ color: '#fff', '&:hover': { color: '#b86bff' } }}
                  >
                    Navn
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.88rem', xl: '1rem' }, py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                  <TableSortLabel
                    active={sortField === 'status'}
                    direction={sortField === 'status' ? sortDirection : 'asc'}
                    onClick={() => handleSort('status')}
                    sx={{ color: '#fff', '&:hover': { color: '#b86bff' } }}
                  >
                    Status
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.88rem', xl: '1rem' }, py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>Alder</TableCell>
                <TableCell sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.88rem', xl: '1rem' }, py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                  <TableSortLabel
                    active={sortField === 'candidates'}
                    direction={sortField === 'candidates' ? sortDirection : 'asc'}
                    onClick={() => handleSort('candidates')}
                    sx={{ color: '#fff', '&:hover': { color: '#b86bff' } }}
                  >
                    Kandidater
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.88rem', xl: '1rem' }, py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                  <TableSortLabel
                    active={sortField === 'scenes'}
                    direction={sortField === 'scenes' ? sortDirection : 'asc'}
                    onClick={() => handleSort('scenes')}
                    sx={{ color: '#fff', '&:hover': { color: '#b86bff' } }}
                  >
                    Scener
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.88rem', xl: '1rem' }, py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>Handlinger</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredAndSortedRoles.map((role) => (
                <TableRow
                  key={role.id}
                  sx={{
                    bgcolor: selectedIds.has(role.id) ? 'rgba(184,107,255,0.14)' : 'transparent',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                  }}
                >
                  <TableCell padding="checkbox" sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                    <Checkbox
                      checked={selectedIds.has(role.id)}
                      onChange={() => handleToggleSelect(role.id)}
                      sx={{ color: 'rgba(255,255,255,0.87)', '&.Mui-checked': { color: '#b86bff' } }}
                    />
                  </TableCell>
                  <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                    <IconButton onClick={() => toggleFavorite(role.id)} sx={{ color: favorites.has(role.id) ? '#ffc107' : 'rgba(255,255,255,0.3)', minWidth: TOUCH_TARGET_SIZE, minHeight: TOUCH_TARGET_SIZE }}>
                      {favorites.has(role.id) ? <StarIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} /> : <StarBorderIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
                    </IconButton>
                  </TableCell>
                  <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                    <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.88rem', xl: '1rem' } }}>{role.name}</Typography>
                  </TableCell>
                  <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                    <Chip
                      label={getStatusLabel(role.status)}
                      size="small"
                      sx={{ bgcolor: `${getStatusColor(role.status)}20`, color: getStatusColor(role.status), fontWeight: 600, fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' }, height: { xs: 22, sm: 24, md: 23, lg: 26, xl: 30 } }}
                    />
                  </TableCell>
                  <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' } }}>
                      {role.requirements.age ? `${role.requirements.age.min || '?'} - ${role.requirements.age.max || '?'}` : '-'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                    <Chip label={role.candidateIds?.length || 0} size="small" sx={{ bgcolor: 'rgba(184,107,255,0.26)', color: '#b86bff', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' }, height: { xs: 22, sm: 24, md: 23, lg: 26, xl: 30 } }} />
                  </TableCell>
                  <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                    <Chip label={role.sceneIds?.length || 0} size="small" sx={{ bgcolor: 'rgba(106,76,207,0.24)', color: '#cfa77d', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' }, height: { xs: 22, sm: 24, md: 23, lg: 26, xl: 30 } }} />
                  </TableCell>
                  <TableCell align="right" sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 } }}>
                      <Tooltip title="Lagre til pool">
                        <IconButton onClick={() => handleSaveToPool(role)} sx={{ color: '#b7794d', minWidth: TOUCH_TARGET_SIZE, minHeight: TOUCH_TARGET_SIZE }}>
                          <InventoryIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Dupliser">
                        <IconButton onClick={() => handleDuplicate(role)} sx={{ color: 'rgba(255,255,255,0.87)', minWidth: TOUCH_TARGET_SIZE, minHeight: TOUCH_TARGET_SIZE }}>
                          <DuplicateIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Rediger">
                        <IconButton onClick={() => onEditRole(role)} sx={{ color: '#b86bff', minWidth: TOUCH_TARGET_SIZE, minHeight: TOUCH_TARGET_SIZE }}>
                          <EditIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Slett">
                        <IconButton onClick={() => handleDeleteWithUndo(role)} sx={{ color: '#ff4444', minWidth: TOUCH_TARGET_SIZE, minHeight: TOUCH_TARGET_SIZE }}>
                          <DeleteIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        /* Grid View - Enhanced cards matching ProductionDayView */
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              xl: 'repeat(3, minmax(0, 1fr))',
            },
            gap: { xs: 2.5, sm: 3, md: 3.25, lg: 3.5, xl: 4 },
            alignItems: 'stretch',
          }}
        >
          {filteredAndSortedRoles.map((role) => {
            const statusColor = getStatusColor(role.status);
            const statusLabel = getStatusLabel(role.status);

            return (
              <Box key={role.id}>
                <Card
                  component="article"
                  sx={{
                    bgcolor: selectedIds.has(role.id) ? 'rgba(184,107,255,0.18)' : 'rgba(255,255,255,0.05)',
                    border: selectedIds.has(role.id) ? '2px solid #b86bff' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 2,
                    transition: 'all 0.2s ease',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    '&:hover': {
                      bgcolor: 'rgba(255,255,255,0.08)',
                      borderColor: '#b86bff',
                      boxShadow: '0 8px 24px rgba(184,107,255,0.24)',
                      transform: 'translateY(-2px)',
                    },
                    ...focusVisibleStyles,
                  }}
                >
                  <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 2.25, lg: 2.75, xl: 3 }, flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {/* Card Header with gradient */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Checkbox
                          checked={selectedIds.has(role.id)}
                          onChange={() => handleToggleSelect(role.id)}
                          sx={{ p: 0.5, color: 'rgba(255,255,255,0.87)', '&.Mui-checked': { color: '#b86bff' } }}
                        />
                        <Box sx={{ flex: 1 }}>
                          {/* Eye-catching Role Header */}
                          <Box
                            sx={{
                              position: 'relative',
                              display: 'flex',
                              alignItems: 'center',
                              gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                              mb: { xs: 1.25, sm: 1.5, md: 1.375, lg: 1.5, xl: 1.75 },
                              p: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                              borderRadius: 2.5,
                              background: 'linear-gradient(135deg, rgba(184,107,255,0.3) 0%, rgba(75,55,157,0.24) 100%)',
                              border: '2px solid rgba(184,107,255,0.42)',
                              boxShadow: '0 4px 12px rgba(184,107,255,0.24), inset 0 1px 0 rgba(255,255,255,0.1)',
                              overflow: 'hidden',
                              '&::before': {
                                content: '""',
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                height: '3px',
                                background: 'linear-gradient(90deg, #b86bff 0%, #6a4ccf 50%, #b86bff 100%)',
                              },
                            }}
                          >
                            {/* Role Icon */}
                            <Box
                              sx={{
                                position: 'relative',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minWidth: { xs: 50, sm: 60, md: 55, lg: 65, xl: 75 },
                                height: { xs: 50, sm: 60, md: 55, lg: 65, xl: 75 },
                                borderRadius: 2,
                                background: 'linear-gradient(135deg, #b86bff 0%, #5d43bf 100%)',
                                border: '2px solid rgba(255,255,255,0.3)',
                                boxShadow: '0 4px 12px rgba(184,107,255,0.42)',
                              }}
                            >
                              <TheaterComedyIcon sx={{
                                fontSize: { xs: 26, sm: 32, md: 30, lg: 36, xl: 42 },
                                color: '#fff',
                                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
                              }} />
                            </Box>

                            {/* Role Name */}
                            <Box sx={{ flex: 1, zIndex: 1 }}>
                              <Typography
                                variant="h6"
                                component="h3"
                                sx={{
                                  color: '#fff',
                                  fontWeight: 700,
                                  fontSize: { xs: '1rem', sm: '1.125rem', md: '1.05rem', lg: '1.15rem', xl: '1.25rem' },
                                  lineHeight: 1.2,
                                  mb: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 },
                                  textShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                }}
                              >
                                {role.name}
                              </Typography>
                              <Chip
                                label={statusLabel}
                                size="small"
                                sx={{
                                  bgcolor: `${statusColor}30`,
                                  color: statusColor,
                                  fontWeight: 700,
                                  fontSize: { xs: '10px', sm: '11px', md: '10.5px', lg: '12px', xl: '14px' },
                                  height: { xs: 22, sm: 24, md: 23, lg: 26, xl: 30 },
                                  border: `1px solid ${statusColor}50`,
                                }}
                              />
                            </Box>
                          </Box>
                        </Box>
                      </Box>
                      <IconButton
                        onClick={() => toggleFavorite(role.id)}
                        aria-label={favorites.has(role.id) ? 'Fjern fra favoritter' : 'Legg til favoritter'}
                        sx={{
                          minWidth: TOUCH_TARGET_SIZE,
                          minHeight: TOUCH_TARGET_SIZE,
                          color: favorites.has(role.id) ? '#ffc107' : 'rgba(255,255,255,0.3)',
                          ...focusVisibleStyles,
                        }}
                      >
                        {favorites.has(role.id) ? <StarIcon sx={{ fontSize: { xs: 20, sm: 24, md: 22, lg: 26, xl: 32 } }} /> : <StarBorderIcon sx={{ fontSize: { xs: 20, sm: 24, md: 22, lg: 26, xl: 32 } }} />}
                      </IconButton>
                    </Box>

                    {/* Info Cards - Enhanced with icons */}
                    <Stack spacing={{ xs: 1.25, sm: 1.5, md: 1.375, lg: 1.75, xl: 2 }} sx={{ mb: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 } }}>
                      {role.description && (
                        <Box
                          sx={{
                            p: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                            borderRadius: 2,
                            bgcolor: 'rgba(184,107,255,0.11)',
                            border: '1px solid rgba(184,107,255,0.24)',
                          }}
                        >
                          <Typography
                            variant="body2"
                            sx={{
                              color: 'rgba(255,255,255,0.8)',
                              fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.9rem', xl: '1rem' },
                              display: '-webkit-box',
                              WebkitLineClamp: expandedCards.has(role.id) ? 'unset' : 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {role.description}
                          </Typography>
                        </Box>
                      )}

                      {/* Age Info Card */}
                      {role.requirements.age && (
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                            p: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                            borderRadius: 2,
                            bgcolor: 'rgba(184,107,255,0.16)',
                            border: '1px solid rgba(184,107,255,0.30)',
                          }}
                        >
                          <Box
                            sx={{
                              width: { xs: 40, sm: 48, md: 44, lg: 52, xl: 60 },
                              height: { xs: 40, sm: 48, md: 44, lg: 52, xl: 60 },
                              borderRadius: 1.5,
                              bgcolor: 'rgba(184,107,255,0.30)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <PersonIcon sx={{ fontSize: { xs: 22, sm: 26, md: 24, lg: 28, xl: 34 }, color: '#b86bff' }} />
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            <Typography
                              sx={{
                                color: 'rgba(255,255,255,0.87)',
                                fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' },
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                              }}
                            >
                              Alderskrav
                            </Typography>
                            <Typography
                              sx={{
                                color: '#fff',
                                fontSize: { xs: '0.95rem', sm: '1.1rem', md: '1.05rem', lg: '1.15rem', xl: '1.3rem' },
                                fontWeight: 700,
                              }}
                            >
                              {role.requirements.age.min || '?'} - {role.requirements.age.max || '?'} år
                            </Typography>
                          </Box>
                        </Box>
                      )}

                      {/* Candidates Info Card */}
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                          p: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                          borderRadius: 2,
                          bgcolor: 'rgba(139,92,246,0.1)',
                          border: '1px solid rgba(139,92,246,0.25)',
                        }}
                      >
                        <Box
                          sx={{
                            width: { xs: 40, sm: 48, md: 44, lg: 52, xl: 60 },
                            height: { xs: 40, sm: 48, md: 44, lg: 52, xl: 60 },
                            borderRadius: 1.5,
                            bgcolor: 'rgba(139,92,246,0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <PeopleIcon sx={{ fontSize: { xs: 22, sm: 26, md: 24, lg: 28, xl: 34 }, color: '#c89f74' }} />
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography
                            sx={{
                              color: 'rgba(255,255,255,0.87)',
                              fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' },
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                            }}
                          >
                            Kandidater
                          </Typography>
                          <Typography
                            sx={{
                              color: '#fff',
                              fontSize: { xs: '0.95rem', sm: '1.1rem', md: '1.05rem', lg: '1.15rem', xl: '1.3rem' },
                              fontWeight: 700,
                            }}
                          >
                            {role.candidateIds?.length || 0} påmeldt
                          </Typography>
                        </Box>
                      </Box>
                    </Stack>

                    {/* Expandable content */}
                    <Collapse in={expandedCards.has(role.id)}>
                      <Box sx={{ mt: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 } }}>
                        {role.requirements.skills && role.requirements.skills.length > 0 && (
                          <Box sx={{ mb: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 } }}>
                            <Typography
                              variant="subtitle2"
                              sx={{
                                color: '#e5c29c',
                                fontWeight: 700,
                                mb: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
                                fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.77rem', lg: '0.85rem', xl: '0.95rem' },
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                              }}
                            >
                              Ferdigheter
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 } }}>
                              {role.requirements.skills.map((skill, idx) => (
                                <Chip
                                  key={idx}
                                  label={skill}
                                  size="small"
                                  sx={{
                                    bgcolor: 'rgba(184,107,255,0.22)',
                                    color: '#e5c29c',
                                    fontSize: { xs: '10px', sm: '11px', md: '10.5px', lg: '12px', xl: '14px' },
                                    height: { xs: 24, sm: 26, md: 25, lg: 28, xl: 32 },
                                    fontWeight: 600,
                                    border: '1px solid rgba(184,107,255,0.36)',
                                  }}
                                />
                              ))}
                            </Box>
                          </Box>
                        )}
                        {role.sceneIds && role.sceneIds.length > 0 && (
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                              p: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                              borderRadius: 2,
                              bgcolor: 'rgba(139,92,246,0.08)',
                              border: '1px solid rgba(139,92,246,0.2)',
                            }}
                          >
                            <Box
                              sx={{
                                width: { xs: 40, sm: 48, md: 44, lg: 52, xl: 60 },
                                height: { xs: 40, sm: 48, md: 44, lg: 52, xl: 60 },
                                borderRadius: 1.5,
                                bgcolor: 'rgba(139,92,246,0.25)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <MovieIcon sx={{ fontSize: { xs: 22, sm: 26, md: 24, lg: 28, xl: 34 }, color: '#c89f74' }} />
                            </Box>
                            <Box sx={{ flex: 1 }}>
                              <Typography
                                sx={{
                                  color: 'rgba(255,255,255,0.87)',
                                  fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' },
                                  fontWeight: 600,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.5px',
                                }}
                              >
                                Tilknyttede scener
                              </Typography>
                              <Typography
                                sx={{
                                  color: '#fff',
                                  fontSize: { xs: '0.95rem', sm: '1.1rem', md: '1.05rem', lg: '1.15rem', xl: '1.3rem' },
                                  fontWeight: 700,
                                }}
                              >
                                {role.sceneIds.length} scene{role.sceneIds.length !== 1 ? 'r' : ''}
                              </Typography>
                            </Box>
                          </Box>
                        )}
                      </Box>
                    </Collapse>

                    {/* Card Actions - Enhanced */}
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        pt: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
                        mt: 'auto',
                        borderTop: '2px solid rgba(184,107,255,0.24)',
                      }}
                    >
                      <Button
                        variant="contained"
                        size="medium"
                        onClick={() => toggleCardExpanded(role.id)}
                        endIcon={expandedCards.has(role.id) ? <CollapseIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} /> : <ExpandIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
                        sx={{
                          bgcolor: expandedCards.has(role.id)
                            ? 'rgba(184,107,255,0.30)'
                            : 'rgba(184,107,255,0.18)',
                          color: expandedCards.has(role.id) ? '#b86bff' : '#fff',
                          fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.9rem', xl: '1rem' },
                          fontWeight: 600,
                          minHeight: TOUCH_TARGET_SIZE,
                          px: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
                          py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
                          border: expandedCards.has(role.id)
                            ? '2px solid rgba(184,107,255,0.52)'
                            : '2px solid rgba(184,107,255,0.34)',
                          borderRadius: 2,
                          textTransform: 'none',
                          boxShadow: expandedCards.has(role.id)
                            ? '0 4px 12px rgba(184,107,255,0.34)'
                            : '0 2px 8px rgba(184,107,255,0.24)',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            bgcolor: 'rgba(184,107,255,0.38)',
                            borderColor: 'rgba(184,107,255,0.62)',
                            transform: 'translateY(-1px)',
                            boxShadow: '0 6px 16px rgba(184,107,255,0.42)',
                          },
                          ...focusVisibleStyles,
                        }}
                      >
                        {expandedCards.has(role.id) ? 'Skjul detaljer' : 'Vis detaljer'}
                      </Button>
                      <Box sx={{ display: 'flex', gap: { xs: 0.5, sm: 1, md: 0.875, lg: 1, xl: 1.25 } }}>
                        <Tooltip title="Lagre til pool">
                          <IconButton
                            onClick={() => handleSaveToPool(role)}
                            sx={{
                              minWidth: TOUCH_TARGET_SIZE,
                              minHeight: TOUCH_TARGET_SIZE,
                              color: '#b7794d',
                              '&:hover': { bgcolor: 'rgba(156, 39, 176, 0.1)' },
                              ...focusVisibleStyles,
                            }}
                          >
                            <InventoryIcon sx={{ fontSize: { xs: 20, sm: 22, md: 21, lg: 24, xl: 28 } }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Dupliser">
                          <IconButton
                            onClick={() => handleDuplicate(role)}
                            sx={{
                              minWidth: TOUCH_TARGET_SIZE,
                              minHeight: TOUCH_TARGET_SIZE,
                              color: 'rgba(255,255,255,0.87)',
                              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                              ...focusVisibleStyles,
                            }}
                          >
                            <DuplicateIcon sx={{ fontSize: { xs: 20, sm: 22, md: 21, lg: 24, xl: 28 } }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Rediger">
                          <IconButton
                            onClick={() => onEditRole(role)}
                            sx={{
                              minWidth: TOUCH_TARGET_SIZE,
                              minHeight: TOUCH_TARGET_SIZE,
                              color: '#e5c29c',
                              '&:hover': { bgcolor: 'rgba(184,107,255,0.14)' },
                              ...focusVisibleStyles,
                            }}
                          >
                            <EditIcon sx={{ fontSize: { xs: 20, sm: 22, md: 21, lg: 24, xl: 28 } }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Slett">
                          <IconButton
                            onClick={() => handleDeleteWithUndo(role)}
                            sx={{
                              minWidth: TOUCH_TARGET_SIZE,
                              minHeight: TOUCH_TARGET_SIZE,
                              color: '#ff4444',
                              '&:hover': { bgcolor: 'rgba(255,68,68,0.1)' },
                              ...focusVisibleStyles,
                            }}
                          >
                            <DeleteIcon sx={{ fontSize: { xs: 20, sm: 22, md: 21, lg: 24, xl: 28 } }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            );
          })}
        </Box>
      )
      )}
        </>
      )}

      {/* Undo Delete Snackbar */}
      <Snackbar
        open={undoSnackbarOpen}
        autoHideDuration={6000}
        onClose={() => setUndoSnackbarOpen(false)}
        message="Rolle slettet"
        action={
          <Button color="secondary" size="small" onClick={handleUndoDelete} sx={{ color: '#b86bff', fontSize: isDesktop ? '1rem' : isTablet ? '0.875rem' : '0.8125rem' }}>
            Angre
          </Button>
        }
        sx={{ '& .MuiSnackbarContent-root': { bgcolor: '#333' } }}
      />

      {/* Delete Pool Role Confirmation Dialog */}
      <Dialog
        open={!!confirmDeletePoolRole}
        onClose={() => setConfirmDeletePoolRole(null)}
        maxWidth="sm"
        aria-labelledby={dialogTitleId}
        aria-describedby={dialogDescId}
        PaperProps={{
          sx: {
            bgcolor: '#1c2128',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 3,
          },
        }}
      >
        <DialogTitle id={dialogTitleId} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {branding.tokens.labels.deleteProjectLabel || 'Slett'}
          </Typography>
        </DialogTitle>
        <DialogContent id={dialogDescId}>
          <Typography sx={{ color: 'rgba(255,255,255,0.85)' }}>
            {`Er du sikker på at du vil fjerne "${confirmDeletePoolRole?.name}" fra poolen?`}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setConfirmDeletePoolRole(null)} variant="outlined"
            sx={{ color: 'rgba(255,255,255,0.8)', borderColor: 'rgba(255,255,255,0.2)', textTransform: 'none' }}>
            {branding.tokens.labels.cancelLabel || 'Avbryt'}
          </Button>
          <Button onClick={executeDeleteFromPool} variant="contained"
            sx={{ bgcolor: '#ff4444', color: '#fff', textTransform: 'none', fontWeight: 600, '&:hover': { bgcolor: '#ff3333' } }}>
            {branding.tokens.labels.deleteProjectLabel || 'Slett'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export const RoleManagementPanel = memo(RoleManagementPanelInner);
