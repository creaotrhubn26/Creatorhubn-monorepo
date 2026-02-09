import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
  Speed,
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
import { Dialog, DialogTitle, DialogContent, DialogActions, Stepper, Step, StepLabel, StepContent, Snackbar, FormControl, InputLabel, Select, MenuItem, Switch, FormControlLabel, LinearProgress, Checkbox, List, ListItem, ListItemButton, ListItemText, ListItemSecondaryAction, CircularProgress, ListItemText as ListItemTextType } from '@mui/material';
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
import { faceDetectionWorker, type FaceDetectionProgress, type FaceDetectionResult } from '../services/face-detection-worker';
import { 
  FilterVintage, 
  Palette, 
  TextFields, 
  Subtitles,
  MusicNote,
  RemoveCircle
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

const INITIAL_PANEL_SIZES: PanelSizes = {
  leftPanel: 300, // Asset Browser width
  rightPanel: 320  // Inspector width  
};

const MIN_PANEL_SIZE = 200;
const MAX_PANEL_SIZE = 500;

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

  // Pro timeline states
  const [trackStates, setTrackStates] = useState<Record<string, TrackState>>({});
  const [trackHeightScale, setTrackHeightScale] = useState(1);
  const [markers, setMarkers] = useState<TimelineMarker[]>([]);
  const [transitions, setTransitions] = useState<TimelineTransition[]>([]);
  const [magneticEnabled, setMagneticEnabled] = useState(true);
  const [rippleEnabled, setRippleEnabled] = useState(false);
  const [pendingTransitionType, setPendingTransitionType] = useState<string | null>(null);

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
  
  // Refs for resizing
  const leftResizerRef = useRef<HTMLDivElement>(null);
  const rightResizerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<'left' | 'right' | null>(null);
  
  // Video canvas ref - REAL VIDEO RENDERING
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [engineReady, setEngineReady] = useState(false);
  
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
  const userId = user?.id || (user as any)?.sub;
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
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' | 'warning' }>({ open: false, message: ',', severity: 'info' });
  
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
      const response = await fetch('/api/story-arc/projects,', { credentials: 'include' });
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
      const response = await fetch('/api/story-arc/onboarding/complete, ', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ completed: true }),
      });
      
      if (!response.ok) {
        // Fallback to localStorage if API fails
        localStorage.setItem('storyArcStudio_onboardingCompleted, ','true');
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
  const location = useLocation();
  const navigate = useNavigate();
  const [projectContext, setProjectContext] = useState<ProjectToEditorData | null>(
    location.state as ProjectToEditorData || null
  );
  const [editingStartTime] = useState(Date.now());
  const [culturalMomentsDetected, setCulturalMomentsDetected] = useState<string[]>([]);
  
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
        console.log('📋 Loaded shot list:', projectContext.shotList.length, 'shots');
      }
      
      // Load timeline events for pacing
      if (projectContext.timelineEvents && projectContext.timelineEvents.length > 0) {
        console.log('⏰ Loaded timeline events:', projectContext.timelineEvents.length, 'events');
      }
      
      // Show success message
      console.log('✅ Project data imported successfully!');
      
    } catch (error) {
      console.error('❌ Error importing project data:', error);
    }
  }, [projectContext]);
  
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
  const handleExportToProject = useCallback(async (exportedVideo: any) => {
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
      
      console.log('✅ Video exported to project successfully!');
      
      // Navigate back to dashboard
      navigate('/dashboard?tab=projects');
      
    } catch (error) {
      console.error('❌ Error exporting to project:', error);
    }
  }, [projectContext, editingStartTime, tracks, culturalMomentsDetected, navigate]);
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
  const [syncResults, setSyncResults] = useState<Record<string, { offset_seconds: number; offset_frames: number; confidence: number; method?: string }> | null>(null);
  const [manualOffsets, setManualOffsets] = useState<Record<string, number>>({});
  const [syncPreviewMode, setSyncPreviewMode] = useState(false);

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
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [monitorFolderLink, setMonitorFolderLink] = useState<string | null>(null);
  const [driveInit, setDriveInit] = useState<{ status: 'idle' | 'initializing' | 'ready' | 'needs_auth' | 'needs_google_connect' | 'error'; message?: string; folderId?: string; }>({ status: 'idle' });
  
  const loadStoryArcData = async () => {
    try {
      setIsLoading(true);
      const arcData = await StoryArcDataIntegration.fetchStoryArcData(storyArcId);
      
      if (arcData) {
        setStoryArc(arcData);
        const { clips: beatClips, tracks: trackData } = StoryArcDataIntegration.convertStoryArcToBeats(arcData);
        setClips(beatClips);
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
        const externalProjectId = (projectContext as any)?.projectId;
        if (!id && externalProjectId) {
          // Ensure mapping + Drive folder ready up-front
          const ensureUrl = `/api/story-arc/by-project/${encodeURIComponent(String(externalProjectId))}/ensure?name=${encodeURIComponent((projectContext as any)?.projectName || 'Untitled Project')}`;
          let res = await fetch(ensureUrl, { method: 'POST', credentials: 'include' });
          if (!res.ok) {
            // fallback to mapping-only GET
            res = await fetch(`/api/story-arc/by-project/${encodeURIComponent(String(externalProjectId))}`, { credentials: 'include' });
          }
          const json = await res.json().catch(() => ({}));
          if (aborted) return;
          if (json?.success && json?.storyArcId) {
            id = json.storyArcId;
            setStoryArc(prev => prev ? { ...prev, id } as any : ({ id, title: (projectContext as any)?.projectName || 'Untitled Project', type: 'wedding', totalDuration: totalDuration, segments: [], musicSuggestions: [], colorGrading: {} as any, confidence: 0.9, createdAt: new Date().toISOString() }));
          }
        }
        if (!id) return;
        // Load editor state
        const res2 = await fetch(`/api/story-arc/${id}/editor-state`, { credentials: 'include' });
        if (!res2.ok) return;
        const json2 = await res2.json();
        if (aborted || !json2?.success || !json2?.editorState) return;
        const st = json2.editorState;
        if (Array.isArray(st.tracks)) setTracks(st.tracks);
        if (st.trackStates) setTrackStates(st.trackStates);
        if (Array.isArray(st.clips)) setClips(st.clips);
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
      } catch (e) {
        console.warn('Editor state load skipped:', (e as any)?.message);
      }
    })();
    return () => { aborted = true; };
  }, [storyArcId, storyArc?.id, projectContext]);

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
      } catch (e: any) {
        // Fallback: ensure mapping and upload JSON to Drive
        let fallbackOk = false;
        const pid = (projectContext as any)?.projectId;
        if (pid && driveUploadsEnabled) {
          try {
            await fetch(`/api/story-arc/by-project/${encodeURIComponent(String(pid))}/ensure?name=${encodeURIComponent((projectContext as any)?.projectName || 'Untitled Project')}`, { method: 'POST', credentials: 'include' });
          } catch {}
          try {
            const tsStr = new Date().toISOString().replace(/[:.]/g, '-, ');
            // Primary file (same name for Drive versions)
            let upPrimaryOk = true;
            if (drivePrimaryEnabled) {
              const primaryBlob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
              const primaryForm = new FormData();
              primaryForm.append('projectId', String(pid));
              primaryForm.append('folderName', drivePrimaryFolderName);
              const primaryName = renderFilename(drivePrimaryFilenameTemplate, { id: String(id), projectId: pid, projectName: (projectContext as any)?.projectName, ts: tsStr });
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
              const backupName = renderFilename(driveBackupFilenameTemplate, { id: String(id), projectId: pid, projectName: (projectContext as any)?.projectName, ts: tsStr });
              backupForm.append('file', backupBlob, backupName);
              const upBackup = await fetch('/api/google/drive/upload-contract', { method: 'POST', credentials: 'include', body: backupForm });
              upBackupOk = upBackup.ok;
            }
            fallbackOk = upPrimaryOk && upBackupOk;
          } catch {}
        }
        if (fallbackOk) {
          setSavedVia('drive');
          setLastSavedAt(Date.now());
          setSaveStatus('saved');
        } else {
          setSaveStatus('error');
          setSaveError(e?.message || 'Save failed');
        }
      }
      // Opportunistic periodic Drive backup when DB save succeeded
      try {
        const now = Date.now();
        if (!savedOk) return;
        if ((projectContext as any)?.projectId && driveUploadsEnabled) {
          const pid = String((projectContext as any).projectId);
          const tsStr = new Date().toISOString().replace(/[:.]/g, '-');
          // Primary upload (same filename) based on primary interval
          if (drivePrimaryEnabled && now - lastPrimaryUploadRef.current > drivePrimaryIntervalMs) {
            const primaryBlob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
            const primaryForm = new FormData();
            primaryForm.append('projectId', pid);
            primaryForm.append('folderName', drivePrimaryFolderName);
            const primaryName = renderFilename(drivePrimaryFilenameTemplate, { id: String(id), projectId: pid, projectName: (projectContext as any)?.projectName, ts: tsStr });
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
            const backupName = renderFilename(driveBackupFilenameTemplate, { id: String(id), projectId: pid, projectName: (projectContext as any)?.projectName, ts: tsStr });
            backupForm.append('file', backupBlob, backupName);
            await fetch('/api/google/drive/upload-contract', { method: 'POST', credentials: 'include', body: backupForm });
            lastBackupUploadRef.current = now;
          }
        }
      } catch {}
    }, 800);
    return () => clearTimeout(t);
  }, [buildEditorState, storyArcId, storyArc?.id, projectContext]);

  // Load initial data when component mounts or storyArcId changes
  useEffect(() => {
    loadStoryArcData();
  }, [storyArcId]);

  // Listen for asset add-to-timeline events
  useEffect(() => {
    const handler = async (e: any) => {
      const detail = e?.detail as { media: any; position: 'playhead' | 'append'; track: string };
      if (!detail || !detail.media) return;
      const isAudio = detail.media.type === 'audio' || (detail.media.mimeType || ',').startsWith('audio/');

      // If audio file, show enhancement dialog first
      if (isAudio && detail.media.file) {
        setPendingAudioFile(detail.media.file);
        setShowAudioEnhancementDialog(true);

        // Store the detail for later use
        (window as any).__pendingAudioDetail = detail;
        return;
      }

      const targetTrackId = detail.track || (isAudio ? 'audio-1' : 'video-1');
      const clipDuration = Number(detail.media.duration || 5);
      setTracks((prev) => {
        if (!prev.find(t => t.id === targetTrackId)) {
          const newTrack = { id: targetTrackId, name: targetTrackId, type: isAudio ? 'audio' : 'video' } as any;
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
          color: isAudio ? '#4caf50' : '#2196f3',
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
        
        // Update clipMetadata state for timeline display
        if (detail.media.camera || detail.media.syncGroup || detail.media.tags) {
          setClipMeta((prev: any) => ({
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
    };
    window.addEventListener('storyarc:add-media', handler as any);
    return () => window.removeEventListener('storyarc:add-media', handler as any);
  }, [currentTime, storyArc?.totalDuration]);

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
        } catch (e) {
          // Server check failed, continue
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

  const handleZoomChange = (event: Event, newValue: number | number[]) => {
    setTimelineZoom(newValue as number);
  };

  // Professional keyboard shortcuts - FIXED: Added missing dependencies
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      const key = e.key.toLowerCase();
      switch (key) {
        case ', ': // Spacebar - Play/Pause
          e.preventDefault();
          setIsPlaying(prev => !prev);
          break;
        case 'escape': // Stop
          e.preventDefault();
          setIsPlaying(false);
          setCurrentTime(0);
          setPlaybackSpeed(1);
          break;
        case 'arrowleft': // Frame backward
          e.preventDefault();
          setCurrentTime(prev => Math.max(0, prev - frameTime));
          setIsPlaying(false);
          break;
        case 'arrowright': // Frame forward
          e.preventDefault();
          setCurrentTime(prev => Math.min(totalDuration, prev + frameTime));
          setIsPlaying(false);
          break;
        case 'j': // J/K/L professional controls
          e.preventDefault();
          setIsPlaying(prev => {
            if (prev && playbackDirection === 'reverse') {
              setPlaybackSpeed(speed => Math.min(8, speed * 2));
              return true;
            } else {
              setPlaybackDirection('reverse');
              setPlaybackSpeed(1);
              return true;
            }
          });
          break;
        case 'k':
          e.preventDefault();
          setIsPlaying(false);
          setPlaybackSpeed(1);
          break;
        case 'l':
          e.preventDefault();
          setIsPlaying(prev => {
            if (prev && playbackDirection === 'forward') {
              setPlaybackSpeed(speed => Math.min(8, speed * 2));
              return true;
            } else {
              setPlaybackDirection('forward');
              setPlaybackSpeed(1);
              return true;
            }
          });
          break;
        case 'home': // Go to beginning
          e.preventDefault();
          setCurrentTime(0);
          break;
        case 'end': // Go to end
          e.preventDefault();
          setCurrentTime(totalDuration);
          break;
        case 'delete':
        case 'backspace':
          e.preventDefault();
          if (reviewerMode) break;
          if (selectedClips.size > 0) {
            setClips(prev => {
              let next = prev.slice();
              for (const id of Array.from(selectedClips)) {
                next = deleteClip(next, id, rippleEnabled);
              }
              return next;
            });
          }
          break;
        case 's':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            // Save functionality placeholder
          }
          break;
        case 'i': // Mark in point
          e.preventDefault();
          // Mark in functionality placeholder
          break;
        case 'o': // Mark out point
          e.preventDefault();
          // Mark out functionality placeholder
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [playbackDirection, totalDuration, frameTime, reviewerMode, selectedClips, rippleEnabled]);

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
      .replaceAll('{id},', String(ctx.id || 'unknown'))
      .replaceAll('{projectId},', ctx.projectId ? String(ctx.projectId) : ',')
      .replaceAll('{name},', ctx.projectName ? String(ctx.projectName) : ',')
      .replaceAll('{ts},', ctx.ts || ',');
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
            
            {/* Professional Transport Controls */}
            <Stack direction="row" spacing={1} sx={{ mr: 2 }}>
              {/* Main Transport */}
              <ButtonGroup size="small">
                <Tooltip title="Stop (Esc)">
                  <IconButton size="small" onClick={handleStop}>
                    <Stop fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Play/Pause (Space)">
                  <IconButton 
                    size="small" 
                    onClick={handlePlayPause}
                    sx={{ 
                      bgcolor: isPlaying ? 'rgba(76, 175, 80, 0.2)' : 'transparent', '&:hover': {
                        bgcolor: isPlaying ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255,255,255,0.1)'
                      }
                    }}
                  >
                    {isPlaying ? <Pause fontSize="small" /> : <PlayArrow fontSize="small" />}
                  </IconButton>
                </Tooltip>
              </ButtonGroup>

              {/* Frame Navigation */}
              <ButtonGroup size="small">
                <Tooltip title="Previous Frame (←)">
                  <IconButton size="small" onClick={stepBackward}>
                    <KeyboardArrowLeft fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Next Frame (→)">
                  <IconButton size="small" onClick={stepForward}>
                    <KeyboardArrowRight fontSize="small" />
                  </IconButton>
                </Tooltip>
              </ButtonGroup>

              {/* Professional J/K/L Controls */}
              <ButtonGroup size="small">
                <Tooltip title="Reverse Play (J)">
                  <IconButton 
                    size="small" 
                    onClick={() => handleJKLControl('j')}
                    sx={{
                      bgcolor: isPlaying && playbackDirection === 'reverse' ? 'rgba(255, 152, 0, 0.2)' : 'transparent'
                    }}
                  >
                    <FastRewind fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Pause (K)">
                  <IconButton size="small" onClick={() => handleJKLControl('k')}>
                    <Pause fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Forward Play (L)">
                  <IconButton 
                    size="small" 
                    onClick={() => handleJKLControl('l')}
                    sx={{
                      bgcolor: isPlaying && playbackDirection === 'forward' ? 'rgba(76, 175, 80, 0.2)' : 'transparent'
                    }}
                  >
                    <FastForward fontSize="small" />
                  </IconButton>
                </Tooltip>
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
                label={saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? (lastSavedAt ? `Saved ${formatRelativeTime(lastSavedAt)}` : 'Saved') : saveStatus === 'error' ? 'Save error' : 'Idle'}
                color={saveStatus === 'error' ? 'error' : saveStatus === 'saved' ? 'success' : 'default'}
                variant="outlined"
              />
              <Button size="small" variant="outlined" onClick={() => setOnboardingOpen(true)}>Onboarding</Button>
              {/* Search & filter */}
              <TextField size="small" placeholder="Search tags, scene, name…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} sx={{ minWidth: 220 }} />
              <TextField size="small" placeholder="Filter tags (comma)" onBlur={(e) => setFilterTags(e.target.value.split('').map(s => s.trim()).filter(Boolean))} sx={{ minWidth: 180 }} />
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
                  startIcon={<AutoFixHigh />}
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
                          const taskList = choice.split('').map(t => t.trim() as 'parsing' | 'landmarks' | 'headpose' | 'attributes').filter(Boolean);
                          if (taskList.length > 0) {
                            tasks = taskList;
                          }
                        }
                      }
                      
                      const results = await faceDetectionWorker.processClips(
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
                              ? { ...c, color: '#10b981' as any } // Green for face detected
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
                                color: '#10b981' as any, // Green to indicate face-detected segment
                                // Preserve source file and add offset for sub-clip
                                sourceFile: originalClip.sourceFile,
                                metadata: {
                                  ...originalClip.metadata,
                                  sourceStartTime: ((originalClip.metadata as any)?.sourceStartTime || 0) + segment.start,
                                },
                              };
                              newClips.push(subClip);
                            });
                          }
                        }
                        
                        setClips(newClips);
                        setTotalDuration(Math.max(...newClips.map(c => c.start + c.duration), totalDuration));
                        
                        // Update timeline engine
                        videoEngine.setTimeline(newClips, tracks, Math.max(...newClips.map(c => c.start + c.duration), totalDuration));
                        
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
                  <IconButton onClick={() => setShowSpeedRampPanel(true)}>
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
                  <IconButton onClick={() => setShowAutoCaptionsPanel(true)}>
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
                      // Get first video clip
                      const videoClip = clips.find(c => c.type === 'video' || !c.type);
                      if (!videoClip) {
                        setSnackbar({
                          open: true,
                          message: 'No video clips found',
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
                            video_path: videoClip.sourceFile,
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
                                  message: `Scene detection, failed: ${statusResponse.error}`,
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
                          message: `Scene detection, error: ${error?.message || 'Unknown error'}`,
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
                    onClick={() => {
                      // Auto-select clips with sync groups or cameras
                      const syncableClips = clips.filter(c => 
                        clipMeta[c.id]?.syncGroup || clipMeta[c.id]?.camera || (c as any).metadata?.syncGroup
                      );
                      if (syncableClips.length >= 2) {
                        setSelectedSyncClips(new Set(syncableClips.map(c => c.id)));
                      }
                      setShowSyncDialog(true);
                    }}
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
                  const preferredTrackId = firstSelected ? (clips.find(c => c.id === firstSelected)?.trackId || undefined) : undefined;
                  const { time: placeTime, trackId } = findNearestCut(clips, tracks, currentTime, preferredTrackId);
                  const id = 'tr' + Date.now();
                  setTransitions(prev => [...prev, { id, time: placeTime, trackId, type: pendingTransitionType }]);
                  setPendingTransitionType(null);
                }}>Place Transition</Button>
              )}
            </Stack>
          </Toolbar>
        </AppBar>

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
            {/* Edit Tools */}
            <ButtonGroup size="small">
              <Tooltip title="Undo (Ctrl+Z)">
                <IconButton size="small">
                  <Undo fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Redo (Ctrl+Y)">
                <IconButton size="small">
                  <Redo fontSize="small" />
                </IconButton>
              </Tooltip>
            </ButtonGroup>

            <Divider orientation="vertical" flexItem />

            {/* Clip Tools */}
            <ButtonGroup size="small">
              <Tooltip title="Cut (Ctrl+X)">
                <IconButton size="small">
                  <ContentCut fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Copy (Ctrl+C)">
                <IconButton size="small">
                  <ContentCopy fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Paste (Ctrl+V)">
                <IconButton size="small">
                  <ContentPaste fontSize="small" />
                </IconButton>
              </Tooltip>
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
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" fontWeight={600}>
                Asset Browser
              </Typography>
            </Box>
            
            {/* Auto Monitor Component */}
            <Box sx={{ p: 2 }}>
              <StoryArcAutoMonitor 
                userId={currentUser?.id || 'guest'} 
                onStatusChange={(enabled) => {
                  console.log('Auto monitoring status changed:', enabled);
                }}
              />
            </Box>
            
            <AssetBrowser
              height={400}
              storyArcId={storyArcId}
              onTimelineInit={({ storyArc: arc, clips: newClips, tracks: newTracks }) => {
                setStoryArc(arc);
                setClips(newClips);
                setTracks(newTracks);
                const total = Math.max(...newClips.map(c => c.start + c.duration), arc.totalDuration || 0);
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

          {/* Center Panel - Professional Timeline */}
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
              setClips(prev => {
                // apply move
                let next = prev.map(clip => clip && clip.id === clipId ? { ...clip, start: newStart, trackId: newTrackId } : clip);
                if (magneticEnabled) {
                  next = resolveOverlaps(next, newTrackId);
                }
                const maxEnd = Math.max(...next.map(c => c.start + c.duration), storyArc?.totalDuration || 0);
                setTotalDuration(maxEnd);
                return next;
              });
            }}
            onClipResize={(clipId, newStart, newDuration) => {
              setClips(prev => {
                let targetTrack = newTrackIdForClip(prev, clipId);
                let next = prev.map(clip => clip && clip.id === clipId ? { ...clip, start: newStart, duration: newDuration } : clip);
                if (magneticEnabled && targetTrack) {
                  next = resolveOverlaps(next, targetTrack);
                }
                const maxEnd = Math.max(...next.map(c => c.start + c.duration), storyArc?.totalDuration || 0);
                setTotalDuration(maxEnd);
                return next;
              });
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
          />

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
            <InspectorPanel
              selectedClips={useMemo(() => 
                Array.from(selectedClips).map(clipId => clips.find(c => c && c.id === clipId)).filter(Boolean) as BeatClip[],
                [selectedClips, clips]
              )}
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
              height={600}
            />
          </Paper>
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
                        {recentProjects.map((project: any) => (
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
                                } as any);
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
                      disabled={ensuringMapping || !(projectContext as any)?.projectId}
                      onClick={async () => {
                        try {
                          setEnsuringMapping(true);
                          const pid = (projectContext as any)?.projectId;
                          if (!pid) {
                            setSnackbar({ open: true, message: 'No project in context. Select a project above or create a new one.', severity: 'warning' });
                            return;
                          }
                          const res = await fetch(`/api/story-arc/by-project/${encodeURIComponent(String(pid))}/ensure?name=${encodeURIComponent((projectContext as any)?.projectName || 'Untitled Project')}`, {
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
                            } as any);
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
                    Toggles: Magnetic, Ripple, Reviewer. Shortcuts: Space (Play/Pause), J/K/L, ←/→ frame.
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
            
            setClips(aiClips);
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
              colorGrading: {} as any,
              confidence: 0.9,
              createdAt: new Date().toISOString()
            });
            
            // Set timeline in engine
            videoEngine.setTimeline(aiClips, tracks, data.timeline.totalDuration);

            setShowAIGeneratorDialog(false);

            console.log('✅ AI-generated timeline loaded!', aiClips.length, 'clips');

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
            setShowTransitionLibrary(false);
          }}
        />
        
        {/* Speed Ramp Panel */}
        {selectedClips.size > 0 && (
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
        
        {/* Professional Waveform - Audio Track */}
        {clips.find(c => (trackStates[c.trackId]?.type || (c.trackId || '').startsWith('audio')) ) && (
          <Box sx={{ position: 'absolute', bottom: 200, left: 0, right: 0, zIndex: 10}}>
            <ProfessionalWaveform
              audioUrl={clips.find(c => c?.trackId === 'audio-1')?.sourceFile || ','}
              height={96}
              waveColor="#667eea"
              progressColor="#764ba2"
              enableRegions={true}
              onReady={(wavesurfer) => {
                console.log('✅ Waveform ready');
              }}
              onRegionCreated={(region) => {
                console.log('✅ Audio region created:', region);
              }}
            />
          </Box>
        )}
        
        {/* ================================================ */}
        {/* ALL REMAINING PROFESSIONAL PANELS */}
        {/* ================================================ */}
        
        {/* Text Overlay Panel */}
        <TextOverlayPanel
          open={showTextOverlayPanel}
          onClose={() => setShowTextOverlayPanel(false)}
          onAddOverlay={(overlay) => {
            setTextOverlays(prev => [...prev, overlay]);
            console.log('✅ Text overlay added:', overlay);
          }}
        />
        
        {/* GPU Filters Panel */}
        <GPUFiltersPanel
          open={showGPUFiltersPanel}
          onClose={() => setShowGPUFiltersPanel(false)}
          onApplyFilter={(filterId, config) => {
            setAppliedFilters(prev => new Map(prev).set(filterId, config));
            console.log('✅ GPU filter applied:', filterId);
          }}
        />
        
        {/* Color Grading Panel */}
        <ColorGradingPanel
          open={showColorGradingPanel}
          onClose={() => setShowColorGradingPanel(false)}
          onApplyGrade={(grade) => {
            setCurrentColorGrade(grade);
            console.log('✅ Color grade applied:', grade);
          }}
        />
        
        {/* Scene Detection Dialog */}
        <Dialog open={showSceneDetectionDialog} onClose={() => setShowSceneDetectionDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Scene Detection</DialogTitle>
          <DialogContent>
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
                      <ListItemText
                        primary={`Scene ${scene.scene_number}`}
                        secondary={`${scene.start_time.toFixed(2)}s - ${scene.end_time.toFixed(2)}s (${scene.duration.toFixed(2)}s)`}
                      />
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
          videoPath={storyArc?.id || 'current-video'}
          onCaptionsGenerated={(captions, srt, vtt) => {
            console.log('✅ Captions generated:', captions.length, 'segments');
            // Add captions to timeline
          }}
        />
        
        {/* Beat Sync Panel */}
        {clips.find(c => c?.trackId === 'audio-1') && (
          <BeatSyncPanel
            open={showBeatSyncPanel}
            onClose={() => setShowBeatSyncPanel(false)}
            audioPath={clips.find(c => c?.trackId === 'audio-1')?.sourceFile || ', '}
            clips={clips}
            onClipsSnapped={(snappedClips) => {
              setClips(snappedClips);
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
          const detail = (window as any).__pendingAudioDetail;
          if (detail) {
            const targetTrackId = detail.track || 'audio-1';
            const clipDuration = Number(detail.media.duration || 5);

            setTracks((prev) => {
              if (!prev.find(t => t.id === targetTrackId)) {
                const newTrack = { id: targetTrackId, name: targetTrackId, type: 'audio' } as any;
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
              const enhancedName = originalName.replace(/\.[^/.]+$/, ', ') + '_enhanced' + (originalName.match(/\.[^/.]+$/) ? originalName.match(/\.[^/.]+$/)![0] : '.wav');
              
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
            delete (window as any).__pendingAudioDetail;
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
          const detail = (window as any).__pendingAudioDetail;
          if (detail) {
            const targetTrackId = detail.track || 'audio-1';
            const clipDuration = Number(detail.media.duration || 5);

            setTracks((prev) => {
              if (!prev.find(t => t.id === targetTrackId)) {
                const newTrack = { id: targetTrackId, name: targetTrackId, type: 'audio' } as any;
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
          setClipMeta((prev: any) => ({
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
            delete (window as any).__pendingAudioDetail;
          }

          setShowAudioEnhancementDialog(false);
          setPendingAudioFile(null);
        }}
        preset="auto"
      />

      {/* Multi-Angle Sync Dialog */}
      <Dialog 
        open={showSyncDialog} 
        onClose={() => {
          setShowSyncDialog(false);
          setSelectedSyncClips(new Set());
          setSyncInProgress(false);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Sync />
            <Typography variant="h6">Sync Multi-Angle Clips</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <Alert severity="info">
              Select clips to synchronize. Clips with the same sync group or camera angle will be automatically aligned.
            </Alert>
            
            <Typography variant="subtitle2" sx={{ fontWeight: 600}}>
              Select Clips to Sync ({selectedSyncClips.size} selected)
            </Typography>
            
            <List sx={{ maxHeight: 400, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              {clips.map((clip) => {
                const meta = clipMeta[clip.id] || {};
                const camera = meta.camera || (clip as any).metadata?.camera;
                const syncGroup = meta.syncGroup || (clip as any).metadata?.syncGroup;
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
                <Typography variant="body2">
                  Synchronizing clips... This may take a few moments.
                </Typography>
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
                            {hasManualAdjustment && (
                              <Chip 
                                size="small" 
                                label="Manual" 
                                color="info"
                                sx={{ height: 18, fontSize: 9 }}
                              />
                            )}
                          </Box>
                          <Slider
                            value={manualOffset}
                            onChange={(_, value) => {
                              setManualOffsets(prev => ({
                                ...prev,
                                [clipId]: value as number
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
          <Button onClick={() => {
            setShowSyncDialog(false);
            setSelectedSyncClips(new Set());
            setSyncInProgress(false);
            setSyncResults(null);
            setManualOffsets({});
            setSyncPreviewMode(false);
          }}>
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
                variant="contained"
                onClick={async () => {
                  // Collect training data before applying
                  const selectedClips = clips.filter(c => selectedSyncClips.has(c.id));
                  const referenceClip = selectedClips[0];
                  
                  // Prepare training data
                  const autoOffsets: Record<string, number> = {};
                  const autoConfidences: Record<string, number> = {};
                  const manualOffsetsData: Record<string, number> = {};
                  const cameraSetup: Record<string, any> = {};
                  const videoMetadata: Record<string, any> = {};
                  
                  Object.entries(syncResults).forEach(([clipId, result]) => {
                    autoOffsets[clipId] = result.offset_seconds;
                    autoConfidences[clipId] = result.confidence;
                    const manualOffset = manualOffsets[clipId];
                    if (manualOffset !== undefined && Math.abs(manualOffset - result.offset_seconds) > 0.01) {
                      manualOffsetsData[clipId] = manualOffset;
                    }
                    
                    const clip = clips.find(c => c.id === clipId);
                    if (clip) {
                      const meta = clipMeta[clipId] || {};
                      cameraSetup[clipId] = {
                        camera: meta.camera || (clip as any).metadata?.camera,
                        syncGroup: meta.syncGroup || (clip as any).metadata?.syncGroup,
                      };
                      videoMetadata[clipId] = {
                        duration: clip.duration,
                        trackId: clip.trackId,
                      };
                    }
                  });
                  
                  const hasManualAdjustments = Object.keys(manualOffsetsData).length > 0;
                  const avgConfidence = Object.values(autoConfidences).reduce((a, b) => a + b, 0) / Object.values(autoConfidences).length;
                  
                  // Calculate adjustment magnitude (RMS of differences)
                  let adjustmentMagnitude = 0;
                  if (hasManualAdjustments) {
                    const differences = Object.entries(manualOffsetsData).map(([clipId, manual]) => {
                      return Math.abs(manual - autoOffsets[clipId]);
                    });
                    adjustmentMagnitude = Math.sqrt(
                      differences.reduce((a, b) => a + b * b, 0) / differences.length
                    );
                  }
                  
                  // Save training data to database
                  try {
                    await apiRequest('/api/video-sync/training-data', {
                      method: 'POST',
                      headers: { 'Content-Type' : 'application/json' },
                      body: JSON.stringify({
                        storyArcId: storyArcId || storyArc?.id,
                        clipIds: Array.from(selectedSyncClips),
                        referenceClipId: referenceClip.id,
                        autoOffsetSeconds: autoOffsets,
                        autoConfidence: autoConfidences,
                        manualOffsetSeconds: hasManualAdjustments ? manualOffsetsData : null,
                        manualAdjustmentApplied: hasManualAdjustments,
                        syncMethod: syncResults[Object.keys(syncResults)[0]]?.method || 'auto',
                        cameraSetup,
                        videoMetadata,
                        originalAvgConfidence: avgConfidence,
                        adjustmentMagnitude: hasManualAdjustments ? adjustmentMagnitude : 0,
                      })
                    });
                    console.log('✅ Training data saved for future fine-tuning');
                  } catch (error: any) {
                    console.error('Failed to save training data:', error);
                    // Don't block sync application if training data save fails
                  }
                  
                  // Apply sync offsets to clips using manual adjustments
                  setClips((prev) => {
                    return prev.map(clip => {
                      const manualOffset = manualOffsets[clip.id];
                      const result = syncResults[clip.id];
                      
                      if (result && manualOffset !== undefined) {
                        return {
                          ...clip,
                          start: clip.start + manualOffset,
                          metadata: {
                            ...clip.metadata,
                            syncOffset: manualOffset,
                            syncConfidence: result.confidence,
                            syncMethod: result.method || 'auto',
                            originalAutoOffset: result.offset_seconds,
                            manuallyAdjusted: Math.abs(manualOffset - result.offset_seconds) > 0.01,
                          }
                        };
                      }
                      return clip;
                    });
                  });
                  
                  setSnackbar({
                    open: true,
                    message: `Sync applied! Adjusted ${Object.keys(manualOffsets).length} clips${hasManualAdjustments ? ' (training data saved)' : ', '}`,
                    severity: 'success'
                  });
                  
                  setShowSyncDialog(false);
                  setSelectedSyncClips(new Set());
                  setSyncResults(null);
                  setManualOffsets({});
                  setSyncPreviewMode(false);
                }}
              >
                Apply Sync
              </Button>
            </>
          ) : (
            <Button
              variant="contained"
              onClick={async () => {
                if (selectedSyncClips.size < 2) {
                  setSnackbar({
                    open: true,
                    message: 'Please select at least 2 clips to sync',
                    severity: 'warning'
                  });
                  return;
                }
                
                setSyncInProgress(true);
              
              try {
                const selectedClips = clips.filter(c => selectedSyncClips.has(c.id));
                const referenceClip = selectedClips[0];
                
                // Prepare clip data for sync
                const clipData = selectedClips.map(clip => ({
                  id: clip.id,
                  path: clip.sourceFile || '',
                  type: clip.trackId?.includes('audio') ? 'audio' : 'video',
                  camera: clipMeta[clip.id]?.camera || (clip as any).metadata?.camera,
                  syncGroup: clipMeta[clip.id]?.syncGroup || (clip as any).metadata?.syncGroup,
                }));
                
                // Create sync job
                const jobResponse = await apiRequest('/api/video-sync/sync-clips', {
                  method: 'POST',
                  headers: { 'Content-Type' : 'application/json' },
                  body: JSON.stringify({
                    storyArcId: storyArcId || storyArc?.id,
                    clipIds: Array.from(selectedSyncClips),
                    referenceClipId: referenceClip.id,
                  })
                });
                
                if (!jobResponse.success) {
                  throw new Error(jobResponse.error || 'Failed to create sync job');
                }
                
                const jobId = jobResponse.jobId;
                setSyncJobId(jobId);
                
                // Submit clip details
                const submitResponse = await apiRequest('/api/video-sync/submit-clips', {
                  method: 'POST',
                  headers: { 'Content-Type' : 'application/json' },
                  body: JSON.stringify({
                    jobId,
                    clips: clipData,
                  })
                });
                
                if (!submitResponse.success) {
                  throw new Error(submitResponse.error || 'Failed to submit clips');
                }
                
                // Poll for results
                const pollInterval = setInterval(async () => {
                  try {
                    const jobStatus = await apiRequest(`/api/video-sync/jobs/${jobId}`);
                    
                    if (jobStatus.job?.status === 'completed') {
                      clearInterval(pollInterval);
                      setSyncInProgress(false);
                      
                      // Store sync results for preview and manual adjustment
                      const syncResultsData = jobStatus.job.sync_results;
                      if (syncResultsData?.offsets) {
                        setSyncResults(syncResultsData.offsets);
                        // Initialize manual offsets with calculated offsets
                        const initialManualOffsets: Record<string, number> = {};
                        Object.entries(syncResultsData.offsets).forEach(([clipId, offset]: [string, any]) => {
                          initialManualOffsets[clipId] = offset.offset_seconds || 0;
                        });
                        setManualOffsets(initialManualOffsets);
                        setSyncPreviewMode(true); // Show preview mode
                      } else {
                        setShowSyncDialog(false);
                        setSelectedSyncClips(new Set());
                      }
                    } else if (jobStatus.job?.status === 'error') {
                      clearInterval(pollInterval);
                      setSyncInProgress(false);
                      setSnackbar({
                        open: true,
                        message: `Sync, failed: ${jobStatus.job.error || 'Unknown error'}`,
                        severity: 'error'
                      });
                    }
                  } catch (error: any) {
                    console.error('Polling error:', error);
                  }
                }, 2000); // Poll every 2 seconds
                
                // Timeout after 60 seconds
                setTimeout(() => {
                  clearInterval(pollInterval);
                  if (syncInProgress) {
                    setSyncInProgress(false);
                    setSnackbar({
                      open: true,
                      message: 'Sync timed out. Please check job status manually.',
                      severity: 'warning'
                    });
                  }
                }, 60000);
                
              } catch (error: any) {
                setSyncInProgress(false);
                setSnackbar({
                  open: true,
                  message: `Sync, error: ${error.message || 'Unknown error'}`,
                  severity: 'error'
                });
              }
              }}
              disabled={selectedSyncClips.size < 2 || syncInProgress}
              startIcon={syncInProgress ? <CircularProgress size={16} /> : <Sync />}
            >
              {syncInProgress ? 'Syncing...' : 'Sync Clips'}
            </Button>
          )}
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
                  const newTrack = { id: targetTrackId, name: targetTrackId, type: 'audio' } as any;
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
            sourceFile: c.sourceFile || ', ',
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
              const newTrack = { id: mixedTrackId, name: 'AI Mixed Audio', type: 'audio' } as any;
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
    let shift = 0;
    let encountered = false;
    for (const clip of next) {
      if (clip.trackId !== trackId) continue;
      if (!encountered && clip.start >= c.start) encountered = true;
      if (encountered) clip.start = Math.max(0, clip.start - c.duration);
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
