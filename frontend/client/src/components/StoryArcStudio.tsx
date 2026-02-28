import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useLocation as useWouterLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { PushNotificationSettings } from './shared/PushNotificationSettings';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Divider,
  Paper,
  Stack,
  ButtonGroup,
  Button,
  Slider,
  Chip,
  Avatar,
  Tooltip,
  Alert,
  TextField,
  Card,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Stop,
  SkipPrevious,
  SkipNext,
  FastRewind,
  FastForward,
  ZoomIn,
  ZoomOut,
  Fullscreen,
  Settings,
  Save,
  FileDownload,
  Undo,
  Redo,
  ContentCut,
  ContentCopy,
  ContentPaste,
  GridView,
  Timeline as TimelineIcon,
  Loop,
  KeyboardArrowLeft,
  KeyboardArrowRight,
  Speed as Speed,
  AutoFixHigh,
  Face as FaceIcon,
  Sync,
  Link as LinkIcon,
  AccountTree,
  MovieFilter,
  AutoFixHigh as AutoFixHighIcon,
  GpsFixed,
  Notifications,
  NotificationsActive,
} from '@mui/icons-material';
import { ThemeProvider } from '@mui/material/styles';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Snackbar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  LinearProgress,
  Checkbox,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemSecondaryAction,
  CircularProgress,
  ListItemText as ListItemTextType,
} from '@mui/material';
import { CheckCircle } from '@mui/icons-material';
import { storyArcStudioTheme } from '../theme/storyArcStudioTheme';
import EnhancementRatingDialog from './ai-training/EnhancementRatingDialog';
import AudioEnhancementDialog from './audio/AudioEnhancementDialog';
import BatchAudioEnhancementDialog from './audio/BatchAudioEnhancementDialog';
import AIAudioAssistantDialog from './audio/AIAudioAssistantDialog';
import StoryArcDataIntegration, { BeatClip, Track, StoryArc } from '../services/storyArcDataIntegration';
import ProfessionalTimeline, { TimelineMarker, TrackState, TimelineTransition } from './ProfessionalTimeline';
import AssetBrowser from './AssetBrowser';
import StoryArcAutoMonitor from './StoryArcAutoMonitor';
import InspectorPanel from './InspectorPanel';
import ExportDialog from './ExportDialog';
import StoryArcStudioLogo from './ui/StoryArcStudioLogo';
import { videoEngine } from '../services/video-playback-engine';
import { timelineEngine } from '../services/timeline-engine';
import DaVinciResolveExportDialog from './timeline/DaVinciResolveExportDialog';
import AIStoryGeneratorDialog from './timeline/AIStoryGeneratorDialog';
import type { ProjectToEditorData, EditorToProjectResult } from '../utils/story-arc-project-integration';
import { getCulturalHighlights, formatShotListForAI, generateAIPrompt, generateWorklogDescription } from '../utils/story-arc-project-integration';
import TransitionLibrary from './timeline/TransitionLibrary';
import SpeedRampPanel from './timeline/SpeedRampPanel';
import ProfessionalWaveform from './timeline/ProfessionalWaveform';
import TextOverlayPanel from './timeline/TextOverlayPanel';
import GPUFiltersPanel from './timeline/GPUFiltersPanel';
import ColorGradingPanel from './timeline/ColorGradingPanel';
import AutoCaptionsPanel from './timeline/AutoCaptionsPanel';
import BeatSyncPanel from './timeline/BeatSyncPanel';
import BackgroundRemovalPanel from './timeline/BackgroundRemovalPanel';
import MotionTrackingPanel from './timeline/MotionTrackingPanel';
import ObjectSegmentationPanel from './timeline/ObjectSegmentationPanel';
import HLSImportDialog from './timeline/HLSImportDialog';
import LUTLibrary from './timeline/LUTLibrary';
import CinematographyCompositionOverlay, {
  CINEMATOGRAPHY_ASPECT_MASKS,
  CINEMATOGRAPHY_SPIRAL_ORIENTATIONS,
  DEFAULT_CINEMATOGRAPHY_GUIDES,
  type CinematographyAspectMask,
  type CinematographyGuideSet,
  type CinematographyGuideTarget,
  type CinematographySpiralOrientation,
} from './timeline/CinematographyCompositionOverlay';
import { LUTEngine } from '../services/lut-engine';
import { apiRequest } from '@/lib/queryClient';
import { frameTimer } from '../services/frame-accurate-timer';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from './universal/hooks/useDynamicProfessions';
import { pixiFilterEngine } from '../services/pixi-filter-engine';
import { textOverlayEngine } from '../services/text-overlay-engine';
import { TextAnimationEngine } from '../services/text-animation-engine';
import { ColorGradingEngine } from '../services/color-grading-engine';
import { HLSStreamingService } from '../services/hls-streaming-service';
import { webWorkerEngine } from '../services/web-worker-engine';
import { ThumbnailCacheService } from '../services/thumbnail-cache-service';
import { audioAnalysisEngine } from '../services/audio-analysis-engine';
import {
  audioSyncEngine,
  type AudioSyncClipInput,
  type AudioSyncResult as EngineAudioSyncResult,
} from '../services/audio-sync-engine';
import { faceDetectionWorker, type FaceDetectionProgress, type FaceDetectionResult } from '../services/face-detection-worker';
import {
  FilterVintage,
  Palette,
  TextFields,
  Subtitles,
  MusicNote,
  RemoveCircle,
} from '@mui/icons-material';

interface StoryArcStudioProps {
  storyArcId?: string;
  onClose?: () => void;
  // Integration props for unified workflow connectivity
  onMeetingCreate?: (meeting: any) => void;
  onProjectUpdate?: (project: any) => void;
  onWorklogCreate?: (worklog: any) => void;
  onClientSelect?: (client: any) => void;
  onClientUpdate?: (client: any) => void;
  onShowcaseCreate?: (showcase: any) => void;
  onFileUpload?: (file: any) => void;
  onFileDownload?: (file: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void;
  selectedClient?: any;
  onSettingsUpdate?: (settings: any) => void;
  onNotificationCreate?: (notification: any) => void;
}

interface PanelSizes {
  leftPanel: number;
  rightPanel: number;
}

interface StoryArcMediaDetail {
  id?: string;
  name?: string;
  url?: string;
  type?: string;
  mimeType?: string;
  duration?: number;
  file?: File;
  camera?: string;
  syncGroup?: string;
  tags?: string[];
}

interface StoryArcAddMediaDetail {
  media: StoryArcMediaDetail;
  position: 'playhead' | 'append';
  track?: string;
  startTime?: number;
}

interface SourcePreviewAsset {
  id: string;
  name: string;
  sourceFile: string;
  file?: File;
}

type ResolveEditTool = 'select' | 'trim' | 'roll' | 'slip' | 'slide';
type ResolveWorkspacePreset = 'edit' | 'cut' | 'color' | 'fairlight';
type ResolveDockSlotId = 'dock-1' | 'dock-2' | 'dock-3';
type ResolveMonitorFocus = 'source' | 'program';
type ResolveWorkspaceProfiles = Record<ResolveWorkspacePreset, ResolveLayoutState | null>;

interface ResolveLayoutState {
  workspacePreset: ResolveWorkspacePreset;
  showAssetPanel: boolean;
  showInspectorPanel: boolean;
  showEffectsPanel: boolean;
  showMixerPanel: boolean;
  panelSizes: PanelSizes;
  showProgramMonitor: boolean;
  monitorFitMode: 'fit' | 'fill';
  editTool: ResolveEditTool;
  showAutoMonitor: boolean;
  multicamEnabled: boolean;
  multicamApplyToTimeline: boolean;
}

interface StoryArcCompositionSettings {
  enabled: boolean;
  target: CinematographyGuideTarget;
  guides: CinematographyGuideSet;
  color: string;
  opacity: number;
  thickness: number;
  spiralOrientation: CinematographySpiralOrientation;
  aspectMask: CinematographyAspectMask;
}

interface MulticamAngleCandidate {
  camera: string;
  clip: BeatClip;
  isLive: boolean;
}

interface ClipClipboardItem {
  clip: BeatClip;
  relativeStart: number;
}

interface CaptionExportPayload {
  segments: unknown[];
  srt: string;
  vtt: string;
}

interface ThumbnailCacheSummary {
  thumbnailCount: number;
  totalSize: number;
}

interface SelectedAssetMedia {
  id?: string;
  name?: string;
  url?: string;
  type?: string;
  mimeType?: string;
  file?: File;
}

interface ExportedVideoResult {
  url: string;
  thumbnail?: string;
  duration?: number;
  resolution?: string;
  codec?: string;
  format?: string;
}

interface StoryArcEditorTestHook {
  selectClipById: (clipId: string) => boolean;
  listClips: () => Array<{
    clipId: string;
    trackId: string;
    start: number;
    duration: number;
    name: string;
    sourceFile: string;
  }>;
  snapshot: (clipId?: string) => {
    clipId: string;
    trackId: string;
    start: number;
    duration: number;
    inPoint: number;
    outPoint: number;
  } | null;
  trimSelected: (edge: 'in' | 'out', frames: number) => boolean;
  slipSelected: (frames: number) => boolean;
  slideSelected: (frames: number) => boolean;
  rollSelected: (frames: number) => boolean;
  setPlayhead: (seconds: number) => void;
  seedTimelineFixture: () => {
    primaryClipId: string;
    clipIds: string[];
    trackId: string;
    sourceFile: string;
  } | null;
}

declare global {
  interface Window {
    __pendingAudioDetail?: StoryArcAddMediaDetail;
    __storyArcEditorTestHook?: StoryArcEditorTestHook;
  }
}

const INITIAL_PANEL_SIZES: PanelSizes = {
  leftPanel: 280, // Asset Browser width
  rightPanel: 300  // Inspector width
};

const MIN_PANEL_SIZE = 220;
const MAX_PANEL_SIZE = 500;
const RESOLVE_LAYOUT_STORAGE_KEY = 'storyArcStudio.resolve.layout.v1';
const RESOLVE_DOCK_SLOTS_STORAGE_KEY = 'storyArcStudio.resolve.dock-slots.v1';
const RESOLVE_WORKSPACE_PROFILES_STORAGE_KEY = 'storyArcStudio.resolve.workspace-profiles.v1';
const COMPOSITION_SETTINGS_STORAGE_KEY = 'storyArcStudio.composition.settings.v1';

const DEFAULT_COMPOSITION_SETTINGS: StoryArcCompositionSettings = {
  enabled: false,
  target: 'both',
  guides: DEFAULT_CINEMATOGRAPHY_GUIDES,
  color: '#f59e0b',
  opacity: 0.75,
  thickness: 1.5,
  spiralOrientation: 'top-right',
  aspectMask: 'none',
};

function createEmptyWorkspaceProfiles(): ResolveWorkspaceProfiles {
  return {
    edit: null,
    cut: null,
    color: null,
    fairlight: null,
  };
}

function sanitizeCompositionSettings(value: unknown): StoryArcCompositionSettings | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<StoryArcCompositionSettings>;
  const guidesCandidate = candidate.guides;

  const normalizedGuides: CinematographyGuideSet = {
    ruleOfThirds:
      typeof guidesCandidate?.ruleOfThirds === 'boolean'
        ? guidesCandidate.ruleOfThirds
        : DEFAULT_COMPOSITION_SETTINGS.guides.ruleOfThirds,
    centerCrosshair:
      typeof guidesCandidate?.centerCrosshair === 'boolean'
        ? guidesCandidate.centerCrosshair
        : DEFAULT_COMPOSITION_SETTINGS.guides.centerCrosshair,
    goldenRatio:
      typeof guidesCandidate?.goldenRatio === 'boolean'
        ? guidesCandidate.goldenRatio
        : DEFAULT_COMPOSITION_SETTINGS.guides.goldenRatio,
    goldenSpiral:
      typeof guidesCandidate?.goldenSpiral === 'boolean'
        ? guidesCandidate.goldenSpiral
        : DEFAULT_COMPOSITION_SETTINGS.guides.goldenSpiral,
    diagonals:
      typeof guidesCandidate?.diagonals === 'boolean'
        ? guidesCandidate.diagonals
        : DEFAULT_COMPOSITION_SETTINGS.guides.diagonals,
    dynamicSymmetry:
      typeof guidesCandidate?.dynamicSymmetry === 'boolean'
        ? guidesCandidate.dynamicSymmetry
        : DEFAULT_COMPOSITION_SETTINGS.guides.dynamicSymmetry,
    safeAreas:
      typeof guidesCandidate?.safeAreas === 'boolean'
        ? guidesCandidate.safeAreas
        : DEFAULT_COMPOSITION_SETTINGS.guides.safeAreas,
    eyeLine:
      typeof guidesCandidate?.eyeLine === 'boolean'
        ? guidesCandidate.eyeLine
        : DEFAULT_COMPOSITION_SETTINGS.guides.eyeLine,
    headroomLeadroom:
      typeof guidesCandidate?.headroomLeadroom === 'boolean'
        ? guidesCandidate.headroomLeadroom
        : DEFAULT_COMPOSITION_SETTINGS.guides.headroomLeadroom,
    horizonLine:
      typeof guidesCandidate?.horizonLine === 'boolean'
        ? guidesCandidate.horizonLine
        : DEFAULT_COMPOSITION_SETTINGS.guides.horizonLine,
    perspective:
      typeof guidesCandidate?.perspective === 'boolean'
        ? guidesCandidate.perspective
        : DEFAULT_COMPOSITION_SETTINGS.guides.perspective,
  };

  const target = candidate.target;
  const spiralOrientation = candidate.spiralOrientation;
  const aspectMask = candidate.aspectMask;

  return {
    enabled:
      typeof candidate.enabled === 'boolean'
        ? candidate.enabled
        : DEFAULT_COMPOSITION_SETTINGS.enabled,
    target:
      target === 'source' || target === 'program' || target === 'both'
        ? target
        : DEFAULT_COMPOSITION_SETTINGS.target,
    guides: normalizedGuides,
    color:
      typeof candidate.color === 'string' && candidate.color.trim().length > 0
        ? candidate.color.trim()
        : DEFAULT_COMPOSITION_SETTINGS.color,
    opacity:
      typeof candidate.opacity === 'number' && Number.isFinite(candidate.opacity)
        ? Math.min(1, Math.max(0.1, candidate.opacity))
        : DEFAULT_COMPOSITION_SETTINGS.opacity,
    thickness:
      typeof candidate.thickness === 'number' && Number.isFinite(candidate.thickness)
        ? Math.min(6, Math.max(1, candidate.thickness))
        : DEFAULT_COMPOSITION_SETTINGS.thickness,
    spiralOrientation:
      spiralOrientation && CINEMATOGRAPHY_SPIRAL_ORIENTATIONS.includes(spiralOrientation)
        ? spiralOrientation
        : DEFAULT_COMPOSITION_SETTINGS.spiralOrientation,
    aspectMask:
      aspectMask && CINEMATOGRAPHY_ASPECT_MASKS.includes(aspectMask)
        ? aspectMask
        : DEFAULT_COMPOSITION_SETTINGS.aspectMask,
  };
}

function areResolveLayoutsEquivalent(
  left: ResolveLayoutState | null,
  right: ResolveLayoutState
): boolean {
  if (!left) {
    return false;
  }

  return (
    left.workspacePreset === right.workspacePreset &&
    left.showAssetPanel === right.showAssetPanel &&
    left.showInspectorPanel === right.showInspectorPanel &&
    left.showEffectsPanel === right.showEffectsPanel &&
    left.showMixerPanel === right.showMixerPanel &&
    left.panelSizes.leftPanel === right.panelSizes.leftPanel &&
    left.panelSizes.rightPanel === right.panelSizes.rightPanel &&
    left.showProgramMonitor === right.showProgramMonitor &&
    left.monitorFitMode === right.monitorFitMode &&
    left.editTool === right.editTool &&
    left.showAutoMonitor === right.showAutoMonitor &&
    left.multicamEnabled === right.multicamEnabled &&
    left.multicamApplyToTimeline === right.multicamApplyToTimeline
  );
}

const MEDIA_SOURCE_EXTENSION_REGEX =
  /\.(mp4|mov|m4v|webm|mkv|avi|mpeg|mpg|m2ts|mts|ts|wmv|flv|3gp|3g2|ogv|mp3|wav|aac|m4a|flac|ogg|opus)(?:[?#].*)?$/i;
const DEFAULT_COLOR_GRADING_PROFILE: StoryArc['colorGrading'] = {
  name: 'Neutral',
  temperature: 0,
  tint: 0,
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  saturation: 0,
  vibrance: 0,
  luts: [],
};

function isLikelyDirectMediaSourcePath(source: string | null | undefined): boolean {
  const normalized = typeof source === 'string' ? source.trim() : '';
  if (!normalized) return false;

  if (
    normalized.startsWith('blob:') ||
    normalized.startsWith('data:') ||
    normalized.startsWith('http://') ||
    normalized.startsWith('https://')
  ) {
    return true;
  }

  if (normalized.startsWith('/api/')) {
    return MEDIA_SOURCE_EXTENSION_REGEX.test(normalized);
  }

  if (normalized.startsWith('/')) {
    return MEDIA_SOURCE_EXTENSION_REGEX.test(normalized);
  }

  return MEDIA_SOURCE_EXTENSION_REGEX.test(normalized);
}

function getUserSub(authUser: unknown): string | undefined {
  if (!authUser || typeof authUser !== 'object') {
    return undefined;
  }

  const sub = (authUser as Record<string, unknown>).sub;
  return typeof sub === 'string' ? sub : undefined;
}

function buildFallbackStoryArc(
  id: string,
  title: string,
  totalDuration: number
): StoryArc {
  return {
    id,
    title,
    type: 'wedding',
    totalDuration,
    segments: [],
    musicSuggestions: [],
    transitionEffects: [],
    colorGrading: DEFAULT_COLOR_GRADING_PROFILE,
    confidence: 0.9,
    createdAt: new Date().toISOString(),
  };
}

function buildProjectContextFromWindowState(
  value: unknown
): ProjectToEditorData | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<ProjectToEditorData>;
  if (typeof candidate.projectId !== 'string' || candidate.projectId.length === 0) {
    return null;
  }

  return {
    projectId: candidate.projectId,
    projectName:
      typeof candidate.projectName === 'string' && candidate.projectName.length > 0
        ? candidate.projectName
        : 'Untitled Project',
    clientName:
      typeof candidate.clientName === 'string' && candidate.clientName.length > 0
        ? candidate.clientName
        : 'Unknown Client',
    projectType:
      typeof candidate.projectType === 'string' && candidate.projectType.length > 0
        ? candidate.projectType
        : 'wedding',
    weddingCulture: candidate.weddingCulture,
    shotList: candidate.shotList,
    timelineEvents: candidate.timelineEvents,
    googleDriveFolderId: candidate.googleDriveFolderId,
    memoryCardConfigs: candidate.memoryCardConfigs,
    primaryCamera: candidate.primaryCamera,
    backupCamera: candidate.backupCamera,
    logFormat: candidate.logFormat,
    // Intentionally not restoring function callbacks from persisted state.
    returnCallback:
      typeof candidate.returnCallback === 'function'
        ? candidate.returnCallback
        : undefined,
  };
}

function getInitialProjectContextFromEnvironment(): ProjectToEditorData | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const historyState = window.history.state as
    | { usr?: unknown; state?: unknown }
    | undefined;
  const fromHistory = buildProjectContextFromWindowState(
    historyState?.usr ?? historyState?.state
  );
  if (fromHistory) {
    return fromHistory;
  }

  try {
    const persisted = sessionStorage.getItem('storyArcStudio_projectContext');
    if (persisted) {
      const parsed = JSON.parse(persisted) as unknown;
      const fromSession = buildProjectContextFromWindowState(parsed);
      if (fromSession) {
        return fromSession;
      }
    }
  } catch {
    // Ignore storage parse issues.
  }

  const params = new URLSearchParams(window.location.search);
  const projectId = params.get('projectId');
  if (!projectId) {
    return null;
  }

  return {
    projectId,
    projectName: params.get('projectName') || 'Untitled Project',
    clientName: params.get('clientName') || 'Unknown Client',
    projectType: params.get('projectType') || 'wedding',
  };
}

export default function StoryArcStudio({ 
  storyArcId, 
  onClose,
  onMeetingCreate,
  onProjectUpdate,
  onWorklogCreate,
  onShowcaseCreate,
  onFileUpload,
  onFileDownload,
  selectedProject,
  onProjectSelect
}: StoryArcStudioProps) {
  // Data state
  const [storyArc, setStoryArc] = useState<StoryArc | null>(null);
  const [clips, setClips] = useState<BeatClip[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // UI state
  const [panelSizes, setPanelSizes] = useState<PanelSizes>(INITIAL_PANEL_SIZES);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(480); // 8 minutes default
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // 1x normal speed
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [selectedClips, setSelectedClips] = useState<Set<string>>(new Set());
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showAutoMonitor, setShowAutoMonitor] = useState(false);

  // Pro timeline states
  const [trackStates, setTrackStates] = useState<Record<string, TrackState>>({});
  const [trackHeightScale, setTrackHeightScale] = useState(1);
  const [markers, setMarkers] = useState<TimelineMarker[]>([]);
  const [transitions, setTransitions] = useState<TimelineTransition[]>([]);
  const [magneticEnabled, setMagneticEnabled] = useState(true);
  const [rippleEnabled, setRippleEnabled] = useState(false);
  const [pendingTransitionType, setPendingTransitionType] = useState<string | null>(null);
  const [pendingTransitionDuration, setPendingTransitionDuration] = useState<number>(0.5);
  const [pendingTransitionEngine, setPendingTransitionEngine] = useState<'canvas2d' | 'webgl'>('canvas2d');

  // Clip metadata & collaboration
  interface ClipMeta { 
    camera?: string; 
    shotName?: string; 
    scene?: string; 
    take?: string; 
    tags?: string[];
    syncGroup?: string; // Multi-angle sync group identifier
    faceDetection?: {
      hasFace: boolean;
      faceCount: number;
      confidence: number;
      analyzedAt: number;
      // Comprehensive FaceXFormer analysis results
      comprehensiveAnalysis?: {
        parsing?: {
          mask?: string; // base64
          visualization?: string; // base64
        };
        landmarks?: {
          points: Array<{ x: number; y: number }>;
          count: number;
          visualization?: string; // base64
        };
        headpose?: {
          pitch: number;
          yaw: number;
          roll: number;
          visualization?: string; // base64
        };
        attributes?: {
          values: number[];
          count: number;
        };
      };
      bestTimestamp?: number; // Timestamp of best result
      scanMetadata?: {
        totalFramesAnalyzed: number;
        framesWithFaces: number;
        faceDetectionRate: number;
        timestamps: Array<{ timestamp: number; hasFace: boolean }>;
      };
    };
  }
  const [clipMeta, setClipMeta] = useState<Record<string, ClipMeta>>({});
  
  // Face detection worker state
  const [faceDetectionProgress, setFaceDetectionProgress] = useState<FaceDetectionProgress | null>(null);
  const [faceDetectionRunning, setFaceDetectionRunning] = useState(false);
  const [showFaceDetectionDialog, setShowFaceDetectionDialog] = useState(false);
  
  // Scene detection worker state
  const [sceneDetectionProgress, setSceneDetectionProgress] = useState<{ 
    status: string; 
    progress: number; 
    message?: string;
    scenes?: Array<{ scene_number: number; start_time: number; end_time: number; duration: number }>;
    error?: string;
  } | null>(null);
  const [showSceneDetectionDialog, setShowSceneDetectionDialog] = useState(false);
  const [sceneDetectionJobId, setSceneDetectionJobId] = useState<string | null>(null);
  
  // Face detection options dialog state (replaces window.confirm/prompt)
  const [showFaceDetectionOptionsDialog, setShowFaceDetectionOptionsDialog] = useState(false);
  const [faceDetectionOptions, setFaceDetectionOptions] = useState<{
    scanEntire: boolean;
    fps: number;
    taskChoice: string;
  }>({ scanEntire: false, fps: 0.5, taskChoice: '1' });
  const [pendingFaceDetectionResolve, setPendingFaceDetectionResolve] = useState<((options: { scanEntire: boolean; fps: number; taskChoice: string } | null) => void) | null>(null);
  
  // Subclips confirm dialog state (replaces window.confirm for subclips)
  const [showSubclipsConfirmDialog, setShowSubclipsConfirmDialog] = useState(false);
  const [subclipsConfirmData, setSubclipsConfirmData] = useState<{ facesFound: number; totalClips: number } | null>(null);
  const [pendingSubclipsResolve, setPendingSubclipsResolve] = useState<((createSubclips: boolean) => void) | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [reviewerMode, setReviewerMode] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareSnapshot, setCompareSnapshot] = useState<BeatClip[]>([]);
  const [collabLocks, setCollabLocks] = useState<Record<string, { user?: string }>>({});
  const [comments, setComments] = useState<Array<{ id: string; time: number; text: string; clipId?: string }>>([]);
  
  // Professional transport state
  const [isLooping, setIsLooping] = useState(false);
  const [playbackDirection, setPlaybackDirection] = useState<'forward' | 'reverse'>('forward');
  const [monitorFitMode, setMonitorFitMode] = useState<'fit' | 'fill'>('fit');
  const [activeMonitor, setActiveMonitor] = useState<ResolveMonitorFocus>('program');
  const [showProgramMonitor, setShowProgramMonitor] = useState(true);
  const [showCompositionGuides, setShowCompositionGuides] = useState(
    DEFAULT_COMPOSITION_SETTINGS.enabled
  );
  const [showCompositionGuideDialog, setShowCompositionGuideDialog] = useState(false);
  const [compositionGuideTarget, setCompositionGuideTarget] = useState<CinematographyGuideTarget>(
    DEFAULT_COMPOSITION_SETTINGS.target
  );
  const [compositionGuides, setCompositionGuides] = useState<CinematographyGuideSet>(
    DEFAULT_COMPOSITION_SETTINGS.guides
  );
  const [compositionGuideColor, setCompositionGuideColor] = useState(
    DEFAULT_COMPOSITION_SETTINGS.color
  );
  const [compositionGuideOpacity, setCompositionGuideOpacity] = useState(
    DEFAULT_COMPOSITION_SETTINGS.opacity
  );
  const [compositionGuideThickness, setCompositionGuideThickness] = useState(
    DEFAULT_COMPOSITION_SETTINGS.thickness
  );
  const [compositionSpiralOrientation, setCompositionSpiralOrientation] =
    useState<CinematographySpiralOrientation>(
      DEFAULT_COMPOSITION_SETTINGS.spiralOrientation
    );
  const [compositionAspectMask, setCompositionAspectMask] = useState<CinematographyAspectMask>(
    DEFAULT_COMPOSITION_SETTINGS.aspectMask
  );
  const [compositionSettingsReady, setCompositionSettingsReady] = useState(false);
  const [editTool, setEditTool] = useState<ResolveEditTool>('select');
  const [workspacePreset, setWorkspacePreset] = useState<ResolveWorkspacePreset>('edit');
  const [workspaceProfiles, setWorkspaceProfiles] = useState<ResolveWorkspaceProfiles>(
    () => createEmptyWorkspaceProfiles()
  );
  const [showAssetPanel, setShowAssetPanel] = useState(true);
  const [showInspectorPanel, setShowInspectorPanel] = useState(true);
  const [showEffectsPanel, setShowEffectsPanel] = useState(false);
  const [showMixerPanel, setShowMixerPanel] = useState(false);
  const [savedDockSlots, setSavedDockSlots] = useState<Record<ResolveDockSlotId, ResolveLayoutState | null>>({
    'dock-1': null,
    'dock-2': null,
    'dock-3': null,
  });
  const [layoutStateReady, setLayoutStateReady] = useState(false);
  const [workspaceProfilesReady, setWorkspaceProfilesReady] = useState(false);
  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);
  const [sourceMarkIn, setSourceMarkIn] = useState<number | null>(null);
  const [sourceMarkOut, setSourceMarkOut] = useState<number | null>(null);
  const [programMarkIn, setProgramMarkIn] = useState<number | null>(null);
  const [programMarkOut, setProgramMarkOut] = useState<number | null>(null);
  const [selectedLUTName, setSelectedLUTName] = useState<string | null>(null);
  const [showLUTLibraryDialog, setShowLUTLibraryDialog] = useState(false);
  const [showHLSImportDialog, setShowHLSImportDialog] = useState(false);
  const [captionsExport, setCaptionsExport] = useState<CaptionExportPayload | null>(null);
  const [timelineWarnings, setTimelineWarnings] = useState<string[]>([]);
  const [timelineErrors, setTimelineErrors] = useState<string[]>([]);
  const [audioMeterLevel, setAudioMeterLevel] = useState(0);
  const [thumbnailCacheSummary, setThumbnailCacheSummary] = useState<ThumbnailCacheSummary>({
    thumbnailCount: 0,
    totalSize: 0,
  });
  const [undoStack, setUndoStack] = useState<BeatClip[][]>([]);
  const [redoStack, setRedoStack] = useState<BeatClip[][]>([]);
  const [clipClipboard, setClipClipboard] = useState<ClipClipboardItem[]>([]);
  
  // Refs for resizing
  const leftResizerRef = useRef<HTMLDivElement>(null);
  const rightResizerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<'left' | 'right' | null>(null);
  const sourcePreviewVideoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const [sourcePreviewReady, setSourcePreviewReady] = useState(false);
  const [sourcePreviewError, setSourcePreviewError] = useState<string | null>(null);
  const [sourcePreviewTime, setSourcePreviewTime] = useState(0);
  const [sourcePreviewDuration, setSourcePreviewDuration] = useState(0);
  const [sourcePreviewIsPlaying, setSourcePreviewIsPlaying] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const timelineHistoryReadyRef = useRef(false);
  const skipHistorySnapshotRef = useRef(false);
  const previousClipsRef = useRef<BeatClip[]>([]);
  const hlsServiceRef = useRef<HLSStreamingService | null>(null);
  const fixtureTimelineLockRef = useRef(false);
  
  // DaVinci Resolve Export Dialog
  const [showResolveExportDialog, setShowResolveExportDialog] = useState(false);
  
  // Save status
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedVia, setSavedVia] = useState<'db' | 'drive' | null>(null);

  // Settings
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [drivePrimaryIntervalMs, setDrivePrimaryIntervalMs] = useState<number>(30000); // default 30s
  const [driveBackupIntervalMs, setDriveBackupIntervalMs] = useState<number>(300000); // default 5m
  const [driveUploadsEnabled, setDriveUploadsEnabled] = useState<boolean>(true);
  const [drivePrimaryEnabled, setDrivePrimaryEnabled] = useState<boolean>(true);
  const [driveBackupEnabled, setDriveBackupEnabled] = useState<boolean>(true);
  const [drivePrimaryFolderName, setDrivePrimaryFolderName] = useState<string>('Timeline & Notes');
  const [driveBackupFolderName, setDriveBackupFolderName] = useState<string>('Timeline & Notes Backups');
  const [drivePrimaryFilenameTemplate, setDrivePrimaryFilenameTemplate] = useState<string>('story-arc-editor-state-{id}.json');
  const [driveBackupFilenameTemplate, setDriveBackupFilenameTemplate] = useState<string>('story-arc-editor-state-{id}-backup-{ts}.json');
  const [pushSettingsOpen, setPushSettingsOpen] = useState(false);
  
  // Push notifications
  const { user } = useAuth();
  const userId = user?.id || getUserSub(user);
  const { pushEnabled, isSupported } = usePushNotifications(userId);
  
  // Profession system hooks
  const { professionConfigs, getUserProfessionColor } = useDynamicProfessions();
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  const professionAdapter = useProfessionAdapter();
  const currentProfession = professionAdapter.profession || 'videographer';
  const professionIcon = getProfessionIcon(currentProfession);
  const professionConfig = professionConfigs?.[currentProfession];
  const enhancedProfessionConfig = apiProfessionConfigs?.[currentProfession] || professionConfig;
  const professionColor = getUserProfessionColor(currentProfession) || '#FF6B35';
  
  // Onboarding state
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [ensuringMapping, setEnsuringMapping] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' | 'warning' }>({ open: false, message: '', severity: 'info' });
  
  // Recent projects state
  const [recentProjects, setRecentProjects] = useState<Array<{
    id: string;
    storyArcName: string;
    status: string;
    templateType: string;
    createdAt: string;
  }>>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // Fetch recent projects
  const fetchRecentProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const response = await fetch('/api/story-arc/projects', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.projects)) {
          // Get most recent 5 projects
          setRecentProjects(data.projects.slice(0, 5));
        }
      }
    } catch (error) {
      console.warn('Failed to fetch recent projects: ', error);
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  // Handle onboarding completion
  const handleOnboardingComplete = useCallback(async () => {
    // Mark onboarding as completed in database
    try {
      const response = await fetch('/api/story-arc/onboarding/complete', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ completed: true }),
      });
      
      if (!response.ok) {
        // Fallback to localStorage if API fails
        localStorage.setItem('storyArcStudio_onboardingCompleted','true');
      } else {
        // Also save to localStorage for quick access
        localStorage.setItem('storyArcStudio_onboardingCompleted','true');
      }
    } catch (error) {
      // Fallback to localStorage
      localStorage.setItem('storyArcStudio_onboardingCompleted','true');
      console.warn('Failed to save onboarding completion to database: ', error);
    }

    setOnboardingOpen(false);
    setSnackbar({
      open: true,
      message: 'Welcome to Story Arc Studio! You\'re all set to start editing.',
      severity: 'success',
    });
  }, []);
  
  // Worker initialization state
  const [workerInitStatus, setWorkerInitStatus] = useState<{
    inProgress: boolean;
    completed: boolean;
    error: string | null;
    progress: number;
    workers: Record<string, { ready: boolean; message: string; friendlyName?: string; description?: string }>;
  }>({
    inProgress: false,
    completed: false,
    error: null,
    progress: 0,
    workers: {},
  });
  
  // ==========================================
  // PROJECT INTEGRATION - DECLARE FIRST!
  // ==========================================
  const [, setLocation] = useWouterLocation();
  const navigate = useCallback(
    (path: string) => {
      setLocation(path);
    },
    [setLocation]
  );
  const [projectContext, setProjectContext] = useState<ProjectToEditorData | null>(
    () => getInitialProjectContextFromEnvironment()
  );
  const [editingStartTime] = useState(Date.now());
  const [culturalMomentsDetected, setCulturalMomentsDetected] = useState<string[]>([]);

  useEffect(() => {
    if (!projectContext) {
      return;
    }

    const serializableContext = {
      ...projectContext,
      returnCallback: undefined,
    };

    try {
      sessionStorage.setItem(
        'storyArcStudio_projectContext',
        JSON.stringify(serializableContext)
      );
    } catch {
      // Ignore storage failures.
    }
  }, [projectContext]);
  
  /**
   * Import project data from ProjectCreationWithMemoryCards
   */
  const handleImportFromProject = useCallback(async () => {
    if (!projectContext) return;
    
    console.log('🎬 Importing project data to StoryArcStudio..., ');
    
    try {
      // Import media from Google Drive if available
      if (projectContext.googleDriveFolderId) {
        console.log('☁️ Importing from Google Drive folder:', projectContext.googleDriveFolderId);
        // The AssetBrowser component will handle this
      }
      
      // Load shot list for AI guidance
      if (projectContext.shotList && projectContext.shotList.length > 0) {
        const formattedShots = formatShotListForAI(projectContext.shotList);
        const guidanceCommentId = `guide_${Date.now()}`;
        setComments((prev) => [
          ...prev,
          {
            id: guidanceCommentId,
            time: currentTime,
            text: `Shot List Guidance\n${formattedShots}`,
          },
        ]);
        console.log('📋 Loaded shot list:', projectContext.shotList.length, 'shots');
      }
      
      // Load timeline events for pacing
      if (projectContext.timelineEvents && projectContext.timelineEvents.length > 0) {
        console.log('⏰ Loaded timeline events:', projectContext.timelineEvents.length, 'events');
      }

      const highlightText = getCulturalHighlights(projectContext.weddingCulture || projectContext.projectType);
      const extractedMoments = highlightText
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      if (extractedMoments.length > 0) {
        setCulturalMomentsDetected(extractedMoments);
      }

      const aiPrompt = generateAIPrompt(projectContext);
      setComments((prev) => [
        ...prev,
        {
          id: `prompt_${Date.now()}`,
          time: currentTime,
          text: `AI Prompt Context\n${aiPrompt}`,
        },
      ]);

      onProjectSelect?.({
        id: projectContext.projectId,
        name: projectContext.projectName,
        type: projectContext.projectType,
      });
      onProjectUpdate?.({
        id: projectContext.projectId,
        name: projectContext.projectName,
        status: 'editing',
      });
      
      // Show success message
      console.log('✅ Project data imported successfully!');
      
    } catch (error) {
      console.error('❌ Error importing project data:', error);
    }
  }, [projectContext, currentTime, onProjectSelect, onProjectUpdate]);
  
  /**
   * Submit rating to training pipeline
   */
  const handleSubmitVideoRating = async (rating: number, feedback: string) => {
    if (!aiGeneratedTimelineData) {
      console.error('No AI-generated timeline data available');
      return;
    }

    try {
      await fetch('/api/ai-training/collect/video-editing', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({
          userId: 'current_user_id', // Replace with actual user ID
          aiFeatureUsed: 'ai_story_generator',
          timelineData: aiGeneratedTimelineData,
          userRating: rating,
          userFeedback: feedback,
          acceptedSuggestions: clips.map(c => c.id),
          dismissedSuggestions: [],
          exportQuality: 'high',
        }),
      });

      console.log('✅ Video editing rating submitted successfully:', rating, feedback);
    } catch (error) {
      console.error('❌ Failed to submit video rating:', error);
    }
  };

  /**
   * Export video back to project
   */
  const handleExportToProject = useCallback(async (exportedVideo: ExportedVideoResult) => {
    if (!projectContext || !projectContext.returnCallback) {
      console.warn('⚠️ No project context or return callback available');
      return;
    }
    
    console.log('📤 Exporting video back to project...');
    
    try {
      const editingTime = Math.round((Date.now() - editingStartTime) / 1000 / 60); // minutes
      
      const result: EditorToProjectResult = {
        projectId: projectContext.projectId,
        videoUrl: exportedVideo.url,
        thumbnailUrl: exportedVideo.thumbnail,
        duration: exportedVideo.duration || 0,
        clipCount: clips.length,
        transitionCount: clips.length - 1,
        editingTime: editingTime,
        usedAI: true, // Would track if AI was actually used
        aiConfidence: 0.92,
        culturalMoments: culturalMomentsDetected,
        appliedTransitions: ['crossfade','zoom_in','fade_white'], // Would track actual transitions
        appliedLUTs: projectContext.logFormat ? [`LOG/${projectContext.logFormat}_to_Rec709.cube`] : [],
        exportSettings: {
          resolution: exportedVideo.resolution || '4K',
          codec: exportedVideo.codec || 'H.265',
          format: exportedVideo.format || 'MP4'
        },
        worklogEntry: {
          title: `Video Editing Completed - ${projectContext.clientName}`,
          description: '', // Will be generated
          timeSpent: editingTime,
          category: 'editing',
          phase: 'post_production'
        }
      };
      
      // Generate worklog description
      result.worklogEntry.description = generateWorklogDescription(result);
      
      // Call return callback
      await projectContext.returnCallback(result);
      onWorklogCreate?.(result.worklogEntry);
      onShowcaseCreate?.({
        projectId: result.projectId,
        title: projectContext.projectName,
        videoUrl: result.videoUrl,
        thumbnailUrl: result.thumbnailUrl,
      });
      onMeetingCreate?.({
        type: 'delivery-review',
        projectId: result.projectId,
        title: `Review Delivery - ${projectContext.projectName}`,
        agenda: result.worklogEntry.description,
      });
      onFileDownload?.({
        url: result.videoUrl,
        kind: 'export',
      });
      
      console.log('✅ Video exported to project successfully!');
      
      // Navigate back to dashboard
      navigate('/dashboard?tab=projects');
      
    } catch (error) {
      console.error('❌ Error exporting to project:', error);
    }
  }, [
    projectContext,
    editingStartTime,
    tracks,
    culturalMomentsDetected,
    navigate,
    onWorklogCreate,
    onShowcaseCreate,
    onMeetingCreate,
    onFileDownload,
  ]);
  const [resolveExportSettings, setResolveExportSettings] = useState({
    includeEDL: true,
    includeXML: true,
    includeAAF: false,
    applyScripts: true,
    selectedScripts: [] as string[],
    culture: '',
    projectType: 'wedding'
  });
  
  // AI Story Generator Dialog
  const [showAIGeneratorDialog, setShowAIGeneratorDialog] = useState(false);
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [aiGeneratedTimelineData, setAIGeneratedTimelineData] = useState<any>(null);

  // ==========================================
  // ALL PROFESSIONAL FEATURES - PANELS
  // ==========================================
  const [showTransitionLibrary, setShowTransitionLibrary] = useState(false);
  const [showSpeedRampPanel, setShowSpeedRampPanel] = useState(false);
  const [showTextOverlayPanel, setShowTextOverlayPanel] = useState(false);
  const [showGPUFiltersPanel, setShowGPUFiltersPanel] = useState(false);
  const [showColorGradingPanel, setShowColorGradingPanel] = useState(false);
  const [showAutoCaptionsPanel, setShowAutoCaptionsPanel] = useState(false);
  const [showBeatSyncPanel, setShowBeatSyncPanel] = useState(false);
  const [showMotionTrackingPanel, setShowMotionTrackingPanel] = useState(false);
  const [showObjectSegmentationPanel, setShowObjectSegmentationPanel] = useState(false);
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const [selectedSyncClips, setSelectedSyncClips] = useState<Set<string>>(new Set());
  const [syncInProgress, setSyncInProgress] = useState(false);
  const [syncJobId, setSyncJobId] = useState<string | null>(null);
  const [syncResults, setSyncResults] = useState<Record<string, EngineAudioSyncResult> | null>(null);
  const [manualOffsets, setManualOffsets] = useState<Record<string, number>>({});
  const [syncPreviewMode, setSyncPreviewMode] = useState(false);
  const [syncTryReallyHard, setSyncTryReallyHard] = useState(true);
  const [syncEnableDriftCorrection, setSyncEnableDriftCorrection] = useState(true);
  const [syncPreferTimecode, setSyncPreferTimecode] = useState(true);
  const [syncAllowClipReorder, setSyncAllowClipReorder] = useState(false);
  const [syncUseServerFirst, setSyncUseServerFirst] = useState(false);
  const [syncMaxOffsetSeconds, setSyncMaxOffsetSeconds] = useState(30);

  // Audio enhancement dialog state
  const [showAudioEnhancementDialog, setShowAudioEnhancementDialog] = useState(false);
  const [pendingAudioFile, setPendingAudioFile] = useState<File | null>(null);

  // Batch audio enhancement dialog state
  const [showBatchAudioDialog, setShowBatchAudioDialog] = useState(false);
  const [batchAudioFiles, setBatchAudioFiles] = useState<File[]>([]);

  // AI Audio Assistant dialog state
  const [showAIAudioAssistant, setShowAIAudioAssistant] = useState(false);
  const [selectedAudioTrackId, setSelectedAudioTrackId] = useState<string | null>(null);
  const [openMixerDirectly, setOpenMixerDirectly] = useState(false);

  // Feature states
  const [currentSpeedKeyframes, setCurrentSpeedKeyframes] = useState<any[]>([]);
  const [clipMap, setClipMap] = useState<Map<string, BeatClip>>(new Map());
  const [currentColorGrade, setCurrentColorGrade] = useState<any>({});
  const [textOverlays, setTextOverlays] = useState<any[]>([]);
  const [appliedFilters, setAppliedFilters] = useState<Map<string, any>>(new Map());
  const [availableVideoSources, setAvailableVideoSources] = useState<string[]>([]);
  const [activeSourcePreview, setActiveSourcePreview] = useState<SourcePreviewAsset | null>(null);
  const [sourceFileRegistry, setSourceFileRegistry] = useState<Record<string, File>>({});
  const [multicamEnabled, setMulticamEnabled] = useState(false);
  const [multicamApplyToTimeline, setMulticamApplyToTimeline] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [monitorFolderLink, setMonitorFolderLink] = useState<string | null>(null);
  const [driveInit, setDriveInit] = useState<{ status: 'idle' | 'initializing' | 'ready' | 'needs_auth' | 'needs_google_connect' | 'error'; message?: string; folderId?: string; }>({ status: 'idle' });

  const extractRenderableVideoSources = useCallback((clipList: BeatClip[]): string[] => {
    const uniqueSources = new Set<string>();
    clipList.forEach((clip) => {
      const source = clip?.sourceFile?.trim();
      if (!source) return;
      if (!isLikelyDirectMediaSourcePath(source)) return;
      const trackId = (clip.trackId || '').toLowerCase();
      if (trackId.startsWith('audio')) return;
      uniqueSources.add(source);
    });
    return Array.from(uniqueSources);
  }, []);

  const isLikelyDirectMediaSource = useCallback((source: string | null | undefined) => {
    return isLikelyDirectMediaSourcePath(source);
  }, []);

  const isUsableMediaSource = useCallback(
    (source: string | null | undefined): boolean => {
      const normalized = typeof source === 'string' ? source.trim() : '';
      if (!isLikelyDirectMediaSourcePath(normalized)) {
        return false;
      }
      if (normalized.startsWith('blob:')) {
        return sourceFileRegistry[normalized] instanceof File;
      }
      return true;
    },
    [sourceFileRegistry]
  );

  const hydrateClipSources = useCallback((clipList: BeatClip[]): BeatClip[] => {
    if (!Array.isArray(clipList) || clipList.length === 0) {
      return clipList;
    }

    const inTimelineSources = extractRenderableVideoSources(clipList);
    const sourcePool = Array.from(new Set([...inTimelineSources, ...availableVideoSources])).filter((source) =>
      isUsableMediaSource(source)
    );
    if (sourcePool.length === 0) {
      return clipList.map((clip) => {
        const existingSource = clip.sourceFile?.trim();
        if (!existingSource || isUsableMediaSource(existingSource)) {
          return clip;
        }

        return {
          ...clip,
          sourceFile: '',
          metadata: {
            ...(clip.metadata || {}),
            missingSource: true,
          },
        };
      });
    }

    let sourceIndex = 0;
    return clipList.map((clip) => {
      const trackId = (clip.trackId || '').toLowerCase();
      const isAudioTrack = trackId.startsWith('audio');
      if (isAudioTrack) {
        return clip;
      }

      const existingSource = clip.sourceFile?.trim();
      if (existingSource && isUsableMediaSource(existingSource)) {
        return clip;
      }
      if (existingSource && sourcePool.length === 0) {
        return {
          ...clip,
          sourceFile: '',
          metadata: {
            ...(clip.metadata || {}),
            missingSource: true,
          },
        };
      }

      const fallbackSource = sourcePool[sourceIndex % sourcePool.length];
      sourceIndex += 1;
      return {
        ...clip,
        sourceFile: fallbackSource,
        metadata: {
          ...(clip.metadata || {}),
          autoBoundSource: true,
          missingSource: false,
        },
      };
    });
  }, [availableVideoSources, extractRenderableVideoSources, isUsableMediaSource]);
  
  const loadStoryArcData = async () => {
    try {
      setIsLoading(true);
      const arcData = await StoryArcDataIntegration.fetchStoryArcData(storyArcId);
      
      if (arcData) {
        if (fixtureTimelineLockRef.current) {
          return;
        }
        setStoryArc(arcData);
        const { clips: beatClips, tracks: trackData } = StoryArcDataIntegration.convertStoryArcToBeats(arcData);
        const hydratedClips = hydrateClipSources(beatClips);
        setClips(hydratedClips);
        setAvailableVideoSources((prev) => {
          const merged = new Set([...prev, ...extractRenderableVideoSources(hydratedClips)]);
          return Array.from(merged);
        });
        setTracks(trackData);
        // initialize track states
        setTrackStates(Object.fromEntries(trackData.map(t => [t.id, { locked: false, mute: false, solo: false, visible: true, type: t.id.startsWith('audio') ? 'audio' : 'video' }])));
      }
    } catch (error) {
      console.error('Error loading story arc:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Build current editor state payload
  const buildEditorState = useCallback(() => ({
    storyArcId: storyArc?.id || storyArcId,
    timeline: {
      totalDuration,
      zoom: timelineZoom,
      reviewerMode,
      magneticEnabled,
      rippleEnabled,
      compareMode,
      currentTime,
      drivePrimaryIntervalMs,
      driveBackupIntervalMs,
      driveUploadsEnabled,
      drivePrimaryEnabled,
      driveBackupEnabled,
      drivePrimaryFolderName,
      driveBackupFolderName,
      drivePrimaryFilenameTemplate,
      driveBackupFilenameTemplate,
    },
    tracks,
    trackStates,
    clips,
    markers,
    transitions,
    clipMetadata: clipMeta,
    comments,
  }), [storyArc?.id, storyArcId, totalDuration, timelineZoom, reviewerMode, magneticEnabled, rippleEnabled, compareMode, currentTime, tracks, trackStates, clips, markers, transitions, clipMeta, comments]);

  // Resolve storyArcId from external projectId if needed and then load editor state
  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        // Resolve story arc id
        let id = storyArcId || storyArc?.id || null;
        const externalProjectId = projectContext?.projectId;
        if (!id && externalProjectId) {
          // Ensure mapping + Drive folder ready up-front
          const ensureUrl = `/api/story-arc/by-project/${encodeURIComponent(String(externalProjectId))}/ensure?name=${encodeURIComponent(projectContext?.projectName || 'Untitled Project')}`;
          let res = await fetch(ensureUrl, { method: 'POST', credentials: 'include' });
          if (!res.ok) {
            // fallback to mapping-only GET
            res = await fetch(`/api/story-arc/by-project/${encodeURIComponent(String(externalProjectId))}`, { credentials: 'include' });
          }
          const json = await res.json().catch(() => ({}));
          if (aborted) return;
          if (json?.success && typeof json.storyArcId === 'string' && json.storyArcId.length > 0) {
            id = json.storyArcId;
            setStoryArc((prev) =>
              prev
                ? { ...prev, id }
                : buildFallbackStoryArc(
                    id,
                    projectContext?.projectName || 'Untitled Project',
                    totalDuration
                  )
            );
          }
        }
        if (!id) return;
        // Load editor state
        const res2 = await fetch(`/api/story-arc/${id}/editor-state`, { credentials: 'include' });
        if (!res2.ok) return;
        const json2 = await res2.json();
        if (aborted || !json2?.success || !json2?.editorState) return;
        if (fixtureTimelineLockRef.current) return;
        const st = json2.editorState;
        if (Array.isArray(st.tracks)) setTracks(st.tracks);
        if (st.trackStates) setTrackStates(st.trackStates);
        if (Array.isArray(st.clips)) {
          const hydratedStoredClips = hydrateClipSources(st.clips);
          setClips(hydratedStoredClips);
          setAvailableVideoSources((prev) => {
            const merged = new Set([...prev, ...extractRenderableVideoSources(hydratedStoredClips)]);
            return Array.from(merged);
          });
        }
        if (Array.isArray(st.markers)) setMarkers(st.markers);
        if (Array.isArray(st.transitions)) setTransitions(st.transitions);
        if (st.clipMetadata) setClipMeta(st.clipMetadata);
        if (Array.isArray(st.comments)) setComments(st.comments);
        if (st.timeline) {
          if (typeof st.timeline.totalDuration === 'number') setTotalDuration(st.timeline.totalDuration);
          if (typeof st.timeline.zoom === 'number') setTimelineZoom(st.timeline.zoom);
          if (typeof st.timeline.reviewerMode === 'boolean') setReviewerMode(st.timeline.reviewerMode);
          if (typeof st.timeline.magneticEnabled === 'boolean') setMagneticEnabled(st.timeline.magneticEnabled);
          if (typeof st.timeline.rippleEnabled === 'boolean') setRippleEnabled(st.timeline.rippleEnabled);
          if (typeof st.timeline.drivePrimaryIntervalMs === 'number') setDrivePrimaryIntervalMs(st.timeline.drivePrimaryIntervalMs);
          if (typeof st.timeline.driveBackupIntervalMs === 'number') setDriveBackupIntervalMs(st.timeline.driveBackupIntervalMs);
          if (typeof st.timeline.driveUploadsEnabled === 'boolean') setDriveUploadsEnabled(st.timeline.driveUploadsEnabled);
          if (typeof st.timeline.drivePrimaryEnabled === 'boolean') setDrivePrimaryEnabled(st.timeline.drivePrimaryEnabled);
          if (typeof st.timeline.driveBackupEnabled === 'boolean') setDriveBackupEnabled(st.timeline.driveBackupEnabled);
          if (typeof st.timeline.drivePrimaryFolderName === 'string') setDrivePrimaryFolderName(st.timeline.drivePrimaryFolderName);
          if (typeof st.timeline.driveBackupFolderName === 'string') setDriveBackupFolderName(st.timeline.driveBackupFolderName);
          if (typeof st.timeline.drivePrimaryFilenameTemplate === 'string') setDrivePrimaryFilenameTemplate(st.timeline.drivePrimaryFilenameTemplate);
          if (typeof st.timeline.driveBackupFilenameTemplate === 'string') setDriveBackupFilenameTemplate(st.timeline.driveBackupFilenameTemplate);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.warn('Editor state load skipped:', message);
      }
    })();
    return () => { aborted = true; };
  }, [storyArcId, storyArc?.id, projectContext, hydrateClipSources, extractRenderableVideoSources, totalDuration]);

  // Autosave editor state (debounced) with Drive fallback
  const lastPrimaryUploadRef = useRef<number>(0);
  const lastBackupUploadRef = useRef<number>(0);
  useEffect(() => {
    const id = storyArcId || storyArc?.id;
    if (!id) return;
    const state = buildEditorState();
    const t = setTimeout(async () => {
      setSaveStatus('saving');
      setSaveError(null);
      setSavedVia(null);
      let savedOk = false;
      try {
        const res = await fetch(`/api/story-arc/${id}/editor-state`, {
          method: 'PUT',
          headers: { 'Content-Type' : 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ editorState: state }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        savedOk = true;
        setSavedVia('db');
        setLastSavedAt(Date.now());
        setSaveStatus('saved');
      } catch (error) {
        // Fallback: ensure mapping and upload JSON to Drive
        let fallbackOk = false;
        const pid = projectContext?.projectId;
        if (pid && driveUploadsEnabled) {
          try {
            await fetch(`/api/story-arc/by-project/${encodeURIComponent(String(pid))}/ensure?name=${encodeURIComponent(projectContext?.projectName || 'Untitled Project')}`, { method: 'POST', credentials: 'include' });
          } catch (ensureError) {
            console.warn('Drive mapping ensure failed:', ensureError);
          }
          try {
            const tsStr = new Date().toISOString().replace(/[:.]/g, '-');
            // Primary file (same name for Drive versions)
            let upPrimaryOk = true;
            if (drivePrimaryEnabled) {
              const primaryBlob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
              const primaryForm = new FormData();
              primaryForm.append('projectId', String(pid));
              primaryForm.append('folderName', drivePrimaryFolderName);
              const primaryName = renderFilename(drivePrimaryFilenameTemplate, { id: String(id), projectId: pid, projectName: projectContext?.projectName, ts: tsStr });
              primaryForm.append('file', primaryBlob, primaryName);
              const upPrimary = await fetch('/api/google/drive/upload-contract', { method: 'POST', credentials: 'include', body: primaryForm });
              upPrimaryOk = upPrimary.ok;
            }
            // Backup file (timestamped)
            let upBackupOk = true;
            if (driveBackupEnabled) {
              const backupBlob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
              const backupForm = new FormData();
              backupForm.append('projectId', String(pid));
              backupForm.append('folderName', driveBackupFolderName);
              const backupName = renderFilename(driveBackupFilenameTemplate, { id: String(id), projectId: pid, projectName: projectContext?.projectName, ts: tsStr });
              backupForm.append('file', backupBlob, backupName);
              const upBackup = await fetch('/api/google/drive/upload-contract', { method: 'POST', credentials: 'include', body: backupForm });
              upBackupOk = upBackup.ok;
            }
            fallbackOk = upPrimaryOk && upBackupOk;
          } catch (driveFallbackError) {
            console.warn('Drive fallback upload failed:', driveFallbackError);
          }
        }
        if (fallbackOk) {
          setSavedVia('drive');
          setLastSavedAt(Date.now());
          setSaveStatus('saved');
        } else {
          const errorMessage = error instanceof Error ? error.message : 'Save failed';
          setSaveStatus('error');
          setSaveError(errorMessage);
        }
      }
      // Opportunistic periodic Drive backup when DB save succeeded
      try {
        const now = Date.now();
        if (!savedOk) return;
        if (projectContext?.projectId && driveUploadsEnabled) {
          const pid = String(projectContext.projectId);
          const tsStr = new Date().toISOString().replace(/[:.]/g, '-');
          // Primary upload (same filename) based on primary interval
          if (drivePrimaryEnabled && now - lastPrimaryUploadRef.current > drivePrimaryIntervalMs) {
            const primaryBlob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
            const primaryForm = new FormData();
            primaryForm.append('projectId', pid);
            primaryForm.append('folderName', drivePrimaryFolderName);
            const primaryName = renderFilename(drivePrimaryFilenameTemplate, { id: String(id), projectId: pid, projectName: projectContext?.projectName, ts: tsStr });
            primaryForm.append('file', primaryBlob, primaryName);
            await fetch('/api/google/drive/upload-contract', { method: 'POST', credentials: 'include', body: primaryForm });
            lastPrimaryUploadRef.current = now;
          }
          // Backup upload (timestamped new file) based on backup interval
          if (driveBackupEnabled && now - lastBackupUploadRef.current > driveBackupIntervalMs) {
            const backupBlob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
            const backupForm = new FormData();
            backupForm.append('projectId', pid);
            backupForm.append('folderName', driveBackupFolderName);
            const backupName = renderFilename(driveBackupFilenameTemplate, { id: String(id), projectId: pid, projectName: projectContext?.projectName, ts: tsStr });
            backupForm.append('file', backupBlob, backupName);
            await fetch('/api/google/drive/upload-contract', { method: 'POST', credentials: 'include', body: backupForm });
            lastBackupUploadRef.current = now;
          }
        }
      } catch (backupUploadError) {
        console.warn('Periodic Drive backup upload failed:', backupUploadError);
      }
    }, 800);
    return () => clearTimeout(t);
  }, [buildEditorState, storyArcId, storyArc?.id, projectContext]);

  // Load initial data when component mounts or storyArcId changes
  useEffect(() => {
    loadStoryArcData();
  }, [storyArcId]);

  const addMediaToTimeline = useCallback(
    (detail: StoryArcAddMediaDetail) => {
      if (!detail?.media) return;
      const isAudio =
        detail.media.type === 'audio' ||
        (detail.media.mimeType || '').startsWith('audio/');

      // If audio file, show enhancement dialog first
      if (isAudio && detail.media.file) {
        setPendingAudioFile(detail.media.file);
        setShowAudioEnhancementDialog(true);
        window.__pendingAudioDetail = detail;
        return;
      }

      const mediaSource = detail.media.url?.trim();
      if (!isAudio && mediaSource) {
        if (detail.media.file instanceof File) {
          setSourceFileRegistry((previous) => ({
            ...previous,
            [mediaSource]: detail.media.file as File,
          }));
        }
        setAvailableVideoSources((prev) => {
          if (prev.includes(mediaSource)) {
            return prev;
          }
          return [...prev, mediaSource];
        });
        setActiveSourcePreview({
          id: detail.media.id || `asset-${Date.now()}`,
          name: detail.media.name || 'Selected Source',
          sourceFile: mediaSource,
          file: detail.media.file,
        });
      }
      onFileUpload?.({
        id: detail.media.id,
        name: detail.media.name,
        type: detail.media.type,
        source: detail.media.url,
      });

      const targetTrackId = detail.track || (isAudio ? 'audio-1' : 'video-1');
      const clipDuration = Number(detail.media.duration || 5);
      setTracks((prev) => {
        if (!prev.find((track) => track.id === targetTrackId)) {
          const newTrack: Track = {
            id: targetTrackId,
            name: targetTrackId,
            type: isAudio ? 'audio' : 'video',
            height: isAudio ? 40 : 56,
          };
          return [...prev, newTrack];
        }
        return prev;
      });
      setClips((prev) => {
        let start = 0;
        if (Number.isFinite(detail.startTime)) {
          start = timelineEngine.snapToFrame(Math.max(0, Number(detail.startTime)));
        } else if (detail.position === 'playhead') {
          start = timelineEngine.snapToFrame(currentTime);
        } else {
          const trackClips = prev.filter((clip) => clip.trackId === targetTrackId);
          const end =
            trackClips.length > 0
              ? Math.max(...trackClips.map((clip) => clip.start + clip.duration))
              : 0;
          start = timelineEngine.snapToFrame(end);
        }
        const id = `clip_${Date.now()}`;
        const newClip = {
          id,
          name: detail.media.name || 'Asset',
          beatName: detail.media.name || 'Asset',
          start,
          duration: clipDuration,
          ev: 0, // Neutral emotional value
          synopsis: detail.media.name || 'Asset',
          trackId: targetTrackId,
          color: isAudio ? '#4caf50' : '#2196f3',
          sourceFile: detail.media.url,
          metadata: {
            camera: detail.media.camera,
            syncGroup: detail.media.syncGroup,
            originalSource: detail.media.url || detail.media.name,
          },
          tags: detail.media.tags || [],
        } as BeatClip;
        const next = [...prev, newClip];
        const maxEnd = Math.max(
          ...next.map((clip) => clip.start + clip.duration),
          storyArc?.totalDuration || 0
        );
        setTotalDuration(maxEnd);

        if (detail.media.camera || detail.media.syncGroup || detail.media.tags) {
          setClipMeta((previous) => ({
            ...previous,
            [id]: {
              camera: detail.media.camera,
              syncGroup: detail.media.syncGroup,
              tags: detail.media.tags || [],
            },
          }));
        }

        return next;
      });
    },
    [currentTime, onFileUpload, storyArc?.totalDuration]
  );

  // Listen for asset add-to-timeline events
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<StoryArcAddMediaDetail>).detail;
      addMediaToTimeline(detail);
    };
    window.addEventListener('storyarc:add-media', handler);
    return () => window.removeEventListener('storyarc:add-media', handler);
  }, [addMediaToTimeline]);

  useEffect(() => {
    const sourcesInTimeline = extractRenderableVideoSources(clips);
    if (sourcesInTimeline.length === 0) {
      return;
    }

    setAvailableVideoSources((prev) => {
      const merged = new Set(prev);
      let changed = false;
      sourcesInTimeline.forEach((source) => {
        if (!merged.has(source)) {
          merged.add(source);
          changed = true;
        }
      });
      return changed ? Array.from(merged) : prev;
    });
  }, [clips, extractRenderableVideoSources]);

  useEffect(() => {
    if (availableVideoSources.length === 0) {
      return;
    }

    setClips((prev) => {
      const hydrated = hydrateClipSources(prev);
      const changed = hydrated.some((clip, index) => clip !== prev[index]);
      return changed ? hydrated : prev;
    });
  }, [availableVideoSources, hydrateClipSources]);

  useEffect(() => {
    if (activeSourcePreview || availableVideoSources.length === 0) {
      return;
    }

    const fallbackSource = availableVideoSources[0];
    if (!fallbackSource) {
      return;
    }

    setActiveSourcePreview({
      id: fallbackSource,
      name: 'Media Pool Source',
      sourceFile: fallbackSource,
      file: sourceFileRegistry[fallbackSource],
    });
  }, [activeSourcePreview, availableVideoSources, sourceFileRegistry]);

  useEffect(() => {
    setClipMap(new Map(clips.map((clip) => [clip.id, clip])));
  }, [clips]);

  const cloneClipList = useCallback((clipList: BeatClip[]): BeatClip[] => {
    return clipList.map((clip) => ({
      ...clip,
      tags: clip.tags ? [...clip.tags] : undefined,
      metadata: clip.metadata ? { ...clip.metadata } : undefined,
    }));
  }, []);

  useEffect(() => {
    const derivedCulture = projectContext?.weddingCulture || '';
    const derivedProjectType = projectContext?.projectType || storyArc?.type || 'wedding';
    setResolveExportSettings((previous) => {
      const nextCulture = derivedCulture || previous.culture;
      const nextProjectType = derivedProjectType || previous.projectType;
      if (previous.culture === nextCulture && previous.projectType === nextProjectType) {
        return previous;
      }
      return {
        ...previous,
        culture: nextCulture,
        projectType: nextProjectType,
      };
    });
  }, [projectContext?.weddingCulture, projectContext?.projectType, storyArc?.type]);

  useEffect(() => {
    if (!timelineHistoryReadyRef.current) {
      timelineHistoryReadyRef.current = true;
      previousClipsRef.current = cloneClipList(clips);
      return;
    }

    if (skipHistorySnapshotRef.current) {
      skipHistorySnapshotRef.current = false;
      previousClipsRef.current = cloneClipList(clips);
      return;
    }

    setUndoStack((previous) => [...previous, cloneClipList(previousClipsRef.current)].slice(-50));
    setRedoStack([]);
    previousClipsRef.current = cloneClipList(clips);
  }, [clips, cloneClipList]);

  useEffect(() => {
    if (selectedClips.size === 0) {
      return;
    }

    const lockOwner = currentUser?.email || currentUser?.id || 'local-user';
    setCollabLocks((previous) => {
      const next = { ...previous };
      selectedClips.forEach((clipId) => {
        next[clipId] = { user: lockOwner };
      });
      return next;
    });
  }, [selectedClips, currentUser]);

  useEffect(() => {
    const validation = timelineEngine.validateTimeline(clips, tracks);
    setTimelineWarnings(validation.warnings);
    setTimelineErrors(validation.errors);
  }, [clips, tracks]);

  useEffect(() => {
    timelineEngine.setConfig({
      frameRate: 25,
      duration: totalDuration,
    });
    frameTimer.setFrameRate(25);
  }, [totalDuration]);

  useEffect(() => {
    if (isPlaying) {
      frameTimer.start(timelineEngine.secondsToFrames(currentTime));
    } else {
      frameTimer.pause();
    }

    return () => {
      frameTimer.stop();
    };
  }, [isPlaying, currentTime]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const audioClip = clips.find((clip) => {
      if (!clip?.sourceFile || clip.sourceFile.trim().length === 0) {
        return false;
      }
      if (!isUsableMediaSource(clip.sourceFile)) {
        return false;
      }
      const trackId = (clip.trackId || '').toLowerCase();
      const hasAudioTrackId = trackId.startsWith('audio');
      const hasAudioTrackType = trackStates[clip.trackId]?.type === 'audio';
      return hasAudioTrackId || hasAudioTrackType;
    });
    const activeWaveformUrl = audioClip?.sourceFile?.trim() || '';
    if (!activeWaveformUrl) {
      return;
    }

    const audioElement = document.createElement('audio');
    audioElement.src = activeWaveformUrl;
    audioElement.crossOrigin = 'anonymous';

    try {
      audioAnalysisEngine.connectSource(audioElement);
      audioAnalysisEngine.start();
      const meterInterval = window.setInterval(() => {
        setAudioMeterLevel(audioAnalysisEngine.getRMS());
      }, 120);
      return () => {
        window.clearInterval(meterInterval);
        audioAnalysisEngine.stop();
      };
    } catch (error) {
      console.warn('Audio meter unavailable:', error);
      return;
    }
  }, [clips, trackStates, isUsableMediaSource]);

  useEffect(() => {
    return () => {
      hlsServiceRef.current?.destroy();
      frameTimer.dispose();
      webWorkerEngine.terminateAll();
      audioAnalysisEngine.dispose();
      textOverlayEngine.dispose();
      pixiFilterEngine.dispose();
    };
  }, []);

  // Initialize Google Drive monitor folder on studio open
  const initStudio = useCallback(async () => {
    try {
      setDriveInit({ status: 'initializing' });
      const sessionRes = await fetch('/api/auth/public-session', { credentials: 'include' });
      const sessionUser = await sessionRes.json();
      setCurrentUser(sessionUser);

      if (!sessionUser?.id || sessionUser.isAuthenticated === false) {
        setDriveInit({ status: 'needs_auth', message: 'Sign in to initialize your Google Drive workspace.' });
        return;
      }

      const res = await fetch('/api/story-arc/init', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId: sessionUser.id, folderName: 'studio_arc_create' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        const errMsg = json?.error || `Init failed (${res.status})`;
        if (/token|google|oauth|refresh/i.test(errMsg)) {
          setDriveInit({ status: 'needs_google_connect', message: 'Connect your Google Drive to continue.' });
        } else if (res.status === 401) {
          setDriveInit({ status: 'needs_auth', message: 'Please sign in to continue.' });
        } else {
          setDriveInit({ status: 'error', message: errMsg });
        }
        return;
      }

      const link = json.folderId ? `https://drive.google.com/drive/folders/${json.folderId}` : null;
      if (link) setMonitorFolderLink(link);
      setDriveInit({ status: 'ready', folderId: json.folderId });
    } catch (e: any) {
      setDriveInit({ status: 'error', message: e?.message || 'Initialization failed' });
    }
  }, [storyArcId]);

  useEffect(() => { initStudio(); }, [initStudio]);

  // Fetch recent projects when onboarding opens
  useEffect(() => {
    if (onboardingOpen && onboardingStep === 0) {
      fetchRecentProjects();
    }
  }, [onboardingOpen, onboardingStep, fetchRecentProjects]);

  // Check for first-time user and auto-open onboarding
  useEffect(() => {
    const checkFirstTime = async () => {
      try {
        // Check localStorage first (quick check)
        const onboardingCompleted = localStorage.getItem('storyArcStudio_onboardingCompleted');
        if (onboardingCompleted === 'true') {
          return; // Already completed
        }

        // Check database for onboarding completion
        try {
          const res = await fetch('/api/story-arc/onboarding/status', { credentials: 'include' });
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.completed === true) {
              localStorage.setItem('storyArcStudio_onboardingCompleted','true');
              return; // Already completed
            }
          }
        } catch (statusError) {
          console.warn('Onboarding status check failed, using local fallback:', statusError);
        }

        // First-time user - show onboarding after a short delay
        setTimeout(() => {
          setOnboardingOpen(true);
          // Fetch recent projects when onboarding opens
          fetchRecentProjects();
        }, 1000);
      } catch (error) {
        console.warn('Error checking onboarding status:', error);
      }
    };

    checkFirstTime();
  }, [fetchRecentProjects]);

  // Panel resizing handlers - FIXED: Memory leak prevention
  const handleMouseMove = useCallback((e: MouseEvent) => {
    setIsDragging(currentDrag => {
      if (!currentDrag || !containerRef.current) return currentDrag;

      const containerRect = containerRef.current.getBoundingClientRect();

      if (currentDrag === 'left') {
        const newWidth = Math.max(MIN_PANEL_SIZE, Math.min(MAX_PANEL_SIZE, e.clientX - containerRect.left));
        setPanelSizes(prev => ({ ...prev, leftPanel: newWidth }));
      } else if (currentDrag === 'right') {
        const newWidth = Math.max(MIN_PANEL_SIZE, Math.min(MAX_PANEL_SIZE, containerRect.right - e.clientX));
        setPanelSizes(prev => ({ ...prev, rightPanel: newWidth }));
      }
      
      return currentDrag;
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsDragging(null);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  const handleMouseDown = useCallback((panel: 'left' | 'right') => (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(panel);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove, handleMouseUp]);

  // Transport controls
  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleStop = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    setPlaybackSpeed(1);
  };

  // Frame-by-frame navigation
  const frameRate = 25; // 25fps for PAL
  const frameTime = 1 / frameRate;

  const stepBackward = () => {
    setCurrentTime(prev => Math.max(0, prev - frameTime));
    setIsPlaying(false);
  };

  const stepForward = () => {
    setCurrentTime(prev => Math.min(totalDuration, prev + frameTime));
    setIsPlaying(false);
  };

  const stepSourceBackward = useCallback(() => {
    const videoElement = sourcePreviewVideoRef.current;
    if (!videoElement) {
      return;
    }
    const nextTime = Math.max(0, videoElement.currentTime - frameTime);
    videoElement.currentTime = nextTime;
    setSourcePreviewTime(nextTime);
    setSourcePreviewIsPlaying(false);
    videoElement.pause();
  }, [frameTime]);

  const stepSourceForward = useCallback(() => {
    const videoElement = sourcePreviewVideoRef.current;
    if (!videoElement) {
      return;
    }
    const maxDuration = Number.isFinite(videoElement.duration) && videoElement.duration > 0
      ? videoElement.duration
      : Number.POSITIVE_INFINITY;
    const nextTime = Math.max(0, Math.min(maxDuration, videoElement.currentTime + frameTime));
    videoElement.currentTime = nextTime;
    setSourcePreviewTime(nextTime);
    setSourcePreviewIsPlaying(false);
    videoElement.pause();
  }, [frameTime]);

  const handleSourcePlayPause = useCallback(() => {
    const videoElement = sourcePreviewVideoRef.current;
    if (!videoElement || !videoElement.src) {
      return;
    }

    if (!sourcePreviewIsPlaying) {
      const playResult = videoElement.play();
      if (playResult && typeof playResult.catch === 'function') {
        void playResult.catch((error) => {
          console.warn('Source playback blocked:', error);
          setSourcePreviewIsPlaying(false);
        });
      }
      setSourcePreviewIsPlaying(true);
      return;
    }

    videoElement.pause();
    setSourcePreviewIsPlaying(false);
  }, [sourcePreviewIsPlaying]);

  const pauseSourcePlayback = useCallback(
    (resetToStart = false) => {
      const videoElement = sourcePreviewVideoRef.current;
      if (!videoElement) {
        return;
      }

      videoElement.pause();
      if (resetToStart) {
        try {
          videoElement.currentTime = 0;
        } catch {
          // Ignore seek errors until media is seekable.
        }
        setSourcePreviewTime(0);
      }
      setSourcePreviewIsPlaying(false);
    },
    []
  );

  const seekSourcePlayback = useCallback((time: number) => {
    const videoElement = sourcePreviewVideoRef.current;
    if (!videoElement) {
      return;
    }

    const maxDuration =
      Number.isFinite(videoElement.duration) && videoElement.duration > 0
        ? videoElement.duration
        : Number.POSITIVE_INFINITY;
    const nextTime = Math.max(0, Math.min(maxDuration, time));
    try {
      videoElement.currentTime = nextTime;
    } catch {
      // Ignore seek errors until media is seekable.
    }
    videoElement.pause();
    setSourcePreviewTime(nextTime);
    setSourcePreviewIsPlaying(false);
  }, []);

  const getPrimaryVideoTrackId = useCallback((): string => {
    const selectedTrack = Array.from(selectedClips)
      .map((clipId) => clips.find((clip) => clip.id === clipId)?.trackId)
      .find((trackId): trackId is string => Boolean(trackId) && !trackId.toLowerCase().startsWith('audio'));
    if (selectedTrack) {
      return selectedTrack;
    }

    const videoTrack = tracks.find((track) => track.type === 'video');
    return videoTrack?.id || 'video-1';
  }, [selectedClips, clips, tracks]);

  const applyClipUpdates = useCallback(
    (nextClips: BeatClip[], keepSelection?: Set<string>) => {
      const snapped = nextClips.map((clip) => ({
        ...clip,
        start: timelineEngine.snapToFrame(Math.max(0, clip.start)),
        duration: Math.max(frameTime, timelineEngine.snapToFrame(clip.duration)),
      }));
      setClips(snapped);
      setTotalDuration(timelineEngine.calculateDuration(snapped));
      if (keepSelection) {
        setSelectedClips(keepSelection);
      }
      const validation = timelineEngine.validateTimeline(snapped, tracks);
      setTimelineWarnings(validation.warnings);
      setTimelineErrors(validation.errors);
    },
    [frameTime, tracks]
  );

  const performUndo = useCallback(() => {
    setUndoStack((previousUndo) => {
      if (previousUndo.length === 0) {
        return previousUndo;
      }

      const snapshot = previousUndo[previousUndo.length - 1];
      skipHistorySnapshotRef.current = true;
      setRedoStack((previousRedo) => [cloneClipList(clips), ...previousRedo].slice(0, 50));
      setClips(cloneClipList(snapshot));
      setTotalDuration(timelineEngine.calculateDuration(snapshot));
      previousClipsRef.current = cloneClipList(snapshot);
      return previousUndo.slice(0, -1);
    });
  }, [clips, cloneClipList]);

  const performRedo = useCallback(() => {
    setRedoStack((previousRedo) => {
      if (previousRedo.length === 0) {
        return previousRedo;
      }

      const [snapshot, ...remaining] = previousRedo;
      skipHistorySnapshotRef.current = true;
      setUndoStack((previousUndo) => [...previousUndo, cloneClipList(clips)].slice(-50));
      setClips(cloneClipList(snapshot));
      setTotalDuration(timelineEngine.calculateDuration(snapshot));
      previousClipsRef.current = cloneClipList(snapshot);
      return remaining;
    });
  }, [clips, cloneClipList]);

  const copySelectedClips = useCallback(() => {
    const selected = Array.from(selectedClips)
      .map((clipId) => clips.find((clip) => clip.id === clipId))
      .filter((clip): clip is BeatClip => Boolean(clip));

    if (selected.length === 0) {
      return;
    }

    const minStart = Math.min(...selected.map((clip) => clip.start));
    setClipClipboard(
      selected.map((clip) => ({
        clip: {
          ...clip,
          tags: clip.tags ? [...clip.tags] : undefined,
          metadata: clip.metadata ? { ...clip.metadata } : undefined,
        },
        relativeStart: clip.start - minStart,
      }))
    );
    setSnackbar({
      open: true,
      message: `Copied ${selected.length} clip${selected.length > 1 ? 's' : ''}`,
      severity: 'success',
    });
  }, [clips, selectedClips]);

  const pasteClipboardClips = useCallback(() => {
    if (clipClipboard.length === 0) {
      return;
    }

    const pastedIds = new Set<string>();
    const now = Date.now();
    const nextClips = [...clips];
    clipClipboard.forEach((item, index) => {
      const id = `${item.clip.id}_paste_${now}_${index}`;
      pastedIds.add(id);
      nextClips.push({
        ...item.clip,
        id,
        start: timelineEngine.snapToFrame(currentTime + item.relativeStart),
      });
    });

    applyClipUpdates(nextClips, pastedIds);
  }, [clipClipboard, clips, currentTime, applyClipUpdates]);

  const cutSelectedClips = useCallback(() => {
    if (selectedClips.size === 0) {
      return;
    }
    copySelectedClips();
    const idsToDelete = new Set(selectedClips);
    const remaining = clips.filter((clip) => !idsToDelete.has(clip.id));
    applyClipUpdates(remaining, new Set());
  }, [selectedClips, clips, copySelectedClips, applyClipUpdates]);

  const resolveSourceEditRange = useCallback(
    (sourceClip: BeatClip | null): { inPoint: number; outPoint: number; duration: number } | null => {
      if (!sourceClip?.sourceFile) {
        return null;
      }

      const clipIn = typeof sourceClip.metadata?.inPoint === 'number' ? sourceClip.metadata.inPoint : 0;
      const clipOut =
        typeof sourceClip.metadata?.outPoint === 'number' ? sourceClip.metadata.outPoint : clipIn + sourceClip.duration;

      const rawIn = sourceMarkIn ?? clipIn;
      const rawOut = sourceMarkOut ?? clipOut;
      const inPoint = Math.min(rawIn, rawOut);
      const outPoint = Math.max(rawIn, rawOut);
      const duration = Math.max(frameTime, timelineEngine.snapToFrame(outPoint - inPoint));
      return { inPoint, outPoint, duration };
    },
    [frameTime, sourceMarkIn, sourceMarkOut]
  );

  const resolveProgramEditWindow = useCallback(
    (
      mode: 'insert' | 'overwrite',
      sourceDuration: number
    ): { start: number; end: number; duration: number; usingProgramRange: boolean } => {
      if (
        mode === 'overwrite' &&
        typeof programMarkIn === 'number' &&
        typeof programMarkOut === 'number' &&
        Math.abs(programMarkOut - programMarkIn) >= frameTime
      ) {
        const start = timelineEngine.snapToFrame(Math.min(programMarkIn, programMarkOut));
        const end = timelineEngine.snapToFrame(Math.max(programMarkIn, programMarkOut));
        const duration = Math.max(frameTime, timelineEngine.snapToFrame(end - start));
        return { start, end: start + duration, duration, usingProgramRange: true };
      }

      const anchor = typeof programMarkIn === 'number' ? programMarkIn : currentTime;
      const start = timelineEngine.snapToFrame(Math.max(0, anchor));
      const duration = Math.max(frameTime, timelineEngine.snapToFrame(sourceDuration));
      return { start, end: timelineEngine.snapToFrame(start + duration), duration, usingProgramRange: false };
    },
    [programMarkIn, programMarkOut, frameTime, currentTime]
  );

  const insertOrOverwriteFromSource = useCallback(
    (mode: 'insert' | 'overwrite', sourceClip: BeatClip | null) => {
      if (!sourceClip?.sourceFile) {
        return;
      }

      const range = resolveSourceEditRange(sourceClip);
      if (!range) {
        return;
      }

      const trackId = getPrimaryVideoTrackId();
      const programWindow = resolveProgramEditWindow(mode, range.duration);
      const sourceWindowDuration = Math.max(frameTime, timelineEngine.snapToFrame(range.outPoint - range.inPoint));
      const effectiveDuration = Math.max(
        frameTime,
        timelineEngine.snapToFrame(Math.min(programWindow.duration, sourceWindowDuration))
      );
      const insertionStart = programWindow.start;
      const insertionEnd = timelineEngine.snapToFrame(insertionStart + effectiveDuration);

      const generatedClipId = `insert_${Date.now()}`;
      const generatedClip: BeatClip = {
        ...sourceClip,
        id: generatedClipId,
        name: sourceClip.name || 'Inserted Clip',
        beatName: sourceClip.beatName || sourceClip.name || 'Inserted Clip',
        trackId,
        start: insertionStart,
        duration: effectiveDuration,
        metadata: {
          ...(sourceClip.metadata || {}),
          inPoint: range.inPoint,
          outPoint: range.inPoint + effectiveDuration,
          sourceStartTime: range.inPoint,
          insertedFromSource: true,
          editMode: mode,
          usedProgramRange: programWindow.usingProgramRange,
        },
      };

      const unaffectedTracks = clips.filter((clip) => clip.trackId !== trackId);
      const targetTrackClips = clips
        .filter((clip) => clip.trackId === trackId)
        .sort((a, b) => a.start - b.start);

      const editedTrackClips: BeatClip[] = [];

      if (mode === 'insert') {
        targetTrackClips.forEach((clip) => {
          if (clip.start >= insertionStart) {
            editedTrackClips.push({
              ...clip,
              start: timelineEngine.snapToFrame(clip.start + effectiveDuration),
            });
            return;
          }
          editedTrackClips.push(clip);
        });
      } else {
        targetTrackClips.forEach((clip) => {
          const clipStart = clip.start;
          const clipEnd = clip.start + clip.duration;
          const overlaps = clipStart < insertionEnd && clipEnd > insertionStart;
          if (!overlaps) {
            editedTrackClips.push(clip);
            return;
          }

          if (clipStart < insertionStart) {
            editedTrackClips.push({
              ...clip,
              duration: timelineEngine.snapToFrame(insertionStart - clipStart),
              metadata: {
                ...(clip.metadata || {}),
                outPoint:
                  (typeof clip.metadata?.inPoint === 'number' ? clip.metadata.inPoint : 0) +
                  timelineEngine.snapToFrame(insertionStart - clipStart),
              },
            });
          }

          if (clipEnd > insertionEnd) {
            const rightDuration = timelineEngine.snapToFrame(clipEnd - insertionEnd);
            editedTrackClips.push({
              ...clip,
              id: `${clip.id}_owr_${Date.now()}`,
              start: insertionEnd,
              duration: rightDuration,
              metadata: {
                ...(clip.metadata || {}),
                inPoint:
                  (typeof clip.metadata?.inPoint === 'number' ? clip.metadata.inPoint : 0) +
                  (insertionEnd - clipStart),
              },
            });
          }
        });
      }

      const updatedClips = [...unaffectedTracks, ...editedTrackClips, generatedClip];
      applyClipUpdates(updatedClips, new Set([generatedClipId]));
      setActiveSourcePreview({
        id: generatedClip.id,
        name: generatedClip.name,
        sourceFile: generatedClip.sourceFile || '',
      });
      setCurrentTime(insertionStart);
      const sourceTrimmedByProgramRange = programWindow.duration > sourceWindowDuration + frameTime / 2;
      setSnackbar({
        open: true,
        message:
          mode === 'insert'
            ? 'Inserted source clip into timeline'
            : sourceTrimmedByProgramRange
              ? 'Overwrote timeline with source clip (source range shorter than Program In/Out)'
              : 'Overwrote timeline with source clip',
        severity: 'success',
      });
    },
    [
      resolveSourceEditRange,
      resolveProgramEditWindow,
      getPrimaryVideoTrackId,
      clips,
      applyClipUpdates,
      frameTime,
    ]
  );

  // Professional J/K/L controls
  const handleJKLControl = (key: string) => {
    switch (key) {
      case 'j': // Reverse play
        if (isPlaying && playbackDirection === 'reverse') {
          setPlaybackSpeed(prev => Math.min(8, prev * 2)); // Max 8x reverse
        } else {
          setIsPlaying(true);
          setPlaybackDirection('reverse');
          setPlaybackSpeed(1);
        }
        break;
      case 'k': // Pause/Stop
        setIsPlaying(false);
        setPlaybackSpeed(1);
        break;
      case 'l': // Forward play
        if (isPlaying && playbackDirection === 'forward') {
          setPlaybackSpeed(prev => Math.min(8, prev * 2)); // Max 8x forward
        } else {
          setIsPlaying(true);
          setPlaybackDirection('forward');
          setPlaybackSpeed(1);
        }
        break;
    }
  };

  // Timeline scrubbing
  const handleTimelineClick = (time: number) => {
    setCurrentTime(Math.max(0, Math.min(totalDuration, time)));
  };

  const handleCurrentTimeChange = (time: number) => {
    setCurrentTime(time);
  };

  const isRenderableVideoClip = useCallback(
    (clip: BeatClip | null | undefined) => {
      if (!clip?.sourceFile || clip.sourceFile.trim().length === 0) {
        return false;
      }
      if (!isUsableMediaSource(clip.sourceFile)) {
        return false;
      }

      const trackId = (clip.trackId || '').toLowerCase();
      const hasAudioTrackId = trackId.startsWith('audio');
      const hasAudioTrackType = trackStates[clip.trackId]?.type === 'audio';
      return !(hasAudioTrackId || hasAudioTrackType);
    },
    [trackStates, isUsableMediaSource]
  );

  const createSyntheticSourceClip = useCallback(
    (sourceFile: string, label: string, idSeed: string): BeatClip => ({
      id: `source-${idSeed}`,
      name: label,
      beatName: label,
      start: 0,
      duration: Math.max(totalDuration, 1),
      ev: 0,
      synopsis: label,
      trackId: 'video-source',
      sourceFile,
      metadata: { syntheticSource: true },
    }),
    [totalDuration]
  );

  const renderableVideoClips = useMemo(
    () => clips.filter((clip) => isRenderableVideoClip(clip)),
    [clips, isRenderableVideoClip]
  );

  const previewClip = useMemo(() => {
    const activeClip = renderableVideoClips.find(
      (clip) => currentTime >= clip.start && currentTime < clip.start + clip.duration
    );
    if (activeClip) {
      return activeClip;
    }

    const selectedClip = Array.from(selectedClips)
      .map((clipId) => clipMap.get(clipId))
      .find((clip): clip is BeatClip => isRenderableVideoClip(clip));
    if (selectedClip) {
      return selectedClip;
    }

    if (renderableVideoClips.length > 0) {
      return renderableVideoClips[0];
    }

    if (activeSourcePreview?.sourceFile) {
      return createSyntheticSourceClip(
        activeSourcePreview.sourceFile,
        activeSourcePreview.name || 'Selected Source',
        activeSourcePreview.id || activeSourcePreview.sourceFile
      );
    }

    const fallbackSource = availableVideoSources[0];
    if (fallbackSource) {
      return createSyntheticSourceClip(fallbackSource, 'Media Pool Source', fallbackSource);
    }

    return null;
  }, [
    renderableVideoClips,
    currentTime,
    selectedClips,
    clipMap,
    isRenderableVideoClip,
    activeSourcePreview,
    availableVideoSources,
    createSyntheticSourceClip,
  ]);

  const sourcePreviewClip = useMemo(() => {
    if (activeSourcePreview?.sourceFile) {
      return createSyntheticSourceClip(
        activeSourcePreview.sourceFile,
        activeSourcePreview.name || 'Selected Source',
        activeSourcePreview.id || activeSourcePreview.sourceFile
      );
    }

    const selectedClip = Array.from(selectedClips)
      .map((clipId) => clipMap.get(clipId))
      .find((clip): clip is BeatClip => isRenderableVideoClip(clip));
    if (selectedClip) {
      return selectedClip;
    }

    if (previewClip?.sourceFile) {
      return previewClip;
    }

    const fallbackSource = availableVideoSources[0];
    if (fallbackSource) {
      return createSyntheticSourceClip(fallbackSource, 'Media Pool Source', fallbackSource);
    }

    return null;
  }, [
    selectedClips,
    clipMap,
    isRenderableVideoClip,
    activeSourcePreview,
    previewClip,
    availableVideoSources,
    createSyntheticSourceClip,
  ]);

  const captionSourceCandidates = useMemo(() => {
    return [
      activeSourcePreview?.sourceFile,
      sourcePreviewClip?.sourceFile,
      previewClip?.sourceFile,
      ...availableVideoSources,
    ]
      .map((candidate) => (typeof candidate === 'string' ? candidate.trim() : ''))
      .filter(Boolean);
  }, [
    activeSourcePreview?.sourceFile,
    sourcePreviewClip?.sourceFile,
    previewClip?.sourceFile,
    availableVideoSources,
  ]);

  const captionVideoPath = useMemo(() => {
    const directNonBlobCandidate = captionSourceCandidates.find(
      (candidate) => isLikelyDirectMediaSource(candidate) && !candidate.startsWith('blob:')
    );
    if (directNonBlobCandidate) {
      return directNonBlobCandidate;
    }

    const directCandidate = captionSourceCandidates.find((candidate) =>
      isLikelyDirectMediaSource(candidate)
    );
    if (directCandidate) {
      return directCandidate;
    }

    return captionSourceCandidates[0] || '';
  }, [captionSourceCandidates, isLikelyDirectMediaSource]);

  const captionSourceVideoFile = useMemo(() => {
    if (activeSourcePreview?.file instanceof File) {
      return activeSourcePreview.file;
    }

    for (const sourceCandidate of captionSourceCandidates) {
      const candidateFile = sourceFileRegistry[sourceCandidate];
      if (candidateFile instanceof File) {
        return candidateFile;
      }
    }
    return null;
  }, [
    activeSourcePreview?.file,
    captionSourceCandidates,
    sourceFileRegistry,
  ]);

  const captionFallbackVideoFiles = useMemo(() => {
    const uniqueFiles = new Map<string, File>();

    for (const sourceCandidate of captionSourceCandidates) {
      const candidateFile = sourceFileRegistry[sourceCandidate];
      if (!(candidateFile instanceof File)) {
        continue;
      }

      const candidateKey = `${candidateFile.name}:${candidateFile.size}:${candidateFile.lastModified}`;
      if (!uniqueFiles.has(candidateKey)) {
        uniqueFiles.set(candidateKey, candidateFile);
      }
    }

    if (captionSourceVideoFile instanceof File) {
      const primaryKey = `${captionSourceVideoFile.name}:${captionSourceVideoFile.size}:${captionSourceVideoFile.lastModified}`;
      uniqueFiles.delete(primaryKey);
    }

    return Array.from(uniqueFiles.values());
  }, [
    captionSourceCandidates,
    sourceFileRegistry,
    captionSourceVideoFile,
  ]);

  const captionFallbackVideoPaths = useMemo(() => {
    const uniqueCandidates = Array.from(new Set(captionSourceCandidates));
    return uniqueCandidates.filter((candidate) => candidate !== captionVideoPath);
  }, [
    captionSourceCandidates,
    captionVideoPath,
  ]);

  const getClipSyncGroup = useCallback(
    (clip: BeatClip | null | undefined): string => {
      if (!clip) {
        return '';
      }
      const metaSyncGroup = clipMeta[clip.id]?.syncGroup;
      if (typeof metaSyncGroup === 'string' && metaSyncGroup.trim().length > 0) {
        return metaSyncGroup.trim();
      }
      const clipSyncGroup = clip.metadata?.syncGroup;
      if (typeof clipSyncGroup === 'string' && clipSyncGroup.trim().length > 0) {
        return clipSyncGroup.trim();
      }
      return '';
    },
    [clipMeta]
  );

  const getClipCameraLabel = useCallback(
    (clip: BeatClip): string => {
      const metaCamera = clipMeta[clip.id]?.camera;
      if (typeof metaCamera === 'string' && metaCamera.trim().length > 0) {
        return metaCamera.trim();
      }
      const clipCamera = clip.metadata?.camera;
      if (typeof clipCamera === 'string' && clipCamera.trim().length > 0) {
        return clipCamera.trim();
      }
      const trackLabel = (clip.trackId || '').replace(/[-_]/g, ' ').trim();
      if (trackLabel.length > 0) {
        return trackLabel;
      }
      return clip.name || 'Angle';
    },
    [clipMeta]
  );

  const activeMulticamSyncGroup = useMemo(() => {
    const selectedGroup = Array.from(selectedClips)
      .map((clipId) => clipMap.get(clipId))
      .find((clip): clip is BeatClip => isRenderableVideoClip(clip) && getClipSyncGroup(clip).length > 0);
    if (selectedGroup) {
      return getClipSyncGroup(selectedGroup);
    }

    const previewGroup = getClipSyncGroup(previewClip);
    if (previewGroup) {
      return previewGroup;
    }

    const firstAvailableGroup = renderableVideoClips
      .map((clip) => getClipSyncGroup(clip))
      .find((group) => group.length > 0);
    return firstAvailableGroup || '';
  }, [
    selectedClips,
    clipMap,
    isRenderableVideoClip,
    getClipSyncGroup,
    previewClip,
    renderableVideoClips,
  ]);

  const multicamAngleCandidates = useMemo((): MulticamAngleCandidate[] => {
    if (!activeMulticamSyncGroup) {
      return [];
    }

    const grouped = new Map<string, MulticamAngleCandidate>();
    renderableVideoClips
      .filter((clip) => getClipSyncGroup(clip) === activeMulticamSyncGroup)
      .forEach((clip) => {
        const camera = getClipCameraLabel(clip);
        const isLive = currentTime >= clip.start && currentTime < clip.start + clip.duration;
        const existing = grouped.get(camera);
        if (!existing) {
          grouped.set(camera, { camera, clip, isLive });
          return;
        }

        const existingDistance = Math.abs(existing.clip.start - currentTime);
        const candidateDistance = Math.abs(clip.start - currentTime);
        if (candidateDistance < existingDistance || (isLive && !existing.isLive)) {
          grouped.set(camera, { camera, clip, isLive });
        }
      });

    return Array.from(grouped.values()).sort((left, right) => left.camera.localeCompare(right.camera));
  }, [
    activeMulticamSyncGroup,
    renderableVideoClips,
    getClipSyncGroup,
    getClipCameraLabel,
    currentTime,
  ]);

  const applyMulticamAngle = useCallback(
    (candidate: MulticamAngleCandidate) => {
      if (!candidate.clip.sourceFile) {
        return;
      }

      setActiveSourcePreview({
        id: candidate.clip.id,
        name: `${candidate.camera} Source`,
        sourceFile: candidate.clip.sourceFile,
        file: sourceFileRegistry[candidate.clip.sourceFile],
      });

      if (!multicamApplyToTimeline) {
        setSnackbar({
          open: true,
          message: `Loaded ${candidate.camera} into Source Monitor`,
          severity: 'info',
        });
        return;
      }

      const targetClip = previewClip && getClipSyncGroup(previewClip) === activeMulticamSyncGroup
        ? previewClip
        : renderableVideoClips.find(
            (clip) => currentTime >= clip.start && currentTime < clip.start + clip.duration
          ) || null;

      if (!targetClip) {
        setSnackbar({
          open: true,
          message: 'No active program clip at playhead for multicam switch',
          severity: 'warning',
        });
        return;
      }

      const updatedClips = clips.map((clip) => {
        if (clip.id !== targetClip.id) {
          return clip;
        }
        return {
          ...clip,
          sourceFile: candidate.clip.sourceFile,
          metadata: {
            ...(clip.metadata || {}),
            camera: candidate.camera,
            syncGroup: activeMulticamSyncGroup,
            multicamSourceClipId: candidate.clip.id,
            multicamSwitchedAt: new Date().toISOString(),
          },
        };
      });

      applyClipUpdates(updatedClips, new Set([targetClip.id]));
      setSelectedClips(new Set([targetClip.id]));
      setSnackbar({
        open: true,
        message: `Switched Program Monitor to ${candidate.camera}`,
        severity: 'success',
      });
    },
    [
      sourceFileRegistry,
      multicamApplyToTimeline,
      previewClip,
      getClipSyncGroup,
      activeMulticamSyncGroup,
      renderableVideoClips,
      currentTime,
      clips,
      applyClipUpdates,
    ]
  );

  const handleZoomChange = (event: Event, newValue: number | number[]) => {
    setTimelineZoom(newValue as number);
  };

  const buildDefaultLayoutForPreset = useCallback(
    (preset: ResolveWorkspacePreset): ResolveLayoutState => {
      if (preset === 'edit') {
        return {
          workspacePreset: 'edit',
          showAssetPanel: true,
          showInspectorPanel: true,
          showEffectsPanel: false,
          showMixerPanel: false,
          panelSizes: { leftPanel: 280, rightPanel: 300 },
          showProgramMonitor: true,
          monitorFitMode: 'fit',
          editTool: 'select',
          showAutoMonitor: false,
          multicamEnabled: false,
          multicamApplyToTimeline: true,
        };
      }

      if (preset === 'cut') {
        return {
          workspacePreset: 'cut',
          showAssetPanel: true,
          showInspectorPanel: false,
          showEffectsPanel: false,
          showMixerPanel: false,
          panelSizes: { leftPanel: 260, rightPanel: 260 },
          showProgramMonitor: true,
          monitorFitMode: 'fit',
          editTool: 'select',
          showAutoMonitor: false,
          multicamEnabled: false,
          multicamApplyToTimeline: true,
        };
      }

      if (preset === 'color') {
        return {
          workspacePreset: 'color',
          showAssetPanel: false,
          showInspectorPanel: true,
          showEffectsPanel: true,
          showMixerPanel: false,
          panelSizes: { leftPanel: 240, rightPanel: 360 },
          showProgramMonitor: true,
          monitorFitMode: 'fill',
          editTool: 'select',
          showAutoMonitor: false,
          multicamEnabled: false,
          multicamApplyToTimeline: true,
        };
      }

      return {
        workspacePreset: 'fairlight',
        showAssetPanel: true,
        showInspectorPanel: true,
        showEffectsPanel: false,
        showMixerPanel: true,
        panelSizes: { leftPanel: 250, rightPanel: 320 },
        showProgramMonitor: true,
        monitorFitMode: 'fit',
        editTool: 'select',
        showAutoMonitor: false,
        multicamEnabled: false,
        multicamApplyToTimeline: true,
      };
    },
    []
  );

  const buildLayoutStateSnapshot = useCallback((): ResolveLayoutState => {
    return {
      workspacePreset,
      showAssetPanel,
      showInspectorPanel,
      showEffectsPanel,
      showMixerPanel,
      panelSizes: {
        leftPanel: panelSizes.leftPanel,
        rightPanel: panelSizes.rightPanel,
      },
      showProgramMonitor,
      monitorFitMode,
      editTool,
      showAutoMonitor,
      multicamEnabled,
      multicamApplyToTimeline,
    };
  }, [
    workspacePreset,
    showAssetPanel,
    showInspectorPanel,
    showEffectsPanel,
    showMixerPanel,
    panelSizes.leftPanel,
    panelSizes.rightPanel,
    showProgramMonitor,
    monitorFitMode,
    editTool,
    showAutoMonitor,
    multicamEnabled,
    multicamApplyToTimeline,
  ]);

  const applyStoredLayoutState = useCallback((layout: Partial<ResolveLayoutState>) => {
    if (layout.workspacePreset && ['edit', 'cut', 'color', 'fairlight'].includes(layout.workspacePreset)) {
      setWorkspacePreset(layout.workspacePreset);
    }
    if (typeof layout.showAssetPanel === 'boolean') {
      setShowAssetPanel(layout.showAssetPanel);
    }
    if (typeof layout.showInspectorPanel === 'boolean') {
      setShowInspectorPanel(layout.showInspectorPanel);
    }
    if (typeof layout.showEffectsPanel === 'boolean') {
      setShowEffectsPanel(layout.showEffectsPanel);
    }
    if (typeof layout.showMixerPanel === 'boolean') {
      setShowMixerPanel(layout.showMixerPanel);
    }
    if (layout.panelSizes) {
      const nextLeft =
        typeof layout.panelSizes.leftPanel === 'number'
          ? Math.max(MIN_PANEL_SIZE, Math.min(MAX_PANEL_SIZE, layout.panelSizes.leftPanel))
          : INITIAL_PANEL_SIZES.leftPanel;
      const nextRight =
        typeof layout.panelSizes.rightPanel === 'number'
          ? Math.max(MIN_PANEL_SIZE, Math.min(MAX_PANEL_SIZE, layout.panelSizes.rightPanel))
          : INITIAL_PANEL_SIZES.rightPanel;
      setPanelSizes({ leftPanel: nextLeft, rightPanel: nextRight });
    }
    if (typeof layout.showProgramMonitor === 'boolean') {
      setShowProgramMonitor(layout.showProgramMonitor);
    }
    if (layout.monitorFitMode && ['fit', 'fill'].includes(layout.monitorFitMode)) {
      setMonitorFitMode(layout.monitorFitMode);
    }
    if (layout.editTool && ['select', 'trim', 'roll', 'slip', 'slide'].includes(layout.editTool)) {
      setEditTool(layout.editTool);
    }
    if (typeof layout.showAutoMonitor === 'boolean') {
      setShowAutoMonitor(layout.showAutoMonitor);
    }
    if (typeof layout.multicamEnabled === 'boolean') {
      setMulticamEnabled(layout.multicamEnabled);
    }
    if (typeof layout.multicamApplyToTimeline === 'boolean') {
      setMulticamApplyToTimeline(layout.multicamApplyToTimeline);
    }
  }, []);

  const applyWorkspacePreset = useCallback(
    (preset: ResolveWorkspacePreset) => {
      const savedProfile = workspaceProfiles[preset];
      if (savedProfile) {
        applyStoredLayoutState({
          ...savedProfile,
          workspacePreset: preset,
        });
      } else {
        applyStoredLayoutState(buildDefaultLayoutForPreset(preset));
      }
      setWorkspacePreset(preset);
      setActiveMonitor('program');
    },
    [workspaceProfiles, applyStoredLayoutState, buildDefaultLayoutForPreset]
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      setWorkspaceProfilesReady(true);
      setLayoutStateReady(true);
      return;
    }

    try {
      const layoutPayload = window.localStorage.getItem(RESOLVE_LAYOUT_STORAGE_KEY);
      if (layoutPayload) {
        const parsedLayout = JSON.parse(layoutPayload) as Partial<ResolveLayoutState>;
        applyStoredLayoutState(parsedLayout);
      }
    } catch (error) {
      console.warn('Could not restore Resolve layout state:', error);
    }

    try {
      const dockSlotsPayload = window.localStorage.getItem(RESOLVE_DOCK_SLOTS_STORAGE_KEY);
      if (dockSlotsPayload) {
        const parsedSlots = JSON.parse(dockSlotsPayload) as Partial<
          Record<ResolveDockSlotId, ResolveLayoutState | null>
        >;
        setSavedDockSlots({
          'dock-1': parsedSlots['dock-1'] || null,
          'dock-2': parsedSlots['dock-2'] || null,
          'dock-3': parsedSlots['dock-3'] || null,
        });
      }
    } catch (error) {
      console.warn('Could not restore Resolve dock slots:', error);
    }

    try {
      const workspaceProfilesPayload = window.localStorage.getItem(RESOLVE_WORKSPACE_PROFILES_STORAGE_KEY);
      if (workspaceProfilesPayload) {
        const parsedProfiles = JSON.parse(workspaceProfilesPayload) as Partial<
          Record<ResolveWorkspacePreset, ResolveLayoutState | null>
        >;
        const restoredProfiles = createEmptyWorkspaceProfiles();
        (['edit', 'cut', 'color', 'fairlight'] as const).forEach((preset) => {
          const candidate = parsedProfiles[preset];
          if (candidate && typeof candidate === 'object') {
            restoredProfiles[preset] = candidate;
          }
        });
        setWorkspaceProfiles(restoredProfiles);
      }
    } catch (error) {
      console.warn('Could not restore Resolve workspace profiles:', error);
    }

    setWorkspaceProfilesReady(true);
    setLayoutStateReady(true);
  }, [applyStoredLayoutState]);

  useEffect(() => {
    if (!layoutStateReady || typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(
        RESOLVE_LAYOUT_STORAGE_KEY,
        JSON.stringify(buildLayoutStateSnapshot())
      );
    } catch (error) {
      console.warn('Could not persist Resolve layout state:', error);
    }
  }, [layoutStateReady, buildLayoutStateSnapshot]);

  useEffect(() => {
    if (!layoutStateReady || !workspaceProfilesReady) {
      return;
    }

    const snapshot = buildLayoutStateSnapshot();
    setWorkspaceProfiles((previous) => {
      if (areResolveLayoutsEquivalent(previous[workspacePreset], snapshot)) {
        return previous;
      }

      return {
        ...previous,
        [workspacePreset]: snapshot,
      };
    });
  }, [layoutStateReady, workspaceProfilesReady, workspacePreset, buildLayoutStateSnapshot]);

  useEffect(() => {
    if (!layoutStateReady || !workspaceProfilesReady || typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(
        RESOLVE_WORKSPACE_PROFILES_STORAGE_KEY,
        JSON.stringify(workspaceProfiles)
      );
    } catch (error) {
      console.warn('Could not persist Resolve workspace profiles:', error);
    }
  }, [layoutStateReady, workspaceProfilesReady, workspaceProfiles]);

  useEffect(() => {
    if (!layoutStateReady || typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(RESOLVE_DOCK_SLOTS_STORAGE_KEY, JSON.stringify(savedDockSlots));
    } catch (error) {
      console.warn('Could not persist Resolve dock slots:', error);
    }
  }, [layoutStateReady, savedDockSlots]);

  const saveDockSlot = useCallback(
    (slot: ResolveDockSlotId) => {
      const snapshot = buildLayoutStateSnapshot();
      setSavedDockSlots((previous) => ({ ...previous, [slot]: snapshot }));
      setSnackbar({
        open: true,
        message: `Saved current dock layout to ${slot.toUpperCase()}`,
        severity: 'success',
      });
    },
    [buildLayoutStateSnapshot]
  );

  const loadDockSlot = useCallback(
    (slot: ResolveDockSlotId) => {
      const snapshot = savedDockSlots[slot];
      if (!snapshot) {
        setSnackbar({
          open: true,
          message: `${slot.toUpperCase()} is empty. Save a layout first.`,
          severity: 'warning',
        });
        return;
      }

      applyStoredLayoutState(snapshot);
      setSnackbar({
        open: true,
        message: `Loaded dock layout from ${slot.toUpperCase()}`,
        severity: 'success',
      });
    },
    [savedDockSlots, applyStoredLayoutState]
  );

  const resetResolveLayout = useCallback(() => {
    const defaultLayout = buildDefaultLayoutForPreset('edit');
    applyStoredLayoutState(defaultLayout);
    setWorkspacePreset('edit');
    setActiveMonitor('program');
    setWorkspaceProfiles((previous) => ({
      ...previous,
      edit: defaultLayout,
    }));
    setSnackbar({
      open: true,
      message: 'Resolve layout reset to Edit defaults',
      severity: 'success',
    });
  }, [applyStoredLayoutState, buildDefaultLayoutForPreset]);

  const updateCompositionGuide = useCallback(
    (guide: keyof CinematographyGuideSet, enabled: boolean) => {
      setCompositionGuides((previous) => ({
        ...previous,
        [guide]: enabled,
      }));
    },
    []
  );

  const resetCompositionGuides = useCallback(() => {
    setShowCompositionGuides(DEFAULT_COMPOSITION_SETTINGS.enabled);
    setCompositionGuideTarget(DEFAULT_COMPOSITION_SETTINGS.target);
    setCompositionGuides(DEFAULT_COMPOSITION_SETTINGS.guides);
    setCompositionGuideColor(DEFAULT_COMPOSITION_SETTINGS.color);
    setCompositionGuideOpacity(DEFAULT_COMPOSITION_SETTINGS.opacity);
    setCompositionGuideThickness(DEFAULT_COMPOSITION_SETTINGS.thickness);
    setCompositionSpiralOrientation(DEFAULT_COMPOSITION_SETTINGS.spiralOrientation);
    setCompositionAspectMask(DEFAULT_COMPOSITION_SETTINGS.aspectMask);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setCompositionSettingsReady(true);
      return;
    }

    try {
      const stored = window.localStorage.getItem(COMPOSITION_SETTINGS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const normalized = sanitizeCompositionSettings(parsed);
        if (normalized) {
          setShowCompositionGuides(normalized.enabled);
          setCompositionGuideTarget(normalized.target);
          setCompositionGuides(normalized.guides);
          setCompositionGuideColor(normalized.color);
          setCompositionGuideOpacity(normalized.opacity);
          setCompositionGuideThickness(normalized.thickness);
          setCompositionSpiralOrientation(normalized.spiralOrientation);
          setCompositionAspectMask(normalized.aspectMask);
        }
      }
    } catch (error) {
      console.warn('Could not restore composition guide settings:', error);
    } finally {
      setCompositionSettingsReady(true);
    }
  }, []);

  useEffect(() => {
    if (!compositionSettingsReady || typeof window === 'undefined') {
      return;
    }

    const payload: StoryArcCompositionSettings = {
      enabled: showCompositionGuides,
      target: compositionGuideTarget,
      guides: compositionGuides,
      color: compositionGuideColor,
      opacity: compositionGuideOpacity,
      thickness: compositionGuideThickness,
      spiralOrientation: compositionSpiralOrientation,
      aspectMask: compositionAspectMask,
    };

    try {
      window.localStorage.setItem(COMPOSITION_SETTINGS_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.warn('Could not persist composition guide settings:', error);
    }
  }, [
    compositionSettingsReady,
    showCompositionGuides,
    compositionGuideTarget,
    compositionGuides,
    compositionGuideColor,
    compositionGuideOpacity,
    compositionGuideThickness,
    compositionSpiralOrientation,
    compositionAspectMask,
  ]);

  const downloadCaptionFile = useCallback(
    (contents: string, extension: 'srt' | 'vtt') => {
      const baseName = (storyArc?.title || 'story-arc').trim().replace(/\s+/g, '-').toLowerCase();
      const blob = new Blob([contents], { type: 'text/plain;charset=utf-8' });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `${baseName}-captions.${extension}`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(objectUrl);
    },
    [storyArc?.title]
  );

  const handleSelectLUT = useCallback(
    (lutPath: string, lutName: string) => {
      const selectedLUT = LUTEngine.getLUTLibrary()
        .flatMap((category) => category.luts)
        .find((lut) => lut.path === lutPath || lut.name === lutName);
      const resolvedName = selectedLUT?.name || lutName;
      setSelectedLUTName(resolvedName);
      setShowLUTLibraryDialog(false);
      setCurrentColorGrade((previous: Record<string, unknown>) => ({
        ...previous,
        lutPath,
        lutName: resolvedName,
        lutCategory: selectedLUT?.category || 'creative',
        lutCulture: selectedLUT?.culture,
        lutCamera: selectedLUT?.camera,
        appliedAt: new Date().toISOString(),
      }));
      setResolveExportSettings((previous) => ({
        ...previous,
        culture: selectedLUT?.culture || previous.culture,
      }));

      if (selectedClips.size > 0) {
        setClips((previous) =>
          previous.map((clip) =>
            selectedClips.has(clip.id)
              ? {
                  ...clip,
                  metadata: {
                    ...(clip.metadata || {}),
                    lutPath,
                    lutName: resolvedName,
                  },
                }
              : clip
          )
        );
      }

      setSnackbar({
        open: true,
        message: `Applied LUT: ${resolvedName}`,
        severity: 'success',
      });
    },
    [selectedClips]
  );

  const handleImportStream = useCallback(
    (url: string, type: 'youtube' | 'vimeo' | 'hls') => {
      const streamUrl = url.trim();
      if (!streamUrl) {
        return;
      }

      const targetTrackId = getPrimaryVideoTrackId();
      setTracks((previous) => {
        if (previous.some((track) => track.id === targetTrackId)) {
          return previous;
        }
        return [
          ...previous,
          {
            id: targetTrackId,
            name: targetTrackId,
            type: 'video',
            height: 56,
          },
        ];
      });

      const streamClipId = `stream_${Date.now()}`;
      const streamClip: BeatClip = {
        id: streamClipId,
        name: type === 'hls' ? 'HLS Stream' : type === 'youtube' ? 'YouTube Stream' : 'Vimeo Stream',
        beatName: type === 'hls' ? 'HLS Stream' : type === 'youtube' ? 'YouTube Stream' : 'Vimeo Stream',
        start: timelineEngine.snapToFrame(currentTime),
        duration: 30,
        ev: 0,
        synopsis: `Imported ${type.toUpperCase()} stream`,
        trackId: targetTrackId,
        sourceFile: streamUrl,
        color: '#3b82f6',
        metadata: {
          streamType: type,
          isLiveStream: type === 'hls',
          importedAt: new Date().toISOString(),
        },
      };

      applyClipUpdates([...clips, streamClip], new Set([streamClipId]));
      setActiveSourcePreview({
        id: streamClipId,
        name: streamClip.name,
        sourceFile: streamUrl,
      });
      setShowHLSImportDialog(false);

      if (type === 'hls' && sourcePreviewVideoRef.current && HLSStreamingService.isSupported()) {
        if (!hlsServiceRef.current) {
          hlsServiceRef.current = new HLSStreamingService();
        }
        hlsServiceRef.current.loadStream(sourcePreviewVideoRef.current, streamUrl);
      }

      setSnackbar({
        open: true,
        message: `Imported ${type.toUpperCase()} stream into timeline`,
        severity: 'success',
      });
    },
    [clips, currentTime, applyClipUpdates, getPrimaryVideoTrackId]
  );

  const handleSaveNow = useCallback(async () => {
    const id = storyArcId || storyArc?.id;
    if (!id) {
      setSnackbar({
        open: true,
        message: 'No active story arc to save',
        severity: 'warning',
      });
      return;
    }

    try {
      setSaveStatus('saving');
      setSaveError(null);
      const res = await fetch(`/api/story-arc/${id}/editor-state`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ editorState: buildEditorState() }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      setSavedVia('db');
      setLastSavedAt(Date.now());
      setSaveStatus('saved');
      setSnackbar({
        open: true,
        message: 'Project saved',
        severity: 'success',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Save failed';
      setSaveStatus('error');
      setSaveError(errorMessage);
      setSnackbar({
        open: true,
        message: `Save failed: ${errorMessage}`,
        severity: 'error',
      });
    }
  }, [storyArcId, storyArc?.id, buildEditorState]);

  const setSourceMark = useCallback((kind: 'in' | 'out', value: number) => {
    const normalizedValue = Math.max(0, timelineEngine.snapToFrame(value));
    if (kind === 'in') {
      setSourceMarkIn(normalizedValue);
      return;
    }
    setSourceMarkOut(normalizedValue);
  }, []);

  const jumpToSourceMark = useCallback((kind: 'in' | 'out') => {
    const target = kind === 'in' ? sourceMarkIn : sourceMarkOut;
    const videoElement = sourcePreviewVideoRef.current;
    if (!videoElement || typeof target !== 'number') {
      return;
    }

    const maxDuration = Number.isFinite(videoElement.duration) && videoElement.duration > 0
      ? videoElement.duration
      : Number.POSITIVE_INFINITY;
    const nextTime = Math.max(0, Math.min(maxDuration, timelineEngine.snapToFrame(target)));
    try {
      videoElement.currentTime = nextTime;
    } catch {
      // Ignore seek errors until media is seekable.
    }
    videoElement.pause();
    setSourcePreviewIsPlaying(false);
    setSourcePreviewTime(nextTime);
  }, [sourceMarkIn, sourceMarkOut]);

  const setProgramMark = useCallback((kind: 'in' | 'out') => {
    if (kind === 'in') {
      setProgramMarkIn(currentTime);
      return;
    }
    setProgramMarkOut(currentTime);
  }, [currentTime]);

  const jumpToProgramMark = useCallback((kind: 'in' | 'out') => {
    const target = kind === 'in' ? programMarkIn : programMarkOut;
    if (typeof target !== 'number') {
      return;
    }
    setCurrentTime(Math.max(0, Math.min(totalDuration, timelineEngine.snapToFrame(target))));
    setIsPlaying(false);
  }, [programMarkIn, programMarkOut, totalDuration]);

  const moveClipWithEditTool = useCallback(
    (clipList: BeatClip[], clipId: string, newStart: number, newTrackId: string): BeatClip[] => {
      const targetClip = clipList.find((clip) => clip.id === clipId);
      if (!targetClip) {
        return clipList;
      }

      const snappedStart = timelineEngine.snapToFrame(Math.max(0, newStart));
      const delta = timelineEngine.snapToFrame(snappedStart - targetClip.start);
      if (editTool === 'slip') {
        return clipList.map((clip) => {
          if (clip.id !== clipId) {
            return clip;
          }
          const sourceStart =
            typeof clip.metadata?.sourceStartTime === 'number'
              ? clip.metadata.sourceStartTime
              : typeof clip.metadata?.inPoint === 'number'
                ? clip.metadata.inPoint
                : 0;
          const nextSourceStart = Math.max(0, timelineEngine.snapToFrame(sourceStart + delta));
          return {
            ...clip,
            metadata: {
              ...(clip.metadata || {}),
              sourceStartTime: nextSourceStart,
              inPoint: nextSourceStart,
              outPoint: nextSourceStart + clip.duration,
            },
          };
        });
      }

      if (editTool === 'slide') {
        const trackClips = clipList
          .filter((clip) => clip.trackId === targetClip.trackId && clip.id !== targetClip.id)
          .sort((a, b) => a.start - b.start);
        const previous = [...trackClips]
          .reverse()
          .find((clip) => clip.start + clip.duration <= targetClip.start + frameTime);
        const next = trackClips.find(
          (clip) => clip.start >= targetClip.start + targetClip.duration - frameTime
        );

        if (!previous || !next) {
          return clipList.map((clip) =>
            clip.id === clipId
              ? { ...clip, start: snappedStart, trackId: targetClip.trackId }
              : clip
          );
        }

        const maxLeft = Math.max(0, previous.duration - frameTime);
        const maxRight = Math.max(0, next.duration - frameTime);
        const clampedDelta = Math.max(-maxLeft, Math.min(maxRight, delta));
        const movedStart = timelineEngine.snapToFrame(targetClip.start + clampedDelta);
        const previousDuration = Math.max(
          frameTime,
          timelineEngine.snapToFrame(previous.duration + clampedDelta)
        );
        const nextStart = timelineEngine.snapToFrame(next.start + clampedDelta);
        const nextDuration = Math.max(
          frameTime,
          timelineEngine.snapToFrame(next.duration - clampedDelta)
        );

        return clipList.map((clip) => {
          if (clip.id === clipId) {
            return { ...clip, start: movedStart, trackId: targetClip.trackId };
          }
          if (clip.id === previous.id) {
            const clipIn =
              typeof clip.metadata?.inPoint === 'number'
                ? clip.metadata.inPoint
                : typeof clip.metadata?.sourceStartTime === 'number'
                  ? clip.metadata.sourceStartTime
                  : 0;
            return {
              ...clip,
              duration: previousDuration,
              metadata: {
                ...(clip.metadata || {}),
                sourceStartTime: clipIn,
                inPoint: clipIn,
                outPoint: clipIn + previousDuration,
              },
            };
          }
          if (clip.id === next.id) {
            const baseIn =
              typeof clip.metadata?.inPoint === 'number'
                ? clip.metadata.inPoint
                : typeof clip.metadata?.sourceStartTime === 'number'
                  ? clip.metadata.sourceStartTime
                  : 0;
            const nextIn = Math.max(0, timelineEngine.snapToFrame(baseIn + clampedDelta));
            return {
              ...clip,
              start: nextStart,
              duration: nextDuration,
              metadata: {
                ...(clip.metadata || {}),
                sourceStartTime: nextIn,
                inPoint: nextIn,
                outPoint: nextIn + nextDuration,
              },
            };
          }
          return clip;
        });
      }

      return clipList.map((clip) =>
        clip.id === clipId ? { ...clip, start: snappedStart, trackId: newTrackId } : clip
      );
    },
    [editTool, frameTime]
  );

  const resizeClipWithEditTool = useCallback(
    (
      clipList: BeatClip[],
      clipId: string,
      newStart: number,
      newDuration: number,
      mode: 'resize-left' | 'resize-right' = 'resize-right'
    ): BeatClip[] => {
      const target = clipList.find((clip) => clip.id === clipId);
      if (!target) {
        return clipList;
      }

      const snappedStart = timelineEngine.snapToFrame(Math.max(0, newStart));
      const snappedDuration = Math.max(frameTime, timelineEngine.snapToFrame(newDuration));

      if (editTool === 'roll') {
        if (mode === 'resize-left') {
          const previousClip = clipList
            .filter(
              (clip) =>
                clip.trackId === target.trackId &&
                clip.id !== target.id &&
                clip.start + clip.duration <= target.start + frameTime
            )
            .sort((a, b) => b.start - a.start)[0];

          if (!previousClip) {
            return clipList;
          }

          const requestedDelta = timelineEngine.snapToFrame(snappedStart - target.start);
          const maxLeft = Math.max(0, previousClip.duration - frameTime);
          const maxRight = Math.max(0, target.duration - frameTime);
          const delta = Math.max(-maxLeft, Math.min(maxRight, requestedDelta));
          const nextStart = timelineEngine.snapToFrame(target.start + delta);
          const nextDuration = Math.max(frameTime, timelineEngine.snapToFrame(target.duration - delta));
          const previousDuration = Math.max(
            frameTime,
            timelineEngine.snapToFrame(previousClip.duration + delta)
          );

          return clipList.map((clip) => {
            if (clip.id === previousClip.id) {
              const clipIn =
                typeof clip.metadata?.inPoint === 'number'
                  ? clip.metadata.inPoint
                  : typeof clip.metadata?.sourceStartTime === 'number'
                    ? clip.metadata.sourceStartTime
                    : 0;
              return {
                ...clip,
                duration: previousDuration,
                metadata: {
                  ...(clip.metadata || {}),
                  sourceStartTime: clipIn,
                  inPoint: clipIn,
                  outPoint: clipIn + previousDuration,
                },
              };
            }

            if (clip.id === target.id) {
              const baseIn =
                typeof clip.metadata?.inPoint === 'number'
                  ? clip.metadata.inPoint
                  : typeof clip.metadata?.sourceStartTime === 'number'
                    ? clip.metadata.sourceStartTime
                    : 0;
              const nextIn = Math.max(0, timelineEngine.snapToFrame(baseIn + delta));
              return {
                ...clip,
                start: nextStart,
                duration: nextDuration,
                metadata: {
                  ...(clip.metadata || {}),
                  sourceStartTime: nextIn,
                  inPoint: nextIn,
                  outPoint: nextIn + nextDuration,
                },
              };
            }
            return clip;
          });
        }

        const nextClip = clipList
          .filter(
            (clip) =>
              clip.trackId === target.trackId &&
              clip.id !== target.id &&
              clip.start >= target.start + target.duration - frameTime
          )
          .sort((a, b) => a.start - b.start)[0];

        if (!nextClip) {
          return clipList;
        }

        const originalBoundary = timelineEngine.snapToFrame(target.start + target.duration);
        const requestedBoundary = timelineEngine.snapToFrame(snappedStart + snappedDuration);
        const requestedDelta = timelineEngine.snapToFrame(requestedBoundary - originalBoundary);
        const maxLeft = Math.max(0, target.duration - frameTime);
        const maxRight = Math.max(0, nextClip.duration - frameTime);
        const delta = Math.max(-maxLeft, Math.min(maxRight, requestedDelta));
        const nextBoundary = timelineEngine.snapToFrame(originalBoundary + delta);
        const targetDuration = Math.max(frameTime, timelineEngine.snapToFrame(target.duration + delta));
        const nextDuration = Math.max(frameTime, timelineEngine.snapToFrame(nextClip.duration - delta));

        return clipList.map((clip) => {
          if (clip.id === target.id) {
            const clipIn =
              typeof clip.metadata?.inPoint === 'number'
                ? clip.metadata.inPoint
                : typeof clip.metadata?.sourceStartTime === 'number'
                  ? clip.metadata.sourceStartTime
                  : 0;
            return {
              ...clip,
              duration: targetDuration,
              metadata: {
                ...(clip.metadata || {}),
                sourceStartTime: clipIn,
                inPoint: clipIn,
                outPoint: clipIn + targetDuration,
              },
            };
          }

          if (clip.id === nextClip.id) {
            const baseIn =
              typeof clip.metadata?.inPoint === 'number'
                ? clip.metadata.inPoint
                : typeof clip.metadata?.sourceStartTime === 'number'
                  ? clip.metadata.sourceStartTime
                  : 0;
            const nextIn = Math.max(0, timelineEngine.snapToFrame(baseIn + delta));
            return {
              ...clip,
              start: nextBoundary,
              duration: nextDuration,
              metadata: {
                ...(clip.metadata || {}),
                sourceStartTime: nextIn,
                inPoint: nextIn,
                outPoint: nextIn + nextDuration,
              },
            };
          }

          return clip;
        });
      }

      return clipList.map((clip) => {
        if (clip.id !== clipId) {
          return clip;
        }

        const nextStart = mode === 'resize-left' ? snappedStart : clip.start;
        const nextDuration = snappedDuration;
        const baseIn =
          typeof clip.metadata?.inPoint === 'number'
            ? clip.metadata.inPoint
            : typeof clip.metadata?.sourceStartTime === 'number'
              ? clip.metadata.sourceStartTime
              : 0;
        const inPointAdjustment = mode === 'resize-left' ? timelineEngine.snapToFrame(nextStart - clip.start) : 0;
        const nextIn = Math.max(0, timelineEngine.snapToFrame(baseIn + inPointAdjustment));

        return {
          ...clip,
          start: nextStart,
          duration: nextDuration,
          metadata: {
            ...(clip.metadata || {}),
            sourceStartTime: nextIn,
            inPoint: nextIn,
            outPoint: nextIn + nextDuration,
          },
        };
      });
    },
    [editTool, frameTime]
  );

  const getClipInPoint = useCallback((clip: BeatClip): number => {
    if (typeof clip.metadata?.inPoint === 'number') {
      return clip.metadata.inPoint;
    }
    if (typeof clip.metadata?.sourceStartTime === 'number') {
      return clip.metadata.sourceStartTime;
    }
    return 0;
  }, []);

  const getSelectedPrimaryClip = useCallback((): BeatClip | null => {
    const selected = Array.from(selectedClips)
      .map((clipId) => clips.find((clip) => clip.id === clipId))
      .find((clip): clip is BeatClip => Boolean(clip));
    return selected || null;
  }, [selectedClips, clips]);

  const selectClipUnderPlayhead = useCallback((): boolean => {
    const videoClip = clips.find((clip) => {
      const trackId = (clip.trackId || '').toLowerCase();
      const hasAudioTrackId = trackId.startsWith('audio');
      const hasAudioTrackType = trackStates[clip.trackId]?.type === 'audio';
      if (hasAudioTrackId || hasAudioTrackType) {
        return false;
      }
      return currentTime >= clip.start && currentTime < clip.start + clip.duration;
    });
    if (!videoClip) {
      return false;
    }
    setSelectedClips(new Set([videoClip.id]));
    return true;
  }, [clips, currentTime, trackStates]);

  const liftSelectedClips = useCallback(() => {
    if (selectedClips.size === 0) {
      return;
    }
    const selectedIds = new Set(selectedClips);
    const next = clips.filter((clip) => !selectedIds.has(clip.id));
    applyClipUpdates(next, new Set());
  }, [selectedClips, clips, applyClipUpdates]);

  const extractSelectedClips = useCallback(() => {
    if (selectedClips.size === 0) {
      return;
    }
    const selectedByTime = Array.from(selectedClips)
      .map((clipId) => clips.find((clip) => clip.id === clipId))
      .filter((clip): clip is BeatClip => Boolean(clip))
      .sort((left, right) => left.start - right.start);

    if (selectedByTime.length === 0) {
      return;
    }

    let next = clips.slice();
    selectedByTime.forEach((clip) => {
      next = deleteClip(next, clip.id, true);
    });
    applyClipUpdates(next, new Set());
  }, [selectedClips, clips, applyClipUpdates]);

  const razorSelectedAtPlayhead = useCallback(() => {
    const selection = selectedClips.size > 0 ? selectedClips : (() => {
      const selected = selectClipUnderPlayhead();
      if (!selected) {
        return new Set<string>();
      }
      const underPlayhead = clips.find((clip) => currentTime >= clip.start && currentTime < clip.start + clip.duration);
      return underPlayhead ? new Set([underPlayhead.id]) : new Set<string>();
    })();

    if (selection.size === 0) {
      return;
    }

    let next = clips.slice();
    const nextSelection = new Set<string>();
    Array.from(selection).forEach((clipId) => {
      const target = next.find((clip) => clip.id === clipId);
      if (!target) {
        return;
      }
      next = splitClip(next, clipId, currentTime);
      nextSelection.add(`${clipId}_L`);
      nextSelection.add(`${clipId}_R`);
    });

    applyClipUpdates(next, nextSelection);
  }, [selectedClips, clips, currentTime, applyClipUpdates, selectClipUnderPlayhead]);

  const trimSelectedByFrames = useCallback(
    (edge: 'in' | 'out', frames: number): boolean => {
      const target = getSelectedPrimaryClip();
      if (!target) {
        return false;
      }

      const delta = timelineEngine.snapToFrame(frames * frameTime);
      if (Math.abs(delta) < frameTime / 10) {
        return false;
      }

      const trackId = target.trackId;
      const sourceIn = getClipInPoint(target);
      const sourceOut =
        typeof target.metadata?.outPoint === 'number'
          ? target.metadata.outPoint
          : sourceIn + target.duration;
      const currentOut = sourceOut;

      const next = clips.map((clip) => {
        if (clip.id !== target.id) {
          return clip;
        }

        if (edge === 'out') {
          const nextDuration = Math.max(
            frameTime,
            timelineEngine.snapToFrame(clip.duration + delta)
          );
          return {
            ...clip,
            duration: nextDuration,
            metadata: {
              ...(clip.metadata || {}),
              sourceStartTime: sourceIn,
              inPoint: sourceIn,
              outPoint: sourceIn + nextDuration,
            },
          };
        }

        const originalEnd = timelineEngine.snapToFrame(clip.start + clip.duration);
        const requestedStart = timelineEngine.snapToFrame(clip.start + delta);
        const boundedStart = Math.min(originalEnd - frameTime, Math.max(0, requestedStart));
        const startDelta = timelineEngine.snapToFrame(boundedStart - clip.start);
        const nextDuration = Math.max(
          frameTime,
          timelineEngine.snapToFrame(clip.duration - startDelta)
        );
        const nextIn = Math.max(0, timelineEngine.snapToFrame(sourceIn + startDelta));
        const nextOut = Math.max(nextIn, timelineEngine.snapToFrame(sourceOut));

        return {
          ...clip,
          start: boundedStart,
          duration: nextDuration,
          metadata: {
            ...(clip.metadata || {}),
            sourceStartTime: nextIn,
            inPoint: nextIn,
            outPoint: Math.min(nextOut, nextIn + nextDuration),
          },
        };
      });

      const updatedTarget = next.find((clip) => clip.id === target.id);
      if (!updatedTarget) {
        return false;
      }
      const updatedIn = getClipInPoint(updatedTarget);
      const updatedOut =
        typeof updatedTarget.metadata?.outPoint === 'number'
          ? updatedTarget.metadata.outPoint
          : updatedIn + updatedTarget.duration;
      const changed =
        Math.abs(updatedTarget.start - target.start) > frameTime / 10 ||
        Math.abs(updatedTarget.duration - target.duration) > frameTime / 10 ||
        Math.abs(updatedIn - sourceIn) > frameTime / 10 ||
        Math.abs(updatedOut - currentOut) > frameTime / 10;
      if (!changed) {
        return false;
      }

      let stabilized = next;
      if (magneticEnabled && trackId && editTool !== 'roll') {
        stabilized = resolveOverlaps(next, trackId);
      }
      applyClipUpdates(stabilized, new Set([target.id]));
      return true;
    },
    [clips, frameTime, getClipInPoint, getSelectedPrimaryClip, applyClipUpdates, magneticEnabled, editTool]
  );

  const slipSelectedByFrames = useCallback(
    (frames: number): boolean => {
      const target = getSelectedPrimaryClip();
      if (!target) {
        return false;
      }
      const delta = timelineEngine.snapToFrame(frames * frameTime);
      if (Math.abs(delta) < frameTime / 10) {
        return false;
      }

      const currentOut =
        typeof target.metadata?.outPoint === 'number'
          ? target.metadata.outPoint
          : getClipInPoint(target) + target.duration;

      const next = clips.map((clip) => {
        if (clip.id !== target.id) {
          return clip;
        }
        const clipIn = getClipInPoint(clip);
        const nextIn = Math.max(0, timelineEngine.snapToFrame(clipIn + delta));
        return {
          ...clip,
          metadata: {
            ...(clip.metadata || {}),
            sourceStartTime: nextIn,
            inPoint: nextIn,
            outPoint: nextIn + clip.duration,
          },
        };
      });
      const updatedTarget = next.find((clip) => clip.id === target.id);
      if (!updatedTarget) {
        return false;
      }
      const updatedIn = getClipInPoint(updatedTarget);
      const updatedOut =
        typeof updatedTarget.metadata?.outPoint === 'number'
          ? updatedTarget.metadata.outPoint
          : updatedIn + updatedTarget.duration;
      if (
        Math.abs(updatedIn - getClipInPoint(target)) < frameTime / 10 &&
        Math.abs(updatedOut - currentOut) < frameTime / 10
      ) {
        return false;
      }
      applyClipUpdates(next, new Set([target.id]));
      return true;
    },
    [clips, frameTime, getClipInPoint, getSelectedPrimaryClip, applyClipUpdates]
  );

  const slideSelectedByFrames = useCallback(
    (frames: number): boolean => {
      const target = getSelectedPrimaryClip();
      if (!target) {
        return false;
      }
      const delta = timelineEngine.snapToFrame(frames * frameTime);
      if (Math.abs(delta) < frameTime / 10) {
        return false;
      }

      const sameTrack = clips
        .filter((clip) => clip.trackId === target.trackId && clip.id !== target.id)
        .sort((left, right) => left.start - right.start);
      const previous = [...sameTrack]
        .reverse()
        .find((clip) => clip.start + clip.duration <= target.start + frameTime);
      const nextClip = sameTrack.find((clip) => clip.start >= target.start + target.duration - frameTime);
      const minStart = previous
        ? timelineEngine.snapToFrame(previous.start + previous.duration + frameTime)
        : 0;
      const maxStart = nextClip
        ? timelineEngine.snapToFrame(nextClip.start - target.duration - frameTime)
        : Number.POSITIVE_INFINITY;
      const desiredStart = timelineEngine.snapToFrame(target.start + delta);
      const boundedStart = Math.max(minStart, Math.min(maxStart, desiredStart));

      if (Math.abs(boundedStart - target.start) < frameTime / 10) {
        return false;
      }

      const next = clips.map((clip) =>
        clip.id === target.id ? { ...clip, start: boundedStart } : clip
      );
      applyClipUpdates(next, new Set([target.id]));
      return true;
    },
    [clips, frameTime, getSelectedPrimaryClip, applyClipUpdates]
  );

  const rollSelectedByFrames = useCallback(
    (frames: number): boolean => {
      const target = getSelectedPrimaryClip();
      if (!target) {
        return false;
      }
      const delta = timelineEngine.snapToFrame(frames * frameTime);
      if (Math.abs(delta) < frameTime / 10) {
        return false;
      }

      const nextClip = clips
        .filter(
          (clip) =>
            clip.trackId === target.trackId &&
            clip.id !== target.id &&
            clip.start >= target.start + target.duration - frameTime
        )
        .sort((left, right) => left.start - right.start)[0];

      if (!nextClip) {
        return false;
      }

      const maxShrinkTarget = Math.max(0, target.duration - frameTime);
      const maxGrowTarget = Math.max(0, nextClip.duration - frameTime);
      const boundedDelta = Math.max(-maxShrinkTarget, Math.min(maxGrowTarget, delta));
      if (Math.abs(boundedDelta) < frameTime / 10) {
        return false;
      }

      const targetIn = getClipInPoint(target);
      const nextIn = getClipInPoint(nextClip);
      const targetDuration = Math.max(
        frameTime,
        timelineEngine.snapToFrame(target.duration + boundedDelta)
      );
      const nextStart = timelineEngine.snapToFrame(nextClip.start + boundedDelta);
      const nextDuration = Math.max(
        frameTime,
        timelineEngine.snapToFrame(nextClip.duration - boundedDelta)
      );
      const shiftedNextIn = Math.max(0, timelineEngine.snapToFrame(nextIn + boundedDelta));

      const next = clips.map((clip) => {
        if (clip.id === target.id) {
          return {
            ...clip,
            duration: targetDuration,
            metadata: {
              ...(clip.metadata || {}),
              sourceStartTime: targetIn,
              inPoint: targetIn,
              outPoint: targetIn + targetDuration,
            },
          };
        }
        if (clip.id === nextClip.id) {
          return {
            ...clip,
            start: nextStart,
            duration: nextDuration,
            metadata: {
              ...(clip.metadata || {}),
              sourceStartTime: shiftedNextIn,
              inPoint: shiftedNextIn,
              outPoint: shiftedNextIn + nextDuration,
            },
          };
        }
        return clip;
      });
      const updatedTarget = next.find((clip) => clip.id === target.id);
      if (!updatedTarget) {
        return false;
      }
      if (Math.abs(updatedTarget.duration - target.duration) < frameTime / 10) {
        return false;
      }

      applyClipUpdates(next, new Set([target.id]));
      return true;
    },
    [clips, frameTime, getClipInPoint, getSelectedPrimaryClip, applyClipUpdates]
  );

  const seedTimelineFixture = useCallback(() => {
    const sourceFromPreview =
      sourcePreviewClip && sourcePreviewClip.sourceFile.trim().length > 0 ? sourcePreviewClip : null;
    const sourceFromProgram =
      previewClip && previewClip.sourceFile && previewClip.sourceFile.trim().length > 0 ? previewClip : null;
    const fallbackSourceFile = availableVideoSources.find((candidate) => candidate.trim().length > 0) || '';
    const sourceFile =
      sourceFromPreview?.sourceFile ||
      sourceFromProgram?.sourceFile ||
      fallbackSourceFile;

    if (!sourceFile) {
      return null;
    }

    const trackId = getPrimaryVideoTrackId();
    const leftDuration = timelineEngine.snapToFrame(Math.max(frameTime * 60, frameTime));
    const centerDuration = timelineEngine.snapToFrame(Math.max(frameTime * 70, frameTime));
    const rightDuration = timelineEngine.snapToFrame(Math.max(frameTime * 65, frameTime));
    const leftStart = 0;
    const centerStart = timelineEngine.snapToFrame(leftStart + leftDuration);
    const rightStart = timelineEngine.snapToFrame(centerStart + centerDuration);
    const fixtureBaseId = Date.now();
    const sourceLabel =
      sourceFromPreview?.name ||
      sourceFromProgram?.name ||
      sourceFromProgram?.beatName ||
      'Fixture Source';

    const makeFixtureClip = (suffix: string, start: number, duration: number, sourceIn: number): BeatClip => ({
      id: `fixture_${suffix}_${fixtureBaseId}`,
      name: `${sourceLabel} ${suffix}`,
      beatName: `${sourceLabel} ${suffix}`,
      start,
      duration,
      ev: 0,
      synopsis: `Fixture ${suffix}`,
      trackId,
      sourceFile,
      tags: ['fixture'],
      metadata: {
        inPoint: sourceIn,
        outPoint: sourceIn + duration,
        sourceStartTime: sourceIn,
        seededFixture: true,
      },
    });

    const leftClip = makeFixtureClip('left', leftStart, leftDuration, 0);
    const primaryClip = makeFixtureClip(
      'primary',
      centerStart,
      centerDuration,
      timelineEngine.snapToFrame(frameTime * 20)
    );
    const rightClip = makeFixtureClip(
      'right',
      rightStart,
      rightDuration,
      timelineEngine.snapToFrame(frameTime * 40)
    );

    fixtureTimelineLockRef.current = true;
    applyClipUpdates([leftClip, primaryClip, rightClip], new Set([primaryClip.id]));
    setCurrentTime(timelineEngine.snapToFrame(primaryClip.start + frameTime * 3));
    setIsPlaying(false);
    setSourcePreviewIsPlaying(false);
    setSourceMarkIn(null);
    setSourceMarkOut(null);
    setProgramMarkIn(null);
    setProgramMarkOut(null);
    setActiveSourcePreview({
      id: primaryClip.id,
      name: sourceLabel,
      sourceFile,
    });
    setActiveMonitor('program');

    return {
      primaryClipId: primaryClip.id,
      clipIds: [leftClip.id, primaryClip.id, rightClip.id],
      trackId,
      sourceFile,
    };
  }, [
    sourcePreviewClip,
    previewClip,
    availableVideoSources,
    getPrimaryVideoTrackId,
    frameTime,
    applyClipUpdates,
  ]);

  useEffect(() => {
    const hook: StoryArcEditorTestHook = {
      selectClipById: (clipId) => {
        const exists = clips.some((clip) => clip.id === clipId);
        if (!exists) {
          return false;
        }
        setSelectedClips(new Set([clipId]));
        return true;
      },
      listClips: () =>
        clips.map((clip) => ({
          clipId: clip.id,
          trackId: clip.trackId,
          start: clip.start,
          duration: clip.duration,
          name: clip.name || clip.beatName || clip.id,
          sourceFile: clip.sourceFile || '',
        })),
      snapshot: (clipId) => {
        const targetId = clipId || Array.from(selectedClips)[0];
        if (!targetId) {
          return null;
        }
        const clip = clips.find((candidate) => candidate.id === targetId);
        if (!clip) {
          return null;
        }
        const inPoint = getClipInPoint(clip);
        const outPoint =
          typeof clip.metadata?.outPoint === 'number'
            ? clip.metadata.outPoint
            : inPoint + clip.duration;
        return {
          clipId: clip.id,
          trackId: clip.trackId,
          start: clip.start,
          duration: clip.duration,
          inPoint,
          outPoint,
        };
      },
      trimSelected: (edge, frames) => trimSelectedByFrames(edge, frames),
      slipSelected: (frames) => slipSelectedByFrames(frames),
      slideSelected: (frames) => slideSelectedByFrames(frames),
      rollSelected: (frames) => rollSelectedByFrames(frames),
      setPlayhead: (seconds) => {
        const nextTime = Math.max(0, Math.min(totalDuration, seconds));
        setCurrentTime(nextTime);
        setIsPlaying(false);
      },
      seedTimelineFixture,
    };

    window.__storyArcEditorTestHook = hook;
    return () => {
      if (window.__storyArcEditorTestHook === hook) {
        delete window.__storyArcEditorTestHook;
      }
    };
  }, [
    clips,
    selectedClips,
    getClipInPoint,
    trimSelectedByFrames,
    slipSelectedByFrames,
    slideSelectedByFrames,
    rollSelectedByFrames,
    totalDuration,
    seedTimelineFixture,
  ]);

  // Professional keyboard shortcuts with Source/Program monitor parity.
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      const monitorFocus = activeMonitor;
      const sourceIsActive = monitorFocus === 'source';
      const multicamIndex = Number(key);
      if (
        Number.isInteger(multicamIndex) &&
        multicamIndex >= 1 &&
        multicamIndex <= 9 &&
        multicamEnabled &&
        multicamAngleCandidates[multicamIndex - 1]
      ) {
        e.preventDefault();
        applyMulticamAngle(multicamAngleCandidates[multicamIndex - 1]);
        return;
      }

      switch (key) {
        case ' ': // Spacebar - Play/Pause on active monitor
          e.preventDefault();
          if (sourceIsActive) {
            handleSourcePlayPause();
          } else {
            setIsPlaying((previous) => !previous);
          }
          break;
        case 'escape': // Stop active monitor
          e.preventDefault();
          if (sourceIsActive) {
            pauseSourcePlayback(true);
          } else {
            setIsPlaying(false);
            setCurrentTime(0);
            setPlaybackSpeed(1);
          }
          break;
        case 'arrowleft': // Frame backward on active monitor
          e.preventDefault();
          if (sourceIsActive) {
            stepSourceBackward();
          } else {
            setCurrentTime((previous) => Math.max(0, previous - frameTime));
            setIsPlaying(false);
          }
          break;
        case 'arrowright': // Frame forward on active monitor
          e.preventDefault();
          if (sourceIsActive) {
            stepSourceForward();
          } else {
            setCurrentTime((previous) => Math.min(totalDuration, previous + frameTime));
            setIsPlaying(false);
          }
          break;
        case 'j': // J/K/L transport controls on active monitor
          e.preventDefault();
          if (sourceIsActive) {
            stepSourceBackward();
            break;
          }
          setIsPlaying((previous) => {
            if (previous && playbackDirection === 'reverse') {
              setPlaybackSpeed((speed) => Math.min(8, speed * 2));
              return true;
            }
            setPlaybackDirection('reverse');
            setPlaybackSpeed(1);
            return true;
          });
          break;
        case 'k':
          e.preventDefault();
          if (sourceIsActive) {
            pauseSourcePlayback();
          } else {
            setIsPlaying(false);
            setPlaybackSpeed(1);
          }
          break;
        case 'l':
          e.preventDefault();
          if (sourceIsActive) {
            handleSourcePlayPause();
            break;
          }
          setIsPlaying((previous) => {
            if (previous && playbackDirection === 'forward') {
              setPlaybackSpeed((speed) => Math.min(8, speed * 2));
              return true;
            }
            setPlaybackDirection('forward');
            setPlaybackSpeed(1);
            return true;
          });
          break;
        case 'home': // Go to beginning on active monitor
          e.preventDefault();
          if (sourceIsActive) {
            seekSourcePlayback(0);
          } else {
            setCurrentTime(0);
          }
          break;
        case 'end': // Go to end on active monitor
          e.preventDefault();
          if (sourceIsActive) {
            seekSourcePlayback(sourcePreviewDuration);
          } else {
            setCurrentTime(totalDuration);
          }
          break;
        case 'delete':
        case 'backspace':
          e.preventDefault();
          if (reviewerMode) break;
          if (selectedClips.size > 0) {
            const next = Array.from(selectedClips).reduce(
              (acc, id) => deleteClip(acc, id, rippleEnabled),
              clips.slice()
            );
            applyClipUpdates(next, new Set());
          }
          break;
        case 'a':
          e.preventDefault();
          setEditTool('select');
          break;
        case 't':
          e.preventDefault();
          setEditTool('trim');
          break;
        case 'r':
          e.preventDefault();
          setEditTool('roll');
          break;
        case 'y':
          e.preventDefault();
          setEditTool('slip');
          break;
        case 'u':
          e.preventDefault();
          setEditTool('slide');
          break;
        case 'g':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            if (e.shiftKey) {
              setShowCompositionGuideDialog((previous) => !previous);
            } else {
              setShowCompositionGuides((previous) => !previous);
            }
          }
          break;
        case 's':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            void handleSaveNow();
          }
          break;
        case 'z':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (e.shiftKey) {
              performRedo();
            } else {
              performUndo();
            }
          }
          break;
        case 'c':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            copySelectedClips();
            break;
          }
          e.preventDefault();
          razorSelectedAtPlayhead();
          break;
        case 'x':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            cutSelectedClips();
          }
          break;
        case 'v':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            pasteClipboardClips();
          }
          break;
        case 'd':
          e.preventDefault();
          selectClipUnderPlayhead();
          break;
        case ';':
          e.preventDefault();
          liftSelectedClips();
          break;
        case "'":
          e.preventDefault();
          extractSelectedClips();
          break;
        case ',':
          e.preventDefault();
          insertOrOverwriteFromSource('insert', sourcePreviewClip);
          break;
        case '.':
          e.preventDefault();
          insertOrOverwriteFromSource('overwrite', sourcePreviewClip);
          break;
        case 'i': // Mark in / Jump to mark in (Shift+I) on active monitor
          e.preventDefault();
          if (sourceIsActive) {
            if (e.shiftKey) {
              jumpToSourceMark('in');
            } else {
              setSourceMark('in', sourcePreviewVideoRef.current?.currentTime ?? sourcePreviewTime);
            }
          } else if (e.shiftKey) {
            jumpToProgramMark('in');
          } else {
            setProgramMark('in');
          }
          break;
        case 'o': // Mark out / Jump to mark out (Shift+O) on active monitor
          e.preventDefault();
          if (sourceIsActive) {
            if (e.shiftKey) {
              jumpToSourceMark('out');
            } else {
              setSourceMark('out', sourcePreviewVideoRef.current?.currentTime ?? sourcePreviewTime);
            }
          } else if (e.shiftKey) {
            jumpToProgramMark('out');
          } else {
            setProgramMark('out');
          }
          break;
        case 'f9':
          e.preventDefault();
          insertOrOverwriteFromSource('insert', sourcePreviewClip);
          break;
        case 'f10':
          e.preventDefault();
          insertOrOverwriteFromSource('overwrite', sourcePreviewClip);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [
    activeMonitor,
    playbackDirection,
    totalDuration,
    frameTime,
    reviewerMode,
    selectedClips,
    rippleEnabled,
    clips,
    applyClipUpdates,
    performUndo,
    performRedo,
    copySelectedClips,
    cutSelectedClips,
    pasteClipboardClips,
    selectClipUnderPlayhead,
    liftSelectedClips,
    extractSelectedClips,
    razorSelectedAtPlayhead,
    handleSaveNow,
    setProgramMark,
    setSourceMark,
    jumpToProgramMark,
    jumpToSourceMark,
    sourcePreviewTime,
    sourcePreviewDuration,
    insertOrOverwriteFromSource,
    sourcePreviewClip,
    multicamEnabled,
    multicamAngleCandidates,
    applyMulticamAngle,
    handleSourcePlayPause,
    pauseSourcePlayback,
    seekSourcePlayback,
    stepSourceBackward,
    stepSourceForward,
  ]);

  // Playback simulation - FIXED: Enhanced cleanup and dependencies
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setCurrentTime(prev => {
        const step = (frameTime * playbackSpeed) * (playbackDirection === 'forward' ? 1 : -1);
        const newTime = prev + step;
        
        if (newTime < 0) {
          if (isLooping) return totalDuration;
          setIsPlaying(false);
          return 0;
        }
        
        if (newTime > totalDuration) {
          if (isLooping) return 0;
          setIsPlaying(false);
          return totalDuration;
        }
        
        return newTime;
      });
    }, 1000 / frameRate);

    // Ensure cleanup on component unmount or state change
    return () => {
      clearInterval(interval);
    };
  }, [isPlaying, playbackSpeed, playbackDirection, frameTime, totalDuration, isLooping, frameRate]);

  // Add timecode formatting function
  const formatTimecode = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * 25); // 25 fps
    return `${mins}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2,'0')}`;
  };

  // Filename template helper
  const renderFilename = (template: string, ctx: { id: string; projectId?: string | number | null; projectName?: string | null; ts?: string; }): string => {
    return template
      .replaceAll('{id}', String(ctx.id || 'unknown'))
      .replaceAll('{projectId}', ctx.projectId ? String(ctx.projectId) : '')
      .replaceAll('{name}', ctx.projectName ? String(ctx.projectName) : '')
      .replaceAll('{ts}', ctx.ts || '');
  };

  // Relative time for save chip
  const formatRelativeTime = (ts: number) => {
    const diff = Math.max(0, Date.now() - ts);
    const s = Math.floor(diff / 1000);
    if (s < 10) return 'just now';
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    return `${h}h ago`;
  };

  // Audio track handlers
  const handleOpenMixer = useCallback((trackId: string) => {
    setSelectedAudioTrackId(trackId);
    setOpenMixerDirectly(true);
    setShowAIAudioAssistant(true);
  }, []);

  const handleOpenAIAssistant = useCallback((trackId: string) => {
    setSelectedAudioTrackId(trackId);
    setOpenMixerDirectly(false);
    setShowAIAudioAssistant(true);
  }, []);

  const lutLibrary = useMemo(() => LUTEngine.getLUTLibrary(), []);
  const availableLUTs = useMemo(() => lutLibrary.flatMap((category) => category.luts), [lutLibrary]);
  const textAnimationPresets = useMemo(() => TextAnimationEngine.getAnimationPresets(), []);
  const colorGradePresets = useMemo(() => ColorGradingEngine.getColorPresets(), []);

  const selectedInspectorClips = useMemo(
    () =>
      Array.from(selectedClips)
        .map((clipId) => clipMap.get(clipId))
        .filter(Boolean) as BeatClip[],
    [selectedClips, clipMap]
  );

  const resolveClipLocalTime = useCallback(
    (clip: BeatClip | null) => {
      if (!clip) {
        return 0;
      }

      const inPoint = typeof clip.metadata?.inPoint === 'number' ? clip.metadata.inPoint : 0;
      const configuredOutPoint =
        typeof clip.metadata?.outPoint === 'number' ? clip.metadata.outPoint : inPoint + clip.duration;
      const outPoint = Math.max(inPoint, configuredOutPoint);
      const relativeTimelineTime =
        currentTime >= clip.start && currentTime <= clip.start + clip.duration
          ? currentTime - clip.start
          : 0;

      return Math.max(inPoint, Math.min(outPoint, inPoint + relativeTimelineTime));
    },
    [currentTime]
  );

  const sourcePreviewLocalTime = useMemo(() => {
    if (!sourcePreviewClip) {
      return 0;
    }
    const clipIn = typeof sourcePreviewClip.metadata?.inPoint === 'number' ? sourcePreviewClip.metadata.inPoint : 0;
    const configuredOutPoint =
      typeof sourcePreviewClip.metadata?.outPoint === 'number' ? sourcePreviewClip.metadata.outPoint : clipIn + sourcePreviewClip.duration;
    const markOut = sourceMarkOut ?? configuredOutPoint;
    const upperBoundFromMarks = Math.max(clipIn + frameTime, markOut);
    const mediaUpperBound = sourcePreviewDuration > 0 ? sourcePreviewDuration : upperBoundFromMarks;
    const upperBound = Math.max(clipIn + frameTime, Math.min(mediaUpperBound, upperBoundFromMarks));
    return Math.max(clipIn, Math.min(upperBound, sourcePreviewTime));
  }, [sourcePreviewClip, sourceMarkOut, frameTime, sourcePreviewDuration, sourcePreviewTime]);

  const programMonitorClip = useMemo(() => {
    const previewHasPlayableSource = Boolean(
      previewClip?.sourceFile && isUsableMediaSource(previewClip.sourceFile)
    );
    const sourceHasPlayableSource = Boolean(
      sourcePreviewClip?.sourceFile && isUsableMediaSource(sourcePreviewClip.sourceFile)
    );

    if (previewHasPlayableSource && !previewError) {
      return previewClip;
    }
    if (sourceHasPlayableSource) {
      return sourcePreviewClip;
    }
    return previewClip ?? sourcePreviewClip ?? null;
  }, [previewClip, sourcePreviewClip, previewError, isUsableMediaSource]);

  const programPreviewLocalTime = useMemo(() => {
    return resolveClipLocalTime(programMonitorClip);
  }, [programMonitorClip, resolveClipLocalTime]);

  useEffect(() => {
    setPreviewReady(false);
    setPreviewError(null);
  }, [programMonitorClip?.id, programMonitorClip?.sourceFile]);

  useEffect(() => {
    setSourcePreviewReady(false);
    setSourcePreviewError(null);
    setSourcePreviewIsPlaying(false);
    if (!sourcePreviewClip) {
      setSourcePreviewDuration(0);
      setSourcePreviewTime(0);
      setSourceMarkIn(null);
      setSourceMarkOut(null);
      return;
    }

    const clipIn = typeof sourcePreviewClip.metadata?.inPoint === 'number' ? sourcePreviewClip.metadata.inPoint : 0;
    const clipOut =
      typeof sourcePreviewClip.metadata?.outPoint === 'number'
        ? sourcePreviewClip.metadata.outPoint
        : clipIn + sourcePreviewClip.duration;
    const normalizedOut = Math.max(clipIn + frameTime, clipOut);
    setSourceMarkIn(clipIn);
    setSourceMarkOut(normalizedOut);
    setSourcePreviewTime(clipIn);
    setSourcePreviewDuration(Math.max(clipIn + frameTime, normalizedOut));
  }, [sourcePreviewClip?.id, sourcePreviewClip?.sourceFile, frameTime]);

  useEffect(() => {
    const videoElement = previewVideoRef.current;
    if (!videoElement || !programMonitorClip?.sourceFile) {
      return;
    }

    if (!previewReady) {
      return;
    }

    if (Math.abs(videoElement.currentTime - programPreviewLocalTime) > 0.08) {
      try {
        videoElement.currentTime = programPreviewLocalTime;
      } catch {
        // Ignore seek errors until media is seekable.
      }
    }
  }, [programMonitorClip?.id, programMonitorClip?.sourceFile, programPreviewLocalTime, previewReady]);

  useEffect(() => {
    const videoElement = sourcePreviewVideoRef.current;
    if (!videoElement || !sourcePreviewClip?.sourceFile || !sourcePreviewReady) {
      return;
    }

    if (Math.abs(videoElement.currentTime - sourcePreviewLocalTime) > 0.08) {
      try {
        videoElement.currentTime = sourcePreviewLocalTime;
      } catch {
        // Ignore seek errors until media is seekable.
      }
    }
  }, [sourcePreviewClip?.id, sourcePreviewClip?.sourceFile, sourcePreviewLocalTime, sourcePreviewReady]);

  useEffect(() => {
    if (
      !sourcePreviewClip?.id ||
      !programMonitorClip?.id ||
      sourcePreviewClip.id !== programMonitorClip.id ||
      !isPlaying ||
      playbackDirection !== 'forward'
    ) {
      return;
    }

    setSourcePreviewTime((previous) =>
      Math.abs(previous - programPreviewLocalTime) > frameTime / 2 ? programPreviewLocalTime : previous
    );
  }, [
    sourcePreviewClip?.id,
    programMonitorClip?.id,
    isPlaying,
    playbackDirection,
    programPreviewLocalTime,
    frameTime,
  ]);

  useEffect(() => {
    let cancelled = false;
    const refreshCacheStats = async () => {
      try {
        const stats = await ThumbnailCacheService.getCacheStats();
        if (cancelled) {
          return;
        }
        setThumbnailCacheSummary({
          thumbnailCount: stats.thumbnailCount,
          totalSize: stats.totalSize,
        });
      } catch (error) {
        console.warn('Thumbnail cache stats unavailable:', error);
      }
    };
    void refreshCacheStats();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const videoElement = previewVideoRef.current;
    if (!videoElement || !previewReady || !programMonitorClip?.id || !programMonitorClip?.sourceFile) {
      return;
    }

    const frameNumber = timelineEngine.secondsToFrames(Math.max(0, currentTime));
    // Cache at a reduced cadence to avoid excessive storage churn while scrubbing.
    if (frameNumber % 12 !== 0) {
      return;
    }

    let cancelled = false;
    const cacheFrame = async () => {
      try {
        const cached = await ThumbnailCacheService.getThumbnail(programMonitorClip.id, frameNumber);
        if (cached || cancelled) {
          return;
        }

        const width = 320;
        const height = 180;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return;
        }

        ctx.drawImage(videoElement, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
        await ThumbnailCacheService.cacheThumbnail(programMonitorClip.id, frameNumber, dataUrl, width, height);

        if (cancelled) {
          return;
        }
        const stats = await ThumbnailCacheService.getCacheStats();
        if (cancelled) {
          return;
        }
        setThumbnailCacheSummary({
          thumbnailCount: stats.thumbnailCount,
          totalSize: stats.totalSize,
        });
      } catch (error) {
        console.warn('Thumbnail cache frame skipped:', error);
      }
    };

    void cacheFrame();
    return () => {
      cancelled = true;
    };
  }, [currentTime, previewReady, programMonitorClip?.id, programMonitorClip?.sourceFile]);

  useEffect(() => {
    const videoElement = previewVideoRef.current;
    if (!videoElement || !programMonitorClip?.sourceFile) {
      return;
    }

    if (!previewReady) {
      return;
    }

    if (playbackDirection === 'reverse') {
      videoElement.pause();
      return;
    }

    videoElement.playbackRate = Math.max(0.1, Math.min(4, playbackSpeed));

    if (isPlaying) {
      const playResult = videoElement.play();
      if (playResult && typeof playResult.catch === 'function') {
        void playResult.catch((error) => {
          console.warn('Preview playback blocked:', error);
        });
      }
      return;
    }

    videoElement.pause();
  }, [isPlaying, playbackDirection, playbackSpeed, programMonitorClip?.id, programMonitorClip?.sourceFile, previewReady]);

  useEffect(() => {
    const videoElement = sourcePreviewVideoRef.current;
    if (!videoElement || !sourcePreviewClip?.sourceFile || !sourcePreviewReady) {
      return;
    }

    const shouldMirrorProgram =
      Boolean(programMonitorClip?.id) &&
      programMonitorClip?.id === sourcePreviewClip?.id &&
      playbackDirection === 'forward';

    if (shouldMirrorProgram && isPlaying) {
      videoElement.playbackRate = Math.max(0.1, Math.min(4, playbackSpeed));
      const playResult = videoElement.play();
      if (playResult && typeof playResult.catch === 'function') {
        void playResult.catch(() => {
          // Keep source monitor paused when autoplay is blocked.
        });
      }
      return;
    }

    videoElement.pause();
  }, [
    isPlaying,
    playbackDirection,
    playbackSpeed,
    programMonitorClip?.id,
    sourcePreviewClip?.id,
    sourcePreviewClip?.sourceFile,
    sourcePreviewReady,
  ]);

  const primaryAudioClip = useMemo(
    () =>
      clips.find((clip) => {
        if (!clip?.sourceFile || clip.sourceFile.trim().length === 0) {
          return false;
        }
        if (!isUsableMediaSource(clip.sourceFile)) {
          return false;
        }
        const trackId = (clip.trackId || '').toLowerCase();
        const hasAudioTrackId = trackId.startsWith('audio');
        const hasAudioTrackType = trackStates[clip.trackId]?.type === 'audio';
        return hasAudioTrackId || hasAudioTrackType;
      }) || null,
    [clips, trackStates, isUsableMediaSource]
  );
  const waveformAudioUrl = primaryAudioClip?.sourceFile?.trim() || '';

  const activeMonitorLabel = activeMonitor === 'source' ? 'Source Monitor' : 'Program Monitor';
  const activeMonitorIsPlaying = activeMonitor === 'source' ? sourcePreviewIsPlaying : isPlaying;
  const activeMonitorCanPlay = activeMonitor === 'source'
    ? Boolean(sourcePreviewClip?.sourceFile)
    : Boolean(programMonitorClip?.sourceFile);

  const handleActiveTransportStart = useCallback(() => {
    if (activeMonitor === 'source') {
      seekSourcePlayback(0);
      return;
    }
    setCurrentTime(0);
    setIsPlaying(false);
  }, [activeMonitor, seekSourcePlayback]);

  const handleActiveTransportEnd = useCallback(() => {
    if (activeMonitor === 'source') {
      seekSourcePlayback(sourcePreviewDuration);
      return;
    }
    setCurrentTime(totalDuration);
    setIsPlaying(false);
  }, [activeMonitor, seekSourcePlayback, sourcePreviewDuration, totalDuration]);

  const handleActiveStop = useCallback(() => {
    if (activeMonitor === 'source') {
      pauseSourcePlayback(true);
      return;
    }
    handleStop();
  }, [activeMonitor, pauseSourcePlayback, handleStop]);

  const handleActivePlayPause = useCallback(() => {
    if (activeMonitor === 'source') {
      handleSourcePlayPause();
      return;
    }
    handlePlayPause();
  }, [activeMonitor, handleSourcePlayPause, handlePlayPause]);

  const handleActiveStepBackward = useCallback(() => {
    if (activeMonitor === 'source') {
      stepSourceBackward();
      return;
    }
    stepBackward();
  }, [activeMonitor, stepBackward, stepSourceBackward]);

  const handleActiveStepForward = useCallback(() => {
    if (activeMonitor === 'source') {
      stepSourceForward();
      return;
    }
    stepForward();
  }, [activeMonitor, stepForward, stepSourceForward]);

  const handleActiveJKL = useCallback(
    (key: 'j' | 'k' | 'l') => {
      if (activeMonitor === 'source') {
        if (key === 'j') {
          stepSourceBackward();
          return;
        }
        if (key === 'k') {
          pauseSourcePlayback();
          return;
        }
        handleSourcePlayPause();
        return;
      }
      handleJKLControl(key);
    },
    [activeMonitor, stepSourceBackward, pauseSourcePlayback, handleSourcePlayPause, handleJKLControl]
  );

  const handleActiveMarkIn = useCallback(() => {
    if (activeMonitor === 'source') {
      setSourceMark('in', sourcePreviewVideoRef.current?.currentTime ?? sourcePreviewTime);
      return;
    }
    setProgramMark('in');
  }, [activeMonitor, setSourceMark, sourcePreviewTime, setProgramMark]);

  const handleActiveMarkOut = useCallback(() => {
    if (activeMonitor === 'source') {
      setSourceMark('out', sourcePreviewVideoRef.current?.currentTime ?? sourcePreviewTime);
      return;
    }
    setProgramMark('out');
  }, [activeMonitor, setSourceMark, sourcePreviewTime, setProgramMark]);

  const handleActiveJumpMarkIn = useCallback(() => {
    if (activeMonitor === 'source') {
      jumpToSourceMark('in');
      return;
    }
    jumpToProgramMark('in');
  }, [activeMonitor, jumpToSourceMark, jumpToProgramMark]);

  const handleActiveJumpMarkOut = useCallback(() => {
    if (activeMonitor === 'source') {
      jumpToSourceMark('out');
      return;
    }
    jumpToProgramMark('out');
  }, [activeMonitor, jumpToSourceMark, jumpToProgramMark]);

  const closeSyncDialog = useCallback(() => {
    setShowSyncDialog(false);
    setSelectedSyncClips(new Set());
    setSyncInProgress(false);
    setSyncResults(null);
    setManualOffsets({});
    setSyncPreviewMode(false);
    setSyncJobId(null);
  }, []);

  const openSyncDialog = useCallback(() => {
    const syncableClips = clips.filter((clip) => {
      const hasAudioSource = Boolean(clip.sourceFile && clip.sourceFile.trim().length > 0);
      return (
        hasAudioSource &&
        (clipMeta[clip.id]?.syncGroup || clipMeta[clip.id]?.camera || clip.metadata?.syncGroup)
      );
    });

    if (syncableClips.length >= 2) {
      setSelectedSyncClips(new Set(syncableClips.map((clip) => clip.id)));
    } else {
      const firstTwo = clips
        .filter((clip) => Boolean(clip.sourceFile && clip.sourceFile.trim().length > 0))
        .slice(0, 2)
        .map((clip) => clip.id);
      setSelectedSyncClips(new Set(firstTwo));
    }
    setShowSyncDialog(true);
  }, [clips, clipMeta]);

  const runLocalSync = useCallback(
    async (selected: BeatClip[], reference: BeatClip): Promise<Record<string, EngineAudioSyncResult>> => {
      const inputClips: AudioSyncClipInput[] = selected.map((clip) => {
        const sourcePath = clip.sourceFile?.trim() || '';
        const metadata = clip.metadata;
        const timecodeCandidate =
          typeof metadata?.timecode === 'string'
            ? metadata.timecode
            : typeof metadata?.sourceTimecode === 'string'
              ? metadata.sourceTimecode
              : undefined;

        return {
          id: clip.id,
          sourceUrl: sourcePath,
          file: sourceFileRegistry[sourcePath],
          type: clip.trackId?.toLowerCase().startsWith('audio') ? 'audio' : 'video',
          camera: clipMeta[clip.id]?.camera || clip.metadata?.camera,
          syncGroup: clipMeta[clip.id]?.syncGroup || clip.metadata?.syncGroup,
          timecode: timecodeCandidate,
        };
      });

      const result = await audioSyncEngine.synchronizeClips(inputClips, {
        referenceClipId: reference.id,
        frameRate,
        maxOffsetSeconds: syncMaxOffsetSeconds,
        tryReallyHard: syncTryReallyHard,
        enableDriftCorrection: syncEnableDriftCorrection,
        preferTimecode: syncPreferTimecode,
      });

      return result.offsets;
    },
    [
      clipMeta,
      sourceFileRegistry,
      frameRate,
      syncMaxOffsetSeconds,
      syncTryReallyHard,
      syncEnableDriftCorrection,
      syncPreferTimecode,
    ]
  );

  const applySyncToTimeline = useCallback(async () => {
    if (!syncResults) {
      return;
    }

    const selected = clips.filter((clip) => selectedSyncClips.has(clip.id));
    if (selected.length === 0) {
      return;
    }

    const autoOffsets: Record<string, number> = {};
    const autoConfidences: Record<string, number> = {};
    const manualOffsetsData: Record<string, number> = {};
    const cameraSetup: Record<string, { camera?: string; syncGroup?: string }> = {};
    const videoMetadata: Record<string, { duration: number; trackId: string }> = {};

    Object.entries(syncResults).forEach(([clipId, result]) => {
      autoOffsets[clipId] = result.offset_seconds;
      autoConfidences[clipId] = result.confidence;
      const manualOffset = manualOffsets[clipId];
      if (manualOffset !== undefined && Math.abs(manualOffset - result.offset_seconds) > 0.01) {
        manualOffsetsData[clipId] = manualOffset;
      }

      const clip = clips.find((item) => item.id === clipId);
      if (clip) {
        const meta = clipMeta[clipId] || {};
        cameraSetup[clipId] = {
          camera: meta.camera || clip.metadata?.camera,
          syncGroup: meta.syncGroup || clip.metadata?.syncGroup,
        };
        videoMetadata[clipId] = {
          duration: clip.duration,
          trackId: clip.trackId,
        };
      }
    });

    const hasManualAdjustments = Object.keys(manualOffsetsData).length > 0;
    const confidenceValues = Object.values(autoConfidences);
    const avgConfidence =
      confidenceValues.length > 0
        ? confidenceValues.reduce((sum, confidence) => sum + confidence, 0) / confidenceValues.length
        : 0;

    let adjustmentMagnitude = 0;
    if (hasManualAdjustments) {
      const differences = Object.entries(manualOffsetsData).map(([clipId, manual]) =>
        Math.abs(manual - autoOffsets[clipId])
      );
      adjustmentMagnitude = Math.sqrt(
        differences.reduce((sum, difference) => sum + difference * difference, 0) / differences.length
      );
    }

    try {
      await apiRequest('/api/video-sync/training-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyArcId: storyArcId || storyArc?.id,
          clipIds: Array.from(selectedSyncClips),
          referenceClipId: selected[0].id,
          autoOffsetSeconds: autoOffsets,
          autoConfidence: autoConfidences,
          manualOffsetSeconds: hasManualAdjustments ? manualOffsetsData : null,
          manualAdjustmentApplied: hasManualAdjustments,
          syncMethod: syncResults[Object.keys(syncResults)[0]]?.method || 'auto_local',
          cameraSetup,
          videoMetadata,
          originalAvgConfidence: avgConfidence,
          adjustmentMagnitude: hasManualAdjustments ? adjustmentMagnitude : 0,
        }),
      });
    } catch (error) {
      console.warn('Training data save skipped:', error);
    }

    const selectedIdSet = new Set(selected.map((clip) => clip.id));
    const startByClipId = selected.reduce<Record<string, number>>((accumulator, clip) => {
      accumulator[clip.id] = clip.start;
      return accumulator;
    }, {});

    const updatedClips = clips.map((clip) => {
      if (!selectedIdSet.has(clip.id)) {
        return clip;
      }
      const result = syncResults[clip.id];
      if (!result) {
        return clip;
      }

      const appliedOffset = manualOffsets[clip.id] ?? result.offset_seconds;
      return {
        ...clip,
        start: timelineEngine.snapToFrame(clip.start + appliedOffset),
        metadata: {
          ...(clip.metadata || {}),
          syncOffset: appliedOffset,
          syncConfidence: result.confidence,
          syncMethod: result.method || 'auto_local',
          originalAutoOffset: result.offset_seconds,
          manuallyAdjusted: Math.abs(appliedOffset - result.offset_seconds) > 0.01,
          syncDriftPpm: result.drift_ppm,
        },
      };
    });

    const finalClips = syncAllowClipReorder
      ? updatedClips
      : updatedClips.map((clip) => {
          if (!selectedIdSet.has(clip.id)) {
            return clip;
          }
          const baselineStart = startByClipId[clip.id] ?? clip.start;
          const sameTrackOrderedSelection = selected
            .filter((selectedClip) => selectedClip.trackId === clip.trackId)
            .sort((left, right) => left.start - right.start);
          const selectedIndex = sameTrackOrderedSelection.findIndex((candidate) => candidate.id === clip.id);
          if (selectedIndex <= 0) {
            return clip;
          }

          const predecessor = sameTrackOrderedSelection[selectedIndex - 1];
          const predecessorUpdated = updatedClips.find((item) => item.id === predecessor.id);
          if (!predecessorUpdated) {
            return clip;
          }

          if (clip.start >= predecessorUpdated.start + frameTime) {
            return clip;
          }

          const guardedStart = Math.max(
            baselineStart,
            timelineEngine.snapToFrame(predecessorUpdated.start + frameTime)
          );
          return {
            ...clip,
            start: guardedStart,
          };
        });

    applyClipUpdates(finalClips, new Set(selectedClips));
    setSnackbar({
      open: true,
      message: `Sync applied to ${selected.length} clips`,
      severity: 'success',
    });
    closeSyncDialog();
  }, [
    syncResults,
    clips,
    selectedSyncClips,
    clipMeta,
    storyArcId,
    storyArc?.id,
    manualOffsets,
    syncAllowClipReorder,
    frameTime,
    applyClipUpdates,
    selectedClips,
    closeSyncDialog,
  ]);

  const executeSyncClips = useCallback(async () => {
    if (selectedSyncClips.size < 2) {
      setSnackbar({
        open: true,
        message: 'Please select at least 2 clips to sync',
        severity: 'warning',
      });
      return;
    }

    const selected = clips.filter((clip) => selectedSyncClips.has(clip.id));
    if (selected.length < 2) {
      setSnackbar({
        open: true,
        message: 'Selected clips are no longer available',
        severity: 'warning',
      });
      return;
    }

    const referenceClip = selected[0];
    setSyncInProgress(true);
    setSyncJobId(syncUseServerFirst ? `server-${Date.now()}` : `local-${Date.now()}`);

    if (syncUseServerFirst) {
      try {
        const clipData = selected.map((clip) => ({
          id: clip.id,
          path: clip.sourceFile || '',
          type: clip.trackId?.includes('audio') ? 'audio' : 'video',
          camera: clipMeta[clip.id]?.camera || clip.metadata?.camera,
          syncGroup: clipMeta[clip.id]?.syncGroup || clip.metadata?.syncGroup,
        }));

        const jobResponse = await apiRequest('/api/video-sync/sync-clips', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storyArcId: storyArcId || storyArc?.id,
            clipIds: Array.from(selectedSyncClips),
            referenceClipId: referenceClip.id,
          }),
        });

        if (jobResponse.success) {
          await apiRequest('/api/video-sync/submit-clips', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jobId: jobResponse.jobId,
              clips: clipData,
            }),
          });

          const startedAt = Date.now();
          while (Date.now() - startedAt < 60_000) {
            const jobStatus = await apiRequest(`/api/video-sync/jobs/${jobResponse.jobId}`);
            if (jobStatus.job?.status === 'completed' && jobStatus.job.sync_results?.offsets) {
              const serverOffsets = jobStatus.job.sync_results.offsets as Record<string, EngineAudioSyncResult>;
              const initialManualOffsets: Record<string, number> = {};
              Object.entries(serverOffsets).forEach(([clipId, result]) => {
                initialManualOffsets[clipId] = result.offset_seconds || 0;
              });
              setSyncResults(serverOffsets);
              setManualOffsets(initialManualOffsets);
              setSyncPreviewMode(true);
              setSyncInProgress(false);
              setSnackbar({
                open: true,
                message: 'Server sync completed',
                severity: 'success',
              });
              return;
            }
            if (jobStatus.job?.status === 'error') {
              throw new Error(jobStatus.job.error || 'Server sync failed');
            }
            await new Promise<void>((resolve) => {
              setTimeout(() => resolve(), 2000);
            });
          }
          throw new Error('Server sync timed out');
        }
      } catch (error) {
        console.warn('Server sync unavailable, using local sync:', error);
      }
    }

    try {
      const localOffsets = await runLocalSync(selected, referenceClip);
      const initialManualOffsets: Record<string, number> = {};
      Object.entries(localOffsets).forEach(([clipId, result]) => {
        initialManualOffsets[clipId] = result.offset_seconds;
      });
      setSyncResults(localOffsets);
      setManualOffsets(initialManualOffsets);
      setSyncPreviewMode(true);
      setSnackbar({
        open: true,
        message: 'Local audio sync completed',
        severity: 'success',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown sync error';
      setSnackbar({
        open: true,
        message: `Sync error: ${message}`,
        severity: 'error',
      });
    } finally {
      setSyncInProgress(false);
    }
  }, [
    selectedSyncClips,
    clips,
    syncUseServerFirst,
    clipMeta,
    storyArcId,
    storyArc?.id,
    runLocalSync,
  ]);

  if (isLoading) {
    return (
      <ThemeProvider theme={storyArcStudioTheme}>
        <Box sx={{ 
          height: '100vh', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          bgcolor: 'background.default'
        }}>
          <Typography variant="h6" color="text.secondary">
            Loading Story Arc Studio...
          </Typography>
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={storyArcStudioTheme}>
      <Box 
        ref={containerRef}
        sx={{ 
          height: '100vh', 
          display: 'flex', 
          flexDirection: 'column',
          bgcolor: 'background.default',
          color: 'text.primary',
          overflow: 'hidden'
        }}
      >
        {/* Top AppBar */}
        <AppBar position="static" elevation={0}>
          <Toolbar variant="dense" sx={{ minHeight: 48 }}>
            {onClose && (
              <Button size="small" variant="outlined" onClick={onClose} sx={{ mr: 1 }}>
                Close
              </Button>
            )}
            <StoryArcStudioLogo width={120} height={120} variant="full" />
            {professionIcon && (
              <Box sx={{ color: professionColor, display: 'flex', alignItems: 'center', ml: 1 }}>
                {professionIcon}
              </Box>
            )}
            <Typography variant="h6" sx={{ 
              flexGrow: 1, 
              fontSize: 14, 
              fontWeight: 600,
              ml: 2,
              color: 'rgba(255,255,255,0.8)'
            }}>
              {enhancedProfessionConfig?.displayName || professionConfig?.displayName
                ? `${enhancedProfessionConfig?.displayName || professionConfig.displayName} - ${storyArc?.title || 'Unnamed Project'}`
                : (storyArc?.title || 'Unnamed Project')}
            </Typography>
            {selectedProject && (
              <Chip
                size="small"
                variant="outlined"
                label={`Project: ${selectedProject.name || selectedProject.projectName || selectedProject.id}`}
                sx={{ mr: 1 }}
              />
            )}
            <Avatar sx={{ width: 28, height: 28, mr: 1 }}>
              {String(currentUser?.email || currentUser?.id || 'U').charAt(0).toUpperCase()}
            </Avatar>
            
            {/* Professional Transport Controls */}
            <Stack direction="row" spacing={1} sx={{ mr: 2 }}>
              <Tooltip title="Toggle active monitor focus">
                <Chip
                  data-testid="active-monitor-chip"
                  size="small"
                  clickable
                  onClick={() =>
                    setActiveMonitor((previous) => (previous === 'source' ? 'program' : 'source'))
                  }
                  color={activeMonitor === 'source' ? 'secondary' : 'primary'}
                  variant="outlined"
                  label={`Active: ${activeMonitor === 'source' ? 'SRC' : 'PGM'}`}
                />
              </Tooltip>
              {/* Main Transport */}
              <ButtonGroup size="small">
                <Tooltip title={`Go to Start (Home) - ${activeMonitorLabel}`}>
                  <IconButton
                    data-testid="active-transport-home"
                    size="small"
                    onClick={handleActiveTransportStart}
                    disabled={!activeMonitorCanPlay}
                  >
                    <SkipPrevious fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={`Stop (Esc) - ${activeMonitorLabel}`}>
                  <IconButton
                    data-testid="active-transport-stop"
                    size="small"
                    onClick={handleActiveStop}
                    disabled={!activeMonitorCanPlay}
                  >
                    <Stop fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={`Play/Pause (Space) - ${activeMonitorLabel}`}>
                  <IconButton
                    data-testid="active-transport-play-pause"
                    size="small"
                    onClick={handleActivePlayPause}
                    disabled={!activeMonitorCanPlay}
                    sx={{ 
                      bgcolor: activeMonitorIsPlaying ? 'rgba(76, 175, 80, 0.2)' : 'transparent', '&:hover': {
                        bgcolor: activeMonitorIsPlaying ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255,255,255,0.1)'
                      }
                    }}
                  >
                    {activeMonitorIsPlaying ? <Pause fontSize="small" /> : <PlayArrow fontSize="small" />}
                  </IconButton>
                </Tooltip>
                <Tooltip title={`Go to End (End) - ${activeMonitorLabel}`}>
                  <IconButton
                    data-testid="active-transport-end"
                    size="small"
                    onClick={handleActiveTransportEnd}
                    disabled={!activeMonitorCanPlay}
                  >
                    <SkipNext fontSize="small" />
                  </IconButton>
                </Tooltip>
              </ButtonGroup>

              {/* Frame Navigation */}
              <ButtonGroup size="small">
                <Tooltip title={`Previous Frame (←) - ${activeMonitorLabel}`}>
                  <IconButton
                    data-testid="active-step-backward"
                    size="small"
                    onClick={handleActiveStepBackward}
                    disabled={!activeMonitorCanPlay}
                  >
                    <KeyboardArrowLeft fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={`Next Frame (→) - ${activeMonitorLabel}`}>
                  <IconButton
                    data-testid="active-step-forward"
                    size="small"
                    onClick={handleActiveStepForward}
                    disabled={!activeMonitorCanPlay}
                  >
                    <KeyboardArrowRight fontSize="small" />
                  </IconButton>
                </Tooltip>
              </ButtonGroup>

              {/* Professional J/K/L Controls */}
              <ButtonGroup size="small">
                <Tooltip title={`Reverse Play (J) - ${activeMonitorLabel}`}>
                  <IconButton 
                    data-testid="active-transport-j"
                    size="small" 
                    onClick={() => handleActiveJKL('j')}
                    disabled={!activeMonitorCanPlay}
                    sx={{
                      bgcolor:
                        activeMonitor === 'program' && isPlaying && playbackDirection === 'reverse'
                          ? 'rgba(255, 152, 0, 0.2)'
                          : 'transparent'
                    }}
                  >
                    <FastRewind fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={`Pause (K) - ${activeMonitorLabel}`}>
                  <IconButton
                    data-testid="active-transport-k"
                    size="small"
                    onClick={() => handleActiveJKL('k')}
                    disabled={!activeMonitorCanPlay}
                  >
                    <Pause fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={`Forward Play (L) - ${activeMonitorLabel}`}>
                  <IconButton 
                    data-testid="active-transport-l"
                    size="small" 
                    onClick={() => handleActiveJKL('l')}
                    disabled={!activeMonitorCanPlay}
                    sx={{
                      bgcolor:
                        activeMonitor === 'program' && isPlaying && playbackDirection === 'forward'
                          ? 'rgba(76, 175, 80, 0.2)'
                          : 'transparent'
                    }}
                  >
                    <FastForward fontSize="small" />
                  </IconButton>
                </Tooltip>
              </ButtonGroup>

              <ButtonGroup size="small" variant="outlined">
                <Button
                  data-testid="active-mark-in"
                  size="small"
                  onClick={handleActiveMarkIn}
                  disabled={!activeMonitorCanPlay}
                >
                  I
                </Button>
                <Button
                  data-testid="active-mark-out"
                  size="small"
                  onClick={handleActiveMarkOut}
                  disabled={!activeMonitorCanPlay}
                >
                  O
                </Button>
                <IconButton
                  data-testid="active-jump-mark-in"
                  size="small"
                  onClick={handleActiveJumpMarkIn}
                  disabled={activeMonitor === 'source' ? sourceMarkIn === null : programMarkIn === null}
                >
                  <SkipPrevious fontSize="small" />
                </IconButton>
                <IconButton
                  data-testid="active-jump-mark-out"
                  size="small"
                  onClick={handleActiveJumpMarkOut}
                  disabled={activeMonitor === 'source' ? sourceMarkOut === null : programMarkOut === null}
                >
                  <SkipNext fontSize="small" />
                </IconButton>
              </ButtonGroup>

              {/* Loop Control */}
              <Tooltip title="Loop Playback">
                <IconButton 
                  size="small" 
                  onClick={() => setIsLooping(!isLooping)}
                  sx={{
                    bgcolor: isLooping ? 'rgba(63, 81, 181, 0.2)' : 'transparent'
                  }}
                >
                  <Loop fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Toggle Fullscreen Monitor">
                <IconButton
                  size="small"
                  onClick={() => setIsFullscreenPreview((previous) => !previous)}
                  sx={{ bgcolor: isFullscreenPreview ? 'rgba(59, 130, 246, 0.2)' : 'transparent' }}
                >
                  <Fullscreen fontSize="small" />
                </IconButton>
              </Tooltip>

              {/* Speed Indicator */}
              {playbackSpeed !== 1 && (
                <Chip 
                  icon={<Speed />}
                  label={`${playbackSpeed}x ${playbackDirection === 'reverse' ? '←' : '→'}`}
                  size="small"
                  sx={{ 
                    height: 28,
                    bgcolor: playbackDirection === 'reverse' ? 'rgba(255, 152, 0, 0.2)' : 'rgba(76, 175, 80, 0.2)',
                    color: 'text.primary'
                  }}
                />
              )}
            </Stack>

            {/* Action Buttons */}
            <Stack direction="row" spacing={1} alignItems="center">
              {isSupported && (
                <Tooltip title="Push-varsler innstillinger">
                  <IconButton 
                    size="small" 
                    onClick={() => setPushSettingsOpen(true)}
                    sx={{ color: pushEnabled ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.7)' }}
                  >
                    {pushEnabled ? <NotificationsActive /> : <Notifications />}
                  </IconButton>
                </Tooltip>
              )}
              {/* Save status */}
              <Chip
                size="small"
                label={
                  saveStatus === 'saving'
                    ? 'Saving…'
                    : saveStatus === 'saved'
                      ? `${lastSavedAt ? `Saved ${formatRelativeTime(lastSavedAt)}` : 'Saved'}${savedVia ? ` (${savedVia})` : ''}`
                      : saveStatus === 'error'
                        ? `Save error${saveError ? `: ${saveError}` : ''}`
                        : 'Idle'
                }
                color={saveStatus === 'error' ? 'error' : saveStatus === 'saved' ? 'success' : 'default'}
                variant="outlined"
              />
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  void handleImportFromProject();
                }}
              >
                Import Project
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  void handleExportToProject({
                    url: programMonitorClip?.sourceFile || '',
                    duration: totalDuration,
                    format: 'mp4',
                    resolution: '1920x1080',
                    codec: 'H.264',
                  });
                }}
                disabled={!programMonitorClip?.sourceFile}
              >
                Export to Project
              </Button>
              <Button size="small" variant="outlined" onClick={() => setOnboardingOpen(true)}>Onboarding</Button>
              {/* Search & filter */}
              <TextField size="small" placeholder="Search tags, scene, name…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} sx={{ minWidth: 220 }} />
              <TextField size="small" placeholder="Filter tags (comma)" onBlur={(e) => setFilterTags(e.target.value.split(',').map(s => s.trim()).filter(Boolean))} sx={{ minWidth: 180 }} />
              {/* AI Story Generator - NEW! */}
              <Tooltip title="AI Story Generator - Upload video and auto-create timeline">
                <Button
                  size="small"
                  onClick={() => setShowAIGeneratorDialog(true)}
                  sx={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white','&:hover': {
                      background: 'linear-gradient(135deg, #5568d3 0%, #6a4293 100%)'
                    },
                    minWidth: 140
                  }}
                  startIcon={<AutoFixHighIcon />}
                >
                  AI Generate
                </Button>
              </Tooltip>
              
              {/* Face Detection Worker */}
              <Tooltip title="Detect faces in all clips (background worker)">
                <Button
                  size="small"
                  onClick={async () => {
                    if (faceDetectionRunning) {
                      faceDetectionWorker.cancel();
                      setFaceDetectionRunning(false);
                      return;
                    }
                    
                    setFaceDetectionRunning(true);
                    setShowFaceDetectionDialog(true);
                    setFaceDetectionProgress({
                      total: clips.length,
                      processed: 0,
                      current: null,
                      results: [],
                      errors: [],
                    });
                    
                    try {
                      // Ask user for analysis options via dialog
                      const userOptions = await new Promise<{ scanEntire: boolean; fps: number; taskChoice: string } | null>((resolve) => {
                        setPendingFaceDetectionResolve(() => resolve);
                        setFaceDetectionOptions({ scanEntire: false, fps: 0.5, taskChoice: '1' });
                        setShowFaceDetectionOptionsDialog(true);
                      });
                      
                      if (!userOptions) {
                        // User cancelled
                        setFaceDetectionRunning(false);
                        setShowFaceDetectionDialog(false);
                        return;
                      }
                      
                      const { scanEntire, fps, taskChoice } = userOptions;
                      
                      let tasks: 'all' | 'parsing' | 'landmarks' | 'headpose' | 'attributes' | Array<'parsing' | 'landmarks' | 'headpose' | 'attributes'> = 'all';
                      
                      if (taskChoice) {
                        const choice = taskChoice.trim().toLowerCase();
                        if (choice === '1' || choice === 'all') {
                          tasks = 'all';
                        } else if (choice === '2' || choice === 'parsing') {
                          tasks = 'parsing';
                        } else if (choice === '3' || choice === 'landmarks') {
                          tasks = 'landmarks';
                        } else if (choice === '4' || choice === 'headpose') {
                          tasks = 'headpose';
                        } else if (choice === '5' || choice === 'attributes') {
                          tasks = 'attributes';
                        } else if (choice === '6' || choice.includes(',')) {
                          // Custom: parse comma-separated tasks
                          const taskList = choice.split(',').map(t => t.trim() as 'parsing' | 'landmarks' | 'headpose' | 'attributes').filter(Boolean);
                          if (taskList.length > 0) {
                            tasks = taskList;
                          }
                        }
                      }
                      
                      const results: FaceDetectionResult[] = await faceDetectionWorker.processClips(
                        clips.map(c => ({
                          id: c.id,
                          sourceFile: c.sourceFile || '',
                          duration: c.duration || 5,
                        })),
                        {
                          batchSize: scanEntire ? 1 : 3, // Process one at a time for full scans
                          scanEntireVideo: scanEntire,
                          framesPerSecond: fps,
                          tasks, // Pass selected tasks
                          onProgress: (progress) => {
                            setFaceDetectionProgress(progress);
                            
                            // Auto-update clip metadata with comprehensive face detection results
                            progress.results.forEach(result => {
                              setClipMeta(prev => ({
                                ...prev,
                                [result.clipId]: {
                                  ...prev[result.clipId],
                                  faceDetection: {
                                    hasFace: result.hasFace,
                                    faceCount: result.faceCount,
                                    confidence: result.confidence,
                                    analyzedAt: Date.now(),
                                    comprehensiveAnalysis: result.comprehensiveAnalysis,
                                    bestTimestamp: result.timestamp,
                                    scanMetadata: result.scanMetadata,
                                  },
                                  tags: [
                                    ...(prev[result.clipId]?.tags || []),
                                    ...(result.hasFace && !prev[result.clipId]?.tags?.includes('face') ? ['face'] : []),
                                    // Add task-specific tags
                                    ...(result.comprehensiveAnalysis?.landmarks ? (prev[result.clipId]?.tags?.includes('landmarks') ? [] : ['landmarks']) : []),
                                    ...(result.comprehensiveAnalysis?.headpose ? (prev[result.clipId]?.tags?.includes('headpose') ? [] : ['headpose']) : []),
                                    ...(result.comprehensiveAnalysis?.parsing ? (prev[result.clipId]?.tags?.includes('parsing') ? [] : ['parsing']) : []),
                                    ...(result.comprehensiveAnalysis?.attributes ? (prev[result.clipId]?.tags?.includes('attributes') ? [] : ['attributes']) : []),
                                  ],
                                },
                              }));
                            });
                          },
                        }
                      );
                      
                      // Final update with comprehensive analysis and visual indicators
                      results.forEach(result => {
                        setClipMeta(prev => ({
                          ...prev,
                          [result.clipId]: {
                            ...prev[result.clipId],
                            faceDetection: {
                              hasFace: result.hasFace,
                              faceCount: result.faceCount,
                              confidence: result.confidence,
                              analyzedAt: Date.now(),
                              comprehensiveAnalysis: result.comprehensiveAnalysis,
                              bestTimestamp: result.timestamp,
                              scanMetadata: result.scanMetadata,
                            },
                            tags: [
                              ...(prev[result.clipId]?.tags || []),
                              ...(result.hasFace && !prev[result.clipId]?.tags?.includes('face') ? ['face'] : []),
                              // Add task-specific tags
                              ...(result.comprehensiveAnalysis?.landmarks ? (prev[result.clipId]?.tags?.includes('landmarks') ? [] : ['landmarks']) : []),
                              ...(result.comprehensiveAnalysis?.headpose ? (prev[result.clipId]?.tags?.includes('headpose') ? [] : ['headpose']) : []),
                              ...(result.comprehensiveAnalysis?.parsing ? (prev[result.clipId]?.tags?.includes('parsing') ? [] : ['parsing']) : []),
                              ...(result.comprehensiveAnalysis?.attributes ? (prev[result.clipId]?.tags?.includes('attributes') ? [] : ['attributes']) : []),
                            ],
                          },
                        }));
                        
                        // Update clip color to indicate face detection
                        if (result.hasFace) {
                          setClips(prev => prev.map(c => 
                            c.id === result.clipId 
                              ? { ...c, color: '#10b981' } // Green for face detected
                              : c
                          ));
                        }
                      });
                      
                      // Add timeline markers for face detections
                      const faceMarkers: TimelineMarker[] = [];
                      results.forEach(result => {
                        const clip = clips.find(c => c.id === result.clipId);
                        if (!clip) return;
                        
                        if (result.hasFace && result.scanMetadata) {
                          // Add markers for each face-detected timestamp (sample every few to avoid too many markers)
                          const faceTimestamps = result.scanMetadata.timestamps
                            .filter(t => t.hasFace)
                            .map(t => t.timestamp);
                          
                          // Sample markers: one per segment or max 20 markers per clip
                          const sampledTimestamps = faceTimestamps.length > 20
                            ? faceTimestamps.filter((_, idx) => idx % Math.ceil(faceTimestamps.length / 20) === 0)
                            : faceTimestamps;
                          
                          sampledTimestamps.forEach((timestamp, idx) => {
                            const absoluteTime = clip.start + timestamp;
                            faceMarkers.push({
                              id: `face_${result.clipId}_${idx}_${Date.now()}`,
                              time: absoluteTime,
                              color: '#10b981', // Green for face detected
                              label: `Face @ ${timestamp.toFixed(1)}s`,
                            });
                          });
                        } else if (result.hasFace && result.timestamp !== undefined) {
                          // Single best timestamp marker
                          const absoluteTime = clip.start + result.timestamp;
                          faceMarkers.push({
                            id: `face_${result.clipId}_${Date.now()}`,
                            time: absoluteTime,
                            color: '#10b981',
                            label: `Face @ ${result.timestamp.toFixed(1)}s`,
                          });
                        }
                      });
                      
                      if (faceMarkers.length > 0) {
                        setMarkers(prev => [...prev, ...faceMarkers]);
                      }
                      
                      // Ask if user wants to auto-create sub-clips from face-detected segments via dialog
                      const facesFound = results.filter(r => r.hasFace).length;
                      const createSubclips = await new Promise<boolean>((resolve) => {
                        setPendingSubclipsResolve(() => resolve);
                        setSubclipsConfirmData({ facesFound, totalClips: results.length });
                        setShowSubclipsConfirmDialog(true);
                      });
                      
                      if (createSubclips) {
                        // Auto-create sub-clips from face-detected segments
                        let newClips: BeatClip[] = [...clips];
                        const clipsToProcess = results.filter(r => r.hasFace && r.scanMetadata);
                        
                        for (const result of clipsToProcess) {
                          const originalClip = clips.find(c => c.id === result.clipId);
                          if (!originalClip || !result.scanMetadata) continue;
                          
                          // Group consecutive face detections into segments
                          const segments = groupFaceDetectionsIntoSegments(
                            result.scanMetadata.timestamps.filter(t => t.hasFace).map(t => t.timestamp),
                            originalClip.duration
                          );
                          
                          if (segments.length > 0) {
                            // Remove original clip and add sub-clips
                            newClips = newClips.filter(c => c.id !== result.clipId);
                            
                            segments.forEach((segment, segIdx) => {
                              const subClip: BeatClip = {
                                ...originalClip,
                                id: `${result.clipId}_face_segment_${segIdx}_${Date.now()}`,
                                start: originalClip.start + segment.start,
                                duration: segment.duration,
                                name: `${originalClip.name || 'Clip'} - Face Segment ${segIdx + 1}`,
                                synopsis: `Auto-extracted face segment (${segment.start.toFixed(1)}s - ${(segment.start + segment.duration).toFixed(1)}s)`,
                                color: '#10b981', // Green to indicate face-detected segment
                                // Preserve source file and add offset for sub-clip
                                sourceFile: originalClip.sourceFile,
                                metadata: {
                                  ...originalClip.metadata,
                                  sourceStartTime:
                                    (typeof originalClip.metadata?.sourceStartTime === 'number'
                                      ? originalClip.metadata.sourceStartTime
                                      : 0) + segment.start,
                                },
                              };
                              newClips.push(subClip);
                            });
                          }
                        }
                        
                        const hydratedDetectedClips = hydrateClipSources(newClips);
                        setClips(hydratedDetectedClips);
                        setAvailableVideoSources((prev) => {
                          const merged = new Set([...prev, ...extractRenderableVideoSources(hydratedDetectedClips)]);
                          return Array.from(merged);
                        });
                        setTotalDuration(Math.max(...hydratedDetectedClips.map(c => c.start + c.duration), totalDuration));
                        
                        // Update timeline engine
                        videoEngine.setTimeline(
                          hydratedDetectedClips,
                          tracks,
                          Math.max(...hydratedDetectedClips.map(c => c.start + c.duration), totalDuration)
                        );
                        
                        setSnackbar({
                          open: true,
                          message: `Created ${clipsToProcess.reduce((sum, r) => {
                            const segments = groupFaceDetectionsIntoSegments(
                              r.scanMetadata!.timestamps.filter(t => t.hasFace).map(t => t.timestamp),
                              clips.find(c => c.id === r.clipId)?.duration || 0
                            );
                            return sum + segments.length;
                          }, 0)} sub-clips from face-detected segments`,
                          severity: 'success',
                        });
                      } else {
                        setSnackbar({
                          open: true,
                          message: `Face detection complete! Found faces in ${results.filter(r => r.hasFace).length} of ${results.length} clips. ${faceMarkers.length} markers added to timeline.`,
                          severity: 'success',
                        });
                      }
                    } catch (error: any) {
                      setSnackbar({
                        open: true,
                        message: `Face detection, error: ${error?.message || 'Unknown error'}`,
                        severity: 'error',
                      });
                    } finally {
                      setFaceDetectionRunning(false);
                    }
                  }}
                  sx={{
                    borderColor: faceDetectionRunning ? '#ef4444' : '#10b981',
                    color: faceDetectionRunning ? '#ef4444' : '#10b981','&:hover': {
                      borderColor: faceDetectionRunning ? '#dc2626' : '#059669',
                      bgcolor: faceDetectionRunning ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                    }}}
                  startIcon={faceDetectionRunning ? <Stop fontSize="small" /> : <FaceIcon />}
                >
                  {faceDetectionRunning ? 'Stop Detection' : 'Detect Faces'}
                </Button>
              </Tooltip>
              
              {/* Professional Features */}
              <ButtonGroup size="small">
                <Tooltip title="Transitions (485) - Press T">
                  <IconButton onClick={() => setShowTransitionLibrary(true)}>
                    <GridView fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Speed Ramp - Press R">
                  <IconButton
                    onClick={() => setShowSpeedRampPanel((previous) => !previous)}
                    color={showSpeedRampPanel ? 'primary' : 'default'}
                  >
                    <Speed fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Text Overlays - Press T">
                  <IconButton onClick={() => setShowTextOverlayPanel(true)}>
                    <TextFields fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="GPU Filters - Press F">
                  <IconButton onClick={() => setShowGPUFiltersPanel(true)}>
                    <FilterVintage fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Color Grading - Press C">
                  <IconButton onClick={() => setShowColorGradingPanel(true)}>
                    <Palette fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Auto-Captions (80+ languages)">
                  <IconButton
                    onClick={() => setShowAutoCaptionsPanel(true)}
                    aria-label="Open auto captions"
                    data-testid="open-auto-captions"
                  >
                    <Subtitles fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Beat Sync">
                  <IconButton onClick={() => setShowBeatSyncPanel(true)}>
                    <MusicNote fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Motion Tracking (SAM 2 AI)">
                  <IconButton onClick={() => setShowMotionTrackingPanel(true)}>
                    <GpsFixed fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Detect Scenes">
                  <IconButton 
                    onClick={async () => {
                      const videoClip = clips.find((clip) => isRenderableVideoClip(clip));
                      const videoPath =
                        videoClip?.sourceFile ||
                        sourcePreviewClip?.sourceFile ||
                        programMonitorClip?.sourceFile ||
                        activeSourcePreview?.sourceFile ||
                        availableVideoSources[0] ||
                        '';

                      if (!videoPath) {
                        setSnackbar({
                          open: true,
                          message: 'No video source found for scene detection',
                          severity: 'warning',
                        });
                        return;
                      }
                      
                      try {
                        setShowSceneDetectionDialog(true);
                        const response = await apiRequest('/api/video-analysis/scene-detection', {
                          method: 'POST',
                          headers: { 'Content-Type' : 'application/json' },
                          body: JSON.stringify({
                            video_path: videoPath,
                            threshold: 30.0,
                            min_scene_len: 15,
                          }),
                        });
                        
                        if (response.success) {
                          setSceneDetectionJobId(response.job_id);
                          // Poll for results
                          const pollInterval = setInterval(async () => {
                            try {
                              const statusResponse = await apiRequest(`/api/video-analysis/scene-detection/${response.job_id}`);
                              setSceneDetectionProgress(statusResponse);
                              
                              if (statusResponse.status === 'completed') {
                                clearInterval(pollInterval);
                                const scenes = statusResponse.result?.result?.scenes || [];
                                // Add scene markers to timeline
                                const newMarkers = scenes.map((scene: any, idx: number) => ({
                                  id: `scene-${idx}`,
                                  time: scene.start_time,
                                  color: '#667eea',
                                  label: `Scene ${scene.scene_number}`,
                                }));
                                setMarkers([...markers, ...newMarkers]);
                                setSnackbar({
                                  open: true,
                                  message: `Detected ${scenes.length} scenes and added markers to timeline`,
                                  severity: 'success',
                                });
                              } else if (statusResponse.status === 'failed') {
                                clearInterval(pollInterval);
                                setSnackbar({
                                  open: true,
                                  message: `Scene detection failed: ${statusResponse.error}`,
                                  severity: 'error',
                                });
                              }
                            } catch (error: any) {
                              console.error('Error polling scene detection:', error);
                            }
                          }, 2000);
                        }
                      } catch (error: any) {
                        setSnackbar({
                          open: true,
                          message: `Scene detection error: ${error?.message || 'Unknown error'}`,
                          severity: 'error',
                        });
                      }
                    }}
                  >
                    <MovieFilter fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Sync Multi-Angle Clips">
                  <IconButton 
                    data-testid="open-sync-dialog"
                    onClick={openSyncDialog}
                    disabled={clips.length < 2}
                  >
                    <Sync fontSize="small" />
                  </IconButton>
                </Tooltip>
              </ButtonGroup>
              
              <ButtonGroup size="small">
                <Tooltip title="Save (Ctrl+S)">
                  <IconButton size="small">
                    <Save fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Export (Browser ffmpeg)">
                  <IconButton 
                    size="small"
                    onClick={() => setShowExportDialog(true)}
                  >
                    <FileDownload fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Export to DaVinci Resolve + Scripts">
                  <Button
                    size="small"
                    onClick={() => setShowResolveExportDialog(true)}
                    sx={{
                      background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
                      color: 'white','&:hover': {
                        background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)'
                      },
                      minWidth: 120
                    }}
                  >
                    DaVinci Resolve
                  </Button>
                </Tooltip>
                <Tooltip title="Settings">
                  <IconButton size="small" onClick={() => setSettingsOpen(true)}>
                    <Settings fontSize="small" />
                  </IconButton>
                </Tooltip>
              </ButtonGroup>

              {/* Pro toggles */}
              <Button size="small" variant={magneticEnabled ? 'contained' : 'outlined'} onClick={() => setMagneticEnabled(v => !v)}>Magnetic</Button>
              <Button size="small" variant={rippleEnabled ? 'contained' : 'outlined'} onClick={() => setRippleEnabled(v => !v)}>Ripple</Button>
              <Button size="small" variant={reviewerMode ? 'contained' : 'outlined'} onClick={() => setReviewerMode(v => !v)}>{reviewerMode ? 'Reviewer: ON' : 'Reviewer: OFF'}</Button>
              <Button size="small" variant={compareMode ? 'contained' : 'outlined'} onClick={() => {
                if (!compareMode) setCompareSnapshot(clips);
                setCompareMode(v => !v);
              }}>{compareMode ? 'Compare: ON' : 'Compare: OFF'}</Button>
              <Button size="small" onClick={() => {
                const id = 'm' + Date.now();
                setMarkers(prev => [...prev, { id, time: currentTime, color: '#ff9800', label: `Marker ${prev.length + 1}` }]);
              }}>Add Marker</Button>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="caption" color="text.secondary">V-Zoom</Typography>
                <Slider size="small" value={trackHeightScale} min={0.5} max={2} step={0.1} sx={{ width: 100 }} onChange={(_, v) => setTrackHeightScale(v as number)} />
              </Stack>
              {pendingTransitionType && (
                <Button size="small" variant="outlined" onClick={() => {
                  const firstSelected = Array.from(selectedClips)[0];
                  const preferredTrackId = firstSelected ? (clipMap.get(firstSelected)?.trackId || undefined) : undefined;
                  const { time: placeTime, trackId } = findNearestCut(clips, tracks, currentTime, preferredTrackId);
                  const id = 'tr' + Date.now();
                  setTransitions(prev => [
                    ...prev,
                    {
                      id,
                      time: placeTime,
                      trackId,
                      type: pendingTransitionType,
                      duration: pendingTransitionDuration,
                    },
                  ]);
                  setSnackbar({
                    open: true,
                    message: `Placed ${pendingTransitionType} (${pendingTransitionEngine.toUpperCase()}, ${pendingTransitionDuration.toFixed(2)}s)`,
                    severity: 'success',
                  });
                  setPendingTransitionType(null);
                }}>
                  Place {pendingTransitionType} ({pendingTransitionEngine.toUpperCase()} • {pendingTransitionDuration.toFixed(2)}s)
                </Button>
              )}
            </Stack>
          </Toolbar>
        </AppBar>

        {(timelineErrors.length > 0 || timelineWarnings.length > 0) && (
          <Box sx={{ px: 2, py: 1 }}>
            {timelineErrors.length > 0 && (
              <Alert severity="error" sx={{ mb: timelineWarnings.length > 0 ? 1 : 0 }}>
                {timelineErrors[0]}
              </Alert>
            )}
            {timelineWarnings.length > 0 && (
              <Alert severity="warning">
                {timelineWarnings[0]}
              </Alert>
            )}
          </Box>
        )}

        {/* Drive initialization status */}
        {driveInit.status !== 'ready' && (
          <Box sx={{ px: 2, py: 1 }}>
            {driveInit.status === 'initializing' && (
              <Alert severity="info">Initializing Google Drive workspace…</Alert>
            )}
            {driveInit.status === 'needs_auth' && (
              <Alert severity="warning" action={
                <Button component="a" href="/api/auth/google?next=/story-arc/studio" color="inherit" size="small">Sign in</Button>
              }>
                {driveInit.message || 'Please sign in to continue.'}
              </Alert>
            )}
            {driveInit.status === 'needs_google_connect' && (
              <Alert severity="warning" action={
                <Button component="a" href="/api/auth/google?next=/story-arc/studio" color="inherit" size="small">Connect Google</Button>
              }>
                {driveInit.message || 'Connect your Google Drive to continue.'}
              </Alert>
            )}
            {driveInit.status === 'error' && (
              <Alert severity="error" action={
                <Button onClick={initStudio} color="inherit" size="small">Retry</Button>
              }>
                {driveInit.message || 'Initialization failed'}
              </Alert>
            )}
          </Box>
        )}
        {driveInit.status === 'ready' && monitorFolderLink && (
          <Box sx={{ px: 2, py: 1 }}>
            <Alert severity="success" action={
              <Button component="a" href={monitorFolderLink} target="_blank" rel="noreferrer" color="inherit" size="small">Open folder</Button>
            }>
              Google Drive monitor folder is ready.
            </Alert>
          </Box>
        )}

        {/* Toolbar */}
        <Paper 
          elevation={0}
          sx={{ 
            borderBottom: 1, 
            borderColor: 'divider',
            px: 2,
            py: 1,
            bgcolor: 'background.paper'
          }}
        >
          <Stack direction="row" spacing={2} alignItems="center">
            <ButtonGroup size="small" variant="outlined">
              <Tooltip title="Workspace Presets">
                <IconButton size="small" disabled>
                  <AccountTree fontSize="small" />
                </IconButton>
              </Tooltip>
              <Button
                size="small"
                variant={workspacePreset === 'edit' ? 'contained' : 'outlined'}
                onClick={() => applyWorkspacePreset('edit')}
              >
                Edit
              </Button>
              <Button
                size="small"
                variant={workspacePreset === 'cut' ? 'contained' : 'outlined'}
                onClick={() => applyWorkspacePreset('cut')}
              >
                Cut
              </Button>
              <Button
                size="small"
                variant={workspacePreset === 'color' ? 'contained' : 'outlined'}
                onClick={() => applyWorkspacePreset('color')}
              >
                Color
              </Button>
              <Button
                size="small"
                variant={workspacePreset === 'fairlight' ? 'contained' : 'outlined'}
                onClick={() => applyWorkspacePreset('fairlight')}
              >
                Fairlight
              </Button>
            </ButtonGroup>

            <Divider orientation="vertical" flexItem />

            <ButtonGroup size="small" variant="outlined">
              <Tooltip title="Panel Docking">
                <IconButton size="small" disabled>
                  <LinkIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Button
                size="small"
                variant={showAssetPanel ? 'contained' : 'outlined'}
                onClick={() => setShowAssetPanel((previous) => !previous)}
              >
                Bin
              </Button>
              <Button
                size="small"
                variant={showEffectsPanel ? 'contained' : 'outlined'}
                onClick={() => setShowEffectsPanel((previous) => !previous)}
              >
                Effects
              </Button>
              <Button
                size="small"
                variant={showMixerPanel ? 'contained' : 'outlined'}
                onClick={() => setShowMixerPanel((previous) => !previous)}
              >
                Mixer
              </Button>
              <Button
                size="small"
                variant={showInspectorPanel ? 'contained' : 'outlined'}
                onClick={() => setShowInspectorPanel((previous) => !previous)}
              >
                Inspector
              </Button>
            </ButtonGroup>

            <ButtonGroup size="small" variant="outlined">
              <Tooltip title="Load docking slots">
                <IconButton size="small" disabled>
                  <Save fontSize="small" />
                </IconButton>
              </Tooltip>
              <Button size="small" onClick={() => loadDockSlot('dock-1')}>
                Dock 1
              </Button>
              <Button size="small" onClick={() => loadDockSlot('dock-2')}>
                Dock 2
              </Button>
              <Button size="small" onClick={() => loadDockSlot('dock-3')}>
                Dock 3
              </Button>
            </ButtonGroup>

            <ButtonGroup size="small" variant="outlined">
              <Button size="small" onClick={() => saveDockSlot('dock-1')}>
                Save 1
              </Button>
              <Button size="small" onClick={() => saveDockSlot('dock-2')}>
                Save 2
              </Button>
              <Button size="small" onClick={() => saveDockSlot('dock-3')}>
                Save 3
              </Button>
              <Button size="small" color="warning" onClick={resetResolveLayout}>
                Reset Layout
              </Button>
            </ButtonGroup>

            <Divider orientation="vertical" flexItem />

            <ButtonGroup size="small" variant="outlined">
              <Button
                size="small"
                variant={editTool === 'select' ? 'contained' : 'outlined'}
                onClick={() => setEditTool('select')}
              >
                Select (A)
              </Button>
              <Button
                size="small"
                variant={editTool === 'trim' ? 'contained' : 'outlined'}
                onClick={() => setEditTool('trim')}
              >
                Trim (T)
              </Button>
              <Button
                size="small"
                variant={editTool === 'roll' ? 'contained' : 'outlined'}
                onClick={() => setEditTool('roll')}
              >
                Roll (R)
              </Button>
              <Button
                size="small"
                variant={editTool === 'slip' ? 'contained' : 'outlined'}
                onClick={() => setEditTool('slip')}
              >
                Slip (Y)
              </Button>
              <Button
                size="small"
                variant={editTool === 'slide' ? 'contained' : 'outlined'}
                onClick={() => setEditTool('slide')}
              >
                Slide (U)
              </Button>
            </ButtonGroup>

            {/* Edit Tools */}
            <ButtonGroup size="small">
              <Tooltip title="Undo (Ctrl+Z)">
                <IconButton size="small" onClick={performUndo} disabled={undoStack.length === 0}>
                  <Undo fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Redo (Ctrl+Y)">
                <IconButton size="small" onClick={performRedo} disabled={redoStack.length === 0}>
                  <Redo fontSize="small" />
                </IconButton>
              </Tooltip>
            </ButtonGroup>

            <Divider orientation="vertical" flexItem />

            {/* Clip Tools */}
            <ButtonGroup size="small">
              <Tooltip title="Cut (Ctrl+X)">
                <IconButton size="small" onClick={cutSelectedClips} disabled={selectedClips.size === 0}>
                  <ContentCut fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Copy (Ctrl+C)">
                <IconButton size="small" onClick={copySelectedClips} disabled={selectedClips.size === 0}>
                  <ContentCopy fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Paste (Ctrl+V)">
                <IconButton size="small" onClick={pasteClipboardClips} disabled={clipClipboard.length === 0}>
                  <ContentPaste fontSize="small" />
                </IconButton>
              </Tooltip>
            </ButtonGroup>

            <ButtonGroup size="small" variant="outlined">
              <Button
                size="small"
                data-testid="select-playhead-clip-button"
                onClick={selectClipUnderPlayhead}
              >
                Select @Playhead (D)
              </Button>
              <Button
                size="small"
                data-testid="razor-selected-button"
                onClick={razorSelectedAtPlayhead}
                disabled={selectedClips.size === 0}
              >
                Razor (C)
              </Button>
              <Button
                size="small"
                data-testid="lift-selected-button"
                onClick={liftSelectedClips}
                disabled={selectedClips.size === 0}
              >
                Lift (;)
              </Button>
              <Button
                size="small"
                data-testid="extract-selected-button"
                onClick={extractSelectedClips}
                disabled={selectedClips.size === 0}
              >
                Extract (')
              </Button>
            </ButtonGroup>

            <Divider orientation="vertical" flexItem />

            {/* Zoom Controls */}
            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 200 }}>
              <IconButton size="small" onClick={() => setTimelineZoom(Math.max(0.1, timelineZoom - 0.1))}>
                <ZoomOut fontSize="small" />
              </IconButton>
              <Slider
                value={timelineZoom}
                onChange={handleZoomChange}
                min={0.1}
                max={5}
                step={0.1}
                size="small"
                sx={{ mx: 1, width: 100 }}
              />
              <IconButton size="small" onClick={() => setTimelineZoom(Math.min(5, timelineZoom + 0.1))}>
                <ZoomIn fontSize="small" />
              </IconButton>
              <Typography variant="caption" sx={{ minWidth: 40, textAlign: 'center' }}>
                {Math.round(timelineZoom * 100)}%
              </Typography>
            </Stack>

            <Divider orientation="vertical" flexItem />

            {/* AI Audio Mix Button */}
            <Tooltip title="AI Audio Assistant - Automatic mixing">
              <Button
                size="small"
                variant="outlined"
                startIcon={<AutoFixHigh />}
                onClick={() => {
                  // Get all audio clips from timeline
                  const audioClips = clips.filter(c => c.trackId?.startsWith('A') || c.trackId?.startsWith('audio'));
                  if (audioClips.length === 0) {
                    setSnackbar({
                      open: true,
                      message: 'Ingen lydspor funnet i tidslinjen',
                      severity: 'warning'
                    });
                    return;
                  }
                  setSelectedAudioTrackId(null);
                  setOpenMixerDirectly(false);
                  setShowAIAudioAssistant(true);
                }}
                sx={{
                  borderColor: '#9333ea',
                  color: '#9333ea','&:hover': {
                    borderColor: '#7e22ce',
                    bgcolor: 'rgba(147, 51, 234, 0.1)'
                  }
                }}
              >
                AI Mix
              </Button>
            </Tooltip>

            <Box sx={{ flexGrow: 1 }} />

            {/* Timecode Display */}
            <Stack direction="row" spacing={2} alignItems="center">
              <Box sx={{
                px: 2,
                py: 0.5,
                bgcolor: 'rgba(0,0,0,0.3)',
                borderRadius: 1,
                border: '1px solid rgba(255,255,255,0.1)',
                fontFamily: 'monospace'
              }}>
                <Typography variant="caption" sx={{ color: 'text.primary', fontSize: 12 }}>
                  {formatTimecode(currentTime)} / {formatTimecode(totalDuration)}
                </Typography>
              </Box>
              
              {isPlaying && (
                <Chip 
                  label={isLooping ? "LOOP" : "PLAY"}
                  size="small"
                  sx={{
                    bgcolor: isLooping ? 'rgba(63, 81, 181, 0.3)' : 'rgba(76, 175, 80, 0.3)',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: 10
                  }}
                />
              )}
            </Stack>

            {/* View Options */}
            <ButtonGroup size="small">
              <Tooltip title="Grid View">
                <IconButton size="small">
                  <GridView fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Timeline View">
                <IconButton size="small">
                  <TimelineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </ButtonGroup>
          </Stack>
        </Paper>

        {/* Main Content Area */}
        <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {showAssetPanel && (
            <>
              {/* Left Panel - Asset Browser */}
              <Paper 
                elevation={0}
                sx={{ 
                  width: panelSizes.leftPanel,
                  borderRight: 1,
                  borderColor: 'divider',
                  display: 'flex',
                  flexDirection: 'column',
                  bgcolor: 'background.paper'
                }}
              >
                <Box
                  sx={{
                    p: 2,
                    borderBottom: 1,
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                  }}
                >
                  <Typography variant="subtitle2" fontWeight={600}>
                    Asset Browser
                  </Typography>
                  <Button
                    size="small"
                    variant={showAutoMonitor ? 'contained' : 'outlined'}
                    onClick={() => setShowAutoMonitor((prev) => !prev)}
                    sx={{ minWidth: 120 }}
                  >
                    {showAutoMonitor ? 'Hide Monitor' : 'Auto Monitor'}
                  </Button>
                </Box>

                {showAutoMonitor && (
                  <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', maxHeight: '45%', overflowY: 'auto' }}>
                    <StoryArcAutoMonitor
                      userId={currentUser?.id || 'guest'}
                      onStatusChange={(enabled) => {
                        console.log('Auto monitoring status changed:', enabled);
                      }}
                    />
                  </Box>
                )}

                <Box sx={{ flex: 1, minHeight: 0 }}>
                  <AssetBrowser
                    height="100%"
                    storyArcId={storyArcId}
                    onMediaSelect={(media: SelectedAssetMedia) => {
                      const mediaSource = typeof media?.url === 'string' ? media.url.trim() : '';
                      const isVideoAsset =
                        media?.type === 'video' ||
                        (typeof media?.mimeType === 'string' && media.mimeType.startsWith('video/'));

                      if (!isVideoAsset || !mediaSource) {
                        return;
                      }

                      if (media.file instanceof File) {
                        setSourceFileRegistry((previous) => ({
                          ...previous,
                          [mediaSource]: media.file as File,
                        }));
                      }

                      setActiveSourcePreview({
                        id: media.id || `source-${Date.now()}`,
                        name: media.name || 'Selected Source',
                        sourceFile: mediaSource,
                        file: media.file,
                      });
                      setAvailableVideoSources((prev) => (prev.includes(mediaSource) ? prev : [...prev, mediaSource]));
                    }}
                    onTimelineInit={({ storyArc: arc, clips: newClips, tracks: newTracks }) => {
                      if (fixtureTimelineLockRef.current) {
                        return;
                      }
                      setStoryArc(arc);
                      const hydratedTimelineClips = hydrateClipSources(newClips);
                      setClips(hydratedTimelineClips);
                      setAvailableVideoSources((prev) => {
                        const merged = new Set([...prev, ...extractRenderableVideoSources(hydratedTimelineClips)]);
                        return Array.from(merged);
                      });
                      setTracks(newTracks);
                      const total = Math.max(...hydratedTimelineClips.map(c => c.start + c.duration), arc.totalDuration || 0);
                      setTotalDuration(total || 0);
                      setSelectedClips(new Set());
                      setCurrentTime(0);
                    }}
                    onTemplateSelect={(templateId) => {
                      console.log('Template selected:', templateId);
                    }}
                    onSnippetDrag={(snippetId) => {
                      console.log('Snippet dragged:', snippetId);
                    }}
                  />
                </Box>
              </Paper>

              {/* Left Resizer */}
              <Box
                ref={leftResizerRef}
                onMouseDown={handleMouseDown('left')}
                sx={{
                  width: 4,
                  cursor: 'col-resize',
                  bgcolor: isDragging === 'left' ? 'primary.main' : 'transparent','&:hover': { bgcolor: 'primary.main' },
                  position: 'relative',
                  zIndex: 1}}
              />
            </>
          )}

          {/* Center Panel - Professional Timeline */}
          <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Paper
              elevation={0}
              sx={{
                borderBottom: 1,
                borderColor: 'divider',
                p: 1.25,
                bgcolor: 'background.paper',
                flexShrink: 0,
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="subtitle2" fontWeight={600}>
                  Source / Program Monitors
                </Typography>
                {sourcePreviewClip && (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`SRC: ${sourcePreviewClip.name || sourcePreviewClip.beatName || 'Source'}`}
                  />
                )}
                {programMonitorClip && (
                  <Chip
                    size="small"
                    color="primary"
                    variant="outlined"
                    label={`PGM: ${programMonitorClip.name || programMonitorClip.beatName || 'Program'}`}
                  />
                )}
                <Box sx={{ flex: 1 }} />
                <ButtonGroup size="small" variant="outlined">
                  <Button
                    onClick={() => setMonitorFitMode('fit')}
                    variant={monitorFitMode === 'fit' ? 'contained' : 'outlined'}
                  >
                    Fit
                  </Button>
                  <Button
                    onClick={() => setMonitorFitMode('fill')}
                    variant={monitorFitMode === 'fill' ? 'contained' : 'outlined'}
                  >
                    Fill
                  </Button>
                </ButtonGroup>
                <Button
                  size="small"
                  variant={multicamEnabled ? 'contained' : 'outlined'}
                  onClick={() => setMulticamEnabled((previous) => !previous)}
                >
                  Multicam
                </Button>
                <Button
                  data-testid="monitor-guides-toggle"
                  size="small"
                  variant={showCompositionGuides ? 'contained' : 'outlined'}
                  onClick={() => setShowCompositionGuides((previous) => !previous)}
                >
                  Guides (G)
                </Button>
                <Tooltip title="Composition guide settings (Shift+G)">
                  <IconButton
                    data-testid="monitor-guides-settings"
                    size="small"
                    onClick={() => setShowCompositionGuideDialog(true)}
                  >
                    <Settings fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setShowProgramMonitor((prev) => !prev)}
                >
                  {showProgramMonitor ? 'Collapse' : 'Expand'}
                </Button>
                <Chip
                  size="small"
                  variant="outlined"
                  label={`Guides: ${
                    compositionGuideTarget === 'both'
                      ? 'SRC+PGM'
                      : compositionGuideTarget === 'source'
                        ? 'SRC'
                        : 'PGM'
                  }`}
                />
                {compositionAspectMask !== 'none' && (
                  <Chip
                    size="small"
                    color="warning"
                    variant="outlined"
                    label={`Mask ${compositionAspectMask}`}
                  />
                )}
                <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                  {formatTimecode(currentTime)} / {formatTimecode(totalDuration)}
                </Typography>
              </Stack>

              {showProgramMonitor && (
                <>
                  <Box
                    sx={{
                      mt: 1,
                      display: 'grid',
                      gap: 1.25,
                      gridTemplateColumns: isFullscreenPreview ? '1fr' : { xs: '1fr', xl: '1fr 1fr' },
                      maxHeight: isFullscreenPreview ? '70vh' : undefined,
                    }}
                  >
                    <Box
                      data-testid="source-monitor-panel"
                      tabIndex={0}
                      onMouseDown={() => setActiveMonitor('source')}
                      onFocus={() => setActiveMonitor('source')}
                      sx={{
                        border: '1px solid',
                        borderColor: activeMonitor === 'source' ? 'primary.main' : 'divider',
                        borderRadius: 1,
                        bgcolor: 'rgba(0,0,0,0.3)',
                        p: 0.75,
                        outline: 'none',
                        boxShadow:
                          activeMonitor === 'source'
                            ? (theme) => `0 0 0 1px ${theme.palette.primary.main} inset`
                            : 'none',
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 0.5, pb: 0.75 }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                          Source Monitor
                        </Typography>
                        {activeMonitor === 'source' && (
                          <Chip
                            size="small"
                            color="primary"
                            variant="outlined"
                            label="Active"
                          />
                        )}
                        {sourcePreviewClip?.sourceFile && (
                          <Chip
                            size="small"
                            variant="outlined"
                            label={sourcePreviewReady ? 'Ready' : 'Loading'}
                            color={sourcePreviewReady ? 'success' : 'default'}
                          />
                        )}
                      </Stack>
                      <Box
                        sx={{
                          aspectRatio: '16 / 9',
                          borderRadius: 1,
                          overflow: 'hidden',
                          bgcolor: '#000',
                          position: 'relative',
                        }}
                      >
                        {sourcePreviewClip?.sourceFile ? (
                          <video
                            data-testid="source-monitor-video"
                            key={`${sourcePreviewClip.id}:${sourcePreviewClip.sourceFile}`}
                            ref={sourcePreviewVideoRef}
                            src={sourcePreviewClip.sourceFile}
                            playsInline
                            muted
                            preload="metadata"
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: monitorFitMode === 'fill' ? 'cover' : 'contain',
                              backgroundColor: '#000',
                            }}
                            onLoadedMetadata={(event) => {
                              setSourcePreviewReady(true);
                              setSourcePreviewError(null);
                              const mediaDuration = Number(event.currentTarget.duration);
                              if (Number.isFinite(mediaDuration) && mediaDuration > 0) {
                                setSourcePreviewDuration(mediaDuration);
                              }
                              try {
                                event.currentTarget.currentTime = sourcePreviewLocalTime;
                              } catch {
                                // Ignore initial seek errors until media is fully ready.
                              }
                            }}
                            onTimeUpdate={(event) => {
                              setSourcePreviewTime(event.currentTarget.currentTime);
                            }}
                            onPlay={() => {
                              setSourcePreviewIsPlaying(true);
                            }}
                            onPause={() => {
                              setSourcePreviewIsPlaying(false);
                            }}
                            onError={() => {
                              setSourcePreviewReady(false);
                              setSourcePreviewIsPlaying(false);
                              setSourcePreviewError('Source preview failed to load');
                            }}
                          />
                        ) : (
                          <Stack
                            sx={{ height: '100%' }}
                            alignItems="center"
                            justifyContent="center"
                            spacing={1}
                          >
                            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)' }}>
                              No source selected
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                              Click a media asset or timeline clip to load Source Monitor.
                            </Typography>
                          </Stack>
                        )}
                        <CinematographyCompositionOverlay
                          testId="source-monitor-composition-overlay"
                          visible={
                            showCompositionGuides &&
                            (compositionGuideTarget === 'both' || compositionGuideTarget === 'source')
                          }
                          guides={compositionGuides}
                          color={compositionGuideColor}
                          opacity={compositionGuideOpacity}
                          thickness={compositionGuideThickness}
                          spiralOrientation={compositionSpiralOrientation}
                          aspectMask={compositionAspectMask}
                        />
                        {sourcePreviewError && (
                          <Chip
                            size="small"
                            color="error"
                            label={sourcePreviewError}
                            sx={{ position: 'absolute', top: 8, right: 8 }}
                          />
                        )}
                      </Box>
                      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.75 }}>
                        <Tooltip title="Previous Source Frame">
                          <IconButton
                            data-testid="source-step-backward"
                            size="small"
                            onClick={stepSourceBackward}
                            disabled={!sourcePreviewClip?.sourceFile}
                          >
                            <KeyboardArrowLeft fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Source Play/Pause">
                          <IconButton
                            data-testid="source-play-pause-button"
                            size="small"
                            onClick={handleSourcePlayPause}
                            disabled={!sourcePreviewClip?.sourceFile}
                          >
                            {sourcePreviewIsPlaying ? <Pause fontSize="small" /> : <PlayArrow fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Next Source Frame">
                          <IconButton
                            data-testid="source-step-forward"
                            size="small"
                            onClick={stepSourceForward}
                            disabled={!sourcePreviewClip?.sourceFile}
                          >
                            <KeyboardArrowRight fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Button
                          data-testid="source-mark-in-button"
                          size="small"
                          variant="outlined"
                          onClick={() => setSourceMark('in', sourcePreviewLocalTime)}
                        >
                          Mark In
                        </Button>
                        <Button
                          data-testid="source-mark-out-button"
                          size="small"
                          variant="outlined"
                          onClick={() => setSourceMark('out', sourcePreviewLocalTime)}
                        >
                          Mark Out
                        </Button>
                        <Tooltip title="Go To Source Mark In">
                          <IconButton size="small" onClick={() => jumpToSourceMark('in')} disabled={sourceMarkIn === null}>
                            <SkipPrevious fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Go To Source Mark Out">
                          <IconButton size="small" onClick={() => jumpToSourceMark('out')} disabled={sourceMarkOut === null}>
                            <SkipNext fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Clear Source Marks">
                          <IconButton
                            data-testid="source-clear-marks-button"
                            size="small"
                            onClick={() => {
                              setSourceMarkIn(null);
                              setSourceMarkOut(null);
                            }}
                          >
                            <RemoveCircle fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Chip
                          data-testid="source-mark-in-chip"
                          size="small"
                          label={`I: ${sourceMarkIn !== null ? formatTimecode(sourceMarkIn) : '--:--:--'}`}
                          variant="outlined"
                        />
                        <Chip
                          data-testid="source-mark-out-chip"
                          size="small"
                          label={`O: ${sourceMarkOut !== null ? formatTimecode(sourceMarkOut) : '--:--:--'}`}
                          variant="outlined"
                        />
                        <Box sx={{ flex: 1 }} />
                        <Button
                          data-testid="source-insert-button"
                          size="small"
                          variant="contained"
                          onClick={() => insertOrOverwriteFromSource('insert', sourcePreviewClip)}
                          disabled={!sourcePreviewClip?.sourceFile}
                        >
                          Insert (F9)
                        </Button>
                        <Button
                          data-testid="source-overwrite-button"
                          size="small"
                          variant="contained"
                          color="secondary"
                          onClick={() => insertOrOverwriteFromSource('overwrite', sourcePreviewClip)}
                          disabled={!sourcePreviewClip?.sourceFile}
                        >
                          Overwrite (F10)
                        </Button>
                      </Stack>
                    </Box>

                    <Box
                      data-testid="program-monitor-panel"
                      tabIndex={0}
                      onMouseDown={() => setActiveMonitor('program')}
                      onFocus={() => setActiveMonitor('program')}
                      sx={{
                        border: '1px solid',
                        borderColor: activeMonitor === 'program' ? 'primary.main' : 'divider',
                        borderRadius: 1,
                        bgcolor: 'rgba(0,0,0,0.3)',
                        p: 0.75,
                        outline: 'none',
                        boxShadow:
                          activeMonitor === 'program'
                            ? (theme) => `0 0 0 1px ${theme.palette.primary.main} inset`
                            : 'none',
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 0.5, pb: 0.75 }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                          Program Monitor
                        </Typography>
                        {activeMonitor === 'program' && (
                          <Chip
                            size="small"
                            color="primary"
                            variant="outlined"
                            label="Active"
                          />
                        )}
                        {programMonitorClip?.sourceFile && (
                          <Chip
                            size="small"
                            variant="outlined"
                            label={previewReady ? 'Ready' : 'Loading'}
                            color={previewReady ? 'success' : 'default'}
                          />
                        )}
                      </Stack>
                      <Box
                        sx={{
                          aspectRatio: '16 / 9',
                          borderRadius: 1,
                          overflow: 'hidden',
                          bgcolor: '#000',
                          position: 'relative',
                        }}
                      >
                        {programMonitorClip?.sourceFile ? (
                          <video
                            data-testid="program-monitor-video"
                            key={`${programMonitorClip.id}:${programMonitorClip.sourceFile}`}
                            ref={previewVideoRef}
                            src={programMonitorClip.sourceFile}
                            playsInline
                            muted
                            preload="metadata"
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: monitorFitMode === 'fill' ? 'cover' : 'contain',
                              backgroundColor: '#000',
                            }}
                            onLoadedMetadata={(event) => {
                              setPreviewReady(true);
                              setPreviewError(null);
                              try {
                                event.currentTarget.currentTime = programPreviewLocalTime;
                              } catch {
                                // Ignore initial seek errors until media is fully ready.
                              }
                            }}
                            onError={() => {
                              setPreviewReady(false);
                              setPreviewError('Program preview failed to load');
                            }}
                          />
                        ) : (
                          <Stack
                            sx={{ height: '100%' }}
                            alignItems="center"
                            justifyContent="center"
                            spacing={1}
                          >
                            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)' }}>
                              No video clip available for preview
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                              Add a video asset to any non-audio track to see live monitor playback.
                            </Typography>
                          </Stack>
                        )}
                        <CinematographyCompositionOverlay
                          testId="program-monitor-composition-overlay"
                          visible={
                            showCompositionGuides &&
                            (compositionGuideTarget === 'both' || compositionGuideTarget === 'program')
                          }
                          guides={compositionGuides}
                          color={compositionGuideColor}
                          opacity={compositionGuideOpacity}
                          thickness={compositionGuideThickness}
                          spiralOrientation={compositionSpiralOrientation}
                          aspectMask={compositionAspectMask}
                        />

                        {playbackDirection === 'reverse' && programMonitorClip?.sourceFile && (
                          <Chip
                            size="small"
                            label="Reverse playback: frame-stepped"
                            sx={{
                              position: 'absolute',
                              top: 8,
                              left: 8,
                              bgcolor: 'rgba(0,0,0,0.7)',
                              color: '#fff',
                              border: '1px solid rgba(255,255,255,0.2)',
                            }}
                          />
                        )}
                        {previewError && (
                          <Chip
                            size="small"
                            color="error"
                            label={previewError}
                            sx={{ position: 'absolute', top: 8, right: 8 }}
                          />
                        )}
                      </Box>
                      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.75 }}>
                        <Button
                          data-testid="program-mark-in-button"
                          size="small"
                          variant="outlined"
                          onClick={() => setProgramMark('in')}
                        >
                          Mark In
                        </Button>
                        <Button
                          data-testid="program-mark-out-button"
                          size="small"
                          variant="outlined"
                          onClick={() => setProgramMark('out')}
                        >
                          Mark Out
                        </Button>
                        <Tooltip title="Go To Mark In">
                          <IconButton
                            data-testid="program-jump-mark-in-button"
                            size="small"
                            onClick={() => jumpToProgramMark('in')}
                            disabled={programMarkIn === null}
                          >
                            <SkipPrevious fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Go To Mark Out">
                          <IconButton
                            data-testid="program-jump-mark-out-button"
                            size="small"
                            onClick={() => jumpToProgramMark('out')}
                            disabled={programMarkOut === null}
                          >
                            <SkipNext fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Clear Program Marks">
                          <IconButton
                            data-testid="program-clear-marks-button"
                            size="small"
                            onClick={() => {
                              setProgramMarkIn(null);
                              setProgramMarkOut(null);
                            }}
                          >
                            <RemoveCircle fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Chip
                          data-testid="program-mark-in-chip"
                          size="small"
                          label={`I: ${programMarkIn !== null ? formatTimecode(programMarkIn) : '--:--:--'}`}
                          variant="outlined"
                        />
                        <Chip
                          data-testid="program-mark-out-chip"
                          size="small"
                          label={`O: ${programMarkOut !== null ? formatTimecode(programMarkOut) : '--:--:--'}`}
                          variant="outlined"
                        />
                        <Box sx={{ flex: 1 }} />
                        <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                          {timelineEngine.secondsToFrames(currentTime)}f
                        </Typography>
                      </Stack>
                    </Box>
                  </Box>

                  {multicamEnabled && (
                    <Paper
                      elevation={0}
                      sx={{
                        mt: 1,
                        p: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'rgba(0,0,0,0.22)',
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Chip
                          size="small"
                          color={activeMulticamSyncGroup ? 'primary' : 'default'}
                          label={
                            activeMulticamSyncGroup
                              ? `Sync Group: ${activeMulticamSyncGroup}`
                              : 'Sync Group: none'
                          }
                        />
                        <FormControlLabel
                          sx={{ ml: 0 }}
                          control={
                            <Switch
                              size="small"
                              checked={multicamApplyToTimeline}
                              onChange={(event) => setMulticamApplyToTimeline(event.target.checked)}
                            />
                          }
                          label="Apply to Program"
                        />
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          Hotkeys: 1-9
                        </Typography>
                        <Box sx={{ flex: 1 }} />
                        {multicamAngleCandidates.length === 0 && (
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            Add camera+syncGroup metadata to clips to enable multicam switching.
                          </Typography>
                        )}
                        {multicamAngleCandidates.map((candidate, index) => (
                          <Button
                            key={`${candidate.camera}-${candidate.clip.id}`}
                            size="small"
                            variant={candidate.isLive ? 'contained' : 'outlined'}
                            color={candidate.isLive ? 'success' : 'primary'}
                            onClick={() => applyMulticamAngle(candidate)}
                          >
                            {index + 1}. {candidate.camera}
                          </Button>
                        ))}
                      </Stack>
                    </Paper>
                  )}

                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ mt: 1 }}>
                    <IconButton
                      data-testid="center-transport-step-backward"
                      size="small"
                      onClick={handleActiveStepBackward}
                      disabled={!activeMonitorCanPlay}
                      sx={{ border: '1px solid', borderColor: 'divider' }}
                    >
                      <KeyboardArrowLeft fontSize="small" />
                    </IconButton>
                    <IconButton
                      data-testid="center-transport-play-pause"
                      size="small"
                      onClick={handleActivePlayPause}
                      disabled={!activeMonitorCanPlay}
                      sx={{ border: '1px solid', borderColor: 'divider' }}
                    >
                      {activeMonitorIsPlaying ? <Pause fontSize="small" /> : <PlayArrow fontSize="small" />}
                    </IconButton>
                    <IconButton
                      data-testid="center-transport-step-forward"
                      size="small"
                      onClick={handleActiveStepForward}
                      disabled={!activeMonitorCanPlay}
                      sx={{ border: '1px solid', borderColor: 'divider' }}
                    >
                      <KeyboardArrowRight fontSize="small" />
                    </IconButton>
                  </Stack>
                </>
              )}
            </Paper>

            {showEffectsPanel && (
              <Paper
                elevation={0}
                sx={{
                  borderBottom: 1,
                  borderColor: 'divider',
                  p: 1,
                  bgcolor: 'background.paper',
                  flexShrink: 0,
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Typography variant="subtitle2" fontWeight={600}>
                    Effects Dock
                  </Typography>
                  <Chip size="small" label={`Transitions: ${transitions.length}`} />
                  <Chip size="small" label={`Text Overlays: ${textOverlays.length}`} />
                  <Chip size="small" label={`GPU Filters: ${appliedFilters.size}`} />
                  <Chip size="small" label={`Text Anim Presets: ${textAnimationPresets.length}`} />
                  <Chip size="small" label={`Grade Presets: ${colorGradePresets.length}`} />
                  <Chip size="small" label={`LUTs: ${availableLUTs.length}`} />
                  <Chip
                    size="small"
                    label={`Thumb Cache: ${thumbnailCacheSummary.thumbnailCount} (${(thumbnailCacheSummary.totalSize / (1024 * 1024)).toFixed(1)}MB)`}
                  />
                  <Chip
                    size="small"
                    label={`Grade: ${
                      selectedLUTName
                        ? selectedLUTName
                        : currentColorGrade && Object.keys(currentColorGrade).length > 0
                          ? 'Manual'
                          : 'None'
                    }`}
                  />
                  <Button size="small" variant="outlined" onClick={() => setShowTransitionLibrary(true)}>
                    Transition Lib
                  </Button>
                  <Button size="small" variant="outlined" onClick={() => setShowTextOverlayPanel(true)}>
                    Text
                  </Button>
                  <Button size="small" variant="outlined" onClick={() => setShowGPUFiltersPanel(true)}>
                    Filters
                  </Button>
                  <Button size="small" variant="outlined" onClick={() => setShowColorGradingPanel(true)}>
                    Color
                  </Button>
                  <Button size="small" variant="outlined" onClick={() => setShowLUTLibraryDialog(true)}>
                    LUTs
                  </Button>
                  <Button size="small" variant="outlined" onClick={() => setShowHLSImportDialog(true)}>
                    Stream Import
                  </Button>
                  {captionsExport && (
                    <>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => downloadCaptionFile(captionsExport.srt, 'srt')}
                      >
                        Download SRT
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => downloadCaptionFile(captionsExport.vtt, 'vtt')}
                      >
                        Download VTT
                      </Button>
                      <IconButton
                        size="small"
                        onClick={() => setCaptionsExport(null)}
                        aria-label="Clear caption export payload"
                      >
                        <RemoveCircle fontSize="small" />
                      </IconButton>
                    </>
                  )}
                </Stack>
              </Paper>
            )}

            {showMixerPanel && (
              <Paper
                elevation={0}
                sx={{
                  borderBottom: 1,
                  borderColor: 'divider',
                  p: 1,
                  bgcolor: 'background.paper',
                  flexShrink: 0,
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Typography variant="subtitle2" fontWeight={600}>
                    Audio Mixer
                  </Typography>
                  <Chip
                    size="small"
                    color={audioMeterLevel > 0.8 ? 'error' : audioMeterLevel > 0.4 ? 'warning' : 'success'}
                    label={`Meter ${Math.round(audioMeterLevel * 100)}%`}
                  />
                  {tracks
                    .filter((track) => track.type === 'audio' || track.id.toLowerCase().startsWith('audio'))
                    .map((track) => {
                      const trackVolume = clips
                        .filter((clip) => clip.trackId === track.id)
                        .map((clip) => (typeof clip.metadata?.volume === 'number' ? clip.metadata.volume : 1));
                      const avgVolume =
                        trackVolume.length > 0
                          ? trackVolume.reduce((sum, value) => sum + value, 0) / trackVolume.length
                          : 1;
                      return (
                        <Stack key={track.id} direction="row" spacing={0.5} alignItems="center">
                          <Typography variant="caption" sx={{ minWidth: 52 }}>
                            {track.name}
                          </Typography>
                          <Slider
                            size="small"
                            value={avgVolume}
                            min={0}
                            max={2}
                            step={0.05}
                            sx={{ width: 120 }}
                            onChange={(_, value) => {
                              const volume = typeof value === 'number' ? value : value[0];
                              setClips((previous) =>
                                previous.map((clip) =>
                                  clip.trackId === track.id
                                    ? {
                                        ...clip,
                                        metadata: {
                                          ...(clip.metadata || {}),
                                          volume,
                                        },
                                      }
                                    : clip
                                )
                              );
                            }}
                          />
                          <Button size="small" onClick={() => handleOpenMixer(track.id)}>
                            Mixer
                          </Button>
                          <Button size="small" onClick={() => handleOpenAIAssistant(track.id)}>
                            AI
                          </Button>
                        </Stack>
                      );
                    })}
                </Stack>
              </Paper>
            )}

            <ProfessionalTimeline
              clips={clips}
              tracks={tracks}
              zoom={timelineZoom}
              currentTime={currentTime}
              totalDuration={totalDuration}
              isPlaying={isPlaying}
              selectedClips={selectedClips}
              onClipSelect={(clipId, multiSelect) => {
                const newSelected = new Set(selectedClips);
                if (multiSelect) {
                  if (newSelected.has(clipId)) newSelected.delete(clipId); else newSelected.add(clipId);
                } else {
                  newSelected.clear();
                  newSelected.add(clipId);
                }
                setSelectedClips(newSelected);
              }}
              onClipMove={(clipId, newStart, newTrackId) => {
                const snappedStart = timelineEngine.snapToFrame(newStart);
                let next = moveClipWithEditTool(clips, clipId, snappedStart, newTrackId);
                if (magneticEnabled && editTool !== 'slip') {
                  next = resolveOverlaps(next, newTrackId);
                }
                applyClipUpdates(next);
              }}
              onClipResize={(clipId, newStart, newDuration, resizeMode) => {
                const targetTrack = newTrackIdForClip(clips, clipId);
                let next = resizeClipWithEditTool(
                  clips,
                  clipId,
                  newStart,
                  newDuration,
                  resizeMode === 'resize-left' ? 'resize-left' : 'resize-right'
                );
                if (magneticEnabled && targetTrack && editTool !== 'roll') {
                  next = resolveOverlaps(next, targetTrack);
                }
                applyClipUpdates(next);
              }}
              onTimelineClick={handleTimelineClick}
              onCurrentTimeChange={handleCurrentTimeChange}
              onZoomChange={(z) => setTimelineZoom(z)}
              trackHeightScale={trackHeightScale}
              markers={markers}
              trackStates={trackStates}
              onTrackToggle={(trackId, changes) => setTrackStates(prev => ({ ...prev, [trackId]: { ...prev[trackId], ...changes } }))}
              onTrackRename={(trackId, name) => setTracks(prev => prev.map(t => t.id === trackId ? { ...t, name } : t))}
              onTrackTypeChange={(trackId, type) => {
                setTrackStates(prev => ({ ...prev, [trackId]: { ...prev[trackId], type } }));
                setTracks(prev => prev.map(t => t.id === trackId ? { ...t, type: type === 'audio' ? 'audio' : 'video' } : t));
              }}
              transitions={transitions}
              clipMetadata={clipMeta}
              filterTags={filterTags}
              searchQuery={searchQuery}
              onContextMenuAction={(action, payload) => {
                if (!payload?.clipId) return;
                const clipId = payload.clipId as string;
                switch (action) {
                  case 'edit-metadata':
                    setSelectedClips(new Set([clipId]));
                    break;
                  case 'split': {
                    const t = currentTime;
                    setClips(prev => splitClip(prev, clipId, t));
                    break;
                  }
                  case 'duplicate':
                    setClips(prev => duplicateClip(prev, clipId));
                    break;
                  case 'delete':
                    setClips(prev => deleteClip(prev, clipId, rippleEnabled));
                    break;
                  case 'color':
                    setClips(prev => prev.map(c => c.id === clipId ? { ...c, color: payload.color } : c));
                    break;
                  case 'add-comment': {
                    const id = 'c' + Date.now();
                    setComments(prev => [...prev, { id, time: currentTime, text: 'Comment', clipId }]);
                    break;
                  }
                  case 'review-approve': {
                    const id = 'c' + Date.now();
                    setComments(prev => [...prev, { id, time: currentTime, text: 'Approved ✅', clipId }]);
                    break;
                  }
                  case 'review-request-changes': {
                    const id = 'c' + Date.now();
                    setComments(prev => [...prev, { id, time: currentTime, text: 'Please revise ✏️', clipId }]);
                    break;
                  }
                }
              }}
              reviewerMode={reviewerMode}
              compareClips={compareMode ? compareSnapshot : []}
              collabLocks={collabLocks}
              onMediaDrop={({ media, trackId, startTime }) => {
                addMediaToTimeline({
                  media,
                  track: trackId,
                  position: 'playhead',
                  startTime,
                });
                setCurrentTime(startTime);
              }}
            />

            {waveformAudioUrl && (
              <Paper
                elevation={0}
                sx={{
                  borderTop: 1,
                  borderColor: 'divider',
                  p: 1,
                  bgcolor: 'background.paper',
                  flexShrink: 0,
                }}
              >
                <ProfessionalWaveform
                  audioUrl={waveformAudioUrl}
                  height={72}
                  waveColor="#667eea"
                  progressColor="#764ba2"
                  enableRegions={true}
                  onReady={(wavesurfer) => {
                    wavesurfer.setPlaybackRate(Math.max(0.25, Math.min(4, playbackSpeed)));
                    console.log('✅ Waveform ready');
                  }}
                  onRegionCreated={(region) => {
                    console.log('✅ Audio region created:', region);
                  }}
                />
              </Paper>
            )}
          </Box>

          {showInspectorPanel && (
            <>
              {/* Right Resizer */}
              <Box
                ref={rightResizerRef}
                onMouseDown={handleMouseDown('right')}
                sx={{
                  width: 4,
                  cursor: 'col-resize',
                  bgcolor: isDragging === 'right' ? 'primary.main' : 'transparent','&:hover': { bgcolor: 'primary.main' },
                  position: 'relative',
                  zIndex: 1}}
              />

              {/* Right Panel - Inspector */}
              <Paper 
                elevation={0}
                sx={{ 
                  width: panelSizes.rightPanel,
                  borderLeft: 1,
                  borderColor: 'divider',
                  display: 'flex',
                  flexDirection: 'column',
                  bgcolor: 'background.paper'
                }}
              >
                <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                  <Typography variant="subtitle2" fontWeight={600}>
                    Inspector
                  </Typography>
                </Box>
                <Box sx={{ flex: 1, minHeight: 0 }}>
                  <InspectorPanel
                    selectedClips={selectedInspectorClips}
                    onClipUpdate={(clipId, updates) => {
                      setClips(prev => prev.map(clip =>
                        clip && clip.id === clipId ? { ...clip, ...updates } : clip
                      ));
                    }}
                    onBulkUpdate={(clipIds, updates) => {
                      setClips(prev => prev.map(clip =>
                        clip && clipIds.includes(clip.id) ? { ...clip, ...updates } : clip
                      ));
                    }}
                    metaMap={clipMeta}
                    onMetaUpdate={(clipId, updates) => setClipMeta(prev => ({ ...prev, [clipId]: { ...(prev[clipId] || {}), ...updates } }))}
                    height="100%"
                  />
                </Box>
              </Paper>
            </>
          )}
        </Box>

        {/* Onboarding Dialog */}
        <Dialog open={onboardingOpen} onClose={() => setOnboardingOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Story Arc Studio Onboarding</DialogTitle>
          <DialogContent>
            <Stepper activeStep={onboardingStep} orientation="vertical">
              <Step>
                <StepLabel>Connect or Create Project</StepLabel>
                <StepContent>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    Link the editor to an existing project or create a new one to persist timelines and create the Drive folder.
                  </Typography>

                  {/* Recent Projects */}
                  {recentProjects.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600}}>
                        Recent Projects
                      </Typography>
                      <Stack spacing={1}>
                        {recentProjects.map((project) => (
                          <Card
                            key={project.id}
                            variant="outlined"
                            sx={{
                              p: 1.5,
                              cursor: 'pointer','&:hover': { bgcolor: 'action.hover' }}}
                            onClick={async () => {
                              try {
                                setEnsuringMapping(true);
                                // Connect to the story arc project directly
                                // Update project context with story arc ID
                                setProjectContext({
                                  projectId: project.id,
                                  projectName: project.storyArcName,
                                  clientName: 'Unknown Client',
                                  projectType: project.templateType || 'wedding',
                                });
                                setSnackbar({ open: true, message: 'Project connected successfully!', severity: 'success' });
                                setOnboardingStep((s) => s + 1);
                              } catch (e: any) {
                                setSnackbar({ open: true, message: e?.message || 'Failed to connect project', severity: 'error' });
                              } finally {
                                setEnsuringMapping(false);
                              }
                            }}
                          >
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="body2" fontWeight={600}>
                                  {project.storyArcName}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {project.templateType} • {new Date(project.createdAt).toLocaleDateString()}
                                </Typography>
                              </Box>
                              <Button size="small" variant="outlined">
                                Connect
                              </Button>
                            </Stack>
                          </Card>
                        ))}
                      </Stack>
                    </Box>
                  )}

                  {loadingProjects && (
                    <Box sx={{ mb: 2, textAlign: 'center' }}>
                      <CircularProgress size={24} />
                    </Box>
                  )}

                  {/* Action Buttons */}
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Button
                      size="small"
                      variant="contained"
                      disabled={ensuringMapping || !projectContext?.projectId}
                      onClick={async () => {
                        try {
                          setEnsuringMapping(true);
                          const pid = projectContext?.projectId;
                          if (!pid) {
                            setSnackbar({ open: true, message: 'No project in context. Select a project above or create a new one.', severity: 'warning' });
                            return;
                          }
                          const res = await fetch(`/api/story-arc/by-project/${encodeURIComponent(String(pid))}/ensure?name=${encodeURIComponent(projectContext?.projectName || 'Untitled Project')}`, {
                            method: 'POST',
                            credentials: 'include',
                          });
                          if (!res.ok) throw new Error('Failed to ensure mapping');
                          setSnackbar({ open: true, message: 'Project connected and Drive prepared.', severity: 'success' });
                          setOnboardingStep((s) => s + 1);
                        } catch (e: any) {
                          setSnackbar({ open: true, message: e?.message || 'Failed to connect project', severity: 'error' });
                        } finally {
                          setEnsuringMapping(false);
                        }
                      }}
                    >
                      {ensuringMapping ? 'Connecting…' : 'Connect Current Project'}
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={async () => {
                        try {
                          setEnsuringMapping(true);
                          const projectName = prompt('Enter project name:');
                          if (!projectName || !projectName.trim()) {
                            setEnsuringMapping(false);
                            return;
                          }
                          const res = await fetch('/api/story-arc/projects', {
                            method: 'POST',
                            credentials: 'include',
                            headers: { 'Content-Type' : 'application/json' },
                            body: JSON.stringify({
                              storyArcName: projectName.trim(),
                              templateType: 'wedding',
                              emotionalCurve: 'rising',
                              targetDuration: 480,
                            }),
                          });
                          if (!res.ok) {
                            const errorData = await res.json().catch(() => ({}));
                            throw new Error(errorData.error || 'Failed to create project');
                          }
                          const data = await res.json();
                          setSnackbar({ open: true, message: 'Project created successfully!', severity: 'success' });
                          // Update project context
                          if (data.storyArcId) {
                            setProjectContext({
                              projectId: data.storyArcId,
                              projectName: projectName.trim(),
                              clientName: 'Unknown Client',
                              projectType: 'wedding',
                            });
                          }
                          // Refresh projects list
                          await fetchRecentProjects();
                          setOnboardingStep((s) => s + 1);
                        } catch (e: any) {
                          setSnackbar({ open: true, message: e?.message || 'Failed to create project', severity: 'error' });
                        } finally {
                          setEnsuringMapping(false);
                        }
                      }}
                    >
                      New Project
                    </Button>
                    <Button size="small" onClick={() => setOnboardingStep((s) => s + 1)}>Skip</Button>
                  </Stack>
                </StepContent>
              </Step>

              <Step>
                <StepLabel>Verify Drive connection</StepLabel>
                <StepContent>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    Status: {driveInit.status === 'ready' ? 'Ready' : driveInit.status}
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Button size="small" variant="outlined" onClick={initStudio}>Initialize / Retry</Button>
                    {driveInit.status === 'ready' && monitorFolderLink && (
                      <Button size="small" component="a" href={monitorFolderLink} target="_blank" rel="noreferrer">Open folder</Button>
                    )}
                    <Button size="small" onClick={() => setOnboardingStep((s) => s + 1)}>Next</Button>
                  </Stack>
                </StepContent>
              </Step>

              <Step>
                <StepLabel>Import media</StepLabel>
                <StepContent>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    Use Asset Browser to import media or scan your monitored Drive folder.
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Button size="small" onClick={() => setOnboardingStep((s) => s + 1)}>Next</Button>
                  </Stack>
                </StepContent>
              </Step>

              <Step>
                <StepLabel>Preferences & Shortcuts</StepLabel>
                <StepContent>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    Toggles: Magnetic, Ripple, Reviewer. Shortcuts: Space, J/K/L, ←/→, F9/F10, ,/., C (Razor), D (Select under playhead), ; (Lift), ' (Extract).
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Button size="small" onClick={() => setOnboardingStep((s) => s + 1)}>Next</Button>
                  </Stack>
                </StepContent>
              </Step>

              <Step>
                <StepLabel>Preparing CreatorHub Features</StepLabel>
                <StepContent>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    We're getting everything ready so you can start editing right away. This will only take a moment.
                  </Typography>

                  {!workerInitStatus.inProgress && !workerInitStatus.completed && (
                    <Button
                      size="small"
                      variant="contained"
                      onClick={async () => {
                        setWorkerInitStatus({
                          inProgress: true,
                          completed: false,
                          error: null,
                          progress: 0,
                          workers: {},
                        });

                        try {
                          // Call initialization endpoint
                          await fetch('/api/workers/initialize', {
                            method: 'POST',
                            credentials: 'include',
                            headers: { 'Content-Type' : 'application/json' },
                            body: JSON.stringify({}),
                          });

                          // Poll status endpoint to get progress
                          const checkStatus = async (): Promise<void> => {
                            try {
                              const response = await fetch('/api/workers/status', { credentials: 'include' });
                              const data = await response.json();

                              const allWorkers = {
                                ...(data.workers?.onDemand || {}),
                                ...(data.workers?.continuous || {}),
                              };

                              // Calculate progress
                              const totalWorkers = Object.keys(allWorkers).length;
                              const readyWorkers = Object.values(allWorkers).filter(
                                (w: any) => w.ready || w.status === 'running'
                              ).length;
                              const progress = totalWorkers > 0 ? Math.round((readyWorkers / totalWorkers) * 100) : 0;

                              setWorkerInitStatus((prev) => ({
                                ...prev,
                                progress,
                                workers: allWorkers,
                              }));

                              // If all ready or progress is high enough, mark as complete
                              if (data.status === 'ready' || progress >= 80) {
                                setWorkerInitStatus((prev) => ({
                                  ...prev,
                                  inProgress: false,
                                  completed: true,
                                  progress: 100,
                                }));
                                // Auto-advance after a moment
                                setTimeout(() => {
                                  handleOnboardingComplete();
                                }, 1000);
                              } else if (progress < 100) {
                                // Continue polling
                                setTimeout(checkStatus, 1000);
                              }
                            } catch (error) {
                              console.warn('Error checking worker status:', error);
                              // Continue anyway - workers will initialize on first use
                              setWorkerInitStatus((prev) => ({
                                ...prev,
                                inProgress: false,
                                completed: true,
                                progress: 100,
                              }));
                              setTimeout(() => {
                                handleOnboardingComplete();
                              }, 500);
                            }
                          };

                          // Start checking status
                          await checkStatus();
                        } catch (error) {
                          console.warn('Error initializing workers:', error);
                          // Don't block onboarding - workers will initialize on first use
                          setWorkerInitStatus((prev) => ({
                            ...prev,
                            inProgress: false,
                            completed: true,
                            error: null,
                            progress: 100,
                          }));
                          setTimeout(() => {
                            handleOnboardingComplete();
                          }, 500);
                        }
                      }}
                      sx={{ mb: 2 }}
                    >
                      Prepare Features
                    </Button>
                  )}

                  {workerInitStatus.inProgress && (
                    <Box sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2">
                          {workerInitStatus.progress < 30
                            ? 'Getting everything ready...'
                            : workerInitStatus.progress < 70
                            ? 'Almost there...'
                            : workerInitStatus.progress < 90
                            ? 'Final touches...'
                            : 'All set!'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {workerInitStatus.progress}%
                        </Typography>
                      </Box>
                      <LinearProgress variant="determinate" value={workerInitStatus.progress} sx={{ mb: 2 }} />

                      <Stack spacing={1}>
                        {Object.entries(workerInitStatus.workers).slice(0, 6).map(([key, worker]: [string, any]) => (
                          <Box
                            key={key}
                            sx={{
                              p: 1.5,
                              borderRadius: 1,
                              bgcolor: worker.ready || worker.status === 'running' ? 'success.light' : 'action.hover',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1}}
                          >
                            {worker.ready || worker.status === 'running' ? (
                              <CheckCircle color="success" fontSize="small" />
                            ) : (
                              <CircularProgress size={16} />
                            )}
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="body2" fontWeight={600}>
                                {worker.friendlyName || key}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {worker.message || worker.description || 'Preparing...'}
                              </Typography>
                            </Box>
                          </Box>
                        ))}
                      </Stack>
                    </Box>
                  )}

                  {workerInitStatus.completed && (
                    <Alert severity="success" sx={{ mb: 2 }}>
                      ✅ All features are ready! You're all set to start editing.
                    </Alert>
                  )}

                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
                    💡 Tip: You can skip this step and features will be ready when you first use them.
                  </Typography>

                  <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={handleOnboardingComplete}
                      disabled={workerInitStatus.inProgress}
                    >
                      Finish
                    </Button>
                    {workerInitStatus.inProgress && (
                      <Button size="small" onClick={handleOnboardingComplete}>
                        Skip
                      </Button>
                    )}
                  </Stack>
                </StepContent>
              </Step>
            </Stepper>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              // Mark as completed even if closed early
              localStorage.setItem('storyArcStudio_onboardingCompleted','true');
              setOnboardingOpen(false);
            }}>Close</Button>
          </DialogActions>
        </Dialog>

        <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>{snackbar.message}</Alert>
        </Snackbar>

        {/* Face Detection Options Dialog */}
        <Dialog open={showFaceDetectionOptionsDialog} onClose={() => {
          setShowFaceDetectionOptionsDialog(false);
          if (pendingFaceDetectionResolve) {
            pendingFaceDetectionResolve(null);
            setPendingFaceDetectionResolve(null);
          }
        }} maxWidth="sm" fullWidth>
          <DialogTitle>Ansiktsgjenkjenning - Alternativer</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <FormControlLabel
                control={<Switch checked={faceDetectionOptions.scanEntire} onChange={(e) => setFaceDetectionOptions(prev => ({ ...prev, scanEntire: e.target.checked }))} />}
                label="Full videoskanning (analyserer flere bilder)"
              />
              <Typography variant="body2" color="text.secondary">
                {faceDetectionOptions.scanEntire ? 'Analyserer flere bilder gjennom videoen' : 'Rask skanning (3-4 nøkkelbilder)'}
              </Typography>
              {faceDetectionOptions.scanEntire && (
                <TextField
                  label="Bilder per sekund å sample"
                  type="number"
                  value={faceDetectionOptions.fps}
                  onChange={(e) => setFaceDetectionOptions(prev => ({ ...prev, fps: parseFloat(e.target.value) || 0.5 }))}
                  inputProps={{ step: 0.1, min: 0.1, max: 5 }}
                  helperText="Standard: 0.5 = 1 bilde hvert 2. sekund"
                  fullWidth
                />
              )}
              <FormControl fullWidth>
                <InputLabel>Analyseoppgaver</InputLabel>
                <Select
                  value={faceDetectionOptions.taskChoice}
                  onChange={(e) => setFaceDetectionOptions(prev => ({ ...prev, taskChoice: e.target.value }))}
                  label="Analyseoppgaver"
                >
                  <MenuItem value="1">Alle oppgaver (parsing, landmarks, headpose, attributes)</MenuItem>
                  <MenuItem value="2">Kun ansiktssegmentering (parsing)</MenuItem>
                  <MenuItem value="3">Kun 68 landemerker (landmarks)</MenuItem>
                  <MenuItem value="4">Kun hodeposisjon (headpose)</MenuItem>
                  <MenuItem value="5">Kun ansiktsattributter (attributes)</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              setShowFaceDetectionOptionsDialog(false);
              if (pendingFaceDetectionResolve) {
                pendingFaceDetectionResolve(null);
                setPendingFaceDetectionResolve(null);
              }
            }}>Avbryt</Button>
            <Button variant="contained" onClick={() => {
              setShowFaceDetectionOptionsDialog(false);
              if (pendingFaceDetectionResolve) {
                pendingFaceDetectionResolve(faceDetectionOptions);
                setPendingFaceDetectionResolve(null);
              }
            }}>Start analyse</Button>
          </DialogActions>
        </Dialog>

        {/* Subclips Confirm Dialog */}
        <Dialog open={showSubclipsConfirmDialog} onClose={() => {
          setShowSubclipsConfirmDialog(false);
          if (pendingSubclipsResolve) {
            pendingSubclipsResolve(false);
            setPendingSubclipsResolve(null);
          }
        }} maxWidth="sm" fullWidth>
          <DialogTitle>Ansiktsgjenkjenning fullført!</DialogTitle>
          <DialogContent>
            <Typography gutterBottom>
              Fant ansikter i {subclipsConfirmData?.facesFound} av {subclipsConfirmData?.totalClips} klipp.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Vil du automatisk opprette sub-klipp fra ansiktsgjenkjente segmenter?
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2">• <strong>Ja:</strong> Oppretter sub-klipp for hvert ansiktsgjenkjent segment</Typography>
              <Typography variant="body2">• <strong>Nei:</strong> Legger kun til tidslinje-markører</Typography>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              setShowSubclipsConfirmDialog(false);
              if (pendingSubclipsResolve) {
                pendingSubclipsResolve(false);
                setPendingSubclipsResolve(null);
              }
            }}>Nei, bare markører</Button>
            <Button variant="contained" color="primary" onClick={() => {
              setShowSubclipsConfirmDialog(false);
              if (pendingSubclipsResolve) {
                pendingSubclipsResolve(true);
                setPendingSubclipsResolve(null);
              }
            }}>Ja, opprett sub-klipp</Button>
          </DialogActions>
        </Dialog>

        {/* Settings Dialog */}
        <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Studio Settings</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <FormControlLabel
                control={<Switch checked={driveUploadsEnabled} onChange={(e) => setDriveUploadsEnabled(e.target.checked)} />}
                label="Enable Drive uploads"
              />
              <FormControlLabel
                control={<Switch checked={drivePrimaryEnabled} onChange={(e) => setDrivePrimaryEnabled(e.target.checked)} disabled={!driveUploadsEnabled} />}
                label="Enable primary (same-file) updates"
              />
              <FormControl size="small" fullWidth disabled={!driveUploadsEnabled || !drivePrimaryEnabled}>
                <InputLabel id="primary-interval-label">Drive primary update interval</InputLabel>
                <Select
                  labelId="primary-interval-label"
                  label="Drive primary update interval"
                  value={drivePrimaryIntervalMs}
                  onChange={(e) => setDrivePrimaryIntervalMs(Number(e.target.value))}
                >
                  <MenuItem value={15000}>15 seconds</MenuItem>
                  <MenuItem value={30000}>30 seconds</MenuItem>
                  <MenuItem value={60000}>1 minute</MenuItem>
                  <MenuItem value={120000}>2 minutes</MenuItem>
                </Select>
              </FormControl>

              <TextField
                size="small"
                label="Primary folder name"
                value={drivePrimaryFolderName}
                onChange={(e) => setDrivePrimaryFolderName(e.target.value)}
                disabled={!driveUploadsEnabled || !drivePrimaryEnabled}
              />
              <TextField
                size="small"
                label="Primary filename template"
                helperText="Use {id}, {projectId}, {name}, {ts}"
                value={drivePrimaryFilenameTemplate}
                onChange={(e) => setDrivePrimaryFilenameTemplate(e.target.value)}
                disabled={!driveUploadsEnabled || !drivePrimaryEnabled}
              />

              <FormControlLabel
                control={<Switch checked={driveBackupEnabled} onChange={(e) => setDriveBackupEnabled(e.target.checked)} disabled={!driveUploadsEnabled} />}
                label="Enable timestamped backups"
              />
              <FormControl size="small" fullWidth disabled={!driveUploadsEnabled || !driveBackupEnabled}>
                <InputLabel id="backup-interval-label">Backup new-file cadence</InputLabel>
                <Select
                  labelId="backup-interval-label"
                  label="Backup new-file cadence"
                  value={driveBackupIntervalMs}
                  onChange={(e) => setDriveBackupIntervalMs(Number(e.target.value))}
                >
                  <MenuItem value={60000}>1 minute</MenuItem>
                  <MenuItem value={300000}>5 minutes</MenuItem>
                  <MenuItem value={600000}>10 minutes</MenuItem>
                  <MenuItem value={1800000}>30 minutes</MenuItem>
                </Select>
              </FormControl>

              <TextField
                size="small"
                label="Backup folder name"
                value={driveBackupFolderName}
                onChange={(e) => setDriveBackupFolderName(e.target.value)}
                disabled={!driveUploadsEnabled || !driveBackupEnabled}
              />
              <TextField
                size="small"
                label="Backup filename template"
                helperText="Use {id}, {projectId}, {name}, {ts}"
                value={driveBackupFilenameTemplate}
                onChange={(e) => setDriveBackupFilenameTemplate(e.target.value)}
                disabled={!driveUploadsEnabled || !driveBackupEnabled}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSettingsOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* Export Dialog - Browser ffmpeg */}
        <ExportDialog
          open={showExportDialog}
          onClose={() => setShowExportDialog(false)}
          clips={clips}
          tracks={tracks}
          storyArc={storyArc ? storyArc : undefined}
        />
        
        {/* DaVinci Resolve Export Dialog - Professional finishing */}
        <DaVinciResolveExportDialog
          open={showResolveExportDialog}
          onClose={() => setShowResolveExportDialog(false)}
          clips={clips}
          tracks={tracks}
          projectName={storyArc?.title || 'Untitled Project'}
          culture={resolveExportSettings.culture}
          projectType={resolveExportSettings.projectType}
        />
        
        {/* AI Story Generator Dialog - AUTO-CREATE TIMELINE! */}
        <AIStoryGeneratorDialog
          open={showAIGeneratorDialog}
          onClose={() => setShowAIGeneratorDialog(false)}
          onStoryGenerated={(data) => {
            // Load AI-generated timeline into editor
            const aiClips = data.timeline.clips.map((c: any) => ({
              id: c.id,
              name: c.name,
              beatName: c.beatName,
              start: c.start,
              duration: c.duration,
              ev: c.metadata.emotionalIntensity,
              synopsis: c.name,
              trackId: c.trackId,
              color: '#9c27b0',
              sourceFile: c.sourceFile,
              metadata: c.metadata
            }));

            const hydratedAiClips = hydrateClipSources(aiClips);
            setClips(hydratedAiClips);
            setAvailableVideoSources((prev) => {
              const merged = new Set([...prev, ...extractRenderableVideoSources(hydratedAiClips)]);
              return Array.from(merged);
            });
            setTotalDuration(data.timeline.totalDuration);
            
            // Update story arc
            setStoryArc({
              id: 'ai_generated',
              title: data.storyArc.title,
              type: 'wedding',
              totalDuration: data.timeline.totalDuration,
              segments: [],
              musicSuggestions: data.storyArc.musicSuggestions,
              transitionEffects: data.storyArc.transitionPoints,
              colorGrading: DEFAULT_COLOR_GRADING_PROFILE,
              confidence: 0.9,
              createdAt: new Date().toISOString()
            });
            
            // Set timeline in engine
            videoEngine.setTimeline(hydratedAiClips, tracks, data.timeline.totalDuration);

            setShowAIGeneratorDialog(false);

            console.log('✅ AI-generated timeline loaded!', hydratedAiClips.length, 'clips');

            // Store data for rating
            setAIGeneratedTimelineData(data);

            // Show rating dialog after 2 seconds
            setTimeout(() => {
              setShowRatingDialog(true);
            }, 2000);
          }}
        />
        
        {/* ================================================ */}
        {/* ALL PROFESSIONAL FEATURE PANELS */}
        {/* ================================================ */}
        
        {/* Transition Library - 485 transitions! */}
        <TransitionLibrary
          open={showTransitionLibrary}
          onClose={() => setShowTransitionLibrary(false)}
          onSelectTransition={(type, duration, engine) => {
            // Mark a pending transition; user can place at playhead with button
            setPendingTransitionType(type);
            setPendingTransitionDuration(duration);
            setPendingTransitionEngine(engine);
            setShowTransitionLibrary(false);
            setSnackbar({
              open: true,
              message: `Queued transition ${type} (${engine.toUpperCase()}, ${duration.toFixed(2)}s)`,
              severity: 'info',
            });
          }}
        />
        
        {/* Speed Ramp Panel */}
        {selectedClips.size > 0 && showSpeedRampPanel && (
          <SpeedRampPanel
            clipId={Array.from(selectedClips)[0]}
            clipDuration={clips.find(c => c?.id === Array.from(selectedClips)[0])?.duration || 10}
            currentKeyframes={currentSpeedKeyframes}
            onKeyframesChange={(keyframes) => {
              setCurrentSpeedKeyframes(keyframes);
              console.log('✅ Speed keyframes updated:', keyframes.length);
            }}
            onPreview={() => {
              console.log('🎬 Previewing speed ramp');
            }}
          />
        )}
        
        {/* ================================================ */}
        {/* ALL REMAINING PROFESSIONAL PANELS */}
        {/* ================================================ */}
        
        {/* Text Overlay Panel */}
        <TextOverlayPanel
          open={showTextOverlayPanel}
          onClose={() => setShowTextOverlayPanel(false)}
          onAddOverlay={(overlay) => {
            const defaultAnimation = textAnimationPresets[0]?.animation;
            const normalizedOverlay = {
              ...overlay,
              animation:
                overlay.animation ||
                defaultAnimation || {
                  type: 'fade_in',
                  duration: 0.5,
                  delay: 0,
                  easing: 'power2.out',
                },
            };
            setTextOverlays((prev) => [...prev, normalizedOverlay]);
            try {
              textOverlayEngine.addOverlay(normalizedOverlay);
            } catch (error) {
              console.warn('Text overlay engine add failed:', error);
            }
            console.log('✅ Text overlay added:', normalizedOverlay);
          }}
        />
        
        {/* GPU Filters Panel */}
        <GPUFiltersPanel
          open={showGPUFiltersPanel}
          onClose={() => setShowGPUFiltersPanel(false)}
          onApplyFilter={(filterId, config) => {
            setAppliedFilters((prev) => new Map(prev).set(filterId, config));
            try {
              pixiFilterEngine.applyFilter(filterId, config);
            } catch (error) {
              console.warn('GPU filter apply failed:', error);
            }
            console.log('✅ GPU filter applied:', filterId);
          }}
        />
        
        {/* Color Grading Panel */}
        <ColorGradingPanel
          open={showColorGradingPanel}
          onClose={() => setShowColorGradingPanel(false)}
          onApplyGrade={(grade) => {
            const presetMatch = colorGradePresets.find((preset) => preset.name === grade?.name);
            const mergedGrade = presetMatch ? { ...presetMatch.grade, ...grade } : grade;
            setCurrentColorGrade(mergedGrade);
            if (selectedClips.size > 0) {
              setClips((previous) =>
                previous.map((clip) =>
                  selectedClips.has(clip.id)
                    ? {
                        ...clip,
                        metadata: {
                          ...(clip.metadata || {}),
                          colorGrade: mergedGrade,
                        },
                      }
                    : clip
                )
              );
            }
            console.log('✅ Color grade applied:', mergedGrade);
          }}
        />

        <LUTLibrary
          open={showLUTLibraryDialog}
          onClose={() => setShowLUTLibraryDialog(false)}
          onSelectLUT={handleSelectLUT}
        />

        <HLSImportDialog
          open={showHLSImportDialog}
          onClose={() => setShowHLSImportDialog(false)}
          onImport={handleImportStream}
        />

        {/* Scene Detection Dialog */}
        <Dialog open={showSceneDetectionDialog} onClose={() => setShowSceneDetectionDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Scene Detection</DialogTitle>
          <DialogContent>
            {sceneDetectionJobId && (
              <Chip size="small" label={`Job: ${sceneDetectionJobId}`} sx={{ mb: 1 }} />
            )}
            {sceneDetectionProgress?.status === 'processing' && (
              <Box sx={{ py: 2 }}>
                <Typography variant="body2" sx={{ mb: 1 }}>Detecting scenes...</Typography>
                <LinearProgress />
              </Box>
            )}
            {sceneDetectionProgress?.status === 'completed' && sceneDetectionProgress.scenes && (
              <Box>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  Detected {sceneDetectionProgress.scenes.length} scenes
                </Typography>
                <List>
                  {sceneDetectionProgress.scenes.slice(0, 10).map((scene: any) => (
                    <ListItem key={scene.scene_number}>
                      <ListItemTextType
                        primary={`Scene ${scene.scene_number}`}
                        secondary={`${scene.start_time.toFixed(2)}s - ${scene.end_time.toFixed(2)}s (${scene.duration.toFixed(2)}s)`}
                      />
                      <ListItemSecondaryAction>
                        <Button
                          size="small"
                          onClick={() => setCurrentTime(Math.max(0, timelineEngine.snapToFrame(scene.start_time)))}
                        >
                          Jump
                        </Button>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
            {sceneDetectionProgress?.status === 'failed' && (
              <Alert severity="error">
                Scene detection failed: {sceneDetectionProgress.error || 'Unknown error'}
              </Alert>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowSceneDetectionDialog(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* Auto-Captions Panel */}
        <AutoCaptionsPanel
          open={showAutoCaptionsPanel}
          onClose={() => setShowAutoCaptionsPanel(false)}
          videoPath={captionVideoPath}
          sourceVideoFile={captionSourceVideoFile}
          fallbackVideoPaths={captionFallbackVideoPaths}
          fallbackVideoFiles={captionFallbackVideoFiles}
          onCaptionsGenerated={(captions, srt, vtt) => {
            console.log('✅ Captions generated:', captions.length, 'segments');
            setCaptionsExport({
              segments: captions,
              srt,
              vtt,
            });
            const captionMarkers: TimelineMarker[] = captions
              .slice(0, 50)
              .map((caption: { start: number; text: string }, index: number) => ({
                id: `cap-${Date.now()}-${index}`,
                time: timelineEngine.snapToFrame(Math.max(0, caption.start || 0)),
                color: '#f59e0b',
                label: `Caption: ${(caption.text || '').slice(0, 22)}`,
              }));
            if (captionMarkers.length > 0) {
              setMarkers((previous) => [...previous, ...captionMarkers]);
            }
            setSnackbar({
              open: true,
              message: `Captions generated (${captions.length} segments). Export ready in Effects Dock.`,
              severity: 'success',
            });
          }}
        />
        
        {/* Beat Sync Panel */}
        {waveformAudioUrl && (
          <BeatSyncPanel
            open={showBeatSyncPanel}
            onClose={() => setShowBeatSyncPanel(false)}
            audioPath={waveformAudioUrl}
            clips={clips}
            onClipsSnapped={(snappedClips) => {
              const hydratedSnappedClips = hydrateClipSources(snappedClips);
              setClips(hydratedSnappedClips);
              setAvailableVideoSources((prev) => {
                const merged = new Set([...prev, ...extractRenderableVideoSources(hydratedSnappedClips)]);
                return Array.from(merged);
              });
              console.log('✅ Clips snapped to beats');
            }}
          />
        )}
        
        {/* Background Removal Panel */}
        {selectedClips.size > 0 && (
          <BackgroundRemovalPanel
            open={showGPUFiltersPanel && appliedFilters.has('background-removal')}
            onClose={() => setShowGPUFiltersPanel(false)}
            clipId={Array.from(selectedClips)[0]}
            onProcessed={(result) => {
              console.log('✅ Background processed:', result);
            }}
          />
        )}
        
        {/* Motion Tracking Panel */}
        {selectedClips.size > 0 && (
          <>
            <ObjectSegmentationPanel
              open={showObjectSegmentationPanel}
              onClose={() => setShowObjectSegmentationPanel(false)}
              clipId={Array.from(selectedClips)[0]}
              videoUrl={clips.find(c => c.id === Array.from(selectedClips)[0])?.sourceFile}
              onSegmentationComplete={(result) => {
                console.log('✅ Object segmentation complete:', result);
                // Apply segmentation results to timeline
                // Could add mask-based effects, selective color grading, etc.
              }}
            />
            <MotionTrackingPanel
              open={showMotionTrackingPanel}
              onClose={() => setShowMotionTrackingPanel(false)}
              clipId={Array.from(selectedClips)[0]}
              videoUrl={clips.find(c => c.id === Array.from(selectedClips)[0])?.sourceFile}
              onTrackingComplete={(result) => {
                console.log('✅ Motion tracking complete:', result);
                // Apply tracking data to clip (e.g., add keyframes, masks, etc.)
                setSnackbar({
                  open: true,
                  message: `Motion tracking complete! Tracked ${result.frames?.length || 0} frames using ${result.tracker_type}`,
                  severity: 'success',
                });
              }}
            />
          </>
        )}
      </Box>

      {/* Rating Dialog */}
      <EnhancementRatingDialog
        open={showRatingDialog}
        onClose={() => {
          setShowRatingDialog(false);
          setAIGeneratedTimelineData(null);
        }}
        enhancementType="video"
        onSubmitRating={handleSubmitVideoRating}
        title="Vurder AI-generert tidslinje"
        description="Din tilbakemelding hjelper oss å trene AI-modellene slik at de blir bedre for norske videografer!"
      />

      {/* Audio Enhancement Dialog */}
      <AudioEnhancementDialog
        open={showAudioEnhancementDialog}
        onClose={() => {
          setShowAudioEnhancementDialog(false);
          setPendingAudioFile(null);
        }}
        audioFile={pendingAudioFile}
        onEnhanced={(enhancedUrl, metrics) => {
          // Add enhanced audio to timeline
          const detail = window.__pendingAudioDetail;
          if (detail) {
            const targetTrackId = detail.track || 'audio-1';
            const clipDuration = Number(detail.media.duration || 5);

            setTracks((prev) => {
              if (!prev.find(t => t.id === targetTrackId)) {
                const newTrack: Track = { id: targetTrackId, name: targetTrackId, type: 'audio', height: 40 };
                return [...prev, newTrack];
              }
              return prev;
            });

            setClips((prev) => {
              let start = 0;
              if (detail.position === 'playhead') {
                start = currentTime;
              } else {
                const trackClips = prev.filter(c => c.trackId === targetTrackId);
                const end = trackClips.length > 0 ? Math.max(...trackClips.map(c => c.start + c.duration)) : 0;
                start = end;
              }
              const id = 'clip_' + Date.now();
              const originalName = detail.media.name || 'Audio';
              // Preserve original filename and show relationship
              const extension = originalName.match(/\.[^/.]+$/)?.[0] || '.wav';
              const baseName = originalName.replace(/\.[^/.]+$/, '');
              const enhancedName = `${baseName}_enhanced${extension}`;
              
              const newClip = {
                id,
                name: enhancedName,
                beatName: enhancedName,
                start,
                duration: clipDuration,
                ev: 0, // Neutral emotional value
                synopsis: `Forbedret: ${metrics.loudness?.standard} (${metrics.loudness?.final_lufs?.toFixed(1)} LUFS) | Fra: ${originalName}`,
                trackId: targetTrackId,
                color: '#16a34a',
                sourceFile: enhancedUrl,
                enhanced: true,  // Mark as enhanced
                enhancedPreset: metrics.loudness?.standard || 'Enhanced',  // Store preset name
                // Store relationship to original
                metadata: {
                  originalSource: detail.media.url || detail.media.name,
                  originalName: originalName,
                  enhancedFrom: detail.media.id || detail.media.name,
                  enhancementMethod: metrics.enhancement?.method || 'FlowSE/DEMUCS',
                  loudnessStandard: metrics.loudness?.standard,
                },
                tags: ['enhanced','audio', metrics.loudness?.standard || 'enhanced'],
              } as BeatClip;
              const next = [...prev, newClip];
              const maxEnd = Math.max(...next.map(c => c.start + c.duration), storyArc?.totalDuration || 0);
              setTotalDuration(maxEnd);
              return next;
            });

            // Save enhanced audio to asset library
            const originalName = detail.media.name || 'Audio';
            const assetName = `${originalName} (Forbedret)`;
            const description = `Forbedret lyd: ${metrics.loudness?.standard} standard (${metrics.loudness?.final_lufs?.toFixed(1)} LUFS)`;
            
            // Save to library asynchronously (don't block UI)
            apiRequest('/api/assets/library', {
              method: 'POST',
              headers: { 'Content-Type' : 'application/json' },
              body: JSON.stringify({
                name: assetName,
                description: description,
                category: 'audio',
                subcategory: 'enhanced',
                model_url: enhancedUrl,
                tags: ['enhanced','audio', metrics.loudness?.standard || 'enhanced'],
                metadata: {
                  originalName: originalName,
                  enhancementMethod: metrics.enhancement?.method || 'FlowSE/DEMUCS',
                  loudnessStandard: metrics.loudness?.standard,
                  finalLufs: metrics.loudness?.final_lufs,
                  snrImprovement: metrics.enhancement?.snr_improvement,
                  quality: metrics.enhancement?.quality,
                  preset: metrics.loudness?.standard
                },
                is_public: false
              })
            }).then(() => {
              console.log('✅ Enhanced audio saved to asset library');
            }).catch((error: any) => {
              console.error('Failed to save enhanced audio to library:', error);
              // Don't show error to user - enhancement still succeeded
            });

            // Upload enhanced audio to Google Drive Audio Assets folder (if storyArcId and storyArcName available)
            if (storyArcId && storyArc?.title && currentUser?.id) {
              // Fetch the enhanced audio file
              fetch(enhancedUrl)
                .then(response => response.blob())
                .then(blob => {
                  const formData = new FormData();
                  formData.append('file', blob, assetName);
                  formData.append('storyArcName', storyArc.title);

                  return apiRequest(`/api/story-arc/${storyArcId}/google-drive/upload-audio`, {
                    method: 'POST',
                    body: formData
                  });
                })
                .then(() => {
                  console.log('✅ Enhanced audio uploaded to Google Drive Audio Assets folder');
                })
                .catch((error: any) => {
                  console.error('Failed to upload enhanced audio to Google Drive:', error);
                  // Don't show error to user - enhancement still succeeded
                });
            }

            // Clear pending detail
            delete window.__pendingAudioDetail;
          }

          setShowAudioEnhancementDialog(false);
          setPendingAudioFile(null);

          // Show success message
          setSnackbar({
            open: true,
            message: `Lyd forbedret! ${metrics.loudness?.standard} standard (${metrics.loudness?.final_lufs?.toFixed(1)} LUFS)`,
            severity: 'success'
          });
        }}
        onSkip={() => {
          // Add original audio to timeline
          const detail = window.__pendingAudioDetail;
          if (detail) {
            const targetTrackId = detail.track || 'audio-1';
            const clipDuration = Number(detail.media.duration || 5);

            setTracks((prev) => {
              if (!prev.find(t => t.id === targetTrackId)) {
                const newTrack: Track = { id: targetTrackId, name: targetTrackId, type: 'audio', height: 40 };
                return [...prev, newTrack];
              }
              return prev;
            });

      setClips((prev) => {
        let start = 0;
        if (detail.position === 'playhead') {
          start = currentTime;
        } else {
          const trackClips = prev.filter(c => c.trackId === targetTrackId);
          const end = trackClips.length > 0 ? Math.max(...trackClips.map(c => c.start + c.duration)) : 0;
          start = end;
        }
        const id = 'clip_' + Date.now();
        const newClip = {
          id,
          name: detail.media.name || 'Asset',
          beatName: detail.media.name || 'Asset',
          start,
          duration: clipDuration,
          ev: 0, // Neutral emotional value
          synopsis: detail.media.name || 'Asset',
          trackId: targetTrackId,
          color: '#4caf50',
          sourceFile: detail.media.url,
          // Store metadata for multi-angle sync
          metadata: {
            camera: detail.media.camera,
            syncGroup: detail.media.syncGroup,
            originalSource: detail.media.url || detail.media.name,
          },
          tags: detail.media.tags || [],
        } as BeatClip;
        const next = [...prev, newClip];
        const maxEnd = Math.max(...next.map(c => c.start + c.duration), storyArc?.totalDuration || 0);
        setTotalDuration(maxEnd);
        
        // Update clipMetadata state for timeline display (use the actual clip ID)
        if (detail.media.camera || detail.media.syncGroup || detail.media.tags) {
          setClipMeta((prev) => ({
            ...prev,
            [id]: {
              camera: detail.media.camera,
              syncGroup: detail.media.syncGroup,
              tags: detail.media.tags || [],
            }
          }));
        }
        
        return next;
      });

            // Clear pending detail
            delete window.__pendingAudioDetail;
          }

          setShowAudioEnhancementDialog(false);
          setPendingAudioFile(null);
        }}
        preset="auto"
      />

      {/* Multi-Angle Sync Dialog */}
      <Dialog 
        open={showSyncDialog} 
        onClose={closeSyncDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Sync />
            <Typography variant="h6">Sync Multi-Angle Clips</Typography>
            {syncJobId && <Chip size="small" label={`Job ${syncJobId}`} color="info" variant="outlined" />}
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <Alert severity="info">
              PluralEyes-style sync: waveform alignment first, optional timecode fallback, confidence scoring, drift estimation, and manual fine trim.
            </Alert>

            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <Stack spacing={1.25}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Sync Strategy
                </Typography>
                <Stack direction="row" spacing={2} flexWrap="wrap">
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={syncTryReallyHard}
                        onChange={(event) => setSyncTryReallyHard(event.target.checked)}
                      />
                    }
                    label="Try Really Hard"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={syncPreferTimecode}
                        onChange={(event) => setSyncPreferTimecode(event.target.checked)}
                      />
                    }
                    label="Prefer Timecode"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={syncEnableDriftCorrection}
                        onChange={(event) => setSyncEnableDriftCorrection(event.target.checked)}
                      />
                    }
                    label="Drift Correction"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={syncAllowClipReorder}
                        onChange={(event) => setSyncAllowClipReorder(event.target.checked)}
                      />
                    }
                    label="Allow Clip Reorder"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={syncUseServerFirst}
                        onChange={(event) => setSyncUseServerFirst(event.target.checked)}
                      />
                    }
                    label="Use Server First"
                  />
                </Stack>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Max offset window: +/- {syncMaxOffsetSeconds}s
                  </Typography>
                  <Slider
                    value={syncMaxOffsetSeconds}
                    onChange={(_, value) => {
                      const numericValue = Array.isArray(value) ? value[0] : value;
                      setSyncMaxOffsetSeconds(Math.max(5, Math.min(120, numericValue)));
                    }}
                    min={5}
                    max={120}
                    step={1}
                    marks={[
                      { value: 5, label: '5s' },
                      { value: 30, label: '30s' },
                      { value: 60, label: '60s' },
                      { value: 120, label: '120s' },
                    ]}
                    valueLabelDisplay="auto"
                  />
                </Box>
              </Stack>
            </Paper>
            
            <Typography variant="subtitle2" sx={{ fontWeight: 600}}>
              Select Clips to Sync ({selectedSyncClips.size} selected)
            </Typography>
            
            <List sx={{ maxHeight: 400, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              {clips.map((clip) => {
                const meta = clipMeta[clip.id] || {};
                const camera = meta.camera || clip.metadata?.camera;
                const syncGroup = meta.syncGroup || clip.metadata?.syncGroup;
                const isSelected = selectedSyncClips.has(clip.id);
                
                return (
                  <ListItem key={clip.id} disablePadding>
                    <ListItemButton
                      onClick={() => {
                        const newSelected = new Set(selectedSyncClips);
                        if (isSelected) {
                          newSelected.delete(clip.id);
                        } else {
                          newSelected.add(clip.id);
                        }
                        setSelectedSyncClips(newSelected);
                      }}
                      sx={{
                        bgcolor: isSelected ? 'action.selected' : 'transparent','&:hover': { bgcolor: 'action.hover' }
                      }}
                    >
                      <Checkbox checked={isSelected} />
                      <ListItemText
                        primary={clip.name}
                        secondaryTypographyProps={{ component: 'div' }}
                        secondary={
                          <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                            {camera && (
                              <Chip size="small" label={camera} color="primary" sx={{ height: 20, fontSize: 10 }} />
                            )}
                            {syncGroup && (
                              <Chip size="small" label={syncGroup} color="secondary" sx={{ height: 20, fontSize: 10 }} />
                            )}
                            <Typography variant="caption" color="text.secondary">
                              {clip.duration.toFixed(1)}s • Track: {clip.trackId}
                            </Typography>
                          </Stack>
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
            
            {syncInProgress && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <CircularProgress size={24} />
                <Stack spacing={0.5}>
                  <Typography variant="body2">
                    Synchronizing clips... This may take a few moments.
                  </Typography>
                  {syncJobId && (
                    <Typography variant="caption" color="text.secondary">
                      Tracking job: {syncJobId}
                    </Typography>
                  )}
                </Stack>
              </Box>
            )}

            {/* Sync Results with Manual Adjustment */}
            {syncResults && syncPreviewMode && !syncInProgress && (
              <Box>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                  Sync Results & Manual Adjustment
                </Typography>
                
                {/* Overall Quality Indicator */}
                {(() => {
                  const confidences = Object.values(syncResults).map(r => r.confidence || 0);
                  const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
                  const qualityColor = avgConfidence > 0.8 ? 'success' : avgConfidence > 0.6 ? 'warning' : 'error';
                  const qualityLabel = avgConfidence > 0.8 ? 'Excellent' : avgConfidence > 0.6 ? 'Good' : 'Poor';
                  
                  return (
                    <Alert 
                      severity={qualityColor} 
                      sx={{ mb: 2 }}
                      icon={<Sync />}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 600}}>
                        Overall Sync Quality: {qualityLabel} ({(avgConfidence * 100).toFixed(1)}%)
                      </Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={avgConfidence * 100} 
                        color={qualityColor}
                        sx={{ mt: 1, height: 6, borderRadius: 3 }}
                      />
                    </Alert>
                  );
                })()}

                {/* Clip-by-Clip Adjustments */}
                <List sx={{ maxHeight: 300, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  {Object.entries(syncResults).map(([clipId, result]) => {
                    const clip = clips.find(c => c.id === clipId);
                    if (!clip) return null;
                    
                    const confidence = result.confidence || 0;
                    const confidenceColor = confidence > 0.8 ? 'success' : confidence > 0.6 ? 'warning' : 'error';
                    const manualOffset = manualOffsets[clipId] ?? result.offset_seconds;
                    const hasManualAdjustment = Math.abs(manualOffset - result.offset_seconds) > 0.01;
                    
                    return (
                      <ListItem key={clipId} sx={{ flexDirection: 'column', alignItems: 'stretch', py: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600}}>
                            {clip.name}
                          </Typography>
                          <Chip 
                            size="small" 
                            label={`${(confidence * 100).toFixed(0)}%`}
                            color={confidenceColor}
                            sx={{ height: 20, fontSize: 10 }}
                          />
                        </Box>
                        
                        {/* Confidence Bar */}
                        <Box sx={{ mb: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">
                              Confidence
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {confidence < 0.6 && '⚠️ Low confidence - manual adjustment recommended'}
                            </Typography>
                          </Box>
                          <LinearProgress 
                            variant="determinate" 
                            value={confidence * 100} 
                            color={confidenceColor}
                            sx={{ height: 6, borderRadius: 3 }}
                          />
                        </Box>

                        {/* Manual Offset Adjustment */}
                        <Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Typography variant="caption" color="text.secondary">
                              Offset: {manualOffset >= 0 ? '+' : ', '}{manualOffset.toFixed(3)}s ({result.offset_frames || Math.round(manualOffset * 30)} frames)
                            </Typography>
                            <Stack direction="row" spacing={0.5}>
                              {typeof result.drift_ppm === 'number' && (
                                <Chip
                                  size="small"
                                  color={Math.abs(result.drift_ppm) > 80 ? 'warning' : 'default'}
                                  label={`Drift ${result.drift_ppm.toFixed(1)} ppm`}
                                  sx={{ height: 18, fontSize: 9 }}
                                />
                              )}
                              <Chip
                                size="small"
                                label={result.method || 'audio_waveform'}
                                variant="outlined"
                                sx={{ height: 18, fontSize: 9 }}
                              />
                              {hasManualAdjustment && (
                                <Chip 
                                  size="small" 
                                  label="Manual" 
                                  color="info"
                                  sx={{ height: 18, fontSize: 9 }}
                                />
                              )}
                            </Stack>
                          </Box>
                          <Slider
                            value={manualOffset}
                            onChange={(_, value) => {
                              const numericValue = Array.isArray(value) ? value[0] : value;
                              setManualOffsets(prev => ({
                                ...prev,
                                [clipId]: numericValue
                              }));
                            }}
                            min={-5}
                            max={5}
                            step={0.001}
                            marks={[
                              { value: -5, label: '-5s' },
                              { value: 0, label: '0s' },
                              { value: 5, label: '+5s' }
                            ]}
                            valueLabelDisplay="auto"
                            valueLabelFormat={(value) => `${value >= 0 ? '+' : ', '}${value.toFixed(3)}s`}
                            sx={{ mt: 1 }}
                          />
                          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                            <Button 
                              size="small" 
                              variant="outlined"
                              onClick={() => {
                                setManualOffsets(prev => ({
                                  ...prev,
                                  [clipId]: result.offset_seconds
                                }));
                              }}
                            >
                              Reset
                            </Button>
                            <Button 
                              size="small" 
                              variant="outlined"
                              onClick={() => {
                                setManualOffsets(prev => ({
                                  ...prev,
                                  [clipId]: 0
                                }));
                              }}
                            >
                              Clear
                            </Button>
                          </Box>
                        </Box>
                      </ListItem>
                    );
                  })}
                </List>

                {/* Temporal Alignment Visualization */}
                <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    Temporal Alignment Preview
                  </Typography>
                  <Box sx={{ position: 'relative', height: 120, bgcolor: 'grey.100', borderRadius: 1, overflow: 'hidden' }}>
                    {Object.entries(syncResults).map(([clipId, result], idx) => {
                      const clip = clips.find(c => c.id === clipId);
                      if (!clip) return null;
                      
                      const manualOffset = manualOffsets[clipId] ?? result.offset_seconds;
                      const confidence = result.confidence || 0;
                      const confidenceColor = confidence > 0.8 ? '#4caf50' : confidence > 0.6 ? '#ff9800' : '#f44336';
                      
                      // Visualize alignment (simplified - shows relative positions)
                      const baseY = 20 + (idx * 25);
                      const offsetPx = (manualOffset / 5) * 200; // Scale to visualization width
                      
                      return (
                        <Box
                          key={clipId}
                          sx={{
                            position: 'absolute',
                            left: 200 + offsetPx,
                            top: baseY,
                            width: 100,
                            height: 20,
                            bgcolor: confidenceColor,
                            borderRadius: 1,
                            opacity: 0.8,
                            border: '1px solid',
                            borderColor: 'grey.400',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 10,
                            color: 'white',
                            fontWeight: 600}}
                        >
                          {clip.name.substring(0, 10)}
                        </Box>
                      );
                    })}
                    {/* Reference line */}
                    <Box
                      sx={{
                        position: 'absolute',
                        left: 200,
                        top: 0,
                        bottom: 0,
                        width: 2,
                        bgcolor: 'primary.main',
                        opacity: 0.5}}
                    />
                    <Typography
                      variant="caption"
                      sx={{
                        position: 'absolute',
                        left: 200,
                        top: 0,
                        transform: 'translateX(-50%)',
                        bgcolor: 'primary.main',
                        color: 'white',
                        px: 0.5,
                        borderRadius: 0.5,
                        fontSize: 9}}
                    >
                      Reference
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Visual representation of clip alignment. Green = high confidence, Orange = medium, Red = low.
                  </Typography>
                </Box>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeSyncDialog}>
            {syncPreviewMode ? 'Cancel' : 'Close'}
          </Button>
          {syncPreviewMode && syncResults ? (
            <>
              <Button
                variant="outlined"
                onClick={() => {
                  setSyncPreviewMode(false);
                  setSyncResults(null);
                  setManualOffsets({});
                }}
              >
                Back to Edit
              </Button>
              <Button
                data-testid="sync-apply-button"
                variant="contained"
                onClick={() => {
                  void applySyncToTimeline();
                }}
              >
                Apply Sync
              </Button>
            </>
          ) : (
            <Button
              data-testid="sync-run-button"
              variant="contained"
              onClick={() => {
                void executeSyncClips();
              }}
              disabled={selectedSyncClips.size < 2 || syncInProgress}
              startIcon={syncInProgress ? <CircularProgress size={16} /> : <Sync />}
            >
              {syncInProgress ? 'Syncing...' : 'Sync Clips'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog
        open={showCompositionGuideDialog}
        onClose={() => setShowCompositionGuideDialog(false)}
        maxWidth="md"
        fullWidth
        data-testid="composition-guides-dialog"
      >
        <DialogTitle>Cinematography Composition Guides</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={showCompositionGuides}
                  onChange={(event) => setShowCompositionGuides(event.target.checked)}
                />
              }
              label="Enable monitor composition guides"
            />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <FormControl fullWidth size="small">
                <InputLabel id="composition-guide-target-label">Guide Target</InputLabel>
                <Select
                  labelId="composition-guide-target-label"
                  value={compositionGuideTarget}
                  label="Guide Target"
                  data-testid="composition-guide-target-select"
                  onChange={(event) =>
                    setCompositionGuideTarget(event.target.value as CinematographyGuideTarget)
                  }
                >
                  <MenuItem value="both">Source + Program</MenuItem>
                  <MenuItem value="source">Source only</MenuItem>
                  <MenuItem value="program">Program only</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth size="small">
                <InputLabel id="composition-aspect-mask-label">Aspect Mask</InputLabel>
                <Select
                  labelId="composition-aspect-mask-label"
                  value={compositionAspectMask}
                  label="Aspect Mask"
                  data-testid="composition-aspect-mask-select"
                  onChange={(event) =>
                    setCompositionAspectMask(event.target.value as CinematographyAspectMask)
                  }
                >
                  {CINEMATOGRAPHY_ASPECT_MASKS.map((ratio) => (
                    <MenuItem key={ratio} value={ratio}>
                      {ratio === 'none' ? 'None' : ratio}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth size="small">
                <InputLabel id="composition-spiral-orientation-label">Spiral Orientation</InputLabel>
                <Select
                  labelId="composition-spiral-orientation-label"
                  value={compositionSpiralOrientation}
                  label="Spiral Orientation"
                  data-testid="composition-spiral-orientation-select"
                  onChange={(event) =>
                    setCompositionSpiralOrientation(
                      event.target.value as CinematographySpiralOrientation
                    )
                  }
                >
                  {CINEMATOGRAPHY_SPIRAL_ORIENTATIONS.map((orientation) => (
                    <MenuItem key={orientation} value={orientation}>
                      {orientation}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>

            <Divider />

            <Typography variant="subtitle2">Guide Set</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flexWrap="wrap">
              <FormControlLabel
                control={
                  <Switch
                    checked={compositionGuides.ruleOfThirds}
                    onChange={(event) => updateCompositionGuide('ruleOfThirds', event.target.checked)}
                    inputProps={{ 'data-testid': 'composition-toggle-rule-of-thirds' }}
                  />
                }
                label="Rule of Thirds"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={compositionGuides.centerCrosshair}
                    onChange={(event) =>
                      updateCompositionGuide('centerCrosshair', event.target.checked)
                    }
                  />
                }
                label="Center Crosshair"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={compositionGuides.goldenRatio}
                    onChange={(event) => updateCompositionGuide('goldenRatio', event.target.checked)}
                  />
                }
                label="Golden Ratio"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={compositionGuides.goldenSpiral}
                    onChange={(event) => updateCompositionGuide('goldenSpiral', event.target.checked)}
                  />
                }
                label="Golden Spiral"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={compositionGuides.diagonals}
                    onChange={(event) => updateCompositionGuide('diagonals', event.target.checked)}
                  />
                }
                label="Diagonals"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={compositionGuides.dynamicSymmetry}
                    onChange={(event) =>
                      updateCompositionGuide('dynamicSymmetry', event.target.checked)
                    }
                  />
                }
                label="Dynamic Symmetry"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={compositionGuides.safeAreas}
                    onChange={(event) => updateCompositionGuide('safeAreas', event.target.checked)}
                  />
                }
                label="Safe Areas"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={compositionGuides.eyeLine}
                    onChange={(event) => updateCompositionGuide('eyeLine', event.target.checked)}
                  />
                }
                label="Eye Line"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={compositionGuides.headroomLeadroom}
                    onChange={(event) =>
                      updateCompositionGuide('headroomLeadroom', event.target.checked)
                    }
                  />
                }
                label="Headroom / Leadroom"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={compositionGuides.horizonLine}
                    onChange={(event) => updateCompositionGuide('horizonLine', event.target.checked)}
                  />
                }
                label="Horizon Line"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={compositionGuides.perspective}
                    onChange={(event) => updateCompositionGuide('perspective', event.target.checked)}
                  />
                }
                label="Perspective Lines"
              />
            </Stack>

            <Divider />

            <Typography variant="subtitle2">Visual Style</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems="center">
              <TextField
                label="Guide Color"
                type="color"
                value={compositionGuideColor}
                onChange={(event) => setCompositionGuideColor(event.target.value)}
                size="small"
                sx={{ width: 120 }}
                inputProps={{ 'data-testid': 'composition-guide-color' }}
              />
              <Box sx={{ width: 240 }}>
                <Typography variant="caption" color="text.secondary">
                  Opacity {Math.round(compositionGuideOpacity * 100)}%
                </Typography>
                <Slider
                  value={compositionGuideOpacity}
                  min={0.1}
                  max={1}
                  step={0.05}
                  onChange={(_, value) =>
                    setCompositionGuideOpacity(typeof value === 'number' ? value : value[0])
                  }
                />
              </Box>
              <Box sx={{ width: 240 }}>
                <Typography variant="caption" color="text.secondary">
                  Thickness {compositionGuideThickness.toFixed(1)} px
                </Typography>
                <Slider
                  value={compositionGuideThickness}
                  min={1}
                  max={6}
                  step={0.5}
                  onChange={(_, value) =>
                    setCompositionGuideThickness(typeof value === 'number' ? value : value[0])
                  }
                />
              </Box>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button data-testid="composition-guides-reset" onClick={resetCompositionGuides}>
            Reset Defaults
          </Button>
          <Button
            data-testid="composition-guides-done"
            onClick={() => setShowCompositionGuideDialog(false)}
            variant="contained"
          >
            Done
          </Button>
        </DialogActions>
      </Dialog>

      {/* Batch Audio Enhancement Dialog */}
      <BatchAudioEnhancementDialog
        open={showBatchAudioDialog}
        onClose={() => {
          setShowBatchAudioDialog(false);
          setBatchAudioFiles([]);
        }}
        audioFiles={batchAudioFiles}
        onBatchComplete={(results) => {
          // Add all successfully enhanced files to timeline
          results.forEach((result) => {
            if (result.status === 'success' && result.enhancedUrl) {
              const targetTrackId = 'audio-1';

              setTracks((prev) => {
                if (!prev.find(t => t.id === targetTrackId)) {
                  const newTrack: Track = { id: targetTrackId, name: targetTrackId, type: 'audio', height: 40 };
                  return [...prev, newTrack];
                }
                return prev;
              });

              setClips((prev) => {
                const trackClips = prev.filter(c => c.trackId === targetTrackId);
                const end = trackClips.length > 0 ? Math.max(...trackClips.map(c => c.start + c.duration)) : 0;

                const id = 'clip_' + Date.now() + '_' + Math.random();
                const newClip = {
                  id,
                  name: result.file.name + ' (Forbedret)',
                  beatName: result.file.name + ' (Forbedret)',
                  start: end,
                  duration: 120, // Default duration
                  ev: 0, // Neutral emotional value
                  synopsis: `Forbedret: ${result.metrics?.loudness?.standard} (${result.metrics?.loudness?.final_lufs?.toFixed(1)} LUFS)`,
                  trackId: targetTrackId,
                  color: '#16a34a',
                  sourceFile: result.enhancedUrl,
                  enhanced: true,  // Mark as enhanced
                  enhancedPreset: result.metrics?.loudness?.standard || 'Enhanced',  // Store preset name
                } as BeatClip;

                const next = [...prev, newClip];
                const maxEnd = Math.max(...next.map(c => c.start + c.duration), storyArc?.totalDuration || 0);
                setTotalDuration(maxEnd);
                return next;
              });
            }
          });

          setShowBatchAudioDialog(false);
          setBatchAudioFiles([]);

          // Show success message
          const successCount = results.filter(r => r.status === 'success').length;
          setSnackbar({
            open: true,
            message: `${successCount} lydfiler forbedret og lagt til i tidslinjen!`,
            severity: 'success'
          });
        }}
        defaultPreset="auto"
      />

      {/* AI Audio Assistant Dialog */}
      <AIAudioAssistantDialog
        open={showAIAudioAssistant}
        onClose={() => {
          setShowAIAudioAssistant(false);
          setSelectedAudioTrackId(null);
          setOpenMixerDirectly(false);
        }}
        audioTracks={clips
          .filter(c => c.trackId?.startsWith('A') || c.trackId?.startsWith('audio'))
          .map(c => ({
            id: c.id,
            name: c.name || c.id,
            sourceFile: c.sourceFile || '',
            type: undefined  // Let AI auto-classify
          }))
        }
        selectedTrackId={selectedAudioTrackId}
        openMixerDirectly={openMixerDirectly}
        onMixComplete={(mixedAudioUrl, metrics) => {
          // Add mixed audio to timeline as a new track
          const mixedTrackId = 'audio-mixed';

          setTracks((prev) => {
            if (!prev.find(t => t.id === mixedTrackId)) {
              const newTrack: Track = { id: mixedTrackId, name: 'AI Mixed Audio', type: 'audio', height: 40 };
              return [...prev, newTrack];
            }
            return prev;
          });

          setClips((prev) => {
            const id = 'clip_ai_mixed_' + Date.now();
            const newClip = {
              id,
              name: 'AI Mixed Audio',
              beatName: 'AI Mixed Audio',
              start: 0,
              duration: metrics.duration_seconds || 120,
              ev: 0, // Neutral emotional value
              synopsis: `AI Mixed: ${metrics.tracks_processed} tracks (${metrics.final_lufs?.toFixed(1)} LUFS)`,
              trackId: mixedTrackId,
              color: '#9333ea',
              sourceFile: mixedAudioUrl,
              enhanced: true,
              enhancedPreset: 'AI Mixed',
            } as BeatClip;

            const next = [...prev, newClip];
            const maxEnd = Math.max(...next.map(c => c.start + c.duration), storyArc?.totalDuration || 0);
            setTotalDuration(maxEnd);
            return next;
          });

          setShowAIAudioAssistant(false);

          // Show success message
          setSnackbar({
            open: true,
            message: `AI-miksing fullført! ${metrics.tracks_processed} spor mikset til ${metrics.final_lufs?.toFixed(1)} LUFS`,
            severity: 'success'
          });
        }}
      />
      
      {/* Face Detection Progress Dialog */}
      <Dialog 
        open={showFaceDetectionDialog} 
        onClose={() => {
          if (!faceDetectionRunning) {
            setShowFaceDetectionDialog(false);
          }
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Face Detection Progress (FaceXFormer)
          {faceDetectionRunning && (
            <Chip 
              label="Running" 
              color="primary" 
              size="small" 
              sx={{ ml: 2 }}
            />
          )}
        </DialogTitle>
        <DialogContent>
          {faceDetectionProgress && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Processing clips: {faceDetectionProgress.processed} / {faceDetectionProgress.total}
                </Typography>
                <LinearProgress 
                  variant="determinate"
                  value={faceDetectionProgress.total > 0 ? (faceDetectionProgress.processed / faceDetectionProgress.total) * 100 : 0}
                  sx={{ mt: 1, height: 8, borderRadius: 1 }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, textAlign: 'right', display: 'block' }}>
                  {faceDetectionProgress.total > 0 ? Math.round((faceDetectionProgress.processed / faceDetectionProgress.total) * 100) : 0}%
                </Typography>
              </Box>
              
              {faceDetectionProgress.current && (
                <Alert severity="info">
                  Analyzing: {clips.find(c => c.id === faceDetectionProgress?.current)?.name || faceDetectionProgress.current}
                </Alert>
              )}
              
              <Divider />
              
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Results Summary
                </Typography>
                <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                  <Chip 
                    label={`${faceDetectionProgress.results.filter(r => r.hasFace).length} with faces`}
                    color="success"
                    size="small"
                  />
                  <Chip 
                    label={`${faceDetectionProgress.results.filter(r => !r.hasFace).length} without faces`}
                    color="default"
                    size="small"
                  />
                  {faceDetectionProgress.errors.length > 0 && (
                    <Chip 
                      label={`${faceDetectionProgress.errors.length} errors`}
                      color="error"
                      size="small"
                    />
                  )}
                </Stack>
              </Box>
              
              {/* Show comprehensive analysis results for completed clips */}
              {faceDetectionProgress.results.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Analysis Details
                  </Typography>
                  <Stack spacing={1} sx={{ mt: 1 }}>
                    {faceDetectionProgress.results
                      .filter(r => r.hasFace && r.comprehensiveAnalysis)
                      .slice(0, 3)
                      .map((result, idx) => {
                        const clip = clips.find(c => c.id === result.clipId);
                        const analysis = result.comprehensiveAnalysis;
                        return (
                          <Paper key={idx} variant="outlined" sx={{ p: 1.5 }}>
                            <Typography variant="caption" fontWeight={600}>
                              {clip?.name || result.clipId}
                            </Typography>
                            <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
                              {analysis?.landmarks && (
                                <Chip label={`${analysis.landmarks.count} landmarks`} size="small" />
                              )}
                              {analysis?.headpose && (
                                <Chip 
                                  label={`Head: ${analysis.headpose.pitch.toFixed(0)}°/${analysis.headpose.yaw.toFixed(0)}°/${analysis.headpose.roll.toFixed(0)}°`} 
                                  size="small" 
                                />
                              )}
                              {analysis?.parsing && (
                                <Chip label="Parsing" size="small" />
                              )}
                              {analysis?.attributes && (
                                <Chip label={`${analysis.attributes.count} attributes`} size="small" />
                              )}
                            </Stack>
                          </Paper>
                        );
                      })}
                  </Stack>
                </Box>
              )}
              
              {faceDetectionProgress.errors.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" color="error" gutterBottom>
                    Errors:
                  </Typography>
                  {faceDetectionProgress.errors.slice(0, 5).map((error, idx) => (
                    <Alert key={idx} severity="error" sx={{ mt: 1 }}>
                      {clips.find(c => c.id === error.clipId)?.name || error.clipId}: {error.error}
                    </Alert>
                  ))}
                  {faceDetectionProgress.errors.length > 5 && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                      ... and {faceDetectionProgress.errors.length - 5} more errors
                    </Typography>
                  )}
                </Box>
              )}
              
              {!faceDetectionRunning && faceDetectionProgress.processed === faceDetectionProgress.total && (
                <Alert severity="success">
                  Face detection complete! Clips with faces have been automatically tagged.
                  {faceDetectionProgress.results.filter(r => r.hasFace).length > 0 && (
                    <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
                      View comprehensive analysis in Inspector Panel for selected clips.
                    </Typography>
                  )}
                </Alert>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              if (faceDetectionRunning) {
                faceDetectionWorker.cancel();
                setFaceDetectionRunning(false);
              } else {
                setShowFaceDetectionDialog(false);
              }
            }}
          >
            {faceDetectionRunning ? 'Cancel': 'Close'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Push Notification Settings Dialog */}
      {isSupported && (
        <Dialog open={pushSettingsOpen} onClose={() => setPushSettingsOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Push-varsler innstillinger</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <PushNotificationSettings userId={userId} showDescription={false} />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPushSettingsOpen(false)}>Lukk</Button>
          </DialogActions>
        </Dialog>
      )}
    </ThemeProvider>
  );
}

// Helpers
function resolveOverlaps(clips: BeatClip[], trackId: string): BeatClip[] {
  const byTrack = clips.filter(c => c.trackId === trackId).sort((a, b) => a.start - b.start);
  for (let i = 1; i < byTrack.length; i++) {
    const prev = byTrack[i - 1];
    const cur = byTrack[i];
    const prevEnd = prev.start + prev.duration;
    if (cur.start < prevEnd) {
      const delta = prevEnd - cur.start;
      cur.start += delta;
    }
  }
  return clips.map(c => byTrack.find(x => x.id === c.id) || c);
}

function newTrackIdForClip(clips: BeatClip[], id: string): string | null {
  const found = clips.find(c => c.id === id);
  return found ? found.trackId : null;
}

function findNearestCut(clips: BeatClip[], tracks: Track[], currentTime: number, preferredTrackId?: string): { time: number; trackId: string } {
  const collect = (trackId: string) =>
    clips
      .filter(c => c.trackId === trackId)
      .flatMap(c => [c.start, c.start + c.duration])
      .map(t => ({ time: t, trackId }));

  let candidates: { time: number; trackId: string }[] = [];
  if (preferredTrackId) candidates = collect(preferredTrackId);
  if (candidates.length === 0) {
    const uniqueTracks = Array.from(new Set(clips.map(c => c.trackId)));
    for (const tid of uniqueTracks) candidates.push(...collect(tid));
  }
  if (candidates.length === 0) {
    const fallbackTrack = preferredTrackId || tracks[0]?.id || 'act_1';
    return { time: currentTime, trackId: fallbackTrack };
  }
  candidates.sort((a, b) => Math.abs(a.time - currentTime) - Math.abs(b.time - currentTime));
  return candidates[0];
}

// Clip operations
function splitClip(clips: BeatClip[], clipId: string, time: number): BeatClip[] {
  const idx = clips.findIndex(c => c.id === clipId);
  if (idx < 0) return clips;
  const c = clips[idx];
  if (time <= c.start || time >= c.start + c.duration) return clips;
  const leftDur = time - c.start;
  const rightDur = c.duration - leftDur;
  const left = { ...c, id: c.id + '_L', duration: leftDur } as BeatClip;
  const right = { ...c, id: c.id + '_R', start: time, duration: rightDur } as BeatClip;
  const next = [...clips];
  next.splice(idx, 1, left, right);
  return next;
}

function duplicateClip(clips: BeatClip[], clipId: string): BeatClip[] {
  const c = clips.find(x => x.id === clipId);
  if (!c) return clips;
  const copy = { ...c, id: c.id +'_copy', start: c.start + c.duration + 0.1 } as BeatClip;
  return [...clips, copy];
}

function deleteClip(clips: BeatClip[], clipId: string, ripple: boolean): BeatClip[] {
  const c = clips.find(x => x.id === clipId);
  if (!c) return clips;
  const next = clips.filter(x => x.id !== clipId);
  if (ripple) {
    const trackId = c.trackId;
    // Shift subsequent clips left by removed duration gap
    next.sort((a,b) => a.start - b.start);
    const shift = c.duration;
    let encountered = false;
    for (const clip of next) {
      if (clip.trackId !== trackId) continue;
      if (!encountered && clip.start >= c.start) encountered = true;
      if (encountered) clip.start = Math.max(0, clip.start - shift);
    }
  }
  return next;
}

/**
 * Group face detection timestamps into continuous segments
 * @param timestamps - Array of timestamps where faces were detected
 * @param clipDuration - Total duration of the clip
 * @param gapThreshold - Maximum gap between detections to consider them part of the same segment (in seconds)
 * @param minSegmentDuration - Minimum duration for a segment to be created (in seconds)
 * @returns Array of segments with start time and duration
 */
function groupFaceDetectionsIntoSegments(
  timestamps: number[],
  clipDuration: number,
  gapThreshold: number = 2.0, // 2 seconds gap threshold
  minSegmentDuration: number = 1.0 // Minimum 1 second segment
): Array<{ start: number; duration: number }> {
  if (timestamps.length === 0) return [];
  
  // Sort timestamps
  const sorted = [...timestamps].sort((a, b) => a - b);
  
  const segments: Array<{ start: number; duration: number }> = [];
  let currentSegmentStart = sorted[0];
  let currentSegmentEnd = sorted[0];
  
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i] - currentSegmentEnd;
    
    if (gap <= gapThreshold) {
      // Continue current segment
      currentSegmentEnd = sorted[i];
    } else {
      // End current segment and start new one
      const segmentDuration = currentSegmentEnd - currentSegmentStart + 0.5; // Add small buffer
      if (segmentDuration >= minSegmentDuration) {
        segments.push({
          start: Math.max(0, currentSegmentStart - 0.25), // Start slightly before first detection
          duration: Math.min(segmentDuration + 0.5, clipDuration - currentSegmentStart), // End slightly after last detection
        });
      }
      currentSegmentStart = sorted[i];
      currentSegmentEnd = sorted[i];
    }
  }
  
  // Add final segment
  const segmentDuration = currentSegmentEnd - currentSegmentStart + 0.5;
  if (segmentDuration >= minSegmentDuration) {
    segments.push({
      start: Math.max(0, currentSegmentStart - 0.25),
      duration: Math.min(segmentDuration + 0.5, clipDuration - currentSegmentStart),
    });
  }
  
  return segments;
}
