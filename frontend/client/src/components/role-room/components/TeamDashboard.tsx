import React, { useEffect, useMemo, useCallback, useRef, useState } from "react";
import { Alert, Avatar, Badge, Box, Button, Card, CardContent, Chip, Collapse, Dialog, DialogActions, DialogContent, DialogTitle, Drawer, FormControl, FormControlLabel, IconButton, InputAdornment, InputLabel, LinearProgress, List, ListItem, ListItemAvatar, ListItemText, MenuItem, Paper, Select, Snackbar, Stack, Switch, Tab, Tabs, TextField, Tooltip, Typography, useMediaQuery, useTheme } from "@mui/material";
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Add as AddIcon, Assignment as TaskIcon, AutoFixHigh as AutoBalanceIcon, CheckCircle as CompleteIcon, Close as CloseIcon, Description as CallSheetIcon, Download as DownloadIcon, ExpandLess as ExpandLessIcon, ExpandMore as ExpandMoreIcon, History as HistoryIcon, Hub as DependencyIcon, Lock as LockIcon, Person as PersonIcon, PlayArrow as InProgressIcon, Save as SaveIcon, Search as SearchIcon, Send as SendIcon, TableChart as TableIcon, Timeline as TimelineIcon, ViewKanban as KanbanIcon, Warning as WarningIcon } from "@mui/icons-material";
import { CalendarCustomIcon as CalendarIcon } from "./icons/CastingIcons";
import { CallSheetGenerator } from "./CallSheetGenerator";
import type { CastingShot, CrewMember, ProductionDay, SceneBreakdown, ShotList, ShotPriority, ShotStatus } from "../models/casting";
import { castingService } from "../services/castingService";
import { TECHNICAL_CREW_SUBGROUP_LABELS, getRoleCapacity, getRoleColor, getRoleLabel, getTechnicalSubgroupForMember, isTechnicalCrewMember as isTechnicalCrewMemberFromShared, type TechnicalCrewSubgroup } from "./shared/technicalCrew";

type ViewMode = 'kanban' | 'table' | 'timeline' | 'calendar' | 'workload';
export type TeamDashboardCrewSegment = 'all' | 'technical';
type ShotBlocker = 'none' | 'equipment' | 'location' | 'talent';
type DashboardFilterPreset = 'custom' | 'technical_day' | 'technical_critical' | 'unassigned';

type ToastSeverity = 'success' | 'error' | 'warning' | 'info';

interface TeamDashboardProps {
  shotLists: ShotList[];
  crewMembers: CrewMember[];
  currentUserId?: string;
  projectId?: string;
  scenes?: SceneBreakdown[];
  productionDay?: ProductionDay;
  crewSegment?: TeamDashboardCrewSegment;
  onCrewSegmentChange?: (segment: TeamDashboardCrewSegment) => void;
  openCallSheetSignal?: number;
  onShotUpdate?: (shotList: ShotList, shot: CastingShot) => Promise<void>;
  onActivityLog?: (action: string, details: object) => void;
}

interface TeamDashboardSnapshot {
  id?: string;
  projectId: string;
  name: string;
  segment: TeamDashboardCrewSegment;
  subgroup: TechnicalCrewSubgroup;
  filterAssignee: string;
  filterPriority: string;
  blockerFilter: ShotBlocker | 'all';
  preset: DashboardFilterPreset;
  rememberSegment: boolean;
  metrics: {
    totalShots: number;
    completedShots: number;
    blockedShots: number;
    criticalRiskShots: number;
    progressPercent: number;
  };
  createdAt?: string;
}

interface ActivityLogEntry {
  id: string;
  userId: string;
  userName: string;
  action: string;
  targetType: 'shot' | 'shotlist' | 'dashboard' | 'comment';
  targetId: string;
  targetName: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

interface DroppableColumnProps {
  id: string;
  children: React.ReactNode;
}

interface ShotWithList {
  shot: CastingShot;
  shotList: ShotList;
}

interface MemberWorkload {
  assigned: number;
  completed: number;
  inProgress: number;
  blocked: number;
  totalTime: number;
  actualTime: number;
  capacity: number;
  utilization: number;
  severity: 'low' | 'medium' | 'high';
}

interface KanbanCardProps {
  shot: CastingShot;
  shotList: ShotList;
  crewMembers: CrewMember[];
  showDependencies: boolean;
  dependencyCount: number;
  hasDependencyRisk: boolean;
  hasSlaRisk: boolean;
}

const statusColumns: { id: ShotStatus; label: string; color: string; icon: React.ReactNode }[] = [
  { id: 'not_started', label: 'Venter', color: '#9ca3af', icon: <TaskIcon fontSize="small" /> },
  { id: 'in_progress', label: 'Pågår', color: '#38bdf8', icon: <InProgressIcon fontSize="small" /> },
  { id: 'completed', label: 'Fullført', color: '#22c55e', icon: <CompleteIcon fontSize="small" /> },
];

const priorityConfig: Record<ShotPriority, { label: string; color: string; bgColor: string; weight: number }> = {
  critical: { label: 'Kritisk', color: '#ef4444', bgColor: 'rgba(239,68,68,0.15)', weight: 3 },
  important: { label: 'Viktig', color: '#f59e0b', bgColor: 'rgba(245,158,11,0.15)', weight: 2 },
  nice_to_have: { label: 'Bonus', color: '#22c55e', bgColor: 'rgba(34,197,94,0.15)', weight: 1 },
};

const blockerConfig: Record<ShotBlocker, { label: string; color: string; bgColor: string }> = {
  none: { label: 'Ingen blokkering', color: '#9ca3af', bgColor: 'rgba(156,163,175,0.14)' },
  equipment: { label: 'Venter på utstyr', color: '#f59e0b', bgColor: 'rgba(245,158,11,0.16)' },
  location: { label: 'Venter på location', color: '#06b6d4', bgColor: 'rgba(6,182,212,0.16)' },
  talent: { label: 'Venter på talent', color: '#a855f7', bgColor: 'rgba(168,85,247,0.16)' },
};

const presetLabels: Record<DashboardFilterPreset, string> = {
  custom: 'Egendefinert',
  technical_day: 'Teknisk dag',
  technical_critical: 'Tekniske kritiske',
  unassigned: 'Ufordelte',
};

const STORAGE_PREFIX = 'team-dashboard';

const getSegmentStorageKey = (projectId?: string): string => `${STORAGE_PREFIX}:segment:${projectId ?? 'global'}`;
const getRememberSegmentStorageKey = (projectId?: string): string => `${STORAGE_PREFIX}:remember-segment:${projectId ?? 'global'}`;
const getPresetStorageKey = (projectId?: string): string => `${STORAGE_PREFIX}:preset:${projectId ?? 'global'}`;
const getSubgroupStorageKey = (projectId?: string): string => `${STORAGE_PREFIX}:subgroup:${projectId ?? 'global'}`;

function getShotBlocker(shot: CastingShot): ShotBlocker {
  const raw = String(shot.blockerStatus ?? shot.blocker ?? 'none').toLowerCase();
  if (raw === 'equipment' || raw === 'location' || raw === 'talent') {
    return raw;
  }
  return 'none';
}

function getShotDependencies(shot: CastingShot): string[] {
  if (Array.isArray(shot.dependencies)) {
    return shot.dependencies.filter((dep): dep is string => typeof dep === 'string' && dep.trim().length > 0);
  }
  if (Array.isArray(shot.dependsOn)) {
    return shot.dependsOn.filter((dep): dep is string => typeof dep === 'string' && dep.trim().length > 0);
  }
  return [];
}

function getShotActualTime(shot: CastingShot): number {
  if (typeof shot.actualTime === 'number' && Number.isFinite(shot.actualTime)) {
    return shot.actualTime;
  }
  return 0;
}

function getSeverityForUtilization(utilization: number): 'low' | 'medium' | 'high' {
  if (utilization >= 1.2) return 'high';
  if (utilization >= 0.9) return 'medium';
  return 'low';
}

function safeReadLocalStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeWriteLocalStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

const DroppableColumn: React.FC<DroppableColumnProps> = ({ id, children }) => {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <Box
      ref={setNodeRef}
      sx={{
        flex: 1,
        minHeight: { xs: 160, md: 0 },
        overflowY: 'auto',
        p: 1,
        borderRadius: 2,
        border: isOver ? '2px dashed rgba(56,189,248,0.55)' : '2px solid transparent',
        bgcolor: isOver ? 'rgba(56,189,248,0.08)' : 'transparent',
        transition: 'all 0.15s ease',
      }}
    >
      {children}
    </Box>
  );
};

