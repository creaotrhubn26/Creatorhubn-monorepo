import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Card,
  CardContent,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemButton,
  Stack,
  Alert,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Badge,
  LinearProgress,
  Drawer,
  ToggleButtonGroup,
  ToggleButton,
  Slider,
  CircularProgress,
  Autocomplete,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

// Keep lazy component identities stable across renders.
const LazyScreenplayEditorWithNavigator = React.lazy(() => import('./ScreenplayEditorWithNavigator'));
const LazyScreenplayPDFExport = React.lazy(() => import('./ScreenplayPDFExport'));

// ===== 7-Tier Responsive System =====
type ScreenTier = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | '4k';

const getViewportWidth = (): number => (
  typeof window === 'undefined' ? 1280 : window.innerWidth
);

const getScreenTierForWidth = (width: number): ScreenTier => {
  if (width >= 2560) return '4k';
  if (width >= 1920) return 'xxl';
  if (width >= 1536) return 'xl';
  if (width >= 1200) return 'lg';
  if (width >= 900) return 'md';
  if (width >= 600) return 'sm';
  return 'xs';
};

const useScreenTier = (): { tier: ScreenTier; isMobile: boolean; isTablet: boolean; isDesktop: boolean; is4K: boolean } => {
  const [viewportWidth, setViewportWidth] = useState<number>(() => getViewportWidth());

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    let frameId: number | null = null;

    const syncViewportWidth = () => {
      const nextWidth = window.innerWidth;
      setViewportWidth((currentWidth) => (currentWidth === nextWidth ? currentWidth : nextWidth));
    };

    const handleResize = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      frameId = window.requestAnimationFrame(syncViewportWidth);
    };

    syncViewportWidth();
    window.addEventListener('resize', handleResize, { passive: true });

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const tier = useMemo(() => getScreenTierForWidth(viewportWidth), [viewportWidth]);

  return {
    tier,
    isMobile: tier === 'xs' || tier === 'sm',
    isTablet: tier === 'md',
    isDesktop: tier === 'lg' || tier === 'xl' || tier === 'xxl' || tier === '4k',
    is4K: tier === '4k',
  };
};

