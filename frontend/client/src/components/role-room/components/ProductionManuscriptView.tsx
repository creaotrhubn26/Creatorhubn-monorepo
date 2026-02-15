import { useState, useEffect, useRef, useMemo, useCallback, memo, type FC, type ReactNode, type ChangeEvent, type MouseEvent } from 'react';
import {
  Box,
  Typography,
  Stack,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  Tooltip,
  Collapse,
  Menu,
  TextField,
  InputAdornment,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Badge,
  Drawer,
  Chip,
  Checkbox,
  CircularProgress,
  Alert,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Theaters as SceneIcon,
  Videocam as CameraIcon,
  Lightbulb as LightIcon,
  Mic as MicIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Movie as MovieIcon,
  Add as AddIcon,
  Close as CloseIcon,
  Image as ImageIcon,
  GridView as GridViewIcon,
  ViewList as ViewListIcon,
  PlayArrow as PlayIcon,
  Warning as WarningIcon,
  Print as PrintIcon,
  Check as CheckIcon,
  Edit as EditIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  Fullscreen as FullscreenIcon,
  Search as SearchIcon,
  DragIndicator as DragIcon,
  Download as DownloadIcon,
  FileDownload as ExportIcon,
  Pause as PauseIcon,
  Timer as TimerIcon,
  RecordVoiceOver as ReadThroughIcon,
  People as PeopleIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Person as PersonIcon,
  Notes as NoteIcon,
  FileCopy as FileCopyIcon,
  Bookmark as BookmarkIcon,
  Assignment as AssignmentIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  VideoLibrary as VideoLibraryIcon,
  // Production Workflow Icons
  FiberManualRecord as LiveIcon,
  ViewWeek as StripboardIcon,
  CalendarMonth as CalendarIcon,
  Description as CallSheetIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  // Additional icons to replace emojis
  WbSunny as SunIcon,
  NightsStay as MoonIcon,
  WbTwilight as TwilightIcon,
  Home as HomeIcon,
  Park as ParkIcon,
  PushPin as PinIcon,
  FormatQuote as QuoteIcon,
  PhotoCamera as PhotoIcon,
  CameraAlt as CameraAltIcon,
  Inventory as InventoryIcon,
  TheaterComedy as TheaterIcon,
  Cancel as CancelIcon,
  CheckCircle as CheckCircleIcon,
  Chat as ChatIcon,
  CameraRoll as CameraRollIcon,
} from '@mui/icons-material';
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
import type { SceneBreakdown, DialogueLine, Act, Manuscript, CastingShot, ShotList, Candidate, Role, ShotType } from '../models/casting';
import { ProductionEstimateDialog } from './ProductionEstimateDialog';
import { castingService } from '../services/castingService';
import { sceneNeedsService } from '../services/sceneNeedsService';

// Production Workflow Components
import LiveSetMode from './production/LiveSetMode';
import StripboardPanel from './production/StripboardPanel';
import ShootingDayPlanner from './production/ShootingDayPlanner';
import CallSheetGenerator from './CallSheetGenerator';
import {
  productionWorkflowService,
  generateCallSheetHTML,
  downloadCallSheetPDF,
  DEFAULT_CALL_SHEET_OPTIONS,
} from './production';
import type { CallSheet, ShootingDay, LiveSetStatus } from './production';

// ============================================
// 7-TIER RESPONSIVE SYSTEM
// ============================================
type ScreenTier = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | '4k';

const useScreenTier = (): { tier: ScreenTier; isMobile: boolean; isTablet: boolean; isDesktop: boolean; is4K: boolean } => {
  const theme = useTheme();
  const isXs = useMediaQuery('(max-width:599px)');
  const isSm = useMediaQuery('(min-width:600px) and (max-width:899px)');
  const isMd = useMediaQuery('(min-width:900px) and (max-width:1199px)');
  const isLg = useMediaQuery('(min-width:1200px) and (max-width:1535px)');
  const isXl = useMediaQuery('(min-width:1536px) and (max-width:1919px)');
  const isXxl = useMediaQuery('(min-width:1920px) and (max-width:2559px)');
  const is4K = useMediaQuery('(min-width:2560px)');

  const tier: ScreenTier = is4K ? '4k' : isXxl ? 'xxl' : isXl ? 'xl' : isLg ? 'lg' : isMd ? 'md' : isSm ? 'sm' : 'xs';
  const isMobile = tier === 'xs' || tier === 'sm';
  const isTablet = tier === 'md';
  const isDesktop = tier === 'lg' || tier === 'xl' || tier === 'xxl' || tier === '4k';

  return { tier, isMobile, isTablet, isDesktop, is4K };
};

const getResponsiveValues = (tier: ScreenTier) => {
  const values = {
    xs: { 
      titleFontSize: '10px', bodyFontSize: '11px', captionFontSize: '9px',
      buttonSize: 'small' as const, iconSize: 14, spacing: 1, padding: 1, chipSize: 'small' as const,
      sidebarWidth: 0, rightPanelWidth: 0, headerPx: 1.5, headerPy: 1, sceneThumbnailSize: 36,
      sceneInfoFontSize: 11, searchInputFontSize: 12, filterChipPx: 1, filterChipPy: 0.25,
    },
    sm: { 
      titleFontSize: '11px', bodyFontSize: '12px', captionFontSize: '10px',
      buttonSize: 'small' as const, iconSize: 16, spacing: 1, padding: 1.5, chipSize: 'small' as const,
      sidebarWidth: 220, rightPanelWidth: 260, headerPx: 2, headerPy: 1.5, sceneThumbnailSize: 40,
      sceneInfoFontSize: 11, searchInputFontSize: 12, filterChipPx: 1.25, filterChipPy: 0.5,
    },
    md: { 
      titleFontSize: '12px', bodyFontSize: '12px', captionFontSize: '10px',
      buttonSize: 'small' as const, iconSize: 18, spacing: 1.5, padding: 1.5, chipSize: 'small' as const,
      sidebarWidth: 260, rightPanelWidth: 300, headerPx: 2.5, headerPy: 1.5, sceneThumbnailSize: 40,
      sceneInfoFontSize: 12, searchInputFontSize: 12, filterChipPx: 1.5, filterChipPy: 0.5,
    },
    lg: { 
      titleFontSize: '14px', bodyFontSize: '13px', captionFontSize: '11px',
      buttonSize: 'small' as const, iconSize: 20, spacing: 2, padding: 2, chipSize: 'small' as const,
      sidebarWidth: 300, rightPanelWidth: 380, headerPx: 3, headerPy: 2, sceneThumbnailSize: 44,
      sceneInfoFontSize: 12, searchInputFontSize: 13, filterChipPx: 1.5, filterChipPy: 0.5,
    },
    xl: { 
      titleFontSize: '14px', bodyFontSize: '13px', captionFontSize: '11px',
      buttonSize: 'medium' as const, iconSize: 20, spacing: 2, padding: 2, chipSize: 'small' as const,
      sidebarWidth: 320, rightPanelWidth: 400, headerPx: 3, headerPy: 2, sceneThumbnailSize: 48,
      sceneInfoFontSize: 13, searchInputFontSize: 13, filterChipPx: 1.5, filterChipPy: 0.5,
    },
    xxl: { 
      titleFontSize: '15px', bodyFontSize: '14px', captionFontSize: '12px',
      buttonSize: 'medium' as const, iconSize: 22, spacing: 2, padding: 2, chipSize: 'medium' as const,
      sidebarWidth: 340, rightPanelWidth: 420, headerPx: 3, headerPy: 2, sceneThumbnailSize: 52,
      sceneInfoFontSize: 13, searchInputFontSize: 14, filterChipPx: 1.5, filterChipPy: 0.5,
    },
    '4k': { 
      titleFontSize: '18px', bodyFontSize: '16px', captionFontSize: '14px',
      buttonSize: 'large' as const, iconSize: 26, spacing: 3, padding: 3, chipSize: 'medium' as const,
      sidebarWidth: 400, rightPanelWidth: 500, headerPx: 4, headerPy: 3, sceneThumbnailSize: 60,
      sceneInfoFontSize: 15, searchInputFontSize: 16, filterChipPx: 2, filterChipPy: 0.75,
    },
  };
  return values[tier];
};

interface ProductionManuscriptViewProps {
  manuscript: Manuscript;
  scenes: SceneBreakdown[];
  dialogueLines: DialogueLine[];
  acts: Act[];
  projectId: string;
  onSceneUpdate?: (scene: SceneBreakdown) => void;
  onSceneDelete?: (sceneId: string) => void;
  onSceneCreate?: (scene: SceneBreakdown) => void;
  onScenesReorder?: (scenes: SceneBreakdown[]) => void;
  onManuscriptUpdate?: (manuscript: Manuscript) => void;
  onClose?: () => void;
}

// Status colors
const STATUS_COLORS = {
  complete: '#4caf50',
  partial: '#ff9800', 
  missing: '#f44336',
};

// Shot type colors for timeline
const SHOT_COLORS: Record<string, string> = {
  'Wide': '#e74c3c',
  'Medium': '#3498db',
  'Close-up': '#e67e22',
  'Extreme Close-up': '#9b59b6',
  'Establishing': '#1abc9c',
  'Detail': '#f39c12',
  'Two Shot': '#2ecc71',
  'Over Shoulder': '#3498db',
};

// Sortable Scene Item Component
interface SortableSceneItemProps {
  scene: SceneBreakdown;
  isSelected: boolean;
  status: string;
  statusColor: string;
  needs: { cam: boolean; light: boolean; sound: boolean };
  shots: CastingShot[];
  showTags: boolean;
  thumbnail?: string;
  onSceneClick: (scene: SceneBreakdown) => void;
}