const KanbanCard: React.FC<KanbanCardProps> = ({
  shot,
  shotList,
  crewMembers,
  showDependencies,
  dependencyCount,
  hasDependencyRisk,
  hasSlaRisk,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: shot.id });
  const assignee = useMemo(() => crewMembers.find((member) => member.id === shot.assigneeId), [crewMembers, shot.assigneeId]);
  const priority = priorityConfig[shot.priority ?? 'important'];
  const blocker = blockerConfig[getShotBlocker(shot)];

  return (
    <Card
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.55 : 1,
      }}
      {...attributes}
      {...listeners}
      data-sortable
      sx={{
        mb: 1,
        cursor: 'grab',
        borderLeft: `4px solid ${priority.color}`,
        bgcolor: 'rgba(15,23,42,0.9)',
        border: '1px solid rgba(255,255,255,0.08)',
        '&:hover': {
          borderColor: 'rgba(255,255,255,0.18)',
          boxShadow: '0 8px 22px rgba(2,6,23,0.45)',
        },
      }}
    >
      <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
        <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
          <Typography variant="body2" sx={{ color: '#f8fafc', fontWeight: 600, lineHeight: 1.35 }}>
            {shot.description || shot.shotType}
          </Typography>
          {shot.reservedBy && (
            <Tooltip title={`Reservert av ${shot.reservedByName ?? 'annen bruker'}`}>
              <LockIcon sx={{ fontSize: 16, color: '#a78bfa' }} />
            </Tooltip>
          )}
        </Stack>

        <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: 'wrap' }}>
          <Chip
            size="small"
            label={priority.label}
            sx={{ bgcolor: priority.bgColor, color: priority.color, border: `1px solid ${priority.color}44`, height: 20 }}
          />
          {getShotBlocker(shot) !== 'none' && (
            <Chip
              size="small"
              label={blocker.label}
              icon={<WarningIcon sx={{ color: `${blocker.color} !important` }} />}
              sx={{ bgcolor: blocker.bgColor, color: blocker.color, border: `1px solid ${blocker.color}44`, height: 20 }}
            />
          )}
          {showDependencies && dependencyCount > 0 && (
            <Chip
              size="small"
              label={`Avh.: ${dependencyCount}`}
              icon={<DependencyIcon sx={{ color: `${hasDependencyRisk ? '#ef4444' : '#38bdf8'} !important` }} />}
              sx={{
                bgcolor: hasDependencyRisk ? 'rgba(239,68,68,0.16)' : 'rgba(56,189,248,0.16)',
                color: hasDependencyRisk ? '#ef4444' : '#38bdf8',
                border: `1px solid ${hasDependencyRisk ? '#ef4444' : '#38bdf8'}44`,
                height: 20,
              }}
            />
          )}
          {hasSlaRisk && (
            <Chip
              size="small"
              label="SLA risiko"
              sx={{ bgcolor: 'rgba(244,63,94,0.18)', color: '#f43f5e', border: '1px solid rgba(244,63,94,0.45)', height: 20 }}
            />
          )}
        </Stack>

        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
          <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.76)' }}>
            {shotList.sceneName || 'Scene'}
          </Typography>
          {assignee ? (
            <Tooltip title={assignee.name}>
              <Avatar sx={{ width: 24, height: 24, bgcolor: getRoleColor(String(assignee.role)), fontSize: 12 }}>
                {assignee.name.charAt(0)}
              </Avatar>
            </Tooltip>
          ) : (
            <Chip
              size="small"
              icon={<PersonIcon sx={{ color: '#a855f7 !important' }} />}
              label="Ledig"
              sx={{
                bgcolor: 'rgba(168,85,247,0.15)',
                color: '#a855f7',
                border: '1px dashed rgba(168,85,247,0.45)',
                height: 20,
              }}
            />
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

export const TeamDashboard: React.FC<TeamDashboardProps> = ({
  shotLists,
  crewMembers,
  currentUserId,
  projectId,
  scenes = [],
  productionDay,
  crewSegment,
  onCrewSegmentChange,
  openCallSheetSignal = 0,
  onShotUpdate,
  onActivityLog,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [blockerFilter, setBlockerFilter] = useState<ShotBlocker | 'all'>('all');
  const [technicalSubgroup, setTechnicalSubgroup] = useState<TechnicalCrewSubgroup>('all');
  const [filterPreset, setFilterPreset] = useState<DashboardFilterPreset>('custom');
  const [rememberSegment, setRememberSegment] = useState(true);
  const [showDependencies, setShowDependencies] = useState(false);

  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [showActivityPanel, setShowActivityPanel] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [statsExpanded, setStatsExpanded] = useState(!isMobile && !isTablet);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedMemberForAssign, setSelectedMemberForAssign] = useState<string>('');
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(new Set());
  const [showCallSheetDrawer, setShowCallSheetDrawer] = useState(false);
  const [internalCrewSegment, setInternalCrewSegment] = useState<TeamDashboardCrewSegment>('all');

  const [toastMessage, setToastMessage] = useState('');
  const [toastSeverity, setToastSeverity] = useState<ToastSeverity>('info');
  const [toastOpen, setToastOpen] = useState(false);

  const [snapshots, setSnapshots] = useState<TeamDashboardSnapshot[]>([]);
  const [snapshotName, setSnapshotName] = useState('');
  const [snapshotDialogOpen, setSnapshotDialogOpen] = useState(false);
  const [snapshotBusy, setSnapshotBusy] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 140, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const lastCallSheetSignalRef = useRef(0);
  const hydrationProjectRef = useRef<string | null>(null);

  const activeCrewSegment = crewSegment ?? internalCrewSegment;

  const searchAdornment = useMemo(
    () => (
      <InputAdornment position="start">
        <SearchIcon sx={{ color: 'rgba(248,250,252,0.72)' }} />
      </InputAdornment>
    ),
    []
  );

  const pushToast = useCallback((severity: ToastSeverity, message: string) => {
    setToastSeverity(severity);
    setToastMessage(message);
    setToastOpen(true);
  }, []);

  const pushAudit = useCallback(
    (action: string, targetType: ActivityLogEntry['targetType'], targetId: string, targetName: string, details?: Record<string, unknown>) => {
      const entry: ActivityLogEntry = {
        id: `${action}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        userId: currentUserId ?? 'unknown',
        userName: crewMembers.find((member) => member.id === currentUserId)?.name ?? 'Ukjent',
        action,
        targetType,
        targetId,
        targetName,
        timestamp: new Date().toISOString(),
        details,
      };

      setActivityLog((prev) => [entry, ...prev].slice(0, 160));
      if (onActivityLog) {
        onActivityLog(action, {
          targetType,
          targetId,
          targetName,
          ...(details ?? {}),
        });
      }
    },
    [currentUserId, crewMembers, onActivityLog]
  );

  useEffect(() => {
    if (hydrationProjectRef.current === (projectId ?? null)) {
      return;
    }
    hydrationProjectRef.current = projectId ?? null;

    const rememberValue = safeReadLocalStorage(getRememberSegmentStorageKey(projectId));
    if (rememberValue !== null) {
      setRememberSegment(rememberValue === '1');
    }

    const savedPreset = safeReadLocalStorage(getPresetStorageKey(projectId));
    if (savedPreset === 'technical_day' || savedPreset === 'technical_critical' || savedPreset === 'unassigned' || savedPreset === 'custom') {
      setFilterPreset(savedPreset);
    }

    const subgroupValue = safeReadLocalStorage(getSubgroupStorageKey(projectId));
    if (
      subgroupValue === 'all' ||
      subgroupValue === 'camera' ||
      subgroupValue === 'lighting' ||
      subgroupValue === 'sound' ||
      subgroupValue === 'post'
    ) {
      setTechnicalSubgroup(subgroupValue);
    }

    if (!crewSegment) {
      const savedSegment = safeReadLocalStorage(getSegmentStorageKey(projectId));
      if (savedSegment === 'all' || savedSegment === 'technical') {
        setInternalCrewSegment(savedSegment);
      }
    }
  }, [crewSegment, projectId]);

  useEffect(() => {
    if (!crewSegment) {
      safeWriteLocalStorage(getSegmentStorageKey(projectId), activeCrewSegment);
    }
  }, [activeCrewSegment, crewSegment, projectId]);

  useEffect(() => {
    safeWriteLocalStorage(getRememberSegmentStorageKey(projectId), rememberSegment ? '1' : '0');
  }, [projectId, rememberSegment]);

  useEffect(() => {
    safeWriteLocalStorage(getPresetStorageKey(projectId), filterPreset);
  }, [filterPreset, projectId]);

  useEffect(() => {
    safeWriteLocalStorage(getSubgroupStorageKey(projectId), technicalSubgroup);
  }, [projectId, technicalSubgroup]);

  useEffect(() => {
    if (crewSegment) {
      setInternalCrewSegment(crewSegment);
    }
  }, [crewSegment]);

  useEffect(() => {
    if (openCallSheetSignal > lastCallSheetSignalRef.current) {
      setShowCallSheetDrawer(true);
    }
    lastCallSheetSignalRef.current = openCallSheetSignal;
  }, [openCallSheetSignal]);

  const handleCrewSegmentChange = useCallback(
    (segment: TeamDashboardCrewSegment) => {
      if (segment === activeCrewSegment) return;
      if (!crewSegment) {
        setInternalCrewSegment(segment);
      }
      onCrewSegmentChange?.(segment);
      pushAudit('segment_change', 'dashboard', segment, `Segment: ${segment}`, { segment });
    },
    [activeCrewSegment, crewSegment, onCrewSegmentChange, pushAudit]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable;
      if (isTyping) return;

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        handleCrewSegmentChange(activeCrewSegment === 'all' ? 'technical' : 'all');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeCrewSegment, handleCrewSegmentChange]);

  const applyPreset = useCallback(
    (preset: DashboardFilterPreset) => {
      setFilterPreset(preset);

      if (preset === 'technical_day') {
        handleCrewSegmentChange('technical');
        setTechnicalSubgroup('all');
        setFilterAssignee('all');
        setFilterPriority('all');
        setBlockerFilter('all');
      } else if (preset === 'technical_critical') {
        handleCrewSegmentChange('technical');
        setFilterPriority('critical');
        setBlockerFilter('all');
      } else if (preset === 'unassigned') {
        setFilterAssignee('unassigned');
      }

      pushAudit('preset_change', 'dashboard', preset, presetLabels[preset], { preset });
    },
    [handleCrewSegmentChange, pushAudit]
  );

  const scopedCrewMembers = useMemo(() => {
    if (activeCrewSegment === 'all') {
      return crewMembers;
    }
    return crewMembers.filter((member) => isTechnicalCrewMemberFromShared(member, technicalSubgroup));
  }, [activeCrewSegment, crewMembers, technicalSubgroup]);

  const scopedCrewMemberIds = useMemo(() => new Set(scopedCrewMembers.map((member) => member.id)), [scopedCrewMembers]);

  const allShots = useMemo<ShotWithList[]>(() => {
    const flattened: ShotWithList[] = [];

    for (const shotList of shotLists) {
      for (const shot of shotList.shots ?? []) {
        flattened.push({ shot, shotList });
      }
    }

    let result = flattened;

    if (activeCrewSegment === 'technical') {
      result = result.filter(({ shot }) => !shot.assigneeId || scopedCrewMemberIds.has(shot.assigneeId));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(({ shot, shotList }) => {
        const shotDesc = String(shot.description ?? shot.shotType ?? '').toLowerCase();
        const sceneName = String(shotList.sceneName ?? '').toLowerCase();
        return shotDesc.includes(q) || sceneName.includes(q);
      });
    }

    if (filterAssignee !== 'all') {
      result = result.filter(({ shot }) => {
        if (filterAssignee === 'unassigned') {
          return !shot.assigneeId;
        }
        return shot.assigneeId === filterAssignee;
      });
    }

    if (filterPriority !== 'all') {
      result = result.filter(({ shot }) => shot.priority === filterPriority);
    }

    if (blockerFilter !== 'all') {
      result = result.filter(({ shot }) => getShotBlocker(shot) === blockerFilter);
    }

    return result;
  }, [
    activeCrewSegment,
    blockerFilter,
    filterAssignee,
    filterPriority,
    scopedCrewMemberIds,
    searchQuery,
    shotLists,
  ]);

  useEffect(() => {
    if (filterAssignee === 'all' || filterAssignee === 'unassigned') {
      return;
    }
    if (!scopedCrewMemberIds.has(filterAssignee)) {
      setFilterAssignee('all');
      if (filterPreset !== 'custom') {
        setFilterPreset('custom');
      }
    }
  }, [filterAssignee, filterPreset, scopedCrewMemberIds]);

  const shotsByStatus = useMemo<Record<ShotStatus, ShotWithList[]>>(
    () => ({
      not_started: allShots.filter((item) => (item.shot.status ?? 'not_started') === 'not_started'),
      in_progress: allShots.filter((item) => item.shot.status === 'in_progress'),
      completed: allShots.filter((item) => item.shot.status === 'completed'),
    }),
    [allShots]
  );

  const statusByShotId = useMemo(() => {
    const map = new Map<string, ShotStatus>();
    for (const { shot } of allShots) {
      map.set(shot.id, (shot.status ?? 'not_started') as ShotStatus);
    }
    return map;
  }, [allShots]);

  const dependencyRows = useMemo(() => {
    return allShots
      .map(({ shot, shotList }) => {
        const dependencies = getShotDependencies(shot);
        if (dependencies.length === 0) return null;
        const unresolved = dependencies.filter((depId) => statusByShotId.get(depId) !== 'completed');
        return {
          shot,
          shotList,
          dependencies,
          unresolved,
        };
      })
      .filter((row): row is { shot: CastingShot; shotList: ShotList; dependencies: string[]; unresolved: string[] } => row !== null);
  }, [allShots, statusByShotId]);

  const criticalRiskShotIds = useMemo(() => {
    const now = Date.now();
    const ids = new Set<string>();

    for (const { shot, shotList } of allShots) {
      if ((shot.priority ?? 'important') !== 'critical') continue;
      if ((shot.status ?? 'not_started') === 'completed') continue;
      const deadline = shot.deadline ?? shotList.deadline;
      if (!deadline) {
        ids.add(shot.id);
        continue;
      }
      const millis = new Date(String(deadline)).getTime() - now;
      if (Number.isFinite(millis) && millis <= 48 * 60 * 60 * 1000) {
        ids.add(shot.id);
      }
    }

    return ids;
  }, [allShots]);

  const workloadByMember = useMemo<Record<string, MemberWorkload>>(() => {
    const load: Record<string, MemberWorkload> = {};

    for (const member of scopedCrewMembers) {
      load[member.id] = {
        assigned: 0,
        completed: 0,
        inProgress: 0,
        blocked: 0,
        totalTime: 0,
        actualTime: 0,
        capacity: getRoleCapacity(String(member.role)),
        utilization: 0,
        severity: 'low',
      };
    }

    load.unassigned = {
      assigned: 0,
      completed: 0,
      inProgress: 0,
      blocked: 0,
      totalTime: 0,
      actualTime: 0,
      capacity: 0,
      utilization: 0,
      severity: 'low',
    };

    for (const { shot } of allShots) {
      const memberId = shot.assigneeId ?? 'unassigned';
      if (!load[memberId]) {
        load[memberId] = {
          assigned: 0,
          completed: 0,
          inProgress: 0,
          blocked: 0,
          totalTime: 0,
          actualTime: 0,
          capacity: 10,
          utilization: 0,
          severity: 'low',
        };
      }

      const target = load[memberId];
      target.assigned += 1;
      target.totalTime += Number(shot.estimatedTime ?? 0);
      target.actualTime += getShotActualTime(shot);
      if ((shot.status ?? 'not_started') === 'completed') target.completed += 1;
      if ((shot.status ?? 'not_started') === 'in_progress') target.inProgress += 1;
      if (getShotBlocker(shot) !== 'none') target.blocked += 1;
    }

    for (const [memberId, memberLoad] of Object.entries(load)) {
      if (memberId === 'unassigned') continue;
      const utilization = memberLoad.capacity > 0 ? memberLoad.assigned / memberLoad.capacity : 0;
      memberLoad.utilization = utilization;
      memberLoad.severity = getSeverityForUtilization(utilization);
    }

    return load;
  }, [allShots, scopedCrewMembers]);

  const reassignmentSuggestions = useMemo(() => {
    const overloaded = scopedCrewMembers.filter((member) => {
      const load = workloadByMember[member.id];
      return load?.severity === 'high';
    });

    if (overloaded.length === 0) {
      return [] as string[];
    }

    const underloaded = scopedCrewMembers.filter((member) => {
      const load = workloadByMember[member.id];
      return load?.severity === 'low';
    });

    return overloaded
      .slice(0, 4)
      .map((member) => {
        const memberGroup = getTechnicalSubgroupForMember(member);
        const fallbackTarget = underloaded.find((candidate) => getTechnicalSubgroupForMember(candidate) === memberGroup) ?? underloaded[0];
        if (!fallbackTarget) {
          return `${member.name} er overbooket. Ingen ledig kandidat tilgjengelig nå.`;
        }
        return `${member.name} er overbooket. Flytt 1–2 shots til ${fallbackTarget.name}.`;
      });
  }, [scopedCrewMembers, workloadByMember]);

  const technicalCrewForReadiness = useMemo(
    () => crewMembers.filter((member) => isTechnicalCrewMemberFromShared(member)),
    [crewMembers]
  );

  const missingContactMembers = useMemo(
    () =>
      technicalCrewForReadiness.filter((member) => {
        const contact = (member.contactInfo ?? member.contact_info ?? {}) as { email?: string; phone?: string };
        return !contact.email && !contact.phone;
      }),
    [technicalCrewForReadiness]
  );

  const missingAvailabilityMembers = useMemo(
    () =>
      technicalCrewForReadiness.filter((member) => {
        const availability = member.availability;
        return !availability || Object.keys(availability).length === 0;
      }),
    [technicalCrewForReadiness]
  );

  const readinessScore = useMemo(() => {
    const total = technicalCrewForReadiness.length;
    if (total === 0) return 100;

    const withContact = total - missingContactMembers.length;
    const withAvailability = total - missingAvailabilityMembers.length;
    const assignedCrew = new Set(
      allShots
        .filter(({ shot }) => Boolean(shot.assigneeId))
        .map(({ shot }) => String(shot.assigneeId))
    );
    const assignedTechnical = technicalCrewForReadiness.filter((member) => assignedCrew.has(member.id)).length;

    const contactScore = withContact / total;
    const availabilityScore = withAvailability / total;
    const assignedScore = assignedTechnical / total;

    return Math.round((contactScore * 0.4 + availabilityScore * 0.3 + assignedScore * 0.3) * 100);
  }, [allShots, missingAvailabilityMembers.length, missingContactMembers.length, technicalCrewForReadiness]);

  const stats = useMemo(() => {
    const total = allShots.length;
    const completed = allShots.filter(({ shot }) => (shot.status ?? 'not_started') === 'completed').length;
    const inProgress = allShots.filter(({ shot }) => shot.status === 'in_progress').length;
    const critical = allShots.filter(({ shot }) => (shot.priority ?? 'important') === 'critical').length;
    const unassigned = allShots.filter(({ shot }) => !shot.assigneeId).length;
    const blocked = allShots.filter(({ shot }) => getShotBlocker(shot) !== 'none').length;

    const totalEstimate = allShots.reduce((sum, { shot }) => sum + Number(shot.estimatedTime ?? 0), 0);
    const totalActual = allShots.reduce((sum, { shot }) => sum + getShotActualTime(shot), 0);

    return {
      total,
      completed,
      inProgress,
      critical,
      unassigned,
      blocked,
      averageEstimated: total > 0 ? totalEstimate / total : 0,
      averageActual: total > 0 ? totalActual / total : 0,
      throughput: total > 0 ? (completed / total) * 100 : 0,
      criticalRisk: criticalRiskShotIds.size,
    };
  }, [allShots, criticalRiskShotIds]);

  const progress = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;

  const roleLegend = useMemo(() => {
    const roles = new Set<string>();
    for (const member of scopedCrewMembers) {
      roles.add(String(member.role));
    }
    return Array.from(roles);
  }, [scopedCrewMembers]);

  const memberById = useMemo<Map<string, CrewMember>>(
    () => new Map(scopedCrewMembers.map((member): [string, CrewMember] => [member.id, member])),
    [scopedCrewMembers]
  );

  const updateShot = useCallback(
    async (shotList: ShotList, shot: CastingShot, updates: Partial<CastingShot>, auditAction = 'shot_update') => {
      if (!onShotUpdate) return;
      const updatedShot: CastingShot = {
        ...shot,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      try {
        await onShotUpdate(shotList, updatedShot);
        pushAudit(auditAction, 'shot', shot.id, shot.description || shot.shotType, updates as Record<string, unknown>);
      } catch (error) {
        console.error('Shot update failed:', error);
        pushToast('error', 'Kunne ikke lagre endringen. Optimistisk oppdatering ble rullet tilbake.');
      }
    },
    [onShotUpdate, pushAudit, pushToast]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      if (!over) return;

      const activeItem = allShots.find((item) => item.shot.id === active.id);
      if (!activeItem) return;

      let newStatus = statusColumns.find((column) => column.id === over.id)?.id;
      if (!newStatus) {
        const overItem = allShots.find((item) => item.shot.id === over.id);
        if (overItem) {
          newStatus = (overItem.shot.status ?? 'not_started') as ShotStatus;
        }
      }

      if (newStatus && (activeItem.shot.status ?? 'not_started') !== newStatus) {
        await updateShot(activeItem.shotList, activeItem.shot, { status: newStatus }, 'status_change');
      }
    },
    [allShots, updateShot]
  );

  const assignUnassignedShotsToTechnical = useCallback(async () => {
    const eligibleMembers = scopedCrewMembers.filter((member) =>
      activeCrewSegment === 'technical' ? isTechnicalCrewMemberFromShared(member, technicalSubgroup) : true
    );

    if (eligibleMembers.length === 0) {
      pushToast('warning', 'Ingen tilgjengelige crewmedlemmer for bulk-tilordning.');
      return;
    }

    const unassignedShots = allShots.filter(({ shot }) => !shot.assigneeId);
    if (unassignedShots.length === 0) {
      pushToast('info', 'Det finnes ingen ufordelte shots akkurat nå.');
      return;
    }

    const ordered = [...unassignedShots].sort((a, b) => {
      const wa = priorityConfig[a.shot.priority ?? 'important'].weight;
      const wb = priorityConfig[b.shot.priority ?? 'important'].weight;
      return wb - wa;
    });

    let cursor = 0;
    for (const { shot, shotList } of ordered) {
      const target = eligibleMembers[cursor % eligibleMembers.length];
      cursor += 1;
      await updateShot(shotList, shot, { assigneeId: target.id }, 'bulk_assign');
    }

    pushAudit('bulk_assignment', 'dashboard', 'unassigned', 'Bulk assign', {
      count: ordered.length,
      segment: activeCrewSegment,
      subgroup: technicalSubgroup,
    });
    pushToast('success', `Tilordnet ${ordered.length} shots til teknisk team.`);
  }, [
    activeCrewSegment,
    allShots,
    pushAudit,
    pushToast,
    scopedCrewMembers,
    technicalSubgroup,
    updateShot,
  ]);

  const autoBalanceAssignments = useCallback(async () => {
    const members = scopedCrewMembers.filter((member) =>
      activeCrewSegment === 'technical' ? isTechnicalCrewMemberFromShared(member, technicalSubgroup) : true
    );

    if (members.length < 2) {
      pushToast('warning', 'Minst to crewmedlemmer kreves for auto-balansering.');
      return;
    }

    const localLoad = new Map<string, number>(members.map((member) => [member.id, 0]));
    for (const { shot } of allShots) {
      if (shot.assigneeId && localLoad.has(shot.assigneeId)) {
        localLoad.set(shot.assigneeId, (localLoad.get(shot.assigneeId) ?? 0) + 1);
      }
    }

    const byPriority = [...allShots].sort((a, b) => {
      const pa = priorityConfig[a.shot.priority ?? 'important'].weight;
      const pb = priorityConfig[b.shot.priority ?? 'important'].weight;
      return pb - pa;
    });

    let changes = 0;

    for (const { shot, shotList } of byPriority) {
      const candidates = [...members].sort((a, b) => {
        const loadA = (localLoad.get(a.id) ?? 0) / Math.max(1, getRoleCapacity(String(a.role)));
        const loadB = (localLoad.get(b.id) ?? 0) / Math.max(1, getRoleCapacity(String(b.role)));
        return loadA - loadB;
      });

      const target = candidates[0];
      if (!target) continue;

      if (shot.assigneeId !== target.id) {
        if (shot.assigneeId && localLoad.has(shot.assigneeId)) {
          localLoad.set(shot.assigneeId, Math.max(0, (localLoad.get(shot.assigneeId) ?? 0) - 1));
        }
        localLoad.set(target.id, (localLoad.get(target.id) ?? 0) + 1);
        await updateShot(shotList, shot, { assigneeId: target.id }, 'auto_balance');
        changes += 1;
      }
    }

    pushAudit('auto_balance', 'dashboard', 'assignments', 'Auto-balansering', {
      changes,
      memberCount: members.length,
      segment: activeCrewSegment,
      subgroup: technicalSubgroup,
    });

    if (changes > 0) {
      pushToast('success', `Auto-balansering flyttet ${changes} shot-tilordninger.`);
    } else {
      pushToast('info', 'Auto-balansering fant ingen nødvendige endringer.');
    }
  }, [
    activeCrewSegment,
    allShots,
    pushAudit,
    pushToast,
    scopedCrewMembers,
    technicalSubgroup,
    updateShot,
  ]);

  const perRoleTimeVariance = useMemo(() => {
    const map = new Map<string, { estimated: number; actual: number; count: number }>();

    for (const { shot } of allShots) {
      const member = shot.assigneeId ? memberById.get(shot.assigneeId) : undefined;
      const role = member?.role ? String(member.role) : 'unassigned';
      const current = map.get(role) ?? { estimated: 0, actual: 0, count: 0 };
      current.estimated += Number(shot.estimatedTime ?? 0);
      current.actual += getShotActualTime(shot);
      current.count += 1;
      map.set(role, current);
    }

    return Array.from(map.entries()).map(([role, totals]) => ({
      role,
      estimated: totals.estimated,
      actual: totals.actual,
      variance: totals.actual - totals.estimated,
      count: totals.count,
    }));
  }, [allShots, memberById]);

  const timelineDays = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 14 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() + index);
      return date;
    });
  }, []);

  const timelineBars = useMemo(() => {
    const bars = new Map<string, { start: number; length: number }>();
    const totalDays = timelineDays.length;

    allShots.forEach(({ shot }, index) => {
      const status = shot.status ?? 'not_started';
      const base = status === 'completed' ? 0 : status === 'in_progress' ? 3 : 6;
      const start = Math.max(0, Math.min(totalDays - 1, base + (index % 4)));
      const length = Math.max(1, Math.min(totalDays - start, Math.ceil(Number(shot.estimatedTime ?? 60) / 30)));
      bars.set(shot.id, { start, length });
    });

    return bars;
  }, [allShots, timelineDays.length]);

  const timelineHeatmap = useMemo(() => {
    const heat = Array.from({ length: timelineDays.length }, () => 0);

    for (const { shot } of allShots) {
      const bar = timelineBars.get(shot.id);
      if (!bar) continue;
      const weight = priorityConfig[shot.priority ?? 'important'].weight + (getShotBlocker(shot) === 'none' ? 0 : 1);
      for (let dayIndex = bar.start; dayIndex < bar.start + bar.length && dayIndex < heat.length; dayIndex += 1) {
        heat[dayIndex] += weight;
      }
    }

    return heat;
  }, [allShots, timelineBars, timelineDays.length]);

  const loadSnapshots = useCallback(async () => {
    if (!projectId) {
      setSnapshots([]);
      return;
    }

    try {
      const fetched = await castingService.getTeamDashboardSnapshots<TeamDashboardSnapshot>(projectId);
      setSnapshots(Array.isArray(fetched) ? fetched : []);
    } catch (error) {
      console.error('Failed to load team dashboard snapshots:', error);
      setSnapshots([]);
    }
  }, [projectId]);

  useEffect(() => {
    void loadSnapshots();
  }, [loadSnapshots]);

  const saveSnapshot = useCallback(async () => {
    if (!projectId) {
      pushToast('warning', 'Mangler prosjekt-ID for snapshots.');
      return;
    }

    const name = snapshotName.trim() || `Snapshot ${new Date().toLocaleString('nb-NO')}`;

    const snapshot: TeamDashboardSnapshot = {
      projectId,
      name,
      segment: activeCrewSegment,
      subgroup: technicalSubgroup,
      filterAssignee,
      filterPriority,
      blockerFilter,
      preset: filterPreset,
      rememberSegment,
      metrics: {
        totalShots: stats.total,
        completedShots: stats.completed,
        blockedShots: stats.blocked,
        criticalRiskShots: stats.criticalRisk,
        progressPercent: progress,
      },
    };

    setSnapshotBusy(true);
    try {
      await castingService.saveTeamDashboardSnapshot<TeamDashboardSnapshot>(projectId, snapshot);
      await loadSnapshots();
      setSnapshotDialogOpen(false);
      setSnapshotName('');
      pushAudit('snapshot_saved', 'dashboard', name, name, snapshot.metrics);
      pushToast('success', `Snapshot "${name}" lagret.`);
    } catch (error) {
      console.error('Failed to save snapshot:', error);
      pushToast('error', 'Kunne ikke lagre snapshot.');
    } finally {
      setSnapshotBusy(false);
    }
  }, [
    activeCrewSegment,
    blockerFilter,
    filterAssignee,
    filterPreset,
    filterPriority,
    loadSnapshots,
    progress,
    projectId,
    pushAudit,
    pushToast,
    rememberSegment,
    snapshotName,
    stats,
    technicalSubgroup,
  ]);

  const applySnapshot = useCallback(
    (snapshotId: string) => {
      const snapshot = snapshots.find((item) => item.id === snapshotId || item.name === snapshotId);
      if (!snapshot) return;

      handleCrewSegmentChange(snapshot.segment);
      setTechnicalSubgroup(snapshot.subgroup);
      setFilterAssignee(snapshot.filterAssignee);
      setFilterPriority(snapshot.filterPriority);
      setBlockerFilter(snapshot.blockerFilter);
      setFilterPreset(snapshot.preset ?? 'custom');
      setRememberSegment(snapshot.rememberSegment ?? true);

      pushAudit('snapshot_loaded', 'dashboard', snapshot.id ?? snapshot.name, snapshot.name, snapshot.metrics);
      pushToast('success', `Snapshot "${snapshot.name}" lastet.`);
    },
    [handleCrewSegmentChange, pushAudit, pushToast, snapshots]
  );

  const sendCallSheet = useCallback(() => {
    const recipients = scopedCrewMembers.filter((member) => {
      const contact = (member.contactInfo ?? member.contact_info ?? {}) as { email?: string };
      return Boolean(contact.email);
    });

    if (recipients.length === 0) {
      pushToast('warning', 'Ingen tekniske mottakere med e-post funnet.');
      return;
    }

    const segmentLabel = activeCrewSegment === 'technical'
      ? TECHNICAL_CREW_SUBGROUP_LABELS[technicalSubgroup]
      : 'Alle team';

    pushAudit('callsheet_sent', 'dashboard', segmentLabel, 'Callsheet sendt', {
      recipients: recipients.length,
      segment: activeCrewSegment,
      subgroup: technicalSubgroup,
    });
    pushToast('success', `Callsheet sendt til ${recipients.length} mottakere (${segmentLabel}).`);
  }, [activeCrewSegment, pushAudit, pushToast, scopedCrewMembers, technicalSubgroup]);

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#020617',
        minHeight: 0,
      }}
    >
      <Box sx={{ p: { xs: 1.5, md: 2 }, borderBottom: '1px solid rgba(255,255,255,0.09)' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ mb: 1.25 }}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <CalendarIcon sx={{ color: '#38bdf8', fontSize: 24 }} />
            <Typography variant="h6" sx={{ color: '#f8fafc', fontWeight: 700 }}>
              Team Dashboard
            </Typography>
            <Chip
              size="small"
              label={activeCrewSegment === 'technical' ? `Teknisk • ${TECHNICAL_CREW_SUBGROUP_LABELS[technicalSubgroup]}` : 'Alle team'}
              sx={{ bgcolor: 'rgba(56,189,248,0.16)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.35)' }}
            />
          </Stack>

          <Stack direction="row" spacing={0.5}>
            <Tooltip title="Aktivitetslogg">
              <IconButton aria-label="Aktivitetslogg" onClick={() => setShowActivityPanel((prev) => !prev)} sx={{ color: '#f8fafc' }}>
                <Badge badgeContent={activityLog.length} color="error" max={99}>
                  <HistoryIcon />
                </Badge>
              </IconButton>
            </Tooltip>
            <Tooltip title="Lagre snapshot">
              <IconButton aria-label="Lagre snapshot" onClick={() => setSnapshotDialogOpen(true)} sx={{ color: '#f8fafc' }}>
                <SaveIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Callsheet">
              <IconButton aria-label="Åpne callsheet" onClick={() => setShowCallSheetDrawer(true)} sx={{ color: '#a78bfa' }}>
                <CallSheetIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        {activeCrewSegment === 'technical' && (
          <Stack spacing={0.75} sx={{ mb: 1.25 }}>
            {missingContactMembers.length > 0 && (
              <Alert severity="warning" sx={{ bgcolor: 'rgba(245,158,11,0.16)', color: '#fcd34d' }}>
                {missingContactMembers.length} tekniske crewmedlemmer mangler kontaktinfo.
              </Alert>
            )}
            {missingAvailabilityMembers.length > 0 && (
              <Alert severity="info" sx={{ bgcolor: 'rgba(56,189,248,0.14)', color: '#7dd3fc' }}>
                {missingAvailabilityMembers.length} tekniske crewmedlemmer mangler tilgjengelighetsdata.
              </Alert>
            )}
          </Stack>
        )}

        <Box
          onClick={() => setStatsExpanded((prev) => !prev)}
          sx={{
            display: { xs: 'flex', lg: 'none' },
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            mb: 1,
            py: 0.5,
          }}
        >
          <Typography sx={{ color: '#cbd5e1', fontSize: 13 }}>Statistikk</Typography>
          {statsExpanded ? <ExpandLessIcon sx={{ color: '#cbd5e1' }} /> : <ExpandMoreIcon sx={{ color: '#cbd5e1' }} />}
        </Box>

        <Collapse in={statsExpanded || (!isMobile && !isTablet)}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', xl: 'repeat(6, 1fr)' },
              gap: 1,
              mb: 1.25,
            }}
          >
            <Paper sx={{ p: 1, bgcolor: 'rgba(255,255,255,0.03)' }}>
              <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.7)' }}>Totalt</Typography>
              <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: 24 }}>{stats.total}</Typography>
            </Paper>
            <Paper sx={{ p: 1, bgcolor: 'rgba(34,197,94,0.14)' }}>
              <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.7)' }}>Throughput</Typography>
              <Typography sx={{ color: '#4ade80', fontWeight: 700, fontSize: 24 }}>{stats.throughput.toFixed(0)}%</Typography>
            </Paper>
            <Paper sx={{ p: 1, bgcolor: 'rgba(245,158,11,0.14)' }}>
              <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.7)' }}>Blokkerte</Typography>
              <Typography sx={{ color: '#f59e0b', fontWeight: 700, fontSize: 24 }}>{stats.blocked}</Typography>
            </Paper>
            <Paper sx={{ p: 1, bgcolor: 'rgba(244,63,94,0.14)' }}>
              <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.7)' }}>SLA risiko</Typography>
              <Typography sx={{ color: '#fb7185', fontWeight: 700, fontSize: 24 }}>{stats.criticalRisk}</Typography>
            </Paper>
            <Paper sx={{ p: 1, bgcolor: 'rgba(56,189,248,0.14)' }}>
              <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.7)' }}>Gj.snitt estimat</Typography>
              <Typography sx={{ color: '#38bdf8', fontWeight: 700, fontSize: 24 }}>{stats.averageEstimated.toFixed(0)}m</Typography>
            </Paper>
            <Paper sx={{ p: 1, bgcolor: 'rgba(168,85,247,0.14)' }}>
              <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.7)' }}>Teknisk readiness</Typography>
              <Typography sx={{ color: '#c4b5fd', fontWeight: 700, fontSize: 24 }}>{readinessScore}%</Typography>
            </Paper>
          </Box>

          <Box sx={{ mb: 1.5 }}>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
              <Typography variant="caption" sx={{ color: '#cbd5e1' }}>Fremdrift</Typography>
              <Typography variant="caption" sx={{ color: '#4ade80', fontWeight: 700 }}>{progress.toFixed(0)}%</Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{
                height: 8,
                borderRadius: 4,
                bgcolor: 'rgba(255,255,255,0.12)',
                '& .MuiLinearProgress-bar': { bgcolor: '#22c55e', borderRadius: 4 },
              }}
            />
          </Box>
        </Collapse>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'stretch', md: 'center' }}>
          <Tabs
            value={viewMode}
            onChange={(_, value: ViewMode) => setViewMode(value)}
            variant={isMobile ? 'scrollable' : 'standard'}
            allowScrollButtonsMobile
            sx={{
              minHeight: 40,
              '& .MuiTab-root': { color: 'rgba(248,250,252,0.7)', minHeight: 40, textTransform: 'none' },
              '& .Mui-selected': { color: '#38bdf8', fontWeight: 600 },
              '& .MuiTabs-indicator': { bgcolor: '#38bdf8' },
            }}
          >
            <Tab icon={<KanbanIcon />} iconPosition="start" label={isMobile ? '' : 'Kanban'} value="kanban" />
            <Tab icon={<TableIcon />} iconPosition="start" label={isMobile ? '' : 'Tabell'} value="table" />
            <Tab icon={<TimelineIcon />} iconPosition="start" label={isMobile ? '' : 'Tidslinje'} value="timeline" />
            <Tab icon={<PersonIcon />} iconPosition="start" label={isMobile ? '' : 'Workload'} value="workload" />
          </Tabs>

          <Box sx={{ flex: 1 }} />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ width: { xs: '100%', md: 'auto' } }}>
            <TextField
              size="small"
              placeholder="Søk shots"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                if (filterPreset !== 'custom') setFilterPreset('custom');
              }}
              InputProps={{ startAdornment: searchAdornment }}
              sx={{
                minWidth: { xs: '100%', sm: 180 },
                '& .MuiOutlinedInput-root': {
                  color: '#f8fafc',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.35)' },
                  '&.Mui-focused fieldset': { borderColor: '#38bdf8' },
                },
              }}
            />

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel sx={{ color: 'rgba(248,250,252,0.7)' }}>Preset</InputLabel>
              <Select
                value={filterPreset}
                label="Preset"
                onChange={(event) => applyPreset(event.target.value as DashboardFilterPreset)}
                sx={{
                  color: '#f8fafc',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                }}
              >
                <MenuItem value="custom">{presetLabels.custom}</MenuItem>
                <MenuItem value="technical_day">{presetLabels.technical_day}</MenuItem>
                <MenuItem value="technical_critical">{presetLabels.technical_critical}</MenuItem>
                <MenuItem value="unassigned">{presetLabels.unassigned}</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel sx={{ color: 'rgba(248,250,252,0.7)' }}>Team</InputLabel>
              <Select
                value={activeCrewSegment}
                label="Team"
                onChange={(event) => {
                  handleCrewSegmentChange(event.target.value as TeamDashboardCrewSegment);
                  if (filterPreset !== 'custom') setFilterPreset('custom');
                }}
                sx={{
                  color: '#f8fafc',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                }}
              >
                <MenuItem value="all">Alle team</MenuItem>
                <MenuItem value="technical">Teknisk team</MenuItem>
              </Select>
            </FormControl>

            {activeCrewSegment === 'technical' && (
              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel sx={{ color: 'rgba(248,250,252,0.7)' }}>Underfilter</InputLabel>
                <Select
                  value={technicalSubgroup}
                  label="Underfilter"
                  onChange={(event) => {
                    setTechnicalSubgroup(event.target.value as TechnicalCrewSubgroup);
                    if (filterPreset !== 'custom') setFilterPreset('custom');
                  }}
                  sx={{
                    color: '#f8fafc',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                  }}
                >
                  {Object.entries(TECHNICAL_CREW_SUBGROUP_LABELS).map(([value, label]) => (
                    <MenuItem key={value} value={value}>{label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel sx={{ color: 'rgba(248,250,252,0.7)' }}>Tilordnet</InputLabel>
              <Select
                value={filterAssignee}
                label="Tilordnet"
                onChange={(event) => {
                  setFilterAssignee(event.target.value);
                  if (filterPreset !== 'custom') setFilterPreset('custom');
                }}
                sx={{
                  color: '#f8fafc',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                }}
              >
                <MenuItem value="all">Alle</MenuItem>
                <MenuItem value="unassigned">Ufordelte</MenuItem>
                {scopedCrewMembers.map((member) => (
                  <MenuItem key={member.id} value={member.id}>{member.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel sx={{ color: 'rgba(248,250,252,0.7)' }}>Prioritet</InputLabel>
              <Select
                value={filterPriority}
                label="Prioritet"
                onChange={(event) => {
                  setFilterPriority(event.target.value);
                  if (filterPreset !== 'custom') setFilterPreset('custom');
                }}
                sx={{
                  color: '#f8fafc',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                }}
              >
                <MenuItem value="all">Alle</MenuItem>
                {Object.entries(priorityConfig).map(([value, config]) => (
                  <MenuItem key={value} value={value}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: config.color }} />
                      <span>{config.label}</span>
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel sx={{ color: 'rgba(248,250,252,0.7)' }}>Blokkering</InputLabel>
              <Select
                value={blockerFilter}
                label="Blokkering"
                onChange={(event) => {
                  setBlockerFilter(event.target.value as ShotBlocker | 'all');
                  if (filterPreset !== 'custom') setFilterPreset('custom');
                }}
                sx={{
                  color: '#f8fafc',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                }}
              >
                <MenuItem value="all">Alle</MenuItem>
                {Object.entries(blockerConfig).map(([value, config]) => (
                  <MenuItem key={value} value={value}>{config.label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControlLabel
              control={
                <Switch
                  checked={rememberSegment}
                  onChange={(event) => setRememberSegment(event.target.checked)}
                  color="info"
                />
              }
              label={<Typography sx={{ color: '#cbd5e1', fontSize: 12 }}>Husk segment</Typography>}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={showDependencies}
                  onChange={(event) => setShowDependencies(event.target.checked)}
                  color="info"
                />
              }
              label={<Typography sx={{ color: '#cbd5e1', fontSize: 12 }}>Vis avhengigheter</Typography>}
            />

            <Tooltip title="Eksporter CSV">
              <IconButton
                onClick={() => {
                  const headers = ['Beskrivelse', 'Scene', 'Status', 'Prioritet', 'Blokkering', 'Tilordnet', 'Estimat', 'Faktisk'];
                  const rows = allShots.map(({ shot, shotList }) => {
                    const member = shot.assigneeId ? memberById.get(shot.assigneeId) : undefined;
                    return [
                      shot.description || shot.shotType,
                      shotList.sceneName || 'Scene',
                      statusColumns.find((status) => status.id === (shot.status ?? 'not_started'))?.label ?? 'Venter',
                      priorityConfig[shot.priority ?? 'important'].label,
                      blockerConfig[getShotBlocker(shot)].label,
                      member?.name ?? 'Ledig',
                      String(shot.estimatedTime ?? ''),
                      String(getShotActualTime(shot) || ''),
                    ];
                  });
                  const content = [headers, ...rows]
                    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
                    .join('\n');
                  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const anchor = document.createElement('a');
                  anchor.href = url;
                  anchor.download = `team-dashboard-${new Date().toISOString().slice(0, 10)}.csv`;
                  anchor.click();
                  URL.revokeObjectURL(url);
                }}
                sx={{ color: '#cbd5e1' }}
              >
                <DownloadIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        {roleLegend.length > 0 && (
          <Stack direction="row" spacing={0.75} flexWrap="wrap" sx={{ mt: 1 }}>
            {roleLegend.map((role) => (
              <Chip
                key={role}
                size="small"
                label={getRoleLabel(role)}
                sx={{
                  bgcolor: `${getRoleColor(role)}1f`,
                  color: getRoleColor(role),
                  border: `1px solid ${getRoleColor(role)}66`,
                }}
              />
            ))}
          </Stack>
        )}
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
        <Box sx={{ flex: 1, minHeight: 0, p: { xs: 1, md: 1.5 }, overflow: 'auto' }}>
          {viewMode === 'kanban' && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <Box sx={{ display: { xs: 'flex', md: 'grid' }, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1, minHeight: 0, flexDirection: 'column' }}>
                {statusColumns.map((column) => (
                  <Paper key={column.id} sx={{ display: 'flex', flexDirection: 'column', minHeight: { xs: 220, md: 'calc(100vh - 410px)' }, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 1.25, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      <Box sx={{ color: column.color }}>{column.icon}</Box>
                      <Typography sx={{ color: '#f8fafc', fontWeight: 600, fontSize: 14 }}>{column.label}</Typography>
                      <Chip
                        size="small"
                        label={shotsByStatus[column.id].length}
                        sx={{ ml: 'auto', bgcolor: `${column.color}22`, color: column.color, height: 20 }}
                      />
                    </Stack>
                    <DroppableColumn id={column.id}>
                      <SortableContext items={shotsByStatus[column.id].map(({ shot }) => shot.id)} strategy={verticalListSortingStrategy}>
                        {shotsByStatus[column.id].map(({ shot, shotList }) => {
                          const dependencies = getShotDependencies(shot);
                          const unresolved = dependencies.filter((depId) => statusByShotId.get(depId) !== 'completed');
                          return (
                            <KanbanCard
                              key={shot.id}
                              shot={shot}
                              shotList={shotList}
                              crewMembers={scopedCrewMembers}
                              showDependencies={showDependencies}
                              dependencyCount={dependencies.length}
                              hasDependencyRisk={unresolved.length > 0}
                              hasSlaRisk={criticalRiskShotIds.has(shot.id)}
                            />
                          );
                        })}
                      </SortableContext>
                      {shotsByStatus[column.id].length === 0 && (
                        <Paper sx={{ p: 1.25, textAlign: 'center', bgcolor: 'rgba(148,163,184,0.08)', border: '1px dashed rgba(148,163,184,0.45)' }}>
                          <Typography variant="caption" sx={{ color: '#cbd5e1' }}>Dra shots hit</Typography>
                        </Paper>
                      )}
                    </DroppableColumn>
                  </Paper>
                ))}
              </Box>

              <DragOverlay>
                {activeId ? (() => {
                  const activeItem = allShots.find((item) => item.shot.id === activeId);
                  if (!activeItem) return null;
                  const priority = priorityConfig[activeItem.shot.priority ?? 'important'];
                  return (
                    <Card sx={{ width: 280, bgcolor: '#0f172a', border: `1px solid ${priority.color}`, boxShadow: '0 12px 32px rgba(2,6,23,0.55)' }}>
                      <CardContent sx={{ p: 1.25 }}>
                        <Typography variant="body2" sx={{ color: '#f8fafc', fontWeight: 600 }}>
                          {activeItem.shot.description || activeItem.shot.shotType}
                        </Typography>
                      </CardContent>
                    </Card>
                  );
                })() : null}
              </DragOverlay>
            </DndContext>
          )}

          {viewMode === 'workload' && (
            <Stack spacing={1.25}>
              <Paper sx={{ p: 1.25, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.09)' }}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
                  <Stack spacing={0.5}>
                    <Typography sx={{ color: '#f8fafc', fontWeight: 600 }}>Planlegging og kapasitet</Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.7)' }}>
                      Kapasitet per rolle, overbooking-severity og forslag til reassignment.
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={assignUnassignedShotsToTechnical}
                      sx={{ borderColor: 'rgba(56,189,248,0.45)', color: '#7dd3fc' }}
                    >
                      Bulk-tilordne
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<AutoBalanceIcon />}
                      onClick={autoBalanceAssignments}
                      sx={{ borderColor: 'rgba(168,85,247,0.45)', color: '#c4b5fd' }}
                    >
                      Auto-balanser
                    </Button>
                  </Stack>
                </Stack>
              </Paper>

              {reassignmentSuggestions.length > 0 && (
                <Alert severity="warning" sx={{ bgcolor: 'rgba(245,158,11,0.16)', color: '#fcd34d' }}>
                  <Stack spacing={0.25}>
                    {reassignmentSuggestions.map((suggestion) => (
                      <Typography key={suggestion} variant="body2">• {suggestion}</Typography>
                    ))}
                  </Stack>
                </Alert>
              )}

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(auto-fit, minmax(290px, 1fr))' }, gap: 1 }}>
                {scopedCrewMembers.map((member) => {
                  const load = workloadByMember[member.id] ?? {
                    assigned: 0,
                    completed: 0,
                    inProgress: 0,
                    blocked: 0,
                    totalTime: 0,
                    actualTime: 0,
                    capacity: getRoleCapacity(String(member.role)),
                    utilization: 0,
                    severity: 'low' as const,
                  };
                  const completion = load.assigned > 0 ? (load.completed / load.assigned) * 100 : 0;
                  const isExpanded = expandedMembers.has(member.id);
                  const memberShots = allShots.filter(({ shot }) => shot.assigneeId === member.id);

                  return (
                    <Paper
                      key={member.id}
                      sx={{
                        p: 1.25,
                        bgcolor:
                          load.severity === 'high'
                            ? 'rgba(239,68,68,0.12)'
                            : load.severity === 'medium'
                              ? 'rgba(245,158,11,0.12)'
                              : 'rgba(255,255,255,0.03)',
                        border:
                          load.severity === 'high'
                            ? '1px solid rgba(239,68,68,0.45)'
                            : load.severity === 'medium'
                              ? '1px solid rgba(245,158,11,0.45)'
                              : '1px solid rgba(255,255,255,0.09)',
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Avatar sx={{ bgcolor: getRoleColor(String(member.role)), width: isMobile ? 34 : 38, height: isMobile ? 34 : 38, fontSize: 13 }}>
                          {member.name.charAt(0)}
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ color: '#f8fafc', fontWeight: 600, fontSize: 14 }} noWrap>
                            {member.name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.7)' }}>
                            {getRoleLabel(String(member.role))}
                          </Typography>
                        </Box>
                        <Chip
                          size="small"
                          label={load.severity === 'high' ? 'Høy risiko' : load.severity === 'medium' ? 'Middels' : 'Lav'}
                          sx={{
                            bgcolor:
                              load.severity === 'high'
                                ? 'rgba(239,68,68,0.18)'
                                : load.severity === 'medium'
                                  ? 'rgba(245,158,11,0.18)'
                                  : 'rgba(34,197,94,0.18)',
                            color:
                              load.severity === 'high' ? '#ef4444' : load.severity === 'medium' ? '#f59e0b' : '#22c55e',
                            border: `1px solid ${
                              load.severity === 'high' ? 'rgba(239,68,68,0.45)' : load.severity === 'medium' ? 'rgba(245,158,11,0.45)' : 'rgba(34,197,94,0.45)'
                            }`,
                          }}
                        />
                      </Stack>

                      <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: 'wrap' }}>
                        <Chip size="small" label={`${load.assigned} tilordnet`} sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#f8fafc' }} />
                        <Chip size="small" label={`${load.blocked} blokkert`} sx={{ bgcolor: 'rgba(245,158,11,0.14)', color: '#f59e0b' }} />
                        <Chip size="small" label={`Kapasitet ${load.capacity}`} sx={{ bgcolor: 'rgba(56,189,248,0.14)', color: '#38bdf8' }} />
                        <Chip size="small" label={`Utnyttelse ${(load.utilization * 100).toFixed(0)}%`} sx={{ bgcolor: 'rgba(168,85,247,0.14)', color: '#c4b5fd' }} />
                      </Stack>

                      <Box sx={{ mt: 1 }}>
                        <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.35 }}>
                          <Typography variant="caption" sx={{ color: '#cbd5e1' }}>Fullføringsgrad</Typography>
                          <Typography variant="caption" sx={{ color: '#4ade80', fontWeight: 700 }}>{completion.toFixed(0)}%</Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={completion}
                          sx={{
                            height: 6,
                            borderRadius: 3,
                            bgcolor: 'rgba(255,255,255,0.12)',
                            '& .MuiLinearProgress-bar': { bgcolor: '#22c55e', borderRadius: 3 },
                          }}
                        />
                      </Box>

                      <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
                        <Typography variant="caption" sx={{ color: '#cbd5e1' }}>
                          Est./faktisk: {load.totalTime}m / {load.actualTime}m
                        </Typography>
                        <Button
                          size="small"
                          onClick={() => {
                            setExpandedMembers((prev) => {
                              const next = new Set(prev);
                              if (next.has(member.id)) next.delete(member.id);
                              else next.add(member.id);
                              return next;
                            });
                          }}
                          sx={{ minWidth: 'auto', color: '#7dd3fc', p: 0 }}
                        >
                          {isExpanded ? 'Skjul' : 'Detaljer'}
                        </Button>
                      </Stack>

                      {(isExpanded || isMobile) && memberShots.length > 0 && (
                        <Stack spacing={0.5} sx={{ mt: 1 }}>
                          {(isExpanded ? memberShots : memberShots.slice(0, isMobile ? 2 : 3)).map(({ shot, shotList }) => {
                            const priority = priorityConfig[shot.priority ?? 'important'];
                            const blocker = blockerConfig[getShotBlocker(shot)];
                            return (
                              <Paper
                                key={shot.id}
                                sx={{
                                  p: 0.75,
                                  bgcolor: 'rgba(2,6,23,0.65)',
                                  borderLeft: `3px solid ${priority.color}`,
                                  border: '1px solid rgba(255,255,255,0.08)',
                                }}
                              >
                                <Typography variant="body2" sx={{ color: '#f8fafc', fontSize: 12 }}>
                                  {shot.description || shot.shotType}
                                </Typography>
                                <Stack direction="row" spacing={0.5} sx={{ mt: 0.35 }}>
                                  <Chip size="small" label={shotList.sceneName || 'Scene'} sx={{ height: 18, bgcolor: 'rgba(148,163,184,0.15)', color: '#cbd5e1' }} />
                                  <Chip size="small" label={blocker.label} sx={{ height: 18, bgcolor: blocker.bgColor, color: blocker.color }} />
                                </Stack>
                              </Paper>
                            );
                          })}
                        </Stack>
                      )}
                    </Paper>
                  );
                })}

                {workloadByMember.unassigned?.assigned > 0 && (
                  <Paper sx={{ p: 1.25, bgcolor: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.45)' }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                      <Avatar sx={{ bgcolor: '#a855f7', width: 34, height: 34 }}>
                        <PersonIcon fontSize="small" />
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ color: '#f8fafc', fontWeight: 600, fontSize: 14 }}>Ufordelte shots</Typography>
                        <Typography variant="caption" sx={{ color: '#d8b4fe' }}>{workloadByMember.unassigned.assigned} trenger eier</Typography>
                      </Box>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<AddIcon />}
                        onClick={() => {
                          setSelectedMemberForAssign(scopedCrewMembers[0]?.id ?? '');
                          setAssignDialogOpen(true);
                        }}
                        sx={{ borderColor: 'rgba(168,85,247,0.5)', color: '#e9d5ff' }}
                      >
                        Tilordne
                      </Button>
                    </Stack>
                  </Paper>
                )}
              </Box>

              {perRoleTimeVariance.length > 0 && (
                <Paper sx={{ p: 1.25, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.09)' }}>
                  <Typography sx={{ color: '#f8fafc', fontWeight: 600, mb: 0.75 }}>Estimat vs faktisk tid per rolle</Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' }, gap: 0.75 }}>
                    {perRoleTimeVariance.map((entry) => (
                      <Paper key={entry.role} sx={{ p: 0.75, bgcolor: 'rgba(2,6,23,0.7)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <Typography variant="caption" sx={{ color: '#cbd5e1' }}>{getRoleLabel(entry.role)}</Typography>
                        <Typography variant="body2" sx={{ color: '#f8fafc', fontWeight: 600 }}>
                          {entry.estimated.toFixed(0)}m / {entry.actual.toFixed(0)}m
                        </Typography>
                        <Typography variant="caption" sx={{ color: entry.variance > 0 ? '#f59e0b' : '#22c55e' }}>
                          Avvik: {entry.variance > 0 ? '+' : ''}{entry.variance.toFixed(0)}m
                        </Typography>
                      </Paper>
                    ))}
                  </Box>
                </Paper>
              )}
            </Stack>
          )}

          {viewMode === 'timeline' && (
            <Box sx={{ minWidth: 780 }}>
              <Paper sx={{ mb: 1, p: 1, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <Typography sx={{ color: '#f8fafc', fontWeight: 600, mb: 0.75 }}>Belastnings-heatmap (14 dager)</Typography>
                <Stack direction="row" spacing={0.4}>
                  {timelineHeatmap.map((value, index) => {
                    const max = Math.max(1, ...timelineHeatmap);
                    const ratio = value / max;
                    return (
                      <Tooltip key={`${index}-${value}`} title={`${timelineDays[index].toLocaleDateString('nb-NO')}: ${value} belastningspoeng`}>
                        <Box
                          sx={{
                            flex: 1,
                            height: 14,
                            borderRadius: 0.75,
                            bgcolor: ratio > 0.75 ? 'rgba(239,68,68,0.75)' : ratio > 0.45 ? 'rgba(245,158,11,0.75)' : 'rgba(34,197,94,0.7)',
                            border: '1px solid rgba(255,255,255,0.16)',
                          }}
                        />
                      </Tooltip>
                    );
                  })}
                </Stack>
              </Paper>

              <Paper sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <Box sx={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)', bgcolor: 'rgba(2,6,23,0.7)' }}>
                  <Box sx={{ width: 220, p: 1, borderRight: '1px solid rgba(255,255,255,0.08)' }}>
                    <Typography variant="caption" sx={{ color: '#cbd5e1', fontWeight: 700 }}>Shot</Typography>
                  </Box>
                  {timelineDays.map((day) => (
                    <Box key={day.toISOString()} sx={{ minWidth: 40, flex: 1, p: 0.5, textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                      <Typography variant="caption" sx={{ color: '#cbd5e1', fontSize: 10 }}>{day.getDate()}</Typography>
                    </Box>
                  ))}
                </Box>

                {allShots.map(({ shot, shotList }) => {
                  const bar = timelineBars.get(shot.id);
                  const priority = priorityConfig[shot.priority ?? 'important'];
                  const assignee = shot.assigneeId ? memberById.get(shot.assigneeId) : null;

                  return (
                    <Box key={shot.id} sx={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <Box sx={{ width: 220, p: 1, borderRight: '1px solid rgba(255,255,255,0.08)' }}>
                        <Typography variant="caption" sx={{ color: '#f8fafc', fontWeight: 600 }}>
                          {shot.description || shot.shotType}
                        </Typography>
                        <Typography variant="caption" sx={{ display: 'block', color: 'rgba(248,250,252,0.65)' }}>
                          {shotList.sceneName || 'Scene'} · {assignee?.name ?? 'Ledig'}
                        </Typography>
                      </Box>

                      <Box sx={{ flex: 1, display: 'flex', position: 'relative', minHeight: 34 }}>
                        {timelineDays.map((day) => (
                          <Box key={`${shot.id}-${day.toISOString()}`} sx={{ minWidth: 40, flex: 1, borderRight: '1px solid rgba(255,255,255,0.03)' }} />
                        ))}
                        {bar && (
                          <Tooltip title={`${shot.description || shot.shotType} (${shot.estimatedTime ?? 0} min)`}>
                            <Box
                              sx={{
                                position: 'absolute',
                                left: `calc(${bar.start} * (100% / ${timelineDays.length}) + 2px)`,
                                width: `calc(${bar.length} * (100% / ${timelineDays.length}) - 4px)`,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                height: 18,
                                borderRadius: 1,
                                bgcolor: priority.color,
                                border: '1px solid rgba(255,255,255,0.25)',
                                px: 0.5,
                                display: 'flex',
                                alignItems: 'center',
                                overflow: 'hidden',
                              }}
                            >
                              <Typography variant="caption" sx={{ color: '#fff', fontSize: 10, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                {shot.shotType}
                              </Typography>
                            </Box>
                          </Tooltip>
                        )}
                      </Box>
                    </Box>
                  );
                })}
              </Paper>

              {showDependencies && dependencyRows.length > 0 && (
                <Paper sx={{ mt: 1, p: 1.25, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <Typography sx={{ color: '#f8fafc', fontWeight: 600, mb: 0.5 }}>Avhengigheter mellom shots</Typography>
                  <Stack spacing={0.5}>
                    {dependencyRows.map((row) => (
                      <Stack key={row.shot.id} direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', md: 'center' }}>
                        <Typography variant="caption" sx={{ color: '#f8fafc', minWidth: 220 }}>
                          {row.shot.description || row.shot.shotType}
                        </Typography>
                        <Chip
                          size="small"
                          icon={<DependencyIcon sx={{ color: `${row.unresolved.length > 0 ? '#ef4444' : '#22c55e'} !important` }} />}
                          label={row.unresolved.length > 0 ? `${row.unresolved.length} uløste` : 'Alle løst'}
                          sx={{
                            bgcolor: row.unresolved.length > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                            color: row.unresolved.length > 0 ? '#ef4444' : '#22c55e',
                          }}
                        />
                      </Stack>
                    ))}
                  </Stack>
                </Paper>
              )}
            </Box>
          )}

          {viewMode === 'table' && (
            <Box sx={{ overflow: 'auto' }}>
              <Box
                component="table"
                sx={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  minWidth: 980,
                  '& th, & td': {
                    p: 1,
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                    textAlign: 'left',
                    verticalAlign: 'middle',
                  },
                  '& th': {
                    bgcolor: 'rgba(255,255,255,0.04)',
                    color: '#cbd5e1',
                    fontSize: 12,
                    fontWeight: 700,
                    position: 'sticky',
                    top: 0,
                    zIndex: 2,
                  },
                  '& td': {
                    color: '#f8fafc',
                    fontSize: 13,
                  },
                  '& tbody tr:hover': {
                    bgcolor: 'rgba(255,255,255,0.03)',
                  },
                }}
              >
                <thead>
                  <tr>
                    <th>Shot</th>
                    {!isMobile && <th>Scene</th>}
                    <th>Status</th>
                    <th>Prioritet</th>
                    <th>Blokkering</th>
                    <th>Tilordnet</th>
                    <th>Estimat</th>
                    <th>Faktisk</th>
                    {showDependencies && <th>Avhengigheter</th>}
                    <th>SLA</th>
                  </tr>
                </thead>
                <tbody>
                  {allShots.length === 0 && (
                    <tr>
                      <td colSpan={showDependencies ? 10 : 9} style={{ color: 'rgba(248,250,252,0.68)' }}>
                        Ingen shots matcher filter.
                      </td>
                    </tr>
                  )}

                  {allShots.map(({ shot, shotList }) => {
                    const status = (shot.status ?? 'not_started') as ShotStatus;
                    const priority = shot.priority ?? 'important';
                    const blocker = getShotBlocker(shot);
                    const dependencies = getShotDependencies(shot);
                    const unresolved = dependencies.filter((depId) => statusByShotId.get(depId) !== 'completed');

                    return (
                      <tr key={shot.id}>
                        <td>
                          <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{shot.description || shot.shotType}</Typography>
                        </td>
                        {!isMobile && (
                          <td>
                            <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.7)' }}>
                              {shotList.sceneName || 'Scene'}
                            </Typography>
                          </td>
                        )}
                        <td>
                          <Select
                            size="small"
                            value={status}
                            onChange={(event) => {
                              void updateShot(shotList, shot, { status: event.target.value as ShotStatus }, 'status_change');
                            }}
                            sx={{
                              minWidth: 116,
                              color: '#f8fafc',
                              bgcolor: `${statusColumns.find((column) => column.id === status)?.color ?? '#9ca3af'}22`,
                              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' },
                            }}
                          >
                            {statusColumns.map((column) => (
                              <MenuItem key={column.id} value={column.id}>{column.label}</MenuItem>
                            ))}
                          </Select>
                        </td>
                        <td>
                          <Select
                            size="small"
                            value={priority}
                            onChange={(event) => {
                              void updateShot(shotList, shot, { priority: event.target.value as ShotPriority }, 'priority_change');
                            }}
                            sx={{
                              minWidth: 112,
                              color: '#f8fafc',
                              bgcolor: `${priorityConfig[priority].color}22`,
                              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' },
                            }}
                          >
                            {Object.entries(priorityConfig).map(([value, config]) => (
                              <MenuItem key={value} value={value}>{config.label}</MenuItem>
                            ))}
                          </Select>
                        </td>
                        <td>
                          <Select
                            size="small"
                            value={blocker}
                            onChange={(event) => {
                              void updateShot(shotList, shot, { blockerStatus: event.target.value }, 'blocker_change');
                            }}
                            sx={{
                              minWidth: 160,
                              color: '#f8fafc',
                              bgcolor: blockerConfig[blocker].bgColor,
                              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' },
                            }}
                          >
                            {Object.entries(blockerConfig).map(([value, config]) => (
                              <MenuItem key={value} value={value}>{config.label}</MenuItem>
                            ))}
                          </Select>
                        </td>
                        <td>
                          <Select
                            size="small"
                            value={shot.assigneeId ?? ''}
                            displayEmpty
                            onChange={(event) => {
                              const nextAssignee = String(event.target.value || '') || undefined;
                              void updateShot(shotList, shot, { assigneeId: nextAssignee }, 'assignment_change');
                            }}
                            sx={{
                              minWidth: 170,
                              color: '#f8fafc',
                              bgcolor: shot.assigneeId ? 'rgba(56,189,248,0.14)' : 'rgba(168,85,247,0.14)',
                              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' },
                            }}
                            renderValue={(value) => {
                              if (!value) {
                                return <Typography sx={{ color: '#c4b5fd', fontSize: 12 }}>Ledig</Typography>;
                              }
                              const member = memberById.get(String(value));
                              return member?.name ?? String(value);
                            }}
                          >
                            <MenuItem value="">Ledig</MenuItem>
                            {scopedCrewMembers.map((member) => (
                              <MenuItem key={member.id} value={member.id}>{member.name}</MenuItem>
                            ))}
                          </Select>
                        </td>
                        <td>{shot.estimatedTime ? `${shot.estimatedTime}m` : '-'}</td>
                        <td>
                          <TextField
                            size="small"
                            type="number"
                            value={getShotActualTime(shot) || ''}
                            placeholder="m"
                            onChange={(event) => {
                              const parsed = Number(event.target.value);
                              if (!Number.isNaN(parsed)) {
                                void updateShot(shotList, shot, { actualTime: parsed }, 'actual_time_change');
                              }
                            }}
                            sx={{
                              width: 82,
                              '& .MuiOutlinedInput-root': {
                                color: '#f8fafc',
                                '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                              },
                            }}
                          />
                        </td>
                        {showDependencies && (
                          <td>
                            <Chip
                              size="small"
                              icon={<DependencyIcon sx={{ color: `${unresolved.length > 0 ? '#ef4444' : '#22c55e'} !important` }} />}
                              label={dependencies.length === 0 ? 'Ingen' : `${unresolved.length}/${dependencies.length} uløste`}
                              sx={{
                                bgcolor: unresolved.length > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                                color: unresolved.length > 0 ? '#ef4444' : '#22c55e',
                              }}
                            />
                          </td>
                        )}
                        <td>
                          {criticalRiskShotIds.has(shot.id) ? (
                            <Chip size="small" label="Risiko" sx={{ bgcolor: 'rgba(244,63,94,0.18)', color: '#fb7185' }} />
                          ) : (
                            <Chip size="small" label="OK" sx={{ bgcolor: 'rgba(34,197,94,0.14)', color: '#4ade80' }} />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Box>
            </Box>
          )}
        </Box>

        {showActivityPanel && (
          <Paper sx={{ width: { xs: 280, md: 340 }, borderLeft: '1px solid rgba(255,255,255,0.08)', bgcolor: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: 1.25, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <Typography sx={{ color: '#f8fafc', fontWeight: 600 }}>Audit logg</Typography>
            </Box>
            <List sx={{ flex: 1, overflow: 'auto' }}>
              {activityLog.length === 0 ? (
                <ListItem>
                  <ListItemText primary="Ingen aktivitet ennå" primaryTypographyProps={{ sx: { color: 'rgba(248,250,252,0.66)' } }} />
                </ListItem>
              ) : (
                activityLog.map((entry) => (
                  <ListItem key={entry.id} sx={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <ListItemAvatar>
                      <Avatar sx={{ width: 28, height: 28, bgcolor: '#38bdf8', fontSize: 12 }}>{entry.userName.charAt(0)}</Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={`${entry.userName}: ${entry.action}`}
                      secondary={new Date(entry.timestamp).toLocaleString('nb-NO')}
                      primaryTypographyProps={{ sx: { color: '#f8fafc', fontSize: 12.5 } }}
                      secondaryTypographyProps={{ sx: { color: 'rgba(248,250,252,0.56)', fontSize: 11 } }}
                    />
                  </ListItem>
                ))
              )}
            </List>
          </Paper>
        )}
      </Box>

      <Dialog open={assignDialogOpen} onClose={() => setAssignDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: '#0f172a', color: '#f8fafc' }}>Bulk-tilordning av ufordelte shots</DialogTitle>
        <DialogContent sx={{ bgcolor: '#0f172a', color: '#f8fafc' }}>
          <Stack spacing={1} sx={{ mt: 1 }}>
            <Typography variant="body2" sx={{ color: 'rgba(248,250,252,0.7)' }}>
              Velg medlem for rask tilordning av alle ufordelte shots.
            </Typography>
            <FormControl size="small">
              <InputLabel sx={{ color: 'rgba(248,250,252,0.7)' }}>Medlem</InputLabel>
              <Select
                value={selectedMemberForAssign}
                label="Medlem"
                onChange={(event) => setSelectedMemberForAssign(event.target.value)}
                sx={{ color: '#f8fafc', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }}
              >
                {scopedCrewMembers.map((member) => (
                  <MenuItem key={member.id} value={member.id}>{member.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#0f172a' }}>
          <Button onClick={() => setAssignDialogOpen(false)} sx={{ color: 'rgba(248,250,252,0.72)' }}>Avbryt</Button>
          <Button
            variant="contained"
            disabled={!selectedMemberForAssign}
            onClick={async () => {
              const unassigned = allShots.filter(({ shot }) => !shot.assigneeId);
              const target = scopedCrewMembers.find((member) => member.id === selectedMemberForAssign);
              if (!target) return;
              for (const { shot, shotList } of unassigned) {
                await updateShot(shotList, shot, { assigneeId: target.id }, 'bulk_assign_single');
              }
              setAssignDialogOpen(false);
              pushToast('success', `Tilordnet ${unassigned.length} shots til ${target.name}.`);
            }}
          >
            Tilordne
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={snapshotDialogOpen} onClose={() => setSnapshotDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: '#0f172a', color: '#f8fafc' }}>Dashboard snapshots</DialogTitle>
        <DialogContent sx={{ bgcolor: '#0f172a', color: '#f8fafc' }}>
          <Stack spacing={1} sx={{ mt: 1 }}>
            <TextField
              size="small"
              label="Navn på snapshot"
              value={snapshotName}
              onChange={(event) => setSnapshotName(event.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#f8fafc',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                },
                '& .MuiInputLabel-root': { color: 'rgba(248,250,252,0.72)' },
              }}
            />

            {snapshots.length > 0 && (
              <FormControl size="small">
                <InputLabel sx={{ color: 'rgba(248,250,252,0.72)' }}>Last snapshot</InputLabel>
                <Select
                  value=""
                  label="Last snapshot"
                  onChange={(event) => applySnapshot(String(event.target.value))}
                  displayEmpty
                  sx={{ color: '#f8fafc', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }}
                >
                  <MenuItem value="" disabled>Velg snapshot</MenuItem>
                  {snapshots.map((snapshot) => (
                    <MenuItem key={snapshot.id ?? snapshot.name} value={snapshot.id ?? snapshot.name}>
                      {snapshot.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#0f172a' }}>
          <Button onClick={() => setSnapshotDialogOpen(false)} sx={{ color: 'rgba(248,250,252,0.72)' }}>Lukk</Button>
          <Button aria-label="Lagre snapshot nå" variant="contained" startIcon={<SaveIcon />} onClick={() => void saveSnapshot()} disabled={snapshotBusy}>
            Lagre
          </Button>
        </DialogActions>
      </Dialog>

      <Drawer
        anchor="right"
        open={showCallSheetDrawer}
        onClose={() => setShowCallSheetDrawer(false)}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: '88%', md: '66%', lg: '54%' },
            maxWidth: 980,
            bgcolor: '#0f172a',
            color: '#f8fafc',
          },
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 1.25, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <CallSheetIcon sx={{ color: '#a78bfa' }} />
              <Typography sx={{ fontWeight: 600 }}>Daglig teknisk callsheet</Typography>
            </Stack>
            <Stack direction="row" spacing={0.5}>
              <Button size="small" variant="outlined" startIcon={<SendIcon />} onClick={sendCallSheet} sx={{ borderColor: 'rgba(56,189,248,0.5)', color: '#7dd3fc' }}>
                Send callsheet
              </Button>
              <IconButton onClick={() => setShowCallSheetDrawer(false)} sx={{ color: '#f8fafc' }}>
                <CloseIcon />
              </IconButton>
            </Stack>
          </Stack>
          <Box sx={{ p: 1.25, flex: 1, overflow: 'auto' }}>
            {projectId ? (
              <CallSheetGenerator
                projectId={projectId}
                productionDay={productionDay}
                scenes={scenes}
                crew={scopedCrewMembers}
              />
            ) : (
              <Alert severity="error">Mangler prosjekt-ID. Callsheet kan ikke genereres.</Alert>
            )}
          </Box>
        </Box>
      </Drawer>

      <Snackbar open={toastOpen} autoHideDuration={4500} onClose={() => setToastOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert onClose={() => setToastOpen(false)} severity={toastSeverity} variant="filled" sx={{ width: '100%' }}>
          {toastMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default TeamDashboard;
