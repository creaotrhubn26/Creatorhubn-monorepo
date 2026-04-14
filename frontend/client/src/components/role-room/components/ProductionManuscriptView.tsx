import { useState, useEffect, useRef, useMemo, useCallback, useReducer, memo, type FC, type ReactNode, type ChangeEvent, type MouseEvent } from "react";
import { Box, Typography, Stack, IconButton, Select, MenuItem, FormControl, Tooltip, Collapse, Menu, TextField, InputAdornment, Divider, Dialog, DialogTitle, DialogContent, DialogActions, Button, Badge, Drawer, Chip, Checkbox, CircularProgress, Alert, useMediaQuery, useTheme, Skeleton } from "@mui/material";
import { Theaters as SceneIcon, Videocam as CameraIcon, Lightbulb as LightIcon, Mic as MicIcon, ExpandMore as ExpandMoreIcon, ExpandLess as ExpandLessIcon, Movie as MovieIcon, Add as AddIcon, Close as CloseIcon, Image as ImageIcon, GridView as GridViewIcon, ViewList as ViewListIcon, PlayArrow as PlayIcon, Warning as WarningIcon, Print as PrintIcon, Check as CheckIcon, Edit as EditIcon, ZoomIn as ZoomInIcon, ZoomOut as ZoomOutIcon, Fullscreen as FullscreenIcon, Search as SearchIcon, DragIndicator as DragIcon, Download as DownloadIcon, FileDownload as ExportIcon, Pause as PauseIcon, Timer as TimerIcon, RecordVoiceOver as ReadThroughIcon, People as PeopleIcon, ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon, Person as PersonIcon, Notes as NoteIcon, FileCopy as FileCopyIcon, Bookmark as BookmarkIcon, Assignment as AssignmentIcon, Phone as PhoneIcon, Email as EmailIcon, VideoLibrary as VideoLibraryIcon, FiberManualRecord as LiveIcon, ViewWeek as StripboardIcon, CalendarMonth as CalendarIcon, Description as CallSheetIcon, Refresh as RefreshIcon, Settings as SettingsIcon, WbSunny as SunIcon, NightsStay as MoonIcon, WbTwilight as TwilightIcon, Home as HomeIcon, Park as ParkIcon, PushPin as PinIcon, FormatQuote as QuoteIcon, PhotoCamera as PhotoIcon, CameraAlt as CameraAltIcon, Inventory as InventoryIcon, TheaterComedy as TheaterIcon, Cancel as CancelIcon, CheckCircle as CheckCircleIcon, Chat as ChatIcon, CameraRoll as CameraRollIcon } from "@mui/icons-material";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { SceneBreakdown, DialogueLine, Act, Manuscript, CastingShot, ShotList, Candidate, Role, ShotType } from "../models/casting";
import { computeStoryboardCoverageSummary } from "../models/derivedState";
import type { StoryLogicState } from "../services/storyLogicService";
import { ProductionEstimateDialog } from "./ProductionEstimateDialog";
import { castingService } from "../services/castingService";
import { manuscriptService } from "../services/manuscriptService";
import { sceneNeedsService } from "../services/sceneNeedsService";
import { getCandidatePhotoObjectPosition } from "../utils/candidatePhotoFocalPoint";
import { speak as ttsSpeak, stopTTS, pauseTTS, resumeTTS, isTTSPlaying, assignCharacterVoices, preloadTTS, clearTTSCache, TTS_VOICES, TTS_LANGUAGES, type TTSVoice, type TTSLanguage } from "../services/ttsService";
import LiveSetMode from "./production/LiveSetMode";
import StripboardPanel from "./production/StripboardPanel";
import ShootingDayPlanner from "./production/ShootingDayPlanner";
import CallSheetGenerator from "./CallSheetGenerator";
import { productionWorkflowService, generateCallSheetHTML, downloadCallSheetPDF, DEFAULT_CALL_SHEET_OPTIONS, type CallSheet, type ShootingDay, type LiveSetStatus } from "./production";
import AddShotDialog, { type AddShotDialogCreatePayload } from "./production/AddShotDialog";
import SceneStoryboardDialog from "./production/SceneStoryboardDialog";
import ProductionNotesPanel from "./production/ProductionNotesPanel";
import { addShotReducer, deriveSceneStatus, loadZoomPreference, saveZoomPreference, loadFullscreenPreference, saveFullscreenPreference, selectedMapToggle, selectedMapFromIds, selectedMapSize, selectedMapHas, selectedMapIds, EMPTY_SELECTION, DEFAULT_FILTERS, workflowReducer, INITIAL_WORKFLOW_STATE, loadWorkflowPreference, saveWorkflowPreference, EMPTY_CHECKLIST, deriveReadinessScore, searchReducer, INITIAL_SEARCH_STATE, inspectorReducer, INITIAL_INSPECTOR_STATE, loadExpandedSections, saveExpandedSections, buildDefaultShotMeta, metaToShotProperties, shotPropertiesToMeta, DEFAULT_SHOT_PROPERTIES, type NoteType, type ProductionNotes, type ShotSearchResult, type DerivedSceneStatus, type SelectedMap, type SceneFilters, type WorkflowUIState, type CallSheetRef, type BulkShotTemplate, type ChecklistKey, type SceneChecklist, type SearchSource, type ShotCafeFilm, type ReferenceImageResult, type ShotMeta as _ShotMeta, type ShotMetadataMap, type ShotPreset } from "./production/types";
import { useSceneHistory } from "./production/useSceneHistory";
import { useEquipmentInventory } from "./production/useEquipmentInventory";
import GlobalMentionHelper from "./shared/GlobalMentionHelper";
import {
  applyStoryboardCandidateToShot,
  buildSceneStoryboardCandidates,
  clearStoryboardLinkFromShot,
  createSceneStoryboardFrameFromShot,
  loadStoryboardLibraryItemsForProject,
  resolveStoryboardShotLink,
  syncShotListWithSceneStoryboard,
  type StoryboardSeedCandidate,
} from "../services/storyboardLibraryService";

// ============================================
// 7-TIER RESPONSIVE SYSTEM
// ============================================
type ScreenTier = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | '4k';

const useScreenTier = (): { tier: ScreenTier; isMobile: boolean; isTablet: boolean; isDesktop: boolean; is4K: boolean; breakpointSpacing: number } => {
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
  // Use theme spacing and isXs for fine-grained responsive control
  const breakpointSpacing = isXs ? theme.spacing(0.5) as unknown as number : theme.spacing(1) as unknown as number;

  return { tier, isMobile, isTablet, isDesktop, is4K, breakpointSpacing };
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

const toDisplayString = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return fallback;
};

const toOptionalNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const toSceneNumber = (value: unknown): number | undefined => {
  const parsed = toOptionalNumber(value);
  return parsed === undefined ? undefined : Math.trunc(parsed);
};

const toTimestamp = (value: unknown): number => {
  const raw = toDisplayString(value);
  const timestamp = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const toFontNumber = (value: unknown, fallback = 13): number => {
  const parsed = toOptionalNumber(value);
  return parsed ?? fallback;
};

interface ProductionManuscriptViewProps {
  manuscript: Manuscript;
  scenes: SceneBreakdown[];
  dialogueLines: DialogueLine[];
  acts: Act[];
  projectId: string;
  storyLogicData?: StoryLogicState | null;
  onSceneUpdate?: (scene: SceneBreakdown) => void;
  onSceneDelete?: (sceneId: string) => void;
  onSceneCreate?: (scene: SceneBreakdown) => void;
  onScenesReorder?: (scenes: SceneBreakdown[]) => void;
  onManuscriptUpdate?: (manuscript: Manuscript) => void;
  onClose?: () => void;
}

// ============================================
// UI Design Tokens — single source for all scene-list colours
// ============================================
const UI = {
  bg:       { selected: 'rgba(59,130,246,0.1)', selectedHover: 'rgba(59,130,246,0.15)', hover: 'rgba(255,255,255,0.02)', transparent: 'transparent', thumbnail: '#1a2230' },
  text:     { primary: '#d1d5db', secondary: '#9ca3af', muted: '#6b7280', dimmed: '#4b5563', white: '#fff' },
  border:   { default: '#252d3d', selected: '#3b82f6', transparent: 'transparent' },
  accent:   { blue: '#3b82f6', red: '#ef4444' },
  status:   { complete: '#4caf50', partial: '#9333ea', missing: '#f44336' },
  needs:    { cam: '#f97316', light: '#fbbf24', sound: '#06b6d4' },
  ring:     { selected: '0 0 0 1px rgba(59,130,246,0.35)' },
} as const;

// Status colors
const STATUS_COLORS = UI.status;

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
  shotsCount: number;
  showTags: boolean;
  thumbnail?: string;
  onSceneClick: (scene: SceneBreakdown) => void;
}

// Status icon helper — accessibility: never rely on colour alone
const STATUS_ICON: Record<string, ReactNode> = {
  complete: <CheckCircleIcon sx={{ fontSize: 12, color: UI.status.complete }} />,
  partial:  <WarningIcon      sx={{ fontSize: 12, color: UI.status.partial }} />,
  missing:  <CancelIcon        sx={{ fontSize: 12, color: UI.status.missing }} />,
};

const SortableSceneItem: FC<SortableSceneItemProps> = memo(({
  scene,
  isSelected,
  status,
  statusColor,
  needs,
  shotsCount,
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

  // Thumbnail loading state (#5)
  const [thumbLoaded, setThumbLoaded] = useState(!thumbnail);
  useEffect(() => {
    if (thumbnail) {
      setThumbLoaded(false);
      const img = new Image();
      img.onload = () => setThumbLoaded(true);
      img.onerror = () => setThumbLoaded(true);
      img.src = thumbnail;
    }
  }, [thumbnail]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Build needs tooltip string (#7)
  const needsLabels: string[] = [];
  if (needs.cam)   needsLabels.push('Camera');
  if (needs.light) needsLabels.push('Light');
  if (needs.sound) needsLabels.push('Sound');

  return (
    <Box
      ref={setNodeRef}
      style={style}
      sx={{
        display: 'flex',
        alignItems: 'center',
        px: 0.5,
        py: 0,
        cursor: isDragging ? 'grabbing' : 'default',
        bgcolor: isSelected ? UI.bg.selected : UI.bg.transparent,
        borderLeft: isSelected ? `3px solid ${UI.border.selected}` : `3px solid ${UI.border.transparent}`,
        boxShadow: isSelected ? UI.ring.selected : 'none',
        transition: 'background-color 0.15s, box-shadow 0.15s',
      }}
    >
      {/* Drag Handle — enlarged hit area, isolated from select (#1 #4) */}
      <Box
        {...attributes}
        {...listeners}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        aria-label={`Drag scene ${scene.sceneNumber}`}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: 1,
          py: 0.5,
          cursor: 'grab',
          color: UI.text.muted,
          borderRadius: '4px',
          '&:hover': { color: UI.text.secondary, bgcolor: 'rgba(255,255,255,0.04)' },
        }}
      >
        <DragIcon sx={{ fontSize: 16 }} />
      </Box>

      {/* Select zone — thumbnail + info (#1) */}
      <Box
        onClick={() => onSceneClick(scene)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          flex: 1,
          minWidth: 0,
          cursor: 'pointer',
          px: 1,
          py: 1.5,
          borderRadius: '6px',
          '&:hover': { bgcolor: isSelected ? UI.bg.selectedHover : UI.bg.hover },
        }}
      >
        {/* Scene Thumbnail/Icon (#5 fallback + #8 scene number badge) */}
        <Box
          sx={{
            width: 44,
            height: 32,
            borderRadius: '6px',
            bgcolor: isSelected ? UI.accent.blue : UI.bg.thumbnail,
            border: `1px solid ${isSelected ? UI.accent.blue : UI.border.default}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mr: 1.5,
            position: 'relative',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          {/* Background thumbnail or skeleton */}
          {thumbnail && thumbLoaded && (
            <Box sx={{ position: 'absolute', inset: 0, backgroundImage: `url(${thumbnail})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
          )}
          {thumbnail && !thumbLoaded && (
            <Skeleton variant="rectangular" width={44} height={32} sx={{ bgcolor: 'rgba(255,255,255,0.05)', position: 'absolute', inset: 0 }} />
          )}
          {!thumbnail && (
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: isSelected ? UI.text.white : UI.text.secondary }}>
              {scene.sceneNumber}
            </Typography>
          )}
          {/* Scene number badge — always visible when thumbnail present (#8) */}
          {thumbnail && (
            <Box sx={{ position: 'absolute', top: 1, left: 1, bgcolor: 'rgba(0,0,0,0.6)', borderRadius: '3px', px: 0.4, lineHeight: 1 }}>
              <Typography sx={{ fontSize: 8, fontWeight: 700, color: UI.text.white }}>{scene.sceneNumber}</Typography>
            </Box>
          )}
          {/* Status icon badge — accessibility, not colour alone (#6) */}
          <Box sx={{ position: 'absolute', bottom: 1, right: 1 }}>
            {STATUS_ICON[status]}
          </Box>
          {/* Status color bar */}
          <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, bgcolor: statusColor }} />
        </Box>

        {/* Scene info */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{
            fontSize: 12,
            fontWeight: isSelected ? 600 : 500,
            color: isSelected ? UI.text.white : UI.text.primary,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {scene.intExt}. {scene.locationName}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography sx={{ fontSize: 10, color: UI.text.muted }}>
              {scene.timeOfDay}
            </Typography>
            {shotsCount > 0 && (
              <Typography sx={{ fontSize: 10, color: UI.text.dimmed }}>
                • {shotsCount} shots
              </Typography>
            )}
          </Stack>
        </Box>
      </Box>

      {/* Needs indicator — with tooltip (#7) */}
      {showTags && needsLabels.length > 0 && (
        <Tooltip title={`Needs: ${needsLabels.join(', ')}`} placement="left" arrow>
          <Stack direction="row" spacing={0.5} sx={{ ml: 0.5, mr: 0.5 }}>
            {needs.cam   && <CameraIcon sx={{ fontSize: 12, color: UI.needs.cam }} />}
            {needs.light && <LightIcon  sx={{ fontSize: 12, color: UI.needs.light }} />}
            {needs.sound && <MicIcon    sx={{ fontSize: 12, color: UI.needs.sound }} />}
          </Stack>
        </Tooltip>
      )}
    </Box>
  );
}); // End of memo for SortableSceneItem

// ============================================
// Debounce hooks — bærekraftig pattern
// ============================================

/**
 * Debounced callback — for object/array autosave without state churn.
 * Returns { debounced, cancel, flush }.
 * - debounced(...args): starts/restarts the delay timer
 * - cancel(): clears pending invocation
 * - flush(): fires immediately if pending
 */
function useDebouncedCallback<T extends (...args: any[]) => void>(fn: T, delay: number) {
  const fnRef = useRef(fn);
  useEffect(() => { fnRef.current = fn; }, [fn]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingArgsRef = useRef<Parameters<T> | null>(null);

  const cancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    pendingArgsRef.current = null;
  }, []);

  const flush = useCallback(() => {
    if (timerRef.current && pendingArgsRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      fnRef.current(...pendingArgsRef.current);
      pendingArgsRef.current = null;
    }
  }, []);

  const debounced = useCallback((...args: Parameters<T>) => {
    pendingArgsRef.current = args;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      fnRef.current(...args);
      pendingArgsRef.current = null;
      timerRef.current = null;
    }, delay);
  }, [delay]);

  // Auto-cancel on unmount
  useEffect(() => cancel, [cancel]);

  return { debounced, cancel, flush };
}

// ============================================
// Module-level constants (outside component body to avoid re-creation)
// ============================================
const AVAILABLE_CAMERAS = [
  'Sony FX6', 'Sony FX3', 'Sony A7S III', 'Sony Venice 2',
  'RED Komodo', 'RED V-Raptor', 'ARRI Alexa Mini LF', 'ARRI Alexa 35',
  'Blackmagic URSA Mini Pro', 'Canon C70', 'Canon R5 C', 'Panasonic S1H',
];

/** Pre-computed lowercase set for case-insensitive camera matching */
const AVAILABLE_CAMERAS_LOWER = new Set(AVAILABLE_CAMERAS.map(c => c.toLowerCase()));

