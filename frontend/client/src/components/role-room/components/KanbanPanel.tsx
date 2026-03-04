import { useState, useId, useMemo, useEffect, useCallback, type DragEvent, memo } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Chip,
  Tooltip,
  IconButton,
  TextField,
  Select,
  MenuItem,
  Menu,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Add as AddIcon,
  Person as PersonIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  CheckBox as CheckBoxIcon,
  CheckBoxOutlineBlank as CheckBoxBlankIcon,
  IndeterminateCheckBox as IndeterminateIcon,
  MoveDown as MoveIcon,
  EventAvailable as EventIcon,
  Deselect as DeselectIcon,
  WifiTethering as WsOnIcon,
  WifiTetheringOff as WsOffIcon,
  Replay as ReplayIcon,
  ArrowDropDown as ArrowDropDownIcon,
  DeleteOutline as DeleteIcon,
  LocalOffer as TagIcon,
  HelpOutline as HelpIcon,
} from '@mui/icons-material';
import KanbanGuide from './KanbanGuide';
import type { Candidate, Role, CastingProject, Schedule } from '../models/casting';
import { castingService } from '../services/castingService';
import { useToast } from './ToastStack';
import { useKanbanRealtime } from './useKanbanRealtime';
import { useAuth } from '../../../hooks/useAuth';
import { getCandidatePhotoObjectPosition } from '../utils/candidatePhotoFocalPoint';

// WCAG 2.2 - 2.5.5 Target Size: minimum 44x44px touch targets
const TOUCH_TARGET_SIZE = 44;

// WCAG 2.2 - 2.4.7 Focus Visible: clear focus indicator
const focusVisibleStyles = {
  '&:focus-visible': {
    outline: '3px solid #84cc16',
    outlineOffset: 2,
  },
};

// ─── Role-based Kanban config ────────────────────────────────────────────────
const ALL_STATUSES: CandidateStatus[] = ['pending', 'requested', 'shortlist', 'selected', 'confirmed', 'rejected'];

interface RoleKanbanConfig {
  label: string;
  icon: string | null;       // webp path matching LoginDialog ROLE_CARDS
  accentColor: string;       // matching LoginDialog ROLE_COLOURS
  columns: CandidateStatus[];
  canAdd: boolean;           // show "Add Candidate" buttons
  canMove: boolean;          // cards are draggable
  canBulkAction: boolean;    // show bulk bar + checkboxes
  canAssignEvent: boolean;   // show "Assign to Event" action
  toolbarHint: string;
  emptyStateTitle: string;
  emptyStateBody: string;
}

const ROLE_KANBAN_CONFIG: Record<string, RoleKanbanConfig> = {
  casting_director: {
    label: 'Casting Director',
    icon: '/role-room-assets/roleroom_casting_director.webp',
    accentColor: '#d250e6',
    columns: ALL_STATUSES,
    canAdd: true, canMove: true, canBulkAction: true, canAssignEvent: true,
    toolbarHint: 'Full casting-kontroll — flytt, vurder og bestill talent',
    emptyStateTitle: 'Start casting-prosessen',
    emptyStateBody: 'Legg til kandidater og dra dem gjennom trinnene.',
  },
  director: {
    label: 'Regissør',
    icon: '/role-room-assets/roleroom_director.webp',
    accentColor: '#e64646',
    columns: ['shortlist', 'selected', 'confirmed', 'rejected'],
    canAdd: false, canMove: false, canBulkAction: false, canAssignEvent: false,
    toolbarHint: 'Din oversikt over shortlistet og bekreftet talent',
    emptyStateTitle: 'Ingen kandidater på kortlisten',
    emptyStateBody: 'Casting-direktøren har ikke lagt til kandidater ennå.',
  },
  producer: {
    label: 'Produsent',
    icon: '/role-room-assets/roleroom_producer.webp',
    accentColor: '#e68c32',
    columns: ALL_STATUSES,
    canAdd: true, canMove: true, canBulkAction: true, canAssignEvent: true,
    toolbarHint: 'Full oversikt for budsjettering og timeplanlegging',
    emptyStateTitle: 'Ingen kandidater ennå',
    emptyStateBody: 'Legg til kandidater for å spore casting-pipeline.',
  },
  photographer: {
    label: 'Fotograf',
    icon: '/role-room-assets/roleroom_photographer.webp',
    accentColor: '#64b4ff',
    columns: ['selected', 'confirmed'],
    canAdd: false, canMove: false, canBulkAction: false, canAssignEvent: false,
    toolbarHint: 'Bekreftet talent for din seanse',
    emptyStateTitle: 'Ingen bekreftet talent ennå',
    emptyStateBody: 'Talent som er bekreftet for din seanse vises her.',
  },
  film_photographer: {
    label: 'Filmfotograf',
    icon: '/role-room-assets/roleroom_filmfotograf.webp',
    accentColor: '#5096ff',
    columns: ['selected', 'confirmed'],
    canAdd: false, canMove: false, canBulkAction: false, canAssignEvent: false,
    toolbarHint: 'Bekreftet talent for innspillingen',
    emptyStateTitle: 'Ingen bekreftet talent ennå',
    emptyStateBody: 'Talent som er bekreftet for innspillingen vises her.',
  },
  photo_director: {
    label: 'Fotodirektør',
    icon: '/role-room-assets/roleroom_photo_director.webp',
    accentColor: '#8264ff',
    columns: ['shortlist', 'selected', 'confirmed', 'rejected'],
    canAdd: false, canMove: false, canBulkAction: false, canAssignEvent: false,
    toolbarHint: 'Shortlistet og godkjent talent',
    emptyStateTitle: 'Ingen kandidater på kortlisten',
    emptyStateBody: 'Shortlistet talent vises her.',
  },
  photo_assistant: {
    label: 'Fotoassistent',
    icon: '/role-room-assets/roleroom_photo_assistant.webp',
    accentColor: '#a0d2ff',
    columns: ['confirmed'],
    canAdd: false, canMove: false, canBulkAction: false, canAssignEvent: false,
    toolbarHint: 'Bekreftet talent du jobber med',
    emptyStateTitle: 'Ingen bekreftet talent ennå',
    emptyStateBody: 'Bekreftet talent vises her.',
  },
  talent: {
    label: 'Skuespiller',
    icon: '/role-room-assets/roleroom_skuespiller.webp',
    accentColor: '#50d782',
    columns: ['pending', 'shortlist', 'confirmed', 'rejected'],
    canAdd: false, canMove: false, canBulkAction: false, canAssignEvent: false,
    toolbarHint: 'Din audition-status',
    emptyStateTitle: 'Ingen auditions ennå',
    emptyStateBody: 'Dine casting-søknader og audition-resultater vises her.',
  },
  agent: {
    label: 'Agent',
    icon: '/role-room-assets/roleroom_agent.webp',
    accentColor: '#e6b932',
    columns: ALL_STATUSES,
    canAdd: true, canMove: false, canBulkAction: false, canAssignEvent: false,
    toolbarHint: 'Send klienter til riktige roller',
    emptyStateTitle: 'Ingen klienter lagt til ennå',
    emptyStateBody: 'Legg til klientene dine som kandidater og følg statusen deres.',
  },
  client: {
    label: 'Klient',
    icon: '/role-room-assets/roleroom_klient.webp',
    accentColor: '#b482ff',
    columns: ['selected', 'confirmed'],
    canAdd: false, canMove: false, canBulkAction: false, canAssignEvent: false,
    toolbarHint: 'Bekreftet talent for din produksjon',
    emptyStateTitle: 'Ingen bekreftet talent ennå',
    emptyStateBody: 'Godkjent talent for produksjonen vises her.',
  },
  camera_operator: {
    label: 'Kamera',
    icon: '/role-room-assets/roleroom_cinemag.webp',
    accentColor: '#5ac8b4',
    columns: ['confirmed'],
    canAdd: false, canMove: false, canBulkAction: false, canAssignEvent: false,
    toolbarHint: 'Bekreftet talent du jobber med',
    emptyStateTitle: 'Ingen bekreftet talent ennå',
    emptyStateBody: 'Bekreftet talent vises her.',
  },
  sound_designer: {
    label: 'Lyddesigner',
    icon: '/role-room-assets/roleroom_sound_designer.webp',
    accentColor: '#3cc8dc',
    columns: ['confirmed'],
    canAdd: false, canMove: false, canBulkAction: false, canAssignEvent: false,
    toolbarHint: 'Bekreftet talent du jobber med',
    emptyStateTitle: 'Ingen bekreftet talent ennå',
    emptyStateBody: 'Bekreftet talent vises her.',
  },
  sound_mixer: {
    label: 'Lydmikser',
    icon: null,
    accentColor: '#46c8c8',
    columns: ['confirmed'],
    canAdd: false, canMove: false, canBulkAction: false, canAssignEvent: false,
    toolbarHint: 'Bekreftet talent du jobber med',
    emptyStateTitle: 'Ingen bekreftet talent ennå',
    emptyStateBody: 'Bekreftet talent vises her.',
  },
  boom_operator: {
    label: 'Bom-operator',
    icon: null,
    accentColor: '#46bec8',
    columns: ['confirmed'],
    canAdd: false, canMove: false, canBulkAction: false, canAssignEvent: false,
    toolbarHint: 'Bekreftet talent du jobber med',
    emptyStateTitle: 'Ingen bekreftet talent ennå',
    emptyStateBody: 'Bekreftet talent vises her.',
  },
  composer: {
    label: 'Komponist',
    icon: null,
    accentColor: '#9169ff',
    columns: ['confirmed'],
    canAdd: false, canMove: false, canBulkAction: false, canAssignEvent: false,
    toolbarHint: 'Bekreftet talent du jobber med',
    emptyStateTitle: 'Ingen bekreftet talent ennå',
    emptyStateBody: 'Bekreftet talent vises her.',
  },
  admin: {
    label: 'Admin',
    icon: '/role-room-assets/roleroom_dashboard.webp',
    accentColor: '#8270ff',
    columns: ALL_STATUSES,
    canAdd: true, canMove: true, canBulkAction: true, canAssignEvent: true,
    toolbarHint: 'Full administrativ tilgang',
    emptyStateTitle: 'Ingen kandidater ennå',
    emptyStateBody: 'Legg til kandidater for å starte casting-prosessen.',
  },
};

