import React, { Suspense, lazy, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useLocation as useWouterLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { PushNotificationSettings } from './shared/PushNotificationSettings';
import {
  Box,
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
  CircularProgress,
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
  Loop,
  KeyboardArrowLeft,
  KeyboardArrowRight,
  Speed as Speed,
  Face as FaceIcon,
  Sync,
  MovieFilter,
  AutoFixHigh as AutoFixHighIcon,
  GpsFixed,
  Notifications,
  NotificationsActive,
  CheckCircle,
  FilterVintage,
  Palette,
  TextFields,
  Subtitles,
  MusicNote,
  RemoveCircle,
} from '@mui/icons-material';
import { ThemeProvider } from '@mui/material/styles';
import type { SelectChangeEvent } from '@mui/material/Select';
import { storyArcStudioTheme } from '../theme/storyArcStudioTheme';
import EnhancementRatingDialog from './ai-training/EnhancementRatingDialog';
import AudioEnhancementDialog from './audio/AudioEnhancementDialog';
import BatchAudioEnhancementDialog from './audio/BatchAudioEnhancementDialog';
import AIAudioAssistantDialog from './audio/AIAudioAssistantDialog';
import StoryArcDataIntegration, { type BeatClip, type Track, type StoryArc } from '../services/storyArcDataIntegration';
import ProfessionalTimeline, {
  AUDIO_TRACK_ROLE_OPTIONS,
  type AudioTrackRole,
  type TimelineMarker,
  type TrackState,
  type TimelineTransition,
} from './ProfessionalTimeline';
import AssetBrowser from './AssetBrowser';
import StoryArcAutoMonitor from './StoryArcAutoMonitor';
import InspectorPanel from './InspectorPanel';
import StoryArcStudioLogo from './ui/StoryArcStudioLogo';
import { videoEngine } from '../services/video-playback-engine';
import { timelineEngine } from '../services/timeline-engine';
import {
  getCulturalHighlights,
  formatShotListForAI,
  generateAIPrompt,
  generateWorklogDescription,
  type ProjectToEditorData,
  type EditorToProjectResult,
} from '../utils/story-arc-project-integration';
import ProfessionalWaveform from './timeline/ProfessionalWaveform';
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
import { pixiFilterEngine, type FilterConfig } from '../services/pixi-filter-engine';
import { textOverlayEngine, type TextOverlay } from '../services/text-overlay-engine';
import { TextAnimationEngine } from '../services/text-animation-engine';
import { ColorGradingEngine, type ColorGrade } from '../services/color-grading-engine';
import { HLSStreamingService } from '../services/hls-streaming-service';
import { webWorkerEngine } from '../services/web-worker-engine';
import { ThumbnailCacheService } from '../services/thumbnail-cache-service';
import { audioAnalysisEngine } from '../services/audio-analysis-engine';
import { SpeedRampEngine, type SpeedKeyframe } from '../services/speed-ramp-engine';
import {
  createAutoEditAlternatives,
  getDefaultAutoEditOptions,
  type AutoEditFeedbackValue,
  type AutoEditOptions,
  type AutoEditPreset,
  type AutoEditProposal,
  type AutoEditVariant,
} from '../services/auto-edit-engine';
import {
  cancelAutoEditServerJob,
  getAutoEditServerJob,
  retryAutoEditServerJob,
  startAutoEditServerJob,
  type AutoEditServerContext,
  type AutoEditServerJobState,
  type AutoEditServerRankingResult,
} from '../services/auto-edit-server';
import {
  getStoryIntentProfile,
  getStoryIntentProfiles,
} from '../services/story-intent-profiles';
import type { CaptionSegment } from './timeline/AutoCaptionsPanel';
import {
  audioSyncEngine,
  type AudioSyncClipInput,
  type AudioSyncResult as EngineAudioSyncResult,
} from '../services/audio-sync-engine';
import { type FaceDetectionProgress } from '../services/face-detection-worker';
import { useStoryArcOnboardingFlow, type RecentStoryArcProject } from './story-arc-studio/hooks/useStoryArcOnboardingFlow';
import { useStoryArcSyncUiActions } from './story-arc-studio/hooks/useStoryArcSyncUiActions';
import { useStoryArcFaceDetectionFlow } from './story-arc-studio/hooks/useStoryArcFaceDetectionFlow';
import { useStoryArcLongJobManager } from './story-arc-studio/hooks/useStoryArcLongJobManager';
import { useStoryArcPanelStateReducer } from './story-arc-studio/hooks/useStoryArcPanelStateReducer';
import { useStoryArcTimelineHandlers } from './story-arc-studio/hooks/useStoryArcTimelineHandlers';
import { useStoryArcMonitorHandlers } from './story-arc-studio/hooks/useStoryArcMonitorHandlers';
import { useStoryArcAudioFlows } from './story-arc-studio/hooks/useStoryArcAudioFlows';
import { useStoryArcPanelFlows } from './story-arc-studio/hooks/useStoryArcPanelFlows';
import {
  StoryArcMonitorSection,
  StoryArcSidePanel,
  StoryArcTimelineSection,
  StoryArcTopBar,
} from './story-arc-studio/sections/StoryArcLayoutSections';
import { StoryArcSyncDialog } from './story-arc-studio/sections/StoryArcSyncDialog';
import { StoryArcFaceDetectionDialog } from './story-arc-studio/sections/StoryArcFaceDetectionDialog';
import {
  StoryArcSceneDetectionDialog,
  type StoryArcSceneDetectionProgress,
} from './story-arc-studio/sections/StoryArcSceneDetectionDialog';
import {
  isRecord,
  normalizeAIGeneratedPayload,
  normalizeSceneDetectionProgress,
  toErrorMessage,
} from './story-arc-studio/storyArcStudioNormalizers';
import type { StoryArcClipMeta } from './story-arc-studio/types';
import { enforceTimelineInvariants } from './story-arc-studio/timelineInvariants';
const loadExportDialog = () => import('./ExportDialog');
const loadAIStoryGeneratorDialog = () => import('./timeline/AIStoryGeneratorDialog');
const loadDaVinciResolveExportDialog = () => import('./timeline/DaVinciResolveExportDialog');
const loadTransitionLibrary = () => import('./timeline/TransitionLibrary');
const loadSpeedRampPanel = () => import('./timeline/SpeedRampPanel');
const loadTextOverlayPanel = () => import('./timeline/TextOverlayPanel');
const loadGPUFiltersPanel = () => import('./timeline/GPUFiltersPanel');
const loadColorGradingPanel = () => import('./timeline/ColorGradingPanel');
const loadAutoCaptionsPanel = () => import('./timeline/AutoCaptionsPanel');
const loadBeatSyncPanel = () => import('./timeline/BeatSyncPanel');
const loadBackgroundRemovalPanel = () => import('./timeline/BackgroundRemovalPanel');
const loadMotionTrackingPanel = () => import('./timeline/MotionTrackingPanel');
const loadObjectSegmentationPanel = () => import('./timeline/ObjectSegmentationPanel');
const loadHLSImportDialog = () => import('./timeline/HLSImportDialog');
const loadLUTLibrary = () => import('./timeline/LUTLibrary');

const ExportDialog = lazy(loadExportDialog);
const AIStoryGeneratorDialog = lazy(loadAIStoryGeneratorDialog);
const DaVinciResolveExportDialog = lazy(loadDaVinciResolveExportDialog);
const TransitionLibrary = lazy(loadTransitionLibrary);
const SpeedRampPanel = lazy(loadSpeedRampPanel);
const TextOverlayPanel = lazy(loadTextOverlayPanel);
const GPUFiltersPanel = lazy(loadGPUFiltersPanel);
const ColorGradingPanel = lazy(loadColorGradingPanel);
const AutoCaptionsPanel = lazy(loadAutoCaptionsPanel);
const BeatSyncPanel = lazy(loadBeatSyncPanel);
const BackgroundRemovalPanel = lazy(loadBackgroundRemovalPanel);
const MotionTrackingPanel = lazy(loadMotionTrackingPanel);
const ObjectSegmentationPanel = lazy(loadObjectSegmentationPanel);
const HLSImportDialog = lazy(loadHLSImportDialog);
const LUTLibrary = lazy(loadLUTLibrary);

const preloadExportDialog = () => { void loadExportDialog(); };
const preloadAIStoryGeneratorDialog = () => { void loadAIStoryGeneratorDialog(); };
const preloadDaVinciResolveExportDialog = () => { void loadDaVinciResolveExportDialog(); };
const preloadTransitionLibrary = () => { void loadTransitionLibrary(); };
const preloadSpeedRampPanel = () => { void loadSpeedRampPanel(); };
const preloadTextOverlayPanel = () => { void loadTextOverlayPanel(); };
const preloadGPUFiltersPanel = () => { void loadGPUFiltersPanel(); };
const preloadColorGradingPanel = () => { void loadColorGradingPanel(); };
const preloadAutoCaptionsPanel = () => { void loadAutoCaptionsPanel(); };
const preloadBeatSyncPanel = () => { void loadBeatSyncPanel(); };
const preloadBackgroundRemovalPanel = () => { void loadBackgroundRemovalPanel(); };
const preloadMotionTrackingPanel = () => { void loadMotionTrackingPanel(); };
const preloadObjectSegmentationPanel = () => { void loadObjectSegmentationPanel(); };
const preloadHLSImportDialog = () => { void loadHLSImportDialog(); };
const preloadLUTLibrary = () => { void loadLUTLibrary(); };

interface StoryArcStudioProps {
  storyArcId?: string;
  onClose?: () => void;
  // Integration props for unified workflow connectivity
  onMeetingCreate?: (meeting: Record<string, unknown>) => void;
  onProjectUpdate?: (project: Record<string, unknown>) => void;
  onWorklogCreate?: (worklog: Record<string, unknown>) => void;
  onClientSelect?: (client: Record<string, unknown>) => void;
  onClientUpdate?: (client: Record<string, unknown>) => void;
  onShowcaseCreate?: (showcase: Record<string, unknown>) => void;
  onFileUpload?: (file: Record<string, unknown>) => void;
  onFileDownload?: (file: Record<string, unknown>) => void;
  selectedProject?: {
    id?: string | number;
    name?: string;
    projectName?: string;
    [key: string]: unknown;
  } | null;
  onProjectSelect?: (project: Record<string, unknown>) => void;
  selectedClient?: Record<string, unknown> | null;
  onSettingsUpdate?: (settings: Record<string, unknown>) => void;
  onNotificationCreate?: (notification: Record<string, unknown>) => void;
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
type ResolveWorkspacePreset = 'edit' | 'cut' | 'color' | 'fairlight' | 'deliver';
type ResolveDockSlotId = 'dock-1' | 'dock-2' | 'dock-3';
type ResolveDockSlots = Record<ResolveDockSlotId, ResolveLayoutState | null>;
type ResolveWorkspaceDockSlots = Record<ResolveWorkspacePreset, ResolveDockSlots>;
type ResolveMonitorFocus = 'source' | 'program';
type ResolveWorkflowStep = 'import' | 'assemble' | 'trim' | 'polish' | 'deliver';
type ResolveWorkspaceProfiles = Record<ResolveWorkspacePreset, ResolveLayoutState | null>;
type AudioRoleFilter = AudioTrackRole | 'all';
type StoryArcShortcutCategory =
  | 'transport'
  | 'timeline'
  | 'edit-tools'
  | 'marks'
  | 'source-program'
  | 'history';

interface StoryArcShortcutBinding {
  id: string;
  label: string;
  keys: string;
  category: StoryArcShortcutCategory;
  note: string;
}

interface StoryArcShortcutTrigger {
  key: string;
  shiftKey?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
}

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

function LazyPanelFallback() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 2, py: 1.5 }}>
      <CircularProgress size={16} />
      <Typography variant="caption" color="text.secondary">
        Loading panel...
      </Typography>
    </Box>
  );
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

interface NarrativeTranscriptionSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  confidence: number;
  speakerName: string | null;
}

interface NarrativeTranscriptionResult {
  language: string;
  text: string;
  segments: NarrativeTranscriptionSegment[];
}

interface NarrativeTranscriptionJobStartResponse {
  success?: boolean;
  job_id?: string;
  error?: string;
}

interface NarrativeTranscriptionJobStatusResponse {
  success?: boolean;
  status?: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  result?: {
    transcription?: {
      language?: string;
      text?: string;
      segments?: unknown[];
    };
  };
  error?: string;
}

interface AutoEditSpeechEnrichment {
  clips: BeatClip[];
  sourcesTranscribed: number;
  clipsEnriched: number;
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

interface AssetBrowserSnippetDetail {
  id: string;
  name: string;
  type: 'transition' | 'opening' | 'closing' | 'montage' | 'dialogue' | 'action';
  duration: number;
  tags: string[];
}

interface AutoEditTimelineSnapshot {
  clips: BeatClip[];
  transitions: TimelineTransition[];
  markers: TimelineMarker[];
  selectedClipIds: string[];
}

interface AutoEditPreviewState {
  proposal: AutoEditProposal;
  alternatives: Record<AutoEditVariant, AutoEditProposal>;
  selectedVariant: AutoEditVariant;
  snapshot: AutoEditTimelineSnapshot;
  generatedAt: number;
}

interface AutoEditHistoryEntry {
  id: string;
  proposalId: string;
  projectKey: string;
  preset: AutoEditPreset;
  variant: AutoEditVariant;
  intentProfileId: string;
  confidence: number;
  duration: number;
  generatedAt: number;
  status: 'generated' | 'applied' | 'reverted' | 'failed';
  summary: string[];
  serverJobId?: string | null;
}

interface ExportedVideoResult {
  url: string;
  thumbnail?: string;
  duration?: number;
  resolution?: string;
  codec?: string;
  format?: string;
}

interface StoryArcSessionUser {
  id?: string;
  email?: string;
  isAuthenticated?: boolean;
  [key: string]: unknown;
}

interface AudioLoudnessMetrics {
  standard?: string;
  original_lufs?: number;
  final_lufs?: number;
  [key: string]: unknown;
}

interface AudioEnhancementMetrics {
  loudness?: AudioLoudnessMetrics;
  enhancement?: {
    method?: string;
    snr_improvement?: number;
    quality?: string;
    [key: string]: unknown;
  };
  duration_seconds?: number;
  tracks_processed?: number;
  final_lufs?: number;
  [key: string]: unknown;
}

interface BatchAudioEnhancementResult {
  file: File;
  status: 'pending' | 'processing' | 'success' | 'error';
  enhancedUrl?: string;
  metrics?: AudioEnhancementMetrics;
  error?: string;
}

type ColorGradeSelection = Partial<ColorGrade> & {
  name?: string;
  [key: string]: unknown;
};

interface StoryArcEditorTestHook {
  selectClipById: (clipId: string) => boolean;
  listClips: () => Array<{
    clipId: string;
    trackId: string;
    trackType: 'video' | 'audio' | 'adjustment' | 'subtitle' | 'graphics';
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
  moveSelectedByFrames: (frames: number) => boolean;
  setSafeTrimEnabled: (enabled: boolean) => void;
  getSelectedClipIds: () => string[];
  getProgramMarks: () => { inPoint: number | null; outPoint: number | null };
  getShortcutParityMatrix: () => StoryArcShortcutBinding[];
  triggerShortcut: (shortcut: StoryArcShortcutTrigger) => boolean;
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
const MIN_TIMELINE_ZOOM = 0.1;
const MAX_TIMELINE_ZOOM = 5;
const DEFAULT_TIMELINE_ZOOM = 1;
const RESOLVE_LAYOUT_STORAGE_KEY = 'storyArcStudio.resolve.layout.v1';
const RESOLVE_DOCK_SLOTS_STORAGE_KEY = 'storyArcStudio.resolve.dock-slots.v1';
const RESOLVE_WORKSPACE_DOCK_SLOTS_STORAGE_KEY = 'storyArcStudio.resolve.workspace-dock-slots.v1';
const RESOLVE_WORKSPACE_PROFILES_STORAGE_KEY = 'storyArcStudio.resolve.workspace-profiles.v1';
const TIMELINE_ZOOM_STORAGE_KEY = 'storyArcStudio.timeline.zoom.v1';
const COMPOSITION_SETTINGS_STORAGE_KEY = 'storyArcStudio.composition.settings.v1';
const ONBOARDING_COMPLETED_STORAGE_KEY = 'storyArcStudio_onboardingCompleted';
const PROJECT_CONTEXT_SESSION_STORAGE_KEY = 'storyArcStudio_projectContext';
const AUTO_EDIT_PROFILE_STORAGE_KEY = 'storyArcStudio.autoEdit.intentProfile.v1';
const AUTO_EDIT_FEEDBACK_STORAGE_KEY = 'storyArcStudio.autoEdit.feedback.v1';
const AUTO_EDIT_HISTORY_STORAGE_KEY = 'storyArcStudio.autoEdit.history.v1';
const AUTO_EDIT_PENDING_PREVIEW_STORAGE_KEY = 'storyArcStudio.autoEdit.pendingPreview.v1';
const ENABLE_EDITOR_TEST_HOOKS = import.meta.env.DEV;
const ENABLE_EXPERIMENTAL_TIMELINE_PANELS = import.meta.env.VITE_ENABLE_STORYARC_EXPERIMENTAL_PANELS !== 'false';
const AUTO_EDIT_TRANSCRIPTION_LANGUAGE = 'no';
const AUTO_EDIT_TRANSCRIPTION_POLL_INTERVAL_MS = 1500;
const AUTO_EDIT_TRANSCRIPTION_MAX_POLL_ATTEMPTS = 120;
const AUTO_EDIT_TRANSCRIPT_MAX_LENGTH = 900;
const AUTO_EDIT_TRANSCRIPT_MAX_PHRASES = 8;
const RESOLVE_WORKSPACE_PRESETS: ResolveWorkspacePreset[] = [
  'edit',
  'cut',
  'color',
  'fairlight',
  'deliver',
];
const RESOLVE_WORKSPACE_ARC_NAV_ITEMS: Array<{
  preset: ResolveWorkspacePreset;
  label: string;
  arcOffset: number;
}> = [
  { preset: 'cut', label: 'Cut', arcOffset: 9 },
  { preset: 'edit', label: 'Edit', arcOffset: 2 },
  { preset: 'color', label: 'Color', arcOffset: 0 },
  { preset: 'fairlight', label: 'Fairlight', arcOffset: 2 },
  { preset: 'deliver', label: 'Deliver', arcOffset: 9 },
];
const AUDIO_ROLE_ORDER: AudioTrackRole[] = AUDIO_TRACK_ROLE_OPTIONS.map((option) => option.value);
const RESOLVE_WORKFLOW_STEPS: Array<{
  id: ResolveWorkflowStep;
  label: string;
  hint: string;
}> = [
  { id: 'import', label: 'Import', hint: 'Ingest media, verify bins, prep source monitor' },
  { id: 'assemble', label: 'Assemble', hint: 'Insert/overwrite rough cut into timeline' },
  { id: 'trim', label: 'Trim', hint: 'Trim, roll, slip, slide and tighten pacing' },
  { id: 'polish', label: 'Polish', hint: 'Color, effects, text, sync and captions' },
  { id: 'deliver', label: 'Deliver', hint: 'Final QC, audio balance, export/render' },
];

const STORY_ARC_SHORTCUT_PARITY_MATRIX: StoryArcShortcutBinding[] = [
  { id: 'transport-space', label: 'Play/Pause', keys: 'Space', category: 'transport', note: 'Toggle active monitor playback' },
  { id: 'transport-j', label: 'Reverse Playback', keys: 'J', category: 'transport', note: 'Reverse shuttle (program) / frame step (source)' },
  { id: 'transport-k', label: 'Stop', keys: 'K', category: 'transport', note: 'Stop active monitor playback' },
  { id: 'transport-l', label: 'Forward Playback', keys: 'L', category: 'transport', note: 'Forward shuttle (program) / play source' },
  { id: 'transport-home', label: 'To Start', keys: 'Home', category: 'transport', note: 'Jump to beginning in active monitor' },
  { id: 'transport-end', label: 'To End', keys: 'End', category: 'transport', note: 'Jump to end in active monitor' },
  { id: 'timeline-step-left', label: 'Step Backward', keys: 'ArrowLeft', category: 'timeline', note: 'Step by frame on active monitor' },
  { id: 'timeline-step-right', label: 'Step Forward', keys: 'ArrowRight', category: 'timeline', note: 'Step by frame on active monitor' },
  { id: 'timeline-zoom-in', label: 'Zoom In Timeline', keys: '+ / =', category: 'timeline', note: 'Increase timeline zoom level' },
  { id: 'timeline-zoom-out', label: 'Zoom Out Timeline', keys: '-', category: 'timeline', note: 'Decrease timeline zoom level' },
  { id: 'timeline-zoom-reset', label: 'Reset Timeline Zoom', keys: 'Cmd/Ctrl + 0', category: 'timeline', note: 'Return zoom to 100%' },
  { id: 'tool-select', label: 'Select Tool', keys: 'A', category: 'edit-tools', note: 'Switch to select mode' },
  { id: 'tool-trim', label: 'Trim Tool', keys: 'T', category: 'edit-tools', note: 'Switch to trim mode' },
  { id: 'tool-roll', label: 'Roll Tool', keys: 'R', category: 'edit-tools', note: 'Switch to roll mode' },
  { id: 'tool-slip', label: 'Slip Tool', keys: 'Y', category: 'edit-tools', note: 'Switch to slip mode' },
  { id: 'tool-slide', label: 'Slide Tool', keys: 'U', category: 'edit-tools', note: 'Switch to slide mode' },
  { id: 'timeline-razor', label: 'Razor at Playhead', keys: 'C', category: 'edit-tools', note: 'Split selected clip(s)' },
  { id: 'marks-in', label: 'Mark In', keys: 'I', category: 'marks', note: 'Set In mark in active monitor' },
  { id: 'marks-out', label: 'Mark Out', keys: 'O', category: 'marks', note: 'Set Out mark in active monitor' },
  { id: 'marks-jump-in', label: 'Jump In Mark', keys: 'Shift + I', category: 'marks', note: 'Jump to In mark in active monitor' },
  { id: 'marks-jump-out', label: 'Jump Out Mark', keys: 'Shift + O', category: 'marks', note: 'Jump to Out mark in active monitor' },
  { id: 'source-insert', label: 'Insert Edit', keys: ', / F9', category: 'source-program', note: 'Insert source clip at playhead' },
  { id: 'source-overwrite', label: 'Overwrite Edit', keys: '. / F10', category: 'source-program', note: 'Overwrite at playhead' },
  { id: 'source-patch-video', label: 'Patch Video Source', keys: 'Alt + [ / Alt + ]', category: 'source-program', note: 'Cycle source video patch tracks' },
  { id: 'history-undo', label: 'Undo', keys: 'Cmd/Ctrl + Z', category: 'history', note: 'Undo last timeline operation' },
  { id: 'history-redo', label: 'Redo', keys: 'Cmd/Ctrl + Shift + Z', category: 'history', note: 'Redo timeline operation' },
];

function getSafeLocalStorageItem(key: string): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setSafeLocalStorageItem(key: string, value: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage write failures (e.g. quota/private mode).
  }
}

function getSafeLocalStorageJson<T>(key: string, fallback: T): T {
  const raw = getSafeLocalStorageItem(key);
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function setSafeLocalStorageJson(key: string, value: unknown): void {
  try {
    setSafeLocalStorageItem(key, JSON.stringify(value));
  } catch {
    // Ignore serialization/storage failures.
  }
}

function buildAutoEditClipFeedbackKey(clip: BeatClip): string {
  const source = (clip.sourceFile || clip.name || clip.id || '').trim().toLowerCase();
  const startBucket = Math.round((Number.isFinite(clip.start) ? clip.start : 0) * 10);
  const durationBucket = Math.round((Number.isFinite(clip.duration) ? clip.duration : 0) * 10);
  return `${source}|${clip.trackId}|${startBucket}|${durationBucket}`;
}

function getSafeSessionStorageItem(key: string): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function setSafeSessionStorageItem(key: string, value: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Ignore storage write failures (e.g. quota/private mode).
  }
}

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

function clampTimelineZoomValue(value: number): number {
  const clamped = Math.min(MAX_TIMELINE_ZOOM, Math.max(MIN_TIMELINE_ZOOM, value));
  return Math.round(clamped * 10) / 10;
}

function clampNumber(value: number, minValue: number, maxValue: number): number {
  return Math.min(maxValue, Math.max(minValue, value));
}

function buildAudioRoleBooleanMap(defaultValue = false): Record<AudioTrackRole, boolean> {
  return AUDIO_ROLE_ORDER.reduce<Record<AudioTrackRole, boolean>>((accumulator, role) => {
    accumulator[role] = defaultValue;
    return accumulator;
  }, {} as Record<AudioTrackRole, boolean>);
}

function inferAudioRoleFromTrackName(trackName: string): AudioTrackRole {
  const normalized = trackName.toLowerCase();
  if (normalized.includes('dialog') || normalized.includes('speech') || normalized.includes('lav')) {
    return 'dialogue';
  }
  if (normalized.includes('music') || normalized.includes('score') || normalized.includes('bgm')) {
    return 'music';
  }
  if (normalized.includes('ambi') || normalized.includes('atmo') || normalized.includes('room')) {
    return 'ambience';
  }
  if (normalized.includes('voice') || normalized.includes('vo') || normalized.includes('narr')) {
    return normalized.includes('narr') ? 'narration' : 'voiceover';
  }
  if (normalized.includes('sfx') || normalized.includes('fx') || normalized.includes('effect')) {
    return 'effects';
  }
  return 'dialogue';
}

function normalizeAutoEditKeywordToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function tokenizeAutoEditKeywords(value: string): string[] {
  return value
    .split(/[\s,;|/]+/)
    .map((token) => normalizeAutoEditKeywordToken(token))
    .filter((token) => token.length >= 3);
}

function dedupeAutoEditKeywords(
  values: Array<string | null | undefined>,
  maxItems = 28
): string[] {
  const unique: string[] = [];
  const seen = new Set<string>();
  values.forEach((value) => {
    if (!value) {
      return;
    }
    tokenizeAutoEditKeywords(value).forEach((token) => {
      if (seen.has(token) || unique.length >= maxItems) {
        return;
      }
      seen.add(token);
      unique.push(token);
    });
  });
  return unique;
}

function readFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }
  return null;
}

function sanitizeTranscriptText(value: unknown, maxLength = AUTO_EDIT_TRANSCRIPT_MAX_LENGTH): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function dedupeTranscriptPhrases(
  values: Array<string | null | undefined>,
  maxItems = AUTO_EDIT_TRANSCRIPT_MAX_PHRASES
): string[] {
  const unique: string[] = [];
  const seen = new Set<string>();
  values.forEach((value) => {
    const normalized = sanitizeTranscriptText(value, 160);
    if (!normalized) {
      return;
    }
    const dedupeKey = normalized.toLowerCase();
    if (seen.has(dedupeKey) || unique.length >= maxItems) {
      return;
    }
    seen.add(dedupeKey);
    unique.push(normalized);
  });
  return unique;
}

function normalizeNarrativeTranscriptionSegments(rawSegments: unknown): NarrativeTranscriptionSegment[] {
  if (!Array.isArray(rawSegments)) {
    return [];
  }
  return rawSegments
    .map((segment, index) => {
      if (!isRecord(segment)) {
        return null;
      }
      const start = readFiniteNumber(segment.start);
      const end = readFiniteNumber(segment.end);
      const text = sanitizeTranscriptText(segment.text, 220);
      if (start === null || end === null || !text) {
        return null;
      }
      const confidence = readFiniteNumber(segment.confidence);
      const speakerName = sanitizeTranscriptText(segment.speaker, 80);
      return {
        id: readFiniteNumber(segment.id) ?? index + 1,
        start,
        end: end >= start ? end : start,
        text,
        confidence: confidence !== null ? clampNumber(confidence, 0, 1) : 1,
        speakerName: speakerName || null,
      };
    })
    .filter((segment): segment is NarrativeTranscriptionSegment => Boolean(segment));
}

function extractTranscriptPhrases(
  segments: NarrativeTranscriptionSegment[],
  maxItems = AUTO_EDIT_TRANSCRIPT_MAX_PHRASES
): string[] {
  return dedupeTranscriptPhrases(
    segments.map((segment) => segment.text),
    maxItems
  );
}

function resolveClipSourceWindow(clip: BeatClip): { start: number; end: number; hasExplicitBounds: boolean } {
  const metadata = isRecord(clip.metadata) ? clip.metadata : null;
  const clipDuration = Number.isFinite(clip.duration) ? Math.max(0, clip.duration) : 0;
  const inPoint =
    readFiniteNumber(metadata?.inPoint) ??
    readFiniteNumber(metadata?.sourceStartTime) ??
    0;
  const configuredOutPoint = readFiniteNumber(metadata?.outPoint);
  const fallbackOutPoint = inPoint + clipDuration;
  const outPoint = configuredOutPoint !== null ? configuredOutPoint : fallbackOutPoint;
  const start = Math.max(0, Math.min(inPoint, outPoint));
  const end = Math.max(start, Math.max(inPoint, outPoint));
  const hasExplicitBounds =
    readFiniteNumber(metadata?.inPoint) !== null ||
    readFiniteNumber(metadata?.outPoint) !== null ||
    readFiniteNumber(metadata?.sourceStartTime) !== null;
  return {
    start,
    end,
    hasExplicitBounds,
  };
}

function clipTrackLooksAudio(trackId: string): boolean {
  const normalized = trackId.trim().toLowerCase();
  return normalized.startsWith('audio') || /^a\d+$/.test(normalized);
}

function isLikelyAudioTrack(track: Track): boolean {
  const normalizedTrackId = track.id.toLowerCase();
  if (track.type === 'audio') {
    return true;
  }
  if (normalizedTrackId.startsWith('audio') || /^a\d+$/.test(normalizedTrackId)) {
    return true;
  }
  return track.name.toLowerCase().includes('audio');
}

function createDefaultTrackState(track: Track): TrackState {
  const audioTrack = isLikelyAudioTrack(track);
  return {
    locked: false,
    mute: false,
    solo: false,
    visible: true,
    type: audioTrack ? 'audio' : 'video',
    audioRole: audioTrack ? inferAudioRoleFromTrackName(track.name) : undefined,
  };
}

function normalizeTrackStates(
  trackList: Track[],
  incoming: Record<string, TrackState> | null | undefined
): Record<string, TrackState> {
  const normalized: Record<string, TrackState> = {};
  trackList.forEach((track) => {
    const defaults = createDefaultTrackState(track);
    const existing = incoming?.[track.id];
    const type = existing?.type ?? defaults.type;
    normalized[track.id] = {
      ...defaults,
      ...(existing || {}),
      type,
      audioRole:
        type === 'audio'
          ? existing?.audioRole ?? defaults.audioRole ?? inferAudioRoleFromTrackName(track.name)
          : undefined,
    };
  });
  return normalized;
}

function createEmptyWorkspaceProfiles(): ResolveWorkspaceProfiles {
  return {
    edit: null,
    cut: null,
    color: null,
    fairlight: null,
    deliver: null,
  };
}

function createEmptyDockSlots(): ResolveDockSlots {
  return {
    'dock-1': null,
    'dock-2': null,
    'dock-3': null,
  };
}

function createEmptyWorkspaceDockSlots(): ResolveWorkspaceDockSlots {
  return {
    edit: createEmptyDockSlots(),
    cut: createEmptyDockSlots(),
    color: createEmptyDockSlots(),
    fairlight: createEmptyDockSlots(),
    deliver: createEmptyDockSlots(),
  };
}

function normalizeDockSlots(
  incoming: Partial<Record<ResolveDockSlotId, ResolveLayoutState | null>> | null | undefined
): ResolveDockSlots {
  const defaults = createEmptyDockSlots();
  if (!incoming) {
    return defaults;
  }

  return {
    'dock-1': incoming['dock-1'] || null,
    'dock-2': incoming['dock-2'] || null,
    'dock-3': incoming['dock-3'] || null,
  };
}

function normalizeWorkspaceDockSlots(payload: unknown): ResolveWorkspaceDockSlots {
  const defaults = createEmptyWorkspaceDockSlots();
  if (!payload || typeof payload !== 'object') {
    return defaults;
  }

  const incoming = payload as Record<string, unknown>;
  const looksLikeLegacyDockMap =
    Object.prototype.hasOwnProperty.call(incoming, 'dock-1') ||
    Object.prototype.hasOwnProperty.call(incoming, 'dock-2') ||
    Object.prototype.hasOwnProperty.call(incoming, 'dock-3');

  if (looksLikeLegacyDockMap) {
    defaults.edit = normalizeDockSlots(
      incoming as Partial<Record<ResolveDockSlotId, ResolveLayoutState | null>>
    );
    return defaults;
  }

  RESOLVE_WORKSPACE_PRESETS.forEach((preset) => {
    const candidate = incoming[preset];
    if (candidate && typeof candidate === 'object') {
      defaults[preset] = normalizeDockSlots(
        candidate as Partial<Record<ResolveDockSlotId, ResolveLayoutState | null>>
      );
    }
  });

  return defaults;
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

function withDataInputProps<T extends Record<`data-${string}`, string>>(
  attrs: T
): React.InputHTMLAttributes<HTMLInputElement> {
  return attrs as unknown as React.InputHTMLAttributes<HTMLInputElement>;
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
    const persisted = getSafeSessionStorageItem(PROJECT_CONTEXT_SESSION_STORAGE_KEY);
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
  const [timelineZoom, setTimelineZoom] = useState(DEFAULT_TIMELINE_ZOOM);
  const userAdjustedTimelineZoomRef = useRef(false);
  const timelineZoomLoadedFromStorageRef = useRef(false);
  const [selectedClips, setSelectedClips] = useState<Set<string>>(new Set());
  const [autoMonitorEnabled, setAutoMonitorEnabled] = useState(false);
  const clipMap = useMemo(() => new Map(clips.map((clip) => [clip.id, clip])), [clips]);
  const trackMap = useMemo(() => new Map(tracks.map((track) => [track.id, track])), [tracks]);
  const {
    showExportDialog,
    showAutoMonitor,
    showFaceDetectionDialog,
    showSceneDetectionDialog,
    showFaceDetectionOptionsDialog,
    showSubclipsConfirmDialog,
    showProgramMonitor,
    showCompositionGuides,
    showCompositionGuideDialog,
    showAssetPanel,
    showInspectorPanel,
    showEffectsPanel,
    showMixerPanel,
    showLUTLibraryDialog,
    showHLSImportDialog,
    showResolveExportDialog,
    settingsOpen,
    pushSettingsOpen,
    onboardingOpen,
    showAIGeneratorDialog,
    showRatingDialog,
    showTransitionLibrary,
    showSpeedRampPanel,
    showTextOverlayPanel,
    showGPUFiltersPanel,
    showColorGradingPanel,
    showAutoCaptionsPanel,
    showBeatSyncPanel,
    showMotionTrackingPanel,
    showObjectSegmentationPanel,
    showSyncDialog,
    showAudioEnhancementDialog,
    showBatchAudioDialog,
    showAIAudioAssistant,
    setShowExportDialog,
    setShowAutoMonitor,
    setShowFaceDetectionDialog,
    setShowSceneDetectionDialog,
    setShowFaceDetectionOptionsDialog,
    setShowSubclipsConfirmDialog,
    setShowProgramMonitor,
    setShowCompositionGuides,
    setShowCompositionGuideDialog,
    setShowAssetPanel,
    setShowInspectorPanel,
    setShowEffectsPanel,
    setShowMixerPanel,
    setShowLUTLibraryDialog,
    setShowHLSImportDialog,
    setShowResolveExportDialog,
    setSettingsOpen,
    setPushSettingsOpen,
    setOnboardingOpen,
    setShowAIGeneratorDialog,
    setShowRatingDialog,
    setShowTransitionLibrary,
    setShowSpeedRampPanel,
    setShowTextOverlayPanel,
    setShowGPUFiltersPanel,
    setShowColorGradingPanel,
    setShowAutoCaptionsPanel,
    setShowBeatSyncPanel,
    setShowMotionTrackingPanel,
    setShowObjectSegmentationPanel,
    setShowSyncDialog,
    setShowAudioEnhancementDialog,
    setShowBatchAudioDialog,
    setShowAIAudioAssistant,
  } = useStoryArcPanelStateReducer(DEFAULT_COMPOSITION_SETTINGS.enabled);

  // Pro timeline states
  const [trackStates, setTrackStates] = useState<Record<string, TrackState>>({});
  const [trackHeightScale, setTrackHeightScale] = useState(1);
  const [markers, setMarkers] = useState<TimelineMarker[]>([]);
  const [transitions, setTransitions] = useState<TimelineTransition[]>([]);
  const [showAutoEditDialog, setShowAutoEditDialog] = useState(false);
  const [autoEditRunning, setAutoEditRunning] = useState(false);
  const [autoEditJobId, setAutoEditJobId] = useState<string | null>(null);
  const [autoEditServerProgress, setAutoEditServerProgress] = useState<number | null>(null);
  const [autoEditIntentProfileId, setAutoEditIntentProfileId] = useState<string>(() => {
    return getSafeLocalStorageItem(AUTO_EDIT_PROFILE_STORAGE_KEY) || 'balanced-story';
  });
  const [autoEditOptions, setAutoEditOptions] = useState<AutoEditOptions>(() =>
    getDefaultAutoEditOptions('story-60')
  );
  const [autoEditPreview, setAutoEditPreview] = useState<AutoEditPreviewState | null>(null);
  const [lastAutoEditSnapshot, setLastAutoEditSnapshot] = useState<AutoEditPreviewState | null>(null);
  const [autoEditFeedbackByClipKey, setAutoEditFeedbackByClipKey] = useState<Record<string, AutoEditFeedbackValue>>(
    () => getSafeLocalStorageJson<Record<string, AutoEditFeedbackValue>>(AUTO_EDIT_FEEDBACK_STORAGE_KEY, {})
  );
  const [autoEditHistory, setAutoEditHistory] = useState<AutoEditHistoryEntry[]>(
    () => getSafeLocalStorageJson<AutoEditHistoryEntry[]>(AUTO_EDIT_HISTORY_STORAGE_KEY, [])
  );
  const appliedAutoEditProposalIdsRef = useRef<Set<string>>(new Set());
  const revertedAutoEditProposalIdsRef = useRef<Set<string>>(new Set());
  const autoEditPreviewRestoredRef = useRef(false);
  const autoEditTranscriptionCacheRef = useRef<Map<string, NarrativeTranscriptionResult>>(new Map());
  const storyIntentProfiles = useMemo(() => getStoryIntentProfiles(), []);
  const activeIntentProfile = useMemo(
    () => getStoryIntentProfile(autoEditIntentProfileId),
    [autoEditIntentProfileId]
  );
  const autoEditProjectKey = useMemo(() => {
    const explicitStoryArcId = typeof storyArcId === 'string' ? storyArcId : null;
    const storyArcEntityId = typeof storyArc?.id === 'string' ? storyArc.id : null;
    const selectedProjectId =
      selectedProject && (typeof selectedProject.id === 'string' || typeof selectedProject.id === 'number')
        ? String(selectedProject.id)
        : null;
    const projectNameRaw =
      (typeof selectedProject?.name === 'string' && selectedProject.name.trim().length > 0
        ? selectedProject.name
        : typeof selectedProject?.projectName === 'string'
          ? selectedProject.projectName
          : null) ||
      storyArc?.title ||
      'default';
    const normalizedName = projectNameRaw.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return explicitStoryArcId || storyArcEntityId || selectedProjectId || normalizedName || 'default';
  }, [selectedProject, storyArc?.id, storyArc?.title, storyArcId]);
  const autoEditHistoryForProject = useMemo(
    () => autoEditHistory.filter((entry) => entry.projectKey === autoEditProjectKey).slice(0, 12),
    [autoEditHistory, autoEditProjectKey]
  );
  const [magneticEnabled, setMagneticEnabled] = useState(true);
  const [rippleEnabled, setRippleEnabled] = useState(false);
  const [pendingTransitionType, setPendingTransitionType] = useState<string | null>(null);
  const [pendingTransitionDuration, setPendingTransitionDuration] = useState<number>(0.5);
  const [pendingTransitionEngine, setPendingTransitionEngine] = useState<'canvas2d' | 'webgl'>('canvas2d');

  // Clip metadata & collaboration
  const [clipMeta, setClipMeta] = useState<Record<string, StoryArcClipMeta>>({});
  
  // Face detection worker state
  const [faceDetectionProgress, setFaceDetectionProgress] = useState<FaceDetectionProgress | null>(null);
  const [faceDetectionRunning, setFaceDetectionRunning] = useState(false);
  
  // Scene detection worker state
  const [sceneDetectionProgress, setSceneDetectionProgress] =
    useState<StoryArcSceneDetectionProgress | null>(null);
  const [sceneDetectionJobId, setSceneDetectionJobId] = useState<string | null>(null);
  
  // Face detection options dialog state (replaces window.confirm/prompt)
  const [faceDetectionOptions, setFaceDetectionOptions] = useState<{
    scanEntire: boolean;
    fps: number;
    taskChoice: string;
  }>({ scanEntire: false, fps: 0.5, taskChoice: '1' });
  const [pendingFaceDetectionResolve, setPendingFaceDetectionResolve] = useState<((options: { scanEntire: boolean; fps: number; taskChoice: string } | null) => void) | null>(null);
  
  // Subclips confirm dialog state (replaces window.confirm for subclips)
  const [subclipsConfirmData, setSubclipsConfirmData] = useState<{ facesFound: number; totalClips: number } | null>(null);
  const [pendingSubclipsResolve, setPendingSubclipsResolve] = useState<((createSubclips: boolean) => void) | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [reviewerMode, setReviewerMode] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareSnapshot, setCompareSnapshot] = useState<BeatClip[]>([]);
  const [collabLocks] = useState<Record<string, { user?: string }>>({});
  const [comments, setComments] = useState<Array<{ id: string; time: number; text: string; clipId?: string }>>([]);
  
  // Professional transport state
  const [isLooping, setIsLooping] = useState(false);
  const [playbackDirection, setPlaybackDirection] = useState<'forward' | 'reverse'>('forward');
  const [monitorFitMode, setMonitorFitMode] = useState<'fit' | 'fill'>('fit');
  const [activeMonitor, setActiveMonitor] = useState<ResolveMonitorFocus>('program');
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
  const [workflowStep, setWorkflowStep] = useState<ResolveWorkflowStep>('assemble');
  const [safeTrimMode, setSafeTrimMode] = useState(true);
  const [workspacePreset, setWorkspacePreset] = useState<ResolveWorkspacePreset>('edit');
  const [workspaceProfiles, setWorkspaceProfiles] = useState<ResolveWorkspaceProfiles>(
    () => createEmptyWorkspaceProfiles()
  );
  const [savedDockSlotsByWorkspace, setSavedDockSlotsByWorkspace] =
    useState<ResolveWorkspaceDockSlots>(() => createEmptyWorkspaceDockSlots());
  const [layoutStateReady, setLayoutStateReady] = useState(false);
  const [workspaceProfilesReady, setWorkspaceProfilesReady] = useState(false);
  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);
  const [sourceMarkIn, setSourceMarkIn] = useState<number | null>(null);
  const [sourceMarkOut, setSourceMarkOut] = useState<number | null>(null);
  const [programMarkIn, setProgramMarkIn] = useState<number | null>(null);
  const [programMarkOut, setProgramMarkOut] = useState<number | null>(null);
  const [sourcePatchVideoTrackId, setSourcePatchVideoTrackId] = useState<string | null>(null);
  const [sourcePatchAudioTrackId, setSourcePatchAudioTrackId] = useState<string | null>(null);
  const [sourcePatchIncludeAudio, setSourcePatchIncludeAudio] = useState(true);
  const [selectedLUTName, setSelectedLUTName] = useState<string | null>(null);
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
  const [audioRoleMuteState, setAudioRoleMuteState] = useState<Record<AudioTrackRole, boolean>>(
    () => buildAudioRoleBooleanMap(false)
  );
  const [audioRoleSoloState, setAudioRoleSoloState] = useState<Record<AudioTrackRole, boolean>>(
    () => buildAudioRoleBooleanMap(false)
  );
  const [audioRoleFocus, setAudioRoleFocus] = useState<AudioRoleFilter>('all');
  const activeWorkflowConfig = useMemo(
    () => RESOLVE_WORKFLOW_STEPS.find((step) => step.id === workflowStep) || RESOLVE_WORKFLOW_STEPS[1],
    [workflowStep]
  );
  const isCutWorkspace = workspacePreset === 'cut';
  const isEditWorkspace = workspacePreset === 'edit';
  const isColorWorkspace = workspacePreset === 'color';
  const isFairlightWorkspace = workspacePreset === 'fairlight';
  const isDeliverWorkspace = workspacePreset === 'deliver';
  const currentWorkspaceDockSlots = savedDockSlotsByWorkspace[workspacePreset];
  const [workspaceDockPointerRatio, setWorkspaceDockPointerRatio] = useState<number | null>(null);
  
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
  const safeTrimWarningAtRef = useRef(0);
  const onboardingAutoOpenTimerRef = useRef<number | null>(null);
  const sceneDetectionPollIntervalRef = useRef<number | null>(null);
  const aiRatingRevealTimeoutRef = useRef<number | null>(null);
  const workerInitTimeoutsRef = useRef<Set<number>>(new Set());
  const resumedPersistedJobsRef = useRef(false);

  const clearWorkerInitTimeouts = useCallback(() => {
    for (const timeoutId of workerInitTimeoutsRef.current) {
      window.clearTimeout(timeoutId);
    }
    workerInitTimeoutsRef.current.clear();
  }, []);

  const scheduleWorkerInitTimeout = useCallback((fn: () => void, delayMs: number) => {
    const timeoutId = window.setTimeout(() => {
      workerInitTimeoutsRef.current.delete(timeoutId);
      fn();
    }, delayMs);
    workerInitTimeoutsRef.current.add(timeoutId);
    return timeoutId;
  }, []);
  
  // Save status
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedVia, setSavedVia] = useState<'db' | 'drive' | null>(null);

  // Settings
  const [drivePrimaryIntervalMs, setDrivePrimaryIntervalMs] = useState<number>(30000); // default 30s
  const [driveBackupIntervalMs, setDriveBackupIntervalMs] = useState<number>(300000); // default 5m
  const [driveUploadsEnabled, setDriveUploadsEnabled] = useState<boolean>(true);
  const [drivePrimaryEnabled, setDrivePrimaryEnabled] = useState<boolean>(true);
  const [driveBackupEnabled, setDriveBackupEnabled] = useState<boolean>(true);
  const [drivePrimaryFolderName, setDrivePrimaryFolderName] = useState<string>('Timeline & Notes');
  const [driveBackupFolderName, setDriveBackupFolderName] = useState<string>('Timeline & Notes Backups');
  const [drivePrimaryFilenameTemplate, setDrivePrimaryFilenameTemplate] = useState<string>('story-arc-editor-state-{id}.json');
  const [driveBackupFilenameTemplate, setDriveBackupFilenameTemplate] = useState<string>('story-arc-editor-state-{id}-backup-{ts}.json');
  
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
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [ensuringMapping, setEnsuringMapping] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' | 'warning' }>({ open: false, message: '', severity: 'info' });
  
  // Recent projects state
  const [recentProjects, setRecentProjects] = useState<RecentStoryArcProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  useEffect(() => {
    setSafeLocalStorageItem(AUTO_EDIT_PROFILE_STORAGE_KEY, autoEditIntentProfileId);
  }, [autoEditIntentProfileId]);

  useEffect(() => {
    setSafeLocalStorageJson(AUTO_EDIT_FEEDBACK_STORAGE_KEY, autoEditFeedbackByClipKey);
  }, [autoEditFeedbackByClipKey]);

  useEffect(() => {
    setSafeLocalStorageJson(AUTO_EDIT_HISTORY_STORAGE_KEY, autoEditHistory.slice(0, 80));
  }, [autoEditHistory]);

  useEffect(() => {
    setAutoEditOptions((previous) => {
      const defaults = getDefaultAutoEditOptions(previous.preset);
      const transitionDensity = clampNumber(
        defaults.transitionDensity + activeIntentProfile.transitionDensityBias,
        0,
        1
      );
      const targetDuration = clampNumber(
        defaults.targetDurationSeconds * (1 + activeIntentProfile.targetDurationBias),
        10,
        180
      );
      const next: AutoEditOptions = {
        ...previous,
        intentProfileId: activeIntentProfile.id,
        transitionDensity,
        targetDurationSeconds: targetDuration,
        maxConsecutiveByCamera: activeIntentProfile.maxConsecutiveByCamera,
        maxConsecutiveBySpeaker: activeIntentProfile.maxConsecutiveBySpeaker,
      };
      if (
        next.intentProfileId === previous.intentProfileId &&
        next.transitionDensity === previous.transitionDensity &&
        next.targetDurationSeconds === previous.targetDurationSeconds &&
        next.maxConsecutiveByCamera === previous.maxConsecutiveByCamera &&
        next.maxConsecutiveBySpeaker === previous.maxConsecutiveBySpeaker
      ) {
        return previous;
      }
      return next;
    });
  }, [activeIntentProfile]);

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
        setSafeLocalStorageItem(ONBOARDING_COMPLETED_STORAGE_KEY, 'true');
      } else {
        // Also save to localStorage for quick access
        setSafeLocalStorageItem(ONBOARDING_COMPLETED_STORAGE_KEY, 'true');
      }
    } catch (error) {
      // Fallback to localStorage
      setSafeLocalStorageItem(ONBOARDING_COMPLETED_STORAGE_KEY, 'true');
      console.warn('Failed to save onboarding completion to database: ', error);
    }

    setOnboardingOpen(false);
    clearWorkerInitTimeouts();
    setSnackbar({
      open: true,
      message: 'Welcome to Story Arc Studio! You\'re all set to start editing.',
      severity: 'success',
    });
  }, [clearWorkerInitTimeouts]);
  
  // Worker initialization state
  const [workerInitStatus, setWorkerInitStatus] = useState<{
    inProgress: boolean;
    completed: boolean;
    error: string | null;
    progress: number;
    workers: Record<string, { ready: boolean; message: string; status?: string; friendlyName?: string; description?: string }>;
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
      setSafeSessionStorageItem(
        PROJECT_CONTEXT_SESSION_STORAGE_KEY,
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
    clips,
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
  const [aiGeneratedTimelineData, setAIGeneratedTimelineData] = useState<unknown>(null);

  // ==========================================
  // ALL PROFESSIONAL FEATURES - PANELS
  // ==========================================
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
  const {
    resetSyncPreview,
    updateSyncMaxOffsetWindow,
    toggleSyncClipSelection,
    updateManualOffset,
    resetManualOffsetToDetected,
    clearManualOffsetForClip,
  } = useStoryArcSyncUiActions({
    setSyncPreviewMode,
    setSyncResults,
    setManualOffsets,
    setSyncMaxOffsetSeconds,
    setSelectedSyncClips,
  });
  const {
    runManagedJob,
    startPollingJob,
    cancelJob: cancelManagedJob,
    getPersistedServerJob,
    clearPersistedServerJob,
  } = useStoryArcLongJobManager();

  const clearSceneDetectionPollInterval = useCallback(() => {
    if (sceneDetectionPollIntervalRef.current === null) {
      return;
    }
    window.clearInterval(sceneDetectionPollIntervalRef.current);
    sceneDetectionPollIntervalRef.current = null;
  }, []);

  const clearAiRatingRevealTimeout = useCallback(() => {
    if (aiRatingRevealTimeoutRef.current === null) {
      return;
    }
    window.clearTimeout(aiRatingRevealTimeoutRef.current);
    aiRatingRevealTimeoutRef.current = null;
  }, []);

  const scheduleAiRatingReveal = useCallback((delayMs = 2000) => {
    clearAiRatingRevealTimeout();
    aiRatingRevealTimeoutRef.current = window.setTimeout(() => {
      aiRatingRevealTimeoutRef.current = null;
      setShowRatingDialog(true);
    }, delayMs);
  }, [clearAiRatingRevealTimeout]);

  const {
    createProjectDialogOpen,
    newProjectName,
    isCreatingProject,
    connectRecentProject,
    connectCurrentProject,
    openCreateProjectDialog,
    closeCreateProjectDialog,
    updateNewProjectName,
    submitCreateProjectFromDialog,
    prepareWorkerFeatures,
  } = useStoryArcOnboardingFlow({
    projectContext,
    setProjectContext,
    setOnboardingStep,
    setEnsuringMapping,
    setWorkerInitStatus,
    setSnackbar,
    fetchRecentProjects,
    scheduleWorkerInitTimeout,
    handleOnboardingComplete,
  });

  useEffect(() => {
    return () => {
      cancelManagedJob('scene');
      cancelManagedJob('sync');
      cancelManagedJob('face');
      cancelManagedJob('autoEdit');
      clearSceneDetectionPollInterval();
      clearAiRatingRevealTimeout();
      clearWorkerInitTimeouts();
    };
  }, [
    cancelManagedJob,
    clearAiRatingRevealTimeout,
    clearSceneDetectionPollInterval,
    clearWorkerInitTimeouts,
  ]);

  const openAIGeneratorDialog = useCallback(() => {
    preloadAIStoryGeneratorDialog();
    setShowAIGeneratorDialog(true);
  }, []);

  const closeAIGeneratorDialog = useCallback(() => {
    setShowAIGeneratorDialog(false);
  }, []);

  const openTransitionLibrary = useCallback(() => {
    preloadTransitionLibrary();
    setShowTransitionLibrary(true);
  }, []);

  const closeTransitionLibrary = useCallback(() => {
    setShowTransitionLibrary(false);
  }, []);

  const openTextOverlayPanel = useCallback(() => {
    preloadTextOverlayPanel();
    setShowTextOverlayPanel(true);
  }, []);

  const closeTextOverlayPanel = useCallback(() => {
    setShowTextOverlayPanel(false);
  }, []);

  const openGPUFiltersPanel = useCallback(() => {
    preloadGPUFiltersPanel();
    preloadBackgroundRemovalPanel();
    setShowGPUFiltersPanel(true);
  }, []);

  const closeGPUFiltersPanel = useCallback(() => {
    setShowGPUFiltersPanel(false);
  }, []);

  const openColorGradingPanel = useCallback(() => {
    preloadColorGradingPanel();
    setShowColorGradingPanel(true);
  }, []);

  const closeColorGradingPanel = useCallback(() => {
    setShowColorGradingPanel(false);
  }, []);

  const openAutoCaptionsPanel = useCallback(() => {
    preloadAutoCaptionsPanel();
    setShowAutoCaptionsPanel(true);
  }, []);

  const closeAutoCaptionsPanel = useCallback(() => {
    setShowAutoCaptionsPanel(false);
  }, []);

  const openBeatSyncPanel = useCallback(() => {
    preloadBeatSyncPanel();
    setShowBeatSyncPanel(true);
  }, []);

  const closeBeatSyncPanel = useCallback(() => {
    setShowBeatSyncPanel(false);
  }, []);

  const openMotionTrackingPanel = useCallback(() => {
    preloadMotionTrackingPanel();
    preloadObjectSegmentationPanel();
    setShowMotionTrackingPanel(true);
  }, []);

  const closeMotionTrackingPanel = useCallback(() => {
    setShowMotionTrackingPanel(false);
  }, []);

  const openExportDialog = useCallback(() => {
    preloadExportDialog();
    setShowExportDialog(true);
  }, []);

  const closeExportDialog = useCallback(() => {
    setShowExportDialog(false);
  }, []);

  const openResolveExportDialog = useCallback(() => {
    preloadDaVinciResolveExportDialog();
    setShowResolveExportDialog(true);
  }, []);

  const closeResolveExportDialog = useCallback(() => {
    setShowResolveExportDialog(false);
  }, []);

  const openHLSImportDialog = useCallback(() => {
    preloadHLSImportDialog();
    setShowHLSImportDialog(true);
  }, []);

  const closeHLSImportDialog = useCallback(() => {
    setShowHLSImportDialog(false);
  }, []);

  const openLUTLibraryDialog = useCallback(() => {
    preloadLUTLibrary();
    setShowLUTLibraryDialog(true);
  }, []);

  const closeLUTLibraryDialog = useCallback(() => {
    setShowLUTLibraryDialog(false);
  }, []);

  const closeObjectSegmentationPanel = useCallback(() => {
    setShowObjectSegmentationPanel(false);
  }, []);

  const openSettingsDialog = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  const closeSettingsDialog = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  const openPushSettingsDialog = useCallback(() => {
    setPushSettingsOpen(true);
  }, []);

  const closePushSettingsDialog = useCallback(() => {
    setPushSettingsOpen(false);
  }, []);

  const openOnboardingDialog = useCallback(() => {
    setOnboardingOpen(true);
  }, []);

  const preloadGPUAndBackgroundPanels = useCallback(() => {
    preloadGPUFiltersPanel();
    preloadBackgroundRemovalPanel();
  }, []);

  const preloadMotionAndObjectPanels = useCallback(() => {
    preloadMotionTrackingPanel();
    preloadObjectSegmentationPanel();
  }, []);

  // Audio enhancement dialog state
  const [pendingAudioFile, setPendingAudioFile] = useState<File | null>(null);

  // Batch audio enhancement dialog state
  const [batchAudioFiles, setBatchAudioFiles] = useState<File[]>([]);

  // AI Audio Assistant dialog state
  const [selectedAudioTrackId, setSelectedAudioTrackId] = useState<string | null>(null);
  const [openMixerDirectly, setOpenMixerDirectly] = useState(false);

  const closeAudioEnhancementDialog = useCallback(() => {
    setShowAudioEnhancementDialog(false);
    setPendingAudioFile(null);
  }, []);

  const closeBatchAudioDialog = useCallback(() => {
    setShowBatchAudioDialog(false);
    setBatchAudioFiles([]);
  }, []);

  const closeAIAudioAssistantDialog = useCallback(() => {
    setShowAIAudioAssistant(false);
    setSelectedAudioTrackId(null);
    setOpenMixerDirectly(false);
  }, []);

  const closeFaceDetectionProgressDialog = useCallback(() => {
    if (!faceDetectionRunning) {
      setShowFaceDetectionDialog(false);
    }
  }, [faceDetectionRunning]);

  const handleFaceDetectionDialogAction = useCallback(() => {
    if (faceDetectionRunning) {
      cancelManagedJob('face');
      setFaceDetectionRunning(false);
      return;
    }
    setShowFaceDetectionDialog(false);
  }, [faceDetectionRunning, cancelManagedJob]);

  // Feature states
  const [currentSpeedKeyframes, setCurrentSpeedKeyframes] = useState<SpeedKeyframe[]>([]);
  const [currentColorGrade, setCurrentColorGrade] = useState<Partial<ColorGrade>>({});
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [appliedFilters, setAppliedFilters] = useState<Map<string, FilterConfig>>(new Map());
  const [availableVideoSources, setAvailableVideoSources] = useState<string[]>([]);
  const [activeSourcePreview, setActiveSourcePreview] = useState<SourcePreviewAsset | null>(null);
  const [sourceFileRegistry, setSourceFileRegistry] = useState<Record<string, File>>({});
  const [multicamEnabled, setMulticamEnabled] = useState(false);
  const [multicamApplyToTimeline, setMulticamApplyToTimeline] = useState(true);
  const [currentUser, setCurrentUser] = useState<StoryArcSessionUser | null>(null);
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
        setTrackStates(normalizeTrackStates(trackData, null));
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
      safeTrimMode,
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
  }), [
    storyArc?.id,
    storyArcId,
    totalDuration,
    timelineZoom,
    reviewerMode,
    safeTrimMode,
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
    tracks,
    trackStates,
    clips,
    markers,
    transitions,
    clipMeta,
    comments,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      const storedZoom = Number(getSafeLocalStorageItem(TIMELINE_ZOOM_STORAGE_KEY));
      if (Number.isFinite(storedZoom)) {
        const clampedZoom = clampTimelineZoomValue(storedZoom);
        timelineZoomLoadedFromStorageRef.current = true;
        userAdjustedTimelineZoomRef.current = true;
        setTimelineZoom(clampedZoom);
      }
    } catch (error) {
      console.warn('Could not restore timeline zoom state:', error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      setSafeLocalStorageItem(TIMELINE_ZOOM_STORAGE_KEY, String(clampTimelineZoomValue(timelineZoom)));
    } catch (error) {
      console.warn('Could not persist timeline zoom state:', error);
    }
  }, [timelineZoom]);

  // Resolve storyArcId from external projectId if needed and then load editor state
  useEffect(() => {
    if (timelineZoomLoadedFromStorageRef.current) {
      return;
    }
    userAdjustedTimelineZoomRef.current = false;
  }, [storyArcId, storyArc?.id]);

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
            const resolvedStoryArcId = json.storyArcId;
            id = resolvedStoryArcId;
            setStoryArc((prev) =>
              prev
                ? { ...prev, id: resolvedStoryArcId }
                : buildFallbackStoryArc(
                    resolvedStoryArcId,
                    projectContext?.projectName || 'Untitled Project',
                    0
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
        let restoredTracks: Track[] | null = null;
        if (Array.isArray(st.tracks)) {
          restoredTracks = st.tracks;
          setTracks(st.tracks);
        }
        if (restoredTracks) {
          setTrackStates(normalizeTrackStates(restoredTracks, st.trackStates));
        }
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
          if (
            typeof st.timeline.zoom === 'number' &&
            !userAdjustedTimelineZoomRef.current &&
            !timelineZoomLoadedFromStorageRef.current
          ) {
            setTimelineZoom(clampTimelineZoomValue(st.timeline.zoom));
          }
          if (typeof st.timeline.reviewerMode === 'boolean') setReviewerMode(st.timeline.reviewerMode);
          if (typeof st.timeline.safeTrimMode === 'boolean') setSafeTrimMode(st.timeline.safeTrimMode);
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
  }, [storyArcId, storyArc?.id, projectContext, hydrateClipSources, extractRenderableVideoSources]);

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

  const cloneClipList = useCallback((clipList: BeatClip[]): BeatClip[] => {
    return clipList.map((clip) => ({
      ...clip,
      tags: clip.tags ? [...clip.tags] : undefined,
      metadata: clip.metadata ? { ...clip.metadata } : undefined,
    }));
  }, []);

  const cloneTimelineTransitions = useCallback(
    (transitionList: TimelineTransition[]): TimelineTransition[] =>
      transitionList.map((transition) => ({ ...transition })),
    []
  );

  const cloneTimelineMarkers = useCallback(
    (markerList: TimelineMarker[]): TimelineMarker[] =>
      markerList.map((marker) => ({ ...marker })),
    []
  );

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
    const validation = timelineEngine.validateTimeline(clips, tracks, transitions);
    setTimelineWarnings(validation.warnings);
    setTimelineErrors(validation.errors);
  }, [clips, tracks, transitions]);

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
      const sessionPayload = (await sessionRes.json()) as unknown;
      const sessionUser: StoryArcSessionUser = isRecord(sessionPayload)
        ? (sessionPayload as StoryArcSessionUser)
        : {};
      setCurrentUser(sessionUser);

      if (!sessionUser.id || sessionUser.isAuthenticated === false) {
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
    } catch (error: unknown) {
      setDriveInit({ status: 'error', message: toErrorMessage(error, 'Initialization failed') });
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
    let disposed = false;

    const checkFirstTime = async () => {
      try {
        // Check localStorage first (quick check)
        const onboardingCompleted = getSafeLocalStorageItem(ONBOARDING_COMPLETED_STORAGE_KEY);
        if (onboardingCompleted === 'true') {
          return; // Already completed
        }

        // Check database for onboarding completion
        try {
          const res = await fetch('/api/story-arc/onboarding/status', { credentials: 'include' });
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.completed === true) {
              setSafeLocalStorageItem(ONBOARDING_COMPLETED_STORAGE_KEY, 'true');
              return; // Already completed
            }
          }
        } catch (statusError) {
          console.warn('Onboarding status check failed, using local fallback:', statusError);
        }

        // First-time user - show onboarding after a short delay
        if (onboardingAutoOpenTimerRef.current !== null) {
          window.clearTimeout(onboardingAutoOpenTimerRef.current);
          onboardingAutoOpenTimerRef.current = null;
        }
        onboardingAutoOpenTimerRef.current = window.setTimeout(() => {
          if (disposed) {
            return;
          }
          setOnboardingOpen(true);
          // Fetch recent projects when onboarding opens
          fetchRecentProjects();
        }, 1000);
      } catch (error) {
        console.warn('Error checking onboarding status:', error);
      }
    };

    void checkFirstTime();
    return () => {
      disposed = true;
      if (onboardingAutoOpenTimerRef.current !== null) {
        window.clearTimeout(onboardingAutoOpenTimerRef.current);
        onboardingAutoOpenTimerRef.current = null;
      }
    };
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

  const isAudioTrackId = useCallback(
    (trackId: string | null | undefined): boolean => {
      if (!trackId) {
        return false;
      }
      const normalizedTrackId = trackId.toLowerCase();
      if (normalizedTrackId.startsWith('audio') || /^a\d+$/.test(normalizedTrackId)) {
        return true;
      }
      const matchingTrack = trackMap.get(trackId);
      if (!matchingTrack) {
        return false;
      }
      const overrideType = trackStates[matchingTrack.id]?.type;
      const effectiveType = overrideType ?? matchingTrack.type;
      if (effectiveType === 'audio') {
        return true;
      }
      return matchingTrack.name.toLowerCase().includes('audio');
    },
    [trackMap, trackStates]
  );

  const resolveAudioRoleForTrackId = useCallback(
    (trackId: string): AudioTrackRole => {
      const roleFromState = trackStates[trackId]?.audioRole;
      if (roleFromState) {
        return roleFromState;
      }
      const track = trackMap.get(trackId);
      if (!track) {
        return 'dialogue';
      }
      return inferAudioRoleFromTrackName(track.name);
    },
    [trackMap, trackStates]
  );

  const audioTrackIds = useMemo(
    () => tracks.filter((track) => isAudioTrackId(track.id)).map((track) => track.id),
    [tracks, isAudioTrackId]
  );

  const setTrackAudioRole = useCallback((trackId: string, role: AudioTrackRole) => {
    setTrackStates((previous) => ({
      ...previous,
      [trackId]: {
        ...previous[trackId],
        type: 'audio',
        audioRole: role,
      },
    }));
  }, []);

  const isAudioTrackAudible = useCallback(
    (trackId: string): boolean => {
      const trackState = trackStates[trackId];
      if (trackState?.mute) {
        return false;
      }

      const anyTrackSolo = audioTrackIds.some((id) => Boolean(trackStates[id]?.solo));
      if (anyTrackSolo && !trackState?.solo) {
        return false;
      }

      const role = resolveAudioRoleForTrackId(trackId);
      if (audioRoleMuteState[role]) {
        return false;
      }

      const anyRoleSolo = AUDIO_ROLE_ORDER.some((candidateRole) => audioRoleSoloState[candidateRole]);
      if (anyRoleSolo && !audioRoleSoloState[role]) {
        return false;
      }

      if (audioRoleFocus !== 'all' && role !== audioRoleFocus) {
        return false;
      }

      return true;
    },
    [
      trackStates,
      audioTrackIds,
      resolveAudioRoleForTrackId,
      audioRoleMuteState,
      audioRoleSoloState,
      audioRoleFocus,
    ]
  );

  const hasTimelineOverlapOnTrack = useCallback(
    (clipList: BeatClip[], trackId: string): boolean => {
      const sortedTrackClips = clipList
        .filter((clip) => clip.trackId === trackId)
        .sort((left, right) => left.start - right.start);

      for (let index = 1; index < sortedTrackClips.length; index += 1) {
        const previous = sortedTrackClips[index - 1];
        const current = sortedTrackClips[index];
        const overlapStart = Math.max(previous.start, current.start);
        const overlapEnd = Math.min(previous.start + previous.duration, current.start + current.duration);
        const hasMeaningfulOverlap = overlapEnd - overlapStart > frameTime / 3;
        const transitionAllowsOverlap = transitions.some((transition) => {
          if (transition.trackId !== trackId) {
            return false;
          }
          if (transition.edge === 'out' && transition.clipId === previous.id) {
            return transition.time >= overlapStart - frameTime && transition.time <= overlapEnd + frameTime;
          }
          if (transition.edge === 'in' && transition.clipId === current.id) {
            return transition.time >= overlapStart - frameTime && transition.time <= overlapEnd + frameTime;
          }
          if (transition.clipId && transition.clipId !== previous.id && transition.clipId !== current.id) {
            return false;
          }
          return transition.time >= overlapStart - frameTime && transition.time <= overlapEnd + frameTime;
        });
        if (
          hasMeaningfulOverlap &&
          !transitionAllowsOverlap &&
          current.start < previous.start + previous.duration - frameTime / 10
        ) {
          return true;
        }
      }
      return false;
    },
    [frameTime, transitions]
  );

  const showSafeTrimBlockedWarning = useCallback(() => {
    const now = Date.now();
    if (now - safeTrimWarningAtRef.current < 700) {
      return;
    }
    safeTrimWarningAtRef.current = now;
    setSnackbar({
      open: true,
      message: 'Safe Trim blocked an overlap edit on this track',
      severity: 'warning',
    });
  }, []);

  const getPrimaryVideoTrackId = useCallback((): string => {
    const selectedTrack = Array.from(selectedClips)
      .map((clipId) => clipMap.get(clipId)?.trackId)
      .find((trackId): trackId is string => Boolean(trackId) && !isAudioTrackId(trackId));
    if (selectedTrack) {
      return selectedTrack;
    }

    const videoTrack = tracks.find((track) => !isAudioTrackId(track.id));
    return videoTrack?.id || 'video-1';
  }, [selectedClips, clipMap, tracks, isAudioTrackId]);

  const getPrimaryAudioTrackId = useCallback((): string | null => {
    const selectedTrack = Array.from(selectedClips)
      .map((clipId) => clipMap.get(clipId)?.trackId)
      .find((trackId): trackId is string => Boolean(trackId) && isAudioTrackId(trackId));
    if (selectedTrack) {
      return selectedTrack;
    }

    const audioTrack = tracks.find((track) => isAudioTrackId(track.id));
    return audioTrack?.id ?? null;
  }, [selectedClips, clipMap, tracks, isAudioTrackId]);

  const sourcePatchVideoTrackOptions = useMemo(() => {
    return tracks.filter((track) => !isAudioTrackId(track.id));
  }, [tracks, isAudioTrackId]);

  const sourcePatchAudioTrackOptions = useMemo(() => {
    return tracks.filter((track) => isAudioTrackId(track.id));
  }, [tracks, isAudioTrackId]);

  useEffect(() => {
    setSourcePatchVideoTrackId((previous) => {
      if (previous && sourcePatchVideoTrackOptions.some((track) => track.id === previous)) {
        return previous;
      }
      return sourcePatchVideoTrackOptions[0]?.id ?? getPrimaryVideoTrackId();
    });

    setSourcePatchAudioTrackId((previous) => {
      if (previous && sourcePatchAudioTrackOptions.some((track) => track.id === previous)) {
        return previous;
      }
      return sourcePatchAudioTrackOptions[0]?.id ?? getPrimaryAudioTrackId();
    });

    if (sourcePatchAudioTrackOptions.length === 0 && sourcePatchIncludeAudio) {
      setSourcePatchIncludeAudio(false);
    }
  }, [
    sourcePatchVideoTrackOptions,
    sourcePatchAudioTrackOptions,
    sourcePatchIncludeAudio,
    getPrimaryVideoTrackId,
    getPrimaryAudioTrackId,
  ]);

  const applyClipUpdates = useCallback(
    (
      nextClips: BeatClip[],
      keepSelection?: Set<string>,
      nextTransitionsOverride?: TimelineTransition[]
    ) => {
      const transitionsForValidation = nextTransitionsOverride ?? transitions;
      const snapped = nextClips.map((clip) => ({
        ...clip,
        start: timelineEngine.snapToFrame(Math.max(0, clip.start)),
        duration: Math.max(frameTime, timelineEngine.snapToFrame(clip.duration)),
      }));
      const invariantResult = enforceTimelineInvariants(snapped, {
        frameTime,
        tracks,
        enforceNoOverlap: safeTrimMode,
        transitions: transitionsForValidation,
      });
      const invariantWarnings: string[] = [];
      const overlapCount = invariantResult.issues.filter(
        (issue) => issue.code === 'clip_overlap'
      ).length;
      if (overlapCount > 0) {
        invariantWarnings.push(`Invariant check: detected ${overlapCount} clip overlap(s).`);
      }
      const trackBoundsCount = invariantResult.issues.filter(
        (issue) => issue.code === 'invalid_track'
      ).length;
      if (trackBoundsCount > 0) {
        invariantWarnings.push(`Invariant check: corrected ${trackBoundsCount} out-of-bounds track reference(s).`);
      }
      const durationCount = invariantResult.issues.filter(
        (issue) => issue.code === 'invalid_duration'
      ).length;
      if (durationCount > 0) {
        invariantWarnings.push(`Invariant check: corrected ${durationCount} negative/invalid duration value(s).`);
      }
      const offsetCount = invariantResult.issues.filter(
        (issue) => issue.code === 'invalid_offset'
      ).length;
      if (offsetCount > 0) {
        invariantWarnings.push(`Invariant check: corrected ${offsetCount} invalid sync/source offset value(s).`);
      }

      setClips(invariantResult.clips);
      setTotalDuration(timelineEngine.calculateDuration(invariantResult.clips));
      if (keepSelection) {
        setSelectedClips(keepSelection);
      }
      const validation = timelineEngine.validateTimeline(invariantResult.clips, tracks, transitionsForValidation);
      setTimelineWarnings([...validation.warnings, ...invariantWarnings]);
      setTimelineErrors(validation.errors);
    },
    [frameTime, tracks, safeTrimMode, transitions]
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

  const createAutoEditSnapshot = useCallback((): AutoEditTimelineSnapshot => {
    return {
      clips: cloneClipList(clips),
      transitions: cloneTimelineTransitions(transitions),
      markers: cloneTimelineMarkers(markers),
      selectedClipIds: Array.from(selectedClips),
    };
  }, [
    cloneClipList,
    cloneTimelineMarkers,
    cloneTimelineTransitions,
    clips,
    markers,
    selectedClips,
    transitions,
  ]);

  const applyAutoEditSnapshot = useCallback((snapshot: AutoEditTimelineSnapshot) => {
    const nextTransitions = cloneTimelineTransitions(snapshot.transitions);
    const nextMarkers = cloneTimelineMarkers(snapshot.markers);
    const nextSelection = new Set(snapshot.selectedClipIds);
    setTransitions(nextTransitions);
    setMarkers(nextMarkers);
    applyClipUpdates(cloneClipList(snapshot.clips), nextSelection, nextTransitions);
  }, [applyClipUpdates, cloneClipList, cloneTimelineMarkers, cloneTimelineTransitions]);

  const openAutoEditDialog = useCallback(() => {
    setShowAutoEditDialog(true);
  }, []);

  const closeAutoEditDialog = useCallback(() => {
    if (autoEditRunning) {
      cancelManagedJob('autoEdit');
      return;
    }
    setShowAutoEditDialog(false);
  }, [autoEditRunning, cancelManagedJob]);

  const updateAutoEditPreset = useCallback((event: SelectChangeEvent<AutoEditPreset>) => {
    const preset = event.target.value as AutoEditPreset;
    const defaults = getDefaultAutoEditOptions(preset);
    setAutoEditOptions((previous) => ({
      ...previous,
      preset,
      targetDurationSeconds: clampNumber(
        defaults.targetDurationSeconds * (1 + activeIntentProfile.targetDurationBias),
        10,
        180
      ),
      transitionDensity: clampNumber(
        defaults.transitionDensity + activeIntentProfile.transitionDensityBias,
        0,
        1
      ),
      minShotDurationSeconds: defaults.minShotDurationSeconds,
      maxShotDurationSeconds: defaults.maxShotDurationSeconds,
      maxConsecutiveByCamera: activeIntentProfile.maxConsecutiveByCamera,
      maxConsecutiveBySpeaker: activeIntentProfile.maxConsecutiveBySpeaker,
    }));
  }, [activeIntentProfile]);

  const updateAutoEditTargetDuration = useCallback((_event: Event, value: number | number[]) => {
    const nextValue = Array.isArray(value) ? value[0] : value;
    setAutoEditOptions((previous) => ({
      ...previous,
      targetDurationSeconds: Math.max(frameTime, nextValue),
    }));
  }, [frameTime]);

  const updateAutoEditTransitionDensity = useCallback((_event: Event, value: number | number[]) => {
    const nextValue = Array.isArray(value) ? value[0] : value;
    setAutoEditOptions((previous) => ({
      ...previous,
      transitionDensity: Math.max(0, Math.min(1, nextValue)),
    }));
  }, []);

  const updateAutoEditVariant = useCallback((event: SelectChangeEvent<AutoEditVariant>) => {
    const variant = event.target.value as AutoEditVariant;
    setAutoEditOptions((previous) => ({
      ...previous,
      variant,
    }));
  }, []);

  const updateAutoEditIntentProfile = useCallback((event: SelectChangeEvent<string>) => {
    const profileId = String(event.target.value || 'balanced-story');
    const profile = getStoryIntentProfile(profileId);
    setAutoEditIntentProfileId(profile.id);
    setAutoEditOptions((previous) => ({
      ...previous,
      intentProfileId: profile.id,
      maxConsecutiveByCamera: profile.maxConsecutiveByCamera,
      maxConsecutiveBySpeaker: profile.maxConsecutiveBySpeaker,
      transitionDensity: clampNumber(
        getDefaultAutoEditOptions(previous.preset).transitionDensity + profile.transitionDensityBias,
        0,
        1
      ),
      targetDurationSeconds: clampNumber(
        getDefaultAutoEditOptions(previous.preset).targetDurationSeconds *
          (1 + profile.targetDurationBias),
        10,
        180
      ),
    }));
  }, []);

  const updateAutoEditMinShotDuration = useCallback((_event: Event, value: number | number[]) => {
    const nextValue = Array.isArray(value) ? value[0] : value;
    setAutoEditOptions((previous) => ({
      ...previous,
      minShotDurationSeconds: clampNumber(nextValue, 0.2, previous.maxShotDurationSeconds - 0.05),
    }));
  }, []);

  const updateAutoEditMaxShotDuration = useCallback((_event: Event, value: number | number[]) => {
    const nextValue = Array.isArray(value) ? value[0] : value;
    setAutoEditOptions((previous) => ({
      ...previous,
      maxShotDurationSeconds: clampNumber(nextValue, previous.minShotDurationSeconds + 0.05, 40),
    }));
  }, []);

  const handleAutoEditOptionToggle = useCallback((field: keyof Pick<AutoEditOptions, 'includeAssemble' | 'includePolish' | 'addMarkers' | 'addAudioBed' | 'enforceNoOverlap' | 'enableDucking' | 'enableJCutLCut' | 'cleanupFillerPauses'>) =>
    (_event: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
      setAutoEditOptions((previous) => ({
        ...previous,
        [field]: checked,
      }));
    }, []);

  const buildContextualAutoEditClips = useCallback(
    (sourceClips: BeatClip[]): BeatClip[] => {
      return sourceClips.map((clip) => {
        const meta = clipMeta[clip.id];
        const markerLabels = markers
          .filter(
            (marker) =>
              marker.time >= clip.start &&
              marker.time <= clip.start + clip.duration &&
              typeof marker.label === 'string' &&
              marker.label.trim().length > 0
          )
          .map((marker) => marker.label as string)
          .slice(0, 12);
        const mergedTags = dedupeAutoEditKeywords(
          [
            ...(Array.isArray(clip.tags) ? clip.tags : []),
            ...(Array.isArray(meta?.tags) ? meta.tags : []),
            ...markerLabels,
            typeof meta?.scene === 'string' ? meta.scene : null,
            typeof meta?.shotName === 'string' ? meta.shotName : null,
            typeof meta?.camera === 'string' ? meta.camera : null,
          ],
          36
        );

        return {
          ...clip,
          tags: mergedTags.length > 0 ? mergedTags : clip.tags,
          metadata: {
            ...(isRecord(clip.metadata) ? clip.metadata : {}),
            autoEditContext: {
              ...(isRecord(clip.metadata?.autoEditContext)
                ? (clip.metadata?.autoEditContext as Record<string, unknown>)
                : {}),
              scene: typeof meta?.scene === 'string' ? meta.scene : undefined,
              shotName: typeof meta?.shotName === 'string' ? meta.shotName : undefined,
              camera: typeof meta?.camera === 'string' ? meta.camera : undefined,
              syncGroup: typeof meta?.syncGroup === 'string' ? meta.syncGroup : undefined,
              markerLabels,
            },
          },
        };
      });
    },
    [clipMeta, markers]
  );

  const buildAutoEditServerContext = useCallback(
    (contextualClips: BeatClip[], options: AutoEditOptions): AutoEditServerContext => {
      const storyTypeRaw =
        (projectContext?.projectType as string | undefined) ||
        storyArc?.type ||
        'story';
      const storyType = String(storyTypeRaw || 'story');
      const presetGoalKeywords: Record<AutoEditPreset, string[]> = {
        'reel-30': ['highlight', 'hero', 'impact', 'emotion', 'hook', 'energy'],
        'story-60': ['story', 'build', 'reaction', 'detail', 'moment', 'progression'],
        interview: ['dialogue', 'speech', 'face', 'closeup', 'reaction', 'clarity'],
      };
      const presetAvoidKeywords: Record<AutoEditPreset, string[]> = {
        'reel-30': ['filler', 'slow', 'repetitive'],
        'story-60': ['repetitive'],
        interview: ['timelapse', 'shaky', 'distant'],
      };
      const storyTypeBoostKeywords: Record<string, string[]> = {
        wedding: ['ceremony', 'vows', 'family', 'kiss', 'ring', 'dance'],
        documentary: ['context', 'detail', 'authentic', 'interview'],
        corporate: ['speaker', 'presentation', 'team', 'brand'],
        music_video: ['rhythm', 'performance', 'beat', 'energy'],
        event: ['crowd', 'moment', 'reaction', 'highlight'],
      };

      const clipContextById: Record<
        string,
        NonNullable<AutoEditServerContext['clipContextById']>[string]
      > = {};
      const feedbackByClipId: Record<string, AutoEditFeedbackValue> = {};

      contextualClips.forEach((clip) => {
        const meta = clipMeta[clip.id];
        const markerLabels = markers
          .filter(
            (marker) =>
              marker.time >= clip.start &&
              marker.time <= clip.start + clip.duration &&
              typeof marker.label === 'string' &&
              marker.label.trim().length > 0
          )
          .map((marker) => marker.label as string)
          .slice(0, 16);
        const metadata = isRecord(clip.metadata) ? clip.metadata : {};
        const metadataAutoEditContext = isRecord(metadata.autoEditContext)
          ? (metadata.autoEditContext as Record<string, unknown>)
          : {};
        const transcriptText = sanitizeTranscriptText(
          typeof metadata.transcript === 'string'
            ? metadata.transcript
            : typeof metadataAutoEditContext.transcriptText === 'string'
              ? metadataAutoEditContext.transcriptText
              : typeof metadata.captionText === 'string'
                ? metadata.captionText
                : typeof metadata.detectedSpeech === 'string'
                  ? metadata.detectedSpeech
                  : '',
          AUTO_EDIT_TRANSCRIPT_MAX_LENGTH
        );
        const transcriptPhrases = dedupeTranscriptPhrases([
          ...(Array.isArray(metadata.transcriptPhrases)
            ? (metadata.transcriptPhrases as unknown[])
                .map((entry) => (typeof entry === 'string' ? entry : ''))
                .filter(Boolean)
            : []),
          ...(Array.isArray(metadataAutoEditContext.transcriptPhrases)
            ? (metadataAutoEditContext.transcriptPhrases as unknown[])
                .map((entry) => (typeof entry === 'string' ? entry : ''))
                .filter(Boolean)
            : []),
        ]);
        const transcriptCandidates = [
          transcriptText,
          ...transcriptPhrases,
          Array.isArray(metadata.transcriptKeywords)
            ? (metadata.transcriptKeywords as unknown[]).join(' ')
            : null,
          Array.isArray(metadata.detectedText)
            ? (metadata.detectedText as unknown[]).join(' ')
            : null,
          Array.isArray(metadata.keywords)
            ? (metadata.keywords as unknown[]).join(' ')
            : null,
        ];
        const speakerName = sanitizeTranscriptText(
          typeof metadata.speakerName === 'string'
            ? metadata.speakerName
            : typeof metadata.speaker === 'string'
              ? metadata.speaker
              : typeof metadataAutoEditContext.speakerName === 'string'
                ? metadataAutoEditContext.speakerName
                : '',
          80
        );
        const moodCandidates = [
          clip.beatName,
          clip.synopsis,
          typeof metadata.emotion === 'string' ? metadata.emotion : null,
          typeof metadata.mood === 'string' ? metadata.mood : null,
        ];
        clipContextById[clip.id] = {
          scene: typeof meta?.scene === 'string' ? meta.scene : undefined,
          shotName: typeof meta?.shotName === 'string' ? meta.shotName : undefined,
          camera: typeof meta?.camera === 'string' ? meta.camera : undefined,
          syncGroup: typeof meta?.syncGroup === 'string' ? meta.syncGroup : undefined,
          tags: dedupeAutoEditKeywords(
            [
              ...(Array.isArray(clip.tags) ? clip.tags : []),
              ...(Array.isArray(meta?.tags) ? meta.tags : []),
              ...markerLabels,
            ],
            40
          ),
          markerLabels,
          transcriptKeywords: dedupeAutoEditKeywords(transcriptCandidates, 36),
          transcriptText: transcriptText || undefined,
          transcriptPhrases,
          speakerName: speakerName || undefined,
          moodHints: dedupeAutoEditKeywords(moodCandidates, 24),
        };
        const clipFeedback = autoEditFeedbackByClipKey[buildAutoEditClipFeedbackKey(clip)];
        if (clipFeedback === 'approved' || clipFeedback === 'rejected') {
          feedbackByClipId[clip.id] = clipFeedback;
        }
      });

      const normalizedStoryType = storyType.toLowerCase();
      const typeGoalKeywords =
        storyTypeBoostKeywords[normalizedStoryType] || storyTypeBoostKeywords.event;
      const beatHints =
        storyArc?.segments.map((segment) => `${segment.segmentType} ${segment.title}`) || [];

      return {
        storyTitle: storyArc?.title || projectContext?.projectName || null,
        storyType,
        intentProfileId: activeIntentProfile.id,
        intentProfileName: activeIntentProfile.name,
        intentGoalKeywords: dedupeAutoEditKeywords(activeIntentProfile.goalKeywords, 28),
        intentAvoidKeywords: dedupeAutoEditKeywords(activeIntentProfile.avoidKeywords, 24),
        forbiddenPatterns: dedupeAutoEditKeywords(activeIntentProfile.forbiddenPatterns, 24),
        goalKeywords: dedupeAutoEditKeywords(
          [
            ...presetGoalKeywords[options.preset],
            ...typeGoalKeywords,
            ...activeIntentProfile.goalKeywords,
            ...culturalMomentsDetected,
            ...beatHints,
          ],
          48
        ),
        avoidKeywords: dedupeAutoEditKeywords(
          [
            ...presetAvoidKeywords[options.preset],
            ...activeIntentProfile.avoidKeywords,
            ...activeIntentProfile.forbiddenPatterns,
          ],
          24
        ),
        culturalMoments: dedupeAutoEditKeywords(culturalMomentsDetected, 24),
        beatHints: dedupeAutoEditKeywords(beatHints, 28),
        feedbackByClipId,
        clipContextById,
      };
    },
    [
      activeIntentProfile,
      autoEditFeedbackByClipKey,
      clipMeta,
      culturalMomentsDetected,
      markers,
      projectContext?.projectName,
      projectContext?.projectType,
      storyArc?.segments,
      storyArc?.title,
      storyArc?.type,
    ]
  );

  const appendAutoEditHistoryEntry = useCallback((entry: AutoEditHistoryEntry) => {
    setAutoEditHistory((previous) => [entry, ...previous].slice(0, 80));
  }, []);

  const markAutoEditHistoryStatus = useCallback(
    (proposalId: string, status: AutoEditHistoryEntry['status']) => {
      setAutoEditHistory((previous) =>
        previous.map((entry) =>
          entry.proposalId === proposalId ? { ...entry, status } : entry
        )
      );
    },
    []
  );

  const clearPersistedAutoEditPreview = useCallback(() => {
    setSafeLocalStorageItem(AUTO_EDIT_PENDING_PREVIEW_STORAGE_KEY, '');
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(AUTO_EDIT_PENDING_PREVIEW_STORAGE_KEY);
      }
    } catch {
      // Ignore cleanup failures.
    }
  }, []);

  const persistAutoEditPreview = useCallback(
    (previewState: AutoEditPreviewState) => {
      const payload = {
        projectKey: autoEditProjectKey,
        previewState,
        persistedAt: Date.now(),
      };
      setSafeLocalStorageJson(AUTO_EDIT_PENDING_PREVIEW_STORAGE_KEY, payload);
    },
    [autoEditProjectKey]
  );

  const applyAutoEditProposalPreview = useCallback(
    (
      snapshot: AutoEditTimelineSnapshot,
      proposal: AutoEditProposal,
      mode: 'server' | 'local' | 'resume',
      alternatives?: Record<AutoEditVariant, AutoEditProposal>
    ): boolean => {
      if (proposal.clips.length === 0) {
        setSnackbar({
          open: true,
          message: 'Auto Edit could not build a proposal with current media.',
          severity: 'warning',
        });
        return false;
      }

      const nextTransitions = proposal.transitions.map((transition) => ({ ...transition }));
      const nextMarkers = proposal.markers.map((marker) => ({ ...marker }));
      const selectedIds =
        proposal.selectedClipIds.length > 0
          ? new Set(proposal.selectedClipIds)
          : new Set(proposal.clips.slice(0, 1).map((clip) => clip.id));

      setTransitions(nextTransitions);
      setMarkers(nextMarkers);
      applyClipUpdates(cloneClipList(proposal.clips), selectedIds, nextTransitions);

      const previewState: AutoEditPreviewState = {
        snapshot,
        proposal,
        alternatives: alternatives || { safe: proposal, balanced: proposal, bold: proposal },
        selectedVariant: proposal.variant,
        generatedAt: Date.now(),
      };
      setAutoEditPreview(previewState);
      setLastAutoEditSnapshot(previewState);
      persistAutoEditPreview(previewState);
      appendAutoEditHistoryEntry({
        id: `${proposal.proposalId}:${previewState.generatedAt}`,
        proposalId: proposal.proposalId,
        projectKey: autoEditProjectKey,
        preset: proposal.preset,
        variant: proposal.variant,
        intentProfileId: autoEditIntentProfileId,
        confidence: proposal.confidence,
        duration: proposal.estimatedDurationSeconds,
        generatedAt: previewState.generatedAt,
        status: 'generated',
        summary: proposal.summary.slice(0, 5),
        serverJobId: autoEditJobId,
      });
      setShowAutoEditDialog(false);

      const modeLabel =
        mode === 'server'
          ? 'server-ranked'
          : mode === 'resume'
            ? 'resumed'
            : 'local fallback';
      setSnackbar({
        open: true,
        message: `Auto Edit ${modeLabel} preview ready (${proposal.estimatedDurationSeconds.toFixed(1)}s, ${(proposal.confidence * 100).toFixed(0)}% confidence).`,
        severity: 'success',
      });
      return true;
    },
    [
      appendAutoEditHistoryEntry,
      applyClipUpdates,
      autoEditIntentProfileId,
      autoEditJobId,
      autoEditProjectKey,
      cloneClipList,
      persistAutoEditPreview,
    ]
  );

  const previewAutoEditVariant = useCallback(
    (variant: AutoEditVariant) => {
      if (!autoEditPreview) {
        return;
      }
      const nextProposal = autoEditPreview.alternatives[variant];
      if (!nextProposal) {
        return;
      }
      const nextTransitions = nextProposal.transitions.map((transition) => ({ ...transition }));
      const nextMarkers = nextProposal.markers.map((marker) => ({ ...marker }));
      const selectedIds =
        nextProposal.selectedClipIds.length > 0
          ? new Set(nextProposal.selectedClipIds)
          : new Set(nextProposal.clips.slice(0, 1).map((clip) => clip.id));
      setTransitions(nextTransitions);
      setMarkers(nextMarkers);
      applyClipUpdates(cloneClipList(nextProposal.clips), selectedIds, nextTransitions);
      setAutoEditPreview((previous) => {
        if (!previous) {
          return previous;
        }
        const nextState: AutoEditPreviewState = {
          ...previous,
          proposal: nextProposal,
          selectedVariant: variant,
        };
        persistAutoEditPreview(nextState);
        return nextState;
      });
    },
    [autoEditPreview, applyClipUpdates, cloneClipList, persistAutoEditPreview]
  );

  const setAutoEditClipFeedback = useCallback(
    (clipId: string, feedback: AutoEditFeedbackValue | null) => {
      const previewClip = autoEditPreview?.proposal.clips.find((clip) => clip.id === clipId) || null;
      const timelineClip = clipMap.get(clipId) || null;
      const resolvedClip = previewClip || timelineClip;
      const feedbackKey = resolvedClip ? buildAutoEditClipFeedbackKey(resolvedClip) : clipId;

      setAutoEditFeedbackByClipKey((previous) => {
        const next = { ...previous };
        if (!feedback) {
          delete next[feedbackKey];
        } else {
          next[feedbackKey] = feedback;
        }
        return next;
      });
    },
    [autoEditPreview, clipMap]
  );

  const getAutoEditClipFeedback = useCallback(
    (clip: BeatClip): AutoEditFeedbackValue | null => {
      const feedback = autoEditFeedbackByClipKey[buildAutoEditClipFeedbackKey(clip)];
      return feedback === 'approved' || feedback === 'rejected' ? feedback : null;
    },
    [autoEditFeedbackByClipKey]
  );

  const pollAutoEditServerJob = useCallback(
    async (jobId: string): Promise<AutoEditServerRankingResult> => {
      let didRetryServerJob = false;
      setAutoEditJobId(jobId);
      const rankingResult = await startPollingJob<
        AutoEditServerJobState,
        AutoEditServerRankingResult
      >({
        kind: 'autoEdit',
        serverJobId: jobId,
        intervalMs: 1800,
        maxConsecutivePollErrors: 4,
        maxRetries: 1,
        retryDelayMs: 1800,
        onCancel: () => {
          void cancelAutoEditServerJob(jobId).catch(() => undefined);
        },
        onProgress: (progress) => {
          if (!progress) {
            return;
          }
          setAutoEditServerProgress(progress.progress);
        },
        poll: async (serverJobId) => {
          const status = await getAutoEditServerJob(serverJobId);
          if (status.status === 'completed') {
            if (!status.result) {
              return {
                state: 'failed',
                error: 'Auto Edit server job completed without ranking result',
              };
            }
            return {
              state: 'completed',
              result: status.result,
            };
          }
          if (status.status === 'failed') {
            if (!didRetryServerJob) {
              didRetryServerJob = true;
              await retryAutoEditServerJob(serverJobId);
              return {
                state: 'running',
                progress: status,
              };
            }
            return {
              state: 'failed',
              error: status.error || 'Auto Edit server ranking failed',
            };
          }
          if (status.status === 'cancelled') {
            return {
              state: 'failed',
              error: status.error || 'Cancelled by user',
            };
          }
          return {
            state: 'running',
            progress: status,
          };
        },
      });
      return rankingResult;
    },
    [startPollingJob]
  );

  const pollNarrativeTranscriptionJob = useCallback(
    async (jobId: string): Promise<NarrativeTranscriptionResult> => {
      for (let attempt = 0; attempt < AUTO_EDIT_TRANSCRIPTION_MAX_POLL_ATTEMPTS; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, AUTO_EDIT_TRANSCRIPTION_POLL_INTERVAL_MS));
        const statusPayload = (await apiRequest(
          `/api/video-analysis/transcribe/${encodeURIComponent(jobId)}`
        )) as NarrativeTranscriptionJobStatusResponse;
        if (!isRecord(statusPayload)) {
          throw new Error('Invalid transcription job status payload');
        }
        const status = typeof statusPayload.status === 'string' ? statusPayload.status : 'processing';
        if (status === 'completed') {
          const resultPayload = isRecord(statusPayload.result) ? statusPayload.result : {};
          const transcriptionPayload = isRecord(resultPayload.transcription)
            ? resultPayload.transcription
            : {};
          const segments = normalizeNarrativeTranscriptionSegments(transcriptionPayload.segments);
          const transcriptText =
            sanitizeTranscriptText(transcriptionPayload.text, 4000) ||
            sanitizeTranscriptText(
              segments.map((segment) => segment.text).join(' '),
              4000
            );
          if (segments.length === 0 && transcriptText.length === 0) {
            throw new Error('Transcription completed with no usable speech segments');
          }
          const language =
            typeof transcriptionPayload.language === 'string' &&
            transcriptionPayload.language.trim().length > 0
              ? transcriptionPayload.language.trim()
              : AUTO_EDIT_TRANSCRIPTION_LANGUAGE;
          return {
            language,
            text: transcriptText,
            segments,
          };
        }
        if (status === 'failed' || status === 'cancelled') {
          const failureMessage =
            typeof statusPayload.error === 'string' && statusPayload.error.trim().length > 0
              ? statusPayload.error
              : status === 'cancelled'
                ? 'Transcription cancelled'
                : 'Transcription failed';
          throw new Error(failureMessage);
        }
      }
      throw new Error('Transcription timed out');
    },
    []
  );

  const transcribeAutoEditSource = useCallback(
    async (sourcePath: string, sourceFile: File | null): Promise<NarrativeTranscriptionResult> => {
      const normalizedSourcePath = sourcePath.trim();
      const fileCacheKey =
        sourceFile instanceof File
          ? `${sourceFile.name}:${sourceFile.size}:${sourceFile.lastModified}`
          : '';
      const cache = autoEditTranscriptionCacheRef.current;
      if (normalizedSourcePath && cache.has(normalizedSourcePath)) {
        return cache.get(normalizedSourcePath) as NarrativeTranscriptionResult;
      }
      if (!normalizedSourcePath && fileCacheKey && cache.has(fileCacheKey)) {
        return cache.get(fileCacheKey) as NarrativeTranscriptionResult;
      }

      let startPayload: unknown;
      if (sourceFile instanceof File) {
        const formData = new FormData();
        formData.append('video', sourceFile, sourceFile.name || ('storyarc-autoedit-' + Date.now() + '.mp4'));
        formData.append('language', AUTO_EDIT_TRANSCRIPTION_LANGUAGE);
        startPayload = (await apiRequest('/api/video-analysis/transcribe', {
          method: 'POST',
          body: formData,
        })) as NarrativeTranscriptionJobStartResponse;
      } else {
        if (!normalizedSourcePath) {
          throw new Error('Missing source path for Auto Edit transcription');
        }
        startPayload = (await apiRequest('/api/video-analysis/transcribe', {
          method: 'POST',
          body: {
            video_path: normalizedSourcePath,
            language: AUTO_EDIT_TRANSCRIPTION_LANGUAGE,
            model_size: 'base',
            word_timestamps: true,
          },
        })) as NarrativeTranscriptionJobStartResponse;
      }

      if (!isRecord(startPayload) || startPayload.success !== true || typeof startPayload.job_id !== 'string') {
        const errorMessage =
          isRecord(startPayload) && typeof startPayload.error === 'string'
            ? startPayload.error
            : 'Could not start transcription job';
        throw new Error(errorMessage);
      }

      const transcription = await pollNarrativeTranscriptionJob(startPayload.job_id);
      if (normalizedSourcePath) {
        cache.set(normalizedSourcePath, transcription);
      }
      if (fileCacheKey) {
        cache.set(fileCacheKey, transcription);
      }
      return transcription;
    },
    [pollNarrativeTranscriptionJob]
  );

  const enrichAutoEditClipsWithSpeechContext = useCallback(
    async (contextualClips: BeatClip[]): Promise<AutoEditSpeechEnrichment> => {
      const sourceCandidates = new Map<string, File | null>();
      contextualClips.forEach((clip) => {
        const sourcePath = typeof clip.sourceFile === 'string' ? clip.sourceFile.trim() : '';
        if (!sourcePath || !isUsableMediaSource(sourcePath)) {
          return;
        }
        const track = trackMap.get(clip.trackId);
        const audioTrack =
          (track && isLikelyAudioTrack(track)) ||
          clipTrackLooksAudio(clip.trackId);
        if (audioTrack) {
          return;
        }
        if (!sourceCandidates.has(sourcePath)) {
          sourceCandidates.set(
            sourcePath,
            sourceFileRegistry[sourcePath] instanceof File ? sourceFileRegistry[sourcePath] : null
          );
        }
      });

      if (sourceCandidates.size === 0) {
        return {
          clips: contextualClips,
          sourcesTranscribed: 0,
          clipsEnriched: 0,
        };
      }

      const transcriptionBySource = new Map<string, NarrativeTranscriptionResult>();
      let sourceIndex = 0;
      for (const [sourcePath, sourceFile] of sourceCandidates.entries()) {
        sourceIndex += 1;
        setAutoEditServerProgress(Math.max(2, Math.round((sourceIndex / sourceCandidates.size) * 20)));
        try {
          const transcription = await transcribeAutoEditSource(sourcePath, sourceFile);
          transcriptionBySource.set(sourcePath, transcription);
        } catch (error) {
          console.warn('Auto Edit transcription failed for source:', sourcePath, error);
        }
      }

      if (transcriptionBySource.size === 0) {
        return {
          clips: contextualClips,
          sourcesTranscribed: 0,
          clipsEnriched: 0,
        };
      }

      let clipsEnriched = 0;
      const enrichedClips = contextualClips.map((clip) => {
        const sourcePath = typeof clip.sourceFile === 'string' ? clip.sourceFile.trim() : '';
        if (!sourcePath) {
          return clip;
        }
        const transcription = transcriptionBySource.get(sourcePath);
        if (!transcription) {
          return clip;
        }

        const sourceWindow = resolveClipSourceWindow(clip);
        const overlappingSegments = transcription.segments.filter(
          (segment) => segment.end > sourceWindow.start && segment.start < sourceWindow.end
        );
        const effectiveSegments =
          overlappingSegments.length > 0
            ? overlappingSegments
            : sourceWindow.hasExplicitBounds
              ? []
              : transcription.segments.slice(0, Math.min(6, transcription.segments.length));
        if (effectiveSegments.length === 0) {
          return clip;
        }

        const transcriptText = sanitizeTranscriptText(
          effectiveSegments.map((segment) => segment.text).join(' '),
          AUTO_EDIT_TRANSCRIPT_MAX_LENGTH
        );
        if (!transcriptText) {
          return clip;
        }
        const transcriptPhrases = extractTranscriptPhrases(
          effectiveSegments,
          AUTO_EDIT_TRANSCRIPT_MAX_PHRASES
        );

        const metadata = isRecord(clip.metadata) ? clip.metadata : {};
        const existingAutoEditContext = isRecord(metadata.autoEditContext)
          ? (metadata.autoEditContext as Record<string, unknown>)
          : {};
        const existingTranscriptKeywords = Array.isArray(metadata.transcriptKeywords)
          ? (metadata.transcriptKeywords as unknown[])
              .map((entry) => (typeof entry === 'string' ? entry : ''))
              .filter(Boolean)
          : [];
        const transcriptKeywords = dedupeAutoEditKeywords(
          [
            transcriptText,
            ...transcriptPhrases,
            ...existingTranscriptKeywords,
            typeof existingAutoEditContext.transcriptText === 'string'
              ? existingAutoEditContext.transcriptText
              : null,
          ],
          36
        );
        const speakerFromMetadata = sanitizeTranscriptText(
          typeof metadata.speakerName === 'string'
            ? metadata.speakerName
            : typeof metadata.speaker === 'string'
              ? metadata.speaker
              : typeof existingAutoEditContext.speakerName === 'string'
                ? existingAutoEditContext.speakerName
                : '',
          80
        );
        const speakerFromSegments = sanitizeTranscriptText(
          effectiveSegments
            .map((segment) => segment.speakerName)
            .find((speaker) => typeof speaker === 'string' && speaker.trim().length > 0) || '',
          80
        );
        const speakerName = speakerFromMetadata || speakerFromSegments;

        clipsEnriched += 1;
        return {
          ...clip,
          metadata: {
            ...metadata,
            transcript: transcriptText,
            transcriptKeywords,
            transcriptPhrases,
            transcriptLanguage: transcription.language,
            autoEditContext: {
              ...existingAutoEditContext,
              transcriptText,
              transcriptKeywords,
              transcriptPhrases,
              speakerName: speakerName || undefined,
            },
          },
        };
      });

      return {
        clips: enrichedClips,
        sourcesTranscribed: transcriptionBySource.size,
        clipsEnriched,
      };
    },
    [
      isUsableMediaSource,
      sourceFileRegistry,
      trackMap,
      transcribeAutoEditSource,
    ]
  );

  const runAutoEdit = useCallback(async () => {
    if (clips.length === 0) {
      setSnackbar({
        open: true,
        message: 'Add clips before running Auto Edit.',
        severity: 'warning',
      });
      return;
    }

    setAutoEditRunning(true);
    setAutoEditServerProgress(0);
    setAutoEditJobId(null);
    clearPersistedAutoEditPreview();
    try {
      const snapshot = createAutoEditSnapshot();
      const contextualClips = buildContextualAutoEditClips(clips);
      const speechEnrichment = await enrichAutoEditClipsWithSpeechContext(contextualClips);
      const enrichedClips = speechEnrichment.clips;
      if (speechEnrichment.sourcesTranscribed > 0) {
        console.info(
          'Auto Edit speech enrichment',
          'sources=' + speechEnrichment.sourcesTranscribed,
          'clips=' + speechEnrichment.clipsEnriched
        );
      }
      const autoEditContext = buildAutoEditServerContext(enrichedClips, autoEditOptions);
      const feedbackByClipId: Record<string, AutoEditFeedbackValue> = {};
      enrichedClips.forEach((clip) => {
        const feedback = autoEditFeedbackByClipKey[buildAutoEditClipFeedbackKey(clip)];
        if (feedback === 'approved' || feedback === 'rejected') {
          feedbackByClipId[clip.id] = feedback;
        }
      });
      let serverRanking: AutoEditServerRankingResult | null = null;
      let usedServerRanking = false;

      try {
        let startedAutoEditJobId: string | null = null;
        const serverJobId = await runManagedJob<string>({
          kind: 'autoEdit',
          maxRetries: 1,
          retryDelayMs: 1200,
          onCancel: () => {
            if (!startedAutoEditJobId) {
              return;
            }
            void cancelAutoEditServerJob(startedAutoEditJobId).catch(() => undefined);
          },
          task: async () => {
            const startedJobId = await startAutoEditServerJob({
              storyArcId: storyArcId || storyArc?.id || null,
              clips: enrichedClips,
              tracks,
              options: autoEditOptions,
              frameRate,
              context: autoEditContext,
            });
            startedAutoEditJobId = startedJobId;
            setAutoEditJobId(startedJobId);
            return startedJobId;
          },
        });
        serverRanking = await pollAutoEditServerJob(serverJobId);
        usedServerRanking = true;
      } catch (serverError) {
        if (serverError instanceof Error && serverError.name === 'AbortError') {
          throw serverError;
        }
        clearPersistedServerJob('autoEdit');
        console.warn('Auto Edit server ranking unavailable, using local fallback:', serverError);
      }

      const alternativesResult = createAutoEditAlternatives(
        {
          clips: enrichedClips,
          tracks,
          transitions: transitions.map((transition) => ({ ...transition })),
          markers: markers.map((marker) => ({ ...marker })),
          frameRate,
          humanFeedbackByClipId: feedbackByClipId,
          serverRanking: serverRanking
            ? {
                clipScores: serverRanking.clipScores,
                rankedClipIds: serverRanking.rankedClipIds,
                clipSignalsById: serverRanking.clipSignalsById,
                beatByClipId: serverRanking.beatByClipId,
                confidence: serverRanking.confidence,
                summary: serverRanking.summary,
                modelUsed: serverRanking.modelUsed,
                analyzerAvailable: serverRanking.analyzerAvailable,
                llmBeatClassificationUsed: serverRanking.llmBeatClassificationUsed,
              }
            : null,
        },
        autoEditOptions
      );
      const initialVariant = autoEditOptions.variant || alternativesResult.defaultVariant;
      const proposal =
        alternativesResult.alternatives[initialVariant] ||
        alternativesResult.alternatives.balanced;

      applyAutoEditProposalPreview(
        snapshot,
        proposal,
        usedServerRanking ? 'server' : 'local',
        alternativesResult.alternatives
      );
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setSnackbar({
          open: true,
          message: 'Auto Edit cancelled',
          severity: 'info',
        });
        return;
      }
      const failedHistoryId = `failed:${Date.now()}`;
      appendAutoEditHistoryEntry({
        id: failedHistoryId,
        proposalId: failedHistoryId,
        projectKey: autoEditProjectKey,
        preset: autoEditOptions.preset,
        variant: autoEditOptions.variant,
        intentProfileId: autoEditIntentProfileId,
        confidence: 0,
        duration: 0,
        generatedAt: Date.now(),
        status: 'failed',
        summary: [toErrorMessage(error, 'Unknown error')],
        serverJobId: autoEditJobId,
      });
      setSnackbar({
        open: true,
        message: `Auto Edit failed: ${toErrorMessage(error, 'Unknown error')}`,
        severity: 'error',
      });
    } finally {
      setAutoEditJobId(null);
      setAutoEditServerProgress(null);
      setAutoEditRunning(false);
    }
  }, [
    autoEditFeedbackByClipKey,
    autoEditOptions,
    autoEditIntentProfileId,
    autoEditJobId,
    autoEditProjectKey,
    appendAutoEditHistoryEntry,
    buildAutoEditServerContext,
    buildContextualAutoEditClips,
    clearPersistedAutoEditPreview,
    clips,
    createAutoEditSnapshot,
    enrichAutoEditClipsWithSpeechContext,
    frameRate,
    markers,
    pollAutoEditServerJob,
    runManagedJob,
    clearPersistedServerJob,
    storyArcId,
    storyArc?.id,
    applyAutoEditProposalPreview,
    tracks,
    transitions,
  ]);

  const acceptAutoEditPreview = useCallback(() => {
    if (!autoEditPreview) {
      return;
    }
    const proposalId = autoEditPreview.proposal.proposalId;
    if (appliedAutoEditProposalIdsRef.current.has(proposalId)) {
      setSnackbar({
        open: true,
        message: 'This Auto Edit proposal is already applied.',
        severity: 'info',
      });
      return;
    }
    appliedAutoEditProposalIdsRef.current.add(proposalId);
    markAutoEditHistoryStatus(proposalId, 'applied');
    clearPersistedAutoEditPreview();
    setAutoEditPreview(null);
    setSnackbar({
      open: true,
      message: 'Auto Edit changes applied. Use Undo Auto Edit to roll back.',
      severity: 'info',
    });
  }, [autoEditPreview, clearPersistedAutoEditPreview, markAutoEditHistoryStatus]);

  const rejectAutoEditPreview = useCallback(() => {
    if (!autoEditPreview) {
      return;
    }
    const proposalId = autoEditPreview.proposal.proposalId;
    if (revertedAutoEditProposalIdsRef.current.has(proposalId)) {
      setSnackbar({
        open: true,
        message: 'This Auto Edit proposal is already reverted.',
        severity: 'info',
      });
      return;
    }
    revertedAutoEditProposalIdsRef.current.add(proposalId);
    markAutoEditHistoryStatus(proposalId, 'reverted');
    applyAutoEditSnapshot(autoEditPreview.snapshot);
    setAutoEditPreview(null);
    setLastAutoEditSnapshot(null);
    clearPersistedAutoEditPreview();
    setSnackbar({
      open: true,
      message: 'Auto Edit preview reverted.',
      severity: 'info',
    });
  }, [applyAutoEditSnapshot, autoEditPreview, clearPersistedAutoEditPreview, markAutoEditHistoryStatus]);

  const undoLastAutoEdit = useCallback(() => {
    if (!lastAutoEditSnapshot) {
      return;
    }
    applyAutoEditSnapshot(lastAutoEditSnapshot.snapshot);
    markAutoEditHistoryStatus(lastAutoEditSnapshot.proposal.proposalId, 'reverted');
    setLastAutoEditSnapshot(null);
    setAutoEditPreview(null);
    clearPersistedAutoEditPreview();
    setSnackbar({
      open: true,
      message: 'Reverted last Auto Edit.',
      severity: 'info',
    });
  }, [
    applyAutoEditSnapshot,
    clearPersistedAutoEditPreview,
    lastAutoEditSnapshot,
    markAutoEditHistoryStatus,
  ]);

  const copySelectedClips = useCallback(() => {
    const selected = Array.from(selectedClips)
      .map((clipId) => clipMap.get(clipId))
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
  }, [clipMap, selectedClips]);

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

      const resolvedVideoTrackId =
        sourcePatchVideoTrackId &&
        sourcePatchVideoTrackOptions.some((track) => track.id === sourcePatchVideoTrackId)
          ? sourcePatchVideoTrackId
          : getPrimaryVideoTrackId();
      const resolvedAudioTrackId =
        sourcePatchAudioTrackId &&
        sourcePatchAudioTrackOptions.some((track) => track.id === sourcePatchAudioTrackId)
          ? sourcePatchAudioTrackId
          : getPrimaryAudioTrackId();
      const insertLinkedAudio =
        sourcePatchIncludeAudio &&
        Boolean(resolvedAudioTrackId) &&
        resolvedAudioTrackId !== resolvedVideoTrackId;
      const programWindow = resolveProgramEditWindow(mode, range.duration);
      const sourceWindowDuration = Math.max(frameTime, timelineEngine.snapToFrame(range.outPoint - range.inPoint));
      const effectiveDuration = Math.max(
        frameTime,
        timelineEngine.snapToFrame(Math.min(programWindow.duration, sourceWindowDuration))
      );
      const insertionStart = programWindow.start;
      const insertionEnd = timelineEngine.snapToFrame(insertionStart + effectiveDuration);

      const baseClipId = `insert_${Date.now()}`;
      const generatedVideoClip: BeatClip = {
        ...sourceClip,
        id: baseClipId,
        name: sourceClip.name || 'Inserted Clip',
        beatName: sourceClip.beatName || sourceClip.name || 'Inserted Clip',
        trackId: resolvedVideoTrackId,
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

      const targetTrackInsertions: Array<{ trackId: string; clip: BeatClip }> = [
        { trackId: resolvedVideoTrackId, clip: generatedVideoClip },
      ];

      if (insertLinkedAudio && resolvedAudioTrackId) {
        const generatedAudioClip: BeatClip = {
          ...sourceClip,
          id: `${baseClipId}_audio`,
          name: `${sourceClip.name || 'Inserted Clip'} (Audio)`,
          beatName: `${sourceClip.beatName || sourceClip.name || 'Inserted Clip'} (Audio)`,
          trackId: resolvedAudioTrackId,
          start: insertionStart,
          duration: effectiveDuration,
          type: 'audio',
          metadata: {
            ...(sourceClip.metadata || {}),
            inPoint: range.inPoint,
            outPoint: range.inPoint + effectiveDuration,
            sourceStartTime: range.inPoint,
            insertedFromSource: true,
            editMode: mode,
            usedProgramRange: programWindow.usingProgramRange,
            linkedVideoClipId: generatedVideoClip.id,
            linkedAudio: true,
          },
        };
        targetTrackInsertions.push({ trackId: resolvedAudioTrackId, clip: generatedAudioClip });
      }

      const applyEditToTrack = (trackId: string, insertedClip: BeatClip): BeatClip[] => {
        const trackClips = clips
          .filter((clip) => clip.trackId === trackId)
          .sort((a, b) => a.start - b.start);
        const editedTrackClips: BeatClip[] = [];

        if (mode === 'insert') {
          trackClips.forEach((clip) => {
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
          trackClips.forEach((clip) => {
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

        editedTrackClips.push(insertedClip);
        return editedTrackClips;
      };

      const targetTrackIds = new Set(targetTrackInsertions.map(({ trackId }) => trackId));
      const unaffectedTracks = clips.filter((clip) => !targetTrackIds.has(clip.trackId));
      const editedTracks = targetTrackInsertions.flatMap(({ trackId, clip }) =>
        applyEditToTrack(trackId, clip)
      );
      const updatedClips = [...unaffectedTracks, ...editedTracks];
      const insertedClipIds = new Set(targetTrackInsertions.map(({ clip }) => clip.id));
      applyClipUpdates(updatedClips, insertedClipIds);
      setActiveSourcePreview({
        id: generatedVideoClip.id,
        name: generatedVideoClip.name,
        sourceFile: generatedVideoClip.sourceFile || '',
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
      getPrimaryAudioTrackId,
      sourcePatchVideoTrackId,
      sourcePatchAudioTrackId,
      sourcePatchIncludeAudio,
      sourcePatchVideoTrackOptions,
      sourcePatchAudioTrackOptions,
      clips,
      applyClipUpdates,
      frameTime,
    ]
  );

  const cycleSourcePatchTrack = useCallback(
    (kind: 'video' | 'audio', direction: 1 | -1) => {
      if (kind === 'video') {
        if (sourcePatchVideoTrackOptions.length === 0) {
          return;
        }
        setSourcePatchVideoTrackId((previous) => {
          const currentIndex = sourcePatchVideoTrackOptions.findIndex((track) => track.id === previous);
          const safeIndex = currentIndex >= 0 ? currentIndex : 0;
          const nextIndex =
            (safeIndex + direction + sourcePatchVideoTrackOptions.length) %
            sourcePatchVideoTrackOptions.length;
          return sourcePatchVideoTrackOptions[nextIndex].id;
        });
        return;
      }

      if (sourcePatchAudioTrackOptions.length === 0) {
        return;
      }
      setSourcePatchAudioTrackId((previous) => {
        const currentIndex = sourcePatchAudioTrackOptions.findIndex((track) => track.id === previous);
        const safeIndex = currentIndex >= 0 ? currentIndex : 0;
        const nextIndex =
          (safeIndex + direction + sourcePatchAudioTrackOptions.length) %
          sourcePatchAudioTrackOptions.length;
        return sourcePatchAudioTrackOptions[nextIndex].id;
      });
    },
    [sourcePatchVideoTrackOptions, sourcePatchAudioTrackOptions]
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
      color: '#60a5fa',
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

  const primaryAutoBindSource = useMemo(() => {
    return [
      activeSourcePreview?.sourceFile,
      sourcePreviewClip?.sourceFile,
      previewClip?.sourceFile,
      ...availableVideoSources,
    ]
      .map((candidate) => (typeof candidate === 'string' ? candidate.trim() : ''))
      .find((candidate) => Boolean(candidate) && isUsableMediaSource(candidate)) || null;
  }, [
    activeSourcePreview?.sourceFile,
    sourcePreviewClip?.sourceFile,
    previewClip?.sourceFile,
    availableVideoSources,
    isUsableMediaSource,
  ]);

  const missingVideoSourceClipCount = useMemo(() => {
    return clips.filter((clip) => {
      const trackId = (clip.trackId || '').toLowerCase();
      const isAudioTrack = trackId.startsWith('audio') || trackStates[clip.trackId]?.type === 'audio';
      if (isAudioTrack) {
        return false;
      }
      const source = clip.sourceFile?.trim();
      return !source || !isUsableMediaSource(source);
    }).length;
  }, [clips, trackStates, isUsableMediaSource]);

  const autoBindMissingVideoSources = useCallback(() => {
    const fallbackSource = primaryAutoBindSource;
    if (!fallbackSource) {
      setActiveMonitor('source');
      setSnackbar({
        open: true,
        message: 'Upload or select a source clip before auto-bind.',
        severity: 'warning',
      });
      return;
    }

    let boundCount = 0;
    const updatedClips = clips.map((clip) => {
      const trackId = (clip.trackId || '').toLowerCase();
      const isAudioTrack = trackId.startsWith('audio') || trackStates[clip.trackId]?.type === 'audio';
      if (isAudioTrack) {
        return clip;
      }
      const source = clip.sourceFile?.trim();
      if (source && isUsableMediaSource(source)) {
        return clip;
      }

      boundCount += 1;
      return {
        ...clip,
        sourceFile: fallbackSource,
        metadata: {
          ...(clip.metadata || {}),
          autoBoundSource: true,
          missingSource: false,
          autoBoundAt: new Date().toISOString(),
        },
      };
    });

    if (boundCount === 0) {
      setSnackbar({
        open: true,
        message: 'All timeline clips already have playable media sources.',
        severity: 'info',
      });
      return;
    }

    applyClipUpdates(updatedClips, selectedClips.size > 0 ? new Set(selectedClips) : undefined);
    setActiveSourcePreview((previous) => {
      if (previous?.sourceFile === fallbackSource) {
        return previous;
      }
      return {
        id: previous?.id || fallbackSource,
        name: previous?.name || 'Auto-bound Source',
        sourceFile: fallbackSource,
        file: sourceFileRegistry[fallbackSource],
      };
    });
    setActiveMonitor('program');
    setSnackbar({
      open: true,
      message: `Auto-bound ${boundCount} clip${boundCount === 1 ? '' : 's'} to selected source.`,
      severity: 'success',
    });
  }, [
    primaryAutoBindSource,
    clips,
    trackStates,
    isUsableMediaSource,
    applyClipUpdates,
    selectedClips,
    sourceFileRegistry,
  ]);

  const jumpToFirstTimelineVideoClip = useCallback(() => {
    const firstVideoClip = clips
      .filter((clip) => {
        const trackId = (clip.trackId || '').toLowerCase();
        const isAudioTrack = trackId.startsWith('audio') || trackStates[clip.trackId]?.type === 'audio';
        return !isAudioTrack && clip.duration > 0;
      })
      .sort((left, right) => left.start - right.start)[0];

    if (!firstVideoClip) {
      setSnackbar({
        open: true,
        message: 'No timeline video clips found yet. Add media from Asset Browser first.',
        severity: 'warning',
      });
      return;
    }

    setCurrentTime(Math.max(0, firstVideoClip.start));
    setSelectedClips(new Set([firstVideoClip.id]));
    setActiveMonitor('program');

    const source = firstVideoClip.sourceFile?.trim();
    if (!source || !isUsableMediaSource(source)) {
      setSnackbar({
        open: true,
        message: 'Selected first clip, but source is missing. Use Auto-bind to attach media.',
        severity: 'warning',
      });
    }
  }, [clips, trackStates, isUsableMediaSource]);

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

  const setTimelineZoomFromUser = useCallback((nextZoom: number) => {
    userAdjustedTimelineZoomRef.current = true;
    setTimelineZoom(clampTimelineZoomValue(nextZoom));
  }, []);

  const handleZoomChange = (event: Event, newValue: number | number[]) => {
    setTimelineZoomFromUser(newValue as number);
  };

  const adjustTimelineZoom = useCallback((delta: number) => {
    userAdjustedTimelineZoomRef.current = true;
    setTimelineZoom((previous) => clampTimelineZoomValue(previous + delta));
  }, []);

  const resetTimelineZoom = useCallback(() => {
    setTimelineZoomFromUser(DEFAULT_TIMELINE_ZOOM);
  }, [setTimelineZoomFromUser]);

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

      if (preset === 'fairlight') {
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
      }

      return {
        workspacePreset: 'deliver',
        showAssetPanel: false,
        showInspectorPanel: false,
        showEffectsPanel: false,
        showMixerPanel: false,
        panelSizes: { leftPanel: 260, rightPanel: 280 },
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
    if (layout.workspacePreset && ['edit', 'cut', 'color', 'fairlight', 'deliver'].includes(layout.workspacePreset)) {
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

  const activateWorkspaceFromNav = useCallback(
    (preset: ResolveWorkspacePreset) => {
      if (workspacePreset === preset) {
        return;
      }
      applyWorkspacePreset(preset);
    },
    [workspacePreset, applyWorkspacePreset]
  );

  const applyWorkflowStep = useCallback(
    (step: ResolveWorkflowStep) => {
      setWorkflowStep(step);

      if (step === 'import') {
        applyWorkspacePreset('cut');
        setShowAssetPanel(true);
        setShowInspectorPanel(false);
        setShowEffectsPanel(false);
        setShowMixerPanel(false);
        setShowProgramMonitor(true);
        setEditTool('select');
        setActiveMonitor('source');
        return;
      }

      if (step === 'assemble') {
        applyWorkspacePreset('edit');
        setShowAssetPanel(true);
        setShowInspectorPanel(true);
        setShowEffectsPanel(false);
        setShowMixerPanel(false);
        setShowProgramMonitor(true);
        setEditTool('select');
        setActiveMonitor('program');
        return;
      }

      if (step === 'trim') {
        applyWorkspacePreset('edit');
        setShowAssetPanel(false);
        setShowInspectorPanel(true);
        setShowEffectsPanel(false);
        setShowMixerPanel(false);
        setShowProgramMonitor(true);
        setEditTool('trim');
        setActiveMonitor('program');
        return;
      }

      if (step === 'polish') {
        applyWorkspacePreset('color');
        setShowAssetPanel(false);
        setShowInspectorPanel(true);
        setShowEffectsPanel(true);
        setShowMixerPanel(false);
        setShowProgramMonitor(true);
        setEditTool('select');
        setActiveMonitor('program');
        return;
      }

      applyWorkspacePreset('deliver');
      setShowAssetPanel(false);
      setShowInspectorPanel(false);
      setShowEffectsPanel(false);
      setShowMixerPanel(false);
      setShowProgramMonitor(true);
      setEditTool('select');
      setActiveMonitor('program');
    },
    [applyWorkspacePreset]
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      setWorkspaceProfilesReady(true);
      setLayoutStateReady(true);
      return;
    }

    try {
      const layoutPayload = getSafeLocalStorageItem(RESOLVE_LAYOUT_STORAGE_KEY);
      if (layoutPayload) {
        const parsedLayout = JSON.parse(layoutPayload) as Partial<ResolveLayoutState>;
        applyStoredLayoutState(parsedLayout);
      }
    } catch (error) {
      console.warn('Could not restore Resolve layout state:', error);
    }

    try {
      const workspaceDockSlotsPayload =
        getSafeLocalStorageItem(RESOLVE_WORKSPACE_DOCK_SLOTS_STORAGE_KEY) ||
        getSafeLocalStorageItem(RESOLVE_DOCK_SLOTS_STORAGE_KEY);
      if (workspaceDockSlotsPayload) {
        const parsedDockSlots = JSON.parse(workspaceDockSlotsPayload) as unknown;
        setSavedDockSlotsByWorkspace(normalizeWorkspaceDockSlots(parsedDockSlots));
      }
    } catch (error) {
      console.warn('Could not restore Resolve dock slots:', error);
    }

    try {
      const workspaceProfilesPayload = getSafeLocalStorageItem(RESOLVE_WORKSPACE_PROFILES_STORAGE_KEY);
      if (workspaceProfilesPayload) {
        const parsedProfiles = JSON.parse(workspaceProfilesPayload) as Partial<
          Record<ResolveWorkspacePreset, ResolveLayoutState | null>
        >;
        const restoredProfiles = createEmptyWorkspaceProfiles();
        (['edit', 'cut', 'color', 'fairlight', 'deliver'] as const).forEach((preset) => {
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
      setSafeLocalStorageItem(
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
      setSafeLocalStorageItem(
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
      setSafeLocalStorageItem(
        RESOLVE_WORKSPACE_DOCK_SLOTS_STORAGE_KEY,
        JSON.stringify(savedDockSlotsByWorkspace)
      );
    } catch (error) {
      console.warn('Could not persist Resolve dock slots:', error);
    }
  }, [layoutStateReady, savedDockSlotsByWorkspace]);

  const saveDockSlot = useCallback(
    (slot: ResolveDockSlotId) => {
      const snapshot = buildLayoutStateSnapshot();
      setSavedDockSlotsByWorkspace((previous) => ({
        ...previous,
        [workspacePreset]: {
          ...previous[workspacePreset],
          [slot]: snapshot,
        },
      }));
      setSnackbar({
        open: true,
        message: `Saved ${workspacePreset.toUpperCase()} dock layout to ${slot.toUpperCase()}`,
        severity: 'success',
      });
    },
    [buildLayoutStateSnapshot, workspacePreset]
  );

  const loadDockSlot = useCallback(
    (slot: ResolveDockSlotId) => {
      const snapshot = savedDockSlotsByWorkspace[workspacePreset][slot];
      if (!snapshot) {
        setSnackbar({
          open: true,
          message: `${workspacePreset.toUpperCase()} ${slot.toUpperCase()} is empty. Save a layout first.`,
          severity: 'warning',
        });
        return;
      }

      applyStoredLayoutState(snapshot);
      setSnackbar({
        open: true,
        message: `Loaded ${workspacePreset.toUpperCase()} dock layout from ${slot.toUpperCase()}`,
        severity: 'success',
      });
    },
    [savedDockSlotsByWorkspace, workspacePreset, applyStoredLayoutState]
  );

  const resetResolveLayout = useCallback(() => {
    const defaultLayout = buildDefaultLayoutForPreset(workspacePreset);
    applyStoredLayoutState(defaultLayout);
    setWorkspacePreset(workspacePreset);
    setActiveMonitor('program');
    setWorkspaceProfiles((previous) => ({
      ...previous,
      [workspacePreset]: defaultLayout,
    }));
    setSavedDockSlotsByWorkspace((previous) => ({
      ...previous,
      [workspacePreset]: createEmptyDockSlots(),
    }));
    setSnackbar({
      open: true,
      message: `Reset ${workspacePreset.toUpperCase()} workspace layout + dock bank`,
      severity: 'success',
    });
  }, [applyStoredLayoutState, buildDefaultLayoutForPreset, workspacePreset]);

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
      const stored = getSafeLocalStorageItem(COMPOSITION_SETTINGS_STORAGE_KEY);
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
      setSafeLocalStorageItem(COMPOSITION_SETTINGS_STORAGE_KEY, JSON.stringify(payload));
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

  const downloadCaptionsSrt = useCallback(() => {
    if (!captionsExport) {
      return;
    }
    downloadCaptionFile(captionsExport.srt, 'srt');
  }, [captionsExport, downloadCaptionFile]);

  const downloadCaptionsVtt = useCallback(() => {
    if (!captionsExport) {
      return;
    }
    downloadCaptionFile(captionsExport.vtt, 'vtt');
  }, [captionsExport, downloadCaptionFile]);

  const clearCaptionsPackage = useCallback(() => {
    setCaptionsExport(null);
  }, []);

  const handleSelectLUT = useCallback(
    (lutPath: string, lutName: string) => {
      const selectedLUT = LUTEngine.getLUTLibrary()
        .flatMap((category) => category.luts)
        .find((lut) => lut.path === lutPath || lut.name === lutName);
      const resolvedName = selectedLUT?.name || lutName;
      setSelectedLUTName(resolvedName);
      setShowLUTLibraryDialog(false);
      setCurrentColorGrade((previous) => ({
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

  const getClipFadeDuration = useCallback((
    clip: BeatClip,
    layer: 'video' | 'audio',
    edge: 'in' | 'out'
  ): number => {
    if (!isRecord(clip.metadata)) {
      return 0;
    }
    const fadeKey = `${layer}Fade${edge === 'in' ? 'In' : 'Out'}`;
    const fadeEntry = isRecord(clip.metadata[fadeKey]) ? clip.metadata[fadeKey] : null;
    if (fadeEntry && typeof fadeEntry.duration === 'number' && Number.isFinite(fadeEntry.duration) && fadeEntry.duration > 0) {
      return fadeEntry.duration;
    }
    const transitions = isRecord(clip.metadata.transitions) ? clip.metadata.transitions : null;
    const transitionEntry = transitions && isRecord(transitions[edge]) ? transitions[edge] : null;
    if (!transitionEntry) {
      return 0;
    }
    const transitionLayer = transitionEntry.layer;
    if ((transitionLayer === 'video' || transitionLayer === 'audio') && transitionLayer !== layer) {
      return 0;
    }
    if (typeof transitionEntry.duration === 'number' && Number.isFinite(transitionEntry.duration) && transitionEntry.duration > 0) {
      return transitionEntry.duration;
    }
    return 0;
  }, []);

  const resolveClipVideoOpacity = useCallback((clip: BeatClip | null, timelineLocalTime: number): number => {
    if (!clip || !Number.isFinite(timelineLocalTime)) {
      return 1;
    }
    const fadeIn = Math.max(0, getClipFadeDuration(clip, 'video', 'in'));
    const fadeOut = Math.max(0, getClipFadeDuration(clip, 'video', 'out'));
    const clampedLocal = Math.max(0, Math.min(clip.duration, timelineLocalTime));
    const fadeInFactor = fadeIn > 0 ? Math.max(0, Math.min(1, clampedLocal / fadeIn)) : 1;
    const timeRemaining = Math.max(0, clip.duration - clampedLocal);
    const fadeOutFactor = fadeOut > 0 ? Math.max(0, Math.min(1, timeRemaining / fadeOut)) : 1;
    return Math.max(0, Math.min(1, Math.min(fadeInFactor, fadeOutFactor)));
  }, [getClipFadeDuration]);

  const getSelectedPrimaryClip = useCallback((): BeatClip | null => {
    const selected = Array.from(selectedClips)
      .map((clipId) => clipMap.get(clipId))
      .find((clip): clip is BeatClip => Boolean(clip));
    return selected || null;
  }, [selectedClips, clipMap]);

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
      .map((clipId) => clipMap.get(clipId))
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
  }, [selectedClips, clipMap, clips, applyClipUpdates]);

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
      sourcePreviewClip && (sourcePreviewClip.sourceFile?.trim().length ?? 0) > 0 ? sourcePreviewClip : null;
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
      color: '#60a5fa',
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
    if (!ENABLE_EDITOR_TEST_HOOKS) {
      return;
    }

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
        clips.map((clip) => {
          const effectiveTrackType = isAudioTrackId(clip.trackId) ? 'audio' : 'video';
          return {
            clipId: clip.id,
            trackId: clip.trackId,
            trackType: effectiveTrackType,
            start: clip.start,
            duration: clip.duration,
            name: clip.name || clip.beatName || clip.id,
            sourceFile: clip.sourceFile || '',
          };
        }),
      snapshot: (clipId) => {
        const targetId = clipId || Array.from(selectedClips)[0];
        if (!targetId) {
          return null;
        }
        const clip = clipMap.get(targetId);
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
      moveSelectedByFrames: (frames) => {
        const target = getSelectedPrimaryClip();
        if (!target) {
          return false;
        }
        const delta = timelineEngine.snapToFrame(frames * frameTime);
        if (Math.abs(delta) < frameTime / 10) {
          return false;
        }
        const nextStart = timelineEngine.snapToFrame(Math.max(0, target.start + delta));
        let next = moveClipWithEditTool(clips, target.id, nextStart, target.trackId);
        if (safeTrimMode && hasTimelineOverlapOnTrack(next, target.trackId)) {
          return false;
        }
        if (magneticEnabled && editTool !== 'slip') {
          next = resolveOverlaps(next, target.trackId);
        }
        const updatedTarget = next.find((clip) => clip.id === target.id);
        if (!updatedTarget) {
          return false;
        }
        if (Math.abs(updatedTarget.start - target.start) < frameTime / 10) {
          return false;
        }
        applyClipUpdates(next, new Set([target.id]));
        return true;
      },
      setSafeTrimEnabled: (enabled) => {
        setSafeTrimMode(enabled);
      },
      getSelectedClipIds: () => Array.from(selectedClips),
      getProgramMarks: () => ({
        inPoint: programMarkIn,
        outPoint: programMarkOut,
      }),
      getShortcutParityMatrix: () => STORY_ARC_SHORTCUT_PARITY_MATRIX,
      triggerShortcut: (shortcut) => {
        if (!shortcut || typeof shortcut.key !== 'string' || shortcut.key.trim().length === 0) {
          return false;
        }
        const keyboardEvent = new KeyboardEvent('keydown', {
          key: shortcut.key,
          bubbles: true,
          cancelable: true,
          shiftKey: Boolean(shortcut.shiftKey),
          altKey: Boolean(shortcut.altKey),
          ctrlKey: Boolean(shortcut.ctrlKey),
          metaKey: Boolean(shortcut.metaKey),
        });
        document.dispatchEvent(keyboardEvent);
        return keyboardEvent.defaultPrevented;
      },
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
    clipMap,
    isAudioTrackId,
    selectedClips,
    programMarkIn,
    programMarkOut,
    getClipInPoint,
    trimSelectedByFrames,
    slipSelectedByFrames,
    slideSelectedByFrames,
    rollSelectedByFrames,
    moveClipWithEditTool,
    resolveOverlaps,
    hasTimelineOverlapOnTrack,
    magneticEnabled,
    editTool,
    safeTrimMode,
    frameTime,
    getSelectedPrimaryClip,
    applyClipUpdates,
    totalDuration,
    seedTimelineFixture,
    ENABLE_EDITOR_TEST_HOOKS,
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
        case 'arrowup':
          if (!e.ctrlKey && !e.metaKey && !e.altKey && e.shiftKey) {
            e.preventDefault();
            adjustTimelineZoom(0.1);
          }
          break;
        case 'arrowdown':
          if (!e.ctrlKey && !e.metaKey && !e.altKey && e.shiftKey) {
            e.preventDefault();
            adjustTimelineZoom(-0.1);
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
        case 'q':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            setSafeTrimMode((previous) => !previous);
          }
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
        case '=':
        case '+':
        case 'add':
          if (!e.altKey) {
            e.preventDefault();
            adjustTimelineZoom(0.1);
          }
          break;
        case '-':
        case '_':
        case 'subtract':
          if (!e.altKey) {
            e.preventDefault();
            adjustTimelineZoom(-0.1);
          }
          break;
        case '0':
          if ((e.ctrlKey || e.metaKey) && !e.altKey) {
            e.preventDefault();
            resetTimelineZoom();
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
        case '[':
          if (e.altKey) {
            e.preventDefault();
            cycleSourcePatchTrack('video', -1);
          }
          break;
        case ']':
          if (e.altKey) {
            e.preventDefault();
            cycleSourcePatchTrack('video', 1);
          }
          break;
        case '\\':
          if (e.altKey) {
            e.preventDefault();
            cycleSourcePatchTrack('audio', 1);
          }
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
    cycleSourcePatchTrack,
    multicamEnabled,
    multicamAngleCandidates,
    applyMulticamAngle,
    handleSourcePlayPause,
    pauseSourcePlayback,
    seekSourcePlayback,
    stepSourceBackward,
    stepSourceForward,
    adjustTimelineZoom,
    resetTimelineZoom,
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
  const selectedPrimaryClipId = useMemo(
    () => Array.from(selectedClips)[0] ?? null,
    [selectedClips]
  );
  const selectedPrimaryClip = useMemo(
    () => (selectedPrimaryClipId ? clipMap.get(selectedPrimaryClipId) ?? null : null),
    [clipMap, selectedPrimaryClipId]
  );

  useEffect(() => {
    if (!selectedPrimaryClip) {
      setCurrentSpeedKeyframes([]);
      return;
    }
    const rawKeyframes = selectedPrimaryClip.metadata?.speedKeyframes;
    if (!Array.isArray(rawKeyframes)) {
      setCurrentSpeedKeyframes([]);
      return;
    }

    const allowedCurves = new Set<SpeedKeyframe['curveType']>([
      'linear',
      'ease_in',
      'ease_out',
      'ease_in_out',
      'bezier',
    ]);

    const parsed = rawKeyframes
      .flatMap((entry): SpeedKeyframe[] => {
        if (!isRecord(entry)) {
          return [];
        }
        const time = typeof entry.time === 'number' && Number.isFinite(entry.time) ? entry.time : null;
        const speed = typeof entry.speed === 'number' && Number.isFinite(entry.speed) ? entry.speed : null;
        const curveRaw = typeof entry.curveType === 'string' ? entry.curveType : 'linear';
        if (time === null || speed === null) {
          return [];
        }
        const curveType: SpeedKeyframe['curveType'] = allowedCurves.has(curveRaw as SpeedKeyframe['curveType'])
          ? (curveRaw as SpeedKeyframe['curveType'])
          : 'linear';
        return [{ time, speed, curveType }];
      })
      .sort((left, right) => left.time - right.time);

    setCurrentSpeedKeyframes(parsed);
  }, [selectedPrimaryClip]);

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

  const programMonitorTimelineLocalTime = useMemo(() => {
    if (!programMonitorClip) {
      return 0;
    }
    return Math.max(0, Math.min(programMonitorClip.duration, currentTime - programMonitorClip.start));
  }, [programMonitorClip, currentTime]);

  const programMonitorOpacity = useMemo(() => {
    return resolveClipVideoOpacity(programMonitorClip, programMonitorTimelineLocalTime);
  }, [programMonitorClip, programMonitorTimelineLocalTime, resolveClipVideoOpacity]);

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
        if (!isAudioTrackId(clip.trackId)) {
          return false;
        }
        return isAudioTrackAudible(clip.trackId);
      }) || null,
    [clips, isUsableMediaSource, isAudioTrackId, isAudioTrackAudible]
  );
  const waveformAudioUrl = primaryAudioClip?.sourceFile?.trim() || '';
  const audioRoleLabelByValue = useMemo(
    () =>
      AUDIO_TRACK_ROLE_OPTIONS.reduce<Record<AudioTrackRole, string>>((accumulator, option) => {
        accumulator[option.value] = option.label;
        return accumulator;
      }, {} as Record<AudioTrackRole, string>),
    []
  );
  const mixerAudioTracks = useMemo(
    () => tracks.filter((track) => isAudioTrackId(track.id)),
    [tracks, isAudioTrackId]
  );
  const mixerAudioTracksSorted = useMemo(() => {
    return [...mixerAudioTracks].sort((left, right) => {
      const leftRole = resolveAudioRoleForTrackId(left.id);
      const rightRole = resolveAudioRoleForTrackId(right.id);
      const leftRoleIndex = AUDIO_ROLE_ORDER.indexOf(leftRole);
      const rightRoleIndex = AUDIO_ROLE_ORDER.indexOf(rightRole);
      if (leftRoleIndex !== rightRoleIndex) {
        return leftRoleIndex - rightRoleIndex;
      }
      return left.name.localeCompare(right.name);
    });
  }, [mixerAudioTracks, resolveAudioRoleForTrackId]);
  const toggleAudioRoleMute = useCallback((role: AudioTrackRole) => {
    setAudioRoleMuteState((previous) => ({ ...previous, [role]: !previous[role] }));
  }, []);
  const toggleAudioRoleSolo = useCallback((role: AudioTrackRole) => {
    setAudioRoleSoloState((previous) => ({ ...previous, [role]: !previous[role] }));
  }, []);
  const clearAudioRoleAutomation = useCallback(() => {
    setAudioRoleMuteState(buildAudioRoleBooleanMap(false));
    setAudioRoleSoloState(buildAudioRoleBooleanMap(false));
    setAudioRoleFocus('all');
  }, []);
  const groupAudioTracksByRole = useCallback(() => {
    setTracks((previous) => {
      const videoTracks = previous.filter((track) => !isAudioTrackId(track.id));
      const audioTracks = previous.filter((track) => isAudioTrackId(track.id));
      const sortedAudioTracks = [...audioTracks].sort((left, right) => {
        const leftRole = trackStates[left.id]?.audioRole ?? inferAudioRoleFromTrackName(left.name);
        const rightRole = trackStates[right.id]?.audioRole ?? inferAudioRoleFromTrackName(right.name);
        const leftIndex = AUDIO_ROLE_ORDER.indexOf(leftRole);
        const rightIndex = AUDIO_ROLE_ORDER.indexOf(rightRole);
        if (leftIndex !== rightIndex) {
          return leftIndex - rightIndex;
        }
        return left.name.localeCompare(right.name);
      });
      return [...videoTracks, ...sortedAudioTracks];
    });
    setSnackbar({
      open: true,
      message: 'Audio lanes grouped by role',
      severity: 'success',
    });
  }, [isAudioTrackId, trackStates]);

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

  const markSourceInAtCurrentTime = useCallback(() => {
    setSourceMark('in', sourcePreviewLocalTime);
  }, [setSourceMark, sourcePreviewLocalTime]);

  const markSourceOutAtCurrentTime = useCallback(() => {
    setSourceMark('out', sourcePreviewLocalTime);
  }, [setSourceMark, sourcePreviewLocalTime]);

  const jumpToSourceMarkIn = useCallback(() => {
    jumpToSourceMark('in');
  }, [jumpToSourceMark]);

  const jumpToSourceMarkOut = useCallback(() => {
    jumpToSourceMark('out');
  }, [jumpToSourceMark]);

  const clearSourceMarks = useCallback(() => {
    setSourceMarkIn(null);
    setSourceMarkOut(null);
  }, []);

  const insertSourceClip = useCallback(() => {
    insertOrOverwriteFromSource('insert', sourcePreviewClip);
  }, [insertOrOverwriteFromSource, sourcePreviewClip]);

  const overwriteSourceClip = useCallback(() => {
    insertOrOverwriteFromSource('overwrite', sourcePreviewClip);
  }, [insertOrOverwriteFromSource, sourcePreviewClip]);

  const markProgramInAtCurrentTime = useCallback(() => {
    setProgramMark('in');
  }, [setProgramMark]);

  const markProgramOutAtCurrentTime = useCallback(() => {
    setProgramMark('out');
  }, [setProgramMark]);

  const jumpToProgramMarkIn = useCallback(() => {
    jumpToProgramMark('in');
  }, [jumpToProgramMark]);

  const jumpToProgramMarkOut = useCallback(() => {
    jumpToProgramMark('out');
  }, [jumpToProgramMark]);

  const clearProgramMarks = useCallback(() => {
    setProgramMarkIn(null);
    setProgramMarkOut(null);
  }, []);

  const advanceOnboardingStep = useCallback(() => {
    setOnboardingStep((step) => step + 1);
  }, []);

  const toggleActiveMonitorFocus = useCallback(() => {
    setActiveMonitor((previous) => (previous === 'source' ? 'program' : 'source'));
  }, []);

  const handleActiveJKLReverse = useCallback(() => {
    handleActiveJKL('j');
  }, [handleActiveJKL]);

  const handleActiveJKLPause = useCallback(() => {
    handleActiveJKL('k');
  }, [handleActiveJKL]);

  const handleActiveJKLForward = useCallback(() => {
    handleActiveJKL('l');
  }, [handleActiveJKL]);

  const toggleLoopPlayback = useCallback(() => {
    setIsLooping((previous) => !previous);
  }, []);

  const toggleFullscreenMonitor = useCallback(() => {
    setIsFullscreenPreview((previous) => !previous);
  }, []);

  const triggerImportProject = useCallback(() => {
    void handleImportFromProject();
  }, [handleImportFromProject]);

  const triggerExportProject = useCallback(() => {
    void handleExportToProject({
      url: programMonitorClip?.sourceFile || '',
      duration: totalDuration,
      format: 'mp4',
      resolution: '1920x1080',
      codec: 'H.264',
    });
  }, [handleExportToProject, programMonitorClip?.sourceFile, totalDuration]);

  const toggleSpeedRampPanel = useCallback(() => {
    setShowSpeedRampPanel((previous) => !previous);
  }, []);

  const toggleMagneticMode = useCallback(() => {
    setMagneticEnabled((previous) => !previous);
  }, []);

  const toggleRippleMode = useCallback(() => {
    setRippleEnabled((previous) => !previous);
  }, []);

  const toggleReviewerMode = useCallback(() => {
    setReviewerMode((previous) => !previous);
  }, []);

  const activateSelectTool = useCallback(() => {
    setEditTool('select');
  }, []);

  const activateTrimTool = useCallback(() => {
    setEditTool('trim');
  }, []);

  const activateRollTool = useCallback(() => {
    setEditTool('roll');
  }, []);

  const activateSlipTool = useCallback(() => {
    setEditTool('slip');
  }, []);

  const activateSlideTool = useCallback(() => {
    setEditTool('slide');
  }, []);

  const toggleSafeTrimMode = useCallback(() => {
    setSafeTrimMode((previous) => !previous);
  }, []);

  const toggleCompareMode = useCallback(() => {
    setCompareMode((previous) => {
      if (!previous) {
        setCompareSnapshot(clips);
      }
      return !previous;
    });
  }, [clips]);

  const addMarkerAtPlayhead = useCallback(() => {
    const markerId = `m${Date.now()}`;
    setMarkers((previous) => [
      ...previous,
      {
        id: markerId,
        time: currentTime,
        color: '#ff9800',
        label: `Marker ${previous.length + 1}`,
      },
    ]);
  }, [currentTime]);

  const addTransitionToClipEdge = useCallback((
    clip: BeatClip,
    edge: 'in' | 'out',
    options?: {
      type?: string;
      duration?: number;
      layer?: 'video' | 'audio';
      engine?: 'canvas2d' | 'webgl' | 'audio';
    }
  ): { time: number; layer: 'video' | 'audio'; transitionType: string; duration: number } => {
    const baseClip = clips.find((entry) => entry.id === clip.id);
    if (!baseClip) {
      return {
        time: timelineEngine.snapToFrame(Math.max(0, edge === 'in' ? clip.start : clip.start + clip.duration)),
        layer: options?.layer ?? (isAudioTrackId(clip.trackId) ? 'audio' : 'video'),
        transitionType: options?.type || 'crossfade',
        duration: Math.max(frameTime, options?.duration || 0.5),
      };
    }

    const resolvedLayer = options?.layer ?? (isAudioTrackId(baseClip.trackId) ? 'audio' : 'video');
    const transitionType =
      options?.type || (resolvedLayer === 'audio' ? 'audio_crossfade' : 'crossfade');
    const requestedDuration =
      typeof options?.duration === 'number' && Number.isFinite(options.duration) && options.duration > 0
        ? options.duration
        : resolvedLayer === 'audio'
          ? 0.25
          : 0.5;
    const transitionEngine: 'canvas2d' | 'webgl' | 'audio' =
      options?.engine ?? (resolvedLayer === 'audio' ? 'audio' : pendingTransitionEngine);
    const nowIso = new Date().toISOString();

    const trackClips = clips
      .filter((entry) => entry.trackId === baseClip.trackId)
      .sort((left, right) => left.start - right.start);
    const baseIndex = trackClips.findIndex((entry) => entry.id === baseClip.id);
    const partnerClip =
      baseIndex >= 0
        ? edge === 'out'
          ? trackClips[baseIndex + 1] || null
          : trackClips[baseIndex - 1] || null
        : null;

    let transitionTime = timelineEngine.snapToFrame(
      Math.max(0, edge === 'in' ? baseClip.start : baseClip.start + baseClip.duration)
    );
    let appliedDuration = timelineEngine.snapToFrame(Math.max(frameTime, requestedDuration));

    const updateTransitionMetadata = (
      targetClip: BeatClip,
      transitionEdge: 'in' | 'out',
      linkedClipId: string | null
    ): BeatClip => {
      const existingTransitions =
        isRecord(targetClip.metadata?.transitions)
          ? (targetClip.metadata.transitions as Record<string, unknown>)
          : {};
      const baseMetadata = targetClip.metadata || {};
      const transitionMetadata = {
        ...(isRecord(existingTransitions[transitionEdge]) ? existingTransitions[transitionEdge] : {}),
        type: transitionType,
        duration: appliedDuration,
        layer: resolvedLayer,
        engine: transitionEngine,
        appliedAt: nowIso,
        ...(transitionEdge === 'out'
          ? { targetClipId: linkedClipId }
          : { sourceClipId: linkedClipId }),
      };

      const fadeKey = `${resolvedLayer}Fade${transitionEdge === 'in' ? 'In' : 'Out'}`;
      return {
        ...targetClip,
        metadata: {
          ...baseMetadata,
          transitions: {
            ...existingTransitions,
            [transitionEdge]: transitionMetadata,
          },
          [fadeKey]: {
            duration: appliedDuration,
            curve: 'linear',
            appliedAt: nowIso,
          },
        },
      };
    };

    const nextClipMap = new Map<string, BeatClip>(clips.map((entry) => [entry.id, entry]));

    if (partnerClip) {
      const maxCrossfadeDuration = timelineEngine.snapToFrame(
        Math.max(
          frameTime,
          Math.min(
            Math.max(frameTime, baseClip.duration - frameTime),
            Math.max(frameTime, partnerClip.duration - frameTime)
          )
        )
      );
      appliedDuration = timelineEngine.snapToFrame(
        Math.max(frameTime, Math.min(requestedDuration, maxCrossfadeDuration))
      );

      if (edge === 'out') {
        const cutTime = timelineEngine.snapToFrame(baseClip.start + baseClip.duration);
        const minPartnerStart = timelineEngine.snapToFrame(Math.max(0, baseClip.start + frameTime));
        const nextPartnerStart = timelineEngine.snapToFrame(
          Math.max(minPartnerStart, cutTime - appliedDuration)
        );
        appliedDuration = timelineEngine.snapToFrame(Math.max(frameTime, cutTime - nextPartnerStart));
        transitionTime = cutTime;
        nextClipMap.set(partnerClip.id, {
          ...partnerClip,
          start: nextPartnerStart,
        });
      } else {
        const cutTime = timelineEngine.snapToFrame(baseClip.start);
        const minBaseStart = timelineEngine.snapToFrame(Math.max(0, partnerClip.start + frameTime));
        const nextBaseStart = timelineEngine.snapToFrame(
          Math.max(minBaseStart, cutTime - appliedDuration)
        );
        appliedDuration = timelineEngine.snapToFrame(Math.max(frameTime, cutTime - nextBaseStart));
        transitionTime = cutTime;
        nextClipMap.set(baseClip.id, {
          ...baseClip,
          start: nextBaseStart,
        });
      }

      const baseAfterTiming = nextClipMap.get(baseClip.id) || baseClip;
      const partnerAfterTiming = nextClipMap.get(partnerClip.id) || partnerClip;
      const nextBaseClip = updateTransitionMetadata(baseAfterTiming, edge, partnerClip.id);
      const oppositeEdge: 'in' | 'out' = edge === 'out' ? 'in' : 'out';
      const nextPartnerClip = updateTransitionMetadata(partnerAfterTiming, oppositeEdge, baseClip.id);
      nextClipMap.set(baseClip.id, nextBaseClip);
      nextClipMap.set(partnerClip.id, nextPartnerClip);
    } else {
      const nextBaseClip = updateTransitionMetadata(baseClip, edge, null);
      nextClipMap.set(baseClip.id, nextBaseClip);
    }

    const transitionPayload: TimelineTransition = {
      id: `tr-${baseClip.id}-${edge}-${Date.now()}`,
      time: transitionTime,
      trackId: baseClip.trackId,
      type: transitionType,
      duration: appliedDuration,
      clipId: baseClip.id,
      linkedClipId: partnerClip?.id,
      edge,
      layer: resolvedLayer,
      engine: transitionEngine,
    };

    const nextTransitions = [
      ...transitions.filter((transition) => {
        const transitionLayer = transition.layer ?? (isAudioTrackId(transition.trackId) ? 'audio' : 'video');
        const transitionEdge = transition.edge ?? 'out';
        return !(
          transition.trackId === baseClip.trackId &&
          transitionLayer === resolvedLayer &&
          transitionEdge === edge &&
          transition.clipId === baseClip.id
        );
      }),
      transitionPayload,
    ];

    const transitionSelection = new Set<string>([
      baseClip.id,
      ...(partnerClip ? [partnerClip.id] : []),
    ]);
    setTransitions(nextTransitions);
    applyClipUpdates(Array.from(nextClipMap.values()), transitionSelection, nextTransitions);
    setMarkers((previous) => [
      ...previous,
      {
        id: `tr-marker-${baseClip.id}-${edge}-${Date.now()}`,
        time: transitionTime,
        color: resolvedLayer === 'audio' ? '#f59e0b' : '#0ea5e9',
        label: `${resolvedLayer === 'audio' ? 'Audio' : 'Video'} ${transitionType} (${edge})`,
      },
    ]);

    return {
      time: transitionTime,
      layer: resolvedLayer,
      transitionType,
      duration: appliedDuration,
    };
  }, [
    clips,
    frameTime,
    isAudioTrackId,
    pendingTransitionEngine,
    transitions,
    applyClipUpdates,
  ]);

  const placePendingTransitionAtNearestCut = useCallback(() => {
    if (!pendingTransitionType) {
      return;
    }
    const preferredTrackId = selectedPrimaryClip?.trackId;
    const { time: placeTime, trackId } = findNearestCut(clips, tracks, currentTime, preferredTrackId);
    const transitionLayer: 'audio' | 'video' = isAudioTrackId(trackId) ? 'audio' : 'video';
    const transitionEngine: 'canvas2d' | 'webgl' | 'audio' =
      transitionLayer === 'audio' ? 'audio' : pendingTransitionEngine;

    const trackClips = clips
      .filter((entry) => entry.trackId === trackId)
      .sort((left, right) => left.start - right.start);
    let anchorClip: BeatClip | null = null;
    let anchorEdge: 'in' | 'out' = 'out';
    let nearestCutDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < trackClips.length - 1; index += 1) {
      const left = trackClips[index];
      const cutTime = left.start + left.duration;
      const cutDistance = Math.abs(cutTime - placeTime);
      if (cutDistance < nearestCutDistance) {
        nearestCutDistance = cutDistance;
        anchorClip = left;
        anchorEdge = 'out';
      }
    }
    if (!anchorClip) {
      const nearestClip = trackClips
        .slice()
        .sort((left, right) =>
          Math.abs((left.start + left.duration / 2) - placeTime) - Math.abs((right.start + right.duration / 2) - placeTime)
        )[0] || null;
      if (nearestClip) {
        const midpoint = nearestClip.start + nearestClip.duration / 2;
        anchorClip = nearestClip;
        anchorEdge = placeTime < midpoint ? 'in' : 'out';
      }
    }

    if (!anchorClip) {
      setSnackbar({
        open: true,
        message: 'No clip found on track for transition placement.',
        severity: 'warning',
      });
      setPendingTransitionType(null);
      return;
    }

    const result = addTransitionToClipEdge(anchorClip, anchorEdge, {
      type: pendingTransitionType,
      duration: pendingTransitionDuration,
      layer: transitionLayer,
      engine: transitionEngine,
    });
    setSnackbar({
      open: true,
      message: `Placed ${result.layer} ${result.transitionType} (${result.duration.toFixed(2)}s)`,
      severity: 'success',
    });
    setPendingTransitionType(null);
  }, [
    pendingTransitionType,
    pendingTransitionDuration,
    pendingTransitionEngine,
    selectedPrimaryClip?.trackId,
    clips,
    tracks,
    currentTime,
    isAudioTrackId,
    frameTime,
    addTransitionToClipEdge,
  ]);

  const placePendingTransitionOnSelectedClip = useCallback((edge: 'in' | 'out' = 'out') => {
    if (!pendingTransitionType || !selectedPrimaryClip) {
      return;
    }
    const transitionLayer: 'audio' | 'video' =
      isAudioTrackId(selectedPrimaryClip.trackId) ? 'audio' : 'video';
    const transitionEngine: 'canvas2d' | 'webgl' | 'audio' =
      transitionLayer === 'audio' ? 'audio' : pendingTransitionEngine;
    const result = addTransitionToClipEdge(selectedPrimaryClip, edge, {
      type: pendingTransitionType,
      duration: pendingTransitionDuration,
      layer: transitionLayer,
      engine: transitionEngine,
    });
    setSnackbar({
      open: true,
      message: `Applied ${result.layer} ${result.transitionType} on selected clip (${edge}, ${result.duration.toFixed(2)}s).`,
      severity: 'success',
    });
    setPendingTransitionType(null);
  }, [
    pendingTransitionType,
    pendingTransitionDuration,
    pendingTransitionEngine,
    selectedPrimaryClip,
    isAudioTrackId,
    addTransitionToClipEdge,
  ]);

  const toggleAssetPanel = useCallback(() => {
    setShowAssetPanel((previous) => !previous);
  }, []);

  const toggleInspectorPanel = useCallback(() => {
    setShowInspectorPanel((previous) => !previous);
  }, []);

  const toggleEffectsPanel = useCallback(() => {
    setShowEffectsPanel((previous) => !previous);
  }, []);

  const toggleMixerPanel = useCallback(() => {
    setShowMixerPanel((previous) => !previous);
  }, []);

  const toggleProgramMonitorPanel = useCallback(() => {
    setShowProgramMonitor((previous) => !previous);
  }, []);

  const toggleAutoMonitorPanel = useCallback(() => {
    setShowAutoMonitor((previous) => !previous);
  }, []);

  const setMonitorFitToFit = useCallback(() => {
    setMonitorFitMode('fit');
  }, []);

  const setMonitorFitToFill = useCallback(() => {
    setMonitorFitMode('fill');
  }, []);

  const toggleMulticamMode = useCallback(() => {
    setMulticamEnabled((previous) => !previous);
  }, []);

  const toggleCompositionGuidesVisibility = useCallback(() => {
    setShowCompositionGuides((previous) => !previous);
  }, []);

  const openCompositionGuideSettingsDialog = useCallback(() => {
    setShowCompositionGuideDialog(true);
  }, []);

  const closeCompositionGuideSettingsDialog = useCallback(() => {
    setShowCompositionGuideDialog(false);
  }, []);

  const closeSnackbar = useCallback(() => {
    setSnackbar((previous) => ({ ...previous, open: false }));
  }, []);

  const openAIAudioMixAssistant = useCallback(() => {
    const audioClips = clips.filter(
      (clip) => clip.trackId?.startsWith('A') || clip.trackId?.startsWith('audio')
    );
    if (audioClips.length === 0) {
      setSnackbar({
        open: true,
        message: 'Ingen lydspor funnet i tidslinjen',
        severity: 'warning',
      });
      return;
    }
    setSelectedAudioTrackId(null);
    setOpenMixerDirectly(false);
    setShowAIAudioAssistant(true);
  }, [clips]);

  const resolveSceneDetectionVideoPath = useCallback(() => {
    const firstTimelineVideoClip = clips.find((clip) => isRenderableVideoClip(clip));
    const sourceCandidates = [
      firstTimelineVideoClip?.sourceFile,
      sourcePreviewClip?.sourceFile,
      programMonitorClip?.sourceFile,
      activeSourcePreview?.sourceFile,
      availableVideoSources[0],
    ]
      .map((candidate) => (typeof candidate === 'string' ? candidate.trim() : ''))
      .filter(Boolean);

    const directCandidate = sourceCandidates.find(
      (candidate) =>
        isLikelyDirectMediaSource(candidate) &&
        !candidate.startsWith('blob:') &&
        !candidate.startsWith('data:')
    );
    return directCandidate || '';
  }, [
    clips,
    isRenderableVideoClip,
    sourcePreviewClip?.sourceFile,
    programMonitorClip?.sourceFile,
    activeSourcePreview?.sourceFile,
    availableVideoSources,
    isLikelyDirectMediaSource,
  ]);

  const closeSceneDetectionDialog = useCallback(() => {
    if (sceneDetectionJobId) {
      void apiRequest(`/api/video-analysis/scene-detection/${sceneDetectionJobId}/cancel`, {
        method: 'POST',
      }).catch(() => undefined);
    }
    cancelManagedJob('scene');
    clearPersistedServerJob('scene');
    clearSceneDetectionPollInterval();
    setSceneDetectionJobId(null);
    setShowSceneDetectionDialog(false);
  }, [
    sceneDetectionJobId,
    cancelManagedJob,
    clearPersistedServerJob,
    clearSceneDetectionPollInterval,
  ]);

  const jumpToSceneStart = useCallback((startTime: number) => {
    setCurrentTime(Math.max(0, timelineEngine.snapToFrame(startTime)));
  }, []);

  const pollSceneDetectionJob = useCallback(
    async (jobId: string) => {
      setSceneDetectionJobId(jobId);
      const completedStatus = await startPollingJob<
        StoryArcSceneDetectionProgress,
        StoryArcSceneDetectionProgress
      >({
        kind: 'scene',
        serverJobId: jobId,
        intervalMs: 2000,
        maxConsecutivePollErrors: 4,
        maxRetries: 1,
        retryDelayMs: 2000,
        onCancel: () => {
          void apiRequest(`/api/video-analysis/scene-detection/${jobId}/cancel`, {
            method: 'POST',
          }).catch(() => undefined);
        },
        onProgress: (progress) => {
          if (progress) {
            setSceneDetectionProgress(progress);
          }
        },
        poll: async (serverJobId) => {
          const statusResponse = (await apiRequest(
            `/api/video-analysis/scene-detection/${serverJobId}`
          )) as unknown;
          const normalizedStatus = normalizeSceneDetectionProgress(statusResponse);
          if (normalizedStatus.status === 'completed') {
            return {
              state: 'completed',
              result: normalizedStatus,
            };
          }
          if (normalizedStatus.status === 'failed') {
            return {
              state: 'failed',
              error: normalizedStatus.error || 'Unknown error',
            };
          }
          if (normalizedStatus.status === 'cancelled') {
            return {
              state: 'failed',
              error: normalizedStatus.error || 'Cancelled by user',
            };
          }
          return {
            state: 'running',
            progress: normalizedStatus,
          };
        },
      });

      const scenes = completedStatus.scenes || [];
      setSceneDetectionProgress(completedStatus);
      const markerSeed = Date.now();
      const newMarkers = scenes.map((scene, index) => ({
        id: `scene-${jobId}-${markerSeed}-${index}`,
        time: scene.start_time,
        color: '#667eea',
        label: `Scene ${scene.scene_number}`,
      }));
      if (newMarkers.length > 0) {
        setMarkers((previous) => [...previous, ...newMarkers]);
      }
      setSnackbar({
        open: true,
        message: `Detected ${scenes.length} scenes and added markers to timeline`,
        severity: 'success',
      });
    },
    [startPollingJob]
  );

  const runSceneDetection = useCallback(async () => {
    const videoPath = resolveSceneDetectionVideoPath();
    if (!videoPath) {
      setSnackbar({
        open: true,
        message: 'No direct video source found for scene detection',
        severity: 'warning',
      });
      return;
    }

    try {
      clearSceneDetectionPollInterval();
      setSceneDetectionJobId(null);
      setSceneDetectionProgress({
        status: 'processing',
        progress: 0,
        message: 'Starting scene detection...',
      });
      setShowSceneDetectionDialog(true);

      let startedJobId: string | null = null;
      const jobId = await runManagedJob<string>({
        kind: 'scene',
        maxRetries: 1,
        retryDelayMs: 1200,
        onCancel: () => {
          if (!startedJobId) {
            return;
          }
          void apiRequest(`/api/video-analysis/scene-detection/${startedJobId}/cancel`, {
            method: 'POST',
          }).catch(() => undefined);
        },
        task: async () => {
          const response = await apiRequest('/api/video-analysis/scene-detection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              video_path: videoPath,
              threshold: 30.0,
              min_scene_len: 15,
            }),
          });

          const startPayload = response as unknown;
          if (!isRecord(startPayload)) {
            throw new Error('Unable to start scene detection');
          }
          const jobIdRaw = startPayload.job_id;
          if (
            startPayload.success !== true ||
            (typeof jobIdRaw !== 'string' && typeof jobIdRaw !== 'number')
          ) {
            throw new Error(
              typeof startPayload.error === 'string'
                ? startPayload.error
                : 'Unable to start scene detection'
            );
          }

          startedJobId = String(jobIdRaw);
          return startedJobId;
        },
      });

      await pollSceneDetectionJob(jobId);
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        setSnackbar({
          open: true,
          message: 'Scene detection cancelled',
          severity: 'info',
        });
        return;
      }
      const message = toErrorMessage(error, 'Unknown error');
      clearSceneDetectionPollInterval();
      setSceneDetectionProgress({
        status: 'failed',
        progress: 0,
        error: message,
      });
      setSnackbar({
        open: true,
        message: `Scene detection error: ${message}`,
        severity: 'error',
      });
    }
  }, [
    resolveSceneDetectionVideoPath,
    clearSceneDetectionPollInterval,
    runManagedJob,
    pollSceneDetectionJob,
  ]);

  const { handleFaceDetectionToggle } = useStoryArcFaceDetectionFlow({
    faceDetectionRunning,
    clips,
    tracks,
    totalDuration,
    hydrateClipSources,
    extractRenderableVideoSources,
    groupFaceDetectionsIntoSegments,
    setFaceDetectionRunning,
    setShowFaceDetectionDialog,
    setFaceDetectionProgress,
    setFaceDetectionOptions,
    setShowFaceDetectionOptionsDialog,
    setPendingFaceDetectionResolve,
    setClipMeta,
    setClips,
    setMarkers,
    setPendingSubclipsResolve,
    setSubclipsConfirmData,
    setShowSubclipsConfirmDialog,
    setAvailableVideoSources,
    setTotalDuration,
    setSnackbar,
    runManagedJob,
    cancelManagedJob,
  });

  const closeRatingDialog = useCallback(() => {
    clearAiRatingRevealTimeout();
    setShowRatingDialog(false);
    setAIGeneratedTimelineData(null);
  }, [clearAiRatingRevealTimeout]);

  const dismissOnboardingDialog = useCallback(() => {
    clearWorkerInitTimeouts();
    setOnboardingOpen(false);
  }, [clearWorkerInitTimeouts]);

  const closeOnboardingDialog = useCallback(() => {
    setSafeLocalStorageItem(ONBOARDING_COMPLETED_STORAGE_KEY, 'true');
    clearWorkerInitTimeouts();
    setOnboardingOpen(false);
  }, [clearWorkerInitTimeouts]);

  const cancelFaceDetectionOptionsDialog = useCallback(() => {
    setShowFaceDetectionOptionsDialog(false);
    if (pendingFaceDetectionResolve) {
      pendingFaceDetectionResolve(null);
      setPendingFaceDetectionResolve(null);
    }
  }, [pendingFaceDetectionResolve]);

  const confirmFaceDetectionOptionsDialog = useCallback(() => {
    setShowFaceDetectionOptionsDialog(false);
    if (pendingFaceDetectionResolve) {
      pendingFaceDetectionResolve(faceDetectionOptions);
      setPendingFaceDetectionResolve(null);
    }
  }, [pendingFaceDetectionResolve, faceDetectionOptions]);

  const rejectSubclipsCreation = useCallback(() => {
    setShowSubclipsConfirmDialog(false);
    if (pendingSubclipsResolve) {
      pendingSubclipsResolve(false);
      setPendingSubclipsResolve(null);
    }
  }, [pendingSubclipsResolve]);

  const acceptSubclipsCreation = useCallback(() => {
    setShowSubclipsConfirmDialog(false);
    if (pendingSubclipsResolve) {
      pendingSubclipsResolve(true);
      setPendingSubclipsResolve(null);
    }
  }, [pendingSubclipsResolve]);

  const zoomOutTimeline = useCallback(() => {
    adjustTimelineZoom(-0.1);
  }, [adjustTimelineZoom]);

  const zoomInTimeline = useCallback(() => {
    adjustTimelineZoom(0.1);
  }, [adjustTimelineZoom]);

  const loadDockSlot1 = useCallback(() => {
    loadDockSlot('dock-1');
  }, [loadDockSlot]);

  const loadDockSlot2 = useCallback(() => {
    loadDockSlot('dock-2');
  }, [loadDockSlot]);

  const loadDockSlot3 = useCallback(() => {
    loadDockSlot('dock-3');
  }, [loadDockSlot]);

  const saveDockSlot1 = useCallback(() => {
    saveDockSlot('dock-1');
  }, [saveDockSlot]);

  const saveDockSlot2 = useCallback(() => {
    saveDockSlot('dock-2');
  }, [saveDockSlot]);

  const saveDockSlot3 = useCallback(() => {
    saveDockSlot('dock-3');
  }, [saveDockSlot]);

  const closeSyncDialog = useCallback(() => {
    if (syncJobId) {
      void apiRequest(`/api/video-sync/jobs/${syncJobId}/cancel`, {
        method: 'POST',
      }).catch(() => undefined);
    }
    cancelManagedJob('sync');
    clearPersistedServerJob('sync');
    setShowSyncDialog(false);
    setSelectedSyncClips(new Set());
    setSyncInProgress(false);
    setSyncResults(null);
    setManualOffsets({});
    setSyncPreviewMode(false);
    setSyncJobId(null);
  }, [syncJobId, cancelManagedJob, clearPersistedServerJob]);

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

      const clip = clipMap.get(clipId);
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
    clipMap,
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

  const pollSyncServerJob = useCallback(
    async (jobId: string) => {
      setSyncJobId(jobId);
      const serverOffsets = await startPollingJob<undefined, Record<string, EngineAudioSyncResult>>({
        kind: 'sync',
        serverJobId: jobId,
        intervalMs: 2000,
        maxConsecutivePollErrors: 4,
        maxRetries: 1,
        retryDelayMs: 2000,
        onCancel: () => {
          void apiRequest(`/api/video-sync/jobs/${jobId}/cancel`, {
            method: 'POST',
          }).catch(() => undefined);
        },
        poll: async (serverJobId) => {
          const jobStatus = await apiRequest(`/api/video-sync/jobs/${serverJobId}`);
          if (jobStatus.job?.status === 'completed' && jobStatus.job.sync_results?.offsets) {
            return {
              state: 'completed',
              result: jobStatus.job.sync_results.offsets as Record<string, EngineAudioSyncResult>,
            };
          }
          if (jobStatus.job?.status === 'error') {
            return {
              state: 'failed',
              error: jobStatus.job.error || 'Server sync failed',
            };
          }
          if (jobStatus.job?.status === 'cancelled') {
            return {
              state: 'failed',
              error: jobStatus.job.error || 'Cancelled by user',
            };
          }
          return { state: 'running' };
        },
      });

      const initialManualOffsets: Record<string, number> = {};
      Object.entries(serverOffsets).forEach(([clipId, result]) => {
        initialManualOffsets[clipId] = result.offset_seconds || 0;
      });
      setSyncResults(serverOffsets);
      setManualOffsets(initialManualOffsets);
      setSyncPreviewMode(true);
      setSnackbar({
        open: true,
        message: 'Server sync completed',
        severity: 'success',
      });
    },
    [startPollingJob]
  );

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

    try {
      if (syncUseServerFirst) {
        try {
          const clipData = selected.map((clip) => ({
            id: clip.id,
            path: clip.sourceFile || '',
            type: clip.trackId?.includes('audio') ? 'audio' : 'video',
            camera: clipMeta[clip.id]?.camera || clip.metadata?.camera,
            syncGroup: clipMeta[clip.id]?.syncGroup || clip.metadata?.syncGroup,
          }));

          let startedSyncJobId: string | null = null;
          const jobId = await runManagedJob<string>({
            kind: 'sync',
            maxRetries: 1,
            retryDelayMs: 1000,
            onCancel: () => {
              if (!startedSyncJobId) {
                return;
              }
              void apiRequest(`/api/video-sync/jobs/${startedSyncJobId}/cancel`, {
                method: 'POST',
              }).catch(() => undefined);
            },
            task: async () => {
              const jobResponse = await apiRequest('/api/video-sync/sync-clips', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  storyArcId: storyArcId || storyArc?.id,
                  clipIds: Array.from(selectedSyncClips),
                  referenceClipId: referenceClip.id,
                }),
              });

              if (!jobResponse?.success || typeof jobResponse.jobId !== 'string') {
                throw new Error(
                  typeof jobResponse?.error === 'string'
                    ? jobResponse.error
                    : 'Unable to start server sync'
                );
              }

              await apiRequest('/api/video-sync/submit-clips', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  jobId: jobResponse.jobId,
                  clips: clipData,
                }),
              });

              startedSyncJobId = jobResponse.jobId;
              return jobResponse.jobId;
            },
          });

          await pollSyncServerJob(jobId);
          return;
        } catch (serverError) {
          if (serverError instanceof Error && serverError.name === 'AbortError') {
            setSnackbar({
              open: true,
              message: 'Sync cancelled',
              severity: 'info',
            });
            return;
          }
          clearPersistedServerJob('sync');
          console.warn('Server sync unavailable, using local sync:', serverError);
        }
      }

      const localOffsets = await runManagedJob<Record<string, EngineAudioSyncResult>>({
        kind: 'sync',
        maxRetries: 0,
        task: async () => runLocalSync(selected, referenceClip),
      });
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
    runManagedJob,
    pollSyncServerJob,
    clearPersistedServerJob,
  ]);

  useEffect(() => {
    if (resumedPersistedJobsRef.current) {
      return;
    }
    resumedPersistedJobsRef.current = true;

    const persistedSceneJob = getPersistedServerJob('scene');
    if (persistedSceneJob) {
      setShowSceneDetectionDialog(true);
      setSceneDetectionJobId(persistedSceneJob.serverJobId);
      setSceneDetectionProgress({
        status: 'processing',
        progress: 0,
        message: `Resuming scene detection job ${persistedSceneJob.serverJobId}`,
      });
      void pollSceneDetectionJob(persistedSceneJob.serverJobId).catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        const message = toErrorMessage(error, 'Unknown error');
        clearPersistedServerJob('scene');
        setSceneDetectionProgress({
          status: 'failed',
          progress: 0,
          error: message,
        });
        setSnackbar({
          open: true,
          message: `Scene detection resume failed: ${message}`,
          severity: 'error',
        });
      });
    }

    const persistedSyncJob = getPersistedServerJob('sync');
    if (persistedSyncJob) {
      setSyncInProgress(true);
      setSyncJobId(persistedSyncJob.serverJobId);
      void pollSyncServerJob(persistedSyncJob.serverJobId)
        .catch((error: unknown) => {
          if (error instanceof Error && error.name === 'AbortError') {
            return;
          }
          const message = toErrorMessage(error, 'Unknown error');
          clearPersistedServerJob('sync');
          setSnackbar({
            open: true,
            message: `Sync resume failed: ${message}`,
            severity: 'error',
          });
        })
        .finally(() => {
          setSyncInProgress(false);
        });
    }

    const persistedAutoEditJob = getPersistedServerJob('autoEdit');
    if (persistedAutoEditJob) {
      setAutoEditRunning(true);
      setAutoEditJobId(persistedAutoEditJob.serverJobId);
      setAutoEditServerProgress(0);
      const snapshot = createAutoEditSnapshot();
      void pollAutoEditServerJob(persistedAutoEditJob.serverJobId)
        .then((serverRanking) => {
          const contextualClips = buildContextualAutoEditClips(clips);
          const feedbackByClipId: Record<string, AutoEditFeedbackValue> = {};
          contextualClips.forEach((clip) => {
            const feedback = autoEditFeedbackByClipKey[buildAutoEditClipFeedbackKey(clip)];
            if (feedback === 'approved' || feedback === 'rejected') {
              feedbackByClipId[clip.id] = feedback;
            }
          });
          const alternativesResult = createAutoEditAlternatives(
            {
              clips: contextualClips,
              tracks,
              transitions: transitions.map((transition) => ({ ...transition })),
              markers: markers.map((marker) => ({ ...marker })),
              frameRate,
              humanFeedbackByClipId: feedbackByClipId,
              serverRanking: {
                clipScores: serverRanking.clipScores,
                rankedClipIds: serverRanking.rankedClipIds,
                clipSignalsById: serverRanking.clipSignalsById,
                beatByClipId: serverRanking.beatByClipId,
                confidence: serverRanking.confidence,
                summary: serverRanking.summary,
                modelUsed: serverRanking.modelUsed,
                analyzerAvailable: serverRanking.analyzerAvailable,
                llmBeatClassificationUsed: serverRanking.llmBeatClassificationUsed,
              },
            },
            autoEditOptions
          );
          const initialVariant = autoEditOptions.variant || alternativesResult.defaultVariant;
          const proposal =
            alternativesResult.alternatives[initialVariant] ||
            alternativesResult.alternatives.balanced;
          applyAutoEditProposalPreview(snapshot, proposal, 'resume', alternativesResult.alternatives);
        })
        .catch((error: unknown) => {
          if (error instanceof Error && error.name === 'AbortError') {
            return;
          }
          const message = toErrorMessage(error, 'Unknown error');
          clearPersistedServerJob('autoEdit');
          setSnackbar({
            open: true,
            message: `Auto Edit resume failed: ${message}`,
            severity: 'error',
          });
        })
        .finally(() => {
          setAutoEditRunning(false);
          setAutoEditJobId(null);
          setAutoEditServerProgress(null);
        });
    }
  }, [
    getPersistedServerJob,
    pollSceneDetectionJob,
    pollSyncServerJob,
    clearPersistedServerJob,
    pollAutoEditServerJob,
    createAutoEditSnapshot,
    buildContextualAutoEditClips,
    clips,
    tracks,
    transitions,
    markers,
    frameRate,
    autoEditOptions,
    applyAutoEditProposalPreview,
    autoEditFeedbackByClipKey,
  ]);

  useEffect(() => {
    if (autoEditPreviewRestoredRef.current) {
      return;
    }
    autoEditPreviewRestoredRef.current = true;
    const persistedPayload = getSafeLocalStorageJson<{
      projectKey?: string;
      previewState?: AutoEditPreviewState;
      persistedAt?: number;
    } | null>(AUTO_EDIT_PENDING_PREVIEW_STORAGE_KEY, null);
    if (!persistedPayload || persistedPayload.projectKey !== autoEditProjectKey) {
      return;
    }
    if (
      typeof persistedPayload.persistedAt === 'number' &&
      Date.now() - persistedPayload.persistedAt > 1000 * 60 * 60 * 24
    ) {
      clearPersistedAutoEditPreview();
      return;
    }
    const previewState = persistedPayload.previewState;
    if (!previewState || !previewState.proposal || !previewState.snapshot) {
      return;
    }
    const alternatives =
      previewState.alternatives ||
      ({
        safe: previewState.proposal,
        balanced: previewState.proposal,
        bold: previewState.proposal,
      } as Record<AutoEditVariant, AutoEditProposal>);
    const selectedVariant = previewState.selectedVariant || previewState.proposal.variant || 'balanced';
    const proposal = alternatives[selectedVariant] || previewState.proposal;
    const nextTransitions = proposal.transitions.map((transition) => ({ ...transition }));
    const nextMarkers = proposal.markers.map((marker) => ({ ...marker }));
    const selectedIds =
      proposal.selectedClipIds.length > 0
        ? new Set(proposal.selectedClipIds)
        : new Set(proposal.clips.slice(0, 1).map((clip) => clip.id));
    setTransitions(nextTransitions);
    setMarkers(nextMarkers);
    applyClipUpdates(cloneClipList(proposal.clips), selectedIds, nextTransitions);
    const hydratedPreview: AutoEditPreviewState = {
      ...previewState,
      alternatives,
      selectedVariant,
      proposal,
    };
    setAutoEditPreview(hydratedPreview);
    setLastAutoEditSnapshot(hydratedPreview);
    setSnackbar({
      open: true,
      message: 'Restored pending Auto Edit preview after refresh.',
      severity: 'info',
    });
  }, [applyClipUpdates, autoEditProjectKey, clearPersistedAutoEditPreview, cloneClipList]);

  const runSync = useCallback(() => {
    void executeSyncClips();
  }, [executeSyncClips]);

  const applySync = useCallback(() => {
    void applySyncToTimeline();
  }, [applySyncToTimeline]);

  const handleSearchQueryChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  }, []);

  const handleFilterTagsBlur = useCallback((event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const nextTags = event.target.value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    setFilterTags(nextTags);
  }, []);

  const handleTrackHeightScaleChange = useCallback((_: Event, value: number | number[]) => {
    const numericValue = Array.isArray(value) ? value[0] : value;
    setTrackHeightScale(numericValue);
  }, []);

  const handleWorkflowStepButtonClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    const step = event.currentTarget.dataset.workflowStep as ResolveWorkflowStep | undefined;
    if (!step) {
      return;
    }
    applyWorkflowStep(step);
  }, [applyWorkflowStep]);

  const handleSourcePatchVideoTrackChange = useCallback((event: SelectChangeEvent<string>) => {
    setSourcePatchVideoTrackId(event.target.value || null);
  }, []);

  const handleSourcePatchAudioTrackChange = useCallback((event: SelectChangeEvent<string>) => {
    setSourcePatchAudioTrackId(event.target.value || null);
  }, []);

  const handleSourcePatchIncludeAudioChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSourcePatchIncludeAudio(event.target.checked);
  }, []);

  const handleMulticamApplyToTimelineChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setMulticamApplyToTimeline(event.target.checked);
  }, []);

  const handleApplyMulticamAngleClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    const clipId = event.currentTarget.dataset.candidateClipId;
    if (!clipId) {
      return;
    }
    const candidate = multicamAngleCandidates.find((item) => item.clip.id === clipId);
    if (!candidate) {
      return;
    }
    applyMulticamAngle(candidate);
  }, [multicamAngleCandidates, applyMulticamAngle]);

  const handleAudioRoleFocusChange = useCallback((event: SelectChangeEvent<string>) => {
    setAudioRoleFocus(event.target.value as AudioRoleFilter);
  }, []);

  const handleAudioRoleChipFocusClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const role = event.currentTarget.dataset.audioRole as AudioTrackRole | undefined;
    if (!role) {
      return;
    }
    setAudioRoleFocus((previous) => (previous === role ? 'all' : role));
  }, []);

  const handleAudioRoleMuteChipClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const role = event.currentTarget.dataset.audioRole as AudioTrackRole | undefined;
    if (!role) {
      return;
    }
    toggleAudioRoleMute(role);
  }, [toggleAudioRoleMute]);

  const handleAudioRoleSoloChipClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const role = event.currentTarget.dataset.audioRole as AudioTrackRole | undefined;
    if (!role) {
      return;
    }
    toggleAudioRoleSolo(role);
  }, [toggleAudioRoleSolo]);

  const handleOpenMixerTrackButtonClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    const trackId = event.currentTarget.dataset.trackId;
    if (!trackId) {
      return;
    }
    handleOpenMixer(trackId);
  }, [handleOpenMixer]);

  const handleOpenAIAssistantTrackButtonClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    const trackId = event.currentTarget.dataset.trackId;
    if (!trackId) {
      return;
    }
    handleOpenAIAssistant(trackId);
  }, [handleOpenAIAssistant]);

  const handleMixerTrackVolumeChange = useCallback((event: Event, value: number | number[]) => {
    const trackId = (event.currentTarget as HTMLElement | null)?.dataset.trackId;
    if (!trackId) {
      return;
    }
    const volume = typeof value === 'number' ? value : value[0];
    setClips((previous) =>
      previous.map((clip) =>
        clip.trackId === trackId
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
  }, []);

  const handleWorkspaceNavClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    const preset = event.currentTarget.dataset.workspacePreset as ResolveWorkspacePreset | undefined;
    if (!preset) {
      return;
    }
    activateWorkspaceFromNav(preset);
  }, [activateWorkspaceFromNav]);

  const handleFaceDetectionScanEntireChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setFaceDetectionOptions((previous) => ({
      ...previous,
      scanEntire: event.target.checked,
    }));
  }, []);

  const handleFaceDetectionFpsChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setFaceDetectionOptions((previous) => ({
      ...previous,
      fps: parseFloat(event.target.value) || 0.5,
    }));
  }, []);

  const handleFaceDetectionTaskChoiceChange = useCallback((event: SelectChangeEvent<string>) => {
    setFaceDetectionOptions((previous) => ({
      ...previous,
      taskChoice: event.target.value,
    }));
  }, []);

  const handleDriveUploadsEnabledChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setDriveUploadsEnabled(event.target.checked);
  }, []);

  const handleDrivePrimaryEnabledChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setDrivePrimaryEnabled(event.target.checked);
  }, []);

  const handleDrivePrimaryIntervalChange = useCallback((event: SelectChangeEvent<number>) => {
    setDrivePrimaryIntervalMs(Number(event.target.value));
  }, []);

  const handleDrivePrimaryFolderNameChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setDrivePrimaryFolderName(event.target.value);
  }, []);

  const handleDrivePrimaryFilenameTemplateChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setDrivePrimaryFilenameTemplate(event.target.value);
  }, []);

  const handleDriveBackupEnabledChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setDriveBackupEnabled(event.target.checked);
  }, []);

  const handleDriveBackupIntervalChange = useCallback((event: SelectChangeEvent<number>) => {
    setDriveBackupIntervalMs(Number(event.target.value));
  }, []);

  const handleDriveBackupFolderNameChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setDriveBackupFolderName(event.target.value);
  }, []);

  const handleDriveBackupFilenameTemplateChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setDriveBackupFilenameTemplate(event.target.value);
  }, []);

  const handleSyncTryReallyHardChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSyncTryReallyHard(event.target.checked);
  }, []);

  const handleSyncPreferTimecodeChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSyncPreferTimecode(event.target.checked);
  }, []);

  const handleSyncEnableDriftCorrectionChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSyncEnableDriftCorrection(event.target.checked);
  }, []);

  const handleSyncAllowClipReorderChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSyncAllowClipReorder(event.target.checked);
  }, []);

  const handleSyncUseServerFirstChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSyncUseServerFirst(event.target.checked);
  }, []);

  const handleToggleSyncClipSelectionClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const clipId = event.currentTarget.dataset.clipId;
    if (!clipId) {
      return;
    }
    toggleSyncClipSelection(clipId);
  }, [toggleSyncClipSelection]);

  const handleResetManualOffsetClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    const clipId = event.currentTarget.dataset.clipId;
    const offset = event.currentTarget.dataset.detectedOffset;
    if (!clipId || offset === undefined) {
      return;
    }
    const detectedOffset = Number(offset);
    if (!Number.isFinite(detectedOffset)) {
      return;
    }
    resetManualOffsetToDetected(clipId, detectedOffset);
  }, [resetManualOffsetToDetected]);

  const handleClearManualOffsetClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    const clipId = event.currentTarget.dataset.clipId;
    if (!clipId) {
      return;
    }
    clearManualOffsetForClip(clipId);
  }, [clearManualOffsetForClip]);

  const handleManualOffsetSliderChange = useCallback((event: Event, value: number | number[]) => {
    const clipId = (event.currentTarget as HTMLElement | null)?.dataset.clipId;
    if (!clipId) {
      return;
    }
    updateManualOffset(clipId, value);
  }, [updateManualOffset]);

  const handleSourceMonitorMouseDown = useCallback(() => {
    setActiveMonitor('source');
  }, []);

  const handleProgramMonitorMouseDown = useCallback(() => {
    setActiveMonitor('program');
  }, []);

  const handleConnectCurrentProjectClick = useCallback(() => {
    void connectCurrentProject();
  }, [connectCurrentProject]);

  const handleConnectRecentProjectClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const projectId = event.currentTarget.dataset.projectId;
    if (!projectId) {
      return;
    }
    const project = recentProjects.find((item) => item.id === projectId);
    if (!project) {
      return;
    }
    void connectRecentProject(project);
  }, [recentProjects, connectRecentProject]);

  const handleShowCompositionGuidesChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setShowCompositionGuides(event.target.checked);
  }, []);

  const handleCompositionGuideTargetChange = useCallback((event: SelectChangeEvent<string>) => {
    setCompositionGuideTarget(event.target.value as CinematographyGuideTarget);
  }, []);

  const handleCompositionAspectMaskChange = useCallback((event: SelectChangeEvent<string>) => {
    setCompositionAspectMask(event.target.value as CinematographyAspectMask);
  }, []);

  const handleCompositionSpiralOrientationChange = useCallback((event: SelectChangeEvent<string>) => {
    setCompositionSpiralOrientation(event.target.value as CinematographySpiralOrientation);
  }, []);

  const handleCompositionGuideToggleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const guideKey = event.currentTarget.dataset.guideKey as keyof CinematographyGuideSet | undefined;
    if (!guideKey) {
      return;
    }
    updateCompositionGuide(guideKey, event.target.checked);
  }, [updateCompositionGuide]);

  const handleCompositionGuideColorChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setCompositionGuideColor(event.target.value);
  }, []);

  const handleCompositionGuideOpacityChange = useCallback((_: Event, value: number | number[]) => {
    setCompositionGuideOpacity(typeof value === 'number' ? value : value[0]);
  }, []);

  const handleCompositionGuideThicknessChange = useCallback((_: Event, value: number | number[]) => {
    setCompositionGuideThickness(typeof value === 'number' ? value : value[0]);
  }, []);

  const handleAutoMonitorStatusChange = useCallback((enabled: boolean) => {
    setAutoMonitorEnabled(enabled);
    setSnackbar({
      open: true,
      message: enabled ? 'Auto monitor enabled.' : 'Auto monitor disabled.',
      severity: 'info',
    });
  }, []);

  const handleAssetBrowserMediaSelect = useCallback((media: SelectedAssetMedia) => {
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
    setAvailableVideoSources((previous) =>
      previous.includes(mediaSource) ? previous : [...previous, mediaSource]
    );
  }, []);

  const handleAssetBrowserTimelineInit = useCallback(({
    storyArc: arc,
    clips: newClips,
    tracks: newTracks,
  }: {
    storyArc: StoryArc;
    clips: BeatClip[];
    tracks: Track[];
  }) => {
    if (fixtureTimelineLockRef.current) {
      return;
    }
    setStoryArc(arc);
    const hydratedTimelineClips = hydrateClipSources(newClips);
    setClips(hydratedTimelineClips);
    setAvailableVideoSources((previous) => {
      const merged = new Set([...previous, ...extractRenderableVideoSources(hydratedTimelineClips)]);
      return Array.from(merged);
    });
    setTracks(newTracks);
    const total = Math.max(
      ...hydratedTimelineClips.map((clip) => clip.start + clip.duration),
      arc.totalDuration || 0
    );
    setTotalDuration(total || 0);
    setSelectedClips(new Set());
    setCurrentTime(0);
  }, [hydrateClipSources, extractRenderableVideoSources]);

  const handleAssetBrowserTemplateSelect = useCallback((templateId: string) => {
    if (!templateId) {
      return;
    }
    setSnackbar({
      open: true,
      message: `Template selected: ${templateId}. Building timeline...`,
      severity: 'info',
    });
  }, []);

  const handleAssetBrowserSnippetDrag = useCallback((snippetId: string) => {
    if (!snippetId) {
      return;
    }
    setSnackbar({
      open: true,
      message: `Snippet ${snippetId} is ready. Use "Insert" to add it at playhead.`,
      severity: 'info',
    });
  }, []);

  const handleAssetBrowserSnippetInsert = useCallback((snippet: AssetBrowserSnippetDetail) => {
    const snippetDuration = timelineEngine.snapToFrame(
      Math.max(
        frameTime,
        Number.isFinite(snippet.duration) && snippet.duration > 0 ? snippet.duration : 2
      )
    );

    if (snippet.type === 'transition') {
      const preferredTrackId = selectedPrimaryClip?.trackId;
      const { time: placeTime, trackId } = findNearestCut(clips, tracks, currentTime, preferredTrackId);
      const transitionType = snippet.id.replace(/^transition[-_]?/i, '') || 'crossfade';
      const transitionLayer: 'audio' | 'video' = isAudioTrackId(trackId) ? 'audio' : 'video';
      const transitionEngine: 'canvas2d' | 'webgl' | 'audio' =
        transitionLayer === 'audio' ? 'audio' : 'canvas2d';
      const trackClips = clips
        .filter((entry) => entry.trackId === trackId)
        .sort((left, right) => left.start - right.start);
      const anchorClip = trackClips
        .slice()
        .sort((left, right) =>
          Math.abs((left.start + left.duration) - placeTime) - Math.abs((right.start + right.duration) - placeTime)
        )[0] || null;
      if (anchorClip) {
        addTransitionToClipEdge(anchorClip, 'out', {
          type: transitionType,
          duration: snippetDuration,
          layer: transitionLayer,
          engine: transitionEngine,
        });
      } else {
        setTransitions((previous) => [
          ...previous,
          {
            id: `snippet-transition-${Date.now()}`,
            time: placeTime,
            trackId,
            type: transitionType,
            duration: snippetDuration,
            layer: transitionLayer,
            engine: transitionEngine,
          },
        ]);
      }
      setSnackbar({
        open: true,
        message: `Inserted ${transitionLayer} transition snippet: ${snippet.name}`,
        severity: 'success',
      });
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

    const snippetColorByType: Record<AssetBrowserSnippetDetail['type'], string> = {
      transition: '#8b5cf6',
      opening: '#22c55e',
      closing: '#eab308',
      montage: '#0ea5e9',
      dialogue: '#f97316',
      action: '#ef4444',
    };
    const snippetClipId = `snippet-${snippet.id}-${Date.now()}`;
    const start = timelineEngine.snapToFrame(Math.max(0, currentTime));
    const newClip: BeatClip = {
      id: snippetClipId,
      name: snippet.name,
      beatName: snippet.name,
      start,
      duration: snippetDuration,
      ev: 0.15,
      synopsis: `Snippet: ${snippet.name}`,
      trackId: targetTrackId,
      color: snippetColorByType[snippet.type] || '#2196f3',
      metadata: {
        snippetId: snippet.id,
        snippetType: snippet.type,
        insertedAt: new Date().toISOString(),
      },
      tags: Array.from(new Set([...(snippet.tags || []), 'snippet', snippet.type])),
    };
    let next = [...clips, newClip];
    if (safeTrimMode && hasTimelineOverlapOnTrack(next, targetTrackId)) {
      showSafeTrimBlockedWarning();
      return;
    }
    if (magneticEnabled) {
      next = resolveOverlaps(next, targetTrackId);
    }
    applyClipUpdates(next, new Set([snippetClipId]));
    setMarkers((previous) => [
      ...previous,
      {
        id: `marker-${snippetClipId}`,
        time: start,
        color: snippetColorByType[snippet.type] || '#2196f3',
        label: `Snippet: ${snippet.name}`,
      },
    ]);
    setSnackbar({
      open: true,
      message: `Inserted snippet: ${snippet.name}`,
      severity: 'success',
    });
  }, [
    frameTime,
    selectedPrimaryClip?.trackId,
    findNearestCut,
    clips,
    tracks,
    currentTime,
    getPrimaryVideoTrackId,
    safeTrimMode,
    hasTimelineOverlapOnTrack,
    showSafeTrimBlockedWarning,
    magneticEnabled,
    resolveOverlaps,
    applyClipUpdates,
    isAudioTrackId,
    addTransitionToClipEdge,
  ]);

  const handleSourceMonitorFocus = useCallback(() => {
    setActiveMonitor('source');
  }, []);

  const handleProgramMonitorFocus = useCallback(() => {
    setActiveMonitor('program');
  }, []);

  const handleSourceVideoLoadedMetadata = useCallback((event: React.SyntheticEvent<HTMLVideoElement>) => {
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
  }, [sourcePreviewLocalTime]);

  const handleSourceVideoTimeUpdate = useCallback((event: React.SyntheticEvent<HTMLVideoElement>) => {
    setSourcePreviewTime(event.currentTarget.currentTime);
  }, []);

  const handleSourceVideoPlay = useCallback(() => {
    setSourcePreviewIsPlaying(true);
  }, []);

  const handleSourceVideoPause = useCallback(() => {
    setSourcePreviewIsPlaying(false);
  }, []);

  const handleSourceVideoError = useCallback(() => {
    setSourcePreviewReady(false);
    setSourcePreviewIsPlaying(false);
    setSourcePreviewError('Source preview failed to load');
  }, []);

  const handleProgramVideoLoadedMetadata = useCallback((event: React.SyntheticEvent<HTMLVideoElement>) => {
    setPreviewReady(true);
    setPreviewError(null);
    try {
      event.currentTarget.currentTime = programPreviewLocalTime;
    } catch {
      // Ignore initial seek errors until media is fully ready.
    }
  }, [programPreviewLocalTime]);

  const handleProgramVideoError = useCallback(() => {
    setPreviewReady(false);
    setPreviewError('Program preview failed to load');
  }, []);

  const handleTimelineClipSelect = useCallback((clipId: string, multiSelect = false) => {
    setSelectedClips((previous) => {
      if (multiSelect) {
        const next = new Set(previous);
        if (next.has(clipId)) {
          next.delete(clipId);
        } else {
          next.add(clipId);
        }
        return next;
      }
      return new Set([clipId]);
    });
  }, []);

  const handleTimelineClipMove = useCallback((clipId: string, newStart: number, newTrackId: string) => {
    const snappedStart = timelineEngine.snapToFrame(newStart);
    let next = moveClipWithEditTool(clips, clipId, snappedStart, newTrackId);
    if (safeTrimMode && hasTimelineOverlapOnTrack(next, newTrackId)) {
      showSafeTrimBlockedWarning();
      return;
    }
    if (magneticEnabled && editTool !== 'slip') {
      next = resolveOverlaps(next, newTrackId);
    }
    applyClipUpdates(next);
  }, [
    clips,
    safeTrimMode,
    hasTimelineOverlapOnTrack,
    showSafeTrimBlockedWarning,
    magneticEnabled,
    editTool,
    resolveOverlaps,
    applyClipUpdates,
    moveClipWithEditTool,
  ]);

  const handleTimelineClipResize = useCallback((
    clipId: string,
    newStart: number,
    newDuration: number,
    resizeMode: 'resize-left' | 'resize-right' = 'resize-right'
  ) => {
    const targetTrack = newTrackIdForClip(clips, clipId);
    let next = resizeClipWithEditTool(
      clips,
      clipId,
      newStart,
      newDuration,
      resizeMode === 'resize-left' ? 'resize-left' : 'resize-right'
    );
    if (safeTrimMode && targetTrack && hasTimelineOverlapOnTrack(next, targetTrack)) {
      showSafeTrimBlockedWarning();
      return;
    }
    if (magneticEnabled && targetTrack && editTool !== 'roll') {
      next = resolveOverlaps(next, targetTrack);
    }
    applyClipUpdates(next);
  }, [
    clips,
    newTrackIdForClip,
    resizeClipWithEditTool,
    safeTrimMode,
    hasTimelineOverlapOnTrack,
    showSafeTrimBlockedWarning,
    magneticEnabled,
    editTool,
    resolveOverlaps,
    applyClipUpdates,
  ]);

  const handleTimelineZoomChange = useCallback((nextZoom: number) => {
    setTimelineZoomFromUser(nextZoom);
  }, [setTimelineZoomFromUser]);

  const handleTimelineTrackToggle = useCallback((trackId: string, changes: Partial<TrackState>) => {
    setTrackStates((previous) => ({
      ...previous,
      [trackId]: { ...previous[trackId], ...changes },
    }));
  }, []);

  const handleTimelineTrackRename = useCallback((trackId: string, name: string) => {
    setTracks((previous) =>
      previous.map((track) => (track.id === trackId ? { ...track, name } : track))
    );
  }, []);

  const handleTimelineTrackTypeChange = useCallback((trackId: string, type: TrackState['type']) => {
    const normalizedType: NonNullable<TrackState['type']> =
      type === 'audio' || type === 'video' || type === 'adjustment' || type === 'subtitle' || type === 'graphics'
        ? type
        : 'video';
    setTrackStates((previous) => {
      const matchingTrack = tracks.find((track) => track.id === trackId);
      const defaultRole = matchingTrack
        ? inferAudioRoleFromTrackName(matchingTrack.name)
        : 'dialogue';
      return {
        ...previous,
        [trackId]: {
          ...previous[trackId],
          type: normalizedType,
          audioRole: normalizedType === 'audio' ? previous[trackId]?.audioRole ?? defaultRole : undefined,
        },
      };
    });
    setTracks((previous) =>
      previous.map((track) =>
        track.id === trackId
          ? { ...track, type: normalizedType === 'audio' ? 'audio' : 'video' }
          : track
      )
    );
  }, [tracks, inferAudioRoleFromTrackName]);

  const handleTimelineContextMenuAction = useCallback((action: string, payload: unknown) => {
    if (!isRecord(payload) || typeof payload.clipId !== 'string') {
      return;
    }
    const clipId = payload.clipId;
    switch (action) {
      case 'edit-metadata':
        setSelectedClips(new Set([clipId]));
        break;
      case 'split': {
        const atTime = currentTime;
        setClips((previous) => splitClip(previous, clipId, atTime));
        break;
      }
      case 'duplicate':
        setClips((previous) => duplicateClip(previous, clipId));
        break;
      case 'delete':
        setClips((previous) => deleteClip(previous, clipId, rippleEnabled));
        break;
      case 'add-transition': {
        const clip = clips.find((entry) => entry.id === clipId);
        if (!clip) {
          return;
        }
        const edge: 'in' | 'out' = payload.edge === 'in' ? 'in' : 'out';
        const transitionLayer: 'video' | 'audio' =
          payload.transitionLayer === 'audio' || payload.transitionLayer === 'video'
            ? payload.transitionLayer
            : isAudioTrackId(clip.trackId)
              ? 'audio'
              : 'video';
        const transitionType =
          typeof payload.transitionType === 'string' && payload.transitionType.trim().length > 0
            ? payload.transitionType
            : transitionLayer === 'audio'
              ? 'audio_crossfade'
              : pendingTransitionType || 'crossfade';
        const transitionDuration =
          typeof payload.duration === 'number' && Number.isFinite(payload.duration) && payload.duration > 0
            ? payload.duration
            : transitionLayer === 'audio'
              ? 0.25
              : pendingTransitionDuration;
        const transitionEngine: 'canvas2d' | 'webgl' | 'audio' =
          payload.transitionEngine === 'audio' || payload.transitionEngine === 'webgl' || payload.transitionEngine === 'canvas2d'
            ? payload.transitionEngine
            : transitionLayer === 'audio'
              ? 'audio'
              : pendingTransitionEngine;

        const transitionResult = addTransitionToClipEdge(clip, edge, {
          type: transitionType,
          duration: transitionDuration,
          layer: transitionLayer,
          engine: transitionEngine,
        });
        setSnackbar({
          open: true,
          message: `${transitionResult.layer === 'audio' ? 'Audio' : 'Video'} transition added on ${edge} edge (${transitionResult.transitionType}, ${transitionResult.duration.toFixed(2)}s).`,
          severity: 'success',
        });
        break;
      }
      case 'set-clip-fade': {
        const clip = clips.find((entry) => entry.id === clipId);
        if (!clip) {
          return;
        }
        const fadeEdge: 'in' | 'out' = payload.fadeEdge === 'in' ? 'in' : 'out';
        const fadeLayer: 'video' | 'audio' =
          payload.fadeLayer === 'audio' || payload.fadeLayer === 'video'
            ? payload.fadeLayer
            : isAudioTrackId(clip.trackId)
              ? 'audio'
              : 'video';
        const fadeKey = `${fadeLayer}Fade${fadeEdge === 'in' ? 'In' : 'Out'}`;
        const rawDuration =
          typeof payload.fadeDuration === 'number' && Number.isFinite(payload.fadeDuration) && payload.fadeDuration > 0
            ? payload.fadeDuration
            : fadeLayer === 'audio'
              ? 0.25
              : 0.5;
        const maxDuration = Math.max(frameTime, clip.duration - frameTime);
        const fadeDuration = timelineEngine.snapToFrame(Math.max(frameTime, Math.min(rawDuration, maxDuration)));

        setClips((previous) =>
          previous.map((entry) => {
            if (entry.id !== clipId) {
              return entry;
            }
            const transitions =
              isRecord(entry.metadata?.transitions) ? (entry.metadata.transitions as Record<string, unknown>) : {};
            const edgeTransition =
              isRecord(transitions[fadeEdge]) ? (transitions[fadeEdge] as Record<string, unknown>) : {};
            return {
              ...entry,
              metadata: {
                ...(entry.metadata || {}),
                [fadeKey]: {
                  duration: fadeDuration,
                  curve: 'linear',
                  layer: fadeLayer,
                  edge: fadeEdge,
                  appliedAt: new Date().toISOString(),
                },
                transitions: {
                  ...transitions,
                  [fadeEdge]: {
                    ...edgeTransition,
                    duration: fadeDuration,
                    layer: fadeLayer,
                    type:
                      typeof edgeTransition.type === 'string'
                        ? edgeTransition.type
                        : fadeLayer === 'audio'
                          ? 'audio_fade'
                          : 'fade',
                  },
                },
              },
            };
          })
        );
        setMarkers((previous) => [
          ...previous,
          {
            id: `fade-${clipId}-${fadeLayer}-${fadeEdge}-${Date.now()}`,
            time: timelineEngine.snapToFrame(
              Math.max(0, fadeEdge === 'in' ? clip.start : clip.start + clip.duration)
            ),
            color: fadeLayer === 'audio' ? '#f59e0b' : '#38bdf8',
            label: `${fadeLayer === 'audio' ? 'Audio' : 'Video'} Fade ${fadeEdge.toUpperCase()}`,
          },
        ]);
        setSnackbar({
          open: true,
          message: `${fadeLayer === 'audio' ? 'Audio' : 'Video'} fade ${fadeEdge} set (${fadeDuration.toFixed(2)}s).`,
          severity: 'success',
        });
        break;
      }
      case 'clear-clip-fade': {
        const clip = clips.find((entry) => entry.id === clipId);
        if (!clip) {
          return;
        }
        const fadeEdge: 'in' | 'out' = payload.fadeEdge === 'in' ? 'in' : 'out';
        const fadeLayer: 'video' | 'audio' =
          payload.fadeLayer === 'audio' || payload.fadeLayer === 'video'
            ? payload.fadeLayer
            : isAudioTrackId(clip.trackId)
              ? 'audio'
              : 'video';
        const fadeKey = `${fadeLayer}Fade${fadeEdge === 'in' ? 'In' : 'Out'}`;

        setClips((previous) =>
          previous.map((entry) => {
            if (entry.id !== clipId) {
              return entry;
            }
            const metadata = { ...(entry.metadata || {}) } as Record<string, unknown>;
            delete metadata[fadeKey];
            const transitions =
              isRecord(metadata.transitions) ? ({ ...(metadata.transitions as Record<string, unknown>) }) : {};
            const edgeTransition =
              isRecord(transitions[fadeEdge]) ? ({ ...(transitions[fadeEdge] as Record<string, unknown>) }) : null;
            if (edgeTransition) {
              const linked = typeof edgeTransition.sourceClipId === 'string' || typeof edgeTransition.targetClipId === 'string';
              const transitionLayer = edgeTransition.layer;
              if (!linked && (transitionLayer === fadeLayer || transitionLayer === undefined)) {
                delete transitions[fadeEdge];
              }
            }
            metadata.transitions = transitions;
            return {
              ...entry,
              metadata,
            };
          })
        );
        setSnackbar({
          open: true,
          message: `${fadeLayer === 'audio' ? 'Audio' : 'Video'} fade ${fadeEdge} cleared.`,
          severity: 'info',
        });
        break;
      }
      case 'color':
        if (typeof payload.color !== 'string') {
          return;
        }
        {
          const nextColor = payload.color;
        setClips((previous) =>
            previous.map((clip) => (clip.id === clipId ? { ...clip, color: nextColor } : clip))
        );
        }
        break;
      case 'add-comment': {
        const id = `c${Date.now()}`;
        setComments((previous) => [...previous, { id, time: currentTime, text: 'Comment', clipId }]);
        break;
      }
      case 'review-approve': {
        const id = `c${Date.now()}`;
        setComments((previous) => [...previous, { id, time: currentTime, text: 'Approved ✅', clipId }]);
        break;
      }
      case 'review-request-changes': {
        const id = `c${Date.now()}`;
        setComments((previous) => [...previous, { id, time: currentTime, text: 'Please revise ✏️', clipId }]);
        break;
      }
      default:
        break;
    }
  }, [
    currentTime,
    rippleEnabled,
    clips,
    isAudioTrackId,
    pendingTransitionType,
    pendingTransitionDuration,
    pendingTransitionEngine,
    addTransitionToClipEdge,
    frameTime,
  ]);

  const handleTimelineMediaDrop = useCallback(({
    media,
    trackId,
    startTime,
  }: {
    media: StoryArcMediaDetail;
    trackId?: string;
    startTime: number;
  }) => {
    addMediaToTimeline({
      media,
      track: trackId,
      position: 'playhead',
      startTime,
    });
    setCurrentTime(startTime);
  }, [addMediaToTimeline]);

  const handleWaveformReady = useCallback((wavesurfer: unknown) => {
    if (
      isRecord(wavesurfer) &&
      typeof wavesurfer.setPlaybackRate === 'function'
    ) {
      wavesurfer.setPlaybackRate(Math.max(0.25, Math.min(4, playbackSpeed)));
    }
    console.log('✅ Waveform ready');
  }, [playbackSpeed]);

  const handleWaveformRegionCreated = useCallback((region: unknown) => {
    if (!isRecord(region) || typeof region.start !== 'number' || typeof region.end !== 'number') {
      return;
    }
    const start = timelineEngine.snapToFrame(Math.max(0, region.start));
    const rawEnd = timelineEngine.snapToFrame(Math.max(0, region.end));
    const end = rawEnd > start ? rawEnd : timelineEngine.snapToFrame(start + frameTime);
    const regionId = typeof region.id === 'string' ? region.id : String(Date.now());

    setProgramMarkIn(start);
    setProgramMarkOut(end);
    setCurrentTime(start);
    setMarkers((previous) => [
      ...previous,
      {
        id: `wave-in-${regionId}`,
        time: start,
        color: '#22d3ee',
        label: 'Wave In',
      },
      {
        id: `wave-out-${regionId}`,
        time: end,
        color: '#06b6d4',
        label: 'Wave Out',
      },
    ]);
    setSnackbar({
      open: true,
      message: `Audio region mapped to Program In/Out (${(end - start).toFixed(2)}s).`,
      severity: 'success',
    });
  }, [frameTime]);

  const handleWorkspaceDockMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const navRect = event.currentTarget.getBoundingClientRect();
    if (navRect.width <= 0) {
      return;
    }
    const rawRatio = (event.clientX - navRect.left) / navRect.width;
    const nextRatio = Math.max(0, Math.min(1, rawRatio));
    setWorkspaceDockPointerRatio((previous) => {
      if (previous === null) {
        return nextRatio;
      }
      return Math.abs(previous - nextRatio) < 0.003 ? previous : nextRatio;
    });
  }, []);

  const handleWorkspaceDockMouseLeave = useCallback(() => {
    setWorkspaceDockPointerRatio(null);
  }, []);

  const handleInspectorClipUpdate = useCallback((clipId: string, updates: Partial<BeatClip>) => {
    setClips((previous) =>
      previous.map((clip) =>
        clip && clip.id === clipId ? { ...clip, ...updates } : clip
      )
    );
  }, []);

  const handleInspectorBulkUpdate = useCallback((clipIds: string[], updates: Partial<BeatClip>) => {
    setClips((previous) =>
      previous.map((clip) =>
        clip && clipIds.includes(clip.id) ? { ...clip, ...updates } : clip
      )
    );
  }, []);

  const handleInspectorMetaUpdate = useCallback((clipId: string, updates: Partial<StoryArcClipMeta>) => {
    setClipMeta((previous) => ({
      ...previous,
      [clipId]: { ...(previous[clipId] || {}), ...updates },
    }));
  }, []);

  const handleAIStoryGenerated = useCallback((data: unknown) => {
    const payload = normalizeAIGeneratedPayload(data);
    const timelineClips = payload?.timeline?.clips || [];
    if (timelineClips.length === 0) {
      setSnackbar({
        open: true,
        message: 'AI generation returned no timeline clips',
        severity: 'warning',
      });
      return;
    }

    const aiClips: BeatClip[] = timelineClips.map((clip, index) => {
      const metadata = clip.metadata || {};
      const emotionalIntensity = metadata.emotionalIntensity;
      return {
        id: clip.id || `ai-clip-${Date.now()}-${index}`,
        name: clip.name || clip.beatName || `AI Clip ${index + 1}`,
        beatName: clip.beatName || clip.name || `AI Clip ${index + 1}`,
        start: typeof clip.start === 'number' ? clip.start : 0,
        duration: typeof clip.duration === 'number' ? clip.duration : 3,
        ev: typeof emotionalIntensity === 'number' ? emotionalIntensity : 0,
        synopsis: clip.name || clip.beatName || `AI Clip ${index + 1}`,
        trackId: clip.trackId || 'video-1',
        color: '#9c27b0',
        sourceFile: clip.sourceFile,
        metadata,
      };
    });

    const hydratedAiClips = hydrateClipSources(aiClips);
    setClips(hydratedAiClips);
    setAvailableVideoSources((previous) => {
      const merged = new Set([...previous, ...extractRenderableVideoSources(hydratedAiClips)]);
      return Array.from(merged);
    });
    const nextDuration =
      typeof payload?.timeline?.totalDuration === 'number'
        ? payload.timeline.totalDuration
        : timelineEngine.calculateDuration(hydratedAiClips);
    setTotalDuration(nextDuration);

    setStoryArc({
      id: 'ai_generated',
      title: payload?.storyArc?.title || 'AI Generated Story',
      type: 'wedding',
      totalDuration: nextDuration,
      segments: [],
      musicSuggestions: payload?.storyArc?.musicSuggestions || [],
      transitionEffects: payload?.storyArc?.transitionPoints || [],
      colorGrading: DEFAULT_COLOR_GRADING_PROFILE,
      confidence: 0.9,
      createdAt: new Date().toISOString(),
    });

    videoEngine.setTimeline(hydratedAiClips, tracks, nextDuration);
    closeAIGeneratorDialog();

    console.log('✅ AI-generated timeline loaded!', hydratedAiClips.length, 'clips');
    setAIGeneratedTimelineData(payload ?? data);
    scheduleAiRatingReveal(2000);
  }, [
    hydrateClipSources,
    extractRenderableVideoSources,
    tracks,
    closeAIGeneratorDialog,
    scheduleAiRatingReveal,
    setSnackbar,
  ]);

  const handleTransitionSelect = useCallback((
    type: string,
    duration: number,
    engine: 'canvas2d' | 'webgl'
  ) => {
    setPendingTransitionType(type);
    setPendingTransitionDuration(duration);
    setPendingTransitionEngine(engine);
    closeTransitionLibrary();
    setSnackbar({
      open: true,
      message: `Queued transition ${type} (${engine.toUpperCase()}, ${duration.toFixed(2)}s)`,
      severity: 'info',
    });
  }, [closeTransitionLibrary]);

  const handleSpeedRampKeyframesChange = useCallback((keyframes: SpeedKeyframe[]) => {
    if (!selectedPrimaryClipId) {
      setCurrentSpeedKeyframes(keyframes);
      setSnackbar({
        open: true,
        message: 'Select a clip before applying speed keyframes.',
        severity: 'warning',
      });
      return;
    }

    if (keyframes.length > 0) {
      const validation = SpeedRampEngine.validateKeyframes(keyframes);
      if (!validation.valid) {
        setSnackbar({
          open: true,
          message: `Invalid speed ramp: ${validation.errors[0] || 'unknown error'}`,
          severity: 'error',
        });
        return;
      }
    }

    setCurrentSpeedKeyframes(keyframes);
    const updated = clips.map((clip) => {
      if (clip.id !== selectedPrimaryClipId) {
        return clip;
      }

      const baseDurationRaw =
        typeof clip.metadata?.speedRampBaseDuration === 'number'
          ? clip.metadata.speedRampBaseDuration
          : clip.duration;
      const baseDuration = Math.max(frameTime, baseDurationRaw);
      const remappedDuration =
        keyframes.length > 0
          ? SpeedRampEngine.getRemappedDuration(baseDuration, keyframes)
          : baseDuration;
      const nextDuration = timelineEngine.snapToFrame(Math.max(frameTime, remappedDuration));

      const nextMetadata: Record<string, unknown> = { ...(clip.metadata || {}) };
      if (keyframes.length === 0) {
        delete nextMetadata.speedKeyframes;
        delete nextMetadata.speedRampBaseDuration;
        delete nextMetadata.speedRampAppliedAt;
      } else {
        nextMetadata.speedKeyframes = keyframes;
        nextMetadata.speedRampBaseDuration = baseDuration;
        nextMetadata.speedRampAppliedAt = new Date().toISOString();
      }

      if (typeof nextMetadata.inPoint === 'number') {
        nextMetadata.outPoint = nextMetadata.inPoint + nextDuration;
      }

      return {
        ...clip,
        duration: nextDuration,
        metadata: nextMetadata,
      };
    });
    applyClipUpdates(updated, new Set([selectedPrimaryClipId]));
  }, [selectedPrimaryClipId, clips, frameTime, applyClipUpdates, setSnackbar]);

  const handleSpeedRampPreview = useCallback(() => {
    if (!selectedPrimaryClip) {
      setSnackbar({
        open: true,
        message: 'Select a clip to preview speed ramp.',
        severity: 'warning',
      });
      return;
    }

    const baseDurationRaw =
      typeof selectedPrimaryClip.metadata?.speedRampBaseDuration === 'number'
        ? selectedPrimaryClip.metadata.speedRampBaseDuration
        : selectedPrimaryClip.duration;
    const baseDuration = Math.max(frameTime, baseDurationRaw);
    const previewDuration =
      currentSpeedKeyframes.length > 0
        ? SpeedRampEngine.getRemappedDuration(baseDuration, currentSpeedKeyframes)
        : baseDuration;

    setCurrentTime(Math.max(0, selectedPrimaryClip.start));
    setSnackbar({
      open: true,
      message: `Speed preview ready: ${baseDuration.toFixed(2)}s -> ${previewDuration.toFixed(2)}s`,
      severity: 'info',
    });
  }, [selectedPrimaryClip, currentSpeedKeyframes, frameTime]);

  const handleTextOverlayAdd = useCallback((overlay: TextOverlay) => {
    const defaultAnimation = textAnimationPresets[0]?.animation as TextOverlay['animation'] | undefined;
    const normalizedOverlay: TextOverlay = {
      ...overlay,
      animation:
        overlay.animation ||
        defaultAnimation || {
          type: 'fade_in',
          duration: 0.5,
          delay: 0,
        },
    };
    setTextOverlays((previous) => [...previous, normalizedOverlay]);
    try {
      textOverlayEngine.addOverlay(normalizedOverlay);
    } catch (error) {
      console.warn('Text overlay engine add failed:', error);
    }
    const markerTime =
      typeof normalizedOverlay.startTime === 'number' && Number.isFinite(normalizedOverlay.startTime)
        ? normalizedOverlay.startTime
        : currentTime;
    setMarkers((previous) => [
      ...previous,
      {
        id: `text-overlay-${normalizedOverlay.id}`,
        time: timelineEngine.snapToFrame(Math.max(0, markerTime)),
        color: '#38bdf8',
        label: `Text: ${normalizedOverlay.text.slice(0, 18)}`,
      },
    ]);
  }, [textAnimationPresets, currentTime]);

  const handleGPUFilterApply = useCallback((filterId: string, config: FilterConfig) => {
    setAppliedFilters((previous) => new Map(previous).set(filterId, config));
    try {
      pixiFilterEngine.applyFilter(filterId, config);
    } catch (error) {
      console.warn('GPU filter apply failed:', error);
    }
    if (selectedClips.size > 0) {
      setClips((previous) =>
        previous.map((clip) => {
          if (!selectedClips.has(clip.id)) {
            return clip;
          }
          const existingFilters =
            isRecord(clip.metadata?.gpuFilters) ? (clip.metadata.gpuFilters as Record<string, unknown>) : {};
          return {
            ...clip,
            metadata: {
              ...(clip.metadata || {}),
              gpuFilters: {
                ...existingFilters,
                [filterId]: config,
              },
            },
          };
        })
      );
    }
  }, [selectedClips]);

  const handleColorGradeApply = useCallback((grade: ColorGradeSelection) => {
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
  }, [colorGradePresets, selectedClips]);

  const handleCaptionsGenerated = useCallback((captions: CaptionSegment[], srt: string, vtt: string) => {
    console.log('✅ Captions generated:', captions.length, 'segments');
    setCaptionsExport({
      segments: captions,
      srt,
      vtt,
    });
    const markerSeed = Date.now();
    const captionMarkers: TimelineMarker[] = captions
      .slice(0, 50)
      .flatMap((caption, index) => {
        const start = typeof caption.start === 'number' ? caption.start : 0;
        const text = typeof caption.text === 'string' ? caption.text : '';
        if (text.trim().length === 0) {
          return [];
        }
        return [{
          id: `cap-${markerSeed}-${index}`,
          time: timelineEngine.snapToFrame(Math.max(0, start)),
          color: '#f59e0b',
          label: `Caption: ${text.slice(0, 22)}`,
        }];
      });
    if (captionMarkers.length > 0) {
      setMarkers((previous) => [...previous, ...captionMarkers]);
    }
    setSnackbar({
      open: true,
      message: `Captions generated (${captions.length} segments). Export ready in Effects Dock.`,
      severity: 'success',
    });
  }, []);

  const handleBeatSyncClipsSnapped = useCallback((snappedClips: BeatClip[]) => {
    const hydratedSnappedClips = hydrateClipSources(snappedClips);
    setClips(hydratedSnappedClips);
    setAvailableVideoSources((previous) => {
      const merged = new Set([...previous, ...extractRenderableVideoSources(hydratedSnappedClips)]);
      return Array.from(merged);
    });
    console.log('✅ Clips snapped to beats');
  }, [hydrateClipSources, extractRenderableVideoSources]);

  const handleBackgroundRemovalProcessed = useCallback((result: unknown) => {
    const resolvedClipId =
      isRecord(result) && typeof result.clipId === 'string'
        ? result.clipId
        : selectedPrimaryClipId;
    const outputVideoPath =
      isRecord(result) && typeof result.output_video_path === 'string'
        ? result.output_video_path
        : isRecord(result) && typeof result.outputPath === 'string'
          ? result.outputPath
          : isRecord(result) && typeof result.result_video_path === 'string'
            ? result.result_video_path
            : null;

    if (resolvedClipId) {
      setClips((previous) =>
        previous.map((clip) =>
          clip.id === resolvedClipId
            ? {
                ...clip,
                sourceFile: outputVideoPath || clip.sourceFile,
                metadata: {
                  ...(clip.metadata || {}),
                  backgroundRemoval: {
                    ...(isRecord(result) ? result : {}),
                    processedAt: new Date().toISOString(),
                  },
                },
              }
            : clip
        )
      );
      setMarkers((previous) => [
        ...previous,
        {
          id: `bg-processed-${resolvedClipId}-${Date.now()}`,
          time: timelineEngine.snapToFrame(currentTime),
          color: '#22c55e',
          label: 'Background Processed',
        },
      ]);
    }

    setSnackbar({
      open: true,
      message: 'Background processing applied to clip.',
      severity: 'success',
    });
  }, [selectedPrimaryClipId, currentTime]);

  const handleObjectSegmentationComplete = useCallback((result: unknown) => {
    const resolvedClipId =
      isRecord(result) && typeof result.clipId === 'string'
        ? result.clipId
        : selectedPrimaryClipId;
    const maskFrames =
      isRecord(result) && Array.isArray(result.frames) ? result.frames.length : 0;

    if (resolvedClipId) {
      setClips((previous) =>
        previous.map((clip) =>
          clip.id === resolvedClipId
            ? {
                ...clip,
                metadata: {
                  ...(clip.metadata || {}),
                  objectSegmentation: {
                    ...(isRecord(result) ? result : {}),
                    completedAt: new Date().toISOString(),
                    maskFrames,
                  },
                },
              }
            : clip
        )
      );
      setMarkers((previous) => [
        ...previous,
        {
          id: `object-segmentation-${resolvedClipId}-${Date.now()}`,
          time: timelineEngine.snapToFrame(currentTime),
          color: '#f97316',
          label: `Object masks (${maskFrames})`,
        },
      ]);
    }

    setSnackbar({
      open: true,
      message: `Object segmentation complete (${maskFrames} frame masks).`,
      severity: 'success',
    });
  }, [selectedPrimaryClipId, currentTime]);

  const handleMotionTrackingComplete = useCallback((result: unknown) => {
    const resolvedClipId =
      isRecord(result) && typeof result.clipId === 'string'
        ? result.clipId
        : selectedPrimaryClipId;
    const trackedFrames =
      isRecord(result) && Array.isArray(result.frames) ? result.frames.length : 0;
    const trackerType =
      isRecord(result) && typeof result.tracker_type === 'string'
        ? result.tracker_type
        : 'tracker';

    if (resolvedClipId) {
      setClips((previous) =>
        previous.map((clip) =>
          clip.id === resolvedClipId
            ? {
                ...clip,
                metadata: {
                  ...(clip.metadata || {}),
                  motionTracking: {
                    ...(isRecord(result) ? result : {}),
                    trackedFrames,
                    trackerType,
                    completedAt: new Date().toISOString(),
                  },
                },
              }
            : clip
        )
      );
      setMarkers((previous) => [
        ...previous,
        {
          id: `motion-track-${resolvedClipId}-${Date.now()}`,
          time: timelineEngine.snapToFrame(currentTime),
          color: '#6366f1',
          label: `Motion: ${trackerType}`,
        },
      ]);
    }

    setSnackbar({
      open: true,
      message: `Motion tracking complete! Tracked ${trackedFrames} frames using ${trackerType}`,
      severity: 'success',
    });
  }, [selectedPrimaryClipId, currentTime]);

  const handleAudioEnhanced = useCallback((enhancedUrl: string, metrics: AudioEnhancementMetrics) => {
    const detail = window.__pendingAudioDetail;
    if (detail) {
      const targetTrackId = detail.track || 'audio-1';
      const clipDuration = Number(detail.media.duration || 5);

      setTracks((previous) => {
        if (!previous.find((track) => track.id === targetTrackId)) {
          const newTrack: Track = { id: targetTrackId, name: targetTrackId, type: 'audio', height: 40 };
          return [...previous, newTrack];
        }
        return previous;
      });

      setClips((previous) => {
        let start = 0;
        if (detail.position === 'playhead') {
          start = currentTime;
        } else {
          const trackClips = previous.filter((clip) => clip.trackId === targetTrackId);
          const end = trackClips.length > 0 ? Math.max(...trackClips.map((clip) => clip.start + clip.duration)) : 0;
          start = end;
        }
        const id = `clip_${Date.now()}`;
        const originalName = detail.media.name || 'Audio';
        const extension = originalName.match(/\.[^/.]+$/)?.[0] || '.wav';
        const baseName = originalName.replace(/\.[^/.]+$/, '');
        const enhancedName = `${baseName}_enhanced${extension}`;

        const newClip = {
          id,
          name: enhancedName,
          beatName: enhancedName,
          start,
          duration: clipDuration,
          ev: 0,
          synopsis: `Forbedret: ${metrics.loudness?.standard} (${metrics.loudness?.final_lufs?.toFixed(1)} LUFS) | Fra: ${originalName}`,
          trackId: targetTrackId,
          color: '#16a34a',
          sourceFile: enhancedUrl,
          enhanced: true,
          enhancedPreset: metrics.loudness?.standard || 'Enhanced',
          metadata: {
            originalSource: detail.media.url || detail.media.name,
            originalName,
            enhancedFrom: detail.media.id || detail.media.name,
            enhancementMethod: metrics.enhancement?.method || 'FlowSE/DEMUCS',
            loudnessStandard: metrics.loudness?.standard,
          },
          tags: ['enhanced', 'audio', metrics.loudness?.standard || 'enhanced'],
        } as BeatClip;
        const next = [...previous, newClip];
        const maxEnd = Math.max(...next.map((clip) => clip.start + clip.duration), storyArc?.totalDuration || 0);
        setTotalDuration(maxEnd);
        return next;
      });

      const originalName = detail.media.name || 'Audio';
      const assetName = `${originalName} (Forbedret)`;
      const description = `Forbedret lyd: ${metrics.loudness?.standard} standard (${metrics.loudness?.final_lufs?.toFixed(1)} LUFS)`;

      apiRequest('/api/assets/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: assetName,
          description,
          category: 'audio',
          subcategory: 'enhanced',
          model_url: enhancedUrl,
          tags: ['enhanced', 'audio', metrics.loudness?.standard || 'enhanced'],
          metadata: {
            originalName,
            enhancementMethod: metrics.enhancement?.method || 'FlowSE/DEMUCS',
            loudnessStandard: metrics.loudness?.standard,
            finalLufs: metrics.loudness?.final_lufs,
            snrImprovement: metrics.enhancement?.snr_improvement,
            quality: metrics.enhancement?.quality,
            preset: metrics.loudness?.standard,
          },
          is_public: false,
        }),
      }).then(() => {
        console.log('✅ Enhanced audio saved to asset library');
      }).catch((error: unknown) => {
        console.error('Failed to save enhanced audio to library:', error);
      });

      if (storyArcId && storyArc?.title && currentUser?.id) {
        fetch(enhancedUrl)
          .then((response) => response.blob())
          .then((blob) => {
            const formData = new FormData();
            formData.append('file', blob, assetName);
            formData.append('storyArcName', storyArc.title);

            return apiRequest(`/api/story-arc/${storyArcId}/google-drive/upload-audio`, {
              method: 'POST',
              body: formData,
            });
          })
          .then(() => {
            console.log('✅ Enhanced audio uploaded to Google Drive Audio Assets folder');
          })
          .catch((error: unknown) => {
            console.error('Failed to upload enhanced audio to Google Drive:', error);
          });
      }

      delete window.__pendingAudioDetail;
    }

    setShowAudioEnhancementDialog(false);
    setPendingAudioFile(null);

    setSnackbar({
      open: true,
      message: `Lyd forbedret! ${metrics.loudness?.standard} standard (${metrics.loudness?.final_lufs?.toFixed(1)} LUFS)`,
      severity: 'success',
    });
  }, [currentTime, storyArc?.totalDuration, storyArc?.title, storyArcId, currentUser?.id]);

  const handleAudioEnhancementSkip = useCallback(() => {
    const detail = window.__pendingAudioDetail;
    if (detail) {
      const targetTrackId = detail.track || 'audio-1';
      const clipDuration = Number(detail.media.duration || 5);

      setTracks((previous) => {
        if (!previous.find((track) => track.id === targetTrackId)) {
          const newTrack: Track = { id: targetTrackId, name: targetTrackId, type: 'audio', height: 40 };
          return [...previous, newTrack];
        }
        return previous;
      });

      setClips((previous) => {
        let start = 0;
        if (detail.position === 'playhead') {
          start = currentTime;
        } else {
          const trackClips = previous.filter((clip) => clip.trackId === targetTrackId);
          const end = trackClips.length > 0 ? Math.max(...trackClips.map((clip) => clip.start + clip.duration)) : 0;
          start = end;
        }
        const id = `clip_${Date.now()}`;
        const newClip = {
          id,
          name: detail.media.name || 'Asset',
          beatName: detail.media.name || 'Asset',
          start,
          duration: clipDuration,
          ev: 0,
          synopsis: detail.media.name || 'Asset',
          trackId: targetTrackId,
          color: '#4caf50',
          sourceFile: detail.media.url,
          metadata: {
            camera: detail.media.camera,
            syncGroup: detail.media.syncGroup,
            originalSource: detail.media.url || detail.media.name,
          },
          tags: detail.media.tags || [],
        } as BeatClip;
        const next = [...previous, newClip];
        const maxEnd = Math.max(...next.map((clip) => clip.start + clip.duration), storyArc?.totalDuration || 0);
        setTotalDuration(maxEnd);

        if (detail.media.camera || detail.media.syncGroup || detail.media.tags) {
          setClipMeta((clipMetaMap) => ({
            ...clipMetaMap,
            [id]: {
              camera: detail.media.camera,
              syncGroup: detail.media.syncGroup,
              tags: detail.media.tags || [],
            },
          }));
        }

        return next;
      });

      delete window.__pendingAudioDetail;
    }

    setShowAudioEnhancementDialog(false);
    setPendingAudioFile(null);
  }, [currentTime, storyArc?.totalDuration]);

  const handleBatchAudioComplete = useCallback((results: BatchAudioEnhancementResult[]) => {
    results.forEach((result) => {
      if (result.status === 'success' && result.enhancedUrl) {
        const targetTrackId = 'audio-1';

        setTracks((previous) => {
          if (!previous.find((track) => track.id === targetTrackId)) {
            const newTrack: Track = { id: targetTrackId, name: targetTrackId, type: 'audio', height: 40 };
            return [...previous, newTrack];
          }
          return previous;
        });

        setClips((previous) => {
          const trackClips = previous.filter((clip) => clip.trackId === targetTrackId);
          const end = trackClips.length > 0 ? Math.max(...trackClips.map((clip) => clip.start + clip.duration)) : 0;

          const id = `clip_${Date.now()}_${Math.random()}`;
          const newClip = {
            id,
            name: `${result.file.name} (Forbedret)`,
            beatName: `${result.file.name} (Forbedret)`,
            start: end,
            duration: 120,
            ev: 0,
            synopsis: `Forbedret: ${result.metrics?.loudness?.standard} (${result.metrics?.loudness?.final_lufs?.toFixed(1)} LUFS)`,
            trackId: targetTrackId,
            color: '#16a34a',
            sourceFile: result.enhancedUrl,
            enhanced: true,
            enhancedPreset: result.metrics?.loudness?.standard || 'Enhanced',
          } as BeatClip;

          const next = [...previous, newClip];
          const maxEnd = Math.max(...next.map((clip) => clip.start + clip.duration), storyArc?.totalDuration || 0);
          setTotalDuration(maxEnd);
          return next;
        });
      }
    });

    closeBatchAudioDialog();

    const successCount = results.filter((result) => result.status === 'success').length;
    setSnackbar({
      open: true,
      message: `${successCount} lydfiler forbedret og lagt til i tidslinjen!`,
      severity: 'success',
    });
  }, [closeBatchAudioDialog, storyArc?.totalDuration]);

  const aiAudioAssistantTracks = useMemo<Array<{
    id: string;
    name: string;
    sourceFile: string;
    type?: 'dialogue' | 'music' | 'sfx';
    timeline?: {
      start: number;
      duration: number;
      inPoint: number;
      outPoint: number;
      linkedVideoClipId?: string;
      autoEditDucking?: Record<string, unknown>;
      autoEditJCut?: Record<string, unknown>;
      autoEditLCut?: Record<string, unknown>;
      audioFadeIn?: { duration: number; edge: 'in'; layer: 'audio' };
      audioFadeOut?: { duration: number; edge: 'out'; layer: 'audio' };
    };
  }>>(
    () => {
      const clipLookup = new Map(clips.map((clip) => [clip.id, clip]));
      return clips
        .filter((clip) => clip.trackId?.startsWith('A') || clip.trackId?.startsWith('audio'))
        .map((clip) => {
          const audioRole = trackStates[clip.trackId]?.audioRole;
          const assistantType: 'dialogue' | 'music' | 'sfx' | undefined =
            audioRole === 'dialogue' || audioRole === 'voiceover' || audioRole === 'narration'
              ? 'dialogue'
              : audioRole === 'music'
                ? 'music'
                : audioRole === 'effects' || audioRole === 'ambience'
                ? 'sfx'
                : undefined;
          const metadata = isRecord(clip.metadata) ? clip.metadata : {};
          const linkedVideoClipId =
            typeof metadata.linkedVideoClipId === 'string' && metadata.linkedVideoClipId.trim().length > 0
              ? metadata.linkedVideoClipId
              : undefined;
          const linkedVideoMetadata = linkedVideoClipId
            ? (() => {
                const linkedClip = clipLookup.get(linkedVideoClipId);
                return isRecord(linkedClip?.metadata) ? linkedClip.metadata : {};
              })()
            : {};
          const autoEditDucking =
            isRecord(metadata.autoEditDucking)
              ? (metadata.autoEditDucking as Record<string, unknown>)
              : isRecord(linkedVideoMetadata.autoEditDucking)
                ? (linkedVideoMetadata.autoEditDucking as Record<string, unknown>)
                : undefined;
          const autoEditJCut =
            isRecord(metadata.autoEditJCut)
              ? (metadata.autoEditJCut as Record<string, unknown>)
              : isRecord(linkedVideoMetadata.autoEditJCut)
                ? (linkedVideoMetadata.autoEditJCut as Record<string, unknown>)
                : undefined;
          const autoEditLCut =
            isRecord(metadata.autoEditLCut)
              ? (metadata.autoEditLCut as Record<string, unknown>)
              : isRecord(linkedVideoMetadata.autoEditLCut)
                ? (linkedVideoMetadata.autoEditLCut as Record<string, unknown>)
                : undefined;
          const inPoint =
            typeof metadata.inPoint === 'number'
              ? metadata.inPoint
              : typeof linkedVideoMetadata.inPoint === 'number'
                ? linkedVideoMetadata.inPoint
                : getClipInPoint(clip);
          const outPoint =
            typeof metadata.outPoint === 'number'
              ? metadata.outPoint
              : typeof linkedVideoMetadata.outPoint === 'number'
                ? linkedVideoMetadata.outPoint
                : inPoint + clip.duration;
          const fadeInDuration = getClipFadeDuration(clip, 'audio', 'in');
          const fadeOutDuration = getClipFadeDuration(clip, 'audio', 'out');
          const timelinePayload = {
            start: clip.start,
            duration: clip.duration,
            inPoint,
            outPoint,
            linkedVideoClipId,
            autoEditDucking,
            autoEditJCut,
            autoEditLCut,
            audioFadeIn:
              fadeInDuration > 0
                ? {
                    duration: fadeInDuration,
                    edge: 'in' as const,
                    layer: 'audio' as const,
                  }
                : undefined,
            audioFadeOut:
              fadeOutDuration > 0
                ? {
                    duration: fadeOutDuration,
                    edge: 'out' as const,
                    layer: 'audio' as const,
                  }
                : undefined,
          };
          return {
            id: clip.id,
            name: clip.name || clip.id,
            sourceFile: clip.sourceFile || '',
            type: assistantType,
            timeline: timelinePayload,
          };
        });
    },
    [clips, trackStates, getClipInPoint, getClipFadeDuration]
  );

  const handleAIAudioMixComplete = useCallback((mixedAudioUrl: string, metrics: AudioEnhancementMetrics) => {
    const mixedTrackId = 'audio-mixed';

    setTracks((previous) => {
      if (!previous.find((track) => track.id === mixedTrackId)) {
        const newTrack: Track = { id: mixedTrackId, name: 'AI Mixed Audio', type: 'audio', height: 40 };
        return [...previous, newTrack];
      }
      return previous;
    });

    setClips((previous) => {
      const id = `clip_ai_mixed_${Date.now()}`;
      const newClip = {
        id,
        name: 'AI Mixed Audio',
        beatName: 'AI Mixed Audio',
        start: 0,
        duration: metrics.duration_seconds || 120,
        ev: 0,
        synopsis: `AI Mixed: ${metrics.tracks_processed} tracks (${metrics.final_lufs?.toFixed(1)} LUFS)`,
        trackId: mixedTrackId,
        color: '#9333ea',
        sourceFile: mixedAudioUrl,
        enhanced: true,
        enhancedPreset: 'AI Mixed',
      } as BeatClip;

      const next = [...previous, newClip];
      const maxEnd = Math.max(...next.map((clip) => clip.start + clip.duration), storyArc?.totalDuration || 0);
      setTotalDuration(maxEnd);
      return next;
    });

    closeAIAudioAssistantDialog();
    setSnackbar({
      open: true,
      message: `AI-miksing fullført! ${metrics.tracks_processed} spor mikset til ${metrics.final_lufs?.toFixed(1)} LUFS`,
      severity: 'success',
    });
  }, [closeAIAudioAssistantDialog, storyArc?.totalDuration]);

  const syncResultRows = useMemo(
    () =>
      syncResults
        ? Object.entries(syncResults)
            .map(([clipId, result]) => {
              const clip = clipMap.get(clipId);
              if (!clip) {
                return null;
              }

              const confidence = result.confidence || 0;
              const confidenceColor: 'success' | 'warning' | 'error' =
                confidence > 0.8 ? 'success' : confidence > 0.6 ? 'warning' : 'error';

              return {
                clipId,
                clip,
                result,
                confidence,
                confidenceColor,
                confidencePreviewColor:
                  confidence > 0.8 ? '#4caf50' : confidence > 0.6 ? '#ff9800' : '#f44336',
                manualOffset: manualOffsets[clipId] ?? result.offset_seconds,
              };
            })
            .filter(
              (
                row
              ): row is {
                clipId: string;
                clip: BeatClip;
                result: EngineAudioSyncResult;
                confidence: number;
                confidenceColor: 'success' | 'warning' | 'error';
                confidencePreviewColor: string;
                manualOffset: number;
              } => Boolean(row)
            )
        : [],
    [syncResults, clipMap, manualOffsets]
  );

  const syncConfidenceSummary = useMemo(() => {
    if (syncResultRows.length === 0) {
      return null;
    }

    const avgConfidence =
      syncResultRows.reduce((sum, row) => sum + row.confidence, 0) / syncResultRows.length;
    const qualityColor: 'success' | 'warning' | 'error' =
      avgConfidence > 0.8 ? 'success' : avgConfidence > 0.6 ? 'warning' : 'error';
    const qualityLabel = avgConfidence > 0.8 ? 'Excellent' : avgConfidence > 0.6 ? 'Good' : 'Poor';

    return {
      avgConfidence,
      qualityColor,
      qualityLabel,
    };
  }, [syncResultRows]);

  const resolveClipName = useCallback((clipId: string) => clipMap.get(clipId)?.name, [clipMap]);

  const {
    sourceMonitorPanelHandlers,
    programMonitorPanelHandlers,
    sourceVideoHandlers,
    programVideoHandlers,
    sourcePatchHandlers,
  } = useStoryArcMonitorHandlers({
    handleSourceMonitorMouseDown,
    handleSourceMonitorFocus,
    handleProgramMonitorMouseDown,
    handleProgramMonitorFocus,
    handleSourceVideoLoadedMetadata,
    handleSourceVideoTimeUpdate,
    handleSourceVideoPlay,
    handleSourceVideoPause,
    handleSourceVideoError,
    handleProgramVideoLoadedMetadata,
    handleProgramVideoError,
    handleSourcePatchVideoTrackChange,
    handleSourcePatchAudioTrackChange,
    handleSourcePatchIncludeAudioChange,
  });

  const { timelineProps, inspectorProps, waveformProps } = useStoryArcTimelineHandlers({
    clips,
    tracks,
    zoom: timelineZoom,
    currentTime,
    totalDuration,
    isPlaying,
    selectedClips,
    handleTimelineClipSelect,
    handleTimelineClipMove,
    handleTimelineClipResize,
    handleTimelineClick,
    handleCurrentTimeChange,
    handleTimelineZoomChange,
    trackHeightScale,
    markers,
    trackStates,
    handleTimelineTrackToggle,
    handleTimelineTrackRename,
    handleTimelineTrackTypeChange,
    setTrackAudioRole,
    transitions,
    clipMeta,
    filterTags,
    searchQuery,
    handleTimelineContextMenuAction,
    reviewerMode,
    compareMode,
    compareSnapshot,
    collabLocks,
    handleTimelineMediaDrop,
    selectedInspectorClips,
    handleInspectorClipUpdate,
    handleInspectorBulkUpdate,
    handleInspectorMetaUpdate,
    waveformAudioUrl,
    handleWaveformReady,
    handleWaveformRegionCreated,
  });

  const {
    aiStoryGeneratorDialogProps,
    transitionLibraryProps,
    speedRampPanelProps,
    textOverlayPanelProps,
    gpuFiltersPanelProps,
    colorGradingPanelProps,
    autoCaptionsPanelProps,
    beatSyncPanelProps,
    backgroundRemovalPanelProps,
    objectSegmentationPanelProps,
    motionTrackingPanelProps,
  } = useStoryArcPanelFlows({
    showAIGeneratorDialog,
    closeAIGeneratorDialog,
    handleAIStoryGenerated,
    showTransitionLibrary,
    closeTransitionLibrary,
    handleTransitionSelect,
    selectedClipsSize: selectedClips.size,
    showSpeedRampPanel,
    selectedPrimaryClipId,
    selectedPrimaryClipDuration: selectedPrimaryClip?.duration || 10,
    currentSpeedKeyframes,
    handleSpeedRampKeyframesChange,
    handleSpeedRampPreview,
    showTextOverlayPanel,
    closeTextOverlayPanel,
    handleTextOverlayAdd,
    showGPUFiltersPanel,
    closeGPUFiltersPanel,
    handleGPUFilterApply,
    showColorGradingPanel,
    closeColorGradingPanel,
    handleColorGradeApply,
    showAutoCaptionsPanel,
    closeAutoCaptionsPanel,
    captionVideoPath,
    captionSourceVideoFile,
    captionFallbackVideoPaths,
    captionFallbackVideoFiles,
    handleCaptionsGenerated,
    waveformAudioUrl,
    showBeatSyncPanel,
    closeBeatSyncPanel,
    clips,
    handleBeatSyncClipsSnapped,
    showObjectSegmentationPanel,
    closeObjectSegmentationPanel,
    showMotionTrackingPanel,
    closeMotionTrackingPanel,
    selectedPrimaryClipSourceFile: selectedPrimaryClip?.sourceFile,
    handleBackgroundRemovalProcessed,
    handleObjectSegmentationComplete,
    handleMotionTrackingComplete,
  });

  const {
    audioEnhancementDialogProps,
    batchAudioDialogProps,
    aiAudioAssistantDialogProps,
  } = useStoryArcAudioFlows({
    showAudioEnhancementDialog,
    closeAudioEnhancementDialog,
    pendingAudioFile,
    handleAudioEnhanced,
    handleAudioEnhancementSkip,
    showBatchAudioDialog,
    closeBatchAudioDialog,
    batchAudioFiles,
    handleBatchAudioComplete,
    showAIAudioAssistant,
    closeAIAudioAssistantDialog,
    aiAudioAssistantTracks,
    selectedAudioTrackId,
    openMixerDirectly,
    handleAIAudioMixComplete,
  });

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
        <StoryArcTopBar>
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
                  onClick={toggleActiveMonitorFocus}
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
                    onClick={handleActiveJKLReverse}
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
                    onClick={handleActiveJKLPause}
                    disabled={!activeMonitorCanPlay}
                  >
                    <Pause fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={`Forward Play (L) - ${activeMonitorLabel}`}>
                  <IconButton 
                    data-testid="active-transport-l"
                    size="small" 
                    onClick={handleActiveJKLForward}
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
                  onClick={toggleLoopPlayback}
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
                  onClick={toggleFullscreenMonitor}
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
                    onClick={openPushSettingsDialog}
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
                onClick={triggerImportProject}
              >
                Import Project
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={triggerExportProject}
                disabled={!programMonitorClip?.sourceFile}
              >
                Export to Project
              </Button>
              <Button size="small" variant="outlined" onClick={openOnboardingDialog}>Onboarding</Button>
              {/* Search & filter */}
              <TextField
                size="small"
                placeholder="Search tags, scene, name…"
                value={searchQuery}
                onChange={handleSearchQueryChange}
                sx={{ minWidth: 220 }}
              />
              <TextField
                size="small"
                placeholder="Filter tags (comma)"
                onBlur={handleFilterTagsBlur}
                sx={{ minWidth: 180 }}
              />
              {/* AI Story Generator - NEW! */}
              <Tooltip title="AI Story Generator - Upload video and auto-create timeline">
                <Button
                  size="small"
                  onMouseEnter={preloadAIStoryGeneratorDialog}
                  onFocus={preloadAIStoryGeneratorDialog}
                  onClick={openAIGeneratorDialog}
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

              <Tooltip title="Auto Edit Assistant - assemble + polish preview">
                <Button
                  size="small"
                  onClick={openAutoEditDialog}
                  sx={{
                    background: 'linear-gradient(135deg, #059669 0%, #0f766e 100%)',
                    color: 'white',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #047857 0%, #115e59 100%)',
                    },
                    minWidth: 120,
                  }}
                  startIcon={<AutoFixHighIcon />}
                >
                  Auto Edit
                </Button>
              </Tooltip>
              
              {/* Face Detection Worker */}
              <Tooltip title="Detect faces in all clips (background worker)">
                <Button
                  size="small"
                  onClick={handleFaceDetectionToggle}
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
                  <IconButton
                    onMouseEnter={preloadTransitionLibrary}
                    onFocus={preloadTransitionLibrary}
                    onClick={openTransitionLibrary}
                  >
                    <GridView fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Speed Ramp - Press R">
                  <IconButton
                    onMouseEnter={preloadSpeedRampPanel}
                    onFocus={preloadSpeedRampPanel}
                    onClick={toggleSpeedRampPanel}
                    color={showSpeedRampPanel ? 'primary' : 'default'}
                  >
                    <Speed fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Text Overlays - Press T">
                  <IconButton
                    onMouseEnter={preloadTextOverlayPanel}
                    onFocus={preloadTextOverlayPanel}
                    onClick={openTextOverlayPanel}
                  >
                    <TextFields fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="GPU Filters - Press F">
                  <IconButton
                    onMouseEnter={preloadGPUAndBackgroundPanels}
                    onFocus={preloadGPUFiltersPanel}
                    onClick={openGPUFiltersPanel}
                  >
                    <FilterVintage fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Color Grading - Press C">
                  <IconButton
                    onMouseEnter={preloadColorGradingPanel}
                    onFocus={preloadColorGradingPanel}
                    onClick={openColorGradingPanel}
                  >
                    <Palette fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Auto-Captions (80+ languages)">
                  <IconButton
                    onMouseEnter={preloadAutoCaptionsPanel}
                    onFocus={preloadAutoCaptionsPanel}
                    onClick={openAutoCaptionsPanel}
                    aria-label="Open auto captions"
                    data-testid="open-auto-captions"
                  >
                    <Subtitles fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Beat Sync">
                  <IconButton
                    onMouseEnter={preloadBeatSyncPanel}
                    onFocus={preloadBeatSyncPanel}
                    onClick={openBeatSyncPanel}
                  >
                    <MusicNote fontSize="small" />
                  </IconButton>
                </Tooltip>
                {ENABLE_EXPERIMENTAL_TIMELINE_PANELS && (
                  <Tooltip title="Motion Tracking (SAM 2 AI)">
                    <IconButton
                      onMouseEnter={preloadMotionAndObjectPanels}
                      onFocus={preloadMotionTrackingPanel}
                      onClick={openMotionTrackingPanel}
                    >
                      <GpsFixed fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="Detect Scenes">
                  <IconButton 
                    onClick={runSceneDetection}
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
                    onMouseEnter={preloadExportDialog}
                    onFocus={preloadExportDialog}
                    onClick={openExportDialog}
                  >
                    <FileDownload fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Export to DaVinci Resolve + Scripts">
                  <Button
                    size="small"
                    onMouseEnter={preloadDaVinciResolveExportDialog}
                    onFocus={preloadDaVinciResolveExportDialog}
                    onClick={openResolveExportDialog}
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
                  <IconButton size="small" onClick={openSettingsDialog}>
                    <Settings fontSize="small" />
                  </IconButton>
                </Tooltip>
              </ButtonGroup>

              {/* Pro toggles */}
              <Button size="small" variant={magneticEnabled ? 'contained' : 'outlined'} onClick={toggleMagneticMode}>Magnetic</Button>
              <Button size="small" variant={rippleEnabled ? 'contained' : 'outlined'} onClick={toggleRippleMode}>Ripple</Button>
              <Button size="small" variant={reviewerMode ? 'contained' : 'outlined'} onClick={toggleReviewerMode}>{reviewerMode ? 'Reviewer: ON' : 'Reviewer: OFF'}</Button>
              <Button size="small" variant={compareMode ? 'contained' : 'outlined'} onClick={toggleCompareMode}>{compareMode ? 'Compare: ON' : 'Compare: OFF'}</Button>
              <Button size="small" onClick={addMarkerAtPlayhead}>Add Marker</Button>
              <Button size="small" variant="outlined" onClick={undoLastAutoEdit} disabled={!lastAutoEditSnapshot}>
                Undo Auto Edit
              </Button>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="caption" color="text.secondary">V-Zoom</Typography>
                <Slider
                  size="small"
                  value={trackHeightScale}
                  min={0.5}
                  max={2}
                  step={0.1}
                  sx={{ width: 100 }}
                  onChange={handleTrackHeightScaleChange}
                />
              </Stack>
              {pendingTransitionType && (
                <Stack direction="row" spacing={0.75}>
                  <Button size="small" variant="outlined" onClick={placePendingTransitionAtNearestCut}>
                    Place {pendingTransitionType} ({pendingTransitionEngine.toUpperCase()} • {pendingTransitionDuration.toFixed(2)}s)
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => placePendingTransitionOnSelectedClip('out')}
                    disabled={!selectedPrimaryClip}
                  >
                    Apply To Selected Clip
                  </Button>
                </Stack>
              )}
            </Stack>
        </StoryArcTopBar>

        {autoEditPreview && (
          <Box sx={{ px: 2, py: 1 }}>
            <Alert
              severity="info"
              action={(
                <Stack direction="row" spacing={1}>
                  <Button size="small" variant="outlined" onClick={runAutoEdit}>
                    Regenerate
                  </Button>
                  <Button size="small" variant="contained" onClick={acceptAutoEditPreview}>
                    Apply
                  </Button>
                  <Button size="small" variant="outlined" onClick={rejectAutoEditPreview}>
                    Revert
                  </Button>
                </Stack>
              )}
            >
              <Stack spacing={0.5}>
                <Typography variant="body2">
                  Auto Edit preview active: {autoEditPreview.proposal.preset} • {autoEditPreview.selectedVariant} • {autoEditPreview.proposal.estimatedDurationSeconds.toFixed(1)}s • {(autoEditPreview.proposal.confidence * 100).toFixed(0)}% confidence
                </Typography>
                <Stack direction="row" spacing={0.75} flexWrap="wrap">
                  {(['safe', 'balanced', 'bold'] as AutoEditVariant[]).map((variant) => (
                    <Button
                      key={variant}
                      size="small"
                      variant={autoEditPreview.selectedVariant === variant ? 'contained' : 'outlined'}
                      onClick={() => previewAutoEditVariant(variant)}
                    >
                      {variant}
                    </Button>
                  ))}
                </Stack>
                {autoEditPreview.proposal.summary.slice(0, 3).map((line) => (
                  <Typography key={line} variant="caption" color="text.secondary">
                    {line}
                  </Typography>
                ))}
                <Stack spacing={0.75} sx={{ pt: 0.5 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>
                    Narrative Explainability
                  </Typography>
                  {autoEditPreview.proposal.selectedClipIds.slice(0, 5).map((clipId) => {
                    const clip = autoEditPreview.proposal.clips.find((candidate) => candidate.id === clipId);
                    if (!clip) {
                      return null;
                    }
                    const explainability = autoEditPreview.proposal.clipExplainabilityById[clipId];
                    const feedback = getAutoEditClipFeedback(clip);
                    return (
                      <Card key={clipId} variant="outlined" sx={{ px: 1, py: 0.75 }}>
                        <Stack spacing={0.5}>
                          <Typography variant="caption" fontWeight={600}>
                            {clip.name || clip.id}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Goal {(explainability?.goalMatch ?? 0).toFixed(2)} • Emotion {(explainability?.emotion ?? 0).toFixed(2)} • Beat {explainability?.beat?.beat || 'n/a'} • Face {(explainability?.faceConfidence ?? 0).toFixed(2)} • Audio {(explainability?.audioConfidence ?? 0).toFixed(2)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Narrative: Coverage {(explainability?.narrative?.transcriptCoverage ?? 0).toFixed(2)} • Connectors {explainability?.narrative?.connectorHits ?? 0} • Impact {explainability?.narrative?.impactPhraseHits ?? 0} • Filler {explainability?.narrative?.fillerHits ?? 0}
                          </Typography>
                          <Box
                            sx={{
                              px: 1,
                              py: 0.75,
                              borderRadius: 1,
                              bgcolor: 'background.default',
                              border: 1,
                              borderColor: 'divider',
                            }}
                          >
                            <Typography variant="caption" sx={{ fontWeight: 600 }}>
                              Narrative Explainability
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                              {explainability?.narrative?.transcriptExcerpt || 'No aligned transcript excerpt for this clip.'}
                            </Typography>
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            {(explainability?.reasons || ['Selected by ranking signals.']).slice(0, 2).join(' ')}
                          </Typography>
                          <Stack direction="row" spacing={0.5}>
                            <Button
                              size="small"
                              variant={feedback === 'approved' ? 'contained' : 'outlined'}
                              color="success"
                              onClick={() => setAutoEditClipFeedback(clipId, 'approved')}
                            >
                              Approve
                            </Button>
                            <Button
                              size="small"
                              variant={feedback === 'rejected' ? 'contained' : 'outlined'}
                              color="error"
                              onClick={() => setAutoEditClipFeedback(clipId, 'rejected')}
                            >
                              Reject
                            </Button>
                            <Button
                              size="small"
                              variant="text"
                              onClick={() => setAutoEditClipFeedback(clipId, null)}
                            >
                              Clear
                            </Button>
                          </Stack>
                        </Stack>
                      </Card>
                    );
                  })}
                </Stack>
              </Stack>
            </Alert>
          </Box>
        )}

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

        {/* Workflow Navigator */}
        <Paper
          data-testid="workflow-toolbar"
          elevation={0}
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            px: 2,
            py: 1,
            bgcolor: 'background.paper',
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Typography variant="subtitle2" fontWeight={700}>
              Workflow
            </Typography>
            <ButtonGroup size="small" variant="outlined">
              {RESOLVE_WORKFLOW_STEPS.map((step) => (
                <Button
                  key={`workflow-step-${step.id}`}
                  size="small"
                  data-workflow-step={step.id}
                  variant={workflowStep === step.id ? 'contained' : 'outlined'}
                  onClick={handleWorkflowStepButtonClick}
                >
                  {step.label}
                </Button>
              ))}
            </ButtonGroup>
            <Chip
              size="small"
              color="primary"
              variant="outlined"
              label={`Now: ${activeWorkflowConfig.label}`}
            />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {activeWorkflowConfig.hint}
            </Typography>
          </Stack>
        </Paper>

        {/* Workspace Toolbar (single contextual toolbar) */}
        <Paper
          data-testid="workspace-top-toolbar"
          elevation={0}
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            px: 2,
            py: 1,
            bgcolor: 'background.paper',
          }}
        >
          <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap">
            <Typography variant="subtitle2" fontWeight={700}>
              Workspace
            </Typography>
            <Chip
              size="small"
              color="primary"
              variant="outlined"
              label={`Active: ${workspacePreset.toUpperCase()}`}
            />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Switch workspace from the Arc menu below timeline
            </Typography>
            <Divider orientation="vertical" flexItem />

            <ButtonGroup size="small" variant="outlined">
              <Button
                size="small"
                variant={showAssetPanel ? 'contained' : 'outlined'}
                onClick={toggleAssetPanel}
              >
                Bin
              </Button>
              <Button
                size="small"
                variant={showInspectorPanel ? 'contained' : 'outlined'}
                onClick={toggleInspectorPanel}
              >
                Inspector
              </Button>
              <Button
                size="small"
                variant={showEffectsPanel ? 'contained' : 'outlined'}
                onClick={toggleEffectsPanel}
              >
                Effects
              </Button>
              <Button
                size="small"
                variant={showMixerPanel ? 'contained' : 'outlined'}
                onClick={toggleMixerPanel}
              >
                Mixer
              </Button>
              <Button
                size="small"
                variant={showProgramMonitor ? 'contained' : 'outlined'}
                onClick={toggleProgramMonitorPanel}
              >
                Monitors
              </Button>
            </ButtonGroup>

            {(isCutWorkspace || isEditWorkspace) && (
              <>
                <Divider orientation="vertical" flexItem />
                <Chip
                  size="small"
                  variant="outlined"
                  color="primary"
                  label="Timeline tools available in the Edit Bar below"
                />
              </>
            )}

            {isColorWorkspace && (
              <>
                <Divider orientation="vertical" flexItem />
                <ButtonGroup size="small" variant="outlined">
                  <Button
                    size="small"
                    onMouseEnter={preloadTransitionLibrary}
                    onFocus={preloadTransitionLibrary}
                    onClick={openTransitionLibrary}
                  >
                    Transitions
                  </Button>
                  <Button
                    size="small"
                    onMouseEnter={preloadTextOverlayPanel}
                    onFocus={preloadTextOverlayPanel}
                    onClick={openTextOverlayPanel}
                  >
                    Text
                  </Button>
                  <Button
                    size="small"
                    onMouseEnter={preloadGPUFiltersPanel}
                    onFocus={preloadGPUFiltersPanel}
                    onClick={openGPUFiltersPanel}
                  >
                    GPU Filters
                  </Button>
                  <Button
                    size="small"
                    onMouseEnter={preloadColorGradingPanel}
                    onFocus={preloadColorGradingPanel}
                    onClick={openColorGradingPanel}
                  >
                    Grading
                  </Button>
                  <Button
                    size="small"
                    onMouseEnter={preloadLUTLibrary}
                    onFocus={preloadLUTLibrary}
                    onClick={openLUTLibraryDialog}
                  >
                    LUTs
                  </Button>
                </ButtonGroup>
                <Chip
                  size="small"
                  color={selectedLUTName ? 'success' : 'default'}
                  label={`Grade: ${selectedLUTName || 'Manual/None'}`}
                />
              </>
            )}

            {isFairlightWorkspace && (
              <>
                <Divider orientation="vertical" flexItem />
                <ButtonGroup size="small" variant="outlined">
                  <Button size="small" onClick={groupAudioTracksByRole}>
                    Group Lanes
                  </Button>
                  <Button size="small" onClick={clearAudioRoleAutomation}>
                    Clear Roles
                  </Button>
                  <Button
                    size="small"
                    onClick={openAIAudioMixAssistant}
                  >
                    AI Mix
                  </Button>
                  <Button
                    size="small"
                    onMouseEnter={preloadAutoCaptionsPanel}
                    onFocus={preloadAutoCaptionsPanel}
                    onClick={openAutoCaptionsPanel}
                  >
                    Auto Captions
                  </Button>
                </ButtonGroup>
                <Chip
                  size="small"
                  color={audioMeterLevel > 0.8 ? 'error' : audioMeterLevel > 0.4 ? 'warning' : 'success'}
                  label={`Meter ${Math.round(audioMeterLevel * 100)}%`}
                />
              </>
            )}

            {isDeliverWorkspace && (
              <>
                <Divider orientation="vertical" flexItem />
                <ButtonGroup size="small" variant="outlined">
                  <Button
                    size="small"
                    variant="contained"
                    onMouseEnter={preloadExportDialog}
                    onFocus={preloadExportDialog}
                    onClick={openExportDialog}
                  >
                    Quick Export
                  </Button>
                  <Button
                    size="small"
                    onMouseEnter={preloadDaVinciResolveExportDialog}
                    onFocus={preloadDaVinciResolveExportDialog}
                    onClick={openResolveExportDialog}
                  >
                    DaVinci Export
                  </Button>
                  <Button
                    size="small"
                    onMouseEnter={preloadHLSImportDialog}
                    onFocus={preloadHLSImportDialog}
                    onClick={openHLSImportDialog}
                  >
                    Stream Export/Import
                  </Button>
                </ButtonGroup>
                {captionsExport && (
                  <ButtonGroup size="small" variant="outlined">
                    <Button size="small" onClick={downloadCaptionsSrt}>
                      SRT
                    </Button>
                    <Button size="small" onClick={downloadCaptionsVtt}>
                      VTT
                    </Button>
                  </ButtonGroup>
                )}
              </>
            )}

            <Box sx={{ flexGrow: 1 }} />

            <Chip
              size="small"
              color="info"
              variant="outlined"
              label={`Dock bank: ${workspacePreset.toUpperCase()}`}
            />
            <ButtonGroup size="small" variant="outlined">
              <Button size="small" onClick={loadDockSlot1}>
                Dock 1
              </Button>
              <Button size="small" onClick={loadDockSlot2}>
                Dock 2
              </Button>
              <Button size="small" onClick={loadDockSlot3}>
                Dock 3
              </Button>
            </ButtonGroup>
            <ButtonGroup size="small" variant="outlined">
              <Button size="small" onClick={saveDockSlot1}>
                Save 1
              </Button>
              <Button size="small" onClick={saveDockSlot2}>
                Save 2
              </Button>
              <Button size="small" onClick={saveDockSlot3}>
                Save 3
              </Button>
              <Button size="small" color="warning" onClick={resetResolveLayout}>
                Reset
              </Button>
            </ButtonGroup>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Chip
                size="small"
                color={currentWorkspaceDockSlots['dock-1'] ? 'success' : 'default'}
                variant={currentWorkspaceDockSlots['dock-1'] ? 'filled' : 'outlined'}
                label="1"
              />
              <Chip
                size="small"
                color={currentWorkspaceDockSlots['dock-2'] ? 'success' : 'default'}
                variant={currentWorkspaceDockSlots['dock-2'] ? 'filled' : 'outlined'}
                label="2"
              />
              <Chip
                size="small"
                color={currentWorkspaceDockSlots['dock-3'] ? 'success' : 'default'}
                variant={currentWorkspaceDockSlots['dock-3'] ? 'filled' : 'outlined'}
                label="3"
              />
            </Stack>

            <Box
              sx={{
                px: 1.25,
                py: 0.35,
                bgcolor: 'rgba(0,0,0,0.3)',
                borderRadius: 1,
                border: '1px solid rgba(255,255,255,0.1)',
                fontFamily: 'monospace',
              }}
            >
              <Typography variant="caption" sx={{ color: 'text.primary', fontSize: 12 }}>
                {formatTimecode(currentTime)} / {formatTimecode(totalDuration)}
              </Typography>
            </Box>
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
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip
                      size="small"
                      variant={autoMonitorEnabled ? 'filled' : 'outlined'}
                      color={autoMonitorEnabled ? 'success' : 'default'}
                      label={autoMonitorEnabled ? 'Monitoring On' : 'Monitoring Off'}
                    />
                    <Button
                      size="small"
                      variant={showAutoMonitor ? 'contained' : 'outlined'}
                      onClick={toggleAutoMonitorPanel}
                      sx={{ minWidth: 120 }}
                    >
                      {showAutoMonitor ? 'Hide Monitor' : 'Auto Monitor'}
                    </Button>
                  </Stack>
                </Box>

                {showAutoMonitor && (
                  <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', maxHeight: '45%', overflowY: 'auto' }}>
                    <StoryArcAutoMonitor
                      userId={currentUser?.id || 'guest'}
                      onStatusChange={handleAutoMonitorStatusChange}
                    />
                  </Box>
                )}

                <Box sx={{ flex: 1, minHeight: 0 }}>
                  <AssetBrowser
                    height="100%"
                    storyArcId={storyArcId}
                    onMediaSelect={handleAssetBrowserMediaSelect}
                    onTimelineInit={handleAssetBrowserTimelineInit}
                    onTemplateSelect={handleAssetBrowserTemplateSelect}
                    onSnippetDrag={handleAssetBrowserSnippetDrag}
                    onSnippetInsert={handleAssetBrowserSnippetInsert}
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
            <StoryArcMonitorSection>
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
                    onClick={setMonitorFitToFit}
                    variant={monitorFitMode === 'fit' ? 'contained' : 'outlined'}
                  >
                    Fit
                  </Button>
                  <Button
                    onClick={setMonitorFitToFill}
                    variant={monitorFitMode === 'fill' ? 'contained' : 'outlined'}
                  >
                    Fill
                  </Button>
                </ButtonGroup>
                <Button
                  size="small"
                  variant={multicamEnabled ? 'contained' : 'outlined'}
                  onClick={toggleMulticamMode}
                >
                  Multicam
                </Button>
                <Button
                  data-testid="monitor-guides-toggle"
                  size="small"
                  variant={showCompositionGuides ? 'contained' : 'outlined'}
                  onClick={toggleCompositionGuidesVisibility}
                >
                  Guides (G)
                </Button>
                <Tooltip title="Composition guide settings (Shift+G)">
                  <IconButton
                    data-testid="monitor-guides-settings"
                    size="small"
                    onClick={openCompositionGuideSettingsDialog}
                  >
                    <Settings fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={toggleProgramMonitorPanel}
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
                      onMouseDown={sourceMonitorPanelHandlers.onMouseDown}
                      onFocus={sourceMonitorPanelHandlers.onFocus}
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
                              opacity: programMonitorOpacity,
                            }}
                            onLoadedMetadata={sourceVideoHandlers.onLoadedMetadata}
                            onTimeUpdate={sourceVideoHandlers.onTimeUpdate}
                            onPlay={sourceVideoHandlers.onPlay}
                            onPause={sourceVideoHandlers.onPause}
                            onError={sourceVideoHandlers.onError}
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
                          onClick={markSourceInAtCurrentTime}
                        >
                          Mark In
                        </Button>
                        <Button
                          data-testid="source-mark-out-button"
                          size="small"
                          variant="outlined"
                          onClick={markSourceOutAtCurrentTime}
                        >
                          Mark Out
                        </Button>
                        <Tooltip title="Go To Source Mark In">
                          <IconButton size="small" onClick={jumpToSourceMarkIn} disabled={sourceMarkIn === null}>
                            <SkipPrevious fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Go To Source Mark Out">
                          <IconButton size="small" onClick={jumpToSourceMarkOut} disabled={sourceMarkOut === null}>
                            <SkipNext fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Clear Source Marks">
                          <IconButton
                            data-testid="source-clear-marks-button"
                            size="small"
                            onClick={clearSourceMarks}
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
                        <FormControl size="small" sx={{ minWidth: 120 }}>
                          <InputLabel id="source-video-target-label">V Target</InputLabel>
                          <Select
                            labelId="source-video-target-label"
                            data-testid="source-video-target-select"
                            label="V Target"
                            value={sourcePatchVideoTrackId ?? ''}
                            onChange={sourcePatchHandlers.onVideoTrackChange}
                          >
                            {sourcePatchVideoTrackOptions.map((track) => (
                              <MenuItem key={`source-video-target-${track.id}`} value={track.id}>
                                {track.name}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <FormControl
                          size="small"
                          sx={{ minWidth: 120 }}
                          disabled={sourcePatchAudioTrackOptions.length === 0}
                        >
                          <InputLabel id="source-audio-target-label">A Target</InputLabel>
                          <Select
                            labelId="source-audio-target-label"
                            data-testid="source-audio-target-select"
                            label="A Target"
                            value={sourcePatchAudioTrackId ?? ''}
                            onChange={sourcePatchHandlers.onAudioTrackChange}
                          >
                            {sourcePatchAudioTrackOptions.map((track) => (
                              <MenuItem key={`source-audio-target-${track.id}`} value={track.id}>
                                {track.name}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <FormControlLabel
                          sx={{ ml: 0.5 }}
                          control={
                            <Switch
                              size="small"
                              checked={sourcePatchIncludeAudio && sourcePatchAudioTrackOptions.length > 0}
                              onChange={sourcePatchHandlers.onIncludeAudioChange}
                              disabled={sourcePatchAudioTrackOptions.length === 0}
                              inputProps={withDataInputProps({ 'data-testid': 'source-include-audio-toggle' })}
                            />
                          }
                          label="Linked A/V"
                        />
                        <Box sx={{ flex: 1 }} />
                        <Button
                          data-testid="source-insert-button"
                          size="small"
                          variant="contained"
                          onClick={insertSourceClip}
                          disabled={!sourcePreviewClip?.sourceFile}
                        >
                          Insert (F9)
                        </Button>
                        <Button
                          data-testid="source-overwrite-button"
                          size="small"
                          variant="contained"
                          color="secondary"
                          onClick={overwriteSourceClip}
                          disabled={!sourcePreviewClip?.sourceFile}
                        >
                          Overwrite (F10)
                        </Button>
                      </Stack>
                    </Box>

                    <Box
                      data-testid="program-monitor-panel"
                      tabIndex={0}
                      onMouseDown={programMonitorPanelHandlers.onMouseDown}
                      onFocus={programMonitorPanelHandlers.onFocus}
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
                            onLoadedMetadata={programVideoHandlers.onLoadedMetadata}
                            onError={programVideoHandlers.onError}
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
                            {missingVideoSourceClipCount > 0 && (
                              <Chip
                                size="small"
                                color="warning"
                                variant="outlined"
                                label={`${missingVideoSourceClipCount} clip${missingVideoSourceClipCount === 1 ? '' : 's'} missing source`}
                              />
                            )}
                            <Stack direction="row" spacing={1}>
                              <Button
                                size="small"
                                variant="contained"
                                color="primary"
                                onClick={autoBindMissingVideoSources}
                                disabled={!primaryAutoBindSource}
                                data-testid="program-monitor-auto-bind-button"
                              >
                                Auto-bind Missing Clips
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                color="inherit"
                                onClick={jumpToFirstTimelineVideoClip}
                                data-testid="program-monitor-jump-first-clip-button"
                              >
                                Jump to First Clip
                              </Button>
                            </Stack>
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
                          onClick={markProgramInAtCurrentTime}
                        >
                          Mark In
                        </Button>
                        <Button
                          data-testid="program-mark-out-button"
                          size="small"
                          variant="outlined"
                          onClick={markProgramOutAtCurrentTime}
                        >
                          Mark Out
                        </Button>
                        <Tooltip title="Go To Mark In">
                          <IconButton
                            data-testid="program-jump-mark-in-button"
                            size="small"
                            onClick={jumpToProgramMarkIn}
                            disabled={programMarkIn === null}
                          >
                            <SkipPrevious fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Go To Mark Out">
                          <IconButton
                            data-testid="program-jump-mark-out-button"
                            size="small"
                            onClick={jumpToProgramMarkOut}
                            disabled={programMarkOut === null}
                          >
                            <SkipNext fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Clear Program Marks">
                          <IconButton
                            data-testid="program-clear-marks-button"
                            size="small"
                            onClick={clearProgramMarks}
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
                              onChange={handleMulticamApplyToTimelineChange}
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
                            data-candidate-clip-id={candidate.clip.id}
                            onClick={handleApplyMulticamAngleClick}
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
            </StoryArcMonitorSection>

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
                  <Button
                    size="small"
                    variant="outlined"
                    onMouseEnter={preloadTransitionLibrary}
                    onFocus={preloadTransitionLibrary}
                    onClick={openTransitionLibrary}
                  >
                    Transition Lib
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onMouseEnter={preloadTextOverlayPanel}
                    onFocus={preloadTextOverlayPanel}
                    onClick={openTextOverlayPanel}
                  >
                    Text
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onMouseEnter={preloadGPUFiltersPanel}
                    onFocus={preloadGPUFiltersPanel}
                    onClick={openGPUFiltersPanel}
                  >
                    Filters
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onMouseEnter={preloadColorGradingPanel}
                    onFocus={preloadColorGradingPanel}
                    onClick={openColorGradingPanel}
                  >
                    Color
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onMouseEnter={preloadLUTLibrary}
                    onFocus={preloadLUTLibrary}
                    onClick={openLUTLibraryDialog}
                  >
                    LUTs
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onMouseEnter={preloadHLSImportDialog}
                    onFocus={preloadHLSImportDialog}
                    onClick={openHLSImportDialog}
                  >
                    Stream Import
                  </Button>
                  {captionsExport && (
                    <>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={downloadCaptionsSrt}
                      >
                        Download SRT
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={downloadCaptionsVtt}
                      >
                        Download VTT
                      </Button>
                      <IconButton
                        size="small"
                        onClick={clearCaptionsPackage}
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
                  <Button size="small" variant="outlined" onClick={groupAudioTracksByRole}>
                    Group Lanes
                  </Button>
                  <Button size="small" variant="outlined" onClick={clearAudioRoleAutomation}>
                    Clear Role Ops
                  </Button>
                  <FormControl size="small" sx={{ minWidth: 170 }}>
                    <InputLabel id="audio-role-focus-label">Role Focus</InputLabel>
                    <Select
                      labelId="audio-role-focus-label"
                      value={audioRoleFocus}
                      label="Role Focus"
                      onChange={handleAudioRoleFocusChange}
                    >
                      <MenuItem value="all">All Roles</MenuItem>
                      {AUDIO_TRACK_ROLE_OPTIONS.map((option) => (
                        <MenuItem key={`audio-role-focus-${option.value}`} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  {AUDIO_TRACK_ROLE_OPTIONS.map((roleOption) => {
                    const roleCount = mixerAudioTracks.filter(
                      (track) => resolveAudioRoleForTrackId(track.id) === roleOption.value
                    ).length;
                    return (
                      <Stack key={`audio-role-chip-${roleOption.value}`} direction="row" spacing={0.5} alignItems="center">
                        <Chip
                          size="small"
                          variant={audioRoleFocus === roleOption.value ? 'filled' : 'outlined'}
                          color={audioRoleFocus === roleOption.value ? 'primary' : 'default'}
                          label={`${roleOption.label} (${roleCount})`}
                          data-audio-role={roleOption.value}
                          onClick={handleAudioRoleChipFocusClick}
                        />
                        <Chip
                          size="small"
                          color={audioRoleMuteState[roleOption.value] ? 'warning' : 'default'}
                          variant={audioRoleMuteState[roleOption.value] ? 'filled' : 'outlined'}
                          label="M"
                          data-audio-role={roleOption.value}
                          onClick={handleAudioRoleMuteChipClick}
                        />
                        <Chip
                          size="small"
                          color={audioRoleSoloState[roleOption.value] ? 'success' : 'default'}
                          variant={audioRoleSoloState[roleOption.value] ? 'filled' : 'outlined'}
                          label="S"
                          data-audio-role={roleOption.value}
                          onClick={handleAudioRoleSoloChipClick}
                        />
                      </Stack>
                    );
                  })}
                  {mixerAudioTracksSorted.map((track) => {
                      const role = resolveAudioRoleForTrackId(track.id);
                      const trackVolume = clips
                        .filter((clip) => clip.trackId === track.id)
                        .map((clip) => (typeof clip.metadata?.volume === 'number' ? clip.metadata.volume : 1));
                      const avgVolume =
                        trackVolume.length > 0
                          ? trackVolume.reduce((sum, value) => sum + value, 0) / trackVolume.length
                          : 1;
                      const isRoleFocused = audioRoleFocus === 'all' || role === audioRoleFocus;
                      const trackAudible = isAudioTrackAudible(track.id);
                      return (
                        <Stack
                          key={track.id}
                          direction="row"
                          spacing={0.5}
                          alignItems="center"
                          sx={{ opacity: isRoleFocused ? 1 : 0.55 }}
                        >
                          <Typography variant="caption" sx={{ minWidth: 52 }}>
                            {track.name}
                          </Typography>
                          <Chip
                            size="small"
                            label={audioRoleLabelByValue[role]}
                            color={trackAudible ? 'success' : 'default'}
                            variant={trackAudible ? 'filled' : 'outlined'}
                          />
                          <Slider
                            size="small"
                            data-track-id={track.id}
                            value={avgVolume}
                            min={0}
                            max={2}
                            step={0.05}
                            sx={{ width: 120 }}
                            onChange={handleMixerTrackVolumeChange}
                          />
                          <Button size="small" data-track-id={track.id} onClick={handleOpenMixerTrackButtonClick}>
                            Mixer
                          </Button>
                          <Button size="small" data-track-id={track.id} onClick={handleOpenAIAssistantTrackButtonClick}>
                            AI
                          </Button>
                        </Stack>
                      );
                    })}
                </Stack>
              </Paper>
            )}

            {(isCutWorkspace || isEditWorkspace) && (
              <Paper
                data-testid="timeline-edit-toolbar"
                elevation={0}
                sx={{
                  borderBottom: 1,
                  borderColor: 'divider',
                  px: 1.25,
                  py: 0.9,
                  bgcolor: 'background.paper',
                  flexShrink: 0,
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Typography variant="subtitle2" fontWeight={700}>
                    {isCutWorkspace ? 'Cut Bar' : 'Edit Bar'}
                  </Typography>
                  <ButtonGroup size="small" variant="outlined">
                    <Button
                      size="small"
                      startIcon={<GpsFixed fontSize="small" />}
                      aria-label="Select (A)"
                      variant={editTool === 'select' ? 'contained' : 'outlined'}
                      onClick={activateSelectTool}
                    >
                      Select (A)
                    </Button>
                    <Button
                      size="small"
                      startIcon={<ContentCut fontSize="small" />}
                      aria-label="Trim (T)"
                      variant={editTool === 'trim' ? 'contained' : 'outlined'}
                      onClick={activateTrimTool}
                    >
                      Trim (T)
                    </Button>
                    <Button
                      size="small"
                      startIcon={<Sync fontSize="small" />}
                      aria-label="Roll (R)"
                      variant={editTool === 'roll' ? 'contained' : 'outlined'}
                      onClick={activateRollTool}
                    >
                      Roll (R)
                    </Button>
                    <Button
                      size="small"
                      startIcon={<KeyboardArrowLeft fontSize="small" />}
                      aria-label="Slip (Y)"
                      variant={editTool === 'slip' ? 'contained' : 'outlined'}
                      onClick={activateSlipTool}
                    >
                      Slip (Y)
                    </Button>
                    <Button
                      size="small"
                      startIcon={<KeyboardArrowRight fontSize="small" />}
                      aria-label="Slide (U)"
                      variant={editTool === 'slide' ? 'contained' : 'outlined'}
                      onClick={activateSlideTool}
                    >
                      Slide (U)
                    </Button>
                  </ButtonGroup>

                  <ButtonGroup size="small" variant="outlined">
                    <Button
                      size="small"
                      data-testid="safe-trim-toggle-button"
                      aria-label="Toggle safe trim mode"
                      variant={safeTrimMode ? 'contained' : 'outlined'}
                      color={safeTrimMode ? 'success' : 'inherit'}
                      onClick={toggleSafeTrimMode}
                    >
                      Safe Trim
                    </Button>
                    <Button
                      size="small"
                      aria-label="Toggle magnetic mode"
                      variant={magneticEnabled ? 'contained' : 'outlined'}
                      onClick={toggleMagneticMode}
                    >
                      Magnetic
                    </Button>
                    <Button
                      size="small"
                      aria-label="Toggle ripple mode"
                      variant={rippleEnabled ? 'contained' : 'outlined'}
                      onClick={toggleRippleMode}
                    >
                      Ripple
                    </Button>
                  </ButtonGroup>

                  <ButtonGroup size="small">
                    <Tooltip title="Undo (Ctrl+Z)">
                      <IconButton
                        size="small"
                        aria-label="Undo (Ctrl+Z)"
                        onClick={performUndo}
                        disabled={undoStack.length === 0}
                      >
                        <Undo fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Redo (Ctrl+Y)">
                      <IconButton
                        size="small"
                        aria-label="Redo (Ctrl+Y)"
                        onClick={performRedo}
                        disabled={redoStack.length === 0}
                      >
                        <Redo fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Cut (Ctrl+X)">
                      <IconButton
                        size="small"
                        aria-label="Cut selected clips (Ctrl+X)"
                        onClick={cutSelectedClips}
                        disabled={selectedClips.size === 0}
                      >
                        <ContentCut fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Copy (Ctrl+C)">
                      <IconButton
                        size="small"
                        aria-label="Copy selected clips (Ctrl+C)"
                        onClick={copySelectedClips}
                        disabled={selectedClips.size === 0}
                      >
                        <ContentCopy fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Paste (Ctrl+V)">
                      <IconButton
                        size="small"
                        aria-label="Paste clips (Ctrl+V)"
                        onClick={pasteClipboardClips}
                        disabled={clipClipboard.length === 0}
                      >
                        <ContentPaste fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </ButtonGroup>

                  <ButtonGroup size="small" variant="outlined">
                    <Button
                      size="small"
                      data-testid="select-playhead-clip-button"
                      startIcon={<GpsFixed fontSize="small" />}
                      aria-label="Select clip at playhead (D)"
                      onClick={selectClipUnderPlayhead}
                    >
                      Select @Playhead (D)
                    </Button>
                    <Button
                      size="small"
                      data-testid="razor-selected-button"
                      startIcon={<ContentCut fontSize="small" />}
                      aria-label="Razor selected clips at playhead (C)"
                      onClick={razorSelectedAtPlayhead}
                      disabled={selectedClips.size === 0}
                    >
                      Razor (C)
                    </Button>
                    <Button
                      size="small"
                      data-testid="lift-selected-button"
                      aria-label="Lift selected clips"
                      onClick={liftSelectedClips}
                      disabled={selectedClips.size === 0}
                    >
                      Lift (;)
                    </Button>
                    <Button
                      size="small"
                      data-testid="extract-selected-button"
                      aria-label="Extract selected clips"
                      onClick={extractSelectedClips}
                      disabled={selectedClips.size === 0}
                    >
                      Extract (')
                    </Button>
                  </ButtonGroup>

                  <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 220 }}>
                    <Tooltip title="Zoom Out Timeline (- or Shift+ArrowDown)">
                      <IconButton
                        data-testid="timeline-zoom-out-button"
                        size="small"
                        aria-label="Zoom out timeline"
                        onClick={zoomOutTimeline}
                      >
                        <ZoomOut fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Slider
                      data-testid="timeline-zoom-slider"
                      aria-label="Timeline zoom level"
                      value={timelineZoom}
                      onChange={handleZoomChange}
                      min={MIN_TIMELINE_ZOOM}
                      max={MAX_TIMELINE_ZOOM}
                      step={0.1}
                      size="small"
                      sx={{ mx: 0.5, width: 110 }}
                    />
                    <Tooltip title="Zoom In Timeline (+ or Shift+ArrowUp)">
                      <IconButton
                        data-testid="timeline-zoom-in-button"
                        size="small"
                        aria-label="Zoom in timeline"
                        onClick={zoomInTimeline}
                      >
                        <ZoomIn fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Typography
                      data-testid="timeline-zoom-value"
                      variant="caption"
                      sx={{ minWidth: 42, textAlign: 'center' }}
                    >
                      {Math.round(timelineZoom * 100)}%
                    </Typography>
                  </Stack>

                  <Box sx={{ flexGrow: 1 }} />
                  <Chip size="small" variant="outlined" label={`${selectedClips.size} selected`} />
                </Stack>
              </Paper>
            )}

            {isDeliverWorkspace ? (
              <Paper
                data-testid="deliver-workspace-panel"
                elevation={0}
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  p: 2,
                  bgcolor: 'background.paper',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.5,
                  minHeight: 320,
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Typography variant="h6" fontWeight={700}>
                    Deliver Page
                  </Typography>
                  <Chip size="small" color="primary" variant="outlined" label="Export & Final QC" />
                  <Chip size="small" variant="outlined" label={`Duration: ${formatTimecode(totalDuration)}`} />
                  <Chip size="small" variant="outlined" label={`Tracks: ${tracks.length}`} />
                  <Chip size="small" variant="outlined" label={`Clips: ${clips.length}`} />
                </Stack>
                <Alert severity="info">
                  Use this page for final checks, subtitle export, and rendering to delivery formats.
                </Alert>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Button
                    variant="contained"
                    onMouseEnter={preloadExportDialog}
                    onFocus={preloadExportDialog}
                    onClick={openExportDialog}
                  >
                    Quick Export
                  </Button>
                  <Button
                    variant="outlined"
                    onMouseEnter={preloadDaVinciResolveExportDialog}
                    onFocus={preloadDaVinciResolveExportDialog}
                    onClick={openResolveExportDialog}
                  >
                    DaVinci Resolve Export
                  </Button>
                  <Button
                    variant="outlined"
                    onMouseEnter={preloadHLSImportDialog}
                    onFocus={preloadHLSImportDialog}
                    onClick={openHLSImportDialog}
                  >
                    Stream Package
                  </Button>
                  <Button
                    variant="outlined"
                    onMouseEnter={preloadAutoCaptionsPanel}
                    onFocus={preloadAutoCaptionsPanel}
                    onClick={openAutoCaptionsPanel}
                  >
                    Generate Captions
                  </Button>
                </Stack>
                {captionsExport && (
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Button size="small" variant="outlined" onClick={downloadCaptionsSrt}>
                      Download SRT
                    </Button>
                    <Button size="small" variant="outlined" onClick={downloadCaptionsVtt}>
                      Download VTT
                    </Button>
                    <Button size="small" color="warning" onClick={clearCaptionsPackage}>
                      Clear Caption Package
                    </Button>
                  </Stack>
                )}
              </Paper>
            ) : (
              <StoryArcTimelineSection>
            <ProfessionalTimeline {...timelineProps} />

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
                <ProfessionalWaveform {...waveformProps} />
              </Paper>
            )}
              </StoryArcTimelineSection>
            )}

            <Box
              sx={{
                position: 'fixed',
                left: '50%',
                bottom: { xs: 8, md: 12 },
                transform: 'translateX(-50%)',
                zIndex: 1350,
                display: 'flex',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              <Paper
                data-testid="workspace-bottom-arc-nav"
                elevation={10}
                sx={{
                  position: 'relative',
                  px: 1.25,
                  py: 0.8,
                  borderRadius: '26px 26px 18px 18px',
                  border: '1px solid',
                  borderColor: 'rgba(255,255,255,0.14)',
                  bgcolor: 'rgba(11, 15, 24, 0.93)',
                  backdropFilter: 'blur(10px)',
                  overflow: 'visible',
                  pointerEvents: 'auto',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    left: '10%',
                    right: '10%',
                    top: -14,
                    height: 14,
                    borderRadius: '16px 16px 0 0',
                    background:
                      'linear-gradient(180deg, rgba(97,120,255,0.45) 0%, rgba(97,120,255,0.02) 100%)',
                    pointerEvents: 'none',
                  },
                }}
              >
                <Stack
                  direction="row"
                  spacing={{ xs: 1.1, sm: 1.5, md: 2.4 }}
                  alignItems="flex-end"
                  onMouseMove={handleWorkspaceDockMouseMove}
                  onMouseLeave={handleWorkspaceDockMouseLeave}
                >
                  {RESOLVE_WORKSPACE_ARC_NAV_ITEMS.map((workspaceNavItem, navIndex) => {
                    const isActive = workspacePreset === workspaceNavItem.preset;
                    const normalizedCenter =
                      (navIndex + 0.5) / RESOLVE_WORKSPACE_ARC_NAV_ITEMS.length;
                    const distance = workspaceDockPointerRatio === null
                      ? Number.POSITIVE_INFINITY
                      : Math.abs(workspaceDockPointerRatio - normalizedCenter);
                    const sigma = 0.17;
                    const gaussianWeight =
                      workspaceDockPointerRatio === null
                        ? 0
                        : Math.exp(-(distance * distance) / (2 * sigma * sigma));
                    const hoverScale = 1 + 0.22 * gaussianWeight;
                    const hoverLift = 9 * gaussianWeight;
                    const activeBoost = isActive ? 0.02 : 0;
                    const finalScale = Math.max(1, hoverScale + activeBoost);
                    const finalTranslateY = workspaceNavItem.arcOffset - hoverLift;

                    return (
                      <Button
                        key={`workspace-nav-${workspaceNavItem.preset}`}
                        data-testid={`workspace-nav-${workspaceNavItem.preset}`}
                        size="small"
                        data-workspace-preset={workspaceNavItem.preset}
                        onClick={handleWorkspaceNavClick}
                        variant={isActive ? 'contained' : 'outlined'}
                        sx={{
                          minWidth: { xs: 68, md: 82 },
                          px: 1.35,
                          mx: { xs: 0.12, sm: 0.24, md: 0.56 },
                          borderRadius: 999,
                          textTransform: 'none',
                          fontWeight: 700,
                          letterSpacing: 0.2,
                          transform: `translateY(${finalTranslateY}px) scale(${finalScale})`,
                          transformOrigin: 'center bottom',
                          transition:
                            'transform 90ms linear, background-color 110ms ease, border-color 110ms ease, box-shadow 110ms ease',
                          borderColor: isActive
                            ? 'rgba(133, 161, 255, 0.9)'
                            : 'rgba(255,255,255,0.22)',
                          bgcolor: isActive ? 'rgba(87, 114, 247, 0.95)' : 'rgba(20, 27, 40, 0.86)',
                          color: isActive ? '#fff' : 'rgba(235,239,255,0.92)',
                          boxShadow: isActive
                            ? '0 6px 22px rgba(64, 102, 255, 0.42)'
                            : '0 2px 8px rgba(0,0,0,0.28)',
                          '&:hover': {
                            borderColor: 'rgba(133, 161, 255, 0.95)',
                            bgcolor: isActive ? 'rgba(87, 114, 247, 1)' : 'rgba(39, 52, 77, 0.96)',
                          },
                        }}
                      >
                        {workspaceNavItem.label}
                      </Button>
                    );
                  })}
                </Stack>
              </Paper>
            </Box>
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
              <StoryArcSidePanel
                title="Inspector"
                width={panelSizes.rightPanel}
                borderSide="left"
              >
                <InspectorPanel {...inspectorProps} />
              </StoryArcSidePanel>
            </>
          )}
        </Box>

        {/* Onboarding Dialog */}
        <Dialog
          open={onboardingOpen}
          onClose={dismissOnboardingDialog}
          maxWidth="sm"
          fullWidth
        >
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
                            data-project-id={project.id}
                            variant="outlined"
                            sx={{
                              p: 1.5,
                              cursor: 'pointer','&:hover': { bgcolor: 'action.hover' }}}
                            onClick={handleConnectRecentProjectClick}
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
                      onClick={handleConnectCurrentProjectClick}
                    >
                      {ensuringMapping ? 'Connecting…' : 'Connect Current Project'}
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={openCreateProjectDialog}
                    >
                      New Project
                    </Button>
                    <Button size="small" onClick={advanceOnboardingStep}>Skip</Button>
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
                    <Button size="small" onClick={advanceOnboardingStep}>Next</Button>
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
                    <Button size="small" onClick={advanceOnboardingStep}>Next</Button>
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
                    <Button size="small" onClick={advanceOnboardingStep}>Next</Button>
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
                      onClick={prepareWorkerFeatures}
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
                        {Object.entries(workerInitStatus.workers).slice(0, 6).map(([key, worker]) => {
                          const runningState =
                            isRecord(worker) && typeof worker.status === 'string'
                              ? worker.status === 'running'
                              : false;
                          const isReady = worker.ready || runningState;
                          return (
                            <Box
                              key={key}
                              sx={{
                                p: 1.5,
                                borderRadius: 1,
                                bgcolor: isReady ? 'success.light' : 'action.hover',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1}}
                            >
                              {isReady ? (
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
                          );
                        })}
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
            <Button onClick={closeOnboardingDialog}>Close</Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={createProjectDialogOpen}
          onClose={closeCreateProjectDialog}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>Create New Project</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              fullWidth
              size="small"
              margin="dense"
              label="Project name"
              placeholder="Enter project name"
              value={newProjectName}
              onChange={updateNewProjectName}
              disabled={isCreatingProject}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={closeCreateProjectDialog} disabled={isCreatingProject}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={submitCreateProjectFromDialog}
              disabled={isCreatingProject || newProjectName.trim().length === 0}
            >
              {isCreatingProject ? 'Creating…' : 'Create'}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={showAutoEditDialog}
          onClose={closeAutoEditDialog}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Auto Edit Assistant</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <FormControl fullWidth size="small">
                <InputLabel id="auto-edit-intent-profile-label">Story Intent</InputLabel>
                <Select
                  labelId="auto-edit-intent-profile-label"
                  value={autoEditIntentProfileId}
                  label="Story Intent"
                  onChange={updateAutoEditIntentProfile}
                >
                  {storyIntentProfiles.map((profile) => (
                    <MenuItem key={profile.id} value={profile.id}>
                      {profile.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth size="small">
                <InputLabel id="auto-edit-variant-label">Alternative</InputLabel>
                <Select
                  labelId="auto-edit-variant-label"
                  value={autoEditOptions.variant}
                  label="Alternative"
                  onChange={updateAutoEditVariant}
                >
                  <MenuItem value="safe">Safe</MenuItem>
                  <MenuItem value="balanced">Balanced</MenuItem>
                  <MenuItem value="bold">Bold</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth size="small">
                <InputLabel id="auto-edit-preset-label">Preset</InputLabel>
                <Select
                  labelId="auto-edit-preset-label"
                  value={autoEditOptions.preset}
                  label="Preset"
                  onChange={updateAutoEditPreset}
                >
                  <MenuItem value="reel-30">30s Reel</MenuItem>
                  <MenuItem value="story-60">60s Story</MenuItem>
                  <MenuItem value="interview">Interview Cut</MenuItem>
                </Select>
              </FormControl>

              <Box>
                <Typography variant="caption" color="text.secondary">
                  Target Duration: {autoEditOptions.targetDurationSeconds.toFixed(1)}s
                </Typography>
                <Slider
                  value={autoEditOptions.targetDurationSeconds}
                  min={10}
                  max={180}
                  step={1}
                  onChange={updateAutoEditTargetDuration}
                />
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary">
                  Transition Density: {Math.round(autoEditOptions.transitionDensity * 100)}%
                </Typography>
                <Slider
                  value={autoEditOptions.transitionDensity}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={updateAutoEditTransitionDensity}
                />
              </Box>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Min Shot: {autoEditOptions.minShotDurationSeconds.toFixed(2)}s
                  </Typography>
                  <Slider
                    value={autoEditOptions.minShotDurationSeconds}
                    min={0.2}
                    max={8}
                    step={0.05}
                    onChange={updateAutoEditMinShotDuration}
                  />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Max Shot: {autoEditOptions.maxShotDurationSeconds.toFixed(2)}s
                  </Typography>
                  <Slider
                    value={autoEditOptions.maxShotDurationSeconds}
                    min={0.8}
                    max={20}
                    step={0.1}
                    onChange={updateAutoEditMaxShotDuration}
                  />
                </Box>
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={autoEditOptions.includeAssemble}
                      onChange={handleAutoEditOptionToggle('includeAssemble')}
                    />
                  }
                  label="Auto Assemble"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={autoEditOptions.includePolish}
                      onChange={handleAutoEditOptionToggle('includePolish')}
                    />
                  }
                  label="Auto Polish"
                />
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={autoEditOptions.addMarkers}
                      onChange={handleAutoEditOptionToggle('addMarkers')}
                    />
                  }
                  label="Add markers"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={autoEditOptions.addAudioBed}
                      onChange={handleAutoEditOptionToggle('addAudioBed')}
                    />
                  }
                  label="Audio bed"
                />
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={autoEditOptions.enforceNoOverlap}
                      onChange={handleAutoEditOptionToggle('enforceNoOverlap')}
                    />
                  }
                  label="No overlap constraints"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={autoEditOptions.cleanupFillerPauses}
                      onChange={handleAutoEditOptionToggle('cleanupFillerPauses')}
                    />
                  }
                  label="Filler/pause cleanup"
                />
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={autoEditOptions.enableDucking}
                      onChange={handleAutoEditOptionToggle('enableDucking')}
                    />
                  }
                  label="Auto ducking"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={autoEditOptions.enableJCutLCut}
                      onChange={handleAutoEditOptionToggle('enableJCutLCut')}
                    />
                  }
                  label="J/L cuts"
                />
              </Stack>

              {autoEditHistoryForProject.length > 0 && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Recent Auto Edit Jobs
                  </Typography>
                  <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                    {autoEditHistoryForProject.slice(0, 4).map((entry) => (
                      <Typography key={entry.id} variant="caption" color="text.secondary">
                        {new Date(entry.generatedAt).toLocaleString()} • {entry.preset}/{entry.variant} • {(entry.confidence * 100).toFixed(0)}% • {entry.status}
                      </Typography>
                    ))}
                  </Stack>
                </Box>
              )}

              <Alert severity="info">
                Auto Edit creates a non-destructive preview first. Review, then Apply or Revert.
              </Alert>
              {autoEditRunning && (
                <Alert severity="info">
                  Running server ranking{autoEditJobId ? ` (job ${autoEditJobId.slice(0, 8)})` : ''}...
                  {typeof autoEditServerProgress === 'number'
                    ? ` ${Math.round(autoEditServerProgress)}%`
                    : ''}
                </Alert>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeAutoEditDialog}>
              {autoEditRunning ? 'Stop' : 'Cancel'}
            </Button>
            <Button
              variant="contained"
              onClick={runAutoEdit}
              disabled={autoEditRunning || clips.length === 0}
              startIcon={autoEditRunning ? <CircularProgress size={14} /> : <AutoFixHighIcon />}
            >
              {autoEditRunning
                ? `Generating${typeof autoEditServerProgress === 'number' ? ` (${Math.round(autoEditServerProgress)}%)` : '…'}`
                : 'Generate Preview'}
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={closeSnackbar}>
          <Alert severity={snackbar.severity} onClose={closeSnackbar}>{snackbar.message}</Alert>
        </Snackbar>

        {/* Face Detection Options Dialog */}
        <Dialog open={showFaceDetectionOptionsDialog} onClose={cancelFaceDetectionOptionsDialog} maxWidth="sm" fullWidth>
          <DialogTitle>Ansiktsgjenkjenning - Alternativer</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <FormControlLabel
                control={<Switch checked={faceDetectionOptions.scanEntire} onChange={handleFaceDetectionScanEntireChange} />}
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
                  onChange={handleFaceDetectionFpsChange}
                  inputProps={{ step: 0.1, min: 0.1, max: 5 }}
                  helperText="Standard: 0.5 = 1 bilde hvert 2. sekund"
                  fullWidth
                />
              )}
              <FormControl fullWidth>
                <InputLabel>Analyseoppgaver</InputLabel>
                <Select
                  value={faceDetectionOptions.taskChoice}
                  onChange={handleFaceDetectionTaskChoiceChange}
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
            <Button onClick={cancelFaceDetectionOptionsDialog}>Avbryt</Button>
            <Button variant="contained" onClick={confirmFaceDetectionOptionsDialog}>Start analyse</Button>
          </DialogActions>
        </Dialog>

        {/* Subclips Confirm Dialog */}
        <Dialog open={showSubclipsConfirmDialog} onClose={rejectSubclipsCreation} maxWidth="sm" fullWidth>
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
            <Button onClick={rejectSubclipsCreation}>Nei, bare markører</Button>
            <Button variant="contained" color="primary" onClick={acceptSubclipsCreation}>Ja, opprett sub-klipp</Button>
          </DialogActions>
        </Dialog>

        {/* Settings Dialog */}
        <Dialog open={settingsOpen} onClose={closeSettingsDialog} maxWidth="sm" fullWidth>
          <DialogTitle>Studio Settings</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <FormControlLabel
                control={<Switch checked={driveUploadsEnabled} onChange={handleDriveUploadsEnabledChange} />}
                label="Enable Drive uploads"
              />
              <FormControlLabel
                control={<Switch checked={drivePrimaryEnabled} onChange={handleDrivePrimaryEnabledChange} disabled={!driveUploadsEnabled} />}
                label="Enable primary (same-file) updates"
              />
              <FormControl size="small" fullWidth disabled={!driveUploadsEnabled || !drivePrimaryEnabled}>
                <InputLabel id="primary-interval-label">Drive primary update interval</InputLabel>
                <Select
                  labelId="primary-interval-label"
                  label="Drive primary update interval"
                  value={drivePrimaryIntervalMs}
                  onChange={handleDrivePrimaryIntervalChange}
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
                onChange={handleDrivePrimaryFolderNameChange}
                disabled={!driveUploadsEnabled || !drivePrimaryEnabled}
              />
              <TextField
                size="small"
                label="Primary filename template"
                helperText="Use {id}, {projectId}, {name}, {ts}"
                value={drivePrimaryFilenameTemplate}
                onChange={handleDrivePrimaryFilenameTemplateChange}
                disabled={!driveUploadsEnabled || !drivePrimaryEnabled}
              />

              <FormControlLabel
                control={<Switch checked={driveBackupEnabled} onChange={handleDriveBackupEnabledChange} disabled={!driveUploadsEnabled} />}
                label="Enable timestamped backups"
              />
              <FormControl size="small" fullWidth disabled={!driveUploadsEnabled || !driveBackupEnabled}>
                <InputLabel id="backup-interval-label">Backup new-file cadence</InputLabel>
                <Select
                  labelId="backup-interval-label"
                  label="Backup new-file cadence"
                  value={driveBackupIntervalMs}
                  onChange={handleDriveBackupIntervalChange}
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
                onChange={handleDriveBackupFolderNameChange}
                disabled={!driveUploadsEnabled || !driveBackupEnabled}
              />
              <TextField
                size="small"
                label="Backup filename template"
                helperText="Use {id}, {projectId}, {name}, {ts}"
                value={driveBackupFilenameTemplate}
                onChange={handleDriveBackupFilenameTemplateChange}
                disabled={!driveUploadsEnabled || !driveBackupEnabled}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeSettingsDialog}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* Export Dialog - Browser ffmpeg */}
        <Suspense fallback={<LazyPanelFallback />}>
          <ExportDialog
            open={showExportDialog}
            onClose={closeExportDialog}
            clips={clips}
            tracks={tracks}
            storyArc={storyArc ? storyArc : undefined}
          />
        </Suspense>
        
        {/* DaVinci Resolve Export Dialog - Professional finishing */}
        <Suspense fallback={<LazyPanelFallback />}>
          <DaVinciResolveExportDialog
            open={showResolveExportDialog}
            onClose={closeResolveExportDialog}
            clips={clips}
            tracks={tracks}
            projectName={storyArc?.title || 'Untitled Project'}
            culture={resolveExportSettings.culture}
            projectType={resolveExportSettings.projectType}
          />
        </Suspense>
        
        {/* AI Story Generator Dialog - AUTO-CREATE TIMELINE! */}
        <Suspense fallback={<LazyPanelFallback />}>
          <AIStoryGeneratorDialog {...aiStoryGeneratorDialogProps} />
        </Suspense>
        
        {/* ================================================ */}
        {/* ALL PROFESSIONAL FEATURE PANELS */}
        {/* ================================================ */}
        
        {/* Transition Library - 485 transitions! */}
        <Suspense fallback={<LazyPanelFallback />}>
          <TransitionLibrary {...transitionLibraryProps} />
        </Suspense>
        
        {/* Speed Ramp Panel */}
        {speedRampPanelProps.isVisible && (
          <Suspense fallback={<LazyPanelFallback />}>
            <SpeedRampPanel
              clipId={speedRampPanelProps.clipId}
              clipDuration={speedRampPanelProps.clipDuration}
              currentKeyframes={speedRampPanelProps.currentKeyframes}
              onKeyframesChange={speedRampPanelProps.onKeyframesChange}
              onPreview={speedRampPanelProps.onPreview}
            />
          </Suspense>
        )}
        
        {/* ================================================ */}
        {/* ALL REMAINING PROFESSIONAL PANELS */}
        {/* ================================================ */}
        
        {/* Text Overlay Panel */}
        <Suspense fallback={<LazyPanelFallback />}>
          <TextOverlayPanel {...textOverlayPanelProps} />
        </Suspense>
        
        {/* GPU Filters Panel */}
        <Suspense fallback={<LazyPanelFallback />}>
          <GPUFiltersPanel {...gpuFiltersPanelProps} />
        </Suspense>
        
        {/* Color Grading Panel */}
        <Suspense fallback={<LazyPanelFallback />}>
          <ColorGradingPanel {...colorGradingPanelProps} />
        </Suspense>

        <Suspense fallback={<LazyPanelFallback />}>
          <LUTLibrary
            open={showLUTLibraryDialog}
            onClose={closeLUTLibraryDialog}
            onSelectLUT={handleSelectLUT}
          />
        </Suspense>

        <Suspense fallback={<LazyPanelFallback />}>
          <HLSImportDialog
            open={showHLSImportDialog}
            onClose={closeHLSImportDialog}
            onImport={handleImportStream}
          />
        </Suspense>

        <StoryArcSceneDetectionDialog
          open={showSceneDetectionDialog}
          onClose={closeSceneDetectionDialog}
          sceneDetectionJobId={sceneDetectionJobId}
          sceneDetectionProgress={sceneDetectionProgress}
          onJumpToSceneStart={jumpToSceneStart}
        />

        {/* Auto-Captions Panel */}
        <Suspense fallback={<LazyPanelFallback />}>
          <AutoCaptionsPanel {...autoCaptionsPanelProps} />
        </Suspense>
        
        {/* Beat Sync Panel */}
        {beatSyncPanelProps.isVisible && (
          <Suspense fallback={<LazyPanelFallback />}>
            <BeatSyncPanel
              open={beatSyncPanelProps.open}
              onClose={beatSyncPanelProps.onClose}
              audioPath={beatSyncPanelProps.audioPath}
              clips={beatSyncPanelProps.clips}
              onClipsSnapped={beatSyncPanelProps.onClipsSnapped}
            />
          </Suspense>
        )}
        
        {/* Background Removal Panel */}
        {ENABLE_EXPERIMENTAL_TIMELINE_PANELS && selectedClips.size > 0 && (
          <Suspense fallback={<LazyPanelFallback />}>
            <BackgroundRemovalPanel
              open={showGPUFiltersPanel && appliedFilters.has('background-removal')}
              onClose={backgroundRemovalPanelProps.onClose}
              clipId={backgroundRemovalPanelProps.clipId}
              onProcessed={backgroundRemovalPanelProps.onProcessed}
            />
          </Suspense>
        )}
        
        {/* Motion Tracking Panel */}
        {ENABLE_EXPERIMENTAL_TIMELINE_PANELS && selectedClips.size > 0 && (
          <>
            <Suspense fallback={<LazyPanelFallback />}>
              <ObjectSegmentationPanel {...objectSegmentationPanelProps} />
              <MotionTrackingPanel {...motionTrackingPanelProps} />
            </Suspense>
          </>
        )}
      </Box>

      {/* Rating Dialog */}
      <EnhancementRatingDialog
        open={showRatingDialog}
        onClose={closeRatingDialog}
        enhancementType="video"
        onSubmitRating={handleSubmitVideoRating}
        title="Vurder AI-generert tidslinje"
        description="Din tilbakemelding hjelper oss å trene AI-modellene slik at de blir bedre for norske videografer!"
      />

      {/* Audio Enhancement Dialog */}
      <AudioEnhancementDialog
        open={audioEnhancementDialogProps.open}
        onClose={audioEnhancementDialogProps.onClose}
        audioFile={audioEnhancementDialogProps.audioFile}
        onEnhanced={audioEnhancementDialogProps.onEnhanced}
        onSkip={audioEnhancementDialogProps.onSkip}
        preset={audioEnhancementDialogProps.preset}
      />

      <StoryArcSyncDialog
        open={showSyncDialog}
        onClose={closeSyncDialog}
        syncJobId={syncJobId}
        syncTryReallyHard={syncTryReallyHard}
        syncPreferTimecode={syncPreferTimecode}
        syncEnableDriftCorrection={syncEnableDriftCorrection}
        syncAllowClipReorder={syncAllowClipReorder}
        syncUseServerFirst={syncUseServerFirst}
        onSyncTryReallyHardChange={handleSyncTryReallyHardChange}
        onSyncPreferTimecodeChange={handleSyncPreferTimecodeChange}
        onSyncEnableDriftCorrectionChange={handleSyncEnableDriftCorrectionChange}
        onSyncAllowClipReorderChange={handleSyncAllowClipReorderChange}
        onSyncUseServerFirstChange={handleSyncUseServerFirstChange}
        syncMaxOffsetSeconds={syncMaxOffsetSeconds}
        onSyncMaxOffsetWindowChange={updateSyncMaxOffsetWindow}
        clips={clips}
        clipMeta={clipMeta}
        selectedSyncClips={selectedSyncClips}
        onToggleSyncClipSelectionClick={handleToggleSyncClipSelectionClick}
        syncInProgress={syncInProgress}
        syncResults={syncResults}
        syncPreviewMode={syncPreviewMode}
        syncResultRows={syncResultRows}
        syncConfidenceSummary={syncConfidenceSummary}
        onManualOffsetSliderChange={handleManualOffsetSliderChange}
        onResetManualOffsetClick={handleResetManualOffsetClick}
        onClearManualOffsetClick={handleClearManualOffsetClick}
        onResetSyncPreview={resetSyncPreview}
        onApplySync={applySync}
        onRunSync={runSync}
      />

      <Dialog
        open={showCompositionGuideDialog}
        onClose={closeCompositionGuideSettingsDialog}
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
                  onChange={handleShowCompositionGuidesChange}
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
                  onChange={handleCompositionGuideTargetChange}
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
                  onChange={handleCompositionAspectMaskChange}
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
                  onChange={handleCompositionSpiralOrientationChange}
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
                      onChange={handleCompositionGuideToggleChange}
                      inputProps={withDataInputProps({
                        'data-testid': 'composition-toggle-rule-of-thirds',
                        'data-guide-key': 'ruleOfThirds',
                      })}
                    />
                  }
                  label="Rule of Thirds"
                />
              <FormControlLabel
                control={
                  <Switch
                    checked={compositionGuides.centerCrosshair}
                    onChange={handleCompositionGuideToggleChange}
                    inputProps={withDataInputProps({ 'data-guide-key': 'centerCrosshair' })}
                  />
                }
                label="Center Crosshair"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={compositionGuides.goldenRatio}
                    onChange={handleCompositionGuideToggleChange}
                    inputProps={withDataInputProps({ 'data-guide-key': 'goldenRatio' })}
                  />
                }
                label="Golden Ratio"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={compositionGuides.goldenSpiral}
                    onChange={handleCompositionGuideToggleChange}
                    inputProps={withDataInputProps({ 'data-guide-key': 'goldenSpiral' })}
                  />
                }
                label="Golden Spiral"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={compositionGuides.diagonals}
                    onChange={handleCompositionGuideToggleChange}
                    inputProps={withDataInputProps({ 'data-guide-key': 'diagonals' })}
                  />
                }
                label="Diagonals"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={compositionGuides.dynamicSymmetry}
                    onChange={handleCompositionGuideToggleChange}
                    inputProps={withDataInputProps({ 'data-guide-key': 'dynamicSymmetry' })}
                  />
                }
                label="Dynamic Symmetry"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={compositionGuides.safeAreas}
                    onChange={handleCompositionGuideToggleChange}
                    inputProps={withDataInputProps({ 'data-guide-key': 'safeAreas' })}
                  />
                }
                label="Safe Areas"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={compositionGuides.eyeLine}
                    onChange={handleCompositionGuideToggleChange}
                    inputProps={withDataInputProps({ 'data-guide-key': 'eyeLine' })}
                  />
                }
                label="Eye Line"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={compositionGuides.headroomLeadroom}
                    onChange={handleCompositionGuideToggleChange}
                    inputProps={withDataInputProps({ 'data-guide-key': 'headroomLeadroom' })}
                  />
                }
                label="Headroom / Leadroom"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={compositionGuides.horizonLine}
                    onChange={handleCompositionGuideToggleChange}
                    inputProps={withDataInputProps({ 'data-guide-key': 'horizonLine' })}
                  />
                }
                label="Horizon Line"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={compositionGuides.perspective}
                    onChange={handleCompositionGuideToggleChange}
                    inputProps={withDataInputProps({ 'data-guide-key': 'perspective' })}
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
                onChange={handleCompositionGuideColorChange}
                size="small"
                sx={{ width: 120 }}
                inputProps={withDataInputProps({ 'data-testid': 'composition-guide-color' })}
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
                  onChange={handleCompositionGuideOpacityChange}
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
                  onChange={handleCompositionGuideThicknessChange}
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
            onClick={closeCompositionGuideSettingsDialog}
            variant="contained"
          >
            Done
          </Button>
        </DialogActions>
      </Dialog>

      {/* Batch Audio Enhancement Dialog */}
      <BatchAudioEnhancementDialog
        open={batchAudioDialogProps.open}
        onClose={batchAudioDialogProps.onClose}
        audioFiles={batchAudioDialogProps.audioFiles}
        onBatchComplete={batchAudioDialogProps.onBatchComplete}
        defaultPreset={batchAudioDialogProps.defaultPreset}
      />

      {/* AI Audio Assistant Dialog */}
      <AIAudioAssistantDialog
        open={aiAudioAssistantDialogProps.open}
        onClose={aiAudioAssistantDialogProps.onClose}
        audioTracks={aiAudioAssistantDialogProps.audioTracks}
        selectedTrackId={aiAudioAssistantDialogProps.selectedTrackId}
        openMixerDirectly={aiAudioAssistantDialogProps.openMixerDirectly}
        onMixComplete={aiAudioAssistantDialogProps.onMixComplete}
      />
      
      <StoryArcFaceDetectionDialog
        open={showFaceDetectionDialog}
        onClose={closeFaceDetectionProgressDialog}
        faceDetectionRunning={faceDetectionRunning}
        faceDetectionProgress={faceDetectionProgress}
        resolveClipName={resolveClipName}
        onDialogAction={handleFaceDetectionDialogAction}
      />

      {/* Push Notification Settings Dialog */}
      {isSupported && (
        <Dialog open={pushSettingsOpen} onClose={closePushSettingsDialog} maxWidth="sm" fullWidth>
          <DialogTitle>Push-varsler innstillinger</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <PushNotificationSettings userId={userId} showDescription={false} />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={closePushSettingsDialog}>Lukk</Button>
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
  const byTrackMap = new Map(byTrack.map((clip) => [clip.id, clip]));
  return clips.map((clip) => byTrackMap.get(clip.id) || clip);
}

function newTrackIdForClip(clips: BeatClip[], id: string): string | null {
  for (const clip of clips) {
    if (clip.id === id) {
      return clip.trackId;
    }
  }
  return null;
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
  const clipIndex = clips.findIndex((clip) => clip.id === clipId);
  if (clipIndex < 0) return clips;
  const c = clips[clipIndex];
  const copy = { ...c, id: c.id +'_copy', start: c.start + c.duration + 0.1 } as BeatClip;
  return [...clips, copy];
}

function deleteClip(clips: BeatClip[], clipId: string, ripple: boolean): BeatClip[] {
  const clipIndex = clips.findIndex((clip) => clip.id === clipId);
  if (clipIndex < 0) return clips;
  const c = clips[clipIndex];
  const next = clips.filter((clip) => clip.id !== clipId);
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
