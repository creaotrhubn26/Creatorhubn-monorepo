import { useState, useMemo, useEffect, useId, useCallback, useRef, lazy, Suspense, Fragment, type ChangeEvent, type ReactNode, type ReactElement } from 'react';
import { useShotListRealTime } from '../hooks/useShotListRealTime';
import { useToast } from './ToastStack';
import jsPDF from 'jspdf';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import VideoCallIcon from '@mui/icons-material/VideoCall';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Stack,
  Paper,
  Tooltip,
  Collapse,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Alert,
  Snackbar,
  useTheme,
  useMediaQuery,
  Grow,
  CircularProgress as MUICircularProgress,
  Badge,
  Popover,
  List,
  ListItem,
  ListItemText,
  Divider as MuiDivider,
  LinearProgress,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  History as HistoryIcon,
  Movie as MovieIcon,
  PhotoCamera as PhotoCameraIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  ViewModule as GridViewIcon,
  ViewList as TableViewIcon,
  ViewWeek as PlannerViewIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  ContentCopy as DuplicateIcon,
  FileDownload as ExportIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Close as CloseIcon,
  Videocam as VideocamIcon,
  Note as NoteIcon,
  MovieCreation as StoryboardIcon,
  AutoAwesome as AutoAwesomeIcon,
  CalendarToday as CalendarIcon,
  Schedule as ScheduleIcon,
  AccessTime as TimeIcon,
  Warning as WarningIcon,
  Check as CheckIcon,
  RadioButtonUnchecked as UnresolvedIcon,
  CheckCircle as ResolvedIcon,
  Refresh as RefreshIcon,
  PictureAsPdf as PdfIcon,
  PersonAdd as AssignIcon,
  Lock as ReserveIcon,
  LockOpen as UnreserveIcon,
  ArrowForward as NextIcon,
  Storage as StorageIcon,
} from '@mui/icons-material';
import { TeamIcon, DashboardCustomIcon as DashboardIcon, StatsIcon } from './icons/CastingIcons';
import { TeamDashboard, type TeamDashboardCrewSegment } from './TeamDashboard';
import type { ShotList, CastingShot, ShotType, CameraAngle, CameraMovement, Role, ProductionDay, MediaType, ShotPriority, CrewMember, ShotComment, ShotStatus, UserRoleType, ProductionContext } from '../models/casting';
import { PRODUCTION_PRESETS } from '../models/casting';
import { castingService } from '../services/castingService';
import { RichTextEditor } from './RichTextEditor';
import { Z_INDEX } from '../config/zIndex';
import { useBrandingSettings } from '../hooks/useBrandingSettings';
import { 
  convertShotListToStoryboardFrames, 
  generateStoryboardName,
  type StoryboardFrame 
} from '../services/shotListToStoryboardConverter';
import { useStoryboardStore, useStoryboards, useCurrentStoryboard } from '../state/storyboardStore';
import { storyboardAIGenerationService } from '../services/storyboardAIGenerationService';
import { productionPlanningService } from '../services/productionPlanningService';
import { ProductionDayCardInfo } from './ProductionDayCardInfo';
import { castingAuthService } from '../services/castingAuthService';
import settingsService, { getCurrentUserId } from '../services/settingsService';
import { useAuth } from '@/hooks/useAuth';
const ShotPlannerPanel = lazy(() =>
  import('../services/shotPlanner').then((m) => ({ default: m.ShotPlannerPanel as React.ComponentType }))
);
import { RoleRoomEmptyState } from './icons/RoleRoomEmptyState';
import scenesPng from './icons/Keep/roleroom_scenes.png';
import MemoryCardBackupControlDialog from './MemoryCardBackupControlDialog';

// WCAG 2.2 - 2.5.5 Target Size: minimum 44x44px
const TOUCH_TARGET_SIZE = 44;

// WCAG 2.2 - 2.4.7 Focus Visible: clear focus indicator
const focusVisibleStyles = {
  '&:focus-visible': {
    outline: '3px solid #e91e63',
    outlineOffset: 2,
  },
};

const SHOT_COLOR_TAG_MAP: Record<string, string> = {
  red: '#f44336',
  orange: '#9333ea',
  yellow: '#ffeb3b',
  green: '#4caf50',
  blue: '#2196f3',
  purple: '#9c27b0',
  gray: '#9e9e9e',
};

type SortField = 'scene' | 'shots' | 'updated';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'grid' | 'table' | '2d-planner';

const STORYBOARD_TEMPLATE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'cinematic', label: 'Filmisk - Dramatisk kinolook' },
  { value: 'documentary', label: 'Dokumentar - Naturlig stil' },
  { value: 'commercial', label: 'Reklame - Profesjonelt' },
  { value: 'drama', label: 'Drama/TV-serie - Varme toner' },
  { value: 'music_video', label: 'Musikkvideo - Kreativ' },
  { value: 'news', label: 'Nyhetsreportasje - Nøytral' },
  { value: 'horror', label: 'Skrekk/Thriller - Mørk' },
  { value: 'comedy', label: 'Komedie - Lys stemning' },
  { value: 'action', label: 'Action - Dynamisk' },
  { value: 'noir', label: 'Film Noir - Klassisk' },
  { value: 'romantic', label: 'Romantisk - Myk stemning' },
  { value: 'sci_fi', label: 'Sci-Fi - Futuristisk' },
];

interface SortableShotItemProps {
  id: string;
  children: ReactNode;
}

function SortableShotItem({ id, children }: SortableShotItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Box ref={setNodeRef} style={style} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
      <Box
        {...attributes}
        {...listeners}
        role="button"
        aria-label="Drag to reorder shot"
        aria-roledescription="sortable"
        tabIndex={0}
        sx={{
          cursor: 'grab',
          color: 'rgba(255,255,255,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: TOUCH_TARGET_SIZE,
          minHeight: TOUCH_TARGET_SIZE,
          '&:hover': { color: 'rgba(255,255,255,0.87)' },
          '&:active': { cursor: 'grabbing' },
        }}
      >
        <DragIndicatorIcon sx={{ fontSize: 18 }} />
      </Box>
      <Box sx={{ flex: 1 }}>{children}</Box>
    </Box>
  );
}

interface CastingShotListPanelProps {
  projectId: string;
  onUpdate?: () => void;
  profession?: 'photographer' | 'videographer' | null;
  teamDashboardOpenSignal?: number;
  teamDashboardDefaultSegment?: TeamDashboardCrewSegment;
}