const SortableSceneItem: FC<SortableSceneItemProps> = memo(({
  scene,
  isSelected,
  status,
  statusColor,
  needs,
  shots,
  showTags,
  thumbnail,
  onSceneClick,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: scene.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Box
      ref={setNodeRef}
      style={style}
      onClick={() => onSceneClick(scene)}
      sx={{
        px: 2,
        py: 1.5,
        display: 'flex',
        alignItems: 'center',
        cursor: isDragging ? 'grabbing' : 'pointer',
        bgcolor: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
        borderLeft: isSelected ? '3px solid #3b82f6' : '3px solid transparent',
        transition: 'all 0.15s',
        '&:hover': { 
          bgcolor: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.02)',
          transform: 'translateX(2px)',
        },
      }}
    >
      {/* Drag Handle */}
      <Box
        {...attributes}
        {...listeners}
        sx={{
          display: 'flex',
          alignItems: 'center',
          mr: 1,
          cursor: 'grab',
          color: '#6b7280',
          '&:hover': { color: '#9ca3af' },
        }}
      >
        <DragIcon sx={{ fontSize: 16 }} />
      </Box>

      {/* Scene Thumbnail/Icon */}
      <Box
        sx={{
          width: 44,
          height: 32,
          borderRadius: '6px',
          bgcolor: isSelected ? '#3b82f6' : '#1a2230',
          border: `1px solid ${isSelected ? '#3b82f6' : '#252d3d'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mr: 1.5,
          position: 'relative',
          overflow: 'hidden',
          backgroundImage: thumbnail ? `url(${thumbnail})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {!thumbnail && (
          <Typography sx={{ 
            fontSize: 11, 
            fontWeight: 700, 
            color: isSelected ? '#fff' : '#9ca3af',
          }}>
            {scene.sceneNumber}
          </Typography>
        )}
        {/* Status indicator */}
        <Box sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 3,
          bgcolor: statusColor,
        }} />
      </Box>

      {/* Scene info */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{
          fontSize: 12,
          fontWeight: isSelected ? 600 : 500,
          color: isSelected ? '#fff' : '#d1d5db',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {scene.intExt}. {scene.locationName}
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography sx={{ fontSize: 10, color: '#6b7280' }}>
            {scene.timeOfDay}
          </Typography>
          {shots.length > 0 && (
            <Typography sx={{ fontSize: 10, color: '#4b5563' }}>
              • {shots.length} shots
            </Typography>
          )}
        </Stack>
      </Box>

      {/* Needs indicator dots */}
      {showTags && (needs.cam || needs.light || needs.sound) && (
        <Stack direction="row" spacing={0.5} sx={{ ml: 1 }}>
          {needs.cam && <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#f97316' }} />}
          {needs.light && <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#fbbf24' }} />}
          {needs.sound && <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#06b6d4' }} />}
        </Stack>
      )}
    </Box>
  );
}); // End of memo for SortableSceneItem

// Debounce helper
const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
};

export const ProductionManuscriptView: FC<ProductionManuscriptViewProps> = ({
  manuscript,
  scenes,
  dialogueLines,
  acts,
  projectId,
  onSceneUpdate,
  onSceneDelete,
  onSceneCreate,
  onScenesReorder,
  onManuscriptUpdate,
  onClose,
}) => {
  // 7-Tier Responsive
  const { tier, isMobile, isTablet, isDesktop, is4K } = useScreenTier();
  const responsive = getResponsiveValues(tier);
  
  // Mobile drawer states
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileRightPanelOpen, setMobileRightPanelOpen] = useState(false);
  
  const [selectedScene, setSelectedScene] = useState<SceneBreakdown | null>(scenes[0] || null);
  const [selectedShot, setSelectedShot] = useState<CastingShot | null>(null);
  const [shotLists, setShotLists] = useState<ShotList[]>([]);
  const [expandedActs, setExpandedActs] = useState<Set<string>>(new Set(acts.map(a => a.id)));
  const [showEstimateDialog, setShowEstimateDialog] = useState(false);
  const [showNewSceneDialog, setShowNewSceneDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [sceneToDelete, setSceneToDelete] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [readThroughMode, setReadThroughMode] = useState(false);
  const [readThroughPlaying, setReadThroughPlaying] = useState(false);
  const [readThroughCurrentLine, setReadThroughCurrentLine] = useState(0);
  const [readThroughStartTime, setReadThroughStartTime] = useState<number | null>(null);
  const [readThroughNotes, setReadThroughNotes] = useState<Record<string, string>>({});
  const [showTalentPanel, setShowTalentPanel] = useState(false);
  const [sceneCandidates, setSceneCandidates] = useState<Candidate[]>([]);
  const [projectRoles, setProjectRoles] = useState<Role[]>([]);

  // Production notes state - editable notes per scene
  const [productionNotes, setProductionNotes] = useState<Record<string, { camera: string; director: string }>>({});
  const [editingProductionNote, setEditingProductionNote] = useState<{ sceneId: string; type: 'camera' | 'director' } | null>(null);
  const [productionNoteValue, setProductionNoteValue] = useState('');
  const [showAddNoteDialog, setShowAddNoteDialog] = useState(false);
  const [newNoteType, setNewNoteType] = useState<'camera' | 'director' | 'sound' | 'vfx'>('camera');

  // Scene status tracking
  const [sceneStatuses, setSceneStatuses] = useState<Record<string, 'not-started' | 'in-progress' | 'complete'>>({});

  // Manuscript zoom state
  const [manuscriptZoom, setManuscriptZoom] = useState(1); // 1 = 100%, 0.75 = 75%, 1.5 = 150%
  const [isManuscriptFullscreen, setIsManuscriptFullscreen] = useState(false);

  // Add Shot Dialog state
  const [showAddShotDialog, setShowAddShotDialog] = useState(false);
  const [addShotMode, setAddShotMode] = useState<'upload' | 'reference' | null>(null);
  const [addShotReferenceQuery, setAddShotReferenceQuery] = useState('');
  const [addShotReferenceResults, setAddShotReferenceResults] = useState<Array<{
    id: string;
    url: string;
    thumbnailUrl: string;
    source: string;
    attribution?: string;
    film?: string;
    shotType?: string;
  }>>([]);
  const [addShotLoading, setAddShotLoading] = useState(false);
  const [selectedShotImage, setSelectedShotImage] = useState<string | null>(null);

  // Timeline state
  const [timelinePlayheadPosition, setTimelinePlayheadPosition] = useState(0); // 0-100%
  const [timelineCurrentTime, setTimelineCurrentTime] = useState(0); // in seconds
  const [timelineIsPlaying, setTimelineIsPlaying] = useState(false);
  const [timelineZoom, setTimelineZoom] = useState(1); // 1 = normal, 2 = 2x zoom
  const [timelineViewMode, setTimelineViewMode] = useState<'timeline' | 'grid' | 'list'>('timeline');

  // Undo/Redo state
  const [sceneHistory, setSceneHistory] = useState<SceneBreakdown[][]>([scenes]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [selectedScenes, setSelectedScenes] = useState<Set<string>>(new Set());
  const [batchMode, setBatchMode] = useState(false);

  // Drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  // Load equipment inventory from project
  const [equipment, setEquipment] = useState<Array<{ id: string; name: string; category: string }>>([]);
  
  // Smart filtering & view modes
  const [viewMode, setViewMode] = useState<'scenes' | 'shots'>('scenes');
  const [filterMissingCamera, setFilterMissingCamera] = useState(false);
  const [filterMissingLight, setFilterMissingLight] = useState(false);
  const [filterMissingSound, setFilterMissingSound] = useState(false);
  const [showTags, setShowTags] = useState(true);
  
  // Scene needs tracking (enhanced metadata)
  const [sceneNeeds, setSceneNeeds] = useState<Record<string, { cam: boolean; light: boolean; sound: boolean }>>(
    Object.fromEntries(scenes.map((s, i) => [s.id, { cam: i % 3 === 0, light: i % 3 === 1, sound: i % 3 === 2 }]))
  );

  // Scene tagging system
  const [sceneTags, setSceneTags] = useState<Record<string, string[]>>(
    Object.fromEntries(scenes.map(s => [s.id, []]))
  );

  // ============================================
  // PRODUCTION WORKFLOW STATE
  // ============================================
  const [showLiveSetMode, setShowLiveSetMode] = useState(false);
  const [showStripboardPanel, setShowStripboardPanel] = useState(false);
  const [showShootingDayPlanner, setShowShootingDayPlanner] = useState(false);
  const [showCallSheetPreview, setShowCallSheetPreview] = useState(false);
  const [currentCallSheet, setCurrentCallSheet] = useState<CallSheet | null>(null);
  const [productionWorkflowTab, setProductionWorkflowTab] = useState<'none' | 'stripboard' | 'schedule' | 'live'>('none');
  
  // ============================================
  // WORKFLOW GAP FIXES - NEW STATE
  // ============================================
  // 1. Live Set Mode - Dynamic day selector
  const [selectedShootingDayId, setSelectedShootingDayId] = useState<string>('day-3');
  const [shootingDays, setShootingDays] = useState<ShootingDay[]>([]);
  const [showLiveSetDaySelector, setShowLiveSetDaySelector] = useState(false);
  
  // 2. Scene Needs UI Dialog
  const [showSceneNeedsDialog, setShowSceneNeedsDialog] = useState(false);
  const [editingSceneNeedsId, setEditingSceneNeedsId] = useState<string | null>(null);
  
  // 3. Schedule Scene to Stripboard Dialog
  const [showScheduleSceneDialog, setShowScheduleSceneDialog] = useState(false);
  const [sceneToSchedule, setSceneToSchedule] = useState<SceneBreakdown | null>(null);
  
  // 4. Pre-Production Checklist
  const [sceneChecklists, setSceneChecklists] = useState<Record<string, {
    locationConfirmed: boolean;
    castConfirmed: boolean;
    propsReady: boolean;
    equipmentAllocated: boolean;
    permitsObtained: boolean;
    scriptLocked: boolean;
  }>>({});
  const [showChecklistDialog, setShowChecklistDialog] = useState(false);
  
  // 5. Timeline ↔ Live Set Connection
  const [liveSetStatus, setLiveSetStatus] = useState<LiveSetStatus | null>(null);
  const [isLiveSetConnected, setIsLiveSetConnected] = useState(false);
  
  // 6. Shot Line Coverage Tracking
  const [shotLineCoverage, setShotLineCoverage] = useState<Record<string, { startLine: number; endLine: number; dialogueIds: string[] }>>({});
  const [showLineCoverageDialog, setShowLineCoverageDialog] = useState(false);
  
  // 7. Bulk Shot Generation
  const [showBulkShotDialog, setShowBulkShotDialog] = useState(false);
  const [bulkShotTemplate, setBulkShotTemplate] = useState<'standard' | 'dialogue' | 'action' | 'custom'>('standard');
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    Object.values(sceneTags).forEach(sceneTags => sceneTags.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [sceneTags]);

  // Scene sorting & filtering controls
  const [sortBy, setSortBy] = useState<'number' | 'duration' | 'date' | 'name'>('number');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [showQuickNotes, setShowQuickNotes] = useState(false);
  
  // Quick notes panel
  const [quickNotes, setQuickNotes] = useState<Record<string, string>>(
    Object.fromEntries(scenes.map(s => [s.id, '']))
  );

  // Inline shot duration editing
  const [editingShotDuration, setEditingShotDuration] = useState<string | null>(null);
  const [shotDurationValues, setShotDurationValues] = useState<Record<string, number>>(
    Object.fromEntries(
      shotLists.flatMap(list => 
        list.shots.map(shot => [shot.id, (shot.duration || 5)])
      )
    )
  );

  // Scene templates & duplication
  const [sceneTemplates, setSceneTemplates] = useState<Record<string, SceneBreakdown>>({});
  const [showSceneTemplate, setShowSceneTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');

  // Filter scenes based on search query and smart filters
  const filteredScenes = useMemo(() => {
    let filtered = scenes;
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(scene => 
        scene.sceneHeading?.toLowerCase().includes(query) ||
        scene.locationName?.toLowerCase().includes(query) ||
        scene.description?.toLowerCase().includes(query) ||
        scene.characters?.some(char => char.toLowerCase().includes(query)) ||
        scene.sceneNumber?.toLowerCase().includes(query)
      );
    }
    
    // Smart filters
    if (filterMissingCamera) {
      filtered = filtered.filter(s => sceneNeeds[s.id]?.cam === true);
    }
    if (filterMissingLight) {
      filtered = filtered.filter(s => sceneNeeds[s.id]?.light === true);
    }
    if (filterMissingSound) {
      filtered = filtered.filter(s => sceneNeeds[s.id]?.sound === true);
    }
    
    return filtered;
  }, [scenes, searchQuery, filterMissingCamera, filterMissingLight, filterMissingSound, sceneNeeds]);
  
  // Shot metadata tracking - detailed per-shot info
  const [shotMetadata, setShotMetadata] = useState<Record<string, {
    camera: { lens: string; movement: string; framing: string };
    lighting: { key: string; temp: string; ratio: string };
    sound: { mic: string; ambience: string; notes: string };
    references: string[];
    durationSec: number;
    status: 'done' | 'inProgress' | 'missing';
    thumbnailUrl?: string;
  }>>({});
  
  // Right panel state
  const [shotSelectorOpen, setShotSelectorOpen] = useState(false);
  const [shotSelectorAnchor, setShotSelectorAnchor] = useState<HTMLElement | null>(null);
  
  // Reference search state
  const [referenceSearchOpen, setReferenceSearchOpen] = useState(false);
  const [referenceSearchQuery, setReferenceSearchQuery] = useState('');

  // Auto-trigger search when reference dialog opens
  useEffect(() => {
    if (referenceSearchOpen && selectedScene) {
      const initialQuery = `${selectedScene.locationName || 'scene'} ${selectedScene.timeOfDay?.toLowerCase() || 'day'} cinematic`;
      setReferenceSearchQuery(initialQuery);
      // Trigger search using the existing search function
      searchReferenceImages(initialQuery);
    }
  }, [referenceSearchOpen, selectedScene]);
  const [referenceSearchResults, setReferenceSearchResults] = useState<Array<{
    id: string;
    url: string;
    thumbnailUrl: string;
    source: string;
    attribution?: string;
  }>>([]);
  const [referenceSearchLoading, setReferenceSearchLoading] = useState(false);
  const [uploadedReferences, setUploadedReferences] = useState<string[]>([]);
  
  // Film search state (shot.cafe integration)
  const [searchSource, setSearchSource] = useState<'all' | 'shotcafe' | 'unsplash'>('all');
  const [shotCafeResults, setShotCafeResults] = useState<Array<{
    id: string;
    title: string;
    year: string;
    slug: string;
    imageCount: number;
    thumbnail: string;
    url: string;
    cinematographer?: string;
  }>>([]);
  const [selectedFilm, setSelectedFilm] = useState<{
    title: string;
    slug: string;
    frames: Array<{ id: string; url: string; thumbnailUrl: string }>;
  } | null>(null);
  
  // Senterpanel referansebilde
  const [centerPanelReference, setCenterPanelReference] = useState<{
    url: string;
    source: string;
    title?: string;
  } | null>(null);
  
  // Editable shot properties - synced with scene metadata
  const [shotProperties, setShotProperties] = useState({
    camera: 'ARRI Alexa Mini LF',
    lens: '50mm Prime',
    rig: 'Stativ',
    shotType: 'Close-up',
    keyLight: 'Mykt sidelys',
    sideLight: 'Varm tone',
    gel: 'Gel: Warm 1/4 CTO',
    mic: 'Boom Mic',
    atmos: 'Dempet romlyd',
  });
  
  // Expanded sections state
  const [expandedSections, setExpandedSections] = useState({
    camera: true,
    lighting: true,
    audio: true,
    references: true,
  });
  
  // Editing state for inline editing
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  
  const manuscriptRef = useRef<HTMLDivElement>(null);
  const sceneRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Available cameras
  const AVAILABLE_CAMERAS = [
    'Sony FX6', 'Sony FX3', 'Sony A7S III', 'Sony Venice 2',
    'RED Komodo', 'RED V-Raptor', 'ARRI Alexa Mini LF', 'ARRI Alexa 35',
    'Blackmagic URSA Mini Pro', 'Canon C70', 'Canon R5 C', 'Panasonic S1H',
  ];

  // Get shots for a scene - must be defined before useMemo
  const getShotsForScene = (sceneId: string): CastingShot[] => {
    const shotList = shotLists.find(sl => sl.sceneId === sceneId);
    return shotList?.shots || [];
  };

  // Get selected scene shots with metadata
  const selectedSceneShots = useMemo(() => {
    if (!selectedScene) return [];
    return getShotsForScene(selectedScene.id);
  }, [selectedScene]);

  // Search shot.cafe for film references (via backend proxy to avoid CORS)
  const searchShotCafe = async (query: string) => {
    try {
      // Use backend proxy to avoid CORS issues
      const response = await fetch(
        `/api/shotcafe/search?z=nav&q=${encodeURIComponent(query)}`
      );
      
      if (!response.ok) throw new Error('shot.cafe search failed');
      
      const data = await response.json();
      const results = Array.isArray(data) ? data.map((film: any) => ({
        id: `shotcafe-${film.project || film.pslug}`,
        title: film.title,
        year: film.year,
        slug: film.pslug || film.slug,
        imageCount: film.icount || 0,
        thumbnail: `/api/shotcafe/image-proxy?url=${encodeURIComponent(`https://shot.cafe/images/t/${film.slug}`)}`,
        url: `https://shot.cafe/movie/${film.pslug}`,
        cinematographer: film.dp,
      })) : [];
      
      return results;
    } catch (error) {
      console.error('shot.cafe search error:', error);
      return [];
    }
  };

  // Search by cinematographer on shot.cafe (via backend proxy)
  const searchByCinematographer = async (name: string) => {
    try {
      const response = await fetch(
        `/api/shotcafe/search?z=cinematographers&q=${encodeURIComponent(name)}`
      );
      if (!response.ok) throw new Error('Cinematographer search failed');
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Cinematographer search error:', error);
      return [];
    }
  };

  // Load film frames from shot.cafe (via backend proxy)
  const loadFilmFrames = async (slug: string, title: string) => {
    setReferenceSearchLoading(true);
    try {
      // Fetch movie data from backend proxy
      const response = await fetch(`/api/shotcafe/movie/${slug}`);
      if (response.ok) {
        const data = await response.json();
        // Backend returns {slug, frames: [...]} where each frame has proxyUrl
        const frames = data.frames ? data.frames.map((frame: any) => ({
          id: frame.id,
          url: frame.proxyUrl || frame.url,
          thumbnailUrl: frame.proxyUrl || frame.thumbnailUrl,
        })) : [];
        
        setSelectedFilm({
          title,
          slug,
          frames: frames.length > 0 ? frames : Array.from({ length: 12 }, (_, i) => ({
            id: `frame-${slug}-${i + 1}`,
            url: `/api/shotcafe/image-proxy?url=${encodeURIComponent(`https://shot.cafe/images/${slug}/${i + 1}.jpg`)}`,
            thumbnailUrl: `/api/shotcafe/image-proxy?url=${encodeURIComponent(`https://shot.cafe/images/${slug}/${i + 1}.jpg`)}`,
          })),
        });
      } else {
        // Fallback to constructing frame URLs
        const frameUrls = Array.from({ length: 12 }, (_, i) => ({
          id: `frame-${slug}-${i + 1}`,
          url: `/api/shotcafe/image-proxy?url=${encodeURIComponent(`https://shot.cafe/images/${slug}/${i + 1}.jpg`)}`,
          thumbnailUrl: `/api/shotcafe/image-proxy?url=${encodeURIComponent(`https://shot.cafe/images/${slug}/${i + 1}.jpg`)}`,
        }));
        
        setSelectedFilm({
          title,
          slug,
          frames: frameUrls,
        });
      }
    } catch (error) {
      console.error('Failed to load film frames:', error);
    } finally {
      setReferenceSearchLoading(false);
    }
  };

  // Combined search function
  const searchReferenceImages = async (query: string) => {
    if (!query.trim()) return;
    setReferenceSearchLoading(true);
    setSelectedFilm(null);
    setShotCafeResults([]);
    setReferenceSearchResults([]);
    
    try {
      const searches: Promise<any>[] = [];
      
      // Search shot.cafe for films
      if (searchSource === 'all' || searchSource === 'shotcafe') {
        searches.push(
          searchShotCafe(query).then(results => {
            setShotCafeResults(results);
          })
        );
      }
      
      // Search Unsplash for mood/lighting references
      if (searchSource === 'all' || searchSource === 'unsplash') {
        searches.push(
          (async () => {
            try {
              const response = await fetch(
                `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query + ' cinematic film')}&per_page=12&orientation=landscape`,
                {
                  headers: {
                    'Authorization': 'Client-ID demo'
                  }
                }
              );
              
              if (!response.ok) {
                // Fallback to picsum
                const mockResults = Array.from({ length: 6 }, (_, i) => ({
                  id: `mock-${i}`,
                  url: `https://picsum.photos/seed/${query}${i}/400/225`,
                  thumbnailUrl: `https://picsum.photos/seed/${query}${i}/150/100`,
                  source: 'picsum',
                  attribution: 'Demo Image',
                }));
                setReferenceSearchResults(mockResults);
                return;
              }
              
              const data = await response.json();
              const results = data.results?.map((img: any) => ({
                id: `unsplash-${img.id}`,
                url: img.urls.regular,
                thumbnailUrl: img.urls.thumb,
                source: 'unsplash',
                attribution: `Photo by ${img.user.name}`,
              })) || [];
              setReferenceSearchResults(results);
            } catch {
              const mockResults = Array.from({ length: 6 }, (_, i) => ({
                id: `mock-${i}`,
                url: `https://picsum.photos/seed/${query}${i}/400/225`,
                thumbnailUrl: `https://picsum.photos/seed/${query}${i}/150/100`,
                source: 'picsum',
                attribution: 'Demo Image',
              }));
              setReferenceSearchResults(mockResults);
            }
          })()
        );
      }
      
      await Promise.all(searches);
    } catch (error) {
      console.error('Reference search error:', error);
    } finally {
      setReferenceSearchLoading(false);
    }
  };

  // Handle file upload for references
  const handleReferenceUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            setUploadedReferences(prev => [...prev, e.target!.result as string]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  // Load shot lists
  useEffect(() => {
    const loadShotLists = async () => {
      try {
        // Ensure mock data is initialized first
        try {
          await castingService.initializeMockData();
        } catch (error) {
          console.warn('Could not initialize mock data:', error);
        }
        
        const lists = await castingService.getShotLists(projectId);
        setShotLists(Array.isArray(lists) ? lists : []);
      } catch (error) {
        console.error('Error loading shot lists:', error);
        setShotLists([]);
      }
    };
    if (projectId) loadShotLists();
  }, [projectId]);

  // ============================================
  // WORKFLOW GAP FIX #1: Load Shooting Days for dynamic Live Set selection
  // ============================================
  useEffect(() => {
    const loadShootingDays = async () => {
      try {
        const days = await productionWorkflowService.getShootingDays(projectId);
        setShootingDays(days);
        // Auto-select today's shooting day or the first in-progress/planned day
        const today = new Date().toISOString().split('T')[0];
        const todayDay = days.find(d => d.date === today);
        const inProgressDay = days.find(d => d.status === 'in-progress');
        const plannedDay = days.find(d => d.status === 'planned');
        if (todayDay) {
          setSelectedShootingDayId(todayDay.id);
        } else if (inProgressDay) {
          setSelectedShootingDayId(inProgressDay.id);
        } else if (plannedDay) {
          setSelectedShootingDayId(plannedDay.id);
        } else if (days.length > 0) {
          setSelectedShootingDayId(days[0].id);
        }
      } catch (error) {
        console.error('Error loading shooting days:', error);
      }
    };
    if (projectId) loadShootingDays();
  }, [projectId]);

  // ============================================
  // WORKFLOW GAP FIX #5: Sync Timeline with Live Set Status
  // ============================================
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;
    
    const syncLiveSetStatus = async () => {
      if (!isLiveSetConnected || !projectId) return;
      try {
        const status = await productionWorkflowService.getLiveSetStatus(projectId);
        setLiveSetStatus(status);
        
        // Update timeline position based on live progress
        if (status.todayProgress) {
          const progress = (status.todayProgress.completedSetups / Math.max(status.todayProgress.totalSetups, 1)) * 100;
          setTimelinePlayheadPosition(progress);
        }
        
        // Auto-select current scene from Live Set
        if (status.currentScene) {
          const currentScene = scenes.find(s => s.id === status.currentScene);
          if (currentScene && currentScene.id !== selectedScene?.id) {
            setSelectedScene(currentScene);
          }
        }
      } catch (error) {
        console.error('Error syncing live set status:', error);
      }
    };
    
    if (isLiveSetConnected) {
      syncLiveSetStatus();
      intervalId = setInterval(syncLiveSetStatus, 5000); // Poll every 5 seconds
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isLiveSetConnected, projectId, scenes]);

  // ============================================
  // WORKFLOW GAP FIX #4: Initialize scene checklists
  // ============================================
  useEffect(() => {
    const initialChecklists: Record<string, any> = {};
    scenes.forEach(scene => {
      if (!sceneChecklists[scene.id]) {
        initialChecklists[scene.id] = {
          locationConfirmed: false,
          castConfirmed: false,
          propsReady: false,
          equipmentAllocated: false,
          permitsObtained: false,
          scriptLocked: false,
        };
      }
    });
    if (Object.keys(initialChecklists).length > 0) {
      setSceneChecklists(prev => ({ ...prev, ...initialChecklists }));
    }
  }, [scenes]);

  // Load equipment from project
  useEffect(() => {
    const loadEquipment = async () => {
      try {
        // Ensure mock data is initialized first
        try {
          await castingService.initializeMockData();
        } catch (error) {
          console.warn('Could not initialize mock data:', error);
        }
        
        const project = await castingService.getProject(projectId);
        if (project && project.props) {
          const allEquipment = project.props
            .filter((prop: any) => ['equipment', 'camera', 'Kamera', 'lens', 'Linse', 'rig', 'Rig', 'stabilizer', 'stativ', 'Stativ', 'tripod', 'optikk', 'Optikk'].includes(prop.category))
            .map((prop: any) => ({
              id: prop.id,
              name: prop.name,
              category: prop.category.toLowerCase(),
            }));
          setEquipment(allEquipment);
        }
        
        // Load candidates and roles for talent panel
        if (project) {
          const confirmedCandidates = (project.candidates || []).filter(
            (c: Candidate) => c.status === 'confirmed' || c.status === 'selected'
          );
          setSceneCandidates(confirmedCandidates);
          setProjectRoles(project.roles || []);
        }
      } catch (error) {
        console.error('Error loading equipment:', error);
        setEquipment([]);
      }
    };
    if (projectId) loadEquipment();
  }, [projectId]);
  
  // Get equipment by category
  const getEquipmentByCategory = (category: 'camera' | 'lens' | 'rig') => {
    const categoryMap: Record<string, string[]> = {
      camera: ['camera', 'kamera'],
      lens: ['lens', 'linse', 'optikk'],
      rig: ['rig', 'stabilizer', 'stativ', 'tripod'],
    };
    return equipment.filter(item => categoryMap[category]?.includes(item.category));
  };

  // Helper to validate camera value - returns first available if invalid
  const getValidCameraValue = (camera: string): string => {
    const inventoryCameras = getEquipmentByCategory('camera').map(c => c.name);
    const allCameras = [...inventoryCameras, ...AVAILABLE_CAMERAS];
    return allCameras.includes(camera) ? camera : AVAILABLE_CAMERAS[0];
  };
  
  // Get unique shot types from all scene shot lists
  const availableShotTypes = useMemo(() => {
    const types = new Set<string>();
    shotLists.forEach(sl => {
      sl.shots?.forEach(shot => {
        if (shot.shotType) types.add(shot.shotType);
      });
    });
    return Array.from(types);
  }, [shotLists]);

  // Get scene status
  const getSceneStatus = (scene: SceneBreakdown) => {
    const shots = getShotsForScene(scene.id);
    if (shots.length === 0) return 'missing';
    if (shots.every(s => s.cameraMovement && s.focalLength)) return 'complete';
    return 'partial';
  };

  // Get dialogue for scene
  const getSceneDialogue = (sceneId: string): DialogueLine[] => {
    return dialogueLines.filter(d => d.sceneId === sceneId);
  };

  // Toggle act
  const toggleAct = (actId: string) => {
    setExpandedActs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(actId)) newSet.delete(actId);
      else newSet.add(actId);
      return newSet;
    });
  };

  // Group scenes by act
  const scenesByAct = useMemo(() => {
    const grouped = new Map<string, SceneBreakdown[]>();
    acts.forEach(act => {
      grouped.set(act.id, scenes.filter(s => s.actId === act.id));
    });
    const scenesWithoutAct = scenes.filter(s => !s.actId);
    if (scenesWithoutAct.length > 0) grouped.set('no-act', scenesWithoutAct);
    return grouped;
  }, [scenes, acts]);

  // Navigate to scene
  const scrollToScene = (scene: SceneBreakdown) => {
    setSelectedScene(scene);
    const shots = getShotsForScene(scene.id);
    if (shots.length > 0) setSelectedShot(shots[0]);
    else setSelectedShot(null);
  };

  // Get scene metadata
  const getSceneMetadata = (scene: SceneBreakdown) => {
    const shots = getShotsForScene(scene.id);
    return {
      cameraMovement: shots[0]?.cameraMovement || '',
      lighting: shots[0]?.lightingSetup || 'Mykt sidelys, varm tone',
      audio: 'Dempet romlyd',
      lens: shots[0]?.focalLength || '50mm Prime',
      shotType: shots[0]?.shotType || '',
    };
  };

  // Sync right panel with selected scene
  useEffect(() => {
    // Auto-advance to next line during read-through if playing
    if (readThroughMode && readThroughPlaying) {
      const timer = setTimeout(() => {
        handleReadThroughNext();
      }, 3000); // 3 seconds per line
      return () => clearTimeout(timer);
    }
  }, [readThroughMode, readThroughPlaying, readThroughCurrentLine, dialogueLines]);

  // Auto-scroll to current dialogue line in read-through
  useEffect(() => {
    if (readThroughMode && manuscriptRef.current) {
      const allDialogue = scenes.flatMap(s => 
        dialogueLines.filter(d => d.sceneId === s.id)
      );
      const currentLine = allDialogue[readThroughCurrentLine];
      
      if (currentLine) {
        const selectedSceneDialog = getSceneDialogue(currentLine.sceneId);
        const localIndex = selectedSceneDialog.findIndex(d => d.id === currentLine.id);
        if (localIndex >= 0) {
          setSelectedScene(scenes.find(s => s.id === currentLine.sceneId) || null);
        }
      }
    }
  }, [readThroughCurrentLine, readThroughMode, scenes, dialogueLines]);

  // Update shot properties when scene changes (read-only sync, no save)
  useEffect(() => {
    if (selectedScene) {
      const metadata = getSceneMetadata(selectedScene);
      setShotProperties(prev => ({
        ...prev,
        // Don't overwrite camera - keep user's selection
        keyLight: metadata.lighting.split(',')[0]?.trim() || prev.keyLight,
        sideLight: metadata.lighting.split(',')[1]?.trim() || prev.sideLight,
        atmos: metadata.audio,
        lens: metadata.lens ? String(metadata.lens) : prev.lens,
        shotType: metadata.shotType || prev.shotType,
      }));
    }
  }, [selectedScene?.id]); // Only run when scene ID changes, not on every selectedScene reference change

  // Note: Shot properties auto-save is handled by the debounced effect below

  // Update shot properties when shot selection changes
  useEffect(() => {
    if (selectedShot && selectedShot.id) {
      const metadata = shotMetadata[selectedShot.id];
      // Guard against undefined or incomplete metadata
      if (metadata && metadata.camera && metadata.lighting && metadata.sound) {
        setShotProperties(prev => ({
          ...prev,
          lens: metadata.camera.lens || prev.lens,
          shotType: metadata.camera.framing || prev.shotType,
          keyLight: metadata.lighting.key || prev.keyLight,
          mic: metadata.sound.mic || prev.mic,
          atmos: metadata.sound.ambience || prev.atmos,
        }));
      }
    }
  }, [selectedShot, shotMetadata]);

  // Track which scenes have had metadata initialized
  const initializedScenesRef = useRef<Set<string>>(new Set());
  
  // Initialize shot metadata with test data (only once per scene)
  useEffect(() => {
    if (selectedScene && !initializedScenesRef.current.has(selectedScene.id)) {
      const sceneShots = getShotsForScene(selectedScene.id);
      if (sceneShots && sceneShots.length > 0) {
        initializedScenesRef.current.add(selectedScene.id);
        
        const newMetadata: Record<string, any> = {};
        sceneShots.forEach((shot, idx) => {
          // Only add if not already exists
          if (!shotMetadata[shot.id]) {
            newMetadata[shot.id] = {
              camera: {
                lens: ['50mm Prime', '35mm Prime', '85mm Prime', '24-70mm'][idx % 4],
                movement: ['Static', 'Rolig push-in', 'Dolly', 'Pan'][idx % 4],
                framing: ['Wide', 'Medium', 'Close-up', 'Extreme Close-up'][idx % 4],
              },
              lighting: {
                key: ['Mykt sidelys', 'Key light 4ft', 'Backlight only', 'Ring light'][idx % 4],
                temp: ['3200K', '5600K', '4300K', '3200K'][idx % 4],
                ratio: ['3:1', '2:1', '4:1', '1.5:1'][idx % 4],
              },
              sound: {
                mic: ['Boom Mic', 'Lav Mic', 'Wireless', 'Studio'][idx % 4],
                ambience: ['Quiet interior', 'Street traffic', 'Forest', 'Empty room'][idx % 4],
                notes: ['Monitor levels closely', 'Watch for wind', 'AC hum present', 'Clean take'][idx % 4],
              },
              references: [],
              durationSec: 30 + (idx * 5),
              status: ['done', 'inProgress', 'missing'][idx % 3] as 'done' | 'inProgress' | 'missing',
            };
          }
        });
        
        if (Object.keys(newMetadata).length > 0) {
          setShotMetadata(prev => ({ ...prev, ...newMetadata }));
        }
      }
    }
  }, [selectedScene?.id]);

  // Debounced values for auto-save
  const debouncedShotProperties = useDebounce(shotProperties, 1500);
  const debouncedSceneNeeds = useDebounce(sceneNeeds, 1500);
  
  // Track last saved values to prevent unnecessary updates
  const lastSavedPropsRef = useRef<string>('');
  const isInitialMountRef = useRef(true);
  
  // Auto-save shot properties to scene (debounced, with change detection)
  useEffect(() => {
    // Skip initial mount
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      lastSavedPropsRef.current = JSON.stringify(debouncedShotProperties);
      return;
    }
    
    if (!selectedScene || !onSceneUpdate) return;
    
    // Check if properties actually changed
    const currentPropsHash = JSON.stringify(debouncedShotProperties);
    if (currentPropsHash === lastSavedPropsRef.current) {
      return; // No change, skip save
    }
    
    lastSavedPropsRef.current = currentPropsHash;
    
    // Sync shot properties back to scene metadata
    const updatedScene: SceneBreakdown = {
      ...selectedScene,
      metadata: {
        ...selectedScene.metadata,
        camera: debouncedShotProperties.camera,
        lens: debouncedShotProperties.lens,
        rig: debouncedShotProperties.rig,
        shotType: debouncedShotProperties.shotType,
        keyLight: debouncedShotProperties.keyLight,
        sideLight: debouncedShotProperties.sideLight,
        gel: debouncedShotProperties.gel,
        mic: debouncedShotProperties.mic,
        atmos: debouncedShotProperties.atmos,
        references: uploadedReferences,
      },
    };
    onSceneUpdate(updatedScene);
    console.log('Auto-saved scene properties:', selectedScene.id);
  }, [debouncedShotProperties, selectedScene?.id, onSceneUpdate]);
  
  // Auto-save scene needs to database
  useEffect(() => {
    // Save scene needs to database with settings cache fallback
    const saveNeeds = async () => {
      try {
        await sceneNeedsService.saveSceneNeeds(projectId, debouncedSceneNeeds);
      } catch (e) {
        console.error('Could not save scene needs:', e);
      }
    };
    
    if (Object.keys(debouncedSceneNeeds).length > 0) {
      saveNeeds();
    }
  }, [debouncedSceneNeeds, projectId]);
  
  // Load scene needs from database on mount
  useEffect(() => {
    const loadNeeds = async () => {
      try {
        const saved = await sceneNeedsService.getSceneNeeds(projectId);
        if (saved && Object.keys(saved).length > 0) {
          setSceneNeeds(saved);
        }
      } catch (e) {
        console.error('Could not load scene needs:', e);
      }
    };
    
    loadNeeds();
  }, [projectId]);

  // Handle escape key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isManuscriptFullscreen) {
        setIsManuscriptFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isManuscriptFullscreen]);

  // Build timeline data
  const timelineData = useMemo(() => {
    const blocks: Array<{
      shot: CastingShot;
      scene: SceneBreakdown;
      color: string;
      width: number;
      label: string;
    }> = [];
    
    let totalDuration = 0;
    scenes.forEach(scene => {
      const shots = getShotsForScene(scene.id);
      shots.forEach((shot, idx) => {
        totalDuration += shot.duration || 10;
      });
      if (shots.length === 0) totalDuration += 60;
    });

    scenes.forEach(scene => {
      const shots = getShotsForScene(scene.id);
      if (shots.length === 0) {
        blocks.push({
          shot: {} as CastingShot,
          scene,
          color: 'rgba(100,100,100,0.3)',
          width: (60 / totalDuration) * 100,
          label: '',
        });
      } else {
        shots.forEach((shot, idx) => {
          blocks.push({
            shot,
            scene,
            color: SHOT_COLORS[shot.shotType] || '#666',
            width: ((shot.duration || 10) / totalDuration) * 100,
            label: `SHOT ${idx + 1}`,
          });
        });
      }
    });

    return { blocks, totalDuration };
  }, [scenes, shotLists]);

  const selectedSceneMetadata = selectedScene ? getSceneMetadata(selectedScene) : null;
  const selectedSceneDialogue = selectedScene ? getSceneDialogue(selectedScene.id) : [];

  // Scene creation handler
  const handleCreateScene = () => {
    const newScene: SceneBreakdown = {
      id: `scene-${Date.now()}`,
      manuscriptId: manuscript.id,
      projectId,
      sceneNumber: String(scenes.length + 1),
      sceneHeading: 'NY SCENE',
      locationName: 'Lokasjon',
      intExt: 'INT',
      timeOfDay: 'DAY',
      characters: [],
      status: 'not-scheduled',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    if (onSceneCreate) {
      onSceneCreate(newScene);
      setSelectedScene(newScene);
    }
    setShowNewSceneDialog(false);
  };

  // Scene deletion handler
  const handleDeleteScene = () => {
    if (!sceneToDelete) return;
    
    if (onSceneDelete) {
      onSceneDelete(sceneToDelete);
      
      // Select next/previous scene
      const idx = scenes.findIndex(s => s.id === sceneToDelete);
      const nextScene = scenes[idx + 1] || scenes[idx - 1] || null;
      setSelectedScene(nextScene);
    }
    
    setShowDeleteConfirm(false);
    setSceneToDelete(null);
  };

  // Handle scene reordering via drag-and-drop
  const handleSceneReorder = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id || !onScenesReorder) return;
    
    const oldIndex = scenes.findIndex(s => s.id === active.id);
    const newIndex = scenes.findIndex(s => s.id === over.id);
    
    if (oldIndex === -1 || newIndex === -1) return;
    
    const reorderedScenes = arrayMove(scenes, oldIndex, newIndex);
    
    // Renumber scenes
    const renumberedScenes = reorderedScenes.map((scene, index) => ({
      ...scene,
      sceneNumber: (index + 1).toString(),
    }));
    
    addToHistory(renumberedScenes);
    onScenesReorder(renumberedScenes);
  };

  // Handle export production data
  const handleExportProduction = () => {
    const productionData = {
      manuscript: {
        title: manuscript.title,
        author: manuscript.author,
        exportDate: new Date().toISOString(),
      },
      scenes: scenes.map(scene => ({
        sceneNumber: scene.sceneNumber,
        sceneHeading: scene.sceneHeading,
        locationName: scene.locationName,
        timeOfDay: scene.timeOfDay,
        description: scene.description,
        characters: scene.characters,
        metadata: scene.metadata,
      })),
      shotLists: shotLists.map(list => ({
        sceneId: list.sceneId,
        shots: list.shots.map(shot => ({
          id: shot.id,
          shotType: shot.shotType,
          description: shot.description,
        })),
      })),
      totalScenes: scenes.length,
      totalShots: shotLists.reduce((acc, list) => acc + list.shots.length, 0),
    };
    
    const dataStr = JSON.stringify(productionData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${manuscript.title.replace(/\s+/g, '_')}_production_data.json`;
    link.click();
    URL.revokeObjectURL(url);
    setShowExportDialog(false);
  };

  // Read Through handlers
  const handleReadThroughToggle = () => {
    setReadThroughMode(!readThroughMode);
    setReadThroughPlaying(false);
    setReadThroughCurrentLine(0);
    setReadThroughStartTime(null);
  };

  const handleReadThroughPlay = () => {
    if (!readThroughPlaying) {
      setReadThroughStartTime(Date.now());
    }
    setReadThroughPlaying(!readThroughPlaying);
  };

  const handleReadThroughNext = () => {
    const allDialogue = scenes.flatMap(s => 
      dialogueLines.filter(d => d.sceneId === s.id)
    );
    if (readThroughCurrentLine < allDialogue.length - 1) {
      setReadThroughCurrentLine(readThroughCurrentLine + 1);
    }
  };

  const handleReadThroughPrevious = () => {
    if (readThroughCurrentLine > 0) {
      setReadThroughCurrentLine(readThroughCurrentLine - 1);
    }
  };

  // Timeline handlers
  const handleTimelinePlay = () => {
    setTimelineIsPlaying(!timelineIsPlaying);
  };

  const handleTimelineSeek = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = (clickX / rect.width) * 100;
    setTimelinePlayheadPosition(Math.max(0, Math.min(100, percentage)));
    setTimelineCurrentTime((percentage / 100) * timelineData.totalDuration);
  };

  const handleTimelineZoomIn = () => {
    setTimelineZoom(prev => Math.min(prev + 0.5, 4));
  };

  const handleTimelineZoomOut = () => {
    setTimelineZoom(prev => Math.max(prev - 0.5, 0.5));
  };

  const handleTimelineViewChange = (mode: 'timeline' | 'grid' | 'list') => {
    setTimelineViewMode(mode);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const getTotalDuration = (): number => {
    return timelineData.totalDuration;
  };

  const getOvertimeDuration = (): string => {
    const standardDay = 8 * 60 * 60; // 8 hours in seconds
    const overtime = timelineData.totalDuration - standardDay;
    if (overtime <= 0) return '0:00';
    const hours = Math.floor(overtime / 3600);
    const mins = Math.floor((overtime % 3600) / 60);
    return `${hours}:${String(mins).padStart(2, '0')}`;
  };

  // Auto-play timeline
  useEffect(() => {
    if (!timelineIsPlaying) return;
    
    const interval = setInterval(() => {
      setTimelineCurrentTime(prev => {
        const next = prev + 0.1;
        if (next >= timelineData.totalDuration) {
          setTimelineIsPlaying(false);
          return 0;
        }
        return next;
      });
      setTimelinePlayheadPosition(prev => {
        const next = prev + (0.1 / timelineData.totalDuration) * 100;
        if (next >= 100) {
          return 0;
        }
        return next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [timelineIsPlaying, timelineData.totalDuration]);

  // Production notes handlers
  const handleEditProductionNote = (sceneId: string, type: 'camera' | 'director') => {
    const currentNote = productionNotes[sceneId]?.[type] || '';
    setEditingProductionNote({ sceneId, type });
    setProductionNoteValue(currentNote);
  };

  const handleSaveProductionNote = () => {
    if (!editingProductionNote) return;
    const { sceneId, type } = editingProductionNote;
    setProductionNotes(prev => ({
      ...prev,
      [sceneId]: {
        ...prev[sceneId],
        [type]: productionNoteValue,
      },
    }));
    setEditingProductionNote(null);
    setProductionNoteValue('');
  };

  const handleCancelProductionNote = () => {
    setEditingProductionNote(null);
    setProductionNoteValue('');
  };

  // Scene status handlers
  const handleSetSceneStatus = (sceneId: string, status: 'not-started' | 'in-progress' | 'complete') => {
    setSceneStatuses(prev => ({
      ...prev,
      [sceneId]: status,
    }));
    // Also update the scene if callback exists
    if (onSceneUpdate) {
      const scene = scenes.find(s => s.id === sceneId);
      if (scene) {
        // Map UI status to valid scene status
        const sceneStatus: 'not-scheduled' | 'scheduled' | 'shot' | 'in-post' | 'completed' = 
          status === 'complete' ? 'completed' : 
          status === 'in-progress' ? 'shot' : 
          'not-scheduled';
        onSceneUpdate({
          ...scene,
          status: sceneStatus,
        });
      }
    }
  };

  // Copy shot settings to next shot
  const handleCopySettingsToNextShot = () => {
    if (!selectedShot || !selectedScene) return;
    const sceneShots = getShotsForScene(selectedScene.id);
    const currentIdx = sceneShots.findIndex(s => s.id === selectedShot.id);
    if (currentIdx >= 0 && currentIdx < sceneShots.length - 1) {
      const nextShot = sceneShots[currentIdx + 1];
      setShotMetadata(prev => ({
        ...prev,
        [nextShot.id]: {
          ...prev[nextShot.id],
          camera: prev[selectedShot.id]?.camera || { lens: shotProperties.lens, movement: '', framing: shotProperties.shotType },
          lighting: prev[selectedShot.id]?.lighting || { key: shotProperties.keyLight, temp: '', ratio: '' },
          sound: prev[selectedShot.id]?.sound || { mic: shotProperties.mic, ambience: shotProperties.atmos, notes: '' },
        },
      }));
      // Select the next shot
      setSelectedShot(nextShot);
    }
  };

  // Save shot settings as preset
  const [savedPresets, setSavedPresets] = useState<Record<string, typeof shotProperties>>({});
  const [showSavePresetDialog, setShowSavePresetDialog] = useState(false);
  const [presetName, setPresetName] = useState('');

  const handleSaveAsPreset = () => {
    if (!presetName.trim()) return;
    setSavedPresets(prev => ({
      ...prev,
      [presetName]: { ...shotProperties },
    }));
    setShowSavePresetDialog(false);
    setPresetName('');
  };

  const handleLoadPreset = (name: string) => {
    const preset = savedPresets[name];
    if (preset) {
      setShotProperties(preset);
    }
  };

  // Add new shot to scene - opens dialog
  const handleAddNewShot = () => {
    if (!selectedScene) return;
    setShowAddShotDialog(true);
    setAddShotMode(null);
    setSelectedShotImage(null);
    setAddShotReferenceQuery('');
    setAddShotReferenceResults([]);
  };

  // Actually create the shot with image
  const handleCreateShot = (imageUrl?: string) => {
    if (!selectedScene) return;
    const now = new Date().toISOString();
    const newShot: CastingShot = {
      id: `shot-${Date.now()}`,
      sceneId: selectedScene.id,
      roleId: '',
      shotType: 'Medium',
      description: 'Ny shot',
      cameraAngle: 'Eye Level',
      cameraMovement: 'Static',
      focalLength: 50,
      duration: 5,
      notes: '',
      createdAt: now,
      updatedAt: now,
    };
    // Add to shot lists
    setShotLists(prev => {
      const existingList = prev.find(l => l.sceneId === selectedScene.id);
      if (existingList) {
        return prev.map(l => 
          l.sceneId === selectedScene.id 
            ? { ...l, shots: [...l.shots, newShot] }
            : l
        );
      } else {
        return [...prev, {
          id: `shot-list-${Date.now()}`,
          projectId,
          sceneId: selectedScene.id,
          shots: [newShot],
          equipment: [],
          createdAt: now,
          updatedAt: now,
        }];
      }
    });
    // Store the image URL in shot metadata if provided
    if (imageUrl) {
      setShotMetadata(prev => ({
        ...prev,
        [newShot.id]: {
          ...prev[newShot.id],
          thumbnailUrl: imageUrl,
        },
      }));
    }
    setSelectedShot(newShot);
    setShowAddShotDialog(false);
    setAddShotMode(null);
    setSelectedShotImage(null);
  };

  // Handle file upload for new shot
  const handleShotImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setSelectedShotImage(e.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Search for reference shots
  const handleSearchReferenceShots = async () => {
    if (!addShotReferenceQuery.trim()) return;
    setAddShotLoading(true);
    
    try {
      // Search shot.cafe
      const shotCafeResults = await searchShotCafe(addShotReferenceQuery);
      
      // Also get some cinematic images from Unsplash/Picsum as fallback
      const mockImages = Array.from({ length: 6 }, (_, i) => ({
        id: `ref-${i}`,
        url: `https://picsum.photos/seed/${addShotReferenceQuery}${i}/400/225`,
        thumbnailUrl: `https://picsum.photos/seed/${addShotReferenceQuery}${i}/150/100`,
        source: 'picsum',
        attribution: 'Reference Image',
      }));
      
      // Combine results - shot.cafe films get priority (use film thumbnails)
      const allResults = [
        ...shotCafeResults.map(film => ({
          id: film.id,
          url: film.thumbnail,
          thumbnailUrl: film.thumbnail,
          source: 'shot.cafe',
          film: film.title,
          shotType: film.cinematographer,
        })),
        ...mockImages,
      ];
      
      setAddShotReferenceResults(allResults);
    } catch (error) {
      console.error('Reference search error:', error);
      // Fallback to mock images
      const mockImages = Array.from({ length: 8 }, (_, i) => ({
        id: `ref-${i}`,
        url: `https://picsum.photos/seed/${addShotReferenceQuery}${i}/400/225`,
        thumbnailUrl: `https://picsum.photos/seed/${addShotReferenceQuery}${i}/150/100`,
        source: 'picsum',
        attribution: 'Reference Image',
      }));
      setAddShotReferenceResults(mockImages);
    } finally {
      setAddShotLoading(false);
    }
  };

  // Manuscript zoom handlers
  const handleManuscriptZoomIn = () => {
    setManuscriptZoom(prev => Math.min(prev + 0.25, 2)); // Max 200%
  };

  const handleManuscriptZoomOut = () => {
    setManuscriptZoom(prev => Math.max(prev - 0.25, 0.5)); // Min 50%
  };

  const handleManuscriptFullscreen = () => {
    setIsManuscriptFullscreen(prev => !prev);
  };

  const handleAddReadThroughNote = (sceneId: string, note: string) => {
    setReadThroughNotes(prev => ({
      ...prev,
      [sceneId]: note,
    }));
  };

  // ============================================
  // WORKFLOW GAP FIX #2: Scene Needs Handlers
  // ============================================
  const handleUpdateSceneNeeds = (sceneId: string, needs: { cam: boolean; light: boolean; sound: boolean }) => {
    setSceneNeeds(prev => ({
      ...prev,
      [sceneId]: needs,
    }));
  };

  const handleOpenSceneNeedsDialog = (sceneId: string) => {
    setEditingSceneNeedsId(sceneId);
    setShowSceneNeedsDialog(true);
  };

  // ============================================
  // WORKFLOW GAP FIX #3: Schedule Scene to Stripboard
  // ============================================
  const handleScheduleScene = async (sceneId: string, dayId: string) => {
    try {
      await productionWorkflowService.assignSceneToDay(sceneId, dayId);
      // Update local scene status
      const scene = scenes.find(s => s.id === sceneId);
      if (scene && onSceneUpdate) {
        onSceneUpdate({
          ...scene,
          status: 'scheduled',
        });
      }
      setShowScheduleSceneDialog(false);
      setSceneToSchedule(null);
    } catch (error) {
      console.error('Failed to schedule scene:', error);
    }
  };

  const handleOpenScheduleDialog = (scene: SceneBreakdown) => {
    setSceneToSchedule(scene);
    setShowScheduleSceneDialog(true);
  };

  // ============================================
  // WORKFLOW GAP FIX #4: Pre-Production Checklist Handlers
  // ============================================
  const handleUpdateChecklist = (sceneId: string, field: keyof typeof sceneChecklists[string], value: boolean) => {
    setSceneChecklists(prev => ({
      ...prev,
      [sceneId]: {
        ...prev[sceneId],
        [field]: value,
      },
    }));
  };

  const getChecklistProgress = (sceneId: string): number => {
    const checklist = sceneChecklists[sceneId];
    if (!checklist) return 0;
    const total = 6;
    const completed = Object.values(checklist).filter(Boolean).length;
    return Math.round((completed / total) * 100);
  };

  // ============================================
  // WORKFLOW GAP FIX #6: Scene Status Sync with Stripboard
  // ============================================
  const handleSyncStatusWithStripboard = async (sceneId: string, status: 'not-scheduled' | 'scheduled' | 'shot' | 'in-post' | 'completed') => {
    try {
      // Update local state
      const scene = scenes.find(s => s.id === sceneId);
      if (scene && onSceneUpdate) {
        onSceneUpdate({ ...scene, status });
      }
      
      // Sync with stripboard
      const stripStatus = status === 'completed' ? 'shot' : status === 'scheduled' ? 'scheduled' : 'not-scheduled';
      await productionWorkflowService.assignSceneToDay(
        sceneId, 
        status === 'not-scheduled' ? null : selectedShootingDayId
      );
      
      // Update scene statuses local tracker
      const uiStatus = status === 'completed' ? 'complete' : status === 'shot' ? 'in-progress' : 'not-started';
      setSceneStatuses(prev => ({
        ...prev,
        [sceneId]: uiStatus as 'not-started' | 'in-progress' | 'complete',
      }));
    } catch (error) {
      console.error('Failed to sync status with stripboard:', error);
    }
  };

  // ============================================
  // WORKFLOW GAP FIX #7: Bulk Shot Generation
  // ============================================
  const SHOT_TEMPLATES: Record<string, Array<{ shotType: ShotType; description: string; duration: number }>> = {
    standard: [
      { shotType: 'Wide', description: 'Establishing shot', duration: 5 },
      { shotType: 'Medium', description: 'Two-shot or medium coverage', duration: 8 },
      { shotType: 'Close-up', description: 'Close-up reaction', duration: 4 },
    ],
    dialogue: [
      { shotType: 'Wide', description: 'Master shot - full scene coverage', duration: 60 },
      { shotType: 'Medium', description: 'Character A - OTS from B', duration: 30 },
      { shotType: 'Medium', description: 'Character B - OTS from A', duration: 30 },
      { shotType: 'Close-up', description: 'Character A close-up', duration: 15 },
      { shotType: 'Close-up', description: 'Character B close-up', duration: 15 },
      { shotType: 'Detail', description: 'Insert/cutaway', duration: 5 },
    ],
    action: [
      { shotType: 'Wide', description: 'Establishing action geography', duration: 5 },
      { shotType: 'Medium', description: 'Action coverage 1', duration: 10 },
      { shotType: 'Medium', description: 'Action coverage 2', duration: 10 },
      { shotType: 'Close-up', description: 'Detail/impact shot', duration: 3 },
      { shotType: 'Close-up', description: 'Reaction shot', duration: 4 },
      { shotType: 'Wide', description: 'Resolution/aftermath', duration: 5 },
    ],
    custom: [],
  };

  const handleGenerateBulkShots = (sceneId: string, template: keyof typeof SHOT_TEMPLATES) => {
    const templateShots = SHOT_TEMPLATES[template];
    if (!templateShots.length) return;

    const now = new Date().toISOString();
    const newShots: CastingShot[] = templateShots.map((tmpl, idx) => ({
      id: `shot-${sceneId}-${Date.now()}-${idx}`,
      sceneId,
      roleId: '',
      shotType: tmpl.shotType as ShotType,
      description: tmpl.description,
      cameraAngle: 'Eye Level' as const,
      cameraMovement: 'Static' as const,
      focalLength: tmpl.shotType === 'Wide' ? 24 : tmpl.shotType === 'Close-up' ? 85 : 50,
      duration: tmpl.duration,
      notes: '',
      createdAt: now,
      updatedAt: now,
    }));

    // Add to shot lists
    setShotLists(prev => {
      const existingList = prev.find(l => l.sceneId === sceneId);
      if (existingList) {
        return prev.map(l => 
          l.sceneId === sceneId 
            ? { ...l, shots: [...l.shots, ...newShots] }
            : l
        );
      } else {
        return [...prev, {
          id: `shot-list-${Date.now()}`,
          projectId,
          sceneId,
          shots: newShots,
          equipment: [],
          createdAt: now,
          updatedAt: now,
        }];
      }
    });

    setShowBulkShotDialog(false);
  };

  // ============================================
  // WORKFLOW GAP FIX #8: Shot Line Coverage
  // ============================================
  const handleUpdateShotLineCoverage = (shotId: string, startLine: number, endLine: number, dialogueIds: string[]) => {
    setShotLineCoverage(prev => ({
      ...prev,
      [shotId]: { startLine, endLine, dialogueIds },
    }));
  };

  const getShotCoverageForDialogue = (dialogueId: string): string[] => {
    return Object.entries(shotLineCoverage)
      .filter(([_, coverage]) => coverage.dialogueIds.includes(dialogueId))
      .map(([shotId]) => shotId);
  };

  const getUncoveredDialogue = (sceneId: string): DialogueLine[] => {
    const sceneDialogue = dialogueLines.filter(d => d.sceneId === sceneId);
    const coveredIds = new Set(
      Object.values(shotLineCoverage).flatMap(c => c.dialogueIds)
    );
    return sceneDialogue.filter(d => !coveredIds.has(d.id));
  };

  // Undo/Redo handlers
  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      if (onScenesReorder) {
        onScenesReorder(sceneHistory[newIndex]);
      }
    }
  };

  const handleRedo = () => {
    if (historyIndex < sceneHistory.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      if (onScenesReorder) {
        onScenesReorder(sceneHistory[newIndex]);
      }
    }
  };

  const addToHistory = (newScenes: SceneBreakdown[]) => {
    const newHistory = sceneHistory.slice(0, historyIndex + 1);
    newHistory.push(newScenes);
    setSceneHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  // Batch operations
  const handleToggleSceneSelection = (sceneId: string) => {
    if (!batchMode) {
      setBatchMode(true);
      setSelectedScenes(new Set([sceneId]));
    } else {
      setSelectedScenes(prev => {
        const newSet = new Set(prev);
        if (newSet.has(sceneId)) newSet.delete(sceneId);
        else newSet.add(sceneId);
        return newSet;
      });
    }
  };

  const handleBatchDelete = () => {
    if (selectedScenes.size === 0 || !onSceneDelete) return;
    if (window.confirm(`Delete ${selectedScenes.size} selected scenes?`)) {
      selectedScenes.forEach(sceneId => onSceneDelete(sceneId));
      setSelectedScenes(new Set());
      setBatchMode(false);
    }
  };

  const handleBatchExport = () => {
    const selectedScenesList = scenes.filter(s => selectedScenes.has(s.id));
    const data = {
      scenes: selectedScenesList,
      count: selectedScenesList.length,
      exportDate: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `selected_scenes_${selectedScenes.size}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const validateSceneNumber = (sceneNumber: string): string | null => {
    const duplicate = scenes.find(s => s.sceneNumber === sceneNumber && s.id !== selectedScene?.id);
    if (duplicate) {
      return `Scene ${sceneNumber} already exists`;
    }
    if (!/^\d+[A-Z]?$/.test(sceneNumber)) {
      return 'Scene number must be a number optionally followed by a letter (e.g., 5 or 5A)';
    }
    return null;
  };

  // Scene tagging handlers
  const handleAddTag = (sceneId: string, tag: string) => {
    if (!tag.trim()) return;
    setSceneTags(prev => ({
      ...prev,
      [sceneId]: [...(prev[sceneId] || []), tag.trim()],
    }));
  };

  const handleRemoveTag = (sceneId: string, tag: string) => {
    setSceneTags(prev => ({
      ...prev,
      [sceneId]: (prev[sceneId] || []).filter(t => t !== tag),
    }));
  };

  // Sorting and filtering
  const getSortedAndFilteredScenes = (): SceneBreakdown[] => {
    let result = [...scenes];

    // Filter by tags
    if (selectedTags.size > 0) {
      result = result.filter(scene => 
        (sceneTags[scene.id] || []).some(tag => selectedTags.has(tag))
      );
    }

    // Filter by scene needs
    if (filterMissingCamera) {
      result = result.filter(s => sceneNeeds[s.id]?.cam);
    }
    if (filterMissingLight) {
      result = result.filter(s => sceneNeeds[s.id]?.light);
    }
    if (filterMissingSound) {
      result = result.filter(s => sceneNeeds[s.id]?.sound);
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'number':
          comparison = parseInt(a.sceneNumber) - parseInt(b.sceneNumber);
          break;
        case 'duration': {
          const aDuration = shotLists.find(l => l.sceneId === a.id)?.shots.reduce((sum, shot) => sum + (shot.duration || 5), 0) || 0;
          const bDuration = shotLists.find(l => l.sceneId === b.id)?.shots.reduce((sum, shot) => sum + (shot.duration || 5), 0) || 0;
          comparison = aDuration - bDuration;
          break;
        }
        case 'date':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'name':
          comparison = (a.sceneHeading || '').localeCompare(b.sceneHeading || '');
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  };

  // Scene duplication
  const handleDuplicateScene = (scene: SceneBreakdown) => {
    const newScene: SceneBreakdown = {
      ...scene,
      id: `scene-${Date.now()}`,
      sceneNumber: `${parseInt(scene.sceneNumber) + 1}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    if (onSceneCreate) {
      onSceneCreate(newScene);
      setSelectedScene(newScene);
      // Duplicate associated shot list
      const originalShotList = shotLists.find(l => l.sceneId === scene.id);
      if (originalShotList) {
        const duplicatedShots = originalShotList.shots.map(shot => ({
          ...shot,
          id: `shot-${Date.now()}-${Math.random()}`,
        }));
      }
    }
  };

  // Save as template
  const handleSaveTemplate = () => {
    if (!selectedScene || !templateName.trim()) return;
    setSceneTemplates(prev => ({
      ...prev,
      [templateName]: selectedScene,
    }));
    setTemplateName('');
    setShowSceneTemplate(false);
  };

  // Load from template
  const handleLoadTemplate = (templateName: string) => {
    const template = sceneTemplates[templateName];
    if (!template || !onSceneCreate) return;
    
    const newScene: SceneBreakdown = {
      ...template,
      id: `scene-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    onSceneCreate(newScene);
    setSelectedScene(newScene);
  };

  // Quick notes
  const handleQuickNoteChange = (sceneId: string, note: string) => {
    setQuickNotes(prev => ({
      ...prev,
      [sceneId]: note,
    }));
  };

  // Inline shot duration editing
  const handleUpdateShotDuration = (shotId: string, duration: number) => {
    setShotDurationValues(prev => ({
      ...prev,
      [shotId]: Math.max(1, duration),
    }));
  };

  // PDF Export
  const handlePDFExport = () => {
    const scriptContent = scenes.map((scene, idx) => {
      const shots = shotLists.find(l => l.sceneId === scene.id)?.shots || [];
      return `
SCENE ${scene.sceneNumber}
${scene.sceneHeading}
${scene.intExt} - ${scene.locationName} - ${scene.timeOfDay}

${scene.description || 'No description'}

CHARACTERS: ${scene.characters?.join(', ') || 'None'}

SHOTS:
${shots.map((s, i) => `${i + 1}. ${s.shotType} - ${s.description} (${shotDurationValues[s.id] || 5}s)`).join('\n')}

NOTES: ${quickNotes[scene.id] || 'No notes'}

---
`;
    }).join('\n');

    const blob = new Blob([scriptContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${manuscript.title}_script.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Call sheet generation
  const handleGenerateCallSheet = () => {
    const callSheet = {
      title: manuscript.title,
      date: new Date().toLocaleDateString(),
      scenes: scenes.map(scene => {
        const shots = shotLists.find(l => l.sceneId === scene.id)?.shots || [];
        return {
          sceneNumber: scene.sceneNumber,
          heading: scene.sceneHeading,
          location: scene.locationName,
          time: scene.timeOfDay,
          duration: shots.reduce((sum, shot) => sum + (shotDurationValues[shot.id] || 5), 0),
          cast: scene.characters || [],
          equipment: scene.metadata?.equipment || [],
          notes: quickNotes[scene.id] || '',
        };
      }),
      totalDuration: scenes.reduce((sum, scene) => {
        const shots = shotLists.find(l => l.sceneId === scene.id)?.shots || [];
        return sum + shots.reduce((s, shot) => s + (shotDurationValues[shot.id] || 5), 0);
      }, 0),
    };

    const blob = new Blob([JSON.stringify(callSheet, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `call_sheet_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Space: Play/Pause timeline
      if (e.code === 'Space') {
        e.preventDefault();
        handleTimelinePlay();
      }
      // Arrow keys: Navigate scenes
      else if (e.code === 'ArrowUp' && selectedScene) {
        e.preventDefault();
        const currentIndex = scenes.findIndex(s => s.id === selectedScene.id);
        if (currentIndex > 0) scrollToScene(scenes[currentIndex - 1]);
      }
      else if (e.code === 'ArrowDown' && selectedScene) {
        e.preventDefault();
        const currentIndex = scenes.findIndex(s => s.id === selectedScene.id);
        if (currentIndex < scenes.length - 1) scrollToScene(scenes[currentIndex + 1]);
      }
      // Ctrl/Cmd + Z: Undo
      else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y: Redo
      else if ((e.ctrlKey || e.metaKey) && (e.shiftKey && e.code === 'KeyZ' || e.code === 'KeyY')) {
        e.preventDefault();
        handleRedo();
      }
      // Delete: Delete selected scene(s)
      else if (e.code === 'Delete' && (batchMode ? selectedScenes.size > 0 : selectedScene)) {
        e.preventDefault();
        if (batchMode) {
          handleBatchDelete();
        } else if (selectedScene && onSceneDelete) {
          setSceneToDelete(selectedScene.id);
          setShowDeleteConfirm(true);
        }
      }
      // Ctrl/Cmd + A: Select all scenes (batch mode)
      else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyA') {
        e.preventDefault();
        setBatchMode(true);
        setSelectedScenes(new Set(scenes.map(s => s.id)));
      }
      // Ctrl/Cmd + D: Duplicate selected scene
      else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyD' && selectedScene) {
        e.preventDefault();
        handleDuplicateScene(selectedScene);
      }
      // Ctrl/Cmd + T: Toggle quick notes
      else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyT') {
        e.preventDefault();
        setShowQuickNotes(!showQuickNotes);
      }
      // Ctrl/Cmd + S: Save scene as template
      else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS' && selectedScene) {
        e.preventDefault();
        setShowSceneTemplate(true);
      }
      // Ctrl/Cmd + E: Export as PDF
      else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyE' && !e.shiftKey) {
        e.preventDefault();
        handlePDFExport();
      }
      // Ctrl/Cmd + Shift + E: Export call sheet
      else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyE') {
        e.preventDefault();
        handleGenerateCallSheet();
      }
      // Escape: Clear selection / exit batch mode / close panels
      else if (e.code === 'Escape') {
        if (batchMode) {
          setBatchMode(false);
          setSelectedScenes(new Set());
        }
        if (showQuickNotes) {
          setShowQuickNotes(false);
        }
        if (showSceneTemplate) {
          setShowSceneTemplate(false);
          setTemplateName('');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedScene, scenes, batchMode, selectedScenes, timelineIsPlaying, showQuickNotes, showSceneTemplate]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#1a1f2e' }}>
      {/* Header with close button */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: responsive.headerPx,
          py: responsive.headerPy,
          bgcolor: '#0c0f14',
          borderBottom: '1px solid #2a3142',
          flexWrap: isMobile ? 'wrap' : 'nowrap',
          gap: isMobile ? 1 : 0,
        }}
      >
        <Stack direction="row" spacing={isMobile ? 1 : 2} alignItems="center">
          {/* Mobile menu button */}
          {isMobile && (
            <IconButton
              onClick={() => setMobileSidebarOpen(true)}
              sx={{ color: '#9ca3af', p: 0.5 }}
            >
              <SceneIcon sx={{ fontSize: responsive.iconSize }} />
            </IconButton>
          )}
          <Typography sx={{ fontSize: responsive.titleFontSize, fontWeight: 600, color: '#fff', letterSpacing: isMobile ? 0.5 : 1 }}>
            {isMobile ? 'PRODUCTION' : 'PRODUCTION MANUSCRIPT'}
          </Typography>
          {!isMobile && (
            <Tooltip title={
              <Box sx={{ p: 0.5 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 600, mb: 1 }}>Keyboard Shortcuts</Typography>
                <Typography sx={{ fontSize: 10 }}>Space: Play/Pause timeline</Typography>
                <Typography sx={{ fontSize: 10 }}>↑/↓: Navigate scenes</Typography>
                <Typography sx={{ fontSize: 10 }}>Ctrl+Z: Undo</Typography>
                <Typography sx={{ fontSize: 10 }}>Ctrl+Shift+Z: Redo</Typography>
                <Typography sx={{ fontSize: 10 }}>Ctrl+A: Select all</Typography>
                <Typography sx={{ fontSize: 10 }}>Delete: Delete scene(s)</Typography>
                <Typography sx={{ fontSize: 10 }}>Esc: Clear selection</Typography>
              </Box>
            }>
              <Box sx={{
                px: 1,
                py: 0.5,
                borderRadius: '4px',
                bgcolor: 'rgba(255,255,255,0.05)',
                cursor: 'help',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
              }}>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <ZoomInIcon sx={{ fontSize: 12, color: '#9ca3af' }} />
                  <Typography sx={{ fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>SHORTCUTS</Typography>
                </Stack>
              </Box>
            </Tooltip>
          )}
        </Stack>
        
        <Stack direction="row" spacing={isMobile ? 0.5 : 1} alignItems="center" flexWrap="wrap" useFlexGap>
          {/* Read Through Mode Toggle */}
          <Tooltip title={readThroughMode ? "Avslutt Read Through" : "Start Read Through"}>
            <IconButton
              onClick={handleReadThroughToggle}
              size={responsive.buttonSize}
              sx={{
                color: readThroughMode ? '#10b981' : '#6b7280',
                bgcolor: readThroughMode ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                '&:hover': { 
                  color: '#10b981', 
                  bgcolor: 'rgba(16, 185, 129, 0.15)' 
                },
                p: isMobile ? 0.5 : 1,
              }}
            >
              <ReadThroughIcon sx={{ fontSize: responsive.iconSize }} />
            </IconButton>
          </Tooltip>

          {/* Talent Panel Toggle */}
          <Tooltip title={showTalentPanel ? "Skjul Cast" : "Vis Cast"}>
            <Badge badgeContent={isMobile ? 0 : sceneCandidates.length} color="primary">
              <IconButton
                onClick={() => isMobile ? setMobileRightPanelOpen(true) : setShowTalentPanel(!showTalentPanel)}
                size={responsive.buttonSize}
                sx={{
                  color: showTalentPanel ? '#3b82f6' : '#6b7280',
                  bgcolor: showTalentPanel ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                  '&:hover': { 
                    color: '#3b82f6', 
                    bgcolor: 'rgba(59, 130, 246, 0.15)' 
                  },
                  p: isMobile ? 0.5 : 1,
                }}
              >
                <PeopleIcon sx={{ fontSize: responsive.iconSize }} />
              </IconButton>
            </Badge>
          </Tooltip>

          {/* Quick Notes Toggle - Hide on mobile */}
          {!isMobile && (
            <Tooltip title="Quick Notes (Ctrl+T)">
              <IconButton
                onClick={() => setShowQuickNotes(!showQuickNotes)}
                size={responsive.buttonSize}
                sx={{
                  color: showQuickNotes ? '#f97316' : '#6b7280',
                  bgcolor: showQuickNotes ? 'rgba(249, 115, 22, 0.1)' : 'transparent',
                  '&:hover': { 
                    color: '#f97316', 
                    bgcolor: 'rgba(249, 115, 22, 0.15)' 
                  },
                  p: 1,
                }}
              >
                <NoteIcon sx={{ fontSize: responsive.iconSize }} />
              </IconButton>
            </Tooltip>
          )}

          {/* Duplicate Scene - Hide on mobile */}
          {!isMobile && (
            <Tooltip title="Duplicate Scene (Ctrl+D)">
              <IconButton
                onClick={() => selectedScene && handleDuplicateScene(selectedScene)}
                disabled={!selectedScene}
                size={responsive.buttonSize}
                sx={{
                  color: '#6b7280',
                  '&:hover': { color: '#8b5cf6', bgcolor: 'rgba(139, 92, 246, 0.15)' },
                  '&:disabled': { opacity: 0.4 },
                  p: 1,
                }}
              >
                <FileCopyIcon sx={{ fontSize: responsive.iconSize }} />
              </IconButton>
            </Tooltip>
          )}

          {/* Save as Template - Hide on mobile */}
          {!isMobile && (
            <Tooltip title="Save Template (Ctrl+S)">
              <IconButton
                onClick={() => selectedScene && setShowSceneTemplate(true)}
                disabled={!selectedScene}
                size={responsive.buttonSize}
                sx={{
                  color: '#6b7280',
                  '&:hover': { color: '#ec4899', bgcolor: 'rgba(236, 72, 153, 0.15)' },
                  '&:disabled': { opacity: 0.4 },
                  p: 1,
                }}
              >
                <BookmarkIcon sx={{ fontSize: responsive.iconSize }} />
              </IconButton>
            </Tooltip>
          )}

          {/* Export PDF */}
          <Tooltip title="Export as PDF (Ctrl+E)">
            <IconButton
              onClick={handlePDFExport}
              size={responsive.buttonSize}
              sx={{
                color: '#6b7280',
                '&:hover': { color: '#f87171', bgcolor: 'rgba(248, 113, 113, 0.15)' },
                p: isMobile ? 0.5 : 1,
              }}
            >
              <DownloadIcon sx={{ fontSize: responsive.iconSize }} />
            </IconButton>
          </Tooltip>

          {/* Call Sheet - Hide on xs mobile */}
          {!isMobile && (
            <Tooltip title="Call Sheet (Ctrl+Shift+E)">
              <IconButton
                onClick={handleGenerateCallSheet}
                size={responsive.buttonSize}
                sx={{
                  color: '#6b7280',
                  '&:hover': { color: '#06b6d4', bgcolor: 'rgba(6, 182, 212, 0.15)' },
                  p: 1,
                }}
              >
                <AssignmentIcon sx={{ fontSize: responsive.iconSize }} />
              </IconButton>
            </Tooltip>
          )}

          {/* ============================================ */}
          {/* PRODUCTION WORKFLOW BUTTONS */}
          {/* ============================================ */}
          
          {!isMobile && <Divider orientation="vertical" flexItem sx={{ mx: 1, bgcolor: '#374151' }} />}
          
          {/* Stripboard - Hide on mobile */}
          {!isMobile && (
            <Tooltip title="Stripboard - Shooting Schedule">
              <IconButton
                onClick={() => setShowStripboardPanel(true)}
                size={responsive.buttonSize}
                sx={{
                  color: productionWorkflowTab === 'stripboard' ? '#fbbf24' : '#6b7280',
                  bgcolor: productionWorkflowTab === 'stripboard' ? 'rgba(251, 191, 36, 0.1)' : 'transparent',
                  '&:hover': { color: '#fbbf24', bgcolor: 'rgba(251, 191, 36, 0.15)' },
                  p: 1,
                }}
              >
                <StripboardIcon sx={{ fontSize: responsive.iconSize }} />
              </IconButton>
            </Tooltip>
          )}

          {/* Shooting Day Planner - Hide on mobile */}
          {!isMobile && (
            <Tooltip title="Opptaksplan - Day Planner">
              <IconButton
                onClick={() => setShowShootingDayPlanner(true)}
                size={responsive.buttonSize}
                sx={{
                  color: productionWorkflowTab === 'schedule' ? '#34d399' : '#6b7280',
                  bgcolor: productionWorkflowTab === 'schedule' ? 'rgba(52, 211, 153, 0.1)' : 'transparent',
                  '&:hover': { color: '#34d399', bgcolor: 'rgba(52, 211, 153, 0.15)' },
                  p: 1,
                }}
              >
                <CalendarIcon sx={{ fontSize: responsive.iconSize }} />
              </IconButton>
            </Tooltip>
          )}

          {/* Live Set Mode - WORKFLOW GAP FIX #1: Now opens day selector first */}
          <Tooltip title="Live Set Mode - On-Set Tracking">
            <IconButton
              onClick={() => setShowLiveSetDaySelector(true)}
              size={responsive.buttonSize}
              sx={{
                color: isLiveSetConnected ? '#ef4444' : '#6b7280',
                bgcolor: isLiveSetConnected ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                '&:hover': { color: '#ef4444', bgcolor: 'rgba(239, 68, 68, 0.15)' },
                p: isMobile ? 0.5 : 1,
                animation: isLiveSetConnected ? 'pulse 2s infinite' : 'none',
              }}
            >
              <Badge 
                badgeContent={isLiveSetConnected ? "LIVE" : null} 
                color="error"
                sx={{
                  '& .MuiBadge-badge': {
                    fontSize: isMobile ? 7 : 8,
                    height: isMobile ? 12 : 14,
                    minWidth: isMobile ? 22 : 28,
                    animation: isLiveSetConnected ? 'pulse 1s infinite' : 'none',
                  },
                }}
              >
                <LiveIcon sx={{ fontSize: responsive.iconSize }} />
              </Badge>
            </IconButton>
          </Tooltip>

          {/* WORKFLOW GAP FIX #5: Timeline ↔ Live Set Connection Toggle - Hide on mobile */}
          {!isMobile && (
            <Tooltip title={isLiveSetConnected ? "Koble fra Live Set" : "Koble til Live Set (synkroniser timeline)"}>
              <IconButton
                onClick={() => setIsLiveSetConnected(!isLiveSetConnected)}
                size={responsive.buttonSize}
                sx={{
                  color: isLiveSetConnected ? '#10b981' : '#6b7280',
                  bgcolor: isLiveSetConnected ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                  '&:hover': { color: '#10b981', bgcolor: 'rgba(16, 185, 129, 0.15)' },
                  p: 1,
                }}
              >
                {isLiveSetConnected ? (
                  <Box sx={{ position: 'relative' }}>
                    <TimerIcon sx={{ fontSize: responsive.iconSize - 2 }} />
                    <CheckIcon sx={{ fontSize: responsive.iconSize - 10, position: 'absolute', bottom: -2, right: -2, color: '#10b981' }} />
                  </Box>
                ) : (
                  <TimerIcon sx={{ fontSize: responsive.iconSize - 2 }} />
                )}
              </IconButton>
            </Tooltip>
          )}

          {!isMobile && <Divider orientation="vertical" flexItem sx={{ mx: 1, bgcolor: '#374151' }} />}

          {onClose && (
            <IconButton
              onClick={onClose}
              size={responsive.buttonSize}
              sx={{
                color: '#6b7280',
                '&:hover': { color: '#f87171', bgcolor: 'rgba(248, 113, 113, 0.1)' },
                p: isMobile ? 0.5 : 1,
              }}
            >
              <CloseIcon sx={{ fontSize: responsive.iconSize }} />
            </IconButton>
          )}
        </Stack>
      </Box>

      {/* Main content area */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* LEFT SIDEBAR - Scene Navigator - Enhanced */}
        {/* Mobile Drawer for sidebar */}
        <Drawer
          anchor="left"
          open={mobileSidebarOpen && isMobile}
          onClose={() => setMobileSidebarOpen(false)}
          PaperProps={{
            sx: {
              width: 280,
              bgcolor: '#0f1318',
              borderRight: '1px solid #1e2536',
            },
          }}
        >
          {/* Drawer Close Button */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1 }}>
            <IconButton onClick={() => setMobileSidebarOpen(false)} sx={{ color: '#6b7280' }}>
              <CloseIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Box>
        </Drawer>
        
        {/* Desktop sidebar or empty on mobile */}
        <Box
          sx={{
            width: isMobile ? 0 : responsive.sidebarWidth,
            display: isMobile ? 'none' : 'flex',
            bgcolor: '#0f1318',
            borderRight: '1px solid #1e2536',
            flexDirection: 'column',
          }}
        >
          {/* Search & Filter Header */}
          <Box sx={{ 
            p: 2, 
            borderBottom: '1px solid #1e2536',
            background: 'linear-gradient(180deg, #141a22 0%, #0f1318 100%)',
          }}>
            {/* Search Input */}
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 1.5,
              py: 1,
              bgcolor: '#1a2230',
              borderRadius: '10px',
              border: '1px solid #252d3d',
              mb: 2,
            }}>
              <SearchIcon sx={{ fontSize: 16, color: '#6b7280' }} />
              <input
                type="text"
                placeholder="Søk i scener..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: 13,
                  color: '#fff',
                  fontFamily: 'inherit',
                }}
              />
              {searchQuery && (
                <IconButton
                  size="small"
                  onClick={() => setSearchQuery('')}
                  sx={{ p: 0.5, color: '#6b7280', '&:hover': { color: '#fff' } }}
                >
                  <CloseIcon sx={{ fontSize: 14 }} />
                </IconButton>
              )}
            </Box>

            {/* Smart Filters */}
            <Typography sx={{ fontSize: 10, color: '#4b5563', mb: 1, fontWeight: 700, letterSpacing: 1 }}>
              SMART FILTRE
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              <Box
                onClick={() => setViewMode(viewMode === 'scenes' ? 'shots' : 'scenes')}
                sx={{
                  px: 1.5,
                  py: 0.5,
                  borderRadius: '8px',
                  bgcolor: viewMode === 'scenes' ? 'rgba(59,130,246,0.2)' : '#1a2230',
                  border: viewMode === 'scenes' ? '1px solid #3b82f6' : '1px solid #252d3d',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': { bgcolor: viewMode === 'scenes' ? 'rgba(59,130,246,0.25)' : '#252d3d' },
                }}
              >
                <Stack direction="row" spacing={0.75} alignItems="center">
                  {viewMode === 'scenes' ? <VideoLibraryIcon sx={{ fontSize: 14 }} /> : <MovieIcon sx={{ fontSize: 14 }} />}
                  <Typography sx={{ fontSize: 11, fontWeight: 600, color: viewMode === 'scenes' ? '#60a5fa' : '#9ca3af' }}>
                    {viewMode === 'scenes' ? 'Scener' : 'Shots'}
                  </Typography>
                </Stack>
              </Box>
              <Box
                onClick={() => setFilterMissingCamera(!filterMissingCamera)}
                sx={{
                  px: 1.5,
                  py: 0.5,
                  borderRadius: '8px',
                  bgcolor: filterMissingCamera ? 'rgba(249,115,22,0.2)' : '#1a2230',
                  border: filterMissingCamera ? '1px solid #f97316' : '1px solid #252d3d',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': { bgcolor: filterMissingCamera ? 'rgba(249,115,22,0.25)' : '#252d3d' },
                }}
              >
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <CameraIcon sx={{ fontSize: 14, color: filterMissingCamera ? '#fb923c' : '#9ca3af' }} />
                  <Typography sx={{ fontSize: 11, fontWeight: 600, color: filterMissingCamera ? '#fb923c' : '#9ca3af' }}>Kamera</Typography>
                </Stack>
              </Box>
              <Box
                onClick={() => setFilterMissingLight(!filterMissingLight)}
                sx={{
                  px: 1.5,
                  py: 0.5,
                  borderRadius: '8px',
                  bgcolor: filterMissingLight ? 'rgba(251,191,36,0.2)' : '#1a2230',
                  border: filterMissingLight ? '1px solid #fbbf24' : '1px solid #252d3d',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': { bgcolor: filterMissingLight ? 'rgba(251,191,36,0.25)' : '#252d3d' },
                }}
              >
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <LightIcon sx={{ fontSize: 14, color: filterMissingLight ? '#fcd34d' : '#9ca3af' }} />
                  <Typography sx={{ fontSize: 11, fontWeight: 600, color: filterMissingLight ? '#fcd34d' : '#9ca3af' }}>
                    Lys
                  </Typography>
                </Stack>
              </Box>
              <Box
                onClick={() => setFilterMissingSound(!filterMissingSound)}
                sx={{
                  px: 1.5,
                  py: 0.5,
                  borderRadius: '8px',
                  bgcolor: filterMissingSound ? 'rgba(6,182,212,0.2)' : '#1a2230',
                  border: filterMissingSound ? '1px solid #06b6d4' : '1px solid #252d3d',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': { bgcolor: filterMissingSound ? 'rgba(6,182,212,0.25)' : '#252d3d' },
                }}
              >
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <MicIcon sx={{ fontSize: 14, color: filterMissingSound ? '#22d3ee' : '#9ca3af' }} />
                  <Typography sx={{ fontSize: 11, fontWeight: 600, color: filterMissingSound ? '#22d3ee' : '#9ca3af' }}>
                    Lyd
                  </Typography>
                </Stack>
              </Box>
              <Box
                onClick={() => setShowTags(!showTags)}
                sx={{
                  px: 1.5,
                  py: 0.5,
                  borderRadius: '8px',
                  bgcolor: showTags ? 'rgba(16,185,129,0.2)' : '#1a2230',
                  border: showTags ? '1px solid #10b981' : '1px solid #252d3d',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': { bgcolor: showTags ? 'rgba(16,185,129,0.25)' : '#252d3d' },
                }}
              >
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <BookmarkIcon sx={{ fontSize: 14, color: showTags ? '#34d399' : '#9ca3af' }} />
                  <Typography sx={{ fontSize: 11, fontWeight: 600, color: showTags ? '#34d399' : '#9ca3af' }}>
                    Tags
                  </Typography>
                </Stack>
              </Box>
            </Box>
          </Box>

          {/* Progress Overview */}
          <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #1e2536', bgcolor: '#0a0e12' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography sx={{ fontSize: 10, color: '#6b7280', fontWeight: 600, letterSpacing: 0.5 }}>
                PRODUKSJONSFREMDRIFT
              </Typography>
              <Typography sx={{ fontSize: 12, color: '#10b981', fontWeight: 700 }}>
                {Math.round((scenes.filter(s => getSceneStatus(s) === 'complete').length / Math.max(scenes.length, 1)) * 100)}%
              </Typography>
            </Stack>
            <Box sx={{ height: 4, bgcolor: '#1a2230', borderRadius: 2, overflow: 'hidden' }}>
              <Box sx={{ 
                height: '100%', 
                width: `${(scenes.filter(s => getSceneStatus(s) === 'complete').length / Math.max(scenes.length, 1)) * 100}%`,
                bgcolor: 'linear-gradient(90deg, #10b981, #34d399)',
                background: 'linear-gradient(90deg, #10b981, #34d399)',
                borderRadius: 2,
                transition: 'width 0.3s ease',
              }} />
            </Box>
            <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
              <Typography sx={{ fontSize: 10, color: '#6b7280' }}>
                {scenes.filter(s => getSceneStatus(s) === 'complete').length} ferdig
              </Typography>
              <Typography sx={{ fontSize: 10, color: '#6b7280' }}>
                {scenes.length} totalt
              </Typography>
            </Stack>
          </Box>

          {/* Sort & View Controls */}
          <Box sx={{
            px: 2,
            py: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #1e2536',
            bgcolor: '#0a0e16',
          }}>
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'number' | 'duration' | 'date' | 'name')}
              size="small"
              sx={{
                height: 28,
                bgcolor: '#1a2230',
                color: '#9ca3af',
                fontSize: 11,
                flex: 1,
                mr: 1,
                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#252d3d' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#374151' },
              }}
              MenuProps={{
                sx: { zIndex: 1400 },
                PaperProps: {
                  sx: {
                    bgcolor: '#1e2536',
                    border: '1px solid #374151',
                    '& .MuiMenuItem-root': {
                      fontSize: 12,
                      color: '#e5e7eb',
                      '&:hover': { bgcolor: 'rgba(59, 130, 246, 0.15)' },
                    },
                  },
                },
              }}
            >
              <MenuItem value="number" sx={{ fontSize: 12 }}>Sort: Number</MenuItem>
              <MenuItem value="duration" sx={{ fontSize: 12 }}>Sort: Duration</MenuItem>
              <MenuItem value="date" sx={{ fontSize: 12 }}>Sort: Date</MenuItem>
              <MenuItem value="name" sx={{ fontSize: 12 }}>Sort: Name</MenuItem>
            </Select>

            <Tooltip title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}>
              <IconButton
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                size="small"
                sx={{
                  color: '#6b7280',
                  bgcolor: '#1a2230',
                  border: '1px solid #252d3d',
                  '&:hover': { bgcolor: '#252d3d', color: '#fff' },
                  p: 0.75,
                }}
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </IconButton>
            </Tooltip>
          </Box>

          {/* Acts and Scenes List */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleSceneReorder}
          >
            <Box sx={{ flex: 1, overflow: 'auto', '&::-webkit-scrollbar': { width: 6 }, '&::-webkit-scrollbar-thumb': { bgcolor: '#374151', borderRadius: 3 } }}>
              {acts.map(act => {
                const actScenes = scenesByAct.get(act.id) || [];
                const isExpanded = expandedActs.has(act.id);
                const visibleScenes = actScenes.filter(s => filteredScenes.find(fs => fs.id === s.id));
                const completedCount = actScenes.filter(s => getSceneStatus(s) === 'complete').length;
                
                return (
                  <Box key={act.id}>
                    {/* Act Header - Enhanced */}
                    <Box
                      onClick={() => toggleAct(act.id)}
                      sx={{
                        px: 2,
                        py: 1.5,
                        display: 'flex',
                        alignItems: 'center',
                        cursor: 'pointer',
                        bgcolor: isExpanded ? '#141a22' : 'transparent',
                        borderBottom: '1px solid #1e2536',
                        transition: 'all 0.2s',
                        '&:hover': { bgcolor: '#141a22' },
                      }}
                    >
                      <Box sx={{
                        width: 32,
                        height: 32,
                        borderRadius: '10px',
                        bgcolor: isExpanded ? 'rgba(59,130,246,0.15)' : '#1a2230',
                        border: isExpanded ? '1px solid rgba(59,130,246,0.3)' : '1px solid #252d3d',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mr: 1.5,
                      }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: isExpanded ? '#60a5fa' : '#9ca3af' }}>
                          {act.actNumber}
                        </Typography>
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: isExpanded ? '#fff' : '#d1d5db',
                          letterSpacing: 0.3,
                        }}>
                          {act.title || `Akt ${act.actNumber}`}
                        </Typography>
                        <Typography sx={{ fontSize: 10, color: '#6b7280' }}>
                          {completedCount}/{actScenes.length} scener • {visibleScenes.length} synlig
                        </Typography>
                      </Box>
                      <Box sx={{
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s',
                      }}>
                        <ExpandMoreIcon sx={{ fontSize: 20, color: '#6b7280' }} />
                      </Box>
                    </Box>

                    {/* Scene List - Enhanced with drag-and-drop */}
                    <Collapse in={isExpanded}>
                      <SortableContext
                        items={visibleScenes.map(s => s.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {visibleScenes.map(scene => {
                          const isSelected = selectedScene?.id === scene.id;
                          const isBatchSelected = selectedScenes.has(scene.id);
                          const status = getSceneStatus(scene);
                          const statusColor = STATUS_COLORS[status as keyof typeof STATUS_COLORS];
                          const needs = sceneNeeds[scene.id] || { cam: false, light: false, sound: false };
                          const shots = getShotsForScene(scene.id);
                          
                          return (
                            <Box
                              key={scene.id}
                              sx={{
                                position: 'relative',
                                bgcolor: isBatchSelected ? 'rgba(59,130,246,0.08)' : 'transparent',
                                borderLeft: isBatchSelected ? '3px solid #3b82f6' : '3px solid transparent',
                              }}
                              onClick={(e) => {
                                if (batchMode && (e.ctrlKey || e.metaKey || e.shiftKey)) {
                                  e.stopPropagation();
                                  handleToggleSceneSelection(scene.id);
                                }
                              }}
                            >
                              {batchMode && (
                                <Box
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleSceneSelection(scene.id);
                                  }}
                                  sx={{
                                    position: 'absolute',
                                    left: 8,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    zIndex: 10,
                                    width: 18,
                                    height: 18,
                                    borderRadius: '4px',
                                    border: `2px solid ${isBatchSelected ? '#3b82f6' : '#6b7280'}`,
                                    bgcolor: isBatchSelected ? '#3b82f6' : 'transparent',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    '&:hover': { borderColor: '#3b82f6' },
                                  }}
                                >
                                  {isBatchSelected && <CheckIcon sx={{ fontSize: 12, color: '#fff' }} />}
                                </Box>
                              )}
                              <SortableSceneItem
                                scene={scene}
                                isSelected={isSelected}
                                status={status}
                                statusColor={statusColor}
                                needs={needs}
                                shots={shots}
                                showTags={showTags}
                                thumbnail={shots[0] ? shotMetadata[shots[0].id]?.thumbnailUrl : undefined}
                                onSceneClick={scrollToScene}
                              />
                            </Box>
                          );
                        })}
                      </SortableContext>
                    </Collapse>
                  </Box>
                );
              })}
            </Box>
          </DndContext>

          {/* Batch Operations Bar */}
          {batchMode && selectedScenes.size > 0 && (
            <Box
              sx={{
                p: 1.5,
                borderTop: '1px solid #1e2536',
                bgcolor: 'rgba(59,130,246,0.1)',
                borderBottom: '1px solid rgba(59,130,246,0.3)',
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                <Typography sx={{ fontSize: 12, color: '#60a5fa', fontWeight: 600 }}>
                  {selectedScenes.size} scene{selectedScenes.size !== 1 ? 's' : ''} selected
                </Typography>
                <Stack direction="row" spacing={0.5}>
                  <Tooltip title="Export selected">
                    <IconButton 
                      size="small" 
                      onClick={handleBatchExport}
                      sx={{ color: '#10b981', '&:hover': { bgcolor: 'rgba(16,185,129,0.15)' } }}
                    >
                      <DownloadIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete selected">
                    <IconButton 
                      size="small" 
                      onClick={handleBatchDelete}
                      sx={{ color: '#ef4444', '&:hover': { bgcolor: 'rgba(239,68,68,0.15)' } }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                      </svg>
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Clear selection">
                    <IconButton 
                      size="small" 
                      onClick={() => { setBatchMode(false); setSelectedScenes(new Set()); }}
                      sx={{ color: '#6b7280' }}
                    >
                      <CloseIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>
            </Box>
          )}

          {/* Bottom Actions Bar */}
          <Box
            sx={{
              p: 2,
              borderTop: '1px solid #1e2536',
              bgcolor: '#0a0e12',
              display: 'flex',
              gap: 1,
            }}
          >
            <Tooltip title="Legg til scene">
              <Box 
                onClick={() => setShowNewSceneDialog(true)}
                sx={{
                flex: 1,
                py: 1,
                borderRadius: '8px',
                bgcolor: '#1a2230',
                border: '1px solid #252d3d',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': { bgcolor: '#252d3d', borderColor: '#374151' },
              }}>
                <AddIcon sx={{ fontSize: 18, color: '#10b981' }} />
                <Typography sx={{ fontSize: 12, color: '#9ca3af', fontWeight: 500 }}>Ny scene</Typography>
              </Box>
            </Tooltip>
            <Tooltip title="Casting planner">
              <IconButton sx={{ 
                color: '#6b7280', 
                bgcolor: '#1a2230', 
                border: '1px solid #252d3d',
                borderRadius: '8px',
                '&:hover': { bgcolor: '#252d3d', color: '#3b82f6' },
              }}>
                <MovieIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Eksporter produksjonsdata">
              <IconButton 
                onClick={() => setShowExportDialog(true)}
                sx={{ 
                  color: '#6b7280', 
                  bgcolor: '#1a2230', 
                  border: '1px solid #252d3d',
                  borderRadius: '8px',
                  '&:hover': { bgcolor: '#252d3d', color: '#f59e0b' },
                }}
              >
                <DownloadIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* CENTER - Manuscript View - ENHANCED */}
        <Box
          ref={manuscriptRef}
          sx={{
            flex: isManuscriptFullscreen ? 'auto' : 1,
            display: 'flex',
            flexDirection: 'column',
            bgcolor: '#0f1318',
            overflow: 'hidden',
            ...(isManuscriptFullscreen && {
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1300,
            }),
          }}
        >
          {/* Top Panel Bar */}
          <Box sx={{ 
            px: isMobile ? 1.5 : 3, 
            py: isMobile ? 1 : 1.5, 
            borderBottom: '1px solid #1e2536',
            background: 'linear-gradient(180deg, #141a22 0%, #0f1318 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: isMobile ? 'wrap' : 'nowrap',
            gap: isMobile ? 1 : 0,
          }}>
            <Stack direction="row" alignItems="center" spacing={isMobile ? 1 : 2}>
              <Box sx={{
                px: isMobile ? 1 : 1.5,
                py: 0.5,
                borderRadius: '6px',
                bgcolor: readThroughMode ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.15)',
                border: readThroughMode ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(59,130,246,0.3)',
              }}>
                <Typography sx={{ fontSize: responsive.bodyFontSize - 1, fontWeight: 700, color: readThroughMode ? '#10b981' : '#60a5fa', letterSpacing: 1 }}>
                  {readThroughMode ? (isMobile ? 'READ' : 'READ THROUGH') : (isMobile ? 'MANUS' : 'MANUSKRIPT')}
                </Typography>
              </Box>
              {selectedScene && !readThroughMode && !isMobile && (
                <Typography sx={{ fontSize: responsive.bodyFontSize, color: '#6b7280' }}>
                  Scene {selectedScene.sceneNumber} av {scenes.length}
                </Typography>
              )}
              {readThroughMode && (
                <>
                  <Stack direction="row" spacing={isMobile ? 0.5 : 1}>
                    <IconButton
                      onClick={handleReadThroughPrevious}
                      disabled={readThroughCurrentLine === 0}
                      size={responsive.buttonSize}
                      sx={{ color: '#6b7280', '&:hover': { color: '#fff' }, p: isMobile ? 0.5 : 1 }}
                    >
                      <ChevronLeftIcon sx={{ fontSize: responsive.iconSize }} />
                    </IconButton>
                    <IconButton
                      onClick={handleReadThroughPlay}
                      size={responsive.buttonSize}
                      sx={{ 
                        color: readThroughPlaying ? '#10b981' : '#6b7280',
                        '&:hover': { color: '#10b981' },
                        p: isMobile ? 0.5 : 1,
                      }}
                    >
                      {readThroughPlaying ? <PauseIcon sx={{ fontSize: responsive.iconSize }} /> : <PlayIcon sx={{ fontSize: responsive.iconSize }} />}
                    </IconButton>
                    <IconButton
                      onClick={handleReadThroughNext}
                      size={responsive.buttonSize}
                      sx={{ color: '#6b7280', '&:hover': { color: '#fff' }, p: isMobile ? 0.5 : 1 }}
                    >
                      <ChevronRightIcon sx={{ fontSize: responsive.iconSize }} />
                    </IconButton>
                  </Stack>
                  <Typography sx={{ fontSize: responsive.bodyFontSize, color: '#6b7280' }}>
                    Linje {readThroughCurrentLine + 1} av {dialogueLines.length}
                  </Typography>
                  {readThroughStartTime && !isMobile && (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <TimerIcon sx={{ fontSize: responsive.iconSize - 4, color: '#6b7280' }} />
                      <Typography sx={{ fontSize: responsive.bodyFontSize, color: '#6b7280' }}>
                        {Math.floor((Date.now() - readThroughStartTime) / 60000)}:{String(Math.floor(((Date.now() - readThroughStartTime) % 60000) / 1000)).padStart(2, '0')}
                      </Typography>
                    </Stack>
                  )}
                </>
              )}
            </Stack>
            <Stack direction="row" spacing={isMobile ? 0.5 : 1} alignItems="center">
              {!isMobile && (
                <Typography sx={{ fontSize: responsive.bodyFontSize - 2, color: '#4b5563' }}>
                  {Math.round(manuscriptZoom * 100)}%
                </Typography>
              )}
              <Tooltip title="Zoom inn">
                <IconButton 
                  size={responsive.buttonSize}
                  onClick={handleManuscriptZoomIn}
                  disabled={manuscriptZoom >= 2}
                  sx={{ color: '#6b7280', '&:hover': { color: '#fff' }, '&.Mui-disabled': { color: '#374151' }, p: isMobile ? 0.5 : 1 }}
                >
                  <ZoomInIcon sx={{ fontSize: responsive.iconSize }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Zoom ut">
                <IconButton 
                  size={responsive.buttonSize}
                  onClick={handleManuscriptZoomOut}
                  disabled={manuscriptZoom <= 0.5}
                  sx={{ color: '#6b7280', '&:hover': { color: '#fff' }, '&.Mui-disabled': { color: '#374151' }, p: isMobile ? 0.5 : 1 }}
                >
                  <ZoomOutIcon sx={{ fontSize: responsive.iconSize }} />
                </IconButton>
              </Tooltip>
              <Tooltip title={isManuscriptFullscreen ? "Avslutt fullskjerm" : "Fullskjerm"}>
                <IconButton 
                  size={responsive.buttonSize}
                  onClick={handleManuscriptFullscreen}
                  sx={{ 
                    color: isManuscriptFullscreen ? '#3b82f6' : '#6b7280', 
                    '&:hover': { color: '#fff' },
                    p: isMobile ? 0.5 : 1,
                  }}
                >
                  <FullscreenIcon sx={{ fontSize: responsive.iconSize }} />
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>

          {/* Manuscript Content */}
          <Box sx={{ flex: 1, overflow: 'auto', p: isMobile ? 1.5 : 4, '&::-webkit-scrollbar': { width: 8 }, '&::-webkit-scrollbar-thumb': { bgcolor: '#374151', borderRadius: 4 } }}>
            {selectedScene ? (
              <Box sx={{ 
                maxWidth: isMobile ? '100%' : 900 * manuscriptZoom, 
                mx: 'auto',
                bgcolor: '#1a2230',
                borderRadius: isMobile ? '12px' : '16px',
                border: '1px solid #252d3d',
                overflow: 'hidden',
                transform: isMobile ? 'none' : `scale(${manuscriptZoom})`,
                transformOrigin: 'top center',
              }}>
                {/* Scene Header Card */}
                <Box sx={{
                  p: isMobile ? 2 : 3,
                  background: 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(139,92,246,0.1) 100%)',
                  borderBottom: '1px solid #252d3d',
                }}>
                  <Stack direction="row" spacing={isMobile ? 1.5 : 2} alignItems="flex-start">
                    {/* Scene number badge */}
                    <Box sx={{
                      width: isMobile ? 48 : 64,
                      height: isMobile ? 48 : 64,
                      borderRadius: isMobile ? '10px' : '12px',
                      bgcolor: '#3b82f6',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 15px rgba(59,130,246,0.4)',
                      flexShrink: 0,
                    }}>
                      <Typography sx={{ fontSize: isMobile ? 8 : 10, color: 'rgba(255,255,255,0.87)', fontWeight: 600 }}>SCENE</Typography>
                      <Typography sx={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: '#fff' }}>{selectedScene.sceneNumber}</Typography>
                    </Box>
                    
                    {/* Scene details */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{
                        fontSize: isMobile ? 16 : 24,
                        fontWeight: 700,
                        color: '#fff',
                        mb: 1,
                        fontFamily: 'Courier New, monospace',
                        wordBreak: 'break-word',
                      }}>
                        {selectedScene.intExt}. {selectedScene.locationName}
                      </Typography>
                      
                      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ gap: 0.5 }}>
                        <Box sx={{
                          px: isMobile ? 1 : 1.5, py: 0.5, borderRadius: '6px',
                          bgcolor: selectedScene.intExt === 'INT' ? 'rgba(168,85,247,0.2)' : 'rgba(34,197,94,0.2)',
                          border: selectedScene.intExt === 'INT' ? '1px solid rgba(168,85,247,0.4)' : '1px solid rgba(34,197,94,0.4)',
                        }}>
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            {selectedScene.intExt === 'INT' ? <HomeIcon sx={{ fontSize: isMobile ? 12 : 14, color: '#c084fc' }} /> : <ParkIcon sx={{ fontSize: isMobile ? 12 : 14, color: '#4ade80' }} />}
                            <Typography sx={{ fontSize: isMobile ? 10 : 11, fontWeight: 600, color: selectedScene.intExt === 'INT' ? '#c084fc' : '#4ade80' }}>
                              {selectedScene.intExt === 'INT' ? 'Interior' : 'Exterior'}
                            </Typography>
                          </Stack>
                        </Box>
                        <Box sx={{
                          px: isMobile ? 1 : 1.5, py: 0.5, borderRadius: '6px',
                          bgcolor: 'rgba(251,191,36,0.2)',
                          border: '1px solid rgba(251,191,36,0.4)',
                        }}>
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            {selectedScene.timeOfDay === 'DAY' ? <SunIcon sx={{ fontSize: 14, color: '#fcd34d' }} /> : selectedScene.timeOfDay === 'NIGHT' ? <MoonIcon sx={{ fontSize: 14, color: '#fcd34d' }} /> : <TwilightIcon sx={{ fontSize: 14, color: '#fcd34d' }} />}
                            <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#fcd34d' }}>{selectedScene.timeOfDay}</Typography>
                          </Stack>
                        </Box>
                        {getShotsForScene(selectedScene.id).length > 0 && (
                          <Box sx={{
                            px: 1.5, py: 0.5, borderRadius: '6px',
                            bgcolor: 'rgba(59,130,246,0.2)',
                            border: '1px solid rgba(59,130,246,0.4)',
                          }}>
                            <Stack direction="row" spacing={0.5} alignItems="center" component="span" sx={{ fontSize: 11, fontWeight: 600, color: '#60a5fa' }}>
                              <MovieIcon sx={{ fontSize: 14 }} />
                              <Typography component="span">{getShotsForScene(selectedScene.id).length} shots</Typography>
                            </Stack>
                          </Box>
                        )}
                      </Stack>
                    </Box>
                  </Stack>
                </Box>

                {/* ============================================ */}
                {/* WORKFLOW GAP FIX: Quick Actions Toolbar */}
                {/* ============================================ */}
                <Box sx={{
                  p: 2,
                  borderBottom: '1px solid #252d3d',
                  bgcolor: '#0f1318',
                  display: 'flex',
                  gap: 1,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                }}>
                  <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#6b7280', letterSpacing: 1, mr: 1 }}>
                    PRODUKSJON:
                  </Typography>
                  
                  {/* Scene Needs Button */}
                  <Tooltip title="Sett scene behov (kamera/lys/lyd)">
                    <Button
                      size="small"
                      startIcon={<SettingsIcon sx={{ fontSize: 14 }} />}
                      onClick={() => handleOpenSceneNeedsDialog(selectedScene.id)}
                      sx={{
                        minWidth: 'auto',
                        px: 1.5,
                        py: 0.5,
                        fontSize: 10,
                        color: '#9ca3af',
                        bgcolor: '#1a2230',
                        border: '1px solid #252d3d',
                        borderRadius: '6px',
                        '&:hover': { bgcolor: '#252d3d', color: '#fff' },
                      }}
                    >
                      Behov
                      {(sceneNeeds[selectedScene.id]?.cam || sceneNeeds[selectedScene.id]?.light || sceneNeeds[selectedScene.id]?.sound) && (
                        <Box component="span" sx={{ ml: 0.5, display: 'flex', gap: 0.25 }}>
                          {sceneNeeds[selectedScene.id]?.cam && <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#f97316' }} />}
                          {sceneNeeds[selectedScene.id]?.light && <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#fbbf24' }} />}
                          {sceneNeeds[selectedScene.id]?.sound && <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#06b6d4' }} />}
                        </Box>
                      )}
                    </Button>
                  </Tooltip>

                  {/* Schedule Scene Button */}
                  <Tooltip title="Planlegg scene på opptaksdag">
                    <Button
                      size="small"
                      startIcon={<CalendarIcon sx={{ fontSize: 14 }} />}
                      onClick={() => handleOpenScheduleDialog(selectedScene)}
                      sx={{
                        minWidth: 'auto',
                        px: 1.5,
                        py: 0.5,
                        fontSize: 10,
                        color: '#9ca3af',
                        bgcolor: '#1a2230',
                        border: '1px solid #252d3d',
                        borderRadius: '6px',
                        '&:hover': { bgcolor: '#252d3d', color: '#fff' },
                      }}
                    >
                      Planlegg
                    </Button>
                  </Tooltip>

                  {/* Pre-Production Checklist Button */}
                  <Tooltip title="Pre-produksjon sjekkliste">
                    <Button
                      size="small"
                      startIcon={<CheckIcon sx={{ fontSize: 14 }} />}
                      onClick={() => setShowChecklistDialog(true)}
                      sx={{
                        minWidth: 'auto',
                        px: 1.5,
                        py: 0.5,
                        fontSize: 10,
                        color: sceneChecklists[selectedScene.id] ? '#10b981' : '#9ca3af',
                        bgcolor: sceneChecklists[selectedScene.id] ? 'rgba(16,185,129,0.1)' : '#1a2230',
                        border: sceneChecklists[selectedScene.id] ? '1px solid rgba(16,185,129,0.3)' : '1px solid #252d3d',
                        borderRadius: '6px',
                        '&:hover': { bgcolor: '#252d3d', color: '#fff' },
                      }}
                    >
                      {sceneChecklists[selectedScene.id] ? <><span>{getChecklistProgress(selectedScene.id)}%</span><CheckIcon sx={{ fontSize: 12, ml: 0.5 }} /></> : 'Sjekkliste'}
                    </Button>
                  </Tooltip>

                  {/* Bulk Shot Generation Button */}
                  <Tooltip title="Generer flere shots fra mal">
                    <Button
                      size="small"
                      startIcon={<MovieIcon sx={{ fontSize: 14 }} />}
                      onClick={() => setShowBulkShotDialog(true)}
                      sx={{
                        minWidth: 'auto',
                        px: 1.5,
                        py: 0.5,
                        fontSize: 10,
                        color: '#9ca3af',
                        bgcolor: '#1a2230',
                        border: '1px solid #252d3d',
                        borderRadius: '6px',
                        '&:hover': { bgcolor: '#252d3d', color: '#fff' },
                      }}
                    >
                      + Shots
                    </Button>
                  </Tooltip>

                  {/* Line Coverage Button */}
                  <Tooltip title="Shot-til-dialog dekning">
                    <Button
                      size="small"
                      startIcon={<NoteIcon sx={{ fontSize: 14 }} />}
                      onClick={() => setShowLineCoverageDialog(true)}
                      sx={{
                        minWidth: 'auto',
                        px: 1.5,
                        py: 0.5,
                        fontSize: 10,
                        color: getUncoveredDialogue(selectedScene.id).length > 0 ? '#f59e0b' : '#9ca3af',
                        bgcolor: getUncoveredDialogue(selectedScene.id).length > 0 ? 'rgba(245,158,11,0.1)' : '#1a2230',
                        border: getUncoveredDialogue(selectedScene.id).length > 0 ? '1px solid rgba(245,158,11,0.3)' : '1px solid #252d3d',
                        borderRadius: '6px',
                        '&:hover': { bgcolor: '#252d3d', color: '#fff' },
                      }}
                    >
                      Linjedekning
                      {getUncoveredDialogue(selectedScene.id).length > 0 && (
                        <Typography component="span" sx={{ ml: 0.5, fontSize: 9, color: '#f59e0b' }}>
                          ({getUncoveredDialogue(selectedScene.id).length})
                        </Typography>
                      )}
                    </Button>
                  </Tooltip>

                  {/* Sync Status Button */}
                  <Tooltip title="Synk status med Stripboard">
                    <Button
                      size="small"
                      startIcon={<RefreshIcon sx={{ fontSize: 14 }} />}
                      onClick={() => {
                        const currentStatus = getSceneStatus(selectedScene);
                        const stripStatus = currentStatus === 'complete' ? 'completed' : currentStatus === 'partial' ? 'shot' : 'not-scheduled';
                        handleSyncStatusWithStripboard(selectedScene.id, stripStatus as 'not-scheduled' | 'scheduled' | 'shot' | 'in-post' | 'completed');
                      }}
                      sx={{
                        minWidth: 'auto',
                        px: 1.5,
                        py: 0.5,
                        fontSize: 10,
                        color: '#9ca3af',
                        bgcolor: '#1a2230',
                        border: '1px solid #252d3d',
                        borderRadius: '6px',
                        '&:hover': { bgcolor: '#252d3d', color: '#fff' },
                      }}
                    >
                      Synk
                    </Button>
                  </Tooltip>
                </Box>

                {/* Reference Image - Enhanced */}
                {centerPanelReference && (
                  <Box sx={{ p: 3, borderBottom: '1px solid #252d3d' }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                      <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', letterSpacing: 0.5 }}>
                        <Stack direction="row" spacing={0.5} alignItems="center" component="span"><PhotoIcon sx={{ fontSize: 14 }} /> REFERANSEBILDE</Stack>
                      </Typography>
                      <Box sx={{
                        px: 1.5, py: 0.5, borderRadius: '6px',
                        bgcolor: 'rgba(16,185,129,0.15)',
                        border: '1px solid rgba(16,185,129,0.3)',
                      }}>
                        <Typography sx={{ fontSize: 10, fontWeight: 600, color: '#34d399' }}>
                          FRA CASTING
                        </Typography>
                      </Box>
                    </Stack>
                    <Box sx={{
                      width: '100%',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      border: '1px solid #252d3d',
                      position: 'relative',
                    }}>
                      <img 
                        src={centerPanelReference?.url}
                        alt="Scene reference"
                        style={{ 
                          width: '100%',
                          maxHeight: 400,
                          objectFit: 'cover',
                          display: 'block',
                        }}
                      />
                      <Box sx={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: 60,
                        background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                      }} />
                    </Box>
                  </Box>
                )}

                {/* Dialogue Section - Enhanced */}
                <Box sx={{ p: 3, borderBottom: '1px solid #252d3d' }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', letterSpacing: 0.5 }}>
                      <Stack direction="row" spacing={0.5} alignItems="center" component="span"><QuoteIcon sx={{ fontSize: 14 }} /> DIALOG</Stack>
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: '#4b5563' }}>
                      {selectedSceneDialogue.length} replikker
                    </Typography>
                  </Stack>
                  
                  {selectedSceneDialogue.length > 0 ? (
                    selectedSceneDialogue.map((line, lineIdx) => {
                      const allDialogue = scenes.flatMap(s => 
                        dialogueLines.filter(d => d.sceneId === s.id)
                      );
                      const globalLineIndex = allDialogue.findIndex(d => d.id === line.id);
                      const isCurrentLine = readThroughMode && globalLineIndex === readThroughCurrentLine;

                      return (
                        <Box 
                          key={line.id} 
                          sx={{ 
                            mb: 3, 
                            textAlign: 'center',
                            p: 2,
                            borderRadius: '10px',
                            bgcolor: isCurrentLine ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0,0,0,0.2)',
                            border: isCurrentLine ? '2px solid rgba(16, 185, 129, 0.5)' : '1px solid #252d3d',
                            transition: 'all 0.3s ease',
                            transform: isCurrentLine ? 'scale(1.02)' : 'scale(1)',
                            boxShadow: isCurrentLine ? '0 8px 24px rgba(16, 185, 129, 0.2)' : 'none',
                          }}
                        >
                          <Box sx={{
                            display: 'inline-block',
                            px: 2,
                            py: 0.5,
                            bgcolor: isCurrentLine ? 'rgba(16, 185, 129, 0.3)' : 'rgba(139,92,246,0.2)',
                            borderRadius: '20px',
                            border: isCurrentLine ? '1px solid rgba(16, 185, 129, 0.6)' : '1px solid rgba(139,92,246,0.4)',
                            mb: 1.5,
                          }}>
                            <Typography sx={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: isCurrentLine ? '#10b981' : '#a78bfa',
                              textTransform: 'uppercase',
                              fontFamily: 'Courier New, monospace',
                              letterSpacing: 1,
                            }}>
                              {line.characterName}
                            </Typography>
                          </Box>
                          {line.parenthetical && (
                            <Typography sx={{
                              fontSize: 12,
                              color: '#6b7280',
                              fontStyle: 'italic',
                              fontFamily: 'Courier New, monospace',
                              mb: 1,
                            }}>
                              ({line.parenthetical})
                            </Typography>
                          )}
                          <Typography sx={{
                            fontSize: isCurrentLine ? 16 : 15,
                            color: isCurrentLine ? '#fff' : '#e5e7eb',
                            fontFamily: 'Courier New, monospace',
                            maxWidth: 500,
                            mx: 'auto',
                            lineHeight: 1.7,
                            fontWeight: isCurrentLine ? 600 : 400,
                          }}>
                            "{line.dialogueText}"
                          </Typography>
                        </Box>
                      );
                    })
                  ) : (
                    <Box sx={{ 
                      textAlign: 'center',
                      p: 3,
                      borderRadius: '10px',
                      bgcolor: 'rgba(0,0,0,0.2)',
                      border: '1px dashed #374151',
                    }}>
                      <Typography sx={{ fontSize: 13, color: '#4b5563' }}>
                        Ingen dialog i denne scenen
                      </Typography>
                    </Box>
                  )}
                </Box>

                {/* Production Notes / Read Through Notes */}
                <Box sx={{ p: 3, borderBottom: '1px solid #252d3d' }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', letterSpacing: 0.5 }}>
                      {readThroughMode ? 'READ THROUGH NOTES' : 'PRODUCTION NOTES'}
                    </Typography>
                    <Tooltip title="Legg til note">
                      <IconButton 
                        size="small" 
                        onClick={() => setShowAddNoteDialog(true)}
                        sx={{ 
                          color: '#6b7280',
                          bgcolor: readThroughMode ? 'rgba(16,185,129,0.1)' : 'rgba(59,130,246,0.1)',
                          '&:hover': { bgcolor: readThroughMode ? 'rgba(16,185,129,0.2)' : 'rgba(59,130,246,0.2)' },
                        }}
                      >
                        <AddIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                  
                  {readThroughMode && selectedScene && (
                    <Box sx={{ mb: 2 }}>
                      <TextField
                        fullWidth
                        multiline
                        rows={2}
                        placeholder="Skriv noter fra read-through..."
                        value={readThroughNotes[selectedScene.id] || ''}
                        onChange={(e) => handleAddReadThroughNote(selectedScene.id, e.target.value)}
                        sx={{
                          '& .MuiInputBase-input': {
                            color: '#e5e7eb',
                            fontSize: 12,
                          },
                          '& .MuiOutlinedInput-root': {
                            borderColor: '#2a3142',
                            bgcolor: '#0f1318',
                            '&:hover': { borderColor: '#374151' },
                            '&.Mui-focused': { 
                              borderColor: '#10b981',
                              '& fieldset': { borderColor: '#10b981' }
                            },
                          },
                        }}
                      />
                      {readThroughNotes[selectedScene.id] && (
                        <Box sx={{ 
                          mt: 1.5,
                          p: 1.5,
                          bgcolor: 'rgba(16, 185, 129, 0.08)',
                          borderRadius: '8px',
                          border: '1px solid rgba(16, 185, 129, 0.2)',
                        }}>
                          <Typography sx={{ fontSize: 12, color: '#10b981', whiteSpace: 'pre-wrap' }}>
                            {readThroughNotes[selectedScene.id]}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  )}

                  {!readThroughMode && selectedScene && (
                    <Stack spacing={1.5}>
                      {/* Camera Note - Editable */}
                      <Box sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 1.5,
                        p: 2,
                        bgcolor: 'rgba(59,130,246,0.08)',
                        borderRadius: '10px',
                        borderLeft: '3px solid #3b82f6',
                      }}>
                        <Box sx={{
                          width: 28,
                          height: 28,
                          borderRadius: '8px',
                          bgcolor: 'rgba(59,130,246,0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <CameraIcon sx={{ fontSize: 14, color: '#60a5fa' }} />
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography sx={{ fontSize: 10, color: '#60a5fa', fontWeight: 600, mb: 0.5 }}>KAMERA NOTE</Typography>
                          {editingProductionNote?.sceneId === selectedScene.id && editingProductionNote?.type === 'camera' ? (
                            <Stack spacing={1}>
                              <TextField
                                fullWidth
                                size="small"
                                multiline
                                rows={2}
                                value={productionNoteValue}
                                onChange={(e) => setProductionNoteValue(e.target.value)}
                                placeholder="Skriv kamera note..."
                                autoFocus
                                sx={{
                                  '& .MuiInputBase-input': { color: '#e5e7eb', fontSize: 12 },
                                  '& .MuiOutlinedInput-root': {
                                    bgcolor: '#0f1318',
                                    '& fieldset': { borderColor: '#3b82f6' },
                                  },
                                }}
                              />
                              <Stack direction="row" spacing={1}>
                                <Button size="small" variant="contained" onClick={handleSaveProductionNote} sx={{ bgcolor: '#3b82f6', fontSize: 10 }}>
                                  Lagre
                                </Button>
                                <Button size="small" onClick={handleCancelProductionNote} sx={{ color: '#6b7280', fontSize: 10 }}>
                                  Avbryt
                                </Button>
                              </Stack>
                            </Stack>
                          ) : (
                            <Typography sx={{ fontSize: 12, color: '#9ca3af' }}>
                              {productionNotes[selectedScene.id]?.camera || 'Klikk for å legge til kamera note...'}
                            </Typography>
                          )}
                        </Box>
                        {!(editingProductionNote?.sceneId === selectedScene.id && editingProductionNote?.type === 'camera') && (
                          <IconButton 
                            size="small" 
                            onClick={() => handleEditProductionNote(selectedScene.id, 'camera')}
                            sx={{ color: '#4b5563', '&:hover': { color: '#60a5fa' } }}
                          >
                            <EditIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        )}
                      </Box>

                      {/* Director Note - Editable */}
                      <Box sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 1.5,
                        p: 2,
                        bgcolor: 'rgba(249,115,22,0.08)',
                        borderRadius: '10px',
                        borderLeft: '3px solid #f97316',
                      }}>
                        <Box sx={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          bgcolor: '#f97316',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>R</Typography>
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography sx={{ fontSize: 10, color: '#fb923c', fontWeight: 600, mb: 0.5 }}>REGISSØR</Typography>
                          {editingProductionNote?.sceneId === selectedScene.id && editingProductionNote?.type === 'director' ? (
                            <Stack spacing={1}>
                              <TextField
                                fullWidth
                                size="small"
                                multiline
                                rows={2}
                                value={productionNoteValue}
                                onChange={(e) => setProductionNoteValue(e.target.value)}
                                placeholder="Skriv regissør note..."
                                autoFocus
                                sx={{
                                  '& .MuiInputBase-input': { color: '#e5e7eb', fontSize: 12 },
                                  '& .MuiOutlinedInput-root': {
                                    bgcolor: '#0f1318',
                                    '& fieldset': { borderColor: '#f97316' },
                                  },
                                }}
                              />
                              <Stack direction="row" spacing={1}>
                                <Button size="small" variant="contained" onClick={handleSaveProductionNote} sx={{ bgcolor: '#f97316', fontSize: 10 }}>
                                  Lagre
                                </Button>
                                <Button size="small" onClick={handleCancelProductionNote} sx={{ color: '#6b7280', fontSize: 10 }}>
                                  Avbryt
                                </Button>
                              </Stack>
                            </Stack>
                          ) : (
                            <Typography sx={{ fontSize: 12, color: '#9ca3af' }}>
                              {productionNotes[selectedScene.id]?.director || 'Klikk for å legge til regissør note...'}
                            </Typography>
                          )}
                        </Box>
                        {!(editingProductionNote?.sceneId === selectedScene.id && editingProductionNote?.type === 'director') && (
                          <IconButton 
                            size="small" 
                            onClick={() => handleEditProductionNote(selectedScene.id, 'director')}
                            sx={{ color: '#4b5563', '&:hover': { color: '#fb923c' } }}
                          >
                            <EditIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        )}
                      </Box>

                      {/* Scene Status Quick Actions */}
                      <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        p: 1.5,
                        bgcolor: 'rgba(0,0,0,0.2)',
                        borderRadius: '10px',
                        border: '1px solid #252d3d',
                      }}>
                        <Typography sx={{ fontSize: 10, color: '#6b7280', fontWeight: 600, mr: 1 }}>STATUS:</Typography>
                        {[
                          { value: 'not-started', label: 'Ikke startet', color: '#6b7280' },
                          { value: 'in-progress', label: 'Pågår', color: '#f59e0b' },
                          { value: 'complete', label: 'Ferdig', color: '#10b981' },
                        ].map((status) => (
                          <Chip
                            key={status.value}
                            label={status.label}
                            size="small"
                            onClick={() => handleSetSceneStatus(selectedScene.id, status.value as 'not-started' | 'in-progress' | 'complete')}
                            sx={{
                              bgcolor: sceneStatuses[selectedScene.id] === status.value 
                                ? `${status.color}30` 
                                : 'rgba(255,255,255,0.05)',
                              color: sceneStatuses[selectedScene.id] === status.value 
                                ? status.color 
                                : '#6b7280',
                              border: sceneStatuses[selectedScene.id] === status.value 
                                ? `1px solid ${status.color}` 
                                : '1px solid transparent',
                              fontSize: 10,
                              height: 24,
                              cursor: 'pointer',
                              '&:hover': { 
                                bgcolor: `${status.color}20`,
                                color: status.color,
                              },
                            }}
                          />
                        ))}
                      </Box>
                    </Stack>
                  )}
                </Box>

                {/* Storyboard Shots - Enhanced */}
                <Box sx={{ p: 3 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', letterSpacing: 0.5 }}>
                      STORYBOARD SHOTS
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography sx={{ fontSize: 11, color: '#4b5563' }}>
                        {selectedSceneShots.length} shots
                      </Typography>
                      <Tooltip title="Legg til shot">
                        <IconButton 
                          size="small" 
                          onClick={handleAddNewShot}
                          sx={{ 
                            color: '#6b7280',
                            bgcolor: 'rgba(59,130,246,0.1)',
                            '&:hover': { bgcolor: 'rgba(59,130,246,0.2)', color: '#3b82f6' },
                          }}
                        >
                          <AddIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Stack>
                  
                  {selectedSceneShots.length > 0 ? (
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5 }}>
                      {selectedSceneShots.slice(0, 6).map((shot: CastingShot, idx: number) => (
                        <Box
                          key={shot.id}
                          onClick={() => setSelectedShot(shot)}
                          sx={{
                            borderRadius: '10px',
                            overflow: 'hidden',
                            cursor: 'pointer',
                            border: selectedShot?.id === shot.id 
                              ? '2px solid #3b82f6' 
                              : '1px solid #252d3d',
                            transition: 'all 0.2s',
                            '&:hover': { 
                              borderColor: '#4b5563', 
                              transform: 'translateY(-2px)',
                              boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
                            },
                          }}
                        >
                          <Box
                            sx={{
                              position: 'relative',
                              paddingTop: '56.25%',
                              bgcolor: '#1e2536',
                              backgroundImage: shotMetadata[shot.id]?.thumbnailUrl 
                                ? `url(${shotMetadata[shot.id].thumbnailUrl})` 
                                : shot.imageUrl 
                                  ? `url(${shot.imageUrl})` 
                                  : 'linear-gradient(135deg, #252d3d 0%, #1a2230 100%)',
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                            }}
                          >
                            <Box sx={{
                              position: 'absolute',
                              top: 8,
                              left: 8,
                              px: 1,
                              py: 0.25,
                              borderRadius: '4px',
                              bgcolor: selectedShot?.id === shot.id ? '#3b82f6' : 'rgba(0,0,0,0.7)',
                            }}>
                              <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>
                                {shot.shotType || `SHOT ${idx + 1}`}
                              </Typography>
                            </Box>
                            <Box sx={{
                              position: 'absolute',
                              bottom: 0,
                              left: 0,
                              right: 0,
                              p: 1,
                              background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                            }}>
                              <Typography sx={{ fontSize: 11, fontWeight: 500, color: '#fff' }}>
                                {shot.description 
                                  ? shot.description.substring(0, 30) + (shot.description.length > 30 ? '...' : '')
                                  : `Scene ${selectedScene?.sceneNumber} - Shot ${idx + 1}`}
                              </Typography>
                            </Box>
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  ) : (
                    /* Empty state for no shots */
                    <Box sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      p: 4,
                      borderRadius: '12px',
                      bgcolor: 'rgba(0,0,0,0.2)',
                      border: '2px dashed #374151',
                    }}>
                      <Box sx={{
                        width: 48,
                        height: 48,
                        borderRadius: '12px',
                        bgcolor: 'rgba(59,130,246,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mb: 2,
                      }}>
                        <MovieIcon sx={{ fontSize: 24, color: '#3b82f6' }} />
                      </Box>
                      <Typography sx={{ fontSize: 13, color: '#6b7280', mb: 1 }}>
                        Ingen shots i denne scenen
                      </Typography>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={handleAddNewShot}
                        sx={{
                          bgcolor: '#3b82f6',
                          fontSize: 11,
                          px: 2,
                          '&:hover': { bgcolor: '#2563eb' },
                        }}
                      >
                        Legg til første shot
                      </Button>
                    </Box>
                  )}
                </Box>
              </Box>
            ) : (
              <Box sx={{ 
                flex: 1, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexDirection: 'column',
                gap: 2,
              }}>
                <Box sx={{
                  width: 80,
                  height: 80,
                  borderRadius: '20px',
                  bgcolor: 'rgba(59,130,246,0.1)',
                  border: '2px dashed #3b82f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <MovieIcon sx={{ fontSize: 36, color: '#3b82f6' }} />
                </Box>
                <Typography sx={{ fontSize: 16, color: '#6b7280', fontWeight: 500 }}>
                  Velg en scene fra listen
                </Typography>
                <Typography sx={{ fontSize: 13, color: '#4b5563' }}>
                  Klikk på en scene i venstre panel for å se manuskriptet
                </Typography>
              </Box>
            )}
          </Box>

          {/* TIMELINE - ENHANCED */}
          <Box
            sx={{
              bgcolor: '#0f1318',
              borderTop: '1px solid #1e2536',
              display: isMobile ? 'none' : 'block', // Hide timeline on mobile
            }}
          >
        {/* Timeline Header - Enhanced */}
        <Box
          sx={{
            px: isMobile ? 1.5 : 3,
            py: isMobile ? 1 : 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #1e2536',
            background: 'linear-gradient(180deg, #141a22 0%, #0f1318 100%)',
            flexWrap: isTablet ? 'wrap' : 'nowrap',
            gap: isTablet ? 1 : 0,
          }}
        >
          <Stack direction="row" spacing={isTablet ? 1 : 2} alignItems="center">
            <Box sx={{
              px: isTablet ? 1 : 1.5,
              py: 0.5,
              borderRadius: '6px',
              bgcolor: 'rgba(139,92,246,0.15)',
              border: '1px solid rgba(139,92,246,0.3)',
            }}>
              <Typography sx={{ fontSize: responsive.bodyFontSize - 2, fontWeight: 700, color: '#a78bfa', letterSpacing: 1 }}>
                TIMELINE
              </Typography>
            </Box>
            
            {/* Playback Controls */}
            <Stack direction="row" spacing={0.5}>
              <Tooltip title={timelineIsPlaying ? "Pause" : "Play"}>
                <IconButton
                  size={responsive.buttonSize}
                  onClick={handleTimelinePlay}
                  sx={{
                    color: timelineIsPlaying ? '#10b981' : '#6b7280',
                    bgcolor: timelineIsPlaying ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)',
                    '&:hover': { bgcolor: 'rgba(16,185,129,0.2)' },
                    p: isTablet ? 0.5 : 1,
                  }}
                >
                  {timelineIsPlaying ? <PauseIcon sx={{ fontSize: responsive.iconSize - 4 }} /> : <PlayIcon sx={{ fontSize: responsive.iconSize - 4 }} />}
                </IconButton>
              </Tooltip>
              <Tooltip title="Zoom inn">
                <IconButton
                  size={responsive.buttonSize}
                  onClick={handleTimelineZoomIn}
                  disabled={timelineZoom >= 4}
                  sx={{
                    color: '#6b7280',
                    '&:hover': { color: '#3b82f6' },
                    '&:disabled': { color: '#374151' },
                    p: isTablet ? 0.5 : 1,
                  }}
                >
                  <ZoomInIcon sx={{ fontSize: responsive.iconSize - 4 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Zoom ut">
                <IconButton
                  size={responsive.buttonSize}
                  onClick={handleTimelineZoomOut}
                  disabled={timelineZoom <= 0.5}
                  sx={{
                    color: '#6b7280',
                    '&:hover': { color: '#3b82f6' },
                    '&:disabled': { color: '#374151' },
                    p: isTablet ? 0.5 : 1,
                  }}
                >
                  <ZoomOutIcon sx={{ fontSize: responsive.iconSize - 4 }} />
                </IconButton>
              </Tooltip>
              {!isTablet && (
                <Typography sx={{ fontSize: responsive.bodyFontSize - 2, color: '#6b7280', px: 1, display: 'flex', alignItems: 'center' }}>
                  {timelineZoom}x
                </Typography>
              )}
            </Stack>
            
            {!isTablet && (
              <Typography sx={{ fontSize: responsive.bodyFontSize, color: '#6b7280' }}>
                {timelineData.blocks.length} shots • {scenes.length} scener
              </Typography>
            )}
          </Stack>
          <Stack direction="row" spacing={isTablet ? 0.5 : 1} alignItems="center">
            {!isTablet && (
              <Box sx={{
                px: 1.5,
                py: 0.5,
                borderRadius: '6px',
                bgcolor: 'rgba(234,179,8,0.15)',
                border: '1px solid rgba(234,179,8,0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}>
                <WarningIcon sx={{ fontSize: 14, color: '#fbbf24' }} />
                <Typography sx={{ fontSize: responsive.bodyFontSize - 2, fontWeight: 600, color: '#fcd34d' }}>
                  Overtid: +{getOvertimeDuration()}
                </Typography>
              </Box>
            )}
            <Typography sx={{ fontSize: responsive.bodyFontSize + 1, fontWeight: 700, color: '#fff' }}>
              {formatTime(getTotalDuration())}
            </Typography>
            <Tooltip title={timelineViewMode === 'grid' ? "Grid view aktiv" : "Grid view"}>
              <IconButton 
                size={responsive.buttonSize}
                onClick={() => handleTimelineViewChange('grid')}
                sx={{ 
                  color: timelineViewMode === 'grid' ? '#3b82f6' : '#6b7280', 
                  bgcolor: timelineViewMode === 'grid' ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.05)',
                  '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.1)' },
                  p: isTablet ? 0.5 : 1,
                }}
              >
                <GridViewIcon sx={{ fontSize: responsive.iconSize - 4 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title={timelineViewMode === 'list' ? "List view aktiv" : "List view"}>
              <IconButton 
                size={responsive.buttonSize}
                onClick={() => handleTimelineViewChange('list')}
                sx={{ 
                  color: timelineViewMode === 'list' ? '#3b82f6' : '#6b7280', 
                  bgcolor: timelineViewMode === 'list' ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.05)',
                  '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.1)' },
                  p: isTablet ? 0.5 : 1,
                }}
              >
                <ViewListIcon sx={{ fontSize: responsive.iconSize - 4 }} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>

        {/* Scene Labels - Enhanced */}
        <Box
          sx={{
            px: 2,
            py: 0.75,
            display: 'flex',
            alignItems: 'center',
            borderBottom: '1px solid #1e2536',
            bgcolor: 'rgba(0,0,0,0.2)',
          }}
        >
          <Box sx={{ width: 50, flexShrink: 0 }}>
            <Typography sx={{ fontSize: 9, color: '#4b5563', fontWeight: 600 }}>SCENER</Typography>
          </Box>
          <Box sx={{ flex: 1, display: 'flex' }}>
            {scenes.slice(0, 6).map((scene, idx) => (
              <Box
                key={scene.id}
                onClick={() => scrollToScene(scene)}
                sx={{
                  flex: 1,
                  textAlign: 'center',
                  cursor: 'pointer',
                  py: 0.5,
                  borderRadius: '4px',
                  bgcolor: selectedScene?.id === scene.id ? 'rgba(59,130,246,0.2)' : 'transparent',
                  transition: 'all 0.2s',
                  '&:hover': { bgcolor: 'rgba(59,130,246,0.1)' },
                }}
              >
                <Typography sx={{ 
                  fontSize: 10, 
                  color: selectedScene?.id === scene.id ? '#60a5fa' : '#6b7280', 
                  fontWeight: 600,
                }}>
                  S{(scene.sceneNumber ?? idx + 1).toString().padStart(2, '0')}
                </Typography>
              </Box>
            ))}
          </Box>
          <Box sx={{ width: 60, flexShrink: 0 }} />
        </Box>

        {/* Audio Track - Enhanced */}
        <Box
          sx={{
            px: 2,
            py: 1,
            display: 'flex',
            alignItems: 'center',
            borderBottom: '1px solid #1e2536',
          }}
        >
          <Box sx={{ 
            width: 50, 
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
          }}>
            <Box sx={{
              width: 24,
              height: 24,
              borderRadius: '6px',
              bgcolor: 'rgba(234,179,8,0.15)',
              border: '1px solid rgba(234,179,8,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <MicIcon sx={{ fontSize: 12, color: '#fbbf24' }} />
            </Box>
          </Box>
          <Box
            sx={{
              flex: 1,
              height: 32,
              bgcolor: '#1a2230',
              borderRadius: '8px',
              border: '1px solid #252d3d',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Waveform simulation - Enhanced */}
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                px: 2,
              }}
            >
              {Array.from({ length: 100 }).map((_, i) => (
                <Box
                  key={i}
                  sx={{
                    width: 2,
                    height: `${Math.sin(i * 0.2) * 30 + 40 + Math.random() * 20}%`,
                    bgcolor: i < 15 ? 'rgba(59,130,246,0.6)' : 'rgba(234,179,8,0.4)',
                    borderRadius: '1px',
                    transition: 'all 0.1s',
                  }}
                />
              ))}
            </Box>
          </Box>
          <Box sx={{ width: 60, flexShrink: 0, textAlign: 'right', pl: 1 }}>
            <Typography sx={{ fontSize: 10, color: '#6b7280' }}>AUDIO</Typography>
          </Box>
        </Box>

        {/* Video Track - Shot Blocks - Enhanced */}
        <Box
          sx={{
            px: 2,
            py: 1,
            display: 'flex',
            alignItems: 'center',
            borderBottom: '1px solid #1e2536',
          }}
        >
          <Box sx={{ 
            width: 50, 
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
          }}>
            <Box sx={{
              width: 24,
              height: 24,
              borderRadius: '6px',
              bgcolor: 'rgba(59,130,246,0.15)',
              border: '1px solid rgba(59,130,246,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <MovieIcon sx={{ fontSize: 12, color: '#60a5fa' }} />
            </Box>
          </Box>
          <Box
            sx={{
              flex: 1,
              height: 44,
              display: 'flex',
              gap: '3px',
              bgcolor: '#1a2230',
              borderRadius: '8px',
              border: '1px solid #252d3d',
              p: 0.5,
              overflowX: timelineZoom > 1 ? 'auto' : 'hidden',
              '&::-webkit-scrollbar': { height: 6 },
              '&::-webkit-scrollbar-thumb': { bgcolor: '#374151', borderRadius: 3 },
            }}
          >
            {timelineData.blocks.map((block, idx) => (
              <Tooltip 
                key={idx} 
                title={`${block.label} • Scene ${block.scene.sceneNumber}`}
                placement="top"
              >
                <Box
                  onClick={() => {
                    scrollToScene(block.scene);
                    if (block.shot.id) setSelectedShot(block.shot);
                  }}
                  sx={{
                    flex: `0 0 ${Math.max(block.width * timelineZoom, 4)}%`,
                    minWidth: `${Math.max(block.width * timelineZoom, 4)}%`,
                    height: '100%',
                    bgcolor: block.color,
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'all 0.2s',
                    border: selectedShot?.id === block.shot.id ? '2px solid #fff' : '1px solid rgba(0,0,0,0.2)',
                    boxShadow: selectedShot?.id === block.shot.id 
                      ? '0 0 10px rgba(255,255,255,0.3)' 
                      : '0 2px 4px rgba(0,0,0,0.2)',
                    '&:hover': {
                      transform: 'scaleY(1.15)',
                      zIndex: 10,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    },
                  }}
                >
                  {block.width > 6 && (
                    <Typography
                      sx={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: '#fff',
                        textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                        letterSpacing: 0.5,
                      }}
                    >
                      {block.label}
                    </Typography>
                  )}
                </Box>
              </Tooltip>
            ))}
          </Box>
          <Box sx={{ width: 60, flexShrink: 0, textAlign: 'right', pl: 1 }}>
            <Typography sx={{ fontSize: 10, color: '#6b7280' }}>VIDEO</Typography>
          </Box>
        </Box>

        {/* Time Ruler - Enhanced */}
        <Box
          sx={{
            px: 2,
            py: 1,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Box sx={{ 
            width: 50, 
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
          }}>
            <Box sx={{
              width: 24,
              height: 24,
              borderRadius: '6px',
              bgcolor: 'rgba(239,68,68,0.15)',
              border: '1px solid rgba(239,68,68,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <PlayIcon sx={{ fontSize: 12, color: '#f87171' }} />
            </Box>
          </Box>
          <Box
            onClick={handleTimelineSeek}
            sx={{
              flex: 1,
              height: 28,
              position: 'relative',
              bgcolor: '#1a2230',
              borderRadius: '8px',
              border: '1px solid #252d3d',
              cursor: 'pointer',
              '&:hover': { borderColor: '#3b82f6' },
            }}
          >
            {/* Time markers */}
            <Box
              sx={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                pointerEvents: 'none',
              }}
            >
              {['00:00', '00:30', '01:00', '01:30', '02:00', '02:30', '03:00'].map((time, idx) => (
                <Box
                  key={idx}
                  sx={{
                    flex: 1,
                    textAlign: 'center',
                    position: 'relative',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRight: idx < 6 ? '1px solid #252d3d' : 'none',
                  }}
                >
                  <Typography sx={{ fontSize: 9, color: '#4b5563', fontWeight: 500 }}>
                    {time}
                  </Typography>
                </Box>
              ))}
            </Box>
            
            {/* Playhead - Enhanced */}
            <Box
              sx={{
                position: 'absolute',
                left: `${timelinePlayheadPosition}%`,
                top: -6,
                bottom: -6,
                width: 3,
                bgcolor: '#ef4444',
                zIndex: 100,
                borderRadius: '2px',
                boxShadow: '0 0 8px rgba(239,68,68,0.5)',
                transition: timelineIsPlaying ? 'none' : 'left 0.1s',
                pointerEvents: 'none',
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  top: -2,
                  left: -5,
                  width: 0,
                  height: 0,
                  borderLeft: '6px solid transparent',
                  borderRight: '6px solid transparent',
                  borderTop: '8px solid #ef4444',
                }}
              />
            </Box>
          </Box>
          <Box sx={{ width: 60, flexShrink: 0, textAlign: 'right', pl: 1 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#ef4444' }}>
              {formatTime(timelineCurrentTime)}
            </Typography>
          </Box>
        </Box>
      </Box>
      </Box>

      {/* RIGHT SIDEBAR - Shot Details */}
      <Box
        sx={{
          width: 280,
          bgcolor: '#1e2536',
          borderLeft: '1px solid #2a3142',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'visible',
          position: 'relative',
        }}
      >
        {/* Scene Header - synced with center panel */}
        <Box
          sx={{
            p: 2,
            borderBottom: '1px solid #2a3142',
            bgcolor: '#252d3d',
          }}
        >
          <Typography sx={{ fontSize: 11, color: '#6b7280', mb: 0.5, letterSpacing: 0.5 }}>
            AKTIV SCENE
          </Typography>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
            {selectedScene?.sceneNumber || 'SCENE 1'} — {selectedScene?.intExt || 'INT'}. {selectedScene?.locationName?.toUpperCase() || 'LOCATION'} – {selectedScene?.timeOfDay || 'DAY'}
          </Typography>
        </Box>

        {/* Shot Selector */}
        <Box
          sx={{
            px: 2,
            py: 1.5,
            borderBottom: '1px solid #2a3142',
          }}
        >
          <Box
            onClick={(e) => {
              setShotSelectorAnchor(e.currentTarget);
              setShotSelectorOpen(true);
            }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              p: 1,
              mx: -1,
              borderRadius: 1,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
            }}
          >
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
              SHOT {selectedSceneShots.indexOf(selectedShot!) + 1 || 1}: {selectedShot?.shotType || 'CLOSE-UP'}
            </Typography>
            <ExpandMoreIcon sx={{ fontSize: 18, color: '#6b7280' }} />
          </Box>
          
          {/* Shot Selector Menu */}
          <Menu
            anchorEl={shotSelectorAnchor}
            open={shotSelectorOpen}
            onClose={() => setShotSelectorOpen(false)}
            PaperProps={{
              sx: {
                bgcolor: '#1e2536',
                border: '1px solid #2a3142',
                minWidth: 200,
              },
            }}
          >
            {selectedSceneShots.length > 0 ? (
              selectedSceneShots.map((shot: CastingShot, idx: number) => (
                <MenuItem
                  key={shot.id}
                  onClick={() => {
                    setSelectedShot(shot);
                    setShotSelectorOpen(false);
                  }}
                  sx={{
                    color: '#fff',
                    '&:hover': { bgcolor: 'rgba(59, 130, 246, 0.2)' },
                    bgcolor: selectedShot?.id === shot.id ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                  }}
                >
                  SHOT {idx + 1}: {shot.shotType}
                </MenuItem>
              ))
            ) : (
              [1, 2, 3].map((idx) => (
                <MenuItem
                  key={idx}
                  onClick={() => setShotSelectorOpen(false)}
                  sx={{ color: '#fff', '&:hover': { bgcolor: 'rgba(59, 130, 246, 0.2)' } }}
                >
                  SHOT {idx}: {idx === 1 ? 'WIDE' : idx === 2 ? 'CLOSE-UP' : 'MEDIUM'}
                </MenuItem>
              ))
            )}
          </Menu>
        </Box>

        {/* SHOT INSPECTOR - Shows when shot is selected */}
        {selectedShot && shotMetadata[selectedShot.id] && (
          <Box sx={{ borderBottom: '1px solid #2a3142', bgcolor: '#0f4c3f' }}>
            <Box
              sx={{
                px: 2,
                py: 1.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                bgcolor: '#0a2f28',
                borderBottom: '1px solid #2a3142',
              }}
            >
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#10b981' }}>
                SHOT INSPECTOR
              </Typography>
              <IconButton
                size="small"
                onClick={() => setSelectedShot(null)}
                sx={{ color: '#6b7280', p: 0.5 }}
              >
                <CloseIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Box>
            <Box sx={{ p: 2 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#fff', mb: 1.5 }}>
                {selectedShot.description || 'Shot Details'}
              </Typography>
              
              {/* Camera */}
              <Box sx={{ mb: 1.5, pb: 1.5, borderBottom: '1px solid #1f3a33' }}>
                <Typography sx={{ fontSize: 11, color: '#6b7280', mb: 1, fontWeight: 600 }}>KAMERA</Typography>
                <Stack spacing={0.75}>
                  <Box sx={{ bgcolor: '#1a2f28', p: 1, borderRadius: 0.75 }}>
                    <Typography sx={{ fontSize: 10, color: '#6b7280' }}>Linse</Typography>
                    <Typography sx={{ fontSize: 12, color: '#fff' }}>{shotMetadata[selectedShot.id]?.camera?.lens || 'Not set'}</Typography>
                  </Box>
                  <Box sx={{ bgcolor: '#1a2f28', p: 1, borderRadius: 0.75 }}>
                    <Typography sx={{ fontSize: 10, color: '#6b7280' }}>Bevegelse</Typography>
                    <Typography sx={{ fontSize: 12, color: '#fff' }}>{shotMetadata[selectedShot.id]?.camera?.movement || 'Not set'}</Typography>
                  </Box>
                  <Box sx={{ bgcolor: '#1a2f28', p: 1, borderRadius: 0.75 }}>
                    <Typography sx={{ fontSize: 10, color: '#6b7280' }}>Framing</Typography>
                    <Typography sx={{ fontSize: 12, color: '#fff' }}>{shotMetadata[selectedShot.id]?.camera?.framing || 'Not set'}</Typography>
                  </Box>
                </Stack>
              </Box>

              {/* Lighting */}
              <Box sx={{ mb: 1.5, pb: 1.5, borderBottom: '1px solid #1f3a33' }}>
                <Typography sx={{ fontSize: 11, color: '#6b7280', mb: 1, fontWeight: 600 }}>LYS</Typography>
                <Stack spacing={0.75}>
                  <Box sx={{ bgcolor: '#1a2f28', p: 1, borderRadius: 0.75 }}>
                    <Typography sx={{ fontSize: 10, color: '#6b7280' }}>Key Light</Typography>
                    <Typography sx={{ fontSize: 12, color: '#fff' }}>{shotMetadata[selectedShot.id]?.lighting?.key || 'Not set'}</Typography>
                  </Box>
                  <Box sx={{ bgcolor: '#1a2f28', p: 1, borderRadius: 0.75 }}>
                    <Typography sx={{ fontSize: 10, color: '#6b7280' }}>Temp</Typography>
                    <Typography sx={{ fontSize: 12, color: '#fff' }}>{shotMetadata[selectedShot.id]?.lighting?.temp || 'Not set'}</Typography>
                  </Box>
                  <Box sx={{ bgcolor: '#1a2f28', p: 1, borderRadius: 0.75 }}>
                    <Typography sx={{ fontSize: 10, color: '#6b7280' }}>Ratio</Typography>
                    <Typography sx={{ fontSize: 12, color: '#fff' }}>{shotMetadata[selectedShot.id]?.lighting?.ratio || 'Not set'}</Typography>
                  </Box>
                </Stack>
              </Box>

              {/* Sound */}
              <Box>
                <Typography sx={{ fontSize: 11, color: '#6b7280', mb: 1, fontWeight: 600 }}>LYD</Typography>
                <Stack spacing={0.75}>
                  <Box sx={{ bgcolor: '#1a2f28', p: 1, borderRadius: 0.75 }}>
                    <Typography sx={{ fontSize: 10, color: '#6b7280' }}>Mic</Typography>
                    <Typography sx={{ fontSize: 12, color: '#fff' }}>{shotMetadata[selectedShot.id]?.sound?.mic || 'Not set'}</Typography>
                  </Box>
                  <Box sx={{ bgcolor: '#1a2f28', p: 1, borderRadius: 0.75 }}>
                    <Typography sx={{ fontSize: 10, color: '#6b7280' }}>Ambience</Typography>
                    <Typography sx={{ fontSize: 12, color: '#fff' }}>{shotMetadata[selectedShot.id]?.sound?.ambience || 'Not set'}</Typography>
                  </Box>
                  <Box sx={{ bgcolor: '#1a2f28', p: 1, borderRadius: 0.75 }}>
                    <Typography sx={{ fontSize: 10, color: '#6b7280' }}>Notes</Typography>
                    <Typography sx={{ fontSize: 12, color: '#fff' }}>{shotMetadata[selectedShot.id]?.sound?.notes || 'Not set'}</Typography>
                  </Box>
                </Stack>
              </Box>
            </Box>
          </Box>
        )}

        {/* Shot Details Content */}
        <Box sx={{ flex: 1, overflow: 'visible' }}>
          {/* KAMERAUTSTYR Section - Enhanced Professional Design */}
          <Box sx={{ 
            borderBottom: '1px solid #2a3142',
            background: 'linear-gradient(180deg, rgba(59,130,246,0.03) 0%, transparent 100%)',
          }}>
            <Box
              onClick={() => setExpandedSections(prev => ({ ...prev, camera: !prev.camera }))}
                sx={{
                  px: 2,
                  py: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  borderLeft: '3px solid #3b82f6',
                  transition: 'all 0.2s',
                  '&:hover': { bgcolor: 'rgba(59,130,246,0.08)' },
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '8px',
                    bgcolor: 'rgba(59,130,246,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#e5e7eb', letterSpacing: 0.5 }}>
                      KAMERAUTSTYR
                    </Typography>
                    <Typography sx={{ fontSize: 10, color: '#6b7280' }}>
                      {shotProperties.camera} • {shotProperties.lens}
                    </Typography>
                  </Box>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  {getEquipmentByCategory('camera').length > 0 && (
                    <Tooltip title="Koblet til utstyrsinventar">
                      <Box sx={{
                        px: 1,
                        py: 0.25,
                        borderRadius: '4px',
                        bgcolor: 'rgba(16,185,129,0.15)',
                        border: '1px solid rgba(16,185,129,0.3)',
                      }}>
                        <Typography sx={{ fontSize: 9, color: '#10b981', fontWeight: 600 }}>
                          SYNKRONISERT
                        </Typography>
                      </Box>
                    </Tooltip>
                  )}
                  {expandedSections.camera ? (
                    <ExpandLessIcon sx={{ fontSize: 18, color: '#3b82f6' }} />
                  ) : (
                    <ExpandMoreIcon sx={{ fontSize: 18, color: '#6b7280' }} />
                  )}
                </Stack>
              </Box>
              <Collapse in={expandedSections.camera}>
                <Stack spacing={2} sx={{ px: 2, pb: 2.5, pt: 1 }}>
                  
                  {/* Camera & Lens Row */}
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                    {/* 1. Kamera */}
                    <FormControl fullWidth size="small">
                      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.5 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2">
                          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                          <circle cx="12" cy="13" r="4"/>
                        </svg>
                        <Typography sx={{ fontSize: 10, color: '#60a5fa', fontWeight: 600 }}>KAMERA</Typography>
                      </Stack>
                      <Select
                        value={getValidCameraValue(shotProperties.camera)}
                        onChange={(e) => setShotProperties(prev => ({ ...prev, camera: e.target.value }))}
                        sx={{
                          bgcolor: '#252d3d',
                          color: '#e5e7eb',
                          fontSize: 12,
                          borderRadius: '8px',
                          border: '1px solid #374151',
                          '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                          '& .MuiSelect-icon': { color: '#60a5fa' },
                          '&:hover': { bgcolor: '#2d3748', borderColor: '#3b82f6' },
                          '&.Mui-focused': { borderColor: '#3b82f6' },
                        }}
                        MenuProps={{
                          sx: { zIndex: 1400 },
                          PaperProps: {
                            sx: {
                              bgcolor: '#1e2536',
                              border: '1px solid #3b82f6',
                              borderRadius: '8px',
                              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                              '& .MuiMenuItem-root': {
                                fontSize: 13,
                                color: '#fff',
                                py: 1,
                                '&:hover': { bgcolor: 'rgba(59, 130, 246, 0.2)' },
                                '&.Mui-selected': { bgcolor: 'rgba(59, 130, 246, 0.15)' },
                              },
                            },
                          },
                        }}
                      >
                        {getEquipmentByCategory('camera').length > 0 && [
                          <MenuItem key="inv-header" disabled sx={{ fontSize: 10, color: '#10b981 !important', fontWeight: 700, letterSpacing: 0.5 }}>
                            <Stack direction="row" spacing={0.5} alignItems="center"><CheckIcon sx={{ fontSize: 12 }} /> FRA INVENTAR</Stack>
                          </MenuItem>,
                          ...getEquipmentByCategory('camera').map((item) => (
                            <MenuItem key={item.id} value={item.name}>
                              <Stack direction="row" alignItems="center" spacing={1}>
                                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#10b981' }} />
                                <span>{item.name}</span>
                              </Stack>
                            </MenuItem>
                          )),
                          <Divider key="div-1" sx={{ bgcolor: '#2a3142', my: 0.5 }} />,
                        ]}
                        <MenuItem disabled sx={{ fontSize: 10, color: '#6b7280 !important', fontWeight: 600, letterSpacing: 0.5 }}>
                          STANDARD
                        </MenuItem>
                        {AVAILABLE_CAMERAS.map((camera) => (
                          <MenuItem key={camera} value={camera}>{camera}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    {/* 2. Linse */}
                    <FormControl fullWidth size="small">
                      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.5 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"/>
                          <circle cx="12" cy="12" r="6"/>
                          <circle cx="12" cy="12" r="2"/>
                        </svg>
                        <Typography sx={{ fontSize: 10, color: '#a78bfa', fontWeight: 600 }}>LINSE</Typography>
                      </Stack>
                      <Select
                        value={shotProperties.lens}
                        onChange={(e) => setShotProperties(prev => ({ ...prev, lens: e.target.value }))}
                        sx={{
                          bgcolor: '#252d3d',
                          color: '#e5e7eb',
                          fontSize: 12,
                          borderRadius: '8px',
                          border: '1px solid #374151',
                          '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                          '& .MuiSelect-icon': { color: '#a78bfa' },
                          '&:hover': { bgcolor: '#2d3748', borderColor: '#8b5cf6' },
                          '&.Mui-focused': { borderColor: '#8b5cf6' },
                        }}
                        MenuProps={{
                          sx: { zIndex: 1400 },
                          PaperProps: {
                            sx: {
                              bgcolor: '#1e2536',
                              border: '1px solid #8b5cf6',
                              borderRadius: '8px',
                              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                              '& .MuiMenuItem-root': {
                                fontSize: 13,
                                color: '#fff',
                                py: 1,
                                '&:hover': { bgcolor: 'rgba(139, 92, 246, 0.2)' },
                                '&.Mui-selected': { bgcolor: 'rgba(139, 92, 246, 0.15)' },
                              },
                            },
                          },
                        }}
                      >
                        {getEquipmentByCategory('lens').length > 0 && [
                          <MenuItem key="inv-header" disabled sx={{ fontSize: 10, color: '#10b981 !important', fontWeight: 700, letterSpacing: 0.5 }}>
                            <Stack direction="row" spacing={0.5} alignItems="center"><CheckIcon sx={{ fontSize: 12 }} /> FRA INVENTAR</Stack>
                          </MenuItem>,
                          ...getEquipmentByCategory('lens').map((item) => (
                            <MenuItem key={item.id} value={item.name}>
                              <Stack direction="row" alignItems="center" spacing={1}>
                                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#10b981' }} />
                                <span>{item.name}</span>
                              </Stack>
                            </MenuItem>
                          )),
                          <Divider key="div-1" sx={{ bgcolor: '#2a3142', my: 0.5 }} />,
                        ]}
                        <MenuItem disabled sx={{ fontSize: 10, color: '#6b7280 !important', fontWeight: 600, letterSpacing: 0.5 }}>
                          STANDARD
                        </MenuItem>
                        {['50mm Prime', '35mm Prime', '85mm Prime', '24-70mm Zoom', '70-200mm Zoom', '16mm Wide', '100mm Macro'].map((lens) => (
                          <MenuItem key={lens} value={lens}>{lens}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>

                  {/* Rig & Shot-type Row */}
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                    {/* 3. Rig */}
                    <FormControl fullWidth size="small">
                      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.5 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2">
                          <rect x="2" y="7" width="20" height="10" rx="2"/>
                          <path d="M12 17v4M8 21h8M6 7V3h12v4"/>
                        </svg>
                        <Typography sx={{ fontSize: 10, color: '#f97316', fontWeight: 600 }}>RIG</Typography>
                      </Stack>
                      <Select
                        value={shotProperties.rig}
                        onChange={(e) => setShotProperties(prev => ({ ...prev, rig: e.target.value }))}
                        sx={{
                          bgcolor: '#252d3d',
                          color: '#e5e7eb',
                          fontSize: 12,
                          borderRadius: '8px',
                          border: '1px solid #374151',
                          '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                          '& .MuiSelect-icon': { color: '#f97316' },
                          '&:hover': { bgcolor: '#2d3748', borderColor: '#f97316' },
                          '&.Mui-focused': { borderColor: '#f97316' },
                        }}
                        MenuProps={{
                          sx: { zIndex: 1400 },
                          PaperProps: {
                            sx: {
                              bgcolor: '#1e2536',
                              border: '1px solid #f97316',
                              borderRadius: '8px',
                              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                              '& .MuiMenuItem-root': {
                                fontSize: 13,
                                color: '#fff',
                                py: 1,
                                '&:hover': { bgcolor: 'rgba(249, 115, 22, 0.2)' },
                                '&.Mui-selected': { bgcolor: 'rgba(249, 115, 22, 0.15)' },
                              },
                            },
                          },
                        }}
                      >
                        {getEquipmentByCategory('rig').length > 0 && [
                          <MenuItem key="inv-header" disabled sx={{ fontSize: 10, color: '#10b981 !important', fontWeight: 700, letterSpacing: 0.5 }}>
                            <Stack direction="row" spacing={0.5} alignItems="center"><CheckIcon sx={{ fontSize: 12 }} /> FRA INVENTAR</Stack>
                          </MenuItem>,
                          ...getEquipmentByCategory('rig').map((item) => (
                            <MenuItem key={item.id} value={item.name}>
                              <Stack direction="row" alignItems="center" spacing={1}>
                                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#10b981' }} />
                                <span>{item.name}</span>
                              </Stack>
                            </MenuItem>
                          )),
                          <Divider key="div-1" sx={{ bgcolor: '#2a3142', my: 0.5 }} />,
                        ]}
                        <MenuItem disabled sx={{ fontSize: 10, color: '#6b7280 !important', fontWeight: 600, letterSpacing: 0.5 }}>
                          STANDARD
                        </MenuItem>
                        {['Stativ', 'Steadicam', 'Gimbal', 'Handheld', 'Dolly', 'Crane', 'Drone', 'Shoulder Rig', 'Slider'].map((rig) => (
                          <MenuItem key={rig} value={rig}>{rig}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    {/* 4. Shot-type */}
                    <FormControl fullWidth size="small">
                      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.5 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                          <rect x="2" y="2" width="20" height="20" rx="2"/>
                          <circle cx="12" cy="12" r="3"/>
                          <path d="M2 12h3M19 12h3M12 2v3M12 19v3"/>
                        </svg>
                        <Typography sx={{ fontSize: 10, color: '#10b981', fontWeight: 600 }}>SHOT-TYPE</Typography>
                      </Stack>
                      <Select
                        value={selectedShot?.shotType || shotProperties.shotType}
                        onChange={(e) => setShotProperties(prev => ({ ...prev, shotType: e.target.value }))}
                        sx={{
                          bgcolor: '#252d3d',
                          color: '#e5e7eb',
                          fontSize: 12,
                          borderRadius: '8px',
                          border: '1px solid #374151',
                          '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                          '& .MuiSelect-icon': { color: '#10b981' },
                          '&:hover': { bgcolor: '#2d3748', borderColor: '#10b981' },
                          '&.Mui-focused': { borderColor: '#10b981' },
                        }}
                        MenuProps={{
                          sx: { zIndex: 1400 },
                          PaperProps: {
                            sx: {
                              bgcolor: '#1e2536',
                              border: '1px solid #10b981',
                              borderRadius: '8px',
                              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                              maxHeight: 300,
                              '& .MuiMenuItem-root': {
                                fontSize: 13,
                                color: '#fff',
                                py: 1,
                                '&:hover': { bgcolor: 'rgba(16, 185, 129, 0.2)' },
                                '&.Mui-selected': { bgcolor: 'rgba(16, 185, 129, 0.15)' },
                              },
                            },
                          },
                        }}
                      >
                        {availableShotTypes.length > 0 && [
                          <MenuItem key="shot-header" disabled sx={{ fontSize: 10, color: '#10b981 !important', fontWeight: 700, letterSpacing: 0.5 }}>
                            <Stack direction="row" spacing={0.5} alignItems="center"><CheckIcon sx={{ fontSize: 12 }} /> FRA SHOT LISTER</Stack>
                          </MenuItem>,
                          ...availableShotTypes.map((type) => (
                            <MenuItem key={`custom-${type}`} value={type}>
                              <Stack direction="row" alignItems="center" spacing={1}>
                                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: SHOT_COLORS[type] || '#666' }} />
                                <span>{type}</span>
                              </Stack>
                            </MenuItem>
                          )),
                          <Divider key="div-shot" sx={{ bgcolor: '#2a3142', my: 0.5 }} />,
                        ]}
                        <MenuItem disabled sx={{ fontSize: 10, color: '#6b7280 !important', fontWeight: 600, letterSpacing: 0.5 }}>
                          STANDARD
                        </MenuItem>
                        {['Wide', 'Medium', 'Close-up', 'Extreme Close-up', 'Establishing', 'Detail', 'Two Shot', 'Over Shoulder', 'POV', 'Insert'].map((type) => (
                          <MenuItem key={type} value={type}>
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: SHOT_COLORS[type] || '#666' }} />
                              <span>{type}</span>
                            </Stack>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>

                  {/* Quick Summary Bar */}
                  <Box sx={{
                    mt: 1,
                    p: 1.5,
                    borderRadius: '8px',
                    bgcolor: 'rgba(59,130,246,0.08)',
                    border: '1px solid rgba(59,130,246,0.2)',
                  }}>
                    <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                      <Typography sx={{ fontSize: 11, color: '#9ca3af' }}>
                        <span style={{ color: '#60a5fa', fontWeight: 600 }}>{shotProperties.camera}</span> + <span style={{ color: '#a78bfa' }}>{shotProperties.lens}</span>
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        <Tooltip title="Kopier innstillinger til neste shot">
                          <IconButton 
                            size="small" 
                            onClick={handleCopySettingsToNextShot}
                            sx={{ p: 0.5, color: '#6b7280', '&:hover': { color: '#3b82f6' } }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="9" y="9" width="13" height="13" rx="2"/>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                            </svg>
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Lagre som preset">
                          <IconButton 
                            size="small" 
                            onClick={() => setShowSavePresetDialog(true)}
                            sx={{ p: 0.5, color: '#6b7280', '&:hover': { color: '#10b981' } }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                              <polyline points="17 21 17 13 7 13 7 21"/>
                              <polyline points="7 3 7 8 15 8"/>
                            </svg>
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Stack>
                  </Box>

                </Stack>
              </Collapse>
            </Box>

            {/* LYS Section - Enhanced */}
            <Box sx={{ 
              borderBottom: '1px solid #2a3142',
              background: 'linear-gradient(180deg, rgba(245,158,11,0.03) 0%, transparent 100%)',
            }}>
              <Box
                onClick={() => setExpandedSections(prev => ({ ...prev, lighting: !prev.lighting }))}
                sx={{
                  px: 2,
                  py: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  borderLeft: '3px solid #f59e0b',
                  transition: 'all 0.2s',
                  '&:hover': { bgcolor: 'rgba(245,158,11,0.08)' },
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '8px',
                    bgcolor: 'rgba(245,158,11,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                      <path d="M9 18h6M10 22h4M12 2v1M4.22 4.22l.71.71M1 12h1M4.22 19.78l.71-.71M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z"/>
                    </svg>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#e5e7eb', letterSpacing: 0.5 }}>
                      LYS
                    </Typography>
                    <Typography sx={{ fontSize: 10, color: '#6b7280' }}>
                      {shotProperties.keyLight} • {shotProperties.gel}
                    </Typography>
                  </Box>
                </Stack>
                {expandedSections.lighting ? (
                  <ExpandLessIcon sx={{ fontSize: 18, color: '#f59e0b' }} />
                ) : (
                  <ExpandMoreIcon sx={{ fontSize: 18, color: '#6b7280' }} />
                )}
              </Box>
              <Collapse in={expandedSections.lighting}>
                <Stack spacing={1.5} sx={{ px: 2, pb: 2.5, pt: 1 }}>
                  <EditableDetailRow
                    icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>}
                    value={shotProperties.keyLight}
                    field="keyLight"
                    isEditing={editingField === 'keyLight'}
                    editValue={editValue}
                    onStartEdit={() => { setEditingField('keyLight'); setEditValue(shotProperties.keyLight); }}
                    onSave={() => { setShotProperties(prev => ({ ...prev, keyLight: editValue })); setEditingField(null); }}
                    onCancel={() => setEditingField(null)}
                    onChange={setEditValue}
                    options={['Mykt sidelys', 'Key Light – 1200W', 'Key Light – 600W', 'Softbox', 'LED Panel', 'HMI', 'Natural Light']}
                  />
                  <EditableDetailRow
                    icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707"/><circle cx="12" cy="12" r="4" fill="currentColor" fillOpacity="0.3"/></svg>}
                    value={shotProperties.sideLight}
                    field="sideLight"
                    isEditing={editingField === 'sideLight'}
                    editValue={editValue}
                    onStartEdit={() => { setEditingField('sideLight'); setEditValue(shotProperties.sideLight); }}
                    onSave={() => { setShotProperties(prev => ({ ...prev, sideLight: editValue })); setEditingField(null); }}
                    onCancel={() => setEditingField(null)}
                    onChange={setEditValue}
                    options={['Varm tone', 'Side Lighting', 'Fill Light', 'Rim Light', 'Back Light', 'Practical', 'Natural']}
                  />
                  <EditableDetailRow
                    icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>}
                    value={shotProperties.gel}
                    field="gel"
                    isEditing={editingField === 'gel'}
                    editValue={editValue}
                    onStartEdit={() => { setEditingField('gel'); setEditValue(shotProperties.gel); }}
                    onSave={() => { setShotProperties(prev => ({ ...prev, gel: editValue })); setEditingField(null); }}
                    onCancel={() => setEditingField(null)}
                    onChange={setEditValue}
                    options={['Gel: Warm 1/4 CTO', 'Gel: Warm 1/2 CTO', 'Gel: Full CTO', 'Gel: 1/4 CTB', 'Gel: 1/2 CTB', 'No Gel']}
                  />
                </Stack>
              </Collapse>
            </Box>

            {/* LYD Section - Enhanced */}
            <Box sx={{ 
              borderBottom: '1px solid #2a3142',
              background: 'linear-gradient(180deg, rgba(59,130,246,0.03) 0%, transparent 100%)',
            }}>
              <Box
                onClick={() => setExpandedSections(prev => ({ ...prev, audio: !prev.audio }))}
                sx={{
                  px: 2,
                  py: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  borderLeft: '3px solid #3b82f6',
                  transition: 'all 0.2s',
                  '&:hover': { bgcolor: 'rgba(59,130,246,0.08)' },
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '8px',
                    bgcolor: 'rgba(59,130,246,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>
                    </svg>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#e5e7eb', letterSpacing: 0.5 }}>
                      LYD
                    </Typography>
                    <Typography sx={{ fontSize: 10, color: '#6b7280' }}>
                      {shotProperties.mic} • {shotProperties.atmos}
                    </Typography>
                  </Box>
                </Stack>
                {expandedSections.audio ? (
                  <ExpandLessIcon sx={{ fontSize: 18, color: '#3b82f6' }} />
                ) : (
                  <ExpandMoreIcon sx={{ fontSize: 18, color: '#6b7280' }} />
                )}
              </Box>
              <Collapse in={expandedSections.audio}>
                <Stack spacing={1.5} sx={{ px: 2, pb: 2.5, pt: 1 }}>
                  <EditableDetailRow
                    icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>}
                    value={shotProperties.mic}
                    field="mic"
                    isEditing={editingField === 'mic'}
                    editValue={editValue}
                    onStartEdit={() => { setEditingField('mic'); setEditValue(shotProperties.mic); }}
                    onSave={() => { setShotProperties(prev => ({ ...prev, mic: editValue })); setEditingField(null); }}
                    onCancel={() => setEditingField(null)}
                    onChange={setEditValue}
                    options={['Boom Mic', 'Lav Mic', 'Shotgun Mic', 'Wireless Lav', 'Plant Mic']}
                  />
                  <EditableDetailRow
                    icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>}
                    value={shotProperties.atmos}
                    field="atmos"
                    isEditing={editingField === 'atmos'}
                    editValue={editValue}
                    onStartEdit={() => { setEditingField('atmos'); setEditValue(shotProperties.atmos); }}
                    onSave={() => { setShotProperties(prev => ({ ...prev, atmos: editValue })); setEditingField(null); }}
                    onCancel={() => setEditingField(null)}
                    onChange={setEditValue}
                    options={['Dempet romlyd', 'Atmos: Stille', 'Atmos: Naturlig', 'Atmos: Bytrafikk', 'Atmos: Natur', 'Atmos: Interiør']}
                  />
                </Stack>
              </Collapse>
            </Box>

            {/* REFERANSER Section - Enhanced */}
            <Box sx={{ 
              background: 'linear-gradient(180deg, rgba(16,185,129,0.03) 0%, transparent 100%)',
            }}>
              <Box
                onClick={() => setExpandedSections(prev => ({ ...prev, references: !prev.references }))}
                sx={{
                  px: 2,
                  py: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  borderLeft: '3px solid #10b981',
                  transition: 'all 0.2s',
                  '&:hover': { bgcolor: 'rgba(16,185,129,0.08)' },
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '8px',
                    bgcolor: 'rgba(16,185,129,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#e5e7eb', letterSpacing: 0.5 }}>
                      REFERANSER
                    </Typography>
                    <Typography sx={{ fontSize: 10, color: '#6b7280' }}>
                      {uploadedReferences.length} opplastet • shot.cafe & Unsplash
                    </Typography>
                  </Box>
                </Stack>
                {expandedSections.references ? (
                  <ExpandLessIcon sx={{ fontSize: 18, color: '#10b981' }} />
                ) : (
                  <ExpandMoreIcon sx={{ fontSize: 18, color: '#6b7280' }} />
                )}
              </Box>
              <Collapse in={expandedSections.references}>
                <Box sx={{ px: 2, pb: 2 }}>
                  {/* Uploaded References */}
                  {uploadedReferences.length > 0 && (
                    <Box sx={{ mb: 1.5 }}>
                      <Typography sx={{ fontSize: 10, color: '#6b7280', mb: 1, letterSpacing: 0.5 }}>
                        OPPLASTEDE
                      </Typography>
                      <Stack direction="column" spacing={1} useFlexGap>
                        {uploadedReferences.map((ref, idx) => (
                          <Box
                            key={idx}
                            sx={{
                              position: 'relative',
                            }}
                          >
                            <Box
                              sx={{
                                width: '100%',
                                height: 50,
                                borderRadius: 1,
                                backgroundImage: `url(${ref})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                cursor: 'pointer',
                                position: 'relative',
                                '&:hover .delete-btn': { opacity: 1 },
                              }}
                            >
                              <IconButton
                                className="delete-btn"
                                size="small"
                                onClick={() => setUploadedReferences(prev => prev.filter((_, i) => i !== idx))}
                                sx={{
                                  position: 'absolute',
                                  top: -6,
                                  right: -6,
                                  bgcolor: '#ef4444',
                                  opacity: 0,
                                  p: 0.25,
                                  '&:hover': { bgcolor: '#dc2626' },
                                }}
                              >
                                <CloseIcon sx={{ fontSize: 12, color: '#fff' }} />
                              </IconButton>
                            </Box>
                            {/* Action buttons */}
                            <Stack direction="row" spacing={0.5} sx={{ mt: 0.75 }}>
                              <Box
                                onClick={() => setCenterPanelReference({
                                  url: ref,
                                  source: 'Opplastet',
                                  title: `Referanse ${idx + 1}`,
                                })}
                                sx={{
                                  flex: 1,
                                  p: 0.5,
                                  bgcolor: '#10b981',
                                  borderRadius: 0.5,
                                  color: '#fff',
                                  fontSize: 9,
                                  fontWeight: 600,
                                  textAlign: 'center',
                                  cursor: 'pointer',
                                  '&:hover': { bgcolor: '#059669' },
                                }}
                              >
                                <Stack direction="row" spacing={0.25} alignItems="center" justifyContent="center"><PinIcon sx={{ fontSize: 10 }} /> Sentrum</Stack>
                              </Box>
                            </Stack>
                          </Box>
                        ))}
                      </Stack>
                    </Box>
                  )}

                  {/* Shot References */}
                  <Stack direction="row" spacing={1} sx={{ mb: 1.5 }} flexWrap="wrap" useFlexGap>
                    {(selectedSceneShots.length > 0 
                      ? selectedSceneShots.slice(0, 3).map((shot: CastingShot, idx: number) => (
                          <Box
                            key={shot.id}
                            sx={{
                              width: 70,
                              height: 50,
                              borderRadius: 1,
                              bgcolor: '#374151',
                              backgroundImage: shot.imageUrl 
                                ? `url(${shot.imageUrl})` 
                                : 'linear-gradient(135deg, #4b5563 0%, #374151 100%)',
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              '&:hover': { transform: 'scale(1.05)' },
                            }}
                            onClick={() => setSelectedShot(shot)}
                          />
                        ))
                      : [1, 2, 3].map((idx) => (
                          <Box
                            key={idx}
                            sx={{
                              width: 70,
                              height: 50,
                              borderRadius: 1,
                              bgcolor: '#374151',
                              backgroundImage: 'linear-gradient(135deg, #4b5563 0%, #374151 100%)',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              '&:hover': { transform: 'scale(1.05)' },
                            }}
                          />
                        ))
                    )}
                  </Stack>
                  
                  {/* Action Buttons */}
                  <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
                    {/* Upload Button */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleReferenceUpload}
                      accept="image/*"
                      multiple
                      style={{ display: 'none' }}
                    />
                    <Box
                      onClick={() => fileInputRef.current?.click()}
                      sx={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 0.5,
                        p: 1,
                        border: '1px dashed #4b5563',
                        borderRadius: 1,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        '&:hover': { 
                          borderColor: '#6b7280',
                          bgcolor: 'rgba(255,255,255,0.02)',
                        },
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                      <Typography sx={{ fontSize: 11, color: '#6b7280' }}>
                        Last opp
                      </Typography>
                    </Box>

                    {/* Search Button */}
                    <Box
                      onClick={() => setReferenceSearchOpen(true)}
                      sx={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 0.5,
                        p: 1,
                        bgcolor: '#3b82f6',
                        borderRadius: 1,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        '&:hover': { bgcolor: '#2563eb' },
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                        <circle cx="11" cy="11" r="8"/>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                      </svg>
                      <Typography sx={{ fontSize: 11, color: '#fff', fontWeight: 500 }}>
                        Søk referanser
                      </Typography>
                    </Box>
                  </Stack>

                  {/* Reference Search Dialog */}
                  {referenceSearchOpen && (
                    <Box
                      sx={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        bgcolor: 'rgba(0,0,0,0.85)',
                        zIndex: 9999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      onClick={() => { setReferenceSearchOpen(false); setSelectedFilm(null); }}
                    >
                      <Box
                        onClick={(e) => e.stopPropagation()}
                        sx={{
                          width: 800,
                          maxHeight: '85vh',
                          bgcolor: '#1e2536',
                          borderRadius: 2,
                          overflow: 'hidden',
                          border: '1px solid #2a3142',
                          display: 'flex',
                          flexDirection: 'column',
                        }}
                      >
                        {/* Search Header */}
                        <Box sx={{ p: 2, borderBottom: '1px solid #2a3142' }}>
                          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                            <Stack direction="row" alignItems="center" spacing={2}>
                              <Typography sx={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>
                                {selectedFilm ? selectedFilm.title : 'Søk Filmreferanser'}
                              </Typography>
                              {selectedFilm && (
                                <Box
                                  onClick={() => setSelectedFilm(null)}
                                  sx={{
                                    px: 1.5,
                                    py: 0.5,
                                    bgcolor: '#374151',
                                    borderRadius: 1,
                                    cursor: 'pointer',
                                    '&:hover': { bgcolor: '#4b5563' },
                                  }}
                                >
                                  <Typography sx={{ fontSize: 11, color: '#9ca3af' }}>← Tilbake til søk</Typography>
                                </Box>
                              )}
                            </Stack>
                            <IconButton size="small" onClick={() => { setReferenceSearchOpen(false); setSelectedFilm(null); }} sx={{ color: '#6b7280' }}>
                              <CloseIcon sx={{ fontSize: 20 }} />
                            </IconButton>
                          </Stack>
                          
                          {!selectedFilm && (
                            <>
                              <TextField
                                fullWidth
                                placeholder="Søk film: Blade Runner, Inception, cinematographer: Roger Deakins..."
                                value={referenceSearchQuery}
                                onChange={(e) => setReferenceSearchQuery(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') searchReferenceImages(referenceSearchQuery);
                                }}
                                InputProps={{
                                  startAdornment: (
                                    <InputAdornment position="start">
                                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
                                        <circle cx="11" cy="11" r="8"/>
                                        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                                      </svg>
                                    </InputAdornment>
                                  ),
                                  endAdornment: (
                                    <InputAdornment position="end">
                                      <Box
                                        onClick={() => searchReferenceImages(referenceSearchQuery)}
                                        sx={{
                                          px: 2,
                                          py: 0.5,
                                          bgcolor: '#3b82f6',
                                          borderRadius: 1,
                                          cursor: 'pointer',
                                          '&:hover': { bgcolor: '#2563eb' },
                                        }}
                                      >
                                        <Typography sx={{ fontSize: 12, color: '#fff', fontWeight: 500 }}>
                                          Søk
                                        </Typography>
                                      </Box>
                                    </InputAdornment>
                                  ),
                                }}
                                sx={{
                                  '& .MuiOutlinedInput-root': {
                                    bgcolor: '#252d3d',
                                    '& fieldset': { borderColor: '#374151' },
                                    '&:hover fieldset': { borderColor: '#4b5563' },
                                    '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                                  },
                                  '& .MuiInputBase-input': { color: '#fff', fontSize: 14 },
                                }}
                              />
                              
                              {/* Source Tabs */}
                              <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                                {[
                                  { id: 'all', label: 'Alle kilder' },
                                  { id: 'shotcafe', label: 'shot.cafe' },
                                  { id: 'unsplash', label: 'Unsplash' },
                                ].map(source => (
                                  <Box
                                    key={source.id}
                                    onClick={() => setSearchSource(source.id as 'all' | 'shotcafe' | 'unsplash')}
                                    sx={{
                                      px: 1.5,
                                      py: 0.5,
                                      bgcolor: searchSource === source.id ? '#3b82f6' : '#374151',
                                      borderRadius: 1,
                                      cursor: 'pointer',
                                      transition: 'all 0.2s',
                                      '&:hover': { bgcolor: searchSource === source.id ? '#2563eb' : '#4b5563' },
                                    }}
                                  >
                                    <Typography sx={{ fontSize: 11, color: searchSource === source.id ? '#fff' : '#9ca3af' }}>
                                      {source.label}
                                    </Typography>
                                  </Box>
                                ))}
                              </Stack>

                              {/* Quick Search Tags */}
                              <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
                                {['Blade Runner', 'Sicario', 'Joker', 'Dune', 'The Batman', 'Interstellar', 'Roger Deakins', 'Chivo'].map(tag => (
                                  <Box
                                    key={tag}
                                    onClick={() => {
                                      setReferenceSearchQuery(tag);
                                      searchReferenceImages(tag);
                                    }}
                                    sx={{
                                      px: 1.5,
                                      py: 0.5,
                                      bgcolor: '#252d3d',
                                      borderRadius: 2,
                                      cursor: 'pointer',
                                      border: '1px solid #374151',
                                      '&:hover': { bgcolor: '#374151', borderColor: '#4b5563' },
                                    }}
                                  >
                                    <Typography sx={{ fontSize: 11, color: '#9ca3af' }}>{tag}</Typography>
                                  </Box>
                                ))}
                              </Stack>
                            </>
                          )}
                        </Box>

                        {/* Search Results */}
                        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                          {referenceSearchLoading ? (
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 8 }}>
                              <Box sx={{ 
                                width: 40, 
                                height: 40, 
                                border: '3px solid #374151', 
                                borderTopColor: '#3b82f6',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite',
                                '@keyframes spin': {
                                  '0%': { transform: 'rotate(0deg)' },
                                  '100%': { transform: 'rotate(360deg)' },
                                },
                              }} />
                              <Typography sx={{ color: '#6b7280', mt: 2 }}>Søker i filmdatabasen...</Typography>
                            </Box>
                          ) : selectedFilm ? (
                            /* Film Frames View */
                            <Box>
                              <Typography sx={{ fontSize: 12, color: '#6b7280', mb: 2 }}>
                                Velg en frame fra {selectedFilm.title} for å legge til som referanse
                              </Typography>
                              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5 }}>
                                {selectedFilm.frames.map((frame) => (
                                  <Box
                                    key={frame.id}
                                    sx={{
                                      position: 'relative',
                                      borderRadius: 1,
                                    }}
                                  >
                                    <Box
                                      sx={{
                                        aspectRatio: '16/9',
                                        borderRadius: 1,
                                        backgroundImage: `url(${frame.thumbnailUrl})`,
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center',
                                        bgcolor: '#374151',
                                        cursor: 'pointer',
                                        position: 'relative',
                                        overflow: 'hidden',
                                        '&:hover': {
                                          '& .overlay': { opacity: 1 },
                                        },
                                      }}
                                    >
                                      <Box
                                        className="overlay"
                                        sx={{
                                          position: 'absolute',
                                          inset: 0,
                                          bgcolor: 'rgba(0,0,0,0.6)',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          gap: 1,
                                          opacity: 0,
                                          transition: 'opacity 0.2s',
                                        }}
                                      >
                                        <Typography sx={{ fontSize: 11, color: '#fff', fontWeight: 600 }}>
                                          Velg handling
                                        </Typography>
                                      </Box>
                                    </Box>

                                    {/* Action buttons below frame */}
                                    <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
                                      <Box
                                        onClick={() => {
                                          setUploadedReferences(prev => [...prev, frame.url]);
                                          setReferenceSearchOpen(false);
                                          setSelectedFilm(null);
                                        }}
                                        sx={{
                                          flex: 1,
                                          p: 0.75,
                                          bgcolor: '#3b82f6',
                                          borderRadius: 0.75,
                                          color: '#fff',
                                          fontSize: 10,
                                          fontWeight: 600,
                                          textAlign: 'center',
                                          cursor: 'pointer',
                                          '&:hover': { bgcolor: '#2563eb' },
                                        }}
                                      >
                                        + Senterpanel
                                      </Box>
                                      <Box
                                        onClick={() => {
                                          setCenterPanelReference({
                                            url: frame.url,
                                            source: `${selectedFilm.title} (shot.cafe)`,
                                            title: selectedFilm.title,
                                          });
                                          setReferenceSearchOpen(false);
                                          setSelectedFilm(null);
                                        }}
                                        sx={{
                                          flex: 1,
                                          p: 0.75,
                                          bgcolor: '#10b981',
                                          borderRadius: 0.75,
                                          color: '#fff',
                                          fontSize: 10,
                                          fontWeight: 600,
                                          textAlign: 'center',
                                          cursor: 'pointer',
                                          '&:hover': { bgcolor: '#059669' },
                                        }}
                                      >
                                        <Stack direction="row" spacing={0.25} alignItems="center" justifyContent="center"><PinIcon sx={{ fontSize: 10 }} /> Sentrum</Stack>
                                      </Box>
                                    </Stack>
                                  </Box>
                                ))}
                              </Box>
                              
                              {/* Open in shot.cafe button */}
                              <Box sx={{ mt: 2, textAlign: 'center' }}>
                                <Box
                                  component="a"
                                  href={`https://shot.cafe/movie/${selectedFilm.slug}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  sx={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 1,
                                    px: 2,
                                    py: 1,
                                    bgcolor: '#252d3d',
                                    borderRadius: 1,
                                    border: '1px solid #374151',
                                    textDecoration: 'none',
                                    '&:hover': { bgcolor: '#374151' },
                                  }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                    <polyline points="15 3 21 3 21 9"/>
                                    <line x1="10" y1="14" x2="21" y2="3"/>
                                  </svg>
                                  <Typography sx={{ fontSize: 12, color: '#9ca3af' }}>
                                    Se alle frames på shot.cafe
                                  </Typography>
                                </Box>
                              </Box>
                            </Box>
                          ) : (
                            /* Combined Results View */
                            <Box>
                              {/* shot.cafe Film Results */}
                              {shotCafeResults.length > 0 && (
                                <Box sx={{ mb: 3 }}>
                                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
                                      Filmer fra shot.cafe
                                    </Typography>
                                    <Typography sx={{ fontSize: 11, color: '#6b7280' }}>
                                      ({shotCafeResults.length} resultater)
                                    </Typography>
                                  </Stack>
                                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1.5 }}>
                                    {shotCafeResults.slice(0, 8).map((film) => (
                                      <Box
                                        key={film.id}
                                        onClick={() => loadFilmFrames(film.slug, film.title)}
                                        sx={{
                                          bgcolor: '#252d3d',
                                          borderRadius: 1,
                                          overflow: 'hidden',
                                          cursor: 'pointer',
                                          transition: 'all 0.2s',
                                          border: '1px solid #374151',
                                          '&:hover': { 
                                            borderColor: '#3b82f6',
                                            transform: 'translateY(-2px)',
                                          },
                                        }}
                                      >
                                        <Box
                                          sx={{
                                            aspectRatio: '16/10',
                                            backgroundImage: `url(${film.thumbnail})`,
                                            backgroundSize: 'cover',
                                            backgroundPosition: 'center',
                                            bgcolor: '#374151',
                                          }}
                                        />
                                        <Box sx={{ p: 1 }}>
                                          <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#fff', lineHeight: 1.2 }} noWrap>
                                            {film.title}
                                          </Typography>
                                          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.5 }}>
                                            <Typography sx={{ fontSize: 10, color: '#6b7280' }}>
                                              {film.year}
                                            </Typography>
                                            <Typography sx={{ fontSize: 10, color: '#3b82f6' }}>
                                              {film.imageCount} frames
                                            </Typography>
                                          </Stack>
                                          {film.cinematographer && (
                                            <Typography sx={{ fontSize: 9, color: '#9ca3af', mt: 0.5 }} noWrap>
                                              DP: {film.cinematographer}
                                            </Typography>
                                          )}
                                        </Box>
                                      </Box>
                                    ))}
                                  </Box>
                                </Box>
                              )}

                              {/* Unsplash/Mood Results */}
                              {referenceSearchResults.length > 0 && (
                                <Box>
                                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
                                      Stemningsbilder
                                    </Typography>
                                    <Typography sx={{ fontSize: 11, color: '#6b7280' }}>
                                      ({referenceSearchResults.length} resultater)
                                    </Typography>
                                  </Stack>
                                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1.5 }}>
                                    {referenceSearchResults.map((img) => (
                                      <Box
                                        key={img.id}
                                        sx={{
                                          position: 'relative',
                                          borderRadius: 1,
                                        }}
                                      >
                                        <Box
                                          sx={{
                                            aspectRatio: '16/10',
                                            borderRadius: 1,
                                            backgroundImage: `url(${img.thumbnailUrl})`,
                                            backgroundSize: 'cover',
                                            backgroundPosition: 'center',
                                            cursor: 'pointer',
                                            position: 'relative',
                                            overflow: 'hidden',
                                            bgcolor: '#374151',
                                            '&:hover': {
                                              '& .overlay': { opacity: 1 },
                                            },
                                          }}
                                        >
                                          <Box
                                            className="overlay"
                                            sx={{
                                              position: 'absolute',
                                              inset: 0,
                                              bgcolor: 'rgba(0,0,0,0.6)',
                                              display: 'flex',
                                              flexDirection: 'column',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              gap: 1,
                                              opacity: 0,
                                              transition: 'opacity 0.2s',
                                            }}
                                          >
                                            <Typography sx={{ fontSize: 11, color: '#fff', fontWeight: 600 }}>
                                              Velg handling
                                            </Typography>
                                          </Box>
                                        </Box>

                                        {/* Action buttons below image */}
                                        <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
                                          <Box
                                            onClick={() => {
                                              setUploadedReferences(prev => [...prev, img.url]);
                                              setReferenceSearchOpen(false);
                                            }}
                                            sx={{
                                              flex: 1,
                                              p: 0.75,
                                              bgcolor: '#3b82f6',
                                              borderRadius: 0.75,
                                              color: '#fff',
                                              fontSize: 10,
                                              fontWeight: 600,
                                              textAlign: 'center',
                                              cursor: 'pointer',
                                              '&:hover': { bgcolor: '#2563eb' },
                                            }}
                                          >
                                            + Senterpanel
                                          </Box>
                                          <Box
                                            onClick={() => {
                                              setCenterPanelReference({
                                                url: img.url,
                                                source: img.source,
                                                title: `${img.source} Referanse`,
                                              });
                                              setReferenceSearchOpen(false);
                                            }}
                                            sx={{
                                              flex: 1,
                                              p: 0.75,
                                              bgcolor: '#10b981',
                                              borderRadius: 0.75,
                                              color: '#fff',
                                              fontSize: 10,
                                              fontWeight: 600,
                                              textAlign: 'center',
                                              cursor: 'pointer',
                                              '&:hover': { bgcolor: '#059669' },
                                            }}
                                          >
                                            <Stack direction="row" spacing={0.25} alignItems="center" justifyContent="center"><PinIcon sx={{ fontSize: 10 }} /> Sentrum</Stack>
                                          </Box>
                                        </Stack>
                                      </Box>
                                    ))}
                                  </Box>
                                </Box>
                              )}

                              {/* Empty State */}
                              {shotCafeResults.length === 0 && referenceSearchResults.length === 0 && (
                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8 }}>
                                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="1.5">
                                    <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
                                    <line x1="7" y1="2" x2="7" y2="22"/>
                                    <line x1="17" y1="2" x2="17" y2="22"/>
                                    <line x1="2" y1="12" x2="22" y2="12"/>
                                    <line x1="2" y1="7" x2="7" y2="7"/>
                                    <line x1="2" y1="17" x2="7" y2="17"/>
                                    <line x1="17" y1="17" x2="22" y2="17"/>
                                    <line x1="17" y1="7" x2="22" y2="7"/>
                                  </svg>
                                  <Typography sx={{ color: '#9ca3af', mt: 3, fontSize: 15, fontWeight: 500 }}>
                                    Søk etter filmreferanser
                                  </Typography>
                                  <Typography sx={{ color: '#6b7280', fontSize: 13, mt: 1, textAlign: 'center', maxWidth: 400 }}>
                                    Søk etter filmer som "Blade Runner", "Sicario" eller cinematografer som "Roger Deakins"
                                  </Typography>
                                  <Stack direction="row" spacing={1} sx={{ mt: 3 }}>
                                    <Box sx={{ px: 1.5, py: 0.5, bgcolor: '#252d3d', borderRadius: 1, border: '1px solid #374151' }}>
                                      <Typography sx={{ fontSize: 11, color: '#6b7280' }}>shot.cafe</Typography>
                                    </Box>
                                    <Box sx={{ px: 1.5, py: 0.5, bgcolor: '#252d3d', borderRadius: 1, border: '1px solid #374151' }}>
                                      <Typography sx={{ fontSize: 11, color: '#6b7280' }}>Unsplash</Typography>
                                    </Box>
                                  </Stack>
                                </Box>
                              )}
                            </Box>
                          )}
                        </Box>

                        {/* Attribution Footer */}
                        <Box sx={{ p: 1.5, borderTop: '1px solid #2a3142', bgcolor: '#252d3d' }}>
                          <Typography sx={{ fontSize: 10, color: '#6b7280', textAlign: 'center' }}>
                            Filmreferanser fra shot.cafe • Stemningsbilder fra Unsplash • Kun for referanse og utdanning
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  )}
                </Box>
              </Collapse>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Production Estimate Dialog */}
      <ProductionEstimateDialog
        open={showEstimateDialog}
        onClose={() => setShowEstimateDialog(false)}
        scenes={scenes}
        shotLists={shotLists}
        manuscriptTitle={manuscript.title}
      />

      {/* ============================================ */}
      {/* PRODUCTION WORKFLOW MODALS */}
      {/* ============================================ */}
      
      {/* Stripboard Panel Dialog */}
      <Dialog
        open={showStripboardPanel}
        onClose={() => setShowStripboardPanel(false)}
        fullScreen
        PaperProps={{
          sx: {
            bgcolor: '#0f1318',
          },
        }}
      >
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          height: '100%',
          bgcolor: '#0f1318',
        }}>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            p: 2,
            borderBottom: '1px solid #2a3142',
            bgcolor: '#0c0f14',
          }}>
            <Typography sx={{ fontSize: 18, fontWeight: 600, color: '#fff' }}>
              <Stack direction="row" spacing={1} alignItems="center"><StripboardIcon sx={{ color: '#60a5fa' }} /> Stripboard - TROLL</Stack>
            </Typography>
            <IconButton onClick={() => setShowStripboardPanel(false)} sx={{ color: '#9ca3af' }}>
              <CloseIcon />
            </IconButton>
          </Box>
          <Box sx={{ flex: 1, overflow: 'hidden' }}>
            <StripboardPanel
              projectId={projectId}
              onSceneSelect={(sceneId) => {
                const scene = scenes.find(s => s.id === sceneId);
                if (scene) scrollToScene(scene);
                setShowStripboardPanel(false);
              }}
              onGenerateCallSheet={(dayId) => {
                // Open the Call Sheet preview with the new CallSheetGenerator component
                setShowCallSheetPreview(true);
              }}
            />
          </Box>
        </Box>
      </Dialog>

      {/* Shooting Day Planner Dialog */}
      <Dialog
        open={showShootingDayPlanner}
        onClose={() => setShowShootingDayPlanner(false)}
        fullScreen
        PaperProps={{
          sx: {
            bgcolor: '#0f1318',
          },
        }}
      >
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          height: '100%',
          bgcolor: '#0f1318',
        }}>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            p: 2,
            borderBottom: '1px solid #2a3142',
            bgcolor: '#0c0f14',
          }}>
            <Typography sx={{ fontSize: 18, fontWeight: 600, color: '#fff' }}>
              <Stack direction="row" spacing={1} alignItems="center"><CalendarIcon sx={{ color: '#60a5fa' }} /> Opptaksplan - TROLL</Stack>
            </Typography>
            <IconButton onClick={() => setShowShootingDayPlanner(false)} sx={{ color: '#9ca3af' }}>
              <CloseIcon />
            </IconButton>
          </Box>
          <Box sx={{ flex: 1, overflow: 'hidden' }}>
            <ShootingDayPlanner
              projectId={projectId}
              onDaySelect={(dayId) => {
                console.log('Day selected:', dayId);
              }}
              onGenerateCallSheet={(dayId) => {
                // Open the Call Sheet preview with the new CallSheetGenerator component
                setShowCallSheetPreview(true);
              }}
            />
          </Box>
        </Box>
      </Dialog>

      {/* Live Set Mode (Full Screen Overlay) - WORKFLOW GAP FIX #1 */}
      {showLiveSetMode && (
        <LiveSetMode
          projectId={projectId}
          shootingDayId={selectedShootingDayId}
          onClose={() => {
            setShowLiveSetMode(false);
            setIsLiveSetConnected(false);
          }}
        />
      )}

      {/* Live Set Day Selector Dialog - WORKFLOW GAP FIX #1 */}
      <Dialog
        open={showLiveSetDaySelector}
        onClose={() => setShowLiveSetDaySelector(false)}
        PaperProps={{
          sx: {
            bgcolor: '#1a1f2e',
            borderRadius: '16px',
            border: '1px solid #2a3142',
            minWidth: 450,
          },
        }}
      >
        <DialogTitle sx={{ color: '#fff', borderBottom: '1px solid #2a3142', display: 'flex', alignItems: 'center', gap: 1 }}>
          <LiveIcon sx={{ color: '#ef4444' }} />
          Velg Opptaksdag for Live Set
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Typography sx={{ color: '#9ca3af', mb: 2, fontSize: 13 }}>
            Velg hvilken opptaksdag du vil følge i Live Set Mode:
          </Typography>
          <Stack spacing={1}>
            {shootingDays.map((day) => (
              <Box
                key={day.id}
                onClick={() => {
                  setSelectedShootingDayId(day.id);
                  setShowLiveSetDaySelector(false);
                  setShowLiveSetMode(true);
                  setIsLiveSetConnected(true);
                }}
                sx={{
                  p: 2,
                  borderRadius: '10px',
                  bgcolor: selectedShootingDayId === day.id ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.03)',
                  border: selectedShootingDayId === day.id ? '1px solid #ef4444' : '1px solid #2a3142',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: 'rgba(239, 68, 68, 0.1)',
                    borderColor: '#ef4444',
                  },
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
                      Dag {day.dayNumber} - {new Date(day.date).toLocaleDateString('nb-NO', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: '#9ca3af' }}>
                      {day.location}
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    label={day.status === 'wrapped' ? 'Ferdig' : day.status === 'in-progress' ? 'Pågår' : 'Planlagt'}
                    sx={{
                      bgcolor: day.status === 'wrapped' ? 'rgba(16,185,129,0.2)' : day.status === 'in-progress' ? 'rgba(239,68,68,0.2)' : 'rgba(59,130,246,0.2)',
                      color: day.status === 'wrapped' ? '#10b981' : day.status === 'in-progress' ? '#ef4444' : '#3b82f6',
                      fontSize: 10,
                    }}
                  />
                </Stack>
              </Box>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #2a3142' }}>
          <Button onClick={() => setShowLiveSetDaySelector(false)} sx={{ color: '#9ca3af' }}>
            Avbryt
          </Button>
        </DialogActions>
      </Dialog>

      {/* Call Sheet Preview Dialog */}
      <Dialog
        open={showCallSheetPreview}
        onClose={() => setShowCallSheetPreview(false)}
        maxWidth="xl"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#f8fafc',
            minHeight: '90vh',
            maxHeight: '95vh',
          },
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          borderBottom: '1px solid #e5e7eb',
          bgcolor: '#fff',
          py: 1.5,
        }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#1a1a1a' }}>
            <Stack direction="row" spacing={1} alignItems="center" component="span">
              <CallSheetIcon sx={{ color: '#0369a1' }} /> 
              Call Sheet Preview - TROLL
            </Stack>
          </Typography>
          <IconButton onClick={() => setShowCallSheetPreview(false)} sx={{ color: '#4a4a4a' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ flex: 1, overflow: 'auto', p: { xs: 1, sm: 2, md: 3 } }}>
            <CallSheetGenerator
              projectId={projectId}
            />
          </Box>
        </DialogContent>
      </Dialog>

      {/* New Scene Dialog */}
      <NewSceneDialog
        open={showNewSceneDialog}
        onClose={() => setShowNewSceneDialog(false)}
        onCreate={handleCreateScene}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setSceneToDelete(null);
        }}
        onConfirm={handleDeleteScene}
      />

      {/* Export Dialog */}
      <Dialog
        open={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        PaperProps={{
          sx: {
            bgcolor: '#1a1f2e',
            borderRadius: '16px',
            border: '1px solid #2a3142',
            minWidth: 400,
          },
        }}
      >
        <DialogTitle sx={{ color: '#fff', borderBottom: '1px solid #2a3142' }}>
          Eksporter produksjonsdata
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Typography sx={{ color: '#9ca3af', mb: 2 }}>
            Eksporter alle scener, utstyr, shot lists og metadata som JSON-fil.
          </Typography>
          <Box sx={{ 
            p: 2, 
            bgcolor: '#0f1318', 
            borderRadius: '8px',
            border: '1px solid #2a3142',
          }}>
            <Typography sx={{ fontSize: 12, color: '#6b7280', mb: 1 }}>
              Innhold:
            </Typography>
            <Stack spacing={0.5}>
              <Typography sx={{ fontSize: 13, color: '#d1d5db' }}>
                • {scenes.length} scener
              </Typography>
              <Typography sx={{ fontSize: 13, color: '#d1d5db' }}>
                • {shotLists.reduce((acc, list) => acc + list.shots.length, 0)} shots
              </Typography>
              <Typography sx={{ fontSize: 13, color: '#d1d5db' }}>
                • Utstyr og metadata
              </Typography>
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #2a3142' }}>
          <Button
            onClick={() => setShowExportDialog(false)}
            sx={{ color: '#9ca3af' }}
          >
            Avbryt
          </Button>
          <Button
            onClick={handleExportProduction}
            variant="contained"
            startIcon={<DownloadIcon />}
            sx={{
              bgcolor: '#3b82f6',
              '&:hover': { bgcolor: '#2563eb' },
            }}
          >
            Eksporter JSON
          </Button>
        </DialogActions>
      </Dialog>

      {/* Talent Panel Drawer */}
      <Drawer
        anchor="right"
        open={showTalentPanel || (isMobile && mobileRightPanelOpen)}
        onClose={() => {
          setShowTalentPanel(false);
          setMobileRightPanelOpen(false);
        }}
        PaperProps={{
          sx: {
            width: isMobile ? '85vw' : Math.min(400, responsive.rightPanelWidth),
            maxWidth: isMobile ? '100vw' : responsive.rightPanelWidth,
            bgcolor: '#1a1f2e',
            borderLeft: '1px solid #2a3142',
          },
        }}
      >
        <Box sx={{ p: isMobile ? 2 : 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: isMobile ? 2 : 3 }}>
            <Typography sx={{ fontSize: isMobile ? 16 : 18, fontWeight: 600, color: '#fff' }}>
              Cast & Talent
            </Typography>
            <IconButton
              onClick={() => {
                setShowTalentPanel(false);
                setMobileRightPanelOpen(false);
              }}
              size={responsive.buttonSize}
              sx={{ color: '#6b7280', '&:hover': { color: '#fff' } }}
            >
              <CloseIcon sx={{ fontSize: responsive.iconSize }} />
            </IconButton>
          </Stack>

          {selectedScene && (
            <Box sx={{ mb: isMobile ? 2 : 3, p: isMobile ? 1.5 : 2, bgcolor: '#0f1318', borderRadius: '12px', border: '1px solid #2a3142' }}>
              <Typography sx={{ fontSize: isMobile ? 11 : 12, color: '#6b7280', mb: 1 }}>
                SCENE {selectedScene.sceneNumber}
              </Typography>
              <Typography sx={{ fontSize: isMobile ? 13 : 14, color: '#fff', fontWeight: 500 }}>
                {selectedScene.intExt}. {selectedScene.locationName}
              </Typography>
              <Typography sx={{ fontSize: isMobile ? 11 : 12, color: '#9ca3af', mt: 0.5 }}>
                {selectedScene.characters?.length || 0} karakterer
              </Typography>
            </Box>
          )}

          <Typography sx={{ fontSize: isMobile ? 11 : 12, fontWeight: 700, color: '#6b7280', mb: 2, letterSpacing: 1 }}>
            CONFIRMED CAST ({sceneCandidates.length})
          </Typography>

          <Stack spacing={2}>
            {sceneCandidates.map((candidate) => {
              const assignedRole = projectRoles.find(r => (candidate.assignedRoles || []).includes(r.id));
              const isInSelectedScene = selectedScene?.characters?.includes(assignedRole?.name || '') || false;

              return (
                <Box
                  key={candidate.id}
                  sx={{
                    p: 2,
                    borderRadius: '12px',
                    bgcolor: isInSelectedScene ? 'rgba(16, 185, 129, 0.1)' : '#0f1318',
                    border: isInSelectedScene ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #2a3142',
                    transition: 'all 0.2s',
                    '&:hover': {
                      bgcolor: isInSelectedScene ? 'rgba(16, 185, 129, 0.15)' : '#141a22',
                      transform: 'translateX(-4px)',
                    },
                  }}
                >
                  <Stack direction="row" spacing={2} alignItems="center">
                    {/* Candidate Photo */}
                    <Box
                      sx={{
                        width: 56,
                        height: 56,
                        borderRadius: '12px',
                        overflow: 'hidden',
                        bgcolor: '#252d3d',
                        border: '2px solid #2a3142',
                      }}
                    >
                      {candidate.photos[0] ? (
                        <img
                          src={candidate.photos[0]}
                          alt={candidate.name}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                      ) : (
                        <Box
                          sx={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <PersonIcon sx={{ fontSize: 32, color: '#6b7280' }} />
                        </Box>
                      )}
                    </Box>

                    {/* Candidate Info */}
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#fff', mb: 0.5 }}>
                        {candidate.name}
                      </Typography>
                      {assignedRole && (
                        <Box
                          sx={{
                            display: 'inline-block',
                            px: 1,
                            py: 0.25,
                            borderRadius: '6px',
                            bgcolor: 'rgba(139, 92, 246, 0.2)',
                            border: '1px solid rgba(139, 92, 246, 0.3)',
                            mb: 0.5,
                          }}
                        >
                          <Typography sx={{ fontSize: 11, color: '#a78bfa', fontWeight: 600 }}>
                            {assignedRole.name}
                          </Typography>
                        </Box>
                      )}
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            bgcolor: candidate.status === 'confirmed' ? '#10b981' : '#f59e0b',
                          }}
                        />
                        <Typography sx={{ fontSize: 11, color: '#9ca3af', textTransform: 'capitalize' }}>
                          {candidate.status}
                        </Typography>
                      </Stack>
                    </Box>

                    {/* Scene Indicator */}
                    {isInSelectedScene && (
                      <Box
                        sx={{
                          px: 1.5,
                          py: 0.5,
                          borderRadius: '8px',
                          bgcolor: 'rgba(16, 185, 129, 0.2)',
                          border: '1px solid rgba(16, 185, 129, 0.4)',
                        }}
                      >
                        <Typography sx={{ fontSize: 10, color: '#10b981', fontWeight: 700 }}>
                          I SCENE
                        </Typography>
                      </Box>
                    )}
                  </Stack>

                  {/* Contact Info */}
                  {candidate.contactInfo && (
                    <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid #2a3142' }}>
                      {candidate.contactInfo.phone && (
                        <Stack direction="row" spacing={0.75} alignItems="flex-start">
                          <PhoneIcon sx={{ fontSize: 12, mt: 0.25 }} />
                          <Typography sx={{ fontSize: 11, color: '#6b7280' }}>
                            {candidate.contactInfo.phone}
                          </Typography>
                        </Stack>
                      )}
                      {candidate.contactInfo.email && (
                        <Stack direction="row" spacing={0.75} alignItems="flex-start" sx={{ mt: 0.5 }}>
                          <EmailIcon sx={{ fontSize: 12, mt: 0.25 }} />
                          <Typography sx={{ fontSize: 11, color: '#6b7280' }}>
                            {candidate.contactInfo.email}
                          </Typography>
                        </Stack>
                      )}
                    </Box>
                  )}
                </Box>
              );
            })}
          </Stack>

          {sceneCandidates.length === 0 && (
            <Box
              sx={{
                p: 4,
                textAlign: 'center',
                bgcolor: '#0f1318',
                borderRadius: '12px',
                border: '1px dashed #2a3142',
              }}
            >
              <PeopleIcon sx={{ fontSize: 48, color: '#374151', mb: 2 }} />
              <Typography sx={{ fontSize: 14, color: '#6b7280', mb: 1 }}>
                Ingen bekreftet cast ennå
              </Typography>
              <Typography sx={{ fontSize: 12, color: '#4b5563' }}>
                Gå til Auditions i Casting Planner for å bekrefte kandidater
              </Typography>
            </Box>
          )}
        </Box>
      </Drawer>

      {/* Quick Notes Panel */}
      <Dialog
        open={showQuickNotes}
        onClose={() => setShowQuickNotes(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#1a1f2e',
            border: '1px solid #2a3142',
          },
        }}
      >
        <DialogTitle sx={{ color: '#fff', borderBottom: '1px solid #2a3142', fontWeight: 600 }}>
          Quick Notes - Scene {selectedScene?.sceneNumber}
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <TextField
            fullWidth
            multiline
            rows={6}
            value={selectedScene ? (quickNotes[selectedScene.id] || '') : ''}
            onChange={(e) => selectedScene && handleQuickNoteChange(selectedScene.id, e.target.value)}
            placeholder="Add production notes, warnings, special instructions..."
            sx={{
              '& .MuiOutlinedInput-root': {
                color: '#e5e7eb',
                '& fieldset': { borderColor: '#374151' },
                '&:hover fieldset': { borderColor: '#4b5563' },
              },
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setShowQuickNotes(false)} sx={{ color: '#9ca3af' }}>
            Done
          </Button>
        </DialogActions>
      </Dialog>

      {/* Save as Template Dialog */}
      <Dialog
        open={showSceneTemplate}
        onClose={() => { setShowSceneTemplate(false); setTemplateName(''); }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#1a1f2e',
            border: '1px solid #2a3142',
          },
        }}
      >
        <DialogTitle sx={{ color: '#fff', borderBottom: '1px solid #2a3142', fontWeight: 600 }}>
          Save Scene as Template
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <TextField
            fullWidth
            label="Template Name"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="e.g., 'Indoor Dialogue', 'Action Sequence'"
            sx={{
              '& .MuiOutlinedInput-root': {
                color: '#e5e7eb',
                '& fieldset': { borderColor: '#374151' },
              },
              '& .MuiInputBase-input::placeholder': { color: '#6b7280' },
            }}
          />
          <Box sx={{ mt: 3, p: 2, bgcolor: '#0f1318', borderRadius: '8px', border: '1px solid #2a3142' }}>
            <Typography sx={{ fontSize: 12, color: '#9ca3af', mb: 1 }}>Available Templates:</Typography>
            <Stack spacing={1}>
              {Object.keys(sceneTemplates).length > 0 ? (
                Object.entries(sceneTemplates).map(([name, template]) => (
                  <Box
                    key={name}
                    onClick={() => handleLoadTemplate(name)}
                    sx={{
                      p: 1.5,
                      bgcolor: '#1a2230',
                      borderRadius: '6px',
                      border: '1px solid #252d3d',
                      cursor: 'pointer',
                      '&:hover': { bgcolor: '#252d3d', borderColor: '#3b82f6' },
                    }}
                  >
                    <Typography sx={{ fontSize: 12, color: '#e5e7eb', fontWeight: 500 }}>{name}</Typography>
                    <Typography sx={{ fontSize: 10, color: '#6b7280' }}>
                      {template.sceneHeading} • {template.characters?.length || 0} characters
                    </Typography>
                  </Box>
                ))
              ) : (
                <Typography sx={{ fontSize: 11, color: '#4b5563' }}>No templates saved yet</Typography>
              )}
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { setShowSceneTemplate(false); setTemplateName(''); }} sx={{ color: '#9ca3af' }}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveTemplate}
            variant="contained"
            disabled={!templateName.trim()}
            sx={{
              bgcolor: '#ec4899',
              '&:hover': { bgcolor: '#db2777' },
              '&:disabled': { opacity: 0.5 },
            }}
          >
            Save Template
          </Button>
        </DialogActions>
      </Dialog>

      {/* Tag & Filter Controls Dialog */}
      <Dialog
        open={batchMode && selectedScenes.size > 0}
        onClose={() => { setBatchMode(false); setSelectedScenes(new Set()); }}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#1a1f2e',
            border: '1px solid #2a3142',
          },
        }}
      >
        <DialogTitle sx={{ color: '#fff', borderBottom: '1px solid #2a3142', fontWeight: 600 }}>
          Scene Tags & Filters ({selectedScenes.size} selected)
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Stack spacing={3}>
            {/* Sorting Controls */}
            <Box>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', mb: 1.5, letterSpacing: 0.5 }}>
                SORT BY
              </Typography>
              <Stack direction="row" spacing={1}>
                {(['number', 'duration', 'date', 'name'] as const).map(option => (
                  <Button
                    key={option}
                    onClick={() => setSortBy(option)}
                    variant={sortBy === option ? 'contained' : 'outlined'}
                    size="small"
                    sx={{
                      color: sortBy === option ? '#fff' : '#9ca3af',
                      borderColor: '#374151',
                      bgcolor: sortBy === option ? '#3b82f6' : 'transparent',
                      '&:hover': { bgcolor: sortBy === option ? '#2563eb' : 'rgba(59,130,246,0.1)' },
                    }}
                  >
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </Button>
                ))}
              </Stack>
            </Box>

            {/* Tag Management */}
            <Box>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', mb: 1.5, letterSpacing: 0.5 }}>
                SCENE TAGS
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
                {allTags.map(tag => (
                  <Chip
                    key={tag}
                    label={tag}
                    onClick={() => {
                      setSelectedTags(prev => {
                        const next = new Set(prev);
                        next.has(tag) ? next.delete(tag) : next.add(tag);
                        return next;
                      });
                    }}
                    variant={selectedTags.has(tag) ? 'filled' : 'outlined'}
                    sx={{
                      bgcolor: selectedTags.has(tag) ? '#8b5cf6' : 'transparent',
                      color: selectedTags.has(tag) ? '#fff' : '#9ca3af',
                      borderColor: '#374151',
                      '&:hover': { bgcolor: selectedTags.has(tag) ? '#7c3aed' : 'rgba(139,92,246,0.1)' },
                    }}
                  />
                ))}
              </Stack>
            </Box>

            {/* Filter Checkboxes */}
            <Box>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', mb: 1.5, letterSpacing: 0.5 }}>
                EQUIPMENT NEEDS
              </Typography>
              <Stack spacing={1}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Checkbox
                    checked={filterMissingCamera}
                    onChange={(e) => setFilterMissingCamera(e.target.checked)}
                    sx={{ color: '#3b82f6' }}
                  />
                  <Typography sx={{ fontSize: 13, color: '#e5e7eb' }}>Missing Camera Equipment</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Checkbox
                    checked={filterMissingLight}
                    onChange={(e) => setFilterMissingLight(e.target.checked)}
                    sx={{ color: '#3b82f6' }}
                  />
                  <Typography sx={{ fontSize: 13, color: '#e5e7eb' }}>Missing Lighting</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Checkbox
                    checked={filterMissingSound}
                    onChange={(e) => setFilterMissingSound(e.target.checked)}
                    sx={{ color: '#3b82f6' }}
                  />
                  <Typography sx={{ fontSize: 13, color: '#e5e7eb' }}>Missing Audio Equipment</Typography>
                </Box>
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { setBatchMode(false); setSelectedScenes(new Set()); }} sx={{ color: '#9ca3af' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Save Preset Dialog */}
      <Dialog
        open={showSavePresetDialog}
        onClose={() => setShowSavePresetDialog(false)}
        PaperProps={{
          sx: {
            bgcolor: '#1a1f2e',
            border: '1px solid #3b82f6',
            minWidth: 400,
          },
        }}
      >
        <DialogTitle sx={{ color: '#fff', borderBottom: '1px solid #2a3142' }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{ color: '#10b981' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
              </svg>
            </Box>
            <span>Lagre som preset</span>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Typography sx={{ color: '#9ca3af', mb: 2, fontSize: 13 }}>
            Gi presetet et navn for å lagre gjeldende kamera- og lysinnstillinger.
          </Typography>
          <TextField
            fullWidth
            placeholder="F.eks. 'Intim dialog', 'Action scene'"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            autoFocus
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: '#0d1117',
                color: '#fff',
                '& fieldset': { borderColor: '#374151' },
                '&:hover fieldset': { borderColor: '#3b82f6' },
                '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
              },
            }}
          />
          <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(59,130,246,0.1)', borderRadius: 2 }}>
            <Typography sx={{ fontSize: 11, color: '#6b7280', mb: 1 }}>Innstillinger som lagres:</Typography>
            <Stack spacing={0.5}>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <CameraIcon sx={{ fontSize: 14, color: '#9ca3af' }} />
                <Typography sx={{ fontSize: 12, color: '#9ca3af' }}>Kamera: {shotProperties.camera}</Typography>
              </Stack>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <CameraRollIcon sx={{ fontSize: 14, color: '#9ca3af' }} />
                <Typography sx={{ fontSize: 12, color: '#9ca3af' }}>Objektiv: {shotProperties.lens}</Typography>
              </Stack>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <MovieIcon sx={{ fontSize: 14, color: '#9ca3af' }} />
                <Typography sx={{ fontSize: 12, color: '#9ca3af' }}>Shot type: {shotProperties.shotType}</Typography>
              </Stack>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <VideoLibraryIcon sx={{ fontSize: 14, color: '#9ca3af' }} />
                <Typography sx={{ fontSize: 12, color: '#9ca3af' }}>Rig: {shotProperties.rig}</Typography>
              </Stack>
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button 
            onClick={() => { setShowSavePresetDialog(false); setPresetName(''); }} 
            sx={{ color: '#9ca3af' }}
          >
            Avbryt
          </Button>
          <Button
            onClick={() => { handleSaveAsPreset(); setShowSavePresetDialog(false); }}
            variant="contained"
            disabled={!presetName.trim()}
            sx={{
              bgcolor: '#10b981',
              '&:hover': { bgcolor: '#059669' },
              '&.Mui-disabled': { bgcolor: '#374151', color: '#6b7280' },
            }}
          >
            Lagre preset
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Note Dialog */}
      <Dialog
        open={showAddNoteDialog}
        onClose={() => setShowAddNoteDialog(false)}
        PaperProps={{
          sx: {
            bgcolor: '#1a1f2e',
            border: '1px solid #3b82f6',
            minWidth: 400,
          },
        }}
      >
        <DialogTitle sx={{ color: '#fff', borderBottom: '1px solid #2a3142' }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <AddIcon sx={{ color: '#3b82f6' }} />
            <span>Legg til produksjonsnotis</span>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Typography sx={{ color: '#9ca3af', mb: 2, fontSize: 13 }}>
            Velg type notis for scene {selectedScene?.sceneNumber}
          </Typography>
          <Stack spacing={2}>
            <Box>
              <Typography sx={{ fontSize: 12, color: '#6b7280', mb: 1 }}>Type</Typography>
              <Stack direction="row" spacing={1}>
                {[
                  { value: 'camera', label: 'Kamera', icon: CameraIcon, color: '#3b82f6' },
                  { value: 'director', label: 'Regissør', icon: MovieIcon, color: '#8b5cf6' },
                  { value: 'sound', label: 'Lyd', icon: MicIcon, color: '#10b981' },
                  { value: 'vfx', label: 'VFX', icon: SceneIcon, color: '#f59e0b' },
                ].map(type => (
                  <Box
                    key={type.value}
                    onClick={() => setNewNoteType(type.value as typeof newNoteType)}
                    sx={{
                      px: 2,
                      py: 1,
                      borderRadius: '8px',
                      bgcolor: newNoteType === type.value ? `${type.color}22` : 'rgba(0,0,0,0.2)',
                      border: `1px solid ${newNoteType === type.value ? type.color : '#374151'}`,
                      cursor: 'pointer',
                      '&:hover': { borderColor: type.color },
                    }}
                  >
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <type.icon sx={{ fontSize: 14, color: type.color }} />
                      <Typography sx={{ fontSize: 12, color: newNoteType === type.value ? type.color : '#9ca3af' }}>{type.label}</Typography>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </Box>
            <TextField
              fullWidth
              multiline
              rows={3}
              placeholder="Skriv notis..."
              value={productionNoteValue}
              onChange={(e) => setProductionNoteValue(e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: '#0d1117',
                  color: '#fff',
                  '& fieldset': { borderColor: '#374151' },
                  '&:hover fieldset': { borderColor: '#3b82f6' },
                  '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                },
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button 
            onClick={() => { setShowAddNoteDialog(false); setProductionNoteValue(''); }} 
            sx={{ color: '#9ca3af' }}
          >
            Avbryt
          </Button>
          <Button
            onClick={() => {
              if (selectedScene && productionNoteValue.trim()) {
                setProductionNotes(prev => ({
                  ...prev,
                  [selectedScene.id]: {
                    ...prev[selectedScene.id],
                    [newNoteType]: productionNoteValue,
                  },
                }));
                setShowAddNoteDialog(false);
                setProductionNoteValue('');
              }
            }}
            variant="contained"
            disabled={!productionNoteValue.trim()}
            sx={{
              bgcolor: '#3b82f6',
              '&:hover': { bgcolor: '#2563eb' },
              '&.Mui-disabled': { bgcolor: '#374151', color: '#6b7280' },
            }}
          >
            Legg til
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Shot Dialog - Upload or Reference */}
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
              <MovieIcon sx={{ color: '#3b82f6' }} />
              <span>Legg til storyboard shot</span>
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
                Velg hvordan du vil legge til et shot til scene {selectedScene?.sceneNumber}
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
                    Last opp storyboard eller referansebilde fra din maskin
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
                    Søk referanseshots
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: '#6b7280' }}>
                    Finn inspirasjon fra Shot.cafe, filmer og bildedatabaser
                  </Typography>
                </Box>
              </Stack>
            </Stack>
          ) : addShotMode === 'upload' ? (
            /* Upload Mode */
            <Stack spacing={3}>
              <Typography sx={{ color: '#9ca3af', fontSize: 13 }}>
                Last opp et bilde for ditt storyboard shot
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
                    onChange={handleShotImageUpload}
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
                Søk etter referansebilder fra Shot.cafe og andre kilder
              </Typography>
              
              <Stack direction="row" spacing={1}>
                <TextField
                  fullWidth
                  placeholder="Søk: Blade Runner, cinematographer: Roger Deakins, noir lighting..."
                  value={addShotReferenceQuery}
                  onChange={(e) => setAddShotReferenceQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearchReferenceShots()}
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
                  {addShotLoading ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Søk'}
                </Button>
              </Stack>
              
              {/* Quick Search Tags */}
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {['Blade Runner', 'Noir', 'Golden Hour', 'Silhouette', 'Close-up', 'Wide Shot'].map(tag => (
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
                        border: selectedShotImage === result.url ? '3px solid #8b5cf6' : '2px solid transparent',
                        transition: 'all 0.2s',
                        '&:hover': {
                          transform: 'scale(1.05)',
                          boxShadow: '0 4px 20px rgba(139,92,246,0.3)',
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
                          bgcolor: '#8b5cf6',
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
                  <CircularProgress sx={{ color: '#8b5cf6' }} />
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
              onClick={() => handleCreateShot(selectedShotImage || undefined)}
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

      {/* ============================================ */}
      {/* WORKFLOW GAP FIX #2: Scene Needs Dialog */}
      {/* ============================================ */}
      <Dialog
        open={showSceneNeedsDialog}
        onClose={() => {
          setShowSceneNeedsDialog(false);
          setEditingSceneNeedsId(null);
        }}
        PaperProps={{
          sx: {
            bgcolor: '#1a1f2e',
            borderRadius: '16px',
            border: '1px solid #2a3142',
            minWidth: 400,
          },
        }}
      >
        <DialogTitle sx={{ color: '#fff', borderBottom: '1px solid #2a3142', display: 'flex', alignItems: 'center', gap: 1 }}>
          <LightIcon sx={{ color: '#fbbf24' }} />
          Scene Behov - Scene {scenes.find(s => s.id === editingSceneNeedsId)?.sceneNumber}
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Typography sx={{ color: '#9ca3af', mb: 3, fontSize: 13 }}>
            Marker hvilke avdelinger som mangler planlegging for denne scenen:
          </Typography>
          {editingSceneNeedsId && (
            <Stack spacing={2}>
              <Box
                onClick={() => handleUpdateSceneNeeds(editingSceneNeedsId, {
                  ...sceneNeeds[editingSceneNeedsId],
                  cam: !sceneNeeds[editingSceneNeedsId]?.cam,
                })}
                sx={{
                  p: 2,
                  borderRadius: '10px',
                  bgcolor: sceneNeeds[editingSceneNeedsId]?.cam ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.03)',
                  border: sceneNeeds[editingSceneNeedsId]?.cam ? '1px solid #f97316' : '1px solid #2a3142',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': { borderColor: '#f97316' },
                }}
              >
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Stack direction="row" spacing={2} alignItems="center">
                    <CameraIcon sx={{ color: sceneNeeds[editingSceneNeedsId]?.cam ? '#f97316' : '#6b7280' }} />
                    <Box>
                      <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#fff' }}><Stack direction="row" spacing={0.5} alignItems="center" component="span"><CameraIcon sx={{ fontSize: 14, color: '#f97316' }} /> Kamera</Stack></Typography>
                      <Typography sx={{ fontSize: 11, color: '#9ca3af' }}>Linse, bevegelse, rigg ikke planlagt</Typography>
                    </Box>
                  </Stack>
                  <Checkbox
                    checked={sceneNeeds[editingSceneNeedsId]?.cam || false}
                    sx={{ color: '#f97316', '&.Mui-checked': { color: '#f97316' } }}
                  />
                </Stack>
              </Box>

              <Box
                onClick={() => handleUpdateSceneNeeds(editingSceneNeedsId, {
                  ...sceneNeeds[editingSceneNeedsId],
                  light: !sceneNeeds[editingSceneNeedsId]?.light,
                })}
                sx={{
                  p: 2,
                  borderRadius: '10px',
                  bgcolor: sceneNeeds[editingSceneNeedsId]?.light ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.03)',
                  border: sceneNeeds[editingSceneNeedsId]?.light ? '1px solid #fbbf24' : '1px solid #2a3142',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': { borderColor: '#fbbf24' },
                }}
              >
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Stack direction="row" spacing={2} alignItems="center">
                    <LightIcon sx={{ color: sceneNeeds[editingSceneNeedsId]?.light ? '#fbbf24' : '#6b7280' }} />
                    <Box>
                      <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#fff' }}><Stack direction="row" spacing={0.5} alignItems="center" component="span"><LightIcon sx={{ fontSize: 14, color: '#fbbf24' }} /> Lys</Stack></Typography>
                      <Typography sx={{ fontSize: 11, color: '#9ca3af' }}>Lysplan ikke ferdigstilt</Typography>
                    </Box>
                  </Stack>
                  <Checkbox
                    checked={sceneNeeds[editingSceneNeedsId]?.light || false}
                    sx={{ color: '#fbbf24', '&.Mui-checked': { color: '#fbbf24' } }}
                  />
                </Stack>
              </Box>

              <Box
                onClick={() => handleUpdateSceneNeeds(editingSceneNeedsId, {
                  ...sceneNeeds[editingSceneNeedsId],
                  sound: !sceneNeeds[editingSceneNeedsId]?.sound,
                })}
                sx={{
                  p: 2,
                  borderRadius: '10px',
                  bgcolor: sceneNeeds[editingSceneNeedsId]?.sound ? 'rgba(6,182,212,0.15)' : 'rgba(255,255,255,0.03)',
                  border: sceneNeeds[editingSceneNeedsId]?.sound ? '1px solid #06b6d4' : '1px solid #2a3142',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': { borderColor: '#06b6d4' },
                }}
              >
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Stack direction="row" spacing={2} alignItems="center">
                    <MicIcon sx={{ color: sceneNeeds[editingSceneNeedsId]?.sound ? '#06b6d4' : '#6b7280' }} />
                    <Box>
                      <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#fff' }}><Stack direction="row" spacing={0.5} alignItems="center" component="span"><MicIcon sx={{ fontSize: 14, color: '#06b6d4' }} /> Lyd</Stack></Typography>
                      <Typography sx={{ fontSize: 11, color: '#9ca3af' }}>Lydplan/mikrofon ikke satt</Typography>
                    </Box>
                  </Stack>
                  <Checkbox
                    checked={sceneNeeds[editingSceneNeedsId]?.sound || false}
                    sx={{ color: '#06b6d4', '&.Mui-checked': { color: '#06b6d4' } }}
                  />
                </Stack>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #2a3142' }}>
          <Button onClick={() => { setShowSceneNeedsDialog(false); setEditingSceneNeedsId(null); }} sx={{ color: '#9ca3af' }}>
            Lukk
          </Button>
        </DialogActions>
      </Dialog>

      {/* ============================================ */}
      {/* WORKFLOW GAP FIX #3: Schedule Scene to Stripboard Dialog */}
      {/* ============================================ */}
      <Dialog
        open={showScheduleSceneDialog}
        onClose={() => { setShowScheduleSceneDialog(false); setSceneToSchedule(null); }}
        PaperProps={{
          sx: {
            bgcolor: '#1a1f2e',
            borderRadius: '16px',
            border: '1px solid #2a3142',
            minWidth: 500,
          },
        }}
      >
        <DialogTitle sx={{ color: '#fff', borderBottom: '1px solid #2a3142', display: 'flex', alignItems: 'center', gap: 1 }}>
          <CalendarIcon sx={{ color: '#34d399' }} />
          Planlegg Scene til Stripboard
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {sceneToSchedule && (
            <>
              <Box sx={{ p: 2, mb: 3, bgcolor: '#0f1318', borderRadius: '10px', border: '1px solid #2a3142' }}>
                <Typography sx={{ fontSize: 12, color: '#6b7280', mb: 1 }}>SCENE</Typography>
                <Typography sx={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>
                  {sceneToSchedule.sceneNumber} - {sceneToSchedule.intExt}. {sceneToSchedule.locationName}
                </Typography>
                <Typography sx={{ fontSize: 12, color: '#9ca3af', mt: 0.5 }}>
                  {sceneToSchedule.timeOfDay} • {sceneToSchedule.characters?.length || 0} karakterer
                </Typography>
              </Box>

              <Typography sx={{ color: '#9ca3af', mb: 2, fontSize: 13 }}>
                Velg opptaksdag for denne scenen:
              </Typography>
              <Stack spacing={1} sx={{ maxHeight: 300, overflow: 'auto' }}>
                <Box
                  onClick={() => handleScheduleScene(sceneToSchedule.id, '')}
                  sx={{
                    p: 2,
                    borderRadius: '10px',
                    bgcolor: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'rgba(239,68,68,0.15)' },
                  }}
                >
                  <Typography sx={{ fontSize: 13, color: '#f87171' }}><Stack direction="row" spacing={0.5} alignItems="center" component="span"><CancelIcon sx={{ fontSize: 14 }} /> Fjern fra plan (ikke planlagt)</Stack></Typography>
                </Box>
                {shootingDays.map((day) => (
                  <Box
                    key={day.id}
                    onClick={() => handleScheduleScene(sceneToSchedule.id, day.id)}
                    sx={{
                      p: 2,
                      borderRadius: '10px',
                      bgcolor: day.status === 'wrapped' ? 'rgba(107,114,128,0.1)' : 'rgba(52,211,153,0.1)',
                      border: day.status === 'wrapped' ? '1px solid #4b5563' : '1px solid rgba(52,211,153,0.3)',
                      cursor: day.status === 'wrapped' ? 'not-allowed' : 'pointer',
                      opacity: day.status === 'wrapped' ? 0.5 : 1,
                      transition: 'all 0.2s',
                      '&:hover': day.status !== 'wrapped' ? { bgcolor: 'rgba(52,211,153,0.2)' } : {},
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
                          Dag {day.dayNumber} - {new Date(day.date).toLocaleDateString('nb-NO')}
                        </Typography>
                        <Typography sx={{ fontSize: 12, color: '#9ca3af' }}>
                          <Stack direction="row" spacing={0.5} alignItems="center" component="span"><PinIcon sx={{ fontSize: 12 }} /> {day.location}</Stack>
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        label={day.scenes.length + ' scener'}
                        sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: '#9ca3af', fontSize: 10 }}
                      />
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #2a3142' }}>
          <Button onClick={() => { setShowScheduleSceneDialog(false); setSceneToSchedule(null); }} sx={{ color: '#9ca3af' }}>
            Avbryt
          </Button>
        </DialogActions>
      </Dialog>

      {/* ============================================ */}
      {/* WORKFLOW GAP FIX #4: Pre-Production Checklist Dialog */}
      {/* ============================================ */}
      <Dialog
        open={showChecklistDialog}
        onClose={() => setShowChecklistDialog(false)}
        PaperProps={{
          sx: {
            bgcolor: '#1a1f2e',
            borderRadius: '16px',
            border: '1px solid #2a3142',
            minWidth: 450,
          },
        }}
      >
        <DialogTitle sx={{ color: '#fff', borderBottom: '1px solid #2a3142', display: 'flex', alignItems: 'center', gap: 1 }}>
          <AssignmentIcon sx={{ color: '#8b5cf6' }} />
          Pre-Production Checklist - Scene {selectedScene?.sceneNumber}
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {selectedScene && (
            <>
              <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                  <CircularProgress
                    variant="determinate"
                    value={getChecklistProgress(selectedScene.id)}
                    size={60}
                    thickness={4}
                    sx={{ color: getChecklistProgress(selectedScene.id) === 100 ? '#10b981' : '#8b5cf6' }}
                  />
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0, left: 0, bottom: 0, right: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
                      {getChecklistProgress(selectedScene.id)}%
                    </Typography>
                  </Box>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
                    {getChecklistProgress(selectedScene.id) === 100 ? <Stack direction="row" spacing={0.5} alignItems="center" component="span"><CheckCircleIcon sx={{ fontSize: 14, color: '#10b981' }} /> Ready for Production!</Stack> : 'Pre-Production Status'}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: '#9ca3af' }}>
                    {Object.values(sceneChecklists[selectedScene.id] || {}).filter(Boolean).length} av 6 oppgaver fullført
                  </Typography>
                </Box>
              </Box>

              <Stack spacing={1.5}>
                {[
                  { key: 'locationConfirmed', label: 'Lokasjon bekreftet', icon: PinIcon, color: '#10b981' },
                  { key: 'castConfirmed', label: 'Cast bekreftet tilgjengelig', icon: PeopleIcon, color: '#3b82f6' },
                  { key: 'propsReady', label: 'Rekvisitter klare', icon: TheaterIcon, color: '#f59e0b' },
                  { key: 'equipmentAllocated', label: 'Utstyr tildelt', icon: CameraIcon, color: '#ef4444' },
                  { key: 'permitsObtained', label: 'Tillatelser innhentet', icon: AssignmentIcon, color: '#8b5cf6' },
                  { key: 'scriptLocked', label: 'Manus låst', icon: NoteIcon, color: '#ec4899' },
                ].map(({ key, label, icon: IconComponent, color }) => (
                  <Box
                    key={key}
                    onClick={() => handleUpdateChecklist(
                      selectedScene.id,
                      key as keyof typeof sceneChecklists[string],
                      !sceneChecklists[selectedScene.id]?.[key as keyof typeof sceneChecklists[string]]
                    )}
                    sx={{
                      p: 1.5,
                      borderRadius: '10px',
                      bgcolor: sceneChecklists[selectedScene.id]?.[key as keyof typeof sceneChecklists[string]]
                        ? `${color}15`
                        : 'rgba(255,255,255,0.03)',
                      border: sceneChecklists[selectedScene.id]?.[key as keyof typeof sceneChecklists[string]]
                        ? `1px solid ${color}`
                        : '1px solid #2a3142',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      '&:hover': { borderColor: color },
                    }}
                  >
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <IconComponent sx={{ fontSize: 18, color }} />
                        <Typography sx={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: sceneChecklists[selectedScene.id]?.[key as keyof typeof sceneChecklists[string]] ? '#fff' : '#9ca3af',
                          textDecoration: sceneChecklists[selectedScene.id]?.[key as keyof typeof sceneChecklists[string]] ? 'line-through' : 'none',
                        }}>
                          {label}
                        </Typography>
                      </Stack>
                      <Checkbox
                        checked={sceneChecklists[selectedScene.id]?.[key as keyof typeof sceneChecklists[string]] || false}
                        sx={{ color, '&.Mui-checked': { color } }}
                      />
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #2a3142' }}>
          <Button onClick={() => setShowChecklistDialog(false)} sx={{ color: '#9ca3af' }}>
            Lukk
          </Button>
        </DialogActions>
      </Dialog>

      {/* ============================================ */}
      {/* WORKFLOW GAP FIX #7: Bulk Shot Generation Dialog */}
      {/* ============================================ */}
      <Dialog
        open={showBulkShotDialog}
        onClose={() => setShowBulkShotDialog(false)}
        PaperProps={{
          sx: {
            bgcolor: '#1a1f2e',
            borderRadius: '16px',
            border: '1px solid #2a3142',
            minWidth: 500,
          },
        }}
      >
        <DialogTitle sx={{ color: '#fff', borderBottom: '1px solid #2a3142', display: 'flex', alignItems: 'center', gap: 1 }}>
          <MovieIcon sx={{ color: '#3b82f6' }} />
          Generer Shot List - Scene {selectedScene?.sceneNumber}
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Typography sx={{ color: '#9ca3af', mb: 3, fontSize: 13 }}>
            Velg en mal for å automatisk generere shots basert på scenetypen:
          </Typography>
          
          <Stack spacing={2}>
            {[
              {
                key: 'standard' as const,
                title: 'Standard Coverage',
                titleIcon: MovieIcon,
                description: 'Wide, Medium, Close-up (3 shots)',
                shots: 3,
                color: '#3b82f6',
              },
              {
                key: 'dialogue' as const,
                title: 'Dialogue Scene',
                titleIcon: ChatIcon,
                description: 'Master, OTS shots, Close-ups, Insert (6 shots)',
                shots: 6,
                color: '#10b981',
              },
              {
                key: 'action' as const,
                title: 'Action Sequence',
                titleIcon: SceneIcon,
                description: 'Establishing, Action coverage, Reactions (6 shots)',
                shots: 6,
                color: '#ef4444',
              },
            ].map(({ key, title, titleIcon: TitleIcon, description, shots, color }) => (
              <Box
                key={key}
                onClick={() => setBulkShotTemplate(key)}
                sx={{
                  p: 2,
                  borderRadius: '10px',
                  bgcolor: bulkShotTemplate === key ? `${color}15` : 'rgba(255,255,255,0.03)',
                  border: bulkShotTemplate === key ? `2px solid ${color}` : '1px solid #2a3142',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': { borderColor: color, bgcolor: `${color}10` },
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <TitleIcon sx={{ fontSize: 16, color }} />
                      <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{title}</Typography>
                    </Stack>
                    <Typography sx={{ fontSize: 12, color: '#9ca3af', mt: 0.5 }}>{description}</Typography>
                  </Box>
                  <Chip
                    size="small"
                    label={`${shots} shots`}
                    sx={{ bgcolor: `${color}30`, color, fontSize: 11 }}
                  />
                </Stack>
              </Box>
            ))}
          </Stack>

          {bulkShotTemplate !== 'custom' && (
            <Box sx={{ mt: 3, p: 2, bgcolor: '#0f1318', borderRadius: '10px', border: '1px solid #2a3142' }}>
              <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#6b7280', mb: 1 }}>
                SHOTS SOM VIL BLI OPPRETTET:
              </Typography>
              <Stack spacing={0.5}>
                {SHOT_TEMPLATES[bulkShotTemplate].map((shot, idx) => (
                  <Typography key={idx} sx={{ fontSize: 12, color: '#9ca3af' }}>
                    {idx + 1}. {shot.shotType} - {shot.description} ({shot.duration}s)
                  </Typography>
                ))}
              </Stack>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #2a3142' }}>
          <Button onClick={() => setShowBulkShotDialog(false)} sx={{ color: '#9ca3af' }}>
            Avbryt
          </Button>
          <Button
            onClick={() => selectedScene && handleGenerateBulkShots(selectedScene.id, bulkShotTemplate)}
            variant="contained"
            startIcon={<AddIcon />}
            sx={{
              bgcolor: '#3b82f6',
              '&:hover': { bgcolor: '#2563eb' },
            }}
          >
            Generer {SHOT_TEMPLATES[bulkShotTemplate].length} Shots
          </Button>
        </DialogActions>
      </Dialog>

      {/* ============================================ */}
      {/* WORKFLOW GAP FIX #8: Shot Line Coverage Dialog */}
      {/* ============================================ */}
      <Dialog
        open={showLineCoverageDialog}
        onClose={() => setShowLineCoverageDialog(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#1a1f2e',
            borderRadius: '16px',
            border: '1px solid #2a3142',
          },
        }}
      >
        <DialogTitle sx={{ color: '#fff', borderBottom: '1px solid #2a3142', display: 'flex', alignItems: 'center', gap: 1 }}>
          <NoteIcon sx={{ color: '#ec4899' }} />
          Shot Line Coverage - Scene {selectedScene?.sceneNumber}
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {selectedScene && (
            <>
              <Typography sx={{ color: '#9ca3af', mb: 3, fontSize: 13 }}>
                Marker hvilke dialoglinjer som dekkes av hver shot for continuity-tracking:
              </Typography>
              
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
                {/* Shots Column */}
                <Box>
                  <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#6b7280', mb: 2, letterSpacing: 0.5 }}>
                    SHOTS ({selectedSceneShots.length})
                  </Typography>
                  <Stack spacing={1}>
                    {selectedSceneShots.map((shot, idx) => (
                      <Box
                        key={shot.id}
                        sx={{
                          p: 1.5,
                          borderRadius: '8px',
                          bgcolor: selectedShot?.id === shot.id ? 'rgba(59,130,246,0.15)' : '#0f1318',
                          border: selectedShot?.id === shot.id ? '1px solid #3b82f6' : '1px solid #2a3142',
                          cursor: 'pointer',
                          '&:hover': { borderColor: '#3b82f6' },
                        }}
                        onClick={() => setSelectedShot(shot)}
                      >
                        <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>
                          SHOT {idx + 1}: {shot.shotType}
                        </Typography>
                        <Typography sx={{ fontSize: 10, color: '#6b7280' }}>
                          {shotLineCoverage[shot.id]?.dialogueIds.length || 0} linjer dekket
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Box>

                {/* Dialogue Lines Column */}
                <Box>
                  <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#6b7280', mb: 2, letterSpacing: 0.5 }}>
                    DIALOGLINJER ({dialogueLines.filter(d => d.sceneId === selectedScene.id).length})
                  </Typography>
                  <Stack spacing={1} sx={{ maxHeight: 300, overflow: 'auto' }}>
                    {dialogueLines.filter(d => d.sceneId === selectedScene.id).map((line) => {
                      const isCovered = selectedShot && shotLineCoverage[selectedShot.id]?.dialogueIds.includes(line.id);
                      const coveringShots = getShotCoverageForDialogue(line.id);
                      
                      return (
                        <Box
                          key={line.id}
                          onClick={() => {
                            if (selectedShot) {
                              const currentCoverage = shotLineCoverage[selectedShot.id] || { startLine: 0, endLine: 0, dialogueIds: [] };
                              const newDialogueIds = isCovered
                                ? currentCoverage.dialogueIds.filter(id => id !== line.id)
                                : [...currentCoverage.dialogueIds, line.id];
                              handleUpdateShotLineCoverage(selectedShot.id, 0, 0, newDialogueIds);
                            }
                          }}
                          sx={{
                            p: 1.5,
                            borderRadius: '8px',
                            bgcolor: isCovered ? 'rgba(16,185,129,0.15)' : coveringShots.length > 0 ? 'rgba(251,191,36,0.1)' : '#0f1318',
                            border: isCovered ? '1px solid #10b981' : coveringShots.length > 0 ? '1px solid #fbbf24' : '1px solid #2a3142',
                            cursor: selectedShot ? 'pointer' : 'default',
                            opacity: selectedShot ? 1 : 0.6,
                            '&:hover': selectedShot ? { borderColor: '#10b981' } : {},
                          }}
                        >
                          <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#9ca3af' }}>
                            {line.characterName}
                          </Typography>
                          <Typography sx={{ fontSize: 12, color: '#fff', mt: 0.5 }}>
                            "{line.dialogueText?.substring(0, 50)}{(line.dialogueText?.length || 0) > 50 ? '...' : ''}"
                          </Typography>
                          {coveringShots.length > 0 && (
                            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }}>
                              <CheckIcon sx={{ fontSize: 12, color: '#fbbf24' }} />
                              <Typography sx={{ fontSize: 10, color: '#fbbf24' }}>
                                Dekket av {coveringShots.length} shot(s)
                              </Typography>
                            </Stack>
                          )}
                        </Box>
                      );
                    })}
                  </Stack>
                  
                  {/* Uncovered Warning */}
                  {getUncoveredDialogue(selectedScene.id).length > 0 && (
                    <Alert severity="warning" sx={{ mt: 2, bgcolor: 'rgba(245,158,11,0.1)', border: '1px solid #f59e0b' }}>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <WarningIcon sx={{ fontSize: 14 }} />
                        <Typography sx={{ fontSize: 12 }}>
                          {getUncoveredDialogue(selectedScene.id).length} dialog linje(r) er ikke dekket av noen shots!
                        </Typography>
                      </Stack>
                    </Alert>
                  )}
                </Box>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #2a3142' }}>
          <Button onClick={() => setShowLineCoverageDialog(false)} sx={{ color: '#9ca3af' }}>
            Lukk
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// Helper component for detail rows (memoized)
const DetailRow: FC<{ icon: string; label: string }> = memo(({ icon, label }) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      px: 1.5,
      py: 1,
      bgcolor: '#374151',
      borderRadius: 1,
    }}
  >
    <Stack direction="row" spacing={1.5} alignItems="center">
      <Typography sx={{ fontSize: 14 }}>{icon}</Typography>
      <Typography sx={{ fontSize: 13, color: '#e5e7eb' }}>{label}</Typography>
    </Stack>
    <ExpandMoreIcon sx={{ fontSize: 16, color: '#6b7280' }} />
  </Box>
));

// Interactive editable detail row component
interface EditableDetailRowProps {
  icon: ReactNode;
  value: string;
  field: string;
  isEditing: boolean;
  editValue: string;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onChange: (value: string) => void;
  options: string[];
}

const EditableDetailRow: FC<EditableDetailRowProps> = ({
  icon,
  value,
  isEditing,
  editValue,
  onStartEdit,
  onSave,
  onCancel,
  onChange,
  options,
}) => {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  if (isEditing) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 0.5,
          bgcolor: '#374151',
          borderRadius: 1,
          border: '1px solid #3b82f6',
        }}
      >
        <Box sx={{ color: '#9ca3af', display: 'flex', alignItems: 'center' }}>{icon}</Box>
        <TextField
          size="small"
          value={editValue}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSave();
            if (e.key === 'Escape') onCancel();
          }}
          autoFocus
          fullWidth
          sx={{
            '& .MuiInputBase-root': {
              bgcolor: '#252d3d',
              fontSize: 13,
              color: '#e5e7eb',
            },
            '& .MuiInputBase-input': {
              py: 0.5,
              px: 1,
            },
            '& .MuiOutlinedInput-notchedOutline': {
              border: 'none',
            },
          }}
        />
        <IconButton size="small" onClick={onSave} sx={{ color: '#4ade80', p: 0.5 }}>
          <CheckIcon sx={{ fontSize: 16 }} />
        </IconButton>
        <IconButton size="small" onClick={onCancel} sx={{ color: '#f87171', p: 0.5 }}>
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>
    );
  }

  return (
    <>
      <Box
        onClick={(e) => setMenuAnchor(e.currentTarget)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.5,
          py: 1,
          bgcolor: '#374151',
          borderRadius: 1,
          cursor: 'pointer',
          transition: 'all 0.2s',
          '&:hover': {
            bgcolor: '#404b5e',
            '& .edit-icon': { opacity: 1 },
          },
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1 }}>
          <Box sx={{ color: '#9ca3af', display: 'flex', alignItems: 'center' }}>{icon}</Box>
          <Typography sx={{ fontSize: 13, color: '#e5e7eb' }}>{value}</Typography>
        </Stack>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <IconButton
            className="edit-icon"
            size="small"
            onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
            sx={{ 
              opacity: 0, 
              p: 0.25, 
              color: '#9ca3af',
              transition: 'opacity 0.2s',
              '&:hover': { color: '#3b82f6' },
            }}
          >
            <EditIcon sx={{ fontSize: 14 }} />
          </IconButton>
          <ExpandMoreIcon sx={{ fontSize: 16, color: '#6b7280' }} />
        </Stack>
      </Box>
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        PaperProps={{
          sx: {
            bgcolor: '#1e2536',
            border: '1px solid #2a3142',
            minWidth: 180,
          },
        }}
      >
        {options.map((option) => (
          <MenuItem
            key={option}
            onClick={() => {
              onChange(option);
              onStartEdit();
              setTimeout(() => {
                onSave();
              }, 0);
              setMenuAnchor(null);
            }}
            sx={{
              color: '#fff',
              fontSize: 13,
              '&:hover': { bgcolor: 'rgba(59, 130, 246, 0.2)' },
              bgcolor: value === option ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
            }}
          >
            {option}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

// New Scene Dialog
const NewSceneDialog: FC<{
  open: boolean;
  onClose: () => void;
  onCreate: () => void;
}> = ({ open, onClose, onCreate }) => (
  <Dialog
    open={open}
    onClose={onClose}
    PaperProps={{
      sx: {
        bgcolor: '#1a1f2e',
        border: '1px solid #2a3142',
        minWidth: 400,
      },
    }}
  >
    <DialogTitle sx={{ color: '#fff', borderBottom: '1px solid #2a3142' }}>
      Opprett ny scene
    </DialogTitle>
    <DialogContent sx={{ pt: 3 }}>
      <Typography sx={{ color: '#9ca3af', mb: 2 }}>
        En ny scene vil bli opprettet med standardverdier. Du kan redigere scenen etterpå.
      </Typography>
    </DialogContent>
    <DialogActions sx={{ px: 3, pb: 2 }}>
      <Button onClick={onClose} sx={{ color: '#9ca3af' }}>
        Avbryt
      </Button>
      <Button
        onClick={onCreate}
        variant="contained"
        sx={{
          bgcolor: '#10b981',
          '&:hover': { bgcolor: '#059669' },
        }}
      >
        Opprett scene
      </Button>
    </DialogActions>
  </Dialog>
);

// Delete Confirmation Dialog
const DeleteConfirmDialog: FC<{
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}> = ({ open, onClose, onConfirm }) => (
  <Dialog
    open={open}
    onClose={onClose}
    PaperProps={{
      sx: {
        bgcolor: '#1a1f2e',
        border: '1px solid #ef4444',
        minWidth: 400,
      },
    }}
  >
    <DialogTitle sx={{ color: '#fff', borderBottom: '1px solid #2a3142' }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <WarningIcon sx={{ color: '#ef4444' }} />
        <span>Slett scene?</span>
      </Stack>
    </DialogTitle>
    <DialogContent sx={{ pt: 3 }}>
      <Typography sx={{ color: '#9ca3af' }}>
        Er du sikker på at du vil slette denne scenen? Denne handlingen kan ikke angres.
      </Typography>
    </DialogContent>
    <DialogActions sx={{ px: 3, pb: 2 }}>
      <Button onClick={onClose} sx={{ color: '#9ca3af' }}>
        Avbryt
      </Button>
      <Button
        onClick={onConfirm}
        variant="contained"
        sx={{
          bgcolor: '#ef4444',
          '&:hover': { bgcolor: '#dc2626' },
        }}
      >
        Slett scene
      </Button>
    </DialogActions>
  </Dialog>
);

export default ProductionManuscriptView;