const DEFAULT_ROLE_CONFIG: RoleKanbanConfig = {
  label: '',
  icon: null,
  accentColor: '#8b5cf6',
  columns: ALL_STATUSES,
  canAdd: true, canMove: true, canBulkAction: true, canAssignEvent: true,
  toolbarHint: '',
  emptyStateTitle: 'Organiser kandidatene dine',
  emptyStateBody: 'Kanban-tavlen lar deg visuelt spore kandidater gjennom casting-prosessen ved å dra og slippe mellom kolonner.',
};

interface KanbanPanelProps {
  project: CastingProject | null;
  candidates: Candidate[];
  roles: Role[];
  onCandidatesChange: () => void;
  onEditCandidate: (candidate: Candidate) => void;
  onCreateCandidate: () => void;
  onNavigateToTab: (tabIndex: number) => void;
  userRole?: string; // override: if not provided, read from useAuth().user.profession
}

type CandidateStatus = 'pending' | 'requested' | 'shortlist' | 'selected' | 'confirmed' | 'rejected';

interface KanbanColumn {
  status: CandidateStatus;
  label: string;
  color: string;
}

const KANBAN_COLUMNS: KanbanColumn[] = [
  { status: 'pending',   label: 'Ingen status', color: '#6b7280' },
  { status: 'requested', label: 'Forespurt',    color: '#00d4ff' },
  { status: 'shortlist', label: 'Vurderes',     color: '#ffb800' },
  { status: 'selected',  label: 'Valgt',        color: '#8b5cf6' },
  { status: 'confirmed', label: 'Bekreftet',    color: '#10b981' },
  { status: 'rejected',  label: 'Avvist',       color: '#ef4444' },
];

const STATUS_OPTIONS = KANBAN_COLUMNS.map(c => ({ value: c.status, label: c.label, color: c.color }));

const PAGE_SIZE = 8;

// ─── AssignEventDialog ────────────────────────────────────────────────────────
interface AssignEventDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  candidateIds: string[];
  candidates: Candidate[];
  roles: Role[];
  onSuccess: () => void;
}