const stripHtmlTags = (value: string | undefined): string =>
  (value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

type ManuscriptCoverFocalPoint = { x: number; y: number };

const DEFAULT_MANUSCRIPT_COVER_FOCAL_POINT: ManuscriptCoverFocalPoint = { x: 50, y: 50 };

const clampCoverFocalPointValue = (value: number): number => Math.max(0, Math.min(100, value));
const normalizeProjectKey = (value: string | null | undefined): string => String(value || '').trim().toLowerCase();

const getManuscriptCoverFocalPoint = (manuscript: Manuscript | null | undefined): ManuscriptCoverFocalPoint => {
  const raw = manuscript?.coverFocalPoint;
  if (typeof raw !== 'object' || raw === null) {
    return DEFAULT_MANUSCRIPT_COVER_FOCAL_POINT;
  }
  const candidate = raw as Record<string, unknown>;
  const x = typeof candidate.x === 'number' ? candidate.x : DEFAULT_MANUSCRIPT_COVER_FOCAL_POINT.x;
  const y = typeof candidate.y === 'number' ? candidate.y : DEFAULT_MANUSCRIPT_COVER_FOCAL_POINT.y;
  return {
    x: clampCoverFocalPointValue(x),
    y: clampCoverFocalPointValue(y),
  };
};

const isExampleManuscriptProject = (manuscript: Manuscript): boolean => {
  const dynamicFlags = manuscript as Record<string, unknown>;
  if (typeof dynamicFlags.isExampleProject === 'boolean') {
    return dynamicFlags.isExampleProject;
  }
  if (typeof dynamicFlags.isDemo === 'boolean') {
    return dynamicFlags.isDemo;
  }

  const manuscriptId = normalizeProjectKey(manuscript.id);
  const projectId = normalizeProjectKey(manuscript.projectId);
  return (
    projectId === 'troll-project-2026' ||
    manuscriptId.startsWith('troll-demo-')
  );
};

const manuscriptBelongsToProject = (manuscript: Manuscript, projectId: string | null | undefined): boolean => {
  if (!projectId) return true;
  return normalizeProjectKey(manuscript.projectId) === normalizeProjectKey(projectId);
};

const EXAMPLE_PROJECT_NOTICE =
  'Dette er et eksempelprosjekt. Manuskriptet er fiktivt og brukes kun til demo/opplæring i The Role Room. Ikke publiser eller bruk innholdet kommersielt uten avklart rettighetsgrunnlag.';

const getResponsiveValues = (tier: ScreenTier) => {
  const values = {
    xs: {
      headerFontSize: '1rem',
      titleFontSize: '0.9rem',
      bodyFontSize: '0.75rem',
      captionFontSize: '0.65rem',
      buttonSize: 'small' as const,
      iconSize: 18,
      spacing: 1,
      cardSpacing: 1.5,
      padding: 1,
      headerPadding: 1.5,
      cardImageHeight: 120,
      chipSize: 'small' as const,
      tabFontSize: '0.7rem',
      tabPadding: '4px 8px',
      showTabLabels: false,
      stackDirection: 'column' as const,
      headerStackDirection: 'column' as const,
      cardGridSize: { xs: 12 } as Record<string, number>,
    },
    sm: {
      headerFontSize: '1.15rem',
      titleFontSize: '1rem',
      bodyFontSize: '0.8rem',
      captionFontSize: '0.7rem',
      buttonSize: 'small' as const,
      iconSize: 20,
      spacing: 1.5,
      cardSpacing: 2,
      padding: 1.5,
      headerPadding: 2,
      cardImageHeight: 140,
      chipSize: 'small' as const,
      tabFontSize: '0.75rem',
      tabPadding: '6px 10px',
      showTabLabels: true,
      stackDirection: 'row' as const,
      headerStackDirection: 'column' as const,
      cardGridSize: { xs: 12, sm: 6 } as Record<string, number>,
    },
    md: {
      headerFontSize: '1.25rem',
      titleFontSize: '1.1rem',
      bodyFontSize: '0.85rem',
      captionFontSize: '0.75rem',
      buttonSize: 'medium' as const,
      iconSize: 22,
      spacing: 2,
      cardSpacing: 2.5,
      padding: 2,
      headerPadding: 2,
      cardImageHeight: 160,
      chipSize: 'small' as const,
      tabFontSize: '0.8rem',
      tabPadding: '8px 12px',
      showTabLabels: true,
      stackDirection: 'row' as const,
      headerStackDirection: 'row' as const,
      cardGridSize: { xs: 12, sm: 6, md: 4 } as Record<string, number>,
    },
    lg: {
      headerFontSize: '1.4rem',
      titleFontSize: '1.1rem',
      bodyFontSize: '0.875rem',
      captionFontSize: '0.75rem',
      buttonSize: 'medium' as const,
      iconSize: 24,
      spacing: 2.5,
      cardSpacing: 3,
      padding: 2.5,
      headerPadding: 2,
      cardImageHeight: 180,
      chipSize: 'medium' as const,
      tabFontSize: '0.85rem',
      tabPadding: '8px 16px',
      showTabLabels: true,
      stackDirection: 'row' as const,
      headerStackDirection: 'row' as const,
      cardGridSize: { xs: 12, sm: 6, md: 4 } as Record<string, number>,
    },
    xl: {
      headerFontSize: '1.5rem',
      titleFontSize: '1.15rem',
      bodyFontSize: '0.9rem',
      captionFontSize: '0.8rem',
      buttonSize: 'medium' as const,
      iconSize: 26,
      spacing: 3,
      cardSpacing: 3,
      padding: 3,
      headerPadding: 2.5,
      cardImageHeight: 200,
      chipSize: 'medium' as const,
      tabFontSize: '0.875rem',
      tabPadding: '10px 18px',
      showTabLabels: true,
      stackDirection: 'row' as const,
      headerStackDirection: 'row' as const,
      cardGridSize: { xs: 12, sm: 6, md: 4, lg: 3 } as Record<string, number>,
    },
    xxl: {
      headerFontSize: '1.6rem',
      titleFontSize: '1.2rem',
      bodyFontSize: '0.95rem',
      captionFontSize: '0.85rem',
      buttonSize: 'large' as const,
      iconSize: 28,
      spacing: 3.5,
      cardSpacing: 3.5,
      padding: 3.5,
      headerPadding: 3,
      cardImageHeight: 220,
      chipSize: 'medium' as const,
      tabFontSize: '0.9rem',
      tabPadding: '10px 20px',
      showTabLabels: true,
      stackDirection: 'row' as const,
      headerStackDirection: 'row' as const,
      cardGridSize: { xs: 12, sm: 6, md: 4, lg: 3 } as Record<string, number>,
    },
    '4k': {
      headerFontSize: '1.75rem',
      titleFontSize: '1.3rem',
      bodyFontSize: '1rem',
      captionFontSize: '0.9rem',
      buttonSize: 'large' as const,
      iconSize: 32,
      spacing: 4,
      cardSpacing: 4,
      padding: 4,
      headerPadding: 3.5,
      cardImageHeight: 260,
      chipSize: 'medium' as const,
      tabFontSize: '1rem',
      tabPadding: '12px 24px',
      showTabLabels: true,
      stackDirection: 'row' as const,
      headerStackDirection: 'row' as const,
      cardGridSize: { xs: 12, sm: 6, md: 4, lg: 3 } as Record<string, number>,
    },
  };
  return values[tier];
};
const applyMentionSuggestion = (sourceText: string | undefined, name: string): string => {
  const current = typeof sourceText === 'string' ? sourceText : '';
  if (!current.trim()) return name;
  const replaced = current.replace(/([A-Za-zÆØÅæøå][A-Za-z0-9ÆØÅæøå'.-]*)$/u, name);
  return replaced !== current ? replaced : `${current.trimEnd()} ${name}`;
};
const AUTO_ROLE_SYNC_BLOCKLIST = new Set([
  'I',
  'IN',
  'INT',
  'INT.',
  'E',
  'EX',
  'EXT',
  'EXT.',
  'EST',
  'EST.',
  'I/E',
  'INT/EXT',
  'INT./EXT',
  'INT./EXT.',
  'INT/EXT.',
]);
const normalizeRoleNameFromScript = (value: string): string =>
  value.replace(/^@/, '').replace(/\s*\(.*\)\s*$/, '').trim();
const shouldAutoCreateRoleFromScript = (value: string): boolean => {
  const cleaned = normalizeRoleNameFromScript(value);
  if (!cleaned) return false;
  const upper = cleaned.toUpperCase();
  if (AUTO_ROLE_SYNC_BLOCKLIST.has(upper)) return false;
  return true;
};
const AUTO_LOCATION_SYNC_BLOCKLIST = new Set([
  ...AUTO_ROLE_SYNC_BLOCKLIST,
  'DAY',
  'NIGHT',
  'DAWN',
  'DUSK',
  'CONTINUOUS',
  'LATER',
  'MORNING',
  'EVENING',
  'SAME',
]);
const PARTIAL_TIME_OF_DAY_TOKENS = new Set([
  'D', 'DA', 'DAW', 'DAWN', 'DU', 'DUS', 'DUSK', 'DAY',
  'N', 'NI', 'NIG', 'NIGH', 'NIGHT',
  'M', 'MO', 'MOR', 'MORN', 'MORNI', 'MORNIN', 'MORNING',
  'E', 'EV', 'EVE', 'EVEN', 'EVENI', 'EVENIN', 'EVENING',
  'L', 'LA', 'LAT', 'LATE', 'LATER',
  'C', 'CO', 'CON', 'CONT', 'CONTI', 'CONTIN', 'CONTINU', 'CONTINUO', 'CONTINUOU', 'CONTINUOUS',
  'S', 'SA', 'SAM', 'SAME',
]);
const normalizeLocationNameFromScript = (value: string): string => {
  let cleaned = value.replace(/\s+/g, ' ').trim();
  const partialTimeMatch = cleaned.match(/^(.*?)(?:\s*-\s*([A-ZÆØÅ]+))$/u);
  if (partialTimeMatch) {
    const base = partialTimeMatch[1]?.trim() ?? '';
    const suffix = partialTimeMatch[2]?.trim().toUpperCase() ?? '';
    if (base && PARTIAL_TIME_OF_DAY_TOKENS.has(suffix)) {
      cleaned = base;
    }
  }
  cleaned = cleaned.replace(/^[–—:;,./\s-]+|[–—:;,./\s-]+$/g, '').trim();
  return cleaned;
};
const shouldAutoCreateLocationFromScript = (value: string): boolean => {
  const cleaned = normalizeLocationNameFromScript(value);
  if (!cleaned) return false;
  if (!/[A-Za-zÆØÅæøå]/.test(cleaned)) return false;
  const upper = cleaned.toUpperCase();
  if (AUTO_LOCATION_SYNC_BLOCKLIST.has(upper)) return false;
  return true;
};
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Description as DescriptionIcon,
  Movie as MovieIcon,
  Theaters as SceneIcon,
  FormatListNumbered as FormatListNumberedIcon,
  Person as PersonIcon,
  Chat as ChatIcon,
  History as HistoryIcon,
  Assessment as AssessmentIcon,
  Schedule as ScheduleIcon,
  Visibility as VisibilityIcon,
  Code as CodeIcon,
  Preview as PreviewIcon,
  AutoFixHigh as AutoFixHighIcon,
  MenuBook as MenuBookIcon,
  Timeline as TimelineIcon,
  DragIndicator as DragIcon,
  ViewModule as ViewModuleIcon,
  FileDownload as FileDownloadIcon,
  FileUpload as FileUploadIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import { LocationsIcon as LocationIcon } from './icons/CastingIcons';
import { TOUCH_TARGET_SIZE } from '../constants/accessibility';
import { useToast } from './ToastStack';
import type { Manuscript, SceneBreakdown, DialogueLine, ScriptRevision, Act, ManuscriptExport, Role, Location, Candidate } from '../models/casting';
import type { StoryLogicState } from '../services/storyLogicService';
import { manuscriptService } from '../services/manuscriptService';
import { RichTextEditor } from './RichTextEditor';
import { ScriptDiffViewer } from './ScriptDiffViewer';
import { TimelineView } from './TimelineView';
import { ProductionControlPanel } from './ProductionControlPanel';
import { DraggableSceneList } from './DraggableSceneList';
import { StoryboardIntegrationView } from './StoryboardIntegrationView';
import { ScriptStoryboardSplitView } from './ScriptStoryboardSplitView';
import { ImportManuscriptDialog } from './ImportManuscriptDialog';
import { ManuscriptTemplatePanel } from './ManuscriptTemplatePanel';
import useBrandingSettings from '../hooks/useBrandingSettings.ts';
import GlobalMentionHelper from './shared/GlobalMentionHelper';
import RoleRoomBrandMark from './shared/RoleRoomBrandMark';
import { manuscriptTemplateService } from '../services/manuscriptTemplateService';
import { castingService } from '../services/castingService';
import { characterProfileService, type CharacterProfile as StoredCharacterProfile } from '../services/characterProfileService';
import type { Template } from '../data/manuscriptTemplates';
import { MANUSCRIPT_SCAFFOLD_TEMPLATES } from '../data/manuscriptTemplates';
import {
  analyzeManuscriptForResume,
  isResumeBannerDismissed,
  dismissResumeBanner,
  type ResumeThread,
} from '../services/resumeAnalysisService';
import ResumeBanner from './ResumeBanner';
import AISuggestionsPanel from './AISuggestionsPanel';
import TakesPanel from './TakesPanel';
import SceneReadinessCard from './SceneReadinessCard';
import LiveSetWorkspace from '../live-set/LiveSetWorkspace';
import { generateSuggestions } from '../services/aiSuggestionsClient';
import { ProductionManuscriptView } from './ProductionManuscriptView';
import { ScriptStoryboardProvider } from '../contexts/ScriptStoryboardContext';
import type { StoryArcNavigationFocus } from '../utils/storyArcFocus';

interface ManuscriptPanelProps {
  projectId?: string;
  /** Cinema-format på prosjektnivå — propageres til Storyboard-editoren. */
  projectCinemaFormat?: '16:9' | '4:3' | '2.39:1' | '2.35:1' | '1.85:1' | '2.76:1' | '1:1' | '9:16';
  initialSceneId?: string;
  onManuscriptChange?: (manuscript: Manuscript) => void;
  storyLogicData?: StoryLogicState | null;
  headerLeftContent?: React.ReactNode;
  onStoryArcFocusChange?: (focus?: StoryArcNavigationFocus | null) => void;
  onUnsavedStateChange?: (hasUnsaved: boolean, reason?: string) => void;
}

type ManuscriptTabValue = 'editor' | 'acts' | 'scenes' | 'characters' | 'dialogue' | 'breakdown' | 'revisions' | 'timeline' | 'production' | 'productionview';

const isUnknownRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const buildSceneAutosaveSnapshot = (scene: SceneBreakdown) => {
  const storyboardFrames = Array.isArray(scene.storyboardFrames)
    ? (scene.storyboardFrames as Array<Record<string, unknown>>).map((frame) => {
        const drawingData = isUnknownRecord(frame.drawingData) ? frame.drawingData : undefined;
        return {
          id: frame.id,
          shotNumber: frame.shotNumber,
          description: frame.description,
          cameraAngle: frame.cameraAngle,
          movement: frame.movement,
          duration: frame.duration,
          notes: frame.notes,
          imageSource: frame.imageSource,
          updatedAt: frame.updatedAt,
          drawingUpdatedAt: drawingData?.updatedAt,
          scriptLineRange: frame.scriptLineRange,
          dialogueCharacter: frame.dialogueCharacter,
        };
      })
    : [];

  return {
    id: scene.id,
    heading: scene.sceneHeading,
    description: scene.description,
    storyboardFrames,
  };
};

const ManuscriptPanelComponent: React.FC<ManuscriptPanelProps> = ({
  projectId,
  projectCinemaFormat,
  initialSceneId,
  onManuscriptChange,
  storyLogicData,
  headerLeftContent,
  onStoryArcFocusChange,
  onUnsavedStateChange,
}) => {
  const { showToast, showSuccess, showError, showWarning, showInfo } = useToast();
  const branding = useBrandingSettings();
  const activeProjectId = projectId ?? '';
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // 7-tier responsive system
  const { tier, isMobile, isTablet: _isTablet, isDesktop, is4K } = useScreenTier();
  const responsive = getResponsiveValues(tier);

  const hasProjectContext = Boolean(projectId);
  
  // Dirty tracking to prevent circular saves and unnecessary re-renders
  const isDirtyRef = useRef(false);
  const lastSavedContentRef = useRef<string>('');
  const isInitialLoadRef = useRef(true);
  const scenesHashRef = useRef<string>('');
  const actsHashRef = useRef<string>('');
  const pendingContentRef = useRef<string>(''); // Track content changes without re-render
  const selectedManuscriptRef = useRef<Manuscript | null>(null);
  const autoSaveAbortControllerRef = useRef<AbortController | null>(null); // Prevent memory leaks
  const isMountedRef = useRef(true);
  const castingDataLoadTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingCastingDataLoadRef = useRef(false);
  const autoCreatedRoleNamesRef = useRef<Set<string>>(new Set());
  // Per-scene tidsstempel for siste AI-breakdown-trigger. Brukes til å
  // throttle auto-generering så raske scene-save'r ikke fyrer Claude i kø.
  const lastSuggestionTriggerRef = useRef<Map<string, number>>(new Map());
  const autoCreatedLocationNamesRef = useRef<Set<string>>(new Set());
  const autoCreatedToastTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Cleanup function to prevent memory leaks
  useEffect(() => {
    return () => {
      // Cancel any pending requests on unmount
      if (autoSaveAbortControllerRef.current) {
        autoSaveAbortControllerRef.current.abort();
      }
    };
  }, []);
  
  const [activeTab, setActiveTab] = useState<ManuscriptTabValue>('editor');
  const [manuscripts, setManuscripts] = useState<Manuscript[]>([]);
  const [selectedManuscript, setSelectedManuscript] = useState<Manuscript | null>(null);
  const [acts, setActs] = useState<Act[]>([]);
  const [scenes, setScenes] = useState<SceneBreakdown[]>([]);
  const [dialogueLines, setDialogueLines] = useState<DialogueLine[]>([]);
  const [revisions, setRevisions] = useState<ScriptRevision[]>([]);
  
  // Memoized scene-derived arrays to avoid recreating on every render
  const sceneCharactersMemo = useMemo(() => {
    return scenes.flatMap((scene) => scene.characters ?? []).filter((character, index, arr) => arr.indexOf(character) === index);
  }, [scenes]);

  const sceneLocationsMemo = useMemo(() => {
    const ids = scenes.map(s => s.locationId).filter((l): l is string => !!l);
    return ids.filter((l, i) => ids.indexOf(l) === i);
  }, [scenes]);
  const productionSceneOptions = useMemo(() => {
    return [...scenes].sort((left, right) => {
      const leftNumber = Number(left.sceneNumber);
      const rightNumber = Number(right.sceneNumber);
      const safeLeft = Number.isFinite(leftNumber) ? leftNumber : Number.MAX_SAFE_INTEGER;
      const safeRight = Number.isFinite(rightNumber) ? rightNumber : Number.MAX_SAFE_INTEGER;
      if (safeLeft !== safeRight) return safeLeft - safeRight;
      return String(left.sceneHeading || left.heading || left.locationName || '').localeCompare(
        String(right.sceneHeading || right.heading || right.locationName || ''),
        'nb'
      );
    });
  }, [scenes]);
  const [isLoading, setIsLoading] = useState(false);
  const [manuscriptSaveStatus, setManuscriptSaveStatus] = useState<'saved' | 'unsaved' | 'saving' | 'error'>('saved');
  const [lastManuscriptSaved, setLastManuscriptSaved] = useState<Date | null>(null);
  const [_isOnline, setIsOnline] = useState(navigator.onLine);
  const [showNewManuscriptDialog, setShowNewManuscriptDialog] = useState(false);
  const [showSceneDialog, setShowSceneDialog] = useState(false);
  const [showLiveSetPro, setShowLiveSetPro] = useState(false);

  useEffect(() => {
    onUnsavedStateChange?.(
      manuscriptSaveStatus !== 'saved',
      manuscriptSaveStatus !== 'saved' ? 'manus' : undefined,
    );

    return () => {
      onUnsavedStateChange?.(false);
    };
  }, [manuscriptSaveStatus, onUnsavedStateChange]);
  const [editingScene, setEditingScene] = useState<SceneBreakdown | null>(null);
  const [sceneForm, setSceneForm] = useState({
    sceneNumber: '',
    sceneHeading: '',
    intExt: 'INT' as 'INT' | 'EXT' | 'INT/EXT',
    locationName: '',
    timeOfDay: 'DAY' as 'DAY' | 'NIGHT' | 'DAWN' | 'DUSK' | 'CONTINUOUS' | 'LATER' | 'MORNING' | 'EVENING',
    pageLength: '',
    description: '',
    status: 'not-scheduled',
    characters: [] as string[],
    sceneIntent: '',
    protagonistGoal: '',
  });
  const [autoBreakdownEnabled, setAutoBreakdownEnabled] = useState(true);
  
  // Casting integration states
  const [castingRoles, setCastingRoles] = useState<Role[]>([]);
  const [castingLocations, setCastingLocations] = useState<Location[]>([]);
  const [castingCandidates, setCastingCandidates] = useState<Candidate[]>([]);
  
  // New production control states
  const [selectedScene, setSelectedScene] = useState<SceneBreakdown | null>(null);
  const [selectedShot, setSelectedShot] = useState<string | null>(null);
  const [showProductionPanel, setShowProductionPanel] = useState(false);
  const [sceneViewMode, setSceneViewMode] = useState<'list' | 'drag' | 'storyboard'>('list');
  const [productionWorkspaceMode, setProductionWorkspaceMode] = useState<'storyboard' | 'split'>('storyboard');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showTemplatePanel, setShowTemplatePanel] = useState(false);

  // Resume banner — cold-start pattern #6. Dismissal is sticky per browser
  // session (sessionStorage) and keyed by manuscript id.
  const [resumeDismissedMap, setResumeDismissedMap] = useState<Record<string, boolean>>({});
  // Scene-IDer som er markert via en resume-thread-action. Brukes til å
  // tegne en visuell ramme i scenes/production-listen så brukeren faktisk
  // ser hvilke scener threaden refererer til. Tømmes når brukeren bytter
  // manuskript eller åpner en scene (klikket = beskjed mottatt).
  const [highlightedSceneIds, setHighlightedSceneIds] = useState<Set<string>>(() => new Set());
  const highlightClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!selectedManuscript) return;
    if (resumeDismissedMap[selectedManuscript.id] === undefined) {
      setResumeDismissedMap((prev) => ({
        ...prev,
        [selectedManuscript.id]: isResumeBannerDismissed(selectedManuscript.id),
      }));
    }
  }, [selectedManuscript, resumeDismissedMap]);

  const resumeAnalysis = useMemo(() => {
    if (!selectedManuscript || scenes.length === 0) return null;
    return analyzeManuscriptForResume(selectedManuscript, scenes);
  }, [selectedManuscript, scenes]);

  const handleResumeAction = useCallback(
    (thread: ResumeThread) => {
      // Marker alle scenene threaden refererer til. Sletter ramme automatisk
      // etter 8 sekunder så den ikke blir permanent støy.
      const idsToHighlight = thread.sceneIds && thread.sceneIds.length > 0
        ? new Set(thread.sceneIds)
        : thread.sceneId
          ? new Set([thread.sceneId])
          : new Set<string>();
      if (idsToHighlight.size > 0) {
        setHighlightedSceneIds(idsToHighlight);
        if (highlightClearTimerRef.current) {
          clearTimeout(highlightClearTimerRef.current);
        }
        highlightClearTimerRef.current = setTimeout(() => {
          setHighlightedSceneIds(new Set());
        }, 8000);
      }

      const targetSceneId = thread.sceneId;
      if (targetSceneId) {
        const scene = scenes.find((s) => s.id === targetSceneId);
        if (scene) setSelectedScene(scene);
      }
      if (thread.type === 'unscheduled') {
        setActiveTab('production');
      } else {
        setActiveTab('scenes');
      }
    },
    [scenes],
  );

  const handleResumeDismiss = useCallback(() => {
    if (!selectedManuscript) return;
    dismissResumeBanner(selectedManuscript.id);
    setResumeDismissedMap((prev) => ({ ...prev, [selectedManuscript.id]: true }));
  }, [selectedManuscript]);

  // Rydd highlight når brukeren skifter manuskript — kontekst er ny.
  useEffect(() => {
    setHighlightedSceneIds(new Set());
    if (highlightClearTimerRef.current) {
      clearTimeout(highlightClearTimerRef.current);
      highlightClearTimerRef.current = null;
    }
  }, [selectedManuscript?.id]);

  useEffect(() => {
    return () => {
      if (highlightClearTimerRef.current) {
        clearTimeout(highlightClearTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!initialSceneId || scenes.length === 0) {
      return;
    }
    const matchedScene = scenes.find((scene) => scene.id === initialSceneId) ?? null;
    if (!matchedScene) {
      return;
    }
    setSelectedScene((current) => (current?.id === matchedScene.id ? current : matchedScene));
    setActiveTab((current) => (current === 'editor' ? 'scenes' : current));
  }, [initialSceneId, scenes]);

  useEffect(() => {
    onStoryArcFocusChange?.(
      selectedScene
        ? { sceneId: selectedScene.id }
        : null,
    );
  }, [onStoryArcFocusChange, selectedScene]);

  // New manuscript form state
  const [newManuscript, setNewManuscript] = useState({
    title: '',
    subtitle: '',
    author: '',
    format: 'fountain' as 'fountain' | 'final-draft' | 'markdown',
    scaffoldTemplateId: 'blank' as string,
  });

  // Edit manuscript state
  const [showEditManuscriptDialog, setShowEditManuscriptDialog] = useState(false);
  const [editingManuscript, setEditingManuscript] = useState<Manuscript | null>(null);
  const [editManuscriptForm, setEditManuscriptForm] = useState({
    title: '',
    subtitle: '',
    author: '',
    status: 'draft' as string,
  });
  const [showExampleProjectDisclaimerDialog, setShowExampleProjectDisclaimerDialog] = useState(false);
  const [pendingExampleManuscript, setPendingExampleManuscript] = useState<Manuscript | null>(null);

  const editingCoverFocalPoint = useMemo(
    () => getManuscriptCoverFocalPoint(editingManuscript),
    [editingManuscript]
  );

  const setEditingCoverFocalPoint = useCallback((x: number, y: number) => {
    setEditingManuscript((current) => {
      if (!current) return current;
      return {
        ...current,
        coverFocalPoint: {
          x: clampCoverFocalPointValue(x),
          y: clampCoverFocalPointValue(y),
        },
      };
    });
  }, []);

  const handleEditCoverFocalPointClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!editingManuscript?.coverImage) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setEditingCoverFocalPoint(x, y);
  }, [editingManuscript?.coverImage, setEditingCoverFocalPoint]);

  // Load manuscripts on mount
  useEffect(() => {
    if (!projectId) {
      setManuscripts([]);
      setSelectedManuscript(null);
      setActs([]);
      setScenes([]);
      setDialogueLines([]);
      setRevisions([]);
      selectedManuscriptRef.current = null;
      lastSavedContentRef.current = '';
      pendingContentRef.current = '';
      isDirtyRef.current = false;
      isInitialLoadRef.current = true;
      return;
    }
    setSelectedManuscript(null);
    setActs([]);
    setScenes([]);
    setDialogueLines([]);
    setRevisions([]);
    selectedManuscriptRef.current = null;
    lastSavedContentRef.current = '';
    pendingContentRef.current = '';
    isDirtyRef.current = false;
    isInitialLoadRef.current = true;
    void loadManuscripts();
    void loadCastingData();
  }, [projectId]);

  // Load casting roles and locations for autocomplete
  const loadCastingData = async () => {
    if (!projectId) {
      if (isMountedRef.current) {
        setCastingRoles([]);
        setCastingLocations([]);
        setCastingCandidates([]);
      }
      return;
    }
    try {
      const [roles, locations, candidates] = await Promise.all([
        castingService.getRoles(projectId),
        castingService.getLocations(projectId),
        castingService.getCandidates(projectId),
      ]);
      if (isMountedRef.current) {
        setCastingRoles(roles);
        setCastingLocations(locations);
        setCastingCandidates(candidates);
        console.log(`Loaded ${roles.length} casting roles, ${locations.length} locations and ${candidates.length} candidates for autocomplete`);
      }
    } catch (error) {
      console.error('Could not load casting data for autocomplete:', error);
      // Non-critical error, don't show toast
    }
  };

  // Debounced wrapper for loadCastingData to batch multiple rapid calls
  const scheduleLoadCastingData = useCallback(() => {
    pendingCastingDataLoadRef.current = true;
    
    // Clear existing timer
    if (castingDataLoadTimerRef.current) {
      clearTimeout(castingDataLoadTimerRef.current);
    }
    
    // Debounce: wait 1000ms for all role/location creations to complete
    castingDataLoadTimerRef.current = setTimeout(() => {
      if (!isMountedRef.current || !pendingCastingDataLoadRef.current) return;
      pendingCastingDataLoadRef.current = false;
      loadCastingData();
    }, 1000);
  }, []);

  const loadManuscripts = async () => {
    setIsLoading(true);
    try {
      const response = await manuscriptService.getManuscripts(activeProjectId);
      const manuscriptsForProject = response.filter((manuscript) => manuscriptBelongsToProject(manuscript, activeProjectId));
      setManuscripts(manuscriptsForProject);
      setSelectedManuscript((currentSelection) => {
        if (currentSelection) {
          const matchingSelection = manuscriptsForProject.find((manuscript) => manuscript.id === currentSelection.id);
          if (matchingSelection) {
            return matchingSelection;
          }
        }
        return manuscriptsForProject[0] ?? null;
      });
      showToast({
        severity: 'info',
        message: `Manuskripter lastet (${manuscriptsForProject.length})`,
        duration: 2800,
      });
    } catch (error) {
      showError('Feil ved lasting av manuskripter');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadScenes = async (manuscriptId: string) => {
    try {
      const response = await manuscriptService.getScenes(manuscriptId);
      setScenes(response);
    } catch (error) {
      showError('Feil ved lasting av scener');
      console.error(error);
    }
  };

  const loadActs = async (manuscriptId: string) => {
    try {
      const response = await manuscriptService.getActs(manuscriptId);
      setActs(response);
    } catch (error) {
      showError('Feil ved lasting av akter');
      console.error(error);
    }
  };

  const loadDialogue = async (manuscriptId: string) => {
    try {
      const response = await manuscriptService.getDialogue(manuscriptId);
      setDialogueLines(response);
    } catch (error) {
      showError('Feil ved lasting av dialog');
      console.error(error);
    }
  };

  const loadRevisions = async (manuscriptId: string) => {
    try {
      const response = await manuscriptService.getRevisions(manuscriptId);
      setRevisions(response);
    } catch (error) {
      showError('Feil ved lasting av revisjoner');
      console.error(error);
    }
  };

  const openManuscriptWorkspace = (manuscript: Manuscript): void => {
    setSelectedManuscript(manuscript);
  };

  const closeExampleProjectDisclaimerDialog = (): void => {
    setShowExampleProjectDisclaimerDialog(false);
    setPendingExampleManuscript(null);
  };

  const confirmOpenExampleProject = (): void => {
    if (pendingExampleManuscript) {
      openManuscriptWorkspace(pendingExampleManuscript);
    }
    closeExampleProjectDisclaimerDialog();
  };

  const requestOpenManuscript = (manuscript: Manuscript): void => {
    if (isExampleManuscriptProject(manuscript)) {
      setPendingExampleManuscript(manuscript);
      setShowExampleProjectDisclaimerDialog(true);
      return;
    }
    openManuscriptWorkspace(manuscript);
  };

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showSuccess('Tilkoblet nettverk');
    };
    const handleOffline = () => {
      setIsOnline(false);
      showWarning('Frakoblet - arbeider i offline-modus');
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [showSuccess, showWarning]);

  // Initialize refs when manuscript is selected (no auto-save here, it's handled in handleEditorContentChange)
  useEffect(() => {
    if (!selectedManuscript) {
      setScenes([]);
      setActs([]);
      setDialogueLines([]);
      setRevisions([]);
      selectedManuscriptRef.current = null;
      return;
    }
    
    // Always initialize refs when manuscript changes
    selectedManuscriptRef.current = selectedManuscript;
    lastSavedContentRef.current = selectedManuscript.content || '';
    pendingContentRef.current = selectedManuscript.content || '';
    isDirtyRef.current = false;
    isInitialLoadRef.current = false;
    setManuscriptSaveStatus('saved');
    setLastManuscriptSaved(
      selectedManuscript.updatedAt ? new Date(selectedManuscript.updatedAt) : new Date()
    );

    const manuscriptId = selectedManuscript.id;
    void loadScenes(manuscriptId);
    void loadActs(manuscriptId);
    void loadDialogue(manuscriptId);
    void loadRevisions(manuscriptId);
    
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [selectedManuscript?.id]);

  useEffect(() => {
    setSelectedShot(null);
  }, [selectedScene?.id]);

  // Auto-save scenes when scenes array content actually changes
  useEffect(() => {
    if (scenes.length === 0) return;
    
    // Create a hash of scene content to detect actual changes
    const currentHash = JSON.stringify(scenes.map(buildSceneAutosaveSnapshot));
    
    // Skip if content hasn't changed (prevents saves on reference changes)
    if (currentHash === scenesHashRef.current) {
      return;
    }
    
    // Skip initial load
    if (scenesHashRef.current === '') {
      scenesHashRef.current = currentHash;
      return;
    }
    
    scenesHashRef.current = currentHash;
    
    const saveScenes = async () => {
      try {
        // Save only modified scenes (batch update)
        await Promise.all(scenes.map(scene => manuscriptService.saveScene(scene)));
        console.log('✓ Scener auto-lagret:', scenes.length);
      } catch (error) {
        console.error('Error saving scenes:', error);
      }
    };
    
    const timer = setTimeout(saveScenes, 2000);
    return () => clearTimeout(timer);
  }, [scenes]);

  // Auto-save acts when acts array content actually changes
  useEffect(() => {
    if (acts.length === 0) return;
    
    // Create a hash of act content to detect actual changes
    const currentHash = JSON.stringify(acts.map(a => ({ id: a.id, title: a.title, description: a.description })));
    
    // Skip if content hasn't changed
    if (currentHash === actsHashRef.current) {
      return;
    }
    
    // Skip initial load
    if (actsHashRef.current === '') {
      actsHashRef.current = currentHash;
      return;
    }
    
    actsHashRef.current = currentHash;
    
    const saveActs = async () => {
      try {
        await Promise.all(acts.map(act => manuscriptService.updateAct(act)));
        console.log('✓ Akter auto-lagret:', acts.length);
      } catch (error) {
        console.error('Error saving acts:', error);
      }
    };
    
    const timer = setTimeout(saveActs, 2000);
    return () => clearTimeout(timer);
  }, [acts]);

  const handleCreateManuscript = async () => {
    if (!newManuscript.title.trim()) {
      showWarning('Vennligst fyll inn tittel');
      return;
    }

    try {
      const manuscript: Manuscript = {
        id: `manuscript-${Date.now()}`,
        projectId: activeProjectId,
        title: newManuscript.title,
        subtitle: newManuscript.subtitle,
        author: newManuscript.author,
        version: '1.0',
        format: newManuscript.format,
        content: '',
        pageCount: 0,
        wordCount: 0,
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Create manuscript via API
      const createdManuscript = await manuscriptService.createManuscript(manuscript);

      setManuscripts([...manuscripts, createdManuscript]);
      setSelectedManuscript(createdManuscript);

      // Apply scaffold template — creates empty scene slots with structural
      // intent pre-filled, never content. See ai-prinsipper.md cold-start #2.
      const selectedTemplate = MANUSCRIPT_SCAFFOLD_TEMPLATES.find(
        (t) => t.id === newManuscript.scaffoldTemplateId,
      );
      if (selectedTemplate && selectedTemplate.beats.length > 0) {
        const now = new Date().toISOString();
        const scaffoldScenes: SceneBreakdown[] = selectedTemplate.beats.map((beat, index) => ({
          id: `scene-${createdManuscript.id}-${index + 1}-${Date.now()}`,
          manuscriptId: createdManuscript.id,
          projectId: activeProjectId,
          sceneNumber: index + 1,
          sceneHeading: '',
          heading: '',
          intExt: beat.suggestedIntExt,
          locationName: '',
          timeOfDay: beat.suggestedTimeOfDay,
          description: '',
          status: 'not-scheduled',
          characters: [],
          propsNeeded: [],
          metadata: {
            beatName: beat.beatName,
            sceneIntent: beat.sceneIntent,
            scaffoldTemplateId: selectedTemplate.id,
          },
          createdAt: now,
          updatedAt: now,
        }));
        setScenes(scaffoldScenes);
        // Best-effort persist; UI already shows scaffold optimistically.
        Promise.allSettled(
          scaffoldScenes.map((scene) => manuscriptService.saveScene(scene)),
        ).catch((err) => console.error('Scaffold-scene-persistering feilet delvis', err));
      }

      setShowNewManuscriptDialog(false);
      setNewManuscript({
        title: '',
        subtitle: '',
        author: '',
        format: 'fountain',
        scaffoldTemplateId: 'blank',
      });
      showSuccess(
        selectedTemplate && selectedTemplate.beats.length > 0
          ? `Manuskript opprettet med ${selectedTemplate.beats.length} scene-slot fra "${selectedTemplate.name}"`
          : 'Manuskript opprettet',
      );

      if (onManuscriptChange) {
        onManuscriptChange(createdManuscript);
      }
    } catch (error) {
      showError('Feil ved opprettelse av manuskript');
      console.error(error);
    }
  };

  const handleSaveManuscript = async () => {
    if (!selectedManuscript) return;

    try {
      setManuscriptSaveStatus('saving');
      const persistedTimestamp = new Date().toISOString();
      const contentToPersist = isDirtyRef.current
        ? pendingContentRef.current
        : selectedManuscript.content;
      const manuscriptToPersist: Manuscript = {
        ...selectedManuscript,
        content: contentToPersist,
        updatedAt: persistedTimestamp,
      };
      await manuscriptService.updateManuscript(manuscriptToPersist);
      setSelectedManuscript(manuscriptToPersist);
      setManuscripts((current) =>
        current.map((entry) => (entry.id === manuscriptToPersist.id ? manuscriptToPersist : entry))
      );
      lastSavedContentRef.current = contentToPersist;
      pendingContentRef.current = contentToPersist;
      isDirtyRef.current = false;
      setLastManuscriptSaved(new Date(persistedTimestamp));
      setManuscriptSaveStatus('saved');
      
      showSuccess('Manuskript lagret');
      
      if (onManuscriptChange) {
        onManuscriptChange(manuscriptToPersist);
      }
    } catch (error) {
      setManuscriptSaveStatus('error');
      showError('Feil ved lagring av manuskript');
      console.error(error);
    }
  };

  const handleAutoBreakdown = async () => {
    if (!selectedManuscript) return;
    if (!autoBreakdownEnabled) {
      showWarning('Auto Breakdown er slått av. Aktiver bryteren for å kjøre.');
      return;
    }

    setIsLoading(true);
    try {
      // Parse manuscript content and auto-generate scene breakdowns
      const content = selectedManuscript.content || '';
      const lines = content.split('\n');
      const autoScenes: SceneBreakdown[] = [];
      const autoDialogue: DialogueLine[] = [];
      
      let sceneNumber = 1;
      let currentScene: Partial<SceneBreakdown> | null = null;
      let currentCharacters: string[] = [];
      const validSceneTimesOfDay = ['DAY', 'NIGHT', 'DAWN', 'DUSK', 'CONTINUOUS', 'LATER', 'MORNING', 'EVENING'] as const;
      type SceneTimeOfDay = NonNullable<SceneBreakdown['timeOfDay']>;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Scene heading detection (INT. / EXT.)
        if (line.match(/^(INT\.|EXT\.)/i)) {
          // Save previous scene if exists
          if (currentScene) {
            autoScenes.push({
              ...currentScene,
              id: `scene-auto-${sceneNumber - 1}`,
              manuscriptId: selectedManuscript.id,
              sceneNumber: String(sceneNumber - 1),
              characters: currentCharacters,
              status: 'not-scheduled' as const,
            } as SceneBreakdown);
            currentCharacters = [];
          }

          // Parse new scene heading
          const parts = line.split('-').map(p => p.trim());
          const intExt = parts[0].startsWith('INT') ? 'INT' : 'EXT';
          const location = parts[0].replace(/^(INT\.|EXT\.)\s*/i, '');
          const timeRaw = parts[1] || 'DAY';
          const timeOfDay: SceneTimeOfDay =
            validSceneTimesOfDay.includes(timeRaw.toUpperCase() as SceneTimeOfDay)
              ? timeRaw.toUpperCase() as SceneTimeOfDay
              : 'DAY';

          currentScene = {
            sceneHeading: line,
            intExt,
            locationName: location,
            timeOfDay,
            estimatedDuration: 3,
          };
          sceneNumber++;
        }
        
        // Character name detection (ALL CAPS)
        else if (line === line.toUpperCase() && line.length > 0 && line.length < 30 && !line.match(/^(FADE|CUT)/)) {
          const characterName = line.replace(/\(.*\)/, '').trim();
          if (characterName && !currentCharacters.includes(characterName)) {
            currentCharacters.push(characterName);
          }
        }
        
        // Dialogue detection (after character name)
        else if (currentScene && line.length > 0 && i > 0) {
          const prevLine = lines[i - 1].trim();
          if (prevLine === prevLine.toUpperCase() && prevLine.length < 30) {
            const characterName = prevLine.replace(/\(.*\)/, '').trim();
            autoDialogue.push({
              id: `dialogue-auto-${autoDialogue.length + 1}`,
              sceneId: `scene-auto-${sceneNumber - 1}`,
              manuscriptId: selectedManuscript.id,
              characterName: characterName,
              dialogueText: line,
              dialogueType: 'dialogue' as const,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }

      // Save last scene
      if (currentScene) {
        autoScenes.push({
          ...currentScene,
          id: `scene-auto-${sceneNumber - 1}`,
          manuscriptId: selectedManuscript.id,
          sceneNumber: String(sceneNumber - 1),
          characters: currentCharacters,
          status: 'not-scheduled' as const,
        } as SceneBreakdown);
      }

      // Extract unique characters (will be computed from dialogue)
      const uniqueCharacters = Array.from(new Set(currentCharacters));

      // Update state
      setScenes(autoScenes);
      setDialogueLines(autoDialogue);
      
      showSuccess(`Automatisk breakdown fullført: ${autoScenes.length} scener, ${uniqueCharacters.length} karakterer funnet`);
    } catch (error) {
      showError('Feil ved automatisk breakdown');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    if (!selectedManuscript) return;

    try {
      const exportData = await manuscriptService.exportManuscriptAsJSON(
        selectedManuscript,
        acts,
        scenes,
        characterList,
        dialogueLines,
        revisions
      );

      manuscriptService.downloadExportAsFile(
        exportData,
        `${selectedManuscript.title.replace(/\s+/g, '_')}_export.json`
      );

      showSuccess('Manuskript eksportert som JSON');
    } catch (error) {
      showError('Feil ved eksport');
      console.error(error);
    }
  };

  const handleImportComplete = async (exportData: ManuscriptExport) => {
    try {
      const restored = await manuscriptService.restoreFromExport(exportData);

      // Update state with imported data
      setSelectedManuscript(restored.manuscript);
      setActs(restored.acts);
      setScenes(restored.scenes);
      setDialogueLines(restored.dialogueLines);
      setRevisions(restored.revisions);

      // Add to manuscripts list
      setManuscripts([
        ...manuscripts.filter(m => m.id !== restored.manuscript.id),
        restored.manuscript,
      ]);

      showSuccess('Manuskript importert og klar for bruk');
    } catch (error) {
      showError('Feil ved import');
      console.error(error);
    }
  };

  const handleApplyTemplate = (template: Template) => {
    if (!selectedManuscript) {
      // Create new manuscript from template
      const newManuscript: Manuscript = {
        id: `manuscript-${Date.now()}`,
        projectId: activeProjectId,
        title: template.name,
        subtitle: '',
        author: '',
        version: '1.0',
        format: 'fountain',
        content: template.content,
        pageCount: 0,
        wordCount: 0,
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      manuscriptService.createManuscript(newManuscript)
        .then(created => {
          setManuscripts([...manuscripts, created]);
          setSelectedManuscript(created);
          showSuccess(`Mal "${template.name}" brukt`);
        })
        .catch(() => showError('Feil ved bruk av mal'));
    } else {
      // Apply to existing manuscript
      const updatedContent = manuscriptTemplateService.applyTemplate(
        selectedManuscript.content,
        template
      );
      
      const updated = {
        ...selectedManuscript,
        content: updatedContent,
        updatedAt: new Date().toISOString()
      };
      
      setSelectedManuscript(updated);
      pendingContentRef.current = updatedContent;
      isDirtyRef.current = true;
      setManuscriptSaveStatus('unsaved');
      showSuccess(`Mal "${template.name}" satt inn`);
    }
  };
  const scheduleAutoCreatedEntitiesToast = useCallback(() => {
    if (autoCreatedToastTimerRef.current) {
      clearTimeout(autoCreatedToastTimerRef.current);
    }

    autoCreatedToastTimerRef.current = setTimeout(() => {
      const roleNames = Array.from(autoCreatedRoleNamesRef.current);
      const locationNames = Array.from(autoCreatedLocationNamesRef.current);
      if (roleNames.length === 0 && locationNames.length === 0) return;

      const messageParts: string[] = [];
      if (roleNames.length > 0) {
        messageParts.push(`Roller: ${roleNames.join(', ')}`);
      }
      if (locationNames.length > 0) {
        messageParts.push(`Lokasjoner: ${locationNames.join(', ')}`);
      }

      showSuccess(`Auto-opprettet fra manus. ${messageParts.join(' | ')}`);
      autoCreatedRoleNamesRef.current.clear();
      autoCreatedLocationNamesRef.current.clear();
      autoCreatedToastTimerRef.current = null;
    }, 550);
  }, [showSuccess]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      // Cancel any pending auto-saves
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      if (autoSaveAbortControllerRef.current) {
        autoSaveAbortControllerRef.current.abort();
      }
      // Cancel any pending casting data loads
      if (castingDataLoadTimerRef.current) {
        clearTimeout(castingDataLoadTimerRef.current);
      }
      if (autoCreatedToastTimerRef.current) {
        clearTimeout(autoCreatedToastTimerRef.current);
      }
    };
  }, []);

  // Memoized callbacks for character/location auto-creation
  const handleCharacterAdd = useCallback(async (name: string) => {
    // Auto-create a role in casting when new character is detected
    if (!projectId) return;
    if (!shouldAutoCreateRoleFromScript(name)) return;
    const normalizedName = normalizeRoleNameFromScript(name);
    if (!normalizedName) return;

    const existingRole = castingRoles.find(r => r.name.toUpperCase() === normalizedName.toUpperCase());
    if (existingRole) return; // Already exists
    
    try {
      const newRole: Role = {
        id: `role-${Date.now()}`,
        name: normalizedName,
        description: `Character from screenplay`,
        requirements: {},
        status: 'draft',
      };
      await castingService.saveRole(projectId, newRole);
      // Schedule casting data reload (debounced to batch multiple creations)
      scheduleLoadCastingData();
      autoCreatedRoleNamesRef.current.add(normalizedName);
      scheduleAutoCreatedEntitiesToast();
      console.log(`✓ Auto-created role "${normalizedName}" from screenplay`);
    } catch (error) {
      console.warn('Failed to auto-create role from screenplay:', error);
    }
  }, [projectId, castingRoles, scheduleAutoCreatedEntitiesToast]);

  const handleLocationAdd = useCallback(async (name: string) => {
    // Auto-create a location in casting when new location is detected
    if (!projectId) return;
    if (!shouldAutoCreateLocationFromScript(name)) return;
    const normalizedName = normalizeLocationNameFromScript(name);
    if (!normalizedName) return;

    const existingLoc = castingLocations.find(l => l.name.toUpperCase() === normalizedName.toUpperCase());
    if (existingLoc) return; // Already exists
    
    try {
      const newLocation: Location = {
        id: `location-${Date.now()}`,
        name: normalizedName,
        type: 'indoor', // Default
        address: '',
        notes: 'Location from screenplay',
        availability: {},
        assignedScenes: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await castingService.saveLocation(projectId, newLocation);
      // Schedule casting data reload (debounced to batch multiple creations)
      scheduleLoadCastingData();
      autoCreatedLocationNamesRef.current.add(normalizedName);
      scheduleAutoCreatedEntitiesToast();
      console.log(`✓ Auto-created location "${normalizedName}" from screenplay`);
    } catch (error) {
      console.warn('Failed to auto-create location from screenplay:', error);
    }
  }, [projectId, castingLocations, scheduleAutoCreatedEntitiesToast]);

  const handleSceneUpdateFromStoryboard = useCallback((updatedScene: SceneBreakdown) => {
    setScenes((current) =>
      current.map((scene) => (scene.id === updatedScene.id ? updatedScene : scene))
    );
    setSelectedScene(updatedScene);
  }, []);

  // Stable callback for editor content changes
  const handleEditorContentChange = useCallback((content: string) => {
    // Store in ref immediately (no re-render)
    pendingContentRef.current = content;
    isDirtyRef.current = true;
    setManuscriptSaveStatus((previous) => (previous === 'unsaved' ? previous : 'unsaved'));
    
    // Debounce the save to avoid constant saves while typing
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    
    autoSaveTimerRef.current = setTimeout(async () => {
      // Extra safety check: don't proceed if component unmounted
      if (!isMountedRef.current) return;
      
      const manuscript = selectedManuscriptRef.current;
      if (!manuscript || !isDirtyRef.current) return;
      
      const contentToSave = pendingContentRef.current;
      if (contentToSave === lastSavedContentRef.current) return;

      try {
        if (isMountedRef.current) {
          setManuscriptSaveStatus('saving');
        }
        // Create new abort controller for this save request
        autoSaveAbortControllerRef.current = new AbortController();
        
        // Save to database - DO NOT update selectedManuscript state to avoid re-render
        await manuscriptService.updateManuscript(
          {
            ...manuscript,
            content: contentToSave,
            updatedAt: new Date().toISOString(),
          },
          autoSaveAbortControllerRef.current.signal
        );
        
        // Only update refs if not aborted AND component still mounted
        if (!autoSaveAbortControllerRef.current?.signal.aborted && isMountedRef.current) {
          lastSavedContentRef.current = contentToSave;
          isDirtyRef.current = false;
          setLastManuscriptSaved(new Date());
          setManuscriptSaveStatus('saved');
          // IMPORTANT: Do NOT call onManuscriptChange or setSelectedManuscript here
          // Auto-save should be completely transparent to parent
        }
      } catch (error) {
        // Ignore abort errors (component unmounted)
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        console.error('❌ Error during manuscript auto-save:', error);
        if (isMountedRef.current) {
          setManuscriptSaveStatus('error');
        }
      }
    }, 2000);
  }, [selectedManuscript?.id]);

  const handleScriptChangeFromSplitView = useCallback((content: string) => {
    setSelectedManuscript((previous) => {
      if (!previous) return previous;
      const updated = { ...previous, content, updatedAt: new Date().toISOString() };
      setManuscripts((entries) =>
        entries.map((entry) => (entry.id === updated.id ? updated : entry))
      );
      return updated;
    });
    handleEditorContentChange(content);
  }, [handleEditorContentChange]);

  // Memoized handler for parsing screenplay content to scenes
  const handleParseToScenes = useCallback((content: string) => {
    if (!autoBreakdownEnabled) {
      showWarning('Auto Breakdown er deaktivert. Aktiver bryteren først.');
      return;
    }
    if (!selectedManuscript) {
      showWarning('Velg et manuskript først.');
      return;
    }
    // Parse Fountain content to create scenes
    const lines = content.split('\n');
    const newScenes: SceneBreakdown[] = [];
    let currentSceneData: {
      heading: string;
      intExt: string;
      location: string;
      timeOfDay: string;
      description: string;
      characters: string[];
      lineCount: number;
    } | null = null;
    
    const saveCurrentScene = () => {
      if (currentSceneData) {
        const scene: SceneBreakdown = {
          id: `scene-${newScenes.length + 1}`,
          manuscriptId: selectedManuscript.id,
          projectId: activeProjectId,
          sceneNumber: String(newScenes.length + 1),
          sceneHeading: currentSceneData.heading,
          intExt: currentSceneData.intExt as 'INT' | 'EXT' | 'INT/EXT',
          locationName: currentSceneData.location,
          timeOfDay: currentSceneData.timeOfDay as SceneBreakdown['timeOfDay'],
          description: currentSceneData.description.trim(),
          characters: [...new Set(currentSceneData.characters)],
          pageLength: Math.round(currentSceneData.lineCount / 55 * 10) / 10,
          status: 'not-scheduled',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        newScenes.push(scene);
      }
    };
    
    lines.forEach((line, lineIndex) => {
      const trimmed = line.trim();
      const sceneMatch = trimmed.match(/^(INT|EXT|EST|INT\.?\/EXT|I\/E)[.\s]+(.+?)(?:\s*-\s*(DAY|NIGHT|DAWN|DUSK|CONTINUOUS|LATER|MORNING|EVENING|SAME))?$/i);
      
      if (sceneMatch) {
        // Save previous scene
        saveCurrentScene();
        
        // Start new scene
        currentSceneData = {
          heading: trimmed,
          intExt: sceneMatch[1].toUpperCase().replace('.', '').replace('/', '/'),
          location: sceneMatch[2]?.trim() || '',
          timeOfDay: sceneMatch[3]?.toUpperCase() || 'DAY',
          description: '',
          characters: [],
          lineCount: 0,
        };
      } else if (currentSceneData) {
        currentSceneData.lineCount++;
        
        // Check for character names (all caps followed by dialogue)
        const characterMatch = trimmed.match(/^([A-ZÆØÅ][A-ZÆØÅ0-9\s\-'.]+)(\s*\(.*\))?$/);
        if (characterMatch && lines[lineIndex + 1]?.trim() && !lines[lineIndex + 1].trim().match(/^(INT|EXT)/i)) {
          const charName = characterMatch[1].replace(/\s*\(.*\)$/, '').trim();
          if (charName.length > 1 && charName.length < 40) {
            currentSceneData.characters.push(charName);
          }
        }
      }
    });
    
    // Save final scene
    saveCurrentScene();
    
    // Update scenes
    setScenes(newScenes);
    showSuccess(`Parsed ${newScenes.length} scenes from screenplay`);
  }, [activeProjectId, autoBreakdownEnabled, selectedManuscript, showSuccess, showWarning]);

  const handleDeleteManuscript = async (manuscript: Manuscript) => {
    if (!confirm(`Er du sikker på at du vil slette "${manuscript.title}"?`)) return;

    try {
      await manuscriptService.deleteManuscript(manuscript.id);
      
      setManuscripts(manuscripts.filter(m => m.id !== manuscript.id));
      if (selectedManuscript?.id === manuscript.id) {
        setSelectedManuscript(null);
      }
      showSuccess('Manuskript slettet');
    } catch (error) {
      showError('Feil ved sletting av manuskript');
      console.error(error);
    }
  };

  const _estimatedRuntime = useMemo(() => {
    if (!selectedManuscript) return 0;
    // Industry standard: 1 page ≈ 1 minute
    return selectedManuscript.pageCount;
  }, [selectedManuscript?.pageCount]);

  const characterList = useMemo(() => {
    // Extract unique characters from dialogue
    const characters = new Set<string>();
    dialogueLines.forEach(line => characters.add(line.characterName));
    return Array.from(characters).sort();
  }, [dialogueLines]);

  const sceneStats = useMemo(() => {
    const intScenes = scenes.filter(s => s.intExt === 'INT').length;
    const extScenes = scenes.filter(s => s.intExt === 'EXT').length;
    const dayScenes = scenes.filter(s => s.timeOfDay === 'DAY').length;
    const nightScenes = scenes.filter(s => s.timeOfDay === 'NIGHT').length;
    
    return { intScenes, extScenes, dayScenes, nightScenes, total: scenes.length };
  }, [scenes]);

  const nextSceneNumber = useMemo(() => {
    const numericValues = scenes
      .map((scene) => {
        if (typeof scene.sceneNumber === 'number') return scene.sceneNumber;
        const parsed = Number.parseInt(String(scene.sceneNumber ?? ''), 10);
        return Number.isFinite(parsed) ? parsed : null;
      })
      .filter((value): value is number => value !== null);
    const highest = numericValues.length > 0 ? Math.max(...numericValues) : scenes.length;
    return highest + 1;
  }, [scenes]);

  const closeSceneDialog = useCallback(() => {
    setShowSceneDialog(false);
    setEditingScene(null);
  }, []);

  const openCreateSceneDialog = useCallback(() => {
    setEditingScene(null);
    setShowSceneDialog(true);
  }, []);

  const openEditSceneDialog = useCallback((scene: SceneBreakdown) => {
    setEditingScene(scene);
    setShowSceneDialog(true);
  }, []);

  useEffect(() => {
    if (!showSceneDialog) return;

    if (editingScene) {
      const meta = editingScene.metadata as Record<string, unknown> | undefined;
      setSceneForm({
        sceneNumber: String(editingScene.sceneNumber ?? ''),
        sceneHeading: String(editingScene.sceneHeading ?? editingScene.heading ?? ''),
        intExt: (editingScene.intExt as 'INT' | 'EXT' | 'INT/EXT') || 'INT',
        locationName: String(editingScene.locationName ?? ''),
        timeOfDay: (editingScene.timeOfDay as 'DAY' | 'NIGHT' | 'DAWN' | 'DUSK' | 'CONTINUOUS' | 'LATER' | 'MORNING' | 'EVENING') || 'DAY',
        pageLength: typeof editingScene.pageLength === 'number' ? String(editingScene.pageLength) : '',
        description: String(editingScene.description ?? ''),
        status: String(editingScene.status ?? 'not-scheduled'),
        characters: Array.isArray(editingScene.characters) ? editingScene.characters : [],
        sceneIntent: typeof meta?.sceneIntent === 'string' ? meta.sceneIntent : '',
        protagonistGoal: typeof meta?.protagonistGoal === 'string' ? meta.protagonistGoal : '',
      });
      return;
    }

    setSceneForm({
      sceneNumber: String(nextSceneNumber),
      sceneHeading: '',
      intExt: 'INT',
      locationName: '',
      timeOfDay: 'DAY',
      pageLength: '',
      description: '',
      status: 'not-scheduled',
      characters: [],
      sceneIntent: '',
      protagonistGoal: '',
    });
  }, [editingScene, nextSceneNumber, showSceneDialog]);

  const handleSaveScene = async () => {
    if (!selectedManuscript) {
      showWarning('Velg et manuskript først');
      return;
    }

    const heading = sceneForm.sceneHeading.trim();
    if (!heading) {
      showWarning('Scene heading er påkrevd');
      return;
    }

    const now = new Date().toISOString();
    const parsedPageLength = Number.parseFloat(sceneForm.pageLength);
    const pageLength = Number.isFinite(parsedPageLength) ? parsedPageLength : undefined;

    const trimmedIntent = sceneForm.sceneIntent.trim();
    const trimmedGoal = sceneForm.protagonistGoal.trim();
    const baseMetadata = (editingScene?.metadata ?? {}) as Record<string, unknown>;
    const nextMetadata: Record<string, unknown> = { ...baseMetadata };
    if (trimmedIntent) nextMetadata.sceneIntent = trimmedIntent;
    else delete nextMetadata.sceneIntent;
    if (trimmedGoal) nextMetadata.protagonistGoal = trimmedGoal;
    else delete nextMetadata.protagonistGoal;

    const sceneToSave: SceneBreakdown = {
      ...(editingScene || {}),
      id: editingScene?.id ?? `scene-${Date.now()}`,
      manuscriptId: selectedManuscript.id,
      projectId: projectId || editingScene?.projectId,
      sceneNumber: sceneForm.sceneNumber.trim() || String(nextSceneNumber),
      sceneHeading: heading,
      heading,
      intExt: sceneForm.intExt,
      locationName: sceneForm.locationName.trim(),
      timeOfDay: sceneForm.timeOfDay,
      pageLength,
      description: sceneForm.description.trim(),
      status: sceneForm.status,
      characters: sceneForm.characters,
      propsNeeded: Array.isArray(editingScene?.propsNeeded) ? editingScene.propsNeeded : [],
      metadata: nextMetadata,
      createdAt: editingScene?.createdAt ?? now,
      updatedAt: now,
    };

    const previousScenes = scenes;
    const nextScenes = editingScene
      ? scenes.map((scene) => (scene.id === sceneToSave.id ? sceneToSave : scene))
      : [...scenes, sceneToSave];

    setScenes(nextScenes);
    if (!selectedScene || selectedScene.id === sceneToSave.id) {
      setSelectedScene(sceneToSave);
    }
    closeSceneDialog();

    try {
      const persistedScene = await manuscriptService.saveScene(sceneToSave);
      setScenes((current) =>
        current.map((scene) =>
          scene.id === sceneToSave.id
            ? { ...sceneToSave, ...persistedScene }
            : scene
        )
      );
      if (!selectedScene || selectedScene.id === sceneToSave.id) {
        setSelectedScene({ ...sceneToSave, ...persistedScene });
      }
      showSuccess(editingScene ? 'Scene oppdatert' : 'Scene opprettet');

      // Auto-trigger breakdown-agent når scene-tekst endres. Krav:
      //  - eksisterende scene (ikke første gang den opprettes)
      //  - beskrivelse er ikke tom
      //  - beskrivelsen har faktisk endret seg
      //  - sist trigger var > 30s siden (throttle per scene)
      // Fire-and-forget: brukeren ser forslag neste gang scenen åpnes.
      const persistedSceneId =
        (persistedScene as { id?: string } | undefined)?.id ?? sceneToSave.id;
      const prevDescription =
        typeof editingScene?.description === 'string' ? editingScene.description : '';
      const newDescription = sceneToSave.description ?? '';
      const descriptionChanged =
        prevDescription.trim() !== newDescription.trim() && newDescription.trim().length > 0;
      const lastTriggerAt =
        lastSuggestionTriggerRef.current.get(persistedSceneId) ?? 0;
      const throttleMs = 30_000;

      if (
        editingScene
        && activeProjectId
        && descriptionChanged
        && Date.now() - lastTriggerAt > throttleMs
      ) {
        lastSuggestionTriggerRef.current.set(persistedSceneId, Date.now());
        void generateSuggestions(activeProjectId, {
          agentName: 'breakdown-agent',
          sourceType: 'scene',
          sourceId: persistedSceneId,
          payload: {
            sceneText: newDescription,
            existingRoles: castingRoles.map((r) => ({ id: r.id, name: r.name })),
            existingProps: [],
            existingLocations: castingLocations.map((l) => ({ id: l.id, name: l.name })),
          },
        }).catch((err) => {
          // Stille feil — auto-trigger skal aldri forstyrre brukerflyten
          console.warn('[breakdown auto-trigger] feilet:', err);
        });
      }
    } catch (error) {
      console.error('Failed to save scene:', error);
      setScenes(previousScenes);
      showError('Kunne ikke lagre scene');
    }
  };

  const handleDeleteScene = async () => {
    if (!editingScene) return;
    if (!window.confirm(`Er du sikker på at du vil slette scene ${editingScene.sceneNumber ?? ''}?`)) {
      return;
    }

    const sceneId = editingScene.id;
    const previousScenes = scenes;
    const remainingScenes = scenes.filter((scene) => scene.id !== sceneId);

    setScenes(remainingScenes);
    if (selectedScene?.id === sceneId) {
      setSelectedScene(remainingScenes[0] ?? null);
    }
    closeSceneDialog();

    try {
      await manuscriptService.deleteScene(sceneId);
      showSuccess('Scene slettet');
    } catch (error) {
      console.error('Failed to delete scene:', error);
      setScenes(previousScenes);
      showError('Kunne ikke slette scene');
    }
  };

  const selectedManuscriptIsExample = selectedManuscript
    ? isExampleManuscriptProject(selectedManuscript)
    : false;

  if (!hasProjectContext) {
    return (
      <Box sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        minHeight: 400,
        gap: responsive.spacing,
        color: branding.colors.textPrimary,
        p: responsive.padding,
      }}>
        <DescriptionIcon sx={{ fontSize: is4K ? 80 : isDesktop ? 64 : 48, opacity: 0.3 }} />
        <Typography variant="h6" sx={{ fontSize: responsive.headerFontSize }}>Velg et prosjekt</Typography>
        <Typography variant="body2" sx={{ textAlign: 'center', maxWidth: 300, fontSize: responsive.bodyFontSize }}>
          Velg eller opprett et prosjekt fra oversikten for å begynne å skrive manus.
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: responsive.headerPadding,
          borderBottom: `1px solid ${branding.colors.border}`,
          background: `linear-gradient(180deg, ${branding.colors.surface} 0%, ${branding.colors.background} 100%)`,
        }}
      >
        <Stack 
          direction={responsive.headerStackDirection} 
          spacing={responsive.spacing} 
          alignItems={isMobile ? 'stretch' : 'center'} 
          justifyContent="space-between"
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              minHeight: isMobile ? 34 : 40,
              minWidth: 0,
            }}
          >
            {headerLeftContent}
          </Box>
          
          <Stack 
            direction="row" 
            spacing={isMobile ? 0.5 : 1} 
            flexWrap="wrap"
            justifyContent={isMobile ? 'flex-start' : 'flex-end'}
            sx={{
              gap: isMobile ? 0.5 : 1,
              '& .MuiButton-outlined': {
                borderColor: `${branding.colors.primary}66`,
                color: branding.colors.textPrimary,
                '&:hover': {
                  borderColor: branding.colors.primary,
                  bgcolor: `${branding.colors.primary}1a`,
                },
              },
              '& .MuiButton-contained': {
                bgcolor: branding.colors.primary,
                color: branding.colors.textPrimary,
                '&:hover': {
                  bgcolor: branding.colors.secondary,
                },
              },
            }}
          >
            {selectedManuscript && (
              <>
                <ToggleButton
                  value="auto-breakdown"
                  selected={autoBreakdownEnabled}
                  size={isMobile ? 'small' : 'medium'}
                  onChange={(_, isEnabled) => {
                    setAutoBreakdownEnabled(isEnabled);
                    showInfo(isEnabled ? 'Auto Breakdown aktivert' : 'Auto Breakdown deaktivert');
                  }}
                  sx={{
                    fontSize: responsive.captionFontSize,
                    color: autoBreakdownEnabled ? branding.colors.accent : branding.colors.textSecondary,
                    borderColor: autoBreakdownEnabled ? `${branding.colors.accent}88` : branding.colors.border,
                    '&.Mui-selected': {
                      color: branding.colors.accent,
                      bgcolor: `${branding.colors.accent}22`,
                      borderColor: `${branding.colors.accent}88`,
                    },
                  }}
                >
                  {autoBreakdownEnabled ? 'Auto Breakdown På' : 'Auto Breakdown Av'}
                </ToggleButton>
                <Button
                  variant="outlined"
                  startIcon={!isMobile ? <AutoFixHighIcon sx={{ fontSize: responsive.iconSize - 4 }} /> : undefined}
                  size={responsive.buttonSize}
                  onClick={handleAutoBreakdown}
                  disabled={isLoading || !autoBreakdownEnabled}
                  sx={{ fontSize: responsive.bodyFontSize }}
                >
                  {isMobile ? 'Auto' : 'Auto Breakdown'}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={!isMobile ? <FileDownloadIcon sx={{ fontSize: responsive.iconSize - 4 }} /> : undefined}
                  size={responsive.buttonSize}
                  onClick={handleExport}
                  disabled={isLoading}
                  title="Eksporter hele manuskriptet med produksjondata som JSON"
                  sx={{ fontSize: responsive.bodyFontSize }}
                >
                  Eksporter
                </Button>
                <Button
                  variant="contained"
                  startIcon={!isMobile ? <SaveIcon sx={{ fontSize: responsive.iconSize - 4 }} /> : undefined}
                  size={responsive.buttonSize}
                  onClick={handleSaveManuscript}
                  disabled={isLoading}
                  sx={{ fontSize: responsive.bodyFontSize }}
                >
                  Lagre
                </Button>
              </>
            )}
            <Button
              variant="outlined"
              startIcon={!isMobile ? <FileUploadIcon sx={{ fontSize: responsive.iconSize - 4 }} /> : undefined}
              size={responsive.buttonSize}
              onClick={() => setShowImportDialog(true)}
              title="Importer manuskript fra tidligere eksport"
              sx={{ fontSize: responsive.bodyFontSize }}
            >
              Importer
            </Button>
            <Button
              variant="outlined"
              startIcon={!isMobile ? <MenuBookIcon sx={{ fontSize: responsive.iconSize - 4 }} /> : undefined}
              size={responsive.buttonSize}
              onClick={() => setShowTemplatePanel(true)}
              sx={{ 
                borderColor: `${branding.colors.accent}aa`,
                color: branding.colors.accent,
                fontSize: responsive.bodyFontSize,
                '&:hover': { borderColor: branding.colors.accent, bgcolor: `${branding.colors.accent}1a` } 
              }}
            >
              Maler
            </Button>
            <Button
              variant="contained"
              startIcon={!isMobile ? <AddIcon sx={{ fontSize: responsive.iconSize - 4 }} /> : undefined}
              size={responsive.buttonSize}
              onClick={() => setShowNewManuscriptDialog(true)}
              sx={{ fontSize: responsive.bodyFontSize }}
            >
              {isMobile ? 'Nytt' : 'Nytt Manuskript'}
            </Button>
          </Stack>
        </Stack>
        {isLoading && selectedManuscript && (
          <LinearProgress
            sx={{
              mt: responsive.spacing,
              borderRadius: 999,
              '& .MuiLinearProgress-bar': { borderRadius: 999 },
            }}
          />
        )}

        {/* Manuscript Cards - shown when no manuscript is selected */}
        {!selectedManuscript && manuscripts.length > 0 && (
          <Box sx={{ mt: responsive.cardSpacing }}>
            <Typography 
              variant="h6" 
              sx={{ 
                mb: responsive.spacing, 
                color: branding.colors.textPrimary, 
                fontWeight: 600,
                fontSize: responsive.titleFontSize,
              }}
            >
              Dine Manuskripter
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gap: responsive.cardSpacing,
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, minmax(0, 1fr))',
                  md: 'repeat(3, minmax(0, 1fr))',
                  lg: 'repeat(4, minmax(0, 1fr))',
                },
              }}
            >
              {manuscripts.map((manuscript) => {
                const manuscriptCoverFocalPoint = getManuscriptCoverFocalPoint(manuscript);
                const isExampleProject = isExampleManuscriptProject(manuscript);
                return (
                <Box key={manuscript.id}>
                  <Card 
                    sx={{ 
                      background: `linear-gradient(165deg, ${branding.colors.surface} 0%, ${branding.colors.background} 100%)`,
                      border: `1px solid ${branding.colors.border}`,
                      borderRadius: isMobile ? 2 : 3,
                      overflow: 'hidden',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        borderColor: branding.colors.primary,
                        transform: isMobile ? 'none' : 'translateY(-4px)',
                        boxShadow: `0 12px 40px ${branding.colors.primary}33`,
                      },
                    }}
                  >
                    {/* Cover Image */}
                    <Box 
                      sx={{ 
                        position: 'relative',
                        height: responsive.cardImageHeight,
                        bgcolor: manuscript.coverImage 
                          ? 'transparent' 
                          : `linear-gradient(135deg, ${branding.colors.gradientStart} 0%, ${branding.colors.gradientEnd} 55%, ${branding.colors.background} 100%)`,
                        backgroundImage: manuscript.coverImage
                          ? `url(${manuscript.coverImage})`
                          : `linear-gradient(135deg, ${branding.colors.gradientStart} 0%, ${branding.colors.gradientEnd} 55%, ${branding.colors.background} 100%)`,
                        backgroundSize: 'cover',
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: manuscript.coverImage
                          ? `${manuscriptCoverFocalPoint.x}% ${manuscriptCoverFocalPoint.y}%`
                          : 'center',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        overflow: 'hidden',
                      }}
                      onClick={(event) => {
                        const target = event.target as HTMLElement;
                        if (target.closest('[data-cover-upload-action="true"]')) return;
                        requestOpenManuscript(manuscript);
                      }}
                    >
                      {!manuscript.coverImage && (
                        <Box sx={{ textAlign: 'center' }}>
                          <MenuBookIcon sx={{ fontSize: is4K ? 80 : isDesktop ? 64 : 48, color: `${branding.colors.primary}99`, mb: 1 }} />
                          <Typography 
                            variant="caption" 
                            sx={{ 
                              color: branding.colors.textSecondary,
                              display: 'block',
                              fontSize: responsive.captionFontSize,
                            }}
                          >
                            Klikk for å åpne
                          </Typography>
                        </Box>
                      )}
                      
                      {/* Cover Upload Overlay */}
                      <Box 
                        data-cover-upload-action="true"
                        sx={{ 
                          position: 'absolute',
                          top: isMobile ? 4 : 8,
                          right: isMobile ? 4 : 8,
                          display: 'flex',
                          gap: 0.5,
                          opacity: isMobile ? 1 : 0,
                          transition: 'opacity 0.2s',
                          '.MuiCard-root:hover &': { opacity: 1 },
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <input
                          data-cover-upload-action="true"
                          type="file"
                          accept="image/*"
                          id={`cover-upload-${manuscript.id}`}
                          style={{ display: 'none' }}
                          onChange={async (e) => {
                            e.stopPropagation();
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = async (event) => {
                                const coverImage = event.target?.result as string;
                                const updatedManuscript: Manuscript = {
                                  ...manuscript,
                                  coverImage,
                                  coverFocalPoint: { ...DEFAULT_MANUSCRIPT_COVER_FOCAL_POINT },
                                };
                                await manuscriptService.updateManuscript(updatedManuscript);
                                loadManuscripts();
                                showSuccess('Cover oppdatert');
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                        <Tooltip title="Last opp cover">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              document.getElementById(`cover-upload-${manuscript.id}`)?.click();
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                            data-cover-upload-action="true"
                            sx={{ 
                              bgcolor: 'rgba(0,0,0,0.6)',
                              color: branding.colors.textPrimary,
                              '&:hover': { bgcolor: `${branding.colors.primary}cc` },
                            }}
                          >
                            <FileUploadIcon sx={{ fontSize: responsive.iconSize - 4 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>

                      {/* Status Badge on Cover */}
                      <Chip 
                        label={manuscript.status === 'shooting' ? 'PRODUKSJON' : 
                               manuscript.status === 'approved' ? 'GODKJENT' : 
                               manuscript.status === 'review' ? 'GJENNOMGANG' :
                               manuscript.status === 'completed' ? 'FULLFØRT' : 'UTKAST'}
                        size={responsive.chipSize}
                        sx={{
                          position: 'absolute',
                          top: isMobile ? 8 : 12,
                          left: isMobile ? 8 : 12,
                          bgcolor: manuscript.status === 'shooting' ? `${branding.colors.primary}dd` :
                                   manuscript.status === 'approved' ? `${branding.colors.accent}dd` :
                                   manuscript.status === 'review' ? `${branding.colors.secondary}dd` :
                                   manuscript.status === 'completed' ? `${branding.colors.primary}dd` :
                                   `${branding.colors.surface}ee`,
                          color: branding.colors.textPrimary,
                          fontWeight: 700,
                          fontSize: responsive.captionFontSize,
                          letterSpacing: '0.5px',
                        }}
                      />
                    </Box>

                    <CardContent sx={{ p: isMobile ? 1.5 : 2.5 }}>
                      {/* Title Row with Edit Button */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Typography 
                          variant="h6" 
                          sx={{ 
                            color: branding.colors.textPrimary, 
                            fontWeight: 700, 
                            fontSize: responsive.titleFontSize,
                            lineHeight: 1.3,
                            flex: 1,
                            pr: 1,
                          }}
                        >
                          {manuscript.title}
                        </Typography>
                        <Tooltip title="Rediger manuskript">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingManuscript(manuscript);
                              setEditManuscriptForm({
                                title: manuscript.title,
                                subtitle: manuscript.subtitle || '',
                                author: manuscript.author || '',
                                status: manuscript.status || 'draft',
                              });
                              setShowEditManuscriptDialog(true);
                            }}
                            sx={{ 
                              color: branding.colors.textPrimary,
                              '&:hover': { color: branding.colors.primary, bgcolor: `${branding.colors.primary}1a` },
                            }}
                          >
                            <EditIcon sx={{ fontSize: responsive.iconSize - 4 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>

                      {isExampleProject && (
                        <Box sx={{ mb: 1.25 }}>
                          <Chip
                            label="Eksempelprosjekt"
                            size={responsive.chipSize}
                            sx={{
                              mb: 0.75,
                              bgcolor: `${branding.colors.accent}22`,
                              border: `1px solid ${branding.colors.accent}88`,
                              color: branding.colors.accent,
                              fontWeight: 700,
                              letterSpacing: '0.2px',
                            }}
                          />
                          <Typography
                            variant="caption"
                            sx={{
                              display: 'block',
                              color: branding.colors.textSecondary,
                              lineHeight: 1.35,
                              fontSize: responsive.captionFontSize,
                            }}
                          >
                            {EXAMPLE_PROJECT_NOTICE}
                          </Typography>
                        </Box>
                      )}

                      {/* Subtitle */}
                      {manuscript.subtitle && (
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            color: branding.colors.textPrimary, 
                            mb: 1.5,
                            fontSize: responsive.bodyFontSize,
                          }}
                        >
                          {manuscript.subtitle}
                        </Typography>
                      )}

                      {/* Author */}
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          color: branding.colors.textSecondary, 
                          mb: responsive.spacing,
                          fontSize: responsive.captionFontSize,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                        }}
                      >
                        <PersonIcon sx={{ fontSize: responsive.iconSize - 6 }} />
                        {manuscript.author || 'Ukjent forfatter'}
                      </Typography>

                      {/* Stats Row */}
                      <Box sx={{ 
                        display: 'flex', 
                        gap: isMobile ? 1 : 2, 
                        flexWrap: 'wrap',
                        py: isMobile ? 1 : 1.5,
                        px: isMobile ? 1 : 1.5,
                        bgcolor: `${branding.colors.surface}88`,
                        border: `1px solid ${branding.colors.border}`,
                        borderRadius: 1.5,
                        mb: responsive.spacing,
                      }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <DescriptionIcon sx={{ fontSize: responsive.iconSize - 6, color: branding.colors.primary }} />
                          <Typography variant="caption" sx={{ color: branding.colors.textSecondary, fontWeight: 500, fontSize: responsive.captionFontSize }}>
                            {manuscript.pageCount || 0} sider
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <ScheduleIcon sx={{ fontSize: responsive.iconSize - 6, color: branding.colors.primary }} />
                          <Typography variant="caption" sx={{ color: branding.colors.textSecondary, fontWeight: 500, fontSize: responsive.captionFontSize }}>
                            v{manuscript.version || '1.0'}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <SceneIcon sx={{ fontSize: responsive.iconSize - 6, color: branding.colors.primary }} />
                          <Typography variant="caption" sx={{ color: branding.colors.textSecondary, fontWeight: 500, fontSize: responsive.captionFontSize }}>
                            {manuscript.wordCount || 0} ord
                          </Typography>
                        </Box>
                      </Box>

                      {/* Action Buttons */}
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          fullWidth
                          variant="contained"
                          size={responsive.buttonSize}
                          onClick={() => {
                            requestOpenManuscript(manuscript);
                          }}
                          sx={{
                            bgcolor: branding.colors.primary,
                            color: branding.colors.textPrimary,
                            fontWeight: 600,
                            fontSize: responsive.bodyFontSize,
                            '&:hover': { bgcolor: branding.colors.secondary },
                          }}
                          endIcon={<ChevronRightIcon sx={{ fontSize: responsive.iconSize - 4 }} />}
                        >
                          Åpne
                        </Button>
                        <Tooltip title="Slett manuskript">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleDeleteManuscript(manuscript);
                            }}
                            sx={{ 
                              color: branding.colors.textSecondary,
                              border: `1px solid ${branding.colors.border}`,
                              '&:hover': { color: '#ef4444', borderColor: '#ef4444', bgcolor: 'rgba(239, 68, 68, 0.1)' },
                            }}
                          >
                            <DeleteIcon sx={{ fontSize: responsive.iconSize - 4 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </CardContent>
                  </Card>
                </Box>
                );
              })}
            </Box>
          </Box>
        )}

        {/* Empty state */}
        {!selectedManuscript && manuscripts.length === 0 && !isLoading && (
          <Box sx={{ 
            mt: responsive.cardSpacing, 
            textAlign: 'center',
            p: responsive.padding,
            bgcolor: `${branding.colors.surface}66`,
            borderRadius: 2,
            border: `1px dashed ${branding.colors.border}`,
          }}>
            <DescriptionIcon sx={{ fontSize: is4K ? 80 : isDesktop ? 64 : 48, color: `${branding.colors.textSecondary}99`, mb: 2 }} />
            <Typography variant="h6" sx={{ color: branding.colors.textPrimary, mb: 1, fontSize: responsive.titleFontSize }}>
              Ingen manuskripter ennå
            </Typography>
            <Typography variant="body2" sx={{ color: branding.colors.textSecondary, mb: responsive.spacing, fontSize: responsive.bodyFontSize }}>
              Opprett ditt første manuskript eller importer et eksisterende
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon sx={{ fontSize: responsive.iconSize - 4 }} />}
              size={responsive.buttonSize}
              onClick={() => setShowNewManuscriptDialog(true)}
              sx={{
                bgcolor: branding.colors.primary,
                color: branding.colors.textPrimary,
                fontSize: responsive.bodyFontSize,
                '&:hover': { bgcolor: branding.colors.secondary },
              }}
            >
              Opprett nytt manuskript
            </Button>
          </Box>
        )}
      </Box>

      {selectedManuscript && (
        <>
          {selectedManuscriptIsExample && (
            <Alert
              severity="info"
              sx={{
                mx: responsive.padding,
                mt: responsive.spacing,
                mb: responsive.spacing,
                bgcolor: `${branding.colors.accent}1a`,
                border: `1px solid ${branding.colors.accent}66`,
                color: branding.colors.textPrimary,
                '& .MuiAlert-icon': {
                  color: branding.colors.accent,
                },
              }}
            >
              <strong>Eksempelprosjekt:</strong> {EXAMPLE_PROJECT_NOTICE}
            </Alert>
          )}

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            sx={{ 
              borderBottom: 1, 
              borderColor: branding.colors.border, 
              background: `${branding.colors.surface}99`,
              px: responsive.padding,
              minHeight: isMobile ? 40 : 48,
              '& .MuiTabs-indicator': {
                bgcolor: branding.colors.primary,
              },
              '& .MuiTab-root': {
                minHeight: isMobile ? 40 : 48,
                fontSize: responsive.tabFontSize,
                minWidth: isMobile ? 'auto' : undefined,
                px: isMobile ? 1 : 2,
                color: branding.colors.textSecondary,
                '&.Mui-selected': {
                  color: branding.colors.textPrimary,
                },
              },
            }}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab 
              label={responsive.showTabLabels ? "Editor" : ""} 
              value="editor" 
              icon={<EditIcon sx={{ fontSize: responsive.iconSize - 4 }} />} 
              iconPosition="start" 
            />
            <Tab 
              label={responsive.showTabLabels ? "Akter" : ""} 
              value="acts" 
              icon={<MenuBookIcon sx={{ fontSize: responsive.iconSize - 4 }} />} 
              iconPosition="start" 
            />
            <Tab 
              label={responsive.showTabLabels ? "Scener" : ""} 
              value="scenes" 
              icon={
                <Badge color="secondary" badgeContent={sceneStats.total} max={99}>
                  <SceneIcon sx={{ fontSize: responsive.iconSize - 4 }} />
                </Badge>
              }
              iconPosition="start" 
            />
            <Tab 
              label={responsive.showTabLabels ? "Karakterer" : ""} 
              value="characters" 
              icon={
                <Badge color="secondary" badgeContent={characterList.length} max={99}>
                  <PersonIcon sx={{ fontSize: responsive.iconSize - 4 }} />
                </Badge>
              }
              iconPosition="start" 
            />
            <Tab 
              label={responsive.showTabLabels ? "Dialog" : ""} 
              value="dialogue" 
              icon={
                <Badge color="secondary" badgeContent={dialogueLines.length} max={99}>
                  <ChatIcon sx={{ fontSize: responsive.iconSize - 4 }} />
                </Badge>
              }
              iconPosition="start" 
            />
            <Tab 
              label={responsive.showTabLabels ? "Breakdown" : ""} 
              value="breakdown" 
              icon={<AssessmentIcon sx={{ fontSize: responsive.iconSize - 4 }} />} 
              iconPosition="start" 
            />
            <Tab 
              label={responsive.showTabLabels ? "Revisjoner" : ""} 
              value="revisions" 
              icon={
                <Badge color="secondary" badgeContent={revisions.length} max={99}>
                  <HistoryIcon sx={{ fontSize: responsive.iconSize - 4 }} />
                </Badge>
              }
              iconPosition="start" 
            />
            <Tab 
              label={responsive.showTabLabels ? "Timeline" : ""} 
              value="timeline" 
              icon={<TimelineIcon sx={{ fontSize: responsive.iconSize - 4 }} />} 
              iconPosition="start" 
            />
            <Tab 
              label={responsive.showTabLabels ? "Storyboard" : ""} 
              value="production" 
              icon={<ViewModuleIcon sx={{ fontSize: responsive.iconSize - 4 }} />} 
              iconPosition="start" 
            />
            <Tab 
              label={responsive.showTabLabels ? "Production View" : ""} 
              value="productionview" 
              icon={<MovieIcon sx={{ fontSize: responsive.iconSize - 4 }} />} 
              iconPosition="start" 
            />
          </Tabs>

          {/* Tab content */}
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              overflowX: 'hidden',
              WebkitOverflowScrolling: 'touch',
              p: responsive.padding,
            }}
          >
            {/* Editor Tab */}
            {activeTab === 'editor' && (
              <>
                {resumeAnalysis &&
                  resumeAnalysis.threads.length > 0 &&
                  selectedManuscript &&
                  !resumeDismissedMap[selectedManuscript.id] && (
                    <ResumeBanner
                      analysis={resumeAnalysis}
                      onAction={handleResumeAction}
                      onDismiss={handleResumeDismiss}
                    />
                  )}
                <EditorTab
                  manuscript={selectedManuscript}
                  scenes={scenes}
                  onContentChange={handleEditorContentChange}
                  onParseToScenes={handleParseToScenes}
                  manuscriptSaveStatus={manuscriptSaveStatus}
                  lastManuscriptSaved={lastManuscriptSaved}
                  characters={sceneCharactersMemo}
                  locations={sceneLocationsMemo}
                  castingRoles={castingRoles}
                  castingLocations={castingLocations}
                  castingCandidates={castingCandidates}
                  onCharacterAdd={handleCharacterAdd}
                  onLocationAdd={handleLocationAdd}
                />
              </>
            )}

            {/* Acts Tab */}
            {activeTab === 'acts' && (
              <ActsTab
                acts={acts}
                manuscriptId={selectedManuscript?.id || ''}
                onActsChange={setActs}
              />
            )}

            {/* Scenes Tab */}
            {activeTab === 'scenes' && (
              <ScenesTab
                scenes={scenes}
                viewMode={sceneViewMode}
                onViewModeChange={setSceneViewMode}
                onAddScene={openCreateSceneDialog}
                onEditScene={openEditSceneDialog}
                onSelectScene={(scene) => {
                  setSelectedScene(scene);
                  setSelectedShot(null);
                  setShowProductionPanel(true);
                }}
                onReorderScenes={(nextScenes) => {
                  setScenes(nextScenes);
                  setSelectedScene((currentSelection) => (
                    currentSelection
                      ? nextScenes.find((scene) => scene.id === currentSelection.id) ?? null
                      : currentSelection
                  ));
                }}
                selectedScene={selectedScene || undefined}
                highlightedSceneIds={highlightedSceneIds}
                projectCinemaFormat={projectCinemaFormat}
              />
            )}

            {/* Characters Tab */}
            {activeTab === 'characters' && (
              <Stack spacing={2}>
                {activeProjectId && scenes.length > 0 && (
                  <AISuggestionsPanel
                    projectId={activeProjectId}
                    filter={{
                      sourceType: 'project',
                      sourceId: activeProjectId,
                      suggestionType: 'casting.role-stub',
                    }}
                    title="AI-foreslåtte roller"
                    onGenerate={async () => {
                      if (!activeProjectId) return;
                      await generateSuggestions(activeProjectId, {
                        agentName: 'casting-stub-agent',
                        sourceType: 'project',
                        sourceId: activeProjectId,
                        payload: {
                          scenes: scenes
                            .filter((s) => s.description && s.description.trim())
                            .map((s) => ({
                              id: s.id,
                              sceneNumber: s.sceneNumber,
                              sceneText: s.description ?? '',
                            })),
                          existingRoles: castingRoles.map((r) => ({ id: r.id, name: r.name })),
                        },
                      });
                    }}
                  />
                )}
                {activeProjectId && scenes.length >= 2 && (
                  <AISuggestionsPanel
                    projectId={activeProjectId}
                    filter={{
                      sourceType: 'project',
                      sourceId: activeProjectId,
                      suggestionType: 'story.continuity-issue',
                    }}
                    title="Continuity-feil"
                    onGenerate={async () => {
                      if (!activeProjectId) return;
                      await generateSuggestions(activeProjectId, {
                        agentName: 'story-logic-agent',
                        sourceType: 'project',
                        sourceId: activeProjectId,
                        payload: {
                          scenes: scenes
                            .filter((s) => s.description && s.description.trim())
                            .map((s) => ({
                              id: s.id,
                              sceneNumber: s.sceneNumber,
                              sceneText: s.description ?? '',
                              sceneHeading: s.sceneHeading ?? s.heading,
                            })),
                          existingRoles: castingRoles.map((r) => ({ id: r.id, name: r.name })),
                        },
                      });
                    }}
                  />
                )}
                {activeProjectId && scenes.length >= 3 && (
                  <AISuggestionsPanel
                    projectId={activeProjectId}
                    filter={{
                      sourceType: 'project',
                      sourceId: activeProjectId,
                    }}
                    title="Story-utvikling (logline · synopsis · beats)"
                    onGenerate={async () => {
                      if (!activeProjectId) return;
                      await generateSuggestions(activeProjectId, {
                        agentName: 'story-development-agent',
                        sourceType: 'project',
                        sourceId: activeProjectId,
                        payload: {
                          scenes: scenes
                            .filter((s) => s.description && s.description.trim())
                            .map((s) => ({
                              id: s.id,
                              sceneNumber: s.sceneNumber,
                              sceneText: s.description ?? '',
                              sceneHeading: s.sceneHeading ?? s.heading,
                            })),
                        },
                      });
                    }}
                  />
                )}
                <CharactersTab
                  characters={characterList}
                  dialogueLines={dialogueLines}
                  manuscriptId={selectedManuscript?.id}
                  scenes={scenes}
                  onCharactersChange={(chars) => {
                    // Character updates would need backend support
                    console.log('Character update:', chars);
                  }}
                />
              </Stack>
            )}

            {/* Dialogue Tab */}
            {activeTab === 'dialogue' && (
              <DialogueTab 
                dialogueLines={dialogueLines} 
                scenes={scenes}
                manuscriptId={selectedManuscript?.id}
                onDialogueChange={setDialogueLines}
              />
            )}

            {/* Breakdown Tab */}
            {activeTab === 'breakdown' && (
              <BreakdownTab
                scenes={scenes}
                sceneStats={sceneStats}
                onAddScene={openCreateSceneDialog}
                onEditScene={openEditSceneDialog}
                onSelectScene={(scene) => {
                  setSelectedScene(scene);
                  setSelectedShot(null);
                  setShowProductionPanel(true);
                }}
                selectedScene={selectedScene || undefined}
              />
            )}

            {/* Revisions Tab */}
            {activeTab === 'revisions' && (
              <RevisionsTab 
                revisions={revisions} 
                manuscript={selectedManuscript}
                onRevisionsChange={setRevisions}
                onCreateRevision={async (revision) => {
                  const nextVersion = revision.version || selectedManuscript.version;
                  const nowIso = new Date().toISOString();
                  const updatedManuscript: Manuscript = {
                    ...selectedManuscript,
                    version: nextVersion ?? selectedManuscript.version ?? '1.0',
                    updatedAt: nowIso,
                  };
                  setSelectedManuscript(updatedManuscript);
                  setManuscripts((current) =>
                    current.map((entry) => (entry.id === updatedManuscript.id ? updatedManuscript : entry))
                  );
                  await manuscriptService.updateManuscript(updatedManuscript);
                  setManuscriptSaveStatus('saved');
                  setLastManuscriptSaved(new Date(nowIso));
                  onManuscriptChange?.(updatedManuscript);
                }}
                onRestoreRevision={async (revision) => {
                  const nowIso = new Date().toISOString();
                  const restoredManuscript: Manuscript = {
                    ...selectedManuscript,
                    content: revision.content ?? '',
                    version: revision.version || selectedManuscript.version || '1.0',
                    updatedAt: nowIso,
                  };

                  setSelectedManuscript(restoredManuscript);
                  setManuscripts((current) =>
                    current.map((entry) => (entry.id === restoredManuscript.id ? restoredManuscript : entry))
                  );
                  selectedManuscriptRef.current = restoredManuscript;
                  pendingContentRef.current = revision.content ?? '';
                  lastSavedContentRef.current = revision.content ?? '';
                  isDirtyRef.current = false;
                  setManuscriptSaveStatus('saved');
                  setLastManuscriptSaved(new Date(nowIso));
                  await manuscriptService.updateManuscript(restoredManuscript);
                  onManuscriptChange?.(restoredManuscript);
                }}
              />
            )}

            {/* Timeline Tab */}
            {activeTab === 'timeline' && (
              <TimelineView
                scenes={scenes}
                onSceneSelect={(scene) => {
                  setSelectedScene(scene);
                  setSelectedShot(null);
                  setShowProductionPanel(true);
                }}
                selectedScene={selectedScene || undefined}
              />
            )}

            {/* Production Tab - with Script-Storyboard Integration */}
            {activeTab === 'production' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
                <Paper sx={{ p: 2 }}>
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={1.5}
                    alignItems={{ xs: 'stretch', md: 'center' }}
                    justifyContent="space-between"
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      Velg scene for storyboard
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mr: { xs: 0, md: 1 } }}>
                      <ToggleButtonGroup
                        size="small"
                        value={productionWorkspaceMode}
                        exclusive
                        onChange={(_, nextValue: 'storyboard' | 'split' | null) => {
                          if (!nextValue) return;
                          setProductionWorkspaceMode(nextValue);
                        }}
                      >
                        <ToggleButton value="storyboard">
                          <Tooltip title="Storyboard-visning">
                            <ViewModuleIcon sx={{ fontSize: responsive.iconSize - 6 }} />
                          </Tooltip>
                        </ToggleButton>
                        <ToggleButton value="split">
                          <Tooltip title="Script + Storyboard side ved side">
                            <PreviewIcon sx={{ fontSize: responsive.iconSize - 6 }} />
                          </Tooltip>
                        </ToggleButton>
                      </ToggleButtonGroup>
                    </Stack>
                    <FormControl size="small" sx={{ minWidth: { xs: '100%', md: 340 } }}>
                      <InputLabel id="production-scene-select-label">Scene</InputLabel>
                      <Select
                        labelId="production-scene-select-label"
                        value={selectedScene?.id || ''}
                        label="Scene"
                        onChange={(event) => {
                          const nextSceneId = String(event.target.value);
                          const nextScene = scenes.find((scene) => scene.id === nextSceneId) || null;
                          setSelectedScene(nextScene);
                        }}
                      >
                        {productionSceneOptions.map((scene) => (
                          <MenuItem key={scene.id} value={scene.id}>
                            {highlightedSceneIds.has(scene.id) && (
                              <Box component="span" sx={{ color: 'warning.main', mr: 0.5, fontWeight: 700 }}>
                                ★
                              </Box>
                            )}
                            Scene {scene.sceneNumber || '?'} · {scene.sceneHeading || scene.heading || scene.locationName || 'Uten tittel'}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Stack>
                </Paper>

                {selectedScene ? (
                  <ScriptStoryboardProvider
                    initialState={{
                      currentScene: {
                        sceneId: selectedScene.id,
                        sceneNumber: selectedScene.sceneNumber ?? '',
                        sceneHeading: selectedScene.sceneHeading ?? selectedScene.heading ?? '',
                        sceneType: selectedScene.intExt,
                        location: selectedScene.locationName,
                        timeOfDay: selectedScene.timeOfDay,
                        startLine: 0,
                        endLine: 0,
                      },
                    }}
                  >
                    <Box sx={{ flex: 1, minHeight: 0 }}>
                      {productionWorkspaceMode === 'split' ? (
                        <ScriptStoryboardSplitView
                          scriptContent={selectedManuscript.content || ''}
                          onScriptChange={handleScriptChangeFromSplitView}
                          scene={selectedScene}
                          onSceneUpdate={handleSceneUpdateFromStoryboard}
                          renderScriptEditor={({ content, onChange }) => (
                            <React.Suspense fallback={<Box sx={{ p: 2 }}><CircularProgress size={20} /></Box>}>
                              <LazyScreenplayEditorWithNavigator
                                editorKey={`${selectedManuscript.id}-production-split`}
                                value={content}
                                onChange={onChange}
                                scriptTitle={selectedManuscript.title}
                                headerSummary={{
                                  pages: selectedManuscript.pageCount || 0,
                                  runtimeMinutes: Math.max(0, Math.round(selectedManuscript.pageCount || 0)),
                                  sceneCount: scenes.length,
                                  characterCount: sceneCharactersMemo.length,
                                  statusLabel: (selectedManuscript.status ?? 'draft').toUpperCase(),
                                  saveLabel:
                                    manuscriptSaveStatus === 'saved'
                                      ? (lastManuscriptSaved
                                          ? `Lagret ${lastManuscriptSaved.toLocaleTimeString('nb-NO')}`
                                          : 'Lagret')
                                      : manuscriptSaveStatus === 'saving'
                                        ? 'Lagrer...'
                                        : manuscriptSaveStatus === 'error'
                                          ? 'Lagringsfeil'
                                          : 'Ulagret',
                                  saveState: manuscriptSaveStatus,
                                }}
                                characters={sceneCharactersMemo}
                                locations={sceneLocationsMemo}
                                roles={castingRoles}
                                candidates={castingCandidates}
                                scenes={scenes}
                                onCharacterAdd={handleCharacterAdd}
                                onLocationAdd={handleLocationAdd}
                                showLineNumbers={false}
                              />
                            </React.Suspense>
                          )}
                          renderStoryboard={({ scene, onUpdate, activeFrameIndex, onFrameSelect }) => (
                            <StoryboardIntegrationView
                              scene={scene}
                              onUpdate={onUpdate}
                              projectCinemaFormat={projectCinemaFormat}
                              storyboardOnly={true}
                              activeFrameIndex={activeFrameIndex}
                                onFrameSelect={(index) => {
                                  onFrameSelect(index);
                                const shot = String(
                                  scene.storyboardFrames?.[index]?.shotNumber ?? `Shot ${index + 1}`
                                );
                                setSelectedShot(shot);
                                setShowProductionPanel(true);
                              }}
                            />
                          )}
                          onFrameSelect={(_, index) => {
                            const shot = String(
                              selectedScene.storyboardFrames?.[index]?.shotNumber ?? `Shot ${index + 1}`
                            );
                            setSelectedShot(shot);
                            setShowProductionPanel(true);
                          }}
                        />
                      ) : (
                        <StoryboardIntegrationView
                          scene={selectedScene}
                          onUpdate={handleSceneUpdateFromStoryboard}
                          projectCinemaFormat={projectCinemaFormat}
                          storyboardOnly={true}
                          onFrameSelect={(index) => {
                            const shot = String(
                              selectedScene.storyboardFrames?.[index]?.shotNumber ?? `Shot ${index + 1}`
                            );
                            setSelectedShot(shot);
                            setShowProductionPanel(true);
                          }}
                        />
                      )}
                    </Box>
                  </ScriptStoryboardProvider>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {productionSceneOptions.length > 0
                        ? 'Velg en scene i listen over for å åpne storyboard'
                        : 'Ingen scener enda. Opprett en scene i Scener-fanen først.'}
                    </Typography>
                  </Box>
                )}
              </Box>
            )}

            {/* Production View Tab - Full Production Layout */}
            {activeTab === 'productionview' && (
              <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                <ProductionManuscriptView
                  manuscript={selectedManuscript}
                  scenes={scenes}
                  dialogueLines={dialogueLines}
                  acts={acts}
                  projectId={activeProjectId}
                  storyLogicData={storyLogicData}
                  onSceneUpdate={async (updatedScene) => {
                    // Update local state
                    setScenes(scenes.map(s => s.id === updatedScene.id ? updatedScene : s));
                    // Persist to service
                    try {
                      await manuscriptService.saveScene(updatedScene);
                      showSuccess('Scene lagret');
                      console.log('Scene saved:', updatedScene.id);
                    } catch (error) {
                      console.error('Failed to save scene:', error);
                      showError('Kunne ikke lagre scene-endringer');
                    }
                  }}
                  onSceneDelete={async (sceneId) => {
                    // Update local state
                    const oldScenes = scenes;
                    setScenes(scenes.filter(s => s.id !== sceneId));
                    try {
                      await manuscriptService.deleteScene(sceneId);
                      showSuccess('Scene slettet');
                    } catch (error) {
                      console.error('Failed to delete scene:', error);
                      showError('Kunne ikke slette scene');
                      // Rollback on error
                      setScenes(oldScenes);
                    }
                  }}
                  onSceneCreate={async (newScene) => {
                    // Update local state
                    setScenes([...scenes, newScene]);
                    // Persist to service
                    try {
                      await manuscriptService.saveScene(newScene);
                      showSuccess('Ny scene opprettet');
                    } catch (error) {
                      console.error('Failed to create scene:', error);
                      showError('Kunne ikke opprette scene');
                      // Rollback on error
                      setScenes(scenes.filter(s => s.id !== newScene.id));
                    }
                  }}
                  onScenesReorder={async (reorderedScenes) => {
                    // Update local state with reordered scenes
                    const oldScenes = scenes;
                    setScenes(reorderedScenes);
                    
                    // Persist all scenes with updated order
                    try {
                      await Promise.all(
                        reorderedScenes.map(scene => manuscriptService.saveScene(scene))
                      );
                      showSuccess('Scene-rekkefølge oppdatert');
                    } catch (error) {
                      console.error('Failed to reorder scenes:', error);
                      showError('Kunne ikke oppdatere scene-rekkefølge');
                      // Rollback on error
                      setScenes(oldScenes);
                    }
                  }}
                  onManuscriptUpdate={async (updatedManuscript) => {
                    setSelectedManuscript(updatedManuscript);
                    if (onManuscriptChange) {
                      onManuscriptChange(updatedManuscript);
                    }
                    // Persist to service
                    try {
                      await manuscriptService.updateManuscript(updatedManuscript);
                      console.log('Manuscript saved:', updatedManuscript.id);
                    } catch (error) {
                      console.error('Failed to save manuscript:', error);
                      showError('Kunne ikke lagre manuskript-endringer');
                    }
                  }}
                  onClose={() => setActiveTab('editor')}
                />
              </Box>
            )}
          </Box>

          {/* Production Control Panel Drawer */}
          <Drawer
            anchor="right"
            open={showProductionPanel}
            onClose={() => setShowProductionPanel(false)}
            sx={{
              '& .MuiDrawer-paper': {
                width: 400,
                p: 0,
              },
            }}
          >
            <ProductionControlPanel
              selectedScene={selectedScene || undefined}
              selectedShot={selectedShot || undefined}
              onClose={() => setShowProductionPanel(false)}
            />
          </Drawer>
        </>
      )}

      {/* Scene Dialog */}
      <Dialog
        open={showSceneDialog}
        onClose={closeSceneDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{editingScene ? 'Rediger scene' : 'Ny scene'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Scene heading"
              fullWidth
              required
              value={sceneForm.sceneHeading}
              onChange={(event) => setSceneForm((prev) => ({ ...prev, sceneHeading: event.target.value }))}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Scene #"
                value={sceneForm.sceneNumber}
                onChange={(event) => setSceneForm((prev) => ({ ...prev, sceneNumber: event.target.value }))}
                sx={{ minWidth: { xs: '100%', sm: 120 } }}
              />
              <FormControl fullWidth>
                <InputLabel>INT/EXT</InputLabel>
                <Select
                  label="INT/EXT"
                  value={sceneForm.intExt}
                  onChange={(event) =>
                    setSceneForm((prev) => ({ ...prev, intExt: event.target.value as 'INT' | 'EXT' | 'INT/EXT' }))
                  }
                >
                  <MenuItem value="INT">INT</MenuItem>
                  <MenuItem value="EXT">EXT</MenuItem>
                  <MenuItem value="INT/EXT">INT/EXT</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Tid på dagen</InputLabel>
                <Select
                  label="Tid på dagen"
                  value={sceneForm.timeOfDay}
                  onChange={(event) =>
                    setSceneForm((prev) => ({
                      ...prev,
                      timeOfDay: event.target.value as 'DAY' | 'NIGHT' | 'DAWN' | 'DUSK' | 'CONTINUOUS' | 'LATER' | 'MORNING' | 'EVENING',
                    }))
                  }
                >
                  <MenuItem value="DAY">DAY</MenuItem>
                  <MenuItem value="NIGHT">NIGHT</MenuItem>
                  <MenuItem value="MORNING">MORNING</MenuItem>
                  <MenuItem value="EVENING">EVENING</MenuItem>
                  <MenuItem value="DAWN">DAWN</MenuItem>
                  <MenuItem value="DUSK">DUSK</MenuItem>
                  <MenuItem value="LATER">LATER</MenuItem>
                  <MenuItem value="CONTINUOUS">CONTINUOUS</MenuItem>
                </Select>
              </FormControl>
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Lokasjon"
                fullWidth
                value={sceneForm.locationName}
                onChange={(event) => setSceneForm((prev) => ({ ...prev, locationName: event.target.value }))}
              />
              <TextField
                label="Sidelengde"
                type="number"
                inputProps={{ min: 0, step: 0.1 }}
                value={sceneForm.pageLength}
                onChange={(event) => setSceneForm((prev) => ({ ...prev, pageLength: event.target.value }))}
                sx={{ minWidth: { xs: '100%', sm: 150 } }}
              />
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  label="Status"
                  value={sceneForm.status}
                  onChange={(event) => setSceneForm((prev) => ({ ...prev, status: String(event.target.value) }))}
                >
                  <MenuItem value="not-scheduled">Ikke planlagt</MenuItem>
                  <MenuItem value="scheduled">Planlagt</MenuItem>
                  <MenuItem value="in-progress">Pågår</MenuItem>
                  <MenuItem value="completed">Fullført</MenuItem>
                </Select>
              </FormControl>
            </Stack>

            <Autocomplete
              multiple
              freeSolo
              options={castingRoles.map((role) => role.name)}
              value={sceneForm.characters}
              onChange={(_event, value) =>
                setSceneForm((prev) => ({ ...prev, characters: value.map((v) => String(v).trim()).filter(Boolean) }))
              }
              renderTags={(value: readonly string[], getTagProps) =>
                value.map((option, index) => {
                  const { key, ...tagProps } = getTagProps({ index });
                  return <Chip key={key} variant="outlined" label={option} size="small" {...tagProps} />;
                })
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Hvem er i scenen?"
                  placeholder={castingRoles.length ? 'Velg fra eksisterende roller eller skriv nytt navn' : 'Skriv karakter-navn'}
                />
              )}
            />

            <TextField
              label="Beskrivelse"
              fullWidth
              multiline
              minRows={4}
              value={sceneForm.description}
              onChange={(event) => setSceneForm((prev) => ({ ...prev, description: event.target.value }))}
            />

            <Divider>
              <Typography variant="caption" color="text.secondary">
                Valgfritt — hjelper å fokusere
              </Typography>
            </Divider>

            <TextField
              label="Hva endrer seg fra start til slutt av scenen?"
              fullWidth
              value={sceneForm.sceneIntent}
              onChange={(event) => setSceneForm((prev) => ({ ...prev, sceneIntent: event.target.value }))}
              placeholder="Én setning"
            />
            <TextField
              label="Hva vil hovedpersonen her?"
              fullWidth
              value={sceneForm.protagonistGoal}
              onChange={(event) => setSceneForm((prev) => ({ ...prev, protagonistGoal: event.target.value }))}
              placeholder="Én setning"
            />

            {editingScene?.id && activeProjectId && (
              <>
                <Divider />

                {/* Scene-readiness top-card — aggregert status fra alle agenter */}
                <SceneReadinessCard
                  projectId={activeProjectId}
                  sceneId={editingScene.id}
                />

                {/* ── Fase 1: Pre-produksjon ──────────────────────────── */}
                <Accordion defaultExpanded={false}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle2">📝 Pre-produksjon</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={1.5}>
                      <AISuggestionsPanel
                        projectId={activeProjectId}
                        filter={{ sourceType: 'scene', sourceId: editingScene.id, suggestionType: 'breakdown.prop' }}
                        title="Breakdown — props/locations/kostymer/VFX/risk"
                        onGenerate={async () => {
                          if (!editingScene?.id || !activeProjectId) return;
                          await generateSuggestions(activeProjectId, {
                            agentName: 'breakdown-agent',
                            sourceType: 'scene',
                            sourceId: editingScene.id,
                            payload: {
                              sceneText: sceneForm.description,
                              existingRoles: castingRoles.map((r) => ({ id: r.id, name: r.name })),
                              existingProps: [],
                              existingLocations: castingLocations.map((l) => ({ id: l.id, name: l.name })),
                            },
                          });
                        }}
                      />
                      <AISuggestionsPanel
                        projectId={activeProjectId}
                        filter={{ sourceType: 'scene', sourceId: editingScene.id, suggestionType: 'shot-list.draft' }}
                        title="Shot-list"
                        onGenerate={async () => {
                          if (!editingScene?.id || !activeProjectId) return;
                          await generateSuggestions(activeProjectId, {
                            agentName: 'shot-list-agent',
                            sourceType: 'scene',
                            sourceId: editingScene.id,
                            payload: {
                              sceneText: sceneForm.description,
                              sceneHeading: sceneForm.sceneHeading,
                              intExt: sceneForm.intExt,
                              characters: sceneForm.characters,
                            },
                          });
                        }}
                      />
                    </Stack>
                  </AccordionDetails>
                </Accordion>

                {/* ── Fase 2: Live set ──────────────────────────────── */}
                <Accordion defaultExpanded={false}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle2">🎬 Live set</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={1.5}>
                      <TakesPanel projectId={activeProjectId} sceneId={editingScene.id} />
                      <AISuggestionsPanel
                        projectId={activeProjectId}
                        filter={{ sourceType: 'scene', sourceId: editingScene.id, suggestionType: 'coverage.gap' }}
                        title="Coverage-gap"
                      />
                      <AISuggestionsPanel
                        projectId={activeProjectId}
                        filter={{ sourceType: 'scene', sourceId: editingScene.id, suggestionType: 'coverage.best-take' }}
                        title="Best take-anbefaling"
                      />
                    </Stack>
                  </AccordionDetails>
                </Accordion>

                {/* ── Fase 3: Post-produksjon ──────────────────────── */}
                <Accordion defaultExpanded={false}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle2">✂️ Post-produksjon</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={1.5}>
                      <AISuggestionsPanel
                        projectId={activeProjectId}
                        filter={{ sourceType: 'scene', sourceId: editingScene.id, suggestionType: 'edit.rough-cut-draft' }}
                        title="Rough-cut-draft"
                        onGenerate={async () => {
                          if (!editingScene?.id || !activeProjectId) return;
                          await generateSuggestions(activeProjectId, {
                            agentName: 'rough-cut-agent',
                            sourceType: 'scene',
                            sourceId: editingScene.id,
                            payload: { sceneId: editingScene.id },
                          });
                        }}
                      />
                      <AISuggestionsPanel
                        projectId={activeProjectId}
                        filter={{ sourceType: 'scene', sourceId: editingScene.id, suggestionType: 'post.color-consistency-issue' }}
                        title="Color-konsistens"
                        onGenerate={async () => {
                          if (!editingScene?.id || !activeProjectId) return;
                          await generateSuggestions(activeProjectId, {
                            agentName: 'color-consistency-agent',
                            sourceType: 'scene',
                            sourceId: editingScene.id,
                            payload: { sceneId: editingScene.id },
                          });
                        }}
                      />
                      <AISuggestionsPanel
                        projectId={activeProjectId}
                        filter={{ sourceType: 'scene', sourceId: editingScene.id, suggestionType: 'post.audio-mix-issue' }}
                        title="Audio-mix-issues"
                        onGenerate={async () => {
                          if (!editingScene?.id || !activeProjectId) return;
                          await generateSuggestions(activeProjectId, {
                            agentName: 'audio-mix-issue-agent',
                            sourceType: 'scene',
                            sourceId: editingScene.id,
                            payload: { sceneId: editingScene.id },
                          });
                        }}
                      />
                      <AISuggestionsPanel
                        projectId={activeProjectId}
                        filter={{ sourceType: 'scene', sourceId: editingScene.id, suggestionType: 'post.dialog-pacing-issue' }}
                        title="Dialog-pacing"
                        onGenerate={async () => {
                          if (!editingScene?.id || !activeProjectId) return;
                          await generateSuggestions(activeProjectId, {
                            agentName: 'dialog-pacing-agent',
                            sourceType: 'scene',
                            sourceId: editingScene.id,
                            payload: { sceneId: editingScene.id },
                          });
                        }}
                      />
                      <AISuggestionsPanel
                        projectId={activeProjectId}
                        filter={{ sourceType: 'scene', sourceId: editingScene.id, suggestionType: 'post.music-bed-suggestion' }}
                        title="Musikk-bed"
                        onGenerate={async () => {
                          if (!editingScene?.id || !activeProjectId) return;
                          await generateSuggestions(activeProjectId, {
                            agentName: 'music-bed-agent',
                            sourceType: 'scene',
                            sourceId: editingScene.id,
                            payload: {
                              sceneId: editingScene.id,
                              sceneText: sceneForm.description,
                              sceneHeading: sceneForm.sceneHeading,
                              intExt: sceneForm.intExt,
                              timeOfDay: sceneForm.timeOfDay,
                              sceneIntent: sceneForm.sceneIntent,
                              protagonistGoal: sceneForm.protagonistGoal,
                            },
                          });
                        }}
                      />
                      <AISuggestionsPanel
                        projectId={activeProjectId}
                        filter={{ sourceType: 'scene', sourceId: editingScene.id, suggestionType: 'post.sfx-suggestion' }}
                        title="SFX-cue-list"
                        onGenerate={async () => {
                          if (!editingScene?.id || !activeProjectId) return;
                          await generateSuggestions(activeProjectId, {
                            agentName: 'sfx-suggestion-agent',
                            sourceType: 'scene',
                            sourceId: editingScene.id,
                            payload: {
                              sceneId: editingScene.id,
                              sceneText: sceneForm.description,
                              sceneHeading: sceneForm.sceneHeading,
                              intExt: sceneForm.intExt,
                            },
                          });
                        }}
                      />
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between' }}>
          <Box>
            {editingScene && (
              <Button color="error" onClick={handleDeleteScene} startIcon={<DeleteIcon />}>
                Slett scene
              </Button>
            )}
          </Box>
          <Stack direction="row" spacing={1}>
            {editingScene?.id && activeProjectId && (
              <Button
                onClick={() => setShowLiveSetPro(true)}
                sx={{
                  bgcolor: '#dc2626',
                  color: '#fff',
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  '&:hover': { bgcolor: '#b91c1c' },
                }}
              >
                ● LIVE SET PRO
              </Button>
            )}
            <Button onClick={closeSceneDialog}>Avbryt</Button>
            <Button onClick={handleSaveScene} variant="contained">
              {editingScene ? 'Lagre scene' : 'Begynn å skrive'}
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>

      {/* LIVE SET PRO fullscreen-workspace */}
      {editingScene && activeProjectId && (
        <LiveSetWorkspace
          projectId={activeProjectId}
          projectName={selectedManuscript?.title ?? 'Prosjekt'}
          scene={editingScene}
          open={showLiveSetPro}
          onClose={() => setShowLiveSetPro(false)}
        />
      )}

      {/* Example Project Disclaimer Dialog */}
      <Dialog
        open={showExampleProjectDisclaimerDialog}
        onClose={closeExampleProjectDisclaimerDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            background: `linear-gradient(165deg, ${branding.colors.background} 0%, ${branding.colors.surface} 100%)`,
            border: `1px solid ${branding.colors.border}`,
            borderRadius: 2,
            boxShadow: branding.layout.shadowStrong,
          },
        }}
      >
        <DialogTitle sx={{ color: branding.colors.textPrimary, fontWeight: 700 }}>
          Eksempelprosjekt
        </DialogTitle>
        <DialogContent>
          <Alert
            severity="warning"
            sx={{
              mt: 1,
              bgcolor: `${branding.colors.accent}14`,
              border: `1px solid ${branding.colors.accent}66`,
              color: branding.colors.textPrimary,
              '& .MuiAlert-icon': { color: branding.colors.accent },
            }}
          >
            <Typography variant="body2" sx={{ color: 'inherit' }}>
              {EXAMPLE_PROJECT_NOTICE}
            </Typography>
          </Alert>
          <Typography variant="body2" sx={{ mt: 2, color: branding.colors.textSecondary }}>
            Ved å åpne prosjektet bekrefter du at du forstår at innholdet kun er demo/fiktivt.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={closeExampleProjectDisclaimerDialog} sx={{ color: branding.colors.textSecondary }}>
            Avbryt
          </Button>
          <Button
            variant="contained"
            onClick={confirmOpenExampleProject}
            sx={{
              bgcolor: branding.colors.primary,
              color: branding.colors.textPrimary,
              '&:hover': { bgcolor: branding.colors.secondary },
            }}
          >
            Åpne Eksempelprosjekt
          </Button>
        </DialogActions>
      </Dialog>

      {/* New Manuscript Dialog */}
      <Dialog open={showNewManuscriptDialog} onClose={() => setShowNewManuscriptDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nytt Manuskript</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Tittel"
              fullWidth
              required
              value={newManuscript.title}
              onChange={(e) => setNewManuscript({ ...newManuscript, title: e.target.value })}
            />
            <TextField
              label="Undertittel"
              fullWidth
              value={newManuscript.subtitle}
              onChange={(e) => setNewManuscript({ ...newManuscript, subtitle: e.target.value })}
            />
            <TextField
              label="Forfatter"
              fullWidth
              value={newManuscript.author}
              onChange={(e) => setNewManuscript({ ...newManuscript, author: e.target.value })}
            />
            <FormControl fullWidth>
              <InputLabel>Format</InputLabel>
              <Select
                value={newManuscript.format}
                onChange={(e) => setNewManuscript({ ...newManuscript, format: e.target.value as NonNullable<Manuscript['format']> })}
                label="Format"
              >
                <MenuItem value="fountain">Fountain (anbefalt)</MenuItem>
                <MenuItem value="markdown">Markdown</MenuItem>
                <MenuItem value="final-draft">Final Draft</MenuItem>
              </Select>
            </FormControl>

            <Divider>
              <Typography variant="caption" color="text.secondary">
                Struktur — gir deg scene-slot å skrive inn i
              </Typography>
            </Divider>

            <FormControl fullWidth>
              <InputLabel>Struktur-mal</InputLabel>
              <Select
                value={newManuscript.scaffoldTemplateId}
                onChange={(e) =>
                  setNewManuscript({ ...newManuscript, scaffoldTemplateId: String(e.target.value) })
                }
                label="Struktur-mal"
              >
                {MANUSCRIPT_SCAFFOLD_TEMPLATES.map((template) => (
                  <MenuItem key={template.id} value={template.id}>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {template.name}
                        {template.beats.length > 0 && (
                          <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                            ({template.beats.length} scener)
                          </Typography>
                        )}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {template.description}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowNewManuscriptDialog(false)}>Avbryt</Button>
          <Button onClick={handleCreateManuscript} variant="contained">Opprett</Button>
        </DialogActions>
      </Dialog>

      {/* Import Manuscript Dialog */}
      <ImportManuscriptDialog
        open={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onImportComplete={handleImportComplete}
      />

      {/* Template Panel */}
      <ManuscriptTemplatePanel
        open={showTemplatePanel}
        onClose={() => setShowTemplatePanel(false)}
        onApplyTemplate={handleApplyTemplate}
        currentContent={selectedManuscript?.content || ''}
      />

      {/* Edit Manuscript Dialog */}
      <Dialog 
        open={showEditManuscriptDialog} 
        onClose={() => setShowEditManuscriptDialog(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            background: `linear-gradient(165deg, ${branding.colors.background} 0%, ${branding.colors.surface} 100%)`,
            border: `1px solid ${branding.colors.border}`,
            borderRadius: { xs: 3, sm: 2.5 },
            boxShadow: branding.layout.shadowStrong,
            overflow: 'hidden',
          }
        }}
      >
        <DialogTitle
          sx={{
            color: branding.colors.textPrimary,
            borderBottom: `1px solid ${branding.colors.border}`,
            background: `linear-gradient(90deg, ${branding.colors.gradientStart}26 0%, ${branding.colors.gradientEnd}26 100%)`,
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1.5}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <EditIcon sx={{ color: branding.colors.primary }} />
              <Box>
                <Typography sx={{ fontWeight: 700, color: branding.colors.textPrimary }}>Rediger Manuskript</Typography>
                <Typography variant="caption" sx={{ color: branding.colors.textSecondary }}>
                  {branding.identity.appName}
                </Typography>
              </Box>
            </Box>
            <Box
              sx={{
                minWidth: { xs: 120, sm: 170 },
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                flexShrink: 0,
              }}
            >
              <RoleRoomBrandMark appearance="header" showLabel={false} />
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            {/* Cover Image Upload */}
            <Box>
              <Typography variant="subtitle2" sx={{ color: branding.colors.textPrimary, mb: 1 }}>
                Cover-bilde
              </Typography>
              <Box sx={{ 
                display: 'flex', 
                gap: 2, 
                alignItems: 'center',
              }}>
                <Box sx={{ 
                  width: 100, 
                  height: 140, 
                  bgcolor: `${branding.colors.surface}cc`,
                  borderRadius: 2,
                  border: `1px dashed ${branding.colors.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  backgroundSize: 'cover',
                  backgroundPosition: `${editingCoverFocalPoint.x}% ${editingCoverFocalPoint.y}%`,
                  backgroundImage: editingManuscript?.coverImage 
                    ? `url(${editingManuscript.coverImage})`
                    : 'none',
                  cursor: editingManuscript?.coverImage ? 'crosshair' : 'default',
                  position: 'relative',
                }}
                onClick={handleEditCoverFocalPointClick}
                >
                  {!editingManuscript?.coverImage && (
                    <MenuBookIcon sx={{ fontSize: 32, color: branding.colors.textSecondary }} />
                  )}
                  {editingManuscript?.coverImage && (
                    <Box
                      sx={{
                        position: 'absolute',
                        left: `calc(${editingCoverFocalPoint.x}% - 7px)`,
                        top: `calc(${editingCoverFocalPoint.y}% - 7px)`,
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        border: `2px solid ${branding.colors.textPrimary}`,
                        background: `${branding.colors.primary}cc`,
                        boxShadow: '0 0 0 2px rgba(0,0,0,0.35)',
                        pointerEvents: 'none',
                      }}
                    />
                  )}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <input
                    type="file"
                    accept="image/*"
                    id="edit-cover-upload"
                    style={{ display: 'none' }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file && editingManuscript) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const coverImage = event.target?.result as string;
                          setEditingManuscript({
                            ...editingManuscript,
                            coverImage,
                            coverFocalPoint: { ...DEFAULT_MANUSCRIPT_COVER_FOCAL_POINT },
                          });
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => document.getElementById('edit-cover-upload')?.click()}
                    startIcon={<FileUploadIcon />}
                    sx={{
                      borderColor: `${branding.colors.primary}88`,
                      color: branding.colors.primary,
                      mb: 1,
                      '&:hover': { borderColor: branding.colors.primary, bgcolor: `${branding.colors.primary}1a` },
                    }}
                  >
                    Last opp cover
                  </Button>
                  {editingManuscript?.coverImage && (
                    <Button
                      size="small"
                      color="error"
                      onClick={() =>
                        setEditingManuscript({
                          ...editingManuscript!,
                          coverImage: undefined,
                          coverFocalPoint: undefined,
                        })
                      }
                      sx={{ ml: 1 }}
                    >
                      Fjern
                    </Button>
                  )}
                  <Typography variant="caption" sx={{ display: 'block', color: branding.colors.textSecondary, mt: 0.5 }}>
                    Anbefalt størrelse: 600x900px
                  </Typography>
                  {editingManuscript?.coverImage && (
                    <Box sx={{ mt: 1.25 }}>
                      <Typography variant="caption" sx={{ display: 'block', color: branding.colors.textSecondary, mb: 0.5 }}>
                        Fokuser cover (klikk i bildet eller bruk sliders)
                      </Typography>
                      <Box sx={{ px: 0.5 }}>
                        <Typography variant="caption" sx={{ color: branding.colors.textSecondary }}>
                          Horisontal: {Math.round(editingCoverFocalPoint.x)}%
                        </Typography>
                        <Slider
                          size="small"
                          min={0}
                          max={100}
                          value={editingCoverFocalPoint.x}
                          onChange={(_, value) => {
                            const nextX = Array.isArray(value) ? value[0] : value;
                            setEditingCoverFocalPoint(nextX, editingCoverFocalPoint.y);
                          }}
                          sx={{ color: branding.colors.primary, mt: 0.25 }}
                        />
                      </Box>
                      <Box sx={{ px: 0.5, mt: 0.5 }}>
                        <Typography variant="caption" sx={{ color: branding.colors.textSecondary }}>
                          Vertikal: {Math.round(editingCoverFocalPoint.y)}%
                        </Typography>
                        <Slider
                          size="small"
                          min={0}
                          max={100}
                          value={editingCoverFocalPoint.y}
                          onChange={(_, value) => {
                            const nextY = Array.isArray(value) ? value[0] : value;
                            setEditingCoverFocalPoint(editingCoverFocalPoint.x, nextY);
                          }}
                          sx={{ color: branding.colors.primary, mt: 0.25 }}
                        />
                      </Box>
                      <Button
                        size="small"
                        onClick={() => setEditingCoverFocalPoint(
                          DEFAULT_MANUSCRIPT_COVER_FOCAL_POINT.x,
                          DEFAULT_MANUSCRIPT_COVER_FOCAL_POINT.y
                        )}
                        sx={{ mt: 0.5, color: branding.colors.textSecondary }}
                      >
                        Nullstill fokus
                      </Button>
                    </Box>
                  )}
                </Box>
              </Box>
            </Box>

            <TextField
              label="Tittel"
              fullWidth
              required
              value={editManuscriptForm.title}
              onChange={(e) => setEditManuscriptForm({ ...editManuscriptForm, title: e.target.value })}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: branding.colors.textPrimary,
                  '& fieldset': { borderColor: branding.colors.border },
                  '&:hover fieldset': { borderColor: `${branding.colors.primary}88` },
                  '&.Mui-focused fieldset': { borderColor: branding.colors.primary },
                },
                '& .MuiInputLabel-root': { color: branding.colors.textSecondary },
              }}
            />
            <TextField
              label="Undertittel"
              fullWidth
              value={editManuscriptForm.subtitle}
              onChange={(e) => setEditManuscriptForm({ ...editManuscriptForm, subtitle: e.target.value })}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: branding.colors.textPrimary,
                  '& fieldset': { borderColor: branding.colors.border },
                  '&:hover fieldset': { borderColor: `${branding.colors.primary}88` },
                  '&.Mui-focused fieldset': { borderColor: branding.colors.primary },
                },
                '& .MuiInputLabel-root': { color: branding.colors.textSecondary },
              }}
            />
            <TextField
              label="Forfatter"
              fullWidth
              value={editManuscriptForm.author}
              onChange={(e) => setEditManuscriptForm({ ...editManuscriptForm, author: e.target.value })}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: branding.colors.textPrimary,
                  '& fieldset': { borderColor: branding.colors.border },
                  '&:hover fieldset': { borderColor: `${branding.colors.primary}88` },
                  '&.Mui-focused fieldset': { borderColor: branding.colors.primary },
                },
                '& .MuiInputLabel-root': { color: branding.colors.textSecondary },
              }}
            />
            <FormControl fullWidth>
              <InputLabel sx={{ color: branding.colors.textSecondary }}>Status</InputLabel>
              <Select
                value={editManuscriptForm.status}
                onChange={(e) => setEditManuscriptForm({ ...editManuscriptForm, status: e.target.value })}
                label="Status"
                sx={{
                  color: branding.colors.textPrimary,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: branding.colors.border },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: `${branding.colors.primary}88` },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: branding.colors.primary },
                }}
              >
                <MenuItem value="draft">Utkast</MenuItem>
                <MenuItem value="review">Gjennomgang</MenuItem>
                <MenuItem value="approved">Godkjent</MenuItem>
                <MenuItem value="shooting">Produksjon</MenuItem>
                <MenuItem value="completed">Fullført</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions
          sx={{
            p: 2,
            borderTop: `1px solid ${branding.colors.border}`,
            gap: 1,
            flexWrap: 'wrap',
            justifyContent: { xs: 'stretch', sm: 'flex-end' },
            '& .MuiButton-root': {
              width: { xs: '100%', sm: 'auto' },
              maxWidth: '100%',
            },
          }}
        >
          <Button 
            onClick={() => setShowEditManuscriptDialog(false)}
            sx={{ color: branding.colors.textSecondary }}
          >
            Avbryt
          </Button>
          <Button 
            onClick={async () => {
              if (editingManuscript) {
                const updated: Manuscript = {
                  ...editingManuscript,
                  title: editManuscriptForm.title,
                  subtitle: editManuscriptForm.subtitle,
                  author: editManuscriptForm.author,
                  status: editManuscriptForm.status as Manuscript['status'],
                  coverImage: editingManuscript.coverImage,
                  coverFocalPoint: editingManuscript.coverFocalPoint,
                };
                await manuscriptService.updateManuscript(updated);
                loadManuscripts();
                setShowEditManuscriptDialog(false);
                showSuccess('Manuskript oppdatert');
              }
            }} 
            variant="contained"
            sx={{ 
              bgcolor: branding.colors.primary,
              color: branding.colors.textPrimary,
              boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
              whiteSpace: 'nowrap',
              '&:hover': { bgcolor: branding.colors.secondary },
            }}
          >
            Lagre endringer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// Sub-components for each tab
interface EditorTabProps {
  manuscript: Manuscript; 
  onContentChange: (content: string) => void;
  onParseToScenes?: (content: string) => void;
  manuscriptSaveStatus?: 'saved' | 'unsaved' | 'saving' | 'error';
  lastManuscriptSaved?: Date | null;
  characters?: string[];
  locations?: string[];
  castingRoles?: Role[];
  castingLocations?: Location[];
  castingCandidates?: Candidate[];
  scenes?: SceneBreakdown[];
  onCharacterAdd?: (name: string) => void;
  onLocationAdd?: (name: string) => void;
}

interface CharacterProfileOpenPayload {
  characterName: string;
  role: Role | null;
  candidate: Candidate | null;
}

const EditorTab: React.FC<EditorTabProps> = React.memo(({
  manuscript,
  onContentChange,
  onParseToScenes,
  manuscriptSaveStatus = 'saved',
  lastManuscriptSaved = null,
  characters = [],
  locations = [],
  castingRoles = [],
  castingLocations = [],
  castingCandidates = [],
  scenes = [],
  onCharacterAdd,
  onLocationAdd,
}) => {
  const { showSuccess } = useToast();
  const branding = useBrandingSettings();
  const [showAdvancedEditor, setShowAdvancedEditor] = useState(true);
  const [showParseDialog, setShowParseDialog] = useState(false);
  const [selectedRoleMention, setSelectedRoleMention] = useState<CharacterProfileOpenPayload | null>(null);
  
  // Lokal state for editorinnhold - DENNE er source of truth for editoren
  // EditorTab manages its own content state independently from parent
  const [editorContent, setEditorContent] = useState(manuscript.content || '');
  // Ref for å tracke siste synkroniserte id (for å unngå unødvendige syncs)
  const lastSyncedIdRef = useRef(manuscript.id);
  const lastChangeValueRef = useRef(manuscript.content || ''); // Track last value to prevent redundant updates
  
  // Stable onChange callback for ScreenplayEditorWithNavigator - ONLY update parent, NOT local state
  const handleScreenplayChange = useCallback((val: string) => {
    // Only update local state if value actually changed
    if (val !== lastChangeValueRef.current) {
      lastChangeValueRef.current = val;
      setEditorContent(val);
    }
    // Always notify parent immediately (they handle debouncing)
    onContentChange(val);
  }, [onContentChange]);
  
  // CRITICAL: Only sync when document ID changes (switching documents)
  // DO NOT sync when manuscript.content changes - that would create feedback loops with parent
  // EditorTab content is the source of truth, not the parent's manuscript object
  useEffect(() => {
    if (manuscript.id !== lastSyncedIdRef.current) {
      const newContent = manuscript.content || '';
      setEditorContent(newContent);
      lastChangeValueRef.current = newContent;
      lastSyncedIdRef.current = manuscript.id;
      setSelectedRoleMention(null);
    }
  }, [manuscript.id]); // ONLY depend on ID, NOT content
  
  // 7-tier responsive system
  const { tier, isMobile, isTablet, isDesktop, is4K } = useScreenTier();
  const responsive = getResponsiveValues(tier);
  
  // Calculate word and page count - use EditorTab's local content, not parent's
  const contentStats = useMemo(() => {
    const content = editorContent || '';
    const words = content.trim().split(/\s+/).filter(w => w.length > 0).length;
    const characters = content.length;
    const lines = content.split('\n').length;
    // Standard screenplay: 1 page = ~250 words or ~55 lines
    const pages = Math.max(1, Math.round(lines / 55 * 10) / 10);
    const estimatedMinutes = Math.round(pages); // 1 page ≈ 1 minute
    
    // Count scene headings
    const sceneHeadings = content.match(/^(INT|EXT|EST|INT\.?\/EXT|I\/E)[.\s]/gim)?.length || 0;
    
    // Count characters (uppercase lines followed by dialogue)
    const characterMatches = content.match(/^[A-ZÆØÅ][A-ZÆØÅ0-9\s\-'.]*(\s*\(.*\))?$/gm) || [];
    const uniqueCharacters = [...new Set(characterMatches.map(c => c.replace(/\s*\(.*\)$/, '').trim()))];
    
    return { words, characters, lines, pages, estimatedMinutes, sceneHeadings, uniqueCharacters };
  }, [editorContent]);
  
  // Combine characters from scenes with casting roles - STABLE via stringified deps
  const allCharacters = useMemo(() => {
    const roleNames = castingRoles.map(r => r.name.toUpperCase());
    const sceneCharacters = characters.map(c => c.toUpperCase());
    // Merge and deduplicate, prioritizing casting roles
    const combined = [...new Set([...roleNames, ...sceneCharacters])];
    return combined.sort();
  }, [JSON.stringify(characters), JSON.stringify(castingRoles.map(r => r.name))]);
  
  // Combine locations from scenes with casting locations - STABLE via stringified deps
  const allLocations = useMemo(() => {
    const castingLocs = castingLocations.map(l => l.name);
    const sceneLocs = locations;
    return [...new Set([...castingLocs, ...sceneLocs])].sort();
  }, [JSON.stringify(locations), JSON.stringify(castingLocations.map(l => l.name))]);

  const handleSceneSelect = useCallback((_scene: any) => {}, []);

  const handleCharacterProfileOpen = useCallback((payload: CharacterProfileOpenPayload) => {
    if (!payload.role && !payload.candidate) {
      setSelectedRoleMention(null);
      return;
    }
    setSelectedRoleMention(payload);
  }, []);

  const closeProfileDialogs = useCallback(() => {
    setSelectedRoleMention(null);
  }, []);

  const roleDescription = useMemo(() => {
    const raw = selectedRoleMention?.role?.description;
    if (typeof raw !== 'string' || !raw.trim()) return '';
    return raw
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }, [selectedRoleMention?.role?.description]);

  const handleParseToScenes = () => {
    if (onParseToScenes) {
      onParseToScenes(editorContent);
      showSuccess(`Parsert ${contentStats.sceneHeadings} scener fra manuskriptet`);
    }
    setShowParseDialog(false);
  };

  if (!showAdvancedEditor) {
    // Fallback to simple textarea
    return (
      <Box>
        <Stack 
          direction={isMobile ? 'column' : 'row'} 
          spacing={responsive.spacing} 
          sx={{ mb: responsive.spacing }} 
          alignItems={isMobile ? 'stretch' : 'center'}
        >
          <Alert severity="info" sx={{ flex: 1 }}>
            <Typography variant="body2" sx={{ fontSize: responsive.bodyFontSize }}>
              Skriv manuskriptet i {manuscript.format === 'fountain' ? 'Fountain' : manuscript.format} format.
              {manuscript.format === 'fountain' && ' Sceneoverskrifter starter med INT. eller EXT.'}
            </Typography>
          </Alert>
          <Button
            variant="outlined"
            size={responsive.buttonSize}
            onClick={() => setShowAdvancedEditor(true)}
            sx={{ fontSize: responsive.bodyFontSize }}
          >
            Avansert Editor
          </Button>
        </Stack>
        <TextField
          fullWidth
          multiline
          rows={isMobile ? 15 : isTablet ? 20 : 25}
          value={manuscript.content}
          onChange={(e) => onContentChange(e.target.value)}
          placeholder={`Eksempel (Fountain format):

INT. APARTMENT - DAY

ANNA (30s, energisk) kommer inn med kaffekrus.

ANNA
Har du sett manuskriptet?

BJØRN (40s) ser opp fra datamaskinen.

BJØRN
(smilende)
Det ligger på bordet.

EXT. CITY STREET - NIGHT

Anna går raskt gjennom regnet.
`}
          sx={{
            fontFamily: 'Courier New, monospace',
            fontSize: is4K ? '16px' : isDesktop ? '14px' : '13px',
            '& .MuiInputBase-input': {
              lineHeight: 1.6,
            },
          }}
        />
      </Box>
    );
  }

  return (
    <Box sx={{
      height: isMobile ? 'calc(100vh - 350px)' : 'calc(100vh - 300px)',
      minHeight: isMobile ? 350 : 500,
      // WCAG 2.2 - 2.5.5 Target Size: alle interaktive IconButton-er i
      // manuskript-panelet får automatisk 44×44 touch-target. Eksisterende
      // size="small"-IconButtons utvides via min-target uten å påvirke
      // visuell ikon-størrelse (selve ikonet beholdes via fontSize-prop).
      '& .MuiIconButton-root': {
        minWidth: TOUCH_TARGET_SIZE,
        minHeight: TOUCH_TARGET_SIZE,
      },
    }}>
      <Stack
        direction={isMobile ? 'column' : 'row'}
        spacing={isMobile ? 1 : responsive.spacing}
        sx={{ mb: responsive.spacing }}
        alignItems={isMobile ? 'stretch' : 'center'}
        justifyContent="space-between"
      >
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Chip 
            label={isMobile ? 'Fountain' : 'Fountain Editor'} 
            color="primary" 
            size={responsive.chipSize}
            icon={<CodeIcon sx={{ fontSize: responsive.iconSize - 6 }} />}
            sx={{ fontSize: responsive.captionFontSize }}
          />
          {!isMobile && (
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: responsive.captionFontSize }}>
              Profesjonell screenplay-editor med syntax highlighting
            </Typography>
          )}
        </Stack>
        <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ gap: 0.5 }}>
          {onParseToScenes && contentStats.sceneHeadings > 0 && (
            <Button
              variant="outlined"
              size={responsive.buttonSize}
              startIcon={!isMobile ? <AutoFixHighIcon sx={{ fontSize: responsive.iconSize - 4 }} /> : undefined}
              onClick={() => setShowParseDialog(true)}
              sx={{ fontSize: responsive.captionFontSize }}
            >
              {isMobile ? `Parser (${contentStats.sceneHeadings})` : `Parser til Scener (${contentStats.sceneHeadings})`}
            </Button>
          )}
          <React.Suspense fallback={<CircularProgress size={isMobile ? 16 : 20} />}>
            <LazyScreenplayPDFExport
              content={manuscript.content}
              title={manuscript.title}
              author={manuscript.author}
            />
          </React.Suspense>
          <Button
            variant="text"
            size={responsive.buttonSize}
            onClick={() => setShowAdvancedEditor(false)}
            sx={{ fontSize: responsive.captionFontSize }}
          >
            {isMobile ? 'Enkel' : 'Enkel Editor'}
          </Button>
        </Stack>
      </Stack>
      
      <React.Suspense fallback={
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <CircularProgress size={is4K ? 48 : isDesktop ? 40 : 32} />
        </Box>
      }>
          <LazyScreenplayEditorWithNavigator
            editorKey={manuscript.id}
            value={editorContent}
            onChange={handleScreenplayChange}
            scriptTitle={manuscript.title}
            headerSummary={{
              pages: manuscript.pageCount || 0,
              runtimeMinutes: Math.max(0, Math.round(manuscript.pageCount || contentStats.estimatedMinutes)),
              sceneCount: scenes.length,
              characterCount: allCharacters.length,
              statusLabel: (manuscript.status ?? 'draft').toUpperCase(),
              saveLabel:
                manuscriptSaveStatus === 'saved'
                  ? (lastManuscriptSaved
                      ? `Lagret ${lastManuscriptSaved.toLocaleTimeString('nb-NO')}`
                      : 'Lagret')
                  : manuscriptSaveStatus === 'saving'
                    ? 'Lagrer...'
                    : manuscriptSaveStatus === 'error'
                      ? 'Lagringsfeil'
                      : 'Ulagret',
              saveState: manuscriptSaveStatus,
            }}
            characters={allCharacters}
            locations={allLocations}
            roles={castingRoles}
            candidates={castingCandidates}
            scenes={scenes}
            onCharacterAdd={onCharacterAdd}
            onLocationAdd={onLocationAdd}
            onCharacterProfileOpen={handleCharacterProfileOpen}
            onSceneSelect={handleSceneSelect}
          />
      </React.Suspense>

      <Dialog
        open={Boolean(selectedRoleMention?.role)}
        onClose={closeProfileDialogs}
        fullScreen={isMobile}
        hideBackdrop={!isMobile}
        disableEnforceFocus
        disableAutoFocus
        PaperProps={{
          sx: isMobile ? undefined : {
            position: 'fixed',
            top: '8vh',
            left: '3vw',
            m: 0,
            width: '44vw',
            maxWidth: 680,
            maxHeight: '84vh',
          },
        }}
      >
        <DialogTitle sx={{ fontSize: responsive.titleFontSize }}>
          Rolleprofil: {selectedRoleMention?.role?.name || selectedRoleMention?.characterName}
        </DialogTitle>
        <DialogContent dividers>
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mb: 1.5 }}>
            <Chip
              size={responsive.chipSize}
              color="primary"
              variant="outlined"
              label={`Status: ${selectedRoleMention?.role?.status || 'ukjent'}`}
              sx={{ fontSize: responsive.captionFontSize }}
            />
            {typeof selectedRoleMention?.role?.roleType === 'string' && selectedRoleMention.role.roleType.trim() && (
              <Chip
                size={responsive.chipSize}
                variant="outlined"
                label={`Type: ${selectedRoleMention.role.roleType}`}
                sx={{ fontSize: responsive.captionFontSize }}
              />
            )}
          </Stack>
          {roleDescription ? (
            <Typography sx={{ color: branding.colors.textPrimary, fontSize: responsive.bodyFontSize }}>
              {roleDescription}
            </Typography>
          ) : (
            <Typography color="text.secondary" sx={{ fontSize: responsive.bodyFontSize }}>
              Ingen rollebeskrivelse tilgjengelig.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeProfileDialogs} size={responsive.buttonSize}>
            Lukk
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(selectedRoleMention?.role)}
        onClose={closeProfileDialogs}
        fullScreen={isMobile}
        hideBackdrop={!isMobile}
        disableEnforceFocus
        disableAutoFocus
        PaperProps={{
          sx: isMobile ? undefined : {
            position: 'fixed',
            top: '8vh',
            right: '3vw',
            m: 0,
            width: '44vw',
            maxWidth: 680,
            maxHeight: '84vh',
          },
        }}
      >
        <DialogTitle sx={{ fontSize: responsive.titleFontSize }}>
          Kandidat for {selectedRoleMention?.role?.name || selectedRoleMention?.characterName}
        </DialogTitle>
        <DialogContent dividers>
          {selectedRoleMention?.candidate ? (
            <>
              <Typography variant="h6" sx={{ fontSize: responsive.titleFontSize, fontWeight: 700 }}>
                {selectedRoleMention.candidate.name}
              </Typography>
              <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 1, mb: 1.5 }}>
                <Chip
                  size={responsive.chipSize}
                  color="success"
                  variant="outlined"
                  label={`Status: ${selectedRoleMention.candidate.status || 'ukjent'}`}
                  sx={{ fontSize: responsive.captionFontSize }}
                />
                {typeof selectedRoleMention.candidate.agency === 'string' && selectedRoleMention.candidate.agency.trim() && (
                  <Chip
                    size={responsive.chipSize}
                    variant="outlined"
                    label={selectedRoleMention.candidate.agency}
                    sx={{ fontSize: responsive.captionFontSize }}
                  />
                )}
              </Stack>
              {(selectedRoleMention.candidate.email || selectedRoleMention.candidate.phone) ? (
                <Typography sx={{ color: branding.colors.textPrimary, fontSize: responsive.bodyFontSize }}>
                  {selectedRoleMention.candidate.email || ''}
                  {selectedRoleMention.candidate.email && selectedRoleMention.candidate.phone ? ' • ' : ''}
                  {selectedRoleMention.candidate.phone || ''}
                </Typography>
              ) : (
                <Typography color="text.secondary" sx={{ fontSize: responsive.bodyFontSize }}>
                  Ingen kontaktinfo registrert.
                </Typography>
              )}
            </>
          ) : (
            <Alert severity="warning">
              <Typography variant="body2" sx={{ fontSize: responsive.bodyFontSize }}>
                Ingen kandidat er koblet til denne rollen ennå.
              </Typography>
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeProfileDialogs} size={responsive.buttonSize}>
            Lukk
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Info about character sources */}
      {castingRoles.length > 0 && (
        <Alert severity="success" sx={{ mt: responsive.spacing }}>
          <Typography variant="body2" sx={{ fontSize: responsive.bodyFontSize }}>
            <strong>{castingRoles.length}</strong> roller fra The Role Room er tilgjengelig i autocomplete.
            {castingLocations.length > 0 && ` ${castingLocations.length} lokasjoner tilgjengelig.`}
          </Typography>
        </Alert>
      )}
      
      {/* Parse to Scenes Dialog */}
      <Dialog 
        open={showParseDialog} 
        onClose={() => setShowParseDialog(false)} 
        maxWidth="sm" 
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle sx={{ fontSize: responsive.titleFontSize }}>
          Parser Manuskript til Scener
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: responsive.spacing }}>
            <Typography variant="body2" sx={{ fontSize: responsive.bodyFontSize }}>
              Denne funksjonen vil analysere manuskriptet og opprette scener basert på sceneoverskrifter 
              (INT./EXT.). Eksisterende scener vil bli oppdatert.
            </Typography>
          </Alert>
          <Typography variant="body1" sx={{ mb: responsive.spacing, fontSize: responsive.bodyFontSize }}>
            Fant <strong>{contentStats.sceneHeadings}</strong> sceneoverskrifter og 
            <strong> {contentStats.uniqueCharacters.length}</strong> karakterer i manuskriptet.
          </Typography>
          {contentStats.uniqueCharacters.length > 0 && (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontSize: responsive.captionFontSize }}>
                Karakterer funnet:
              </Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5}>
                {contentStats.uniqueCharacters.slice(0, isMobile ? 10 : 15).map(char => (
                  <Chip 
                    key={char} 
                    label={char} 
                    size={responsive.chipSize} 
                    variant="outlined" 
                    sx={{ fontSize: responsive.captionFontSize }}
                  />
                ))}
                {contentStats.uniqueCharacters.length > (isMobile ? 10 : 15) && (
                  <Chip 
                    label={`+${contentStats.uniqueCharacters.length - (isMobile ? 10 : 15)} til`} 
                    size={responsive.chipSize}
                    sx={{ fontSize: responsive.captionFontSize }}
                  />
                )}
              </Stack>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: responsive.padding }}>
          <Button 
            onClick={() => setShowParseDialog(false)}
            size={responsive.buttonSize}
            sx={{ fontSize: responsive.bodyFontSize }}
          >
            Avbryt
          </Button>
          <Button 
            variant="contained" 
            onClick={handleParseToScenes}
            startIcon={<AutoFixHighIcon sx={{ fontSize: responsive.iconSize - 4 }} />}
            size={responsive.buttonSize}
            sx={{ fontSize: responsive.bodyFontSize }}
          >
            Parser Scener
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}, (prevProps, nextProps) => {
  // Return TRUE if props are equal (skip re-render), FALSE if different (re-render)
  
  // Check manuscript changes
  if (prevProps.manuscript.id !== nextProps.manuscript.id) return false;
  if (prevProps.manuscript.content !== nextProps.manuscript.content) return false;
  
  // Check callback reference equality
  if (prevProps.onContentChange !== nextProps.onContentChange) return false;
  if (prevProps.onParseToScenes !== nextProps.onParseToScenes) return false;
  
  // Check character count changes (not full array comparison)
  if (prevProps.characters?.length !== nextProps.characters?.length) return false;
  
  // Check location count changes
  if (prevProps.locations?.length !== nextProps.locations?.length) return false;
  
  // Check casting roles count (not array comparison)
  if (prevProps.castingRoles?.length !== nextProps.castingRoles?.length) return false;
  
  // Check casting locations count
  if (prevProps.castingLocations?.length !== nextProps.castingLocations?.length) return false;

  // Check casting candidates count
  if (prevProps.castingCandidates?.length !== nextProps.castingCandidates?.length) return false;
  
  // Check scenes count
  if (prevProps.scenes?.length !== nextProps.scenes?.length) return false;
  
  // All checks passed - props are effectively equal, skip re-render
  return true;
});

const ActsTab: React.FC<{
  acts: Act[];
  manuscriptId: string;
  onActsChange: (acts: Act[]) => void;
}> = ({ acts, manuscriptId, onActsChange }) => {
  const { showSuccess, showError } = useToast();
  const branding = useBrandingSettings();
  const [showDialog, setShowDialog] = useState(false);
  const [editingAct, setEditingAct] = useState<Act | null>(null);
  const [formData, setFormData] = useState({
    actNumber: 1,
    title: '',
    description: '',
    pageStart: 1,
    pageEnd: 1,
    estimatedRuntime: 30,
    colorCode: '',
  });
  
  // 7-tier responsive system
  const { tier, isMobile, isTablet, isDesktop, is4K } = useScreenTier();
  const responsive = getResponsiveValues(tier);
  const tableDensity: 'small' | 'medium' = isTablet ? 'small' : isDesktop ? 'medium' : 'small';
  const dialogMaxWidth: 'sm' | 'md' = is4K ? 'md' : 'sm';

  const handleCreate = () => {
    setEditingAct(null);
    setFormData({
      actNumber: acts.length + 1,
      title: '',
      description: '',
      pageStart: acts.length > 0 ? (acts[acts.length - 1].pageEnd || 0) + 1 : 1,
      pageEnd: 1,
      estimatedRuntime: 30,
      colorCode: '',
    });
    setShowDialog(true);
  };

  const handleEdit = (act: Act) => {
    setEditingAct(act);
    setFormData({
      actNumber: act.actNumber ?? act.index ?? 1,
      title: act.title || '',
      description: act.description || '',
      pageStart: act.pageStart || 1,
      pageEnd: act.pageEnd || 1,
      estimatedRuntime: act.estimatedRuntime || 30,
      colorCode: act.colorCode || '',
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    try {
      const act: Act = {
        id: editingAct?.id || `act-${Date.now()}`,
        manuscriptId,
        projectId: '', // Will be set by backend if needed
        actNumber: formData.actNumber,
        title: formData.title,
        description: formData.description,
        pageStart: formData.pageStart,
        pageEnd: formData.pageEnd,
        estimatedRuntime: formData.estimatedRuntime,
        colorCode: formData.colorCode,
        sortOrder: editingAct?.sortOrder || formData.actNumber,
        createdAt: editingAct?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (editingAct) {
        await manuscriptService.updateAct(act);
        onActsChange(acts.map(a => a.id === act.id ? act : a));
        showSuccess('Akt oppdatert');
      } else {
        await manuscriptService.createAct(act);
        onActsChange([...acts, act]);
        showSuccess('Akt opprettet');
      }

      setShowDialog(false);
    } catch (error) {
      showError('Feil ved lagring av akt');
      console.error(error);
    }
  };

  const handleDelete = async (actId: string) => {
    if (!confirm('Er du sikker på at du vil slette denne akten?')) return;

    try {
      await manuscriptService.deleteAct(actId, manuscriptId);
      onActsChange(acts.filter(a => a.id !== actId));
      showSuccess('Akt slettet');
    } catch (error) {
      showError('Feil ved sletting av akt');
      console.error(error);
    }
  };

  return (
    <Box>
      <Stack 
        direction={isMobile ? 'column' : 'row'} 
        justifyContent="space-between" 
        alignItems={isMobile ? 'stretch' : 'center'} 
        spacing={responsive.spacing}
        sx={{ mb: responsive.spacing }}
      >
        <Typography variant="h6" sx={{ fontSize: responsive.titleFontSize }}>
          Akter / Kapitler
        </Typography>
        <Button 
          startIcon={!isMobile ? <AddIcon sx={{ fontSize: responsive.iconSize - 4 }} /> : undefined} 
          variant="outlined" 
          size={responsive.buttonSize}
          onClick={handleCreate}
          sx={{ fontSize: responsive.bodyFontSize }}
        >
          {isMobile ? 'Ny Akt' : 'Legg til Akt'}
        </Button>
      </Stack>

      {acts.length === 0 ? (
        <Alert severity="info">
          <Typography sx={{ fontSize: responsive.bodyFontSize }}>
            Ingen akter ennå. Opprett akter for å strukturere manuskriptet i kapitler eller akter.
          </Typography>
        </Alert>
      ) : isMobile ? (
        // Mobile: Card-based layout
        <Stack spacing={responsive.spacing}>
          {acts.map((act) => (
            <Card key={act.id} sx={{ p: responsive.padding }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: responsive.titleFontSize }}>
                    Akt {act.actNumber}: {act.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: responsive.captionFontSize, mt: 0.5 }}>
                    {act.description || 'Ingen beskrivelse'}
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    <Chip 
                      label={act.pageStart && act.pageEnd ? `s. ${act.pageStart}-${act.pageEnd}` : 'Ingen sider'} 
                      size="small" 
                      sx={{ fontSize: responsive.captionFontSize }}
                    />
                    <Chip 
                      label={act.estimatedRuntime ? `${act.estimatedRuntime} min` : '-'} 
                      size="small"
                      sx={{ fontSize: responsive.captionFontSize }}
                    />
                  </Stack>
                </Box>
                <Stack direction="row">
                  <IconButton size="small" onClick={() => handleEdit(act)}>
                    <EditIcon sx={{ fontSize: responsive.iconSize - 4 }} />
                  </IconButton>
                  <IconButton size="small" onClick={() => handleDelete(act.id)}>
                    <DeleteIcon sx={{ fontSize: responsive.iconSize - 4 }} />
                  </IconButton>
                </Stack>
              </Stack>
            </Card>
          ))}
        </Stack>
      ) : (
        <TableContainer component={Paper}>
          <Table size={tableDensity}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontSize: responsive.bodyFontSize }}>Akt #</TableCell>
                <TableCell sx={{ fontSize: responsive.bodyFontSize }}>Tittel</TableCell>
                {!isTablet && <TableCell sx={{ fontSize: responsive.bodyFontSize }}>Beskrivelse</TableCell>}
                <TableCell sx={{ fontSize: responsive.bodyFontSize }}>Sider</TableCell>
                <TableCell sx={{ fontSize: responsive.bodyFontSize }}>Varighet</TableCell>
                <TableCell sx={{ fontSize: responsive.bodyFontSize }}>Handlinger</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {acts.map((act) => (
                <TableRow key={act.id}>
                  <TableCell sx={{ fontSize: responsive.bodyFontSize }}>{act.actNumber}</TableCell>
                  <TableCell sx={{ fontSize: responsive.bodyFontSize }}>{act.title}</TableCell>
                  {!isTablet && <TableCell sx={{ fontSize: responsive.bodyFontSize }}>{act.description || '-'}</TableCell>}
                  <TableCell sx={{ fontSize: responsive.bodyFontSize }}>
                    {act.pageStart && act.pageEnd ? `${act.pageStart}-${act.pageEnd}` : '-'}
                  </TableCell>
                  <TableCell sx={{ fontSize: responsive.bodyFontSize }}>{act.estimatedRuntime ? `${act.estimatedRuntime} min` : '-'}</TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => handleEdit(act)}>
                      <EditIcon sx={{ fontSize: responsive.iconSize - 4 }} />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDelete(act.id)}>
                      <DeleteIcon sx={{ fontSize: responsive.iconSize - 4 }} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onClose={() => setShowDialog(false)} maxWidth={dialogMaxWidth} fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ fontSize: responsive.titleFontSize }}>{editingAct ? 'Rediger Akt' : 'Ny Akt'}</DialogTitle>
        <DialogContent>
          <Stack spacing={responsive.spacing} sx={{ mt: 1 }}>
            <TextField
              label="Akt Nummer"
              type="number"
              value={formData.actNumber}
              onChange={(e) => setFormData({ ...formData, actNumber: parseInt(e.target.value) })}
              fullWidth
              size={isMobile ? 'small' : 'medium'}
            />
            <TextField
              label="Tittel"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              fullWidth
              size={isMobile ? 'small' : 'medium'}
            />
            <TextField
              label="Beskrivelse"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              multiline
              rows={3}
              fullWidth
            />
            <Stack direction={isMobile ? 'column' : 'row'} spacing={responsive.spacing}>
              <TextField
                label="Start Side"
                type="number"
                value={formData.pageStart}
                onChange={(e) => setFormData({ ...formData, pageStart: parseInt(e.target.value) })}
                fullWidth
                size={isMobile ? 'small' : 'medium'}
              />
              <TextField
                label="Slutt Side"
                type="number"
                value={formData.pageEnd}
                onChange={(e) => setFormData({ ...formData, pageEnd: parseInt(e.target.value) })}
                fullWidth
                size={isMobile ? 'small' : 'medium'}
              />
            </Stack>
            <TextField
              label="Estimert Varighet (minutter)"
              type="number"
              value={formData.estimatedRuntime}
              onChange={(e) => setFormData({ ...formData, estimatedRuntime: parseInt(e.target.value) })}
              fullWidth
              size={isMobile ? 'small' : 'medium'}
            />
            <TextField
              label="Fargekode (hex)"
              value={formData.colorCode}
              onChange={(e) => setFormData({ ...formData, colorCode: e.target.value })}
              placeholder={branding.colors.primary}
              fullWidth
              size={isMobile ? 'small' : 'medium'}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: responsive.padding }}>
          <Button onClick={() => setShowDialog(false)} size={responsive.buttonSize} sx={{ fontSize: responsive.bodyFontSize }}>
            Avbryt
          </Button>
          <Button onClick={handleSave} variant="contained" size={responsive.buttonSize} sx={{ fontSize: responsive.bodyFontSize }}>
            {editingAct ? 'Oppdater' : 'Opprett'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

const ScenesTab: React.FC<{
  scenes: SceneBreakdown[];
  viewMode: 'list' | 'drag' | 'storyboard';
  onViewModeChange: (mode: 'list' | 'drag' | 'storyboard') => void;
  onAddScene: () => void;
  onEditScene: (scene: SceneBreakdown) => void;
  onSelectScene: (scene: SceneBreakdown) => void;
  onReorderScenes: (scenes: SceneBreakdown[]) => void;
  selectedScene?: SceneBreakdown;
  highlightedSceneIds?: Set<string>;
  /** Cinema-format på prosjektnivå — propageres til storyboard-view. */
  projectCinemaFormat?: '16:9' | '4:3' | '2.39:1' | '2.35:1' | '1.85:1' | '2.76:1' | '1:1' | '9:16';
}> = ({ scenes, viewMode, onViewModeChange, onAddScene, onEditScene, onSelectScene, onReorderScenes, selectedScene, highlightedSceneIds, projectCinemaFormat }) => {
  // 7-tier responsive system
  const { tier, isMobile, isTablet, isDesktop, is4K } = useScreenTier();
  const responsive = getResponsiveValues(tier);
  const sceneHeadingMaxWidth = isTablet ? 150 : is4K ? 420 : 300;

  // Auto-scroll til første highlightede scene når sett endres. Brukes av
  // resume-banner-actions (stale-draft / unscheduled / empty-scaffold) så
  // brukeren faktisk ser hvilke scener threaden gjelder.
  const firstHighlightedId = useMemo(() => {
    if (!highlightedSceneIds || highlightedSceneIds.size === 0) return null;
    return scenes.find((scene) => highlightedSceneIds.has(scene.id))?.id ?? null;
  }, [highlightedSceneIds, scenes]);
  const firstHighlightedRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (firstHighlightedId && firstHighlightedRef.current) {
      firstHighlightedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [firstHighlightedId]);

  const isHighlighted = (sceneId: string): boolean =>
    !!highlightedSceneIds && highlightedSceneIds.has(sceneId);

  return (
    <Box>
      <Stack 
        direction={isMobile ? 'column' : 'row'} 
        justifyContent="space-between" 
        alignItems={isMobile ? 'stretch' : 'center'} 
        spacing={responsive.spacing}
        sx={{ mb: responsive.spacing }}
      >
        <Typography variant="h6" sx={{ fontSize: responsive.titleFontSize }}>Scene Breakdown</Typography>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ gap: isMobile ? 0.5 : 1 }}>
          <Button 
            startIcon={!isMobile ? <AddIcon sx={{ fontSize: responsive.iconSize - 4 }} /> : undefined} 
            variant="outlined" 
            size={responsive.buttonSize}
            onClick={onAddScene}
            sx={{ fontSize: responsive.bodyFontSize }}
          >
            {isMobile ? 'Ny Scene' : 'Legg til Scene'}
          </Button>
          <Divider orientation="vertical" flexItem />
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, mode) => mode && onViewModeChange(mode)}
            size={isMobile ? 'small' : 'medium'}
          >
            <ToggleButton value="list">
              <FormatListNumberedIcon sx={{ fontSize: responsive.iconSize - 4 }} />
              {isDesktop && (
                <Typography component="span" sx={{ ml: 0.75, fontSize: responsive.captionFontSize }}>
                  Liste
                </Typography>
              )}
            </ToggleButton>
            <ToggleButton value="drag">
              <DragIcon sx={{ fontSize: responsive.iconSize - 4 }} />
              {isDesktop && (
                <Typography component="span" sx={{ ml: 0.75, fontSize: responsive.captionFontSize }}>
                  Dra
                </Typography>
              )}
            </ToggleButton>
            <ToggleButton value="storyboard">
              <ViewModuleIcon sx={{ fontSize: responsive.iconSize - 4 }} />
              {isDesktop && (
                <Typography component="span" sx={{ ml: 0.75, fontSize: responsive.captionFontSize }}>
                  Storyboard
                </Typography>
              )}
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Stack>

      {scenes.length === 0 ? (
        <Alert severity="info">
          <Typography sx={{ fontSize: responsive.bodyFontSize }}>
            Ingen scener ennå. Bruk "Auto Breakdown" for å generere scener fra manuskriptet.
          </Typography>
        </Alert>
      ) : viewMode === 'drag' ? (
        <DraggableSceneList
          scenes={scenes}
          onReorder={onReorderScenes}
          onSceneSelect={onSelectScene}
          selectedScene={selectedScene}
        />
      ) : viewMode === 'storyboard' && selectedScene ? (
        <StoryboardIntegrationView
          scene={selectedScene}
          projectCinemaFormat={projectCinemaFormat}
          onUpdate={(updatedScene) => {
            onReorderScenes(scenes.map(s => s.id === updatedScene.id ? updatedScene : s));
          }}
        />
      ) : isMobile ? (
        // Mobile: Card-based layout
        <Stack spacing={1}>
          {scenes.map((scene) => (
            <Card
              key={scene.id}
              ref={scene.id === firstHighlightedId ? (firstHighlightedRef as React.RefObject<HTMLDivElement>) : undefined}
              onClick={() => onSelectScene(scene)}
              sx={{
                cursor: 'pointer',
                bgcolor: selectedScene?.id === scene.id ? 'action.selected' : undefined,
                p: 1.5,
                borderLeft: isHighlighted(scene.id) ? '4px solid' : undefined,
                borderLeftColor: isHighlighted(scene.id) ? 'warning.main' : undefined,
                transition: 'border-color 200ms',
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box sx={{ flex: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: responsive.bodyFontSize }}>
                      #{scene.sceneNumber}
                    </Typography>
                    <Chip label={scene.intExt} size="small" sx={{ fontSize: responsive.captionFontSize }} />
                    <Chip label={scene.timeOfDay} size="small" variant="outlined" sx={{ fontSize: responsive.captionFontSize }} />
                  </Stack>
                  <Typography variant="body2" sx={{ fontSize: responsive.captionFontSize, mt: 0.5, color: 'text.secondary' }}>
                    {scene.sceneHeading}
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                    <Typography variant="caption" sx={{ fontSize: responsive.captionFontSize }}>
                      {scene.pageLength?.toFixed(1) || '-'} sider
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: responsive.captionFontSize }}>
                      {scene.characters?.length || 0} karakterer
                    </Typography>
                  </Stack>
                </Box>
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); onEditScene(scene); }}>
                  <EditIcon sx={{ fontSize: responsive.iconSize - 4 }} />
                </IconButton>
              </Stack>
            </Card>
          ))}
        </Stack>
      ) : (
        <TableContainer component={Paper}>
          <Table size={isTablet ? 'small' : 'medium'}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontSize: responsive.bodyFontSize }}>Scene #</TableCell>
                <TableCell sx={{ fontSize: responsive.bodyFontSize }}>Heading</TableCell>
                <TableCell sx={{ fontSize: responsive.bodyFontSize }}>INT/EXT</TableCell>
                {!isTablet && <TableCell sx={{ fontSize: responsive.bodyFontSize }}>Time</TableCell>}
                <TableCell sx={{ fontSize: responsive.bodyFontSize }}>Pages</TableCell>
                {!isTablet && <TableCell sx={{ fontSize: responsive.bodyFontSize }}>Characters</TableCell>}
                <TableCell sx={{ fontSize: responsive.bodyFontSize }}>Status</TableCell>
                <TableCell sx={{ fontSize: responsive.bodyFontSize }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {scenes.map((scene) => (
                <TableRow
                  key={scene.id}
                  ref={scene.id === firstHighlightedId ? (firstHighlightedRef as React.RefObject<HTMLTableRowElement>) : undefined}
                  hover
                  selected={selectedScene?.id === scene.id}
                  onClick={() => onSelectScene(scene)}
                  sx={{
                    cursor: 'pointer',
                    borderLeft: isHighlighted(scene.id) ? '4px solid' : undefined,
                    borderLeftColor: isHighlighted(scene.id) ? 'warning.main' : undefined,
                  }}
                >
                  <TableCell sx={{ fontSize: responsive.bodyFontSize }}>{scene.sceneNumber}</TableCell>
                  <TableCell sx={{ fontSize: responsive.bodyFontSize, maxWidth: sceneHeadingMaxWidth, overflow: 'hidden', textOverflow: 'ellipsis' }}>{scene.sceneHeading}</TableCell>
                  <TableCell sx={{ fontSize: responsive.bodyFontSize }}>{scene.intExt}</TableCell>
                  {!isTablet && <TableCell sx={{ fontSize: responsive.bodyFontSize }}>{scene.timeOfDay}</TableCell>}
                  <TableCell sx={{ fontSize: responsive.bodyFontSize }}>{scene.pageLength?.toFixed(2) || '-'}</TableCell>
                  {!isTablet && <TableCell sx={{ fontSize: responsive.bodyFontSize }}>{scene.characters?.length || 0}</TableCell>}
                  <TableCell>
                    <Chip
                      label={scene.status}
                      size={responsive.chipSize}
                      color={scene.status === 'completed' ? 'success' : 'default'}
                      sx={{ fontSize: responsive.captionFontSize }}
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); onEditScene(scene); }}>
                      <EditIcon sx={{ fontSize: responsive.iconSize - 4 }} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

interface CharacterProfile {
  name: string;
  alias?: string;
  description?: string;
  age?: string;
  role?: 'lead' | 'supporting' | 'minor' | 'extra';
  sceneCount: number;
  dialogueCount: number;
  scenesAppearing: string[];
}

const CharactersTab: React.FC<{ 
  characters: string[]; 
  dialogueLines: DialogueLine[];
  scenes?: SceneBreakdown[];
  manuscriptId?: string;
  onCharactersChange?: (characters: CharacterProfile[]) => void;
}> = ({
  characters,
  dialogueLines,
  scenes = [],
  manuscriptId,
  onCharactersChange,
}) => {
  const { showSuccess, showError } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<string | null>(null);
  const [characterProfiles, setCharacterProfiles] = useState<Record<string, StoredCharacterProfile>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    alias: '',
    description: '',
    age: '',
    role: 'supporting' as 'lead' | 'supporting' | 'minor' | 'extra',
  });
  const [searchQuery, setSearchQuery] = useState('');
  
  // 7-tier responsive system
  const { tier, isMobile, isTablet, isDesktop, is4K } = useScreenTier();
  const responsive = getResponsiveValues(tier);
  const characterGridColumns = isMobile
    ? '1fr'
    : isTablet
      ? 'repeat(2, minmax(0, 1fr))'
      : is4K
        ? 'repeat(5, minmax(0, 1fr))'
        : isDesktop
          ? 'repeat(4, minmax(0, 1fr))'
          : 'repeat(3, minmax(0, 1fr))';

  // Load character profiles from database/settings cache on mount
  useEffect(() => {
    if (!manuscriptId) {
      setIsLoading(false);
      return;
    }
    
    let mounted = true;
    const loadProfiles = async () => {
      try {
        const profiles = await characterProfileService.getProfiles(manuscriptId);
        if (mounted) {
          setCharacterProfiles(profiles);
        }
      } catch (error) {
        console.error('Error loading character profiles:', error);
        showError('Kunne ikke laste karakterprofiler');
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };
    
    loadProfiles();
    return () => { mounted = false; };
  }, [manuscriptId]);

  // Save character profiles to database whenever they change (debounced)
  useEffect(() => {
    if (!manuscriptId || Object.keys(characterProfiles).length === 0 || isLoading) return;
    
    const saveProfiles = async () => {
      setIsSaving(true);
      try {
        await characterProfileService.saveProfiles(manuscriptId, characterProfiles);
        console.log('✓ Character profiles saved to database');
      } catch (error) {
        console.error('Error saving character profiles:', error);
        showError('Kunne ikke lagre karakterprofiler');
      } finally {
        setIsSaving(false);
      }
    };
    
    // Debounce saves
    const timer = setTimeout(saveProfiles, 500);
    return () => clearTimeout(timer);
  }, [characterProfiles, manuscriptId, isLoading]);

  // Build character profiles from dialogue and scenes
  const characterData = useMemo(() => {
    const profiles: CharacterProfile[] = [];
    
    characters.forEach(name => {
      const lines = dialogueLines.filter(l => l.characterName === name);
      const appearingScenes = scenes.filter(s => 
        s.characters?.includes(name) || lines.some(l => l.sceneId === s.id)
      );
      
      const savedProfile = characterProfiles[name];
      
      profiles.push({
        name,
        alias: savedProfile?.alias,
        description: savedProfile?.description,
        age: savedProfile?.age,
        role: savedProfile?.role || (lines.length > 10 ? 'lead' : lines.length > 5 ? 'supporting' : 'minor'),
        sceneCount: appearingScenes.length,
        dialogueCount: lines.length,
        scenesAppearing: appearingScenes.map((s) => String(s.sceneNumber ?? '')),
      });
    });
    
    return profiles.sort((a, b) => b.dialogueCount - a.dialogueCount);
  }, [characters, dialogueLines, scenes, characterProfiles]);

  const filteredCharacters = useMemo(() => {
    if (!searchQuery) return characterData;
    const q = searchQuery.toLowerCase();
    return characterData.filter(c => 
      c.name.toLowerCase().includes(q) || 
      c.alias?.toLowerCase().includes(q) ||
      c.description?.toLowerCase().includes(q)
    );
  }, [characterData, searchQuery]);

  useEffect(() => {
    onCharactersChange?.(characterData);
  }, [characterData, onCharactersChange]);

  const handleEdit = (character: CharacterProfile) => {
    setEditingCharacter(character.name);
    setFormData({
      name: character.name,
      alias: character.alias || '',
      description: character.description || '',
      age: character.age || '',
      role: character.role || 'supporting',
    });
    setShowDialog(true);
  };

  const handleSave = () => {
    if (!editingCharacter) return;
    
    // Only store editable fields (not computed fields like sceneCount, dialogueCount, scenesAppearing)
    setCharacterProfiles(prev => ({
      ...prev,
      [editingCharacter]: {
        name: formData.name,
        alias: formData.alias,
        description: formData.description,
        age: formData.age,
        role: formData.role,
      },
    }));
    
    showSuccess('Karakterprofil oppdatert');
    setShowDialog(false);
  };

  const getRoleColor = (role: string): 'error' | 'primary' | 'default' => {
    switch (role) {
      case 'lead': return 'error';
      case 'supporting': return 'primary';
      case 'minor': return 'default';
      case 'extra': return 'default';
      default: return 'default';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'lead': return 'Hovedrolle';
      case 'supporting': return 'Birolle';
      case 'minor': return 'Liten rolle';
      case 'extra': return 'Statist';
      default: return role;
    }
  };

  return (
    <Box>
      <Stack 
        direction={isMobile ? 'column' : 'row'} 
        justifyContent="space-between" 
        alignItems={isMobile ? 'stretch' : 'center'} 
        spacing={responsive.spacing}
        sx={{ mb: responsive.spacing }}
      >
        <Typography variant="h6" sx={{ fontSize: responsive.titleFontSize }}>
          Karakterer ({characters.length})
        </Typography>
        <Stack direction={isMobile ? 'column' : 'row'} spacing={1} alignItems={isMobile ? 'stretch' : 'center'}>
          {isSaving && (
            <Chip
              label="Lagrer profiler..."
              color="info"
              size={responsive.chipSize}
              icon={<CircularProgress size={14} />}
              sx={{ fontSize: responsive.captionFontSize }}
            />
          )}
          <TextField
            placeholder="Søk karakterer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size={isMobile ? 'small' : 'medium'}
            sx={{ width: isMobile ? '100%' : isDesktop ? 280 : 220 }}
          />
        </Stack>
      </Stack>

      {/* Statistics */}
      <Stack direction="row" spacing={isMobile ? 1 : 2} sx={{ mb: responsive.spacing }} flexWrap="wrap" useFlexGap>
        <Chip 
          label={`${characterData.filter(c => c.role === 'lead').length} hovedroller`} 
          color="error" 
          variant="outlined" 
          size={responsive.chipSize}
          sx={{ fontSize: responsive.captionFontSize }}
        />
        <Chip 
          label={`${characterData.filter(c => c.role === 'supporting').length} biroller`} 
          color="primary" 
          variant="outlined" 
          size={responsive.chipSize}
          sx={{ fontSize: responsive.captionFontSize }}
        />
        <Chip 
          label={`${characterData.filter(c => c.role === 'minor' || c.role === 'extra').length} mindre roller`} 
          variant="outlined" 
          size={responsive.chipSize}
          sx={{ fontSize: responsive.captionFontSize }}
        />
      </Stack>

      {filteredCharacters.length === 0 ? (
        <Alert severity="info">
          <Typography sx={{ fontSize: responsive.bodyFontSize }}>
            Ingen karakterer funnet. Karakterer hentes fra dialog og scenedata.
          </Typography>
        </Alert>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gap: responsive.cardSpacing,
            gridTemplateColumns: characterGridColumns,
          }}
        >
          {filteredCharacters.map((character, index) => (
            <Box key={`${character.name}-${index}`}>
              <Card 
                sx={{ 
                  cursor: 'pointer',
                  '&:hover': { boxShadow: 3 },
                  borderLeft: 3,
                  borderColor: character.role === 'lead' ? 'error.main' : 
                               character.role === 'supporting' ? 'primary.main' : 'grey.400',
                }}
                onClick={() => handleEdit(character)}
              >
                <CardContent sx={{ p: isMobile ? 1.5 : 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography variant="h6" sx={{ fontSize: responsive.titleFontSize }}>{character.name}</Typography>
                      {character.alias && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: responsive.captionFontSize }}>
                          aka {character.alias}
                        </Typography>
                      )}
                    </Box>
                    <Chip 
                      label={getRoleLabel(character.role || 'minor')} 
                      color={getRoleColor(character.role || 'minor')}
                      size={responsive.chipSize}
                      sx={{ fontSize: responsive.captionFontSize }}
                    />
                  </Stack>
                  
                  {character.age && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontSize: responsive.bodyFontSize }}>
                      Alder: {character.age}
                    </Typography>
                  )}
                  
                  {character.description && (
                    <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic', fontSize: responsive.bodyFontSize }}>
                      {character.description.substring(0, is4K ? 160 : isDesktop ? 120 : isMobile ? 60 : 100)}
                      {character.description.length > (is4K ? 160 : isDesktop ? 120 : isMobile ? 60 : 100) ? '...' : ''}
                    </Typography>
                  )}
                  
                  <Divider sx={{ my: isMobile ? 0.5 : 1 }} />
                  
                  <Stack direction="row" spacing={isMobile ? 1 : 2}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: responsive.captionFontSize }}>
                      <strong>{character.dialogueCount}</strong> replikker
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: responsive.captionFontSize }}>
                      <strong>{character.sceneCount}</strong> scener
                    </Typography>
                  </Stack>
                  
                  {character.scenesAppearing.length > 0 && !isMobile && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, fontSize: responsive.captionFontSize }}>
                      Scener: {character.scenesAppearing.slice(0, 5).join(', ')}
                      {character.scenesAppearing.length > 5 && ` +${character.scenesAppearing.length - 5} til`}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Box>
          ))}
        </Box>
      )}

      {/* Edit Dialog */}
      <Dialog open={showDialog} onClose={() => setShowDialog(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ fontSize: responsive.titleFontSize }}>Rediger Karakter: {editingCharacter}</DialogTitle>
        <DialogContent>
          <Stack spacing={responsive.spacing} sx={{ mt: 1 }}>
            <TextField
              label="Kallenavn / Alias"
              value={formData.alias}
              onChange={(e) => setFormData({ ...formData, alias: e.target.value })}
              fullWidth
              size={isMobile ? 'small' : 'medium'}
              placeholder="F.eks. 'Dr. N' eller 'Paleontologen'"
            />
            <TextField
              label="Alder"
              value={formData.age}
              onChange={(e) => setFormData({ ...formData, age: e.target.value })}
              fullWidth
              size={isMobile ? 'small' : 'medium'}
              placeholder="F.eks. '30s' eller '45'"
            />
            <FormControl fullWidth size={isMobile ? 'small' : 'medium'}>
              <InputLabel>Rolletype</InputLabel>
              <Select
                value={formData.role}
                label="Rolletype"
                onChange={(e) => setFormData({ ...formData, role: e.target.value as 'lead' | 'supporting' | 'minor' | 'extra' })}
              >
                <MenuItem value="lead">Hovedrolle</MenuItem>
                <MenuItem value="supporting">Birolle</MenuItem>
                <MenuItem value="minor">Liten rolle</MenuItem>
                <MenuItem value="extra">Statist</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Beskrivelse"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
              multiline
              rows={isMobile ? 2 : 3}
              size={isMobile ? 'small' : 'medium'}
              placeholder="Karakterbeskrivelse, bakgrunn, motivasjon..."
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: responsive.padding }}>
          <Button onClick={() => setShowDialog(false)} size={responsive.buttonSize}>Avbryt</Button>
          <Button variant="contained" onClick={handleSave} size={responsive.buttonSize} disabled={isSaving}>
            Lagre
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

const DialogueTab: React.FC<{ 
  dialogueLines: DialogueLine[]; 
  scenes: SceneBreakdown[];
  manuscriptId?: string;
  onDialogueChange?: (dialogueLines: DialogueLine[]) => void;
}> = ({
  dialogueLines,
  scenes,
  manuscriptId,
  onDialogueChange,
}) => {
  const { showSuccess, showError } = useToast();
  const branding = useBrandingSettings();
  const { tier, isMobile, isTablet, isDesktop, is4K } = useScreenTier();
  const responsive = getResponsiveValues(tier);
  const previewLimit = is4K ? 220 : isDesktop ? 160 : isTablet ? 120 : 80;
  const [showDialog, setShowDialog] = useState(false);
  const [editingLine, setEditingLine] = useState<DialogueLine | null>(null);
  const [filterCharacter, setFilterCharacter] = useState<string>('');
  const [filterScene, setFilterScene] = useState<string>('');
  const [formData, setFormData] = useState({
    characterName: '',
    dialogueText: '',
    parenthetical: '',
    emotionTag: '',
    sceneId: '',
  });

  const uniqueCharacters = useMemo(() => {
    const chars = new Set(dialogueLines.map(l => l.characterName));
    return Array.from(chars).sort();
  }, [dialogueLines]);

  const filteredLines = useMemo(() => {
    return dialogueLines.filter(line => {
      if (filterCharacter && line.characterName !== filterCharacter) return false;
      if (filterScene && line.sceneId !== filterScene) return false;
      return true;
    });
  }, [dialogueLines, filterCharacter, filterScene]);

  const handleCreate = () => {
    setEditingLine(null);
    setFormData({
      characterName: '',
      dialogueText: '',
      parenthetical: '',
      emotionTag: '',
      sceneId: scenes[0]?.id || '',
    });
    setShowDialog(true);
  };

  const handleEdit = (line: DialogueLine) => {
    setEditingLine(line);
    setFormData({
      characterName: line.characterName,
      dialogueText: line.dialogueText,
      parenthetical: line.parenthetical || '',
      emotionTag: line.emotionTag || '',
      sceneId: line.sceneId || '',
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    try {
      const line: DialogueLine = {
        id: editingLine?.id || `dial-${Date.now()}`,
        sceneId: formData.sceneId,
        manuscriptId: manuscriptId || '',
        characterName: formData.characterName.toUpperCase(),
        dialogueText: formData.dialogueText,
        dialogueType: 'dialogue',
        parenthetical: formData.parenthetical || undefined,
        emotionTag: formData.emotionTag || undefined,
        lineNumber: editingLine?.lineNumber || dialogueLines.length + 1,
        createdAt: editingLine?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Save to database
      await manuscriptService.saveDialogue(line);

      if (editingLine) {
        // Update existing in local state
        const updated = dialogueLines.map(l => l.id === line.id ? line : l);
        onDialogueChange?.(updated);
        showSuccess('Dialog oppdatert og synkronisert');
      } else {
        // Create new in local state
        onDialogueChange?.([...dialogueLines, line]);
        showSuccess('Dialog opprettet og synkronisert');
      }
      setShowDialog(false);
    } catch (error) {
      showError('Feil ved lagring av dialog');
      console.error(error);
    }
  };

  const handleDelete = async (lineId: string) => {
    if (!confirm('Er du sikker på at du vil slette denne replikken?')) return;
    
    try {
      // Delete from database
      await manuscriptService.deleteDialogue(lineId);
      
      // Update local state
      onDialogueChange?.(dialogueLines.filter(l => l.id !== lineId));
      showSuccess('Dialog slettet og synkronisert');
    } catch (error) {
      showError('Feil ved sletting av dialog');
      console.error(error);
    }
  };

  return (
    <Box>
      <Stack direction={isMobile ? 'column' : 'row'} justifyContent="space-between" alignItems={isMobile ? 'stretch' : 'center'} spacing={isMobile ? 1 : 0} sx={{ mb: responsive.spacing }}>
        <Typography variant="h6" sx={{ fontSize: responsive.titleFontSize, color: branding.colors.textPrimary }}>
          All Dialog ({filteredLines.length})
        </Typography>
        <Button
          startIcon={<AddIcon />}
          variant="outlined"
          onClick={handleCreate}
          size={responsive.buttonSize}
          fullWidth={isMobile}
          sx={{
            color: branding.colors.textPrimary,
            borderColor: `${branding.colors.primary}66`,
            '&:hover': {
              borderColor: branding.colors.primary,
              bgcolor: `${branding.colors.primary}1a`,
            },
          }}
        >
          Legg til Replikk
        </Button>
      </Stack>

      {/* Filters */}
      <Stack direction={isMobile ? 'column' : 'row'} spacing={isMobile ? 1 : 2} sx={{ mb: responsive.spacing }}>
        <FormControl size="small" sx={{ minWidth: isMobile ? '100%' : 150 }}>
          <InputLabel>Filtrer karakter</InputLabel>
          <Select
            value={filterCharacter}
            label="Filtrer karakter"
            onChange={(e) => setFilterCharacter(e.target.value)}
          >
            <MenuItem value="">Alle</MenuItem>
            {uniqueCharacters.map(char => (
              <MenuItem key={char} value={char}>{char}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: isMobile ? '100%' : 200 }}>
          <InputLabel>Filtrer scene</InputLabel>
          <Select
            value={filterScene}
            label="Filtrer scene"
            onChange={(e) => setFilterScene(e.target.value)}
          >
            <MenuItem value="">Alle</MenuItem>
            {scenes.map(s => (
              <MenuItem key={s.id} value={s.id}>Scene {s.sceneNumber}: {s.sceneHeading?.substring(0, isMobile ? 15 : 30)}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {filteredLines.length === 0 ? (
        <Alert severity="info">
          <Typography sx={{ fontSize: responsive.bodyFontSize }}>
            Ingen dialog funnet ennå. Klikk "Legg til Replikk" for å starte.
          </Typography>
        </Alert>
      ) : (
        <List dense={isMobile}>
          {filteredLines.map((line, index) => {
            const scene = scenes.find((s) => s.id === line.sceneId);
            const previewText =
              line.dialogueText.length > previewLimit
                ? `${line.dialogueText.substring(0, previewLimit)}...`
                : line.dialogueText;
            return (
              <React.Fragment key={line.id}>
                {index > 0 && <Divider />}
                <ListItem
                  disablePadding
                  secondaryAction={
                    <Stack direction="row" spacing={0.5}>
                      <IconButton size="small" onClick={() => handleEdit(line)}>
                        <EditIcon sx={{ fontSize: responsive.iconSize }} />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDelete(line.id)}>
                        <DeleteIcon sx={{ fontSize: responsive.iconSize }} />
                      </IconButton>
                    </Stack>
                  }
                  sx={{ pr: isMobile ? 8 : 12 }}
                >
                  <ListItemButton onClick={() => handleEdit(line)} sx={{ py: isMobile ? 0.75 : 1 }}>
                    <ListItemIcon sx={{ minWidth: isMobile ? 34 : 40 }}>
                      <Badge
                        color="secondary"
                        variant={line.emotionTag ? 'dot' : 'standard'}
                        invisible={!line.emotionTag}
                      >
                        <ChatIcon sx={{ fontSize: responsive.iconSize - (is4K ? 0 : 3), color: 'primary.main' }} />
                      </Badge>
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Stack direction={isMobile ? 'column' : 'row'} spacing={isMobile ? 0.5 : 1} alignItems={isMobile ? 'flex-start' : 'center'}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'primary.main', fontSize: responsive.bodyFontSize }}>
                            {line.characterName}
                          </Typography>
                          <Stack direction="row" spacing={0.5}>
                            {line.parenthetical && (
                              <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', fontSize: responsive.captionFontSize }}>
                                ({line.parenthetical})
                              </Typography>
                            )}
                            {line.emotionTag && (
                              <Chip label={line.emotionTag} size={responsive.chipSize} variant="outlined" sx={{ fontSize: responsive.captionFontSize }} />
                            )}
                          </Stack>
                        </Stack>
                      }
                      secondary={
                        <>
                          <Typography variant="body2" component="span" sx={{ fontStyle: 'italic', my: 0.5, display: 'block', fontSize: responsive.bodyFontSize }}>
                            "{previewText}"
                          </Typography>
                          {scene && !isMobile && (
                            <Typography variant="caption" component="span" color="text.secondary" sx={{ display: 'block', fontSize: responsive.captionFontSize }}>
                              Scene {scene.sceneNumber}: {isDesktop ? scene.sceneHeading : scene.sceneHeading?.substring(0, 32)}
                            </Typography>
                          )}
                        </>
                      }
                      secondaryTypographyProps={{ component: 'div' }}
                    />
                  </ListItemButton>
                </ListItem>
              </React.Fragment>
            );
          })}
        </List>
      )}

      {/* Edit Dialog */}
      <Dialog open={showDialog} onClose={() => setShowDialog(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ fontSize: responsive.titleFontSize }}>{editingLine ? 'Rediger Replikk' : 'Ny Replikk'}</DialogTitle>
        <DialogContent>
          <Stack spacing={responsive.spacing} sx={{ mt: 1 }}>
            <TextField
              label="Karakter"
              value={formData.characterName}
              onChange={(e) => setFormData({ ...formData, characterName: e.target.value })}
              fullWidth
              size={isMobile ? 'small' : 'medium'}
              placeholder="F.eks. NORA TIDEMANN"
              helperText="Skriv karakternavnet i store bokstaver"
            />
            <FormControl fullWidth size={isMobile ? 'small' : 'medium'}>
              <InputLabel>Scene</InputLabel>
              <Select
                value={formData.sceneId}
                label="Scene"
                onChange={(e) => setFormData({ ...formData, sceneId: e.target.value })}
              >
                {scenes.map(s => (
                  <MenuItem key={s.id} value={s.id}>
                    Scene {s.sceneNumber}: {s.sceneHeading?.substring(0, isMobile ? 25 : 40)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Dialog"
              value={formData.dialogueText}
              onChange={(e) => setFormData({ ...formData, dialogueText: e.target.value })}
              fullWidth
              multiline
              rows={isMobile ? 2 : 3}
              size={isMobile ? 'small' : 'medium'}
              placeholder="Hva sier karakteren?"
            />
            <TextField
              label="Parentetisk (valgfritt)"
              value={formData.parenthetical}
              onChange={(e) => setFormData({ ...formData, parenthetical: e.target.value })}
              fullWidth
              size={isMobile ? 'small' : 'medium'}
              placeholder="F.eks. smilende, bekymret, til Anna"
              helperText="Regiinstruksjoner for skuespilleren"
            />
            <FormControl fullWidth size={isMobile ? 'small' : 'medium'}>
              <InputLabel>Emosjon (valgfritt)</InputLabel>
              <Select
                value={formData.emotionTag}
                label="Emosjon (valgfritt)"
                onChange={(e) => setFormData({ ...formData, emotionTag: e.target.value })}
              >
                <MenuItem value="">Ingen</MenuItem>
                <MenuItem value="neutral">Nøytral</MenuItem>
                <MenuItem value="happy">Glad</MenuItem>
                <MenuItem value="sad">Trist</MenuItem>
                <MenuItem value="angry">Sint</MenuItem>
                <MenuItem value="frightened">Redd</MenuItem>
                <MenuItem value="surprised">Overrasket</MenuItem>
                <MenuItem value="confused">Forvirret</MenuItem>
                <MenuItem value="determined">Bestemt</MenuItem>
                <MenuItem value="hopeful">Håpefull</MenuItem>
                <MenuItem value="desperate">Desperat</MenuItem>
                <MenuItem value="wistful">Vemodig</MenuItem>
                <MenuItem value="mysterious">Mystisk</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: responsive.padding }}>
          <Button onClick={() => setShowDialog(false)} size={responsive.buttonSize}>Avbryt</Button>
          <Button 
            variant="contained" 
            onClick={handleSave}
            size={responsive.buttonSize}
            disabled={!formData.characterName || !formData.dialogueText}
          >
            {editingLine ? 'Oppdater' : 'Opprett'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

const BreakdownTab: React.FC<{
  scenes: SceneBreakdown[];
  sceneStats: any;
  onAddScene: () => void;
  onEditScene: (scene: SceneBreakdown) => void;
  onSelectScene: (scene: SceneBreakdown) => void;
  selectedScene?: SceneBreakdown;
}> = ({ scenes, sceneStats, onAddScene, onEditScene, onSelectScene, selectedScene }) => {
  const { tier, isMobile, isTablet, isDesktop, is4K } = useScreenTier();
  const responsive = getResponsiveValues(tier);
  const statsGridColumns = isDesktop ? 'repeat(4, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))';

  return (
    <Box>
      <Stack
        direction={isMobile ? 'column' : 'row'}
        justifyContent="space-between"
        alignItems={isMobile ? 'stretch' : 'center'}
        spacing={responsive.spacing}
        sx={{ mb: responsive.spacing }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <LocationIcon sx={{ width: responsive.iconSize - 6, height: responsive.iconSize - 6 }} />
          <Typography variant="h6" sx={{ fontSize: responsive.titleFontSize }}>
            Production Breakdown
          </Typography>
        </Stack>
        <Button
          startIcon={<AddIcon sx={{ fontSize: responsive.iconSize - 4 }} />}
          variant="outlined"
          size={responsive.buttonSize}
          onClick={onAddScene}
          sx={{ fontSize: responsive.bodyFontSize }}
        >
          Legg til scene
        </Button>
      </Stack>

      {/* Statistics */}
      <Box
        sx={{
          mb: responsive.spacing,
          display: 'grid',
          gap: responsive.cardSpacing,
          gridTemplateColumns: statsGridColumns,
        }}
      >
        <Box>
          <Card>
            <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
              <Typography variant="h4" sx={{ fontSize: is4K ? '2.5rem' : isMobile ? '1.5rem' : '2rem' }}>{sceneStats.total}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: responsive.captionFontSize }}>
                Total Scenes
              </Typography>
            </CardContent>
          </Card>
        </Box>
        <Box>
          <Card>
            <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
              <Typography variant="h4" sx={{ fontSize: is4K ? '2.5rem' : isMobile ? '1.5rem' : '2rem' }}>{sceneStats.intScenes}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: responsive.captionFontSize }}>
                INT Scenes
              </Typography>
            </CardContent>
          </Card>
        </Box>
        <Box>
          <Card>
            <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
              <Typography variant="h4" sx={{ fontSize: is4K ? '2.5rem' : isMobile ? '1.5rem' : '2rem' }}>{sceneStats.extScenes}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: responsive.captionFontSize }}>
                EXT Scenes
              </Typography>
            </CardContent>
          </Card>
        </Box>
        <Box>
          <Card>
            <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
              <Typography variant="h4" sx={{ fontSize: is4K ? '2.5rem' : isMobile ? '1.5rem' : '2rem' }}>
                {sceneStats.dayScenes}/{sceneStats.nightScenes}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: responsive.captionFontSize }}>
                Day/Night
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Breakdown details */}
      {scenes.length === 0 && (
        <Alert severity="info">
          <Typography sx={{ fontSize: responsive.bodyFontSize }}>
            Ingen scener ennå. Bruk "Auto Breakdown" eller legg til en scene manuelt.
          </Typography>
        </Alert>
      )}

      {scenes.length > 0 && (
        isMobile ? (
          <Stack spacing={1}>
            {scenes.map((scene) => (
              <Card
                key={scene.id}
                sx={{
                  p: 1.5,
                  cursor: 'pointer',
                  bgcolor: selectedScene?.id === scene.id ? 'action.selected' : undefined,
                }}
                onClick={() => onSelectScene(scene)}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontSize: responsive.bodyFontSize }}>Scene {scene.sceneNumber}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: responsive.captionFontSize }}>
                      {scene.locationName}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Chip label={`${scene.characters?.length || 0} chars`} size="small" sx={{ fontSize: responsive.captionFontSize }} />
                    {scene.propsNeeded && scene.propsNeeded.length > 0 && <Chip label={`${scene.propsNeeded.length} props`} size="small" sx={{ fontSize: responsive.captionFontSize }} />}
                    <IconButton
                      size="small"
                      onClick={(event) => {
                        event.stopPropagation();
                        onEditScene(scene);
                      }}
                    >
                      <EditIcon sx={{ fontSize: responsive.iconSize - 4 }} />
                    </IconButton>
                  </Stack>
                </Stack>
                <Stack direction="row" spacing={0.5} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                  {scene.specialEffects && <Chip label="VFX" size="small" color="secondary" sx={{ fontSize: responsive.captionFontSize }} />}
                  {scene.stuntsNotes && <Chip label="Stunts" size="small" color="warning" sx={{ fontSize: responsive.captionFontSize }} />}
                  {scene.vehicles && scene.vehicles.length > 0 && <Chip label="Vehicles" size="small" sx={{ fontSize: responsive.captionFontSize }} />}
                </Stack>
              </Card>
            ))}
          </Stack>
        ) : (
          <TableContainer component={Paper}>
            <Table size={isTablet ? 'small' : 'medium'}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontSize: responsive.bodyFontSize }}>Scene</TableCell>
                  <TableCell sx={{ fontSize: responsive.bodyFontSize }}>Location</TableCell>
                  <TableCell sx={{ fontSize: responsive.bodyFontSize }}>Characters</TableCell>
                  {!isTablet && <TableCell sx={{ fontSize: responsive.bodyFontSize }}>Props</TableCell>}
                  <TableCell sx={{ fontSize: responsive.bodyFontSize }}>Special Notes</TableCell>
                  <TableCell sx={{ fontSize: responsive.bodyFontSize }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {scenes.map((scene) => (
                  <TableRow
                    key={scene.id}
                    hover
                    selected={selectedScene?.id === scene.id}
                    onClick={() => onSelectScene(scene)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell sx={{ fontSize: responsive.bodyFontSize }}>{scene.sceneNumber}</TableCell>
                    <TableCell sx={{ fontSize: responsive.bodyFontSize }}>{scene.locationName}</TableCell>
                    <TableCell sx={{ fontSize: responsive.bodyFontSize }}>{scene.characters?.length || 0}</TableCell>
                    {!isTablet && <TableCell sx={{ fontSize: responsive.bodyFontSize }}>{scene.propsNeeded?.length || 0}</TableCell>}
                    <TableCell>
                      {scene.specialEffects && <Chip label="VFX" size={responsive.chipSize} sx={{ mr: 0.5, fontSize: responsive.captionFontSize }} />}
                      {scene.stuntsNotes && <Chip label="Stunts" size={responsive.chipSize} sx={{ mr: 0.5, fontSize: responsive.captionFontSize }} />}
                      {scene.vehicles && scene.vehicles.length > 0 && <Chip label="Vehicles" size={responsive.chipSize} sx={{ fontSize: responsive.captionFontSize }} />}
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Åpne scene">
                        <IconButton
                          size="small"
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelectScene(scene);
                          }}
                        >
                          <VisibilityIcon sx={{ fontSize: responsive.iconSize - 4 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Rediger scene">
                        <IconButton
                          size="small"
                          onClick={(event) => {
                            event.stopPropagation();
                            onEditScene(scene);
                          }}
                        >
                          <EditIcon sx={{ fontSize: responsive.iconSize - 4 }} />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )
      )}
    </Box>
  );
};

const RevisionsTab: React.FC<{ 
  revisions: ScriptRevision[]; 
  manuscript: Manuscript;
  onRevisionsChange?: (revisions: ScriptRevision[]) => void;
  onCreateRevision?: (revision: ScriptRevision) => Promise<void> | void;
  onRestoreRevision?: (revision: ScriptRevision) => Promise<void> | void;
}> = ({
  revisions,
  manuscript,
  onRevisionsChange,
  onCreateRevision,
  onRestoreRevision,
}) => {
  const { showSuccess, showError } = useToast();
  const branding = useBrandingSettings();
  const { tier, isMobile, isTablet, isDesktop, is4K } = useScreenTier();
  const responsive = getResponsiveValues(tier);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [revisionName, setRevisionName] = useState('');
  const [revisionNotes, setRevisionNotes] = useState('');
  const [selectedRevision, setSelectedRevision] = useState<ScriptRevision | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [useRichNotes, setUseRichNotes] = useState(false);
  const mentionCandidates = useMemo(() => {
    const pool = new Set<string>();
    if (typeof manuscript.title === 'string' && manuscript.title.trim()) pool.add(manuscript.title.trim());
    revisions.forEach((revision) => {
      if (typeof revision.changesSummary === 'string' && revision.changesSummary.trim()) {
        pool.add(revision.changesSummary.trim());
      }
      if (typeof revision.revisionNotes === 'string' && revision.revisionNotes.trim()) {
        pool.add(revision.revisionNotes.trim());
      }
    });
    pool.add('Regi');
    pool.add('Manus');
    return Array.from(pool);
  }, [manuscript.title, revisions]);

  const handleCreateRevision = async () => {
    if (!revisionName.trim()) {
      showError('Revisjonsnavn er påkrevd');
      return;
    }

    try {
      const sanitizedRevisionNotes = stripHtmlTags(revisionNotes);
      const newRevision: ScriptRevision = {
        id: `rev-${Date.now()}`,
        manuscriptId: manuscript.id,
        version: `${manuscript.version || 1}.${revisions.length + 1}`,
        createdAt: new Date().toISOString(),
        changedBy: 'current-user',
        changesSummary: sanitizedRevisionNotes || revisionName.trim(),
        revisionNotes: revisionNotes,
        content: manuscript.content,
      };

      const updatedRevisions = [...revisions, newRevision];
      onRevisionsChange?.(updatedRevisions);
      
      // Also save to service
      await manuscriptService.createRevision(newRevision);
      await onCreateRevision?.(newRevision);
      
      showSuccess(`Revisjon "${revisionName}" opprettet`);
      setShowCreateDialog(false);
      setRevisionName('');
      setRevisionNotes('');
      setUseRichNotes(false);
    } catch (error) {
      showError('Feil ved opprettelse av revisjon');
      console.error(error);
    }
  };

  const handleDeleteRevision = async (revisionId: string) => {
    if (!confirm('Er du sikker på at du vil slette denne revisjonen?')) return;

    try {
      const updatedRevisions = revisions.filter(r => r.id !== revisionId);
      onRevisionsChange?.(updatedRevisions);
      showSuccess('Revisjon slettet');
    } catch (error) {
      showError('Feil ved sletting av revisjon');
      console.error('Kunne ikke slette revisjon:', error);
    }
  };

  const handleRestoreRevision = async (revision: ScriptRevision) => {
    if (!confirm('Vil du gjenopprette denne versjonen? Gjeldende endringer vil bli overskrevet.')) return;
    
    try {
      await onRestoreRevision?.(revision);
      setSelectedRevision(revision);
      setCompareMode(true);
      showSuccess(`Revisjon ${revision.version} gjenopprettet`);
    } catch (error) {
      showError('Kunne ikke gjenopprette revisjon');
      console.error('Feil ved gjenoppretting av revisjon:', error);
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Stack direction={isMobile ? 'column' : 'row'} justifyContent="space-between" alignItems={isMobile ? 'stretch' : 'center'} spacing={isMobile ? 1 : 0} sx={{ mb: responsive.spacing }}>
        <Stack direction="row" spacing={isMobile ? 1 : 2} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography variant="h6" sx={{ fontSize: responsive.titleFontSize }}>
            {isMobile
              ? 'Revisjoner'
              : isTablet
                ? 'Revisjoner & Diff'
                : 'Script Revisjoner & Diff Viewer'}
          </Typography>
          <Chip 
            label={`v${manuscript.version || '1.0'}`} 
            color="primary" 
            size={responsive.chipSize}
            sx={{ fontSize: responsive.captionFontSize }}
          />
        </Stack>
        <Stack direction={isMobile ? 'column' : 'row'} spacing={1} alignItems={isMobile ? 'stretch' : 'center'}>
          <ToggleButtonGroup
            value={compareMode ? 'compare' : 'list'}
            exclusive
            size="small"
            onChange={(_, value: 'compare' | 'list' | null) => {
              if (!value) return;
              setCompareMode(value === 'compare');
            }}
          >
            <ToggleButton value="list">
              <HistoryIcon sx={{ fontSize: responsive.iconSize - 6 }} />
              {isDesktop && (
                <Typography component="span" sx={{ ml: 0.75, fontSize: responsive.captionFontSize }}>
                  Liste
                </Typography>
              )}
            </ToggleButton>
            <ToggleButton value="compare">
              <PreviewIcon sx={{ fontSize: responsive.iconSize - 6 }} />
              {isDesktop && (
                <Typography component="span" sx={{ ml: 0.75, fontSize: responsive.captionFontSize }}>
                  Compare
                </Typography>
              )}
            </ToggleButton>
          </ToggleButtonGroup>
          <Button
            variant="outlined"
            size={responsive.buttonSize}
            startIcon={<AddIcon sx={{ fontSize: responsive.iconSize }} />}
            onClick={() => setShowCreateDialog(true)}
            fullWidth={isMobile}
          >
            {isMobile ? 'Ny' : 'Ny Revisjon'}
          </Button>
        </Stack>
      </Stack>

      {revisions.length === 0 ? (
        <Alert severity="info" sx={{ mb: responsive.spacing }}>
          <Typography variant="body2" sx={{ fontSize: responsive.bodyFontSize }}>
            {isMobile 
              ? 'Ingen revisjoner ennå. Opprett en for å lagre snapshots.'
              : 'Ingen revisjoner ennå. Opprett en revisjon for å lagre et snapshot av manuskriptet og kunne sammenligne endringer over tid.'
            }
          </Typography>
        </Alert>
      ) : (
        <>
          {/* Revision List */}
          <Paper sx={{ mb: responsive.spacing, p: isMobile ? 1 : 1.5 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontSize: responsive.bodyFontSize }}>
              Revisjonshistorikk ({revisions.length})
            </Typography>
            <Stack spacing={1}>
              {revisions.slice().reverse().map((revision, index) => (
                <Paper 
                  key={revision.id} 
                  variant="outlined" 
                  sx={{ 
                    p: isMobile ? 1 : 1.5,
                    cursor: 'pointer',
                    bgcolor: selectedRevision?.id === revision.id ? 'action.selected' : 'transparent',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                  onClick={() => setSelectedRevision(revision)}
                >
                  <Stack direction={isMobile ? 'column' : 'row'} justifyContent="space-between" alignItems={isMobile ? 'flex-start' : 'center'} spacing={isMobile ? 1 : 0}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Chip 
                        label={revision.version} 
                        size={responsive.chipSize}
                        color={index === 0 ? 'success' : 'default'}
                        sx={{ fontSize: responsive.captionFontSize }}
                      />
                      <Typography variant="body2" sx={{ fontSize: responsive.bodyFontSize }}>
                        {stripHtmlTags(revision.changesSummary || revision.revisionNotes || 'Ingen beskrivelse') || 'Ingen beskrivelse'}
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      {!isMobile && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: responsive.captionFontSize }}>
                          {new Date(revision.createdAt ?? Date.now()).toLocaleDateString('no-NO', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Typography>
                      )}
                      <IconButton 
                        size="small" 
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleRestoreRevision(revision);
                        }}
                        title="Gjenopprett"
                      >
                        <HistoryIcon sx={{ fontSize: responsive.iconSize }} />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRevision(revision.id);
                        }}
                        title="Slett"
                      >
                        <DeleteIcon sx={{ fontSize: responsive.iconSize }} />
                      </IconButton>
                    </Stack>
                  </Stack>
                  {isMobile && (
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: responsive.captionFontSize, mt: 0.5, display: 'block' }}>
                      {new Date(revision.createdAt ?? Date.now()).toLocaleDateString('no-NO', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Typography>
                  )}
                </Paper>
              ))}
            </Stack>
          </Paper>
        </>
      )}

      {/* Diff Viewer */}
      {revisions.length > 0 && compareMode && (
        <Box sx={{ flex: 1, minHeight: is4K ? 520 : isDesktop ? 420 : isTablet ? 340 : 280 }}>
          <ScriptDiffViewer revisions={revisions} currentContent={manuscript.content} />
        </Box>
      )}
      {revisions.length > 0 && !compareMode && (
        <Alert severity="info">
          <Typography variant="body2" sx={{ fontSize: responsive.bodyFontSize }}>
            Slå på Compare for å se diff mellom gjeldende manus og valgt revisjon.
          </Typography>
        </Alert>
      )}

      {/* Create Revision Dialog */}
      <Dialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ fontSize: responsive.titleFontSize }}>Opprett Ny Revisjon</DialogTitle>
        <DialogContent>
          <Stack spacing={responsive.spacing} sx={{ mt: 1 }}>
            <Alert severity="info">
              <Typography variant="body2" sx={{ fontSize: responsive.bodyFontSize }}>
                {isMobile 
                  ? 'En revisjon lagrer et snapshot av manuskriptet.'
                  : 'En revisjon lagrer et snapshot av gjeldende manuskript. Du kan senere sammenligne revisjoner og se endringer over tid.'
                }
              </Typography>
            </Alert>
            <TextField
              label="Revisjonsnavn"
              value={revisionName}
              onChange={(e) => setRevisionName(e.target.value)}
              fullWidth
              size={isMobile ? 'small' : 'medium'}
              placeholder="F.eks. 'Draft 2' eller 'Etter regimøte'"
              required
            />
            <Stack direction={isMobile ? 'column' : 'row'} spacing={1} alignItems={isMobile ? 'stretch' : 'center'}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: responsive.captionFontSize }}>
                Notatformat
              </Typography>
              <ToggleButtonGroup
                size="small"
                value={useRichNotes ? 'rich' : 'plain'}
                exclusive
                onChange={(_, value: 'rich' | 'plain' | null) => {
                  if (!value) return;
                  setUseRichNotes(value === 'rich');
                }}
              >
                <ToggleButton value="plain">Tekst</ToggleButton>
                <ToggleButton value="rich">Rik tekst</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
            {useRichNotes ? (
              <RichTextEditor
                value={revisionNotes}
                onChange={setRevisionNotes}
                placeholder="Beskriv hva som er endret i denne revisjonen..."
                minHeight={isMobile ? 120 : 180}
                accentColor={branding.colors.primary}
              />
            ) : (
              <TextField
                label="Notater / Endringsbeskrivelse"
                value={revisionNotes}
                onChange={(e) => setRevisionNotes(e.target.value)}
                fullWidth
                multiline
                rows={isMobile ? 2 : 3}
                size={isMobile ? 'small' : 'medium'}
                placeholder="Beskriv hva som er endret i denne revisjonen..."
              />
            )}
            <GlobalMentionHelper
              text={revisionNotes}
              localCandidates={mentionCandidates}
              onApplySuggestion={(name) => setRevisionNotes((prev) => applyMentionSuggestion(prev, name))}
              autoTagTitle="Auto-tagget i notater"
              suggestionTitle="Mener du?"
            />
            <Stack direction={isMobile ? 'column' : 'row'} spacing={isMobile ? 1 : 2}>
              <Chip 
                label={`Gjeldende: v${manuscript.version || '1.0'}`} 
                size={responsive.chipSize}
                sx={{ fontSize: responsive.captionFontSize }}
              />
              <Chip 
                label={`Ny: v${manuscript.version || 1}.${revisions.length + 1}`} 
                size={responsive.chipSize}
                color="primary"
                sx={{ fontSize: responsive.captionFontSize }}
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: responsive.padding }}>
          <Button onClick={() => setShowCreateDialog(false)} size={responsive.buttonSize}>Avbryt</Button>
          <Button 
            variant="contained" 
            onClick={handleCreateRevision}
            disabled={!revisionName.trim()}
            startIcon={<SaveIcon sx={{ fontSize: responsive.iconSize }} />}
            size={responsive.buttonSize}
          >
            {isMobile ? 'Lagre' : 'Lagre Revisjon'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};


// Memoized export - only re-render if props meaningfully change
export const ManuscriptPanel = React.memo(ManuscriptPanelComponent, (prevProps, nextProps) => {
  // Return TRUE if props are equal (skip re-render), FALSE if different (re-render)
  
  // Check critical props
  if (prevProps.projectId !== nextProps.projectId) return false;
  if (prevProps.onManuscriptChange !== nextProps.onManuscriptChange) return false;
  
  // All checks passed - props are effectively equal, skip re-render
  return true;
});

export default ManuscriptPanel;