const applyMentionSuggestion = (sourceText: string | undefined, name: string): string => {
  const current = typeof sourceText === 'string' ? sourceText : '';
  if (!current.trim()) return name;
  const replaced = current.replace(/([A-Za-zÆØÅæøå][A-Za-z0-9ÆØÅæøå'.-]*)$/u, name);
  return replaced !== current ? replaced : `${current.trimEnd()} ${name}`;
};

export const ProductionManuscriptView: FC<ProductionManuscriptViewProps> = ({
  manuscript,
  scenes,
  dialogueLines,
  acts,
  projectId,
  storyLogicData,
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
  const responsiveBodyFontSize = toFontNumber(responsive.bodyFontSize);
  
  // Desktop/4K-specific layout adjustments — used for responsive container sizing
  const panelMaxWidth = is4K ? 2560 : isDesktop ? 1400 : undefined;
  const sidebarExpandedWidth = is4K ? 400 : isDesktop ? 320 : 280;
  const containerStyle = useMemo(() => ({
    maxWidth: panelMaxWidth,
    sidebarWidth: sidebarExpandedWidth,
  }), [panelMaxWidth, sidebarExpandedWidth]);
  
  // Mobile drawer states
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileRightPanelOpen, setMobileRightPanelOpen] = useState(false);
  
  const [selectedScene, setSelectedScene] = useState<SceneBreakdown | null>(scenes[0] || null);
  const [selectedShot, setSelectedShot] = useState<CastingShot | null>(null);
  const [shotLists, setShotLists] = useState<ShotList[]>([]);
  const [sceneStoryboardDialog, setSceneStoryboardDialog] = useState<{
    sceneId: string;
    activeFrameIndex?: number;
  } | null>(null);
  const [shotStoryboardDialog, setShotStoryboardDialog] = useState<{
    shotId: string;
    selectedCandidateId: string | null;
  } | null>(null);
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
  const [readThroughNotes, setReadThroughNotes] = useState<Record<number, string>>({});

  // TTS (Text-to-Speech) state — multilingual voice integration
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [ttsVoice, setTtsVoice] = useState<TTSVoice>('nova');
  const [ttsLanguage, setTtsLanguage] = useState<TTSLanguage | ''>('');
  const [ttsSpeed, setTtsSpeed] = useState(1.0);
  const [ttsCharacterVoices, setTtsCharacterVoices] = useState<Record<string, TTSVoice>>({});
  const [ttsUseCharacterVoices, setTtsUseCharacterVoices] = useState(true);
  const ttsPlayingRef = useRef(false);
  const [showTalentPanel, setShowTalentPanel] = useState(false);
  const [sceneCandidates, setSceneCandidates] = useState<Candidate[]>([]);
  const [projectRoles, setProjectRoles] = useState<Role[]>([]);

  // Production notes — normalized 4-type model, per-scene autosave lives in <ProductionNotesPanel>
  const [productionNotes, setProductionNotes] = useState<ProductionNotes>({});

  // Scene status — derived from shot data (no manual state needed for core status)
  // Manual overrides stored here only for explicit user overrides
  const [sceneStatusOverrides, setSceneStatusOverrides] = useState<Record<string, DerivedSceneStatus>>({});

  // Manuscript zoom — persisted to localStorage
  const [manuscriptZoom, setManuscriptZoom] = useState(() => loadZoomPreference(projectId));
  const [isManuscriptFullscreen, setIsManuscriptFullscreen] = useState(() => loadFullscreenPreference(projectId));

  // Add Shot Dialog — FSM via useReducer (all dialog state in one place)
  const [addShotState, addShotDispatch] = useReducer(addShotReducer, { open: false });

  // Timeline state — timelineCurrentTime is the single source of truth
  const [timelineCurrentTime, setTimelineCurrentTime] = useState(0); // in seconds (throttled for UI)
  const [timelineIsPlaying, setTimelineIsPlaying] = useState(false);
  const [timelineZoom, setTimelineZoom] = useState(1); // 1 = normal, 2 = 2x zoom
  const [timelineViewMode, setTimelineViewMode] = useState<'timeline' | 'grid' | 'list'>('timeline');

  // Playhead perf refs — DOM-direct updates, no re-render per frame
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const playheadRef = useRef<HTMLDivElement | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const currentTimeRef = useRef(0);

  // Undo/Redo — patch-based command pattern (replaces full-snapshot history)
  const { pushPatch, undo: undoPatch, redo: redoPatch, canUndo: _canUndo, canRedo: _canRedo, lastPatchLabel: _lastPatchLabel, reset: resetHistory } = useSceneHistory();
  const [selectedScenes, setSelectedScenes] = useState<SelectedMap>(EMPTY_SELECTION);
  const [batchMode, setBatchMode] = useState(false);

  // Drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  // Equipment inventory — cached per project (replaces inline useState + useEffect)
  const { equipment: _equipment, getByCategory: getEquipmentByCategory } = useEquipmentInventory(projectId);
  
  // Filters — compressed into single object (replaces 5 separate booleans)
  const [filters, setFilters] = useState<SceneFilters>(DEFAULT_FILTERS);
  
  // Scene needs tracking (loaded from DB, synced with scenes)
  const [sceneNeeds, setSceneNeeds] = useState<Record<string, { cam: boolean; light: boolean; sound: boolean }>>({});

  // Scene tagging system (synced with scenes — auto-adds/removes keys)
  const [sceneTags, setSceneTags] = useState<Record<string, string[]>>({});

  // ============================================
  // WORKFLOW UI — single FSM reducer (replaces ~15 booleans)
  // ============================================
  const workflowInit = useMemo((): WorkflowUIState => {
    const saved = loadWorkflowPreference(projectId);
    if (saved) {
      return {
        ...INITIAL_WORKFLOW_STATE,
        ...saved,
        modal: { type: 'none' },
      };
    }
    return INITIAL_WORKFLOW_STATE;
  }, [projectId]);

  const [workflowUI, dispatchWorkflow] = useReducer(workflowReducer, workflowInit);

  // Persist workflow view preference on change
  useEffect(() => {
    saveWorkflowPreference(projectId, workflowUI);
  }, [projectId, workflowUI.view.tab, workflowUI.selectedDayId]);

  // ---- Derived convenience aliases ----
  const showLiveSetMode = workflowUI.view.tab === 'live' && !('showDaySelector' in workflowUI.view && workflowUI.view.showDaySelector);
  const showStripboardPanel = workflowUI.view.tab === 'stripboard';
  const showShootingDayPlanner = workflowUI.view.tab === 'schedule';
  const showLiveSetDaySelector = workflowUI.view.tab === 'live' && 'showDaySelector' in workflowUI.view && workflowUI.view.showDaySelector;
  const showCallSheetPreview = workflowUI.modal.type === 'callSheetPreview';
  const currentCallSheet: CallSheetRef | null = workflowUI.modal.type === 'callSheetPreview' ? workflowUI.modal.callSheet : null;
  const productionWorkflowTab = workflowUI.view.tab;
  const selectedShootingDayId = workflowUI.selectedDayId;
  const showSceneNeedsDialog = workflowUI.modal.type === 'sceneNeeds';
  const editingSceneNeedsId: string | null = workflowUI.modal.type === 'sceneNeeds' ? workflowUI.modal.sceneId : null;
  const showScheduleSceneDialog = workflowUI.modal.type === 'scheduleScene';
  const sceneToScheduleId: string | null = workflowUI.modal.type === 'scheduleScene' ? workflowUI.modal.sceneId : null;
  const showChecklistDialog = workflowUI.modal.type === 'checklist';
  const showLineCoverageDialog = workflowUI.modal.type === 'lineCoverage';
  const showBulkShotDialog = workflowUI.modal.type === 'bulkShot';
  const bulkShotTemplate: BulkShotTemplate = workflowUI.modal.type === 'bulkShot' ? workflowUI.modal.template : 'standard';

  // ---- Data state (stays as useState — not UI routing) ----
  const [shootingDays, setShootingDays] = useState<ShootingDay[]>([]);
  const [sceneChecklists, setSceneChecklists] = useState<Record<string, SceneChecklist>>({});

  // 5. Timeline ↔ Live Set Connection
  const [liveSetStatus, setLiveSetStatus] = useState<LiveSetStatus | null>(null);
  const [isLiveSetConnected, setIsLiveSetConnected] = useState(false);
  
  // 6. Shot Line Coverage Tracking (data, not UI)
  const [shotLineCoverage, setShotLineCoverage] = useState<Record<string, { startLine: number; endLine: number; dialogueIds: string[] }>>({});
  
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

  // Search query filtering is now integrated into getSortedAndFilteredScenes
  
  // Shot metadata tracking — typed per-shot data (source of truth)
  const [shotMetadata, setShotMetadata] = useState<ShotMetadataMap>({});;
  
  // Right panel state
  const [shotSelectorOpen, setShotSelectorOpen] = useState(false);
  const [shotSelectorAnchor, setShotSelectorAnchor] = useState<HTMLElement | null>(null);
  
  // ============================================
  // REFERENCE SEARCH UI — single reducer (replaces ~9 useState)
  // ============================================
  const [searchUI, dispatchSearch] = useReducer(searchReducer, INITIAL_SEARCH_STATE);

  // Auto-trigger search when reference panel opens
  useEffect(() => {
    if (searchUI.open && selectedScene) {
      const initialQuery = `${selectedScene.locationName || 'scene'} ${selectedScene.timeOfDay?.toLowerCase() || 'day'} cinematic`;
      dispatchSearch({ type: 'SET_QUERY', query: initialQuery });
      searchReferenceImages(initialQuery);
    }
  }, [searchUI.open, selectedScene]);

  // ---- Derived convenience aliases (backward-compatible reads) ----
  const referenceSearchOpen = searchUI.open;
  const referenceSearchQuery = searchUI.query;
  const referenceSearchResults = searchUI.imageResults;
  const referenceSearchLoading = searchUI.loading;
  const uploadedReferences = searchUI.uploadedRefs;
  const searchSource = searchUI.source;
  const shotCafeResults = searchUI.filmResults;
  const selectedFilm = searchUI.selectedFilm;
  const centerPanelReference = searchUI.centerReference;
  
  // ============================================
  // INSPECTOR/EDITING UI — single reducer (replaces 4 useState)
  // ============================================
  const inspectorInit = useMemo((): typeof INITIAL_INSPECTOR_STATE => ({
    ...INITIAL_INSPECTOR_STATE,
    expandedSections: loadExpandedSections(projectId),
  }), [projectId]);

  const [inspectorUI, dispatchInspector] = useReducer(inspectorReducer, inspectorInit);

  // Persist expanded sections preference on change
  useEffect(() => {
    saveExpandedSections(inspectorUI.expandedSections, projectId);
  }, [inspectorUI.expandedSections, projectId]);

  useEffect(() => {
    setManuscriptZoom(loadZoomPreference(projectId));
    setIsManuscriptFullscreen(loadFullscreenPreference(projectId));
    dispatchInspector({ type: 'LOAD_SECTIONS', sections: loadExpandedSections(projectId) });
  }, [projectId]);

  // ---- Derived convenience aliases ----
  const shotProperties = inspectorUI.properties;
  const expandedSections = inspectorUI.expandedSections;
  const editingField: string | null = inspectorUI.editing?.field ?? null;
  const editValue: string = inspectorUI.editing?.draft ?? '';
  
  const manuscriptRef = useRef<HTMLDivElement>(null);
  const sceneRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get shots for a scene — memoized to avoid stale closure bugs
  const getShotsForScene = useCallback((sceneId: string): CastingShot[] => {
    const shotList = shotLists.find(sl => sl.sceneId === sceneId);
    return shotList?.shots || [];
  }, [shotLists]);

  // Get selected scene shots with metadata
  const selectedSceneShots = useMemo(() => {
    if (!selectedScene) return [];
    return getShotsForScene(selectedScene.id);
  }, [selectedScene, getShotsForScene]);
  const [projectStoryboardLibraryItems, setProjectStoryboardLibraryItems] = useState<
    Awaited<ReturnType<typeof loadStoryboardLibraryItemsForProject>>
  >([]);
  useEffect(() => {
    let cancelled = false;
    const loadLibraryItems = () => {
      void loadStoryboardLibraryItemsForProject(projectId, String(projectId || 'global')).then((items) => {
        if (!cancelled) {
          setProjectStoryboardLibraryItems(items);
        }
      });
    };
    loadLibraryItems();
    window.addEventListener('role-room:storyboard-library-updated', loadLibraryItems);
    return () => {
      cancelled = true;
      window.removeEventListener('role-room:storyboard-library-updated', loadLibraryItems);
    };
  }, [projectId]);
  const selectedSceneStoryboardCandidates = useMemo(
    () => (selectedScene ? buildSceneStoryboardCandidates(selectedScene, projectStoryboardLibraryItems) : []),
    [projectStoryboardLibraryItems, selectedScene],
  );
  const selectedShotStoryboardLink = useMemo(
    () => (selectedShot && selectedScene
      ? resolveStoryboardShotLink(selectedShot, selectedScene, projectStoryboardLibraryItems)
      : null),
    [projectStoryboardLibraryItems, selectedScene, selectedShot],
  );
  const selectedSceneStoryboardCoverage = useMemo(
    () => (selectedScene ? computeStoryboardCoverageSummary(selectedSceneShots, selectedScene) : null),
    [selectedScene, selectedSceneShots],
  );
  const selectedSceneStoryboardFirstLinkedFrameIndex = useMemo(() => {
    if (!selectedScene) {
      return undefined;
    }
    const sceneFrames = Array.isArray(selectedScene.storyboardFrames) ? selectedScene.storyboardFrames : [];
    const linkedFrameId = selectedSceneShots.find((shot) => (
      typeof shot.storyboardFrameId === 'string'
      && sceneFrames.some((frame) => frame.id === shot.storyboardFrameId)
    ))?.storyboardFrameId;
    if (!linkedFrameId) {
      return undefined;
    }
    const frameIndex = sceneFrames.findIndex((frame) => frame.id === linkedFrameId);
    return frameIndex >= 0 ? frameIndex : undefined;
  }, [selectedScene, selectedSceneShots]);
  const selectedSceneStoryboardFirstMissingFrameIndex = useMemo(() => {
    if (!selectedScene || !selectedSceneStoryboardCoverage?.missingFrameIds.length) {
      return undefined;
    }
    const sceneFrames = Array.isArray(selectedScene.storyboardFrames) ? selectedScene.storyboardFrames : [];
    const frameIndex = sceneFrames.findIndex((frame) => frame.id === selectedSceneStoryboardCoverage.missingFrameIds[0]);
    return frameIndex >= 0 ? frameIndex : undefined;
  }, [selectedScene, selectedSceneStoryboardCoverage]);

  // ============================================
  // REFERENCE SEARCH — race-safe, backend-proxied
  // ============================================

  /** Monotonic counter to detect stale search results */
  const searchQueryIdRef = useRef(0);

  /** Max uploaded references to prevent memory bloat */
  const MAX_UPLOADED_REFS = 20;

  // Search shot.cafe for film references (via backend proxy)
  const searchShotCafe = useCallback(async (query: string): Promise<ShotCafeFilm[]> => {
    try {
      const response = await fetch(
        `/api/shotcafe/search?z=nav&q=${encodeURIComponent(query)}`
      );
      if (!response.ok) throw new Error('shot.cafe search failed');
      const data = await response.json();
      return Array.isArray(data) ? data.map((film: any) => ({
        id: `shotcafe-${film.project || film.pslug}`,
        title: film.title,
        year: film.year,
        slug: film.pslug || film.slug,
        imageCount: film.icount || 0,
        thumbnail: `/api/shotcafe/image-proxy?url=${encodeURIComponent(`https://shot.cafe/images/t/${film.slug}`)}`,
        url: `https://shot.cafe/movie/${film.pslug}`,
        cinematographer: film.dp,
      })) : [];
    } catch (error) {
      console.error('shot.cafe search error:', error);
      return [];
    }
  }, []);

  // Search by cinematographer on shot.cafe (via backend proxy)
  const searchByCinematographer = useCallback(async (name: string) => {
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
  }, []);

  // Load film frames from shot.cafe (via backend proxy)
  const loadFilmFrames = useCallback(async (slug: string, title: string) => {
    try {
      const response = await fetch(`/api/shotcafe/movie/${slug}`);
      if (response.ok) {
        const data = await response.json();
        const frames = data.frames ? data.frames.map((frame: any) => ({
          id: frame.id,
          url: frame.proxyUrl || frame.url,
          thumbnailUrl: frame.proxyUrl || frame.thumbnailUrl,
        })) : [];
        
        dispatchSearch({ type: 'SELECT_FILM', film: {
          title,
          slug,
          frames: frames.length > 0 ? frames : Array.from({ length: 12 }, (_, i) => ({
            id: `frame-${slug}-${i + 1}`,
            url: `/api/shotcafe/image-proxy?url=${encodeURIComponent(`https://shot.cafe/images/${slug}/${i + 1}.jpg`)}`,
            thumbnailUrl: `/api/shotcafe/image-proxy?url=${encodeURIComponent(`https://shot.cafe/images/${slug}/${i + 1}.jpg`)}`,
          })),
        }});
      } else {
        const frameUrls = Array.from({ length: 12 }, (_, i) => ({
          id: `frame-${slug}-${i + 1}`,
          url: `/api/shotcafe/image-proxy?url=${encodeURIComponent(`https://shot.cafe/images/${slug}/${i + 1}.jpg`)}`,
          thumbnailUrl: `/api/shotcafe/image-proxy?url=${encodeURIComponent(`https://shot.cafe/images/${slug}/${i + 1}.jpg`)}`,
        }));
        dispatchSearch({ type: 'SELECT_FILM', film: { title, slug, frames: frameUrls }});
      }
    } catch (error) {
      console.error('Failed to load film frames:', error);
    }
  }, []);

  // Search Unsplash/picsum via backend proxy (no API key in frontend)
  const searchImages = useCallback(async (query: string): Promise<ReferenceImageResult[]> => {
    try {
      const response = await fetch(
        `/api/unsplash/search?q=${encodeURIComponent(query)}&per_page=12`
      );
      if (!response.ok) throw new Error('Image search failed');
      const data = await response.json();
      return Array.isArray(data.results) ? data.results : [];
    } catch (error) {
      console.error('Image search error:', error);
      // Last-resort client-side placeholders
      return Array.from({ length: 6 }, (_, i) => ({
        id: `picsum-${i}`,
        url: `https://picsum.photos/seed/${encodeURIComponent(query)}${i}/400/225`,
        thumbnailUrl: `https://picsum.photos/seed/${encodeURIComponent(query)}${i}/150/100`,
        source: 'picsum' as const,
        attribution: 'Placeholder Image',
      }));
    }
  }, []);

  // Race-safe combined search — stale results are discarded
  const searchSourceRef = useRef(searchSource);
  searchSourceRef.current = searchSource;

  const searchReferenceImages = useCallback(async (query: string) => {
    const q = query.trim();
    if (!q) return;

    const queryId = ++searchQueryIdRef.current;
    dispatchSearch({ type: 'SEARCH_START' });

    const src = searchSourceRef.current;

    const filmPromise = (src === 'all' || src === 'shotcafe')
      ? searchShotCafe(q).catch(() => [] as ShotCafeFilm[])
      : Promise.resolve([] as ShotCafeFilm[]);

    const imgPromise = (src === 'all' || src === 'unsplash')
      ? searchImages(q).catch(() => [] as ReferenceImageResult[])
      : Promise.resolve([] as ReferenceImageResult[]);

    const [filmResults, imageResults] = await Promise.all([filmPromise, imgPromise]);

    // Stale guard: discard if a newer search was started
    if (queryId !== searchQueryIdRef.current) return;

    dispatchSearch({ type: 'SEARCH_DONE', imageResults, filmResults });
  }, [searchShotCafe, searchImages]);

  // Handle file upload for references (ObjectURL + size/type/dedupe guard)
  const objectUrlsRef = useRef<string[]>([]);

  // Revoke blob URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  const handleReferenceUpload = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

    Array.from(files).forEach(file => {
      // Validate type
      if (!ALLOWED_TYPES.includes(file.type)) {
        console.warn(`Skipped "${file.name}": unsupported type ${file.type}`);
        return;
      }
      // Validate size
      if (file.size > MAX_FILE_SIZE) {
        console.warn(`Skipped "${file.name}": exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`);
        return;
      }
      // Limit total uploads
      if (searchUI.uploadedRefs.length >= MAX_UPLOADED_REFS) {
        console.warn(`Upload limit (${MAX_UPLOADED_REFS}) reached`);
        return;
      }
      // Use ObjectURL instead of DataURL to avoid huge strings in state
      const url = URL.createObjectURL(file);
      objectUrlsRef.current.push(url);
      dispatchSearch({ type: 'ADD_UPLOADED_REF', url });
    });
  }, [searchUI.uploadedRefs.length]);

  // Load shot lists
  useEffect(() => {
    const loadShotLists = async () => {
      try {
        // initializeMockData is singleton-safe — multiple callers share one in-flight promise
        await castingService.initializeMockData();
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

        // Auto-select only if the user hasn't already selected a valid day
        const alreadySelected = days.some(d => d.id === workflowUI.selectedDayId);
        if (alreadySelected) return;

        // Pick best default: today > in-progress > planned > first
        const today = new Date().toISOString().split('T')[0];
        const todayDay = days.find(d => d.date === today);
        const inProgressDay = days.find(d => d.status === 'in-progress');
        const plannedDay = days.find(d => d.status === 'planned');
        const pick = todayDay || inProgressDay || plannedDay || days[0];
        if (pick) {
          dispatchWorkflow({ type: 'SELECT_DAY', dayId: pick.id });
        }
      } catch (error) {
        console.error('Error loading shooting days:', error);
      }
    };
    if (projectId) loadShootingDays();
  }, [projectId]);

  // ============================================
  // WORKFLOW GAP FIX #5: Sync Timeline with Live Set Status
  // Non-overlapping polling loop — uses refs to avoid dep-churn restarts
  // ============================================
  const scenesRef = useRef(scenes);
  scenesRef.current = scenes;
  const selectedSceneRef = useRef(selectedScene);
  selectedSceneRef.current = selectedScene;
  const followLiveScene = workflowUI.followLiveScene;

  useEffect(() => {
    if (!isLiveSetConnected || !projectId) return;
    let cancelled = false;

    const loop = async () => {
      while (!cancelled) {
        try {
          const status = await productionWorkflowService.getLiveSetStatus(projectId);
          if (cancelled) break;
          setLiveSetStatus(status);

          // Only auto-follow when the user has opted in
          if (followLiveScene && status.currentScene) {
            const cs = scenesRef.current.find(s => s.id === status.currentScene);
            if (cs && cs.id !== selectedSceneRef.current?.id) {
              setSelectedScene(cs);
            }
          }
        } catch (error) {
          console.error('Error syncing live set status:', error);
        }
        // Wait before next poll — non-overlapping (next request starts after previous completes)
        await new Promise(r => setTimeout(r, 5000));
      }
    };

    loop();
    return () => { cancelled = true; };
  }, [isLiveSetConnected, projectId, followLiveScene]);

  // ============================================
  // WORKFLOW GAP FIX #4: Initialize scene checklists — add + prune
  // ============================================
  useEffect(() => {
    setSceneChecklists(prev => {
      const sceneIds = new Set(scenes.map(s => s.id));
      let changed = false;
      const next = { ...prev };

      // Add defaults for new scenes
      for (const scene of scenes) {
        if (!next[scene.id]) {
          next[scene.id] = { ...EMPTY_CHECKLIST };
          changed = true;
        }
      }
      // Prune deleted scenes
      for (const id of Object.keys(next)) {
        if (!sceneIds.has(id)) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [scenes]);

  // Sync sceneTags with scenes (add new, remove deleted)
  useEffect(() => {
    setSceneTags(prev => {
      const sceneIds = new Set(scenes.map(s => s.id));
      let changed = false;
      const next = { ...prev };
      // Add missing scene keys
      for (const s of scenes) {
        if (!next[s.id]) {
          next[s.id] = [];
          changed = true;
        }
      }
      // Remove keys for deleted scenes
      for (const id of Object.keys(next)) {
        if (!sceneIds.has(id)) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [scenes]);

  // Sync sceneNeeds with scenes (add defaults for new, remove deleted)
  useEffect(() => {
    setSceneNeeds(prev => {
      const sceneIds = new Set(scenes.map(s => s.id));
      let changed = false;
      const next = { ...prev };
      for (const s of scenes) {
        if (!next[s.id]) {
          next[s.id] = { cam: false, light: false, sound: false };
          changed = true;
        }
      }
      for (const id of Object.keys(next)) {
        if (!sceneIds.has(id)) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [scenes]);

  // Reset undo/redo history when scenes prop changes externally
  useEffect(() => {
    resetHistory();
  }, [scenes.length, resetHistory]);

  // Load equipment-related data (candidates, roles) from project
  useEffect(() => {
    const loadProjectData = async () => {
      try {
        // initializeMockData is singleton-safe — multiple callers share one in-flight promise
        await castingService.initializeMockData();
        const project = await castingService.getProject(projectId);
        
        // Load candidates and roles for talent panel
        if (project) {
          const confirmedCandidates = (project.candidates || []).filter(
            (c: Candidate) => c.status === 'confirmed' || c.status === 'selected'
          );
          setSceneCandidates(confirmedCandidates);
          setProjectRoles(project.roles || []);
        }
      } catch (error) {
        console.error('Error loading project data:', error);
      }
    };
    if (projectId) loadProjectData();
  }, [projectId]);

  // Helper to validate camera value — memoized, case-insensitive, deduped
  const getValidCameraValue = useCallback((camera: string): string => {
    const inventoryCameras = getEquipmentByCategory('camera').map(c => c.name);
    // Case-insensitive lookup: check inventory first, then standard list
    const cameraLower = camera.toLowerCase();
    const inventoryMatch = inventoryCameras.find(c => c.toLowerCase() === cameraLower);
    if (inventoryMatch) return inventoryMatch;
    // Check standard list
    if (AVAILABLE_CAMERAS_LOWER.has(cameraLower)) {
      return AVAILABLE_CAMERAS.find(c => c.toLowerCase() === cameraLower) ?? AVAILABLE_CAMERAS[0];
    }
    // Fallback: prefer inventory camera if available, otherwise first standard
    return inventoryCameras[0] ?? AVAILABLE_CAMERAS[0];
  }, [getEquipmentByCategory]);
  
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

  // Get scene status — derived from shot data, with manual override support
  const getSceneStatus = useCallback((scene: SceneBreakdown): DerivedSceneStatus => {
    // Manual override takes priority
    if (sceneStatusOverrides[scene.id]) return sceneStatusOverrides[scene.id];
    // Derive from shot completion
    const shots = getShotsForScene(scene.id);
    const completedCount = shots.filter(s => s.cameraMovement && s.focalLength).length;
    return deriveSceneStatus(shots.length, completedCount);
  }, [sceneStatusOverrides, getShotsForScene]);

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
  const scrollToScene = useCallback((scene: SceneBreakdown) => {
    setSelectedScene(scene);
    const shots = getShotsForScene(scene.id);
    if (shots.length > 0) setSelectedShot(shots[0]);
    else setSelectedShot(null);
    // Scroll to scene DOM element if ref exists
    const sceneEl = sceneRefs.current.get(scene.id);
    if (sceneEl) {
      sceneEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [getShotsForScene]);

  // Get scene metadata
  const getSceneMetadata = (scene: SceneBreakdown) => {
    const shots = getShotsForScene(scene.id);
    return {
      camera: toDisplayString(shots[0]?.camera?.resolution, toDisplayString(shots[0]?.cameraAngle, 'Camera')),
      cameraMovement: shots[0]?.cameraMovement || '',
      lighting: shots[0]?.lightingSetup || 'Mykt sidelys, varm tone',
      audio: 'Dempet romlyd',
      lens: shots[0]?.focalLength || '50mm Prime',
      shotType: shots[0]?.shotType || '',
    };
  };

  // ============================================
  // PRECOMPUTED allDialogue — scene-ordered, O(n) once via useMemo
  // All read-through handlers reference this instead of recomputing.
  // ============================================
  const allDialogue = useMemo(() => {
    // Build a scene-id → lines map for O(1) lookup per scene
    const byScene = new Map<string, typeof dialogueLines>();
    for (const d of dialogueLines) {
      if (!d.sceneId) continue;
      const arr = byScene.get(d.sceneId) ?? [];
      arr.push(d);
      byScene.set(d.sceneId, arr);
    }
    return scenes.flatMap(s => byScene.get(s.id) ?? []);
  }, [scenes, dialogueLines]);

  // Sync right panel with selected scene
  useEffect(() => {
    // Auto-advance to next line during read-through if playing
    if (readThroughMode && readThroughPlaying) {
      if (ttsEnabled) {
        // TTS-driven advancement: speak the current line, then advance
        ttsPlayingRef.current = true;
        const currentLine = allDialogue[readThroughCurrentLine];
        if (currentLine) {
          const characterVoice = ttsUseCharacterVoices
            ? (ttsCharacterVoices[currentLine.characterName] ?? ttsVoice)
            : ttsVoice;
          ttsSpeak(currentLine.dialogueText, {
            voice: characterVoice,
            language: ttsLanguage || undefined,
            speed: ttsSpeed,
            model: 'tts-1',
          })
            .then(() => {
              if (ttsPlayingRef.current && readThroughCurrentLine < allDialogue.length - 1) {
                setReadThroughCurrentLine(prev => prev + 1);
              } else {
                setReadThroughPlaying(false);
                ttsPlayingRef.current = false;
              }
            })
            .catch((err) => {
              console.warn('TTS playback error, falling back to timer:', err);
              // Fallback to timer-based advance
              setTimeout(() => {
                if (ttsPlayingRef.current) {
                  handleReadThroughNext();
                }
              }, 3000);
            });
        }
        return () => {
          ttsPlayingRef.current = false;
          stopTTS();
        };
      } else {
        // Timer-based advancement (no TTS)
        const timer = setTimeout(() => {
          handleReadThroughNext();
        }, 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [readThroughMode, readThroughPlaying, readThroughCurrentLine, allDialogue, ttsEnabled, ttsVoice, ttsLanguage, ttsSpeed, ttsUseCharacterVoices, ttsCharacterVoices]);

  // Auto-scroll to current dialogue line in read-through
  useEffect(() => {
    if (readThroughMode && manuscriptRef.current) {
      const currentLine = allDialogue[readThroughCurrentLine];
      
      if (currentLine?.sceneId) {
        const selectedSceneDialog = getSceneDialogue(currentLine.sceneId);
        const localIndex = selectedSceneDialog.findIndex(d => d.id === currentLine.id);
        if (localIndex >= 0) {
          setSelectedScene(scenes.find(s => s.id === currentLine.sceneId) || null);
        }
      }
    }
  }, [readThroughCurrentLine, readThroughMode, allDialogue]);

  // Update shot properties when scene changes (read-only sync, no save)
  useEffect(() => {
    if (selectedScene) {
      const metadata = getSceneMetadata(selectedScene);
      // Scene-level defaults: only apply when NO shot is selected
      if (!selectedShot) {
        dispatchInspector({ type: 'SELECT_SHOT', shotId: null, properties: {
          ...DEFAULT_SHOT_PROPERTIES,
          keyLight: metadata.lighting.split(',')[0]?.trim() || DEFAULT_SHOT_PROPERTIES.keyLight,
          sideLight: metadata.lighting.split(',')[1]?.trim() || DEFAULT_SHOT_PROPERTIES.sideLight,
          atmos: metadata.audio || DEFAULT_SHOT_PROPERTIES.atmos,
          lens: metadata.lens ? String(metadata.lens) : DEFAULT_SHOT_PROPERTIES.lens,
          shotType: metadata.shotType || DEFAULT_SHOT_PROPERTIES.shotType,
        }});
      }
    }
  }, [selectedScene?.id]); // Only run when scene ID changes

  // ============================================
  // SHOT DRAFT — populate inspector from metadata when shot changes
  // Uses narrow deps: selectedShotId + individual metadata entry
  // ============================================
  const selectedShotId = selectedShot?.id ?? null;
  const selectedShotMeta = selectedShotId ? shotMetadata[selectedShotId] : undefined;

  useEffect(() => {
    if (!selectedShotId) return;
    // Always populate draft from metadata (with safe defaults for missing fields)
    const props = selectedShotMeta
      ? metaToShotProperties(selectedShotMeta)
      : DEFAULT_SHOT_PROPERTIES;
    dispatchInspector({ type: 'SELECT_SHOT', shotId: selectedShotId, properties: props });
  }, [selectedShotId, selectedShotMeta]);

  // ============================================
  // SEED METADATA — per-shot (not per-scene), no initializedScenesRef
  // Seeds only shots that have no metadata yet; works for new shots added later
  // ============================================
  useEffect(() => {
    if (!selectedScene?.id) return;
    const shots = getShotsForScene(selectedScene.id);
    if (!shots?.length) return;

    setShotMetadata(prev => {
      const next = { ...prev };
      let changed = false;
      for (let i = 0; i < shots.length; i++) {
        const shot = shots[i];
        if (next[shot.id]) continue; // already has metadata
        next[shot.id] = buildDefaultShotMeta(i);
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [selectedScene?.id, getShotsForScene]);

  // ============================================
  // WRITE DRAFT BACK — flush inspector edits to shotMetadata
  // Runs when dirty flag is set and shot changes or explicitly saved
  // ============================================
  const prevShotIdRef = useRef<string | null>(null);

  useEffect(() => {
    // When changing shots, save the previous shot's draft back to metadata
    const prevId = prevShotIdRef.current;
    prevShotIdRef.current = selectedShotId;

    if (prevId && prevId !== selectedShotId && inspectorUI.dirty) {
      const prevMeta = shotMetadata[prevId];
      if (prevMeta) {
        setShotMetadata(prev => ({
          ...prev,
          [prevId]: shotPropertiesToMeta(shotProperties, prevMeta),
        }));
      }
    }
  }, [selectedShotId]);


  // ============================================
  // Dirty-state autosave — useDebouncedCallback pattern
  // No extra state churn, flush on unmount for data safety
  // ============================================
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const lastSavedPropsRef = useRef<string>('');
  const isInitialMountRef = useRef(true);

  // Shot properties autosave (debounced callback, not debounced value)
  // Also writes draft back to shotMetadata so data stays consistent
  const { debounced: debouncedSaveShotProps, flush: flushShotProps } = useDebouncedCallback(
    (props: typeof shotProperties) => {
      if (!selectedScene || !onSceneUpdate) return;
      const hash = JSON.stringify(props);
      if (hash === lastSavedPropsRef.current) return;
      lastSavedPropsRef.current = hash;
      setAutosaveStatus('saving');

      // Write draft back to per-shot metadata if a shot is selected
      const activeId = inspectorUI.activeShotId;
      if (activeId) {
        setShotMetadata(prev => {
          const existing = prev[activeId];
          if (!existing) return prev;
          return { ...prev, [activeId]: shotPropertiesToMeta(props, existing) };
        });
      }

      const updatedScene: SceneBreakdown = {
        ...selectedScene,
        metadata: {
          ...selectedScene.metadata,
          camera: props.camera,
          lens: props.lens,
          rig: props.rig,
          shotType: props.shotType,
          keyLight: props.keyLight,
          sideLight: props.sideLight,
          gel: props.gel,
          mic: props.mic,
          atmos: props.atmos,
          references: uploadedReferences,
        },
      };
      onSceneUpdate(updatedScene);
      setAutosaveStatus('saved');
      setTimeout(() => setAutosaveStatus('idle'), 1500);
    },
    1500
  );

  // Trigger debounced save whenever shotProperties change
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      lastSavedPropsRef.current = JSON.stringify(shotProperties);
      return;
    }
    debouncedSaveShotProps(shotProperties);
  }, [shotProperties, debouncedSaveShotProps]);

  // Scene needs autosave (debounced callback)
  const { debounced: debouncedSaveNeeds, flush: flushSceneNeeds } = useDebouncedCallback(
    async (needs: typeof sceneNeeds) => {
      if (Object.keys(needs).length === 0) return;
      try {
        await sceneNeedsService.saveSceneNeeds(projectId, needs);
      } catch (e) {
        console.error('Could not save scene needs:', e);
      }
    },
    1500
  );

  // Trigger debounced save whenever sceneNeeds change
  useEffect(() => {
    debouncedSaveNeeds(sceneNeeds);
  }, [sceneNeeds, debouncedSaveNeeds]);

  // Flush pending saves on unmount — data safety
  useEffect(() => {
    return () => {
      flushShotProps();
      flushSceneNeeds();
    };
  }, [flushShotProps, flushSceneNeeds]);
  
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

  // Manuscript zoom handlers — function declarations avoid TDZ issues during HMR
  function handleManuscriptZoomIn() {
    setManuscriptZoom(prev => {
      const v = Math.min(prev + 0.25, 2);
      saveZoomPreference(v, projectId);
      return v;
    });
  }

  function handleManuscriptZoomOut() {
    setManuscriptZoom(prev => {
      const v = Math.max(prev - 0.25, 0.5);
      saveZoomPreference(v, projectId);
      return v;
    });
  }

  function handleManuscriptZoomReset() {
    setManuscriptZoom(1);
    saveZoomPreference(1, projectId);
  }

  function handleManuscriptFullscreen() {
    setIsManuscriptFullscreen(prev => {
      const v = !prev;
      saveFullscreenPreference(v, projectId);
      return v;
    });
  }

  // Keyboard shortcuts: Escape, Ctrl/Cmd +/-, Ctrl/Cmd 0, F
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when typing in input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'Escape' && isManuscriptFullscreen) {
        setIsManuscriptFullscreen(false);
        saveFullscreenPreference(false, projectId);
        return;
      }
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        handleManuscriptZoomIn();
      } else if (isMod && e.key === '-') {
        e.preventDefault();
        handleManuscriptZoomOut();
      } else if (isMod && e.key === '0') {
        e.preventDefault();
        handleManuscriptZoomReset();
      } else if (e.key === 'f' && !isMod && !e.altKey) {
        handleManuscriptFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isManuscriptFullscreen, projectId]);

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
      shots.forEach((shot) => {
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
  const productionMentionCandidates = useMemo(() => {
    const deduped = new Set<string>();
    for (const role of projectRoles) {
      if (typeof role.name === 'string' && role.name.trim().length > 0) {
        deduped.add(role.name.trim());
      }
    }
    for (const candidate of sceneCandidates) {
      if (typeof candidate.name === 'string' && candidate.name.trim().length > 0) {
        deduped.add(candidate.name.trim());
      }
    }
    for (const character of selectedScene?.characters ?? []) {
      if (typeof character === 'string' && character.trim().length > 0) {
        deduped.add(character.trim());
      }
    }
    return Array.from(deduped).sort((left, right) => left.localeCompare(right, 'no-NO'));
  }, [projectRoles, sceneCandidates, selectedScene?.characters]);

  // Scene creation handler
  const handleCreateScene = () => {
    // Compute next scene number: max existing + 1 (handles gaps from deletion)
    const nextSceneNumber = String(
      Math.max(0, ...scenes.map(s => toSceneNumber(s.sceneNumber) ?? 0).filter(Number.isFinite)) + 1
    );
    const validationError = validateSceneNumber(nextSceneNumber);
    if (validationError) {
      console.warn('[Scene] Validation warning:', validationError);
    }
    const sceneId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? `scene-${crypto.randomUUID()}`
      : `scene-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newScene: SceneBreakdown = {
      id: sceneId,
      manuscriptId: manuscript.id,
      projectId,
      sceneNumber: nextSceneNumber,
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
      // Push undo patch before creating
      pushPatch({ type: 'createScene', scene: newScene, index: scenes.length });
      onSceneCreate(newScene);
      setSelectedScene(newScene);
    }
    setShowNewSceneDialog(false);
  };

  // Scene deletion handler
  const handleDeleteScene = () => {
    if (!sceneToDelete) return;
    
    if (onSceneDelete) {
      const idx = scenes.findIndex(s => s.id === sceneToDelete);
      const deletedScene = idx >= 0 ? scenes[idx] : null;

      // Push undo patch before deleting
      if (deletedScene) {
        pushPatch({ type: 'deleteScene', scene: deletedScene, index: idx });
      }

      onSceneDelete(sceneToDelete);
      
      // Select nearest remaining scene (prefer next, then previous)
      if (idx >= 0) {
        const nextScene = scenes[idx + 1] || scenes[idx - 1] || null;
        setSelectedScene(nextScene);
      }
    }
    
    setShowDeleteConfirm(false);
    setSceneToDelete(null);
  };

  // Handle scene reordering via drag-and-drop
  // Does NOT renumber scenes — sceneNumber is a label, not a position.
  // Use an explicit "Renumber scenes" action if sequential numbers are needed.
  const handleSceneReorder = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id || !onScenesReorder) return;
    
    const oldIndex = scenes.findIndex(s => s.id === active.id);
    const newIndex = scenes.findIndex(s => s.id === over.id);
    
    if (oldIndex === -1 || newIndex === -1) return;
    
    const reorderedScenes = arrayMove(scenes, oldIndex, newIndex);
    
    // Push reorder patch before applying (preserves undo)
    pushPatch({
      type: 'reorderScenes',
      beforeOrder: scenes.map(s => s.id),
      afterOrder: reorderedScenes.map(s => s.id),
    });
    onScenesReorder(reorderedScenes);
  };

  // Handle export production data
  const handleExportProduction = () => {
    const totalShots = shotLists.reduce((acc, list) => acc + list.shots.length, 0);
    const productionData = {
      exportVersion: 1,
      exportedAt: new Date().toISOString(),
      manuscript: {
        title: manuscript.title,
        author: manuscript.author,
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
      totalShots,
    };
    
    const dataStr = JSON.stringify(productionData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${manuscript.title.replace(/\s+/g, '_')}_production_data.json`;
    link.click();
    // Delay revoking to ensure download completes in all browsers
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setShowExportDialog(false);
  };

  // Read Through handlers (with OpenAI Whisper TTS integration)
  const handleReadThroughToggle = () => {
    if (readThroughMode) {
      // Exiting read-through — stop TTS and clean up
      stopTTS();
      ttsPlayingRef.current = false;
      clearTTSCache();
    } else {
      // Entering read-through — assign character voices
      // Compute mapping locally to avoid stale state race (setState is async)
      const characters = [...new Set(dialogueLines.map(d => d.characterName))];
      const voices =
        Object.keys(ttsCharacterVoices).length > 0
          ? ttsCharacterVoices
          : assignCharacterVoices(characters);

      if (Object.keys(ttsCharacterVoices).length === 0) {
        setTtsCharacterVoices(voices);
      }

      // Preload first few lines for instant playback — use local `voices`
      const firstLines = dialogueLines.slice(0, 5);
      if (ttsEnabled && firstLines.length > 0) {
        preloadTTS(
          firstLines.map(l => ({
            text: l.dialogueText,
            voice: voices[l.characterName] ?? ttsVoice,
          })),
        ).catch(() => {});
      }
    }
    setReadThroughMode(!readThroughMode);
    setReadThroughPlaying(false);
    setReadThroughCurrentLine(0);
    setReadThroughStartTime(null);
  };

  const handleReadThroughPlay = () => {
    if (readThroughPlaying) {
      // Pausing
      if (ttsEnabled) {
        pauseTTS();
      }
      ttsPlayingRef.current = false;
    } else {
      // Starting/resuming — use resumeTTS if TTS was paused mid-utterance
      if (ttsEnabled && isTTSPlaying()) {
        resumeTTS();
      }
      setReadThroughStartTime(prev => prev ?? Date.now());
      ttsPlayingRef.current = true;
    }
    setReadThroughPlaying(!readThroughPlaying);
  };

  const handleReadThroughNext = useCallback(() => {
    stopTTS();
    ttsPlayingRef.current = false;
    setReadThroughCurrentLine(i => Math.min(i + 1, allDialogue.length - 1));
  }, [allDialogue.length]);

  const handleReadThroughPrevious = useCallback(() => {
    stopTTS();
    ttsPlayingRef.current = false;
    setReadThroughCurrentLine(i => Math.max(i - 1, 0));
  }, []);

  // ============================================
  // PERF: GPU-accelerated playhead — DOM-direct via ref
  // ============================================
  const updatePlayheadDOM = useCallback((timeSec: number) => {
    const el = playheadRef.current;
    const container = timelineRef.current;
    if (!el || !container) return;
    const duration = Math.max(timelineData.totalDuration, 0.001);
    const pct = Math.max(0, Math.min(1, timeSec / duration));
    const x = pct * container.clientWidth;
    el.style.transform = `translate3d(${x}px, 0, 0)`;
  }, [timelineData.totalDuration]);

  // Timeline handlers
  const handleTimelinePlay = useCallback(() => {
    setTimelineIsPlaying(p => !p);
  }, []);

  const handleTimelineSeek = useCallback((event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    const nextTime = pct * timelineData.totalDuration;
    currentTimeRef.current = nextTime;
    updatePlayheadDOM(nextTime);
    setTimelineCurrentTime(nextTime);
  }, [timelineData.totalDuration, updatePlayheadDOM]);

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

  // Auto-play timeline — rAF loop, DOM-direct playhead, throttled state for UI text
  useEffect(() => {
    if (!timelineIsPlaying) return;

    const tick = (ts: number) => {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;

      const duration = Math.max(timelineData.totalDuration, 0.001);
      let nextTime = currentTimeRef.current + dt;

      if (nextTime >= duration) {
        nextTime = duration;
        currentTimeRef.current = nextTime;
        updatePlayheadDOM(nextTime);
        setTimelineCurrentTime(nextTime);
        setTimelineIsPlaying(false);
        return; // stop loop
      }

      currentTimeRef.current = nextTime;
      updatePlayheadDOM(nextTime);

      // Throttle React state updates to ~4x/sec for time display
      const quant = Math.round(nextTime * 4) / 4;
      setTimelineCurrentTime(prev => (prev === quant ? prev : quant));

      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
      lastTsRef.current = null;
    };
  }, [timelineIsPlaying, timelineData.totalDuration, updatePlayheadDOM]);

  // Live progress → playhead sync (only when NOT playing) — conflict-free
  useEffect(() => {
    if (timelineIsPlaying) return;
    if (!liveSetStatus?.todayProgress) return;
    const pct = liveSetStatus.todayProgress.completedSetups / Math.max(liveSetStatus.todayProgress.totalSetups, 1);
    const nextTime = pct * timelineData.totalDuration;
    currentTimeRef.current = nextTime;
    updatePlayheadDOM(nextTime);
    setTimelineCurrentTime(nextTime);
  }, [liveSetStatus?.todayProgress, timelineIsPlaying, timelineData.totalDuration, updatePlayheadDOM]);

  // Production notes — save handler for <ProductionNotesPanel>
  const handleSaveProductionNote = useCallback((sceneId: string, noteType: NoteType, value: string) => {
    setProductionNotes(prev => ({
      ...prev,
      [sceneId]: {
        ...prev[sceneId],
        [noteType]: value,
      },
    }));
  }, []);

  // Scene status handlers — sets manual override
  const handleSetSceneStatus = useCallback((sceneId: string, status: DerivedSceneStatus) => {
    setSceneStatusOverrides(prev => ({
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
    // Notify manuscript of status change
    if (onManuscriptUpdate) {
      onManuscriptUpdate({
        ...manuscript,
        updatedAt: new Date().toISOString(),
      });
    }
  }, [scenes, onSceneUpdate, onManuscriptUpdate, manuscript]);

  // Copy shot settings to next shot
  const handleCopySettingsToNextShot = () => {
    if (!selectedShot || !selectedScene) return;
    const sceneShots = getShotsForScene(selectedScene.id);
    const currentIdx = sceneShots.findIndex(s => s.id === selectedShot.id);
    if (currentIdx < 0 || currentIdx >= sceneShots.length - 1) return;

    const nextShot = sceneShots[currentIdx + 1];

    // Source = current shot's metadata. If dirty, flush draft first.
    // Never fall back to global shotProperties — always per-shot metadata.
    const currentMeta = shotMetadata[selectedShot.id];
    const base: _ShotMeta = inspectorUI.dirty && currentMeta
      ? shotPropertiesToMeta(shotProperties, currentMeta)
      : currentMeta ?? buildDefaultShotMeta();

    setShotMetadata(prev => ({
      ...prev,
      // Flush dirty draft for current shot
      ...(inspectorUI.dirty && currentMeta ? { [selectedShot.id]: base } : {}),
      // Copy camera/lighting/sound to next shot (preserve its other fields)
      [nextShot.id]: {
        ...(prev[nextShot.id] ?? buildDefaultShotMeta()),
        camera: { ...base.camera },
        lighting: { ...base.lighting },
        sound: { ...base.sound },
      },
    }));
    // Select the next shot (draft will populate from metadata via effect)
    setSelectedShot(nextShot);
  };

  // Save shot settings as preset — ShotPreset model (camera + lighting + sound)
  const [savedPresets, setSavedPresets] = useState<Record<string, ShotPreset>>({});
  const [showSavePresetDialog, setShowSavePresetDialog] = useState(false);
  const [presetName, setPresetName] = useState('');

  const handleSaveAsPreset = () => {
    if (!presetName.trim() || !selectedShot?.id) return;
    // Save from per-shot metadata (flush dirty draft first)
    const meta = shotMetadata[selectedShot.id];
    const source: _ShotMeta = inspectorUI.dirty && meta
      ? shotPropertiesToMeta(shotProperties, meta)
      : meta ?? buildDefaultShotMeta();
    setSavedPresets(prev => ({
      ...prev,
      [presetName]: {
        camera: { ...source.camera },
        lighting: { ...source.lighting },
        sound: { ...source.sound },
      },
    }));
    setShowSavePresetDialog(false);
    setPresetName('');
  };

  const handleLoadPreset = (name: string) => {
    if (!selectedShot?.id) return;
    const preset = savedPresets[name];
    if (!preset) return;
    // Apply preset directly to per-shot metadata
    setShotMetadata(prev => ({
      ...prev,
      [selectedShot.id]: {
        ...(prev[selectedShot.id] ?? buildDefaultShotMeta()),
        camera: { ...preset.camera },
        lighting: { ...preset.lighting },
        sound: { ...preset.sound },
      },
    }));
    // The SELECT_SHOT effect will refresh the inspector draft automatically
  };

  // Add new shot to scene - opens FSM dialog
  const handleAddNewShot = useCallback(() => {
    if (!selectedScene) return;
    addShotDispatch({ type: 'OPEN' });
  }, [selectedScene]);

  // Debounced persist queue for shot lists — avoids spamming backend
  const { debounced: debouncedPersistShotList } = useDebouncedCallback(
    (pid: string, sceneId: string, lists: ShotList[]) => {
      const list = lists.find(l => l.sceneId === sceneId);
      if (list) {
        castingService.saveShotList(pid, list).catch(err =>
          console.warn('Could not persist shot list:', err)
        );
      }
    },
    800
  );

  const persistShotListImmediate = useCallback(async (updatedShotList: ShotList) => {
    setShotLists((prev) => {
      const exists = prev.some((entry) => entry.id === updatedShotList.id);
      if (exists) {
        return prev.map((entry) => (entry.id === updatedShotList.id ? updatedShotList : entry));
      }
      return [...prev, updatedShotList];
    });
    await castingService.saveShotList(projectId, updatedShotList);
  }, [projectId]);

  const updateSelectedShotStoryboardState = useCallback(async (
    transform: (shot: CastingShot) => CastingShot,
  ): Promise<CastingShot | null> => {
    if (!selectedScene || !selectedShot) return null;
    const shotList = shotLists.find((entry) => entry.sceneId === selectedScene.id);
    if (!shotList) return null;

    const nextShot = transform(selectedShot);
    const nextShotList: ShotList = {
      ...shotList,
      shots: shotList.shots.map((entry) => (entry.id === selectedShot.id ? nextShot : entry)),
      updatedAt: new Date().toISOString(),
    };

    setSelectedShot(nextShot);
    await persistShotListImmediate(nextShotList);
    return nextShot;
  }, [persistShotListImmediate, selectedScene, selectedShot, shotLists]);

  const handleOpenSelectedShotStoryboardFrame = useCallback(() => {
    if (!selectedScene || !selectedShotStoryboardLink || selectedShotStoryboardLink.status !== 'linked') return;
    setSceneStoryboardDialog({
      sceneId: selectedScene.id,
      activeFrameIndex: selectedShotStoryboardLink.frameIndex ?? 0,
    });
  }, [selectedScene, selectedShotStoryboardLink]);

  const handleOpenSelectedSceneStoryboard = useCallback(() => {
    if (!selectedScene) return;
    setSceneStoryboardDialog({
      sceneId: selectedScene.id,
      activeFrameIndex: selectedShotStoryboardLink?.frameIndex ?? 0,
    });
  }, [selectedScene, selectedShotStoryboardLink]);

  const handleOpenSelectedSceneCoverageLinkedFrame = useCallback(() => {
    if (!selectedScene || selectedSceneStoryboardFirstLinkedFrameIndex === undefined) return;
    setSceneStoryboardDialog({
      sceneId: selectedScene.id,
      activeFrameIndex: selectedSceneStoryboardFirstLinkedFrameIndex,
    });
  }, [selectedScene, selectedSceneStoryboardFirstLinkedFrameIndex]);

  const handleOpenSelectedSceneCoverageMissingFrame = useCallback(() => {
    if (!selectedScene || selectedSceneStoryboardFirstMissingFrameIndex === undefined) return;
    setSceneStoryboardDialog({
      sceneId: selectedScene.id,
      activeFrameIndex: selectedSceneStoryboardFirstMissingFrameIndex,
    });
  }, [selectedScene, selectedSceneStoryboardFirstMissingFrameIndex]);

  const handleOpenSelectedShotStoryboardLinkDialog = useCallback(() => {
    if (!selectedShot || !selectedScene) return;
    const defaultCandidateId =
      selectedShotStoryboardLink?.candidate?.id
      || selectedSceneStoryboardCandidates[0]?.id
      || null;
    setShotStoryboardDialog({
      shotId: selectedShot.id,
      selectedCandidateId: defaultCandidateId,
    });
  }, [selectedScene, selectedSceneStoryboardCandidates, selectedShot, selectedShotStoryboardLink]);

  const handleConfirmSelectedShotStoryboardLink = useCallback(async () => {
    if (!selectedScene || !selectedShot || !shotStoryboardDialog?.selectedCandidateId) return;
    const candidate = selectedSceneStoryboardCandidates.find(
      (entry) => entry.id === shotStoryboardDialog.selectedCandidateId,
    );
    if (!candidate) return;

    await updateSelectedShotStoryboardState((shot) =>
      applyStoryboardCandidateToShot(shot, candidate, selectedScene.id),
    );
    setShotStoryboardDialog(null);
  }, [
    selectedScene,
    selectedSceneStoryboardCandidates,
    selectedShot,
    shotStoryboardDialog,
    updateSelectedShotStoryboardState,
  ]);

  const handleUnlinkSelectedShotStoryboard = useCallback(async () => {
    await updateSelectedShotStoryboardState((shot) => clearStoryboardLinkFromShot(shot));
  }, [updateSelectedShotStoryboardState]);

  const handleResyncSelectedShotStoryboard = useCallback(async () => {
    if (!selectedScene || !selectedShotStoryboardLink?.candidate) return;
    await updateSelectedShotStoryboardState((shot) =>
      applyStoryboardCandidateToShot(shot, selectedShotStoryboardLink.candidate!, selectedScene.id),
    );
  }, [selectedScene, selectedShotStoryboardLink, updateSelectedShotStoryboardState]);

  const handleCreateStoryboardFrameFromSelectedShot = useCallback(async () => {
    if (!selectedScene || !selectedShot) return;

    const newFrame = createSceneStoryboardFrameFromShot(selectedShot, selectedScene);
    const updatedScene: SceneBreakdown = {
      ...selectedScene,
      storyboardFrames: [...(Array.isArray(selectedScene.storyboardFrames) ? selectedScene.storyboardFrames : []), newFrame],
      updatedAt: new Date().toISOString(),
    };

    const persistedScene = await manuscriptService.saveScene(updatedScene);
    onSceneUpdate?.(persistedScene);
    setSelectedScene((current) => (current?.id === persistedScene.id ? persistedScene : current));

    const candidate = buildSceneStoryboardCandidates(persistedScene, projectStoryboardLibraryItems).find(
      (entry) => entry.sourceType === 'scene-frame' && entry.frameId === newFrame.id,
    );
    if (!candidate) return;

    await updateSelectedShotStoryboardState((shot) =>
      applyStoryboardCandidateToShot(shot, candidate, persistedScene.id),
    );
    setSceneStoryboardDialog({
      sceneId: persistedScene.id,
      activeFrameIndex: Math.max(
        0,
        (Array.isArray(persistedScene.storyboardFrames) ? persistedScene.storyboardFrames.length : 1) - 1,
      ),
    });
  }, [
    onSceneUpdate,
    projectStoryboardLibraryItems,
    selectedScene,
    selectedShot,
    updateSelectedShotStoryboardState,
  ]);

  const handleSceneStoryboardUpdate = useCallback(async (updatedScene: SceneBreakdown) => {
    const persistedScene = await manuscriptService.saveScene(updatedScene);
    onSceneUpdate?.(persistedScene);
    setSelectedScene((current) => (current?.id === persistedScene.id ? persistedScene : current));

    const nextShotLists: ShotList[] = [];
    const shotListsToPersist: ShotList[] = [];
    for (const shotList of shotLists) {
      if (shotList.sceneId !== persistedScene.id) {
        nextShotLists.push(shotList);
        continue;
      }
      const syncResult = syncShotListWithSceneStoryboard(
        shotList,
        persistedScene,
        projectStoryboardLibraryItems,
      );
      nextShotLists.push(syncResult.shotList);
      if (syncResult.changed) {
        shotListsToPersist.push(syncResult.shotList);
      }
    }

    if (shotListsToPersist.length > 0) {
      setShotLists(nextShotLists);
      await Promise.all(
        shotListsToPersist.map((shotList) => castingService.saveShotList(projectId, shotList)),
      );
      if (selectedShot) {
        const selectedSceneShotList = nextShotLists.find((entry) => entry.sceneId === persistedScene.id);
        const nextSelectedShot = selectedSceneShotList?.shots.find((entry) => entry.id === selectedShot.id) || null;
        if (nextSelectedShot) {
          setSelectedShot(nextSelectedShot);
        }
      }
    }
  }, [onSceneUpdate, projectId, projectStoryboardLibraryItems, selectedShot, shotLists]);

  // Actually create the shot with image — called from <AddShotDialog>
  const handleCreateShot = useCallback((payload?: AddShotDialogCreatePayload) => {
    if (!selectedScene) return;
    const imageUrl = payload?.imageUrl;
    const storyboardCandidate = payload?.storyboardCandidate;
    const storyboardLabel = storyboardCandidate?.cameraAngle?.trim().toLowerCase() || '';
    const storyboardShotType: ShotType =
      storyboardCandidate?.shotType
        ? storyboardCandidate.shotType
        : storyboardLabel.includes('close')
          ? 'Close-up'
          : storyboardLabel.includes('wide')
            ? 'Wide'
            : 'Medium';
    const technicalCameraAngle = [
      'eye level',
      'high angle',
      'low angle',
      'birds eye',
      'worms eye',
      'dutch angle',
      'overhead',
    ].includes(storyboardLabel)
      ? storyboardCandidate?.cameraAngle
      : 'Eye Level';
    const now = new Date().toISOString();
    const shotId = `shot-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
    const newShot: CastingShot = {
      id: shotId,
      sceneId: selectedScene.id,
      roleId: '',
      shotType: storyboardShotType,
      description: storyboardCandidate?.description || 'Ny shot',
      cameraAngle: technicalCameraAngle as CastingShot['cameraAngle'],
      cameraMovement: (storyboardCandidate?.movement || 'Static') as CastingShot['cameraMovement'],
      focalLength: 50,
      duration: Math.max(1, Math.round(storyboardCandidate?.duration ?? 5)),
      notes: storyboardCandidate ? `${storyboardCandidate.sourceLabel} · ${storyboardCandidate.shotNumber}` : '',
      imageUrl,
      storyboardFrameId: storyboardCandidate?.frameId,
      storyboardLibraryItemId: storyboardCandidate?.libraryItemId,
      storyboardLinkedSceneId: selectedScene.id,
      storyboardSourceType: storyboardCandidate?.sourceType,
      createdAt: now,
      updatedAt: now,
    };
    // Single state update — compute next list in one pass
    setShotLists(prev => {
      const existingList = prev.find(l => l.sceneId === selectedScene.id);
      let next: typeof prev;
      if (existingList) {
        next = prev.map(l => 
          l.sceneId === selectedScene.id 
            ? { ...l, shots: [...l.shots, newShot] }
            : l
        );
      } else {
        next = [...prev, {
          id: `shot-list-${crypto.randomUUID?.() ?? Date.now()}`,
          projectId,
          sceneId: selectedScene.id,
          shots: [newShot],
          equipment: [],
          createdAt: now,
          updatedAt: now,
        }];
      }
      // Queue persist (debounced — avoids duplicate calls on rapid shot creation)
      debouncedPersistShotList(projectId, selectedScene.id, next);
      return next;
    });
    // Seed full metadata structure (not just thumbnailUrl)
    setShotMetadata(prev => ({
      ...prev,
      [shotId]: {
        ...buildDefaultShotMeta(),
        ...(imageUrl ? { thumbnailUrl: imageUrl } : {}),
      },
    }));
    setSelectedShot(newShot);
  }, [selectedScene, projectId, debouncedPersistShotList]);

  // Reference shot search — passed to <AddShotDialog>
  // Race-safe: uses searchQueryIdRef to discard stale results
  // Results cache avoids redundant network calls for repeated queries
  const refSearchCacheRef = useRef<Map<string, ShotSearchResult[]>>(new Map());

  const handleSearchReferenceShots = useCallback(async (query: string): Promise<ShotSearchResult[]> => {
    const q = query.trim();
    if (!q) return [];

    // Cache hit — return immediately
    const cached = refSearchCacheRef.current.get(q);
    if (cached) return cached;

    // Race guard
    const queryId = ++searchQueryIdRef.current;

    try {
      const shotCafeResults = await searchShotCafe(q);

      // Stale guard: discard if a newer search was started
      if (queryId !== searchQueryIdRef.current) return [];

      const results: ShotSearchResult[] = shotCafeResults.map((film: any) => ({
        id: film.id || `film-${film.slug}`,
        url: film.thumbnail,
        thumbnailUrl: film.thumbnail,
        source: 'shot.cafe',
        film: film.title,
        // cinematographer is NOT a shot type — omit to avoid semantic mismatch
        attribution: film.cinematographer ? `DP: ${film.cinematographer}` : undefined,
      }));

      // Cache results
      refSearchCacheRef.current.set(q, results);
      // Cap cache size to avoid memory leak
      if (refSearchCacheRef.current.size > 50) {
        const firstKey = refSearchCacheRef.current.keys().next().value;
        if (firstKey) refSearchCacheRef.current.delete(firstKey);
      }

      return results;
    } catch {
      // No picsum fallback — show empty state with actionable UI
      return [];
    }
  }, [searchShotCafe]);

  const handleAddReadThroughNote = (lineIndex: number, note: string) => {
    setReadThroughNotes(prev => ({
      ...prev,
      [lineIndex]: note,
    }));
  };

  // ============================================
  // WORKFLOW GAP FIX #2: Scene Needs Handlers
  // ============================================
  const handleUpdateSceneNeeds = useCallback((sceneId: string, needs: { cam: boolean; light: boolean; sound: boolean }) => {
    setSceneNeeds(prev => ({
      ...prev,
      [sceneId]: needs,
    }));
  }, []);

  const handleOpenSceneNeedsDialog = (sceneId: string) => {
    dispatchWorkflow({ type: 'OPEN_SCENE_NEEDS', sceneId });
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
      dispatchWorkflow({ type: 'CLOSE_MODAL' });
    } catch (error) {
      console.error('Failed to schedule scene:', error);
    }
  };

  const handleOpenScheduleDialog = (scene: SceneBreakdown) => {
    dispatchWorkflow({ type: 'OPEN_SCHEDULE_SCENE', sceneId: scene.id });
  };

  // ============================================
  // WORKFLOW GAP FIX #4: Pre-Production Checklist Handlers
  // ============================================
  const handleUpdateChecklist = (sceneId: string, field: ChecklistKey, value: boolean) => {
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
    return deriveReadinessScore(checklist).score;
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
      console.log(`[Stripboard] Scene ${sceneId} strip status: ${stripStatus}`);
      await productionWorkflowService.assignSceneToDay(
        sceneId, 
        status === 'not-scheduled' ? null : selectedShootingDayId
      );
      
      // Update scene status override
      const uiStatus: DerivedSceneStatus = status === 'completed' ? 'complete' : status === 'shot' ? 'in-progress' : 'not-started';
      setSceneStatusOverrides(prev => ({
        ...prev,
        [sceneId]: uiStatus,
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

    dispatchWorkflow({ type: 'CLOSE_MODAL' });
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

  // Undo/Redo handlers — patch-based (no full-snapshot copies)
  const handleUndo = useCallback(() => {
    const result = undoPatch(scenes);
    if (result && onScenesReorder) {
      onScenesReorder(result);
    }
  }, [undoPatch, scenes, onScenesReorder]);

  const handleRedo = useCallback(() => {
    const result = redoPatch(scenes);
    if (result && onScenesReorder) {
      onScenesReorder(result);
    }
  }, [redoPatch, scenes, onScenesReorder]);

  // Batch operations — using SelectedMap (Record<string, true>)
  const handleToggleSceneSelection = useCallback((sceneId: string) => {
    if (!batchMode) {
      setBatchMode(true);
      setSelectedScenes({ [sceneId]: true });
    } else {
      setSelectedScenes(prev => selectedMapToggle(prev, sceneId));
    }
  }, [batchMode]);

  const handleBatchDelete = useCallback(() => {
    const size = selectedMapSize(selectedScenes);
    if (size === 0 || !onSceneDelete) return;
    const ids = selectedMapIds(selectedScenes);
    if (window.confirm(`Delete ${size} selected scenes?`)) {
      // Push a batch patch for undo
      const deletedScenes = scenes.filter(s => selectedMapHas(selectedScenes, s.id));
      const batchPatches = deletedScenes.map(s => ({
        type: 'deleteScene' as const,
        scene: s,
        index: scenes.indexOf(s),
      }));
      if (batchPatches.length > 0) {
        pushPatch({ type: 'batch', label: `Delete ${size} scenes`, patches: batchPatches });
      }
      ids.forEach(sceneId => onSceneDelete(sceneId));
      setSelectedScenes(EMPTY_SELECTION);
      setBatchMode(false);
    }
  }, [selectedScenes, onSceneDelete, scenes, pushPatch]);

  const handleBatchExport = useCallback(() => {
    const ids = selectedMapIds(selectedScenes);
    const selectedScenesList = scenes.filter(s => selectedMapHas(selectedScenes, s.id));
    const data = {
      scenes: selectedScenesList,
      count: selectedScenesList.length,
      exportDate: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `selected_scenes_${ids.length}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [selectedScenes, scenes]);

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

  // Sorting and filtering — combines search, tag, needs, and sort
  const getSortedAndFilteredScenes = (): SceneBreakdown[] => {
    let result = [...scenes];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(scene =>
        scene.sceneHeading?.toLowerCase().includes(query) ||
        scene.locationName?.toLowerCase().includes(query) ||
        scene.description?.toLowerCase().includes(query) ||
        scene.characters?.some(char => char.toLowerCase().includes(query)) ||
        toDisplayString(scene.sceneNumber).toLowerCase().includes(query)
      );
    }

    // Filter by tags
    if (selectedTags.size > 0) {
      result = result.filter(scene => 
        (sceneTags[scene.id] || []).some(tag => selectedTags.has(tag))
      );
    }

    // Filter by scene needs
    if (filters.missing.cam) {
      result = result.filter(s => sceneNeeds[s.id]?.cam);
    }
    if (filters.missing.light) {
      result = result.filter(s => sceneNeeds[s.id]?.light);
    }
    if (filters.missing.sound) {
      result = result.filter(s => sceneNeeds[s.id]?.sound);
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'number':
          comparison = (toSceneNumber(a.sceneNumber) ?? 0) - (toSceneNumber(b.sceneNumber) ?? 0);
          break;
        case 'duration': {
          const aDuration = shotLists.find(l => l.sceneId === a.id)?.shots.reduce((sum, shot) => sum + (shot.duration || 5), 0) || 0;
          const bDuration = shotLists.find(l => l.sceneId === b.id)?.shots.reduce((sum, shot) => sum + (shot.duration || 5), 0) || 0;
          comparison = aDuration - bDuration;
          break;
        }
        case 'date':
          comparison = toTimestamp(a.createdAt) - toTimestamp(b.createdAt);
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
      sceneNumber: `${(toSceneNumber(scene.sceneNumber) ?? 0) + 1}`,
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
          id: `shot-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`,
        }));
        setShotLists(prev => [...prev, { ...originalShotList, id: `sl-${crypto.randomUUID?.() ?? Date.now()}`, sceneId: newScene.id, shots: duplicatedShots }]);
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
    const scriptContent = scenes.map((scene, sceneIndex) => {
      const shots = shotLists.find(l => l.sceneId === scene.id)?.shots || [];
      return `
[${sceneIndex + 1}] SCENE ${scene.sceneNumber}
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

  const buildCallSheetForDay = useCallback((dayId?: string): CallSheet => {
    const day = shootingDays.find((entry) => entry.id === dayId) ?? shootingDays[0];
    const dayScenes = day?.scenes?.length
      ? scenes.filter((scene) => day.scenes.includes(scene.id))
      : scenes;
    const daySceneIds = new Set(dayScenes.map((scene) => scene.id));
    const dayShotLists = shotLists.filter((list) => daySceneIds.has(list.sceneId));
    const sceneEquipment = dayScenes.flatMap((scene) => scene.metadata?.equipment ?? []);

    return {
      id: `call-sheet-${day?.id ?? 'draft'}-${Date.now()}`,
      shootingDayId: day?.id ?? dayId ?? 'draft',
      projectTitle: manuscript.title || 'Produksjon',
      productionCompany: '',
      director: '',
      producer: '',
      date: day?.date ?? new Date().toISOString().split('T')[0],
      dayNumber: day?.dayNumber ?? Math.max(1, shootingDays.findIndex((entry) => entry.id === day?.id) + 1),
      totalDays: Math.max(shootingDays.length, 1),
      generalCallTime: day?.callTime ?? '08:00',
      crewCallTimes: Object.entries(day?.crewCallTimes ?? {}).map(([id, callTime]) => ({
        id,
        name: id,
        role: id,
        department: 'Crew',
        callTime,
      })),
      castCallTimes: Object.entries(day?.castCallTimes ?? {}).map(([id, callTime]) => ({
        id,
        name: id,
        character: id,
        callTime,
        scenes: dayScenes.filter((scene) => scene.characters?.includes(id)).map((scene) => toDisplayString(scene.sceneNumber, scene.id)),
      })),
      scenes: dayScenes.map((scene) => {
        const shots = dayShotLists.find((list) => list.sceneId === scene.id)?.shots ?? [];
        const duration = shots.reduce((sum, shot) => sum + (shot.duration ?? 5), 0);
        return {
          sceneNumber: toDisplayString(scene.sceneNumber, scene.id),
          description: scene.sceneHeading || scene.heading || scene.description || '',
          location: scene.locationName || day?.location || '',
          intExt: scene.intExt || '',
          timeOfDay: scene.timeOfDay || '',
          pages: scene.pageLength ?? 0,
          cast: scene.characters ?? [],
          estimatedTime: `${duration} min`,
          notes: quickNotes[scene.id] || scene.description || undefined,
        };
      }),
      locations: day
        ? [{
            name: day.location || 'Location',
            address: day.locationAddress ?? '',
          }]
        : [],
      equipment: Array.from(new Set([...(day?.equipmentNeeded ?? []), ...sceneEquipment])),
      meals: day?.meals ?? [],
      contacts: [],
      notes: [day?.notes].filter((note): note is string => Boolean(note)),
      weather: day?.weather,
      createdAt: new Date().toISOString(),
      version: 1,
    };
  }, [manuscript.title, quickNotes, scenes, shootingDays, shotLists]);

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

      // ── Read-through mode shortcuts (override defaults when active) ──
      if (readThroughMode) {
        if (e.code === 'Space') {
          e.preventDefault();
          handleReadThroughPlay();
          return;
        }
        if (e.code === 'ArrowRight') {
          e.preventDefault();
          handleReadThroughNext();
          return;
        }
        if (e.code === 'ArrowLeft') {
          e.preventDefault();
          handleReadThroughPrevious();
          return;
        }
        // Escape exits read-through mode
        if (e.code === 'Escape') {
          e.preventDefault();
          handleReadThroughToggle();
          return;
        }
      }

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
      else if (e.code === 'Delete' && (batchMode ? selectedMapSize(selectedScenes) > 0 : selectedScene)) {
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
        setSelectedScenes(selectedMapFromIds(scenes.map(s => s.id)));
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
          setSelectedScenes(EMPTY_SELECTION);
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
  }, [selectedScene, scenes, batchMode, selectedScenes, timelineIsPlaying, showQuickNotes, showSceneTemplate, readThroughMode, handleReadThroughNext, handleReadThroughPrevious]);

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
                onClick={() => dispatchWorkflow({ type: 'OPEN_STRIPBOARD' })}
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
                onClick={() => dispatchWorkflow({ type: 'OPEN_SCHEDULE' })}
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
              onClick={() => dispatchWorkflow({ type: 'OPEN_LIVE', showDaySelector: true })}
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

          {/* Follow Live Scene toggle — only visible when connected */}
          {!isMobile && isLiveSetConnected && (
            <Tooltip title={followLiveScene ? "Auto-følger live scene — klikk for å stoppe" : "Følg live scene automatisk"}>
              <Box
                onClick={() => dispatchWorkflow({ type: 'TOGGLE_FOLLOW_LIVE' })}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 1,
                  py: 0.5,
                  borderRadius: 1,
                  cursor: 'pointer',
                  bgcolor: followLiveScene ? 'rgba(239, 68, 68, 0.12)' : 'rgba(107, 114, 128, 0.08)',
                  border: `1px solid ${followLiveScene ? 'rgba(239, 68, 68, 0.3)' : '#374151'}`,
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: followLiveScene ? 'rgba(239, 68, 68, 0.18)' : 'rgba(107, 114, 128, 0.15)',
                  },
                }}
              >
                <Box
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: followLiveScene ? '#ef4444' : '#6b7280',
                    animation: followLiveScene ? 'pulse 2s infinite' : 'none',
                  }}
                />
                <Typography sx={{ fontSize: 10, color: followLiveScene ? '#ef4444' : '#9ca3af', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {followLiveScene ? 'FØLGER LIVE' : 'Følg scene'}
                </Typography>
              </Box>
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

      {/* Story Arc Context Bar — progressive disclosure layer (#5) */}
      {storyLogicData && (storyLogicData.logline?.fullLogline || storyLogicData.concept?.genre) && (
        <Box sx={{ borderBottom: '1px solid rgba(139, 92, 246, 0.15)' }}>
          {/* Toggle strip — always visible */}
          <Box
            onClick={() => setFilters(p => ({ ...p, showStoryContext: !p.showStoryContext }))}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: responsive.headerPx,
              py: 0.25,
              cursor: 'pointer',
              bgcolor: 'rgba(139, 92, 246, 0.04)',
              '&:hover': { bgcolor: 'rgba(139, 92, 246, 0.08)' },
              transition: 'background-color 0.15s',
            }}
          >
            <Typography sx={{ fontSize: 10, color: '#a78bfa', fontWeight: 600, letterSpacing: 0.5 }}>
              STORY ARC
            </Typography>
            {storyLogicData.concept?.genre && (
              <Chip label={storyLogicData.concept.genre} size="small" sx={{ bgcolor: 'rgba(139,92,246,0.12)', color: '#c4b5fd', fontSize: 9, height: 16, '& .MuiChip-label': { px: 0.8 } }} />
            )}
            <Box sx={{ flex: 1 }} />
            {autosaveStatus !== 'idle' && (
              <Typography sx={{ fontSize: 9, color: autosaveStatus === 'saving' ? '#fbbf24' : '#4ade80', opacity: 0.8, mr: 0.5 }}>
                {autosaveStatus === 'saving' ? 'Saving…' : '✓ Saved'}
              </Typography>
            )}
            {filters.showStoryContext ? <ExpandLessIcon sx={{ fontSize: 14, color: '#a78bfa' }} /> : <ExpandMoreIcon sx={{ fontSize: 14, color: '#a78bfa' }} />}
          </Box>
          {/* Expandable detail panel */}
          <Collapse in={filters.showStoryContext}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: responsive.headerPx,
                py: 0.5,
                bgcolor: 'rgba(139, 92, 246, 0.08)',
                overflow: 'hidden',
                flexWrap: 'nowrap',
              }}
            >
              {storyLogicData.concept?.genre && (
                <Chip
                  label={`${storyLogicData.concept.genre}${storyLogicData.concept.subGenre ? ` / ${storyLogicData.concept.subGenre}` : ''}`}
                  size="small"
                  sx={{
                    bgcolor: 'rgba(139, 92, 246, 0.15)',
                    color: '#c4b5fd',
                    fontSize: 10,
                    fontWeight: 600,
                    height: 20,
                    flexShrink: 0,
                  }}
                />
              )}
              {storyLogicData.logline?.fullLogline && (
                <Tooltip title={storyLogicData.logline.fullLogline}>
                  <Typography
                    sx={{
                      fontSize: 11,
                      color: 'rgba(255,255,255,0.6)',
                      fontStyle: 'italic',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    {storyLogicData.logline.fullLogline}
                  </Typography>
                </Tooltip>
              )}
              {storyLogicData.theme?.centralTheme && (
                <Chip
                  label={storyLogicData.theme.centralTheme}
                  size="small"
                  sx={{
                    bgcolor: 'rgba(236, 72, 153, 0.15)',
                    color: '#f9a8d4',
                    fontSize: 10,
                    fontWeight: 600,
                    height: 20,
                    flexShrink: 0,
                  }}
                />
              )}
            </Box>
          </Collapse>
        </Box>
      )}

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
                onClick={() => setFilters(p => ({ ...p, viewMode: p.viewMode === 'scenes' ? 'shots' : 'scenes' }))}
                sx={{
                  px: 1.5,
                  py: 0.5,
                  borderRadius: '8px',
                  bgcolor: filters.viewMode === 'scenes' ? 'rgba(59,130,246,0.2)' : '#1a2230',
                  border: filters.viewMode === 'scenes' ? '1px solid #3b82f6' : '1px solid #252d3d',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': { bgcolor: filters.viewMode === 'scenes' ? 'rgba(59,130,246,0.25)' : '#252d3d' },
                }}
              >
                <Stack direction="row" spacing={0.75} alignItems="center">
                  {filters.viewMode === 'scenes' ? <VideoLibraryIcon sx={{ fontSize: 14 }} /> : <MovieIcon sx={{ fontSize: 14 }} />}
                  <Typography sx={{ fontSize: 11, fontWeight: 600, color: filters.viewMode === 'scenes' ? '#60a5fa' : '#9ca3af' }}>
                    {filters.viewMode === 'scenes' ? 'Scener' : 'Shots'}
                  </Typography>
                </Stack>
              </Box>
              <Box
                onClick={() => setFilters(p => ({ ...p, missing: { ...p.missing, cam: !p.missing.cam } }))}
                sx={{
                  px: 1.5,
                  py: 0.5,
                  borderRadius: '8px',
                  bgcolor: filters.missing.cam ? 'rgba(249,115,22,0.2)' : '#1a2230',
                  border: filters.missing.cam ? '1px solid #f97316' : '1px solid #252d3d',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': { bgcolor: filters.missing.cam ? 'rgba(249,115,22,0.25)' : '#252d3d' },
                }}
              >
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <CameraIcon sx={{ fontSize: 14, color: filters.missing.cam ? '#fb923c' : '#9ca3af' }} />
                  <Typography sx={{ fontSize: 11, fontWeight: 600, color: filters.missing.cam ? '#fb923c' : '#9ca3af' }}>Kamera</Typography>
                </Stack>
              </Box>
              <Box
                onClick={() => setFilters(p => ({ ...p, missing: { ...p.missing, light: !p.missing.light } }))}
                sx={{
                  px: 1.5,
                  py: 0.5,
                  borderRadius: '8px',
                  bgcolor: filters.missing.light ? 'rgba(251,191,36,0.2)' : '#1a2230',
                  border: filters.missing.light ? '1px solid #fbbf24' : '1px solid #252d3d',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': { bgcolor: filters.missing.light ? 'rgba(251,191,36,0.25)' : '#252d3d' },
                }}
              >
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <LightIcon sx={{ fontSize: 14, color: filters.missing.light ? '#fcd34d' : '#9ca3af' }} />
                  <Typography sx={{ fontSize: 11, fontWeight: 600, color: filters.missing.light ? '#fcd34d' : '#9ca3af' }}>
                    Lys
                  </Typography>
                </Stack>
              </Box>
              <Box
                onClick={() => setFilters(p => ({ ...p, missing: { ...p.missing, sound: !p.missing.sound } }))}
                sx={{
                  px: 1.5,
                  py: 0.5,
                  borderRadius: '8px',
                  bgcolor: filters.missing.sound ? 'rgba(6,182,212,0.2)' : '#1a2230',
                  border: filters.missing.sound ? '1px solid #06b6d4' : '1px solid #252d3d',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': { bgcolor: filters.missing.sound ? 'rgba(6,182,212,0.25)' : '#252d3d' },
                }}
              >
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <MicIcon sx={{ fontSize: 14, color: filters.missing.sound ? '#22d3ee' : '#9ca3af' }} />
                  <Typography sx={{ fontSize: 11, fontWeight: 600, color: filters.missing.sound ? '#22d3ee' : '#9ca3af' }}>
                    Lyd
                  </Typography>
                </Stack>
              </Box>
              <Box
                onClick={() => setFilters(p => ({ ...p, showTags: !p.showTags }))}
                sx={{
                  px: 1.5,
                  py: 0.5,
                  borderRadius: '8px',
                  bgcolor: filters.showTags ? 'rgba(16,185,129,0.2)' : '#1a2230',
                  border: filters.showTags ? '1px solid #10b981' : '1px solid #252d3d',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': { bgcolor: filters.showTags ? 'rgba(16,185,129,0.25)' : '#252d3d' },
                }}
              >
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <BookmarkIcon sx={{ fontSize: 14, color: filters.showTags ? '#34d399' : '#9ca3af' }} />
                  <Typography sx={{ fontSize: 11, fontWeight: 600, color: filters.showTags ? '#34d399' : '#9ca3af' }}>
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
                const sortedAndFiltered = getSortedAndFilteredScenes();
                const visibleScenes = actScenes.filter(s => sortedAndFiltered.find(fs => fs.id === s.id));
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
                          const isBatchSelected = selectedMapHas(selectedScenes, scene.id);
                          const status = getSceneStatus(scene);
                          const statusColor = STATUS_COLORS[status as keyof typeof STATUS_COLORS];
                          const needs = sceneNeeds[scene.id] || { cam: false, light: false, sound: false };
                          const shotsCount = getShotsForScene(scene.id).length;
                          const firstShot = shotsCount > 0 ? getShotsForScene(scene.id)[0] : null;
                          
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
                                shotsCount={shotsCount}
                                showTags={filters.showTags}
                                thumbnail={firstShot ? shotMetadata[firstShot.id]?.thumbnailUrl : undefined}
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
          {batchMode && selectedMapSize(selectedScenes) > 0 && (
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
                  {selectedMapSize(selectedScenes)} scene{selectedMapSize(selectedScenes) !== 1 ? 's' : ''} selected
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
                      onClick={() => { setBatchMode(false); setSelectedScenes(EMPTY_SELECTION); }}
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
            <Tooltip title="The Role Room">
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
            <Tooltip title="Skriv ut manus">
              <IconButton
                onClick={() => window.print()}
                sx={{
                  color: '#6b7280',
                  bgcolor: '#1a2230',
                  border: '1px solid #252d3d',
                  borderRadius: '8px',
                  '&:hover': { bgcolor: '#252d3d', color: '#a78bfa' },
                }}
              >
                <PrintIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Eksporter som fil">
              <IconButton
                onClick={handlePDFExport}
                sx={{
                  color: '#6b7280',
                  bgcolor: '#1a2230',
                  border: '1px solid #252d3d',
                  borderRadius: '8px',
                  '&:hover': { bgcolor: '#252d3d', color: '#f97316' },
                }}
              >
                <ExportIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Last ned Call Sheet som PDF">
              <IconButton
                onClick={() => { void downloadCallSheetPDF(buildCallSheetForDay(selectedShootingDayId ?? undefined), DEFAULT_CALL_SHEET_OPTIONS); }}
                sx={{
                  color: '#6b7280',
                  bgcolor: '#1a2230',
                  border: '1px solid #252d3d',
                  borderRadius: '8px',
                  '&:hover': { bgcolor: '#252d3d', color: '#06b6d4' },
                }}
              >
                <CallSheetIcon sx={{ fontSize: 18 }} />
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
                <Typography sx={{ fontSize: responsiveBodyFontSize - 1, fontWeight: 700, color: readThroughMode ? '#10b981' : '#60a5fa', letterSpacing: 1 }}>
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

                  {/* TTS Voice Controls */}
                  {!isMobile && (
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ ml: 1 }}>
                      <Divider orientation="vertical" flexItem sx={{ borderColor: '#374151' }} />
                      <Tooltip title={ttsEnabled ? 'AI-stemme aktiv (OpenAI)' : 'AI-stemme av'}>
                        <IconButton
                          size="small"
                          onClick={() => setTtsEnabled(!ttsEnabled)}
                          sx={{
                            color: ttsEnabled ? '#8b5cf6' : '#4b5563',
                            bgcolor: ttsEnabled ? 'rgba(139,92,246,0.1)' : 'transparent',
                            '&:hover': { color: '#8b5cf6', bgcolor: 'rgba(139,92,246,0.15)' },
                            p: 0.5,
                          }}
                        >
                          <MicIcon sx={{ fontSize: responsive.iconSize - 2 }} />
                        </IconButton>
                      </Tooltip>
                      {ttsEnabled && (
                        <>
                          <Select
                            value={ttsLanguage}
                            onChange={(e) => setTtsLanguage(e.target.value as TTSLanguage)}
                            size="small"
                            variant="standard"
                            disableUnderline
                            displayEmpty
                            sx={{
                              color: ttsLanguage ? '#3b82f6' : '#9ca3af',
                              fontSize: responsiveBodyFontSize - 2,
                              minWidth: 52,
                              '& .MuiSelect-select': { py: 0, px: 0.5 },
                              '& .MuiSelect-icon': { color: '#6b7280', fontSize: 16 },
                            }}
                          >
                            <MenuItem value="" sx={{ fontSize: 12 }}>
                              Auto
                            </MenuItem>
                            {TTS_LANGUAGES.map((l) => (
                              <MenuItem key={l.id} value={l.id} sx={{ fontSize: 12 }}>
                                {l.flag} {l.label}
                              </MenuItem>
                            ))}
                          </Select>
                          <Select
                            value={ttsVoice}
                            onChange={(e) => setTtsVoice(e.target.value as TTSVoice)}
                            size="small"
                            variant="standard"
                            disableUnderline
                            sx={{
                              color: '#9ca3af',
                              fontSize: responsiveBodyFontSize - 2,
                              minWidth: 70,
                              '& .MuiSelect-select': { py: 0, px: 0.5 },
                              '& .MuiSelect-icon': { color: '#6b7280', fontSize: 16 },
                            }}
                          >
                            {TTS_VOICES.map((v) => (
                              <MenuItem key={v.id} value={v.id} sx={{ fontSize: 12 }}>
                                {v.label}
                              </MenuItem>
                            ))}
                          </Select>
                          <Tooltip title={`Speed: ${ttsSpeed}x`}>
                            <IconButton
                              size="small"
                              onClick={() => setTtsSpeed(prev => {
                                const speeds = [0.75, 1.0, 1.25, 1.5, 2.0];
                                const idx = speeds.indexOf(prev);
                                return speeds[(idx + 1) % speeds.length];
                              })}
                              sx={{
                                color: ttsSpeed !== 1.0 ? '#f59e0b' : '#6b7280',
                                fontSize: responsiveBodyFontSize - 2,
                                p: 0.5,
                                minWidth: 28,
                              }}
                            >
                              <Typography sx={{ fontSize: 10, fontWeight: 700 }}>{ttsSpeed}x</Typography>
                            </IconButton>
                          </Tooltip>
                          {/* Resume TTS button */}
                          <Tooltip title={isTTSPlaying() ? 'Pause TTS' : 'Resume TTS'}>
                            <IconButton
                              size="small"
                              onClick={() => {
                                if (isTTSPlaying()) {
                                  pauseTTS();
                                } else {
                                  resumeTTS();
                                }
                              }}
                              sx={{
                                color: isTTSPlaying() ? '#10b981' : '#6b7280',
                                p: 0.5,
                                '&:hover': { color: '#10b981', bgcolor: 'rgba(16,185,129,0.15)' },
                              }}
                            >
                              {isTTSPlaying() ? <PauseIcon sx={{ fontSize: 14 }} /> : <PlayIcon sx={{ fontSize: 14 }} />}
                            </IconButton>
                          </Tooltip>
                          {/* Character voices toggle */}
                          <Tooltip title={ttsUseCharacterVoices ? 'Slå av karakterstemmer' : 'Bruk karakterstemmer'}>
                            <IconButton
                              size="small"
                              onClick={() => setTtsUseCharacterVoices(prev => !prev)}
                              sx={{
                                color: ttsUseCharacterVoices ? '#8b5cf6' : '#4b5563',
                                p: 0.5,
                                '&:hover': { color: '#8b5cf6', bgcolor: 'rgba(139,92,246,0.15)' },
                              }}
                            >
                              <TheaterIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </Stack>
                  )}
                </>
              )}
            </Stack>
            <Stack direction="row" spacing={isMobile ? 0.5 : 1} alignItems="center">
              {!isMobile && (
                <Typography sx={{ fontSize: responsiveBodyFontSize - 2, color: '#4b5563' }}>
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
                      onClick={() => dispatchWorkflow({ type: 'OPEN_CHECKLIST' })}
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
                      onClick={() => dispatchWorkflow({ type: 'OPEN_BULK_SHOT' })}
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
                      onClick={() => dispatchWorkflow({ type: 'OPEN_LINE_COVERAGE' })}
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
                        const stripStatus = currentStatus === 'complete' ? 'completed' : currentStatus === 'in-progress' ? 'shot' : 'not-scheduled';
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
                          data-line-index={lineIdx} 
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
                {readThroughMode && selectedScene ? (
                  <Box sx={{ p: 3, borderBottom: '1px solid #252d3d' }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                      <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', letterSpacing: 0.5 }}>
                        READ THROUGH NOTES
                      </Typography>
                    </Stack>
                    <Box sx={{ mb: 2 }}>
                      <TextField
                        fullWidth
                        multiline
                        rows={2}
                        placeholder="Skriv noter for denne linjen..."
                        value={readThroughNotes[readThroughCurrentLine] || ''}
                        onChange={(e) => handleAddReadThroughNote(readThroughCurrentLine, e.target.value)}
                        sx={{
                          '& .MuiInputBase-input': { color: '#e5e7eb', fontSize: 12 },
                          '& .MuiOutlinedInput-root': {
                            borderColor: '#2a3142', bgcolor: '#0f1318',
                            '&:hover': { borderColor: '#374151' },
                            '&.Mui-focused': { borderColor: '#10b981', '& fieldset': { borderColor: '#10b981' } },
                          },
                        }}
                      />
                      <GlobalMentionHelper
                        text={readThroughNotes[readThroughCurrentLine] || ''}
                        localCandidates={productionMentionCandidates}
                        autoTagTitle="Auto-tagget i read-through-notat"
                        suggestionTitle="Mener du?"
                        onApplySuggestion={(name) =>
                          handleAddReadThroughNote(
                            readThroughCurrentLine,
                            applyMentionSuggestion(readThroughNotes[readThroughCurrentLine], name),
                          )
                        }
                      />
                      {readThroughNotes[readThroughCurrentLine] && (
                        <Box sx={{ mt: 1.5, p: 1.5, bgcolor: 'rgba(16,185,129,0.08)', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.2)' }}>
                          <Typography sx={{ fontSize: 12, color: '#10b981', whiteSpace: 'pre-wrap' }}>
                            {readThroughNotes[readThroughCurrentLine]}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Box>
                ) : selectedScene ? (
                  /* Extracted: per-scene draft/saved autosave with all 4 note types */
                  <ProductionNotesPanel
                    sceneId={selectedScene.id}
                    sceneNumber={toSceneNumber(selectedScene.sceneNumber)}
                    savedNotes={productionNotes[selectedScene.id] ?? {}}
                    onSaveNote={handleSaveProductionNote}
                    readThroughMode={false}
                  />
                ) : null}

                {/* Scene Status Quick Actions */}
                {selectedScene && (
                  <Box sx={{ p: 3, borderBottom: '1px solid #252d3d' }}>
                    <Stack spacing={1.5}>
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
                        {(() => { const currentStatus = getSceneStatus(selectedScene); return [
                          { value: 'not-started' as const, label: 'Ikke startet', color: '#6b7280' },
                          { value: 'in-progress' as const, label: 'Pågår', color: '#f59e0b' },
                          { value: 'complete' as const, label: 'Ferdig', color: '#10b981' },
                        ].map((status) => (
                          <Chip
                            key={status.value}
                            label={status.label}
                            size="small"
                            onClick={() => handleSetSceneStatus(selectedScene.id, status.value)}
                            sx={{
                              bgcolor: currentStatus === status.value 
                                ? `${status.color}30` 
                                : 'rgba(255,255,255,0.05)',
                              color: currentStatus === status.value 
                                ? status.color 
                                : '#6b7280',
                              border: currentStatus === status.value 
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
                        )); })()}
                      </Box>
                    </Stack>
                  </Box>
                )}

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
              <Typography sx={{ fontSize: responsiveBodyFontSize - 2, fontWeight: 700, color: '#a78bfa', letterSpacing: 1 }}>
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
                <Typography sx={{ fontSize: responsiveBodyFontSize - 2, color: '#6b7280', px: 1, display: 'flex', alignItems: 'center' }}>
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
                <Typography sx={{ fontSize: responsiveBodyFontSize - 2, fontWeight: 600, color: '#fcd34d' }}>
                  Overtid: +{getOvertimeDuration()}
                </Typography>
              </Box>
            )}
            <Typography sx={{ fontSize: responsiveBodyFontSize + 1, fontWeight: 700, color: '#fff' }}>
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
            ref={timelineRef}
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
            
            {/* Playhead — GPU-accelerated via transform + ref */}
            <Box
              ref={playheadRef}
              sx={{
                position: 'absolute',
                left: 0,
                top: -6,
                bottom: -6,
                width: 3,
                bgcolor: '#ef4444',
                zIndex: 100,
                borderRadius: '2px',
                boxShadow: '0 0 8px rgba(239,68,68,0.5)',
                transition: timelineIsPlaying ? 'none' : 'transform 120ms linear',
                willChange: 'transform',
                pointerEvents: 'none',
                transform: 'translate3d(0px, 0, 0)',
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
          width: containerStyle.sidebarWidth || 280,
          maxWidth: containerStyle.maxWidth ? containerStyle.sidebarWidth : undefined,
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
          {/* Scene Metadata Summary */}
          {selectedScene && selectedSceneMetadata && (
            <Stack spacing={0.5} sx={{ mt: 1 }}>
              <DetailRow icon="🎬" label={`${selectedSceneMetadata.camera || 'Not set'} • ${selectedSceneMetadata.lens || 'N/A'}`} />
              <DetailRow icon="💡" label={selectedSceneMetadata.lighting || 'Standard'} />
              <DetailRow icon="🎙️" label={selectedSceneMetadata.audio || 'Boom'} />
            </Stack>
          )}
          {/* Live Set & Duration indicators */}
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            {liveSetStatus && (
              <Chip
                icon={<LiveIcon sx={{ fontSize: 10, color: liveSetStatus.isRolling ? '#ef4444' : '#6b7280' }} />}
                label={liveSetStatus.isRolling ? 'LIVE' : 'Standby'}
                size="small"
                sx={{
                  height: 20,
                  fontSize: 10,
                  bgcolor: liveSetStatus.isRolling ? 'rgba(239,68,68,0.15)' : 'rgba(107,114,128,0.15)',
                  color: liveSetStatus.isRolling ? '#ef4444' : '#9ca3af',
                  border: `1px solid ${liveSetStatus.isRolling ? '#ef4444' : '#374151'}`,
                }}
              />
            )}
            {/* "Jump to live scene" CTA — shown when not auto-following */}
            {liveSetStatus?.currentScene && !followLiveScene && liveSetStatus.currentScene !== selectedScene?.id && (
              <Chip
                label="Hopp til live scene"
                size="small"
                onClick={() => {
                  const cs = scenes.find(s => s.id === liveSetStatus.currentScene);
                  if (cs) setSelectedScene(cs);
                }}
                sx={{
                  height: 20,
                  fontSize: 10,
                  bgcolor: 'rgba(59,130,246,0.15)',
                  color: '#60a5fa',
                  border: '1px solid rgba(59,130,246,0.3)',
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'rgba(59,130,246,0.25)' },
                }}
              />
            )}
            {currentCallSheet && (
              <Chip
                icon={<CallSheetIcon sx={{ fontSize: 10, color: '#06b6d4' }} />}
                label={`CS: ${currentCallSheet.shootingDayId}`}
                size="small"
                sx={{ height: 20, fontSize: 10, bgcolor: 'rgba(6,182,212,0.15)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.3)' }}
              />
            )}
            {editingShotDuration && (
              <Chip
                icon={<TimerIcon sx={{ fontSize: 10, color: '#fbbf24' }} />}
                label={`Editing: ${editingShotDuration}`}
                size="small"
                onDelete={() => setEditingShotDuration(null)}
                sx={{ height: 20, fontSize: 10, bgcolor: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}
              />
            )}
          </Stack>
          {/* Scene Actions */}
          <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
            <Tooltip title="Scene referansebilde">
              <IconButton size="small" onClick={() => selectedScene && dispatchSearch({ type: 'OPEN' })} sx={{ color: '#6b7280', p: 0.5, '&:hover': { color: '#60a5fa' } }}>
                <ImageIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Kamera oppsett">
              <IconButton size="small" onClick={() => selectedScene && dispatchWorkflow({ type: 'OPEN_SCENE_NEEDS', sceneId: selectedScene.id })} sx={{ color: '#6b7280', p: 0.5, '&:hover': { color: '#f97316' } }}>
                <CameraAltIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Utstyr">
              <IconButton size="small" onClick={() => selectedScene && setShowEstimateDialog(true)} sx={{ color: '#6b7280', p: 0.5, '&:hover': { color: '#10b981' } }}>
                <InventoryIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Søk filmreferanser">
              <IconButton
                size="small"
                onClick={async () => {
                  if (selectedScene?.locationName) {
                    const results = await searchByCinematographer(selectedScene.locationName);
                    if (results.length > 0) dispatchSearch({ type: 'SET_FILM_RESULTS', films: results });
                  }
                }}
                sx={{ color: '#6b7280', p: 0.5, '&:hover': { color: '#a78bfa' } }}
              >
                <SearchIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          </Stack>
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
          <Box sx={{ borderBottom: '1px solid #2a3142', bgcolor: '#0f4c3f' }} data-testid="pmv-shot-inspector">
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
              <Typography
                sx={{ fontSize: 13, fontWeight: 600, color: '#fff', mb: 1.5 }}
                data-testid="pmv-shot-title"
              >
                {selectedShot.description || 'Shot Details'}
              </Typography>

              <Box sx={{ mb: 1.5, pb: 1.5, borderBottom: '1px solid #1f3a33' }}>
                <Typography sx={{ fontSize: 11, color: '#6b7280', mb: 1, fontWeight: 600 }}>
                  STORYBOARD LINK
                </Typography>
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Chip
                      size="small"
                      label={
                        selectedShotStoryboardLink?.status === 'linked'
                          ? `Koblet · ${selectedShotStoryboardLink.candidate?.shotNumber || 'frame'}`
                          : selectedShotStoryboardLink?.status === 'missing'
                            ? 'Mangler frame'
                            : 'Ikke koblet'
                      }
                      sx={{
                        bgcolor:
                          selectedShotStoryboardLink?.status === 'linked'
                            ? 'rgba(16,185,129,0.18)'
                            : selectedShotStoryboardLink?.status === 'missing'
                              ? 'rgba(245,158,11,0.18)'
                              : 'rgba(148,163,184,0.14)',
                        color:
                          selectedShotStoryboardLink?.status === 'linked'
                            ? '#6ee7b7'
                            : selectedShotStoryboardLink?.status === 'missing'
                              ? '#fbbf24'
                              : '#cbd5e1',
                        border:
                          selectedShotStoryboardLink?.status === 'linked'
                            ? '1px solid rgba(16,185,129,0.35)'
                            : selectedShotStoryboardLink?.status === 'missing'
                              ? '1px solid rgba(245,158,11,0.35)'
                              : '1px solid rgba(148,163,184,0.22)',
                      }}
                    />
                    {selectedShotStoryboardLink?.label && (
                      <Typography sx={{ fontSize: 11, color: '#9ca3af' }}>
                        {selectedShotStoryboardLink.label}
                      </Typography>
                    )}
                  </Stack>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={handleOpenSelectedShotStoryboardLinkDialog}
                      data-testid="pmv-shot-storyboard-link"
                      sx={{ color: '#93c5fd', borderColor: 'rgba(59,130,246,0.32)' }}
                    >
                      {selectedShotStoryboardLink?.status === 'linked' ? 'Relink' : 'Koble'}
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={handleOpenSelectedShotStoryboardFrame}
                      data-testid="pmv-shot-open-linked-frame"
                      disabled={selectedShotStoryboardLink?.status !== 'linked'}
                      sx={{ color: '#d1d5db', borderColor: 'rgba(148,163,184,0.3)' }}
                    >
                      Åpne frame
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={handleResyncSelectedShotStoryboard}
                      data-testid="pmv-shot-storyboard-resync"
                      disabled={selectedShotStoryboardLink?.status !== 'linked'}
                      sx={{ color: '#fbbf24', borderColor: 'rgba(245,158,11,0.3)' }}
                    >
                      Synk
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={handleUnlinkSelectedShotStoryboard}
                      data-testid="pmv-shot-storyboard-unlink"
                      disabled={selectedShotStoryboardLink?.status === 'unlinked'}
                      sx={{ color: '#fca5a5', borderColor: 'rgba(248,113,113,0.28)' }}
                    >
                      Unlink
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={handleCreateStoryboardFrameFromSelectedShot}
                      sx={{ color: '#c4b5fd', borderColor: 'rgba(139,92,246,0.28)' }}
                    >
                      Ny frame fra shot
                    </Button>
                  </Stack>
                </Stack>
              </Box>

              {selectedSceneStoryboardCoverage && selectedSceneStoryboardCoverage.totalFrames > 0 && (
                <Box
                  sx={{ mb: 1.5, pb: 1.5, borderBottom: '1px solid #1f3a33' }}
                  data-testid="pmv-storyboard-coverage"
                >
                  <Typography sx={{ fontSize: 11, color: '#6b7280', mb: 1, fontWeight: 600 }}>
                    STORYBOARD COVERAGE
                  </Typography>
                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
                    <Chip
                      size="small"
                      label={`${selectedSceneStoryboardCoverage.coveredFrames}/${selectedSceneStoryboardCoverage.totalFrames} frames brukt`}
                      sx={{
                        bgcolor: 'rgba(59,130,246,0.14)',
                        color: '#93c5fd',
                        border: '1px solid rgba(59,130,246,0.24)',
                      }}
                    />
                    <Chip
                      size="small"
                      label={`${selectedSceneStoryboardCoverage.missingFrames} mangler shot`}
                      sx={{
                        bgcolor: 'rgba(245,158,11,0.12)',
                        color: '#fbbf24',
                        border: '1px solid rgba(245,158,11,0.24)',
                      }}
                    />
                    {selectedSceneStoryboardCoverage.unlinkedShots > 0 && (
                      <Chip
                        size="small"
                        label={`${selectedSceneStoryboardCoverage.unlinkedShots} shots uten storyboard`}
                        sx={{
                          bgcolor: 'rgba(148,163,184,0.12)',
                          color: '#cbd5e1',
                          border: '1px solid rgba(148,163,184,0.2)',
                        }}
                      />
                    )}
                  </Stack>
                  {selectedSceneStoryboardCoverage.missingFrameList.length > 0 && (
                    <Typography
                      sx={{ fontSize: 11, color: '#9ca3af', mb: 1 }}
                      data-testid="pmv-storyboard-coverage-missing"
                    >
                      Mangler: {selectedSceneStoryboardCoverage.missingFrameList
                        .slice(0, 4)
                        .map((frame) => frame.shotNumber || frame.title || frame.frameId)
                        .join(', ')}
                    </Typography>
                  )}
                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={handleOpenSelectedSceneStoryboard}
                      data-testid="pmv-scene-open-storyboard"
                      sx={{ color: '#93c5fd', borderColor: 'rgba(59,130,246,0.32)' }}
                    >
                      Åpne scene-storyboard
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={handleOpenSelectedSceneCoverageLinkedFrame}
                      data-testid="pmv-scene-open-linked-frame"
                      disabled={selectedSceneStoryboardFirstLinkedFrameIndex === undefined}
                      sx={{ color: '#bfdbfe', borderColor: 'rgba(96,165,250,0.26)' }}
                    >
                      Åpne linked frame
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={handleOpenSelectedSceneCoverageMissingFrame}
                      data-testid="pmv-scene-open-missing-frame"
                      disabled={selectedSceneStoryboardFirstMissingFrameIndex === undefined}
                      sx={{ color: '#fbbf24', borderColor: 'rgba(245,158,11,0.24)' }}
                    >
                      Åpne manglende frame
                    </Button>
                  </Stack>
                </Box>
              )}
              
              {/* Shot Duration - Editable */}
              <Box sx={{ mb: 1.5, pb: 1.5, borderBottom: '1px solid #1f3a33' }}>
                <Typography sx={{ fontSize: 11, color: '#6b7280', mb: 1, fontWeight: 600 }}>VARIGHET</Typography>
                <Box
                  onClick={() => setEditingShotDuration(selectedShot.id)}
                  sx={{ bgcolor: '#1a2f28', p: 1, borderRadius: 0.75, cursor: 'pointer', '&:hover': { bgcolor: '#1f3a33' } }}
                >
                  {editingShotDuration === selectedShot.id ? (
                    <TextField
                      type="number"
                      size="small"
                      value={shotDurationValues[selectedShot.id] || 5}
                      onChange={(e) => handleUpdateShotDuration(selectedShot.id, parseInt(e.target.value) || 1)}
                      onBlur={() => setEditingShotDuration(null)}
                      onKeyDown={(e) => e.key === 'Enter' && setEditingShotDuration(null)}
                      autoFocus
                      InputProps={{ endAdornment: <InputAdornment position="end"><Typography sx={{ fontSize: 10, color: '#6b7280' }}>sek</Typography></InputAdornment> }}
                      sx={{ '& .MuiInputBase-root': { bgcolor: '#0f1318', color: '#fff', fontSize: 12 }, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#10b981' }, width: '100%' }}
                    />
                  ) : (
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography sx={{ fontSize: 12, color: '#fff' }}>{shotDurationValues[selectedShot.id] || selectedShot.duration || 5}s</Typography>
                      <EditIcon sx={{ fontSize: 12, color: '#6b7280' }} />
                    </Stack>
                  )}
                </Box>
              </Box>

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
              onClick={() => dispatchInspector({ type: 'TOGGLE_SECTION', section: 'camera' })}
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
                        onChange={(e) => dispatchInspector({ type: 'UPDATE_PROPERTY', field: 'camera', value: e.target.value })}
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
                        onChange={(e) => dispatchInspector({ type: 'UPDATE_PROPERTY', field: 'lens', value: e.target.value })}
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
                        onChange={(e) => dispatchInspector({ type: 'UPDATE_PROPERTY', field: 'rig', value: e.target.value })}
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
                        onChange={(e) => dispatchInspector({ type: 'UPDATE_PROPERTY', field: 'shotType', value: e.target.value })}
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
                        {/* Load saved presets */}
                        {Object.keys(savedPresets).length > 0 && (
                          <Tooltip title="Last inn preset">
                            <Select
                              size="small"
                              value=""
                              displayEmpty
                              onChange={(e) => { if (e.target.value) handleLoadPreset(e.target.value as string); }}
                              sx={{ height: 24, fontSize: 10, color: '#9ca3af', minWidth: 80, '& .MuiSelect-select': { py: 0.25 }, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#374151' } }}
                              renderValue={() => 'Presets'}
                            >
                              {Object.keys(savedPresets).map(name => (
                                <MenuItem key={name} value={name} sx={{ fontSize: 11, color: '#fff', bgcolor: '#1e2536', '&:hover': { bgcolor: 'rgba(59,130,246,0.2)' } }}>
                                  {name}
                                </MenuItem>
                              ))}
                            </Select>
                          </Tooltip>
                        )}
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
                onClick={() => dispatchInspector({ type: 'TOGGLE_SECTION', section: 'lighting' })}
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
                    onStartEdit={() => dispatchInspector({ type: 'START_EDIT', field: 'keyLight', currentValue: shotProperties.keyLight })}
                    onSave={() => dispatchInspector({ type: 'SAVE_EDIT' })}
                    onCancel={() => dispatchInspector({ type: 'CANCEL_EDIT' })}
                    onChange={(v) => dispatchInspector({ type: 'SET_EDIT_DRAFT', draft: v })}
                    options={['Mykt sidelys', 'Key Light – 1200W', 'Key Light – 600W', 'Softbox', 'LED Panel', 'HMI', 'Natural Light']}
                  />
                  <EditableDetailRow
                    icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707"/><circle cx="12" cy="12" r="4" fill="currentColor" fillOpacity="0.3"/></svg>}
                    value={shotProperties.sideLight}
                    field="sideLight"
                    isEditing={editingField === 'sideLight'}
                    editValue={editValue}
                    onStartEdit={() => dispatchInspector({ type: 'START_EDIT', field: 'sideLight', currentValue: shotProperties.sideLight })}
                    onSave={() => dispatchInspector({ type: 'SAVE_EDIT' })}
                    onCancel={() => dispatchInspector({ type: 'CANCEL_EDIT' })}
                    onChange={(v) => dispatchInspector({ type: 'SET_EDIT_DRAFT', draft: v })}
                    options={['Varm tone', 'Side Lighting', 'Fill Light', 'Rim Light', 'Back Light', 'Practical', 'Natural']}
                  />
                  <EditableDetailRow
                    icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>}
                    value={shotProperties.gel}
                    field="gel"
                    isEditing={editingField === 'gel'}
                    editValue={editValue}
                    onStartEdit={() => dispatchInspector({ type: 'START_EDIT', field: 'gel', currentValue: shotProperties.gel })}
                    onSave={() => dispatchInspector({ type: 'SAVE_EDIT' })}
                    onCancel={() => dispatchInspector({ type: 'CANCEL_EDIT' })}
                    onChange={(v) => dispatchInspector({ type: 'SET_EDIT_DRAFT', draft: v })}
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
                onClick={() => dispatchInspector({ type: 'TOGGLE_SECTION', section: 'audio' })}
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
                    onStartEdit={() => dispatchInspector({ type: 'START_EDIT', field: 'mic', currentValue: shotProperties.mic })}
                    onSave={() => dispatchInspector({ type: 'SAVE_EDIT' })}
                    onCancel={() => dispatchInspector({ type: 'CANCEL_EDIT' })}
                    onChange={(v) => dispatchInspector({ type: 'SET_EDIT_DRAFT', draft: v })}
                    options={['Boom Mic', 'Lav Mic', 'Shotgun Mic', 'Wireless Lav', 'Plant Mic']}
                  />
                  <EditableDetailRow
                    icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>}
                    value={shotProperties.atmos}
                    field="atmos"
                    isEditing={editingField === 'atmos'}
                    editValue={editValue}
                    onStartEdit={() => dispatchInspector({ type: 'START_EDIT', field: 'atmos', currentValue: shotProperties.atmos })}
                    onSave={() => dispatchInspector({ type: 'SAVE_EDIT' })}
                    onCancel={() => dispatchInspector({ type: 'CANCEL_EDIT' })}
                    onChange={(v) => dispatchInspector({ type: 'SET_EDIT_DRAFT', draft: v })}
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
                onClick={() => dispatchInspector({ type: 'TOGGLE_SECTION', section: 'references' })}
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
                                onClick={() => dispatchSearch({ type: 'REMOVE_UPLOADED_REF', index: idx })}
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
                                onClick={() => dispatchSearch({ type: 'SET_CENTER_REF', ref: {
                                  url: ref,
                                  source: 'Opplastet',
                                  title: `Referanse ${idx + 1}`,
                                }})}
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
                      ? selectedSceneShots.slice(0, 3).map((shot: CastingShot, shotIdx: number) => (
                          <Box
                            key={shot.id}
                            title={`Shot ${shotIdx + 1}: ${shot.shotType || 'Unknown'}`}
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
                      onClick={() => dispatchSearch({ type: 'OPEN' })}
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
                      onClick={() => dispatchSearch({ type: 'CLOSE' })}
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
                                  onClick={() => dispatchSearch({ type: 'DESELECT_FILM' })}
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
                            <IconButton size="small" onClick={() => dispatchSearch({ type: 'CLOSE' })} sx={{ color: '#6b7280' }}>
                              <CloseIcon sx={{ fontSize: 20 }} />
                            </IconButton>
                          </Stack>
                          
                          {!selectedFilm && (
                            <>
                              <TextField
                                fullWidth
                                placeholder="Søk film: Blade Runner, Inception, cinematographer: Roger Deakins..."
                                value={referenceSearchQuery}
                                onChange={(e) => dispatchSearch({ type: 'SET_QUERY', query: e.target.value })}
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
                                    onClick={() => dispatchSearch({ type: 'SET_SOURCE', source: source.id as SearchSource })}
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
                                      dispatchSearch({ type: 'SET_QUERY', query: tag });
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
                                          dispatchSearch({ type: 'ADD_REF_AND_CLOSE', url: frame.url });
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
                                          dispatchSearch({ type: 'SET_CENTER_AND_CLOSE', ref: {
                                            url: frame.url,
                                            source: `${selectedFilm.title} (shot.cafe)`,
                                            title: selectedFilm.title,
                                          }});
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
                                              dispatchSearch({ type: 'ADD_REF_AND_CLOSE', url: img.url });
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
                                              dispatchSearch({ type: 'SET_CENTER_AND_CLOSE', ref: {
                                                url: img.url,
                                                source: img.source,
                                                title: `${img.source} Referanse`,
                                              }});
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
        onClose={() => dispatchWorkflow({ type: 'CLOSE_VIEW' })}
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
            <IconButton onClick={() => dispatchWorkflow({ type: 'CLOSE_VIEW' })} sx={{ color: '#9ca3af' }}>
              <CloseIcon />
            </IconButton>
          </Box>
          <Box sx={{ flex: 1, overflow: 'hidden' }}>
            <StripboardPanel
              projectId={projectId}
              onSceneSelect={(sceneId) => {
                const scene = scenes.find(s => s.id === sceneId);
                if (scene) scrollToScene(scene);
                dispatchWorkflow({ type: 'CLOSE_VIEW' });
              }}
              onGenerateCallSheet={(dayId) => {
                // Generate call sheet HTML for the specific day and store it
                const html = generateCallSheetHTML(buildCallSheetForDay(dayId), DEFAULT_CALL_SHEET_OPTIONS);
                const callSheetRef: CallSheetRef = {
                  id: `cs-${dayId}-${Date.now()}`,
                  shootingDayId: dayId,
                  html,
                  generatedAt: new Date().toISOString(),
                };
                dispatchWorkflow({ type: 'OPEN_CALL_SHEET', callSheet: callSheetRef });
              }}
            />
          </Box>
        </Box>
      </Dialog>

      {/* Shooting Day Planner Dialog */}
      <Dialog
        open={showShootingDayPlanner}
        onClose={() => dispatchWorkflow({ type: 'CLOSE_VIEW' })}
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
            <IconButton onClick={() => dispatchWorkflow({ type: 'CLOSE_VIEW' })} sx={{ color: '#9ca3af' }}>
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
                // Generate call sheet for the specific shooting day
                const html = generateCallSheetHTML(buildCallSheetForDay(dayId), DEFAULT_CALL_SHEET_OPTIONS);
                const callSheetRef: CallSheetRef = {
                  id: `cs-${dayId}-${Date.now()}`,
                  shootingDayId: dayId,
                  html,
                  generatedAt: new Date().toISOString(),
                };
                dispatchWorkflow({ type: 'OPEN_CALL_SHEET', callSheet: callSheetRef });
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
            dispatchWorkflow({ type: 'CLOSE_VIEW' });
            setIsLiveSetConnected(false);
          }}
        />
      )}

      {/* Live Set Day Selector Dialog - WORKFLOW GAP FIX #1 */}
      <Dialog
        open={showLiveSetDaySelector}
        onClose={() => dispatchWorkflow({ type: 'CLOSE_VIEW' })}
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
                  dispatchWorkflow({ type: 'SELECT_DAY_AND_GO_LIVE', dayId: day.id });
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
          <Button onClick={() => dispatchWorkflow({ type: 'CLOSE_VIEW' })} sx={{ color: '#9ca3af' }}>
            Avbryt
          </Button>
        </DialogActions>
      </Dialog>

      {/* Call Sheet Preview Dialog */}
      <Dialog
        open={showCallSheetPreview}
        onClose={() => dispatchWorkflow({ type: 'CLOSE_MODAL' })}
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
          <IconButton onClick={() => dispatchWorkflow({ type: 'CLOSE_MODAL' })} sx={{ color: '#4a4a4a' }}>
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
              const candidatePhoto = candidate.photos?.[0];

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
                      {candidatePhoto ? (
                        <img
                          src={candidatePhoto}
                          alt={candidate.name}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            objectPosition: getCandidatePhotoObjectPosition(candidate, 0),
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
                Gå til Auditions i The Role Room for å bekrefte kandidater
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
          {selectedScene && (
            <GlobalMentionHelper
              text={quickNotes[selectedScene.id] || ''}
              localCandidates={productionMentionCandidates}
              autoTagTitle="Auto-tagget i produksjonsnotat"
              suggestionTitle="Mener du?"
              onApplySuggestion={(name) =>
                handleQuickNoteChange(
                  selectedScene.id,
                  applyMentionSuggestion(quickNotes[selectedScene.id], name),
                )
              }
            />
          )}
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
        open={batchMode && selectedMapSize(selectedScenes) > 0}
        onClose={() => { setBatchMode(false); setSelectedScenes(EMPTY_SELECTION); }}
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
          Scene Tags & Filters ({selectedMapSize(selectedScenes)} selected)
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
              {/* Per-scene tag management for selected scenes */}
              {selectedMapIds(selectedScenes).slice(0, 3).map(sceneId => {
                const scene = scenes.find(s => s.id === sceneId);
                const tags = sceneTags[sceneId] || [];
                return (
                  <Box key={sceneId} sx={{ mb: 1.5, p: 1.5, borderRadius: 1, bgcolor: '#0f1318', border: '1px solid #2a3142' }}>
                    <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#60a5fa', mb: 0.75 }}>
                      Scene {scene?.sceneNumber || sceneId}
                    </Typography>
                    <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap' }}>
                      {tags.map(tag => (
                        <Chip
                          key={tag}
                          label={tag}
                          size="small"
                          onDelete={() => handleRemoveTag(sceneId, tag)}
                          sx={{ height: 22, fontSize: 10, bgcolor: 'rgba(139,92,246,0.2)', color: '#c4b5fd', '& .MuiChip-deleteIcon': { fontSize: 14, color: '#a78bfa' } }}
                        />
                      ))}
                      <Chip
                        label="+ Tag"
                        size="small"
                        onClick={() => {
                          const tag = window.prompt('Enter tag name:');
                          if (tag) handleAddTag(sceneId, tag);
                        }}
                        sx={{ height: 22, fontSize: 10, bgcolor: 'rgba(59,130,246,0.15)', color: '#60a5fa', cursor: 'pointer', '&:hover': { bgcolor: 'rgba(59,130,246,0.3)' } }}
                      />
                    </Stack>
                  </Box>
                );
              })}
              {/* Global tag filter chips */}
              <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
                {allTags.map(tag => (
                  <Chip
                    key={tag}
                    label={tag}
                    onClick={() => {
                      setSelectedTags(prev => {
                        const next = new Set(prev);
                        if (next.has(tag)) {
                          next.delete(tag);
                        } else {
                          next.add(tag);
                        }
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
                    checked={filters.missing.cam}
                    onChange={(e) => setFilters(p => ({ ...p, missing: { ...p.missing, cam: e.target.checked } }))}
                    sx={{ color: '#3b82f6' }}
                  />
                  <Typography sx={{ fontSize: 13, color: '#e5e7eb' }}>Missing Camera Equipment</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Checkbox
                    checked={filters.missing.light}
                    onChange={(e) => setFilters(p => ({ ...p, missing: { ...p.missing, light: e.target.checked } }))}
                    sx={{ color: '#3b82f6' }}
                  />
                  <Typography sx={{ fontSize: 13, color: '#e5e7eb' }}>Missing Lighting</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Checkbox
                    checked={filters.missing.sound}
                    onChange={(e) => setFilters(p => ({ ...p, missing: { ...p.missing, sound: e.target.checked } }))}
                    sx={{ color: '#3b82f6' }}
                  />
                  <Typography sx={{ fontSize: 13, color: '#e5e7eb' }}>Missing Audio Equipment</Typography>
                </Box>
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { setBatchMode(false); setSelectedScenes(EMPTY_SELECTION); }} sx={{ color: '#9ca3af' }}>
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

      {/* Add Shot Dialog — extracted FSM component */}
      <AddShotDialog
        open={addShotState.open}
        onClose={() => addShotDispatch({ type: 'CLOSE' })}
        sceneNumber={toSceneNumber(selectedScene?.sceneNumber)}
        onCreateShot={handleCreateShot}
        onSearch={handleSearchReferenceShots}
        storyboardCandidates={selectedSceneStoryboardCandidates}
      />

      <SceneStoryboardDialog
        open={Boolean(sceneStoryboardDialog)}
        scene={
          sceneStoryboardDialog
            ? (selectedScene?.id === sceneStoryboardDialog.sceneId
                ? selectedScene
                : scenes.find((entry) => entry.id === sceneStoryboardDialog.sceneId) || null)
            : null
        }
        projectId={projectId}
        activeFrameIndex={sceneStoryboardDialog?.activeFrameIndex}
        onClose={() => setSceneStoryboardDialog(null)}
        onSceneUpdate={(scene) => {
          void handleSceneStoryboardUpdate(scene);
        }}
      />

      <Dialog
        open={Boolean(shotStoryboardDialog && selectedScene && selectedShot)}
        onClose={() => setShotStoryboardDialog(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#111827',
            border: '1px solid #1f2937',
          },
        }}
      >
        <DialogTitle sx={{ color: '#fff', borderBottom: '1px solid #1f2937' }}>
          Koble shot til storyboard
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {selectedSceneStoryboardCandidates.length === 0 ? (
            <Alert severity="info" sx={{ bgcolor: 'rgba(59,130,246,0.12)', color: '#bfdbfe' }}>
              Scenen har ingen storyboard frames eller scene-matchede bibliotekselementer ennå.
            </Alert>
          ) : (
            <Stack spacing={1.25}>
              {selectedSceneStoryboardCandidates.map((candidate: StoryboardSeedCandidate) => {
                const selected = shotStoryboardDialog?.selectedCandidateId === candidate.id;
                return (
                  <Box
                    key={candidate.id}
                    onClick={() => setShotStoryboardDialog((current) => (
                      current ? { ...current, selectedCandidateId: candidate.id } : current
                    ))}
                    sx={{
                      p: 1.5,
                      borderRadius: 1.5,
                      cursor: 'pointer',
                      border: selected ? '1px solid #3b82f6' : '1px solid #253046',
                      bgcolor: selected ? 'rgba(59,130,246,0.12)' : 'rgba(15,23,42,0.82)',
                    }}
                  >
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                      <Box
                        sx={{
                          width: { xs: '100%', sm: 120 },
                          minWidth: { sm: 120 },
                          height: 74,
                          borderRadius: 1,
                          overflow: 'hidden',
                          bgcolor: '#020617',
                          border: '1px solid rgba(255,255,255,0.06)',
                        }}
                      >
                        {candidate.thumbnailUrl || candidate.imageUrl ? (
                          <Box
                            component="img"
                            src={candidate.thumbnailUrl || candidate.imageUrl}
                            alt={candidate.title}
                            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : null}
                      </Box>
                      <Stack spacing={0.75} sx={{ minWidth: 0, flex: 1 }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
                          {candidate.title}
                        </Typography>
                        <Typography sx={{ fontSize: 12, color: '#9ca3af' }}>
                          {candidate.description}
                        </Typography>
                        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                          <Chip size="small" label={candidate.sourceLabel} sx={{ bgcolor: 'rgba(16,185,129,0.14)', color: '#6ee7b7' }} />
                          <Chip size="small" label={candidate.shotType || 'Medium'} sx={{ bgcolor: 'rgba(59,130,246,0.14)', color: '#93c5fd' }} />
                          {candidate.cameraAngle && (
                            <Chip size="small" label={candidate.cameraAngle} sx={{ bgcolor: 'rgba(148,163,184,0.14)', color: '#cbd5e1' }} />
                          )}
                        </Stack>
                      </Stack>
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setShotStoryboardDialog(null)} sx={{ color: '#9ca3af' }}>
            Lukk
          </Button>
          <Button
            onClick={() => { void handleConfirmSelectedShotStoryboardLink(); }}
            variant="contained"
            disabled={!shotStoryboardDialog?.selectedCandidateId}
            sx={{ bgcolor: '#2563eb', '&:hover': { bgcolor: '#1d4ed8' } }}
          >
            Koble til frame
          </Button>
        </DialogActions>
      </Dialog>

      {/* ============================================ */}
      {/* WORKFLOW GAP FIX #2: Scene Needs Dialog */}
      {/* ============================================ */}
      <Dialog
        open={showSceneNeedsDialog}
        onClose={() => {
          dispatchWorkflow({ type: 'CLOSE_MODAL' });
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
          <Button onClick={() => dispatchWorkflow({ type: 'CLOSE_MODAL' })} sx={{ color: '#9ca3af' }}>
            Lukk
          </Button>
        </DialogActions>
      </Dialog>

      {/* ============================================ */}
      {/* WORKFLOW GAP FIX #3: Schedule Scene to Stripboard Dialog */}
      {/* ============================================ */}
      <Dialog
        open={showScheduleSceneDialog}
        onClose={() => dispatchWorkflow({ type: 'CLOSE_MODAL' })}
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
          {sceneToScheduleId && (() => {
            const sceneToSchedule = scenes.find(s => s.id === sceneToScheduleId);
            if (!sceneToSchedule) return null;
            return (
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
            );
          })()}
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #2a3142' }}>
          <Button onClick={() => dispatchWorkflow({ type: 'CLOSE_MODAL' })} sx={{ color: '#9ca3af' }}>
            Avbryt
          </Button>
        </DialogActions>
      </Dialog>

      {/* ============================================ */}
      {/* WORKFLOW GAP FIX #4: Pre-Production Checklist Dialog */}
      {/* ============================================ */}
      <Dialog
        open={showChecklistDialog}
        onClose={() => dispatchWorkflow({ type: 'CLOSE_MODAL' })}
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
                      key as ChecklistKey,
                      !sceneChecklists[selectedScene.id]?.[key as ChecklistKey]
                    )}
                    sx={{
                      p: 1.5,
                      borderRadius: '10px',
                      bgcolor: sceneChecklists[selectedScene.id]?.[key as ChecklistKey]
                        ? `${color}15`
                        : 'rgba(255,255,255,0.03)',
                      border: sceneChecklists[selectedScene.id]?.[key as ChecklistKey]
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
                          color: sceneChecklists[selectedScene.id]?.[key as ChecklistKey] ? '#fff' : '#9ca3af',
                          textDecoration: sceneChecklists[selectedScene.id]?.[key as ChecklistKey] ? 'line-through' : 'none',
                        }}>
                          {label}
                        </Typography>
                      </Stack>
                      <Checkbox
                        checked={sceneChecklists[selectedScene.id]?.[key as ChecklistKey] || false}
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
          <Button onClick={() => dispatchWorkflow({ type: 'CLOSE_MODAL' })} sx={{ color: '#9ca3af' }}>
            Lukk
          </Button>
        </DialogActions>
      </Dialog>

      {/* ============================================ */}
      {/* WORKFLOW GAP FIX #7: Bulk Shot Generation Dialog */}
      {/* ============================================ */}
      <Dialog
        open={showBulkShotDialog}
        onClose={() => dispatchWorkflow({ type: 'CLOSE_MODAL' })}
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
                onClick={() => dispatchWorkflow({ type: 'SET_BULK_TEMPLATE', template: key })}
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
          <Button onClick={() => dispatchWorkflow({ type: 'CLOSE_MODAL' })} sx={{ color: '#9ca3af' }}>
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
        onClose={() => dispatchWorkflow({ type: 'CLOSE_MODAL' })}
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
          <Button onClick={() => dispatchWorkflow({ type: 'CLOSE_MODAL' })} sx={{ color: '#9ca3af' }}>
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