function AssignEventDialog({
  open, onClose, projectId, candidateIds, candidates, roles, onSuccess,
}: AssignEventDialogProps) {
  const { showSuccess, showError } = useToast();
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [time, setTime] = useState('10:00');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [roleId, setRoleId] = useState(roles[0]?.id ?? '');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setDate(new Date().toISOString().split('T')[0]);
      setTime('10:00');
      setEndTime('');
      setLocation('');
      setRoleId(roles[0]?.id ?? '');
      setNotes('');
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!date || !time) return;
    setLoading(true);
    try {
      for (const candidateId of candidateIds) {
        const schedule: Schedule = {
          id: `schedule-${Date.now()}-${candidateId}`,
          candidateId,
          roleId: roleId || (roles[0]?.id ?? ''),
          date,
          time,
          endTime: endTime || undefined,
          location,
          notes,
          status: 'scheduled',
        };
        await castingService.saveSchedule(projectId, schedule);
      }
      const names = candidateIds
        .map(id => candidates.find(c => c.id === id)?.name ?? id)
        .join(', ');
      showSuccess(`Audition-event opprettet for: ${names}`);
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      showError('Kunne ikke opprette audition-event. Prøv igjen.');
    } finally {
      setLoading(false);
    }
  };

  const inputSx = {
    '& .MuiOutlinedInput-root': {
      color: '#fff',
      '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
      '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
      '&.Mui-focused fieldset': { borderColor: '#8b5cf6' },
    },
    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
  };

  const names = candidateIds
    .map(id => candidates.find(c => c.id === id)?.name ?? id)
    .join(', ');

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { bgcolor: '#1c2128', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' } }}
    >
      <DialogTitle sx={{ color: '#fff', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.1)', pb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <EventIcon sx={{ color: '#8b5cf6' }} />
          Tilordne audition-event
        </Box>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', mt: 0.5, fontWeight: 400, fontSize: '0.8rem' }}>
          {candidateIds.length} kandidat{candidateIds.length !== 1 ? 'er' : ''}: {names}
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 3 }}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField label="Dato" type="date" value={date} onChange={e => setDate(e.target.value)}
            fullWidth size="small" InputLabelProps={{ shrink: true }} sx={inputSx} />
          <TextField label="Starttid" type="time" value={time} onChange={e => setTime(e.target.value)}
            fullWidth size="small" InputLabelProps={{ shrink: true }} sx={inputSx} />
          <TextField label="Slutttid (valgfri)" type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
            fullWidth size="small" InputLabelProps={{ shrink: true }} sx={inputSx} />
        </Box>
        <TextField label="Sted / Lokasjon" value={location} onChange={e => setLocation(e.target.value)}
          fullWidth size="small" placeholder="f.eks. Studio A…" sx={inputSx} />
        {roles.length > 0 && (
          <TextField select label="Rolle (valgfri)" value={roleId} onChange={e => setRoleId(e.target.value)}
            fullWidth size="small" sx={inputSx}
            SelectProps={{ MenuProps: { PaperProps: { sx: { bgcolor: '#1c2128', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' } } } }}>
            <MenuItem value=""><em>Ingen rolle valgt</em></MenuItem>
            {roles.map(r => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
          </TextField>
        )}
        <TextField label="Notater (valgfri)" value={notes} onChange={e => setNotes(e.target.value)}
          fullWidth size="small" multiline rows={2} sx={inputSx} />
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, borderTop: '1px solid rgba(255,255,255,0.1)', pt: 2, gap: 1 }}>
        <Button onClick={onClose} sx={{ color: 'rgba(255,255,255,0.7)' }} disabled={loading}>Avbryt</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={!date || !time || loading}
          startIcon={loading ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : <EventIcon />}
          sx={{ bgcolor: '#8b5cf6', '&:hover': { bgcolor: '#7c3aed' } }}>
          {loading ? 'Oppretter…' : `Opprett event (${candidateIds.length})`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── BulkActionBar ────────────────────────────────────────────────────────────
interface BulkActionBarProps {
  count: number;
  total: number;
  allSelected: boolean;
  onToggleSelectAll: () => void;
  onMoveClick: (anchor: HTMLElement) => void;
  onAssignEvent: () => void;
  onClearSelection: () => void;
  onRemove: () => void;
}

function BulkActionBar({
  count, total, allSelected, onToggleSelectAll,
  onMoveClick, onAssignEvent, onClearSelection, onRemove,
}: BulkActionBarProps) {
  const btnSx = {
    borderColor: 'rgba(255,255,255,0.18)',
    color: '#e5e7eb',
    textTransform: 'none' as const,
    fontWeight: 500,
    fontSize: '13px',
    px: 1.5,
    py: 0.5,
    minHeight: 34,
    borderRadius: 1.5,
    '&:hover': { bgcolor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.35)' },
  };
  return (
    <Box
      role="toolbar"
      aria-label="Massehandlinger"
      sx={{
        display: 'flex', alignItems: 'center', gap: 1,
        px: 2, py: 1,
        mt: 1.5,
        borderRadius: 2,
        bgcolor: 'rgba(15,17,23,0.9)',
        border: '1px solid rgba(255,255,255,0.12)',
        backdropFilter: 'blur(8px)',
        flexWrap: 'wrap',
        boxShadow: '0 -2px 16px rgba(0,0,0,0.4)',
      }}
    >
      {/* Select-all checkbox */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, cursor: 'pointer' }} onClick={onToggleSelectAll}>
        <Checkbox
          checked={allSelected}
          indeterminate={!allSelected && count > 0}
          size="small"
          sx={{ p: 0.25, color: 'rgba(255,255,255,0.5)', '&.Mui-checked': { color: '#a78bfa' }, '&.MuiCheckbox-indeterminate': { color: '#a78bfa' } }}
        />
        <Typography variant="body2" sx={{ color: '#e5e7eb', fontSize: '13px', userSelect: 'none' }}>
          Velg alle
        </Typography>
      </Box>

      {/* Count badge */}
      <Chip
        label={count}
        size="small"
        sx={{ bgcolor: 'rgba(139,92,246,0.2)', color: '#a78bfa', fontWeight: 700, height: 22, fontSize: '12px', ml: 0.5 }}
      />

      {/* Divider */}
      <Box sx={{ width: '1px', height: 20, bgcolor: 'rgba(255,255,255,0.15)', mx: 0.5 }} />

      {/* Assign to event */}
      <Button variant="outlined" size="small" startIcon={<EventIcon sx={{ fontSize: 15 }} />}
        endIcon={<ArrowDropDownIcon sx={{ fontSize: 16 }} />}
        onClick={onAssignEvent} sx={btnSx}>
        Assign to Event
      </Button>

      {/* Set status */}
      <Button variant="outlined" size="small" startIcon={<MoveIcon sx={{ fontSize: 15 }} />}
        endIcon={<ArrowDropDownIcon sx={{ fontSize: 16 }} />}
        onClick={e => onMoveClick(e.currentTarget)} sx={btnSx}>
        Set Status
      </Button>

      {/* Remove */}
      <Button variant="outlined" size="small"
        startIcon={<DeleteIcon sx={{ fontSize: 15 }} />}
        endIcon={<ArrowDropDownIcon sx={{ fontSize: 16 }} />}
        onClick={onRemove}
        sx={{ ...btnSx, borderColor: 'rgba(239,68,68,0.35)', color: '#fca5a5', '&:hover': { bgcolor: 'rgba(239,68,68,0.1)', borderColor: '#ef4444' } }}>
        Remove {count}
      </Button>

      <Box sx={{ flex: 1 }} />

      {/* Count + sync + save icons */}
      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>{total}</Typography>
      <Tooltip title="Fjern valg">
        <IconButton size="small" onClick={onClearSelection} sx={{ color: 'rgba(255,255,255,0.4)', p: 0.75, '&:hover': { color: '#fff' } }}>
          <DeselectIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

function KanbanPanelInner({
  project,
  candidates,
  roles,
  onCandidatesChange,
  onEditCandidate,
  onCreateCandidate,
  onNavigateToTab,
  userRole,
}: KanbanPanelProps) {
  const theme = useTheme();
  const _isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const _isTablet = useMediaQuery(theme.breakpoints.down('md'));

  // Role-based config — reads profession from logged-in user (overridable via prop)
  const { user } = useAuth();
  const effectiveRole = userRole || user?.profession || null;
  const roleConfig = (effectiveRole && ROLE_KANBAN_CONFIG[effectiveRole]) || DEFAULT_ROLE_CONFIG;
  const titleId = useId();
  // statsId removed (stats panel removed)
  const { showError, showSuccess } = useToast();

  // Realtime WebSocket
  const { connected: wsConnected } = useKanbanRealtime(project?.id, onCandidatesChange);

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRoleId, setFilterRoleId] = useState('all');
  // showStats removed (stats panel removed)
  const [draggedCandidateId, setDraggedCandidateId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<CandidateStatus | null>(null);
  const [optimisticStatuses, setOptimisticStatuses] = useState<Record<string, CandidateStatus>>({});
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(new Set());
  // Pagination: 1 page = PAGE_SIZE items visible per column
  const [columnPages, setColumnPages] = useState<Record<CandidateStatus, number>>(
    () => Object.fromEntries(KANBAN_COLUMNS.map(c => [c.status, 1])) as Record<CandidateStatus, number>
  );
  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMoveAnchor, setBulkMoveAnchor] = useState<HTMLElement | null>(null);
  // Assign event dialog
  const [assignEventOpen, setAssignEventOpen] = useState(false);
  const [assignEventIds, setAssignEventIds] = useState<string[]>([]);
  // Guide
  const [guideOpen, setGuideOpen] = useState(false);

  const containerPadding = { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 3 };

  // Keyboard shortcuts (scoped: skip when typing in inputs)
  // Uses Ctrl+Shift+N to avoid conflict with browser's Ctrl+N (new tab/window)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
        if (e.key === 'N') { e.preventDefault(); onCreateCandidate(); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCreateCandidate]);

  // O(1) role name lookup
  const roleById = useMemo(() => new Map(roles.map(r => [r.id, r.name])), [roles]);

  // Apply optimistic status overrides for in-flight saves
  const displayCandidates = useMemo(
    () => candidates.map(c =>
      optimisticStatuses[c.id] !== undefined
        ? { ...c, status: optimisticStatuses[c.id] }
        : c
    ),
    [candidates, optimisticStatuses]
  );

  // Filter candidates by role + search
  const filteredCandidates = useMemo(() => {
    let base = displayCandidates;
    if (filterRoleId !== 'all') base = base.filter(c => c.assignedRoles?.includes(filterRoleId));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      base = base.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.contactInfo.email?.toLowerCase().includes(q) ||
        c.auditionNotes?.toLowerCase().includes(q)
      );
    }
    return base;
  }, [displayCandidates, searchQuery, filterRoleId]);

  // Select All / deselect all across filtered candidates
  const handleToggleSelectAll = useCallback(() => {
    setSelectedIds(prev => {
      const allIds = filteredCandidates.map(c => c.id);
      const allSelected = allIds.length > 0 && allIds.every(id => prev.has(id));
      return allSelected ? new Set() : new Set(allIds);
    });
  }, [filteredCandidates]);

  // Reset pagination when filter/search changes
  useEffect(() => {
    setColumnPages(Object.fromEntries(KANBAN_COLUMNS.map(c => [c.status, 1])) as Record<CandidateStatus, number>);
  }, [searchQuery, filterRoleId]);

  // Statistics (derived from display state, reflecting optimistic updates)
  const statistics = useMemo(() => {
    const stats: Record<CandidateStatus, number> = {
      pending: 0, requested: 0, shortlist: 0, selected: 0, confirmed: 0, rejected: 0
    };
    displayCandidates.forEach(c => { if (stats[c.status] !== undefined) stats[c.status]++; });
    return stats;
  }, [displayCandidates]);

  const _progressPercentage = useMemo(() => {
    if (displayCandidates.length === 0) return 0;
    return Math.round((statistics.confirmed / displayCandidates.length) * 100);
  }, [displayCandidates, statistics]);

  // Columns visible for current role (derived from roleConfig)
  const visibleColumns = useMemo(
    () => KANBAN_COLUMNS.filter(c => roleConfig.columns.includes(c.status)),
    [roleConfig]
  );

  // Handlers
  const toggleColumnCollapse = useCallback((status: string) => {
    setCollapsedColumns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(status)) newSet.delete(status);
      else newSet.add(status);
      return newSet;
    });
  }, []);

  const handleDrop = useCallback(async (e: DragEvent<HTMLDivElement>, targetStatus: CandidateStatus) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverColumnId(null);

    const candidateId = e.dataTransfer.getData('text/plain') || draggedCandidateId;
    setDraggedCandidateId(null);

    if (!candidateId || !project) return;
    const candidate = candidates.find(c => c.id === candidateId);
    if (!candidate || candidate.status === targetStatus) return;

    // Optimistic update — instantly reflect new status in UI
    setOptimisticStatuses(prev => ({ ...prev, [candidateId]: targetStatus }));
    try {
      const updated = { ...candidate, status: targetStatus, updatedAt: new Date().toISOString() };
      await castingService.saveCandidate(project.id, updated);
      onCandidatesChange();
      setOptimisticStatuses(prev => { const next = { ...prev }; delete next[candidateId]; return next; });
    } catch (error) {
      console.error('Failed to save candidate status:', error);
      setOptimisticStatuses(prev => { const next = { ...prev }; delete next[candidateId]; return next; });
      showError('Kunne ikke oppdatere status. Prøv igjen.');
    }
  }, [candidates, draggedCandidateId, project, onCandidatesChange, showError]);

  // Bulk selection helpers
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }, []);

  const toggleSelectColumn = useCallback((status: CandidateStatus) => {
    const ids = filteredCandidates.filter(c => c.status === status).map(c => c.id);
    const allSelected = ids.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (allSelected) ids.forEach(id => n.delete(id));
      else ids.forEach(id => n.add(id));
      return n;
    });
  }, [filteredCandidates, selectedIds]);

  // Bulk move to status
  const handleBulkMove = useCallback(async (targetStatus: CandidateStatus) => {
    setBulkMoveAnchor(null);
    if (!project) return;
    const ids = Array.from(selectedIds);
    setSelectedIds(new Set());
    let errorCount = 0;
    for (const id of ids) {
      const candidate = candidates.find(c => c.id === id);
      if (!candidate || candidate.status === targetStatus) continue;
      setOptimisticStatuses(prev => ({ ...prev, [id]: targetStatus }));
      try {
        await castingService.saveCandidate(project.id, { ...candidate, status: targetStatus, updatedAt: new Date().toISOString() });
        setOptimisticStatuses(prev => { const n = { ...prev }; delete n[id]; return n; });
      } catch {
        setOptimisticStatuses(prev => { const n = { ...prev }; delete n[id]; return n; });
        errorCount++;
      }
    }
    onCandidatesChange();
    if (errorCount === 0) showSuccess(`${ids.length} kandidater flyttet.`);
    else showError(`${errorCount} av ${ids.length} feilet.`);
  }, [candidates, project, selectedIds, onCandidatesChange, showSuccess, showError]);

  // Open assign-event dialog
  const openAssignEvent = useCallback((ids?: string[]) => {
    const finalIds = ids ?? Array.from(selectedIds);
    if (finalIds.length === 0) return;
    setAssignEventIds(finalIds);
    setAssignEventOpen(true);
    setBulkMoveAnchor(null);
  }, [selectedIds]);

  return (
    <Box
      component="section"
      aria-labelledby={titleId}
      sx={{ p: containerPadding, width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}
    >
      {/* ── Compact toolbar header ─────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <Typography id={titleId} variant="h6"
          sx={{ color: '#fff', fontWeight: 700, fontSize: '15px', mr: 0.5 }}>Kanban</Typography>

        {/* Role badge — icon + label + accent colour matching LoginDialog ROLE_CARDS */}
        {roleConfig.label && (
          <Tooltip title={roleConfig.toolbarHint || ''}>
            <Chip
              avatar={
                roleConfig.icon ? (
                  <Box component="img" src={roleConfig.icon}
                    sx={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover' }} />
                ) : undefined
              }
              label={roleConfig.label}
              size="small"
              sx={{
                bgcolor: `${roleConfig.accentColor}1a`,
                color: roleConfig.accentColor,
                border: `1px solid ${roleConfig.accentColor}40`,
                height: 22, fontSize: '11px', fontWeight: 600,
                '& .MuiChip-label': { px: 0.75 },
                '& .MuiChip-avatar': { width: 18, height: 18, ml: 0.25 },
                cursor: roleConfig.toolbarHint ? 'help' : 'default',
              }}
            />
          </Tooltip>
        )}

        {/* WS dot */}
        <Tooltip title={wsConnected ? 'Sanntid tilkoblet' : 'Sanntid frakoblet'}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {wsConnected
              ? <WsOnIcon sx={{ fontSize: 14, color: '#10b981' }} />
              : <WsOffIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.25)' }} />}
          </Box>
        </Tooltip>

        {/* Refresh */}
        <Tooltip title="Oppdater">
          <IconButton size="small" onClick={onCandidatesChange}
            sx={{ color: 'rgba(255,255,255,0.5)', p: 0.5, '&:hover': { color: '#fff' } }}>
            <ReplayIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>

        {/* Add Candidate split-button — only for roles with canAdd */}
        {roleConfig.canAdd && (
          <Button variant="outlined" size="small"
            startIcon={<AddIcon sx={{ fontSize: 14 }} />}
            endIcon={<ArrowDropDownIcon sx={{ fontSize: 14 }} />}
            onClick={onCreateCandidate}
            sx={{ borderColor: 'rgba(255,255,255,0.2)', color: '#e5e7eb', textTransform: 'none',
              fontSize: '12px', px: 1.25, py: 0.4, minHeight: 30, borderRadius: 1.5,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.4)' } }}>
            + Add Candidate
          </Button>
        )}

        <Box sx={{ flex: 1 }} />

        {/* Search */}
        <TextField
          placeholder="Søk…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          size="small"
          slotProps={{
            input: { startAdornment: <SearchIcon sx={{ color: 'rgba(255,255,255,0.4)', mr: 0.5, fontSize: 15 }} /> },
            htmlInput: { 'aria-label': 'Søk i kandidater' },
          }}
          sx={{
            width: 160,
            '& .MuiOutlinedInput-root': {
              color: '#fff', height: 30, fontSize: '12px',
              '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
              '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.35)' },
              '&.Mui-focused fieldset': { borderColor: '#8b5cf6' },
            },
          }}
        />

        {/* Role filter */}
        {roles.length > 0 && (
          <Select value={filterRoleId} onChange={e => setFilterRoleId(e.target.value)}
            size="small" displayEmpty
            MenuProps={{ PaperProps: { sx: { bgcolor: '#1c2128', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' } } }}
            sx={{
              color: '#e5e7eb', height: 30, fontSize: '12px', minWidth: 110,
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.15)' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.35)' },
              '& .MuiSelect-icon': { color: 'rgba(255,255,255,0.4)' },
            }}>
            <MenuItem value="all" sx={{ color: '#fff', fontSize: '13px' }}>Alle roller</MenuItem>
            {roles.map(r => <MenuItem key={r.id} value={r.id} sx={{ color: '#fff', fontSize: '13px' }}>{r.name}</MenuItem>)}
          </Select>
        )}

        {(searchQuery || filterRoleId !== 'all') && (
          <Tooltip title="Nullstill filter">
            <IconButton size="small" onClick={() => { setSearchQuery(''); setFilterRoleId('all'); }}
              sx={{ color: 'rgba(255,255,255,0.5)', p: 0.5 }}>
              <ClearIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </Tooltip>
        )}

        {/* New Roles */}
        <Button variant="outlined" size="small"
          endIcon={<ArrowDropDownIcon sx={{ fontSize: 14 }} />}
          onClick={() => onNavigateToTab(1)}
          sx={{ borderColor: 'rgba(255,255,255,0.2)', color: '#e5e7eb', textTransform: 'none',
            fontSize: '12px', px: 1.25, py: 0.4, minHeight: 30, borderRadius: 1.5,
            '&:hover': { bgcolor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.4)' } }}>
          + New Roles
        </Button>

        {/* Help */}
        <Tooltip title="Åpne Kanban-guide">
          <IconButton size="small" onClick={() => setGuideOpen(true)}
            sx={{ color: 'rgba(255,255,255,0.4)', p: 0.5, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 1,
              '&:hover': { color: '#84cc16', borderColor: '#84cc16', bgcolor: 'rgba(132,204,22,0.08)' } }}>
            <HelpIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Bulk move menu */}
      <Menu
        anchorEl={bulkMoveAnchor}
        open={Boolean(bulkMoveAnchor)}
        onClose={() => setBulkMoveAnchor(null)}
        PaperProps={{ sx: { bgcolor: '#1c2128', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' } }}
      >
        {STATUS_OPTIONS.map(opt => (
          <MenuItem key={opt.value} onClick={() => handleBulkMove(opt.value)}
            sx={{ gap: 1.5, '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: opt.color, flexShrink: 0 }} />
            {opt.label}
          </MenuItem>
        ))}
      </Menu>

      {/* Empty State */}
      {displayCandidates.length === 0 ? (
        <Box
          sx={{
            textAlign: 'center',
            py: 8,
            px: 4,
            bgcolor: 'rgba(132, 204, 22, 0.03)',
            borderRadius: 3,
            border: '2px dashed rgba(132, 204, 22, 0.2)',
          }}
        >
          <Box
            sx={{
              width: { xs: 64, sm: 80, md: 72, lg: 88, xl: 104 },
              height: { xs: 64, sm: 80, md: 72, lg: 88, xl: 104 },
              borderRadius: '50%',
              bgcolor: 'rgba(132, 204, 22, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto',
              mb: { xs: 2, sm: 3, md: 2.5, lg: 3, xl: 3.5 },
            }}
          >
            <AddIcon sx={{ fontSize: { xs: 32, sm: 40, md: 36, lg: 44, xl: 52 }, color: '#84cc16' }} />
          </Box>
          <Typography variant="h5" sx={{ color: '#fff', fontWeight: 600, mb: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 }, fontSize: { xs: '1.1rem', sm: '1.25rem', md: '1.15rem', lg: '1.35rem', xl: '1.5rem' } }}>
            {roleConfig.emptyStateTitle}
          </Typography>
          <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.6)', mb: { xs: 3, sm: 4, md: 3.5, lg: 4, xl: 4.5 }, maxWidth: { xs: '100%', sm: 450, md: 420, lg: 480, xl: 540 }, mx: 'auto', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>
            {roleConfig.emptyStateBody}
          </Typography>
          <Box sx={{ display: 'flex', gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 }, justifyContent: 'center', flexWrap: 'wrap' }}>
            {roleConfig.canAdd && (
              <Button
                variant="contained"
                size="large"
                startIcon={<AddIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
                onClick={onCreateCandidate}
                sx={{
                  bgcolor: roleConfig.accentColor || '#84cc16',
                  color: '#000',
                  fontWeight: 600,
                  px: { xs: 3, sm: 4, md: 3.5, lg: 4, xl: 5 },
                  py: { xs: 1.25, sm: 1.5, md: 1.375, lg: 1.5, xl: 1.75 },
                  minHeight: TOUCH_TARGET_SIZE,
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                  '&:hover': { bgcolor: roleConfig.accentColor || '#65a30d', filter: 'brightness(0.85)', transform: 'translateY(-2px)' },
                  ...focusVisibleStyles,
                }}
              >
                Legg til første kandidat
              </Button>
            )}
            <Button
              variant="outlined"
              size="large"
              onClick={() => onNavigateToTab(2)}
              sx={{
                borderColor: 'rgba(255,255,255,0.3)',
                color: '#fff',
                fontWeight: 600,
                px: { xs: 3, sm: 4, md: 3.5, lg: 4, xl: 5 },
                py: { xs: 1.25, sm: 1.5, md: 1.375, lg: 1.5, xl: 1.75 },
                minHeight: TOUCH_TARGET_SIZE,
                fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                '&:hover': { borderColor: roleConfig.accentColor || '#84cc16', bgcolor: `${roleConfig.accentColor || '#84cc16'}1a` },
                ...focusVisibleStyles,
              }}
            >
              Gå til kandidatliste
            </Button>
          </Box>
        </Box>
      ) : (
        /* Kanban Board */
        <Box
          sx={{
            display: 'flex',
            gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
            overflowX: 'auto',
            pb: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
            '&::-webkit-scrollbar': { height: { xs: 6, sm: 8, md: 7, lg: 8, xl: 10 } },
            '&::-webkit-scrollbar-track': { bgcolor: 'rgba(255,255,255,0.05)', borderRadius: { xs: 3, sm: 4, md: 3.5, lg: 4, xl: 5 } },
            '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.2)', borderRadius: { xs: 3, sm: 4, md: 3.5, lg: 4, xl: 5 }, '&:hover': { bgcolor: 'rgba(255,255,255,0.6)' } },
          }}
        >
          {visibleColumns.map((column) => {
            const columnCandidates = filteredCandidates.filter(c => c.status === column.status);
            const visibleCount = (columnPages[column.status] ?? 1) * PAGE_SIZE;
            const visibleCandidates = columnCandidates.slice(0, visibleCount);
            const hasMore = columnCandidates.length > visibleCount;
            const remaining = columnCandidates.length - visibleCount;
            const isCollapsed = collapsedColumns.has(column.status);
            const allColSelected = columnCandidates.length > 0 && columnCandidates.every(c => selectedIds.has(c.id));
            const someColSelected = columnCandidates.some(c => selectedIds.has(c.id)) && !allColSelected;

            return (
              <Box
                key={column.status}
                role="region"
                aria-label={`${column.label} kolonne – ${columnCandidates.length} kandidater`}
                sx={{
                  minWidth: isCollapsed ? { xs: 50, sm: 60, md: 55, lg: 65, xl: 75 } : { xs: 240, sm: 280, md: 260, lg: 300, xl: 360 },
                  maxWidth: isCollapsed ? { xs: 50, sm: 60, md: 55, lg: 65, xl: 75 } : { xs: 280, sm: 320, md: 300, lg: 360, xl: 420 },
                  flex: isCollapsed ? 'none' : 1,
                  bgcolor: 'rgba(255,255,255,0.03)',
                  borderRadius: 2,
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderTop: `3px solid ${column.color}`,
                  display: 'flex',
                  flexDirection: 'column',
                  maxHeight: 'calc(100vh - 380px)',
                  transition: 'all 0.2s ease',
                  ...(draggedCandidateId && { boxShadow: `0 0 0 2px ${column.color}40` }),
                }}
              >
                {/* Column Header */}
                <Box
                  sx={{
                    px: 2, py: 1.5,
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                    bgcolor: `${column.color}08`,
                    display: 'flex',
                    justifyContent: isCollapsed ? 'center' : 'space-between',
                    alignItems: 'center',
                    flexDirection: isCollapsed ? 'column' : 'row',
                    gap: isCollapsed ? 1 : 0,
                    minHeight: isCollapsed ? 80 : undefined,
                  }}
                >
                  {isCollapsed ? (
                    <>
                      <Typography sx={{ color: column.color, fontWeight: 800, fontSize: '18px', lineHeight: 1 }}>
                        {columnCandidates.length}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          color: column.color,
                          writingMode: 'vertical-rl',
                          textOrientation: 'mixed',
                          fontWeight: 600,
                          fontSize: '10px',
                        }}
                      >
                        {column.label}
                      </Typography>
                      <Tooltip title="Utvid kolonne">
                        <IconButton size="small" onClick={() => toggleColumnCollapse(column.status)}
                          sx={{ color: 'rgba(255,255,255,0.5)', p: 0.25 }}>
                          <ExpandIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </>
                  ) : (
                    <>
                      {/* Left: checkbox + label(n) */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        {columnCandidates.length > 0 && (
                          <Tooltip title={allColSelected ? 'Fjern alle i kolonne' : 'Velg alle i kolonne'}>
                            <IconButton size="small" onClick={() => toggleSelectColumn(column.status)}
                              sx={{ color: column.color, p: 0.25 }} aria-label={`Velg alle i ${column.label}`}>
                              {allColSelected
                                ? <CheckBoxIcon sx={{ fontSize: 16 }} />
                                : someColSelected
                                ? <IndeterminateIcon sx={{ fontSize: 16 }} />
                                : <CheckBoxBlankIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.25)' }} />}
                            </IconButton>
                          </Tooltip>
                        )}
                        <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', fontWeight: 500 }}>
                          {column.label} ({columnCandidates.length})
                        </Typography>
                      </Box>
                      {/* Right: large count + collapse button */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '22px', lineHeight: 1 }}>
                          {columnCandidates.length}
                        </Typography>
                        <Tooltip title="Skjul kolonne">
                          <IconButton size="small" onClick={() => toggleColumnCollapse(column.status)}
                            sx={{ color: 'rgba(255,255,255,0.35)', p: 0.25 }}>
                            <CollapseIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </>
                  )}
                </Box>

                {/* Column Content */}
                {!isCollapsed && (
                  <Box
                    sx={{
                      flex: 1,
                      overflowY: 'auto',
                      p: { xs: 1.25, sm: 1.5, md: 1.375, lg: 1.75, xl: 2 },
                      display: 'flex',
                      flexDirection: 'column',
                      gap: { xs: 1.25, sm: 1.5, md: 1.375, lg: 1.75, xl: 2 },
                      minHeight: { xs: 180, sm: 200, md: 190, lg: 220, xl: 260 },
                      transition: 'all 0.2s',
                      borderRadius: 1,
                      ...(dragOverColumnId === column.status && {
                        backgroundColor: `${column.color}15`,
                        outline: `2px dashed ${column.color}`,
                        outlineOffset: '-2px',
                      }),
                      '&::-webkit-scrollbar': { width: { xs: 5, sm: 6, md: 5.5, lg: 7, xl: 8 } },
                      '&::-webkit-scrollbar-track': { bgcolor: 'rgba(255,255,255,0.05)', borderRadius: { xs: 2.5, sm: 3, md: 2.75, lg: 3.5, xl: 4 } },
                      '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.2)', borderRadius: { xs: 2.5, sm: 3, md: 2.75, lg: 3.5, xl: 4 } },
                    }}
                    onDragOver={(e: DragEvent<HTMLDivElement>) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (draggedCandidateId) setDragOverColumnId(column.status);
                    }}
                    onDragLeave={(e: DragEvent<HTMLDivElement>) => {
                      e.preventDefault();
                      setDragOverColumnId(null);
                    }}
                    onDrop={(e: DragEvent<HTMLDivElement>) => handleDrop(e, column.status)}
                  >
                    {/* Add Candidate — top (casting/producer/agent roles only) */}
                    {roleConfig.canAdd && (
                      <Button size="small" startIcon={<AddIcon sx={{ fontSize: 13 }} />}
                        onClick={onCreateCandidate}
                        sx={{ color: 'rgba(255,255,255,0.4)', textTransform: 'none', fontSize: '12px',
                          py: 0.5, justifyContent: 'flex-start', '&:hover': { color: 'rgba(255,255,255,0.75)', bgcolor: 'transparent' } }}>
                        Add Candidate
                      </Button>
                    )}
                    {visibleCandidates.map((candidate) => {
                      const isSelected = selectedIds.has(candidate.id);
                      const isDragging = draggedCandidateId === candidate.id;
                      const showCheckbox = roleConfig.canBulkAction && (selectedIds.size > 0 || isSelected);
                      return (
                      <Card
                        key={candidate.id}
                        draggable={roleConfig.canMove}
                        onDragStart={(e: DragEvent<HTMLDivElement>) => {
                          setDraggedCandidateId(candidate.id);
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', candidate.id);
                        }}
                        onDragEnd={() => {
                          setDraggedCandidateId(null);
                          setDragOverColumnId(null);
                        }}
                        aria-grabbed={isDragging}
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter') onEditCandidate(candidate); }}
                        sx={{
                          position: 'relative',
                          bgcolor: isSelected ? `${column.color}18` : 'rgba(255,255,255,0.06)',
                          border: isSelected ? `1px solid ${column.color}60` : '1px solid rgba(255,255,255,0.1)',
                          borderLeft: `3px solid ${column.color}`,
                          cursor: selectedIds.size > 0 ? 'pointer' : roleConfig.canMove ? 'grab' : 'default',
                          '&:active': { cursor: selectedIds.size > 0 ? 'pointer' : roleConfig.canMove ? 'grabbing' : 'default' },
                          '&:hover': {
                            bgcolor: isSelected ? `${column.color}22` : 'rgba(255,255,255,0.1)',
                            transform: 'translateY(-2px)',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                            '& .card-actions': { opacity: 1 },
                            '& .card-checkbox': { opacity: 1 },
                          },
                          opacity: isDragging ? 0.7 : 1,
                          ...(isDragging && { outline: `2px dashed ${column.color}`, outlineOffset: '2px' }),
                          transition: 'all 0.15s ease',
                          touchAction: 'none',
                          userSelect: 'none',
                          ...focusVisibleStyles,
                        }}
                        onClick={() => {
                          if (selectedIds.size > 0) { toggleSelect(candidate.id); return; }
                          if (!draggedCandidateId) onEditCandidate(candidate);
                        }}
                      >
                        {/* Checkbox overlay */}
                        <Box className="card-checkbox"
                          onClick={e => { e.stopPropagation(); toggleSelect(candidate.id); }}
                          sx={{ position: 'absolute', top: 6, left: 6, zIndex: 2,
                            opacity: showCheckbox ? 1 : 0, transition: 'opacity 0.15s', cursor: 'pointer' }}>
                          <Checkbox checked={isSelected} size="small"
                            sx={{ p: 0.25, color: column.color, '&.Mui-checked': { color: column.color } }} />
                        </Box>

                        <CardContent sx={{ p: { xs: 1.25, sm: 1.5, md: 1.375, lg: 1.75, xl: 2 }, '&:last-child': { pb: { xs: 1.25, sm: 1.5, md: 1.375, lg: 1.75, xl: 2 } }, pl: showCheckbox ? 4.5 : undefined }}>
                          <Box sx={{ display: 'flex', gap: { xs: 1.25, sm: 1.5, md: 1.375, lg: 1.75, xl: 2 }, alignItems: 'flex-start' }}>
                            {(candidate.photos?.length ?? 0) > 0 ? (
                              <Box
                                component="img"
                                src={candidate.photos[0]}
                                alt={candidate.name}
                                sx={{
                                  width: { xs: 44, sm: 48, md: 46, lg: 52, xl: 60 },
                                  height: { xs: 44, sm: 48, md: 46, lg: 52, xl: 60 },
                                  objectFit: 'cover',
                                  objectPosition: getCandidatePhotoObjectPosition(candidate, 0),
                                  borderRadius: '50%',
                                  flexShrink: 0,
                                  border: `2px solid ${column.color}40`,
                                }}
                              />
                            ) : (
                              <Box
                                sx={{
                                  width: { xs: 44, sm: 48, md: 46, lg: 52, xl: 60 },
                                  height: { xs: 44, sm: 48, md: 46, lg: 52, xl: 60 },
                                  borderRadius: '50%',
                                  bgcolor: `${column.color}20`,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                <PersonIcon sx={{ color: column.color, fontSize: { xs: 20, sm: 24, md: 22, lg: 26, xl: 32 } }} />
                              </Box>
                            )}
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography
                                variant="subtitle2"
                                sx={{
                                  color: '#fff',
                                  fontWeight: 600,
                                  mb: 0.25,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.9rem', xl: '1rem' },
                                }}
                              >
                                {candidate.name}
                              </Typography>
                              {candidate.contactInfo.email && (
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: 'rgba(255,255,255,0.87)',
                                    display: 'block',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    fontSize: { xs: '10px', sm: '11px', md: '10.5px', lg: '12px', xl: '14px' },
                                  }}
                                >
                                  {candidate.contactInfo.email}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                          {(candidate.assignedRoles?.length ?? 0) > 0 && (
                            <Box sx={{ mt: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 }, display: 'flex', flexWrap: 'wrap', gap: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 } }}>
                              {(candidate.assignedRoles || []).slice(0, 2).map((roleId) => (
                                <Chip
                                  key={roleId}
                                  label={roleById.get(roleId) ?? 'Ukjent'}
                                  size="small"
                                  sx={{
                                    bgcolor: 'rgba(0,212,255,0.15)',
                                    color: '#00d4ff',
                                    fontSize: { xs: '9px', sm: '10px', md: '9.5px', lg: '11px', xl: '13px' },
                                    height: { xs: 18, sm: 20, md: 19, lg: 22, xl: 26 },
                                    maxWidth: { xs: 90, sm: 100, md: 95, lg: 110, xl: 130 },
                                    '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
                                  }}
                                />
                              ))}
                              {(candidate.assignedRoles?.length ?? 0) > 2 && (
                                <Chip
                                  label={`+${(candidate.assignedRoles?.length ?? 0) - 2}`}
                                  size="small"
                                  sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.87)', fontSize: { xs: '9px', sm: '10px', md: '9.5px', lg: '11px', xl: '13px' }, height: { xs: 18, sm: 20, md: 19, lg: 22, xl: 26 } }}
                                />
                              )}
                            </Box>
                          )}
                          {/* Note tags from auditionNotes */}
                          {candidate.auditionNotes && candidate.auditionNotes.trim() !== '' && (() => {
                            const tags = candidate.auditionNotes.split(',').map((t: string) => t.trim()).filter(Boolean);
                            return tags.length > 0 ? (
                              <Box sx={{ mt: 0.75, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {tags.slice(0, 2).map((tag: string, i: number) => (
                                  <Chip key={i} label={tag} size="small"
                                    icon={<TagIcon sx={{ fontSize: '10px !important', color: '#fbbf24 !important' }} />}
                                    sx={{ bgcolor: 'rgba(251,191,36,0.12)', color: '#fbbf24', fontSize: '9px', height: 17,
                                      border: '1px solid rgba(251,191,36,0.25)', '& .MuiChip-label': { px: 0.75 } }} />
                                ))}
                                {tags.length > 2 && (
                                  <Chip label={`+${tags.length - 2}`} size="small"
                                    sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', fontSize: '9px', height: 17, '& .MuiChip-label': { px: 0.75 } }} />
                                )}
                              </Box>
                            ) : null;
                          })()}
                          {/* Hover action buttons */}
                          {roleConfig.canAssignEvent && (
                            <Box className="card-actions"
                              sx={{ display: 'flex', gap: 0.5, mt: 0.75, opacity: 0, transition: 'opacity 0.15s' }}
                              onClick={e => e.stopPropagation()}>
                              <Tooltip title="Tilordne audition-event">
                                <IconButton size="small" onClick={() => openAssignEvent([candidate.id])}
                                  sx={{ color: '#8b5cf6', p: 0.5, '&:hover': { bgcolor: 'rgba(139,92,246,0.15)' } }}>
                                  <EventIcon sx={{ fontSize: 15 }} />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          )}
                        </CardContent>
                      </Card>
                      );
                    })}
                    {/* Add Candidate — bottom (canAdd roles only) */}
                    {roleConfig.canAdd && (
                      <Button size="small" startIcon={<AddIcon sx={{ fontSize: 12 }} />}
                        onClick={onCreateCandidate}
                        sx={{ color: 'rgba(255,255,255,0.25)', textTransform: 'none', fontSize: '11px',
                          py: 0.5, justifyContent: 'flex-start', '&:hover': { color: 'rgba(255,255,255,0.6)', bgcolor: 'transparent' } }}>
                        Add Candidate
                      </Button>
                    )}
                    {/* Load more */}
                    {hasMore && (
                      <Button size="small"
                        onClick={() => setColumnPages(prev => ({ ...prev, [column.status]: (prev[column.status] ?? 1) + 1 }))}
                        sx={{ color: column.color, textTransform: 'none', fontSize: '12px', py: 0.5,
                          borderRadius: 1, '&:hover': { bgcolor: `${column.color}12` } }}>
                        Vis {Math.min(remaining, PAGE_SIZE)} til ({remaining} igjen)
                      </Button>
                    )}
                    {columnCandidates.length === 0 && (
                      <Box
                        sx={{
                          textAlign: 'center',
                          py: { xs: 3, sm: 4, md: 3.5, lg: 4, xl: 5 },
                          px: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                          color: 'rgba(255,255,255,0.25)',
                          border: `2px dashed ${column.color}30`,
                          borderRadius: 2,
                          bgcolor: `${column.color}05`,
                        }}
                      >
                        <Typography variant="body2" sx={{ fontSize: { xs: '11px', sm: '13px', md: '12px', lg: '14px', xl: '16px' } }}>
                          {draggedCandidateId ? `Slipp her for "${column.label}"` : 'Ingen kandidater'}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      )}

      {/* Bottom bulk action bar — visible only for roles with canBulkAction */}
      {selectedIds.size > 0 && roleConfig.canBulkAction && (
        <BulkActionBar
          count={selectedIds.size}
          total={filteredCandidates.length}
          allSelected={filteredCandidates.length > 0 && filteredCandidates.every(c => selectedIds.has(c.id))}
          onToggleSelectAll={handleToggleSelectAll}
          onMoveClick={anchor => setBulkMoveAnchor(anchor)}
          onAssignEvent={() => openAssignEvent()}
          onClearSelection={() => setSelectedIds(new Set())}
          onRemove={() => setSelectedIds(new Set())}
        />
      )}

      {/* Assign event dialog */}
      {project && (
        <AssignEventDialog
          open={assignEventOpen}
          onClose={() => setAssignEventOpen(false)}
          projectId={project.id}
          candidateIds={assignEventIds}
          candidates={candidates}
          roles={roles}
          onSuccess={() => { setSelectedIds(new Set()); onCandidatesChange(); }}
        />
      )}

      {/* Kanban Guide */}
      <KanbanGuide open={guideOpen} onClose={() => setGuideOpen(false)} />
    </Box>
  );
}

export const KanbanPanel = memo(KanbanPanelInner);