export function CastingShotListPanel({
  projectId,
  onUpdate,
  profession,
  teamDashboardOpenSignal = 0,
  teamDashboardDefaultSegment = 'all',
}: CastingShotListPanelProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const containerPadding = isMobile ? 2 : isTablet ? 3 : 4;
  const toast = useToast();
  const { user } = useAuth();
  const branding = useBrandingSettings();

  // ── Real-time collaboration ─────────────────────────────────────────────
  const rt = useShotListRealTime({
    projectId,
    userId:   user?.id ?? 'anonymous',
    userName: (user as any)?.displayName ?? user?.email?.split('@')[0] ?? 'Ukjent',
  });
  const [showAuditLog, setShowAuditLog] = useState(false);
  const auditLogAnchorRef = useRef<HTMLButtonElement | null>(null);

  // Unique IDs for WCAG
  const baseId = useId();
  const dialogTitleId = `${baseId}-dialog-title`;
  const dialogDescId = `${baseId}-dialog-desc`;
  const shotDialogTitleId = `${baseId}-shot-dialog-title`;

  // Core state
  const [shotLists, setShotLists] = useState<ShotList[]>([]);
  const [productionDays, setProductionDays] = useState<ProductionDay[]>([]);
  // Load shot lists and production days when projectId changes
  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      if (!projectId) return;
      try {
        const [lists, days] = await Promise.all([
          castingService.getShotLists(projectId),
          productionPlanningService.getProductionDays(projectId),
        ]);
        if (cancelled) return;
        setShotLists(Array.isArray(lists) ? lists : []);
        setProductionDays(Array.isArray(days) ? days : []);
      } catch (error) {
        if (cancelled) return;
        console.error('Error loading shot lists and production days:', error);
        setShotLists([]);
        setProductionDays([]);
      }
    };
    void loadData();
    return () => { cancelled = true; };
  }, [projectId]);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingShotList, setEditingShotList] = useState<ShotList | null>(null);
  const [shotDialogOpen, setShotDialogOpen] = useState(false);
  const [editingShot, setEditingShot] = useState<CastingShot | null>(null);
  const [currentShotListId, setCurrentShotListId] = useState<string | null>(null);
  const [insertShotAtIndex, setInsertShotAtIndex] = useState<number | null>(null);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generatingStoryboardImages, setGeneratingStoryboardImages] = useState<Record<string, boolean>>({});
  const [storyboardGenerationProgress, setStoryboardGenerationProgress] = useState<Record<string, { current: number; total: number }>>({});
  const [commentDraft, setCommentDraft] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentDraft, setEditingCommentDraft] = useState('');
  const [quickShotDrafts, setQuickShotDrafts] = useState<Record<string, { description: string; shotType: ShotType; estimatedTime?: number }>>({});
  const [inlineEditDrafts, setInlineEditDrafts] = useState<Record<string, { description?: string; estimatedTime?: number; priority?: ShotPriority }>>({});
  const [formData, setFormData] = useState<Partial<ShotList> & { sceneName?: string }>({
    sceneId: '',
    sceneName: '',
    shots: [],
    cameraSettings: {},
    equipment: [],
    notes: '',
    productionContext: 'custom',
  });
  const [shotFormData, setShotFormData] = useState<Partial<CastingShot & {
    aperture?: number;
    shutter?: number;
    iso?: number;
    fps?: number;
    resolution?: string;
    codec?: string;
    audioChannels?: number;
  }>>({
    shotType: 'Medium',
    cameraAngle: 'Eye Level',
    cameraMovement: 'Static',
    focalLength: undefined,
    description: '',
    roleId: '',
    sceneId: '',
    duration: undefined,
    notes: '',
    mediaType: profession === 'videographer' ? 'video' : profession === 'photographer' ? 'photo' : 'hybrid',
    priority: 'important',
    estimatedTime: undefined,
    lensRecommendation: '',
    lightingSetup: '',
    backgroundRecommendation: '',
    assigneeId: '',
    comments: [],
    // Photographer fields
    aperture: undefined,
    shutter: undefined,
    iso: undefined,
    // Videographer fields
    fps: undefined,
    resolution: undefined,
    codec: undefined,
    audioChannels: undefined,
  });

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [mediaTypeFilter, setMediaTypeFilter] = useState<MediaType | 'all'>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<'all' | 'mine' | 'unassigned' | string>('all');
  const [priorityFilter, setPriorityFilter] = useState<ShotPriority | null>(null);
  const [statusFilter, setStatusFilter] = useState<ShotStatus | null>(null);

  // Sort state
  const [sortField, setSortField] = useState<SortField>('scene');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showStats, setShowStats] = useState(false);
  const [showTeamDashboard, setShowTeamDashboard] = useState(false);
  const [teamDashboardCrewSegment, setTeamDashboardCrewSegment] = useState<TeamDashboardCrewSegment>(teamDashboardDefaultSegment);
  const [showStoryboardManager, setShowStoryboardManager] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [memoryCardControlOpen, setMemoryCardControlOpen] = useState(false);
  const [exportSceneId, setExportSceneId] = useState<string | null>(null);
  const lastTeamDashboardOpenSignalRef = useRef(0);

  useEffect(() => {
    if (teamDashboardOpenSignal > lastTeamDashboardOpenSignalRef.current) {
      setTeamDashboardCrewSegment(teamDashboardDefaultSegment);
      setShowTeamDashboard(true);
    }
    lastTeamDashboardOpenSignalRef.current = teamDashboardOpenSignal;
  }, [teamDashboardOpenSignal, teamDashboardDefaultSegment]);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmBulkDeleteOpen, setConfirmBulkDeleteOpen] = useState(false);

  // Favorites state with DB-backed persistence
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Undo delete state
  const [deletedShotList, setDeletedShotList] = useState<ShotList | null>(null);
  const [undoSnackbarOpen, setUndoSnackbarOpen] = useState(false);

  // Expanded cards state
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  // Drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Storyboard conversion state
  const [storyboardDialogOpen, setStoryboardDialogOpen] = useState(false);
  const [selectedShotListForStoryboard, setSelectedShotListForStoryboard] = useState<ShotList | null>(null);
  const [selectedShotsForConversion, setSelectedShotsForConversion] = useState<Set<string>>(new Set());
  const [storyboardPanelOpen, setStoryboardPanelOpen] = useState(false);

  // Add Shot Dialog state (upload/reference from Shot.cafe)
  const [showAddShotDialog, setShowAddShotDialog] = useState(false);
  const [addShotMode, setAddShotMode] = useState<'upload' | 'reference' | null>(null);
  const [selectedShotImage, setSelectedShotImage] = useState<string | null>(null);
  const [addShotReferenceQuery, setAddShotReferenceQuery] = useState('');
  const [addShotReferenceResults, setAddShotReferenceResults] = useState<Array<{ id: string; url: string; thumbnailUrl: string; film?: string }>>([]);
  const [addShotLoading, setAddShotLoading] = useState(false);
  const [addShotTargetShotList, setAddShotTargetShotList] = useState<ShotList | null>(null);

  // Shoot Mode state (removed)
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<UserRoleType | null>(null);

  // Roles state - loaded asynchronously
  const [roles, setRoles] = useState<Role[]>([]);
  
  // Load roles and crew when projectId changes
  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      if (!projectId) return;
      try {
        const [loadedRoles, loadedCrew] = await Promise.all([
          castingService.getRoles(projectId),
          castingService.getCrew(projectId),
        ]);
        if (cancelled) return;
        setRoles(Array.isArray(loadedRoles) ? loadedRoles : []);
        setCrewMembers(Array.isArray(loadedCrew) ? loadedCrew : []);
      } catch (error) {
        if (cancelled) return;
        console.error('Error loading data:', error);
        setRoles([]);
        setCrewMembers([]);
      }
    };
    void loadData();
    return () => { cancelled = true; };
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    const loadCurrentUserRole = async () => {
      if (!projectId || !user?.id) {
        setCurrentUserRole(null);
        return;
      }
      try {
        const role = await castingAuthService.getUserRole(projectId, user.id);
        if (cancelled) return;
        setCurrentUserRole(role?.role || null);
      } catch (error) {
        if (cancelled) return;
        console.error('Error loading current user role:', error);
        setCurrentUserRole(null);
      }
    };
    void loadCurrentUserRole();
    return () => { cancelled = true; };
  }, [projectId, user?.id]);

  const availableScenes = useMemo(() => castingService.getAvailableScenes(), []);

  // O(1) lookup maps for scenes and roles
  const sceneById = useMemo(() => new Map(availableScenes.map(s => [s.id, s])), [availableScenes]);
  const roleById = useMemo(() => new Map(roles.map(r => [r.id, r])), [roles]);

  // Derived: map each production day to the scene IDs it contains
  const dayBySceneId = useMemo(() => {
    const map = new Map<string, ProductionDay>();
    productionDays.forEach(day => {
      (day.scenes || []).forEach((sceneId: string) => {
        if (!map.has(sceneId)) map.set(sceneId, day);
      });
    });
    return map;
  }, [productionDays]);

  // Derived: map each shot list to its production day (replaces O(N×M) state)
  const shotListProductionDays = useMemo(() => {
    const map = new Map<string, ProductionDay>();
    shotLists.forEach(sl => {
      const day = dayBySceneId.get(sl.sceneId);
      if (day) map.set(sl.id, day);
    });
    return map;
  }, [shotLists, dayBySceneId]);

  // ── Apply incoming real-time events to local state ───────────────────────
  useEffect(() => {
    return rt.onRemoteEvent(event => {
      // For all state-changing events, we reload from the source of truth.
      // This keeps CRDT-style convergence simple without a dedicated merge layer.
      const reloadable = ['ShotAssigned', 'ShotStatusChanged', 'ShotReordered', 'ShotListCreated'];
      if (reloadable.includes(event.type)) {
        castingService.getShotLists(projectId).then(lists => {
          setShotLists(Array.isArray(lists) ? lists : []);
        }).catch(console.error);
      }
    });
  }, [rt.onRemoteEvent, projectId]);
  const storyboards = useStoryboards();
  const currentStoryboard = useCurrentStoryboard();
  const { loadStoryboard } = useStoryboardStore();

  const shotTypes: ShotType[] = [
    'Wide', 'Medium', 'Close-up', 'Extreme Close-up', 'Establishing',
    'Detail', 'Two Shot', 'Over Shoulder', 'Point of View',
  ];

  const defaultMediaType: MediaType = profession === 'videographer'
    ? 'video'
    : profession === 'photographer'
      ? 'photo'
      : 'hybrid';

  const cameraAngles: CameraAngle[] = [
    'Eye Level', 'High Angle', 'Low Angle', 'Birds Eye',
    'Worms Eye', 'Dutch Angle', 'Overhead',
  ];

  const cameraMovements: CameraMovement[] = [
    'Static', 'Pan', 'Tilt', 'Dolly', 'Truck',
    'Crane', 'Handheld', 'Steadicam', 'Zoom', 'Orbit',
  ];

  useEffect(() => {
    const loadFavorites = async () => {
      if (!projectId) return;
      const resolvedUserId = user?.id || getCurrentUserId();
      const stored = await settingsService.getSetting<string[]>('shotlist-favorites', {
        userId: resolvedUserId,
        projectId,
      });
      if (stored) {
        setFavorites(new Set(stored));
        return;
      }
    };
    void loadFavorites();
  }, [projectId, user?.id]);

  // Save favorites to DB (debounced — avoids a write on every single toggle)
  const favoritesSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!projectId) return;
    if (favoritesSaveTimerRef.current) clearTimeout(favoritesSaveTimerRef.current);
    const resolvedUserId = user?.id || getCurrentUserId();
    favoritesSaveTimerRef.current = setTimeout(() => {
      void settingsService.setSetting('shotlist-favorites', [...favorites], {
        userId: resolvedUserId,
        projectId,
      });
    }, 400);
    return () => {
      if (favoritesSaveTimerRef.current) clearTimeout(favoritesSaveTimerRef.current);
    };
  }, [favorites, projectId, user?.id]);

  // Refs holding the latest action handlers so the keyboard effect never has stale closures
  const kbActionsRef = useRef<{ openDialog: () => void; exportCsv: () => void }>({
    openDialog: () => {},
    exportCsv: () => {},
  });

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) {
        if (e.key !== 'Escape') return;
      }
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        kbActionsRef.current.openDialog();
      }
      if (e.ctrlKey && e.key === 'e') {
        e.preventDefault();
        kbActionsRef.current.exportCsv();
      }
      if (e.key === 'Escape') {
        if (shotDialogOpen) handleCloseShotDialog();
        else if (dialogOpen) handleCloseDialog();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialogOpen, shotDialogOpen]);

  // Helper functions
  const getSceneName = (sceneId: string, sceneName?: string): string => {
    if (sceneName) return sceneName;
    if (!sceneId) return 'Uspesifisert scene';
    return sceneById.get(sceneId)?.name || sceneId;
  };

  const getRoleName = (roleId?: string): string => {
    if (!roleId) return '';
    return roleById.get(roleId)?.name || roleId;
  };

  const getUserRoleLabel = (role?: UserRoleType | null): string => {
    if (!role) return 'Bruker';
    const labels: Record<UserRoleType, string> = {
      director: 'Regissør',
      producer: 'Produsent',
      casting_director: 'Castingansvarlig',
      production_manager: 'Produsentleder',
      camera_team: 'Kamerateam',
      agency: 'Byrå',
      writer: 'Forfatter',
      script_editor: 'Manusredaktor',
      reader: 'Leser',
    };
    return labels[role] || role;
  };

  const formatRoleLabel = (role?: string | null): string => {
    if (!role) return 'Ukjent rolle';
    if (role in { director: true, producer: true, casting_director: true, production_manager: true, camera_team: true, agency: true, writer: true, script_editor: true, reader: true }) {
      return getUserRoleLabel(role as UserRoleType);
    }
    return role
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  };

  const getProfileById = (profileId?: string): { name: string; email?: string; avatar?: string } | null => {
    if (!profileId) return null;
    if (user && profileId === user.id) {
      return { name: user.name || 'Meg', email: user.email, avatar: getUserAvatarUrl() };
    }
    const crewMember = crewMembers.find((member) => member.id === profileId);
    if (crewMember) {
      return { name: crewMember.name, email: crewMember.contactInfo?.email };
    }
    return null;
  };

  const getAssigneeLabel = (assigneeId?: string): string => {
    if (!assigneeId) return 'Ingen';
    if (user && assigneeId === user.id) {
      return `${user.name} (meg)`;
    }
    const crewMember = crewMembers.find((member) => member.id === assigneeId);
    if (crewMember) {
      return `${crewMember.name} (${crewMember.role})`;
    }
    return 'Ukjent';
  };

  const getInitials = (name?: string): string => {
    if (!name) return 'U';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  };

  const getUserAvatarUrl = (): string | undefined => {
    const avatarCandidate = user as { avatar?: unknown; picture?: unknown } | null;
    if (typeof avatarCandidate?.avatar === 'string' && avatarCandidate.avatar.trim()) {
      return avatarCandidate.avatar;
    }
    if (typeof avatarCandidate?.picture === 'string' && avatarCandidate.picture.trim()) {
      return avatarCandidate.picture;
    }
    return undefined;
  };

  const getCommentText = (comment: ShotComment): string => {
    if (typeof comment.text === 'string' && comment.text.trim()) return comment.text;
    return typeof comment.message === 'string' ? comment.message : '';
  };

  const formatOptionalDate = (value?: string): string => {
    return value ? new Date(value).toLocaleDateString('nb-NO') : '—';
  };

  // Find related storyboard for a shot list
  const findRelatedStoryboard = useCallback((shotList: ShotList) => {
    const sceneName = getSceneName(shotList.sceneId, shotList.sceneName);
    const expectedName1 = generateStoryboardName(sceneName, shotList.sceneName);
    const expectedName2 = generateStoryboardName(sceneName);
    
    return storyboards.find(sb => 
      sb.name === expectedName1 || 
      sb.name === expectedName2 ||
      sb.name.includes(sceneName)
    );
  }, [storyboards, availableScenes]);

  // Resolve a cover image for storyboard pack cards and slot previews.
  const getStoryboardPackPreviewImage = (
    shotList: ShotList,
    relatedStoryboard?: { frames?: Array<{ thumbnailUrl?: string; imageUrl?: string }> }
  ): string | undefined => {
    const storyboardFrameImage = relatedStoryboard?.frames?.find((frame) => frame.thumbnailUrl || frame.imageUrl);
    if (storyboardFrameImage) return storyboardFrameImage.thumbnailUrl || storyboardFrameImage.imageUrl;

    const shotImage = shotList.shots.find((shot) => shot.imageUrl);
    return typeof shotImage?.imageUrl === 'string' ? shotImage.imageUrl : undefined;
  };

  const getShotTypeLabel = (type: ShotType): string => {
    const labels: Record<ShotType, string> = {
      'Wide': 'Totalbilde',
      'Medium': 'Halvtotalt',
      'Close-up': 'Nærbilde',
      'Extreme Close-up': 'Ekstrem nærbilde',
      'Establishing': 'Etableringsbilde',
      'Detail': 'Detaljbilde',
      'Two Shot': 'Tobilde',
      'Over Shoulder': 'Over skulder',
      'Point of View': 'POV',
    };
    return labels[type] || type;
  };

  const getShotTypeColor = (type: ShotType): string => {
    const colors: Record<ShotType, string> = {
      'Wide': '#4caf50',
      'Medium': '#2196f3',
      'Close-up': '#9333ea',
      'Extreme Close-up': '#e91e63',
      'Establishing': '#9c27b0',
      'Detail': '#00bcd4',
      'Two Shot': '#7c3aed',
      'Over Shoulder': '#795548',
      'Point of View': '#607d8b',
    };
    return colors[type] || '#e91e63';
  };

  const mediaTypeConfig: Record<MediaType, { label: string; color: string; icon: ReactElement }> = {
    photo: { label: 'Foto', color: '#2196f3', icon: <PhotoCameraIcon sx={{ fontSize: 14 }} /> },
    video: { label: 'Video', color: '#e91e63', icon: <VideocamIcon sx={{ fontSize: 14 }} /> },
    hybrid: { label: 'Hybrid', color: '#9c27b0', icon: <MovieIcon sx={{ fontSize: 14 }} /> },
  };

  const priorityConfig: Record<ShotPriority, { label: string; color: string; bgColor: string }> = {
    critical: { label: 'Kritisk', color: '#f44336', bgColor: 'rgba(244,67,54,0.15)' },
    important: { label: 'Viktig', color: '#9333ea', bgColor: 'rgba(147,51,234,0.15)' },
    nice_to_have: { label: 'Bonus', color: '#9e9e9e', bgColor: 'rgba(158,158,158,0.15)' },
  };

  const statusConfig: Record<ShotStatus, { label: string; color: string; bgColor: string }> = {
    not_started: { label: 'Venter', color: '#78909c', bgColor: 'rgba(120,144,156,0.15)' },
    in_progress: { label: 'Pågår', color: '#9333ea', bgColor: 'rgba(147,51,234,0.15)' },
    completed: { label: 'Fullført', color: '#4caf50', bgColor: 'rgba(76,175,80,0.15)' },
  };

  const priorityWeight: Record<ShotPriority, number> = {
    critical: 3,
    important: 2,
    nice_to_have: 1,
  };

  const getNextStatus = (status: ShotStatus): ShotStatus => {
    const statusOrder: ShotStatus[] = ['not_started', 'in_progress', 'completed'];
    const currentIndex = statusOrder.indexOf(status);
    return statusOrder[(currentIndex + 1) % statusOrder.length];
  };

  const getShotPreset = (shotList?: ShotList) => {
    const context: ProductionContext = shotList?.productionContext || 'custom';
    const preset = PRODUCTION_PRESETS[context];
    return {
      mediaType: preset?.defaultMediaType || defaultMediaType,
      priority: preset?.defaultPriority || 'important',
      estimatedTime: preset?.typicalDuration || 5,
      lensRecommendation: preset?.suggestedLenses?.[0] || '',
      lightingSetup: preset?.suggestedLighting?.[0] || '',
      backgroundRecommendation: '',
    };
  };

  const getNextUpShots = (shotList: ShotList): CastingShot[] => {
    const productionDay = shotListProductionDays.get(shotList.id);
    const isTimePressure = productionDay
      ? productionPlanningService.isTimePressureMode(productionDay, shotList.shots)
      : false;
    const remaining = shotList.shots.filter((shot) => shot.status !== 'completed');
    const sorted = [...remaining].sort((a, b) => {
      const aPriority = priorityWeight[a.priority || 'important'];
      const bPriority = priorityWeight[b.priority || 'important'];
      if (aPriority !== bPriority) return bPriority - aPriority;
      const aTime = a.estimatedTime || 5;
      const bTime = b.estimatedTime || 5;
      return isTimePressure ? aTime - bTime : bTime - aTime;
    });
    return sorted.slice(0, 3);
  };

  // Filtered and sorted shot lists
  const filteredAndSortedShotLists = useMemo(() => {
    let result = [...shotLists];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (sl) =>
          getSceneName(sl.sceneId, sl.sceneName).toLowerCase().includes(query) ||
          sl.notes?.toLowerCase().includes(query) ||
          sl.shots.some(shot => 
            shot.description?.toLowerCase().includes(query) ||
            getShotTypeLabel(shot.shotType).toLowerCase().includes(query)
          )
      );
    }

    if (mediaTypeFilter !== 'all') {
      result = result.filter((sl) =>
        sl.shots.some((shot) => (shot.mediaType || 'photo') === mediaTypeFilter)
      );
    }

    // Assignee filter
    if (assigneeFilter !== 'all') {
      result = result.map((sl) => {
        const filteredShots = sl.shots.filter((shot) => {
          if (assigneeFilter === 'mine') {
            return shot.assigneeId === user?.id || shot.reservedBy === user?.id;
          } else if (assigneeFilter === 'unassigned') {
            return !shot.assigneeId && !shot.reservedBy;
          } else {
            return shot.assigneeId === assigneeFilter;
          }
        });
        return { ...sl, shots: filteredShots };
      }).filter((sl) => sl.shots.length > 0);
    }

    // Priority filter (on shots)
    if (priorityFilter !== null) {
      result = result.map((sl) => ({
        ...sl,
        shots: sl.shots.filter((shot) => (shot.priority || 'important') === priorityFilter),
      })).filter((sl) => sl.shots.length > 0);
    }

    // Status filter (on shots)
    if (statusFilter !== null) {
      result = result.map((sl) => ({
        ...sl,
        shots: sl.shots.filter((shot) => (shot.status || 'not_started') === statusFilter),
      })).filter((sl) => sl.shots.length > 0);
    }

    // Sort - favorites first
    result.sort((a, b) => {
      const aFav = favorites.has(a.id) ? 1 : 0;
      const bFav = favorites.has(b.id) ? 1 : 0;
      if (aFav !== bFav) return bFav - aFav;

      let comparison = 0;
      switch (sortField) {
        case 'scene':
          comparison = getSceneName(a.sceneId, a.sceneName).localeCompare(getSceneName(b.sceneId, b.sceneName), 'nb');
          break;
        case 'shots':
          comparison = a.shots.length - b.shots.length;
          break;
        case 'updated': {
          const ta = a.updatedAt ? Date.parse(a.updatedAt) : 0;
          const tb = b.updatedAt ? Date.parse(b.updatedAt) : 0;
          comparison = ta - tb;
          break;
        }
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [shotLists, searchQuery, sortField, sortDirection, favorites, availableScenes, mediaTypeFilter, assigneeFilter, priorityFilter, statusFilter, user?.id]);

  // Statistics
  const stats = useMemo(() => {
    const totalShots = shotLists.reduce((acc, sl) => acc + sl.shots.length, 0);
    const shotTypeCount: Record<string, number> = {};
    const byStatus: Record<ShotStatus, number> = { not_started: 0, in_progress: 0, completed: 0 };

    shotLists.forEach((sl) => {
      sl.shots.forEach((shot) => {
        shotTypeCount[shot.shotType] = (shotTypeCount[shot.shotType] || 0) + 1;
        const s: ShotStatus = shot.status || 'not_started';
        byStatus[s] = (byStatus[s] || 0) + 1;
      });
    });

    const completionPercent = totalShots > 0 ? Math.round((byStatus.completed / totalShots) * 100) : 0;

    return {
      totalLists: shotLists.length,
      totalShots,
      shotTypeCount,
      favorites: favorites.size,
      byStatus,
      completionPercent,
    };
  }, [shotLists, favorites]);

  // Handlers
  const handleOpenDialog = (shotList?: ShotList) => {
    if (shotList) {
      setEditingShotList(shotList);
      setFormData({
        ...shotList,
        sceneName: shotList.sceneName || '',
      });
    } else {
      setEditingShotList(null);
      setFormData({
        sceneId: '',
        sceneName: '',
        shots: [],
        cameraSettings: {},
        equipment: [],
        notes: '',
        productionContext: 'custom',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingShotList(null);
  };

  const hasAdvancedCameraValues = (
    data: Partial<
      CastingShot & {
        aperture?: number;
        shutter?: number;
        iso?: number;
        fps?: number;
        resolution?: string;
        codec?: string;
        audioChannels?: number;
        duration?: number;
      }
    >
  ): boolean => Boolean(
    data.focalLength ||
    data.aperture ||
    data.shutter ||
    data.iso ||
    data.fps ||
    data.resolution ||
    data.codec ||
    data.audioChannels ||
    data.duration
  );

  const handleOpenShotDialog = (shotListId: string, shot?: CastingShot, insertAtIndex?: number) => {
    setCurrentShotListId(shotListId);
    setInsertShotAtIndex(insertAtIndex ?? null);
    setCommentDraft('');
    setEditingCommentId(null);
    setEditingCommentDraft('');
    if (shot) {
      setEditingShot(shot);
      setShotFormData({
        ...shot,
        comments: shot.comments || [],
        assigneeId: shot.assigneeId || '',
      });
      setShowAdvancedCamera(hasAdvancedCameraValues(shot));
      // Soft-lock: signal to collaborators that we're editing this shot
      rt.acquireLock(shotListId, shot.id);
    } else {
      const shotList = shotLists.find(sl => sl.id === shotListId);
      const preset = getShotPreset(shotList);
      setEditingShot(null);
      setShotFormData({
        shotType: 'Medium',
        cameraAngle: 'Eye Level',
        cameraMovement: 'Static',
        focalLength: undefined,
        description: '',
        roleId: roles.length > 0 ? roles[0].id : '',
        sceneId: shotList?.sceneId || '',
        duration: undefined,
        notes: '',
        mediaType: preset.mediaType,
        priority: preset.priority,
        estimatedTime: preset.estimatedTime,
        lensRecommendation: preset.lensRecommendation,
        lightingSetup: preset.lightingSetup,
        backgroundRecommendation: preset.backgroundRecommendation,
        assigneeId: '',
        comments: [],
      });
      setShowAdvancedCamera(false);
    }
    setShotDialogOpen(true);
  };

  const handleCloseShotDialog = () => {
    // Release soft-lock before closing
    if (editingShot && currentShotListId) {
      rt.releaseLock(currentShotListId, editingShot.id);
    }
    setShotDialogOpen(false);
    setEditingShot(null);
    setCurrentShotListId(null);
    setInsertShotAtIndex(null);
    setGeneratingImage(false);
    setCommentDraft('');
    setEditingCommentId(null);
    setEditingCommentDraft('');
    setShowAdvancedCamera(false);
  };

  const handleAddComment = () => {
    if (!commentDraft.trim()) return;
    const authorProfile = user
      ? { name: user.name || 'Team', email: user.email, avatar: getUserAvatarUrl() }
      : null;
    const trimmedComment = commentDraft.trim();
    const newComment: ShotComment = {
      id: `shot-comment-${Date.now()}`,
      authorId: user?.id,
      authorName: authorProfile?.name || 'Team',
      authorEmail: authorProfile?.email,
      authorAvatar: authorProfile?.avatar,
      authorRole: currentUserRole || undefined,
      text: trimmedComment,
      message: trimmedComment,
      resolved: false,
      createdAt: new Date().toISOString(),
    };
    const existingComments = shotFormData.comments || [];
    setShotFormData({
      ...shotFormData,
      comments: [...existingComments, newComment],
    });
    setCommentDraft('');
  };

  const handleToggleCommentResolved = (commentId: string) => {
    const updatedComments = (shotFormData.comments || []).map((comment) =>
      comment.id === commentId
        ? { ...comment, resolved: !comment.resolved, updatedAt: new Date().toISOString() }
        : comment
    );
    setShotFormData({ ...shotFormData, comments: updatedComments });
  };

  const handleStartEditComment = (comment: ShotComment) => {
    setEditingCommentId(comment.id);
    setEditingCommentDraft(getCommentText(comment));
  };

  const handleSaveEditedComment = () => {
    if (!editingCommentId) return;
    const updatedComments = (shotFormData.comments || []).map((comment) =>
      comment.id === editingCommentId
        ? {
            ...comment,
            text: editingCommentDraft.trim(),
            message: editingCommentDraft.trim(),
            updatedAt: new Date().toISOString(),
          }
        : comment
    );
    setShotFormData({ ...shotFormData, comments: updatedComments });
    setEditingCommentId(null);
    setEditingCommentDraft('');
  };

  const handleDeleteComment = (commentId: string) => {
    const updatedComments = (shotFormData.comments || []).filter((comment) => comment.id !== commentId);
    setShotFormData({ ...shotFormData, comments: updatedComments });
    if (editingCommentId === commentId) {
      setEditingCommentId(null);
      setEditingCommentDraft('');
    }
  };

  const [selectedTemplate, setSelectedTemplate] = useState<string>('cinematic');
  const [packTemplateByShotListId, setPackTemplateByShotListId] = useState<Record<string, string>>({});
  const [showAdvancedCamera, setShowAdvancedCamera] = useState(false);

  const getPackTemplate = useCallback(
    (shotListId: string): string => packTemplateByShotListId[shotListId] || 'cinematic',
    [packTemplateByShotListId]
  );

  const handleGenerateImage = async () => {
    if (!currentShotListId || !shotFormData.description) {
      toast.showWarning('Beskrivelse er påkrevd for å generere bilde');
      return;
    }

    setGeneratingImage(true);
    try {
      const result = await storyboardAIGenerationService.generateFrame({
        prompt: shotFormData.description,
        template: selectedTemplate,
        cameraAngle: shotFormData.cameraAngle?.toLowerCase().replace(/\s+/g, '-'),
        cameraMovement: shotFormData.cameraMovement?.toLowerCase(),
        additionalNotes: shotFormData.notes,
        size: '1536x1024',
        projectId,
        storyboardId: 'temp',
        frameId: editingShot?.id || `shot-${Date.now()}`,
      });

      if (result.success) {
        const imageUrl = result.imageUrl || (result.imageBase64 ? `data:image/png;base64,${result.imageBase64}` : '');
        if (imageUrl) {
          setShotFormData({
            ...shotFormData,
            imageUrl,
          });
          toast.showSuccess('Bilde generert!');
        } else {
          toast.showError('Ingen bilde mottatt fra serveren');
        }
      } else {
        toast.showError(result.error || 'Kunne ikke generere bilde');
      }
    } catch (error) {
      console.error('Error generating image:', error);
      toast.showError('Feil ved generering av bilde');
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleAutoGenerateStoryboardImages = async (shotList: ShotList, template: string = 'cinematic') => {
    const shotsWithDescription = shotList.shots.filter(s => s.description && s.description.trim());
    
    if (shotsWithDescription.length === 0) {
      toast.showWarning('Legg til beskrivelse på minst ett shot for å generere storyboard-bilder');
      return;
    }

    setGeneratingStoryboardImages(prev => ({ ...prev, [shotList.id]: true }));
    setStoryboardGenerationProgress(prev => ({ ...prev, [shotList.id]: { current: 0, total: shotsWithDescription.length } }));

    const updatedShots = [...shotList.shots];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < shotsWithDescription.length; i++) {
      const shot = shotsWithDescription[i];
      const shotIndex = updatedShots.findIndex(s => s.id === shot.id);
      
      setStoryboardGenerationProgress(prev => ({
        ...prev,
        [shotList.id]: { current: i + 1, total: shotsWithDescription.length }
      }));

      try {
        const result = await storyboardAIGenerationService.generateFrame({
          prompt: shot.description || '',
          template,
          cameraAngle: shot.cameraAngle?.toLowerCase().replace(/\s+/g, '-'),
          cameraMovement: shot.cameraMovement?.toLowerCase(),
          additionalNotes: shot.notes,
          size: '1536x1024',
          projectId,
          storyboardId: shotList.id,
          frameId: shot.id,
        });

        if (result.success) {
          const imageUrl = result.imageUrl || (result.imageBase64 ? `data:image/png;base64,${result.imageBase64}` : '');
          if (imageUrl && shotIndex !== -1) {
            updatedShots[shotIndex] = { ...updatedShots[shotIndex], imageUrl };
            successCount++;
          }
        } else {
          console.error(`Error generating image for shot ${shot.id}:`, result.error);
          errorCount++;
        }
      } catch (error) {
        console.error(`Error generating image for shot ${shot.id}:`, error);
        errorCount++;
      }
    }

    try {
      const updatedShotList: ShotList = {
        ...shotList,
        shots: updatedShots,
        updatedAt: new Date().toISOString(),
      };

      await castingService.saveShotList(projectId, updatedShotList);
      const lists = await castingService.getShotLists(projectId);
      setShotLists(Array.isArray(lists) ? lists : []);

      if (successCount > 0 && errorCount === 0) {
        toast.showSuccess(`${successCount} storyboard-bilder generert!`);
      } else if (successCount > 0 && errorCount > 0) {
        toast.showWarning(`${successCount} bilder generert, ${errorCount} feilet`);
      } else {
        toast.showError('Kunne ikke generere storyboard-bilder');
      }

      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error saving storyboard images:', error);
      toast.showError('Kunne ikke lagre storyboard-bilder');
    } finally {
      setGeneratingStoryboardImages(prev => ({ ...prev, [shotList.id]: false }));
      setStoryboardGenerationProgress(prev => {
        const updated = { ...prev };
        delete updated[shotList.id];
        return updated;
      });
    }
  };

  const [regeneratingShotId, setRegeneratingShotId] = useState<string | null>(null);

  const handleRegenerateSingleImage = async (
    shotList: ShotList,
    shot: CastingShot,
    template: string = 'cinematic'
  ) => {
    if (!shot.description || !shot.description.trim()) {
      toast.showWarning('Legg til beskrivelse for å generere bilde');
      return;
    }

    setRegeneratingShotId(shot.id);

    try {
      const result = await storyboardAIGenerationService.generateFrame({
        prompt: shot.description,
        template,
        cameraAngle: shot.cameraAngle?.toLowerCase().replace(/\s+/g, '-'),
        cameraMovement: shot.cameraMovement?.toLowerCase(),
        additionalNotes: shot.notes,
        size: '1536x1024',
        projectId,
        storyboardId: shotList.id,
        frameId: shot.id,
      });

      if (result.success) {
        const imageUrl = result.imageUrl || (result.imageBase64 ? `data:image/png;base64,${result.imageBase64}` : '');
        if (imageUrl) {
          const updatedShots = shotList.shots.map(s => 
            s.id === shot.id ? { ...s, imageUrl } : s
          );
          const updatedShotList: ShotList = {
            ...shotList,
            shots: updatedShots,
            updatedAt: new Date().toISOString(),
          };

          await castingService.saveShotList(projectId, updatedShotList);
          const lists = await castingService.getShotLists(projectId);
          setShotLists(Array.isArray(lists) ? lists : []);
          toast.showSuccess('Bilde regenerert!');
          if (onUpdate) onUpdate();
        } else {
          toast.showError('Ingen bilde mottatt fra serveren');
        }
      } else {
        toast.showError(result.error || 'Kunne ikke regenerere bilde');
      }
    } catch (error) {
      console.error('Error regenerating image:', error);
      toast.showError('Feil ved regenerering av bilde');
    } finally {
      setRegeneratingShotId(null);
    }
  };

  // Search reference shots from Shot.cafe
  const handleSearchReferenceShots = async () => {
    if (!addShotReferenceQuery.trim()) return;
    setAddShotLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/api/shotcafe/search?q=${encodeURIComponent(addShotReferenceQuery)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.films && data.films.length > 0) {
          // Get frames from first matching film
          const firstFilm = data.films[0];
          const framesResponse = await fetch(`http://localhost:8000/api/shotcafe/film/${firstFilm.slug}/frames`);
          if (framesResponse.ok) {
            const framesData = await framesResponse.json();
            const frames = framesData.frames || [];
            setAddShotReferenceResults(frames.map((f: { id?: string; url?: string; src?: string; thumbnailUrl?: string }) => ({
              id: f.id || String(Math.random()),
              url: f.url || f.src,
              thumbnailUrl: f.thumbnailUrl || f.url || f.src,
              film: firstFilm.title,
            })));
          }
        }
      }
    } catch (error) {
      console.error('Error searching reference shots:', error);
      toast.showError('Kunne ikke søke referansebilder');
    } finally {
      setAddShotLoading(false);
    }
  };

  // Open Add Shot Dialog
  const handleOpenAddShotDialog = (shotList: ShotList) => {
    setAddShotTargetShotList(shotList);
    setShowAddShotDialog(true);
    setAddShotMode(null);
    setSelectedShotImage(null);
    setAddShotReferenceQuery('');
    setAddShotReferenceResults([]);
  };

  // Handle file upload for new shot
  const handleAddShotImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedShotImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Create shot with image
  const handleCreateShotWithImage = async (imageUrl?: string) => {
    if (!addShotTargetShotList) return;
    const now = new Date().toISOString();
    const preset = getShotPreset(addShotTargetShotList);
    const newShot: CastingShot = {
      id: `shot-${Date.now()}`,
      sceneId: addShotTargetShotList.sceneId || '',
      roleId: roles.length > 0 ? roles[0].id : '',
      shotType: 'Medium',
      description: 'Ny shot',
      cameraAngle: 'Eye Level',
      cameraMovement: 'Static',
      focalLength: 50,
      duration: 5,
      notes: '',
      createdAt: now,
      updatedAt: now,
      imageUrl: imageUrl,
      estimatedTime: preset.estimatedTime,
      status: 'not_started',
      priority: preset.priority,
      mediaType: preset.mediaType,
      lensRecommendation: preset.lensRecommendation,
      lightingSetup: preset.lightingSetup,
      backgroundRecommendation: preset.backgroundRecommendation,
    };
    try {
      const updatedShotList: ShotList = {
        ...addShotTargetShotList,
        shots: [...addShotTargetShotList.shots, newShot],
        updatedAt: now,
      };
      await castingService.saveShotList(projectId, updatedShotList);
      const lists = await castingService.getShotLists(projectId);
      setShotLists(Array.isArray(lists) ? lists : []);
      if (onUpdate) onUpdate();
      toast.showSuccess('Shot lagt til!');
    } catch (error) {
      console.error('Error creating shot:', error);
      toast.showError('Kunne ikke opprette shot');
    }
    setShowAddShotDialog(false);
    setAddShotTargetShotList(null);
    setAddShotMode(null);
    setSelectedShotImage(null);
  };

  const handleExportStoryboardPDF = async (shotList: ShotList) => {
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(20);
    pdf.setTextColor(50, 50, 50);
    const shotListTitle = getSceneName(shotList.sceneId, shotList.sceneName);
    pdf.text(shotListTitle, margin, 20);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(100, 100, 100);
    pdf.text(`Eksportert: ${new Date().toLocaleDateString('nb-NO')} • ${shotList.shots.length} shots`, margin, 27);

    let yPos = 40;
    const imageWidth = 80;
    const imageHeight = 45;
    const infoWidth = contentWidth - imageWidth - 10;

    for (let i = 0; i < shotList.shots.length; i++) {
      const shot = shotList.shots[i];

      if (yPos + imageHeight + 20 > pageHeight - margin) {
        pdf.addPage();
        yPos = margin;
      }

      pdf.setFillColor(245, 245, 245);
      pdf.roundedRect(margin, yPos, contentWidth, imageHeight + 15, 3, 3, 'F');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(50, 50, 50);
      pdf.text(`Shot ${i + 1}: ${getShotTypeLabel(shot.shotType)}`, margin + 5, yPos + 8);

      const shotImageUrl = typeof shot.imageUrl === 'string' ? shot.imageUrl : undefined;
      if (shotImageUrl && !shotImageUrl.startsWith('data:')) {
        try {
          const response = await fetch(shotImageUrl);
          const blob = await response.blob();
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
          pdf.addImage(base64, 'PNG', margin + 5, yPos + 12, imageWidth, imageHeight);
        } catch (error) {
          console.error('Error adding image to PDF:', error);
          pdf.setFillColor(200, 200, 200);
          pdf.rect(margin + 5, yPos + 12, imageWidth, imageHeight, 'F');
          pdf.setFontSize(8);
          pdf.text('Bilde ikke tilgjengelig', margin + 15, yPos + 35);
        }
      } else if (shotImageUrl?.startsWith('data:')) {
        try {
          pdf.addImage(shotImageUrl, 'PNG', margin + 5, yPos + 12, imageWidth, imageHeight);
        } catch (error) {
          console.error('Error adding base64 image to PDF:', error);
        }
      } else {
        pdf.setFillColor(220, 220, 220);
        pdf.rect(margin + 5, yPos + 12, imageWidth, imageHeight, 'F');
        pdf.setFontSize(8);
        pdf.setTextColor(100, 100, 100);
        pdf.text('Intet bilde', margin + 35, yPos + 35);
      }

      const infoX = margin + imageWidth + 15;
      let infoY = yPos + 18;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(60, 60, 60);

      if (shot.description) {
        const descLines = pdf.splitTextToSize(shot.description, infoWidth - 10);
        pdf.text(descLines.slice(0, 3), infoX, infoY);
        infoY += Math.min(descLines.length, 3) * 4 + 3;
      }

      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      const details: string[] = [];
      if (shot.cameraAngle) details.push(`Vinkel: ${shot.cameraAngle}`);
      if (shot.cameraMovement) details.push(`Bevegelse: ${shot.cameraMovement}`);
      if (shot.estimatedTime) details.push(`Tid: ${shot.estimatedTime} min`);
      if (shot.colorTag) details.push(`Tag: ${shot.colorTag}`);
      if (details.length > 0) {
        pdf.text(details.join(' • '), infoX, infoY);
      }

      yPos += imageHeight + 25;
    }

    pdf.save(`${shotListTitle.replace(/\s+/g, '-').toLowerCase()}-storyboard.pdf`);
    toast.showSuccess('Storyboard eksportert som PDF!');
  };

  const handleReserveShot = async (shotList: ShotList, shot: CastingShot) => {
    if (!user) {
      toast.showWarning('Du må være logget inn for å reservere shots');
      return;
    }

    if (shot.reservedBy && shot.reservedBy !== user.id) {
      toast.showWarning(`Dette shot-et er allerede reservert av ${shot.reservedByName || 'en annen bruker'}`);
      return;
    }

    const isCurrentlyReserved = shot.reservedBy === user.id;
    const updatedShots = shotList.shots.map(s => 
      s.id === shot.id 
        ? isCurrentlyReserved 
          ? { ...s, reservedBy: undefined, reservedByName: undefined, reservedAt: undefined }
          : { ...s, reservedBy: user.id, reservedByName: user.name || 'Meg', reservedAt: new Date().toISOString() }
        : s
    );

    const updatedShotList: ShotList = {
      ...shotList,
      shots: updatedShots,
      updatedAt: new Date().toISOString(),
    };

    try {
      await castingService.saveShotList(projectId, updatedShotList);
      const lists = await castingService.getShotLists(projectId);
      setShotLists(Array.isArray(lists) ? lists : []);
      toast.showSuccess(isCurrentlyReserved ? 'Reservasjon fjernet' : 'Shot reservert!');
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error reserving shot:', error);
      toast.showError('Kunne ikke reservere shot');
    }
  };

  const handleQuickAssign = async (shotList: ShotList, shot: CastingShot, assigneeId: string, assigneeName: string) => {
    const updatedShots = shotList.shots.map(s => 
      s.id === shot.id 
        ? { ...s, assigneeId, assigneeName }
        : s
    );

    const updatedShotList: ShotList = {
      ...shotList,
      shots: updatedShots,
      updatedAt: new Date().toISOString(),
    };

    try {
      await castingService.saveShotList(projectId, updatedShotList);
      const lists = await castingService.getShotLists(projectId);
      setShotLists(Array.isArray(lists) ? lists : []);
      toast.showSuccess(`Shot tilordnet ${assigneeName}`);
      // Broadcast assignment to collaborators
      rt.emitShotAssigned({ shotListId: shotList.id, shotId: shot.id, assigneeId, assigneeName });
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error assigning shot:', error);
      toast.showError('Kunne ikke tilordne shot');
    }
  };

  const handleSaveShotList = async () => {
    const sceneName = formData.sceneId || formData.sceneName || '';
    if (!sceneName && !formData.notes) {
      toast.showWarning('Vennligst angi scene eller beskrivelse');
      return;
    }

    const shotList: ShotList = editingShotList
      ? { ...editingShotList, ...formData, updatedAt: new Date().toISOString() } as ShotList
      : {
          id: `shotlist-${Date.now()}`,
          projectId,
          sceneId: formData.sceneId || '',
          sceneName: formData.sceneName || '',
          shots: formData.shots || [],
          cameraSettings: formData.cameraSettings || {},
          equipment: formData.equipment || [],
          notes: formData.notes || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

    await castingService.saveShotList(projectId, shotList);
    const lists = await castingService.getShotLists(projectId);
    setShotLists(Array.isArray(lists) ? lists : []);
    
    // Auto-expand the new/edited scene and collapse others when creating new
    if (!editingShotList) {
      // Collapse all other scenes, expand only the new one
      setExpandedCards(new Set([shotList.id]));
      // Broadcast creation to collaborators
      rt.emitShotListCreated({
        shotListId: shotList.id,
        sceneId:    shotList.sceneId,
        sceneName:  shotList.sceneName || shotList.sceneId,
      });
    }
    
    handleCloseDialog();
    if (onUpdate) onUpdate();
  };

  const handleSaveShot = async () => {
    if (!currentShotListId) {
      toast.showWarning('Ingen shot list valgt');
      return;
    }

    const shotList = shotLists.find(sl => sl.id === currentShotListId);
    if (!shotList) return;

    const shot: CastingShot = editingShot
      ? { ...editingShot, ...shotFormData, updatedAt: new Date().toISOString() } as CastingShot
      : {
          id: `shot-${Date.now()}`,
          shotType: shotFormData.shotType || 'Medium',
          cameraAngle: shotFormData.cameraAngle || 'Eye Level',
          cameraMovement: shotFormData.cameraMovement || 'Static',
          focalLength: shotFormData.focalLength,
          description: shotFormData.description,
          roleId: shotFormData.roleId || '',
          sceneId: shotFormData.sceneId || '',
          candidateId: shotFormData.candidateId,
          duration: shotFormData.duration,
          notes: shotFormData.notes,
          status: 'not_started',
          mediaType: shotFormData.mediaType || defaultMediaType,
          priority: shotFormData.priority || 'important',
          estimatedTime: shotFormData.estimatedTime,
          lensRecommendation: shotFormData.lensRecommendation,
          lightingSetup: shotFormData.lightingSetup,
          backgroundRecommendation: shotFormData.backgroundRecommendation,
          assigneeId: shotFormData.assigneeId || '',
          comments: shotFormData.comments || [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

    let updatedShots: CastingShot[];
    if (editingShot) {
      updatedShots = shotList.shots.map(s => (s.id === shot.id ? shot : s));
    } else if (insertShotAtIndex !== null && insertShotAtIndex >= 0) {
      updatedShots = [
        ...shotList.shots.slice(0, insertShotAtIndex),
        shot,
        ...shotList.shots.slice(insertShotAtIndex),
      ];
    } else {
      updatedShots = [...shotList.shots, shot];
    }

    const updatedShotList: ShotList = {
      ...shotList,
      shots: updatedShots,
      updatedAt: new Date().toISOString(),
    };

    await castingService.saveShotList(projectId, updatedShotList);
    const lists = await castingService.getShotLists(projectId);
    setShotLists(Array.isArray(lists) ? lists : []);
    handleCloseShotDialog();
    if (onUpdate) onUpdate();
  };

  const handleDeleteWithUndo = async (shotListId: string) => {
    const shotList = shotLists.find((sl) => sl.id === shotListId);
    if (shotList) {
      try {
        setDeletedShotList(shotList);
        await castingService.deleteShotList(projectId, shotListId);
        const lists = await castingService.getShotLists(projectId);
        setShotLists(Array.isArray(lists) ? lists : []);
        setUndoSnackbarOpen(true);
        if (onUpdate) onUpdate();
      } catch (error) {
        console.error('Error deleting shot list:', error);
      }
    }
  };

  const handleUndoDelete = async () => {
    if (deletedShotList) {
      try {
        await castingService.saveShotList(projectId, deletedShotList);
        const lists = await castingService.getShotLists(projectId);
        setShotLists(Array.isArray(lists) ? lists : []);
        setDeletedShotList(null);
        setUndoSnackbarOpen(false);
        if (onUpdate) onUpdate();
      } catch (error) {
        console.error('Error undoing delete:', error);
      }
    }
  };

  const handleOpenStoryboardDialog = (shotList: ShotList) => {
    setSelectedShotListForStoryboard(shotList);
    // Select all shots by default
    setSelectedShotsForConversion(new Set(shotList.shots.map(s => s.id)));
    setStoryboardDialogOpen(true);
  };

  const handleCloseStoryboardDialog = () => {
    setStoryboardDialogOpen(false);
    setSelectedShotListForStoryboard(null);
    setSelectedShotsForConversion(new Set());
  };

  const handleOpenStoryboardPanel = () => {
    setStoryboardPanelOpen(true);
  };

  const handleCloseStoryboardPanel = () => {
    setStoryboardPanelOpen(false);
  };

  const handleConvertToStoryboard = async () => {
    if (!selectedShotListForStoryboard) return;

    try {
      // Get selected shots
      const shotsToConvert = selectedShotListForStoryboard.shots.filter(
        shot => selectedShotsForConversion.has(shot.id)
      );

      if (shotsToConvert.length === 0) {
        toast.showWarning('Velg minst ett shot å konvertere');
        return;
      }

      // Convert shots to storyboard frames
      const frames: StoryboardFrame[] = convertShotListToStoryboardFrames(
        shotsToConvert,
        (roleId) => getRoleName(roleId)
      );

      // Generate storyboard name
      const storyboardName = generateStoryboardName(
        getSceneName(selectedShotListForStoryboard.sceneId, selectedShotListForStoryboard.sceneName),
        selectedShotListForStoryboard.sceneName
      );

      // Create storyboard using storyboardStore
      const { createStoryboard, loadStoryboard, addFrame } = useStoryboardStore.getState();
      
      // Create new storyboard
      createStoryboard(storyboardName, '16:9');
      
      // Load the newly created storyboard
      const newStoryboardId = useStoryboardStore.getState().currentStoryboardId;
      if (newStoryboardId) {
        loadStoryboard(newStoryboardId);
        
        // Add all frames to the storyboard
        frames.forEach((frame) => {
          addFrame(frame);
        });
      }

      toast.showSuccess(`Storyboard "${storyboardName}" opprettet med ${frames.length} frames`);
      handleCloseStoryboardDialog();
      handleOpenStoryboardPanel();
    } catch (error) {
      console.error('Error converting to storyboard:', error);
      toast.showError('Feil ved konvertering til storyboard');
    }
  };

  // Shoot Mode handlers removed

  const handleDeleteShot = async (shotListId: string, shotId: string) => {
    const shotList = shotLists.find(sl => sl.id === shotListId);
    if (!shotList) return;

    try {
      const updatedShotList: ShotList = {
        ...shotList,
        shots: shotList.shots.filter(s => s.id !== shotId),
        updatedAt: new Date().toISOString(),
      };

      await castingService.saveShotList(projectId, updatedShotList);
      const lists = await castingService.getShotLists(projectId);
      setShotLists(Array.isArray(lists) ? lists : []);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error deleting shot:', error);
    }
  };

  const handleDragEnd = async (event: DragEndEvent, shotListId: string) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;
    
    const shotList = shotLists.find(sl => sl.id === shotListId);
    if (!shotList) return;
    
    const oldIndex = shotList.shots.findIndex(s => s.id === active.id);
    const newIndex = shotList.shots.findIndex(s => s.id === over.id);
    
    if (oldIndex === -1 || newIndex === -1) return;
    
    const reorderedShots = arrayMove(shotList.shots, oldIndex, newIndex);
    
    const updatedShotList: ShotList = {
      ...shotList,
      shots: reorderedShots,
      updatedAt: new Date().toISOString(),
    };
    
    setShotLists(prev => prev.map(sl => sl.id === shotListId ? updatedShotList : sl));
    // Broadcast reorder immediately so collaborators see it before DB round-trip
    rt.emitShotReordered({ shotListId, orderedShotIds: reorderedShots.map(s => s.id) });
    
    try {
      await castingService.saveShotList(projectId, updatedShotList);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error reordering shots:', error);
      const lists = await castingService.getShotLists(projectId);
      setShotLists(Array.isArray(lists) ? lists : []);
    }
  };

  const handleUpdateShotInline = async (shotList: ShotList, shotId: string, updates: Partial<CastingShot>) => {
    const normalizedUpdates = {
      ...updates,
      ...(updates.status === 'completed' ? { completedAt: new Date().toISOString() } : {}),
    };
    const previousShot = shotList.shots.find(s => s.id === shotId);
    const updatedShots = shotList.shots.map((shot) =>
      shot.id === shotId ? { ...shot, ...normalizedUpdates, updatedAt: new Date().toISOString() } : shot
    );
    const updatedShotList: ShotList = {
      ...shotList,
      shots: updatedShots,
      updatedAt: new Date().toISOString(),
    };
    try {
      await castingService.saveShotList(projectId, updatedShotList);
      // Broadcast status change
      if (updates.status && previousShot) {
        rt.emitShotStatusChanged({
          shotListId:     shotList.id,
          shotId,
          previousStatus: previousShot.status ?? 'not_started',
          newStatus:      updates.status,
        });
      }
      const lists = await castingService.getShotLists(projectId);
      setShotLists(Array.isArray(lists) ? lists : []);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error updating shot:', error);
    }
  };

  const handleQuickShotChange = (shotListId: string, updates: Partial<{ description: string; shotType: ShotType; estimatedTime?: number }>) => {
    setQuickShotDrafts((prev) => ({
      ...prev,
      [shotListId]: {
        description: prev[shotListId]?.description || '',
        shotType: prev[shotListId]?.shotType || 'Medium',
        estimatedTime: prev[shotListId]?.estimatedTime,
        ...updates,
      },
    }));
  };

  const handleQuickAddShot = async (shotList: ShotList) => {
    const preset = getShotPreset(shotList);
    const draft = quickShotDrafts[shotList.id] || { description: '', shotType: 'Medium', estimatedTime: preset.estimatedTime };
    const description = draft.description.trim() || `Shot ${shotList.shots.length + 1}`;
    const newShot: CastingShot = {
      id: `shot-${Date.now()}`,
      shotType: draft.shotType || 'Medium',
      cameraAngle: 'Eye Level',
      cameraMovement: 'Static',
      roleId: roles.length > 0 ? roles[0].id : '',
      sceneId: shotList.sceneId,
      description,
      status: 'not_started',
      mediaType: preset.mediaType,
      priority: preset.priority,
      estimatedTime: draft.estimatedTime ?? preset.estimatedTime,
      lensRecommendation: preset.lensRecommendation,
      lightingSetup: preset.lightingSetup,
      backgroundRecommendation: preset.backgroundRecommendation,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      const updatedShotList: ShotList = {
        ...shotList,
        shots: [...shotList.shots, newShot],
        updatedAt: new Date().toISOString(),
      };
      await castingService.saveShotList(projectId, updatedShotList);
      const lists = await castingService.getShotLists(projectId);
      setShotLists(Array.isArray(lists) ? lists : []);
      if (onUpdate) onUpdate();
      setQuickShotDrafts((prev) => ({ ...prev, [shotList.id]: { description: '', shotType: 'Medium', estimatedTime: preset.estimatedTime } }));
    } catch (error) {
      console.error('Error quick-adding shot:', error);
      toast.showError('Kunne ikke legge til shot');
    }
  };

  const handleInlineEditChange = (shotId: string, updates: Partial<{ description: string; estimatedTime?: number; priority?: ShotPriority }>) => {
    setInlineEditDrafts((prev) => ({
      ...prev,
      [shotId]: {
        ...prev[shotId],
        ...updates,
      },
    }));
  };

  const handleInlineEditCommit = async (shotList: ShotList, shot: CastingShot) => {
    const draft = inlineEditDrafts[shot.id];
    if (!draft) return;
    const updates: Partial<CastingShot> = {};
    if (draft.description !== undefined && draft.description !== shot.description) {
      updates.description = draft.description;
    }
    if (draft.estimatedTime !== undefined && draft.estimatedTime !== shot.estimatedTime) {
      updates.estimatedTime = draft.estimatedTime;
    }
    if (draft.priority && draft.priority !== (shot.priority || 'important')) {
      updates.priority = draft.priority;
    }
    if (Object.keys(updates).length === 0) return;
    await handleUpdateShotInline(shotList, shot.id, updates);
  };


  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const toggleFavorite = (id: string) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(id)) {
      newFavorites.delete(id);
    } else {
      newFavorites.add(id);
    }
    setFavorites(newFavorites);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredAndSortedShotLists.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAndSortedShotLists.map((sl) => sl.id)));
    }
  };

  const handleToggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setConfirmBulkDeleteOpen(true);
  };

  const executeBulkDelete = async () => {
    setConfirmBulkDeleteOpen(false);
    try {
      for (const id of selectedIds) {
        await castingService.deleteShotList(projectId, id);
      }
      const lists = await castingService.getShotLists(projectId);
      setShotLists(Array.isArray(lists) ? lists : []);
      setSelectedIds(new Set());
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error deleting shot lists:', error);
    }
  };

  const handleDuplicate = async (shotList: ShotList) => {
    try {
      const newShotList: ShotList = {
        ...shotList,
        id: `shotlist-${Date.now()}`,
        shots: shotList.shots.map(shot => ({ ...shot, id: `shot-${Date.now()}-${Math.random()}` })),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await castingService.saveShotList(projectId, newShotList);
      const lists = await castingService.getShotLists(projectId);
      setShotLists(Array.isArray(lists) ? lists : []);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error duplicating shot list:', error);
    }
  };

  const handleExportCSV = async () => {
    try {
      const project = await castingService.getProject(projectId);
      if (!project) {
        toast.showError('Prosjekt ikke funnet');
        return;
      }

      const htmlContent = generateShotListsHTML(project, shotLists);

      // Create a new window for printing/viewing
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.showError('Kunne ikke åpne eksport-vindu. Vennligst tillat popups.');
        return;
      }

      printWindow.document.write(htmlContent);
      printWindow.document.close();

      // Trigger print (which allows saving as PDF)
      setTimeout(() => {
        printWindow.print();
      }, 250);
    } catch (error) {
      console.error('Error exporting shot lists:', error);
      toast.showError('Kunne ikke eksportere shot lists');
    }
  };

  const handleExportAllPDF = async () => {
    try {
      const project = await castingService.getProject(projectId);
      if (!project) {
        toast.showError('Prosjekt ikke funnet');
        return;
      }
      const htmlContent = generateShotListsHTML(project, shotLists);
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.showError('Kunne ikke åpne eksport-vindu');
        return;
      }
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 250);
      toast.showSuccess(`Eksporterer ${shotLists.length} scener til PDF`);
    } catch (error) {
      console.error('Error exporting all PDF:', error);
      toast.showError('Kunne ikke eksportere PDF');
    }
  };

  const handleExportScenePDF = async (shotList: ShotList) => {
    try {
      const project = await castingService.getProject(projectId);
      if (!project) {
        toast.showError('Prosjekt ikke funnet');
        return;
      }
      const htmlContent = generateShotListsHTML(project, [shotList]);
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.showError('Kunne ikke åpne eksport-vindu');
        return;
      }
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 250);
      toast.showSuccess(`Eksporterer scene til PDF`);
    } catch (error) {
      console.error('Error exporting scene PDF:', error);
      toast.showError('Kunne ikke eksportere PDF');
    }
  };

  const generateShotListsHTML = (project: any, shotLists: ShotList[]): string => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('nb-NO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Calculate summary statistics
    const totalLists = shotLists.length;
    const totalShots = shotLists.reduce((acc, sl) => acc + sl.shots.length, 0);
    const shotTypeCount: Record<string, number> = {};
    shotLists.forEach((sl) => {
      sl.shots.forEach((shot) => {
        shotTypeCount[shot.shotType] = (shotTypeCount[shot.shotType] || 0) + 1;
      });
    });
    const mostCommonShotType = Object.entries(shotTypeCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    // SVG Icon for shot list
    const shotListIconSVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="8" r="3"/>
      <path d="M5 20v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2"/>
      <rect x="15" y="3" width="4" height="3" rx="0.5"/>
      <circle cx="17" cy="4.5" r="0.8"/>
      <line x1="15" y1="4.5" x2="13" y2="4.5"/>
      <rect x="3" y="5" width="3" height="5" rx="0.5"/>
      <line x1="4" y1="6.5" x2="5" y2="6.5"/>
      <line x1="4" y1="7.5" x2="5" y2="7.5"/>
      <line x1="4" y1="8.5" x2="5" y2="8.5"/>
    </svg>`;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${project.name} - Shot Lists</title>
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
      border-bottom: 5px solid #e91e63;
      padding: 30px 35px;
      margin: -50px -60px 40px -60px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    }
    .title {
      font-size: 36px;
      font-weight: 800;
      color: #e91e63;
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
      border-left: 6px solid #e91e63;
      padding: 30px;
      margin-bottom: 45px;
      border-radius: 12px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    }
    .summary-title {
      font-size: 20px;
      font-weight: 700;
      color: #e91e63;
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
      color: #e91e63;
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
    th {
      background: linear-gradient(135deg, #e91e63 0%, #c2185b 100%);
      color: white;
      font-weight: 700;
      padding: 18px 20px;
      text-align: left;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      border: none;
    }
    th:first-child {
      border-top-left-radius: 10px;
    }
    th:last-child {
      border-top-right-radius: 10px;
    }
    td {
      padding: 16px 20px;
      border-bottom: 1px solid #e2e8f0;
      color: #334155;
      font-size: 14px;
      font-weight: 400;
    }
    tr:last-child td {
      border-bottom: none;
    }
    tr:nth-child(even) {
      background-color: #f8fafc;
    }
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
        ${shotListIconSVG}
        ${project.name} - Shot Lists
      </div>
      <div class="subtitle">Eksportert: ${dateStr}</div>
    </div>

    <div class="summary">
      <div class="summary-title">
        ${shotListIconSVG}
        Oversikt
      </div>
      <div class="summary-grid">
        <div class="summary-item">
          <span class="summary-number">${totalLists}</span>
          <span class="summary-label">Shot Lists</span>
        </div>
        <div class="summary-item">
          <span class="summary-number">${totalShots}</span>
          <span class="summary-label">Totalt Shots</span>
        </div>
        <div class="summary-item">
          <span class="summary-number" style="font-size: 24px;">${mostCommonShotType}</span>
          <span class="summary-label">Vanligste Shot Type</span>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <div class="section-title">
          <span class="section-icon">${shotListIconSVG}</span>
          Shot Lists
        </div>
        <span class="section-count">${totalLists} liste${totalLists !== 1 ? 'r' : ''}</span>
      </div>
      <div class="section-content">
        ${
          shotLists.length === 0
            ? '<div class="empty-state">Ingen shot lists ennå</div>'
            : `<table>
          <thead>
            <tr>
              <th>Scene</th>
              <th>Antall Shots</th>
              <th>Shot Typer</th>
              <th>Notater</th>
              <th>Oppdatert</th>
            </tr>
          </thead>
          <tbody>
            ${shotLists
              .map(
                (sl) => `<tr>
              <td><strong>${getSceneName(sl.sceneId, sl.sceneName)}</strong></td>
              <td>${sl.shots.length}</td>
              <td>${sl.shots.map((s) => getShotTypeLabel(s.shotType)).join(', ') || '-'}</td>
              <td>${sl.notes || '-'}</td>
              <td>${formatOptionalDate(sl.updatedAt)}</td>
            </tr>`
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
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedCards(newExpanded);
  };

  const sceneLabel = getSceneName(shotFormData.sceneId || '', undefined);
  const selectedMediaInfo = mediaTypeConfig[shotFormData.mediaType || defaultMediaType];
  const selectedPriorityInfo = priorityConfig[shotFormData.priority || 'important'];
  const estimatedMinutes = shotFormData.estimatedTime ?? 5;

  // Keep keyboard action refs up-to-date on every render (safe — refs are not reactive)
  kbActionsRef.current.openDialog = handleOpenDialog;
  kbActionsRef.current.exportCsv = handleExportCSV;

  return (
    <Box
      component="section"
      aria-labelledby="shotlist-panel-title"
      sx={{ p: { xs: 2, sm: 3, md: containerPadding } }}
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
        }}
      >
        {/* Title with icon */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: { xs: 36, sm: 42 },
              height: { xs: 36, sm: 42 },
              borderRadius: 2,
              bgcolor: 'rgba(233, 30, 99, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <VideoCallIcon sx={{ color: '#e91e63', fontSize: { xs: 20, sm: 24 } }} />
          </Box>
          <Box>
            <Typography
              variant="h6"
              component="h2"
              id="shotlist-panel-title"
              sx={{
                color: '#fff',
                fontWeight: 700,
                fontSize: { xs: '1.1rem', sm: '1.35rem' },
                lineHeight: 1.2,
              }}
            >
              Shot-list
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
            >
              Administrer shot lists
            </Typography>
            {/* Real-time connection + presence badge */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25 }}>
              <Box
                sx={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  flexShrink: 0,
                  bgcolor:
                    rt.connectionStatus === 'connected'   ? '#4caf50' :
                    rt.connectionStatus === 'offline'     ? '#ef5350' : '#9333ea',
                  boxShadow:
                    rt.connectionStatus === 'connected' ? '0 0 0 2px rgba(76,175,80,0.25)' : 'none',
                }}
              />
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.65rem', lineHeight: 1 }}>
                {rt.connectionStatus === 'connected'
                  ? rt.presence.size > 0
                    ? `${[...rt.presence.values()].map(p => p.userName).join(', ')} er også her`
                    : 'Live'
                  : rt.connectionStatus === 'offline' ? 'Offline' : 'Kobler til…'}
              </Typography>
            </Box>
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
          {/* Audit log button */}
          <Tooltip title={`Aktivitetslogg (${rt.auditLog.length})`}>
            <IconButton
              ref={auditLogAnchorRef}
              onClick={() => setShowAuditLog(v => !v)}
              aria-label="Vis aktivitetslogg"
              sx={{
                color: rt.auditLog.length > 0 ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.35)',
                minHeight: TOUCH_TARGET_SIZE,
                minWidth: TOUCH_TARGET_SIZE,
                ...focusVisibleStyles,
              }}
            >
              <Badge
                badgeContent={rt.auditLog.length}
                max={99}
                sx={{ '& .MuiBadge-badge': { bgcolor: '#e91e63', color: '#fff', fontSize: '0.6rem' } }}
              >
                <HistoryIcon fontSize="small" />
              </Badge>
            </IconButton>
          </Tooltip>

          <Tooltip title="Statistikk">
            <Button
              variant="outlined"
              onClick={() => setShowStats(v => !v)}
              aria-label="Vis/skjul statistikk"
              sx={{
                minHeight: TOUCH_TARGET_SIZE,
                minWidth: TOUCH_TARGET_SIZE,
                color: '#4caf50',
                borderColor: '#4caf50',
                px: { xs: 1, sm: 2 },
                ...focusVisibleStyles,
                '&:hover': { bgcolor: 'rgba(76,175,80,0.1)' },
              }}
            >
              <StatsIcon />
              {!isMobile && <Box component="span" sx={{ ml: 1 }}>Stats</Box>}
            </Button>
          </Tooltip>

          <Tooltip title="Åpne Team Dashboard">
            <Button
              variant="outlined"
              onClick={() => {
                setTeamDashboardCrewSegment('all');
                setShowTeamDashboard(true);
              }}
              aria-label="Åpne team dashboard"
              sx={{
                minHeight: TOUCH_TARGET_SIZE,
                minWidth: TOUCH_TARGET_SIZE,
                color: '#e91e63',
                borderColor: '#e91e63',
                px: { xs: 1, sm: 2 },
                ...focusVisibleStyles,
                '&:hover': { bgcolor: 'rgba(233,30,99,0.1)' },
              }}
            >
              <DashboardIcon />
              {!isMobile && <Box component="span" sx={{ ml: 1 }}>Team</Box>}
            </Button>
          </Tooltip>

          <Tooltip title="Storyboard">
            <Button
              variant="outlined"
              onClick={() => setShowStoryboardManager(true)}
              aria-label="Åpne storyboard manager"
              sx={{
                minHeight: TOUCH_TARGET_SIZE,
                minWidth: TOUCH_TARGET_SIZE,
                color: '#00d4ff',
                borderColor: '#00d4ff',
                px: { xs: 1, sm: 2 },
                ...focusVisibleStyles,
                '&:hover': { bgcolor: 'rgba(0,212,255,0.1)' },
              }}
            >
              <StoryboardIcon />
              {!isMobile && <Box component="span" sx={{ ml: 1 }}>Storyboard</Box>}
            </Button>
          </Tooltip>

          <Tooltip title="Eksporter PDF">
            <Button
              variant="outlined"
              onClick={() => setShowExportDialog(true)}
              aria-label="Eksporter til PDF"
              sx={{
                minHeight: TOUCH_TARGET_SIZE,
                minWidth: TOUCH_TARGET_SIZE,
                color: '#9333ea',
                borderColor: '#9333ea',
                px: { xs: 1, sm: 2 },
                ...focusVisibleStyles,
                '&:hover': { bgcolor: 'rgba(147,51,234,0.1)' },
              }}
            >
              <PdfIcon />
              {!isMobile && <Box component="span" sx={{ ml: 1 }}>Eksporter</Box>}
            </Button>
          </Tooltip>

          <Tooltip title="Backup kontroll system (3-2-1 + loggbok)">
            <Button
              variant="outlined"
              onClick={() => setMemoryCardControlOpen(true)}
              aria-label="Åpne minnekort backup-kontroll"
              sx={{
                minHeight: TOUCH_TARGET_SIZE,
                minWidth: TOUCH_TARGET_SIZE,
                color: '#4fc3f7',
                borderColor: '#4fc3f7',
                px: { xs: 1, sm: 2 },
                ...focusVisibleStyles,
                '&:hover': { bgcolor: 'rgba(79,195,247,0.12)' },
              }}
            >
              <StorageIcon />
              {!isMobile && <Box component="span" sx={{ ml: 1 }}>Kortkontroll</Box>}
            </Button>
          </Tooltip>

          <Tooltip title="Opprett scene">
            <Button
              variant="contained"
              onClick={() => handleOpenDialog()}
              aria-label="Opprett ny scene"
              sx={{
                bgcolor: '#e91e63',
                color: '#fff',
                fontWeight: 600,
                minHeight: TOUCH_TARGET_SIZE,
                flex: { xs: 1, sm: 'none' },
                ...focusVisibleStyles,
                '&:hover': { bgcolor: '#c2185b' },
              }}
            >
              <AddIcon />
              {!isMobile && <Box component="span" sx={{ ml: 1 }}>Ny scene</Box>}
            </Button>
          </Tooltip>
        </Box>
      </Box>

      {/* Info if no scenes from Scene Composer */}
      {availableScenes.length === 0 && (
        <Alert
          severity="info"
          sx={{
            mb: 2,
            bgcolor: 'rgba(33,150,243,0.1)',
            color: '#64b5f6',
            border: '1px solid rgba(33,150,243,0.3)',
            '& .MuiAlert-icon': { color: '#64b5f6' },
          }}
        >
          Du kan opprette shot lists med egne scenenavn, eller koble til Scene Composer for å velge scener derfra.
        </Alert>
      )}

      {/* Statistics Panel - Responsive */}
      <Collapse in={showStats}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(auto-fit, minmax(120px, 1fr))' },
            gap: { xs: 1.5, sm: 2 },
            mb: 2,
            p: { xs: 1.5, sm: 2 },
            bgcolor: 'rgba(255,255,255,0.03)',
            borderRadius: 2,
          }}
          role="region"
          aria-label="Statistikk over shot lists"
        >
          <Box sx={{ textAlign: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <VideoCallIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: '#e91e63' }} />
            </Box>
            <Typography variant="h4" sx={{ color: '#e91e63', fontWeight: 700, fontSize: { xs: '1.5rem', sm: '2rem' } }}>
              {stats.totalLists}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>Shot Lists</Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <VideocamIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: '#2196f3' }} />
            </Box>
            <Typography variant="h4" sx={{ color: '#2196f3', fontWeight: 700, fontSize: { xs: '1.5rem', sm: '2rem' } }}>
              {stats.totalShots}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>Totalt shots</Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <StarIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: '#ffc107' }} />
            </Box>
            <Typography variant="h4" sx={{ color: '#ffc107', fontWeight: 700, fontSize: { xs: '1.5rem', sm: '2rem' } }}>
              {stats.favorites}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>Favoritter</Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <CalendarIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: '#9c27b0' }} />
            </Box>
            <Typography variant="h4" sx={{ color: '#9c27b0', fontWeight: 700, fontSize: { xs: '1.5rem', sm: '2rem' } }}>
              {productionDays.length}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>Produksjonsdager</Typography>
          </Box>
          {/* Status breakdown */}
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" sx={{ color: '#78909c', fontWeight: 700, fontSize: { xs: '1.5rem', sm: '2rem' } }}>
              {stats.byStatus.not_started}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>Venter</Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" sx={{ color: '#9333ea', fontWeight: 700, fontSize: { xs: '1.5rem', sm: '2rem' } }}>
              {stats.byStatus.in_progress}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>Pågår</Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" sx={{ color: '#4caf50', fontWeight: 700, fontSize: { xs: '1.5rem', sm: '2rem' } }}>
              {stats.byStatus.completed}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>Fullført</Typography>
          </Box>
          {/* Overall completion progress bar */}
          {stats.totalShots > 0 && (
            <Box sx={{ gridColumn: '1 / -1', mt: 0.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>Fremdrift totalt</Typography>
                <Typography variant="caption" sx={{ color: '#4caf50', fontWeight: 600 }}>{stats.completionPercent}%</Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={stats.completionPercent}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  bgcolor: 'rgba(255,255,255,0.08)',
                  '& .MuiLinearProgress-bar': { bgcolor: '#4caf50', borderRadius: 3 },
                }}
              />
            </Box>
          )}
          {!isMobile && Object.entries(stats.shotTypeCount).slice(0, 3).map(([type, count]) => (
            <Box key={type} sx={{ textAlign: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
                <VideocamIcon sx={{ fontSize: { xs: 14, sm: 16 }, color: getShotTypeColor(type as ShotType), opacity: 0.8 }} />
              </Box>
              <Typography variant="h5" sx={{ color: getShotTypeColor(type as ShotType), fontWeight: 600 }}>
                {count}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                {getShotTypeLabel(type as ShotType)}
              </Typography>
            </Box>
          ))}
        </Box>
      </Collapse>

      {/* Search and Filter Controls - Responsive */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 1, sm: 2 },
          mb: 2,
          alignItems: { xs: 'stretch', sm: 'center' },
        }}
      >
        <TextField
          placeholder={isMobile ? 'Søk...' : 'Søk etter scene, beskrivelse...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          size="small"
          slotProps={{
            input: {
              startAdornment: <SearchIcon sx={{ color: 'rgba(255,255,255,0.87)', mr: 1 }} />,
              sx: { minHeight: TOUCH_TARGET_SIZE },
            },
            htmlInput: { 'aria-label': 'Søk i shot lists' },
          }}
          sx={{
            flex: 1,
            '& .MuiOutlinedInput-root': {
              color: '#fff',
              '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
              '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
              '&.Mui-focused fieldset': { borderColor: '#e91e63' },
            },
          }}
        />

        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Media</InputLabel>
          <Select
            value={mediaTypeFilter}
            onChange={(e) => setMediaTypeFilter(e.target.value as MediaType | 'all')}
            label="Media"
            MenuProps={{ sx: { zIndex: Z_INDEX.selectMenu } }}
            sx={{
              color: '#fff',
              minHeight: TOUCH_TARGET_SIZE,
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#e91e63' },
            }}
          >
            <MenuItem value="all">Alle typer</MenuItem>
            <MenuItem value="photo">Foto</MenuItem>
            <MenuItem value="video">Video</MenuItem>
            <MenuItem value="hybrid">Hybrid</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Tilordnet</InputLabel>
          <Select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value as typeof assigneeFilter)}
            label="Tilordnet"
            startAdornment={<TeamIcon sx={{ color: 'rgba(255,255,255,0.87)', mr: 0.5, fontSize: 18 }} />}
            MenuProps={{ sx: { zIndex: Z_INDEX.selectMenu } }}
            sx={{
              color: '#fff',
              minHeight: TOUCH_TARGET_SIZE,
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#00d4ff' },
            }}
          >
            <MenuItem value="all">Alle</MenuItem>
            <MenuItem value="mine">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#4caf50' }} />
                Mine shots
              </Box>
            </MenuItem>
            <MenuItem value="unassigned">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#9333ea' }} />
                Ikke tilordnet
              </Box>
            </MenuItem>
            {crewMembers.map((member) => (
              <MenuItem key={member.id} value={member.id}>
                {member.name}
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
                bgcolor: viewMode === 'grid' ? 'rgba(233,30,99,0.2)' : 'transparent',
                color: viewMode === 'grid' ? '#e91e63' : 'rgba(255,255,255,0.7)',
                borderColor: viewMode === 'grid' ? '#e91e63' : 'rgba(255,255,255,0.2)',
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
                bgcolor: viewMode === 'table' ? 'rgba(233,30,99,0.2)' : 'transparent',
                color: viewMode === 'table' ? '#e91e63' : 'rgba(255,255,255,0.7)',
                borderColor: viewMode === 'table' ? '#e91e63' : 'rgba(255,255,255,0.2)',
                ...focusVisibleStyles,
              }}
            >
              <TableViewIcon />
            </Button>
          </Tooltip>

          <Tooltip title="Shot planner">
            <Button
              variant={viewMode === '2d-planner' ? 'contained' : 'outlined'}
              onClick={() => setViewMode('2d-planner')}
              aria-pressed={viewMode === '2d-planner'}
              sx={{
                minHeight: TOUCH_TARGET_SIZE,
                minWidth: TOUCH_TARGET_SIZE,
                bgcolor: viewMode === '2d-planner' ? 'rgba(233,30,99,0.2)' : 'transparent',
                color: viewMode === '2d-planner' ? '#e91e63' : 'rgba(255,255,255,0.7)',
                borderColor: viewMode === '2d-planner' ? '#e91e63' : 'rgba(255,255,255,0.2)',
                ...focusVisibleStyles,
              }}
            >
              <PlannerViewIcon />
            </Button>
          </Tooltip>

          {selectedIds.size > 0 && (
            <Tooltip title={`Slett ${selectedIds.size} valgte`}>
              <Button
                variant="contained"
                onClick={handleBulkDelete}
                sx={{
                  bgcolor: '#ff4444',
                  minHeight: TOUCH_TARGET_SIZE,
                  ...focusVisibleStyles,
                  '&:hover': { bgcolor: '#cc0000' },
                }}
              >
                <DeleteIcon />
                <Box component="span" sx={{ ml: 0.5 }}>{selectedIds.size}</Box>
              </Button>
            </Tooltip>
          )}

          <Tooltip title={showFilters ? 'Skjul filtre' : 'Vis filtre'}>
            <Button
              variant={showFilters ? 'contained' : 'outlined'}
              onClick={() => setShowFilters(v => !v)}
              aria-pressed={showFilters}
              aria-label="Vis/skjul avanserte filtre"
              sx={{
                minHeight: TOUCH_TARGET_SIZE,
                minWidth: TOUCH_TARGET_SIZE,
                bgcolor: showFilters ? 'rgba(0,212,255,0.2)' : 'transparent',
                color: showFilters ? '#00d4ff' : 'rgba(255,255,255,0.7)',
                borderColor: showFilters ? '#00d4ff' : 'rgba(255,255,255,0.2)',
                ...focusVisibleStyles,
              }}
            >
              <FilterIcon />
            </Button>
          </Tooltip>
        </Box>
      </Box>

      {/* Advanced Filter Panel */}
      <Collapse in={showFilters}>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1.5,
            mb: 2,
            p: 2,
            bgcolor: 'rgba(0,212,255,0.05)',
            borderRadius: 2,
            border: '1px solid rgba(0,212,255,0.2)',
          }}
          role="region"
          aria-label="Avanserte filtre"
        >
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Prioritet</InputLabel>
            <Select
              value={priorityFilter ?? 'all'}
              onChange={(e) => {
                const v = e.target.value;
                setPriorityFilter(v === 'all' ? null : (v as ShotPriority));
              }}
              label="Prioritet"
              MenuProps={{ sx: { zIndex: Z_INDEX.selectMenu } }}
              sx={{
                color: '#fff',
                minHeight: TOUCH_TARGET_SIZE,
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,212,255,0.3)' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,212,255,0.6)' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#00d4ff' },
              }}
            >
              <MenuItem value="all">Alle</MenuItem>
              <MenuItem value="critical">Kritisk</MenuItem>
              <MenuItem value="important">Viktig</MenuItem>
              <MenuItem value="nice_to_have">Bonus</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Status</InputLabel>
            <Select
              value={statusFilter ?? 'all'}
              onChange={(e) => {
                const v = e.target.value;
                setStatusFilter(v === 'all' ? null : (v as ShotStatus));
              }}
              label="Status"
              MenuProps={{ sx: { zIndex: Z_INDEX.selectMenu } }}
              sx={{
                color: '#fff',
                minHeight: TOUCH_TARGET_SIZE,
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,212,255,0.3)' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,212,255,0.6)' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#00d4ff' },
              }}
            >
              <MenuItem value="all">Alle</MenuItem>
              <MenuItem value="not_started">Venter</MenuItem>
              <MenuItem value="in_progress">Pågår</MenuItem>
              <MenuItem value="completed">Fullført</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Collapse>

      {/* Results count */}
      {searchQuery && (
        <Alert
          severity="info"
          sx={{
            mb: 2,
            bgcolor: 'rgba(233,30,99,0.1)',
            color: '#fff',
            '& .MuiAlert-icon': { color: '#e91e63' },
          }}
        >
          Viser {filteredAndSortedShotLists.length} av {shotLists.length} shot lists
        </Alert>
      )}

      {/* Empty state */}
      {shotLists.length === 0 ? (
        <RoleRoomEmptyState
          iconSrc={scenesPng}
          title="Ingen shot lists ennå"
          subtitle="Opprett shot lists for å planlegge opptak per scene"
          color="#e91e63"
        />
      ) : filteredAndSortedShotLists.length === 0 ? (
        <Box role="status" sx={{ textAlign: 'center', py: 6, color: 'rgba(255,255,255,0.87)' }}>
          <SearchIcon sx={{ fontSize: 48, mb: 2, opacity: 0.3 }} />
          <Typography variant="body1">Ingen treff på søket</Typography>
        </Box>
      ) : viewMode === 'table' ? (
        /* Table View */
        <TableContainer
          component={Paper}
          sx={{
            bgcolor: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 2,
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <Table aria-label="Shot lists tabell" sx={{ minWidth: { xs: 500, sm: 'auto' } }}>
            <TableHead>
              <TableRow sx={{ bgcolor: 'rgba(255,255,255,0.05)' }}>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selectedIds.size === filteredAndSortedShotLists.length && filteredAndSortedShotLists.length > 0}
                    indeterminate={selectedIds.size > 0 && selectedIds.size < filteredAndSortedShotLists.length}
                    onChange={handleSelectAll}
                    aria-label="Velg alle shot lists"
                    sx={{ color: 'rgba(255,255,255,0.87)', '&.Mui-checked': { color: '#e91e63' } }}
                  />
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortField === 'scene'}
                    direction={sortField === 'scene' ? sortDirection : 'asc'}
                    onClick={() => handleSort('scene')}
                    sx={{ color: '#fff', '&:hover': { color: '#e91e63' } }}
                  >
                    Scene
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortField === 'shots'}
                    direction={sortField === 'shots' ? sortDirection : 'asc'}
                    onClick={() => handleSort('shots')}
                    sx={{ color: '#fff', '&:hover': { color: '#e91e63' } }}
                  >
                    Shots
                  </TableSortLabel>
                </TableCell>
                <TableCell>Shot typer</TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortField === 'updated'}
                    direction={sortField === 'updated' ? sortDirection : 'asc'}
                    onClick={() => handleSort('updated')}
                    sx={{ color: '#fff', '&:hover': { color: '#e91e63' } }}
                  >
                    Oppdatert
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">Handlinger</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredAndSortedShotLists.map((shotList) => (
                <TableRow
                  key={shotList.id}
                  sx={{
                    bgcolor: selectedIds.has(shotList.id) ? 'rgba(233,30,99,0.1)' : 'transparent',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                  }}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedIds.has(shotList.id)}
                      onChange={() => handleToggleSelect(shotList.id)}
                      sx={{ color: 'rgba(255,255,255,0.87)', '&.Mui-checked': { color: '#e91e63' } }}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {favorites.has(shotList.id) && <StarIcon sx={{ color: '#ffc107', fontSize: 16 }} />}
                      <Typography sx={{ color: '#fff' }}>{getSceneName(shotList.sceneId, shotList.sceneName)}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={shotList.shots.length}
                      size="small"
                      sx={{ bgcolor: 'rgba(233,30,99,0.2)', color: '#e91e63' }}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {[...new Set(shotList.shots.map(s => s.shotType))].slice(0, 3).map((type) => (
                        <Chip
                          key={type}
                          label={getShotTypeLabel(type)}
                          size="small"
                          sx={{ bgcolor: `${getShotTypeColor(type)}33`, color: getShotTypeColor(type), fontSize: '10px', height: 20 }}
                        />
                      ))}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                      {formatOptionalDate(shotList.updatedAt)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                      <Tooltip title={favorites.has(shotList.id) ? 'Fjern favoritt' : 'Favoritt'}>
                        <IconButton onClick={() => toggleFavorite(shotList.id)} sx={{ color: favorites.has(shotList.id) ? '#ffc107' : 'rgba(255,255,255,0.3)' }}>
                          {favorites.has(shotList.id) ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Dupliser">
                        <IconButton onClick={() => handleDuplicate(shotList)} sx={{ color: 'rgba(255,255,255,0.87)' }}>
                          <DuplicateIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Rediger">
                        <IconButton onClick={() => handleOpenDialog(shotList)} sx={{ color: '#e91e63' }}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Slett">
                        <IconButton onClick={() => handleDeleteWithUndo(shotList.id)} sx={{ color: '#ff4444' }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : viewMode === '2d-planner' ? (
        /* 2D Shot Planner View */
        <Box sx={{ height: 'calc(100vh - 300px)', bgcolor: 'rgba(0,0,0,0.2)', borderRadius: 2, overflow: 'hidden' }}>
          <Suspense fallback={<MUICircularProgress sx={{ mt: 4 }} />}>
            <ShotPlannerPanel />
          </Suspense>
        </Box>
      ) : (
        /* Grid View - Responsive */
        <Grid container spacing={{ xs: 1.5, sm: 2, md: 3 }}>
          {filteredAndSortedShotLists.map((shotList) => (
            <Grid key={shotList.id} size={{ xs: 12, sm: 6, lg: 4 }}>
              <Card
                component="article"
                sx={{
                  bgcolor: selectedIds.has(shotList.id) ? 'rgba(233,30,99,0.15)' : 'rgba(255,255,255,0.05)',
                  border: selectedIds.has(shotList.id) ? '2px solid #e91e63' : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 2,
                  transition: 'all 0.2s ease',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.08)', transform: 'translateY(-2px)' },
                }}
              >
                <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                  {/* Scene Header - Simple with title and edit/delete buttons */}
                  <Box 
                    sx={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      mb: 2,
                      pb: 1,
                      borderBottom: '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <MovieIcon sx={{ color: '#e91e63', fontSize: 20 }} />
                      <Typography
                        variant="h6"
                        component="h3"
                        sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '1rem', sm: '1.1rem' } }}
                      >
                        {getSceneName(shotList.sceneId, shotList.sceneName)}
                      </Typography>
                      <Chip
                        label={`${shotList.shots.length} shots`}
                        size="small"
                        sx={{
                          bgcolor: 'rgba(233,30,99,0.15)',
                          color: '#e91e63',
                          fontSize: '11px',
                          height: 22,
                        }}
                      />
                      {/* Per-card status mini-chips + progress */}
                      {shotList.shots.length > 0 && (() => {
                        const ns = shotList.shots.filter(s => (s.status || 'not_started') === 'not_started').length;
                        const ip = shotList.shots.filter(s => s.status === 'in_progress').length;
                        const done = shotList.shots.filter(s => s.status === 'completed').length;
                        const pct = Math.round((done / shotList.shots.length) * 100);
                        return (
                          <>
                            <Box sx={{ display: 'flex', gap: 0.4, ml: 0.5 }}>
                              {ns > 0 && <Chip label={ns} size="small" sx={{ bgcolor: 'rgba(120,144,156,0.2)', color: '#78909c', height: 18, fontSize: '9px', minWidth: 22, '& .MuiChip-label': { px: 0.75 } }} />}
                              {ip > 0 && <Chip label={ip} size="small" sx={{ bgcolor: 'rgba(147,51,234,0.2)', color: '#9333ea', height: 18, fontSize: '9px', minWidth: 22, '& .MuiChip-label': { px: 0.75 } }} />}
                              {done > 0 && <Chip label={done} size="small" sx={{ bgcolor: 'rgba(76,175,80,0.2)', color: '#4caf50', height: 18, fontSize: '9px', minWidth: 22, '& .MuiChip-label': { px: 0.75 } }} />}
                            </Box>
                            <Tooltip title={`${pct}% fullført`}>
                              <LinearProgress
                                variant="determinate"
                                value={pct}
                                sx={{ width: 44, height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.1)', '& .MuiLinearProgress-bar': { bgcolor: pct === 100 ? '#4caf50' : '#9333ea', borderRadius: 2 } }}
                              />
                            </Tooltip>
                          </>
                        );
                      })()}
                      {/* Coverage warning chips */}
                      {shotList.shots.length > 0 && (() => {
                        const unassigned = shotList.shots.filter(s => !s.assigneeId && !s.reservedBy).length;
                        const noEst = shotList.shots.filter(s => !s.estimatedTime).length;
                        const productionDay = shotListProductionDays.get(shotList.id);
                        const productionDate = productionDay?.date;
                        const daysUntil = productionDate
                          ? Math.ceil((new Date(productionDate).getTime() - Date.now()) / 86_400_000)
                          : null;
                        const nearDeadline = daysUntil !== null && daysUntil >= 0 && daysUntil <= 3;
                        const notStartedCount = shotList.shots.filter(s => (s.status || 'not_started') === 'not_started').length;
                        if (unassigned === 0 && noEst === 0 && !(nearDeadline && notStartedCount > 0)) return null;
                        return (
                          <Box sx={{ display: 'flex', gap: 0.4, ml: 0.5 }}>
                            {unassigned > 0 && (
                              <Tooltip title={`${unassigned} shot${unassigned > 1 ? 's' : ''} uten ansvarlig`}>
                                <Chip
                                  icon={<AssignIcon style={{ fontSize: 11 }} />}
                                  label={unassigned}
                                  size="small"
                                  sx={{ bgcolor: 'rgba(147,51,234,0.18)', color: '#ffa726', height: 18, fontSize: '9px', minWidth: 32, '& .MuiChip-label': { px: 0.5 }, '& .MuiChip-icon': { ml: 0.5 } }}
                                />
                              </Tooltip>
                            )}
                            {noEst > 0 && (
                              <Tooltip title={`${noEst} shot${noEst > 1 ? 's' : ''} mangler estimert tid`}>
                                <Chip
                                  icon={<TimeIcon style={{ fontSize: 11 }} />}
                                  label={noEst}
                                  size="small"
                                  sx={{ bgcolor: 'rgba(120,144,156,0.18)', color: '#90a4ae', height: 18, fontSize: '9px', minWidth: 32, '& .MuiChip-label': { px: 0.5 }, '& .MuiChip-icon': { ml: 0.5 } }}
                                />
                              </Tooltip>
                            )}
                            {nearDeadline && notStartedCount > 0 && (
                              <Tooltip title={`${notStartedCount} ustartet shot \u2014 innspilling om ${daysUntil ?? 0} dag${daysUntil === 1 ? '' : 'er'}`}>
                                <Chip
                                  icon={<WarningIcon style={{ fontSize: 11 }} />}
                                  label="!"
                                  size="small"
                                  sx={{ bgcolor: 'rgba(244,67,54,0.18)', color: '#ef5350', height: 18, fontSize: '10px', fontWeight: 700, minWidth: 28, '& .MuiChip-label': { px: 0.5 }, '& .MuiChip-icon': { ml: 0.5 } }}
                                />
                              </Tooltip>
                            )}
                          </Box>
                        );
                      })()}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Tooltip title="Rediger scene">
                        <IconButton
                          onClick={() => handleOpenDialog(shotList)}
                          size="small"
                          sx={{
                            color: '#e91e63',
                            ...focusVisibleStyles,
                            '&:hover': { bgcolor: 'rgba(233,30,99,0.15)' },
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Slett scene">
                        <IconButton
                          onClick={() => handleDeleteWithUndo(shotList.id)}
                          size="small"
                          sx={{
                            color: 'rgba(255,255,255,0.7)',
                            ...focusVisibleStyles,
                            '&:hover': { color: '#ff4444' },
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>

                  {/* Storyboard Generation Progress */}
                  {generatingStoryboardImages[shotList.id] && (
                    <Box
                      sx={{
                        mb: 1.5,
                        p: 1,
                        bgcolor: 'rgba(0,212,255,0.08)',
                        borderRadius: 1.5,
                        border: '1px solid rgba(0,212,255,0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                      }}
                    >
                      {storyboardGenerationProgress[shotList.id] ? (
                        <>
                          <MUICircularProgress size={14} sx={{ color: '#00d4ff', flexShrink: 0 }} />
                          <Typography variant="caption" sx={{ color: '#00d4ff', flex: 1 }}>
                            Genererer bilde {storyboardGenerationProgress[shotList.id].current} / {storyboardGenerationProgress[shotList.id].total}
                          </Typography>
                          {storyboardGenerationProgress[shotList.id].current >= storyboardGenerationProgress[shotList.id].total && (
                            <WarningIcon sx={{ fontSize: 14, color: '#9333ea' }} />
                          )}
                        </>
                      ) : (
                        <>
                          <MUICircularProgress size={14} sx={{ color: '#00d4ff', flexShrink: 0 }} />
                          <Typography variant="caption" sx={{ color: '#00d4ff' }}>
                            Starter storyboard-generering…
                          </Typography>
                        </>
                      )}
                    </Box>
                  )}

                  {/* Quick Add Shot - Always visible */}
                  <Box
                    sx={{
                      mb: 1.5,
                      p: 1.5,
                      bgcolor: 'rgba(0,212,255,0.05)',
                      borderRadius: 1.5,
                      border: '1px dashed rgba(0,212,255,0.3)',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <AddIcon sx={{ color: '#00d4ff', fontSize: 18 }} />
                      <Typography variant="caption" sx={{ color: '#00d4ff', fontWeight: 600 }}>
                        Legg til shot
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {(['Wide', 'Medium', 'Close-up', 'Detail', 'Portrait'] as ShotType[]).map((type) => (
                        <Chip
                          key={type}
                          label={getShotTypeLabel(type)}
                          size="small"
                          onClick={async () => {
                            const preset = getShotPreset(shotList);
                            const newShot: CastingShot = {
                              id: `shot-${Date.now()}`,
                              shotType: type,
                              cameraAngle: 'Eye Level',
                              cameraMovement: 'Static',
                              roleId: roles.length > 0 ? roles[0].id : '',
                              sceneId: shotList.sceneId || '',
                              description: `${getShotTypeLabel(type)} shot`,
                              estimatedTime: preset.estimatedTime,
                              status: 'not_started',
                              priority: preset.priority,
                              mediaType: preset.mediaType,
                              lensRecommendation: preset.lensRecommendation,
                              lightingSetup: preset.lightingSetup,
                              backgroundRecommendation: preset.backgroundRecommendation,
                              createdAt: new Date().toISOString(),
                              updatedAt: new Date().toISOString(),
                            };
                            try {
                              const updatedShotList: ShotList = {
                                ...shotList,
                                shots: [...shotList.shots, newShot],
                                updatedAt: new Date().toISOString(),
                              };
                              await castingService.saveShotList(projectId, updatedShotList);
                              const lists = await castingService.getShotLists(projectId);
                              setShotLists(Array.isArray(lists) ? lists : []);
                              if (onUpdate) onUpdate();
                              toast.showSuccess(`${getShotTypeLabel(type)} shot lagt til`);
                            } catch (error) {
                              console.error('Error quick-adding shot:', error);
                              toast.showError('Kunne ikke legge til shot');
                            }
                          }}
                          sx={{
                            bgcolor: `${getShotTypeColor(type)}22`,
                            color: getShotTypeColor(type),
                            border: `1px solid ${getShotTypeColor(type)}44`,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            fontSize: { xs: '10px', sm: '11px' },
                            height: { xs: 28, sm: 26 },
                            '&:hover': {
                              bgcolor: `${getShotTypeColor(type)}44`,
                              transform: 'scale(1.05)',
                            },
                          }}
                        />
                      ))}
                      <Chip
                        label="+ Mer"
                        size="small"
                        onClick={() => handleOpenShotDialog(shotList.id)}
                        sx={{
                          bgcolor: 'rgba(233,30,99,0.15)',
                          color: '#e91e63',
                          border: '1px solid rgba(233,30,99,0.3)',
                          cursor: 'pointer',
                          fontSize: { xs: '10px', sm: '11px' },
                          height: { xs: 28, sm: 26 },
                          '&:hover': {
                            bgcolor: 'rgba(233,30,99,0.3)',
                          },
                        }}
                      />
                    </Box>
                  </Box>

                  {/* Production Day Info */}
                  {shotListProductionDays.get(shotList.id) != null && (
                    <Box sx={{ mb: 1.5 }}>
                      <ProductionDayCardInfo
                        productionDay={shotListProductionDays.get(shotList.id) ?? null}
                        shots={shotList.shots}
                        compact
                      />
                    </Box>
                  )}

                  {/* Expandable shots list */}
                  <Collapse in={expandedCards.has(shotList.id)}>
                    <Box sx={{ mb: 1.5, p: 1, bgcolor: 'rgba(0,0,0,0.2)', borderRadius: 1 }}>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontWeight: 600, mb: 1, display: 'block' }}>
                        Shots i denne listen:
                      </Typography>
                      {/* Status summary inside drilldown */}
                      {shotList.shots.length > 0 && (() => {
                        const counts: Record<ShotStatus, number> = { not_started: 0, in_progress: 0, completed: 0 };
                        shotList.shots.forEach(s => { const st: ShotStatus = s.status || 'not_started'; counts[st]++; });
                        return (
                          <Box sx={{ display: 'flex', gap: 0.75, mb: 1, flexWrap: 'wrap' }}>
                            {(['not_started', 'in_progress', 'completed'] as ShotStatus[]).map(st => counts[st] > 0 && (
                              <Chip
                                key={st}
                                label={`${statusConfig[st].label}: ${counts[st]}`}
                                size="small"
                                sx={{ bgcolor: statusConfig[st].bgColor, color: statusConfig[st].color, height: 20, fontSize: '0.68rem', fontWeight: 600, '& .MuiChip-label': { px: 1 } }}
                              />
                            ))}
                          </Box>
                        );
                      })()}
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(event) => handleDragEnd(event, shotList.id)}
                      >
                        <SortableContext
                          items={shotList.shots.map(s => s.id)}
                          strategy={verticalListSortingStrategy}
                        >
                      <Stack spacing={0.5}>
                        {shotList.shots.map((shot, shotIndex) => {
                          const mediaType = shot.mediaType || 'photo';
                          const priority = shot.priority || 'important';
                          const mediaInfo = mediaTypeConfig[mediaType];
                          const priorityInfo = priorityConfig[priority];
                          const recommendations = [
                            shot.lensRecommendation,
                            shot.lightingSetup,
                            shot.backgroundRecommendation,
                          ].filter(Boolean);
                          const inlineDraft = inlineEditDrafts[shot.id] || {};
                          return (
                            <Fragment key={shot.id}>
                              {shotIndex === 0 && (
                                <Box
                                  onClick={() => handleOpenShotDialog(shotList.id, undefined, 0)}
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    py: 0.5,
                                    cursor: 'pointer',
                                    opacity: 0.3,
                                    transition: 'opacity 0.2s',
                                    '&:hover': { opacity: 1 },
                                  }}
                                >
                                  <Box
                                    sx={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 0.5,
                                      color: '#00d4ff',
                                      fontSize: '11px',
                                    }}
                                  >
                                    <AddIcon sx={{ fontSize: 16 }} />
                                    <Typography variant="caption" sx={{ color: 'inherit' }}>
                                      Sett inn shot her
                                    </Typography>
                                  </Box>
                                </Box>
                              )}
                              <SortableShotItem id={shot.id}>
                              <Box 
                                sx={{ 
                                  display: 'flex', 
                                  flexDirection: 'column', 
                                  gap: 1,
                                  p: 1.5,
                                  bgcolor: 'rgba(255,255,255,0.03)',
                                  borderRadius: 2,
                                  border: '1px solid rgba(255,255,255,0.08)',
                                  transition: 'all 0.2s ease',
                                  '&:hover': {
                                    bgcolor: 'rgba(255,255,255,0.05)',
                                    borderColor: 'rgba(255,255,255,0.15)',
                                  },
                                  '&:hover .shot-actions': {
                                    opacity: 1,
                                  },
                                }}
                              >
                                {/* Main row: Shot number, type, description, and actions */}
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                  {/* Shot number badge */}
                                  <Box
                                    sx={{
                                      minWidth: 28,
                                      height: 28,
                                      borderRadius: '8px',
                                      bgcolor: getShotTypeColor(shot.shotType) + '22',
                                      border: `1px solid ${getShotTypeColor(shot.shotType)}44`,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      flexShrink: 0,
                                    }}
                                  >
                                    <Typography sx={{ color: getShotTypeColor(shot.shotType), fontSize: '0.75rem', fontWeight: 600 }}>
                                      {shotIndex + 1}
                                    </Typography>
                                  </Box>
                                  
                                  {/* Color tag indicator */}
                                  {shot.colorTag && (
                                    <Box
                                      sx={{
                                        width: 4,
                                        height: 28,
                                        borderRadius: 1,
                                        bgcolor: SHOT_COLOR_TAG_MAP[shot.colorTag] ?? '#9e9e9e',
                                        flexShrink: 0,
                                      }}
                                    />
                                  )}
                                  
                                  {/* Shot type chip */}
                                  <Chip
                                    icon={<PhotoCameraIcon sx={{ fontSize: '14px !important' }} />}
                                    label={getShotTypeLabel(shot.shotType)}
                                    size="small"
                                    sx={{
                                      bgcolor: getShotTypeColor(shot.shotType) + '22',
                                      color: getShotTypeColor(shot.shotType),
                                      height: 26,
                                      fontSize: '0.75rem',
                                      fontWeight: 500,
                                      border: `1px solid ${getShotTypeColor(shot.shotType)}44`,
                                      flexShrink: 0,
                                      '& .MuiChip-icon': { color: 'inherit' },
                                    }}
                                  />
                                  
                                  {/* Description input - takes remaining space */}
                                  <TextField
                                    size="small"
                                    placeholder="Legg til beskrivelse..."
                                    value={inlineDraft.description ?? shot.description ?? ''}
                                    onChange={(e) => handleInlineEditChange(shot.id, { description: e.target.value })}
                                    onBlur={() => handleInlineEditCommit(shotList, shot)}
                                    fullWidth
                                    sx={{
                                      flex: 1,
                                      '& .MuiOutlinedInput-root': {
                                        color: '#fff',
                                        bgcolor: 'rgba(0,0,0,0.2)',
                                        borderRadius: 1.5,
                                        '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                                        '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                                        '&.Mui-focused fieldset': { borderColor: '#00d4ff' },
                                      },
                                      '& .MuiInputBase-input': {
                                        fontSize: '0.8rem',
                                        py: 0.75,
                                        px: 1.5,
                                      },
                                    }}
                                  />
                                  
                                  {/* Action buttons - show on hover */}
                                  <Box 
                                    className="shot-actions"
                                    sx={{ 
                                      display: 'flex', 
                                      gap: 0.25, 
                                      alignItems: 'center',
                                      opacity: { xs: 1, md: 0.3 },
                                      transition: 'opacity 0.2s',
                                    }}
                                  >
                                    <Tooltip title={shot.reservedBy === user?.id ? 'Fjern reservasjon' : 'Reserver'}>
                                      <span>
                                        <IconButton
                                          size="small"
                                          onClick={() => handleReserveShot(shotList, shot)}
                                          disabled={Boolean(shot.reservedBy && shot.reservedBy !== user?.id)}
                                          sx={{ 
                                            p: 0.5, 
                                            color: shot.reservedBy === user?.id ? '#4caf50' : 'rgba(255,255,255,0.4)',
                                            '&:hover': { color: shot.reservedBy === user?.id ? '#66bb6a' : 'rgba(255,255,255,0.7)' },
                                          }}
                                        >
                                          {shot.reservedBy === user?.id ? <UnreserveIcon sx={{ fontSize: 16 }} /> : <ReserveIcon sx={{ fontSize: 16 }} />}
                                        </IconButton>
                                      </span>
                                    </Tooltip>
                                    <Tooltip title={`Neste status: ${getNextStatus(shot.status || 'not_started')}`}>
                                      <IconButton
                                        size="small"
                                        onClick={() => handleUpdateShotInline(shotList, shot.id, { status: getNextStatus(shot.status || 'not_started') })}
                                        sx={{ p: 0.5, color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#4caf50' } }}
                                        aria-label="Sett neste status"
                                      >
                                        <NextIcon sx={{ fontSize: 16 }} />
                                      </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Rediger">
                                      <IconButton
                                        size="small"
                                        onClick={() => handleOpenShotDialog(shotList.id, shot)}
                                        sx={{ p: 0.5, color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#00d4ff' } }}
                                      >
                                        <EditIcon sx={{ fontSize: 16 }} />
                                      </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Slett">
                                      <IconButton
                                        size="small"
                                        onClick={() => handleDeleteShot(shotList.id, shot.id)}
                                        sx={{ p: 0.5, color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#ff4444' } }}
                                      >
                                        <DeleteIcon sx={{ fontSize: 16 }} />
                                      </IconButton>
                                    </Tooltip>
                                  </Box>
                                </Box>
                                
                                {/* Bottom row: Status, priority, time, and metadata */}
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 5 }}>
                                  {/* Status dropdown */}
                                  <FormControl size="small">
                                    <Select
                                      value={shot.status || 'not_started'}
                                      onChange={(e) => handleUpdateShotInline(shotList, shot.id, { status: e.target.value as ShotStatus })}
                                      MenuProps={{ sx: { zIndex: Z_INDEX.selectMenu } }}
                                      sx={{
                                        color: statusConfig[shot.status || 'not_started'].color,
                                        height: 26,
                                        fontSize: '0.7rem',
                                        fontWeight: 500,
                                        bgcolor: statusConfig[shot.status || 'not_started'].bgColor,
                                        borderRadius: 1.5,
                                        minWidth: 90,
                                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' },
                                        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                                        '& .MuiSelect-select': { py: 0.5, px: 1 },
                                      }}
                                    >
                                      <MenuItem value="not_started">Venter</MenuItem>
                                      <MenuItem value="in_progress">Pågår</MenuItem>
                                      <MenuItem value="completed">Fullført</MenuItem>
                                    </Select>
                                  </FormControl>
                                  
                                  {/* Priority dropdown */}
                                  <FormControl size="small">
                                    <Select
                                      value={inlineDraft.priority ?? priority}
                                      onChange={(e) => handleInlineEditChange(shot.id, { priority: e.target.value as ShotPriority })}
                                      onBlur={() => handleInlineEditCommit(shotList, shot)}
                                      MenuProps={{ sx: { zIndex: Z_INDEX.selectMenu } }}
                                      sx={{
                                        color: priorityInfo.color,
                                        height: 26,
                                        fontSize: '0.7rem',
                                        fontWeight: 500,
                                        bgcolor: priorityInfo.bgColor,
                                        borderRadius: 1.5,
                                        minWidth: 80,
                                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' },
                                        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                                        '& .MuiSelect-select': { py: 0.5, px: 1 },
                                      }}
                                    >
                                      <MenuItem value="critical">Kritisk</MenuItem>
                                      <MenuItem value="important">Viktig</MenuItem>
                                      <MenuItem value="nice_to_have">Bonus</MenuItem>
                                    </Select>
                                  </FormControl>
                                  
                                  {/* Media type chip */}
                                  <Chip
                                    icon={mediaInfo.icon}
                                    label={mediaInfo.label}
                                    size="small"
                                    sx={{
                                      bgcolor: `${mediaInfo.color}15`,
                                      color: mediaInfo.color,
                                      height: 24,
                                      fontSize: '0.7rem',
                                      border: 'none',
                                      '& .MuiChip-icon': { color: 'inherit', fontSize: '14px !important' },
                                    }}
                                  />

                                  {/* Quick assign */}
                                  {crewMembers.length > 0 && (
                                    <Tooltip title={shot.assigneeId ? `Tilordnet: ${getAssigneeLabel(shot.assigneeId)}` : 'Tilordne'}>
                                      <FormControl size="small">
                                        <Select
                                          value={shot.assigneeId || ''}
                                          onChange={(e) => {
                                            const memberId = e.target.value;
                                            const name = crewMembers.find((m) => m.id === memberId)?.name || '';
                                            handleQuickAssign(shotList, shot, memberId, name);
                                          }}
                                          displayEmpty
                                          MenuProps={{ sx: { zIndex: Z_INDEX.selectMenu } }}
                                          renderValue={(val) => (
                                            <AssignIcon sx={{ fontSize: 14, color: val ? '#4caf50' : 'rgba(255,255,255,0.4)' }} />
                                          )}
                                          sx={{
                                            height: 26,
                                            minWidth: 36,
                                            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' },
                                            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                                            '& .MuiSelect-select': { py: 0.5, px: 0.75, display: 'flex', alignItems: 'center' },
                                            '& .MuiSelect-icon': { display: 'none' },
                                            bgcolor: shot.assigneeId ? 'rgba(76,175,80,0.1)' : 'transparent',
                                          }}
                                        >
                                          <MenuItem value="">
                                            <em>Ingen</em>
                                          </MenuItem>
                                          {crewMembers.map((member) => (
                                            <MenuItem key={member.id} value={member.id}>
                                              {member.name}
                                            </MenuItem>
                                          ))}
                                        </Select>
                                      </FormControl>
                                    </Tooltip>
                                  )}
                                  
                                  {/* Assignee name chip */}
                                  {shot.assigneeId && crewMembers.length > 0 && (
                                    <Chip
                                      label={getAssigneeLabel(shot.assigneeId)}
                                      size="small"
                                      onDelete={() => { handleQuickAssign(shotList, shot, '', ''); }}
                                      sx={{
                                        bgcolor: 'rgba(76,175,80,0.1)',
                                        color: '#4caf50',
                                        height: 22,
                                        fontSize: '0.65rem',
                                        maxWidth: 100,
                                        '& .MuiChip-deleteIcon': { fontSize: 13, color: '#4caf50', '&:hover': { color: '#81c784' } },
                                        '& .MuiChip-label': { px: 1 },
                                      }}
                                    />
                                  )}

                                  {/* Time estimate */}
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto' }}>
                                    <TimeIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }} />
                                    <TextField
                                      size="small"
                                      type="number"
                                      placeholder="0"
                                      value={inlineDraft.estimatedTime ?? shot.estimatedTime ?? ''}
                                      onChange={(e) => handleInlineEditChange(shot.id, { estimatedTime: e.target.value ? Number(e.target.value) : undefined })}
                                      onBlur={() => handleInlineEditCommit(shotList, shot)}
                                      sx={{
                                        width: 50,
                                        '& .MuiOutlinedInput-root': {
                                          color: '#fff',
                                          bgcolor: 'rgba(0,0,0,0.2)',
                                          borderRadius: 1,
                                          '& fieldset': { borderColor: 'transparent' },
                                          '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                                        },
                                        '& .MuiInputBase-input': { 
                                          fontSize: '0.7rem', 
                                          py: 0.5, 
                                          px: 0.75,
                                          textAlign: 'center',
                                        },
                                      }}
                                    />
                                    <Typography sx={{ color: 'rgba(255,255,255,0.87)', fontSize: '0.7rem' }}>
                                      min
                                    </Typography>
                                  </Box>
                                  
                                  {/* Reservation indicator */}
                                  {shot.reservedBy && shot.reservedBy !== user?.id && (
                                    <Chip
                                      icon={<ReserveIcon sx={{ fontSize: '12px !important' }} />}
                                      label={shot.reservedByName || 'Reservert'}
                                      size="small"
                                      sx={{
                                        bgcolor: 'rgba(147,51,234,0.15)',
                                        color: '#9333ea',
                                        height: 24,
                                        fontSize: '0.65rem',
                                        '& .MuiChip-icon': { color: 'inherit' },
                                      }}
                                    />
                                  )}
                                  
                                  {/* Comments indicator */}
                                  {shot.comments && shot.comments.length > 0 && (
                                    <Chip
                                      label={`${shot.comments.length}`}
                                      size="small"
                                      sx={{
                                        bgcolor: 'rgba(255,255,255,0.08)',
                                        color: 'rgba(255,255,255,0.87)',
                                        height: 24,
                                        fontSize: '0.65rem',
                                        minWidth: 24,
                                      }}
                                    />
                                  )}
                                </Box>
                                
                                {/* Recommendations row */}
                                {recommendations.length > 0 && (
                                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', pl: 5, fontSize: '0.7rem' }}>
                                    {recommendations.join(' • ')}
                                  </Typography>
                                )}
                                
                                {/* Storyboard image preview */}
                                {shot.imageUrl && (
                                  <Box
                                    sx={{
                                      mt: 0.5,
                                      ml: 5,
                                      borderRadius: 1.5,
                                      overflow: 'hidden',
                                      border: '1px solid rgba(255,255,255,0.1)',
                                      position: 'relative',
                                      maxWidth: 200,
                                    }}
                                  >
                                    <Box
                                      component="img"
                                      src={shot.imageUrl}
                                      alt={`Storyboard: ${shot.description || shot.shotType}`}
                                      sx={{
                                        width: '100%',
                                        height: 100,
                                        objectFit: 'cover',
                                        display: 'block',
                                      }}
                                    />
                                    <Tooltip title="Regenerer bilde">
                                      <span>
                                        <IconButton
                                          size="small"
                                          onClick={() => handleRegenerateSingleImage(shotList, shot, getPackTemplate(shotList.id))}
                                          disabled={regeneratingShotId === shot.id}
                                          sx={{
                                            position: 'absolute',
                                            top: 4,
                                            right: 4,
                                            bgcolor: 'rgba(0,0,0,0.7)',
                                            color: '#fff',
                                            p: 0.4,
                                            '&:hover': { bgcolor: 'rgba(0,0,0,0.9)' },
                                          }}
                                        >
                                        {regeneratingShotId === shot.id ? (
                                          <MUICircularProgress size={12} sx={{ color: '#fff' }} />
                                        ) : (
                                          <RefreshIcon sx={{ fontSize: 12 }} />
                                        )}
                                        </IconButton>
                                      </span>
                                    </Tooltip>
                                  </Box>
                                )}
                                
                                {/* Generate storyboard button */}
                                {!shot.imageUrl && shot.description && (
                                  <Box 
                                    sx={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      gap: 0.5, 
                                      pl: 5, 
                                      mt: 0.5,
                                      cursor: 'pointer',
                                      color: '#00d4ff',
                                      opacity: 0.7,
                                      transition: 'opacity 0.2s',
                                      '&:hover': { opacity: 1 },
                                    }}
                                    onClick={() => handleRegenerateSingleImage(shotList, shot, getPackTemplate(shotList.id))}
                                  >
                                    {regeneratingShotId === shot.id ? (
                                      <MUICircularProgress size={12} sx={{ color: '#00d4ff' }} />
                                    ) : (
                                      <AutoAwesomeIcon sx={{ fontSize: 14 }} />
                                    )}
                                    <Typography variant="caption" sx={{ color: 'inherit' }}>
                                      Generer bilde
                                    </Typography>
                                  </Box>
                                )}
                              </Box>
                              </SortableShotItem>
                              <Box
                                onClick={() => handleOpenShotDialog(shotList.id, undefined, shotIndex + 1)}
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  py: 0.5,
                                  cursor: 'pointer',
                                  opacity: 0.3,
                                  transition: 'opacity 0.2s',
                                  '&:hover': { opacity: 1 },
                                }}
                              >
                                <Box
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 0.5,
                                    color: '#00d4ff',
                                    fontSize: '11px',
                                  }}
                                >
                                  <AddIcon sx={{ fontSize: 16 }} />
                                  <Typography variant="caption" sx={{ color: 'inherit' }}>
                                    Sett inn shot her
                                  </Typography>
                                </Box>
                              </Box>
                            </Fragment>
                          );
                        })}
                      </Stack>
                        </SortableContext>
                      </DndContext>
                      <Box sx={{ mt: 1.5, p: 1, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 1, border: '1px dashed rgba(255,255,255,0.1)' }}>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontWeight: 600, mb: 1, display: 'block' }}>
                          Quick add
                        </Typography>
                        <Stack spacing={1}>
                          <TextField
                            placeholder="Beskrivelse (valgfritt)"
                            value={quickShotDrafts[shotList.id]?.description || ''}
                            onChange={(e) => handleQuickShotChange(shotList.id, { description: e.target.value })}
                            size="small"
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                color: '#fff',
                                '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                              },
                            }}
                          />
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <FormControl size="small" sx={{ flex: 1 }}>
                              <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Shot type</InputLabel>
                              <Select
                                value={quickShotDrafts[shotList.id]?.shotType || 'Medium'}
                                onChange={(e) => handleQuickShotChange(shotList.id, { shotType: e.target.value as ShotType })}
                                label="Shot type"
                                MenuProps={{ sx: { zIndex: Z_INDEX.selectMenu } }}
                                sx={{
                                  color: '#fff',
                                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                                }}
                              >
                                {shotTypes.map((type) => (
                                  <MenuItem key={type} value={type}>{getShotTypeLabel(type)}</MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                            <TextField
                              label="Min"
                              type="number"
                              size="small"
                              value={quickShotDrafts[shotList.id]?.estimatedTime ?? getShotPreset(shotList).estimatedTime}
                              onChange={(e) => handleQuickShotChange(shotList.id, { estimatedTime: e.target.value ? Number(e.target.value) : undefined })}
                              sx={{
                                width: 90,
                                '& .MuiOutlinedInput-root': {
                                  color: '#fff',
                                  '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                                },
                                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                              }}
                            />
                          </Box>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                              size="small"
                              startIcon={<AddIcon />}
                              onClick={() => handleQuickAddShot(shotList)}
                              sx={{ color: '#00d4ff', fontSize: '11px', borderColor: 'rgba(0,212,255,0.4)' }}
                              variant="outlined"
                            >
                              Legg til shot
                            </Button>
                            <Button
                              size="small"
                              onClick={() => handleOpenShotDialog(shotList.id)}
                              sx={{ color: '#e91e63', fontSize: '11px' }}
                            >
                              Avansert
                            </Button>
                          </Box>
                        </Stack>
                      </Box>
                    </Box>
                  </Collapse>

                  {/* Next up shots - shown when card is collapsed */}
                  {!expandedCards.has(shotList.id) && getNextUpShots(shotList).length > 0 && (
                    <Box
                      sx={{
                        mb: 1.5,
                        p: 1,
                        bgcolor: 'rgba(233,30,99,0.05)',
                        borderRadius: 1.5,
                        border: '1px solid rgba(233,30,99,0.15)',
                      }}
                    >
                      <Typography variant="caption" sx={{ color: '#e91e63', fontWeight: 600, mb: 0.5, display: 'block' }}>
                        Neste opp:
                      </Typography>
                      <Stack spacing={0.5}>
                        {getNextUpShots(shotList).map((s) => (
                          <Box key={s.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <Box
                              sx={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                flexShrink: 0,
                                bgcolor: priorityConfig[s.priority || 'important'].color,
                              }}
                            />
                            <Typography
                              variant="caption"
                              sx={{
                                color: 'rgba(255,255,255,0.87)',
                                fontSize: '0.7rem',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {s.description || getShotTypeLabel(s.shotType)}
                            </Typography>
                          </Box>
                        ))}
                      </Stack>
                    </Box>
                  )}

                  {/* Notes preview - matching ProductionDayView style with animated icon */}
                  {shotList.notes && !expandedCards.has(shotList.id) && (
                    <Box
                      sx={{
                        mb: 1,
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: 'rgba(255,184,0,0.08)',
                        border: '2px solid rgba(255,184,0,0.25)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 1.5,
                        position: 'relative',
                        overflow: 'hidden',
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '4px',
                          height: '100%',
                          bgcolor: '#ffb800',
                          borderRadius: '2px 0 0 2px',
                        },
                        '@keyframes writing': {
                          '0%, 100%': { transform: 'rotate(-5deg) translateY(0px)' },
                          '25%': { transform: 'rotate(0deg) translateY(-1px)' },
                          '50%': { transform: 'rotate(5deg) translateY(0px)' },
                          '75%': { transform: 'rotate(0deg) translateY(1px)' },
                        },
                      }}
                    >
                      <Box
                        sx={{
                          width: 28,
                          height: 28,
                          borderRadius: 1.5,
                          bgcolor: 'rgba(255,184,0,0.2)',
                          border: '1px solid rgba(255,184,0,0.4)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <NoteIcon
                          sx={{
                            color: '#ffb800',
                            fontSize: 16,
                            animation: 'writing 2.5s ease-in-out infinite',
                            filter: 'drop-shadow(0 1px 2px rgba(255,184,0,0.3))',
                          }}
                        />
                      </Box>
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'rgba(255,255,255,0.8)',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          lineHeight: 1.6,
                          fontSize: '0.8rem',
                        }}
                      >
                        {shotList.notes}
                      </Typography>
                    </Box>
                  )}

                  {/* Toggle shots visibility - only when there are shots */}
                  {shotList.shots.length > 0 && (
                    <Button
                      size="small"
                      fullWidth
                      onClick={() => toggleCardExpanded(shotList.id)}
                      endIcon={expandedCards.has(shotList.id) ? <CollapseIcon /> : <ExpandIcon />}
                      sx={{ 
                        color: 'rgba(255,255,255,0.87)', 
                        fontSize: '12px', 
                        minHeight: 36, 
                        justifyContent: 'center',
                        bgcolor: 'rgba(255,255,255,0.03)',
                        borderRadius: 1,
                        mt: 1,
                        ...focusVisibleStyles 
                      }}
                    >
                      {expandedCards.has(shotList.id) ? 'Skjul shots' : `Vis ${shotList.shots.length} shots`}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Undo Delete Snackbar */}
      <Snackbar
        open={undoSnackbarOpen}
        autoHideDuration={6000}
        onClose={() => setUndoSnackbarOpen(false)}
        message="Shot list slettet"
        action={
          <Button color="secondary" size="small" onClick={handleUndoDelete} sx={{ color: '#e91e63' }}>
            Angre
          </Button>
        }
        sx={{ '& .MuiSnackbarContent-root': { bgcolor: '#333' } }}
      />

      {/* Shot List Dialog - Responsive */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        fullScreen={isMobile}
        maxWidth="sm"
        fullWidth
        aria-labelledby={dialogTitleId}
        aria-describedby={dialogDescId}
        TransitionComponent={Grow}
        TransitionProps={{
          timeout: { enter: 225, exit: 150 },
          enter: true,
          exit: true,
        }}
        slotProps={{
          paper: {
            sx: {
              bgcolor: '#1a1a2e',
              color: '#fff',
              borderRadius: isMobile ? 0 : 2,
              willChange: 'transform, opacity',
              transformOrigin: 'center center',
            },
          },
        }}
        sx={{
          '& .MuiBackdrop-root': {
            willChange: 'opacity',
          },
        }}
      >
        <DialogTitle id={dialogTitleId} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" component="span">
            {editingShotList ? 'Rediger shot list' : 'Opprett shot list'}
          </Typography>
          {isMobile && (
            <IconButton onClick={handleCloseDialog} sx={{ color: 'rgba(255,255,255,0.87)' }}>
              <CloseIcon />
            </IconButton>
          )}
        </DialogTitle>
        <DialogContent id={dialogDescId}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {availableScenes.length > 0 ? (
              <FormControl fullWidth>
                <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Scene (fra Scene Composer)</InputLabel>
                <Select
                  value={formData.sceneId || ''}
                  onChange={(e) => setFormData({ ...formData, sceneId: e.target.value, sceneName: '' })}
                  label="Scene (fra Scene Composer)"
                  sx={{
                    color: '#fff',
                    minHeight: TOUCH_TARGET_SIZE,
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#e91e63' },
                  }}
                >
                  <MenuItem value="">
                    <em>Ingen scene (bruk manuelt navn)</em>
                  </MenuItem>
                  {availableScenes.map((scene) => (
                    <MenuItem key={scene.id} value={scene.id}>
                      {scene.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : null}
            
            {(!formData.sceneId || availableScenes.length === 0) && (
              <TextField
                fullWidth
                label="Scenenavn"
                value={formData.sceneName || ''}
                onChange={(e) => setFormData({ ...formData, sceneName: e.target.value })}
                placeholder="F.eks. Åpningsscene, Interiør kjøkken..."
                helperText={availableScenes.length === 0 ? "Skriv inn et navn for scenen manuelt" : "Brukes når ingen scene er valgt fra Scene Composer"}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    minHeight: TOUCH_TARGET_SIZE,
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
                    '&.Mui-focused fieldset': { borderColor: '#e91e63' },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                  '& .MuiFormHelperText-root': { color: 'rgba(255,255,255,0.87)' },
                }}
              />
            )}

            <FormControl fullWidth>
              <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Produksjonskontekst</InputLabel>
              <Select
                value={formData.productionContext || 'custom'}
                onChange={(e) => setFormData({ ...formData, productionContext: e.target.value as ProductionContext })}
                label="Produksjonskontekst"
                sx={{
                  color: '#fff',
                  minHeight: TOUCH_TARGET_SIZE,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#e91e63' },
                }}
              >
                {Object.values(PRODUCTION_PRESETS).map((preset) => (
                  <MenuItem key={preset.id} value={preset.id}>
                    {preset.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Notes field - matching ProductionDayView style with animated icon */}
            <Box>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  mb: 1,
                  bgcolor: 'rgba(255,184,0,0.15)',
                  p: 1.5,
                  borderRadius: '8px',
                  border: '2px solid rgba(255,184,0,0.3)',
                  '@keyframes writing': {
                    '0%, 100%': { transform: 'rotate(-5deg) translateY(0px)' },
                    '25%': { transform: 'rotate(0deg) translateY(-2px)' },
                    '50%': { transform: 'rotate(5deg) translateY(0px)' },
                    '75%': { transform: 'rotate(0deg) translateY(2px)' },
                  },
                }}
              >
                <Box
                  sx={{
                    width: isMobile ? 32 : 36,
                    height: isMobile ? 32 : 36,
                    borderRadius: 2,
                    bgcolor: 'rgba(255,184,0,0.2)',
                    border: '2px solid rgba(255,184,0,0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <NoteIcon
                    sx={{
                      color: '#ffb800',
                      fontSize: isMobile ? '1.125rem' : '1.25rem',
                      animation: 'writing 2.5s ease-in-out infinite',
                      filter: 'drop-shadow(0 2px 4px rgba(255,184,0,0.3))',
                    }}
                  />
                </Box>
                <Typography sx={{ color: '#ffb800', fontWeight: 700, fontSize: isMobile ? '0.875rem' : '1rem' }}>
                  Notater
                </Typography>
              </Box>
              <RichTextEditor
                value={formData.notes || ''}
                onChange={(value) => setFormData({ ...formData, notes: value })}
                placeholder="Skriv notater her..."
                minHeight={120}
                accentColor="#ffb800"
              />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={handleCloseDialog}
            sx={{ color: 'rgba(255,255,255,0.87)', minHeight: TOUCH_TARGET_SIZE, ...focusVisibleStyles }}
          >
            Avbryt
          </Button>
          <Button
            onClick={handleSaveShotList}
            variant="contained"
            sx={{ bgcolor: '#e91e63', minHeight: TOUCH_TARGET_SIZE, ...focusVisibleStyles, '&:hover': { bgcolor: '#c2185b' } }}
          >
            {editingShotList ? 'Lagre' : 'Opprett'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Shot Dialog - Responsive */}
      <Dialog
        open={shotDialogOpen}
        onClose={handleCloseShotDialog}
        fullScreen={isMobile}
        maxWidth="sm"
        fullWidth
        aria-labelledby={shotDialogTitleId}
        slotProps={{
          paper: {
            sx: {
              bgcolor: '#1a1a2e',
              color: '#fff',
              borderRadius: isMobile ? 0 : 2,
            },
          },
        }}
      >
        <DialogTitle id={shotDialogTitleId} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" component="span">
            {editingShot ? 'Rediger shot' : 'Legg til shot'}
          </Typography>
          {isMobile && (
            <IconButton onClick={handleCloseShotDialog} sx={{ color: 'rgba(255,255,255,0.87)' }}>
              <CloseIcon />
            </IconButton>
          )}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <Box
              sx={{
                p: isMobile ? 1.25 : 1.75,
                borderRadius: 2,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'linear-gradient(135deg, rgba(233,30,99,0.08), rgba(0,212,255,0.08))',
                boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 700 }}>
                  Visuell shot-brief
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                  Overblikk før du dykker ned i detaljer
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', rowGap: 1 }}>
                <Chip
                  label={`Scene: ${sceneLabel}`}
                  icon={<MovieIcon sx={{ fontSize: 16 }} />}
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.1)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.18)',
                    height: 30,
                  }}
                />
                <Chip
                  label={selectedMediaInfo.label}
                  icon={selectedMediaInfo.icon}
                  sx={{
                    bgcolor: `${selectedMediaInfo.color}22`,
                    color: selectedMediaInfo.color,
                    border: `1px solid ${selectedMediaInfo.color}44`,
                    height: 30,
                  }}
                />
                <Chip
                  label={`Prioritet: ${selectedPriorityInfo.label}`}
                  sx={{
                    bgcolor: selectedPriorityInfo.bgColor,
                    color: selectedPriorityInfo.color,
                    border: `1px solid ${selectedPriorityInfo.color}44`,
                    height: 30,
                  }}
                />
                <Chip
                  label={`Estimat: ${estimatedMinutes} min`}
                  icon={<ScheduleIcon sx={{ fontSize: 16 }} />}
                  sx={{
                    bgcolor: 'rgba(0,212,255,0.12)',
                    color: '#00d4ff',
                    border: '1px solid rgba(0,212,255,0.35)',
                    height: 30,
                  }}
                />
              </Stack>
            </Box>
            <Box
              sx={{
                p: isMobile ? 1.5 : 2,
                borderRadius: 2,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'linear-gradient(135deg, rgba(233,30,99,0.07), rgba(0,212,255,0.04))',
                boxShadow: '0 10px 40px rgba(0,0,0,0.25)',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 700 }}>
                  Kjerneinfo
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                  Start med de viktigste valgene
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                {shotTypes.map((type) => (
                  <Chip
                    key={type}
                    label={getShotTypeLabel(type)}
                    onClick={() => setShotFormData({ ...shotFormData, shotType: type })}
                    clickable
                    sx={{
                      bgcolor: shotFormData.shotType === type ? `${getShotTypeColor(type)}33` : 'transparent',
                      color: shotFormData.shotType === type ? '#fff' : 'rgba(255,255,255,0.7)',
                      border: `1px solid ${getShotTypeColor(type)}66`,
                      height: 30,
                      fontWeight: 600,
                      fontSize: '0.75rem',
                    }}
                  />
                ))}
              </Box>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControl fullWidth>
                    <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Shot type</InputLabel>
                    <Select
                      value={shotFormData.shotType || 'Medium'}
                      onChange={(e) => setShotFormData({ ...shotFormData, shotType: e.target.value as ShotType })}
                      label="Shot type"
                      sx={{
                        color: '#fff',
                        minHeight: TOUCH_TARGET_SIZE,
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#e91e63' },
                      }}
                    >
                      {shotTypes.map((type) => (
                        <MenuItem key={type} value={type}>
                          {getShotTypeLabel(type)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControl fullWidth>
                    <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Media</InputLabel>
                    <Select
                      value={shotFormData.mediaType || defaultMediaType}
                      onChange={(e) => setShotFormData({ ...shotFormData, mediaType: e.target.value as MediaType })}
                      label="Media"
                      sx={{
                        color: '#fff',
                        minHeight: TOUCH_TARGET_SIZE,
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#e91e63' },
                      }}
                    >
                      <MenuItem value="photo">Foto</MenuItem>
                      <MenuItem value="video">Video</MenuItem>
                      <MenuItem value="hybrid">Hybrid</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControl fullWidth>
                    <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Kameravinkel</InputLabel>
                    <Select
                      value={shotFormData.cameraAngle || 'Eye Level'}
                      onChange={(e) => setShotFormData({ ...shotFormData, cameraAngle: e.target.value as CameraAngle })}
                      label="Kameravinkel"
                      sx={{
                        color: '#fff',
                        minHeight: TOUCH_TARGET_SIZE,
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#e91e63' },
                      }}
                    >
                      {cameraAngles.map((angle) => (
                        <MenuItem key={angle} value={angle}>{angle}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControl fullWidth>
                    <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Kamerabevegelse</InputLabel>
                    <Select
                      value={shotFormData.cameraMovement || 'Static'}
                      onChange={(e) => setShotFormData({ ...shotFormData, cameraMovement: e.target.value as CameraMovement })}
                      label="Kamerabevegelse"
                      sx={{
                        color: '#fff',
                        minHeight: TOUCH_TARGET_SIZE,
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#e91e63' },
                      }}
                    >
                      {cameraMovements.map((movement) => (
                        <MenuItem key={movement} value={movement}>{movement}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControl fullWidth>
                    <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Prioritet</InputLabel>
                    <Select
                      value={shotFormData.priority || 'important'}
                      onChange={(e) => setShotFormData({ ...shotFormData, priority: e.target.value as ShotPriority })}
                      label="Prioritet"
                      sx={{
                        color: '#fff',
                        minHeight: TOUCH_TARGET_SIZE,
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#e91e63' },
                      }}
                    >
                      <MenuItem value="critical">Kritisk</MenuItem>
                      <MenuItem value="important">Viktig</MenuItem>
                      <MenuItem value="nice_to_have">Bonus</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Estimert tid (min)"
                    type="number"
                    value={shotFormData.estimatedTime || ''}
                    onChange={(e) => setShotFormData({ ...shotFormData, estimatedTime: e.target.value ? Number(e.target.value) : undefined })}
                    fullWidth
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        color: '#fff',
                        minHeight: TOUCH_TARGET_SIZE,
                        '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                        '&.Mui-focused fieldset': { borderColor: '#e91e63' },
                      },
                      '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                    }}
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', mb: 1, display: 'block' }}>
                    Fargekode
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    {[
                      { value: undefined, label: 'Ingen', color: 'rgba(255,255,255,0.2)' },
                      { value: 'red', label: 'Rød', color: '#f44336' },
                      { value: 'orange', label: 'Oransje', color: '#9333ea' },
                      { value: 'yellow', label: 'Gul', color: '#ffeb3b' },
                      { value: 'green', label: 'Grønn', color: '#4caf50' },
                      { value: 'blue', label: 'Blå', color: '#2196f3' },
                      { value: 'purple', label: 'Lilla', color: '#9c27b0' },
                      { value: 'gray', label: 'Grå', color: '#9e9e9e' },
                    ].map((tag) => (
                      <Tooltip key={tag.label} title={tag.label}>
                        <Box
                          onClick={() => setShotFormData({ ...shotFormData, colorTag: tag.value as CastingShot['colorTag'] })}
                          sx={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            bgcolor: tag.color,
                            cursor: 'pointer',
                            border: shotFormData.colorTag === tag.value || (!shotFormData.colorTag && !tag.value) 
                              ? '3px solid #fff' 
                              : '2px solid rgba(255,255,255,0.3)',
                            transition: 'all 0.2s',
                            '&:hover': {
                              transform: 'scale(1.1)',
                              boxShadow: `0 0 8px ${tag.color}`,
                            },
                          }}
                        />
                      </Tooltip>
                    ))}
                  </Stack>
                </Grid>
              </Grid>
            </Box>

            <Box
              sx={{
                p: isMobile ? 1.5 : 2,
                borderRadius: 2,
                border: '1px solid rgba(255,255,255,0.08)',
                bgcolor: 'rgba(255,255,255,0.02)',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 700 }}>
                  Scene og ansvar
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                  Knytt shot-et til riktig kontekst og person
                </Typography>
              </Box>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <FormControl fullWidth>
                    <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Scene</InputLabel>
                    <Select
                      value={shotFormData.sceneId || ''}
                      onChange={(e) => setShotFormData({ ...shotFormData, sceneId: e.target.value })}
                      label="Scene"
                      sx={{
                        color: '#fff',
                        minHeight: TOUCH_TARGET_SIZE,
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#e91e63' },
                      }}
                    >
                      {availableScenes.map((scene) => (
                        <MenuItem key={scene.id} value={scene.id}>{scene.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <FormControl fullWidth>
                    <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Rolle</InputLabel>
                    <Select
                      value={shotFormData.roleId || ''}
                      onChange={(e) => setShotFormData({ ...shotFormData, roleId: e.target.value })}
                      label="Rolle"
                      sx={{
                        color: '#fff',
                        minHeight: TOUCH_TARGET_SIZE,
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#e91e63' },
                      }}
                    >
                      {roles.map((role) => (
                        <MenuItem key={role.id} value={role.id}>{role.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <FormControl fullWidth>
                    <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Ansvarlig</InputLabel>
                    <Select
                      value={shotFormData.assigneeId || ''}
                      onChange={(e) => setShotFormData({ ...shotFormData, assigneeId: e.target.value })}
                      label="Ansvarlig"
                      sx={{
                        color: '#fff',
                        minHeight: TOUCH_TARGET_SIZE,
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#e91e63' },
                      }}
                    >
                      <MenuItem value="">
                        <em>Ingen valgt</em>
                      </MenuItem>
                      {user && (
                        <MenuItem value={user.id}>
                          {user.name} ({getUserRoleLabel(currentUserRole)}) {user.email ? `• ${user.email}` : ''}
                        </MenuItem>
                      )}
                      {crewMembers.map((member) => (
                        <MenuItem key={member.id} value={member.id}>
                          {member.name} ({member.role}) {member.contactInfo?.email ? `• ${member.contactInfo.email}` : ''}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 0.5 }}>
              <Button
                size="small"
                startIcon={showAdvancedCamera ? <CollapseIcon /> : <ExpandIcon />}
                onClick={() => setShowAdvancedCamera(!showAdvancedCamera)}
                sx={{ color: '#00d4ff', minHeight: TOUCH_TARGET_SIZE, ...focusVisibleStyles }}
              >
                {showAdvancedCamera ? 'Skjul teknisk blokk' : 'Vis teknisk blokk'}
              </Button>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)' }}>
                Forenkle dialogen ved å åpne kun når du trenger detaljer
              </Typography>
            </Box>

            <Collapse in={showAdvancedCamera}>
              <Box
                sx={{
                  p: isMobile ? 1.5 : 2,
                  borderRadius: 2,
                  border: '1px solid rgba(255,255,255,0.08)',
                  bgcolor: 'rgba(255,255,255,0.02)',
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 700 }}>
                    Teknisk oppsett
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                    Tilpasset {profession === 'photographer' ? 'foto' : profession === 'videographer' ? 'video' : 'shot'}-profilen din
                  </Typography>
                </Box>
                <Grid container spacing={2}>
                  {profession === 'photographer' ? (
                    <>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          label="Brennvidde (mm)"
                          type="number"
                          value={shotFormData.focalLength || ''}
                          onChange={(e) => setShotFormData({ ...shotFormData, focalLength: e.target.value ? Number(e.target.value) : undefined })}
                          fullWidth
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              color: '#fff',
                              minHeight: TOUCH_TARGET_SIZE,
                              '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                              '&.Mui-focused fieldset': { borderColor: '#e91e63' },
                            },
                            '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                          }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          label="Blenderåpning (f/)"
                          type="number"
                          value={shotFormData.aperture || ''}
                          onChange={(e) => setShotFormData({ ...shotFormData, aperture: e.target.value ? Number(e.target.value) : undefined })}
                          fullWidth
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              color: '#fff',
                              minHeight: TOUCH_TARGET_SIZE,
                              '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                              '&.Mui-focused fieldset': { borderColor: '#e91e63' },
                            },
                            '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                          }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          label="Lukkerhastighet (1/s)"
                          type="number"
                          value={shotFormData.shutter || ''}
                          onChange={(e) => setShotFormData({ ...shotFormData, shutter: e.target.value ? Number(e.target.value) : undefined })}
                          fullWidth
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              color: '#fff',
                              minHeight: TOUCH_TARGET_SIZE,
                              '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                              '&.Mui-focused fieldset': { borderColor: '#e91e63' },
                            },
                            '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                          }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          label="ISO"
                          type="number"
                          value={shotFormData.iso || ''}
                          onChange={(e) => setShotFormData({ ...shotFormData, iso: e.target.value ? Number(e.target.value) : undefined })}
                          fullWidth
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              color: '#fff',
                              minHeight: TOUCH_TARGET_SIZE,
                              '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                              '&.Mui-focused fieldset': { borderColor: '#e91e63' },
                            },
                            '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                          }}
                        />
                      </Grid>
                    </>
                  ) : profession === 'videographer' ? (
                    <>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          label="FPS"
                          type="number"
                          value={shotFormData.fps || ''}
                          onChange={(e) => setShotFormData({ ...shotFormData, fps: e.target.value ? Number(e.target.value) : undefined })}
                          fullWidth
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              color: '#fff',
                              minHeight: TOUCH_TARGET_SIZE,
                              '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                              '&.Mui-focused fieldset': { borderColor: '#e91e63' },
                            },
                            '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                          }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          label="Oppløsning"
                          value={shotFormData.resolution || ''}
                          onChange={(e) => setShotFormData({ ...shotFormData, resolution: e.target.value })}
                          placeholder="1920x1080"
                          fullWidth
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              color: '#fff',
                              minHeight: TOUCH_TARGET_SIZE,
                              '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                              '&.Mui-focused fieldset': { borderColor: '#e91e63' },
                            },
                            '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                          }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          label="Codec"
                          value={shotFormData.codec || ''}
                          onChange={(e) => setShotFormData({ ...shotFormData, codec: e.target.value })}
                          placeholder="H.264, ProRes, etc."
                          fullWidth
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              color: '#fff',
                              minHeight: TOUCH_TARGET_SIZE,
                              '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                              '&.Mui-focused fieldset': { borderColor: '#e91e63' },
                            },
                            '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                          }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          label="Lydkanaler"
                          type="number"
                          value={shotFormData.audioChannels || ''}
                          onChange={(e) => setShotFormData({ ...shotFormData, audioChannels: e.target.value ? Number(e.target.value) : undefined })}
                          fullWidth
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              color: '#fff',
                              minHeight: TOUCH_TARGET_SIZE,
                              '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                              '&.Mui-focused fieldset': { borderColor: '#e91e63' },
                            },
                            '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                          }}
                        />
                      </Grid>
                    </>
                  ) : (
                    <>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          label="Brennvidde (mm)"
                          type="number"
                          value={shotFormData.focalLength || ''}
                          onChange={(e) => setShotFormData({ ...shotFormData, focalLength: e.target.value ? Number(e.target.value) : undefined })}
                          fullWidth
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              color: '#fff',
                              minHeight: TOUCH_TARGET_SIZE,
                              '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                              '&.Mui-focused fieldset': { borderColor: '#e91e63' },
                            },
                            '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                          }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          label="Varighet (sek)"
                          type="number"
                          value={shotFormData.duration || ''}
                          onChange={(e) => setShotFormData({ ...shotFormData, duration: e.target.value ? Number(e.target.value) : undefined })}
                          fullWidth
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              color: '#fff',
                              minHeight: TOUCH_TARGET_SIZE,
                              '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                              '&.Mui-focused fieldset': { borderColor: '#e91e63' },
                            },
                            '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                          }}
                        />
                      </Grid>
                    </>
                  )}
                </Grid>
              </Box>
            </Collapse>

            <Box
              sx={{
                p: isMobile ? 1.5 : 2,
                borderRadius: 2,
                border: '1px solid rgba(255,255,255,0.08)',
                bgcolor: 'rgba(255,255,255,0.02)',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 700 }}>
                  Beskrivelse og notater
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                  Gi teamet rask kontekst
                </Typography>
              </Box>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    label="Beskrivelse"
                    value={shotFormData.description || ''}
                    onChange={(e) => setShotFormData({ ...shotFormData, description: e.target.value })}
                    multiline
                    rows={2}
                    fullWidth
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        color: '#fff',
                        '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                        '&.Mui-focused fieldset': { borderColor: '#e91e63' },
                      },
                      '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                    }}
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    label="Notater"
                    value={shotFormData.notes || ''}
                    onChange={(e) => setShotFormData({ ...shotFormData, notes: e.target.value })}
                    multiline
                    rows={2}
                    fullWidth
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        color: '#fff',
                        '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                        '&.Mui-focused fieldset': { borderColor: '#e91e63' },
                      },
                      '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                    }}
                  />
                </Grid>
              </Grid>
            </Box>

            <Box
              sx={{
                p: isMobile ? 1.5 : 2,
                borderRadius: 2,
                border: '1px solid rgba(255,255,255,0.08)',
                bgcolor: 'rgba(255,255,255,0.02)',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 700 }}>
                  Anbefalinger
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                  Presets fra produksjon eller egne valg
                </Typography>
              </Box>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    label="Objektiv-anbefaling"
                    value={shotFormData.lensRecommendation || ''}
                    onChange={(e) => setShotFormData({ ...shotFormData, lensRecommendation: e.target.value })}
                    fullWidth
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        color: '#fff',
                        '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                        '&.Mui-focused fieldset': { borderColor: '#e91e63' },
                      },
                      '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                    }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    label="Lys-anbefaling"
                    value={shotFormData.lightingSetup || ''}
                    onChange={(e) => setShotFormData({ ...shotFormData, lightingSetup: e.target.value })}
                    fullWidth
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        color: '#fff',
                        '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                        '&.Mui-focused fieldset': { borderColor: '#e91e63' },
                      },
                      '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                    }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    label="Bakgrunn-anbefaling"
                    value={shotFormData.backgroundRecommendation || ''}
                    onChange={(e) => setShotFormData({ ...shotFormData, backgroundRecommendation: e.target.value })}
                    fullWidth
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        color: '#fff',
                        '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                        '&.Mui-focused fieldset': { borderColor: '#e91e63' },
                      },
                      '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                    }}
                  />
                </Grid>
              </Grid>
            </Box>

            <Box
              sx={{
                p: isMobile ? 1.5 : 2,
                borderRadius: 2,
                border: '1px solid rgba(255,255,255,0.08)',
                bgcolor: 'rgba(255,255,255,0.02)',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 700 }}>
                  Team-samtale
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                  Historikk med hvem, rolle og klokkeslett
                </Typography>
              </Box>
              <Stack spacing={1.5} sx={{ mb: 1 }}>
                {(shotFormData.comments || []).length === 0 ? (
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                    Ingen kommentarer ennå
                  </Typography>
                ) : (
                  (shotFormData.comments || []).map((comment) => (
                    <Box
                      key={comment.id}
                      sx={{
                        p: 1.25,
                        borderRadius: 1.5,
                        bgcolor: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        opacity: comment.resolved ? 0.6 : 1,
                      }}
                    >
                      {(() => {
                        const profile = getProfileById(comment.authorId);
                        const displayName = comment.authorName || profile?.name || 'Team';
                        const displayEmail = comment.authorEmail || profile?.email;
                        const displayAvatar = comment.authorAvatar || profile?.avatar;
                        const displayRole = comment.authorRole
                          ? formatRoleLabel(comment.authorRole)
                          : comment.authorId === user?.id
                            ? formatRoleLabel(currentUserRole)
                            : profile?.name
                              ? formatRoleLabel(crewMembers.find((member) => member.id === comment.authorId)?.role)
                              : null;
                        return (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <Box
                              sx={{
                                width: 30,
                                height: 30,
                                borderRadius: '50%',
                                bgcolor: 'rgba(0,212,255,0.2)',
                                border: '1px solid rgba(0,212,255,0.4)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden',
                                flexShrink: 0,
                              }}
                            >
                              {displayAvatar ? (
                                <Box
                                  component="img"
                                  src={displayAvatar}
                                  alt={displayName}
                                  sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                              ) : (
                                <Typography variant="caption" sx={{ color: '#00d4ff', fontWeight: 700 }}>
                                  {getInitials(displayName)}
                                </Typography>
                              )}
                            </Box>
                            <Box>
                              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)', fontWeight: 700 }}>
                                {displayName}
                                {displayRole ? ` • ${displayRole}` : ''}
                              </Typography>
                              {displayEmail && (
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)', display: 'block' }}>
                                  {displayEmail}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        );
                      })()}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                          {new Date(comment.createdAt).toLocaleDateString('nb-NO')} •{' '}
                          {new Date(comment.createdAt).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}
                          {comment.updatedAt ? ' (redigert)' : ''}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <IconButton
                            size="small"
                            onClick={() => handleToggleCommentResolved(comment.id)}
                            sx={{ color: comment.resolved ? '#4caf50' : 'rgba(255,255,255,0.6)' }}
                          >
                            {comment.resolved ? <ResolvedIcon fontSize="small" /> : <UnresolvedIcon fontSize="small" />}
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleStartEditComment(comment)}
                            sx={{ color: 'rgba(255,255,255,0.87)' }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteComment(comment.id)}
                            sx={{ color: '#ff4444' }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </Box>
                      {editingCommentId === comment.id ? (
                        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                          <TextField
                            value={editingCommentDraft}
                            onChange={(e) => setEditingCommentDraft(e.target.value)}
                            fullWidth
                            size="small"
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                color: '#fff',
                                '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                                '&.Mui-focused fieldset': { borderColor: '#e91e63' },
                              },
                            }}
                          />
                          <IconButton
                            size="small"
                            onClick={handleSaveEditedComment}
                            disabled={!editingCommentDraft.trim()}
                            sx={{ color: '#4caf50' }}
                          >
                            <CheckIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => {
                              setEditingCommentId(null);
                              setEditingCommentDraft('');
                            }}
                            sx={{ color: 'rgba(255,255,255,0.87)' }}
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      ) : (
                        <Typography
                          variant="body2"
                          sx={{
                            color: '#fff',
                            textDecoration: comment.resolved ? 'line-through' : 'none',
                          }}
                        >
                          {getCommentText(comment)}
                        </Typography>
                      )}
                    </Box>
                  ))
                )}
              </Stack>
              <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 1 }}>
                <TextField
                  label="Ny kommentar"
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  fullWidth
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: '#fff',
                      '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                      '&.Mui-focused fieldset': { borderColor: '#e91e63' },
                    },
                    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                  }}
                />
                <Button
                  variant="outlined"
                  onClick={handleAddComment}
                  disabled={!commentDraft.trim()}
                  sx={{
                    minWidth: isMobile ? '100%' : 120,
                    borderColor: 'rgba(255,255,255,0.3)',
                    color: '#fff',
                    '&:hover': { borderColor: '#e91e63', bgcolor: 'rgba(233,30,99,0.1)' },
                  }}
                >
                  Legg til
                </Button>
              </Box>
            </Box>

            <Box
              sx={{
                p: isMobile ? 1.5 : 2,
                borderRadius: 2,
                border: '1px solid rgba(255,255,255,0.08)',
                bgcolor: 'rgba(255,255,255,0.02)',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 700 }}>
                  Visuell referanse
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                  Generer storyboard-bilde basert på beskrivelse
                </Typography>
              </Box>

              {shotFormData.imageUrl && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', mb: 1, display: 'block' }}>
                    Generert bilde
                  </Typography>
                  <Box
                    component="img"
                    src={shotFormData.imageUrl}
                    alt="Generated shot"
                    sx={{
                      width: '100%',
                      maxHeight: 300,
                      objectFit: 'contain',
                      borderRadius: 1.5,
                      border: '1px solid rgba(255,255,255,0.12)',
                    }}
                  />
                </Box>
              )}

              {shotFormData.description ? (
                <Stack spacing={1.25}>
                  <FormControl fullWidth>
                    <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Visuell stil</InputLabel>
                    <Select
                      value={selectedTemplate}
                      onChange={(e) => setSelectedTemplate(e.target.value)}
                      label="Visuell stil"
                      sx={{
                        color: '#fff',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
                        '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.87)' },
                      }}
                    >
                      {STORYBOARD_TEMPLATE_OPTIONS.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button
                    variant="outlined"
                    startIcon={generatingImage ? <MUICircularProgress size={16} /> : <AutoAwesomeIcon />}
                    onClick={handleGenerateImage}
                    disabled={generatingImage || !shotFormData.description}
                    fullWidth
                    sx={{
                      color: '#fff',
                      borderColor: 'rgba(255,255,255,0.3)',
                      minHeight: TOUCH_TARGET_SIZE,
                      '&:hover': {
                        borderColor: '#e91e63',
                        bgcolor: 'rgba(233,30,99,0.1)',
                      },
                      '&:disabled': {
                        borderColor: 'rgba(255,255,255,0.1)',
                        color: 'rgba(255,255,255,0.6)',
                      },
                      ...focusVisibleStyles,
                    }}
                  >
                    {generatingImage ? 'Genererer bilde...' : 'Generer storyboard-bilde'}
                  </Button>
                </Stack>
              ) : (
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                  Legg til en kort beskrivelse for å generere storyboard-bilde
                </Typography>
              )}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={handleCloseShotDialog}
            sx={{ color: 'rgba(255,255,255,0.87)', minHeight: TOUCH_TARGET_SIZE, ...focusVisibleStyles }}
          >
            Avbryt
          </Button>
          <Button
            onClick={handleSaveShot}
            variant="contained"
            sx={{ bgcolor: '#e91e63', minHeight: TOUCH_TARGET_SIZE, ...focusVisibleStyles, '&:hover': { bgcolor: '#c2185b' } }}
          >
            {editingShot ? 'Lagre' : 'Legg til'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Storyboard Conversion Dialog */}
      <Dialog
        open={storyboardDialogOpen}
        onClose={handleCloseStoryboardDialog}
        fullScreen={isMobile}
        maxWidth="md"
        fullWidth
        TransitionComponent={Grow}
        TransitionProps={{
          timeout: { enter: 225, exit: 150 },
          enter: true,
          exit: true,
        }}
        slotProps={{
          paper: {
            sx: {
              bgcolor: '#1a1a2e',
              color: '#fff',
              borderRadius: isMobile ? 0 : 2,
            },
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" component="span">
            Opprett storyboard fra shot list
          </Typography>
          {isMobile && (
            <IconButton onClick={handleCloseStoryboardDialog} sx={{ color: 'rgba(255,255,255,0.87)' }}>
              <CloseIcon />
            </IconButton>
          )}
        </DialogTitle>
        <DialogContent>
          {selectedShotListForStoryboard && (
            <Stack spacing={3} sx={{ mt: 1 }}>
              <Box>
                <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.87)', mb: 1 }}>
                  Scene: {getSceneName(selectedShotListForStoryboard.sceneId, selectedShotListForStoryboard.sceneName)}
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                  Velg shots som skal inkluderes i storyboardet
                </Typography>
              </Box>

              <Box
                sx={{
                  maxHeight: '400px',
                  overflowY: 'auto',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 1,
                  p: 1,
                }}
              >
                <Stack spacing={1}>
                  {selectedShotListForStoryboard.shots.map((shot) => {
                    const roleName = getRoleName(shot.roleId);
                    const shotPreview = shot.imageUrl;
                    return (
                      <Box
                        key={shot.id}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          p: 1.5,
                          borderRadius: 1,
                          bgcolor: selectedShotsForConversion.has(shot.id)
                            ? 'rgba(0,212,255,0.1)'
                            : 'rgba(255,255,255,0.03)',
                          border: selectedShotsForConversion.has(shot.id)
                            ? '1px solid rgba(0,212,255,0.3)'
                            : '1px solid rgba(255,255,255,0.1)',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          '&:hover': {
                            bgcolor: selectedShotsForConversion.has(shot.id)
                              ? 'rgba(0,212,255,0.15)'
                              : 'rgba(255,255,255,0.05)',
                          },
                        }}
                        onClick={() => {
                          const newSet = new Set(selectedShotsForConversion);
                          if (newSet.has(shot.id)) {
                            newSet.delete(shot.id);
                          } else {
                            newSet.add(shot.id);
                          }
                          setSelectedShotsForConversion(newSet);
                        }}
                      >
                        <Checkbox
                          checked={selectedShotsForConversion.has(shot.id)}
                          onChange={() => {
                            const newSet = new Set(selectedShotsForConversion);
                            if (newSet.has(shot.id)) {
                              newSet.delete(shot.id);
                            } else {
                              newSet.add(shot.id);
                            }
                            setSelectedShotsForConversion(newSet);
                          }}
                          sx={{ color: 'rgba(255,255,255,0.6)', '&.Mui-checked': { color: '#00d4ff' } }}
                        />
                        <Box
                          sx={{
                            width: 74,
                            height: 48,
                            borderRadius: 1,
                            border: '1px solid rgba(255,255,255,0.12)',
                            overflow: 'hidden',
                            flexShrink: 0,
                            bgcolor: 'rgba(255,255,255,0.03)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {shotPreview ? (
                            <Box
                              component="img"
                              src={shotPreview}
                              alt={`Shot ${shot.shotType}`}
                              sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            />
                          ) : (
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>
                              Slot image
                            </Typography>
                          )}
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" sx={{ color: '#fff', fontWeight: 500 }}>
                            {getShotTypeLabel(shot.shotType)} - {shot.cameraAngle}
                          </Typography>
                          {roleName && (
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                              Rolle: {roleName}
                            </Typography>
                          )}
                          {shot.description && (
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', display: 'block', mt: 0.5 }}>
                              {shot.description}
                            </Typography>
                          )}
                        </Box>
                        <Chip
                          label={shot.duration ? `${shot.duration}s` : '3s'}
                          size="small"
                          sx={{
                            bgcolor: 'rgba(0,212,255,0.2)',
                            color: '#00d4ff',
                            fontSize: '10px',
                          }}
                        />
                      </Box>
                    );
                  })}
                </Stack>
              </Box>

              <Alert severity="info" sx={{ bgcolor: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)' }}>
                <Typography variant="body2">
                  {selectedShotsForConversion.size} av {selectedShotListForStoryboard.shots.length} shots valgt
                </Typography>
              </Alert>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={handleCloseStoryboardDialog}
            sx={{ color: 'rgba(255,255,255,0.87)', minHeight: TOUCH_TARGET_SIZE, ...focusVisibleStyles }}
          >
            Avbryt
          </Button>
          {selectedShotListForStoryboard && (
            <Button
              onClick={() => {
                handleExportStoryboardPDF(selectedShotListForStoryboard);
                handleCloseStoryboardDialog();
              }}
              variant="outlined"
              disabled={selectedShotsForConversion.size === 0}
              startIcon={<ExportIcon />}
              sx={{
                color: '#9333ea',
                borderColor: '#9333ea',
                minHeight: TOUCH_TARGET_SIZE,
                ...focusVisibleStyles,
                '&:hover': { bgcolor: 'rgba(147,51,234,0.1)' },
                '&:disabled': { borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)' },
              }}
            >
              Eksporter PDF
            </Button>
          )}
          <Button
            onClick={handleConvertToStoryboard}
            variant="contained"
            disabled={selectedShotsForConversion.size === 0}
            startIcon={<StoryboardIcon />}
            sx={{
              bgcolor: '#00d4ff',
              color: '#000',
              minHeight: TOUCH_TARGET_SIZE,
              ...focusVisibleStyles,
              '&:hover': { bgcolor: '#00b8e6' },
              '&:disabled': { bgcolor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' },
            }}
          >
            Opprett storyboard
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={storyboardPanelOpen}
        onClose={handleCloseStoryboardPanel}
        fullScreen
        TransitionComponent={Grow}
        slotProps={{
          paper: {
            sx: {
              bgcolor: '#0b0d12',
              backgroundImage: 'radial-gradient(circle at top left, rgba(0,212,255,0.12), transparent 40%), radial-gradient(circle at 20% 30%, rgba(233,30,99,0.12), transparent 45%)',
            },
          },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1.5,
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            bgcolor: 'rgba(8,10,16,0.8)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <StoryboardIcon sx={{ color: '#00d4ff' }} />
            <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 700, letterSpacing: 0.2 }}>
              Storyboard Viewer
            </Typography>
          </Box>
          <IconButton onClick={handleCloseStoryboardPanel} sx={{ color: 'rgba(255,255,255,0.87)' }}>
            <CloseIcon />
          </IconButton>
        </Box>
        <Box sx={{ p: { xs: 2, md: 3 }, height: 'calc(100vh - 56px)', overflowY: 'auto' }}>
          {storyboards.length === 0 ? (
            <Box
              sx={{
                p: 3,
                borderRadius: 3,
                border: '1px dashed rgba(255,255,255,0.15)',
                bgcolor: 'rgba(255,255,255,0.03)',
                textAlign: 'center',
              }}
            >
              <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, mb: 1 }}>
                Ingen storyboards funnet
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.87)' }}>
                Opprett et storyboard fra shot list for å se frames her.
              </Typography>
            </Box>
          ) : (
            <>
              <Box
                sx={{
                  p: 2,
                  mb: 3,
                  borderRadius: 3,
                  border: '1px solid rgba(255,255,255,0.08)',
                  bgcolor: 'rgba(255,255,255,0.04)',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 2,
                  alignItems: 'center',
                }}
              >
                <FormControl size="small" sx={{ minWidth: 260 }}>
                  <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Velg storyboard</InputLabel>
                  <Select
                    value={currentStoryboard?.id || ''}
                    onChange={(e) => e.target.value && loadStoryboard(e.target.value)}
                    label="Velg storyboard"
                    sx={{
                      color: '#fff',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                      bgcolor: 'rgba(0,0,0,0.2)',
                    }}
                  >
                    {storyboards.map((sb) => (
                      <MenuItem key={sb.id} value={sb.id}>
                        {sb.name} ({sb.frames.length} frames)
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {currentStoryboard && (
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Chip
                      label={`${currentStoryboard.frames.length} frames`}
                      sx={{
                        bgcolor: 'rgba(0,212,255,0.15)',
                        color: '#00d4ff',
                        border: '1px solid rgba(0,212,255,0.4)',
                      }}
                    />
                    <Chip
                      label={currentStoryboard.name}
                      sx={{
                        bgcolor: 'rgba(255,255,255,0.08)',
                        color: '#fff',
                      }}
                    />
                  </Box>
                )}
              </Box>
              {currentStoryboard ? (
                <Grid container spacing={{ xs: 2, md: 2.5 }}>
                  {currentStoryboard.frames.map((frame) => (
                    <Grid key={frame.id} size={{ xs: 12, sm: 6, md: 4 }}>
                      <Card
                        sx={{
                          bgcolor: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 2,
                          overflow: 'hidden',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            transform: 'translateY(-4px)',
                            borderColor: 'rgba(0,212,255,0.5)',
                            boxShadow: '0 12px 24px rgba(0,0,0,0.35)',
                          },
                        }}
                      >
                        {frame.thumbnailUrl ? (
                          <Box
                            component="img"
                            src={frame.thumbnailUrl}
                            alt={frame.title || 'Storyboard frame'}
                            sx={{ width: '100%', height: 180, objectFit: 'cover' }}
                          />
                        ) : (
                          <Box sx={{ height: 180, bgcolor: 'rgba(255,255,255,0.05)' }} />
                        )}
                        <CardContent sx={{ p: 1.5 }}>
                          <Typography variant="body2" sx={{ color: '#fff', fontWeight: 700 }}>
                            {frame.title || `Frame ${frame.index + 1}`}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                            {frame.shotType} • {frame.cameraAngle}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <Box
                  sx={{
                    p: 3,
                    borderRadius: 3,
                    border: '1px dashed rgba(255,255,255,0.15)',
                    bgcolor: 'rgba(255,255,255,0.03)',
                    textAlign: 'center',
                  }}
                >
                  <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, mb: 1 }}>
                    Velg et storyboard
                  </Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.87)' }}>
                    Velg et storyboard for å se frames og metadata.
                  </Typography>
                </Box>
              )}
            </>
          )}
        </Box>
      </Dialog>

      {/* Export PDF Dialog */}
      <Dialog
        open={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#1a1a2e',
            backgroundImage: 'none',
            borderRadius: 3,
          },
        }}
      >
        <DialogTitle sx={{ color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <PdfIcon sx={{ color: '#9333ea' }} />
          Eksporter til PDF
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'rgba(255,255,255,0.87)', mb: 3 }}>
            {exportSceneId 
              ? 'Velg eksportformat for denne scenen:'
              : 'Velg hva du vil eksportere:'}
          </Typography>
          <Stack spacing={2}>
            {/* If specific scene selected, show it first with highlight */}
            {exportSceneId && (() => {
              const selectedScene = shotLists.find(sl => sl.id === exportSceneId);
              if (!selectedScene) return null;
              return (
                <Button
                  variant="contained"
                  fullWidth
                  onClick={() => {
                    handleExportScenePDF(selectedScene);
                    setShowExportDialog(false);
                    setExportSceneId(null);
                  }}
                  sx={{
                    py: 2,
                    bgcolor: '#e91e63',
                    color: '#fff',
                    justifyContent: 'flex-start',
                    textAlign: 'left',
                    '&:hover': { bgcolor: '#c2185b' },
                  }}
                >
                  <Box>
                    <Typography sx={{ fontWeight: 600 }}>
                      {getSceneName(selectedScene.sceneId, selectedScene.sceneName)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                      Eksporter denne scenen ({selectedScene.shots.length} shots)
                    </Typography>
                  </Box>
                </Button>
              );
            })()}
            
            {exportSceneId && (
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', textAlign: 'center' }}>
                — eller velg annet alternativ —
              </Typography>
            )}
            
            <Button
              variant="outlined"
              fullWidth
              startIcon={<ExportIcon />}
              onClick={() => {
                handleExportAllPDF();
                setShowExportDialog(false);
                setExportSceneId(null);
              }}
              sx={{
                py: 2,
                color: '#fff',
                borderColor: 'rgba(255,255,255,0.2)',
                justifyContent: 'flex-start',
                textAlign: 'left',
                '&:hover': { borderColor: '#9333ea', bgcolor: 'rgba(147,51,234,0.1)' },
              }}
            >
              <Box>
                <Typography sx={{ fontWeight: 600 }}>Alle scener</Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                  Eksporter alle {shotLists.length} scener med alle shots
                </Typography>
              </Box>
            </Button>

            {exportSceneId && (() => {
              const selectedForStoryboard = shotLists.find((sl) => sl.id === exportSceneId);
              if (!selectedForStoryboard) return null;
              return (
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<ExportIcon />}
                  onClick={() => {
                    handleExportStoryboardPDF(selectedForStoryboard);
                    setShowExportDialog(false);
                    setExportSceneId(null);
                  }}
                  sx={{
                    py: 2,
                    color: '#00d4ff',
                    borderColor: 'rgba(0,212,255,0.3)',
                    justifyContent: 'flex-start',
                    textAlign: 'left',
                    '&:hover': { borderColor: '#00d4ff', bgcolor: 'rgba(0,212,255,0.1)' },
                  }}
                >
                  <Box>
                    <Typography sx={{ fontWeight: 600 }}>Storyboard PDF</Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                      Eksporter {getSceneName(selectedForStoryboard.sceneId, selectedForStoryboard.sceneName)} som storyboard
                    </Typography>
                  </Box>
                </Button>
              );
            })()}
            
            {!exportSceneId && (
              <>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', textAlign: 'center' }}>
                  — eller velg en spesifikk scene —
                </Typography>
                {shotLists.map((sl) => (
                  <Button
                    key={sl.id}
                    variant="outlined"
                    fullWidth
                    onClick={() => {
                      handleExportScenePDF(sl);
                      setShowExportDialog(false);
                    }}
                    sx={{
                      py: 1.5,
                      color: '#fff',
                      borderColor: 'rgba(255,255,255,0.1)',
                      justifyContent: 'flex-start',
                      textAlign: 'left',
                      '&:hover': { borderColor: '#e91e63', bgcolor: 'rgba(233,30,99,0.1)' },
                    }}
                  >
                    <Box>
                      <Typography sx={{ fontWeight: 500 }}>
                        {getSceneName(sl.sceneId, sl.sceneName)}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                        {sl.shots.length} shots
                      </Typography>
                    </Box>
                  </Button>
                ))}
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setShowExportDialog(false)} sx={{ color: 'rgba(255,255,255,0.87)' }}>
            Avbryt
          </Button>
        </DialogActions>
      </Dialog>

      {/* Storyboard Manager Dialog */}
      <Dialog
        open={showStoryboardManager}
        onClose={() => setShowStoryboardManager(false)}
        fullScreen={isMobile}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#1a1a2e',
            backgroundImage: 'none',
            borderRadius: isMobile ? 0 : 3,
            minHeight: isMobile ? '100%' : '80vh',
          },
        }}
      >
        <DialogTitle sx={{ color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <StoryboardIcon sx={{ color: '#00d4ff' }} />
            Storyboard Manager
          </Box>
          <IconButton onClick={() => setShowStoryboardManager(false)} sx={{ color: 'rgba(255,255,255,0.87)' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'rgba(255,255,255,0.87)', mb: 3 }}>
            Administrer storyboards for dine scener. Du kan generere AI-storyboards for hver scene eller individuelle shots.
          </Typography>
          <Grid container spacing={2}>
            {shotLists.map((sl) => {
              const relatedStoryboard = findRelatedStoryboard(sl);
              const storyboardPackImage = getStoryboardPackPreviewImage(sl, relatedStoryboard);
              return (
                <Grid key={sl.id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Card
                    sx={{
                      bgcolor: 'rgba(255,255,255,0.05)',
                      border: relatedStoryboard ? '1px solid rgba(0,212,255,0.3)' : '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 2,
                    }}
                  >
                    <CardContent>
                      <Box
                        sx={{
                          mb: 1.5,
                          borderRadius: 1.5,
                          overflow: 'hidden',
                          border: '1px solid rgba(255,255,255,0.1)',
                          height: 132,
                          bgcolor: 'rgba(255,255,255,0.03)',
                          position: 'relative',
                        }}
                      >
                        {storyboardPackImage ? (
                          <Box
                            component="img"
                            src={storyboardPackImage}
                            alt={`${getSceneName(sl.sceneId, sl.sceneName)} storyboard preview`}
                            sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          />
                        ) : (
                          <Stack
                            alignItems="center"
                            justifyContent="center"
                            spacing={0.5}
                            sx={{ height: '100%', color: 'rgba(255,255,255,0.55)' }}
                          >
                            <StoryboardIcon sx={{ fontSize: 26, opacity: 0.7 }} />
                            <Typography variant="caption">Slot image</Typography>
                          </Stack>
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                        <Typography sx={{ color: '#fff', fontWeight: 600 }}>
                          {getSceneName(sl.sceneId, sl.sceneName)}
                        </Typography>
                        {relatedStoryboard && (
                          <Chip
                            size="small"
                            label={`${relatedStoryboard.frames.length} frames`}
                            sx={{ bgcolor: 'rgba(0,212,255,0.2)', color: '#00d4ff', fontSize: '10px' }}
                          />
                        )}
                      </Box>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', display: 'block', mb: 2 }}>
                        {sl.shots.length} shots
                      </Typography>
                      <FormControl size="small" fullWidth sx={{ mb: 1.5 }}>
                        <Select
                          value={getPackTemplate(sl.id)}
                          onChange={(e) =>
                            setPackTemplateByShotListId((prev) => ({
                              ...prev,
                              [sl.id]: e.target.value as string,
                            }))
                          }
                          sx={{
                            color: '#fff',
                            fontSize: '12px',
                            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                            '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.87)' },
                          }}
                        >
                          {STORYBOARD_TEMPLATE_OPTIONS.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <Stack direction="row" spacing={1}>
                        {/* Add Shot Button */}
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            handleOpenAddShotDialog(sl);
                          }}
                          startIcon={<AddIcon />}
                          sx={{
                            color: '#10b981',
                            borderColor: 'rgba(16,185,129,0.3)',
                            fontSize: '11px',
                            minWidth: 'auto',
                            px: 1.5,
                            '&:hover': { borderColor: '#10b981', bgcolor: 'rgba(16,185,129,0.1)' },
                          }}
                        >
                          Shot
                        </Button>
                        {relatedStoryboard ? (
                          <Button
                            size="small"
                            variant="outlined"
                            sx={{
                              flex: 1,
                              color: '#00d4ff',
                              borderColor: 'rgba(0,212,255,0.3)',
                              fontSize: '11px',
                              '&:hover': { borderColor: '#00d4ff' },
                            }}
                            onClick={() => {
                              setShowStoryboardManager(false);
                              handleOpenStoryboardDialog(sl);
                            }}
                          >
                            Vis storyboard
                          </Button>
                        ) : (
                          <Button
                            size="small"
                            variant="contained"
                            sx={{
                              flex: 1,
                              bgcolor: '#e91e63',
                              fontSize: '11px',
                              '&:hover': { bgcolor: '#c2185b' },
                            }}
                            disabled={generatingStoryboardImages[sl.id]}
                            onClick={() => {
                              setShowStoryboardManager(false);
                              handleAutoGenerateStoryboardImages(sl, getPackTemplate(sl.id));
                            }}
                            startIcon={generatingStoryboardImages[sl.id] ? <MUICircularProgress size={14} /> : <AutoAwesomeIcon />}
                          >
                            {generatingStoryboardImages[sl.id] ? 'Genererer...' : 'Generer AI'}
                          </Button>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </DialogContent>
      </Dialog>

      {/* Team Dashboard Dialog */}
      <Dialog
        open={showTeamDashboard}
        onClose={() => setShowTeamDashboard(false)}
        fullScreen
        PaperProps={{
          sx: {
            bgcolor: '#0a0a0a',
            backgroundImage: 'none',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            maxHeight: '100%',
            m: 0,
            borderRadius: 0,
          },
        }}
      >
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          height: '100%',
          overflow: 'hidden',
        }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              p: 2,
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              flexShrink: 0,
            }}
          >
            <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>
              Team Dashboard
            </Typography>
            <IconButton onClick={() => setShowTeamDashboard(false)} sx={{ color: '#fff' }}>
              <CloseIcon />
            </IconButton>
          </Box>
          <Box sx={{ 
            flex: 1, 
            overflow: 'hidden', 
            display: 'flex', 
            flexDirection: 'column', 
            minHeight: 0,
            position: 'relative',
          }}>
            <TeamDashboard
              shotLists={shotLists}
              crewMembers={crewMembers}
              currentUserId={user?.id}
              projectId={projectId}
              crewSegment={teamDashboardCrewSegment}
              onCrewSegmentChange={setTeamDashboardCrewSegment}
              scenes={[]}
              onShotUpdate={async (shotList, shot) => {
                // Optimistic update: Update state immediately
                setShotLists(prev => prev.map(sl => 
                  sl.id === shotList.id 
                    ? {
                        ...shotList,
                        shots: shotList.shots.map(s => s.id === shot.id ? shot : s),
                        updatedAt: new Date().toISOString(),
                      }
                    : sl
                ));

                // Save to backend asynchronously (non-blocking)
                try {
                  const updatedShotList: ShotList = {
                    ...shotList,
                    shots: shotList.shots.map(s => s.id === shot.id ? shot : s),
                    updatedAt: new Date().toISOString(),
                  };
                  await castingService.saveShotList(projectId, updatedShotList);
                  if (onUpdate) onUpdate();
                } catch (error) {
                  console.error('Error saving shot update:', error);
                  toast.showWarning('Lagring feilet. Endringen ble rullet tilbake.');
                  // Revert optimistic update on error
                  const lists = await castingService.getShotLists(projectId);
                  setShotLists(Array.isArray(lists) ? lists : []);
                }
              }}
            />
          </Box>
        </Box>
      </Dialog>

      {/* Add Shot Dialog (Upload/Reference from Shot.cafe) */}
      <Dialog
        open={showAddShotDialog}
        onClose={() => setShowAddShotDialog(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#1a1f2e',
            border: '1px solid #3b82f6',
            minHeight: addShotMode ? 500 : 'auto',
          },
        }}
      >
        <DialogTitle sx={{ color: '#fff', borderBottom: '1px solid #2a3142' }}>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={1} alignItems="center">
              <AddIcon sx={{ color: '#3b82f6' }} />
              <span>Legg til shot</span>
              {addShotTargetShotList && (
                <Chip 
                  label={getSceneName(addShotTargetShotList.sceneId, addShotTargetShotList.sceneName)}
                  size="small"
                  sx={{ bgcolor: 'rgba(59,130,246,0.2)', color: '#60a5fa' }}
                />
              )}
            </Stack>
            {addShotMode && (
              <Button
                size="small"
                onClick={() => { setAddShotMode(null); setSelectedShotImage(null); setAddShotReferenceResults([]); }}
                sx={{ color: '#6b7280', fontSize: 11 }}
              >
                ← Tilbake
              </Button>
            )}
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {!addShotMode ? (
            /* Mode Selection */
            <Stack spacing={3}>
              <Typography sx={{ color: '#9ca3af', fontSize: 13 }}>
                Velg hvordan du vil legge til et nytt shot
              </Typography>
              <Stack direction="row" spacing={2}>
                {/* Upload Option */}
                <Box
                  onClick={() => setAddShotMode('upload')}
                  sx={{
                    flex: 1,
                    p: 4,
                    borderRadius: '12px',
                    bgcolor: 'rgba(59,130,246,0.1)',
                    border: '2px dashed #3b82f6',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.2s',
                    '&:hover': {
                      bgcolor: 'rgba(59,130,246,0.2)',
                      borderStyle: 'solid',
                    },
                  }}
                >
                  <Box sx={{
                    width: 64,
                    height: 64,
                    borderRadius: '16px',
                    bgcolor: 'rgba(59,130,246,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 2,
                  }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/>
                      <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                  </Box>
                  <Typography sx={{ fontSize: 16, fontWeight: 600, color: '#fff', mb: 1 }}>
                    Last opp eget bilde
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: '#6b7280' }}>
                    Last opp storyboard, skisse eller referanse
                  </Typography>
                </Box>

                {/* Reference Search Option */}
                <Box
                  onClick={() => setAddShotMode('reference')}
                  sx={{
                    flex: 1,
                    p: 4,
                    borderRadius: '12px',
                    bgcolor: 'rgba(139,92,246,0.1)',
                    border: '2px dashed #8b5cf6',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.2s',
                    '&:hover': {
                      bgcolor: 'rgba(139,92,246,0.2)',
                      borderStyle: 'solid',
                    },
                  }}
                >
                  <Box sx={{
                    width: 64,
                    height: 64,
                    borderRadius: '16px',
                    bgcolor: 'rgba(139,92,246,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 2,
                  }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2">
                      <circle cx="11" cy="11" r="8"/>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                  </Box>
                  <Typography sx={{ fontSize: 16, fontWeight: 600, color: '#fff', mb: 1 }}>
                    Søk fra Shot.cafe
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: '#6b7280' }}>
                    Finn referansebilder fra filmer og serier
                  </Typography>
                </Box>
              </Stack>
            </Stack>
          ) : addShotMode === 'upload' ? (
            /* Upload Mode */
            <Stack spacing={3}>
              <Typography sx={{ color: '#9ca3af', fontSize: 13 }}>
                Last opp et bilde for ditt nye shot
              </Typography>
              
              {selectedShotImage ? (
                <Box sx={{ textAlign: 'center' }}>
                  <Box
                    component="img"
                    src={selectedShotImage}
                    sx={{
                      maxWidth: '100%',
                      maxHeight: 300,
                      borderRadius: '12px',
                      border: '2px solid #3b82f6',
                    }}
                  />
                  <Button
                    onClick={() => setSelectedShotImage(null)}
                    sx={{ mt: 2, color: '#6b7280' }}
                  >
                    Velg annet bilde
                  </Button>
                </Box>
              ) : (
                <Box
                  component="label"
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 6,
                    borderRadius: '12px',
                    bgcolor: 'rgba(0,0,0,0.2)',
                    border: '2px dashed #374151',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                      borderColor: '#3b82f6',
                      bgcolor: 'rgba(59,130,246,0.1)',
                    },
                  }}
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAddShotImageUpload}
                    style={{ display: 'none' }}
                  />
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <path d="M21 15l-5-5L5 21"/>
                  </svg>
                  <Typography sx={{ fontSize: 14, color: '#9ca3af', mt: 2 }}>
                    Klikk for å velge bilde
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: '#6b7280', mt: 0.5 }}>
                    Støtter JPG, PNG, WebP
                  </Typography>
                </Box>
              )}
            </Stack>
          ) : (
            /* Reference Search Mode */
            <Stack spacing={3}>
              <Typography sx={{ color: '#9ca3af', fontSize: 13 }}>
                Søk etter referansebilder fra Shot.cafe
              </Typography>
              
              <Stack direction="row" spacing={1}>
                <TextField
                  fullWidth
                  placeholder="Søk: film, mood, shot type..."
                  value={addShotReferenceQuery}
                  onChange={(e) => setAddShotReferenceQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchReferenceShots()}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      bgcolor: '#0d1117',
                      color: '#fff',
                      '& fieldset': { borderColor: '#374151' },
                      '&:hover fieldset': { borderColor: '#8b5cf6' },
                      '&.Mui-focused fieldset': { borderColor: '#8b5cf6' },
                    },
                  }}
                />
                <Button
                  variant="contained"
                  onClick={handleSearchReferenceShots}
                  disabled={addShotLoading || !addShotReferenceQuery.trim()}
                  sx={{
                    bgcolor: '#8b5cf6',
                    px: 3,
                    '&:hover': { bgcolor: '#7c3aed' },
                  }}
                >
                  {addShotLoading ? <MUICircularProgress size={20} sx={{ color: '#fff' }} /> : 'Søk'}
                </Button>
              </Stack>
              
              {/* Quick Search Tags */}
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {['Blade Runner', 'Kubrick', 'Tarantino', 'Nolan', 'Close-up', 'Wide shot'].map(tag => (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    onClick={() => { setAddShotReferenceQuery(tag); }}
                    sx={{
                      bgcolor: 'rgba(139,92,246,0.15)',
                      color: '#a78bfa',
                      '&:hover': { bgcolor: 'rgba(139,92,246,0.3)' },
                    }}
                  />
                ))}
              </Stack>
              
              {/* Results Grid */}
              {addShotReferenceResults.length > 0 && (
                <Box sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                  gap: 1.5,
                  maxHeight: 280,
                  overflow: 'auto',
                  p: 1,
                }}>
                  {addShotReferenceResults.map((result) => (
                    <Box
                      key={result.id}
                      onClick={() => setSelectedShotImage(result.url)}
                      sx={{
                        position: 'relative',
                        aspectRatio: '16/9',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        border: selectedShotImage === result.url ? '3px solid #3b82f6' : '2px solid transparent',
                        transition: 'all 0.2s',
                        '&:hover': {
                          transform: 'scale(1.05)',
                          boxShadow: '0 4px 20px rgba(59,130,246,0.3)',
                        },
                      }}
                    >
                      <Box
                        component="img"
                        src={result.thumbnailUrl || result.url}
                        sx={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                      {result.film && (
                        <Box sx={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          p: 0.5,
                          background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                        }}>
                          <Typography sx={{ fontSize: 9, color: '#fff', fontWeight: 500 }}>
                            {result.film}
                          </Typography>
                        </Box>
                      )}
                      {selectedShotImage === result.url && (
                        <Box sx={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          bgcolor: '#3b82f6',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <CheckIcon sx={{ fontSize: 14, color: '#fff' }} />
                        </Box>
                      )}
                    </Box>
                  ))}
                </Box>
              )}
              
              {addShotLoading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <MUICircularProgress sx={{ color: '#8b5cf6' }} />
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button 
            onClick={() => setShowAddShotDialog(false)} 
            sx={{ color: '#9ca3af' }}
          >
            Avbryt
          </Button>
          {addShotMode && (
            <Button
              onClick={() => handleCreateShotWithImage(selectedShotImage || undefined)}
              variant="contained"
              disabled={addShotMode === 'upload' && !selectedShotImage}
              sx={{
                bgcolor: addShotMode === 'upload' ? '#3b82f6' : '#8b5cf6',
                '&:hover': { bgcolor: addShotMode === 'upload' ? '#2563eb' : '#7c3aed' },
                '&.Mui-disabled': { bgcolor: '#374151', color: '#6b7280' },
              }}
            >
              {selectedShotImage ? 'Legg til med bilde' : 'Legg til uten bilde'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <MemoryCardBackupControlDialog
        open={memoryCardControlOpen}
        onClose={() => setMemoryCardControlOpen(false)}
        projectId={projectId}
        shotLists={shotLists}
        crewOptions={crewMembers.map((member) => ({
          id: member.id,
          name: member.name,
          role: member.role,
        }))}
      />

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog
        open={confirmBulkDeleteOpen}
        onClose={() => setConfirmBulkDeleteOpen(false)}
        maxWidth="sm"
        PaperProps={{
          sx: {
            bgcolor: '#1c2128',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 3,
          },
        }}
        sx={{ zIndex: Z_INDEX.dialog }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{
            width: 40, height: 40, borderRadius: '50%',
            bgcolor: 'rgba(255,68,68,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <DeleteIcon sx={{ fontSize: 24, color: '#ff4444' }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {branding.tokens.labels.deleteProjectLabel || 'Delete'}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'rgba(255,255,255,0.85)' }}>
            {`Er du sikker på at du vil slette ${selectedIds.size} shot list(er)?`}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setConfirmBulkDeleteOpen(false)} variant="outlined"
            sx={{ color: 'rgba(255,255,255,0.8)', borderColor: 'rgba(255,255,255,0.2)', textTransform: 'none' }}>
            {branding.tokens.labels.cancelLabel || 'Avbryt'}
          </Button>
          <Button onClick={executeBulkDelete} variant="contained" startIcon={<DeleteIcon />}
            sx={{ bgcolor: '#ff4444', color: '#fff', textTransform: 'none', fontWeight: 600, '&:hover': { bgcolor: '#ff3333' } }}>
            {branding.tokens.labels.deleteProjectLabel || 'Slett'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Audit Log Popover ──────────────────────────────────────────────────────── */}
      <Popover
        open={showAuditLog}
        anchorEl={auditLogAnchorRef.current}
        onClose={() => setShowAuditLog(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          sx: {
            bgcolor: '#1a1a2e',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 2,
            width: 380,
            maxWidth: '90vw',
          },
        }}
      >
        <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <HistoryIcon sx={{ color: '#e91e63', fontSize: 18 }} />
            <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '0.9rem' }}>
              Aktivitetslogg
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {/* Live connection dot */}
            <Box sx={{
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              bgcolor: rt.connectionStatus === 'connected' ? '#4caf50' : rt.connectionStatus === 'offline' ? '#ef5350' : '#9333ea',
            }} />
            <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem' }}>
              {rt.connectionStatus === 'connected' ? 'Live' : rt.connectionStatus === 'offline' ? 'Offline' : 'Kobler til…'}
            </Typography>
            <IconButton size="small" onClick={() => setShowAuditLog(false)} sx={{ color: 'rgba(255,255,255,0.4)', p: 0.25 }}>
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>
        </Box>

        {/* Presence row */}
        {rt.presence.size > 0 && (
          <Box sx={{ px: 2, py: 1, bgcolor: 'rgba(76,175,80,0.07)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.7rem' }}>Også aktiv:</Typography>
            {[...rt.presence.values()].map(p => (
              <Chip
                key={p.userId}
                label={p.userName}
                size="small"
                sx={{ height: 20, fontSize: '0.68rem', bgcolor: 'rgba(76,175,80,0.2)', color: '#4caf50', border: '1px solid rgba(76,175,80,0.3)' }}
              />
            ))}
          </Box>
        )}

        {/* Log entries */}
        <Box sx={{ maxHeight: 340, overflowY: 'auto' }}>
          {rt.auditLog.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.82rem' }}>
                Ingen aktivitet registrert ennå
              </Typography>
            </Box>
          ) : (
            <List dense disablePadding>
              {rt.auditLog.map((entry, idx) => (
                <Fragment key={entry.id}>
                  <ListItem
                    alignItems="flex-start"
                    sx={{
                      px: 2,
                      py: 1,
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' },
                    }}
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 0.25 }}>
                          <Typography component="span" sx={{ color: '#e91e63', fontWeight: 600, fontSize: '0.8rem' }}>
                            {entry.userName}
                          </Typography>
                          <Typography component="span" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem' }}>
                            {entry.action}
                          </Typography>
                        </Box>
                      }
                      secondary={
                        <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem' }}>
                          {new Date(entry.timestamp).toLocaleString('nb-NO', { timeStyle: 'short', dateStyle: 'short' })}
                        </Typography>
                      }
                    />
                  </ListItem>
                  {idx < rt.auditLog.length - 1 && (
                    <MuiDivider sx={{ borderColor: 'rgba(255,255,255,0.05)', mx: 2 }} />
                  )}
                </Fragment>
              ))}
            </List>
          )}
        </Box>
      </Popover>

    </Box>
  );
}
